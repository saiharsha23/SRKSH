import { Link } from 'react-router-dom'
import { BookOpen, Home as HomeIcon, Users, Sparkles, HandHeart, Sunrise, ShieldCheck, GraduationCap, Landmark, Utensils } from 'lucide-react'
import { SectionHead, Img } from './ui'
import Placeholder from './Placeholder'
import { getAbout, useQuery } from '../lib/data'
import { imageUrl } from '../lib/supabase'

export function Hero() {
  const { data: about } = useQuery(getAbout, [], [])
  const hero = about.find(a => a.slot === 1)
  const src = imageUrl(hero?.storage_path)
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-saffron-soft/60 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-terracotta-soft/50 blur-2xl" aria-hidden />
      <div className="container-x relative grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
        <div className="animate-rise">
          <p className="eyebrow">Sri Ramakrishna Students Home · Bengaluru</p>
          <h1 className="text-5xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">A Home for Learning, Living and Serving Since 1919</h1>
          <p className="mt-6 max-w-xl text-lg text-bark-soft">Sri Ramakrishna Students Home, Bengaluru, is a non-profit initiative dedicated to helping meritorious students from economically weaker backgrounds pursue their education with dignity, discipline, and confidence.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/about" className="btn-primary">Discover Our Home</Link>
            <Link to="/hpl" className="btn-outline">Explore HPL</Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-5 text-sm font-medium text-terracotta-deep">
            <Link to="/about" className="underline-offset-4 hover:underline">Explore SRKSH →</Link>
            <Link to="/hpl" className="underline-offset-4 hover:underline">SRKSH HPL →</Link>
            <Link to="/hpl/results" className="underline-offset-4 hover:underline">HPL Results →</Link>
          </div>
        </div>
        <div className="relative animate-rise">
          <div className="overflow-hidden rounded-[2.5rem] shadow-soft ring-8 ring-white/60">
            {src ? <Img src={src} alt={hero?.title || 'Sri Ramakrishna Students Home'} className="h-full w-full object-cover" ratio="4/5" /> : <Placeholder ratio="4/5" label="Hero photograph" className="rounded-[2.5rem]" />}
          </div>
          <div className="absolute -bottom-5 -left-5 hidden rounded-2xl bg-bark px-5 py-3 text-ivory shadow-soft sm:block">
            <p className="font-serif text-2xl font-semibold text-saffron">Since 1919</p>
            <p className="text-xs uppercase tracking-widest text-sand">Learning · Living · Serving</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function AboutUs() {
  return (
    <section className="container-x py-16 md:py-24">
      <div className="grid gap-10 md:grid-cols-5">
        <div className="md:col-span-2"><p className="eyebrow">About us</p><h2 className="h2">More Than a Hostel — A Home</h2></div>
        <div className="space-y-5 text-bark-soft md:col-span-3">
          <p>Sri Ramakrishna Students Home in Bengaluru was established in 1919 with a simple but powerful purpose: no deserving student should have to give up an education because their family cannot afford accommodation and living expenses in the city.</p>
          <p>Over the years, the Home has supported meritorious students from economically disadvantaged backgrounds who come to Bengaluru to pursue engineering, MBA, MCA, BCA, other degree programmes, and diploma courses.</p>
          <p>The Home provides free boarding and lodging to its residents. Beyond accommodation, it creates an environment where students learn discipline, independence, responsibility, cooperation, and the importance of serving others.</p>
          <p className="font-medium text-bark">What makes SRKSH unique is that it is not simply a hostel. It is a self-governing community in which students share responsibilities, manage everyday activities, and prepare the next generation of residents to carry forward the Home's legacy.</p>
        </div>
      </div>
    </section>
  )
}

export function Mission() {
  const cards = [
    { icon: GraduationCap, t: 'Education for All', d: 'Supporting academically meritorious students from economically weaker backgrounds.' },
    { icon: HomeIcon, t: 'Free Boarding and Lodging', d: 'Providing residents with accommodation and meals without boarding or lodging charges.' },
    { icon: Sparkles, t: 'Character and Leadership', d: 'Encouraging discipline, independence, cooperation, leadership, and community service.' },
  ]
  return (
    <section className="bg-cream/70 py-16 md:py-24">
      <div className="container-x">
        <SectionHead eyebrow="Our mission" title="Making Education Accessible" text="Our mission is to support deserving students who face financial barriers, enabling them to focus on their education while developing the values and life skills necessary to become responsible individuals and contributors to society." />
        <div className="grid gap-6 md:grid-cols-3">
          {cards.map(c => (
            <div key={c.t} className="card transition duration-300 hover:-translate-y-1">
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-saffron-soft text-saffron-deep"><c.icon className="h-6 w-6" /></span>
              <h3 className="text-2xl font-semibold">{c.t}</h3>
              <p className="mt-2 text-sm text-bark-soft">{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function HowItWorks() {
  const cards = [
    { icon: ShieldCheck, t: 'Eligibility', d: 'The Home is intended for academically meritorious students from economically disadvantaged families who need support to pursue their education in Bengaluru.' },
    { icon: Utensils, t: 'Free Boarding and Lodging', d: 'Residents receive boarding and lodging free of charge, helping reduce the financial burden on their families.' },
    { icon: Users, t: 'Student-Led Administration', d: "Seven annual student responsibilities, held by final-year residents, help manage the Home's operations. Responsibilities include roles such as Steward, Turn List Putter, and Store Keeper. Students maintain registers, coordinate daily duties, and help ensure the smooth running of the Home." },
    { icon: Sunrise, t: 'Daily Life and Values', d: 'The day begins and ends with prayers from the Bhagavad Gita, alongside shared meals, responsibilities, learning, and community activities.' },
  ]
  return (
    <section className="container-x py-16 md:py-24">
      <SectionHead eyebrow="How the Home works" title="A community that runs itself" center />
      <div className="grid gap-6 sm:grid-cols-2">
        {cards.map((c, i) => (
          <div key={c.t} className="card flex gap-5 transition duration-300 hover:-translate-y-1">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terracotta-soft font-serif text-xl font-bold text-terracotta-deep">{i + 1}</span>
            <div>
              <h3 className="flex items-center gap-2 text-2xl font-semibold"><c.icon className="h-5 w-5 text-saffron-deep" />{c.t}</h3>
              <p className="mt-2 text-sm text-bark-soft">{c.d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Legacy() {
  const steps = [
    { k: '1919', d: 'Establishment of Sri Ramakrishna Students Home.' },
    { k: 'Growing community', d: 'Supporting students pursuing higher education in Bengaluru.' },
    { k: 'Student leadership', d: "Residents taking responsibility for the Home's daily operations." },
    { k: 'Continuing legacy', d: 'Passing values, knowledge, and responsibility to future generations.' },
  ]
  return (
    <section className="bg-bark py-16 text-sand md:py-24">
      <div className="container-x">
        <div className="mb-12 max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-saffron">Our legacy</p>
          <h2 className="font-serif text-3xl font-semibold leading-tight text-ivory sm:text-4xl md:text-5xl">A Century of Learning, Service and Self-Reliance</h2>
          <div className="mt-6 space-y-4 text-sand/85">
            <p>For more than a century, Sri Ramakrishna Students Home has carried forward a tradition of supporting students through a community built on mutual trust and shared responsibility.</p>
            <p>The Home is sustained by donations and the goodwill of donors, alumni, and well-wishers. Its resident-led model encourages students to become self-reliant, responsible, and considerate of others.</p>
            <p>The legacy of SRKSH is not only the education its residents receive, but also the character, friendships, and sense of service they carry into the wider world.</p>
          </div>
        </div>
        <ol className="relative grid gap-8 md:grid-cols-4">
          <div className="absolute left-0 right-0 top-[11px] hidden h-px bg-gold/40 md:block" aria-hidden />
          {steps.map(s => (
            <li key={s.k} className="relative">
              <span className="relative z-10 mb-5 block h-6 w-6 rounded-full border-4 border-bark bg-saffron ring-2 ring-saffron/50" aria-hidden />
              <h3 className="font-serif text-2xl font-semibold text-saffron">{s.k}</h3>
              <p className="mt-1 text-sm text-sand/80">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function AboutPhotos() {
  const { data } = useQuery(getAbout, [], [])
  return (
    <section className="container-x py-16 md:py-24">
      <SectionHead eyebrow="Life at SRKSH" title="Glimpses of our Home" />
      <div className="grid gap-8 sm:grid-cols-2">
        {[1, 2, 3, 4].map((slot, i) => {
          const a = data.find(x => x.slot === slot)
          const src = imageUrl(a?.storage_path)
          return (
            <figure key={slot} className={`group ${i % 2 === 1 ? 'sm:mt-12' : ''}`}>
              <div className="overflow-hidden rounded-[2rem] shadow-soft">
                {src ? <Img src={src} alt={a?.title || a?.caption || `SRKSH photograph ${slot}`} ratio="4/3" className="w-full object-cover transition duration-700 group-hover:scale-105" /> : <Placeholder label={`About photograph ${slot}`} className="rounded-[2rem]" />}
              </div>
              {(a?.title || a?.caption) && (
                <figcaption className="mt-3 px-2">
                  {a.title && <p className="font-serif text-xl font-semibold">{a.title}</p>}
                  {a.caption && <p className="text-sm text-bark-soft">{a.caption}</p>}
                </figcaption>
              )}
            </figure>
          )
        })}
      </div>
    </section>
  )
}

export function StudentLife() {
  const items = [
    { icon: Sunrise, t: 'Prayer', d: 'Days begin and end with prayers from the Bhagavad Gita.' },
    { icon: Utensils, t: 'Shared meals', d: 'Residents eat together and share the everyday work of the Home.' },
    { icon: BookOpen, t: 'Learning', d: 'Students pursue engineering, management, computer applications and diploma courses.' },
    { icon: HandHeart, t: 'Service', d: 'Responsibility and service to others are part of daily life.' },
  ]
  return (
    <section className="bg-cream/70 py-16 md:py-24">
      <div className="container-x">
        <SectionHead eyebrow="Student life and community" title="Discipline, friendship and shared responsibility" center />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(i => (
            <div key={i.t} className="rounded-3xl bg-ivory p-6 text-center ring-1 ring-sand">
              <i.icon className="mx-auto h-8 w-8 text-terracotta" />
              <h3 className="mt-4 text-xl font-semibold">{i.t}</h3>
              <p className="mt-1 text-sm text-bark-soft">{i.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Supporters() {
  return (
    <section className="container-x py-16 md:py-24">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-saffron-soft to-terracotta-soft/70 p-10 text-center md:p-16">
        <Landmark className="mx-auto h-9 w-9 text-terracotta-deep" />
        <h2 className="mx-auto mt-4 max-w-2xl font-serif text-3xl font-semibold sm:text-4xl">Sustained by goodwill</h2>
        <p className="mx-auto mt-4 max-w-2xl text-bark">Sri Ramakrishna Students Home is sustained by donations and the goodwill of donors, alumni, and well-wishers. We are grateful to everyone who has helped a deserving student continue their education.</p>
      </div>
    </section>
  )
}
