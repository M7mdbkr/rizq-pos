import { useApp } from '../context/AppContext'
import { Icon } from './Icon'

export function TopBar({ children }: { children?: React.ReactNode }) {
  const { user, logout, theme, toggleTheme } = useApp()
  return (
    <header className="surface flex items-center justify-between gap-4 border-b px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold text-rizq-gold" style={{ fontFamily: 'Reem Kufi' }}>
          رزق
        </span>
        <span className="hidden h-5 w-px bg-white/10 sm:block" />
        <div className="hidden flex-col leading-tight sm:flex">
          <span className="text-sm font-medium">{user?.name}</span>
          <span className="text-xs text-rizq-light/40">
            {user?.role === 'owner' ? 'مالك' : 'كاشير'}
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center">{children}</div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          title="تبديل الوضع"
          className="rounded-xl p-2 text-rizq-light/60 transition hover:bg-white/10"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-rizq-light/70 transition hover:bg-rizq-danger/20 hover:text-rizq-danger"
        >
          <Icon name="logout" size={18} />
          <span className="hidden sm:inline">خروج</span>
        </button>
      </div>
    </header>
  )
}
