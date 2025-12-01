import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { RotateCcw, Save, Package, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ReturnableItem, CreateReturnInput } from '@/types/returns.types';

interface ReturnItem extends ReturnableItem {
  quantity_to_return: number;
  condition: 'Good' | 'Damaged' | 'Defective';
  notes: string;
  selected: boolean;
}

function NewReturn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invoiceId = parseInt(searchParams.get('invoiceId') || '0');

  const [invoice, setInvoice] = useState<any>(null);
  const [returnableItems, setReturnableItems] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form data
  const [returnDate, setReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState('Cash');
  const [refundStatus, setRefundStatus] = useState<'Pending' | 'Completed'>('Pending');

  // Fetch invoice and returnable items
  useEffect(() => {
    const fetchData = async () => {
      if (!invoiceId) {
        toast.error('Invalid invoice ID');
        navigate('/sales');
        return;
      }

      try {
        setLoading(true);

        // Get invoice details
        const invoiceResult = await window.api.sales.get(invoiceId);
        if (!invoiceResult.success) {
          toast.error('Invoice not found');
          navigate('/sales');
          return;
        }

        setInvoice(invoiceResult.data.invoice);

        // Get returnable items
        const itemsResult = await window.api.returns.getReturnableItems(invoiceId);
        if (itemsResult.success) {
          const items: ReturnItem[] = itemsResult.data.map((item: ReturnableItem) => ({
            ...item,
            quantity_to_return: 0,
            condition: 'Good' as const,
            notes: '',
            selected: false,
          }));
          setReturnableItems(items);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load invoice data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [invoiceId]);

  const updateItem = (index: number, field: keyof ReturnItem, value: any) => {
    const updated = [...returnableItems];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-select item if quantity is set
    if (field === 'quantity_to_return' && value > 0) {
      updated[index].selected = true;
    } else if (field === 'quantity_to_return' && value === 0) {
      updated[index].selected = false;
    }

    setReturnableItems(updated);
  };

  const handleSubmit = async () => {
    // Validation
    const selectedItems = returnableItems.filter(item => item.selected && item.quantity_to_return > 0);

    if (selectedItems.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for return');
      return;
    }

    // Validate quantities
    for (const item of selectedItems) {
      if (item.quantity_to_return > item.quantity_available_for_return) {
        toast.error(
          `Cannot return ${item.quantity_to_return} of ${item.product_name}. Maximum available: ${item.quantity_available_for_return}`
        );
        return;
      }
    }

    try {
      setSaving(true);

      const returnData: CreateReturnInput = {
        sales_invoice_id: invoiceId,
        return_date: returnDate,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        refund_method: refundMethod,
        refund_status: refundStatus,
        items: selectedItems.map(item => ({
          sales_invoice_item_id: item.id,
          quantity_returned: item.quantity_to_return,
          condition: item.condition,
          notes: item.notes.trim() || undefined,
        })),
      };

      const result = await window.api.returns.create(returnData);

      if (result.success) {
        toast.success(`Return ${result.data.return.return_number} created successfully!`);
        navigate(`/sales/returns/${result.data.return.id}`);
      } else {
        toast.error(result.error?.message || 'Failed to create return');
      }
    } catch (error: any) {
      console.error('Error creating return:', error);
      toast.error('Failed to create return');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    if (!invoice) return amount;

    if (invoice.currency === 'UGX') {
      return new Intl.NumberFormat('en-UG', {
        style: 'currency',
        currency: 'UGX',
        minimumFractionDigits: 0,
      }).format(amount);
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    }
  };

  const calculateReturnTotal = () => {
    return returnableItems
      .filter(item => item.selected)
      .reduce((total, item) => {
        const baseAmount = item.quantity_to_return * item.unit_price;
        const discountAmount = baseAmount * (item.discount_percent / 100);
        const taxableAmount = baseAmount - discountAmount;
        const taxAmount = taxableAmount * (item.tax_percent / 100);
        return total + taxableAmount + taxAmount;
      }, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground mt-4">Loading invoice data...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <RotateCcw className="w-8 h-8 text-primary" />
            Create Return
          </h1>
          <p className="text-muted-foreground mt-1">
            Return items from invoice {invoice.invoice_number}
          </p>
        </div>
      </div>

      {/* Invoice Info Card */}
      <div className="bg-primary/10 border border-primary rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Invoice</p>
            <p className="font-semibold">{invoice.invoice_number}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="font-semibold">{invoice.customer_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Invoice Date</p>
            <p className="font-semibold">{format(new Date(invoice.invoice_date), 'MMM dd, yyyy')}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="font-semibold">{formatCurrency(invoice.total_amount)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Return Items */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-muted-foreground" />
              Items to Return
            </h2>

            {returnableItems.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="text-muted-foreground">No items available for return</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All items from this invoice have already been returned
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {returnableItems.map((item, index) => (
                  <div key={item.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => updateItem(index, 'selected', e.target.checked)}
                        className="w-5 h-5 mt-1"
                      />

                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span>Sold: {item.quantity}</span>
                            <span>•</span>
                            <span>Already Returned: {item.quantity_already_returned}</span>
                            <span>•</span>
                            <span className="text-primary font-medium">
                              Available: {item.quantity_available_for_return}
                            </span>
                          </div>
                        </div>

                        {item.selected && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1">Quantity to Return</label>
                              <input
                                type="number"
                                min="0"
                                max={item.quantity_available_for_return}
                                step="0.01"
                                value={item.quantity_to_return}
                                onChange={(e) =>
                                  updateItem(index, 'quantity_to_return', parseFloat(e.target.value) || 0)
                                }
                                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium mb-1">Condition</label>
                              <select
                                value={item.condition}
                                onChange={(e) => updateItem(index, 'condition', e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <option value="Good">Good</option>
                                <option value="Damaged">Damaged</option>
                                <option value="Defective">Defective</option>
                              </select>
                            </div>

                            <div className="md:col-span-1">
                              <label className="block text-sm font-medium mb-1">Item Notes (Optional)</label>
                              <input
                                type="text"
                                value={item.notes}
                                onChange={(e) => updateItem(index, 'notes', e.target.value)}
                                placeholder="E.g., Damaged packaging..."
                                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>
                          </div>
                        )}

                        {item.selected && item.condition !== 'Good' && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                              <p className="text-sm text-amber-800 dark:text-amber-200">
                                {item.condition === 'Damaged'
                                  ? 'Damaged items will not be returned to available stock'
                                  : 'Defective items will not be returned to available stock'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Return Details */}
        <div className="space-y-6">
          {/* Return Information */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Return Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Return Date *</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Reason for Return *</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select reason...</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Wrong Item">Wrong Item</option>
                  <option value="Defective">Defective</option>
                  <option value="Customer Request">Customer Request</option>
                  <option value="Quality Issues">Quality Issues</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional details about the return..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>
          </div>

          {/* Refund Details */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Refund Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Refund Method</label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Cash">Cash</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Note">Credit Note</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Refund Status</label>
                <select
                  value={refundStatus}
                  onChange={(e) => setRefundStatus(e.target.value as 'Pending' | 'Completed')}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Return Summary */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Return Summary</h2>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items Selected:</span>
                <span className="font-medium">
                  {returnableItems.filter(item => item.selected).length}
                </span>
              </div>
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Refund Amount:</span>
                  <span className="text-primary">{formatCurrency(calculateReturnTotal())}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleSubmit}
              disabled={
                saving ||
                returnableItems.filter(item => item.selected && item.quantity_to_return > 0).length === 0 ||
                !reason.trim()
              }
              className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating Return...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Create Return
                </>
              )}
            </button>

            <button
              onClick={() => navigate(`/sales/${invoiceId}`)}
              className="w-full px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewReturn;
