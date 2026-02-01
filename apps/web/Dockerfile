ARG NODE_VERSION=24.11.1
FROM node:${NODE_VERSION}-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---
FROM base AS builder

ARG NEXT_PUBLIC_OPENAI_SECURITY_KEY
ENV NEXT_PUBLIC_OPENAI_SECURITY_KEY=$NEXT_PUBLIC_OPENAI_SECURITY_KEY

ARG NEXT_PUBLIC_MCP_PORT
ENV NEXT_PUBLIC_MCP_PORT=$NEXT_PUBLIC_MCP_PORT

COPY apps/web ./apps/web
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

RUN pnpm install --frozen-lockfile --ignore-scripts \
    && pnpm turbo run build --filter=web... \
    && pnpm --filter web deploy --prod --ignore-scripts --legacy ./out \
    && cp -rL /app/apps/web/.next /app/out/.next \
    && rm -rf /app/apps /app/packages /app/node_modules /app/.turbo \
    && pnpm store prune

# ---
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
# Don't run production as root for security reasons
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/out/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/out/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/out/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/out/.next .next

USER nextjs
ENV NODE_ENV=production

CMD ["node", "dist/server.js"]