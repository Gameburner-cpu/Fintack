/* ==========================================================================
   supabase.js
<<<<<<< HEAD
   Single shared server-side Supabase client.

   IMPORTANT: FinTack performs all database access through the trusted Node
   backend. Prefer the Supabase service-role key here so database RLS remains
   enabled for direct/untrusted clients while authenticated backend routes can
   perform their own ownership checks. The service-role key must NEVER be sent
   to the browser.
=======
   Single shared Supabase client.
>>>>>>> 5165393826f0ab820d5c6d0da355e0700cc144b8
========================================================================== */

const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

<<<<<<< HEAD
const serverKey = env.SUPABASE_SERVICE_ROLE || env.SUPABASE_KEY;

const supabase = createClient(
    env.SUPABASE_URL || "http://localhost:54321",
    serverKey || "missing-key",
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        },
        global: {
            headers: {
                "X-Client-Info": "fintack-backend/2.0.1"
            }
=======
const supabase = createClient(
    env.SUPABASE_URL || "http://localhost:54321",
    env.SUPABASE_KEY || "missing-key",
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
>>>>>>> 5165393826f0ab820d5c6d0da355e0700cc144b8
        }
    }
);

module.exports = supabase;
