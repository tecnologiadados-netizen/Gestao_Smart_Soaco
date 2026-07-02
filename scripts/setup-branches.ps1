# Cria as branches develop1, develop2 e develop3 a partir de main.
# Executar apos init-git-repo.ps1 e antes do primeiro push das branches de dev.

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

foreach ($nome in @("develop1", "develop2", "develop3")) {
    $exists = & $Git branch --list $nome
    if ($exists) {
        Write-Host "Branch $nome ja existe." -ForegroundColor Yellow
    } else {
        & $Git branch $nome
        Write-Host "Branch $nome criada a partir de main." -ForegroundColor Green
    }
}

# Migra branch antiga "develop" para develop1, se existir
$developLegado = & $Git branch --list develop
if ($developLegado) {
    $d1 = & $Git branch --list develop1
    if (-not $d1) {
        & $Git branch -m develop develop1
        Write-Host "Branch develop renomeada para develop1." -ForegroundColor Green
    } else {
        Write-Host "Branch develop legada ainda existe (develop1 ja criada)." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Convencao de branches:" -ForegroundColor Cyan
Write-Host "  main              -> producao (deploy na VPS)"
Write-Host "  develop1          -> Dev 1 (integracao)"
Write-Host "  develop2          -> Dev 2 (integracao)"
Write-Host "  develop3          -> Dev 3 (integracao)"
Write-Host "  feature/modulo-x  -> nova funcionalidade (branch da sua developN)"
Write-Host "  fix/modulo-x      -> correcao de bug"
Write-Host "  hotfix/descricao  -> urgencia em producao (branch de main)"
Write-Host ""
Write-Host "Protecoes no GitHub (Settings > Branches):" -ForegroundColor Cyan
Write-Host "  main:      exigir PR + 1 aprovacao + bloquear push direto"
Write-Host "  develop1/2/3: exigir PR (recomendado)"
Write-Host ""
Write-Host "Push inicial:" -ForegroundColor Cyan
Write-Host "  git push -u origin main"
Write-Host "  git push -u origin develop1"
Write-Host "  git push -u origin develop2"
Write-Host "  git push -u origin develop3"
Write-Host "  git push origin --delete develop   # se a branch antiga existir no remoto"
