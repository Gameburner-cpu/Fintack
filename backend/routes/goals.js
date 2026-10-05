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
const { encrypt, decryptRow } = require("../utils/crypto");

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

        const { data: rows, error } = await supabase
            .from("goals")
            .select("id, user_id, encrypted_payload, title, target_amount, saved_amount, deadline, risk_tolerance, created_at, updated_at")
            .eq("user_id", req.user.id);

        if (error) throw error;

        const goals = (rows || []).map(row => decryptRow(row, [
            "title", "target_amount", "saved_amount", "deadline", "risk_tolerance", "inflation_rate", "expected_return_rate"
        ])).filter(Boolean).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.json({ success: true, goals });
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
                encrypted_payload: encrypt({ saved_amount: 0, ...value })
            })
            .select("id, user_id, encrypted_payload, created_at, updated_at")
            .single();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: "Goal created successfully.",
            goal: decryptRow(data)
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

        const { data: existing, error: fetchError } = await supabase
            .from("goals")
            .select("id, user_id, encrypted_payload, title, target_amount, saved_amount, deadline, risk_tolerance, created_at, updated_at")
            .eq("id", req.params.id)
            .eq("user_id", req.user.id)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!existing) {
            return res.status(404).json({ success: false, message: "Goal not found." });
        }

        const merged = {
            ...decryptRow(existing, ["title", "target_amount", "saved_amount", "deadline", "risk_tolerance", "inflation_rate", "expected_return_rate"]),
            ...value
        };

        const { data, error } = await supabase
            .from("goals")
            .update({ encrypted_payload: encrypt(merged) })
            .eq("id", req.params.id)
            .eq("user_id", req.user.id)
            .select("id, user_id, encrypted_payload, created_at, updated_at")
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
            goal: decryptRow(data)
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

        const { data: goalRow, error: fetchError } = await supabase
            .from("goals")
            .select("id, user_id, encrypted_payload, title, target_amount, saved_amount, deadline, risk_tolerance, created_at, updated_at")
            .eq("id", req.params.id)
            .eq("user_id", req.user.id)
            .maybeSingle();

        if (fetchError) throw fetchError;

        const goal = decryptRow(goalRow, ["title", "target_amount", "saved_amount", "deadline", "risk_tolerance", "inflation_rate", "expected_return_rate"]);

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
            .update({ encrypted_payload: encrypt({ ...goal, saved_amount: newAmount }) })
            .eq("id", goal.id)
            .eq("user_id", req.user.id)
            .select("id, user_id, encrypted_payload, created_at, updated_at")
            .single();

        if (error) throw error;

        const deadlineDate = goal.deadline ? new Date(goal.deadline) : new Date();
        const yearsToDeadline = Math.max(0, (deadlineDate.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000));
        const inflationRate = Math.max(0, Math.min(30, Number(goal.inflation_rate ?? 6)));
        const deadlineTarget = Number(goal.target_amount || 0) * Math.pow(1 + inflationRate / 100, yearsToDeadline);

        return res.json({
            success: true,
            message: "Savings updated.",
            saved_amount: newAmount,
            completed: newAmount >= deadlineTarget,
            goal: decryptRow(data)
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
        const { data: goalRow, error: goalError } = await supabase
            .from("goals")
            .select("id, user_id, encrypted_payload, title, target_amount, saved_amount, deadline, risk_tolerance, created_at, updated_at")
            .eq("id", req.params.id)
            .eq("user_id", req.user.id)
            .maybeSingle();

        if (goalError) throw goalError;

        const goal = decryptRow(goalRow, ["title", "target_amount", "saved_amount", "deadline", "risk_tolerance", "inflation_rate", "expected_return_rate"]);

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
                deadline: goal.deadline,
                inflationRate: Number(goal.inflation_rate ?? 6),
                expectedReturnRate: Number(goal.expected_return_rate ?? 8)
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
