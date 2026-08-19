/* ==========================================================================
   supabase.js
   Single shared Supabase client.
========================================================================== */

const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

const supabase = createClient(
    env.SUPABASE_URL || "http://localhost:54321",
    env.SUPABASE_KEY || "missing-key",
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

module.exports = supabase;
