import { Camera } from 'lucide-react'

/** Clearly-labelled stand-in; never passes itself off as a real SRKSH photograph. */
export default function Placeholder({ label = 'Photograph to be added', className = '', ratio = '4/3' }: { label?: string; className?: string; ratio?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 border border-dashed border-gold/60 bg-gradient-to-br from-cream to-sand/60 text-bark-faint ${className}`} style={{ aspectRatio: ratio }} role="img" aria-label={`Placeholder: ${label}`}>
      <Camera className="h-8 w-8" />
      <span className="px-4 text-center text-xs font-medium uppercase tracking-wider">Placeholder · {label}</span>
    </div>
  )
}
