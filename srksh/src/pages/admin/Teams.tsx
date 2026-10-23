import { useState, useEffect } from 'react'
import { Copy, KeyRound, Loader2, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { supabase, uploadImage, removeImage, imageUrl } from '../../lib/supabase'
import { useHpl } from '../../lib/data'
import type { Team } from '../../types'
import { ConfirmDialog, EmptyState, ErrorBox, Img, Modal, Spinner, useToast, ColourDot } from '../../components/ui'
import { Field, ImageField, PageTitle, errMsg } from './common'

interface MemberDraft { key: string; id?: string; name: string; file: File | null; photoPath: string | null; removePhoto: boolean }
const blankMember = (): MemberDraft => ({ key: crypto.randomUUID(), name: '', file: null, photoPath: null, removePhoto: false })

function TeamForm({ team, editionId, initialPin, onClose, onSaved }: { team: Team | null; editionId: string; initialPin?: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(team?.name ?? '')
  const [colour, setColour] = useState(team?.colour ?? '#D98E2B')
  const [useColour, setUseColour] = useState(!!team?.colour || !team)
  const [description, setDescription] = useState(team?.description ?? '')
  const [captain, setCaptain] = useState(team?.captain_name ?? '')
  const [pin, setPin] = useState(initialPin ?? '')
  const [logo, setLogo] = useState<File | null>(null); const [logoRm, setLogoRm] = useState(false)
  const [capPhoto, setCapPhoto] = useState<File | null>(null); const [capRm, setCapRm] = useState(false)
  const [members, setMembers] = useState<MemberDraft[]>(
    team?.team_members?.length ? team.team_members.map(m => ({ key: m.id, id: m.id, name: m.name, file: null, photoPath: m.photo_path, removePhoto: false })) : [blankMember()]
  )
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [warnRemoval, setWarnRemoval] = useState<{ count: number } | null>(null)

  const setM = (key: string, patch: Partial<MemberDraft>) => setMembers(ms => ms.map(m => (m.key === key ? { ...m, ...patch } : m)))

  function validate(): string[] {
    const e: string[] = []
    if (!name.trim()) e.push('Team name is required.')
    if (!captain.trim()) e.push('Captain name is required.')
    if (pin.trim() && pin.trim().length < 3) e.push('Leader passcode must be at least 3 characters long.')
    const seen = new Map<string, number>()
    members.filter(m => m.name.trim()).forEach(m => {
      const k = m.name.trim().toLowerCase().replace(/\s+/g, ' ')
      seen.set(k, (seen.get(k) ?? 0) + 1)
    })
    seen.forEach((n, k) => { if (n > 1) e.push(`"${k}" is entered more than once in this team.`) })
    return e
  }

  async function save(force = false) {
    const e = validate(); setErrors(e); if (e.length) return
    const kept = members.filter(m => m.name.trim())
    const removedIds = (team?.team_members ?? []).filter(m => !kept.some(k => k.id === m.id)).map(m => m.id)
    if (!force && removedIds.length) {
      const { count } = await supabase.from('sport_participants').select('id', { count: 'exact', head: true }).in('member_id', removedIds)
      if (count) { setWarnRemoval({ count }); return }
    }
    setBusy(true)
    const uploaded: string[] = []
    const toDelete: string[] = []
    try {
      let logo_path = team?.logo_path ?? null, captain_photo_path = team?.captain_photo_path ?? null
      if (logo) { const p = await uploadImage(logo, 'teams'); uploaded.push(p); if (logo_path) toDelete.push(logo_path); logo_path = p }
      else if (logoRm && logo_path) { toDelete.push(logo_path); logo_path = null }
      if (capPhoto) { const p = await uploadImage(capPhoto, 'captains'); uploaded.push(p); if (captain_photo_path) toDelete.push(captain_photo_path); captain_photo_path = p }
      else if (capRm && captain_photo_path) { toDelete.push(captain_photo_path); captain_photo_path = null }

      const payload = { name: name.trim(), colour: useColour ? colour : null, description: description.trim() || null, captain_name: captain.trim(), logo_path, captain_photo_path, updated_at: new Date().toISOString() }
      let teamId = team?.id
      if (teamId) {
        const { error } = await supabase.from('teams').update(payload).eq('id', teamId); if (error) throw error
      } else {
        const { data, error } = await supabase.from('teams').insert({ ...payload, edition_id: editionId }).select('id').single(); if (error) throw error
        teamId = data.id
      }
      if (removedIds.length) {
        const { error } = await supabase.from('team_members').delete().in('id', removedIds); if (error) throw error
        for (const m of team?.team_members ?? []) if (removedIds.includes(m.id) && m.photo_path) toDelete.push(m.photo_path)
      }
      for (let i = 0; i < kept.length; i++) {
        const m = kept[i]
        let photo_path = m.photoPath
        if (m.file) { const p = await uploadImage(m.file, 'members'); uploaded.push(p); if (photo_path) toDelete.push(photo_path); photo_path = p }
        else if (m.removePhoto && photo_path) { toDelete.push(photo_path); photo_path = null }
        if (m.id) {
          const { error } = await supabase.from('team_members').update({ name: m.name.trim(), photo_path, sort_order: i }).eq('id', m.id); if (error) throw error
          // keep the name snapshot on sports in sync with roster edits
          await supabase.from('sport_participants').update({ player_name: m.name.trim() }).eq('member_id', m.id)
        } else {
          const { error } = await supabase.from('team_members').insert({ team_id: teamId, name: m.name.trim(), photo_path, sort_order: i }); if (error) throw error
        }
      }
      if (pin.trim()) {
        const { error: pinErr } = await supabase.rpc('admin_set_team_pin', { p_team_id: teamId, p_pin: pin.trim() })
        if (pinErr) throw pinErr
      }
      await Promise.all(toDelete.map(p => removeImage(p)))
      toast('success', team ? 'Team updated.' : 'Team created.')
      onSaved()
    } catch (err) {
      await Promise.all(uploaded.map(p => removeImage(p)))
      const msg = errMsg(err)
      toast('error', /duplicate key|unique/i.test(msg) ? 'A team or member with that name already exists.' : `Could not save: ${msg}`)
    } finally { setBusy(false) }
  }

  return (
    <Modal open title={team ? `Edit ${team.name}` : 'Add team'} onClose={onClose} wide>
      <form onSubmit={e => { e.preventDefault(); void save() }} className="space-y-5" noValidate>
        {errors.length > 0 && <ul role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{errors.map(x => <li key={x}>• {x}</li>)}</ul>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Team name *"><input className="input" value={name} onChange={e => setName(e.target.value)} required /></Field>
          <div>
            <span className="label">Team colour</span>
            <div className="flex items-center gap-3">
              <input type="color" aria-label="Team colour" value={colour} disabled={!useColour} onChange={e => setColour(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-sand bg-white disabled:opacity-40" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useColour} onChange={e => setUseColour(e.target.checked)} />Use a colour</label>
            </div>
          </div>
        </div>
        <Field label="Description (optional)"><textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} /></Field>
        <ImageField label="Team logo / image (optional)" existingPath={team?.logo_path} file={logo} onFile={setLogo} removed={logoRm} onRemove={() => setLogoRm(true)} />
        <div className="grid gap-4 rounded-2xl bg-cream/70 p-4 sm:grid-cols-2">
          <Field label="Captain name *"><input className="input" value={captain} onChange={e => setCaptain(e.target.value)} required /></Field>
          <ImageField label="Captain photo" round existingPath={team?.captain_photo_path} file={capPhoto} onFile={f => { setCapPhoto(f); if (f) setCapRm(false) }} removed={capRm} onRemove={() => setCapRm(true)} />
        </div>
        <div className="rounded-2xl bg-cream/70 p-4">
          <div className="flex items-center justify-between">
            <span className="label !mb-0 flex items-center gap-1.5"><KeyRound className="h-4 w-4 text-terracotta" /> Leader Passcode / PIN</span>
            <button
              type="button"
              className="btn-outline btn-sm text-xs"
              onClick={() => setPin(Math.floor(100000 + Math.random() * 900000).toString())}
            >
              Generate PIN
            </button>
          </div>
          <p className="mt-1 mb-2 text-xs text-bark-soft">Team captains use this passcode to log in at <code>/leader/login</code> to register for sports and select the squad.</p>
          <input
            className="input max-w-xs font-mono tracking-wider"
            placeholder="e.g. 583921"
            value={pin}
            onChange={e => setPin(e.target.value)}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="label !mb-0">Team members ({members.filter(m => m.name.trim()).length})</span>
            <button type="button" className="btn-accent btn-sm" onClick={() => setMembers(ms => [...ms, blankMember()])}><UserPlus className="h-4 w-4" />Add member</button></div>
          <ul className="space-y-2">
            {members.map((m, i) => (
              <li key={m.key} className="flex items-center gap-2">
                <span className="w-6 text-right text-xs text-bark-faint">{i + 1}</span>
                <input className="input" aria-label={`Member ${i + 1} name`} placeholder="Member name" value={m.name} onChange={e => setM(m.key, { name: e.target.value })} />
                <label className="btn-outline btn-sm cursor-pointer whitespace-nowrap" title="Optional member photo">
                  {m.file || (m.photoPath && !m.removePhoto) ? 'Photo ✓' : 'Photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Member ${i + 1} photo`} onChange={ev => { const f = ev.target.files?.[0]; if (f) setM(m.key, { file: f, removePhoto: false }) }} />
                </label>
                <button type="button" aria-label={`Remove member ${i + 1}`} className="rounded-full p-2 text-red-700 hover:bg-red-50" onClick={() => setMembers(ms => (ms.length > 1 ? ms.filter(x => x.key !== m.key) : [blankMember()]))}><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-bark-faint">No fixed limit. Blank rows are ignored when saving.</p>
        </div>
        <div className="flex justify-end gap-3 border-t border-sand pt-4">
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save team</button>
        </div>
      </form>
      <ConfirmDialog open={!!warnRemoval} title="Remove players from sports?" confirmLabel="Remove anyway" onCancel={() => setWarnRemoval(null)}
        onConfirm={() => { setWarnRemoval(null); void save(true) }}
        message={`${warnRemoval?.count} sport participation record(s) refer to the member(s) you removed. The sport lists will keep the player's name as a historical record but it will no longer be linked to this roster.`} />
    </Modal>
  )
}

export default function Teams() {
  const toast = useToast()
  const { data, loading, error, reload } = useHpl()
  const [editing, setEditing] = useState<Team | 'new' | null>(null)
  const [del, setDel] = useState<Team | null>(null)
  const [busy, setBusy] = useState(false)
  const [pins, setPins] = useState<Record<string, string>>({})

  const loadPins = async () => {
    try {
      const { data: creds } = await supabase.from('team_credentials').select('team_id, pin')
      if (creds) {
        const map: Record<string, string> = {}
        creds.forEach((d: { team_id: string; pin: string }) => { map[d.team_id] = d.pin })
        setPins(map)
      }
    } catch {
      // In case team_credentials table isn't migrated yet
    }
  }

  useEffect(() => { void loadPins() }, [data])

  function copyCredentials(t: Team, pin: string) {
    const url = `${window.location.origin}/leader/login`
    const text = `🏆 SRKSH HPL — Team Leader Login\nTeam: ${t.name}\nCaptain: ${t.captain_name}\nPasscode: ${pin}\nLogin here: ${url}`
    void navigator.clipboard.writeText(text)
    toast('success', `Login credentials for ${t.name} copied to clipboard!`)
  }

  async function remove(t: Team) {
    setBusy(true)
    try {
      const { count } = await supabase.from('result_placements').select('id', { count: 'exact', head: true }).eq('team_id', t.id)
      if (count) { toast('error', `"${t.name}" appears in ${count} saved result(s), so it cannot be deleted. Reset or edit those results first to protect the history.`); return }
      const { error } = await supabase.from('teams').delete().eq('id', t.id); if (error) throw error
      await Promise.all([t.logo_path, t.captain_photo_path, ...(t.team_members ?? []).map(m => m.photo_path)].map(p => removeImage(p)))
      toast('success', 'Team deleted.'); setDel(null); void reload(); void loadPins()
    } catch (e) { toast('error', errMsg(e)) } finally { setBusy(false) }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!data.edition) return <EmptyState title="No HPL edition yet" text="Create an edition in Settings first." />
  const { teams } = data
  return (
    <>
      <PageTitle title="Teams" text={`${data.edition.name} · ${teams.length} team(s)`} action={<button className="btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />Add team</button>} />
      {teams.length === 0 ? <EmptyState title="No teams yet" text="Add your teams, their captains and members." /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          {teams.map(t => (
            <div key={t.id} className="card">
              <div className="flex items-start gap-4">
                <Img src={imageUrl(t.captain_photo_path)} alt={`Captain ${t.captain_name}`} className="h-16 w-16 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 truncate text-2xl font-semibold"><ColourDot colour={t.colour} />{t.name}</h2>
                  <p className="text-sm text-bark-soft">Captain: <strong>{t.captain_name}</strong> · {t.team_members?.length ?? 0} members</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-bark-soft">{(t.team_members ?? []).map(m => m.name).join(', ') || 'No members yet'}</p>
              
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sand/30 p-2.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-terracotta" />
                  <span className="font-medium text-bark-soft">Leader Passcode:</span>
                  <span className="font-mono font-bold text-bark">{pins[t.id] ?? 'Not set'}</span>
                </div>
                {pins[t.id] && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-bark shadow-xs ring-1 ring-sand hover:bg-sand/40"
                    onClick={() => copyCredentials(t, pins[t.id])}
                  >
                    <Copy className="h-3 w-3" /> Copy login info
                  </button>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button className="btn-outline btn-sm" onClick={() => setEditing(t)}><Pencil className="h-3 w-3" />Edit</button>
                <button className="btn-sm inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => setDel(t)}><Trash2 className="h-3 w-3" />Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <TeamForm
          team={editing === 'new' ? null : editing}
          editionId={data.edition.id}
          initialPin={editing !== 'new' ? pins[editing.id] : ''}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); void loadPins() }}
        />
      )}
      <ConfirmDialog open={!!del} busy={busy} title={`Delete ${del?.name}?`} message="This removes the team and its roster permanently. Teams that appear in saved results cannot be deleted." onCancel={() => setDel(null)} onConfirm={() => del && void remove(del)} />
    </>
  )
}

