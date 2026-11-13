# Atualizar a conexão do projeto Wokwi

O firmware do GitHub não atualiza automaticamente o projeto salvo no Wokwi. Aplique os ajustes abaixo no `sketch.ino` do simulador, preservando a calibração e o seu `secrets.h`.

1. Em `secrets.h`, confira `WIFI_SSID` igual a `"Wokwi-GUEST"` e `WIFI_PASS` igual a `""`. Não publique seu token em logs. Mantenha `TOPIC_PREFIX` igual a `"paraflow-guicampos06-demo-20261113"`.
2. Junto à constante `RETRY_MS`, adicione:

```cpp
const unsigned long WIFI_RETRY_MS = 30000;
```

3. Dentro de `mantemConexoes()`, substitua apenas o bloco `if (WiFi.status() != WL_CONNECTED)` por:

```cpp
  if (WiFi.status() != WL_CONNECTED) {
    if (agora - ultimaTentativaWifi >= WIFI_RETRY_MS) {
      ultimaTentativaWifi = agora;
      Serial.printf("Wi-Fi sem conexao apos 30 s (status=%d). Confira Wokwi-GUEST, senha vazia e o gateway do simulador. Reiniciando tentativa...\n", WiFi.status());
      WiFi.disconnect(false, false);
      WiFi.begin(WIFI_SSID, WIFI_PASS, strcmp(WIFI_SSID, "Wokwi-GUEST") == 0 ? 6 : 0);
    }
    return;
  }
```

4. No `setup()`, substitua a sequência `WiFi.mode(...)` e `WiFi.begin(...)` por:

```cpp
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  ultimaTentativaWifi = millis();
  WiFi.begin(WIFI_SSID, WIFI_PASS, strcmp(WIFI_SSID, "Wokwi-GUEST") == 0 ? 6 : 0);
```

5. Na primeira linha de `loop()`, adicione `delay(1);`. Salve, pare e reinicie a simulação. Aguarde `Wi-Fi ok` e `MQTT conectado!` antes de operar pelo site.

O ajuste evita reiniciar a tentativa inicial a cada cinco segundos e cede tempo às tarefas de rede. Ele não garante disponibilidade do gateway público do Wokwi. Se continuar sem conectar, anote o novo `status=N`, confira a configuração da rede e teste reiniciar a simulação. Com ponto de acesso personalizado no circuito, a rede padrão Wokwi-GUEST deixa de existir.

Fontes: [Wi-Fi no Wokwi](https://docs.wokwi.com/guides/esp32-wifi) e [Wi-Fi no Arduino ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/wifi.html).

O simulador de contagem do site é independente: gera peças fictícias mesmo sem Wokwi, quando habilitado. Ligar/desligar e zerar a balança dependem da máquina online. Não houve ensaio deste ajuste no simulador durante esta correção; o navegador do usuário não foi acessado.
