# Deploy producao via GitHub (VPS Hostinger / Windows).
# Fonte da verdade: branch main no GitHub. Nao edite arquivos .ts/.tsx na VPS.

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

function Invoke-NpmStep {
    param([string]$Label, [scriptblock]$Command)
    Write-Host $Label -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Falhou: $Label"
    }
}

function Get-PidsOnPort {
    param([int]$Port)
    $pids = @()
    $lines = netstat -ano -p tcp 2>$null | Select-String "LISTENING" | Select-String ":$Port\s"
    foreach ($line in $lines) {
        $parts = ($line -replace '\s+', ' ').Trim().Split(' ')
        $pid = [int]$parts[-1]
        if ($pid -gt 0) { $pids += $pid }
    }
    return $pids | Select-Object -Unique
}

function Stop-ProcessTree {
    param([int]$ProcessId)
    if ($ProcessId -le 0) { return }
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    taskkill /F /T /PID $ProcessId 2>&1 | Out-Null
    $ErrorActionPreference = $prevEap
}

function Stop-ProducaoParaDeploy {
    param(
        [string]$ServicoNome,
        [int]$Port,
        [ref]$EstavaRodando
    )

    $svc = Get-Service -Name $ServicoNome -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        Write-Host "[2/9] Parando servico $ServicoNome..." -ForegroundColor Yellow
        Stop-Service -Name $ServicoNome -Force
        $EstavaRodando.Value = $true
        $deadline = (Get-Date).AddSeconds(30)
        while ((Get-Service $ServicoNome).Status -ne "Stopped" -and (Get-Date) -lt $deadline) {
            Start-Sleep -Seconds 1
        }
        Start-Sleep -Seconds 2
    }

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    npm run dev:stop 2>&1 | Out-Null
    $ErrorActionPreference = $prevEap
    Start-Sleep -Seconds 2

    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
        $cmd = [string]$_.CommandLine
        if ($cmd -match 'dist[\\/]server\.js' -or ($cmd -match 'tsx watch' -and $cmd -match 'server\.ts')) {
            Stop-ProcessTree -ProcessId $_.ProcessId
        }
    }
    Start-Sleep -Seconds 2

    for ($attempt = 1; $attempt -le 8; $attempt++) {
        $pids = Get-PidsOnPort -Port $Port
        if ($pids.Count -eq 0) { break }
        Write-Host "[2/9] Porta $Port ainda em uso (PIDs: $($pids -join ', ')) - tentativa $attempt..." -ForegroundColor Yellow
        foreach ($pid in $pids) { Stop-ProcessTree -ProcessId $pid }
        Start-Sleep -Seconds 2
    }

    $rest = Get-PidsOnPort -Port $Port
    if ($rest.Count -gt 0) {
        throw "Porta $Port ainda ocupada (PIDs: $($rest -join ', ')). Pare o processo manualmente e rode o deploy de novo."
    }
}

function Invoke-PrismaGenerate {
    param([int]$MaxAttempts = 6)
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        Write-Host "[6/9] prisma generate (tentativa $attempt/$MaxAttempts)..." -ForegroundColor Cyan
        npm run generate --prefix backend
        if ($LASTEXITCODE -eq 0) { return }
        if ($attempt -lt $MaxAttempts) {
            Write-Host "prisma generate bloqueado (EPERM?) - aguardando liberacao do query engine..." -ForegroundColor Yellow
            Start-Sleep -Seconds 4
        }
    }
    throw "prisma generate falhou apos $MaxAttempts tentativas (arquivo query_engine-windows.dll.node em uso)."
}

function Restore-ProducaoSeParada {
    param([bool]$ServicoExistia, [bool]$EstavaRodando, [string]$ServicoNome, [string]$PastaProjeto, [int]$Port)
    if (-not $EstavaRodando) { return }
    Write-Host ""
    Write-Host "RESTAURANDO producao (deploy falhou mas servico estava ativo)..." -ForegroundColor Red
    $svc = Get-Service -Name $ServicoNome -ErrorAction SilentlyContinue
    if ($svc) {
        Start-Service -Name $ServicoNome -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
    } elseif (Test-Path (Join-Path $PastaProjeto "backend\dist\server.js")) {
        $env:NODE_ENV = "production"
        Start-Process -FilePath "node" -ArgumentList "dist/server.js" -WorkingDirectory (Join-Path $PastaProjeto "backend") -WindowStyle Hidden
        Start-Sleep -Seconds 3
    }
    try {
        Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 10 | Out-Null
        Write-Host "Producao restaurada em :$Port" -ForegroundColor Green
    } catch {
        Write-Host "Nao foi possivel restaurar automaticamente. Rode: powershell -File scripts/restart-producao.ps1" -ForegroundColor Red
    }
}

$Git = Find-Git
Set-Location $PastaProjeto

$env:Path = "C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;$env:Path"
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm nao encontrado."
}

Write-Host ""
Write-Host "=== Deploy producao - Gestor Pedidos SoAco (via GitHub main) ===" -ForegroundColor Cyan
Write-Host "Pasta:  $PastaProjeto"
Write-Host "Horario: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

if (-not (Test-Path "backend\.env")) {
    throw "backend\.env nao encontrado."
}

$port = 4000
$envFile = Get-Content "backend\.env" -ErrorAction SilentlyContinue
foreach ($line in $envFile) {
    if ($line -match '^\s*APP_PORT\s*=\s*(\d+)') {
        $port = [int]$Matches[1]
        break
    }
}

$servicoEstavaRodando = $false
$servico = Get-Service -Name $ServicoNome -ErrorAction SilentlyContinue
$servicoExistia = [bool]$servico

try {
    $branch = & $Git branch --show-current
    if ($branch -ne "main") {
        & $Git fetch origin
        & $Git checkout main
    }

    Write-Host "[1/9] Sincronizando com origin/main..." -ForegroundColor Cyan
    & $Git fetch origin
    if ($LASTEXITCODE -ne 0) { throw "git fetch origin falhou." }
    & $Git reset --hard origin/main
    if ($LASTEXITCODE -ne 0) { throw "git reset --hard origin/main falhou." }

    Stop-ProducaoParaDeploy -ServicoNome $ServicoNome -Port $port -EstavaRodando ([ref]$servicoEstavaRodando)

    Invoke-NpmStep "[3/9] npm install (raiz)..." { npm install }
    Invoke-NpmStep "[4/9] npm install (backend)..." { npm install --prefix backend }
    Invoke-NpmStep "[5/9] npm install (frontend)..." { npm install --prefix frontend }
    Invoke-PrismaGenerate

    if (-not $SemMigrate) {
        Write-Host "[7/9] prisma migrate deploy..." -ForegroundColor Cyan
        npm run migrate --prefix backend
        if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy falhou." }
    }

    Write-Host "[8/9] npm run build:production..." -ForegroundColor Cyan
    $env:NODE_ENV = "production"
    npm run build:production
    if ($LASTEXITCODE -ne 0) { throw "Build falhou." }

    $ensureWordDirs = Join-Path $PastaProjeto "scripts\ensure-word-com-dirs.ps1"
    if (Test-Path $ensureWordDirs) {
        & $ensureWordDirs
    }

    Write-Host "[9/9] Reiniciar producao..." -ForegroundColor Cyan
    if (-not $SemRestart) {
        if ($servico) {
            Start-Service -Name $ServicoNome
            Start-Sleep -Seconds 3
            Write-Host "Servico $ServicoNome : $((Get-Service $ServicoNome).Status)" -ForegroundColor Green
        } else {
            Start-Process -FilePath "node" -ArgumentList "dist/server.js" -WorkingDirectory (Join-Path $PastaProjeto "backend") -WindowStyle Hidden
            Start-Sleep -Seconds 3
            Write-Host "Node producao iniciado (sem servico NSSM)." -ForegroundColor Green
        }
    }

    Start-Sleep -Seconds 2
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 15
    if ($resp.ok -ne $true) { throw "Health check falhou." }
    Write-Host "Health OK - build $($resp.build), db $($resp.db)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configurando portproxy 80 -> 4000 (producao)..." -ForegroundColor Cyan
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $portproxyScript = Join-Path $PastaProjeto "deploy\setup-domain-http.ps1"
    if (Test-Path $portproxyScript) {
        & $portproxyScript 2>&1 | Out-Null
    }
    $ErrorActionPreference = $prevEap
    Write-Host "Deploy concluido com sucesso." -ForegroundColor Green
    Write-Host "Ctrl+Shift+R em gsmartsoaco.com.br apos deploy." -ForegroundColor Yellow

} catch {
    Write-Host ""
    Write-Host "ERRO NO DEPLOY: $($_.Exception.Message)" -ForegroundColor Red
    Restore-ProducaoSeParada -ServicoExistia $servicoExistia -EstavaRodando $servicoEstavaRodando -ServicoNome $ServicoNome -PastaProjeto $PastaProjeto -Port $port
    exit 1
}
