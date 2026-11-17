import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ignoreShortcut } from './keys'

/** Press g, then one of these within a second and a half, to jump to a page. */
export const GO_TO_KEYS: { key: string; to: string; label: string }[] = [
  { key: 't', to: '/app', label: 'Today' },
  { key: 'r', to: '/app/review', label: 'Review' },
  { key: 'c', to: '/app/calendar', label: 'Calendar' },
  { key: 'o', to: '/app/courses', label: 'Courses' },
  { key: 'f', to: '/app/focus', label: 'Focus' },
  { key: 's', to: '/app/settings', label: 'Settings' },
]

export function useGoToKeys() {
  const navigate = useNavigate()
  useEffect(() => {
    let armedUntil = 0
    const onKey = (e: KeyboardEvent) => {
      if (ignoreShortcut(e, { allowOnButtons: true }) || e.shiftKey) {
        armedUntil = 0
        return
      }
      const key = e.key.toLowerCase()
      if (armedUntil > Date.now()) {
        armedUntil = 0
        const target = GO_TO_KEYS.find((k) => k.key === key)
        if (!target) return
        // Stop page shortcuts on the same letter (s skips in a review pass) from also firing.
        e.preventDefault()
        e.stopPropagation()
        navigate(target.to)
        return
      }
      if (key === 'g') armedUntil = Date.now() + 1500
    }
    // Capture phase, so this runs before any page's own key handler.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [navigate])
}
