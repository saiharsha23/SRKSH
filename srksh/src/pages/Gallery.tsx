import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pin, X } from 'lucide-react'
import { EmptyState, ErrorBox, Img, Spinner } from '../components/ui'
import { getGallery, useQuery } from '../lib/data'
import { imageUrl } from '../lib/supabase'
import { useTitle } from '../lib/useTitle'

const PAGE = 18

export default function Gallery() {
  useTitle('Gallery · SRKSH', 'Photographs of student life, festivals, sports and events at Sri Ramakrishna Students Home.')
  const { data, loading, error, reload } = useQuery(getGallery, [], [])
  const [cat, setCat] = useState('All')
  const [shown, setShown] = useState(PAGE)
  const [idx, setIdx] = useState<number | null>(null)
  const cats = ['All', ...Array.from(new Set(data.map(d => d.category).filter(Boolean) as string[]))]
  const list = data
    .filter(d => cat === 'All' || d.category === cat)
    .sort((a, b) => Number(b.is_pinned ?? false) - Number(a.is_pinned ?? false))
  const visible = list.slice(0, shown)

  useEffect(() => {
    if (idx === null) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIdx(null)
      if (e.key === 'ArrowRight') setIdx(i => (i === null ? i : (i + 1) % list.length))
      if (e.key === 'ArrowLeft') setIdx(i => (i === null ? i : (i - 1 + list.length) % list.length))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [idx, list.length])

  const cur = idx !== null ? list[idx] : null
  return (
    <div className="container-x py-14">
      <p className="eyebrow">Gallery</p>
      <h1 className="text-5xl font-semibold sm:text-6xl">Life at SRKSH</h1>
      <p className="mt-4 max-w-2xl text-bark-soft">Moments from student life, festivals, sports, cultural activities and events at the Home.</p>

      {loading ? <Spinner /> : error ? <div className="mt-8"><ErrorBox message={error} onRetry={reload} /></div> : !data.length ? (
        <div className="mt-10"><EmptyState title="Photographs coming soon" text="Our gallery is being prepared. Please check back shortly." /></div>
      ) : (
        <>
          {cats.length > 2 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {cats.map(c => <button key={c} onClick={() => { setCat(c); setShown(PAGE) }} className={`rounded-full px-4 py-2 text-sm font-medium ${cat === c ? 'bg-bark text-ivory' : 'bg-white/70 text-bark-soft ring-1 ring-sand hover:bg-sand/60'}`}>{c}</button>)}
            </div>
          )}
          <div className="mt-8 columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
            {visible.map((g, i) => (
              <button key={g.id} onClick={() => setIdx(i)} className={`group block w-full break-inside-avoid overflow-hidden rounded-3xl bg-white/70 text-left shadow-soft ring-1 transition ${g.is_pinned ? 'ring-saffron/80 shadow-md' : 'ring-sand'}`} aria-label={`Open ${g.title || 'photograph'}`}>
                <div className="relative overflow-hidden">
                  <Img src={imageUrl(g.storage_path)} alt={g.title || g.caption || 'SRKSH gallery photograph'} className="w-full object-cover transition duration-700 group-hover:scale-105" />
                  {g.is_pinned && (
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-bark/90 px-3 py-1 text-xs font-semibold text-saffron shadow-md backdrop-blur-xs">
                      <Pin className="h-3 w-3 fill-saffron text-saffron" />
                      <span>Pinned</span>
                    </span>
                  )}
                </div>
                {(g.title || g.caption || g.category) && (
                  <div className="p-4">
                    {g.category && <span className="mb-1 inline-block rounded-full bg-saffron-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-saffron-deep">{g.category}</span>}
                    {g.title && <h2 className="font-serif text-xl font-semibold">{g.title}</h2>}
                    {g.caption && <p className="line-clamp-2 text-sm text-bark-soft">{g.caption}</p>}
                  </div>
                )}
              </button>
            ))}
          </div>
          {shown < list.length && <div className="mt-6 text-center"><button className="btn-outline" onClick={() => setShown(s => s + PAGE)}>Load more</button></div>}
        </>
      )}

      {cur && (
        <div className="fixed inset-0 z-[95] flex flex-col bg-bark/95 p-4" role="dialog" aria-modal="true" aria-label="Image viewer" onClick={() => setIdx(null)}>
          <button className="ml-auto rounded-full p-2 text-ivory hover:bg-white/10" onClick={() => setIdx(null)} aria-label="Close"><X /></button>
          <div className="relative flex flex-1 items-center justify-center" onClick={e => e.stopPropagation()}>
            {list.length > 1 && <button className="absolute left-0 rounded-full bg-white/10 p-3 text-ivory hover:bg-white/20" onClick={() => setIdx((idx! - 1 + list.length) % list.length)} aria-label="Previous"><ChevronLeft /></button>}
            <img src={imageUrl(cur.storage_path) ?? ''} alt={cur.title || cur.caption || 'SRKSH gallery photograph'} className="max-h-[75vh] max-w-full rounded-2xl object-contain" />
            {list.length > 1 && <button className="absolute right-0 rounded-full bg-white/10 p-3 text-ivory hover:bg-white/20" onClick={() => setIdx((idx! + 1) % list.length)} aria-label="Next"><ChevronRight /></button>}
          </div>
          <div className="mx-auto max-w-2xl py-4 text-center text-ivory" onClick={e => e.stopPropagation()}>
            {cur.is_pinned && (
              <div className="mb-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-saffron/20 px-3 py-0.5 text-xs font-semibold text-saffron ring-1 ring-saffron/40">
                  <Pin className="h-3 w-3 fill-saffron text-saffron" />
                  <span>Pinned Photo</span>
                </span>
              </div>
            )}
            {cur.title && <p className="font-serif text-2xl">{cur.title}</p>}
            {cur.caption && <p className="text-sm text-sand">{cur.caption}</p>}
            <p className="mt-1 text-xs text-sand/60">{idx! + 1} / {list.length}</p>
          </div>
        </div>
      )}
    </div>
  )
}
