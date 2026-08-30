import { useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { Modal, Field, Button } from '../../components/ui'

export function CustomItemModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (name: string, price: number) => void
}) {
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')

  function add() {
    const p = parseFloat(price)
    if (!name.trim()) return notify('أدخل اسم الصنف', 'error')
    if (!p || p <= 0) return notify('أدخل سعرًا صحيحًا', 'error')
    onAdd(name.trim(), +p.toFixed(2))
  }

  return (
    <Modal open onClose={onClose} title="إضافة صنف مخصص">
      <div className="space-y-4">
        <p className="text-xs text-rizq-light/50">
          صنف خارج القائمة لا يُحتسب من المخزون (مثل طلب خاص أو رسوم توصيل).
        </p>
        <Field label="اسم الصنف" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Field
          label="السعر (ر.س)"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
        />
        <div className="flex gap-2 pt-1">
          <Button variant="gold" block icon="plus" onClick={add}>
            إضافة للسلة
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  )
}
