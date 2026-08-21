# Plataforma de Eventos e Ingressos

Desafio Elite Dev. Organizador publica eventos a partir de um catálogo externo, cliente reserva e paga de forma simulada, recebe um ingresso com código em QR e pode compartilhá-lo por link. A portaria valida o ingresso na entrada, distinguindo válido, inválido, já utilizado e evento errado.

Este README descreve o que já funciona e o roadmap até a entrega. Nenhuma seção aqui promete comportamento que não exista no código.

---

## Roadmap

O Roadmap de implementação está detalhado no arquivo [ROADMAP.md](ROADMAP.md)

## Como rodar

### Com Docker, um comando

Só precisa de Docker. Não precisa de Node instalado, nem copiar arquivo de ambiente.

```bash
git clone <url-do-repositorio>
cd <pasta>
docker compose up
```

Sobem quatro coisas: PostgreSQL, api, front, e o seed, que roda uma vez depois que a api fica saudável e imprime no log as credenciais, um código de ingresso para colar na portaria e um link de compartilhamento.

- Front em `http://localhost:3000`
- Api em `http://localhost:8080`, com `curl -s localhost:8080/health`

Todas as variáveis têm valor padrão no `docker-compose.yml`, inclusive os segredos, que são de demonstração e não servem para ambiente publicado. Para trocar qualquer uma, copie `.env.example` para `.env` na raiz e preencha só o que quiser mudar.

**Sem chave do Ticketmaster a aplicação sobe igual**, e a busca de catálogo do organizador cai num conjunto local de dados, marcando a resposta como degradada. A chave é opcional em `TICKETMASTER_API_KEY`.

### Sem Docker, para desenvolver

**O projeto usa yarn.** Os dois pacotes têm `yarn.lock` versionado e nenhum tem `package-lock.json`: manter dois arquivos de trava sincronizados a cada mudança de dependência não ia acontecer, e um `package-lock.json` desatualizado é pior que ausente, porque `npm ci` instala exatamente o que está nele. Quem insistir em npm deve usar `npm install`, que resolve a partir do `package.json`.

Node 22 ou superior, e um PostgreSQL. O do compose serve: `docker compose up db`.

**API**

```bash
cd api
yarn install --frozen-lockfile
cp .env.example .env
yarn dev
```

Preencha `DATABASE_URL`, `SESSION_SECRET` e `TICKET_SECRET` no `.env`. A migração roda no boot do processo, antes de escutar a porta. Depois, `yarn seed` popula o banco e imprime as credenciais.

**Front**

```bash
cd web
yarn install --frozen-lockfile
cp .env.example .env
yarn dev
```

`API_URL` aponta para a api, `http://localhost:8080` por padrão. Ela é privada de propósito: o browser nunca fala com a api direto, sempre pelo BFF do Next.

---

## Estrutura

```
api/     Express 5, TypeScript, PostgreSQL
web/     Next.js, App Router
```

Dois pacotes independentes num repositório único, sem workspaces. Cada provedor de deploy instala e builda a partir do seu próprio diretório, sem configuração extra e sem `node_modules` içado para a raiz.

Dentro de `api/src`, a organização é por domínio (`auth`, `catalog`, `events`, `orders`, `payments`, `tickets`, `gate`), cada um com rota, serviço e repositório. Três regras sustentam a separação: SQL só dentro de repositório, transação só dentro de serviço, rota apenas valida entrada e traduz erro para HTTP.

`app.ts` é separado de `server.ts` para que os testes de integração subam a aplicação sem ocupar porta.

---

## Arquitetura

Front em Next.js na Vercel, backend em Express com TypeScript no Render, PostgreSQL no Neon.

O browser fala apenas com o Next. O route handler atua como BFF: lê o cookie de sessão e repassa a chamada à API com cabeçalho de autorização, servidor para servidor. Isso elimina cookie cross-site e CORS por construção, e é o motivo de não haver middleware de CORS no backend.

Documento completo em [ARQUITETURA.md](./ARQUITETURA.md), com modelo de dados, máquinas de estado, contrato de API e riscos. Sequência de implementação e pontos de corte em [ROADMAP.md](./ROADMAP.md). Contexto de desenvolvimento do backend em [api/CLAUDE.md](./api/CLAUDE.md) e do frontend em [web/CLAUDE.md](./web/CLAUDE.md).

---

## Requisitos e abordagem

Como cada requisito obrigatório do enunciado é atendido. A coluna de estado acompanha o progresso acima.

| Requisito                                | Abordagem                                                                                                                               | Estado    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Chamadas à API externa                   | Ticketmaster Discovery atrás de uma interface de provedor, com cache em memória, timeout, retry e fixtures quando a chamada falha       | planejado |
| Autenticação com três papéis             | Senha com bcrypt, token assinado em cookie HttpOnly definido pelo BFF, middlewares de papel, de posse do evento e de portaria atribuída | planejado |
| Eventos, reservas e ingressos            | Reserva é entidade própria, com estoque alocado na criação e expiração em dez minutos                                                   | planejado |
| Mesmo lugar não vendido duas vezes       | Contador por setor incrementado em `UPDATE` com a condição no `where`, mais restrição na tabela como segunda defesa                     | planejado |
| QR não forjável                          | Payload opaco com assinatura HMAC-SHA256 truncada, chave distinta da de sessão, sem dado pessoal dentro e nunca em formato de URL       | planejado |
| Compartilhamento por link                | Token aleatório guardado como hash, com expiração, revogação e contador de aberturas                                                    | planejado |
| Validação de uso único                   | `UPDATE` condicional pelo status atual, decidindo pela contagem de linhas afetadas                                                      | planejado |
| Pagamento simulado com recusa            | Autorização determinística por número de cartão, registrada por tentativa; recusa mantém a reserva viva para nova tentativa             | planejado |
| Navegação e busca de eventos             | Busca no servidor, refletida na query string, com filtros de cidade e período                                                           | planejado |
| Criação e gerenciamento pelo organizador | Painel com busca no catálogo, formulário editável sobre o snapshot importado, setores e publicação                                      | planejado |
| Reserva por quantidade e setor           | Setores por evento com capacidade e preço próprios, sem mapa de assentos                                                                | planejado |
| Meus ingressos com QR                    | Backend devolve o payload assinado, o front renderiza o QR em SVG                                                                       | planejado |
| Portaria com os quatro vereditos         | Cadeia de verificação parando no primeiro erro, respondendo 200 com campo de veredito, porque são resultados de negócio e não erros     | planejado |
| Câmera e digitação manual                | Leitor no navegador com campo de código sempre visível, nunca escondido atrás de um link                                                | planejado |
| Seeds                                    | Organizador, dois clientes, portaria e evento publicado com ingressos, imprimindo credenciais e um código válido no console             | planejado |
| Aplicação publicada                      | API no Render, front na Vercel, banco no Neon                                                                                           | planejado |

---

## Decisões técnicas

**Venda por setor e quantidade, não por mapa de assentos.** O enunciado aceita qualquer um dos dois modelos. Setor exercita exatamente a mesma concorrência com uma fração do custo de interface, e o tempo economizado foi para o fluxo obrigatório inteiro ficar de pé.

**As garantias críticas vivem no banco, não na aplicação.** Não vender além da capacidade e não validar o mesmo ingresso duas vezes são condições de corrida. Verificar em código antes de escrever deixa uma janela entre a leitura e a escrita, e essa janela é o bug. A condição vai na cláusula `where` do `UPDATE`, e restrições de tabela funcionam como segunda defesa independente do código.

**O QR não é uma URL.** Se o código apontasse para um endereço que valida, o aplicativo nativo de câmera abriria sozinho, o cliente queimaria o próprio ingresso em casa e prévia de link em mensageiro faria o mesmo. O payload é opaco e quem dispara a validação é a tela da portaria, autenticada.

**A assinatura do QR é o filtro barato, não a garantia central.** Ela rejeita payload forjado antes de tocar no banco. Quem garante uso único é o `UPDATE` condicional, e essa distinção importa mais que o algoritmo escolhido.

**Transição de estado é comando, não atualização de recurso.** Rotas de ação em vez de `PUT` com o status no corpo, porque a máquina de estados fica validada em um lugar só e a auditoria sai naturalmente.

**Recusa de pagamento não muda o estado do pedido.** A tentativa é registrada e a reserva continua viva até expirar, para o cliente tentar outro cartão sem refazer o pedido e sem perder o lugar.

**Express em vez de framework de aplicação.** Doze endpoints não pagam a camada de injeção de dependência, e as partes difíceis deste sistema são transacionais, não estruturais.

**Monólito modular com fronteiras explícitas.** Nenhuma consulta cruza fronteira de domínio, o que deixa barata uma separação futura. O custo real dessa separação também está declarado: hoje a alocação de estoque e a emissão do ingresso acontecem na mesma transação, e em dois serviços isso viraria uma saga com compensação, trocando uma restrição de banco por um problema distribuído.

---

## Limitações conhecidas

**A API hiberna.** O plano gratuito do Render suspende o serviço após quinze minutos sem tráfego, e a primeira requisição seguinte pode levar até um minuto. Um ping externo periódico reduz a chance de isso acontecer durante a avaliação, e `/health` devolve `startedAt` para confirmar quando a instância subiu.

**Sem refresh token rotativo.** A sessão tem validade fixa. A rotação é o desenho correto e ficou de fora por prazo.

**Sem atualização em tempo real da disponibilidade.** Um canal de eventos otimizaria carga de servidor, que este sistema não tem, e o efeito percebido pelo usuário é o mesmo com consulta periódica.

**Sem entidade de local separada.** Com um evento por local a normalização não se paga, e capacidade pertence à configuração do evento e não ao endereço.

**Sem reemissão de QR.** Não há tela que a acione, então a coluna e a verificação correspondentes seriam peso morto no schema.

---

## Uso de IA

<PENDENTE>

---

## Descartado, e por quê

- **Mensageria no fluxo de compra.** Emissão síncrona na mesma transação entrega a mesma garantia sem exigir polling na interface nem um broker para o avaliador subir.
- **Redis.** O lock é o `UPDATE` condicional, a sessão é token sem estado e o cache do catálogo cabe em memória enquanto houver uma instância.
- **Microsserviços.** Fronteira desenhada e documentada, separação não executada porque transformaria uma restrição de banco em saga com compensação.
- **Segunda fonte de catálogo.** Não cobre requisito adicional e amplia superfície de erro. A interface do provedor já deixa o encaixe pronto.
- **Framework de aplicação com injeção de dependência.** Estrutura imposta não compensa em um projeto deste tamanho e prazo.
- **Índice invertido para busca.** Com poucas dezenas de eventos o planejador ignoraria o índice, e o padrão de consulta é nome próprio digitado pela metade, que busca textual com radicalização trata pior que correspondência simples.
- **Revalidação de cache por gatilho do backend.** Disponibilidade em cache é risco de vender o que já acabou.

Fora de escopo por definição do próprio enunciado: nota fiscal, revenda entre usuários, aplicativo nativo, recuperação de senha e envio de ingresso por e-mail.
