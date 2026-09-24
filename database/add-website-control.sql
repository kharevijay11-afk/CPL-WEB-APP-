-- CPL Website Control table
-- Paste this whole file in Supabase SQL Editor and run it once.

create table if not exists public.website_content (
  tournament_id bigint primary key references public.tournaments(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.website_content enable row level security;

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'website_content'
  ) then
    alter publication supabase_realtime add table public.website_content;
  end if;
end $$;

notify pgrst, 'reload schema';
