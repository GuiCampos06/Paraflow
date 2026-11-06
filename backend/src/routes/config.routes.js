import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { exigirAdmin } from '../middlewares/auth.js';
import { validar } from '../middlewares/validate.js';
import { configUpdateSchema } from '../utils/schemas.js';
import { obterConfig, atualizarConfig } from '../services/config.service.js';
import { obterEstoque } from '../services/estoque.service.js';
import { bus } from '../utils/bus.js';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => res.json(await obterConfig())));

router.put('/', exigirAdmin, validar(configUpdateSchema), asyncHandler(async (req, res) => {
  const cfg = await atualizarConfig(req.dados);
  // o limite mudou: recalcula alertas e avisa todo mundo
  bus.emit('estoque:atualizado', { estoque: await obterEstoque() });
  res.json(cfg);
}));

export default router;
