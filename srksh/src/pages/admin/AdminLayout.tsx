import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, Camera, Image, LayoutDashboard, ListChecks, LogOut, Medal, Menu, Settings, Swords, Users, X } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { isConfigured } from '../../lib/supabase'
import { Logo } from '../../components/Layout'
import { Spinner } from '../../components/ui'

const hpl = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/teams', label: 'Teams', icon: Users },
  { to: '/admin/sports', label: 'Sports', icon: Swords },
  { to: '/admin/results', label: 'Results and Points', icon: ListChecks },
  { to: '/admin/leaderboard', label: 'Leaderboard', icon: Medal },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]
const site = [
  { to: '/admin/about-photos', label: 'About Photos', icon: Camera },
  { to: '/admin/gallery', label: 'Gallery', icon: Image },
]

export default function AdminLayout() {
  const { session, isAdmin, loading, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  if (!isConfigured) return <div className="container-x py-20 text-center"><h1 className="text-3xl">Backend not configured</h1><p className="mt-2 text-bark-soft">Set the Supabase environment variables first (see README).</p></div>
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/admin/login" state={{ from: loc.pathname }} replace />
  if (!isAdmin) {
    return (
      <div className="container-x py-20 text-center">
        <h1 className="text-3xl">Not authorised</h1>
        <p className="mx-auto mt-2 max-w-md text-bark-soft">You are signed in as {session.user.email}, but this account has not been granted admin access. See the README for how to add an admin.</p>
        <button className="btn-outline mt-6" onClick={signOut}>Sign out</button>
      </div>
    )
  }
  const item = (n: typeof hpl[number]) => (
    <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
      className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${isActive ? 'bg-saffron text-bark' : 'text-sand hover:bg-white/10'}`}>
      <n.icon className="h-4 w-4" />{n.label}
    </NavLink>
  )
  return (
    <div className="min-h-screen bg-ivory md:flex">
      <div className="flex items-center justify-between bg-bark px-4 py-3 md:hidden">
        <Link to="/"><Logo light /></Link>
        <button onClick={() => setOpen(o => !o)} className="rounded-full p-2 text-ivory" aria-label="Toggle admin menu" aria-expanded={open}>{open ? <X /> : <Menu />}</button>
      </div>
      <aside className={`${open ? 'block' : 'hidden'} w-full shrink-0 bg-bark md:sticky md:top-0 md:block md:h-screen md:w-64 md:overflow-y-auto`}>
        <div className="hidden p-5 md:block"><Link to="/"><Logo light /></Link></div>
        <nav className="space-y-1 px-3 pb-4" aria-label="Admin">
          <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-sand/50">HPL management</p>
          {hpl.map(item)}
          <p className="px-4 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-widest text-sand/50">Website content</p>
          {site.map(item as never)}
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="truncate px-4 pb-2 text-xs text-sand/60">{session.user.email}</p>
            <Link to="/" className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-sand hover:bg-white/10"><BarChart3 className="h-4 w-4" />View public site</Link>
            <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-sand hover:bg-white/10"><LogOut className="h-4 w-4" />Log out</button>
          </div>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10"><Outlet /></main>
    </div>
  )
}
