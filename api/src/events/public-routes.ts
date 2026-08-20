import { Router } from "express";
import z from "zod";
import { param, validateParam, validateQuery } from "../http/validate";
import * as service from "./service";
import type { PublicSearchFilters } from "./types";

// Router público do catálogo interno. Não tem requireAuth, e é registrado num
// caminho que nenhum router autenticado ocupa. Ver a nota em app.ts.
export const publicEventsRouter = Router();

// `q` exige dois caracteres porque um caractere só casa com quase tudo e a
// varredura não paga. Ausente significa listar sem filtro de texto, não filtrar
// por string vazia.
// `pageSize` não é entrada: tamanho de página escolhido pelo cliente é vetor de
// carga. É constante do repositório e volta na resposta.
// Data simples, sem hora. O servidor resolve começo e fim do dia no fuso de
// referência, com o fim inclusivo: pedir instante completo ao cliente
// espalharia a conversão de fuso e o off-by-one do fim do período por cada um
// deles.
// O piso existe porque o ano zero é válido em ISO 8601 e não existe no
// Postgres, e sem ele a busca respondia 500 a uma data de query string.
const PERIODO_MINIMO = "1900-01-01";

const dataDoFiltro = z.iso
  .date()
  .refine((valor) => valor >= PERIODO_MINIMO, {
    message: "Data fora do período que o catálogo cobre.",
  });

// `city` é comparada por igualdade, não por trecho: "são" não encontra
// "São Paulo". É o certo para um filtro, e a busca livre continua no `q`.
// Consequência para quem escrever a tela: cidade precisa ser seleção entre os
// valores existentes, nunca campo de digitação livre.
const searchSchema = z
  .object({
    q: z.string().trim().min(2).max(120).optional(),
    city: z.string().trim().max(120).optional(),
    category: z.string().trim().max(60).optional(),
    from: dataDoFiltro.optional(),
    to: dataDoFiltro.optional(),
    page: z.coerce.number().int().min(0).max(500).default(0),
  })
  // Período invertido devolveria lista vazia, que na tela é indistinguível de
  // não haver evento no período. Recusar é o único jeito de o front saber que
  // o filtro está errado, e não o acervo.
  .refine(
    (filters) =>
      !filters.from ||
      !filters.to ||
      Date.parse(filters.to) >= Date.parse(filters.from),
    { message: "O fim do período não pode ser anterior ao início.", path: ["to"] },
  );

publicEventsRouter.get("/", validateQuery(searchSchema), async (req, res) => {
  res.json(await service.searchPublished(req.valid as PublicSearchFilters));
});

publicEventsRouter.get(
  "/:id",
  validateParam("id", z.uuid(), "Evento não encontrado."),
  async (req, res) => {
    res.json(await service.getPublished(param(req, "id")));
  },
);
