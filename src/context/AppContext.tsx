import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import { initDb } from '../db/database'
import { findUserByPin } from '../db/repo'
import { User } from '../types'

type Theme = 'dark' | 'light'

interface AppState {
  ready: boolean
  user: User | null
  theme: Theme
  login: (pin: string) => User | null
  logout: () => void
  toggleTheme: () => void
  /** bump to force consumers to re-read the DB */
  dataVersion: number
  refresh: () => void
}

const Ctx = createContext<AppState | null>(null)

const THEME_KEY = 'rizq-theme'
const USER_KEY = 'rizq-user'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('light', theme === 'light')
  root.classList.toggle('dark', theme === 'dark')
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [dataVersion, setDataVersion] = useState(0)
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null
    if (saved) return saved
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    void initDb().then(() => setReady(true))
  }, [])

  const login = useCallback((pin: string): User | null => {
    const u = findUserByPin(pin)
    if (u) {
      setUser(u)
      localStorage.setItem(USER_KEY, u.id)
    }
    return u
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(USER_KEY)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const refresh = useCallback(() => setDataVersion((v) => v + 1), [])

  return (
    <Ctx.Provider
      value={{ ready, user, theme, login, logout, toggleTheme, dataVersion, refresh }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
