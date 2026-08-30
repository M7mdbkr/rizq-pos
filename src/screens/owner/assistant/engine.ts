import {
  getProducts,
  getLowStock,
  updateProduct,
  addProduct,
  restock,
  addDiscount,
  getCategories,
  addCategory,
  updateCategory,
  getTopProducts,
  getTodayStats,
  getDailySummaries,
  getPaymentBreakdown,
  getCustomers,
  paymentLabel,
  getPaymentMethods,
  updatePaymentMethod,
} from '../../../db/repo'
import { Product, Category, PaymentMethod, PaymentMethodRow } from '../../../types'
import { sar, pct } from '../../../utils/format'
import { saveSettings } from '../../../config/settings'

export interface AssistantRow {
  label: string
  value: string
}

export interface AssistantAction {
  /** human description of what will happen */
  summary: string
  /** performs the change; returns a confirmation message */
  run: () => string
}

export interface AssistantResult {
  reply: string
  rows?: AssistantRow[]
  action?: AssistantAction
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

function normalize(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .toLowerCase()
    .trim()
}

function has(text: string, ...words: string[]): boolean {
  return words.some((w) => text.includes(normalize(w)))
}

/** Find the product whose name best matches the text (longest name match). */
function findProduct(text: string): Product | null {
  const products = getProducts()
  let best: Product | null = null
  for (const p of products) {
    if (text.includes(normalize(p.name_ar))) {
      if (!best || p.name_ar.length > best.name_ar.length) best = p
    }
  }
  return best
}

function extractPercent(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:%|بالمئه|بالميه|بالمايه|نسبه)/)
  if (m) return parseFloat(m[1])
  const m2 = text.match(/نسبه\s*(\d+(?:\.\d+)?)/)
  return m2 ? parseFloat(m2[1]) : null
}

function extractAmount(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:ريال|ر\.?س|﷼|درهم)/)
  return m ? parseFloat(m[1]) : null
}

function firstNumber(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

/* ------------------------------------------------------------------ */
/* main                                                               */
/* ------------------------------------------------------------------ */

export function runAssistant(raw: string): AssistantResult {
  const text = normalize(raw)
  if (!text) return help()

  // order matters: writes (more specific) before generic reads
  return (
    tryVat(text) ||
    tryRename(text, raw) ||
    tryAddCategory(text, raw) ||
    tryAddProduct(text, raw) ||
    tryPriceChange(text) ||
    tryRestock(text) ||
    tryToggleStatus(text) ||
    tryMinStock(text) ||
    tryCreateDiscount(text, raw) ||
    tryReads(text) ||
    help()
  )
}

/** New name = text after a "to" connector, cleaned of quotes. */
function extractNewName(raw: string): string | null {
  const m = raw.match(/(?:الى|إلى|يصير|تصير|باسم|اسمه|صار)\s+(.+)$/)
  if (!m) return null
  return m[1].replace(/[«»"'.]/g, '').trim() || null
}

function findCategory(text: string): Category | null {
  const cats = getCategories()
  let best: Category | null = null
  for (const c of cats) {
    if (text.includes(normalize(c.name_ar)) && (!best || c.name_ar.length > best.name_ar.length))
      best = c
  }
  return best
}

function findPaymentMethod(text: string): PaymentMethodRow | null {
  let best: PaymentMethodRow | null = null
  for (const m of getPaymentMethods()) {
    if (text.includes(normalize(m.name)) && (!best || m.name.length > best.name.length)) best = m
  }
  return best
}

/* ---------- WRITE skills (return an action to confirm) ---------- */

function tryPriceChange(text: string): AssistantResult | null {
  if (!has(text, 'سعر', 'بسعر')) return null
  const up = has(text, 'ارفع', 'رفع', 'زد', 'زياده', 'زود', 'اضف على')
  const down = has(text, 'خفض', 'نزل', 'قلل', 'انقص', 'خصم على السعر')
  const setTo = has(text, 'الى', 'يصير', 'تصير', '=', 'خليه', 'خلي', 'اجعل', 'حط', 'صار')
  if (!up && !down && !setTo) return null

  const product = findProduct(text)
  if (!product) return { reply: 'لم أتعرف على الصنف. اذكر اسم الصنف كما هو في القائمة.' }

  const percent = extractPercent(text)
  const amount = extractAmount(text) ?? firstNumber(text)

  let newPrice = product.price
  let how = ''
  if (percent != null && (up || down)) {
    const delta = (product.price * percent) / 100
    newPrice = up ? product.price + delta : product.price - delta
    how = `${up ? 'رفع' : 'خفض'} بنسبة ${percent}%`
  } else if (amount != null && (up || down)) {
    newPrice = up ? product.price + amount : product.price - amount
    how = `${up ? 'رفع' : 'خفض'} بمقدار ${sar(amount)}`
  } else if (amount != null && setTo) {
    newPrice = amount
    how = 'تثبيت السعر'
  } else {
    return { reply: 'كم السعر أو النسبة؟ مثال: «ارفع سعر برياني 10%» أو «خلي سعر برياني 45».' }
  }
  newPrice = Math.max(0, +newPrice.toFixed(2))

  return {
    reply: `سأغيّر سعر «${product.name_ar}» (${how}).`,
    rows: [
      { label: 'السعر الحالي', value: sar(product.price) },
      { label: 'السعر الجديد', value: sar(newPrice) },
    ],
    action: {
      summary: `تحديث سعر «${product.name_ar}» إلى ${sar(newPrice)}`,
      run: () => {
        updateProduct({ ...product, price: newPrice })
        return `تم تحديث سعر «${product.name_ar}» إلى ${sar(newPrice)}.`
      },
    },
  }
}

/** Change VAT rate, e.g. "خلي الضريبة 10%". */
function tryVat(text: string): AssistantResult | null {
  if (!has(text, 'ضريبه', 'القيمه المضافه', 'vat')) return null
  const p = extractPercent(text) ?? firstNumber(text)
  if (p == null) return { reply: 'كم نسبة الضريبة المطلوبة؟ مثال: «خلي الضريبة 15%».' }
  const rate = Math.max(0, Math.min(1, p / 100))
  return {
    reply: `سأضبط نسبة ضريبة القيمة المضافة على ${p}%.`,
    action: {
      summary: `ضبط الضريبة على ${p}%`,
      run: () => {
        saveSettings({ vatRate: rate })
        return `تم ضبط الضريبة على ${p}%.`
      },
    },
  }
}

/** Rename a product, category, payment app, brand, or store name. */
function tryRename(text: string, raw: string): AssistantResult | null {
  if (!has(text, 'غير', 'بدل', 'سم', 'عدل الاسم', 'اعد تسميه', 'اسمه')) return null
  if (has(text, 'سعر', 'مخزون', 'خصم', 'كود', 'تخزين')) return null
  const newName = extractNewName(raw)
  if (!newName) return null

  // the "old name" lives in the part before the connector
  const left = normalize(raw.replace(/(?:الى|إلى|يصير|تصير|باسم|اسمه|صار)\s+.+$/, ''))

  // brand / store name
  if (has(left, 'التطبيق', 'العلامه', 'الشعار', 'البرنامج')) {
    return renameSettingAction('العلامة', newName, () => saveSettings({ brand: newName }))
  }
  if (has(left, 'المتجر', 'المطعم', 'المحل')) {
    return renameSettingAction('اسم المتجر', newName, () => saveSettings({ name: newName }))
  }

  // payment method / delivery app
  const payMethod = findPaymentMethod(left)
  if (payMethod) {
    return renameSettingAction(`طريقة الدفع «${payMethod.name}»`, newName, () =>
      updatePaymentMethod(payMethod.id, { name: newName }),
    )
  }

  // category (check before product so "قسم المشاوي" wins)
  if (has(left, 'قسم', 'فئه', 'تصنيف')) {
    const cat = findCategory(left)
    if (cat)
      return {
        reply: `سأغيّر اسم القسم «${cat.name_ar}» إلى «${newName}».`,
        action: {
          summary: `إعادة تسمية القسم إلى «${newName}»`,
          run: () => {
            updateCategory(cat.id, newName)
            return `تم تغيير اسم القسم إلى «${newName}».`
          },
        },
      }
  }

  // product
  const product = findProduct(left)
  if (product)
    return {
      reply: `سأغيّر اسم الصنف «${product.name_ar}» إلى «${newName}».`,
      action: {
        summary: `إعادة تسمية الصنف إلى «${newName}»`,
        run: () => {
          updateProduct({ ...product, name_ar: newName })
          return `تم تغيير اسم الصنف إلى «${newName}».`
        },
      },
    }

  const cat = findCategory(left)
  if (cat)
    return {
      reply: `سأغيّر اسم القسم «${cat.name_ar}» إلى «${newName}».`,
      action: {
        summary: `إعادة تسمية القسم إلى «${newName}»`,
        run: () => {
          updateCategory(cat.id, newName)
          return `تم تغيير اسم القسم إلى «${newName}».`
        },
      },
    }

  return { reply: 'ما الذي تريد إعادة تسميته؟ اذكر اسم الصنف أو القسم أو طريقة الدفع.' }
}

function renameSettingAction(what: string, newName: string, apply: () => void): AssistantResult {
  return {
    reply: `سأغيّر ${what} إلى «${newName}».`,
    action: {
      summary: `تغيير ${what} إلى «${newName}»`,
      run: () => {
        apply()
        return `تم تغيير ${what} إلى «${newName}».`
      },
    },
  }
}

/** Add a new category, e.g. "أضف قسم العصائر". */
function tryAddCategory(text: string, raw: string): AssistantResult | null {
  if (!has(text, 'اضف قسم', 'ضيف قسm', 'ضيف قسم', 'قسم جديد', 'سوي قسم', 'انشئ قسم')) return null
  const m = raw.match(/(?:قسم|فئه)\s+(.+)$/)
  const name = m ? m[1].replace(/[«»"'.]/g, '').trim() : ''
  if (!name) return { reply: 'ما اسم القسم الجديد؟ مثال: «أضف قسم العصائر».' }
  return {
    reply: `سأنشئ قسمًا جديدًا باسم «${name}».`,
    action: {
      summary: `إنشاء قسم «${name}»`,
      run: () => {
        addCategory(name, 'utensils', '#D4AF37')
        return `تم إنشاء القسم «${name}».`
      },
    },
  }
}

/** Add a new product, e.g. "أضف صنف عصير مانجو بسعر 18 في قسم المشروبات". */
function tryAddProduct(text: string, raw: string): AssistantResult | null {
  if (!has(text, 'اضف صنف', 'ضيف صنف', 'اضف منتج', 'ضيف منتج', 'صنف جديد', 'منتج جديد')) return null
  const price = extractAmount(text) ?? extractPriceWord(raw)
  if (price == null) return { reply: 'كم سعر الصنف؟ مثال: «أضف صنف عصير مانجو بسعر 18».' }

  // name = text after "صنف/منتج", cut at the first price/category marker
  // (JS \b doesn't work with Arabic, so we cut by keyword instead)
  const nm = raw.match(/(?:صنف|منتج)\s+([^]+)/)
  const name = nm
    ? nm[1]
        .replace(/\s*(?:بسعر|سعره|سعر|بـ|في\s*قسم|ضمن\s*قسم|قسم|فئة|فئه)[^]*$/, '')
        .replace(/[«»"'.]/g, '')
        .trim()
    : ''
  if (!name) return { reply: 'ما اسم الصنف؟ مثال: «أضف صنف عصير مانجو بسعر 18 في قسم المشروبات».' }

  const cat = findCategory(normalize(raw)) ?? getCategories()[0]
  if (!cat) return { reply: 'لا توجد أقسام بعد. أنشئ قسمًا أولًا.' }

  return {
    reply: `سأضيف «${name}» بسعر ${sar(price)} إلى قسم «${cat.name_ar}».`,
    rows: [
      { label: 'الصنف', value: name },
      { label: 'السعر', value: sar(price) },
      { label: 'القسم', value: cat.name_ar },
    ],
    action: {
      summary: `إضافة «${name}» إلى «${cat.name_ar}»`,
      run: () => {
        addProduct({
          name_ar: name,
          category_id: cat.id,
          price,
          cost: +(price * 0.5).toFixed(2),
          stock: 0,
          min_stock: 10,
          status: 'active',
        })
        return `تمت إضافة «${name}» — عدّل تكلفته ومخزونه من المخزون.`
      },
    },
  }
}

function extractPriceWord(raw: string): number | null {
  const m = normalize(raw).match(/(?:بسعر|سعره|سعر|بـ)\s*(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

function tryRestock(text: string): AssistantResult | null {
  if (!has(text, 'تخزين', 'خزن', 'مخزون', 'زود الكميه', 'اضف كميه', 'تعبئه')) return null
  if (!has(text, 'تخزين', 'خزن', 'زود', 'اضف', 'عبي', 'املا')) return null

  // restock all low-stock items
  if (has(text, 'كل', 'الناقص', 'النواقص', 'الناقصه', 'كل الاصناف')) {
    const low = getLowStock()
    if (low.length === 0) return { reply: 'لا توجد أصناف ناقصة حاليًا 👍' }
    const target = firstNumber(text)
    return {
      reply: `سأعيد تخزين ${low.length} صنفًا ناقصًا حتى ${target ? `الكمية ${target}` : 'ضعف حد التنبيه'}.`,
      rows: low.slice(0, 8).map((p) => ({ label: p.name_ar, value: `${p.stock} → ${target ?? p.min_stock * 2}` })),
      action: {
        summary: `إعادة تخزين ${low.length} صنف`,
        run: () => {
          for (const p of low) {
            const goal = target ?? p.min_stock * 2
            const add = Math.max(0, Math.round(goal) - p.stock)
            if (add > 0) restock(p.id, add, 'إعادة تخزين عبر المساعد')
          }
          return `تمت إعادة تخزين ${low.length} صنفًا.`
        },
      },
    }
  }

  const product = findProduct(text)
  if (!product) return { reply: 'أي صنف تريد تخزينه؟ اذكر اسمه.' }
  const qty = firstNumber(text)
  if (!qty || qty <= 0) return { reply: `كم الكمية المضافة لـ«${product.name_ar}»؟ مثال: «خزّن ${product.name_ar} 20».` }

  return {
    reply: `سأضيف ${qty} إلى مخزون «${product.name_ar}».`,
    rows: [{ label: 'المخزون', value: `${product.stock} → ${product.stock + qty}` }],
    action: {
      summary: `إضافة ${qty} لمخزون «${product.name_ar}»`,
      run: () => {
        restock(product.id, qty, 'إعادة تخزين عبر المساعد')
        return `تمت إضافة ${qty} إلى «${product.name_ar}» (الإجمالي ${product.stock + qty}).`
      },
    },
  }
}

function tryToggleStatus(text: string): AssistantResult | null {
  const activate = has(text, 'فعل', 'شغل', 'اظهر', 'تفعيل')
  const deactivate = has(text, 'عطل', 'اوقف', 'اخف', 'تعطيل', 'الغ تفعيل')
  if (!activate && !deactivate) return null
  const product = findProduct(text)
  if (!product) return null
  const status = activate ? 'active' : 'inactive'
  const word = activate ? 'تفعيل' : 'تعطيل'
  return {
    reply: `سأقوم بـ${word} «${product.name_ar}».`,
    action: {
      summary: `${word} «${product.name_ar}»`,
      run: () => {
        updateProduct({ ...product, status })
        return `تم ${word} «${product.name_ar}».`
      },
    },
  }
}

function tryMinStock(text: string): AssistantResult | null {
  if (!has(text, 'حد التنبيه', 'الحد الادني', 'حد الطلب', 'حد المخزون')) return null
  const product = findProduct(text)
  if (!product) return null
  const n = firstNumber(text)
  if (n == null) return { reply: `كم تريد أن يكون حد التنبيه لـ«${product.name_ar}»؟` }
  return {
    reply: `سأضبط حد التنبيه لـ«${product.name_ar}» على ${n}.`,
    action: {
      summary: `حد تنبيه «${product.name_ar}» = ${n}`,
      run: () => {
        updateProduct({ ...product, min_stock: Math.round(n) })
        return `تم ضبط حد التنبيه لـ«${product.name_ar}» على ${Math.round(n)}.`
      },
    },
  }
}

function tryCreateDiscount(text: string, raw: string): AssistantResult | null {
  if (!has(text, 'كود خصم', 'انشئ كود', 'اضف كود', 'سوي كود', 'كوبون')) return null
  const percent = extractPercent(text)
  const amount = extractAmount(text)
  if (percent == null && amount == null)
    return { reply: 'كم قيمة الخصم؟ مثال: «أنشئ كود خصم VIP بنسبة 20%».' }
  // code = an uppercase latin token in the raw text, else generated
  const codeMatch = raw.match(/\b([A-Za-z][A-Za-z0-9]{2,})\b/)
  const code = (codeMatch ? codeMatch[1] : 'RIZQ' + Math.floor(100 + Math.random() * 899)).toUpperCase()
  const isPct = percent != null
  const value = (percent ?? amount)!
  return {
    reply: `سأنشئ كود خصم «${code}» (${isPct ? `${value}%` : sar(value)}).`,
    action: {
      summary: `إنشاء كود «${code}»`,
      run: () => {
        addDiscount({
          code,
          discount_type: isPct ? 'percentage' : 'fixed',
          discount_value: value,
          max_uses: null,
          expires_at: null,
        })
        return `تم إنشاء كود الخصم «${code}».`
      },
    },
  }
}

/* ---------- READ skills ---------- */

function tryReads(text: string): AssistantResult | null {
  if (has(text, 'مبيعات اليوم', 'مبيعاتي', 'كم بعت', 'بعنا اليوم', 'مبيعات النهارده') || (has(text, 'مبيعات') && has(text, 'اليوم'))) {
    const s = getTodayStats()
    return {
      reply: `مبيعات اليوم ${sar(s.sales)} من ${s.orders} طلب.`,
      rows: [
        { label: 'إجمالي المبيعات', value: sar(s.sales) },
        { label: 'عدد الطلبات', value: String(s.orders) },
        { label: 'متوسط الطلب', value: sar(s.orders ? s.sales / s.orders : 0) },
      ],
    }
  }

  if (has(text, 'ربح', 'ارباح', 'هامش', 'صافي')) {
    const s = getTodayStats()
    const margin = s.net > 0 ? (s.profit / s.net) * 100 : 0
    return {
      reply: `صافي ربح اليوم ${sar(s.profit)} بهامش ${pct(margin)}.`,
      rows: [
        { label: 'صافي المبيعات', value: sar(s.net) },
        { label: 'التكلفة', value: sar(s.cost) },
        { label: 'الربح', value: sar(s.profit) },
        { label: 'الهامش', value: pct(margin) },
      ],
    }
  }

  if (has(text, 'اسبوع', 'سبعه ايام', 'اخر ٧', 'هذا الاسبوع')) {
    const days = getDailySummaries(7)
    const total = days.reduce((a, d) => a + d.sales, 0)
    return {
      reply: `مبيعات آخر ٧ أيام ${sar(total)}.`,
      rows: days.map((d) => ({ label: d.date, value: sar(d.sales) })),
    }
  }

  if (has(text, 'اكثر', 'افضل', 'اعلى مبيع', 'الاكثر مبيع', 'الافضل', 'بيع')) {
    const top = getTopProducts(5)
    if (top.length === 0) return { reply: 'لا توجد مبيعات بعد.' }
    return {
      reply: `الأكثر مبيعًا: «${top[0].name_ar}».`,
      rows: top.map((p) => ({ label: p.name_ar, value: `${sar(p.revenue)} • ${p.qty} قطعة` })),
    }
  }

  if (has(text, 'ناقص', 'نواقص', 'مخزون', 'قارب', 'نفد', 'تنبيه')) {
    const low = getLowStock()
    if (low.length === 0) return { reply: 'كل الأصناف ضمن المستوى الآمن ✅' }
    return {
      reply: `${low.length} صنفًا يحتاج إعادة تخزين.`,
      rows: low.map((p) => ({ label: p.name_ar, value: p.stock <= 0 ? 'نفد' : `${p.stock} / ${p.min_stock}` })),
    }
  }

  if (has(text, 'طرق الدفع', 'الدفع', 'نقد', 'شبكه', 'كاش')) {
    const pay = getPaymentBreakdown('today')
    if (pay.length === 0) return { reply: 'لا توجد مدفوعات اليوم.' }
    return {
      reply: 'توزيع المدفوعات اليوم:',
      rows: pay.map((p) => ({
        label: paymentLabel(p.payment_method as PaymentMethod),
        value: `${sar(p.total)} • ${p.count} طلب`,
      })),
    }
  }

  if (has(text, 'عملاء', 'عميل', 'زبائن', 'ارقام')) {
    const c = getCustomers()
    return {
      reply: `لديك ${c.length} عميل مسجّل.`,
      rows: c.slice(0, 6).map((x) => ({ label: x.name || x.phone, value: `${sar(x.spent)} • ${x.orders} طلب` })),
    }
  }

  if (has(text, 'كم صنف', 'عدد الاصناف', 'الاصناف')) {
    const all = getProducts()
    const active = all.filter((p) => p.status === 'active').length
    return {
      reply: `لديك ${all.length} صنف (${active} متاح).`,
    }
  }

  return null
}

function help(): AssistantResult {
  return {
    reply:
      'أنا مساعد رزق الذكي — صلاحياتي كاملة على المتجر. جرّب:\n' +
      '📊 «كم مبيعات اليوم؟» • «صافي الربح» • «المخزون الناقص»\n' +
      '💰 «ارفع سعر برياني دجاج 10%» • «خلي سعر كنافة 30»\n' +
      '📦 «خزّن شيش طاووق 30» • «أعد تخزين كل الناقص» • «عطّل شاي كرك»\n' +
      '✏️ «غيّر اسم مرسول إلى هنقرستيشن» • «غيّر اسم قسم المشاوي إلى المشويات»\n' +
      '➕ «أضف قسم العصائر» • «أضف صنف عصير مانجو بسعر 18 في قسم المشروبات»\n' +
      '🏷️ «أنشئ كود خصم VIP بنسبة 20%» • «خلي الضريبة 15%» • «غيّر اسم المتجر إلى مطعمي»',
  }
}
