import { createContext, useCallback, useContext, useState, ReactNode } from 'react'
import { Icon, IconName } from '../components/Icon'

type ToastType = 'success' | 'error' | 'warning' | 'info'
interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastApi {
  notify: (message: string, type?: ToastType) => void
}

const Ctx = createContext<ToastApi | null>(null)

const ICONS: Record<ToastType, IconName> = {
  success: 'check',
  error: 'close',
  warning: 'alert',
  info: 'sparkle',
}
const TONES: Record<ToastType, string> = {
  success: 'border-rizq-success/40 text-rizq-success',
  error: 'border-rizq-danger/40 text-rizq-danger',
  warning: 'border-rizq-warning/40 text-rizq-warning',
  info: 'border-rizq-gold/40 text-rizq-gold',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const notify = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`surface flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg
              ${TONES[t.type]} animate-[fadeIn_.2s_ease]`}
          >
            <Icon name={ICONS[t.type]} size={18} />
            <span className="text-rizq-light">{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
