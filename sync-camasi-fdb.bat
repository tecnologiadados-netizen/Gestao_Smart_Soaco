@echo off
REM Duplo clique neste arquivo no Explorer (com Google Drive montado em G:).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\sync-camasi-fdb-from-drive.ps1" -AtualizarEnv -Force
if errorlevel 1 (
  echo.
  echo FALHOU. Confirme no Explorer: G:\Meu Drive\DADOS.CAMASI\R_drive\Dados\Terminais\01\LOCAL.FDB
  pause
  exit /b 1
)
echo.
echo OK. Se a stack ja estiver rodando, reinicie: npm run dev:start
pause
