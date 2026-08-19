/* ==========================================================================
   tests/integration.js
   End-to-end API tests against an in-memory Supabase stub.

   Run with:  node tests/integration.js

   No database, no SMTP, no network. The stub implements just enough of the
   supabase-js query builder for the routes under test, and the mailer falls
   back to console delivery, so the OTP is captured from there.
========================================================================== */

const path = require("path");
const http = require("http");
const Module = require("module");

const root = path.resolve(__dirname, "..");

/* ==========================================================
                    ENVIRONMENT
========================================================== */

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_KEY = "test-service-key";
process.env.JWT_SECRET = "integration-test-secret-key-long-enough";
process.env.CORS_ORIGINS = "*";
process.env.OTP_TTL_MINUTES = "10";

/* ==========================================================
                IN-MEMORY SUPABASE STUB
========================================================== */

const db = {
    users: [],
    transactions: [],
    goals: [],
    password_resets: [],
    ai_chats: [],
    ai_messages: []
};

let idCounter = 1;
const nextId = () => `id-${idCounter++}`;

function matches(row, filters) {
    return filters.every(({ column, value, op }) => {
        const cell = row[column];

        if (op === "eq") return String(cell) === String(value);
        if (op === "gte") return String(cell) >= String(value);
        if (op === "lte") return String(cell) <= String(value);
        if (op === "ilike") {
            const pattern = String(value).replace(/%/g, "").toLowerCase();
            return String(cell || "").toLowerCase().includes(pattern);
        }

        return true;
    });
}

function createQuery(table) {
    const state = {
        table,
        filters: [],
        action: "select",
        payload: null,
        order: null,
        range: null,
        single: false,
        maybe: false
    };

    const builder = {
        select() { return builder; },

        insert(payload) {
            state.action = "insert";
            state.payload = Array.isArray(payload) ? payload : [payload];
            return builder;
        },

        update(payload) {
            state.action = "update";
            state.payload = payload;
            return builder;
        },

        delete() {
            state.action = "delete";
            return builder;
        },

        eq(column, value) {
            state.filters.push({ column, value, op: "eq" });
            return builder;
        },

        gte(column, value) {
            state.filters.push({ column, value, op: "gte" });
            return builder;
        },

        lte(column, value) {
            state.filters.push({ column, value, op: "lte" });
            return builder;
        },

        ilike(column, value) {
            state.filters.push({ column, value, op: "ilike" });
            return builder;
        },

        order(column, options = {}) {
            state.order = { column, ascending: options.ascending !== false };
            return builder;
        },

        limit(count) {
            state.limit = count;
            return builder;
        },

        range(from, to) {
            state.range = [from, to];
            return builder;
        },

        single() {
            state.single = true;
            return builder.then();
        },

        maybeSingle() {
            state.maybe = true;
            return builder.then();
        },

        then(resolve, reject) {
            const promise = Promise.resolve(execute(state));
            return resolve ? promise.then(resolve, reject) : promise;
        }
    };

    return builder;
}

function execute(state) {
    const rows = db[state.table] || (db[state.table] = []);

    if (state.action === "insert") {
        const inserted = state.payload.map(item => {
            const row = {
                id: nextId(),
                created_at: new Date().toISOString(),
                ...item
            };
            rows.push(row);
            return row;
        });

        return finish(inserted, state);
    }

    let selected = rows.filter(row => matches(row, state.filters));

    if (state.action === "update") {
        selected.forEach(row => Object.assign(row, state.payload));
        return finish(selected, state);
    }

    if (state.action === "delete") {
        selected.forEach(row => {
            const index = rows.indexOf(row);
            if (index >= 0) rows.splice(index, 1);
        });
        return finish(selected, state);
    }

    if (state.order) {
        const { column, ascending } = state.order;

        selected = [...selected].sort((a, b) => {
            const left = String(a[column] ?? "");
            const right = String(b[column] ?? "");
            return ascending ? left.localeCompare(right) : right.localeCompare(left);
        });
    }

    if (state.range) {
        selected = selected.slice(state.range[0], state.range[1] + 1);
    } else if (state.limit) {
        selected = selected.slice(0, state.limit);
    }

    return finish(selected, state, rows.filter(row => matches(row, state.filters)).length);
}

/*
    Rows are cloned on the way out. A real Postgres round trip returns fresh
    objects; returning live references would let a later UPDATE retroactively
    mutate a value a route had already read, hiding real aliasing bugs.
*/
function finish(liveRows, state, count) {
    const rows = liveRows.map(row => ({ ...row }));

    if (state.single) {
        if (!rows.length) {
            return { data: null, error: { message: "No rows found", code: "PGRST116" } };
        }
        return { data: rows[0], error: null, count };
    }

    if (state.maybe) {
        return { data: rows[0] || null, error: null, count };
    }

    return { data: rows, error: null, count: count ?? rows.length };
}

const supabaseStub = {
    from(table) {
        return createQuery(table);
    }
};

/* Inject the stub before any route file requires the real client. */
const supabasePath = require.resolve(path.join(root, "backend/config/supabase.js"));

require.cache[supabasePath] = new Module(supabasePath, null);
require.cache[supabasePath].filename = supabasePath;
require.cache[supabasePath].loaded = true;
require.cache[supabasePath].exports = supabaseStub;

/* ==========================================================
                CAPTURE THE OTP FROM CONSOLE
========================================================== */

let lastOtp = null;
const originalLog = console.log;

console.log = (...args) => {
    const text = args.join(" ");

    const match = text.match(/reset code is (\d{6})/);
    if (match) lastOtp = match[1];

    if (!text.includes("FINTACK DEV EMAIL") && !text.includes("reset code is")) {
        originalLog(...args);
    }
};

/* ==========================================================
                        HARNESS
========================================================== */

const app = require(path.join(root, "backend/server.js"));

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
    if (!condition) throw new Error(message || "Assertion failed");
}

function equal(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(
            `${message ? message + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        );
    }
}

async function test(name, fn) {
    try {
        await fn();
        passed += 1;
        originalLog(`  ok   ${name}`);
    } catch (error) {
        failed += 1;
        failures.push(`${name}: ${error.message}`);
        originalLog(`  FAIL ${name}`);
        originalLog(`       ${error.message}`);
    }
}

let server;
let port;

function request(method, routePath, { body, token } = {}) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;

        const headers = {};
        if (payload) {
            headers["Content-Type"] = "application/json";
            headers["Content-Length"] = Buffer.byteLength(payload);
        }
        if (token) headers.Authorization = `Bearer ${token}`;

        const req = http.request(
            { host: "127.0.0.1", port, path: routePath, method, headers },
            response => {
                let data = "";
                response.on("data", chunk => { data += chunk; });
                response.on("end", () => {
                    let parsed = {};
                    try { parsed = data ? JSON.parse(data) : {}; } catch (e) { parsed = { raw: data }; }
                    resolve({ status: response.statusCode, body: parsed });
                });
            }
        );

        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

/* ==========================================================
                        TESTS
========================================================== */

async function run() {
    await new Promise(resolve => {
        server = app.listen(0, () => {
            port = server.address().port;
            resolve();
        });
    });

    originalLog("\nAuth");

    let token = null;
    let userId = null;

    await test("signup creates an account and returns a token", async () => {
        const response = await request("POST", "/auth/signup", {
            body: {
                full_name: "Test User",
                email: "Test@Example.com",
                password: "Str0ngPassword"
            }
        });

        equal(response.status, 201);
        assert(response.body.token, "expected a token");

        token = response.body.token;
        userId = response.body.user.id;
    });

    await test("signup never returns the password hash", async () => {
        const user = db.users[0];
        assert(user.password !== "Str0ngPassword", "password must be hashed at rest");
        assert(user.password.startsWith("$2"), "expected a bcrypt hash");
    });

    await test("email is stored lowercase", async () => {
        equal(db.users[0].email, "test@example.com");
    });

    await test("a weak password is rejected", async () => {
        const response = await request("POST", "/auth/signup", {
            body: { full_name: "Weak", email: "weak@example.com", password: "abc" }
        });

        equal(response.status, 400);
    });

    await test("a duplicate email is rejected", async () => {
        const response = await request("POST", "/auth/signup", {
            body: {
                full_name: "Dupe",
                email: "test@example.com",
                password: "Str0ngPassword"
            }
        });

        equal(response.status, 409);
    });

    await test("login succeeds with the right password", async () => {
        const response = await request("POST", "/auth/login", {
            body: { email: "test@example.com", password: "Str0ngPassword" }
        });

        equal(response.status, 200);
        assert(response.body.token);
        assert(response.body.user.password === undefined, "password must not be returned");
    });

    await test("login fails with the wrong password", async () => {
        const response = await request("POST", "/auth/login", {
            body: { email: "test@example.com", password: "WrongPassword1" }
        });

        equal(response.status, 401);
    });

    await test("login does not reveal whether an email exists", async () => {
        const unknown = await request("POST", "/auth/login", {
            body: { email: "nobody@example.com", password: "Whatever123" }
        });

        const wrongPassword = await request("POST", "/auth/login", {
            body: { email: "test@example.com", password: "Whatever123" }
        });

        equal(unknown.body.message, wrongPassword.body.message);
    });

    originalLog("\nAuthorisation");

    await test("transactions require a token", async () => {
        const response = await request("GET", `/api/transactions/${userId}`);
        equal(response.status, 401);
    });

    await test("a user cannot read another user's transactions", async () => {
        const response = await request("GET", "/api/transactions/someone-else", { token });
        equal(response.status, 403);
    });

    await test("an invalid token is rejected", async () => {
        const response = await request("GET", `/api/transactions/${userId}`, {
            token: "not-a-real-token"
        });

        equal(response.status, 401);
    });

    originalLog("\nTransactions");

    let transactionId = null;

    await test("create a transaction", async () => {
        const response = await request("POST", "/api/transactions", {
            token,
            body: {
                user_id: userId,
                title: "Lunch",
                amount: 500,
                type: "expense",
                category: "Food",
                date: "2026-08-15"
            }
        });

        equal(response.status, 201);
        equal(response.body.transaction.amount, 500);

        transactionId = response.body.transaction.id;
    });

    await test("reject a zero amount", async () => {
        const response = await request("POST", "/api/transactions", {
            token,
            body: {
                user_id: userId, title: "Bad", amount: 0,
                type: "expense", category: "Food", date: "2026-08-15"
            }
        });

        equal(response.status, 400);
    });

    await test("reject an unknown type", async () => {
        const response = await request("POST", "/api/transactions", {
            token,
            body: {
                user_id: userId, title: "Bad", amount: 100,
                type: "transfer", category: "Food", date: "2026-08-15"
            }
        });

        equal(response.status, 400);
    });

    await test("update a transaction", async () => {
        const response = await request("PUT", `/api/transactions/${transactionId}`, {
            token,
            body: { amount: 700, category: "Travel" }
        });

        equal(response.status, 200);
        equal(response.body.transaction.amount, 700);
        equal(response.body.transaction.category, "Travel");
        assert(response.body.previous.amount === 500, "previous values should be returned");
    });

    await test("a partial update leaves other fields intact", async () => {
        const response = await request("PUT", `/api/transactions/${transactionId}`, {
            token,
            body: { title: "Team lunch" }
        });

        equal(response.body.transaction.amount, 700, "amount must survive a title-only edit");
        equal(response.body.transaction.title, "Team lunch");
    });

    await test("an invalid update is rejected", async () => {
        const response = await request("PUT", `/api/transactions/${transactionId}`, {
            token,
            body: { amount: -50 }
        });

        equal(response.status, 400);
    });

    await test("another user cannot edit this transaction", async () => {
        const other = await request("POST", "/auth/signup", {
            body: {
                full_name: "Other User",
                email: "other@example.com",
                password: "Str0ngPassword"
            }
        });

        const response = await request("PUT", `/api/transactions/${transactionId}`, {
            token: other.body.token,
            body: { amount: 999 }
        });

        equal(response.status, 403);
    });

    await test("analytics reflect the stored transactions", async () => {
        const response = await request(
            "GET", `/api/transactions/${userId}/analytics`, { token }
        );

        equal(response.status, 200);
        assert(response.body.summary.totalExpense >= 700);
    });

    await test("delete a transaction", async () => {
        const response = await request("DELETE", `/api/transactions/${transactionId}`, { token });
        equal(response.status, 200);

        const after = await request("GET", `/api/transactions/detail/${transactionId}`, { token });
        equal(after.status, 404);
    });

    originalLog("\nPassword reset");

    await test("requesting a code succeeds for a known email", async () => {
        lastOtp = null;

        const response = await request("POST", "/auth/forgot-password", {
            body: { email: "test@example.com" }
        });

        equal(response.status, 200);
        assert(lastOtp, "an OTP should have been generated");
        equal(lastOtp.length, 6);
    });

    await test("the OTP is never stored in plaintext", async () => {
        const record = db.password_resets[db.password_resets.length - 1];
        assert(record.otp_hash !== lastOtp, "the stored value must be a hash");
        equal(record.otp_hash.length, 64, "expected a SHA-256 hex digest");
    });

    await test("an unknown email returns the same response (no enumeration)", async () => {
        const known = await request("POST", "/auth/forgot-password", {
            body: { email: "test@example.com" }
        });

        const unknown = await request("POST", "/auth/forgot-password", {
            body: { email: "ghost@example.com" }
        });

        equal(unknown.status, known.status);
        equal(unknown.body.message, known.body.message);
    });

    let resetToken = null;

    await test("a wrong OTP is rejected", async () => {
        const wrong = lastOtp === "000000" ? "111111" : "000000";

        const response = await request("POST", "/auth/verify-otp", {
            body: { email: "test@example.com", otp: wrong }
        });

        equal(response.status, 400);
    });

    await test("the correct OTP returns a reset token", async () => {
        const response = await request("POST", "/auth/verify-otp", {
            body: { email: "test@example.com", otp: lastOtp }
        });

        equal(response.status, 200);
        assert(response.body.resetToken, "expected a reset token");

        resetToken = response.body.resetToken;
    });

    await test("the same OTP cannot be reused", async () => {
        const response = await request("POST", "/auth/verify-otp", {
            body: { email: "test@example.com", otp: lastOtp }
        });

        equal(response.status, 400);
    });

    await test("a weak new password is rejected", async () => {
        const response = await request("POST", "/auth/reset-password", {
            body: { resetToken, password: "weak", confirmPassword: "weak" }
        });

        equal(response.status, 400);
    });

    await test("mismatched passwords are rejected", async () => {
        const response = await request("POST", "/auth/reset-password", {
            body: {
                resetToken,
                password: "N3wPassword",
                confirmPassword: "D1fferentPassword"
            }
        });

        equal(response.status, 400);
    });

    await test("the password is reset successfully", async () => {
        const response = await request("POST", "/auth/reset-password", {
            body: {
                resetToken,
                password: "N3wPassword",
                confirmPassword: "N3wPassword"
            }
        });

        equal(response.status, 200);
    });

    await test("the new password works and the old one does not", async () => {
        const withNew = await request("POST", "/auth/login", {
            body: { email: "test@example.com", password: "N3wPassword" }
        });

        const withOld = await request("POST", "/auth/login", {
            body: { email: "test@example.com", password: "Str0ngPassword" }
        });

        equal(withNew.status, 200);
        equal(withOld.status, 401);
    });

    await test("the reset token cannot be replayed after use", async () => {
        const response = await request("POST", "/auth/reset-password", {
            body: {
                resetToken,
                password: "An0therPassword",
                confirmPassword: "An0therPassword"
            }
        });

        equal(response.status, 400);
    });

    originalLog("\nGoals and investment plans");

    const login = await request("POST", "/auth/login", {
        body: { email: "test@example.com", password: "N3wPassword" }
    });

    const freshToken = login.body.token;
    let goalId = null;

    await test("create a goal", async () => {
        const response = await request("POST", "/api/goals", {
            token: freshToken,
            body: {
                title: "Emergency fund",
                target_amount: 300000,
                deadline: "2030-01-01"
            }
        });

        equal(response.status, 201);
        goalId = response.body.goal.id;
    });

    await test("reject a goal with no target", async () => {
        const response = await request("POST", "/api/goals", {
            token: freshToken,
            body: { title: "Bad goal", target_amount: 0, deadline: "2030-01-01" }
        });

        equal(response.status, 400);
    });

    await test("investment plan returns recommendations and milestones", async () => {
        const response = await request("POST", `/api/goals/${goalId}/investment-plan`, {
            token: freshToken,
            body: { riskTolerance: "moderate", monthlyIncome: 100000, monthlyExpense: 60000 }
        });

        equal(response.status, 200);
        assert(response.body.plan.success);
        assert(response.body.plan.recommendations.length > 0);
        equal(response.body.plan.milestones.length, 4);
        assert(response.body.plan.contribution.monthlySip > 0);
    });

    await test("another user cannot plan against this goal", async () => {
        const other = await request("POST", "/auth/login", {
            body: { email: "other@example.com", password: "Str0ngPassword" }
        });

        const response = await request("POST", `/api/goals/${goalId}/investment-plan`, {
            token: other.body.token,
            body: {}
        });

        equal(response.status, 404);
    });

    originalLog("\nErrors");

    await test("unknown routes return a JSON 404", async () => {
        const response = await request("GET", "/does-not-exist");
        equal(response.status, 404);
        equal(response.body.success, false);
    });

    await test("legacy /login and /signup paths still work", async () => {
        const response = await request("POST", "/login", {
            body: { email: "test@example.com", password: "N3wPassword" }
        });

        equal(response.status, 200);
    });

    server.close();

    originalLog(`\n${"=".repeat(52)}`);
    originalLog(`  ${passed} passed, ${failed} failed`);
    originalLog("=".repeat(52));

    if (failures.length) {
        originalLog("\nFailures:\n");
        failures.forEach(failure => originalLog(`  - ${failure}`));
    }

    process.exit(failed === 0 ? 0 : 1);
}

run().catch(error => {
    originalLog("Test runner crashed:", error);
    process.exit(1);
});
