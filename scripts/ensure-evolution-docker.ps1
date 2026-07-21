# Garante que a Evolution (Docker) do Gestao esteja no ar apos login/boot.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\ensure-evolution-docker.ps1

$ErrorActionPreference = "Stop"
$EvolutionDir = Join-Path $env:USERPROFILE "evolution-api"
$ComposeFile = "docker-compose.gestao.yaml"
$EnvFile = ".env.gestao"
$LogDir = Join-Path $env:LOCALAPPDATA "GestaoSmart"
$LogFile = Join-Path $LogDir "evolution-autostart.log"

function Write-Log([string]$msg) {
  if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
  Add-Content -Path $LogFile -Value $line -Encoding utf8
  Write-Host $line
}

Write-Log "=== ensure-evolution-docker start ==="

if (-not (Test-Path (Join-Path $EvolutionDir $ComposeFile))) {
  Write-Log "ERRO: nao encontrado $EvolutionDir\$ComposeFile"
  exit 1
}
if (-not (Test-Path (Join-Path $EvolutionDir $EnvFile))) {
  Write-Log "ERRO: nao encontrado $EvolutionDir\$EnvFile"
  exit 1
}

$dockerExe = @(
  "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
  "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

$ready = $false
for ($i = 1; $i -le 60; $i++) {
  docker info 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    Write-Log "Docker engine OK (tentativa $i)"
    break
  }
  if ($i -eq 1 -and $dockerExe) {
    Write-Log "Docker offline - iniciando Docker Desktop"
    Start-Process $dockerExe | Out-Null
  }
  Start-Sleep -Seconds 5
}

if (-not $ready) {
  Write-Log "ERRO: Docker engine nao ficou pronto a tempo"
  exit 2
}

Set-Location $EvolutionDir
Write-Log "docker compose up -d ..."
docker compose -f $ComposeFile --env-file $EnvFile up -d
if ($LASTEXITCODE -ne 0) {
  Write-Log "ERRO: docker compose falhou (exit $LASTEXITCODE)"
  exit $LASTEXITCODE
}

$apiKey = ((Get-Content (Join-Path $EvolutionDir $EnvFile) | Where-Object { $_ -match '^AUTHENTICATION_API_KEY=' }) -replace '^AUTHENTICATION_API_KEY=', '').Trim()
$apiOk = $false
for ($i = 1; $i -le 24; $i++) {
  try {
    $headers = @{ apikey = $apiKey }
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8081/instance/fetchInstances" -Headers $headers -UseBasicParsing -TimeoutSec 10
    if ($r.StatusCode -eq 200) {
      $apiOk = $true
      Write-Log "Evolution API OK HTTP 200"
      break
    }
  } catch {
    Start-Sleep -Seconds 5
  }
}

if (-not $apiOk) {
  Write-Log "AVISO: compose up ok, mas API ainda nao respondeu em :8081"
  exit 3
}

Write-Log "=== ensure-evolution-docker OK ==="
exit 0
