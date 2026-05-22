# REVIEW.md — правила ревью для expense-tracker

Operational source of truth для PR-ревью: конкретные правила, проверяемые при ревью, живут здесь. Архитектурный обзор и повседневная работа с кодом (workspace layout, env vars, чеклисты добавления нового ресурса/страницы, уникальные паттерны вроде token bridge) — в корневом [`CLAUDE.md`](CLAUDE.md) и workspace-гайдах [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) / [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md).

Ревьюер проходит секции сверху вниз. Пункты со словом **блокер** обязаны быть выполнены до approve. Остальное — комментарии/предложения, не блокирующие мерж.

## 0. Перед открытием PR (автор)

- [ ] `pnpm typecheck` зелёный.
- [ ] `pnpm lint` зелёный.
- [ ] Затронут билдабельный workspace — `pnpm build:web` / `pnpm build:api` локально проходит.
- [ ] Ветка не отстала от `main` (`git fetch && git rebase origin/main`).
- [ ] PR-заголовок — Conventional Commits на английском (`feat(web): add expenses filters`); тело PR — на русском, с разделами «Что сделано / Как тестировать / Скриншоты» для UI.
- [ ] Один PR — одна логически связанная задача. Несвязанные правки вынеси в отдельный PR.

## 1. Общие проверки (любой PR)

- [ ] **Блокер.** Diff соответствует заявленной цели PR — нет «попутных» рефакторингов, переименований, форматирования чужого кода.
- [ ] **Блокер.** Нет закоммиченных секретов: `.env`, `.env.local`, JWT-секретов, паролей БД, ключей API. `.env.example` — ок.
- [ ] Не добавлены новые зависимости без согласования. Если добавлены — оправдай выбор (зачем именно эта либа, размер, alternatives) в теле PR.
- [ ] Нет `console.log` / `debugger` / отладочных `dump`-вызовов в продакшен-коде. Серверные логи — через Nest `Logger`, клиентские user-facing сообщения — через `sonner` toast.
- [ ] Нет закомментированного кода и dead-кода («оставил на всякий случай»). Если временно нужен — оставь TODO с контекстом и issue/датой.
- [ ] Комментарии — только там, где WHY неочевиден. Описывать WHAT через комментарии не надо: имена и типы говорят сами.
- [ ] Conventional Commits соблюдены (см. корневой CLAUDE.md). Атомарность: один логический change — один коммит. Squash-сообщение PR тоже валидное.

## 2. Shared types boundary (`packages/types`)

- [ ] **Блокер.** Любой DTO/тип, пересекающий wire (request body, response, query params), живёт в `packages/types` и импортируется обеими сторонами как `@expense-tracker/types`.
- [ ] DTO в `apps/api` **implements** соответствующий интерфейс из `@expense-tracker/types` (см. `CreateCategoryDto implements CreateCategoryInput`). Расхождение типов фронта и бэка — блокер.
- [ ] Нет дублирования типов между `apps/api` и `apps/web`. На фронте новый доменный тип идёт сначала в `packages/types`, потом re-export в `entities/<x>` — не локальная копия в `features/`.
- [ ] Не появилось `packages/db` или другого вынесения Prisma. Prisma остаётся в `apps/api`.

## 3. Backend (`apps/api`) — Nest.js + CQRS

### 3.1. CQRS-структура (новый/изменённый ресурс)

- [ ] **Блокер.** Структура папки повторяет reference (`categories/`, `expenses/`): `controller / service / repository / mapper / module / index.ts / dto / commands(+handlers) / queries(+handlers)`.
- [ ] **Блокер.** `CqrsModule` импортирован в `<resource>.module.ts`, все handlers перечислены в `providers` (иначе они тихо не зарегистрируются).
- [ ] **Controller** — только HTTP: декораторы, `@Body() dto`, `@CurrentUser() user`. Возвращает DTO из `@expense-tracker/types`, **не** Prisma row.
- [ ] **Service** — тонкая: формирует команду/query, диспатчит через `CommandBus`/`QueryBus`, мапит результат. Никакой бизнес-логики и никакого `PrismaService` здесь.
- [ ] **Repository** — единственный класс, инжектящий `PrismaService`. Все Prisma-вызовы — здесь.
- [ ] **Mapper** — чистая функция Prisma row → DTO: `Decimal.toString()`, `Date.toISOString()`, отбрасывание `passwordHash`. Для пагинации — items маппятся в query handler, обёртка `toPaginated*` — в маппере.
- [ ] **Commands** — мутации (`create/update/delete`), возвращают Prisma row либо void. **Queries** — read-only, возвращают row/null либо `{ items, total }` для пагинации.

### 3.2. Cross-module CQRS

- [ ] **Блокер.** Один модуль дёргает другой **только** через `CommandBus`/`QueryBus`. Прямой инъекции чужого репозитория быть не должно.
- [ ] Public CQRS API ресурса экспортируется через `src/<resource>/index.ts`. Controller/service/repository/dto/handler — приватные, не торчат наружу.
- [ ] Если ресурс не имеет публичного HTTP-API (как `users/`) — controller/service отсутствуют сознательно. Не добавляй их «на будущее».

### 3.3. Auth & ownership

- [ ] **Блокер.** Каждый HTTP-метод, работающий с пользовательскими данными, защищён `@UseGuards(JwtAuthGuard)` + `@CurrentUser() user: User`. «Открытых» эндпойнтов с user-данными быть не должно.
- [ ] **Блокер.** Любая query/command, работающая с ownership-ресурсом, принимает `userId` и фильтрует по нему в repository (`{ where: { id, userId } }`). Для Expense — через `category: { userId }`. Проверка владения категорией (`assertCategoryOwnedByUser`) при create/update Expense — обязательна.
- [ ] JWT payload не менялся. Если менялся — это `feat(api)!:` с футером `BREAKING CHANGE:` и обновлением клиента (`features/auth`).
- [ ] `JwtStrategy.validate` тянет свежего пользователя из БД (через `GetUserByIdQuery`), не доверяет полям токена слепо.

### 3.4. DTO & validation

- [ ] Все входящие body — классы `class-validator` + `class-transformer`. Глобальный `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` уже стоит — DTO должны быть совместимы (никаких unknown полей).
- [ ] Trim строк — через `@Transform` на DTO, не в handler.
- [ ] Списочные эндпойнты с пагинацией используют `PaginationQueryDto` из `shared/dto/`, не свой велосипед.

### 3.5. Pagination

- [ ] **Блокер.** В `orderBy` есть tie-breaker (`{ id: 'desc' }` или эквивалент). Сортировка только по неуникальному полю + offset = баги «исчезающих/задвоенных строк».
- [ ] Маппинг row→DTO для items пагинированного ответа — в query handler. Service оборачивает уже DTO в meta (`hasMore = offset + items.length < total`).

### 3.6. Error handling

- [ ] `PrismaClientKnownRequestError` ловится точечно в command handler с маппингом в семантическое Nest-исключение: `P2002` → `ConflictException`, `P2003` → `NotFoundException`, `P2025` → `NotFoundException`.
- [ ] Read-side: `null` → `NotFoundException` в service, не в handler (handler остаётся pure data).
- [ ] Unknown ошибки не глотаются — re-throw после специфичных кейсов.

### 3.7. Prisma

- [ ] Миграция (если есть) приложена в `apps/api/prisma/migrations/`, имя осмысленное. Миграции запускались только если пользователь явно попросил.
- [ ] Денежные поля — `@db.Decimal(12, 2)`, на выходе мапятся через `.toString()`. JS-`number` для денег — блокер.
- [ ] Реляции с `onDelete: Restrict` (Category.user, Expense.category) трогаются только осознанно — изменение каскада требует обоснования в теле PR.
- [ ] Composite uniques (`@@unique([userId, name])`) — соответствующий `P2002` обработан в handler.

### 3.8. Env

- [ ] Новые env-переменные документированы в `apps/api/.env.example` и в таблице env vars `apps/api/CLAUDE.md`.
- [ ] Обязательные секреты читаются через `ConfigService.getOrThrow`, не `.get`.

## 4. Frontend (`apps/web`) — Next.js + FSD

### 4.1. FSD-границы

- [ ] **Блокер.** Импорт-направление сверху вниз: `app → widgets → features → entities → shared`. Лесенки наверх (`shared/` импортирует `features/`) или вбок (`features/auth` импортирует внутрь `features/expenses`) — блокер.
- [ ] **Блокер.** Cross-slice импорт идёт через `index.ts` slice'а (`@/features/expenses`), не во внутренности (`@/features/expenses/ui/ExpensesTable.tsx`).
- [ ] Новый publishable артефакт slice'а добавлен в его `index.ts`. Лишнее наружу не торчит.

### 4.2. App Router

- [ ] Pages в `app/**/page.tsx` — тонкие RSC/`'use client'` обёртки: один `return <SomePage />` из `widgets/`. Бизнес-логика в `app/` — блокер.
- [ ] Новые защищённые страницы лежат в `(app)/` (под `PrivateGuard`), новые публичные — в `(auth)/` (под `PublicOnlyGuard`). Отдельные guards вокруг конкретной страницы не нужны.
- [ ] Layouts с интерактивом (`usePathname`, hooks) помечены `'use client'`.

### 4.3. http-client & auth store

- [ ] **Блокер.** Сетевые запросы идут через `http` из `@/shared/api/http-client`. Прямой `fetch(...)` в feature/widget — блокер (теряем Bearer, нормализацию ошибок, abort).
- [ ] **Блокер.** `http-client` не импортирует `useAuthStore` напрямую. Доступ к токену — только через `registerTokenGetter`. Любой новый shared-модуль, нуждающийся в токене, идёт через тот же getter, **не** через прямой импорт store из `shared/`.
- [ ] `DELETE` типизирован как `http.delete<void>(...)` — 204 уже обработан внутри.
- [ ] Ошибки в UI ловятся как `instanceof ApiError`, у не-`ApiError` — fallback на дефолтное русское сообщение.

### 4.4. Guards & гидратация

- [ ] При добавлении новой группы маршрутов используется существующий guard, не пишется SSR-вариант.
- [ ] `useAuthStore.persist.hasHydrated()` зовётся только внутри `useEffect` (на SSR `persist` не определён). Без гидрации = flash `/login` для авторизованного пользователя.

### 4.5. Forms

- [ ] react-hook-form + `zodResolver`. Схема — в `features/<slice>/model/schema.ts`, `*FormValues = z.infer<typeof Schema>`.
- [ ] Поля — через `@/shared/ui/form` (`Form/FormField/FormControl/FormMessage`), не голый `<input>`.
- [ ] Сообщения валидации — на русском, прямо в zod-схеме (`z.string().min(1, 'Обязательное поле')`), а не размазаны по UI.

### 4.6. Fetching

- [ ] Канонический паттерн — `useEffect` + `AbortController`, без сторонних data-libs. Если хочешь TanStack Query — обсуди с пользователем **до** реализации.
- [ ] `AbortError` (DOMException) явно отфильтрован в `.catch` — это не ошибка, а cleanup.
- [ ] Тосты — через `sonner` (`Toaster` уже смонтирован в root layout). Не добавляй второй стек уведомлений.

### 4.7. Pagination (UI)

- [ ] Серверный ответ типизирован как `PaginatedResponse<T>` из `@expense-tracker/types`.
- [ ] Страничные числа считаются на клиенте через `page` 1-based, `offset = (page - 1) * limit`.
- [ ] Page-list — через `buildPageList(currentPage, totalPages)` из `shared/lib/pagination.ts`, не самописный.
- [ ] При удалении последней строки на странице — откат на предыдущую (см. `ExpensesPage.handleDelete`). При создании — переход на 1-ю страницу (или refetch, если уже там).

### 4.8. shadcn/ui & Tailwind

- [ ] **Блокер.** Новые shadcn-компоненты добавлены **через CLI** (`pnpm --filter @expense-tracker/web dlx shadcn@latest add <name>`), а не руками склонированы. Файлы лежат в `src/shared/ui/`.
- [ ] shadcn-компоненты не дублируются в `features/` — composing only.
- [ ] `components.json` алиасы и `style/baseColor` не менялись вручную.
- [ ] `cn` импортируется из `@/shared/lib/utils`, не из `clsx`/`tailwind-merge` напрямую.

### 4.9. Entities

- [ ] `entities/<x>/index.ts` — тонкий re-export из `@expense-tracker/types`. Локальный copy-paste домена в entity — блокер.
- [ ] Client-only хелперы (форматирование, derived state) лежат в том же entity-slice'е и тоже экспортируются через `index.ts`.

### 4.10. Env

- [ ] Новые публичные env с префиксом `NEXT_PUBLIC_`, типизированы через `shared/config/env.ts`, не дёргаются `process.env.X` напрямую из компонентов.

## 5. Безопасность (отдельный проход — игнорировать нельзя)

- [ ] **Блокер.** Любой HTTP-эндпойнт с user-данными защищён JWT и фильтрует по `userId` (см. 3.3).
- [ ] **Блокер.** Нет SQL-инъекций: используется Prisma typed-API, никаких `prisma.$queryRawUnsafe(userInput)`. Если raw SQL необходим — только `Prisma.sql` template tag с параметрами.
- [ ] **Блокер.** Нет XSS: новый код не вызывает `dangerouslySetInnerHTML` с пользовательскими данными. Если html-рендеринг нужен — санитайзинг или отказ от подхода.
- [ ] **Блокер.** Секреты не попадают в клиент: `JWT_SECRET`, `DATABASE_URL` не префиксированы `NEXT_PUBLIC_` и не логируются.
- [ ] CORS не расширен бездумно: `WEB_ORIGIN` остаётся whitelist, не `*`.
- [ ] Пароли по-прежнему хешируются (`bcrypt` или то, что в `auth/`); в БД и в логах не должно быть plaintext.
- [ ] `passwordHash` нигде не попадает в DTO/response: маппер обязан его отбрасывать.
- [ ] Логирование ошибок не содержит токенов, паролей, всего тела запроса с PII.
- [ ] Нет broad `try/catch` с молчаливым проглатыванием — пользователь должен получить ошибку, разработчик — лог.

## 6. Тесты

Тестового runner'а пока нет в репозитории. Если PR его добавляет:

- [ ] Runner и команда `test` задокументированы в корневом `CLAUDE.md` и соответствующем `apps/*/CLAUDE.md` (single-test invocation).
- [ ] Бэк: критичные пути — handlers, ownership-проверки, мапперы Decimal/Date.
- [ ] Фронт: формы (валидация), guards (поведение до/после гидрации), pagination helpers.

Если PR без runner'а — пункт пропускается, не блокирует.

## 7. Документация

- [ ] Изменилось API/контракт (новый эндпойнт, новый shared-тип) — `packages/types` обновлён; если меняется зона ответственности модуля, отразить в соответствующем `apps/*/CLAUDE.md`.
- [ ] Изменился toolchain/окружение (Node, pnpm, Docker, env) — корневой `CLAUDE.md` обновлён.
- [ ] CQRS-чеклист «Adding a new resource» / FSD-чеклист «Adding a new page» всё ещё актуальны — если процесс изменился, обнови их.
- [ ] Новые env-переменные — в `.env.example` и в таблице env соответствующего `apps/*/CLAUDE.md`.

## 8. Git-гигиена (squash-merge)

- [ ] История коммитов в ветке читаемая (Conventional Commits, маленькие атомарные шаги). Если ветка длинная и грязная — автор делает rebase/clean-up перед approve.
- [ ] Ветка названа по конвенции (`<type>/<kebab-case>`): `feat/expenses-filters`, `fix/auth-flash`, `refactor/...`. Не Jira-ID в имени.
- [ ] Squash-сообщение PR соответствует Conventional Commits и адекватно описывает суммарный change (на момент мержа отредактируется в один заголовок + при желании тело).
- [ ] Нет force-push в `main`. Force-with-lease допустим только в свою feature-ветку.
- [ ] Ветка удаляется после мержа.

## 9. Что НЕ блокирует ревью

Эти вопросы поднимаем как комментарии/идеи, но не блокируем мерж:

- Микро-оптимизации без замеров.
- Стилистические предпочтения, которые не нарушают Prettier/ESLint (пробелы, имена локальных переменных).
- «Можно было бы вынести в хелпер» при единственном использовании.
- Идеи дальнейшего рефакторинга, не относящиеся к scope PR. Это в follow-up issue, не в текущий PR.
- Имена коммитов в внутренней истории ветки, если PR мержится через squash и итоговое сообщение валидное.

## Шаблон ревью-комментариев

Если оставляешь блокер: укажи **почему** и сошлись на правило (CLAUDE.md / этот файл). Шаблон:

> **Блокер.** `apps/web/src/features/expenses/ui/ExpensesPage.tsx:42` — прямой `fetch(...)` минует `http-client`, теряем Bearer + нормализацию `ApiError`. См. правило 4.3 в [REVIEW.md](REVIEW.md). Перепиши через `expensesApi.list(...)`.

Не-блокер — без префикса, как обычное предложение.

## Пропускать при ревью
- Файлы миграций Prisma (`prisma/migrations/**`)
- `package-lock.json` и другие lock-файлы
- `*.log` файлы
