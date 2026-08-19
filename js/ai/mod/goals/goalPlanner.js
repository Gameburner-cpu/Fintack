/* ==========================================================
                FINTACK GOAL PLANNER ENGINE
========================================================== */

/*
    This module handles the mathematical planning for goals.

    It does NOT:
    - modify the UI
    - call the backend
    - create goals
    - update savings

    It only calculates how much the user needs to save
    to reach a goal by its deadline.
*/


const GoalPlanner = {

    /* ======================================================
                    SAFE NUMBER CONVERSION
    ====================================================== */

    toNumber(value) {

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    },


    /* ======================================================
                    NORMALIZE DATE
    ====================================================== */

    normalizeDate(date) {

        if (!date)
            return null;

        const parsedDate =
            date instanceof Date
                ? new Date(date)
                : new Date(date);

        if (
            Number.isNaN(
                parsedDate.getTime()
            )
        ) {
            return null;
        }

        /*
            Remove time from calculation.

            This prevents hours/minutes/timezone differences
            from affecting the number of days remaining.
        */

        parsedDate.setHours(
            0,
            0,
            0,
            0
        );

        return parsedDate;
    },


    /* ======================================================
                    DAYS BETWEEN DATES
    ====================================================== */

    getDaysRemaining(deadline, fromDate = new Date()) {

        const end =
            this.normalizeDate(deadline);

        const start =
            this.normalizeDate(fromDate);

        if (!end || !start)
            return 0;


        const millisecondsPerDay =
            1000 * 60 * 60 * 24;


        const difference =
            end.getTime() -
            start.getTime();


        return Math.max(
            0,
            Math.ceil(
                difference /
                millisecondsPerDay
            )
        );
    },


    /* ======================================================
                    MONTHS REMAINING
    ====================================================== */

    getMonthsRemaining(deadline, fromDate = new Date()) {

        const days =
            this.getDaysRemaining(
                deadline,
                fromDate
            );

        /*
            Average calendar month = 30.4375 days.
        */

        return days > 0
            ? days / 30.4375
            : 0;
    },


    /* ======================================================
                    WEEKS REMAINING
    ====================================================== */

    getWeeksRemaining(deadline, fromDate = new Date()) {

        const days =
            this.getDaysRemaining(
                deadline,
                fromDate
            );

        return days > 0
            ? days / 7
            : 0;
    },


    /* ======================================================
                    MAIN GOAL CALCULATION
    ====================================================== */

    calculate(goal, options = {}) {

        if (!goal) {
            return {
                success: false,
                error: "Goal data is required."
            };
        }


        const targetAmount =
            this.toNumber(
                goal.target_amount
            );


        /*
            Your existing API/UI currently uses saved_amount.

            current_amount is included as a fallback in case
            some existing backend records use that field.
        */

        const savedAmount =
            this.toNumber(
                goal.saved_amount ??
                goal.current_amount
            );


        const deadline =
            goal.deadline;


        const today =
            options.fromDate ||
            new Date();


        /* ==================================================
                        VALIDATION
        ================================================== */

        if (targetAmount <= 0) {

            return {
                success: false,
                error:
                    "Target amount must be greater than zero."
            };
        }


        const deadlineDate =
            this.normalizeDate(deadline);


        if (!deadlineDate) {

            return {
                success: false,
                error:
                    "A valid goal deadline is required."
            };
        }


        /* ==================================================
                        BASIC VALUES
        ================================================== */

        const remainingAmount =
            Math.max(
                targetAmount -
                savedAmount,
                0
            );


        const progress =
            targetAmount > 0
                ? Math.min(
                    100,
                    Math.max(
                        0,
                        (
                            savedAmount /
                            targetAmount
                        ) * 100
                    )
                )
                : 0;


        const daysRemaining =
            this.getDaysRemaining(
                deadlineDate,
                today
            );


        const weeksRemaining =
            this.getWeeksRemaining(
                deadlineDate,
                today
            );


        const monthsRemaining =
            this.getMonthsRemaining(
                deadlineDate,
                today
            );


        /* ==================================================
                    GOAL COMPLETED
        ================================================== */

        if (remainingAmount <= 0) {

            return {

                success: true,

                status: "completed",

                targetAmount,

                savedAmount,

                remainingAmount: 0,

                progress: 100,

                daysRemaining,

                weeksRemaining,

                monthsRemaining,

                required: {
                    daily: 0,
                    weekly: 0,
                    monthly: 0
                }
            };
        }


        /* ==================================================
                    DEADLINE PASSED
        ================================================== */

        if (daysRemaining <= 0) {

            return {

                success: true,

                status: "deadline-passed",

                targetAmount,

                savedAmount,

                remainingAmount,

                progress,

                daysRemaining: 0,

                weeksRemaining: 0,

                monthsRemaining: 0,

                required: {
                    daily: remainingAmount,
                    weekly: remainingAmount,
                    monthly: remainingAmount
                }
            };
        }


        /* ==================================================
                    SAVINGS REQUIREMENT
        ================================================== */

        const dailyRequired =
            remainingAmount /
            daysRemaining;


        /*
            Weekly is based on the daily requirement so that
            partial weeks near the deadline remain accurate.
        */

        const weeklyRequired =
            dailyRequired * 7;


        /*
            Average month length is used so the monthly figure
            stays aligned with the actual deadline.
        */

        const monthlyRequired =
            dailyRequired * 30.4375;


        /* ==================================================
                    RETURN PLAN
        ================================================== */

        return {

            success: true,

            status: "active",

            targetAmount,

            savedAmount,

            remainingAmount,

            progress,

            deadline:
                deadlineDate.toISOString(),

            daysRemaining,

            weeksRemaining,

            monthsRemaining,

            required: {

                daily:
                    Math.ceil(
                        dailyRequired
                    ),

                weekly:
                    Math.ceil(
                        weeklyRequired
                    ),

                monthly:
                    Math.ceil(
                        monthlyRequired
                    )
            }
        };
    },


    /* ======================================================
                FINANCIAL AFFORDABILITY ANALYSIS
    ====================================================== */

    analyzeAffordability(plan, financialData = {}) {

        if (
            !plan ||
            !plan.success ||
            plan.status !== "active"
        ) {
            return {
                status: "unknown",
                message:
                    "Affordability analysis unavailable."
            };
        }


        const monthlyIncome =
            this.toNumber(
                financialData.monthlyIncome
            );


        const monthlyExpenses =
            this.toNumber(
                financialData.monthlyExpense ??
                financialData.monthlyExpenses
            );


        const availableMonthlySavings =
            Math.max(
                monthlyIncome -
                monthlyExpenses,
                0
            );


        const requiredMonthlySavings =
            this.toNumber(
                plan.required?.monthly
            );


        /* ==================================================
                    NO INCOME DATA
        ================================================== */

        if (monthlyIncome <= 0) {

            return {

                status: "no-data",

                availableMonthlySavings,

                requiredMonthlySavings,

                shortfall:
                    requiredMonthlySavings,

                message:
                    "Add income data to analyze whether this goal is affordable."
            };
        }


        /* ==================================================
                    CALCULATE DIFFERENCE
        ================================================== */

        const difference =
            availableMonthlySavings -
            requiredMonthlySavings;


        /*
            Ratio tells us how demanding the goal is compared
            with the user's available monthly savings.
        */

        const affordabilityRatio =
            availableMonthlySavings > 0
                ? requiredMonthlySavings /
                  availableMonthlySavings
                : Infinity;


        let status;
        let message;


        /* ==================================================
                        STATUS ENGINE
        ================================================== */

        if (
            availableMonthlySavings >=
            requiredMonthlySavings
        ) {

            if (affordabilityRatio <= 0.6) {

                status = "comfortable";

                message =
                    "This goal is comfortably achievable at your current financial pace.";

            } else {

                status = "on-track";

                message =
                    "This goal is achievable if you maintain your current savings capacity.";
            }

        } else {

            const shortfall =
                Math.abs(difference);


            if (
                requiredMonthlySavings > 0 &&
                shortfall /
                requiredMonthlySavings <= 0.2
            ) {

                status = "tight";

                message =
                    "You are close to the required savings pace, but some spending adjustments may be needed.";

            } else {

                status = "at-risk";

                message =
                    "Your current savings capacity is below what this goal requires.";
            }
        }


        return {

            status,

            monthlyIncome,

            monthlyExpenses,

            availableMonthlySavings,

            requiredMonthlySavings,

            difference,

            shortfall:
                Math.max(
                    requiredMonthlySavings -
                    availableMonthlySavings,
                    0
                ),

            affordabilityRatio,

            message
        };
    },


    /* ======================================================
                    COMPLETE SMART PLAN
    ====================================================== */

    createSmartPlan(goal, financialData = {}, options = {}) {

        const plan =
            this.calculate(
                goal,
                options
            );


        if (!plan.success)
            return plan;


        const affordability =
            this.analyzeAffordability(
                plan,
                financialData
            );


        return {

            ...plan,

            affordability
        };
    }

};


export default GoalPlanner;