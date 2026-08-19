export type Role = 'ORGANIZER' | 'CUSTOMER' | 'GATE';

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
};

export type PublicUser = Omit<User, 'passwordHash'>;

export const toPublic = ({ passwordHash: _, ...rest }: User): PublicUser => rest;