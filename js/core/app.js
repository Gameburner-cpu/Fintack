/* ==========================================================
                    FINTACK APP.JS
========================================================== */

import {
    fetchDashboardData,
    fetchTransactions,
    fetchGoals,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    login as apiLogin,
    signup as apiSignup,
    requestPasswordReset,
    verifyResetOtp,
    resetPassword
} from "./api.js";

import {
    API_ORIGIN,
    clearSession,
    getCurrentUser
} from "./config.js";

import Analytics, {
    buildSummary,
    formatMoney as fmtCurrency,
    invalidateAnalyticsCache
} from "./analytics.js";
import Calendar from "../calendar/calendar.js";
import NotificationUI from "../notification/notificationUI.js";
import NotificationManager from "../notification/notificationManager.js";
import {
    renderStocks,
    renderNews,
    renderTransactions,
    renderGoals,
    updateDashboard,
    updateGoalSummary
} from "./ui.js";
import CalendarUI from "../calendar/calendarUI.js";
import Navigation from "./navigation.js";
import { askAgent, refreshIfDataChanged, describeToolsUsed } from "../ai/agentClient.js";
import AIStorage from "../ai/aiStorage.js";
import {
    getCalendarTransactions,
    getTransactionsForDate,
    calculateDailyTotals,
    groupTransactionsByDate
} from "../calendar/calendarAPI.js";

document.addEventListener("DOMContentLoaded", async () => {
    /* ======================================================
                            DOM ELEMENTS
    ====================================================== */
    const savingsModal = document.getElementById("savings-modal");
    const savingsForm = document.getElementById("savings-form");
    const savingAmount = document.getElementById("saving-amount");
    
    const editGoalModal = document.getElementById("edit-goal-modal");
    const editGoalForm = document.getElementById("edit-goal-form");
    const editGoalTitle = document.getElementById("edit-goal-title");
    const editGoalTarget = document.getElementById("edit-goal-target");
    const editGoalDeadline = document.getElementById("edit-goal-deadline");
    
    const addGoalBtn = document.getElementById("add-goal-btn");
    const goalModal = document.getElementById("goal-modal");
    const goalForm = document.getElementById("goal-form");
    const goalTitle = document.getElementById("goal-title");
    const goalTarget = document.getElementById("goal-target");
    const goalDeadline = document.getElementById("goal-deadline");

    const loginModal = document.getElementById("login-modal");
    const loginForm = document.getElementById("login-form");
    const fullnameInput = document.getElementById("fullname");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const logoutBtn = document.getElementById("logout-btn");

    const navItems = document.querySelectorAll(".bottom-nav .nav-item");
    const pages = document.querySelectorAll(".view-section");

    const fabContainer = document.getElementById("fab-container");
    const mainFab = document.getElementById("main-add-btn");
    const fabIncome = document.getElementById("fab-income");
    const fabExpense = document.getElementById("fab-expense");

    const transactionModal = document.getElementById("transaction-modal");
    const transactionTitle = document.getElementById("transaction-title-text");
    const transactionForm = document.getElementById("transaction-form");
    const transactionNameInput = document.getElementById("transaction-name");
    const transactionAmountInput = document.getElementById("transaction-amount");
    const transactionCategoryInput = document.getElementById("transaction-category");
    const transactionDateInput = document.getElementById("transaction-date");

    const expenseManager = document.getElementById("expenses-manager");
    const openExpenseBtn = document.getElementById("btn-expenses");
    const closeExpenseBtn = document.getElementById("close-expenses");
    const budgetForm = document.getElementById("budget-setup-form");
    
    // Budget DOM Elements
    const budgetIncomeInput = document.getElementById("budget-income");
    const budgetSavingsInput = document.getElementById("budget-savings");
    const todaysTransactionsList = document.getElementById("todays-transactions");
    const monthSpentEl = document.getElementById("month-spent");
    const monthRemainingEl = document.getElementById("month-remaining");
    const dailyAllowanceEl = document.getElementById("daily-allowance");
    const budgetPercentEl = document.getElementById("budget-percent");
    const budgetProgressFill = document.getElementById("budget-progress-fill");
    
    // Goals Planner Elements
    const goalCards = document.querySelectorAll(".goal-card");
    const plannerView = document.getElementById("goal-planner");
    const plannerTitle = document.getElementById("planner-title");
    const closePlanner = document.getElementById("close-planner");
    const plannerForm = document.getElementById("planner-form");
    const planTarget = document.getElementById("plan-target");
    const planIncome = document.getElementById("plan-income");
    const planDuration = document.getElementById("plan-duration");
    const planResults = document.getElementById("plan-results");
    const resMonthSave = document.getElementById("res-month-save");
    const resWeekSave = document.getElementById("res-week-save");
    const resDaySave = document.getElementById("res-day-save");
    const resMonthSpend = document.getElementById("res-month-spend");
    const resWeekSpend = document.getElementById("res-week-spend");
    const resDaySpend = document.getElementById("res-day-spend");

    // AI Chat Elements
    const aiSearchInput = document.getElementById("ai-search-input");
    const aiHistoryModal = document.getElementById("ai-history-modal");
    const closeHistory = document.getElementById("close-history");
    const historyList = document.getElementById("history-list");
    const newChatBtn = document.getElementById("new-chat-btn");
    const aiHistoryBtn = document.getElementById("ai-history-btn");
    const aiOptimizeBtn = document.getElementById("ai-optimize-btn");
    const aiModal = document.getElementById("ai-chat-modal");
    const aiInput = document.getElementById("ai-chat-input");
    const aiSend = document.getElementById("ai-send-btn");
    const closeAI = document.getElementById("close-ai-chat"); 
    const aiChatBody = document.getElementById("ai-chat-body");

    // Filter DOM Element
    const transactionFilter = document.getElementById("transaction-filter");

    /* ======================================================
                    STATE VARIABLES & INSTANCES
    ====================================================== */
    let selectedGoalId = null;
    let editingGoalId = null;
    let transactionType = "expense";
    let isLogin = true;
    let currentChatId = localStorage.getItem("currentChatId") || null;
    let isDashboardInitialized = false;
    let currentTransactionFilter = "30"; // Default filter from HTML

    /*
        Cached copies of the last synced dataset. The edit modal and the
        chatbot both need to look up a transaction by id without refetching.
    */
    let currentTransactions = [];
    let currentGoals = [];

    let expenseChartInst = null;
    let portfolioChartInst = null;
    let incomeChartInst = null;

    let budget = JSON.parse(localStorage.getItem("budget_data")) || {
        income: 0,
        savings: 0
    };

    let token = localStorage.getItem("token");
    let user = JSON.parse(localStorage.getItem("user"));

    /* ======================================================
                    INITIALIZATION & AUTH
    ====================================================== */
    if (token && user) {
        if (loginModal) loginModal.classList.add("hidden");
        updateNodeValue("profile-name", user.full_name);
        updateNodeValue("profile-tier", "Premium Member");
        await initializeDashboard(user.id);

        /* ==========================================================
                CALENDAR ENGINE TEST
        ========================================================== */

        await Calendar.initialize(user.id);

        /* ==========================================================
                        NOTIFICATION SYSTEM
        ========================================================== */
        NotificationUI.initialize(user.id);
        console.log(
            "🔔 NOTIFICATION SYSTEM INITIALIZED");

        const notificationButton =
            document.getElementById("notificationButton");
        const notificationClose =
            document.getElementById("notificationClose");
        const notificationOverlay =
            document.getElementById("notificationOverlay");
        const notificationModal =
            document.getElementById("notificationModal");
        const notificationMarkAll =
            document.getElementById("notificationMarkAll");
        const notificationClearAll =
            document.getElementById("notificationClearAll");

        /* ==========================================================
                        OPEN NOTIFICATIONS
        ========================================================== */
        notificationButton?.addEventListener(
            "click",
            () => {
                NotificationUI.open();
            }
        );

        /* ==========================================================
                        CLOSE BUTTON
        ========================================================== */
        notificationClose?.addEventListener(
            "click",
            () => {
                NotificationUI.close();
            }
        );

        /* ==========================================================
                        CLICK OUTSIDE TO CLOSE
        ========================================================== */
        notificationOverlay?.addEventListener(
            "click",
            () => {
                NotificationUI.close();
            }
        );

        notificationModal?.addEventListener(
            "click",
            (event) => {
                event.stopPropagation();
            }
        );

        /* ==========================================================
                        MARK ALL AS READ
        ========================================================== */
        notificationMarkAll?.addEventListener(
            "click",
            () => {
                NotificationUI.markAllAsRead();
            }
        );

        /* ==========================================================
                        CLEAR ALL
        ========================================================== */
        notificationClearAll?.addEventListener(
            "click",
            () => {
                NotificationUI.clearAll();
            }
        );

        console.log("🗓️ CALENDAR ENGINE STATE:", Calendar.getCalendarState());
        console.log("🗓️ CALENDAR DAYS:", Calendar.getCalendarDays());
        console.log("🗓️ SELECTED DAY:", Calendar.getSelectedDayData());
        console.log("🗓️ CURRENT MONTH:", Calendar.getCurrentMonthData());

        const calendarTestTransactions = await getCalendarTransactions(user.id);

        console.log("📅 CALENDAR TEST - ALL:", calendarTestTransactions);
        console.log("📅 CALENDAR TEST - GROUPED:", groupTransactionsByDate(calendarTestTransactions));

        const todayCalendarTransactions = getTransactionsForDate(calendarTestTransactions, new Date());

        console.log("📅 CALENDAR TEST - TODAY:", todayCalendarTransactions);
        console.log("📅 CALENDAR TEST - TODAY TOTAL:", calculateDailyTotals(todayCalendarTransactions));
    } else {
        if (loginModal) loginModal.classList.remove("hidden");
    }

    const savedUser = localStorage.getItem("fintack_user");
    if (savedUser && (!token || !user)) {
        updateNodeValue("profile-name", savedUser);
    }

    /* ======================================================
                    CORE DATA PROCESSING
    ====================================================== */

    /*
        All aggregation now lives in js/core/analytics.js, shared with the
        chatbot and mirrored on the server, so the dashboard, the AI answers
        and the API can no longer disagree.

        Bugs this replaced:
          - any transaction whose type was not exactly "income" counted as an
            expense, so null/typo types inflated spending
          - monthly chart buckets were matched by month LABEL, which collided
            across years
          - rows with unparseable dates or non-numeric amounts silently became
            NaN and poisoned every total
    */
    function processFinancialData(transactions) {
        return buildSummary(transactions);
    }

    function updateNodeValue(id, value) {
        const el = document.getElementById(id);
        if (el && value !== undefined && value !== null) {
            el.textContent = value;
            el.classList.remove("loading-value");
        }
    }

    function populateDynamicUI(summary, goalsLength = 0, goals = []) {
        if (!summary) return;

        const fmtMoney = (val) => window.formatMoney ? window.formatMoney(val) : "₹" + Number(val || 0).toLocaleString("en-IN");
        
        // HOME DASHBOARD
        updateNodeValue("net-worth", fmtMoney(summary.netWorth));
        updateNodeValue("monthly-saving", fmtMoney(summary.monthlySavings));
        
        // ANALYSIS DASHBOARD
        updateNodeValue("analysis-networth", fmtMoney(summary.netWorth));
        // Allocate an estimated 45% of net worth to investments naturally for UI completion
        updateNodeValue("analysis-investments", fmtMoney((summary.netWorth || 0) * 0.45)); 
        updateNodeValue("analysis-savings", fmtMoney(summary.monthlySavings));
        updateNodeValue("analysis-expenses", fmtMoney(summary.monthlyExpense));
        
        // PROFILE DASHBOARD
        updateNodeValue("profile-income", fmtMoney(summary.monthlyIncome));
        updateNodeValue("profile-saving", fmtMoney(summary.monthlySavings));
        updateNodeValue("profile-goals", goalsLength.toString());
        updateNodeValue("profile-reports", "12");

        const goalProgress = document.getElementById("goal-progress");
        const goalBar = document.getElementById("goal-progress-bar");
        
        if (goalProgress && goalBar) {
            const income = Number(summary.monthlyIncome) || 0;
            const savings = Number(summary.monthlySavings) || 0;
            const progress = income > 0 ? Math.max(0, Math.round((savings / income) * 100)) : 0;
            
            goalProgress.textContent = progress + "%";
            goalProgress.classList.remove("loading-value");
            goalBar.style.width = Math.min(progress, 100) + "%";
        }

        updateAIHealth(summary);
        updateSpendingCategories(summary.categoryTotals);
        updateAchievements(summary, goals);
    }

    function updateAIHealth(summary) {
        const scoreEl = document.getElementById("ai-health-score");
        const statusEl = document.getElementById("ai-health-status");
        const msgEl = document.getElementById("ai-health-message");
        const insightsEl = document.getElementById("ai-insights");
        
        if(!scoreEl) return;
        
        if (summary.monthlyIncome <= 0 && summary.monthlyExpense <= 0) {
            scoreEl.textContent = "0";
            statusEl.textContent = "No Data";
            msgEl.textContent = "Add income and expenses to generate your health score.";
            if(insightsEl) insightsEl.innerHTML = "<p>Add transactions to unlock AI insights.</p>";
            return;
        }
        
        const savingsRate = summary.monthlyIncome > 0 ? (summary.monthlySavings / summary.monthlyIncome) * 100 : -100;
        let score = 50;
        let status = "";
        let msg = "";
        
        if (savingsRate >= 20) {
            score = Math.min(98, 70 + savingsRate);
            status = "Excellent";
            msg = "Your savings rate is above optimal levels. Keep accelerating wealth growth!";
        } else if (savingsRate >= 10) {
            score = 60 + savingsRate;
            status = "Good";
            msg = "You're on the right track. Try pushing your savings closer to 20%.";
        } else if (savingsRate > 0) {
            score = 40 + savingsRate;
            status = "Fair";
            msg = "You are saving, but a higher rate will protect against unexpected expenses.";
        } else {
            score = Math.max(10, 40 + savingsRate); 
            status = "Needs Attention";
            msg = "Your expenses exceed your income this month. Please review your budget.";
        }
        
        scoreEl.textContent = Math.round(score);
        statusEl.textContent = status;
        msgEl.textContent = msg;
        
        if (insightsEl) {
            insightsEl.innerHTML = `
                <div style="background: rgba(88,166,255,0.1); padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 4px solid var(--accent-blue);">
                    <strong><i class="fa-solid fa-lightbulb" style="color:var(--accent-blue);"></i> FinTack AI Insight</strong>
                    <p style="margin-top:8px; font-size:14px; color:#d1d5db; line-height:1.5;">${msg} You spent ₹${summary.monthlyExpense.toLocaleString("en-IN")} this month so far.</p>
                </div>
            `;
        }
    }

    function updateSpendingCategories(categoryTotals) {
        const container = document.getElementById("spending-categories-container");
        if (!container) return;
        
        const categories = Object.keys(categoryTotals).sort((a,b) => categoryTotals[b] - categoryTotals[a]);
        
        if (categories.length === 0) {
            container.innerHTML = "No expenses recorded.";
            return;
        }
        
        container.innerHTML = categories.map(cat => `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; padding-bottom:12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; align-items:center; gap: 10px;">
                    <div style="width:32px; height:32px; border-radius:8px; background:rgba(88,166,255,0.1); color:var(--accent-blue); display:flex; align-items:center; justify-content:center;">
                        <i class="fa-solid fa-tag"></i>
                    </div>
                    <span>${cat}</span>
                </div>
                <strong>₹${categoryTotals[cat].toLocaleString("en-IN")}</strong>
            </div>
        `).join("");
    }

    function updateAchievements(summary, goals) {
        const container = document.getElementById("achievements-container");
        if (!container) return;
        
        let badges = [];
        if (summary.monthlySavings > 10000) badges.push({icon: "fa-star", text: "Super Saver", color: "#ffb84d"});
        if (goals.length >= 3) badges.push({icon: "fa-bullseye", text: "Goal Setter", color: "#3ddc97"});
        if (summary.monthlyIncome > 0 && summary.monthlyExpense === 0) badges.push({icon: "fa-leaf", text: "Zero Spend Day", color: "#00d26a"});
        if (summary.netWorth > 100000) badges.push({icon: "fa-crown", text: "1L Club", color: "#9b51e0"});
        
        if (badges.length === 0) badges.push({icon: "fa-seedling", text: "Starter", color: "#58a6ff"});
        
        container.innerHTML = badges.map(b => `
            <div style="display:inline-block; margin-right:15px; margin-bottom:15px; text-align:center;">
                <div style="width:50px; height:50px; border-radius:25px; background:rgba(255,255,255,0.05); color:${b.color}; display:flex; align-items:center; justify-content:center; font-size:24px; margin: 0 auto 8px auto;">
                    <i class="fa-solid ${b.icon}"></i>
                </div>
                <span style="font-size:12px; color:#8d97a5;">${b.text}</span>
            </div>
        `).join("");
    }

    /* ======================================================
                    DAILY STOCK NEWS
    ====================================================== */

    async function loadDailyStockNews() {
        const stockContainer = document.getElementById("stock-container");
        if (!stockContainer) return;

        stockContainer.innerHTML = `
            <div class="placeholder-card">
                <span class="loading-value">Loading latest stock news...</span>
            </div>
        `;

        try {
            const response = await fetch(
                `${API_ORIGIN}/api/news/daily?symbols=AAPL,MSFT,NVDA&limit=10`
            );

            if (!response.ok) {
                throw new Error(`News request failed with status ${response.status}`);
            }

            const result = await response.json();
            const articles = Array.isArray(result?.articles)
                ? result.articles
                : [];

            if (!result?.success || articles.length === 0) {
                stockContainer.innerHTML = `
                    <div class="placeholder-card">
                        <span>No stock news available right now.</span>
                    </div>
                `;
                return;
            }

            stockContainer.innerHTML = "";

            articles.forEach(article => {
                const card = document.createElement("article");
                card.className = "stock-news-card";

                const publishedDate = article.publishedAt
                    ? new Date(article.publishedAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                    })
                    : "";

                const image = article.image
                    ? `
                        <img
                            src="${escapeHTML(article.image)}"
                            alt=""
                            loading="lazy"
                            referrerpolicy="no-referrer"
                            onerror="this.style.display='none'"
                            style="width:100%;height:140px;object-fit:cover;border-radius:10px;margin-bottom:12px;"
                        >
                    `
                    : "";

                card.innerHTML = `
                    ${image}

                    <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:8px;">
                        <span style="font-size:12px;color:var(--accent-blue);font-weight:700;">
                            ${escapeHTML(article.symbol || article.related || "MARKET")}
                        </span>

                        <span style="font-size:11px;color:#8d97a5;">
                            ${escapeHTML(publishedDate)}
                        </span>
                    </div>

                    <h3 style="font-size:15px;line-height:1.4;margin-bottom:8px;">
                        ${escapeHTML(article.headline || "Stock Market Update")}
                    </h3>

                    <p style="font-size:13px;line-height:1.5;color:#8d97a5;margin-bottom:12px;">
                        ${escapeHTML(
                            article.summary
                                ? article.summary.slice(0, 180) +
                                  (article.summary.length > 180 ? "..." : "")
                                : `Latest market coverage from ${article.source || "Finnhub"}.`
                        )}
                    </p>

                    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                        <small style="color:#8d97a5;">
                            ${escapeHTML(article.source || "Market News")}
                        </small>

                        ${
                            article.url
                                ? `
                                    <a
                                        href="${escapeHTML(article.url)}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style="color:var(--accent-blue);font-size:13px;font-weight:700;text-decoration:none;"
                                    >
                                        Read More
                                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                    </a>
                                `
                                : ""
                        }
                    </div>
                `;

                stockContainer.appendChild(card);
            });

            console.log(
                `[FinTack News] Loaded ${articles.length} daily stock news articles.`
            );

        } catch (error) {
            console.error("[FinTack News] Failed to load daily stock news:", error);

            stockContainer.innerHTML = `
                <div class="placeholder-card">
                    <span>Unable to load stock news right now.</span>
                </div>
            `;
        }
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    async function initializeDashboard(userId) {
        if (isDashboardInitialized || !userId) return;

        await syncDataAndUpdateUI(userId);

        try {
            // Live daily stock news from the Finnhub backend route.
            await loadDailyStockNews();
        } catch (err) {
            console.warn("[FinTack] Daily news unavailable:", err);
        }

        isDashboardInitialized = true;
    }

    function getFilteredTransactions() {
        if (!currentTransactions) return [];
        if (currentTransactionFilter === "all") return currentTransactions;
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(currentTransactionFilter, 10));
        
        return currentTransactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transactionDate >= cutoffDate;
        });
    }

    /*
        Single render path for the dashboard. initializeDashboard, the
        calendar sync, the chatbot and the edit modal all call this, so
        every surface updates from one dataset instead of three slightly
        different fetch-and-render blocks.
    */
    async function syncDataAndUpdateUI(userIdOverride) {
        const userId = userIdOverride || user?.id;

        if (!userId) return;

        try {
            invalidateAnalyticsCache();

            const [transactions, goals] = await Promise.all([
                fetchTransactions(userId),
                fetchGoals(userId)
            ]);

            currentTransactions = Array.isArray(transactions) ? transactions : [];
            currentGoals = Array.isArray(goals) ? goals : [];

            const processedData = processFinancialData(currentTransactions);

            renderTransactions(getFilteredTransactions());
            populateDynamicUI(processedData, currentGoals.length, currentGoals);
            updateDashboard(processedData);

            updateNodeValue("active-goals-count", currentGoals.length.toString());
            updateNodeValue("profile-goals", currentGoals.length.toString());

            renderGoals(currentGoals);
            updateGoalSummary(currentGoals);

            attachGoalButtonEvents();
            renderCharts(processedData.chartData, processedData);
            refreshBudget(currentTransactions);
        } catch (error) {
            console.error("[FinTack] Error synchronizing data:", error);
            showToast("Couldn't refresh your dashboard. Pull down to retry.", "error");
        }
    }

    /* ======================================================
                            EVENT LISTENERS
    ====================================================== */

    if (transactionFilter) {
        transactionFilter.addEventListener("change", (e) => {
            currentTransactionFilter = e.target.value;
            renderTransactions(getFilteredTransactions());
        });
    }

    /* ==========================================================
        CALENDAR TRANSACTION → DASHBOARD SYNC
========================================================== */

/* ==========================================================
        DATA CHANGE -> DASHBOARD SYNC

   Fired by the calendar, the chatbot and the edit modal.
========================================================== */

["fintack:transaction-created", "fintack:transactions-changed"].forEach(
    eventName => {
        window.addEventListener(eventName, async (event) => {
            console.log(`[FinTack] ${eventName}`, event.detail);
            await syncDataAndUpdateUI();
        });
    }
);

/* ==========================================================
        SESSION EXPIRY
========================================================== */

window.addEventListener("fintack:session-expired", () => {
    token = null;
    user = null;
    isDashboardInitialized = false;

    const modal = document.getElementById("login-modal");
    if (modal) modal.classList.remove("hidden");

    showToast("Your session expired. Please log in again.", "error");
});

    function activatePage(id) {
        if (!id) return;
        pages.forEach(page => page.classList.remove("active"));
        navItems.forEach(item => item.classList.remove("active"));

        const page = document.getElementById(id);
        if (page) page.classList.add("active");

        const activeBtn = document.querySelector(`.nav-item[data-target="${id}"]`);
        if (activeBtn) activeBtn.classList.add("active");

        const mainContent = document.querySelector(".main-content");
        if (mainContent) mainContent.scrollTop = 0;
    }

    navItems.forEach(item => {
        item.addEventListener("click", function (e) {
            e.preventDefault();
            const target = this.dataset.target;
            if (target) activatePage(target);
        });
    });

    if (mainFab) {
        mainFab.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (fabContainer) fabContainer.classList.toggle("menu-open");
        });
    }

    document.addEventListener("click", (e) => {
        if (fabContainer && fabContainer.classList.contains("menu-open") && !fabContainer.contains(e.target)) {
            fabContainer.classList.remove("menu-open");
        }
    });

    /* ==========================================================
        FAB TRANSACTION CATEGORY OPTIONS
========================================================== */

function populateTransactionCategories(type) {

    if (!transactionCategoryInput) return;

    const incomeCategories = [
        "Salary",
        "Freelance",
        "Business",
        "Investment",
        "Bonus",
        "Gift",
        "Refund",
        "Other"
    ];

    const expenseCategories = [
        "Food",
        "Transport",
        "Shopping",
        "Bills",
        "Entertainment",
        "Health",
        "Education",
        "Fuel",
        "Travel",
        "Rent",
        "Other"
    ];

    const categories =
        type === "income"
            ? incomeCategories
            : expenseCategories;

    transactionCategoryInput.innerHTML = `
        <option value="" disabled selected>
            Select Category
        </option>

        ${categories
            .map(category =>
                `<option value="${category}">${category}</option>`
            )
            .join("")}
    `;
}

    if (fabIncome) {
    fabIncome.addEventListener("click", () => {

        transactionType = "income";

        populateTransactionCategories("income");

        if (transactionTitle)
            transactionTitle.textContent = "Add Income";

        if (transactionModal)
            transactionModal.classList.remove("hidden");

        if (fabContainer)
            fabContainer.classList.remove("menu-open");
    });
}

    if (fabExpense) {
    fabExpense.addEventListener("click", () => {

        transactionType = "expense";

        populateTransactionCategories("expense");

        if (transactionTitle)
            transactionTitle.textContent = "Add Expense";

        if (transactionModal)
            transactionModal.classList.remove("hidden");

        if (fabContainer)
            fabContainer.classList.remove("menu-open");
    });
}

    /* ==========================================================
            CALENDAR BUTTON
    ========================================================== */
    const calendarButton = document.getElementById("calendarButton");

    if (calendarButton) {
        calendarButton.addEventListener("click", async () => {
            console.log("[Calendar] Open requested");
            try {
                if (!window.fintackCalendarUI) {
                    window.fintackCalendarUI = new CalendarUI(Calendar);
                    window.fintackCalendarUI.init();
                }
                await window.fintackCalendarUI.open();
            } catch (error) {
                console.error("[Calendar] Failed to open:", error);
            }
        });
    }

    /* ======================================================
                    AI INTEL CORE ENGINE
    ====================================================== */
    async function loadHistory() {
        if (!user || !user.id || !historyList) return;
        
        try {
            const result = await AIStorage.getChats(user.id);
            
            if (!result || !result.success || !Array.isArray(result.chats) || result.chats.length === 0) {
                historyList.innerHTML = `
                    <div class="history-empty">
                        ${(!result || !result.success) ? 'Unable to load conversations.' : 'No conversations yet.'}
                    </div>
                `;
                return;
            }

            historyList.innerHTML = "";
            
            result.chats.forEach(chat => {
                if (!chat || !chat.id) return;
                
                const item = document.createElement("div");
                item.className = "history-item";
                item.dataset.id = chat.id;
                item.innerHTML = `
                    <div class="history-chat">
                        <i class="fa-solid fa-comments"></i>
                        <span>${chat.title || 'Untitled Conversation'}</span>
                    </div>
                    <button class="delete-chat-btn" data-id="${chat.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
                historyList.appendChild(item);
                
                item.addEventListener("click", () => {
                    currentChatId = chat.id;
                    localStorage.setItem("currentChatId", currentChatId);
                    if (typeof Navigation !== 'undefined' && aiModal) {
                        Navigation.close("ai-history");
                        Navigation.open("ai-chat", aiModal);
                    }
                    loadChat(chat.id);
                });
                
                const deleteBtn = item.querySelector(".delete-chat-btn");
                if (deleteBtn) {
                    deleteBtn.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        if (!confirm("Delete this conversation?")) return;
                        const deleteResult = await AIStorage.deleteChat(chat.id);
                        if (deleteResult && deleteResult.success) {
                            if(currentChatId === chat.id) {
                                currentChatId = null;
                                localStorage.removeItem("currentChatId");
                            }
                            loadHistory();
                        }
                    });
                }
            });
        } catch (error) {
            console.error("[FinTack] AI History Load Error:", error);
            if (historyList) {
                historyList.innerHTML = `<div class="history-empty">Failed to load history.</div>`;
            }
        }
    }

    if (aiHistoryBtn) {
        aiHistoryBtn.addEventListener("click", () => {
            if (typeof Navigation !== 'undefined' && aiHistoryModal) {
                Navigation.open("ai-history", aiHistoryModal);
            }
            loadHistory();
        });
    }

    /* ======================================================
                            NEW CHAT
    ====================================================== */
    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            currentChatId = null;
            localStorage.removeItem("currentChatId");
            
            if (aiChatBody) {
                aiChatBody.innerHTML = "";
            }
            addAIMessage(`👋 Hello! What's on your mind today?`);

            if (typeof Navigation !== "undefined" && aiModal) {
                Navigation.close("ai-history");
                Navigation.open("ai-chat", aiModal);
            }
        });
    }

    async function loadChat(chatId) {
        if (!chatId || !aiChatBody) return;
        
        try {
            const result = await AIStorage.getMessages(chatId);
            if (!result || !result.success || !Array.isArray(result.messages)) return;

            aiChatBody.innerHTML = "";
            
            result.messages.forEach(msg => {
                if (msg.role === "user") {
                    addUserMessage(msg.message);
                } else {
                    addAIMessage(msg.message);
                }
            });
            
            scrollChatToBottom();
        } catch (error) {
            console.error("[FinTack] Chat Load Error:", error);
        }
    }

    if (closeHistory) {
        closeHistory.addEventListener("click", () => {
            if (typeof Navigation !== 'undefined') {
                Navigation.close("ai-history");
            }
        });
    }

    if (aiHistoryModal) {
        aiHistoryModal.addEventListener("click", (e) => {
            if (e.target === aiHistoryModal) {
                if (typeof Navigation !== 'undefined') {
                    Navigation.close("ai-history");
                }
            }
        });
    }

    if (aiSearchInput) {
        aiSearchInput.addEventListener("focus", () => {
            if (aiModal && typeof Navigation !== 'undefined') {
                Navigation.open("ai-chat", aiModal);
            }
            aiSearchInput.blur();
        });

        aiSearchInput.addEventListener("keydown", async (e) => {
            if (e.key !== "Enter") return;
            const question = aiSearchInput.value.trim();
            if (!question) return;

            aiSearchInput.blur();
            aiSearchInput.value = "🤖 FinTack AI is analyzing...";

            try {
                const result = await askAgent(question, currentChatId);
                aiSearchInput.value = "";
                
                showAIResponse(result.answer || "No response generated.");

                // If the agent modified any data, refresh the dashboard
                refreshIfDataChanged(result.toolsUsed, {
                    onTransactions: () => syncDataAndUpdateUI(),
                    onGoals: () => syncDataAndUpdateUI()
                });
            } catch (error) {
                console.error("[FinTack] AI Generation Error:", error);
                aiSearchInput.value = "";
                showToast("Unable to generate an AI response right now.", "error");
            }
        });
    }

    if (closeAI) {
        closeAI.addEventListener("click", () => {
            if (typeof Navigation !== 'undefined') {
                Navigation.close("ai-chat");
            }
        });
    }

    /* ======================================================
                            AI CHAT

       sendChatMessage is shared by the send button, the Enter key and the
       confirmation chips the assistant renders, so all three follow the
       same persistence and rendering path.
    ====================================================== */

    let isAIResponding = false;

    async function sendChatMessage(question) {
        const text = String(question || "").trim();

        if (!text || isAIResponding) return;

        if (!user?.id) {
            addAIMessage("Please log in first so I can access your data.");
            return;
        }

        isAIResponding = true;

        if (aiSend) aiSend.disabled = true;

        try {
            if (!currentChatId) {
                const title = text.length > 40
                    ? `${text.substring(0, 40)}...`
                    : text;

                const initResult = await AIStorage.createChat(user.id, title);

                if (!initResult?.success || !initResult.chat) {
                    showToast("Couldn't start a new conversation.", "error");
                    return;
                }

                currentChatId = initResult.chat.id;
                localStorage.setItem("currentChatId", currentChatId);
            }

            if (aiInput) aiInput.value = "";

            addUserMessage(text);
            showTyping();

            /*
                Persistence is best effort. A failed history write must not
                stop the user getting an answer.
            */
            AIStorage.saveMessage(currentChatId, "user", text).catch(error =>
                console.warn("[FinTack] Couldn't save user message:", error)
            );

            // 1. Call the new agent API
            const result = await askAgent(text, currentChatId);

            hideTyping();

            let storageContent = result.answer || "I'm sorry, I couldn't generate a response.";

            // 2. Render the agent's main answer
            addAIMessage(storageContent);

            // 3. Optional: Show the user which tools the agent used as a footer
            const footer = describeToolsUsed(result.toolsUsed);
            if (footer) {
                const footerHtml = `<div style="font-size: 11px; color: #8d97a5; margin-top: 8px;">
                    <i class="fa-solid fa-wrench"></i> ${footer}
                </div>`;
                addAIMessage(footerHtml);
                storageContent += footerHtml;
            }

            // 4. Refresh UI if the agent mutated data (added/deleted transactions/goals)
            // We use your existing syncDataAndUpdateUI() to reload the views.
            refreshIfDataChanged(result.toolsUsed, {
                onTransactions: () => syncDataAndUpdateUI(),
                onGoals: () => syncDataAndUpdateUI()
            });

            // 5. Save to chat history
            AIStorage.saveMessage(currentChatId, "assistant", storageContent)
                .catch(error =>
                    console.warn("[FinTack] Couldn't save AI message:", error)
                );
        } catch (err) {
            hideTyping();

            addAIMessage(
                "Something went wrong while processing that. Nothing in your " +
                "account has been changed - please try again."
            );

            console.error("[FinTack] AI Chat Flow Error:", err);
        } finally {
            isAIResponding = false;
            if (aiSend) aiSend.disabled = false;
        }
    }

    if (aiSend && aiInput) {
        aiSend.addEventListener("click", () => sendChatMessage(aiInput.value));

        aiInput.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendChatMessage(aiInput.value);
            }
        });
    }

    /*
        The assistant renders "Yes, save it" / "Cancel" chips inside its
        confirmation cards. One delegated listener turns a tap into the
        equivalent typed reply.
    */
    aiChatBody?.addEventListener("click", event => {
        const chip = event.target.closest("[data-ai-reply]");

        if (!chip) return;

        /* Spent chips should not be re-clickable. */
        chip.closest(".ai-card__actions")
            ?.querySelectorAll("[data-ai-reply]")
            .forEach(button => {
                button.disabled = true;
                button.classList.add("is-spent");
            });

        sendChatMessage(chip.dataset.aiReply);
    });

    if (aiOptimizeBtn) {
        /*
            This used to pop an alert claiming an "optimization engine" had
            run - nothing actually happened. It now opens the assistant and
            asks for a real investment plan, computed by
            backend/utils/investmentEngine.js from the user's own numbers.
        */
        aiOptimizeBtn.addEventListener("click", () => {
            if (!user?.id) {
                showToast("Log in to generate an investment plan.", "error");
                return;
            }

            if (aiModal && typeof Navigation !== "undefined") {
                Navigation.open("ai-chat", aiModal);
            }

            sendChatMessage(
                "Build an investment plan for my goal and show the SIP I need."
            );
        });
    }

    const switchAuth = document.getElementById("switch-auth");
    const authBtn = document.getElementById("auth-btn");

    if (switchAuth && authBtn) {
        switchAuth.addEventListener("click", () => {
            isLogin = !isLogin;

            const passwordHint = document.getElementById("password-hint");
            const forgotLink = document.getElementById("forgot-password-link");

            setFormMessage("auth-message", "");

            if (isLogin) {
                authBtn.textContent = "Login";
                switchAuth.innerHTML = `Don't have an account? <strong>Create one</strong>`;

                if (fullnameInput) {
                    fullnameInput.classList.add("hidden");
                    fullnameInput.removeAttribute("required");
                }

                passwordHint?.classList.add("hidden");
                forgotLink?.classList.remove("hidden");

                if (passwordInput) {
                    passwordInput.setAttribute("autocomplete", "current-password");
                }
            } else {
                authBtn.textContent = "Sign Up";
                switchAuth.innerHTML = `Already have an account? <strong>Login</strong>`;

                if (fullnameInput) {
                    fullnameInput.classList.remove("hidden");
                    fullnameInput.setAttribute("required", "true");
                }

                /* Show the password rules before they hit a server error. */
                passwordHint?.classList.remove("hidden");
                forgotLink?.classList.add("hidden");

                if (passwordInput) {
                    passwordInput.setAttribute("autocomplete", "new-password");
                }
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const full_name = fullnameInput?.value.trim() || "";
            const email = emailInput?.value.trim().toLowerCase() || "";
            const password = passwordInput?.value || "";

            setFormMessage("auth-message", "");

            /* ---------------- Client-side validation ---------------- */

            if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
                setFormMessage("auth-message", "Enter a valid email address.");
                return;
            }

            if (!password) {
                setFormMessage("auth-message", "Enter your password.");
                return;
            }

            if (!isLogin) {
                if (!full_name) {
                    setFormMessage("auth-message", "Enter your full name.");
                    return;
                }

                const strengthError = validatePasswordStrength(password);

                if (strengthError) {
                    setFormMessage("auth-message", strengthError);
                    return;
                }
            }

            const authButton = document.getElementById("auth-btn");

            setButtonLoading(
                authButton,
                true,
                isLogin ? "Logging in..." : "Creating account..."
            );

            const result = isLogin
                ? await apiLogin(email, password)
                : await apiSignup(full_name, email, password);

            setButtonLoading(authButton, false);

            if (!result?.success || !result.user || !result.token) {
                setFormMessage(
                    "auth-message",
                    result?.message || "Authentication failed. Please try again."
                );
                return;
            }

            localStorage.setItem("token", result.token);
            localStorage.setItem("user", JSON.stringify(result.user));

            token = result.token;
            user = result.user;

            updateNodeValue("profile-name", user.full_name);

            if (loginModal) loginModal.classList.add("hidden");
            if (passwordInput) passwordInput.value = "";

            activatePage("home-view");

            isDashboardInitialized = false;
            await initializeDashboard(user.id);

            showToast(
                isLogin
                    ? `Welcome back, ${user.full_name.split(" ")[0]}.`
                    : "Account created. Welcome to FinTack.",
                "success"
            );
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            localStorage.removeItem("currentChatId");
            token = null;
            user = null;
            isDashboardInitialized = false;
            currentChatId = null;
            
            if (loginModal) loginModal.classList.remove("hidden");
            if (fullnameInput) fullnameInput.value = "";
            if (emailInput) emailInput.value = "";
            if (passwordInput) passwordInput.value = "";
            
            activatePage("home-view");
        });
    }

    if (transactionForm) {
    transactionForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!user?.id) {
            setFormMessage("transaction-message", "Please log in first.");
            return;
        }

        const title = transactionNameInput?.value.trim() || "";
        const amount = Number(transactionAmountInput?.value || 0);
        const category = transactionCategoryInput?.value || "";
        const date =
            transactionDateInput?.value ||
            new Date().toISOString().split("T")[0];

        setFormMessage("transaction-message", "");

        /* ---------------- Validation ---------------- */

        if (!title) {
            setFormMessage("transaction-message", "Give the transaction a title.");
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            setFormMessage("transaction-message", "Amount must be greater than zero.");
            return;
        }

        if (!category) {
            setFormMessage("transaction-message", "Pick a category.");
            return;
        }

        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + 1);

        if (new Date(date) > maxDate) {
            setFormMessage(
                "transaction-message",
                "That date is more than a year in the future."
            );
            return;
        }

        const submitButton = transactionForm.querySelector("button[type=submit]");
        setButtonLoading(submitButton, true, "Saving...");

        /*
            addTransaction() handles the request, auth header and the
            notification, so this handler no longer duplicates any of it.
        */
        const result = await addTransaction({
            user_id: user.id,
            title,
            amount,
            category,
            date,
            type: transactionType
        });

        setButtonLoading(submitButton, false);

        if (!result?.success) {
            setFormMessage(
                "transaction-message",
                result?.message || "Couldn't save this transaction."
            );
            return;
        }

        transactionForm.reset();
        transactionModal?.classList.add("hidden");

        showToast(
            `${transactionType === "income" ? "Income" : "Expense"} of ` +
            `${fmtCurrency(amount)} saved.`,
            "success"
        );

        await syncDataAndUpdateUI();
    });

    document
        .getElementById("transaction-close")
        ?.addEventListener("click", () => {
            transactionModal?.classList.add("hidden");
            setFormMessage("transaction-message", "");
        });

    transactionModal?.addEventListener("click", event => {
        if (event.target === transactionModal) {
            transactionModal.classList.add("hidden");
            setFormMessage("transaction-message", "");
        }
    });
    }

    if (addGoalBtn && goalModal) {
        addGoalBtn.addEventListener("click", () => {
            goalModal.classList.remove("hidden");
        });
    }

    if (goalForm) {
        goalForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!user || !user.id) return;
            
            try {
                const response = await fetch(`${API_ORIGIN}/api/goals`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user_id: user.id,
                        title: goalTitle?.value || "New Goal",
                        target_amount: Number(goalTarget?.value || 0),
                        /*
                            Was `current_amount` - a column that does not exist
                            on the goals table. The schema field is
                            `saved_amount`.
                        */
                        saved_amount: 0,
                        deadline: goalDeadline?.value || new Date().toISOString().split('T')[0]
                    })
                });

                const result = await response.json();

                if (!result || !result.success) {
                    showToast(result.message || result.error || "Unable to create goal.", "error");
                    return;
                }

                closeModal({ el: goalModal, form: goalForm });
                await syncDataAndUpdateUI();
            } catch (err) {
                console.error("[FinTack] Goal Creation Error:", err);
                showToast("Failed to create goal.", "error");
            }
        });
    }

    if (savingsForm) {
        savingsForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!selectedGoalId) return;
            
            const amount = Number(savingAmount?.value || 0);

            if (amount <= 0 || isNaN(amount)) {
                showToast("Enter a valid amount.", "error");
                return;
            }

            try {
                const response = await fetch(`${API_ORIGIN}/api/goals/${selectedGoalId}/savings`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amount })
                });

                const result = await response.json();
                if (!result || !result.success) {
                    showToast(result.message || result.error || "Failed to update savings.", "error");
                    return;
                }

                closeModal({ el: savingsModal, form: savingsForm });
                await syncDataAndUpdateUI();
            } catch (err) {
                console.error("[FinTack] Savings Update Error:", err);
                showToast("Failed to add savings.", "error");
            }
        });
    }

    if (editGoalForm) {
        editGoalForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!editingGoalId) return;

            try {
                const response = await fetch(`${API_ORIGIN}/api/goals/${editingGoalId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: editGoalTitle?.value || "Updated Goal",
                        target_amount: Number(editGoalTarget?.value || 0),
                        deadline: editGoalDeadline?.value || new Date().toISOString().split('T')[0]
                    })
                });
                const result = await response.json();
                
                if (!result || !result.success) {
                    showToast(result.message || result.error || "Failed to edit goal.", "error");
                    return;
                }
                
                closeModal({ el: editGoalModal, form: editGoalForm });
                await syncDataAndUpdateUI();
            } catch (err) {
                console.error("[FinTack] Edit Goal Error:", err);
                showToast("Failed to update goal.", "error");
            }
        });
    }

    const modals = [
        { el: savingsModal, form: savingsForm },
        { el: editGoalModal, form: editGoalForm },
        { el: transactionModal, form: transactionForm },
        { el: goalModal, form: goalForm }
    ];

    function closeModal(modalObj) {
        if (modalObj && modalObj.el && !modalObj.el.classList.contains("hidden")) {
            modalObj.el.classList.add("hidden");
            if (modalObj.form) modalObj.form.reset();
        }
    }

    window.addEventListener("click", (e) => {
        modals.forEach(modalObj => {
            if (e.target === modalObj.el) {
                closeModal(modalObj);
            }
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            modals.forEach(modalObj => closeModal(modalObj));
        }
    });

    goalCards.forEach(card => {
        card.addEventListener("click", () => {
            if(plannerTitle) plannerTitle.textContent = card.dataset.title || "Goal";
            if(planTarget) planTarget.value = Number(card.dataset.default || 0);
            if(planIncome) planIncome.value = "";
            if(planDuration) planDuration.value = 12;
            if(planResults) planResults.classList.add("hidden");
            if(plannerView) plannerView.classList.remove("hidden");
        });
    });

    if (closePlanner) {
        closePlanner.addEventListener("click", () => {
            if (plannerView) plannerView.classList.add("hidden");
        });
    }

    if (plannerForm) {
        plannerForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const target = Number(planTarget?.value || 0);
            const income = Number(planIncome?.value || 0);
            const months = Number(planDuration?.value || 0);

            if (target <= 0 || income <= 0 || months <= 0) {
                showToast("Enter valid values.", "error");
                return;
            }

            const monthlySave = target / months;
            const monthlySpend = income - monthlySave;

            if (resMonthSave) resMonthSave.textContent = "₹" + monthlySave.toFixed(0);
            if (resWeekSave) resWeekSave.textContent = "₹" + (monthlySave / 4).toFixed(0);
            if (resDaySave) resDaySave.textContent = "₹" + (monthlySave / 30).toFixed(0);
            
            if (resMonthSpend) resMonthSpend.textContent = "₹" + monthlySpend.toFixed(0);
            if (resWeekSpend) resWeekSpend.textContent = "₹" + (monthlySpend / 4).toFixed(0);
            if (resDaySpend) resDaySpend.textContent = "₹" + (monthlySpend / 30).toFixed(0);

            if (planResults) planResults.classList.remove("hidden");

            localStorage.setItem("last_goal_plan", JSON.stringify({
                goal: plannerTitle?.textContent || "Goal",
                target, income, months
            }));
        });
    }

    if (openExpenseBtn) {
        openExpenseBtn.addEventListener("click", async () => {
            if (expenseManager) expenseManager.classList.remove("hidden");
            if (user && user.id) {
                try {
                    const res = await fetch(`${API_ORIGIN}/api/transactions/${user.id}`);
                    const json = await res.json();
                    refreshBudget(json.transactions || []);
                } catch (e) {
                    refreshBudget();
                }
            } else {
                refreshBudget();
            }
        });
    }

    if (closeExpenseBtn) {
        closeExpenseBtn.addEventListener("click", () => {
            if (expenseManager) expenseManager.classList.add("hidden");
        });
    }

    if (budgetForm) {
        budgetForm.addEventListener("submit", (e) => {
            e.preventDefault();
            if(budgetIncomeInput) budget.income = Number(budgetIncomeInput.value) || 0;
            if(budgetSavingsInput) budget.savings = Number(budgetSavingsInput.value) || 0;
            localStorage.setItem("budget_data", JSON.stringify(budget));
            
            // Trigger a UI sync to apply the new budget values
            syncDataAndUpdateUI();
            showToast("Budget saved.", "success");
        });
    }

    function refreshBudget(transactions = []) {
        if (!budgetIncomeInput || !budgetSavingsInput) return;

        budgetIncomeInput.value = budget.income || "";
        budgetSavingsInput.value = budget.savings || "";

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const currentMonthExpenses = Array.isArray(transactions) ? transactions.filter(t => {
            const tDate = new Date(t.date);
            return t.type === 'expense' && tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
        }) : [];

        const spent = currentMonthExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const income = Number(budget.income) || 0;
        const savings = Number(budget.savings) || 0;
        
        const safeSpend = income - savings;
        const remain = safeSpend - spent;
        const percent = safeSpend > 0 ? Math.min(100, (spent / safeSpend) * 100) : 0;

        if(monthSpentEl) monthSpentEl.textContent = "₹" + spent.toLocaleString("en-IN");
        if(monthRemainingEl) monthRemainingEl.textContent = "₹" + remain.toLocaleString("en-IN");
        
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const daysRemaining = daysInMonth - today.getDate() + 1;
        
        if(dailyAllowanceEl) dailyAllowanceEl.textContent = "₹" + Math.max(0, remain / daysRemaining).toFixed(0);
        
        if (budgetPercentEl) budgetPercentEl.textContent = percent.toFixed(0) + "%";
        if (budgetProgressFill) budgetProgressFill.style.width = percent + "%";

        if (todaysTransactionsList) {
            todaysTransactionsList.innerHTML = "";
            
            if (currentMonthExpenses.length === 0) {
                todaysTransactionsList.innerHTML = `<div class="transaction-item" style="justify-content:center; color:#8d97a5;"><span>No expenses recorded this month.</span></div>`;
                return;
            }

            currentMonthExpenses.forEach(expense => {
                const row = document.createElement("div");
                row.className = "transaction-item";
                row.innerHTML = `
                    <div>
                        <strong>${expense.title || 'Expense'}</strong><br>
                        <small>${new Date(expense.date).toLocaleDateString()}</small>
                    </div>
                    <div>
                        <strong>₹${(Number(expense.amount)||0).toLocaleString("en-IN")}</strong>
                    </div>
                `;
                todaysTransactionsList.appendChild(row);
            });
        }
    }

    function renderCharts(chartData, summaryData) {
        if (typeof Chart === "undefined" || !chartData) return;

        const expenseCanvas = document.getElementById("expenseChart");
        if (expenseCanvas) {
            if (expenseChartInst) expenseChartInst.destroy();
            expenseChartInst = new Chart(expenseCanvas, {
                type: "line",
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: "Expenses",
                        data: chartData.expense,
                        borderColor: "#ff4d4f",
                        backgroundColor: "rgba(255,77,79,.15)",
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }

        const portfolioCanvas = document.getElementById("portfolioChart");
        if (portfolioCanvas && summaryData) {
            if (portfolioChartInst) portfolioChartInst.destroy();
            
            const investments = (summaryData.netWorth || 0) * 0.45;
            const savings = summaryData.monthlySavings > 0 ? summaryData.monthlySavings : 0;
            const cash = Math.max(0, summaryData.balance - investments - savings);

            // Give dummy values if all 0 to render an empty chart gracefully
            const dataVals = (investments === 0 && savings === 0 && cash === 0) ? [1,1,1] : [investments, savings, cash];

            portfolioChartInst = new Chart(portfolioCanvas, {
                type: "doughnut",
                data: {
                    labels: ["Investments", "Savings", "Cash"],
                    datasets: [{
                        data: dataVals,
                        backgroundColor: ["#9b51e0", "#3ddc97", "#58a6ff"]
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: "bottom" } } }
            });
        }

        const incomeCanvas = document.getElementById("incomeChart");
        if (incomeCanvas) {
            if (incomeChartInst) incomeChartInst.destroy();
            incomeChartInst = new Chart(incomeCanvas, {
                type: "bar",
                data: {
                    labels: chartData.labels,
                    datasets: [
                        { label: "Income", data: chartData.income, backgroundColor: "#00d26a" },
                        { label: "Expense", data: chartData.expense, backgroundColor: "#ff4d4f" }
                    ]
                },
                options: { responsive: true }
            });
        }
    }

    window.formatMoney = function (value) {
        return "₹" + Number(value || 0).toLocaleString("en-IN");
    };

    window.showToast = function (message) {
        console.log("[FinTack]", message);
    };

    function attachGoalButtonEvents() {
        document.querySelectorAll(".goal-save-btn").forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectedGoalId = btn.dataset.id;
                if(savingsModal) savingsModal.classList.remove("hidden");
            };
        });

        document.querySelectorAll(".edit-goal-btn").forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                editingGoalId = btn.dataset.id;
                
                try {
                    const req = await fetch(`${API_ORIGIN}/api/goals/${user.id}`);
                    const json = await req.json();
                    const goals = json.goals || [];
                    
                    if (!Array.isArray(goals)) return;
                    
                    const goal = goals.find(g => g.id == editingGoalId);
                    if (!goal) return;
                    
                    if (editGoalTitle) editGoalTitle.value = goal.title || "";
                    if (editGoalTarget) editGoalTarget.value = goal.target_amount || 0;
                    if (editGoalDeadline && goal.deadline) editGoalDeadline.value = goal.deadline.split("T")[0];
                    
                    if (editGoalModal) editGoalModal.classList.remove("hidden");
                } catch (err) {
                    console.error("[FinTack] Error fetching goal for edit:", err);
                }
            };
        });

        document.querySelectorAll(".delete-goal-btn").forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                deleteGoal(btn.dataset.id);
            };
        });
    }

    async function deleteGoal(id) {
        if (!id || !confirm("Delete this goal?")) return;
        
        try {
            const response = await fetch(`${API_ORIGIN}/api/goals/${id}`, { method: "DELETE" });
            const result = await response.json();

            if (!result || !result.success) {
                showToast(result.message || result.error || "Failed to delete goal.", "error");
                return;
            }

            await syncDataAndUpdateUI();
        } catch (err) {
            console.error("[FinTack] Delete Goal Error:", err);
            showToast("Failed to delete goal.", "error");
        }
    }

    document.querySelectorAll(".progress").forEach(bar => {
        const width = bar.style.width;
        bar.style.width = "0%";
        setTimeout(() => bar.style.width = width, 300);
    });


    /* ======================================================
                            TOAST NOTIFICATIONS

       Replaces alert(). alert() blocks the main thread, cannot be styled,
       and on mobile it interrupts whatever the user was doing.
    ====================================================== */

    function showToast(message, tone = "info", timeout = 4000) {
        let host = document.getElementById("toast-host");

        if (!host) {
            host = document.createElement("div");
            host.id = "toast-host";
            host.className = "toast-host";
            host.setAttribute("role", "status");
            host.setAttribute("aria-live", "polite");
            document.body.appendChild(host);
        }

        const toast = document.createElement("div");
        toast.className = `toast toast--${tone}`;
        toast.textContent = message;

        host.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add("is-visible"));

        setTimeout(() => {
            toast.classList.remove("is-visible");
            setTimeout(() => toast.remove(), 250);
        }, timeout);
    }

    /* Inline form messages, used by the auth and reset forms. */
    function setFormMessage(elementId, message, tone = "error") {
        const element = document.getElementById(elementId);

        if (!element) return;

        if (!message) {
            element.classList.add("hidden");
            element.textContent = "";
            return;
        }

        element.textContent = message;
        element.className = `form-message form-message--${tone}`;
    }

    function setButtonLoading(button, isLoading, loadingText = "Please wait...") {
        if (!button) return;

        if (isLoading) {
            button.dataset.originalText = button.textContent;
            button.textContent = loadingText;
            button.disabled = true;
        } else {
            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
            }
            button.disabled = false;
        }
    }

    /* ======================================================
                            EDIT TRANSACTION
    ====================================================== */

    const editTransactionModal = document.getElementById("edit-transaction-modal");
    const editTransactionForm = document.getElementById("edit-transaction-form");
    const editTransactionId = document.getElementById("edit-transaction-id");
    const editTransactionTypeField = document.getElementById("edit-transaction-type");
    const editTransactionName = document.getElementById("edit-transaction-name");
    const editTransactionAmount = document.getElementById("edit-transaction-amount");
    const editTransactionCategory = document.getElementById("edit-transaction-category");
    const editTransactionDate = document.getElementById("edit-transaction-date");
    const editTransactionDescription = document.getElementById("edit-transaction-description");
    const editTransactionDelete = document.getElementById("edit-transaction-delete");
    const editTransactionClose = document.getElementById("edit-transaction-close");

    const EXPENSE_CATEGORIES = [
        "Food", "Groceries", "Transport", "Fuel", "Shopping", "Bills", "Rent",
        "Entertainment", "Health", "Education", "Travel", "Subscriptions", "Other"
    ];

    const INCOME_CATEGORIES = [
        "Salary", "Freelance", "Business", "Investment", "Interest",
        "Gift", "Refund", "Other"
    ];

    function fillCategoryOptions(select, type, selected) {
        if (!select) return;

        const list = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

        /* Keep a category that is no longer in the list rather than losing it. */
        const options = selected && !list.includes(selected)
            ? [selected, ...list]
            : list;

        select.innerHTML = options
            .map(category =>
                `<option value="${category}"${category === selected ? " selected" : ""}>${category}</option>`
            )
            .join("");
    }

    function setEditType(type) {
        if (editTransactionTypeField) editTransactionTypeField.value = type;

        document
            .querySelectorAll("#edit-transaction-form .type-toggle__option")
            .forEach(button => {
                const isActive = button.dataset.type === type;
                button.classList.toggle("is-active", isActive);
                button.setAttribute("aria-checked", String(isActive));
            });

        fillCategoryOptions(
            editTransactionCategory,
            type,
            editTransactionCategory?.value
        );
    }

    document
        .querySelectorAll("#edit-transaction-form .type-toggle__option")
        .forEach(button => {
            button.addEventListener("click", () => setEditType(button.dataset.type));
        });

    function openEditTransaction(transaction) {
        if (!transaction || !editTransactionModal) return;

        editTransactionId.value = transaction.id;
        editTransactionName.value = transaction.title || "";
        editTransactionAmount.value = Number(transaction.amount) || "";
        editTransactionDate.value = String(transaction.date || "").slice(0, 10);
        editTransactionDescription.value = transaction.description || "";

        fillCategoryOptions(
            editTransactionCategory,
            transaction.type,
            transaction.category
        );

        setEditType(String(transaction.type || "expense").toLowerCase());

        setFormMessage("edit-transaction-message", "");
        editTransactionModal.classList.remove("hidden");
    }

    function closeEditTransaction() {
        editTransactionModal?.classList.add("hidden");
        setFormMessage("edit-transaction-message", "");
    }

    editTransactionClose?.addEventListener("click", closeEditTransaction);

    editTransactionModal?.addEventListener("click", event => {
        if (event.target === editTransactionModal) closeEditTransaction();
    });

    /*
        One delegated listener for the whole list. Rebinding per row on every
        render was the previous approach and it leaked handlers.
    */
    document
        .getElementById("transaction-container")
        ?.addEventListener("click", event => {
            const button = event.target.closest("[data-transaction-id]");

            if (!button) return;

            const transaction = currentTransactions.find(
                item => String(item.id) === String(button.dataset.transactionId)
            );

            if (!transaction) {
                showToast("That transaction is no longer available.", "error");
                return;
            }

            openEditTransaction(transaction);
        });

    editTransactionForm?.addEventListener("submit", async event => {
        event.preventDefault();

        const id = editTransactionId.value;
        const title = editTransactionName.value.trim();
        const amount = Number(editTransactionAmount.value);
        const category = editTransactionCategory.value;
        const date = editTransactionDate.value;
        const type = editTransactionTypeField.value;
        const description = editTransactionDescription.value.trim();

        /* Client-side validation mirrors the server rules for instant feedback. */
        if (!title) {
            setFormMessage("edit-transaction-message", "Give the transaction a title.");
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            setFormMessage("edit-transaction-message", "Amount must be greater than zero.");
            return;
        }

        if (!date) {
            setFormMessage("edit-transaction-message", "Pick a date.");
            return;
        }

        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + 1);

        if (new Date(date) > maxDate) {
            setFormMessage(
                "edit-transaction-message",
                "That date is more than a year in the future."
            );
            return;
        }

        const saveButton = document.getElementById("edit-transaction-save");
        setButtonLoading(saveButton, true, "Saving...");

        const result = await updateTransaction(id, {
            title,
            amount,
            category,
            date,
            type,
            description
        });

        setButtonLoading(saveButton, false);

        if (!result?.success) {
            setFormMessage(
                "edit-transaction-message",
                result?.message || "Couldn't update this transaction."
            );
            return;
        }

        closeEditTransaction();
        showToast("Transaction updated.", "success");

        await syncDataAndUpdateUI();
    });

    editTransactionDelete?.addEventListener("click", async () => {
        const id = editTransactionId.value;

        if (!id) return;

        if (!confirm("Delete this transaction? This cannot be undone.")) return;

        setButtonLoading(editTransactionDelete, true, "Deleting...");

        const result = await deleteTransaction(id);

        setButtonLoading(editTransactionDelete, false);

        if (!result?.success) {
            setFormMessage(
                "edit-transaction-message",
                result?.message || "Couldn't delete this transaction."
            );
            return;
        }

        closeEditTransaction();
        showToast("Transaction deleted.", "success");

        await syncDataAndUpdateUI();
    });

    /* ======================================================
                            FORGOT PASSWORD
    ====================================================== */

    const resetModal = document.getElementById("reset-modal");
    const resetSteps = document.getElementById("reset-steps");
    const resetRequestForm = document.getElementById("reset-request-form");
    const resetVerifyForm = document.getElementById("reset-verify-form");
    const resetPasswordForm = document.getElementById("reset-password-form");
    const resetEmailInput = document.getElementById("reset-email");
    const resetOtpInput = document.getElementById("reset-otp");
    const resetNewPassword = document.getElementById("reset-new-password");
    const resetConfirmPassword = document.getElementById("reset-confirm-password");
    const resetTimer = document.getElementById("reset-timer");
    const resetTitle = document.getElementById("reset-title");
    const resetSubtitle = document.getElementById("reset-subtitle");

    let resetState = {
        email: "",
        token: null,
        expiresAt: 0,
        timerId: null
    };

    function showResetStep(step) {
        document.querySelectorAll(".reset-step").forEach(form => {
            form.classList.toggle("hidden", Number(form.dataset.step) !== step);
        });

        resetSteps?.querySelectorAll("li").forEach(item => {
            const value = Number(item.dataset.step);
            item.classList.toggle("is-active", value === step);
            item.classList.toggle("is-done", value < step);
        });

        const copy = {
            1: [
                "Reset your password",
                "Enter the email on your account and we'll send you a 6-digit code."
            ],
            2: [
                "Check your email",
                `We sent a 6-digit code to ${resetState.email}. It expires shortly.`
            ],
            3: [
                "Set a new password",
                "Choose a password you don't use anywhere else."
            ]
        }[step];

        if (copy) {
            if (resetTitle) resetTitle.textContent = copy[0];
            if (resetSubtitle) resetSubtitle.textContent = copy[1];
        }

        setFormMessage("reset-message", "");
    }

    function openResetModal() {
        resetState = { email: "", token: null, expiresAt: 0, timerId: null };

        if (resetEmailInput) {
            resetEmailInput.value = emailInput?.value.trim() || "";
        }

        if (resetOtpInput) resetOtpInput.value = "";
        if (resetNewPassword) resetNewPassword.value = "";
        if (resetConfirmPassword) resetConfirmPassword.value = "";

        showResetStep(1);
        resetModal?.classList.remove("hidden");
        loginModal?.classList.add("hidden");
    }

    function closeResetModal() {
        clearInterval(resetState.timerId);
        resetModal?.classList.add("hidden");
        loginModal?.classList.remove("hidden");
    }

    function startOtpTimer(minutes = 10) {
        clearInterval(resetState.timerId);

        resetState.expiresAt = Date.now() + minutes * 60 * 1000;

        const tick = () => {
            const remaining = resetState.expiresAt - Date.now();

            if (remaining <= 0) {
                clearInterval(resetState.timerId);
                if (resetTimer) {
                    resetTimer.textContent =
                        "That code has expired. Request a new one.";
                }
                return;
            }

            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);

            if (resetTimer) {
                resetTimer.textContent =
                    `Code expires in ${mins}:${String(secs).padStart(2, "0")}`;
            }
        };

        tick();
        resetState.timerId = setInterval(tick, 1000);
    }

    document
        .getElementById("forgot-password-link")
        ?.addEventListener("click", openResetModal);

    document
        .getElementById("forgot-password-link")
        ?.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") openResetModal();
        });

    document.getElementById("reset-close")?.addEventListener("click", closeResetModal);
    document.getElementById("reset-back")?.addEventListener("click", closeResetModal);

    /* ---------------- Step 1: request ---------------- */

    async function submitResetRequest() {
        const email = resetEmailInput?.value.trim().toLowerCase();

        if (!email || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
            setFormMessage("reset-message", "Enter a valid email address.");
            return;
        }

        const button = document.getElementById("reset-request-btn");
        setButtonLoading(button, true, "Sending...");

        const result = await requestPasswordReset(email);

        setButtonLoading(button, false);

        if (!result?.success) {
            setFormMessage(
                "reset-message",
                result?.message || "Couldn't send the code. Try again shortly."
            );
            return;
        }

        resetState.email = email;

        showResetStep(2);
        startOtpTimer(result.expiresInMinutes || 10);

        setFormMessage(
            "reset-message",
            result.delivery === "console"
                ? "Development mode: the code was printed to the backend console."
                : result.message,
            "success"
        );

        resetOtpInput?.focus();
    }

    resetRequestForm?.addEventListener("submit", event => {
        event.preventDefault();
        submitResetRequest();
    });

    document.getElementById("reset-resend")?.addEventListener("click", () => {
        showResetStep(1);
        if (resetEmailInput) resetEmailInput.value = resetState.email;
    });

    /* ---------------- Step 2: verify ---------------- */

    resetOtpInput?.addEventListener("input", () => {
        resetOtpInput.value = resetOtpInput.value.replace(/\D/g, "").slice(0, 6);
    });

    resetVerifyForm?.addEventListener("submit", async event => {
        event.preventDefault();

        const otp = resetOtpInput?.value.trim();

        if (!/^\d{6}$/.test(otp || "")) {
            setFormMessage("reset-message", "Enter the 6-digit code from your email.");
            return;
        }

        const button = document.getElementById("reset-verify-btn");
        setButtonLoading(button, true, "Verifying...");

        const result = await verifyResetOtp(resetState.email, otp);

        setButtonLoading(button, false);

        if (!result?.success) {
            setFormMessage(
                "reset-message",
                result?.message || "That code didn't work."
            );
            return;
        }

        clearInterval(resetState.timerId);
        resetState.token = result.resetToken;

        showResetStep(3);
        resetNewPassword?.focus();
    });

    /* ---------------- Step 3: set password ---------------- */

    resetPasswordForm?.addEventListener("submit", async event => {
        event.preventDefault();

        const password = resetNewPassword?.value || "";
        const confirmPassword = resetConfirmPassword?.value || "";

        const error = validatePasswordStrength(password);

        if (error) {
            setFormMessage("reset-message", error);
            return;
        }

        if (password !== confirmPassword) {
            setFormMessage("reset-message", "The two passwords don't match.");
            return;
        }

        const button = document.getElementById("reset-submit-btn");
        setButtonLoading(button, true, "Updating...");

        const result = await resetPassword(
            resetState.token,
            password,
            confirmPassword
        );

        setButtonLoading(button, false);

        if (!result?.success) {
            setFormMessage(
                "reset-message",
                result?.message || "Couldn't update your password."
            );
            return;
        }

        closeResetModal();
        showToast("Password updated. Please log in.", "success");

        if (emailInput) emailInput.value = resetState.email;
        if (passwordInput) passwordInput.value = "";

        resetState = { email: "", token: null, expiresAt: 0, timerId: null };
    });

    function validatePasswordStrength(password) {
        if (String(password).length < 8) {
            return "Password must be at least 8 characters long.";
        }

        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            return "Password must contain at least one letter and one number.";
        }

        return null;
    }

    console.log("%cFinTack Dynamic Core Loaded", "color:#58a6ff;font-size:18px;font-weight:bold;");
    
    // Hide the loader only after the core setup has fully completed
    if (typeof window.hideFinTackLoader === 'function') {
        window.hideFinTackLoader();
    }
});

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(err => {
            console.warn("[FinTack] Service Worker registration failed:", err);
        });
    });
}

/* ==========================================================
                    GLOBAL HELPER FUNCTIONS
========================================================== */

export function showAIResponse(content) {
    const oldCard = document.getElementById("ai-response-card");
    if (oldCard) oldCard.remove();

    const card = document.createElement("div");
    card.id = "ai-response-card";
    card.className = "results-dashboard";

    const header = document.createElement("h3");
    header.innerHTML = `<i class="fa-solid fa-robot"></i> FinTack AI`;
    card.appendChild(header);
    
    const bodyContainer = document.createElement("div");
    bodyContainer.style.lineHeight = "1.6"; // Keep the nice spacing

    if (typeof content === "string") {
        // If it's already HTML, render it directly
        if (content.includes("</div>") || content.includes("</p>") || content.includes("<div")) {
            bodyContainer.innerHTML = content;
        } else {
            // Convert Markdown bold/italic AND newlines to HTML
            const formattedText = content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
            bodyContainer.innerHTML = formattedText;
        }
    } else if (content instanceof Node) {
        bodyContainer.appendChild(content);
    }
    
    card.appendChild(bodyContainer);

    const searchBox = document.querySelector(".search-container");
    if (searchBox) searchBox.insertAdjacentElement("afterend", card);
}

export function generatePurchaseAnalysisCard(data) {
    if (!data) data = {};
    const container = document.createElement("div");
    container.className = "purchase-analysis-wrapper";

    container.innerHTML = `
        <h3>🛒 Purchase Analysis</h3>
        <div class="ai-card-grid">
            <div class="ai-mini-card">
                <h4>Income</h4>
                <h2>₹${(Number(data.income) || 0).toLocaleString()}</h2>
            </div>
            <div class="ai-mini-card">
                <h4>Expenses</h4>
                <h2>₹${(Number(data.expenses) || 0).toLocaleString()}</h2>
            </div>
            <div class="ai-mini-card">
                <h4>Savings</h4>
                <h2>₹${(Number(data.monthlySavings) || 0).toLocaleString()}</h2>
            </div>
        </div>
        <div class="ai-recommendation">
            <b>Recommendation</b><br><br>
            ${data.recommendation || "Maintain your current tracking."}<br><br>
            Estimated Saving Time<br>
            <b>${data.months || 0} months</b>
        </div>
    `;

    return container;
}

/* ==========================================================
                    AI CHAT SCROLL HELPER
========================================================== */
export function scrollChatToBottom() {
    const chat = document.getElementById("ai-chat-body");
    if (!chat) return;
    
    requestAnimationFrame(() => {
        setTimeout(() => {
            chat.scrollTop = chat.scrollHeight;
        }, 50); 
    });
}

/* ==========================================================
                    UPDATED MESSAGE FUNCTIONS
========================================================== */
export function escapeChatHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function addUserMessage(message) {
    const chat = document.getElementById("ai-chat-body");
    if (!chat) return;

    const div = document.createElement("div");
    div.className = "user-message";

    /*
        textContent, not innerHTML: this is raw user input, and it was being
        injected as markup. Typing "<img onerror=...>" into the chat used to
        execute it.
    */
    div.textContent = message;

    chat.appendChild(div);

    scrollChatToBottom();
}

export function addAIMessage(content) {
    const chat = document.getElementById("ai-chat-body");
    if (!chat) return;

    const div = document.createElement("div");
    div.className = "ai-message";
    div.style.lineHeight = "1.5"; // Keep the breathing room
    
    if (typeof content === "string") {
        // If the content is already HTML (like the tools footer), render it directly
        if (content.includes("</div>") || content.includes("</p>") || content.includes("<div")) {
            div.innerHTML = content;
        } else {
            // Convert Markdown bold/italic AND newlines to HTML safely
            const formattedText = content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>'); // Converts AI line breaks properly
                
            div.innerHTML = formattedText;
        }
    } else if (content instanceof Node) {
        div.appendChild(content);
    }

    chat.appendChild(div);
    scrollChatToBottom();
}

export function showTyping() {
    const chat = document.getElementById("ai-chat-body");
    if (!chat) return;

    const typing = document.createElement("div");
    typing.className = "ai-message";
    typing.id = "typing";
    typing.innerHTML = `🤖 FinTack AI is analyzing...`;
    
    chat.appendChild(typing);
    scrollChatToBottom();
}

export function hideTyping() {
    const typing = document.getElementById("typing");
    if (typing) typing.remove();
}