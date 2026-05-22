# apps/web — CLAUDE.md

Workspace-specific guidance for the Next.js frontend. Root [`CLAUDE.md`](../../CLAUDE.md) covers repo-wide conventions (toolchain, monorepo, commits, branching, FSD principles) — read it first.

Правила, проверяемые при PR-ревью (FSD-направление импортов, http-client/auth boundary, hydration, форм- и pagination-паттерны, shadcn-конвенции) — в корневом [`REVIEW.md`](../../REVIEW.md), секция «4. Frontend (`apps/web`)». Этот файл — архитектурный справочник по фронту: где что лежит, какие уникальные узлы есть в репо, как добавить новую страницу.

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

## FSD slice — что экспортируется

Импорт-направление сверху вниз — `app → widgets → features → entities → shared` (см. правила в [REVIEW.md §4.1](../../REVIEW.md)). Текущий публичный API slice'ов:

- `@/features/auth` — `LoginForm`, `RegisterForm`, `useAuthStore`, `useLogout`, типы `LoginFormValues`/`RegisterFormValues`
- `@/features/expenses` — `ExpensesTable`, `ExpensesPagination`, `CreateExpenseDialog`, `EditExpenseDialog`, `DeleteExpenseDialog`, `expensesApi`
- `@/features/categories` — `categoriesApi`
- `@/entities/{user,expense,category}` — re-export типов из `@expense-tracker/types`

`entities/*` — намеренно тонкие. Если домену нужны client-side хелперы (форматирование, derived state) — они идут сюда же, рядом с типом, через `index.ts`.

## App Router

Pages в `app/**/page.tsx` — тонкие RSC/`'use client'` обёртки: один `return <SomePage />` из `widgets/`. Route groups `(app)` / `(auth)` — общий layout с соответствующим guard'ом, в URL не попадают. Root `/` делает `redirect('/dashboard')`. Layouts с интерактивом (например, `(app)/layout.tsx` с topbar) помечаются `'use client'`.

Правила (что лежит в `app/`, какой guard используется для какой группы) — [REVIEW.md §4.2](../../REVIEW.md).

## HTTP client + auth store (token bridge)

`http` ([`shared/api/http-client.ts`](src/shared/api/http-client.ts)) — тонкая обёртка над `fetch`: методы `get/post/patch/delete`, авто-`Authorization: Bearer`, проброс `AbortSignal`, нормализация ошибок через `ApiError`. `204 No Content` уже обработан внутри — DELETE типизируем как `http.delete<void>(...)`. Ошибки в UI ловим `instanceof ApiError`, остальное — fallback на `'Ошибка...'` (см. правила обработки в [REVIEW.md §4.3](../../REVIEW.md)).

**Token bridge — почему сделано так.** Прямой импорт `useAuthStore` из `http-client` дал бы цикл `features/auth` ↔ `shared/api` (нарушение FSD). Решение:

- `http-client` экспортирует `registerTokenGetter`.
- `features/auth/model/auth-store.ts` после `create()` однократно вызывает `registerTokenGetter(() => useAuthStore.getState().accessToken)` — при инициализации модуля.

Любой новый shared-модуль, которому нужен токен, идёт через тот же getter, а не импортирует `useAuthStore` напрямую из `shared/`. `useAuthStore` — zustand с persist middleware, key `expense-tracker:auth`, `localStorage`. Поля: `{ user, accessToken, setSession, clear }`.

## Guards & гидратация

`PrivateGuard` / `PublicOnlyGuard` — клиентские, оба ждут гидрации zustand-persist прежде чем редиректить:

```tsx
useEffect(() => {
  if (useAuthStore.persist.hasHydrated()) return setHydrated(true);
  const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  return () => unsub();
}, []);
```

Без этой задержки авторизованный пользователь успел бы увидеть `/login` flash. `hasHydrated()` зовём **только внутри `useEffect`** — на сервере `useAuthStore.persist` не определён. При добавлении новой защищённой группы используй существующие guards, не пиши SSR-вариант (см. [REVIEW.md §4.4](../../REVIEW.md)).

## Forms

react-hook-form + `zodResolver(@hookform/resolvers/zod)`. Схема живёт в `features/<slice>/model/schema.ts` рядом с `<Slice>FormValues = z.infer<typeof Schema>`. Поля — через `@/shared/ui/form` (Form/FormField/FormControl/FormMessage), shadcn-обёртки над rhf. Сообщения валидации — на русском в самой схеме. Правила — [REVIEW.md §4.5](../../REVIEW.md).

## Fetching — канонический паттерн

`useEffect` + `AbortController`, без сторонних data-libs:

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

`AbortError` всегда фильтруем явно — это легитимный cleanup, не ошибка. Тосты — через `sonner` (`Toaster` смонтирован в root layout). Правила — [REVIEW.md §4.6](../../REVIEW.md).

Если возникает потребность в кешировании/инвалидации — обсуди с пользователем переход на TanStack Query *до* того, как делать.

## Pagination (UI)

Server возвращает `PaginatedResponse<T>` = `{ items, meta: { total, limit, offset, hasMore } }`. На клиенте: параметры — `{ limit, offset }` через `URLSearchParams`; страничные числа считаем сами (`page` 1-based, `offset = (page - 1) * limit`); page-list через `buildPageList(currentPage, totalPages)` из [`shared/lib/pagination.ts`](src/shared/lib/pagination.ts) — возвращает `(number | 'ellipsis')[]`, использует `ExpensesPagination`.

UX-правила (откат на предыдущую страницу при удалении последней строки, переход на 1-ю при создании) — [REVIEW.md §4.7](../../REVIEW.md).

## shadcn/ui & Tailwind

[`components.json`](components.json): `style: default`, `baseColor: neutral`, `cssVariables: true`. Алиасы: `components → @/shared`, `ui → @/shared/ui`, `lib/utils → @/shared/lib/utils`. **Не меняй алиасы вручную** — shadcn пересоберёт компонент в неправильное место. Добавление — только через CLI (`pnpm --filter @expense-tracker/web dlx shadcn@latest add <name>`). `cn` импортируем из `@/shared/lib/utils` (clsx + tailwind-merge). Правила — [REVIEW.md §4.8](../../REVIEW.md).

## Entities = shared types

`entities/*` сейчас сводятся к `export type { Expense } from '@expense-tracker/types';`. Это намеренно: API-контракт — единственный источник правды для доменных типов, а entities дают слою UI стабильный импорт `@/entities/<x>` независимо от того, где живёт сам тип.

Новый сетевой DTO → сначала добавь его в `packages/types`, потом re-export в `entities/`. Не дублируй типы локально (см. **Shared types boundary** в корневом CLAUDE.md и [REVIEW.md §4.9](../../REVIEW.md)).

## Adding a new page — checklist

1. Создай widget: `src/widgets/<name>/ui/<Name>Page.tsx` + `src/widgets/<name>/index.ts` с `export { <Name>Page }`.
2. Нужен новый API-вызов — добавь типы в `packages/types`, метод в `features/<slice>/api/<slice>-api.ts`, ре-экспорт в `features/<slice>/index.ts`.
3. Создай RSC-обёртку: `src/app/(app|auth)/<route>/page.tsx` с `return <NamePage />`.
4. Auth-зависимость уже покрыта layout'ом группы (`PrivateGuard` / `PublicOnlyGuard`) — отдельно guard'ить не нужно.
5. Проверь: `pnpm typecheck && pnpm lint`. Перед открытием PR — пройдись по [REVIEW.md](../../REVIEW.md).
