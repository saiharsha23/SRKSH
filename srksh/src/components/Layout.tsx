import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { SetupNotice } from './ui'
import { getSettings, useQuery } from '../lib/data'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/hpl', label: 'HPL', end: true },
  { to: '/hpl/results', label: 'HPL Results' },
]

export function Logo({ light }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bark font-serif text-lg font-bold text-saffron">SR</span>
      <span className="leading-tight">
        <span className={`block font-serif text-xl font-bold ${light ? 'text-ivory' : 'text-bark'}`}>SRKSH</span>
        <span className={`hidden text-[10px] uppercase tracking-[0.18em] sm:block ${light ? 'text-sand' : 'text-bark-soft'}`}>Sri Ramakrishna Students Home</span>
      </span>
    </span>
  )
}

function Nav() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  const cls = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${isActive ? 'bg-saffron-soft text-bark' : 'text-bark-soft hover:bg-sand/70 hover:text-bark'}`
  return (
    <header className="sticky top-0 z-40 border-b border-sand/80 bg-ivory/90 backdrop-blur">
      <div className="container-x flex h-[72px] items-center justify-between">
        <Link to="/" aria-label="SRKSH home"><Logo /></Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map(l => <NavLink key={l.to} to={l.to} end={l.end} className={cls}>{l.label}</NavLink>)}
        </nav>
        <button className="rounded-full p-2 hover:bg-sand md:hidden" onClick={() => setOpen(o => !o)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="container-x flex flex-col gap-1 pb-4 md:hidden" aria-label="Mobile">
          {links.map(l => <NavLink key={l.to} to={l.to} end={l.end} className={cls}>{l.label}</NavLink>)}
        </nav>
      )}
    </header>
  )
}

function Footer() {
  const { data: s } = useQuery(getSettings, {}, [])
  const social = [['Facebook', s.facebook_url], ['Instagram', s.instagram_url], ['YouTube', s.youtube_url]].filter(([, u]) => u)
  return (
    <footer className="mt-24 bg-bark text-sand">
      <div className="container-x grid gap-10 py-14 md:grid-cols-3">
        <div>
          <Logo light />
          <p className="mt-4 text-sm text-sand/80">Established 1919</p>
          <p className="mt-3 max-w-xs text-sm text-sand/80">Helping meritorious students from economically weaker backgrounds pursue their education with dignity, discipline and confidence.</p>
        </div>
        <div>
          <h3 className="font-serif text-xl text-ivory">Quick links</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {links.map(l => <li key={l.to}><Link className="hover:text-saffron" to={l.to}>{l.label}</Link></li>)}
          </ul>
        </div>
        <div>
          <h3 className="font-serif text-xl text-ivory">Contact</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {s.contact_address && <li className="whitespace-pre-line">{s.contact_address}</li>}
            {s.contact_email && <li><a className="hover:text-saffron" href={`mailto:${s.contact_email}`}>{s.contact_email}</a></li>}
            {s.contact_phone && <li><a className="hover:text-saffron" href={`tel:${s.contact_phone}`}>{s.contact_phone}</a></li>}
            {social.map(([n, u]) => <li key={n}><a className="hover:text-saffron" href={u!} target="_blank" rel="noreferrer noopener">{n}</a></li>)}
            {!s.contact_address && !s.contact_email && !s.contact_phone && !social.length && <li className="text-sand/60">Contact details coming soon.</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-sand/10 py-5 text-center text-xs text-sand/60">
        © {new Date().getFullYear()} Sri Ramakrishna Students Home (SRKSH), Bengaluru ·{' '}
        <Link to="/admin" className="hover:text-saffron">Admin</Link>
      </div>
    </footer>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div className="flex min-h-screen flex-col">
      <SetupNotice />
      <Nav />
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  )
}
