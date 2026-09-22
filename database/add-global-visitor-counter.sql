-- Shared visitor counter for the public website and /demo.
-- Run once in Supabase SQL Editor. The function increments atomically,
-- so mobile and laptop visitors always receive one increasing global count.

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value)
values ('visitor_count', jsonb_build_object('value', 100))
on conflict (key) do nothing;

alter table public.app_config enable row level security;

drop policy if exists "Public can read app config" on public.app_config;
create policy "Public can read app config"
on public.app_config for select
to anon, authenticated
using (true);

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_config'
  ) then
    alter publication supabase_realtime add table public.app_config;
  end if;
end $$;

notify pgrst, 'reload schema';
