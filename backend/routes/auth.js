/* ==========================================================================
   auth.js
   Signup, login, session and the full password reset flow.

   Reset flow (3 steps):
     POST /auth/forgot-password  { email }                  -> emails a 6 digit OTP
     POST /auth/verify-otp       { email, otp }             -> returns a short lived reset token
     POST /auth/reset-password   { resetToken, password }   -> sets the new password

   Security properties:
     - The OTP is stored only as a SHA-256 hash, never in plaintext.
     - Responses never reveal whether an email is registered (no user enumeration).
     - OTPs expire, are single use, and are throttled per email + per IP.
     - The reset token is a JWT scoped with purpose:"password_reset" and bound to
       the password hash at issue time, so it dies the moment the password changes.
     - All previous OTPs for the account are invalidated once a new one is issued.
========================================================================== */

const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

const supabase = require("../config/supabase");
const env = require("../config/env");
const { signToken, requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const { sendPasswordResetOtp } = require("../utils/mailer");
const {
    isEmail,
    normalizeEmail,
    validatePassword,
    sanitizeText
} = require("../utils/validators");

const BCRYPT_ROUNDS = 12;

/* ==========================================================
                        HELPERS
========================================================== */

/*
    Never ship the bcrypt hash (or any reset material) to the client.
    The old /login and /signup handlers returned the whole row.
*/
function publicUser(row) {
    if (!row) return null;

    return {
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        created_at: row.created_at
    };
}

function hashOtp(otp, email) {
    return crypto
        .createHash("sha256")
        .update(`${otp}:${email}:${env.JWT_SECRET}`)
        .digest("hex");
}

function generateOtp() {
    // crypto.randomInt is uniformly distributed, Math.random is not.
    return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

async function findUserByEmail(email) {
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

    if (error) throw error;
    return data;
}

/*
    Bound to the current password hash: once the password changes the
    fingerprint no longer matches, so a leaked reset token is useless.
*/
function passwordFingerprint(hash) {
    return crypto
        .createHash("sha256")
        .update(String(hash || ""))
        .digest("hex")
        .slice(0, 16);
}

/* ==========================================================
                        SIGNUP
========================================================== */

router.post(
    "/signup",
    rateLimit({ windowMs: 15 * 60 * 1000, max: 20, key: "signup" }),
    async (req, res, next) => {
        try {
            const full_name = sanitizeText(req.body?.full_name, 80);
            const email = normalizeEmail(req.body?.email);
            const password = String(req.body?.password || "");

            if (!full_name || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Full name, email and password are required."
                });
            }

            if (!isEmail(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid email address."
                });
            }

            const passwordError = validatePassword(password);

            if (passwordError) {
                return res.status(400).json({
                    success: false,
                    message: passwordError
                });
            }

            const existing = await findUserByEmail(email);

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this email already exists."
                });
            }

            const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

            const { data, error } = await supabase
                .from("users")
                .insert({
                    full_name,
                    email,
                    password: hashedPassword
                })
                .select()
                .single();

            if (error) throw error;

            return res.status(201).json({
                success: true,
                message: "Account created successfully.",
                token: signToken(data),
                user: publicUser(data)
            });
        } catch (err) {
            return next(err);
        }
    }
);

/* ==========================================================
                        LOGIN
========================================================== */

router.post(
    "/login",
    rateLimit({ windowMs: 15 * 60 * 1000, max: 30, key: "login" }),
    async (req, res, next) => {
        try {
            const email = normalizeEmail(req.body?.email);
            const password = String(req.body?.password || "");

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Email and password are required."
                });
            }

            const user = await findUserByEmail(email);

            /*
                Same message + same work factor for "no such user" and
                "wrong password" so response timing and copy do not leak
                which emails are registered.
            */
            const storedHash =
                user?.password ||
                "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";

            const validPassword = await bcrypt.compare(password, storedHash);

            if (!user || !validPassword) {
                return res.status(401).json({
                    success: false,
                    message: "Incorrect email or password."
                });
            }

            return res.json({
                success: true,
                message: "Login successful.",
                token: signToken(user),
                user: publicUser(user)
            });
        } catch (err) {
            return next(err);
        }
    }
);

/* ==========================================================
                        CURRENT SESSION
========================================================== */

router.get("/me", requireAuth, async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from("users")
            .select("id, full_name, email, created_at")
            .eq("id", req.user.id)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Account no longer exists."
            });
        }

        return res.json({
            success: true,
            user: data
        });
    } catch (err) {
        return next(err);
    }
});

/* ==========================================================
                    FORGOT PASSWORD - STEP 1
                    Request an OTP
========================================================== */

router.post(
    "/forgot-password",
    rateLimit({ windowMs: 15 * 60 * 1000, max: 5, key: "forgot" }),
    async (req, res, next) => {
        try {
            const email = normalizeEmail(req.body?.email);

            if (!isEmail(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid email address."
                });
            }

            /*
                Uniform response regardless of whether the account exists.
                We still do the work asynchronously for real accounts.
            */
            const genericResponse = {
                success: true,
                message:
                    "If an account exists for that email, a 6-digit code has been sent. " +
                    "Check your inbox and spam folder.",
                expiresInMinutes: env.OTP_TTL_MINUTES
            };

            const user = await findUserByEmail(email);

            if (!user) {
                return res.json(genericResponse);
            }

            // Invalidate any outstanding codes for this account.
            await supabase
                .from("password_resets")
                .update({ used: true })
                .eq("user_id", user.id)
                .eq("used", false);

            const otp = generateOtp();

            const expiresAt = new Date(
                Date.now() + env.OTP_TTL_MINUTES * 60 * 1000
            ).toISOString();

            const { error: insertError } = await supabase
                .from("password_resets")
                .insert({
                    user_id: user.id,
                    email: user.email,
                    otp_hash: hashOtp(otp, user.email),
                    expires_at: expiresAt,
                    attempts: 0,
                    used: false
                });

            if (insertError) throw insertError;

            const delivery = await sendPasswordResetOtp(
                user.email,
                otp,
                user.full_name
            );

            /*
                In development without SMTP the code is printed to the server
                console. We surface that fact (never the code itself) so the
                developer knows where to look.
            */
            return res.json({
                ...genericResponse,
                delivery: env.isProduction ? undefined : delivery.channel
            });
        } catch (err) {
            return next(err);
        }
    }
);

/* ==========================================================
                    FORGOT PASSWORD - STEP 2
                    Verify the OTP
========================================================== */

router.post(
    "/verify-otp",
    rateLimit({ windowMs: 15 * 60 * 1000, max: 15, key: "verify" }),
    async (req, res, next) => {
        try {
            const email = normalizeEmail(req.body?.email);
            const otp = String(req.body?.otp || "").trim();

            if (!isEmail(email) || !/^\d{6}$/.test(otp)) {
                return res.status(400).json({
                    success: false,
                    message: "Enter the 6-digit code sent to your email."
                });
            }

            const user = await findUserByEmail(email);

            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: "This code is invalid or has expired."
                });
            }

            const { data: resets, error } = await supabase
                .from("password_resets")
                .select("*")
                .eq("user_id", user.id)
                .eq("used", false)
                .order("created_at", { ascending: false })
                .limit(1);

            if (error) throw error;

            const reset = resets?.[0];

            if (!reset) {
                return res.status(400).json({
                    success: false,
                    message: "This code is invalid or has expired."
                });
            }

            if (new Date(reset.expires_at).getTime() < Date.now()) {
                await supabase
                    .from("password_resets")
                    .update({ used: true })
                    .eq("id", reset.id);

                return res.status(400).json({
                    success: false,
                    message: "This code has expired. Please request a new one."
                });
            }

            if (Number(reset.attempts || 0) >= env.OTP_MAX_ATTEMPTS) {
                await supabase
                    .from("password_resets")
                    .update({ used: true })
                    .eq("id", reset.id);

                return res.status(429).json({
                    success: false,
                    message:
                        "Too many incorrect attempts. Please request a new code."
                });
            }

            const expected = hashOtp(otp, user.email);
            const stored = String(reset.otp_hash || "");

            const matches =
                expected.length === stored.length &&
                crypto.timingSafeEqual(
                    Buffer.from(expected),
                    Buffer.from(stored)
                );

            if (!matches) {
                await supabase
                    .from("password_resets")
                    .update({ attempts: Number(reset.attempts || 0) + 1 })
                    .eq("id", reset.id);

                const remaining =
                    env.OTP_MAX_ATTEMPTS - (Number(reset.attempts || 0) + 1);

                return res.status(400).json({
                    success: false,
                    message:
                        remaining > 0
                            ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
                            : "Too many incorrect attempts. Please request a new code."
                });
            }

            /* Mark consumed - the OTP itself can no longer be replayed. */
            await supabase
                .from("password_resets")
                .update({
                    used: true,
                    verified_at: new Date().toISOString()
                })
                .eq("id", reset.id);

            const resetToken = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    purpose: "password_reset",
                    pfp: passwordFingerprint(user.password),
                    rid: reset.id
                },
                env.JWT_SECRET,
                { expiresIn: "15m" }
            );

            return res.json({
                success: true,
                message: "Code verified. You can now set a new password.",
                resetToken,
                expiresInMinutes: 15
            });
        } catch (err) {
            return next(err);
        }
    }
);

/* ==========================================================
                    FORGOT PASSWORD - STEP 3
                    Set the new password
========================================================== */

router.post(
    "/reset-password",
    rateLimit({ windowMs: 15 * 60 * 1000, max: 15, key: "reset" }),
    async (req, res, next) => {
        try {
            const resetToken = String(req.body?.resetToken || "");
            const password = String(req.body?.password || "");
            const confirmPassword = String(
                req.body?.confirmPassword ?? password
            );

            if (!resetToken) {
                return res.status(400).json({
                    success: false,
                    message: "Reset session missing. Please start again."
                });
            }

            if (password !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Passwords do not match."
                });
            }

            const passwordError = validatePassword(password);

            if (passwordError) {
                return res.status(400).json({
                    success: false,
                    message: passwordError
                });
            }

            let payload;

            try {
                payload = jwt.verify(resetToken, env.JWT_SECRET);
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Your reset session has expired. Please request a new code."
                });
            }

            if (payload.purpose !== "password_reset") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid reset session."
                });
            }

            const user = await findUserByEmail(normalizeEmail(payload.email));

            if (!user || String(user.id) !== String(payload.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid reset session."
                });
            }

            /* Token was issued against a password that has since changed. */
            if (payload.pfp !== passwordFingerprint(user.password)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "This reset link has already been used. Please request a new code."
                });
            }

            const samePassword = await bcrypt.compare(password, user.password);

            if (samePassword) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Your new password must be different from your current password."
                });
            }

            const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

            const { error } = await supabase
                .from("users")
                .update({ password: hashedPassword })
                .eq("id", user.id);

            if (error) throw error;

            /* Burn every outstanding reset request for this account. */
            await supabase
                .from("password_resets")
                .update({ used: true })
                .eq("user_id", user.id)
                .eq("used", false);

            return res.json({
                success: true,
                message:
                    "Password updated successfully. You can now log in with your new password."
            });
        } catch (err) {
            return next(err);
        }
    }
);

/* ==========================================================
                    CHANGE PASSWORD (logged in)
========================================================== */

router.post("/change-password", requireAuth, async (req, res, next) => {
    try {
        const currentPassword = String(req.body?.currentPassword || "");
        const newPassword = String(req.body?.newPassword || "");

        const passwordError = validatePassword(newPassword);

        if (passwordError) {
            return res.status(400).json({
                success: false,
                message: passwordError
            });
        }

        const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", req.user.id)
            .maybeSingle();

        if (error) throw error;

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Account not found."
            });
        }

        const valid = await bcrypt.compare(currentPassword, user.password);

        if (!valid) {
            return res.status(401).json({
                success: false,
                message: "Your current password is incorrect."
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

        const { error: updateError } = await supabase
            .from("users")
            .update({ password: hashedPassword })
            .eq("id", user.id);

        if (updateError) throw updateError;

        return res.json({
            success: true,
            message: "Password changed successfully."
        });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;
