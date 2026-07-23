const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");
const calculateSettlements = require("../utils/tripCalculator");

/* ==========================================================
                    CREATE TRIP
========================================================== */

router.post("/", async (req, res) => {

    try {

        const { user_id, trip_name } = req.body;

        const { data, error } = await supabase

            .from("trips")

            .insert([

                {
                    user_id,
                    trip_name
                }

            ])

            .select()

            .single();

        if (error) throw error;

        res.json({

            success: true,

            trip: data

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});

/* ==========================================================
                    GET ALL TRIPS
========================================================== */

router.get("/", async (req, res) => {

    try {

        const { user_id } = req.query;

        const { data, error } = await supabase

            .from("trips")

            .select("*")

            .eq("user_id", user_id)

            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json({

            success: true,

            trips: data

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});

/* ==========================================================
                    GET SINGLE TRIP
========================================================== */

router.get("/:id", async (req, res) => {

    try {

        const { id } = req.params;

        const { data, error } = await supabase

            .from("trips")

            .select("*")

            .eq("id", id)

            .single();

        if (error) throw error;

        res.json({

            success: true,

            trip: data

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});

/* ==========================================================
                    UPDATE TRIP
========================================================== */

router.put("/:id", async (req, res) => {

    try {

        const { id } = req.params;

        const { data, error } = await supabase

            .from("trips")

            .update(req.body)

            .eq("id", id)

            .select()

            .single();

        if (error) throw error;

        res.json({

            success: true,

            trip: data

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});

/* ==========================================================
                    DELETE TRIP
========================================================== */

router.delete("/:id", async (req, res) => {

    try {

        const { id } = req.params;

        const { error } = await supabase

            .from("trips")

            .delete()

            .eq("id", id);

        if (error) throw error;

        res.json({

            success: true

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});

/* ==========================================================
                    ADD MEMBER
========================================================== */

router.post("/:id/members", async (req, res) => {

    try {

        const tripId = req.params.id;
        const { member } = req.body;

        const { data, error } = await supabase

            .from("trip_members")

            .insert([

                {
                    trip_id: tripId,
                    member_name: member
                }

            ])

            .select()

            .single();

        if (error) throw error;

        res.json({

            success: true,

            member: data

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});

/* ==========================================================
                    ADD EXPENSE
========================================================== */

router.post("/:id/expenses", async (req, res) => {

    try {

        const tripId = req.params.id;

        const {
            title,
            amount,
            paid_by,
            category,
            notes
        } = req.body;

        const { data, error } = await supabase

            .from("trip_expenses")

            .insert([

                {
                    trip_id: tripId,
                    title,
                    amount,
                    paid_by,
                    category: category || "General",
                    notes: notes || null
                }

            ])

            .select()

            .single();

        if (error) throw error;

        res.json({

            success: true,

            expense: data

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});

/* ==========================================================
                GET COMPLETE TRIP
========================================================== */

router.get("/:id/details", async (req, res) => {

    try {

        const tripId = req.params.id;

        const { data: trip, error: tripError } = await supabase
            .from("trips")
            .select("*")
            .eq("id", tripId)
            .single();

        if (tripError) throw tripError;

        const { data: members, error: memberError } = await supabase
            .from("trip_members")
            .select("*")
            .eq("trip_id", tripId);

        if (memberError) throw memberError;

        const { data: expenses, error: expenseError } = await supabase
            .from("trip_expenses")
            .select("*")
            .eq("trip_id", tripId);

        if (expenseError) throw expenseError;

        res.json({

            success: true,

            trip,

            members,

            expenses

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});

/* ==========================================================
                GET SETTLEMENTS
========================================================== */

router.get("/:id/settlements", async (req, res) => {

    try {

        const tripId = req.params.id;

        const { data: members, error: memberError } = await supabase
            .from("trip_members")
            .select("*")
            .eq("trip_id", tripId);

        if (memberError) throw memberError;

        const { data: expenses, error: expenseError } = await supabase
            .from("trip_expenses")
            .select("*")
            .eq("trip_id", tripId);

        if (expenseError) throw expenseError;

        console.log("========== MEMBERS ==========");
        console.table(members);

        console.log("========== EXPENSES ==========");
        console.table(expenses);

        const result = calculateSettlements(
            members,
            expenses
        );

        console.log("========== BALANCES ==========");
        console.log(result.balances);

        console.log("========== SETTLEMENTS ==========");
        console.table(result.settlements);

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* ==========================================================
                ADD MULTIPLE MEMBERS
========================================================== */

router.post("/:id/members/bulk", async (req, res) => {

    try {

        const tripId = req.params.id;

        const { members } = req.body;

        if (!Array.isArray(members) || members.length === 0) {

            return res.status(400).json({

                success: false,

                message: "Members array is required."

            });

        }

        const records = members.map(member => ({

            trip_id: tripId,

            member_name: member

        }));

        const { data, error } = await supabase

            .from("trip_members")

            .insert(records)

            .select();

        if (error) throw error;

        res.json({

            success: true,

            members: data

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});

module.exports = router;

/* ==========================================================
                    ADD MEMBER
========================================================== */

router.post("/:id/members", async (req, res) => {

    try {

        const { id } = req.params;

        const { member } = req.body;

        const { data, error } = await supabase

            .from("trip_members")

            .insert([

                {
                    trip_id: id,
                    member_name: member
                }

            ])

            .select()

            .single();

        if (error) throw error;

        res.json({

            success: true,

            member: data

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});