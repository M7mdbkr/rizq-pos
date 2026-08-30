import { query, queryOne, execute, getDb, uid, persist } from './database'
import {
  Product,
  Category,
  Order,
  OrderItem,
  DiscountCode,
  User,
  CartItem,
  PaymentMethod,
  StockTransaction,
  OrderType,
  Customer,
  ReportExport,
  PaymentMethodRow,
  PaymentKind,
  Consumption,
  ConsumptionType,
  ComplianceDoc,
  ComplianceKind,
  lineUnitPrice,
} from '../types'
import { computeTotals } from '../utils/calc'
import {
  genesisHash,
  computeInvoiceHash,
  newInvoiceUuid,
  ChainFields,
} from '../utils/invoiceChain'

/* ---------- Payment methods (dynamic) ---------- */
let pmCache: PaymentMethodRow[] | null = null

export function getPaymentMethods(): PaymentMethodRow[] {
  if (!pmCache)
    pmCache = query<PaymentMethodRow>('SELECT * FROM payment_methods ORDER BY sort, created_at')
  return pmCache
}
export const getActivePaymentMethods = (): PaymentMethodRow[] =>
  getPaymentMethods().filter((p) => p.active === 1)

/** Resolve a payment method id to its display name. */
export function paymentLabel(id: string): string {
  return getPaymentMethods().find((p) => p.id === id)?.name ?? id
}

export function addPaymentMethod(name: string, kind: PaymentKind): void {
  const sort = getPaymentMethods().length
  execute('INSERT INTO payment_methods (id, name, kind, active, sort) VALUES ($id,$n,$k,1,$s)', {
    $id: uid('pm_'),
    $n: name,
    $k: kind,
    $s: sort,
  })
  pmCache = null
}
export function updatePaymentMethod(
  id: string,
  patch: { name?: string; kind?: PaymentKind; active?: number },
): void {
  const cur = getPaymentMethods().find((p) => p.id === id)
  if (!cur) return
  execute('UPDATE payment_methods SET name=$n, kind=$k, active=$a WHERE id=$id', {
    $n: patch.name ?? cur.name,
    $k: patch.kind ?? cur.kind,
    $a: patch.active ?? cur.active,
    $id: id,
  })
  pmCache = null
}
export function deletePaymentMethod(id: string): void {
  execute('DELETE FROM payment_methods WHERE id=$id', { $id: id })
  pmCache = null
}
/** Rename a payment method by matching its current name (used by the assistant). */
export function findPaymentMethodByName(text: string): PaymentMethodRow | null {
  let best: PaymentMethodRow | null = null
  for (const m of getPaymentMethods()) {
    if (text.includes(m.name) && (!best || m.name.length > best.name.length)) best = m
  }
  return best
}

/* ---------- Users ---------- */
export const getUsers = () => query<User>('SELECT * FROM users ORDER BY role DESC, name')
export const findUserByPin = (pin: string) =>
  queryOne<User>('SELECT * FROM users WHERE pin = $pin', { $pin: pin })
export function addUser(name: string, role: 'staff' | 'owner', pin: string): void {
  execute('INSERT INTO users (id, name, role, pin) VALUES ($id,$n,$r,$p)', {
    $id: uid('user_'),
    $n: name,
    $r: role,
    $p: pin,
  })
}
export const updateUserPin = (id: string, pin: string) =>
  execute('UPDATE users SET pin=$p WHERE id=$id', { $p: pin, $id: id })
export const deleteUser = (id: string) => execute('DELETE FROM users WHERE id=$id', { $id: id })

/* ---------- Categories ---------- */
export const getCategories = () => query<Category>('SELECT * FROM categories ORDER BY created_at')
export function addCategory(name_ar: string, icon: string, color: string): void {
  execute('INSERT INTO categories (id, name_ar, icon, color) VALUES ($id,$n,$i,$c)', {
    $id: uid('cat_'),
    $n: name_ar,
    $i: icon,
    $c: color,
  })
}
export const deleteCategory = (id: string) =>
  execute('DELETE FROM categories WHERE id=$id', { $id: id })
export const updateCategory = (id: string, name_ar: string) =>
  execute('UPDATE categories SET name_ar=$n WHERE id=$id', { $n: name_ar, $id: id })

/* ---------- Products ---------- */
export const getProducts = () =>
  query<Product>('SELECT * FROM products ORDER BY created_at DESC')
export const getActiveProducts = () =>
  query<Product>("SELECT * FROM products WHERE status='active' ORDER BY name_ar")
export const getLowStock = () =>
  query<Product>(
    "SELECT * FROM products WHERE status='active' AND stock < min_stock ORDER BY stock ASC",
  )

export function addProduct(p: Omit<Product, 'id' | 'created_at'>): void {
  execute(
    `INSERT INTO products (id, name_ar, category_id, price, cost, stock, min_stock, status)
     VALUES ($id,$n,$cat,$pr,$co,$st,$min,$status)`,
    {
      $id: uid('prod_'),
      $n: p.name_ar,
      $cat: p.category_id,
      $pr: p.price,
      $co: p.cost,
      $st: p.stock,
      $min: p.min_stock,
      $status: p.status,
    },
  )
}

export function updateProduct(p: Product): void {
  execute(
    `UPDATE products SET name_ar=$n, category_id=$cat, price=$pr, cost=$co,
     stock=$st, min_stock=$min, status=$status WHERE id=$id`,
    {
      $n: p.name_ar,
      $cat: p.category_id,
      $pr: p.price,
      $co: p.cost,
      $st: p.stock,
      $min: p.min_stock,
      $status: p.status,
      $id: p.id,
    },
  )
}

export const deleteProduct = (id: string) =>
  execute('DELETE FROM products WHERE id=$id', { $id: id })

export function restock(productId: string, amount: number, notes = 'إعادة تخزين'): void {
  const db = getDb()
  db.run('UPDATE products SET stock = stock + $a WHERE id=$id', { $a: amount, $id: productId })
  db.run(
    `INSERT INTO stock_transactions (id, product_id, transaction_type, quantity, notes)
     VALUES ($id,$pid,'restock',$q,$n)`,
    { $id: uid('st_'), $pid: productId, $q: amount, $n: notes },
  )
  persist()
}

export function adjustStock(productId: string, newStock: number, notes = 'تعديل يدوي'): void {
  const db = getDb()
  const cur = queryOne<{ stock: number }>('SELECT stock FROM products WHERE id=$id', {
    $id: productId,
  })
  const diff = newStock - (cur?.stock ?? 0)
  db.run('UPDATE products SET stock=$s WHERE id=$id', { $s: newStock, $id: productId })
  db.run(
    `INSERT INTO stock_transactions (id, product_id, transaction_type, quantity, notes)
     VALUES ($id,$pid,'adjustment',$q,$n)`,
    { $id: uid('st_'), $pid: productId, $q: diff, $n: notes },
  )
  persist()
}

export const getStockTransactions = (productId: string) =>
  query<StockTransaction>(
    'SELECT * FROM stock_transactions WHERE product_id=$id ORDER BY created_at DESC LIMIT 50',
    { $id: productId },
  )

/* ---------- Discount codes ---------- */
export const getDiscounts = () =>
  query<DiscountCode>('SELECT * FROM discount_codes ORDER BY created_at DESC')
export const findDiscount = (code: string) =>
  queryOne<DiscountCode>('SELECT * FROM discount_codes WHERE UPPER(code)=UPPER($c)', { $c: code })

export function addDiscount(d: Omit<DiscountCode, 'id' | 'uses_count' | 'created_at'>): void {
  execute(
    `INSERT INTO discount_codes (id, code, discount_type, discount_value, max_uses, uses_count, expires_at)
     VALUES ($id,$c,$t,$v,$m,0,$e)`,
    {
      $id: uid('disc_'),
      $c: d.code.toUpperCase(),
      $t: d.discount_type,
      $v: d.discount_value,
      $m: d.max_uses,
      $e: d.expires_at,
    },
  )
}
export const deleteDiscount = (id: string) =>
  execute('DELETE FROM discount_codes WHERE id=$id', { $id: id })

/* ---------- Orders ---------- */
export interface NewOrderInput {
  items: CartItem[]
  discount: DiscountCode | null
  customerName: string
  customerPhone: string
  paymentMethod: PaymentMethod
  staffId: string
  orderType: OrderType
  tableNo: string
  notes: string
}

export function createOrder(input: NewOrderInput): Order {
  const {
    items,
    discount,
    customerName,
    customerPhone,
    paymentMethod,
    staffId,
    orderType,
    tableNo,
    notes,
  } = input
  const totals = computeTotals(items, discount)
  const db = getDb()
  const orderId = uid('ord_')
  const nextInvoiceNo =
    (queryOne<{ n: number }>('SELECT COALESCE(MAX(invoice_no),0)+1 AS n FROM orders')?.n ?? 1)

  // tamper-evident chain: link this invoice to the previous one (ZATCA groundwork)
  const prevHash =
    queryOne<{ h: string }>(
      'SELECT invoice_hash AS h FROM orders WHERE invoice_hash IS NOT NULL ORDER BY invoice_no DESC LIMIT 1',
    )?.h ?? genesisHash()
  const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const invUuid = newInvoiceUuid()
  const chainFields: ChainFields = {
    id: orderId,
    uuid: invUuid,
    invoice_no: nextInvoiceNo,
    created_at: createdAt,
    total: totals.subtotal,
    discount_amount: totals.discountAmount,
    vat_amount: totals.vat,
    final_total: totals.total,
    payment_method: paymentMethod,
  }
  const invHash = computeInvoiceHash(chainFields, prevHash)

  db.run('BEGIN TRANSACTION;')
  try {
    db.run(
      `INSERT INTO orders (id, customer_name, customer_phone, total, discount_amount, vat_amount, final_total, payment_method, status, staff_id, order_type, table_no, notes, invoice_no, created_at, uuid, prev_hash, invoice_hash)
       VALUES ($id,$cn,$cp,$t,$d,$v,$ft,$pm,'completed',$sid,$ot,$tno,$notes,$inv,$ca,$uuid,$ph,$ih)`,
      {
        $id: orderId,
        $cn: customerName || null,
        $cp: customerPhone || null,
        $t: totals.subtotal,
        $d: totals.discountAmount,
        $v: totals.vat,
        $ft: totals.total,
        $pm: paymentMethod,
        $sid: staffId,
        $ot: orderType,
        $tno: tableNo || null,
        $notes: notes || null,
        $inv: nextInvoiceNo,
        $ca: createdAt,
        $uuid: invUuid,
        $ph: prevHash,
        $ih: invHash,
      },
    )

    for (const it of items) {
      const unit = lineUnitPrice(it)
      db.run(
        `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, total, name, note)
         VALUES ($id,$oid,$pid,$q,$up,$t,$name,$note)`,
        {
          $id: uid('oi_'),
          $oid: orderId,
          $pid: it.product.id,
          $q: it.quantity,
          $up: unit,
          $t: +(unit * it.quantity).toFixed(2),
          $name: it.product.name_ar,
          $note: it.note || null,
        },
      )
      // custom items are not tracked in inventory
      if (!it.custom) {
        db.run('UPDATE products SET stock = stock - $q WHERE id=$id', {
          $q: it.quantity,
          $id: it.product.id,
        })
        db.run(
          `INSERT INTO stock_transactions (id, product_id, transaction_type, quantity, notes)
           VALUES ($id,$pid,'sale',$q,$n)`,
          { $id: uid('st_'), $pid: it.product.id, $q: -it.quantity, $n: 'بيع طلب' },
        )
      }
    }

    if (discount) {
      db.run('UPDATE discount_codes SET uses_count = uses_count + 1 WHERE id=$id', {
        $id: discount.id,
      })
    }

    // accumulate the customer in the CRM table for marketing
    const phone = (customerPhone || '').trim()
    if (phone) {
      db.run(
        `INSERT INTO customers (phone, name, orders_count, total_spent, first_seen, last_seen, marketing_opt_in)
         VALUES ($p, $n, 1, $t, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
         ON CONFLICT(phone) DO UPDATE SET
           name = COALESCE(NULLIF($n,''), customers.name),
           orders_count = customers.orders_count + 1,
           total_spent = customers.total_spent + $t,
           last_seen = CURRENT_TIMESTAMP`,
        { $p: phone, $n: customerName || '', $t: totals.total },
      )
    }
    db.run('COMMIT;')
  } catch (e) {
    db.run('ROLLBACK;')
    throw e
  }
  persist()
  return queryOne<Order>('SELECT * FROM orders WHERE id=$id', { $id: orderId })!
}

export const getOrders = (limit = 200) =>
  query<Order>('SELECT * FROM orders ORDER BY created_at DESC LIMIT $l', { $l: limit })

/** Recent completed orders for the reprint panel. */
export const getRecentOrders = (limit = 25) =>
  query<Order>(
    "SELECT * FROM orders WHERE status='completed' ORDER BY created_at DESC LIMIT $l",
    { $l: limit },
  )

export const getOrderItems = (orderId: string) =>
  query<OrderItem & { name_ar: string }>(
    `SELECT oi.*, COALESCE(oi.name, p.name_ar, 'صنف') AS name_ar
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id=$id`,
    { $id: orderId },
  )

/* ---------- Analytics aggregates ---------- */
export interface DaySummary {
  date: string
  sales: number
  net: number
  vat: number
  discount: number
  orders: number
}

export function getDailySummaries(days = 30): DaySummary[] {
  return query<DaySummary>(
    `SELECT date(created_at) AS date,
            SUM(final_total) AS sales,
            SUM(total - discount_amount) AS net,
            SUM(vat_amount) AS vat,
            SUM(discount_amount) AS discount,
            COUNT(*) AS orders
     FROM orders WHERE status='completed'
       AND date(created_at) >= date('now', '-' || $d || ' days')
     GROUP BY date(created_at) ORDER BY date(created_at)`,
    { $d: days },
  )
}

export interface TodayStats {
  sales: number
  net: number
  vat: number
  discount: number
  orders: number
  cost: number
  profit: number
}

export function getTodayStats(): TodayStats {
  const row = queryOne<Omit<TodayStats, 'profit'>>(
    `SELECT
       COALESCE(SUM(o.final_total),0) AS sales,
       COALESCE(SUM(o.total - o.discount_amount),0) AS net,
       COALESCE(SUM(o.vat_amount),0) AS vat,
       COALESCE(SUM(o.discount_amount),0) AS discount,
       COUNT(DISTINCT o.id) AS orders,
       COALESCE((SELECT SUM(oi.quantity * p.cost)
                 FROM order_items oi
                 JOIN orders o2 ON o2.id = oi.order_id
                 JOIN products p ON p.id = oi.product_id
                 WHERE date(o2.created_at)=date('now') AND o2.status='completed'),0) AS cost
     FROM orders o
     WHERE date(o.created_at)=date('now') AND o.status='completed'`,
  )!
  const profit = +(row.net - row.cost).toFixed(2)
  return { ...row, profit }
}

export function getHourlyToday(): { hour: number; sales: number }[] {
  const rows = query<{ hour: string; sales: number }>(
    `SELECT strftime('%H', created_at) AS hour, SUM(final_total) AS sales
     FROM orders WHERE date(created_at)=date('now') AND status='completed'
     GROUP BY hour`,
  )
  const map = new Map(rows.map((r) => [parseInt(r.hour, 10), r.sales]))
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: map.get(h) ?? 0 }))
}

export function getPaymentBreakdown(scope: 'today' | 'all' = 'today') {
  const where =
    scope === 'today'
      ? "WHERE date(created_at)=date('now') AND status='completed'"
      : "WHERE status='completed'"
  return query<{ payment_method: PaymentMethod; total: number; count: number }>(
    `SELECT payment_method, SUM(final_total) AS total, COUNT(*) AS count
     FROM orders ${where} GROUP BY payment_method`,
  )
}

export interface TopProduct {
  product_id: string
  name_ar: string
  qty: number
  revenue: number
  cost: number
  profit: number
}

export function getTopProducts(limit = 8): TopProduct[] {
  return query<TopProduct>(
    `SELECT oi.product_id, p.name_ar,
            SUM(oi.quantity) AS qty,
            SUM(oi.total) AS revenue,
            SUM(oi.quantity * p.cost) AS cost,
            SUM(oi.total - oi.quantity * p.cost) AS profit
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status='completed'
     GROUP BY oi.product_id ORDER BY revenue DESC LIMIT $l`,
    { $l: limit },
  )
}

export function getCustomers(): { name: string; phone: string; orders: number; spent: number }[] {
  return query(
    `SELECT customer_name AS name, customer_phone AS phone,
            COUNT(*) AS orders, SUM(final_total) AS spent
     FROM orders WHERE customer_phone IS NOT NULL AND status='completed'
     GROUP BY customer_phone ORDER BY spent DESC`,
  )
}

/* ---------- Customers CRM (marketing) ---------- */

export const getCrmCustomers = () =>
  query<Customer & { days_since: number }>(
    `SELECT *, CAST((julianday('now') - julianday(last_seen)) AS INTEGER) AS days_since
     FROM customers ORDER BY total_spent DESC`,
  )

export const getCustomer = (phone: string) =>
  queryOne<Customer>('SELECT * FROM customers WHERE phone=$p', { $p: phone })

export const getCustomerOrders = (phone: string) =>
  query<Order>(
    "SELECT * FROM orders WHERE customer_phone=$p AND status='completed' ORDER BY created_at DESC",
    { $p: phone },
  )

export const getCustomerFavorites = (phone: string) =>
  query<{ name_ar: string; qty: number }>(
    `SELECT COALESCE(oi.name, p.name_ar, 'صنف') AS name_ar, SUM(oi.quantity) AS qty
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.customer_phone=$p AND o.status='completed'
     GROUP BY name_ar ORDER BY qty DESC LIMIT 5`,
    { $p: phone },
  )

export function updateCustomer(
  phone: string,
  patch: { name?: string; tags?: string; notes?: string; marketing_opt_in?: number },
): void {
  const cur = getCustomer(phone)
  if (!cur) return
  execute(
    `UPDATE customers SET name=$n, tags=$tg, notes=$nt, marketing_opt_in=$opt WHERE phone=$p`,
    {
      $n: patch.name ?? cur.name,
      $tg: patch.tags ?? cur.tags,
      $nt: patch.notes ?? cur.notes,
      $opt: patch.marketing_opt_in ?? cur.marketing_opt_in,
      $p: phone,
    },
  )
}

export interface CrmStats {
  total: number
  repeat: number
  optIn: number
  avgSpent: number
  totalRevenue: number
}

export function getCrmStats(): CrmStats {
  const r = queryOne<CrmStats>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN orders_count > 1 THEN 1 ELSE 0 END) AS repeat,
            SUM(marketing_opt_in) AS optIn,
            COALESCE(AVG(total_spent),0) AS avgSpent,
            COALESCE(SUM(total_spent),0) AS totalRevenue
     FROM customers`,
  )
  return r ?? { total: 0, repeat: 0, optIn: 0, avgSpent: 0, totalRevenue: 0 }
}

/* ---------- Reports export (date-scoped + logged) ---------- */

export interface ReportData {
  orders: Order[]
  saleLines: {
    created_at: string
    order_id: string
    name: string
    quantity: number
    unit_price: number
    total: number
    note: string | null
    payment_method: PaymentMethod
    order_type: OrderType
    table_no: string | null
  }[]
  ledger: DaySummary[]
  payments: { payment_method: PaymentMethod; total: number; count: number }[]
  totals: { orders: number; sales: number; vat: number; discount: number; cost: number; net: number }
}

/** Build all report datasets for an inclusive date range (null = unbounded). */
export function getReportData(from: string | null, to: string | null): ReportData {
  const range = '($f IS NULL OR date(o.created_at) >= $f) AND ($t IS NULL OR date(o.created_at) <= $t)'
  const p = { $f: from, $t: to }

  const orders = query<Order>(
    `SELECT o.* FROM orders o WHERE o.status='completed' AND ${range} ORDER BY o.created_at DESC`,
    p,
  )

  const saleLines = query<ReportData['saleLines'][number]>(
    `SELECT o.created_at, oi.order_id,
            COALESCE(oi.name, p.name_ar, 'صنف') AS name,
            oi.quantity, oi.unit_price, oi.total, oi.note,
            o.payment_method, o.order_type, o.table_no
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.status='completed' AND ${range}
     ORDER BY o.created_at DESC`,
    p,
  )

  const ledger = query<DaySummary>(
    `SELECT date(o.created_at) AS date,
            SUM(o.final_total) AS sales,
            SUM(o.total - o.discount_amount) AS net,
            SUM(o.vat_amount) AS vat,
            SUM(o.discount_amount) AS discount,
            COUNT(*) AS orders
     FROM orders o WHERE o.status='completed' AND ${range}
     GROUP BY date(o.created_at) ORDER BY date(o.created_at) DESC`,
    p,
  )

  const payments = query<{ payment_method: PaymentMethod; total: number; count: number }>(
    `SELECT o.payment_method, SUM(o.final_total) AS total, COUNT(*) AS count
     FROM orders o WHERE o.status='completed' AND ${range}
     GROUP BY o.payment_method`,
    p,
  )

  const costRow = queryOne<{ cost: number }>(
    `SELECT COALESCE(SUM(oi.quantity * p.cost),0) AS cost
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE o.status='completed' AND ${range}`,
    p,
  )
  const totals = {
    orders: orders.length,
    sales: +orders.reduce((s, o) => s + o.final_total, 0).toFixed(2),
    vat: +orders.reduce((s, o) => s + o.vat_amount, 0).toFixed(2),
    discount: +orders.reduce((s, o) => s + o.discount_amount, 0).toFixed(2),
    net: +orders.reduce((s, o) => s + (o.total - o.discount_amount), 0).toFixed(2),
    cost: costRow?.cost ?? 0,
  }

  return { orders, saleLines, ledger, payments, totals }
}

export function logExport(meta: Omit<ReportExport, 'id' | 'created_at'>): void {
  execute(
    `INSERT INTO report_exports (id, store_name, scope, date_from, date_to, sheets, orders_count, total_sales, exported_by)
     VALUES ($id,$sn,$sc,$df,$dt,$sh,$oc,$ts,$by)`,
    {
      $id: uid('exp_'),
      $sn: meta.store_name,
      $sc: meta.scope,
      $df: meta.date_from,
      $dt: meta.date_to,
      $sh: meta.sheets,
      $oc: meta.orders_count,
      $ts: meta.total_sales,
      $by: meta.exported_by,
    },
  )
}

export const getRecentExports = (limit = 15) =>
  query<ReportExport>('SELECT * FROM report_exports ORDER BY created_at DESC LIMIT $l', { $l: limit })

/* ---------- Operations: waste & staff meals ---------- */

export interface NewConsumption {
  type: ConsumptionType
  productId: string | null
  name: string
  quantity: number
  unitCost: number
  notes: string
  staffId: string
}

export function addConsumption(c: NewConsumption): void {
  const total = +(c.unitCost * c.quantity).toFixed(2)
  const db = getDb()
  db.run('BEGIN TRANSACTION;')
  try {
    db.run(
      `INSERT INTO stock_consumption (id, type, product_id, name, quantity, unit_cost, total_cost, notes, staff_id)
       VALUES ($id,$t,$pid,$n,$q,$uc,$tc,$no,$sid)`,
      {
        $id: uid('con_'),
        $t: c.type,
        $pid: c.productId,
        $n: c.name,
        $q: c.quantity,
        $uc: c.unitCost,
        $tc: total,
        $no: c.notes || null,
        $sid: c.staffId || null,
      },
    )
    // deduct from inventory for catalog items
    if (c.productId) {
      db.run('UPDATE products SET stock = stock - $q WHERE id=$id', { $q: c.quantity, $id: c.productId })
      db.run(
        `INSERT INTO stock_transactions (id, product_id, transaction_type, quantity, notes)
         VALUES ($id,$pid,'adjustment',$q,$no)`,
        {
          $id: uid('st_'),
          $pid: c.productId,
          $q: -c.quantity,
          $no: c.type === 'waste' ? 'هدر/تالف' : 'وجبة موظف',
        },
      )
    }
    db.run('COMMIT;')
  } catch (e) {
    db.run('ROLLBACK;')
    throw e
  }
  persist()
}

export const getConsumption = (limit = 100) =>
  query<Consumption>('SELECT * FROM stock_consumption ORDER BY created_at DESC LIMIT $l', { $l: limit })

export const deleteConsumption = (id: string) =>
  execute('DELETE FROM stock_consumption WHERE id=$id', { $id: id })

export interface ConsumptionStats {
  wasteCost: number
  wasteCount: number
  staffMealCost: number
  staffMealCount: number
}

/* ---------- Compliance documents (licenses/permits/work cards) ---------- */

export type ComplianceRow = ComplianceDoc & { days_left: number }

export const getComplianceDocs = (): ComplianceRow[] =>
  query<ComplianceRow>(
    `SELECT *, CAST(julianday(expiry_date) - julianday('now') AS INTEGER) AS days_left
     FROM compliance_docs ORDER BY days_left ASC`,
  )

/** Docs already expired or entering their reminder window. */
export const getExpiringDocs = (): ComplianceRow[] =>
  getComplianceDocs().filter((d) => d.days_left <= (d.reminder_days ?? 30))

export function addComplianceDoc(d: {
  title: string
  kind: ComplianceKind
  refNo?: string
  holder?: string
  issuer?: string
  expiryDate: string
  reminderDays?: number
  notes?: string
}): void {
  execute(
    `INSERT INTO compliance_docs (id, title, kind, ref_no, holder, issuer, expiry_date, reminder_days, notes)
     VALUES ($id,$t,$k,$r,$h,$i,$e,$rd,$n)`,
    {
      $id: uid('doc_'),
      $t: d.title,
      $k: d.kind,
      $r: d.refNo || null,
      $h: d.holder || null,
      $i: d.issuer || null,
      $e: d.expiryDate,
      $rd: d.reminderDays ?? 30,
      $n: d.notes || null,
    },
  )
}

export function updateComplianceDoc(id: string, d: {
  title: string
  kind: ComplianceKind
  refNo?: string
  holder?: string
  expiryDate: string
  reminderDays?: number
  notes?: string
}): void {
  execute(
    `UPDATE compliance_docs SET title=$t, kind=$k, ref_no=$r, holder=$h, expiry_date=$e, reminder_days=$rd, notes=$n WHERE id=$id`,
    {
      $t: d.title,
      $k: d.kind,
      $r: d.refNo || null,
      $h: d.holder || null,
      $e: d.expiryDate,
      $rd: d.reminderDays ?? 30,
      $n: d.notes || null,
      $id: id,
    },
  )
}

export const deleteComplianceDoc = (id: string) =>
  execute('DELETE FROM compliance_docs WHERE id=$id', { $id: id })

/* ---------- Invoice chain verification (tamper detection) ---------- */

export interface ChainVerifyResult {
  ok: boolean
  checked: number
  /** invoice_no of the first tampered/broken record, if any */
  firstBad?: number
}

export function verifyInvoiceChain(): ChainVerifyResult {
  const rows = query<{
    id: string
    uuid: string
    invoice_no: number
    created_at: string
    total: number
    discount_amount: number
    vat_amount: number
    final_total: number
    payment_method: string
    prev_hash: string
    invoice_hash: string
  }>(
    `SELECT id, uuid, invoice_no, created_at, total, discount_amount, vat_amount, final_total, payment_method, prev_hash, invoice_hash
     FROM orders ORDER BY invoice_no ASC`,
  )
  let prev = genesisHash()
  for (const r of rows) {
    const expected = computeInvoiceHash(
      {
        id: r.id,
        uuid: r.uuid,
        invoice_no: r.invoice_no,
        created_at: r.created_at,
        total: r.total,
        discount_amount: r.discount_amount ?? 0,
        vat_amount: r.vat_amount ?? 0,
        final_total: r.final_total,
        payment_method: r.payment_method ?? '',
      },
      prev,
    )
    if (r.prev_hash !== prev || r.invoice_hash !== expected) {
      return { ok: false, checked: rows.length, firstBad: r.invoice_no }
    }
    prev = r.invoice_hash
  }
  return { ok: true, checked: rows.length }
}

export function getConsumptionStats(scope: 'today' | 'month' | 'all' = 'month'): ConsumptionStats {
  const where =
    scope === 'today'
      ? "WHERE date(created_at)=date('now')"
      : scope === 'month'
        ? "WHERE strftime('%Y-%m', created_at)=strftime('%Y-%m','now')"
        : ''
  const r = queryOne<ConsumptionStats>(
    `SELECT
       COALESCE(SUM(CASE WHEN type='waste' THEN total_cost END),0) AS wasteCost,
       COALESCE(SUM(CASE WHEN type='waste' THEN 1 END),0) AS wasteCount,
       COALESCE(SUM(CASE WHEN type='staff_meal' THEN total_cost END),0) AS staffMealCost,
       COALESCE(SUM(CASE WHEN type='staff_meal' THEN 1 END),0) AS staffMealCount
     FROM stock_consumption ${where}`,
  )
  return r ?? { wasteCost: 0, wasteCount: 0, staffMealCost: 0, staffMealCount: 0 }
}
