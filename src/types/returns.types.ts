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
  // Joined fields
  customer_name?: string;
  invoice_number?: string;
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

export interface ReturnableItem {
  id: number; // sales_invoice_item_id
  invoice_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  quantity_already_returned: number;
  quantity_available_for_return: number;
}

export interface CreateReturnInput {
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
