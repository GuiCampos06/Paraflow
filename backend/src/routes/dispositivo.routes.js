import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validar } from '../middlewares/validate.js';
import { comandoSchema } from '../utils/schemas.js';
import { listarDispositivos, enviarComando } from '../services/dispositivo.service.js';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => res.json({ dispositivos: await listarDispositivos() })));

router.post('/comando', validar(comandoSchema), asyncHandler(async (req, res) => {
  res.status(202).json(await enviarComando(req.dados.deviceId, req.dados.ligado));
}));

export default router;
