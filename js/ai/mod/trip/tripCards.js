/* ==========================================================================
   tripCards.js
   UI Card Builders for Trip Module
========================================================================== */

export function formatTripCard(trip) {

    if (!trip) {

        return `
            <div class="trip-card">
                <h3>🏕️ Trip Created</h3>
                <p>Your trip has been created successfully.</p>
            </div>
        `;

    }

    return `
        <div class="trip-card">

            <h3>🏕️ ${trip.name || trip.trip_name || "New Trip"}</h3>

            <p><strong>Status:</strong> Active</p>

            <p><strong>Members:</strong> ${trip.members?.length || 0}</p>

            <p><strong>Total Expenses:</strong>
                ₹${trip.totalExpense || trip.total_expense || 0}
            </p>

        </div>
    `;

}

export function formatMembersCard(data) {

    const members = data?.members || [];

    return `
        <div class="trip-card">

            <h3>👥 Members</h3>

            <ul>

                ${
                    members.length

                        ? members.map(member => {

                            const name =

                                typeof member === "string"

                                    ? member

                                    : (

                                        member.name ||

                                        member.member_name ||

                                        member.full_name ||

                                        member.username ||

                                        "Unknown"

                                    );

                            return `<li>${name}</li>`;

                        }).join("")

                        : "<li>No members added.</li>"

                }

            </ul>

        </div>
    `;

}

export function formatExpenseCard(expense) {

    if (!expense) {

        return `
            <div class="trip-card">

                <h3>💰 Expense Added</h3>

            </div>
        `;

    }

    const paidBy =

        expense.paidBy ||

        expense.paid_by ||

        expense.payer ||

        expense.member ||

        "Unknown";

    const title =

        expense.title ||

        expense.purpose ||

        expense.description ||

        "General";

    return `
        <div class="trip-card">

            <h3>💰 Expense Added</h3>

            <p><strong>Paid By:</strong> ${paidBy}</p>

            <p><strong>Amount:</strong> ₹${expense.amount || 0}</p>

            <p><strong>Purpose:</strong> ${title}</p>

        </div>
    `;

}

export function formatTripSummary(summary) {

    const members = summary.members || [];

    const expenses = summary.expenses || [];

    const totalExpense = expenses.reduce(

        (total, expense) =>

            total + Number(expense.amount || 0),

        0

    );

    return `
        <div class="trip-card">

            <h3>📊 Trip Summary</h3>

            <p><strong>Total Expense:</strong> ₹${totalExpense}</p>

            <p><strong>Members:</strong> ${members.length}</p>

            <p><strong>Expenses:</strong> ${expenses.length}</p>

        </div>
    `;

}

export function formatSettlementCard(data) {

    const settlements = data?.settlements || [];

    return `
        <div class="trip-card">

            <h3>💸 Settlements</h3>

            <ul>

                ${
                    settlements.length

                        ? settlements.map(s => `

                            <li>

                                ${(s.from || s.from_member || "Unknown")}

                                →

                                ${(s.to || s.to_member || "Unknown")}

                                : ₹${s.amount || 0}

                            </li>

                        `).join("")

                        : "<li>No settlements pending.</li>"

                }

            </ul>

        </div>
    `;

}