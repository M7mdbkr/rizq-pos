import { useRef, useState, useEffect } from 'react'
import type AnthropicNS from '@anthropic-ai/sdk'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { Icon } from '../../components/Icon'
import { Button, Pill } from '../../components/ui'
import { runAssistant, AssistantResult, AssistantAction } from './assistant/engine'
import { runAiAssistant, aiEnabled } from '../../integrations/aiAssistant'

interface Msg {
  id: number
  role: 'user' | 'bot'
  text: string
  rows?: { label: string; value: string }[]
  action?: AssistantAction
  actions?: string[]
  loading?: boolean
  done?: boolean
}

const SUGGESTIONS = [
  'كم مبيعات اليوم؟',
  'صافي الربح اليوم',
  'وش أكثر صنف مبيعًا؟',
  'المخزون الناقص',
  'ارفع سعر برياني دجاج 10%',
  'أعد تخزين كل الناقص',
  'غيّر اسم مرسول إلى هنقرستيشن',
  'أضف صنف عصير مانجو بسعر 18 في قسم المشروبات',
  'خلي الضريبة 15%',
  'أنشئ كود خصم VIP بنسبة 20%',
]

let counter = 1

export function Assistant() {
  const { refresh } = useApp()
  const { notify } = useToast()
  const ai = aiEnabled()
  const aiHistory = useRef<AnthropicNS.MessageParam[]>([])
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 0,
      role: 'bot',
      text: ai
        ? 'أهلًا 👋 أنا مساعد رزق الذكي مدعومًا بـ Claude، وأدير متجرك بالكامل.\nاطلب أي شيء بكلامك الطبيعي: تقارير، تعديل أسعار، مخزون، خصومات، أقسام، تسويق…'
        : 'أهلًا 👋 أنا مساعد رزق (الوضع المحلي). للحصول على ذكاء كامل يفهم أي صياغة، أضف مفتاح Claude من الإعدادات.',
    },
  ])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim()
    if (!text || busy) return
    setInput('')

    if (!ai) {
      // local rule-based engine (synchronous, with confirm step)
      const res: AssistantResult = runAssistant(text)
      setMessages((m) => [
        ...m,
        { id: counter++, role: 'user', text },
        { id: counter++, role: 'bot', text: res.reply, rows: res.rows, action: res.action },
      ])
      return
    }

    // real AI agent (async, executes tools directly)
    const loadingId = counter++
    setMessages((m) => [
      ...m,
      { id: counter++, role: 'user', text },
      { id: loadingId, role: 'bot', text: '', loading: true },
    ])
    setBusy(true)
    try {
      const res = await runAiAssistant(text, aiHistory.current)
      aiHistory.current = res.history
      if (res.actions.length) refresh()
      setMessages((m) =>
        m.map((x) =>
          x.id === loadingId ? { ...x, text: res.reply, actions: res.actions, loading: false } : x,
        ),
      )
    } catch (e) {
      const err = e as { status?: number; message?: string }
      const msg =
        err.status === 401
          ? 'مفتاح Claude غير صحيح — راجع الإعدادات.'
          : `تعذّر الاتصال بالذكاء: ${err.message ?? ''}`
      setMessages((m) => m.map((x) => (x.id === loadingId ? { ...x, text: msg, loading: false } : x)))
      notify('فشل الاتصال بالمساعد الذكي', 'error')
    } finally {
      setBusy(false)
    }
  }

  function confirmAction(msgId: number, action: AssistantAction) {
    const result = action.run()
    notify(result, 'success')
    refresh()
    setMessages((m) => [
      ...m.map((x) => (x.id === msgId ? { ...x, done: true } : x)),
      { id: counter++, role: 'bot', text: '✅ ' + result },
    ])
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl gold-gradient text-rizq-black">
          <Icon name="sparkle" size={22} />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">المساعد الذكي</h1>
          <p className="text-xs text-rizq-light/50">صلاحيات كاملة • يعمل على بياناتك</p>
        </div>
        {ai ? <Pill tone="gold">مدعوم بـ Claude</Pill> : <Pill tone="muted">وضع محلي</Pill>}
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                m.role === 'user' ? 'bg-white/8 text-rizq-light' : 'surface border border-rizq-gold/15'
              }`}
            >
              {m.loading ? (
                <span className="flex items-center gap-2 text-sm text-rizq-light/60">
                  <Icon name="sparkle" size={15} className="animate-pulse text-rizq-gold" />
                  يفكّر…
                </span>
              ) : (
                <p className="whitespace-pre-line text-sm leading-relaxed">{m.text}</p>
              )}

              {m.rows && m.rows.length > 0 && (
                <div className="mt-3 space-y-1 rounded-xl bg-black/20 p-3">
                  {m.rows.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 text-xs">
                      <span className="text-rizq-light/60">{r.label}</span>
                      <span className="font-num font-medium text-rizq-gold">{r.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {m.actions && m.actions.length > 0 && (
                <div className="mt-3 space-y-1 rounded-xl border border-rizq-success/20 bg-rizq-success/5 p-2.5">
                  {m.actions.map((a, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-xs text-rizq-success">
                      <Icon name="check" size={13} /> {a}
                    </p>
                  ))}
                </div>
              )}

              {m.action && !m.done && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-rizq-gold/20 bg-rizq-gold/5 p-2.5">
                  <Icon name="alert" size={16} className="shrink-0 text-rizq-gold" />
                  <span className="flex-1 text-xs text-rizq-light/70">{m.action.summary}</span>
                  <Button variant="gold" icon="check" onClick={() => confirmAction(m.id, m.action!)}>
                    تنفيذ
                  </Button>
                </div>
              )}
              {m.action && m.done && <p className="mt-2 text-xs text-rizq-success">تم التنفيذ ✓</p>}
            </div>
          </div>
        ))}
      </div>

      {/* suggestions */}
      <div className="flex gap-2 overflow-x-auto px-5 pb-2 no-scrollbar">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={busy}
            className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-rizq-light/60 transition hover:border-rizq-gold/40 hover:text-rizq-gold disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      {/* input */}
      <div className="flex items-center gap-2 border-t border-white/5 p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={busy ? 'المساعد يعمل…' : 'اكتب سؤالك أو أمرك…'}
          disabled={busy}
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-rizq-gold/50 disabled:opacity-50"
        />
        <Button variant="gold" icon="sparkle" onClick={() => send()} disabled={busy}>
          إرسال
        </Button>
      </div>
    </div>
  )
}
