# Prompts

Registro de como a implementação foi conduzida com assistência de IA: o formato dos prompts, as regras que valeram em todos eles, e os pontos em que a revisão mudou a decisão.

O README diz quais ferramentas foram usadas, em que partes, e o que foi feito sem elas. Este documento mostra o mecanismo, com trechos literais dos prompts que escrevi. Nada aqui é reconstrução: é recorte do que foi enviado.

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

A maior parte não é briefing de fase. No registro desta sessão são 70 mensagens minhas: 11 briefings de fase ou bloco, 33 correções e aprovações de tamanho médio, e 26 curtas, do tipo "pode seguir" e "faça os commits". O histórico do repositório é o resultado desse ciclo, e não de entregas grandes aceitas de uma vez.

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
