-- ============================================================================
-- SALES RETURNS (Credit Notes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number TEXT UNIQUE NOT NULL, -- Auto-generated: RET-YYYYMMDD-0001
  sales_invoice_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,

  -- Return details
  return_date DATE NOT NULL,
  reason TEXT NOT NULL, -- Damaged, Wrong Item, Customer Request, etc.
  notes TEXT,

  -- Currency and amounts (from original invoice)
  currency TEXT NOT NULL DEFAULT 'UGX',
  exchange_rate REAL DEFAULT 1,

  subtotal REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  total_amount_ugx REAL DEFAULT 0, -- Converted to UGX for reporting

  -- Refund tracking
  refund_status TEXT DEFAULT 'Pending', -- Pending, Completed, Rejected
  refund_method TEXT, -- Cash, Mobile Money, Bank, Credit Note
  refund_date DATE,

  -- Tally sync
  exported_to_tally INTEGER DEFAULT 0,
  tally_export_date DATETIME,

  -- Audit
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE RESTRICT,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_returns_number ON sales_returns(return_number);
CREATE INDEX IF NOT EXISTS idx_returns_invoice ON sales_returns(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer ON sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_returns_date ON sales_returns(return_date);
CREATE INDEX IF NOT EXISTS idx_returns_status ON sales_returns(refund_status);

-- ============================================================================
-- SALES RETURN ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL,
  sales_invoice_item_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,

  -- Item details (snapshot from original sale)
  product_name TEXT NOT NULL,
  quantity_returned REAL NOT NULL,
  original_quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  discount_percent REAL DEFAULT 0,
  tax_percent REAL DEFAULT 0,
  line_total REAL NOT NULL,

  -- Return condition
  condition TEXT DEFAULT 'Good', -- Good, Damaged, Defective
  notes TEXT,

  -- Audit
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_invoice_item_id) REFERENCES sales_invoice_items(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_return_items_return ON sales_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_invoice_item ON sales_return_items(sales_invoice_item_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product ON sales_return_items(product_id);
