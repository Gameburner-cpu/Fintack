/* ==========================================================================
   kbIntent.js
   Detects general finance questions, and acts as the assistant's safety net.

   Two confidence tiers:
     - A matched knowledge topic scores 60, enough to beat nothing but to
       lose to a transaction command or a personal data question.
     - Everything else scores 1, so this module only answers when no other
       module claimed the message. That is what removed the old
       "I couldn't understand that" dead end.
========================================================================== */

import { findTopic } from "./financeKB.js";

/* Time-sensitive questions must go to the grounded model, not the cached KB. */
const LIVE_PATTERNS = [
    /\b(today|current|latest|now|right now|this week)\b.*\b(rate|price|nav|value|return|yield|market)\b/i,
    /\b(rate|price|nav|value|yield)\b.*\b(today|current|latest|now)\b/i,
    /\b(news|headline|announced|budget 20\d\d|union budget)\b/i,
    /\bshould i (buy|sell)\b.*\b(now|today)\b/i,
    /\bwhich (fund|stock|share) should i\b/i
];

const EDUCATIONAL_PATTERNS = [
    /\b(what is|what are|what's|explain|define|meaning of|tell me about|how does|how do|how to|why (is|should|do)|difference between|pros and cons|is it (good|better|worth)|should i)\b/i
];

class KnowledgeIntent {

    detect(aiRequest) {
        const text = String(aiRequest.message || "").trim();

        if (!text) return null;

        const isLive = LIVE_PATTERNS.some(pattern => pattern.test(text));
        const isEducational = EDUCATIONAL_PATTERNS.some(pattern => pattern.test(text));

        const match = findTopic(text);

        /* ---------------- Curated topic ---------------- */
        if (match && !isLive) {
            return {
                module: "knowledge",
                action: "EXPLAIN_TOPIC",
                confidence: isEducational ? 62 : 45,
                meta: {
                    topicId: match.topic.id,
                    score: match.score
                }
            };
        }

        /* ---------------- Needs the live model ---------------- */
        if (isLive || isEducational) {
            return {
                module: "knowledge",
                action: "ASK_MODEL",
                confidence: isLive ? 58 : 40,
                meta: { topicId: match?.topic.id || null }
            };
        }

        /* ---------------- Safety net ---------------- */
        return {
            module: "knowledge",
            action: "FALLBACK",
            confidence: 1,
            meta: {}
        };
    }
}

export default KnowledgeIntent;
