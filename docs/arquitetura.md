# Arquitetura

## Fluxo de dados
1. O ESP32 detecta o comprimento (sensor), pesa a peça, identifica a bitola pela tabela de peso e move o carrossel.
2. Publica `{"comp":10,"bitola":"M3","peso":1.07,"valido":true,"token":"..."}` em `<prefixo>/<deviceId>/evento`.
3. O backend assina `<prefixo>/+/evento`, confere deviceId + token (descobrindo a organização da máquina), valida com zod, grava o evento com o `organizacaoId` e recalcula o estoque dessa organização.
4. O backend emite `estoque:atualizado` por Socket.IO só para a sala da organização e publica `alerta` de volta às máquinas dela (LED).
5. Comandos do operador: `POST /api/dispositivo/comando` → backend publica em `<prefixo>/<deviceId>/cmd` → ESP32 aplica e responde com `status`.

## Decisões
- **Estoque derivado dos eventos** (agregação no MongoDB): sem contador duplicado, reiniciar o ESP32 não perde nada, e o histórico por dia vem de graça.
- **Barramento interno** (`utils/bus.js`): `estoque.service` e `dispositivo.service` emitem eventos; `sockets/` e `mqtt.service` só ouvem. Evita dependência circular.
- **Multi-organização**: `Usuario`, `Dispositivo`, `Evento` e `Config` guardam `organizacaoId`. O id vem do usuário autenticado (ou da máquina autenticada no MQTT), nunca do corpo do pedido. O WebSocket usa uma sala por organização.
- **Máquina = deviceId + token**: o servidor gera ambos ao vincular a máquina; só o hash SHA-256 do token fica no banco.
- **Servidor decide a sessão**: `GET /auth/me` e o middleware `autenticar` conferem o JWT *e* a existência do usuário no banco; o WebSocket faz o mesmo no handshake.
- **Alerta de estoque baixo** só dispara depois da primeira peça contada, e o limite vem da coleção `configs` (não está fixo no firmware).

## Coleções MongoDB
| Coleção | Campos principais |
|---|---|
| `organizacoes` | nome |
| `usuarios` | organizacaoId, nome, usuario (único), email (único), senhaHash, papel (`dono`/`operador`) |
| `dispositivos` | organizacaoId, deviceId (único), nome, tokenHash, ligado, online, ultimoContato |
| `eventos` | organizacaoId, deviceId, comprimentoMm, bitola, peso, valido, ocorridoEm |
| `configs` | organizacaoId (único), limiteBaixo, kDesvios, comprimentosMm, bitolas, tabelaPeso |
