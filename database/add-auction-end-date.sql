-- Adds auction end date/time used to close public player registration.
-- Run once in Supabase SQL Editor.

alter table public.tournaments
add column if not exists auction_end_date date;

alter table public.tournaments
add column if not exists auction_end_time time;

notify pgrst, 'reload schema';
