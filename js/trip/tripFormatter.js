/* ==========================================================
                TRIP FORMATTER
========================================================== */

/* ==========================================================
                CREATE TRIP CARD
========================================================== */

function formatTripCard(trip) {
    if (!trip) {
        return `<div class="ai-card trip-card"><div>Trip details unavailable.</div></div>`;
    }

    const name = trip.name || "Trip";
    const membersCount = trip.members && Array.isArray(trip.members) ? trip.members.length : 0;
    const totalExp = typeof getTotalExpense === "function" ? getTotalExpense(trip) : 0;

    return `
    <div class="ai-card trip-card">
        <div class="trip-title">
            🏖 ${name}
        </div>
        <div class="trip-stat">
            👥 Members
            <strong>${membersCount}</strong>
        </div>
        <div class="trip-stat">
            💰 Expenses
            <strong>₹${Number(totalExp).toLocaleString()}</strong>
        </div>
    </div>
    `;
}

/* ==========================================================
                MEMBERS CARD
========================================================== */

function formatMembersCard(trip) {

    if (!trip || !Array.isArray(trip.members)) {
        return `
        <div class="ai-card">
            <h3>👥 Members</h3>
            <p>No members found.</p>
        </div>`;
    }

    return `
    <div class="ai-card">
        <h3>👥 Members</h3>

        ${trip.members.map(member => `
            <div class="trip-member">
                ✅ ${member.member_name}
            </div>
        `).join("")}

    </div>
    `;
}

/* ==========================================================
                EXPENSE CARD
========================================================== */

function formatExpenseCard(expense) {
    if (!expense) {
        return `<div class="ai-card"><span>Expense recorded successfully.</span></div>`;
    }

    const title = expense.title || "Expense";
    const paidBy = expense.paidBy || "Member";
    const amount = Number(expense.amount || 0);

    return `
    <div class="ai-card">
        <h3>${title}</h3>
        <div class="trip-stat">
            💳 Paid by
            <strong>${paidBy}</strong>
        </div>
        <div class="trip-stat">
            💰 Amount
            <strong>
                ₹${amount.toLocaleString()}
            </strong>
        </div>
    </div>
    `;
}

/* ==========================================================
                SUMMARY CARD
========================================================== */

function formatTripSummary(summary) {
    if (!summary) {
        return `<div class="ai-card"><h3>📊 Trip Summary</h3><p>Summary unavailable.</p></div>`;
    }

    const totalExpense = Number(summary.totalExpense || 0);
    const members = summary.members || 0;
    const perPerson = Number(summary.perPerson || 0);

    return `
    <div class="ai-card">
        <h3>📊 Trip Summary</h3>
        <div class="trip-stat">
            Total Expense
            <strong>
                ₹${totalExpense.toLocaleString()}
            </strong>
        </div>
        <div class="trip-stat">
            Members
            <strong>
                ${members}
            </strong>
        </div>
        <div class="trip-stat">
            Per Person
            <strong>
                ₹${perPerson.toFixed(2)}
            </strong>
        </div>
    </div>
    `;
}

/* ==========================================================
                SETTLEMENT CARD
========================================================== */

function formatSettlementCard(settlements) {
    if (!settlements || !Array.isArray(settlements) || settlements.length === 0) {
        return `
        <div class="ai-card">
            <h3>✅ Everyone is Settled</h3>
        </div>
        `;
    }

    return `
    <div class="ai-card">
        <h3>💸 Settlement</h3>
        ${settlements.map(item => `
            <div class="trip-settlement">
                <span>
                    ${item.from || "Someone"}
                    ➜
                    ${item.to || "Someone"}
                </span>
                <strong>
                    ₹${Number(item.amount || 0).toFixed(2)}
                </strong>
            </div>
        `).join("")}
    </div>
    `;
}