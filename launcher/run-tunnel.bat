@echo off
set "PATH=C:\Program Files (x86)\cloudflared;%PATH%"
cd /d "%~dp0.."
echo Starting Tunnel in %CD%...
echo.
cloudflared tunnel --url http://localhost:3000
if %errorlevel% neq 0 (
    echo.
    echo Tunnel failed with error %errorlevel%
    pause
)
pause
