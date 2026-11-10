import { useMemo, useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Award,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
  Loader2,
} from 'lucide-react'
import { useHpl } from '../../lib/data'
import { useLeaderAuth } from '../../lib/leaderAuth'
import { formatMatchScoreDisplay } from '../../lib/tournament'
import { imageUrl, uploadImageWithFallback } from '../../lib/supabase'
import type { Sport, Team, Member, SportMatch } from '../../types'
import CricketLiveScorecard from '../../components/CricketLiveScorecard'
import CricketTournamentStats from '../../components/CricketTournamentStats'
import {
  Badge,
  ColourDot,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Img,
  Modal,
  Spinner,
  useToast,
} from '../../components/ui'
import { useTitle } from '../../lib/useTitle'
import { fmtDateTime, isDeadlinePassed, ordinal } from '../../lib/format'

/* ---------- Squad Selection Modal ---------- */
function SquadModal({
  sport,
  team,
  currentMemberIds,
  onClose,
  onSaved,
}: {
  sport: Sport
  team: Team
  currentMemberIds: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const { saveSquad } = useLeaderAuth()
  const isIndividual = sport.game_type === 'individual'
  const maxLimit = isIndividual ? (sport.max_participants ?? null) : null

  const rawRoster = team.team_members ?? []
  const hasCaptain = rawRoster.some(m => m.name.trim().toLowerCase() === team.captain_name.trim().toLowerCase())
  const roster = useMemo(() => {
    if (hasCaptain) return rawRoster
    return [
      {
        id: 'captain',
        team_id: team.id,
        name: team.captain_name,
        photo_path: team.captain_photo_path,
        sort_order: -1,
      },
      ...rawRoster,
    ]
  }, [rawRoster, hasCaptain, team.id, team.captain_name, team.captain_photo_path])

  const deadlinePassed = isDeadlinePassed(sport.registration_deadline)

  // Keep ordered array of selected member IDs in exact selection order
  const [selectedIds, setSelectedIds] = useState<string[]>(currentMemberIds)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  // STABLE roster order: Leader/Captain is placed FIRST at the top!
  const stableRoster = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q ? roster.filter(m => m.name.toLowerCase().includes(q)) : [...roster]
    const capName = team.captain_name.trim().toLowerCase()
    return pool.sort((a, b) => {
      const aIsCap = a.name.trim().toLowerCase() === capName
      const bIsCap = b.name.trim().toLowerCase() === capName
      if (aIsCap && !bIsCap) return -1
      if (!aIsCap && bIsCap) return 1
      return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
    })
  }, [roster, query, team.captain_name])

  function toggleMember(id: string) {
    if (deadlinePassed) return
    setError('')
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id)
      } else {
        if (maxLimit === 1) {
          return [id]
        }
        if (maxLimit !== null && prev.length >= maxLimit) {
          setError(`Maximum ${maxLimit} participant${maxLimit === 1 ? '' : 's'} allowed for this individual game.`)
          return prev
        }
        return [...prev, id]
      }
    })
  }

  function moveMember(index: number, direction: 'up' | 'down') {
    if (deadlinePassed) return
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= selectedIds.length) return
    setSelectedIds(prev => {
      const copy = [...prev]
      const temp = copy[index]
      copy[index] = copy[target]
      copy[target] = temp
      return copy
    })
  }

  function selectAll() {
    if (deadlinePassed) return
    if (maxLimit !== null) {
      const toAdd = stableRoster.slice(0, maxLimit).map(m => m.id)
      setSelectedIds(toAdd)
      return
    }
    const existing = new Set(selectedIds)
    const toAdd = stableRoster.filter(m => !existing.has(m.id)).map(m => m.id)
    setSelectedIds([...selectedIds, ...toAdd])
  }

  function clearAll() {
    if (deadlinePassed) return
    setSelectedIds([])
  }

  async function handleSave() {
    if (deadlinePassed) {
      setError('The registration deadline for this sport has passed. You cannot modify the squad.')
      return
    }
    if (maxLimit !== null && selectedIds.length > maxLimit) {
      setError(`Maximum ${maxLimit} participant${maxLimit === 1 ? '' : 's'} allowed for this individual game.`)
      return
    }
    setError('')
    setSaving(true)
    try {
      await saveSquad(sport.id, selectedIds)
      toast(
        'success',
        isIndividual
          ? `Participant selection for ${sport.name} saved (${selectedIds.length} player${selectedIds.length === 1 ? '' : 's'}).`
          : `Squad for ${sport.name} updated (${selectedIds.length} player${selectedIds.length === 1 ? '' : 's'}).`
      )
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save squad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={isIndividual ? `Select Participant: ${sport.name} (Individual Game)` : `Select Squad: ${sport.name}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sand/30 p-3 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{team.name} Roster</span>
            <span className="text-bark-soft">
              ({selectedIds.length} of {roster.length} selected{maxLimit ? ` · Max ${maxLimit}` : ''})
            </span>
            {isIndividual && (
              <span className="rounded-full bg-saffron-soft px-2.5 py-0.5 text-xs font-bold text-saffron-deep">
                👤 Individual Game {maxLimit ? `(Max ${maxLimit} per team)` : '(Entire team can enter)'}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-outline btn-sm text-xs"
              onClick={selectAll}
              disabled={saving || roster.length === 0 || deadlinePassed}
            >
              Select All
            </button>
            <button
              type="button"
              className="btn-outline btn-sm text-xs"
              onClick={clearAll}
              disabled={saving || selectedIds.length === 0 || deadlinePassed}
            >
              Clear
            </button>
          </div>
        </div>

        {isIndividual && (
          <div className="rounded-xl bg-saffron-soft/30 p-3 text-xs text-bark flex items-center justify-between gap-2 border border-saffron/40">
            <div>
              <p className="font-semibold text-bark">🎯 Individual Competition</p>
              <p className="text-bark-soft mt-0.5">
                {maxLimit
                  ? `Select up to ${maxLimit} player(s) to represent your team. Each participant competes individually.`
                  : 'Multiple players or your entire team can participate! Each member competes individually for rankings.'}
              </p>
            </div>
            {selectedIds.length === roster.length && roster.length > 0 && (
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                ✓ Full Team Entered
              </span>
            )}
          </div>
        )}

        {deadlinePassed && (
          <div role="alert" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-amber-600" />
            <span>The registration deadline for this sport has passed. The squad is locked and cannot be edited.</span>
          </div>
        )}

        {/* Selected Squad Lineup Strip (Ordered by Selection) */}
        {selectedIds.length > 0 && (
          <div className="rounded-xl border border-sand bg-saffron-soft/20 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-bark">
              <span className="flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-terracotta" />
                {isIndividual ? 'Selected Participant' : 'Selected Squad Lineup'} ({selectedIds.length})
              </span>
              <span className="text-[11px] font-normal text-bark-soft">
                {isIndividual ? 'Selected to represent your team' : 'Ordered as selected (use ▲ / ▼ to reorder)'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {selectedIds.map((id, idx) => {
                const member = roster.find(m => m.id === id)
                if (!member) return null
                const isCap = member.name.trim().toLowerCase() === team.captain_name.trim().toLowerCase()
                return (
                  <span
                    key={id}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-bark shadow-xs ring-1 ${
                      isCap ? 'bg-saffron-soft/60 ring-saffron' : 'bg-white ring-sand/80'
                    }`}
                  >
                    <span className="rounded-full bg-terracotta/15 px-1.5 py-0.2 text-[10px] font-bold text-terracotta">
                      #{idx + 1}
                    </span>
                    <span className="truncate max-w-[130px] font-semibold">{member.name}</span>
                    {isCap && (
                      <span className="text-[10px] font-bold text-saffron-deep">👑</span>
                    )}
                    {!deadlinePassed && !isIndividual && (
                      <span className="inline-flex items-center gap-0.5 ml-1 border-l border-sand/60 pl-1 text-bark-soft">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => moveMember(idx, 'up')}
                            className="p-0.5 hover:text-terracotta rounded"
                            title="Move earlier in lineup"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                        )}
                        {idx < selectedIds.length - 1 && (
                          <button
                            type="button"
                            onClick={() => moveMember(idx, 'down')}
                            className="p-0.5 hover:text-terracotta rounded"
                            title="Move later in lineup"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleMember(id)}
                      className="ml-0.5 text-bark-soft hover:text-red-700"
                      title={`Remove ${member.name}`}
                    >
                      ×
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bark-soft" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Search roster members..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {roster.length === 0 ? (
          <div className="rounded-xl bg-cream p-6 text-center text-sm text-bark-soft">
            No roster members have been added to {team.name} yet. Please ask an admin to add players to your team roster first.
          </div>
        ) : stableRoster.length === 0 ? (
          <p className="py-4 text-center text-sm text-bark-soft">No members match your search.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-xl border border-sand/80 divide-y divide-sand/40">
            {stableRoster.map(m => {
              const isChecked = selectedSet.has(m.id)
              const selectedIdx = selectedIds.indexOf(m.id)
              const isCaptain = m.name.trim().toLowerCase() === team.captain_name.trim().toLowerCase()

              return (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 p-3 transition hover:bg-cream/80 ${
                    isChecked ? 'bg-saffron-soft/30' : ''
                  } ${isCaptain ? 'border-l-4 border-l-terracotta bg-cream/30' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type={maxLimit === 1 ? 'radio' : 'checkbox'}
                      className="h-4 w-4 rounded-sm border-sand text-terracotta focus:ring-terracotta"
                      checked={isChecked}
                      onChange={() => toggleMember(m.id)}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-bark flex items-center gap-2">
                        {isChecked && (
                          <span className="rounded-md bg-terracotta/15 px-1.5 py-0.5 text-[10px] font-bold text-terracotta">
                            #{selectedIdx + 1}
                          </span>
                        )}
                        <span>{m.name}</span>
                        {isCaptain && (
                          <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-saffron-deep ring-1 ring-saffron/40 flex items-center gap-1">
                            👑 Team Leader
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {isChecked ? (
                    <span className="shrink-0 text-xs font-semibold text-terracotta flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Selected {maxLimit !== 1 ? `(#${selectedIdx + 1})` : ''}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-bark-soft">Available</span>
                  )}
                </label>
              )
            })}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-sand pt-4">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            {deadlinePassed ? 'Close' : 'Cancel'}
          </button>
          {!deadlinePassed && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                isIndividual
                  ? `Confirm Participant${selectedIds.length === 1 ? '' : 's'} (${selectedIds.length}${maxLimit ? `/${maxLimit}` : ''})`
                  : `Confirm Squad (${selectedIds.length})`
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Modal: Add / Edit Team Member & Photo ---------- */
function LeaderMemberModal({
  open,
  onClose,
  member,
  teamId,
  isCaptain,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  member: Member | null
  teamId: string
  isCaptain?: boolean
  onSaved: () => void
}) {
  const toast = useToast()
  const { addMember, updateMember, updateCaptainPhoto } = useLeaderAuth()
  const [name, setName] = useState(member?.name ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(imageUrl(member?.photo_path) ?? null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (member) {
      setName(member.name)
      setPreview(imageUrl(member.photo_path) ?? null)
    } else {
      setName('')
      setPreview(null)
    }
    setFile(null)
    setRemovePhoto(false)
    setError('')
  }, [member, open])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Please select a JPG, PNG or WebP image.')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.')
      return
    }
    setFile(f)
    setRemovePhoto(false)
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  async function handleSave() {
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Player name is required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      let photoPath = member?.photo_path ?? null
      if (file) {
        photoPath = await uploadImageWithFallback(file, 'members')
      } else if (removePhoto) {
        photoPath = null
      }

      if (member) {
        if (isCaptain) {
          await updateCaptainPhoto(photoPath)
          toast('success', "Captain's photo updated!")
        } else {
          await updateMember(member.id, cleanName, photoPath)
          toast('success', `${cleanName} updated!`)
        }
      } else {
        await addMember(cleanName, photoPath)
        toast('success', `${cleanName} added to team roster!`)
      }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to save member.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? (isCaptain ? "Edit Captain's Photo" : `Edit ${member.name}`) : 'Add New Team Member'}
    >
      <div className="space-y-4">
        {error && <ErrorBox message={error} />}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-bark">
            Player Name *
          </label>
          <input
            type="text"
            disabled={isCaptain || busy}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
            className="input mt-1.5 w-full text-sm"
          />
          {isCaptain && (
            <p className="mt-1 text-[11px] text-bark-soft">
              Captain name is set in official registration. You can upload or update the captain's photo below.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-bark">
            Player Photo
          </label>

          <div className="mt-2 flex items-center gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-sand/40 border border-sand overflow-hidden shadow-xs">
              {preview && !removePhoto ? (
                <img src={preview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <span className="font-serif text-2xl font-bold text-bark">
                  {name.trim() ? name.trim().charAt(0).toUpperCase() : '👤'}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="btn-outline btn-sm inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
                <Camera className="h-3.5 w-3.5" />
                <span>{preview && !removePhoto ? 'Change Photo' : 'Upload Photo'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={busy}
                />
              </label>

              {preview && !removePhoto && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    setRemovePhoto(true)
                    setPreview(null)
                  }}
                  className="btn-ghost btn-sm text-xs text-red-600 block hover:bg-red-50 cursor-pointer"
                  disabled={busy}
                >
                  Remove Photo
                </button>
              )}
              <p className="text-[11px] text-bark-soft">JPG, PNG, or WebP (max 5 MB).</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-sand/50 pt-4">
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleSave}
            disabled={busy || !name.trim()}
          >
            {busy ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </span>
            ) : member ? (
              'Save Changes'
            ) : (
              'Add to Roster'
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Modal: Quick Add Multiple Players ---------- */
function LeaderQuickAddModal({
  open,
  onClose,
  existingNames,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  existingNames: string[]
  onSaved: () => void
}) {
  const toast = useToast()
  const { addMember } = useLeaderAuth()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')

  const existingSet = useMemo(
    () => new Set(existingNames.map(n => n.trim().toLowerCase())),
    [existingNames]
  )

  const parsedNames = useMemo(() => {
    return text
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean)
  }, [text])

  const newNames = useMemo(() => {
    const seen = new Set<string>()
    return parsedNames.filter(n => {
      const lower = n.toLowerCase()
      if (existingSet.has(lower) || seen.has(lower)) return false
      seen.add(lower)
      return true
    })
  }, [parsedNames, existingSet])

  async function handleAddAll() {
    if (!newNames.length) {
      setError('No new unique player names entered.')
      return
    }
    setBusy(true)
    setError('')
    let addedCount = 0
    try {
      for (let i = 0; i < newNames.length; i++) {
        const name = newNames[i]
        setProgress(`Adding player ${i + 1} of ${newNames.length}: ${name}...`)
        await addMember(name)
        addedCount++
      }
      toast('success', `Added ${addedCount} player${addedCount === 1 ? '' : 's'} to roster!`)
      setText('')
      onSaved()
      onClose()
    } catch (err: any) {
      setError(`Added ${addedCount} player(s). Error: ${err?.message || 'Failed to complete.'}`)
      onSaved()
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Quick Add Multiple Players">
      <div className="space-y-4">
        {error && <ErrorBox message={error} />}

        <p className="text-xs text-bark-soft">
          Paste or type multiple player names separated by newlines or commas. Duplicate players already in your team will be skipped automatically.
        </p>

        <textarea
          rows={6}
          disabled={busy}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={`Arjun Mehta\nKarthik R\nVigneshwar\nSachin K`}
          className="input w-full font-mono text-sm"
        />

        <div className="flex items-center justify-between text-xs text-bark-soft">
          <span>
            {newNames.length} new player{newNames.length === 1 ? '' : 's'} detected
          </span>
          {parsedNames.length > newNames.length && (
            <span className="text-amber-600 font-medium">
              ({parsedNames.length - newNames.length} duplicates skipped)
            </span>
          )}
        </div>

        {progress && (
          <p className="text-xs text-saffron-deep font-semibold flex items-center gap-1.5 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{progress}</span>
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-sand/50 pt-4">
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleAddAll}
            disabled={busy || newNames.length === 0}
          >
            {busy ? 'Adding Players...' : `Add ${newNames.length} Player${newNames.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}


/* ---------- Main Leader Portal ---------- */
export default function LeaderPortal() {
  const { session, logout, registerSport, deleteMember } = useLeaderAuth()
  const { data, loading, error, reload } = useHpl()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<'sports' | 'roster' | 'results'>('sports')
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null)
  const [unregisterConfirm, setUnregisterConfirm] = useState<Sport | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [sportFilter, setSportFilter] = useState<'all' | 'registered' | 'upcoming'>('all')
  const [liveScorecardMatch, setLiveScorecardMatch] = useState<SportMatch | null>(null)
  const [cricketStatsSport, setCricketStatsSport] = useState<Sport | null>(null)

  // Roster Management States
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<{ member: Member; isCaptain: boolean } | null>(null)
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false)
  const [deleteMemberConfirm, setDeleteMemberConfirm] = useState<Member | null>(null)
  const [deletingMember, setDeletingMember] = useState(false)

  async function handleDeleteMember() {
    if (!deleteMemberConfirm) return
    setDeletingMember(true)
    try {
      await deleteMember(deleteMemberConfirm.id)
      toast('success', `${deleteMemberConfirm.name} removed from roster.`)
      setDeleteMemberConfirm(null)
      await reload()
    } catch (err: any) {
      toast('error', err?.message || 'Failed to remove member.')
    } finally {
      setDeletingMember(false)
    }
  }

  useTitle(session ? `${session.teamName} · Team Leader Portal` : 'Team Leader Portal')

  if (!session) {
    return <Navigate to="/leader/login" replace />
  }

  const { teams, leaderboard, bundle, edition } = data

  const currentTeam = useMemo(() => {
    const t = teams.find(t => t.id === session.teamId)
    if (!t) return undefined
    const rawMembers = t.team_members ?? []
    const hasCaptain = rawMembers.some(m => m.name.trim().toLowerCase() === t.captain_name.trim().toLowerCase())
    if (hasCaptain) return t
    const captainMember: Member = {
      id: 'captain',
      team_id: t.id,
      name: t.captain_name,
      photo_path: t.captain_photo_path,
      sort_order: -1,
    }
    return {
      ...t,
      team_members: [captainMember, ...rawMembers],
    }
  }, [teams, session.teamId])

  const registeredSportIds = useMemo(() => {
    return new Set(
      bundle.sportTeams.filter(st => st.team_id === session.teamId).map(st => st.sport_id)
    )
  }, [bundle.sportTeams, session.teamId])

  const teamLeaderRow = useMemo(() => {
    return leaderboard.find(l => l.team_id === session.teamId)
  }, [leaderboard, session.teamId])

  // Get participants map: sport_id -> Participant[]
  const teamParticipantsBySport = useMemo(() => {
    const map = new Map<string, string[]>()
    bundle.participants
      .filter(p => p.team_id === session.teamId)
      .forEach(p => {
        const list = map.get(p.sport_id) ?? []
        list.push(p.player_name)
        map.set(p.sport_id, list)
      })
    return map
  }, [bundle.participants, session.teamId])

  // Get member IDs map: sport_id -> member_id[]
  const teamMemberIdsBySport = useMemo(() => {
    const map = new Map<string, string[]>()
    const capNameLower = currentTeam?.captain_name.trim().toLowerCase()
    const capMember = currentTeam?.team_members?.find(m => m.name.trim().toLowerCase() === capNameLower)
    const capId = capMember?.id ?? 'captain'

    bundle.participants
      .filter(p => p.team_id === session.teamId)
      .forEach(p => {
        const list = map.get(p.sport_id) ?? []
        if (p.member_id) {
          list.push(p.member_id)
        } else if (capNameLower && p.player_name.trim().toLowerCase() === capNameLower) {
          list.push(capId)
        }
        map.set(p.sport_id, list)
      })
    return map
  }, [bundle.participants, session.teamId, currentTeam])

  async function handleToggleRegister(sport: Sport, shouldRegister: boolean) {
    setBusyAction(sport.id)
    try {
      await registerSport(sport.id, shouldRegister)
      toast(
        'success',
        shouldRegister
          ? `Registered for ${sport.name}! You can now select your match squad.`
          : `Unregistered from ${sport.name}.`
      )
      setUnregisterConfirm(null)
      void reload()
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setBusyAction(null)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!currentTeam) {
    return (
      <div className="container-x py-16 text-center">
        <h1 className="text-3xl font-bold">Team record not found</h1>
        <p className="mt-2 text-bark-soft">
          We could not find the team associated with your login session. Please sign in again.
        </p>
        <button className="btn-primary mt-4" onClick={logout}>
          Return to Sign In
        </button>
      </div>
    )
  }

  const sportsFiltered = bundle.sports.filter(s => {
    const isReg = registeredSportIds.has(s.id)
    if (sportFilter === 'registered') return isReg
    if (sportFilter === 'upcoming') return s.status === 'upcoming'
    return true
  })

  return (
    <div className="min-h-screen bg-ivory">
      {/* Top Banner / Navigation */}
      <header className="border-b border-sand/80 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="container-x flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bark font-serif text-sm font-bold text-saffron">
                SR
              </span>
              <span className="font-serif text-lg font-bold tracking-tight">SRKSH HPL</span>
            </Link>
            <span className="hidden sm:inline-block text-sand">|</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-xs font-semibold text-bark">
              <Shield className="h-3.5 w-3.5 text-terracotta" /> Team Leader
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/hpl"
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center gap-1 text-xs font-medium text-bark-soft hover:text-bark"
            >
              Public HPL <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-full border border-sand bg-white px-3 py-1.5 text-xs font-medium text-bark hover:bg-sand/30"
            >
              <LogOut className="h-3.5 w-3.5 text-terracotta" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero / Team Badge */}
      <div className="border-b border-sand/60 bg-cream/60 py-8">
        <div className="container-x">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="relative shrink-0">
                <Img
                  src={imageUrl(currentTeam.captain_photo_path ?? currentTeam.logo_path)}
                  alt={currentTeam.name}
                  className="h-20 w-20 rounded-2xl object-cover ring-2 ring-white shadow-sm sm:h-24 sm:w-24"
                />
                <span
                  className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-white shadow-xs"
                  style={{ backgroundColor: currentTeam.colour || '#D98E2B' }}
                  title="Team Color"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight text-bark sm:text-4xl">
                    {currentTeam.name}
                  </h1>
                </div>
                <p className="mt-1 text-sm text-bark-soft">
                  Captain: <strong className="text-bark">{currentTeam.captain_name}</strong> ·{' '}
                  {currentTeam.team_members?.length ?? 0} Roster Members
                </p>
                {edition && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-bark-soft ring-1 ring-sand/60">
                    <Calendar className="h-3 w-3 text-terracotta" /> {edition.name}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0">
              <div className="rounded-2xl bg-white p-3.5 text-center shadow-xs ring-1 ring-sand/80 sm:p-4">
                <span className="block text-2xl font-bold text-terracotta sm:text-3xl">
                  {registeredSportIds.size}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-bark-soft">
                  Sports Joined
                </span>
              </div>

              <div className="rounded-2xl bg-white p-3.5 text-center shadow-xs ring-1 ring-sand/80 sm:p-4">
                <span className="block text-2xl font-bold text-bark sm:text-3xl">
                  {currentTeam.team_members?.length ?? 0}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-bark-soft">
                  Squad Size
                </span>
              </div>

              <div className="rounded-2xl bg-white p-3.5 text-center shadow-xs ring-1 ring-sand/80 sm:p-4">
                <span className="block text-2xl font-bold text-saffron-deep sm:text-3xl">
                  {teamLeaderRow ? `#${teamLeaderRow.rank}` : '—'}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-bark-soft">
                  {teamLeaderRow ? `${teamLeaderRow.total_points} Pts` : 'Leaderboard'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-8 flex border-b border-sand/80">
            <button
              onClick={() => setActiveTab('sports')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'sports'
                  ? 'border-terracotta text-terracotta'
                  : 'border-transparent text-bark-soft hover:text-bark'
              }`}
            >
              <Swords className="h-4 w-4" /> Sports & Squad Registration
            </button>
            <button
              onClick={() => setActiveTab('roster')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'roster'
                  ? 'border-terracotta text-terracotta'
                  : 'border-transparent text-bark-soft hover:text-bark'
              }`}
            >
              <Users className="h-4 w-4" /> Team Roster ({currentTeam.team_members?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'results'
                  ? 'border-terracotta text-terracotta'
                  : 'border-transparent text-bark-soft hover:text-bark'
              }`}
            >
              <Trophy className="h-4 w-4" /> Results & Standings
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="container-x py-8">
        {/* TAB 1: SPORTS & SQUADS */}
        {activeTab === 'sports' && (
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold sm:text-2xl">Sport Registrations</h2>
                <p className="text-xs text-bark-soft sm:text-sm">
                  Register your team for upcoming sports and pick your match day squad from your team roster.
                </p>
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSportFilter('all')}
                  className={`btn-sm rounded-full px-3 py-1 text-xs font-medium transition ${
                    sportFilter === 'all'
                      ? 'bg-bark text-ivory'
                      : 'bg-white text-bark-soft ring-1 ring-sand hover:bg-sand/30'
                  }`}
                >
                  All Sports ({bundle.sports.length})
                </button>
                <button
                  onClick={() => setSportFilter('registered')}
                  className={`btn-sm rounded-full px-3 py-1 text-xs font-medium transition ${
                    sportFilter === 'registered'
                      ? 'bg-bark text-ivory'
                      : 'bg-white text-bark-soft ring-1 ring-sand hover:bg-sand/30'
                  }`}
                >
                  My Registered ({registeredSportIds.size})
                </button>
                <button
                  onClick={() => setSportFilter('upcoming')}
                  className={`btn-sm rounded-full px-3 py-1 text-xs font-medium transition ${
                    sportFilter === 'upcoming'
                      ? 'bg-bark text-ivory'
                      : 'bg-white text-bark-soft ring-1 ring-sand hover:bg-sand/30'
                  }`}
                >
                  Upcoming
                </button>
              </div>
            </div>

            {sportsFiltered.length === 0 ? (
              <EmptyState
                title="No sports found"
                text={
                  sportFilter === 'registered'
                    ? "You haven't registered your team for any sports yet."
                    : 'No sports match the selected filter.'
                }
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {sportsFiltered.map(s => {
                  const isRegistered = registeredSportIds.has(s.id)
                  const squadNames = teamParticipantsBySport.get(s.id) ?? []
                  const isCompleted = s.status === 'completed'
                  const isBusy = busyAction === s.id

                  return (
                    <div
                      key={s.id}
                      className={`card transition border ${
                        isRegistered ? 'border-terracotta/40 bg-white' : 'border-sand/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Img
                            src={imageUrl(s.image_path)}
                            alt=""
                            className="h-12 w-12 rounded-xl object-cover bg-sand/30"
                          />
                          <div>
                            <h3 className="text-xl font-bold text-bark">{s.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-bark-soft">{s.category || 'General Sport'}</span>
                              {s.game_type === 'individual' ? (
                                <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-[10px] font-bold text-saffron-deep">
                                  👤 Individual {s.max_participants ? `(${s.max_participants} max)` : '(All welcome)'}
                                </span>
                              ) : (
                                <span className="rounded-full bg-sand/40 px-2 py-0.5 text-[10px] font-medium text-bark-soft">
                                  👥 Team
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge status={s.status} />
                      </div>

                      {s.description && (
                        <p className="mt-3 line-clamp-2 text-xs text-bark-soft">{s.description}</p>
                      )}

                      {/* Registration Deadline Alert */}
                      {s.registration_deadline ? (
                        <div className={`mt-3 flex items-center gap-1.5 rounded-lg p-2 text-xs ${
                          isDeadlinePassed(s.registration_deadline) ? 'bg-red-50 text-red-800 ring-1 ring-red-200' : 'bg-sand/30 text-bark'
                        }`}>
                          <Clock className={`h-3.5 w-3.5 shrink-0 ${isDeadlinePassed(s.registration_deadline) ? 'text-red-600' : 'text-terracotta'}`} />
                          <span>
                            {isDeadlinePassed(s.registration_deadline) ? 'Registration closed: ' : 'Registration closes: '}
                            <strong>{fmtDateTime(s.registration_deadline)}</strong>
                            {isDeadlinePassed(s.registration_deadline) && ' (Deadline passed)'}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-sand/20 p-2 text-xs text-bark-soft">
                          <Clock className="h-3.5 w-3.5 text-sand shrink-0" />
                          <span>Registration open (No cutoff deadline set)</span>
                        </div>
                      )}

                      {/* Registration & Squad Status Box */}
                      <div className="mt-4 rounded-xl bg-sand/20 p-3">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-bark-soft">Registration Status:</span>
                          {isRegistered ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Registered
                            </span>
                          ) : (
                            <span className="text-bark-faint">Not Registered</span>
                          )}
                        </div>

                        {isRegistered && (
                          <div className="mt-2 border-t border-sand/40 pt-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-bark-soft">
                                {s.game_type === 'individual' ? 'Selected Participant(s):' : 'Current Squad:'}
                              </span>
                              <span className="font-semibold text-bark">
                                {squadNames.length} player{squadNames.length === 1 ? '' : 's'}
                                {s.game_type === 'individual' && s.max_participants ? ` (Max ${s.max_participants})` : ''}
                              </span>
                            </div>

                            {squadNames.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {squadNames.map((name, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-bark ring-1 ring-sand/60"
                                  >
                                    <span className="text-[9px] font-bold text-terracotta">#{i + 1}</span>
                                    {name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1 text-[11px] text-amber-700 font-medium">
                                ⚠️ No player selected yet! Click "{s.game_type === 'individual' ? 'Select Participant' : 'Select Squad'}" below.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-sand/40 pt-3">
                        {isCompleted ? (
                          <span className="text-xs font-medium text-bark-faint italic">
                            Sport completed — roster locked
                          </span>
                        ) : isDeadlinePassed(s.registration_deadline) ? (
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-red-700 flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> Registration closed
                            </span>
                            {isRegistered && (
                              <button
                                type="button"
                                className="btn-outline btn-sm text-xs"
                                onClick={() => setSelectedSport(s)}
                              >
                                View {s.game_type === 'individual' ? 'Participant' : 'Squad'}
                              </button>
                            )}
                          </div>
                        ) : isRegistered ? (
                          <>
                            <button
                              type="button"
                              className="btn-accent btn-sm inline-flex items-center gap-1.5"
                              onClick={() => setSelectedSport(s)}
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>
                                {squadNames.length > 0
                                  ? (s.game_type === 'individual' ? 'Edit Participant' : 'Edit Squad')
                                  : (s.game_type === 'individual' ? 'Select Participant' : 'Select Squad')}
                              </span>
                            </button>

                            <button
                              type="button"
                              className="text-xs text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
                              onClick={() => setUnregisterConfirm(s)}
                              disabled={isBusy}
                            >
                              Unregister
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary btn-sm inline-flex items-center gap-1.5"
                            onClick={() => void handleToggleRegister(s, true)}
                            disabled={isBusy}
                          >
                            {isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            <span>Register Team</span>
                          </button>
                        )}
                      </div>

                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TEAM ROSTER */}
        {activeTab === 'roster' && (
          <div>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold sm:text-2xl flex items-center gap-2">
                  <span>Official Team Roster</span>
                  <span className="rounded-full bg-saffron-soft px-2.5 py-0.5 text-xs font-bold text-saffron-deep">
                    {currentTeam.team_members?.length ?? 0} Players
                  </span>
                </h2>
                <p className="text-xs text-bark-soft sm:text-sm mt-0.5">
                  Manage registered players of {currentTeam.name}. Add new team members, update names, and upload profile photos.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAddModalOpen(true)}
                  className="btn-outline btn-sm flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>⚡ Quick Add Multiple</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddMemberModalOpen(true)}
                  className="btn btn-sm btn-primary flex items-center gap-1.5 text-xs font-semibold"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>+ Add Player</span>
                </button>
              </div>
            </div>

            {(!currentTeam.team_members || currentTeam.team_members.length === 0) ? (
              <div className="card text-center py-12">
                <Users className="mx-auto h-12 w-12 text-sand" />
                <h3 className="mt-3 font-serif text-lg font-bold text-bark">No roster members yet</h3>
                <p className="mt-1 text-xs text-bark-soft max-w-sm mx-auto">
                  Add players to your team roster so they can be selected when picking squads for sports and matches.
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAddMemberModalOpen(true)}
                    className="btn btn-sm btn-primary"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>+ Add Your First Player</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickAddModalOpen(true)}
                    className="btn-outline btn-sm"
                  >
                    <span>⚡ Quick Add Multiple</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {currentTeam.team_members.map((m, idx) => {
                  const isCaptain =
                    m.name.trim().toLowerCase() === currentTeam.captain_name.trim().toLowerCase()
                  // Find sports this member is participating in
                  const memberSports = bundle.sports.filter(s =>
                    bundle.participants.some(
                      p => p.sport_id === s.id && p.team_id === currentTeam.id && p.member_id === m.id
                    )
                  )

                  return (
                    <div
                      key={m.id}
                      className="card flex flex-col justify-between group hover:border-saffron/70 hover:shadow-md transition"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Member Photo with hover camera trigger */}
                            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sand/40 border border-sand/70 font-serif font-bold text-bark overflow-hidden shadow-xs">
                              {m.photo_path ? (
                                <Img
                                  src={imageUrl(m.photo_path)}
                                  alt={m.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-xl">{m.name.charAt(0).toUpperCase()}</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingMember({ member: m, isCaptain })}
                                className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-white opacity-0 group-hover:opacity-100 transition cursor-pointer"
                                title="Change photo"
                              >
                                <Camera className="h-4 w-4" />
                                <span className="text-[9px] font-semibold">Photo</span>
                              </button>
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-bark text-base" title={m.name}>
                                {m.name}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                                {isCaptain ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-saffron/20 border border-saffron/40 px-2 py-0.5 text-[10px] font-bold text-saffron-deep">
                                    ⭐ Team Captain
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-sand/60 px-2 py-0.5 text-[10px] font-medium text-bark-soft">
                                    Player #{idx + 1}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: Edit & Delete */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingMember({ member: m, isCaptain })}
                              className="rounded-lg p-1.5 text-bark-soft hover:bg-sand/60 hover:text-bark transition cursor-pointer"
                              title={isCaptain ? "Edit Captain's Photo" : "Edit player name & photo"}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>

                            {!isCaptain && (
                              <button
                                type="button"
                                onClick={() => setDeleteMemberConfirm(m)}
                                className="rounded-lg p-1.5 text-bark-soft hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                                title="Remove player from roster"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Playing in sports tags */}
                        <div className="mt-3 border-t border-sand/40 pt-2.5 text-xs">
                          <span className="font-semibold text-bark-soft text-[11px] uppercase tracking-wider">
                            Playing in:
                          </span>
                          {memberSports.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {memberSports.map(s => (
                                <span
                                  key={s.id}
                                  className="rounded-full bg-cream border border-sand/60 px-2 py-0.5 text-[11px] font-medium text-bark"
                                >
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-bark-faint italic mt-0.5">
                              Not selected in any sport squad yet
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RESULTS & STANDINGS */}
        {activeTab === 'results' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold sm:text-2xl">Results & Performance</h2>
              <p className="text-xs text-bark-soft sm:text-sm">
                Track how {currentTeam.name} performed across completed sports in {edition?.name}.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Leaderboard Standing Card */}
              <div className="card lg:col-span-1">
                <h3 className="font-serif text-lg font-bold">Overall Standings</h3>
                {teamLeaderRow ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between rounded-xl bg-cream p-4">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-bark-soft">Rank</span>
                        <p className="text-3xl font-bold text-terracotta">#{teamLeaderRow.rank}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs uppercase tracking-wider text-bark-soft">Points</span>
                        <p className="text-3xl font-bold text-bark">{teamLeaderRow.total_points}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-sand/30 p-2">
                        <span className="font-bold text-bark">{teamLeaderRow.wins}</span> Wins (1st)
                      </div>
                      <div className="rounded-lg bg-sand/30 p-2">
                        <span className="font-bold text-bark">{teamLeaderRow.runner_ups}</span> Runners-up (2nd)
                      </div>
                    </div>

                    <Link to="/hpl/leaderboard" target="_blank" className="btn-outline btn-sm w-full text-center">
                      View Full League Table <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-bark-soft">No completed results yet.</p>
                )}
              </div>

              {/* Team's Scheduled Matches */}
              <div className="card lg:col-span-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-sand/60">
                  <h3 className="font-serif text-lg font-bold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-terracotta" />
                    Your Team's Match Schedule
                  </h3>

                  <div className="flex items-center gap-2">
                    {(() => {
                      const cricketSport = bundle.sports.find(s => s.name.toLowerCase().includes('cricket'))
                      return cricketSport ? (
                        <button
                          type="button"
                          className="btn-outline btn-sm py-1 px-3 text-xs font-semibold flex items-center gap-1.5 border-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100"
                          onClick={() => setCricketStatsSport(cricketSport)}
                        >
                          <TrendingUp className="h-3.5 w-3.5 text-amber-700" />
                          Cricket NRR & Caps
                        </button>
                      ) : null
                    })()}

                    <span className="text-xs text-bark-soft">
                      {
                        bundle.matches.filter(
                          m => m.team_a_id === currentTeam.id || m.team_b_id === currentTeam.id
                        ).length
                      }{' '}
                      matches
                    </span>
                  </div>
                </div>

                {bundle.matches.filter(
                  m => m.team_a_id === currentTeam.id || m.team_b_id === currentTeam.id
                ).length === 0 ? (
                  <p className="mt-4 text-sm text-bark-soft">
                    No matches scheduled for your team yet. Fixtures will appear here once announced.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {bundle.matches
                      .filter(m => m.team_a_id === currentTeam.id || m.team_b_id === currentTeam.id)
                      .map(m => {
                        const sport = bundle.sports.find(s => s.id === m.sport_id)
                        const isTeamA = m.team_a_id === currentTeam.id
                        const oppId = isTeamA ? m.team_b_id : m.team_a_id
                        const opp = data.teams.find(t => t.id === oppId)
                        const scoreDisplay = formatMatchScoreDisplay(
                          m,
                          isTeamA ? currentTeam : opp,
                          isTeamA ? opp : currentTeam
                        )

                        return (
                          <div
                            key={m.id}
                            onClick={() => (sport?.name?.toLowerCase().includes('cricket') || (sport as any)?.scoring_type === 'cricket' || m.score_data?.scoring_type === 'cricket' || m.score_data?.team_a_cricket != null) ? setLiveScorecardMatch(m) : undefined}
                            className={`rounded-2xl border p-4 shadow-soft transition ${(sport?.name?.toLowerCase().includes('cricket') || (sport as any)?.scoring_type === 'cricket' || m.score_data?.scoring_type === 'cricket' || m.score_data?.team_a_cricket != null) ? 'cursor-pointer hover:shadow-md hover:border-saffron/70' : ''} ${
                              m.status === 'live'
                                ? 'border-red-400 bg-red-50/50 ring-1 ring-red-400'
                                : m.status === 'completed'
                                ? 'border-sand bg-white'
                                : 'border-sand/60 bg-cream/30'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs text-bark-soft pb-2 border-b border-sand/40">
                              <span className="font-semibold text-bark">
                                {sport?.name ?? 'Sport'} · {m.round_name}
                              </span>
                              {m.status === 'live' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase animate-pulse">
                                  🔴 Live
                                </span>
                              )}
                              {m.status === 'completed' && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                                  Final
                                </span>
                              )}
                              {m.status === 'scheduled' && (
                                <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-medium text-bark uppercase">
                                  Scheduled
                                </span>
                              )}
                            </div>

                            <div className="my-2">
                              <p className="text-xs text-bark-soft">Opponent:</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <ColourDot colour={opp?.colour} />
                                <span className="font-serif text-base font-bold text-bark">
                                  {opp?.name ?? 'TBD'}
                                </span>
                              </div>
                            </div>

                            {(scoreDisplay.aScore || scoreDisplay.bScore || scoreDisplay.summary) && (
                              <div className="rounded-xl bg-sand/30 p-2 text-xs mb-2">
                                <div className="flex justify-between font-semibold">
                                  <span>Your Score: {isTeamA ? scoreDisplay.aScore : scoreDisplay.bScore || '—'}</span>
                                  <span>Opponent: {isTeamA ? scoreDisplay.bScore : scoreDisplay.aScore || '—'}</span>
                                </div>
                                {scoreDisplay.summary && (
                                  <p className="text-[11px] text-bark mt-1">{scoreDisplay.summary}</p>
                                )}
                              </div>
                            )}

                            {(m.scheduled_date || m.scheduled_time || m.venue) && (
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-bark-soft pt-1">
                                {m.scheduled_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {m.scheduled_date}
                                  </span>
                                )}
                                {m.scheduled_time && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {m.scheduled_time}
                                  </span>
                                )}
                                {m.venue && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {m.venue}
                                  </span>
                                )}
                              </div>
                            )}

                            {(sport?.name?.toLowerCase().includes('cricket') || (sport as any)?.scoring_type === 'cricket' || m.score_data?.scoring_type === 'cricket' || m.score_data?.team_a_cricket != null) && (
                              <div className="pt-2">
                                <button
                                  type="button"
                                  className="btn-outline btn-sm w-full py-1 text-xs font-semibold flex items-center justify-center gap-1.5 border-saffron bg-saffron-soft/20 text-bark hover:bg-saffron-soft"
                                  onClick={() => setLiveScorecardMatch(m)}
                                >
                                  📊 View Live Scorecard & Commentary
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>

              {/* Completed Sports List */}
              <div className="card lg:col-span-2">
                <h3 className="font-serif text-lg font-bold">Sport Placements</h3>
                {bundle.results.filter(r => r.status === 'completed').length === 0 ? (
                  <p className="mt-4 text-sm text-bark-soft">No sports have completed results yet.</p>
                ) : (
                  <div className="mt-4 divide-y divide-sand/60">
                    {bundle.results
                      .filter(r => r.status === 'completed')
                      .map(r => {
                        const sport = bundle.sports.find(s => s.id === r.sport_id)
                        const teamPlacements = bundle.placements
                          .filter(p => p.result_id === r.id && p.team_id === currentTeam.id)
                          .sort((a, b) => a.placement - b.placement)

                        return (
                          <div key={r.id} className="flex items-center justify-between py-3">
                            <div>
                              <p className="font-semibold text-bark">{sport?.name ?? 'Sport'}</p>
                              <p className="text-xs text-bark-soft">{sport?.category ?? 'Event'}</p>
                            </div>
                            <div className="text-right">
                              {teamPlacements.length > 0 ? (
                                <div className="flex flex-wrap justify-end gap-1.5">
                                  {teamPlacements.map(pl => (
                                    <span
                                      key={pl.id}
                                      className="inline-flex items-center gap-1 rounded-full bg-saffron-soft px-3 py-1 text-xs font-bold text-bark"
                                    >
                                      <Award className="h-3.5 w-3.5 text-terracotta" />
                                      {ordinal(pl.placement)} Place
                                      {pl.player_name && (
                                        <span className="font-medium text-bark-soft">({pl.player_name})</span>
                                      )}
                                      <span className="text-terracotta font-semibold">· {pl.points ?? 0} pts</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-bark-faint">No placement recorded</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Squad Selection Modal */}
      {selectedSport && (
        <SquadModal
          sport={selectedSport}
          team={currentTeam}
          currentMemberIds={teamMemberIdsBySport.get(selectedSport.id) ?? []}
          onClose={() => setSelectedSport(null)}
          onSaved={() => void reload()}
        />
      )}

      {/* Unregister Confirmation Dialog */}
      <ConfirmDialog
        open={!!unregisterConfirm}
        busy={busyAction === unregisterConfirm?.id}
        title={`Unregister from ${unregisterConfirm?.name}?`}
        message="This will remove your team and selected squad from this sport."
        confirmLabel="Unregister"
        onCancel={() => setUnregisterConfirm(null)}
        onConfirm={() => unregisterConfirm && void handleToggleRegister(unregisterConfirm, false)}
      />

      {/* Live Cricket Scorecard Modal */}
      {liveScorecardMatch && (
        <CricketLiveScorecard
          open={!!liveScorecardMatch}
          onClose={() => setLiveScorecardMatch(null)}
          match={liveScorecardMatch}
          teams={data.teams}
        />
      )}

      {/* Cricket Tournament Stats & NRR Modal */}
      {cricketStatsSport && (
        <CricketTournamentStats
          open={!!cricketStatsSport}
          onClose={() => setCricketStatsSport(null)}
          sport={cricketStatsSport}
          teams={data.teams}
          bundle={bundle}
        />
      )}

      {/* Add / Edit Member & Photo Modal */}
      {(addMemberModalOpen || editingMember) && (
        <LeaderMemberModal
          open={addMemberModalOpen || !!editingMember}
          onClose={() => {
            setAddMemberModalOpen(false)
            setEditingMember(null)
          }}
          member={editingMember?.member ?? null}
          teamId={currentTeam?.id ?? session.teamId}
          isCaptain={editingMember?.isCaptain}
          onSaved={() => void reload()}
        />
      )}

      {/* Quick Add Multiple Players Modal */}
      {quickAddModalOpen && (
        <LeaderQuickAddModal
          open={quickAddModalOpen}
          onClose={() => setQuickAddModalOpen(false)}
          existingNames={(currentTeam?.team_members ?? []).map(m => m.name)}
          onSaved={() => void reload()}
        />
      )}

      {/* Delete Member Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteMemberConfirm}
        busy={deletingMember}
        title={`Remove ${deleteMemberConfirm?.name} from roster?`}
        message="This will remove the player from your official team roster and any sport squads they were registered in."
        confirmLabel="Remove Player"
        onCancel={() => setDeleteMemberConfirm(null)}
        onConfirm={() => void handleDeleteMember()}
      />
    </div>
  )
}
