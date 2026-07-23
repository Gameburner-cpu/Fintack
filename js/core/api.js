/* ==========================================================================
   js/api.js - Handles network requests and data fetching
   ========================================================================== */

const API_BASE_URL = "https://fintack.onrender.com/api";

/* =====================================================
                    DASHBOARD
===================================================== */
async function fetchDashboardData() {
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
async function fetchTransactions(userId) {
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
async function fetchGoals(userId) {
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
async function addTransaction(transaction) {
    try {
        const response = await fetch(`${API_BASE_URL}/transactions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(transaction)
        });
        return await response.json();
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