# Roadmap de implementação

Ordem em que vou construir o sistema e o critério que fecha cada fase. A arquitetura está em `ARQUITETURA.md`; aqui é a sequência.

## Situação

**Fase atual: 6, acabamento.**

| Fase                                     | Estado       |
| ---------------------------------------- | ------------ |
| 1. Esqueleto publicado                   | concluída    |
| 2. Schema e sessão                       | concluída    |
| 3. Catálogo e evento                     | concluída    |
| 4. Compra                                | concluída    |
| 5. Ingresso, compartilhamento e portaria | concluída    |
| 6. Acabamento                            | em andamento |

Uma fase só passa a concluída quando o critério de conclusão dela é observável no ambiente publicado. O detalhamento do que já existe dentro da fase corrente está no README.

## Como o trabalho está organizado

Trabalho sozinho, então não existe trilha paralela de verdade. Poderia construir o backend inteiro e depois o front inteiro, mas isso deixaria fases inteiras sem nada clicável e concentraria toda a integração no fim, que é exatamente onde eu não quero descobrir problema.

Escolhi fatias verticais. Cada fase entrega um pedaço que atravessa banco, API e tela, e só considero fechada quando dá para usar de ponta a ponta. Dentro da fase o backend vem primeiro, porque o contrato define o que a tela consome, mas os dois andam juntos e nunca em fases separadas.

A consequência que me interessa: ao fim de qualquer fase existe uma versão funcionando. Nenhuma fase deixa o sistema em estado intermediário.

Cada fase abaixo tem objetivo, escopo e critério de conclusão. O critério é sempre observável, nunca "está pronto".

---

## Fase 1. Esqueleto publicado

**Objetivo.** Eliminar os desconhecidos de infraestrutura antes que exista regra de negócio por cima deles.

**Escopo.** Repositório com os dois pacotes independentes. Express com endpoint de saúde. Next com o route handler do BFF consumindo esse endpoint. Ambos publicados. Acionamento externo periódico contra a hibernação.

**Critério de conclusão.** A URL pública do front exibe a resposta da API, obtida através do BFF, com a aplicação rodando nos provedores definitivos.

**Por que primeiro.** Deploy é a parte do trabalho com mais desconhecidos e menos relação com o domínio do problema. Build no ambiente do provedor, variáveis de ambiente, comunicação entre dois serviços em domínios diferentes, contexto seguro e hibernação são indiferentes ao fato de existir ou não regra de negócio, e nenhum deles fica mais fácil de depurar com o sistema montado por cima.

A topologia também é escolhida aqui de forma a eliminar o problema mais chato dessa fronteira antes que ele apareça: com todas as chamadas passando pelo BFF, cookie entre domínios e CORS não existem no projeto.

**O que eu faria diferente.** Adiei a publicação e trabalhei muitas fases contra ambiente local, o que contradiz o motivo pelo qual esta fase é a primeira. Quando finalmente publiquei, apareceram dois problemas que só existem lá: o instalador do provedor pula dependências de desenvolvimento quando o ambiente é de produção, e o build precisa delas para compilar; e o arquivo de ambiente local tem precedência sobre variáveis do processo, o que fez uma execução apontada para o banco publicado rodar contra o local sem avisar. Os dois teriam aparecido no primeiro dia.

---

## Fase 2. Schema e sessão

**Objetivo.** Estabelecer a fonte da verdade e o controle de acesso.

**Escopo.** Postgres local em contêiner. Schema completo em uma migração única, com todas as restrições. Executor de migração próprio, sem ferramenta externa, rodando no início do processo. Autenticação com os três papéis, middlewares de autorização, cookie de sessão escrito pelo BFF, e seed com os quatro usuários.

**Critério de conclusão.** Login funciona nos três papéis, cada um alcançando uma área distinta, e a tentativa de acessar área alheia é recusada.

**Por que o schema inteiro de uma vez.** Restrição adicionada depois é restrição que encontra dado inconsistente, e a saída fácil nesse momento é relaxar a restrição em vez de limpar os dados. Nascendo junto com a tabela, ela nunca permite o estado ruim existir. Como as garantias centrais do sistema vivem no banco, quero que existam antes do primeiro registro.

**Por que migração escrita à mão.** As invariantes deste sistema são restrições de tabela e escritas condicionais, e são exatamente o que precisa estar legível para quem lê o código. Uma ferramenta que gera migração a partir de um modelo esconderia isso atrás de uma abstração. O executor lê arquivos SQL ordenados, registra o que já aplicou e roda cada um na própria transação, de modo que falha no meio não deixa schema pela metade.

**Depende de.** Fase 1, porque a migração precisa rodar também no ambiente publicado.

---

## Fase 3. Catálogo e evento

**Objetivo.** Fazer o evento nascer da fonte externa e chegar ao público.

**Escopo.** Módulo de catálogo com interface de provedor, conjunto local de dados, cache e tempo limite. Criação de evento com captura do item importado, edição, publicação e cancelamento. Listagem pública com busca, filtros e paginação, detalhe do evento, e as listas de cidades e categorias que alimentam os filtros. Painel do organizador com listagem, importação, formulário e transições.

**Critério de conclusão.** Um evento importado do catálogo, ajustado e publicado pelo organizador, aparece na listagem pública com setores e disponibilidade.

**Por que começar pelo conjunto local.** Construo o caminho degradado antes do caminho feliz. Assim a fase não fica dependendo de credencial nem de disponibilidade de API alheia, e o fallback nasce exercitado em vez de ser um tratamento de erro que nunca rodou.

**Por que o catálogo vira snapshot.** O item externo é copiado para o banco no momento da importação, e a partir daí a exibição, a venda e a validação daquele evento não dependem mais da fonte. Os valores digitados pelo organizador prevalecem sobre o que veio importado, porque definir data, local, capacidade e preço é atribuição dele.

**Por que existem rotas de cidades e categorias.** O filtro compara por igualdade exata, e não por substring, depois que a comparação com curinga se mostrou vulnerável a metacaractere digitado pelo usuário. Com igualdade, digitação livre não encontra nada quando a grafia difere, então o campo precisa ser seleção entre valores que existem no acervo.

**Onde apareceu o primeiro ponto de serialização.** A linha do evento. Todo caminho que escreve nele ou nos seus setores trava essa linha antes de decidir, e isso só ficou evidente depois que uma edição concorrente conseguiu apagar os setores entre a validação e a publicação, produzindo evento publicado sem setor nenhum.

**Depende de.** Fase 2, para papel de organizador e posse do evento.

---

## Fase 4. Compra

**Objetivo.** Implementar a invariante central do sistema.

**Escopo.** Reserva com alocação atômica de estoque e validade limitada. Rotina de expiração. Pagamento simulado com aprovação e recusa determinísticas. Emissão dos ingressos na mesma transação da aprovação. Teste de concorrência. Checkout no front, com contador da reserva e os dois caminhos de pagamento.

**Critério de conclusão.** Uma compra completa, do catálogo ao ingresso persistido, executada no ambiente publicado. O teste de concorrência passa de forma repetida, não uma única vez.

**Por que o teste entra aqui.** Ele valida a decisão mais importante do projeto. Um defeito nele descoberto em fase posterior não tem conserto barato, porque muda o modelo de dados. Escrevo junto com a implementação para saber antes.

**Onde a serialização acontece.** O ponto passa a ser a linha do setor, e a proteção não vem de validar antes de escrever, e sim de embutir a condição na própria escrita e decidir pela linha afetada.

**O que o teste de concorrência mede de verdade.** O pool limita as transações simultâneas, então trinta requisições concorrentes viram dez transações ativas com as demais enfileiradas no lock da linha do setor. Esse é o mesmo comportamento em produção, e o número não foi inflado para o teste parecer mais duro do que é.

**A regra da chave de idempotência.** Ela discrimina se o desfecho é conhecido, e não o conteúdo do formulário. Enquanto o resultado for desconhecido, falha de rede ou erro do servidor, a mesma chave é mantida; assim que o servidor responde de forma definitiva, inclusive recusando, a chave é descartada e a próxima tentativa é uma cobrança nova de propósito.

**Depende de.** Fase 3, porque não há o que comprar sem evento publicado.

---

## Fase 5. Ingresso, compartilhamento e portaria

**Objetivo.** Fechar o ciclo até a entrada no evento.

**Escopo.** Payload assinado do ingresso e renderização do código no cliente. Link de compartilhamento com revogação. Atribuição de portaria a evento. Tela de portaria com seleção de evento, leitura por câmera, entrada manual, os vereditos e o log de tentativas. Seed completo, com pedido pago e código válido impresso.

**Critério de conclusão.** Um ingresso emitido é validado pela portaria em um dispositivo real, e a segunda leitura do mesmo código produz o veredito de já utilizado.

**Por que por último entre as telas funcionais.** A portaria depende de tudo o que vem antes existir de verdade: sem ingresso emitido não há o que validar, e sem atribuição de evento não há como distinguir evento errado.

**O terceiro ponto de serialização.** A linha do evento serializa as operações do organizador, a linha do setor serializa a venda, e a linha do ingresso serializa compartilhamento e validação. É o mesmo padrão nas três, e a razão é sempre a mesma: a decisão vem da escrita condicional, e não de uma leitura que a transação vizinha já pode ter invalidado.

**Onde as bibliotecas entraram, e por quê.** Duas, ambas fazendo uma coisa só. A geração do símbolo, porque implementar codificação e correção de erro à mão falha produzindo um símbolo pior que passa no teste local e quebra em dispositivo real. A decodificação, porque o mesmo vale na leitura, e porque uma biblioteca que possui o laço de captura possui a política de portaria, que é decisão do projeto. Em ambos os casos o desenho e o laço ficaram aqui.

**Depende de.** Fase 4, para existir ingresso.

---

## Fase 6. Acabamento

**Objetivo.** Transformar o sistema funcional em sistema apresentável.

**Escopo.** Identidade visual definida em bloco. Cancelamento com devolução ao estoque. Os dois testes restantes. Empacotamento completo em contêiner. Documentação final. Verificação do percurso inteiro em produção, em dispositivo móvel.

**Critério de conclusão.** O percurso inteiro é executável por alguém que nunca viu o sistema, partindo apenas do README e do banco semeado.

**Por que a identidade visual fica para o fim.** Estilizar tela que ainda vai mudar é retrabalho, e decisões visuais tomadas aos poucos não produzem a coerência que um bloco único produz. Defino o conjunto de variáveis de uma vez, depois que as telas estabilizam.

**O que muda no ritmo desta fase.** Nas anteriores, cada bloco carregava uma decisão que podia estar errada, e a revisão existia para encontrar isso. Aqui não há invariante nova: o sistema já está correto e verificado, e o trabalho é de apresentação, empacotamento e registro.

**Pendências acumuladas nas fases anteriores.** Registro o que foi adiado conscientemente, para que nada disso dependa de memória. O Bloco 4 fechou a lista de empacotamento e a de itens pequenos; o que sobra está abaixo, com o motivo.

Resolvido no Bloco 4: compose com os três serviços e Dockerfile dos dois pacotes; tipos de Node alinhados em 22; `web/.env.example` versionado; metadados por evento no detalhe público; `NODE_ENV` fora do arquivo de ambiente do backend; aparo da barra no endereço público do seed; seed com os quatro estados de pedido e comando explícito de limpeza. A página do organizador além do fim já redirecionava para a última página válida: o item estava resolvido no código e a lista é que não tinha sido atualizada.

O que continua aberto:

- Decisões de implementação ainda não registradas no README: bcrypt em vez de Argon2id, e camadas sem inversão explícita de dependência. A escolha de gerenciador de pacotes já está registrada lá.
- O `DATABASE_URL` publicado precisa conter `sslmode=require`. O TLS deixou de ser ligado pelo `NODE_ENV` e passou a seguir a string de conexão, que é onde a exigência do banco de fato vive. As strings do Neon já vêm com o parâmetro; se a que está no provedor tiver sido colada sem ele, a conexão publicada sai sem TLS e o banco recusa.
- O README descreve o projeto como estava no início e promete estado "planejado" em quase toda a tabela de requisitos. Reescrita completa é o Bloco 5.
- O pedido pendente semeado vive dez minutos, como qualquer reserva. Quem rodar o seed e voltar à tela depois disso vê expirado no lugar dele. Rodar o seed de novo recria o pendente.

---

## Ordem de prioridade do escopo

Defini isso no início, e não durante a implementação, porque escolha de escopo feita no meio do trabalho tende a proteger o que já foi construído em vez do que importa.

**Inalterável.** Vereditos de portaria, caminho de recusa no pagamento, assinatura do código do ingresso, alocação atômica de estoque, seed e documentação. Cada um desses é a demonstração de uma decisão central. Sem eles o sistema continua funcionando e para de dizer qualquer coisa sobre como foi pensado.

**Substituível.** Leitura por câmera, que tem a entrada manual como caminho equivalente. Busca, que melhora a navegação sobre um acervo que também se percorre por listagem. Orquestração completa de contêineres, que facilita a execução local sem alterar o sistema.

**Opcional declarado.** Cancelamento com devolução, listagem do painel do organizador além do formulário de criação, e cobertura de testes além das invariantes centrais.

A lista existe para que qualquer ajuste de escopo seja consequência de uma ordem definida antes, e não de qual parte estava mais adiantada no momento em que a decisão apareceu.