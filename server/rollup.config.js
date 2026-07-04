import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";

export default {
  input: "src/index.ts",
  output: {
    file: "dist/index.js",
    format: "esm",
    sourcemap: true,
  },
  external: [
    /^node:/,
    /^@langchain\//,
    /^@prisma\//,
    /^@hono\//,
    "archiver",
    "bullmq",
    "dayjs",
    "dotenv",
    "dotenv/config",
    "generic-pool",
    "hono",
    "hono-pino",
    "iconv-lite",
    "ioredis",
    "langchain",
    "marked",
    "minio",
    "mysql2",
    "node-cron",
    "nodemailer",
    "pg",
    "pino",
    "pino-pretty",
    "puppeteer-core",
    "zod",
  ],
  plugins: [
    resolve({ extensions: [".ts", ".js"] }),
    commonjs(),
    json(),
    typescript({
      tsconfig: "./tsconfig.json",
      compilerOptions: {
        module: "ESNext",
        moduleResolution: "bundler",
        declaration: false,
        sourceMap: true,
      },
    }),
  ],
};
