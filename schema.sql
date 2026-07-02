-- ============================================================
--  THE BARHAM LAKES — Booking system database schema
--  Run this in the Supabase SQL editor (Project → SQL → New query).
--  Mirrors the Needham Market FC pattern: browser talks to Supabase
--  directly with the ANON key, protected by Row Level Security (RLS).
-- ============================================================

-- ---------- PROFILES ----------
-- One row per registered user. 'role' gates the admin dashboard.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  phone        text,
  organisation text,
  role         text not null default 'user',   -- 'user' | 'admin'
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Convenience: is the current user an admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- BOOKINGS ----------
-- A booking is an exclusive stay on one water for a date range.
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  water          text not null,                 -- e.g. 'brook-pool'
  check_in       date not null,
  check_out      date not null,
  nights         int  not null,
  anglers        int  not null default 4,
  season         text,                          -- 'off-peak' | 'shoulder' | 'peak' | 'festive'
  price          int  not null default 0,       -- whole-stay price, £ (pence not used, keep it simple)
  deposit        int  not null default 0,       -- 30% deposit, £
  status         text not null default 'pending',        -- 'pending' | 'confirmed' | 'cancelled'
  payment_status text not null default 'unpaid',         -- 'unpaid' | 'deposit_paid'
  stripe_session text,
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text,
  email          text,
  phone          text,
  organisation   text,
  notes          text,
  created_at     timestamptz not null default now(),
  check (check_out > check_in)
);
create index if not exists bookings_water_dates_idx on public.bookings (water, check_in, check_out);

-- ---------- BLOCKED DATES ----------
-- Owner can close a water for maintenance / private use.
create table if not exists public.blocked_dates (
  id        uuid primary key default gen_random_uuid(),
  water     text not null,
  check_in  date not null,
  check_out date not null,
  reason    text,
  created_at timestamptz not null default now(),
  check (check_out > check_in)
);

-- ---------- PUBLIC AVAILABILITY VIEW ----------
-- No personal data — this is what the public calendar reads to grey out taken nights.
create or replace view public.public_bookings as
  select water, check_in, check_out
  from public.bookings
  where status <> 'cancelled'
  union all
  select water, check_in, check_out
  from public.blocked_dates;

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.bookings      enable row level security;
alter table public.blocked_dates enable row level security;

-- profiles: users see/edit their own; admins see all
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid());

-- bookings: a user can create + read their own; admins can do anything
drop policy if exists bookings_insert_own on public.bookings;
create policy bookings_insert_own on public.bookings
  for insert with check (user_id = auth.uid());
drop policy if exists bookings_select_own on public.bookings;
create policy bookings_select_own on public.bookings
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists bookings_admin_update on public.bookings;
create policy bookings_admin_update on public.bookings
  for update using (public.is_admin());
drop policy if exists bookings_admin_delete on public.bookings;
create policy bookings_admin_delete on public.bookings
  for delete using (public.is_admin());

-- blocked_dates: only admins write; everyone (incl. anon) may read via the view
drop policy if exists blocked_admin_all on public.blocked_dates;
create policy blocked_admin_all on public.blocked_dates
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists blocked_read on public.blocked_dates;
create policy blocked_read on public.blocked_dates
  for select using (true);

-- Let the anonymous (public) role read the availability view.
grant select on public.public_bookings to anon, authenticated;

-- ============================================================
--  MAKE YOURSELF AN ADMIN (run AFTER you have signed up once)
--  update public.profiles set role = 'admin' where id =
--    (select id from auth.users where email = 'owner@thebarhamlakes.co.uk');
-- ============================================================
