import { z } from 'zod';

/* ---------- Regras de senha (as mesmas do cadastro no web/mobile) ---------- */
const senhaForte = z
  .string()
  .min(8, 'A senha precisa ter 8+ caracteres.')
  .max(72, 'A senha pode ter no máximo 72 caracteres.') // limite do bcrypt
  .regex(/[a-zA-ZÀ-ÿ]/, 'A senha precisa ter uma letra.')
  .regex(/\d/, 'A senha precisa ter um número.');

export const registroSchema = z.object({
  nome: z
    .string()
    .trim()
    .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, 'Informe nome e sobrenome.')
    .refine((v) => v.length <= 100, 'Nome muito longo.'),
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[\w.]{3,20}$/, 'Use 3 a 20 caracteres: letras, números, _ ou ponto.'),
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  senha: senhaForte,
  organizacao: z.string().trim().min(2, 'Informe o nome da empresa.').max(80, 'Nome da empresa muito longo.'),
});

export const dispositivoCriarSchema = z.object({
  nome: z.string().trim().min(2, 'Dê um nome para a máquina.').max(40, 'Nome muito longo.'),
});

export const loginSchema = z.object({
  identificador: z.string().trim().toLowerCase().min(1, 'Informe usuário ou e-mail.'),
  senha: z.string().min(1, 'Informe a senha.').max(72),
});

export const disponibilidadeSchema = z.object({
  usuario: z.string().trim().toLowerCase().optional(),
  email: z.string().trim().toLowerCase().optional(),
});

/* ---------- Evento de peça (payload MQTT e POST /eventos) ---------- */
export const eventoSchema = z
  .object({
    comp: z.coerce.number().int().positive(),
    bitola: z.string().regex(/^M\d{1,2}$/).nullable().optional(),
    peso: z.coerce.number().nonnegative(),
    valido: z.boolean(),
  })
  .refine((e) => !e.valido || !!e.bitola, {
    message: 'Peça válida precisa informar a bitola.',
    path: ['bitola'],
  });

export const statusSchema = z.object({
  online: z.boolean().optional(),
  ligado: z.boolean().optional(),
});

export const comandoSchema = z.object({
  deviceId: z.string().min(1).max(40).optional(),
  ligado: z.boolean(),
});

export const eventosQuerySchema = z.object({
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
  bitola: z.string().regex(/^M\d{1,2}$/).optional(),
  valido: z.enum(['true', 'false']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

export const resumoQuerySchema = z.object({
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});

export const configUpdateSchema = z
  .object({
    limiteBaixo: z.number().int().min(0).max(1_000_000).optional(),
    kDesvios: z.number().min(0.5).max(5).optional(),
    tabelaPeso: z
      .array(
        z.object({
          comprimentoMm: z.number().int().positive(),
          bitola: z.string().regex(/^M\d{1,2}$/),
          media: z.number().positive(),
          desvio: z.number().positive(),
        })
      )
      .optional(),
  })
  .refine((c) => Object.keys(c).length > 0, 'Envie ao menos um campo.');
