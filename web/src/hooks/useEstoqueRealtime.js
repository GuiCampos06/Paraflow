import { useEffect, useState } from 'react';
import { api, lerToken } from '../services/api.js';
import { conectarSocket } from '../services/socket.js';

/** Carrega estoque + dispositivo do servidor e se mantém atualizado via WebSocket. */
export function useEstoqueRealtime() {
  const [estoque, setEstoque] = useState(null);
  const [dispositivo, setDispositivo] = useState(null);
  const [conectado, setConectado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;

    Promise.all([api('/estoque'), api('/dispositivo')])
      .then(([e, d]) => {
        if (!ativo) return;
        setEstoque(e);
        setDispositivo(d.dispositivos[0] ?? null);
      })
      .catch((e) => ativo && setErro(e.message));

    const socket = conectarSocket(lerToken());
    socket.on('connect', () => setConectado(true));
    socket.on('disconnect', () => setConectado(false));
    socket.on('connect_error', () => setConectado(false));
    socket.on('estoque:atualizado', setEstoque);
    socket.on('dispositivo:status', (d) =>
      setDispositivo((atual) => (!atual || atual.deviceId === d.deviceId ? d : atual))
    );

    return () => {
      ativo = false;
      socket.disconnect();
    };
  }, []);

  return { estoque, dispositivo, conectado, erro };
}
