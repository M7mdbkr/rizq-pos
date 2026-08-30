import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import {
  getCrmCustomers,
  getCrmStats,
  getCustomerOrders,
  getCustomerFavorites,
  updateCustomer,
} from '../../db/repo'
import { Customer } from '../../types'
import { exportWorkbook } from '../../utils/export'
import { Card, Button, Field, Modal, Pill, Empty } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { sar, fmtDate, fmtDateShort, intlPhone, waLink } from '../../utils/format'

type Segment = 'all' | 'vip' | 'repeat' | 'new' | 'inactive' | 'optin'

type CrmRow = Customer & { days_since: number }

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'vip', label: 'كبار المنفقين' },
  { id: 'repeat', label: 'عملاء متكررون' },
  { id: 'new', label: 'جدد' },
  { id: 'inactive', label: 'غير نشطين (+30 يوم)' },
  { id: 'optin', label: 'مشتركون بالتسويق' },
]

export function Customers() {
  const { dataVersion, refresh } = useApp()
  const { notify } = useToast()
  const all = useMemo(() => getCrmCustomers(), [dataVersion])
  const stats = useMemo(() => getCrmStats(), [dataVersion])

  const [seg, setSeg] = useState<Segment>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CrmRow | null>(null)

  const vipThreshold = useMemo(() => {
    const sorted = [...all].map((c) => c.total_spent).sort((a, b) => b - a)
    return sorted[Math.floor(sorted.length * 0.2)] ?? 0
  }, [all])

  const filtered = all.filter((c) => {
    if (search) {
      const q = search.trim()
      if (!(c.name?.includes(q) || c.phone.includes(q))) return false
    }
    switch (seg) {
      case 'vip':
        return c.total_spent >= vipThreshold && c.total_spent > 0
      case 'repeat':
        return c.orders_count > 1
      case 'new':
        return c.orders_count <= 1
      case 'inactive':
        return c.days_since >= 30
      case 'optin':
        return c.marketing_opt_in === 1
      default:
        return true
    }
  })

  function copyNumbers() {
    const nums = filtered.filter((c) => c.marketing_opt_in === 1).map((c) => intlPhone(c.phone))
    if (nums.length === 0) return notify('لا توجد أرقام في هذه الشريحة', 'warning')
    navigator.clipboard?.writeText(nums.join('\n'))
    notify(`تم نسخ ${nums.length} رقمًا (المشتركين فقط)`, 'success')
  }

  function exportSegment() {
    const rows = filtered.map((c) => ({
      الاسم: c.name ?? '',
      الجوال: c.phone,
      'الجوال الدولي': intlPhone(c.phone),
      'عدد الطلبات': c.orders_count,
      'إجمالي الإنفاق': c.total_spent,
      'آخر زيارة': fmtDate(c.last_seen),
      'أيام منذ آخر طلب': c.days_since,
      الوسوم: c.tags ?? '',
      'مشترك بالتسويق': c.marketing_opt_in ? 'نعم' : 'لا',
    }))
    if (rows.length === 0) return notify('لا يوجد عملاء للتصدير', 'warning')
    exportWorkbook(`rizq-customers-${seg}.xlsx`, [{ name: 'العملاء', rows }])
    notify(`تم تصدير ${rows.length} عميل`, 'success')
  }

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">قاعدة العملاء (التسويق)</h1>
          <p className="text-sm text-rizq-light/50">تتجمّع تلقائيًا مع كل طلب فيه رقم جوال</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" icon="phone" onClick={copyNumbers}>نسخ الأرقام</Button>
          <Button variant="gold" icon="download" onClick={exportSegment}>تصدير الشريحة</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="إجمالي العملاء" value={String(stats.total)} icon="user" />
        <Kpi label="عملاء متكررون" value={String(stats.repeat)} icon="star" />
        <Kpi label="مشتركون بالتسويق" value={String(stats.optIn)} icon="phone" />
        <Kpi label="متوسط إنفاق العميل" value={sar(stats.avgSpent)} icon="chart" />
      </div>

      {/* segments + search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Icon name="search" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rizq-light/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الجوال…"
            className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pr-10 pl-4 text-sm outline-none focus:border-rizq-gold/50"
          />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSeg(s.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
              seg === s.id
                ? 'border-rizq-gold bg-rizq-gold/15 font-semibold text-rizq-gold'
                : 'border-white/10 text-rizq-light/60 hover:bg-white/5'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* table */}
      <Card action={<Pill tone="muted">{filtered.length} عميل</Pill>} title="العملاء">
        {filtered.length === 0 ? (
          <Empty icon="user" text="لا يوجد عملاء في هذه الشريحة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/5 text-xs text-rizq-light/40">
                <tr>
                  <th className="px-4 py-3 text-right font-normal">العميل</th>
                  <th className="px-4 py-3 text-right font-normal">الجوال</th>
                  <th className="px-4 py-3 text-center font-normal">الطلبات</th>
                  <th className="px-4 py-3 text-left font-normal">الإنفاق</th>
                  <th className="px-4 py-3 text-right font-normal">آخر زيارة</th>
                  <th className="px-4 py-3 text-center font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.phone} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(c)} className="font-medium hover:text-rizq-gold">
                        {c.name || '—'}
                      </button>
                      {c.tags && <span className="mr-2"><Pill tone="gold">{c.tags}</Pill></span>}
                      {c.marketing_opt_in === 0 && <span className="mr-2"><Pill tone="danger">موقوف</Pill></span>}
                    </td>
                    <td className="px-4 py-3 font-num text-rizq-light/60" dir="ltr">{c.phone}</td>
                    <td className="px-4 py-3 text-center font-num">{c.orders_count}</td>
                    <td className="px-4 py-3 text-left font-num text-rizq-gold">{sar(c.total_spent)}</td>
                    <td className="px-4 py-3 text-rizq-light/50">
                      {fmtDateShort(c.last_seen)}
                      {c.days_since >= 30 && <span className="mr-1 text-xs text-rizq-warning"> (+{c.days_since}ي)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <a
                          href={waLink(c.phone, `مرحبًا ${c.name || ''}،`)}
                          target="_blank"
                          rel="noreferrer"
                          title="مراسلة واتساب"
                          className="rounded-lg p-1.5 text-rizq-light/50 transition hover:bg-rizq-success/15 hover:text-rizq-success"
                        >
                          <Icon name="phone" size={16} />
                        </a>
                        <button
                          title="التفاصيل"
                          onClick={() => setSelected(c)}
                          className="rounded-lg p-1.5 text-rizq-light/50 transition hover:bg-white/10 hover:text-rizq-gold"
                        >
                          <Icon name="user" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <CustomerModal
          customer={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: 'user' | 'star' | 'phone' | 'chart' }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-rizq-light/50">{label}</p>
          <p className="font-num mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rizq-gold/15 text-rizq-gold">
          <Icon name={icon} size={20} />
        </div>
      </div>
    </Card>
  )
}

function CustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: CrmRow
  onClose: () => void
  onSaved: () => void
}) {
  const { notify } = useToast()
  const orders = useMemo(() => getCustomerOrders(customer.phone), [customer.phone])
  const favs = useMemo(() => getCustomerFavorites(customer.phone), [customer.phone])
  const [name, setName] = useState(customer.name ?? '')
  const [tags, setTags] = useState(customer.tags ?? '')
  const [notes, setNotes] = useState(customer.notes ?? '')
  const [optIn, setOptIn] = useState(customer.marketing_opt_in === 1)

  function save() {
    updateCustomer(customer.phone, {
      name: name.trim(),
      tags: tags.trim(),
      notes: notes.trim(),
      marketing_opt_in: optIn ? 1 : 0,
    })
    notify('تم حفظ بيانات العميل', 'success')
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={customer.name || customer.phone} wide>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* edit */}
        <div className="space-y-3">
          <Field label="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="الوسوم (افصل بفاصلة)" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="VIP، دائم" />
          <Field label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button
            onClick={() => setOptIn((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl bg-black/20 px-4 py-3 text-sm hover:bg-black/30"
          >
            <span>الاشتراك في الرسائل التسويقية</span>
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${optIn ? 'gold-gradient' : 'bg-white/15'}`}>
              <span className={`absolute h-4 w-4 rounded-full bg-white transition-all ${optIn ? 'right-1' : 'right-6'}`} />
            </span>
          </button>
          <div className="flex gap-2 pt-1">
            <Button variant="gold" block icon="check" onClick={save}>حفظ</Button>
            <a href={waLink(customer.phone, `مرحبًا ${name || ''}،`)} target="_blank" rel="noreferrer">
              <Button variant="success" icon="phone">واتساب</Button>
            </a>
          </div>
        </div>

        {/* stats + history */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="إجمالي الإنفاق" value={sar(customer.total_spent)} />
            <Stat label="عدد الطلبات" value={String(customer.orders_count)} />
            <Stat label="أول زيارة" value={fmtDateShort(customer.first_seen)} />
            <Stat label="آخر زيارة" value={fmtDateShort(customer.last_seen)} />
          </div>

          {favs.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-rizq-light/50">الأصناف المفضلة</p>
              <div className="flex flex-wrap gap-1.5">
                {favs.map((f) => (
                  <Pill key={f.name_ar} tone="gold">{f.name_ar} ×{f.qty}</Pill>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs text-rizq-light/50">آخر الطلبات</p>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {orders.slice(0, 10).map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-xs">
                  <span className="text-rizq-light/60">{fmtDate(o.created_at)}</span>
                  <span className="font-num text-rizq-gold">{sar(o.final_total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/20 p-3">
      <p className="text-xs text-rizq-light/50">{label}</p>
      <p className="font-num mt-0.5 text-sm font-semibold text-rizq-gold">{value}</p>
    </div>
  )
}
