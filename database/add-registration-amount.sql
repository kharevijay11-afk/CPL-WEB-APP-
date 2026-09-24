-- Adds a fixed player registration amount per tournament.
-- Run this once in Supabase SQL Editor before using the new registration amount field.

alter table public.tournaments
add column if not exists registration_amount numeric(12, 2) not null default 1000 check (registration_amount >= 0);

update public.tournaments
set registration_amount = 1000
where registration_amount is null;
