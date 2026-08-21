import { encode } from "uqr";
import { STATUS_LABEL, type TicketStatus } from "@/lib/tickets";

const QUIET_ZONE = 4;
const ERROR_CORRECTION = "Q";

const DARK = "#000000";
const SPENT_DARK = "#a3a3a3";
const PAPER = "#ffffff";

const MARK: Record<TicketStatus, { label: string; band: string } | null> = {
  VALID: null,
  USED: { label: "UTILIZADO", band: "#404040" },
  CANCELLED: { label: "CANCELADO", band: "#b91c1c" },
};

function modulesPath(modules: boolean[][]): string {
  const squares: string[] = [];

  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) squares.push(`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`);
    });
  });

  return squares.join("");
}

export function TicketCode({
  code,
  status,
}: Readonly<{ code: string; status: TicketStatus }>) {
  const symbol = encode(code, { ecc: ERROR_CORRECTION, border: 0 });
  const side = symbol.size + QUIET_ZONE * 2;
  const mark = MARK[status];
  const bandHeight = side / 6;

  return (
    <svg
      viewBox={`0 0 ${side} ${side}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Código do ingresso, ${STATUS_LABEL[status].toLowerCase()}`}
      className="h-auto w-full max-w-80 rounded"
    >
      <rect width={side} height={side} fill={PAPER} />
      <path d={modulesPath(symbol.data)} fill={mark ? SPENT_DARK : DARK} />

      {mark ? (
        <g>
          <rect
            x="0"
            y={(side - bandHeight) / 2}
            width={side}
            height={bandHeight}
            fill={mark.band}
          />
          <text
            x={side / 2}
            y={side / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={PAPER}
            fontSize={bandHeight * 0.62}
            fontWeight="700"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            letterSpacing="0.4"
          >
            {mark.label}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
