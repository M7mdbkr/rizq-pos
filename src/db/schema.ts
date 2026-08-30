export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT CHECK(role IN ('staff', 'owner')),
  pin TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  category_id TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 10,
  status TEXT CHECK(status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT,
  customer_phone TEXT,
  total DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  vat_amount DECIMAL(10,2) DEFAULT 0,
  final_total DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  status TEXT CHECK(status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  staff_id TEXT,
  FOREIGN KEY(staff_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS discount_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT CHECK(discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  transaction_type TEXT CHECK(transaction_type IN ('sale', 'restock', 'adjustment')),
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS daily_ledger (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  total_sales DECIMAL(10,2),
  total_vat DECIMAL(10,2),
  total_discount DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  gross_profit DECIMAL(10,2),
  payment_breakdown TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY,
  name TEXT,
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  orders_count INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  tags TEXT,
  notes TEXT,
  marketing_opt_in INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS report_exports (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  store_name TEXT,
  scope TEXT,
  date_from TEXT,
  date_to TEXT,
  sheets TEXT,
  orders_count INTEGER,
  total_sales DECIMAL(10,2),
  exported_by TEXT
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT DEFAULT 'delivery',
  active INTEGER DEFAULT 1,
  sort INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_docs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT DEFAULT 'other',
  ref_no TEXT,
  holder TEXT,
  issuer TEXT,
  expiry_date TEXT NOT NULL,
  reminder_days INTEGER DEFAULT 30,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_consumption (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  product_id TEXT,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  staff_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`
