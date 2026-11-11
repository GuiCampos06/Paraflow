# IoT (ESP32 e célula de carga)

Firmware do separador. Para cada peça publica um evento no MQTT e, uma vez por segundo, o peso da balança.

## Arquivos

- `sketch.ino`: o firmware
- `diagram.json`: circuito do Wokwi (ESP32, HX711 de 5 kg, botões de comprimento, botão de tara, servo, relé, LEDs e buzzer)
- `libraries.txt`: PubSubClient, ArduinoJson, ESP32Servo e HX711
- `secrets.example.h`: modelo das credenciais; copie para `secrets.h`, que não vai para o git

## Ligando a máquina ao sistema

No site, em Configurações, adicione uma máquina e copie o `DEVICE_ID` e o `DEVICE_TOKEN` (o token aparece uma vez) para o `secrets.h`. O `TOPIC_PREFIX` precisa ser igual ao `MQTT_TOPIC_PREFIX` do backend.

## Wokwi

1. Troque o `diagram.json`, o `sketch.ino` e o `libraries.txt` do projeto pelos desta pasta e crie o `secrets.h` (o Wokwi não lê o arquivo do seu computador).
2. Use um broker que o backend também alcance, por exemplo `broker.hivemq.com` com um prefixo só seu.
3. Os botões de 5, 10, 15 e 20 mm fazem o papel dos sensores de comprimento. O peso se ajusta no controle da célula de carga. Com `ESCALA_PESO = 100`, 105 g na célula valem 1,05 g reais (um M3 de 10 mm). O botão branco zera a balança.

Se o Wokwi não aceitar algum nome de pino do HX711, religue os fios: VCC no 3V3, GND no GND, DT no pino 16 e SCK no 17.

## Como a peça é medida

Ao apertar o botão de comprimento, o firmware espera a peça assentar e a leitura ficar estável (6 amostras com variação de até 0,04 g). Se não estabilizar em 2,5 s, a peça é rejeitada. Depois compara o peso com a tabela de cada comprimento para achar a bitola.

Quando alguém faz um pedido no site, o carrossel gira até a gaveta daquele tipo e o buzzer apita duas vezes.

## Calibração

O fator padrão (419,43 contagens por grama) é o valor teórico de uma célula de 5 kg. Para calibrar a sua, abra o Serial Monitor (115200):

1. Deixe o prato vazio e envie `t` (tara).
2. Coloque um peso conhecido, por exemplo 1000 g, e envie `c1000`. O fator fica salvo na memória.

Outros comandos: `p` mostra os valores e `z` volta ao fator padrão.

## Atenção

Uma célula de 5 kg tem resolução de cerca de 1 g, e os parafusos do projeto pesam de 0,3 a 3,3 g. No simulador funciona porque ele é ideal. Na montagem real, use uma célula de 50 a 500 g ou pese vários parafusos de uma vez.
