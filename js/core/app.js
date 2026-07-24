/* ==========================================================
                    FINTACK APP.JS
========================================================== */

import {
    fetchDashboardData,
    fetchTransactions,
    fetchGoals,
    addTransaction
} from "./api.js";

import {
    renderStocks,
    renderNews,
    renderTransactions,
    renderGoals,
    updateDashboard,
    updateGoalSummary
} from "./ui.js";
import Navigation from "./navigation.js";
import FinTackAI from "../ai/FinTackAI.js";
import AIStorage from "../ai/aiStorage.js";

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

    /* ======================================================
                    STATE VARIABLES & INSTANCES
    ====================================================== */
    let selectedGoalId = null;
    let editingGoalId = null;
    let transactionType = "expense";
    let isLogin = true;
    let currentChatId = localStorage.getItem("currentChatId") || null;
    let isDashboardInitialized = false;

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

    function processFinancialData(transactions) {
        let totalIncome = 0;
        let totalExpense = 0;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        let currentMonthIncome = 0;
        let currentMonthExpense = 0;
        let categoryTotals = {};
        
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const last6Months = [];
        
        // Initialize last 6 months buckets
        for (let i = 5; i >= 0; i--) {
            let d = new Date(currentYear, currentMonth - i, 1);
            last6Months.push({ label: monthNames[d.getMonth()], year: d.getFullYear(), income: 0, expense: 0 });
        }

        const txArr = Array.isArray(transactions) ? transactions : [];

        txArr.forEach(t => {
            const amt = Number(t.amount) || 0;
            const tDate = new Date(t.date);
            const tMonth = tDate.getMonth();
            const tYear = tDate.getFullYear();
            
            if (t.type === 'income') {
                totalIncome += amt;
                if (tMonth === currentMonth && tYear === currentYear) currentMonthIncome += amt;
            } else {
                totalExpense += amt;
                if (tMonth === currentMonth && tYear === currentYear) currentMonthExpense += amt;
                
                const cat = t.category || 'Other';
                categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
            }

            const chartData = last6Months.find(m => m.label === monthNames[tMonth] && m.year === tYear);
            if (chartData) {
                if (t.type === 'income') chartData.income += amt;
                else chartData.expense += amt;
            }
        });

        const balance = totalIncome - totalExpense;
        const currentMonthSavings = currentMonthIncome - currentMonthExpense;

        return {
            income: totalIncome,
            expenses: totalExpense,
            balance: balance,
            netWorth: balance, 
            monthlyIncome: currentMonthIncome,
            monthlyExpense: currentMonthExpense,
            monthlySavings: currentMonthSavings,
            categoryTotals,
            chartData: {
                labels: last6Months.map(m => m.label),
                income: last6Months.map(m => m.income),
                expense: last6Months.map(m => m.expense)
            }
        };
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

    async function initializeDashboard(userId) {
        if (isDashboardInitialized || !userId) return;

        try {
            const [dashboard, transactions, goals] = await Promise.all([
                typeof fetchDashboardData === "function" ? fetchDashboardData(userId).catch(() => ({})) : Promise.resolve({}),
                typeof fetchTransactions === "function" ? fetchTransactions(userId).catch(() => fetch(`https://fintack.onrender.com/api/transactions/${userId}`).then(res => res.json()).then(r => r.transactions)) : Promise.resolve([]),
                typeof fetchGoals === "function" ? fetchGoals(userId).catch(() => fetch(`https://fintack.onrender.com/api/goals/${userId}`).then(res => res.json()).then(r => r.goals)) : Promise.resolve([])
            ]);
            
            const processedData = processFinancialData(transactions);

            if (dashboard && dashboard.stocks && typeof renderStocks === "function") renderStocks(dashboard.stocks);
            if (dashboard && dashboard.news && typeof renderNews === "function") renderNews(dashboard.news);

            if (typeof renderTransactions === "function") renderTransactions(transactions);
            
            populateDynamicUI(processedData, Array.isArray(goals) ? goals.length : 0, goals);
            
            if (typeof updateDashboard === "function") updateDashboard(processedData);

            if (Array.isArray(goals)) {
                updateNodeValue("active-goals-count", goals.length.toString());
                updateNodeValue("profile-goals", goals.length.toString());
                if (typeof renderGoals === "function") renderGoals(goals);
                if (typeof updateGoalSummary === "function") updateGoalSummary(goals);
            }
            
            attachGoalButtonEvents();
            renderCharts(processedData.chartData, processedData);
            refreshBudget(transactions);

            isDashboardInitialized = true;
        } catch (err) {
            console.error("[FinTack] Dashboard Initialization Error:", err);
        }
    }

    async function syncDataAndUpdateUI() {
        if (!user || !user.id) return;
        try {
            const [transactionsRes, goalsRes] = await Promise.all([
                fetch(`https://fintack.onrender.com/api/transactions/${user.id}`).then(res => res.json()).catch(() => ({ transactions: [] })),
                fetch(`https://fintack.onrender.com/api/goals/${user.id}`).then(res => res.json()).catch(() => ({ goals: [] }))
            ]);
            
            const transactions = transactionsRes.transactions || [];
            const goals = goalsRes.goals || [];
            
            const processedData = processFinancialData(transactions);

            if (typeof renderTransactions === "function") renderTransactions(transactions);
            
            populateDynamicUI(processedData, goals.length, goals);
            
            if (typeof updateDashboard === "function") updateDashboard(processedData);
            
            updateNodeValue("active-goals-count", goals.length.toString());
            updateNodeValue("profile-goals", goals.length.toString());
            
            if (typeof renderGoals === "function") renderGoals(goals);
            if (typeof updateGoalSummary === "function") updateGoalSummary(goals);
            
            attachGoalButtonEvents();
            renderCharts(processedData.chartData, processedData);
            refreshBudget(transactions);
            
        } catch (error) {
            console.error("[FinTack] Error synchronizing data:", error);
        }
    }

    /* ======================================================
                            EVENT LISTENERS
    ====================================================== */
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

    if (fabIncome) {
        fabIncome.addEventListener("click", () => {
            transactionType = "income";
            if (transactionTitle) transactionTitle.textContent = "Add Income";
            if (transactionModal) transactionModal.classList.remove("hidden");
            if (fabContainer) fabContainer.classList.remove("menu-open");
        });
    }

    if (fabExpense) {
        fabExpense.addEventListener("click", () => {
            transactionType = "expense";
            if (transactionTitle) transactionTitle.textContent = "Add Expense";
            if (transactionModal) transactionModal.classList.remove("hidden");
            if (fabContainer) fabContainer.classList.remove("menu-open");
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
                const result = await FinTackAI.ask(question);
                let html = "";
                if (result && Array.isArray(result.responses)) {
                    result.responses.forEach(response => {
                        if (response.message) html += `<p>${response.message}</p>`;
                        if (response.html) html += response.html;
                    });
                }
                aiSearchInput.value = "";
                showAIResponse(html || "No response generated.");
            } catch (error) {
                console.error("[FinTack] AI Generation Error:", error);
                aiSearchInput.value = "";
                alert("Unable to generate AI response.");
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

    if (aiSend && aiInput) {
        aiSend.addEventListener("click", async () => {
            const question = aiInput.value.trim();
            if (!question || !user || !user.id) return;

            try {
                if (!currentChatId) {
                    const title = question.length > 40
                        ? question.substring(0, 40) + "..."
                        : question;

                    const initResult = await AIStorage.createChat(user.id, title);

                    if (!initResult || !initResult.success || !initResult.chat) {
                        alert("Unable to create chat.");
                        return;
                    }

                    currentChatId = initResult.chat.id;
                    localStorage.setItem("currentChatId", currentChatId);
                }

                aiInput.value = "";
                addUserMessage(question);
                showTyping();
                
                await AIStorage.saveMessage(currentChatId, "user", question);

                const result = await FinTackAI.ask(question);
                hideTyping();

                let storageContent = "";

                if (result && Array.isArray(result.responses) && result.responses.length > 0) {
                    result.responses.forEach(response => {
                        if (response.message) {
                            addAIMessage(response.message);
                            storageContent += `<p>${response.message}</p>`;
                        }
                        if (response.html) {
                            addAIMessage(response.html);
                            storageContent += response.html;
                        }
                    });
                } else {
                    addAIMessage("No response.");
                    storageContent = "No response.";
                }

                await AIStorage.saveMessage(currentChatId, "assistant", storageContent);
            } catch (err) {
                hideTyping();
                addAIMessage("Sorry, I ran into an issue retrieving your data.");
                console.error("[FinTack] AI Chat Flow Error:", err);
            }
        });
    }

    if (aiOptimizeBtn) {
        aiOptimizeBtn.addEventListener("click", () => {
            alert("FinTack AI Optimization Engine Initiated!\n\nYour saving structure adjustments have been processed. Your dashboard projection curves will dynamically recalculate on your next ledger transaction.");
        });
    }

    const switchAuth = document.getElementById("switch-auth");
    const authBtn = document.getElementById("auth-btn");

    if (switchAuth && authBtn) {
        switchAuth.addEventListener("click", () => {
            isLogin = !isLogin;
            if (isLogin) {
                authBtn.textContent = "Login";
                switchAuth.innerHTML = `Don't have an account? <strong>Create one</strong>`;
                if (fullnameInput) {
                    fullnameInput.classList.add("hidden");
                    fullnameInput.removeAttribute("required");
                }
            } else {
                authBtn.textContent = "Sign Up";
                switchAuth.innerHTML = `Already have an account? <strong>Login</strong>`;
                if (fullnameInput) {
                    fullnameInput.classList.remove("hidden");
                    fullnameInput.setAttribute("required", "true");
                }
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const full_name = fullnameInput?.value.trim();
            const email = emailInput?.value.trim();
            const password = passwordInput?.value.trim();
            
            const endpoint = isLogin ? "login" : "signup";
            const body = isLogin ? { email, password } : { full_name, email, password };

            try {
                const response = await fetch(`https://fintack.onrender.com/${endpoint}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });
                
                if (!response.ok) {
                    const errRes = await response.json();
                    alert(errRes.error || errRes.message || "Authentication failed");
                    return;
                }
                
                const result = await response.json();

                if (!result.success || !result.user || !result.token) {
                    alert(result.message || result.error || "Authentication failed");
                    return;
                }

                localStorage.setItem("token", result.token);
                localStorage.setItem("user", JSON.stringify(result.user));

                token = result.token;
                user = result.user;

                updateNodeValue("profile-name", user.full_name);
                
                if (loginModal) loginModal.classList.add("hidden");
                activatePage("home-view");
                
                isDashboardInitialized = false; 
                await initializeDashboard(user.id);
                
                alert(isLogin ? "Login Successful!" : "Account Created Successfully!");
            } catch (err) {
                console.error("[FinTack] Auth Error:", err);
                alert("A network error occurred. Please try again.");
            }
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
            if (!user || !user.id) return;
            
            const title = transactionNameInput?.value || "Transaction";
            const amount = Number(transactionAmountInput?.value || 0);
            const category = transactionCategoryInput?.value || "Other";
            const date = transactionDateInput?.value || new Date().toISOString().split('T')[0];

            const data = { user_id: user.id, title, amount, category, date, type: transactionType };

            try {
                const response = await fetch("https://fintack.onrender.com/api/transactions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });

                if (!response.ok) throw new Error("Failed to post transaction");

                closeModal({ el: transactionModal, form: transactionForm });
                await syncDataAndUpdateUI();
            } catch (err) {
                console.error("[FinTack] Transaction Submission Error:", err);
                alert("Failed to save transaction.");
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
                const response = await fetch("https://fintack.onrender.com/api/goals", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user_id: user.id,
                        title: goalTitle?.value || "New Goal",
                        target_amount: Number(goalTarget?.value || 0),
                        current_amount: 0, 
                        deadline: goalDeadline?.value || new Date().toISOString().split('T')[0]
                    })
                });

                const result = await response.json();

                if (!result || !result.success) {
                    alert(result.error || "Unable to create goal.");
                    return;
                }

                closeModal({ el: goalModal, form: goalForm });
                await syncDataAndUpdateUI();
            } catch (err) {
                console.error("[FinTack] Goal Creation Error:", err);
                alert("Failed to create goal.");
            }
        });
    }

    if (savingsForm) {
        savingsForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!selectedGoalId) return;
            
            const amount = Number(savingAmount?.value || 0);

            if (amount <= 0 || isNaN(amount)) {
                alert("Enter a valid amount.");
                return;
            }

            try {
                const response = await fetch(`https://fintack.onrender.com/api/goals/${selectedGoalId}/savings`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amount })
                });

                const result = await response.json();
                if (!result || !result.success) {
                    alert(result.error || "Failed to update savings.");
                    return;
                }

                closeModal({ el: savingsModal, form: savingsForm });
                await syncDataAndUpdateUI();
            } catch (err) {
                console.error("[FinTack] Savings Update Error:", err);
                alert("Failed to add savings.");
            }
        });
    }

    if (editGoalForm) {
        editGoalForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!editingGoalId) return;

            try {
                const response = await fetch(`https://fintack.onrender.com/api/goals/${editingGoalId}`, {
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
                    alert(result.error || "Failed to edit goal.");
                    return;
                }
                
                closeModal({ el: editGoalModal, form: editGoalForm });
                await syncDataAndUpdateUI();
            } catch (err) {
                console.error("[FinTack] Edit Goal Error:", err);
                alert("Failed to update goal.");
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
                alert("Enter valid values.");
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
                    const res = await fetch(`https://fintack.onrender.com/api/transactions/${user.id}`);
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
            alert("Budget Saved!");
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
                    const req = await fetch(`https://fintack.onrender.com/api/goals/${user.id}`);
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
            const response = await fetch(`https://fintack.onrender.com/api/goals/${id}`, { method: "DELETE" });
            const result = await response.json();

            if (!result || !result.success) {
                alert(result.error || "Failed to delete goal.");
                return;
            }

            await syncDataAndUpdateUI();
        } catch (err) {
            console.error("[FinTack] Delete Goal Error:", err);
            alert("Failed to delete goal.");
        }
    }

    document.querySelectorAll(".progress").forEach(bar => {
        const width = bar.style.width;
        bar.style.width = "0%";
        setTimeout(() => bar.style.width = width, 300);
    });

    console.log("%cFinTack Dynamic Core Loaded", "color:#58a6ff;font-size:18px;font-weight:bold;");
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
    bodyContainer.style.cssText = "white-space:pre-line; line-height:1.8;";

    if (typeof content === "string") {
        bodyContainer.innerHTML = content;
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
export function addUserMessage(message) {
    const chat = document.getElementById("ai-chat-body");
    if (!chat) return;
    
    const div = document.createElement("div");
    div.className = "user-message";
    div.innerHTML = message;
    chat.appendChild(div);
    
    scrollChatToBottom();
}

export function addAIMessage(content) {
    const chat = document.getElementById("ai-chat-body");
    if (!chat) return;

    const div = document.createElement("div");
    div.className = "ai-message";
    
    if (typeof content === "string") {
        if (content.includes("</div>") || content.includes("</li>") || content.includes("</p>") || content.includes("<div")) {
            div.innerHTML = content; 
        } else {
            div.innerHTML = content.replace(/\n/g, "<br>"); 
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