# Prepara pasta de producao na VPS (clone limpo, branch main).
# Uso (como Administrador na VPS):
#   powershell -ExecutionPolicy Bypass -File scripts/setup-vps-producao.ps1 -RemoteUrl "https://github.com/ORG/gestor-pedidos-soaco.git"
#   powershell -ExecutionPolicy Bypass -File scripts/setup-vps-producao.ps1 -RemoteUrl "..." -PastaDestino "D:\apps\gestor-pedidos"

param(
    [Parameter(Mandatory = $true)]
    [string]$RemoteUrl,
    [string]$PastaDestino = "C:\apps\gestor-pedidos"
)

$ErrorActionPreference = "Stop"

function Find-Git {
    $candidatos = @("git", "C:\Program Files\Git\bin\git.exe")
    foreach ($c in $candidatos) {
        if (Get-Command $c -ErrorAction SilentlyContinue) { return $c }
        if (Test-Path $c) { return $c }
    }
    throw "Git nao encontrado."
}

$Git = Find-Git

if (Test-Path $PastaDestino) {
    $gitDir = Join-Path $PastaDestino ".git"
    if (Test-Path $gitDir) {
        Write-Host "Pasta ja existe com Git: $PastaDestino" -ForegroundColor Yellow
        Set-Location $PastaDestino
        & $Git fetch origin
        & $Git checkout main
        & $Git pull origin main
        Write-Host "Repositorio atualizado." -ForegroundColor Green
        exit 0
    }
    throw "Pasta $PastaDestino existe mas nao e um clone Git. Escolha outro destino ou remova manualmente."
}

$parent = Split-Path $PastaDestino -Parent
if (-not (Test-Path $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
}

Write-Host "Clonando $RemoteUrl -> $PastaDestino ..." -ForegroundColor Cyan
& $Git clone --branch main $RemoteUrl $PastaDestino
Set-Location $PastaDestino

$envExample = Join-Path $PastaDestino "backend\.env.example"
$envProd = Join-Path $PastaDestino "backend\.env"
if (-not (Test-Path $envProd)) {
    Copy-Item $envExample $envProd
    Write-Host ""
    Write-Host "IMPORTANTE: Edite backend\.env com credenciais de PRODUCAO antes do deploy." -ForegroundColor Yellow
    Write-Host "  notepad $envProd"
}

Write-Host ""
Write-Host "Proximos passos na VPS:" -ForegroundColor Cyan
Write-Host "  1. Editar backend\.env (producao)"
Write-Host "  2. npm ci && npm ci --prefix backend && npm ci --prefix frontend"
Write-Host "  3. npm run build:production"
Write-Host "  4. powershell -File scripts\setup-prod-service.ps1 -PastaProjeto `"$PastaDestino`""
Write-Host "  5. powershell -File scripts\desativar-backup-agendado.ps1"
Write-Host "  6. Deploys futuros: powershell -File scripts\deploy-producao.ps1 -PastaProjeto `"$PastaDestino`""
