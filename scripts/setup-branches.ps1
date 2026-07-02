# Cria a branch develop a partir de main e documenta convencao de nomes.
# Executar apos init-git-repo.ps1 e antes do primeiro push.

$ErrorActionPreference = "Stop"
$PastaProjeto = Split-Path $PSScriptRoot -Parent
Set-Location $PastaProjeto

function Find-Git {
    $candidatos = @("git", "C:\Program Files\Git\bin\git.exe")
    foreach ($c in $candidatos) {
        if (Get-Command $c -ErrorAction SilentlyContinue) { return $c }
        if (Test-Path $c) { return $c }
    }
    throw "Git nao encontrado."
}

$Git = Find-Git

if (-not (Test-Path ".git")) {
    throw "Repositorio nao inicializado. Execute scripts/init-git-repo.ps1 primeiro."
}

$branchAtual = & $Git branch --show-current
if ($branchAtual -ne "main") {
    $mainExists = & $Git branch --list main
    if ($mainExists) {
        & $Git checkout main
    } else {
        & $Git checkout -b main
    }
}

$developExists = & $Git branch --list develop
if ($developExists) {
    Write-Host "Branch develop ja existe." -ForegroundColor Yellow
} else {
    & $Git checkout -b develop
    & $Git checkout main
    Write-Host "Branch develop criada a partir de main." -ForegroundColor Green
}

Write-Host ""
Write-Host "Convencao de branches:" -ForegroundColor Cyan
Write-Host "  main              -> producao (deploy na VPS)"
Write-Host "  develop           -> integracao de features"
Write-Host "  feature/modulo-x  -> nova funcionalidade"
Write-Host "  fix/modulo-x      -> correcao de bug"
Write-Host "  hotfix/descricao  -> urgencia em producao (branch de main)"
Write-Host ""
Write-Host "Protecoes no GitHub (Settings > Branches):" -ForegroundColor Cyan
Write-Host "  main:    exigir PR + 1 aprovacao + bloquear push direto"
Write-Host "  develop: exigir PR (recomendado)"
Write-Host ""
Write-Host "Push inicial:" -ForegroundColor Cyan
Write-Host "  git push -u origin main"
Write-Host "  git push -u origin develop"
