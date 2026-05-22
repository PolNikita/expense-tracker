# apps/api — CLAUDE.md

Workspace-specific guidance for the Nest.js backend. Root [`CLAUDE.md`](../../CLAUDE.md) covers repo-wide conventions (toolchain, monorepo, commits, branching) — read it first.

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

## CQRS pattern

Reference implementation — [`apps/api/src/categories/`](src/categories) и [`apps/api/src/expenses/`](src/expenses). Все новые ресурсы строим по этой же схеме.

```
<resource>/
├── <resource>.controller.ts          # HTTP layer: @UseGuards(JwtAuthGuard), @CurrentUser()
├── <resource>.service.ts             # thin: только dispatch через CommandBus/QueryBus + mapper
├── <resource>.repository.ts          # единственное место, где живёт PrismaService
├── <resource>.mapper.ts              # Prisma row → DTO из @expense-tracker/types
├── <resource>.module.ts              # imports: [CqrsModule], providers: [...handlers, service, repo]
├── index.ts                          # экспорт команд/queries для cross-module access
├── dto/                              # class-validator DTOs (HTTP boundary)
├── commands/
│   ├── <name>.command.ts             # plain class с конструктором-payload
│   └── handlers/<name>.handler.ts    # @CommandHandler(...) — инжектит repository
└── queries/
    ├── <name>.query.ts
    └── handlers/<name>.handler.ts    # @QueryHandler(...)
```

**Слои и правила:**

- **Controller** — только HTTP: декораторы, валидация (`@Body() dto: SomeDto`), извлечение пользователя через `@CurrentUser()`. Возвращает DTO из `@expense-tracker/types`, не Prisma-row.
- **Service** — тонкая обёртка: формирует команду/query, диспатчит, маппит результат. Никакой бизнес-логики напрямую (она в handler'ах) и никакого Prisma. Если service превращается в толстый — что-то делаем не так.
- **Repository** — единственный класс, инжектящий `PrismaService`. Все ownership-проверки (`{ where: { id, userId } }` или `{ where: { id, category: { userId } } }` для expenses) живут тут.
- **Mapper** — чистая функция Prisma row → DTO. `Decimal.toString()`, `Date.toISOString()`, отбрасывание `passwordHash` и т.п. Для пагинированных ответов — отдельная функция-обёртка (`toPaginatedExpenses`), сами items маппятся в query handler.
- **Commands** — мутации (create/update/delete). Возвращают Prisma row (или void для delete) — service потом мапит.
- **Queries** — чтение. Read-side обычно возвращает Prisma row[]/null; для пагинации query handler уже маппит в DTO и возвращает `{ items, total }`.

**Регистрация:** в `<resource>.module.ts` импортируется `CqrsModule`, все handlers перечисляются в `providers`. Без `CqrsModule` в imports — handlers не зарегистрируются.

## Cross-module CQRS access

Один модуль может дёргать команды/queries другого **только через CommandBus/QueryBus** — никакой прямой инъекции чужих репозиториев.

Пример: `AuthService` использует пользователей через `CreateUserCommand` / `GetUserByEmailQuery` / `GetUserByIdQuery`, импортируемые из [`users/index.ts`](src/users/index.ts). Сам `UsersRepository` остаётся приватным внутри `UsersModule`.

Каждый ресурс выставляет public CQRS API через `src/<resource>/index.ts` (см. [`users/index.ts`](src/users/index.ts), [`categories/index.ts`](src/categories/index.ts), [`expenses/index.ts`](src/expenses/index.ts)). DTO/handlers — приватные.

`UsersModule` не имеет controller/service — это сознательно: users экспонируются наружу только как CQRS-операции, потребляемые `AuthModule`.

## Auth & ownership

- **JWT payload** — `{ sub, email }`. `sub` = `user.id`. Если будешь менять payload — это breaking change для всех клиентов (см. `feat(api)!` в корневом CLAUDE.md).
- **JwtStrategy** при валидации тянет свежего пользователя из БД (через `GetUserByIdQuery`) и кладёт в `request.user` — без `passwordHash`, с `createdAt`/`updatedAt` уже в ISO.
- **`@UseGuards(JwtAuthGuard)`** на контроллере + **`@CurrentUser() user: User`** в каждом методе — единственный способ получить пользователя в контроллере.
- **Ownership scoping** — обязательно. Любая query/command, работающая с ресурсом, принимает `userId` и фильтрует по нему. Для Expense, у которой нет прямого `userId`, фильтруем через `category: { userId }`. См. `ExpensesRepository.assertCategoryOwnedByUser` — проверка владения категорией перед create/update.

## DTO & validation

- Все входящие тела — классы с декораторами `class-validator` + `class-transformer`. `main.ts` ставит глобальный `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`:
  - `whitelist` — режет неизвестные поля
  - `forbidNonWhitelisted` — 400 при их наличии
  - `transform` — приводит query-string числа к `number` (важно для `PaginationQueryDto`)
- DTO **implements** соответствующий интерфейс из `@expense-tracker/types` — runtime-валидация остаётся в Nest, типы согласованы с фронтом. Пример: `CreateCategoryDto implements CreateCategoryInput`.
- Trim строк делается на DTO через `@Transform` (см. `CreateCategoryDto.name`) — не в handler.

## Pagination

Постраничные list-эндпойнты используют [`PaginationQueryDto`](src/shared/dto/pagination-query.dto.ts) (`limit` 1..100 = 10, `offset` 0..100_000 = 0).

В Prisma `orderBy` **всегда** добавляй tie-breaker (`{ id: 'desc' }` или аналог), иначе одинаковые значения primary-сорта будут давать недетерминированный порядок и offset-пагинация будет пропускать/задваивать строки. Пример: `ExpensesRepository.findAllByUser` — `orderBy: [{ spentAt: 'desc' }, { id: 'desc' }]`.

Меta-обёртка (`toPaginatedExpenses`) считает `hasMore = offset + items.length < total`. Маппинг row→DTO делается **в query handler**, не в service — service получает уже готовые DTO и оборачивает в meta.

## Error handling

- `Prisma.PrismaClientKnownRequestError` ловим точечно в command handlers и кидаем семантические Nest-исключения:
  - `P2002` (unique constraint) → `ConflictException`
  - `P2003` (FK violation) → `NotFoundException`
  - `P2025` (record not found на update/delete) → `NotFoundException`
- Read-side: если query вернула `null` — кидаем `NotFoundException` в service (а не в handler), чтобы handler оставался pure data layer.
- Не глотай unknown ошибки — re-throw после специфичных кейсов.

## Prisma conventions

- Schema живёт в [`prisma/schema.prisma`](prisma/schema.prisma), миграции — в [`prisma/migrations/`](prisma/migrations). **Не выноси Prisma в `packages/db`** — backend единственный консьюмер.
- `@db.Decimal(12, 2)` для денежных полей. На выходе мапим через `.toString()` (см. `toExpenseDto`) — JS-`number` потерял бы точность.
- `onDelete: Restrict` на связях `Category.user` и `Expense.category` — нельзя удалить пользователя/категорию, у которых есть зависимые записи. Если меняешь — продумай каскад в product flow.
- Composite uniques (`@@unique([userId, name])` у `Category`) — повод обработать `P2002` в соответствующем handler.

## Adding a new resource — checklist

1. Добавь модель в `schema.prisma`, сгенерируй миграцию: `pnpm --filter @expense-tracker/api prisma:migrate` (только когда пользователь попросил).
2. Добавь shared DTO/типы в `packages/types` (см. правило **Shared types boundary** в корневом CLAUDE.md).
3. Создай папку `src/<resource>/` по структуре из секции [CQRS pattern](#cqrs-pattern).
4. Зарегистрируй `<Resource>Module` в `app.module.ts`.
5. Если ресурс нужен другому модулю — экспортируй commands/queries через `src/<resource>/index.ts` (controller/service/repo остаются приватными).
6. Проверь: `pnpm typecheck && pnpm lint`.
