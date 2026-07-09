# Sobe o backend de producao no contexto do usuario logado (necessario para PDF via Word).
# O servico NSSM (LocalSystem) NAO consegue usar o Microsoft Word.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts/start-producao-usuario.ps1
#
# Para voltar ao servico NSSM:
#   Restart-Service GestorPedidosSoaco

param(
    [string]$PastaProjeto = ""
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

$servico = Get-Service -Name "GestorPedidosSoaco" -ErrorAction SilentlyContinue
if ($servico -and $servico.Status -eq "Running") {
    Write-Host "Parando servico NSSM (LocalSystem nao usa Word)..." -ForegroundColor Yellow
    Stop-Service -Name "GestorPedidosSoaco" -Force
    Start-Sleep -Seconds 2
}

# Libera porta 4000 se ocupada por outro node
$conns = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    $processId = $c.OwningProcess
    if ($processId -and $processId -ne 0) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
        if ($proc -and $proc.Name -eq "node.exe") {
            Write-Host "Encerrando node na porta 4000 (PID $processId)..." -ForegroundColor Yellow
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
    }
}

$logDir = Join-Path $PastaProjeto "backend\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$outLog = Join-Path $logDir "usuario-stdout.log"
$errLog = Join-Path $logDir "usuario-stderr.log"

Write-Host "Iniciando backend como $($env:USERDOMAIN)\$($env:USERNAME)..." -ForegroundColor Cyan
Start-Process -FilePath "node" `
    -ArgumentList "dist/server.js" `
    -WorkingDirectory (Join-Path $PastaProjeto "backend") `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog

Start-Sleep -Seconds 4
try {
    $r = Invoke-RestMethod "http://127.0.0.1:4000/health" -TimeoutSec 10
    Write-Host "Health OK - build $($r.build)" -ForegroundColor Green
} catch {
    Write-Host "Servidor nao respondeu. Veja $errLog" -ForegroundColor Red
    if (Test-Path $errLog) { Get-Content $errLog -Tail 20 }
    exit 1
}

Write-Host "Backend rodando com usuario logado (Word disponivel para PDFs)." -ForegroundColor Green
