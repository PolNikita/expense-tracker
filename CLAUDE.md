# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Full-stack monorepo with working auth and categories:

- **Backend** (`apps/api`): JWT auth (`/auth/register`, `/auth/login`), Categories CRUD (`/categories`) — fully implemented with CQRS pattern, Prisma + PostgreSQL, `class-validator` DTOs.
- **Frontend** (`apps/web`): auth pages `/login`, `/register`, protected `/dashboard`. Tailwind CSS + shadcn/ui, Feature-Sliced Design, zustand auth store, react-hook-form + zod forms.
- **Database**: PostgreSQL 16 via Colima Docker, schema includes `User`, `Category`, `Expense` models.

## Host environment quirks

This machine has a non-standard toolchain layout — note these before running commands:

- **Homebrew is not on the default PATH.** Prefix shell sessions with `eval "$(/opt/homebrew/bin/brew shellenv)"`.
- **Node 20 is keg-only** (`brew install node@20`). It is not linked into `/opt/homebrew/bin`. Add `/opt/homebrew/opt/node@20/bin` to PATH for every Node command:
  ```bash
  export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
  ```
- **pnpm is pinned via corepack**, not the brew formula. The `pnpm` brewed binary is v11 and is incompatible with Node 20; the project pins `pnpm@9.15.4` through `packageManager` in the root `package.json`, activated via `corepack prepare pnpm@9.15.4 --activate`. Do not `brew upgrade pnpm` expecting it to work with Node 20.
- **Docker is Colima, not Docker Desktop.** Start with `colima start`, stop with `colima stop`. `~/.docker/config.json` already wires the brewed `docker compose` plugin via `cliPluginsExtraDirs`. `docker info` should show `Context: colima`.

## Stack

- **Monorepo**: pnpm workspaces (see `pnpm-workspace.yaml`; `packages: ["apps/*", "packages/*"]`)
- **Frontend**: Next.js 14 (App Router) under `apps/web`
- **Frontend UI**: Tailwind CSS + shadcn/ui. Components live in `src/shared/ui/` (installed via `pnpm dlx shadcn@latest add <component>`). Config: `components.json` with FSD aliases.
- **Frontend forms**: react-hook-form + zod + @hookform/resolvers/zod (zodResolver).
- **Frontend state**: zustand with persist middleware (localStorage, key `expense-tracker:auth`).
- **Backend**: Nest.js under `apps/api`, CQRS pattern (`@nestjs/cqrs`).
- **Database**: PostgreSQL 16 via `docker-compose.yml` (volume `expense-tracker-pgdata`, port `5432`)
- **ORM**: Prisma, schema at `apps/api/prisma/schema.prisma`. `PrismaService` (`apps/api/src/prisma/prisma.service.ts`) extends `PrismaClient` and is exposed by a `@Global()` `PrismaModule`, so any Nest module can inject it without re-importing.
- **TypeScript**: strict everywhere, `noUncheckedIndexedAccess` enabled in the shared base.
- **Lint/format**: ESLint + Prettier. Workspace ESLint configs live in `packages/eslint-config` and are consumed by each app via `extends: ['@expense-tracker/eslint-config/<nextjs|nestjs>.cjs']`.
- **Auth**: JWT (Passport + `passport-jwt`). `POST /auth/register` → 201, `POST /auth/login` → 200, both return `{ accessToken, user }`. Frontend stores token in localStorage, sends `Authorization: Bearer`.

## Common commands

All commands run from the repo root. The root `package.json` defines pnpm filter wrappers. Remember the PATH prelude from the section above.

```bash
# install
pnpm install

# database
pnpm db:up        # docker compose up -d postgres
pnpm db:down
pnpm db:logs

# dev servers
pnpm dev:web      # Next.js on :3000
pnpm dev:api      # Nest.js on :3001 (port from PORT env)

# build
pnpm build:web
pnpm build:api

# lint / typecheck across all workspaces
pnpm lint
pnpm typecheck

# Prisma (run from inside apps/api, or via filter)
pnpm --filter @expense-tracker/api prisma:generate
pnpm --filter @expense-tracker/api prisma:migrate
pnpm --filter @expense-tracker/api prisma:studio

# shadcn/ui — добавить новый компонент в shared/ui
pnpm --filter @expense-tracker/web dlx shadcn@latest add <component>
```

To target a single workspace directly, use pnpm filters: `pnpm --filter @expense-tracker/web <script>` or `pnpm --filter @expense-tracker/api <script>`.

There is **no test runner wired up yet** — neither app has a `test` script. When tests are added, document the single-test invocation here.

## Architecture notes

**Shared types boundary.** `packages/types` exports the API contract (`Expense`, `Category`, `CreateExpenseInput`, etc.) consumed by both web and api as `@expense-tracker/types`. The web app must list it in `transpilePackages` in `next.config.mjs` because the package ships raw TS (no build step). The api workspace also depends on it. When you add a new DTO that crosses the wire, put it here — do not duplicate types between apps.

**Prisma scope.** Prisma is intentionally scoped to `apps/api` (schema, migrations, generated client all live there). Do not introduce a separate `packages/db` — the backend is the only consumer.

**TS configs are layered.** `packages/tsconfig/base.json` holds the strict defaults; `nextjs.json` and `nestjs.json` extend it with framework-specific compiler options (jsx/lib/module/decorators). Each app's local `tsconfig.json` extends the appropriate framework variant and only adds path aliases (`@/*` → `./src/*`) and include/exclude. When touching strictness, edit `base.json` — do not duplicate flags in app tsconfigs.

**Workspace naming.** All internal packages are scoped `@expense-tracker/*`. Cross-workspace deps use `workspace:*` ranges.

**Frontend architecture (Feature-Sliced Design).** `apps/web/src` is organised by FSD layers. Import direction is strictly top-down:

```
app  →  widgets  →  features  →  entities  →  shared
```

- **`app/`** — Next.js App Router layer only (layouts, page.tsx wrappers, route groups). Not a FSD layer — just routing glue. Pages are thin RSC wrappers that import from `widgets`.
- **`widgets/`** — Page-level compositions (e.g. `auth-login`, `dashboard`). Compose features + shared UI into full page blocks.
- **`features/`** — Business features (e.g. `features/auth`: store, schema, api calls, form components). Each feature exposes its public API through `index.ts`. External code must import only from `@/features/<slice>` (via index).
- **`entities/`** — Domain types/models re-exported for reuse (e.g. `entities/user` re-exports `User` from `@expense-tracker/types`).
- **`shared/`** — Framework-agnostic utilities, UI kit, API client, guards. No business logic.
  - `shared/ui/` — shadcn/ui components (generated via CLI, never hand-edited).
  - `shared/api/` — `http-client.ts` (fetch wrapper with Bearer), `endpoints.ts`, `errors.ts`.
  - `shared/guards/` — `PrivateGuard.tsx` and `PublicOnlyGuard.tsx` (client components used in route group layouts).
  - `shared/config/env.ts` — typed env vars (`API_URL`).

**Auth flow.** JWT stored in `useAuthStore` (zustand persist, key `expense-tracker:auth`). `http-client` reads the token via a registered getter (no circular imports). Route protection is done client-side: `PrivateGuard` redirects unauthenticated users from `(app)/*` to `/login`; `PublicOnlyGuard` redirects authenticated users from `(auth)/*` to `/dashboard`. Both guards wait for zustand hydration to avoid flash.

## Conventions

- Russian is the primary collaboration language with the user; code, comments in code, and English-facing artifacts (PR titles, commit messages) stay in English.
- Don't install dependencies or run migrations unless the user asks.
- **Frontend UI**: new shadcn/ui components go into `src/shared/ui/` via the shadcn CLI (`pnpm dlx shadcn@latest add <component>`). Never duplicate shadcn components inside features — compose from `shared/ui`.
- **FSD imports**: each slice exports its public API through `index.ts`. Cross-slice imports must go through `index.ts`, not into internals. A lower layer must never import from a higher layer.
- **Backend**: CQRS pattern — new resources follow the pattern in `apps/api/src/categories/` (commands/queries/handlers + repository + thin service). No direct repository injection between modules.

## Git commit conventions

Follow **Conventional Commits 1.0.0**. Commit messages are in English regardless of conversation language.

**Format**

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

**Allowed types**

- `feat` — new user-facing feature
- `fix` — bug fix
- `refactor` — code change that neither fixes a bug nor adds a feature
- `perf` — performance improvement
- `docs` — documentation only (README, CLAUDE.md, JSDoc)
- `style` — formatting, whitespace, lint autofixes (no behavior change)
- `test` — adding or fixing tests
- `build` — build system, package manager, lockfile, Dockerfile
- `ci` — CI/CD pipelines
- `chore` — repo plumbing that doesn't fit elsewhere (configs, gitignore, tooling)
- `revert` — reverts a previous commit

**Scopes** mirror workspaces and cross-cutting areas:

- `web` — `apps/web`
- `api` — `apps/api`
- `types` — `packages/types`
- `eslint-config` — `packages/eslint-config`
- `tsconfig` — `packages/tsconfig`
- `db` — Prisma schema, migrations, `docker-compose.yml` for postgres
- `deps` — dependency bumps (use with `build:` or `chore:`)
- `repo` — root-level configs (`.gitignore`, `pnpm-workspace.yaml`, root `package.json`)

Use a single scope; if a change genuinely spans many areas (e.g. introducing a contract across `types`, `api`, `web`), omit the scope and describe the cross-cut in the body.

**Subject**

- imperative mood (`add`, `fix`, `remove`), not past tense
- lowercase first letter, no trailing period
- ≤ 72 characters
- describes the *what*, not the *how*

**Body** (optional but encouraged for non-trivial changes)

- wrap at ~100 characters
- explain *why* the change is needed and any non-obvious trade-offs
- reference related issues/PRs in the footer (`Refs: #123`, `Closes: #123`)

**Breaking changes**

Mark with `!` after the type/scope (`feat(api)!: ...`) **and** add a `BREAKING CHANGE:` footer describing the migration.

**AI-assisted commits**

When a commit is co-authored with Claude Code, add the trailer:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

**Examples**

```
feat(api): add categories CRUD with CQRS handlers
fix(web): prevent auth flash by waiting for zustand hydration
refactor(api): extract Prisma into a global @Global() module
docs: document host toolchain quirks in CLAUDE.md
build(deps): bump next from 14.2.3 to 14.2.5
chore(repo): initialize git repository
feat(api)!: switch JWT payload from { sub } to { userId }

BREAKING CHANGE: clients must read `userId` instead of `sub` from the decoded token.
```

**Atomicity**

One logical change per commit. If you touch both `apps/api` and `apps/web` for one feature, that's fine — one commit, omit the scope or pick the dominant one. But don't bundle unrelated fixes with a feature; split them.
