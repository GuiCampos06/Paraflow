import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useEstoqueRealtime } from '../hooks/useEstoqueRealtime.js';
import { Colunas, Linha, Rosca } from '../components/Graficos.jsx';

const fmt = (n) => n.toLocaleString('pt-BR');
const fmt1 = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtHora = (iso) => new Date(iso).toLocaleTimeString('pt-BR');
const dm = (d) => `${d.slice(8)}/${d.slice(5, 7)}`;
const tipo = (i) => `${i.bitola} × ${i.comprimentoMm} mm`;
const ROTULO_STATUS = { ok: 'Ok', atencao: 'Atenção', critico: 'Crítico', esgotado: 'Esgotado', 'sem-consumo': 'Sem consumo' };
const TENDENCIA = { alta: 'em alta', queda: 'em queda', estavel: 'estável' };

export default function Dashboard() {
  const { estoque, estatisticas: est, previsao: prev, dispositivo, telemetria, ultimas, conectado, erro } = useEstoqueRealtime();
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [, tick] = useState(0);

  // atualiza o "há X s" da balança
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function comando(corpo, ok) {
    setAviso('');
    setEnviando(true);
    try {
      await api('/dispositivo/comando', { metodo: 'POST', corpo: { deviceId: dispositivo?.deviceId, ...corpo } });
      setAviso(ok);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (erro) return <p className="erro" role="alert">{erro}</p>;
  if (!estoque) return <p className="vazio">Carregando estoque...</p>;

  const bitolas = Object.keys(estoque.totaisPorBitola);
  const comprimentos = [...new Set(estoque.itens.map((i) => i.comprimentoMm))];
  const qtd = (c, b) => estoque.itens.find((i) => i.comprimentoMm === c && i.bitola === b)?.quantidade ?? 0;

  const segundos = telemetria ? Math.round((Date.now() - telemetria.recebidoEm) / 1000) : null;
  const aoVivo = telemetria && segundos <= 5;

  const dias14 = est?.ultimos14Dias ?? [];
  const mediaContadas = dias14.length ? dias14.reduce((s, d) => s + d.total, 0) / dias14.length : 0;
  const barrasPrevisao = prev
    ? [
        ...prev.historico.map((h) => ({ dia: h.dia, valores: [h.total] })),
        ...prev.previsao.map((p) => ({ dia: p.dia, valores: [p.previsto], previsto: true })),
      ]
    : [];

  return (
    <>
      <h1>Estoque em tempo real</h1>
      <p className="app-sub">Contagem de peças válidas por bitola e comprimento, já descontados os pedidos.</p>

      <div className="status-linha">
        <span className={`pilula${conectado ? ' on' : ''}`}><i />{conectado ? 'Tempo real ativo' : 'Sem tempo real'}</span>
        <span className={`pilula${dispositivo?.online ? ' on' : ''}`}>
          <i />{dispositivo?.nome ?? 'Dispositivo'}: {dispositivo?.online ? 'online' : 'offline'}
        </span>
        <span className={`pilula${dispositivo?.ligado ? ' on' : ''}`}><i />Separador {dispositivo?.ligado ? 'ligado' : 'desligado'}</span>
        <div className="acoes-topo">
          <Link to="/app/pedidos" className="btn btn-solido btn-sm">Pedido de parafusos</Link>
          <button className="btn btn-contorno btn-sm" disabled={enviando || !dispositivo}
                  onClick={() => comando({ tara: true }, 'Tara enviada: a balança será zerada.')}>Zerar balança</button>
          <button className={`btn btn-sm ${dispositivo?.ligado ? 'btn-perigo' : 'btn-contorno'}`} disabled={enviando || !dispositivo}
                  onClick={() => comando({ ligado: !dispositivo?.ligado }, 'Comando enviado. Aguardando confirmação do dispositivo.')}>
            {dispositivo?.ligado ? 'Desligar separador' : 'Ligar separador'}
          </button>
        </div>
      </div>

      {!dispositivo && (
        <div className="alerta-baixo" role="status">
          <strong>Nenhuma máquina vinculada.</strong> Adicione uma em <Link to="/app/configuracoes">Configurações &gt; Máquinas</Link> para começar a contar.
        </div>
      )}
      {aviso && <p className="app-sub" role="status">{aviso}</p>}

      {estoque.estoqueBaixo && (
        <div className="alerta-baixo" role="alert">
          <strong>Estoque baixo:</strong> {estoque.bitolasBaixas.join(', ')} abaixo de {fmt(estoque.limiteBaixo)} peças.
        </div>
      )}

      <div className="stats">
        <div className={`stat destaque${estoque.menorEstoque && estoque.menorEstoque.quantidade < estoque.limiteBaixo ? ' baixo' : ''}`}>
          <span className="stat-rotulo">Parafuso com menos estoque</span>
          {estoque.menorEstoque ? (
            <>
              <b className="stat-valor">{tipo(estoque.menorEstoque)}</b>
              <span className="stat-detalhe">{fmt(estoque.menorEstoque.quantidade)} peças restantes</span>
              {estoque.menores.length > 1 && (
                <span className="stat-detalhe">Depois: {estoque.menores.slice(1).map((m) => `${tipo(m)} (${fmt(m.quantidade)})`).join(', ')}</span>
              )}
            </>
          ) : (
            <span className="stat-detalhe">Aparece quando a primeira peça for contada.</span>
          )}
        </div>
        <div className="stat">
          <span className="stat-rotulo">Contadas hoje</span>
          <b className="stat-valor">{fmt(est?.hoje ?? 0)}</b>
          <span className="stat-detalhe">peças válidas</span>
        </div>
        <div className="stat">
          <span className="stat-rotulo">Média por dia</span>
          <b className="stat-valor">{fmt1(est?.mediaPorDia ?? 0)}</b>
          <span className="stat-detalhe">em {est?.diasAtivos ?? 0} dia(s) com contagem</span>
        </div>
        <div className="stat">
          <span className="stat-rotulo">Média dos últimos 7 dias</span>
          <b className="stat-valor">{fmt1(est?.mediaUltimos7Dias ?? 0)}</b>
          <span className="stat-detalhe">dias parados contam como 0</span>
        </div>
        <div className="stat">
          <span className="stat-rotulo">Peças rejeitadas</span>
          <b className="stat-valor">{fmt1(est?.taxaRejeicao ?? 0)}%</b>
          <span className="stat-detalhe">{fmt(est?.pecasRejeitadas ?? 0)} fora da faixa de peso</span>
        </div>
        <div className="stat">
          <span className="stat-rotulo">Consumo previsto</span>
          <b className="stat-valor">{fmt1(prev?.consumoDiario ?? 0)}</b>
          <span className="stat-detalhe">peças por dia, pelos pedidos feitos</span>
        </div>
        <div className="stat">
          <span className="stat-rotulo">Retirado em pedidos</span>
          <b className="stat-valor">{fmt(est?.totalRetirado ?? 0)}</b>
          <span className="stat-detalhe">{est?.pedidosAbertos ?? 0} pedido(s) aberto(s)</span>
        </div>
      </div>

      <div className="grade-dash">
        <section className="painel balanca">
          <h2>Balança agora</h2>
          {aoVivo ? (
            <>
              <b className="balanca-valor">{telemetria.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g</b>
              <span className={`pilula${telemetria.estavel ? ' on' : ''}`}><i />{telemetria.estavel ? 'leitura estável' : 'medindo'}</span>
              <span className="stat-detalhe">atualizado há {segundos}s{telemetria.rssi != null && `, Wi-Fi ${telemetria.rssi} dBm`}</span>
            </>
          ) : (
            <p className="vazio" style={{ padding: 8 }}>Sem leitura ao vivo. Ligue a máquina para ver o peso da célula de carga aqui.</p>
          )}
        </section>

        <section className="painel">
          <h2>Estoque por bitola</h2>
          <Rosca
            rotulo="Distribuição do estoque por bitola"
            centro="peças"
            fatias={bitolas.map((b) => ({ nome: b, valor: estoque.totaisPorBitola[b] }))}
          />
        </section>

        <section className="painel largo">
          <h2>Previsão de pedidos</h2>
          {!prev || prev.semDados ? (
            <p className="vazio">Ainda não há pedidos para prever. Depois dos primeiros pedidos, a previsão dos próximos 7 dias aparece aqui.</p>
          ) : (
            <>
              <div className="previsao-topo">
                <span className="resumo">
                  Consumo previsto: <b>{fmt1(prev.consumoDiario)}</b> peças por dia, <b>{fmt1(prev.previstoProximos7Dias)}</b> nos próximos 7 dias.
                  {' '}Pedidos <span className={`tendencia ${prev.tendencia}`}>{TENDENCIA[prev.tendencia]}</span>
                  {prev.variacaoPercentual != null && ` (${prev.variacaoPercentual > 0 ? '+' : ''}${fmt1(prev.variacaoPercentual)}% sobre a semana anterior)`}.
                </span>
                <span className={`selo-conf ${prev.confianca}`}>confiança {prev.confianca}</span>
              </div>
              <div className="legenda">
                <span><i style={{ background: 'var(--alerta)' }} />Pedidos feitos</span>
                <span style={{ color: 'var(--alerta)' }}><i className="tracejado" />Previsto</span>
              </div>
              <Colunas itens={barrasPrevisao} series={[{ nome: 'Pedidos', cor: 'var(--alerta)' }]} rotulo="Pedidos dos últimos 14 dias e previsão dos próximos 7" />

              <h3 style={{ marginTop: 22 }}>Quando cada tipo deve acabar</h3>
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr><th>Tipo</th><th>Estoque</th><th>Consumo/dia</th><th>Dura</th><th>Acaba em</th><th>Repor (14 dias)</th><th>Situação</th></tr>
                  </thead>
                  <tbody>
                    {prev.porTipo.map((t) => (
                      <tr key={`${t.bitola}-${t.comprimentoMm}`}>
                        <td>{tipo(t)}</td>
                        <td>{fmt(t.estoque)}</td>
                        <td>{fmt1(t.consumoDiario)}</td>
                        <td>{t.diasRestantes == null ? '-' : `${fmt1(t.diasRestantes)} dias`}</td>
                        <td>{t.esgotaEm ? dm(t.esgotaEm) : '-'}</td>
                        <td>{t.reposicaoSugerida14Dias ? fmt(t.reposicaoSugerida14Dias) : '-'}</td>
                        <td><span className={`etiqueta ${t.status}`}>{ROTULO_STATUS[t.status]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="nota">
                Método: {prev.metodo}. {prev.confianca === 'baixa' && 'Ainda há poucos pedidos; use como referência. '}
                A estimativa de duração não conta peças que ainda serão separadas.
              </p>
            </>
          )}
        </section>

        <section className="painel">
          <h2>Entradas e retiradas por dia</h2>
          <div className="legenda">
            <span><i style={{ background: 'var(--verde)' }} />Peças contadas</span>
            <span><i style={{ background: 'var(--alerta)' }} />Retiradas em pedidos</span>
          </div>
          <Colunas
            itens={dias14.map((d) => ({ dia: d.dia, valores: [d.total, d.retirados] }))}
            series={[{ nome: 'Contadas', cor: 'var(--verde)' }, { nome: 'Retiradas', cor: 'var(--alerta)' }]}
            rotulo="Peças contadas e retiradas por dia nos últimos 14 dias"
          />
        </section>

        <section className="painel">
          <h2>Peças contadas por dia</h2>
          <Linha
            pontos={dias14.map((d) => ({ dia: d.dia, valor: d.total }))}
            media={mediaContadas}
            rotulo="Peças contadas por dia nos últimos 14 dias"
          />
        </section>

        <section className="painel">
          <h2>Comprimento × bitola</h2>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Comprimento</th>{bitolas.map((b) => <th key={b}>{b}</th>)}</tr></thead>
              <tbody>
                {comprimentos.map((c) => (
                  <tr key={c}><td>{c} mm</td>{bitolas.map((b) => <td key={b}>{fmt(qtd(c, b))}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="painel">
          <h2>Últimas peças</h2>
          {ultimas.length === 0 ? (
            <p className="vazio">Nenhuma peça ainda.</p>
          ) : (
            <ul className="feed">
              {ultimas.map((u) => (
                <li key={u.id} className={u.valido ? '' : 'invalida'}>
                  <span>{fmtHora(u.ocorridoEm)}</span>
                  <b>{u.valido ? `${u.bitola} × ${u.comprimentoMm} mm` : `Rejeitada (${u.comprimentoMm} mm)`}</b>
                  <small>{u.peso.toFixed(2)} g</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
