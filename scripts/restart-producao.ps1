# Sobe producao rapidamente (emergencia quando o site caiu).
# Uso: powershell -File scripts/restart-producao.ps1

param(
    [string]$PastaProjeto = "",
    [string]$ServicoNome = "GestorPedidosSoaco"
)

$ErrorActionPreference = "Stop"
if (-not $PastaProjeto) { $PastaProjeto = Split-Path $PSScriptRoot -Parent }
Set-Location $PastaProjeto
$env:Path = "C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;$env:Path"
$env:NODE_ENV = "production"

if (-not (Test-Path "backend\dist\server.js")) {
    Write-Host "dist/server.js ausente - executando build..." -ForegroundColor Yellow
    npm run build:production
    if ($LASTEXITCODE -ne 0) { throw "Build falhou." }
}

$ensureWordDirs = Join-Path $PastaProjeto "scripts\ensure-word-com-dirs.ps1"
if (Test-Path $ensureWordDirs) {
    & $ensureWordDirs
}

$clearGenPy = Join-Path $PastaProjeto "scripts\clear-win32com-genpy.ps1"
if (Test-Path $clearGenPy) {
    & $clearGenPy
}

$servico = Get-Service -Name $ServicoNome -ErrorAction SilentlyContinue
if ($servico) {
    if ($servico.Status -eq "Running") {
        Restart-Service -Name $ServicoNome -Force
    } else {
        Start-Service -Name $ServicoNome
    }
    Write-Host "Servico $ServicoNome iniciado." -ForegroundColor Green
} else {
    Write-Host "Servico NSSM nao encontrado - subindo Node em background..." -ForegroundColor Yellow
    Start-Process -FilePath "node" -ArgumentList "dist/server.js" -WorkingDirectory (Join-Path $PastaProjeto "backend") -WindowStyle Hidden
}

Start-Sleep -Seconds 3
$port = 4000
try {
    $r = Invoke-RestMethod "http://127.0.0.1:$port/health" -TimeoutSec 10
    Write-Host "Health OK - build $($r.build)" -ForegroundColor Green
} catch {
    Write-Host "Servidor nao respondeu em :$port/health" -ForegroundColor Red
    exit 1
}

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& (Join-Path $PastaProjeto "deploy\setup-domain-http.ps1") 2>&1 | Out-Null
$ErrorActionPreference = $prevEap
Write-Host "Portproxy 80 -> 4000 aplicado." -ForegroundColor Green
