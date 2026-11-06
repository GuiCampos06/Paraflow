import { AppError } from '../utils/AppError.js';
import { usuarioDoToken } from '../services/auth.service.js';

/**
 * Exige "Authorization: Bearer <jwt>" e CONFIRMA no banco que o usuário
 * ainda existe. Ou seja: o servidor é quem decide se a sessão vale.
 */
export async function autenticar(req, _res, next) {
  try {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new AppError(401, 'Não autenticado.', { codigo: 'SEM_TOKEN' });
    req.usuario = await usuarioDoToken(token);
    next();
  } catch (e) {
    next(e);
  }
}

export const exigirAdmin = (req, _res, next) =>
  req.usuario?.papel === 'admin'
    ? next()
    : next(new AppError(403, 'Apenas administradores podem fazer isso.', { codigo: 'PROIBIDO' }));
