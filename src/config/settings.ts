import { PaymentMethod } from '../types'

export type PaperWidth = '58' | '80' | 'a4'

/**
 * Editable business profile — owner can change all of these from Settings
 * (or via the smart assistant). Persisted to localStorage so it survives
 * reloads without a server.
 */
export interface BusinessSettings {
  /** wordmark shown across the app (brand) */
  brand: string
  /** optional logo image (data URL) shown on the receipt */
  logo: string
  /** legal/display name on receipts */
  name: string
  /** VAT rate as a fraction, e.g. 0.15 */
  vatRate: number
  vatNumber: string
  phone: string
  address: string
  receiptFooter: string
  /** editable labels for each payment method / delivery app */
  paymentLabels: Record<PaymentMethod, string>
  /** number of customer-invoice copies to print */
  receiptCopies: number
  /** thermal/printer paper width */
  paperWidth: PaperWidth
  /** open the print dialog automatically right after checkout */
  autoPrint: boolean
  /** Telegram bot token (from @BotFather) */
  telegramToken: string
  /** owner's Telegram chat id to receive reports & ask the assistant */
  telegramChatId: string
  /** auto-send the daily summary once per day while the app is open */
  telegramAutoDaily: boolean
  /** Anthropic API key — enables the real AI assistant (stored locally on this device) */
  anthropicKey: string
  /** Claude model id for the assistant */
  aiModel: string
}

const KEY = 'rizq-business'

export const DEFAULT_PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'نقدًا',
  akita: 'كيتا',
  merzool: 'مرسول',
  ninja: 'نينجا',
}

export const DEFAULT_SETTINGS: BusinessSettings = {
  brand: 'رزق',
  logo: '',
  name: 'مطعم رزق',
  vatRate: 0.15,
  vatNumber: '',
  phone: '',
  address: '',
  receiptFooter: 'شكرًا لزيارتكم 🌟',
  paymentLabels: { ...DEFAULT_PAYMENT_LABELS },
  receiptCopies: 1,
  paperWidth: '80',
  autoPrint: false,
  telegramToken: '',
  telegramChatId: '',
  telegramAutoDaily: false,
  anthropicKey: '',
  aiModel: 'claude-opus-4-8',
}

let cache: BusinessSettings | null = null

export function getSettings(): BusinessSettings {
  if (cache) return cache
  let loaded: BusinessSettings
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    loaded = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      paymentLabels: { ...DEFAULT_PAYMENT_LABELS, ...(parsed.paymentLabels ?? {}) },
    }
  } catch {
    loaded = { ...DEFAULT_SETTINGS, paymentLabels: { ...DEFAULT_PAYMENT_LABELS } }
  }
  cache = loaded
  return loaded
}

export function saveSettings(patch: Partial<BusinessSettings>): BusinessSettings {
  const cur = getSettings()
  const next: BusinessSettings = {
    ...cur,
    ...patch,
    paymentLabels: { ...cur.paymentLabels, ...(patch.paymentLabels ?? {}) },
  }
  cache = next
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

/** Current VAT rate as a fraction (defaults to 0.15). */
export function vatRate(): number {
  return getSettings().vatRate
}

/** VAT rate as a display label, e.g. "15%". */
export function vatLabel(): string {
  return `${Math.round(vatRate() * 1000) / 10}%`
}

// Payment-method labels are now dynamic — see paymentLabel() in db/repo.ts.
