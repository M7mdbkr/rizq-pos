import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import {
  CartItem,
  DiscountCode,
  PaymentMethod,
  OrderType,
  ORDER_TYPE_LABELS,
  lineUnitPrice,
} from '../../types'
import { computeTotals, validateDiscount } from '../../utils/calc'
import { createOrder, findDiscount, getActivePaymentMethods } from '../../db/repo'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/ui'
import { sar } from '../../utils/format'
import { vatLabel } from '../../config/settings'
import { ReceiptModal, ReceiptData } from './ReceiptModal'
import { LineEditModal } from './LineEditModal'

const ORDER_TYPES: OrderType[] = ['dine_in', 'takeaway', 'delivery']

export function CartPanel({
  cart,
  updateLine,
  removeLine,
  clear,
  onComplete,
}: {
  cart: CartItem[]
  updateLine: (lineId: string, patch: Partial<CartItem>) => void
  removeLine: (lineId: string) => void
  clear: () => void
  onComplete: () => void
}) {
  const { user } = useApp()
  const { notify } = useToast()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [discountInput, setDiscountInput] = useState('')
  const [discount, setDiscount] = useState<DiscountCode | null>(null)
  const methods = getActivePaymentMethods()
  const [payment, setPayment] = useState<PaymentMethod>(methods[0]?.id ?? 'cash')
  const [orderType, setOrderType] = useState<OrderType>('dine_in')
  const [tableNo, setTableNo] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [editing, setEditing] = useState<CartItem | null>(null)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  const totals = computeTotals(cart, discount)

  function applyDiscount() {
    if (!discountInput.trim()) return
    const code = findDiscount(discountInput.trim())
    const res = validateDiscount(code ?? undefined)
    if (!res.ok) {
      notify(res.reason, 'error')
      setDiscount(null)
      return
    }
    setDiscount(res.code)
    notify('تم تطبيق كود الخصم', 'success')
  }

  function removeDiscount() {
    setDiscount(null)
    setDiscountInput('')
  }

  function resetForm() {
    setName('')
    setPhone('')
    removeDiscount()
    setPayment(methods[0]?.id ?? 'cash')
    setOrderType('dine_in')
    setTableNo('')
    setOrderNotes('')
  }

  function confirm() {
    if (cart.length === 0) return
    const order = createOrder({
      items: cart,
      discount,
      customerName: name,
      customerPhone: phone,
      paymentMethod: payment,
      staffId: user!.id,
      orderType,
      tableNo,
      notes: orderNotes,
    })
    setReceipt({
      id: order.id,
      created_at: order.created_at,
      customer_name: name,
      customer_phone: phone,
      order_type: orderType,
      table_no: tableNo,
      notes: orderNotes,
      payment_method: payment,
      subtotal: totals.subtotal,
      discount: totals.discountAmount,
      vat: totals.vat,
      total: totals.total,
      invoiceNo: order.invoice_no,
      lines: cart.map((i) => ({
        name: i.product.name_ar,
        quantity: i.quantity,
        unitPrice: lineUnitPrice(i),
        note: i.note,
      })),
    })
    notify('تم إتمام الطلب بنجاح', 'success')
    resetForm()
    onComplete()
  }

  return (
    <aside className="surface flex flex-col border-t lg:h-full lg:min-h-0 lg:border-r lg:border-t-0">
      {/* header */}
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon name="cart" size={20} className="text-rizq-gold" />
          سلة الطلب
        </h2>
        {cart.length > 0 && (
          <button
            onClick={clear}
            className="flex items-center gap-1 text-xs text-rizq-light/50 hover:text-rizq-danger"
          >
            <Icon name="trash" size={14} /> إفراغ
          </button>
        )}
      </div>

      {/* items */}
      <div className="px-3 py-3 lg:flex-1 lg:overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-rizq-light/30 lg:h-full lg:py-0">
            <Icon name="cart" size={44} />
            <p className="text-sm">السلة فارغة</p>
            <p className="text-xs">اختر صنفًا لإضافته</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((it) => (
              <div key={it.lineId} className="rounded-xl bg-black/20 p-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditing(it)}
                    className="flex-1 text-right transition hover:text-rizq-gold"
                  >
                    <p className="flex items-center gap-1.5 text-sm font-medium leading-tight">
                      {it.product.name_ar}
                      {it.custom && (
                        <span className="rounded bg-rizq-gold/15 px-1 text-[10px] text-rizq-gold">مخصص</span>
                      )}
                      <Icon name="edit" size={12} className="text-rizq-light/30" />
                    </p>
                    <p className="font-num text-xs text-rizq-light/50">{sar(lineUnitPrice(it))}</p>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <QtyBtn
                      icon="minus"
                      onClick={() => updateLine(it.lineId, { quantity: it.quantity - 1 })}
                    />
                    <span className="font-num w-6 text-center text-sm">{it.quantity}</span>
                    <QtyBtn
                      icon="plus"
                      onClick={() => updateLine(it.lineId, { quantity: it.quantity + 1 })}
                      disabled={!it.custom && it.quantity >= it.product.stock}
                    />
                  </div>
                  <span className="font-num w-16 text-left text-sm font-semibold text-rizq-gold">
                    {sar(lineUnitPrice(it) * it.quantity)}
                  </span>
                </div>
                {it.note && (
                  <p className="mt-1.5 flex items-center gap-1 rounded bg-black/30 px-2 py-1 text-xs text-rizq-light/60">
                    <Icon name="edit" size={11} /> {it.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* footer */}
      {cart.length > 0 && (
        <div className="space-y-3 border-t border-white/5 p-4">
          {/* order type */}
          <div className="flex gap-2">
            {ORDER_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={`flex-1 rounded-lg border py-2 text-xs transition ${
                  orderType === t
                    ? 'border-rizq-gold bg-rizq-gold/15 font-semibold text-rizq-gold'
                    : 'border-white/10 text-rizq-light/60 hover:bg-white/5'
                }`}
              >
                {ORDER_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* customer + table */}
          <div className="grid grid-cols-2 gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم العميل"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-rizq-gold/50"
            />
            {orderType === 'dine_in' ? (
              <input
                value={tableNo}
                onChange={(e) => setTableNo(e.target.value)}
                placeholder="رقم الطاولة"
                inputMode="numeric"
                className="font-num rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-rizq-gold/50"
              />
            ) : (
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="الجوال"
                inputMode="numeric"
                className="font-num rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-rizq-gold/50"
              />
            )}
          </div>
          {orderType === 'dine_in' && (
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="جوال العميل (اختياري)"
              inputMode="numeric"
              className="font-num w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-rizq-gold/50"
            />
          )}

          {/* order notes */}
          <input
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="ملاحظة على الطلب (اختياري)"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-rizq-gold/50"
          />

          {/* discount */}
          {discount ? (
            <div className="flex items-center justify-between rounded-lg bg-rizq-success/10 px-3 py-2 text-sm text-rizq-success">
              <span className="flex items-center gap-1.5">
                <Icon name="tag" size={15} /> {discount.code}
              </span>
              <button onClick={removeDiscount}>
                <Icon name="close" size={15} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="كود الخصم"
                className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm uppercase outline-none focus:border-rizq-gold/50"
              />
              <Button variant="outline" onClick={applyDiscount}>
                تطبيق
              </Button>
            </div>
          )}

          {/* payment methods */}
          <div className="grid grid-cols-3 gap-2">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => setPayment(m.id)}
                className={`rounded-lg border py-2 text-xs transition ${
                  payment === m.id
                    ? 'border-rizq-gold bg-rizq-gold/15 font-semibold text-rizq-gold'
                    : 'border-white/10 text-rizq-light/60 hover:bg-white/5'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          {/* totals */}
          <div className="space-y-1 border-t border-white/5 pt-3 text-sm">
            <Row label="المجموع" value={sar(totals.subtotal)} />
            {totals.discountAmount > 0 && (
              <Row label="الخصم" value={`- ${sar(totals.discountAmount)}`} tone="success" />
            )}
            <Row label={`ضريبة القيمة المضافة (${vatLabel()})`} value={sar(totals.vat)} muted />
            <div className="flex items-center justify-between pt-1 text-lg font-bold">
              <span>الإجمالي</span>
              <span className="font-num text-rizq-gold">{sar(totals.total)}</span>
            </div>
          </div>

          <Button variant="gold" block icon="check" onClick={confirm}>
            تأكيد الطلب — {sar(totals.total)}
          </Button>
        </div>
      )}

      {editing && (
        <LineEditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateLine(editing.lineId, patch)
            setEditing(null)
          }}
          onDelete={() => {
            removeLine(editing.lineId)
            setEditing(null)
          }}
        />
      )}

      {receipt && <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />}
    </aside>
  )
}

function QtyBtn({
  icon,
  onClick,
  disabled,
}: {
  icon: 'plus' | 'minus'
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-rizq-light/70 transition hover:bg-rizq-gold/20 hover:text-rizq-gold disabled:opacity-30"
    >
      <Icon name={icon} size={14} />
    </button>
  )
}

function Row({
  label,
  value,
  tone,
  muted,
}: {
  label: string
  value: string
  tone?: 'success'
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-rizq-light/50' : 'text-rizq-light/70'}>{label}</span>
      <span className={`font-num ${tone === 'success' ? 'text-rizq-success' : ''}`}>{value}</span>
    </div>
  )
}
