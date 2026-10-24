import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Check, Clock, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase, uploadImage, removeImage, imageUrl } from '../../lib/supabase'
import { useHpl, type SportBundle } from '../../lib/data'
import type { Sport, SportStatus, Team } from '../../types'
import { Badge, ConfirmDialog, EmptyState, ErrorBox, Img, Modal, Spinner, useToast, ColourDot } from '../../components/ui'
import { Field, ImageField, PageTitle, errMsg } from './common'
import { fmtDateTime, fmtPoints, isDeadlinePassed, ordinal, toLocalIso } from '../../lib/format'

/* ---------- Sport create / edit form ---------- */
function SportForm({ sport, editionId, onClose, onSaved }: { sport: Sport | null; editionId: string; onClose: () => void; onSaved: (id: string) => void }) {
  const toast = useToast()

  const [name, setName] = useState(sport?.name ?? '')
  const [category, setCategory] = useState(sport?.category ?? '')
  const [description, setDescription] = useState(sport?.description ?? '')
  const [status, setStatus] = useState<SportStatus>(sport?.status ?? 'upcoming')
  const [deadline, setDeadline] = useState(toLocalIso(sport?.registration_deadline))
  const [img, setImg] = useState<File | null>(null); const [imgRm, setImgRm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function applyPreset(preset: 'today_6pm' | 'today_midnight' | 'tomorrow_6pm' | 'in_2days_6pm') {
    const d = new Date()
    if (preset === 'today_6pm') {
      d.setHours(18, 0, 0, 0)
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
    } else if (preset === 'today_midnight') {
      d.setHours(23, 59, 0, 0)
    } else if (preset === 'tomorrow_6pm') {
      d.setDate(d.getDate() + 1)
      d.setHours(18, 0, 0, 0)
    } else if (preset === 'in_2days_6pm') {
      d.setDate(d.getDate() + 2)
      d.setHours(18, 0, 0, 0)
    }
    setDeadline(toLocalIso(d.toISOString()))
  }

  async function save() {
    if (!name.trim()) { setErr('Sport name is required.'); return }
    setErr(''); setBusy(true)
    let uploaded: string | null = null
    try {
      let image_path = sport?.image_path ?? null
      const old = image_path
      if (img) { uploaded = await uploadImage(img, 'sports'); image_path = uploaded }
      else if (imgRm) image_path = null
      const registration_deadline = deadline ? new Date(deadline).toISOString() : null
      const payload = {
        name: name.trim(),
        category: category.trim() || null,
        description: description.trim() || null,
        status,
        registration_deadline,
        image_path,
        updated_at: new Date().toISOString(),
      }
      let id = sport?.id
      if (id) { const { error } = await supabase.from('sports').update(payload).eq('id', id); if (error) throw error }
      else { const { data, error } = await supabase.from('sports').insert({ ...payload, edition_id: editionId }).select('id').single(); if (error) throw error; id = data.id }
      if (old && old !== image_path) await removeImage(old)
      toast('success', sport ? 'Sport updated.' : 'Sport created.')
      onSaved(id!)
    } catch (e) { if (uploaded) await removeImage(uploaded); toast('error', `Could not save: ${errMsg(e)}`) } finally { setBusy(false) }
  }
  return (
    <Modal open title={sport ? `Edit ${sport.name}` : 'Add sport'} onClose={onClose}>
      <form className="space-y-4" noValidate onSubmit={e => { e.preventDefault(); void save() }}>
        {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</p>}
        <Field label="Sport name *"><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cricket" required /></Field>
        <Field label="Type / category (optional)"><input className="input" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Outdoor, Indoor, Cultural" /></Field>
        <Field label="Description (optional)"><textarea className="input" rows={3} value={description} onChange={e => setDescription(e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <select className="input" value={status} onChange={e => setStatus(e.target.value as SportStatus)}>
              <option value="upcoming">Upcoming</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
            </select>
          </Field>
          <Field label="Registration deadline (optional)" hint="Captains cannot register after this">
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  className="input text-xs"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                />
                {deadline && (
                  <button type="button" className="btn-outline btn-sm text-xs px-2" onClick={() => setDeadline('')}>
                    Clear
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <button type="button" onClick={() => applyPreset('today_6pm')} className="rounded-md bg-sand/40 px-2 py-0.5 text-[10px] text-bark hover:bg-sand">
                  Today 6 PM
                </button>
                <button type="button" onClick={() => applyPreset('today_midnight')} className="rounded-md bg-sand/40 px-2 py-0.5 text-[10px] text-bark hover:bg-sand">
                  Tonight 11:59 PM
                </button>
                <button type="button" onClick={() => applyPreset('tomorrow_6pm')} className="rounded-md bg-sand/40 px-2 py-0.5 text-[10px] text-bark hover:bg-sand">
                  Tomorrow 6 PM
                </button>
                <button type="button" onClick={() => applyPreset('in_2days_6pm')} className="rounded-md bg-sand/40 px-2 py-0.5 text-[10px] text-bark hover:bg-sand">
                  +2 Days
                </button>
              </div>
            </div>
          </Field>
        </div>
        <ImageField label="Sport image / icon (optional)" existingPath={sport?.image_path} file={img} onFile={setImg} removed={imgRm} onRemove={() => setImgRm(true)} />
        <div className="flex justify-end gap-3 border-t border-sand pt-4">
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Sports list ---------- */
export default function Sports() {
  const { data, loading, error, reload } = useHpl()
  const [adding, setAdding] = useState(false)
  const nav = useNavigate()
  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!data.edition) return <EmptyState title="No HPL edition yet" text="Create an edition in Settings first." />
  const { bundle } = data
  return (
    <>
      <PageTitle title="Sports" text={`${data.edition.name} · ${bundle.sports.length} sport(s)`} action={<button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add sport</button>} />
      {!bundle.sports.length ? <EmptyState title="No sports yet" text="Click Add Sport to create the first one — there is no fixed list." /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {bundle.sports.map(s => {
            const res = bundle.results.find(r => r.sport_id === s.id)
            return (
              <Link key={s.id} to={`/admin/sports/${s.id}`} className="card block transition hover:-translate-y-1">
                <div className="flex items-center gap-3">
                  <Img src={imageUrl(s.image_path)} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1"><h2 className="truncate text-2xl font-semibold">{s.name}</h2><p className="text-xs text-bark-soft">{s.category || 'Sport'}</p></div>
                  <Badge status={s.status} />
                </div>
                <p className="mt-4 text-sm text-bark-soft">{bundle.sportTeams.filter(t => t.sport_id === s.id).length} team(s) · {bundle.participants.filter(p => p.sport_id === s.id).length} player(s) · Result: {res?.status === 'completed' ? 'Completed' : 'Pending'}</p>
                {s.registration_deadline ? (
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    <Clock className={`h-3.5 w-3.5 shrink-0 ${isDeadlinePassed(s.registration_deadline) ? 'text-red-600' : 'text-terracotta'}`} />
                    <span className={isDeadlinePassed(s.registration_deadline) ? 'font-semibold text-red-700' : 'font-medium text-bark-soft'}>
                      {isDeadlinePassed(s.registration_deadline) ? 'Closed: ' : 'Deadline: '}
                      {fmtDateTime(s.registration_deadline)}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-bark-faint">
                    <Clock className="h-3.5 w-3.5 text-sand" />
                    <span>No deadline set (Open)</span>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
      {adding && <SportForm sport={null} editionId={data.edition.id} onClose={() => setAdding(false)} onSaved={id => nav(`/admin/sports/${id}`)} />}
    </>
  )
}

/* ---------- Participants for one team ---------- */
function TeamParticipants({ sport, team, bundle, onChanged, canRemoveTeam }: { sport: Sport; team: Team; bundle: SportBundle; onChanged: () => void; canRemoveTeam: boolean }) {
  const toast = useToast()
  const roster = team.team_members ?? []
  const saved = bundle.participants.filter(p => p.sport_id === sport.id && p.team_id === team.id)
  const savedMemberIds = new Set(saved.filter(p => p.member_id).map(p => p.member_id as string))
  const [checked, setChecked] = useState<Set<string>>(new Set(savedMemberIds))
  const [editing, setEditing] = useState(false)
  const [q, setQ] = useState('')
  const [manual, setManual] = useState('')
  const [confirmManual, setConfirmManual] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const manualSaved = saved.filter(p => !p.member_id)

  async function savePlayers() {
    setBusy(true)
    try {
      const toAdd = roster.filter(m => checked.has(m.id) && !savedMemberIds.has(m.id))
      const toRemove = saved.filter(p => p.member_id && !checked.has(p.member_id)).map(p => p.id)
      if (toRemove.length) { const { error } = await supabase.from('sport_participants').delete().in('id', toRemove); if (error) throw error }
      if (toAdd.length) {
        const { error } = await supabase.from('sport_participants').insert(toAdd.map(m => ({ sport_id: sport.id, team_id: team.id, member_id: m.id, player_name: m.name, is_manual: false })))
        if (error) throw error
      }
      toast('success', `${team.name} players saved.`); setEditing(false); onChanged()
    } catch (e) { toast('error', errMsg(e)) } finally { setBusy(false) }
  }
  async function addManual() {
    const name = manual.trim(); if (!name) return
    setBusy(true)
    try {
      // if the name matches a roster member, link it instead of creating a duplicate manual entry
      const match = roster.find(m => m.name.trim().toLowerCase() === name.toLowerCase())
      const row: { sport_id: string; team_id: string; member_id: string | null; player_name: string; is_manual: boolean } = match
        ? { sport_id: sport.id, team_id: team.id, member_id: match.id, player_name: match.name, is_manual: false }
        : { sport_id: sport.id, team_id: team.id, member_id: null, player_name: name, is_manual: true }
      const { error } = await supabase.from('sport_participants').insert(row); if (error) throw error
      toast('success', `${row.player_name} added.`); setManual(''); setConfirmManual(false); onChanged()
    } catch (e) { toast('error', /duplicate|unique/i.test(errMsg(e)) ? 'That player is already added.' : errMsg(e)) } finally { setBusy(false) }
  }
  async function removeOne(id: string) {
    const { error } = await supabase.from('sport_participants').delete().eq('id', id)
    if (error) toast('error', error.message); else { toast('success', 'Player removed.'); onChanged() }
  }
  async function removeTeam() {
    setBusy(true)
    try {
      const { error } = await supabase.from('sport_teams').delete().eq('sport_id', sport.id).eq('team_id', team.id); if (error) throw error
      toast('success', `${team.name} removed from ${sport.name}.`); setConfirmRemove(false); onChanged()
    } catch (e) { toast('error', errMsg(e)) } finally { setBusy(false) }
  }
  const shown = roster.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
  const manualNotOnRoster = manual.trim() && !roster.some(m => m.name.trim().toLowerCase() === manual.trim().toLowerCase())

  return (
    <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-sand">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 font-serif text-xl font-semibold"><ColourDot colour={team.colour} />{team.name} <span className="text-sm font-normal text-bark-soft">({saved.length} players)</span></h4>
        <div className="flex gap-2">
          <button className="btn-outline btn-sm" onClick={() => { setChecked(new Set(savedMemberIds)); setEditing(e => !e) }}><Pencil className="h-3 w-3" />{editing ? 'Close' : 'Edit participants'}</button>
          <button className="btn-sm inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs text-red-700 hover:bg-red-50" onClick={() => setConfirmRemove(true)} disabled={!canRemoveTeam} title={canRemoveTeam ? '' : 'Team has a placement in this sport’s result — remove it there first'}><Trash2 className="h-3 w-3" />Remove team</button>
        </div>
      </div>
      {!editing && (saved.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {saved.map(p => (
            <li key={p.id} className="group inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-sm">
              {p.player_name}{p.is_manual && <span className="text-[10px] text-terracotta" title="Added manually (not linked to roster)">manual</span>}
              <button aria-label={`Remove ${p.player_name}`} className="text-bark-faint hover:text-red-700" onClick={() => void removeOne(p.id)}>×</button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-bark-faint">No players selected yet.</p>)}
      {editing && (
        <div className="mt-3">
          <input className="input mb-2" placeholder="Search roster…" aria-label="Search roster" value={q} onChange={e => setQ(e.target.value)} />
          <div className="mb-2 flex gap-3 text-xs"><button className="underline" onClick={() => setChecked(new Set(roster.map(m => m.id)))}>Select all</button><button className="underline" onClick={() => setChecked(new Set())}>Clear</button></div>
          {roster.length ? (
            <ul className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
              {shown.map(m => (
                <li key={m.id}><label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-cream">
                  <input type="checkbox" checked={checked.has(m.id)} onChange={() => setChecked(c => { const n = new Set(c); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n })} />{m.name}</label></li>
              ))}
            </ul>
          ) : <p className="text-sm text-bark-soft">This team has no roster members yet. Add them under Teams, or add a player manually below.</p>}
          <div className="mt-3 flex justify-end gap-2"><button className="btn-outline btn-sm" onClick={() => setEditing(false)} disabled={busy}>Cancel</button><button className="btn-primary btn-sm" onClick={() => void savePlayers()} disabled={busy}>{busy && <Loader2 className="h-3 w-3 animate-spin" />}Save players</button></div>
        </div>
      )}
      <div className="mt-4 border-t border-sand pt-3">
        <label className="label" htmlFor={`manual-${team.id}`}>Add a player manually</label>
        <div className="flex gap-2">
          <input id={`manual-${team.id}`} className="input" placeholder="Player name" value={manual} onChange={e => setManual(e.target.value)} />
          <button className="btn-outline btn-sm" disabled={!manual.trim() || busy} onClick={() => (manualNotOnRoster ? setConfirmManual(true) : void addManual())}>Add</button>
        </div>
        {manualNotOnRoster && <p className="mt-1 text-xs text-terracotta-deep">“{manual.trim()}” is not on {team.name}'s roster.</p>}
        {manualSaved.length > 0 && <p className="mt-1 text-xs text-bark-faint">{manualSaved.length} manually added player(s) are not linked to the roster.</p>}
      </div>
      <ConfirmDialog open={confirmManual} busy={busy} confirmLabel="Add anyway" title="Player not on roster" message={`“${manual.trim()}” is not in ${team.name}'s saved roster. Add them to this sport anyway? They will be marked as a manual entry.`} onCancel={() => setConfirmManual(false)} onConfirm={() => void addManual()} />
      <ConfirmDialog open={confirmRemove} busy={busy} confirmLabel="Remove team" title={`Remove ${team.name}?`} message="The team and its selected players will be removed from this sport." onCancel={() => setConfirmRemove(false)} onConfirm={() => void removeTeam()} />
    </div>
  )
}

/* ---------- Results & points editor ---------- */
interface Row { key: string; team_id: string; points: string }
function ResultEditor({ sport, teams, bundle, onChanged }: { sport: Sport; teams: Team[]; bundle: SportBundle; onChanged: () => void }) {
  const toast = useToast()
  const result = bundle.results.find(r => r.sport_id === sport.id)
  const savedPl = result ? bundle.placements.filter(p => p.result_id === result.id).sort((a, b) => a.placement - b.placement) : []
  const participating = teams.filter(t => bundle.sportTeams.some(st => st.sport_id === sport.id && st.team_id === t.id))
  const init = (): Row[] => {
    const rows: Row[] = savedPl.map(p => ({ key: p.id, team_id: p.team_id, points: p.points == null ? '' : String(p.points) }))
    while (rows.length < 2) rows.push({ key: crypto.randomUUID(), team_id: '', points: '' })
    return rows
  }
  const [rows, setRows] = useState<Row[]>(init)
  const [status, setStatus] = useState<'pending' | 'completed'>(result?.status ?? 'pending')
  const [notes, setNotes] = useState(result?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)
  const [errs, setErrs] = useState<string[]>([])
  const label = (i: number) => (i === 0 ? 'Winning team' : i === 1 ? 'Runner-up team' : `${ordinal(i + 1)} place team`)

  function validate() {
    const e: string[] = []
    const filled = rows.filter(r => r.team_id)
    const ids = filled.map(r => r.team_id)
    if (new Set(ids).size !== ids.length) e.push('The same team cannot hold two placements (winner and runner-up must be different).')
    rows.forEach((r, i) => {
      if (!r.team_id && r.points !== '') e.push(`Choose a team for ${label(i).toLowerCase()} or clear its points.`)
      if (r.points !== '' && (isNaN(Number(r.points)) || Number(r.points) < 0)) e.push(`Points for ${label(i).toLowerCase()} must be a number of 0 or more.`)
    })
    if (rows[1]?.team_id && !rows[0]?.team_id) e.push('Choose a winning team before a runner-up.')
    if (status === 'completed' && !rows[0]?.team_id) e.push('A completed result needs at least a winning team.')
    return e
  }
  async function save() {
    setBusy(true); setConfirmSave(false)
    try {
      // placement = position among the *rows*, so winner/runner-up always map to 1/2
      const placements = rows.map((r, i) => ({ r, i })).filter(x => x.r.team_id).map(x => ({ team_id: x.r.team_id, placement: x.i + 1, points: x.r.points === '' ? null : Number(x.r.points) }))
      const { error } = await supabase.rpc('save_sport_result', { p_sport_id: sport.id, p_status: status, p_notes: notes.trim() || null, p_placements: placements })
      if (error) throw error
      toast('success', status === 'completed' ? 'Result saved and leaderboard updated.' : 'Result saved as pending.'); onChanged()
    } catch (e) { toast('error', `Could not save result: ${errMsg(e)}`) } finally { setBusy(false) }
  }
  function onSave() {
    const e = validate(); setErrs(e); if (e.length) return
    if (result?.status === 'completed') setConfirmSave(true); else void save()
  }
  async function reset() {
    if (!result) return
    setBusy(true)
    try {
      const { error } = await supabase.from('sport_results').delete().eq('id', result.id); if (error) throw error
      if (sport.status === 'completed') await supabase.from('sports').update({ status: 'in_progress' }).eq('id', sport.id)
      setRows([{ key: 'a', team_id: '', points: '' }, { key: 'b', team_id: '', points: '' }]); setStatus('pending'); setNotes('')
      toast('success', 'Result reset. The leaderboard has been recalculated.'); setConfirmReset(false); onChanged()
    } catch (e) { toast('error', errMsg(e)) } finally { setBusy(false) }
  }
  const setRow = (key: string, patch: Partial<Row>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)))

  if (!participating.length) return <p className="rounded-2xl bg-cream/70 p-4 text-sm text-bark-soft">Add at least one participating team above before recording a result. Only participating teams can be placed.</p>
  return (
    <div>
      {errs.length > 0 && <ul role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{errs.map(x => <li key={x}>• {x}</li>)}</ul>}
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.key} className="grid items-end gap-3 sm:grid-cols-[1fr_9rem_auto]">
            <Field label={label(i)}>
              <select className="input" value={r.team_id} onChange={e => setRow(r.key, { team_id: e.target.value })}>
                <option value="">— Not set —</option>
                {participating.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Points"><input className="input" inputMode="decimal" type="number" min="0" step="any" placeholder="e.g. 10" value={r.points} onChange={e => setRow(r.key, { points: e.target.value })} /></Field>
            {i >= 2 ? <button type="button" aria-label="Remove placement" className="mb-1 rounded-full p-2 text-red-700 hover:bg-red-50" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}><Trash2 className="h-4 w-4" /></button> : <span />}
          </div>
        ))}
      </div>
      <button type="button" className="btn-outline btn-sm mt-3" onClick={() => setRows(rs => [...rs, { key: crypto.randomUUID(), team_id: '', points: '' }])}><Plus className="h-3 w-3" />Add another placement</button>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Result status" hint="Only Completed results count towards the leaderboard. Points may be left blank until scoring is final.">
          <select className="input" value={status} onChange={e => setStatus(e.target.value as 'pending' | 'completed')}><option value="pending">Pending</option><option value="completed">Completed</option></select>
        </Field>
        <Field label="Notes (optional)"><input className="input" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        {result && <button className="btn-sm inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => setConfirmReset(true)} disabled={busy}><Trash2 className="h-3 w-3" />Reset result</button>}
        <button className="btn-primary" onClick={onSave} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save result</button>
      </div>
      <ConfirmDialog open={confirmReset} busy={busy} confirmLabel="Reset result" title="Reset this result?" message={result?.status === 'completed' ? 'This result is completed. Resetting removes the winner, runner-up and points, and the leaderboard will be recalculated without them.' : 'This clears the saved placements.'} onCancel={() => setConfirmReset(false)} onConfirm={() => void reset()} />
      <ConfirmDialog open={confirmSave} busy={busy} confirmLabel="Save changes" title="Change a completed result?" message="This result is already completed. Saving will recalculate the leaderboard." onCancel={() => setConfirmSave(false)} onConfirm={() => void save()} />
    </div>
  )
}

/* ---------- Dedicated Registration Deadline Modal ---------- */
function DeadlineModal({
  sport,
  onClose,
  onSaved,
}: {
  sport: Sport
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [deadline, setDeadline] = useState(toLocalIso(sport.registration_deadline))
  const [busy, setBusy] = useState(false)

  function applyPreset(preset: 'today_6pm' | 'today_midnight' | 'tomorrow_6pm' | 'in_2days_6pm') {
    const d = new Date()
    if (preset === 'today_6pm') {
      d.setHours(18, 0, 0, 0)
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
    } else if (preset === 'today_midnight') {
      d.setHours(23, 59, 0, 0)
    } else if (preset === 'tomorrow_6pm') {
      d.setDate(d.getDate() + 1)
      d.setHours(18, 0, 0, 0)
    } else if (preset === 'in_2days_6pm') {
      d.setDate(d.getDate() + 2)
      d.setHours(18, 0, 0, 0)
    }
    setDeadline(toLocalIso(d.toISOString()))
  }

  async function save(val: string | null) {
    setBusy(true)
    try {
      const iso = val ? new Date(val).toISOString() : null
      const { error } = await supabase
        .from('sports')
        .update({ registration_deadline: iso, updated_at: new Date().toISOString() })
        .eq('id', sport.id)
      if (error) throw error
      toast('success', iso ? 'Registration deadline updated.' : 'Deadline removed — registration is open.')
      onSaved()
      onClose()
    } catch (e) {
      toast('error', `Could not update deadline: ${errMsg(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title={`Registration Deadline · ${sport.name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault()
          void save(deadline)
        }}
      >
        <p className="text-sm text-bark-soft">
          Set a registration cutoff date and time. After this deadline, team captains cannot register, unregister, or alter their playing squad in the Leader Portal.
        </p>

        <Field label="Registration deadline" hint="In your local timezone">
          <input
            type="datetime-local"
            className="input"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
          />
        </Field>

        <div>
          <label className="text-xs font-medium text-bark-soft">Quick Presets:</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyPreset('today_6pm')}
              className="rounded-full bg-sand/40 px-3 py-1 text-xs font-medium text-bark hover:bg-sand"
            >
              Today 6 PM
            </button>
            <button
              type="button"
              onClick={() => applyPreset('today_midnight')}
              className="rounded-full bg-sand/40 px-3 py-1 text-xs font-medium text-bark hover:bg-sand"
            >
              Tonight 11:59 PM
            </button>
            <button
              type="button"
              onClick={() => applyPreset('tomorrow_6pm')}
              className="rounded-full bg-sand/40 px-3 py-1 text-xs font-medium text-bark hover:bg-sand"
            >
              Tomorrow 6 PM
            </button>
            <button
              type="button"
              onClick={() => applyPreset('in_2days_6pm')}
              className="rounded-full bg-sand/40 px-3 py-1 text-xs font-medium text-bark hover:bg-sand"
            >
              +2 Days 6 PM
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand pt-4">
          {sport.registration_deadline ? (
            <button
              type="button"
              className="text-xs font-medium text-red-700 hover:underline"
              onClick={() => void save(null)}
              disabled={busy}
            >
              Remove Deadline (Unlimited)
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={busy || !deadline}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Deadline
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Sport detail page ---------- */
export function SportDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { data, loading, error, reload } = useHpl()
  const [editing, setEditing] = useState(false)
  const [deadlineModal, setDeadlineModal] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyDeadline, setBusyDeadline] = useState(false)
  const [addTeam, setAddTeam] = useState('')
  const sport = data.bundle.sports.find(s => s.id === id)
  const { teams, bundle } = data
  const sportTeams = useMemo(() => teams.filter(t => bundle.sportTeams.some(st => st.sport_id === id && st.team_id === t.id)), [teams, bundle, id])
  const available = teams.filter(t => !sportTeams.some(s => s.id === t.id))
  const result = bundle.results.find(r => r.sport_id === id)
  const placedTeamIds = new Set(result ? bundle.placements.filter(p => p.result_id === result.id).map(p => p.team_id) : [])

  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!sport) return <EmptyState title="Sport not found" action={<Link to="/admin/sports" className="btn-primary">Back to sports</Link>} />

  async function quickCloseDeadline() {
    setBusyDeadline(true)
    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('sports')
        .update({ registration_deadline: nowIso, updated_at: nowIso })
        .eq('id', sport!.id)
      if (error) throw error
      toast('success', 'Registration closed for team leaders.')
      void reload()
    } catch (e) {
      toast('error', `Failed to close registration: ${errMsg(e)}`)
    } finally {
      setBusyDeadline(false)
    }
  }

  async function extendDeadline(hours: number) {
    setBusyDeadline(true)
    try {
      const current = sport!.registration_deadline ? new Date(sport!.registration_deadline) : new Date()
      const baseTime = current.getTime() < Date.now() ? Date.now() : current.getTime()
      const newIso = new Date(baseTime + hours * 3600 * 1000).toISOString()
      const { error } = await supabase
        .from('sports')
        .update({ registration_deadline: newIso, updated_at: new Date().toISOString() })
        .eq('id', sport!.id)
      if (error) throw error
      toast('success', `Deadline extended by ${hours} hours.`)
      void reload()
    } catch (e) {
      toast('error', `Failed to extend deadline: ${errMsg(e)}`)
    } finally {
      setBusyDeadline(false)
    }
  }

  async function removeDeadline() {
    setBusyDeadline(true)
    try {
      const { error } = await supabase
        .from('sports')
        .update({ registration_deadline: null, updated_at: new Date().toISOString() })
        .eq('id', sport!.id)
      if (error) throw error
      toast('success', 'Deadline removed. Registration is now open indefinitely.')
      void reload()
    } catch (e) {
      toast('error', `Failed to remove deadline: ${errMsg(e)}`)
    } finally {
      setBusyDeadline(false)
    }
  }

  async function addTeamToSport() {
    if (!addTeam) return
    const { error } = await supabase.from('sport_teams').insert({ sport_id: sport!.id, team_id: addTeam })
    if (error) toast('error', error.message); else { toast('success', 'Team added.'); setAddTeam(''); void reload() }
  }
  async function deleteSport() {
    setBusy(true)
    try {
      const { error } = await supabase.from('sports').delete().eq('id', sport!.id); if (error) throw error
      await removeImage(sport!.image_path)
      toast('success', 'Sport deleted.'); nav('/admin/sports')
    } catch (e) { toast('error', errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <>
      <Link to="/admin/sports" className="mb-4 inline-flex items-center gap-1 text-sm text-terracotta-deep hover:underline"><ArrowLeft className="h-4 w-4" />All sports</Link>
      <PageTitle title={sport.name} text={sport.category || undefined} action={
        <div className="flex items-center gap-2"><Badge status={sport.status} />
          <button className="btn-outline btn-sm" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" />Edit</button>
          <button className="btn-sm inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => setDelOpen(true)}><Trash2 className="h-3 w-3" />Delete</button></div>} />

      {/* Registration Deadline & Access Controls (Admin-managed) */}
      <section className="mb-6 rounded-3xl border border-sand bg-white/90 p-5 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3.5">
            <div className={`mt-0.5 rounded-2xl p-3 ${
              sport.registration_deadline
                ? isDeadlinePassed(sport.registration_deadline)
                  ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                  : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                : 'bg-sand/30 text-bark-soft'
            }`}>
              <Clock className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-bark">Registration Deadline</h2>
                {sport.registration_deadline ? (
                  isDeadlinePassed(sport.registration_deadline) ? (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
                      Registration Closed
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      Registration Open
                    </span>
                  )
                ) : (
                  <span className="rounded-full bg-sand/50 px-2.5 py-0.5 text-xs font-medium text-bark-soft">
                    No Deadline Set (Open)
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-bark-soft">
                {sport.registration_deadline ? (
                  <>
                    Cutoff: <strong className="text-bark">{fmtDateTime(sport.registration_deadline)}</strong>
                    {isDeadlinePassed(sport.registration_deadline) ? (
                      <span className="text-red-700 font-medium"> — Deadline passed. Team captains cannot register or alter squads.</span>
                    ) : (
                      <span className="text-emerald-700 font-medium"> — Team captains can register and choose playing squads until this time.</span>
                    )}
                  </>
                ) : (
                  'No registration cutoff configured. Team leaders can register and manage squads anytime in the Leader Portal.'
                )}
              </p>
            </div>
          </div>

          {/* Quick Admin Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              className="btn-outline btn-sm inline-flex items-center gap-1.5"
              onClick={() => setDeadlineModal(true)}
            >
              <Calendar className="h-3.5 w-3.5 text-terracotta" />
              <span>{sport.registration_deadline ? 'Change Deadline' : 'Set Deadline'}</span>
            </button>

            {sport.registration_deadline && !isDeadlinePassed(sport.registration_deadline) && (
              <button
                type="button"
                className="btn-sm rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                onClick={() => void quickCloseDeadline()}
                disabled={busyDeadline}
                title="Immediately close registration for team leaders"
              >
                Close Now
              </button>
            )}

            {sport.registration_deadline && isDeadlinePassed(sport.registration_deadline) && (
              <button
                type="button"
                className="btn-sm rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                onClick={() => void extendDeadline(24)}
                disabled={busyDeadline}
                title="Re-open and extend deadline by 24 hours"
              >
                Extend +24h
              </button>
            )}

            {sport.registration_deadline && (
              <button
                type="button"
                className="btn-sm rounded-full px-2.5 py-1.5 text-xs text-bark-soft hover:text-red-700 hover:bg-red-50"
                onClick={() => void removeDeadline()}
                disabled={busyDeadline}
                title="Remove deadline completely"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {sport.description && <p className="-mt-2 mb-6 max-w-2xl text-sm text-bark-soft">{sport.description}</p>}

      <section className="card mb-8">
        <h2 className="mb-1 text-2xl font-semibold">Participating teams and players</h2>
        <p className="mb-4 text-sm text-bark-soft">Pick a team, then choose players from its saved roster. Players may take part in any number of sports.</p>
        {teams.length === 0 ? <p className="text-sm text-bark-soft">Create teams first under Teams.</p> : (
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1"><Field label="Add participating team">
              <select className="input" value={addTeam} onChange={e => setAddTeam(e.target.value)} disabled={!available.length}>
                <option value="">{available.length ? 'Select a team…' : 'All teams already added'}</option>{available.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select></Field></div>
            <button className="btn-accent" onClick={() => void addTeamToSport()} disabled={!addTeam}><Plus className="h-4 w-4" />Add team</button>
          </div>
        )}
        <div className="grid gap-4">
          {sportTeams.map(t => <TeamParticipants key={`${t.id}-${bundle.participants.filter(p => p.sport_id === sport.id && p.team_id === t.id).length}`} sport={sport} team={t} bundle={bundle} onChanged={reload} canRemoveTeam={!placedTeamIds.has(t.id)} />)}
          {!sportTeams.length && <p className="text-sm text-bark-faint">No teams participating yet.</p>}
        </div>
        {sportTeams.length > 0 && (
          <div className="mt-6 rounded-2xl bg-cream/70 p-4">
            <h3 className="mb-2 font-serif text-xl font-semibold">Summary — {sport.name}</h3>
            {sportTeams.map(t => { const ps = bundle.participants.filter(p => p.sport_id === sport.id && p.team_id === t.id); return (
              <div key={t.id} className="mb-3"><p className="font-semibold">{t.name}</p>{ps.length ? <ul className="ml-5 list-disc text-sm text-bark-soft">{ps.map(p => <li key={p.id}>{p.player_name}</li>)}</ul> : <p className="ml-5 text-sm text-bark-faint">No players selected</p>}</div>) })}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-1 text-2xl font-semibold">Results and points</h2>
        <p className="mb-4 text-sm text-bark-soft">One saved result per sport. Points are entered here only — the leaderboard is calculated automatically.</p>
        <ResultEditor key={`${result?.id}-${bundle.placements.length}-${result?.status}`} sport={sport} teams={teams} bundle={bundle} onChanged={reload} />
      </section>

      {editing && data.edition && <SportForm sport={sport} editionId={data.edition.id} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void reload() }} />}
      {deadlineModal && <DeadlineModal sport={sport} onClose={() => setDeadlineModal(false)} onSaved={() => { setDeadlineModal(false); void reload() }} />}
      <ConfirmDialog open={delOpen} busy={busy} title={`Delete ${sport.name}?`} message={result?.status === 'completed' ? 'This sport has a completed result. Deleting it removes the result and the leaderboard will be recalculated without its points.' : 'This deletes the sport, its participants and any pending result.'} onCancel={() => setDelOpen(false)} onConfirm={() => void deleteSport()} />
    </>
  )
}

export { fmtPoints }
