import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getEditions, getSettings, useQuery } from '../../lib/data'
import type { Edition, EditionStatus, SiteSettings } from '../../types'
import { Badge, ConfirmDialog, ErrorBox, Spinner, useToast } from '../../components/ui'
import { Field, PageTitle, errMsg } from './common'

function EditionCard({ ed, onSaved }: { ed: Edition; onSaved: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(ed.name)
  const [status, setStatus] = useState<EditionStatus>(ed.status)
  const [tie, setTie] = useState(ed.tie_break)
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!name.trim()) { toast('error', 'Edition name is required.'); return }
    setBusy(true)
    const { error } = await supabase.from('hpl_editions').update({ name: name.trim(), status, tie_break: tie }).eq('id', ed.id)
    setBusy(false)
    if (error) toast('error', error.message); else { toast('success', 'Edition saved.'); onSaved() }
  }
  return (
    <div className="card">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Edition / season name"><input className="input" value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Status"><select className="input" value={status} onChange={e => setStatus(e.target.value as EditionStatus)}><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option></select></Field>
        <Field label="Tie-break rule" hint="Equal points always share a rank unless you choose a rule.">
          <select className="input" value={tie} onChange={e => setTie(e.target.value as 'none' | 'wins')}><option value="none">None — tied teams share a rank</option><option value="wins">Number of sports won</option></select></Field>
      </div>
      <div className="mt-4 flex justify-end"><button className="btn-primary btn-sm" onClick={() => void save()} disabled={busy}>{busy && <Loader2 className="h-3 w-3 animate-spin" />}Save edition</button></div>
    </div>
  )
}

export default function Settings() {
  const toast = useToast()
  const eds = useQuery(getEditions, [] as Edition[], [])
  const st = useQuery(getSettings, {} as Partial<SiteSettings>, [])
  const [newName, setNewName] = useState('')
  const [confirmNew, setConfirmNew] = useState(false)
  const [switchTo, setSwitchTo] = useState<Edition | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Partial<SiteSettings>>({})
  useEffect(() => setForm(st.data), [st.data])
  const current = eds.data.find(e => e.is_current)

  async function makeCurrent(name: string | null, existing?: Edition) {
    setBusy(true)
    try {
      if (current) { const { error } = await supabase.from('hpl_editions').update({ is_current: false }).eq('id', current.id); if (error) throw error }
      let r
      if (existing) r = await supabase.from('hpl_editions').update({ is_current: true }).eq('id', existing.id)
      else r = await supabase.from('hpl_editions').insert({ name: name!.trim(), status: 'upcoming', is_current: true })
      if (r.error) {
        if (current) await supabase.from('hpl_editions').update({ is_current: true }).eq('id', current.id) // roll back
        throw r.error
      }
      toast('success', existing ? `${existing.name} is now the current edition.` : 'New edition created. Previous results are kept.')
      setNewName(''); setConfirmNew(false); setSwitchTo(null); void eds.reload()
    } catch (e) { toast('error', errMsg(e)) } finally { setBusy(false) }
  }
  async function saveContact() {
    setBusy(true)
    const clean = (v?: string | null) => (v?.trim() ? v.trim() : null)
    const { error } = await supabase.from('site_settings').update({
      contact_email: clean(form.contact_email), contact_phone: clean(form.contact_phone), contact_address: clean(form.contact_address),
      facebook_url: clean(form.facebook_url), instagram_url: clean(form.instagram_url), youtube_url: clean(form.youtube_url), updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setBusy(false)
    if (error) toast('error', error.message); else { toast('success', 'Contact details saved.'); void st.reload() }
  }
  const f = (k: keyof SiteSettings) => ({ className: 'input', value: form[k] ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(s => ({ ...s, [k]: e.target.value })) })

  if (eds.loading || st.loading) return <Spinner />
  if (eds.error) return <ErrorBox message={eds.error} onRetry={eds.reload} />
  return (
    <>
      <PageTitle title="Settings" />
      <section className="mb-10">
        <h2 className="mb-1 text-2xl font-semibold">HPL edition</h2>
        <p className="mb-4 text-sm text-bark-soft">{current ? `Current edition: ${current.name}.` : 'No edition exists yet — create the first one below.'} Teams, sports and results belong to an edition, so past editions stay intact.</p>
        {current && <EditionCard key={current.id + current.name} ed={current} onSaved={eds.reload} />}
        <div className="card mt-5">
          <h3 className="text-xl font-semibold">{current ? 'Start a new edition' : 'Create the first edition'}</h3>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1"><Field label="Edition name"><input className="input" placeholder="e.g. HPL 2026" value={newName} onChange={e => setNewName(e.target.value)} /></Field></div>
            <button className="btn-accent" disabled={!newName.trim() || busy} onClick={() => (current ? setConfirmNew(true) : void makeCurrent(newName))}>{current ? 'Start new edition' : 'Create edition'}</button>
          </div>
          {current && <p className="mt-2 text-xs text-bark-faint">The new edition starts with no teams or sports. {current.name} and all its results are retained and can be made current again.</p>}
        </div>
        {eds.data.filter(e => !e.is_current).length > 0 && (
          <div className="card mt-5"><h3 className="mb-3 text-xl font-semibold">Past editions</h3>
            <ul className="divide-y divide-sand">{eds.data.filter(e => !e.is_current).map(e => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2"><span className="font-medium">{e.name} <Badge status={e.status} /></span><button className="btn-outline btn-sm" onClick={() => setSwitchTo(e)}>Make current</button></li>))}</ul></div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-2xl font-semibold">Footer contact details</h2>
        <p className="mb-4 text-sm text-bark-soft">Optional. Anything left blank is simply not shown on the website.</p>
        <div className="card grid gap-4 sm:grid-cols-2">
          <Field label="Email"><input type="email" {...f('contact_email')} /></Field>
          <Field label="Phone"><input type="tel" {...f('contact_phone')} /></Field>
          <div className="sm:col-span-2"><Field label="Postal address"><textarea rows={3} {...f('contact_address')} /></Field></div>
          <Field label="Facebook URL"><input type="url" placeholder="https://" {...f('facebook_url')} /></Field>
          <Field label="Instagram URL"><input type="url" placeholder="https://" {...f('instagram_url')} /></Field>
          <Field label="YouTube URL"><input type="url" placeholder="https://" {...f('youtube_url')} /></Field>
          <div className="flex items-end justify-end sm:col-span-2"><button className="btn-primary" onClick={() => void saveContact()} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save contact details</button></div>
        </div>
      </section>
      <ConfirmDialog open={confirmNew} busy={busy} confirmLabel="Start new edition" title="Start a new edition?" message={`“${newName.trim()}” becomes the current edition shown on the public site. ${current?.name} is kept with all its teams, sports and results.`} onCancel={() => setConfirmNew(false)} onConfirm={() => void makeCurrent(newName)} />
      <ConfirmDialog open={!!switchTo} busy={busy} confirmLabel="Make current" title="Switch current edition?" message={`The public site will show ${switchTo?.name}.`} onCancel={() => setSwitchTo(null)} onConfirm={() => switchTo && void makeCurrent(null, switchTo)} />
    </>
  )
}
