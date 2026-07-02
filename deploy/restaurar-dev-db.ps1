#Requires -RunAsAdministrator
<#
  Restaura backend/prisma/dev.db a partir de cópia do servidor anterior.
  Uso:
    .\restaurar-dev-db.ps1 -Origem "\\10.80.1.187\SoAcoSQLite\dev.db"
    .\restaurar-dev-db.ps1 -Origem "D:\backup\dev.db"

  O script para o stack dev, faz backup do arquivo atual e copia o origem.
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $Origem
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dbDest = Join-Path $root 'backend\prisma\dev.db'

if (-not (Test-Path $Origem)) {
  Write-Error "Arquivo de origem não encontrado: $Origem"
}

$origemItem = Get-Item $Origem
if ($origemItem.Length -lt 50000) {
  Write-Warning "Arquivo de origem muito pequeno ($($origemItem.Length) bytes). Confirme se é o banco de produção correto."
}

Write-Host 'Parando stack dev...'
Push-Location $root
try {
  npm run dev:stop 2>$null
} catch {
  Write-Warning 'dev:stop falhou (pode já estar parado).'
}
Pop-Location
Start-Sleep -Seconds 2

if (Test-Path $dbDest) {
  $bak = "$dbDest.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item $dbDest $bak -Force
  Write-Host "Backup do banco atual: $bak"
}

Copy-Item $Origem $dbDest -Force
Write-Host "Banco restaurado: $dbDest ($((Get-Item $dbDest).Length) bytes)"

Push-Location (Join-Path $root 'backend')
npm run migrate
Pop-Location

Write-Host @'

Próximo passo: na raiz do projeto
  npm run dev:start

Teste login em http://www.gsmartsoaco.com.br

'@
