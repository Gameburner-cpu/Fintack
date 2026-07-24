function renderAIInsights(summary, transactions, goals) {
    const container = document.getElementById("ai-insights");
    if (!container) return;

    const insights = generateInsights(summary, transactions, goals);
    
    // FIX 1: Define and calculate the 'score' before using it.
    // Example logic: Base score of 40, plus up to 60 points for hitting a 30% savings rate.
    const income = Number(summary.income || 0);
    const savings = Number(summary.monthlySavings || 0);
    let score = 0;
    
    if (income > 0) {
        const savingsRate = (savings / income) * 100;
        score = Math.min(100, Math.round(40 + (savingsRate / 30) * 60));
    }

    // FIX 2: Combine the HTML instead of overwriting innerHTML.
    let htmlContent = `
<div class="health-card">
    <div class="health-score">
        ${score}
    </div>
    <div>
        <h3>Financial Health</h3>
        <p>${getHealthMessage(score)}</p>
    </div>
</div>
`;

    // Append the insights mapped string to our htmlContent variable
    htmlContent += insights.map(item => `
<div class="insight-card ${item.type}">
    <div class="icon">
        ${item.icon}
    </div>
    <div>
        <h4>${item.title}</h4>
        <p>${item.message}</p>
    </div>
</div>
`).join("");
    
    // Set the container's innerHTML once with the fully combined layout
    container.innerHTML = htmlContent;
}

function getHealthMessage(score){
    if(score >= 90) return "Excellent financial health.";
    if(score >= 75) return "Very good. Keep it up.";
    if(score >= 60) return "You're on the right track.";
    if(score >= 40) return "Needs improvement.";
    return "Critical. Focus on saving more.";
}

function renderAIAlerts(summary, transactions, goals){
    const container = document.getElementById("ai-alerts");
    if(!container) return;

    const alerts = generateAlerts(summary, transactions, goals);

    container.innerHTML = alerts.map(alert => `
<div class="alert-card ${alert.type}">
    <h4>${alert.icon} ${alert.title}</h4>
    <p>${alert.message}</p>
</div>
`).join("");
}