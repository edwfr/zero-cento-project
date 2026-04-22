# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev
npm run dev              # http://localhost:3000
npm run build
npm run lint
npm run type-check       # tsc --noEmit

# Database
npm run prisma:generate
npm run prisma:migrate   # dev migrations
npm run prisma:studio    # http://localhost:5555
npm run prisma:seed

# Tests
npm run test:unit        # Vitest (jsdom)
npm run test:e2e         # Playwright
npm run test:e2e:ui      # Playwright UI mode

# Run single unit test
npx vitest run tests/unit/calculations.test.ts
```

## Architecture

**Next.js 15 App Router** full-stack app. Three roles: `admin`, `trainer`, `trainee`. Pages live under `src/app/{admin,trainer,trainee}/`.

### Auth flow

1. **Middleware** (`src/middleware.ts`) — Supabase SSR session refresh + rate limiting (Upstash Redis for auth routes, in-memory Map for others). Public routes: `/login`, `/forgot-password`, `/reset-password`, `/force-change-password`, `/onboarding/set-password`.
2. **API auth** (`src/lib/auth.ts`) — `requireAuth()` / `requireRole()` / `requireTrainerOwnership()` / `requireTrainerProgramOwnership()`. Always calls `supabase.auth.getUser()` (not `getSession()`) to server-validate tokens. Then enriches with Prisma user data.
3. **Dual identity** — Supabase Auth owns JWT sessions; Prisma `User` table owns app data (role, isActive, etc.). They link via email.

### API layer

All routes under `src/app/api/`. Every handler uses:
- `apiSuccess(data, status?)` — `{ data, meta: { timestamp } }`
- `apiError(code, message, status, details?, key?)` — `{ error: { code, message, ... } }`

Both from `src/lib/api-response.ts`. `key` field is an i18n translation key for client-side error messages.

### Data model (Prisma)

Key relationships:
- `TrainerTrainee` — many-to-many join between trainers and trainees
- `TrainingProgram` → `Week` → `Workout` → `WorkoutExercise`
- `WeekType`: `normal | test | deload` — affects trainee UI theming
- `WeightType`: `absolute | percentage_1rm | percentage_rm | percentage_previous` — `percentage_previous` resolves recursively via `calculateEffectiveWeight()` in `src/lib/calculations.ts`

Two DB URLs required: `DATABASE_URL` (pooled PgBouncer port 6543) for runtime, `DIRECT_URL` (direct port 5432) for migrations.

### Frontend patterns

- **Styling**: Tailwind primary; MUI for data-heavy components (DataGrid, etc.)
- **Forms**: react-hook-form + Zod schemas from `src/schemas/`
- **Data fetching**: TanStack Query (React Query v5) for client components
- **Components**: flat in `src/components/`, exported via `index.ts`
- **i18n**: react-i18next, locale files in `public/locales/{en,it}/`. Translation keys used in API errors (`key` field) map to these files.
- **PWA**: Serwist (`src/sw.ts`), manifest at `public/manifest.json`
- **Error tracking**: Sentry (`sentry.server.config.ts`, `sentry.edge.config.ts`)

### Testing

Unit/integration tests: `tests/unit/` + `tests/integration/`, run with Vitest (jsdom). Coverage enforced at 80% for files listed in `vitest.config.ts`.

E2E tests: `tests/e2e/`, Playwright.

## Workflow Rules

After every modification or new implementation, update `implementation-docs/CHANGELOG.md` with a brief entry describing what changed and why.

### Key env vars

```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL (pooled) / DIRECT_URL (direct)
UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
RESEND_API_KEY / RESEND_FROM_EMAIL
NEXT_PUBLIC_SENTRY_DSN / SENTRY_AUTH_TOKEN
NEXT_PUBLIC_APP_URL
```
