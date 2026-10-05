# FinTack requested changes

## 1. Assets
- Added a dedicated Assets page and navigation item.
- Users can add/edit/delete Land, Bank FD, Gold, Real Estate, Stocks, Mutual Funds, Vehicles and Other assets.
- Tracks current value, optional quantity and notes.
- Shows total asset value.

## 2. Database encryption
- Added AES-256-GCM application-level encryption in `backend/utils/crypto.js`.
- Transactions, goals, assets and AI chat content are written to `encrypted_payload` rather than plaintext financial fields.
- `user_id`, UUIDs and timestamps remain as ownership/operational metadata; login email/full name remain available for authentication/profile display.
- Set `DATA_ENCRYPTION_KEY` in `backend/.env` to a random 32-byte key (64 hex characters).
- Run `backend/db/migrations.sql`, then run `node scripts/encrypt-existing-data.js` from `backend/` once to encrypt legacy records and clear their old plaintext fields.
- Do not lose `DATA_ENCRYPTION_KEY`; encrypted data cannot be recovered without it.

## 3. Transaction editor CSS
- Redesigned the edit transaction modal with a compact two-option income/expense switch, clearer labels, improved focus states, responsive spacing, and separated Save/Delete actions.

## Validation
- Backend JavaScript syntax checks pass.
- Existing project unit tests: 80 passed.
- Full backend integration tests could not run in this environment because the uploaded archive's dependency installation was incomplete; no application code test failure was observed.

## Goal planning and UI polish
- Goal planning now applies annual inflation to the deadline target and expected annual return to the monthly contribution calculation.
- Goal cards show today's target, inflation-adjusted deadline target, inflation assumption, expected return and required monthly investment.
- Goal edit/create modals now include a live calculation preview and balanced Cancel/Save actions.
- Goal progress and overall goal summary use the inflation-adjusted deadline target.
- Investment-plan milestones use the inflation-adjusted target.
- Savings completion checks use the inflation-adjusted deadline target.
