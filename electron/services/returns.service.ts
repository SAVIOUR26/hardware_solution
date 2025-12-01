import { query, queryOne, execute, getDatabase } from '../database';
import { format } from 'date-fns';

export interface SalesReturn {
  id: number;
  return_number: string;
  sales_invoice_id: number;
  customer_id: number;
  return_date: string;
  reason: string;
  notes?: string;
  currency: string;
  exchange_rate: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  total_amount_ugx: number;
  refund_status: 'Pending' | 'Completed' | 'Rejected';
  refund_method?: string;
  refund_date?: string;
  exported_to_tally: number;
  created_at: string;
}

export interface SalesReturnItem {
  id: number;
  return_id: number;
  sales_invoice_item_id: number;
  product_id: number;
  product_name: string;
  quantity_returned: number;
  original_quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
  condition: 'Good' | 'Damaged' | 'Defective';
  notes?: string;
}

export interface CreateSalesReturnInput {
  sales_invoice_id: number;
  return_date: string;
  reason: string;
  notes?: string;
  items: {
    sales_invoice_item_id: number;
    quantity_returned: number;
    condition: 'Good' | 'Damaged' | 'Defective';
    notes?: string;
  }[];
  refund_method?: string;
  refund_status?: 'Pending' | 'Completed' | 'Rejected';
}

/**
 * Generate return number
 */
function generateReturnNumber(date: string): string {
  const dateStr = format(new Date(date), 'yyyyMMdd');

  // Get count of returns on this date
  const count = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM sales_returns WHERE return_date = ?`,
    [date]
  );

  const sequence = (count?.count || 0) + 1;
  return `RET-${dateStr}-${sequence.toString().padStart(4, '0')}`;
}

/**
 * Create a sales return
 */
export async function createSalesReturn(input: CreateSalesReturnInput): Promise<SalesReturn> {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(() => {
      try {
        // Get original invoice details
        const invoice = queryOne<any>(
          `SELECT * FROM sales_invoices WHERE id = ?`,
          [input.sales_invoice_id]
        );

        if (!invoice) {
          throw new Error('Sales invoice not found');
        }

        // Validate: Cannot return more than sold
        for (const item of input.items) {
          const invoiceItem = queryOne<any>(
            `SELECT quantity, quantity_delivered FROM sales_invoice_items WHERE id = ?`,
            [item.sales_invoice_item_id]
          );

          if (!invoiceItem) {
            throw new Error('Invoice item not found');
          }

          // Get already returned quantity
          const returnedQty = queryOne<{ total: number }>(
            `SELECT COALESCE(SUM(quantity_returned), 0) as total
             FROM sales_return_items
             WHERE sales_invoice_item_id = ?`,
            [item.sales_invoice_item_id]
          );

          const alreadyReturned = returnedQty?.total || 0;
          const availableForReturn = invoiceItem.quantity - alreadyReturned;

          if (item.quantity_returned > availableForReturn) {
            throw new Error(
              `Cannot return ${item.quantity_returned}. Only ${availableForReturn} available for return.`
            );
          }
        }

        // Generate return number
        const return_number = generateReturnNumber(input.return_date);

        // Calculate totals from items
        let subtotal = 0;
        let tax_amount = 0;

        const itemsWithDetails = input.items.map(item => {
          const invoiceItem = queryOne<any>(
            `SELECT * FROM sales_invoice_items WHERE id = ?`,
            [item.sales_invoice_item_id]
          );

          const baseAmount = item.quantity_returned * invoiceItem.unit_price;
          const discountAmount = baseAmount * (invoiceItem.discount_percent / 100);
          const taxableAmount = baseAmount - discountAmount;
          const itemTax = taxableAmount * (invoiceItem.tax_percent / 100);
          const lineTotal = taxableAmount + itemTax;

          subtotal += taxableAmount;
          tax_amount += itemTax;

          return {
            ...item,
            ...invoiceItem,
            line_total: lineTotal,
          };
        });

        const total_amount = subtotal + tax_amount;
        const total_amount_ugx = invoice.currency === 'USD'
          ? total_amount * invoice.exchange_rate
          : total_amount;

        // Insert sales return
        const returnResult = execute(
          `INSERT INTO sales_returns (
            return_number, sales_invoice_id, customer_id, return_date,
            reason, notes, currency, exchange_rate,
            subtotal, tax_amount, total_amount, total_amount_ugx,
            refund_status, refund_method
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            return_number,
            input.sales_invoice_id,
            invoice.customer_id,
            input.return_date,
            input.reason,
            input.notes || null,
            invoice.currency,
            invoice.exchange_rate,
            subtotal,
            tax_amount,
            total_amount,
            total_amount_ugx,
            input.refund_status || 'Pending',
            input.refund_method || null,
          ]
        );

        const return_id = returnResult.lastInsertRowid as number;

        // Insert return items and update stock
        for (const item of itemsWithDetails) {
          execute(
            `INSERT INTO sales_return_items (
              return_id, sales_invoice_item_id, product_id, product_name,
              quantity_returned, original_quantity, unit_price,
              discount_percent, tax_percent, line_total, condition, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              return_id,
              item.sales_invoice_item_id,
              item.product_id,
              item.product_name,
              item.quantity_returned,
              item.quantity,
              item.unit_price,
              item.discount_percent,
              item.tax_percent,
              item.line_total,
              item.condition,
              item.notes || null,
            ]
          );

          // Update stock based on condition
          if (item.condition === 'Good') {
            // Return to available stock
            execute(
              `UPDATE products
               SET current_stock = current_stock + ?
               WHERE id = ?`,
              [item.quantity_returned, item.product_id]
            );
          } else {
            // Damaged/Defective - don't return to available stock
            // Could add to a damaged stock field if needed
            console.log(`Item ${item.product_name} returned as ${item.condition} - not added back to stock`);
          }

          // Create stock adjustment record
          execute(
            `INSERT INTO stock_adjustments (product_id, quantity, reason, notes)
             VALUES (?, ?, ?, ?)`,
            [
              item.product_id,
              item.condition === 'Good' ? item.quantity_returned : 0,
              `Sales Return - ${input.reason}`,
              `Return #${return_number} - Condition: ${item.condition}`,
            ]
          );
        }

        // Get the created return
        const createdReturn = queryOne<SalesReturn>(
          `SELECT * FROM sales_returns WHERE id = ?`,
          [return_id]
        );

        resolve(createdReturn!);
      } catch (error) {
        console.error('Error creating sales return:', error);
        throw error;
      }
    });

    try {
      transaction();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get sales return by ID
 */
export function getSalesReturn(id: number): SalesReturn | null {
  return queryOne<SalesReturn>(
    `SELECT * FROM sales_returns WHERE id = ?`,
    [id]
  );
}

/**
 * Get sales return items
 */
export function getSalesReturnItems(return_id: number): SalesReturnItem[] {
  return query<SalesReturnItem>(
    `SELECT * FROM sales_return_items WHERE return_id = ? ORDER BY id`,
    [return_id]
  );
}

/**
 * List sales returns with filters
 */
export function listSalesReturns(params: {
  customer_id?: number;
  refund_status?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}): { returns: SalesReturn[]; total: number } {
  let whereClause = 'WHERE 1=1';
  const queryParams: any[] = [];

  if (params.customer_id) {
    whereClause += ' AND customer_id = ?';
    queryParams.push(params.customer_id);
  }

  if (params.refund_status) {
    whereClause += ' AND refund_status = ?';
    queryParams.push(params.refund_status);
  }

  if (params.start_date) {
    whereClause += ' AND return_date >= ?';
    queryParams.push(params.start_date);
  }

  if (params.end_date) {
    whereClause += ' AND return_date <= ?';
    queryParams.push(params.end_date);
  }

  // Get total count
  const countResult = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM sales_returns ${whereClause}`,
    queryParams
  );

  const total = countResult?.count || 0;

  // Get returns
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  const returns = query<SalesReturn>(
    `SELECT sr.*,
            c.name as customer_name,
            si.invoice_number
     FROM sales_returns sr
     JOIN customers c ON sr.customer_id = c.id
     JOIN sales_invoices si ON sr.sales_invoice_id = si.id
     ${whereClause}
     ORDER BY sr.return_date DESC, sr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  return { returns, total };
}

/**
 * Update refund status
 */
export function updateRefundStatus(
  return_id: number,
  refund_status: 'Pending' | 'Completed' | 'Rejected',
  refund_method?: string,
  refund_date?: string
): void {
  execute(
    `UPDATE sales_returns
     SET refund_status = ?,
         refund_method = ?,
         refund_date = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [refund_status, refund_method || null, refund_date || null, return_id]
  );
}

/**
 * Get returnable items from an invoice
 */
export function getReturnableItems(invoice_id: number): any[] {
  return query<any>(
    `SELECT
      sii.*,
      COALESCE(SUM(sri.quantity_returned), 0) as quantity_already_returned,
      sii.quantity - COALESCE(SUM(sri.quantity_returned), 0) as quantity_available_for_return
     FROM sales_invoice_items sii
     LEFT JOIN sales_return_items sri ON sri.sales_invoice_item_id = sii.id
     WHERE sii.invoice_id = ?
     GROUP BY sii.id
     HAVING quantity_available_for_return > 0`,
    [invoice_id]
  );
}

/**
 * Get returns for a specific invoice
 */
export function getInvoiceReturns(invoice_id: number): SalesReturn[] {
  return query<SalesReturn>(
    `SELECT * FROM sales_returns WHERE sales_invoice_id = ? ORDER BY return_date DESC`,
    [invoice_id]
  );
}
