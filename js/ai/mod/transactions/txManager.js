/* ==========================================================================
   txManager.js
   Executes transaction actions requested through the chatbot.

   Every write is a two-step handshake: the manager proposes, the user
   confirms, only then does it touch the API.
========================================================================== */

import Store from "./txStore.js";
import Pending from "./txPending.js";
import { getCurrentUser } from "../../../core/config.js";
import { formatMoney } from "../../../core/analytics.js";

const MAX_AMOUNT = 100000000;

class TransactionManager {

    async execute(action, aiRequest) {
        const user = getCurrentUser();

        if (!user?.id && action.action !== "CANCEL") {
            return {
                success: false,
                message: "Please log in first so I can access your transactions."
            };
        }

        switch (action.action) {
            case "ADD_TRANSACTION":
                return this.proposeAdd(action, aiRequest);

            case "EDIT_TRANSACTION":
                return this.proposeEdit(action, aiRequest);

            case "DELETE_TRANSACTION":
                return this.proposeDelete(action, aiRequest);

            case "CONFIRM":
                return this.confirm();

            case "CANCEL":
                return this.cancel();

            case "LIST_TRANSACTIONS":
                return this.list(action);

            default:
                return {
                    success: false,
                    message: `I don't know how to handle "${action.action}".`
                };
        }
    }

    /* ==========================================================
                        PROPOSE: ADD
    ========================================================== */

    async proposeAdd(action) {
        const parsed = action.data?.entities || {};

        if (!parsed.amount) {
            return {
                success: false,
                needsInput: "amount",
                message:
                    "How much was it? For example: \"Add ₹500 spent on food today\"."
            };
        }

        if (parsed.amount > MAX_AMOUNT) {
            return {
                success: false,
                message:
                    `${formatMoney(parsed.amount)} looks like a typo. ` +
                    "Please re-enter the amount."
            };
        }

        const today = new Date().toISOString().slice(0, 10);

        const draft = {
            title: parsed.title || parsed.category || "Transaction",
            amount: parsed.amount,
            type: parsed.type || "expense",
            category: parsed.category || "Other",
            date: parsed.date || today
        };

        Pending.set({
            type: "create",
            draft,
            summary: describeDraft(draft, parsed)
        });

        return {
            success: true,
            stage: "confirm",
            operation: "create",
            draft,
            assumptions: buildAssumptions(parsed),
            message: "Please confirm this transaction."
        };
    }

    /* ==========================================================
                        PROPOSE: EDIT
    ========================================================== */

    async proposeEdit(action) {
        const parsed = action.data?.entities || {};
        const target = parsed.target || {};
        const updates = parsed.updates || {};

        const hasUpdate = Object.values(updates).some(
            value => value !== null && value !== undefined
        );

        if (!hasUpdate) {
            return {
                success: false,
                message:
                    "What should I change it to? For example: " +
                    "\"Change yesterday's food expense from ₹500 to ₹700\"."
            };
        }

        const matches = await Store.find({
            amount: target.amount,
            date: target.date,
            category: target.category,
            type: target.type,
            keyword: target.keyword,
            strictCategory: Boolean(target.category && target.amount == null)
        });

        if (!matches.length) {
            return {
                success: false,
                message: buildNotFoundMessage(target)
            };
        }

        /* Ambiguous: let the user pick rather than guessing. */
        if (matches.length > 1 && !target.last && isAmbiguous(matches)) {
            return {
                success: true,
                stage: "disambiguate",
                operation: "update",
                candidates: matches.slice(0, 5),
                updates,
                message: "I found more than one match. Which one did you mean?"
            };
        }

        const transaction = matches[0];

        const cleanUpdates = {};

        if (updates.amount != null) cleanUpdates.amount = updates.amount;
        if (updates.category) cleanUpdates.category = updates.category;
        if (updates.title) cleanUpdates.title = updates.title;
        if (updates.date) cleanUpdates.date = updates.date;
        if (updates.type) cleanUpdates.type = updates.type;

        /* Nothing actually differs - say so instead of writing a no-op. */
        const changed = Object.keys(cleanUpdates).filter(
            key => String(transaction[key]) !== String(cleanUpdates[key])
        );

        if (!changed.length) {
            return {
                success: false,
                message:
                    `That transaction already matches those values ` +
                    `(${transaction.title}, ${formatMoney(transaction.amount)}).`
            };
        }

        Pending.set({
            type: "update",
            id: transaction.id,
            original: transaction,
            updates: cleanUpdates
        });

        return {
            success: true,
            stage: "confirm",
            operation: "update",
            original: transaction,
            updates: cleanUpdates,
            changedFields: changed,
            message: "Please confirm this change."
        };
    }

    /* ==========================================================
                        PROPOSE: DELETE
    ========================================================== */

    async proposeDelete(action) {
        const parsed = action.data?.entities || {};
        const target = parsed.target || {};

        const matches = await Store.find({
            amount: target.amount,
            date: target.date,
            category: target.category,
            type: target.type,
            keyword: target.keyword
        });

        if (!matches.length) {
            return {
                success: false,
                message: buildNotFoundMessage(target)
            };
        }

        const transaction = matches[0];

        Pending.set({
            type: "delete",
            id: transaction.id,
            original: transaction
        });

        return {
            success: true,
            stage: "confirm",
            operation: "delete",
            original: transaction,
            message: "Please confirm the deletion."
        };
    }

    /* ==========================================================
                        CONFIRM
    ========================================================== */

    async confirm() {
        const pending = Pending.get();

        if (!pending) {
            return {
                success: false,
                message:
                    "There's nothing waiting for confirmation. " +
                    "Tell me what you'd like to add or change."
            };
        }

        Pending.clear();

        try {
            if (pending.type === "create") {
                const result = await Store.create(pending.draft);

                return {
                    success: Boolean(result?.success),
                    stage: "done",
                    operation: "create",
                    transaction: result?.transaction || pending.draft,
                    message: result?.success
                        ? "Transaction saved."
                        : result?.message || "I couldn't save that transaction."
                };
            }

            if (pending.type === "update") {
                const result = await Store.update(pending.id, pending.updates);

                return {
                    success: Boolean(result?.success),
                    stage: "done",
                    operation: "update",
                    transaction: result?.transaction,
                    original: pending.original,
                    updates: pending.updates,
                    message: result?.success
                        ? "Transaction updated."
                        : result?.message || "I couldn't update that transaction."
                };
            }

            if (pending.type === "delete") {
                const result = await Store.remove(pending.id);

                return {
                    success: Boolean(result?.success),
                    stage: "done",
                    operation: "delete",
                    transaction: pending.original,
                    message: result?.success
                        ? "Transaction deleted."
                        : result?.message || "I couldn't delete that transaction."
                };
            }

            return {
                success: false,
                message: "That action is no longer valid. Please try again."
            };
        } catch (error) {
            console.error("[TransactionManager] Execution failed:", error);

            return {
                success: false,
                message:
                    "Something went wrong while saving. Your data has not been changed."
            };
        }
    }

    /* ==========================================================
                        CANCEL
    ========================================================== */

    async cancel() {
        const had = Pending.has();
        Pending.clear();

        return {
            success: true,
            stage: "cancelled",
            message: had
                ? "Cancelled. Nothing was changed."
                : "There was nothing pending, but nothing has changed."
        };
    }

    /* ==========================================================
                        LIST
    ========================================================== */

    async list(action) {
        const transactions = await Store.all();

        const parsed = action.data?.entities || {};
        const limit = 5;

        const filtered = parsed.category
            ? transactions.filter(
                item =>
                    String(item.category).toLowerCase() ===
                    String(parsed.category).toLowerCase()
            )
            : transactions;

        return {
            success: true,
            stage: "list",
            operation: "list",
            transactions: filtered.slice(0, limit),
            total: filtered.length,
            message: filtered.length
                ? `Your ${Math.min(limit, filtered.length)} most recent transactions.`
                : "You don't have any transactions yet."
        };
    }
}

/* ==========================================================
                        HELPERS
========================================================== */

function isAmbiguous(matches) {
    /* Two candidates with near-identical scores means we genuinely cannot tell. */
    if (matches.length < 2) return false;

    const [first, second] = matches;

    return (
        Number(first.amount) !== Number(second.amount) ||
        String(first.date).slice(0, 10) !== String(second.date).slice(0, 10)
    );
}

function describeDraft(draft, parsed) {
    const verb = draft.type === "income" ? "received" : "spent";

    return (
        `${formatMoney(draft.amount)} ${verb} on ${draft.category.toLowerCase()} ` +
        `(${parsed.dateLabel || draft.date})`
    );
}

/*
    Surfaces what the parser had to guess, so a wrong assumption is visible
    before it is saved rather than discovered in the dashboard later.
*/
function buildAssumptions(parsed) {
    const notes = [];

    if (!parsed.typeExplicit) {
        notes.push("Assumed this is an expense.");
    }

    if (!parsed.categoryExplicit) {
        notes.push("Couldn't match a category, using \"Other\".");
    }

    if (!parsed.date) {
        notes.push("No date mentioned, using today.");
    }

    return notes;
}

function buildNotFoundMessage(target) {
    const parts = [];

    if (target.amount) parts.push(formatMoney(target.amount));
    if (target.category) parts.push(target.category.toLowerCase());
    if (target.dateLabel) parts.push(target.dateLabel);

    if (!parts.length) {
        return "I couldn't work out which transaction you meant. Try naming the amount and date.";
    }

    return (
        `I couldn't find a transaction matching ${parts.join(", ")}. ` +
        "Check the amount and date, or open the Transactions list to edit it directly."
    );
}

export default TransactionManager;
