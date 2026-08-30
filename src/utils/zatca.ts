/**
 * ZATCA (هيئة الزكاة والضريبة والجمارك) — Phase 1 e-invoicing QR.
 *
 * Simplified tax invoices must carry a QR code whose payload is a
 * base64-encoded TLV (Tag-Length-Value) byte array with tags 1–5:
 *   1: seller name (UTF-8)
 *   2: VAT registration number
 *   3: invoice timestamp (ISO 8601)
 *   4: invoice total (with VAT)
 *   5: VAT amount
 * Ref: ZATCA "Guide to Developed FATOORA Compliant QR Code".
 */

export interface ZatcaQrInput {
  sellerName: string
  vatNumber: string
  /** ISO 8601 timestamp, e.g. 2026-07-04T18:30:00Z */
  timestamp: string
  /** invoice total including VAT */
  total: number
  /** total VAT amount */
  vat: number
}

function tlv(tag: number, value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value)
  if (bytes.length > 255) throw new Error(`TLV value too long for tag ${tag}`)
  const out = new Uint8Array(2 + bytes.length)
  out[0] = tag
  out[1] = bytes.length
  out.set(bytes, 2)
  return out
}

/** Build the base64 TLV payload for the ZATCA QR code. */
export function zatcaQrPayload(input: ZatcaQrInput): string {
  const parts = [
    tlv(1, input.sellerName),
    tlv(2, input.vatNumber),
    tlv(3, input.timestamp),
    tlv(4, input.total.toFixed(2)),
    tlv(5, input.vat.toFixed(2)),
  ]
  const total = parts.reduce((s, p) => s + p.length, 0)
  const buf = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    buf.set(p, offset)
    offset += p.length
  }
  let bin = ''
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
  return btoa(bin)
}
