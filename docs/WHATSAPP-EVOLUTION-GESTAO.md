# WhatsApp Evolution API — Gestão Smart Soaco

Guia para subir a **Evolution API do zero** (sem depender do Otimiza) e conectar o Gestão.

> A Evolution API atual (**v2.3+**) exige **PostgreSQL** (não há mais SQLite).  
> Forma recomendada no Windows: **Docker Compose**.

---

## Visão geral

```
Gestão (backend)
  → EVOLUTION_API_URL=http://127.0.0.1:8081
  → EVOLUTION_API_KEY  (= AUTHENTICATION_API_KEY da Evolution)
    → Docker: gestao_evolution_api (:8081)
      → WhatsApp (QR / Baileys)
```

Código no Gestão:

| Arquivo | Função |
|---------|--------|
| `backend/src/services/evolutionApi.ts` | Cliente + gate de sessão + retry |
| `backend/src/controllers/evolutionController.ts` | QR / status / logout |
| `frontend/src/pages/WhatsAppConnectPage.tsx` | Tela WhatsApp |
| `docs/WHATSAPP-EVOLUTION-GESTAO.md` | Este guia |

---

## Fase 1 — Docker Desktop ligado

1. Abra o **Docker Desktop** e aguarde ficar “Running”.
2. Confirme: `docker info` não deve falhar.

---

## Fase 2 — Pasta da Evolution (já pode existir)

Se ainda não clonou:

```powershell
git clone https://github.com/EvolutionAPI/evolution-api.git $env:USERPROFILE\evolution-api
```

Na raiz do Gestão, sincronize a chave e gere os arquivos Docker:

```powershell
cd C:\Users\Davi\Downloads\Cursor\Gestao_Smart\Gestao_Smart_Soaco
node scripts/setup-evolution-api.mjs
```

Isso:
- garante o clone em `%USERPROFILE%\evolution-api`
- cria `docker-compose.gestao.yaml` e `.env.gestao`
- copia `EVOLUTION_API_KEY` do `backend/.env` para `AUTHENTICATION_API_KEY`

Suba a stack:

```powershell
cd $env:USERPROFILE\evolution-api
docker compose -f docker-compose.gestao.yaml --env-file .env.gestao up -d
```

Teste:

```powershell
# Use a mesma chave de EVOLUTION_API_KEY do backend/.env
curl -H "apikey: SUA_CHAVE" http://127.0.0.1:8081/instance/fetchInstances
```

---

## Fase 3 — Backend do Gestão

No `backend/.env` (já preparado na migração):

```env
EVOLUTION_API_URL=http://127.0.0.1:8081
EVOLUTION_API_KEY=...   # igual ao AUTHENTICATION_API_KEY / .env.gestao
EVOLUTION_API_INSTANCE=gestao-soaco
# NOTIFICACOES_ENVIO_HABILITADO=true   # só em produção
```

Reinicie: `npm run dev:start` na raiz do Gestão.

---

## Fase 4 — Conectar WhatsApp

1. Menu **WhatsApp** no Gestão  
2. Escaneie o QR  
3. Salve o número (DDI 55)  
4. Em produção: `NOTIFICACOES_ENVIO_HABILITADO=true`

---

## Melhorias de envio (já no código)

- Checagem de sessão antes de cada envio  
- Até 3 tentativas (2s / 5s / 10s)  
- Timeout HTTP 45s  
- Delay entre destinatários (padrão 500 ms)

---

## Persistência após reinício (como o Otimiza com PM2)

No Otimiza a Evolution sobe com **PM2 + `pm2 startup`**: o processo volta sozinho e a sessão WhatsApp fica em disco (sem novo QR).

No Gestão (Docker) o equivalente é:

1. **Volume** `gestao_evolution_instances` — guarda a sessão Baileys (já no compose, `restart: unless-stopped`).
2. **Docker Desktop no login** + tarefa agendada que faz `compose up -d`.

Registrar **uma vez** nesta máquina:

```powershell
cd C:\Users\Davi\Downloads\Cursor\Gestao_Smart\Gestao_Smart_Soaco
powershell -ExecutionPolicy Bypass -File scripts\register-evolution-autostart.ps1
```

Isso cria:
- tarefa `GestaoSmart-EvolutionDocker` no logon;
- atalho do Docker Desktop na pasta Inicializar.

Testar sem reiniciar:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\ensure-evolution-docker.ps1
```

Log: `%LOCALAPPDATA%\GestaoSmart\evolution-autostart.log`

**Quando ainda precisa escanear QR de novo:** só se o WhatsApp do celular removeu o aparelho vinculado, ou se o volume Docker foi apagado (`docker volume rm …`). Reinício normal do PC **não** deve pedir QR.

## Dev vs produção

| Ambiente | Onde sobe o Docker | Observação |
|----------|--------------------|------------|
| Dev | Esta máquina | Registrar autostart (script acima) |
| Prod Gestão | Servidor do Gestão | Mesmo compose + mesmo `register-evolution-autostart.ps1`; QR do chip de produção |

Não use a Evolution do Otimiza (outra rede).

---

## Troubleshooting

| Sintoma | Ação |
|---------|------|
| `open //./pipe/dockerDesktopLinuxEngine` | Ligar o Docker Desktop |
| Evolution API não configurada | Conferir `EVOLUTION_*` no `.env` e reiniciar backend |
| ECONNREFUSED :8081 | `docker compose … ps` — container `gestao_evolution_api` up? |
| WhatsApp desconectado | Reescanear QR |
| Dry-run | `NOTIFICACOES_ENVIO_HABILITADO=true` só em produção |

---

## Checklist

- [ ] Docker Desktop running  
- [ ] `docker compose -f docker-compose.gestao.yaml --env-file .env.gestao up -d`  
- [ ] `curl` em `/instance/fetchInstances` OK  
- [ ] Gestão com `EVOLUTION_API_URL` / `KEY` / `INSTANCE`  
- [ ] Backend reiniciado  
- [ ] QR conectado + número salvo  
- [ ] (Prod) `NOTIFICACOES_ENVIO_HABILITADO=true`  
- [ ] Teste de mensagem chegou no celular  
