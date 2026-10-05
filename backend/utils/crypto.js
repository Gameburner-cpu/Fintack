/* ========================================================================
   FinTack application-level encryption.

   Financial/user content is encrypted before it reaches Supabase. The
   encryption key NEVER lives in the browser or in the database.
   AES-256-GCM provides confidentiality + tamper detection.
========================================================================= */

const crypto = require("crypto");
const env = require("../config/env");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = "v1";

function getKey() {
    const raw = env.DATA_ENCRYPTION_KEY || "";

    if (!raw) {
        if (env.isProduction) {
            throw new Error("DATA_ENCRYPTION_KEY is required in production.");
        }
        // Development fallback is deterministic only to keep local setup easy.
        return crypto.createHash("sha256").update(env.JWT_SECRET).digest();
    }

    if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");

    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;

    throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes as 64 hex characters or base64.");
}

function encrypt(value) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const plaintext = Buffer.from(JSON.stringify(value), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
        VERSION,
        iv.toString("base64url"),
        tag.toString("base64url"),
        ciphertext.toString("base64url")
    ].join(".");
}

function decrypt(token) {
    if (!token || typeof token !== "string") return null;

    const [version, ivPart, tagPart, cipherPart] = token.split(".");
    if (version !== VERSION || !ivPart || !tagPart || !cipherPart) {
        throw new Error("Invalid encrypted payload.");
    }

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        getKey(),
        Buffer.from(ivPart, "base64url")
    );

    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(cipherPart, "base64url")),
        decipher.final()
    ]);

    return JSON.parse(plaintext.toString("utf8"));
}

function encryptFields(fields) {
    return encrypt(fields);
}

function decryptRow(row, legacyFields = []) {
    if (!row) return null;

    if (row.encrypted_payload) {
        return {
            id: row.id,
            user_id: row.user_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            ...decrypt(row.encrypted_payload)
        };
    }

    // Allows a zero-downtime rollout while the migration script is running.
    const fallback = { id: row.id, user_id: row.user_id };
    for (const field of legacyFields) {
        if (row[field] !== undefined) fallback[field] = row[field];
    }
    if (row.created_at) fallback.created_at = row.created_at;
    if (row.updated_at) fallback.updated_at = row.updated_at;
    return fallback;
}

module.exports = {
    encrypt,
    decrypt,
    encryptFields,
    decryptRow
};
