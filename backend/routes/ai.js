/* ==========================================================================
   ai.js
   FinTack AI backend: Gemini-backed Q&A + chat persistence.

   The client resolves transaction commands and personal financial queries
   locally (js/ai/mod/*), so this endpoint only sees the questions that
   need real language understanding or live web grounding.
========================================================================== */

const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");
const env = require("../config/env");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const { buildSummary } = require("../utils/analytics");
const { sanitizeText } = require("../utils/validators");

/* =====================================================
                GEMINI CLIENT
===================================================== */

let geminiClient = null;

async function getGeminiClient() {
    if (!env.GEMINI_API_KEY) {
        const error = new Error(
            "The AI assistant is not configured on this server. " +
            "Add GEMINI_API_KEY to backend/.env and restart."
        );
        error.status = 503;
        throw error;
    }

    if (!geminiClient) {
        const { GoogleGenAI } = await import("@google/genai");

        geminiClient = new GoogleGenAI({
            apiKey: env.GEMINI_API_KEY
        });
    }

    return geminiClient;
}

/* =====================================================
                HELPERS
===================================================== */

function getGroundingSources(response) {
    const chunks =
        response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const seen = new Set();
    const sources = [];

    for (const chunk of chunks) {
        const web = chunk?.web;

        if (!web?.uri || seen.has(web.uri)) continue;

        seen.add(web.uri);

        sources.push({
            title: web.title || "Web source",
            url: web.uri
        });
    }

    return sources;
}

const money = value =>
    `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;

/*
    Builds a compact financial brief for the authenticated user so the model
    can answer "can I afford X" style questions with real numbers instead of
    inventing them. Only aggregates are sent - never raw transaction rows.
*/
async function buildUserContext(userId) {
    if (!userId) return null;

    try {
        const [{ data: transactions }, { data: goals }] = await Promise.all([
            supabase
                .from("transactions")
                .select("amount, type, category, date")
                .eq("user_id", userId)
                .order("date", { ascending: false })
                .limit(5000),

            supabase
                .from("goals")
                .select("title, target_amount, saved_amount, deadline")
                .eq("user_id", userId)
        ]);

        if (!transactions?.length && !goals?.length) return null;

        const summary = buildSummary(transactions || []);

        const topCategories = summary.categories
            .slice(0, 5)
            .map(item => `${item.category} ${money(item.amount)} (${item.percentage}%)`)
            .join(", ");

        const goalLines = (goals || [])
            .slice(0, 5)
            .map(goal =>
                `- ${goal.title}: ${money(goal.saved_amount)} saved of ` +
                `${money(goal.target_amount)} by ${goal.deadline}`
            )
            .join("\n");

        return [
            "USER FINANCIAL SNAPSHOT (all figures in INR, derived from their own records):",
            `- This month income: ${money(summary.monthlyIncome)}`,
            `- This month expenses: ${money(summary.monthlyExpense)}`,
            `- This month savings: ${money(summary.monthlySavings)} (${summary.savingsRate}% savings rate)`,
            `- Last month expenses: ${money(summary.lastMonthExpense)}`,
            `- This year expenses: ${money(summary.yearExpense)}`,
            `- All-time balance: ${money(summary.balance)}`,
            `- Average daily spend this month: ${money(summary.averageDailyExpenseThisMonth)}`,
            topCategories ? `- Top spending categories: ${topCategories}` : "",
            goalLines ? `Active goals:\n${goalLines}` : ""
        ].filter(Boolean).join("\n");
    } catch (err) {
        console.error("[FinTack AI] Context build failed:", err.message);
        return null;
    }
}

const SYSTEM_PROMPT = `
You are FinTack AI, the financial assistant inside the FinTack personal finance app.
The user is Indian; default to Indian rupees (₹), Indian instruments (SIP, ELSS, PPF,
NPS, SGB, FD, index funds) and Indian tax rules unless told otherwise.

How to answer:
- Be concise and concrete. Short paragraphs and simple bullet lists render best in a
  narrow mobile chat. Never use markdown tables.
- Explain concepts in plain language first, jargon second.
- Separate FACT from EDUCATION from OPINION. Label suggestions as general education,
  not personalised advice, and recommend a SEBI-registered adviser for anything
  material.
- Never promise or imply guaranteed returns. Quote historical ranges and say they are
  historical. Always mention the relevant risk when naming an instrument.
- For anything time sensitive - prices, rates, headlines, scheme rules, tax slabs -
  use Google Search grounding rather than memory, and say when a figure was last
  verified. Do not invent numbers.
- If a financial snapshot is supplied below, use those figures directly and reference
  them. If it is absent, say you cannot see their data rather than guessing.
- If the question is not about finance, answer briefly and steer back to money topics.
`.trim();

/* =====================================================
                ASK FINTACK AI

   POST /api/ai/ask
   Body: { message, history?: [{role, content}], includeContext?: boolean }

   Auth is optional; sending a token unlocks personalised answers.
===================================================== */

router.post(
    "/ask",
    optionalAuth,
    rateLimit({ windowMs: 60 * 1000, max: 20, key: "ai-ask", byEmail: false }),
    async (req, res, next) => {
        try {
            const message = sanitizeText(req.body?.message, 2000);

            if (!message) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a question."
                });
            }

            const ai = await getGeminiClient();

            /* Last few turns keep follow-up questions coherent. */
            const history = Array.isArray(req.body?.history)
                ? req.body.history
                    .slice(-6)
                    .map(turn => {
                        const role = turn?.role === "assistant" ? "FinTack AI" : "User";
                        const content = sanitizeText(
                            turn?.content ?? turn?.message,
                            800
                        );
                        return content ? `${role}: ${content}` : "";
                    })
                    .filter(Boolean)
                    .join("\n")
                : "";

            const context = req.body?.includeContext === false
                ? null
                : await buildUserContext(req.user?.id);

            const prompt = [
                SYSTEM_PROMPT,
                context ? `\n${context}` : "\n(No account data available for this user.)",
                history ? `\nRecent conversation:\n${history}` : "",
                `\nUser question:\n${message}`
            ].join("\n");

            const response = await ai.models.generateContent({
                model: env.GEMINI_MODEL,
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }]
                }
            });

            const answer = response?.text?.trim();

            if (!answer) {
                const error = new Error(
                    "The AI assistant returned an empty response. Please try rephrasing."
                );
                error.status = 502;
                throw error;
            }

            const groundingMetadata =
                response?.candidates?.[0]?.groundingMetadata || null;

            return res.json({
                success: true,
                answer,
                personalised: Boolean(context),
                sources: getGroundingSources(response),
                searchQueries: groundingMetadata?.webSearchQueries || []
            });
        } catch (err) {
            return next(err);
        }
    }
);

/* =====================================================
                CHAT PERSISTENCE

   All chat routes are now authenticated and ownership
   checked - previously any user id could read or delete
   any other user's conversations.
===================================================== */

router.use(requireAuth);

async function assertChatOwnership(chatId, userId) {
    const { data, error } = await supabase
        .from("ai_chats")
        .select("id, user_id")
        .eq("id", chatId)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        const notFound = new Error("Chat not found.");
        notFound.status = 404;
        throw notFound;
    }

    if (String(data.user_id) !== String(userId)) {
        const forbidden = new Error("You do not have access to this chat.");
        forbidden.status = 403;
        throw forbidden;
    }

    return data;
}

/* ---------------- CREATE CHAT ---------------- */

router.post("/chats", async (req, res, next) => {
    try {
        const title = sanitizeText(req.body?.title, 80) || "New Chat";

        const { data, error } = await supabase
            .from("ai_chats")
            .insert([{ user_id: req.user.id, title }])
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            chat: data
        });
    } catch (err) {
        return next(err);
    }
});

/* ---------------- LIST CHATS ---------------- */

router.get("/chats", async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from("ai_chats")
            .select("*")
            .eq("user_id", req.user.id)
            .order("updated_at", { ascending: false })
            .limit(100);

        if (error) throw error;

        return res.json({
            success: true,
            chats: data || []
        });
    } catch (err) {
        return next(err);
    }
});

/* ---------------- LOAD MESSAGES ---------------- */

router.get("/chats/:id/messages", async (req, res, next) => {
    try {
        await assertChatOwnership(req.params.id, req.user.id);

        const { data, error } = await supabase
            .from("ai_messages")
            .select("*")
            .eq("chat_id", req.params.id)
            .order("created_at");

        if (error) throw error;

        return res.json({
            success: true,
            messages: data || []
        });
    } catch (err) {
        return next(err);
    }
});

/* ---------------- SAVE MESSAGE ---------------- */

router.post("/chats/:id/messages", async (req, res, next) => {
    try {
        await assertChatOwnership(req.params.id, req.user.id);

        const role = req.body?.role === "assistant" ? "assistant" : "user";
        const message = String(req.body?.message || "").slice(0, 20000);

        if (!message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Message content is required."
            });
        }

        const { data, error } = await supabase
            .from("ai_messages")
            .insert([{ chat_id: req.params.id, role, message }])
            .select()
            .single();

        if (error) throw error;

        await supabase
            .from("ai_chats")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", req.params.id);

        return res.status(201).json({
            success: true,
            savedMessage: data
        });
    } catch (err) {
        return next(err);
    }
});

/* ---------------- DELETE CHAT ---------------- */

router.delete("/chats/:id", async (req, res, next) => {
    try {
        await assertChatOwnership(req.params.id, req.user.id);

        const { error: messageError } = await supabase
            .from("ai_messages")
            .delete()
            .eq("chat_id", req.params.id);

        if (messageError) throw messageError;

        const { error: chatError } = await supabase
            .from("ai_chats")
            .delete()
            .eq("id", req.params.id)
            .eq("user_id", req.user.id);

        if (chatError) throw chatError;

        return res.json({ success: true });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;
