/* ==========================================================================
   js/ui.js - Handles DOM manipulation and rendering data to the screen
========================================================================== */
import GoalPlanner from "../ai/mod/goals/goalPlanner.js";

/* =====================================================
                RENDER STOCKS
===================================================== */
export function renderStocks(stocks) {
    const container = document.getElementById('stock-container');
    if (!container) return;

    container.innerHTML = stocks.map(stock => {
        const changeBg = stock.isPositive ? 'var(--positive-green)' : 'var(--negative-red)';
        const changeColor = stock.isPositive ? '#000' : '#fff';
        
        return `
            <div class="stock-card">
                <div class="stock-header">
                    <span class="stock-ticker">${stock.ticker}</span>
                    <span class="stock-change" style="background: ${changeBg}; color: ${changeColor}">
                        ${stock.change}
                    </span>
                </div>
                <div class="stock-price">${stock.price}</div>
                <div class="stock-desc">${stock.description}</div>
            </div>
        `;
    }).join('');
}

/* =====================================================
                RENDER NEWS
===================================================== */
export function renderNews(newsList) {
    const container = document.getElementById('news-container');
    if (!container) return;

    const getImage = (index) => {
        const images = [
            'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80'
        ];
        return images[index % images.length];
    };

    container.innerHTML = newsList.map((news, index) => `
        <div class="news-card">
            <div class="news-image" style="background-image: url('${getImage(index)}');"></div>
            <div class="news-content">
                <div class="news-category"><i class="${news.icon}"></i> ${news.category}</div>
                <div class="news-title">${news.title}</div>
                <div class="news-excerpt">${news.excerpt}</div>
                <div class="news-footer">
                    <span>${news.time}</span>
                    <i class="fa-regular fa-bookmark" style="cursor: pointer;"></i>
                </div>
            </div>
        </div>
    `).join('');
}

/* =====================================================
                RENDER TRANSACTIONS
===================================================== */
export function renderTransactions(transactions) {
    const container = document.getElementById("transaction-container");
    if (!container) return;

    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="news-card">
                <div class="news-content">
                    <h3>No Transactions Yet</h3>
                    <p>Add your first income or expense.</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map(transaction => {
        const isIncome = transaction.type === "income";
        const amountColor = isIncome ? "#00d26a" : "#ff4d4f";
        const amountPrefix = isIncome ? "+" : "-";

        return `
            <div class="news-card">
                <div class="news-content">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h3>${transaction.title}</h3>
                            <small>${transaction.category}</small>
                        </div>
                        <strong style="color:${amountColor}; font-size:18px;">
                            ${amountPrefix}₹${Number(transaction.amount).toLocaleString()}
                        </strong>
                    </div>
                    <div style="margin-top:8px; color:#8d97a5; font-size:13px;">
                        ${new Date(transaction.date).toLocaleDateString()}
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

/* =====================================================
                UPDATE DASHBOARD
===================================================== */
export function updateDashboard(summary) {
    /*
        Cache the same monthly income/expense values already calculated
        by the dashboard. The Goal Planner uses this exact data so the
        Optimize Plan modal never falls back to ₹0 unless the user
        genuinely has no monthly income/savings capacity.
    */
    if (summary) {
        currentFinancialData = {
            monthlyIncome: Number(
                summary.monthlyIncome ??
                summary.income ??
                0
            ) || 0,

            monthlyExpense: Number(
                summary.monthlyExpense ??
                summary.monthlyExpenses ??
                summary.expenses ??
                0
            ) || 0
        };
    }

    const netWorth = document.getElementById("net-worth");
    const monthlySaving = document.getElementById("monthly-saving");
    const goalText = document.getElementById("goal-progress");
    const goalBar = document.getElementById("goal-progress-bar");

    if (netWorth) {
        netWorth.textContent = "₹" + (Number(summary.netWorth) || 0).toLocaleString();
    }

    if (monthlySaving) {
        monthlySaving.textContent = "₹" + (Number(summary.monthlySavings) || 0).toLocaleString();
    }

    const progress = summary.income > 0 
        ? Math.round((summary.monthlySavings / summary.income) * 100) 
        : 0;

    if (goalText) goalText.textContent = progress + "%";
    if (goalBar) goalBar.style.width = progress + "%";
}

/* =====================================================
        UPDATE AI GOAL RECOMMENDATIONS
===================================================== */
export function updateAIRecommendations(goals) {
    // Keep the latest rendered goals available to the optimization modal.
    currentRenderedGoals = Array.isArray(goals) ? goals : [];

    const recommendationTextEl = document.getElementById("ai-recommendation-text");

    if (!recommendationTextEl) return;

    // No goals yet
    if (!goals || goals.length === 0) {
        recommendationTextEl.innerHTML =
            "Create your first financial goal above, and FinTack AI will calculate a savings plan for you.";
        return;
    }

    // Create a smart plan for every active goal
    const goalPlans = goals.map(goal => {
        const plan = GoalPlanner.createSmartPlan(
            goal,
            currentFinancialData
        );
        return {
            goal,
            plan
        };
    });

    console.log(
        "🎯 FinTack All Goal Plans:",
        goalPlans
    );

    // Keep only valid active plans
    const activePlans = goalPlans.filter(item =>
        item.plan &&
        item.plan.success &&
        item.plan.status === "active"
    );

    // Check whether every goal is already completed
    if (activePlans.length === 0) {
        const allCompleted = goalPlans.every(
            item => item.plan?.status === "completed"
        );

        if (allCompleted) {
            recommendationTextEl.innerHTML = `
                🎉 Congratulations! All your financial goals
                have been achieved.
            `;
        } else {
            recommendationTextEl.innerHTML = `
                FinTack couldn't calculate an active savings plan.
                Please check your goal amounts and deadlines.
            `;
        }
        return;
    }

    // Calculate combined saving requirement
    const totalDaily = activePlans.reduce(
        (sum, item) => sum + (Number(item.plan.required?.daily) || 0),
        0
    );
    
    const totalWeekly = activePlans.reduce(
        (sum, item) => sum + (Number(item.plan.required?.weekly) || 0),
        0
    );
    
    const totalMonthly = activePlans.reduce(
        (sum, item) => sum + (Number(item.plan.required?.monthly) || 0),
        0
    );

    // Build compact individual goal breakdown
    const goalBreakdown = activePlans.map(item => {
        const goal = item.goal;
        const plan = item.plan;
        const monthly = Number(plan.required?.monthly) || 0;

        return `
            <div class="ai-goal-plan-item">
                <strong>${goal.title}</strong>
                <span>
                    ₹${monthly.toLocaleString("en-IN")}/month
                </span>
            </div>
        `;
    }).join("");

    // Render combined AI recommendation
    recommendationTextEl.innerHTML = `
        <div class="ai-goal-summary">
            <div class="ai-goal-summary-title">
                ${activePlans.length} Active Goal${activePlans.length > 1 ? "s" : ""}
            </div>

            <div class="ai-goal-breakdown">
                ${goalBreakdown}
            </div>

            <div class="ai-goal-total">
                <span>Total Required</span>
                <strong>
                    ₹${totalMonthly.toLocaleString("en-IN")} / month
                </strong>
            </div>

            <div class="ai-goal-frequency">
                ₹${totalDaily.toLocaleString("en-IN")}/day • ₹${totalWeekly.toLocaleString("en-IN")}/week
            </div>
        </div>
    `;
}

/* =====================================================
                RENDER GOALS
===================================================== */
export function renderGoals(goals) {
    const container = document.getElementById("goals-container");
    if (!container) return;

    // Trigger the dynamic recommendation engine 
    updateAIRecommendations(goals);

    if (!goals || goals.length === 0) {
        container.innerHTML = `
            <div class="news-card">
                <div class="news-content">
                    <h3>No Goals Yet</h3>
                    <p>Create your first financial goal.</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = goals.map(goal => {
        const targetAmount = Number(goal.target_amount) || 0;
        const savedAmount = Number(goal.saved_amount) || 0;
        const progress = targetAmount > 0 
            ? Math.min(Math.round((savedAmount / targetAmount) * 100), 100) 
            : 0;

        return `
            <div class="goal-card">
                <div class="goal-icon-wrapper">
                    <i class="fa-solid fa-bullseye"></i>
                </div>
                <div class="goal-content">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3>${goal.title}</h3>
                        <strong style="color:#7bbcff;">${progress}%</strong>
                    </div>
                    
                    <p class="goal-description">
                        Deadline: ${new Date(goal.deadline).toLocaleDateString()}
                    </p>
                    
                    <div class="goal-meta">
                        <span class="goal-badge">
                            ₹${savedAmount.toLocaleString()} / ₹${targetAmount.toLocaleString()}
                        </span>
                    </div>
                    
                    <div class="progress-bar">
                        <div class="progress" style="width:${progress}%"></div>
                    </div>
                    
                    <div class="goal-actions">
                        <button class="goal-save-btn" data-id="${goal.id}">
                            <i class="fa-solid fa-plus"></i> Add Savings
                        </button>
                        <button class="small-btn edit-goal-btn" data-id="${goal.id}">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="small-btn delete-goal-btn" data-id="${goal.id}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

/* =====================================================
                UPDATE GOAL SUMMARY
===================================================== */
export function updateGoalSummary(goals) {
    const totalSaved = goals.reduce((sum, goal) => sum + (Number(goal.saved_amount) || 0), 0);
    const totalTarget = goals.reduce((sum, goal) => sum + (Number(goal.target_amount) || 0), 0);
    const progress = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

    const progressPercentEl = document.getElementById("overall-progress-percent");
    const activeGoalsCountEl = document.getElementById("active-goals-count");
    const overallSavedEl = document.getElementById("overall-saved");
    const overallTargetEl = document.getElementById("overall-target");
    const overallProgressBarEl = document.getElementById("overall-progress-bar");

    if (progressPercentEl) progressPercentEl.textContent = progress + "%";
    if (activeGoalsCountEl) activeGoalsCountEl.textContent = goals.length;
    if (overallSavedEl) overallSavedEl.textContent = "₹" + totalSaved.toLocaleString() + " Saved";
    if (overallTargetEl) overallTargetEl.textContent = "₹" + totalTarget.toLocaleString() + " Target";
    if (overallProgressBarEl) overallProgressBarEl.style.width = progress + "%";
}
/* =========================================================
   OPTIMIZE GOAL PLAN
========================================================= */
/*
    Keep the latest goals rendered by the Goals screen available
    to the optimization modal. This avoids duplicating goal storage
    logic inside the modal.
*/
let currentRenderedGoals = [];
let currentFinancialData = {
    monthlyIncome: 0,
    monthlyExpense: 0
};

/*
    NOTE:
    renderGoals() calls updateAIRecommendations(goals), so the modal can
    safely obtain the latest goals from the DOM-independent cache below.
*/
function getOptimizationGoals() {
    return Array.isArray(currentRenderedGoals) ? currentRenderedGoals : [];
}

document.addEventListener("click", (event) => {
    const optimizeButton = event.target.closest("#optimizeGoalPlanBtn");
    if (!optimizeButton) return;

    console.log("🎯 Optimize Plan clicked");
    openGoalOptimizationPlan();
});

function formatINR(value) {
    const amount = Number(value) || 0;
    return "₹" + Math.round(amount).toLocaleString("en-IN");
}

function calculateGoalOptimization(goals) {
    const plans = goals
        .map(goal => ({
            goal,
            plan: GoalPlanner.createSmartPlan(
                goal,
                currentFinancialData
            )
        }))
        .filter(item =>
            item.plan &&
            item.plan.success &&
            item.plan.status === "active"
        );

    const totalMonthly = plans.reduce(
        (sum, item) => sum + (Number(item.plan.required?.monthly) || 0),
        0
    );

    const totalWeekly = plans.reduce(
        (sum, item) => sum + (Number(item.plan.required?.weekly) || 0),
        0
    );

    const totalDaily = plans.reduce(
        (sum, item) => sum + (Number(item.plan.required?.daily) || 0),
        0
    );

    /*
        GoalPlanner may expose affordability data. Use it when present.
        If it is unavailable, the modal still shows the deadline-based
        savings requirements without inventing financial capacity.
    */
    const capacities = plans
        .map(item => Number(item.plan.affordability?.availableMonthlySavings))
        .filter(Number.isFinite);

    const availableMonthly =
        capacities.length > 0 ? Math.max(...capacities) : null;

    const shortfall =
        availableMonthly === null
            ? null
            : Math.max(totalMonthly - availableMonthly, 0);

    const affordable =
        availableMonthly === null
            ? null
            : totalMonthly <= availableMonthly;

    /*
        Allocate available monthly savings proportionally across goals
        when the deadline requirements exceed capacity. Otherwise each
        goal receives its full required monthly amount.
    */
    const optimizedGoals = plans.map(item => {
        const requiredMonthly =
            Number(item.plan.required?.monthly) || 0;

        let recommendedMonthly = requiredMonthly;

        if (
            availableMonthly !== null &&
            totalMonthly > availableMonthly &&
            totalMonthly > 0
        ) {
            recommendedMonthly =
                availableMonthly *
                (requiredMonthly / totalMonthly);
        }

        return {
            goal: item.goal,
            plan: item.plan,
            requiredMonthly,
            recommendedMonthly
        };
    });

    return {
        plans,
        optimizedGoals,
        totalMonthly,
        totalWeekly,
        totalDaily,
        availableMonthly,
        shortfall,
        affordable
    };
}

function renderGoalOptimizationResult(content, result) {
    if (!content) return;

    if (!result.plans.length) {
        content.innerHTML = `
            <div class="optimization-empty">
                <i class="fa-solid fa-circle-info"></i>
                <h3>No active goals to optimize</h3>
                <p>Create an active financial goal with a valid target amount and a future deadline first.</p>
            </div>
        `;
        return;
    }

    const goalRows = result.optimizedGoals.map(item => {
        const deadline = item.goal.deadline
            ? new Date(item.goal.deadline).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric"
            })
            : "No deadline";

        const allocationChanged =
            Math.round(item.recommendedMonthly) !== Math.round(item.requiredMonthly);

        return `
            <div class="optimization-goal-item">
                <div class="optimization-goal-top">
                    <div>
                        <strong>${item.goal.title}</strong>
                        <span>Target deadline: ${deadline}</span>
                    </div>
                    <strong class="optimization-goal-required">
                        ${formatINR(item.requiredMonthly)}/month
                    </strong>
                </div>

                ${allocationChanged ? `
                    <div class="optimization-goal-allocation">
                        <span>Recommended contribution</span>
                        <strong>${formatINR(item.recommendedMonthly)}/month</strong>
                    </div>
                ` : ""}
            </div>
        `;
    }).join("");

    let overviewText = "";
    let statusBlock = "";

    if (result.availableMonthly !== null) {
        const remaining = Math.max(
            result.availableMonthly - result.totalMonthly,
            0
        );

        overviewText = `
            <div class="optimization-overview-text">
                <h3>Your Savings Overview</h3>
                <p> <br>
                    You currently have
                    <strong>${result.plans.length} active goal${result.plans.length > 1 ? "s" : ""}</strong>,
                    requiring a total contribution of
                    <strong>${formatINR(result.totalMonthly)} per month</strong>.
                 </br></p>
                <p>
                    Your current financial activity leaves
                    <strong>${formatINR(result.availableMonthly)} available for monthly savings</strong>.
                    ${result.affordable
                        ? `After funding ${result.plans.length > 1 ? "these goals" : "this goal"}, you would have approximately <strong>${formatINR(remaining)}</strong> remaining each month.`
                        : `This is currently <strong>${formatINR(result.shortfall)}</strong> below the amount required to meet ${result.plans.length > 1 ? "all deadlines" : "the deadline"}.`
                    }
                </p>
            </div>
        `;

        if (result.affordable) {
            statusBlock = `
                <div class="optimization-status success">
                    <br><i class="fa-solid fa-circle-check"><strong>Your current plan is achievable.</strong></i></br>
                    <div>
                        
                        <span><br>
                            Based on your current financial capacity, you can meet the required
                            ${result.plans.length > 1 ? "contributions" : "contribution"} within the existing
                            ${result.plans.length > 1 ? "deadlines" : "deadline"}.
                        </br></span>
                    </div>
                </div>
            `;
        } else {
            statusBlock = `
                <div class="optimization-status warning">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <div>
                        <strong>Your current plan needs adjustment.</strong>
                        <span>
                            You need an additional ${formatINR(result.shortfall)} per month to meet
                            ${result.plans.length > 1 ? "all current deadlines" : "the current deadline"}.
                            FinTack has therefore calculated a suggested allocation based on your available savings.
                        </span>
                    </div>
                </div>
            `;
        }
    } else {
        overviewText = `
            <div class="optimization-overview-text">
                <h3>Your Savings Overview</h3>
                <p>
                    You currently have
                    <strong>${result.plans.length} active goal${result.plans.length > 1 ? "s" : ""}</strong>,
                    requiring a total contribution of
                    <strong>${formatINR(result.totalMonthly)} per month</strong>.
                </p>
            </div>
        `;

        statusBlock = `
            <div class="optimization-status">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <div>
                    <strong>Your deadline-based savings plan is ready.</strong>
                    <span>
                        Financial capacity data is currently unavailable, so this plan shows the
                        contribution required to meet ${result.plans.length > 1 ? "your deadlines" : "your deadline"}.
                    </span>
                </div>
            </div>
        `;
    }

    content.innerHTML = `
        <div class="optimization-result">
            ${overviewText}
            ${statusBlock}

            <div class="optimization-section-title">
                ${result.plans.length > 1 ? "Goal Contributions" : "Goal Contribution"}
            </div>

            <div class="optimization-goals-list">
                ${goalRows}
            </div>

            <div class="optimization-section-title">
                Savings Schedule
            </div>

            <div class="optimization-frequency">
                <div>
                    <span>Daily</span>
                    <strong>${formatINR(result.totalDaily)}</strong>
                </div>
                <div>
                    <span>Weekly</span>
                    <strong>${formatINR(result.totalWeekly)}</strong>
                </div>
                <div>
                    <span>Monthly</span>
                    <strong>${formatINR(result.totalMonthly)}</strong>
                </div>
            </div>

            <p class="optimization-frequency-note">
                To stay on schedule, aim to save
                <strong>${formatINR(result.totalDaily)} per day</strong>,
                <strong>${formatINR(result.totalWeekly)} per week</strong>,
                or <strong>${formatINR(result.totalMonthly)} per month</strong>.
            </p>
        </div>
    `;
}
function openGoalOptimizationPlan() {
    console.log("🧠 Opening FinTack Smart Goal Plan");

    const existingModal =
        document.getElementById("goalOptimizationModal");

    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement("div");

    modal.id = "goalOptimizationModal";
    modal.className = "goal-optimization-overlay";

    modal.innerHTML = `
        <div class="goal-optimization-modal">

            <div class="goal-optimization-header">

                <div>
                    <span class="goal-optimization-label">
                        FINTACK AI
                    </span>

                    <h2>Smart Savings Plan</h2>

                    <p>
                        Optimize your goals based on your
                        current financial capacity.
                    </p>
                </div>

                <button
                    class="goal-optimization-close"
                    id="closeGoalOptimization"
                    aria-label="Close"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

            </div>

            <div
                class="goal-optimization-content"
                id="goalOptimizationContent"
            >
                <div class="optimization-loading">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    <span>
                        Analyzing your financial plan...
                    </span>
                </div>
            </div>

            <div class="goal-optimization-actions">

                <button
                    class="optimization-cancel-btn"
                    id="cancelGoalOptimization"
                >
                    Cancel
                </button>

                <button
                    class="optimization-apply-btn"
                    id="applyGoalOptimization"
                    disabled
                >
                    Apply Optimized Plan
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const closeModal = () => {
        modal.remove();
        document.body.style.overflow = "";
    };

    document
        .getElementById("closeGoalOptimization")
        ?.addEventListener("click", closeModal);

    document
        .getElementById("cancelGoalOptimization")
        ?.addEventListener("click", closeModal);

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeModal();
        }
    });

    /*
        Allow the loading state to render first, then perform the
        calculation. This keeps the modal responsive and preserves
        the existing loading design.
    */
    window.setTimeout(async () => {
        const content =
            document.getElementById("goalOptimizationContent");

        const applyButton =
            document.getElementById("applyGoalOptimization");

        try {
            const goals = getOptimizationGoals();

            /*
                Refresh transactions when Optimize Plan is opened.
                This makes the optimizer use the latest data even after
                transactions are added from Calendar or the + button.
            */
            try {
                const user = JSON.parse(
                    localStorage.getItem("user") || "null"
                );

                if (user?.id) {
                    const response = await fetch(
                        `https://fintack.onrender.com/api/transactions/${user.id}`
                    );

                    if (response.ok) {
                        const payload = await response.json();

                        const transactions = Array.isArray(payload)
                            ? payload
                            : Array.isArray(payload.transactions)
                                ? payload.transactions
                                : [];

                        const now = new Date();
                        let monthlyIncome = 0;
                        let monthlyExpense = 0;

                        transactions.forEach(transaction => {
                            const date = new Date(transaction.date);

                            if (
                                Number.isNaN(date.getTime()) ||
                                date.getFullYear() !== now.getFullYear() ||
                                date.getMonth() !== now.getMonth()
                            ) {
                                return;
                            }

                            const amount =
                                Number(transaction.amount) || 0;

                            if (transaction.type === "income") {
                                monthlyIncome += amount;
                            } else if (transaction.type === "expense") {
                                monthlyExpense += amount;
                            }
                        });

                        currentFinancialData = {
                            monthlyIncome,
                            monthlyExpense
                        };

                        console.log(
                            "💰 FinTack Goal Financial Capacity:",
                            currentFinancialData
                        );
                    }
                }
            } catch (financialError) {
                /*
                    Do not break the optimizer if the refresh request
                    fails. It can still use the last dashboard values.
                */
                console.warn(
                    "⚠️ Could not refresh optimizer financial data:",
                    financialError
                );
            }

            const result = calculateGoalOptimization(goals);

            renderGoalOptimizationResult(content, result);

            if (applyButton && result.plans.length > 0) {
                applyButton.disabled = false;

                applyButton.onclick = () => {
                    /*
                        The calculated allocation is exposed as an event
                        rather than silently modifying saved_amount.
                        Applying a savings plan must not falsely claim
                        that money has already been saved.
                    */
                    window.dispatchEvent(
                        new CustomEvent(
                            "fintack:goal-plan-optimized",
                            {
                                detail: {
                                    generatedAt:
                                        new Date().toISOString(),

                                    totalRequiredMonthly:
                                        result.totalMonthly,

                                    availableMonthly:
                                        result.availableMonthly,

                                    allocations:
                                        result.optimizedGoals.map(
                                            item => ({
                                                goalId: item.goal.id,
                                                title: item.goal.title,
                                                requiredMonthly:
                                                    Math.round(
                                                        item.requiredMonthly
                                                    ),
                                                recommendedMonthly:
                                                    Math.round(
                                                        item.recommendedMonthly
                                                    )
                                            })
                                        )
                                }
                            }
                        )
                    );

                    console.log(
                        "✨ FinTack Optimized Goal Plan Applied:",
                        result
                    );

                    applyButton.textContent = "Plan Applied";
                    applyButton.disabled = true;

                    window.setTimeout(closeModal, 700);
                };
            }

        } catch (error) {
            console.error(
                "❌ FinTack Goal Optimization Error:",
                error
            );

            if (content) {
                content.innerHTML = `
                    <div class="optimization-empty">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <h3>Unable to calculate plan</h3>
                        <p>
                            FinTack couldn't generate the savings plan.
                            Please verify your goal amounts and deadlines.
                        </p>
                    </div>
                `;
            }
        }
    }, 350);
}
