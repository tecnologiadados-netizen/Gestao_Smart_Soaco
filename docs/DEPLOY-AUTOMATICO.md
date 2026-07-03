# Deploy automatico (main → producao)

Deploy estilo Vercel: ao mergear em **`main`**, o GitHub Actions roda o CI e, se passar, dispara o deploy na VPS **sem RDP nem comando manual**.

Repositorio: https://github.com/tecnologiadados-netizen/Gestao_Smart_Soaco

---

## Como funciona

```
PR merge → main (GitHub)
    → workflow CI (ubuntu/windows hosted)
    → CI verde
    → workflow Deploy producao (self-hosted runner na VPS)
    → scripts/deploy-producao.ps1 em C:\apps\gestor-pedidos
    → gsmartsoaco.com.br atualizado
```

Arquivos:

| Arquivo | Funcao |
|---------|--------|
| `.github/workflows/ci.yml` | Build + testes em todo push/PR |
| `.github/workflows/deploy-producao.yml` | Deploy apos CI verde em push em `main` |
| `scripts/setup-github-runner.ps1` | Instala o runner na VPS (uma vez) |

O job de deploy **nao** usa o checkout do runner — executa o script na pasta de producao (`C:\apps\gestor-pedidos`), que ja tem o `backend\.env` e faz `git pull`.

---

## Setup inicial (uma vez na VPS)

Pre-requisitos: `setup-vps-producao.ps1`, `backend\.env` e servico NSSM ja configurados (ver [DEPLOY-PRODUCAO-VPS.md](DEPLOY-PRODUCAO-VPS.md)).

### 1. Registrar self-hosted runner

1. GitHub → repositorio → **Settings** → **Actions** → **Runners** → **New self-hosted runner**
2. SO: **Windows**, arquitetura **x64**
3. Copie o **token** exibido (expira em ~1 hora)

### 2. Instalar na VPS (Administrador, RDP)

```powershell
cd C:\apps\gestor-pedidos
git pull origin main

powershell -ExecutionPolicy Bypass -File scripts/setup-github-runner.ps1 `
  -RegistrationToken "COLE_O_TOKEN_AQUI"
```

O script:

- Baixa o GitHub Actions runner em `C:\actions-runner`
- Registra com label **`producao`**
- Instala como servico Windows (LocalSystem, para Stop/Start do NSSM e portproxy)

### 3. Confirmar

- GitHub → **Settings** → **Actions** → **Runners** → runner **vps-hostinger-producao** com status **Idle**
- Faca um merge de teste em `main` e acompanhe **Actions** → **Deploy producao**

---

## Uso no dia a dia

1. PR → merge em `main` (como hoje)
2. Aguarde CI verde (~5–10 min)
3. Deploy dispara sozinho (~5–15 min, depende do build)
4. Confira: https://gsmartsoaco.com.br e `/health`

**Nao e mais necessario** RDP + `npm run deploy:producao` apos cada release (salvo emergencia).

---

## Deploy manual (emergencia)

GitHub → **Actions** → **Deploy producao** → **Run workflow**

Opcional: marcar **Pular prisma migrate deploy** se souber que nao ha migration nova.

Ou na VPS (como antes):

```powershell
cd C:\apps\gestor-pedidos
npm run deploy:producao
```

---

## Protecoes recomendadas

Em **Settings → Branches → main**:

- [x] Require status checks: **CI** (deploy so roda se CI passou)
- [x] Require PR + aprovacao (como hoje)

Ver [GITHUB-BRANCH-PROTECTION.md](GITHUB-BRANCH-PROTECTION.md).

---

## Solucao de problemas

| Sintoma | Acao |
|---------|------|
| Job "Deploy producao" fica **Queued** | Runner offline — RDP na VPS, `Get-Service actions.runner.*`, reinicie o servico |
| Deploy falhou, site no ar | Script restaura servico antigo; veja log em Actions |
| `Pasta de producao nao encontrada` | Rode `setup-vps-producao.ps1` |
| Token expirou no setup | Gere novo token em Settings → Runners → New runner |
| Quero desativar auto-deploy | Pare o servico do runner ou remova `deploy-producao.yml` |

Logs do runner (VPS): `C:\actions-runner\_diag\`

---

## Seguranca

- Runner so executa workflows do **seu** repositorio
- Label `producao` evita que outros repos usem esta maquina
- Secrets de producao ficam so em `backend\.env` na VPS (fora do Git)
- Runner roda como LocalSystem — mantenha a VPS com acesso RDP restrito
