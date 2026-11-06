import { Config } from '../models/Config.js';

export async function obterConfig() {
  // cria o documento com os valores padrão na primeira chamada
  return Config.findOneAndUpdate(
    { chave: 'principal' },
    { $setOnInsert: { chave: 'principal' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

export async function atualizarConfig(campos) {
  await obterConfig();
  return Config.findOneAndUpdate({ chave: 'principal' }, { $set: campos }, { new: true }).lean();
}
