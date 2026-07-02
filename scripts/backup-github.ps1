# DESCONTINUADO — substituído pelo fluxo Git com branches e PRs.
# Ver docs/FLUXO-DEV-DEPLOY.md
#
# Este script não faz mais commit/push automático. Use:
#   - feature/fix branches + Pull Requests no GitHub
#   - scripts/deploy-producao.ps1 para publicar em produção
#
# Para remover o agendamento antigo (Task Scheduler):
#   powershell -ExecutionPolicy Bypass -File scripts/desativar-backup-agendado.ps1

$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "AVISO: backup-github.ps1 foi descontinuado." -ForegroundColor Yellow
Write-Host "O backup cego (git add . + commit generico) nao e compativel com multi-dev." -ForegroundColor Yellow
Write-Host "Consulte docs/FLUXO-DEV-DEPLOY.md para o fluxo correto." -ForegroundColor Yellow
Write-Host ""
exit 1
