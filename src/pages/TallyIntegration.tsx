import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  RefreshCw,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Database,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

function TallyIntegration() {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'history'>('import');
  const [stats, setStats] = useState<any>(null);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Import state
  const [importOptions, setImportOptions] = useState({
    importCustomers: true,
    importSuppliers: true,
    importProducts: true,
    updateExisting: true,
  });

  // Export state
  const [exportStartDate, setExportStartDate] = useState(
    format(new Date(new Date().setDate(1)), 'yyyy-MM-dd')
  );
  const [exportEndDate, setExportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exportOptions, setExportOptions] = useState({
    exportSales: true,
    exportPurchases: true,
  });

  // Load stats and history
  useEffect(() => {
    loadStats();
    loadSyncHistory();
  }, []);

  const loadStats = async () => {
    try {
      const result = await window.api.tally.getSyncStats();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadSyncHistory = async () => {
    try {
      const result = await window.api.tally.getSyncHistory(20);
      if (result.success) {
        setSyncHistory(result.data);
      }
    } catch (error) {
      console.error('Error loading sync history:', error);
    }
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      toast.loading('Importing Tally data...', { id: 'tally-import' });

      // File picker will be shown by the backend
      const result = await window.api.tally.importMasters('', importOptions);

      if (result.success) {
        const data = result.data;
        const total =
          data.customersCreated +
          data.customersUpdated +
          data.suppliersCreated +
          data.suppliersUpdated +
          data.productsCreated +
          data.productsUpdated;

        toast.success(
          `Successfully imported ${total} records!\n` +
            `Customers: ${data.customersCreated} created, ${data.customersUpdated} updated\n` +
            `Suppliers: ${data.suppliersCreated} created, ${data.suppliersUpdated} updated\n` +
            `Products: ${data.productsCreated} created, ${data.productsUpdated} updated`,
          { id: 'tally-import', duration: 5000 }
        );

        if (data.errors.length > 0) {
          console.error('Import errors:', data.errors);
          toast.warning(`${data.errors.length} errors occurred during import. Check console for details.`);
        }

        if (data.warnings.length > 0) {
          console.warn('Import warnings:', data.warnings);
        }

        // Refresh stats and history
        loadStats();
        loadSyncHistory();
      } else {
        toast.error(result.error?.message || 'Import failed', { id: 'tally-import' });
      }
    } catch (error: any) {
      console.error('Error importing:', error);
      toast.error('Failed to import data', { id: 'tally-import' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      toast.loading('Exporting to Tally format...', { id: 'tally-export' });

      const result = await window.api.tally.exportVouchers(
        {
          startDate: exportStartDate,
          endDate: exportEndDate,
        },
        exportOptions
      );

      if (result.success) {
        const data = result.data;
        toast.success(
          `Successfully exported ${data.salesVouchers + data.purchaseVouchers} vouchers!\n` +
            `Sales: ${data.salesVouchers}\n` +
            `Purchases: ${data.purchaseVouchers}\n` +
            `File: ${data.filePath}`,
          { id: 'tally-export', duration: 5000 }
        );

        // Refresh stats and history
        loadStats();
        loadSyncHistory();
      } else {
        toast.error(result.error?.message || 'Export failed', { id: 'tally-export' });
      }
    } catch (error: any) {
      console.error('Error exporting:', error);
      toast.error('Failed to export data', { id: 'tally-export' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: any = {
      Success: {
        bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
        icon: CheckCircle2,
      },
      Partial: {
        bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
        icon: AlertCircle,
      },
      Failed: {
        bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
        icon: XCircle,
      },
    };

    const config = configs[status] || configs.Failed;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${config.bg}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <RefreshCw className="w-8 h-8 text-primary" />
          Tally Integration
        </h1>
        <p className="text-muted-foreground mt-1">Import and export data with Tally Prime</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Syncs</p>
                <p className="text-2xl font-bold">{stats.totalSyncs}</p>
              </div>
              <Database className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-green-600">{stats.successfulSyncs}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Last Import</p>
              {stats.lastImport ? (
                <div>
                  <p className="text-xs font-medium">
                    {format(new Date(stats.lastImport.created_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                  <p className="text-xs text-muted-foreground">{stats.lastImport.records_created} records</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Never</p>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Last Export</p>
              {stats.lastExport ? (
                <div>
                  <p className="text-xs font-medium">
                    {format(new Date(stats.lastExport.created_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                  <p className="text-xs text-muted-foreground">{stats.lastExport.records_created} records</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Never</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Import Masters
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Download className="w-4 h-4 inline mr-2" />
            Export Vouchers
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Sync History
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-card border border-border rounded-lg p-6">
        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">Import Tally Masters</h2>
              <p className="text-sm text-muted-foreground">
                Import customers, suppliers, and products from Tally XML export file
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={importOptions.importCustomers}
                    onChange={(e) =>
                      setImportOptions({ ...importOptions, importCustomers: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Import Customers (Sundry Debtors)</span>
                </label>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={importOptions.importSuppliers}
                    onChange={(e) =>
                      setImportOptions({ ...importOptions, importSuppliers: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Import Suppliers (Sundry Creditors)</span>
                </label>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={importOptions.importProducts}
                    onChange={(e) =>
                      setImportOptions({ ...importOptions, importProducts: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Import Products (Stock Items)</span>
                </label>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={importOptions.updateExisting}
                    onChange={(e) =>
                      setImportOptions({ ...importOptions, updateExisting: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Update Existing Records</span>
                </label>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">How to Import</p>
                  <ol className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1 list-decimal list-inside">
                    <li>Export "All Masters" from Tally Prime as XML</li>
                    <li>Click "Import from Tally" button below</li>
                    <li>Select the exported XML file</li>
                    <li>Wait for import to complete</li>
                  </ol>
                </div>
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={loading}
              className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Import from Tally
                </>
              )}
            </button>
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">Export Vouchers to Tally</h2>
              <p className="text-sm text-muted-foreground">
                Export sales and purchase vouchers to Tally XML format
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
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
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.exportSales}
                    onChange={(e) => setExportOptions({ ...exportOptions, exportSales: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Export Sales Invoices</span>
                </label>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.exportPurchases}
                    onChange={(e) => setExportOptions({ ...exportOptions, exportPurchases: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Export Purchase Invoices</span>
                </label>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">Important</p>
                  <ul className="text-sm text-amber-800 dark:text-amber-200 mt-2 space-y-1 list-disc list-inside">
                    <li>Only vouchers not previously exported will be included</li>
                    <li>Vouchers will be marked as exported after successful export</li>
                    <li>Import the generated XML file into Tally Prime</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={loading || (!exportOptions.exportSales && !exportOptions.exportPurchases)}
              className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Export to Tally
                </>
              )}
            </button>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Sync History</h2>
              <button
                onClick={loadSyncHistory}
                className="px-3 py-1 text-sm border border-border rounded-lg hover:bg-accent"
              >
                <RefreshCw className="w-4 h-4 inline mr-1" />
                Refresh
              </button>
            </div>

            {syncHistory.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No sync history yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Import or export data to see sync history
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold">Date & Time</th>
                      <th className="text-left py-3 px-4 font-semibold">Type</th>
                      <th className="text-center py-3 px-4 font-semibold">Status</th>
                      <th className="text-right py-3 px-4 font-semibold">Processed</th>
                      <th className="text-right py-3 px-4 font-semibold">Created</th>
                      <th className="text-right py-3 px-4 font-semibold">Updated</th>
                      <th className="text-right py-3 px-4 font-semibold">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncHistory.map((sync) => (
                      <tr key={sync.id} className="border-t border-border hover:bg-accent/50">
                        <td className="py-3 px-4 text-sm">
                          {format(new Date(sync.created_at), 'MMM dd, yyyy HH:mm:ss')}
                        </td>
                        <td className="py-3 px-4 text-sm">{sync.sync_type}</td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(sync.status)}</td>
                        <td className="py-3 px-4 text-right text-sm">{sync.records_processed}</td>
                        <td className="py-3 px-4 text-right text-sm text-green-600">
                          {sync.records_created}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-blue-600">
                          {sync.records_updated}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-red-600">
                          {sync.errors_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TallyIntegration;
