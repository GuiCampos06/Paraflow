# Arquitetura

## Caminho de uma peça

1. O ESP32 detecta o comprimento pelo sensor, espera a balança estabilizar e define a bitola pelo peso.
2. Publica o evento em `<prefixo>/<deviceId>/evento` com o token da máquina.
3. O backend confere deviceId e token, descobre a empresa dona da máquina, valida os dados e grava o evento com o `organizacaoId`.
4. O estoque da empresa é recalculado e enviado por WebSocket só para os usuários dela.
5. Se alguma combinação de bitola e comprimento estiver abaixo do limite, o backend avisa as máquinas da empresa (LED e buzzer de alerta).

Comandos do usuário seguem o caminho contrário: o backend publica em `cmd` (ligar, desligar, tara) ou `pedido`, e o ESP32 responde com o novo status.

## Decisões

- O estoque é a soma das peças válidas menos os pedidos não cancelados. Não existe contador salvo.
- O limite de estoque baixo é aplicado separadamente a cada bitola + comprimento. A simulação de contagem pode ser ligada/desligada pelo dono em Configurações quando `ALLOW_SIMULATION=true`; o loop roda no processo do backend, continua ao sair da página e para no reinício.
- Todo dado tem `organizacaoId`. O id vem sempre do usuário logado (ou da máquina que enviou a mensagem), nunca do corpo da requisição.
- A máquina se identifica por `deviceId` e token. Só o hash do token fica no banco.
- O papel do usuário (dono ou operador) é lido do banco a cada requisição, então mudar o papel ou remover alguém vale na hora.
- Convites são de uso único, têm validade e ficam no banco só como hash.
- Dois pedidos ao mesmo tempo passam por uma fila por empresa, para o estoque não ficar negativo (vale para uma instância do backend).
- O peso ao vivo da balança passa só pela memória do servidor (MQTT para WebSocket) e não é gravado.
- A previsão usa média móvel exponencial dos pedidos dos últimos 28 dias, só com dias fechados, e ajusta por dia da semana quando há 3 semanas de dados.

## Coleções do MongoDB

- `organizacoes`: nome
- `usuarios`: organizacaoId, nome, usuario, email, senhaHash, papel
- `dispositivos`: organizacaoId, deviceId, nome, tokenHash, ligado, online
- `eventos`: organizacaoId, deviceId, comprimentoMm, bitola, peso, valido, ocorridoEm
- `pedidos`: organizacaoId, solicitante, bitola, comprimentoMm, quantidade, status
- `convites`: organizacaoId, codigoHash, papel, expiraEm, usadoEm
- `configs`: organizacaoId, limiteBaixo, comprimentosMm, bitolas, tabelaPeso
