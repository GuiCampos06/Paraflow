/*
 * Paraflow — firmware do separador de parafusos (ESP32)
 *
 * Fluxo: sensor de comprimento (botão) → pesa → identifica a bitola → move o carrossel
 *        → publica 1 evento JSON por peça no MQTT. O ESTOQUE é calculado no backend.
 *
 * Tópicos (<prefixo>/<DEVICE_ID>/...):
 *   evento  (publica)   {"comp":10,"bitola":"M3","peso":1.07,"valido":true}
 *   status  (publica)   {"online":true,"ligado":true}  retain + LWT {"online":false}
 *   cmd     (assina)    {"ligado":false}
 *   alerta  (assina)    {"estoqueBaixo":true}
 *
 * Bibliotecas: PubSubClient, ArduinoJson, ESP32Servo  (veja libraries.txt)
 */
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include "secrets.h"

const char* DEVICE_ID = "esp32-01";

// ---------- Pinos ----------
const int NUM_COMPRIMENTOS = 4;  // 5, 10, 15, 20 mm
const int NUM_BITOLAS = 3;       // M2, M3, M4
const int PINOS_COMP[NUM_COMPRIMENTOS] = {13, 14, 27, 4};
const int COMPRIMENTOS_MM[NUM_COMPRIMENTOS] = {5, 10, 15, 20};
const int PIN_PESO = 34;
const int PIN_SERVO = 18;
const int LED_ALERTA = 25;
const int LED_STATUS_SEPARADOR = 26;
const int RELE_SEPARADOR = 32;   // ativo em LOW (inverta se seu módulo for ativo em HIGH)
const int BUZZER = 33;

// ---------- Tempos (ms) ----------
const unsigned long DEBOUNCE_MS = 200;      // ignora repique do sensor
const unsigned long ASSENTAR_MS = 300;      // espera a peça assentar na balança
const unsigned long LED_INVALIDO_MS = 1500;
const unsigned long BUZZER_MS = 150;
const unsigned long RETRY_MS = 5000;        // reconexão Wi-Fi/MQTT

// ---------- Pesagem ----------
// O ADC do ESP32 lê no máximo 3,3 V (antes o código assumia 5 V).
const float ADC_VREF = 3.3f;
// Simulação: 1 V = 1 g. Na versão física, troque lerPeso() pela leitura da célula de carga (HX711).
const float GRAMAS_POR_VOLT = 1.0f;

struct Faixa { float media; float desvio; };
const Faixa TABELA_PESO[NUM_COMPRIMENTOS][NUM_BITOLAS] = {
  /* 5mm  */ {{0.30, 0.08}, {0.55, 0.08}, {0.85, 0.10}},
  /* 10mm */ {{0.60, 0.10}, {1.05, 0.10}, {1.60, 0.12}},
  /* 15mm */ {{0.95, 0.12}, {1.60, 0.12}, {2.40, 0.15}},
  /* 20mm */ {{1.30, 0.15}, {2.20, 0.15}, {3.30, 0.18}},
};
const float K_DESVIOS = 2.0f;  // peso fora de K desvios da média = peça inválida

// ---------- Estado ----------
WiFiClient wifi;
PubSubClient mqtt(wifi);
Servo carrossel;

char topicoEvento[80], topicoStatus[80], topicoCmd[80], topicoAlerta[80];

bool separadorLigado = true;
bool estoqueBaixo = false;            // vem do backend (tópico alerta)
unsigned long ledInvalidoAte = 0;     // alerta de peça inválida (separado do estoque baixo)
unsigned long buzzerAte = 0;

enum EstadoPeca { LIVRE, AGUARDANDO_PESO };
EstadoPeca estado = LIVRE;
int comprimentoAtual = -1;
unsigned long detectadoEm = 0;
unsigned long ultimaBorda = 0;
bool anterior[NUM_COMPRIMENTOS] = {HIGH, HIGH, HIGH, HIGH};

unsigned long ultimaTentativaWifi = 0, ultimaTentativaMqtt = 0;

// ---------- MQTT ----------
void publicaStatus(bool online = true) {
  char buf[64];
  snprintf(buf, sizeof(buf), "{\"online\":%s,\"ligado\":%s}",
           online ? "true" : "false", separadorLigado ? "true" : "false");
  mqtt.publish(topicoStatus, buf, true);  // retain
}

void aplicaSeparador(bool ligado) {
  separadorLigado = ligado;
  digitalWrite(RELE_SEPARADOR, ligado ? LOW : HIGH);
  digitalWrite(LED_STATUS_SEPARADOR, ligado ? HIGH : LOW);
  if (!ligado) estado = LIVRE;  // descarta peça pendente
  if (mqtt.connected()) publicaStatus();
}

void aoReceber(char* topico, byte* payload, unsigned int tam) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, tam)) return;

  if (strcmp(topico, topicoCmd) == 0 && doc["ligado"].is<bool>()) {
    aplicaSeparador(doc["ligado"].as<bool>());
  } else if (strcmp(topico, topicoAlerta) == 0 && doc["estoqueBaixo"].is<bool>()) {
    estoqueBaixo = doc["estoqueBaixo"].as<bool>();
  }
}

void publicaEvento(int comp, int bitola, float peso, bool valido) {
  if (!mqtt.connected()) {
    Serial.println("MQTT offline: evento nao enviado");  // TODO: fila em memoria/SPIFFS
    return;
  }
  char buf[128];
  if (valido) {
    snprintf(buf, sizeof(buf), "{\"comp\":%d,\"bitola\":\"M%d\",\"peso\":%.2f,\"valido\":true}",
             comp, bitola + 2, peso);
  } else {
    snprintf(buf, sizeof(buf), "{\"comp\":%d,\"bitola\":null,\"peso\":%.2f,\"valido\":false}", comp, peso);
  }
  mqtt.publish(topicoEvento, buf);
}

void mantemConexoes() {
  unsigned long agora = millis();

  if (WiFi.status() != WL_CONNECTED) {
    if (agora - ultimaTentativaWifi > RETRY_MS) {
      ultimaTentativaWifi = agora;
      WiFi.reconnect();
    }
    return;
  }

  if (!mqtt.connected()) {
    if (agora - ultimaTentativaMqtt < RETRY_MS) return;
    ultimaTentativaMqtt = agora;

    String clientId = String("paraflow-") + DEVICE_ID;
    const char* user = strlen(MQTT_USER) ? MQTT_USER : nullptr;
    const char* pass = strlen(MQTT_USER) ? MQTT_PASS : nullptr;
    // Last Will: se o ESP32 cair, o broker publica online:false
    if (mqtt.connect(clientId.c_str(), user, pass, topicoStatus, 1, true, "{\"online\":false}")) {
      mqtt.subscribe(topicoCmd, 1);
      mqtt.subscribe(topicoAlerta, 1);
      publicaStatus();
      Serial.println("MQTT conectado");
    }
  }
  mqtt.loop();
}

// ---------- Sensores ----------
// Detecta a BORDA (solto → pressionado), então segurar o botão não conta a peça de novo.
int detectaComprimento() {
  int achado = -1;
  for (int i = 0; i < NUM_COMPRIMENTOS; i++) {
    bool atual = digitalRead(PINOS_COMP[i]);
    if (anterior[i] == HIGH && atual == LOW && achado < 0 && millis() - ultimaBorda > DEBOUNCE_MS) {
      achado = i;
      ultimaBorda = millis();
    }
    anterior[i] = atual;
  }
  return achado;
}

float lerPeso() {
  long soma = 0;
  for (int i = 0; i < 8; i++) soma += analogRead(PIN_PESO);  // média reduz ruído
  float volts = (soma / 8.0f) * ADC_VREF / 4095.0f;
  return volts * GRAMAS_POR_VOLT;
}

int identificaBitola(int idxComp, float peso) {
  float melhorDist = 1e9f;
  int escolhida = -1;
  for (int b = 0; b < NUM_BITOLAS; b++) {
    float dist = fabsf(peso - TABELA_PESO[idxComp][b].media);
    float limite = K_DESVIOS * TABELA_PESO[idxComp][b].desvio;
    if (dist <= limite && dist < melhorDist) {
      melhorDist = dist;
      escolhida = b;
    }
  }
  return escolhida;  // -1 = inválida
}

void moverCarrossel(int idxComp, int bitola) {
  carrossel.write((idxComp * NUM_BITOLAS + bitola) * 15);  // 12 posições de 15°
}

// ---------- Saídas (sem delay) ----------
void atualizaSaidas() {
  unsigned long agora = millis();
  digitalWrite(BUZZER, agora < buzzerAte);
  // LED acende por peça inválida OU por estoque baixo: causas independentes
  digitalWrite(LED_ALERTA, agora < ledInvalidoAte || estoqueBaixo);
}

// ---------- Máquina de estados: 1 peça por vez ----------
void processaPeca() {
  if (estado == LIVRE) {
    int c = detectaComprimento();
    if (c < 0) return;
    comprimentoAtual = c;
    detectadoEm = millis();
    estado = AGUARDANDO_PESO;
    return;
  }

  if (millis() - detectadoEm < ASSENTAR_MS) return;  // espera sem travar o loop

  float peso = lerPeso();
  int bitola = identificaBitola(comprimentoAtual, peso);
  int comp = COMPRIMENTOS_MM[comprimentoAtual];

  if (bitola >= 0) {
    moverCarrossel(comprimentoAtual, bitola);
    publicaEvento(comp, bitola, peso, true);
  } else {
    ledInvalidoAte = millis() + LED_INVALIDO_MS;
    buzzerAte = millis() + BUZZER_MS;
    carrossel.write(180);  // posição de descarte
    publicaEvento(comp, -1, peso, false);
  }
  estado = LIVRE;
}

// ---------- Arduino ----------
void setup() {
  Serial.begin(115200);

  for (int i = 0; i < NUM_COMPRIMENTOS; i++) pinMode(PINOS_COMP[i], INPUT_PULLUP);
  pinMode(LED_ALERTA, OUTPUT);
  pinMode(LED_STATUS_SEPARADOR, OUTPUT);
  pinMode(RELE_SEPARADOR, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  carrossel.attach(PIN_SERVO);
  aplicaSeparador(true);

  snprintf(topicoEvento, sizeof(topicoEvento), "%s/%s/evento", TOPIC_PREFIX, DEVICE_ID);
  snprintf(topicoStatus, sizeof(topicoStatus), "%s/%s/status", TOPIC_PREFIX, DEVICE_ID);
  snprintf(topicoCmd, sizeof(topicoCmd), "%s/%s/cmd", TOPIC_PREFIX, DEVICE_ID);
  snprintf(topicoAlerta, sizeof(topicoAlerta), "%s/%s/alerta", TOPIC_PREFIX, DEVICE_ID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS, 6);  // canal 6 acelera a conexão no Wokwi
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(aoReceber);
}

void loop() {
  mantemConexoes();
  atualizaSaidas();
  if (!separadorLigado) return;
  processaPeca();
}
