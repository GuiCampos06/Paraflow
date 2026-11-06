import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { obterEstoque } from '../services/estoque.service.js';

const router = Router();
router.get('/', asyncHandler(async (_req, res) => res.json(await obterEstoque())));
export default router;
