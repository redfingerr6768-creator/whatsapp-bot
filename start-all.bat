@echo off
echo =======================================================
echo  Starting WhatsApp Bot (Frontend + Backend + Tunnel)
echo =======================================================

echo 1. Starting Frontend...
start "WA BOT Frontend" "launcher\run-frontend.bat"

echo 2. Starting Backend...
start "WA BOT Backend" "launcher\run-backend.bat"

echo 3. Starting Cloudflare Tunnel...
start "WA BOT Tunnel" "launcher\run-tunnel.bat"

echo.
echo All components executed. Check the new windows.
echo.
pause
