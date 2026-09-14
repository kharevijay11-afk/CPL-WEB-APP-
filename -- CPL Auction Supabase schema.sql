-- CPL Auction Supabase schema
-- Paste this whole file into Supabase SQL Editor and run it once.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id bigint generated always as identity primary key,
  name text not null,
  start_date date,
  end_date date,
  address text,
  logo_url text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments(id) on delete cascade,
  team_name text not null,
  owner_name text not null,
  total_budget numeric(12, 2) not null default 0 check (total_budget >= 0),
  remaining_budget numeric(12, 2) not null default 0 check (remaining_budget >= 0),
  max_players integer not null default 16 check (max_players > 0),
  current_player_count integer not null default 0 check (current_player_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments(id) on delete cascade,
  full_name text not null,
  mobile_number text not null check (mobile_number ~ '^[0-9]{10}$'),
  photo_url text,
  photo_path text,
  base_price numeric(12, 2) not null default 0 check (base_price >= 0),
  final_bid_price numeric(12, 2),
  sold_status text not null default 'Unsold' check (sold_status in ('Unsold', 'Sold', 'Bidding')),
  assigned_team_id bigint references public.teams(id) on delete set null,
  category text,
  tshirt_size text check (tshirt_size in ('S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL')),
  tshirt_number text,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint players_tournament_mobile_unique unique (tournament_id, mobile_number)
);

create table if not exists public.player_registrations (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments(id) on delete cascade,
  full_name text not null,
  mobile_number text not null check (mobile_number ~ '^[0-9]{10}$'),
  photo_url text,
  photo_path text,
  base_price numeric(12, 2) not null default 0 check (base_price >= 0),
  category text,
  tshirt_size text check (tshirt_size in ('S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL')),
  tshirt_number text,
  stats jsonb not null default '{}'::jsonb,
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  payment_screenshot_path text,
  aadhaar_card_path text,
  registration_status text not null default 'Pending' check (registration_status in ('Pending', 'Added', 'Rejected')),
  added_player_id bigint references public.players(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.auction_logs (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments(id) on delete cascade,
  player_id bigint references public.players(id) on delete cascade,
  bidding_team_id bigint references public.teams(id) on delete set null,
  bid_amount numeric(12, 2) not null check (bid_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_settings (
  tournament_id bigint primary key references public.tournaments(id) on delete cascade,
  team_count integer not null default 8 check (team_count in (2, 4, 8, 10, 12, 14, 16)),
  currency_mode text not null default 'Points' check (currency_mode in ('Points', 'INR')),
  current_player_id bigint references public.players(id) on delete set null,
  current_bid_amount numeric(12, 2) not null default 0,
  current_highest_team_id bigint references public.teams(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.tournaments (name)
select 'CPL Tournament'
where not exists (select 1 from public.tournaments);

insert into public.tournament_settings (tournament_id)
select id from public.tournaments order by id limit 1
on conflict (tournament_id) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

create or replace function public.first_word(value text)
returns text
language sql
immutable
as $$
  select lower(trim(split_part(coalesce(value, ''), ' ', 1)));
$$;

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

drop trigger if exists auction_logs_validate_before_insert on public.auction_logs;
create trigger auction_logs_validate_before_insert
before insert on public.auction_logs
for each row execute function public.validate_auction_log();

alter table public.admin_users enable row level security;
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.player_registrations enable row level security;
alter table public.auction_logs enable row level security;
alter table public.tournament_settings enable row level security;

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users for select
to authenticated
using (public.is_admin());

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

drop policy if exists "Public can read teams" on public.teams;
create policy "Public can read teams"
on public.teams for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage teams" on public.teams;
create policy "Admins can manage teams"
on public.teams for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read players" on public.players;
create policy "Public can read players"
on public.players for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage players" on public.players;
create policy "Admins can manage players"
on public.players for all
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

drop policy if exists "Public can create player registrations" on public.player_registrations;
create policy "Public can create player registrations"
on public.player_registrations for insert
to anon, authenticated
with check (registration_status = 'Pending' and added_player_id is null);

drop policy if exists "Admins can manage player registrations" on public.player_registrations;
create policy "Admins can manage player registrations"
on public.player_registrations for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read auction logs" on public.auction_logs;
create policy "Public can read auction logs"
on public.auction_logs for select
to anon, authenticated
using (true);

drop policy if exists "Admins can create auction logs" on public.auction_logs;
create policy "Admins can create auction logs"
on public.auction_logs for insert
to authenticated
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
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams'
  ) then
    alter publication supabase_realtime add table public.teams;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table public.players;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'auction_logs'
  ) then
    alter publication supabase_realtime add table public.auction_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_registrations'
  ) then
    alter publication supabase_realtime add table public.player_registrations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tournament_settings'
  ) then
    alter publication supabase_realtime add table public.tournament_settings;
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cpl-player-photos',
  'cpl-player-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cpl-registration-documents',
  'cpl-registration-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can upload player photos" on storage.objects;
create policy "Public can upload player photos"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'cpl-player-photos');

drop policy if exists "Public can view player photos" on storage.objects;
create policy "Public can view player photos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'cpl-player-photos');

drop policy if exists "Public can upload registration documents" on storage.objects;
create policy "Public can upload registration documents"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'cpl-registration-documents');

drop policy if exists "Admins can read registration documents" on storage.objects;
create policy "Admins can read registration documents"
on storage.objects for select
to authenticated
using (bucket_id = 'cpl-registration-documents' and public.is_admin());
