create extension if not exists citext;

create type user_role     as enum ('ORGANIZER', 'CUSTOMER', 'GATE');
create type event_status  as enum ('DRAFT', 'PUBLISHED', 'CANCELLED');
create type order_status  as enum ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');
create type ticket_status as enum ('VALID', 'USED', 'CANCELLED');

create function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         citext not null unique,
  password_hash text not null,
  role          user_role not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table events (
  id                uuid primary key default gen_random_uuid(),
  organizer_id      uuid not null references users(id),
  status            event_status not null default 'DRAFT',
  title             text not null,
  description       text,
  category          text not null,
  image_url         text,
  starts_at         timestamptz not null,
  timezone          text not null default 'America/Sao_Paulo',
  venue_name        text not null,
  address           text,
  city              text not null,
  state             text,
  country           text not null default 'BR',
  external_source   text,
  external_id       text,
  external_snapshot jsonb,
  snapshot_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index events_status_starts_at_idx on events (status, starts_at);
create index events_category_published_idx on events (category) where status = 'PUBLISHED';
create index events_organizer_idx on events (organizer_id);

create table ticket_tiers (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  name        text not null,
  price_cents integer not null check (price_cents >= 0),
  capacity    integer not null check (capacity > 0),
  allocated   integer not null default 0,
  issued_seq  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tier_allocation_within_capacity
    check (allocated >= 0 and allocated <= capacity),
  unique (event_id, name)
);

create table orders (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id),
  customer_id     uuid not null references users(id),
  status          order_status not null default 'PENDING',
  total_cents     integer not null default 0 check (total_cents >= 0),
  idempotency_key text not null unique,
  hold_expires_at timestamptz not null,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index orders_pending_expiry_idx
  on orders (hold_expires_at) where status = 'PENDING';
create index orders_customer_idx on orders (customer_id, created_at desc);

create table order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id) on delete cascade,
  tier_id          uuid not null references ticket_tiers(id),
  quantity         integer not null check (quantity between 1 and 6),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (order_id, tier_id)
);

create table payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id),
  status          text not null check (status in ('APPROVED', 'DECLINED')),
  card_last4      text,
  decline_reason  text,
  idempotency_key text not null unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index payments_order_idx on payments (order_id, created_at desc);

create table tickets (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id),
  event_id       uuid not null references events(id),
  tier_id        uuid not null references ticket_tiers(id),
  holder_user_id uuid not null references users(id),
  seat_label     text not null,
  status         ticket_status not null default 'VALID',
  used_at        timestamptz,
  used_by        uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tier_id, seat_label),
  constraint used_requires_timestamp
    check ((status = 'USED') = (used_at is not null))
);

create index tickets_holder_idx on tickets (holder_user_id, created_at desc);
create index tickets_order_idx on tickets (order_id);

create table share_links (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references tickets(id) on delete cascade,
  token_hash     text not null unique,
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  opened_count   integer not null default 0,
  last_opened_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index share_links_ticket_idx on share_links (ticket_id);

create table gate_assignments (
  user_id    uuid not null references users(id) on delete cascade,
  event_id   uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table validation_attempts (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id),
  gate_user_id uuid not null references users(id),
  ticket_id    uuid references tickets(id),
  result       text not null,
  code_prefix  text,
  created_at   timestamptz not null default now()
);

create index validation_attempts_event_idx
  on validation_attempts (event_id, created_at desc);

create trigger users_touch        before update on users        for each row execute function touch_updated_at();
create trigger events_touch       before update on events       for each row execute function touch_updated_at();
create trigger ticket_tiers_touch before update on ticket_tiers for each row execute function touch_updated_at();
create trigger orders_touch       before update on orders       for each row execute function touch_updated_at();
create trigger order_items_touch  before update on order_items  for each row execute function touch_updated_at();
create trigger payments_touch     before update on payments     for each row execute function touch_updated_at();
create trigger tickets_touch      before update on tickets      for each row execute function touch_updated_at();
create trigger share_links_touch  before update on share_links  for each row execute function touch_updated_at();