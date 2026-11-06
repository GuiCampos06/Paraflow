import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Usuario } from '../models/Usuario.js';
import { AppError } from '../utils/AppError.js';

const SALT_ROUNDS = 12;
// hash fictício: evita diferença de tempo entre "usuário não existe" e "senha errada"
const HASH_FALSO = bcrypt.hashSync('senha-fantasma', SALT_ROUNDS);

const assinar = (u) =>
  jwt.sign({ papel: u.papel }, env.JWT_SECRET, { subject: u._id.toString(), expiresIn: env.JWT_EXPIRES_IN });

export async function registrar({ nome, usuario, email, senha }) {
  const [porUsuario, porEmail] = await Promise.all([
    Usuario.exists({ usuario }),
    Usuario.exists({ email }),
  ]);
  if (porUsuario || porEmail) {
    throw new AppError(409, 'Usuário ou e-mail já cadastrado.', {
      codigo: 'DUPLICADO',
      campos: {
        ...(porUsuario && { usuario: 'Este usuário já está em uso.' }),
        ...(porEmail && { email: 'Este e-mail já está cadastrado.' }),
      },
    });
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
  // o primeiro usuário do sistema vira administrador
  const papel = (await Usuario.estimatedDocumentCount()) === 0 ? 'admin' : 'operador';
  const novo = await Usuario.create({ nome, usuario, email, senhaHash, papel });
  return { token: assinar(novo), usuario: novo.paraJSON() };
}

export async function entrar({ identificador, senha }) {
  const filtro = identificador.includes('@') ? { email: identificador } : { usuario: identificador };
  const u = await Usuario.findOne(filtro).select('+senhaHash');
  const ok = await bcrypt.compare(senha, u?.senhaHash ?? HASH_FALSO);
  if (!u || !ok) throw new AppError(401, 'Usuário ou senha incorretos.', { codigo: 'CREDENCIAIS' });
  return { token: assinar(u), usuario: u.paraJSON() };
}

/** Valida o JWT e confirma no MongoDB que o usuário ainda existe. */
export async function usuarioDoToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'Sessão inválida ou expirada.', { codigo: 'TOKEN_INVALIDO' });
  }
  const u = await Usuario.findById(payload.sub);
  if (!u) throw new AppError(401, 'Usuário não existe mais.', { codigo: 'USUARIO_INEXISTENTE' });
  return { id: u._id.toString(), nome: u.nome, usuario: u.usuario, email: u.email, papel: u.papel };
}

export async function disponibilidade({ usuario, email }) {
  const [u, e] = await Promise.all([
    usuario ? Usuario.exists({ usuario }) : null,
    email ? Usuario.exists({ email }) : null,
  ]);
  return {
    ...(usuario !== undefined && { usuario: !u }),
    ...(email !== undefined && { email: !e }),
  };
}
