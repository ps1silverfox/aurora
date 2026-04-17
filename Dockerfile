# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/

RUN npm run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN addgroup -S aurora && adduser -S aurora -G aurora
USER aurora

EXPOSE 3000

CMD ["node", "dist/main.js"]
