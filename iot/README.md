# IoT (ESP32)

Firmware do separador. Publica **um evento JSON por peça** no MQTT; o estoque é calculado no backend.

## Arquivos
- `sketch.ino`: firmware (MQTT, detecção de borda, máquina de estados sem `delay`)
- `secrets.example.h`: modelo de credenciais → copie para `secrets.h` (ignorado pelo git)
- `libraries.txt`: PubSubClient, ArduinoJson, ESP32Servo
- `diagram.json` e `wokwi-project.txt`: **mova os arquivos atuais sem alterações** (`git mv Codigo_Sistema_Iot/diagram.json iot/`)

## Vincular a máquina à sua organização
No site: **Configurações → Máquinas → Adicionar máquina**. Copie as linhas `DEVICE_ID` e `DEVICE_TOKEN` (o token aparece uma única vez) para o `secrets.h`. O backend só aceita mensagens de máquinas com `deviceId` + token válidos, e grava cada peça na organização dona da máquina.

## Simular no Wokwi
1. Crie `secrets.h` a partir do exemplo (no Wokwi, crie o arquivo na aba do projeto).
2. Use um broker que o backend também alcance. O mais simples é o público `broker.hivemq.com`
   com um **prefixo único**: ponha o mesmo valor em `TOPIC_PREFIX` (aqui) e `MQTT_TOPIC_PREFIX` (backend/.env),
   e `MQTT_URL=mqtt://broker.hivemq.com:1883`.
3. Botões = sensores de comprimento (5/10/15/20 mm). O potenciômetro simula o peso.

## Hardware real
Troque `lerPeso()` pela leitura da célula de carga com HX711 e recalibre `TABELA_PESO` com amostras reais.

## Segurança
O token do Blynk que estava no `sketch.ino` foi removido. **Revogue-o no Blynk** (ele ficou no histórico do git, se já foi commitado).
