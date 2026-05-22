# План: полный CRUD для Expense (transactions)

## Context

В проекте `expense-tracker` модель `Expense` уже существует в [schema.prisma](apps/api/prisma/schema.prisma) и в [packages/types/src/index.ts](packages/types/src/index.ts) (`Expense`, `CreateExpenseInput`, `UpdateExpenseInput`), но **отсутствует и backend-модуль, и frontend-страница**. Файл `.claude/prompts/transactions.md` пустой, поэтому требования уточнены в диалоге: нужен полный CRUD по обе стороны, без фильтров/пагинации, с модальными диалогами для create/edit и подтверждением удаления.

Это разблокирует основной use-case приложения — учёт трат — и подтверждает уже выбранную CQRS/FSD-архитектуру на втором ресурсе.

**Ключевая особенность:** `Expense` не имеет прямого `userId` — связь с пользователем только через `Category` (Expense → Category → User). Это требует scoping через relation-фильтр `category: { userId }` в каждой репозиторной операции и проверки принадлежности категории текущему пользователю при create/update.

---

## Решения, зафиксированные с пользователем

| Вопрос | Решение |
|---|---|
| Выбор категории в форме | Только `Select` с загрузкой `GET /categories`. Отдельный UI для CRUD категорий — вне scope этой задачи. |
| Layout списка/формы | Список в таблице + модальные `Dialog` для create/edit + `AlertDialog` для подтверждения удаления. |
| Фильтры/пагинация | Нет. Просто `findMany` с `orderBy: { spentAt: 'desc' }`. |
| Поле `spentAt` | Нативный `<input type="datetime-local">`. |

---

## Backend — `apps/api/src/expenses/`

Зеркалирует [apps/api/src/categories/](apps/api/src/categories/) по структуре файлов, CQRS-разбиению и стилю обработки ошибок.

### Структура

```
apps/api/src/expenses/
├── expenses.controller.ts
├── expenses.service.ts
├── expenses.repository.ts
├── expenses.module.ts
├── expense.mapper.ts
├── index.ts
├── commands/
│   ├── create-expense.command.ts
│   ├── update-expense.command.ts
│   ├── delete-expense.command.ts
│   └── handlers/
│       ├── create-expense.handler.ts
│       ├── update-expense.handler.ts
│       └── delete-expense.handler.ts
├── queries/
│   ├── get-expenses-by-user.query.ts
│   ├── get-expense-by-id-for-user.query.ts
│   └── handlers/
│       ├── get-expenses-by-user.handler.ts
│       └── get-expense-by-id-for-user.handler.ts
└── dto/
    ├── create-expense.dto.ts
    └── update-expense.dto.ts
```

### Endpoints

| Метод | Путь | Код | Описание |
|---|---|---|---|
| POST | `/expenses` | 201 | Создание; валидирует, что `categoryId` принадлежит текущему юзеру |
| GET | `/expenses` | 200 | Все расходы пользователя, отсортированы по `spentAt DESC` |
| GET | `/expenses/:id` | 200 | Один расход; 404 если не найден или чужой |
| PATCH | `/expenses/:id` | 200 | Частичное обновление; при смене `categoryId` снова проверка принадлежности |
| DELETE | `/expenses/:id` | 204 | Удаление; 404 если не найден или чужой |

Контроллер использует `@UseGuards(JwtAuthGuard)` и `@CurrentUser()` — образец [categories.controller.ts](apps/api/src/categories/categories.controller.ts).

### Repository — ключевые методы

Все запросы скоупятся через relation-фильтр, так как у `Expense` нет колонки `userId`:

```ts
// findAll
this.prisma.expense.findMany({
  where: { category: { userId } },
  orderBy: { spentAt: 'desc' },
});

// findOne
this.prisma.expense.findFirst({
  where: { id, category: { userId } },
});

// update / delete — updateMany/deleteMany возвращают count, как в CategoriesRepository
this.prisma.expense.updateMany({
  where: { id, category: { userId } },
  data,
});
```

Для **create** и **update со сменой categoryId** репозиторий получает отдельный helper-метод `assertCategoryOwnedByUser(categoryId, userId)`, который делает `category.findFirst({ where: { id, userId } })` и кидает `NotFoundException('Category not found')`. Это закрывает атаку «передать чужой categoryId».

### Mapper — `expense.mapper.ts`

`Prisma.Decimal` → `string`, `Date` → ISO-строка:

```ts
export function toExpenseDto(row: PrismaExpense): Expense {
  return {
    id: row.id,
    amount: row.amount.toString(),
    currency: row.currency,
    categoryId: row.categoryId,
    note: row.note,
    spentAt: row.spentAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
```

### DTO

`CreateExpenseDto implements CreateExpenseInput`:
- `amount` — `@IsString @Matches(/^\d+(\.\d{1,2})?$/)` (приходит как строка, проверяется как положительный десятичный), Prisma примет строку и конвертирует в Decimal
- `currency` — `@IsOptional @IsString @Length(3, 3)` (по умолчанию `'RUB'` в schema)
- `categoryId` — `@IsString @MinLength(1)`
- `note` — `@IsOptional @IsString @MaxLength(500) + @Transform(trim)` (поддерживает `null`)
- `spentAt` — `@IsISO8601`

`UpdateExpenseDto` — все поля `@IsOptional`, аналогично [update-category.dto.ts](apps/api/src/categories/dto/update-category.dto.ts).

### AppModule

Добавить `ExpensesModule` в `imports` в [apps/api/src/app.module.ts](apps/api/src/app.module.ts) после `CategoriesModule`.

### Обработка Prisma-ошибок

В handlers ловим `Prisma.PrismaClientKnownRequestError`:
- `P2003` (foreign key) при create — `NotFoundException('Category not found')` (страховка; основная проверка в repository helper)
- Прочие — пробросить

---

## Frontend — `apps/web/src/`

### 1. Endpoints — расширить `shared/api/endpoints.ts`

```ts
export const ENDPOINTS = {
  authLogin: '/auth/login',
  authRegister: '/auth/register',
  categories: '/categories',
  category: (id: string) => `/categories/${id}`,
  expenses: '/expenses',
  expense: (id: string) => `/expenses/${id}`,
} as const;
```

### 2. Entities — новые re-export'ы

- `entities/expense/index.ts` → `export type { Expense, CreateExpenseInput, UpdateExpenseInput }`
- `entities/category/index.ts` → `export type { Category }` (нужно для select в форме)

### 3. `features/expenses/`

```
features/expenses/
├── api/
│   ├── expenses-api.ts        # list/create/update/delete через http
│   └── categories-api.ts      # ТОЛЬКО list — для подгрузки в Select
├── model/
│   └── schema.ts              # CreateExpenseSchema (Zod)
├── ui/
│   ├── ExpenseFormFields.tsx  # переиспользуемые поля (amount, currency, categoryId, note, spentAt)
│   ├── CreateExpenseDialog.tsx
│   ├── EditExpenseDialog.tsx
│   ├── DeleteExpenseDialog.tsx
│   └── ExpensesTable.tsx
└── index.ts
```

**`expenses-api.ts`** строится по образцу [features/auth/api/auth-api.ts](apps/web/src/features/auth/api/auth-api.ts):

```ts
export const expensesApi = {
  list: () => http.get<Expense[]>(ENDPOINTS.expenses),
  create: (b: CreateExpenseInput) => http.post<Expense>(ENDPOINTS.expenses, b),
  update: (id: string, b: UpdateExpenseInput) => http.patch<Expense>(ENDPOINTS.expense(id), b),
  delete: (id: string) => http.delete<void>(ENDPOINTS.expense(id)),
};
```

`categories-api.ts` — единственный `list()` для подгрузки в select. Намеренно живёт внутри `features/expenses`, чтобы не плодить полноценный `features/categories` ради одного запроса. Позже легко вынести.

**Zod-схема** (`model/schema.ts`):

```ts
export const ExpenseFormSchema = z.object({
  amount: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Неверный формат суммы')
    .refine(v => Number(v) > 0, 'Сумма должна быть больше нуля'),
  currency: z.string().length(3, '3 буквы (например, RUB)').default('RUB'),
  categoryId: z.string().min(1, 'Выберите категорию'),
  note: z.string().max(500).optional(),
  // datetime-local выдаёт "2026-05-20T14:30" — конвертируем в ISO перед отправкой
  spentAt: z.string().min(1, 'Укажите дату и время'),
});
```

При сабмите: `new Date(values.spentAt).toISOString()` → отправляем как `spentAt`. Пустой `note` → не отправляем поле (или отправляем `null`).

**Форма** строится по образцу [features/auth/ui/LoginForm.tsx](apps/web/src/features/auth/ui/LoginForm.tsx) с `useForm + zodResolver`, `FormField/FormItem/FormControl/FormMessage`.

**`ExpenseFormFields`** инкапсулирует все поля (один компонент, используется в Create- и Edit-диалогах). При маунте делает `categoriesApi.list()` для заполнения `<Select>`. Если список пуст — рендерит подсказку «Сначала создайте категорию через `POST /categories`».

**Диалоги:** `Dialog` (shadcn) оборачивает форму. `onSuccess` — callback к виджету для refetch списка. Сабмит формы вызывает `expensesApi.create/update`, ловит `ApiError`, показывает `toast.error`.

**`ExpensesTable.tsx`** — shadcn `Table`. Колонки: дата, категория (по `categoryId` подставить имя — для этого виджет грузит и `categories.list()` тоже), сумма (formatted: `new Intl.NumberFormat('ru-RU', { style: 'currency', currency: row.currency })`), заметка, actions (кнопки «Изменить» / «Удалить»). Actions триггерят соответствующий диалог через локальный `useState` с выбранной строкой.

**`index.ts`** экспортирует только публичный API: `ExpensesTable`, `CreateExpenseDialog`, `EditExpenseDialog`, `DeleteExpenseDialog`, `expensesApi`.

### 4. `widgets/expenses/`

```
widgets/expenses/
├── ui/
│   └── ExpensesPage.tsx
└── index.ts
```

Композирует фичу: заголовок «Расходы», кнопка «+ Добавить» (открывает `CreateExpenseDialog`), `ExpensesTable`. Держит state списка и категорий + функцию refetch, которую пробрасывает в диалоги через `onSuccess`. Загрузка через `useEffect` при маунте, ошибки — `toast.error`.

### 5. Routing — `apps/web/src/app/(app)/expenses/page.tsx`

```tsx
import { ExpensesPage } from '@/widgets/expenses';
export default function Page() { return <ExpensesPage />; }
```

### 6. Layout `(app)` — обновить

[apps/web/src/app/(app)/layout.tsx](apps/web/src/app/(app)/layout.tsx) сейчас центрирует контент (`flex min-h-screen items-center justify-center`) — это уместно для маленькой Dashboard-карточки, но не для таблицы.

Изменения:
- Убрать центровку, заменить на `min-h-screen bg-muted/40` + topbar с навигацией: `Dashboard | Расходы` + кнопка `Выйти` (используется существующий `useLogout()`)
- Контент: `<main className="mx-auto max-w-5xl p-6">{children}</main>`
- [widgets/dashboard/ui/DashboardPage.tsx](apps/web/src/widgets/dashboard/ui/DashboardPage.tsx) — убрать дублирующую кнопку «Выйти» (она теперь в topbar), оставить приветственную карточку как есть

### 7. shadcn-компоненты — установить

Нужны новые в `apps/web/src/shared/ui/`:
- `dialog`
- `alert-dialog`
- `select`
- `table`
- `textarea`

Команда (юзер запускает сам, по конвенции из CLAUDE.md «не устанавливать зависимости без просьбы» — упомянуть в чате):

```bash
pnpm --filter @expense-tracker/web dlx shadcn@latest add dialog alert-dialog select table textarea
```

---

## Критичные файлы

### Создаются
- `apps/api/src/expenses/**` — весь модуль (12 файлов)
- `apps/web/src/features/expenses/**` — фича (8 файлов)
- `apps/web/src/widgets/expenses/{ui/ExpensesPage.tsx,index.ts}`
- `apps/web/src/entities/expense/index.ts`
- `apps/web/src/entities/category/index.ts`
- `apps/web/src/app/(app)/expenses/page.tsx`

### Модифицируются
- [apps/api/src/app.module.ts](apps/api/src/app.module.ts) — добавить `ExpensesModule`
- [apps/web/src/shared/api/endpoints.ts](apps/web/src/shared/api/endpoints.ts) — добавить `expenses`, `expense(id)`
- [apps/web/src/app/(app)/layout.tsx](apps/web/src/app/(app)/layout.tsx) — топбар с навигацией
- [apps/web/src/widgets/dashboard/ui/DashboardPage.tsx](apps/web/src/widgets/dashboard/ui/DashboardPage.tsx) — убрать дублирующую кнопку выхода

### Переиспользуется (не трогаем)
- [apps/api/src/auth/decorators/current-user.decorator.ts](apps/api/src/auth/decorators/current-user.decorator.ts) — `@CurrentUser()`
- [apps/api/src/auth/guards/jwt-auth.guard.ts](apps/api/src/auth/guards/jwt-auth.guard.ts) — `JwtAuthGuard`
- [apps/api/src/prisma/prisma.service.ts](apps/api/src/prisma/prisma.service.ts) — глобальный PrismaService
- [apps/web/src/shared/api/http-client.ts](apps/web/src/shared/api/http-client.ts), [shared/api/errors.ts](apps/web/src/shared/api/errors.ts) — fetch + ApiError
- [apps/web/src/shared/guards/PrivateGuard.tsx](apps/web/src/shared/guards/PrivateGuard.tsx) — уже обёрнут в `(app)` layout
- [apps/web/src/features/auth/lib/use-logout.ts](apps/web/src/features/auth/lib/use-logout.ts) — для кнопки выхода в topbar

---

## Verification

1. **Поднять окружение**
   ```bash
   eval "$(/opt/homebrew/bin/brew shellenv)"
   export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
   pnpm db:up
   pnpm --filter @expense-tracker/api prisma:generate
   pnpm dev:api &   # :3001
   pnpm dev:web     # :3000
   ```

2. **Backend smoke-test через curl** (или прямо в UI):
   - `POST /auth/register` → получить токен
   - `POST /categories` с токеном → создать 1–2 категории
   - `POST /expenses` → 201
   - `GET /expenses` → 200, отсортированные DESC по `spentAt`
   - `POST /expenses` с чужим `categoryId` (создать второго юзера) → 404
   - `PATCH /expenses/:id` чужой → 404
   - `DELETE /expenses/:id` → 204

3. **Frontend через preview MCP**:
   - Зайти на `/expenses`, проверить пустое состояние (если категорий нет — подсказка в форме)
   - Создать расход через диалог, проверить появление в таблице
   - Отредактировать через action — изменения отображаются
   - Удалить с подтверждением — строка пропадает
   - Проверить навигацию `Dashboard ⇄ Расходы` в topbar
   - Проверить `toast.error` при невалидной сумме/пустой категории
   - `preview_console_logs` и `preview_network` — нет необработанных ошибок

4. **Статические проверки**
   ```bash
   pnpm lint
   pnpm typecheck
   ```

Тестового раннера в проекте нет (см. CLAUDE.md) — автотесты не пишем.

---

## Что НЕ входит в задачу

- Отдельный UI для CRUD категорий (только `Select` загружает существующие)
- Фильтры/сортировка/пагинация
- Графики, отчёты, агрегаты
- Миграции Prisma — модель `Expense` уже в БД
- Установка новых зависимостей (shadcn-компоненты ставит пользователь по нашей команде, согласно конвенции «не устанавливать без просьбы»)
