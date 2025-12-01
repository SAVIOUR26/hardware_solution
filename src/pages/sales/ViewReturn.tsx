import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  RotateCcw,
  ArrowLeft,
  Package,
  User,
  Calendar,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { SalesReturn, SalesReturnItem } from '@/types/returns.types';

function ViewReturn() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const returnId = parseInt(id || '0');

  const [returnData, setReturnData] = useState<SalesReturn | null>(null);
  const [items, setItems] = useState<SalesReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch return data
  const fetchReturn = async () => {
    try {
      setLoading(true);

      const result = await window.api.returns.get(returnId);

      if (result.success) {
        setReturnData(result.data.return);
        setItems(result.data.items);
      } else {
        toast.error('Return not found');
        navigate('/sales/returns');
      }
    } catch (error) {
      console.error('Error fetching return:', error);
      toast.error('Failed to load return');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturn();
  }, [returnId]);

  const handleUpdateRefundStatus = async (
    newStatus: 'Pending' | 'Completed' | 'Rejected'
  ) => {
    if (!returnData) return;

    try {
      setUpdatingStatus(true);

      const result = await window.api.returns.updateRefundStatus({
        return_id: returnId,
        refund_status: newStatus,
        refund_date: newStatus === 'Completed' ? format(new Date(), 'yyyy-MM-dd') : undefined,
      });

      if (result.success) {
        toast.success(`Refund status updated to ${newStatus}`);
        fetchReturn(); // Refresh data
      } else {
        toast.error(result.error?.message || 'Failed to update refund status');
      }
    } catch (error) {
      console.error('Error updating refund status:', error);
      toast.error('Failed to update refund status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'UGX') {
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

  const getStatusBadge = (status: string) => {
    const configs = {
      Pending: {
        bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
        icon: AlertCircle,
      },
      Completed: {
        bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
        icon: CheckCircle2,
      },
      Rejected: {
        bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
        icon: XCircle,
      },
    };

    const config = configs[status as keyof typeof configs];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full ${config.bg}`}>
        <Icon className="w-4 h-4" />
        {status}
      </span>
    );
  };

  const getConditionBadge = (condition: string) => {
    const colors = {
      Good: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
      Damaged: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
      Defective: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[condition as keyof typeof colors]}`}>
        {condition}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground mt-4">Loading return...</p>
        </div>
      </div>
    );
  }

  if (!returnData) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sales/returns')}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <RotateCcw className="w-8 h-8 text-primary" />
              Return {returnData.return_number}
            </h1>
            <p className="text-muted-foreground mt-1">
              Created on {format(new Date(returnData.created_at), 'MMM dd, yyyy HH:mm')}
            </p>
          </div>
        </div>

        <div>{getStatusBadge(returnData.refund_status)}</div>
      </div>

      {/* Return Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-muted-foreground" />
              Customer Information
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{returnData.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Original Invoice</p>
                <button
                  onClick={() => navigate(`/sales/${returnData.sales_invoice_id}`)}
                  className="font-mono text-primary hover:underline"
                >
                  {returnData.invoice_number}
                </button>
              </div>
            </div>
          </div>

          {/* Return Details */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              Return Details
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Return Date</p>
                <p className="font-medium">{format(new Date(returnData.return_date), 'MMM dd, yyyy')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="font-medium">{returnData.reason}</p>
              </div>
              {returnData.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{returnData.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Refund Information */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-muted-foreground" />
              Refund Information
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Refund Method</p>
                <p className="font-medium">{returnData.refund_method || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Refund Status</p>
                <p className="font-medium">{returnData.refund_status}</p>
              </div>
              {returnData.refund_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Refund Date</p>
                  <p className="font-medium">{format(new Date(returnData.refund_date), 'MMM dd, yyyy')}</p>
                </div>
              )}
            </div>

            {/* Status Update Actions */}
            {returnData.refund_status === 'Pending' && (
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <p className="text-sm font-medium mb-2">Update Status:</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateRefundStatus('Completed')}
                    disabled={updatingStatus}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    Complete Refund
                  </button>
                  <button
                    onClick={() => handleUpdateRefundStatus('Rejected')}
                    disabled={updatingStatus}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                  >
                    Reject Return
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Amount Summary */}
          <div className="bg-primary/10 border border-primary rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Refund Amount</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{formatCurrency(returnData.subtotal, returnData.currency)}</span>
              </div>
              {returnData.tax_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span>{formatCurrency(returnData.tax_amount, returnData.currency)}</span>
                </div>
              )}
              <div className="border-t border-primary pt-2 mt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Refund:</span>
                  <span className="text-primary">
                    {formatCurrency(returnData.total_amount, returnData.currency)}
                  </span>
                </div>
                {returnData.currency === 'USD' && (
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>In UGX:</span>
                    <span>{formatCurrency(returnData.total_amount_ugx, 'UGX')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Return Items */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-muted-foreground" />
          Returned Items ({items.length})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left py-3 px-4 font-semibold">Product</th>
                <th className="text-center py-3 px-4 font-semibold">Qty Returned</th>
                <th className="text-center py-3 px-4 font-semibold">Original Qty</th>
                <th className="text-right py-3 px-4 font-semibold">Unit Price</th>
                <th className="text-center py-3 px-4 font-semibold">Condition</th>
                <th className="text-right py-3 px-4 font-semibold">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-medium">{item.quantity_returned}</td>
                  <td className="py-3 px-4 text-center text-muted-foreground">
                    {item.original_quantity}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatCurrency(item.unit_price, returnData.currency)}
                  </td>
                  <td className="py-3 px-4 text-center">{getConditionBadge(item.condition)}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(item.line_total, returnData.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Impact Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-blue-900 dark:text-blue-100">Stock Impact</p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              Items marked as "Good" have been returned to available stock. Items marked as "Damaged" or
              "Defective" have not been added to available stock but are tracked in the audit trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ViewReturn;
