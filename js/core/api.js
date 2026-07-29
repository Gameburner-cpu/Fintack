/* ==========================================================================
   js/api.js - Handles network requests and data fetching
   ========================================================================== */

const API_BASE_URL = "https://fintack.onrender.com/api";

import NotificationManager from "../notification/notificationManager.js";

/* =====================================================
                    DASHBOARD
===================================================== */
export async function fetchDashboardData() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard`);
        if (!response.ok) {
            throw new Error("Failed to fetch dashboard");
        }
        return await response.json();
    } catch (error) {
        console.warn("Dashboard API unavailable. Using mock data.", error);
        return getMockData();
    }
}

/* =====================================================
                USER TRANSACTIONS
===================================================== */
export async function fetchTransactions(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/transactions/${userId}`);
        if (!response.ok) {
            throw new Error("Failed to fetch transactions");
        }
        const result = await response.json();
        return result.transactions || [];
    } catch (error) {
        console.error("Transaction Fetch Error:", error);
        return [];
    }
}

/* =====================================================
                    USER GOALS
===================================================== */
export async function fetchGoals(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/goals/${userId}`);
        if (!response.ok) {
            throw new Error("Failed to fetch goals");
        }
        const result = await response.json();
        return result.goals || [];
    } catch (error) {
        console.error("Goal Fetch Error:", error);
        return [];
    }
}

/* =====================================================
                ADD TRANSACTION
===================================================== */
export async function addTransaction(transaction) {
    try {
        
        console.log("🔔 ADD TRANSACTION INPUT:", transaction);

        const response = await fetch(`${API_BASE_URL}/transactions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(transaction)
        });

        const result = await response.json();

        /* =================================================
                    CREATE NOTIFICATION
        ================================================= */
        if (response.ok && result.success !== false) {
            const userId = transaction.userId || transaction.user_id;

            if (userId) {
                const amount = Number(transaction.amount) || 0;
                const type = String(transaction.type || "").toLowerCase();
                const title = transaction.title || transaction.description || transaction.category || "Transaction";

                if (type === "income") {
                    NotificationManager.create(userId, {
                        type: "income",
                        title: "Income Added",
                        message: `₹${amount.toLocaleString("en-IN")} received from ${title}`,
                        icon: "fa-solid fa-arrow-trend-up",
                        data: {
                            transaction
                        }
                    });
                } else if (type === "expense") {
                    NotificationManager.create(userId, {
                        type: "expense",
                        title: "Expense Added",
                        message: `₹${amount.toLocaleString("en-IN")} spent on ${title}`,
                        icon: "fa-solid fa-wallet",
                        data: {
                            transaction
                        }
                    });
                }
            }
        }

        return result;

    } catch (error) {
        console.error("Add Transaction Error:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/* =====================================================
                    MOCK DATA
===================================================== */
function getMockData() {
    return {
        success: true,
        summary: {
            balance: 328000,
            netWorth: 452000,
            monthlySavings: 25000,
            income: 37000,
            expenses: 12450
        },
        stocks: [
            {
                ticker: "AAPL",
                price: "$189.43",
                change: "+1.24%",
                isPositive: true,
                description: "Tech giant unveils new AI-driven silicon chips."
            },
            {
                ticker: "MSFT",
                price: "$412.15",
                change: "+0.85%",
                isPositive: true,
                description: "Cloud revenue surpasses analyst expectations."
            },
            {
                ticker: "TSLA",
                price: "$175.22",
                change: "-2.10%",
                isPositive: false,
                description: "Production delays impact quarterly delivery numbers."
            }
        ],
        news: [
            {
                category: "Market Analysis",
                icon: "fa-solid fa-arrow-trend-up",
                title: "GLOBAL EQUITIES RALLY ON MILD INFLATION DATA",
                excerpt: "Major indices gained after lower inflation data.",
                time: "10:30 AM"
            },
            {
                category: "AI Summary",
                icon: "fa-solid fa-microchip",
                title: "SECTOR ROTATION ACCELERATES",
                excerpt: "Institutional investors continue moving into defensive sectors.",
                time: "09:15 AM"
            }
        ]
    };
}