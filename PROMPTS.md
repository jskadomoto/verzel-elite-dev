# Prompts

Registro de como a implementação foi conduzida com assistência de IA: o formato dos prompts, as regras que valeram em todos eles, e os pontos em que a revisão mudou a decisão.

O README diz quais ferramentas foram usadas, em que partes, e o que foi feito sem elas. Este documento mostra o mecanismo, com trechos literais dos prompts que escrevi e das revisões que recusaram entregas.

Duas ressalvas, antes de qualquer coisa. **Nenhuma citação é reconstruída**: cada trecho entre aspas é recorte do que foi enviado, e onde cortei o meio de um parágrafo o corte está marcado com `[...]`. E a **compilação foi montada ao final**, sobre o registro da sessão, não escrita ao longo dela — o que está detalhado na última seção.

O registro que conservo começa nos commits da fase 2. A fase 1, o esqueleto publicado e o provisionamento dos três ambientes, está descrita no README, na seção do que foi feito sem assistência.

---

## O formato de um prompt de fase

Todos têm a mesma estrutura, e ela não mudou da fase 3 até a 6:

1. **O que ler antes.** `api/CLAUDE.md`, `web/CLAUDE.md`, `ARQUITETURA.md` e `ROADMAP.md`. O contexto é lido do repositório, não repetido no prompt.
2. **Regra de trabalho.** Onde parar, o que mostrar ao parar, e a proibição de commitar.
3. **Regra de comentários.**
4. **Estado atual do sistema.** O que já existe, com nomes de arquivo e de função, para que a entrega se encaixe no que está lá em vez de inventar uma segunda forma de fazer a mesma coisa.
5. **Os blocos.** Cada um com contrato, comportamento, restrições, erros e a validação exigida.
6. **Regras que valem para todos os blocos.**

O bloco é a unidade de trabalho. Um bloco tem um contrato, uma entrega e uma revisão, e nenhum começa antes de o anterior ser aprovado.

A seção de comportamento do primeiro bloco da fase 4, a reserva:

> ## Comportamento
>
> Tudo em uma transação única, nesta ordem:
>
> 1. Insere o pedido com a chave de idempotência e total zerado. Conflito na unicidade significa requisição repetida: devolva o pedido existente e encerre, sem alocar nada.
>
>    Inserir antes de alocar é o que impede uma repetição consumir estoque que precisaria ser devolvido.
>
> 2. Ordena os itens por identificador de setor antes do laço. Sem isso, dois pedidos que tocam os mesmos dois setores em ordens opostas se bloqueiam.
>
> 3. Para cada item, incrementa `allocated` com a condição na cláusula `where`, devolvendo o preço do setor. Nenhuma linha afetada significa esgotado, e aborta a transação inteira.

O padrão que se repete: a ordem é dada, e **cada passo vem com o motivo de estar naquela posição**. Um prompt que diz apenas o que fazer produz código que funciona no caminho feliz. O motivo é o que sobrevive quando o caminho não é o feliz, porque é ele que permite reconhecer, na revisão, que uma reordenação inocente quebrou a garantia.

---

## As regras permanentes

### Parar ao final de cada bloco

> Pare ao final de cada bloco e espere minha validação. Não encadeie blocos. Ao terminar cada um, mostre os arquivos criados ou alterados, o resultado dos testes que o bloco pede, e pergunte se pode seguir. Não faça commit.

A parada é o que torna a revisão possível. Um bloco entregue por vez cabe na leitura; cinco encadeados viram um diff que se aprova por cansaço. E o commit vem depois da validação, sempre, para que o histórico não registre estado que eu não conferi.

### Sem comentários

Até a fase 3 a regra era permissiva:

> Comentário só onde a razão não é óbvia pelo código, e em português.

Não funcionou. O código voltava anotado linha a linha, e a correção foi em três passos, no meio da fase 3: pedir a remoção, mandar varrer todos os arquivos alterados atrás do que tinha escapado, e então mover a regra para onde ela não precisasse ser repetida.

> Adicione uma regra em ambos os `claude.md` (front e back) para que não adicione comentários no código.

Regra que precisa ser repetida em todo prompt está no lugar errado: os dois `CLAUDE.md` são lidos no começo de cada fase. Ainda assim, da fase 4 em diante ela abre cada briefing, agora como proibição e com a razão junto:

> Não escreva comentários. Nenhum. Nem em código novo, nem em código alterado. Os comentários que já existem ficam como estão: não apague, não reescreva.
>
> Se um trecho precisar de explicação para ser compreendido, o nome da função ou da variável está errado. Corrija o nome.

### Nenhuma dependência sem autorização

> Não instale dependência sem me perguntar antes.

No registro desta sessão, duas dependências foram autorizadas, cada uma depois de um argumento apresentado antes da instalação: `uqr`, para a matriz do QR, e `jsQR`, para a leitura pela câmera. As duas fixadas em versão exata.

E uma foi recusada. Para o teste de concorrência eu fixei o runner e abri a porta para contestação:

> Use o runner nativo do Node, `node:test`, com `node:assert`. Não instale nenhuma dependência de teste. [...] Se você achar que isso não funciona por algum motivo concreto deste projeto, me diga qual antes de fazer diferente.

### A validação escrita antes da entrega

Todo bloco termina com uma seção chamada "Validação que eu quero ver", escrita antes de existir código. A do primeiro bloco da compra:

> - Reserva simples reduz a disponibilidade do setor na consulta pública.
> - Repetir a mesma requisição com a mesma chave devolve o mesmo pedido, e a disponibilidade não cai duas vezes.
> - Reserva com quantidade acima da disponibilidade é recusada e não altera `allocated`.
> - Reserva com dois setores, um disponível e outro esgotado, não deixa o primeiro alocado.
> - Reserva em evento rascunho e em cancelado é recusada.
> - Setor de outro evento é recusado.

Escrever o critério antes muda quem define o que é "pronto". Depois da entrega, a tentação é aceitar a demonstração que o próprio autor escolheu mostrar.

### Os commits

> - Título e nada mais. Uma linha, em inglês, no formato `tipo(escopo): descrição`.
> - Sem corpo, sem rodapé, sem menção a ferramenta ou coautoria.
> - Um contexto por commit. Se um arquivo mistura duas preocupações, use `git add -p`.

Mais as conferências antes de cada leva: `git status` mostrado, nenhum `.env` real entrando, nenhum `console.log` de depuração nos arquivos que vão entrar, e `git push` nunca.

O agrupamento também é prompt. Na fase 5:

> Agrupe por contexto de domínio, não por bloco, e mantenha o backend separado do front. Me mostre o agrupamento que você propõe antes de commitar, para eu conferir a granularidade.

### Ao final, compilar

> Ao final de cada bloco, `npx tsc --noEmit` e o resultado dos testes que o bloco pede, com o banco semeado.

---

## As fases, e o que cada prompt fixava

| Fase                                     | Blocos | O que o prompt fixava                                                                                                             |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 2. Schema e sessão                       | —      | Só os commits estão no registro: o agrupamento, um contexto por commit, e a ordem                                                  |
| 3. Catálogo e evento                     | 4+3+3  | Transição de estado validada na cláusula `where`; posse respondendo 404 e não 403; `allocated` nunca saindo da API; router público fora de qualquer guarda |
| 4. Compra                                | 5      | As três invariantes da fase, todas como escrita condicional; a ordem de cada transação, passo a passo, com o motivo de cada posição |
| 5. Ingresso, compartilhamento e portaria | 8      | A composição do código do ingresso e as três propriedades que ele precisa ter; a cadeia de verificação parando no primeiro erro; vereditos como resultado de negócio, nunca erro HTTP |
| 6. Acabamento                            | 6      | Identidade visual nas variáveis antes de qualquer tela; os dois testes restantes; empacotamento; README                              |

Duas observações sobre a tabela.

A fase 3 aparece com três números porque foi conduzida em três prompts: o backend em quatro etapas, as telas em três, e o fechamento em três blocos, depois que a implementação revelou que faltavam peças que eu tinha tratado como prontas.

A fase 6 mudou o ritmo de propósito, e isso estava escrito no prompt:

> Nas fases anteriores, cada bloco carregava uma decisão que podia estar errada, e a revisão existia para encontrar isso. Aqui não há invariante nova: o sistema já está correto e verificado. Isso muda o ritmo. Trabalhe com menos ida e volta, entregue blocos inteiros, e não pare para propor alternativas quando o caminho estiver claro.

---

## Onde a saída fácil foi fechada antes de ser oferecida

Uma parte do trabalho de escrever o prompt é antecipar o atalho e proibi-lo por antecipação, porque depois da entrega ele já custou tempo dos dois lados.

**Teste que se conserta em vez de acusar.**

> Se alguma execução falhar, não conserte o teste: investigue o código e me traga o diagnóstico.

**Código de produção que cede para o teste passar.**

> Não altere código de produção para facilitar o teste. Se o teste não conseguir exercitar algum caminho, isso é informação sobre o desenho, e eu quero saber antes de qualquer mudança.

**Teste que passa uma vez.**

> Rode pelo menos cinco vezes seguidas e me mostre o resultado de cada uma. Concorrência que passa uma vez pode ter passado por sorte de escalonamento.

**Divergência entre documento e código registrada como limitação.** Quando apareceu uma rota anunciada no `ARQUITETURA.md` que não existia:

> Sobre o cancelamento: o problema não é ausência de funcionalidade, é o `ARQUITETURA.md` anunciar uma rota que não existe. Corrija o documento em vez de registrar limitação [...]

**README que descreve um passo a passo nunca executado.**

> Cada comando precisa ter sido executado por você antes de entrar aqui. O passo a passo será percorrido em diretório limpo, e o que não funcionar é defeito deste documento.

E, no mesmo prompt, a restrição que governou o documento inteiro: **nada pode afirmar comportamento que não exista.**

---

## O que a revisão pegou

A maior parte destes achados não chegou como mensagem de texto. Chegou como **recusa da própria escrita**: a ferramenta ia gravar o arquivo, eu recusei a gravação e escrevi o motivo no lugar. O código defeituoso nunca tocou o disco, e é isso que a expressão "pegos antes de virarem código" quer dizer. O registro desta sessão tem quase trinta recusas com motivo escrito.

Três dos itens abaixo têm origem diferente do resto, e a diferença está declarada em cada um.

**Fallback do catálogo respondendo como se a fonte real tivesse atendido.** O `catch` do `search` devolvia o conjunto local sem marcar a resposta, então dado de fixture chegava à tela do organizador indistinguível de dado da API.

> fix(catalog): flag fallback responses as degraded
>
> Só a linha do degraded no catch de search. Confira se getById tem o mesmo problema e corrija junto se tiver, já que é o mesmo contexto.

Tinha o mesmo problema. Hoje os dois caminhos de degradação marcam `degraded: true`, e a tela avisa o organizador de que os resultados não vieram da fonte real.

**Idempotência da reserva com consulta antes da inserção.** A regra é anterior ao código e está no `api/CLAUDE.md`, na lista de detalhes que já custaram bug:

> Insere primeiro e trata o conflito como leitura; consultar antes de inserir tem exatamente a corrida que a idempotência deveria evitar.

Mesmo com a regra escrita, a primeira entrega quebrava:

> A idempotência quebra sob concorrência real. `insertPending` com `do nothing` bloqueia até a outra transação decidir. Se ela confirmar, o `findByKey` seguinte devolve certo. Mas se ela abortar, por esgotamento ou por qualquer outro motivo, o `findByKey` não encontra nada e o serviço responde ORDER_NOT_FOUND para uma requisição válida, quando o correto seria a segunda tentativa prosseguir e alocar.
>
> O código ORDER_NOT_FOUND com semântica de conflito é o sintoma: é um estado que o serviço não sabe explicar.

E, no mesmo bloco, um segundo defeito na ordem das operações:

> Reservar em evento rascunho ou cancelado insere a linha, aborta e desfaz, mas a chave de idempotência fica queimada: nova tentativa com a mesma chave encontra conflito com um pedido que não existe mais. Verifique o evento antes de inserir.

Ficou assim: dentro da transação, leitura pela chave como caminho rápido de repetição já confirmada, verificação do evento e dos setores, inserção com tratamento de conflito, e releitura quando o conflito acontece. O caso que não pode existir — conflito sem pedido correspondente — falha alto, com a chave na mensagem, em vez de virar um 404 que mente sobre a causa.

**Rótulo de lugar derivado do contador de ocupação.** Este não tem entrega minha com o defeito: foi pego na revisão da proposta, antes de existir código, e chegou ao trabalho já como regra escrita no `api/CLAUDE.md`.

> O rótulo do lugar sai de `issued_seq`, que só sobe. Nunca de `allocated`, que desce em cancelamento e faz o rótulo colidir depois.

A emissão usa `issued_seq`, incrementado na linha do setor. O `allocated` continua existindo para a ocupação, que oscila nos dois sentidos.

**Publicação validando precondições fora da transação que executa a mudança.** Entreguei `publish` lendo o evento com `getOwned`, validando setores e data, e só então disparando a transição.

> `publish` valida fora da transação que executa a mudança. Hoje `getOwned` carrega o evento, valida setores e data, e só depois dispara a `transition`. Entre a leitura e a escrita cabe um PATCH concorrente que remove os setores ou joga a data para o passado, e o evento é publicado violando as duas precondições. A cláusula `where` protege a transição de estado, mas não protege essas validações.

Ficou dentro de `withTransaction`, com a leitura travando a linha do evento antes de qualquer precondição ser lida, por uma função de repositório cujo parâmetro de conexão é obrigatório — para não existir caminho que trave linha fora de transação. Um prompt seguinte estendeu o mesmo tratamento a `update` e a `cancel`, e a linha do evento virou o ponto de serialização das operações do organizador.

**Chave de idempotência sem prefixo de cliente.** Aqui devo uma correção de crédito: no registro desta sessão isso não aparece como defeito apontado na revisão, e sim como decisão que apresentei na entrega do Bloco 3 e que você aprovou.

> Aceito as três decisões do Bloco 3: o 402 para PAYMENT_DECLINED, a chave de idempotência com prefixo de cliente e pedido, e a expiração decidida pelo relógio do banco.

O único de banco é sobre `idempotency_key` sozinha, então uma chave adivinhada devolveria o pedido de outra pessoa. O que é gravado passou a ser `cliente:chave`, o que dá a cada cliente um espaço próprio sem migração nova. Se houve achado da revisão que originou isso, ele está fora do que consigo verificar.

**Compartilhamento sem serialização na linha do ingresso.** A revogação do link anterior e a inserção do novo aconteciam sem travar a linha, e duas gerações simultâneas deixavam dois links ativos para o mesmo ingresso.

> Trave a linha do ingresso com `for update` no início do `share()`, antes da revogação, e faça a revogação e a inserção acontecerem na mesma transação, com o mesmo cliente. É o mesmo padrão de `findOwnedForUpdate` em pedidos e de `findOwnedForUpdate` em eventos: a linha do ingresso passa a ser o ponto de serialização das operações de compartilhamento daquele ingresso.

O mesmo prompt mandou avaliar se a revogação isolada precisava do mesmo tratamento, e o experimento das duas gerações simultâneas foi refeito depois da correção.

**Laço de leitura da câmera parando para sempre.** Entreguei o laço reagendado apenas dentro do `onmessage` do worker.

> O laço de leitura depende inteiramente de o worker responder: `schedule` só é chamado dentro do `onmessage`. Se o worker lançar, a cadeia para e a câmera fica ligada sem nunca mais decodificar, sem mensagem nenhuma. Como o `postMessage` transfere o buffer, a falha também consome o quadro.
>
> Acrescente `onerror` no worker, reagendando o laço e registrando o problema na tela depois de falhas repetidas, para o operador saber que precisa usar o campo manual em vez de continuar apontando a câmera.

Ficou com `onerror`, com um limite de tempo para a resposta do worker, e com um contador de falhas que avisa na tela depois de repetidas — porque uma portaria com a câmera acesa e nada acontecendo é pior que uma portaria que diz para usar o campo manual.

**TypeScript cru servido como worker no build.** Este também tem origem diferente: não foi apontado numa revisão, foi encontrado por mim, porque o prompt exigia a medição.

> Reporte no fim do bloco o tamanho real que entra no pacote do browser depois do build, e qual dos dois caminhos do worker ficou.

A inspeção do build mostrou `.next/static/media/qr-decoder.worker.<hash>.ts`, com 370 bytes de TypeScript não compilado: o empacotador tratou o arquivo como ativo, não como entrada. Passaria no build e falharia no dispositivo. Ficou como worker em JavaScript servido de `public/`, com o decodificador copiado para `public/vendor` no passo de build e carregado por `importScripts`.

**Chave de idempotência do pagamento descartada a cada tecla digitada.** Entreguei o `change` do formulário zerando a chave da tentativa.

> A chave de idempotência é descartada a cada tecla digitada. O `change` zera `attemptKey.current`, então corrigir um dígito depois de uma tentativa produz chave nova.
>
> O caso que isso quebra: falha de rede, o cliente não sabe se a cobrança passou, ajusta o cartão e tenta de novo. Se a primeira tinha aprovado, a segunda é outra cobrança.
>
> Aqui a intenção é "pagar este pedido", e ela não muda porque o número do cartão mudou. Isso é diferente do formulário de reserva, onde a chave está atrelada à seleção de quantidades.

O formulário de reserva tinha a versão irmã do mesmo defeito, apontada na entrega anterior: a chave era zerada logo depois de ler a resposta, "antes de servir para alguma coisa".

Ficou assim: a chave vive enquanto o desfecho for desconhecido, e é renovada quando o servidor devolve desfecho conhecido — aprovação ou recusa. O critério veio de um ajuste seu de raciocínio, que não mudou o código:

> o 402 não é definitivo porque encerra a intenção do cliente, e sim porque o desfecho passou a ser conhecido. A próxima tentativa é cobrança nova de propósito, e não repetição da anterior.

### Outros que estão no registro e não estavam na sua lista

- **Ordem das escritas no pagamento.** `insertAttempt` rodava antes de travar e validar o pedido: "Pagar pedido inexistente, de outro cliente, ou com reserva expirada insere a linha de tentativa e só então aborta." A ordem passou a ser travar, validar, autorizar, gravar.
- **SQL inválido com lista vazia.** `insertMany` em ingressos montava `insert into tickets ... values` sem placeholder nenhum, "o mesmo defeito que `orders/repository.ts` tem em `insertItems`, e que `events/repository.ts` já evita em `insertTiers`". A guarda entrou nos três, no mesmo formato.
- **Ingresso sumindo em silêncio.** `listOwned` descartava o ingresso com um `continue` quando não encontrava evento ou setor: "Se essa situação for impossível, o código não deveria acomodá-la; se for possível, sumir é a pior resposta."
- **Mensagem falsa no checkout.** Um estado só misturava reserva expirada com pedido não pendente, e um pedido já pago via "A reserva expirou".
- **Link revogado permanecendo na tela.** Se a geração do link novo falhasse, a tela continuava exibindo o anterior, já revogado no servidor, e o usuário copiava uma URL morta.
- **Uma palavra em cirílico.** No aviso de resultado degradado, `не` no lugar de `não` — dois caracteres que se parecem e não são os mesmos.

---

## Quando eu estava errado

Estes são os casos em que a entrega contestou o prompt com evidência e a decisão mudou. Estão aqui porque um registro de prompts que só mostra instruções obedecidas descreve um monólogo, e não foi isso que aconteceu.

**A cópia dos dados do evento no ingresso.** Eu exigi que título, data e local fossem copiados na emissão, para o comprovante não mudar se o evento fosse editado depois. A resposta demonstrou que os dois estados não se reencontram: publicado não aceita edição, a condição está na cláusula `where` da própria atualização, e a emissão exige pedido pago.

> Sem a cópia. Sua cadeia está correta e a minha premissa estava errada: não existe janela entre a emissão e uma edição, porque os dois estados não se reencontram.

O que ficou no lugar da cópia foi uma nota de dependência entre decisões, no `ARQUITETURA.md`: quem um dia permitir editar evento publicado precisa copiar esses campos antes.

**A porta do teste de concorrência.** Eu tinha escrito que a aplicação sobe sem abrir porta. A entrega usou porta efêmera de loopback e argumentou que isso atende a mesma propriedade.

> Não mexa na porta: efêmera de loopback atende o que a restrição protegia, e a alternativa com socket de domínio custa mais do que resolve.

**A paginação da listagem de pedidos.** Eu tinha pedido paginação; o argumento contrário foi que, com teto de seis ingressos por pedido, ela não se paga.

> Sobre a paginação, você tem razão: com o teto de seis por pedido e o volume desta demonstração, ela não se paga. Mas o formato da resposta deve ser o mesmo das outras listagens, com `items`, `page`, `pageSize` e `total`, ainda que a página seja sempre a primeira. Contrato divergente entre listagens é o que faz o front inventar caso especial.

**O QR.** Aqui eu declarei a posição como posição, e não como ordem:

> Uma posição minha, para você contestar se discordar: gerar QR sem dependência significa implementar codificação, correção de erro e máscara à mão. [...] Se você tiver caminho que não passa por implementar o algoritmo, quero ouvir.

---

## Os prompts de correção

A maior parte não é briefing de fase. Os briefings são pouco mais de uma dúzia; todo o resto são correções de meia página, aprovações com ressalva, e mensagens de uma linha do tipo "pode seguir" e "faça os commits". O histórico do repositório é o resultado desse ciclo, e não de entregas grandes aceitas de uma vez.

As correções seguem uma forma só: o que muda, e por quê. Nunca só o quê.

> Faltam limites de tamanho nos schemas, e tamanho é formato, então é aqui e não no serviço. Hoje passa título de dez megabytes e array com dez mil setores, que viraria dez mil linhas numa transação só.

E quando uma correção tem consequência em outra camada, a consequência entra no mesmo prompt, porque quem vai escrever a outra camada não vai ter esse contexto:

> Uma consequência da mudança em `city` que precisa ficar registrada: a comparação passa de substring para igualdade, então "são" deixa de encontrar "São Paulo". Isso é correto para um filtro, e a busca livre continua no `q`, mas a tela de busca precisa oferecer cidade como seleção entre valores existentes, e não como digitação livre.

---

## O que não passou por prompt

Está detalhado no README, na seção do que foi feito sem assistência: o esqueleto dos dois pacotes, o route handler do BFF, o provisionamento do banco, do backend e do front, e as decisões de desenho tomadas antes de existir código.

Os documentos do projeto entram na mesma conta. `ARQUITETURA.md`, `ROADMAP.md`, os dois `CLAUDE.md` e o `README.md` foram escritos à mão e usados como contexto do trabalho assistido, e não produzidos por ele. É o que torna os prompts curtos possíveis: o contrato já estava escrito antes, e o prompt aponta para ele em vez de repeti-lo.

Quando documento e código divergiram, foi o documento que o prompt seguinte mandou corrigir, com commit próprio para isso.

Este arquivo é a exceção, e ela precisa estar declarada num documento que trata justamente disso: os trechos citados são prompts meus, literais, mas a compilação foi montada ao final, sobre o registro da sessão, e não escrita à mão como os outros.
