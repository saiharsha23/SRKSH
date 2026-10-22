import { Link } from 'react-router-dom'
import { Hero, AboutUs, Mission, HowItWorks, Legacy, AboutPhotos, StudentLife, Supporters } from '../components/sections'
import { SectionHead, Spinner, ErrorBox, EmptyState, Img } from '../components/ui'
import { SportCard, TeamCard } from '../components/hpl'
import Leaderboard from '../components/Leaderboard'
import { getGallery, useHpl, useQuery } from '../lib/data'
import { imageUrl } from '../lib/supabase'
import { useTitle } from '../lib/useTitle'

function HplPreview() {
  const { data, loading, error, reload } = useHpl()
  const { teams, leaderboard, bundle, edition } = data
  const completed = bundle.sports.filter(s => bundle.results.find(r => r.sport_id === s.id)?.status === 'completed')
  const latest = (completed.length ? completed : bundle.sports).slice(-2).reverse()
  return (
    <>
      <section className="bg-cream/70 py-16 md:py-24">
        <div className="container-x">
          <div className="mb-10 grid items-end gap-6 md:grid-cols-2">
            <div><p className="eyebrow">SRKSH Home Premiere League{edition ? ` · ${edition.name}` : ''}</p><h2 className="h2">Friendly competition, lasting friendships</h2></div>
            <p className="text-bark-soft">SRKSH Home Premiere League brings residents together through sports, cultural activities, and friendly competition. Organised by the students, HPL creates opportunities for juniors and seniors to interact, build friendships, develop confidence, and strengthen the spirit of teamwork and belonging within the Home.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/hpl/teams" className="btn-primary">View Teams</Link>
            <Link to="/hpl/sports" className="btn-outline">Explore Sports</Link>
            <Link to="/hpl/results" className="btn-outline">View HPL Results</Link>
            <Link to="/hpl/leaderboard" className="btn-outline">View Leaderboard</Link>
          </div>
        </div>
      </section>
      <section className="container-x py-16 md:py-24">
        {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
          <div className="space-y-16">
            <div>
              <SectionHead eyebrow="Teams" title="Meet the teams" />
              {teams.length ? (
                <div className="grid gap-6 md:grid-cols-2">{teams.map(t => <TeamCard key={t.id} team={t} row={leaderboard.find(l => l.team_id === t.id)} />)}</div>
              ) : <EmptyState title="Teams will be announced soon" />}
            </div>
            <div className="grid gap-10 lg:grid-cols-2">
              <div>
                <SectionHead eyebrow="Live standings" title="Leaderboard" />
                <Leaderboard rows={leaderboard} compact />
                <Link to="/hpl/leaderboard" className="mt-4 inline-block text-sm font-medium text-terracotta-deep hover:underline">Full leaderboard →</Link>
              </div>
              <div>
                <SectionHead eyebrow="Sports and results" title={completed.length ? 'Latest results' : 'Sports'} />
                {latest.length ? <div className="space-y-5">{latest.map(s => <SportCard key={s.id} sport={s} bundle={bundle} teams={teams} />)}</div> : <EmptyState title="Results are on their way!" text="Check back soon to see the latest HPL standings." />}
                <Link to="/hpl/results" className="mt-4 inline-block text-sm font-medium text-terracotta-deep hover:underline">All results →</Link>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  )
}

function GalleryPreview() {
  const { data, loading } = useQuery(getGallery, [], [])
  const items = data.slice(0, 6)
  return (
    <section className="container-x pb-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Gallery</p><h2 className="h2">Moments from the Home</h2></div>
        <Link to="/gallery" className="btn-outline">View All</Link>
      </div>
      {loading ? <Spinner /> : items.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {items.map(g => <Link to="/gallery" key={g.id} className="group overflow-hidden rounded-3xl"><Img src={imageUrl(g.storage_path)} alt={g.title || g.caption || 'SRKSH gallery photograph'} ratio="1/1" className="w-full object-cover transition duration-700 group-hover:scale-105" /></Link>)}
        </div>
      ) : <EmptyState title="Photographs coming soon" text="Gallery images will appear here once they are uploaded." />}
    </section>
  )
}

export default function Home() {
  useTitle('Sri Ramakrishna Students Home (SRKSH), Bengaluru', 'A non-profit student home in Bengaluru since 1919, providing free boarding and lodging to meritorious students.')
  return (
    <>
      <Hero /><AboutUs /><Mission /><HowItWorks /><Legacy /><AboutPhotos /><StudentLife />
      <HplPreview /><GalleryPreview /><Supporters />
    </>
  )
}
