/* ==========================================================================
   analytics.js  (server)
   Pure aggregation helpers over a transaction list.

   Mirrors js/core/analytics.js on the client so the dashboard, the chatbot
   and the API all report identical numbers.
========================================================================== */

const MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/* ==========================================================
                        NORMALISATION
========================================================== */

function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function round2(value) {
    return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

/*
    A transaction row is only counted when it has a usable amount, a known
    type and a parseable date. Previously any row whose type was not exactly
    "income" was silently counted as an expense, so a typo or a null type
    inflated spending.
*/
function normalize(transaction) {
    if (!transaction) return null;

    const amount = toNumber(transaction.amount);

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
        dateKey: date.toISOString().slice(0, 10)
    };
}

function normalizeAll(transactions) {
    return (Array.isArray(transactions) ? transactions : [])
        .map(normalize)
        .filter(Boolean)
        .sort((a, b) => b.date - a.date);
}

/* ==========================================================
                        DATE RANGES
========================================================== */

function startOfDay(date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
}

function endOfDay(date) {
    const value = new Date(date);
    value.setHours(23, 59, 59, 999);
    return value;
}

function inRange(transaction, from, to) {
    const time = transaction.date.getTime();
    return time >= from.getTime() && time <= to.getTime();
}

function filterRange(transactions, from, to) {
    return transactions.filter(item => inRange(item, from, to));
}

/* ==========================================================
                        CORE TOTALS
========================================================== */

function totals(transactions) {
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

function byCategory(transactions, type = "expense") {
    const map = new Map();

    for (const item of transactions) {
        if (item.type !== type) continue;
        map.set(item.category, round2((map.get(item.category) || 0) + item.amount));
    }

    const total = [...map.values()].reduce((sum, value) => sum + value, 0);

    return [...map.entries()]
        .map(([category, amount]) => ({
            category,
            amount,
            percentage: total > 0 ? round2((amount / total) * 100) : 0
        }))
        .sort((a, b) => b.amount - a.amount);
}

/*
    Monthly buckets keyed by year-month rather than by month label. The old
    dashboard matched on label + year which broke as soon as the 6 month
    window wrapped across a year boundary twice.
*/
function monthlySeries(transactions, months = 6, reference = new Date()) {
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
            month: date.getMonth(),
            year: date.getFullYear(),
            income: 0,
            expense: 0
        };

        buckets.push(bucket);
        index.set(key, bucket);
    }

    for (const item of transactions) {
        const key = `${item.date.getFullYear()}-${item.date.getMonth()}`;
        const bucket = index.get(key);

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

/* ==========================================================
                        SUMMARY
========================================================== */

function buildSummary(rawTransactions, options = {}) {
    const reference = options.reference
        ? new Date(options.reference)
        : new Date();

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
    const thisMonth = totals(filterRange(transactions, monthStart, monthEnd));
    const lastMonth = totals(filterRange(transactions, prevMonthStart, prevMonthEnd));
    const thisYear = totals(filterRange(transactions, yearStart, yearEnd));
    const today = totals(filterRange(transactions, todayStart, todayEnd));
    const last7Days = totals(filterRange(transactions, weekStart, todayEnd));

    /* Average daily spend uses days actually elapsed, not a flat 30. */
    const daysElapsedThisMonth = Math.max(1, reference.getDate());

    const daysInMonth = new Date(
        reference.getFullYear(),
        reference.getMonth() + 1,
        0
    ).getDate();

    const firstTransaction = transactions[transactions.length - 1];

    const daysTracked = firstTransaction
        ? Math.max(
            1,
            Math.ceil(
                (todayEnd.getTime() - firstTransaction.date.getTime()) /
                (24 * 60 * 60 * 1000)
            )
        )
        : 1;

    const savingsRate = thisMonth.income > 0
        ? round2(((thisMonth.income - thisMonth.expense) / thisMonth.income) * 100)
        : 0;

    const expenseChange = lastMonth.expense > 0
        ? round2(((thisMonth.expense - lastMonth.expense) / lastMonth.expense) * 100)
        : null;

    const categories = byCategory(
        filterRange(transactions, monthStart, monthEnd),
        "expense"
    );

    const allTimeCategories = byCategory(transactions, "expense");

    return {
        generatedAt: reference.toISOString(),
        transactionCount: transactions.length,

        /* All-time */
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

        /* Comparisons */
        lastMonthIncome: lastMonth.income,
        lastMonthExpense: lastMonth.expense,
        lastMonthSavings: lastMonth.net,
        expenseChangePercent: expenseChange,

        /* Other windows */
        yearIncome: thisYear.income,
        yearExpense: thisYear.expense,
        todayExpense: today.expense,
        todayIncome: today.income,
        weekExpense: last7Days.expense,
        weekIncome: last7Days.income,

        /* Averages */
        averageDailyExpenseThisMonth: round2(
            thisMonth.expense / daysElapsedThisMonth
        ),
        averageDailyExpenseAllTime: round2(allTime.expense / daysTracked),
        projectedMonthExpense: round2(
            (thisMonth.expense / daysElapsedThisMonth) * daysInMonth
        ),

        /* Breakdowns */
        categories,
        allTimeCategories,
        topCategory: categories[0] || null,
        categoryTotals: categories.reduce((acc, item) => {
            acc[item.category] = item.amount;
            return acc;
        }, {}),

        monthlySeries: monthlySeries(transactions, 6, reference),
        yearlySeries: monthlySeries(transactions, 12, reference)
    };
}

module.exports = {
    MONTH_LABELS,
    round2,
    normalize,
    normalizeAll,
    startOfDay,
    endOfDay,
    filterRange,
    totals,
    byCategory,
    monthlySeries,
    buildSummary
};
