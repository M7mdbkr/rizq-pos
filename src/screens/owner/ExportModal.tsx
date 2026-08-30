import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import {
  getReportData,
  getProducts,
  getCrmCustomers,
  logExport,
  paymentLabel,
} from '../../db/repo'
import { ORDER_TYPE_LABELS } from '../../types'
import { exportWorkbook } from '../../utils/export'
import { getSettings } from '../../config/settings'
import { fmtDateTime, fmtDate, todayIso, intlPhone } from '../../utils/format'
import { Modal, Button, Field } from '../../components/ui'
import { Icon } from '../../components/Icon'

type Scope = 'today' | 'yesterday' | 'last7' | 'month' | 'all' | 'custom'

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'today', label: 'اليوم' },
  { id: 'yesterday', label: 'أمس' },
  { id: 'last7', label: 'آخر ٧ أيام' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'all', label: 'الكل' },
  { id: 'custom', label: 'فترة مخصصة' },
]

type SheetKey = 'ledger' | 'saleDetails' | 'orders' | 'payments' | 'inventory' | 'customers'

const SHEETS: { id: SheetKey; label: string }[] = [
  { id: 'saleDetails', label: 'تفاصيل المبيعات (كل صنف)' },
  { id: 'ledger', label: 'دفتر اليومية' },
  { id: 'orders', label: 'الطلبات' },
  { id: 'payments', label: 'طرق الدفع' },
  { id: 'inventory', label: 'المخزون' },
  { id: 'customers', label: 'العملاء' },
]

function isoMinus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
function monthStart(): string {
  return new Date().toISOString().slice(0, 7) + '-01'
}

export function ExportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { user } = useApp()
  const { notify } = useToast()
  const [scope, setScope] = useState<Scope>('today')
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [sel, setSel] = useState<Record<SheetKey, boolean>>({
    saleDetails: true,
    ledger: true,
    orders: true,
    payments: true,
    inventory: false,
    customers: false,
  })

  function range(): { from: string | null; to: string | null; label: string } {
    switch (scope) {
      case 'today':
        return { from: todayIso(), to: todayIso(), label: 'اليوم' }
      case 'yesterday':
        return { from: isoMinus(1), to: isoMinus(1), label: 'أمس' }
      case 'last7':
        return { from: isoMinus(6), to: todayIso(), label: 'آخر ٧ أيام' }
      case 'month':
        return { from: monthStart(), to: todayIso(), label: 'هذا الشهر' }
      case 'all':
        return { from: null, to: null, label: 'كل الفترات' }
      case 'custom':
        return { from, to, label: `${from} ← ${to}` }
    }
  }

  function toggle(k: SheetKey) {
    setSel((s) => ({ ...s, [k]: !s[k] }))
  }

  function doExport() {
    const r = range()
    const biz = getSettings()
    const data = getReportData(r.from, r.to)

    if (data.orders.length === 0 && scope !== 'all') {
      notify('لا توجد مبيعات في هذه الفترة', 'warning')
      return
    }

    const gross = +(data.totals.net - data.totals.cost).toFixed(2)
    const sheets: { name: string; rows: Record<string, unknown>[] }[] = []

    // info sheet (always) — restaurant name + report meta
    sheets.push({
      name: 'معلومات التقرير',
      rows: [
        { البيان: 'المتجر', القيمة: biz.name },
        { البيان: 'العلامة', القيمة: biz.brand },
        { البيان: 'الرقم الضريبي', القيمة: biz.vatNumber || '—' },
        { البيان: 'نوع التقرير', القيمة: 'تقرير مبيعات' },
        { البيان: 'الفترة', القيمة: r.label },
        { البيان: 'من', القيمة: r.from ?? 'البداية' },
        { البيان: 'إلى', القيمة: r.to ?? 'الآن' },
        { البيان: 'تاريخ الإصدار', القيمة: fmtDateTime(new Date().toISOString()) },
        { البيان: 'أصدره', القيمة: user?.name ?? '' },
        { البيان: 'عدد الطلبات', القيمة: data.totals.orders },
        { البيان: 'إجمالي المبيعات', القيمة: data.totals.sales },
        { البيان: 'صافي المبيعات', القيمة: data.totals.net },
        { البيان: 'الخصومات', القيمة: data.totals.discount },
        { البيان: 'ضريبة القيمة المضافة', القيمة: data.totals.vat },
        { البيان: 'التكلفة', القيمة: data.totals.cost },
        { البيان: 'الربح الإجمالي', القيمة: gross },
      ],
    })

    if (sel.saleDetails)
      sheets.push({
        name: 'تفاصيل المبيعات',
        rows: data.saleLines.map((l) => ({
          التاريخ: fmtDateTime(l.created_at),
          'رقم الطلب': l.order_id.slice(-8).toUpperCase(),
          الصنف: l.name,
          الكمية: l.quantity,
          'سعر الوحدة': l.unit_price,
          الإجمالي: l.total,
          الملاحظة: l.note ?? '',
          'نوع الطلب': ORDER_TYPE_LABELS[l.order_type],
          الطاولة: l.table_no ?? '',
          'طريقة الدفع': paymentLabel(l.payment_method),
        })),
      })

    if (sel.ledger)
      sheets.push({
        name: 'دفتر اليومية',
        rows: data.ledger.map((d) => ({
          التاريخ: d.date,
          الطلبات: d.orders,
          المبيعات: d.sales,
          الصافي: d.net,
          الخصومات: d.discount,
          الضريبة: d.vat,
        })),
      })

    if (sel.orders)
      sheets.push({
        name: 'الطلبات',
        rows: data.orders.map((o) => ({
          'رقم الطلب': o.id.slice(-8).toUpperCase(),
          التاريخ: fmtDateTime(o.created_at),
          العميل: o.customer_name ?? '',
          الجوال: o.customer_phone ?? '',
          'نوع الطلب': ORDER_TYPE_LABELS[o.order_type ?? 'dine_in'],
          المجموع: o.total,
          الخصم: o.discount_amount,
          الضريبة: o.vat_amount,
          الإجمالي: o.final_total,
          'طريقة الدفع': paymentLabel(o.payment_method),
        })),
      })

    if (sel.payments)
      sheets.push({
        name: 'طرق الدفع',
        rows: data.payments.map((pm) => ({
          'طريقة الدفع': paymentLabel(pm.payment_method),
          'عدد الطلبات': pm.count,
          الإجمالي: pm.total,
        })),
      })

    if (sel.inventory)
      sheets.push({
        name: 'المخزون',
        rows: getProducts().map((p) => ({
          الصنف: p.name_ar,
          السعر: p.price,
          التكلفة: p.cost,
          المخزون: p.stock,
          'حد التنبيه': p.min_stock,
          الحالة: p.status === 'active' ? 'متاح' : 'معطّل',
        })),
      })

    if (sel.customers)
      sheets.push({
        name: 'العملاء',
        rows: getCrmCustomers().map((c) => ({
          الاسم: c.name ?? '',
          الجوال: c.phone,
          'الجوال الدولي': intlPhone(c.phone),
          'عدد الطلبات': c.orders_count,
          'إجمالي الإنفاق': c.total_spent,
          'آخر زيارة': fmtDate(c.last_seen),
          'مشترك بالتسويق': c.marketing_opt_in ? 'نعم' : 'لا',
        })),
      })

    const safeName = biz.name.replace(/[\\/:*?"<>|]/g, '').trim() || 'rizq'
    const fileTag = scope === 'all' ? 'الكل' : `${r.from}_${r.to}`
    exportWorkbook(`${safeName}-مبيعات-${fileTag}.xlsx`, sheets)

    // record the export in the database
    const chosen = SHEETS.filter((s) => sel[s.id]).map((s) => s.label)
    logExport({
      store_name: biz.name,
      scope: r.label,
      date_from: r.from,
      date_to: r.to,
      sheets: ['معلومات التقرير', ...chosen].join('، '),
      orders_count: data.totals.orders,
      total_sales: data.totals.sales,
      exported_by: user?.name ?? '',
    })

    notify(`تم تصدير تقرير «${biz.name}» (${data.totals.orders} طلب) وحُفظ في السجل`, 'success')
    onDone()
  }

  return (
    <Modal open onClose={onClose} title="تصدير تقرير المبيعات إلى Excel" wide>
      <div className="space-y-5">
        {/* scope */}
        <div>
          <p className="mb-2 text-sm font-medium">الفترة</p>
          <div className="flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                className={`rounded-xl border px-4 py-2 text-sm transition ${
                  scope === s.id
                    ? 'border-rizq-gold bg-rizq-gold/15 font-semibold text-rizq-gold'
                    : 'border-white/10 text-rizq-light/60 hover:bg-white/5'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {scope === 'custom' && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="من" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Field label="إلى" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          )}
        </div>

        {/* sheets */}
        <div>
          <p className="mb-2 text-sm font-medium">الأوراق المضمّنة</p>
          <p className="mb-2 text-xs text-rizq-light/40">ورقة «معلومات التقرير» (باسم المطعم والإجماليات) تُضاف دائمًا.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SHEETS.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition ${
                  sel[s.id]
                    ? 'border-rizq-gold/40 bg-rizq-gold/10 text-rizq-light'
                    : 'border-white/10 text-rizq-light/50 hover:bg-white/5'
                }`}
              >
                <span>{s.label}</span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                    sel[s.id] ? 'gold-gradient border-transparent text-rizq-black' : 'border-white/20'
                  }`}
                >
                  {sel[s.id] && <Icon name="check" size={13} />}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 border-t border-white/5 pt-4">
          <Button variant="gold" block icon="download" onClick={doExport}>
            تصدير وحفظ في السجل
          </Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Modal>
  )
}
