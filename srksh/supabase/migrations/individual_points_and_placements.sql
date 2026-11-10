-- ============================================================
-- Migration: Support Multiple Placements per Team for Individual Games
-- ============================================================

-- 1. Add player_name to result_placements
alter table public.result_placements
  add column if not exists player_name text;

-- 2. Drop the unique (result_id, team_id) constraint so multiple contestants
-- from the same team can place (e.g. 1st and 2nd place from the same team)
do $$
declare con record;
begin
  for con in (
    select constraint_name 
    from information_schema.table_constraints 
    where table_name = 'result_placements' 
      and constraint_type = 'UNIQUE'
      and constraint_name like '%team_id%'
  ) loop
    execute format('alter table public.result_placements drop constraint if exists %I', con.constraint_name);
  end loop;
end $$;

-- 3. Update save_sport_result to store player_name
create or replace function public.save_sport_result(
  p_sport_id uuid,
  p_status text,
  p_notes text,
  p_placements jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  r jsonb;
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  if p_status not in ('pending','completed') then raise exception 'Invalid status'; end if;

  insert into public.sport_results (sport_id, status, notes, updated_at)
  values (p_sport_id, p_status, p_notes, now())
  on conflict (sport_id) do update set status = excluded.status, notes = excluded.notes, updated_at = now()
  returning id into v_id;

  delete from public.result_placements where result_id = v_id;
  for r in select * from jsonb_array_elements(coalesce(p_placements, '[]'::jsonb)) loop
    insert into public.result_placements (result_id, team_id, placement, points, player_name)
    values (
      v_id,
      (r->>'team_id')::uuid,
      (r->>'placement')::int,
      nullif(r->>'points','')::numeric,
      nullif(r->>'player_name','')
    );
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

notify pgrst, 'reload schema';

