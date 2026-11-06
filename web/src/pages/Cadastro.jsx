import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import CampoSenha from '../components/CampoSenha.jsx';
import ForcaSenha from '../components/ForcaSenha.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../services/api.js';
import { validadores } from '../utils/validacao.js';

const VAZIO = { nome: '', usuario: '', email: '', senha: '', confirmar: '' };

export default function Cadastro() {
  const { registrar } = useAuth();
  const navegar = useNavigate();

  const [v, setV] = useState(VAZIO);
  const [tocados, setTocados] = useState({});
  const [msgs, setMsgs] = useState({}); // erros por campo (local ou do servidor)
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const classe = (k) => (msgs[k] ? 'invalido' : tocados[k] && v[k] ? 'valido' : '');

  function validarLocal(k, valores = v) {
    const msg = validadores[k](valores[k], valores);
    setMsgs((m) => ({ ...m, [k]: msg }));
    return !msg;
  }

  // Pergunta ao SERVIDOR se usuário/e-mail estão livres
  async function checarDisponibilidade(k) {
    try {
      const r = await api('/auth/disponibilidade', { query: { [k]: v[k].trim() } });
      if (r[k] === false) {
        setMsgs((m) => ({ ...m, [k]: k === 'usuario' ? 'Este usuário já está em uso.' : 'Este e-mail já está cadastrado.' }));
      }
    } catch { /* sem rede: o cadastro final ainda valida no servidor */ }
  }

  function aoMudar(k, valor) {
    const novo = { ...v, [k]: valor };
    setV(novo);
    if (tocados[k]) validarLocal(k, novo);
    if (k === 'senha' && tocados.confirmar) validarLocal('confirmar', novo);
  }

  async function aoSair(k) {
    if (!v[k] && !tocados[k]) return;
    setTocados((t) => ({ ...t, [k]: true }));
    if (validarLocal(k) && (k === 'usuario' || k === 'email')) checarDisponibilidade(k);
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');

    const chaves = Object.keys(VAZIO);
    setTocados(Object.fromEntries(chaves.map((k) => [k, true])));
    const invalidos = chaves.filter((k) => !validarLocal(k));
    if (invalidos.length) return document.getElementById(invalidos[0])?.focus();

    setEnviando(true);
    try {
      await registrar({ nome: v.nome.trim(), usuario: v.usuario.trim(), email: v.email.trim(), senha: v.senha });
      navegar('/login', { replace: true, state: { entrada: 'esquerda', cadastrado: true } });
    } catch (err) {
      if (err.campos && Object.keys(err.campos).length) setMsgs((m) => ({ ...m, ...err.campos }));
      setErro(err.message);
      setEnviando(false);
    }
  }

  const campoTexto = (k, rotulo, extra = {}) => (
    <div className="campo">
      <label htmlFor={k}>{rotulo}</label>
      <input id={k} type="text" value={v[k]} className={classe(k)} required
             aria-describedby={`msg-${k}`} aria-invalid={!!msgs[k]}
             onChange={(e) => aoMudar(k, e.target.value)} onBlur={() => aoSair(k)} {...extra} />
      <small className="msg" id={`msg-${k}`} aria-live="polite">{msgs[k]}</small>
    </div>
  );

  return (
    <AuthLayout invertido>
      <form className="form form-cadastro" onSubmit={enviar} noValidate>
        <h2>Crie sua conta</h2>

        <div className="linha">
          {campoTexto('nome', 'Nome completo', { autoComplete: 'name' })}
          {campoTexto('usuario', 'Usuário', { autoComplete: 'username', autoCapitalize: 'none', spellCheck: false, maxLength: 20 })}
        </div>

        {campoTexto('email', 'E-mail', { type: 'email', autoComplete: 'email', autoCapitalize: 'none', spellCheck: false })}

        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <CampoSenha id="senha" valor={v.senha} aoMudar={(x) => aoMudar('senha', x)} aoSair={() => aoSair('senha')}
                      autoComplete="new-password" classe={classe('senha')} descrito="msg-senha" />
          <ForcaSenha senha={v.senha} />
          <small className="msg" id="msg-senha" aria-live="polite">{msgs.senha}</small>
        </div>

        <div className="campo">
          <label htmlFor="confirmar">Confirmar senha</label>
          <CampoSenha id="confirmar" valor={v.confirmar} aoMudar={(x) => aoMudar('confirmar', x)} aoSair={() => aoSair('confirmar')}
                      autoComplete="new-password" classe={classe('confirmar')} descrito="msg-confirmar" />
          <small className="msg" id="msg-confirmar" aria-live="polite">{msgs.confirmar}</small>
        </div>

        {erro && <p className="erro" role="alert">{erro}</p>}

        <button type="submit" className="btn btn-solido" disabled={enviando}>
          {enviando ? 'Criando...' : 'Criar conta'}
        </button>

        <p className="troca">Já tem conta? <Link to="/login" state={{ entrada: 'esquerda' }}>Entrar</Link></p>
      </form>
    </AuthLayout>
  );
}
