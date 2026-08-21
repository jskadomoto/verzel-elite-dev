import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../src/app";
import { hash } from "../src/auth/password";
import * as users from "../src/auth/repository";
import { sign } from "../src/auth/token";
import { pool } from "../src/db/pool";

const APPROVING_CARD = "4242 4242 4242 4242";

const run = randomUUID().slice(0, 8);
const titleFor = (which: string) => `Autorização ${which} ${run}`;
const emailPattern = `%-${run}@autorizacao.teste`;

let base = "";
let stop: () => Promise<void>;

type Result = { status: number; body: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function idOf(body: unknown): string {
  if (isRecord(body) && typeof body.id === "string") return body.id;
  return assert.fail(`resposta sem id: ${JSON.stringify(body)}`);
}

function firstTierIdOf(body: unknown): string {
  if (isRecord(body) && Array.isArray(body.tiers) && body.tiers.length) {
    return idOf(body.tiers[0]);
  }
  return assert.fail(`resposta sem setores: ${JSON.stringify(body)}`);
}

function firstTicketIdOf(body: unknown): string {
  if (isRecord(body) && Array.isArray(body.tickets) && body.tickets.length) {
    return idOf(body.tickets[0]);
  }
  return assert.fail(`resposta sem ingressos: ${JSON.stringify(body)}`);
}

function codeOf(body: unknown): string {
  if (isRecord(body) && typeof body.code === "string") return body.code;
  return assert.fail(`resposta sem código: ${JSON.stringify(body)}`);
}

function verdictOf(body: unknown): string {
  if (isRecord(body) && typeof body.verdict === "string") return body.verdict;
  return assert.fail(`resposta sem veredito: ${JSON.stringify(body)}`);
}

function errorCodeOf(body: unknown): string | null {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  return typeof body.error.code === "string" ? body.error.code : null;
}

function statusFieldOf(body: unknown): string {
  if (isRecord(body) && typeof body.status === "string") return body.status;
  return assert.fail(`resposta sem status: ${JSON.stringify(body)}`);
}

async function request(
  method: string,
  path: string,
  token: string | null,
  body?: unknown,
): Promise<Result> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const get = (path: string, token: string | null) =>
  request("GET", path, token);

const post = (path: string, token: string | null, body?: unknown) =>
  request("POST", path, token, body);

const patch = (path: string, token: string, body: unknown) =>
  request("PATCH", path, token, body);

type Person = { id: string; email: string; token: string };

type Ownership = {
  eventId: string;
  orderId: string;
  ticketId: string;
  code: string;
};

let organizerOne: Person;
let organizerTwo: Person;
let customerOne: Person;
let customerTwo: Person;
let gateOne: Person;
let gateTwo: Person;
let one: Ownership;
let two: Ownership;

async function createUser(
  name: string,
  local: string,
  passwordHash: string,
  role: "ORGANIZER" | "CUSTOMER" | "GATE",
): Promise<Person> {
  const email = `${local}-${run}@autorizacao.teste`;
  const user = await users.create({ name, email, passwordHash, role });
  assert.ok(user, `${name} da massa de teste não foi criado`);
  return {
    id: user.id,
    email: user.email,
    token: sign({ sub: user.id, role: user.role, name: user.name }),
  };
}

async function createOwnership(
  which: string,
  organizer: Person,
  operator: Person,
  customer: Person,
): Promise<Ownership> {
  const created = await post("/organizer/events", organizer.token, {
    title: titleFor(which),
    category: "teste",
    startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    timezone: "America/Sao_Paulo",
    venueName: "Casa de Teste",
    city: "Curitiba",
    country: "BR",
    tiers: [{ name: "Pista", priceCents: 10000, capacity: 2 }],
  });
  assert.equal(created.status, 201, `evento ${which} não foi criado`);

  const eventId = idOf(created.body);
  const published = await post(
    `/organizer/events/${eventId}/publish`,
    organizer.token,
  );
  assert.equal(published.status, 200, `evento ${which} não publicou`);

  const assigned = await post(
    `/organizer/events/${eventId}/gate-users`,
    organizer.token,
    { email: operator.email },
  );
  assert.equal(assigned.status, 201, `portaria de ${which} não foi atribuída`);

  const reserved = await post("/orders", customer.token, {
    eventId,
    items: [{ tierId: firstTierIdOf(created.body), quantity: 1 }],
    idempotencyKey: `reserva-${which}-${run}`,
  });
  assert.equal(reserved.status, 201, `reserva em ${which} não foi criada`);

  const orderId = idOf(reserved.body);
  const paid = await post(`/orders/${orderId}/payment`, customer.token, {
    card: {
      number: APPROVING_CARD,
      holder: "CLIENTE TESTE",
      expiry: "12/30",
      cvc: "123",
    },
    idempotencyKey: `pagamento-${which}-${run}`,
  });
  assert.equal(paid.status, 201, `pagamento em ${which} não foi aprovado`);

  const ticketId = firstTicketIdOf(paid.body);
  const ticket = await get(`/tickets/${ticketId}`, customer.token);
  assert.equal(ticket.status, 200, `leitura do ingresso de ${which}`);

  return { eventId, orderId, ticketId, code: codeOf(ticket.body) };
}

const TITLES = "select id from events where title = any($1)";

async function removeFixture() {
  const titles = [titleFor("um"), titleFor("dois")];
  await pool.query(
    `delete from validation_attempts where event_id in (${TITLES})`,
    [titles],
  );
  await pool.query(
    `delete from gate_assignments where event_id in (${TITLES})`,
    [titles],
  );
  await pool.query(`delete from tickets where event_id in (${TITLES})`, [
    titles,
  ]);
  await pool.query(
    `delete from payments where order_id in
       (select id from orders where event_id in (${TITLES}))`,
    [titles],
  );
  await pool.query(`delete from orders where event_id in (${TITLES})`, [titles]);
  await pool.query("delete from events where title = any($1)", [titles]);
  await pool.query("delete from users where email like $1", [emailPattern]);
}

const ticketStatusOf = async (ticketId: string) => {
  const { rows } = await pool.query<{ status: string }>(
    "select status from tickets where id = $1",
    [ticketId],
  );
  return rows[0].status;
};

const attemptsOf = async (eventId: string) => {
  const { rows } = await pool.query<{
    result: string;
    ticket_id: string | null;
  }>(
    `select result, ticket_id from validation_attempts
     where event_id = $1 order by created_at`,
    [eventId],
  );
  return rows;
};

before(async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  stop = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

  const passwordHash = await hash(`senha-${run}`);
  organizerOne = await createUser(
    "Organizador Um",
    "organizador-um",
    passwordHash,
    "ORGANIZER",
  );
  organizerTwo = await createUser(
    "Organizador Dois",
    "organizador-dois",
    passwordHash,
    "ORGANIZER",
  );
  customerOne = await createUser(
    "Cliente Um",
    "cliente-um",
    passwordHash,
    "CUSTOMER",
  );
  customerTwo = await createUser(
    "Cliente Dois",
    "cliente-dois",
    passwordHash,
    "CUSTOMER",
  );
  gateOne = await createUser("Portaria Um", "portaria-um", passwordHash, "GATE");
  gateTwo = await createUser(
    "Portaria Dois",
    "portaria-dois",
    passwordHash,
    "GATE",
  );

  one = await createOwnership("um", organizerOne, gateOne, customerOne);
  two = await createOwnership("dois", organizerTwo, gateTwo, customerOne);
});

after(async () => {
  await removeFixture();
  await stop();
  await pool.end();
});

test("papel sem permissão recebe 403, e sessão ausente recebe 401", async () => {
  const reading = { eventId: one.eventId, code: one.code };

  const forbidden = [
    {
      what: "cliente na área do organizador",
      call: () => get("/organizer/events", customerOne.token),
    },
    {
      what: "cliente na portaria",
      call: () => post("/gate/validate", customerOne.token, reading),
    },
    {
      what: "organizador nos pedidos",
      call: () => get("/orders", organizerOne.token),
    },
    {
      what: "organizador nos ingressos",
      call: () => get("/me/tickets", organizerOne.token),
    },
    {
      what: "organizador na portaria",
      call: () => post("/gate/validate", organizerOne.token, reading),
    },
    {
      what: "portaria nos pedidos",
      call: () => get("/orders", gateOne.token),
    },
    {
      what: "portaria na área do organizador",
      call: () => get("/organizer/events", gateOne.token),
    },
  ];

  for (const { what, call } of forbidden) {
    const result = await call();
    assert.equal(result.status, 403, `${what} devia receber 403`);
    assert.equal(
      errorCodeOf(result.body),
      "FORBIDDEN",
      `${what} devia receber o código FORBIDDEN`,
    );
  }

  assert.equal(
    await ticketStatusOf(one.ticketId),
    "VALID",
    "nenhuma tentativa de papel errado tocou no ingresso",
  );
  assert.deepEqual(
    await attemptsOf(one.eventId),
    [],
    "tentativa barrada pelo papel não entra no log de validações",
  );

  const absent = await get("/orders", null);
  assert.equal(absent.status, 401, "sessão ausente é 401, não 403");
  assert.equal(errorCodeOf(absent.body), "UNAUTHENTICATED");

  const invalid = await get("/orders", "nao-e-um-token");
  assert.equal(invalid.status, 401, "sessão inválida é 401, não 403");
  assert.equal(errorCodeOf(invalid.body), "UNAUTHENTICATED");
});

test("recurso de outro dono responde como inexistente", async () => {
  const absent = randomUUID();

  const foreign = `/organizer/events/${one.eventId}`;
  const stranger = organizerTwo.token;

  const foreignEvent = [
    { what: "leitura", call: () => get(foreign, stranger) },
    {
      what: "edição",
      call: () => patch(foreign, stranger, { title: "Sequestrado" }),
    },
    { what: "publicação", call: () => post(`${foreign}/publish`, stranger) },
    { what: "cancelamento", call: () => post(`${foreign}/cancel`, stranger) },
    {
      what: "atribuição de portaria",
      call: () =>
        post(`${foreign}/gate-users`, stranger, { email: gateTwo.email }),
    },
  ];

  for (const { what, call } of foreignEvent) {
    const result = await call();
    assert.equal(result.status, 404, `${what} de evento alheio recebe 404`);
    assert.equal(errorCodeOf(result.body), "NOT_FOUND", `${what} alheia`);
  }

  const foreignRead = await get(
    `/organizer/events/${one.eventId}`,
    organizerTwo.token,
  );
  const absentRead = await get(`/organizer/events/${absent}`, organizerTwo.token);
  assert.equal(
    JSON.stringify(foreignRead.body),
    JSON.stringify(absentRead.body),
    "evento alheio e evento inexistente respondem igual, senão a resposta confirma a existência",
  );

  const mine = await get(`/organizer/events/${one.eventId}`, organizerOne.token);
  assert.equal(mine.status, 200, "o dono continua enxergando o próprio evento");
  assert.equal(
    statusFieldOf(mine.body),
    "PUBLISHED",
    "nenhuma tentativa do estranho alterou o evento",
  );

  const foreignOrder = await get(`/orders/${one.orderId}`, customerTwo.token);
  const absentOrder = await get(`/orders/${absent}`, customerTwo.token);
  assert.equal(foreignOrder.status, 404, "pedido de outro cliente");
  assert.equal(
    JSON.stringify(foreignOrder.body),
    JSON.stringify(absentOrder.body),
    "pedido alheio e pedido inexistente respondem igual",
  );

  const foreignCancel = await post(
    `/orders/${one.orderId}/cancel`,
    customerTwo.token,
  );
  assert.equal(foreignCancel.status, 404, "cancelar pedido de outro cliente");

  const foreignTicket = await get(`/tickets/${one.ticketId}`, customerTwo.token);
  const absentTicket = await get(`/tickets/${absent}`, customerTwo.token);
  assert.equal(foreignTicket.status, 404, "ingresso de outro cliente");
  assert.equal(
    JSON.stringify(foreignTicket.body),
    JSON.stringify(absentTicket.body),
    "ingresso alheio e ingresso inexistente respondem igual",
  );

  const owned = await get(`/orders/${one.orderId}`, customerOne.token);
  assert.equal(owned.status, 200, "o dono continua enxergando o próprio pedido");
  assert.equal(
    statusFieldOf(owned.body),
    "PAID",
    "a tentativa de cancelamento alheio não mexeu no pedido",
  );

  const unassigned = await post("/gate/validate", gateTwo.token, {
    eventId: one.eventId,
    code: one.code,
  });
  assert.equal(
    unassigned.status,
    404,
    "portaria não atribuída ao evento não valida nele",
  );
  const unassignedLog = await get(
    `/gate/log?eventId=${one.eventId}`,
    gateTwo.token,
  );
  assert.equal(
    unassignedLog.status,
    404,
    "portaria não atribuída não lê o log do evento",
  );

  assert.equal(
    await ticketStatusOf(one.ticketId),
    "VALID",
    "a leitura da portaria não atribuída não consumiu o ingresso",
  );
  assert.deepEqual(
    await attemptsOf(one.eventId),
    [],
    "quem não foi atribuído não escreve na auditoria do evento",
  );
});

test("ingresso de outro evento recebe veredito de evento errado", async () => {
  const wrong = await post("/gate/validate", gateOne.token, {
    eventId: one.eventId,
    code: two.code,
  });

  assert.equal(
    wrong.status,
    200,
    "evento errado é veredito de negócio, não erro de transporte",
  );
  assert.equal(verdictOf(wrong.body), "WRONG_EVENT");
  assert.deepEqual(
    isRecord(wrong.body) ? wrong.body.ticket : undefined,
    null,
    "o veredito de evento errado não devolve lugar nem setor",
  );
  assert.equal(
    await ticketStatusOf(two.ticketId),
    "VALID",
    "evento errado não consome o ingresso",
  );

  assert.deepEqual(
    await attemptsOf(one.eventId),
    [{ result: "WRONG_EVENT", ticket_id: two.ticketId }],
    "a tentativa entra no log do evento em que foi apresentada",
  );

  const right = await post("/gate/validate", gateTwo.token, {
    eventId: two.eventId,
    code: two.code,
  });
  assert.equal(
    verdictOf(right.body),
    "VALID",
    "o mesmo ingresso passa na portaria do evento certo",
  );
  assert.equal(await ticketStatusOf(two.ticketId), "USED");
});
