/* ==========================================================================
   txFormatter.js
   Renders transaction actions as chat cards.
========================================================================== */

import { formatMoney } from "../../../core/analytics.js";

/* Everything user-supplied is escaped before it reaches innerHTML. */
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return escapeHtml(value);

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

const FIELD_LABELS = {
    amount: "Amount",
    category: "Category",
    date: "Date",
    title: "Title",
    type: "Type",
    description: "Description"
};

function fieldValue(field, value) {
    if (field === "amount") return formatMoney(value);
    if (field === "date") return formatDate(value);
    return escapeHtml(value);
}

class TransactionFormatter {

    async format(result, action) {
        if (!result) {
            return { message: "I couldn't process that request.", html: "" };
        }

        if (!result.success) {
            return { message: result.message, html: "" };
        }

        switch (result.stage) {
            case "confirm":
                return this.confirmation(result);

            case "disambiguate":
                return this.disambiguation(result);

            case "done":
                return this.completed(result);

            case "cancelled":
                return { message: result.message, html: "" };

            case "list":
                return this.list(result);

            default:
                return { message: result.message || "Done.", html: "" };
        }
    }

    /* ==========================================================
                        CONFIRMATION CARD
    ========================================================== */

    confirmation(result) {
        if (result.operation === "create") {
            const draft = result.draft;

            const assumptions = (result.assumptions || [])
                .map(note => `<li>${escapeHtml(note)}</li>`)
                .join("");

            const html = `
                <div class="ai-card ai-card--confirm">
                    <div class="ai-card__header">
                        <i class="fa-solid fa-circle-question"></i>
                        <span>Confirm new ${escapeHtml(draft.type)}</span>
                    </div>

                    <div class="ai-card__amount ${draft.type === "income" ? "is-income" : "is-expense"}">
                        ${draft.type === "income" ? "+" : "-"}${formatMoney(draft.amount)}
                    </div>

                    <dl class="ai-card__rows">
                        <div><dt>Title</dt><dd>${escapeHtml(draft.title)}</dd></div>
                        <div><dt>Category</dt><dd>${escapeHtml(draft.category)}</dd></div>
                        <div><dt>Date</dt><dd>${formatDate(draft.date)}</dd></div>
                    </dl>

                    ${assumptions ? `<ul class="ai-card__notes">${assumptions}</ul>` : ""}

                    <div class="ai-card__actions">
                        <button type="button" class="ai-chip ai-chip--yes" data-ai-reply="yes">
                            Yes, save it
                        </button>
                        <button type="button" class="ai-chip ai-chip--no" data-ai-reply="no">
                            Cancel
                        </button>
                    </div>
                </div>
            `;

            return {
                message: `Ready to add ${formatMoney(draft.amount)} for ${draft.title}. Confirm?`,
                html
            };
        }

        if (result.operation === "update") {
            const original = result.original;
            const updates = result.updates;

            const rows = Object.keys(updates)
                .map(field => `
                    <div>
                        <dt>${escapeHtml(FIELD_LABELS[field] || field)}</dt>
                        <dd>
                            <span class="ai-diff__old">${fieldValue(field, original[field])}</span>
                            <i class="fa-solid fa-arrow-right"></i>
                            <span class="ai-diff__new">${fieldValue(field, updates[field])}</span>
                        </dd>
                    </div>
                `)
                .join("");

            const html = `
                <div class="ai-card ai-card--confirm">
                    <div class="ai-card__header">
                        <i class="fa-solid fa-pen-to-square"></i>
                        <span>Confirm edit</span>
                    </div>

                    <p class="ai-card__subject">
                        ${escapeHtml(original.title)} &middot; ${formatDate(original.date)}
                    </p>

                    <dl class="ai-card__rows ai-card__rows--diff">${rows}</dl>

                    <div class="ai-card__actions">
                        <button type="button" class="ai-chip ai-chip--yes" data-ai-reply="yes">
                            Yes, update it
                        </button>
                        <button type="button" class="ai-chip ai-chip--no" data-ai-reply="no">
                            Cancel
                        </button>
                    </div>
                </div>
            `;

            return {
                message: `Update "${original.title}"? Confirm to apply.`,
                html
            };
        }

        /* delete */
        const original = result.original;

        const html = `
            <div class="ai-card ai-card--danger">
                <div class="ai-card__header">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>Confirm deletion</span>
                </div>

                <div class="ai-card__amount is-expense">
                    ${formatMoney(original.amount)}
                </div>

                <dl class="ai-card__rows">
                    <div><dt>Title</dt><dd>${escapeHtml(original.title)}</dd></div>
                    <div><dt>Category</dt><dd>${escapeHtml(original.category)}</dd></div>
                    <div><dt>Date</dt><dd>${formatDate(original.date)}</dd></div>
                </dl>

                <p class="ai-card__notes">This cannot be undone.</p>

                <div class="ai-card__actions">
                    <button type="button" class="ai-chip ai-chip--danger" data-ai-reply="yes">
                        Yes, delete
                    </button>
                    <button type="button" class="ai-chip ai-chip--no" data-ai-reply="no">
                        Keep it
                    </button>
                </div>
            </div>
        `;

        return {
            message: `Delete "${original.title}" (${formatMoney(original.amount)})?`,
            html
        };
    }

    /* ==========================================================
                        DISAMBIGUATION
    ========================================================== */

    disambiguation(result) {
        const options = (result.candidates || [])
            .map(item => `
                <li>
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${formatMoney(item.amount)}</span>
                    <small>${formatDate(item.date)} &middot; ${escapeHtml(item.category)}</small>
                </li>
            `)
            .join("");

        return {
            message:
                "I found more than one transaction that fits. Tell me the exact " +
                "amount and date, or edit it from the Transactions list.",
            html: `<ul class="ai-card__list">${options}</ul>`
        };
    }

    /* ==========================================================
                        COMPLETED
    ========================================================== */

    completed(result) {
        const transaction = result.transaction || {};

        if (result.operation === "delete") {
            return {
                message: `Deleted "${transaction.title}" (${formatMoney(transaction.amount)}). Your dashboard has been updated.`,
                html: ""
            };
        }

        if (result.operation === "update") {
            const changes = Object.keys(result.updates || {})
                .map(field =>
                    `${FIELD_LABELS[field] || field} is now ${
                        field === "amount"
                            ? formatMoney(result.updates[field])
                            : result.updates[field]
                    }`
                )
                .join(", ");

            return {
                message: `Updated "${transaction.title || result.original?.title}". ${changes}. Your dashboard has been refreshed.`,
                html: ""
            };
        }

        const sign = transaction.type === "income" ? "Income" : "Expense";

        return {
            message:
                `${sign} saved: ${formatMoney(transaction.amount)} for ` +
                `${transaction.title} on ${formatDate(transaction.date)}. ` +
                "Your dashboard has been updated.",
            html: ""
        };
    }

    /* ==========================================================
                        LIST
    ========================================================== */

    list(result) {
        if (!result.transactions?.length) {
            return { message: result.message, html: "" };
        }

        const rows = result.transactions
            .map(item => `
                <li class="${item.type === "income" ? "is-income" : "is-expense"}">
                    <div>
                        <strong>${escapeHtml(item.title)}</strong>
                        <small>${formatDate(item.date)} &middot; ${escapeHtml(item.category)}</small>
                    </div>
                    <span>${item.type === "income" ? "+" : "-"}${formatMoney(item.amount)}</span>
                </li>
            `)
            .join("");

        return {
            message: result.message,
            html: `<ul class="ai-card__list ai-card__list--tx">${rows}</ul>`
        };
    }
}

export default TransactionFormatter;
