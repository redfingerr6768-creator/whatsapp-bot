@echo off
REM GOWA WhatsApp Server Startup Script
REM Port: 3030 (to avoid conflict with Next.js on 3000)
REM Webhook: http://localhost:3000/api/webhook (pointing to Next.js app)

cd /d "%~dp0"

echo ========================================
echo  GOWA WhatsApp Server - Starting...
echo ========================================
echo Port: 3030
echo Webhook: http://localhost:3000/api/webhook
echo UI: http://localhost:3030
echo ========================================
echo.

REM NOTE: GOWA v7+ requires 'rest' subcommand for REST API mode
REM Use -p for port and -w for webhook

windows-amd64.exe rest -p 3030 -w "http://localhost:3000/api/webhook" --debug=true

pause
