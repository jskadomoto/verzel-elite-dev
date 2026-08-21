export type Role = "ORGANIZER" | "CUSTOMER" | "GATE";

export const HOME: Record<Role, string> = {
  ORGANIZER: "/organizador",
  CUSTOMER: "/minha-conta",
  GATE: "/portaria",
};

export const AREA_TITLE: Record<Role, string> = {
  ORGANIZER: "Painel do organizador",
  CUSTOMER: "Minha conta",
  GATE: "Portaria",
};
