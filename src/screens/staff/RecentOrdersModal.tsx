import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { getRecentOrders, getOrderItems, paymentLabel } from '../../db/repo'
import { Order, ORDER_TYPE_LABELS } from '../../types'
import { Modal, Button, Pill, Empty } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { sar, fmtTime, fmtDateShort } from '../../utils/format'
import { ReceiptModal, ReceiptData, receiptFromOrder } from './ReceiptModal'

export function RecentOrdersModal({ onClose }: { onClose: () => void }) {
  const { dataVersion } = useApp()
  const orders = useMemo(() => getRecentOrders(25), [dataVersion])
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  function reprint(order: Order) {
    const items = getOrderItems(order.id)
    setReceipt(receiptFromOrder(order, items))
  }

  return (
    <>
      <Modal open onClose={onClose} title="الطلبات الأخيرة" wide>
        {orders.length === 0 ? (
          <Empty icon="print" text="لا توجد طلبات بعد" />
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {orders.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-3 rounded-xl bg-black/20 px-4 py-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rizq-gold/15 text-rizq-gold">
                  <Icon name="ledger" size={18} />
                </div>
                <div className="flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    #{o.id.slice(-6).toUpperCase()}
                    <Pill tone="muted">{ORDER_TYPE_LABELS[o.order_type ?? 'dine_in']}</Pill>
                    {o.table_no && <span className="text-xs text-rizq-light/40">طاولة {o.table_no}</span>}
                  </p>
                  <p className="text-xs text-rizq-light/40">
                    {o.customer_name || 'بدون اسم'} • {fmtDateShort(o.created_at)} {fmtTime(o.created_at)} •{' '}
                    {paymentLabel(o.payment_method)}
                  </p>
                </div>
                <span className="font-num text-sm font-semibold text-rizq-gold">{sar(o.final_total)}</span>
                <Button variant="outline" icon="print" onClick={() => reprint(o)}>
                  طباعة
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {receipt && <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />}
    </>
  )
}
