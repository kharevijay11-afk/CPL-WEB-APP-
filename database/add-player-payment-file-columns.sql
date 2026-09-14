-- Run this once in Supabase SQL Editor if your existing players table
-- does not have payment / Aadhaar columns yet.

alter table public.players
add column if not exists paid_amount numeric(12, 2) not null default 0;

alter table public.players
add column if not exists payment_screenshot_url text;

alter table public.players
add column if not exists aadhaar_card_url text;

alter table public.players
add column if not exists tshirt_size text;

alter table public.players
add column if not exists tshirt_number text;

alter table public.players
add column if not exists photo_url text;

notify pgrst, 'reload schema';
