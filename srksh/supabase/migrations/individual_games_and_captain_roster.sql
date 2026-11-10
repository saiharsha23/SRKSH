-- ============================================================
-- Migration: Individual Games & Team Leader Roster Inclusion
-- ============================================================

-- 1. Add game_type and max_participants to sports table
alter table public.sports
  add column if not exists game_type text not null default 'team',
  add column if not exists max_participants int default null;

-- Ensure check constraint on game_type
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sports_game_type_check'
  ) then
    alter table public.sports
      add constraint sports_game_type_check check (game_type in ('team', 'individual'));
  end if;
end $$;

-- 2. Synchronize all team captains into public.team_members so they are selectable
insert into public.team_members (team_id, name, photo_path, sort_order)
select t.id, t.captain_name, t.captain_photo_path, 0
from public.teams t
where not exists (
  select 1 from public.team_members tm
  where tm.team_id = t.id and lower(btrim(tm.name)) = lower(btrim(t.captain_name))
)
on conflict do nothing;

-- 3. Update team_leader_save_squad to auto-ensure captain and respect max_participants
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
  v_deadline timestamptz;
  v_game_type text;
  v_max_participants int;
  v_member record;
begin
  -- Validate PIN
  if not exists (select 1 from public.team_credentials where team_id = p_team_id and btrim(pin) = btrim(p_pin)) then
    raise exception 'Invalid team passcode';
  end if;

  -- Validate sport status, deadline, game type, and max participants
  select status, registration_deadline, coalesce(game_type, 'team'), max_participants 
  into v_status, v_deadline, v_game_type, v_max_participants 
  from public.sports where id = p_sport_id;

  if v_status is null then
    raise exception 'Sport not found';
  end if;
  if v_status = 'completed' then
    raise exception 'Cannot edit squad for a completed sport';
  end if;
  if v_deadline is not null and now() > v_deadline then
    raise exception 'The registration deadline for this sport has passed.';
  end if;

  -- Validate max participants if configured (e.g. for individual games)
  if v_max_participants is not null and p_member_ids is not null and array_length(p_member_ids, 1) > v_max_participants then
    raise exception 'Maximum % participant(s) allowed for this game', v_max_participants;
  end if;

  -- Auto-ensure team captain exists in team_members
  insert into public.team_members (team_id, name, photo_path, sort_order)
  select t.id, t.captain_name, t.captain_photo_path, 0
  from public.teams t
  where t.id = p_team_id
    and not exists (
      select 1 from public.team_members tm
      where tm.team_id = t.id and lower(btrim(tm.name)) = lower(btrim(t.captain_name))
    )
  on conflict do nothing;

  -- Auto-register team in sport if not already registered
  insert into public.sport_teams (sport_id, team_id)
  values (p_sport_id, p_team_id)
  on conflict do nothing;

  -- Remove existing participants for this team in this sport
  delete from public.sport_participants
  where sport_id = p_sport_id and team_id = p_team_id;

  -- Insert selected members from the official roster in the exact order selected by the leader
  if p_member_ids is not null and array_length(p_member_ids, 1) > 0 then
    for v_member in
      select tm.id, tm.name, ord.idx
      from unnest(p_member_ids) with ordinality as ord(id, idx)
      join public.team_members tm on tm.id = ord.id and tm.team_id = p_team_id
      order by ord.idx
    loop
      insert into public.sport_participants (
        sport_id,
        team_id,
        member_id,
        player_name,
        is_manual,
        sort_order,
        created_at
      )
      values (
        p_sport_id,
        p_team_id,
        v_member.id,
        v_member.name,
        false,
        v_member.idx,
        now() + (v_member.idx * interval '10 milliseconds')
      );
    end loop;
  end if;

end $$;
grant execute on function public.team_leader_save_squad(uuid, text, uuid, uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
