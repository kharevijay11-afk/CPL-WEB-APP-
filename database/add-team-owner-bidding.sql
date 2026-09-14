-- Team owner bidding access
-- Supabase SQL Editor me is file ko run karo, phir 20 sec baad app refresh karo.

alter table public.teams
add column if not exists owner_mobile text check (owner_mobile is null or owner_mobile ~ '^[0-9]{10}$');

create table if not exists public.team_owner_credentials (
  team_id bigint primary key references public.teams(id) on delete cascade,
  owner_pin text not null check (length(trim(owner_pin)) >= 4),
  updated_at timestamptz not null default now()
);

alter table public.team_owner_credentials enable row level security;

drop policy if exists "Admins can manage team owner credentials" on public.team_owner_credentials;
create policy "Admins can manage team owner credentials"
on public.team_owner_credentials for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

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
