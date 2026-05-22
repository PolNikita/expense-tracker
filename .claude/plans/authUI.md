# Auth UI (login + register) для `apps/web`

## Context

Бэкенд готов: `POST /auth/register` и `POST /auth/login` возвращают `{ accessToken, user: User }`, типы `User`, `RegisterInput`, `LoginInput`, `AuthResponse` экспортируются из `packages/types/src/index.ts`. Фронтенд же — голый Next.js 14 App Router skeleton: нет Tailwind, shadcn/ui, HTTP-клиента, state-менеджмента, форм; `app/page.tsx` рендерит placeholder. Задача — закрыть пробел: ввести дизайн-систему shadcn/ui, разложить фронтенд по Feature-Sliced Design (FSD), реализовать страницы `/login`, `/register`, защищённую заглушку `/dashboard`, а также гайды в `CLAUDE.md`.

**Решения, согласованные с пользователем:**

- **Хранение токена** — `localStorage` + `Authorization: Bearer` (учебный путь). httpOnly-cookie оставляем на отдельную итерацию.
- **После логина** — редирект на `/dashboard` (приветствие по имени + кнопка Logout) с защитой роута.
- **Защита роутов** — клиентский `RouteGuard` в layout-группах (`(app)` и `(auth)`). Классический `middleware.ts` Next.js работает на Edge без доступа к `localStorage`, поэтому для выбранного пути guard живёт в client component внутри layout — это функциональный эквивалент middleware.
- **Тема** — светлая, `neutral` палитра (`tailwind.config.ts` + CSS variables от shadcn). Тёмная — позже через `next-themes`.
- **Стек форм** — `react-hook-form` + `zod` + `@hookform/resolvers/zod` (родной путь shadcn).
- **Состояние auth** — `zustand` с `persist` middleware (читает/пишет `localStorage` за нас, даёт хук-подписку).
- **CORS** — включаем `app.enableCors()` на API: без него браузер на `:3000` не сможет дёргать `:3001`.

## Структура FSD внутри `apps/web/src`

Каноническая FSD-структура конфликтует с `app/` Next.js (там роутинг). Принятый комьюнити компромисс: `app/` остаётся слоем роутинга Next.js, остальные слои FSD живут рядом в `src/`. Pages App Router — тонкие RSC-обёртки, импортирующие соответствующие виджеты.

```
apps/web/
  components.json                      // shadcn config с aliases на FSD
  tailwind.config.ts                   // от shadcn init
  postcss.config.cjs                   // от shadcn init
  .env.example                         // NEXT_PUBLIC_API_URL=http://localhost:3001
  src/
    app/                               // Next.js routing layer (не часть FSD-слоёв)
      layout.tsx                       // root layout + <Toaster /> от sonner
      page.tsx                         // редирект `/` → `/dashboard` (RSC redirect)
      globals.css                      // Tailwind base + shadcn CSS variables (neutral)
      (auth)/
        layout.tsx                     // <PublicOnlyGuard>: если есть токен → /dashboard
        login/page.tsx                 // → <LoginPage /> из widgets
        register/page.tsx              // → <RegisterPage /> из widgets
      (app)/
        layout.tsx                     // <PrivateGuard>: нет токена → /login
        dashboard/page.tsx             // → <DashboardPage /> из widgets

    widgets/                           // композиция фичей на уровне страниц
      auth-login/
        index.ts                       // public API виджета
        ui/LoginPage.tsx               // <Card> + <LoginForm /> + ссылка на /register
      auth-register/
        index.ts
        ui/RegisterPage.tsx            // <Card> + <RegisterForm /> + ссылка на /login
      dashboard/
        index.ts
        ui/DashboardPage.tsx           // приветствие по имени + Logout кнопка

    features/                          // бизнес-фичи
      auth/
        index.ts                       // public API: re-export form-компонентов и хуков
        api/auth-api.ts                // login/register: POST через shared/api/http-client
        model/
          schema.ts                    // zod: LoginSchema, RegisterSchema (синхрон с DTO API)
          auth-store.ts                // zustand + persist: { user, accessToken, setSession, clear }
        ui/
          LoginForm.tsx                // 'use client' + react-hook-form + zodResolver
          RegisterForm.tsx
        lib/
          use-logout.ts                // очищает store + router.push('/login')

    entities/                          // доменные сущности (минимально)
      user/
        index.ts                       // re-export User из @expense-tracker/types

    shared/                            // переиспользуемый слой (без бизнес-логики)
      api/
        http-client.ts                 // fetch-обёртка: baseURL, JSON, Bearer из auth-store
        endpoints.ts                   // const ENDPOINTS = { authLogin: '/auth/login', ... }
        errors.ts                      // ApiError class + normalize(): Response → ApiError
      config/
        env.ts                         // const API_URL = process.env.NEXT_PUBLIC_API_URL!
      lib/
        utils.ts                       // cn() от shadcn (clsx + tailwind-merge)
      ui/                              // shadcn-компоненты (button/input/label/form/card/sonner)
        button.tsx
        input.tsx
        label.tsx
        form.tsx
        card.tsx
        sonner.tsx
      guards/
        PrivateGuard.tsx               // 'use client' — useEffect проверяет accessToken
        PublicOnlyGuard.tsx
```

**Правило импортов FSD (зафиксировать в CLAUDE.md):** импорты идут только «вниз» по слоям: `app → widgets → features → entities → shared`. Слой не импортирует свой же или верхний слой. Внутри слоя — только через `index.ts` соседнего слайса.

## Установка shadcn/ui и Tailwind

Команды (после ручного `pnpm install` базовых dev-deps):

```bash
cd apps/web
pnpm dlx shadcn@latest init                    # выберем: style default, baseColor neutral, RSC yes, src yes
pnpm dlx shadcn@latest add button input label form card sonner
```

`components.json` поправим так, чтобы shadcn клал компоненты в `src/shared/ui/`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/shared",
    "ui": "@/shared/ui",
    "lib": "@/shared/lib",
    "utils": "@/shared/lib/utils",
    "hooks": "@/shared/lib"
  }
}
```

Зависимости, которые подтянет shadcn init: `tailwindcss`, `postcss`, `autoprefixer`, `tailwindcss-animate`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`. Дополнительно ставим:

```bash
pnpm --filter @expense-tracker/web add react-hook-form zod @hookform/resolvers zustand sonner
```

## Ключевые модули

### `src/shared/config/env.ts`

```ts
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
```

### `src/shared/api/http-client.ts`

Тонкая обёртка над `fetch`:

- читает `accessToken` из `useAuthStore.getState()` (без подписки — это вне React),
- добавляет `Authorization: Bearer <token>` если есть,
- сериализует JSON, парсит JSON-ответ,
- бросает `ApiError` (`status`, `message`, `details`) если `!response.ok`,
- метод `request<TResponse, TBody>(path, init)`; шорткаты `get/post/patch/delete`.

### `src/shared/api/errors.ts`

```ts
export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly details?: unknown) {
    super(message);
  }
}
```

`normalize(response)`: вытаскивает `{ message, statusCode, error }` из стандартного формата Nest exceptions.

### `src/features/auth/model/auth-store.ts`

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@expense-tracker/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setSession: (payload: { user: User; accessToken: string }) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setSession: ({ user, accessToken }) => set({ user, accessToken }),
      clear: () => set({ user: null, accessToken: null }),
    }),
    { name: 'expense-tracker:auth', storage: createJSONStorage(() => localStorage) },
  ),
);
```

### `src/features/auth/model/schema.ts`

Zod-схемы зеркалят DTO Nest.js (см. `apps/api/src/auth/dto/register.dto.ts`, `apps/api/src/auth/dto/login.dto.ts`):

```ts
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const RegisterSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export type LoginFormValues = z.infer<typeof LoginSchema>;
export type RegisterFormValues = z.infer<typeof RegisterSchema>;
```

### `src/features/auth/api/auth-api.ts`

```ts
import type { AuthResponse, LoginInput, RegisterInput } from '@expense-tracker/types';
import { http } from '@/shared/api/http-client';
import { ENDPOINTS } from '@/shared/api/endpoints';

export const authApi = {
  login: (body: LoginInput) => http.post<AuthResponse>(ENDPOINTS.authLogin, body),
  register: (body: RegisterInput) => http.post<AuthResponse>(ENDPOINTS.authRegister, body),
};
```

### `src/features/auth/ui/LoginForm.tsx` и `RegisterForm.tsx`

`'use client'` компоненты. Структура одинаковая:

1. `useForm` с `zodResolver(LoginSchema|RegisterSchema)`.
2. `onSubmit` — `authApi.login/register` → `useAuthStore.setSession(...)` → `router.push('/dashboard')`.
3. На ошибку: `toast.error(error.message)` (sonner).
4. Используют shadcn-компоненты `<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>`, `<Input>`, `<Button>` (с `disabled={isSubmitting}` и `<Loader2 className="animate-spin" />` при загрузке).
5. Под формой ссылка: `LoginForm` → `Don't have an account? Register`, `RegisterForm` → `Already have an account? Sign in`.

### `src/shared/guards/*`

```ts
// PrivateGuard.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/model/auth-store';

export function PrivateGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore.persist?.hasHydrated() ?? true;

  useEffect(() => {
    if (hydrated && !accessToken) router.replace('/login');
  }, [accessToken, hydrated, router]);

  if (!hydrated) return null;             // ждём гидрацию persist, чтобы избежать flash
  if (!accessToken) return null;
  return <>{children}</>;
}
```

`PublicOnlyGuard` — зеркальный: если токен есть → `router.replace('/dashboard')`. Это решает проблему «залогиненный заходит на /login».

### `src/widgets/dashboard/ui/DashboardPage.tsx`

```tsx
'use client';
export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  return (
    <Card className="mx-auto mt-20 max-w-md">
      <CardHeader><CardTitle>Hello, {user?.name}</CardTitle></CardHeader>
      <CardContent>...</CardContent>
      <CardFooter><Button variant="outline" onClick={logout}>Logout</Button></CardFooter>
    </Card>
  );
}
```

`use-logout.ts`: `useAuthStore.getState().clear(); router.replace('/login');`.

### App Router pages

```tsx
// src/app/(auth)/login/page.tsx
import { LoginPage } from '@/widgets/auth-login';
export default function Page() { return <LoginPage />; }

// src/app/(app)/dashboard/page.tsx
import { DashboardPage } from '@/widgets/dashboard';
export default function Page() { return <DashboardPage />; }

// src/app/page.tsx
import { redirect } from 'next/navigation';
export default function Home() { redirect('/dashboard'); }   // /dashboard guard сам перенаправит на /login, если не залогинен
```

`src/app/(auth)/layout.tsx` и `src/app/(app)/layout.tsx` — оборачивают `children` в соответствующий guard и центрированную обёртку (Tailwind `min-h-screen flex items-center justify-center`).

`src/app/layout.tsx` — root: подключает `globals.css`, шрифт `Inter` через `next/font`, монтирует `<Toaster />` от sonner.

## Изменения в `apps/api`

Только одно: **включить CORS** в `apps/api/src/main.ts`:

```ts
app.enableCors({
  origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  credentials: false,
});
```

Добавить `WEB_ORIGIN=http://localhost:3000` в `apps/api/.env.example` (если ещё нет).

## Обновление `CLAUDE.md`

Добавить/обновить разделы:

1. **Project status** — обновить: «auth готов, categories готовы, фронт получил Tailwind + shadcn/ui + FSD + страницы login/register/dashboard».
2. **Stack** — дописать:
   - `Frontend UI: Tailwind CSS + shadcn/ui (компоненты в `src/shared/ui`, конфиг `components.json`)`
   - `Frontend forms: react-hook-form + zod + @hookform/resolvers`
   - `Frontend state: zustand с persist middleware (localStorage)`
3. **Architecture notes** — добавить секцию **Frontend architecture (Feature-Sliced Design)**:
   - Слои: `app → widgets → features → entities → shared`. Импорты только вниз.
   - `app/` = Next.js routing layer (не часть FSD-слоёв). Pages — тонкие обёртки над виджетами.
   - Каждый слайс (например, `features/auth`) выставляет публичное API через свой `index.ts`. Внешний код импортирует только из `@/<layer>/<slice>`.
   - `shadcn/ui` живёт в `shared/ui`, генерируется через `pnpm dlx shadcn@latest add ...` с алиасом `@/shared/ui` (см. `components.json`).
   - Auth-токен хранится в `useAuthStore` (zustand+persist) под ключом `expense-tracker:auth`. Защита роутов — клиентские `PrivateGuard` / `PublicOnlyGuard` в `(app)/layout.tsx` и `(auth)/layout.tsx`.
4. **Common commands** — добавить:
   - `pnpm --filter @expense-tracker/web dlx shadcn@latest add <component>` — установить новый shadcn-компонент.
5. **Conventions** — добавить: «На фронте новые UI-компоненты shadcn кладём в `src/shared/ui` (через CLI shadcn). Бизнес-логику — в `features`, страницы-композиции — в `widgets`. Не плодим дубликаты shadcn-компонентов в фичах.»

## Verification

Команды (с PATH-prelude из CLAUDE.md):

```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# 1. Установка зависимостей и shadcn (нужно разрешение пользователя)
pnpm install
cd apps/web && pnpm dlx shadcn@latest init
cd apps/web && pnpm dlx shadcn@latest add button input label form card sonner
pnpm --filter @expense-tracker/web add react-hook-form zod @hookform/resolvers zustand sonner

# 2. Запуск
pnpm db:up
pnpm dev:api      # :3001 (с включённым CORS)
pnpm dev:web      # :3000

# 3. Статика
pnpm lint
pnpm typecheck
```

Сценарий ручной проверки (браузер):

1. Открыть `http://localhost:3000` без токена → редирект на `/login`.
2. Открыть `/register`, заполнить форму валидно → 201, редирект на `/dashboard` с приветствием по имени.
3. Открыть `/login` будучи залогиненным → `PublicOnlyGuard` редиректит на `/dashboard`.
4. Зайти на `/dashboard` без токена (очистить `localStorage`) → редирект на `/login`.
5. Logout с `/dashboard` → `/login`, в DevTools localStorage ключ `expense-tracker:auth` очищен.
6. Невалидные данные формы → ошибки Zod рендерятся в `<FormMessage>` (например, password `<8` → «String must contain at least 8 character(s)»).
7. Login с неверным паролем → toast.error «Invalid credentials» (или то, что вернёт API), форма остаётся.
8. Регистрация с уже занятым email → toast.error «Email already in use», 409 от API.
9. DevTools Network: на запрос `/auth/login` приходит CORS-заголовок `Access-Control-Allow-Origin: http://localhost:3000`.
10. После логина любой будущий запрос к защищённому API уже несёт `Authorization: Bearer ...` (проверим в Network на любом запросе из http-client).

## Critical files to create/edit

**Создать:**

- `apps/web/components.json`, `apps/web/tailwind.config.ts`, `apps/web/postcss.config.cjs` (через `shadcn init`)
- `apps/web/src/app/(auth)/{layout.tsx, login/page.tsx, register/page.tsx}`
- `apps/web/src/app/(app)/{layout.tsx, dashboard/page.tsx}`
- `apps/web/src/widgets/{auth-login,auth-register,dashboard}/**`
- `apps/web/src/features/auth/{api,model,ui,lib,index.ts}/**`
- `apps/web/src/entities/user/index.ts`
- `apps/web/src/shared/{api,config,lib,ui,guards}/**`

**Перезаписать:**

- `apps/web/src/app/layout.tsx` — добавить `globals.css`, шрифт, `<Toaster />`.
- `apps/web/src/app/page.tsx` — `redirect('/dashboard')`.
- `apps/web/src/app/globals.css` — Tailwind + shadcn CSS vars (neutral).
- `apps/web/.env.example` — `NEXT_PUBLIC_API_URL=http://localhost:3001`.
- `apps/web/tsconfig.json` — проверить, что есть `"@/*": ["./src/*"]` (вероятно, уже есть).

**Изменить:**

- `apps/api/src/main.ts` — `app.enableCors({...})`.
- `apps/api/.env.example` — `WEB_ORIGIN=http://localhost:3000` (если нет).
- `CLAUDE.md` — секции Project status / Stack / Architecture notes / Common commands / Conventions (см. выше).

## Out of scope (отдельные итерации)

- Переезд на httpOnly-cookie + Server Actions.
- Тёмная тема через `next-themes`.
- React Query / TanStack Query (введём вместе с Categories/Expenses UI).
- E2E тесты (Playwright).
- Refresh-token rotation.

## Чек-лист задач

### API: подготовка к работе с фронтом

- [x] Включить CORS в `apps/api/src/main.ts` (`app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' })`).
- [x] Добавить `WEB_ORIGIN=http://localhost:3000` в `apps/api/.env.example`.

### Web: инфраструктура (Tailwind + shadcn/ui)

- [x] Создать `apps/web/components.json` с FSD-aliases (`ui: @/shared/ui`, `utils: @/shared/lib/utils`).
- [x] Создать `apps/web/tailwind.config.ts` и `postcss.config.cjs`.
- [x] Установить зависимости: tailwindcss, shadcn компоненты + react-hook-form, zod, zustand, sonner.
- [x] Запустить `shadcn add button input label form card sonner` (файлы в `src/shared/ui/`).
- [x] Обновить `apps/web/src/app/globals.css` (Tailwind base + shadcn CSS vars neutral).
- [x] Создать `src/shared/lib/utils.ts` (cn() = clsx + tailwind-merge).

### Web: shared слой

- [x] `apps/web/src/shared/config/env.ts` (`API_URL`).
- [x] `apps/web/src/shared/api/errors.ts` (`ApiError` class, нормализация Nest-ответа).
- [x] `apps/web/src/shared/api/endpoints.ts` (`ENDPOINTS.authLogin`, `ENDPOINTS.authRegister`).
- [x] `apps/web/src/shared/api/http-client.ts` (fetch-обёртка с Bearer из auth-store).
- [x] `apps/web/src/shared/guards/PrivateGuard.tsx` (клиентский guard, ждёт гидрации persist).
- [x] `apps/web/src/shared/guards/PublicOnlyGuard.tsx` (зеркальный).

### Web: entities

- [x] `apps/web/src/entities/user/index.ts` (re-export `User` из `@expense-tracker/types`).

### Web: features/auth

- [x] `apps/web/src/features/auth/model/auth-store.ts` (zustand + persist под ключом `expense-tracker:auth`).
- [x] `apps/web/src/features/auth/model/schema.ts` (Zod-схемы Login и Register).
- [x] `apps/web/src/features/auth/api/auth-api.ts` (`authApi.login`, `authApi.register`).
- [x] `apps/web/src/features/auth/lib/use-logout.ts` (хук Logout).
- [x] `apps/web/src/features/auth/ui/LoginForm.tsx` (react-hook-form + zodResolver + shadcn Form).
- [x] `apps/web/src/features/auth/ui/RegisterForm.tsx` (аналогично).
- [x] `apps/web/src/features/auth/index.ts` (public API фичи).

### Web: widgets

- [x] `apps/web/src/widgets/auth-login/ui/LoginPage.tsx` (`<Card>` + `<LoginForm/>` + ссылка на /register).
- [x] `apps/web/src/widgets/auth-login/index.ts`.
- [x] `apps/web/src/widgets/auth-register/ui/RegisterPage.tsx`.
- [x] `apps/web/src/widgets/auth-register/index.ts`.
- [x] `apps/web/src/widgets/dashboard/ui/DashboardPage.tsx` (приветствие + Logout).
- [x] `apps/web/src/widgets/dashboard/index.ts`.

### Web: app router (страницы)

- [x] `apps/web/src/app/layout.tsx` — root layout: `globals.css`, шрифт `Inter` через `next/font`, `<Toaster />` sonner.
- [x] `apps/web/src/app/page.tsx` — `redirect('/dashboard')`.
- [x] `apps/web/src/app/(auth)/layout.tsx` — `<PublicOnlyGuard>` + центрированная обёртка.
- [x] `apps/web/src/app/(auth)/login/page.tsx` — рендерит `<LoginPage />`.
- [x] `apps/web/src/app/(auth)/register/page.tsx` — рендерит `<RegisterPage />`.
- [x] `apps/web/src/app/(app)/layout.tsx` — `<PrivateGuard>` + контейнер.
- [x] `apps/web/src/app/(app)/dashboard/page.tsx` — рендерит `<DashboardPage />`.

### Обновление CLAUDE.md

- [x] **Project status** — auth и categories готовы, фронт получил Tailwind + shadcn/ui + FSD + страницы login/register/dashboard.
- [x] **Stack** — добавлены Tailwind, shadcn/ui, react-hook-form + zod, zustand.
- [x] **Architecture notes** — добавлена секция «Frontend architecture (Feature-Sliced Design)» с правилом импортов и описанием слоёв.
- [x] **Common commands** — добавлен `pnpm --filter @expense-tracker/web dlx shadcn@latest add <component>`.
- [x] **Conventions** — зафиксирована конвенция «shadcn в shared/ui, фичи композируют, дубликатов нет».

### Проверка

- [x] `pnpm typecheck` без ошибок.
- [x] `pnpm lint` без ошибок.
- [x] Поднять `pnpm db:up`, `pnpm dev:api`, `pnpm dev:web`. Прогнать сценарии 1–10 из раздела Verification в браузере.
- [x] Остановить все сервисы и проверить, что зомби-процессов нет.
