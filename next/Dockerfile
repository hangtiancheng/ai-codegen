FROM node:24-bookworm-slim

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
ENV NEXT_TELEMETRY_DISABLED="1"
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"
ENV POSTGRES_USER="root"
ENV POSTGRES_PASSWORD="pass"
ENV POSTGRES_DB="ai_codegen"
ENV DATABASE_URL="postgresql://root:pass@127.0.0.1:5432/ai_codegen"
ENV REDIS_URL="redis://127.0.0.1:6379"
ENV CORS_ALLOWED_ORIGINS="*"
ENV CODEGEN_DEPLOY_HOST="http://localhost:3000/api"
ENV STORAGE_DRIVER="local"
ENV STORAGE_LOCAL_ROOT_DIR="/app/tmp/storage"
ENV STORAGE_LOCAL_PUBLIC_BASE_URL="http://localhost:3000/api/static"
ENV OLLAMA_BASE_URL="http://host.docker.internal:11434"
ENV HEALTH_MODEL_PROBE_ENABLED="false"
ENV PASSWORD_SALT="<password_salt>"
ENV SESSION_SECRET="<session_32_bytes_secret>"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  openssl \
  postgresql \
  redis-server \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV="development"

RUN mkdir -p /app/tmp/storage /app/tmp/code_deploy /app/tmp/code_output /app/logs /data/redis

RUN cat <<'EOF' > /usr/local/bin/swifty-codegen-start
#!/usr/bin/env bash
set -Eeuo pipefail

export PORT="${PORT:-3000}"
export POSTGRES_USER="${POSTGRES_USER:-root}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-pass}"
export POSTGRES_DB="${POSTGRES_DB:-ai_codegen}"
export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export CODEGEN_DEPLOY_HOST="${CODEGEN_DEPLOY_HOST:-http://localhost:${PORT}/api}"
export STORAGE_LOCAL_PUBLIC_BASE_URL="${STORAGE_LOCAL_PUBLIC_BASE_URL:-http://localhost:${PORT}/api/static}"

start_postgres() {
  local cluster_line
  local pg_version
  local pg_cluster

  if ! pg_lsclusters --no-header | grep -q .; then
    pg_version="$(ls /usr/lib/postgresql | sort -V | tail -n 1)"
    pg_createcluster "${pg_version}" main --start
    return
  fi

  cluster_line="$(pg_lsclusters --no-header | head -n 1)"
  pg_version="$(printf "%s\n" "${cluster_line}" | awk '{print $1}')"
  pg_cluster="$(printf "%s\n" "${cluster_line}" | awk '{print $2}')"

  if ! pg_lsclusters --no-header | awk '$4 == "online" { found = 1 } END { exit found ? 0 : 1 }'; then
    pg_ctlcluster "${pg_version}" "${pg_cluster}" start
  fi
}

configure_postgres() {
  if ! su -s /bin/sh postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}'\"" | grep -q 1; then
    su -s /bin/sh postgres -c "createuser --superuser '${POSTGRES_USER}'"
  fi

  su -s /bin/sh postgres -c "psql -v ON_ERROR_STOP=1 --dbname postgres -c \"ALTER USER \\\"${POSTGRES_USER}\\\" WITH PASSWORD '${POSTGRES_PASSWORD}';\""

  if ! su -s /bin/sh postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'\"" | grep -q 1; then
    su -s /bin/sh postgres -c "createdb -O '${POSTGRES_USER}' '${POSTGRES_DB}'"
  fi
}

start_redis() {
  redis-server \
    --daemonize yes \
    --bind 0.0.0.0 \
    --protected-mode no \
    --dir /data/redis
}

start_postgres
configure_postgres
start_redis

pnpm exec prisma migrate deploy

exec pnpm exec next start -H 0.0.0.0 -p "${PORT}"
EOF

RUN chmod +x /usr/local/bin/swifty-codegen-start

VOLUME ["/var/lib/postgresql", "/data/redis", "/app/tmp", "/app/logs"]

EXPOSE 3000 5432 6379

CMD ["swifty-codegen-start"]
