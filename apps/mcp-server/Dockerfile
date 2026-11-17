# MCP Nexus v2 HTTP server — Firebird over LAN + Gedemin web on Docker host.
# Build from repo root: docker build -f apps/mcp-server/Dockerfile -t mcp-nexus-server .
ARG NODE_VERSION=24.11.1
FROM node:${NODE_VERSION}-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        libfbclient2 \
    && FB_SO2="$(find /usr/lib -name 'libfbclient.so.2' ! -path '*/firebird/*' -print -quit)" \
    && test -n "$FB_SO2" \
    && FB_LIB="$(dirname "$FB_SO2")" \
    && ln -sf libfbclient.so.2 "$FB_LIB/libfbclient.so" \
    && test -e "$FB_LIB/libfbclient.so" \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/mcp-server ./apps/mcp-server
COPY packages/db-firebird ./packages/db-firebird
COPY packages/report-worker ./packages/report-worker
COPY packages/accounting-sql ./packages/accounting-sql

RUN pnpm install --frozen-lockfile \
    && pnpm --filter @mcp-nexus/db-firebird build \
    && pnpm rebuild node-firebird-native-api \
    && pnpm store prune

FROM node:${NODE_VERSION}-slim AS runner

RUN apt-get update \
    && apt-get install -y --no-install-recommends libfbclient2 \
    && FB_SO2="$(find /usr/lib -name 'libfbclient.so.2' ! -path '*/firebird/*' -print -quit)" \
    && test -n "$FB_SO2" \
    && FB_LIB="$(dirname "$FB_SO2")" \
    && ln -sf libfbclient.so.2 "$FB_LIB/libfbclient.so" \
    && test -e "$FB_LIB/libfbclient.so" \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --home /app --ingroup nodejs mcpserver

COPY --from=builder --chown=mcpserver:nodejs /app /app

USER mcpserver

ENV NODE_ENV=production
ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=4005
ENV HOME=/app
ENV npm_config_cache=/app/.npm

EXPOSE 4005

# Avoid `pnpm`/`corepack` at runtime (no writable corepack cache as non-root).
CMD ["./apps/mcp-server/node_modules/.bin/tsx", "apps/mcp-server/src/index.ts", "http"]
