/* ==========================================================================
   txIntent.js
   Detects transaction management commands.
========================================================================== */

import { detectConfirmation, extractAmounts } from "../../utils/FinanceNLU.js";
import Pending from "./txPending.js";

const ADD_PATTERNS = [
    /\badd\b.*\b(expense|income|transaction|spent|spend|paid|received|earned)\b/i,
    /\b(add|log|record|note|track|enter|save)\b/i,
    /\b(i\s+)?(spent|paid|bought|purchased|received|earned|got paid)\b/i,
    /\b(expense|income)\s+of\b/i
];

const EDIT_PATTERNS = [
    /\b(edit|change|update|modify|correct|fix|amend|revise|rename)\b/i,
    /\bmake\s+(it|that|the)\b/i,
    /\bshould\s+(be|have been)\b/i,
    /\bwas\s+actually\b/i
];

const DELETE_PATTERNS = [
    /\b(delete|remove|erase|undo|cancel)\s+(the\s+|my\s+|that\s+|this\s+)?(last\s+|latest\s+|recent\s+)?(transaction|expense|income|entry|record)\b/i,
    /\bdelete\s+(the\s+)?(₹|rs\.?)?\s*\d/i
];

const LIST_PATTERNS = [
    /\b(show|list|display|view|see|what are)\b.*\b(transactions?|expenses?|spending|entries|purchases)\b/i,
    /\b(recent|latest|last)\s+(transactions?|expenses?|entries)\b/i
];

/* Questions are the finance module's job, not this one's. */
const QUESTION_PATTERNS = [
    /\bhow much\b/i,
    /\bhow many\b/i,
    /\bwhat('s| is| was)\s+my\b/i,
    /\btotal\b.*\?/i,
    /\bcompare\b/i,
    /\baverage\b/i
];

class TransactionIntent {

    detect(aiRequest) {
        const text = String(aiRequest.message || "").trim();

        if (!text) return null;

        /* ==========================================================
                        CONFIRMATION OF A PENDING ACTION

           Highest priority: while a proposal is open, "yes" means
           yes to that proposal and nothing else.
        ========================================================== */

        if (Pending.has()) {
            const answer = detectConfirmation(text);

            if (answer === "yes") {
                return {
                    module: "transactions",
                    action: "CONFIRM",
                    confidence: 100
                };
            }

            if (answer === "no") {
                return {
                    module: "transactions",
                    action: "CANCEL",
                    confidence: 100
                };
            }
        }

        /* Questions go to the finance analytics module. */
        if (QUESTION_PATTERNS.some(pattern => pattern.test(text))) {
            return null;
        }

        const hasAmount = extractAmounts(text).length > 0;

        /* ==========================================================
                            DELETE
        ========================================================== */

        if (DELETE_PATTERNS.some(pattern => pattern.test(text))) {
            return {
                module: "transactions",
                action: "DELETE_TRANSACTION",
                confidence: 92
            };
        }

        /* ==========================================================
                            EDIT
        ========================================================== */

        if (EDIT_PATTERNS.some(pattern => pattern.test(text))) {
            const mentionsRecord =
                /\b(transaction|expense|income|entry|amount|category|record|spending|payment)\b/i
                    .test(text);

            if (mentionsRecord || hasAmount) {
                return {
                    module: "transactions",
                    action: "EDIT_TRANSACTION",
                    confidence: hasAmount ? 94 : 80
                };
            }
        }

        /* ==========================================================
                            LIST
        ========================================================== */

        if (LIST_PATTERNS.some(pattern => pattern.test(text))) {
            return {
                module: "transactions",
                action: "LIST_TRANSACTIONS",
                confidence: 78
            };
        }

        /* ==========================================================
                            ADD

           Requires an amount. "add a goal" or "add members" must not
           be swallowed by the transaction module.
        ========================================================== */

        if (hasAmount && ADD_PATTERNS.some(pattern => pattern.test(text))) {
            const isTripCommand =
                /\btrip\b|\bpaid for\b.*\bgroup\b|\bsplit\b/i.test(text);

            if (isTripCommand) return null;

            return {
                module: "transactions",
                action: "ADD_TRANSACTION",
                confidence: 90
            };
        }

        return null;
    }
}

export default TransactionIntent;
