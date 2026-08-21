const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const formatBrl = (priceCents: number) => brl.format(priceCents / 100);

export const availabilityLabel = (available: number, capacity: number) =>
  available === 0 ? "Esgotado" : `${available} de ${capacity} disponíveis`;

export const reaisFromCents = (priceCents: number) =>
  (priceCents / 100).toFixed(2).replace(".", ",");

export function centsFromReais(typed: string): number | null {
  const cleaned = typed.trim().replaceAll(".", "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export const formatEventDateTime = (instant: string, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(instant));

export const formatEventDateTimeLong = (instant: string, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(instant));
