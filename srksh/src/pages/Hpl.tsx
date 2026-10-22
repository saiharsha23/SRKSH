import { Link } from 'react-router-dom'
import { Handshake, MessageCircle, ShieldHalf, Swords, Trophy, UsersRound } from 'lucide-react'
import { useTitle } from '../lib/useTitle'
import { useHpl } from '../lib/data'
import { EmptyState, ErrorBox, SectionHead, Spinner } from '../components/ui'
import { SportCard, SportsGrid, TeamCard } from '../components/hpl'
import Leaderboard from '../components/Leaderboard'
import type { ReactNode } from 'react'

function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="container-x pt-14">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="text-5xl font-semibold sm:text-6xl">{title}</h1>
      {children}
    </div>
  )
}

function HplNav() {
  const l = [['/hpl/teams', 'Teams'], ['/hpl/sports', 'Sports'], ['/hpl/results', 'Results'], ['/hpl/leaderboard', 'Leaderboard']]
  return <div className="mt-6 flex flex-wrap gap-2">{l.map(([to, t]) => <Link key={to} to={to} className="rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-bark-soft ring-1 ring-sand hover:bg-bark hover:text-ivory">{t}</Link>)}</div>
}

function Body({ children }: { children: (d: ReturnType<typeof useHpl>['data']) => ReactNode }) {
  const { data, loading, error, reload } = useHpl()
  return (
    <div className="container-x py-10">
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.edition ? (
        <EmptyState title="HPL is being set up" text="The league details will appear here soon." />
      ) : children(data)}
    </div>
  )
}

export function HplLanding() {
  useTitle('SRKSH Home Premiere League (HPL)', 'SRKSH Home Premiere League — teams, sports, results and the live leaderboard.')
  const vals = [
    { i: UsersRound, t: 'Teamwork' }, { i: Swords, t: 'Competitive spirit' }, { i: ShieldHalf, t: 'Confidence' },
    { i: Trophy, t: 'Leadership' }, { i: MessageCircle, t: 'Communication' }, { i: Handshake, t: 'Community bonding' },
  ]
  return (
    <>
      <section className="relative overflow-hidden bg-cream/70">
        <div className="container-x grid gap-10 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="eyebrow">SRKSH Home Premiere League</p>
            <h1 className="text-5xl font-semibold leading-tight sm:text-6xl">Play together. Grow together.</h1>
            <p className="mt-6 text-bark-soft">SRKSH Home Premiere League brings residents together through sports, cultural activities, and friendly competition. Organised by the students, HPL creates opportunities for juniors and seniors to interact, build friendships, develop confidence, and strengthen the spirit of teamwork and belonging within the Home.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/hpl/teams" className="btn-primary">View Teams</Link>
              <Link to="/hpl/sports" className="btn-outline">Explore Sports</Link>
              <Link to="/hpl/results" className="btn-outline">View HPL Results</Link>
              <Link to="/hpl/leaderboard" className="btn-accent">View Leaderboard</Link>
            </div>
          </div>
          <div className="card">
            <h2 className="text-2xl font-semibold">About HPL</h2>
            <p className="mt-3 text-sm text-bark-soft">HPL is an annual student-organised initiative in which final-year students organise sports and cultural activities to help residents interact, communicate more freely, develop friendships across batches, and feel comfortable in the Home. Activities may include cricket, football, volleyball, badminton, chess, carrom, other sports, and cultural competitions.</p>
            <ul className="mt-5 grid grid-cols-2 gap-3">
              {vals.map(v => <li key={v.t} className="flex items-center gap-2 text-sm font-medium"><v.i className="h-5 w-5 text-terracotta" />{v.t}</li>)}
            </ul>
          </div>
        </div>
      </section>
      <Body>{d => (
        <div className="space-y-14">
          <div>
            <SectionHead eyebrow={d.edition?.name ?? ''} title="Standings" />
            <Leaderboard rows={d.leaderboard} compact />
          </div>
        </div>
      )}</Body>
    </>
  )
}

export function HplTeams() {
  useTitle('HPL Teams · SRKSH', 'Meet the SRKSH Home Premiere League teams, captains and rosters.')
  return (
    <>
      <PageHead eyebrow="SRKSH HPL" title="Teams"><HplNav /></PageHead>
      <Body>{d => d.teams.length ? (
        <div className="grid gap-6 md:grid-cols-2">{d.teams.map(t => <TeamCard key={t.id} team={t} row={d.leaderboard.find(l => l.team_id === t.id)} />)}</div>
      ) : <EmptyState title="Teams will be announced soon" />}</Body>
    </>
  )
}

export function HplSports() {
  useTitle('HPL Sports · SRKSH', 'Sports and activities in the SRKSH Home Premiere League.')
  return (
    <>
      <PageHead eyebrow="SRKSH HPL" title="Sports"><HplNav /></PageHead>
      <Body>{d => <SportsGrid bundle={d.bundle} teams={d.teams} emptyText="Sports will be announced soon." />}</Body>
    </>
  )
}

export function HplResults() {
  useTitle('HPL Results · SRKSH', 'Latest SRKSH Home Premiere League results and standings.')
  return (
    <>
      <PageHead eyebrow="SRKSH HPL" title="HPL Results"><HplNav /></PageHead>
      <Body>{d => (
        <div className="space-y-14">
          <div>
            <SectionHead eyebrow={d.edition?.name ?? ''} title="Leaderboard" />
            <Leaderboard rows={d.leaderboard} />
          </div>
          <div>
            <SectionHead eyebrow="Sport by sport" title="Results" />
            <SportsGrid bundle={d.bundle} teams={d.teams} />
          </div>
        </div>
      )}</Body>
    </>
  )
}

export function HplLeaderboard() {
  useTitle('HPL Leaderboard · SRKSH', 'Live SRKSH Home Premiere League leaderboard, calculated automatically from saved results.')
  return (
    <>
      <PageHead eyebrow="SRKSH HPL" title="Leaderboard"><HplNav /></PageHead>
      <Body>{d => (
        <div>
          <p className="mb-6 text-sm text-bark-soft">Points are calculated automatically from completed sport results. Tied teams share the same rank.</p>
          <Leaderboard rows={d.leaderboard} />
        </div>
      )}</Body>
    </>
  )
}
