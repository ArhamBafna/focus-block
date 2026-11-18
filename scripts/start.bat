@echo off
title FocusBlock Launcher
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
if %ERRORLEVEL% neq 0 (
    echo.
    echo Launcher encountered an error.
    pause
)
exit /b %ERRORLEVEL%
