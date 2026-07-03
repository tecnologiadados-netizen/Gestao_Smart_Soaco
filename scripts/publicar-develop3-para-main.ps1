# Publica develop3 na main e sincroniza develop3 de volta.
# Uso: npm run git:publish-main
#      powershell -ExecutionPolicy Bypass -File scripts/publicar-develop3-para-main.ps1

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$DevBranch = "develop3"
$ProdBranch = "main"
$PastaProjeto = Split-Path $PSScriptRoot -Parent
Set-Location $PastaProjeto

function Find-Git {
    $candidatos = @("git", "C:\Program Files\Git\bin\git.exe")
    foreach ($c in $candidatos) {
        if (Get-Command $c -ErrorAction SilentlyContinue) { return $c }
        if (Test-Path $c) { return $c }
    }
    throw "Git nao encontrado. Instale o Git ou adicione ao PATH."
}

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & $Git @Args
    if ($LASTEXITCODE -ne 0) {
        throw "Comando git falhou: git $($Args -join ' ')"
    }
}

function Test-WorkingTreeClean {
    Invoke-Git status --porcelain | Out-Null
    $dirty = & $Git status --porcelain
    if ($dirty) {
        Write-Host ""
        Write-Host "Working tree com alteracoes nao commitadas:" -ForegroundColor Red
        & $Git status --short
        throw "Faca commit ou stash antes de publicar na main."
    }
}

$Git = Find-Git

if (-not (Test-Path ".git")) {
    throw "Repositorio nao inicializado. Execute na pasta do projeto Gestao_Smart."
}

Write-Host ""
Write-Host "=== Publicar $DevBranch -> $ProdBranch ===" -ForegroundColor Cyan
Write-Host ""

Test-WorkingTreeClean

if (-not $Force) {
    $resposta = Read-Host "Confirma merge de $DevBranch na $ProdBranch e push? (s/N)"
    if ($resposta -notmatch '^[sS]') {
        Write-Host "Cancelado." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "[1/5] Atualizando $DevBranch..." -ForegroundColor Green
Invoke-Git checkout $DevBranch
Invoke-Git pull origin $DevBranch
Invoke-Git push origin $DevBranch

Write-Host "[2/5] Atualizando $ProdBranch..." -ForegroundColor Green
Invoke-Git checkout $ProdBranch
Invoke-Git pull origin $ProdBranch

Write-Host "[3/5] Merge $DevBranch -> $ProdBranch..." -ForegroundColor Green
& $Git merge $DevBranch --no-edit
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Conflito no merge. Resolva os arquivos, depois execute:" -ForegroundColor Red
    Write-Host "  git add ."
    Write-Host "  git commit -m `"merge: integra $DevBranch na $ProdBranch`""
    Write-Host "  git push origin $ProdBranch"
    Write-Host "  git checkout $DevBranch"
    Write-Host "  git pull origin $ProdBranch"
    Write-Host "  git push origin $DevBranch"
    exit 1
}

Write-Host "[4/5] Enviando $ProdBranch..." -ForegroundColor Green
Invoke-Git push origin $ProdBranch

Write-Host "[5/5] Sincronizando $DevBranch com $ProdBranch..." -ForegroundColor Green
Invoke-Git checkout $DevBranch
Invoke-Git pull origin $ProdBranch
Invoke-Git push origin $DevBranch

Write-Host ""
Write-Host "Concluido: $DevBranch publicada em $ProdBranch e sincronizada." -ForegroundColor Cyan
Write-Host "Branch atual: $DevBranch" -ForegroundColor Cyan
Write-Host ""
