-- Adds optional tournament format and group-wise team assignment.
-- Run this once in Supabase SQL Editor for an existing CPL/PAS database.

alter table public.tournaments
add column if not exists tournament_format text not null default 'League';

alter table public.tournaments
add column if not exists group_count integer not null default 0;

alter table public.teams
add column if not exists group_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_tournament_format_check'
  ) then
    alter table public.tournaments
    add constraint tournaments_tournament_format_check
    check (tournament_format in ('League', 'Knockout'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_group_count_check'
  ) then
    alter table public.tournaments
    add constraint tournaments_group_count_check
    check (group_count in (0, 2, 4));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'teams_group_name_check'
  ) then
    alter table public.teams
    add constraint teams_group_name_check
    check (group_name is null or group_name in ('A', 'B', 'C', 'D'));
  end if;
end $$;

notify pgrst, 'reload schema';
