FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN npx tsc -p tsconfig.json

# ---

FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist/

EXPOSE 8080

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
