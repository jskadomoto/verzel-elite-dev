export const lastPageOf = (pageSize: number, total: number) =>
  Math.max(0, Math.ceil(total / pageSize) - 1);
