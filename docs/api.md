# API

Base: `http://localhost:3333/api`. Rotas protegidas exigem `Authorization: Bearer <jwt>`.
Erros: `{ "erro": "texto", "codigo": "CODIGO", "campos": { "campo": "mensagem" } }`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/health` | pública | Estado do banco e do MQTT |
| POST | `/auth/register` | pública | `{nome, usuario, email, senha}` → `{token, usuario}` |
| POST | `/auth/login` | pública | `{identificador, senha}` (usuário **ou** e-mail) → `{token, usuario}` |
| GET | `/auth/me` | token | Confirma a sessão no servidor |
| GET | `/auth/disponibilidade?usuario=&email=` | pública | `{usuario: true, email: false}` (true = livre) |
| GET | `/estoque` | token | Itens comprimento×bitola, totais por bitola, alertas |
| GET | `/eventos?de=&ate=&bitola=&valido=&pagina=&limite=` | token | Peças processadas (paginado) |
| GET | `/eventos/resumo?de=&ate=` | token | Peças válidas por dia e bitola |
| POST | `/eventos` | token | Simula uma peça (só com `ALLOW_SIMULATION=true`) |
| GET | `/config` | token | Regras do sistema |
| PUT | `/config` | admin | `{limiteBaixo?, kDesvios?, tabelaPeso?}` |
| GET | `/dispositivo` | token | Dispositivos e status |
| POST | `/dispositivo/comando` | token | `{ligado: true|false, deviceId?}` → 202 |

## WebSocket (Socket.IO)
Conecte com `io(url, { auth: { token } })`. Eventos do servidor:
`estoque:atualizado`, `alerta:estoque-baixo`, `evento:novo`, `dispositivo:status`.

## MQTT (`<prefixo>` = `MQTT_TOPIC_PREFIX`)
| Tópico | Sentido | Payload |
|---|---|---|
| `<prefixo>/<id>/evento` | ESP32 → backend | `{"comp":10,"bitola":"M3","peso":1.07,"valido":true}` |
| `<prefixo>/<id>/status` | ESP32 → backend (retain + LWT) | `{"online":true,"ligado":true}` |
| `<prefixo>/<id>/cmd` | backend → ESP32 (retain) | `{"ligado":false}` |
| `<prefixo>/<id>/alerta` | backend → ESP32 (retain) | `{"estoqueBaixo":true}` |
