function calculateSettlements(members, expenses) {

    const balances = {};

    members.forEach(member => {
        balances[member.member_name] = 0;
    });

    const total = expenses.reduce(
        (sum, expense) => sum + Number(expense.amount),
        0
    );

    const share = total / members.length;

    expenses.forEach(expense => {

    if (!(expense.paid_by in balances)) {
        console.error(
            "Expense payer not found:",
            expense.paid_by
        );
        return;
    }

    balances[expense.paid_by] += Number(expense.amount);

});

    Object.keys(balances).forEach(name => {
        balances[name] -= share;
    });

    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([name, amount]) => {

        if (amount > 0) {

            creditors.push({
                name,
                amount
            });

        }

        else if (amount < 0) {

            debtors.push({
                name,
                amount: Math.abs(amount)
            });

        }

    });

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

        if (debtor.amount < 0.01)
            debtors.shift();

        if (creditor.amount < 0.01)
            creditors.shift();

    }

    return {

        total,

        share,

        balances,

        settlements

    };

}

module.exports = calculateSettlements;