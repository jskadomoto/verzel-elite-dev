# Roadmap de implementação

Ordem em que vou construir o sistema e o critério que fecha cada fase. A arquitetura está em `ARQUITETURA.md`; aqui é a sequência.

## Situação

**Fase atual: 4, compra.**

| Fase                                     | Estado       |
| ---------------------------------------- | ------------ |
| 1. Esqueleto publicado                   | concluída    |
| 2. Schema e sessão                       | concluída    |
| 3. Catálogo e evento                     | concluída    |
| 4. Compra                                | em andamento |
| 5. Ingresso, compartilhamento e portaria | pendente     |
| 6. Acabamento                            | pendente     |

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

**Por que primeiro.** Deploy é a parte do trabalho com mais desconhecidos e menos relação com o domínio do problema. Build no ambiente do provedor, variáveis de ambiente, comunicação entre dois serviços em domínios diferentes, contexto seguro e hibernação são indiferentes ao fato de existir ou não regra de negócio, e nenhum deles fica mais fácil de depurar com o sistema montado por cima. Resolvo essa classe inteira de problema quando errar significa apenas repetir um passo.

A topologia também é escolhida aqui de forma a eliminar o problema mais chato dessa fronteira antes que ele apareça: com todas as chamadas passando pelo BFF, cookie entre domínios e CORS não existem no projeto.

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

**Depende de.** Fase 2, para papel de organizador e posse do evento.

---

## Fase 4. Compra

**Objetivo.** Implementar a invariante central do sistema.

**Escopo.** Reserva com alocação atômica de estoque e validade limitada. Rotina de expiração. Pagamento simulado com aprovação e recusa determinísticas. Emissão dos ingressos na mesma transação da aprovação. Teste de concorrência. Checkout no front, com contador da reserva e os dois caminhos de pagamento.

**Critério de conclusão.** Uma compra completa, do catálogo ao ingresso persistido, executada no ambiente publicado. O teste de concorrência passa de forma repetida, não uma única vez.

**Por que o teste entra aqui.** Ele valida a decisão mais importante do projeto. Um defeito nele descoberto em fase posterior não tem conserto barato, porque muda o modelo de dados. Escrevo junto com a implementação para saber antes.

**Onde a serialização acontece.** Na fase 3 o ponto de serialização foi a linha do evento: todo caminho que escreve nele ou nos seus setores trava essa linha antes de decidir. Aqui o ponto passa a ser a linha do setor, e a proteção não vem de validar antes de escrever, e sim de embutir a condição na própria escrita e decidir pela linha afetada.

**Depende de.** Fase 3, porque não há o que comprar sem evento publicado.

---

## Fase 5. Ingresso, compartilhamento e portaria

**Objetivo.** Fechar o ciclo até a entrada no evento.

**Escopo.** Payload assinado do ingresso e renderização do código no cliente. Link de compartilhamento com revogação. Atribuição de portaria a evento. Tela de portaria com seleção de evento, leitura por câmera, entrada manual, os vereditos e o log de tentativas. Seed completo, com pedido pago e código válido impresso.

**Critério de conclusão.** Um ingresso emitido é validado pela portaria em um dispositivo real, e a segunda leitura do mesmo código produz o veredito de já utilizado.

**Por que por último entre as telas funcionais.** A portaria depende de tudo o que vem antes existir de verdade: sem ingresso emitido não há o que validar, e sem atribuição de evento não há como distinguir evento errado.

**Depende de.** Fase 4, para existir ingresso.

---

## Fase 6. Acabamento

**Objetivo.** Transformar o sistema funcional em sistema apresentável.

**Escopo.** Identidade visual definida em bloco. Cancelamento com devolução ao estoque. Testes restantes. Verificação do fluxo completo em produção, em dispositivo móvel. Documentação final.

**Critério de conclusão.** O percurso inteiro é executável por alguém que nunca viu o sistema, partindo apenas do README e do banco semeado.

**Por que a identidade visual fica para o fim.** Estilizar tela que ainda vai mudar é retrabalho, e decisões visuais tomadas aos poucos não produzem a coerência que um bloco único produz. Defino o conjunto de variáveis de uma vez, depois que as telas estabilizam.

**Pendências acumuladas nas fases anteriores.** Registro o que foi adiado conscientemente, para que nada disso dependa de memória:

- Serviços de api e web no compose, com o Dockerfile da api, hoje ausente porque o provedor constrói o backend nativamente.
- Alinhar a versão dos tipos de Node entre os dois pacotes.
- Registrar no README as decisões tomadas durante a implementação: bcrypt em vez de Argon2id, camadas sem inversão explícita de dependência, e gerenciador de pacotes único.
- Links da aplicação publicada no topo do README, junto do aviso de hibernação.
- Página do organizador além do fim da lista cai no estado vazio de "você ainda não tem eventos", em vez de redirecionar para a última página válida como o catálogo público faz.
- Metadados de página no detalhe público do evento, hoje genéricos, o que deixa o link compartilhado sem prévia útil.

---

## Ordem de prioridade do escopo

Defino isso no início, e não durante a implementação, porque escolha de escopo feita no meio do trabalho tende a proteger o que já foi construído em vez do que importa.

**Inalterável.** Vereditos de portaria, caminho de recusa no pagamento, assinatura do código do ingresso, alocação atômica de estoque, seed e documentação. Cada um desses é a demonstração de uma decisão central. Sem eles o sistema continua funcionando e para de dizer qualquer coisa sobre como foi pensado.

**Substituível.** Leitura por câmera, que tem a entrada manual como caminho equivalente. Busca, que melhora a navegação sobre um acervo que também se percorre por listagem. Orquestração completa de contêineres, que facilita a execução local sem alterar o sistema.

**Opcional declarado.** Cancelamento com devolução, listagem do painel do organizador além do formulário de criação, e cobertura de testes além das invariantes centrais.

A lista existe para que qualquer ajuste de escopo seja consequência de uma ordem definida antes, e não de qual parte estava mais adiantada no momento em que a decisão apareceu.