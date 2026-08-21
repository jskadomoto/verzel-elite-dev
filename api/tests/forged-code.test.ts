import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../src/app";
import { hash } from "../src/auth/password";
import * as users from "../src/auth/repository";
import { sign } from "../src/auth/token";
import { pool } from "../src/db/pool";
import { ENV } from "../src/env";
import {
  CODE_SEPARATOR,
  SIGNATURE_BYTES,
  SIGNATURE_LENGTH,
} from "../src/tickets/service";

const APPROVING_CARD = "4242 4242 4242 4242";
const OTHER_SECRET = "chave-de-outra-instalacao-do-mesmo-sistema";

const eventTitleFor = (run: string) => `QR forjado ${run}`;
const emailPatternFor = (run: string) => `%-${run}@forjado.teste`;

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

type Person = { id: string; email: string; token: string };

type Fixture = {
  eventId: string;
  ticketId: string;
  code: string;
  gateToken: string;
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
    email: user.email,
    token: sign({ sub: user.id, role: user.role, name: user.name }),
  };
}

async function createFixture(run: string): Promise<Fixture> {
  const passwordHash = await hash(`senha-${run}`);

  const organizer = await createUser(
    `Organizador ${run}`,
    `organizador-${run}@forjado.teste`,
    passwordHash,
    "ORGANIZER",
  );
  const customer = await createUser(
    `Cliente ${run}`,
    `cliente-${run}@forjado.teste`,
    passwordHash,
    "CUSTOMER",
  );
  const operator = await createUser(
    `Portaria ${run}`,
    `portaria-${run}@forjado.teste`,
    passwordHash,
    "GATE",
  );

  const created = await post("/organizer/events", organizer.token, {
    title: eventTitleFor(run),
    category: "teste",
    startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    timezone: "America/Sao_Paulo",
    venueName: "Casa de Teste",
    city: "Curitiba",
    country: "BR",
    tiers: [{ name: "Pista", priceCents: 10000, capacity: 1 }],
  });
  assert.equal(created.status, 201, "evento da massa de teste não foi criado");

  const eventId = idOf(created.body);
  const published = await post(
    `/organizer/events/${eventId}/publish`,
    organizer.token,
  );
  assert.equal(published.status, 200, "evento da massa de teste não publicou");

  const assigned = await post(
    `/organizer/events/${eventId}/gate-users`,
    organizer.token,
    { email: operator.email },
  );
  assert.equal(assigned.status, 201, "portaria da massa de teste não atribuída");

  const reserved = await post("/orders", customer.token, {
    eventId,
    items: [{ tierId: firstTierIdOf(created.body), quantity: 1 }],
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

  const ticketId = firstTicketIdOf(paid.body);
  const ticket = await get(`/tickets/${ticketId}`, customer.token);
  assert.equal(ticket.status, 200, "leitura do ingresso pelo dono");

  return {
    eventId,
    ticketId,
    code: codeOf(ticket.body),
    gateToken: operator.token,
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

const statusOf = async (ticketId: string) => {
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
    code_prefix: string | null;
  }>(
    `select result, ticket_id, code_prefix from validation_attempts
     where event_id = $1 order by created_at`,
    [eventId],
  );
  return rows;
};

const signedPartOf = (code: string) =>
  code.split(CODE_SEPARATOR).slice(0, 2).join(CODE_SEPARATOR);

const signatureOf = (code: string) => code.split(CODE_SEPARATOR)[2];

const tamperedSignature = (signature: string) =>
  (signature.startsWith("A") ? "B" : "A") + signature.slice(1);

const signatureFrom = (secret: string, signed: string) =>
  createHmac("sha256", secret)
    .update(signed)
    .digest()
    .subarray(0, SIGNATURE_BYTES)
    .toString("base64url");

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

test("código com assinatura forjada é recusado sem tocar no ingresso", async () => {
  const run = randomUUID().slice(0, 8);

  try {
    const fixture = await createFixture(run);
    const signed = signedPartOf(fixture.code);
    const genuine = signatureOf(fixture.code);

    assert.notEqual(
      OTHER_SECRET,
      ENV.TICKET_SECRET,
      "a segunda chave precisa ser diferente da chave em uso",
    );

    const forgeries = [
      {
        name: "assinatura adulterada",
        signature: tamperedSignature(genuine),
      },
      {
        name: "assinatura de outra chave",
        signature: signatureFrom(OTHER_SECRET, signed),
      },
    ];

    for (const forgery of forgeries) {
      assert.notEqual(
        forgery.signature,
        genuine,
        `${forgery.name} precisa diferir da assinatura verdadeira`,
      );
      assert.equal(
        forgery.signature.length,
        SIGNATURE_LENGTH,
        `${forgery.name} precisa ter o mesmo formato da verdadeira, para falhar na conferência e não na leitura`,
      );

      const code = [signed, forgery.signature].join(CODE_SEPARATOR);
      const reading = await post("/gate/validate", fixture.gateToken, {
        eventId: fixture.eventId,
        code,
      });

      assert.equal(
        reading.status,
        200,
        `${forgery.name}: veredito é resultado de negócio, não erro de transporte`,
      );
      assert.equal(
        verdictOf(reading.body),
        "INVALID",
        `${forgery.name} devia ser recusada`,
      );
      assert.equal(
        await statusOf(fixture.ticketId),
        "VALID",
        `${forgery.name} não pode consumir o ingresso`,
      );
    }

    const logged = await attemptsOf(fixture.eventId);
    assert.deepEqual(
      logged.map((attempt) => attempt.result),
      ["INVALID", "INVALID"],
      "as duas tentativas forjadas entram no log",
    );
    assert.deepEqual(
      logged.map((attempt) => attempt.ticket_id),
      [null, null],
      "o id que viaja no payload forjado não é aceito como identidade do ingresso",
    );
    assert.deepEqual(
      logged.map((attempt) => attempt.code_prefix),
      [signed, signed],
      "o log guarda o payload sem o segmento de assinatura",
    );

    const genuineReading = await post("/gate/validate", fixture.gateToken, {
      eventId: fixture.eventId,
      code: fixture.code,
    });
    assert.equal(
      verdictOf(genuineReading.body),
      "VALID",
      "o código verdadeiro continua valendo depois das tentativas forjadas",
    );
    assert.equal(
      await statusOf(fixture.ticketId),
      "USED",
      "só a leitura verdadeira consome o ingresso",
    );
  } finally {
    await removeFixture(run);
  }
});
