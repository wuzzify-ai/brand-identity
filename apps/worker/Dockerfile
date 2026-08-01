FROM node:22.13.1-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @wuzzify/brand-identity-worker build

FROM node:22.13.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/worker/package.json ./apps/worker/package.json
RUN pnpm install --frozen-lockfile --prod --filter @wuzzify/brand-identity-worker...
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
USER app
CMD ["node", "apps/worker/dist/main.js"]
