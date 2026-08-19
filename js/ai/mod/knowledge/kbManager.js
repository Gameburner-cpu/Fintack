/* ==========================================================================
   kbManager.js
   Answers general finance questions from the curated knowledge base, and
   falls back to the Gemini-backed API for anything it does not cover.
========================================================================== */

import { TOPICS, findTopic } from "./financeKB.js";
import { askAI } from "../../../core/api.js";

/* Last few turns, so the model can resolve "what about for a 5 year goal?" */
const history = [];
const MAX_HISTORY = 6;

function remember(role, content) {
    history.push({ role, content: String(content).slice(0, 800) });

    while (history.length > MAX_HISTORY) history.shift();
}

export function resetKnowledgeHistory() {
    history.length = 0;
}

class KnowledgeManager {

    async execute(action, aiRequest) {
        const message = String(aiRequest.message || "");
        const meta = action.data?.meta || {};

        remember("user", message);

        switch (action.action) {
            case "EXPLAIN_TOPIC":
                return this.explain(meta.topicId, message);

            case "ASK_MODEL":
                return this.ask(message, meta);

            case "FALLBACK":
            default:
                return this.fallback(message);
        }
    }

    /* ==========================================================
                        CURATED ANSWER
    ========================================================== */

    async explain(topicId, message) {
        const topic =
            TOPICS.find(item => item.id === topicId) ||
            findTopic(message)?.topic;

        if (!topic) return this.ask(message, {});

        /*
            Tax rules and rates change. For those topics the curated answer
            is served, but the live model is asked to add anything current.
        */
        if (topic.volatile) {
            const live = await this.tryModel(
                `${message}\n\n(Answer briefly. Flag anything that has changed recently.)`
            );

            if (live?.success) {
                return {
                    success: true,
                    kind: "topic",
                    topic,
                    supplement: live.answer,
                    sources: live.sources || []
                };
            }
        }

        remember("assistant", topic.summary);

        return {
            success: true,
            kind: "topic",
            topic
        };
    }

    /* ==========================================================
                        MODEL ANSWER
    ========================================================== */

    async ask(message, meta) {
        const result = await this.tryModel(message);

        if (result?.success) {
            remember("assistant", result.answer);

            return {
                success: true,
                kind: "model",
                answer: result.answer,
                sources: result.sources || [],
                personalised: result.personalised
            };
        }

        /* Model unavailable - fall back to the closest curated topic. */
        const match = meta.topicId
            ? TOPICS.find(item => item.id === meta.topicId)
            : findTopic(message)?.topic;

        if (match) {
            return {
                success: true,
                kind: "topic",
                topic: match,
                degraded: true
            };
        }

        return {
            success: false,
            kind: "unavailable",
            message:
                result?.message ||
                "I can't reach the AI service right now. I can still answer questions " +
                "about your own spending, budgets and goals - try \"how much did I " +
                "spend this month?\""
        };
    }

    async tryModel(message) {
        try {
            const response = await askAI(message, history.slice(0, -1));

            if (response?.success && response.answer) return response;

            return {
                success: false,
                message: response?.message
            };
        } catch (error) {
            console.error("[KnowledgeManager] Model call failed:", error);
            return { success: false };
        }
    }

    /* ==========================================================
                        FALLBACK
    ========================================================== */

    async fallback(message) {
        /*
            Anything unclaimed still goes to the model first - a greeting or
            an oddly phrased question gets a real reply rather than a menu.
        */
        const result = await this.tryModel(message);

        if (result?.success) {
            remember("assistant", result.answer);

            return {
                success: true,
                kind: "model",
                answer: result.answer,
                sources: result.sources || []
            };
        }

        return {
            success: true,
            kind: "capabilities"
        };
    }
}

export default KnowledgeManager;
