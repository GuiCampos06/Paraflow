# Publicar o Paraflow no Render

O projeto está preparado para servir site React, API REST e Socket.IO no mesmo endereço HTTPS. O MongoDB fica em um serviço externo, como Atlas. O broker MQTT também precisa de um endereço alcançável pelo servidor e pelo ESP32.

## Publicação verificada em 13/11/2026

- Site e login: https://paraflow.onrender.com/login.
- Serviço Node Free, branch `main`, commit `13ba4c6`, gerenciado pelo Blueprint `ParaFlow`.
- Deploy `dep-dbr7rot6e07s73aqrglg` confirmado como Live no Render.
- `/api/health` respondeu `status: ok`, `banco: true`, `mqtt: false`.
- Acesso direto a `/app/dashboard` respondeu HTTP 200 com a aplicação React; o login abriu no navegador.
- A conexão MongoDB existente foi cadastrada como segredo com autorização do responsável. Nenhuma credencial foi incluída no repositório.
- A conexão MQTT do Wokwi ainda depende da configuração do broker. O plano Free pode suspender o backend por inatividade.

## O que já está pronto

- `npm run build`: gera o site em web/dist.
- `npm start`: inicia a API e, em produção, serve o site e suas rotas diretas.
- `render.yaml`: descreve um Web Service Node, uma instância, segredo JWT gerado, health check e build.
- Origem Render detectada automaticamente para CORS/Socket.IO; não é preciso compilar o site com uma URL de API diferente.
- Simulação HTTP desativada no perfil publicado; o banco e usuários fictícios da revisão local não são enviados.

Uma hospedagem apenas estática não executaria o backend Express/MongoDB/MQTT. Por isso o caminho preparado usa um Web Service, sem reescrever a aplicação para outro ambiente.

## Publicação pela interface

1. Envie os arquivos revisados para o repositório GitHub `GuiCampos06/Paraflow`. Confira que `.env`, `iot/secrets.h`, node_modules, dist e dados locais estão fora do commit. Se preferir revisar antes, envie uma branch e selecione essa branch no Render.
2. Entre no [painel do Render](https://dashboard.render.com/). Em New → Blueprint, conecte o repositório e escolha a branch que contém `render.yaml`. Caso seja necessário autorizar acesso ao GitHub, conceda apenas acesso ao repositório necessário.
3. Revise o serviço `paraflow` e informe **MONGO_URI** no campo solicitado. Use um banco de demonstração ou produção apropriado e um usuário com acesso apenas a esse banco. O Render gera um JWT_SECRET novo; não publique nem cole esse valor em chats.
4. No Atlas, permita os endereços de saída do serviço Render no acesso de rede. Use os endereços exibidos pelo próprio serviço; não é necessário liberar o banco para toda a internet.
5. Confira o plano selecionado e inicie a criação. Aguarde build e estado Live. O endereço final será o mostrado no painel; nenhum endereço público foi criado apenas por adicionar o arquivo YAML.
6. Abra `/api/health`, `/login` e `/app/dashboard`. Cadastre sua empresa, adicione a máquina e confira login, histórico e reserva. Atualizar diretamente `/app/dashboard` deve manter a aplicação funcionando.

O backend/.env local já possui uma conexão de banco não local, mas ela não foi testada nem transferida nesta revisão. Confirme se deseja usar esse banco na publicação; prefira separar dados de demonstração dos dados em uso. Preencha credenciais diretamente no painel do Render.

## Alternativa: New → Web Service

Se não usar Blueprint, configure os mesmos valores manualmente:

| Campo | Valor |
| --- | --- |
| Repository | GuiCampos06/Paraflow |
| Root Directory | Deixar vazio: usar a raiz do repositório |
| Runtime | Node |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Instances | 1 |
| NODE_VERSION | `24.19.0` |
| NODE_ENV | `production` |
| MONGO_URI | Sua conexão MongoDB, preenchida como segredo no painel |
| JWT_SECRET | Segredo aleatório forte exclusivo desse ambiente |
| TRUST_PROXY_HOPS | `1` |
| ALLOW_SIMULATION | `false` |

Não configure VITE_API_URL para localhost: a aplicação usa a mesma origem. Para domínio próprio, adicione a URL HTTPS em PUBLIC_URL e os demais sites autorizados em CORS_ORIGINS, separados por vírgula. A URL onrender é detectada automaticamente por RENDER_EXTERNAL_URL.

## Conectar o ESP32 online

Cadastre MQTT_URL com `mqtts://`, MQTT_USERNAME e MQTT_PASSWORD no ambiente Render. Use um prefixo próprio em MQTT_TOPIC_PREFIX e o mesmo prefixo/credenciais de broker no firmware. O token da máquina continua sendo o gerado pelo Paraflow, distinto da senha de acesso ao broker.

O firmware atual utiliza WiFiClient sem TLS. Antes de conectar a um broker TLS, adapte-o para cliente seguro com validação de certificado e configure permissões por máquina/tópico no broker. Trocar somente a porta não habilita TLS. Sem broker configurado, o site consegue consultar e registrar pedidos, mas a máquina não recebe avisos e o peso ao vivo fica indisponível.

## Limites do plano de demonstração

O Blueprint seleciona Free para permitir avaliação sem configurar uma assinatura paga automaticamente. O Render informa que serviços Free podem hibernar após 15 minutos sem tráfego HTTP ou mensagens WebSocket de entrada, e o despertar pode levar cerca de um minuto. **Não use esse perfil para contagem contínua de uma máquina**: com backend suspenso e o firmware atual sem fila persistente, peças podem não ser gravadas.

Para operação contínua, selecione conscientemente uma instância que não hiberne e implemente entrega persistente/deduplicação. Não aumente o número de instâncias antes de corrigir concorrência de pedidos e ingestão duplicada MQTT. Um plano pago não corrige esses pontos do código.

## Diagnóstico e retorno de versão

- Build falha: confirme raiz do repositório, lockfile e Node; consulte o primeiro erro do build.
- Serviço não sobe: confira MONGO_URI, permissão de rede, usuário do banco e existência de JWT_SECRET. Não exponha os valores dos segredos em logs ou prints.
- Site abre mas API falha: confirme que o serviço está executando npm start e não um servidor de arquivos estáticos.
- `/api/health` com mqtt=false: o banco pode estar saudável e o broker ausente; o estado HTTP desse endpoint atualmente mede disponibilidade do banco.
- Peso não atualiza: confira token, prefixo, TLS, ACL e a máquina selecionada.
- Em regressão, use uma versão anterior do serviço pelo painel; mudanças de dados precisam de plano próprio de migração/retorno.

## Fontes oficiais consultadas

- [Deploy de Express no Render](https://render.com/docs/deploy-node-express-app).
- [Contrato do Blueprint](https://render.com/docs/blueprint-spec).
- [Variáveis automáticas, incluindo RENDER_EXTERNAL_URL](https://render.com/docs/environment-variables).
- [WebSocket no Render](https://render.com/docs/websocket).
- [Limitações do plano Free](https://render.com/docs/free).
