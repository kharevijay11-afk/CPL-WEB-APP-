-- Adds an auction end date used to close public player registration.
-- Run once in Supabase SQL Editor.

alter table public.tournaments
add column if not exists auction_end_date date;
