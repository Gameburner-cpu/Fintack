/* ==========================================================================
   goalManager.js
   Goal status and AI investment plans in the chat.

   The plan itself is computed server-side (backend/utils/investmentEngine.js)
   so the chat, the Goals page and the API all return the same numbers.
========================================================================== */

import { fetchGoals, fetchInvestmentPlan } from "../../../core/api.js";
import { getCurrentUser } from "../../../core/config.js";
import Store from "../transactions/txStore.js";
import { buildSummary, formatMoney } from "../../../core/analytics.js";

class GoalManager {

    async execute(action, aiRequest) {
        const user = getCurrentUser();

        if (!user?.id) {
            return {
                success: false,
                message: "Please log in so I can look at your goals."
            };
        }

        const goals = await fetchGoals(user.id);

        if (!goals.length) {
            return {
                success: true,
                kind: "empty",
                message:
                    "You don't have any goals yet. Create one on the Goals page - " +
                    "give it a target amount and a deadline - and I'll build an " +
                    "investment plan for it."
            };
        }

        if (action.action === "GOAL_STATUS") {
            return this.status(goals);
        }

        return this.plan(goals, aiRequest.message);
    }

    /* ==========================================================
                        STATUS
    ========================================================== */

    async status(goals) {
        const rows = goals.map(goal => {
            const target = Number(goal.target_amount) || 0;
            const saved = Number(goal.saved_amount) || 0;

            const progress = target > 0
                ? Math.min(100, Math.round((saved / target) * 100))
                : 0;

            const daysLeft = goal.deadline
                ? Math.ceil(
                    (new Date(goal.deadline).getTime() - Date.now()) / 86400000
                )
                : null;

            return {
                title: goal.title,
                target,
                saved,
                progress,
                daysLeft,
                onTrack: daysLeft === null || daysLeft > 0
                    ? progress >= expectedProgress(goal)
                    : saved >= target
            };
        });

        const behind = rows.filter(row => !row.onTrack);

        return {
            success: true,
            kind: "status",
            goals: rows,
            detail: behind.length
                ? `${behind.length} of ${rows.length} goal(s) are behind schedule: ${behind.map(row => row.title).join(", ")}.`
                : "All your goals are tracking on or ahead of schedule."
        };
    }

    /* ==========================================================
                        INVESTMENT PLAN
    ========================================================== */

    async plan(goals, message) {
        /* Match a goal by name if the user named one, otherwise take the nearest deadline. */
        const lower = String(message || "").toLowerCase();

        const named = goals.find(goal =>
            goal.title && lower.includes(String(goal.title).toLowerCase())
        );

        const goal = named || [...goals].sort((a, b) =>
            new Date(a.deadline) - new Date(b.deadline)
        )[0];

        const transactions = await Store.all();
        const summary = buildSummary(transactions);

        const riskTolerance =
            /\b(aggressive|high risk|risky)\b/i.test(lower) ? "aggressive"
                : /\b(conservative|safe|low risk|capital protection)\b/i.test(lower) ? "conservative"
                    : goal.risk_tolerance || "moderate";

        const response = await fetchInvestmentPlan(goal.id, {
            riskTolerance,
            monthlyIncome: summary.monthlyIncome,
            monthlyExpense: summary.monthlyExpense
        });

        if (!response?.success || !response.plan?.success) {
            return {
                success: false,
                message:
                    response?.plan?.message ||
                    response?.message ||
                    "I couldn't build an investment plan right now. Check that the " +
                    "goal has a target amount and a future deadline."
            };
        }

        return {
            success: true,
            kind: "plan",
            plan: response.plan,
            goalTitle: goal.title,
            matchedByName: Boolean(named),
            otherGoals: goals.length - 1,
            context: `Based on ${formatMoney(summary.monthlyIncome)} monthly income and ${formatMoney(summary.monthlyExpense)} monthly expenses from your records.`
        };
    }
}

/*
    Straight-line expectation: if 40% of the time between creation and
    deadline has elapsed, 40% saved is "on track".
*/
function expectedProgress(goal) {
    const created = goal.created_at ? new Date(goal.created_at) : null;
    const deadline = goal.deadline ? new Date(goal.deadline) : null;

    if (!created || !deadline || deadline <= created) return 0;

    const total = deadline.getTime() - created.getTime();
    const elapsed = Date.now() - created.getTime();

    return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

export default GoalManager;
