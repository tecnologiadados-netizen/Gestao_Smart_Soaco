@echo off
chcp 65001 >nul
echo ========================================
echo   Gestor Pedidos - Instalacao na VPS
echo ========================================
echo.

:: Verifica Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERRO: Node.js nao encontrado. Instale Node.js 18+ em https://nodejs.org
    pause
    exit /b 1
)

echo Node: 
node -v
echo.

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

:: 1. Backend
echo [1/5] Instalando dependencias do backend...
cd backend
call npm install
if %ERRORLEVEL% neq 0 (
    echo ERRO ao instalar dependencias do backend
    pause
    exit /b 1
)

:: Verifica .env
if not exist .env (
    echo.
    echo ATENCAO: Arquivo .env nao encontrado!
    echo Copie backend\.env.example para backend\.env e edite com suas configuracoes.
    echo.
    if exist .env.example (
        copy .env.example .env
        echo Copiado .env.example para .env. EDITE o arquivo .env antes de continuar.
        pause
        exit /b 1
    )
)

echo [2/5] Gerando Prisma e aplicando migrations...
call npx prisma generate
call npx prisma migrate deploy
if %ERRORLEVEL% neq 0 (
    echo AVISO: Migration pode ter falhado. Verifique o .env
)

echo [3/5] Compilando backend...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERRO ao compilar backend
    pause
    exit /b 1
)

:: 2. Frontend
cd ..
echo [4/5] Instalando e compilando frontend...
cd frontend
call npm install
if %ERRORLEVEL% neq 0 (
    echo ERRO ao instalar dependencias do frontend
    pause
    exit /b 1
)

call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERRO ao compilar frontend
    pause
    exit /b 1
)

:: 3. Copia frontend compilado para backend/public
echo [5/5] Copiando frontend para backend...
cd ..
if not exist backend\public mkdir backend\public
xcopy /E /Y /Q frontend\dist\* backend\public\

:: 4. Inicia o servidor
echo.
echo ========================================
echo   Iniciando servidor...
echo   Acesse: http://localhost:3000
echo   Pressione Ctrl+C para parar
echo ========================================
echo.

cd backend
set NODE_ENV=production
node dist/server.js

pause
