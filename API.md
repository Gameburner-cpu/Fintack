# FinTack API Reference (v2.0)

Base URL: `https://fintack.onrender.com` (override locally with
`localStorage.setItem("fintack_api_base", "http://localhost:5000")`).

All responses are JSON and always include a `success` boolean.
Errors also include a human-readable `message`.

## Authentication

Every route under `/api/*` (except `POST /api/ai/ask`, where auth is optional)
requires a bearer token:

```
Authorization: Bearer <jwt>
```

Tokens are issued by `/auth/login` and `/auth/signup` and expire after 7 days
(`JWT_EXPIRES_IN`). An expired token returns `401` with `code: "TOKEN_EXPIRED"`;
the frontend listens for this and prompts a re-login.

**Ownership is enforced server-side.** A token for user A cannot read or mutate
user B's records, regardless of the ids in the URL or body.

---

## Auth

### `POST /auth/signup`

```json
{ "full_name": "Asha Rao", "email": "asha@example.com", "password": "Str0ngPass" }
```

Password policy: 8+ characters, at least one letter and one digit.

**201**
```json
{
  "success": true,
  "message": "Account created successfully.",
  "token": "eyJ...",
  "user": { "id": "...", "full_name": "Asha Rao", "email": "asha@example.com" }
}
```

Errors: `400` invalid input · `409` email already registered.

### `POST /auth/login`

```json
{ "email": "asha@example.com", "password": "Str0ngPass" }
```

**200** — same shape as signup.
**401** — `"Incorrect email or password."` (identical for unknown email and
wrong password, so the endpoint cannot be used to enumerate accounts).

### `GET /auth/me` 🔒

Returns the current user.

### `POST /auth/change-password` 🔒

```json
{ "currentPassword": "Str0ngPass", "newPassword": "N3wStrongPass" }
```

---

## Password reset (3 steps)

### 1. `POST /auth/forgot-password`

```json
{ "email": "asha@example.com" }
```

**200** (always, whether or not the account exists)
```json
{
  "success": true,
  "message": "If an account exists for that email, a 6-digit code has been sent...",
  "expiresInMinutes": 10,
  "delivery": "console"
}
```

`delivery` appears only outside production. It is `"smtp"` when mail was sent
and `"console"` when SMTP is unconfigured and the code was printed to the
server log — useful in local development.

Rate limited to 5 requests per 15 minutes per IP + email.

### 2. `POST /auth/verify-otp`

```json
{ "email": "asha@example.com", "otp": "418203" }
```

**200**
```json
{ "success": true, "resetToken": "eyJ...", "expiresInMinutes": 15 }
```

**400** — wrong or expired code. The response reports the remaining attempts.
After `OTP_MAX_ATTEMPTS` (default 5) the code is burned and a new one is needed.

### 3. `POST /auth/reset-password`

```json
{ "resetToken": "eyJ...", "password": "N3wStrongPass", "confirmPassword": "N3wStrongPass" }
```

**200** — password updated. All outstanding reset requests for the account are
invalidated, and the reset token cannot be replayed (it is bound to the old
password hash).

**Security properties**

| Property | Implementation |
|---|---|
| OTP at rest | SHA-256 of `otp:email:JWT_SECRET`, never plaintext |
| OTP comparison | `crypto.timingSafeEqual` |
| Single use | Row marked `used` on first successful verify |
| Expiry | `OTP_TTL_MINUTES` (default 10) |
| Brute force | Per-row attempt counter + per-IP/email rate limit |
| Enumeration | Identical response for known and unknown emails |
| Replay | Reset token carries a fingerprint of the old password hash |
| Reuse | New password must differ from the current one |

---

## Transactions 🔒

### `GET /api/transactions/:userId`

Query parameters (all optional):

| Param | Example | Notes |
|---|---|---|
| `from` / `to` | `2026-08-01` | Inclusive date range |
| `type` | `expense` | `income` or `expense` |
| `category` | `Food` | Exact match |
| `search` | `coffee` | Case-insensitive title match |
| `limit` | `100` | Max 500, default 500 |
| `offset` | `0` | For pagination |

Filtering happens in Postgres, not the browser.

**200**
```json
{
  "success": true,
  "transactions": [ { "id": "...", "title": "Lunch", "amount": 500, "type": "expense",
                      "category": "Food", "date": "2026-08-15", "description": null } ],
  "pagination": { "total": 240, "limit": 500, "offset": 0, "hasMore": false }
}
```

### `GET /api/transactions/:userId/analytics`

Returns the full aggregate used by the dashboard and the chatbot:
totals for today / week / month / year / all time, savings rate, category
breakdowns, month-over-month change, daily averages, projections and a
6- and 12-month series. See `backend/utils/analytics.js`.

### `GET /api/transactions/detail/:id`

### `POST /api/transactions`

```json
{
  "user_id": "...",
  "title": "Lunch",
  "amount": 500,
  "type": "expense",
  "category": "Food",
  "date": "2026-08-15",
  "description": "optional"
}
```

Validation: amount > 0 and < 1e9 · type is `income`/`expense` · date not more
than a year in the future · title 1-120 characters.

### `PUT /api/transactions/:id`  — **new in 2.0**

Partial update. Send only the fields that changed:

```json
{ "amount": 700, "category": "Travel" }
```

**200**
```json
{
  "success": true,
  "message": "Transaction updated successfully.",
  "transaction": { "...": "new values" },
  "previous":    { "...": "old values" },
  "changes": ["amount", "category"]
}
```

### `DELETE /api/transactions/:id`  — **new in 2.0**

### `GET /api/transactions/meta/categories`

The canonical category list.

---

## Goals 🔒

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/goals/:userId` | List goals |
| `POST` | `/api/goals` | Create a goal |
| `PUT` | `/api/goals/:id` | Update title / target / deadline |
| `PUT` | `/api/goals/:id/savings` | Add a contribution (`{ "amount": 5000 }`) |
| `DELETE` | `/api/goals/:id` | Delete a goal |
| `POST` | `/api/goals/:id/investment-plan` | **New in 2.0** — AI investment plan |

### `POST /api/goals/:id/investment-plan`

Body (all optional — anything omitted is derived from the user's real
transaction history):

```json
{ "riskTolerance": "moderate", "monthlyIncome": 120000, "monthlyExpense": 70000 }
```

**200** (abridged)
```json
{
  "success": true,
  "plan": {
    "status": "active",
    "goal": { "target": 2000000, "saved": 200000, "months": 96, "progressPercent": 10 },
    "profile": {
      "riskLabel": "Growth",
      "riskScore": 4,
      "reasons": ["A 10-year-plus horizon gives equity time to ride out full market cycles."],
      "monthlySurplus": 50000,
      "savingsRate": 41.67,
      "emergencyFund": { "target": 420000, "coveragePercent": 142.86, "funded": true }
    },
    "contribution": {
      "monthlySip": 9420.15,
      "weekly": 2168.05,
      "daily": 309.7,
      "feasibility": "comfortable",
      "monthlySipWithoutGrowth": 18750
    },
    "allocation": { "equity": 65, "debt": 20, "gold": 10, "realEstate": 5 },
    "expectedReturn": { "low": 8.95, "high": 12.88, "blended": 10.92 },
    "projection": {
      "atLowReturn": 1789000,
      "atBlendedReturn": 2000000,
      "atHighReturn": 2251000,
      "totalContributed": 1104334,
      "growthComponent": 895666
    },
    "recommendations": [
      {
        "name": "Index Funds (Nifty 50 / Nifty 500)",
        "allocationPercent": 32.5,
        "monthlySip": 3061.55,
        "risk": "Medium-High",
        "expectedReturnRange": { "low": 10, "high": 14 },
        "projectedValue": { "low": 620000, "high": 810000 },
        "liquidity": "1-3 working days",
        "lockIn": "None",
        "taxNote": "LTCG above ₹1.25L per year taxed at 12.5%.",
        "reasoning": "Index funds carry the 65% equity core over a long 8-year horizon..."
      }
    ],
    "milestones": [
      { "percent": 25, "amount": 500000, "status": "on-track",
        "etaMonths": 31, "etaDate": "2029-03-15" }
    ],
    "summary": "To reach House deposit in 96 months, invest about ₹9,420 per month...",
    "disclaimer": "This is an educational projection generated from your own income..."
  }
}
```

Planning maths lives in `backend/utils/investmentEngine.js` and is fully
deterministic — no model call, so the same inputs always produce the same plan.

---

## AI assistant

### `POST /api/ai/ask` (auth optional)

```json
{
  "message": "Is an SIP better than a lump sum?",
  "history": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }]
}
```

With a valid token, the request is enriched with an **aggregate** financial
snapshot (monthly income/expenses, savings rate, top categories, goals) so the
model answers with real figures. Raw transaction rows are never sent.

**200**
```json
{
  "success": true,
  "answer": "...",
  "personalised": true,
  "sources": [{ "title": "SEBI", "url": "https://..." }],
  "searchQueries": ["sip vs lumpsum india"]
}
```

`503` if `GEMINI_API_KEY` is not configured. Rate limited to 20 requests/minute.

Most chatbot traffic never reaches this endpoint: transaction commands and
personal financial questions are resolved locally in the browser
(`js/ai/mod/transactions`, `js/ai/mod/finance`) so they are instant, work
offline and cannot hallucinate a number.

### Chat history 🔒

| Method | Path |
|---|---|
| `POST` | `/api/ai/chats` |
| `GET` | `/api/ai/chats` |
| `GET` | `/api/ai/chats/:id/messages` |
| `POST` | `/api/ai/chats/:id/messages` |
| `DELETE` | `/api/ai/chats/:id` |

All are ownership-checked. Previously any user id could read or delete any
other user's conversations.

---

## Dashboard 🔒

### `GET /api/dashboard`

Returns the authenticated user, a derived `summary`, their goals and the ten
most recent transactions. In 1.x this endpoint returned hardcoded demo figures
(`balance: 328000`, fake AAPL/MSFT quotes) for every user.

---

## Other

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Service banner |
| `GET` | `/health` | Uptime, database, mail and AI configuration status |
| `GET` | `/api/docs` | Machine-readable route index |
| `*` | `/api/trips/*` | Trip splitting (unchanged) |
| `*` | `/api/news/*` | Finnhub market news (unchanged) |

---

## Rate limits

| Scope | Limit |
|---|---|
| Global | 240 requests / minute / IP |
| `POST /auth/login` | 30 / 15 min |
| `POST /auth/signup` | 20 / 15 min |
| `POST /auth/forgot-password` | 5 / 15 min |
| `POST /auth/verify-otp` | 15 / 15 min |
| `POST /api/ai/ask` | 20 / minute |

Responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset` and, on `429`, `Retry-After`.

---

## Error shape

```json
{ "success": false, "message": "Amount must be greater than zero." }
```

| Status | Meaning |
|---|---|
| 400 | Validation failure — `message` is safe to show the user |
| 401 | Missing, invalid or expired token |
| 403 | Authenticated, but the resource belongs to someone else |
| 404 | Not found |
| 409 | Conflict (duplicate email) |
| 429 | Rate limited |
| 500 | Server error — details are logged, never returned in production |

Postgres error codes are translated to plain language; raw driver messages are
no longer echoed to clients.
