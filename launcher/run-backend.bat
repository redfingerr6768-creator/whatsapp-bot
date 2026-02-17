@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0..\gowa-server"
echo Starting Backend in %CD%...
echo.
call start-gowa.bat
if %errorlevel% neq 0 (
    echo.
    echo Backend failed with error %errorlevel%
    pause
)
pause
