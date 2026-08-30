import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { query } from '../../db/database'
import { getRecentExports, verifyInvoiceChain } from '../../db/repo'
import { Card, Button, Pill, Empty } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { sar, pct, fmtDate, fmtDateTime } from '../../utils/format'
import { vatLabel } from '../../config/settings'
import { ExportModal } from './ExportModal'

interface LedgerRow {
  date: string
  sales: number
  net: number
  vat: number
  discount: number
  cost: number
  orders: number
}

function getLedger(): LedgerRow[] {
  return query<LedgerRow>(
    `SELECT date(o.created_at) AS date,
            SUM(o.final_total) AS sales,
            SUM(o.total - o.discount_amount) AS net,
            SUM(o.vat_amount) AS vat,
            SUM(o.discount_amount) AS discount,
            (SELECT COALESCE(SUM(oi.quantity*p.cost),0) FROM order_items oi
              JOIN orders o2 ON o2.id=oi.order_id JOIN products p ON p.id=oi.product_id
              WHERE date(o2.created_at)=date(o.created_at) AND o2.status='completed') AS cost,
            COUNT(*) AS orders
     FROM orders o WHERE o.status='completed'
     GROUP BY date(o.created_at) ORDER BY date(o.created_at) DESC`,
  )
}

export function Reports() {
  const { dataVersion, refresh } = useApp()
  const { notify } = useToast()
  const ledger = useMemo(() => getLedger(), [dataVersion])
  const exports = useMemo(() => getRecentExports(), [dataVersion])
  const [exportOpen, setExportOpen] = useState(false)

  function checkIntegrity() {
    const r = verifyInvoiceChain()
    if (r.ok) notify(`سلامة السجلات مؤكدة ✓ — ${r.checked} فاتورة مترابطة بدون تلاعب`, 'success')
    else notify(`⚠️ كُشف تلاعب في السجلات عند الفاتورة رقم ${r.firstBad}`, 'error')
  }

  const totals = ledger.reduce(
    (a, r) => ({
      sales: a.sales + r.sales,
      net: a.net + r.net,
      vat: a.vat + r.vat,
      discount: a.discount + r.discount,
      cost: a.cost + r.cost,
      orders: a.orders + r.orders,
    }),
    { sales: 0, net: 0, vat: 0, discount: 0, cost: 0, orders: 0 },
  )
  const grossProfit = totals.net - totals.cost
  const margin = totals.net > 0 ? (grossProfit / totals.net) * 100 : 0

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المحاسبة والتقارير</h1>
          <p className="text-sm text-rizq-light/50">دفتر اليومية وتصدير المبيعات</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" icon="check" onClick={checkIntegrity}>
            فحص سلامة الفواتير
          </Button>
          <Button variant="gold" icon="download" onClick={() => setExportOpen(true)}>
            تصدير تقرير Excel
          </Button>
        </div>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="إجمالي المبيعات" value={sar(totals.sales)} />
        <SummaryCard label="ضريبة القيمة المضافة" value={sar(totals.vat)} sub={vatLabel()} />
        <SummaryCard label="إجمالي التكلفة" value={sar(totals.cost)} />
        <SummaryCard label="الربح الإجمالي" value={sar(grossProfit)} gold sub={`هامش ${pct(margin)}`} />
      </div>

      {/* profit formula */}
      <Card className="p-4">
        <p className="text-sm text-rizq-light/60">
          <span className="text-rizq-gold">معادلة الربح:</span> الربح الإجمالي = (المبيعات الصافية{' '}
          <span className="font-num">{sar(totals.net)}</span>) − (التكلفة{' '}
          <span className="font-num">{sar(totals.cost)}</span>) ={' '}
          <span className="font-num font-bold text-rizq-gold">{sar(grossProfit)}</span>
        </p>
      </Card>

      {/* ledger table */}
      <Card title="دفتر اليومية">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/5 text-xs text-rizq-light/40">
              <tr>
                <th className="px-4 py-3 text-right font-normal">التاريخ</th>
                <th className="px-4 py-3 text-center font-normal">الطلبات</th>
                <th className="px-4 py-3 text-left font-normal">المبيعات</th>
                <th className="px-4 py-3 text-left font-normal">الخصومات</th>
                <th className="px-4 py-3 text-left font-normal">الضريبة</th>
                <th className="px-4 py-3 text-left font-normal">التكلفة</th>
                <th className="px-4 py-3 text-left font-normal">الربح</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((r) => {
                const profit = r.net - r.cost
                return (
                  <tr key={r.date} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">{fmtDate(r.date + ' 00:00:00')}</td>
                    <td className="px-4 py-3 text-center font-num">{r.orders}</td>
                    <td className="px-4 py-3 text-left font-num text-rizq-gold">{sar(r.sales)}</td>
                    <td className="px-4 py-3 text-left font-num text-rizq-light/60">{sar(r.discount)}</td>
                    <td className="px-4 py-3 text-left font-num text-rizq-light/60">{sar(r.vat)}</td>
                    <td className="px-4 py-3 text-left font-num text-rizq-light/60">{sar(r.cost)}</td>
                    <td className="px-4 py-3 text-left font-num font-semibold text-rizq-success">{sar(profit)}</td>
                  </tr>
                )
              })}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-rizq-light/40">لا توجد بيانات</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* export history (recorded in the database) */}
      <Card title="سجلّ التصديرات" action={<Pill tone="muted">{exports.length}</Pill>}>
        {exports.length === 0 ? (
          <Empty icon="download" text="لم يتم تصدير أي تقرير بعد" />
        ) : (
          <div className="divide-y divide-white/5">
            {exports.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rizq-gold/15 text-rizq-gold">
                  <Icon name="ledger" size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{e.store_name} • {e.scope}</p>
                  <p className="text-xs text-rizq-light/40">
                    {fmtDateTime(e.created_at)} • {e.exported_by || '—'} • {e.sheets}
                  </p>
                </div>
                <div className="text-left">
                  <p className="font-num text-sm font-semibold text-rizq-gold">{sar(e.total_sales)}</p>
                  <p className="font-num text-xs text-rizq-light/40">{e.orders_count} طلب</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {exportOpen && (
        <ExportModal
          onClose={() => setExportOpen(false)}
          onDone={() => {
            setExportOpen(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  gold,
}: {
  label: string
  value: string
  sub?: string
  gold?: boolean
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-rizq-light/50">{label}</p>
      <p className={`font-num mt-1 text-xl font-bold ${gold ? 'text-rizq-gold' : ''}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-rizq-light/40">{sub}</p>}
    </Card>
  )
}
