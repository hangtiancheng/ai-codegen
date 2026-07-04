import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "../config/index";

const defaultDatabaseUrl = "postgresql://root:pass@localhost:5432/ai_codegen";

export const createPrismaClient = (databaseUrl = env.DATABASE_URL ?? defaultDatabaseUrl) => {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
};

export type PrismaDatabaseClient = ReturnType<typeof createPrismaClient>;
