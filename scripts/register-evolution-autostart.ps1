# Registra autostart da Evolution (Docker) no logon do Windows.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\register-evolution-autostart.ps1

$ErrorActionPreference = "Stop"

$EnsureScript = Join-Path $PSScriptRoot "ensure-evolution-docker.ps1"
if (-not (Test-Path $EnsureScript)) {
  throw "Nao encontrei ensure-evolution-docker.ps1 em $PSScriptRoot"
}

$TaskName = "GestaoSmart-EvolutionDocker"
$Action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$EnsureScript`""

$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Principal $Principal `
  -Force | Out-Null

Write-Host "[ok] Tarefa agendada: $TaskName (no logon)"
Write-Host "     Script: $EnsureScript"

$dockerExe = @(
  "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
  "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($dockerExe) {
  $startup = [Environment]::GetFolderPath("Startup")
  $lnkPath = Join-Path $startup "Docker Desktop.lnk"
  $wsh = New-Object -ComObject WScript.Shell
  $shortcut = $wsh.CreateShortcut($lnkPath)
  $shortcut.TargetPath = $dockerExe
  $shortcut.WorkingDirectory = Split-Path $dockerExe
  $shortcut.Save()
  Write-Host "[ok] Atalho Startup: $lnkPath"
} else {
  Write-Host "[aviso] Docker Desktop.exe nao encontrado."
  Write-Host "         Ative em: Settings > General > Start Docker Desktop when you log in"
}

Write-Host ""
Write-Host "Pronto. Apos reiniciar o PC:"
Write-Host "  1. Docker Desktop sobe"
Write-Host "  2. A tarefa sobe os containers"
Write-Host "  3. Sessao WhatsApp restaura do volume (sem novo QR), salvo se o celular desconectou o aparelho"
Write-Host ""
Write-Host "Log: $env:LOCALAPPDATA\GestaoSmart\evolution-autostart.log"
Write-Host "Testar agora: powershell -ExecutionPolicy Bypass -File `"$EnsureScript`""
