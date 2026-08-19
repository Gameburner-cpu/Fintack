/* ==========================================================================
   errorHandler.js
   Central 404 + error handling.

   Every route previously did its own try/catch and echoed err.message
   straight back to the client, which leaked Postgres/Supabase internals.
   Routes now call next(err) and this decides what is safe to expose.
========================================================================== */

const env = require("../config/env");

/* Postgres error codes worth translating into user-facing copy. */
const PG_MESSAGES = {
    "23505": "That record already exists.",
    "23503": "Related record not found.",
    "23502": "A required field is missing.",
    "22P02": "One of the supplied values has the wrong format.",
    "42501": "You do not have permission to perform this action."
};

function notFound(req, res) {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    const status =
        err.status ||
        err.statusCode ||
        (PG_MESSAGES[err.code] ? 400 : 500);

    console.error(
        `[FinTack] ${req.method} ${req.originalUrl} ->`,
        err.code || "",
        err.message
    );

    const message =
        PG_MESSAGES[err.code] ||
        (status < 500
            ? err.message
            : "Something went wrong on our side. Please try again.");

    res.status(status).json({
        success: false,
        message,
        // Stack traces only outside production.
        ...(env.isProduction ? {} : { detail: err.message })
    });
}

module.exports = {
    notFound,
    errorHandler
};
