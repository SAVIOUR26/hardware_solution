# Troubleshooting Guide

## Application Crashes or Won't Start

If the application crashes on startup or won't open, follow these steps:

### 1. Find the Log File

The application creates a detailed log file at:

**Windows:**
```
C:\Users\<YourUsername>\AppData\Roaming\hardware-manager-pro\app.log
```

Quick access:
1. Press `Win + R`
2. Type: `%APPDATA%\hardware-manager-pro`
3. Press Enter
4. Look for `app.log`

### 2. Check the Log File

Open `app.log` with Notepad. Look for error messages, especially:
- `Database initialization failed`
- `Migration failed`
- `FATAL ERROR`
- `UNCAUGHT EXCEPTION`

### 3. Common Issues and Fixes

#### Issue: "Failed to initialize database"
**Cause:** Database file is corrupted or missing write permissions

**Fix:**
1. Close the application completely
2. Navigate to: `%APPDATA%\hardware-manager-pro`
3. Delete or rename `database.db` (this will reset the database)
4. Restart the application

#### Issue: "Migration failed"
**Cause:** Database schema update failed

**Fix:**
1. Backup your data folder: `%APPDATA%\hardware-manager-pro`
2. Delete `database.db`
3. Restart the application (will create a fresh database)

#### Issue: Application starts but shows blank screen
**Cause:** UI rendering issue

**Fix:**
1. Try the portable version instead of the installer
2. Update your graphics drivers
3. Check the log file for WebGL or rendering errors

### 4. Portable vs Installer Version

**Use Portable version if:**
- Installation fails
- You want to test without installing
- You need to run from USB/external drive
- You're debugging issues

**Use Installer version for:**
- Production deployment
- Auto-updates
- Desktop shortcuts and Start Menu integration
- Multi-user systems

### 5. Clean Install Steps

If all else fails, perform a clean install:

1. **Backup your data:**
   - Export all data from Tally if possible
   - Save any important reports

2. **Uninstall completely:**
   - Uninstall via Control Panel → Programs
   - Delete: `%APPDATA%\hardware-manager-pro`
   - Delete: `%LOCALAPPDATA%\hardware-manager-pro`

3. **Reinstall:**
   - Download latest version
   - Run installer as Administrator
   - Start application

### 6. Getting Help

When reporting issues, please provide:
1. The `app.log` file
2. Windows version
3. How to reproduce the error
4. Screenshot of any error messages

### 7. Known Issues

#### Better-sqlite3 Native Module
If you see errors about `better-sqlite3.node`:
- This is a database driver issue
- Try the portable version
- Make sure you have Visual C++ Redistributable installed

Download: https://aka.ms/vs/17/release/vc_redist.x64.exe

## Development Mode Debugging

If you're a developer running from source:

```bash
# Run in development mode with console
npm run dev

# Check electron logs
set ELECTRON_ENABLE_LOGGING=1
npm run dev

# Build with debug symbols
npm run build -- --debug
```

## Contact Support

For persistent issues:
- Create an issue on GitHub with the log file
- Email support with error details
- Include system information (Windows version, RAM, etc.)
