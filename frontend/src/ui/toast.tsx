import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, errorMessage, type ToastApi, type ToastInput } from './toastContext'
import { Icon } from './Icon'

type Toast = ToastInput & { id: number }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
    const h = timers.current.get(id)
    if (h) window.clearTimeout(h)
    timers.current.delete(id)
  }, [])

  const show = useCallback(
    (t: ToastInput, ms = t.action ? 6500 : 3800) => {
      const id = ++seq.current
      setToasts((ts) => [...ts.slice(-2), { ...t, id }])
      timers.current.set(id, window.setTimeout(() => dismiss(id), ms))
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      error: (err, fallback) => show({ message: errorMessage(err, fallback), tone: 'error' }, 6000),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone ?? 'default'}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <span className="toast__msg">{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className="toast__action"
                onClick={async () => {
                  dismiss(t.id)
                  try {
                    await t.action!.run()
                  } catch (err) {
                    api.error(err)
                  }
                }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
