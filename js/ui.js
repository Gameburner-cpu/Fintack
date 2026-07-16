/* ==========================================================================
   js/ui.js - Handles DOM manipulation and rendering data to the screen
   ========================================================================== */

function renderStocks(stocks) {
    const container = document.getElementById('stock-container');
    if (!container) return;

    // Map through the stock data and create HTML for each card
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

function renderNews(newsList) {
    const container = document.getElementById('news-container');
    if (!container) return;

    // Use placeholder images from Unsplash based on the category
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

    console.log("renderTransactions()", transactions);

    const container = document.getElementById("transaction-container");

    console.log("Container:", container);

    if (!container) {

        console.error("transaction-container not found.");

        return;

    }

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

        return `

            <div class="news-card">

                <div class="news-content">

                    <div
                        style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;">

                        <div>

                            <h3>${transaction.title}</h3>

                            <small>${transaction.category}</small>

                        </div>

                        <strong
                            style="
                            color:${isIncome ? "#00d26a" : "#ff4d4f"};
                            font-size:18px;">

                            ${isIncome ? "+" : "-"}₹${Number(transaction.amount).toLocaleString()}

                        </strong>

                    </div>

                    <div
                        style="
                        margin-top:8px;
                        color:#8d97a5;
                        font-size:13px;">

                        ${new Date(transaction.date).toLocaleDateString()}

                    </div>

                </div>

            </div>

        `;

    }).join("");

}
function updateDashboard(summary) {

    const netWorth = document.getElementById("net-worth");
    const monthlySaving = document.getElementById("monthly-saving");
    const goalText = document.getElementById("goal-progress");
    const goalBar = document.getElementById("goal-progress-bar");

    if (netWorth) {
        netWorth.textContent =
            "₹" + summary.netWorth.toLocaleString();
    }

    if (monthlySaving) {
        monthlySaving.textContent =
            "₹" + summary.monthlySavings.toLocaleString();
    }

    const progress =
        summary.income > 0
            ? Math.round((summary.monthlySavings / summary.income) * 100)
            : 0;

    if (goalText)
        goalText.textContent = progress + "%";

    if (goalBar)
        goalBar.style.width = progress + "%";
}

/* =====================================================
                    RENDER GOALS
===================================================== */

function renderGoals(goals) {

    const container = document.getElementById("goals-container");

    if (!container) return;

    if (!goals.length) {

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

        const progress = Math.min(
            Math.round((goal.saved_amount / goal.target_amount) * 100),
            100
        );

        return `

<div class="goal-card">

    <div class="goal-icon-wrapper">

        <i class="fa-solid fa-bullseye"></i>

    </div>

    <div style="flex:1;">

        <div
            style="
            display:flex;
            justify-content:space-between;
            align-items:center;">

            <h3>

                ${goal.title}

            </h3>

            <strong
                style="
                color:#7bbcff;">

                ${progress}%

            </strong>

        </div>

        <p
            class="goal-description">

            Deadline:
            ${new Date(goal.deadline).toLocaleDateString()}

        </p>

        <div
            class="goal-meta">

            <span
                class="goal-badge">

                ₹${Number(goal.saved_amount).toLocaleString()}
                /
                ₹${Number(goal.target_amount).toLocaleString()}

            </span>

        </div>

        <div class="progress-bar">

            <div
                class="progress"
                style="width:${progress}%">

            </div>

        </div>

        <div
            style="
            display:flex;
            gap:10px;
            margin-top:15px;">

            <button
    class="goal-save-btn"
    data-id="${goal.id}">

    <i class="fa-solid fa-plus"></i>

    Add Savings

</button>

            <button
                class="small-btn edit-goal-btn"
                data-id="${goal.id}">

                <i class="fa-solid fa-pen"></i>

            </button>

            <button
                class="small-btn delete-goal-btn"
                data-id="${goal.id}">

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

    const totalSaved = goals.reduce(

        (sum, goal) => sum + Number(goal.saved_amount),

        0

    );

    const totalTarget = goals.reduce(

        (sum, goal) => sum + Number(goal.target_amount),

        0

    );

    const progress =

        totalTarget > 0

            ? Math.round((totalSaved / totalTarget) * 100)

            : 0;

    document.getElementById("overall-progress-percent").textContent =
        progress + "%";

    document.getElementById("active-goals-count").textContent =
        goals.length;

    document.getElementById("overall-saved").textContent =
        "₹" + totalSaved.toLocaleString() + " Saved";

    document.getElementById("overall-target").textContent =
        "₹" + totalTarget.toLocaleString() + " Target";

    document.getElementById("overall-progress-bar").style.width =
        progress + "%";

}