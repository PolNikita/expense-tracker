# expense-tracker

Монорепо трекера расходов: Next.js (frontend) + Nest.js (backend) + PostgreSQL/Prisma.

## Стек

- **Менеджер пакетов**: pnpm workspaces
- **Frontend**: Next.js (App Router), TypeScript strict
- **Backend**: Nest.js, TypeScript strict
- **БД**: PostgreSQL 16 (через docker-compose)
- **ORM**: Prisma (schema живёт в `apps/api/prisma`)
- **Линт/формат**: ESLint + Prettier

## Структура

```
apps/
  web/       Next.js (App Router)
  api/       Nest.js + Prisma
packages/
  tsconfig/        общие tsconfig'и
  eslint-config/   общие конфиги ESLint
  types/           общие TypeScript-типы (API DTO)
```

## Быстрый старт (после установки зависимостей)

```bash
# 1. поднять PostgreSQL
pnpm db:up

# 2. установить зависимости (на следующей итерации)
pnpm install

# 3. сгенерировать Prisma Client
pnpm --filter @expense-tracker/api prisma generate

# 4. запустить dev-серверы
pnpm dev:api   # http://localhost:3001
pnpm dev:web   # http://localhost:3000
```

> Сейчас в репозитории только скелет файлов и конфигов — зависимости не установлены.
