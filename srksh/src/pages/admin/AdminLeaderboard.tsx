import { Link } from 'react-router-dom'
import { useHpl } from '../../lib/data'
import { EmptyState, ErrorBox, Spinner } from '../../components/ui'
import Leaderboard from '../../components/Leaderboard'
import { PageTitle } from './common'

export default function AdminLeaderboard() {
  const { data, loading, error, reload } = useHpl()
  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!data.edition) return <EmptyState title="No HPL edition yet" text="Create an edition in Settings first." />
  return (
    <>
      <PageTitle title="Leaderboard" text={`${data.edition.name} · calculated automatically from completed results — totals cannot be edited here.`} />
      <Leaderboard rows={data.leaderboard} />
      <p className="mt-5 text-sm text-bark-soft">
        Ties share the same rank (competition ranking: 1, 1, 3).{' '}
        {data.edition.tie_break === 'wins' ? 'Tie-break rule in use: number of sports won.' : 'No tie-break rule is configured, so teams with equal points share a rank.'}{' '}
        <Link to="/admin/settings" className="font-medium text-terracotta-deep underline">Change in Settings</Link>
      </p>
    </>
  )
}
