import { Crown, Trophy } from 'lucide-react'
import type { LeaderRow } from '../types'
import { fmtPoints } from '../lib/format'
import { ColourDot, EmptyState } from './ui'

const medal = (rank: number) =>
  rank === 1 ? 'bg-gradient-to-br from-[#E9C46A] to-[#C2A15A] text-bark'
  : rank === 2 ? 'bg-gradient-to-br from-[#E5E5E5] to-[#A8A8A8] text-bark'
  : rank === 3 ? 'bg-gradient-to-br from-[#D9A273] to-[#A8683A] text-ivory'
  : 'bg-sand text-bark-soft'

export default function Leaderboard({ rows, compact }: { rows: LeaderRow[]; compact?: boolean }) {
  if (!rows.length) return <EmptyState title="No teams yet" text="The leaderboard will appear once teams are created." />
  const anyPoints = rows.some(r => Number(r.total_points) > 0)
  return (
    <div>
      {/* desktop table */}
      <div className="hidden overflow-hidden rounded-3xl bg-white/70 shadow-soft ring-1 ring-sand md:block">
        <table className="w-full text-left">
          <caption className="sr-only">HPL leaderboard</caption>
          <thead className="bg-bark text-ivory">
            <tr className="text-xs uppercase tracking-wider">
              <th className="px-6 py-4">Rank</th><th className="px-6 py-4">Team</th>
              {!compact && <><th className="px-6 py-4 text-center">Sports won</th><th className="px-6 py-4 text-center">Runner-ups</th></>}
              <th className="px-6 py-4 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.team_id} className={`border-t border-sand ${r.rank === 1 && anyPoints ? 'bg-saffron-soft/40' : ''}`}>
                <td className="px-6 py-4"><span className={`inline-flex h-9 w-9 items-center justify-center rounded-full font-serif text-lg font-bold ${anyPoints ? medal(r.rank) : 'bg-sand text-bark-soft'}`}>{r.rank}</span></td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-3 font-serif text-xl font-semibold"><ColourDot colour={r.colour} />{r.team_name}
                    {r.rank === 1 && anyPoints && <span className="inline-flex items-center gap-1 rounded-full bg-bark px-2.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-saffron"><Crown className="h-3 w-3" />Leading</span>}
                  </span>
                </td>
                {!compact && <><td className="px-6 py-4 text-center">{r.wins}</td><td className="px-6 py-4 text-center">{r.runner_ups}</td></>}
                <td className="px-6 py-4 text-right font-serif text-3xl font-bold text-terracotta-deep">{fmtPoints(r.total_points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* mobile cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map(r => (
          <li key={r.team_id} className={`rounded-2xl p-4 shadow-soft ring-1 ring-sand ${r.rank === 1 && anyPoints ? 'bg-saffron-soft/50' : 'bg-white/70'}`}>
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-serif text-xl font-bold ${anyPoints ? medal(r.rank) : 'bg-sand text-bark-soft'}`}>{r.rank}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-serif text-xl font-semibold"><ColourDot colour={r.colour} />{r.team_name}</p>
                {!compact && <p className="text-xs text-bark-soft"><Trophy className="mr-1 inline h-3 w-3" />{r.wins} won · {r.runner_ups} runner-up</p>}
              </div>
              <p className="font-serif text-3xl font-bold text-terracotta-deep">{fmtPoints(r.total_points)}</p>
            </div>
          </li>
        ))}
      </ul>
      {!anyPoints && <p className="mt-3 text-center text-xs text-bark-soft">No completed results yet — all teams start at zero.</p>}
    </div>
  )
}
