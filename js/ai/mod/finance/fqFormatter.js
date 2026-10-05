/* ==========================================================================
   fqFormatter.js
   Renders financial answers as compact chat cards.
========================================================================== */

import { formatMoney } from "../../../core/analytics.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function rowsHtml(rows = []) {
    if (!rows.length) return "";

    return `
        <dl class="ai-card__rows">
            ${rows
                .map(
                    ([label, value]) => `
                        <div>
                            <dt>${escapeHtml(label)}</dt>
                            <dd>${escapeHtml(value)}</dd>
                        </div>
                    `
                )
                .join("")}
        </dl>
    `;
}

function barsHtml(categories = []) {
    if (!categories.length) return "";

    return `
        <ul class="ai-bars">
            ${categories
                .map(
                    item => `
                        <li>
                            <span class="ai-bars__label">${escapeHtml(item.category)}</span>
                            <span class="ai-bars__track">
                                <span class="ai-bars__fill" style="width:${Math.max(2, Math.min(100, item.percentage))}%"></span>
                            </span>
                            <span class="ai-bars__value">${formatMoney(item.amount)}</span>
                        </li>
                    `
                )
                .join("")}
        </ul>
    `;
}

class FinanceQueryFormatter {

    async format(result) {
        if (!result) {
            return { message: "I couldn't work that out.", html: "" };
        }

        if (!result.success || result.empty || result.kind === "text") {
            return { message: result.message, html: "" };
        }

        switch (result.kind) {
            case "metric":
                return this.metric(result);

            case "breakdown":
                return this.breakdown(result);

            case "comparison":
                return this.comparison(result);

            case "budget":
                return this.budget(result);

            case "health":
                return this.health(result);

            case "affordability":
                return this.affordability(result);

            default:
                return { message: result.detail || "Done.", html: "" };
        }
    }

    metric(result) {
        const html = `
            <div class="ai-card ai-card--metric">
                <div class="ai-card__header">
                    <span>${escapeHtml(result.title)}</span>
                </div>

                <div class="ai-card__value">${formatMoney(result.value)}</div>

                ${result.subtitle ? `<p class="ai-card__subject">${escapeHtml(result.subtitle)}</p>` : ""}

                ${rowsHtml(result.rows)}
                ${barsHtml(result.categories)}
            </div>
        `;

        return {
            message: `${result.title}: ${formatMoney(result.value)}. ${result.detail || ""}`.trim(),
            html
        };
    }

    breakdown(result) {
        const html = `
            <div class="ai-card ai-card--metric">
                <div class="ai-card__header">
                    <span>${escapeHtml(result.title)}</span>
                </div>

                <div class="ai-card__value">${formatMoney(result.total)}</div>

                ${barsHtml(result.categories)}
            </div>
        `;

        return {
            message: `${result.title}. ${result.detail || ""}`.trim(),
            html
        };
    }

    comparison(result) {
        const series = (result.series || []).slice(-6);

        const max = Math.max(
            1,
            ...series.map(item => Math.max(item.income, item.expense))
        );

        const chart = series
            .map(
                item => `
                    <li>
                        <span class="ai-spark__bars">
                            <span class="ai-spark__income" style="height:${(item.income / max) * 100}%" title="Income ${formatMoney(item.income)}"></span>
                            <span class="ai-spark__expense" style="height:${(item.expense / max) * 100}%" title="Expense ${formatMoney(item.expense)}"></span>
                        </span>
                        <small>${escapeHtml(item.label)}</small>
                    </li>
                `
            )
            .join("");

        const html = `
            <div class="ai-card ai-card--metric">
                <div class="ai-card__header"><span>${escapeHtml(result.title)}</span></div>
                <ul class="ai-spark">${chart}</ul>
                ${rowsHtml(result.rows)}
            </div>
        `;

        return { message: result.detail, html };
    }

    budget(result) {
        const percent = result.usedPercent ?? 0;

        const state =
            percent > 100 ? "is-over" : percent > 80 ? "is-warning" : "is-ok";

        const html = `
            <div class="ai-card ai-card--metric">
                <div class="ai-card__header"><span>${escapeHtml(result.title)}</span></div>

                <div class="ai-card__value">${formatMoney(result.remaining)}</div>
                <p class="ai-card__subject">remaining of ${formatMoney(result.spendable)}</p>

                <div class="ai-progress ${state}">
                    <span style="width:${Math.min(100, percent)}%"></span>
                </div>

                ${rowsHtml(result.rows)}
            </div>
        `;

        return { message: result.detail, html };
    }

    health(result) {
        const html = `
            <div class="ai-card ai-card--metric">
                <div class="ai-card__header"><span>${escapeHtml(result.title)}</span></div>
                <div class="ai-card__value">${result.score}<small>/100</small></div>
                <p class="ai-card__subject">${escapeHtml(result.band)}</p>
                ${rowsHtml(result.rows)}
            </div>
        `;

        return {
            message: `Your financial health score is ${result.score}/100 (${result.band}). ${result.detail}`,
            html
        };
    }

    affordability(result) {
        const icon =
            result.tone === "yes"
                ? "fa-circle-check"
                : result.tone === "wait"
                    ? "fa-clock"
                    : "fa-circle-exclamation";

        const html = `
            <div class="ai-card ai-card--metric ai-card--${escapeHtml(result.tone)}">
                <div class="ai-card__header">
                    <i class="fa-solid ${icon}"></i>
                    <span>${escapeHtml(result.title)}</span>
                </div>
                ${rowsHtml(result.rows)}
            </div>
        `;

        return { message: result.detail, html };
    }
}

export default FinanceQueryFormatter;
