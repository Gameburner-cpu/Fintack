-- ==========================================================================
-- FinTack 1.x -> 2.0 migration
--
-- Run this against an EXISTING database that already has users,
-- transactions, goals, ai_chats and ai_messages. It is idempotent.
-- ==========================================================================

begin;

-- ----------------------------------------------------------
-- 1. Password reset support (Forgot Password feature)
-- ----------------------------------------------------------

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

-- ----------------------------------------------------------
-- 2. Editable transactions
-- ----------------------------------------------------------

alter table public.transactions
    add column if not exists description text;

alter table public.transactions
    add column if not exists updated_at timestamptz not null default now();

-- Backfill so existing rows sort predictably.
update public.transactions
   set updated_at = coalesce(updated_at, created_at, now())
 where updated_at is null;

-- ----------------------------------------------------------
-- 3. Data integrity constraints the app now relies on
-- ----------------------------------------------------------

-- Normalise any legacy type values before adding the constraint.
update public.transactions
   set type = lower(trim(type))
 where type is not null and type <> lower(trim(type));

update public.transactions
   set type = 'expense'
 where type not in ('income', 'expense') or type is null;

update public.transactions
   set category = 'Other'
 where category is null or trim(category) = '';

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'transactions_type_check'
    ) then
        alter table public.transactions
            add constraint transactions_type_check
            check (type in ('income', 'expense'));
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'transactions_amount_check'
    ) then
        alter table public.transactions
            add constraint transactions_amount_check
            check (amount > 0);
    end if;
end $$;

-- ----------------------------------------------------------
-- 4. Goal risk profile (AI investment planning)
-- ----------------------------------------------------------

alter table public.goals
    add column if not exists risk_tolerance text default 'moderate';

alter table public.goals
    add column if not exists updated_at timestamptz not null default now();

-- ----------------------------------------------------------
-- 5. Performance indexes
-- ----------------------------------------------------------

create index if not exists transactions_user_date_idx
    on public.transactions (user_id, date desc);

create index if not exists transactions_user_type_date_idx
    on public.transactions (user_id, type, date desc);

create index if not exists transactions_user_category_idx
    on public.transactions (user_id, category);

create index if not exists goals_user_idx
    on public.goals (user_id, created_at desc);

create index if not exists ai_chats_user_idx
    on public.ai_chats (user_id, updated_at desc);

create index if not exists ai_messages_chat_idx
    on public.ai_messages (chat_id, created_at);

-- ----------------------------------------------------------
-- 6. Case-insensitive unique email
-- ----------------------------------------------------------

-- Lowercase existing emails first so the index can be created.
update public.users set email = lower(trim(email));

-- If this fails you have duplicate accounts differing only by case.
-- Inspect with:
--   select lower(email), count(*) from public.users
--    group by 1 having count(*) > 1;
create unique index if not exists users_email_lower_key
    on public.users (lower(email));

commit;
