# FinTack 2.0 — Change Summary

Everything below is implemented, wired end to end (UI → API → database) and
covered by tests. **130 checks pass**: 80 unit + 37 API integration + 13 chatbot
routing.

---

## Quick start

```bash
# 1. Database
#    Fresh install:  run backend/db/schema.sql in the Supabase SQL editor
#    Existing data:  run backend/db/migrations.sql instead (idempotent)

# 2. Backend
cd backend
cp .env.example .env          # fill in SUPABASE_URL, SUPABASE_KEY, JWT_SECRET
npm install
npm start                     # http://localhost:5000

# 3. Frontend (any static server)
npx serve -l 5500 .
#    Then point the app at the local API from the browser console:
#    localStorage.setItem("fintack_api_base", "http://localhost:5000")

# 4. Tests
npm test
```

Without SMTP credentials the password-reset OTP is printed to the backend
console, so the whole flow is testable locally with zero extra setup.

---

## 1. Forgot password

Three-step flow with a 6-digit OTP, reachable from a "Forgot password?" link on
the login screen.

**Backend** — `backend/routes/auth.js`, `backend/utils/mailer.js`

| Step | Endpoint |
|---|---|
| Request a code | `POST /auth/forgot-password` |
| Verify the code | `POST /auth/verify-otp` → short-lived reset token |
| Set the password | `POST /auth/reset-password` |

Security decisions and why:

- **The OTP is stored only as a SHA-256 hash** salted with the email and
  `JWT_SECRET`. A database leak does not hand over live reset codes.
- **Comparison uses `crypto.timingSafeEqual`** so response timing does not leak
  how many leading digits were right.
- **Identical responses for known and unknown emails.** The endpoint cannot be
  used to discover which addresses have accounts.
- **Single use, time limited, attempt limited** — the row is burned on the
  first successful verify, expires after `OTP_TTL_MINUTES` (10), and dies after
  5 wrong attempts. Requesting a new code invalidates all outstanding ones.
- **The reset token is bound to the old password hash.** Once the password
  changes the fingerprint no longer matches, so a leaked or replayed token is
  inert.
- **The new password must differ from the current one**, and passes the same
  8-character/letter+digit policy as signup.
- **Rate limited** to 5 requests per 15 minutes per IP+email.
- `crypto.randomInt` generates the code, not `Math.random` (which is not
  cryptographically random).

**Frontend** — `index.html`, `js/core/app.js`, `components.css`

Stepped modal with a progress indicator, a live expiry countdown, resend,
numeric-only OTP input with `autocomplete="one-time-code"` (so iOS/Android
autofill the code from the SMS/email), inline validation and accessible
`role="alert"` messaging.

---

## 2. Edit previously added transactions

**Backend** — `backend/routes/transactions.js`

- `PUT /api/transactions/:id` — partial update of amount, category, date,
  title, description and type. Returns the new row, the previous row and the
  list of changed fields, so the UI can describe the change.
- `DELETE /api/transactions/:id`
- `GET /api/transactions/detail/:id`
- Ownership is verified before the write, so one user cannot edit another's
  records even with a valid token.
- Validation rejects zero/negative/absurd amounts, unknown types, unparseable
  dates and dates more than a year ahead.

**Frontend**

- Every transaction row now carries an edit affordance
  (`js/core/ui.js` → `renderTransactions`).
- A full edit modal with an income/expense toggle, category list that swaps
  with the type, date, optional note and a delete action
  (`index.html`, `js/core/app.js`).
- One **delegated** click listener on the list container instead of a listener
  per row — the old approach leaked handlers on every re-render.
- Saving fires `fintack:transactions-changed`; the dashboard, charts, budget
  panel and analytics cache all refresh from that single event.

---

## 3. Transaction management through the chatbot

New Brain module: `js/ai/mod/transactions/`

```
txIntent.js    detects add / edit / delete / list / confirm / cancel
txEntity.js    parses the fields out of the sentence
txDecision.js  claims the message only if it won the intent race
txManager.js   proposes, then executes after confirmation
txPending.js   holds the unconfirmed action (5-minute expiry)
txFormatter.js renders confirmation cards with Yes / Cancel chips
txStore.js     cached data access + change broadcasting
```

Understanding lives in `js/ai/utils/FinanceNLU.js` — deterministic parsing
rather than a model call, because a regex cannot invent an amount that was not
in the sentence, responds instantly, and works with no API key.

It handles:

- Amounts: `₹500`, `Rs. 1,250`, `2k`, `1.5 lakh`, `350 rupees`
- Dates: `today`, `yesterday`, `3 days ago`, `last monday`, `2 aug`,
  `02/08/2026`, ISO
- Categories: ~150 keywords across 20 categories
  (`swiggy` → Food, `uber` → Transport, `blinkit` → Groceries…)
- Type: verb-driven (`spent`/`paid` → expense, `received`/`credited` → income),
  with an explicit verb always beating a category guess
- Edits: `"Change yesterday's food expense from ₹500 to ₹700"`,
  `"make it 900"`, `"change the category to Travel"`,
  `"edit my last transaction"`

**Nothing is written until the user confirms.** The assistant replies with a
card showing exactly what it will save — including anything it had to assume
("Assumed this is an expense", "No date mentioned, using today") — plus Yes and
Cancel chips. Tapping a chip is equivalent to typing the reply. Edits show a
before → after diff. When more than one transaction matches, it asks instead of
guessing.

---

## 4. Financial queries in the chatbot

New module: `js/ai/mod/finance/`, answering from the user's real data via
`js/core/analytics.js`. No network round trip, no hallucinated figures.

Supported: today / this week / last week / this month / last month / this year /
last year / all time expenses and income · category-wise spending ·
highest spending category · month-over-month comparison · average daily spend ·
total income · total savings and savings rate · balance · budget status ·
financial health score · affordability (`"Can I afford a ₹60,000 laptop?"`).

**Context is retained.** The module remembers the last metric, period and
category, so `"How much did I spend last week?"` → `"And last month?"` →
`"What about food?"` all resolve correctly.

Answers render as cards with the headline figure, supporting rows and
category bars.

---

## 5. General finance knowledge

New module: `js/ai/mod/knowledge/` with a curated knowledge base
(`financeKB.js`) covering **18 topics**: budgeting, saving strategies,
emergency funds, SIPs, mutual funds, index funds and ETFs, direct stocks,
fixed deposits, bonds and debt, gold, real estate and REITs, tax-saving
investments, compounding, debt and loans, insurance, asset allocation,
retirement, and risk.

Each entry separates **what something is** from **what it might suit**, always
names the risk, and is written for the Indian market (SIP, ELSS, PPF, NPS, SGB,
80C, LTCG rules).

Routing:

- A curated match answers instantly and offline.
- Anything time sensitive (rates, prices, "latest", "should I buy now") goes to
  the Gemini endpoint with Google Search grounding, and cites its sources.
- Tax topics serve the curated answer *and* ask the model for anything that has
  changed recently, since slabs and limits move.
- If the model is unreachable it degrades to the closest curated topic rather
  than failing.

**The assistant no longer dead-ends.** The knowledge module registers a
confidence-1 fallback, so a message no other module claims still gets a real
answer instead of "I couldn't understand that."

---

## 6. AI goal-based investment recommendations

New engine: `backend/utils/investmentEngine.js` (deterministic, ~700 lines),
exposed at `POST /api/goals/:id/investment-plan` and through the chatbot
(`js/ai/mod/goals/`). The Goals page "Optimise" button — which previously
popped an alert claiming an engine had run while doing nothing — now generates
a real plan.

The engine analyses income, expenses, savings rate, emergency-fund coverage,
time horizon, stated risk tolerance and existing progress, then produces:

- **A risk profile** that reconciles what the user asked for with what their
  numbers support. A stated "aggressive" profile with a 9-month horizon still
  gets a capital-protection allocation, and every adjustment is explained.
- **An asset allocation** across equity / debt / gold / real estate, split into
  concrete instruments: index funds, ETFs, active equity funds, direct stocks,
  fixed deposits, debt funds and bonds, gold (SGB/ETF), REITs.
- **Per recommendation**: allocation %, monthly SIP, historical return range,
  risk band, projected value range, liquidity, lock-in, tax treatment and a
  written explanation of *why it is there*.
- **The required monthly SIP**, derived from the standard annuity-due formula
  `FV = P × [((1+i)ⁿ − 1) / i] × (1+i)`, with weekly and daily equivalents, plus
  what the same goal would cost with no growth at all (so the value of
  compounding is visible).
- **Projections** at the low, blended and high ends of the return range, split
  into contributions versus growth.
- **Milestone tracking** at 25/50/75/100% with projected dates and whether each
  lands before the deadline.
- **A feasibility verdict** against the actual monthly surplus — comfortable,
  tight or unrealistic — with the suggestion that stretching the deadline is
  usually the least painful lever.
- **Emergency fund first.** If the buffer is under six months of expenses, that
  is the first recommendation, ahead of any investment.

Every plan carries a disclaimer: educational projection from the user's own
numbers, not personalised advice; ranges are historical, not guarantees.

---

## 7. Dashboard and analytics

All aggregation moved into one place — `js/core/analytics.js` on the client,
mirrored by `backend/utils/analytics.js` — and the dashboard, budget panel,
charts, chatbot and API now all read from it. A test asserts the two
implementations agree.

**Calculation bugs fixed**

| Bug | Effect | Fix |
|---|---|---|
| Any transaction whose `type` was not exactly `"income"` counted as an expense | A null or mistyped type silently inflated spending | Rows are validated and dropped unless the type is a known value |
| `NaN` amounts and unparseable dates flowed into totals | One bad row poisoned every figure on the page | Normalisation rejects non-finite amounts, zero/negative values and invalid dates |
| Monthly chart buckets matched on month **label** | Month collisions across year boundaries, badly wrong on a 12-month view | Buckets are keyed by year+month |
| Savings-rate ring compared *this month's* savings to *all-time* income | Showed a near-zero percentage for anyone with history | Both sides now come from the same month |
| Progress bars unclamped | A windfall month overflowed the bar | Clamped to 0-100 |
| "Investments" tile showed 45% of net worth | A fabricated number presented as data | Removed from the derived summary |
| `/api/dashboard` returned hardcoded demo figures | Every user saw `₹328,000` and fake AAPL/MSFT quotes | Now derived from the authenticated user's own transactions |
| Average daily spend divided by a flat 30 | Wrong every month, worst early in the month | Divides by days actually elapsed |

**New analytics**: month-over-month change, projected full-month spend,
all-time daily average, savings rate, category percentages, a 12-month series
and named-period reports (`today`, `last_week`, `this_year`, `all_time`…).

**Performance**

- Summaries are memoised on a dataset fingerprint, so re-rendering or asking
  ten questions in a row aggregates once, not ten times.
- Server-side filtering and pagination (`from`, `to`, `type`, `category`,
  `search`, `limit`, `offset`) instead of shipping every row to the browser.
- Composite indexes on `(user_id, date desc)`, `(user_id, type, date desc)` and
  `(user_id, category)` turn the dashboard query from a sequential scan into an
  index scan.
- The transaction store collapses concurrent fetches into one request and
  caches for 60 seconds.
- One delegated DOM listener instead of one per row.

---

## 8. Security, bugs and code quality

**Security**

| Issue | Fix |
|---|---|
| **Every `/api` route was public** — any user id in the URL returned that user's data (IDOR) | JWT middleware plus ownership checks on every route |
| Login and signup returned the full user row, **including the bcrypt hash** | Responses are filtered through `publicUser()` |
| Login revealed whether an email existed ("User not found" vs "Incorrect password") | Identical message and constant work factor for both |
| No rate limiting anywhere | Per-route limiters on auth, reset and AI endpoints |
| CORS was `*` | Configurable allowlist via `CORS_ORIGINS` |
| Raw Postgres/Supabase errors echoed to clients | Central error handler translates known codes, hides the rest in production |
| Chat history endpoints trusted a client-supplied `user_id` | Ownership verified against the token |
| Transaction titles rendered with `innerHTML` | All user content HTML-escaped |
| Chat messages rendered with `innerHTML` | `textContent` for user messages; model output goes through an allow-listed markdown renderer |
| `JWT_SECRET` missing would throw at request time | Validated at boot with a clear message; refuses to start in production |
| bcrypt cost factor 10 | Raised to 12 |
| No security headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` |
| Request bodies unbounded | Capped at 256 kB |

**Bugs**

- `js/ai/ai.js` was dead code referencing globals that no longer exist
  (`TripStorage`, `formatTripCard`, `analyzePurchase`) — it would have thrown if
  ever called. Nothing imported it. Replaced with a tombstone explaining where
  the behaviour moved.
- Unreachable code after `return` in the trip summary branch.
- Goal totals were read from `goal.current_amount`, a field that does not exist
  on the goals table (the column is `saved_amount`), so goals reported ₹0 saved.
  The goal-create payload sent the same non-existent column.
- Goal savings updates could lose a concurrent contribution; the read and write
  now share an ownership-filtered path.
- The API base URL was hardcoded in eight files; centralised in
  `js/core/config.js` with a `localStorage` override for local development.
- Duplicate `bcrypt` + `bcryptjs` dependencies (the native `bcrypt` build fails
  on some hosts) and an unused `pg` dependency — both removed.
- `backend/config/supabase.js` read `SUPABASE_SERVICE_ROLE` while everything
  else assumed `SUPABASE_KEY`; both names are now accepted.
- Chat send had no Enter-key handler and no double-submit guard.
- Rich AI responses were appended twice (once as text, once as HTML).

**Quality and UX**

- `alert()` replaced with non-blocking toasts throughout.
- Inline, accessible form validation (`role="alert"`, `aria-live`) with loading
  states on every submit button.
- Session expiry is detected globally and prompts a clean re-login.
- Responsive fixes at 420px (stacked cards, full-width actions, single-column
  plan hero) and `prefers-reduced-motion` support.
- `server.js` reduced from a 550-line monolith to routing and middleware;
  handlers live in `routes/`.
- `.env.example` documents every variable; `.gitignore` now actually excludes
  `.env`.

---

## Database changes

Run **`backend/db/migrations.sql`** on an existing database (idempotent), or
`backend/db/schema.sql` for a fresh install.

- **New table `password_resets`** — `otp_hash`, `expires_at`, `attempts`,
  `used`, `verified_at`.
- **`transactions`** — added `description` and `updated_at` (+ trigger);
  `CHECK` constraints on `type` and `amount`; legacy rows normalised first.
- **`goals`** — added `risk_tolerance` and `updated_at`.
- **Indexes** — `(user_id, date desc)`, `(user_id, type, date desc)`,
  `(user_id, category)`, plus goal and chat indexes.
- **Case-insensitive unique email** on `users`.
- `updated_at` triggers on `users`, `transactions`, `goals`.

---

## Files

### Added (34)

```
backend/config/env.js                      Validated environment config
backend/middleware/auth.js                 JWT + ownership guards
backend/middleware/rateLimit.js            Dependency-free rate limiter
backend/middleware/errorHandler.js         404 + central error handling
backend/routes/auth.js                     Signup, login, password reset
backend/routes/transactions.js             Transaction CRUD + analytics
backend/routes/goals.js                    Goal CRUD + investment plans
backend/utils/analytics.js                 Server aggregation engine
backend/utils/investmentEngine.js          Goal-based investment planning
backend/utils/validators.js                Shared validation
backend/utils/mailer.js                    Nodemailer + console fallback
backend/db/schema.sql                      Full schema
backend/db/migrations.sql                  1.x -> 2.0 migration
backend/.env.example                       Documented configuration

js/core/config.js                          API origin, session, authed fetch
js/core/analytics.js                       Client aggregation engine
js/ai/utils/FinanceNLU.js                  Money/date/category/command parsing

js/ai/mod/transactions/{index,txIntent,txEntity,txDecision,
                        txManager,txFormatter,txStore,txPending}.js
js/ai/mod/finance/{index,fqIntent,fqDecision,fqManager,fqFormatter}.js
js/ai/mod/knowledge/{index,kbIntent,kbDecision,kbManager,
                     kbFormatter,financeKB}.js
js/ai/mod/goals/{index,goalIntent,goalDecision,goalManager,goalFormatter}.js

tests/run.mjs                              80 unit tests
tests/integration.cjs                      37 API integration tests
tests/chatbot.cjs                          13 assistant routing tests
API.md                                     API reference
CHANGES.md                                 This document
```

### Modified (11)

```
backend/server.js            Slimmed to wiring; auth, CORS, rate limits, real dashboard
backend/routes/ai.js         User context, better prompt, ownership checks, history
backend/config/supabase.js   Uses validated env, accepts both key names
backend/package.json         nodemailer added; bcrypt and pg removed; test script
package.json                 Real project manifest and test scripts
index.html                   Reset modal, edit modal, validation, accessibility
js/core/app.js               Auth, reset flow, edit modal, chat, toasts, sync path
js/core/api.js               Rewritten around the authed fetch client
js/core/ui.js                Escaping, edit affordance, savings-rate fix
js/ai/mod/index.js           Registers the four new modules
js/ai/mod/trip/tripIntent.js Narrowed over-broad rules that hijacked expenses
js/ai/mod/finance/fqIntent.js Self-evident intents exempt from the question guard
components.css               ~700 lines: toasts, forms, reset, cards, responsive
.gitignore                   Actually excludes .env
```

### Removed (1)

```
js/ai/ai.js                  Dead code (tombstone left explaining where it went)
```

---

## Testing

The API and chatbot suites need dependencies installed first
(`npm --prefix backend install`, and jsdom for the chatbot suite):

```bash
npm test              # 117 checks (unit + API)
npm run test:unit     # 80  - analytics, investment maths, validators, NLU, KB
npm run test:api      # 37  - auth, authorisation, CRUD, reset flow, plans
npm run test:chatbot  # 13  - end-to-end assistant routing (installs jsdom)
```

The integration suite runs the real Express app against an in-memory Supabase
stub — no database, no SMTP, no network — so it is safe to run in CI. The
chatbot suite boots the real module graph in jsdom against a stubbed API and
asserts each message reaches the module that should own it.

**Five genuine bugs were found by these tests during development and fixed:**

1. **Risk profiling could be un-capped.** A stated-aggressive user with a
   9-month horizon and a 40% savings rate was correctly capped to
   capital-protection, then bumped back up by the savings-rate bonus that ran
   afterwards — putting money needed within the year into equity. Horizon caps
   now apply last, as hard constraints.
2. **Category parsing was greedy.** `"change the category to Travel for
   yesterday's expense"` produced the category `"Travel For Yesterday"`. The
   pattern is now bounded and stops at a preposition.
3. **The trip module hijacked "add" commands.** Its intent detector claimed any
   message starting with `add ` at confidence 95, so
   `"Add ₹500 spent on food today"` became a trip member instead of an expense.
   Adding members now requires an active trip and no money amount.
4. **The trip module also hijacked "change" and "spent".** `"Change yesterday's
   food expense from ₹500 to ₹700"` tried to edit a trip expense, and the bare
   word `spent` anywhere in a message routed it to trips — including
   `"can I afford a ₹60,000 laptop"`. Trip expense rules now require the
   `<person> paid <amount>` split shape or an active trip.
5. **Affordability questions fell through to the knowledge module.**
   `"can I afford a ₹60,000 laptop"` has no question marker and no time period,
   so the finance module's "is this really a question" guard rejected it.
   Self-evident intents are now exempt from that guard.

These are exactly the failures unit tests cannot see: each module was correct in
isolation, and only collided when the full intent pipeline ran.

---

## Known limitations

- Trip and news routes are unchanged and remain unauthenticated. They were out
  of scope; adding auth there is a small follow-up (the client already sends
  the token on every same-origin request).
- The rate limiter is in-memory, which is correct for a single instance. A
  multi-instance deployment should swap the `Map` for Redis — the middleware
  signature will not change.
- Row Level Security policies are written as comments in `schema.sql` but not
  enabled, since the API authenticates with the service-role key and enforces
  ownership in middleware. Enable them if the anon key is ever exposed to the
  browser.
- The client and server analytics engines are separate files with matching
  logic (one ESM, one CommonJS). A test asserts they agree; a shared build step
  would be the tidier long-term answer.
