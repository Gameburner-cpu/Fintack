/* ==========================================================================
   transactions.js
   Full transaction CRUD + analytics, scoped to the authenticated user.
========================================================================== */

const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");
const { validateTransaction, CATEGORIES } = require("../utils/validators");
const { buildSummary } = require("../utils/analytics");

/* Every route below requires a valid session. */
router.use(requireAuth);

const MAX_PAGE_SIZE = 500;

/* ==========================================================
                    CATEGORY REFERENCE
========================================================== */

router.get("/meta/categories", (req, res) => {
    res.json({
        success: true,
        categories: CATEGORIES
    });
});

/* ==========================================================
                    LIST TRANSACTIONS

   GET /api/transactions/:userId
     ?from=YYYY-MM-DD & to=YYYY-MM-DD
     &type=income|expense
     &category=Food
     &search=coffee
     &limit=100 & offset=0

   Filtering happens in Postgres rather than in the browser, which is what
   keeps the dashboard usable once a user has thousands of rows.
========================================================== */

router.get("/:userId", async (req, res, next) => {
    try {
        const { userId } = req.params;

        if (String(userId) !== String(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to these transactions."
            });
        }

        const limit = Math.min(
            MAX_PAGE_SIZE,
            Math.max(1, Number(req.query.limit) || MAX_PAGE_SIZE)
        );

        const offset = Math.max(0, Number(req.query.offset) || 0);

        let query = supabase
            .from("transactions")
            .select("*", { count: "exact" })
            .eq("user_id", userId);

        if (req.query.from) query = query.gte("date", req.query.from);
        if (req.query.to) query = query.lte("date", req.query.to);

        if (req.query.type) {
            query = query.eq("type", String(req.query.type).toLowerCase());
        }

        if (req.query.category) {
            query = query.eq("category", req.query.category);
        }

        if (req.query.search) {
            const term = String(req.query.search).replace(/[%,]/g, "");
            query = query.ilike("title", `%${term}%`);
        }

        const { data, error, count } = await query
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        return res.json({
            success: true,
            transactions: data || [],
            pagination: {
                total: count ?? (data || []).length,
                limit,
                offset,
                hasMore: (count ?? 0) > offset + (data || []).length
            }
        });
    } catch (err) {
        return next(err);
    }
});

/* ==========================================================
                    ANALYTICS SUMMARY

   GET /api/transactions/:userId/analytics
========================================================== */

router.get("/:userId/analytics", async (req, res, next) => {
    try {
        const { userId } = req.params;

        if (String(userId) !== String(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this data."
            });
        }

        const { data, error } = await supabase
            .from("transactions")
            .select("id, title, description, amount, type, category, date, created_at")
            .eq("user_id", userId)
            .order("date", { ascending: false })
            .limit(10000);

        if (error) throw error;

        return res.json({
            success: true,
            summary: buildSummary(data || [])
        });
    } catch (err) {
        return next(err);
    }
});

/* ==========================================================
                    CREATE TRANSACTION
========================================================== */

router.post("/", async (req, res, next) => {
    try {
        const userId = req.body?.user_id ?? req.user.id;

        if (String(userId) !== String(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "You can only create transactions on your own account."
            });
        }

        const { valid, errors, value } = validateTransaction(req.body);

        if (!valid) {
            return res.status(400).json({
                success: false,
                message: errors[0],
                errors
            });
        }

        const { data, error } = await supabase
            .from("transactions")
            .insert({
                user_id: req.user.id,
                ...value
            })
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: "Transaction added successfully.",
            transaction: data
        });
    } catch (err) {
        return next(err);
    }
});

/* ==========================================================
                    READ ONE
========================================================== */

router.get("/detail/:id", async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from("transactions")
            .select("*")
            .eq("id", req.params.id)
            .eq("user_id", req.user.id)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found."
            });
        }

        return res.json({
            success: true,
            transaction: data
        });
    } catch (err) {
        return next(err);
    }
});

/* ==========================================================
                    UPDATE TRANSACTION

   PUT /api/transactions/:id
   Accepts any subset of { title, amount, category, date, type, description }.
========================================================== */

router.put("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: existing, error: fetchError } = await supabase
            .from("transactions")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found."
            });
        }

        if (String(existing.user_id) !== String(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "You can only edit your own transactions."
            });
        }

        const { valid, errors, value } = validateTransaction(req.body, {
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
            .from("transactions")
            .update({
                ...value
            })
            .eq("id", id)
            .eq("user_id", req.user.id)
            .select()
            .single();

        if (error) throw error;

        /* Return both versions so the client can describe the change. */
        return res.json({
            success: true,
            message: "Transaction updated successfully.",
            transaction: data,
            previous: existing,
            changes: Object.keys(value).filter(
                key => String(existing[key]) !== String(value[key])
            )
        });
    } catch (err) {
        return next(err);
    }
});

/* ==========================================================
                    DELETE TRANSACTION
========================================================== */

router.delete("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from("transactions")
            .delete()
            .eq("id", id)
            .eq("user_id", req.user.id)
            .select()
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found."
            });
        }

        return res.json({
            success: true,
            message: "Transaction deleted successfully.",
            transaction: data
        });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;