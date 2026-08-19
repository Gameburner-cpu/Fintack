/* ==========================================================================
   mailer.js
   Transactional email for FinTack.

   Uses nodemailer when SMTP credentials are present. When they are not
   (local development), it degrades to logging the message to the server
   console so the reset flow remains testable end to end.
========================================================================== */

const env = require("../config/env");

let transporter = null;
let transporterFailed = false;

async function getTransporter() {
    if (transporter || transporterFailed || !env.smtpConfigured) {
        return transporter;
    }

    try {
        const nodemailer = require("nodemailer");

        transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS
            }
        });

        await transporter.verify();
        console.log("[FinTack Mailer] SMTP transport ready.");
    } catch (err) {
        transporterFailed = true;
        transporter = null;
        console.error("[FinTack Mailer] SMTP unavailable:", err.message);
    }

    return transporter;
}

/* ==========================================================
                    SEND MAIL
========================================================== */

async function sendMail({ to, subject, text, html }) {
    const mail = await getTransporter();

    if (!mail) {
        console.log(
            "\n=============== FINTACK DEV EMAIL ===============\n" +
            `To:      ${to}\n` +
            `Subject: ${subject}\n\n` +
            `${text}\n` +
            "=================================================\n"
        );

        return {
            delivered: false,
            channel: "console"
        };
    }

    await mail.sendMail({
        from: env.MAIL_FROM,
        to,
        subject,
        text,
        html
    });

    return {
        delivered: true,
        channel: "smtp"
    };
}

/* ==========================================================
                    PASSWORD RESET OTP
========================================================== */

async function sendPasswordResetOtp(email, otp, fullName = "there") {
    const minutes = env.OTP_TTL_MINUTES;

    const text =
        `Hi ${fullName},\n\n` +
        `Your FinTack password reset code is ${otp}.\n\n` +
        `It expires in ${minutes} minutes and can only be used once.\n\n` +
        "If you did not request a password reset you can safely ignore " +
        "this email - your password will not change.\n\n" +
        "- FinTack";

    const html = `
        <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0d1117;color:#e6edf3;border-radius:12px">
            <h2 style="margin:0 0 4px;color:#58a6ff">FinTack</h2>
            <p style="margin:0 0 20px;color:#8d97a5;font-size:13px">Password reset request</p>
            <p>Hi ${fullName},</p>
            <p>Use this code to reset your password:</p>
            <div style="font-size:32px;letter-spacing:10px;font-weight:700;background:#161b22;padding:16px;text-align:center;border-radius:10px;margin:20px 0">
                ${otp}
            </div>
            <p style="color:#8d97a5;font-size:13px">
                This code expires in ${minutes} minutes and can only be used once.
            </p>
            <p style="color:#8d97a5;font-size:13px">
                If you did not request a password reset, ignore this email -
                your password will not change.
            </p>
        </div>
    `;

    return sendMail({
        to: email,
        subject: "Your FinTack password reset code",
        text,
        html
    });
}

module.exports = {
    sendMail,
    sendPasswordResetOtp
};
