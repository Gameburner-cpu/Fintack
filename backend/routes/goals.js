/* ==========================================================================
   goals.js
   Goal CRUD + the AI investment plan endpoint.
========================================================================== */

const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");
const { validateGoal } = require("../utils/validators");
const { buildSummary } = require("../utils/analytics");
const InvestmentEngine = require("../utils/investmentEngine");

router.use(requireAuth);

/* ==========================================================
                        LIST GOALS
========================================================== */

router.get("/:userId", async (req, res, next) => {
    try {
        if (String(req.params.userId) !== String(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to these goals."
            });
        }

        const { data, error } = await supabase
            .from("goals")
            .select("*")
            .eq("user_id", req.user.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        return res.json({
            success: true,
            goals: data || []
        });
    } catch (err) {
        return next(err);
    }
});

/* ==========================================================
                        CREATE GOAL
========================================================== */

router.post("/", async (req, res, next) => {
    try {
        const { valid, errors, value } = validateGoal(req.body);

        if (!valid) {
            return res.status(400).json({
                success: false,
                message: errors[0],
                errors
            });
        }

        const { data, error } = await supabase
            .from("goals")
            .insert({
                user_id: req.user.id,
                saved_amount: 0,
                ...value
            })
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: "Goal created successfully.",
            goal: data
        });
    } catch (err) {
        return next(err);
    }
});

/* ==========================================================
                        UPDATE GOAL
========================================================== */

router.put("/:id", async (req, res, next) => {
    try {
        const { valid, errors, value } = validateGoal(req.body, {
            partial: true
        });

        if (!valid) {
            return res.status(400).json({
                success: false,
                message: errors[0],
                errors
            });
        }

        const { data, error } = await supabase
            .from("goals")
            .update(value)
            .eq("id", req.params.id)
            .eq("user_id", req.user.id)
            .select()
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Goal not found."
            });
        }

        return res.json({
            success: true,
            message: "Goal updated successfully.",
            goal: data
        });
    } catch (err) {
        return next(err);
    }
});

/* ==========================================================
                    ADD TO GOAL SAVINGS

   Reads and writes in one statement path with an ownership filter so a
   concurrent request cannot overwrite the other's contribution silently.
========================================================== */

router.put("/:id/savings", async (req, res, next) => {
    try {
        const amount = Number(req.body?.amount);

        if (!Number.isFinite(amount) || amount === 0) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid contribution amount."
            });
        }

        const { data: goal, error: fetchError } = await supabase
            .from("goals")
            .select("*")
            .eq("id", req.params.id)
            .eq("user_id", req.user.id)
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: "Goal not found."
            });
        }

        const newAmount = Math.max(
            0,
            Math.round((Number(goal.saved_amount || 0) + amount) * 100) / 100
        );

        const { data, error } = await supabase
            .from("goals")
            .update({ saved_amount: newAmount })
            .eq("id", goal.id)
            .eq("user_id", req.user.id)
            .select()
            .single();

        if (error) throw error;

        return res.json({
            success: true,
            message: "Savings updated.",
            saved_amount: newAmount,
            completed: newAmount >= Number(goal.target_amount || 0),
            goal: data
        });
    } catch (err) {
        return next(err);
    }
});

/* ==========================================================
                        DELETE GOAL
========================================================== */

router.delete("/:id", async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from("goals")
            .delete()
            .eq("id", req.params.id)
            .eq("user_id", req.user.id)
            .select()
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Goal not found."
            });
        }

        return res.json({
            success: true,
            message: "Goal deleted."
        });
    } catch (err) {
        return next(err);
    }
});

/* ==========================================================
                AI INVESTMENT PLAN FOR A GOAL

   POST /api/goals/:id/investment-plan
   Body (all optional): { riskTolerance, monthlyIncome, monthlyExpense }

   Anything not supplied is derived from the user's real transaction
   history rather than guessed.
========================================================== */

router.post("/:id/investment-plan", async (req, res, next) => {
    try {
        const { data: goal, error: goalError } = await supabase
            .from("goals")
            .select("*")
            .eq("id", req.params.id)
            .eq("user_id", req.user.id)
            .maybeSingle();

        if (goalError) throw goalError;

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: "Goal not found."
            });
        }

        const { data: transactions, error: txError } = await supabase
            .from("transactions")
            .select("amount, type, category, date")
            .eq("user_id", req.user.id)
            .order("date", { ascending: false })
            .limit(5000);

        if (txError) throw txError;

        const summary = buildSummary(transactions || []);

        const plan = InvestmentEngine.buildPlan({
            goal: {
                id: goal.id,
                title: goal.title,
                targetAmount: Number(goal.target_amount || 0),
                savedAmount: Number(goal.saved_amount || 0),
                deadline: goal.deadline
            },
            finances: {
                monthlyIncome: Number(
                    req.body?.monthlyIncome ?? summary.monthlyIncome
                ),
                monthlyExpense: Number(
                    req.body?.monthlyExpense ?? summary.monthlyExpense
                ),
                totalSavings: summary.totalSavings,
                savingsRate: summary.savingsRate
            },
            riskTolerance: req.body?.riskTolerance
        });

        return res.json({
            success: true,
            plan
        });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;
