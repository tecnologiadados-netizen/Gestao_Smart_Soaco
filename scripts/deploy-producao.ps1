# Deploy producao via GitHub (VPS Hostinger / Windows).
# Fonte da verdade: branch main no GitHub. Nao edite arquivos .ts/.tsx na VPS.
#
# Estrategia de downtime minimo:
#   1) sync + npm install + build COM o sistema ONLINE
#   2) cutover curto: parar -> prisma generate + migrate -> subir
#   (antes o sistema ficava fora durante install+build inteiros)

param(
    [string]$PastaProjeto = "",
    [string]$ServicoNome = "GestorPedidosSoaco",
    [switch]$SemMigrate,
    [switch]$SemRestart,
    [switch]$ForcarNpmInstall
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

function Stop-NodeDoProjeto {
    param([string]$PastaProjeto)
    # Mata qualquer node do projeto que possa segurar query_engine-windows.dll.node
    # (server, tsx scripts, npx, etc). Nao mexe no node embutido do Cursor/VS Code.
    $rootNorm = $PastaProjeto.Replace('/', '\').TrimEnd('\').ToLowerInvariant()
    $killed = @()
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
        $cmd = [string]$_.CommandLine
        $exe = [string]$_.ExecutablePath
        if (-not $cmd) { return }
        if ($exe -match '(?i)[\\/]cursor[\\/]|[\\/]Code[\\/]|vscode') { return }
        $cmdNorm = $cmd.Replace('/', '\').ToLowerInvariant()
        if ($cmdNorm.Contains($rootNorm) -or $cmdNorm.Contains('gestorpedidos')) {
            Stop-ProcessTree -ProcessId $_.ProcessId
            $killed += $_.ProcessId
        }
    }
    if ($killed.Count -gt 0) {
        Write-Host "Encerrados processos Node do projeto (PIDs: $($killed -join ', '))..." -ForegroundColor Yellow
        Start-Sleep -Seconds 1
    }
}

function Unlock-PrismaQueryEngine {
    param([string]$PastaProjeto)
    $clientDir = Join-Path $PastaProjeto "backend\node_modules\.prisma\client"
    $engine = Join-Path $clientDir "query_engine-windows.dll.node"
    if (-not (Test-Path $clientDir)) { return }

    Stop-NodeDoProjeto -PastaProjeto $PastaProjeto

    # Remove/renomeia o DLL travado para o prisma generate conseguir gravar o novo.
    if (Test-Path $engine) {
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        Remove-Item -LiteralPath $engine -Force -ErrorAction SilentlyContinue
        if (Test-Path $engine) {
            $bak = "$engine.old_$(Get-Date -Format 'yyyyMMddHHmmss')"
            Rename-Item -LiteralPath $engine -NewName (Split-Path $bak -Leaf) -Force -ErrorAction SilentlyContinue
        }
        $ErrorActionPreference = $prevEap
    }
    Get-ChildItem -LiteralPath $clientDir -Filter "query_engine-windows.dll.node.tmp*" -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -LiteralPath $clientDir -Filter "query_engine-windows.dll.node.old_*" -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

function Stop-ProducaoParaDeploy {
    param(
        [string]$ServicoNome,
        [int]$Port,
        [string]$PastaProjeto,
        [ref]$EstavaRodando
    )

    $svc = Get-Service -Name $ServicoNome -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        Write-Host "Parando servico $ServicoNome..." -ForegroundColor Yellow
        Stop-Service -Name $ServicoNome -Force
        $EstavaRodando.Value = $true
        $deadline = (Get-Date).AddSeconds(20)
        while ((Get-Service $ServicoNome).Status -ne "Stopped" -and (Get-Date) -lt $deadline) {
            Start-Sleep -Milliseconds 500
        }
    } elseif ($svc -and $svc.Status -ne "Stopped") {
        $EstavaRodando.Value = $true
    }

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    npm run dev:stop 2>&1 | Out-Null
    $ErrorActionPreference = $prevEap

    # Antes: so matava server.js / tsx watch. Scripts tsx/npx orfaos seguravam o DLL do Prisma (EPERM).
    Stop-NodeDoProjeto -PastaProjeto $PastaProjeto

    for ($attempt = 1; $attempt -le 8; $attempt++) {
        $pids = Get-PidsOnPort -Port $Port
        if ($pids.Count -eq 0) { break }
        Write-Host "Porta $Port ainda em uso (PIDs: $($pids -join ', ')) - tentativa $attempt..." -ForegroundColor Yellow
        foreach ($pid in $pids) { Stop-ProcessTree -ProcessId $pid }
        Start-Sleep -Seconds 1
    }

    $rest = Get-PidsOnPort -Port $Port
    if ($rest.Count -gt 0) {
        throw "Porta $Port ainda ocupada (PIDs: $($rest -join ', ')). Pare o processo manualmente e rode o deploy de novo."
    }
}

function Invoke-PrismaGenerate {
    param(
        [string]$PastaProjeto,
        [string]$Label = "prisma generate",
        [int]$MaxAttempts = 6
    )
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        Unlock-PrismaQueryEngine -PastaProjeto $PastaProjeto
        Write-Host "$Label (tentativa $attempt/$MaxAttempts)..." -ForegroundColor Cyan
        npm run generate --prefix backend
        if ($LASTEXITCODE -eq 0) { return }
        if ($attempt -lt $MaxAttempts) {
            Write-Host "prisma generate bloqueado (EPERM?) - liberando query engine e tentando de novo..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }
    }
    throw "prisma generate falhou apos $MaxAttempts tentativas (arquivo query_engine-windows.dll.node em uso)."
}

function Stop-GitOrfaosNoProjeto {
    $root = (Get-Location).Path.ToLower()
    Get-CimInstance Win32_Process -Filter "Name='git.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
        $cmd = [string]$_.CommandLine
        if ($cmd.ToLower().Contains($root) -or $cmd.ToLower().Contains('gestorpedidos')) {
            Stop-ProcessTree -ProcessId $_.ProcessId
        }
    }
    Start-Sleep -Seconds 1
}

function Sync-GitComOriginMain {
    param([string]$GitExe)
    $env:GIT_TERMINAL_PROMPT = '0'
    $env:GIT_OPTIONAL_LOCKS = '0'

    for ($attempt = 1; $attempt -le 8; $attempt++) {
        Stop-GitOrfaosNoProjeto

        & $GitExe -c gc.auto=0 fetch origin main
        if ($LASTEXITCODE -ne 0) {
            Write-Host "git fetch falhou (tentativa $attempt)..." -ForegroundColor Yellow
            Start-Sleep -Seconds 4
            continue
        }

        $resetOk = $false
        for ($r = 1; $r -le 5; $r++) {
            $stdin = ('y' + [Environment]::NewLine) * 15
            $stdin | & $GitExe -c gc.auto=0 reset --hard origin/main 2>&1 | Out-Host
            if ($LASTEXITCODE -eq 0) {
                $resetOk = $true
                break
            }
            Write-Host "git reset bloqueado (tentativa $attempt/$r)..." -ForegroundColor Yellow
            Stop-GitOrfaosNoProjeto
            Start-Sleep -Seconds 4
        }
        if ($resetOk) { return }
    }
    throw "git sync com origin/main falhou (pack .idx bloqueado no Windows - feche IDEs/git e tente de novo)."
}

function Get-NpmLockFingerprint {
    $parts = @()
    foreach ($rel in @("package-lock.json", "backend\package-lock.json", "frontend\package-lock.json")) {
        $full = Join-Path $PastaProjeto $rel
        if (Test-Path -LiteralPath $full) {
            $hash = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash
            $parts += "$rel=$hash"
        } else {
            $parts += "$rel=missing"
        }
    }
    return ($parts -join "|")
}

function Test-NpmInstallNecessario {
    param([switch]$Forcar)
    if ($Forcar) { return $true }
    $markerDir = Join-Path $PastaProjeto "backend\var"
    $marker = Join-Path $markerDir ".deploy-npm-lock-fingerprint"
    $current = Get-NpmLockFingerprint
    if (-not (Test-Path -LiteralPath $marker)) { return $true }
    $prev = (Get-Content -LiteralPath $marker -Raw -ErrorAction SilentlyContinue)
    if (-not $prev) { return $true }
    return ($prev.Trim() -ne $current)
}

function Save-NpmLockFingerprint {
    $markerDir = Join-Path $PastaProjeto "backend\var"
    if (-not (Test-Path -LiteralPath $markerDir)) {
        New-Item -ItemType Directory -Path $markerDir -Force | Out-Null
    }
    $marker = Join-Path $markerDir ".deploy-npm-lock-fingerprint"
    Set-Content -LiteralPath $marker -Value (Get-NpmLockFingerprint) -Encoding UTF8
}

function Invoke-NpmInstalls {
    param([string]$FaseLabel)
    # Instalacao precisa de devDependencies (typescript, vite). NODE_ENV=production no .env omitiria isso.
    $prevNodeEnv = $env:NODE_ENV
    $env:NODE_ENV = "development"
    try {
        Invoke-NpmStep "$FaseLabel npm install (raiz)..." { npm install }
        Invoke-NpmStep "$FaseLabel npm install (backend)..." { npm install --prefix backend }
        Invoke-NpmStep "$FaseLabel npm install (frontend)..." { npm install --prefix frontend }
        Save-NpmLockFingerprint
    } finally {
        $env:NODE_ENV = $prevNodeEnv
    }
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
Write-Host "Modo:   build ONLINE + cutover curto (generate/migrate/restart)" -ForegroundColor DarkCyan
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
$nodeEnvAnterior = $env:NODE_ENV
$cutoverInicio = $null
$npmInstallPendente = $false

try {
    $branch = & $Git branch --show-current
    if ($branch -ne "main") {
        & $Git fetch origin
        & $Git checkout main
    }

    Write-Host "[1/8] Sincronizando com origin/main (sistema ONLINE)..." -ForegroundColor Cyan
    Sync-GitComOriginMain -GitExe $Git

    # --- Fase ONLINE: install + build (usuario continua usando o sistema) ---
    Write-Host ""
    Write-Host "=== Fase ONLINE (producao continua no ar) ===" -ForegroundColor Green

    $precisaInstall = Test-NpmInstallNecessario -Forcar:$ForcarNpmInstall
    if ($precisaInstall) {
        try {
            Invoke-NpmInstalls -FaseLabel "[2/8]"
        } catch {
            Write-Host "npm install online falhou (arquivos travados pelo Node?). Reintentara no cutover." -ForegroundColor Yellow
            Write-Host "  Detalhe: $($_.Exception.Message)" -ForegroundColor DarkYellow
            $npmInstallPendente = $true
        }
    } else {
        Write-Host "[2/8] npm install ignorado (package-lock inalterado). Use -ForcarNpmInstall se necessario." -ForegroundColor DarkCyan
    }

    Write-Host "[3/8] npm run build:production (sistema ONLINE)..." -ForegroundColor Cyan
    $env:NODE_ENV = "production"
    $buildOnlineOk = $false
    try {
        npm run build:production
        if ($LASTEXITCODE -eq 0) {
            $buildOnlineOk = $true
        } else {
            Write-Host "Build online retornou codigo $LASTEXITCODE - reintentara no cutover." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Build online falhou - reintentara no cutover. $($_.Exception.Message)" -ForegroundColor Yellow
    }
    $env:NODE_ENV = $nodeEnvAnterior

    $ensureWordDirs = Join-Path $PastaProjeto "scripts\ensure-word-com-dirs.ps1"
    if (Test-Path $ensureWordDirs) {
        & $ensureWordDirs
    }

    $clearGenPy = Join-Path $PastaProjeto "scripts\clear-win32com-genpy.ps1"
    if (Test-Path $clearGenPy) {
        & $clearGenPy
    }

    # --- CUTOVER: unico intervalo em que o sistema fica fora ---
    Write-Host ""
    Write-Host "=== CUTOVER (sistema fora do ar — generate + migrate + restart) ===" -ForegroundColor Yellow
    $cutoverInicio = Get-Date

    Write-Host "[4/8] Parando producao..." -ForegroundColor Cyan
    Stop-ProducaoParaDeploy -ServicoNome $ServicoNome -Port $port -PastaProjeto $PastaProjeto -EstavaRodando ([ref]$servicoEstavaRodando)

    if ($npmInstallPendente -or $ForcarNpmInstall) {
        if ($npmInstallPendente) {
            Write-Host "[5/8] npm install (retry apos parar)..." -ForegroundColor Cyan
            Invoke-NpmInstalls -FaseLabel "[5/8]"
        }
    } else {
        Write-Host "[5/8] npm install no cutover: desnecessario." -ForegroundColor DarkCyan
    }

    Invoke-PrismaGenerate -PastaProjeto $PastaProjeto -Label "[6/8] prisma generate"

    if (-not $SemMigrate) {
        Write-Host "[7/8] prisma migrate deploy..." -ForegroundColor Cyan
        npm run migrate --prefix backend
        if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy falhou." }
    } else {
        Write-Host "[7/8] migrate pulado (-SemMigrate)." -ForegroundColor DarkCyan
    }

    if (-not $buildOnlineOk) {
        Write-Host "[7b/8] npm run build:production (retry no cutover)..." -ForegroundColor Cyan
        $env:NODE_ENV = "production"
        npm run build:production
        if ($LASTEXITCODE -ne 0) { throw "Build falhou." }
        $env:NODE_ENV = $nodeEnvAnterior
    }

    Write-Host "[8/8] Reiniciar producao..." -ForegroundColor Cyan
    if (-not $SemRestart) {
        if ($servico) {
            Start-Service -Name $ServicoNome
            Start-Sleep -Seconds 2
            Write-Host "Servico $ServicoNome : $((Get-Service $ServicoNome).Status)" -ForegroundColor Green
        } else {
            Start-Process -FilePath "node" -ArgumentList "dist/server.js" -WorkingDirectory (Join-Path $PastaProjeto "backend") -WindowStyle Hidden
            Start-Sleep -Seconds 2
            Write-Host "Node producao iniciado (sem servico NSSM)." -ForegroundColor Green
        }
    }

    $deadlineHealth = (Get-Date).AddSeconds(25)
    $resp = $null
    while ((Get-Date) -lt $deadlineHealth) {
        try {
            $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 5
            if ($resp.ok -eq $true) { break }
        } catch {
            Start-Sleep -Milliseconds 800
        }
    }
    if ($null -eq $resp -or $resp.ok -ne $true) { throw "Health check falhou." }

    $cutoverSegundos = [math]::Round(((Get-Date) - $cutoverInicio).TotalSeconds, 1)
    Write-Host "Health OK - build $($resp.build), db $($resp.db)" -ForegroundColor Green
    Write-Host "Tempo fora do ar (cutover): ${cutoverSegundos}s" -ForegroundColor Green
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
    $env:NODE_ENV = $nodeEnvAnterior
    Write-Host ""
    Write-Host "ERRO NO DEPLOY: $($_.Exception.Message)" -ForegroundColor Red
    if ($null -ne $cutoverInicio) {
        $cutoverSegundos = [math]::Round(((Get-Date) - $cutoverInicio).TotalSeconds, 1)
        Write-Host "Cutover interrompido apos ${cutoverSegundos}s fora do ar." -ForegroundColor Yellow
    }
    Restore-ProducaoSeParada -ServicoExistia $servicoExistia -EstavaRodando $servicoEstavaRodando -ServicoNome $ServicoNome -PastaProjeto $PastaProjeto -Port $port
    exit 1
}
