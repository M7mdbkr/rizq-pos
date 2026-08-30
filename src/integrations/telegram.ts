import {
  getTodayStats,
  getPaymentBreakdown,
  getTopProducts,
  getLowStock,
  getExpiringDocs,
  paymentLabel,
} from '../db/repo'
import { runAssistant, AssistantAction } from '../screens/owner/assistant/engine'
import { getSettings } from '../config/settings'
import { sar, pct } from '../utils/format'
import { PaymentMethod } from '../types'

const API = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`

interface TgResult<T> {
  ok: boolean
  result?: T
  description?: string
}

async function call<T>(token: string, method: string, body?: object): Promise<TgResult<T>> {
  try {
    const res = await fetch(API(token, method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    return (await res.json()) as TgResult<T>
  } catch (e) {
    return { ok: false, description: String(e) }
  }
}

export async function sendTelegram(text: string, chatId?: string): Promise<boolean> {
  const s = getSettings()
  const target = chatId || s.telegramChatId
  if (!s.telegramToken || !target) return false
  const r = await call(s.telegramToken, 'sendMessage', {
    chat_id: target,
    text,
    parse_mode: 'HTML',
  })
  return r.ok
}

/** Verify the bot token + chat id by sending a hello message. */
export async function testTelegram(): Promise<{ ok: boolean; error?: string }> {
  const s = getSettings()
  if (!s.telegramToken) return { ok: false, error: 'أدخل التوكن' }
  const me = await call<{ username: string }>(s.telegramToken, 'getMe')
  if (!me.ok) return { ok: false, error: 'التوكن غير صحيح' }
  if (!s.telegramChatId) return { ok: false, error: 'أدخل Chat ID' }
  const sent = await sendTelegram(
    `✅ تم الربط بنجاح مع <b>${getSettings().name}</b>\nبوت: @${me.result?.username ?? ''}\nأرسل لي أي سؤال مثل: «كم صافي ربح اليوم؟»`,
  )
  return sent ? { ok: true } : { ok: false, error: 'تعذّر الإرسال — تأكد من Chat ID' }
}

/** Compose the owner's daily summary message. */
export function buildDailyReport(): string {
  const s = getTodayStats()
  const margin = s.net > 0 ? (s.profit / s.net) * 100 : 0
  const pays = getPaymentBreakdown('today')
  const top = getTopProducts(3)
  const low = getLowStock()
  const biz = getSettings()
  const today = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const lines = [
    `📊 <b>تقرير ${biz.name}</b>`,
    `📅 ${today}`,
    ``,
    `💰 المبيعات: <b>${sar(s.sales)}</b>`,
    `🟢 صافي الربح: <b>${sar(s.profit)}</b> (هامش ${pct(margin)})`,
    `🧾 الطلبات: <b>${s.orders}</b>`,
    `🏷️ الخصومات: ${sar(s.discount)}`,
    `🧮 الضريبة: ${sar(s.vat)}`,
  ]

  if (pays.length) {
    lines.push('', '💳 <b>طرق الدفع:</b>')
    for (const p of pays)
      lines.push(`• ${paymentLabel(p.payment_method as PaymentMethod)}: ${sar(p.total)} (${p.count})`)
  }
  if (top.length) {
    lines.push('', '🥇 <b>الأكثر مبيعًا:</b>')
    top.forEach((t, i) => lines.push(`${i + 1}. ${t.name_ar} — ${sar(t.revenue)}`))
  }
  if (low.length) {
    lines.push('', `⚠️ <b>مخزون يحتاج تعبئة (${low.length}):</b>`)
    low.slice(0, 6).forEach((p) => lines.push(`• ${p.name_ar}: ${p.stock <= 0 ? 'نفد' : p.stock}`))
  }
  const docs = getExpiringDocs()
  if (docs.length) {
    lines.push('', `📄 <b>التزامات قريبة الانتهاء (${docs.length}):</b>`)
    docs
      .slice(0, 6)
      .forEach((d) =>
        lines.push(
          `• ${d.title}: ${d.days_left < 0 ? `منتهية منذ ${Math.abs(d.days_left)} يوم ⛔` : `باقي ${d.days_left} يوم`}`,
        ),
      )
  }
  return lines.join('\n')
}

/* ---------- Assistant over Telegram ---------- */

// pending write-actions awaiting "تأكيد" per chat
const pending = new Map<string, AssistantAction>()

function formatReply(text: string, rows?: { label: string; value: string }[]): string {
  let out = text
  if (rows && rows.length) {
    out += '\n\n' + rows.map((r) => `• ${r.label}: <b>${r.value}</b>`).join('\n')
  }
  return out
}

/** Handle one incoming owner message and return the reply to send. */
export function answerOwnerMessage(chatId: string, text: string): string {
  const t = text.trim()

  // daily report shortcuts
  if (/تقرير|ملخص|اليوم|الوضع/.test(t) && /تقرير|ملخص/.test(t)) {
    return buildDailyReport()
  }

  // confirm a pending write
  if (/^(تأكيد|نعم|اوكي|أوكي|تمام|ok)$/i.test(t)) {
    const act = pending.get(chatId)
    if (!act) return 'لا يوجد أمر بانتظار التأكيد.'
    pending.delete(chatId)
    return '✅ ' + act.run()
  }
  if (/^(الغاء|إلغاء|لا)$/i.test(t)) {
    pending.delete(chatId)
    return 'تم الإلغاء.'
  }

  const res = runAssistant(t)
  if (res.action) {
    pending.set(chatId, res.action)
    return formatReply(res.reply, res.rows) + '\n\n↩️ أرسل «تأكيد» للتنفيذ أو «إلغاء».'
  }
  return formatReply(res.reply, res.rows)
}

/* ---------- Polling loop (runs while the app is open) ---------- */

interface TgUpdate {
  update_id: number
  message?: { chat: { id: number }; text?: string }
}

const OFFSET_KEY = 'rizq-tg-offset'
const DAILY_KEY = 'rizq-tg-daily'
let polling = false
let timer: ReturnType<typeof setTimeout> | null = null

async function poll(): Promise<void> {
  const s = getSettings()
  if (!s.telegramToken) return
  const offset = Number(localStorage.getItem(OFFSET_KEY) || 0)
  const r = await call<TgUpdate[]>(s.telegramToken, 'getUpdates', { offset, timeout: 0 })
  if (r.ok && r.result) {
    for (const u of r.result) {
      localStorage.setItem(OFFSET_KEY, String(u.update_id + 1))
      const msg = u.message
      if (!msg?.text) continue
      const chatId = String(msg.chat.id)
      // only answer the configured owner chat
      if (s.telegramChatId && chatId !== s.telegramChatId) continue
      const reply = answerOwnerMessage(chatId, msg.text)
      await sendTelegram(reply, chatId)
    }
  }
}

async function maybeSendDaily(): Promise<void> {
  const s = getSettings()
  if (!s.telegramAutoDaily || !s.telegramToken || !s.telegramChatId) return
  const today = new Date().toISOString().slice(0, 10)
  if (localStorage.getItem(DAILY_KEY) === today) return
  localStorage.setItem(DAILY_KEY, today)
  await sendTelegram(buildDailyReport())
}

/** Start the background polling loop. Safe to call repeatedly. */
export function startTelegramBot(): void {
  if (polling) return
  const s = getSettings()
  if (!s.telegramToken || !s.telegramChatId) return
  polling = true
  void maybeSendDaily()
  const tick = async () => {
    if (!polling) return
    await poll()
    timer = setTimeout(tick, 4000)
  }
  void tick()
}

export function stopTelegramBot(): void {
  polling = false
  if (timer) clearTimeout(timer)
  timer = null
}

/** Restart so new settings (token/chat) take effect. */
export function restartTelegramBot(): void {
  stopTelegramBot()
  startTelegramBot()
}
