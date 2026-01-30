ARG NODE_VERSION=24.11.1
FROM node:${NODE_VERSION}-slim AS base

# This Dockerfile is copy-pasted into our main docs at /docs/handbook/deploying-with-docker.
# Make sure you update both files!

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# Set working directory
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---
FROM base AS prepare
RUN pnpm add -g turbo
COPY . .
# Add lockfile and package.json's of isolated subworkspace
RUN turbo prune web --docker

# ---
FROM base AS builder

ARG NEXT_PUBLIC_OPENAI_SECURITY_KEY
ENV NEXT_PUBLIC_OPENAI_SECURITY_KEY=$NEXT_PUBLIC_OPENAI_SECURITY_KEY

# First install the dependencies (as they change less often)
COPY --from=prepare /app/out/json/ .
COPY --from=prepare /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
# Build the project
COPY --from=prepare /app/out/full/ .

# Uncomment and use build args to enable remote caching
# ARG TURBO_TEAM
# ENV TURBO_TEAM=$TURBO_TEAM

# ARG TURBO_TOKEN
# ENV TURBO_TOKEN=$TURBO_TOKEN

RUN pnpm turbo build

# ---
FROM node:${NODE_VERSION}-alpine AS runner
# Don't run production as root for security reasons
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Копируем зависимости для работы сервера
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/node_modules ./apps/web/node_modules

# Копируем собранное приложение и ваш скомпилированный сервер
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/package.json
# Копируем скомпилированный server.js (убедитесь, что билд-скрипт его создает)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/dist/server.js ./apps/web/server.js

USER nextjs
ENV NODE_ENV=production

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
# COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

CMD ["node", "apps/web/server.js"]