const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is missing from .env");
}

if (!supabaseKey) {
    throw new Error("SUPABASE_SERVICE_ROLE is missing from .env");
}

const supabase = createClient(
    supabaseUrl,
    supabaseKey
);

module.exports = supabase;