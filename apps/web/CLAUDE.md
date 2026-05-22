# apps/web — CLAUDE.md

Workspace-specific guidance for the Next.js frontend. Root [`CLAUDE.md`](../../CLAUDE.md) covers repo-wide conventions (toolchain, monorepo, commits, branching, FSD principles) — read it first.

## Workspace layout

```
apps/web/
├── next.config.mjs           # transpilePackages: ['@expense-tracker/types']
├── tailwind.config.ts
├── components.json           # shadcn aliases (см. ниже)
├── tsconfig.json             # extends packages/tsconfig/nextjs.json, "@/*" → ./src/*
└── src/
    ├── app/                  # Next App Router — не FSD-слой, только routing glue
    │   ├── layout.tsx        # html/body + Toaster (sonner)
    │   ├── page.tsx          # redirect('/dashboard')
    │   ├── (app)/            # route group защищённых страниц
    │   │   ├── layout.tsx    # PrivateGuard + topbar (nav + logout)
    │   │   ├── dashboard/page.tsx
    │   │   ├── expenses/page.tsx
    │   │   └── categories/page.tsx
    │   └── (auth)/           # route group публичных страниц
    │       ├── layout.tsx    # PublicOnlyGuard
    │       ├── login/page.tsx
    │       └── register/page.tsx
    ├── widgets/              # page compositions: dashboard, expenses, categories, auth-login, auth-register
    ├── features/             # auth, expenses, categories — каждая с index.ts
    ├── entities/             # user, expense, category — тонкие re-exports из @expense-tracker/types
    └── shared/
        ├── ui/               # shadcn/ui — генерируется CLI, руками не править
        ├── api/              # http-client, endpoints, errors
        ├── guards/           # PrivateGuard, PublicOnlyGuard
        ├── config/env.ts     # API_URL
        └── lib/              # utils (cn), pagination (buildPageList)
```

## Common commands

```bash
# from repo root — добавь PATH-prelude из корневого CLAUDE.md
pnpm dev:web                                       # next dev на :3000
pnpm build:web                                     # next build
pnpm --filter @expense-tracker/web typecheck
pnpm --filter @expense-tracker/web lint            # next lint

# shadcn — добавить компонент в src/shared/ui/
pnpm --filter @expense-tracker/web dlx shadcn@latest add <component>
```

Тестов пока нет. Когда добавишь runner — задокументируй single-test invocation здесь и в корневом CLAUDE.md.

## Env vars

| Var                   | Required | Default                   | Где используется               |
| --------------------- | -------- | ------------------------- | ------------------------------ |
| `NEXT_PUBLIC_API_URL` |          | `'http://localhost:3001'` | `shared/config/env.ts` → `API_URL` (читается http-client) |

Префикс `NEXT_PUBLIC_` обязателен — переменная улетает в браузер.

## App Router conventions

- **Route groups**: `(app)` для всего залогиненного, `(auth)` для login/register. Группа — это просто общий layout с соответствующим guard'ом, в URL она не попадает.
- **Pages — RSC-обёртки**. Каждая `page.tsx` — тонкий `'use client'`/RSC файл, который рендерит виджет: `export default function Page() { return <ExpensesPage />; }`. Никакой логики в `app/` — она в `widgets/`.
- **Root `/`** делает `redirect('/dashboard')`; неавторизованного пользователя `PrivateGuard` уведёт на `/login`.
- **Layouts с интерактивом** (например, `(app)/layout.tsx` с topbar) помечаем `'use client'` — `usePathname`, `useLogout` требуют клиента.

## FSD slice contract

Импорт-направление **сверху вниз**, никогда наоборот:

```
app  →  widgets  →  features  →  entities  →  shared
```

Каждый slice (feature/widget/entity) выставляет public API через `index.ts`. **Cross-slice импорт идёт через `index.ts`**, не во внутренности (`features/auth/ui/LoginForm` — внутрь не лезем, только `@/features/auth`). Что экспортировано сейчас:

- `@/features/auth` — `LoginForm`, `RegisterForm`, `useAuthStore`, `useLogout`, типы `LoginFormValues`/`RegisterFormValues`
- `@/features/expenses` — `ExpensesTable`, `ExpensesPagination`, `CreateExpenseDialog`, `EditExpenseDialog`, `DeleteExpenseDialog`, `expensesApi`
- `@/features/categories` — `categoriesApi`
- `@/entities/{user,expense,category}` — re-export типов из `@expense-tracker/types` (см. ниже)

`entities/*` — намеренно тонкие. Если домену нужны хелперы (форматирование, derived state) — они идут сюда же, рядом с типом, но всё равно через `index.ts`.

## HTTP client + auth store

- **`http`** ([`shared/api/http-client.ts`](src/shared/api/http-client.ts)) — тонкая обёртка над `fetch`, методы `get/post/patch/delete`. Сама добавляет `Authorization: Bearer <token>` если токен зарегистрирован, прокидывает `AbortSignal` (для `get`) и нормализует ошибки через `ApiError`.
- **Token bridge** — `http-client` не импортирует `useAuthStore` напрямую (был бы цикл `features/auth` ↔ `shared/api`). Вместо этого:
  - `http-client` экспортирует `registerTokenGetter`.
  - `features/auth/model/auth-store.ts` после `create()` вызывает `registerTokenGetter(() => useAuthStore.getState().accessToken)` — однократно при инициализации модуля.
  Когда добавишь новый shared-модуль, которому нужен токен, — иди через тот же getter, не импортируй store из `shared/`.
- **`useAuthStore`** — zustand с persist middleware, key `expense-tracker:auth`, `localStorage`. Поля: `{ user, accessToken, setSession, clear }`.
- **204 No Content** уже обрабатывается в `http` (возвращает `undefined as T`) — DELETE-методы типизируй как `http.delete<void>(...)`.
- **Ошибки** — `normalizeResponse` парсит стандартный Nest-формат (`message: string | string[]`) в `ApiError(status, message, details)`. В UI ловим `instanceof ApiError`, остальное — fallback на `'Ошибка...'`.

## Guards & hydration

`PrivateGuard` / `PublicOnlyGuard` — клиентские, оба ждут гидрации zustand-persist прежде чем редиректить:

```tsx
useEffect(() => {
  if (useAuthStore.persist.hasHydrated()) return setHydrated(true);
  const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  return () => unsub();
}, []);
```

Без этой задержки авторизованный пользователь успел бы увидеть `/login` flash. **`hasHydrated()` зовём только внутри `useEffect`** — на сервере `useAuthStore.persist` не определён. При добавлении новой защищённой группы — используй существующие guards, не пиши SSR-вариант.

## Forms

react-hook-form + `zodResolver(@hookform/resolvers/zod)`. Схема живёт в `features/<slice>/model/schema.ts` рядом с `<Slice>FormValues = z.infer<typeof Schema>`.

Поля — через `@/shared/ui/form` (Form/FormField/FormControl/FormMessage), shadcn-обёртки над rhf. Сообщения валидации — на русском в самой схеме.

## Pagination

Server возвращает `PaginatedResponse<T>` = `{ items, meta: { total, limit, offset, hasMore } }`. На клиенте:

- Параметры — `{ limit, offset }` строкой через `URLSearchParams`.
- Страничные числа считаем сами: `page` 1-based, `offset = (page - 1) * limit`.
- `buildPageList(currentPage, totalPages)` из [`shared/lib/pagination.ts`](src/shared/lib/pagination.ts) даёт `(number | 'ellipsis')[]` — первая/последняя страницы всегда видны, между ними окно `±1`, лишнее заменяется `'ellipsis'`. Используется в `features/expenses/ui/ExpensesPagination`.
- При удалении последней строки на странице — откатывайся на предыдущую (`page > 1 ? page - 1 : refetch`), см. `ExpensesPage.handleDelete`.
- При успешном создании — переход на 1-ю страницу (или refetch, если уже там), чтобы новая запись была видна сразу.

## Fetching pattern

Канонический паттерн — `useEffect` с `AbortController`, без сторонних data-libs:

```tsx
useEffect(() => {
  const abort = new AbortController();
  setLoading(true);
  someApi.list(params, abort.signal)
    .then((res) => { setData(res); setLoading(false); })
    .catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      const message = error instanceof ApiError ? error.message : 'Ошибка загрузки';
      toast.error(message);
      setLoading(false);
    });
  return () => abort.abort();
}, [deps]);
```

`AbortError` всегда фильтруем явно — это легитимный сценарий (cleanup), не ошибка. Тосты — через `sonner` (`Toaster` смонтирован в root layout).

Если возникает потребность в кешировании/инвалидации — обсуди с пользователем переход на TanStack Query *до* того, как делать.

## shadcn/ui & Tailwind

- Конфиг — [`components.json`](components.json): `style: default`, `baseColor: neutral`, `cssVariables: true`. Алиасы: `components → @/shared`, `ui → @/shared/ui`, `lib/utils → @/shared/lib/utils`. **Не меняй алиасы вручную** — shadcn пересоберёт компонент в неправильное место.
- Добавление компонента — только через CLI (`pnpm --filter @expense-tracker/web dlx shadcn@latest add <name>`). Никогда не клонируй shadcn-компоненты в `features/` — composing only.
- `cn` — из `@/shared/lib/utils` (clsx + tailwind-merge). Импортируй именно отсюда.

## Entities = shared types

`entities/*` сейчас сводятся к `export type { Expense } from '@expense-tracker/types';`. Это намеренно: API-контракт — единственный источник правды для доменных типов, а entities дают слою UI стабильный импорт `@/entities/<x>` независимо от того, где живёт сам тип. Если для домена появится client-side derived/helpers — клади их в этот же slice, всё ещё через `index.ts`.

Новый сетевой DTO → сначала добавь его в `packages/types`, потом re-export в `entities/`. Не дублируй типы локально (см. **Shared types boundary** в корневом CLAUDE.md).

## Adding a new page — checklist

1. Создай widget: `src/widgets/<name>/ui/<Name>Page.tsx` + `src/widgets/<name>/index.ts` с `export { <Name>Page }`.
2. Нужен новый API-вызов — добавь типы в `packages/types`, метод в `features/<slice>/api/<slice>-api.ts`, ре-экспорт в `features/<slice>/index.ts`.
3. Создай RSC-обёртку: `src/app/(app|auth)/<route>/page.tsx` с `return <NamePage />`.
4. Auth-зависимость уже покрыта layout'ом группы (`PrivateGuard` / `PublicOnlyGuard`) — отдельно guard'ить не нужно.
5. Проверь: `pnpm typecheck && pnpm lint`.
