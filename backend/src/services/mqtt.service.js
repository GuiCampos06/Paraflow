import mqtt from 'mqtt';
import { env } from '../config/env.js';
import { bus } from '../utils/bus.js';
import { eventoSchema, statusSchema } from '../utils/schemas.js';
import { registrarEvento } from './estoque.service.js';
import { Dispositivo } from '../models/Dispositivo.js';

/**
 * Tópicos (prefixo configurável em MQTT_TOPIC_PREFIX):
 *   <p>/<id>/evento  ESP32 → backend   {"comp":10,"bitola":"M3","peso":1.07,"valido":true}
 *   <p>/<id>/status  ESP32 → backend   {"online":true,"ligado":true}   (retain + LWT)
 *   <p>/<id>/cmd     backend → ESP32   {"ligado":false}                (retain)
 *   <p>/<id>/alerta  backend → ESP32   {"estoqueBaixo":true}           (retain)
 */
let client = null;
const P = env.MQTT_TOPIC_PREFIX;

export const mqttConectado = () => !!client?.connected;

export function iniciarMqtt() {
  if (!env.MQTT_URL) {
    console.warn('⚠️  MQTT_URL vazio: backend rodando sem broker (use POST /api/eventos para simular).');
    return;
  }

  client = mqtt.connect(env.MQTT_URL, {
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
    reconnectPeriod: 5000,
    clientId: `paraflow-backend-${Math.random().toString(16).slice(2, 8)}`,
  });

  client.on('connect', () => {
    console.log(`📡 MQTT conectado em ${env.MQTT_URL} (prefixo "${P}")`);
    client.subscribe([`${P}/+/evento`, `${P}/+/status`], { qos: 1 });
  });
  client.on('reconnect', () => console.log('📡 MQTT reconectando...'));
  client.on('error', (e) => console.error('📡 MQTT erro:', e.message));
  client.on('message', aoReceber);

  // quando o estoque muda, avisa os dispositivos se algum tipo está baixo
  bus.on('estoque:atualizado', async ({ estoque }) => {
    try {
      const ids = new Set((await Dispositivo.find().distinct('deviceId')).concat(env.DEFAULT_DEVICE_ID));
      for (const id of ids) {
        publicar(`${P}/${id}/alerta`, { estoqueBaixo: estoque.estoqueBaixo });
      }
    } catch (e) {
      console.error('📡 Falha ao publicar alerta:', e.message);
    }
  });
}

async function aoReceber(topico, buffer) {
  const [prefixo, deviceId, tipo] = topico.split('/');
  if (prefixo !== P || !deviceId) return;

  let json;
  try {
    json = JSON.parse(buffer.toString());
  } catch {
    return console.warn(`📡 Payload não-JSON em ${topico}`);
  }

  try {
    if (tipo === 'evento') {
      const r = eventoSchema.safeParse(json);
      if (!r.success) return console.warn(`📡 Evento inválido de ${deviceId}:`, r.error.issues[0]?.message);
      await registrarEvento({ deviceId, ...r.data });
    } else if (tipo === 'status') {
      const r = statusSchema.safeParse(json);
      if (!r.success) return;
      // import dinâmico evita dependência circular (dispositivo.service importa este arquivo)
      const { atualizarStatus } = await import('./dispositivo.service.js');
      await atualizarStatus(deviceId, r.data);
    }
  } catch (e) {
    console.error(`📡 Erro ao processar ${topico}:`, e.message);
  }
}

function publicar(topico, objeto, opcoes = { qos: 1, retain: true }) {
  return new Promise((resolve) => {
    if (!mqttConectado()) return resolve(false);
    client.publish(topico, JSON.stringify(objeto), opcoes, (err) => resolve(!err));
  });
}

export const publicarComando = (deviceId, ligado) => publicar(`${P}/${deviceId}/cmd`, { ligado });

export function encerrarMqtt() {
  return new Promise((resolve) => (client ? client.end(false, {}, resolve) : resolve()));
}
