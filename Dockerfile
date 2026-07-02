# Dockerfile для Next.js приложения
FROM node:20-alpine AS base

# Установка зависимостей только при изменении package.json
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Билд приложения
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Выключаем телеметрию Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Ограничиваем кучу Node при сборке: на проде 4 ГБ RAM, и npm run build без
# лимита спайкал до ~2 ГБ рядом с живым контейнером — сервер уходил в swap,
# сайт «висел намертво» на время сборки (ERR_CONNECTION_RESET у посетителей).
# 1536 МБ сборке хватает; если вдруг упадёт по памяти — поднять до 2048.
ENV NODE_OPTIONS="--max-old-space-size=1536"

RUN npm run build

# Продакшен образ
FROM base AS runner
WORKDIR /app

# sharp (нативный модуль для сжатия картинок) на Alpine надёжнее с libc6-compat.
RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Создаем пользователя для безопасности
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Копируем публичные файлы
COPY --from=builder /app/public ./public

# Копируем standalone билд
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
