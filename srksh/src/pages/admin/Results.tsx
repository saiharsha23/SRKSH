import { Link } from 'react-router-dom'
import { useHpl } from '../../lib/data'
import { Badge, EmptyState, ErrorBox, Spinner, ColourDot } from '../../components/ui'
import { fmtPoints, ordinal } from '../../lib/format'
import { PageTitle } from './common'
import Leaderboard from '../../components/Leaderboard'

export default function Results() {
  const { data, loading, error, reload } = useHpl()
  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!data.edition) return <EmptyState title="No HPL edition yet" text="Create an edition in Settings first." />
  const { bundle, teams } = data
  return (
    <>
      <PageTitle title="Results and Points" text="All sports in one place. Open a sport to enter or correct its result." />
      {!bundle.sports.length ? <EmptyState title="No sports yet" text="Create sports first, then record their results." action={<Link to="/admin/sports" className="btn-primary">Go to Sports</Link>} /> : (
        <div className="overflow-x-auto rounded-3xl bg-white/70 shadow-soft ring-1 ring-sand">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-bark text-xs uppercase tracking-wider text-ivory"><tr><th className="px-5 py-3">Sport</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Result</th><th className="px-5 py-3">Placements</th><th className="px-5 py-3" /></tr></thead>
            <tbody>
              {bundle.sports.map(s => {
                const r = bundle.results.find(x => x.sport_id === s.id)
                const pl = r ? bundle.placements.filter(p => p.result_id === r.id).sort((a, b) => a.placement - b.placement) : []
                return (
                  <tr key={s.id} className="border-t border-sand align-top">
                    <td className="px-5 py-3 font-serif text-lg font-semibold">{s.name}</td>
                    <td className="px-5 py-3"><Badge status={s.status} /></td>
                    <td className="px-5 py-3"><Badge status={r?.status ?? 'pending'} /></td>
                    <td className="px-5 py-3">
                      {pl.length ? <ul className="space-y-1">{pl.map(p => { const t = teams.find(t => t.id === p.team_id); return <li key={p.id} className="flex items-center gap-2"><span className="w-20 text-xs text-bark-soft">{p.placement === 1 ? 'Winner' : p.placement === 2 ? 'Runner-up' : ordinal(p.placement)}</span><ColourDot colour={t?.colour} />{t?.name} <span className="text-terracotta-deep">· {p.points == null ? 'no points' : `${fmtPoints(p.points)} pts`}</span>{r?.status !== 'completed' && <span className="text-xs text-bark-faint">(not counted)</span>}</li> })}</ul> : <span className="text-bark-faint">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right"><Link to={`/admin/sports/${s.id}`} className="btn-outline btn-sm">Manage</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="mb-4 mt-12 text-3xl font-semibold">Leaderboard</h2>
      <Leaderboard rows={data.leaderboard} />
    </>
  )
}
