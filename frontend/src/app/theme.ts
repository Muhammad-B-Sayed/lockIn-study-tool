import { useCallback, useSyncExternalStore } from 'react'

export type ThemePref = 'dark' | 'light' | 'system'
const KEY = 'lockin.theme'
const listeners = new Set<() => void>()

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

function resolve(pref: ThemePref): 'dark' | 'light' {
  if (pref !== 'system') return pref
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyTheme(pref: ThemePref = read()) {
  const t = resolve(pref)
  document.documentElement.dataset.theme = t
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', t === 'light' ? '#f2f1ed' : '#141513')
}

if (typeof window !== 'undefined') {
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (read() === 'system') applyTheme('system')
  })
}

export function useTheme() {
  const pref = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => 'system' as ThemePref,
  )
  const setPref = useCallback((p: ThemePref) => {
    try {
      localStorage.setItem(KEY, p)
    } catch {
      /* private mode: theme still applies for this visit */
    }
    applyTheme(p)
    listeners.forEach((l) => l())
  }, [])
  return { pref, setPref, resolved: typeof window === 'undefined' ? 'dark' : resolve(pref) }
}
