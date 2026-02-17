@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0.."
echo Starting Frontend in %CD%...
echo.
npm run dev
if %errorlevel% neq 0 (
    echo.
    echo Frontend failed with error %errorlevel%
    pause
)
pause
