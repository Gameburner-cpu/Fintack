/* ==========================================
   PURCHASE ADVISOR
========================================== */
function analyzePurchase(price, summary, goals = []) {
  const income = Number(summary.income || 0);
  const expenses = Number(summary.expenses || 0);
  const monthlySavings = Number(summary.monthlySavings || 0);
  const score = calculateHealthScore(summary, goals);
  const disposable = income - expenses;
  const months = monthlySavings > 0 ? Math.ceil(price / monthlySavings) : Infinity;
  const affordable = disposable >= monthlySavings;
  
  let recommendation;
  if (months <= 3) {
    recommendation = "Safe to purchase.";
  } else if (months <= 12) {
    recommendation = "Better to save first.";
  } else {
    recommendation = "Not recommended right now.";
  }
  
  return {
    price,
    income,
    expenses,
    disposable,
    monthlySavings,
    months,
    affordable,
    recommendation,
    goals
  };
}

/* ==========================================
   AI INSIGHTS
========================================== */
function generateInsights(summary, transactions = [], goals = []) {
  const income = Number(summary.income || 0);
  const expenses = Number(summary.expenses || 0);
  const savings = Number(summary.monthlySavings || 0);
  
  // Calculate raw number for logical checks to prevent string coercion bugs
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;
  // Format the rate only when displaying it
  const formattedRate = savingsRate.toFixed(1);
  
  const insights = [];
  
  // Savings Rate
  if (savingsRate >= 30) {
    insights.push({
      type: "success",
      icon: "✅",
      title: "Excellent Saving",
      message: `You're saving ${formattedRate}% of your monthly income.`
    });
  } else if (savingsRate >= 20) {
    insights.push({
      type: "info",
      icon: "💰",
      title: "Good Progress",
      message: `You're saving ${formattedRate}% every month.`
    });
  } else {
    insights.push({
      type: "warning",
      icon: "⚠️",
      title: "Increase Savings",
      message: "Try saving at least 20% of your income."
    });
  }
  
  // Goal Progress
  if (goals.length === 0) {
    insights.push({
      type: "warning",
      icon: "🎯",
      title: "No Goals",
      message: "Create your first financial goal."
    });
  } else {
    const completed = goals.filter(g => Number(g.progress) >= 100).length;
    insights.push({
      type: "success",
      icon: "🎯",
      title: "Goals",
      message: `${completed} of ${goals.length} goals completed.`
    }); // Fixed syntax error here: changed ); to });
  }
  
  // Expense Ratio
  const expenseRatio = income > 0 ? (expenses / income) * 100 : 0;
  if (expenseRatio > 80) {
    insights.push({
      type: "danger",
      icon: "📉",
      title: "High Spending",
      message: "Your expenses exceed 80% of your income."
    });
  }
  
  return insights;
}
/* ==========================================
        FINANCIAL HEALTH SCORE
========================================== */

function calculateHealthScore(summary, goals = []) {

    const income = Number(summary.income || 0);
    const expenses = Number(summary.expenses || 0);
    const savings = Number(summary.monthlySavings || 0);

    let score = 0;

    // Savings Rate (40 points)
    if (income > 0) {
        const savingsRate = (savings / income) * 100;

        if (savingsRate >= 30) score += 40;
        else if (savingsRate >= 20) score += 30;
        else if (savingsRate >= 10) score += 20;
        else score += 10;
    }

    // Expense Ratio (30 points)
    if (income > 0) {
        const expenseRatio = (expenses / income) * 100;

        if (expenseRatio <= 50) score += 30;
        else if (expenseRatio <= 70) score += 20;
        else if (expenseRatio <= 90) score += 10;
    }

    // Goals (30 points)
    if (goals.length > 0) {

        const completed =
            goals.filter(g => Number(g.progress) >= 100).length;

        score += Math.min(
            30,
            completed * 10 + 10
        );

    }

    return Math.min(100, Math.round(score));
}

/* ==========================================
        AI SMART ALERTS
========================================== */

function generateAlerts(summary, transactions = [], goals = []) {

    const alerts = [];

    const income = Number(summary.income || 0);
    const expenses = Number(summary.expenses || 0);
    const savings = Number(summary.monthlySavings || 0);

    if (expenses > income * 0.8) {

        alerts.push({
            type: "warning",
            icon: "⚠️",
            title: "High Spending",
            message:
                "Your expenses are above 80% of your income."
        });

    }

    if (savings > income * 0.3) {

        alerts.push({
            type: "success",
            icon: "🎉",
            title: "Great Saving",
            message:
                "Excellent! You're saving over 30% of your income."
        });

    }

    goals.forEach(goal => {
        const progress = Number(goal.progress || 0);
        if (progress >= 80 && progress < 100) {
            alerts.push({
                type: "info",
                icon: "🎯",
                title: goal.title,
                message:
                    "You're almost there! Keep saving."
            });
        }
    });
    return alerts;
}