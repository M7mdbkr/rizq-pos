import initSqlJs, { Database, SqlValue } from 'sql.js'
import { SCHEMA_SQL } from './schema'
import { seedDatabase } from './seed'
import {
  genesisHash,
  computeInvoiceHash,
  newInvoiceUuid,
  ChainFields,
} from '../utils/invoiceChain'

const IDB_NAME = 'rizq-pos'
const IDB_STORE = 'sqlite'
const IDB_KEY = 'db'

let db: Database | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

/* ---------- IndexedDB persistence ---------- */

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadBytes(): Promise<Uint8Array | null> {
  try {
    const idb = await openIdb()
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
      req.onsuccess = () => resolve((req.result as Uint8Array) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function storeBytes(bytes: Uint8Array): Promise<void> {
  const idb = await openIdb()
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Persist current DB to IndexedDB (debounced). */
export function persist(): void {
  if (!db) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (!db) return
    void storeBytes(db.export())
  }, 250)
}

/** Persist immediately (no debounce) — used on app close. */
export function flushNow(): void {
  if (!db) return
  if (saveTimer) clearTimeout(saveTimer)
  void storeBytes(db.export())
}

/* ---------- Durability: persistent storage + flush on close ---------- */

let durabilitySet = false
function setupDurability(): void {
  if (durabilitySet || typeof window === 'undefined') return
  durabilitySet = true
  // ask the browser not to evict our data under storage pressure
  try {
    void navigator.storage?.persist?.()
  } catch {
    /* not supported — ignore */
  }
  const flush = () => {
    try {
      flushNow()
    } catch {
      /* ignore */
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}

/** Whether the browser granted persistent (non-evictable) storage. */
export async function isStoragePersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false
  } catch {
    return false
  }
}

/* ---------- Backup & restore ---------- */

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const BACKUP_LS_KEYS = ['rizq-business', 'rizq-theme']

/** Build a full backup (database + settings) as a downloadable Blob. */
export function exportBackup(): Blob {
  const localStorageData: Record<string, string> = {}
  for (const k of BACKUP_LS_KEYS) {
    const v = localStorage.getItem(k)
    if (v != null) localStorageData[k] = v
  }
  const payload = {
    app: 'rizq',
    version: 1,
    exportedAt: new Date().toISOString(),
    db: db ? bytesToBase64(db.export()) : '',
    localStorage: localStorageData,
  }
  return new Blob([JSON.stringify(payload)], { type: 'application/json' })
}

/** Restore from a backup file's text. Caller should reload the app afterwards. */
export async function importBackup(text: string): Promise<void> {
  const data = JSON.parse(text)
  if (data?.app !== 'rizq' || typeof data.db !== 'string' || !data.db) {
    throw new Error('ملف النسخة الاحتياطية غير صالح')
  }
  if (data.localStorage && typeof data.localStorage === 'object') {
    for (const [k, v] of Object.entries(data.localStorage)) {
      if (typeof v === 'string') localStorage.setItem(k, v)
    }
  }
  await storeBytes(base64ToBytes(data.db))
}

/* ---------- Init ---------- */

/** Columns added after the initial schema; applied idempotently on every load. */
const MIGRATIONS = [
  "ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in'",
  'ALTER TABLE orders ADD COLUMN table_no TEXT',
  'ALTER TABLE orders ADD COLUMN notes TEXT',
  'ALTER TABLE order_items ADD COLUMN name TEXT',
  'ALTER TABLE order_items ADD COLUMN note TEXT',
  'ALTER TABLE orders ADD COLUMN invoice_no INTEGER',
  'ALTER TABLE orders ADD COLUMN uuid TEXT',
  'ALTER TABLE orders ADD COLUMN prev_hash TEXT',
  'ALTER TABLE orders ADD COLUMN invoice_hash TEXT',
]

/** Assign sequential invoice numbers (ZATCA-friendly) to any orders missing one. */
function backfillInvoiceNumbers(database: Database): void {
  const res = database.exec('SELECT COUNT(*) AS c FROM orders WHERE invoice_no IS NULL')
  const missing = res.length ? Number(res[0].values[0][0]) : 0
  if (missing === 0) return
  database.run(
    `UPDATE orders SET invoice_no = (
       SELECT COUNT(*) FROM orders o2
       WHERE o2.created_at < orders.created_at
          OR (o2.created_at = orders.created_at AND o2.rowid <= orders.rowid)
     )
     WHERE invoice_no IS NULL`,
  )
}

function runMigrations(database: Database): void {
  for (const sql of MIGRATIONS) {
    try {
      database.run(sql)
    } catch {
      // column already exists — ignore
    }
  }
}

/** Drop the legacy CHECK on orders.payment_method so custom methods can be added. */
function relaxOrdersConstraints(database: Database): void {
  const res = database.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'")
  const ddl = res.length ? String(res[0].values[0][0]) : ''
  if (!ddl.includes('CHECK(payment_method')) return
  database.run('BEGIN TRANSACTION;')
  try {
    database.run(`CREATE TABLE orders_new (
      id TEXT PRIMARY KEY,
      customer_name TEXT,
      customer_phone TEXT,
      total DECIMAL(10,2) NOT NULL,
      discount_amount DECIMAL(10,2) DEFAULT 0,
      vat_amount DECIMAL(10,2) DEFAULT 0,
      final_total DECIMAL(10,2) NOT NULL,
      payment_method TEXT,
      status TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      staff_id TEXT,
      order_type TEXT DEFAULT 'dine_in',
      table_no TEXT,
      notes TEXT,
      invoice_no INTEGER,
      uuid TEXT,
      prev_hash TEXT,
      invoice_hash TEXT
    );`)
    database.run(
      `INSERT INTO orders_new (id,customer_name,customer_phone,total,discount_amount,vat_amount,final_total,payment_method,status,created_at,staff_id,order_type,table_no,notes,invoice_no,uuid,prev_hash,invoice_hash)
       SELECT id,customer_name,customer_phone,total,discount_amount,vat_amount,final_total,payment_method,status,created_at,staff_id,order_type,table_no,notes,invoice_no,uuid,prev_hash,invoice_hash FROM orders`,
    )
    database.run('DROP TABLE orders;')
    database.run('ALTER TABLE orders_new RENAME TO orders;')
    database.run('COMMIT;')
  } catch (e) {
    database.run('ROLLBACK;')
    throw e
  }
}

/** Seed the payment-methods table (once), importing any custom labels saved earlier. */
function seedPaymentMethods(database: Database): void {
  const res = database.exec('SELECT COUNT(*) AS c FROM payment_methods')
  const count = res.length ? Number(res[0].values[0][0]) : 0
  if (count > 0) return
  // import previously-saved editable labels from localStorage if present
  let labels: Record<string, string> = {}
  try {
    const raw = localStorage.getItem('rizq-business')
    labels = raw ? JSON.parse(raw).paymentLabels ?? {} : {}
  } catch {
    labels = {}
  }
  const defaults: [string, string, string][] = [
    ['cash', labels.cash || 'نقدًا', 'cash'],
    ['card', 'شبكة (مدى)', 'card'],
    ['akita', labels.akita || 'كيتا', 'delivery'],
    ['merzool', labels.merzool || 'مرسول', 'delivery'],
    ['ninja', labels.ninja || 'نينجا', 'delivery'],
  ]
  defaults.forEach(([id, name, kind], i) => {
    database.run(
      'INSERT INTO payment_methods (id, name, kind, active, sort) VALUES (?,?,?,1,?)',
      [id, name, kind, i],
    )
  })
}

/** Build/repair the tamper-evident invoice hash chain for any rows missing it. */
function backfillInvoiceChain(database: Database): void {
  const missing = database.exec(
    'SELECT COUNT(*) AS c FROM orders WHERE uuid IS NULL OR invoice_hash IS NULL',
  )
  const count = missing.length ? Number(missing[0].values[0][0]) : 0
  if (count === 0) return

  const res = database.exec(
    `SELECT id, uuid, invoice_no, created_at, total, discount_amount, vat_amount, final_total, payment_method
     FROM orders ORDER BY invoice_no ASC`,
  )
  if (!res.length) return

  let prev = genesisHash()
  database.run('BEGIN TRANSACTION;')
  try {
    for (const row of res[0].values) {
      const [id, uuid, invoiceNo, createdAt, total, discount, vat, finalTotal, pm] = row
      const f: ChainFields = {
        id: String(id),
        uuid: uuid ? String(uuid) : newInvoiceUuid(),
        invoice_no: Number(invoiceNo),
        created_at: String(createdAt),
        total: Number(total),
        discount_amount: Number(discount ?? 0),
        vat_amount: Number(vat ?? 0),
        final_total: Number(finalTotal),
        payment_method: String(pm ?? ''),
      }
      const hash = computeInvoiceHash(f, prev)
      database.run('UPDATE orders SET uuid=$u, prev_hash=$p, invoice_hash=$h WHERE id=$id', {
        $u: f.uuid,
        $p: prev,
        $h: hash,
        $id: f.id,
      })
      prev = hash
    }
    database.run('COMMIT;')
  } catch (e) {
    database.run('ROLLBACK;')
    throw e
  }
}

/** Rebuild the customers CRM table from order history if it's empty. */
function backfillCustomers(database: Database): void {
  const row = database.exec('SELECT COUNT(*) AS c FROM customers')
  const count = row.length ? Number(row[0].values[0][0]) : 0
  if (count > 0) return
  database.run(
    `INSERT OR REPLACE INTO customers (phone, name, first_seen, last_seen, orders_count, total_spent, marketing_opt_in)
     SELECT customer_phone,
            MAX(customer_name),
            MIN(created_at),
            MAX(created_at),
            COUNT(*),
            SUM(final_total),
            1
     FROM orders
     WHERE customer_phone IS NOT NULL AND customer_phone <> '' AND status='completed'
     GROUP BY customer_phone`,
  )
}

export async function initDb(): Promise<void> {
  if (db) return
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' })
  const bytes = await loadBytes()
  if (bytes) {
    db = new SQL.Database(bytes)
    db.run(SCHEMA_SQL) // ensure new tables if schema evolved
    runMigrations(db)
    relaxOrdersConstraints(db)
    backfillInvoiceNumbers(db)
    backfillInvoiceChain(db)
    seedPaymentMethods(db)
    backfillCustomers(db)
    persist()
  } else {
    db = new SQL.Database()
    db.run(SCHEMA_SQL)
    runMigrations(db)
    relaxOrdersConstraints(db)
    seedDatabase(getDb())
    backfillInvoiceNumbers(getDb())
    backfillInvoiceChain(getDb())
    seedPaymentMethods(getDb())
    backfillCustomers(getDb())
    persist()
  }
  setupDurability()
}

export function getDb(): Database {
  if (!db) throw new Error('Database not initialised. Call initDb() first.')
  return db
}

/* ---------- Query helpers ---------- */

type Params = Record<string, SqlValue> | SqlValue[]

/** Run a query returning rows as typed objects. */
export function query<T = Record<string, SqlValue>>(
  sql: string,
  params?: Params,
): T[] {
  const stmt = getDb().prepare(sql)
  if (params) stmt.bind(params as never)
  const rows: T[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T)
  stmt.free()
  return rows
}

/** Run a single-row query. */
export function queryOne<T = Record<string, SqlValue>>(
  sql: string,
  params?: Params,
): T | null {
  const rows = query<T>(sql, params)
  return rows[0] ?? null
}

/** Execute a write statement and persist. */
export function execute(sql: string, params?: Params): void {
  const stmt = getDb().prepare(sql)
  if (params) stmt.bind(params as never)
  stmt.step()
  stmt.free()
  persist()
}

/** Reset the entire database (factory reset). */
export async function resetDb(): Promise<void> {
  const idb = await openIdb()
  await new Promise<void>((resolve) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db = null
  await initDb()
}

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
