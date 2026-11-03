@echo off
setlocal

title Traqu Launcher
set "ROOT=%~dp0"
set "LAUNCHER=%ROOT%launcher.ps1"

if not exist "%LAUNCHER%" (
    echo Traqu launcher script not found:
    echo %LAUNCHER%
    pause
    exit /b 1
)

if /I "%~1"=="-Stop" (
    echo Stopping Traqu...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Stop
    if errorlevel 1 exit /b 1
    exit /b 0
)

echo Starting Traqu...
powershell -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Start %*

if errorlevel 1 (
    echo.
    echo Traqu could not start. Read the error above, then press any key.
    pause >nul
    exit /b 1
)

echo Traqu is ready at http://127.0.0.1:5173
exit /b 0
