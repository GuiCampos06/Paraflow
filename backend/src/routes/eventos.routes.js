import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { validar } from '../middlewares/validate.js';
import { eventoSchema, eventosQuerySchema, resumoQuerySchema } from '../utils/schemas.js';
import * as estoque from '../services/estoque.service.js';

const router = Router();

router.get('/', validar(eventosQuerySchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await estoque.listarEventos(req.dados));
}));

router.get('/resumo', validar(resumoQuerySchema, 'query'), asyncHandler(async (req, res) => {
  res.json({ dias: await estoque.resumoDiario(req.dados) });
}));

// Simulação sem hardware (apenas com ALLOW_SIMULATION=true).
router.post('/', validar(eventoSchema), asyncHandler(async (req, res) => {
  if (!env.allowSimulation) {
    throw new AppError(403, 'Simulação desabilitada neste ambiente.', { codigo: 'SIMULACAO_OFF' });
  }
  const { evento, estoque: est } = await estoque.registrarEvento({
    deviceId: req.body.deviceId ?? 'simulador',
    ...req.dados,
  });
  res.status(201).json({ evento, estoque: est });
}));

export default router;
