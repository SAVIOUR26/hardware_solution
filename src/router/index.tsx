import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';

// Sales
import SalesIndex from '@/pages/sales/SalesIndex';
import NewSale from '@/pages/sales/NewSale';
import ViewSale from '@/pages/sales/ViewSale';
import NotTakenReport from '@/pages/sales/NotTakenReport';
import Quotations from '@/pages/sales/Quotations';

// Returns
import ReturnsIndex from '@/pages/sales/ReturnsIndex';
import NewReturn from '@/pages/sales/NewReturn';
import ViewReturn from '@/pages/sales/ViewReturn';

// Purchase
import PurchaseIndex from '@/pages/purchase/PurchaseIndex';
import NewPurchase from '@/pages/purchase/NewPurchase';
import ViewPurchase from '@/pages/purchase/ViewPurchase';

// Inventory
import InventoryIndex from '@/pages/inventory/InventoryIndex';
import StockReport from '@/pages/inventory/StockReport';

// Customers & Suppliers (placeholders for now)
import CustomersIndex from '@/pages/customers/CustomersIndex';
import SuppliersIndex from '@/pages/suppliers/SuppliersIndex';

// Reports
import ReportsIndex from '@/pages/reports/ReportsIndex';

// Settings
import Settings from '@/pages/Settings';

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Sales Routes */}
          <Route path="sales">
            <Route index element={<SalesIndex />} />
            <Route path="new" element={<NewSale />} />
            <Route path=":id" element={<ViewSale />} />
            <Route path="not-taken" element={<NotTakenReport />} />
            <Route path="quotations" element={<Quotations />} />
            {/* Returns Routes */}
            <Route path="returns">
              <Route index element={<ReturnsIndex />} />
              <Route path="new" element={<NewReturn />} />
              <Route path=":id" element={<ViewReturn />} />
            </Route>
          </Route>

          {/* Purchase Routes */}
          <Route path="purchases">
            <Route index element={<PurchaseIndex />} />
            <Route path="new" element={<NewPurchase />} />
            <Route path=":id" element={<ViewPurchase />} />
          </Route>

          {/* Inventory Routes */}
          <Route path="inventory">
            <Route index element={<InventoryIndex />} />
            <Route path="stock-report" element={<StockReport />} />
          </Route>

          {/* Customers & Suppliers */}
          <Route path="customers" element={<CustomersIndex />} />
          <Route path="suppliers" element={<SuppliersIndex />} />

          {/* Reports */}
          <Route path="reports" element={<ReportsIndex />} />

          {/* Settings */}
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
