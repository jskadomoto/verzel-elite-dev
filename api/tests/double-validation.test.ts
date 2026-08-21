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

const ROUNDS = 5;
const APPROVING_CARD = "4242 4242 4242 4242";

const eventTitleFor = (run: string) => `Dupla validação ${run}`;
const emailPatternFor = (run: string) => `%-${run}@portaria.teste`;

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

function ticketIdsOf(body: unknown): string[] {
  if (isRecord(body) && Array.isArray(body.tickets) && body.tickets.length) {
    return body.tickets.map(idOf);
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

function usedAtOf(body: unknown): string {
  if (isRecord(body) && typeof body.usedAt === "string") return body.usedAt;
  return assert.fail(`veredito sem hora de uso: ${JSON.stringify(body)}`);
}

function usedByIdOf(body: unknown): string {
  if (isRecord(body) && isRecord(body.usedBy)) return idOf(body.usedBy);
  return assert.fail(`veredito sem operador: ${JSON.stringify(body)}`);
}

async function request(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<Result> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const post = (path: string, token: string, body?: unknown) =>
  request("POST", path, token, body);

const get = (path: string, token: string) => request("GET", path, token);

type Person = { id: string; name: string; email: string; token: string };

type Fixture = {
  eventId: string;
  customerToken: string;
  ticketIds: string[];
  operators: [Person, Person];
};

async function createUser(
  name: string,
  email: string,
  passwordHash: string,
  role: "ORGANIZER" | "CUSTOMER" | "GATE",
): Promise<Person> {
  const user = await users.create({ name, email, passwordHash, role });
  assert.ok(user, `${name} da massa de teste não foi criado`);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    token: sign({ sub: user.id, role: user.role, name: user.name }),
  };
}

async function createFixture(run: string): Promise<Fixture> {
  const passwordHash = await hash(`senha-${run}`);

  const organizer = await createUser(
    `Organizador ${run}`,
    `organizador-${run}@portaria.teste`,
    passwordHash,
    "ORGANIZER",
  );
  const customer = await createUser(
    `Cliente ${run}`,
    `cliente-${run}@portaria.teste`,
    passwordHash,
    "CUSTOMER",
  );
  const operators: [Person, Person] = [
    await createUser(
      `Portaria Um ${run}`,
      `portaria-um-${run}@portaria.teste`,
      passwordHash,
      "GATE",
    ),
    await createUser(
      `Portaria Dois ${run}`,
      `portaria-dois-${run}@portaria.teste`,
      passwordHash,
      "GATE",
    ),
  ];

  const created = await post("/organizer/events", organizer.token, {
    title: eventTitleFor(run),
    category: "teste",
    startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    timezone: "America/Sao_Paulo",
    venueName: "Casa de Teste",
    city: "Curitiba",
    country: "BR",
    tiers: [{ name: "Pista", priceCents: 10000, capacity: ROUNDS }],
  });
  assert.equal(created.status, 201, "evento da massa de teste não foi criado");

  const eventId = idOf(created.body);
  const published = await post(
    `/organizer/events/${eventId}/publish`,
    organizer.token,
  );
  assert.equal(published.status, 200, "evento da massa de teste não publicou");

  for (const operator of operators) {
    const assigned = await post(
      `/organizer/events/${eventId}/gate-users`,
      organizer.token,
      { email: operator.email },
    );
    assert.equal(
      assigned.status,
      201,
      `portaria ${operator.name} não foi atribuída`,
    );
  }

  const reserved = await post("/orders", customer.token, {
    eventId,
    items: [{ tierId: firstTierIdOf(created.body), quantity: ROUNDS }],
    idempotencyKey: `reserva-${run}`,
  });
  assert.equal(reserved.status, 201, "reserva da massa de teste não foi criada");

  const paid = await post(
    `/orders/${idOf(reserved.body)}/payment`,
    customer.token,
    {
      card: {
        number: APPROVING_CARD,
        holder: "CLIENTE TESTE",
        expiry: "12/30",
        cvc: "123",
      },
      idempotencyKey: `pagamento-${run}`,
    },
  );
  assert.equal(paid.status, 201, "pagamento da massa de teste não foi aprovado");

  return {
    eventId,
    customerToken: customer.token,
    ticketIds: ticketIdsOf(paid.body),
    operators,
  };
}

const OWNED_EVENTS = "select id from events where title = $1";

async function removeFixture(run: string) {
  const title = eventTitleFor(run);
  await pool.query(
    `delete from validation_attempts where event_id in (${OWNED_EVENTS})`,
    [title],
  );
  await pool.query(
    `delete from gate_assignments where event_id in (${OWNED_EVENTS})`,
    [title],
  );
  await pool.query(`delete from tickets where event_id in (${OWNED_EVENTS})`, [
    title,
  ]);
  await pool.query(
    `delete from payments where order_id in
       (select id from orders where event_id in (${OWNED_EVENTS}))`,
    [title],
  );
  await pool.query(`delete from orders where event_id in (${OWNED_EVENTS})`, [
    title,
  ]);
  await pool.query("delete from events where title = $1", [title]);
  await pool.query("delete from users where email like $1", [
    emailPatternFor(run),
  ]);
}

const claimOf = async (ticketId: string) => {
  const { rows } = await pool.query<{ status: string; used_by: string | null }>(
    "select status, used_by from tickets where id = $1",
    [ticketId],
  );
  return rows[0];
};

const attemptsOf = async (ticketId: string) => {
  const { rows } = await pool.query<{ result: string }>(
    "select result from validation_attempts where ticket_id = $1 order by result",
    [ticketId],
  );
  return rows.map((row) => row.result);
};

before(async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  stop = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
});

after(async () => {
  await stop();
  await pool.end();
});

test("duas leituras simultâneas do mesmo código consomem o ingresso uma vez", async () => {
  const run = randomUUID().slice(0, 8);

  try {
    const fixture = await createFixture(run);
    const [one, other] = fixture.operators;

    for (const ticketId of fixture.ticketIds) {
      const ticket = await get(`/tickets/${ticketId}`, fixture.customerToken);
      assert.equal(ticket.status, 200, "leitura do ingresso pelo dono");
      const code = codeOf(ticket.body);

      const readings = await Promise.all([
        post("/gate/validate", one.token, { eventId: fixture.eventId, code }),
        post("/gate/validate", other.token, { eventId: fixture.eventId, code }),
      ]);

      assert.deepEqual(
        readings.map((reading) => reading.status),
        [200, 200],
        "veredito é resultado de negócio, não erro de transporte",
      );

      const verdicts = readings.map((reading) => verdictOf(reading.body));
      assert.deepEqual(
        [...verdicts].sort((a, b) => a.localeCompare(b)),
        ["ALREADY_USED", "VALID"],
        `uma leitura aceita e uma já utilizada, recebido ${verdicts.join(" e ")}`,
      );

      const accepted = readings[verdicts.indexOf("VALID")];
      const refused = readings[verdicts.indexOf("ALREADY_USED")];

      assert.equal(
        usedAtOf(refused.body),
        usedAtOf(accepted.body),
        "a recusa devolve a hora da primeira leitura",
      );
      assert.equal(
        usedByIdOf(refused.body),
        usedByIdOf(accepted.body),
        "a recusa devolve o operador da primeira leitura",
      );

      const claim = await claimOf(ticketId);
      assert.equal(claim.status, "USED", "ingresso consumido");
      assert.equal(
        claim.used_by,
        usedByIdOf(accepted.body),
        "o operador gravado é o que recebeu a leitura aceita",
      );
      assert.ok(
        [one.id, other.id].includes(claim.used_by as string),
        "o operador gravado é um dos dois que leram",
      );

      assert.deepEqual(
        await attemptsOf(ticketId),
        ["ALREADY_USED", "VALID"],
        "as duas tentativas entram no log, inclusive a recusada",
      );
    }
  } finally {
    await removeFixture(run);
  }
});
