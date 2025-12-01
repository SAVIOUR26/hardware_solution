import { app, BrowserWindow } from 'electron';
import path from 'path';
import { getDatabase, closeDatabase } from './database';
import { runMigrations, needsMigration } from './database/migrations';
import { registerAllHandlers } from './ipc';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Wrapped in try-catch for portable builds where this module may not be available
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch (e) {
  // Module not available - continue (normal for portable builds)
}

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  try {
    // Initialize database
    console.log('Initializing database...');
    getDatabase();

    // Run migrations if needed
    if (needsMigration()) {
      console.log('Running database migrations...');
      await runMigrations();
    }

    console.log('Database ready');

    // Register IPC handlers
    registerAllHandlers();

    // Create window
    createWindow();

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up when app is quitting
app.on('before-quit', () => {
  console.log('Closing database connection...');
  closeDatabase();
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});
