import Anthropic from '@anthropic-ai/sdk'
import {
  getProducts,
  getCategories,
  getLowStock,
  getTopProducts,
  getTodayStats,
  getDailySummaries,
  getCrmCustomers,
  getPaymentMethods,
  updateProduct,
  addProduct,
  restock,
  addCategory,
  updateCategory,
  addDiscount,
  addPaymentMethod,
  updatePaymentMethod,
  addConsumption,
  getComplianceDocs,
  addComplianceDoc,
} from '../db/repo'
import { getSettings, saveSettings } from '../config/settings'
import { sar } from '../utils/format'
import { Product, PaymentKind } from '../types'

export interface AiResult {
  reply: string
  actions: string[]
  /** raw Anthropic message history to carry into the next turn */
  history: Anthropic.MessageParam[]
}

export function aiEnabled(): boolean {
  return !!getSettings().anthropicKey
}

function client(): Anthropic {
  return new Anthropic({ apiKey: getSettings().anthropicKey, dangerouslyAllowBrowser: true })
}

/* ------------------------------------------------------------------ */
/* tools                                                              */
/* ------------------------------------------------------------------ */

const tools: Anthropic.Tool[] = [
  {
    name: 'get_dashboard',
    description: 'ملخص أداء اليوم: المبيعات، صافي الربح، عدد الطلبات، عدد الأصناف الناقصة، أعلى صنف مبيعًا.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_products',
    description: 'قائمة الأصناف مع معرفاتها وأسعارها وتكلفتها ومخزونها وحالتها. استخدمها لمعرفة product_id قبل أي تعديل.',
    input_schema: {
      type: 'object',
      properties: { search: { type: 'string', description: 'كلمة بحث في الاسم (اختياري)' } },
    },
  },
  {
    name: 'list_categories',
    description: 'قائمة الأقسام مع معرفاتها.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_payment_methods',
    description: 'قائمة طرق الدفع/التوصيل مع معرفاتها.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'sales_report',
    description: 'ملخص المبيعات اليومية لعدد أيام.',
    input_schema: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'عدد الأيام (افتراضي 7)' } },
    },
  },
  {
    name: 'get_customers',
    description: 'قائمة العملاء لأغراض التسويق (الاسم، الجوال، الإنفاق، عدد الطلبات).',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', description: 'عدد العملاء (افتراضي 10)' } },
    },
  },
  {
    name: 'update_product',
    description: 'تعديل صنف موجود. مرّر product_id والحقول المراد تغييرها فقط.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        name: { type: 'string' },
        price: { type: 'number' },
        cost: { type: 'number' },
        stock: { type: 'integer' },
        min_stock: { type: 'integer' },
        status: { type: 'string', enum: ['active', 'inactive'] },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'restock_product',
    description: 'إضافة كمية لمخزون صنف.',
    input_schema: {
      type: 'object',
      properties: { product_id: { type: 'string' }, quantity: { type: 'integer' } },
      required: ['product_id', 'quantity'],
    },
  },
  {
    name: 'add_product',
    description: 'إضافة صنف جديد إلى قسم.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        category_id: { type: 'string' },
        price: { type: 'number' },
        cost: { type: 'number' },
        stock: { type: 'integer' },
        min_stock: { type: 'integer' },
      },
      required: ['name', 'category_id', 'price'],
    },
  },
  {
    name: 'add_category',
    description: 'إنشاء قسم جديد.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'rename_category',
    description: 'تغيير اسم قسم.',
    input_schema: {
      type: 'object',
      properties: { category_id: { type: 'string' }, name: { type: 'string' } },
      required: ['category_id', 'name'],
    },
  },
  {
    name: 'create_discount',
    description: 'إنشاء كود خصم.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        type: { type: 'string', enum: ['percentage', 'fixed'] },
        value: { type: 'number' },
        max_uses: { type: 'integer' },
        expires_at: { type: 'string', description: 'تاريخ الانتهاء YYYY-MM-DD (اختياري)' },
      },
      required: ['code', 'type', 'value'],
    },
  },
  {
    name: 'set_vat_rate',
    description: 'ضبط نسبة ضريبة القيمة المضافة.',
    input_schema: {
      type: 'object',
      properties: { percent: { type: 'number', description: 'مثال 15' } },
      required: ['percent'],
    },
  },
  {
    name: 'add_payment_method',
    description: 'إضافة طريقة دفع أو تطبيق توصيل.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        kind: { type: 'string', enum: ['cash', 'card', 'delivery'] },
      },
      required: ['name'],
    },
  },
  {
    name: 'rename_payment_method',
    description: 'تغيير اسم طريقة دفع.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' } },
      required: ['id', 'name'],
    },
  },
  {
    name: 'set_business_info',
    description: 'تعديل بيانات المتجر (الاسم، العلامة، الجوال، العنوان، الرقم الضريبي، نص الفاتورة).',
    input_schema: {
      type: 'object',
      properties: {
        brand: { type: 'string' },
        name: { type: 'string' },
        phone: { type: 'string' },
        address: { type: 'string' },
        vatNumber: { type: 'string' },
        receiptFooter: { type: 'string' },
      },
    },
  },
  {
    name: 'list_compliance_docs',
    description:
      'قائمة الوثائق والتصاريح الرسمية (سجل تجاري، رخصة بلدية، بطاقات عمل، مدد، تأمينات…) مع تواريخ انتهائها والأيام المتبقية.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'add_compliance_doc',
    description: 'إضافة وثيقة/تصريح لمتابعة تاريخ انتهائه.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        kind: {
          type: 'string',
          enum: [
            'commercial_reg',
            'municipal_license',
            'zakat_cert',
            'mudad',
            'work_card',
            'gosi',
            'civil_defense',
            'permit',
            'other',
          ],
        },
        expiry_date: { type: 'string', description: 'YYYY-MM-DD' },
        holder: { type: 'string', description: 'صاحب الوثيقة (اختياري)' },
        reminder_days: { type: 'integer', description: 'التنبيه قبل كم يوم (افتراضي 30)' },
      },
      required: ['title', 'expiry_date'],
    },
  },
  {
    name: 'log_consumption',
    description: 'تسجيل هدر/تالف أو وجبة موظف (يُخصم من المخزون ويُحتسب كتكلفة).',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['waste', 'staff_meal'] },
        product_id: { type: 'string', description: 'لصنف من القائمة (اختياري)' },
        name: { type: 'string', description: 'اسم صنف مخصص إن لم يكن في القائمة' },
        quantity: { type: 'integer' },
        unit_cost: { type: 'number' },
      },
      required: ['type', 'quantity'],
    },
  },
]

/* ------------------------------------------------------------------ */
/* tool executor                                                      */
/* ------------------------------------------------------------------ */

type In = Record<string, unknown>
const str = (v: unknown) => (v == null ? '' : String(v))
const numOf = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v)))

function findProduct(id: string): Product | undefined {
  return getProducts().find((p) => p.id === id)
}

interface ToolOutcome {
  result: string
  action?: string
}

function runTool(name: string, input: In): ToolOutcome {
  switch (name) {
    case 'get_dashboard': {
      const s = getTodayStats()
      const low = getLowStock()
      const top = getTopProducts(1)[0]
      return {
        result: JSON.stringify({
          مبيعات_اليوم: s.sales,
          صافي_الربح: s.profit,
          الطلبات: s.orders,
          الخصومات: s.discount,
          أصناف_ناقصة: low.length,
          الأعلى_مبيعًا: top?.name_ar ?? null,
        }),
      }
    }
    case 'list_products': {
      const q = str(input.search).trim()
      const rows = getProducts()
        .filter((p) => !q || p.name_ar.includes(q))
        .slice(0, 50)
        .map((p) => ({
          id: p.id,
          الاسم: p.name_ar,
          السعر: p.price,
          التكلفة: p.cost,
          المخزون: p.stock,
          الحالة: p.status,
          category_id: p.category_id,
        }))
      return { result: JSON.stringify(rows) }
    }
    case 'list_categories':
      return {
        result: JSON.stringify(getCategories().map((c) => ({ id: c.id, الاسم: c.name_ar }))),
      }
    case 'list_payment_methods':
      return {
        result: JSON.stringify(
          getPaymentMethods().map((m) => ({ id: m.id, الاسم: m.name, النوع: m.kind, مفعّل: m.active })),
        ),
      }
    case 'sales_report': {
      const days = (input.days as number) || 7
      return { result: JSON.stringify(getDailySummaries(days)) }
    }
    case 'get_customers': {
      const limit = (input.limit as number) || 10
      const rows = getCrmCustomers()
        .slice(0, limit)
        .map((c) => ({ الاسم: c.name, الجوال: c.phone, الإنفاق: c.total_spent, الطلبات: c.orders_count }))
      return { result: JSON.stringify(rows) }
    }
    case 'update_product': {
      const p = findProduct(str(input.product_id))
      if (!p) return { result: 'لم يتم العثور على الصنف. استخدم list_products.' }
      const next: Product = {
        ...p,
        name_ar: input.name != null ? str(input.name) : p.name_ar,
        price: input.price != null ? numOf(input.price) : p.price,
        cost: input.cost != null ? numOf(input.cost) : p.cost,
        stock: input.stock != null ? Math.round(numOf(input.stock)) : p.stock,
        min_stock: input.min_stock != null ? Math.round(numOf(input.min_stock)) : p.min_stock,
        status: (input.status as Product['status']) ?? p.status,
      }
      updateProduct(next)
      return { result: 'تم التحديث.', action: `تحديث «${next.name_ar}» (السعر ${sar(next.price)})` }
    }
    case 'restock_product': {
      const p = findProduct(str(input.product_id))
      if (!p) return { result: 'لم يتم العثور على الصنف.' }
      const q = Math.round(numOf(input.quantity))
      restock(p.id, q, 'تخزين عبر المساعد الذكي')
      return { result: `أصبح المخزون ${p.stock + q}.`, action: `تخزين ${q} لـ«${p.name_ar}»` }
    }
    case 'add_product': {
      const cat = getCategories().find((c) => c.id === str(input.category_id))
      if (!cat) return { result: 'القسم غير موجود. استخدم list_categories.' }
      const price = numOf(input.price)
      addProduct({
        name_ar: str(input.name),
        category_id: cat.id,
        price,
        cost: input.cost != null ? numOf(input.cost) : +(price * 0.5).toFixed(2),
        stock: input.stock != null ? Math.round(numOf(input.stock)) : 0,
        min_stock: input.min_stock != null ? Math.round(numOf(input.min_stock)) : 10,
        status: 'active',
      })
      return { result: 'تمت الإضافة.', action: `إضافة «${str(input.name)}» إلى «${cat.name_ar}»` }
    }
    case 'add_category':
      addCategory(str(input.name), 'utensils', '#D4AF37')
      return { result: 'تم إنشاء القسم.', action: `إنشاء قسم «${str(input.name)}»` }
    case 'rename_category':
      updateCategory(str(input.category_id), str(input.name))
      return { result: 'تم تغيير الاسم.', action: `إعادة تسمية قسم إلى «${str(input.name)}»` }
    case 'create_discount': {
      const expires = input.expires_at ? `${str(input.expires_at)} 23:59:59` : null
      addDiscount({
        code: str(input.code).toUpperCase(),
        discount_type: input.type === 'fixed' ? 'fixed' : 'percentage',
        discount_value: numOf(input.value),
        max_uses: input.max_uses != null ? Math.round(numOf(input.max_uses)) : null,
        expires_at: expires,
      })
      return { result: 'تم إنشاء الكود.', action: `كود خصم «${str(input.code).toUpperCase()}»` }
    }
    case 'set_vat_rate': {
      const rate = Math.max(0, Math.min(1, numOf(input.percent) / 100))
      saveSettings({ vatRate: rate })
      return { result: 'تم ضبط الضريبة.', action: `ضبط الضريبة على ${numOf(input.percent)}%` }
    }
    case 'add_payment_method':
      addPaymentMethod(str(input.name), (input.kind as PaymentKind) || 'delivery')
      return { result: 'تمت الإضافة.', action: `إضافة طريقة دفع «${str(input.name)}»` }
    case 'rename_payment_method':
      updatePaymentMethod(str(input.id), { name: str(input.name) })
      return { result: 'تم تغيير الاسم.', action: `إعادة تسمية طريقة دفع إلى «${str(input.name)}»` }
    case 'set_business_info': {
      const patch: Record<string, string> = {}
      for (const k of ['brand', 'name', 'phone', 'address', 'vatNumber', 'receiptFooter'])
        if (input[k] != null) patch[k] = str(input[k])
      saveSettings(patch)
      return { result: 'تم حفظ بيانات المتجر.', action: 'تعديل بيانات المتجر' }
    }
    case 'list_compliance_docs': {
      const rows = getComplianceDocs().map((d) => ({
        الوثيقة: d.title,
        النوع: d.kind,
        صاحبها: d.holder,
        تاريخ_الانتهاء: d.expiry_date,
        الأيام_المتبقية: d.days_left,
      }))
      return { result: JSON.stringify(rows) }
    }
    case 'add_compliance_doc': {
      addComplianceDoc({
        title: str(input.title),
        kind: (input.kind as never) || 'other',
        expiryDate: str(input.expiry_date),
        holder: str(input.holder),
        reminderDays: input.reminder_days != null ? Math.round(numOf(input.reminder_days)) : 30,
      })
      return { result: 'تمت الإضافة.', action: `متابعة وثيقة «${str(input.title)}»` }
    }
    case 'log_consumption': {
      const p = input.product_id ? findProduct(str(input.product_id)) : undefined
      const nm = p?.name_ar ?? str(input.name)
      if (!nm) return { result: 'حدد الصنف أو اسمه.' }
      const qty = Math.round(numOf(input.quantity))
      const uc = input.unit_cost != null ? numOf(input.unit_cost) : (p?.cost ?? 0)
      addConsumption({
        type: input.type === 'staff_meal' ? 'staff_meal' : 'waste',
        productId: p?.id ?? null,
        name: nm,
        quantity: qty,
        unitCost: uc,
        notes: 'عبر المساعد الذكي',
        staffId: '',
      })
      const label = input.type === 'staff_meal' ? 'وجبة موظف' : 'هدر'
      return { result: 'تم التسجيل.', action: `تسجيل ${label}: ${qty} × «${nm}»` }
    }
    default:
      return { result: `أداة غير معروفة: ${name}` }
  }
}

/* ------------------------------------------------------------------ */
/* agent loop                                                         */
/* ------------------------------------------------------------------ */

function systemPrompt(): string {
  const biz = getSettings()
  const today = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return [
    `أنت «مساعد رزق الذكي» — المدير التشغيلي ومسؤول نظام الكاشير لـ«${biz.name}».`,
    `لديك صلاحيات كاملة لإدارة المتجر عبر الأدوات المتاحة: الأسعار، المخزون، الأصناف، الأقسام، الخصومات، الضريبة، طرق الدفع، بيانات المتجر، الهدر ووجبات العمال، والتقارير والتسويق.`,
    `التاريخ اليوم: ${today}. العملة: الريال السعودي.`,
    `قواعد:`,
    `- نفّذ ما يطلبه المالك مباشرة باستخدام الأدوات؛ أنت المسؤول.`,
    `- قبل تعديل أو حذف صنف/قسم/طريقة دفع، استخدم أدوات list_* لمعرفة المعرف الصحيح (id).`,
    `- بعد التنفيذ، أعطِ ردًا عربيًا موجزًا يؤكد ما تم بالأرقام.`,
    `- إذا طلب تعديل شيفرة البرنامج نفسه أو ميزة غير متاحة بالأدوات، وضّح أنك تدير البيانات والإعدادات داخل التطبيق ولا تعدّل الشيفرة، واقترح البديل.`,
    `- كن دقيقًا بالأرقام ولا تختلق بيانات؛ اعتمد على نتائج الأدوات.`,
  ].join('\n')
}

export async function runAiAssistant(
  userText: string,
  history: Anthropic.MessageParam[] = [],
): Promise<AiResult> {
  const c = client()
  const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: userText }]
  const actions: string[] = []

  for (let i = 0; i < 8; i++) {
    const res = await c.messages.create({
      model: getSettings().aiModel || 'claude-opus-4-8',
      max_tokens: 8000,
      system: systemPrompt(),
      tools,
      thinking: { type: 'adaptive' },
      messages,
    })
    messages.push({ role: 'assistant', content: res.content })

    if (res.stop_reason !== 'tool_use') {
      const reply = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()
      return { reply: reply || 'تم.', actions, history: messages }
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of res.content) {
      if (block.type === 'tool_use') {
        const out = runTool(block.name, (block.input ?? {}) as In)
        if (out.action) actions.push(out.action)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: out.result })
      }
    }
    messages.push({ role: 'user', content: toolResults })
  }

  return { reply: 'تم تنفيذ ما أمكن، لكن العملية احتاجت خطوات كثيرة — جرّب صياغة أوضح.', actions, history: messages }
}

/** Verify the API key by sending a tiny request. */
export async function testAiKey(): Promise<{ ok: boolean; error?: string }> {
  try {
    await client().messages.create({
      model: getSettings().aiModel || 'claude-opus-4-8',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'قل: تم' }],
    })
    return { ok: true }
  } catch (e) {
    const err = e as { status?: number; message?: string }
    if (err.status === 401) return { ok: false, error: 'مفتاح API غير صحيح' }
    return { ok: false, error: err.message || 'تعذّر الاتصال' }
  }
}
