import { sha256 } from 'js-sha256'

/**
 * Tamper-evident invoice hash chain (ZATCA Phase-2 groundwork).
 *
 * Each completed invoice stores:
 *   - uuid          : unique invoice identifier (UUID v4)
 *   - prev_hash     : hash of the previous invoice (PIH-style chaining)
 *   - invoice_hash  : SHA-256 (base64) over the canonical invoice fields + prev_hash
 *
 * The genesis PIH follows ZATCA's convention: base64 of SHA-256("0").
 * Note: the final Phase-2 hash is computed server-side over the signed UBL XML;
 * this chain is the local integrity ledger those values will be derived from.
 */

export interface ChainFields {
  id: string
  uuid: string
  invoice_no: number
  created_at: string
  total: number
  discount_amount: number
  vat_amount: number
  final_total: number
  payment_method: string
}

function toBase64(bytes: number[]): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** Genesis previous-hash: base64(SHA-256("0")) — ZATCA first-invoice convention. */
export function genesisHash(): string {
  return toBase64(sha256.array('0'))
}

/** Canonical, order-stable string for hashing one invoice. */
export function canonicalInvoice(f: ChainFields, prevHash: string): string {
  return [
    f.id,
    f.uuid,
    String(f.invoice_no),
    f.created_at,
    f.total.toFixed(2),
    f.discount_amount.toFixed(2),
    f.vat_amount.toFixed(2),
    f.final_total.toFixed(2),
    f.payment_method,
    prevHash,
  ].join('|')
}

/** Compute the chained hash for one invoice. */
export function computeInvoiceHash(f: ChainFields, prevHash: string): string {
  return toBase64(sha256.array(canonicalInvoice(f, prevHash)))
}

export function newInvoiceUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // fallback (very old browsers)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
