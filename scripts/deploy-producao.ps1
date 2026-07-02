# Deploy controlado em producao (VPS Hostinger / Windows).
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-producao.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-producao.ps1 -PastaProjeto "C:\apps\gestor-pedidos"
#
# Pre-requisitos:
#   - Clone do repo na pasta de producao, branch main
#   - backend\.env configurado (nao versionado)
#   - Git instalado
#   - Servico Windows configurado (scripts/setup-prod-service.ps1) OU processo Node manual

param(
    [string]$PastaProjeto = "",
    [string]$ServicoNome = "GestorPedidosSoaco",
    [switch]$SemMigrate,
    [switch]$SemRestart
)

$ErrorActionPreference = "Stop"

if (-not $PastaProjeto) {
    $PastaProjeto = Split-Path $PSScriptRoot -Parent
}

function Find-Git {
    $candidatos = @("git", "C:\Program Files\Git\bin\git.exe")
    foreach ($c in $candidatos) {
        if (Get-Command $c -ErrorAction SilentlyContinue) { return $c }
        if (Test-Path $c) { return $c }
    }
    throw "Git nao encontrado."
}

$Git = Find-Git
Set-Location $PastaProjeto

Write-Host ""
Write-Host "=== Deploy producao — Gestor Pedidos SoAco ===" -ForegroundColor Cyan
Write-Host "Pasta: $PastaProjeto"
Write-Host "Horario: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

if (-not (Test-Path "backend\.env")) {
    throw "backend\.env nao encontrado. Copie de backend\.env.example e preencha os secrets de producao."
}

$branch = & $Git branch --show-current
if ($branch -ne "main") {
    Write-Host "Checkout main (estava em: $branch)..." -ForegroundColor Yellow
    & $Git fetch origin
    & $Git checkout main
}

Write-Host "[1/6] git pull origin main..." -ForegroundColor Cyan
& $Git fetch origin
& $Git pull origin main

Write-Host "[2/6] npm ci (raiz, backend, frontend)..." -ForegroundColor Cyan
npm ci
npm ci --prefix backend
npm ci --prefix frontend

Write-Host "[3/6] prisma generate..." -ForegroundColor Cyan
npm run generate --prefix backend

if (-not $SemMigrate) {
    Write-Host "[4/6] prisma migrate deploy..." -ForegroundColor Cyan
    Write-Host "      ATENCAO: revise migrations destrutivas antes de continuar em producao." -ForegroundColor Yellow
    npm run migrate --prefix backend
} else {
    Write-Host "[4/6] migrate ignorado (-SemMigrate)." -ForegroundColor Yellow
}

Write-Host "[5/6] build producao..." -ForegroundColor Cyan
$env:NODE_ENV = "production"
npm run build:production

Write-Host "[6/6] reiniciar servico..." -ForegroundColor Cyan
if (-not $SemRestart) {
    $servico = Get-Service -Name $ServicoNome -ErrorAction SilentlyContinue
    if ($servico) {
        Restart-Service -Name $ServicoNome -Force
        Start-Sleep -Seconds 3
        $st = (Get-Service -Name $ServicoNome).Status
        Write-Host "Servico $ServicoNome : $st" -ForegroundColor Green
    } else {
        Write-Host "Servico '$ServicoNome' nao encontrado." -ForegroundColor Yellow
        Write-Host "Configure com: powershell -File scripts/setup-prod-service.ps1" -ForegroundColor Yellow
        Write-Host "Ou reinicie manualmente: npm run start:production" -ForegroundColor Yellow
    }
} else {
    Write-Host "Restart ignorado (-SemRestart). Execute manualmente." -ForegroundColor Yellow
}

# Smoke test
$port = 4000
$envFile = Get-Content "backend\.env" -ErrorAction SilentlyContinue
foreach ($line in $envFile) {
    if ($line -match '^\s*APP_PORT\s*=\s*(\d+)') {
        $port = [int]$Matches[1]
        break
    }
}

Start-Sleep -Seconds 2
try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 15
    if ($resp.ok -eq $true) {
        Write-Host ""
        Write-Host "Health OK — build $($resp.build), db $($resp.db)" -ForegroundColor Green
    } else {
        Write-Host "Health retornou resposta inesperada." -ForegroundColor Yellow
    }
} catch {
    Write-Host "AVISO: health check falhou em http://127.0.0.1:$port/health" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host ""
Write-Host "Deploy concluido com sucesso." -ForegroundColor Green
