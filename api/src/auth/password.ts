import bcrypt from "bcryptjs"

const COST = 12;

const DUMMY_HASH = bcrypt.hashSync("__no_such_user__", COST);

export const hash = (plain: string) => bcrypt.hash(plain, COST);

export const verify = (plain: string, hashed: string) =>
  bcrypt.compare(plain, hashed);

export const wasteTime = () => bcrypt.compare("__no_such_user__", DUMMY_HASH);
