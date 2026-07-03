# Instala GitHub Actions self-hosted runner na VPS (deploy automatico ao merge em main).
# Uso (Administrador na VPS, via RDP):
#   1. GitHub → Repo → Settings → Actions → Runners → New self-hosted runner → Windows
#   2. Copie o token COMPLETO apos --token (valido ~1h, uso unico)
#   3. powershell -ExecutionPolicy Bypass -File scripts/setup-github-runner.ps1 -RegistrationToken "XXXX"
#
# O runner usa a label "producao" — so jobs de deploy-producao.yml rodam aqui.

param(
    [Parameter(Mandatory = $true)]
    [string]$RegistrationToken,
    [string]$RepoUrl = "https://github.com/tecnologiadados-netizen/Gestao_Smart_Soaco",
    [string]$RunnerName = "vps-hostinger-producao",
    [string]$Labels = "producao",
    [string]$PastaRunner = "C:\actions-runner",
    [switch]$LimparInstalacaoAnterior
)

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
    throw "Execute como Administrador (necessario para servico Windows e deploy)."
}

$RegistrationToken = $RegistrationToken.Trim()
if ($RegistrationToken.Length -lt 20) {
    throw "Token parece incompleto ($($RegistrationToken.Length) caracteres). Copie o token INTEIRO da pagina do GitHub (apos --token)."
}

$runnerVersion = "2.321.0"
$zipName = "actions-runner-win-x64-$runnerVersion.zip"
$zipUrl = "https://github.com/actions/runner/releases/download/v$runnerVersion/$zipName"

if ($LimparInstalacaoAnterior -and (Test-Path $PastaRunner)) {
    Write-Host "Removendo instalacao anterior em $PastaRunner ..." -ForegroundColor Yellow
    $svc = Get-Service | Where-Object { $_.Name -like "actions.runner.*" } | Select-Object -First 1
    if ($svc) {
        Stop-Service $svc.Name -Force -ErrorAction SilentlyContinue
        sc.exe delete $svc.Name | Out-Null
        Start-Sleep -Seconds 2
    }
    Remove-Item -Recurse -Force $PastaRunner
}

New-Item -ItemType Directory -Force -Path $PastaRunner | Out-Null
Set-Location $PastaRunner

if (-not (Test-Path "config.cmd")) {
    Write-Host "Baixando actions-runner v$runnerVersion ..." -ForegroundColor Cyan
    $zipPath = Join-Path $env:TEMP $zipName
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $PastaRunner)
}

Write-Host "Configurando runner ($RunnerName, labels: $Labels) ..." -ForegroundColor Cyan
& .\config.cmd --unattended `
    --url $RepoUrl `
    --token $RegistrationToken `
    --name $RunnerName `
    --labels $Labels `
    --work _work `
    --replace `
    --runasservice

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Falha ao registrar o runner (codigo $LASTEXITCODE)." -ForegroundColor Red
    Write-Host "Causas comuns:" -ForegroundColor Yellow
    Write-Host "  - Token expirado ou ja usado (gere outro em Settings → Actions → Runners → New)"
    Write-Host "  - Token copiado incompleto (copie tudo apos --token, sem espacos)"
    Write-Host "  - Actions desabilitado no repositorio"
    exit 1
}

Start-Sleep -Seconds 3

# LocalSystem: permissao para Stop/Start GestorPedidosSoaco e portproxy no deploy.
$svc = Get-Service | Where-Object { $_.Name -like "actions.runner.*" } | Select-Object -First 1
if ($svc) {
    if ($svc.Status -ne "Running") {
        Start-Service $svc.Name
        Start-Sleep -Seconds 2
    }
    sc.exe config $svc.Name obj= LocalSystem | Out-Null
    Restart-Service $svc.Name -Force
    Write-Host "Servico $($svc.Name) : $((Get-Service $svc.Name).Status) (LocalSystem)" -ForegroundColor Green
} else {
    Write-Host "Servico do runner nao encontrado apos config --runasservice." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Runner instalado e em execucao." -ForegroundColor Green
Write-Host "Confira em: $RepoUrl/settings/actions/runners" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fluxo automatico:" -ForegroundColor Cyan
Write-Host "  merge em main → CI verde → workflow Deploy producao → scripts/deploy-producao.ps1"
Write-Host ""
Write-Host "Deploy manual de emergencia: GitHub → Actions → Deploy producao → Run workflow"
