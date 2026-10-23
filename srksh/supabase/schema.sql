-- ============================================================
-- SRKSH — Supabase schema, RLS, leaderboard view, storage
-- Run this whole file once in Supabase → SQL Editor.
-- It is safe to re-run (uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- ============================================================


-- ---------- Admin profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- ---------- Site settings (single row) ----------
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  contact_email text,
  contact_phone text,
  contact_address text,
  facebook_url text,
  instagram_url text,
  youtube_url text,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict do nothing;

-- ---------- About photographs (four fixed slots) ----------
create table if not exists public.about_images (
  slot int primary key check (slot between 1 and 4),
  title text,
  caption text,
  storage_path text not null,
  updated_at timestamptz not null default now()
);

-- ---------- Gallery ----------
create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  title text,
  caption text,
  category text,
  storage_path text not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gallery_images_created_idx on public.gallery_images (created_at desc);

-- ---------- HPL editions ----------
create table if not exists public.hpl_editions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'upcoming' check (status in ('upcoming','active','completed')),
  is_current boolean not null default false,
  tie_break text not null default 'none' check (tie_break in ('none','wins')),
  created_at timestamptz not null default now()
);
-- only one current edition at a time
create unique index if not exists hpl_one_current on public.hpl_editions (is_current) where is_current;

-- ---------- Teams & members ----------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.hpl_editions(id) on delete cascade,
  name text not null,
  colour text,
  description text,
  logo_path text,
  captain_name text not null,
  captain_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists teams_name_per_edition on public.teams (edition_id, lower(name));

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  photo_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
-- prevent duplicate names within a team
create unique index if not exists members_unique_name_per_team on public.team_members (team_id, lower(btrim(name)));

-- ---------- Sports ----------
create table if not exists public.sports (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.hpl_editions(id) on delete cascade,
  name text not null,
  category text,
  description text,
  image_path text,
  status text not null default 'upcoming' check (status in ('upcoming','in_progress','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- teams participating in a sport
create table if not exists public.sport_teams (
  sport_id uuid not null references public.sports(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  primary key (sport_id, team_id)
);

-- players participating (a player may be in many sports)
create table if not exists public.sport_participants (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null,
  team_id uuid not null,
  member_id uuid references public.team_members(id) on delete set null,
  player_name text not null,            -- snapshot so history survives roster edits
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (sport_id, team_id) references public.sport_teams(sport_id, team_id) on delete cascade
);
create unique index if not exists participants_unique_member on public.sport_participants (sport_id, member_id) where member_id is not null;
create unique index if not exists participants_unique_manual on public.sport_participants (sport_id, team_id, lower(player_name)) where member_id is null;

-- ---------- Results: exactly one authoritative result per sport ----------
create table if not exists public.sport_results (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null unique references public.sports(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','completed')),
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.result_placements (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.sport_results(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,  -- protects history
  placement int not null check (placement >= 1),
  points numeric(8,2) check (points is null or points >= 0),
  unique (result_id, placement),   -- one team per placement
  unique (result_id, team_id)      -- a team cannot place twice => no double counting
);

-- A placed team must be a participant of that sport
create or replace function public.check_placement_participant()
returns trigger language plpgsql as $$
declare v_sport uuid;
begin
  select sport_id into v_sport from public.sport_results where id = new.result_id;
  if not exists (select 1 from public.sport_teams st where st.sport_id = v_sport and st.team_id = new.team_id) then
    raise exception 'Team is not a participant in this sport. Add it as a participant first.';
  end if;
  return new;
end $$;
drop trigger if exists trg_check_placement on public.result_placements;
create trigger trg_check_placement before insert or update on public.result_placements
  for each row execute function public.check_placement_participant();

-- ---------- Leaderboard (derived — never manually edited) ----------
-- Only COMPLETED results count. Competition ranking (1,1,3).
-- Optional tie-break (edition setting): 'wins' ranks by number of wins when points tie.
create or replace view public.leaderboard
with (security_invoker = true) as
with agg as (
  select
    t.id as team_id,
    t.edition_id,
    t.name as team_name,
    t.colour,
    t.logo_path,
    t.captain_name,
    t.captain_photo_path,
    coalesce(sum(rp.points) filter (where r.status = 'completed'), 0)::numeric as total_points,
    count(*) filter (where r.status = 'completed' and rp.placement = 1) as wins,
    count(*) filter (where r.status = 'completed' and rp.placement = 2) as runner_ups,
    e.tie_break
  from public.teams t
  join public.hpl_editions e on e.id = t.edition_id
  left join public.result_placements rp on rp.team_id = t.id
  left join public.sport_results r on r.id = rp.result_id
  group by t.id, e.tie_break
)
select
  team_id, edition_id, team_name, colour, logo_path, captain_name, captain_photo_path,
  total_points, wins, runner_ups,
  rank() over (
    partition by edition_id
    order by total_points desc, (case when tie_break = 'wins' then wins else 0 end) desc
  ) as rank
from agg;


-- ---------- Atomic result save (one authoritative result per sport) ----------
-- Replaces the sport's placements in a single transaction so totals can never be double-counted
-- and a failed save leaves the previous result untouched. Runs with the caller's RLS rights.
create or replace function public.save_sport_result(p_sport_id uuid, p_status text, p_notes text, p_placements jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_id uuid; r jsonb;
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  if p_status not in ('pending','completed') then raise exception 'Invalid result status'; end if;
  insert into public.sport_results (sport_id, status, notes, updated_at)
  values (p_sport_id, p_status, p_notes, now())
  on conflict (sport_id) do update set status = excluded.status, notes = excluded.notes, updated_at = now()
  returning id into v_id;

  delete from public.result_placements where result_id = v_id;
  for r in select * from jsonb_array_elements(coalesce(p_placements, '[]'::jsonb)) loop
    insert into public.result_placements (result_id, team_id, placement, points)
    values (v_id, (r->>'team_id')::uuid, (r->>'placement')::int, nullif(r->>'points','')::numeric);
  end loop;

  if p_status = 'completed' then
    if not exists (select 1 from public.result_placements where result_id = v_id) then
      raise exception 'A completed result needs at least a winner.';
    end if;
    update public.sports set status = 'completed', updated_at = now() where id = p_sport_id;
  end if;
  return v_id;
end $$;
grant execute on function public.save_sport_result(uuid, text, text, jsonb) to authenticated;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.about_images enable row level security;
alter table public.gallery_images enable row level security;
alter table public.hpl_editions enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.sports enable row level security;
alter table public.sport_teams enable row level security;
alter table public.sport_participants enable row level security;
alter table public.sport_results enable row level security;
alter table public.result_placements enable row level security;

-- profiles: a signed-in user can read only their own row; nobody can write from the client
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select using (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'site_settings','about_images','gallery_images','hpl_editions','teams','team_members',
    'sports','sport_teams','sport_participants','sport_results','result_placements'
  ] loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select using (true)', t);
    execute format('drop policy if exists "admin insert" on public.%I', t);
    execute format('create policy "admin insert" on public.%I for insert with check (public.is_admin())', t);
    execute format('drop policy if exists "admin update" on public.%I', t);
    execute format('create policy "admin update" on public.%I for update using (public.is_admin()) with check (public.is_admin())', t);
    execute format('drop policy if exists "admin delete" on public.%I', t);
    execute format('create policy "admin delete" on public.%I for delete using (public.is_admin())', t);
  end loop;
end $$;

-- the view runs with the caller's rights; make sure anon/authenticated can read it
grant select on public.leaderboard to anon, authenticated;

-- ---------- Storage ----------
-- Public bucket (anyone can VIEW images), 5 MB limit, images only. Only admins can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('srksh-media', 'srksh-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'srksh-media');
drop policy if exists "media admin insert" on storage.objects;
create policy "media admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'srksh-media' and public.is_admin());
drop policy if exists "media admin update" on storage.objects;
create policy "media admin update" on storage.objects for update to authenticated
  using (bucket_id = 'srksh-media' and public.is_admin());
drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'srksh-media' and public.is_admin());

-- ---------- Team credentials (Leader Passcode / PIN) ----------
create table if not exists public.team_credentials (
  team_id uuid primary key references public.teams(id) on delete cascade,
  pin text not null,
  updated_at timestamptz not null default now()
);

alter table public.team_credentials enable row level security;

drop policy if exists "admin read team_credentials" on public.team_credentials;
create policy "admin read team_credentials" on public.team_credentials
  for select using (public.is_admin());

drop policy if exists "admin write team_credentials" on public.team_credentials;
create policy "admin write team_credentials" on public.team_credentials
  for all using (public.is_admin()) with check (public.is_admin());

-- 1. Verify team leader PIN
create or replace function public.verify_team_leader_pin(p_team_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.team_credentials
    where team_id = p_team_id and btrim(pin) = btrim(p_pin)
  );
end $$;
grant execute on function public.verify_team_leader_pin(uuid, text) to anon, authenticated;

-- 2. Admin set/update team PIN
create or replace function public.admin_set_team_pin(p_team_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  insert into public.team_credentials (team_id, pin, updated_at)
  values (p_team_id, btrim(p_pin), now())
  on conflict (team_id) do update set pin = excluded.pin, updated_at = now();
end $$;
grant execute on function public.admin_set_team_pin(uuid, text) to authenticated;

-- 3. Team leader register / unregister sport
create or replace function public.team_leader_register_sport(
  p_team_id uuid,
  p_pin text,
  p_sport_id uuid,
  p_register boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_has_placement boolean;
begin
  if not exists (select 1 from public.team_credentials where team_id = p_team_id and btrim(pin) = btrim(p_pin)) then
    raise exception 'Invalid team passcode';
  end if;

  select status into v_status from public.sports where id = p_sport_id;
  if v_status is null then
    raise exception 'Sport not found';
  end if;
  if v_status = 'completed' then
    raise exception 'Cannot change registration for a completed sport';
  end if;

  if p_register then
    insert into public.sport_teams (sport_id, team_id)
    values (p_sport_id, p_team_id)
    on conflict do nothing;
  else
    select exists (
      select 1 from public.result_placements rp
      join public.sport_results sr on sr.id = rp.result_id
      where sr.sport_id = p_sport_id and rp.team_id = p_team_id
    ) into v_has_placement;

    if v_has_placement then
      raise exception 'Cannot unregister: team already has a placement in this sport result';
    end if;

    delete from public.sport_participants where sport_id = p_sport_id and team_id = p_team_id;
    delete from public.sport_teams where sport_id = p_sport_id and team_id = p_team_id;
  end if;
end $$;
grant execute on function public.team_leader_register_sport(uuid, text, uuid, boolean) to anon, authenticated;

-- 4. Team leader save squad selection
create or replace function public.team_leader_save_squad(
  p_team_id uuid,
  p_pin text,
  p_sport_id uuid,
  p_member_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_member record;
begin
  if not exists (select 1 from public.team_credentials where team_id = p_team_id and btrim(pin) = btrim(p_pin)) then
    raise exception 'Invalid team passcode';
  end if;

  select status into v_status from public.sports where id = p_sport_id;
  if v_status is null then
    raise exception 'Sport not found';
  end if;
  if v_status = 'completed' then
    raise exception 'Cannot edit squad for a completed sport';
  end if;

  insert into public.sport_teams (sport_id, team_id)
  values (p_sport_id, p_team_id)
  on conflict do nothing;

  -- Remove existing participants for this team in this sport
  delete from public.sport_participants
  where sport_id = p_sport_id and team_id = p_team_id;

  -- Insert selected members from the official roster in the exact order selected by the leader
  if p_member_ids is not null and array_length(p_member_ids, 1) > 0 then
    for v_member in
      select tm.id, tm.name
      from unnest(p_member_ids) with ordinality as ord(id, idx)
      join public.team_members tm on tm.id = ord.id and tm.team_id = p_team_id
      order by ord.idx
    loop
      insert into public.sport_participants (sport_id, team_id, member_id, player_name, is_manual)
      values (p_sport_id, p_team_id, v_member.id, v_member.name, false);
    end loop;
  end if;

end $$;
grant execute on function public.team_leader_save_squad(uuid, text, uuid, uuid[]) to anon, authenticated;

-- ============================================================
-- AFTER running this file, create your admin (see README):
--   1. Supabase → Authentication → Users → "Add user" (email + password, auto-confirm).
--   2. Run in SQL Editor (replace the email):
--        insert into public.profiles (id, email)
--        select id, email from auth.users where email = 'you@example.com';
--   3. Authentication → Sign In / Providers → turn OFF "Allow new users to sign up".
-- ============================================================

