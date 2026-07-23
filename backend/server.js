require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const supabase = require("./config/supabase");
const tripRoutes = require("./routes/trips");
const aiRoutes = require("./routes/ai");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/trips", tripRoutes);
app.use("/api/ai", aiRoutes);

/* ======================================================
                    HOME
====================================================== */

app.get("/", (req, res) => {
    res.json({
        status: "FinTack Backend Running 🚀"
    });
});

/* ======================================================
                    DATABASE TEST
====================================================== */

app.get("/test-db", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("users")
            .select("*");

        if (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* ======================================================
                    SIGNUP
====================================================== */

app.post("/signup", async (req, res) => {
    try {
        const {
            full_name,
            email,
            password
        } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const { data: existing } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single();

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from("users")
            .insert({
                full_name,
                email,
                password: hashedPassword
            })
            .select()
            .single();

        if (error) throw error;

        const token = jwt.sign(
            {
                id: data.id,
                email: data.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.json({
            success: true,
            message: "Account created successfully.",
            token,
            user: data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* ======================================================
                    LOGIN
====================================================== */

app.post("/login", async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const {
            data,
            error
        } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single();

        if (error || !data) {
            return res.status(401).json({
                success: false,
                message: "User not found."
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            data.password
        );

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "Incorrect password."
            });
        }

        const token = jwt.sign(
            {
                id: data.id,
                email: data.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.json({
            success: true,
            message: "Login successful.",
            token,
            user: data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* ======================================================
                    DASHBOARD API
====================================================== */

app.get("/api/dashboard", async (req, res) => {
    try {
        const { data: user } = await supabase
            .from("users")
            .select("id, full_name, email")
            .limit(1)
            .single();

        res.json({
            success: true,
            user,
            summary: {
                balance: 328000,
                netWorth: 452000,
                monthlySavings: 25000,
                income: 37000,
                expenses: 12450
            },
            stocks: [
                {
                    ticker: "AAPL",
                    price: "$189.43",
                    change: "+1.24%",
                    isPositive: true,
                    description: "Tech giant unveils new AI-driven silicon chips."
                },
                {
                    ticker: "MSFT",
                    price: "$412.15",
                    change: "+0.85%",
                    isPositive: true,
                    description: "Cloud revenue beats analyst expectations."
                },
                {
                    ticker: "TSLA",
                    price: "$175.22",
                    change: "-2.10%",
                    isPositive: false,
                    description: "Production delays affect deliveries."
                }
            ],
            news: [
                {
                    category: "Market Analysis",
                    icon: "fa-solid fa-arrow-trend-up",
                    title: "GLOBAL EQUITIES RALLY",
                    excerpt: "Markets gained after inflation data cooled.",
                    time: "10:30 AM"
                },
                {
                    category: "AI Summary",
                    icon: "fa-solid fa-microchip",
                    title: "AI STOCKS CONTINUE TO CLIMB",
                    excerpt: "Technology sector remains the strongest performer.",
                    time: "09:15 AM"
                }
            ]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* ======================================================
                ADD TRANSACTION
====================================================== */

app.post("/api/transactions", async (req, res) => {
    try {
        const {
            user_id,
            title,
            amount,
            type,
            category,
            date
        } = req.body;

        if (
            !user_id ||
            !title ||
            !amount ||
            !type ||
            !category
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const { data, error } = await supabase
            .from("transactions")
            .insert({
                user_id,
                title,
                amount,
                type,
                category,
                date: date || new Date()
            })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: "Transaction added successfully.",
            transaction: data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* ======================================================
                GET TRANSACTIONS
====================================================== */

app.get("/api/transactions/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", userId)
            .order("date", { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            transactions: data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* ======================================================
                    CREATE GOAL
====================================================== */

app.post("/api/goals", async (req, res) => {
    try {
        const {
            user_id,
            title,
            target_amount,
            saved_amount,
            deadline
        } = req.body;

        if (
            !user_id ||
            !title ||
            !target_amount ||
            !deadline
        ) {
            return res.status(400).json({
                success: false,
                error: "All fields are required."
            });
        }

        const { data, error } = await supabase
            .from("goals")
            .insert([{
                user_id,
                title,
                target_amount,
                saved_amount,
                deadline
            }])
            .select();

        if (error) throw error;

        res.json({
            success: true,
            goal: data[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* ======================================================
                    GET GOALS
====================================================== */

app.get("/api/goals/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from("goals")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            goals: data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* ======================================================
                    UPDATE GOAL
====================================================== */

app.put("/api/goals/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            target_amount,
            saved_amount,
            deadline
        } = req.body;

        const { data, error } = await supabase
            .from("goals")
            .update({
                title,
                target_amount,
                saved_amount,
                deadline
            })
            .eq("id", id)
            .select();

        if (error) throw error;

        res.json({
            success: true,
            goal: data[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* ============================================
            UPDATE GOAL SAVINGS
============================================ */

app.put("/api/goals/:id/savings", async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;

        const { data: goal, error: fetchError } = await supabase
            .from("goals")
            .select("saved_amount")
            .eq("id", id)
            .single();

        if (fetchError) throw fetchError;

        const newAmount =
            Number(goal.saved_amount) + Number(amount);

        const { error } = await supabase
            .from("goals")
            .update({
                saved_amount: newAmount
            })
            .eq("id", id);

        if (error) throw error;

        res.json({
            success: true,
            saved_amount: newAmount
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* ======================================================
                DELETE GOAL
====================================================== */

app.delete("/api/goals/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from("goals")
            .delete()
            .eq("id", id);

        if (error) throw error;

        res.json({
            success: true
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* ======================================================
                    START SERVER
====================================================== */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});