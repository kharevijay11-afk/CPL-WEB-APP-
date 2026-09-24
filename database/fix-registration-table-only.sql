-- CPL Player Registration quick fix
-- Paste this whole SQL into Supabase SQL Editor and run it once.
-- This version does not create Storage buckets because the app saves selected
-- photo/payment/Aadhaar files directly in the registration table.

create extension if not exists pgcrypto;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

create table if not exists public.player_registrations (
  id bigint generated always as identity primary key,
  full_name text not null,
  mobile_number text not null check (mobile_number ~ '^[0-9]{10}$'),
  photo_url text,
  photo_path text,
  base_price numeric(12, 2) not null default 0 check (base_price >= 0),
  category text,
  player_criteria text default 'Silver Player',
  tshirt_size text check (tshirt_size in ('S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL')),
  tshirt_number text,
  stats jsonb not null default '{}'::jsonb,
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  payment_screenshot_path text,
  aadhaar_card_path text,
  registration_status text not null default 'Pending' check (registration_status in ('Pending', 'Added', 'Rejected')),
  added_player_id bigint references public.players(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.player_registrations
add column if not exists photo_url text;

alter table public.player_registrations
add column if not exists photo_path text;

alter table public.player_registrations
add column if not exists base_price numeric(12, 2) not null default 0;

alter table public.player_registrations
add column if not exists category text;

alter table public.player_registrations
add column if not exists player_criteria text;

alter table public.player_registrations
alter column player_criteria set default 'Silver Player';

update public.player_registrations
set player_criteria = 'Silver Player'
where player_criteria is null or btrim(player_criteria) = '';

alter table public.player_registrations
add column if not exists tshirt_size text;

alter table public.player_registrations
add column if not exists tshirt_number text;

alter table public.player_registrations
add column if not exists stats jsonb not null default '{}'::jsonb;

alter table public.player_registrations
add column if not exists paid_amount numeric(12, 2) not null default 0;

alter table public.player_registrations
add column if not exists payment_screenshot_path text;

alter table public.player_registrations
add column if not exists aadhaar_card_path text;

alter table public.player_registrations
add column if not exists registration_status text not null default 'Pending';

alter table public.player_registrations
add column if not exists added_player_id bigint references public.players(id) on delete set null;

alter table public.player_registrations enable row level security;

drop policy if exists "Public can create player registrations" on public.player_registrations;
create policy "Public can create player registrations"
on public.player_registrations for insert
to anon, authenticated
with check (registration_status = 'Pending' and added_player_id is null);

drop policy if exists "Admins can manage player registrations" on public.player_registrations;
create policy "Admins can manage player registrations"
on public.player_registrations for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

notify pgrst, 'reload schema';
