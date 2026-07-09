# Instala o backend como servico Windows (NSSM) para producao com auto-restart.
# Uso (como Administrador):
#   powershell -ExecutionPolicy Bypass -File scripts/setup-prod-service.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/setup-prod-service.ps1 -PastaProjeto "C:\apps\gestor-pedidos"
#
# Pre-requisitos:
#   - Node.js no PATH
#   - Build ja executado (npm run build:production)
#   - backend\.env de producao configurado

param(
    [string]$PastaProjeto = "",
    [string]$ServicoNome = "GestorPedidosSoaco",
    [string]$ServicoDisplay = "Gestor Pedidos SoAco (producao)",
    [string]$NssmDir = "C:\tools\nssm"
)

$ErrorActionPreference = "Stop"

if (-not $PastaProjeto) {
    $PastaProjeto = Split-Path $PSScriptRoot -Parent
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
    throw "Execute como Administrador."
}

Set-Location $PastaProjeto

$nodeExe = (Get-Command node -ErrorAction Stop).Source
$serverJs = Join-Path $PastaProjeto "backend\dist\server.js"
if (-not (Test-Path $serverJs)) {
    throw "backend\dist\server.js nao encontrado. Rode npm run build:production antes."
}

# Baixa NSSM se necessario
$nssmExe = Join-Path $NssmDir "nssm.exe"
if (-not (Test-Path $nssmExe)) {
    Write-Host "Baixando NSSM..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $NssmDir | Out-Null
    $zipUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $zipPath = Join-Path $env:TEMP "nssm-2.24.zip"
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
    Expand-Archive -Path $zipPath -DestinationPath $env:TEMP -Force
    $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
    Copy-Item (Join-Path $env:TEMP "nssm-2.24\$arch\nssm.exe") $nssmExe -Force
}

$servicoExistente = Get-Service -Name $ServicoNome -ErrorAction SilentlyContinue
if ($servicoExistente) {
    Write-Host "Parando e removendo servico existente..." -ForegroundColor Yellow
    & $nssmExe stop $ServicoNome confirm
    & $nssmExe remove $ServicoNome confirm
    Start-Sleep -Seconds 2
}

Write-Host "Instalando servico $ServicoNome..." -ForegroundColor Cyan
& $nssmExe install $ServicoNome $nodeExe $serverJs
& $nssmExe set $ServicoNome DisplayName $ServicoDisplay
& $nssmExe set $ServicoNome Description "API Gestor Pedidos SoAco — producao (porta 4000)"
& $nssmExe set $ServicoNome AppDirectory (Join-Path $PastaProjeto "backend")
& $nssmExe set $ServicoNome AppEnvironmentExtra "NODE_ENV=production"
& $nssmExe set $ServicoNome AppStdout (Join-Path $PastaProjeto "backend\logs\service-stdout.log")
& $nssmExe set $ServicoNome AppStderr (Join-Path $PastaProjeto "backend\logs\service-stderr.log")
& $nssmExe set $ServicoNome AppRotateFiles 1
& $nssmExe set $ServicoNome AppRotateBytes 10485760
& $nssmExe set $ServicoNome Start SERVICE_AUTO_START

New-Item -ItemType Directory -Force -Path (Join-Path $PastaProjeto "backend\logs") | Out-Null

$ensureWordDirs = Join-Path $PastaProjeto "scripts\ensure-word-com-dirs.ps1"
if (Test-Path $ensureWordDirs) {
    Write-Host "Garantindo pastas Word COM (LocalSystem)..." -ForegroundColor Cyan
    & $ensureWordDirs
}

& $nssmExe start $ServicoNome
Start-Sleep -Seconds 3

$st = (Get-Service -Name $ServicoNome).Status
Write-Host "Servico $ServicoNome : $st" -ForegroundColor Green
Write-Host ""
Write-Host "Comandos uteis:" -ForegroundColor Cyan
Write-Host "  Get-Service $ServicoNome"
Write-Host "  Restart-Service $ServicoNome"
Write-Host "  & '$nssmExe' status $ServicoNome"
