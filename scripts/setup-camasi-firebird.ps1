# Setup Firebird 2.5 para o painel Produção Camasi (RICMAQ).
# Nao altera SQLite, .env secrets alem de CAMASI_*, nem codigo da aplicacao.
#
# Uso (Administrador):
#   powershell -ExecutionPolicy Bypass -File scripts/setup-camasi-firebird.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/setup-camasi-firebird.ps1 -SomenteVerificar
#
# O banco RICMAQ.FDB desta VPS e ODS 11 (Firebird 2.x). Firebird 3+/5
# nao substitui o 2.5 aqui sem migracao do .FDB.

param(
    [string]$FdbPath = "",
    [string]$SysdbaPassword = "masterkey",
    [string]$InstallerDir = "C:\tools\firebird-setup",
    [switch]$SomenteVerificar,
    [switch]$PularDownload
)

$ErrorActionPreference = "Stop"

function Get-CamasiPathFromEnv {
    $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) "backend\.env"
    if (-not (Test-Path -LiteralPath $envFile)) { return $null }
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -match '^\s*CAMASI_FDB_PATH\s*=\s*(.+)\s*$') {
            return $Matches[1].Trim().Trim('"')
        }
    }
    return $null
}

function Test-TcpPort {
    param([string]$HostName, [int]$Port)
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $c.Connect($HostName, $Port)
        $c.Close()
        return $true
    } catch {
        return $false
    }
}

function Test-RicmaqAttach {
    param([string]$Database, [string]$Password)
    $isql = "C:\Program Files\Firebird\Firebird_2_5\bin\isql.exe"
    if (-not (Test-Path -LiteralPath $isql)) {
        return @{ ok = $false; mensagem = "isql nao encontrado (Firebird 2.5 nao instalado)." }
    }
    if (-not (Test-Path -LiteralPath $Database)) {
        return @{ ok = $false; mensagem = "Arquivo FDB ausente: $Database" }
    }
    $sqlFile = Join-Path $env:TEMP "camasi-fb-test-$PID.sql"
    Set-Content -LiteralPath $sqlFile -Value "SELECT 1 AS OK FROM RDB`$DATABASE; QUIT;" -Encoding ASCII
    try {
        $out = & $isql -user SYSDBA -password $Password "localhost:$Database" -i $sqlFile 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0 -and $out -notmatch '\b1\b') {
            return @{ ok = $false; mensagem = $out.Trim() }
        }
        if ($out -match 'Statement failed|Can.t attach|error') {
            return @{ ok = $false; mensagem = $out.Trim() }
        }
        return @{ ok = $true; mensagem = "Attach Firebird OK em $Database" }
    } finally {
        Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
    }
}

if (-not $FdbPath) {
    $fromEnv = Get-CamasiPathFromEnv
    $FdbPath = if ($fromEnv) { $fromEnv } else { "C:\bdcamasi\RICMAQ.FDB" }
}

Write-Host ""
Write-Host "=== Setup Camasi / Firebird 2.5 (RICMAQ) ===" -ForegroundColor Cyan
Write-Host "FDB: $FdbPath"
Write-Host ""

$svc = Get-Service -Name "FirebirdServerDefaultInstance" -ErrorAction SilentlyContinue
$portOk = Test-TcpPort -HostName "127.0.0.1" -Port 3050

if ($SomenteVerificar) {
    Write-Host "Servico FirebirdServerDefaultInstance: $(if ($svc) { $svc.Status } else { 'ausente' })"
    Write-Host "Porta 3050: $(if ($portOk) { 'OK' } else { 'fechada' })"
    $test = Test-RicmaqAttach -Database $FdbPath -Password $SysdbaPassword
    Write-Host $test.mensagem -ForegroundColor $(if ($test.ok) { "Green" } else { "Red" })
    if (-not $test.ok) { exit 1 }
    exit 0
}

if (-not $svc) {
    if ($PularDownload) {
        throw "Firebird nao instalado e -PularDownload foi informado."
    }
    New-Item -ItemType Directory -Path $InstallerDir -Force | Out-Null
    $url = "https://github.com/FirebirdSQL/firebird/releases/download/R2_5_9/Firebird-2.5.9.27139_0_x64.exe"
    $installer = Join-Path $InstallerDir "Firebird-2.5.9.27139_0_x64.exe"
    if (-not (Test-Path -LiteralPath $installer)) {
        Write-Host "Baixando Firebird 2.5.9 x64..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing
    }
    $log = Join-Path $InstallerDir "install.log"
    Write-Host "Instalando Firebird 2.5.9 (servico, SuperServer, porta 3050)..." -ForegroundColor Cyan
    $p = Start-Process -FilePath $installer -ArgumentList @(
        "/SP-", "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART",
        "/SYSDBAPASSWORD=$SysdbaPassword", "/LOG=$log"
    ) -Wait -PassThru
    if ($p.ExitCode -ne 0) {
        throw "Instalador Firebird falhou (exit $($p.ExitCode)). Veja $log"
    }
    Start-Sleep -Seconds 3
    $svc = Get-Service -Name "FirebirdServerDefaultInstance" -ErrorAction SilentlyContinue
    if (-not $svc) { throw "Servico FirebirdServerDefaultInstance nao apareceu apos install." }
}

if ($svc.Status -ne "Running") {
    Write-Host "Iniciando FirebirdServerDefaultInstance..." -ForegroundColor Yellow
    Start-Service -Name "FirebirdServerDefaultInstance"
}
Set-Service -Name "FirebirdServerDefaultInstance" -StartupType Automatic -ErrorAction SilentlyContinue
$guard = Get-Service -Name "FirebirdGuardianDefaultInstance" -ErrorAction SilentlyContinue
if ($guard) {
    if ($guard.Status -ne "Running") { Start-Service -Name "FirebirdGuardianDefaultInstance" -ErrorAction SilentlyContinue }
    Set-Service -Name "FirebirdGuardianDefaultInstance" -StartupType Automatic -ErrorAction SilentlyContinue
}

if (-not (Test-Path -LiteralPath $FdbPath)) {
    throw "Arquivo FDB nao encontrado: $FdbPath (copie o RICMAQ.FDB sem sobrescrever backups)."
}

# Garante vars CAMASI no backend\.env sem remover outras chaves
$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) "backend\.env"
if (Test-Path -LiteralPath $envFile) {
    $raw = Get-Content -LiteralPath $envFile -Raw
    if ($raw -notmatch '(?m)^\s*CAMASI_FDB_PATH\s*=') {
        $block = @"

# Camasi / Firebird (Produção Camasi — RICMAQ)
CAMASI_FDB_PATH=$FdbPath
CAMASI_FDB_HOST=127.0.0.1
CAMASI_FDB_PORT=3050
CAMASI_FDB_USER=SYSDBA
CAMASI_FDB_PASSWORD=$SysdbaPassword
"@
        Add-Content -LiteralPath $envFile -Value $block -Encoding UTF8
        Write-Host "Vars CAMASI adicionadas em backend\.env" -ForegroundColor Green
    } else {
        Write-Host "Vars CAMASI ja presentes em backend\.env (preservadas)." -ForegroundColor DarkCyan
    }
}

$deadline = (Get-Date).AddSeconds(20)
while (-not (Test-TcpPort -HostName "127.0.0.1" -Port 3050) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
}
if (-not (Test-TcpPort -HostName "127.0.0.1" -Port 3050)) {
    throw "Porta 3050 nao esta escutando."
}

$test = Test-RicmaqAttach -Database $FdbPath -Password $SysdbaPassword
if (-not $test.ok) {
    throw "Falha no attach: $($test.mensagem)"
}

Write-Host $test.mensagem -ForegroundColor Green
Write-Host "Setup Camasi/Firebird concluido. Dashboard: /producao/camasi" -ForegroundColor Green
Write-Host "Se o Gestao ja estava no ar antes de instalar o Firebird, reinicie: Restart-Service GestorPedidosSoaco" -ForegroundColor Yellow
