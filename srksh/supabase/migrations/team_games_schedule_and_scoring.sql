-- ============================================================
-- Migration: Tournament Schedule & Sport-Specific Scoring Engine
-- ============================================================

create table if not exists public.sport_matches (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id) on delete cascade,
  team_a_id uuid references public.teams(id) on delete set null,
  team_b_id uuid references public.teams(id) on delete set null,
  round_name text not null default 'Match',
  match_number int not null default 1,
  scheduled_date text,
  scheduled_time text,
  venue text,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  winner_team_id uuid references public.teams(id) on delete set null,
  score_data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for speedy queries by sport and teams
create index if not exists idx_sport_matches_sport_id on public.sport_matches(sport_id);
create index if not exists idx_sport_matches_teams on public.sport_matches(team_a_id, team_b_id);

-- Enable RLS
alter table public.sport_matches enable row level security;

-- Policies
drop policy if exists "Public can read sport matches" on public.sport_matches;
create policy "Public can read sport matches"
  on public.sport_matches for select
  using (true);

drop policy if exists "Admins can insert sport matches" on public.sport_matches;
create policy "Admins can insert sport matches"
  on public.sport_matches for insert
  with check (public.is_admin());

drop policy if exists "Admins can update sport matches" on public.sport_matches;
create policy "Admins can update sport matches"
  on public.sport_matches for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete sport matches" on public.sport_matches;
create policy "Admins can delete sport matches"
  on public.sport_matches for delete
  using (public.is_admin());

-- Permissions
grant select on public.sport_matches to anon, authenticated;
grant all on public.sport_matches to authenticated;

notify pgrst, 'reload schema';
