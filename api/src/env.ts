const required = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
};

export const ENV = {
  PORT: Number(process.env.PORT) || 8080,
  NODE_ENV: process.env.NODE_ENV || "development",
  COMMIT: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || "local",
  DATABASE_URL: required("DATABASE_URL"),
  SESSION_SECRET: required("SESSION_SECRET"),
  TICKET_SECRET: required("TICKET_SECRET"),
  WEB_URL: process.env.WEB_URL || "http://localhost:3000",
  TICKETMASTER_API_KEY: process.env.TICKETMASTER_API_KEY || "",
};

export { required };
