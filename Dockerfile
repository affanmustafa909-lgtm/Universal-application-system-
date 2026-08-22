# Deprecated — use backend-system/Dockerfile (canonical Railway image).
#
# Prefer building from backend-system Root Directory on Railway.
# This root Dockerfile is kept for monorepo-context builds only.
#
#   docker build -f backend-system/Dockerfile -t platform-api backend-system
#
# Or from repo root with this file:

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY backend-system/package.json backend-system/pnpm-workspace.yaml backend-system/turbo.json ./
COPY backend-system/pnpm-lock.yaml* ./
COPY backend-system/packages ./packages
COPY backend-system/api ./api
RUN pnpm install --frozen-lockfile=false
RUN pnpm turbo run build --filter=@platform/api

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/api ./api
RUN find /app/node_modules/.bin -type f -o -type l | xargs chmod +x 2>/dev/null || true
RUN mkdir -p /app/api/data/uploads
EXPOSE 3000
ENV HOST=0.0.0.0
CMD ["node", "/app/api/scripts/start-railway.mjs"]
