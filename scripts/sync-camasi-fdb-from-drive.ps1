# Copia LOCAL.FDB do Google Drive para pasta local (Firebird enxerga disco fixo; letra G: de Drive
# mapeada no Explorer NAO e visivel para o servico Firebird / sessoes de servico).
#
# Uso (no PC onde o Drive esta logado e o G: aparece no Explorer):
#   powershell -ExecutionPolicy Bypass -File scripts/sync-camasi-fdb-from-drive.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/sync-camasi-fdb-from-drive.ps1 -AtualizarEnv
#   powershell -ExecutionPolicy Bypass -File scripts/sync-camasi-fdb-from-drive.ps1 -SomenteVerificar
#
# Destino padrao (dev e VPS): C:\bdcamasi\LOCAL.FDB

param(
    [string]$SourcePath = "G:\Meu Drive\DADOS.CAMASI\R_drive\Dados\Terminais\01\LOCAL.FDB",
    [string]$DestPath = "C:\bdcamasi\LOCAL.FDB",
    [switch]$AtualizarEnv,
    [switch]$SomenteVerificar,
    [switch]$Force,
    [string]$SysdbaPassword = "masterkey"
)

$ErrorActionPreference = "Stop"
$PastaProjeto = Split-Path $PSScriptRoot -Parent

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

function Test-FirebirdAttach {
    param([string]$Database, [string]$Password)
    $isql = "C:\Program Files\Firebird\Firebird_2_5\bin\isql.exe"
    if (-not (Test-Path -LiteralPath $isql)) {
        return @{ ok = $false; mensagem = "isql nao encontrado (instale Firebird 2.5)." }
    }
    if (-not (Test-Path -LiteralPath $Database)) {
        return @{ ok = $false; mensagem = "Arquivo FDB ausente: $Database" }
    }
    $sqlFile = Join-Path $env:TEMP "camasi-sync-test-$PID.sql"
    Set-Content -LiteralPath $sqlFile -Value "SELECT 1 AS OK FROM RDB`$DATABASE; QUIT;" -Encoding ASCII
    try {
        $out = & $isql -user SYSDBA -password $Password "localhost:$Database" -i $sqlFile 2>&1 | Out-String
        if ($out -match 'Statement failed|Can.t attach|error|Unable to complete') {
            return @{ ok = $false; mensagem = $out.Trim() }
        }
        return @{ ok = $true; mensagem = "Attach Firebird OK em $Database" }
    } finally {
        Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
    }
}

function Set-CamasiEnvPath {
    param([string]$FdbPath)
    $envFile = Join-Path $PastaProjeto "backend\.env"
    if (-not (Test-Path -LiteralPath $envFile)) {
        throw "backend\.env nao encontrado em $envFile"
    }
    $lines = Get-Content -LiteralPath $envFile
    $found = $false
    $out = foreach ($line in $lines) {
        if ($line -match '^\s*CAMASI_FDB_PATH\s*=') {
            $found = $true
            "CAMASI_FDB_PATH=$FdbPath"
        } else {
            $line
        }
    }
    if (-not $found) {
        $out += ""
        $out += "# Camasi / Firebird (Produção Camasi)"
        $out += "CAMASI_FDB_PATH=$FdbPath"
        $out += "CAMASI_FDB_HOST=127.0.0.1"
        $out += "CAMASI_FDB_PORT=3050"
        $out += "CAMASI_FDB_USER=SYSDBA"
        $out += "CAMASI_FDB_PASSWORD=$SysdbaPassword"
    }
    Set-Content -LiteralPath $envFile -Value $out -Encoding UTF8
    Write-Host "CAMASI_FDB_PATH atualizado em backend\.env -> $FdbPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Sync Camasi FDB (Google Drive -> local) ===" -ForegroundColor Cyan
Write-Host "Origem : $SourcePath"
Write-Host "Destino: $DestPath"
Write-Host ""

if (-not (Test-Path -LiteralPath $SourcePath)) {
    Write-Host "Origem nao encontrada." -ForegroundColor Red
    Write-Host "Abra o Google Drive for Desktop logado (tecnologia.dados@...) e confirme no Explorer:" -ForegroundColor Yellow
    Write-Host "  $SourcePath"
    Write-Host "Depois rode este script de novo no mesmo usuario do Explorer (nao como servico)."
    exit 1
}

$src = Get-Item -LiteralPath $SourcePath
Write-Host ("Origem OK: {0:N0} bytes, alterado {1}" -f $src.Length, $src.LastWriteTime)

if ($SomenteVerificar) {
    if (Test-Path -LiteralPath $DestPath) {
        $dst = Get-Item -LiteralPath $DestPath
        Write-Host ("Destino existe: {0:N0} bytes, alterado {1}" -f $dst.Length, $dst.LastWriteTime)
    } else {
        Write-Host "Destino ainda nao existe." -ForegroundColor Yellow
    }
    exit 0
}

$destDir = Split-Path $DestPath -Parent
if (-not (Test-Path -LiteralPath $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

# Nao sobrescrever se origem for menor que 50% do destino atual (protecao)
if (Test-Path -LiteralPath $DestPath) {
    $dst = Get-Item -LiteralPath $DestPath
    if (-not $Force -and $dst.Length -gt 0 -and $src.Length -lt ([math]::Floor($dst.Length * 0.5))) {
        Write-Host ("AVISO: origem ({0:N0} bytes) muito menor que destino atual ({1:N0})." -f $src.Length, $dst.Length) -ForegroundColor Yellow
        throw "Copia abortada por seguranca (origem << destino). Use -Force se for intencional."
    }
}

Copy-Item -LiteralPath $SourcePath -Destination $DestPath -Force
$copied = Get-Item -LiteralPath $DestPath
Write-Host ("Copia OK: {0:N0} bytes -> {1}" -f $copied.Length, $DestPath) -ForegroundColor Green

if ($AtualizarEnv) {
    Set-CamasiEnvPath -FdbPath $DestPath
}

if (-not (Test-TcpPort -HostName "127.0.0.1" -Port 3050)) {
    Write-Host "Porta 3050 fechada — rode scripts/setup-camasi-firebird.ps1 se necessario." -ForegroundColor Yellow
} else {
    $test = Test-FirebirdAttach -Database $DestPath -Password $SysdbaPassword
    Write-Host $test.mensagem -ForegroundColor $(if ($test.ok) { "Green" } else { "Red" })
    if (-not $test.ok) { exit 1 }
}

Write-Host ""
Write-Host "Pronto. Reinicie o backend (dev:start ou servico na VPS) se o .env mudou." -ForegroundColor Cyan
Write-Host "Painel: /producao/camasi | Status API: /api/producao-camasi/status" -ForegroundColor Cyan
Write-Host ""
