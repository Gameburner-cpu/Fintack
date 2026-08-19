/* ==========================================================================
   tests/run.mjs
   Dependency-free test suite for the pure logic in FinTack.

   Run with:  node tests/run.mjs

   Covers the parts where a silent bug is expensive: money aggregation,
   SIP maths, input validation and the chatbot's command parsing. Nothing
   here touches the network or the DOM.
========================================================================== */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

/* ==========================================================
                    TINY TEST HARNESS
========================================================== */

let passed = 0;
let failed = 0;
const failures = [];
let currentSuite = "";

function suite(name) {
    currentSuite = name;
    console.log(`\n${name}`);
}

function test(name, fn) {
    try {
        fn();
        passed += 1;
        console.log(`  ok   ${name}`);
    } catch (error) {
        failed += 1;
        failures.push(`${currentSuite} > ${name}\n       ${error.message}`);
        console.log(`  FAIL ${name}`);
        console.log(`       ${error.message}`);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || "Assertion failed");
}

function equal(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(
            message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        );
    }
}

function close(actual, expected, tolerance = 0.5, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(
            message ||
            `Expected ~${expected} (±${tolerance}), got ${actual}`
        );
    }
}

/* ==========================================================
                        MODULES
========================================================== */

const serverAnalytics = require(path.join(root, "backend/utils/analytics.js"));
const investment = require(path.join(root, "backend/utils/investmentEngine.js"));
const validators = require(path.join(root, "backend/utils/validators.js"));

const clientAnalytics = await import(
    `file://${path.join(root, "js/core/analytics.js")}`
);

const NLU = await import(
    `file://${path.join(root, "js/ai/utils/FinanceNLU.js")}`
);

const KB = await import(
    `file://${path.join(root, "js/ai/mod/knowledge/financeKB.js")}`
);

/* ==========================================================
                    FIXTURES
========================================================== */

const REFERENCE = new Date("2026-08-15T12:00:00");

function daysAgo(n) {
    const date = new Date(REFERENCE);
    date.setDate(date.getDate() - n);
    return date.toISOString().slice(0, 10);
}

const TRANSACTIONS = [
    { id: "1", title: "Salary",   amount: 80000, type: "income",  category: "Salary",  date: "2026-08-01" },
    { id: "2", title: "Rent",     amount: 20000, type: "expense", category: "Rent",    date: "2026-08-02" },
    { id: "3", title: "Lunch",    amount: 400,   type: "expense", category: "Food",    date: daysAgo(0) },
    { id: "4", title: "Coffee",   amount: 250,   type: "expense", category: "Food",    date: daysAgo(1) },
    { id: "5", title: "Petrol",   amount: 2000,  type: "expense", category: "Fuel",    date: daysAgo(3) },
    { id: "6", title: "Salary",   amount: 80000, type: "income",  category: "Salary",  date: "2026-07-01" },
    { id: "7", title: "Rent",     amount: 20000, type: "expense", category: "Rent",    date: "2026-07-02" },
    { id: "8", title: "Shopping", amount: 6000,  type: "expense", category: "Shopping",date: "2026-07-15" },

    /* Rows that used to corrupt the totals. */
    { id: "9",  title: "Broken type", amount: 5000, type: null,        category: "Food", date: "2026-08-05" },
    { id: "10", title: "Broken date", amount: 5000, type: "expense",   category: "Food", date: "not-a-date" },
    { id: "11", title: "Broken amt",  amount: "abc", type: "expense",  category: "Food", date: "2026-08-05" },
    { id: "12", title: "Zero",        amount: 0,     type: "expense",  category: "Food", date: "2026-08-05" }
];

/* ==========================================================
                    ANALYTICS
========================================================== */

suite("Analytics (server)");

const summary = serverAnalytics.buildSummary(TRANSACTIONS, { reference: REFERENCE });

test("drops rows with an unknown type", () => {
    equal(summary.transactionCount, 8, "only the 8 well-formed rows should count");
});

test("this month income and expenses are correct", () => {
    equal(summary.monthlyIncome, 80000);
    equal(summary.monthlyExpense, 20000 + 400 + 250 + 2000);
});

test("monthly savings and savings rate", () => {
    equal(summary.monthlySavings, 80000 - 22650);
    close(summary.savingsRate, ((80000 - 22650) / 80000) * 100, 0.01);
});

test("last month figures are isolated from this month", () => {
    equal(summary.lastMonthIncome, 80000);
    equal(summary.lastMonthExpense, 26000);
});

test("all-time balance nets income against expenses", () => {
    equal(summary.totalIncome, 160000);
    equal(summary.totalExpense, 48650);
    equal(summary.balance, 111350);
});

test("today and week windows", () => {
    equal(summary.todayExpense, 400);
    equal(summary.weekExpense, 400 + 250 + 2000);
});

test("top category is the largest expense bucket this month", () => {
    equal(summary.topCategory.category, "Rent");
    equal(summary.topCategory.amount, 20000);
});

test("category percentages sum to 100", () => {
    const total = summary.categories.reduce((sum, item) => sum + item.percentage, 0);
    close(total, 100, 0.5);
});

test("average daily expense uses days elapsed, not a flat 30", () => {
    close(summary.averageDailyExpenseThisMonth, 22650 / 15, 0.01);
});

test("six month series has six distinct buckets", () => {
    equal(summary.monthlySeries.length, 6);
    const keys = new Set(summary.monthlySeries.map(item => item.key));
    equal(keys.size, 6, "buckets must be unique per year+month");
});

test("a 12 month series does not collide on repeated month names", () => {
    const yearly = serverAnalytics.monthlySeries(
        serverAnalytics.normalizeAll(TRANSACTIONS),
        12,
        REFERENCE
    );

    equal(yearly.length, 12);
    equal(new Set(yearly.map(item => item.key)).size, 12);
});

suite("Analytics (client mirrors server)");

const clientSummary = clientAnalytics.buildSummary(TRANSACTIONS, {
    reference: REFERENCE,
    noCache: true
});

test("client and server agree on monthly expense", () => {
    equal(clientSummary.monthlyExpense, summary.monthlyExpense);
});

test("client and server agree on balance", () => {
    equal(clientSummary.balance, summary.balance);
});

test("client and server agree on savings rate", () => {
    equal(clientSummary.savingsRate, summary.savingsRate);
});

suite("Period reports");

test("last_week resolves to a Monday-Sunday window", () => {
    const range = clientAnalytics.resolvePeriod("last_week", REFERENCE);
    equal(range.from.getDay(), 1, "week should start on Monday");
    equal(range.to.getDay(), 0, "week should end on Sunday");
});

test("today report totals only today's rows", () => {
    const report = clientAnalytics.periodReport(TRANSACTIONS, "today", REFERENCE);
    equal(report.expense, 400);
    equal(report.count, 1);
});

test("this_month report matches the summary", () => {
    const report = clientAnalytics.periodReport(TRANSACTIONS, "this_month", REFERENCE);
    equal(report.expense, summary.monthlyExpense);
});

test("all_time report matches lifetime totals", () => {
    const report = clientAnalytics.periodReport(TRANSACTIONS, "all_time", REFERENCE);
    equal(report.expense, summary.totalExpense);
    equal(report.income, summary.totalIncome);
});

/* ==========================================================
                    INVESTMENT ENGINE
========================================================== */

suite("Investment engine - maths");

test("SIP future value matches the closed-form formula", () => {
    /* ₹10,000/month at 12% for 10 years ≈ ₹23.23 lakh */
    const value = investment.sipFutureValue(10000, 0.12, 120);
    close(value, 2323391, 5000);
});

test("zero-rate SIP is simply contribution x months", () => {
    equal(investment.sipFutureValue(5000, 0, 24), 120000);
});

test("requiredSip inverts sipFutureValue", () => {
    const sip = investment.requiredSip(1000000, 0, 0.12, 60);
    const projected = investment.sipFutureValue(sip, 0.12, 60);
    close(projected, 1000000, 2);
});

test("existing savings reduce the required SIP", () => {
    const withoutSavings = investment.requiredSip(1000000, 0, 0.10, 60);
    const withSavings = investment.requiredSip(1000000, 300000, 0.10, 60);
    assert(withSavings < withoutSavings, "a lump sum must lower the SIP");
});

test("a fully funded goal needs no SIP", () => {
    equal(investment.requiredSip(100000, 200000, 0.10, 12), 0);
});

test("lump sum compounding grows over time", () => {
    const value = investment.lumpSumFutureValue(100000, 0.12, 120);
    close(value, 330039, 2000);
});

suite("Investment engine - allocation");

test("allocation weights always total 100", () => {
    for (let risk = 1; risk <= 5; risk += 1) {
        for (const months of [6, 24, 60, 120, 240]) {
            const allocation = investment.buildAllocation(risk, months);

            const total =
                allocation.equity +
                allocation.debt +
                allocation.gold +
                allocation.realEstate;

            close(total, 100, 0.1, `risk ${risk}, ${months} months summed to ${total}`);
        }
    }
});

test("short horizons are forced out of equity regardless of stated risk", () => {
    const profile = investment.profileRisk({
        riskTolerance: "aggressive",
        months: 8,
        savingsRate: 40,
        hasEmergencyFund: true
    });

    equal(profile.score, 1);

    const allocation = investment.buildAllocation(profile.score, 8);
    equal(allocation.equity, 0);
});

test("long horizons with a healthy savings rate allow growth allocations", () => {
    const profile = investment.profileRisk({
        riskTolerance: "aggressive",
        months: 180,
        savingsRate: 35,
        hasEmergencyFund: true
    });

    assert(profile.score >= 4, `expected a growth profile, got ${profile.score}`);

    const allocation = investment.buildAllocation(profile.score, 180);
    assert(allocation.equity >= 65, `expected equity >= 65, got ${allocation.equity}`);
});

test("a missing emergency fund lowers the risk score", () => {
    const funded = investment.profileRisk({
        riskTolerance: "moderate", months: 120, savingsRate: 25, hasEmergencyFund: true
    });

    const unfunded = investment.profileRisk({
        riskTolerance: "moderate", months: 120, savingsRate: 25, hasEmergencyFund: false
    });

    assert(unfunded.score < funded.score, "an unfunded buffer must reduce risk taken");
});

test("instrument weights total 100 and reference real instruments", () => {
    const allocation = investment.buildAllocation(4, 120);
    const picks = investment.selectInstruments(allocation, 4, 120);

    const total = picks.reduce((sum, item) => sum + item.weight, 0);
    close(total, 100, 0.5);

    picks.forEach(pick => {
        assert(
            investment.INSTRUMENTS[pick.key],
            `unknown instrument key: ${pick.key}`
        );
    });
});

suite("Investment engine - full plan");

const plan = investment.buildPlan({
    goal: {
        title: "House deposit",
        targetAmount: 2000000,
        savedAmount: 200000,
        deadline: "2034-08-15"
    },
    finances: {
        monthlyIncome: 120000,
        monthlyExpense: 70000,
        totalSavings: 600000,
        savingsRate: 41
    },
    riskTolerance: "moderate"
});

test("plan builds successfully", () => {
    assert(plan.success, plan.message);
    equal(plan.status, "active");
});

test("projection at the blended rate lands on the target", () => {
    close(plan.projection.atBlendedReturn, 2000000, 5000);
});

test("every recommendation carries reasoning, risk and a return range", () => {
    assert(plan.recommendations.length > 0, "expected recommendations");

    plan.recommendations.forEach(item => {
        assert(item.reasoning && item.reasoning.length > 40, `weak reasoning for ${item.name}`);
        assert(item.risk, `missing risk band for ${item.name}`);
        assert(
            item.expectedReturnRange.high >= item.expectedReturnRange.low,
            `inverted return range for ${item.name}`
        );
        assert(
            item.projectedValue.high >= item.projectedValue.low,
            `inverted projection for ${item.name}`
        );
    });
});

test("milestones cover 25/50/75/100 percent", () => {
    equal(plan.milestones.length, 4);
    equal(plan.milestones.map(item => item.percent).join(","), "25,50,75,100");
});

test("milestone ETAs increase monotonically", () => {
    const etas = plan.milestones
        .map(item => item.etaMonths)
        .filter(value => typeof value === "number");

    for (let i = 1; i < etas.length; i += 1) {
        assert(etas[i] >= etas[i - 1], "milestones must be reached in order");
    }
});

test("feasibility is judged against the real monthly surplus", () => {
    assert(
        ["comfortable", "tight", "unrealistic"].includes(plan.contribution.feasibility),
        `unexpected feasibility: ${plan.contribution.feasibility}`
    );

    equal(plan.profile.monthlySurplus, 50000);
});

test("an unfunded emergency buffer is recommended before investing", () => {
    const tight = investment.buildPlan({
        goal: {
            title: "Car", targetAmount: 800000, savedAmount: 0, deadline: "2031-08-15"
        },
        finances: {
            monthlyIncome: 60000, monthlyExpense: 45000, totalSavings: 10000, savingsRate: 25
        },
        riskTolerance: "moderate"
    });

    equal(tight.recommendations[0].key, "emergency_fund");
    assert(tight.profile.emergencyFund.funded === false);
});

test("a past deadline is reported rather than projected", () => {
    const overdue = investment.buildPlan({
        goal: {
            title: "Old goal", targetAmount: 100000, savedAmount: 40000, deadline: "2020-01-01"
        },
        finances: { monthlyIncome: 50000, monthlyExpense: 30000, totalSavings: 100000 }
    });

    equal(overdue.status, "overdue");
});

test("a completed goal is reported as complete", () => {
    const done = investment.buildPlan({
        goal: {
            title: "Done", targetAmount: 100000, savedAmount: 120000, deadline: "2030-01-01"
        },
        finances: { monthlyIncome: 50000, monthlyExpense: 30000, totalSavings: 200000 }
    });

    equal(done.status, "completed");
});

test("every plan carries a disclaimer", () => {
    assert(plan.disclaimer.includes("not personalised investment advice"));
});

/* ==========================================================
                    VALIDATORS
========================================================== */

suite("Validators");

test("rejects a negative amount", () => {
    const result = validators.validateTransaction({
        title: "x", amount: -5, type: "expense", category: "Food", date: "2026-08-01"
    });

    assert(!result.valid);
});

test("rejects an unknown transaction type", () => {
    const result = validators.validateTransaction({
        title: "x", amount: 5, type: "transfer", category: "Food", date: "2026-08-01"
    });

    assert(!result.valid);
});

test("rejects a date more than a year ahead", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 2);

    const result = validators.validateTransaction({
        title: "x",
        amount: 5,
        type: "expense",
        category: "Food",
        date: future.toISOString().slice(0, 10)
    });

    assert(!result.valid);
});

test("accepts a valid transaction and rounds to paise", () => {
    const result = validators.validateTransaction({
        title: "  Coffee  ", amount: "249.999", type: "EXPENSE",
        category: "food", date: "2026-08-01"
    });

    assert(result.valid, result.errors.join(", "));
    equal(result.value.title, "Coffee");
    equal(result.value.amount, 250);
    equal(result.value.type, "expense");
    equal(result.value.category, "Food", "category should normalise to canonical casing");
});

test("partial update validates only supplied fields", () => {
    const result = validators.validateTransaction({ amount: 700 }, { partial: true });

    assert(result.valid, result.errors.join(", "));
    equal(Object.keys(result.value).length, 1);
});

test("an empty partial update is rejected", () => {
    const result = validators.validateTransaction({}, { partial: true });
    assert(!result.valid);
});

test("password policy", () => {
    assert(validators.validatePassword("short1") !== null, "too short must fail");
    assert(validators.validatePassword("alllettersonly") !== null, "needs a digit");
    assert(validators.validatePassword("12345678") !== null, "needs a letter");
    equal(validators.validatePassword("Str0ngEnough"), null);
});

test("email validation", () => {
    assert(validators.isEmail("a@b.co"));
    assert(!validators.isEmail("a@b"));
    assert(!validators.isEmail("no-at-sign.com"));
    equal(validators.normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
});

test("goal saved amount cannot exceed the target", () => {
    const result = validators.validateGoal({
        title: "Trip", target_amount: 1000, saved_amount: 2000, deadline: "2030-01-01"
    });

    assert(!result.valid);
});

/* ==========================================================
                    CHATBOT NLU
========================================================== */

suite("NLU - amounts");

const amountCases = [
    ["Add ₹500 spent on food today", 500],
    ["I spent Rs. 1,250 on groceries", 1250],
    ["spent 2k on shopping", 2000],
    ["received 1.5 lakh bonus", 150000],
    ["paid 350 rupees for petrol", 350]
];

amountCases.forEach(([text, expected]) => {
    test(`"${text}" -> ${expected}`, () => {
        equal(NLU.extractAmount(text), expected);
    });
});

suite("NLU - dates");

test("today resolves to the reference date", () => {
    equal(NLU.extractDate("spent 500 today", REFERENCE).date, "2026-08-15");
});

test("yesterday resolves to the previous day", () => {
    equal(NLU.extractDate("spent 500 yesterday", REFERENCE).date, "2026-08-14");
});

test("'3 days ago' resolves correctly", () => {
    equal(NLU.extractDate("paid 200 3 days ago", REFERENCE).date, "2026-08-12");
});

test("a written date resolves correctly", () => {
    equal(NLU.extractDate("spent 900 on 2 aug", REFERENCE).date, "2026-08-02");
});

test("a day-first numeric date resolves correctly", () => {
    equal(NLU.extractDate("spent 900 on 02/08/2026", REFERENCE).date, "2026-08-02");
});

test("no date reference returns null", () => {
    equal(NLU.extractDate("spent 900 on food", REFERENCE), null);
});

suite("NLU - categories and type");

test("food keywords map to the Food category", () => {
    equal(NLU.extractCategory("lunch at a cafe").category, "Food");
});

test("ride hailing maps to Transport", () => {
    equal(NLU.extractCategory("took an uber home").category, "Transport");
});

test("salary maps to Salary and infers income", () => {
    equal(NLU.extractCategory("monthly salary credited").category, "Salary");
    equal(NLU.extractType("monthly salary credited", "Salary"), "income");
});

test("spending verbs infer an expense", () => {
    equal(NLU.extractType("spent 500 on food"), "expense");
    equal(NLU.extractType("paid the electricity bill"), "expense");
});

test("an explicit verb beats a category-based guess", () => {
    equal(
        NLU.extractType("spent 5000 on an investment", "Investment"),
        "expense",
        "'spent' must win over the income-leaning Investment category"
    );
});

suite("NLU - add command");

test('"Add ₹500 spent on food today" parses completely', () => {
    const parsed = NLU.parseTransactionCommand("Add ₹500 spent on food today", REFERENCE);

    equal(parsed.amount, 500);
    equal(parsed.type, "expense");
    equal(parsed.category, "Food");
    equal(parsed.date, "2026-08-15");
    equal(parsed.missing.length, 0);
    assert(parsed.confidence >= 90, `low confidence: ${parsed.confidence}`);
});

test("a missing amount is reported rather than guessed", () => {
    const parsed = NLU.parseTransactionCommand("add an expense for food", REFERENCE);
    assert(parsed.missing.includes("amount"));
});

test("income commands are recognised", () => {
    const parsed = NLU.parseTransactionCommand(
        "received 80000 salary yesterday", REFERENCE
    );

    equal(parsed.type, "income");
    equal(parsed.category, "Salary");
    equal(parsed.amount, 80000);
    equal(parsed.date, "2026-08-14");
});

test("assumptions are flagged when the type is implicit", () => {
    const parsed = NLU.parseTransactionCommand("add 300 groceries", REFERENCE);
    equal(parsed.typeExplicit, false);
    equal(parsed.category, "Groceries");
});

suite("NLU - edit command");

test('"Change yesterday\'s food expense from ₹500 to ₹700" parses', () => {
    const parsed = NLU.parseEditCommand(
        "Change yesterday's food expense from ₹500 to ₹700", REFERENCE
    );

    equal(parsed.target.amount, 500);
    equal(parsed.target.category, "Food");
    equal(parsed.target.date, "2026-08-14");
    equal(parsed.updates.amount, 700);
});

test('"make it 900" is treated as a new amount', () => {
    const parsed = NLU.parseEditCommand("make it 900", REFERENCE);
    equal(parsed.updates.amount, 900);
    equal(parsed.target.amount, null);
});

test("category changes are extracted", () => {
    const parsed = NLU.parseEditCommand(
        "change the category to Travel for yesterday's 500 expense", REFERENCE
    );

    equal(parsed.updates.category, "Travel");
});

test("'last transaction' is recognised as a target", () => {
    const parsed = NLU.parseEditCommand("edit my last transaction to 250", REFERENCE);
    equal(parsed.target.last, true);
    equal(parsed.updates.amount, 250);
});

suite("NLU - confirmation and periods");

test("affirmative replies are detected", () => {
    ["yes", "Yes", "yep", "confirm", "go ahead", "ok"].forEach(word => {
        equal(NLU.detectConfirmation(word), "yes", `"${word}" should confirm`);
    });
});

test("negative replies are detected", () => {
    ["no", "cancel", "nope", "never mind"].forEach(word => {
        equal(NLU.detectConfirmation(word), "no", `"${word}" should cancel`);
    });
});

test("a long sentence is not treated as a confirmation", () => {
    equal(
        NLU.detectConfirmation("yes I would also like to add another expense for food"),
        null
    );
});

test("periods are extracted from questions", () => {
    equal(NLU.extractPeriod("how much did I spend last week"), "last_week");
    equal(NLU.extractPeriod("what's my expense this month"), "this_month");
    equal(NLU.extractPeriod("total spending this year"), "this_year");
    equal(NLU.extractPeriod("how much today"), "today");
    equal(NLU.extractPeriod("spending last month"), "last_month");
});

/* ==========================================================
                    KNOWLEDGE BASE
========================================================== */

suite("Knowledge base");

test("every topic has content, risk and keywords", () => {
    KB.TOPICS.forEach(topic => {
        assert(topic.summary?.length > 40, `${topic.id}: weak summary`);
        assert(topic.points?.length >= 3, `${topic.id}: needs at least 3 points`);
        assert(topic.risk?.length > 20, `${topic.id}: missing risk note`);
        assert(topic.keywords?.length >= 3, `${topic.id}: needs more keywords`);
    });
});

test("the brief's required topics are all covered", () => {
    const required = [
        "budgeting", "saving", "emergency_fund", "mutual_funds", "stocks",
        "index_funds", "sip", "fixed_deposit", "bonds", "gold",
        "real_estate", "tax_saving"
    ];

    required.forEach(id => {
        assert(
            KB.TOPICS.some(topic => topic.id === id),
            `missing required topic: ${id}`
        );
    });
});

test("questions route to the right topic", () => {
    const cases = [
        ["what is a SIP", "sip"],
        ["how much emergency fund do I need", "emergency_fund"],
        ["explain mutual funds", "mutual_funds"],
        ["are index funds better than active funds", "index_funds"],
        ["how do I save tax under 80C", "tax_saving"],
        ["is gold a good investment", "gold"],
        ["what is an ETF", "index_funds"],
        ["how does compounding work", "compounding"]
    ];

    cases.forEach(([question, expected]) => {
        const match = KB.findTopic(question);
        assert(match, `no topic matched "${question}"`);
        equal(match.topic.id, expected, `"${question}" matched ${match.topic.id}`);
    });
});

test("an unrelated question matches nothing", () => {
    equal(KB.findTopic("what is the weather like in Bangalore"), null);
});

/* ==========================================================
                        RESULTS
========================================================== */

console.log(`\n${"=".repeat(52)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log("=".repeat(52));

if (failures.length) {
    console.log("\nFailures:\n");
    failures.forEach(failure => console.log(`  - ${failure}\n`));
}

process.exit(failed === 0 ? 0 : 1);
