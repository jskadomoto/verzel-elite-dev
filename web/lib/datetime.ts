export const TIMEZONES = [
  "America/Noronha",
  "America/Fortaleza",
  "America/Recife",
  "America/Maceio",
  "America/Bahia",
  "America/Sao_Paulo",
  "America/Araguaina",
  "America/Belem",
  "America/Santarem",
  "America/Campo_Grande",
  "America/Cuiaba",
  "America/Manaus",
  "America/Boa_Vista",
  "America/Porto_Velho",
  "America/Eirunepe",
  "America/Rio_Branco",
];

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const WALL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function isSupportedTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function timezoneOptions(current: string): string[] {
  if (!current || TIMEZONES.includes(current)) return TIMEZONES;
  return [...TIMEZONES, current];
}

const MINUTE_IN_MS = 60_000;

function offsetMinutesAt(instant: number, timezone: string): number | null {
  let name: string | undefined;

  try {
    name = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    })
      .formatToParts(new Date(instant))
      .find((part) => part.type === "timeZoneName")?.value;
  } catch {
    return null;
  }

  if (name === "GMT" || name === "UTC") return 0;

  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (!match) return null;

  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

export function instantFromWallTime(
  wallTime: string,
  timezone: string,
): string | null {
  if (!WALL_TIME.test(wallTime)) return null;

  const asUtc = Date.parse(`${wallTime}:00Z`);
  if (Number.isNaN(asUtc)) return null;

  const firstOffset = offsetMinutesAt(asUtc, timezone);
  if (firstOffset === null) return null;

  const approximate = asUtc - firstOffset * MINUTE_IN_MS;

  const secondOffset = offsetMinutesAt(approximate, timezone);
  if (secondOffset === null) return null;

  return new Date(asUtc - secondOffset * MINUTE_IN_MS).toISOString();
}

export function wallTimeFromInstant(
  instant: string,
  timezone: string,
): string | null {
  const parsed = Date.parse(instant);
  if (Number.isNaN(parsed)) return null;

  let parts: Intl.DateTimeFormatPart[];

  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(parsed));
  } catch {
    return null;
  }

  const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}T${valueOf("hour")}:${valueOf("minute")}`;
}
