import { Database } from 'sql.js'
import { VAT_RATE } from '../types'

const uid = (p: string) => p + Math.random().toString(36).slice(2, 9)

interface SeedCat {
  id: string
  name_ar: string
  icon: string
  color: string
}
interface SeedProd {
  name_ar: string
  cat: string
  price: number
  cost: number
  stock: number
  min_stock: number
}

const CATEGORIES: SeedCat[] = [
  { id: 'cat_grill', name_ar: 'المشاوي', icon: 'flame', color: '#EF4444' },
  { id: 'cat_meal', name_ar: 'الوجبات', icon: 'utensils', color: '#D4AF37' },
  { id: 'cat_app', name_ar: 'المقبلات', icon: 'salad', color: '#10B981' },
  { id: 'cat_drink', name_ar: 'المشروبات', icon: 'cup', color: '#3B82F6' },
  { id: 'cat_sweet', name_ar: 'الحلويات', icon: 'cake', color: '#EC4899' },
]

// 3 sample products per category — fully editable from the app.
const PRODUCTS: SeedProd[] = [
  { name_ar: 'مشاوي مشكلة', cat: 'cat_grill', price: 75, cost: 42, stock: 40, min_stock: 10 },
  { name_ar: 'شيش طاووق', cat: 'cat_grill', price: 48, cost: 26, stock: 50, min_stock: 12 },
  { name_ar: 'كبدة مشوية', cat: 'cat_grill', price: 40, cost: 22, stock: 6, min_stock: 10 },

  { name_ar: 'برياني دجاج', cat: 'cat_meal', price: 38, cost: 18, stock: 60, min_stock: 15 },
  { name_ar: 'مندي لحم', cat: 'cat_meal', price: 65, cost: 36, stock: 30, min_stock: 10 },
  { name_ar: 'كبسة دجاج', cat: 'cat_meal', price: 42, cost: 20, stock: 45, min_stock: 12 },

  { name_ar: 'حمص', cat: 'cat_app', price: 15, cost: 5, stock: 80, min_stock: 20 },
  { name_ar: 'فتوش', cat: 'cat_app', price: 18, cost: 7, stock: 55, min_stock: 15 },
  { name_ar: 'سمبوسة (٦ حبات)', cat: 'cat_app', price: 12, cost: 4, stock: 4, min_stock: 25 },

  { name_ar: 'عصير برتقال طازج', cat: 'cat_drink', price: 16, cost: 6, stock: 40, min_stock: 15 },
  { name_ar: 'مياه معدنية', cat: 'cat_drink', price: 3, cost: 1, stock: 200, min_stock: 50 },
  { name_ar: 'شاي كرك', cat: 'cat_drink', price: 8, cost: 2, stock: 0, min_stock: 20 },

  { name_ar: 'كنافة', cat: 'cat_sweet', price: 25, cost: 9, stock: 20, min_stock: 8 },
  { name_ar: 'أم علي', cat: 'cat_sweet', price: 22, cost: 8, stock: 15, min_stock: 8 },
  { name_ar: 'لقيمات', cat: 'cat_sweet', price: 18, cost: 6, stock: 30, min_stock: 10 },
]

const PAYMENTS = ['cash', 'cash', 'cash', 'akita', 'merzool', 'ninja'] as const

const CUSTOMER_NAMES = [
  'محمد العتيبي', 'سارة القحطاني', 'عبدالله الشمري', 'نورة الدوسري',
  'فهد الغامدي', 'ريم الحربي', 'خالد المطيري', 'لمياء السبيعي', '',
]

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function seedDatabase(db: Database): void {
  db.run('BEGIN TRANSACTION;')

  // Users
  db.run(
    `INSERT INTO users (id, name, role, pin) VALUES
     (?,?,?,?),(?,?,?,?),(?,?,?,?)`,
    [
      'user_owner', 'صاحب المطعم', 'owner', '12345678',
      'user_staff1', 'أحمد - كاشير', 'staff', '11112222',
      'user_staff2', 'يوسف - كاشير', 'staff', '33334444',
    ],
  )

  // Categories
  for (const c of CATEGORIES) {
    db.run(`INSERT INTO categories (id, name_ar, icon, color) VALUES (?,?,?,?)`, [
      c.id, c.name_ar, c.icon, c.color,
    ])
  }

  // Products
  const productIds: { id: string; price: number; cost: number }[] = []
  for (const p of PRODUCTS) {
    const id = uid('prod_')
    productIds.push({ id, price: p.price, cost: p.cost })
    db.run(
      `INSERT INTO products (id, name_ar, category_id, price, cost, stock, min_stock, status)
       VALUES (?,?,?,?,?,?,?, 'active')`,
      [id, p.name_ar, p.cat, p.price, p.cost, p.stock, p.min_stock],
    )
  }

  // Discount codes
  const future = new Date(Date.now() + 30 * 864e5).toISOString()
  db.run(
    `INSERT INTO discount_codes (id, code, discount_type, discount_value, max_uses, uses_count, expires_at)
     VALUES (?,?,?,?,?,?,?),(?,?,?,?,?,?,?),(?,?,?,?,?,?,?)`,
    [
      uid('disc_'), 'RIZQ10', 'percentage', 10, 100, 12, future,
      uid('disc_'), 'WELCOME', 'fixed', 20, 50, 5, future,
      uid('disc_'), 'VIP15', 'percentage', 15, null, 3, future,
    ],
  )

  // Historical orders across last 30 days
  const staffIds = ['user_staff1', 'user_staff2']
  const now = new Date()
  for (let d = 29; d >= 0; d--) {
    const day = new Date(now)
    day.setDate(now.getDate() - d)
    const isWeekend = day.getDay() === 5 || day.getDay() === 4 // Thu/Fri busier
    const orderCount = Math.floor((isWeekend ? 18 : 9) + Math.random() * 8)

    for (let o = 0; o < orderCount; o++) {
      // peak hours weighting (lunch 12-15, dinner 19-23)
      const hourPool = [12, 13, 13, 14, 19, 20, 20, 21, 21, 22, 11, 16, 18, 23]
      const hour = pick(hourPool)
      const minute = Math.floor(Math.random() * 60)
      day.setHours(hour, minute, 0, 0)
      const created = day.toISOString().replace('T', ' ').slice(0, 19)

      const orderId = uid('ord_')
      const itemCount = 1 + Math.floor(Math.random() * 4)
      let total = 0
      const items: { pid: string; qty: number; price: number; lineTotal: number }[] = []
      for (let i = 0; i < itemCount; i++) {
        const prod = pick(productIds)
        const qty = 1 + Math.floor(Math.random() * 3)
        const lineTotal = +(prod.price * qty).toFixed(2)
        total += lineTotal
        items.push({ pid: prod.id, qty, price: prod.price, lineTotal })
      }

      const hasDiscount = Math.random() < 0.15
      const discountAmount = hasDiscount ? +(total * 0.1).toFixed(2) : 0
      const net = total - discountAmount
      const vat = +(net * VAT_RATE).toFixed(2)
      const finalTotal = +(net + vat).toFixed(2)
      const name = pick(CUSTOMER_NAMES)
      const phone = name ? '05' + Math.floor(10000000 + Math.random() * 89999999) : null

      db.run(
        `INSERT INTO orders (id, customer_name, customer_phone, total, discount_amount, vat_amount, final_total, payment_method, status, created_at, staff_id)
         VALUES (?,?,?,?,?,?,?,?, 'completed', ?, ?)`,
        [orderId, name || null, phone, total, discountAmount, vat, finalTotal, pick(PAYMENTS), created, pick(staffIds)],
      )

      for (const it of items) {
        db.run(
          `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, total)
           VALUES (?,?,?,?,?,?)`,
          [uid('oi_'), orderId, it.pid, it.qty, it.price, it.lineTotal],
        )
        db.run(
          `INSERT INTO stock_transactions (id, product_id, transaction_type, quantity, notes, created_at)
           VALUES (?,?, 'sale', ?, ?, ?)`,
          [uid('st_'), it.pid, -it.qty, 'بيع طلب', created],
        )
      }
    }
  }

  db.run('COMMIT;')
}
