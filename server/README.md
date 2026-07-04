# AI Codegen Server

The AI Codegen Server is the backend service for the AI code generation platform. It is a TypeScript Hono application that manages users, applications, chat history, AI-assisted code generation, generated project persistence, Vite project deployment, screenshot capture, health checks, and operational logging.

The server is designed around strict runtime validation with Zod, strict TypeScript typing, local Ollama model execution, Prisma-backed persistence, optional Redis-backed infrastructure, and file-based diagnostics for complex Vite project generation workflows.

## Table of Contents

- [Overview](#overview)
- [Core Capabilities](#core-capabilities)
- [Architecture](#architecture)
- [Directory Guide](#directory-guide)
- [Runtime Requirements](#runtime-requirements)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Database](#database)
- [Redis](#redis)
- [Ollama and AI Models](#ollama-and-ai-models)
- [HTTP API Structure](#http-api-structure)
- [Authentication and Sessions](#authentication-and-sessions)
- [Code Generation Workflow](#code-generation-workflow)
- [Vite Project Generation](#vite-project-generation)
- [Deployment and Static Serving](#deployment-and-static-serving)
- [Storage](#storage)
- [Screenshot Capture](#screenshot-capture)
- [Logging and Diagnostics](#logging-and-diagnostics)
- [Health Checks](#health-checks)
- [Development Commands](#development-commands)
- [Testing](#testing)
- [Build and Production Start](#build-and-production-start)
- [Migration and Cutover Utilities](#migration-and-cutover-utilities)
- [Type and Validation Rules](#type-and-validation-rules)
- [Operational Troubleshooting](#operational-troubleshooting)
- [Maintenance Notes](#maintenance-notes)

## Overview

This package provides the server-side runtime for the AI code generation product.

It exposes a Hono HTTP API mounted under `/${API_PREFIX}`. With the default configuration, the API is available at:

```text
http://localhost:3000/api
```

The server coordinates the following responsibilities:

- User registration, login, session hydration, and admin authorization.
- Application creation, update, deletion, listing, and detail retrieval.
- Chat history persistence for user prompts and AI responses.
- Streaming AI code generation over Server-Sent Events.
- AI route classification across supported generation modes.
- Prompt enhancement and model-based code quality checks.
- Generated code parsing, validation, saving, building, and downloading.
- Vite project deployment into static deploy directories.
- Screenshot capture and cover image storage.
- Health checks for database, Redis, model provider, and storage.
- Detailed Vite generation and deployment logs under `logs/`.

Only local Ollama model providers are supported. Cloud model providers such as DeepSeek and OpenAI are intentionally not part of the current server runtime.

## Core Capabilities

### Application Management

The application module stores generated app metadata and ownership information. It supports:

- Creating apps from user prompts.
- Updating app name, cover, prompt, priority, and deployment metadata.
- Deleting apps with owner checks.
- Listing public or featured apps.
- Listing the current user's own apps.
- Admin-level app management.
- Mapping database models into frontend-facing view objects.

### User Management

The user module supports:

- User registration.
- Login and session creation.
- Current user lookup.
- Admin user listing and management.
- Password hashing with configurable salt.
- Role-based access control through `USER` and `ADMIN`.

### Chat History

Chat history stores both user and AI messages for each generated app. It supports:

- App-scoped chat history reads.
- Admin chat history listings.
- Incremental writes during AI generation.
- Message types from the Prisma enum `ChatMessageType`.

### AI Code Generation

The workflow module coordinates AI generation in phases:

- Classify the requested code generation type.
- Enhance or reason about the prompt.
- Stream generated code to the client.
- Persist user and AI messages.
- Run deterministic and model-based quality checks.
- Parse generated code into project files.
- Save generated files under `tmp/code_output`.
- Build and finalize Vite projects when needed.
- Emit structured Server-Sent Events.

### Deployment

The deployment module builds and publishes generated projects. For Vite projects it:

- Runs the generated project build.
- Copies the built `dist` directory to `tmp/code_deploy/<deployKey>`.
- Serves deployed files from `/api/dist/<deployKey>/index.html`.
- Serves nested assets such as `/api/dist/<deployKey>/assets/index.js`.
- Captures screenshots after deployment.
- Updates app deployment metadata.
- Writes deployment logs into the same Vite diagnostics system.

## Architecture

The server follows a dependency-injection style. `src/index.ts` creates default dependencies and starts the Hono server. `src/app.ts` wires middleware and route groups. `src/app-dependencies.ts` builds runtime services from environment configuration.

High-level flow:

```text
HTTP request
  -> Hono app
  -> global middleware
  -> route group
  -> Zod validation
  -> service
  -> repository or workflow
  -> Prisma, Redis, Ollama, storage, or filesystem
  -> normalized response envelope or SSE stream
```

The application entry point is:

```text
src/index.ts
```

The Hono app factory is:

```text
src/app.ts
```

The default dependency builder is:

```text
src/app-dependencies.ts
```

The server starts with:

```ts
const dependencies = createDefaultDependencies();
const app = createApp(dependencies);
serve({ fetch: app.fetch, port: env.PORT });
```

## Directory Guide

```text
server/
  prisma/
    schema.prisma              Prisma schema and generated client configuration
  prompts/
    vite-project-system-prompt.md
                                System prompt used for Vite project generation
  src/
    ai/                         Model configuration, Ollama provider, routing, guardrails, tools
    app-module/                 App domain service, repository, schemas, deployment integration
    chat-history/               Chat history domain service, repository, schemas
    common/                     Response envelopes, errors, pagination, ID and prompt schemas
    config/                     Environment schemas and parsed runtime env
    cutover/                    Cutover evidence utilities
    database/                   Prisma client construction
    deployment/                 Deploy service, static build copy, screenshots, storage adapters
    middleware/                 Error handling and security middleware
    migration/                  Legacy snapshot migration utilities
    observability/              Health checks, metrics, request context
    project/                    Code parsing, saving, building, downloads, static file service
    rate-limit/                 In-memory and Redis-backed rate limiting
    routes/                     Hono route modules and route tests
    session/                    Session schema, stores, Hono env, auth middleware
    test-support/               Shared test factories
    user/                       User domain service, repository, schemas
    workflow/                   AI workflow, SSE events, Vite diagnostics logging
    app.ts                      Hono app factory
    app-dependencies.ts         Production dependency graph
    index.ts                    Node server entry point
  tmp/
    code_output/                Generated project output
    code_deploy/                Deployed static Vite builds
    storage/                    Local object storage root when enabled
  logs/
    vite-project-*/             Vite generation and deployment diagnostics
```

Generated artifacts, temporary output, deployed static files, and log directories should not be treated as source code.

## Runtime Requirements

Recommended runtime components:

- Node.js compatible with the current dependency set.
- pnpm `10.33.0`.
- PostgreSQL for Prisma persistence.
- Ollama for local LLM inference.
- Redis for production sessions, rate limiting, and screenshot queues.
- Chromium or another Puppeteer-compatible browser for screenshot capture.
- MinIO if production object storage is required.

Local development can run without Redis. If `REDIS_URL` is omitted, the server falls back to in-memory sessions and rate limiting, and screenshots run directly instead of through BullMQ.

Production should use Redis, external object storage, strong secrets, and a configured browser executable.

## Quick Start

Install dependencies from the repository root or from this package, depending on the workspace setup:

```bash
pnpm install
```

Create a local environment file:

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and provide at least:

```env
DATABASE_URL=postgresql://root:pass@localhost:5432/ai_codegen
OLLAMA_BASE_URL=http://localhost:11434
PASSWORD_SALT=<private-random-salt>
SESSION_SECRET=<private-random-session-secret>
```

Start PostgreSQL and create the database expected by `DATABASE_URL`.

Generate Prisma client and apply migrations:

```bash
cd server
pnpm prisma:generate
pnpm db:migrate
```

Pull or prepare the Ollama models referenced by the environment:

```bash
ollama pull qwen2.5
ollama pull qwen3.5
```

Start the server:

```bash
pnpm dev
```

The default API endpoint is:

```text
http://localhost:3000/api
```

## Environment Configuration

Environment variables are parsed and validated through Zod in `src/config/env.schema.ts` and `src/config/ai-env.schema.ts`. Invalid configuration fails fast at startup.

Use `server/.env.example` as the canonical template.

### Server Runtime

| Variable                   | Default       | Description                                                                           |
| -------------------------- | ------------- | ------------------------------------------------------------------------------------- |
| `NODE_ENV`                 | `development` | Runtime mode. Allowed values are `development`, `test`, and `production`.             |
| `PORT`                     | `3000`        | HTTP port used by the Hono server.                                                    |
| `API_PREFIX`               | `api`         | Public API prefix. Routes mount under `/${API_PREFIX}`.                               |
| `LOG_LEVEL`                | `info`        | Application log level.                                                                |
| `CORS_ALLOWED_ORIGINS`     | `*`           | Comma-separated browser origins allowed by CORS. Production rejects wildcard origins. |
| `REQUEST_BODY_LIMIT_BYTES` | `1048576`     | Maximum request body size accepted by middleware.                                     |
| `AI_PROMPT_MAX_LENGTH`     | `4096`        | Maximum user prompt length accepted by AI generation endpoints.                       |

### Persistence and Sessions

| Variable              | Default                    | Description                                                      |
| --------------------- | -------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`        | none                       | PostgreSQL connection string used by Prisma.                     |
| `REDIS_URL`           | none                       | Redis connection string for sessions, rate limiting, and queues. |
| `PASSWORD_SALT`       | `swifty`                   | Salt used for password hashing. Production requires an override. |
| `SESSION_SECRET`      | default development secret | Secret used to sign sessions. Production requires an override.   |
| `SESSION_TTL_SECONDS` | `604800`                   | Session lifetime in seconds.                                     |

### Health Checks

| Variable                     | Default | Description                                      |
| ---------------------------- | ------- | ------------------------------------------------ |
| `HEALTH_MODEL_PROBE_ENABLED` | `true`  | Enables model provider probing in health checks. |
| `HEALTH_MODEL_TIMEOUT_MS`    | `5000`  | Timeout for model health probes.                 |

### Rate Limiting

| Variable                                  | Default | Description                             |
| ----------------------------------------- | ------- | --------------------------------------- |
| `RATE_LIMIT_AI_GENERATION_MAX`            | `10`    | Maximum generation requests per window. |
| `RATE_LIMIT_AI_GENERATION_WINDOW_SECONDS` | `60`    | Rate-limit window size in seconds.      |

### Screenshot Capture

| Variable                             | Default | Description                                                           |
| ------------------------------------ | ------- | --------------------------------------------------------------------- |
| `SCREENSHOT_BROWSER_EXECUTABLE_PATH` | none    | Chromium executable path used by Puppeteer. Production requires this. |
| `SCREENSHOT_TIMEOUT_MS`              | `30000` | Maximum screenshot capture time.                                      |
| `SCREENSHOT_VIEWPORT_WIDTH`          | `1280`  | Screenshot viewport width.                                            |
| `SCREENSHOT_VIEWPORT_HEIGHT`         | `720`   | Screenshot viewport height.                                           |

### AI Model Configuration

Only `ollama` is accepted as a provider value.

| Variable                   | Default                                             | Description                                                                                        |
| -------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `OLLAMA_BASE_URL`          | `http://localhost:11434`                            | Base URL of the local Ollama server.                                                               |
| `AI_ROUTE_PROVIDER`        | `ollama`                                            | Provider used for route classification.                                                            |
| `AI_ROUTE_MODEL`           | `qwen2.5`                                           | Model used to classify generation type.                                                            |
| `AI_ROUTE_MAX_TOKENS`      | `100`                                               | Maximum route-classification output tokens.                                                        |
| `AI_ROUTE_TEMPERATURE`     | `0`                                                 | Route-classification sampling temperature.                                                         |
| `AI_STREAMING_PROVIDER`    | `ollama`                                            | Provider used for streaming code generation.                                                       |
| `AI_STREAMING_MODEL`       | `qwen3.5`                                           | Model used for streaming code generation.                                                          |
| `AI_STREAMING_MAX_TOKENS`  | `8192` in schema, commonly raised in `.env.example` | Maximum streaming output tokens. Large Vite projects often require a higher value such as `65536`. |
| `AI_STREAMING_TEMPERATURE` | `0.2`                                               | Streaming model sampling temperature.                                                              |
| `AI_REASONING_PROVIDER`    | `ollama`                                            | Provider used for prompt enhancement and reasoning.                                                |
| `AI_REASONING_MODEL`       | `qwen2.5`                                           | Model used for reasoning.                                                                          |
| `AI_REASONING_MAX_TOKENS`  | `8192`                                              | Maximum reasoning output tokens.                                                                   |
| `AI_REASONING_TEMPERATURE` | `0.1`                                               | Reasoning model sampling temperature.                                                              |
| `AI_QUALITY_PROVIDER`      | `ollama`                                            | Provider used for quality checks.                                                                  |
| `AI_QUALITY_MODEL`         | `qwen2.5`                                           | Model used for quality checks.                                                                     |
| `AI_QUALITY_MAX_TOKENS`    | `4096`                                              | Maximum quality-check output tokens.                                                               |
| `AI_QUALITY_TEMPERATURE`   | `0.2`                                               | Quality-check sampling temperature.                                                                |

### Deployment and Storage

| Variable                        | Default                                | Description                                                        |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `CODEGEN_DEPLOY_HOST`           | `http://localhost:3000/api`            | Public API host used to construct deployed project URLs.           |
| `STORAGE_DRIVER`                | `local`                                | Storage backend. Supported values are `local` and `minio`.         |
| `STORAGE_LOCAL_ROOT_DIR`        | `tmp/storage`                          | Local filesystem storage root.                                     |
| `STORAGE_LOCAL_PUBLIC_BASE_URL` | `http://localhost:3000/storage`        | Public base URL for local storage objects.                         |
| `STORAGE_MINIO_ENDPOINT`        | `localhost`                            | MinIO host.                                                        |
| `STORAGE_MINIO_PORT`            | none                                   | MinIO port.                                                        |
| `STORAGE_MINIO_USE_SSL`         | `false`                                | Whether to use HTTPS for MinIO.                                    |
| `STORAGE_MINIO_ACCESS_KEY`      | none                                   | MinIO access key. Required when MinIO is active and in production. |
| `STORAGE_MINIO_SECRET_KEY`      | none                                   | MinIO secret key. Required when MinIO is active and in production. |
| `STORAGE_MINIO_BUCKET`          | `swifty-codegen`                       | MinIO bucket name.                                                 |
| `STORAGE_MINIO_PUBLIC_BASE_URL` | `http://localhost:9000/swifty-codegen` | Public base URL for MinIO objects.                                 |
| `STORAGE_MINIO_REGION`          | none                                   | Optional MinIO region.                                             |

### Production Validation

When `NODE_ENV=production`, the server rejects unsafe configuration:

- `CORS_ALLOWED_ORIGINS` must not include `*`.
- `PASSWORD_SALT` must not use the development default.
- `SESSION_SECRET` must not use the development default.
- `REDIS_URL` must be configured.
- `STORAGE_DRIVER` must not be `local`.
- MinIO credentials must be configured.
- `SCREENSHOT_BROWSER_EXECUTABLE_PATH` must be configured.

## Database

The server uses Prisma 7 with PostgreSQL. The Prisma schema is located at:

```text
prisma/schema.prisma
```

Primary models:

- `User`
- `App`
- `ChatHistory`

Primary enums:

- `UserRole`
- `CodegenType`
- `ChatMessageType`

IDs are represented as `BigInt` in the database. Backend schemas accept number-like input from several forms at request boundaries but normalize IDs before use. JSON responses should serialize IDs as strings to avoid JavaScript `bigint` serialization errors.

Common database commands:

```bash
pnpm prisma:generate
pnpm prisma:validate
pnpm db:migrate
pnpm db:migrate:reset
pnpm db:deploy
```

Use `db:migrate` for local development and `db:deploy` for production migration application.

## Redis

Redis is optional for local development and recommended for production.

When `REDIS_URL` is configured, Redis backs:

- Session storage.
- AI generation rate limiting.
- BullMQ screenshot queues.
- Screenshot queue failure observation.

When `REDIS_URL` is not configured, the server falls back to:

- In-memory session storage.
- In-memory rate limiting.
- Direct screenshot capture without a queue.

Do not use in-memory fallbacks for horizontally scaled production deployments.

## Ollama and AI Models

The AI provider layer supports only Ollama. Provider schemas reject other provider values.

The model registry creates separate model configurations for:

- Route classification.
- Streaming generation.
- Reasoning and prompt enhancement.
- Code quality checking.

Recommended local setup:

```bash
ollama serve
ollama pull qwen2.5
ollama pull qwen3.5
```

The streaming model must have enough output capacity for complete Vite projects. If generated Markdown code fences are often unterminated and Vite files are missing, inspect the final stream chunk metadata in `logs/vite-project-*/events.ndjson`. A `done_reason` of `length` usually means `AI_STREAMING_MAX_TOKENS` is too low for the requested project size.

## HTTP API Structure

Routes are mounted by `src/app.ts` under:

```text
/${API_PREFIX}
```

Default route prefix:

```text
/api
```

Route groups:

```text
GET/POST /api/...                    Health, static files, and grouped routes
/api/user/...                        User registration, login, logout, current user, admin user APIs
/api/app/...                         App CRUD, app listing, codegen streaming, deployment
/api/app/admin/...                   Admin app management
/api/management/...                  Operational management endpoints
/api/chat-history/...                App and admin chat history APIs
/api/workflow/...                    Workflow demo routes
/api/static/...                      Generated static preview files
/api/dist/:deployKey/index.html      Deployed Vite project entry point
/api/dist/:deployKey/assets/...      Deployed Vite project assets
```

Most JSON endpoints return a normalized success response envelope built by `createSuccessResponse`.

AI generation uses Server-Sent Events rather than a normal JSON response.

## Authentication and Sessions

Authentication is session-based.

Core concepts:

- Session data is stored through the `SessionStore` abstraction.
- Redis is used when `REDIS_URL` is configured.
- In-memory sessions are used in local development when Redis is absent.
- `requireLogin` protects user-only routes.
- `RequireAdmin` behavior is implemented server-side through role checks and mirrored in the client.

Session-related source files:

```text
src/session/session.schema.ts
src/session/session-store.ts
src/session/redis-session-store.ts
src/session/auth-middleware.ts
```

## Code Generation Workflow

The code generation workflow lives under:

```text
src/workflow/
```

The workflow is responsible for streaming output to the client while also producing durable server-side state.

Typical phase order:

```text
1. Receive authenticated codegen request
2. Apply AI generation rate limit
3. Resolve app and user context
4. Classify code generation type
5. Enhance prompt or perform reasoning
6. Stream generated code chunks to the client
7. Store chat messages
8. Check generated output quality
9. Parse generated project files
10. Save generated files to tmp/code_output
11. Build or finalize the project
12. Emit done or business-error SSE event
```

Supported code generation types are defined by Prisma and mirrored in schemas:

- `VANILLA_HTML`
- `MULTI_FILES`
- `VITE_PROJECT`

The workflow writes detailed logs for `VITE_PROJECT` runs because those projects are more complex and require parsing, dependency installation assumptions, build validation, static deployment, and screenshot capture.

## Vite Project Generation

Vite project generation is the most advanced generation mode. It expects the model to produce a complete project as fenced Markdown file blocks.

Preferred file block format:

````markdown
```tsx filename=./src/App.tsx
export default function App() {
  return <main>Hello</main>;
}
```
````

Legacy JSON file write blocks are also supported:

```json
{
  "filepath": "./src/App.tsx",
  "content": "export default function App() { return <main>Hello</main>; }"
}
```

Project parsing is implemented in:

```text
src/project/code-parser.ts
src/project/markdown-code-blocks.ts
src/project/vite-project-output-format.ts
```

Markdown code block extraction uses `marked.lexer` instead of hand-written fenced block regular expressions.

The parser validates project-level requirements and reports errors before saving incomplete or invalid output.

Important safeguards:

- Unterminated fenced code blocks are detected before model-based quality checks.
- Vite output completeness is checked deterministically.
- Quality scores are treated as percentage integers from `0` to `100`.
- `filename=...` metadata blocks are parsed as direct file blocks.
- Generated files are saved only after parsing succeeds.

If output is truncated, the workflow may log a generated code artifact but skip file saving because the project cannot be parsed safely.

## Deployment and Static Serving

Generated project output is saved under:

```text
tmp/code_output/
```

Deployed Vite builds are copied under:

```text
tmp/code_deploy/<deployKey>/
```

The deployed entry URL uses `index.html` explicitly:

```text
http://localhost:3000/api/dist/<deployKey>/index.html
```

Using `index.html` in the URL is important because Vite often emits relative asset references such as:

```html
<script type="module" crossorigin src="./assets/index.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index.css" />
```

If the browser loads `/api/dist/<deployKey>` without a trailing file path, relative `./assets/...` URLs can resolve incorrectly. The server and client should use `/api/dist/<deployKey>/index.html` for deployed Vite previews.

Static route behavior:

- `/api/static/...` serves generated preview files from `tmp/code_output`.
- `/api/dist/<deployKey>/index.html` serves deployed Vite HTML.
- `/api/dist/<deployKey>/assets/...` serves built JS, CSS, and other assets.
- Asset requests should return the actual asset content, not the HTML fallback.

## Storage

Storage is used for generated assets such as screenshots.

Supported storage drivers:

- `local`
- `minio`

Local storage is useful for development. MinIO is required for production by the current production validation rules.

Storage configuration is built in:

```text
src/app-storage.ts
```

Storage adapters live in:

```text
src/deployment/storage-adapter.ts
src/deployment/minio-storage-adapter.ts
```

## Screenshot Capture

Screenshots are captured after deployment to create visual app covers or deployment previews.

The screenshot pipeline can run in two modes:

- Direct mode when Redis is not configured.
- Queued mode with BullMQ when Redis is configured.

Relevant files:

```text
src/app-screenshot.ts
src/deployment/screenshot-capturer.ts
src/deployment/screenshot-service.ts
src/deployment/screenshot-queue.ts
```

Production requires `SCREENSHOT_BROWSER_EXECUTABLE_PATH`.

## Logging and Diagnostics

General request logging is managed through request context middleware and logger dependencies.

Detailed Vite diagnostics are written under:

```text
logs/vite-project-<appId>-<timestamp>/
```

Typical artifacts include:

```text
events.ndjson
attempt-1-generated-code.md
attempt-1-partial-generated-code.md
attempt-1-quality-check.txt
workflow-error.json
deployment-build.log
```

The exact artifact set depends on how far the workflow progresses.

Important diagnostics captured during streaming:

- Generated character count.
- Final stream chunk metadata.
- `response_metadata.done_reason`.
- `response_metadata.eval_count`.
- `usage_metadata.output_tokens`.

These fields are especially useful for detecting token-cap truncation. If `done_reason` is `length` and `output_tokens` equals the configured maximum, increase `AI_STREAMING_MAX_TOKENS` or reduce the requested project scope.

## Health Checks

Health checks are assembled in `src/app-dependencies.ts`.

Default checks include:

- Database health.
- Redis health.
- Model provider health when enabled.
- Storage write or storage provider health.

Model probing can be disabled with:

```env
HEALTH_MODEL_PROBE_ENABLED=false
```

This is useful when local development should not call Ollama during health checks.

## Development Commands

Run commands from the `server` directory unless your workspace tooling forwards package scripts.

```bash
pnpm dev
```

Starts the server with `tsx watch src/index.ts`.

```bash
pnpm build
```

Generates Prisma client and compiles TypeScript into `dist/`.

```bash
pnpm start
```

Runs the compiled server from `dist/index.js`.

```bash
pnpm test
```

Runs the Vitest test suite.

```bash
pnpm test:watch
```

Runs tests in watch mode.

```bash
pnpm test:coverage
```

Runs tests with coverage.

```bash
pnpm format
```

Formats code with Biome.

```bash
pnpm check
```

Runs Biome checks and applies safe fixes.

```bash
pnpm check:ci
```

Runs Biome in CI reporting mode.

```bash
pnpm ci
```

Runs Prisma validation, build, tests, and CI checks.

## Testing

The backend uses Vitest.

Tests are colocated with the modules they cover. Examples:

```text
src/routes/app-routes.test.ts
src/workflow/workflow-ai.test.ts
src/project/code-parser.test.ts
src/deployment/deployment-service.test.ts
src/common/id.schema.test.ts
```

Run all tests:

```bash
pnpm test
```

Run a focused test file:

```bash
pnpm vitest run src/project/code-parser.test.ts
```

Important test categories:

- Route contract tests.
- Compatibility and fixture parity tests.
- Workflow event tests.
- Vite parser tests.
- Deployment and static route tests.
- Storage adapter tests.
- Session and user tests.
- ID schema tests for BigInt-safe transport behavior.

## Build and Production Start

Build:

```bash
pnpm build
```

Start compiled server:

```bash
pnpm start
```

Production checklist:

- Set `NODE_ENV=production`.
- Configure `DATABASE_URL`.
- Configure `REDIS_URL`.
- Configure strict `CORS_ALLOWED_ORIGINS`.
- Override `PASSWORD_SALT`.
- Override `SESSION_SECRET`.
- Use `STORAGE_DRIVER=minio`.
- Configure MinIO credentials and bucket.
- Configure `SCREENSHOT_BROWSER_EXECUTABLE_PATH`.
- Ensure Ollama is reachable from the server.
- Pull all configured Ollama models.
- Run `pnpm db:deploy`.
- Ensure `CODEGEN_DEPLOY_HOST` matches the public API host.

## Migration and Cutover Utilities

The package includes utility commands for legacy migration and cutover evidence collection.

```bash
pnpm cutover:evidence
pnpm migration:export
pnpm migration:transform
pnpm migration:validate
pnpm migration:import
```

Relevant source directories:

```text
src/cutover/
src/migration/
```

Use these commands when moving data from a legacy system or validating migration snapshots.

## Type and Validation Rules

This project intentionally keeps runtime validation and static types aligned.

Guidelines:

- Validate all external input with Zod.
- Derive static types from Zod schemas with `z.infer`.
- Avoid unsafe type assertions.
- Treat `bigint` carefully at JSON boundaries.
- Keep strict TypeScript enabled.
- Prefer small single-responsibility files.
- Keep file and directory names in kebab-case.
- Keep code-adjacent text in English.

Important schema files:

```text
src/common/id.schema.ts
src/common/pagination.schema.ts
src/common/prompt.schema.ts
src/config/env.schema.ts
src/config/ai-env.schema.ts
src/app-module/app.schema.ts
src/chat-history/chat-history.schema.ts
src/user/user.schema.ts
src/workflow/workflow-events.schema.ts
```

## Operational Troubleshooting

### Server Fails at Startup

Check:

- `.env` exists and is readable.
- `DATABASE_URL` is valid.
- Required production variables are set.
- `API_PREFIX` matches the expected pattern.
- Provider variables are set to `ollama`.
- MinIO variables are present when `STORAGE_DRIVER=minio`.

Environment parsing errors are usually explicit because the server validates configuration with Zod.

### Prisma Client or Database Errors

Run:

```bash
pnpm prisma:validate
pnpm prisma:generate
pnpm db:migrate
```

Confirm that PostgreSQL is running and the database exists.

### Login Does Not Persist

Check:

- `SESSION_SECRET` is stable across restarts.
- Browser requests include credentials.
- CORS allows the frontend origin.
- Redis is reachable if `REDIS_URL` is configured.

### AI Generation Does Not Start

Check:

- User is authenticated.
- Rate limits are not exceeded.
- Ollama is running.
- The configured model exists locally.
- `OLLAMA_BASE_URL` is reachable from the server process.

### Streaming Stops with Incomplete Code Fences

Inspect:

```text
logs/vite-project-*/events.ndjson
```

If the final chunk has:

```json
{
  "response_metadata": {
    "done_reason": "length"
  }
}
```

then the model hit the output token cap. Increase `AI_STREAMING_MAX_TOKENS`, request a smaller app, or split generation into smaller phases.

### Generated Files Are Missing from `tmp/code_output`

Possible causes:

- Streaming failed before any output was produced.
- The generated Markdown had no parseable file blocks.
- A fenced code block was unterminated.
- A generated Vite project failed validation.
- The parser rejected invalid file write blocks.

Check the matching `logs/vite-project-*` directory. If only generated code exists and no save artifacts exist, parsing likely failed before file persistence.

### Vite Build Succeeds but Deployed Assets Return HTML

Expected asset paths:

```text
/api/dist/<deployKey>/assets/<file>.js
/api/dist/<deployKey>/assets/<file>.css
```

If assets return `index.html`, inspect static route behavior and verify the deployed asset files exist under:

```text
tmp/code_deploy/<deployKey>/assets/
```

### Browser Requests `/api/dist/assets/...` Instead of `/api/dist/<deployKey>/assets/...`

Ensure the preview URL includes `index.html`:

```text
/api/dist/<deployKey>/index.html
```

Do not use:

```text
/api/dist/<deployKey>
```

Relative Vite asset URLs resolve differently depending on the loaded document URL.

### Screenshot Capture Fails

Check:

- `SCREENSHOT_BROWSER_EXECUTABLE_PATH` points to a valid browser.
- The deployed URL is reachable from the server process.
- Timeout and viewport settings are appropriate.
- Redis queue logs if queued screenshot mode is active.
- Storage health if screenshot upload fails.

### Health Check Fails on Model Probe

If Ollama is intentionally unavailable in local development, set:

```env
HEALTH_MODEL_PROBE_ENABLED=false
```

If it should be available, verify `OLLAMA_BASE_URL` and local models.

## Maintenance Notes

- Keep `server/.env.example` synchronized with `src/config/env.schema.ts` and `src/config/ai-env.schema.ts`.
- Keep frontend runtime URLs aligned with `API_PREFIX` and `CODEGEN_DEPLOY_HOST`.
- Rebuild `dist/` after provider or schema changes so compiled output does not contain stale code.
- Treat `tmp/` and `logs/` as operational artifacts, not source.
- Prefer adding focused regression tests when changing parsing, deployment, ID schemas, or static serving.
- If model output format changes, update both the Vite prompt and parser tests.
- If adding new external inputs, add Zod schemas at the boundary before using the values.
