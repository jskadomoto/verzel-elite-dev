export function AvailabilityBar({
  available,
  capacity,
}: Readonly<{ available: number; capacity: number }>) {
  const taken = capacity > 0 ? (capacity - available) / capacity : 0;

  return (
    <span
      aria-hidden="true"
      className="block h-1 w-full overflow-hidden rounded-full bg-surface-raised"
    >
      <span
        className={`block h-full rounded-full ${
          available === 0 ? "bg-danger" : "bg-brand"
        }`}
        style={{ width: `${Math.round(taken * 100)}%` }}
      />
    </span>
  );
}
