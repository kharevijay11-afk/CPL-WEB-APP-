-- Adds tournament-wise separation, tournament profile fields, and per-tournament settings.
-- Run this once in Supabase SQL Editor for an existing CPL Auction database.

create table if not exists public.tournaments (
  id bigint generated always as identity primary key,
  name text not null,
  start_date date,
  end_date date,
  auction_end_date date,
  address text,
  logo_url text,
  description text,
  created_at timestamptz not null default now()
);

alter table public.tournaments
add column if not exists auction_end_date date;

insert into public.tournaments (name)
select 'CPL Tournament'
where not exists (select 1 from public.tournaments);

alter table public.teams add column if not exists tournament_id bigint references public.tournaments(id) on delete cascade;
alter table public.players add column if not exists tournament_id bigint references public.tournaments(id) on delete cascade;
alter table public.player_registrations add column if not exists tournament_id bigint references public.tournaments(id) on delete cascade;
alter table public.auction_logs add column if not exists tournament_id bigint references public.tournaments(id) on delete cascade;

update public.teams
set tournament_id = (select id from public.tournaments order by id limit 1)
where tournament_id is null;

update public.players
set tournament_id = (select id from public.tournaments order by id limit 1)
where tournament_id is null;

update public.player_registrations
set tournament_id = (select id from public.tournaments order by id limit 1)
where tournament_id is null;

update public.auction_logs
set tournament_id = coalesce(
  (select tournament_id from public.players where players.id = auction_logs.player_id),
  (select id from public.tournaments order by id limit 1)
)
where tournament_id is null;

alter table public.teams alter column tournament_id set not null;
alter table public.players alter column tournament_id set not null;
alter table public.player_registrations alter column tournament_id set not null;
alter table public.auction_logs alter column tournament_id set not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.players'::regclass
      and conname = 'players_mobile_number_key'
  ) then
    alter table public.players drop constraint players_mobile_number_key;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.players'::regclass
      and conname = 'players_tournament_mobile_unique'
  ) then
    alter table public.players
    add constraint players_tournament_mobile_unique unique (tournament_id, mobile_number);
  end if;
end $$;

create table if not exists public.tournament_settings (
  tournament_id bigint primary key references public.tournaments(id) on delete cascade,
  team_count integer not null default 8 check (team_count > 0 and team_count <= 64),
  currency_mode text not null default 'Points' check (currency_mode in ('Points', 'INR')),
  current_player_id bigint references public.players(id) on delete set null,
  current_bid_amount numeric(12, 2) not null default 0,
  current_highest_team_id bigint references public.teams(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.tournament_settings (tournament_id)
select id from public.tournaments
on conflict (tournament_id) do nothing;

do $$
begin
  if to_regclass('public.app_settings') is not null then
    execute $sql$
      update public.tournament_settings ts
      set
        team_count = coalesce(s.team_count, ts.team_count),
        currency_mode = coalesce(s.currency_mode, ts.currency_mode),
        current_player_id = s.current_player_id,
        current_bid_amount = coalesce(s.current_bid_amount, ts.current_bid_amount),
        current_highest_team_id = s.current_highest_team_id
      from public.app_settings s
      where s.id = true
        and ts.tournament_id = (select id from public.tournaments order by id limit 1)
    $sql$;
  end if;
end $$;

create or replace function public.create_tournament_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tournament_settings (tournament_id)
  values (new.id)
  on conflict (tournament_id) do nothing;
  return new;
end;
$$;

drop trigger if exists tournaments_create_settings_after_insert on public.tournaments;
create trigger tournaments_create_settings_after_insert
after insert on public.tournaments
for each row execute function public.create_tournament_settings();

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
    p.tshirt_size,
    p.tshirt_number,
    p.stats
  from public.players p
  where p.tournament_id = selected_tournament_id
    and p.mobile_number = regexp_replace(coalesce(phone, ''), '\D', '', 'g')
    and public.first_word(p.full_name) = lower(trim(coalesce(password, '')))
  limit 1;
$$;

create or replace function public.validate_auction_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  team_record public.teams%rowtype;
  player_record public.players%rowtype;
begin
  select * into team_record
  from public.teams
  where id = new.bidding_team_id
  for update;

  select * into player_record
  from public.players
  where id = new.player_id;

  if team_record.id is null then
    raise exception 'Bidding team does not exist.';
  end if;

  if player_record.id is null then
    raise exception 'Player does not exist.';
  end if;

  if team_record.tournament_id <> new.tournament_id or player_record.tournament_id <> new.tournament_id then
    raise exception 'Player and team must belong to the same tournament.';
  end if;

  if team_record.remaining_budget < new.bid_amount then
    raise exception 'Bid is higher than the team remaining budget.';
  end if;

  if team_record.current_player_count >= team_record.max_players then
    raise exception 'Team roster is full.';
  end if;

  return new;
end;
$$;

alter table public.tournaments enable row level security;
alter table public.tournament_settings enable row level security;

drop policy if exists "Public can read tournaments" on public.tournaments;
create policy "Public can read tournaments"
on public.tournaments for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage tournaments" on public.tournaments;
create policy "Admins can manage tournaments"
on public.tournaments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read tournament settings" on public.tournament_settings;
create policy "Public can read tournament settings"
on public.tournament_settings for select
to anon, authenticated
using (true);

drop policy if exists "Admins can update tournament settings" on public.tournament_settings;
create policy "Admins can update tournament settings"
on public.tournament_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tournaments'
  ) then
    alter publication supabase_realtime add table public.tournaments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tournament_settings'
  ) then
    alter publication supabase_realtime add table public.tournament_settings;
  end if;
end $$;
