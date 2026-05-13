create extension if not exists pgcrypto;

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  total numeric(10,2) not null check (total >= 0),
  notes text not null default '',
  sold_on date not null default current_date,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  amount numeric(10,2) not null check (amount >= 0),
  notes text not null default '',
  spent_on date not null default current_date,
  created_at timestamptz not null default timezone('utc', now())
);

-- Phase 1: span columns for expenses that cover multiple sales days.
-- Existing rows are backfilled so covers_from = covers_to = spent_on (single-day, current behavior).
alter table public.expenses add column if not exists covers_from date;
alter table public.expenses add column if not exists covers_to date;
update public.expenses set covers_from = spent_on where covers_from is null;
update public.expenses set covers_to = spent_on where covers_to is null;
alter table public.expenses alter column covers_from set not null;
alter table public.expenses alter column covers_to set not null;
alter table public.expenses alter column covers_from set default current_date;
alter table public.expenses alter column covers_to set default current_date;
alter table public.expenses
  drop constraint if exists expenses_covers_range_check;
alter table public.expenses
  add constraint expenses_covers_range_check check (covers_to >= covers_from);

create index if not exists sales_user_date_idx on public.sales (user_id, sold_on desc, created_at desc);
create index if not exists expenses_user_date_idx on public.expenses (user_id, spent_on desc, created_at desc);
create index if not exists expenses_user_covers_idx on public.expenses (user_id, covers_from, covers_to);

alter table public.sales enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "sales_select_own" on public.sales;
create policy "sales_select_own"
on public.sales
for select
using (auth.uid() = user_id);

drop policy if exists "sales_insert_own" on public.sales;
create policy "sales_insert_own"
on public.sales
for insert
with check (auth.uid() = user_id);

drop policy if exists "sales_update_own" on public.sales;
create policy "sales_update_own"
on public.sales
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "sales_delete_own" on public.sales;
create policy "sales_delete_own"
on public.sales
for delete
using (auth.uid() = user_id);

drop policy if exists "expenses_select_own" on public.expenses;
create policy "expenses_select_own"
on public.expenses
for select
using (auth.uid() = user_id);

drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own"
on public.expenses
for insert
with check (auth.uid() = user_id);

drop policy if exists "expenses_update_own" on public.expenses;
create policy "expenses_update_own"
on public.expenses
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_delete_own"
on public.expenses
for delete
using (auth.uid() = user_id);
