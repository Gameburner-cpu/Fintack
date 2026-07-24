/* ==========================================================================
   ai.js - FinTack AI Engine (Database-Driven Trip Manager)
   ========================================================================== */
import FinTackAI from "./FinTackAI.js";

let currentChatId = null;
if (typeof window.activeTripId === "undefined") {
    window.activeTripId = null;
}

async function handleTripIntent(question) {
    const text = question.toLowerCase().trim();

    /* ==========================================
                    CREATE TRIP
    ========================================== */
    if (
        text.startsWith("create trip") ||
        text.startsWith("create a trip") ||
        text.includes("trip called")
    ) {
        const tripName = question
            .replace(/create\s+a?\s*trip/i, "")
            .replace(/called/i, "")
            .trim();

        const user = JSON.parse(localStorage.getItem("user"));

        if (!user) {
            return "Please login first.";
        }

        const response = await TripStorage.createTrip(
            user.id,
            tripName
        );

        if (!response || !response.success) {
            return "Couldn't create the trip.";
        }

        window.activeTripId = response.trip.id;
        return formatTripCard(response.trip);
    }

    /* ==========================================
                    ADD MEMBERS
    ========================================== */
    if (text.startsWith("add ") || text.startsWith("add:")) {
        console.log(">>> ADD MEMBERS BLOCK ENTERED");

        const rawNames = question.replace(/^add[:\s]*/i, "").trim();

        const members = rawNames
            .split(",")
            .map(m => m.trim())
            .filter(Boolean);

        if (!window.activeTripId) {
            return "Please create or select a trip first.";
        }

        const addResult = await TripStorage.addMembers(
            window.activeTripId,
            members
        );

        if (!addResult.success) {
            return "Couldn't add members.";
        }

        const tripData = await TripStorage.getTripDetails(
            window.activeTripId
        );

        console.log("Trip Details:", tripData);
        console.log("Members:", tripData.members);
        console.log("First Member:", tripData.members[0]);

        const trip = tripData.trip;

        trip.members = (tripData.members || []).map(member => {
            console.log(member);
            return member;
        });

        trip.expenses = tripData.expenses || [];

        return formatMembersCard(trip);
    }

    /* ==========================================
                    ADD EXPENSE
    ========================================== */
    const expenseRegex = /(.+?) paid ?₹?(\d+) for (.+)/i;
    const match = question.match(expenseRegex);

    if (match) {
        const paidBy = match[1].trim();
        const amount = Number(match[2]);
        const title = match[3].trim();

        if (!window.activeTripId) {
            return "Please create a trip first before recording expenses.";
        }

        await TripStorage.addExpense(
            window.activeTripId,
            {
                title,
                amount,
                paid_by: paidBy,
                category: "General"
            }
        );

        const expenseCardData = { title, amount, paidBy };
        return formatExpenseCard(expenseCardData);
    }

    /* ==========================================
                    SUMMARY
    ========================================== */
    if (
        text.includes("summary") ||
        text.includes("show trip")
    ) {
        if (!window.activeTripId) {
            return "No active trip found.";
        }

        const tripData = await TripStorage.getTripDetails(
            window.activeTripId
        );

        if (!tripData || !tripData.success) {
            return "Could not load trip summary.";
        }

        const expenses = tripData.expenses || [];
        const members = tripData.members || [];

        const totalExpense = expenses.reduce(
            (sum, expense) => sum + Number(expense.amount || 0),
            0
        );

        const membersCount = members.length;

        const perPerson =
            membersCount > 0
                ? totalExpense / membersCount
                : 0;

        return formatTripSummary({
            totalExpense,
            members: membersCount,
            perPerson
        });
        console.log("Expenses:", tripData.expenses);
        console.log("Members:", tripData.members);
    }

    /* ==========================================
                    SETTLEMENT
    ========================================== */
    if (
        text.includes("who owes") ||
        text.includes("settlement")
    ) {
        if (!window.activeTripId) return "No active trip found.";
        const settlementsData = await TripStorage.getSettlements(window.activeTripId);
        const settlements = settlementsData && settlementsData.success ? settlementsData.settlements : [];
        return formatSettlementCard(settlements);
    }

    /* ==========================================
                    GENERAL TRIP MENTION
    ========================================== */
    if (text.includes("trip") || text.includes("travel") || text.includes("ride") || text.includes("vacation") || text.includes("tour")) {
        return `
🌍 Trip Manager

Planning a getaway? Whether it's a quick ride to Manchanabele Dam, a trek up Skandagiri, exploring the KRS backwaters on the grey Honda CB350RS, or discovering entirely new routes and hidden gems across the country, tracking your travel expenses ensures you get the best content for your travel page without emptying your wallet.

Let me know your destination and budget!
`;
    }

    return null;
}

window.FinTackAI = {
    async answer(question, data) {
        const rawQuestion = question;
        question = question.toLowerCase();

        const summary = data.summary || {};
        const goals = data.goals || [];
        const transactions = data.transactions || [];

        /* =====================================================
                        NEW BRAIN AI & TRIP FALLBACK
        ===================================================== */
        // Pass to the new Brain AI first
        const response = await FinTackAI.ask(rawQuestion);
        if (response) {
            return response;
        }

        // old AI Fallback
        const oldTrip = await handleTripIntent(rawQuestion);
        if (oldTrip) {
            return oldTrip;
        }

        /* =====================================================
                        BUDGET
        ===================================================== */
        if (
            question.includes("budget") ||
            question.includes("plan")
        ) {
            const income = Number(summary.income || 0);
            const expenses = Number(summary.expenses || 0);
            const savings = income - expenses;

            return `
📊 Monthly Budget

Income
₹${income.toLocaleString("en-IN")}

Expenses
₹${expenses.toLocaleString("en-IN")}

Recommended Savings
₹${savings.toLocaleString("en-IN")}

Try to keep your expenses below 50% of your monthly income.
`;
        }

        /* =====================================================
                        SAVINGS
        ===================================================== */
        if (
            question.includes("save") ||
            question.includes("saving")
        ) {
            const savings = Number(summary.monthlySavings || 0);

            return `
💰 Savings Analysis

Current Monthly Savings

₹${savings.toLocaleString("en-IN")}

Increasing your savings by even 10% each month can significantly improve long-term financial growth.
`;
        }

        /* =====================================================
                        GOALS
        ===================================================== */
        if (
            question.includes("goal")
        ) {
            if (goals.length === 0) {
                return `
You don't have any financial goals yet.

Create one from the Goals page and I'll help optimize it.
`;
            }

            const totalTarget =
                goals.reduce(
                    (sum, goal) =>
                        sum + Number(goal.target_amount || 0),
                    0
                );

            const totalSaved =
                goals.reduce(
                    (sum, goal) =>
                        sum + Number(goal.current_amount || 0), 
                    0
                );

            const progress =
                totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

            return `
🎯 Goal Summary

Active Goals

${goals.length}

Saved

₹${totalSaved.toLocaleString("en-IN")}

Target

₹${totalTarget.toLocaleString("en-IN")}

Overall Progress

${progress}%
`;
        }

        /* =====================================================
                        EXPENSES
        ===================================================== */
        if (
            question.includes("expense") ||
            question.includes("spending")
        ) {
            const expenses =
                Number(summary.expenses || 0);

            return `
💳 Expense Analysis

Monthly Expenses

₹${expenses.toLocaleString("en-IN")}

Try reducing unnecessary expenses by 10%.

That could increase your annual savings significantly.
`;
        }

        /* =====================================================
                        HEALTH
        ===================================================== */
        if (
            question.includes("health") ||
            question.includes("score")
        ) {
            const income =
                Number(summary.income || 0);

            const expenses =
                Number(summary.expenses || 0);

            const savingsRate =
                income > 0
                    ? ((income - expenses) / income) * 100
                    : 0;

            let score = 60;

            if (savingsRate >= 20) score += 15;
            if (savingsRate >= 35) score += 15;
            if (goals.length > 0) score += 10;

            score = Math.min(score, 100);

            return `
🧠 Financial Health

Score

${score}/100

Savings Rate

${savingsRate.toFixed(1)}%

Keep maintaining your goals and savings to improve your score.
`;
        }

        /* =====================================================
                        PURCHASE / AFFORDABILITY
        ===================================================== */
        const amount = question.match(/(\d[\d,]*)/);

        if (
            question.includes("buy") ||
            question.includes("afford") ||
            question.includes("purchase")
        ) {
            if (amount) {
                const price =
                    Number(
                        amount[1].replace(/,/g, "")
                    );

                const result =
                    analyzePurchase(
                        price,
                        summary,
                        goals
                    );

                return generatePurchaseAnalysisCard(result); 
            }

            return "Please mention the purchase amount.\nExample:\nCan I buy a bike worth ₹2,00,000?";
        }
        
        /* =====================================================
                        DEFAULT
        ===================================================== */
        return `
🤖 FinTack AI

I can help with:

• Budget planning
• Savings
• Expenses
• Financial Goals
• Financial Health
• Trip Management

Try asking:

"Create a budget"
or
"Analyze my goals"
`;
    }
};