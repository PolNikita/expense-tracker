# apps/api — CLAUDE.md

Workspace-specific guidance for the Nest.js backend. Root [`CLAUDE.md`](../../CLAUDE.md) covers repo-wide conventions (toolchain, monorepo, commits, branching) — read it first.

Правила, проверяемые при PR-ревью (CQRS-слои, ownership, pagination tie-breaker, Prisma error mapping, JWT и т.п.), — в корневом [`REVIEW.md`](../../REVIEW.md), секция «3. Backend (`apps/api`)». Этот файл — архитектурный справочник по бэку: где что лежит, как устроены ключевые узлы, как добавить новый ресурс.

## Workspace layout

```
apps/api/
├── prisma/
│   ├── schema.prisma        # User / Category / Expense
│   └── migrations/          # all migrations live here, not in packages/db
├── src/
│   ├── main.ts              # bootstrap: ValidationPipe + CORS (WEB_ORIGIN)
│   ├── app.module.ts        # ConfigModule.forRoot({ isGlobal: true }) + feature modules
│   ├── prisma/              # @Global() PrismaModule + PrismaService
│   ├── auth/                # JWT (Passport) — controller + service + JwtStrategy + guard + @CurrentUser()
│   ├── users/               # CQRS-only (no controller, no service) — exposed via index.ts
│   ├── categories/          # CRUD reference implementation (CQRS + service + controller)
│   ├── expenses/            # CRUD + paginated list (CQRS + service + controller)
│   └── shared/dto/          # cross-module DTOs (e.g. PaginationQueryDto)
├── .env.example             # DATABASE_URL, PORT, JWT_SECRET, JWT_EXPIRES_IN, WEB_ORIGIN
├── nest-cli.json
└── tsconfig.json            # extends packages/tsconfig/nestjs.json
```

## Common commands

```bash
# from repo root — добавь PATH-prelude из корневого CLAUDE.md
pnpm dev:api                                       # nest start --watch на :3001
pnpm build:api                                     # nest build → dist/
pnpm --filter @expense-tracker/api typecheck
pnpm --filter @expense-tracker/api lint

# Prisma (run from apps/api или через filter)
pnpm --filter @expense-tracker/api prisma:generate
pnpm --filter @expense-tracker/api prisma:migrate  # prisma migrate dev
pnpm --filter @expense-tracker/api prisma:studio
```

Никакого `test` скрипта пока нет — добавишь runner, задокументируй single-test invocation здесь и в корневом CLAUDE.md.

## Env vars

Все читаются через `ConfigService` (`ConfigModule.forRoot({ isGlobal: true })`). Обязательные секреты — `getOrThrow`, не `get`.

| Var              | Required | Default                                  | Used by                                             |
| ---------------- | -------- | ---------------------------------------- | --------------------------------------------------- |
| `DATABASE_URL`   | ✔        | —                                        | Prisma                                              |
| `PORT`           |          | `3001`                                   | `main.ts`                                           |
| `JWT_SECRET`     | ✔        | — (getOrThrow)                           | `AuthModule` (JwtModule.registerAsync), JwtStrategy |
| `JWT_EXPIRES_IN` |          | `'7d'`                                   | `AuthModule`                                        |
| `WEB_ORIGIN`     |          | `'http://localhost:3000'`                | CORS в `main.ts`                                    |

## CQRS reference

Все ресурсы строим по единой CQRS-схеме. Reference-реализации — [`src/categories/`](src/categories) и [`src/expenses/`](src/expenses). Структура папки:

```
<resource>/
├── <resource>.controller.ts          # HTTP layer
├── <resource>.service.ts             # thin: CommandBus/QueryBus dispatch + mapper
├── <resource>.repository.ts          # единственное место с PrismaService
├── <resource>.mapper.ts              # Prisma row → DTO из @expense-tracker/types
├── <resource>.module.ts              # imports: [CqrsModule], providers: [...handlers, service, repo]
├── index.ts                          # public CQRS API для cross-module access
├── dto/                              # class-validator DTOs (HTTP boundary)
├── commands/{<name>.command.ts, handlers/<name>.handler.ts}
└── queries/{<name>.query.ts,  handlers/<name>.handler.ts}
```

Обязанности слоёв, что возвращают commands vs queries, как работает регистрация handlers — это правила ревью, см. [REVIEW.md §3.1](../../REVIEW.md).

## Cross-module CQRS

Public API ресурса выставляется через `src/<resource>/index.ts` (см. [`users/index.ts`](src/users/index.ts), [`categories/index.ts`](src/categories/index.ts), [`expenses/index.ts`](src/expenses/index.ts)) — наружу торчат только commands/queries, controller/service/repository/dto/handler остаются приватными.

Конкретный пример: `AuthService` дёргает users через `CreateUserCommand` / `GetUserByEmailQuery` / `GetUserByIdQuery` из [`users/index.ts`](src/users/index.ts). `UsersModule` намеренно без controller/service — users экспонируются только как CQRS-операции для `AuthModule`.

Правила взаимодействия модулей через bus — см. [REVIEW.md §3.2](../../REVIEW.md).

## Auth & ownership — что есть в коде

- **JWT payload** — `{ sub, email }`, `sub = user.id`. Менять payload — breaking change (см. правило про `feat(api)!` в корневом CLAUDE.md и [REVIEW.md §3.3](../../REVIEW.md)).
- **`JwtStrategy.validate`** при валидации тянет свежего пользователя из БД через `GetUserByIdQuery` и кладёт в `request.user` — без `passwordHash`, с `createdAt`/`updatedAt` уже в ISO.
- **`@UseGuards(JwtAuthGuard)` + `@CurrentUser() user: User`** — единственный способ получить пользователя в контроллере.
- **Ownership scoping** — все repository-методы принимают `userId` и фильтруют по нему. У Expense нет прямого `userId` — фильтрация через `category: { userId }`. Перед create/update Expense — `ExpensesRepository.assertCategoryOwnedByUser` проверяет владение категорией.

## DTO & validation

`main.ts` ставит глобальный `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`:

- `whitelist` режет неизвестные поля
- `forbidNonWhitelisted` — 400 при их наличии
- `transform` приводит query-string числа к `number` (важно для `PaginationQueryDto`)

DTO лежат в `<resource>/dto/`, валидация через `class-validator` + `class-transformer`, требования к ним — в [REVIEW.md §3.4](../../REVIEW.md).

## Pagination

Постраничные list-эндпойнты используют [`PaginationQueryDto`](src/shared/dto/pagination-query.dto.ts) (`limit` 1..100 = 10, `offset` 0..100_000 = 0). Маппер пагинированного ответа — `toPaginated*` в `<resource>.mapper.ts`, считает `hasMore = offset + items.length < total`.

Правила (tie-breaker в `orderBy`, где маппится items, где собирается meta) — [REVIEW.md §3.5](../../REVIEW.md).

## Error handling

Обработка `Prisma.PrismaClientKnownRequestError` (мапинг `P2002`/`P2003`/`P2025` в Nest-исключения, поведение read-side для `null`) — правило ревью, см. [REVIEW.md §3.6](../../REVIEW.md). В коде смотри командные handlers `categories/` и `expenses/` как референс.

## Prisma — фактическая конфигурация

- Schema живёт в [`prisma/schema.prisma`](prisma/schema.prisma), миграции — в [`prisma/migrations/`](prisma/migrations). Prisma специально не вынесена в `packages/db` — backend единственный консьюмер.
- Денежные поля — `@db.Decimal(12, 2)`. На выходе мапим через `.toString()` (см. `toExpenseDto`).
- `onDelete: Restrict` на связях `Category.user` и `Expense.category` — нельзя удалить пользователя/категорию с зависимыми записями.
- Composite uniques: `@@unique([userId, name])` у `Category`.

Правила работы с этим (когда трогать каскады, как обрабатывать composite unique conflicts) — [REVIEW.md §3.7](../../REVIEW.md).

## Adding a new resource — checklist

1. Добавь модель в `schema.prisma`, сгенерируй миграцию: `pnpm --filter @expense-tracker/api prisma:migrate` (только когда пользователь попросил).
2. Добавь shared DTO/типы в `packages/types` (см. правило **Shared types boundary** в корневом CLAUDE.md).
3. Создай папку `src/<resource>/` по структуре из секции [CQRS reference](#cqrs-reference).
4. Зарегистрируй `<Resource>Module` в `app.module.ts`.
5. Если ресурс нужен другому модулю — экспортируй commands/queries через `src/<resource>/index.ts` (controller/service/repo остаются приватными).
6. Проверь: `pnpm typecheck && pnpm lint`. Перед открытием PR — пройдись по [REVIEW.md](../../REVIEW.md).
