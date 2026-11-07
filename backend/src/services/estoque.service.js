import mongoose from 'mongoose';
import { Evento } from '../models/Evento.js';
import { bus } from '../utils/bus.js';
import { obterConfig } from './config.service.js';

// Em aggregate() o MongoDB NÃO converte string → ObjectId sozinho (find() converte).
const oid = (id) => new mongoose.Types.ObjectId(String(id));

/**
 * Estoque = contagem de eventos válidos da ORGANIZAÇÃO, por comprimento × bitola.
 * O MongoDB (via eventos) é a fonte da verdade: reiniciar o ESP32 não zera nada.
 */
export async function obterEstoque(organizacaoId) {
  const cfg = await obterConfig(organizacaoId);

  const agg = await Evento.aggregate([
    { $match: { organizacaoId: oid(organizacaoId), valido: true } },
    { $group: { _id: { c: '$comprimentoMm', b: '$bitola' }, quantidade: { $sum: 1 } } },
  ]);
  const mapa = new Map(agg.map((a) => [`${a._id.c}|${a._id.b}`, a.quantidade]));

  const totaisPorBitola = Object.fromEntries(cfg.bitolas.map((b) => [b, 0]));
  const itens = [];
  for (const comprimentoMm of cfg.comprimentosMm) {
    for (const bitola of cfg.bitolas) {
      const quantidade = mapa.get(`${comprimentoMm}|${bitola}`) ?? 0;
      itens.push({ comprimentoMm, bitola, quantidade });
      totaisPorBitola[bitola] += quantidade;
    }
  }

  const total = Object.values(totaisPorBitola).reduce((a, b) => a + b, 0);
  // Só alerta depois que o sistema começou a contar (evita alarme com tudo zerado).
  const bitolasBaixas =
    total === 0 ? [] : cfg.bitolas.filter((b) => totaisPorBitola[b] < cfg.limiteBaixo);

  return {
    itens,
    totaisPorBitola,
    total,
    limiteBaixo: cfg.limiteBaixo,
    bitolasBaixas,
    estoqueBaixo: bitolasBaixas.length > 0,
    atualizadoEm: new Date().toISOString(),
  };
}

/** Grava a peça (já com a organização da máquina) e notifica quem estiver ouvindo. */
export async function registrarEvento({ dispositivo, comp, bitola, peso, valido }) {
  const organizacaoId = dispositivo.organizacaoId;
  const evento = await Evento.create({
    organizacaoId,
    deviceId: dispositivo.deviceId,
    comprimentoMm: comp,
    bitola: valido ? bitola : null,
    peso,
    valido,
  });
  const estoque = await obterEstoque(organizacaoId);
  bus.emit('estoque:atualizado', {
    organizacaoId: String(organizacaoId),
    estoque,
    evento: evento.toObject(),
    deviceId: dispositivo.deviceId,
  });
  return { evento, estoque };
}

export async function listarEventos(organizacaoId, { de, ate, bitola, valido, pagina, limite }) {
  const filtro = { organizacaoId };
  if (de || ate) filtro.ocorridoEm = { ...(de && { $gte: de }), ...(ate && { $lte: ate }) };
  if (bitola) filtro.bitola = bitola;
  if (valido) filtro.valido = valido === 'true';

  const [itens, total] = await Promise.all([
    Evento.find(filtro).sort({ ocorridoEm: -1 }).skip((pagina - 1) * limite).limit(limite).lean(),
    Evento.countDocuments(filtro),
  ]);
  return { itens, total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)) };
}

/** Peças válidas por dia e bitola (histórico pedido no briefing). */
export async function resumoDiario(organizacaoId, { de, ate }) {
  const match = { organizacaoId: oid(organizacaoId), valido: true };
  if (de || ate) match.ocorridoEm = { ...(de && { $gte: de }), ...(ate && { $lte: ate }) };

  const linhas = await Evento.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          dia: { $dateToString: { format: '%Y-%m-%d', date: '$ocorridoEm', timezone: 'America/Sao_Paulo' } },
          bitola: '$bitola',
        },
        quantidade: { $sum: 1 },
      },
    },
    { $sort: { '_id.dia': -1, '_id.bitola': 1 } },
  ]);

  const porDia = new Map();
  for (const l of linhas) {
    const d = porDia.get(l._id.dia) ?? { dia: l._id.dia, total: 0, porBitola: {} };
    d.porBitola[l._id.bitola] = l.quantidade;
    d.total += l.quantidade;
    porDia.set(l._id.dia, d);
  }
  return [...porDia.values()];
}
