import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Usuario } from '../models/Usuario.js';
import { Organizacao } from '../models/Organizacao.js';
import { AppError } from '../utils/AppError.js';

const SALT_ROUNDS = 12;
// hash fictício: evita diferença de tempo entre "usuário não existe" e "senha errada"
const HASH_FALSO = bcrypt.hashSync('senha-fantasma', SALT_ROUNDS);

const assinar = (u) =>
  jwt.sign({}, env.JWT_SECRET, { subject: u._id.toString(), expiresIn: env.JWT_EXPIRES_IN });

/** Formato público do usuário (nunca inclui hash de senha). `org` = documento da organização. */
export const paraPublico = (u, org) => ({
  id: u._id.toString(),
  nome: u.nome,
  usuario: u.usuario,
  email: u.email,
  papel: u.papel,
  organizacaoId: org._id.toString(),
  organizacao: { id: org._id.toString(), nome: org.nome },
});

export async function registrar({ nome, usuario, email, senha, organizacao }) {
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

  // quem cria a organização é o dono dela
  const org = await Organizacao.create({ nome: organizacao });
  let novo;
  try {
    novo = await Usuario.create({ nome, usuario, email, senhaHash, organizacaoId: org._id, papel: 'dono' });
  } catch (e) {
    await Organizacao.deleteOne({ _id: org._id }); // não deixa organização órfã
    throw e;
  }
  return { token: assinar(novo), usuario: paraPublico(novo, org) };
}

export async function entrar({ identificador, senha }) {
  const filtro = identificador.includes('@') ? { email: identificador } : { usuario: identificador };
  const u = await Usuario.findOne(filtro).select('+senhaHash').populate('organizacaoId', 'nome');
  const ok = await bcrypt.compare(senha, u?.senhaHash ?? HASH_FALSO);
  if (!u || !ok || !u.organizacaoId) throw new AppError(401, 'Usuário ou senha incorretos.', { codigo: 'CREDENCIAIS' });
  return { token: assinar(u), usuario: paraPublico(u, u.organizacaoId) };
}

/** Valida o JWT e confirma no MongoDB que o usuário (e sua organização) ainda existem. */
export async function usuarioDoToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'Sessão inválida ou expirada.', { codigo: 'TOKEN_INVALIDO' });
  }
  const u = await Usuario.findById(payload.sub).populate('organizacaoId', 'nome');
  if (!u || !u.organizacaoId) throw new AppError(401, 'Usuário não existe mais.', { codigo: 'USUARIO_INEXISTENTE' });
  return paraPublico(u, u.organizacaoId);
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
