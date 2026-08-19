/* ==========================================================================
   env.js
   Central environment configuration + validation.

   Fails fast on missing critical secrets instead of letting the app boot
   into a broken state (previously JWT_SECRET being undefined would make
   jwt.sign throw at request time).
========================================================================== */

require("dotenv").config();

/*
    SUPABASE_SERVICE_ROLE was the name used by the original config; both are
    accepted so existing deployments keep working without an env rename.
*/
const SUPABASE_KEY =
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

const REQUIRED = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    "SUPABASE_KEY (or SUPABASE_SERVICE_ROLE)": SUPABASE_KEY,
    JWT_SECRET: process.env.JWT_SECRET
};

const missing = Object.keys(REQUIRED).filter(key => !REQUIRED[key]);

if (missing.length) {
    console.error(
        `[FinTack] Missing required environment variables: ${missing.join(", ")}\n` +
        "Copy backend/.env.example to backend/.env and fill in the values."
    );

    if (process.env.NODE_ENV === "production") {
        process.exit(1);
    }
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 24) {
    console.warn(
        "[FinTack] JWT_SECRET is short. Use at least 32 random characters in production."
    );
}

const env = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: Number(process.env.PORT) || 5000,

    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY,

    JWT_SECRET: process.env.JWT_SECRET || "fintack-insecure-dev-secret",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    FINNHUB_API_KEY: process.env.FINNHUB_API_KEY || "",

    /* SMTP / password reset */
    SMTP_HOST: process.env.SMTP_HOST || "",
    SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
    SMTP_SECURE: String(process.env.SMTP_SECURE || "false") === "true",
    SMTP_USER: process.env.SMTP_USER || "",
    SMTP_PASS: process.env.SMTP_PASS || "",
    MAIL_FROM: process.env.MAIL_FROM || "FinTack <no-reply@fintack.app>",

    OTP_TTL_MINUTES: Number(process.env.OTP_TTL_MINUTES) || 10,
    OTP_MAX_ATTEMPTS: Number(process.env.OTP_MAX_ATTEMPTS) || 5,

    /* Comma separated list. "*" allows everything (dev only). */
    CORS_ORIGINS: process.env.CORS_ORIGINS || "*"
};

env.isProduction = env.NODE_ENV === "production";
env.smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

module.exports = env;
