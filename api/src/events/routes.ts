import { Router } from "express";
import z from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { param, validateBody, validateParam } from "../http/validate";
import * as service from "./service";
import type { CreateEventInput, UpdateEventInput } from "./types";

export const eventsRouter = Router();

// Papel aplicado no router, não rota a rota: toda rota daqui é do organizador,
// e repetir o guarda em cada uma é o jeito de esquecer numa delas.
eventsRouter.use(requireAuth, requireRole("ORGANIZER"));

// Aqui só formato e tamanho. Nome repetido, nome vazio depois de aparado e
// preço não negativo são regra e ficam em prepareTiers: duplicar faria as duas
// mensagens divergirem com o tempo.
// O preço é inteiro de centavos, nunca decimal. O teto equivale a R$ 100.000
// por ingresso, acima do qual o valor é erro de digitação e não preço.
const tierSchema = z.object({
  name: z.string().min(1).max(60),
  priceCents: z.number().int().max(10_000_000),
  capacity: z.number().int().min(1).max(200_000),
});

// O limite de setores existe para o tamanho da transação: cada um vira uma
// linha no mesmo insert da criação do evento.
const tiersSchema = z.array(tierSchema).min(1).max(6);

// Os anuláveis são `.nullable().optional()` de propósito: o serviço distingue
// ausente, que cede ao item importado, de nulo explícito, que apaga o campo.
// `startsAt` exige deslocamento de fuso, porque instante sem fuso é horário de
// parede disfarçado e é a fonte silenciosa de erro deste domínio.
const eventFieldsSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  category: z.string().max(60).optional(),
  imageUrl: z.url().nullable().optional(),
  startsAt: z.iso.datetime({ offset: true }).optional(),
  timezone: z.string().max(60).optional(),
  venueName: z.string().max(200).optional(),
  address: z.string().max(300).nullable().optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(40).nullable().optional(),
  country: z.string().length(2).optional(),
});

const createSchema = eventFieldsSchema.extend({
  externalId: z.string().max(120).optional(),
  tiers: tiersSchema.optional(),
});

const updateSchema = eventFieldsSchema.extend({
  tiers: tiersSchema.optional(),
});

// Id fora do formato responde 404, o mesmo veredito de um uuid válido que não
// existe e de um evento alheio: nenhum id que o organizador não pode acessar
// se distingue dos outros.
const validateId = validateParam("id", z.uuid(), "Evento não encontrado.");

eventsRouter.post("/", validateBody(createSchema), async (req, res) => {
  const input = req.valid as CreateEventInput;
  res.status(201).json(await service.create(req.session!.sub, input));
});

eventsRouter.get("/:id", validateId, async (req, res) => {
  res.json(await service.getOwned(param(req, "id"), req.session!.sub));
});

eventsRouter.patch(
  "/:id",
  validateId,
  validateBody(updateSchema),
  async (req, res) => {
    const input = req.valid as UpdateEventInput;
    res.json(await service.update(param(req, "id"), req.session!.sub, input));
  },
);

eventsRouter.post("/:id/publish", validateId, async (req, res) => {
  res.json(await service.publish(param(req, "id"), req.session!.sub));
});

eventsRouter.post("/:id/cancel", validateId, async (req, res) => {
  res.json(await service.cancel(param(req, "id"), req.session!.sub));
});
