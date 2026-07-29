/* ==========================================================================
   tripCards.js
   UI Card Builders for Trip Module
========================================================================== */

import MoneyFormatter from "../../utils/MoneyFormatter.js";

/* ==========================================================
                    Helpers
========================================================== */

function safe(value, fallback = "-") {

    return value === undefined ||
        value === null ||
        value === ""

        ? fallback

        : value;

}

function money(amount) {

    return MoneyFormatter.format(

        Number(amount || 0)

    );

}

function escapeHtml(text = "") {

    return String(text)

        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

/* ==========================================================
                    TRIP CARD
========================================================== */

export function formatTripCard(trip) {

    if (!trip) {

        return `

        <div class="trip-card">

            <div class="trip-header">

                <h3>🏕️ Trip Created</h3>

            </div>

            <div class="trip-body">

                <p>Your trip has been created successfully.</p>

            </div>

        </div>

        `;

    }

    const name =

        safe(

            trip.trip_name ||

            trip.name,

            "New Trip"

        );

    const memberCount =

        Array.isArray(trip.members)

            ? trip.members.length

            : (

                trip.member_count ||

                0

            );

    const totalExpense =

        trip.total_expense ??

        trip.totalExpense ??

        0;

    return `

    <div class="trip-card">

        <div class="trip-header">

            <h3>🏕️ ${escapeHtml(name)}</h3>

        </div>

        <div class="trip-body">

            <p>

                <strong>Status</strong>

                <span>Active</span>

            </p>

            <p>

                <strong>Members</strong>

                <span>${memberCount}</span>

            </p>

            <p>

                <strong>Total Expense</strong>

                <span>${money(totalExpense)}</span>

            </p>

        </div>

    </div>

    `;

}

/* ==========================================================
                    MEMBERS CARD
========================================================== */

export function formatMembersCard(data) {

    const members = data?.members || [];

    const list =

        members.length

            ? members.map(member => {

                const name =

                    typeof member === "string"

                        ? member

                        : (

                            member.member_name ||

                            member.name ||

                            member.full_name ||

                            member.username ||

                            "Unknown"

                        );

                return `

                    <li>

                        👤 ${escapeHtml(name)}

                    </li>

                `;

            }).join("")

            : `

                <li>

                    No members added yet.

                </li>

            `;

    return `

    <div class="trip-card">

        <div class="trip-header">

            <h3>👥 Members</h3>

        </div>

        <div class="trip-body">

            <p>

                <strong>Total Members</strong>

                <span>${members.length}</span>

            </p>

            <ul class="trip-member-list">

                ${list}

            </ul>

        </div>

    </div>

    `;

}
/* ==========================================================
                    EXPENSE CARD
========================================================== */

export function formatExpenseCard(expense) {

    if (!expense) {

        return `

        <div class="trip-card">

            <div class="trip-header">

                <h3>💰 Expense Added</h3>

            </div>

            <div class="trip-body">

                <p>Expense added successfully.</p>

            </div>

        </div>

        `;

    }

    const title =

        safe(

            expense.title ||

            expense.purpose ||

            expense.description,

            "General"

        );

    const paidBy =

        safe(

            expense.paid_by ||

            expense.paidBy ||

            expense.payer ||

            expense.member,

            "Unknown"

        );

    const amount =

        money(

            expense.amount

        );

    const category =

        safe(

            expense.category,

            "General"

        );

    const notes =

        expense.notes

            ? `

            <p>

                <strong>Notes</strong>

                <span>${escapeHtml(expense.notes)}</span>

            </p>

            `

            : "";

    return `

    <div class="trip-card">

        <div class="trip-header">

            <h3>💰 Expense Added</h3>

        </div>

        <div class="trip-body">

            <p>

                <strong>Purpose</strong>

                <span>${escapeHtml(title)}</span>

            </p>

            <p>

                <strong>Paid By</strong>

                <span>${escapeHtml(paidBy)}</span>

            </p>

            <p>

                <strong>Amount</strong>

                <span>${amount}</span>

            </p>

            <p>

                <strong>Category</strong>

                <span>${escapeHtml(category)}</span>

            </p>

            ${notes}

        </div>

    </div>

    `;

}

/* ==========================================================
                    TRIP SUMMARY
========================================================== */

export function formatTripSummary(summary) {

    const members =

        summary.members ||

        [];

    const expenses =

        summary.expenses ||

        [];

    const totalExpense =

        expenses.reduce(

            (

                total,

                expense

            ) =>

                total +

                Number(

                    expense.amount ||

                    0

                ),

            0

        );

    const expenseRows =

        expenses.length

            ? expenses.map(expense => {

                const title =

                    safe(

                        expense.title,

                        "General"

                    );

                const paidBy =

                    safe(

                        expense.paid_by,

                        "Unknown"

                    );

                return `

                <tr>

                    <td>

                        ${escapeHtml(title)}

                    </td>

                    <td>

                        ${escapeHtml(paidBy)}

                    </td>

                    <td>

                        ${money(expense.amount)}

                    </td>

                </tr>

                `;

            }).join("")

            : `

            <tr>

                <td colspan="3">

                    No expenses added yet.

                </td>

            </tr>

            `;

    return `

    <div class="trip-card">

        <div class="trip-header">

            <h3>📊 Trip Summary</h3>

        </div>

        <div class="trip-body">

            <p>

                <strong>Total Members</strong>

                <span>${members.length}</span>

            </p>

            <p>

                <strong>Total Expenses</strong>

                <span>${expenses.length}</span>

            </p>

            <p>

                <strong>Total Amount</strong>

                <span>${money(totalExpense)}</span>

            </p>

            <h4>

                Recent Expenses

            </h4>

            <table class="trip-expense-table">

                <thead>

                    <tr>

                        <th>Expense</th>

                        <th>Paid By</th>

                        <th>Amount</th>

                    </tr>

                </thead>

                <tbody>

                    ${expenseRows}

                </tbody>

            </table>

        </div>

    </div>

    `;

}
/* ==========================================================
                    SETTLEMENT CARD
========================================================== */

export function formatSettlementCard(data) {

    const settlements =
        Array.isArray(data?.settlements)
            ? data.settlements
            : [];

    const balances =
        data?.balances &&
        typeof data.balances === "object"
            ? data.balances
            : {};

    /*
       A positive balance means the member should receive money.
       A negative balance means the member owes money.
       We keep this information available, but present it in
       plain language instead of showing confusing +/- numbers.
    */

    const balanceEntries =
        Object.entries(balances);

    const memberCount =
        balanceEntries.length;

    /*
       Calculate total money represented by positive balances.
       This is useful as a quick settlement overview.
    */

    const totalToSettle =
        balanceEntries.reduce(
            (total, [, amount]) => {

                const value =
                    Number(amount || 0);

                return value > 0
                    ? total + value
                    : total;

            },
            0
        );

    /*
       Build simple "who pays whom" cards.
    */

    const settlementCards =
        settlements.length

            ? settlements.map(settlement => {

                const from =
                    settlement.from ||
                    settlement.from_member ||
                    settlement.payer ||
                    "Unknown";

                const to =
                    settlement.to ||
                    settlement.to_member ||
                    settlement.receiver ||
                    "Unknown";

                const amount =
                    Number(
                        settlement.amount || 0
                    );

                return `

                <div class="trip-settlement-item">

                    <div class="trip-settlement-route">

                        <span class="trip-settlement-person">
                            👤 ${escapeHtml(from)}
                        </span>

                        <span class="trip-settlement-arrow">
                            →
                        </span>

                        <span class="trip-settlement-person">
                            👤 ${escapeHtml(to)}
                        </span>

                    </div>

                    <div class="trip-settlement-payment">

                        <span>Pay</span>

                        <strong>
                            ${money(amount)}
                        </strong>

                    </div>

                </div>

                `;

            }).join("")

            : `

            <div class="trip-settlement-complete">

                <div class="trip-settlement-complete-icon">
                    🎉
                </div>

                <strong>
                    Everyone is settled up!
                </strong>

                <span>
                    No payments are required.
                </span>

            </div>

            `;

    /*
       Build optional explanation of each member's position.
       This avoids displaying raw negative numbers without context.
    */

    const memberStatus =
        balanceEntries.length

            ? balanceEntries.map(
                ([member, amount]) => {

                    const value =
                        Number(amount || 0);

                    let status = "";
                    let statusClass = "";

                    if (value < 0) {

                        status =
                            `Owes ${money(Math.abs(value))}`;

                        statusClass =
                            "owes";

                    }

                    else if (value > 0) {

                        status =
                            `Gets back ${money(value)}`;

                        statusClass =
                            "receives";

                    }

                    else {

                        status =
                            "Settled";

                        statusClass =
                            "settled";

                    }

                    return `

                    <div class="trip-member-balance-item">

                        <span class="trip-member-balance-name">

                            👤 ${escapeHtml(member)}

                        </span>

                        <span class="trip-member-balance-status ${statusClass}">

                            ${status}

                        </span>

                    </div>

                    `;

                }
            ).join("")

            : "";

    return `

    <div class="trip-card trip-settlement-card">

        <div class="trip-header">

            <h3>
                💸 Trip Settlement
            </h3>

        </div>

        <div class="trip-body">

            ${
                memberCount
                    ? `
                    <div class="trip-settlement-overview">

                        <div class="trip-settlement-overview-item">

                            <span>Members</span>

                            <strong>
                                ${memberCount}
                            </strong>

                        </div>

                        <div class="trip-settlement-overview-item">

                            <span>Amount to settle</span>

                            <strong>
                                ${money(totalToSettle)}
                            </strong>

                        </div>

                    </div>
                    `
                    : ""
            }

            <div class="trip-settlement-section">

                <h4>
                    Who should pay whom?
                </h4>

                <div class="trip-settlement-list">

                    ${settlementCards}

                </div>

            </div>

            ${
                memberStatus
                    ? `
                    <div class="trip-settlement-section trip-member-status-section">

                        <h4>
                            Member Status
                        </h4>

                        <div class="trip-member-balance-list">

                            ${memberStatus}

                        </div>

                        <div class="trip-settlement-help">

                            <span>
                                💡
                            </span>

                            <p>
                                "Owes" means that person needs to pay.
                                "Gets back" means that person should receive money.
                            </p>

                        </div>

                    </div>
                    `
                    : ""
            }

        </div>

    </div>

    `;

}
