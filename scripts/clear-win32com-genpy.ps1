# Limpa cache win32com/gen_py corrompido (erro CLSIDToPackageMap na geracao de PDF).
# Uso: powershell -ExecutionPolicy Bypass -File scripts/clear-win32com-genpy.ps1

$ErrorActionPreference = "Continue"

$dirs = @(
    "$env:LOCALAPPDATA\Temp\gen_py",
    "$env:TEMP\gen_py",
    "C:\Windows\Temp\gen_py",
    "C:\Windows\System32\config\systemprofile\AppData\Local\Temp\gen_py",
    "C:\Windows\SysWOW64\config\systemprofile\AppData\Local\Temp\gen_py"
)

# Descobre gen_py via Python, se disponivel
$python = $env:PYTHON_PATH
if (-not $python) { $python = "C:\Program Files\Python312\python.exe" }
if (Test-Path $python) {
    try {
        $pyPath = & $python -c "import win32com; print(getattr(win32com,'__gen_path__',''))" 2>$null
        if ($pyPath) { $dirs += $pyPath.Trim() }
        $pyPath2 = & $python -c "import win32com.client.gencache as g; print(g.GetGeneratePath())" 2>$null
        if ($pyPath2) { $dirs += $pyPath2.Trim() }
    } catch {}
}

$seen = @{}
foreach ($dir in $dirs) {
    if (-not $dir) { continue }
    $key = $dir.ToLowerInvariant()
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = $true
    if (Test-Path $dir) {
        Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Removido: $dir" -ForegroundColor Green
    } else {
        Write-Host "OK (ausente): $dir" -ForegroundColor DarkGray
    }
}

Write-Host "Cache win32com/gen_py limpo." -ForegroundColor Cyan
