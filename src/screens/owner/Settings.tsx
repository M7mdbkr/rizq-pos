import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import {
  getUsers,
  addUser,
  deleteUser,
  updateUserPin,
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from '../../db/repo'
import { resetDb, exportBackup, importBackup } from '../../db/database'
import { Card, Button, Field, Select, Modal, Pill } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { Role, PaymentKind, PaymentMethodRow, PAYMENT_KIND_LABELS } from '../../types'
import { getSettings, saveSettings, BusinessSettings, PaperWidth } from '../../config/settings'
import {
  testTelegram,
  sendTelegram,
  buildDailyReport,
  restartTelegramBot,
} from '../../integrations/telegram'
import { testAiKey } from '../../integrations/aiAssistant'

export function Settings() {
  const { dataVersion, refresh, theme, toggleTheme, user } = useApp()
  const { notify } = useToast()
  const users = useMemo(() => getUsers(), [dataVersion])

  const [addOpen, setAddOpen] = useState(false)
  const [resetPin, setResetPin] = useState<{ id: string; name: string } | null>(null)

  function removeUser(id: string, name: string) {
    if (id === user?.id) {
      notify('لا يمكنك حذف حسابك الحالي', 'error')
      return
    }
    if (!confirm(`حذف "${name}"؟`)) return
    deleteUser(id)
    notify('تم حذف المستخدم', 'success')
    refresh()
  }

  async function factoryReset() {
    if (!confirm('سيتم حذف جميع البيانات وإعادة التهيئة. متابعة؟')) return
    await resetDb()
    notify('تمت إعادة التهيئة', 'success')
    refresh()
  }

  return (
    <div className="space-y-5 p-5">
      <h1 className="text-2xl font-bold">الإعدادات</h1>

      {/* store profile + VAT */}
      <StoreProfileCard onSaved={refresh} />

      {/* payment-method names + invoice/print settings */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PaymentMethodsCard onSaved={refresh} />
        <PrintSettingsCard onSaved={refresh} />
      </div>

      {/* AI assistant (Claude) */}
      <AiCard onSaved={refresh} />

      {/* Telegram bot */}
      <TelegramCard onSaved={refresh} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* staff */}
        <Card
          title="إدارة الموظفين"
          action={<Button variant="outline" icon="plus" onClick={() => setAddOpen(true)}>إضافة</Button>}
        >
          <div className="divide-y divide-white/5">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rizq-gold/15 text-rizq-gold">
                  <Icon name="user" size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-rizq-light/40">PIN: ••••••••</p>
                </div>
                <Pill tone={u.role === 'owner' ? 'gold' : 'muted'}>
                  {u.role === 'owner' ? 'مالك' : 'كاشير'}
                </Pill>
                <button
                  title="تغيير الرمز"
                  onClick={() => setResetPin({ id: u.id, name: u.name })}
                  className="rounded-lg p-1.5 text-rizq-light/50 hover:bg-white/10 hover:text-rizq-gold"
                >
                  <Icon name="edit" size={16} />
                </button>
                <button
                  title="حذف"
                  onClick={() => removeUser(u.id, u.name)}
                  className="rounded-lg p-1.5 text-rizq-light/50 hover:bg-white/10 hover:text-rizq-danger"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          {/* appearance */}
          <Card title="المظهر واللغة">
            <div className="space-y-2 p-4">
              <button
                onClick={toggleTheme}
                className="flex w-full items-center justify-between rounded-xl bg-black/20 px-4 py-3 text-sm hover:bg-black/30"
              >
                <span className="flex items-center gap-2">
                  <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} />
                  الوضع {theme === 'dark' ? 'الداكن' : 'الفاتح'}
                </span>
                <Toggle on={theme === 'dark'} />
              </button>
              <div className="flex w-full items-center justify-between rounded-xl bg-black/20 px-4 py-3 text-sm opacity-60">
                <span>اللغة: العربية</span>
                <Pill tone="muted">الإنجليزية قريبًا</Pill>
              </div>
            </div>
          </Card>

          {/* backup & restore */}
          <BackupCard onChange={refresh} />

          {/* danger zone */}
          <Card title="منطقة الخطر">
            <div className="p-4">
              <Button variant="danger" icon="trash" onClick={factoryReset}>
                إعادة تهيئة جميع البيانات
              </Button>
              <p className="mt-2 text-xs text-rizq-light/40">
                يحذف كل الطلبات والأصناف ويعيد البيانات التجريبية.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {addOpen && (
        <AddUserModal
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false)
            refresh()
          }}
        />
      )}
      {resetPin && (
        <ResetPinModal
          target={resetPin}
          onClose={() => setResetPin(null)}
          onDone={() => {
            setResetPin(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function BackupCard({ onChange }: { onChange: () => void }) {
  const { notify } = useToast()
  const [busy, setBusy] = useState(false)

  function download() {
    const blob = exportBackup()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rizq-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    notify('تم تنزيل النسخة الاحتياطية', 'success')
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!confirm('سيتم استبدال كل البيانات الحالية بالنسخة المستوردة. متابعة؟')) return
    setBusy(true)
    try {
      const text = await file.text()
      await importBackup(text)
      notify('تم الاستيراد — جارٍ إعادة التشغيل', 'success')
      onChange()
      setTimeout(() => location.reload(), 600)
    } catch (err) {
      notify(`فشل الاستيراد: ${(err as Error).message}`, 'error')
      setBusy(false)
    }
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Icon name="download" size={18} className="text-rizq-gold" /> النسخ الاحتياطي
        </span>
      }
    >
      <div className="space-y-3 p-4">
        <p className="text-xs text-rizq-light/50">
          نزّل نسخة كاملة (البيانات + الإعدادات) كملف، أو استوردها لاسترجاع بياناتك أو نقلها لجهاز آخر.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="gold" icon="download" onClick={download} disabled={busy}>
            تنزيل نسخة احتياطية
          </Button>
          <label className="inline-flex">
            <span
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-rizq-gold/50 px-4 py-2.5 text-sm text-rizq-gold transition hover:bg-rizq-gold/10 ${busy ? 'pointer-events-none opacity-40' : ''}`}
            >
              <Icon name="box" size={18} /> استيراد نسخة
            </span>
            <input type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
          </label>
        </div>
        <p className="text-xs text-rizq-light/40">
          ✓ الحفظ التلقائي والتخزين الدائم مفعّلان — بياناتك تبقى بعد إغلاق التطبيق أو إعادة تشغيل الجهاز.
        </p>
      </div>
    </Card>
  )
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${on ? 'gold-gradient' : 'bg-white/15'}`}
    >
      <span
        className={`absolute h-4 w-4 rounded-full bg-white transition-all ${on ? 'right-1' : 'right-6'}`}
      />
    </span>
  )
}

function StoreProfileCard({ onSaved }: { onSaved: () => void }) {
  const { notify } = useToast()
  const [form, setForm] = useState<BusinessSettings>(() => ({ ...getSettings() }))
  const set = (k: keyof BusinessSettings, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }))

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500_000) {
      notify('حجم الصورة كبير — اختر صورة أصغر من 500KB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => set('logo', String(reader.result))
    reader.readAsDataURL(file)
  }

  function save() {
    if (!form.brand.trim() || !form.name.trim()) {
      notify('أدخل اسم المتجر والعلامة', 'error')
      return
    }
    const rate = Math.max(0, Math.min(1, form.vatRate))
    saveSettings({ ...form, vatRate: rate })
    notify('تم حفظ بيانات المتجر', 'success')
    onSaved()
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Icon name="settings" size={18} className="text-rizq-gold" /> بيانات المتجر والضريبة
        </span>
      }
      action={
        <Button variant="gold" icon="check" onClick={save}>
          حفظ
        </Button>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        {/* logo uploader */}
        <div className="flex items-center gap-4 rounded-xl bg-black/20 p-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {form.logo ? (
              <img src={form.logo} alt="شعار" className="h-full w-full object-contain" />
            ) : (
              <span className="text-2xl font-bold text-rizq-gold" style={{ fontFamily: 'Reem Kufi' }}>
                {form.brand || 'رزق'}
              </span>
            )}
          </div>
          <div className="flex-1">
            <p className="mb-1 text-sm font-medium">شعار الفاتورة</p>
            <p className="mb-2 text-xs text-rizq-light/40">صورة PNG/JPG تظهر أعلى الفاتورة (أقل من 500KB).</p>
            <div className="flex gap-2">
              <label className="cursor-pointer rounded-lg border border-rizq-gold/40 px-3 py-1.5 text-xs text-rizq-gold transition hover:bg-rizq-gold/10">
                رفع صورة
                <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
              </label>
              {form.logo && (
                <button
                  onClick={() => set('logo', '')}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-rizq-light/60 hover:text-rizq-danger"
                >
                  إزالة
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="العلامة (الشعار النصي)" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
          <Field label="اسم المتجر" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <Field
            label="نسبة الضريبة %"
            type="number"
            value={Math.round(form.vatRate * 1000) / 10}
            onChange={(e) => set('vatRate', (parseFloat(e.target.value) || 0) / 100)}
          />
          <Field label="الرقم الضريبي" value={form.vatNumber} onChange={(e) => set('vatNumber', e.target.value)} placeholder="3xxxxxxxxxxxxx3" />
          <Field label="رقم الجوال" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <Field label="العنوان" value={form.address} onChange={(e) => set('address', e.target.value)} />
          <Field
            label="نص أسفل الفاتورة"
            value={form.receiptFooter}
            onChange={(e) => set('receiptFooter', e.target.value)}
            className="md:col-span-2 lg:col-span-3"
          />
        </div>
      </div>
    </Card>
  )
}

const PAY_KINDS: PaymentKind[] = ['cash', 'card', 'delivery']

function PaymentMethodsCard({ onSaved }: { onSaved: () => void }) {
  const { notify } = useToast()
  const { dataVersion } = useApp()
  const methods = useMemo(() => getPaymentMethods(), [dataVersion])
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<PaymentKind>('delivery')

  function add() {
    if (!newName.trim()) return notify('أدخل اسم طريقة الدفع', 'error')
    addPaymentMethod(newName.trim(), newKind)
    notify('تمت الإضافة', 'success')
    setNewName('')
    onSaved()
  }
  function rename(m: PaymentMethodRow, name: string) {
    updatePaymentMethod(m.id, { name })
    onSaved()
  }
  function toggle(m: PaymentMethodRow) {
    updatePaymentMethod(m.id, { active: m.active ? 0 : 1 })
    onSaved()
  }
  function remove(m: PaymentMethodRow) {
    if (!confirm(`حذف «${m.name}»؟`)) return
    deletePaymentMethod(m.id)
    notify('تم الحذف', 'success')
    onSaved()
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Icon name="tag" size={18} className="text-rizq-gold" /> طرق الدفع وشركات التوصيل
        </span>
      }
    >
      <div className="space-y-2 p-5">
        <p className="mb-1 text-xs text-rizq-light/40">أضف/عدّل/احذف أي طريقة دفع أو تطبيق توصيل.</p>
        {methods.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-xl bg-black/20 p-2">
            <input
              value={m.name}
              onChange={(e) => rename(m, e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-rizq-gold/50"
            />
            <Pill tone="muted">{PAYMENT_KIND_LABELS[m.kind]}</Pill>
            <button title={m.active ? 'مفعّل' : 'معطّل'} onClick={() => toggle(m)}>
              <Toggle on={m.active === 1} />
            </button>
            <button
              onClick={() => remove(m)}
              className="rounded-lg p-1.5 text-rizq-light/50 hover:bg-white/10 hover:text-rizq-danger"
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}

        <div className="flex items-end gap-2 border-t border-white/5 pt-3">
          <div className="flex-1">
            <Field label="طريقة جديدة" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثال: هنقرستيشن" />
          </div>
          <Select label="النوع" value={newKind} onChange={(e) => setNewKind(e.target.value as PaymentKind)}>
            {PAY_KINDS.map((k) => (
              <option key={k} value={k}>{PAYMENT_KIND_LABELS[k]}</option>
            ))}
          </Select>
          <Button variant="gold" icon="plus" onClick={add}>إضافة</Button>
        </div>
      </div>
    </Card>
  )
}

const PAPER_OPTIONS: { id: PaperWidth; label: string }[] = [
  { id: '58', label: 'حراري 58مم' },
  { id: '80', label: 'حراري 80مم' },
  { id: 'a4', label: 'عادي A4' },
]

function PrintSettingsCard({ onSaved }: { onSaved: () => void }) {
  const { notify } = useToast()
  const [s, setS] = useState({ ...getSettings() })

  function save() {
    saveSettings({
      receiptCopies: Math.max(1, Math.min(5, Math.round(s.receiptCopies))),
      paperWidth: s.paperWidth,
      autoPrint: s.autoPrint,
    })
    notify('تم حفظ إعدادات الطباعة', 'success')
    onSaved()
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Icon name="print" size={18} className="text-rizq-gold" /> إعدادات الطباعة والفاتورة
        </span>
      }
      action={<Button variant="gold" icon="check" onClick={save}>حفظ</Button>}
    >
      <div className="space-y-4 p-5">
        {/* paper width */}
        <div>
          <span className="mb-1.5 block text-xs text-rizq-light/60">حجم ورق الطابعة</span>
          <div className="flex gap-2">
            {PAPER_OPTIONS.map((p) => (
              <button
                key={p.id}
                onClick={() => setS((x) => ({ ...x, paperWidth: p.id }))}
                className={`flex-1 rounded-lg border py-2 text-xs transition ${
                  s.paperWidth === p.id
                    ? 'border-rizq-gold bg-rizq-gold/15 font-semibold text-rizq-gold'
                    : 'border-white/10 text-rizq-light/60 hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* copies */}
        <div>
          <span className="mb-1.5 block text-xs text-rizq-light/60">عدد نسخ فاتورة العميل</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setS((x) => ({ ...x, receiptCopies: Math.max(1, x.receiptCopies - 1) }))}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-rizq-gold/20 hover:text-rizq-gold"
            >
              <Icon name="minus" size={16} />
            </button>
            <span className="font-num w-10 text-center text-xl">{s.receiptCopies}</span>
            <button
              onClick={() => setS((x) => ({ ...x, receiptCopies: Math.min(5, x.receiptCopies + 1) }))}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-rizq-gold/20 hover:text-rizq-gold"
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        </div>

        {/* auto print */}
        <button
          onClick={() => setS((x) => ({ ...x, autoPrint: !x.autoPrint }))}
          className="flex w-full items-center justify-between rounded-xl bg-black/20 px-4 py-3 text-sm hover:bg-black/30"
        >
          <span>طباعة تلقائية بعد تأكيد الطلب</span>
          <Toggle on={s.autoPrint} />
        </button>
      </div>
    </Card>
  )
}

function AiCard({ onSaved }: { onSaved: () => void }) {
  const { notify } = useToast()
  const [key, setKey] = useState(getSettings().anthropicKey)
  const [busy, setBusy] = useState(false)

  function save() {
    saveSettings({ anthropicKey: key.trim() })
    notify('تم حفظ مفتاح الذكاء الاصطناعي', 'success')
    onSaved()
  }
  async function test() {
    save()
    setBusy(true)
    const r = await testAiKey()
    setBusy(false)
    notify(r.ok ? 'تم الاتصال بـ Claude بنجاح ✅' : `فشل: ${r.error}`, r.ok ? 'success' : 'error')
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Icon name="sparkle" size={18} className="text-rizq-gold" /> المساعد الذكي (Claude)
        </span>
      }
      action={
        <span className="flex items-center gap-2">
          {getSettings().anthropicKey ? <Pill tone="success">مفعّل</Pill> : <Pill tone="muted">غير مفعّل</Pill>}
          <Button variant="gold" icon="check" onClick={save}>حفظ</Button>
        </span>
      }
    >
      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-rizq-gold/15 bg-rizq-gold/5 p-3 text-xs leading-relaxed text-rizq-light/70">
          <p>
            أضف مفتاح Claude ليتحوّل «المساعد الذكي» إلى ذكاء اصطناعي حقيقي يفهم أي صياغة وينفّذ الأوامر
            على متجرك (أسعار، مخزون، أقسام، خصومات، تسويق…). احصل على المفتاح من{' '}
            <span className="text-rizq-gold">console.anthropic.com</span>.
          </p>
          <p className="mt-1 text-rizq-light/40">المفتاح يُحفظ على هذا الجهاز فقط ويُستخدم للاتصال المباشر بـ Claude.</p>
        </div>
        <Field
          label="مفتاح Claude API"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-..."
          className="font-num"
        />
        <Button variant="outline" icon="sparkle" onClick={test} disabled={busy}>
          {busy ? 'جارٍ الاختبار…' : 'اختبار الاتصال'}
        </Button>
      </div>
    </Card>
  )
}

function TelegramCard({ onSaved }: { onSaved: () => void }) {
  const { notify } = useToast()
  const [token, setToken] = useState(getSettings().telegramToken)
  const [chatId, setChatId] = useState(getSettings().telegramChatId)
  const [autoDaily, setAutoDaily] = useState(getSettings().telegramAutoDaily)
  const [busy, setBusy] = useState(false)

  function save() {
    saveSettings({ telegramToken: token.trim(), telegramChatId: chatId.trim(), telegramAutoDaily: autoDaily })
    restartTelegramBot()
    notify('تم حفظ إعدادات تيليجرام', 'success')
    onSaved()
  }

  async function test() {
    save()
    setBusy(true)
    const r = await testTelegram()
    setBusy(false)
    notify(r.ok ? 'تم الربط — وصلتك رسالة على تيليجرام ✅' : `فشل: ${r.error}`, r.ok ? 'success' : 'error')
  }

  async function sendNow() {
    save()
    setBusy(true)
    const ok = await sendTelegram(buildDailyReport())
    setBusy(false)
    notify(ok ? 'تم إرسال تقرير اليوم' : 'تعذّر الإرسال — تحقق من الربط', ok ? 'success' : 'error')
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Icon name="sparkle" size={18} className="text-rizq-gold" /> بوت تيليجرام (تقارير ومساعد ذكي)
        </span>
      }
      action={<Button variant="gold" icon="check" onClick={save}>حفظ</Button>}
    >
      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-rizq-gold/15 bg-rizq-gold/5 p-3 text-xs leading-relaxed text-rizq-light/70">
          <p className="mb-1 font-semibold text-rizq-gold">طريقة الربط:</p>
          <p>1. افتح <b>@BotFather</b> في تيليجرام وأرسل <code>/newbot</code> وخذ التوكن.</p>
          <p>2. أرسل أي رسالة لبوتك، ثم افتح <b>@userinfobot</b> لتعرف <b>Chat ID</b> الخاص بك.</p>
          <p>3. الصق التوكن والـID هنا واضغط «اختبار الربط».</p>
          <p className="mt-1 text-rizq-light/40">يعمل أثناء فتح التطبيق على جهاز. للعمل ٢٤ ساعة يُربط بالسحابة لاحقًا.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="توكن البوت (Bot Token)" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456:ABC-..." />
          <Field label="Chat ID" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="مثال: 123456789" />
        </div>

        <button
          onClick={() => setAutoDaily((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl bg-black/20 px-4 py-3 text-sm hover:bg-black/30"
        >
          <span>إرسال تقرير يومي تلقائيًا</span>
          <Toggle on={autoDaily} />
        </button>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon="sparkle" onClick={test} disabled={busy}>اختبار الربط</Button>
          <Button variant="ghost" icon="chart" onClick={sendNow} disabled={busy}>إرسال تقرير اليوم الآن</Button>
        </div>

        <p className="text-xs text-rizq-light/40">
          بعد الربط، أرسل للبوت أسئلة مثل: «كم صافي ربح اليوم؟» أو «المخزون الناقص» أو «ارفع سعر برياني 10%» — يرد عليك المساعد الذكي.
        </p>
      </div>
    </Card>
  )
}

function AddUserModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [pin, setPin] = useState('')

  function save() {
    if (!name.trim()) return notify('أدخل الاسم', 'error')
    if (pin.length !== 8 || !/^\d+$/.test(pin)) return notify('الرمز يجب أن يكون 8 أرقام', 'error')
    addUser(name.trim(), role, pin)
    notify('تمت إضافة المستخدم', 'success')
    onAdded()
  }

  return (
    <Modal open onClose={onClose} title="إضافة مستخدم">
      <div className="space-y-4">
        <Field label="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="الدور" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="staff">كاشير</option>
          <option value="owner">مالك</option>
        </Select>
        <Field
          label="الرمز السري (8 أرقام)"
          value={pin}
          inputMode="numeric"
          maxLength={8}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className="font-num tracking-widest"
        />
        <div className="flex gap-2 pt-2">
          <Button variant="gold" block icon="check" onClick={save}>إضافة</Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Modal>
  )
}

function ResetPinModal({
  target,
  onClose,
  onDone,
}: {
  target: { id: string; name: string }
  onClose: () => void
  onDone: () => void
}) {
  const { notify } = useToast()
  const [pin, setPin] = useState('')
  function save() {
    if (pin.length !== 8 || !/^\d+$/.test(pin)) return notify('الرمز يجب أن يكون 8 أرقام', 'error')
    updateUserPin(target.id, pin)
    notify('تم تغيير الرمز', 'success')
    onDone()
  }
  return (
    <Modal open onClose={onClose} title={`تغيير رمز ${target.name}`}>
      <div className="space-y-4">
        <Field
          label="الرمز الجديد (8 أرقام)"
          value={pin}
          inputMode="numeric"
          maxLength={8}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className="font-num tracking-widest"
        />
        <div className="flex gap-2">
          <Button variant="gold" block icon="check" onClick={save}>حفظ</Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Modal>
  )
}
