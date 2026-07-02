-- ============================================================
--  THE BARHAM LAKES — Syndicate membership module
--  Run AFTER schema.sql (it reuses profiles + is_admin()).
-- ============================================================

create table if not exists public.memberships (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  ticket          text not null,                 -- 'specimen-carp' | 'specimen-pike' | 'complete-complex'
  season_year     int  not null,
  price           int  not null default 0,
  status          text not null default 'pending',   -- 'pending' | 'active' | 'expired' | 'cancelled'
  payment_status  text not null default 'unpaid',    -- 'unpaid' | 'paid'
  stripe_session  text,
  name            text,
  email           text,
  phone           text,
  fishing_history text,
  notes           text,
  applied_at      timestamptz not null default now(),
  expires_at      date
);
create index if not exists memberships_user_idx on public.memberships (user_id);

alter table public.memberships enable row level security;

drop policy if exists memb_insert_own on public.memberships;
create policy memb_insert_own on public.memberships
  for insert with check (user_id = auth.uid());
drop policy if exists memb_select_own on public.memberships;
create policy memb_select_own on public.memberships
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists memb_admin_update on public.memberships;
create policy memb_admin_update on public.memberships
  for update using (public.is_admin());
drop policy if exists memb_admin_delete on public.memberships;
create policy memb_admin_delete on public.memberships
  for delete using (public.is_admin());
