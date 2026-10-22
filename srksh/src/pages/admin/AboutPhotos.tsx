import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase, uploadImage, removeImage } from '../../lib/supabase'
import { getAbout, useQuery } from '../../lib/data'
import type { AboutImage } from '../../types'
import { ConfirmDialog, ErrorBox, Spinner, useToast } from '../../components/ui'
import { Field, ImageField, PageTitle, errMsg } from './common'

function Slot({ slot, item, onSaved }: { slot: number; item?: AboutImage; onSaved: () => void }) {
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState(item?.title ?? '')
  const [caption, setCaption] = useState(item?.caption ?? '')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function save() {
    if (!item && !file) { toast('error', `Choose a photograph for slot ${slot} first.`); return }
    setBusy(true)
    let uploaded: string | null = null
    try {
      let storage_path = item?.storage_path
      if (file) { uploaded = await uploadImage(file, 'about'); storage_path = uploaded }
      const { error } = await supabase.from('about_images').upsert({ slot, title: title.trim() || null, caption: caption.trim() || null, storage_path, updated_at: new Date().toISOString() })
      if (error) throw error
      if (uploaded && item?.storage_path) await removeImage(item.storage_path)
      toast('success', `Photograph ${slot} saved.`); setFile(null); onSaved()
    } catch (e) { if (uploaded) await removeImage(uploaded); toast('error', `Could not save: ${errMsg(e)}`) } finally { setBusy(false) }
  }
  async function remove() {
    if (!item) return
    setBusy(true)
    try {
      const { error } = await supabase.from('about_images').delete().eq('slot', slot); if (error) throw error
      await removeImage(item.storage_path)
      toast('success', `Photograph ${slot} removed.`); setConfirm(false); setFile(null); setTitle(''); setCaption(''); onSaved()
    } catch (e) { toast('error', errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <div className="card">
      <h2 className="mb-4 text-2xl font-semibold">Photograph {slot}{slot === 1 ? <span className="ml-2 text-xs font-normal text-bark-soft">(also used in the homepage hero)</span> : null}</h2>
      <ImageField label="Image" size="h-40 w-full max-w-[16rem]" existingPath={item?.storage_path} file={file} onFile={setFile} onRemove={() => { if (item && !file) setConfirm(true) }} removed={false} />
      <div className="mt-4 space-y-3">
        <Field label="Title (optional)"><input className="input" value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <Field label="Caption (optional)"><textarea className="input" rows={2} value={caption} onChange={e => setCaption(e.target.value)} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {file && <button className="btn-outline btn-sm" onClick={() => setFile(null)} disabled={busy}>Cancel</button>}
        <button className="btn-primary btn-sm" onClick={() => void save()} disabled={busy}>{busy && <Loader2 className="h-3 w-3 animate-spin" />}Save</button>
      </div>
      <ConfirmDialog open={confirm} busy={busy} confirmLabel="Remove photograph" title={`Remove photograph ${slot}?`} message="The image is deleted from storage and the slot returns to a placeholder." onCancel={() => setConfirm(false)} onConfirm={() => void remove()} />
    </div>
  )
}

export default function AboutPhotos() {
  const { data, loading, error, reload } = useQuery(getAbout, [] as AboutImage[], [])
  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  return (
    <>
      <PageTitle title="About Photos" text="Four dedicated photographs for the About section — separate from the Gallery. Until you upload them, the public site shows clearly labelled placeholders." />
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map(s => <Slot key={`${s}-${data.find(d => d.slot === s)?.storage_path ?? 'none'}`} slot={s} item={data.find(d => d.slot === s)} onSaved={reload} />)}
      </div>
    </>
  )
}
