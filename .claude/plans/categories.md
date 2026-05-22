# Categories module for `apps/api`

## Context

Бэкенд скелет уже содержит JWT-авторизацию (Passport + CQRS), `UsersModule` с готовой CQRS-структурой (commands/queries/handlers + repository), глобальный `PrismaModule` и глобальный `ValidationPipe`. Сущность `Category` в Prisma-схеме существует, но **не связана с пользователем**: нет `userId`, имя глобально-уникально, чужие категории смешаны с твоими.

Задача — закрыть этот зазор: ввести владение категориями (FK к `User`), отдать наружу JWT-защищённый CRUD-ресурс с валидацией DTO и взаимодействием с `UsersModule` через CQRS-патерны (без прямой инжекции репозиториев между модулями).

Решения, согласованные с пользователем:

- Миграция — **деструктивная** (БД dev): `prisma migrate reset` + новая миграция `add_category_user` с `userId NOT NULL`.
- `onDelete` для `User → Category` — **Restrict** (нельзя удалить пользователя, пока есть категории).
- Имя категории — `@@unique([userId, name])` (per-user).
- Чужая категория → возвращаем **404** (не 403), чтобы не выдавать существование.

## Изменения схемы

`apps/api/prisma/schema.prisma` — две модели:

```prisma
model User {
  id           String     @id @default(cuid())
  name         String
  email        String     @unique
  passwordHash String
  categories   Category[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

model Category {
  id        String    @id @default(cuid())
  name      String
  color     String?
  icon      String?
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Restrict)
  expenses  Expense[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([userId, name])
  @@index([userId])
}
```

Старый `@unique` на `Category.name` снимается. `Expense` не трогаем — `userId` появится у трат отдельной фичей.

## Изменения общих типов

`packages/types/src/index.ts` — в интерфейс `Category` добавить `userId: string`. `CreateCategoryInput` и `UpdateCategoryInput` оставить как есть: `userId` не должен прилетать с клиента (берётся из JWT, при попытке прислать — отсекается `forbidNonWhitelisted`).

## Новый модуль `apps/api/src/categories/`

Структура по образцу `apps/api/src/users/` (CQRS + repository) плюс тонкие `CategoriesService` и `CategoriesController` (как пара `AuthService`/`AuthController` в `apps/api/src/auth/`).

```
apps/api/src/categories/
  categories.module.ts
  categories.controller.ts
  categories.service.ts
  categories.repository.ts
  category.mapper.ts
  index.ts                       // реэкспорт команд/запросов для будущего ExpensesModule
  dto/
    create-category.dto.ts
    update-category.dto.ts
  commands/
    create-category.command.ts
    update-category.command.ts
    delete-category.command.ts
    handlers/
      create-category.handler.ts
      update-category.handler.ts
      delete-category.handler.ts
  queries/
    get-categories-by-user.query.ts
    get-category-by-id-for-user.query.ts
    handlers/
      get-categories-by-user.handler.ts
      get-category-by-id-for-user.handler.ts
```

### Repository — `categories.repository.ts`

Инжектит `PrismaService` (глобально доступен через `apps/api/src/prisma/prisma.module.ts`). Образец инжекции — `apps/api/src/users/users.repository.ts`.

Методы:

- `createForUser(userId, data)` — `prisma.category.create({ data: { ...data, userId } })`.
- `findAllByUser(userId)` — `findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })`.
- `findOneByUser(id, userId)` — `findFirst({ where: { id, userId } })` (фильтр и по `id`, и по `userId` — null вместо чужой записи).
- `updateForUser(id, userId, data)` — `updateMany({ where: { id, userId }, data })`; атомарно, без TOCTOU. Возвращает `{ count }`.
- `deleteForUser(id, userId)` — `deleteMany({ where: { id, userId } })`.

### CQRS — commands и queries

- `CreateCategoryCommand(userId, name, color?, icon?)`
- `UpdateCategoryCommand(id, userId, data: { name?, color?, icon? })`
- `DeleteCategoryCommand(id, userId)`
- `GetCategoriesByUserQuery(userId)`
- `GetCategoryByIdForUserQuery(id, userId)`

Handlers — по образцу `apps/api/src/users/commands/handlers/create-user.handler.ts`:

- **Create**: ловим `Prisma.PrismaClientKnownRequestError`. `P2002` → `ConflictException('Category with this name already exists')`. `P2003` → `NotFoundException('User not found')` (защита от удалённого user с ещё валидным JWT).
- **Update**: если `data` пустой → `BadRequestException('No fields to update')`. После `updateMany` проверяем `count`: `0` → `NotFoundException`. Затем `findOneByUser` для свежего объекта. `P2002` на переименование → `ConflictException`.
- **Delete**: после `deleteMany` если `count === 0` → `NotFoundException`. `P2003` (`Restrict` на `Expense → Category`) → `ConflictException('Cannot delete category with existing expenses')`.
- **Queries**: возвращают данные «как есть» (массив или nullable объект); HTTP-семантику добавит сервис.

### DTO — class-validator

**`dto/create-category.dto.ts`** (`implements CreateCategoryInput` из `@expense-tracker/types`):

- `name: string` — `@IsString() @MinLength(1) @MaxLength(60) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)`.
- `color?: string` — `@IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/)`.
- `icon?: string` — `@IsOptional() @IsString() @MaxLength(40)` (regex-проверку формата иконки оставим на потом — TODO).

**`dto/update-category.dto.ts`** (`implements UpdateCategoryInput`): те же поля, все `@IsOptional()`. Для `color` и `icon` — разрешаем `null` (очистка) через `@ValidateIf((_, v) => v !== null)` перед другими декораторами. Глобальный `ValidationPipe` (whitelist + forbidNonWhitelisted + transform) уже включён в `apps/api/src/main.ts`.

### Service — `categories.service.ts`

Тонкая прослойка, инжектит `CommandBus` и `QueryBus` (как `AuthService` — это уже принятый паттерн в проекте, поэтому отдельного сервисного слоя в Users нет, но здесь он оправдан явным требованием «сервис с методами»). Методы: `create`, `findAll`, `findOne` (бросает `NotFoundException`, если query вернула `null`), `update`, `remove`. Внутри — `commandBus.execute(...)` / `queryBus.execute(...)` и маппинг `Prisma.Category → @expense-tracker/types.Category` через `toCategoryDto` (см. ниже).

### Mapper — `category.mapper.ts`

```ts
export function toCategoryDto(row: PrismaCategory): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
```

По образцу `AuthService.sign()` — там тот же подход к ISO-сериализации дат.

### Controller — `categories.controller.ts`

```ts
@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Post()                       create(@CurrentUser() user, @Body() dto: CreateCategoryDto)
  @Get()                        findAll(@CurrentUser() user)
  @Get(':id')                   findOne(@CurrentUser() user, @Param('id') id)
  @Patch(':id')                 update(@CurrentUser() user, @Param('id') id, @Body() dto: UpdateCategoryDto)
  @Delete(':id') @HttpCode(204) remove(@CurrentUser() user, @Param('id') id)
}
```

Использует существующий `apps/api/src/auth/guards/jwt-auth.guard.ts`.

### Module — `categories.module.ts`

`imports: [CqrsModule]`, `controllers: [CategoriesController]`, `providers: [CategoriesService, CategoriesRepository, ...CommandHandlers, ...QueryHandlers]`. `PrismaService` доступен глобально, импортировать `PrismaModule` отдельно не надо.

## Новый декоратор `@CurrentUser()`

`apps/api/src/auth/decorators/current-user.decorator.ts` — однострочный `createParamDecorator`, возвращающий `req.user` с типом `User` из `@expense-tracker/types`. Понадобится и для будущего `ExpensesModule`, поэтому стоит сделать сразу.

```ts
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User =>
    ctx.switchToHttp().getRequest<{ user: User }>().user,
);
```

## Регистрация в `AppModule`

`apps/api/src/app.module.ts` — добавить `CategoriesModule` в `imports`.

## Взаимодействие с UsersModule

Категории **не инжектируют** ничего из `UsersModule` напрямую. CQRS-связка остаётся такой:

- `JwtAuthGuard` → `JwtStrategy.validate()` → `queryBus.execute(new GetUserByIdQuery(...))` — уже существует в `apps/api/src/auth/strategies/jwt.strategy.ts`. На каждый защищённый запрос пользователь свежо читается из БД.
- В handler'ах категорий повторную проверку user не делаем — `req.user` гарантированно валиден. Защита от состояния «user удалён после выдачи токена» уже даёт FK + `P2003` в `CreateCategoryHandler`.

## Команды миграции (НЕ выполнять — попросить разрешения)

```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
pnpm db:up
pnpm --filter @expense-tracker/api exec prisma migrate reset --force
pnpm --filter @expense-tracker/api exec prisma migrate dev --name add_category_user
```

`migrate dev` сгенерирует и Prisma Client.

## Verification

После реализации и применения миграции:

1. `pnpm typecheck` и `pnpm lint` — без ошибок.
2. `pnpm dev:api` — поднять API на `:3001` (нет global prefix).
3. End-to-end сценарий (`curl` + сохранение `TOKEN` из ответа `/auth/login`):
   - `POST /auth/register` → 201.
   - `POST /auth/login` → достать `accessToken`.
   - `POST /categories` с `{ name, color:"#3366ff", icon:"cart" }` → 201, в ответе `userId === user.id`.
   - `GET /categories` → 200, массив.
   - `GET /categories/:id` → 200; `:id` чужого user → 404 (второй аккаунт).
   - `PATCH /categories/:id` с `{ color:"#ff0033", icon:null }` → 200, `icon: null`.
   - `POST /categories` с дубликатом `name` → 409.
   - `POST /categories` с `userId:"hack"` → 400 (`forbidNonWhitelisted`).
   - `POST /categories` с `color:"red"` → 400 (regex).
   - `GET /categories` без `Authorization` → 401.
   - `DELETE /categories/:id` → 204; повтор → 404.

## Critical files to edit

- `apps/api/prisma/schema.prisma`
- `packages/types/src/index.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/auth/decorators/current-user.decorator.ts` (new)
- Полностью новая директория `apps/api/src/categories/` — список файлов выше.
- Новая миграция `apps/api/prisma/migrations/<ts>_add_category_user/migration.sql` (генерируется Prisma).

---

## Чек-лист задач

### Schema & shared types

- [ ] Обновить `apps/api/prisma/schema.prisma`: добавить `categories Category[]` в `User`; в `Category` добавить `userId`, relation `user`, `@@unique([userId, name])`, `@@index([userId])`; снять `@unique` с `name`.
- [ ] Обновить `packages/types/src/index.ts`: добавить `userId: string` в интерфейс `Category`. `CreateCategoryInput`/`UpdateCategoryInput` не трогать.

### Auth: декоратор

- [ ] Создать `apps/api/src/auth/decorators/current-user.decorator.ts` (`createParamDecorator`, возвращает `req.user` с типом `User`).

### Categories: CQRS

- [ ] `apps/api/src/categories/commands/create-category.command.ts`
- [ ] `apps/api/src/categories/commands/update-category.command.ts`
- [ ] `apps/api/src/categories/commands/delete-category.command.ts`
- [ ] `apps/api/src/categories/commands/handlers/create-category.handler.ts` (`P2002` → 409, `P2003` → 404)
- [ ] `apps/api/src/categories/commands/handlers/update-category.handler.ts` (`updateMany`, `count === 0` → 404, `P2002` → 409, пустой `data` → 400)
- [ ] `apps/api/src/categories/commands/handlers/delete-category.handler.ts` (`deleteMany`, `count === 0` → 404, `P2003` → 409)
- [ ] `apps/api/src/categories/queries/get-categories-by-user.query.ts`
- [ ] `apps/api/src/categories/queries/get-category-by-id-for-user.query.ts`
- [ ] `apps/api/src/categories/queries/handlers/get-categories-by-user.handler.ts`
- [ ] `apps/api/src/categories/queries/handlers/get-category-by-id-for-user.handler.ts`

### Categories: инфраструктура модуля

- [ ] `apps/api/src/categories/categories.repository.ts` (методы `createForUser`, `findAllByUser`, `findOneByUser`, `updateForUser`, `deleteForUser`).
- [ ] `apps/api/src/categories/category.mapper.ts` (`toCategoryDto` — Prisma → `@expense-tracker/types.Category`).
- [ ] `apps/api/src/categories/dto/create-category.dto.ts` (`name`, `color?`, `icon?` с class-validator).
- [ ] `apps/api/src/categories/dto/update-category.dto.ts` (все поля опциональные, `null` для `color`/`icon` разрешён через `@ValidateIf`).
- [ ] `apps/api/src/categories/categories.service.ts` (тонкая прослойка `CommandBus`/`QueryBus`, маппинг на DTO, `findOne` бросает 404 при `null`).
- [ ] `apps/api/src/categories/categories.controller.ts` (`@UseGuards(JwtAuthGuard)`, эндпоинты POST/GET/GET:id/PATCH/DELETE, `@CurrentUser()`).
- [ ] `apps/api/src/categories/categories.module.ts` (`imports: [CqrsModule]`, провайдеры репо/сервис/handlers).
- [ ] `apps/api/src/categories/index.ts` (реэкспорт команд и запросов).

### Регистрация и миграция

- [ ] `apps/api/src/app.module.ts` — подключить `CategoriesModule`.
- [ ] Спросить разрешение и запустить деструктивную миграцию: `prisma migrate reset --force` + `prisma migrate dev --name add_category_user`.

### Проверка

- [ ] `pnpm typecheck` без ошибок.
- [ ] `pnpm lint` без ошибок.
- [ ] End-to-end smoke-тест через `curl` по сценариям из раздела Verification.
