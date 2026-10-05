/*
  One-time migration helper.

  1) Run backend/db/migrations.sql in Supabase.
  2) Set DATA_ENCRYPTION_KEY in backend/.env.
  3) Run from backend/: node scripts/encrypt-existing-data.js

  The script copies legacy plaintext fields into encrypted_payload and then
  clears the legacy columns. Keep DATA_ENCRYPTION_KEY backed up: losing it
  means the encrypted financial data cannot be recovered.
*/
const supabase = require("../config/supabase");
const { encrypt } = require("../utils/crypto");

async function migrateTable(table, fields, clearFields) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw error;

    for (const row of data || []) {
        const payload = row.encrypted_payload
            ? null
            : Object.fromEntries(fields.map(field => [field, row[field]]));

        const update = {};
        if (payload) update.encrypted_payload = encrypt(payload);
        for (const field of clearFields) update[field] = null;

        if (Object.keys(update).length === 0) continue;

        const { error: updateError } = await supabase
            .from(table)
            .update(update)
            .eq("id", row.id);

        if (updateError) throw updateError;
        console.log(`Secured ${table}/${row.id}`);
    }
}

(async () => {
    await migrateTable(
        "transactions",
        ["title", "description", "amount", "type", "category", "date"],
        ["title", "description", "amount", "type", "category", "date"]
    );
    await migrateTable(
        "goals",
        ["title", "target_amount", "saved_amount", "deadline", "risk_tolerance"],
        ["title", "target_amount", "saved_amount", "deadline", "risk_tolerance"]
    );
    await migrateTable("ai_chats", ["title"], ["title"]);
    await migrateTable("ai_messages", ["message"], ["message"]);

    console.log("Encryption migration complete.");
})().catch(error => {
    console.error("Encryption migration failed:", error);
    process.exitCode = 1;
});
