/* ==========================================================================
   fqManager.js
   Answers personal financial questions from the user's real transactions.
========================================================================== */

import Store from "../transactions/txStore.js";

import {
    buildSummary,
    periodReport,
    formatMoney,
    round2
} from "../../../core/analytics.js";

import { extractAmounts } from "../../utils/FinanceNLU.js";

/* Remembers the last question so "and last month?" resolves. */
const conversation = {
    lastMetric: null,
    lastPeriod: null,
    lastCategory: null
};

class FinanceQueryManager {

    async execute(action, aiRequest) {
        const transactions = await Store.all();

        if (!transactions.length) {
            return {
                success: true,
                empty: true,
                message:
                    "I don't see any transactions yet. Add a few - or just tell me " +
                    "\"Add ₹500 spent on food today\" - and I can start answering " +
                    "questions about your spending."
            };
        }

        const meta = action.data?.meta || {};

        let type = action.action;
        let period = meta.period;
        let category = meta.category;

        /* ---------------- Follow-up resolution ---------------- */
        if (type === "FOLLOW_UP") {
            type = conversation.lastMetric || "TOTAL_EXPENSE";
            category = category || conversation.lastCategory;
        }

        if (!period) {
            period = defaultPeriodFor(type, conversation.lastPeriod);
        }

        conversation.lastMetric = type;
        conversation.lastPeriod = period;
        conversation.lastCategory = category || null;

        const summary = buildSummary(transactions);
        const report = periodReport(transactions, period);

        switch (type) {
            case "TOTAL_EXPENSE":
                return this.expense(report, category, summary);

            case "TOTAL_INCOME":
                return this.income(report);

            case "TOTAL_SAVINGS":
                return this.savings(report, summary);

            case "BALANCE":
                return this.balance(summary);

            case "CATEGORY_BREAKDOWN":
                return this.breakdown(report);

            case "TOP_CATEGORY":
                return this.topCategory(report);

            case "AVERAGE_DAILY":
                return this.averageDaily(report, summary);

            case "COMPARE_MONTHS":
                return this.compare(summary);

            case "BUDGET_STATUS":
                return this.budget(summary);

            case "FINANCIAL_HEALTH":
                return this.health(summary);

            case "AFFORDABILITY":
                return this.affordability(aiRequest, summary);

            default:
                return this.expense(report, category, summary);
        }
    }

    /* ==========================================================
                            EXPENSE
    ========================================================== */

    expense(report, category, summary) {
        if (category) {
            const match = report.categories.find(
                item => item.category.toLowerCase() === category.toLowerCase()
            );

            const amount = match?.amount || 0;

            return {
                success: true,
                kind: "metric",
                title: `${category} spending`,
                value: amount,
                subtitle: `${report.label}`,
                detail: amount
                    ? `That is ${match.percentage}% of everything you spent ${report.label}.`
                    : `No ${category.toLowerCase()} spending recorded ${report.label}.`,
                rows: [
                    ["Transactions", String(
                        report.transactions.filter(
                            item =>
                                item.type === "expense" &&
                                item.category.toLowerCase() === category.toLowerCase()
                        ).length
                    )],
                    [`Total spent ${report.label}`, formatMoney(report.expense)]
                ]
            };
        }

        const rows = [
            ["Transactions", String(report.count)],
            ["Daily average", formatMoney(report.averageDaily)]
        ];

        if (report.income > 0) {
            rows.push(["Income in the same period", formatMoney(report.income)]);
            rows.push(["Net", formatMoney(report.net)]);
        }

        const top = report.categories[0];

        return {
            success: true,
            kind: "metric",
            title: `Spending ${report.label}`,
            value: report.expense,
            subtitle: `${report.from} to ${report.to}`,
            detail: top
                ? `Biggest category: ${top.category} at ${formatMoney(top.amount)} (${top.percentage}%).`
                : "No expenses recorded in this period.",
            rows,
            categories: report.categories.slice(0, 5)
        };
    }

    /* ==========================================================
                            INCOME
    ========================================================== */

    income(report) {
        return {
            success: true,
            kind: "metric",
            title: `Income ${report.label}`,
            value: report.income,
            subtitle: `${report.from} to ${report.to}`,
            detail: report.income
                ? `Across ${report.incomeCategories.length || 1} source(s).`
                : "No income recorded in this period.",
            rows: report.incomeCategories
                .slice(0, 5)
                .map(item => [item.category, formatMoney(item.amount)])
        };
    }

    /* ==========================================================
                            SAVINGS
    ========================================================== */

    savings(report, summary) {
        const rate = report.income > 0
            ? round2((report.net / report.income) * 100)
            : 0;

        const verdict =
            report.net < 0
                ? "You spent more than you earned in this period."
                : rate >= 20
                    ? "That is a healthy savings rate - 20% or more is the usual benchmark."
                    : rate >= 10
                        ? "Solid, though most planners suggest working towards 20%."
                        : "That is below the 20% benchmark most planners suggest.";

        return {
            success: true,
            kind: "metric",
            title: `Savings ${report.label}`,
            value: report.net,
            subtitle: `${rate}% of income`,
            detail: verdict,
            rows: [
                ["Income", formatMoney(report.income)],
                ["Expenses", formatMoney(report.expense)],
                ["All-time balance", formatMoney(summary.balance)]
            ]
        };
    }

    /* ==========================================================
                            BALANCE
    ========================================================== */

    balance(summary) {
        return {
            success: true,
            kind: "metric",
            title: "Current balance",
            value: summary.balance,
            subtitle: "All income minus all expenses on record",
            detail:
                summary.balance < 0
                    ? "Your recorded expenses exceed your recorded income. Check whether some income is missing."
                    : `Built from ${summary.transactionCount} transactions.`,
            rows: [
                ["Total income", formatMoney(summary.totalIncome)],
                ["Total expenses", formatMoney(summary.totalExpense)],
                ["This month's savings", formatMoney(summary.monthlySavings)]
            ]
        };
    }

    /* ==========================================================
                        CATEGORY BREAKDOWN
    ========================================================== */

    breakdown(report) {
        if (!report.categories.length) {
            return {
                success: true,
                kind: "text",
                message: `No expenses recorded ${report.label}.`
            };
        }

        return {
            success: true,
            kind: "breakdown",
            title: `Where your money went ${report.label}`,
            total: report.expense,
            categories: report.categories,
            detail: `${report.categories.length} categories, ${report.count} transactions.`
        };
    }

    /* ==========================================================
                        TOP CATEGORY
    ========================================================== */

    topCategory(report) {
        const top = report.categories[0];

        if (!top) {
            return {
                success: true,
                kind: "text",
                message: `No expenses recorded ${report.label}, so there's no top category yet.`
            };
        }

        const second = report.categories[1];

        return {
            success: true,
            kind: "metric",
            title: `Highest spending ${report.label}`,
            value: top.amount,
            subtitle: top.category,
            detail: second
                ? `${top.percentage}% of your spending. Next is ${second.category} at ${formatMoney(second.amount)}.`
                : `${top.percentage}% of your spending ${report.label}.`,
            categories: report.categories.slice(0, 5)
        };
    }

    /* ==========================================================
                        AVERAGE DAILY
    ========================================================== */

    averageDaily(report, summary) {
        return {
            success: true,
            kind: "metric",
            title: `Average daily spend ${report.label}`,
            value: report.averageDaily,
            subtitle: `Across ${report.days} day(s)`,
            detail:
                `At this pace you would spend about ` +
                `${formatMoney(report.averageDaily * 30)} in a 30-day month.`,
            rows: [
                ["Total in period", formatMoney(report.expense)],
                ["All-time daily average", formatMoney(summary.averageDailyExpenseAllTime)],
                ["Projected this month", formatMoney(summary.projectedMonthExpense)]
            ]
        };
    }

    /* ==========================================================
                        MONTH COMPARISON
    ========================================================== */

    compare(summary) {
        const change = summary.expenseChangePercent;

        const direction =
            change === null
                ? "No spending recorded last month, so there's nothing to compare against yet."
                : change > 0
                    ? `You are spending ${Math.abs(change)}% more than last month.`
                    : change < 0
                        ? `You are spending ${Math.abs(change)}% less than last month. `
                        : "Your spending is flat versus last month.";

        const partial =
            summary.daysRemaining > 0
                ? ` Note this month is only ${summary.daysElapsed} of ${summary.daysInMonth} days in, so the comparison is partial - your projected full-month spend is ${formatMoney(summary.projectedMonthExpense)}.`
                : "";

        return {
            success: true,
            kind: "comparison",
            title: "This month vs last month",
            detail: direction + partial,
            series: summary.monthlySeries,
            rows: [
                ["This month expenses", formatMoney(summary.monthlyExpense)],
                ["Last month expenses", formatMoney(summary.lastMonthExpense)],
                ["This month income", formatMoney(summary.monthlyIncome)],
                ["Last month income", formatMoney(summary.lastMonthIncome)],
                ["This month savings", formatMoney(summary.monthlySavings)],
                ["Last month savings", formatMoney(summary.lastMonthSavings)]
            ]
        };
    }

    /* ==========================================================
                        BUDGET STATUS
    ========================================================== */

    budget(summary) {
        let budget = { income: 0, savings: 0 };

        try {
            budget = JSON.parse(localStorage.getItem("budget_data")) || budget;
        } catch (err) {
            /* Ignore malformed local budget data. */
        }

        const plannedIncome = Number(budget.income) || summary.monthlyIncome;
        const plannedSavings = Number(budget.savings) || 0;

        const spendable = Math.max(0, plannedIncome - plannedSavings);
        const spent = summary.monthlyExpense;
        const remaining = round2(spendable - spent);

        const usedPercent = spendable > 0
            ? round2((spent / spendable) * 100)
            : null;

        const dailyAllowance = summary.daysRemaining > 0
            ? round2(Math.max(0, remaining) / summary.daysRemaining)
            : 0;

        if (!plannedIncome) {
            return {
                success: true,
                kind: "text",
                message:
                    "You haven't set a monthly budget yet. Open the Expenses panel, " +
                    "enter your monthly income and savings target, and I'll track it for you."
            };
        }

        return {
            success: true,
            kind: "budget",
            title: "Budget status",
            spendable,
            spent,
            remaining,
            usedPercent,
            detail:
                remaining < 0
                    ? `You are ${formatMoney(Math.abs(remaining))} over your spending allowance with ${summary.daysRemaining} day(s) left.`
                    : `${formatMoney(remaining)} left for the remaining ${summary.daysRemaining} day(s) - about ${formatMoney(dailyAllowance)} a day.`,
            rows: [
                ["Planned income", formatMoney(plannedIncome)],
                ["Savings target", formatMoney(plannedSavings)],
                ["Spendable", formatMoney(spendable)],
                ["Spent so far", formatMoney(spent)],
                ["Projected full month", formatMoney(summary.projectedMonthExpense)]
            ]
        };
    }

    /* ==========================================================
                        FINANCIAL HEALTH
    ========================================================== */

    health(summary) {
        const rate = summary.savingsRate;

        /*
            Score is a weighted blend rather than the old flat +15 bonuses,
            which could report "Excellent" for someone with one lucky month.
        */
        let score = 0;

        score += Math.max(0, Math.min(40, rate * 1.6));                    // savings rate, up to 40
        score += summary.monthlyIncome > 0 ? 15 : 0;                       // has recorded income
        score += summary.balance > 0 ? 15 : 0;                             // positive net position
        score += summary.transactionCount >= 20 ? 10 : summary.transactionCount / 2;
        score += summary.expenseChangePercent !== null && summary.expenseChangePercent <= 0 ? 10 : 0;
        score += summary.categories.length >= 3 ? 10 : 3;

        score = Math.round(Math.max(5, Math.min(100, score)));

        const band =
            score >= 80 ? "Excellent"
                : score >= 65 ? "Good"
                    : score >= 45 ? "Fair"
                        : "Needs attention";

        const advice = [];

        if (rate < 20) {
            advice.push(
                `Your savings rate is ${rate}%. Moving towards 20% is the single biggest lever here.`
            );
        }

        if (summary.topCategory && summary.topCategory.percentage > 40) {
            advice.push(
                `${summary.topCategory.category} is ${summary.topCategory.percentage}% of your spending - worth a closer look.`
            );
        }

        if (summary.expenseChangePercent > 15) {
            advice.push(
                `Spending is up ${summary.expenseChangePercent}% on last month.`
            );
        }

        if (!advice.length) {
            advice.push("Nothing is flashing red. Keep the current pattern going.");
        }

        return {
            success: true,
            kind: "health",
            title: "Financial health",
            score,
            band,
            detail: advice.join(" "),
            rows: [
                ["Savings rate", `${rate}%`],
                ["Monthly income", formatMoney(summary.monthlyIncome)],
                ["Monthly expenses", formatMoney(summary.monthlyExpense)],
                ["Net position", formatMoney(summary.balance)]
            ]
        };
    }

    /* ==========================================================
                        AFFORDABILITY
    ========================================================== */

    affordability(aiRequest, summary) {
        const amounts = extractAmounts(aiRequest.message);
        const price = amounts.length ? amounts[0].value : null;

        if (!price) {
            return {
                success: true,
                kind: "text",
                message:
                    "How much does it cost? For example: \"Can I afford a ₹60,000 laptop?\""
            };
        }

        const surplus = summary.monthlySavings;
        const balance = summary.balance;

        const monthsOfSavings = surplus > 0
            ? round2(price / surplus)
            : null;

        const emergencyTarget = round2(summary.monthlyExpense * 6);
        const afterPurchase = round2(balance - price);

        let verdict;
        let tone;

        if (surplus <= 0) {
            verdict =
                "You are not saving anything this month, so this purchase would come " +
                "out of existing balance or debt. I'd hold off.";
            tone = "no";
        } else if (price <= surplus) {
            verdict =
                `This fits inside a single month's savings (${formatMoney(surplus)}). ` +
                "Comfortably affordable.";
            tone = "yes";
        } else if (afterPurchase >= emergencyTarget) {
            verdict =
                `Paying from your balance still leaves ${formatMoney(afterPurchase)}, ` +
                `above your ${formatMoney(emergencyTarget)} emergency-fund target. Affordable.`;
            tone = "yes";
        } else if (monthsOfSavings && monthsOfSavings <= 6) {
            verdict =
                `Saving up would take about ${Math.ceil(monthsOfSavings)} month(s) at your ` +
                "current rate. Buying it now would dip into your emergency buffer.";
            tone = "wait";
        } else {
            verdict =
                `At ${formatMoney(surplus)} saved a month this is roughly ` +
                `${Math.ceil(monthsOfSavings)} months of savings. That is a stretch.`;
            tone = "no";
        }

        return {
            success: true,
            kind: "affordability",
            title: `Can you afford ${formatMoney(price)}?`,
            price,
            tone,
            detail: verdict,
            rows: [
                ["Monthly savings", formatMoney(surplus)],
                ["Current balance", formatMoney(balance)],
                ["Balance after purchase", formatMoney(afterPurchase)],
                ["6-month emergency target", formatMoney(emergencyTarget)],
                [
                    "Months to save up",
                    monthsOfSavings ? `${Math.ceil(monthsOfSavings)}` : "n/a"
                ]
            ]
        };
    }
}

/* ==========================================================
                        HELPERS
========================================================== */

function defaultPeriodFor(metric, lastPeriod) {
    if (lastPeriod) return lastPeriod;

    switch (metric) {
        case "TOTAL_INCOME":
        case "TOTAL_SAVINGS":
        case "BUDGET_STATUS":
            return "this_month";

        case "BALANCE":
            return "all_time";

        default:
            return "this_month";
    }
}

export function resetFinanceConversation() {
    conversation.lastMetric = null;
    conversation.lastPeriod = null;
    conversation.lastCategory = null;
}

export default FinanceQueryManager;
