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
  registration_amount numeric(12, 2) not null default 1000 check (registration_amount >= 0),
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
  owner_mobile text check (owner_mobile is null or owner_mobile ~ '^[0-9]{10}$'),
  total_budget numeric(12, 2) not null default 0 check (total_budget >= 0),
  remaining_budget numeric(12, 2) not null default 0 check (remaining_budget >= 0),
  max_players integer not null default 16 check (max_players > 0),
  current_player_count integer not null default 0 check (current_player_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.team_owner_credentials (
  team_id bigint primary key references public.teams(id) on delete cascade,
  owner_pin text not null check (length(trim(owner_pin)) >= 4),
  updated_at timestamptz not null default now()
);

alter table public.teams
add column if not exists owner_mobile text check (owner_mobile is null or owner_mobile ~ '^[0-9]{10}$');

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
  player_criteria text default 'Silver Player',
  tshirt_size text check (tshirt_size in ('S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL')),
  tshirt_number text,
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  payment_screenshot_url text,
  aadhaar_card_url text,
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
  player_criteria text default 'Silver Player',
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
  team_count integer not null default 8 check (team_count > 0 and team_count <= 64),
  currency_mode text not null default 'Points' check (currency_mode in ('Points', 'INR')),
  current_player_id bigint references public.players(id) on delete set null,
  current_bid_amount numeric(12, 2) not null default 0,
  current_highest_team_id bigint references public.teams(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.website_content (
  tournament_id bigint primary key references public.tournaments(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value)
values ('visitor_count', jsonb_build_object('value', 100))
on conflict (key) do nothing;

create or replace function public.increment_visitor_count()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count bigint;
begin
  insert into public.app_config as config (key, value, updated_at)
  values ('visitor_count', jsonb_build_object('value', 101), now())
  on conflict (key) do update
  set value = jsonb_build_object(
        'value',
        greatest(
          100,
          case
            when coalesce(config.value ->> 'value', '') ~ '^\d+$'
              then (config.value ->> 'value')::bigint
            else 100
          end
        ) + 1
      ),
      updated_at = now()
  returning (value ->> 'value')::bigint into next_count;

  return next_count;
end;
$$;

revoke all on function public.increment_visitor_count() from public;
grant execute on function public.increment_visitor_count() to anon, authenticated;

create table if not exists public.owner_passes (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments(id) on delete cascade,
  player_id bigint not null references public.players(id) on delete cascade,
  team_id bigint not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint owner_passes_unique unique (tournament_id, player_id, team_id)
);

create table if not exists public.matches (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments(id) on delete cascade,
  match_title text not null,
  venue text,
  team_a_id bigint references public.teams(id) on delete set null,
  team_b_id bigint references public.teams(id) on delete set null,
  overs_limit integer not null default 10 check (overs_limit > 0),
  toss_winner_team_id bigint references public.teams(id) on delete set null,
  toss_decision text not null default 'Bat' check (toss_decision in ('Bat', 'Bowl')),
  batting_team_id bigint references public.teams(id) on delete set null,
  bowling_team_id bigint references public.teams(id) on delete set null,
  innings_no integer not null default 1 check (innings_no in (1, 2)),
  target integer,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Live', 'Completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.score_balls (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments(id) on delete cascade,
  match_id bigint not null references public.matches(id) on delete cascade,
  innings_no integer not null default 1 check (innings_no in (1, 2)),
  over_no integer not null default 0 check (over_no >= 0),
  ball_no integer not null default 1 check (ball_no between 1 and 6),
  batting_team_id bigint references public.teams(id) on delete set null,
  bowling_team_id bigint references public.teams(id) on delete set null,
  striker_id bigint references public.players(id) on delete set null,
  non_striker_id bigint references public.players(id) on delete set null,
  bowler_id bigint references public.players(id) on delete set null,
  runs integer not null default 0 check (runs >= 0),
  extra_type text check (extra_type is null or extra_type in ('Wide', 'No Ball', 'Bye', 'Leg Bye')),
  extra_runs integer not null default 0 check (extra_runs >= 0),
  wicket_type text check (wicket_type is null or wicket_type in ('Bowled', 'Caught', 'Run Out', 'LBW', 'Stumped', 'Hit Wicket', 'Retired')),
  wicket_player_id bigint references public.players(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists matches_tournament_id_idx on public.matches(tournament_id);
create index if not exists score_balls_tournament_id_idx on public.score_balls(tournament_id);
create index if not exists score_balls_match_id_idx on public.score_balls(match_id);

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

drop function if exists public.team_owner_login(text, text, bigint);

create or replace function public.team_owner_login(phone text, pin text, selected_tournament_id bigint)
returns table (
  team_id bigint,
  tournament_id bigint,
  team_name text,
  owner_name text,
  owner_mobile text,
  total_budget numeric,
  remaining_budget numeric,
  max_players integer,
  current_player_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id as team_id,
    t.tournament_id,
    t.team_name,
    t.owner_name,
    t.owner_mobile,
    t.total_budget,
    t.remaining_budget,
    t.max_players,
    t.current_player_count
  from public.teams t
  join public.team_owner_credentials c on c.team_id = t.id
  where t.tournament_id = selected_tournament_id
    and t.owner_mobile = regexp_replace(coalesce(phone, ''), '\D', '', 'g')
    and c.owner_pin = trim(coalesce(pin, ''))
  limit 1;
$$;

drop function if exists public.team_owner_place_bid(bigint, bigint, text, text, bigint, numeric);

create or replace function public.team_owner_place_bid(
  selected_tournament_id bigint,
  owner_team_id bigint,
  phone text,
  pin text,
  selected_player_id bigint,
  amount numeric
)
returns table (
  current_bid_amount numeric,
  current_highest_team_id bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  team_record public.teams%rowtype;
  player_record public.players%rowtype;
  settings_record public.tournament_settings%rowtype;
  minimum_bid numeric;
  bid_increment numeric := 1000;
begin
  if amount is null or amount <= 0 then
    raise exception 'Bid amount must be greater than 0.';
  end if;

  select t.* into team_record
  from public.teams t
  join public.team_owner_credentials c on c.team_id = t.id
  where t.id = owner_team_id
    and t.tournament_id = selected_tournament_id
    and t.owner_mobile = regexp_replace(coalesce(phone, ''), '\D', '', 'g')
    and c.owner_pin = trim(coalesce(pin, ''))
  for update of t;

  if team_record.id is null then
    raise exception 'Invalid team owner login.';
  end if;

  select * into player_record
  from public.players
  where id = selected_player_id
    and tournament_id = selected_tournament_id;

  if player_record.id is null then
    raise exception 'Player does not exist in this tournament.';
  end if;

  select * into settings_record
  from public.tournament_settings
  where tournament_id = selected_tournament_id
  for update;

  if settings_record.tournament_id is null or settings_record.current_player_id is null then
    raise exception 'No live player is active.';
  end if;

  if settings_record.current_player_id <> selected_player_id then
    raise exception 'This player is not active in the live auction.';
  end if;

  if player_record.sold_status <> 'Bidding' then
    raise exception 'Player is not open for bidding.';
  end if;

  if settings_record.current_highest_team_id = owner_team_id then
    raise exception 'Your team is already the highest bidder.';
  end if;

  minimum_bid := greatest(coalesce(settings_record.current_bid_amount, 0), coalesce(player_record.base_price, 0));

  if settings_record.current_highest_team_id is null then
    if amount < minimum_bid then
      raise exception 'First bid must be at least the base price.';
    end if;
  elsif amount < minimum_bid + bid_increment then
    raise exception 'Next bid must be at least 1000 more than the current bid.';
  end if;

  if team_record.remaining_budget < amount then
    raise exception 'Bid is higher than the team remaining budget.';
  end if;

  if team_record.current_player_count >= team_record.max_players then
    raise exception 'Team roster is full.';
  end if;

  insert into public.auction_logs (tournament_id, player_id, bidding_team_id, bid_amount)
  values (selected_tournament_id, selected_player_id, owner_team_id, amount);

  update public.tournament_settings
  set current_bid_amount = amount,
      current_highest_team_id = owner_team_id,
      updated_at = now()
  where tournament_id = selected_tournament_id;

  return query
  select amount, owner_team_id;
end;
$$;

grant execute on function public.team_owner_login(text, text, bigint) to anon, authenticated;
grant execute on function public.team_owner_place_bid(bigint, bigint, text, text, bigint, numeric) to anon, authenticated;
grant select, insert, update, delete on table public.team_owner_credentials to authenticated;

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
alter table public.team_owner_credentials enable row level security;
alter table public.players enable row level security;
alter table public.player_registrations enable row level security;
alter table public.auction_logs enable row level security;
alter table public.tournament_settings enable row level security;
alter table public.website_content enable row level security;
alter table public.matches enable row level security;
alter table public.score_balls enable row level security;

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

drop policy if exists "Admins can manage team owner credentials" on public.team_owner_credentials;
create policy "Admins can manage team owner credentials"
on public.team_owner_credentials for all
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

drop policy if exists "Public can read website content" on public.website_content;
create policy "Public can read website content"
on public.website_content for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage website content" on public.website_content;
create policy "Admins can manage website content"
on public.website_content for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read matches" on public.matches;
create policy "Public can read matches"
on public.matches for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage matches" on public.matches;
create policy "Admins can manage matches"
on public.matches for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read score balls" on public.score_balls;
create policy "Public can read score balls"
on public.score_balls for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage score balls" on public.score_balls;
create policy "Admins can manage score balls"
on public.score_balls for all
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

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'website_content'
  ) then
    alter publication supabase_realtime add table public.website_content;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'score_balls'
  ) then
    alter publication supabase_realtime add table public.score_balls;
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
