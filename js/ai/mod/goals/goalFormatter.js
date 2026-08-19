/* ==========================================================================
   goalFormatter.js
   Renders the investment plan as a chat card.
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

const RISK_CLASS = {
    "Very Low": "risk-1",
    Low: "risk-2",
    Medium: "risk-3",
    "Medium-High": "risk-4",
    High: "risk-5",
    "Very High": "risk-6"
};

class GoalFormatter {

    async format(result) {
        if (!result) {
            return { message: "I couldn't load your goals.", html: "" };
        }

        if (!result.success) {
            return { message: result.message, html: "" };
        }

        if (result.kind === "empty") {
            return { message: result.message, html: "" };
        }

        if (result.kind === "status") return this.status(result);

        return this.plan(result);
    }

    /* ==========================================================
                        GOAL STATUS
    ========================================================== */

    status(result) {
        const rows = result.goals
            .map(goal => `
                <li>
                    <div class="ai-goal__head">
                        <strong>${escapeHtml(goal.title)}</strong>
                        <span class="${goal.onTrack ? "is-ontrack" : "is-behind"}">
                            ${goal.onTrack ? "On track" : "Behind"}
                        </span>
                    </div>

                    <div class="ai-progress">
                        <span style="width:${goal.progress}%"></span>
                    </div>

                    <small>
                        ${formatMoney(goal.saved)} of ${formatMoney(goal.target)}
                        &middot; ${goal.progress}%
                        ${goal.daysLeft !== null ? `&middot; ${goal.daysLeft} day(s) left` : ""}
                    </small>
                </li>
            `)
            .join("");

        return {
            message: result.detail,
            html: `<ul class="ai-card__list ai-card__list--goals">${rows}</ul>`
        };
    }

    /* ==========================================================
                        INVESTMENT PLAN
    ========================================================== */

    plan(result) {
        const plan = result.plan;

        if (plan.status === "completed" || plan.status === "overdue") {
            return { message: plan.message, html: "" };
        }

        const goal = plan.goal;
        const contribution = plan.contribution;
        const projection = plan.projection;

        const allocationRows = [
            ["Equity", plan.allocation.equity],
            ["Debt", plan.allocation.debt],
            ["Gold", plan.allocation.gold],
            ["Real estate", plan.allocation.realEstate]
        ]
            .filter(([, value]) => value > 0)
            .map(
                ([label, value]) => `
                    <li>
                        <span class="ai-bars__label">${label}</span>
                        <span class="ai-bars__track">
                            <span class="ai-bars__fill" style="width:${value}%"></span>
                        </span>
                        <span class="ai-bars__value">${value}%</span>
                    </li>
                `
            )
            .join("");

        const recommendations = plan.recommendations
            .map(item => `
                <li class="ai-rec">
                    <div class="ai-rec__head">
                        <strong>${escapeHtml(item.name)}</strong>
                        <span class="ai-risk ${RISK_CLASS[item.risk] || "risk-3"}">
                            ${escapeHtml(item.risk)}
                        </span>
                    </div>

                    <div class="ai-rec__figures">
                        <span><b>${item.allocationPercent}%</b> allocation</span>
                        ${
                            item.monthlySip > 0
                                ? `<span><b>${formatMoney(item.monthlySip)}</b>/month${item.supportsSIP ? " SIP" : ""}</span>`
                                : ""
                        }
                        <span><b>${item.expectedReturnRange.low}-${item.expectedReturnRange.high}%</b> p.a. historical</span>
                    </div>

                    <div class="ai-rec__projection">
                        Projected value: ${formatMoney(item.projectedValue.low)} - ${formatMoney(item.projectedValue.high)}
                    </div>

                    <p class="ai-rec__why">${escapeHtml(item.reasoning)}</p>

                    <small class="ai-rec__meta">
                        Liquidity: ${escapeHtml(item.liquidity)} &middot; Lock-in: ${escapeHtml(item.lockIn)}
                    </small>
                </li>
            `)
            .join("");

        const milestones = plan.milestones
            .map(item => `
                <li class="is-${escapeHtml(item.status)}">
                    <span class="ai-milestone__pct">${item.percent}%</span>
                    <span class="ai-milestone__amt">${formatMoney(item.amount)}</span>
                    <span class="ai-milestone__eta">
                        ${item.etaDate ? escapeHtml(item.etaDate) : escapeHtml(item.note)}
                    </span>
                </li>
            `)
            .join("");

        const feasibilityNote = {
            comfortable: "Comfortably within your current savings.",
            tight: "This uses almost all of your monthly surplus.",
            unrealistic: "This exceeds what you currently save each month.",
            unknown: "Add income and expense records for a feasibility check."
        }[contribution.feasibility];

        const html = `
            <div class="ai-card ai-card--plan">
                <div class="ai-card__header">
                    <i class="fa-solid fa-chart-pie"></i>
                    <span>Investment plan: ${escapeHtml(goal.title || "your goal")}</span>
                </div>

                <div class="ai-plan__hero">
                    <div>
                        <small>Monthly SIP needed</small>
                        <strong>${formatMoney(contribution.monthlySip)}</strong>
                    </div>
                    <div>
                        <small>Target</small>
                        <strong>${formatMoney(goal.target)}</strong>
                    </div>
                    <div>
                        <small>Time left</small>
                        <strong>${goal.months} mo</strong>
                    </div>
                </div>

                <p class="ai-card__lead">${escapeHtml(plan.summary)}</p>

                <div class="ai-plan__section">
                    <h4>Risk profile: ${escapeHtml(plan.profile.riskLabel)}</h4>
                    <ul class="ai-card__points">
                        ${plan.profile.reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join("")}
                    </ul>
                </div>

                <div class="ai-plan__section">
                    <h4>Asset allocation</h4>
                    <ul class="ai-bars">${allocationRows}</ul>
                </div>

                <div class="ai-plan__section">
                    <h4>Recommendations</h4>
                    <ul class="ai-rec-list">${recommendations}</ul>
                </div>

                <div class="ai-plan__section">
                    <h4>Projection at ${plan.expectedReturn.blended}% blended return</h4>
                    <dl class="ai-card__rows">
                        <div><dt>You contribute</dt><dd>${formatMoney(projection.totalContributed)}</dd></div>
                        <div><dt>Growth adds</dt><dd>${formatMoney(projection.growthComponent)}</dd></div>
                        <div><dt>Projected total</dt><dd>${formatMoney(projection.atBlendedReturn)}</dd></div>
                        <div><dt>Range</dt><dd>${formatMoney(projection.atLowReturn)} - ${formatMoney(projection.atHighReturn)}</dd></div>
                        <div><dt>Feasibility</dt><dd>${escapeHtml(feasibilityNote)}</dd></div>
                    </dl>
                </div>

                <div class="ai-plan__section">
                    <h4>Milestones</h4>
                    <ul class="ai-milestones">${milestones}</ul>
                </div>

                <p class="ai-card__disclaimer">${escapeHtml(plan.disclaimer)}</p>
            </div>
        `;

        const intro = result.matchedByName
            ? ""
            : result.otherGoals > 0
                ? ` (Nearest deadline of your ${result.otherGoals + 1} goals - name a goal to plan a different one.)`
                : "";

        return {
            message: `${plan.summary}${intro}`,
            html
        };
    }
}

export default GoalFormatter;
