import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import {
  getComplianceDocs,
  addComplianceDoc,
  updateComplianceDoc,
  deleteComplianceDoc,
  ComplianceRow,
} from '../../db/repo'
import { ComplianceKind, COMPLIANCE_KIND_LABELS } from '../../types'
import { Card, Button, Field, Select, Modal, Pill } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { fmtDate, todayIso } from '../../utils/format'

const KINDS = Object.keys(COMPLIANCE_KIND_LABELS) as ComplianceKind[]

function statusOf(d: ComplianceRow): { tone: 'danger' | 'warning' | 'success'; label: string } {
  if (d.days_left < 0) return { tone: 'danger', label: `منتهية منذ ${Math.abs(d.days_left)} يوم` }
  if (d.days_left <= (d.reminder_days ?? 30))
    return { tone: 'warning', label: `تنتهي خلال ${d.days_left} يوم` }
  return { tone: 'success', label: `سارية (${d.days_left} يوم)` }
}

export function Compliance() {
  const { dataVersion, refresh } = useApp()
  const { notify } = useToast()
  const docs = useMemo(() => getComplianceDocs(), [dataVersion])
  const [editing, setEditing] = useState<ComplianceRow | null>(null)
  const [creating, setCreating] = useState(false)

  const expired = docs.filter((d) => d.days_left < 0).length
  const soon = docs.filter((d) => d.days_left >= 0 && d.days_left <= (d.reminder_days ?? 30)).length
  const okCount = docs.length - expired - soon

  function remove(d: ComplianceRow) {
    if (!confirm(`حذف «${d.title}»؟`)) return
    deleteComplianceDoc(d.id)
    notify('تم الحذف', 'success')
    refresh()
  }

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الالتزامات والتصاريح</h1>
          <p className="text-sm text-rizq-light/50">
            كل وثائقك الرسمية وتواريخ انتهائها في مكان واحد — مع تنبيه قبل الانتهاء
          </p>
        </div>
        <Button variant="gold" icon="plus" onClick={() => setCreating(true)}>
          إضافة وثيقة
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="سارية" value={okCount} tone="success" icon="check" />
        <Kpi label="قريبة الانتهاء" value={soon} tone="warning" icon="alert" />
        <Kpi label="منتهية" value={expired} tone="danger" icon="close" />
      </div>

      <Card title="الوثائق" action={<Pill tone="muted">{docs.length}</Pill>}>
        {docs.length === 0 ? (
          <div className="p-8 text-center text-sm text-rizq-light/40">
            <p className="mb-2">لا توجد وثائق بعد.</p>
            <p>
              أمثلة لما يمكن تتبعه: السجل التجاري / وثيقة العمل الحر، الرخصة البلدية، شهادة الزكاة،
              اشتراك مدد، بطاقات عمل الموظفين وإقاماتهم، التأمينات، رخصة الدفاع المدني، أي تصريح.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/5 text-xs text-rizq-light/40">
                <tr>
                  <th className="px-4 py-3 text-right font-normal">الوثيقة</th>
                  <th className="px-4 py-3 text-right font-normal">النوع</th>
                  <th className="px-4 py-3 text-right font-normal">صاحبها</th>
                  <th className="px-4 py-3 text-right font-normal">تاريخ الانتهاء</th>
                  <th className="px-4 py-3 text-right font-normal">الحالة</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const s = statusOf(d)
                  return (
                    <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-medium">{d.title}</p>
                        {d.ref_no && (
                          <p className="font-num text-xs text-rizq-light/40" dir="ltr">
                            {d.ref_no}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-rizq-light/60">
                        {COMPLIANCE_KIND_LABELS[d.kind] ?? d.kind}
                      </td>
                      <td className="px-4 py-3 text-rizq-light/60">{d.holder || '—'}</td>
                      <td className="px-4 py-3">{fmtDate(d.expiry_date + ' 00:00:00')}</td>
                      <td className="px-4 py-3">
                        <Pill tone={s.tone}>{s.label}</Pill>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditing(d)}
                            className="rounded-lg p-1.5 text-rizq-light/50 hover:bg-white/10 hover:text-rizq-gold"
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            onClick={() => remove(d)}
                            className="rounded-lg p-1.5 text-rizq-light/50 hover:bg-white/10 hover:text-rizq-danger"
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <DocModal
          doc={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: number
  tone: 'success' | 'warning' | 'danger'
  icon: 'check' | 'alert' | 'close'
}) {
  const tones = {
    success: 'text-rizq-success bg-rizq-success/15',
    warning: 'text-rizq-warning bg-rizq-warning/15',
    danger: 'text-rizq-danger bg-rizq-danger/15',
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-rizq-light/50">{label}</p>
          <p className="font-num mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon name={icon} size={20} />
        </div>
      </div>
    </Card>
  )
}

function DocModal({
  doc,
  onClose,
  onSaved,
}: {
  doc: ComplianceRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const { notify } = useToast()
  const [title, setTitle] = useState(doc?.title ?? '')
  const [kind, setKind] = useState<ComplianceKind>(doc?.kind ?? 'commercial_reg')
  const [refNo, setRefNo] = useState(doc?.ref_no ?? '')
  const [holder, setHolder] = useState(doc?.holder ?? '')
  const [expiry, setExpiry] = useState(doc?.expiry_date ?? todayIso())
  const [reminder, setReminder] = useState(String(doc?.reminder_days ?? 30))
  const [notes, setNotes] = useState(doc?.notes ?? '')

  function save() {
    if (!title.trim()) return notify('أدخل اسم الوثيقة', 'error')
    if (!expiry) return notify('أدخل تاريخ الانتهاء', 'error')
    const payload = {
      title: title.trim(),
      kind,
      refNo: refNo.trim(),
      holder: holder.trim(),
      expiryDate: expiry,
      reminderDays: Math.max(1, parseInt(reminder, 10) || 30),
      notes: notes.trim(),
    }
    if (doc) {
      updateComplianceDoc(doc.id, payload)
      notify('تم التحديث', 'success')
    } else {
      addComplianceDoc(payload)
      notify('تمت الإضافة', 'success')
    }
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={doc ? 'تعديل وثيقة' : 'إضافة وثيقة'}>
      <div className="space-y-4">
        <Field label="اسم الوثيقة" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: رخصة البلدية — فرع العليا" />
        <Select label="النوع" value={kind} onChange={(e) => setKind(e.target.value as ComplianceKind)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {COMPLIANCE_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Field label="رقم الوثيقة (اختياري)" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
          <Field label="صاحبها (لبطاقات العمل)" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="اسم الموظف" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تاريخ الانتهاء" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          <Field label="نبّهني قبل (أيام)" type="number" value={reminder} onChange={(e) => setReminder(e.target.value)} />
        </div>
        <Field label="ملاحظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex gap-2 pt-1">
          <Button variant="gold" block icon="check" onClick={save}>
            حفظ
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  )
}
