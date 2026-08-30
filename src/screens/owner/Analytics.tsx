import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'
import { useApp } from '../../context/AppContext'
import {
  getDailySummaries,
  getTopProducts,
  getCustomers,
} from '../../db/repo'
import { query } from '../../db/database'
import { Card, Pill } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { sar, pct, fmtDateShort, weekdayAr } from '../../utils/format'

export function Analytics() {
  const { dataVersion } = useApp()
  const daily = useMemo(() => getDailySummaries(14), [dataVersion])
  const top = useMemo(() => getTopProducts(8), [dataVersion])
  const customers = useMemo(() => getCustomers(), [dataVersion])
  const insights = useMemo(() => buildInsights(), [dataVersion])

  const chartData = daily.map((d) => ({
    label: fmtDateShort(d.date + ' 00:00:00'),
    sales: d.sales,
  }))

  const totalRevenue = top.reduce((s, p) => s + p.revenue, 0)
  const totalProfit = top.reduce((s, p) => s + p.profit, 0)
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  return (
    <div className="space-y-5 p-5">
      <div>
        <h1 className="text-2xl font-bold">التحليلات</h1>
        <p className="text-sm text-rizq-light/50">رؤى الأداء والأرباح</p>
      </div>

      {/* AI insights */}
      <Card title={<span className="flex items-center gap-2"><Icon name="sparkle" size={18} className="text-rizq-gold" /> رؤى ذكية</span>}>
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
          {insights.map((ins, i) => (
            <div key={i} className="rounded-xl border border-rizq-gold/15 bg-rizq-gold/5 p-4">
              <p className="text-sm leading-relaxed text-rizq-light/80">{ins}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* weekly sales */}
      <Card title="المبيعات اليومية (آخر ١٤ يوم)">
        <div className="h-72 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 0, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#888', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(212,175,55,0.08)' }}
                contentStyle={{ background: '#1A1A1A', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 12, direction: 'rtl' }}
                formatter={(v) => [sar(Number(v)), 'المبيعات']}
              />
              <Bar dataKey="sales" radius={[6, 6, 0, 0]} maxBarSize={42}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i === chartData.length - 1 ? '#D4AF37' : 'rgba(212,175,55,0.4)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* top products */}
        <Card title="الأكثر مبيعًا" action={<Pill tone="gold">هامش {pct(avgMargin)}</Pill>}>
          <div className="space-y-1 p-3">
            {top.map((p, i) => {
              const max = top[0]?.revenue || 1
              return (
                <div key={p.product_id} className="rounded-xl px-3 py-2.5 hover:bg-white/5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <span className="font-num flex h-6 w-6 items-center justify-center rounded-lg bg-rizq-gold/15 text-xs font-bold text-rizq-gold">
                        {i + 1}
                      </span>
                      {p.name_ar}
                    </span>
                    <span className="font-num text-sm font-semibold text-rizq-gold">{sar(p.revenue)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full gold-gradient" style={{ width: `${(p.revenue / max) * 100}%` }} />
                    </div>
                    <span className="font-num text-xs text-rizq-light/40">{p.qty} قطعة</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* customers */}
        <Card title="العملاء" action={<Pill tone="muted">{customers.length}</Pill>}>
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-rizq-charcoal/95 text-xs text-rizq-light/40">
                <tr>
                  <th className="px-4 py-2 text-right font-normal">العميل</th>
                  <th className="px-4 py-2 text-right font-normal">الجوال</th>
                  <th className="px-4 py-2 text-center font-normal">طلبات</th>
                  <th className="px-4 py-2 text-left font-normal">الإنفاق</th>
                </tr>
              </thead>
              <tbody>
                {customers.slice(0, 30).map((c, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-4 py-2.5">{c.name || '—'}</td>
                    <td className="px-4 py-2.5 font-num text-rizq-light/60" dir="ltr">{c.phone}</td>
                    <td className="px-4 py-2.5 text-center font-num">{c.orders}</td>
                    <td className="px-4 py-2.5 text-left font-num text-rizq-gold">{sar(c.spent)}</td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-rizq-light/40">
                      لا يوجد عملاء مسجلون
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

/** Heuristic "AI" insights derived from order history. */
function buildInsights(): string[] {
  const out: string[] = []

  // peak weekday
  const byDay = query<{ dow: string; sales: number }>(
    `SELECT strftime('%w', created_at) AS dow, SUM(final_total) AS sales
     FROM orders WHERE status='completed' GROUP BY dow ORDER BY sales DESC`,
  )
  if (byDay.length) {
    const top = byDay[0]
    const ref = new Date()
    ref.setDate(ref.getDate() - ((ref.getDay() - parseInt(top.dow, 10) + 7) % 7))
    out.push(`أعلى مبيعاتك يوم ${weekdayAr(ref)} — خصّص طاقمًا إضافيًا في هذا اليوم.`)
  }

  // peak hour window
  const byHour = query<{ h: string; sales: number }>(
    `SELECT strftime('%H', created_at) AS h, SUM(final_total) AS sales
     FROM orders WHERE status='completed' GROUP BY h ORDER BY sales DESC LIMIT 1`,
  )
  if (byHour.length) {
    const h = parseInt(byHour[0].h, 10)
    out.push(`ذروة الطلبات حول الساعة ${h}:00 — جهّز المطبخ قبلها بنصف ساعة.`)
  }

  // best margin product
  const margin = query<{ name_ar: string; m: number }>(
    `SELECT p.name_ar,
            (SUM(oi.total) - SUM(oi.quantity*p.cost)) / SUM(oi.total) * 100 AS m
     FROM order_items oi JOIN products p ON p.id=oi.product_id
     JOIN orders o ON o.id=oi.order_id WHERE o.status='completed'
     GROUP BY oi.product_id HAVING SUM(oi.total) > 0 ORDER BY m DESC LIMIT 1`,
  )
  if (margin.length) {
    out.push(`"${margin[0].name_ar}" يحقق أعلى هامش ربح (${pct(margin[0].m)}) — روّج له أكثر.`)
  }

  if (out.length === 0) out.push('ابدأ بتسجيل الطلبات لتظهر لك رؤى مخصّصة.')
  return out
}
