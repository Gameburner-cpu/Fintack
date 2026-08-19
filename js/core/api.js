/* ==========================================================================
   js/core/api.js
   Every network call the app makes, in one place.

   All requests go through apiFetch (js/core/config.js) so they carry the
   JWT, share error handling and resolve against a single configurable
   origin.
========================================================================== */

import { apiFetch, API_ORIGIN } from "./config.js";
import NotificationManager from "../notification/notificationManager.js";

/* =====================================================
                    DASHBOARD
===================================================== */

export async function fetchDashboardData() {
    const { ok, data } = await apiFetch("/api/dashboard");

    if (!ok) {
        console.warn("[FinTack] Dashboard unavailable:", data.message);
        return { success: false, message: data.message };
    }

    return data;
}

/* =====================================================
                USER TRANSACTIONS
===================================================== */

/**
 * @param {string} userId
 * @param {object} filters { from, to, type, category, search, limit, offset }
 */
export async function fetchTransactions(userId, filters = {}) {
    if (!userId) return [];

    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            params.append(key, value);
        }
    });

    const query = params.toString();

    const { ok, data } = await apiFetch(
        `/api/transactions/${userId}${query ? `?${query}` : ""}`
    );

    if (!ok) {
        console.error("[FinTack] Transaction fetch failed:", data.message);
        return [];
    }

    return data.transactions || [];
}

export async function fetchTransactionAnalytics(userId) {
    const { ok, data } = await apiFetch(`/api/transactions/${userId}/analytics`);
    return ok ? data.summary : null;
}

/* =====================================================
                ADD TRANSACTION
===================================================== */

export async function addTransaction(transaction) {
    const userId = transaction.user_id || transaction.userId;

    const payload = {
        user_id: userId,
        title: transaction.title || transaction.description || "Transaction",
        amount: Number(transaction.amount),
        type: String(transaction.type || "expense").toLowerCase(),
        category: transaction.category || "Other",
        date: transaction.date,
        description: transaction.description
    };

    const { ok, data } = await apiFetch("/api/transactions", {
        method: "POST",
        body: payload
    });

    if (ok && userId) {
        notifyTransaction(userId, data.transaction || payload, "added");
    }

    return data;
}

/* =====================================================
                UPDATE TRANSACTION
===================================================== */

/**
 * Partial update - only send the fields that changed.
 * @param {string} id
 * @param {object} updates { title, amount, category, date, type, description }
 */
export async function updateTransaction(id, updates) {
    if (!id) {
        return { success: false, message: "Transaction id is required." };
    }

    const payload = {};

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.amount !== undefined) payload.amount = Number(updates.amount);
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.date !== undefined) payload.date = updates.date;
    if (updates.description !== undefined) payload.description = updates.description;

    if (updates.type !== undefined) {
        payload.type = String(updates.type).toLowerCase();
    }

    const { ok, data } = await apiFetch(`/api/transactions/${id}`, {
        method: "PUT",
        body: payload
    });

    if (ok) {
        const user = JSON.parse(localStorage.getItem("user") || "null");

        if (user?.id) {
            notifyTransaction(user.id, data.transaction, "updated");
        }
    }

    return data;
}

/* =====================================================
                DELETE TRANSACTION
===================================================== */

export async function deleteTransaction(id) {
    if (!id) {
        return { success: false, message: "Transaction id is required." };
    }

    const { data } = await apiFetch(`/api/transactions/${id}`, {
        method: "DELETE"
    });

    return data;
}

/* =====================================================
                    USER GOALS
===================================================== */

export async function fetchGoals(userId) {
    if (!userId) return [];

    const { ok, data } = await apiFetch(`/api/goals/${userId}`);

    if (!ok) {
        console.error("[FinTack] Goal fetch failed:", data.message);
        return [];
    }

    return data.goals || [];
}

export async function createGoal(goal) {
    const { data } = await apiFetch("/api/goals", {
        method: "POST",
        body: goal
    });

    return data;
}

export async function updateGoal(id, updates) {
    const { data } = await apiFetch(`/api/goals/${id}`, {
        method: "PUT",
        body: updates
    });

    return data;
}

export async function addGoalSavings(id, amount) {
    const { data } = await apiFetch(`/api/goals/${id}/savings`, {
        method: "PUT",
        body: { amount: Number(amount) }
    });

    return data;
}

export async function deleteGoal(id) {
    const { data } = await apiFetch(`/api/goals/${id}`, {
        method: "DELETE"
    });

    return data;
}

/**
 * AI investment plan for a goal.
 * @param {string} goalId
 * @param {object} options { riskTolerance, monthlyIncome, monthlyExpense }
 */
export async function fetchInvestmentPlan(goalId, options = {}) {
    const { data } = await apiFetch(`/api/goals/${goalId}/investment-plan`, {
        method: "POST",
        body: options
    });

    return data;
}

/* =====================================================
                    AUTHENTICATION
===================================================== */

export async function login(email, password) {
    const { data } = await apiFetch("/auth/login", {
        method: "POST",
        skipAuth: true,
        body: { email, password }
    });

    return data;
}

export async function signup(full_name, email, password) {
    const { data } = await apiFetch("/auth/signup", {
        method: "POST",
        skipAuth: true,
        body: { full_name, email, password }
    });

    return data;
}

/* ---------------- Password reset ---------------- */

export async function requestPasswordReset(email) {
    const { data } = await apiFetch("/auth/forgot-password", {
        method: "POST",
        skipAuth: true,
        body: { email }
    });

    return data;
}

export async function verifyResetOtp(email, otp) {
    const { data } = await apiFetch("/auth/verify-otp", {
        method: "POST",
        skipAuth: true,
        body: { email, otp }
    });

    return data;
}

export async function resetPassword(resetToken, password, confirmPassword) {
    const { data } = await apiFetch("/auth/reset-password", {
        method: "POST",
        skipAuth: true,
        body: { resetToken, password, confirmPassword }
    });

    return data;
}

/* =====================================================
                    AI ASSISTANT
===================================================== */

/**
 * @param {string} message
 * @param {Array}  history [{ role, content }] - last few turns for context
 */
export async function askAI(message, history = []) {
    const { data } = await apiFetch("/api/ai/ask", {
        method: "POST",
        body: { message, history }
    });

    return data;
}

/* =====================================================
                    NOTIFICATIONS
===================================================== */

function notifyTransaction(userId, transaction, verb) {
    try {
        if (!transaction) return;

        const amount = Number(transaction.amount) || 0;
        const type = String(transaction.type || "").toLowerCase();
        const title = transaction.title || transaction.category || "Transaction";

        const isIncome = type === "income";

        NotificationManager.create(userId, {
            type: isIncome ? "income" : "expense",
            title: `${isIncome ? "Income" : "Expense"} ${verb}`,
            message:
                verb === "updated"
                    ? `${title} is now ₹${amount.toLocaleString("en-IN")}`
                    : isIncome
                        ? `₹${amount.toLocaleString("en-IN")} received from ${title}`
                        : `₹${amount.toLocaleString("en-IN")} spent on ${title}`,
            icon: isIncome ? "fa-solid fa-arrow-trend-up" : "fa-solid fa-wallet",
            data: { transaction }
        });
    } catch (err) {
        console.warn("[FinTack] Notification failed:", err);
    }
}

export { API_ORIGIN };
