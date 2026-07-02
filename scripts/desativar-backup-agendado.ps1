# Remove tarefas agendadas que executavam backup-github.ps1 (backup cego).
# Executar na VPS ou em qualquer PC que tenha o agendamento antigo.

$ErrorActionPreference = "Stop"

$nomesPossiveis = @(
    "GestorPedidosBackupGitHub",
    "gestaosmartbkp",
    "backup-github",
    "GestaoSmartBackup"
)

$removidas = 0
foreach ($nome in $nomesPossiveis) {
    $task = Get-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue
    if ($task) {
        Unregister-ScheduledTask -TaskName $nome -Confirm:$false
        Write-Host "Tarefa removida: $nome" -ForegroundColor Green
        $removidas++
    }
}

# Busca generica por scripts que referenciem backup-github.ps1
$todas = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object {
    $_.Actions.Execute -match "backup-github" -or $_.Actions.Arguments -match "backup-github"
}
foreach ($task in $todas) {
    Unregister-ScheduledTask -TaskName $task.TaskName -Confirm:$false
    Write-Host "Tarefa removida: $($task.TaskName)" -ForegroundColor Green
    $removidas++
}

if ($removidas -eq 0) {
    Write-Host "Nenhuma tarefa agendada de backup-github encontrada." -ForegroundColor Cyan
} else {
    Write-Host "$removidas tarefa(s) removida(s). Use o fluxo Git documentado em docs/FLUXO-DEV-DEPLOY.md" -ForegroundColor Green
}
