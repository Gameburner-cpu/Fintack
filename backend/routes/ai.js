const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

/* =====================================================
                GEMINI CLIENT
===================================================== */

let geminiClient = null;

async function getGeminiClient() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error(
            "GEMINI_API_KEY is missing. Add it to backend/.env and restart the backend."
        );
    }

    if (!geminiClient) {
        const { GoogleGenAI } = await import("@google/genai");

        geminiClient = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
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

        if (!web?.uri || seen.has(web.uri)) {
            continue;
        }

        seen.add(web.uri);

        sources.push({
            title: web.title || "Web source",
            url: web.uri
        });
    }

    return sources;
}

/* =====================================================
                ASK FINTACK AI
===================================================== */

/*
    POST /api/ai/ask

    Body:
    {
        "message": "What is the latest news about Tata Motors?"
    }

    Google Search grounding is enabled so Gemini can search
    current web information when the question requires it.
*/

router.post("/ask", async (req, res) => {
    try {
        const message = String(req.body?.message || "").trim();

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Please enter a question."
            });
        }

        const ai = await getGeminiClient();

        const prompt = `
You are FinTack AI, the financial assistant inside the FinTack personal finance application.

User question:
${message}

Instructions:
- Give a clear, concise and useful answer.
- For current news, markets, companies, stocks, economic events or other time-sensitive information, use Google Search grounding.
- Do not invent current prices, headlines, dates, events or statistics.
- Clearly distinguish factual information from general financial education.
- Do not promise investment returns or present speculation as certainty.
- If discussing financial news, explain why the development may matter.
- Use Indian rupees (₹) when discussing the FinTack user's personal finances unless the user specifies another currency.
- Do not claim access to the user's FinTack account data unless that data was explicitly provided in the request.
- Format the answer so it is easy to display inside a mobile chat interface.
`;

        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt,
            config: {
                tools: [
                    {
                        googleSearch: {}
                    }
                ]
            }
        });

        const answer = response?.text?.trim();

        if (!answer) {
            throw new Error("Gemini returned an empty response.");
        }

        const groundingMetadata =
            response?.candidates?.[0]?.groundingMetadata || null;

        const sources = getGroundingSources(response);

        return res.json({
            success: true,
            answer,
            sources,
            searchQueries: groundingMetadata?.webSearchQueries || []
        });
    }

    catch (err) {
        console.error("[FinTack AI] Ask error:", err);

        return res.status(500).json({
            success: false,
            message: err?.message || "Unable to contact FinTack AI."
        });
    }
});

/* =====================================================
                CREATE NEW CHAT
===================================================== */

router.post("/chats", async (req, res) => {
    try {
        const {
            user_id,
            title
        } = req.body;

        const { data, error } = await supabase
            .from("ai_chats")
            .insert([
                {
                    user_id,
                    title: title || "New Chat"
                }
            ])
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            chat: data
        });
    }

    catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =====================================================
                GET ALL CHATS
===================================================== */

router.get("/chats", async (req, res) => {
    try {
        const { user_id } = req.query;

        const { data, error } = await supabase
            .from("ai_chats")
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", {
                ascending: false
            });

        if (error) throw error;

        res.json({
            success: true,
            chats: data
        });
    }

    catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =====================================================
                LOAD CHAT
===================================================== */

router.get("/chats/:id/messages", async (req, res) => {
    try {
        const chatId = req.params.id;

        const { data, error } = await supabase
            .from("ai_messages")
            .select("*")
            .eq("chat_id", chatId)
            .order("created_at");

        if (error) throw error;

        res.json({
            success: true,
            messages: data
        });
    }

    catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =====================================================
                SAVE MESSAGE
===================================================== */

router.post("/chats/:id/messages", async (req, res) => {
    try {
        const chatId = req.params.id;

        const {
            role,
            message
        } = req.body;

        const { data, error } = await supabase
            .from("ai_messages")
            .insert([
                {
                    chat_id: chatId,
                    role,
                    message
                }
            ])
            .select()
            .single();

        if (error) {
            console.error("Insert Error:", error);
            throw error;
        }

        const { error: updateError } = await supabase
            .from("ai_chats")
            .update({
                updated_at: new Date().toISOString()
            })
            .eq("id", chatId);

        if (updateError) {
            console.error("Update Error:", updateError);
            throw updateError;
        }

        res.json({
            success: true,
            savedMessage: data
        });
    }

    catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =====================================================
                DELETE CHAT
===================================================== */

router.delete("/chats/:id", async (req, res) => {
    try {
        const chatId = req.params.id;

        // Delete all messages first
        const { error: messageError } = await supabase
            .from("ai_messages")
            .delete()
            .eq("chat_id", chatId);

        if (messageError) throw messageError;

        // Delete the chat
        const { error: chatError } = await supabase
            .from("ai_chats")
            .delete()
            .eq("id", chatId);

        if (chatError) throw chatError;

        res.json({
            success: true
        });
    }

    catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

module.exports = router;
