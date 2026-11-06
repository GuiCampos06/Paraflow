import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { bus } from '../utils/bus.js';
import { usuarioDoToken } from '../services/auth.service.js';

let io = null;

/**
 * WebSocket autenticado: o cliente envia o JWT em `auth.token` e o servidor
 * confirma no banco antes de aceitar a conexão.
 * Eventos emitidos: 'estoque:atualizado', 'alerta:estoque-baixo', 'dispositivo:status'.
 */
export function iniciarSockets(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.corsOrigins } });

  io.use(async (socket, next) => {
    try {
      socket.data.usuario = await usuarioDoToken(socket.handshake.auth?.token ?? '');
      next();
    } catch {
      next(new Error('NAO_AUTENTICADO'));
    }
  });

  bus.on('estoque:atualizado', ({ estoque, evento }) => {
    io.emit('estoque:atualizado', estoque);
    if (estoque.estoqueBaixo) {
      io.emit('alerta:estoque-baixo', { bitolas: estoque.bitolasBaixas, limite: estoque.limiteBaixo });
    }
    if (evento) {
      io.emit('evento:novo', {
        id: evento._id.toString(),
        comprimentoMm: evento.comprimentoMm,
        bitola: evento.bitola,
        peso: evento.peso,
        valido: evento.valido,
        ocorridoEm: evento.ocorridoEm,
      });
    }
  });

  bus.on('dispositivo:status', (disp) => io.emit('dispositivo:status', disp));

  return io;
}

export const fecharSockets = () => new Promise((resolve) => (io ? io.close(resolve) : resolve()));
