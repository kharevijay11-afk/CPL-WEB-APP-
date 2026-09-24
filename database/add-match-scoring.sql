-- Match Scoring module for CPL / Players Auction System.
-- Run this once in Supabase SQL Editor after the main schema is ready.

create table if not exists public.matches (
  id bigserial primary key,
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
  id bigserial primary key,
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

alter table public.matches enable row level security;
alter table public.score_balls enable row level security;

drop policy if exists "Public can read matches" on public.matches;
create policy "Public can read matches"
on public.matches for select
using (true);

drop policy if exists "Admins can manage matches" on public.matches;
create policy "Admins can manage matches"
on public.matches for all
using (exists (select 1 from public.admin_users where user_id = auth.uid()))
with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Public can read score balls" on public.score_balls;
create policy "Public can read score balls"
on public.score_balls for select
using (true);

drop policy if exists "Admins can manage score balls" on public.score_balls;
create policy "Admins can manage score balls"
on public.score_balls for all
using (exists (select 1 from public.admin_users where user_id = auth.uid()))
with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'score_balls'
  ) then
    alter publication supabase_realtime add table public.score_balls;
  end if;
end $$;
