@echo off
REM Deploy producao via GitHub — nao requer npm no PATH.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-producao.ps1" %*
exit /b %ERRORLEVEL%
