-- ============================================================
-- SRKSH — Team Leader Portal Migration
-- Adds team passcodes, authentication verification,
-- sport registration and roster squad selection RPCs.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- ---------- Team credentials (Leader Passcode / PIN) ----------
create table if not exists public.team_credentials (
  team_id uuid primary key references public.teams(id) on delete cascade,
  pin text not null,
  updated_at timestamptz not null default now()
);

alter table public.team_credentials enable row level security;

-- Only admins can directly select / update credentials via client API
drop policy if exists "admin read team_credentials" on public.team_credentials;
create policy "admin read team_credentials" on public.team_credentials
  for select using (public.is_admin());

drop policy if exists "admin write team_credentials" on public.team_credentials;
create policy "admin write team_credentials" on public.team_credentials
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- 1. Verify team leader PIN ----------
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

-- ---------- 2. Admin set/update team PIN ----------
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

-- ---------- 3. Team leader register / unregister sport ----------
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
  -- Validate PIN
  if not exists (select 1 from public.team_credentials where team_id = p_team_id and btrim(pin) = btrim(p_pin)) then
    raise exception 'Invalid team passcode';
  end if;

  -- Validate sport
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

-- ---------- 4. Team leader save squad selection ----------
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
  -- Validate PIN
  if not exists (select 1 from public.team_credentials where team_id = p_team_id and btrim(pin) = btrim(p_pin)) then
    raise exception 'Invalid team passcode';
  end if;

  -- Validate sport status
  select status into v_status from public.sports where id = p_sport_id;
  if v_status is null then
    raise exception 'Sport not found';
  end if;
  if v_status = 'completed' then
    raise exception 'Cannot edit squad for a completed sport';
  end if;

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
