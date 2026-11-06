# Arquitetura

## Fluxo de dados
1. O ESP32 detecta o comprimento (sensor), pesa a peça, identifica a bitola pela tabela de peso e move o carrossel.
2. Publica `{"comp":10,"bitola":"M3","peso":1.07,"valido":true}` em `<prefixo>/<deviceId>/evento`.
3. O backend assina `<prefixo>/+/evento`, valida com zod, grava um documento em `eventos` e recalcula o estoque.
4. O backend emite `estoque:atualizado` por Socket.IO (web e mobile) e publica `alerta` de volta ao ESP32 (LED).
5. Comandos do operador: `POST /api/dispositivo/comando` → backend publica em `<prefixo>/<deviceId>/cmd` → ESP32 aplica e responde com `status`.

## Decisões
- **Estoque derivado dos eventos** (agregação no MongoDB): sem contador duplicado, reiniciar o ESP32 não perde nada, e o histórico por dia vem de graça.
- **Barramento interno** (`utils/bus.js`): `estoque.service` e `dispositivo.service` emitem eventos; `sockets/` e `mqtt.service` só ouvem. Evita dependência circular.
- **Servidor decide a sessão**: `GET /auth/me` e o middleware `autenticar` conferem o JWT *e* a existência do usuário no banco; o WebSocket faz o mesmo no handshake.
- **Alerta de estoque baixo** só dispara depois da primeira peça contada, e o limite vem da coleção `configs` (não está fixo no firmware).

## Coleções MongoDB
| Coleção | Campos principais |
|---|---|
| `usuarios` | nome, usuario (único), email (único), senhaHash, papel (`admin`/`operador`) |
| `eventos` | deviceId, comprimentoMm, bitola, peso, valido, ocorridoEm |
| `dispositivos` | deviceId (único), ligado, online, ultimoContato |
| `configs` | limiteBaixo, kDesvios, comprimentosMm, bitolas, tabelaPeso |
