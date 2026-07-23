/* ==========================================================================
   js/ui.js - Handles DOM manipulation and rendering data to the screen
========================================================================== */

/* =====================================================
                RENDER STOCKS
===================================================== */
function renderStocks(stocks) {
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
function renderNews(newsList) {
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
function renderTransactions(transactions) {
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
function updateDashboard(summary) {
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
                UPDATE AI RECOMMENDATIONS
===================================================== */
function updateAIRecommendations(goals) {
    const recommendationTextEl = document.getElementById("ai-recommendation-text");
    if (!recommendationTextEl) return;

    if (!goals || goals.length === 0) {
        recommendationTextEl.innerHTML = "Create your first financial goal above, and FinTack AI will analyze your strategy here.";
        return;
    }

    // Sort goals to look at the one closest to completion or highest target priority
    const primaryGoal = goals[0];
    const targetAmount = Number(primaryGoal.target_amount) || 0;
    const savedAmount = Number(primaryGoal.saved_amount) || 0;
    const remaining = targetAmount - savedAmount;

    if (remaining <= 0) {
        recommendationTextEl.innerHTML = `🎉 Congratulations! You have fully achieved your <strong>${primaryGoal.title}</strong> goal! Use the planner to chart your next target.`;
        return;
    }

    // Generate simulated context-aware recommendations matching your UI design patterns
    const smartBoost = Math.max(1000, Math.round((targetAmount * 0.02) / 100) * 100); 
    const monthsSaved = Math.min(6, Math.max(1, Math.round(remaining / (smartBoost * 5))));

    recommendationTextEl.innerHTML = `Increase your monthly savings allocation by <strong>₹${smartBoost.toLocaleString("en-IN")}</strong> to reach your <strong>${primaryGoal.title}</strong> target nearly <strong>${monthsSaved} months earlier</strong>.`;
}

/* =====================================================
                RENDER GOALS
===================================================== */
function renderGoals(goals) {
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
function updateGoalSummary(goals) {
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