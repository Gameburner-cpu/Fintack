/* ==========================================================
                    FINTACK APP.JS
========================================================== */

document.addEventListener("DOMContentLoaded", async () => {
    /* ======================================================
                        DOM ELEMENTS & STATE
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
    const goalCurrent = document.getElementById("goal-current");
    const goalDeadline = document.getElementById("goal-deadline");

    const loginModal = document.getElementById("login-modal");
    const loginForm = document.getElementById("login-form");
    const profileName = document.getElementById("profile-name");
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

    const expenseManager = document.getElementById("expenses-manager");
    const openExpenseBtn = document.getElementById("btn-expenses");
    const closeExpenseBtn = document.getElementById("close-expenses");
    const budgetForm = document.getElementById("budget-setup-form");
    
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

    // State Variables
    let selectedGoalId = null;
    let editingGoalId = null;
    let transactionType = "expense";
    let isLogin = false;
    let budget = JSON.parse(localStorage.getItem("budget_data")) || {
        income: 0,
        savings: 0,
        expenses: []
    };

    /* ======================================================
                        INITIALIZATION & AUTH
    ====================================================== */
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user"));

    if (token && user) {
        if (loginModal) loginModal.classList.add("hidden");
        if (profileName) profileName.textContent = user.full_name;
        await initializeDashboard(user.id);
    } else {
        if (loginModal) loginModal.classList.remove("hidden");
    }

    const savedUser = localStorage.getItem("fintack_user");
    if (savedUser && profileName && (!token || !user)) {
        profileName.textContent = savedUser;
    }

    async function initializeDashboard(userId) {
        if (typeof fetchDashboardData === "function") {
            const dashboard = await fetchDashboardData();
            
            if (dashboard.summary) {
                const netWorth = document.getElementById("net-worth");
                const monthlySaving = document.getElementById("monthly-saving");
                const goalProgress = document.getElementById("goal-progress");
                const goalBar = document.getElementById("goal-progress-bar");

                if (netWorth) netWorth.textContent = "₹" + dashboard.summary.netWorth.toLocaleString();
                if (monthlySaving) monthlySaving.textContent = "₹" + dashboard.summary.monthlySavings.toLocaleString();
                
                if (goalProgress && goalBar) {
                    const progress = Math.round((dashboard.summary.monthlySavings / dashboard.summary.income) * 100) || 0;
                    goalProgress.textContent = progress + "%";
                    goalBar.style.width = progress + "%";
                }
            }

            if (typeof renderStocks === "function") renderStocks(dashboard.stocks);
            if (typeof renderNews === "function") renderNews(dashboard.news);
        }

        if (typeof fetchTransactions === "function") {
            const transactions = await fetchTransactions(userId);
            if (typeof renderTransactions === "function") renderTransactions(transactions);
            
            const summary = calculateSummary(transactions);
            if (typeof updateDashboard === "function") updateDashboard(summary);
        }

        if (typeof fetchGoals === "function") {
            const goals = await fetchGoals(userId);
            if (typeof renderGoals === "function") renderGoals(goals);
            if (typeof updateGoalSummary === "function") updateGoalSummary(goals);
            attachGoalButtonEvents();
        }
    }

    /* ======================================================
                        EVENT LISTENERS
    ====================================================== */
    
    // --- Navigation ---
    function activatePage(id) {
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

    // --- Floating Action Button (FAB) ---
    if (mainFab) {
        mainFab.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            fabContainer.classList.toggle("menu-open");
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
            transactionTitle.textContent = "Add Income";
            transactionModal.classList.remove("hidden");
            fabContainer.classList.remove("menu-open");
        });
    }

    if (fabExpense) {
        fabExpense.addEventListener("click", () => {
            transactionType = "expense";
            transactionTitle.textContent = "Add Expense";
            transactionModal.classList.remove("hidden");
            fabContainer.classList.remove("menu-open");
        });
    }

    // --- Auth Forms ---
    const switchAuth = document.getElementById("switch-auth");
    const authBtn = document.getElementById("auth-btn");

    if (switchAuth) {
        switchAuth.addEventListener("click", () => {
            isLogin = !isLogin;
            if (isLogin) {
                authBtn.textContent = "Login";
                switchAuth.innerHTML = `Don't have an account? <strong>Create one</strong>`;
            } else {
                authBtn.textContent = "Sign Up";
                switchAuth.innerHTML = `Already have an account? <strong>Login</strong>`;
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const full_name = document.getElementById("fullname")?.value.trim();
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value.trim();
            
            const endpoint = isLogin ? "login" : "signup";
            const body = isLogin ? { email, password } : { full_name, email, password };

            try {
                const response = await fetch(`https://fintack.onrender.com/${endpoint}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });
                const result = await response.json();

                if (!result.success) {
                    alert(result.message || result.error);
                    return;
                }

                localStorage.setItem("token", result.token);
                localStorage.setItem("user", JSON.stringify(result.user));

                if (profileName) profileName.textContent = result.user.full_name;
                
                loginModal.classList.add("hidden");
                activatePage("home-view");
                await initializeDashboard(result.user.id);
                
                alert(isLogin ? "Login Successful!" : "Account Created Successfully!");
            } catch (err) {
                console.error("Auth Error:", err);
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            
            if (loginModal) loginModal.classList.remove("hidden");
            if (document.getElementById("fullname")) document.getElementById("fullname").value = "";
            if (document.getElementById("email")) document.getElementById("email").value = "";
            if (document.getElementById("password")) document.getElementById("password").value = "";
            
            activatePage("home-view");
        });
    }

    // --- Forms & Submissions ---
    if (transactionForm) {
        transactionForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const title = document.getElementById("transaction-name").value;
            const amount = Number(document.getElementById("transaction-amount").value);
            const category = document.getElementById("transaction-category").value;
            const date = document.getElementById("transaction-date").value;

            const data = { user_id: user.id, title, amount, category, date, type: transactionType };

            await fetch("https://fintack.onrender.com/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            transactionModal.classList.add("hidden");
            transactionForm.reset();

            const transactions = await fetchTransactions(user.id);
            if (typeof renderTransactions === "function") renderTransactions(transactions);
            if (typeof updateDashboard === "function") updateDashboard(calculateSummary(transactions));
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
            const response = await fetch("https://fintack.onrender.com/api/goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: user.id,
                    title: goalTitle.value,
                    target_amount: Number(goalTarget.value),
                    current_amount: Number(goalCurrent.value),
                    deadline: goalDeadline.value
                })
            });

            const result = await response.json();

            if (!result.success) {
                alert(result.error || "Unable to create goal.");
                return;
            }

            goalModal.classList.add("hidden");
            goalForm.reset();

            const goals = await fetchGoals(user.id);
            if (typeof renderGoals === "function") renderGoals(goals);
            if (typeof updateGoalSummary === "function") updateGoalSummary(goals);
            attachGoalButtonEvents();
        });
    }

    if (savingsForm) {
        savingsForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const amount = Number(savingAmount.value);

            if (amount <= 0) {
                alert("Enter a valid amount.");
                return;
            }

            const response = await fetch(`https://fintack.onrender.com/api/goals/${selectedGoalId}/savings`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount })
            });

            const result = await response.json();
            if (!result.success) {
                alert(result.error);
                return;
            }

            savingsModal.classList.add("hidden");
            savingsForm.reset();

            const goals = await fetchGoals(user.id);
            if (typeof renderGoals === "function") renderGoals(goals);
            if (typeof updateGoalSummary === "function") updateGoalSummary(goals);
            attachGoalButtonEvents();
        });
    }

    if (editGoalForm) {
        editGoalForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const response = await fetch(`https://fintack.onrender.com/api/goals/${editingGoalId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: editGoalTitle.value,
                    target_amount: Number(editGoalTarget.value),
                    deadline: editGoalDeadline.value
                })
            });
            const result = await response.json();
            
            if (!result.success) {
                alert(result.error);
                return;
            }
            
            editGoalModal.classList.add("hidden");
            editGoalForm.reset();
            
            const goals = await fetchGoals(user.id);
            if (typeof renderGoals === "function") renderGoals(goals);
            if (typeof updateGoalSummary === "function") updateGoalSummary(goals);
            attachGoalButtonEvents();
        });
    }

    /* ======================================================
            CENTRALIZED MODAL CLOSING (Click Outside & ESC)
    ====================================================== */
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

    // --- Goal Planner ---
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
        closePlanner.addEventListener("click", () => plannerView.classList.add("hidden"));
    }

    if (plannerForm) {
        plannerForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const target = Number(planTarget.value);
            const income = Number(planIncome.value);
            const months = Number(planDuration.value);

            if (target <= 0 || income <= 0 || months <= 0) {
                alert("Enter valid values.");
                return;
            }

            const monthlySave = target / months;
            const monthlySpend = income - monthlySave;

            document.getElementById("res-month-save").textContent = "₹" + monthlySave.toFixed(0);
            document.getElementById("res-week-save").textContent = "₹" + (monthlySave / 4).toFixed(0);
            document.getElementById("res-day-save").textContent = "₹" + (monthlySave / 30).toFixed(0);
            
            document.getElementById("res-month-spend").textContent = "₹" + monthlySpend.toFixed(0);
            document.getElementById("res-week-spend").textContent = "₹" + (monthlySpend / 4).toFixed(0);
            document.getElementById("res-day-spend").textContent = "₹" + (monthlySpend / 30).toFixed(0);

            planResults.classList.remove("hidden");

            localStorage.setItem("last_goal_plan", JSON.stringify({
                goal: plannerTitle.textContent,
                target, income, months
            }));
        });
    }

    /* ======================================================
                        BUDGET MANAGER
    ====================================================== */
    if (openExpenseBtn) {
        openExpenseBtn.addEventListener("click", () => {
            expenseManager.classList.remove("hidden");
            refreshBudget();
        });
    }

    if (closeExpenseBtn) {
        closeExpenseBtn.addEventListener("click", () => {
            expenseManager.classList.add("hidden");
        });
    }

    if (budgetForm) {
        budgetForm.addEventListener("submit", (e) => {
            e.preventDefault();
            budget.income = Number(document.getElementById("budget-income").value);
            budget.savings = Number(document.getElementById("budget-savings").value);
            localStorage.setItem("budget_data", JSON.stringify(budget));
            refreshBudget();
            alert("Budget Saved!");
        });
    }

    window.addExpense = function (title, amount) {
        budget.expenses.push({ title, amount: Number(amount), date: new Date().toLocaleDateString() });
        localStorage.setItem("budget_data", JSON.stringify(budget));
        refreshBudget();
    };

    window.removeExpense = function (index) {
        budget.expenses.splice(index, 1);
        localStorage.setItem("budget_data", JSON.stringify(budget));
        refreshBudget();
    };

    function refreshBudget() {
        const budgetIncome = document.getElementById("budget-income");
        const budgetSavings = document.getElementById("budget-savings");
        const transactionList = document.getElementById("todays-transactions");
        
        if (!budgetIncome || !budgetSavings) return;

        budgetIncome.value = budget.income || "";
        budgetSavings.value = budget.savings || "";

        const spent = budget.expenses.reduce((sum, item) => sum + item.amount, 0);
        const safeSpend = budget.income - budget.savings;
        const remain = safeSpend - spent;
        const percent = safeSpend > 0 ? Math.min(100, (spent / safeSpend) * 100) : 0;

        document.getElementById("month-spent").textContent = "₹" + spent.toFixed(0);
        document.getElementById("month-remaining").textContent = "₹" + remain.toFixed(0);
        document.getElementById("daily-allowance").textContent = "₹" + (remain / 30).toFixed(0);
        
        const percentEl = document.getElementById("budget-percent");
        const progressFill = document.getElementById("budget-progress-fill");
        
        if (percentEl) percentEl.textContent = percent.toFixed(0) + "%";
        if (progressFill) progressFill.style.width = percent + "%";

        if (transactionList) {
            transactionList.innerHTML = "";
            if (budget.expenses.length === 0) {
                transactionList.innerHTML = `<div class="transaction-item"><span>No expenses added.</span></div>`;
                return;
            }

            budget.expenses.forEach((expense, index) => {
                const row = document.createElement("div");
                row.className = "transaction-item";
                row.innerHTML = `
                    <div>
                        <strong>${expense.title}</strong><br>
                        <small>${expense.date}</small>
                    </div>
                    <div>
                        <strong>₹${expense.amount}</strong><br>
                        <button onclick="removeExpense(${index})" style="margin-top:6px;">Delete</button>
                    </div>
                `;
                transactionList.appendChild(row);
            });
        }
    }
    refreshBudget();

    /* ======================================================
                            CHARTS (Chart.js)
    ====================================================== */
    if (typeof Chart !== "undefined") {
        const expenseCanvas = document.getElementById("expenseChart");
        if (expenseCanvas) {
            new Chart(expenseCanvas, {
                type: "line",
                data: {
                    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                    datasets: [{
                        label: "Expenses",
                        data: [18000, 22000, 19500, 24000, 26000, 23000],
                        borderColor: "#58a6ff",
                        backgroundColor: "rgba(88,166,255,.15)",
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }

        const portfolioCanvas = document.getElementById("portfolioChart");
        if (portfolioCanvas) {
            new Chart(portfolioCanvas, {
                type: "doughnut",
                data: {
                    labels: ["Stocks", "Mutual Funds", "Crypto", "Cash"],
                    datasets: [{
                        data: [40, 30, 10, 20],
                        backgroundColor: ["#58a6ff", "#3ddc97", "#ffb84d", "#ff6b6b"]
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: "bottom" } } }
            });
        }

        const incomeCanvas = document.getElementById("incomeChart");
        if (incomeCanvas) {
            new Chart(incomeCanvas, {
                type: "bar",
                data: {
                    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                    datasets: [
                        { label: "Income", data: [80000, 80000, 80000, 80000, 80000, 80000], backgroundColor: "#3ddc97" },
                        { label: "Expense", data: [18000, 22000, 19500, 24000, 26000, 23000], backgroundColor: "#58a6ff" }
                    ]
                },
                options: { responsive: true }
            });
        }
    }

    /* ======================================================
                            HELPERS
    ====================================================== */
    window.formatMoney = function (value) {
        return "₹" + Number(value).toLocaleString("en-IN");
    };

    window.showToast = function (message) {
        console.log("[FinTack]", message);
    };

    function calculateSummary(transactions) {
        let income = 0;
        let expenses = 0;

        transactions.forEach(t => {
            if (t.type === "income") income += Number(t.amount);
            else expenses += Number(t.amount);
        });

        const balance = income - expenses;
        return { income, expenses, balance, monthlySavings: balance, netWorth: balance };
    }

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
                const goals = await fetchGoals(user.id);
                const goal = goals.find(g => g.id == editingGoalId);
                
                if (!goal) return;
                
                if (editGoalTitle) editGoalTitle.value = goal.title;
                if (editGoalTarget) editGoalTarget.value = goal.target_amount;
                if (editGoalDeadline) editGoalDeadline.value = goal.deadline.split("T")[0];
                
                if (editGoalModal) editGoalModal.classList.remove("hidden");
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
        if (!confirm("Delete this goal?")) return;
        
        const response = await fetch(`https://fintack.onrender.com/api/goals/${id}`, { method: "DELETE" });
        const result = await response.json();

        if (!result.success) {
            alert(result.error);
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem("user"));
        if (currentUser && typeof fetchGoals === "function") {
            const goals = await fetchGoals(currentUser.id);
            if (typeof renderGoals === "function") renderGoals(goals);
            if (typeof updateGoalSummary === "function") updateGoalSummary(goals);
            attachGoalButtonEvents();
        }
    }

    // Goal Animation Initialization
    document.querySelectorAll(".progress").forEach(bar => {
        const width = bar.style.width;
        bar.style.width = "0%";
        setTimeout(() => bar.style.width = width, 300);
    });

    console.log("%cFinTack Loaded Successfully", "color:#58a6ff;font-size:18px;font-weight:bold;");
});

// Service Worker Registration
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(err => {
            console.warn("Service Worker registration failed:", err);
        });
    });
}