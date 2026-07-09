# Pastas exigidas pelo Microsoft Word quando o processo roda como LocalSystem (servico NSSM).
# Sem elas, Word COM falha com: Word.Application.Documents / SaveAs NoneType.
# Ref: https://stackoverflow.com/questions/1006923/

$ErrorActionPreference = "Stop"

$dirs = @(
    "$env:SystemRoot\System32\config\systemprofile\Desktop",
    "$env:SystemRoot\System32\config\systemprofile\AppData\Local\Microsoft\Windows\INetCache",
    "$env:SystemRoot\SysWOW64\config\systemprofile\Desktop",
    "$env:SystemRoot\SysWOW64\config\systemprofile\AppData\Local\Microsoft\Windows\INetCache"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "Criado: $dir" -ForegroundColor Green
    } else {
        Write-Host "OK: $dir" -ForegroundColor DarkGray
    }
}

Write-Host "Pastas do Word COM para LocalSystem prontas." -ForegroundColor Cyan
