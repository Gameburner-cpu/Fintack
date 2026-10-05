function calculateSettlements(members, expenses) {

    const balances = {};

    /* =====================================================
                    INITIALIZE BALANCES
    ===================================================== */

    members.forEach(member => {

        const name = String(member.member_name)
            .trim()
            .toLowerCase();

        balances[name] = 0;

    });

    if (members.length === 0) {

        return {

            total: 0,
            share: 0,
            balances: {},
            settlements: []

        };

    }

    /* =====================================================
                    TOTAL EXPENSE
    ===================================================== */

    console.log("===== MEMBERS =====");
    console.log(JSON.stringify(members, null, 2));

    console.log("===== EXPENSES =====");
    console.log(JSON.stringify(expenses, null, 2));

    const total = expenses.reduce(

        (sum, expense) => sum + Number(expense.amount || 0),

        0

    );

    const share = total / members.length;

    /* =====================================================
                    CREDIT PAYERS
    ===================================================== */

    expenses.forEach(expense => {

        const payer = String(expense.paid_by)
            .trim()
            .toLowerCase();

        if (!(payer in balances)) {

            console.warn(
                "Expense payer not found:",
                expense.paid_by
            );

            return;

        }

        balances[payer] += Number(expense.amount || 0);

    });

    /* =====================================================
                    SUBTRACT SHARE
    ===================================================== */

    Object.keys(balances).forEach(name => {

        balances[name] -= share;

    });

    /* =====================================================
                BUILD DEBTORS & CREDITORS
    ===================================================== */

    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([name, amount]) => {

        if (amount > 0.01) {

            creditors.push({

                name,

                amount

            });

        }

        else if (amount < -0.01) {

            debtors.push({

                name,

                amount: Math.abs(amount)

            });

        }

    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    /* =====================================================
                    CALCULATE PAYMENTS
    ===================================================== */

    const settlements = [];

    while (debtors.length && creditors.length) {

        const debtor = debtors[0];
        const creditor = creditors[0];

        const payment = Math.min(

            debtor.amount,

            creditor.amount

        );

        settlements.push({

            from: debtor.name,

            to: creditor.name,

            amount: Number(payment.toFixed(2))

        });

        debtor.amount -= payment;
        creditor.amount -= payment;

        if (debtor.amount <= 0.01) {

            debtors.shift();

        }

        if (creditor.amount <= 0.01) {

            creditors.shift();

        }

    }

    /* =====================================================
                        RETURN
    ===================================================== */

    return {

        total,

        share: Number(share.toFixed(2)),

        balances,

        settlements

    };

}

module.exports = calculateSettlements;