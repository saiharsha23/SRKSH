import { useEffect } from 'react'
export function useTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = title.includes('SRKSH') ? title : `${title} · SRKSH`
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  }, [title, description])
}
