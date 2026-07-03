# Prepara pasta de producao na VPS Hostinger (clone limpo, branch main).
# Uso (como Administrador na VPS via RDP):
#   powershell -ExecutionPolicy Bypass -File scripts/setup-vps-producao.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/setup-vps-producao.ps1 -PastaDestino "D:\apps\gestor-pedidos"

param(
    [string]$RemoteUrl = "https://github.com/tecnologiadados-netizen/Gestao_Smart_Soaco.git",
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
        & $Git pull --ff-only origin main
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
Write-Host "  2. npm install && npm install --prefix backend && npm install --prefix frontend"
Write-Host "  3. npm run build:production"
Write-Host "  4. powershell -File scripts\setup-prod-service.ps1 -PastaProjeto `"$PastaDestino`""
Write-Host "  5. powershell -File scripts\desativar-backup-agendado.ps1"
Write-Host "  6. Deploy automatico (recomendado, uma vez):"
Write-Host "     powershell -File scripts\setup-github-runner.ps1 -RegistrationToken `"TOKEN_DO_GITHUB`""
Write-Host "     (ver docs\DEPLOY-AUTOMATICO.md)"
Write-Host "  7. Deploy manual (fallback): cd `"$PastaDestino`" && npm run deploy:producao"
