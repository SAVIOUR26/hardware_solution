import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { query, queryOne, execute, getDatabase } from '../database';
import { format } from 'date-fns';

export interface TallyImportResult {
  success: boolean;
  customersCreated: number;
  customersUpdated: number;
  suppliersCreated: number;
  suppliersUpdated: number;
  productsCreated: number;
  productsUpdated: number;
  errors: string[];
  warnings: string[];
}

export interface TallyExportResult {
  success: boolean;
  filePath: string;
  salesVouchers: number;
  purchaseVouchers: number;
  errors: string[];
}

export interface TallySyncLog {
  id: number;
  sync_type: string;
  sync_date: string;
  file_path?: string;
  status: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  errors_count: number;
  error_log?: string;
  summary?: string;
  created_at: string;
}

/**
 * Parse Tally XML file (handles UTF-16 encoding)
 */
function parseTallyXML(filePath: string): any {
  try {
    // Read file as UTF-16
    const xmlData = fs.readFileSync(filePath, 'utf16le');

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
    });

    const result = parser.parse(xmlData);
    return result;
  } catch (error) {
    console.error('Error parsing Tally XML:', error);
    throw new Error(`Failed to parse XML file: ${error}`);
  }
}

/**
 * Extract text from Tally XML node (handles both string and object)
 */
function extractText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node.trim();
  if (node['#text']) return node['#text'].trim();
  return '';
}

/**
 * Import Ledgers as Customers or Suppliers
 */
function importLedgers(ledgers: any[]): {
  customersCreated: number;
  customersUpdated: number;
  suppliersCreated: number;
  suppliersUpdated: number;
  errors: string[];
  warnings: string[];
} {
  let customersCreated = 0;
  let customersUpdated = 0;
  let suppliersCreated = 0;
  let suppliersUpdated = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const ledger of ledgers) {
    try {
      const name = extractText(ledger['@_NAME']) || extractText(ledger.NAME);
      if (!name) {
        warnings.push('Skipping ledger with no name');
        continue;
      }

      const parent = extractText(ledger.PARENT);
      const guid = extractText(ledger.GUID);
      const openingBalance = parseFloat(extractText(ledger.OPENINGBALANCE) || '0');

      // Determine if customer or supplier based on parent group
      const isCustomer = parent?.toLowerCase().includes('sundry debtor') ||
                        parent?.toLowerCase().includes('customer');
      const isSupplier = parent?.toLowerCase().includes('sundry creditor') ||
                        parent?.toLowerCase().includes('supplier');

      if (!isCustomer && !isSupplier) {
        // Not a customer or supplier ledger, skip
        continue;
      }

      // Extract contact details
      const address = extractText(ledger.ADDRESS);
      const phone = extractText(ledger.LEDGERPHONE) || extractText(ledger.LEDGERMOBILE);
      const email = extractText(ledger.EMAIL);
      const tin = extractText(ledger.INCOMETAXNUMBER) || extractText(ledger.VATTINNUMBER);

      // Check if already exists by tally_id or name
      const existing = queryOne<any>(
        isCustomer
          ? `SELECT id FROM customers WHERE tally_id = ? OR LOWER(name) = LOWER(?)`
          : `SELECT id FROM suppliers WHERE tally_id = ? OR LOWER(name) = LOWER(?)`,
        [guid, name]
      );

      if (existing) {
        // Update existing
        if (isCustomer) {
          execute(
            `UPDATE customers
             SET tally_id = ?, address = ?, phone = ?, email = ?, tin = ?,
                 opening_balance_ugx = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [guid, address || null, phone || null, email || null, tin || null, openingBalance, existing.id]
          );
          customersUpdated++;
        } else {
          execute(
            `UPDATE suppliers
             SET tally_id = ?, address = ?, phone = ?, email = ?, tin = ?,
                 opening_balance_ugx = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [guid, address || null, phone || null, email || null, tin || null, openingBalance, existing.id]
          );
          suppliersUpdated++;
        }
      } else {
        // Create new
        if (isCustomer) {
          execute(
            `INSERT INTO customers (tally_id, name, address, phone, email, tin, opening_balance_ugx)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [guid, name, address || null, phone || null, email || null, tin || null, openingBalance]
          );
          customersCreated++;
        } else {
          execute(
            `INSERT INTO suppliers (tally_id, name, address, phone, email, tin, opening_balance_ugx)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [guid, name, address || null, phone || null, email || null, tin || null, openingBalance]
          );
          suppliersCreated++;
        }
      }
    } catch (error: any) {
      errors.push(`Error importing ledger: ${error.message}`);
    }
  }

  return { customersCreated, customersUpdated, suppliersCreated, suppliersUpdated, errors, warnings };
}

/**
 * Import Stock Items as Products
 */
function importStockItems(stockItems: any[]): {
  productsCreated: number;
  productsUpdated: number;
  errors: string[];
  warnings: string[];
} {
  let productsCreated = 0;
  let productsUpdated = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const item of stockItems) {
    try {
      const name = extractText(item['@_NAME']) || extractText(item.NAME);
      if (!name) {
        warnings.push('Skipping stock item with no name');
        continue;
      }

      const guid = extractText(item.GUID);
      const parent = extractText(item.PARENT); // Category
      const unit = extractText(item.BASEUNITS) || 'PCS';
      const openingBalance = parseFloat(extractText(item.OPENINGBALANCE) || '0');
      const openingValue = parseFloat(extractText(item.OPENINGVALUE) || '0');
      const openingRate = parseFloat(extractText(item.OPENINGRATE) || '0');

      // Calculate cost price from opening data
      const costPrice = openingBalance > 0 && openingValue > 0
        ? openingValue / openingBalance
        : openingRate || 0;

      // Check if exists
      const existing = queryOne<any>(
        `SELECT id FROM products WHERE tally_id = ? OR LOWER(name) = LOWER(?)`,
        [guid, name]
      );

      if (existing) {
        // Update existing
        execute(
          `UPDATE products
           SET tally_id = ?, category = ?, unit = ?, cost_price_ugx = ?,
               current_stock = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [guid, parent || null, unit, costPrice, openingBalance, existing.id]
        );
        productsUpdated++;
      } else {
        // Create new - estimate selling price as cost + 30% markup
        const sellingPrice = costPrice * 1.3;

        execute(
          `INSERT INTO products (tally_id, name, category, unit, cost_price_ugx, selling_price_ugx, current_stock)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [guid, name, parent || null, unit, costPrice, sellingPrice, openingBalance]
        );
        productsCreated++;
      }
    } catch (error: any) {
      errors.push(`Error importing stock item: ${error.message}`);
    }
  }

  return { productsCreated, productsUpdated, errors, warnings };
}

/**
 * Import Tally Masters (Ledgers, Stock Items)
 */
export async function importTallyMasters(
  filePath: string,
  options: {
    importCustomers?: boolean;
    importSuppliers?: boolean;
    importProducts?: boolean;
    updateExisting?: boolean;
  } = {}
): Promise<TallyImportResult> {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(() => {
      try {
        const result: TallyImportResult = {
          success: false,
          customersCreated: 0,
          customersUpdated: 0,
          suppliersCreated: 0,
          suppliersUpdated: 0,
          productsCreated: 0,
          productsUpdated: 0,
          errors: [],
          warnings: [],
        };

        // Parse XML
        const xmlData = parseTallyXML(filePath);

        // Navigate to TALLYMESSAGE array
        let tallyMessages = [];
        if (xmlData.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE) {
          const messages = xmlData.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE;
          tallyMessages = Array.isArray(messages) ? messages : [messages];
        } else {
          throw new Error('Invalid Tally XML format');
        }

        // Separate ledgers and stock items
        const ledgers = tallyMessages.filter(msg => msg.LEDGER);
        const stockItems = tallyMessages.filter(msg => msg.STOCKITEM);

        // Import ledgers
        if (options.importCustomers !== false || options.importSuppliers !== false) {
          const ledgerResults = importLedgers(
            ledgers.map(msg => msg.LEDGER)
          );
          result.customersCreated = ledgerResults.customersCreated;
          result.customersUpdated = ledgerResults.customersUpdated;
          result.suppliersCreated = ledgerResults.suppliersCreated;
          result.suppliersUpdated = ledgerResults.suppliersUpdated;
          result.errors.push(...ledgerResults.errors);
          result.warnings.push(...ledgerResults.warnings);
        }

        // Import stock items
        if (options.importProducts !== false) {
          const productResults = importStockItems(
            stockItems.map(msg => msg.STOCKITEM)
          );
          result.productsCreated = productResults.productsCreated;
          result.productsUpdated = productResults.productsUpdated;
          result.errors.push(...productResults.errors);
          result.warnings.push(...productResults.warnings);
        }

        // Log sync
        const summary = JSON.stringify({
          customersCreated: result.customersCreated,
          customersUpdated: result.customersUpdated,
          suppliersCreated: result.suppliersCreated,
          suppliersUpdated: result.suppliersUpdated,
          productsCreated: result.productsCreated,
          productsUpdated: result.productsUpdated,
        });

        execute(
          `INSERT INTO tally_sync_log (
            sync_type, sync_date, file_path, status,
            records_processed, records_created, records_updated,
            errors_count, error_log, summary
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'Import Masters',
            format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
            filePath,
            result.errors.length > 0 ? 'Partial' : 'Success',
            ledgers.length + stockItems.length,
            result.customersCreated + result.suppliersCreated + result.productsCreated,
            result.customersUpdated + result.suppliersUpdated + result.productsUpdated,
            result.errors.length,
            result.errors.length > 0 ? JSON.stringify(result.errors) : null,
            summary,
          ]
        );

        result.success = true;
        resolve(result);
      } catch (error: any) {
        console.error('Error importing Tally masters:', error);

        // Log failed sync
        execute(
          `INSERT INTO tally_sync_log (
            sync_type, sync_date, file_path, status,
            records_processed, errors_count, error_log
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            'Import Masters',
            format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
            filePath,
            'Failed',
            0,
            1,
            JSON.stringify([error.message]),
          ]
        );

        reject(error);
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
 * Export Sales Invoices as Tally Sales Vouchers
 */
export async function exportTallyVouchers(
  dateRange: { startDate: string; endDate: string },
  options: {
    exportSales?: boolean;
    exportPurchases?: boolean;
    outputPath?: string;
  } = {}
): Promise<TallyExportResult> {
  try {
    const result: TallyExportResult = {
      success: false,
      filePath: '',
      salesVouchers: 0,
      purchaseVouchers: 0,
      errors: [],
    };

    const tallyMessages: any[] = [];

    // Export Sales Invoices
    if (options.exportSales !== false) {
      const invoices = query<any>(
        `SELECT si.*, c.name as customer_name, c.tally_id as customer_tally_id
         FROM sales_invoices si
         JOIN customers c ON si.customer_id = c.id
         WHERE si.invoice_date >= ? AND si.invoice_date <= ?
         AND si.is_quotation = 0
         AND si.exported_to_tally = 0
         ORDER BY si.invoice_date`,
        [dateRange.startDate, dateRange.endDate]
      );

      for (const invoice of invoices) {
        // Get invoice items
        const items = query<any>(
          `SELECT sii.*, p.name as product_name, p.tally_id as product_tally_id
           FROM sales_invoice_items sii
           JOIN products p ON sii.product_id = p.id
           WHERE sii.invoice_id = ?`,
          [invoice.id]
        );

        // Build Tally Sales Voucher
        const voucher: any = {
          '@_VCHTYPE': 'Sales',
          '@_ACTION': 'Create',
          DATE: format(new Date(invoice.invoice_date), 'yyyyMMdd'),
          VOUCHERTYPENAME: 'Sales',
          VOUCHERNUMBER: invoice.invoice_number,
          REFERENCE: invoice.invoice_number,
          PARTYNAME: invoice.customer_name,
          'ALLLEDGERENTRIES.LIST': [
            // Customer Ledger (Debit)
            {
              LEDGERNAME: invoice.customer_name,
              ISDEEMEDPOSITIVE: 'Yes',
              AMOUNT: invoice.total_amount,
            },
            // Sales Account (Credit)
            {
              LEDGERNAME: 'Sales',
              ISDEEMEDPOSITIVE: 'No',
              AMOUNT: -invoice.total_amount,
            },
          ],
        };

        // Add inventory details
        if (items.length > 0) {
          voucher['ALLINVENTORYENTRIES.LIST'] = items.map((item: any) => ({
            STOCKITEMNAME: item.product_name,
            ISDEEMEDPOSITIVE: 'No',
            RATE: `${item.unit_price}/${invoice.currency}`,
            AMOUNT: -item.line_total,
            ACTUALQTY: `-${item.quantity}`,
            BILLEDQTY: `-${item.quantity}`,
          }));
        }

        tallyMessages.push({
          TALLYMESSAGE: {
            '@_xmlns:UDF': 'TallyUDF',
            VOUCHER: voucher,
          },
        });

        result.salesVouchers++;
      }
    }

    // Export Purchase Invoices
    if (options.exportPurchases !== false) {
      const purchases = query<any>(
        `SELECT pi.*, s.name as supplier_name, s.tally_id as supplier_tally_id
         FROM purchase_invoices pi
         JOIN suppliers s ON pi.supplier_id = s.id
         WHERE pi.purchase_date >= ? AND pi.purchase_date <= ?
         AND pi.exported_to_tally = 0
         ORDER BY pi.purchase_date`,
        [dateRange.startDate, dateRange.endDate]
      );

      for (const purchase of purchases) {
        // Get purchase items
        const items = query<any>(
          `SELECT pii.*, p.name as product_name, p.tally_id as product_tally_id
           FROM purchase_invoice_items pii
           JOIN products p ON pii.product_id = p.id
           WHERE pii.invoice_id = ?`,
          [purchase.id]
        );

        // Build Tally Purchase Voucher
        const voucher: any = {
          '@_VCHTYPE': 'Purchase',
          '@_ACTION': 'Create',
          DATE: format(new Date(purchase.purchase_date), 'yyyyMMdd'),
          VOUCHERTYPENAME: 'Purchase',
          VOUCHERNUMBER: purchase.purchase_number,
          REFERENCE: purchase.supplier_invoice_number || purchase.purchase_number,
          PARTYNAME: purchase.supplier_name,
          'ALLLEDGERENTRIES.LIST': [
            // Supplier Ledger (Credit)
            {
              LEDGERNAME: purchase.supplier_name,
              ISDEEMEDPOSITIVE: 'No',
              AMOUNT: -purchase.total_amount,
            },
            // Purchase Account (Debit)
            {
              LEDGERNAME: 'Purchase',
              ISDEEMEDPOSITIVE: 'Yes',
              AMOUNT: purchase.total_amount,
            },
          ],
        };

        // Add inventory details
        if (items.length > 0) {
          voucher['ALLINVENTORYENTRIES.LIST'] = items.map((item: any) => ({
            STOCKITEMNAME: item.product_name,
            ISDEEMEDPOSITIVE: 'Yes',
            RATE: `${item.unit_price}/${purchase.currency}`,
            AMOUNT: item.line_total,
            ACTUALQTY: item.quantity,
            BILLEDQTY: item.quantity,
          }));
        }

        tallyMessages.push({
          TALLYMESSAGE: {
            '@_xmlns:UDF': 'TallyUDF',
            VOUCHER: voucher,
          },
        });

        result.purchaseVouchers++;
      }
    }

    // Build complete XML
    const xmlData = {
      ENVELOPE: {
        HEADER: {
          TALLYREQUEST: 'Import Data',
        },
        BODY: {
          IMPORTDATA: {
            REQUESTDESC: {
              REPORTNAME: 'Vouchers',
              STATICVARIABLES: {
                SVCURRENTCOMPANY: 'Hardware Manager Pro Export',
              },
            },
            REQUESTDATA: tallyMessages,
          },
        },
      },
    };

    // Build XML
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true,
    });

    const xmlString = builder.build(xmlData);

    // Determine output path
    const userDataPath = app.getPath('userData');
    const exportsDir = path.join(userDataPath, 'tally-exports');

    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const filename = `tally_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.xml`;
    const filePath = options.outputPath || path.join(exportsDir, filename);

    // Write XML file (UTF-16)
    fs.writeFileSync(filePath, xmlString, 'utf16le');

    // Mark as exported
    if (result.salesVouchers > 0) {
      execute(
        `UPDATE sales_invoices
         SET exported_to_tally = 1, tally_export_date = CURRENT_TIMESTAMP
         WHERE invoice_date >= ? AND invoice_date <= ? AND is_quotation = 0 AND exported_to_tally = 0`,
        [dateRange.startDate, dateRange.endDate]
      );
    }

    if (result.purchaseVouchers > 0) {
      execute(
        `UPDATE purchase_invoices
         SET exported_to_tally = 1, tally_export_date = CURRENT_TIMESTAMP
         WHERE purchase_date >= ? AND purchase_date <= ? AND exported_to_tally = 0`,
        [dateRange.startDate, dateRange.endDate]
      );
    }

    // Log sync
    execute(
      `INSERT INTO tally_sync_log (
        sync_type, sync_date, file_path, status,
        records_processed, records_created, summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'Export Vouchers',
        format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        filePath,
        'Success',
        result.salesVouchers + result.purchaseVouchers,
        result.salesVouchers + result.purchaseVouchers,
        JSON.stringify({
          salesVouchers: result.salesVouchers,
          purchaseVouchers: result.purchaseVouchers,
        }),
      ]
    );

    result.success = true;
    result.filePath = filePath;

    return result;
  } catch (error: any) {
    console.error('Error exporting Tally vouchers:', error);

    // Log failed sync
    execute(
      `INSERT INTO tally_sync_log (
        sync_type, sync_date, status, errors_count, error_log
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        'Export Vouchers',
        format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        'Failed',
        1,
        JSON.stringify([error.message]),
      ]
    );

    throw error;
  }
}

/**
 * Get Tally sync history
 */
export function getTallySyncHistory(limit: number = 50): TallySyncLog[] {
  return query<TallySyncLog>(
    `SELECT * FROM tally_sync_log
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );
}

/**
 * Get sync statistics
 */
export function getTallySyncStats() {
  const totalSyncs = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM tally_sync_log`
  )?.count || 0;

  const successfulSyncs = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM tally_sync_log WHERE status = 'Success'`
  )?.count || 0;

  const lastImport = queryOne<TallySyncLog>(
    `SELECT * FROM tally_sync_log
     WHERE sync_type = 'Import Masters'
     ORDER BY created_at DESC
     LIMIT 1`
  );

  const lastExport = queryOne<TallySyncLog>(
    `SELECT * FROM tally_sync_log
     WHERE sync_type = 'Export Vouchers'
     ORDER BY created_at DESC
     LIMIT 1`
  );

  return {
    totalSyncs,
    successfulSyncs,
    lastImport,
    lastExport,
  };
}
