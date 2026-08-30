import { ButtonHTMLAttributes, ReactNode, InputHTMLAttributes } from 'react'
import { Icon, IconName } from './Icon'

/* ---------- Button ---------- */
type Variant = 'gold' | 'ghost' | 'danger' | 'success' | 'outline'
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  icon?: IconName
  block?: boolean
}
const VARIANTS: Record<Variant, string> = {
  gold: 'gold-gradient text-rizq-black font-bold hover:brightness-110 shadow-gold',
  ghost: 'bg-white/5 text-rizq-light hover:bg-white/10 border border-white/10',
  outline:
    'border border-rizq-gold/50 text-rizq-gold hover:bg-rizq-gold/10',
  danger: 'bg-rizq-danger/90 text-white hover:bg-rizq-danger',
  success: 'bg-rizq-success/90 text-white hover:bg-rizq-success',
}
export function Button({
  variant = 'ghost',
  icon,
  block,
  className = '',
  children,
  ...rest
}: BtnProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm
        transition active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none
        ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  )
}

/* ---------- Card ---------- */
export function Card({
  children,
  className = '',
  title,
  action,
}: {
  children: ReactNode
  className?: string
  title?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={`surface rounded-2xl ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
          <h3 className="text-base font-semibold">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

/* ---------- Input ---------- */
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}
export function Field({ label, className = '', ...rest }: FieldProps) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs text-rizq-light/60">{label}</span>}
      <input
        {...rest}
        className={`w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm
          outline-none transition placeholder:text-rizq-light/30
          focus:border-rizq-gold/60 focus:ring-2 focus:ring-rizq-gold/20 ${className}`}
      />
    </label>
  )
}

export function Select({
  label,
  children,
  className = '',
  ...rest
}: { label?: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs text-rizq-light/60">{label}</span>}
      <select
        {...rest}
        className={`w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm
          outline-none transition focus:border-rizq-gold/60 focus:ring-2 focus:ring-rizq-gold/20
          ${className}`}
      >
        {children}
      </select>
    </label>
  )
}

/* ---------- Modal ---------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`surface w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-auto rounded-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-rizq-light/60 hover:bg-white/10">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/* ---------- Badge / Pill ---------- */
export function Pill({
  children,
  tone = 'gold',
}: {
  children: ReactNode
  tone?: 'gold' | 'success' | 'warning' | 'danger' | 'muted'
}) {
  const tones = {
    gold: 'bg-rizq-gold/15 text-rizq-gold',
    success: 'bg-rizq-success/15 text-rizq-success',
    warning: 'bg-rizq-warning/15 text-rizq-warning',
    danger: 'bg-rizq-danger/15 text-rizq-danger',
    muted: 'bg-white/8 text-rizq-light/60',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

/* ---------- Empty ---------- */
export function Empty({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-rizq-light/40">
      <Icon name={icon} size={40} />
      <p className="text-sm">{text}</p>
    </div>
  )
}
