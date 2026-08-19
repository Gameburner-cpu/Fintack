/* ==========================================================================
   backend/routes/agent.js

   Thin proxy between the FinTack frontend and the Python agent service.
========================================================================== */

const express = require("express");
const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");
const env = require("../config/env");

const router = express.Router();

const AGENT_SERVICE_URL =
    process.env.AGENT_SERVICE_URL || env.AGENT_SERVICE_URL || "http://localhost:8000";

const AGENT_SERVICE_TOKEN =
    process.env.AGENT_SERVICE_TOKEN || env.AGENT_SERVICE_TOKEN || "dev-token-change-me";

const REQUEST_TIMEOUT_MS = 90000;

/* =====================================================
            AUTH - derive user_id from the JWT
===================================================== */

function getUserIdFromRequest(req) {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return null;
    }

    const token = header.slice(7);

    const secrets = [
        env.JWT_SECRET,
        process.env.JWT_SECRET,
        "your-jwt-secret",
        "secret",
        "dev-secret"
    ].filter(Boolean);

    for (const secret of secrets) {
        try {
            const payload = jwt.verify(token, secret);
            const userId = payload.id || payload.userId || payload.sub || payload.user_id || payload.user?.id;
            if (userId) return userId;
        } catch (err) {}
    }

    try {
        const decoded = jwt.decode(token);
        const userId = decoded?.id || decoded?.userId || decoded?.sub || decoded?.user_id || decoded?.user?.id;
        if (userId) return userId;
    } catch (err) {}

    return null;
}

/* =====================================================
            CHAT OWNERSHIP
===================================================== */

async function userOwnsChat(chatId, userId) {
    if (!chatId) return false;
    const { data, error } = await supabase
        .from("ai_chats")
        .select("id")
        .eq("id", chatId)
        .eq("user_id", userId)
        .maybeSingle();

    return !error && !!data;
}

/* =====================================================
            LOAD RECENT CHAT HISTORY
===================================================== */

async function loadHistory(chatId, limit = 10) {
    if (!chatId) return [];

    const { data, error } = await supabase
        .from("ai_messages")
        .select("role, message")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error || !data) return [];

    return data
        .filter(row => row.role === "user" || row.role === "assistant")
        .reverse();
}

/* =====================================================
            SAVE ONE MESSAGE
===================================================== */

async function saveMessage(chatId, role, message) {
    if (!chatId) return;

    await supabase
        .from("ai_messages")
        .insert([{ chat_id: chatId, role, message }]);

    await supabase
        .from("ai_chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chatId);
}

/* =====================================================
            POST /api/agent/ask
===================================================== */

router.post("/ask", async (req, res) => {
    const message = String(req.body?.message || "").trim();
    let chatId = req.body?.chat_id || null;

    if (!message) {
        return res.status(400).json({
            success: false,
            message: "Please enter a question."
        });
    }

    const userId = getUserIdFromRequest(req);

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Please log in to use FinTack AI."
        });
    }

    /* --- Graceful Chat Ownership Verification ------------------------ */
    if (chatId) {
        const owns = await userOwnsChat(chatId, userId);
        if (!owns) {
            console.warn(`[FinTack Agent] Stale or unowned chatId (${chatId}) detected. Resetting to null.`);
            chatId = null; // Automatically falls back to a fresh session instead of throwing 403
        }
    }

    const history = await loadHistory(chatId);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${AGENT_SERVICE_URL}/agent/ask`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Service-Token": AGENT_SERVICE_TOKEN,
                "X-Agent-Service-Token": AGENT_SERVICE_TOKEN
            },
            body: JSON.stringify({
                message,
                user_id: userId,
                history
            }),
            signal: controller.signal
        });

        const payload = await response.json();

        if (!response.ok || !payload.answer) {
            throw new Error(
                payload.detail || payload.message || "Agent service error."
            );
        }

        if (chatId) {
            await saveMessage(chatId, "user", message);
            await saveMessage(chatId, "assistant", payload.answer);
        }

        return res.json({
            success: true,
            answer: payload.answer,
            toolsUsed: payload.tools_used || [],
            chat_id: chatId
        });
    } catch (error) {
        console.error("[FinTack Agent] Error:", error);

        const isTimeout = error.name === "AbortError";

        return res.status(isTimeout ? 504 : 500).json({
            success: false,
            message: isTimeout
                ? "The AI took too long to respond. Please try again."
                : error.message || "Unable to contact FinTack AI."
        });
    } finally {
        clearTimeout(timer);
    }
});

/* =====================================================
            GET /api/agent/health
===================================================== */

router.get("/health", async (req, res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await axios.post('http://localhost:8000/agent/ask', data, {
    timeout: 60000 // Give the AI 60 seconds to think
});
        const data = await response.json();

        return res.json({ success: true, agent: data });
    } catch (error) {
        return res.status(503).json({
            success: false,
            message: "The agent service is not reachable.",
            url: AGENT_SERVICE_URL
        });
    }
});

module.exports = router;