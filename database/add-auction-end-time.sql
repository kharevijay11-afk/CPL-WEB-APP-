-- Adds auction end time for closing public player registration by exact date and time.
-- Run this once in Supabase SQL Editor for an existing CPL/PAS database.

alter table public.tournaments
add column if not exists auction_end_time time;

notify pgrst, 'reload schema';
