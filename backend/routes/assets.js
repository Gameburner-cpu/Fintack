/* ========================================================================
   assets.js
   CRUD for personal assets. Asset details are encrypted server-side before
   they are written to Supabase.
========================================================================= */

const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");
const { encrypt, decryptRow } = require("../utils/crypto");
const { sanitizeText } = require("../utils/validators");

router.use(requireAuth);

const TYPES = ["Land", "Bank FD", "Gold", "Real Estate", "Stocks", "Mutual Fund", "Vehicle", "Other"];

function validateAsset(input = {}) {
    const type = sanitizeText(input.type, 40);
    const name = sanitizeText(input.name, 120);
    const value = Number(input.value);
    const quantity = input.quantity === undefined || input.quantity === "" ? null : Number(input.quantity);
    const notes = sanitizeText(input.notes, 500);

    if (!TYPES.includes(type)) return { error: "Choose a valid asset type." };
    if (!name) return { error: "Asset name is required." };
    if (!Number.isFinite(value) || value <= 0) return { error: "Current value must be greater than zero." };
    if (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0)) return { error: "Quantity must be greater than zero." };

    return {
        value: {
            type,
            name,
            value: Math.round(value * 100) / 100,
            quantity,
            notes
        }
    };
}

router.get("/meta/types", (req, res) => res.json({ success: true, types: TYPES }));

router.get("/:userId", async (req, res, next) => {
    try {
        if (String(req.params.userId) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: "You do not have access to these assets." });
        }

        const { data: rows, error } = await supabase
            .from("assets")
            .select("id, user_id, encrypted_payload, created_at, updated_at")
            .eq("user_id", req.user.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        const assets = (rows || []).map(row => decryptRow(row)).filter(Boolean);
        return res.json({ success: true, assets });
    } catch (err) {
        return next(err);
    }
});

router.post("/", async (req, res, next) => {
    try {
        const result = validateAsset(req.body);
        if (result.error) return res.status(400).json({ success: false, message: result.error });

        const { data, error } = await supabase
            .from("assets")
            .insert({ user_id: req.user.id, encrypted_payload: encrypt(result.value) })
            .select("id, user_id, encrypted_payload, created_at, updated_at")
            .single();

        if (error) throw error;
        return res.status(201).json({ success: true, message: "Asset added successfully.", asset: decryptRow(data) });
    } catch (err) {
        return next(err);
    }
});

router.put("/:id", async (req, res, next) => {
    try {
        const { data: row, error: fetchError } = await supabase
            .from("assets")
            .select("id, user_id, encrypted_payload, created_at, updated_at")
            .eq("id", req.params.id)
            .eq("user_id", req.user.id)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!row) return res.status(404).json({ success: false, message: "Asset not found." });

        const current = decryptRow(row);
        const mergedInput = { ...current, ...req.body };
        const result = validateAsset(mergedInput);
        if (result.error) return res.status(400).json({ success: false, message: result.error });

        const { data, error } = await supabase
            .from("assets")
            .update({ encrypted_payload: encrypt(result.value) })
            .eq("id", row.id)
            .eq("user_id", req.user.id)
            .select("id, user_id, encrypted_payload, created_at, updated_at")
            .single();

        if (error) throw error;
        return res.json({ success: true, message: "Asset updated successfully.", asset: decryptRow(data) });
    } catch (err) {
        return next(err);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from("assets")
            .delete()
            .eq("id", req.params.id)
            .eq("user_id", req.user.id)
            .select("id, user_id, encrypted_payload, created_at, updated_at")
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, message: "Asset not found." });

        return res.json({ success: true, message: "Asset deleted.", asset: decryptRow(data) });
    } catch (err) {
        return next(err);
    }
});

module.exports = { router, TYPES };
