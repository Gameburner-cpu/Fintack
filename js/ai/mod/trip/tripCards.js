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

        data?.settlements ||

        [];

    const balances =

        data?.balances ||

        {};

    const balanceRows =

        Object.keys(balances).length

            ? Object.entries(balances).map(

                ([member, amount]) => `

                <tr>

                    <td>

                        👤 ${escapeHtml(member)}

                    </td>

                    <td>

                        ${money(amount)}

                    </td>

                </tr>

                `

            ).join("")

            : `

            <tr>

                <td colspan="2">

                    No balance information available.

                </td>

            </tr>

            `;

    const settlementRows =

        settlements.length

            ? settlements.map(settlement => {

                const from =

                    settlement.from ||

                    settlement.from_member ||

                    "Unknown";

                const to =

                    settlement.to ||

                    settlement.to_member ||

                    "Unknown";

                return `

                <tr>

                    <td>

                        ${escapeHtml(from)}

                    </td>

                    <td>

                        ${escapeHtml(to)}

                    </td>

                    <td>

                        ${money(settlement.amount)}

                    </td>

                </tr>

                `;

            }).join("")

            : `

            <tr>

                <td colspan="3">

                    🎉 Everyone is settled up.

                </td>

            </tr>

            `;

    return `

    <div class="trip-card">

        <div class="trip-header">

            <h3>💸 Trip Settlements</h3>

        </div>

        <div class="trip-body">

            <h4>

                Member Balances

            </h4>

            <table class="trip-balance-table">

                <thead>

                    <tr>

                        <th>Member</th>

                        <th>Balance</th>

                    </tr>

                </thead>

                <tbody>

                    ${balanceRows}

                </tbody>

            </table>

            <h4>

                Settlements

            </h4>

            <table class="trip-settlement-table">

                <thead>

                    <tr>

                        <th>From</th>

                        <th>To</th>

                        <th>Amount</th>

                    </tr>

                </thead>

                <tbody>

                    ${settlementRows}

                </tbody>

            </table>

        </div>

    </div>

    `;

}