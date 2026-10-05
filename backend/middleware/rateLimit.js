/* ==========================================================================
   rateLimit.js
   Dependency-free in-memory rate limiter.

   Good enough for a single-instance deployment (Render free tier). For a
   multi-instance setup swap the Map for Redis - the middleware signature
   stays the same.
========================================================================== */

const buckets = new Map();

/* Periodic sweep so the Map cannot grow unbounded. */
const SWEEP_INTERVAL = 5 * 60 * 1000;

const sweeper = setInterval(() => {
    const now = Date.now();

    for (const [key, entry] of buckets) {
        if (entry.resetAt <= now) {
            buckets.delete(key);
        }
    }
}, SWEEP_INTERVAL);

// Do not keep the process alive purely for the sweeper.
if (typeof sweeper.unref === "function") {
    sweeper.unref();
}

function clientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];

    if (typeof forwarded === "string" && forwarded.length) {
        return forwarded.split(",")[0].trim();
    }

    return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * @param {object}  options
 * @param {number}  options.windowMs  Window length in milliseconds.
 * @param {number}  options.max       Max requests per window.
 * @param {string}  options.key       Namespace so different routes do not share a bucket.
 * @param {boolean} options.byEmail   Also bucket by req.body.email (blocks targeted attacks).
 */
function rateLimit({
    windowMs = 15 * 60 * 1000,
    max = 60,
    key = "global",
    byEmail = true
} = {}) {
    return (req, res, next) => {
        const email =
            byEmail && req.body?.email
                ? String(req.body.email).toLowerCase().trim()
                : "";

        const identity = `${key}:${clientIp(req)}:${email}`;

        const now = Date.now();
        let entry = buckets.get(identity);

        if (!entry || entry.resetAt <= now) {
            entry = {
                count: 0,
                resetAt: now + windowMs
            };
            buckets.set(identity, entry);
        }

        entry.count += 1;

        const remaining = Math.max(0, max - entry.count);

        res.setHeader("X-RateLimit-Limit", max);
        res.setHeader("X-RateLimit-Remaining", remaining);
        res.setHeader(
            "X-RateLimit-Reset",
            Math.ceil(entry.resetAt / 1000)
        );

        if (entry.count > max) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

            res.setHeader("Retry-After", retryAfter);

            return res.status(429).json({
                success: false,
                message: `Too many requests. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`
            });
        }

        return next();
    };
}

function resetRateLimits() {
    buckets.clear();
}

module.exports = {
    rateLimit,
    resetRateLimits
};
