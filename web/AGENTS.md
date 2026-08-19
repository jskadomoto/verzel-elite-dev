<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Este projeto

Front da plataforma de eventos e ingressos. O contexto completo está em `CLAUDE.md`,
neste diretório. Arquitetura do sistema em `../ARQUITETURA.md`, fases de implementação
e ordem de prioridade do escopo em `../ROADMAP.md`. Leia antes de escrever código.

Regras que não se descobrem lendo a documentação do framework:

- O browser nunca chama a API diretamente. Toda chamada passa por um route handler
  em `app/api`, que repassa ao backend servidor para servidor.
- O cookie de sessão é escrito e apagado pelo route handler, nunca pelo backend, e o
  token nunca chega ao cliente.
- `API_URL` é variável privada. Nunca prefixe com `NEXT_PUBLIC_`.
- Não existe CORS neste projeto. Erro de CORS significa que uma chamada furou o BFF.
- Tailwind 4 configura por CSS, no bloco `@theme` do `globals.css`. Não crie
  `tailwind.config.ts`.
- Sem biblioteca de componentes, sem gerenciador de estado global, sem cliente de
  dados com cache. Foram descartados por decisão, não por esquecimento.
- Rotas que exibem disponibilidade, ingresso ou resultado de busca são dinâmicas.
- Commits: uma linha, em inglês, `tipo(escopo): descrição`, sem rodapé de atribuição.