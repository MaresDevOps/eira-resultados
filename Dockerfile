# syntax=docker/dockerfile:1
# Imagen para producción. Con docker-compose usa ARG DB_PROVIDER=postgresql.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
ARG DB_PROVIDER=sqlite
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Cambia el provider de Prisma si se construye contra Postgres
RUN if [ "$DB_PROVIDER" = "postgresql" ]; then \
      sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma; \
    fi
RUN npx prisma generate && npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app .
EXPOSE 3000
# En arranque: aplica el esquema a la BD, siembra datos demo y levanta la app.
CMD ["sh", "-c", "npx prisma db push && npx tsx prisma/seed.ts && npm run start"]
