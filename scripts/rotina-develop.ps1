# Rotina Git para develop1, develop2 ou develop3.
#
# Sincronizar com main (antes de comecar a desenvolver):
#   npm run git:sync
#   npm run git:sync -- -DevelopBranch develop1
#   powershell -ExecutionPolicy Bypass -File scripts/rotina-develop.ps1 -Acao Sync -DevelopBranch develop2
#
# Publicar (antes do push: sync, commit, push developN, merge e push main):
#   npm run git:publish -- -Message "feat(modulo): descricao"
#   powershell -ExecutionPolicy Bypass -File scripts/rotina-develop.ps1 -Acao Publish -DevelopBranch develop1 -Message "fix(login): ajuste cookie"

param(
    [ValidateSet("Sync", "Publish")]
    [string]$Acao = "Sync",

    [ValidateSet("develop1", "develop2", "develop3", "")]
    [string]$DevelopBranch = "",

    [string]$Message = "",

    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProdBranch = "main"
$BranchesDev = @("develop1", "develop2", "develop3")
$PastaProjeto = Split-Path $PSScriptRoot -Parent
Set-Location $PastaProjeto

function Find-Git {
    $candidatos = @(
        "git",
        "C:\Program Files\Git\bin\git.exe",
        "C:\Program Files\Git\cmd\git.exe"
    )
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

function Get-DirtyFiles {
    & $Git status --porcelain
}

function Test-WorkingTreeClean {
    $dirty = Get-DirtyFiles
    if ($dirty) {
        Write-Host ""
        Write-Host "Working tree com alteracoes nao commitadas:" -ForegroundColor Red
        & $Git status --short
        throw "Faca commit, stash ou descarte as alteracoes antes de continuar."
    }
}

function Resolve-DevelopBranch {
    if ($DevelopBranch -and $BranchesDev -contains $DevelopBranch) {
        return $DevelopBranch
    }

    $atual = & $Git branch --show-current
    if ($BranchesDev -contains $atual) {
        return $atual
    }

    throw "Informe sua branch com -DevelopBranch develop1|develop2|develop3 (branch atual: $atual)."
}

function Ensure-DevelopBranch {
    param([string]$Branch)

    $local = & $Git branch --list $Branch
    if ($local) {
        Invoke-Git checkout $Branch
        return
    }

    $remoto = & $Git branch -r --list "origin/$Branch"
    if ($remoto) {
        Invoke-Git checkout -b $Branch --track "origin/$Branch"
        return
    }

    throw "Branch $Branch nao existe localmente nem em origin."
}

function Sync-DevelopComMain {
    param([string]$Branch)

    Write-Host "[sync] Buscando atualizacoes do remoto..." -ForegroundColor Green
    Invoke-Git fetch origin --prune

    Ensure-DevelopBranch -Branch $Branch

    Write-Host "[sync] Atualizando $Branch com origin/$Branch..." -ForegroundColor Green
    Invoke-Git pull origin $Branch

    Write-Host "[sync] Integrando origin/$ProdBranch em $Branch..." -ForegroundColor Green
    & $Git merge "origin/$ProdBranch" --no-edit
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Conflito ao sincronizar $Branch com $ProdBranch." -ForegroundColor Red
        Write-Host "Resolva os arquivos, depois execute:" -ForegroundColor Yellow
        Write-Host "  git add ."
        Write-Host "  git commit -m `"merge: sincroniza $Branch com $ProdBranch`""
        if ($Acao -eq "Publish") {
            Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/rotina-develop.ps1 -Acao Publish -DevelopBranch $Branch -Message `"sua mensagem`""
        }
        exit 1
    }

    Write-Host "[sync] $Branch atualizada com $ProdBranch." -ForegroundColor Cyan
}

function Get-AheadCount {
    param([string]$Branch)
    $count = & $Git rev-list --count "origin/$Branch..$Branch" 2>$null
    if ($LASTEXITCODE -ne 0) { return 0 }
    return [int]$count
}

function Publish-Develop {
    param([string]$Branch)

    Write-Host ""
    Write-Host "=== Publicar $Branch -> $ProdBranch ===" -ForegroundColor Cyan
    Write-Host ""

    Sync-DevelopComMain -Branch $Branch

    $dirty = Get-DirtyFiles
    if ($dirty) {
        if (-not $Message) {
            $Message = Read-Host "Mensagem do commit"
        }
        if (-not $Message.Trim()) {
            throw "Informe a mensagem com -Message `"texto do commit`"."
        }

        Write-Host "[publish] Commitando alteracoes..." -ForegroundColor Green
        Invoke-Git add -A
        Invoke-Git commit -m $Message
    } else {
        $ahead = Get-AheadCount -Branch $Branch
        if ($ahead -le 0) {
            throw "Nada para publicar: sem alteracoes locais e $Branch nao esta a frente de origin/$Branch."
        }
        Write-Host "[publish] Sem alteracoes pendentes; usando commits ja existentes ($ahead commit(s) a frente)." -ForegroundColor Yellow
    }

    if (-not $Force) {
        $resposta = Read-Host "Confirma push de $Branch, merge em $ProdBranch e push de $ProdBranch? (s/N)"
        if ($resposta -notmatch '^[sS]') {
            Write-Host "Cancelado." -ForegroundColor Yellow
            exit 0
        }
    }

    Write-Host "[publish] Enviando $Branch..." -ForegroundColor Green
    Invoke-Git push origin $Branch

    Write-Host "[publish] Atualizando $ProdBranch..." -ForegroundColor Green
    Invoke-Git checkout $ProdBranch
    Invoke-Git pull origin $ProdBranch

    Write-Host "[publish] Merge $Branch -> $ProdBranch..." -ForegroundColor Green
    & $Git merge $Branch --no-edit
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Conflito no merge para $ProdBranch. Resolva e execute:" -ForegroundColor Red
        Write-Host "  git add ."
        Write-Host "  git commit -m `"merge: integra $Branch na $ProdBranch`""
        Write-Host "  git push origin $ProdBranch"
        Write-Host "  git checkout $Branch"
        Write-Host "  git pull origin $ProdBranch"
        Write-Host "  git push origin $Branch"
        exit 1
    }

    Write-Host "[publish] Enviando $ProdBranch..." -ForegroundColor Green
    Invoke-Git push origin $ProdBranch

    Write-Host "[publish] Sincronizando $Branch com $ProdBranch..." -ForegroundColor Green
    Invoke-Git checkout $Branch
    Invoke-Git pull origin $ProdBranch
    Invoke-Git push origin $Branch

    Write-Host ""
    Write-Host "Concluido: $Branch publicada em $ProdBranch e sincronizada." -ForegroundColor Cyan
    Write-Host "Branch atual: $Branch" -ForegroundColor Cyan
    Write-Host ""
}

$Git = Find-Git

if (-not (Test-Path ".git")) {
    throw "Repositorio nao inicializado. Execute na pasta Gestao_Smart_Soaco."
}

$dev = Resolve-DevelopBranch

switch ($Acao) {
    "Sync" {
        Write-Host ""
        Write-Host "=== Sincronizar $dev com $ProdBranch ===" -ForegroundColor Cyan
        Write-Host ""

        if (-not $Force) {
            $dirty = Get-DirtyFiles
            if ($dirty) {
                Write-Host "Ha alteracoes locais nao commitadas." -ForegroundColor Yellow
                $resposta = Read-Host "Continuar mesmo assim? Pode gerar conflito no merge (s/N)"
                if ($resposta -notmatch '^[sS]') {
                    Write-Host "Cancelado. Faca commit ou stash antes de sincronizar." -ForegroundColor Yellow
                    exit 0
                }
            }
        }

        Sync-DevelopComMain -Branch $dev
        Write-Host "Pronto para desenvolver em $dev." -ForegroundColor Cyan
    }
    "Publish" {
        Publish-Develop -Branch $dev
    }
}
