# Deploy producao na VPS Hostinger (via GitHub)

Runbook copiavel. Producao **nao** e atualizada editando arquivos na VPS — a fonte da verdade e a branch **`main`** no GitHub.

Repositorio: https://github.com/tecnologiadados-netizen/Gestao_Smart_Soaco

---

## Setup inicial (uma vez na VPS)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-vps-producao.ps1 `
  -PastaDestino "C:\apps\gestor-pedidos"

# Editar secrets de producao
notepad C:\apps\gestor-pedidos\backend\.env

# Instalar servico NSSM (Administrador)
cd C:\apps\gestor-pedidos
powershell -ExecutionPolicy Bypass -File scripts/setup-prod-service.ps1 `
  -PastaDestino "C:\apps\gestor-pedidos"

# Desativar backup automatico antigo (se existir)
powershell -ExecutionPolicy Bypass -File scripts/desativar-backup-agendado.ps1
```

---

## Deploy automatico (recomendado)

Apos configurar o **self-hosted runner** na VPS, cada merge em `main` com CI verde dispara o deploy sozinho (estilo Vercel).

Guia completo: **[DEPLOY-AUTOMATICO.md](DEPLOY-AUTOMATICO.md)**

Setup rapido na VPS (Administrador, token do GitHub → Settings → Actions → Runners):

```powershell
cd C:\apps\gestor-pedidos
git pull origin main
powershell -ExecutionPolicy Bypass -File scripts/setup-github-runner.ps1 -RegistrationToken "TOKEN"
```

---

## Deploy manual (fallback ou antes do runner)

### Nesta maquina de desenvolvimento (ex.: `C:\gestorpedidosSoAco`)

A pasta `C:\apps\gestor-pedidos` **so existe na VPS** apos o setup. No PC de dev, use a pasta do projeto:

```powershell
cd C:\gestorpedidosSoAco

# Se npm nao for reconhecido, abra um NOVO terminal ou rode:
$env:Path = "C:\Program Files\nodejs;$env:Path"

# Opcao A — sem depender de npm no PATH:
.\deploy-producao.bat

# Opcao B — via npm:
npm run deploy:producao
```

### Na VPS Hostinger (producao real)

Apos `setup-vps-producao.ps1`, a pasta padrao e `C:\apps\gestor-pedidos`:

```powershell
cd C:\apps\gestor-pedidos
npm run deploy:producao
```

Se ainda nao rodou o setup na VPS:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-vps-producao.ps1
```

O script executa automaticamente:
1. `git pull --ff-only origin main`
2. `npm install` (raiz, backend, frontend)
3. `prisma generate` + `prisma migrate deploy`
4. `npm run build:production`
5. `Restart-Service GestorPedidosSoaco` (NSSM)
6. Validacao: `netstat` na porta 4000 + `/health`

---

## Checklist antes do deploy

- [ ] PR mergeado em `main` no GitHub
- [ ] CI verde no GitHub Actions (obrigatorio — deploy automatico so roda apos CI)
- [ ] Migrations Prisma revisadas (se houver)
- [ ] Equipe avisada (deploy pode causar alguns segundos de indisponibilidade)
- [ ] (Auto-deploy) Runner **Idle** em Settings → Actions → Runners

---

## Apos o deploy

1. Conferir health: http://127.0.0.1:4000/health
2. Conferir site: https://gsmartsoaco.com.br
3. **Ctrl+Shift+R** nos navegadores (evita JS/CSS antigo em cache)

---

## Comandos uteis

```powershell
Get-Service GestorPedidosSoaco
Restart-Service GestorPedidosSoaco
netstat -ano | findstr :4000
```

Logs do servico: `backend/logs/service-stdout.log`, `service-stderr.log`

---

## Problemas comuns

| Erro | Solucao |
|------|---------|
| `git pull --ff-only` falhou | Ha alteracoes locais na VPS. Descartar edits (`git status`) ou fazer hotfix via Git + PR |
| Build falhou | Erros TS no codigo; build usa `vite build` (front) e `build-backend.cjs` (back). Se falhar, rode `npm run restart:producao` |
| Site caiu apos deploy | Rode **urgente**: `npm run restart:producao`. Se HTTP falhar: portproxy 80 estava em 5180 (Vite) — rode `powershell -File deploy/setup-domain-http.ps1` como Admin |
| `ERR_CONNECTION_RESET` em http:// | Portproxy 80 deve apontar para **4000**, nao 5180. Script: `deploy/setup-domain-http.ps1` |
| HTTPS (https://) nao funciona | Certificados em `deploy/ssl/` ou use **http://** ate configurar SSL |
| Servico nao encontrado | Rodar `setup-prod-service.ps1` como Administrador |
| `npm` nao reconhecido no terminal | Use `.\deploy-producao.bat` ou `$env:Path = "C:\Program Files\nodejs;$env:Path"` |
| `EPERM` no `prisma generate` | Backend dev na porta 4000. Rode `npm run dev:stop` ou deixe o script parar sozinho e tente de novo |

---

## Flags opcionais do script

```powershell
powershell -File scripts/deploy-producao.ps1 -SemMigrate   # pular migrations
powershell -File scripts/deploy-producao.ps1 -SemRestart   # build sem reiniciar servico
powershell -File scripts/deploy-producao.ps1 -PastaProjeto "C:\gestorpedidosSoAco"
```

---

## Fluxo completo (dev → producao)

**Com deploy automatico (apos setup do runner):**

```
Dev PC (developN) → PR → main (GitHub) → CI → Deploy producao (runner VPS) → gsmartsoaco.com.br
```

**Manual (fallback):**

```
Dev PC (developN) → PR → main (GitHub) → RDP VPS → npm run deploy:producao → gsmartsoaco.com.br
```

Ver tambem: [FLUXO-DEV-DEPLOY.md](FLUXO-DEV-DEPLOY.md)
