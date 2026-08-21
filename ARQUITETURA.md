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

`gen_random_uuid()` é nativo desde o PostgreSQL 13. Duas extensões são exigidas: `citext`, usada no e-mail para que a comparação ignore caixa sem espalhar `lower()` pelas consultas, e `unaccent`, usada na busca pública para que a comparação ignore acento. Sem ela, quem digita "metropole" não encontra "Metrópole", o que num acervo em português é a consulta comum e não a exceção. A extensão normaliza os dois lados da comparação, junto com `lower()` para a caixa, e não altera a decisão de manter correspondência simples, sem índice invertido e sem busca textual.

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

**Pedido.** Nasce pendente com prazo de dez minutos, ocupando estoque. Segue para pago quando uma autorização é aprovada, para expirado quando o prazo vence sem aprovação, ou para cancelado por ação do dono sobre um pedido pendente ou pago. Autorização recusada não altera o estado: a reserva continua viva e o cliente pode tentar outro cartão sem perder o lugar.

**Ingresso.** Nasce válido junto com a aprovação do pagamento. Segue para usado na primeira validação bem sucedida, ou para cancelado junto com o cancelamento do pedido. Não retorna de usado, e é por isso que um pedido com ingresso já utilizado não pode ser cancelado.

O cancelamento é a única transição que devolve ocupação ao estoque, e por isso é a única em que a escrita do pedido, a dos ingressos e a do setor precisam acontecer na mesma transação. Quem cancela é o dono do pedido, nunca o organizador: cancelar o evento é outra transição, com outra rota, e não desfaz pedidos.

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

A ordem é travar a linha do pedido, validar que ele é pagável, autorizar, e só então gravar a tentativa em `payments`. Travar antes da releitura de estado e prazo é o que faz uma rotina de expiração em curso ser esperada: o lock segura, e a releitura observa o pedido já expirado, em vez de autorizar um pagamento sobre estoque devolvido. Validar antes de escrever é o que impede que uma tentativa contra pedido inexistente, alheio ou vencido chegue a escrever linha alguma.

A gravação da tentativa continua sendo inserção com tratamento de conflito, nunca consulta seguida de decisão de inserir. Consultar para decidir reintroduziria exatamente a corrida que a idempotência existe para eliminar: duas requisições simultâneas não enxergam uma à outra na consulta, ambas prosseguem, e a segunda falha com erro de restrição em vez de devolver o resultado da primeira. Com a validação antes, a serialização de duas requisições da mesma chave passa a acontecer no lock da linha do pedido, e a unicidade da chave permanece como árbitro final.

Há uma consulta pela chave no caminho em que o pedido não é pagável, e ela não contradiz a regra acima. Sem ela, uma repetição legítima chegando depois que a primeira já marcou o pedido como pago receberia recusa por estado em vez do resultado que ela mesma produziu. Essa consulta roda com o lock da linha do pedido já adquirido, de modo que nenhuma tentativa concorrente daquele pedido está em curso, e ela não decide se escreve: decide o que responder num caminho onde já foi decidido não escrever.

A autorização simulada é determinística e derivada do número do cartão: falha de dígito verificador produz número inválido, uma pequena lista de números conhecidos produz motivos distintos de recusa, e qualquer outro número válido aprova. Determinismo aqui não é detalhe de implementação, é requisito de verificabilidade: o caminho da recusa precisa ser reproduzível por quem avalia.

Recusa encerra o fluxo com o registro da tentativa. Aprovação emite um ingresso por unidade de cada item, obtendo o rótulo do lugar do contador monotônico do setor, e marca o pedido como pago. Emissão e mudança de estado ocorrem na mesma transação da autorização, o que elimina a possibilidade de um pedido pago sem ingressos.

### Expiração

A liberação de estoque de reservas vencidas acontece por duas vias complementares, porque a aplicação hiberna e um temporizador em processo hiberna junto.

Há um intervalo periódico no processo, e a mesma rotina é acionada de forma preguiçosa no início de cada nova reserva, o que garante liberação mesmo quando a instância acabou de acordar.

A varredura seleciona pedidos vencidos com `for update skip locked`, agrega as quantidades por setor, devolve a ocupação e marca os pedidos como expirados, tudo em um comando. O `skip locked` é o que impede que duas execuções simultâneas devolvam o mesmo estoque duas vezes.

### Cancelamento

Opera com sinal invertido em relação à reserva, devolvendo ocupação e marcando os ingressos como cancelados. Exige que o pedido esteja pendente ou pago, que nenhum ingresso dele tenha sido usado, e que o evento ainda não tenha começado. A segunda precondição é também o que impede violar a restrição de coerência entre estado e hora de uso.

A linha do pedido é travada antes de qualquer decisão, como no pagamento, e as três escritas seguem na mesma transação: os ingressos válidos viram cancelados, os setores recebem de volta a quantidade dos itens, travados em ordem de id, e o pedido vira cancelado. A precondição do ingresso usado não é uma leitura anterior à escrita: os ingressos são cancelados com a condição `status = 'VALID'` embutida, e só depois se conta quantos ficaram usados. Se houver algum, a transação inteira é desfeita. Uma validação de portaria simultânea ou vence a corrida, e o cancelamento é recusado sem ter mudado nada, ou espera a trava e encontra o ingresso já cancelado, respondendo o veredito de cancelado.

### Validação

A cadeia de verificação vai do mais barato ao mais caro e interrompe no primeiro erro: formato do payload, assinatura, existência do ingresso, pertencimento ao evento da sessão, reivindicação atômica, e por fim, quando a reivindicação não afeta linha alguma, releitura para distinguir já utilizado de cancelado.

Apenas a reivindicação escreve. A decisão não é tomada pela leitura anterior, mas pela própria escrita condicional: se ela não afeta linha nenhuma, o ingresso já havia sido consumido, e nenhuma ordem de chegada, latência de rede ou concorrência entre dois leitores altera esse resultado.

Toda tentativa é registrada, inclusive as que falham, o que alimenta a lista de leituras recentes exibida na tela de portaria. O prefixo guardado é o payload sem o último segmento, e fica vazio quando a leitura não tem os três segmentos: sem estrutura reconhecível não há segmento de assinatura a separar, e gravar a entrada crua arriscaria justamente o que a regra evita. A operadora que apresentou o código continua registrada, então uma sequência de leituras ilegíveis num mesmo portão permanece visível na auditoria.

Estar atribuído ao evento é condição de entrada, e não um veredito: a portaria que não trabalha aquele evento recebe recurso não encontrado, como o organizador recebe para evento alheio, e a tentativa não entra no log daquele evento. O contrário permitiria a quem não foi atribuído escrever linhas na auditoria de qualquer evento.

Os dados do ingresso só voltam quando ele pertence ao evento em validação. O veredito de evento errado responde sem lugar nem setor, porque a operadora não precisa deles para recusar a entrada, e informá-los exporia dados de um evento em cuja portaria ela não trabalha.

### Compartilhamento

Gerar e revogar link travam a linha do ingresso antes de decidir, como a reserva serializa na linha do setor e o pagamento na linha do pedido: sem esse ponto comum, uma revogação concorrente a uma geração não enxerga a linha que a outra transação acabou de inserir e deixa vivo um link que o dono considera substituído.

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

O token em claro existe uma única vez, na resposta da geração. Nenhuma leitura posterior o devolve, nem a do dono nem qualquer outra, e isso não é uma regra de contrato que alguém possa relaxar depois: o banco guarda só o hash, então não há de onde recuperá-lo. Quem perdeu o link gera outro, e a geração revoga o anterior, que é a consequência correta de tratar o token como credencial e não como identificador.

A leitura do ingresso pelo dono devolve o estado do link ativo, quando existe: prazo de validade, número de aberturas e instante da última. É o que a tela precisa para escolher entre oferecer geração e oferecer revogação, sem uma segunda chamada e sem gerar um link só para descobrir que já havia um, o que revogaria justamente o que estava em uso. Ativo aqui significa não revogado e dentro do prazo, exatamente a condição que a abertura pública verifica, para que a tela do dono nunca anuncie um link que o portador já não consegue abrir.

O link aponta para `/ingresso/<token>` no front, rota pública que consome `GET /share/:token`. É o endereço que o seed imprime, montado com `WEB_URL`, e por isso a rota do front está fixada aqui e não só no código da página.

A propriedade que o desenho assume explicitamente é que o link entrega o ingresso: quem o possui pode apresentá-lo, e se duas pessoas o fizerem, a primeira leitura vence. Essa consequência é comunicada na interface, não apenas na documentação, e a revogação existe justamente para dar controle sobre ela.

## 9. Integração com o catálogo externo

A integração é isolada atrás de uma interface com duas operações, buscar e obter por identificador, e um formato de item normalizado. Trocar ou acrescentar uma fonte significa registrar outra implementação, sem que nada fora do módulo perceba.

Três camadas de proteção operam em sequência: cache em memória com chave por fonte, termo e página, expirando em dez minutos; tempo limite curto com uma tentativa adicional; e conjunto de dados local usado quando a chamada falha ou quando a credencial não está configurada, com a resposta marcada como degradada e sinalização discreta na interface do organizador.

O cache é de processo, e não externo, porque há uma instância única. Um cache compartilhado passa a ser necessário no momento em que existir a segunda, e não antes.

Na criação do evento, o item completo é preservado em `external_snapshot`, os campos utilizados tornam-se colunas, e o instante da captura é registrado. A partir daí a exibição, a venda e a validação daquele evento não dependem mais da API externa. Os valores digitados pelo organizador prevalecem sobre o que veio importado, porque a definição de data, local, capacidade e preço é atribuição dele e não da fonte.

## 10. Contrato de API

| Método | Rota                               | Papel       | Função                                                      |
| ------ | ---------------------------------- | ----------- | ----------------------------------------------------------- |
| POST   | `/auth/register`                   | público     | cria cliente                                                |
| POST   | `/auth/login`                      | público     | autentica e devolve token                                   |
| POST   | `/auth/logout`                     | autenticado | encerra sessão                                              |
| GET    | `/auth/me`                         | autenticado | usuário corrente                                            |
| GET    | `/catalog/search`                  | organizador | busca no catálogo externo                                   |
| POST   | `/organizer/events`                | organizador | cria evento com snapshot e setores                          |
| GET    | `/organizer/events`                | organizador | painel com vendas por setor                                 |
| GET    | `/organizer/events/:id`            | dono        | detalhe do próprio evento, inclusive rascunho               |
| PATCH  | `/organizer/events/:id`            | dono        | edita rascunho                                              |
| POST   | `/organizer/events/:id/publish`    | dono        | publica                                                     |
| POST   | `/organizer/events/:id/cancel`     | dono        | cancela                                                     |
| POST   | `/organizer/events/:id/gate-users` | dono        | cria ou atribui portaria                                    |
| GET    | `/events`                          | público     | lista publicados, com `q`, `category`, `city`, `from`, `to` |
| GET    | `/events/cities`                   | público     | cidades distintas dos eventos publicados, para o seletor    |
| GET    | `/events/:id`                      | público     | detalhe com setores e disponibilidade                       |
| POST   | `/orders`                          | cliente     | reserva estoque                                             |
| GET    | `/orders/:id`                      | dono        | estado, itens e, quando pago, os ingressos emitidos         |
| POST   | `/orders/:id/payment`              | dono        | autoriza e emite                                            |
| POST   | `/orders/:id/cancel`               | dono        | cancela, devolve estoque e invalida os ingressos            |
| GET    | `/me/tickets`                      | cliente     | ingressos do usuário                                        |
| GET    | `/tickets/:id`                     | dono        | ingresso com payload do código e estado do link ativo       |
| POST   | `/tickets/:id/share`               | dono        | gera link                                                   |
| DELETE | `/tickets/:id/share`               | dono        | revoga link                                                 |
| GET    | `/share/:token`                    | público     | ingresso compartilhado                                      |
| GET    | `/gate/events`                     | portaria    | eventos atribuídos, com o status, sem filtrar               |
| POST   | `/gate/validate`                   | portaria    | valida ingresso no evento informado                         |
| GET    | `/gate/log`                        | portaria    | tentativas recentes                                         |
| GET    | `/health`                          | público     | estado do serviço                                           |

Erros seguem um envelope único, com código estável em maiúsculas que a interface usa para escolher a mensagem, mais uma descrição legível e um objeto de detalhes.

`PAYMENT_DECLINED` responde 402, e não 409 como os demais códigos de negócio, com o motivo da recusa em `details`. Recusa de cartão não é conflito de estado: o pedido continua exatamente como estava, válido e pagável, e a ação correta do cliente é tentar outro cartão, não recarregar para descobrir o que mudou. A interface precisa separar esse caso de `ORDER_NOT_PENDING` e `HOLD_EXPIRED`, que dizem o oposto, que o pedido deixou de aceitar pagamento.

Os vereditos de portaria não trafegam como erro. Já utilizado, evento errado e cancelado são respostas corretas de um sistema funcionando, retornadas com status de sucesso e um campo de veredito. Tratá-los como falha de requisição obrigaria a interface a derivar semântica de negócio de códigos de transporte.

A lista de eventos da portaria devolve uma projeção própria, com os campos que a tela usa mais o status, e não a projeção do catálogo público: são contratos independentes, e mudar o que o público enxerga não deve alterar em silêncio o que a portaria recebe. Ela não filtra por status, de propósito. Recusar trabalho sobre evento cancelado é decisão da tela, que tem o status em mãos e pode dizer o que houve; filtrar na leitura apagaria a diferença entre evento cancelado e ausência de atribuição, e essas duas situações pedem respostas opostas do operador. A validação não se apoia nessa lista: ela impõe suas próprias regras sobre o evento informado no corpo da requisição.

A atribuição de portaria cria conta nova ou aponta conta existente, e o corpo declara qual das duas: com nome e senha, cria; apenas com o e-mail, atribui. Nenhum ramo ignora campo enviado, porque aceitar uma senha e descartá-la faria o organizador comunicar à equipe uma credencial que não vale. Nenhum ramo altera senha ou papel de conta que já existe: sobrescrever a senha permitiria a um organizador assumir a conta de um porteiro que também trabalha para outro, e converter o papel destruiria a conta de cliente de quem usa o mesmo endereço. A atribuição em si é idempotente pela chave primária de `gate_assignments`, de modo que repetir a chamada não é erro.

A busca de eventos usa correspondência simples sobre título e nome do local, restrita aos publicados, combinada com filtros de cidade e período. O volume envolvido não justifica índice invertido, e o padrão de consulta predominante é nome próprio digitado parcialmente, que busca textual com radicalização atende pior que correspondência direta.

A correspondência é feita com `strpos` sobre os dois textos normalizados por `unaccent` e `lower`, e não com `LIKE`. A diferença não é de desempenho: `LIKE` dá significado a `%` e `_` digitados pelo usuário, e escapá-los não basta, porque `unaccent` roda depois do escape e recria metacaractere a partir de caractere comum, como o `％` de largura inteira, que ela converte em `%`. Sem padrão não existe curinga para escapar nem escape para desfazer, e "contém esta substring" já é a semântica pretendida.

O filtro de cidade é igualdade, não trecho: ele escolhe entre valores que existem no acervo, enquanto a busca por trecho é atribuição do termo livre. A consequência para a interface é que cidade se oferece como seleção, e não como campo de digitação: quem digitasse "sao paulo", "SP" ou "S. Paulo" não encontraria nada, e a lista vazia seria indistinguível de não haver evento. `GET /events/cities` existe para alimentar essa seleção, e devolve apenas cidades de eventos publicados, porque rascunho e cancelado não podem vazar nem a cidade.

A ordenação dessa lista é feita por `unaccent` do valor, e não pela collation do banco. As duas instâncias do projeto discordam: com a collation local, "São Paulo" ordena depois de "Sorocaba", e o Neon pode decidir diferente. Normalizar antes de ordenar torna a ordem a mesma nos dois. O valor devolvido continua sendo o gravado, com acento e caixa originais, porque `unaccent` serve para comparar e ordenar, nunca para exibir.

## 11. Operação

**Hibernação.** A aplicação é suspensa após quinze minutos sem tráfego e leva até um minuto para responder novamente. Isso é mitigado por um acionamento externo periódico do endpoint de saúde, e comunicado na documentação, já que a alternativa é o comportamento ser interpretado como falha.

O endpoint de saúde expõe o instante de início do processo, o que permite distinguir, sem acesso a logs, uma instância estável de uma que acabou de subir.

**Rotina de migração.** Executa no início do processo, antes da abertura da porta, porque o plano de hospedagem não oferece fase de release separada.

**Variáveis de ambiente.** Toda leitura de `process.env` acontece em `src/env.ts`, e a ausência de uma obrigatória derruba o processo no boot em vez de circular como `undefined`.

| Variável                | Obrigatória | Para quê                                                            |
| ----------------------- | ----------- | --------------------------------------------------------------      |
| `DATABASE_URL`          | sim         | conexão com o Postgres                                              |
| `SESSION_SECRET`        | sim         | assinatura do token de sessão                                       |
| `TICKET_SECRET`         | sim         | assinatura do código do ingresso                                    |
| `PORT`                  | não         | porta de escuta, com padrão 8080                                    |
| `NODE_ENV`              | não         | decide o modo TLS da conexão, com padrão de desenvolvimento         |
| `TICKETMASTER_API_KEY`  | não         | catálogo externo; ausente, o provedor local assume                  |
| `WEB_URL`               | não         | monta o link que o seed imprime, com padrão localhost na porta 3000 |
| `API_URL`               | sim, no BFF | endereço da API para os route handlers do Next, nunca público       |

`SESSION_SECRET` e `TICKET_SECRET` são distintas de propósito. Vazamento da chave de sessão permitiria forjar sessão, e vazamento da chave de ingresso permitiria forjar código; separá-las mantém cada consequência contida ao seu domínio, e permite trocar uma sem invalidar a outra.

**Fuso horário.** Instantes são armazenados com fuso, e o evento carrega o fuso do local. A conversão entre horário de parede informado pelo organizador e instante armazenado acontece em um único ponto do servidor, porque é a fonte mais comum de erro silencioso neste domínio.

O filtro de período da busca pública segue a mesma regra. Ele recebe data simples, sem hora, e o servidor resolve o começo e o fim do dia, com o fim inclusivo. Exigir instante completo do cliente empurraria a conversão para cada um deles e, junto com ela, o erro clássico de um fim de período à meia-noite excluir o último dia inteiro do intervalo.

O fuso de referência dessa resolução é único e fixo, e não o fuso de cada evento. Resolver no fuso do evento significaria comparar `starts_at at time zone timezone`, o que aplica função sobre a coluna, descarta o índice de `starts_at` e faz o mesmo intervalo ter limites diferentes por linha. A correção que isso compraria só apareceria em acervo espalhado por vários fusos, e aqui o padrão do evento é o mesmo fuso de referência. Se o acervo passar a cruzar fusos, a resolução por evento é o caminho de evolução.

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

O pool de conexões limita as transações simultâneas a dez, e isso muda o que esse teste demonstra. As trinta requisições chegam juntas na camada HTTP, mas o banco enxerga no máximo dez transações ativas, com as demais enfileiradas no lock da linha do setor até o lote drenar. Medição durante uma execução, amostrando `pg_stat_activity`: dez ativas e nove esperando lock, no pico.

O número não foi inflado para o teste. O mesmo limite de pool vale na instância publicada, então o que o teste exercita é a disputa que existe em produção, e não um cenário construído para parecer mais severo. Elevar o limite apenas durante o teste produziria um resultado sobre uma configuração que não existe em lugar nenhum.

Validação dupla: o mesmo código submetido duas vezes em paralelo produz uma aprovação e um já utilizado, com a hora de uso preenchida uma única vez.

Código forjado: assinatura alterada e assinatura produzida com outra chave são rejeitadas antes da consulta.

Autorização: papel incorreto é recusado, recurso de outro organizador responde como inexistente, e ingresso de evento diferente do selecionado produz o veredito específico.

Os testes sobem a própria aplicação em porta efêmera de loopback, sorteada pelo sistema, o que é o motivo de a montagem do Express estar separada da abertura do servidor. Nenhum teste depende do servidor de desenvolvimento estar de pé nem ocupa a porta configurada, e a requisição atravessa rota, validação, serviço e repositório como qualquer outra.

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

**Biblioteca para gerar o símbolo QR, em vez de implementar o algoritmo.** É a única dependência de terceiro no front além do próprio framework, e foi autorizada caso a caso. O que ela faz é uma coisa só: recebe a cadeia e devolve uma matriz de booleanos. O desenho é do projeto, e é isso que permite a zona de silêncio explícita, o fundo opaco que sobrevive ao tema escuro do sistema, e a marcação de estado que o ingresso usado e o cancelado exigem.

Duas alternativas foram descartadas por motivos diferentes do que parece.

Serviço externo de geração saiu por segurança, não por conectividade: o payload é credencial de entrada, e mandá-lo para um gerador de imagens de terceiro entrega a quem estiver do outro lado o código que abre a catraca.

Implementar o algoritmo à mão saiu pelo modo de falha, não pela dificuldade. Gerar QR exige Reed-Solomon sobre um campo finito, informação de formato com código corretor próprio, e a escolha entre oito máscaras por regras de penalidade. Erro em qualquer uma dessas partes não produz símbolo quebrado: produz símbolo válido e pior, que lê num monitor e falha contra reflexo, em ângulo ou com foco ruim. A falha apareceria em dispositivo real, depois do teste local ter passado, que é o pior lugar para descobri-la.

**Nível de correção Q para o código do ingresso.** Para os cinquenta e oito caracteres do payload, o nível M cabe na versão 4, com trinta e três módulos de lado, e o Q exige a versão 5, com trinta e sete. Num símbolo de 320 pixels contando a zona de silêncio, isso é 7,8 contra 7,1 pixels por módulo: os dois muito acima do que qualquer câmera de celular precisa, o que torna o custo do nível maior irrelevante. O ganho não é: o ingresso é apresentado em tela iluminada, onde reflexo é oclusão, e oclusão é exatamente o que a correção de erro recupera.

**Um decodificador só na portaria, sem o detector nativo do navegador.** O `BarcodeDetector` não existe no Safari do iOS nem no Firefox, então uma biblioteca precisa existir de qualquer forma. Usá-la apenas onde o detector falta criaria dois caminhos e dois comportamentos, e o caminho que não se consegue testar aqui é justamente o que roda no aparelho de quem avalia. Com um só, o que foi testado é o que executa. O que se perde é desempenho e bateria no Chrome do Android, onde o detector nativo é mais eficiente, e a perda é aceita conscientemente: a leitura de portaria é uma pessoa apontando o celular para um símbolo, não uma esteira.

**Decodificação em trabalhador separado, a dez quadros por segundo, sobre quadro reduzido.** No processo principal a decodificação competiria com a renderização exatamente quando a fila anda, e o sintoma seria travar em uso e fluir parado. A cadência é dez por segundo porque quem segura um celular contra um ingresso não precisa de sessenta, e o quadro é reduzido a 480 pixels no lado maior porque decodificar em resolução cheia multiplica o custo sem melhorar a leitura de um símbolo que ocupa boa parte do enquadramento. O laço tem cão de guarda e trata erro do trabalhador, porque uma cadeia que só se reagenda na resposta morre em silêncio com a câmera ligada.

**A contenção da leitura repetida existe pelo log e pelo operador, não pela integridade.** Com o símbolo parado no enquadramento o decodificador acerta em todo quadro. A integridade não corre risco: a escrita condicional garante que só a primeira leitura consome o ingresso. O que a rajada estragaria é a auditoria, enchendo o log de tentativas falsas, e a leitura do veredito, que piscaria na cara do operador. A contenção é uma requisição por vez, pausa da câmera enquanto há veredito na tela, e memória do último código com carência curta, descartada quando o operador declara que quer ler de novo.

**Biblioteca que possui o laço de leitura possui a política de portaria.** Existem pacotes que entregam câmera, decodificação e laço prontos. Adotar um deles significaria terceirizar a decisão de quando disparar uma validação, que é regra de negócio desta portaria e não detalhe de decodificação. A biblioteca escolhida decodifica um quadro e nada mais; câmera, cadência, contenção e vereditos são do projeto. É a mesma fronteira usada na geração do símbolo.

**Correspondência simples em vez de busca textual indexada.** Com este volume o otimizador ignoraria o índice, e o padrão de consulta é atendido pior por radicalização.

## 14. Limitações conhecidas

A aplicação hiberna, e o primeiro acesso após inatividade é lento.

Não há rotação de credencial de sessão.

A disponibilidade exibida não se atualiza sozinha enquanto a página está aberta.

Não existe transferência de titularidade, apenas compartilhamento de acesso.

O contador de ocupação é uma linha quente por setor: sob concorrência real e sustentada em um mesmo evento, ele se torna ponto de serialização, e a evolução natural seria particionar o estoque em faixas.

Não há reemissão de código de ingresso, o que significa que uma captura de tela do QR permanece apresentável enquanto o ingresso não for consumido.

Os dados que o ingresso exibe são lidos do evento, e não copiados no momento da emissão. Isso é correto hoje porque evento publicado não aceita edição e não volta a rascunho: a condição `status = 'DRAFT'` está na cláusula `where` da própria atualização, a emissão exige pedido pago, e pedido exige evento publicado. Os dois estados não se reencontram, então não existe janela entre emitir e editar. A dependência é entre decisões, e não uma pendência: quem um dia permitir editar evento publicado precisa antes copiar título, data, fuso, local e nome do setor para o ingresso, sob pena de o comprovante passar a mostrar algo diferente do que foi vendido.

Não existe caminho na API para criar conta de organizador: o cadastro público fixa papel de cliente e não há painel administrativo. Organizadores nascem do seed. É privilégio mínimo, e não omissão, porque qualquer rota que criasse organizador seria a rota que promove a si mesmo. A consequência prática é que testar posse entre organizadores distintos exige criar a segunda conta fora da API.

Atribuir portaria informando apenas o e-mail responde de forma distinta conforme a conta exista ou não, e isso permite a um organizador descobrir se um endereço está cadastrado, testando um por vez. Responder igual nos dois casos eliminaria a distinção, mas deixaria sem resposta quem tentou atribuir uma conta que existe e não entendeu por que falhou. A troca é aceitável porque quem chama é usuário autenticado com papel de organizador, e não um anônimo: sondar exige manter uma conta identificada, e o que se descobre é a existência do endereço, sem nome, papel ou qualquer outro dado da conta.

A idempotência do seed depende do título do evento. Como `events` não tem chave natural, o seed reconhece o que já semeou procurando pelo título entre os eventos do organizador de demonstração, e renomear esse evento pela tela do organizador faz a execução seguinte criar um segundo. O seed também reagenda o evento quando a data se aproxima demais: em rascunho ele apenas move a data, e publicado ele cancela e cria outro no lugar, porque só rascunho aceita edição. O resíduo desse reparo são eventos cancelados acumulados no painel do organizador, invisíveis no catálogo público.
