import { Dispositivo } from '../models/Dispositivo.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { bus } from '../utils/bus.js';
import { publicarComando } from './mqtt.service.js';

export async function listarDispositivos() {
  const lista = await Dispositivo.find().sort({ deviceId: 1 }).lean();
  if (lista.length === 0) {
    // ainda não recebemos nada do ESP32: devolve o dispositivo padrão como "offline"
    return [{ deviceId: env.DEFAULT_DEVICE_ID, nome: 'Separador de parafusos', ligado: true, online: false }];
  }
  return lista;
}

/** Chamado pelo MQTT quando o ESP32 publica seu status (ou o LWT dispara). */
export async function atualizarStatus(deviceId, { online, ligado }) {
  const set = { ultimoContato: new Date() };
  if (online !== undefined) set.online = online;
  if (ligado !== undefined) set.ligado = ligado;

  const disp = await Dispositivo.findOneAndUpdate(
    { deviceId },
    { $set: set, $setOnInsert: { deviceId } },
    { upsert: true, new: true }
  ).lean();
  bus.emit('dispositivo:status', disp);
  return disp;
}

/**
 * Envia o comando ao ESP32 via MQTT. Responde "enviado": quem confirma é o
 * próprio dispositivo, publicando o novo status (que chega por WebSocket).
 */
export async function enviarComando(deviceId, ligado) {
  const id = deviceId ?? env.DEFAULT_DEVICE_ID;
  const ok = await publicarComando(id, ligado);
  if (!ok) {
    throw new AppError(503, 'Broker MQTT indisponível. Comando não enviado.', { codigo: 'MQTT_OFFLINE' });
  }
  return { deviceId: id, ligado, enviado: true };
}
