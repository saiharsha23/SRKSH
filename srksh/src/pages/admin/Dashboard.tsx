import { Link } from 'react-router-dom'
import { Crown, ListChecks, Swords, Users, UserRound } from 'lucide-react'
import { useHpl } from '../../lib/data'
import { fmtPoints } from '../../lib/format'
import { ErrorBox, Spinner } from '../../components/ui'
import Leaderboard from '../../components/Leaderboard'
import { PageTitle } from './common'

export default function Dashboard() {
  const { data, loading, error, reload } = useHpl()
  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  const { edition, teams, leaderboard, bundle } = data
  if (!edition) {
    return (
      <>
        <PageTitle title="Dashboard" />
        <div className="card text-center"><h2 className="text-2xl font-semibold">Create your first HPL edition</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-bark-soft">Teams, sports and results belong to an edition (for example "HPL 2026"). Create one in Settings to begin.</p>
          <Link to="/admin/settings" className="btn-primary mt-5">Go to Settings</Link></div>
      </>
    )
  }
  const members = teams.reduce((n, t) => n + (t.team_members?.length ?? 0), 0)
  const completed = bundle.results.filter(r => r.status === 'completed').length
  const anyPoints = leaderboard.some(r => Number(r.total_points) > 0)
  const leaders = anyPoints ? leaderboard.filter(r => r.rank === 1) : []
  const cards = [
    { icon: Users, label: 'Total teams', value: teams.length },
    { icon: UserRound, label: 'Registered members', value: members },
    { icon: Swords, label: 'Total sports', value: bundle.sports.length },
    { icon: ListChecks, label: 'Completed results', value: completed },
  ]
  return (
    <>
      <PageTitle title="Dashboard" text={`${edition.name} · ${edition.status}`} />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(c => (
          <div key={c.label} className="card"><c.icon className="h-5 w-5 text-terracotta" /><p className="mt-3 font-serif text-4xl font-bold">{c.value}</p><p className="text-xs uppercase tracking-wide text-bark-soft">{c.label}</p></div>
        ))}
        <div className="card bg-saffron-soft/50">
          <Crown className="h-5 w-5 text-saffron-deep" />
          <p className="mt-3 font-serif text-2xl font-bold leading-tight">{leaders.length ? leaders.map(l => l.team_name).join(' & ') : '—'}</p>
          <p className="text-xs uppercase tracking-wide text-bark-soft">{leaders.length > 1 ? 'Tied for the lead' : 'Current leader'}{leaders[0] ? ` · ${fmtPoints(leaders[0].total_points)} pts` : ''}</p>
        </div>
      </div>
      <h2 className="mb-4 mt-12 text-3xl font-semibold">Current standings</h2>
      <Leaderboard rows={leaderboard} />
    </>
  )
}
