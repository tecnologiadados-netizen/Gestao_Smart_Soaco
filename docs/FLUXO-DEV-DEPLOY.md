# Fluxo de desenvolvimento e deploy — 3 desenvolvedores

Guia operacional para trabalhar em paralelo sem prejudicar producao (`gsmartsoaco.com.br`).

## Visao geral

| Branch | Uso |
|--------|-----|
| `main` | **Producao** — unica branch deployada na VPS |
| `develop` | Integracao de features antes de ir para `main` |
| `feature/modulo-descricao` | Nova funcionalidade (1 branch por tarefa) |
| `fix/modulo-descricao` | Correcao de bug |
| `hotfix/descricao` | Urgencia em producao (criar a partir de `main`) |

**Nao** use branches permanentes por pessoa (`dev-joao`, `dev-maria`). Cada tarefa ganha sua propria branch.

```
main     ─────────────────────────────●  (deploy VPS)
              \                 /
develop  ──●────●────●────●──●
            \    /       /
             ●──●     ●──●
          feat/pcp  fix/login  feat/relatorio
```

## Impacto para usuarios finais

- Organizar Git e branches: **zero impacto** no dia a dia.
- Deploy de nova versao: usuarios veem apenas o que foi publicado; pode haver **alguns segundos** de indisponibilidade durante o restart do Node.
- Combinar deploy fora do horario comercial e avisar a equipe interna antes.

---

## 1. Setup inicial (uma vez)

### 1.1 Criar repositorio no GitHub

1. Criar repo `gestor-pedidos-soaco` (ou renomear o existente `gestaosmartbkp`).
2. **Nao** commitar `.env`, `node_modules`, certificados SSL ou `backend/prisma/*.db`.

### 1.2 Inicializar Git (maquina com o codigo atual)

```powershell
cd C:\gestorpedidosSoAco
powershell -ExecutionPolicy Bypass -File scripts/init-git-repo.ps1 -RemoteUrl "https://github.com/ORG/gestor-pedidos-soaco.git"
powershell -ExecutionPolicy Bypass -File scripts/setup-branches.ps1
git push -u origin main
git push -u origin develop
```

### 1.3 Protecoes no GitHub

Em **Settings → Branches → Add branch protection rule**:

**`main` (obrigatorio):**
- Require a pull request before merging
- Require approvals: **1**
- Do not allow bypassing the above settings
- (Opcional) Require status checks: workflow **CI**

**`develop` (recomendado):**
- Require a pull request before merging

### 1.4 Desativar backup automatico antigo (VPS)

O script `scripts/backup-github.ps1` foi **descontinuado** (fazia `git add .` cego).

```powershell
powershell -ExecutionPolicy Bypass -File scripts/desativar-backup-agendado.ps1
```

---

## 2. Setup de cada desenvolvedor (PC local)

### 2.1 Clone e dependencias

```powershell
git clone https://github.com/ORG/gestor-pedidos-soaco.git
cd gestor-pedidos-soaco
npm install
npm install --prefix backend
npm install --prefix frontend
copy backend\.env.example backend\.env
```

Edite `backend\.env` com credenciais **locais** (Nomus, Shop9, etc.). Cada dev tem seu proprio `backend/prisma/dev.db` (SQLite, ignorado pelo Git).

### 2.2 Rodar em desenvolvimento

```powershell
npm run dev
```

- API: `http://localhost:4000`
- Frontend interno: `http://localhost:5180`
- Health: `http://localhost:4000/health`

**Regra:** desenvolvimento **sempre no PC local**. Nao rodar `npm run dev` na VPS de producao (conflito na porta 4000).

---

## 3. Rotina por tarefa

```powershell
git checkout develop
git pull origin develop
git checkout -b feature/nome-da-tarefa

# ... alteracoes ...
npm run test --prefix backend
git add .
git commit -m "feat(modulo): descricao clara do que e por que"
git push -u origin feature/nome-da-tarefa
```

1. Abrir **Pull Request** no GitHub: `feature/...` → `develop`
2. Outro dev revisa e aprova
3. Merge apos CI verde (GitHub Actions roda test + build)

### Integrar em producao

Quando `develop` estiver estavel (testado por pelo menos 2 devs):

1. PR `develop` → `main`
2. Aprovar e merge
3. Executar deploy na VPS (secao 5)

### Mensagens de commit (sugestao)

- `feat(pcp): adiciona filtro por familia`
- `fix(login): corrige cookie em HTTPS`
- `chore(ci): ajusta workflow`

---

## 4. Hotfix emergencial

Quando producao precisa de correcao **urgente**:

```powershell
git checkout main
git pull origin main
git checkout -b hotfix/descricao-curta
# ... correcao minima ...
git push -u origin hotfix/descricao-curta
```

1. PR `hotfix/...` → `main` (revisao rapida)
2. Deploy na VPS
3. PR `hotfix/...` → `develop` (manter branches sincronizadas)

**Se alguem editou direto na VPS:** copiar alteracao para branch `hotfix/...` no mesmo dia e fazer PR. Nunca deixar codigo so na VPS.

---

## 5. Deploy em producao (VPS)

### 5.1 Estrutura recomendada na VPS

```
C:\apps\gestor-pedidos\          ← clone Git, branch main
C:\apps\gestor-pedidos\backend\.env   ← secrets (nao versionado)
```

Setup inicial na VPS:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-vps-producao.ps1 -RemoteUrl "https://github.com/ORG/gestor-pedidos-soaco.git"
# Editar backend\.env
powershell -ExecutionPolicy Bypass -File scripts/setup-prod-service.ps1 -PastaProjeto "C:\apps\gestor-pedidos"
```

### 5.2 Deploy (cada release)

**Apenas 1 pessoa por vez.** Preferir horario apos expediente.

```powershell
cd C:\apps\gestor-pedidos
powershell -ExecutionPolicy Bypass -File scripts/deploy-producao.ps1 -PastaProjeto "C:\apps\gestor-pedidos"
```

O script executa:
1. `git pull origin main`
2. `npm ci` (raiz, backend, frontend)
3. `prisma generate` + `prisma migrate deploy`
4. `npm run build:production`
5. Restart do servico Windows `GestorPedidosSoaco`
6. Smoke test em `/health`

Flags uteis:
- `-SemMigrate` — pular migrations (so quando tiver certeza)
- `-SemRestart` — build sem reiniciar servico

### 5.3 Servico Windows (NSSM)

Instalado por `scripts/setup-prod-service.ps1`:
- Nome: `GestorPedidosSoaco`
- Auto-start no boot
- Logs: `backend/logs/service-stdout.log`, `service-stderr.log`

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
| Edicao na VPS | So hotfix emergencial; espelhar no Git no mesmo dia |

**Daily opcional (5 min):** o que cada um faz, qual branch, quais modulos toca.

---

## 7. CI (GitHub Actions)

Arquivo: `.github/workflows/ci.yml`

Roda em PRs para `main` e `develop`:
- `npm ci` (raiz, backend, frontend)
- `npm run test` (backend)
- `npm run build:production`

Nao substitui teste manual das telas (nao ha staging na VPS).

---

## 8. O que NAO fazer

- Push direto em `main`
- Deploy de branch `feature/*` em producao
- Manter `backup-github.ps1` agendado
- Commitar `backend/.env`, `*.db` ou certificados em `deploy/ssl/`
- Editar `.ts`/`.tsx` direto na pasta de producao

---

## 9. Checklist de adocao

- [ ] Repo GitHub criado + `init-git-repo.ps1` + push `main` e `develop`
- [ ] Protecoes de branch no GitHub
- [ ] `desativar-backup-agendado.ps1` na VPS
- [ ] Clone nos 3 PCs + `.env` local
- [ ] `setup-vps-producao.ps1` + `.env` producao
- [ ] `setup-prod-service.ps1` (servico NSSM)
- [ ] Primeiro ciclo: feature → PR → develop → PR → main → deploy

---

## 10. Scripts de referencia

| Script | Funcao |
|--------|--------|
| `scripts/init-git-repo.ps1` | Inicializa repo e primeiro commit |
| `scripts/setup-branches.ps1` | Cria `develop` e documenta convencao |
| `scripts/desativar-backup-agendado.ps1` | Remove agendamento do backup cego |
| `scripts/setup-vps-producao.ps1` | Clone limpo em `C:\apps\gestor-pedidos` |
| `scripts/setup-prod-service.ps1` | Servico Windows NSSM |
| `scripts/deploy-producao.ps1` | Deploy controlado (pull, build, migrate, restart) |

---

## Riscos conhecidos

1. **Seed automatico:** o backend pode rodar seed se nao houver usuarios — validar comportamento em producao antes do primeiro deploy com banco real.
2. **Migrations destrutivas:** sempre revisar SQL da migration antes de `migrate deploy` em producao.
3. **Sem staging na VPS:** testes de integracao dependem do ambiente local de cada dev + CI de build/test.
