import { AppError } from "../http/errors";
import { hash, verify, wasteTime } from "./password";
import * as repository from "./repository";
import { sign } from "./token";
import { toPublic, type PublicUser } from "./types";

type AuthResult = { token: string; user: PublicUser };

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const passwordHash = await hash(input.password);

  const user = await repository.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: "CUSTOMER",
  });

  if (!user) {
    throw new AppError("EMAIL_TAKEN", "Este e-mail já está cadastrado.", 409);
  }

  return {
    token: sign({ sub: user.id, role: user.role, name: user.name }),
    user: toPublic(user),
  };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const user = await repository.findByEmail(input.email);

  if (!user) {
    await wasteTime();
    throw new AppError(
      "INVALID_CREDENTIALS",
      "E-mail ou senha inválidos.",
      401,
    );
  }

  if (!(await verify(input.password, user.passwordHash))) {
    throw new AppError(
      "INVALID_CREDENTIALS",
      "E-mail ou senha inválidos.",
      401,
    );
  }

  return {
    token: sign({ sub: user.id, role: user.role, name: user.name }),
    user: toPublic(user),
  };
}

export async function me(userId: string): Promise<PublicUser> {
  const user = await repository.findById(userId);
  if (!user) {
    throw new AppError("UNAUTHENTICATED", "Sessão inválida.", 401);
  }
  return toPublic(user);
}
