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

const SEATS = 10;
const BUYERS = 30;
const APPROVING_CARD = "4242 4242 4242 4242";

const eventTitleFor = (run: string) => `Concorrência ${run}`;
const emailPatternFor = (run: string) => `%-${run}@concorrencia.teste`;

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

function errorCodeOf(body: unknown): string | null {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  return typeof body.error.code === "string" ? body.error.code : null;
}

function paymentStatusOf(body: unknown): string | null {
  if (!isRecord(body) || !isRecord(body.payment)) return null;
  return typeof body.payment.status === "string" ? body.payment.status : null;
}

async function post(
  path: string,
  token: string,
  body?: unknown,
): Promise<Result> {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

type Buyer = { token: string };

type Fixture = { eventId: string; tierId: string; buyers: Buyer[] };

async function createFixture(run: string): Promise<Fixture> {
  const passwordHash = await hash(`senha-${run}`);

  const organizer = await users.create({
    name: `Organizador ${run}`,
    email: `organizador-${run}@concorrencia.teste`,
    passwordHash,
    role: "ORGANIZER",
  });
  assert.ok(organizer, "organizador da massa de teste não foi criado");

  const organizerToken = sign({
    sub: organizer.id,
    role: "ORGANIZER",
    name: organizer.name,
  });

  const buyers: Buyer[] = [];
  for (let index = 0; index < BUYERS; index++) {
    const customer = await users.create({
      name: `Cliente ${index} ${run}`,
      email: `cliente-${index}-${run}@concorrencia.teste`,
      passwordHash,
      role: "CUSTOMER",
    });
    assert.ok(customer, `cliente ${index} da massa de teste não foi criado`);
    buyers.push({
      token: sign({ sub: customer.id, role: "CUSTOMER", name: customer.name }),
    });
  }

  const created = await post("/organizer/events", organizerToken, {
    title: eventTitleFor(run),
    category: "teste",
    startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    timezone: "America/Sao_Paulo",
    venueName: "Casa de Teste",
    city: "Curitiba",
    country: "BR",
    tiers: [{ name: "Pista", priceCents: 10000, capacity: SEATS }],
  });
  assert.equal(created.status, 201, "evento da massa de teste não foi criado");

  const eventId = idOf(created.body);
  const published = await post(
    `/organizer/events/${eventId}/publish`,
    organizerToken,
  );
  assert.equal(published.status, 200, "evento da massa de teste não publicou");

  return { eventId, tierId: firstTierIdOf(created.body), buyers };
}

const OWNED_EVENTS = "select id from events where title = $1";

async function removeFixture(run: string) {
  const title = eventTitleFor(run);
  await pool.query(
    `delete from tickets where event_id in (${OWNED_EVENTS})`,
    [title],
  );
  await pool.query(
    `delete from payments where order_id in
       (select id from orders where event_id in (${OWNED_EVENTS}))`,
    [title],
  );
  await pool.query(
    `delete from orders where event_id in (${OWNED_EVENTS})`,
    [title],
  );
  await pool.query("delete from events where title = $1", [title]);
  await pool.query("delete from users where email like $1", [
    emailPatternFor(run),
  ]);
}

const counterOf = async (tierId: string) => {
  const { rows } = await pool.query<{ allocated: number; issued_seq: number }>(
    "select allocated, issued_seq from ticket_tiers where id = $1",
    [tierId],
  );
  return rows[0];
};

const ticketsOf = async (tierId: string) => {
  const { rows } = await pool.query<{ seat_label: string }>(
    "select seat_label from tickets where tier_id = $1 order by seat_label",
    [tierId],
  );
  return rows.map((row) => row.seat_label);
};

const orderStatusesOf = async (eventId: string) => {
  const { rows } = await pool.query<{ status: string; total: number }>(
    "select status, count(*)::int as total from orders where event_id = $1 group by status",
    [eventId],
  );
  return Object.fromEntries(rows.map((row) => [row.status, row.total]));
};

const paymentCountOf = async (eventId: string) => {
  const { rows } = await pool.query<{ total: number }>(
    `select count(*)::int as total from payments
     where order_id in (select id from orders where event_id = $1)`,
    [eventId],
  );
  return rows[0].total;
};

const distinctPayersOf = async (eventId: string) => {
  const { rows } = await pool.query<{ total: number }>(
    `select count(distinct customer_id)::int as total from orders
     where event_id = $1 and status = 'PAID'`,
    [eventId],
  );
  return rows[0].total;
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

test("dez lugares recebem trinta compras simultâneas", async () => {
  const run = randomUUID().slice(0, 8);

  try {
    const fixture = await createFixture(run);

    const attempts = await Promise.all(
      fixture.buyers.map((buyer, index) =>
        post("/orders", buyer.token, {
          eventId: fixture.eventId,
          items: [{ tierId: fixture.tierId, quantity: 1 }],
          idempotencyKey: `reserva-${run}-${index}`,
        }).then((result) => ({ buyer, result })),
      ),
    );

    const reserved = attempts.filter(({ result }) => result.status === 201);
    const soldOut = attempts.filter(
      ({ result }) =>
        result.status === 409 && errorCodeOf(result.body) === "SOLD_OUT",
    );

    assert.deepEqual(
      attempts
        .filter(({ result }) => result.status !== 201 && result.status !== 409)
        .map(({ result }) => result.status),
      [],
      "nenhuma reserva deveria falhar fora de SOLD_OUT",
    );
    assert.equal(reserved.length, SEATS, "reservas aceitas");
    assert.equal(soldOut.length, BUYERS - SEATS, "reservas recusadas");

    const afterReserving = await counterOf(fixture.tierId);
    assert.equal(afterReserving.allocated, SEATS, "ocupação após as reservas");
    assert.equal(afterReserving.issued_seq, 0, "nenhum ingresso emitido ainda");
    assert.deepEqual(await ticketsOf(fixture.tierId), []);

    const charges = await Promise.all(
      reserved.map(({ buyer, result }, index) =>
        post(`/orders/${idOf(result.body)}/payment`, buyer.token, {
          card: {
            number: APPROVING_CARD,
            holder: `CLIENTE ${index}`,
            expiry: "12/30",
            cvc: "123",
          },
          idempotencyKey: `pagamento-${run}-${index}`,
        }),
      ),
    );

    assert.deepEqual(
      charges.map((charge) => charge.status),
      new Array(SEATS).fill(201),
      "todas as cobranças deveriam ser aprovadas",
    );
    assert.deepEqual(
      charges.map((charge) => paymentStatusOf(charge.body)),
      new Array(SEATS).fill("APPROVED"),
    );

    assert.deepEqual(
      await ticketsOf(fixture.tierId),
      Array.from({ length: SEATS }, (_, seat) =>
        String(seat + 1).padStart(4, "0"),
      ),
      "rótulos sequenciais e sem repetição",
    );

    const afterPaying = await counterOf(fixture.tierId);
    assert.equal(afterPaying.allocated, SEATS, "ocupação após os pagamentos");
    assert.equal(afterPaying.issued_seq, SEATS, "contador de emissão");
    assert.deepEqual(await orderStatusesOf(fixture.eventId), { PAID: SEATS });
    assert.equal(
      await paymentCountOf(fixture.eventId),
      SEATS,
      "uma cobrança por pedido, nenhuma repetida",
    );
    assert.equal(
      await distinctPayersOf(fixture.eventId),
      SEATS,
      "dez pessoas diferentes levaram os dez lugares",
    );
  } finally {
    await removeFixture(run);
  }
});
