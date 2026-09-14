-- Run this once in Supabase SQL Editor if your CPL tables already exist.
-- It adds player photo and T-shirt fields without resetting existing data.

alter table public.players
add column if not exists photo_url text;

alter table public.players
add column if not exists photo_path text;

alter table public.players
add column if not exists player_criteria text;

alter table public.players
alter column player_criteria set default 'Silver Player';

update public.players
set player_criteria = 'Silver Player'
where player_criteria is null or btrim(player_criteria) = '';

alter table public.players
add column if not exists tshirt_size text;

alter table public.players
add column if not exists tshirt_number text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'players_tshirt_size_check'
  ) then
    alter table public.players
    add constraint players_tshirt_size_check
    check (tshirt_size in ('S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'));
  end if;
end $$;

drop function if exists public.player_login(text, text);

create or replace function public.player_login(phone text, password text)
returns table (
  id bigint,
  full_name text,
  mobile_number text,
  photo_url text,
  photo_path text,
  base_price numeric,
  final_bid_price numeric,
  sold_status text,
  assigned_team_id bigint,
  category text,
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
    p.full_name,
    p.mobile_number,
    p.photo_url,
    p.photo_path,
    p.base_price,
    p.final_bid_price,
    p.sold_status,
    p.assigned_team_id,
    p.category,
    p.tshirt_size,
    p.tshirt_number,
    p.stats
  from public.players p
  where p.mobile_number = regexp_replace(coalesce(phone, ''), '\D', '', 'g')
    and public.first_word(p.full_name) = lower(trim(coalesce(password, '')))
  limit 1;
$$;
