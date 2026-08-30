const AR = 'ar-SA'

/** Format a number as SAR currency (Western digits + ر.س). */
export function sar(n: number): string {
  const v = (Math.round((n + Number.EPSILON) * 100) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${v} ر.س`
}

/** Plain number with thousands separators, no currency. */
export function num(n: number): string {
  return n.toLocaleString('en-US')
}

export function pct(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString('en-US')}%`
}

/** Parse SQLite timestamp ("YYYY-MM-DD HH:MM:SS") into a Date. */
export function parseTs(ts: string): Date {
  return new Date(ts.replace(' ', 'T') + (ts.includes('Z') ? '' : 'Z'))
}

export function fmtDate(ts: string): string {
  const d = parseTs(ts)
  return d.toLocaleDateString(AR, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function fmtDateShort(ts: string): string {
  const d = parseTs(ts)
  return d.toLocaleDateString(AR, { month: 'short', day: 'numeric' })
}

export function fmtTime(ts: string): string {
  const d = parseTs(ts)
  return d.toLocaleTimeString(AR, { hour: '2-digit', minute: '2-digit' })
}

export function fmtDateTime(ts: string): string {
  return `${fmtDate(ts)} • ${fmtTime(ts)}`
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Weekday name in Arabic. */
export function weekdayAr(d: Date): string {
  return d.toLocaleDateString(AR, { weekday: 'long' })
}

/** Normalize a Saudi phone to international digits (9665XXXXXXXX). */
export function intlPhone(raw: string): string {
  let d = (raw || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('966')) return d
  if (d.startsWith('0')) return '966' + d.slice(1)
  if (d.length === 9 && d.startsWith('5')) return '966' + d
  return d
}

/** Build a wa.me WhatsApp link with an optional prefilled message. */
export function waLink(phone: string, text?: string): string {
  const p = intlPhone(phone)
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${p}${q}`
}
