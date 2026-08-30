import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useApp } from '../../context/AppContext'
import {
  getTodayStats,
  getHourlyToday,
  getPaymentBreakdown,
  getLowStock,
  getExpiringDocs,
  paymentLabel,
} from '../../db/repo'
import { Card, Pill } from '../../components/ui'
import { Icon, IconName } from '../../components/Icon'
import { sar, pct } from '../../utils/format'
import { PaymentMethod } from '../../types'

export function Dashboard() {
  const { dataVersion } = useApp()
  const stats = useMemo(() => getTodayStats(), [dataVersion])
  const hourly = useMemo(() => getHourlyToday(), [dataVersion])
  const payments = useMemo(() => getPaymentBreakdown('today'), [dataVersion])
  const lowStock = useMemo(() => getLowStock(), [dataVersion])
  const expiringDocs = useMemo(() => getExpiringDocs(), [dataVersion])

  const margin = stats.net > 0 ? (stats.profit / stats.net) * 100 : 0
  const peakHours = hourly.filter((h) => h.sales > 0)
  const chartData = hourly
    .slice(8)
    .map((h) => ({ hour: `${h.hour}`, sales: h.sales }))

  return (
    <div className="space-y-5 p-5">
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-sm text-rizq-light/50">ملخص أداء اليوم</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon="cart" label="مبيعات اليوم" value={sar(stats.sales)} tone="gold" />
        <Stat icon="sparkle" label="صافي الربح" value={sar(stats.profit)} tone="success" sub={`هامش ${pct(margin)}`} />
        <Stat icon="ledger" label="عدد الطلبات" value={String(stats.orders)} tone="muted" />
        <Stat icon="tag" label="الخصومات" value={sar(stats.discount)} tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* hourly chart */}
        <Card title="المبيعات بالساعة" className="lg:col-span-2">
          <div className="h-64 p-4">
            {peakHours.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-rizq-light/40">
                لا توجد مبيعات اليوم بعد
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" tick={{ fill: '#888', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#888', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#1A1A1A',
                      border: '1px solid rgba(212,175,55,0.3)',
                      borderRadius: 12,
                      direction: 'rtl',
                    }}
                    formatter={(v) => [sar(Number(v)), 'المبيعات']}
                    labelFormatter={(l) => `الساعة ${l}`}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#D4AF37" strokeWidth={2.5} fill="url(#goldFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* payment breakdown */}
        <Card title="طرق الدفع">
          <div className="space-y-3 p-4">
            {payments.length === 0 ? (
              <p className="py-8 text-center text-sm text-rizq-light/40">لا توجد بيانات</p>
            ) : (
              payments.map((p) => {
                const total = payments.reduce((s, x) => s + x.total, 0)
                const share = total > 0 ? (p.total / total) * 100 : 0
                return (
                  <div key={p.payment_method}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{paymentLabel(p.payment_method as PaymentMethod)}</span>
                      <span className="font-num text-rizq-gold">{sar(p.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full gold-gradient" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      {/* stock alerts */}
      <Card
        title="تنبيهات المخزون"
        action={lowStock.length > 0 ? <Pill tone="danger">{lowStock.length}</Pill> : <Pill tone="success">جيد</Pill>}
      >
        {lowStock.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-rizq-light/40">
            جميع الأصناف ضمن المستوى الآمن ✓
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3">
                <span className="text-sm">{p.name_ar}</span>
                <span className={`font-num text-sm font-semibold ${p.stock <= 0 ? 'text-rizq-danger' : 'text-rizq-warning'}`}>
                  {p.stock <= 0 ? 'نفد' : `${p.stock} / ${p.min_stock}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* compliance deadlines */}
      {expiringDocs.length > 0 && (
        <Card
          title="التزامات قريبة الانتهاء"
          action={<Pill tone="danger">{expiringDocs.length}</Pill>}
        >
          <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {expiringDocs.slice(0, 6).map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3">
                <span className="text-sm">{d.title}</span>
                <span className={`font-num text-xs font-semibold ${d.days_left < 0 ? 'text-rizq-danger' : 'text-rizq-warning'}`}>
                  {d.days_left < 0 ? `منتهية منذ ${Math.abs(d.days_left)} يوم` : `باقي ${d.days_left} يوم`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: IconName
  label: string
  value: string
  sub?: string
  tone: 'gold' | 'success' | 'warning' | 'muted'
}) {
  const tones = {
    gold: 'text-rizq-gold bg-rizq-gold/15',
    success: 'text-rizq-success bg-rizq-success/15',
    warning: 'text-rizq-warning bg-rizq-warning/15',
    muted: 'text-rizq-light/70 bg-white/8',
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-rizq-light/50">{label}</p>
          <p className="font-num mt-1 text-2xl font-bold">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-rizq-light/40">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon name={icon} size={20} />
        </div>
      </div>
    </Card>
  )
}
