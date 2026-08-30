import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import {
  getProducts,
  getCategories,
  addProduct,
  updateProduct,
  deleteProduct,
  restock,
  addCategory,
  deleteCategory,
} from '../../db/repo'
import { Product, Category } from '../../types'
import { Card, Button, Field, Select, Modal, Pill } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { sar, pct } from '../../utils/format'

const ICONS = ['utensils', 'flame', 'salad', 'cup', 'cake', 'box']
const COLORS = ['#D4AF37', '#EF4444', '#10B981', '#3B82F6', '#EC4899', '#F59E0B']

export function Inventory() {
  const { dataVersion, refresh } = useApp()
  const { notify } = useToast()
  const products = useMemo(() => getProducts(), [dataVersion])
  const categories = useMemo(() => getCategories(), [dataVersion])

  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [restocking, setRestocking] = useState<Product | null>(null)
  const [catModal, setCatModal] = useState(false)

  function catName(id: string) {
    return categories.find((c) => c.id === id)?.name_ar ?? '—'
  }

  function handleDelete(p: Product) {
    if (!confirm(`حذف "${p.name_ar}"؟`)) return
    deleteProduct(p.id)
    notify('تم حذف الصنف', 'success')
    refresh()
  }

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة المخزون</h1>
          <p className="text-sm text-rizq-light/50">{products.length} صنف • {categories.length} فئة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" icon="tag" onClick={() => setCatModal(true)}>
            الفئات
          </Button>
          <Button variant="gold" icon="plus" onClick={() => setCreating(true)}>
            صنف جديد
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/5 text-xs text-rizq-light/40">
              <tr>
                <th className="px-4 py-3 text-right font-normal">الصنف</th>
                <th className="px-4 py-3 text-right font-normal">الفئة</th>
                <th className="px-4 py-3 text-left font-normal">السعر</th>
                <th className="px-4 py-3 text-left font-normal">التكلفة</th>
                <th className="px-4 py-3 text-left font-normal">الهامش</th>
                <th className="px-4 py-3 text-center font-normal">المخزون</th>
                <th className="px-4 py-3 text-center font-normal">الحالة</th>
                <th className="px-4 py-3 text-center font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0
                const out = p.stock <= 0
                const low = !out && p.stock < p.min_stock
                return (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium">{p.name_ar}</td>
                    <td className="px-4 py-3 text-rizq-light/60">{catName(p.category_id)}</td>
                    <td className="px-4 py-3 text-left font-num text-rizq-gold">{sar(p.price)}</td>
                    <td className="px-4 py-3 text-left font-num text-rizq-light/60">{sar(p.cost)}</td>
                    <td className="px-4 py-3 text-left font-num">{pct(margin)}</td>
                    <td className="px-4 py-3 text-center font-num">
                      <span className={out ? 'text-rizq-danger' : low ? 'text-rizq-warning' : ''}>
                        {p.stock}
                      </span>
                      <span className="text-rizq-light/30"> / {p.min_stock}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.status === 'inactive' ? (
                        <Pill tone="muted">معطّل</Pill>
                      ) : out ? (
                        <Pill tone="danger">نفد</Pill>
                      ) : low ? (
                        <Pill tone="warning">منخفض</Pill>
                      ) : (
                        <Pill tone="success">متوفر</Pill>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <IconBtn icon="box" title="إعادة تخزين" onClick={() => setRestocking(p)} />
                        <IconBtn icon="edit" title="تعديل" onClick={() => setEditing(p)} />
                        <IconBtn icon="trash" title="حذف" danger onClick={() => handleDelete(p)} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {(creating || editing) && (
        <ProductModal
          product={editing}
          categories={categories}
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

      {restocking && (
        <RestockModal
          product={restocking}
          onClose={() => setRestocking(null)}
          onDone={() => {
            setRestocking(null)
            refresh()
          }}
        />
      )}

      {catModal && (
        <CategoryModal categories={categories} onClose={() => setCatModal(false)} onChange={refresh} />
      )}
    </div>
  )
}

function IconBtn({
  icon,
  title,
  onClick,
  danger,
}: {
  icon: 'box' | 'edit' | 'trash'
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-lg p-1.5 text-rizq-light/50 transition hover:bg-white/10 ${
        danger ? 'hover:text-rizq-danger' : 'hover:text-rizq-gold'
      }`}
    >
      <Icon name={icon} size={16} />
    </button>
  )
}

function ProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const { notify } = useToast()
  const [form, setForm] = useState({
    name_ar: product?.name_ar ?? '',
    category_id: product?.category_id ?? categories[0]?.id ?? '',
    price: product?.price ?? 0,
    cost: product?.cost ?? 0,
    stock: product?.stock ?? 0,
    min_stock: product?.min_stock ?? 10,
    status: product?.status ?? ('active' as const),
  })

  function save() {
    if (!form.name_ar.trim()) return notify('أدخل اسم الصنف', 'error')
    if (!form.category_id) return notify('اختر القسم', 'error')
    if (!(form.price > 0)) return notify('أدخل سعرًا صحيحًا أكبر من صفر', 'error')
    if (form.cost < 0 || form.cost > form.price)
      return notify('التكلفة يجب أن تكون بين صفر والسعر', 'error')
    if (form.stock < 0 || form.min_stock < 0)
      return notify('المخزون وحد التنبيه لا يقبلان قيمة سالبة', 'error')
    if (product) {
      updateProduct({ ...product, ...form })
      notify('تم تحديث الصنف', 'success')
    } else {
      addProduct(form)
      notify('تمت إضافة الصنف', 'success')
    }
    onSaved()
  }

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Modal open onClose={onClose} title={product ? 'تعديل الصنف' : 'صنف جديد'}>
      <div className="space-y-4">
        <Field label="الاسم" value={form.name_ar} onChange={(e) => set('name_ar', e.target.value)} />
        <Select label="الفئة" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name_ar}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Field label="السعر (ر.س)" type="number" value={form.price} onChange={(e) => set('price', +e.target.value)} />
          <Field label="التكلفة (ر.س)" type="number" value={form.cost} onChange={(e) => set('cost', +e.target.value)} />
          <Field label="المخزون" type="number" value={form.stock} onChange={(e) => set('stock', +e.target.value)} />
          <Field label="حد التنبيه" type="number" value={form.min_stock} onChange={(e) => set('min_stock', +e.target.value)} />
        </div>
        <Select label="الحالة" value={form.status} onChange={(e) => set('status', e.target.value)}>
          <option value="active">متاح</option>
          <option value="inactive">معطّل</option>
        </Select>
        <div className="flex gap-2 pt-2">
          <Button variant="gold" block icon="check" onClick={save}>حفظ</Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Modal>
  )
}

function RestockModal({
  product,
  onClose,
  onDone,
}: {
  product: Product
  onClose: () => void
  onDone: () => void
}) {
  const { notify } = useToast()
  const [amount, setAmount] = useState(20)
  function save() {
    if (amount <= 0) return
    restock(product.id, amount)
    notify(`تمت إضافة ${amount} إلى "${product.name_ar}"`, 'success')
    onDone()
  }
  return (
    <Modal open onClose={onClose} title="إعادة تخزين">
      <div className="space-y-4">
        <div className="rounded-xl bg-black/20 p-4 text-sm">
          <p className="font-medium">{product.name_ar}</p>
          <p className="text-rizq-light/50">المخزون الحالي: <span className="font-num">{product.stock}</span></p>
        </div>
        <Field label="الكمية المضافة" type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} />
        <p className="text-sm text-rizq-light/50">
          المخزون بعد الإضافة: <span className="font-num text-rizq-gold">{product.stock + amount}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="gold" block icon="plus" onClick={save}>إضافة للمخزون</Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Modal>
  )
}

function CategoryModal({
  categories,
  onClose,
  onChange,
}: {
  categories: Category[]
  onClose: () => void
  onChange: () => void
}) {
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICONS[0])
  const [color, setColor] = useState(COLORS[0])

  function add() {
    if (!name.trim()) return
    addCategory(name.trim(), icon, color)
    notify('تمت إضافة الفئة', 'success')
    setName('')
    onChange()
  }
  function del(id: string, n: string) {
    if (!confirm(`حذف فئة "${n}"؟`)) return
    deleteCategory(id)
    notify('تم حذف الفئة', 'success')
    onChange()
  }

  return (
    <Modal open onClose={onClose} title="إدارة الفئات">
      <div className="space-y-4">
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-2.5">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                {c.name_ar}
              </span>
              <button onClick={() => del(c.id, c.name_ar)} className="text-rizq-light/40 hover:text-rizq-danger">
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-white/5 pt-4">
          <Field label="فئة جديدة" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الفئة" />
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-rizq-charcoal' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                  icon === ic ? 'bg-rizq-gold/20 text-rizq-gold' : 'bg-white/5 text-rizq-light/50'
                }`}
              >
                <Icon name={ic as never} size={18} />
              </button>
            ))}
          </div>
          <Button variant="gold" block icon="plus" onClick={add}>إضافة الفئة</Button>
        </div>
      </div>
    </Modal>
  )
}
