export type Role = 'staff' | 'owner'
/** Payment method id — dynamic; resolved to a label via the payment_methods table. */
export type PaymentMethod = string
export type PaymentKind = 'cash' | 'card' | 'delivery'
export type ConsumptionType = 'waste' | 'staff_meal'
export type OrderStatus = 'pending' | 'completed' | 'cancelled'
export type ProductStatus = 'active' | 'inactive'
export type DiscountType = 'percentage' | 'fixed'
export type StockTxType = 'sale' | 'restock' | 'adjustment'
export type OrderType = 'dine_in' | 'takeaway' | 'delivery'

export interface User {
  id: string
  name: string
  role: Role
  pin: string
  created_at: string
}

export interface Category {
  id: string
  name_ar: string
  icon: string
  color: string
  created_at: string
}

export interface Product {
  id: string
  name_ar: string
  category_id: string
  price: number
  cost: number
  stock: number
  min_stock: number
  status: ProductStatus
  created_at: string
}

export interface Order {
  id: string
  customer_name: string | null
  customer_phone: string | null
  total: number
  discount_amount: number
  vat_amount: number
  final_total: number
  payment_method: PaymentMethod
  status: OrderStatus
  created_at: string
  staff_id: string
  order_type: OrderType
  table_no: string | null
  notes: string | null
  /** sequential invoice number (ZATCA-friendly) */
  invoice_no: number | null
  /** unique invoice identifier (ZATCA UUID) */
  uuid: string | null
  /** previous invoice hash (chain) */
  prev_hash: string | null
  /** SHA-256 chained hash of this invoice */
  invoice_hash: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  total: number
  name: string | null
  note: string | null
}

export interface DiscountCode {
  id: string
  code: string
  discount_type: DiscountType
  discount_value: number
  max_uses: number | null
  uses_count: number
  expires_at: string | null
  created_at: string
}

export interface StockTransaction {
  id: string
  product_id: string
  transaction_type: StockTxType
  quantity: number
  notes: string | null
  created_at: string
}

export interface Customer {
  phone: string
  name: string | null
  first_seen: string
  last_seen: string
  orders_count: number
  total_spent: number
  tags: string | null
  notes: string | null
  marketing_opt_in: number
}

export interface PaymentMethodRow {
  id: string
  name: string
  kind: PaymentKind
  active: number
  sort: number
  created_at: string
}

export interface Consumption {
  id: string
  type: ConsumptionType
  product_id: string | null
  name: string
  quantity: number
  unit_cost: number
  total_cost: number
  notes: string | null
  staff_id: string | null
  created_at: string
}

export const CONSUMPTION_LABELS: Record<ConsumptionType, string> = {
  waste: 'هدر/تالف',
  staff_meal: 'وجبة موظف',
}

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  cash: 'نقدي',
  card: 'شبكة',
  delivery: 'توصيل',
}

export type ComplianceKind =
  | 'commercial_reg'
  | 'municipal_license'
  | 'zakat_cert'
  | 'mudad'
  | 'work_card'
  | 'gosi'
  | 'civil_defense'
  | 'permit'
  | 'other'

export interface ComplianceDoc {
  id: string
  title: string
  kind: ComplianceKind
  ref_no: string | null
  holder: string | null
  issuer: string | null
  expiry_date: string
  reminder_days: number
  notes: string | null
  created_at: string
}

export const COMPLIANCE_KIND_LABELS: Record<ComplianceKind, string> = {
  commercial_reg: 'سجل تجاري / وثيقة عمل حر',
  municipal_license: 'رخصة بلدية',
  zakat_cert: 'شهادة الزكاة والضريبة',
  mudad: 'اشتراك مدد',
  work_card: 'بطاقة عمل / إقامة',
  gosi: 'التأمينات الاجتماعية',
  civil_defense: 'رخصة الدفاع المدني',
  permit: 'تصريح',
  other: 'أخرى',
}

export interface ReportExport {
  id: string
  created_at: string
  store_name: string
  scope: string
  date_from: string | null
  date_to: string | null
  sheets: string
  orders_count: number
  total_sales: number
  exported_by: string
}

export interface CartItem {
  /** stable line id so duplicate/custom lines stay distinct */
  lineId: string
  product: Product
  quantity: number
  /** per-line manual unit price; falls back to product.price */
  unitPrice?: number
  /** kitchen/customer note, e.g. "بدون بصل" */
  note?: string
  /** true for ad-hoc items not in the catalog (no stock tracking) */
  custom?: boolean
}

/** Effective unit price for a cart line. */
export function lineUnitPrice(item: CartItem): number {
  return item.unitPrice ?? item.product.price
}

export interface AppliedDiscount {
  code: DiscountCode
  amount: number
}

/** Default labels — the live, editable labels live in config/settings. */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'نقدًا',
  akita: 'كيتا',
  merzool: 'مرسول',
  ninja: 'نينجا',
}

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  dine_in: 'محلي',
  takeaway: 'سفري',
  delivery: 'توصيل',
}

export const VAT_RATE = 0.15
