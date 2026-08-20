-- A busca pública compara título e nome do local com `strpos`, que responde se
-- um texto contém o outro. Sem a extensão a comparação é sensível a acento, e
-- num acervo em português isso faz "metropole" não encontrar "Metrópole".
-- A extensão normaliza os dois lados, junto com `lower` para a caixa.
-- Não muda a decisão de manter correspondência simples: continua sem índice
-- invertido e sem busca textual do Postgres.
create extension if not exists unaccent;
