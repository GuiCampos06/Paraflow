# API

Base: `http://localhost:3333/api`. Rotas protegidas exigem `Authorization: Bearer <jwt>`.
Erros: `{ "erro": "texto", "codigo": "CODIGO", "campos": { "campo": "mensagem" } }`.

**Multi-organização:** cada usuário pertence a UMA organização e só enxerga os dados dela (estoque, eventos, config, máquinas). O `organizacaoId` vem sempre do usuário autenticado, nunca do pedido.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/health` | pública | Estado do banco e do MQTT |
| POST | `/auth/register` | pública | `{organizacao, nome, usuario, email, senha}` → cria a organização; o usuário vira **dono**. Retorna `{token, usuario}` |
| POST | `/auth/login` | pública | `{identificador, senha}` (usuário **ou** e-mail) → `{token, usuario}` |
| GET | `/auth/me` | token | Confirma a sessão no servidor |
| GET | `/auth/disponibilidade?usuario=&email=` | pública | `{usuario: true, email: false}` (true = livre) |
| GET | `/estoque` | token | Itens comprimento×bitola, totais por bitola, alertas |
| GET | `/eventos?de=&ate=&bitola=&valido=&pagina=&limite=` | token | Peças processadas (paginado) |
| GET | `/eventos/resumo?de=&ate=` | token | Peças válidas por dia e bitola |
| POST | `/eventos` | token | Simula uma peça na 1ª máquina da organização (só com `ALLOW_SIMULATION=true`) |
| GET | `/config` | token | Regras da organização |
| PUT | `/config` | dono | `{limiteBaixo?, kDesvios?, tabelaPeso?}` |
| GET | `/dispositivo` | token | Máquinas da organização e status |
| POST | `/dispositivo` | dono | `{nome}` → vincula máquina. Retorna `{dispositivo, token}` (**token só aparece aqui**) |
| POST | `/dispositivo/:id/token` | dono | Gera novo token (o antigo deixa de valer) |
| DELETE | `/dispositivo/:id` | dono | Remove a máquina (o histórico fica) |
| POST | `/dispositivo/comando` | token | `{ligado: true|false, deviceId?}` → 202 |

## WebSocket (Socket.IO)
Conecte com `io(url, { auth: { token } })`. Cada conexão entra só na sala da sua organização. Eventos:
`estoque:atualizado`, `alerta:estoque-baixo`, `evento:novo`, `dispositivo:status`.

## MQTT (`<prefixo>` = `MQTT_TOPIC_PREFIX`; `<id>` = `deviceId` gerado pelo servidor)
Toda mensagem do ESP32 inclui `"token"`. Sem `deviceId` + token válidos, o backend descarta.

| Tópico | Sentido | Payload |
|---|---|---|
| `<prefixo>/<id>/evento` | ESP32 → backend | `{"comp":10,"bitola":"M3","peso":1.07,"valido":true,"token":"..."}` |
| `<prefixo>/<id>/status` | ESP32 → backend (retain + LWT) | `{"online":true,"ligado":true,"token":"..."}` |
| `<prefixo>/<id>/cmd` | backend → ESP32 (retain) | `{"ligado":false}` |
| `<prefixo>/<id>/alerta` | backend → ESP32 (retain) | `{"estoqueBaixo":true}` |

> Em broker público o token trafega em texto puro. Em produção use TLS e usuário/senha no broker.
