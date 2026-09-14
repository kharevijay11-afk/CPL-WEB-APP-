-- CPL Player Photo Save quick fix
-- Paste this whole SQL into Supabase SQL Editor and run it once.
-- This lets the public registration form save directly into public.players
-- with only the player photo and player details.

alter table public.players
add column if not exists tournament_id bigint references public.tournaments(id) on delete cascade;

update public.players
set tournament_id = (select id from public.tournaments order by id limit 1)
where tournament_id is null
  and exists (select 1 from public.tournaments);

alter table public.players
add column if not exists photo_url text;

alter table public.players
add column if not exists photo_path text;

alter table public.players
add column if not exists base_price numeric(12, 2) not null default 0;

alter table public.players
add column if not exists category text;

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

alter table public.players
add column if not exists stats jsonb not null default '{}'::jsonb;

alter table public.players enable row level security;

drop policy if exists "Public can save player photo registrations" on public.players;
create policy "Public can save player photo registrations"
on public.players for insert
to anon, authenticated
with check (
  tournament_id is not null
  and sold_status = 'Unsold'
  and assigned_team_id is null
  and final_bid_price is null
);

notify pgrst, 'reload schema';
