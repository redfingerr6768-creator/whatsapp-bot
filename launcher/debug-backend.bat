@echo off
cd /d "%~dp0..\gowa-server"
echo Starting GOWA Server in Debug Mode... > ..\backend-debug.log
cmd /c "start-gowa.bat >> ..\backend-debug.log 2>&1"
