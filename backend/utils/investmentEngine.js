/* ==========================================================================
   investmentEngine.js
   Goal-based investment planning for FinTack.

   Deterministic, auditable maths - no LLM involved. Every recommendation
   carries its reasoning, a risk band, a historical return range and a
   projected value, so the UI never has to invent numbers.

   IMPORTANT: this produces educational allocation guidance based on the
   user's own numbers. It is not regulated investment advice, and every
   response carries a disclaimer.
========================================================================== */

/* ==========================================================
                    INSTRUMENT REFERENCE

   Return ranges are long-run historical bands for the Indian
   market, expressed as annual decimals. They are ranges on
   purpose: a single "expected return" invites false precision.
========================================================== */

const INSTRUMENTS = {
    emergency_fund: {
        name: "Emergency Fund (Liquid Fund / Sweep FD)",
        assetClass: "cash",
        risk: "Very Low",
        riskScore: 1,
        returnLow: 0.04,
        returnHigh: 0.07,
        liquidity: "Instant to 1 day",
        lockIn: "None",
        taxNote: "Interest taxed at your income slab rate.",
        supportsSIP: true
    },
    fixed_deposit: {
        name: "Fixed Deposit",
        assetClass: "debt",
        risk: "Very Low",
        riskScore: 1,
        returnLow: 0.06,
        returnHigh: 0.075,
        liquidity: "Premature exit with penalty",
        lockIn: "Chosen tenure",
        taxNote: "Interest taxed at slab rate; 5-year tax-saver FDs qualify for 80C.",
        supportsSIP: false
    },
    debt_funds: {
        name: "Debt Mutual Funds / Bonds",
        assetClass: "debt",
        risk: "Low",
        riskScore: 2,
        returnLow: 0.06,
        returnHigh: 0.09,
        liquidity: "1-3 working days",
        lockIn: "None (exit load may apply)",
        taxNote: "Gains taxed at slab rate for units bought after Apr 2023.",
        supportsSIP: true
    },
    gold: {
        name: "Gold (Sovereign Gold Bonds / Gold ETF)",
        assetClass: "commodity",
        risk: "Medium",
        riskScore: 3,
        returnLow: 0.07,
        returnHigh: 0.11,
        liquidity: "ETF: same day. SGB: 5-year early exit window",
        lockIn: "SGB 8 years (exit allowed from year 5)",
        taxNote: "SGB redemption at maturity is exempt from capital gains tax.",
        supportsSIP: true
    },
    index_funds: {
        name: "Index Funds (Nifty 50 / Nifty 500)",
        assetClass: "equity",
        risk: "Medium-High",
        riskScore: 4,
        returnLow: 0.10,
        returnHigh: 0.14,
        liquidity: "1-3 working days",
        lockIn: "None",
        taxNote: "LTCG above ₹1.25L per year taxed at 12.5%.",
        supportsSIP: true
    },
    etfs: {
        name: "ETFs (Index / Sectoral)",
        assetClass: "equity",
        risk: "Medium-High",
        riskScore: 4,
        returnLow: 0.09,
        returnHigh: 0.14,
        liquidity: "Same day on exchange",
        lockIn: "None",
        taxNote: "Equity ETF LTCG above ₹1.25L per year taxed at 12.5%.",
        supportsSIP: true
    },
    mutual_funds: {
        name: "Active Equity Mutual Funds (Flexi / Large-cap)",
        assetClass: "equity",
        risk: "High",
        riskScore: 5,
        returnLow: 0.11,
        returnHigh: 0.16,
        liquidity: "1-3 working days",
        lockIn: "None (ELSS: 3 years)",
        taxNote: "LTCG above ₹1.25L per year taxed at 12.5%. ELSS qualifies for 80C.",
        supportsSIP: true
    },
    stocks: {
        name: "Direct Stocks",
        assetClass: "equity",
        risk: "Very High",
        riskScore: 6,
        returnLow: 0.08,
        returnHigh: 0.20,
        liquidity: "Same day",
        lockIn: "None",
        taxNote: "LTCG above ₹1.25L per year taxed at 12.5%; STCG at 20%.",
        supportsSIP: false
    },
    reits: {
        name: "REITs / InvITs",
        assetClass: "real_estate",
        risk: "Medium",
        riskScore: 3,
        returnLow: 0.07,
        returnHigh: 0.12,
        liquidity: "Same day on exchange",
        lockIn: "None",
        taxNote: "Distributions are partly taxable depending on their components.",
        supportsSIP: false
    },
    real_estate: {
        name: "Physical Real Estate",
        assetClass: "real_estate",
        risk: "Medium-High",
        riskScore: 4,
        returnLow: 0.05,
        returnHigh: 0.10,
        liquidity: "Months",
        lockIn: "Effectively illiquid",
        taxNote: "LTCG at 12.5% without indexation, or 20% with, for older holdings.",
        supportsSIP: false
    }
};

const EMERGENCY_FUND_MONTHS = 6;

/* ==========================================================
                        HELPERS
========================================================== */

function round2(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function monthsBetween(from, to) {
    const start = new Date(from);
    const end = new Date(to);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 0;
    }

    const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth()) +
        (end.getDate() >= start.getDate() ? 0 : -1);

    return Math.max(0, months);
}

/* ==========================================================
                    SIP / FUTURE VALUE MATHS
========================================================== */

/**
 * Future value of a monthly SIP (contribution at the start of each month).
 * FV = P x [((1+i)^n - 1) / i] x (1+i)
 */
function sipFutureValue(monthly, annualRate, months) {
    const P = Number(monthly) || 0;
    const n = Math.max(0, Math.round(months));

    if (P <= 0 || n === 0) return 0;

    const i = annualRate / 12;

    if (i === 0) return round2(P * n);

    return round2(P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i));
}

/**
 * Monthly SIP required to reach `target`, given an existing lump sum that
 * also compounds for the same period.
 */
function requiredSip(target, existing, annualRate, months) {
    const n = Math.max(1, Math.round(months));
    const i = annualRate / 12;

    const lumpSumFV = i === 0
        ? existing
        : existing * Math.pow(1 + i, n);

    const shortfall = target - lumpSumFV;

    if (shortfall <= 0) return 0;

    if (i === 0) return round2(shortfall / n);

    const factor = ((Math.pow(1 + i, n) - 1) / i) * (1 + i);

    return round2(shortfall / factor);
}

/** Future value of a one-off lump sum. */
function lumpSumFutureValue(amount, annualRate, months) {
    const n = Math.max(0, Math.round(months));
    return round2(Number(amount || 0) * Math.pow(1 + annualRate / 12, n));
}

/* ==========================================================
                    RISK PROFILING

   Combines the user's stated tolerance with what their numbers
   can actually support. A stated "aggressive" profile with a
   9-month horizon still gets a capital-protection allocation.
========================================================== */

function profileRisk({ riskTolerance, months, savingsRate, hasEmergencyFund }) {
    const stated = String(riskTolerance || "").toLowerCase();

    let score = 3; // 1 = very conservative, 5 = very aggressive

    if (stated.includes("conserv") || stated.includes("low")) score = 2;
    else if (stated.includes("aggress") || stated.includes("high")) score = 4;
    else if (stated.includes("very high")) score = 5;

    const reasons = [];

    /* ----------------------------------------------------------
       Capacity adjustments first, hard horizon caps afterwards.

       Applying them in the other order let a later bonus undo the
       cap: a stated-aggressive investor with a 9 month horizon and a
       40% savings rate was capped to 1, then bumped back to 2 by the
       savings-rate bonus, and ended up with equity exposure on money
       needed within the year.
    ---------------------------------------------------------- */

    if (!hasEmergencyFund) {
        score = Math.max(1, score - 1);
        reasons.push(
            "Emergency fund is not fully built yet, so risk is dialled back until it is."
        );
    }

    if (savingsRate >= 30) {
        score = Math.min(5, score + 1);
        reasons.push(
            `A ${Math.round(savingsRate)}% savings rate gives you room to absorb volatility.`
        );
    } else if (savingsRate > 0 && savingsRate < 10) {
        score = Math.max(1, score - 1);
        reasons.push(
            "A thin savings rate means a bad market year would force you to sell at a loss."
        );
    }

    /* Horizon dominates and is applied last. Equity needs time to mean-revert. */
    if (months < 12) {
        score = Math.min(score, 1);
        reasons.push(
            "Horizon is under a year, so capital protection outranks returns."
        );
    } else if (months < 36) {
        score = Math.min(score, 2);
        reasons.push(
            "Under three years is too short to absorb an equity drawdown."
        );
    } else if (months >= 120) {
        score = Math.min(5, score + 1);
        reasons.push(
            "A 10-year-plus horizon gives equity time to ride out full market cycles."
        );
    }

    const labels = {
        1: "Capital Protection",
        2: "Conservative",
        3: "Balanced",
        4: "Growth",
        5: "Aggressive Growth"
    };

    return {
        score: clamp(score, 1, 5),
        label: labels[clamp(score, 1, 5)],
        stated: riskTolerance || "not specified",
        reasons
    };
}

/* ==========================================================
                    ASSET ALLOCATION

   Base split by risk score, then tilted by horizon.
   Weights always total 100.
========================================================== */

function buildAllocation(riskScore, months) {
    /* [equity, debt, gold, realEstate] */
    const base = {
        1: [0, 90, 10, 0],
        2: [20, 65, 15, 0],
        3: [45, 40, 10, 5],
        4: [65, 20, 10, 5],
        5: [75, 10, 10, 5]
    }[riskScore] || [45, 40, 10, 5];

    let [equity, debt, gold, realEstate] = base;

    /* Very long horizons can carry a little more equity. */
    if (months >= 180 && equity > 0) {
        const shift = Math.min(5, debt);
        equity += shift;
        debt -= shift;
    }

    /* Real estate exposure only makes sense over long horizons. */
    if (months < 60 && realEstate > 0) {
        debt += realEstate;
        realEstate = 0;
    }

    const total = equity + debt + gold + realEstate;

    return {
        equity: round2((equity / total) * 100),
        debt: round2((debt / total) * 100),
        gold: round2((gold / total) * 100),
        realEstate: round2((realEstate / total) * 100)
    };
}

/*
    Splits each asset-class bucket into concrete instruments.
    Returns [{ key, weight }].
*/
function selectInstruments(allocation, riskScore, months) {
    const picks = [];

    const push = (key, weight) => {
        if (weight > 0.5) picks.push({ key, weight: round2(weight) });
    };

    /* ---------------- Equity ---------------- */
    const equity = allocation.equity;

    if (equity > 0) {
        if (riskScore <= 3) {
            push("index_funds", equity * 0.7);
            push("etfs", equity * 0.3);
        } else if (riskScore === 4) {
            push("index_funds", equity * 0.5);
            push("mutual_funds", equity * 0.35);
            push("etfs", equity * 0.15);
        } else {
            push("index_funds", equity * 0.4);
            push("mutual_funds", equity * 0.3);
            push("etfs", equity * 0.1);
            push("stocks", equity * 0.2);
        }
    }

    /* ---------------- Debt ---------------- */
    const debt = allocation.debt;

    if (debt > 0) {
        if (months <= 24) {
            push("fixed_deposit", debt * 0.6);
            push("debt_funds", debt * 0.4);
        } else {
            push("debt_funds", debt * 0.6);
            push("fixed_deposit", debt * 0.4);
        }
    }

    /* ---------------- Gold ---------------- */
    if (allocation.gold > 0) {
        push("gold", allocation.gold);
    }

    /* ---------------- Real estate ---------------- */
    if (allocation.realEstate > 0) {
        /* REITs, not physical property - a goal SIP cannot buy a flat. */
        push("reits", allocation.realEstate);
    }

    /* Normalise so rounding cannot drift the total away from 100. */
    const total = picks.reduce((sum, item) => sum + item.weight, 0);

    return picks.map(item => ({
        ...item,
        weight: round2((item.weight / total) * 100)
    }));
}

/* ==========================================================
                    BLENDED RETURN
========================================================== */

function blendedReturn(picks) {
    let low = 0;
    let high = 0;

    for (const pick of picks) {
        const instrument = INSTRUMENTS[pick.key];
        low += (pick.weight / 100) * instrument.returnLow;
        high += (pick.weight / 100) * instrument.returnHigh;
    }

    return {
        low,
        high,
        expected: (low + high) / 2
    };
}

/* ==========================================================
                    MILESTONES
========================================================== */

function buildMilestones(target, saved, monthlySip, annualRate, months, startDate) {
    const marks = [0.25, 0.5, 0.75, 1];
    const milestones = [];
    const start = new Date(startDate || Date.now());

    for (const mark of marks) {
        const goalValue = target * mark;

        if (saved >= goalValue) {
            milestones.push({
                percent: mark * 100,
                amount: round2(goalValue),
                status: "reached",
                etaMonths: 0,
                etaDate: null,
                note: "Already covered by your current savings."
            });
            continue;
        }

        /* Walk months forward until the projection crosses the mark. */
        let reachedAt = null;

        for (let month = 1; month <= months + 240; month += 1) {
            const value =
                lumpSumFutureValue(saved, annualRate, month) +
                sipFutureValue(monthlySip, annualRate, month);

            if (value >= goalValue) {
                reachedAt = month;
                break;
            }
        }

        const etaDate = reachedAt
            ? new Date(
                start.getFullYear(),
                start.getMonth() + reachedAt,
                start.getDate()
            )
            : null;

        milestones.push({
            percent: mark * 100,
            amount: round2(goalValue),
            status: reachedAt === null
                ? "unreachable"
                : reachedAt <= months
                    ? "on-track"
                    : "late",
            etaMonths: reachedAt,
            etaDate: etaDate ? etaDate.toISOString().slice(0, 10) : null,
            note: reachedAt === null
                ? "Not reachable at the current contribution level."
                : reachedAt <= months
                    ? "Projected before your deadline."
                    : `Projected ${reachedAt - months} month(s) after your deadline.`
        });
    }

    return milestones;
}

/* ==========================================================
                    BUILD PLAN
========================================================== */

/**
 * @param {object} input
 * @param {object} input.goal        { title, targetAmount, savedAmount, deadline }
 * @param {object} input.finances    { monthlyIncome, monthlyExpense, totalSavings, savingsRate }
 * @param {string} input.riskTolerance  "conservative" | "moderate" | "aggressive"
 */
function buildPlan(input = {}) {
    const goal = input.goal || {};
    const finances = input.finances || {};

    const target = Number(goal.targetAmount) || 0;
    const saved = Math.max(0, Number(goal.savedAmount) || 0);

    if (target <= 0) {
        return {
            success: false,
            message: "This goal needs a target amount before a plan can be built."
        };
    }

    const now = new Date();
    const months = goal.deadline ? monthsBetween(now, goal.deadline) : 60;

    const monthlyIncome = Math.max(0, Number(finances.monthlyIncome) || 0);
    const monthlyExpense = Math.max(0, Number(finances.monthlyExpense) || 0);

    const monthlySurplus = round2(monthlyIncome - monthlyExpense);

    const savingsRate = monthlyIncome > 0
        ? round2((monthlySurplus / monthlyIncome) * 100)
        : Number(finances.savingsRate) || 0;

    const emergencyTarget = round2(monthlyExpense * EMERGENCY_FUND_MONTHS);

    const emergencyCovered = emergencyTarget > 0
        ? Math.min(1, (Number(finances.totalSavings) || 0) / emergencyTarget)
        : 1;

    const hasEmergencyFund = emergencyCovered >= 1;

    /* ---------------- Deadline already passed ---------------- */
    if (months <= 0) {
        return {
            success: true,
            goal: {
                title: goal.title,
                target: round2(target),
                saved: round2(saved),
                remaining: round2(Math.max(0, target - saved)),
                deadline: goal.deadline,
                months: 0,
                progressPercent: round2(Math.min(100, (saved / target) * 100))
            },
            status: saved >= target ? "completed" : "overdue",
            message: saved >= target
                ? "This goal is already fully funded."
                : "The deadline for this goal has passed. Extend it to get a fresh plan.",
            recommendations: [],
            milestones: [],
            disclaimer: DISCLAIMER
        };
    }

    /* ---------------- Already funded ---------------- */
    if (saved >= target) {
        return {
            success: true,
            goal: {
                title: goal.title,
                target: round2(target),
                saved: round2(saved),
                remaining: 0,
                deadline: goal.deadline,
                months,
                progressPercent: 100
            },
            status: "completed",
            message: "This goal is fully funded. Consider moving the surplus to your next goal.",
            recommendations: [],
            milestones: [],
            disclaimer: DISCLAIMER
        };
    }

    /* ---------------- Profile + allocation ---------------- */
    const risk = profileRisk({
        riskTolerance: input.riskTolerance,
        months,
        savingsRate,
        hasEmergencyFund
    });

    const allocation = buildAllocation(risk.score, months);
    const picks = selectInstruments(allocation, risk.score, months);
    const returns = blendedReturn(picks);

    /* ---------------- Required contribution ---------------- */
    const sipAtExpected = requiredSip(target, saved, returns.expected, months);
    const sipAtLow = requiredSip(target, saved, returns.low, months);
    const sipIfNoGrowth = requiredSip(target, saved, 0, months);

    const affordability = monthlySurplus > 0
        ? round2((sipAtExpected / monthlySurplus) * 100)
        : null;

    /* ---------------- Per-instrument recommendations ---------------- */
    const recommendations = picks.map(pick => {
        const instrument = INSTRUMENTS[pick.key];
        const sipShare = round2((sipAtExpected * pick.weight) / 100);
        const lumpShare = round2((saved * pick.weight) / 100);

        const projectedLow =
            sipFutureValue(sipShare, instrument.returnLow, months) +
            lumpSumFutureValue(lumpShare, instrument.returnLow, months);

        const projectedHigh =
            sipFutureValue(sipShare, instrument.returnHigh, months) +
            lumpSumFutureValue(lumpShare, instrument.returnHigh, months);

        return {
            key: pick.key,
            name: instrument.name,
            assetClass: instrument.assetClass,
            allocationPercent: pick.weight,
            monthlySip: instrument.supportsSIP ? sipShare : 0,
            monthlyAmount: sipShare,
            supportsSIP: instrument.supportsSIP,
            lumpSumAllocation: lumpShare,
            risk: instrument.risk,
            riskScore: instrument.riskScore,
            expectedReturnRange: {
                low: round2(instrument.returnLow * 100),
                high: round2(instrument.returnHigh * 100)
            },
            projectedValue: {
                low: round2(projectedLow),
                high: round2(projectedHigh)
            },
            liquidity: instrument.liquidity,
            lockIn: instrument.lockIn,
            taxNote: instrument.taxNote,
            reasoning: buildReasoning(pick, instrument, months, risk, allocation)
        };
    });

    /* ---------------- Emergency fund gets its own line ---------------- */
    if (!hasEmergencyFund && emergencyTarget > 0) {
        const gap = round2(
            emergencyTarget - (Number(finances.totalSavings) || 0)
        );

        recommendations.unshift({
            key: "emergency_fund",
            name: INSTRUMENTS.emergency_fund.name,
            assetClass: "cash",
            allocationPercent: 0,
            monthlySip: round2(gap / Math.min(12, Math.max(1, months))),
            monthlyAmount: round2(gap / Math.min(12, Math.max(1, months))),
            supportsSIP: true,
            lumpSumAllocation: 0,
            priority: "before investing",
            risk: INSTRUMENTS.emergency_fund.risk,
            riskScore: 1,
            expectedReturnRange: {
                low: round2(INSTRUMENTS.emergency_fund.returnLow * 100),
                high: round2(INSTRUMENTS.emergency_fund.returnHigh * 100)
            },
            projectedValue: {
                low: emergencyTarget,
                high: emergencyTarget
            },
            liquidity: INSTRUMENTS.emergency_fund.liquidity,
            lockIn: INSTRUMENTS.emergency_fund.lockIn,
            taxNote: INSTRUMENTS.emergency_fund.taxNote,
            reasoning:
                `Your emergency buffer covers about ${Math.round(emergencyCovered * 6)} of ` +
                `${EMERGENCY_FUND_MONTHS} months of expenses (₹${emergencyTarget.toLocaleString("en-IN")} target). ` +
                "Closing this gap first means a job loss or medical bill will not force you " +
                "to liquidate goal investments at the worst possible moment."
        });
    }

    /* ---------------- Projection ---------------- */
    const projectedAtExpected = round2(
        lumpSumFutureValue(saved, returns.expected, months) +
        sipFutureValue(sipAtExpected, returns.expected, months)
    );

    const projectedAtLow = round2(
        lumpSumFutureValue(saved, returns.low, months) +
        sipFutureValue(sipAtExpected, returns.low, months)
    );

    const projectedAtHigh = round2(
        lumpSumFutureValue(saved, returns.high, months) +
        sipFutureValue(sipAtExpected, returns.high, months)
    );

    const feasible = monthlySurplus <= 0
        ? "unknown"
        : sipAtExpected <= monthlySurplus
            ? "comfortable"
            : sipAtExpected <= monthlySurplus * 1.2
                ? "tight"
                : "unrealistic";

    const milestones = buildMilestones(
        target,
        saved,
        sipAtExpected,
        returns.expected,
        months,
        now
    );

    return {
        success: true,
        status: "active",

        goal: {
            title: goal.title,
            target: round2(target),
            saved: round2(saved),
            remaining: round2(target - saved),
            deadline: goal.deadline,
            months,
            years: round2(months / 12),
            progressPercent: round2((saved / target) * 100)
        },

        profile: {
            riskLabel: risk.label,
            riskScore: risk.score,
            statedTolerance: risk.stated,
            reasons: risk.reasons,
            monthlyIncome,
            monthlyExpense,
            monthlySurplus,
            savingsRate,
            emergencyFund: {
                target: emergencyTarget,
                coveragePercent: round2(emergencyCovered * 100),
                funded: hasEmergencyFund
            }
        },

        contribution: {
            monthlySip: sipAtExpected,
            monthlySipConservative: sipAtLow,
            monthlySipWithoutGrowth: sipIfNoGrowth,
            weekly: round2(sipAtExpected / 4.345),
            daily: round2((sipAtExpected * 12) / 365),
            shareOfSurplusPercent: affordability,
            feasibility: feasible,
            growthDoingTheWork: round2(
                Math.max(0, sipIfNoGrowth - sipAtExpected)
            )
        },

        allocation,

        expectedReturn: {
            low: round2(returns.low * 100),
            high: round2(returns.high * 100),
            blended: round2(returns.expected * 100)
        },

        projection: {
            atLowReturn: projectedAtLow,
            atBlendedReturn: projectedAtExpected,
            atHighReturn: projectedAtHigh,
            totalContributed: round2(sipAtExpected * months + saved),
            growthComponent: round2(
                projectedAtExpected - (sipAtExpected * months + saved)
            )
        },

        recommendations,
        milestones,

        summary: buildSummaryText({
            goal,
            months,
            sip: sipAtExpected,
            risk,
            feasible,
            monthlySurplus,
            returns
        }),

        disclaimer: DISCLAIMER
    };
}

/* ==========================================================
                    NARRATIVE HELPERS
========================================================== */

const DISCLAIMER =
    "This is an educational projection generated from your own income, " +
    "expenses and time horizon - not personalised investment advice. " +
    "Return ranges are long-run historical bands, not guarantees; markets " +
    "can and do fall. Consider speaking to a SEBI-registered adviser before " +
    "committing money.";

function buildReasoning(pick, instrument, months, risk, allocation) {
    const years = Math.round((months / 12) * 10) / 10;

    const horizonNote = months < 12
        ? "with under a year to run"
        : months < 36
            ? `over a ${years}-year horizon, which is short`
            : months < 84
                ? `over a ${years}-year horizon`
                : `over a long ${years}-year horizon`;

    const base = {
        index_funds:
            `Index funds carry the ${allocation.equity}% equity core ${horizonNote}. ` +
            "They track the whole market at a fraction of the cost of active funds, " +
            "and cost is the one variable you control with certainty.",

        etfs:
            "ETFs add the same broad-market exposure with intraday liquidity, " +
            "useful if you may need to rebalance without waiting for a fund NAV cycle.",

        mutual_funds:
            `Active equity funds take a smaller slice because your ${risk.label.toLowerCase()} ` +
            "profile can absorb manager risk in exchange for a shot at beating the index. " +
            "Most do not beat it, which is why this is a minority position.",

        stocks:
            "Direct stocks are capped deliberately. They are the only line here where a " +
            "single bad decision can permanently impair the goal, so they sit alongside " +
            "diversified holdings rather than replacing them.",

        fixed_deposit:
            `Fixed deposits anchor the ${allocation.debt}% debt portion ${horizonNote}. ` +
            "The return is modest but the maturity value is knowable on day one, which is " +
            "exactly what a dated goal needs.",

        debt_funds:
            "Debt funds and bonds sit beside the FD for slightly better returns and easier " +
            "partial withdrawals, at the cost of small interest-rate swings.",

        gold:
            `Gold takes ${allocation.gold}% as a hedge. It tends to hold value when equities ` +
            "and the rupee are under stress, so it smooths the path rather than driving returns.",

        reits:
            "REITs give you rent-linked real estate income without the ticket size, stamp duty " +
            "or illiquidity of buying property outright.",

        real_estate:
            "Physical property is included only because the horizon is long enough to absorb " +
            "its illiquidity and transaction costs."
    };

    return (
        base[pick.key] ||
        `${instrument.name} contributes ${pick.weight}% of the portfolio at a ${instrument.risk.toLowerCase()} risk level.`
    );
}

function buildSummaryText({ goal, months, sip, risk, feasible, monthlySurplus, returns }) {
    const money = value =>
        `₹${Math.round(value).toLocaleString("en-IN")}`;

    const lines = [
        `To reach ${goal.title || "this goal"} in ${months} month(s), invest about ` +
        `${money(sip)} per month in a ${risk.label.toLowerCase()} portfolio ` +
        `targeting ${(returns.expected * 100).toFixed(1)}% a year.`
    ];

    if (feasible === "comfortable") {
        lines.push(
            `That fits inside your current monthly surplus of ${money(monthlySurplus)}.`
        );
    } else if (feasible === "tight") {
        lines.push(
            `That is close to your entire ${money(monthlySurplus)} monthly surplus - ` +
            "it works, but leaves no slack for a bad month."
        );
    } else if (feasible === "unrealistic") {
        lines.push(
            `Your current surplus is ${money(monthlySurplus)}, so this target needs either ` +
            "a longer deadline, a smaller amount, or a higher savings rate. " +
            "Stretching the deadline is usually the least painful lever."
        );
    } else {
        lines.push(
            "Add your income and expenses so the plan can be checked against what you " +
            "can actually set aside each month."
        );
    }

    return lines.join(" ");
}

module.exports = {
    INSTRUMENTS,
    EMERGENCY_FUND_MONTHS,
    DISCLAIMER,
    round2,
    monthsBetween,
    sipFutureValue,
    requiredSip,
    lumpSumFutureValue,
    profileRisk,
    buildAllocation,
    selectInstruments,
    blendedReturn,
    buildMilestones,
    buildPlan
};
