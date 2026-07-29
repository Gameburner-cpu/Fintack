const express = require("express");
const router = express.Router();

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

/* =====================================================
                    HELPERS
===================================================== */

function requireFinnhubKey() {
    const key = process.env.FINNHUB_API_KEY;

    if (!key) {
        throw new Error(
            "FINNHUB_API_KEY is missing. Add it to backend/.env and restart the backend."
        );
    }

    return key;
}

async function finnhubGet(path, params = {}) {
    const token = requireFinnhubKey();

    const url = new URL(`${FINNHUB_BASE_URL}${path}`);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    });

    const response = await fetch(url, {
        headers: {
            "X-Finnhub-Token": token
        }
    });

    if (!response.ok) {
        const body = await response.text();

        throw new Error(
            `Finnhub request failed (${response.status}): ${body || response.statusText}`
        );
    }

    return response.json();
}

function normalizeArticle(article) {
    return {
        id: article.id,
        category: article.category || "",
        headline: article.headline || "",
        summary: article.summary || "",
        source: article.source || "",
        image: article.image || "",
        url: article.url || "",
        related: article.related || "",
        datetime: article.datetime || null,
        publishedAt: article.datetime
            ? new Date(article.datetime * 1000).toISOString()
            : null
    };
}

function cleanLimit(value, fallback = 10, maximum = 30) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }

    return Math.min(parsed, maximum);
}

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

/* =====================================================
                HEALTH / CONNECTION TEST
===================================================== */

/*
    GET /api/news/test

    Confirms that:
    - the route is mounted,
    - FINNHUB_API_KEY is available,
    - Finnhub can be reached.
*/

router.get("/test", async (req, res) => {
    try {
        const data = await finnhubGet("/news", {
            category: "general",
            minId: 0
        });

        res.json({
            success: true,
            message: "Finnhub connection is working.",
            articlesReceived: Array.isArray(data) ? data.length : 0
        });
    } catch (err) {
        console.error("[FinTack News] Test error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =====================================================
                GENERAL MARKET NEWS
===================================================== */

/*
    GET /api/news/market?category=general&limit=10

    Finnhub categories:
    general, forex, crypto, merger
*/

router.get("/market", async (req, res) => {
    try {
        const allowedCategories = new Set([
            "general",
            "forex",
            "crypto",
            "merger"
        ]);

        const requestedCategory = String(
            req.query.category || "general"
        ).toLowerCase();

        const category = allowedCategories.has(requestedCategory)
            ? requestedCategory
            : "general";

        const limit = cleanLimit(req.query.limit, 10, 30);

        const data = await finnhubGet("/news", {
            category,
            minId: 0
        });

        const articles = (Array.isArray(data) ? data : [])
            .filter(article => article?.headline && article?.url)
            .slice(0, limit)
            .map(normalizeArticle);

        res.json({
            success: true,
            category,
            count: articles.length,
            articles
        });
    } catch (err) {
        console.error("[FinTack News] Market news error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =====================================================
                COMPANY / STOCK NEWS
===================================================== */

/*
    GET /api/news/company/AAPL?days=7&limit=10

    NOTE:
    Finnhub's Company News endpoint is documented for
    North American companies.
*/

router.get("/company/:symbol", async (req, res) => {
    try {
        const symbol = String(req.params.symbol || "")
            .trim()
            .toUpperCase();

        if (!/^[A-Z0-9.\-]{1,15}$/.test(symbol)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid stock symbol."
            });
        }

        const requestedDays = Number.parseInt(req.query.days, 10);
        const days = Number.isFinite(requestedDays)
            ? Math.min(Math.max(requestedDays, 1), 365)
            : 7;

        const limit = cleanLimit(req.query.limit, 10, 30);

        const toDate = new Date();
        const fromDate = new Date();

        fromDate.setUTCDate(fromDate.getUTCDate() - days);

        const data = await finnhubGet("/company-news", {
            symbol,
            from: formatDate(fromDate),
            to: formatDate(toDate)
        });

        const articles = (Array.isArray(data) ? data : [])
            .filter(article => article?.headline && article?.url)
            .sort((a, b) => (b.datetime || 0) - (a.datetime || 0))
            .slice(0, limit)
            .map(normalizeArticle);

        res.json({
            success: true,
            symbol,
            from: formatDate(fromDate),
            to: formatDate(toDate),
            count: articles.length,
            articles
        });
    } catch (err) {
        console.error("[FinTack News] Company news error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =====================================================
                DAILY STOCK NEWS
===================================================== */

/*
    GET /api/news/daily?symbols=AAPL,MSFT,NVDA&limit=6

    This combines recent company news for multiple symbols.
    It is intended for FinTack's DAILY STOCK NEWS section.

    To avoid wasting free API calls, keep the default
    symbol list small.
*/

router.get("/daily", async (req, res) => {
    try {
        const rawSymbols = String(
            req.query.symbols || "AAPL,MSFT,NVDA"
        );

        const symbols = [
            ...new Set(
                rawSymbols
                    .split(",")
                    .map(symbol => symbol.trim().toUpperCase())
                    .filter(symbol => /^[A-Z0-9.\-]{1,15}$/.test(symbol))
            )
        ].slice(0, 5);

        if (!symbols.length) {
            return res.status(400).json({
                success: false,
                message: "Please provide at least one valid stock symbol."
            });
        }

        const limit = cleanLimit(req.query.limit, 6, 20);

        const toDate = new Date();
        const fromDate = new Date();

        fromDate.setUTCDate(fromDate.getUTCDate() - 3);

        const results = await Promise.all(
            symbols.map(async symbol => {
                try {
                    const data = await finnhubGet("/company-news", {
                        symbol,
                        from: formatDate(fromDate),
                        to: formatDate(toDate)
                    });

                    return (Array.isArray(data) ? data : []).map(article => ({
                        ...article,
                        requestedSymbol: symbol
                    }));
                } catch (error) {
                    console.error(
                        `[FinTack News] Failed to load ${symbol}:`,
                        error.message
                    );

                    return [];
                }
            })
        );

        const seen = new Set();

        const articles = results
            .flat()
            .sort((a, b) => (b.datetime || 0) - (a.datetime || 0))
            .filter(article => {
                const uniqueKey = article.id || article.url;

                if (!uniqueKey || seen.has(uniqueKey)) {
                    return false;
                }

                seen.add(uniqueKey);

                return article.headline && article.url;
            })
            .slice(0, limit)
            .map(article => ({
                ...normalizeArticle(article),
                symbol: article.requestedSymbol
            }));

        res.json({
            success: true,
            symbols,
            count: articles.length,
            articles
        });
    } catch (err) {
        console.error("[FinTack News] Daily news error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

module.exports = router;
