import { useState } from 'react'
import { CartItem, lineUnitPrice } from '../../types'
import { Modal, Field, Button } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { sar } from '../../utils/format'

const QUICK_NOTES = ['بدون بصل', 'حار', 'بدون مخلل', 'إضافة جبن', 'سريع']

export function LineEditModal({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: CartItem
  onClose: () => void
  onSave: (patch: Partial<CartItem>) => void
  onDelete: () => void
}) {
  const [qty, setQty] = useState(item.quantity)
  const [price, setPrice] = useState(String(lineUnitPrice(item)))
  const [note, setNote] = useState(item.note ?? '')

  const maxQty = item.custom ? Infinity : item.product.stock
  const lineTotal = (parseFloat(price) || 0) * qty

  function save() {
    const p = parseFloat(price)
    onSave({
      quantity: Math.max(1, qty),
      note: note.trim() || undefined,
      unitPrice: p > 0 ? +p.toFixed(2) : undefined,
    })
  }

  return (
    <Modal open onClose={onClose} title="تعديل الصنف">
      <div className="space-y-4">
        <div className="rounded-xl bg-black/20 p-3">
          <p className="font-medium">{item.product.name_ar}</p>
          {!item.custom && (
            <p className="text-xs text-rizq-light/50">
              المتوفر بالمخزون: <span className="font-num">{item.product.stock}</span>
            </p>
          )}
        </div>

        {/* quantity stepper */}
        <div>
          <span className="mb-1.5 block text-xs text-rizq-light/60">الكمية</span>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 hover:bg-rizq-gold/20 hover:text-rizq-gold"
            >
              <Icon name="minus" size={18} />
            </button>
            <input
              value={qty}
              onChange={(e) => {
                const v = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                setQty(Math.min(v, maxQty === Infinity ? v : maxQty))
              }}
              inputMode="numeric"
              className="font-num w-20 rounded-xl border border-white/10 bg-black/30 py-2 text-center text-xl outline-none focus:border-rizq-gold/50"
            />
            <button
              onClick={() => setQty((q) => (q + 1 > maxQty ? q : q + 1))}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 hover:bg-rizq-gold/20 hover:text-rizq-gold"
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
        </div>

        <Field
          label="سعر الوحدة (ر.س)"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        {/* note + quick chips */}
        <div>
          <Field label="ملاحظة للمطبخ" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: بدون بصل" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_NOTES.map((n) => (
              <button
                key={n}
                onClick={() => setNote((cur) => (cur ? `${cur}، ${n}` : n))}
                className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-rizq-light/60 transition hover:border-rizq-gold/40 hover:text-rizq-gold"
              >
                + {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 pt-3 text-sm">
          <span className="text-rizq-light/60">إجمالي السطر</span>
          <span className="font-num text-lg font-bold text-rizq-gold">{sar(lineTotal)}</span>
        </div>

        <div className="flex gap-2">
          <Button variant="gold" block icon="check" onClick={save}>
            حفظ
          </Button>
          <Button variant="danger" icon="trash" onClick={onDelete}>
            حذف
          </Button>
        </div>
      </div>
    </Modal>
  )
}
