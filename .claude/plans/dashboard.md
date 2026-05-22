# План: главный экран (Dashboard)

## Context

Текущий `/dashboard` — одна карточка с приветствием. Нужно превратить его в полноценный главный экран: профиль пользователя, навигация в транзакции и категории, последние 10 транзакций с пагинацией. Это первая фича по GitHub Flow на ветке `feat/main-screen`. Backend на `GET /expenses` пока не умеет пагинацию — её нужно ввести, причём по согласованному решению **меняем контракт целиком** на `PaginatedResponse<Expense>` и обновляем `ExpensesPage` под новый формат. Пагинация на UI — **номера страниц** (`1 2 3 ... N`). Страница `/categories` пока **stub** ("В разработке"), чтобы ссылка из меню работала.

Архитектура — Feature-Sliced Design, как описано в `CLAUDE.md`: `app → widgets → features → entities → shared`, импорты строго сверху вниз, у каждого slice публичный API через `index.ts`.

## Scope

### Backend (`apps/api`)

Расширить `GET /expenses` до пагинированного эндпоинта.

- **`packages/types/src/index.ts`** — добавить generic-тип:
  ```ts
  export interface PaginationMeta { total: number; limit: number; offset: number; hasMore: boolean }
  export interface PaginatedResponse<T> { items: T[]; meta: PaginationMeta }
  ```
- **`apps/api/src/shared/dto/pagination-query.dto.ts`** (новый) — `class-validator` DTO с `@IsOptional @IsInt @Min(1) @Max(100) limit = 10` и `@IsOptional @IsInt @Min(0) offset = 0`, через `@Transform(({ value }) => Number(value))`. Лежит в `shared/dto/`, чтобы переиспользовать на категориях позже. Если такого каталога нет — создать.
- **`apps/api/src/expenses/expenses.repository.ts`** — изменить сигнатуру:
  ```ts
  findAllByUser(userId: string, { limit, offset }: { limit: number; offset: number }): Promise<{ items: Expense[]; total: number }>
  ```
  Внутри — `prisma.$transaction([findMany({ where, orderBy: { spentAt: 'desc' }, take, skip }), count({ where })])`.
- **`apps/api/src/expenses/queries/get-expenses-by-user.query.ts`** — добавить поля `limit`, `offset` в query class.
- **`apps/api/src/expenses/queries/handlers/get-expenses-by-user.handler.ts`** — пробросить пагинацию в репо, вернуть `{ items, total }`.
- **`apps/api/src/expenses/expense.mapper.ts`** — добавить хелпер `toPaginated({ items, total }, { limit, offset }): PaginatedResponse<Expense>` (вычисляет `hasMore = offset + items.length < total`, маппит каждый item существующей функцией).
- **`apps/api/src/expenses/expenses.service.ts`** — `findAll(userId, pagination)` возвращает `PaginatedResponse<Expense>`.
- **`apps/api/src/expenses/expenses.controller.ts`** — `findAll(@Query() pagination: PaginationQueryDto, @CurrentUser() user)` → `PaginatedResponse<Expense>`. Применить `ValidationPipe` со включённым `transform: true` (проверить `apps/api/src/main.ts` — он уже включён глобально).

### Frontend (`apps/web`)

**Shared**

- **`apps/web/src/shared/ui/pagination.tsx`** — установить через `pnpm --filter @expense-tracker/web dlx shadcn@latest add pagination` (с разрешения пользователя на установку, согласно конвенции в `CLAUDE.md` — спрошу при выполнении).
- **`apps/web/src/shared/lib/pagination.ts`** (новый) — чистая функция `buildPageList(currentPage, totalPages): (number | 'ellipsis')[]`. Возвращает что-то вроде `[1, 'ellipsis', 4, 5, 6, 'ellipsis', 12]`. Без зависимостей от домена, поэтому в `shared`.
- **`apps/web/src/shared/api/endpoints.ts`** — без изменений, `ENDPOINTS.expenses` уже есть.

**Entities**

- **`apps/web/src/entities/expense/index.ts`** — добавить `export type { PaginatedResponse, PaginationMeta } from '@expense-tracker/types'` для удобного импорта в widgets/features.

**Features**

- **`apps/web/src/features/expenses/api/expenses-api.ts`** — обновить сигнатуру:
  ```ts
  list: (params: { limit: number; offset: number }) =>
    http.get<PaginatedResponse<Expense>>(`${ENDPOINTS.expenses}?limit=${params.limit}&offset=${params.offset}`)
  ```
  (или собирать через `URLSearchParams`).
- **`apps/web/src/features/expenses/ui/ExpensesTable.tsx`** — сделать `onUpdate`/`onDelete` опциональными. Колонка «Действия» рендерится только если переданы коллбэки. Тип props:
  ```ts
  { expenses: Expense[]; categories: Category[]; onUpdate?: (e: Expense) => void; onDelete?: (id: string) => void }
  ```
- **`apps/web/src/features/expenses/ui/ExpensesPagination.tsx`** (новый) — обёртка над `shared/ui/pagination`, props `{ page, pageSize, total, onPageChange }`. Использует `buildPageList` из shared. Скрывает себя при `total <= pageSize`.
- **`apps/web/src/features/expenses/index.ts`** — публичный API расширяется: `expensesApi`, `categoriesApi`, `ExpensesTable`, `ExpensesPagination`, `CreateExpenseDialog`, `EditExpenseDialog`, `DeleteExpenseDialog`. Дашборд должен иметь доступ к `expensesApi`, `categoriesApi`, `ExpensesTable`, `ExpensesPagination`.

**Widgets**

- **`apps/web/src/widgets/dashboard/ui/DashboardPage.tsx`** — переписать как композицию:
  ```tsx
  <div className="space-y-6">
    <UserProfileCard />
    <DashboardMenu />
    <RecentExpensesSection />
  </div>
  ```
- **`apps/web/src/widgets/dashboard/ui/UserProfileCard.tsx`** (новый) — читает `useAuthStore((s) => s.user)`, рендерит `<Card>` с заголовком "Профиль" и содержимым "Привет, {name}" + строка с email. Если `user === null` — `null` (PrivateGuard этого не даст, но для типа).
- **`apps/web/src/widgets/dashboard/ui/DashboardMenu.tsx`** (новый) — grid из двух `<Card>` с `<Link>`-обёрткой (`next/link`):
  - "Транзакции" → `/expenses` (короткое описание "Учёт расходов")
  - "Категории" → `/categories` ("Управление категориями")
  Карточки имеют hover-эффект (`hover:bg-accent`).
- **`apps/web/src/widgets/dashboard/ui/RecentExpensesSection.tsx`** (новый) — owns local state `{ page, limit, data: PaginatedResponse<Expense> | null, categories, loading, error }`. На mount грузит обе ручки (`Promise.all([expensesApi.list({ limit, offset }), categoriesApi.list()])`). При смене `page` — fetch новой страницы. Рендерит заголовок "Последние транзакции" + `<ExpensesTable expenses={items} categories={categories} />` (read-only — без `onUpdate`/`onDelete`) + `<ExpensesPagination page={page} pageSize={limit} total={data.meta.total} onPageChange={setPage} />`. `limit = 10`.
- **`apps/web/src/widgets/dashboard/index.ts`** — без изменений в публичном API (`DashboardPage`).
- **`apps/web/src/widgets/expenses/ui/ExpensesPage.tsx`** — переписать под пагинированный API:
  - state: `{ page, data: PaginatedResponse<Expense> | null, categories, loading }`
  - `limit = 10` (или 20 для полной страницы — обсудим в коде, по умолчанию 10 для единообразия)
  - fetch page при изменении `page`
  - на success в create/update/delete-дилогах — рефетч текущей страницы (если после удаления страница пустая и `page > 1` — переключиться на `page - 1`)
  - layout: `<CreateExpenseDialog onSuccess={refetch} /> <ExpensesTable ... onUpdate onDelete /> <ExpensesPagination ... />`
- **`apps/web/src/widgets/categories/ui/CategoriesPage.tsx`** (новый) — стаб: `<Card>` с заголовком "Категории" и текстом "В разработке".
- **`apps/web/src/widgets/categories/index.ts`** (новый) — `export { CategoriesPage }`.

**App router**

- **`apps/web/src/app/(app)/layout.tsx`** — добавить третий пункт в массив навигации: `{ href: '/categories', label: 'Категории' }`. Активная подсветка по `pathname` уже работает.
- **`apps/web/src/app/(app)/categories/page.tsx`** (новый) — thin RSC-обёртка: `import { CategoriesPage } from '@/widgets/categories'; export default function Page() { return <CategoriesPage />; }`.

## FSD-обоснование ключевых решений

- **`UserProfileCard` — внутри widget**, а не отдельный `features/user-profile`. Никакой бизнес-логики, только презентация из auth store. Заводить новый feature-slice ради `<Card>` с двумя строками — over-engineering. Если позже появится редактирование профиля — перенесём.
- **`ExpensesTable` остаётся общим** — read-only режим достигается опциональностью `onUpdate`/`onDelete`, а не отдельным компонентом. Иначе пришлось бы дублировать колонки и форматирование.
- **`ExpensesPagination` в `features/expenses`**, а не в `shared` — он завязан на `PaginatedResponse<Expense>`-семантику пары table+meta. Низкоуровневый shadcn-компонент `Pagination` живёт в `shared/ui`, а доменная обёртка — в feature.
- **`buildPageList` в `shared/lib`** — чистый алгоритм без домена, может пригодиться категориям/любой другой таблице.
- **`widgets/categories/` для стаба** — оставляем слот под будущий полноценный widget, чтобы потом не передвигать. Один-два файла стоят того, чтобы FSD оставался однородным.

## Verification

Запустить dev-стек и проверить вручную через preview-инструмент:

1. `pnpm db:up` (postgres через colima).
2. `pnpm --filter @expense-tracker/api prisma:migrate` — миграции не должны быть нужны (схема не меняется), но проверить отсутствие drift.
3. `pnpm dev:api` (port 3001) и `pnpm dev:web` (port 3000) — два терминала.
4. **API smoke:**
   - `curl -H "Authorization: Bearer $TOKEN" 'http://localhost:3001/expenses?limit=10&offset=0'` → объект `{ items: [...], meta: { total, limit: 10, offset: 0, hasMore: ... } }`.
   - `curl ... 'http://localhost:3001/expenses?limit=5&offset=5'` → `meta.offset = 5`, items длиной ≤5.
   - `curl ... 'http://localhost:3001/expenses?limit=abc'` → 400 от ValidationPipe.
5. **UI golden path (через `mcp__Claude_Preview__*`):**
   - `preview_start` фронта.
   - Логин существующим пользователем, переход на `/dashboard`.
   - `preview_snapshot` — видны три блока: профиль (имя/email), меню с двумя карточками, секция "Последние транзакции" с таблицей и пагинатором.
   - Клик по "Транзакции" → `/expenses`, видна полная таблица с действиями + пагинатор.
   - Клик по "Категории" → `/categories`, видна заглушка.
   - На `/expenses` — создать 25+ расходов через диалог (или предварительно засеять через API), проверить переключение страниц 1→2→3, корректность счётчика и подсветку текущей.
   - На `/dashboard` после возврата — последняя транзакция в начале списка.
   - `preview_console_logs` и `preview_network` — отсутствие ошибок 4xx/5xx (кроме намеренных тест-кейсов).
6. **Edge cases:**
   - 0 расходов — таблица пустая, пагинатор не рендерится.
   - Удаление последнего элемента страницы 2 → виджет переключает на стр. 1.
   - `preview_resize` — на узком экране сетка из карточек меню превращается в один столбец.
7. `pnpm lint && pnpm typecheck` — без ошибок (типы `PaginatedResponse<Expense>` должны проходить через все слои).

После выполнения — открыть PR `feat/main-screen` → `main`, squash merge.
