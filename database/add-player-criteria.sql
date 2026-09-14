-- Adds optional player criteria/grade support.
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

drop function if exists public.player_login(text, text);
drop function if exists public.player_login(text, text, bigint);

create or replace function public.player_login(phone text, password text, selected_tournament_id bigint)
returns table (
  id bigint,
  tournament_id bigint,
  full_name text,
  mobile_number text,
  photo_url text,
  photo_path text,
  base_price numeric,
  final_bid_price numeric,
  sold_status text,
  assigned_team_id bigint,
  category text,
  player_criteria text,
  tshirt_size text,
  tshirt_number text,
  stats jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.tournament_id,
    p.full_name,
    p.mobile_number,
    p.photo_url,
    p.photo_path,
    p.base_price,
    p.final_bid_price,
    p.sold_status,
    p.assigned_team_id,
    p.category,
    p.player_criteria,
    p.tshirt_size,
    p.tshirt_number,
    p.stats
  from public.players p
  where p.tournament_id = selected_tournament_id
    and p.mobile_number = regexp_replace(coalesce(phone, ''), '\D', '', 'g')
    and public.first_word(p.full_name) = lower(trim(coalesce(password, '')))
  limit 1;
$$;

notify pgrst, 'reload schema';
