# JWT-авторизация в API через CQRS

## Контекст

API — голый Nest-скелет: только `AppController` (health), глобальный `PrismaModule` и модели `Category`/`Expense` в Prisma. Нет ни DTO, ни валидации, ни CQRS, ни auth-зависимостей. Задача — добавить аутентификацию по JWT, разделив её на два модуля: `Users` (хранение) и `Auth` (учётные данные, токены), которые взаимодействуют **только** через `@nestjs/cqrs` Command/Query Bus, без прямых импортов сервисов.

**Подтверждённые решения:** `bcrypt`, только access token (~7d), `/register` сразу возвращает `{ accessToken, user }`, `@nestjs/config`.

**Ключевая архитектурная идея.** `Auth` импортирует из `Users` **только** классы-контракты команд/запросов (`CreateUserCommand`, `GetUserByEmailQuery`, `GetUserByIdQuery`) — они являются ключами маршрутизации для `@CommandHandler`/`@QueryHandler`, без них шина в принципе не работает. Никакие сервисы, репозитории или сам `UsersModule` Auth-модулем не импортируются. Хеширование (`bcrypt.hash`/`bcrypt.compare`) живёт в `AuthService` — `Users` ничего не знает о паролях, хранит уже готовый `passwordHash`.

## Шаг 1 — Зависимости (пользователь запускает вручную)

```bash
pnpm add --filter @expense-tracker/api \
  @nestjs/cqrs @nestjs/jwt @nestjs/passport @nestjs/config \
  passport passport-jwt bcrypt class-validator class-transformer

pnpm add --filter @expense-tracker/api -D @types/passport-jwt @types/bcrypt
```

Если нативный `bcrypt` не соберётся на M-серии — fallback `bcryptjs` (тот же API).

## Шаг 2 — Prisma

В [apps/api/prisma/schema.prisma](../../apps/api/prisma/schema.prisma) добавить:

```prisma
model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Без связи с `Expense` (вне scope). Миграция:

```bash
pnpm --filter @expense-tracker/api prisma:migrate -- --name add_user
```

## Шаг 3 — Env

[apps/api/.env](../../apps/api/.env):
```
JWT_SECRET="dev-secret-change-me-32+chars-of-entropy"
JWT_EXPIRES_IN="7d"
```

[apps/api/.env.example](../../apps/api/.env.example):
```
JWT_SECRET="replace-with-a-long-random-string"
JWT_EXPIRES_IN="7d"
```

## Шаг 4 — Общие типы

Дописать в конец [packages/types/src/index.ts](../../packages/types/src/index.ts) (поверх `ISODateString`):

```ts
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
export interface RegisterInput { name: string; email: string; password: string; }
export interface LoginInput { email: string; password: string; }
export interface AuthResponse { accessToken: string; user: User; }
```

Публичный `User` **не содержит** `passwordHash` — он живёт только в строке Prisma и срезается на границе `AuthService` / `JwtStrategy`.

## Шаг 5 — Users module (CQRS, без сервиса наружу)

Создать `apps/api/src/users/`:

```
users/
├─ users.module.ts          # imports: [CqrsModule]; providers: [UsersRepository, ...Handlers]; БЕЗ exports
├─ users.repository.ts      # инжектит PrismaService; create / findByEmail / findById
├─ commands/
│  ├─ create-user.command.ts        # class CreateUserCommand(name, email, passwordHash)
│  └─ handlers/create-user.handler.ts
├─ queries/
│  ├─ get-user-by-email.query.ts
│  ├─ get-user-by-id.query.ts
│  └─ handlers/{get-user-by-email,get-user-by-id}.handler.ts
└─ index.ts                 # barrel: РЕЭКСПОРТ ТОЛЬКО классов команд/запросов
```

- `UsersRepository` — единственное место, где трогается `PrismaService`. Возвращает полную строку Prisma (с `passwordHash`).
- `CreateUserHandler` ловит `Prisma.PrismaClientKnownRequestError` с `code === 'P2002'` и бросает `ConflictException('Email already registered')`. Возвращает полную строку (включая хеш) — caller (AuthService) сам срезает.
- Query-хендлеры возвращают полную строку либо `null`.
- `users/index.ts` экспортирует **только** три класса контрактов — `UsersRepository` и хендлеры наружу не выпускаются физически.

## Шаг 6 — Auth module

Создать `apps/api/src/auth/`:

```
auth/
├─ auth.module.ts           # imports: [CqrsModule, PassportModule, JwtModule.registerAsync(...)]
├─ auth.controller.ts       # POST /auth/register, POST /auth/login
├─ auth.service.ts          # CommandBus + QueryBus + JwtService + bcrypt
├─ dto/{register,login}.dto.ts   # class-validator, implements RegisterInput/LoginInput
├─ strategies/jwt.strategy.ts    # PassportStrategy(Strategy, 'jwt'); validate → QueryBus(GetUserByIdQuery)
└─ guards/jwt-auth.guard.ts      # class JwtAuthGuard extends AuthGuard('jwt')
```

`JwtModule.registerAsync` — фабрика через `ConfigService`:
```ts
useFactory: (cfg: ConfigService) => ({
  secret: cfg.getOrThrow('JWT_SECRET'),
  signOptions: { expiresIn: cfg.get('JWT_EXPIRES_IN') ?? '7d' },
})
```

`AuthService` — единственные импорты из Users:
```ts
import { CreateUserCommand, GetUserByEmailQuery } from '../users';
```

`register`: `bcrypt.hash(password, 12)` → `commandBus.execute(new CreateUserCommand(...))` → `sign(row)`.
`login`: `queryBus.execute(new GetUserByEmailQuery(email))` → если `!row || !bcrypt.compare(...)` → `UnauthorizedException('Invalid credentials')` (одинаковое сообщение для обоих случаев — никаких enumeration-утечек). Иначе `sign(row)`.
`sign(row)`: `jwt.sign({ sub: row.id, email: row.email })`, затем деструктуризация `const { passwordHash, ...user } = row` и возврат `{ accessToken, user }`.

`JwtStrategy.validate({ sub })`: `queryBus.execute(new GetUserByIdQuery(sub))` → если `null` → `UnauthorizedException()`, иначе вернуть user без `passwordHash`. Passport положит результат в `request.user`.

`JwtAuthGuard` — пустой подкласс `AuthGuard('jwt')`, написан для будущего применения (защита `/expenses` и т.п.); в этой задаче нигде не используется.

DTO используют `class-validator` (`@IsEmail`, `@MinLength(8)`, `@IsString` и т.д.) и `implements RegisterInput`/`LoginInput` — компилятор гарантирует совпадение с wire-контрактом.

## Шаг 7 — AppModule

В [apps/api/src/app.module.ts](../../apps/api/src/app.module.ts):
```ts
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  PrismaModule,
  UsersModule,
  AuthModule,
],
```

`ConfigModule` должен быть глобальным и идти первым — `JwtModule.registerAsync` зависит от `ConfigService`.

## Шаг 8 — main.ts

В [apps/api/src/main.ts](../../apps/api/src/main.ts) перед `app.listen`:
```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```

## Верификация

```bash
pnpm install
pnpm db:up
pnpm --filter @expense-tracker/api prisma:migrate -- --name add_user
pnpm dev:api
```

1. **Register (ok)**: `POST /auth/register {name,email,password}` → 201, `{accessToken, user}` без `passwordHash`.
2. **Register (duplicate)**: тот же email → 409 `Email already registered`.
3. **Register (validation)**: невалидный email / короткий пароль → 400 с сообщениями class-validator.
4. **Register (whitelist)**: лишнее поле `admin:true` → 400 `admin should not exist` (проверка `forbidNonWhitelisted`).
5. **Login (ok)**: верные креды → 200, `{accessToken, user}`.
6. **Login (wrong pw)**: → 401 `Invalid credentials`.
7. **Login (unknown email)**: → **идентичный** 401 с тем же телом (нет утечки).
8. **JWT payload**: декодировать `accessToken` — должны быть `sub`, `email`, `iat`, `exp` (= iat + 604800).
9. **Static**: `pnpm typecheck` и `pnpm lint` зелёные во всей монорепе (`packages/types` подтянется в `apps/web` тоже).

## Вне scope

- Защита `/expenses`/`/categories` гвардом `JwtAuthGuard` (гвард написан, но нигде не применяется — отдельная задача).
- Связь `User ↔ Expense`.
- Refresh-токены, ротация, отзыв, blacklist.
- Verification email, password reset, change-password.
- Rate limiting, lockout, audit log.
- Тесты — в репо ещё нет test-раннера (нет скрипта `test` в `apps/api/package.json`).
- `@CurrentUser()`-декоратор.

## Критичные файлы

- [apps/api/prisma/schema.prisma](../../apps/api/prisma/schema.prisma) — добавить `User`
- [apps/api/src/app.module.ts](../../apps/api/src/app.module.ts) — подключить `ConfigModule`, `UsersModule`, `AuthModule`
- [apps/api/src/main.ts](../../apps/api/src/main.ts) — глобальный `ValidationPipe`
- [apps/api/package.json](../../apps/api/package.json) — новые зависимости
- [apps/api/.env](../../apps/api/.env) и [apps/api/.env.example](../../apps/api/.env.example) — `JWT_SECRET`, `JWT_EXPIRES_IN`
- [packages/types/src/index.ts](../../packages/types/src/index.ts) — `User`, `RegisterInput`, `LoginInput`, `AuthResponse`
- Новые директории: `apps/api/src/users/`, `apps/api/src/auth/`
