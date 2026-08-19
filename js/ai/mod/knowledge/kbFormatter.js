/* ==========================================================================
   kbFormatter.js
========================================================================== */

import { listTopics } from "./financeKB.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/* Minimal, allow-listed markdown -> HTML. Nothing from the model is
   injected as raw HTML. */
function renderMarkdown(text) {
    const escaped = escapeHtml(text);

    const withInline = escaped
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");

    const blocks = withInline.split(/\n{2,}/);

    return blocks
        .map(block => {
            const lines = block.split("\n").filter(Boolean);

            const isList = lines.every(line =>
                /^\s*([-*•]|\d+\.)\s+/.test(line)
            );

            if (isList && lines.length) {
                const items = lines
                    .map(line =>
                        `<li>${line.replace(/^\s*([-*•]|\d+\.)\s+/, "")}</li>`
                    )
                    .join("");

                return `<ul>${items}</ul>`;
            }

            return `<p>${lines.join("<br>")}</p>`;
        })
        .join("");
}

class KnowledgeFormatter {

    async format(result) {
        if (!result) {
            return { message: "I couldn't answer that.", html: "" };
        }

        if (result.kind === "unavailable" || !result.success) {
            return { message: result.message, html: "" };
        }

        if (result.kind === "topic") return this.topic(result);
        if (result.kind === "model") return this.model(result);

        return this.capabilities();
    }

    /* ==========================================================
                        CURATED TOPIC
    ========================================================== */

    topic(result) {
        const topic = result.topic;

        const points = topic.points
            .map(point => `<li>${escapeHtml(point)}</li>`)
            .join("");

        const html = `
            <div class="ai-card ai-card--knowledge">
                <div class="ai-card__header">
                    <i class="fa-solid fa-book-open"></i>
                    <span>${escapeHtml(topic.title)}</span>
                </div>

                <p class="ai-card__lead">${escapeHtml(topic.summary)}</p>

                <ul class="ai-card__points">${points}</ul>

                <p class="ai-card__risk">
                    <strong>Risk:</strong> ${escapeHtml(topic.risk)}
                </p>

                ${
                    topic.appNote
                        ? `<p class="ai-card__tip"><i class="fa-solid fa-lightbulb"></i> ${escapeHtml(topic.appNote)}</p>`
                        : ""
                }

                ${
                    result.supplement
                        ? `<div class="ai-card__supplement">
                               <span class="ai-card__supplement-label">Latest</span>
                               ${renderMarkdown(result.supplement)}
                           </div>`
                        : ""
                }

                <p class="ai-card__disclaimer">
                    General financial education, not personalised advice.
                    ${result.degraded ? "(Live AI unavailable, showing the built-in explainer.)" : ""}
                </p>
            </div>
        `;

        return {
            message: `${topic.title}: ${topic.summary}`,
            html
        };
    }

    /* ==========================================================
                        MODEL ANSWER
    ========================================================== */

    model(result) {
        const sources = (result.sources || [])
            .slice(0, 4)
            .map(
                source => `
                    <li>
                        <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">
                            ${escapeHtml(source.title)}
                        </a>
                    </li>
                `
            )
            .join("");

        const html = `
            <div class="ai-card ai-card--knowledge">
                <div class="ai-card__body">${renderMarkdown(result.answer)}</div>

                ${
                    sources
                        ? `<div class="ai-card__sources">
                               <span>Sources</span>
                               <ul>${sources}</ul>
                           </div>`
                        : ""
                }
            </div>
        `;

        return {
            message: result.answer,
            html
        };
    }

    /* ==========================================================
                        CAPABILITIES
    ========================================================== */

    capabilities() {
        const topics = listTopics().slice(0, 8).join(", ");

        const html = `
            <div class="ai-card ai-card--knowledge">
                <div class="ai-card__header">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    <span>What I can do</span>
                </div>

                <ul class="ai-card__points">
                    <li><strong>Add transactions</strong> - "Add ₹500 spent on food today"</li>
                    <li><strong>Edit them</strong> - "Change yesterday's food expense from ₹500 to ₹700"</li>
                    <li><strong>Answer money questions</strong> - "How much did I spend last week?"</li>
                    <li><strong>Break down spending</strong> - "What's my highest spending category?"</li>
                    <li><strong>Check affordability</strong> - "Can I afford a ₹60,000 laptop?"</li>
                    <li><strong>Explain finance</strong> - ${escapeHtml(topics)}</li>
                    <li><strong>Plan goals</strong> - open a goal and tap Optimise for an investment plan</li>
                </ul>
            </div>
        `;

        return {
            message: "Here's what I can help with.",
            html
        };
    }
}

export default KnowledgeFormatter;
