import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { imageUrl, validateImage } from '../../lib/supabase'
import { useToast } from '../../components/ui'

/** Image picker with preview, replace and remove. `file` is a pending selection; `existingPath` is the saved image. */
export function ImageField({ label, existingPath, file, onFile, removed, onRemove, round, size = 'h-28 w-28' }: {
  label: string; existingPath?: string | null; file: File | null; onFile: (f: File | null) => void
  removed?: boolean; onRemove?: () => void; round?: boolean; size?: string
}) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const u = URL.createObjectURL(file); setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  const shown = preview ?? (removed ? null : imageUrl(existingPath))
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        <div className={`${size} shrink-0 overflow-hidden ${round ? 'rounded-full' : 'rounded-2xl'} bg-sand/60 ring-1 ring-sand`}>
          {shown ? <img src={shown} alt={`${label} preview`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-bark-faint"><ImagePlus className="h-6 w-6" /></div>}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={label}
            onChange={e => {
              const f = e.target.files?.[0]; if (!f) return
              const err = validateImage(f); if (err) { toast('error', err); e.target.value = ''; return }
              onFile(f)
            }} />
          <button type="button" className="btn-outline btn-sm" onClick={() => input.current?.click()}>{shown ? 'Replace' : 'Upload'}</button>
          {(shown && (file || existingPath)) && (
            <button type="button" className="btn-sm inline-flex items-center gap-1 text-xs text-red-700 hover:underline" onClick={() => { onFile(null); if (input.current) input.current.value = ''; onRemove?.() }}>
              <Trash2 className="h-3 w-3" />Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export const PageTitle = ({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) => (
  <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div><h1 className="text-4xl font-semibold">{title}</h1>{text && <p className="mt-1 text-sm text-bark-soft">{text}</p>}</div>
    {action}
  </div>
)

export const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block"><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-bark-faint">{hint}</span>}</label>
)

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
