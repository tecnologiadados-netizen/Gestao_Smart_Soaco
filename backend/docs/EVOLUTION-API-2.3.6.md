# Evolution API 2.3.6 – Referência para integração

Coleção Postman de referência: [Evolution API v2.3 (agencia dg code)](https://www.postman.com/agenciadgcode/evolution-api/collection/nm0wqgt/evolution-api-v2-3)  
Documentação oficial: [doc.evolution-api.com/v2](https://doc.evolution-api.com/v2)

---

## Credenciais (JPG Soluções)

| Variável | Valor |
|----------|--------|
| **Host** | `api.jpgsolucoesinformatica.com.br` |
| **URL base** | `https://api.jpgsolucoesinformatica.com.br` |
| **Autenticação** | Header `apikey` (sem `Content-Type` em GET) |
| **apikey** | `429683C4C977415CAAFCCE10F7D57E11` |

---

## Endpoints principais (Instance Controller)

Base: `https://api.jpgsolucoesinformatica.com.br`

| Ação | Método | Path | Observação |
|------|--------|------|------------|
| **Listar instâncias** | GET | `/instances` | Retorna lista de instâncias. Header: só `apikey`. |
| **Criar instância** | POST | `/instance/create` | Body JSON: `instanceName`, opcional `integration`, `qrcode`. Header: `Content-Type: application/json` + `apikey`. |
| **Conectar / QR code** | GET | `/instance/connect/{instanceName}` | Retorna QR (code/base64) ou pairingCode. Header: só `apikey`. |
| **Estado da conexão** | GET | `/instance/connectionState/{instanceName}` | Retorna `state` (ex.: open, close, connecting). Header: só `apikey`. |
| **Reiniciar** | PUT | `/instance/restart/{instanceName}` | |
| **Logout** | DELETE | `/instance/logout/{instanceName}` | |
| **Deletar** | DELETE | `/instance/delete/{instanceName}` | |

---

## Envio de mensagem (Message Controller)

| Ação | Método | Path |
|------|--------|------|
| **Enviar texto** | POST | `/message/sendText/{instanceName}` |
| **Enviar mídia** | POST | `/message/sendMedia/{instanceName}` |
| **Enviar áudio** | POST | `/message/sendWhatsAppAudio/{instanceName}` |

Body típico para texto: `{ "number": "5586995887672", "text": "Mensagem" }`.  
Número no formato internacional sem `+`.

---

## Autenticação

- **GET**: usar apenas o header `apikey`. Não enviar `Content-Type` em GET (pode causar 404/erro em alguns provedores).
- **POST**: usar `Content-Type: application/json` e `apikey`.

---

## Fluxo para conectar WhatsApp

1. **GET** `/instances` → ver se a instância já existe.
2. Se não existir: **POST** `/instance/create` com `{ "instanceName": "minha-instancia", "qrcode": true }`.
3. **GET** `/instance/connectionState/{instanceName}` → se `state` !== `open`/`connected`:
4. **GET** `/instance/connect/{instanceName}` → obter QR (ou pairingCode) e exibir para o usuário escanear.
5. Após escanear, o estado passa a `open`/`connected`. Guardar `instanceName` para envio de mensagens.

---

## Variáveis de ambiente (.env)

```env
EVOLUTION_API_URL=https://api.jpgsolucoesinformatica.com.br
EVOLUTION_API_KEY=429683C4C977415CAAFCCE10F7D57E11
EVOLUTION_API_INSTANCE=
EVOLUTION_WHATSAPP_NUMBER=
```

Preencher `EVOLUTION_API_INSTANCE` e `EVOLUTION_WHATSAPP_NUMBER` após conectar a instância (para envio de notificações).

---

## Problemas comuns

### "Evolution API inacessível: fetch failed"

Significa que o **backend não consegue alcançar a URL** da Evolution API (não é problema de URL/KEY vazias no .env).

**O que verificar:**

1. **Acesso à URL** – No mesmo servidor onde o backend roda, teste:
   - Abrir no navegador: `https://api.jpgsolucoesinformatica.com.br`
   - Ou no terminal: `curl -I https://api.jpgsolucoesinformatica.com.br`
2. **Firewall / rede** – O servidor onde o backend está pode estar bloqueando saída para essa URL ou para a porta 443.
3. **DNS** – O host `api.jpgsolucoesinformatica.com.br` pode não ser resolvido nessa rede.
4. **Evolution API fora do ar** – Se a API estiver hospedada em outro servidor, confirme com o provedor (ex.: JPG Soluções) se o serviço está ativo e acessível.

Se a Evolution API rodar em **outra máquina ou rede**, garanta que essa URL seja acessível a partir do host onde o backend do gestor de pedidos está rodando.
