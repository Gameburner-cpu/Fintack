/* ==========================================================================
   calendarAPI.js
   Handles all Calendar-related transaction data requests.
========================================================================== */

const API_BASE = "https://fintack.onrender.com/api";


/* ==========================================================
                    GET ALL TRANSACTIONS
========================================================== */

export async function getCalendarTransactions(userId) {

    if (!userId) {

        console.warn("[CalendarAPI] Missing user ID");

        return [];

    }

    try {

        const response = await fetch(
            `${API_BASE}/transactions/${userId}`
        );

        if (!response.ok) {

            throw new Error(
                `Failed to fetch transactions: ${response.status}`
            );

        }

        const result = await response.json();

        const transactions =
            Array.isArray(result)
                ? result
                : result.transactions || [];

        console.log(
            "[CalendarAPI] Transactions loaded:",
            transactions
        );

        return transactions;

    }

    catch (error) {

        console.error(
            "[CalendarAPI] Transaction fetch error:",
            error
        );

        return [];

    }

}


/* ==========================================================
                GET TRANSACTIONS FOR DATE
========================================================== */

export function getTransactionsForDate(
    transactions,
    date
) {

    if (!Array.isArray(transactions) || !date) {

        return [];

    }

    const selectedDate =
        formatDateKey(date);

    return transactions.filter(transaction => {

        if (!transaction.date) {

            return false;

        }

        const transactionDate =
            formatDateKey(transaction.date);

        return transactionDate === selectedDate;

    });

}


/* ==========================================================
                GET TRANSACTIONS FOR MONTH
========================================================== */

export function getTransactionsForMonth(
    transactions,
    year,
    month
) {

    if (!Array.isArray(transactions)) {

        return [];

    }

    return transactions.filter(transaction => {

        if (!transaction.date) {

            return false;

        }

        const date =
            parseLocalDate(transaction.date);

        return (
            date.getFullYear() === year &&
            date.getMonth() === month
        );

    });

}


/* ==========================================================
                    DAILY TOTALS
========================================================== */

export function calculateDailyTotals(transactions) {

    const result = {

        income: 0,

        expense: 0,

        balance: 0,

        count: 0

    };

    if (!Array.isArray(transactions)) {

        return result;

    }

    transactions.forEach(transaction => {

        const amount =
            Number(transaction.amount) || 0;

        if (transaction.type === "income") {

            result.income += amount;

        }

        else {

            result.expense += amount;

        }

        result.count++;

    });

    result.balance =
        result.income - result.expense;

    return result;

}


/* ==========================================================
                    MONTHLY TOTALS
========================================================== */

export function calculateMonthlyTotals(transactions) {

    return calculateDailyTotals(transactions);

}


/* ==========================================================
                GROUP TRANSACTIONS BY DATE
========================================================== */

export function groupTransactionsByDate(transactions) {

    const grouped = {};

    if (!Array.isArray(transactions)) {

        return grouped;

    }

    transactions.forEach(transaction => {

        if (!transaction.date) {

            return;

        }

        const key =
            formatDateKey(transaction.date);

        if (!grouped[key]) {

            grouped[key] = [];

        }

        grouped[key].push(transaction);

    });

    return grouped;

}


/* ==========================================================
                    FORMAT DATE KEY
========================================================== */

export function formatDateKey(dateValue) {

    const date =
        parseLocalDate(dateValue);

    if (
        !date ||
        Number.isNaN(date.getTime())
    ) {

        return "";

    }

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(date.getDate())
            .padStart(2, "0");

    return `${year}-${month}-${day}`;

}


/* ==========================================================
                    SAFE LOCAL DATE PARSER
========================================================== */

function parseLocalDate(value) {

    if (value instanceof Date) {

        return new Date(
            value.getFullYear(),
            value.getMonth(),
            value.getDate()
        );

    }

    if (typeof value === "string") {

        /*
            Handles database dates such as:

            2026-07-29
            2026-07-29T00:00:00
            2026-07-29T00:00:00+00:00

            We intentionally extract YYYY-MM-DD instead
            of relying entirely on timezone conversion.
        */

        const match =
            value.match(
                /^(\d{4})-(\d{2})-(\d{2})/
            );

        if (match) {

            return new Date(
                Number(match[1]),
                Number(match[2]) - 1,
                Number(match[3])
            );

        }

    }

    return new Date(value);

}