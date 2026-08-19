import jwt from "jsonwebtoken";
import { ENV } from "../env";

export type Session = {
  sub: string;
  role: "ORGANIZER" | "CUSTOMER" | "GATE";
  name: string;
};

export const sign = (session: Session) =>
  jwt.sign(session, ENV.SESSION_SECRET, {
    algorithm: "HS256",
    expiresIn: "12h",
  });

export const verify = (token: string): Session =>
  jwt.verify(token, ENV.SESSION_SECRET, { algorithms: ["HS256"] }) as Session;
