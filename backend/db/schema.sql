-- ==========================================================================
-- FinTack database schema (PostgreSQL / Supabase)
--
-- Safe to run repeatedly: every statement is IF NOT EXISTS / idempotent.
-- Run in the Supabase SQL editor.
-- ==========================================================================

create extension if not exists "pgcrypto";

-- ==========================================================
--                          USERS
-- ==========================================================

create table if not exists public.users (
    id          uuid primary key default gen_random_uuid(),
    full_name   text        not null,
    email       text        not null,
    password    text        not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Emails are compared lowercase in the API; enforce uniqueness the same way.
create unique index if not exists users_email_lower_key
    on public.users (lower(email));

-- ==========================================================
--                      TRANSACTIONS
-- ==========================================================

create table if not exists public.transactions (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.users(id) on delete cascade,
    title       text not null,
    description text,
    amount      numeric(14,2) not null check (amount > 0),
    type        text not null check (type in ('income', 'expense')),
    category    text not null default 'Other',
    date        date not null default current_date,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Added by the 2.0 upgrade - see migrations.sql for existing installs.
alter table public.transactions
    add column if not exists description text;

alter table public.transactions
    add column if not exists updated_at timestamptz not null default now();

-- The dashboard always filters by user and sorts by date; this index turns
-- that from a sequential scan into an index scan on large accounts.
create index if not exists transactions_user_date_idx
    on public.transactions (user_id, date desc);

create index if not exists transactions_user_type_date_idx
    on public.transactions (user_id, type, date desc);

create index if not exists transactions_user_category_idx
    on public.transactions (user_id, category);

-- ==========================================================
--                          GOALS
-- ==========================================================

create table if not exists public.goals (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references public.users(id) on delete cascade,
    title          text not null,
    target_amount  numeric(14,2) not null check (target_amount > 0),
    saved_amount   numeric(14,2) not null default 0 check (saved_amount >= 0),
    deadline       date not null,
    risk_tolerance text default 'moderate',
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

alter table public.goals
    add column if not exists risk_tolerance text default 'moderate';

create index if not exists goals_user_idx
    on public.goals (user_id, created_at desc);

-- ==========================================================
--                    PASSWORD RESETS  (new in 2.0)
--
-- Stores only a SHA-256 hash of the OTP. Rows are single use and expire.
-- ==========================================================

create table if not exists public.password_resets (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.users(id) on delete cascade,
    email       text not null,
    otp_hash    text not null,
    expires_at  timestamptz not null,
    attempts    integer not null default 0,
    used        boolean not null default false,
    verified_at timestamptz,
    created_at  timestamptz not null default now()
);

create index if not exists password_resets_user_idx
    on public.password_resets (user_id, used, created_at desc);

create index if not exists password_resets_expiry_idx
    on public.password_resets (expires_at);

-- ==========================================================
--                        AI CHAT
-- ==========================================================

create table if not exists public.ai_chats (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.users(id) on delete cascade,
    title      text not null default 'New Chat',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ai_chats_user_idx
    on public.ai_chats (user_id, updated_at desc);

create table if not exists public.ai_messages (
    id         uuid primary key default gen_random_uuid(),
    chat_id    uuid not null references public.ai_chats(id) on delete cascade,
    role       text not null check (role in ('user', 'assistant')),
    message    text not null,
    created_at timestamptz not null default now()
);

create index if not exists ai_messages_chat_idx
    on public.ai_messages (chat_id, created_at);

-- ==========================================================
--                    NOTIFICATIONS
-- ==========================================================

create table if not exists public.notifications (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.users(id) on delete cascade,
    type       text not null default 'info',
    title      text not null,
    message    text,
    icon       text,
    data       jsonb,
    read       boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
    on public.notifications (user_id, created_at desc);

-- ==========================================================
--                      TRIP MANAGER
-- ==========================================================

create table if not exists public.trips (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.users(id) on delete cascade,
    name       text not null,
    budget     numeric(14,2),
    created_at timestamptz not null default now()
);

create table if not exists public.trip_members (
    id      uuid primary key default gen_random_uuid(),
    trip_id uuid not null references public.trips(id) on delete cascade,
    name    text not null
);

create table if not exists public.trip_expenses (
    id         uuid primary key default gen_random_uuid(),
    trip_id    uuid not null references public.trips(id) on delete cascade,
    title      text not null,
    amount     numeric(14,2) not null check (amount > 0),
    paid_by    text not null,
    category   text default 'General',
    created_at timestamptz not null default now()
);

create index if not exists trip_members_trip_idx on public.trip_members (trip_id);
create index if not exists trip_expenses_trip_idx on public.trip_expenses (trip_id);

-- ==========================================================
--                    updated_at TRIGGERS
-- ==========================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
    before update on public.transactions
    for each row execute function public.set_updated_at();

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
    before update on public.goals
    for each row execute function public.set_updated_at();

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
    before update on public.users
    for each row execute function public.set_updated_at();

-- ==========================================================
--                    ROW LEVEL SECURITY
--
-- The API authenticates with the service role key and enforces ownership in
-- middleware, so RLS is belt and braces. Enable it if you ever expose the
-- anon key to the browser.
--
--   alter table public.transactions enable row level security;
--   create policy "own rows" on public.transactions
--       using (user_id = auth.uid()) with check (user_id = auth.uid());
-- ==========================================================
