/* ==========================================================
                TRIP CALCULATOR
========================================================== */

/* ==========================================================
                TOTAL EXPENSE
========================================================== */

function getTotalExpense(trip) {
    if (!trip || !trip.expenses || !Array.isArray(trip.expenses)) return 0;

    return trip.expenses.reduce((total, expense) => {
        return total + Number(expense.amount || 0);
    }, 0);
}

/* ==========================================================
                PER PERSON SHARE
========================================================== */

function getPerPersonShare(trip) {
    if (!trip || !trip.members || !Array.isArray(trip.members)) return 0;
    if (trip.members.length === 0) return 0;

    return getTotalExpense(trip) / trip.members.length;
}

/* ==========================================================
                MEMBER BALANCES
========================================================== */

function calculateBalances(trip) {
    if (!trip || !trip.members || !Array.isArray(trip.members)) return {};

    const balances = {};

    trip.members.forEach(member => {
        balances[member] = 0;
    });

    const share = getPerPersonShare(trip);
    const expenses = trip.expenses && Array.isArray(trip.expenses) ? trip.expenses : [];

    expenses.forEach(expense => {
        // Handle both paidBy and backend's paid_by mapping safely
        const payer = expense.paidBy || expense.paid_by;
        if (payer && balances.hasOwnProperty(payer)) {
            balances[payer] += Number(expense.amount || 0);
        }
    });

    trip.members.forEach(member => {
        balances[member] -= share;
    });

    return balances;
}

/* ==========================================================
                WHO OWES WHO
========================================================== */

function calculateSettlements(trip) {
    if (!trip) return [];
    
    const balances = calculateBalances(trip);
    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([member, balance]) => {
        if (balance < -0.01) {
            debtors.push({
                member,
                amount: Math.abs(balance)
            });
        }
        else if (balance > 0.01) {
            creditors.push({
                member,
                amount: balance
            });
        }
    });

    const settlements = [];
    let d = 0;
    let c = 0;

    while (
        d < debtors.length &&
        c < creditors.length
    ) {
        const debtor = debtors[d];
        const creditor = creditors[c];

        const payment = Math.min(
            debtor.amount,
            creditor.amount
        );

        settlements.push({
            from: debtor.member,
            to: creditor.member,
            amount: Number(payment.toFixed(2))
        });

        debtor.amount -= payment;
        creditor.amount -= payment;

        if (debtor.amount < 0.01) d++;
        if (creditor.amount < 0.01) c++;
    }

    return settlements;
}

/* ==========================================================
                TRIP SUMMARY
========================================================== */

function getTripSummary(trip) {
    if (!trip) {
        return {
            totalExpense: 0,
            members: 0,
            perPerson: 0,
            balances: {},
            settlements: []
        };
    }

    return {
        totalExpense: getTotalExpense(trip),
        members: trip.members ? trip.members.length : 0,
        perPerson: getPerPersonShare(trip),
        balances: calculateBalances(trip),
        settlements: calculateSettlements(trip)
    };
}