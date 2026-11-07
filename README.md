# Paraflow

**Separação, contagem e controle de estoque de parafusos com IoT.**
Projeto Integrador: um ESP32 separa os parafusos por comprimento e bitola, publica cada peça via MQTT, e o estoque aparece em tempo real no web e no app.

## Integrantes
- Guilherme Barbosa B. Campos
- Cauã Henrique Nascimento
- Gabriel Henrique Ferreira
- Rodrigo Avelar Santos

## Arquitetura

```
ESP32 (sensores + servo + relé)
   │  MQTT: 1 evento JSON por peça         ▲ comandos (liga/desliga) e alertas
   ▼                                        │
Broker MQTT (Mosquitto) ────────────────────┤
   │ subscribe                              │ publish
   ▼                                        │
Backend Node (Express + Mongoose) ── MongoDB
   │  REST (/api) + WebSocket (Socket.IO)
   ├──────────────► Web (React + Vite)
   └──────────────► Mobile (Expo)
```

O backend é a **fonte da verdade**: o estoque é a contagem dos eventos no MongoDB, então reiniciar o ESP32 não zera nada.
Detalhes em [`docs/arquitetura.md`](docs/arquitetura.md) e [`docs/api.md`](docs/api.md).

## Estrutura

| Pasta | O que é |
|---|---|
| `backend/` | API Node (Express), MongoDB (Mongoose), MQTT e Socket.IO |
| `web/` | Site em React + Vite (landing, login, cadastro, dashboard, histórico) |
| `mobile/` | App Expo (login, cadastro, dashboard) |
| `iot/` | Firmware do ESP32 e projeto Wokwi |
| `docs/` | Briefing, arquitetura e referência da API |
| `infra/` | Configuração do Mosquitto (usada pelo `docker-compose.yml`) |

## Como rodar

**Requisitos:** Node 20+, Docker (para MongoDB e Mosquitto locais) e, para o app, Expo Go no celular.

```bash
# 1. Dependências (backend + web)
npm install

# 2. MongoDB + broker MQTT locais
npm run infra:up

# 3. Backend
cp backend/.env.example backend/.env     # troque o JWT_SECRET
npm run dev:backend                       # http://localhost:3333/api/health

# 4. Web (outro terminal)
npm run dev:web                           # http://localhost:5173

# 5. Mobile (outro terminal)
cd mobile && cp .env.example .env         # coloque o IP da sua máquina
npm install && npx expo install --fix     # alinha as versões nativas ao SDK do Expo
npm run start
```

> Cada cadastro cria uma **organização** (a empresa) e o usuário vira o **dono** dela. Cada organização só vê os próprios dados.
>
> **Já tinha rodado a versão anterior?** Os dados antigos não têm organização. Apague o banco antes: `npm run resetar-banco -w backend -- --sim` (ou apague as coleções no Compass/Atlas).

### Vincular uma máquina e testar sem hardware
1. No site, entre em **Configurações → Máquinas → Adicionar máquina**. Copie o `DEVICE_ID` e o `TOKEN` (aparecem uma vez).
2. Simule o ESP32 publicando peças no MQTT:
```bash
npm run simular -- <deviceId> <token>            # 1 peça por segundo
npm run simular -- <deviceId> <token> 30 200     # 30 peças, a cada 200 ms
```
Abra o dashboard e veja o estoque subir em tempo real. Alternativa sem broker: `POST /api/eventos` (precisa de `ALLOW_SIMULATION=true` e de uma máquina cadastrada).

### Com o Wokwi / ESP32
Veja [`iot/README.md`](iot/README.md).

### Imagens que precisam ser copiadas
- `web/public/cat.png` (mascote) e `web/public/parafusos.webp` (fundo do login/cadastro)
- `mobile/assets/` (ícone, splash, mascote)

## Rotas

As rotas **reais** ficam no backend, em `backend/src/routes/` (montadas em `/api` por `src/app.js`, e o `src/server.js` sobe tudo). O front nunca decide sozinho se alguém está logado: toda rota protegida do web (`/app/*`) e a pilha privada do mobile só abrem depois que o servidor confirma a sessão em `GET /api/auth/me`, e cada chamada protegida valida o JWT e confirma o usuário no MongoDB.

| Web | Acesso |
|---|---|
| `/` | Pública (landing) |
| `/login`, `/cadastro` | Só sem sessão (com sessão vai ao dashboard) |
| `/app/dashboard`, `/app/historico` | Só com sessão confirmada pelo servidor |

## Fluxo de trabalho no GitHub
- Branches: `main` (estável), `develop`, `feat/backend-...`, `feat/web-...`, `feat/mobile-...`, `feat/iot-...`
- Commits: `feat(backend): ...`, `fix(iot): ...`
- Pull Request para `develop`, com ao menos 1 revisão. O CI (`.github/workflows/ci.yml`) checa o backend e faz o build do web.
- Issues e Project board seguindo as fases do briefing.

## Segurança
- Nunca commite `.env`, `iot/secrets.h` ou tokens. Há um `.env.example` em cada parte.
- Senhas com bcrypt, JWT com expiração, `helmet`, CORS restrito e rate limit no login.
- Broker MQTT público (HiveMQ) é só para demonstração: use prefixo único; em produção use broker com usuário/senha e TLS.

## Backlog
- Editar a tabela de peso na tela de configurações (o limite de estoque baixo já é editável)
- Registro de saída/baixa de estoque (hoje o sistema só conta entradas)
- Recuperação de senha
- Fila offline no firmware quando o MQTT cair
- Célula de carga + HX711 na versão física
- Testes automatizados do backend
