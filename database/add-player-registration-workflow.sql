-- Run this once in Supabase SQL Editor for the new player registration workflow.
-- It creates a registration table and storage buckets for photos, payment screenshots, and Aadhaar files.

alter table public.players
add column if not exists photo_path text;

create table if not exists public.player_registrations (
  id bigint generated always as identity primary key,
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

alter table public.player_registrations enable row level security;

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_registrations'
  ) then
    alter publication supabase_realtime add table public.player_registrations;
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
