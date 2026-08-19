/* ==========================================================================
   goalIntent.js
   Detects goal and investment planning questions.
========================================================================== */

const PLAN_PATTERNS = [
    /\b(invest|investment|investing|portfolio|allocation|asset allocation)\b/i,
    /\b(where should i (put|invest)|how should i invest|what should i invest in)\b/i,
    /\b(sip|mutual fund|index fund|etf)\b.*\b(goal|target|plan|reach)\b/i,
    /\b(plan|planning|roadmap|strategy)\b.*\b(goal|target|corpus)\b/i,
    /\bhow (much|do i need to) (should i )?(save|invest)\b/i,
    /\b(reach|achieve|hit)\b.*\b(goal|target)\b/i
];

const STATUS_PATTERNS = [
    /\b(my goals?|goal progress|how are my goals|goal status|am i on track)\b/i
];

class GoalIntent {

    detect(aiRequest) {
        const text = String(aiRequest.message || "").trim();

        if (!text) return null;

        /* Commands belong to the transaction module. */
        if (/^\s*(add|log|record|delete|remove)\b/i.test(text) &&
            !/\bgoal\b/i.test(text)) {
            return null;
        }

        if (STATUS_PATTERNS.some(pattern => pattern.test(text))) {
            return {
                module: "goals",
                action: "GOAL_STATUS",
                confidence: 88
            };
        }

        if (PLAN_PATTERNS.some(pattern => pattern.test(text))) {
            /*
                A generic "what is a mutual fund" is education, not planning.
                Planning requires a goal reference or a first-person framing.
            */
            const isPersonal =
                /\b(my|i|me|our)\b/i.test(text) || /\bgoal\b/i.test(text);

            if (!isPersonal) return null;

            const isDefinition =
                /\b(what is|what are|explain|define|meaning of|difference between)\b/i
                    .test(text);

            if (isDefinition) return null;

            return {
                module: "goals",
                action: "INVESTMENT_PLAN",
                confidence: 86
            };
        }

        return null;
    }
}

export default GoalIntent;
