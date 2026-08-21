export function BrandMark({ label = true }: Readonly<{ label?: boolean }>) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-6 shrink-0 text-brand"
      >
        <path
          fill="currentColor"
          d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v2.25a.75.75 0 0 1-.6.735 2.25 2.25 0 0 0 0 5.03.75.75 0 0 1 .6.735V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-1.75a.75.75 0 0 1 .6-.735 2.25 2.25 0 0 0 0-5.03.75.75 0 0 1-.6-.735Z"
        />
        <path
          stroke="var(--color-ink)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="1.6 2.2"
          d="M14.5 7v11"
        />
      </svg>
      {label ? (
        <span className="text-lg font-semibold tracking-tight">Ingressos</span>
      ) : null}
    </span>
  );
}
