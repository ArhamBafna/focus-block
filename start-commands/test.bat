@echo off
title FocusBlock Test Runner
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\test-all.ps1" %*
exit /b %ERRORLEVEL%
