import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { findUserByPin } from '../db/repo'
import { Role } from '../types'
import { Icon, IconName } from '../components/Icon'

const PIN_LENGTH = 8

const ROLE_META: Record<Role, { label: string; desc: string; icon: IconName; hint: string }> = {
  owner: { label: 'المالك', desc: 'لوحة التحكم والتقارير والإعدادات', icon: 'star', hint: '12345678' },
  staff: { label: 'الكاشير', desc: 'الطلبات والمبيعات والمخزون', icon: 'user', hint: '11112222' },
}

export function LoginScreen() {
  const { login } = useApp()
  const [role, setRole] = useState<Role | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  function press(d: string) {
    if (pin.length >= PIN_LENGTH) return
    const next = pin + d
    setPin(next)
    setError(false)
    if (next.length === PIN_LENGTH) attempt(next)
  }

  function attempt(value: string) {
    const user = findUserByPin(value)
    if (!user || user.role !== role) {
      setError(true)
      setTimeout(() => {
        setPin('')
        setError(false)
      }, 700)
      return
    }
    login(value)
  }

  function backspace() {
    setPin((p) => p.slice(0, -1))
    setError(false)
  }

  function back() {
    setRole(null)
    setPin('')
    setError(false)
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-rizq-black">
      {/* ambient gold glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-rizq-gold/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-10 h-72 w-72 rounded-full bg-rizq-gold/5 blur-[100px]" />

      <div className="relative z-10 w-full max-w-sm px-6">
        {/* brand */}
        <div className="mb-8 text-center">
          <div className="mb-2 text-6xl font-bold text-rizq-gold" style={{ fontFamily: 'Reem Kufi' }}>
            رزق
          </div>
          <p className="text-sm text-rizq-light/50">نظام الكاشير الفاخر للمطاعم السعودية</p>
        </div>

        {role === null ? (
          <RoleSelect onPick={setRole} />
        ) : (
          <PinPad
            role={role}
            pin={pin}
            error={error}
            onPress={press}
            onBackspace={backspace}
            onBack={back}
          />
        )}
      </div>

      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
    </div>
  )
}

function RoleSelect({ onPick }: { onPick: (r: Role) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-rizq-light/70">اختر طريقة الدخول</p>
      <div className="grid grid-cols-1 gap-4">
        {(['owner', 'staff'] as Role[]).map((r) => {
          const m = ROLE_META[r]
          return (
            <button
              key={r}
              onClick={() => onPick(r)}
              className="surface group flex items-center gap-4 rounded-3xl p-5 text-right transition hover:border-rizq-gold/50 hover:shadow-gold active:scale-[0.98]"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rizq-gold/15 text-rizq-gold transition group-hover:gold-gradient group-hover:text-rizq-black">
                <Icon name={m.icon} size={26} />
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold">{m.label}</p>
                <p className="text-xs text-rizq-light/50">{m.desc}</p>
              </div>
              <Icon name="logout" size={18} className="rotate-180 text-rizq-light/30 transition group-hover:text-rizq-gold" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PinPad({
  role,
  pin,
  error,
  onPress,
  onBackspace,
  onBack,
}: {
  role: Role
  pin: string
  error: boolean
  onPress: (d: string) => void
  onBackspace: () => void
  onBack: () => void
}) {
  const m = ROLE_META[role]
  return (
    <div className="surface rounded-3xl p-7 shadow-2xl">
      {/* header with selected role + back */}
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-rizq-light/50 transition hover:bg-white/10 hover:text-rizq-light"
        >
          <Icon name="logout" size={15} />
          رجوع
        </button>
        <span className="flex items-center gap-2 rounded-full bg-rizq-gold/15 px-3 py-1 text-sm font-semibold text-rizq-gold">
          <Icon name={m.icon} size={15} />
          {m.label}
        </span>
      </div>

      <p className="mb-4 text-center text-sm text-rizq-light/70">أدخل الرمز السري</p>

      {/* dots */}
      <div className={`mb-7 flex justify-center gap-2.5 ${error ? 'animate-[shake_.4s]' : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full transition ${
              error ? 'bg-rizq-danger' : i < pin.length ? 'gold-gradient' : 'bg-white/15'
            }`}
          />
        ))}
      </div>

      {/* keypad */}
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} label={d} onClick={() => onPress(d)} />
        ))}
        <button
          onClick={onBackspace}
          className="flex h-16 items-center justify-center rounded-2xl bg-white/5 text-rizq-light/60 transition hover:bg-white/10 active:scale-95"
        >
          <Icon name="close" size={20} />
        </button>
        <Key label="0" onClick={() => onPress('0')} />
        <div />
      </div>

      <p className="mt-5 text-center text-xs text-rizq-light/30">
        الرمز التجريبي: {m.hint}
      </p>
    </div>
  )
}

function Key({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-num flex h-16 items-center justify-center rounded-2xl bg-white/5 text-2xl font-medium text-rizq-light transition hover:border-rizq-gold/40 hover:bg-rizq-gold/10 active:scale-95"
    >
      {label}
    </button>
  )
}
