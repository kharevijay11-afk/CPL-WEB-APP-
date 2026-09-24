-- Makes Silver Player the default criteria for player registration.
-- Run this once in Supabase SQL Editor for an existing database.

alter table public.players
add column if not exists player_criteria text;

alter table public.player_registrations
add column if not exists player_criteria text;

alter table public.players
alter column player_criteria set default 'Silver Player';

alter table public.player_registrations
alter column player_criteria set default 'Silver Player';

update public.players
set player_criteria = 'Silver Player'
where player_criteria is null or btrim(player_criteria) = '';

update public.player_registrations
set player_criteria = 'Silver Player'
where player_criteria is null or btrim(player_criteria) = '';

notify pgrst, 'reload schema';
