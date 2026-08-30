import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { getDiscounts, addDiscount, deleteDiscount } from '../../db/repo'
import { DiscountType } from '../../types'
import { Card, Button, Field, Select, Modal, Pill } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { sar, fmtDate, parseTs } from '../../utils/format'

export function Discounts() {
  const { dataVersion, refresh } = useApp()
  const { notify } = useToast()
  const codes = useMemo(() => getDiscounts(), [dataVersion])
  const [creating, setCreating] = useState(false)

  function del(id: string, code: string) {
    if (!confirm(`حذف كود "${code}"؟`)) return
    deleteDiscount(id)
    notify('تم حذف الكود', 'success')
    refresh()
  }

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">أكواد الخصم</h1>
          <p className="text-sm text-rizq-light/50">{codes.length} كود</p>
        </div>
        <Button variant="gold" icon="plus" onClick={() => setCreating(true)}>كود جديد</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {codes.map((c) => {
          const expired = c.expires_at && parseTs(c.expires_at).getTime() < Date.now()
          const exhausted = c.max_uses != null && c.uses_count >= c.max_uses
          const active = !expired && !exhausted
          return (
            <Card key={c.id} className="overflow-hidden">
              <div className="flex items-start justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-num text-lg font-bold tracking-wider text-rizq-gold">{c.code}</span>
                    {active ? <Pill tone="success">فعّال</Pill> : <Pill tone="muted">{expired ? 'منتهٍ' : 'مستنفد'}</Pill>}
                  </div>
                  <p className="mt-1 text-sm text-rizq-light/60">
                    {c.discount_type === 'percentage' ? `خصم ${c.discount_value}%` : `خصم ${sar(c.discount_value)}`}
                  </p>
                </div>
                <button onClick={() => del(c.id, c.code)} className="text-rizq-light/40 hover:text-rizq-danger">
                  <Icon name="trash" size={16} />
                </button>
              </div>
              <div className="space-y-1.5 border-t border-white/5 bg-black/10 px-4 py-3 text-xs text-rizq-light/50">
                <div className="flex justify-between">
                  <span>الاستخدام</span>
                  <span className="font-num">{c.uses_count}{c.max_uses != null ? ` / ${c.max_uses}` : ' (غير محدود)'}</span>
                </div>
                <div className="flex justify-between">
                  <span>الصلاحية</span>
                  <span>{c.expires_at ? fmtDate(c.expires_at) : 'دائم'}</span>
                </div>
                {c.max_uses != null && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full gold-gradient" style={{ width: `${Math.min(100, (c.uses_count / c.max_uses) * 100)}%` }} />
                  </div>
                )}
              </div>
            </Card>
          )
        })}
        {codes.length === 0 && (
          <Card className="col-span-full p-10 text-center text-rizq-light/40">لا توجد أكواد بعد</Card>
        )}
      </div>

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { notify } = useToast()
  const [code, setCode] = useState('')
  const [type, setType] = useState<DiscountType>('percentage')
  const [value, setValue] = useState(10)
  const [maxUses, setMaxUses] = useState('')
  const [expires, setExpires] = useState('')

  function save() {
    if (!code.trim()) {
      notify('أدخل الكود', 'error')
      return
    }
    addDiscount({
      code: code.trim(),
      discount_type: type,
      discount_value: value,
      max_uses: maxUses ? +maxUses : null,
      expires_at: expires ? `${expires} 23:59:59` : null,
    })
    notify('تم إنشاء الكود', 'success')
    onCreated()
  }

  return (
    <Modal open onClose={onClose} title="كود خصم جديد">
      <div className="space-y-4">
        <Field
          label="الكود"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="مثال: RIZQ10"
          className="font-num uppercase tracking-wider"
        />
        <div className="grid grid-cols-2 gap-3">
          <Select label="نوع الخصم" value={type} onChange={(e) => setType(e.target.value as DiscountType)}>
            <option value="percentage">نسبة مئوية %</option>
            <option value="fixed">مبلغ ثابت ر.س</option>
          </Select>
          <Field
            label={type === 'percentage' ? 'النسبة %' : 'المبلغ ر.س'}
            type="number"
            value={value}
            onChange={(e) => setValue(+e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="حد الاستخدام (اختياري)" type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="غير محدود" />
          <Field label="تاريخ الانتهاء (اختياري)" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="gold" block icon="check" onClick={save}>إنشاء الكود</Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Modal>
  )
}
