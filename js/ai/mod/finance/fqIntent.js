/* ==========================================================================
   fqIntent.js
   Detects questions about the user's own money.

   These are answered locally from the transaction store - no LLM, no
   network round trip, and the number is always exactly what the database
   says.
========================================================================== */

import { extractPeriod, extractCategory } from "../../utils/FinanceNLU.js";

const QUERY_MARKERS =
    /\b(how much|how many|what(?:'s| is| was| are)|show me|tell me|give me|what about|and)\b/i;

const METRIC_RULES = [
    {
        action: "AFFORDABILITY",
        selfEvident: true,
        pattern: /\b(can i (afford|buy)|should i buy|is it (okay|ok|safe) to (buy|spend))\b/i,
        confidence: 95
    },
    {
        action: "BUDGET_STATUS",
        selfEvident: true,
        pattern: /\bbudget\b/i,
        confidence: 88
    },
    {
        action: "FINANCIAL_HEALTH",
        selfEvident: true,
        pattern: /\b(financial health|health score|how am i doing|am i doing (well|ok|okay|good)|financial score)\b/i,
        confidence: 92
    },
    {
        action: "COMPARE_MONTHS",
        selfEvident: true,
        pattern: /\b(compare|versus|vs\.?|more than last|less than last|month over month|trend)\b/i,
        confidence: 90
    },
    {
        action: "TOP_CATEGORY",
        selfEvident: true,
        pattern: /\b(highest|biggest|most|top|largest)\b.*\b(categor|spend|expense|cost)/i,
        confidence: 92
    },
    {
        action: "CATEGORY_BREAKDOWN",
        selfEvident: true,
        pattern: /\b(category wise|categorywise|by category|breakdown|where (is|did) my money|split by|distribution)\b/i,
        confidence: 90
    },
    {
        action: "AVERAGE_DAILY",
        pattern: /\b(average|avg|per day|daily average|typical day)\b/i,
        confidence: 88
    },
    {
        action: "TOTAL_SAVINGS",
        pattern: /\b(savings?|saved|save rate|savings rate|net worth|networth)\b/i,
        confidence: 85
    },
    {
        action: "TOTAL_INCOME",
        pattern: /\b(income|earned|earnings|salary received|revenue|credited)\b/i,
        confidence: 85
    },
    {
        action: "BALANCE",
        pattern: /\b(balance|left|remaining|how much do i have|net position)\b/i,
        confidence: 84
    },
    {
        action: "TOTAL_EXPENSE",
        pattern: /\b(spend|spent|spending|expense|expenses|expenditure|outgoing|cost)\b/i,
        confidence: 85
    }
];

class FinanceQueryIntent {

    detect(aiRequest) {
        const text = String(aiRequest.message || "").trim();

        if (!text) return null;

        const period = extractPeriod(text);
        const category = extractCategory(text);

        const looksLikeQuestion =
            QUERY_MARKERS.test(text) || text.trim().endsWith("?");

        /*
            "add 500 for food" mentions spending but is a command. The
            transaction module claims those, so bail out when the sentence
            reads like an instruction rather than a question.
        */
        const looksLikeCommand =
            /\b(add|log|record|delete|remove|edit|change|update)\b/i.test(text) &&
            !looksLikeQuestion;

        if (looksLikeCommand) return null;

        for (const rule of METRIC_RULES) {
            if (!rule.pattern.test(text)) continue;

            /*
                A bare metric word with no question framing is too weak to
                claim - it is probably part of a knowledge question like
                "what is a good savings rate".

                `selfEvident` rules are exempt: "can I afford a ₹60,000
                laptop" contains no question marker and no period, but it is
                unambiguously a question about the user's own money. Without
                this exemption it fell through to the knowledge module.
            */
            if (!rule.selfEvident && !looksLikeQuestion && !period) continue;

            /* Generic finance education, not a personal data question. */
            if (
                !rule.selfEvident &&
                /\b(what is|what are|explain|define|how do|how does|tell me about)\b/i.test(text) &&
                !/\bmy\b|\bi\b/i.test(text)
            ) {
                return null;
            }

            return {
                module: "finance",
                action: rule.action,
                confidence: rule.confidence + (period ? 4 : 0),
                meta: {
                    period,
                    category: category?.category || null
                }
            };
        }

        /*
            Follow-ups such as "and last month?" carry a period but no metric.
            The manager resolves the metric from conversation memory.
        */
        if (period && looksLikeQuestion && text.length < 60) {
            return {
                module: "finance",
                action: "FOLLOW_UP",
                confidence: 70,
                meta: { period, category: category?.category || null }
            };
        }

        return null;
    }
}

export default FinanceQueryIntent;
