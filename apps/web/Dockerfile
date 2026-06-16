ARG NODE_VERSION=24.11.1
FROM node:${NODE_VERSION}-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# node-firebird-native-api (node-gyp) + libfbclient at runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        libfbclient2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---
FROM base AS builder

ARG NEXT_PUBLIC_MCP_PORT=4005
ENV NEXT_PUBLIC_MCP_PORT=$NEXT_PUBLIC_MCP_PORT

COPY apps/web ./apps/web
COPY packages/db-firebird ./packages/db-firebird
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

RUN pnpm install --frozen-lockfile \
    && pnpm turbo run build --filter=web... \
    && pnpm --filter web deploy --prod --ignore-scripts --legacy ./out \
    && cp -rL /app/apps/web/.next /app/out/.next \
    && rm -rf /app/apps /app/packages /app/node_modules /app/.turbo \
    && pnpm store prune

# ---
FROM node:${NODE_VERSION}-slim AS runner

RUN apt-get update \
    && apt-get install -y --no-install-recommends libfbclient2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/out/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/out/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/out/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/out/.next .next

USER nextjs
ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
