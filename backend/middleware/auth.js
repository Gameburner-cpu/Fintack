/* ==========================================================================
   auth.js
   JWT authentication + resource ownership middleware.

   Before this existed every /api route was fully public: anyone could read
   or mutate any user's transactions and goals by guessing a user id (IDOR).
========================================================================== */

const jwt = require("jsonwebtoken");
const env = require("../config/env");

/* ==========================================================
                    SIGN TOKEN
========================================================== */

function signToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email
        },
        env.JWT_SECRET,
        {
            expiresIn: env.JWT_EXPIRES_IN
        }
    );
}

/* ==========================================================
                    REQUIRE AUTH
========================================================== */

function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
        ? header.slice(7).trim()
        : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });
    }

    try {
        req.user = jwt.verify(token, env.JWT_SECRET);
        return next();
    } catch (err) {
        const expired = err.name === "TokenExpiredError";

        return res.status(401).json({
            success: false,
            code: expired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
            message: expired
                ? "Your session has expired. Please log in again."
                : "Invalid authentication token."
        });
    }
}

/* ==========================================================
                    OPTIONAL AUTH

   Used by routes that work anonymously but personalise the
   response when a valid token is present (e.g. AI ask).
========================================================== */

function optionalAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
        ? header.slice(7).trim()
        : null;

    if (token) {
        try {
            req.user = jwt.verify(token, env.JWT_SECRET);
        } catch (err) {
            req.user = null;
        }
    }

    return next();
}

/* ==========================================================
                    OWNERSHIP GUARD

   Confirms the :userId route param (or body.user_id) matches
   the authenticated principal.
========================================================== */

function requireSelf(paramName = "userId") {
    return (req, res, next) => {
        const target = String(
            req.params[paramName] ??
            req.body?.user_id ??
            req.query?.user_id ??
            ""
        );

        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        if (target && target !== String(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this resource."
            });
        }

        return next();
    };
}

module.exports = {
    signToken,
    requireAuth,
    optionalAuth,
    requireSelf
};
