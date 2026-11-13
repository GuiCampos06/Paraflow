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

O alerta de estoque baixo compara o disponível de cada combinação de `bitola` + `comprimentoMm` com `limiteBaixo`, usando `<` (igual ao limite não alerta). Por exemplo, M3 de 5 mm com 20 disponíveis aciona o limite de 30 mesmo que outros comprimentos de M3 tenham mais de 30. `tiposBaixos` contém `{bitola, comprimentoMm, quantidade}`; `bitolasBaixas` permanece como lista de bitolas distintas para compatibilidade. `estoqueBaixo` indica se há algum tipo abaixo do limite. Após a primeira entrada válida, combinações zeradas também alertam; antes dela, o alerta fica suprimido. Limite zero desativa os alertas.

### Estatísticas da contagem diária

`GET /estoque/estatisticas` inclui `mediaUltimos14Dias` e `desvioPadraoUltimos14Dias`, em peças/dia e arredondados para uma casa decimal. Os dois usam os mesmos 14 dias corridos no fuso America/Sao_Paulo, incluindo dias sem contagem como zero e hoje ainda em andamento. O desvio é populacional: `sqrt(soma((contagemDoDia - media)^2) / 14)`, não o erro padrão da média.

`contagemDiaria` informa período, tipo de desvio, fuso e inclusão de dias zerados/hoje. `mediaPorDia` continua usando apenas dias ativos do histórico completo; `desvioPadraoPorDia` acompanha essa mesma série. `totalReservado` conta peças de pedidos abertos; `totalRetiradoConfirmado` conta somente retirados. `totalRetirado` mantém o contrato antigo, incluindo abertos e retirados.

Peças recebidas por MQTT ou simulação também são conferidas contra o catálogo da empresa. Comprimento não suportado ou bitola não suportada em peça válida produzem `CATALOGO_INVALIDO` na API; mensagens MQTT inválidas não são gravadas.

## Pedidos

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/pedidos` | logado | lista os pedidos da empresa |
| GET | `/pedidos/previsao` | logado | previsão de consumo dos próximos 7 dias e quando cada tipo deve acabar |
| POST | `/pedidos` | logado | `{bitola, comprimentoMm, quantidade}`; responde 409 se não houver estoque |
| POST | `/pedidos/:id/retirar` | dono ou quem pediu | confirma a retirada |
| POST | `/pedidos/:id/cancelar` | dono ou quem pediu | cancela e devolve as peças |

## Máquinas e regras

O envio de comando aguarda o ACK MQTT por até 10 segundos. Falta de ACK ou desconexão retorna HTTP 503 com `codigo: MQTT_OFFLINE`. Isso não prova que uma publicação pendente deixou de ser entregue: confira o estado da máquina antes de repetir. O ACK do broker também não confirma execução física.

No site, comandos e consultas/alterações do simulador têm prazo de 15 segundos, incluindo leitura do corpo HTTP. Ao esgotar, o cliente libera o carregamento e mostra `TEMPO_ESGOTADO`; não repete alterações automaticamente. As demais chamadas têm prazo de 75 segundos para acomodar o despertar do Render Free.

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/dispositivo` | logado | máquinas e status |
| POST | `/dispositivo` | dono | vincula uma máquina; o token aparece só nessa resposta |
| POST | `/dispositivo/:id/token` | dono | gera um token novo |
| DELETE | `/dispositivo/:id` | dono | remove a máquina (o histórico fica) |
| POST | `/dispositivo/comando` | logado | `{ligado}` ou `{tara: true}` |
| GET | `/config` | logado | regras da empresa |
| PUT | `/config` | dono | altera `limiteBaixo` e a tabela de peso |
| GET | `/simulador` | dono | estado da simulação de contagem da empresa |
| PUT | `/simulador` | dono | `{ativo:true, deviceId}` inicia; `{ativo:false}` para |

O simulador do site exige `ALLOW_SIMULATION=true` para iniciar. A resposta é `{disponivel, ativo, deviceId, contados, erro}`. Há uma simulação por empresa e processo do backend. Iniciar novamente na mesma máquina é idempotente; trocar de máquina exige desligar antes. A máquina deve pertencer à empresa da sessão. O servidor registra uma peça por segundo, seguindo o catálogo/tabela de peso da empresa, com cerca de 10% de rejeições. Os eventos entram no histórico e no estoque normalmente e disparam Socket.IO e o alerta MQTT; o simulador não publica um status fictício da máquina nem altera seu estado físico. Não precisa do token da máquina no navegador.

A simulação continua ao sair da página e para ao desligar, reiniciar o servidor ou encontrar uma falha. Desligar aguarda uma gravação já em andamento antes de responder. `contados` inclui válidas e rejeitadas da sessão atual. Em implantações com mais de um processo, o controle precisa de coordenação compartilhada antes de ser habilitado.

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

`alerta:estoque-baixo` inclui `{bitolas, tipos, limite}`, com `tipos` no mesmo formato de `tiposBaixos` do estoque.

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
