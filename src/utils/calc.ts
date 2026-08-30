import { CartItem, DiscountCode, lineUnitPrice } from '../types'
import { parseTs } from './format'
import { vatRate } from '../config/settings'

export interface CartTotals {
  subtotal: number
  discountAmount: number
  net: number
  vat: number
  total: number
}

export function cartSubtotal(items: CartItem[]): number {
  return +items.reduce((s, i) => s + lineUnitPrice(i) * i.quantity, 0).toFixed(2)
}

export function discountAmountFor(code: DiscountCode | null, subtotal: number): number {
  if (!code) return 0
  if (code.discount_type === 'percentage') {
    return +((subtotal * code.discount_value) / 100).toFixed(2)
  }
  return Math.min(code.discount_value, subtotal)
}

export function computeTotals(items: CartItem[], discount: DiscountCode | null): CartTotals {
  const subtotal = cartSubtotal(items)
  const discountAmount = discountAmountFor(discount, subtotal)
  const net = +(subtotal - discountAmount).toFixed(2)
  const vat = +(net * vatRate()).toFixed(2)
  const total = +(net + vat).toFixed(2)
  return { subtotal, discountAmount, net, vat, total }
}

export type DiscountValidation =
  | { ok: true; code: DiscountCode }
  | { ok: false; reason: string }

export function validateDiscount(code: DiscountCode | undefined): DiscountValidation {
  if (!code) return { ok: false, reason: 'كود الخصم غير موجود' }
  if (code.expires_at && parseTs(code.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'انتهت صلاحية الكود' }
  }
  if (code.max_uses != null && code.uses_count >= code.max_uses) {
    return { ok: false, reason: 'تم استنفاد عدد مرات الاستخدام' }
  }
  return { ok: true, code }
}

export function cartCost(items: CartItem[]): number {
  return +items.reduce((s, i) => s + i.product.cost * i.quantity, 0).toFixed(2)
}
