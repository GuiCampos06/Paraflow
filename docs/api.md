# API

Base: `http://localhost:3333/api`. As rotas protegidas pedem `Authorization: Bearer <token>`.
Erros voltam como `{ "erro": "texto", "codigo": "CODIGO", "campos": { "campo": "mensagem" } }`.

Cada usuário só enxerga os dados da própria empresa.

## Conta

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/health` | público | estado do banco e do MQTT |
| POST | `/auth/register` | público | cadastro com `organizacao` (cria a empresa) ou `codigoConvite` (entra numa empresa) |
| POST | `/auth/login` | público | `{identificador, senha}` (usuário ou e-mail) |
| GET | `/auth/me` | logado | confirma a sessão |
| GET | `/auth/disponibilidade?usuario=&email=` | público | diz se usuário e e-mail estão livres |
| GET | `/auth/convite/:codigo` | público | mostra a empresa do convite sem usar o código |

## Estoque e histórico

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/estoque` | logado | estoque atual por tipo, totais, alertas e tipos com menos peças |
| GET | `/estoque/estatisticas` | logado | contadas hoje, médias, últimos 14 dias, rejeição e retiradas |
| GET | `/eventos` | logado | peças processadas, com filtros e paginação |
| GET | `/eventos/resumo` | logado | peças válidas por dia e bitola |
| POST | `/eventos` | logado | simula uma peça (só com `ALLOW_SIMULATION=true`) |

## Pedidos

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/pedidos` | logado | lista os pedidos da empresa |
| GET | `/pedidos/previsao` | logado | previsão de consumo dos próximos 7 dias e quando cada tipo deve acabar |
| POST | `/pedidos` | logado | `{bitola, comprimentoMm, quantidade}`; responde 409 se não houver estoque |
| POST | `/pedidos/:id/retirar` | dono ou quem pediu | confirma a retirada |
| POST | `/pedidos/:id/cancelar` | dono ou quem pediu | cancela e devolve as peças |

## Máquinas e regras

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/dispositivo` | logado | máquinas e status |
| POST | `/dispositivo` | dono | vincula uma máquina; o token aparece só nessa resposta |
| POST | `/dispositivo/:id/token` | dono | gera um token novo |
| DELETE | `/dispositivo/:id` | dono | remove a máquina (o histórico fica) |
| POST | `/dispositivo/comando` | logado | `{ligado}` ou `{tara: true}` |
| GET | `/config` | logado | regras da empresa |
| PUT | `/config` | dono | altera `limiteBaixo` e a tabela de peso |

## Equipe (só o dono)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/equipe` | membros e convites pendentes |
| POST | `/equipe/convites` | cria um convite; o código aparece só nessa resposta |
| DELETE | `/equipe/convites/:id` | revoga um convite |
| POST | `/equipe/membros` | cria um usuário direto |
| PATCH | `/equipe/membros/:id` | muda o papel |
| DELETE | `/equipe/membros/:id` | remove o usuário |

## WebSocket

Conecta com `io(url, { auth: { token } })`. Eventos: `estoque:atualizado`, `alerta:estoque-baixo`, `evento:novo`, `dispositivo:status`, `dispositivo:telemetria` e `pedido:atualizado`.

## MQTT

`<prefixo>` é o `MQTT_TOPIC_PREFIX` e `<id>` é o `deviceId` da máquina. Toda mensagem do ESP32 leva o campo `token`.

| Tópico | Quem envia | Conteúdo |
|---|---|---|
| `<prefixo>/<id>/evento` | ESP32 | `{"comp":10,"bitola":"M3","peso":1.07,"valido":true,"token":"..."}` |
| `<prefixo>/<id>/status` | ESP32 | `{"online":true,"ligado":true,"token":"..."}` |
| `<prefixo>/<id>/telemetria` | ESP32 | `{"peso":1.07,"estavel":true,"rssi":-60,"token":"..."}` |
| `<prefixo>/<id>/cmd` | backend | `{"ligado":false}` ou `{"tara":true}` |
| `<prefixo>/<id>/pedido` | backend | `{"id":"...","comp":10,"bitola":"M3","qtd":20}` |
| `<prefixo>/<id>/alerta` | backend | `{"estoqueBaixo":true}` |
