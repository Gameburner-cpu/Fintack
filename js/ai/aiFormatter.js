function formatPurchase(data){

return `

🛒 Purchase Analysis

Price

₹${data.price.toLocaleString("en-IN")}

Monthly Income

₹${data.income.toLocaleString("en-IN")}

Monthly Expenses

₹${data.expenses.toLocaleString("en-IN")}

Monthly Savings

₹${data.monthlySavings.toLocaleString("en-IN")}

Estimated Time

${data.months} month(s)

Recommendation

${data.recommendation}

`;

}