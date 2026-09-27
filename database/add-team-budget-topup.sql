-- Adds team budget top-up/add-on tracking.
-- Run this once in Supabase SQL Editor for existing projects.

alter table public.teams
add column if not exists budget_topup_count integer not null default 0 check (budget_topup_count >= 0);

alter table public.teams
add column if not exists budget_topup_history jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
