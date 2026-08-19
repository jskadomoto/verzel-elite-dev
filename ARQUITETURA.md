# Arquitetura

Plataforma de eventos e ingressos. Este documento descreve o sistema: componentes, modelo de domínio, fluxos críticos, garantias de consistência e as decisões que produziram esse desenho.

---

## 1. Visão geral

Três atores operam sobre o mesmo acervo de eventos, com permissões disjuntas.

O **organizador** busca um espetáculo no catálogo externo, importa os dados para dentro do sistema, ajusta data, local, setores, capacidade e preço, e publica. O **cliente** navega pelos eventos publicados, escolhe setor e quantidade, tem o estoque reservado por dez minutos, paga de forma simulada e recebe um ingresso com código em QR, que pode compartilhar por link. A **portaria** seleciona o evento em que está trabalhando e valida ingressos na entrada, por leitura de câmera ou digitação, recebendo um veredito inequívoco a cada leitura.

O acervo tem duas origens que não se confundem: o catálogo externo é fonte de descoberta, consultada apenas pelo organizador no momento da importação, e o banco local é a fonte da verdade de tudo que envolve venda. Depois que um evento é criado, o sistema nunca mais depende da API externa para exibi-lo, vendê-lo ou validá-lo.

O núcleo do problema não é volume nem quantidade de telas. São três invariantes que precisam sobreviver a acesso concorrente: o mesmo lugar não pode ser vendido duas vezes, o mesmo ingresso não pode entrar duas vezes, e o mesmo pagamento não pode ser cobrado duas vezes. Todo o resto do desenho se organiza em torno delas.

## 2. Restrições que moldaram o desenho

**Custo zero de operação.** Toda a infraestrutura roda em planos gratuitos, o que impõe uma instância única de aplicação, um banco pequeno e hibernação por inatividade. Isso elimina, por construção, qualquer solução que dependa de coordenação entre múltiplos nós, e torna aceitáveis soluções em memória de processo que seriam inadequadas com escala horizontal.

**Escopo proporcional ao problema.** O sistema resolve um domínio pequeno e bem delimitado, e foi desenhado para ser construído em fases que terminam funcionando de ponta a ponta, em vez de camadas horizontais que só se encontram no final. Isso favorece o monólito modular e desfavorece separação física de componentes, que aqui adicionaria coordenação sem resolver nada que já não esteja resolvido.

**Verificabilidade.** O sistema precisa ser inteiramente percorrível por alguém que nunca o viu, a partir de um banco semeado, sem configuração externa obrigatória. Isso é o motivo de a integração externa ter fallback embutido e de o seed nascer com um pedido já pago.

## 3. Topologia

```
Browser
   |
   |  HTTPS, mesma origem
   |  cookie HttpOnly, SameSite Lax
   v
Next.js (Vercel)
   |  app/(public)     catálogo, evento, ingresso compartilhado
   |  app/(customer)   checkout, meus ingressos
   |  app/(organizer)  importação, criação, painel
   |  app/(gate)       leitor e vereditos
   |  app/api/*        BFF: injeta Authorization a partir do cookie
   |
   |  HTTPS, servidor para servidor
   |  Authorization: Bearer
   v
Express + TypeScript (Render)
   |  auth  catalog  events  orders  payments  tickets  gate
   |
   +--> Ticketmaster Discovery (somente no fluxo de importação)
   |
   v
PostgreSQL (Neon)
```

### O BFF e por que ele existe

O browser nunca fala com a API. Cada chamada do cliente vai para um route handler do Next, que lê o cookie de sessão e repassa a requisição ao Express com cabeçalho de autorização.

Isso resolve um problema concreto de fronteira. Front e back vivem em domínios distintos, e um cookie compartilhado entre eles exigiria `SameSite=None`, `Secure`, e CORS com credenciais, uma combinação que navegadores tratam de forma cada vez mais restritiva e que quebra de maneiras difíceis de diagnosticar. Com o BFF, do ponto de vista do browser existe uma origem só. O efeito colateral positivo é que o token de sessão nunca fica acessível a JavaScript de cliente, e a URL da API não é pública.

O custo é um salto de rede adicional por requisição e a necessidade de que qualquer chamada nova nasça como route handler. Não há middleware de CORS no backend, de propósito: se um erro de CORS aparecer, ele indica uma chamada que escapou do BFF, e o conserto é a chamada.

### Organização do backend

Monólito modular, um diretório por domínio, cada um com três camadas: rota, serviço e repositório. As fronteiras são mantidas por três regras.

SQL existe apenas dentro de repositório. Transação começa e termina dentro de serviço. Rota valida entrada contra schema e traduz resultado ou erro para HTTP, nada além disso.

Nenhuma consulta faz junção atravessando fronteira de domínio; o que atravessa é o identificador. Essa disciplina é o que tornaria barata uma eventual separação em serviços, e o documento é explícito sobre onde ela pararia de ser barata: a alocação de estoque e a emissão do ingresso acontecem hoje na mesma transação, e separadas em processos distintos virariam uma saga com compensação. A garantia de não vender duas vezes deixaria de ser uma restrição do banco e passaria a exigir um protocolo de reserva distribuída. A troca é uma constraint por um problema.

## 4. Modelo de domínio

**Evento** é a unidade de venda. Nasce como rascunho a partir de um item do catálogo externo, carrega os dados do espetáculo e do local como atributos próprios, e só passa a existir publicamente quando publicado.

**Setor** (`ticket_tier`) é onde vive o estoque. Cada evento tem um ou mais, com nome, preço e capacidade próprios. O sistema vende por setor e quantidade, não por assento identificado: não há mapa, não há escolha de posição, e o lugar recebe apenas um rótulo sequencial no momento da emissão.

**Pedido** é a reserva. Nasce ocupando estoque e com prazo de validade. É a entidade que carrega a intenção de compra enquanto o pagamento não acontece, e é o que garante que quem está no checkout não perca o lugar para quem chegou depois.

**Pagamento** é a tentativa de autorização. Um pedido pode acumular várias, e cada recusa é uma linha, não um estado terminal do pedido.

**Ingresso** só existe depois do pagamento aprovado. Nasce com dono, com setor e com rótulo de lugar. Não existe ingresso sem comprador em nenhum momento do ciclo de vida.

**Link de compartilhamento** é uma credencial secundária, revogável, apontando para um ingresso.

**Atribuição de portaria** liga um usuário de portaria a um evento específico. É o que permite o veredito de evento errado e o que impede que a portaria de um evento enxergue o acervo de outro.

**Tentativa de validação** é o registro de auditoria de tudo que passou pelo leitor, inclusive o que falhou.

### Uma decisão que atravessa o modelo

O estoque é um contador no setor, não um conjunto de linhas de ingresso pré-criadas.

A alternativa seria materializar todos os ingressos de um evento no momento da criação, com dono nulo, e vender fazendo transição de estado em uma linha livre. Ela dá unicidade de graça, mas gera milhares de linhas por evento, transforma cancelamento em reconciliação e obriga o modelo a admitir ingresso sem comprador.

Com contador, o número de linhas acompanha as vendas reais, o cancelamento é um decremento, e o ingresso nasce sempre completo. A unicidade que a outra abordagem daria de graça é obtida com uma restrição de tabela, que é mais barata e mais explícita.

## 5. Modelo de dados

Todas as tabelas usam identificador `uuid` gerado pelo banco e carregam `created_at` e `updated_at` em `timestamptz`. Valores monetários são inteiros de centavos.

`gen_random_uuid()` é nativo desde o PostgreSQL 13. A única extensão exigida é `citext`, usada no e-mail para que a comparação ignore caixa sem espalhar `lower()` pelas consultas.

### Enumerações

```
user_role      ORGANIZER | CUSTOMER | GATE
event_status   DRAFT | PUBLISHED | CANCELLED
order_status   PENDING | PAID | EXPIRED | CANCELLED
ticket_status  VALID | USED | CANCELLED
```

O pedido não tem estado de recusa. Uma autorização negada é uma linha em `payments`; o pedido permanece pendente com o estoque reservado até o prazo vencer.

### Tabelas

**users**: `name`, `email` (citext, único), `password_hash`, `role`.

**events**: `organizer_id`, `status`, `title`, `description`, `category`, `image_url`, `starts_at`, `timezone`, `venue_name`, `address`, `city`, `state`, `country`, `external_source`, `external_id`, `external_snapshot` (jsonb), `snapshot_at`. Índices em `(status, starts_at)`, em `(category)` restrito aos publicados, e em `(organizer_id)`.

O local vive como atributo do evento, sem entidade própria. Capacidade não pertence ao endereço: o mesmo ginásio abre configurações diferentes para espetáculos diferentes, então capacidade pertence ao setor do evento.

**ticket_tiers**: `event_id`, `name`, `price_cents`, `capacity`, `allocated`, `issued_seq`. Único em `(event_id, name)`. Restrições garantindo preço não negativo, capacidade positiva e `allocated` entre zero e a capacidade.

Os dois contadores existem porque medem coisas diferentes. `allocated` mede ocupação e oscila nos dois sentidos, subindo na reserva e descendo na expiração ou no cancelamento. `issued_seq` numera ingressos emitidos e é monotônico. Derivar o rótulo do lugar de `allocated` produziria colisão: um pedido pago e depois cancelado deixaria ingressos cancelados ocupando os primeiros rótulos, e a emissão seguinte tentaria reutilizá-los.

**orders**: `event_id`, `customer_id`, `status`, `total_cents`, `idempotency_key` (único), `hold_expires_at`, `paid_at`. Índice parcial em `(status, hold_expires_at)` para os pendentes, e índice em `(customer_id, created_at desc)` para a listagem do cliente.

**order_items**: `order_id`, `tier_id`, `quantity`, `unit_price_cents`. O preço é copiado no momento da reserva; alteração posterior no setor não muda pedido já feito.

**payments**: `order_id`, `status`, `card_last4`, `decline_reason`, `idempotency_key` (único). Uma linha por tentativa, aprovada ou recusada.

**tickets**: `order_id`, `event_id`, `tier_id`, `holder_user_id`, `seat_label`, `status`, `used_at`, `used_by`. Único em `(tier_id, seat_label)`. Restrição de coerência exigindo que `used_at` esteja preenchido exatamente quando o status é usado.

**share_links**: `ticket_id`, `token_hash` (único), `expires_at`, `revoked_at`, `opened_count`, `last_opened_at`. O token nunca é armazenado em claro.

**gate_assignments**: chave composta de usuário e evento.

**validation_attempts**: `event_id`, `gate_user_id`, `ticket_id` (nulo quando o código não resolve), `result`, `code_prefix`. Índice em `(event_id, created_at desc)`.

O log guarda o payload sem o segmento de assinatura. Registrar o código íntegro transformaria a auditoria em um repositório de credenciais reutilizáveis, já que uma leitura recusada por evento errado envolve um ingresso ainda válido em outro lugar.

### Invariantes delegadas ao banco

| Invariante                            | Mecanismo                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Ocupação nunca excede a capacidade    | Restrição de intervalo em `allocated`, mais a condição na cláusula `where` do incremento |
| Ingresso validado uma única vez       | Atualização condicional pelo status, com decisão pela contagem de linhas afetadas        |
| Reserva e cobrança não duplicadas     | Unicidade da chave de idempotência em `orders` e `payments`                              |
| Ingresso usado sempre com hora de uso | Restrição de coerência entre `status` e `used_at`                                        |
| Rótulo de lugar único dentro do setor | Unicidade em `(tier_id, seat_label)`                                                     |

A escolha de colocar essas garantias no banco não é estilística. As três primeiras são condições de corrida, e qualquer verificação feita em código antes da escrita deixa uma janela entre a leitura e a decisão. Restrições e escritas condicionais fecham essa janela sem lock explícito, sobrevivem a mais de uma instância da aplicação e continuam valendo para qualquer caminho de acesso, inclusive intervenção manual no banco.

## 6. Ciclos de vida

**Pedido.** Nasce pendente com prazo de dez minutos, ocupando estoque. Segue para pago quando uma autorização é aprovada, para expirado quando o prazo vence sem aprovação, ou para cancelado por ação do cliente sobre um pedido já pago. Autorização recusada não altera o estado: a reserva continua viva e o cliente pode tentar outro cartão sem perder o lugar.

**Ingresso.** Nasce válido junto com a aprovação do pagamento. Segue para usado na primeira validação bem sucedida, ou para cancelado quando o pedido é cancelado. Não retorna de usado.

**Evento.** Nasce rascunho, torna-se publicado por ação do organizador, pode ser cancelado. Apenas eventos publicados aparecem na listagem pública e aceitam compra.

Transições são comandos, expostos como rotas de ação, e não como atualização do recurso com o estado desejado no corpo. Isso mantém a validação da máquina de estados concentrada em um ponto por transição, torna a autorização direta de expressar e produz auditoria como consequência natural em vez de esforço adicional.

### Comportamento nos caminhos infelizes

| Situação                                     | Resultado                                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Autorização recusada                         | Tentativa registrada com o motivo, pedido segue pendente, estoque preservado até o prazo vencer       |
| Prazo vencido sem pagamento                  | Pedido expira e o estoque retorna ao setor                                                            |
| Dois clientes disputando o último lugar      | O incremento condicional serializa na linha do setor e o segundo recebe esgotado                      |
| Ingresso apresentado duas vezes              | A segunda atualização não afeta linha nenhuma; o veredito informa hora e operador da primeira leitura |
| Ingresso de outro evento                     | Comparação com o evento da sessão de portaria produz veredito específico, sem consumir o ingresso     |
| Ingresso de pedido cancelado                 | Veredito próprio, distinto de inválido                                                                |
| Assinatura adulterada ou de outra chave      | Recusado antes de qualquer consulta ao banco                                                          |
| Cancelamento de pedido com ingresso já usado | Recusado, o que também impede violar a restrição de coerência                                         |
| Cancelamento após o início do evento         | Recusado                                                                                              |

## 7. Fluxos críticos

### Reserva

A criação do pedido acontece em uma transação única.

O pedido é inserido primeiro, com a chave de idempotência e total zerado. Conflito na unicidade significa requisição repetida, e a resposta é o pedido que já existe. Inserir antes de alocar evita que uma repetição consuma estoque que precisará ser devolvido.

Os itens são ordenados por identificador de setor antes do laço de alocação. Sem essa ordenação, dois pedidos que tocam os mesmos dois setores em ordens opostas podem se bloquear mutuamente.

Cada item incrementa a ocupação com a condição embutida na escrita:

```sql
update ticket_tiers
   set allocated = allocated + $2, updated_at = now()
 where id = $1
   and event_id = $3
   and allocated + $2 <= capacity
returning price_cents
```

O incremento adquire lock exclusivo na linha do setor, de modo que transações concorrentes sobre o mesmo setor serializam e a segunda enxerga o valor já atualizado pela primeira. Como a condição está na cláusula `where`, não existe intervalo entre ler a disponibilidade e decidir sobre ela. Nenhuma linha afetada significa esgotado, e a transação inteira é abortada, devolvendo o que já havia sido alocado nos itens anteriores do mesmo pedido. A restrição de intervalo na tabela permanece como segunda linha de defesa, independente do código.

Nenhuma linha de ingresso é tocada nesta etapa.

### Pagamento e emissão

Também em transação única, e a ordem das operações é significativa.

A tentativa é inserida em `payments` primeiro, tratando conflito de chave como leitura da tentativa anterior. Consultar antes de inserir reintroduziria exatamente a corrida que a idempotência existe para eliminar: duas requisições simultâneas não enxergam uma à outra na consulta, ambas prosseguem, e a segunda falha com erro de restrição em vez de devolver o resultado da primeira.

A linha do pedido é travada antes da releitura de estado e prazo. Se a rotina de expiração estiver em curso, o lock faz esperar e a releitura observa o pedido já expirado, em vez de autorizar um pagamento sobre estoque devolvido.

A autorização simulada é determinística e derivada do número do cartão: falha de dígito verificador produz número inválido, uma pequena lista de números conhecidos produz motivos distintos de recusa, e qualquer outro número válido aprova. Determinismo aqui não é detalhe de implementação, é requisito de verificabilidade: o caminho da recusa precisa ser reproduzível por quem avalia.

Recusa encerra o fluxo com o registro da tentativa. Aprovação emite um ingresso por unidade de cada item, obtendo o rótulo do lugar do contador monotônico do setor, e marca o pedido como pago. Emissão e mudança de estado ocorrem na mesma transação da autorização, o que elimina a possibilidade de um pedido pago sem ingressos.

### Expiração

A liberação de estoque de reservas vencidas acontece por duas vias complementares, porque a aplicação hiberna e um temporizador em processo hiberna junto.

Há um intervalo periódico no processo, e a mesma rotina é acionada de forma preguiçosa no início de cada nova reserva, o que garante liberação mesmo quando a instância acabou de acordar.

A varredura seleciona pedidos vencidos com `for update skip locked`, agrega as quantidades por setor, devolve a ocupação e marca os pedidos como expirados, tudo em um comando. O `skip locked` é o que impede que duas execuções simultâneas devolvam o mesmo estoque duas vezes.

### Cancelamento

Opera com sinal invertido em relação à reserva, devolvendo ocupação e marcando os ingressos como cancelados. Exige que o pedido esteja pendente ou pago, que nenhum ingresso dele tenha sido usado, e que o evento ainda não tenha começado. A segunda precondição é também o que impede violar a restrição de coerência entre estado e hora de uso.

### Validação

A cadeia de verificação vai do mais barato ao mais caro e interrompe no primeiro erro: formato do payload, assinatura, existência do ingresso, pertencimento ao evento da sessão, reivindicação atômica, e por fim, quando a reivindicação não afeta linha alguma, releitura para distinguir já utilizado de cancelado.

Apenas a reivindicação escreve. A decisão não é tomada pela leitura anterior, mas pela própria escrita condicional: se ela não afeta linha nenhuma, o ingresso já havia sido consumido, e nenhuma ordem de chegada, latência de rede ou concorrência entre dois leitores altera esse resultado.

Toda tentativa é registrada, inclusive as que falham, o que alimenta a lista de leituras recentes exibida na tela de portaria.

## 8. Segurança

### Autenticação

Senha com bcrypt. Sessão em token assinado com validade de doze horas, entregue ao browser como cookie HttpOnly definido pelo BFF. Não há refresh rotativo.

O cadastro público cria apenas clientes. Contas de organizador e de portaria têm origem administrativa: as primeiras vêm do seed, e as de portaria são criadas pelo organizador e atribuídas a eventos específicos. Isso elimina a possibilidade de escalada por autocadastro e evita a construção artificial de um seletor de papel na tela de registro.

### Autorização

Quatro camadas, aplicadas na definição das rotas e não no corpo dos handlers: exigir sessão, exigir papel, exigir posse do evento, exigir atribuição de portaria ao evento.

| Ação                           | Organizador      | Cliente  | Portaria   |
| ------------------------------ | ---------------- | -------- | ---------- |
| Buscar no catálogo externo     | sim              | não      | não        |
| Criar, editar, publicar evento | próprios         | não      | não        |
| Listar eventos publicados      | sim              | sim      | atribuídos |
| Comprar e pagar                | não              | sim      | não        |
| Ver ingresso, gerar link       | não              | próprios | não        |
| Validar ingresso               | não              | não      | atribuídos |
| Ver log de validações          | próprios eventos | não      | atribuídos |

Acesso a recurso de outro organizador responde como inexistente, e não como proibido. Responder proibido confirmaria a existência do recurso a quem não deveria saber dela.

### O código do ingresso

O payload é composto por marcador de versão, identificador do ingresso sem separadores, e assinatura HMAC-SHA256 truncada, codificada em base64url. A chave de assinatura é distinta da chave de sessão. Nenhum dado pessoal é transportado.

Três propriedades do desenho merecem explicação.

**O código não é uma URL.** Se o QR apontasse para um endereço que executa a validação, o aplicativo nativo de câmera de qualquer celular abriria esse endereço automaticamente, o próprio comprador consumiria o ingresso em casa, e prévias de link em aplicativos de mensagem fariam o mesmo. O payload é opaco e quem executa a validação é a tela autenticada de portaria, por requisição explícita.

**O código é curto.** Cerca de sessenta caracteres mantêm o símbolo em versão baixa, com módulos maiores e leitura mais tolerante, o que importa quando a captura é de uma tela de celular com reflexo, por uma câmera qualquer.

**A assinatura não é a garantia de uso único.** Ela é um filtro barato que rejeita payload forjado ou malformado antes de qualquer consulta ao banco. Quem garante uso único é a escrita condicional. Um identificador aleatório de alta entropia ofereceria segurança prática equivalente; a assinatura adiciona a possibilidade de rejeitar lixo sem custo de consulta.

### Compartilhamento

O link é uma credencial secundária, com token aleatório de trinta e dois bytes armazenado como hash, com expiração, revogação e contagem de aberturas. Gerar um novo link revoga o anterior.

A propriedade que o desenho assume explicitamente é que o link entrega o ingresso: quem o possui pode apresentá-lo, e se duas pessoas o fizerem, a primeira leitura vence. Essa consequência é comunicada na interface, não apenas na documentação, e a revogação existe justamente para dar controle sobre ela.

## 9. Integração com o catálogo externo

A integração é isolada atrás de uma interface com duas operações, buscar e obter por identificador, e um formato de item normalizado. Trocar ou acrescentar uma fonte significa registrar outra implementação, sem que nada fora do módulo perceba.

Três camadas de proteção operam em sequência: cache em memória com chave por fonte, termo e página, expirando em dez minutos; tempo limite curto com uma tentativa adicional; e conjunto de dados local usado quando a chamada falha ou quando a credencial não está configurada, com a resposta marcada como degradada e sinalização discreta na interface do organizador.

O cache é de processo, e não externo, porque há uma instância única. Um cache compartilhado passa a ser necessário no momento em que existir a segunda, e não antes.

Na criação do evento, o item completo é preservado em `external_snapshot`, os campos utilizados tornam-se colunas, e o instante da captura é registrado. A partir daí a exibição, a venda e a validação daquele evento não dependem mais da API externa. Os valores digitados pelo organizador prevalecem sobre o que veio importado, porque a definição de data, local, capacidade e preço é atribuição dele e não da fonte.

## 10. Contrato de API

| Método | Rota                     | Papel       | Função                                                      |
| ------ | ------------------------ | ----------- | ----------------------------------------------------------- |
| POST   | `/auth/register`         | público     | cria cliente                                                |
| POST   | `/auth/login`            | público     | autentica e devolve token                                   |
| POST   | `/auth/logout`           | autenticado | encerra sessão                                              |
| GET    | `/auth/me`               | autenticado | usuário corrente                                            |
| GET    | `/catalog/search`        | organizador | busca no catálogo externo                                   |
| POST   | `/events`                | organizador | cria evento com snapshot e setores                          |
| PATCH  | `/events/:id`            | dono        | edita rascunho                                              |
| POST   | `/events/:id/publish`    | dono        | publica                                                     |
| POST   | `/events/:id/cancel`     | dono        | cancela                                                     |
| POST   | `/events/:id/gate-users` | dono        | cria ou atribui portaria                                    |
| GET    | `/events`                | público     | lista publicados, com `q`, `category`, `city`, `from`, `to` |
| GET    | `/events/:id`            | público     | detalhe com setores e disponibilidade                       |
| GET    | `/organizer/events`      | organizador | painel com vendas por setor                                 |
| POST   | `/orders`                | cliente     | reserva estoque                                             |
| GET    | `/orders/:id`            | dono        | estado e itens                                              |
| POST   | `/orders/:id/payment`    | dono        | autoriza e emite                                            |
| POST   | `/orders/:id/cancel`     | dono        | cancela e devolve estoque                                   |
| GET    | `/me/tickets`            | cliente     | ingressos do usuário                                        |
| GET    | `/tickets/:id`           | dono        | ingresso com payload do código                              |
| POST   | `/tickets/:id/share`     | dono        | gera link                                                   |
| DELETE | `/tickets/:id/share`     | dono        | revoga link                                                 |
| GET    | `/share/:token`          | público     | ingresso compartilhado                                      |
| GET    | `/gate/events`           | portaria    | eventos atribuídos                                          |
| POST   | `/gate/validate`         | portaria    | valida ingresso no evento informado                         |
| GET    | `/gate/log`              | portaria    | tentativas recentes                                         |
| GET    | `/health`                | público     | estado do serviço                                           |

Erros seguem um envelope único, com código estável em maiúsculas que a interface usa para escolher a mensagem, mais uma descrição legível e um objeto de detalhes.

Os vereditos de portaria não trafegam como erro. Já utilizado, evento errado e cancelado são respostas corretas de um sistema funcionando, retornadas com status de sucesso e um campo de veredito. Tratá-los como falha de requisição obrigaria a interface a derivar semântica de negócio de códigos de transporte.

A busca de eventos usa correspondência simples sobre título e nome do local, restrita aos publicados, combinada com filtros de cidade e período. O volume envolvido não justifica índice invertido, e o padrão de consulta predominante é nome próprio digitado parcialmente, que busca textual com radicalização atende pior que correspondência direta.

## 11. Operação

**Hibernação.** A aplicação é suspensa após quinze minutos sem tráfego e leva até um minuto para responder novamente. Isso é mitigado por um acionamento externo periódico do endpoint de saúde, e comunicado na documentação, já que a alternativa é o comportamento ser interpretado como falha.

O endpoint de saúde expõe o instante de início do processo, o que permite distinguir, sem acesso a logs, uma instância estável de uma que acabou de subir.

**Rotina de migração.** Executa no início do processo, antes da abertura da porta, porque o plano de hospedagem não oferece fase de release separada.

**Fuso horário.** Instantes são armazenados com fuso, e o evento carrega o fuso do local. A conversão entre horário de parede informado pelo organizador e instante armazenado acontece em um único ponto do servidor, porque é a fonte mais comum de erro silencioso neste domínio.

### Modos de falha e resposta

| Falha                                         | Resposta do sistema                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Catálogo externo indisponível ou limitado     | Cache e conjunto local assumem, com resposta marcada como degradada                             |
| Instância hibernada no primeiro acesso        | Acionamento externo periódico reduz a incidência, e o limite de execução do BFF tolera a espera |
| Câmera indisponível ou sem permissão          | Entrada manual de código sempre presente na tela                                                |
| Bloqueio mútuo entre pedidos multi-setor      | Ordenação determinística dos itens antes da alocação                                            |
| Duas execuções simultâneas da expiração       | `skip locked` na seleção dos pedidos vencidos                                                   |
| Requisição duplicada por rede ou duplo clique | Unicidade da chave de idempotência em reserva e pagamento                                       |

## 12. Estratégia de testes

A cobertura é deliberadamente estreita e concentrada nos comportamentos que sustentam as invariantes.

Concorrência de venda: um setor com dez lugares submetido a trinta compras simultâneas resulta em exatamente dez aprovações, vinte recusas por esgotamento, ocupação em dez e dez ingressos persistidos.

Validação dupla: o mesmo código submetido duas vezes em paralelo produz uma aprovação e um já utilizado, com a hora de uso preenchida uma única vez.

Código forjado: assinatura alterada e assinatura produzida com outra chave são rejeitadas antes da consulta.

Autorização: papel incorreto é recusado, recurso de outro organizador responde como inexistente, e ingresso de evento diferente do selecionado produz o veredito específico.

Os testes sobem a aplicação sem abrir porta, o que é o motivo de a montagem do Express estar separada da abertura do servidor.

## 13. Decisões e alternativas descartadas

**Monólito modular em vez de serviços separados.** As fronteiras existem e são respeitadas, mas a separação física transformaria a garantia central em problema distribuído, trocando uma restrição de banco por uma saga com compensação.

**Emissão síncrona em vez de mensageria.** Publicar a intenção de compra e consumir de forma assíncrona é o desenho correto quando faturamento e emissão precisam ser desacoplados. Aqui ambos ocorrem na mesma requisição, e o desacoplamento exigiria que a interface esperasse por um resultado que já poderia ter entregue, além de acrescentar um componente à operação. A chave de idempotência do pagamento já é exatamente o contrato que um consumidor usaria.

**Cache em processo em vez de cache externo.** Com instância única, um cache compartilhado adicionaria um serviço, uma credencial e um modo de falha para resolver um problema que não existe.

**Consulta periódica em vez de canal de eventos.** Atualização em tempo real da disponibilidade otimiza carga de servidor, que este sistema não tem, e o efeito percebido pelo usuário é indistinguível.

**Venda por setor em vez de mapa de assentos.** Exercita a mesma concorrência com uma fração do custo de interface, e permitiu que o fluxo obrigatório ficasse completo.

**Fonte única de catálogo.** Uma segunda fonte não cobre requisito adicional e amplia superfície de falha. A interface do provedor deixa o encaixe pronto.

**Express em vez de framework com injeção de dependência.** A dificuldade deste sistema é transacional, não estrutural, e a estrutura que um framework imporia é obtida aqui por convenção com custo menor.

**Sessão simples em vez de refresh rotativo.** A rotação é o desenho correto e foi omitida conscientemente, com validade de doze horas cobrindo o uso previsto.

**Local como atributo do evento.** Com um evento por local, a normalização não se paga, e a capacidade pertence à configuração do espetáculo e não ao endereço.

**Sem versionamento do código do ingresso.** A coluna e a verificação correspondentes só se justificam com uma operação de reemissão, que não existe.

**Correspondência simples em vez de busca textual indexada.** Com este volume o otimizador ignoraria o índice, e o padrão de consulta é atendido pior por radicalização.

## 14. Limitações conhecidas

A aplicação hiberna, e o primeiro acesso após inatividade é lento.

Não há rotação de credencial de sessão.

A disponibilidade exibida não se atualiza sozinha enquanto a página está aberta.

Não existe transferência de titularidade, apenas compartilhamento de acesso.

O contador de ocupação é uma linha quente por setor: sob concorrência real e sustentada em um mesmo evento, ele se torna ponto de serialização, e a evolução natural seria particionar o estoque em faixas.

Não há reemissão de código de ingresso, o que significa que uma captura de tela do QR permanece apresentável enquanto o ingresso não for consumido.
