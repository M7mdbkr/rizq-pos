import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { getActiveProducts, getCategories } from '../../db/repo'
import { uid } from '../../db/database'
import { CartItem, Category, Product } from '../../types'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/ui'
import { sar } from '../../utils/format'
import { CartPanel } from './CartPanel'
import { CustomItemModal } from './CustomItemModal'
import { RecentOrdersModal } from './RecentOrdersModal'

export function CashierScreen() {
  const { dataVersion, refresh } = useApp()
  const { notify } = useToast()

  const products = useMemo(() => getActiveProducts(), [dataVersion])
  const categories = useMemo(() => getCategories(), [dataVersion])

  const [activeCat, setActiveCat] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customOpen, setCustomOpen] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)

  const filtered = products.filter((p) => {
    const catOk = activeCat === 'all' || p.category_id === activeCat
    const searchOk = !search || p.name_ar.includes(search)
    return catOk && searchOk
  })

  function addToCart(p: Product) {
    if (p.stock <= 0) {
      notify('هذا الصنف غير متوفر في المخزون', 'warning')
      return
    }
    setCart((prev) => {
      // merge into an existing plain line (no note / no price override)
      const existing = prev.find(
        (i) => i.product.id === p.id && !i.custom && !i.note && i.unitPrice == null,
      )
      if (existing) {
        if (existing.quantity >= p.stock) {
          notify('لا يوجد مخزون كافٍ', 'warning')
          return prev
        }
        return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [...prev, { lineId: uid('ln_'), product: p, quantity: 1 }]
    })
  }

  function addCustom(name: string, price: number) {
    const product: Product = {
      id: uid('custom_'),
      name_ar: name,
      category_id: '',
      price,
      cost: 0,
      stock: 9999,
      min_stock: 0,
      status: 'active',
      created_at: '',
    }
    setCart((prev) => [...prev, { lineId: uid('ln_'), product, quantity: 1, custom: true }])
    notify('تمت إضافة الصنف المخصص', 'success')
  }

  function updateLine(lineId: string, patch: Partial<CartItem>) {
    setCart((prev) =>
      prev.flatMap((i) => {
        if (i.lineId !== lineId) return [i]
        const next = { ...i, ...patch }
        if (next.quantity <= 0) return []
        // respect stock for catalog items
        if (!next.custom && next.quantity > next.product.stock) {
          next.quantity = next.product.stock
        }
        return [next]
      }),
    )
  }

  function removeLine(lineId: string) {
    setCart((prev) => prev.filter((i) => i.lineId !== lineId))
  }

  return (
    <div className="flex flex-col lg:grid lg:h-full lg:grid-cols-[1fr_400px]">
      {/* products area */}
      <div className="flex flex-col p-4 lg:h-full lg:min-h-0">
        {/* toolbar: search + custom item + recent orders */}
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rizq-light/40"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن صنف…"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pr-10 pl-4 text-sm outline-none focus:border-rizq-gold/50"
            />
          </div>
          <Button variant="ghost" icon="plus" onClick={() => setCustomOpen(true)}>
            <span className="hidden sm:inline">صنف مخصص</span>
          </Button>
          <Button variant="ghost" icon="print" onClick={() => setRecentOpen(true)}>
            <span className="hidden sm:inline">الطلبات الأخيرة</span>
          </Button>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <CatChip label="الكل" active={activeCat === 'all'} onClick={() => setActiveCat('all')} />
          {categories.map((c) => (
            <CatChip
              key={c.id}
              label={c.name_ar}
              color={c.color}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
            />
          ))}
        </div>

        {/* grid */}
        <div className="grid grid-cols-2 content-start gap-3 pb-4 sm:grid-cols-3 lg:flex-1 lg:overflow-y-auto xl:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              category={categories.find((c) => c.id === p.category_id)}
              onAdd={() => addToCart(p)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-rizq-light/40">
              لا توجد أصناف مطابقة
            </div>
          )}
        </div>
      </div>

      {/* cart */}
      <CartPanel
        cart={cart}
        updateLine={updateLine}
        removeLine={removeLine}
        clear={() => setCart([])}
        onComplete={() => {
          setCart([])
          refresh()
        }}
      />

      {customOpen && (
        <CustomItemModal
          onClose={() => setCustomOpen(false)}
          onAdd={(name, price) => {
            addCustom(name, price)
            setCustomOpen(false)
          }}
        />
      )}
      {recentOpen && <RecentOrdersModal onClose={() => setRecentOpen(false)} />}
    </div>
  )
}

function CatChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string
  color?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
        active
          ? 'border-rizq-gold bg-rizq-gold/15 font-semibold text-rizq-gold'
          : 'border-white/10 text-rizq-light/60 hover:bg-white/5'
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  )
}

function ProductCard({
  product,
  category,
  onAdd,
}: {
  product: Product
  category?: Category
  onAdd: () => void
}) {
  const out = product.stock <= 0
  const low = !out && product.stock < product.min_stock
  return (
    <button
      onClick={onAdd}
      disabled={out}
      className={`group surface relative flex flex-col overflow-hidden rounded-2xl p-3 text-right transition
        ${out ? 'opacity-50' : 'hover:border-rizq-gold/50 hover:shadow-gold active:scale-[0.98]'}`}
    >
      <div
        className="mb-3 flex h-20 items-center justify-center rounded-xl text-3xl"
        style={{ background: `${category?.color ?? '#D4AF37'}22` }}
      >
        <Icon name={(category?.icon as never) ?? 'utensils'} size={32} className="text-rizq-gold" />
      </div>
      <span className="mb-1 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight">
        {product.name_ar}
      </span>
      <div className="mt-auto flex items-center justify-between">
        <span className="font-num text-rizq-gold">{sar(product.price)}</span>
        {out ? (
          <span className="text-xs text-rizq-danger">نفد</span>
        ) : low ? (
          <span className="text-xs text-rizq-warning">متبقٍ {product.stock}</span>
        ) : (
          <span className="font-num text-xs text-rizq-light/40">{product.stock}</span>
        )}
      </div>
    </button>
  )
}
