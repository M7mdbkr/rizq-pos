import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { getActiveProducts, getCategories } from '../../db/repo'
import { Card, Pill } from '../../components/ui'
import { Icon } from '../../components/Icon'

export function StockScreen() {
  const { dataVersion } = useApp()
  const { notify } = useToast()
  const products = useMemo(() => getActiveProducts(), [dataVersion])
  const categories = useMemo(() => getCategories(), [dataVersion])
  const [requested, setRequested] = useState<Set<string>>(new Set())

  const sorted = [...products].sort((a, b) => a.stock - b.stock)
  const lowCount = products.filter((p) => p.stock < p.min_stock).length

  function requestReorder(id: string, name: string) {
    setRequested((s) => new Set(s).add(id))
    notify(`تم إرسال طلب إعادة تخزين لـ "${name}" إلى المالك`, 'success')
  }

  function catName(id: string) {
    return categories.find((c) => c.id === id)?.name_ar ?? '—'
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">المخزون</h2>
          {lowCount > 0 && (
            <Pill tone="warning">
              <Icon name="alert" size={13} className="ml-1 inline" />
              {lowCount} أصناف منخفضة
            </Pill>
          )}
        </div>

        <Card>
          <div className="divide-y divide-white/5">
            {sorted.map((p) => {
              const out = p.stock <= 0
              const low = !out && p.stock < p.min_stock
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      out ? 'bg-rizq-danger/15 text-rizq-danger' : low ? 'bg-rizq-warning/15 text-rizq-warning' : 'bg-rizq-success/15 text-rizq-success'
                    }`}
                  >
                    <Icon name="box" size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.name_ar}</p>
                    <p className="text-xs text-rizq-light/40">{catName(p.category_id)}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-num text-lg font-semibold">
                      {p.stock}
                      <span className="text-xs text-rizq-light/40"> / {p.min_stock}</span>
                    </p>
                    {out ? (
                      <Pill tone="danger">نفد</Pill>
                    ) : low ? (
                      <Pill tone="warning">منخفض</Pill>
                    ) : (
                      <Pill tone="success">متوفر</Pill>
                    )}
                  </div>
                  {(low || out) && (
                    <button
                      disabled={requested.has(p.id)}
                      onClick={() => requestReorder(p.id, p.name_ar)}
                      className="rounded-lg border border-rizq-gold/40 px-3 py-1.5 text-xs text-rizq-gold transition hover:bg-rizq-gold/10 disabled:opacity-40"
                    >
                      {requested.has(p.id) ? 'تم الطلب ✓' : 'طلب تخزين'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
