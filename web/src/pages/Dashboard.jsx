import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useEstoqueRealtime } from '../hooks/useEstoqueRealtime.js';

const fmt = (n) => n.toLocaleString('pt-BR');

export default function Dashboard() {
  const { estoque, dispositivo, conectado, erro } = useEstoqueRealtime();
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  async function alternar() {
    setAviso('');
    setEnviando(true);
    try {
      await api('/dispositivo/comando', {
        metodo: 'POST',
        corpo: { deviceId: dispositivo?.deviceId, ligado: !dispositivo?.ligado },
      });
      setAviso('Comando enviado. Aguardando confirmação do dispositivo...');
    } catch (e) {
      setAviso(e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (erro) return <p className="erro" role="alert">{erro}</p>;
  if (!estoque) return <p className="vazio">Carregando estoque...</p>;

  const maxBitola = Math.max(estoque.limiteBaixo * 4, ...Object.values(estoque.totaisPorBitola), 1);
  const bitolas = Object.keys(estoque.totaisPorBitola);
  const comprimentos = [...new Set(estoque.itens.map((i) => i.comprimentoMm))];
  const qtd = (c, b) => estoque.itens.find((i) => i.comprimentoMm === c && i.bitola === b)?.quantidade ?? 0;

  return (
    <>
      <h1>Estoque em tempo real</h1>
      <p className="app-sub">Contagem de peças válidas por bitola e comprimento.</p>

      <div className="status-linha">
        <span className={`pilula${conectado ? ' on' : ''}`}><i />{conectado ? 'Tempo real ativo' : 'Sem tempo real'}</span>
        <span className={`pilula${dispositivo?.online ? ' on' : ''}`}>
          <i />{dispositivo?.deviceId ?? 'Dispositivo'}: {dispositivo?.online ? 'online' : 'offline'}
        </span>
        <span className={`pilula${dispositivo?.ligado ? ' on' : ''}`}><i />Separador {dispositivo?.ligado ? 'ligado' : 'desligado'}</span>
        <button className={`btn btn-sm ${dispositivo?.ligado ? 'btn-perigo' : 'btn-solido'}`} onClick={alternar} disabled={enviando || !dispositivo}>
          {dispositivo?.ligado ? 'Desligar separador' : 'Ligar separador'}
        </button>
      </div>
      {!dispositivo && (
        <div className="alerta-baixo" role="status">
          <strong>Nenhuma máquina vinculada.</strong> Adicione uma em <Link to="/app/configuracoes">Configurações → Máquinas</Link> para começar a contar.
        </div>
      )}
      {aviso && <p className="app-sub" role="status">{aviso}</p>}

      {estoque.estoqueBaixo && (
        <div className="alerta-baixo" role="alert">
          <strong>Estoque baixo:</strong> {estoque.bitolasBaixas.join(', ')} abaixo de {fmt(estoque.limiteBaixo)} peças.
        </div>
      )}

      <div className="grade-dash">
        <section className="painel">
          <h2>Total por bitola</h2>
          <ul className="totais">
            {bitolas.map((b) => (
              <li key={b} className={estoque.bitolasBaixas.includes(b) ? 'baixo' : ''}>
                <span className="nome">{b}</span>
                <div className="barra"><i style={{ width: `${Math.min(100, (estoque.totaisPorBitola[b] / maxBitola) * 100)}%` }} /></div>
                <b className="qtd">{fmt(estoque.totaisPorBitola[b])}</b>
              </li>
            ))}
          </ul>
          <div className="total-geral"><span>Peças em estoque</span><b>{fmt(estoque.total)}</b></div>
        </section>

        <section className="painel">
          <h2>Comprimento × bitola</h2>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Comprimento</th>{bitolas.map((b) => <th key={b}>{b}</th>)}</tr>
              </thead>
              <tbody>
                {comprimentos.map((c) => (
                  <tr key={c}><td>{c} mm</td>{bitolas.map((b) => <td key={b}>{fmt(qtd(c, b))}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
