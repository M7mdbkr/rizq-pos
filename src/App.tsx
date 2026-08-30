import { useApp } from './context/AppContext'
import { LoginScreen } from './screens/LoginScreen'
import { StaffApp } from './screens/staff/StaffApp'
import { OwnerApp } from './screens/owner/OwnerApp'

export default function App() {
  const { ready, user } = useApp()

  if (!ready) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 bg-rizq-black">
        <div className="text-5xl font-bold text-rizq-gold" style={{ fontFamily: 'Reem Kufi' }}>
          رزق
        </div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 gold-gradient" style={{ animation: 'loadbar 1s ease infinite' }} />
        </div>
        <p className="text-sm text-rizq-light/50">جارٍ تجهيز النظام…</p>
        <style>{`@keyframes loadbar{0%{margin-inline-start:-50%}100%{margin-inline-start:100%}}`}</style>
      </div>
    )
  }

  if (!user) return <LoginScreen />
  return user.role === 'owner' ? <OwnerApp /> : <StaffApp />
}
