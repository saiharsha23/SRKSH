import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  LogOut,
  Plus,
  Search,
  Shield,
  Swords,
  Trophy,
  UserCheck,
  Users,
  X,
  Loader2,
} from 'lucide-react'
import { useHpl } from '../../lib/data'
import { useLeaderAuth } from '../../lib/leaderAuth'
import { imageUrl } from '../../lib/supabase'
import type { Sport, Team, Member } from '../../types'
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
import { ordinal } from '../../lib/format'

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
  const roster = team.team_members ?? []

  // Keep ordered array of selected member IDs (by selection order, NOT ascending)
  const [selectedIds, setSelectedIds] = useState<string[]>(currentMemberIds)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  // Display by selected one first (in exact selection order), then remaining available members
  const sortedRoster = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q ? roster.filter(m => m.name.toLowerCase().includes(q)) : [...roster]

    return pool.sort((a, b) => {
      const aIdx = selectedIds.indexOf(a.id)
      const bIdx = selectedIds.indexOf(b.id)
      const aSel = aIdx !== -1
      const bSel = bIdx !== -1

      if (aSel && bSel) return aIdx - bIdx // preserve leader selection order
      if (aSel && !bSel) return -1 // selected member displayed first
      if (!aSel && bSel) return 1
      return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
    })
  }, [roster, query, selectedIds])

  function toggleMember(id: string) {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id)
      } else {
        return [...prev, id] // added in order of selection
      }
    })
  }

  function selectAll() {
    const existing = new Set(selectedIds)
    const toAdd = roster.filter(m => !existing.has(m.id)).map(m => m.id)
    setSelectedIds([...selectedIds, ...toAdd])
  }

  function clearAll() {
    setSelectedIds([])
  }

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      await saveSquad(sport.id, selectedIds)
      toast('success', `Squad for ${sport.name} updated (${selectedIds.length} player${selectedIds.length === 1 ? '' : 's'}).`)
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save squad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={`Select Squad: ${sport.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sand/30 p-3 text-sm">
          <div>
            <span className="font-semibold">{team.name} Roster</span>
            <span className="ml-2 text-bark-soft">
              ({selectedIds.length} of {roster.length} selected)
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-outline btn-sm text-xs"
              onClick={selectAll}
              disabled={saving || roster.length === 0}
            >
              Select All
            </button>
            <button
              type="button"
              className="btn-outline btn-sm text-xs"
              onClick={clearAll}
              disabled={saving || selectedIds.length === 0}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Selected Squad Lineup Strip (Ordered by Selection) */}
        {selectedIds.length > 0 && (
          <div className="rounded-xl border border-sand bg-saffron-soft/20 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-bark">
              <span className="flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-terracotta" />
                Selected Squad Lineup ({selectedIds.length})
              </span>
              <span className="text-[11px] font-normal text-bark-soft">Ordered by selection</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {selectedIds.map((id, idx) => {
                const member = roster.find(m => m.id === id)
                if (!member) return null
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-bark shadow-xs ring-1 ring-sand/80"
                  >
                    <span className="rounded-full bg-terracotta/15 px-1.5 py-0.2 text-[10px] font-bold text-terracotta">
                      #{idx + 1}
                    </span>
                    <span className="truncate max-w-[130px]">{member.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleMember(id)}
                      className="text-bark-soft hover:text-red-700"
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
        ) : sortedRoster.length === 0 ? (
          <p className="py-4 text-center text-sm text-bark-soft">No members match your search.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-xl border border-sand/80 divide-y divide-sand/40">
            {sortedRoster.map(m => {
              const isChecked = selectedSet.has(m.id)
              const selectedIdx = selectedIds.indexOf(m.id)
              const isCaptain = m.name.trim().toLowerCase() === team.captain_name.trim().toLowerCase()

              return (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 p-3 transition hover:bg-cream/80 ${
                    isChecked ? 'bg-saffron-soft/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
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
                        {m.name}
                        {isCaptain && (
                          <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-bark">
                            Captain
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {isChecked ? (
                    <span className="shrink-0 text-xs font-semibold text-terracotta flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Selected (#{selectedIdx + 1})
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
            Cancel
          </button>
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
              `Confirm Squad (${selectedIds.length})`
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}


/* ---------- Main Leader Portal ---------- */
export default function LeaderPortal() {
  const { session, logout, registerSport } = useLeaderAuth()
  const { data, loading, error, reload } = useHpl()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<'sports' | 'roster' | 'results'>('sports')
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null)
  const [unregisterConfirm, setUnregisterConfirm] = useState<Sport | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [sportFilter, setSportFilter] = useState<'all' | 'registered' | 'upcoming'>('all')

  useTitle(session ? `${session.teamName} · Team Leader Portal` : 'Team Leader Portal')

  if (!session) {
    return <Navigate to="/leader/login" replace />
  }

  const { teams, leaderboard, bundle, edition } = data

  const currentTeam = useMemo(() => {
    return teams.find(t => t.id === session.teamId)
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
    bundle.participants
      .filter(p => p.team_id === session.teamId && p.member_id)
      .forEach(p => {
        const list = map.get(p.sport_id) ?? []
        list.push(p.member_id!)
        map.set(p.sport_id, list)
      })
    return map
  }, [bundle.participants, session.teamId])

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
                            <p className="text-xs text-bark-soft">{s.category || 'General Sport'}</p>
                          </div>
                        </div>
                        <Badge status={s.status} />
                      </div>

                      {s.description && (
                        <p className="mt-3 line-clamp-2 text-xs text-bark-soft">{s.description}</p>
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
                              <span className="text-bark-soft">Current Squad:</span>
                              <span className="font-semibold text-bark">
                                {squadNames.length} player{squadNames.length === 1 ? '' : 's'}
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
                                ⚠️ No players selected yet! Click "Select Squad" below.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-sand/40 pt-3">
                        {isCompleted ? (
                          <span className="text-xs font-medium text-bark-faint italic">
                            Sport completed — squad locked
                          </span>
                        ) : isRegistered ? (
                          <>
                            <button
                              type="button"
                              className="btn-accent btn-sm inline-flex items-center gap-1.5"
                              onClick={() => setSelectedSport(s)}
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>{squadNames.length > 0 ? 'Edit Squad' : 'Select Squad'}</span>
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
            <div className="mb-6">
              <h2 className="text-xl font-bold sm:text-2xl">Official Team Roster</h2>
              <p className="text-xs text-bark-soft sm:text-sm">
                These are the registered members of {currentTeam.name}. Only players on this roster can be selected for sports squads.
              </p>
            </div>

            {(!currentTeam.team_members || currentTeam.team_members.length === 0) ? (
              <EmptyState
                title="No roster members"
                text="Ask an administrator to add players to your team roster in the Admin panel."
              />
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
                    <div key={m.id} className="card flex flex-col justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sand/40 font-serif font-bold text-bark">
                          {m.photo_path ? (
                            <Img
                              src={imageUrl(m.photo_path)}
                              alt={m.name}
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            m.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-bark">{m.name}</p>
                          <p className="text-xs text-bark-soft">
                            {isCaptain ? (
                              <span className="font-bold text-terracotta">Captain</span>
                            ) : (
                              `Player #${idx + 1}`
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-sand/40 pt-3 text-xs">
                        <span className="font-medium text-bark-soft">Playing in:</span>
                        {memberSports.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {memberSports.map(s => (
                              <span
                                key={s.id}
                                className="rounded bg-cream px-2 py-0.5 text-[11px] font-medium text-bark"
                              >
                                {s.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-bark-faint italic mt-0.5">Not assigned to any sport squad</p>
                        )}
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
                        const placement = bundle.placements.find(
                          p => p.result_id === r.id && p.team_id === currentTeam.id
                        )

                        return (
                          <div key={r.id} className="flex items-center justify-between py-3">
                            <div>
                              <p className="font-semibold text-bark">{sport?.name ?? 'Sport'}</p>
                              <p className="text-xs text-bark-soft">{sport?.category ?? 'Event'}</p>
                            </div>
                            <div className="text-right">
                              {placement ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-saffron-soft px-3 py-1 text-xs font-bold text-bark">
                                  <Award className="h-3.5 w-3.5 text-terracotta" />
                                  {ordinal(placement.placement)} Place ({placement.points ?? 0} pts)
                                </span>
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
    </div>
  )
}
