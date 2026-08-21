# CLAUDE.md, backend

Contexto do pacote `api/`. Leia antes de escrever qualquer código aqui.

## O que é isto

Backend da plataforma de eventos e ingressos do desafio Elite Dev. Três papéis: organizador publica eventos a partir de um catálogo externo, cliente reserva, paga de forma simulada e recebe um ingresso com QR, portaria valida o ingresso na entrada.

**Isto é um case, avaliado por leitura e por um percurso curto na aplicação.** O critério declarado no enunciado é a decisão tomada e o que foi descartado, não o volume entregue. Escopo é decisão, não sobra: proposta que amplia superfície sem cobrir requisito é recusada.

O documento de arquitetura está em `../ARQUITETURA.md` e o registro das fases de implementação em `../ROADMAP.md`. Este arquivo é o resumo operacional.

## Stack

- Node 22, Express 5, TypeScript 5.9, CommonJS.
- PostgreSQL. Local via Docker Compose, publicado no Neon.
- Deploy no Render, plano gratuito.
- `module: "node18"` no tsconfig, sem `moduleResolution` e sem `"type": "module"` no package.json. Imports relativos sem extensão.

Não introduza ORM pesado, injeção de dependência, framework de aplicação nem broker de mensagem. Isso já foi decidido e está justificado no capítulo de decisões de `../ARQUITETURA.md`.

## Organização

Um diretório por domínio dentro de `src/`: `auth`, `catalog`, `events`, `orders`, `payments`, `tickets`, `gate`. Cada um com rota, serviço e repositório. Infraestrutura compartilhada em `src/http`, `src/db`, `src/env.ts`.

Três regras que sustentam a separação:

1. SQL existe apenas dentro de repositório.
2. Transação começa e termina dentro de serviço.
3. Rota valida entrada com schema e traduz erro para HTTP, nada além disso.

Nenhuma consulta faz join atravessando fronteira de domínio, só carrega o id. É isso que mantém barata a separação futura em serviços.

## Comentários

**Não escreva comentário em código.** Nome de função, de variável e de tipo carregam a intenção. Trecho que só se entende com comentário é trecho para reescrever, não para anotar.

Razão de não haver exceção: comentário não é verificado por nada e fica para trás na primeira mudança, e a partir daí mente. Decisão e justificativa vivem em `../ARQUITETURA.md`, que é onde alguém procura por elas.

Diretiva exigida por ferramenta, como `@ts-expect-error`, não é comentário neste sentido.

## Invariantes que não se negociam

As garantias centrais vivem no banco, não no código, porque todas são condição de corrida e verificação em aplicação sem lock é teatro.

- **Não vender além da capacidade.** `UPDATE` em `ticket_tiers` com a condição na cláusula `where`, mais um `CHECK` na tabela. Nunca `SELECT` antes de decidir.
- **Não validar o mesmo ingresso duas vezes.** `UPDATE` condicional pelo status atual, decidindo pela contagem de linhas afetadas. Zero linhas significa já utilizado.
- **Não cobrar nem reservar duas vezes.** Único em `idempotency_key` nas tabelas `orders` e `payments`. Insere primeiro e trata o conflito como leitura; consultar antes de inserir tem exatamente a corrida que a idempotência deveria evitar.
- **Ingresso usado sempre tem hora de uso.** `CHECK` ligando `status` e `used_at`.

Detalhes que já custaram bug e não devem ser reintroduzidos:

- Ordene os itens do pedido por id do tier antes do laço de alocação, senão dois pedidos com setores em ordem inversa travam em deadlock.
- O rótulo do lugar sai de `issued_seq`, que só sobe. Nunca de `allocated`, que desce em cancelamento e faz o rótulo colidir depois.
- Trave a linha do pedido antes de reler status e vencimento do hold, nessa ordem.
- Recusa de pagamento não muda o estado do pedido. Ele continua `PENDING` até o hold vencer, e a recusa vira linha em `payments`.

## Máquinas de estado

- **Pedido:** `PENDING` → `PAID` | `EXPIRED` | `CANCELLED`.
- **Ingresso:** `VALID` → `USED` | `CANCELLED`. Não volta de `USED`.
- **Evento:** `DRAFT` → `PUBLISHED` → `CANCELLED`.

Transição é comando, não atualização de recurso. Rotas de ação (`POST /organizer/events/:id/publish`, `POST /organizer/events/:id/cancel`, `POST /gate/validate`), nunca `PUT` com o status no corpo.

A transição para `CANCELLED` de pedido e de ingresso existe no modelo e no banco, e não tem caminho pela API: nenhuma rota a produz, e `POST /orders/:id/cancel` não está implementada. Cancelamento com devolução ao estoque é opcional declarado da fase 6 em `../ROADMAP.md`. Cancelamento de evento, esse sim, tem rota.

Quando o cancelamento de pedido for implementado, exigirá três precondições: pedido em `PENDING` ou `PAID`, nenhum ingresso em `USED`, evento ainda não começou.

## QR e portaria

Payload opaco: versão, id do ingresso sem hífens, assinatura HMAC-SHA256 truncada em base64url. Chave de assinatura distinta da chave de sessão. Nenhum dado pessoal dentro.

**O QR nunca é uma URL.** Se fosse, o aplicativo nativo de câmera abriria sozinho e o ingresso seria queimado antes da portaria.

A assinatura é o filtro barato que rejeita lixo antes de tocar no banco. A garantia de uso único é o `UPDATE` condicional.

Ordem de verificação, parando no primeiro erro: formato, assinatura, ingresso existe, pertence ao evento selecionado, reivindicação atômica. Só o último passo escreve. O evento selecionado viaja no corpo da requisição, senão o veredito de evento errado não existe.

Os vereditos da portaria não são erros HTTP. São resultado de negócio, respondidos com 200 e um campo de veredito: válido, inválido, já utilizado, evento errado, cancelado. Toda tentativa, inclusive as que falham, entra no log de validações, guardando o payload sem o segmento de assinatura.

## Contrato de resposta

Erro sempre no mesmo envelope, com código estável em maiúsculas:

```json
{ "error": { "code": "SOLD_OUT", "message": "...", "details": {} } }
```

Variável de ambiente obrigatória ausente derruba o processo no boot, nunca vira `undefined` circulando pela aplicação. Toda leitura de `process.env` acontece em `src/env.ts`.

## Coisas específicas do ambiente

- Escute em `0.0.0.0` com a porta vinda de `process.env.PORT`. Bind em `localhost` faz o health check do Render falhar sem mensagem clara.
- Nenhum middleware de CORS. Todo tráfego de browser passa pelo BFF do Next, então tudo é mesma origem. Se você precisar de CORS, alguma chamada furou o BFF e o certo é consertar a chamada.
- Migração roda no boot do processo, antes de escutar a porta.
- Desenvolva e teste contra o Postgres local do Compose. O Neon é só para o ambiente publicado.
- O plano gratuito do Render hiberna após quinze minutos. `/health` expõe `startedAt` para diagnosticar isso rápido.

## Commits

Título e nada mais, uma linha, em inglês, no formato `tipo(escopo): descrição`, sem rodapé de atribuição. Um contexto por commit: se o diff mistura duas preocupações, são dois commits.

Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`.

Escopos: `checkout`, `stock`, `cache`, `queue`, `worker`, `http`, `obs`, `domain`, `docs`, `build`.

## Testes

Quatro testes de integração contra Postgres real, não cobertura ampla:

1. Concorrência: dez lugares, trinta compras em paralelo, exatamente dez aprovadas.
2. Dupla validação: mesmo código duas vezes em paralelo, um válido e um já utilizado.
3. QR forjado: assinatura adulterada e assinatura de outra chave, ambas inválidas.
4. Autorização: papel errado recebe 403, evento alheio recebe 404, ingresso de outro evento recebe evento errado.

`createApp` é separado de `server` justamente para o teste subir a aplicação sem abrir porta.

## Fora de escopo, não sugira

Mensageria, Redis, SSE, WebSocket, microsserviços, mapa de assentos, e-mail, nota fiscal, transferência de titularidade, recuperação de senha, refresh token rotativo, entidade de local separada, reemissão de QR, TMDb como segunda fonte.

Cada um desses tem justificativa no capítulo de decisões de `../ARQUITETURA.md`. Se algo aqui parecer errado, a discussão vai para o documento de arquitetura, não para o código.