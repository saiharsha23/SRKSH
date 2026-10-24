import { useState } from 'react'
import { ChevronDown, Clock, Crown, Medal, Users } from 'lucide-react'
import type { LeaderRow, Participant, Placement, Sport, SportResult, SportTeam, Team } from '../types'
import type { SportBundle } from '../lib/data'
import { imageUrl } from '../lib/supabase'
import { fmtDateTime, fmtPoints, isDeadlinePassed, ordinal } from '../lib/format'
import { Badge, ColourDot, EmptyState, Img } from './ui'

export function TeamCard({ team, row }: { team: Team; row?: LeaderRow }) {
  const [open, setOpen] = useState(false)
  const members = team.team_members ?? []
  const logo = imageUrl(team.logo_path)
  const cap = imageUrl(team.captain_photo_path)
  const colour = team.colour || '#C2A15A'
  const anyPoints = row && Number(row.total_points) > 0
  return (
    <article className="overflow-hidden rounded-3xl bg-white/70 shadow-soft ring-1 ring-sand transition duration-300 hover:-translate-y-1">
      <div className="h-2" style={{ background: colour }} />
      <div className="p-6">
        <header className="flex items-start gap-4">
          {logo ? <Img src={logo} alt={`${team.name} logo`} className="h-14 w-14 rounded-2xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-2xl font-serif text-2xl font-bold text-white" style={{ background: colour }} aria-hidden>{team.name.charAt(0)}</span>}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-3xl font-semibold">{team.name}</h3>
            {team.description && <p className="mt-1 line-clamp-2 text-sm text-bark-soft">{team.description}</p>}
          </div>
        </header>
        <div className="mt-5 flex items-center gap-4 rounded-2xl bg-cream/80 p-3">
          {cap ? <Img src={cap} alt={`Captain ${team.captain_name}`} className="h-16 w-16 rounded-full object-cover ring-2 ring-saffron" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sand font-serif text-2xl text-bark-soft" aria-hidden>{team.captain_name.charAt(0)}</span>}
          <div>
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-terracotta"><Crown className="h-3 w-3" />Captain</p>
            <p className="font-serif text-2xl font-semibold leading-tight">{team.captain_name}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-ivory p-3 ring-1 ring-sand"><dt className="text-[10px] uppercase tracking-wider text-bark-soft">Members</dt><dd className="font-serif text-2xl font-bold">{members.length}</dd></div>
          <div className="rounded-2xl bg-ivory p-3 ring-1 ring-sand"><dt className="text-[10px] uppercase tracking-wider text-bark-soft">Points</dt><dd className="font-serif text-2xl font-bold text-terracotta-deep">{fmtPoints(row?.total_points ?? 0)}</dd></div>
          <div className="rounded-2xl bg-ivory p-3 ring-1 ring-sand"><dt className="text-[10px] uppercase tracking-wider text-bark-soft">Position</dt><dd className="font-serif text-2xl font-bold">{anyPoints && row ? ordinal(row.rank) : '—'}</dd></div>
        </dl>
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="mt-5 flex w-full items-center justify-between rounded-full border border-bark/20 px-5 py-2.5 text-sm font-medium hover:bg-bark hover:text-ivory">
          {open ? 'Hide roster' : 'View full roster'} <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          members.length ? (
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {members.map(m => {
                const p = imageUrl(m.photo_path)
                return (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    {p ? <Img src={p} alt={m.name} className="h-7 w-7 rounded-full object-cover" /> : <ColourDot colour={team.colour} />}
                    {m.name}
                  </li>
                )
              })}
            </ul>
          ) : <p className="mt-4 text-sm text-bark-soft">No members added yet.</p>
        )}
      </div>
    </article>
  )
}

export function SportCard({ sport, bundle, teams, defaultOpen }: { sport: Sport; bundle: SportBundle; teams: Team[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const teamName = (id: string) => teams.find(t => t.id === id)
  const sTeams: SportTeam[] = bundle.sportTeams.filter(st => st.sport_id === sport.id)
  const parts: Participant[] = bundle.participants.filter(p => p.sport_id === sport.id)
  const result: SportResult | undefined = bundle.results.find(r => r.sport_id === sport.id)
  const placements: Placement[] = result ? bundle.placements.filter(p => p.result_id === result.id).sort((a, b) => a.placement - b.placement) : []
  const done = result?.status === 'completed' && placements.length > 0
  const img = imageUrl(sport.image_path)
  return (
    <article className={`overflow-hidden rounded-3xl p-6 shadow-soft ring-1 transition ${done ? 'bg-gradient-to-br from-saffron-soft/50 to-white ring-saffron/50' : 'bg-white/70 ring-sand'}`}>
      <header className="flex items-start gap-4">
        {img ? <Img src={img} alt={`${sport.name} icon`} className="h-14 w-14 rounded-2xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bark font-serif text-2xl font-bold text-saffron" aria-hidden>{sport.name.charAt(0)}</span>}
        <div className="min-w-0 flex-1">
          <h3 className="text-3xl font-semibold">{sport.name}</h3>
          <p className="text-xs uppercase tracking-wider text-bark-soft">{sport.category || 'Sport'}</p>
        </div>
        <Badge status={sport.status} />
      </header>
      {sport.description && <p className="mt-3 text-sm text-bark-soft">{sport.description}</p>}

      {sport.registration_deadline && (
        <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
          isDeadlinePassed(sport.registration_deadline)
            ? 'bg-red-50 text-red-800 ring-1 ring-red-200'
            : 'bg-sand/40 text-bark'
        }`}>
          <Clock className={`h-3.5 w-3.5 shrink-0 ${isDeadlinePassed(sport.registration_deadline) ? 'text-red-600' : 'text-terracotta'}`} />
          <span>
            {isDeadlinePassed(sport.registration_deadline) ? 'Registration Closed: ' : 'Registration Closes: '}
            <strong>{fmtDateTime(sport.registration_deadline)}</strong>
          </span>
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-ivory/80 p-4 ring-1 ring-sand">
        {done ? (
          <ul className="space-y-2">
            {placements.map(p => {
              const t = teamName(p.team_id)
              return (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium">
                    <Medal className={`h-5 w-5 ${p.placement === 1 ? 'text-gold' : p.placement === 2 ? 'text-gray-400' : 'text-[#A8683A]'}`} />
                    <span className="text-xs uppercase tracking-wide text-bark-soft">{p.placement === 1 ? 'Winner' : p.placement === 2 ? 'Runner-up' : ordinal(p.placement)}</span>
                    <ColourDot colour={t?.colour} />{t?.name ?? 'Unknown team'}
                  </span>
                  <span className="font-serif text-xl font-bold text-terracotta-deep">{p.points == null ? '—' : `${fmtPoints(p.points)} pts`}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm font-medium text-bark-soft">Result: <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold">Pending</span></p>
        )}
      </div>

      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="mt-4 flex w-full items-center justify-between text-sm font-medium text-terracotta-deep">
        <span className="flex items-center gap-2"><Users className="h-4 w-4" />{sTeams.length} participating team{sTeams.length === 1 ? '' : 's'} · {parts.length} player{parts.length === 1 ? '' : 's'}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        sTeams.length ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {sTeams.map(st => {
              const t = teamName(st.team_id)
              const ps = parts.filter(p => p.team_id === st.team_id)
              return (
                <div key={st.team_id}>
                  <p className="flex items-center gap-2 font-serif text-lg font-semibold"><ColourDot colour={t?.colour} />{t?.name}</p>
                  {ps.length ? <ul className="ml-5 mt-1 list-disc text-sm text-bark-soft">{ps.map(p => <li key={p.id}>{p.player_name}</li>)}</ul> : <p className="ml-5 text-sm text-bark-faint">No players listed yet.</p>}
                </div>
              )
            })}
          </div>
        ) : <p className="mt-3 text-sm text-bark-soft">Participants have not been announced yet.</p>
      )}
    </article>
  )
}

export function SportFilters({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = [['all', 'All Sports'], ['upcoming', 'Upcoming'], ['in_progress', 'In Progress'], ['completed', 'Completed']]
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter sports">
      {opts.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)} className={`rounded-full px-5 py-2 text-sm font-medium transition ${value === k ? 'bg-bark text-ivory' : 'bg-white/70 text-bark-soft ring-1 ring-sand hover:bg-sand/60'}`}>{l}</button>
      ))}
    </div>
  )
}

export function SportsGrid({ bundle, teams, emptyText }: { bundle: SportBundle; teams: Team[]; emptyText?: string }) {
  const [f, setF] = useState('all')
  const list = bundle.sports.filter(s => f === 'all' || s.status === f)
  if (!bundle.sports.length) return <EmptyState title="Results are on their way!" text={emptyText ?? 'Check back soon to see the latest HPL standings.'} />
  return (
    <div>
      <SportFilters value={f} onChange={setF} />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {list.map(s => <SportCard key={s.id} sport={s} bundle={bundle} teams={teams} />)}
      </div>
      {!list.length && <div className="mt-8"><EmptyState title="Nothing here yet" text="No sports match this filter." /></div>}
    </div>
  )
}
