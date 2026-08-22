# Plataforma de Eventos e Ingressos

Organizador publica eventos a partir de um catálogo externo, cliente reserva e paga de forma simulada, recebe um ingresso com código em QR e pode compartilhá-lo por link, e a portaria valida o ingresso na entrada.

- Front: `https://verzel-elite-dev-psi.vercel.app`
- API: `https://verzel-elite-dev.onrender.com`

> **A primeira requisição pode levar até um minuto.** O plano gratuito do Render suspende o serviço depois de quinze minutos sem tráfego, e ele precisa subir de novo antes de responder. Não é falha: abra o front, espere, e a partir daí tudo responde normalmente. O endpoint `/health` da API confirma que a instância está de pé.

---

## Credenciais e dados de teste

O seed cria quatro contas com a mesma senha:

```
ORGANIZER   organizador@demo.com
CUSTOMER    cliente1@demo.com
CUSTOMER    cliente2@demo.com
GATE        portaria@demo.com

senha: senha123
```

`cliente1@demo.com` já tem ingressos e, depois do seed, pelo menos um pedido em cada estado: aguardando pagamento, pago, reserva expirada e cancelado. `cliente2@demo.com` começa sem nada, para percorrer a compra do zero.

O seed imprime, no final da execução, duas coisas que a demonstração precisa:

```
Código para colar na portaria:

  v1.<identificador>.<assinatura>   (Pista 0001)

Link de compartilhamento:

  http://localhost:3000/ingresso/<token>   (Pista 0002)
```

O código é o payload do ingresso: cole no campo de texto da portaria quando a câmera não estiver disponível. O link abre o ingresso sem login, e é revogado e regerado a cada execução do seed.

### Cartões de teste

A autorização é determinística pelo número do cartão. Qualquer cartão que passe no dígito verificador e não esteja na lista abaixo é **aprovado**.

| Número                | Resultado                          |
| --------------------- | ---------------------------------- |
| `4242 4242 4242 4242` | aprovado                           |
| `4242 4242 4242 4241` | recusado, número inválido          |
| `4000 0000 0000 0002` | recusado pelo emissor              |
| `4000 0000 0000 9995` | recusado, saldo insuficiente       |
| `4000 0000 0000 0069` | recusado, cartão vencido           |
| `4000 0000 0000 0127` | recusado, cartão bloqueado         |

A recusa **não** cancela o pedido: a reserva continua viva até o prazo de dez minutos vencer, e o cliente pode tentar outro cartão sem perder o lugar. Os cartões também aparecem na própria tela de pagamento.

---

## Como rodar local

### Com Docker, um comando

Só precisa de Docker. Não precisa de Node instalado, nem copiar arquivo de ambiente.

```bash
git clone <url-do-repositorio>
cd <pasta>
docker compose up
```

Sobem quatro coisas: PostgreSQL, api, front, e o seed, que roda uma vez depois que a api fica saudável e imprime as credenciais, o código do ingresso e o link de compartilhamento no log.

- Front em `http://localhost:3000`
- API em `http://localhost:8080`, com `curl -s localhost:8080/health`

Todas as variáveis têm valor padrão no `docker-compose.yml`, inclusive os dois segredos, que são de demonstração e não servem para ambiente publicado. Para trocar qualquer uma, copie `.env.example` para `.env` na raiz e preencha só o que quiser mudar.

**Sem chave do Ticketmaster a aplicação sobe igual**, e a busca de catálogo do organizador cai num conjunto local de dados, marcando a resposta como degradada. A chave é opcional, em `TICKETMASTER_API_KEY`.

Para recomeçar do zero, `docker compose down -v` apaga o volume do banco.

### Sem Docker, para desenvolver

**O projeto usa yarn.** Os dois pacotes têm `yarn.lock` versionado e nenhum tem `package-lock.json`.

Node 22 ou superior, e um PostgreSQL. O do compose serve: `docker compose up db`.

**API**

```bash
cd api
yarn install --frozen-lockfile
cp .env.example .env
```

O `.env.example` já vem com a porta, o `DATABASE_URL` do banco do compose e o `WEB_URL` local. Faltam os dois segredos, que precisam ser gerados:

```bash
printf 'SESSION_SECRET=%s\nTICKET_SECRET=%s\n' \
  "$(openssl rand -base64 32)" "$(openssl rand -base64 32)" >> .env
sed -i '/^SESSION_SECRET=$/d;/^TICKET_SECRET=$/d' .env
```

Eles são distintos de propósito: vazamento da chave de sessão permitiria forjar sessão, e vazamento da chave de ingresso permitiria forjar código. Separá-las mantém cada consequência contida.

```bash
yarn dev     # migra e sobe em http://localhost:8080
yarn seed    # popula e imprime credenciais, código e link
```

A migração roda no boot do processo, antes de escutar a porta. Faltando uma variável obrigatória, o processo morre no boot em vez de subir e responder errado.

Outros comandos: `yarn test` roda os quatro testes de integração contra o Postgres configurado, e `yarn reset` apaga pedidos, pagamentos, ingressos, links e tentativas de validação, preservando usuários e eventos.

**Front**

```bash
cd web
yarn install --frozen-lockfile
cp .env.example .env
yarn dev     # http://localhost:3000
```

`API_URL` já vem apontando para `http://localhost:8080`. Ela não tem padrão no código e não tem prefixo público, de propósito: sem ela o BFF responde erro, e com prefixo público ela chegaria ao browser, que passaria a falar com a API direto.

---

## Requisitos obrigatórios, e onde cada um está

| Requisito                                | Onde está                                                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Chamadas à API externa                   | `api/src/catalog/ticketmaster.ts`, atrás da interface em `api/src/catalog/types.ts`; cache, degradação e conjunto local em `api/src/catalog/service.ts` e `api/src/catalog/fixtures-provider.ts` |
| Autenticação com três papéis             | `api/src/auth/password.ts` (bcrypt), `api/src/auth/token.ts` (token de doze horas), `api/src/auth/middleware.ts` (papel); cookie HttpOnly definido em `web/app/api/auth/login/route.ts` |
| Eventos, reservas e ingressos            | `api/src/events/service.ts`, `api/src/orders/service.ts`, `api/src/tickets/service.ts`                                        |
| Mesmo lugar não vendido duas vezes       | `api/src/events/repository.ts`, função `allocate`; restrição de tabela em `api/src/db/migrations/001_init.sql`                |
| QR não forjável                          | `api/src/tickets/service.ts`, funções `codeFor` e `readCode`                                                                  |
| Compartilhamento por link                | `api/src/tickets/service.ts` (`share`, `revokeShare`, `openShared`), `web/components/share-controls.tsx`, `web/app/ingresso/[token]/page.tsx` |
| Validação de uso único                   | `api/src/tickets/repository.ts`, função `claim`; cadeia de verificação em `api/src/gate/service.ts`                           |
| Pagamento simulado com recusa            | `api/src/payments/service.ts`, função `authorize`; tela em `web/components/checkout-payment.tsx`                              |
| Navegação e busca de eventos             | `web/app/page.tsx` e `web/components/catalog-filter-form.tsx`; busca no servidor em `api/src/events/repository.ts`            |
| Criação e gerenciamento pelo organizador | `web/app/organizador/page.tsx`, `web/components/event-form.tsx`, `web/components/catalog-import.tsx`                          |
| Reserva por quantidade e setor           | `web/components/reserve-form.tsx`, `web/app/eventos/[id]/page.tsx`                                                            |
| Meus ingressos com QR                    | `web/components/my-tickets.tsx`, `web/components/ticket-face.tsx`, `web/components/ticket-code.tsx`                          |
| Portaria com os vereditos                | `web/components/gate-console.tsx`; vereditos decididos em `api/src/gate/service.ts`                                          |
| Câmera e digitação manual                | `web/components/gate-scanner.tsx` e `web/public/qr-decoder.worker.js`; o campo manual fica em `web/components/gate-console.tsx` |
| Seeds                                    | `api/src/db/seed.ts`                                                                                                          |
| Testes de concorrência                   | `api/tests/concurrency.test.ts`, `api/tests/double-validation.test.ts`, `api/tests/forged-code.test.ts`, `api/tests/authorization.test.ts` |
| Docker Compose                           | `docker-compose.yml`, `api/Dockerfile`, `web/Dockerfile`                                                                      |

---

## Arquitetura em resumo

Front em Next.js na Vercel, API em Express com TypeScript no Render, PostgreSQL no Neon.

O browser fala apenas com o Next. Cada route handler em `web/app/api` atua como BFF: lê o cookie de sessão e repassa a chamada à API com cabeçalho de autorização, servidor para servidor. Isso elimina cookie entre domínios e CORS por construção, e é o motivo de não existir middleware de CORS no backend.

Dentro de `api/src`, a organização é por domínio — `auth`, `catalog`, `events`, `orders`, `payments`, `tickets`, `gate` — cada um com rota, serviço e repositório. Três regras sustentam a separação: SQL só dentro de repositório, transação só dentro de serviço, rota apenas valida entrada e traduz erro para HTTP. Nenhuma consulta faz junção atravessando fronteira de domínio.

Modelo de dados, máquinas de estado, contrato completo da API e modos de falha estão em [ARQUITETURA.md](ARQUITETURA.md).

---

## As duas garantias

### Não vender o mesmo lugar duas vezes

Cada setor tem `capacity` e `allocated`. A reserva não lê a disponibilidade para depois decidir: ela tenta escrever, e a condição vive na própria cláusula `where`.

```sql
update ticket_tiers
   set allocated = allocated + $3, updated_at = now()
 where id = $1 and event_id = $2 and allocated + $3 <= capacity
 returning price_cents
```

Se a linha não for afetada, não havia lugar. A decisão é da escrita, e não de uma leitura anterior — e é essa a diferença que importa: verificar antes de escrever deixa uma janela entre a leitura e a escrita, e essa janela é o bug. Duas requisições simultâneas leriam a mesma disponibilidade e as duas concluiriam que cabe.

Uma restrição `check (allocated >= 0 and allocated <= capacity)` na tabela é a segunda defesa, independente do código: mesmo que alguém escreva um caminho novo e esqueça a condição, o banco recusa.

**O que o teste de concorrência mede.** `api/tests/concurrency.test.ts` sobe a aplicação numa porta efêmera, cria um setor com dez lugares e dispara trinta compras em paralelo. O resultado exigido é exato: dez aprovações, vinte recusas por esgotamento, ocupação em dez e dez ingressos persistidos.

Uma honestidade sobre o que esse número significa: o pool de conexões limita as transações simultâneas a dez. As trinta requisições chegam juntas na camada HTTP, mas o banco enxerga no máximo dez transações ativas, e as demais ficam enfileiradas na trava da linha do setor até o lote drenar. Amostrando `pg_stat_activity` durante uma execução, o pico foi de dez ativas e nove esperando trava. O número não foi inflado para o teste: o mesmo limite de pool vale na instância publicada, então o que o teste exercita é a disputa que existe em produção, e não um cenário construído para parecer mais severo.

### O código do ingresso não ser forjável

O payload tem três segmentos: versão, identificador do ingresso sem hífens, e assinatura HMAC-SHA256 truncada em base64url, com uma chave distinta da chave de sessão. Nenhum dado pessoal vai dentro.

```
v1.<32 caracteres hexadecimais>.<22 caracteres base64url>
```

**Não é uma URL, de propósito.** Se fosse, o aplicativo nativo de câmera abriria o endereço sozinho, e o cliente queimaria o próprio ingresso ao conferir o QR em casa — prévia de link em mensageiro faria o mesmo. Sendo opaco, quem dispara a validação é a tela da portaria, autenticada, informando em qual evento está trabalhando.

**A assinatura é o filtro barato, não a garantia central.** Ela rejeita payload adulterado antes de qualquer consulta ao banco, e um identificador aleatório de alta entropia ofereceria segurança prática equivalente. Quem garante uso único é a escrita condicional:

```sql
update tickets
   set status = 'USED', used_at = now(), used_by = $2, updated_at = now()
 where id = $1 and status = 'VALID'
 returning status, used_at, used_by
```

Zero linhas afetadas significa que o ingresso já havia sido consumido, e nenhuma ordem de chegada, latência de rede ou concorrência entre dois leitores altera esse resultado. `api/tests/double-validation.test.ts` submete o mesmo código duas vezes em paralelo e exige uma aprovação e um "já utilizado", com a hora de uso preenchida uma vez só. `api/tests/forged-code.test.ts` submete assinatura adulterada e assinatura produzida com outra chave, e exige que as duas sejam recusadas sem tocar no ingresso.

Os vereditos da portaria não são erros HTTP. Válido, inválido, já utilizado, evento errado e cancelado chegam com status 200 e um campo de veredito, porque são resultados de negócio. Toda tentativa entra no log de validações, inclusive as recusadas, guardando o payload sem o segmento de assinatura.

---

## Decisões técnicas

**As garantias críticas vivem no banco, não na aplicação.** Não vender além da capacidade e não validar o mesmo ingresso duas vezes são condições de corrida. Verificação em código antes de escrever é teatro: a condição vai na cláusula de escrita, e restrições de tabela funcionam como segunda defesa.

**Venda por setor e quantidade, não mapa de assentos.** O enunciado aceita os dois. Setor exercita exatamente a mesma concorrência com uma fração do custo de interface, e o tempo economizado foi para o fluxo obrigatório inteiro ficar de pé.

**Transição de estado é comando, não atualização de recurso.** Rotas de ação em vez de `PUT` com o status no corpo, porque a máquina de estados fica validada num lugar só.

**Monólito modular em vez de serviços separados.** As fronteiras existem e são respeitadas, mas o custo da separação está declarado: hoje a alocação de estoque e a emissão do ingresso acontecem na mesma transação, e em dois serviços isso viraria uma saga com compensação — trocar uma restrição de banco por um problema distribuído.

**Emissão síncrona em vez de mensageria.** Publicar a intenção de compra e consumir de forma assíncrona é o desenho certo quando faturamento e emissão precisam ser desacoplados. Aqui os dois acontecem na mesma requisição, e o desacoplamento faria a interface esperar por um resultado que já poderia ter entregue.

**Cache em processo em vez de cache externo.** Com instância única, um cache compartilhado adicionaria um serviço, uma credencial e um modo de falha para resolver um problema que não existe.

**Express em vez de framework com injeção de dependência.** A dificuldade deste sistema é transacional, não estrutural.

**Biblioteca só para gerar a matriz do QR.** É a única dependência de terceiro no front além do framework. Ela recebe a cadeia e devolve uma matriz de booleanos; o desenho do símbolo é do projeto. Serviço externo de geração saiu por segurança — o payload é credencial de entrada, e mandá-lo para um gerador de imagens entrega a quem estiver do outro lado o código que abre a catraca.

Três decisões tomadas durante a implementação, e não no documento de arquitetura:

**bcrypt em vez de Argon2id.** Argon2id é a recomendação atual, e bcrypt com custo 12 é adequado para este caso. A razão é operacional: a implementação de referência do Argon2 em Node é um módulo nativo, que precisa compilar ou encontrar binário pronto para a plataforma do provedor, e isso acrescenta um modo de falha no deploy em troca de uma margem que não muda o risco deste sistema. `bcryptjs` é JavaScript puro e sobe em qualquer lugar. Se o requisito de senha endurecer, a troca é local: só `api/src/auth/password.ts` conhece o algoritmo.

**Camadas sem inversão explícita de dependência.** Serviço importa repositório diretamente, sem interface no meio nem contêiner de injeção. A fronteira é mantida por convenção — SQL só em repositório, transação só em serviço — e verificada por leitura, não por tipo. Em um projeto deste tamanho a interface intermediária seria cerimônia: existiria uma implementação de cada, e a troca que ela habilita não está prevista. O custo aceito é que trocar o Postgres exigiria editar os repositórios, e não apenas registrar outra implementação.

**Um gerenciador de pacotes só, e é o yarn.** Havia `yarn.lock` e `package-lock.json` no mesmo pacote, e manter os dois sincronizados a cada mudança de dependência não ia acontecer — o `package-lock.json` do backend já estava desatualizado a ponto de `npm ci` falhar. Um lockfile desatualizado é pior que ausente, porque instala exatamente o que está nele e o erro aparece numa árvore que nunca foi testada. Ficou o yarn, que estava íntegro, e `package-lock.json` entrou no gitignore para que uma verificação futura com npm não reintroduza o conflito. Quem insistir em npm deve usar `npm install`, que resolve a partir do `package.json`.

---

## Uso de IA

### Quais ferramentas, e em que papel

**Claude, como par de arquitetura, antes de qualquer código.** Ele não escreveu implementação. Recebeu a proposta inicial de solução, apontou os buracos, ajudou a fechar o modelo de dados e as garantias de concorrência, e depois revisou cada entrega de código com olhar adversarial.

**Claude Code, executando implementação sobre instruções escritas.** Cada bloco entrou com um prompt detalhado, foi entregue, revisado, e só então commitado.

### Como o ciclo funcionou

Prompt escrito com o contrato, as restrições e o critério de validação. Entrega. Revisão. Quando a revisão apontava defeito, a correção vinha com o motivo, e não como ordem. Em vários casos o Claude Code contestou a revisão com evidência e estava certo, e a decisão mudou por causa disso.

### O que a revisão encontrou

Vale citar os defeitos reais que foram pegos antes de virarem código, porque é isso que diferencia condução de aceitação:

- Fallback do catálogo externo respondendo como se a fonte real tivesse atendido, o que faria dados locais passarem por dados da API.
- Reserva sem chave de idempotência, e verificação de idempotência com consulta antes da inserção, que reintroduz a corrida que ela deveria eliminar.
- Rótulo de lugar derivado do contador de ocupação, que colide depois de um cancelamento, na emissão, com o pagamento já autorizado.
- Publicação de evento validando precondições fora da transação que executa a mudança, permitindo publicar evento sem setor.
- Chave de idempotência sem prefixo de cliente, permitindo ler pedido alheio ao adivinhar a chave.
- Compartilhamento sem serialização na linha do ingresso, gerando dois links ativos para o mesmo ingresso.
- Laço de leitura da câmera que parava para sempre se o decodificador falhasse, com a câmera ligada e nada acontecendo na tela.
- TypeScript cru servido como worker no build, que passaria no build e falharia no dispositivo.
- Chave de idempotência do pagamento descartada a cada tecla digitada, o que transformaria falha de rede em risco de cobrança dupla.

### Artefatos do processo, versionados

[ARQUITETURA.md](ARQUITETURA.md), [ROADMAP.md](ROADMAP.md), [PROMPTS.md](PROMPTS.md) e os dois contextos de desenvolvimento, [api/CLAUDE.md](api/CLAUDE.md) e [web/CLAUDE.md](web/CLAUDE.md).

O [PROMPTS.md](PROMPTS.md) registra o mecanismo: o formato dos prompts, as regras que valeram em todos eles, e os pontos em que a entrega contestou o prompt com evidência e a decisão mudou.

---

## O que foi feito sem assistência

### O esqueleto dos dois pacotes

Criei o repositório do zero, com `api` e `web` lado a lado, cada um com o próprio `package.json`, o próprio lockfile e o próprio `tsconfig`. Sem workspaces.

O backend montei à mão, e não por gerador: `package.json` com os scripts de desenvolvimento, build e execução, `tsconfig` com a configuração de módulo, leitura centralizada de variáveis de ambiente que derruba o processo no boot quando falta alguma obrigatória, montagem do Express separada da abertura da porta, envelope de erro único, e o endpoint de saúde.

O front veio do gerador oficial do Next, com App Router e TypeScript, e fixei as versões em seguida: a linha de suporte estendido do framework em vez da mais recente, e o compilador de TypeScript preso na linha anterior à reescrita, para não depurar mudança de compilador no meio do projeto.

O route handler do BFF escrevi à mão, com o repasse do cookie de sessão para cabeçalho de autorização, tempo limite abaixo do limite da plataforma, e tratamento separado para resposta não interpretável, que é diferente de rede indisponível.

### O provisionamento dos três ambientes

**Banco no Neon.** Projeto criado, versão do Postgres escolhida para coincidir com a do contêiner local, agrupamento de conexões desligado porque o modo de transação atrapalha comandos preparados e o sistema usa transações explícitas com trava de linha, e o schema aplicado pela própria migração da aplicação, e não por ferramenta externa.

**Backend no Render.** Serviço apontando para o subdiretório do backend, comandos de build e execução, verificação de saúde no endpoint próprio, e as variáveis de ambiente definidas no painel, com os dois segredos gerados separadamente, um para a sessão e outro para a assinatura do ingresso.

**Front na Vercel.** Projeto apontando para o subdiretório do front, com uma única variável, deliberadamente privada, para que a URL da API não chegue ao browser e o BFF continue sendo o único caminho.

Além disso, um acionamento externo periódico contra a hibernação do plano gratuito.

### As decisões dessa etapa, e o motivo de cada uma

- **Publiquei antes de existir regra de negócio.** Deploy é a parte do trabalho com mais desconhecidos e menos relação com o domínio: build no ambiente do provedor, variáveis, comunicação entre serviços em domínios diferentes, contexto seguro e hibernação. Nada disso fica mais fácil de depurar depois, com o sistema montado por cima.
- **Repositório único com pacotes independentes, sem workspaces.** O histórico conta o processo num lugar só, e cada provedor instala e builda a partir do próprio diretório sem configuração extra.
- **Todas as chamadas do browser passando pelo BFF.** Elimina cookie entre domínios e CORS por construção, mantém a URL da API privada, e faz o token de sessão nunca ficar acessível a JavaScript de cliente.
- **Migração escrita à mão, sem ferramenta de geração.** As invariantes deste sistema são restrições de tabela e escritas condicionais, e são exatamente o que precisa estar legível para quem lê o código. Uma ferramenta que gera migração a partir de um modelo esconderia isso atrás de uma abstração.
- **Variável de ambiente obrigatória ausente derruba o processo no boot.** Falhar ao subir é melhor que responder errado depois.

### O que aprendi ao publicar tarde

Apesar de a publicação ser a primeira fase do plano, ela foi concluída bem depois, e o custo apareceu: dois problemas que só existem no ambiente publicado ficaram escondidos até quase o fim.

O instalador do provedor pula dependências de desenvolvimento quando o ambiente é de produção, e o build precisa delas para compilar, então o primeiro deploy falhou com erros de tipo que não existem localmente. E o arquivo de ambiente local tem precedência sobre variáveis passadas ao processo, o que fez uma execução apontada para o banco publicado rodar contra o local sem avisar.

Os dois teriam aparecido no primeiro dia se a publicação tivesse acontecido quando o plano dizia.

### As decisões de arquitetura

Os documentos do projeto foram escritos à mão e usados como contexto do trabalho assistido, e não produzidos por ele: `ARQUITETURA.md`, `ROADMAP.md`, os dois `CLAUDE.md` e este README. O `PROMPTS.md` é a exceção declarada: os prompts citados nele são meus, mas a compilação foi montada ao final, sobre o registro da sessão.

Junto deles, as decisões de desenho tomadas antes de qualquer implementação:

- Estoque como contador no setor, e não como linhas de ingresso pré-criadas.
- O código do ingresso não ser uma URL, para que o aplicativo de câmera não o consuma sozinho.
- A assinatura do código ser filtro barato, e não a garantia de uso único.
- Transição de estado como comando, e não atualização de recurso com o estado no corpo.
- Venda por setor e quantidade, e não mapa de assentos.
- Recusa de mensageria, cache externo e separação em serviços, com o custo real de cada uma registrado.

As duas partes desta seção são verdadeiras ao mesmo tempo, e a declaração honesta vale mais que qualquer uma delas isolada.

---

## Limitações conhecidas

**A aplicação hiberna**, e o primeiro acesso depois de quinze minutos sem tráfego leva até um minuto.

**Não há rotação de credencial de sessão.** A sessão tem validade fixa de doze horas. A rotação é o desenho correto e ficou de fora conscientemente.

**O contador de ocupação é uma linha quente por setor.** Sob concorrência real e sustentada num mesmo evento ele se torna ponto de serialização, e a evolução natural seria particionar o estoque em faixas. É o preço de ter a garantia numa única escrita condicional.

**A disponibilidade exibida não se atualiza sozinha** enquanto a página está aberta. Um canal de eventos otimizaria carga de servidor, que este sistema não tem.

**O ingresso lê os dados do evento, e não uma cópia feita na emissão.** Isso é correto hoje porque evento publicado não aceita edição e não volta a rascunho: a condição `status = 'DRAFT'` está na cláusula `where` da própria atualização, a emissão exige pedido pago, e pedido exige evento publicado. Os dois estados não se reencontram. Quem um dia permitir editar evento publicado precisa antes copiar título, data, fuso, local e nome do setor para o ingresso, sob pena de o comprovante passar a mostrar algo diferente do que foi vendido.

**Não há reemissão de código de ingresso**, o que significa que uma captura de tela do QR permanece apresentável enquanto o ingresso não for consumido.

**Não existe transferência de titularidade**, apenas compartilhamento de acesso, e o compartilhamento diz isso com todas as letras na tela: quem tem o link tem o ingresso, e a primeira leitura na portaria vence.

**Não existe caminho na API para criar conta de organizador.** O cadastro público fixa papel de cliente e não há painel administrativo, então organizadores nascem do seed. É privilégio mínimo, não omissão: qualquer rota que criasse organizador seria a rota que promove a si mesmo. A consequência prática é que testar posse entre organizadores distintos exige criar a segunda conta fora da API.

**Atribuir portaria informando apenas o e-mail responde de forma distinta conforme a conta exista ou não**, o que permite a um organizador autenticado descobrir se um endereço está cadastrado, testando um por vez. Responder igual nos dois casos eliminaria a distinção, mas deixaria sem resposta quem tentou atribuir uma conta que existe. O que se descobre é a existência do endereço, sem nome, papel ou qualquer outro dado.

**A idempotência do seed depende do título do evento.** Como `events` não tem chave natural, o seed reconhece o que já semeou procurando pelo título entre os eventos do organizador de demonstração. Renomear esse evento pela tela do organizador faz a execução seguinte criar um segundo.

**O pedido pendente semeado vive dez minutos**, como qualquer reserva. Quem rodar o seed e voltar à tela depois disso vê "reserva expirada" no lugar dele. Rodar o seed de novo recria o pendente.

---

## Fora de escopo, por definição do enunciado

Nota fiscal, revenda entre usuários, aplicativo nativo, recuperação de senha e envio de ingresso por e-mail.
