-- Allows tournaments to use custom team counts above 16.
-- Run this once in Supabase SQL Editor for an existing database.

alter table public.tournament_settings
drop constraint if exists tournament_settings_team_count_check;

alter table public.tournament_settings
add constraint tournament_settings_team_count_check
check (team_count > 0 and team_count <= 64);

notify pgrst, 'reload schema';
