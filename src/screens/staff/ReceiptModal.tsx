import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  Order,
  OrderItem,
  PaymentMethod,
  OrderType,
  ORDER_TYPE_LABELS,
} from '../../types'
import { Button } from '../../components/ui'
import { sar, fmtDateTime, parseTs } from '../../utils/format'
import { getSettings, vatLabel, BusinessSettings } from '../../config/settings'
import { paymentLabel } from '../../db/repo'
import { zatcaQrPayload } from '../../utils/zatca'

export interface ReceiptLine {
  name: string
  quantity: number
  unitPrice: number
  note?: string | null
}

export interface ReceiptData {
  id: string
  created_at: string
  customer_name?: string | null
  customer_phone?: string | null
  order_type: OrderType
  table_no?: string | null
  notes?: string | null
  payment_method: PaymentMethod
  subtotal: number
  discount: number
  vat: number
  total: number
  lines: ReceiptLine[]
  /** sequential invoice number (ZATCA-friendly) */
  invoiceNo?: number | null
}

/** Build receipt data from a stored order + its item rows (for reprint). */
export function receiptFromOrder(
  order: Order,
  items: (OrderItem & { name_ar: string })[],
): ReceiptData {
  return {
    id: order.id,
    created_at: order.created_at,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    order_type: order.order_type ?? 'dine_in',
    table_no: order.table_no,
    notes: order.notes,
    payment_method: order.payment_method,
    subtotal: order.total,
    discount: order.discount_amount,
    vat: order.vat_amount,
    total: order.final_total,
    invoiceNo: order.invoice_no,
    lines: items.map((i) => ({
      name: i.name_ar,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      note: i.note,
    })),
  }
}

/** ZATCA Phase-1 QR — rendered only when a VAT number is configured. */
function ZatcaQr({ data, biz }: { data: ReceiptData; biz: BusinessSettings }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!biz.vatNumber) return
    let iso: string
    try {
      iso = parseTs(data.created_at).toISOString()
    } catch {
      iso = new Date().toISOString()
    }
    const payload = zatcaQrPayload({
      sellerName: biz.name || biz.brand,
      vatNumber: biz.vatNumber,
      timestamp: iso,
      total: data.total,
      vat: data.vat,
    })
    QRCode.toDataURL(payload, { margin: 0, width: 220 })
      .then(setSrc)
      .catch(() => setSrc(''))
  }, [data, biz])
  if (!biz.vatNumber || !src) return null
  return (
    <div className="mt-3 flex justify-center border-t border-dashed border-gray-300 pt-3">
      <img src={src} alt="ZATCA QR" style={{ width: 110, height: 110 }} />
    </div>
  )
}

function paperCss(biz: BusinessSettings): { width: string; page: string } {
  if (biz.paperWidth === '58') return { width: '58mm', page: '58mm auto' }
  if (biz.paperWidth === '80') return { width: '80mm', page: '80mm auto' }
  return { width: '320px', page: 'auto' }
}

export function ReceiptModal({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const biz = getSettings()
  const [target, setTarget] = useState<'customer' | 'kitchen'>('customer')
  const { width, page } = paperCss(biz)
  const copies = Math.max(1, Math.min(5, biz.receiptCopies || 1))

  function print(which: 'customer' | 'kitchen') {
    setTarget(which)
    // allow the DOM to reflect the target content before printing
    setTimeout(() => window.print(), 40)
  }

  // auto-print on open if enabled
  useEffect(() => {
    if (!biz.autoPrint) return
    const t = setTimeout(() => print('customer'), 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-sm flex-col">
        {/* on-screen preview (not printed) */}
        <div className="no-print mb-3 overflow-y-auto rounded-2xl">
          {target === 'kitchen' ? (
            <KitchenDoc data={data} width={width} />
          ) : (
            <CustomerDoc data={data} biz={biz} width={width} />
          )}
        </div>

        {/* print-only area: N copies for customer, single kitchen ticket */}
        <div id="rizq-print-area" className="print-only">
          {target === 'customer'
            ? Array.from({ length: copies }).map((_, i) => (
                <CustomerDoc key={i} data={data} biz={biz} width={width} forPrint />
              ))
            : <KitchenDoc data={data} width={width} forPrint />}
        </div>

        {/* actions */}
        <div className="no-print grid grid-cols-2 gap-2">
          <Button variant="gold" icon="print" onClick={() => print('customer')}>
            فاتورة العميل{copies > 1 ? ` (${copies})` : ''}
          </Button>
          <Button variant="ghost" icon="print" onClick={() => print('kitchen')}>
            تذكرة المطبخ
          </Button>
          <Button variant="ghost" block className="col-span-2" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>

      <style>{`
        .print-only { position: absolute; left: -9999px; top: 0; }
        @media print {
          @page { size: ${page}; margin: 0; }
          body * { visibility: hidden !important; }
          .no-print { display: none !important; }
          #rizq-print-area, #rizq-print-area * { visibility: visible !important; }
          #rizq-print-area { position: static !important; left: 0 !important; }
          .receipt-doc {
            box-shadow: none !important; border-radius: 0 !important;
            page-break-after: always; margin: 0 auto !important;
          }
          .receipt-doc:last-child { page-break-after: auto; }
        }
      `}</style>
    </div>
  )
}

function CustomerDoc({
  data,
  biz,
  width,
  forPrint,
}: {
  data: ReceiptData
  biz: BusinessSettings
  width: string
  forPrint?: boolean
}) {
  return (
    <div
      className={`receipt-doc mx-auto bg-white p-6 text-rizq-charcoal ${forPrint ? '' : 'rounded-2xl'}`}
      style={{ fontFamily: 'Tajawal', width, maxWidth: '100%' }}
    >
      {biz.logo ? (
        <img src={biz.logo} alt="شعار" className="mx-auto mb-2 max-h-16 object-contain" />
      ) : (
        <div
          className="mb-1 text-center text-3xl font-bold"
          style={{ fontFamily: 'Reem Kufi', color: '#B8941F' }}
        >
          {biz.brand}
        </div>
      )}
      <p className="text-center text-sm font-semibold text-gray-700">{biz.name}</p>
      {(biz.phone || biz.address) && (
        <p className="text-center text-[10px] text-gray-400">
          {[biz.phone, biz.address].filter(Boolean).join(' • ')}
        </p>
      )}
      <p className="mb-3 mt-1 text-center text-xs text-gray-500">
        فاتورة ضريبية مبسطة
        {biz.vatNumber && <span className="block">الرقم الضريبي: {biz.vatNumber}</span>}
      </p>
      <Meta data={data} />

      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-300 text-gray-500">
            <th className="py-1 text-right font-normal">الصنف</th>
            <th className="py-1 text-center font-normal">الكمية</th>
            <th className="py-1 text-left font-normal">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((it, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-1.5 text-right">
                {it.name}
                {it.note && <span className="block text-[10px] text-gray-400">↳ {it.note}</span>}
              </td>
              <td className="py-1.5 text-center font-num">{it.quantity}</td>
              <td className="py-1.5 text-left font-num">{sar(it.unitPrice * it.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 border-t border-dashed border-gray-300 pt-2 text-xs">
        <Line label="المجموع" value={sar(data.subtotal)} />
        {data.discount > 0 && <Line label="الخصم" value={`- ${sar(data.discount)}`} />}
        <Line label={`ضريبة القيمة المضافة (${vatLabel()})`} value={sar(data.vat)} />
        <div className="flex justify-between pt-1 text-base font-bold">
          <span>الإجمالي</span>
          <span className="font-num">{sar(data.total)}</span>
        </div>
        <Line label="طريقة الدفع" value={paymentLabel(data.payment_method)} />
      </div>

      {data.notes && (
        <p className="mt-2 rounded bg-gray-50 p-2 text-[11px] text-gray-600">ملاحظة: {data.notes}</p>
      )}
      <ZatcaQr data={data} biz={biz} />
      <p className="mt-4 text-center text-xs text-gray-500">{biz.receiptFooter}</p>
    </div>
  )
}

function KitchenDoc({
  data,
  width,
  forPrint,
}: {
  data: ReceiptData
  width: string
  forPrint?: boolean
}) {
  return (
    <div
      className={`receipt-doc mx-auto bg-white p-6 text-rizq-charcoal ${forPrint ? '' : 'rounded-2xl border-2 border-dashed border-gray-300'}`}
      style={{ fontFamily: 'Tajawal', width, maxWidth: '100%' }}
    >
      <div className="mb-2 text-center text-xl font-bold">🍽️ تذكرة المطبخ</div>
      <div className="mb-3 flex items-center justify-center gap-2 border-y border-dashed border-gray-300 py-2 text-center text-sm font-bold">
        <span>{ORDER_TYPE_LABELS[data.order_type]}</span>
        {data.table_no && <span>• طاولة {data.table_no}</span>}
      </div>
      <p className="mb-2 text-center text-xs text-gray-500">
        رقم {data.id.slice(-6).toUpperCase()} • {fmtDateTime(data.created_at)}
      </p>
      <ul className="space-y-2">
        {data.lines.map((it, i) => (
          <li key={i} className="flex items-start justify-between border-b border-gray-100 pb-1.5 text-sm">
            <span>
              {it.name}
              {it.note && <span className="block text-xs text-gray-500">↳ {it.note}</span>}
            </span>
            <span className="font-num font-bold">×{it.quantity}</span>
          </li>
        ))}
      </ul>
      {data.notes && <p className="mt-3 rounded bg-gray-50 p-2 text-xs font-medium">📝 {data.notes}</p>}
    </div>
  )
}

function Meta({ data }: { data: ReceiptData }) {
  return (
    <div className="mb-3 border-y border-dashed border-gray-300 py-2 text-center text-xs text-gray-600">
      {data.invoiceNo != null && (
        <p>
          رقم الفاتورة: <span className="font-num">{data.invoiceNo}</span>
        </p>
      )}
      <p>رقم الطلب: {data.id.slice(-8).toUpperCase()}</p>
      <p>{fmtDateTime(data.created_at)}</p>
      <p>
        {ORDER_TYPE_LABELS[data.order_type]}
        {data.table_no ? ` • طاولة ${data.table_no}` : ''}
      </p>
      {data.customer_name && <p>العميل: {data.customer_name}</p>}
      {data.customer_phone && <p className="font-num" dir="ltr">{data.customer_phone}</p>}
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{label}</span>
      <span className="font-num">{value}</span>
    </div>
  )
}
