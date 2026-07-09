# Gera ZIP do módulo SGQ para deploy em outra máquina.
# Uso: .\scripts\package-for-deploy.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $ProjectRoot
try {
    node scripts/package-for-deploy.mjs
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao gerar o pacote (exit $LASTEXITCODE)."
    }
}
finally {
    Pop-Location
}
