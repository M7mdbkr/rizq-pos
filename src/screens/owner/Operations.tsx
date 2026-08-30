import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import {
  getActiveProducts,
  addConsumption,
  getConsumption,
  deleteConsumption,
  getConsumptionStats,
} from '../../db/repo'
import { ConsumptionType, CONSUMPTION_LABELS } from '../../types'
import { Card, Button, Field, Select, Pill, Empty } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { sar, fmtDateTime } from '../../utils/format'

const TYPES: ConsumptionType[] = ['waste', 'staff_meal']
const CUSTOM = '__custom__'

export function Operations() {
  const { dataVersion, refresh, user } = useApp()
  const { notify } = useToast()
  const products = useMemo(() => getActiveProducts(), [dataVersion])
  const history = useMemo(() => getConsumption(100), [dataVersion])
  const stats = useMemo(() => getConsumptionStats('month'), [dataVersion])

  const [type, setType] = useState<ConsumptionType>('waste')
  const [productId, setProductId] = useState<string>(CUSTOM)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [unitCost, setUnitCost] = useState('')

  function onPickProduct(id: string) {
    setProductId(id)
    if (id !== CUSTOM) {
      const p = products.find((x) => x.id === id)
      if (p) {
        setName(p.name_ar)
        setUnitCost(String(p.cost))
      }
    } else {
      setName('')
      setUnitCost('')
    }
  }

  function submit() {
    const q = parseInt(qty, 10) || 0
    const uc = parseFloat(unitCost) || 0
    const isCustom = productId === CUSTOM
    if (isCustom && !name.trim()) return notify('أدخل اسم الصنف', 'error')
    if (q <= 0) return notify('أدخل كمية صحيحة', 'error')
    addConsumption({
      type,
      productId: isCustom ? null : productId,
      name: name.trim(),
      quantity: q,
      unitCost: uc,
      notes: '',
      staffId: user?.id ?? '',
    })
    notify(type === 'waste' ? 'تم تسجيل الهدر' : 'تم تسجيل وجبة الموظف', 'success')
    setQty('1')
    if (isCustom) {
      setName('')
      setUnitCost('')
    }
    refresh()
  }

  function remove(id: string) {
    if (!confirm('حذف هذا السجل؟ (لا يعيد المخزون)')) return
    deleteConsumption(id)
    notify('تم الحذف', 'success')
    refresh()
  }

  const lineTotal = (parseFloat(unitCost) || 0) * (parseInt(qty, 10) || 0)

  return (
    <div className="space-y-5 p-5">
      <div>
        <h1 className="text-2xl font-bold">العمليات: الهدر ووجبات العمال</h1>
        <p className="text-sm text-rizq-light/50">تسجيل المهدر والتالف والوجبات — يُخصم من المخزون ويُحتسب كتكلفة</p>
      </div>

      {/* KPIs (this month) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="تكلفة الهدر (هذا الشهر)" value={sar(stats.wasteCost)} icon="trash" tone="danger" />
        <Kpi label="عدد عمليات الهدر" value={String(stats.wasteCount)} icon="alert" tone="warning" />
        <Kpi label="تكلفة وجبات العمال" value={sar(stats.staffMealCost)} icon="utensils" tone="gold" />
        <Kpi label="عدد الوجبات" value={String(stats.staffMealCount)} icon="user" tone="muted" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
        {/* add form */}
        <Card title="تسجيل عملية">
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-xl border py-2.5 text-sm transition ${
                    type === t
                      ? 'border-rizq-gold bg-rizq-gold/15 font-semibold text-rizq-gold'
                      : 'border-white/10 text-rizq-light/60 hover:bg-white/5'
                  }`}
                >
                  {CONSUMPTION_LABELS[t]}
                </button>
              ))}
            </div>

            <Select label="الصنف" value={productId} onChange={(e) => onPickProduct(e.target.value)}>
              <option value={CUSTOM}>صنف مخصص (يدوي)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_ar} (متوفر {p.stock})
                </option>
              ))}
            </Select>

            {productId === CUSTOM && (
              <Field label="اسم الصنف" value={name} onChange={(e) => setName(e.target.value)} />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="الكمية" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
              <Field label="تكلفة الوحدة" type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-2.5 text-sm">
              <span className="text-rizq-light/60">إجمالي التكلفة</span>
              <span className="font-num font-bold text-rizq-gold">{sar(lineTotal)}</span>
            </div>

            <Button variant="gold" block icon="check" onClick={submit}>
              تسجيل {CONSUMPTION_LABELS[type]}
            </Button>
            {productId !== CUSTOM && (
              <p className="text-xs text-rizq-light/40">سيتم خصم الكمية من مخزون الصنف.</p>
            )}
          </div>
        </Card>

        {/* history */}
        <Card title="آخر العمليات" action={<Pill tone="muted">{history.length}</Pill>}>
          {history.length === 0 ? (
            <Empty icon="ledger" text="لا توجد عمليات بعد" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/5 text-xs text-rizq-light/40">
                  <tr>
                    <th className="px-4 py-3 text-right font-normal">النوع</th>
                    <th className="px-4 py-3 text-right font-normal">الصنف</th>
                    <th className="px-4 py-3 text-center font-normal">الكمية</th>
                    <th className="px-4 py-3 text-left font-normal">التكلفة</th>
                    <th className="px-4 py-3 text-right font-normal">التاريخ</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((c) => (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <Pill tone={c.type === 'waste' ? 'danger' : 'gold'}>
                          {CONSUMPTION_LABELS[c.type]}
                        </Pill>
                      </td>
                      <td className="px-4 py-3">{c.name}</td>
                      <td className="px-4 py-3 text-center font-num">{c.quantity}</td>
                      <td className="px-4 py-3 text-left font-num text-rizq-gold">{sar(c.total_cost)}</td>
                      <td className="px-4 py-3 text-xs text-rizq-light/50">{fmtDateTime(c.created_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => remove(c.id)}
                          className="rounded-lg p-1.5 text-rizq-light/50 hover:bg-white/10 hover:text-rizq-danger"
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: string
  icon: 'trash' | 'alert' | 'utensils' | 'user'
  tone: 'danger' | 'warning' | 'gold' | 'muted'
}) {
  const tones = {
    danger: 'text-rizq-danger bg-rizq-danger/15',
    warning: 'text-rizq-warning bg-rizq-warning/15',
    gold: 'text-rizq-gold bg-rizq-gold/15',
    muted: 'text-rizq-light/70 bg-white/8',
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-rizq-light/50">{label}</p>
          <p className="font-num mt-1 text-xl font-bold">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon name={icon} size={20} />
        </div>
      </div>
    </Card>
  )
}
