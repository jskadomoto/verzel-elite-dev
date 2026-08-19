# CLAUDE.md, frontend

Contexto do pacote `web/`. Leia antes de escrever qualquer código aqui.

## O que é isto

Front da plataforma de eventos e ingressos do desafio Elite Dev. Quatro superfícies: catálogo público, área do cliente, painel do organizador e tela de portaria.

**Isto é um case avaliado por uma pessoa em vinte minutos, não um produto.** O enunciado penaliza explicitamente interface que sai pronta de ferramenta e que se reconhece de longe porque ninguém escolheu nada. Uma tela bem resolvida vale mais que quatro medianas.

## Stack

Next.js 16.2 com App Router, React 19, TypeScript 5.9, Tailwind 4. Publicado na Vercel.

Não introduza biblioteca de componentes, gerenciador de estado global, cliente de dados com cache nem framework de formulário. Nenhum deles se paga em quatro telas, e biblioteca de componentes é o caminho mais curto para a interface genérica que o enunciado penaliza.

## A regra que não se quebra

**O browser nunca chama a API diretamente.** Toda chamada passa por um route handler em `app/api`, que atua como BFF: lê o cookie de sessão e repassa ao backend com cabeçalho de autorização, servidor para servidor.

Consequências práticas:

- `API_URL` é variável privada. Nunca prefixe com `NEXT_PUBLIC_`. Se ela vazar para o cliente, o browser passa a falar com o Render direto e o problema de cookie cross-site volta inteiro.
- No cliente, todo `fetch` usa caminho relativo (`/api/...`).
- Não existe CORS neste projeto. Se surgir erro de CORS, alguma chamada furou o BFF e o certo é consertar a chamada, não configurar CORS no backend.
- Route handler que fala com a API precisa de `maxDuration` folgado, porque o plano gratuito do Render hiberna e a primeira requisição pode levar até um minuto.

## Cache e renderização

- **Catálogo público:** pode ser estático com revalidação por tempo.
- **Página do evento, checkout, busca, meus ingressos, portaria:** sempre dinâmico, sem cache. Disponibilidade em cache é risco de vender ingresso que já acabou, e resultado de busca em cache congela o primeiro termo para todo mundo.
- Não implemente revalidação por tag disparada pelo backend. Foi descartado, está no `DECISIONS.md`.

## Estilo

Tailwind 4 configura por CSS, não por arquivo de config. As variáveis vivem no bloco `@theme` do `globals.css`. Não crie `tailwind.config.ts`.

A identidade visual é decisão do autor do projeto e acontece na sexta, em bloco, definindo o conjunto de variáveis de uma vez antes de estilizar qualquer tela de verdade. Até lá, use utilitários direto e não invente token nem paleta.

Dois pontos já mapeados no `globals.css` do scaffold, para resolver quando chegar a hora: o `body` fixa `font-family` e anula as variáveis de fonte declaradas logo acima, e o esquema de cores segue a preferência do sistema operacional de quem abre.

**A portaria é escura sempre**, independente da preferência do sistema. Vai ser usada à noite, com o operador olhando a tela de perto, e veredito colorido sobre fundo claro em ambiente escuro é pior de ler.

## Telas e o que cada uma precisa acertar

**Catálogo público.** Data, local e preço visíveis no card. Busca no servidor, refletida na query string, para que o link seja compartilhável e o botão voltar funcione. Estado vazio que diz o que fazer, nunca lista em branco.

**Página do evento.** Setores com preço e disponibilidade. Disponibilidade lida no momento, nunca de cache.

**Checkout.** Seleção por quantidade e setor, sem mapa de assentos. Contador regressivo da reserva, que expira em dez minutos. A tela de pagamento precisa expor os cartões de teste, porque o avaliador precisa percorrer aprovação e recusa sem adivinhar. Recusa mostra o motivo e mantém o pedido vivo para nova tentativa.

**Meus ingressos.** QR renderizado em SVG a partir do payload assinado que o backend devolve. O backend não manda imagem.

**Ingresso.** É o artefato que o cliente guarda e o melhor print para o README. Estado domina o visual: ingresso usado ganha marca e perde saturação.

**Compartilhamento.** Botão de gerar e de revogar, mais a contagem de aberturas. A tela precisa dizer, com todas as letras, que quem tem o link tem o ingresso e que a primeira leitura na portaria vence.

**Portaria.** Seleção do evento antes de qualquer leitura, porque o evento viaja na requisição e é o que permite o veredito de evento errado. Leitor de câmera com **campo de código manual sempre visível**, nunca escondido atrás de um link de ajuda: câmera bloqueada por permissão na máquina do avaliador é o jeito mais bobo de perder a demonstração. Cinco vereditos distintos e inequívocos: válido, inválido, já utilizado, evento errado, cancelado. Log das últimas leituras no rodapé.

A câmera exige contexto seguro, então teste no celular em produção, não no localhost do desktop.

## Contrato com a API

Erro sempre no mesmo envelope, com código estável em maiúsculas. O front escolhe a mensagem pelo `code`, nunca pelo texto:

```json
{ "error": { "code": "SOLD_OUT", "message": "...", "details": {} } }
```

**Os vereditos da portaria não são erros.** Chegam com 200 e um campo de veredito, porque são resultado de negócio. Não trate `ALREADY_USED` como falha de requisição.

Tipos são duplicados aqui, não compartilhados com o backend. O contrato real é JSON e tipo compartilhado dá uma segurança que o `fetch` não valida em runtime de qualquer jeito.

## Commits

Título e nada mais, uma linha, em inglês, no formato `tipo(escopo): descrição`, sem rodapé de atribuição. Um contexto por commit: se o diff mistura duas preocupações, são dois commits.

Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`.

Escopos: `catalog`, `checkout`, `tickets`, `gate`, `organizer`, `auth`, `ui`, `http`, `docs`, `build`.

## Fora de escopo, não sugira

Mapa de assentos, atualização em tempo real por SSE ou WebSocket, aplicativo nativo, recuperação de senha, envio de ingresso por e-mail, transferência de titularidade, biblioteca de componentes, tema alternável pelo usuário.

Cada um tem uma linha de justificativa no `DECISIONS.md`. Se algo aqui parecer errado, a discussão vai para o documento de decisão, não para o código.