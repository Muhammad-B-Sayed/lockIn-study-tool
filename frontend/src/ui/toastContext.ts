import { createContext, useContext, type ReactNode } from 'react'

export type ToastInput = {
  message: ReactNode
  tone?: 'default' | 'error'
  action?: { label: string; run: () => void | Promise<void> }
}

export type ToastApi = {
  show: (t: ToastInput, ms?: number) => void
  error: (err: unknown, fallback?: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function errorMessage(err: unknown, fallback = 'Something went wrong. Try again.') {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message) {
    return err.message
  }
  return fallback
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast outside ToastProvider')
  return ctx
}
