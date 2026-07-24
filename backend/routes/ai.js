const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");
/* =====================================================
                CREATE NEW CHAT
===================================================== */
router.post("/chats", async (req, res) => {
    try {
        const {
            user_id,
            title
        } = req.body;
        const { data, error } = await supabase
            .from("ai_chats")
            .insert([
                {
                    user_id,
                    title: title || "New Chat"
                }
            ])
            .select()
            .single();
        if (error) throw error;
        res.json({
            success: true,
            chat: data
        });
    }

    catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


/* =====================================================
                GET ALL CHATS
===================================================== */

router.get("/chats", async (req, res) => {
    try {
        const { user_id } = req.query;
        const { data, error } = await supabase
            .from("ai_chats")
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", {
                ascending: false
            });

        if (error) throw error;
        res.json({
            success: true,
            chats: data
        });
    }
    catch (err) {

        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =====================================================
                LOAD CHAT
===================================================== */

router.get("/chats/:id/messages", async (req, res) => {
    try {
        const chatId = req.params.id;
        const { data, error } = await supabase
            .from("ai_messages")
            .select("*")
            .eq("chat_id", chatId)
            .order("created_at");
        if (error) throw error;
        res.json({
            success: true,
            messages: data
        });
    }

    catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


/* =====================================================
                SAVE MESSAGE
===================================================== */

router.post("/chats/:id/messages", async (req, res) => {
    try {
        const chatId = req.params.id;
        const {
            role,
            message
        } = req.body;
        const { data, error } = await supabase
            .from("ai_messages")
            .insert([
                {
                    chat_id: chatId,
                    role,
                    message
                }
            ])
            .select()
            .single();
        if (error) throw error;
        await supabase
            .from("ai_chats")
            .update({
                updated_at: new Date()
            })
            .eq("id", chatId);
        res.json({
            success: true,
            message: data
        });
    }

    catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =====================================================
                DELETE CHAT
===================================================== */

router.delete("/chats/:id", async (req, res) => {
    try {
        const chatId = req.params.id;
        // Delete all messages first
        const { error: messageError } = await supabase
            .from("ai_messages")
            .delete()
            .eq("chat_id", chatId);
        if (messageError) throw messageError;

        // Delete the chat
        const { error: chatError } = await supabase
            .from("ai_chats")
            .delete()
            .eq("id", chatId);
        if (chatError) throw chatError;
        res.json({
            success: true
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});
module.exports = router;