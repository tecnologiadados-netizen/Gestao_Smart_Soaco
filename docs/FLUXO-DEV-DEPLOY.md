# Fluxo de desenvolvimento e deploy — 3 desenvolvedores

Guia operacional para trabalhar em paralelo sem prejudicar producao (`gsmartsoaco.com.br`).

Repositorio: https://github.com/tecnologiadados-netizen/Gestao_Smart_Soaco

## Visao geral

| Branch | Uso |
|--------|-----|
| `main` | **Producao** — unica branch deployada na VPS |
| `develop1` | Integracao do **Dev 1** |
| `develop2` | Integracao do **Dev 2** |
| `develop3` | Integracao do **Dev 3** |
| `feature/modulo-descricao` | Nova funcionalidade (1 branch por tarefa) |
| `fix/modulo-descricao` | Correcao de bug |
| `hotfix/descricao` | Urgencia em producao (criar a partir de `main`) |

Cada dev trabalha na **sua** `developN`. Branches de tarefa (`feature/...`, `fix/...`) saem da `developN` correspondente.

```
main      ─────────────────────────────●  (deploy VPS)
     \           |            /
develop1    develop2    develop3
  (Dev1)      (Dev2)      (Dev3)
     \           |            /
      feat/A    fix/B      feat/C
```

## Impacto para usuarios finais

- Organizar Git e branches: **zero impacto** no dia a dia.
- Deploy de nova versao: usuarios veem apenas o que foi publicado; pode haver **alguns segundos** de indisponibilidade durante o restart do Node.
- Combinar deploy fora do horario comercial e avisar a equipe interna antes.

---

## 1. Setup inicial (uma vez)

### 1.1 Repositorio no GitHub

Repo oficial: `tecnologiadados-netizen/Gestao_Smart_Soaco`.

**Nao** commitar `.env`, `node_modules`, certificados SSL ou `backend/prisma/*.db`.

### 1.2 Inicializar Git (maquina com o codigo atual)

```powershell
cd C:\gestorpedidosSoAco
powershell -ExecutionPolicy Bypass -File scripts/init-git-repo.ps1 -RemoteUrl "https://github.com/tecnologiadados-netizen/Gestao_Smart_Soaco.git"
powershell -ExecutionPolicy Bypass -File scripts/setup-branches.ps1
git push -u origin main
git push -u origin develop1
git push -u origin develop2
git push -u origin develop3
```

### 1.3 Protecoes no GitHub

Ver **[GITHUB-BRANCH-PROTECTION.md](GITHUB-BRANCH-PROTECTION.md)**.

**`main` (obrigatorio):** PR + 1 aprovacao + bloquear push direto.

**`develop1`, `develop2`, `develop3` (recomendado):** exigir PR.

### 1.4 Desativar backup automatico antigo (VPS)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/desativar-backup-agendado.ps1
```

---

## 2. Setup de cada desenvolvedor (PC local)

### 2.1 Clone e dependencias

```powershell
git clone https://github.com/tecnologiadados-netizen/Gestao_Smart_Soaco.git
cd Gestao_Smart_Soaco
npm install
npm install --prefix backend
npm install --prefix frontend
copy backend\.env.example backend\.env
git checkout develop2    # cada dev usa a sua: develop1, develop2 ou develop3
git pull origin develop2
```

Edite `backend\.env` com credenciais **locais**. Cada dev tem seu proprio `backend/prisma/dev.db` (SQLite, ignorado pelo Git).

### 2.2 Rodar em desenvolvimento

```powershell
npm run dev
```

- API: `http://localhost:4000`
- Frontend interno: `http://localhost:5180`
- Health: `http://localhost:4000/health`

**Regra:** desenvolvimento **sempre no PC local**. Nao rodar `npm run dev` na VPS de producao.

---

## 3. Rotina por tarefa

Substitua `develop2` pela **sua** branch (`develop1`, `develop2` ou `develop3`):

```powershell
git checkout develop2
git pull origin develop2
git checkout -b feature/nome-da-tarefa

# ... alteracoes ...
npm run test --prefix backend
git add .
git commit -m "feat(modulo): descricao clara do que e por que"
git push -u origin feature/nome-da-tarefa
```

1. Abrir **Pull Request** no GitHub: `feature/...` → `develop2` (sua developN)
2. Outro dev revisa e aprova
3. Merge apos CI verde

### Integrar em producao

Quando a `developN` estiver estavel (testada localmente):

1. PR `develop2` → `main` (ou a developN correspondente)
2. Aprovar e merge
3. Deploy automatico apos CI verde (secao 5) — ou manual se o runner ainda nao estiver configurado

Apos merge em `main`, sincronize sua developN:

```powershell
git checkout develop2
git pull origin main   # ou merge main em develop2 via PR
```

### Mensagens de commit (sugestao)

- `feat(pcp): adiciona filtro por familia`
- `fix(login): corrige cookie em HTTPS`
- `chore(ci): ajusta workflow`

---

## 4. Hotfix emergencial

```powershell
git checkout main
git pull origin main
git checkout -b hotfix/descricao-curta
# ... correcao minima ...
git push -u origin hotfix/descricao-curta
```

1. PR `hotfix/...` → `main` (revisao rapida)
2. Deploy na VPS
3. PR `hotfix/...` → `develop1`, `develop2` e `develop3` (manter sincronizadas)

---

## 5. Deploy em producao (VPS Hostinger via GitHub)

Producao **nao** e atualizada editando arquivos na VPS. A fonte da verdade e a branch **`main`** no GitHub.

**Deploy automatico (recomendado):** merge em `main` → CI verde → GitHub Actions executa `deploy-producao.ps1` na VPS via self-hosted runner. Ver **[DEPLOY-AUTOMATICO.md](DEPLOY-AUTOMATICO.md)**.

```
Dev PC (developN) → PR → main → CI → Deploy producao (runner) → gsmartsoaco.com.br
```

Runbook manual / fallback: **[DEPLOY-PRODUCAO-VPS.md](DEPLOY-PRODUCAO-VPS.md)**

### 5.1 Estrutura na VPS

```
C:\apps\gestor-pedidos\              ← clone Git, branch main
C:\apps\gestor-pedidos\backend\.env  ← secrets (nao versionado)
```

Setup inicial (uma vez):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-vps-producao.ps1
notepad C:\apps\gestor-pedidos\backend\.env
powershell -ExecutionPolicy Bypass -File scripts/setup-prod-service.ps1 -PastaProjeto "C:\apps\gestor-pedidos"
```

### 5.2 Deploy (cada release, apos merge em main)

**Automatico:** apos setup do runner (secao 5.1 abaixo), nada a fazer — acompanhe em GitHub → Actions → **Deploy producao**.

**Manual (fallback):**

```powershell
cd C:\apps\gestor-pedidos
npm run deploy:producao
```

O script faz: `git pull --ff-only origin main` → `npm install` → `prisma migrate deploy` → `npm run build:production` → restart NSSM → validacao `/health`.

**Apos deploy:** Ctrl+Shift+R nos navegadores (evita cache de JS/CSS antigo).

### 5.2.1 Setup deploy automatico (uma vez na VPS)

```powershell
# Token: GitHub → Settings → Actions → Runners → New self-hosted runner
powershell -ExecutionPolicy Bypass -File scripts/setup-github-runner.ps1 -RegistrationToken "TOKEN"
```

### 5.3 Servico Windows (NSSM)

```powershell
Get-Service GestorPedidosSoaco
Restart-Service GestorPedidosSoaco
```

---

## 6. Coordenacao entre 3 devs

| Situacao | Pratica |
|----------|---------|
| Dois devs no mesmo modulo | Dividir por tela/arquivo ou sequenciar; avisar no PR |
| Migrations Prisma | Uma migration por PR; quem mergeia primeiro "ganha" |
| Deploy com migration | Autor do PR com migration executa deploy e avisa equipe |
| Novas variaveis `.env` | Documentar em `backend/.env.example` |
| Conflito de merge | Resolver no PC do autor da branch, **nunca** na VPS |

**Atribuicao sugerida:**

| Dev | Branch |
|-----|--------|
| Dev 1 | `develop1` |
| Dev 2 | `develop2` |
| Dev 3 | `develop3` |

---

## 7. CI e deploy automatico (GitHub Actions)

| Workflow | Quando roda | Onde |
|----------|-------------|------|
| **CI** (`.github/workflows/ci.yml`) | PR e push em `main`, `develop1/2/3` | GitHub (windows-latest) |
| **Deploy producao** (`.github/workflows/deploy-producao.yml`) | Apos CI verde em **push** em `main` | Self-hosted runner na VPS |

Setup do runner: **[DEPLOY-AUTOMATICO.md](DEPLOY-AUTOMATICO.md)**

---

## 8. O que NAO fazer

- Push direto em `main`
- Deploy de branch `feature/*` em producao
- Trabalhar na `developN` de outro dev sem combinar
- Commitar `backend/.env`, `*.db` ou certificados

---

## 9. Checklist de adocao

- [x] Repo GitHub + branches `main`, `develop1`, `develop2`, `develop3`
- [ ] Protecoes de branch no GitHub
- [ ] Clone nos 3 PCs + `.env` local + checkout da developN correta
- [ ] `setup-vps-producao.ps1` + `.env` producao
- [ ] Primeiro ciclo: feature → PR → developN → PR → main → deploy

---

## 10. Scripts de referencia

| Script | Funcao |
|--------|--------|
| `scripts/init-git-repo.ps1` | Inicializa repo e primeiro commit |
| `scripts/setup-branches.ps1` | Cria `develop1/2/3` |
| `scripts/desativar-backup-agendado.ps1` | Remove agendamento do backup cego |
| `scripts/setup-vps-producao.ps1` | Clone limpo em `C:\apps\gestor-pedidos` |
| `scripts/setup-prod-service.ps1` | Servico Windows NSSM |
| `scripts/deploy-producao.ps1` | Deploy via GitHub (`git pull --ff-only` + build + NSSM) |
| `scripts/setup-github-runner.ps1` | Self-hosted runner (deploy automatico ao merge em main) |
| `docs/DEPLOY-AUTOMATICO.md` | Guia deploy automatico (estilo Vercel) |
| `docs/DEPLOY-PRODUCAO-VPS.md` | Runbook copiavel para deploy manual na VPS |
