/* ==========================================================================
   js/ai/agentClient.js

   Frontend client for the agentic AI endpoint.
   Drop this file into js/ai/ and import askAgent() from your chat UI.
   ========================================================================== */

const API_BASE_URL = "http://localhost:5000/api";
// For local development use:
// const API_BASE_URL = "http://localhost:5000/api";

/* =====================================================
            ASK THE AGENT
===================================================== */

/**
 * Send a message to the FinTack agent.
 *
 * @param {string} message  - what the user typed
 * @param {string|null} chatId - current chat id, so history is saved
 * @returns {Promise<{success: boolean, answer: string, toolsUsed: string[]}>}
 */
export async function askAgent(message, chatId = null) {
    const token = localStorage.getItem("token");

    if (!token) {
        return {
            success: false,
            answer: "Please log in to use FinTack AI.",
            toolsUsed: []
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/agent/ask`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            // No user_id is sent. The backend derives it from the JWT - the
            // browser is never allowed to say which user it is.
            body: JSON.stringify({
                message,
                chat_id: chatId
            })
        });

        const data = await response.json();

        if (response.status === 401) {
            return {
                success: false,
                answer: "Your session expired. Please log in again.",
                toolsUsed: []
            };
        }

        if (!response.ok || !data.success) {
            return {
                success: false,
                answer:
                    data.message ||
                    "FinTack AI is unavailable right now. Please try again.",
                toolsUsed: []
            };
        }

        return {
            success: true,
            answer: data.answer,
            toolsUsed: data.toolsUsed || []
        };
    } catch (error) {
        console.error("askAgent error:", error);

        return {
            success: false,
            answer: "Could not reach FinTack AI. Check your connection.",
            toolsUsed: []
        };
    }
}

/* =====================================================
            REFRESH THE UI AFTER A WRITE
===================================================== */

/**
 * The agent can add, edit or delete transactions and goals. When it does,
 * the dashboard on screen is stale. Call this after every reply to refresh
 * only when something actually changed.
 *
 * Wire the callbacks to whatever your app already uses to reload data.
 */
export function refreshIfDataChanged(toolsUsed = [], handlers = {}) {
    const writeTools = [
        "add_transaction",
        "update_transaction",
        "delete_transaction",
        "add_goal",
        "update_goal",
        "delete_goal",
        "add_savings_to_goal"
    ];

    const changed = toolsUsed.some(tool => writeTools.includes(tool));

    if (!changed) {
        return false;
    }

    const touchedTransactions = toolsUsed.some(t => t.includes("transaction"));
    const touchedGoals = toolsUsed.some(t => t.includes("goal"));

    if (touchedTransactions && typeof handlers.onTransactions === "function") {
        handlers.onTransactions();
    }

    if (touchedGoals && typeof handlers.onGoals === "function") {
        handlers.onGoals();
    }

    return true;
}

/* =====================================================
            OPTIONAL - "checked X" footer
===================================================== */

const TOOL_LABELS = {
    get_stock_price: "stock prices",
    get_currency_rate: "currency rates",
    get_gold_price: "gold price",
    get_fuel_price: "fuel prices",
    web_search: "the web",
    search_financial_knowledge: "FinTack knowledge base",
    get_spending_summary: "your spending",
    get_category_spending: "your category spending",
    get_top_spending_categories: "your top categories",
    find_recurring_expenses: "your recurring charges",
    get_financial_snapshot: "your financial snapshot",
    list_transactions: "your transactions",
    list_goals: "your goals"
};

export function describeToolsUsed(toolsUsed = []) {
    const labels = toolsUsed
        .map(tool => TOOL_LABELS[tool])
        .filter(Boolean);

    if (!labels.length) {
        return "";
    }

    return `Checked: ${[...new Set(labels)].join(", ")}`;
}
