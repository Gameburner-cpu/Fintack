/* ==========================================================================
   js/core/analytics.js
   The one place transaction numbers are calculated on the client.

   Mirrors backend/utils/analytics.js. The dashboard, the budget panel, the
   charts and the chatbot all read from here, so they can no longer disagree
   with each other.

   Performance: results are memoised on a cheap fingerprint of the dataset,
   so re-rendering the dashboard or asking the chatbot ten questions in a row
   does not re-aggregate thousands of rows ten times.
========================================================================== */

export const MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export const MONTH_FULL = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

/* ==========================================================
                        PRIMITIVES
========================================================== */

export function round2(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value) {
    const num = Number(value) || 0;
    const sign = num < 0 ? "-" : "";

    return `${sign}₹${Math.abs(Math.round(num)).toLocaleString("en-IN")}`;
}

/*
    Rows are dropped unless they have a positive amount, a known type and a
    parseable date. The old dashboard treated every non-"income" row as an
    expense, so a null type inflated spending.
*/
export function normalizeTransaction(transaction) {
    if (!transaction) return null;

    const amount = Number(transaction.amount);

    if (!Number.isFinite(amount) || amount <= 0) return null;

    const type = String(transaction.type || "").toLowerCase().trim();

    if (type !== "income" && type !== "expense") return null;

    const raw = transaction.date || transaction.created_at;
    const date = raw ? new Date(raw) : null;

    if (!date || Number.isNaN(date.getTime())) return null;

    return {
        id: transaction.id,
        title: transaction.title || "Transaction",
        description: transaction.description || "",
        category: transaction.category || "Other",
        amount,
        type,
        date,
        dateKey: toDateKey(date)
    };
}

export function normalizeAll(transactions) {
    return (Array.isArray(transactions) ? transactions : [])
        .map(normalizeTransaction)
        .filter(Boolean)
        .sort((a, b) => b.date - a.date);
}

export function toDateKey(date) {
    const value = new Date(date);

    return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, "0"),
        String(value.getDate()).padStart(2, "0")
    ].join("-");
}

export function startOfDay(date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
}

export function endOfDay(date) {
    const value = new Date(date);
    value.setHours(23, 59, 59, 999);
    return value;
}

/* ==========================================================
                        AGGREGATION
========================================================== */

export function filterRange(transactions, from, to) {
    const start = from.getTime();
    const end = to.getTime();

    return transactions.filter(item => {
        const time = item.date.getTime();
        return time >= start && time <= end;
    });
}

export function totals(transactions) {
    let income = 0;
    let expense = 0;

    for (const item of transactions) {
        if (item.type === "income") income += item.amount;
        else expense += item.amount;
    }

    return {
        income: round2(income),
        expense: round2(expense),
        net: round2(income - expense),
        count: transactions.length
    };
}

export function byCategory(transactions, type = "expense") {
    const map = new Map();

    for (const item of transactions) {
        if (item.type !== type) continue;
        map.set(item.category, (map.get(item.category) || 0) + item.amount);
    }

    let total = 0;
    for (const value of map.values()) total += value;

    return [...map.entries()]
        .map(([category, amount]) => ({
            category,
            amount: round2(amount),
            percentage: total > 0 ? round2((amount / total) * 100) : 0
        }))
        .sort((a, b) => b.amount - a.amount);
}

/*
    Buckets keyed by year+month rather than by month name. The previous
    implementation matched on the label, so a 12 month window double counted
    the repeated month.
*/
export function monthlySeries(transactions, months = 6, reference = new Date()) {
    const buckets = [];
    const index = new Map();

    for (let i = months - 1; i >= 0; i -= 1) {
        const date = new Date(
            reference.getFullYear(),
            reference.getMonth() - i,
            1
        );

        const key = `${date.getFullYear()}-${date.getMonth()}`;

        const bucket = {
            key,
            label: MONTH_LABELS[date.getMonth()],
            fullLabel: `${MONTH_FULL[date.getMonth()]} ${date.getFullYear()}`,
            month: date.getMonth(),
            year: date.getFullYear(),
            income: 0,
            expense: 0
        };

        buckets.push(bucket);
        index.set(key, bucket);
    }

    for (const item of transactions) {
        const bucket = index.get(
            `${item.date.getFullYear()}-${item.date.getMonth()}`
        );

        if (!bucket) continue;

        if (item.type === "income") bucket.income += item.amount;
        else bucket.expense += item.amount;
    }

    return buckets.map(bucket => ({
        ...bucket,
        income: round2(bucket.income),
        expense: round2(bucket.expense),
        savings: round2(bucket.income - bucket.expense)
    }));
}

export function dailySeries(transactions, days = 30, reference = new Date()) {
    const buckets = [];
    const index = new Map();

    for (let i = days - 1; i >= 0; i -= 1) {
        const date = new Date(reference);
        date.setDate(date.getDate() - i);

        const key = toDateKey(date);

        const bucket = {
            key,
            label: `${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`,
            income: 0,
            expense: 0
        };

        buckets.push(bucket);
        index.set(key, bucket);
    }

    for (const item of transactions) {
        const bucket = index.get(item.dateKey);
        if (!bucket) continue;

        if (item.type === "income") bucket.income += item.amount;
        else bucket.expense += item.amount;
    }

    return buckets.map(bucket => ({
        ...bucket,
        income: round2(bucket.income),
        expense: round2(bucket.expense)
    }));
}

/* ==========================================================
                        SUMMARY (memoised)
========================================================== */

let cacheKey = null;
let cacheValue = null;

function fingerprint(transactions) {
    const list = Array.isArray(transactions) ? transactions : [];

    let checksum = 0;

    for (const item of list) {
        checksum += Number(item?.amount) || 0;
    }

    return [
        list.length,
        Math.round(checksum),
        list[0]?.id || "",
        list[0]?.updated_at || list[0]?.date || "",
        new Date().toISOString().slice(0, 13) // hour bucket
    ].join("|");
}

export function invalidateAnalyticsCache() {
    cacheKey = null;
    cacheValue = null;
}

export function buildSummary(rawTransactions, options = {}) {
    const reference = options.reference
        ? new Date(options.reference)
        : new Date();

    if (!options.reference && !options.noCache) {
        const key = fingerprint(rawTransactions);

        if (key === cacheKey && cacheValue) return cacheValue;

        const value = computeSummary(rawTransactions, reference);

        cacheKey = key;
        cacheValue = value;

        return value;
    }

    return computeSummary(rawTransactions, reference);
}

function computeSummary(rawTransactions, reference) {
    const transactions = normalizeAll(rawTransactions);

    const monthStart = new Date(
        reference.getFullYear(),
        reference.getMonth(),
        1
    );

    const monthEnd = endOfDay(
        new Date(reference.getFullYear(), reference.getMonth() + 1, 0)
    );

    const prevMonthStart = new Date(
        reference.getFullYear(),
        reference.getMonth() - 1,
        1
    );

    const prevMonthEnd = endOfDay(
        new Date(reference.getFullYear(), reference.getMonth(), 0)
    );

    const yearStart = new Date(reference.getFullYear(), 0, 1);
    const yearEnd = endOfDay(new Date(reference.getFullYear(), 11, 31));

    const todayStart = startOfDay(reference);
    const todayEnd = endOfDay(reference);

    const weekStart = startOfDay(
        new Date(reference.getTime() - 6 * 24 * 60 * 60 * 1000)
    );

    const allTime = totals(transactions);
    const monthTx = filterRange(transactions, monthStart, monthEnd);
    const thisMonth = totals(monthTx);
    const lastMonth = totals(filterRange(transactions, prevMonthStart, prevMonthEnd));
    const thisYear = totals(filterRange(transactions, yearStart, yearEnd));
    const today = totals(filterRange(transactions, todayStart, todayEnd));
    const week = totals(filterRange(transactions, weekStart, todayEnd));

    const daysElapsed = Math.max(1, reference.getDate());

    const daysInMonth = new Date(
        reference.getFullYear(),
        reference.getMonth() + 1,
        0
    ).getDate();

    const oldest = transactions[transactions.length - 1];

    const daysTracked = oldest
        ? Math.max(
            1,
            Math.ceil(
                (todayEnd.getTime() - oldest.date.getTime()) / 86400000
            )
        )
        : 1;

    const categories = byCategory(monthTx, "expense");
    const allTimeCategories = byCategory(transactions, "expense");

    const savingsRate = thisMonth.income > 0
        ? round2(((thisMonth.income - thisMonth.expense) / thisMonth.income) * 100)
        : 0;

    const series = monthlySeries(transactions, 6, reference);

    return {
        generatedAt: reference.toISOString(),
        transactions,
        transactionCount: transactions.length,

        /* All time */
        income: allTime.income,
        expenses: allTime.expense,
        totalIncome: allTime.income,
        totalExpense: allTime.expense,
        balance: allTime.net,
        netWorth: allTime.net,
        totalSavings: allTime.net,

        /* Current month */
        monthlyIncome: thisMonth.income,
        monthlyExpense: thisMonth.expense,
        monthlySavings: thisMonth.net,
        savingsRate,

        /* Previous month */
        lastMonthIncome: lastMonth.income,
        lastMonthExpense: lastMonth.expense,
        lastMonthSavings: lastMonth.net,
        expenseChangePercent: lastMonth.expense > 0
            ? round2(
                ((thisMonth.expense - lastMonth.expense) / lastMonth.expense) * 100
            )
            : null,

        /* Other windows */
        yearIncome: thisYear.income,
        yearExpense: thisYear.expense,
        todayIncome: today.income,
        todayExpense: today.expense,
        weekIncome: week.income,
        weekExpense: week.expense,

        /* Averages / projections */
        averageDailyExpense: round2(thisMonth.expense / daysElapsed),
        averageDailyExpenseAllTime: round2(allTime.expense / daysTracked),
        projectedMonthExpense: round2(
            (thisMonth.expense / daysElapsed) * daysInMonth
        ),
        daysInMonth,
        daysElapsed,
        daysRemaining: Math.max(0, daysInMonth - reference.getDate()),

        /* Breakdowns */
        categories,
        allTimeCategories,
        topCategory: categories[0] || null,
        categoryTotals: categories.reduce((acc, item) => {
            acc[item.category] = item.amount;
            return acc;
        }, {}),

        monthlySeries: series,
        chartData: {
            labels: series.map(item => item.label),
            income: series.map(item => item.income),
            expense: series.map(item => item.expense)
        }
    };
}

/* ==========================================================
                    NAMED PERIOD QUERIES

   Powers chatbot questions like "how much did I spend last
   week" without every caller re-deriving date boundaries.
========================================================== */

export function resolvePeriod(period, reference = new Date()) {
    const now = new Date(reference);

    const make = (from, to, label) => ({
        from: startOfDay(from),
        to: endOfDay(to),
        label
    });

    switch (period) {
        case "today":
            return make(now, now, "today");

        case "yesterday": {
            const day = new Date(now);
            day.setDate(day.getDate() - 1);
            return make(day, day, "yesterday");
        }

        case "this_week": {
            /* Week starts Monday. */
            const day = new Date(now);
            const offset = (day.getDay() + 6) % 7;
            day.setDate(day.getDate() - offset);
            return make(day, now, "this week");
        }

        case "last_week": {
            const end = new Date(now);
            const offset = (end.getDay() + 6) % 7;
            end.setDate(end.getDate() - offset - 1);

            const start = new Date(end);
            start.setDate(start.getDate() - 6);

            return make(start, end, "last week");
        }

        case "last_7_days": {
            const start = new Date(now);
            start.setDate(start.getDate() - 6);
            return make(start, now, "the last 7 days");
        }

        case "this_month":
            return make(
                new Date(now.getFullYear(), now.getMonth(), 1),
                now,
                "this month"
            );

        case "last_month":
            return make(
                new Date(now.getFullYear(), now.getMonth() - 1, 1),
                new Date(now.getFullYear(), now.getMonth(), 0),
                "last month"
            );

        case "last_30_days": {
            const start = new Date(now);
            start.setDate(start.getDate() - 29);
            return make(start, now, "the last 30 days");
        }

        case "this_year":
            return make(new Date(now.getFullYear(), 0, 1), now, "this year");

        case "last_year":
            return make(
                new Date(now.getFullYear() - 1, 0, 1),
                new Date(now.getFullYear() - 1, 11, 31),
                "last year"
            );

        case "all_time":
            return make(new Date(1970, 0, 1), now, "all time");

        default:
            return make(
                new Date(now.getFullYear(), now.getMonth(), 1),
                now,
                "this month"
            );
    }
}

/**
 * Totals + category split for a named period.
 */
export function periodReport(rawTransactions, period, reference = new Date()) {
    const transactions = normalizeAll(rawTransactions);
    const range = resolvePeriod(period, reference);
    const slice = filterRange(transactions, range.from, range.to);

    const summary = totals(slice);

    const days = Math.max(
        1,
        Math.round((range.to - range.from) / 86400000) + 1
    );

    return {
        period,
        label: range.label,
        from: toDateKey(range.from),
        to: toDateKey(range.to),
        days,
        ...summary,
        averageDaily: round2(summary.expense / days),
        categories: byCategory(slice, "expense"),
        incomeCategories: byCategory(slice, "income"),
        transactions: slice
    };
}

export default {
    buildSummary,
    periodReport,
    resolvePeriod,
    normalizeAll,
    byCategory,
    monthlySeries,
    dailySeries,
    filterRange,
    totals,
    formatMoney,
    round2,
    invalidateAnalyticsCache
};
