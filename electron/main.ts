import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { getDatabase, closeDatabase } from './database';
import { runMigrations, needsMigration } from './database/migrations';
import { registerAllHandlers } from './ipc';

// Setup logging to file for debugging production builds
const logFilePath = path.join(app.getPath('userData'), 'app.log');
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function log(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message} ${args.map(a => JSON.stringify(a)).join(' ')}\n`;
  console.log(message, ...args);
  try {
    logStream.write(logMessage);
  } catch (e) {
    // Ignore logging errors
  }
}

function showErrorDialog(title: string, message: string, error?: any) {
  const errorDetails = error ? `\n\nError: ${error.message || error}\n\nLog file: ${logFilePath}` : '';
  dialog.showErrorBox(title, message + errorDetails);
}

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
    log('=== Application Starting ===');
    log('App version:', app.getVersion());
    log('Electron version:', process.versions.electron);
    log('Node version:', process.versions.node);
    log('Platform:', process.platform);
    log('User data path:', app.getPath('userData'));

    // Initialize database
    log('Initializing database...');
    try {
      getDatabase();
      log('Database initialized successfully');
    } catch (dbError: any) {
      log('Database initialization failed:', dbError);
      showErrorDialog(
        'Database Error',
        'Failed to initialize the database. The application cannot start.',
        dbError
      );
      throw dbError;
    }

    // Run migrations if needed
    if (needsMigration()) {
      log('Running database migrations...');
      try {
        await runMigrations();
        log('Migrations completed successfully');
      } catch (migError: any) {
        log('Migration failed:', migError);
        showErrorDialog(
          'Migration Error',
          'Failed to update the database schema. The application cannot start.',
          migError
        );
        throw migError;
      }
    } else {
      log('No migrations needed');
    }

    log('Database ready');

    // Register IPC handlers
    log('Registering IPC handlers...');
    try {
      registerAllHandlers();
      log('IPC handlers registered successfully');
    } catch (ipcError: any) {
      log('IPC handler registration failed:', ipcError);
      showErrorDialog(
        'Initialization Error',
        'Failed to register application handlers.',
        ipcError
      );
      throw ipcError;
    }

    // Create window
    log('Creating main window...');
    try {
      createWindow();
      log('Main window created successfully');
    } catch (winError: any) {
      log('Window creation failed:', winError);
      showErrorDialog(
        'Window Error',
        'Failed to create the application window.',
        winError
      );
      throw winError;
    }

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        log('Reactivating application, creating window...');
        createWindow();
      }
    });

    log('=== Application Started Successfully ===');
  } catch (error: any) {
    log('FATAL ERROR: Failed to initialize application:', error);
    log('Stack trace:', error.stack);
    showErrorDialog(
      'Startup Error',
      'The application failed to start. Please check the log file for details.',
      error
    );
    setTimeout(() => app.quit(), 3000);
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up when app is quitting
app.on('before-quit', () => {
  log('Application quitting, closing database connection...');
  try {
    closeDatabase();
    log('Database connection closed');
  } catch (error) {
    log('Error closing database:', error);
  }

  // Close log stream
  try {
    logStream.end();
  } catch (e) {
    // Ignore
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log('UNCAUGHT EXCEPTION:', error);
  log('Stack:', error.stack);
  showErrorDialog(
    'Unexpected Error',
    'An unexpected error occurred. The application will now close.',
    error
  );
  setTimeout(() => app.quit(), 3000);
});

process.on('unhandledRejection', (error) => {
  log('UNHANDLED REJECTION:', error);
  showErrorDialog(
    'Unexpected Error',
    'An unexpected error occurred. Please check the log file.',
    error
  );
});
