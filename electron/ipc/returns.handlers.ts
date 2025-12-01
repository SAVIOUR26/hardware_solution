import { ipcMain } from 'electron';
import * as ReturnsService from '../services/returns.service';

/**
 * Register all returns IPC handlers
 */
export function registerReturnsHandlers() {
  // Create sales return
  ipcMain.handle('returns:create', async (_, input: ReturnsService.CreateSalesReturnInput) => {
    try {
      const salesReturn = await ReturnsService.createSalesReturn(input);
      return {
        success: true,
        data: {
          return: salesReturn,
          items: ReturnsService.getSalesReturnItems(salesReturn.id),
        },
      };
    } catch (error: any) {
      console.error('Error creating sales return:', error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to create sales return',
          code: 'CREATE_RETURN_ERROR',
        },
      };
    }
  });

  // Get sales return
  ipcMain.handle('returns:get', async (_, id: number) => {
    try {
      const salesReturn = ReturnsService.getSalesReturn(id);

      if (!salesReturn) {
        return {
          success: false,
          error: {
            message: 'Sales return not found',
            code: 'NOT_FOUND',
          },
        };
      }

      const items = ReturnsService.getSalesReturnItems(id);

      return {
        success: true,
        data: {
          return: salesReturn,
          items,
        },
      };
    } catch (error: any) {
      console.error('Error getting sales return:', error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to get sales return',
          code: 'GET_RETURN_ERROR',
        },
      };
    }
  });

  // List sales returns
  ipcMain.handle('returns:list', async (_, params?: any) => {
    try {
      const result = ReturnsService.listSalesReturns(params || {});

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      console.error('Error listing sales returns:', error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to list sales returns',
          code: 'LIST_RETURNS_ERROR',
        },
      };
    }
  });

  // Update refund status
  ipcMain.handle('returns:updateRefundStatus', async (_, params: {
    return_id: number;
    refund_status: 'Pending' | 'Completed' | 'Rejected';
    refund_method?: string;
    refund_date?: string;
  }) => {
    try {
      ReturnsService.updateRefundStatus(
        params.return_id,
        params.refund_status,
        params.refund_method,
        params.refund_date
      );

      return {
        success: true,
        data: { message: 'Refund status updated successfully' },
      };
    } catch (error: any) {
      console.error('Error updating refund status:', error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to update refund status',
          code: 'UPDATE_STATUS_ERROR',
        },
      };
    }
  });

  // Get returnable items from invoice
  ipcMain.handle('returns:getReturnableItems', async (_, invoice_id: number) => {
    try {
      const items = ReturnsService.getReturnableItems(invoice_id);

      return {
        success: true,
        data: items,
      };
    } catch (error: any) {
      console.error('Error getting returnable items:', error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to get returnable items',
          code: 'GET_ITEMS_ERROR',
        },
      };
    }
  });

  // Get invoice returns
  ipcMain.handle('returns:getInvoiceReturns', async (_, invoice_id: number) => {
    try {
      const returns = ReturnsService.getInvoiceReturns(invoice_id);

      return {
        success: true,
        data: returns,
      };
    } catch (error: any) {
      console.error('Error getting invoice returns:', error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to get invoice returns',
          code: 'GET_INVOICE_RETURNS_ERROR',
        },
      };
    }
  });

  console.log('Returns IPC handlers registered');
}
