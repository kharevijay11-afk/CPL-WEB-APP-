-- Adds global app config, synced active tournament, admin gate password storage,
-- and team-owner pass support with auto-unsold when every team passes.
-- Run this once in Supabase SQL Editor for an existing database.

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.owner_passes (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments(id) on delete cascade,
  player_id bigint not null references public.players(id) on delete cascade,
  team_id bigint not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint owner_passes_unique unique (tournament_id, player_id, team_id)
);

insert into public.app_config (key, value)
values ('admin_password', jsonb_build_object('value', 'admin123'))
on conflict (key) do nothing;

insert into public.app_config (key, value)
values ('subadmin_password', jsonb_build_object('value', '12345'))
on conflict (key) do nothing;

insert into public.app_config (key, value)
select 'active_tournament_id', jsonb_build_object('value', id)
from public.tournaments
order by created_at desc nulls last, id desc
limit 1
on conflict (key) do nothing;

alter table public.app_config enable row level security;
alter table public.owner_passes enable row level security;

drop policy if exists "Public can read app config" on public.app_config;
create policy "Public can read app config"
on public.app_config for select
to anon, authenticated
using (true);

drop policy if exists "Public can upsert app config" on public.app_config;
create policy "Public can upsert app config"
on public.app_config for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Public can read owner passes" on public.owner_passes;
create policy "Public can read owner passes"
on public.owner_passes for select
to anon, authenticated
using (true);

drop function if exists public.team_owner_pass_bid(bigint, bigint, text, text, bigint);

create or replace function public.team_owner_pass_bid(
  selected_tournament_id bigint,
  owner_team_id bigint,
  phone text,
  pin text,
  selected_player_id bigint
)
returns table (
  player_unsold boolean,
  pass_count integer,
  team_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  credential_record public.team_owner_credentials%rowtype;
  settings_record public.tournament_settings%rowtype;
  owner_phone text := regexp_replace(coalesce(phone, ''), '\D', '', 'g');
begin
  select c.*
  into credential_record
  from public.team_owner_credentials c
  join public.teams t on t.id = c.team_id
  where c.team_id = owner_team_id
    and t.tournament_id = selected_tournament_id
    and regexp_replace(coalesce(t.owner_mobile, ''), '\D', '', 'g') = owner_phone
    and c.owner_pin = coalesce(pin, '')
  limit 1;

  if credential_record.team_id is null then
    raise exception 'Invalid owner login.';
  end if;

  select *
  into settings_record
  from public.tournament_settings
  where tournament_id = selected_tournament_id
  for update;

  if settings_record.current_player_id is null then
    raise exception 'No live player.';
  end if;

  if settings_record.current_player_id <> selected_player_id then
    raise exception 'Player changed. Refresh and try again.';
  end if;

  if settings_record.current_highest_team_id = owner_team_id then
    raise exception 'Highest bidder cannot pass.';
  end if;

  insert into public.owner_passes (tournament_id, player_id, team_id)
  values (selected_tournament_id, selected_player_id, owner_team_id)
  on conflict (tournament_id, player_id, team_id) do nothing;

  select count(distinct team_id)::integer
  into pass_count
  from public.owner_passes
  where tournament_id = selected_tournament_id
    and player_id = selected_player_id;

  select count(*)::integer
  into team_count
  from public.teams
  where tournament_id = selected_tournament_id;

  player_unsold := false;

  if team_count > 0 and pass_count >= team_count and settings_record.current_highest_team_id is null then
    update public.players
    set sold_status = 'Unsold',
        final_bid_price = null,
        assigned_team_id = null
    where id = selected_player_id;

    update public.tournament_settings
    set current_player_id = null,
        current_bid_amount = 0,
        current_highest_team_id = null,
        updated_at = now()
    where tournament_id = selected_tournament_id;

    player_unsold := true;
  end if;

  return next;
end;
$$;

grant execute on function public.team_owner_pass_bid(bigint, bigint, text, text, bigint) to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_config'
  ) then
    alter publication supabase_realtime add table public.app_config;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'owner_passes'
  ) then
    alter publication supabase_realtime add table public.owner_passes;
  end if;
end $$;

notify pgrst, 'reload schema';
