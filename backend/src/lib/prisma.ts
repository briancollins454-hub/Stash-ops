import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __stashOpsPrisma__: PrismaClient | undefined;
}

export const prisma =
  global.__stashOpsPrisma__ ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__stashOpsPrisma__ = prisma;
}

