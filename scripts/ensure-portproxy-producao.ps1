# Garante portproxy TCP 80 -> 4000 (producao). Requer Administrador.
# Corrige o caso em que 80 apontava para Vite (5180) em dev.

$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot '..\deploy\setup-domain-http.ps1'
& $scriptPath
