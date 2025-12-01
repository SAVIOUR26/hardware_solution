import { ipcMain, dialog } from 'electron';
import * as TallyService from '../services/tally.service';

/**
 * Register all Tally IPC handlers
 */
export function registerTallyHandlers() {
  // Import Tally Masters
  ipcMain.handle('tally:importMasters', async (_, filePath: string, options: any) => {
    try {
      // If no file path, show file picker
      let selectedPath = filePath;
      if (!selectedPath) {
        const result = await dialog.showOpenDialog({
          title: 'Select Tally XML File',
          filters: [
            { name: 'XML Files', extensions: ['xml'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          properties: ['openFile'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return {
            success: false,
            error: {
              message: 'No file selected',
              code: 'NO_FILE_SELECTED',
            },
          };
        }

        selectedPath = result.filePaths[0];
      }

      const result = await TallyService.importTallyMasters(selectedPath, options || {});

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      console.error('Error importing Tally masters:', error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to import Tally masters',
          code: 'IMPORT_ERROR',
        },
      };
    }
  });

  // Export Vouchers
  ipcMain.handle(
    'tally:exportVouchers',
    async (_, dateRange: { startDate: string; endDate: string }, options: any) => {
      try {
        // Ask for save location
        let outputPath = options?.outputPath;
        if (!outputPath) {
          const result = await dialog.showSaveDialog({
            title: 'Save Tally Export',
            defaultPath: `tally_export_${new Date().toISOString().split('T')[0]}.xml`,
            filters: [
              { name: 'XML Files', extensions: ['xml'] },
              { name: 'All Files', extensions: ['*'] },
            ],
          });

          if (result.canceled || !result.filePath) {
            return {
              success: false,
              error: {
                message: 'Export cancelled',
                code: 'EXPORT_CANCELLED',
              },
            };
          }

          outputPath = result.filePath;
        }

        const result = await TallyService.exportTallyVouchers(dateRange, {
          ...options,
          outputPath,
        });

        return {
          success: true,
          data: result,
        };
      } catch (error: any) {
        console.error('Error exporting Tally vouchers:', error);
        return {
          success: false,
          error: {
            message: error.message || 'Failed to export Tally vouchers',
            code: 'EXPORT_ERROR',
          },
        };
      }
    }
  );

  // Get Sync History
  ipcMain.handle('tally:getSyncHistory', async (_, limit?: number) => {
    try {
      const history = TallyService.getTallySyncHistory(limit || 50);

      return {
        success: true,
        data: history,
      };
    } catch (error: any) {
      console.error('Error getting sync history:', error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to get sync history',
          code: 'HISTORY_ERROR',
        },
      };
    }
  });

  // Get Sync Statistics
  ipcMain.handle('tally:getSyncStats', async () => {
    try {
      const stats = TallyService.getTallySyncStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      console.error('Error getting sync stats:', error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to get sync stats',
          code: 'STATS_ERROR',
        },
      };
    }
  });

  console.log('Tally IPC handlers registered');
}
