# Inicializa o repositorio Git local e prepara o primeiro push para o GitHub.
# Uso (na raiz do projeto):
#   powershell -ExecutionPolicy Bypass -File scripts/init-git-repo.ps1 -RemoteUrl "https://github.com/ORG/gestor-pedidos-soaco.git"

param(
    [Parameter(Mandatory = $true)]
    [string]$RemoteUrl
)

$ErrorActionPreference = "Stop"
$PastaProjeto = Split-Path $PSScriptRoot -Parent
Set-Location $PastaProjeto

function Find-Git {
    $candidatos = @(
        "git",
        "C:\Program Files\Git\bin\git.exe",
        "C:\Program Files (x86)\Git\bin\git.exe"
    )
    foreach ($c in $candidatos) {
        if (Get-Command $c -ErrorAction SilentlyContinue) { return $c }
        if (Test-Path $c) { return $c }
    }
    throw "Git nao encontrado. Instale: https://git-scm.com/download/win"
}

$Git = Find-Git
Write-Host "Usando Git: $Git" -ForegroundColor Cyan

if (-not (Test-Path ".git")) {
    & $Git init
    & $Git branch -M main
    Write-Host "Repositorio inicializado (branch main)." -ForegroundColor Green
} else {
    Write-Host "Repositorio .git ja existe." -ForegroundColor Yellow
}

$remotes = & $Git remote 2>$null
if ($remotes -contains "origin") {
    & $Git remote set-url origin $RemoteUrl
    Write-Host "Remote origin atualizado: $RemoteUrl" -ForegroundColor Green
} else {
    & $Git remote add origin $RemoteUrl
    Write-Host "Remote origin adicionado: $RemoteUrl" -ForegroundColor Green
}

# Verifica se ha secrets acidentalmente rastreados
$trackedEnv = & $Git ls-files --error-unmatch backend/.env 2>$null
if ($LASTEXITCODE -eq 0) {
    throw "ERRO: backend/.env esta rastreado pelo Git. Remova com: git rm --cached backend/.env"
}

& $Git add .
$status = & $Git status --porcelain
if (-not $status) {
    Write-Host "Nada para commitar (working tree limpo)." -ForegroundColor Cyan
} else {
    & $Git commit -m "chore: inicializa repositorio com fluxo multi-dev"
    Write-Host "Commit inicial criado." -ForegroundColor Green
}

Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "  1. powershell -File scripts/setup-branches.ps1"
Write-Host "  2. git push -u origin main"
Write-Host "  3. git push -u origin develop"
Write-Host "  4. Configurar protecoes de branch no GitHub (ver docs/FLUXO-DEV-DEPLOY.md)"
Write-Host "  5. powershell -File scripts/desativar-backup-agendado.ps1  (na VPS)"
