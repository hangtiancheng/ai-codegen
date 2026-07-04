import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "archiver",
    "bullmq",
    "ioredis",
    "minio",
    "mysql2",
    "pg",
    "pino",
    "puppeteer-core",
  ],
};

export default nextConfig;
