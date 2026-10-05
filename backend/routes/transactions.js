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
const { encrypt, decryptRow } = require("../utils/crypto");

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

        const { data: rows, error } = await supabase
            .from("transactions")
            .select("id, user_id, encrypted_payload, title, description, amount, type, category, date, created_at, updated_at")
            .eq("user_id", userId);

        if (error) throw error;

        let data = (rows || []).map(row => decryptRow(row, [
            "title", "description", "amount", "type", "category", "date"
        ])).filter(Boolean);

        if (req.query.from) data = data.filter(item => String(item.date) >= String(req.query.from));
        if (req.query.to) data = data.filter(item => String(item.date) <= String(req.query.to));
        if (req.query.type) data = data.filter(item => String(item.type).toLowerCase() === String(req.query.type).toLowerCase());
        if (req.query.category) data = data.filter(item => String(item.category) === String(req.query.category));
        if (req.query.search) {
            const term = String(req.query.search).toLowerCase().trim();
            data = data.filter(item => String(item.title || "").toLowerCase().includes(term));
        }

        data.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
        const total = data.length;
        data = data.slice(offset, offset + limit);
        return res.json({
            success: true,
            transactions: data || [],
            pagination: {
                total,
                limit,
                offset,
                hasMore: total > offset + data.length
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

        const { data: rows, error } = await supabase
            .from("transactions")
            .select("id, user_id, encrypted_payload, title, description, amount, type, category, date, created_at, updated_at")
            .eq("user_id", userId)
            .limit(10000);

        if (error) throw error;

        const data = (rows || []).map(row => decryptRow(row, [
            "title", "description", "amount", "type", "category", "date"
        ])).filter(Boolean);

        return res.json({
            success: true,
            summary: buildSummary(data)
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
                encrypted_payload: encrypt(value)
            })
            .select("id, user_id, encrypted_payload, created_at, updated_at")
            .single();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: "Transaction added successfully.",
            transaction: decryptRow(data)
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
            .select("id, user_id, encrypted_payload, title, description, amount, type, category, date, created_at, updated_at")
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
            transaction: decryptRow(data, ["title", "description", "amount", "type", "category", "date"])
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
            .select("id, user_id, encrypted_payload, title, description, amount, type, category, date, created_at, updated_at")
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

        const existingValue = decryptRow(existing, ["title", "description", "amount", "type", "category", "date"]);

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
                encrypted_payload: encrypt({
                    ...existingValue,
                    ...value
                })
            })
            .eq("id", id)
            .eq("user_id", req.user.id)
            .select("id, user_id, encrypted_payload, created_at, updated_at")
            .single();

        if (error) throw error;

        const updatedValue = decryptRow(data);

        /* Return both versions so the client can describe the change. */
        return res.json({
            success: true,
            message: "Transaction updated successfully.",
            transaction: updatedValue,
            previous: existingValue,
            changes: Object.keys(value).filter(
                key => String(existingValue[key]) !== String(value[key])
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
            .select("id, user_id, encrypted_payload, created_at, updated_at")
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
            transaction: decryptRow(data)
        });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;