import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { RotateCcw, Eye, Filter, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { SalesReturn } from '@/types/returns.types';

function ReturnsIndex() {
  const navigate = useNavigate();

  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [refundStatus, setRefundStatus] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch returns
  const fetchReturns = async () => {
    try {
      setLoading(true);

      const filters: any = {
        limit,
        offset: (page - 1) * limit,
      };

      if (refundStatus) filters.refund_status = refundStatus;
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;

      const result = await window.api.returns.list(filters);

      if (result.success) {
        setReturns(result.data.returns);
        setTotal(result.data.total);
      } else {
        toast.error(result.error?.message || 'Failed to load returns');
      }
    } catch (error) {
      console.error('Error fetching returns:', error);
      toast.error('Failed to load returns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [page, refundStatus, startDate, endDate]);

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
    const colors = {
      Pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
      Completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
      Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status as keyof typeof colors]}`}>
        {status}
      </span>
    );
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <RotateCcw className="w-8 h-8 text-primary" />
            Sales Returns
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage product returns and refunds
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">Filters</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Refund Status</label>
            <select
              value={refundStatus}
              onChange={(e) => {
                setRefundStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setRefundStatus('');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground mt-4">Loading returns...</p>
          </div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center">
            <RotateCcw className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No returns found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Returns will appear here when customers return items
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Return #</th>
                    <th className="text-left py-3 px-4 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Invoice #</th>
                    <th className="text-left py-3 px-4 font-semibold">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold">Reason</th>
                    <th className="text-right py-3 px-4 font-semibold">Amount</th>
                    <th className="text-center py-3 px-4 font-semibold">Status</th>
                    <th className="text-center py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((returnItem) => (
                    <tr key={returnItem.id} className="border-t border-border hover:bg-accent/50">
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm">{returnItem.return_number}</span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {format(new Date(returnItem.return_date), 'MMM dd, yyyy')}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => navigate(`/sales/${returnItem.sales_invoice_id}`)}
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {returnItem.invoice_number}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm">{returnItem.customer_name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm">{returnItem.reason}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-semibold">
                            {formatCurrency(returnItem.total_amount, returnItem.currency)}
                          </span>
                          {returnItem.currency === 'USD' && (
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(returnItem.total_amount_ugx, 'UGX')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(returnItem.refund_status)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => navigate(`/sales/returns/${returnItem.id}`)}
                          className="p-2 text-primary hover:bg-primary/10 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} returns
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-1 border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="px-3 py-1 border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Summary Cards */}
      {!loading && returns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Pending Refunds</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                  {returns.filter(r => r.refund_status === 'Pending').length}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Completed</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                  {returns.filter(r => r.refund_status === 'Completed').length}
                </p>
              </div>
              <RotateCcw className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">Rejected</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
                  {returns.filter(r => r.refund_status === 'Rejected').length}
                </p>
              </div>
              <RotateCcw className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReturnsIndex;
