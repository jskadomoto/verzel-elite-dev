export type Role = "ORGANIZER" | "CUSTOMER" | "GATE";

// Área de cada papel. Vive aqui, e não dentro do middleware, porque o
// formulário de login precisa do mesmo destino depois de autenticar. Dois mapas
// divergiriam no dia em que uma rota mudasse.
// Este arquivo não importa `next/headers` de propósito: assim o cliente também
// pode usá-lo.
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
