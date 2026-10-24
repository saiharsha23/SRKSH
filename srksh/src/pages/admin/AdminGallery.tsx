import { useEffect, useRef, useState } from 'react'
import { Loader2, Pencil, Pin, Trash2, Upload } from 'lucide-react'
import { supabase, uploadImage, removeImage, imageUrl, validateImage } from '../../lib/supabase'
import { getGallery, useQuery } from '../../lib/data'
import type { GalleryImage } from '../../types'
import { ConfirmDialog, EmptyState, ErrorBox, Img, Modal, Spinner, useToast } from '../../components/ui'
import { Field, ImageField, PageTitle, errMsg } from './common'
import { GALLERY_CATEGORIES } from '../../lib/format'

interface Pending {
  key: string
  file: File
  title: string
  caption: string
  category: string
  is_pinned: boolean
  status: 'ready' | 'uploading' | 'error'
  error?: string
  preview: string
}

export default function AdminGallery() {
  const toast = useToast()
  const { data, loading, error, reload } = useQuery(getGallery, [] as GalleryImage[], [])
  const [pending, setPending] = useState<Pending[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [edit, setEdit] = useState<GalleryImage | null>(null)
  const [del, setDel] = useState<GalleryImage | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => () => pending.forEach(p => URL.revokeObjectURL(p.preview)), []) // eslint-disable-line

  function pick(files: FileList | null) {
    if (!files) return
    const next: Pending[] = []
    Array.from(files).forEach(f => {
      const err = validateImage(f)
      if (err) toast('error', err)
      else next.push({ key: crypto.randomUUID(), file: f, title: '', caption: '', category: '', is_pinned: false, status: 'ready', preview: URL.createObjectURL(f) })
    })
    setPending(p => [...p, ...next])
    if (input.current) input.current.value = ''
  }
  const upd = (key: string, patch: Partial<Pending>) => setPending(ps => ps.map(p => (p.key === key ? { ...p, ...patch } : p)))
  const drop = (key: string) => setPending(ps => { const x = ps.find(p => p.key === key); if (x) URL.revokeObjectURL(x.preview); return ps.filter(p => p.key !== key) })

  async function uploadAll() {
    const queue = pending.filter(p => p.status !== 'uploading')
    if (!queue.length) return
    setProgress({ done: 0, total: queue.length })
    let ok = 0, failed = 0
    for (const p of queue) {
      upd(p.key, { status: 'uploading', error: undefined })
      let path: string | null = null
      try {
        path = await uploadImage(p.file, 'gallery')
        const { error } = await supabase.from('gallery_images').insert({
          title: p.title.trim() || null,
          caption: p.caption.trim() || null,
          category: p.category || null,
          is_pinned: p.is_pinned,
          storage_path: path,
        })
        if (error) throw error
        ok++; drop(p.key)
      } catch (e) {
        if (path) await removeImage(path)
        failed++; upd(p.key, { status: 'error', error: errMsg(e) })
      }
      setProgress(s => (s ? { ...s, done: s.done + 1 } : s))
    }
    setProgress(null)
    if (ok) { toast('success', `${ok} image${ok === 1 ? '' : 's'} uploaded and published.`); void reload() }
    if (failed) toast('error', `${failed} upload${failed === 1 ? '' : 's'} failed — see the list below and try again.`)
  }

  async function togglePin(g: GalleryImage) {
    const nextVal = !g.is_pinned
    try {
      const { error } = await supabase
        .from('gallery_images')
        .update({ is_pinned: nextVal, updated_at: new Date().toISOString() })
        .eq('id', g.id)
      if (error) throw error
      toast('success', nextVal ? 'Photo pinned to top.' : 'Photo unpinned.')
      void reload()
    } catch (e) {
      toast('error', `Could not update pin status: ${errMsg(e)}`)
    }
  }

  async function remove(g: GalleryImage) {
    setBusy(true)
    try {
      const { error } = await supabase.from('gallery_images').delete().eq('id', g.id); if (error) throw error
      await removeImage(g.storage_path)
      toast('success', 'Image deleted.'); setDel(null); void reload()
    } catch (e) { toast('error', errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <>
      <PageTitle title="Gallery" text="Uploaded images appear on the public Gallery automatically. JPG, PNG or WebP, up to 5 MB each." action={
        <>
          <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose images to upload" onChange={e => pick(e.target.files)} />
          <button className="btn-primary" onClick={() => input.current?.click()}><Upload className="h-4 w-4" />Choose images</button>
        </>} />

      {pending.length > 0 && (
        <section className="card mb-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Ready to upload ({pending.length})</h2>
            <div className="flex gap-2"><button className="btn-outline btn-sm" disabled={!!progress} onClick={() => pending.forEach(p => drop(p.key))}>Clear all</button>
              <button className="btn-primary btn-sm" disabled={!!progress} onClick={() => void uploadAll()}>{progress && <Loader2 className="h-3 w-3 animate-spin" />}Upload {pending.length}</button></div>
          </div>
          {progress && <div className="mb-4" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}><div className="h-2 overflow-hidden rounded-full bg-sand"><div className="h-full bg-saffron transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div><p className="mt-1 text-xs text-bark-soft">Uploaded {progress.done} of {progress.total}…</p></div>}
          <ul className="space-y-4">
            {pending.map(p => (
              <li key={p.key} className={`flex flex-col gap-3 rounded-2xl p-3 ring-1 sm:flex-row ${p.status === 'error' ? 'bg-red-50 ring-red-200' : 'bg-cream/60 ring-sand'}`}>
                <img src={p.preview} alt={`Preview of ${p.file.name}`} className="h-28 w-28 shrink-0 rounded-xl object-cover" />
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <input className="input" aria-label="Title" placeholder="Title" value={p.title} onChange={e => upd(p.key, { title: e.target.value })} disabled={p.status === 'uploading'} />
                  <select className="input" aria-label="Category" value={p.category} onChange={e => upd(p.key, { category: e.target.value })} disabled={p.status === 'uploading'}><option value="">No category</option>{GALLERY_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                  <input className="input sm:col-span-2" aria-label="Caption" placeholder="Caption / description" value={p.caption} onChange={e => upd(p.key, { caption: e.target.value })} disabled={p.status === 'uploading'} />
                  <div className="sm:col-span-2 flex items-center justify-between">
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-bark cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.is_pinned}
                        onChange={e => upd(p.key, { is_pinned: e.target.checked })}
                        className="rounded text-terracotta focus:ring-terracotta"
                        disabled={p.status === 'uploading'}
                      />
                      <Pin className={`h-3.5 w-3.5 ${p.is_pinned ? 'fill-terracotta text-terracotta' : 'text-bark-soft'}`} />
                      <span>Pin to top of gallery</span>
                    </label>
                    <p className="text-xs text-bark-faint">{p.file.name} · {(p.file.size / 1024).toFixed(0)} KB{p.status === 'error' && <span className="ml-2 text-red-700">Failed: {p.error}</span>}{p.status === 'uploading' && <span className="ml-2">Uploading…</span>}</p>
                  </div>
                </div>
                <button className="self-start rounded-full p-2 text-red-700 hover:bg-red-100" aria-label={`Remove ${p.file.name} from the queue`} onClick={() => drop(p.key)} disabled={p.status === 'uploading'}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mb-4 text-2xl font-semibold">Published images ({data.length})</h2>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.length ? <EmptyState title="No images yet" text="Choose images above to start your gallery." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map(g => (
            <div key={g.id} className={`overflow-hidden rounded-2xl bg-white/70 ring-1 transition ${g.is_pinned ? 'ring-saffron/80 shadow-soft' : 'ring-sand'}`}>
              <div className="relative">
                <Img src={imageUrl(g.storage_path)} alt={g.title || 'Gallery image'} ratio="4/3" className="w-full object-cover" />
                {g.is_pinned && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-bark/90 px-2.5 py-0.5 text-[11px] font-bold text-saffron shadow-sm backdrop-blur-xs">
                    <Pin className="h-3 w-3 fill-saffron text-saffron" />
                    <span>Pinned</span>
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="truncate font-medium">{g.title || <span className="text-bark-faint">Untitled</span>}</p>
                <p className="truncate text-xs text-bark-soft">{g.category || 'No category'}</p>
                <div className="mt-3 flex items-center justify-between gap-1 border-t border-sand/40 pt-2">
                  <button
                    className={`btn-sm inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      g.is_pinned
                        ? 'bg-saffron/20 text-saffron-deep border border-saffron/40 hover:bg-saffron/30'
                        : 'border border-sand bg-white text-bark-soft hover:bg-sand/30 hover:text-bark'
                    }`}
                    onClick={() => void togglePin(g)}
                    title={g.is_pinned ? 'Unpin from top' : 'Pin to top of gallery'}
                  >
                    <Pin className={`h-3 w-3 ${g.is_pinned ? 'fill-saffron-deep text-saffron-deep' : 'text-bark-soft'}`} />
                    <span>{g.is_pinned ? 'Pinned' : 'Pin'}</span>
                  </button>
                  <div className="flex gap-1">
                    <button className="btn-outline btn-sm text-xs px-2.5" onClick={() => setEdit(g)}><Pencil className="h-3 w-3" />Edit</button>
                    <button className="btn-sm inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-red-700 hover:bg-red-50" onClick={() => setDel(g)}><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && <EditModal item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void reload() }} />}
      <ConfirmDialog open={!!del} busy={busy} title="Delete this image?" message="It will be removed from the public gallery and from storage. This cannot be undone." onCancel={() => setDel(null)} onConfirm={() => del && void remove(del)} />
    </>
  )
}

function EditModal({ item, onClose, onSaved }: { item: GalleryImage; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState(item.title ?? '')
  const [caption, setCaption] = useState(item.caption ?? '')
  const [category, setCategory] = useState(item.category ?? '')
  const [isPinned, setIsPinned] = useState(item.is_pinned ?? false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    let uploaded: string | null = null
    try {
      let storage_path = item.storage_path
      if (file) { uploaded = await uploadImage(file, 'gallery'); storage_path = uploaded }
      const { error } = await supabase.from('gallery_images').update({
        title: title.trim() || null,
        caption: caption.trim() || null,
        category: category || null,
        is_pinned: isPinned,
        storage_path,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id)
      if (error) throw error
      if (uploaded) await removeImage(item.storage_path)
      toast('success', 'Image updated.'); onSaved()
    } catch (e) { if (uploaded) await removeImage(uploaded); toast('error', errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open title="Edit image" onClose={onClose}>
      <div className="space-y-4">
        <ImageField label="Image (choose a file to replace)" size="h-32 w-32" existingPath={item.storage_path} file={file} onFile={setFile} />
        <Field label="Title"><input className="input" value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <Field label="Caption"><textarea className="input" rows={2} value={caption} onChange={e => setCaption(e.target.value)} /></Field>
        <Field label="Category"><select className="input" value={category} onChange={e => setCategory(e.target.value)}><option value="">No category</option>{GALLERY_CATEGORIES.map(c => <option key={c}>{c}</option>)}{category && !GALLERY_CATEGORIES.includes(category) && <option>{category}</option>}</select></Field>
        <div className="rounded-xl bg-sand/30 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-bark cursor-pointer">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={e => setIsPinned(e.target.checked)}
              className="rounded text-terracotta focus:ring-terracotta"
            />
            <Pin className={`h-4 w-4 ${isPinned ? 'fill-terracotta text-terracotta' : 'text-bark-soft'}`} />
            <span>Pin this photo to top of gallery</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-sand pt-4"><button className="btn-outline" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" onClick={() => void save()} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button></div>
      </div>
    </Modal>
  )
}
