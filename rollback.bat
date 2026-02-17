@echo off
echo =======================================================
echo  GOWA Server Rollback - Restore to Previous Version
echo =======================================================
echo.

REM Check if backup exists
if not exist "gowa-server-backup\windows-amd64.exe" (
    echo ERROR: Backup not found! gowa-server-backup\windows-amd64.exe does not exist.
    echo Cannot rollback.
    pause
    exit /b 1
)

REM Stop any running GOWA process
echo 1. Stopping GOWA if running...
taskkill /f /im windows-amd64.exe 2>nul
timeout /t 2 /nobreak >nul

REM Backup the current (new) binary in case you want it later
echo 2. Saving current binary as windows-amd64.v8.3.0.exe...
copy /y "gowa-server\windows-amd64.exe" "gowa-server\windows-amd64.v8.3.0.exe" >nul

REM Restore old binary
echo 3. Restoring old binary from backup...
copy /y "gowa-server-backup\windows-amd64.exe" "gowa-server\windows-amd64.exe" >nul

REM Restore old storages (WhatsApp session data)
echo 4. Restoring storages from backup...
xcopy /e /y /i "gowa-server-backup\storages" "gowa-server\storages" >nul

echo.
echo =======================================================
echo  Rollback complete! Old version restored.
echo  Run start-all.bat to start the server.
echo =======================================================
echo.
pause
