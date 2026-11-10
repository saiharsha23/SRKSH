-- ============================================================
-- Migration: Cricket Scoring Engine (Ball-by-Ball & Live Scorecards)
-- ============================================================

create table if not exists public.cricket_matches (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.sport_matches(id) on delete cascade unique,
  overs_limit int not null default 15,
  toss_winner_team_id uuid references public.teams(id) on delete set null,
  toss_decision text check (toss_decision in ('bat', 'field') or toss_decision is null),
  current_innings int not null default 1 check (current_innings in (1, 2)),
  batting_first_team_id uuid references public.teams(id) on delete set null,
  striker_name text,
  non_striker_name text,
  bowler_name text,
  status text not null default 'innings1' check (status in ('not_started', 'innings1', 'break', 'innings2', 'completed')),
  target_runs int,
  innings1_runs int not null default 0,
  innings1_wickets int not null default 0,
  innings1_legal_balls int not null default 0,
  innings2_runs int not null default 0,
  innings2_wickets int not null default 0,
  innings2_legal_balls int not null default 0,
  winner_team_id uuid references public.teams(id) on delete set null,
  result_summary text,
  player_of_match text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.cricket_deliveries (
  id uuid primary key default gen_random_uuid(),
  cricket_match_id uuid not null references public.cricket_matches(id) on delete cascade,
  innings int not null default 1 check (innings in (1, 2)),
  over_number int not null default 0,
  ball_in_over int not null default 0,
  striker_name text not null,
  non_striker_name text not null,
  bowler_name text not null,
  runs_batter int not null default 0,
  is_extra boolean not null default false,
  extra_type text check (extra_type in ('wide', 'no_ball', 'bye', 'leg_bye', 'penalty') or extra_type is null),
  extra_runs int not null default 0,
  is_wicket boolean not null default false,
  wicket_type text check (wicket_type in ('bowled', 'caught', 'run_out', 'stumped', 'lbw', 'hit_wicket') or wicket_type is null),
  player_dismissed text,
  fielder_name text,
  commentary text,
  created_at timestamptz default now()
);

-- Indexes for lightning fast queries
create index if not exists idx_cricket_matches_match_id on public.cricket_matches(match_id);
create index if not exists idx_cricket_deliveries_match on public.cricket_deliveries(cricket_match_id, innings, over_number);

-- Enable RLS
alter table public.cricket_matches enable row level security;
alter table public.cricket_deliveries enable row level security;

-- Policies for cricket_matches
drop policy if exists "Public read cricket_matches" on public.cricket_matches;
create policy "Public read cricket_matches" on public.cricket_matches for select using (true);

drop policy if exists "Admin insert cricket_matches" on public.cricket_matches;
create policy "Admin insert cricket_matches" on public.cricket_matches for insert with check (public.is_admin());

drop policy if exists "Admin update cricket_matches" on public.cricket_matches;
create policy "Admin update cricket_matches" on public.cricket_matches for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin delete cricket_matches" on public.cricket_matches;
create policy "Admin delete cricket_matches" on public.cricket_matches for delete using (public.is_admin());

-- Policies for cricket_deliveries
drop policy if exists "Public read cricket_deliveries" on public.cricket_deliveries;
create policy "Public read cricket_deliveries" on public.cricket_deliveries for select using (true);

drop policy if exists "Admin insert cricket_deliveries" on public.cricket_deliveries;
create policy "Admin insert cricket_deliveries" on public.cricket_deliveries for insert with check (public.is_admin());

drop policy if exists "Admin update cricket_deliveries" on public.cricket_deliveries;
create policy "Admin update cricket_deliveries" on public.cricket_deliveries for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin delete cricket_deliveries" on public.cricket_deliveries;
create policy "Admin delete cricket_deliveries" on public.cricket_deliveries for delete using (public.is_admin());

-- Permissions
grant select on public.cricket_matches to anon, authenticated;
grant all on public.cricket_matches to authenticated;
grant select on public.cricket_deliveries to anon, authenticated;
grant all on public.cricket_deliveries to authenticated;

-- Enable Supabase Realtime for live delivery events
do $$
begin
  alter publication supabase_realtime add table public.cricket_matches;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.cricket_deliveries;
exception when others then null;
end $$;

notify pgrst, 'reload schema';

