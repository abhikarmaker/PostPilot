import { PrismaClient } from "../generated/client";

declare global {
  // eslint-disable-next-line no-var
  var __postpilotPrisma: PrismaClient | undefined;
}

export const prisma = global.__postpilotPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__postpilotPrisma = prisma;
}

export * from "../generated/client";
