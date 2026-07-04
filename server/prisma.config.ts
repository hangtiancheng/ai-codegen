import "dotenv/config";
import { defineConfig } from "prisma/config";
import { z } from "zod";

const prismaEnvSchema = z.object({
  DATABASE_URL: z.url().default("postgresql://root:pass@localhost:5432/ai_codegen"),
  // .default("mysql://root:pass@localhost:3306/ai_codegen"),
});

const prismaEnv = prismaEnvSchema.parse(process.env);

export default defineConfig({
  datasource: {
    url: prismaEnv.DATABASE_URL,
  },
  migrations: {
    path: "prisma/migrations",
  },
  schema: "prisma/schema.prisma",
});
