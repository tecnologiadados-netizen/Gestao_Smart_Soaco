# Módulo Qualidade (SGQ)

Sistema de Gestão da Qualidade integrado ao Gestor de Pedidos.

## Estrutura

```
qualidade/
  sgq/                 # App Next.js (Documentos, Calibrações, Registros RNC/RCC, etc.)
backend/src/
  routes/qualidadeRoutes.ts
  data/qualidadeNomusRepository.ts   # clientes, produtos, fornecedores via NOMUS_DB_URL
  services/qualidadePdfService.ts    # PDFs RNC/RCC (Python)
backend/scripts/sgq/               # scripts Python de PDF
```

## Acesso

- Menu **Qualidade** no sistema principal → `/qualidade/sgq/documentos`
- APIs ERP: `/api/qualidade/*` (autenticadas, permissão `qualidade.ver`)
- Banco Nomus: mesma variável `NOMUS_DB_URL` do backend

## Desenvolvimento

Na raiz do repositório, `npm run dev` sobe API (4000), Vite (5180+) e SGQ Next (3001).

Primeira vez:

```bash
npm run dev:full:sgq
```

PDFs RNC/RCC exigem Python com dependências em `backend/scripts/sgq/*/requirements.txt` e Microsoft Word (docx2pdf no Windows).

## Produção

```bash
npm run build:production
npm run start:production
```

Isso inicia o backend na `APP_PORT` e o SGQ na `SGQ_PORT` (padrão 3001). O Express faz proxy de `/qualidade/sgq/*` para o Next.js.
