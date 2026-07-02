# Instala GitHub Actions self-hosted runner na VPS (deploy automatico ao merge em main).
# Uso (Administrador na VPS, via RDP):
#   1. GitHub → Repo → Settings → Actions → Runners → New self-hosted runner → Windows
#   2. Copie o token de registro (valido ~1h)
#   3. powershell -ExecutionPolicy Bypass -File scripts/setup-github-runner.ps1 -RegistrationToken "XXXX"
#
# O runner usa a label "producao" — so jobs de deploy-producao.yml rodam aqui.

param(
    [Parameter(Mandatory = $true)]
    [string]$RegistrationToken,
    [string]$RepoUrl = "https://github.com/tecnologiadados-netizen/Gestao_Smart_Soaco",
    [string]$RunnerName = "vps-hostinger-producao",
    [string]$Labels = "producao",
    [string]$PastaRunner = "C:\actions-runner"
)

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
    throw "Execute como Administrador (necessario para servico Windows e deploy)."
}

$runnerVersion = "2.321.0"
$zipName = "actions-runner-win-x64-$runnerVersion.zip"
$zipUrl = "https://github.com/actions/runner/releases/download/v$runnerVersion/$zipName"

New-Item -ItemType Directory -Force -Path $PastaRunner | Out-Null
Set-Location $PastaRunner

if (-not (Test-Path "config.cmd")) {
    Write-Host "Baixando actions-runner v$runnerVersion ..." -ForegroundColor Cyan
    $zipPath = Join-Path $env:TEMP $zipName
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
    Expand-Archive -Path $zipPath -DestinationPath $PastaRunner -Force
}

Write-Host "Configurando runner ($RunnerName, labels: $Labels) ..." -ForegroundColor Cyan
& .\config.cmd --unattended `
    --url $RepoUrl `
    --token $RegistrationToken `
    --name $RunnerName `
    --labels $Labels `
    --work _work `
    --replace

Write-Host "Instalando servico Windows do runner ..." -ForegroundColor Cyan
& .\svc.cmd install
& .\svc.cmd start
Start-Sleep -Seconds 3

# LocalSystem: permissao para Stop/Start GestorPedidosSoaco e portproxy no deploy.
$svc = Get-Service | Where-Object { $_.Name -like "actions.runner.*" } | Select-Object -First 1
if ($svc) {
    sc.exe config $svc.Name obj= LocalSystem | Out-Null
    Restart-Service $svc.Name -Force
    Write-Host "Servico $($svc.Name) configurado como LocalSystem." -ForegroundColor Green
}

Write-Host ""
Write-Host "Runner instalado e em execucao." -ForegroundColor Green
Write-Host "Confira em: $RepoUrl/settings/actions/runners" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fluxo automatico:" -ForegroundColor Cyan
Write-Host "  merge em main → CI verde → workflow Deploy producao → scripts/deploy-producao.ps1"
Write-Host ""
Write-Host "Deploy manual de emergencia: GitHub → Actions → Deploy producao → Run workflow"
