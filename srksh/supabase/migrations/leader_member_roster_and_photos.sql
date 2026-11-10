-- ==============================================================================
-- Migration: Team Leader Member Roster Management & Photo Uploads
-- Enables Team Leaders (authenticated via Team Passcode / PIN) to:
--   1. Add new players to their team roster
--   2. Update member names and member photos
--   3. Delete members from their roster
--   4. Upload team captain photo
-- ==============================================================================

-- 1. Function: Add a member to team roster
create or replace function public.team_leader_add_member(
  p_team_id uuid,
  p_pin text,
  p_name text,
  p_photo_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_name text;
  v_new_id uuid;
  v_next_sort int;
begin
  -- Validate leader passcode
  if not exists (select 1 from public.team_credentials where team_id = p_team_id and btrim(pin) = btrim(p_pin)) then
    raise exception 'Invalid team passcode';
  end if;

  v_clean_name := btrim(p_name);
  if v_clean_name = '' then
    raise exception 'Member name cannot be blank';
  end if;

  -- Prevent duplicate names in the same team
  if exists (
    select 1 from public.team_members
    where team_id = p_team_id and lower(btrim(name)) = lower(v_clean_name)
  ) then
    raise exception 'A member with this name is already on your team roster';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_next_sort
  from public.team_members where team_id = p_team_id;

  insert into public.team_members (team_id, name, photo_path, sort_order)
  values (p_team_id, v_clean_name, p_photo_path, v_next_sort)
  returning id into v_new_id;

  return jsonb_build_object(
    'id', v_new_id,
    'name', v_clean_name,
    'photo_path', p_photo_path,
    'sort_order', v_next_sort
  );
end $$;
grant execute on function public.team_leader_add_member(uuid, text, text, text) to anon, authenticated;

-- 2. Function: Update member name and photo
create or replace function public.team_leader_update_member(
  p_team_id uuid,
  p_pin text,
  p_member_id uuid,
  p_name text,
  p_photo_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_name text;
begin
  if not exists (select 1 from public.team_credentials where team_id = p_team_id and btrim(pin) = btrim(p_pin)) then
    raise exception 'Invalid team passcode';
  end if;

  v_clean_name := btrim(p_name);
  if v_clean_name = '' then
    raise exception 'Member name cannot be blank';
  end if;

  if not exists (select 1 from public.team_members where id = p_member_id and team_id = p_team_id) then
    raise exception 'Member not found on your team roster';
  end if;

  if exists (
    select 1 from public.team_members
    where team_id = p_team_id and id <> p_member_id and lower(btrim(name)) = lower(v_clean_name)
  ) then
    raise exception 'Another member in the team already has this name';
  end if;

  update public.team_members
  set name = v_clean_name,
      photo_path = p_photo_path
  where id = p_member_id and team_id = p_team_id;

  -- Synchronize snapshot in sport_participants
  update public.sport_participants
  set player_name = v_clean_name
  where member_id = p_member_id and team_id = p_team_id;
end $$;
grant execute on function public.team_leader_update_member(uuid, text, uuid, text, text) to anon, authenticated;

-- 3. Function: Delete member from roster
create or replace function public.team_leader_delete_member(
  p_team_id uuid,
  p_pin text,
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.team_credentials where team_id = p_team_id and btrim(pin) = btrim(p_pin)) then
    raise exception 'Invalid team passcode';
  end if;

  -- Prevent deleting captain
  if exists (
    select 1 from public.teams t
    join public.team_members tm on tm.team_id = t.id and lower(btrim(tm.name)) = lower(btrim(t.captain_name))
    where tm.id = p_member_id and t.id = p_team_id
  ) then
    raise exception 'Cannot remove team captain from the roster';
  end if;

  delete from public.sport_participants where member_id = p_member_id and team_id = p_team_id;
  delete from public.team_members where id = p_member_id and team_id = p_team_id;
end $$;
grant execute on function public.team_leader_delete_member(uuid, text, uuid) to anon, authenticated;

-- 4. Function: Update Captain Photo
create or replace function public.team_leader_update_captain_photo(
  p_team_id uuid,
  p_pin text,
  p_photo_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.team_credentials where team_id = p_team_id and btrim(pin) = btrim(p_pin)) then
    raise exception 'Invalid team passcode';
  end if;

  update public.teams
  set captain_photo_path = p_photo_path,
      updated_at = now()
  where id = p_team_id;

  update public.team_members tm
  set photo_path = p_photo_path
  from public.teams t
  where t.id = p_team_id
    and tm.team_id = p_team_id
    and lower(btrim(tm.name)) = lower(btrim(t.captain_name));
end $$;
grant execute on function public.team_leader_update_captain_photo(uuid, text, text) to anon, authenticated;

-- 5. Storage policies for srksh-media bucket to allow member photo uploads
drop policy if exists "media member insert" on storage.objects;
create policy "media member insert" on storage.objects for insert
  with check (bucket_id = 'srksh-media');

drop policy if exists "media member update" on storage.objects;
create policy "media member update" on storage.objects for update
  using (bucket_id = 'srksh-media');

drop policy if exists "media member delete" on storage.objects;
create policy "media member delete" on storage.objects for delete
  using (bucket_id = 'srksh-media');
