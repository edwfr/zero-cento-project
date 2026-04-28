# GitHub Copilot Instructions — ZeroCento Training Platform

> Place this file at `.github/copilot-instructions.md` in the repository root.
> Copilot uses these instructions for every suggestion in this repo.
> **Detailed rules live in skill files under `.github/skills/`** — Copilot loads them on demand. This document is the index + non-negotiable rules.

---

## 0. Skills Index

| Skill | When it applies |
|---|---|
| `.github/skills/zero-cento-frontend/SKILL.md` | Any frontend work: pages, components, UI, forms, i18n |
| `.github/skills/zero-cento-backend/SKILL.md` | API route handlers, middleware, Prisma queries, auth guards, rate limiting (enforces perf rules from `docs/performance-analysis.md`) |
| `.github/skills/zero-cento-testing/SKILL.md` | Any test (unit / integration / E2E) or change to source that requires test updates |
| `.github/skills/git-pr-workflow/SKILL.md` | Branching, PRs, releases, hotfixes (two-branch `development` / `master` model) |

When working on a relevant area, follow the matching skill exactly. Sections below are the cross-cutting non-negotiables.

---

## 1. Project Identity

ZeroCento — **trainer-led training management platform** (Next.js 15 + Supabase + Prisma + Vercel). Single-repo, full-stack. Next.js App Router is the BFF; no separate backend service.

**Roles:** `admin` · `trainer` · `trainee` (lowercase, matches `enum Role` in Prisma)
**UX split:** admin/trainer → desktop-first · trainee → mobile portrait-first (used in-gym)

---

## 2. Tech Stack (non-negotiable)

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, RSC by default) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS — brand tokens, never raw hex. MUI only for data-heavy widgets (DataGrid). |
| UI Components | Custom design system in `src/components/`, barrel-exported via `src/components/index.ts` |
| Server state | TanStack Query v5 |
| Forms | React Hook Form + Zod (Zod schemas in `src/schemas/`) |
| ORM | Prisma. Two URLs: `DATABASE_URL` (pooled, 6543) for runtime · `DIRECT_URL` (5432) for migrations |
| Auth | Supabase Auth (JWT). Server validates via `supabase.auth.getUser()` (never `getSession()` from Supabase). |
| Email | Resend |
| Rate limiting | Upstash Redis for auth routes; in-memory `Map` for others (see backend skill Rule 2) |
| i18n | `react-i18next`, locale files `public/locales/{en,it}/` |
| PWA | Serwist (`src/sw.ts`), `public/manifest.json` |
| Errors | Sentry (`sentry.server.config.ts`, `sentry.edge.config.ts`) |
| Testing | Vitest (jsdom) for unit + integration; Playwright for E2E |

---

## 3. Non-Negotiable Rules

### 3.1 — Custom components only (CRITICAL)

Never use raw HTML when a custom component exists. All exported from `src/components/index.ts`.

```typescript
// CORRECT
import { Button, Input, FormLabel, Card, ActionIconButton } from '@/components'

// WRONG
<button className="..."><input className="..." /><label className="...">
```

| Component | Replaces |
|---|---|
| `<Button>` | any `<button>` |
| `<ActionIconButton>` / `<InlineActions>` | icon-only action buttons |
| `<Input>` | any `<input>` |
| `<Textarea>` | any `<textarea>` |
| `<FormLabel>` | any `<label>` in forms |
| `<Card>` | any panel `<div>` |
| `<LoadingSpinner>` / `<FullPageLoader>` / `<InlineLoader>` | loading states |
| `<Skeleton*>` (`SkeletonCard`, `SkeletonForm`, `SkeletonDashboard`, `SkeletonTable`, `SkeletonList`, `SkeletonDetail`, `SkeletonNavigation`, `SkeletonText`) | skeleton placeholders |
| `<ToastNotification>` + `useToast()` | alerts/notifications |
| `<ConfirmationModal>` | confirm dialogs |
| `<ErrorBoundary>` | error boundary wrapper |
| `<RoleGuard>` | role-based rendering |
| `<DashboardLayout>` | authenticated page layout |
| `<NavigationLoadingOverlay>` + `useNavigationLoader()` | client-driven post-submit redirect spinner |

`<Button>` variants: `primary` (default) · `secondary` · `danger`. Sizes: `sm` · `md` · `lg`.
`<Input>` states: `default` · `error` · `success`.

### 3.2 — Brand tokens, never hardcoded hex

```typescript
// CORRECT
className="bg-brand-primary hover:bg-brand-primary-hover text-brand-secondary focus:ring-brand-primary"

// WRONG
className="bg-[#FFA700]"  style={{ color: '#FFA700' }}
```

Tokens in `tailwind.config.ts`:
- `brand-primary` #FFA700 · `brand-primary-hover` #E69500 · `brand-secondary` #000000 · `brand-accent` #FFFFFF
- State: `state-error`, `state-success`, `state-warning`, `state-info`
- Week: `week-test`, `week-deload`

### 3.3 — i18n: no hardcoded strings

Every user-visible string goes through `useTranslation()` from `react-i18next`. Add keys to **both** `public/locales/en/` and `public/locales/it/`.

```typescript
const { t } = useTranslation(['trainer', 'common'])
return <h1>{t('trainer:dashboard.title')}</h1>
```

API errors carry an i18n `key` field that maps to `public/locales/{en,it}/errors.json`.

### 3.4 — API response format

Use the helpers from `src/lib/api-response.ts`:

```typescript
import { apiSuccess, apiError } from '@/lib/api-response'

// Success
return apiSuccess(data)              // 200, shape: { data, meta: { timestamp } }
return apiSuccess(data, 201)         // Created

// Error — args: (code, message, status, details?, key?)
return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
return apiError('VALIDATION_ERROR', 'Source week is required', 400, parsed.error.flatten(), 'validation.sourceWeekRequired')
return apiError('UNAUTHORIZED', 'Authentication required', 401, undefined, 'auth.unauthorized')
return apiError('INTERNAL_ERROR', 'Unexpected error', 500, undefined, 'internal.default')
```

Codes: `VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | RATE_LIMIT_EXCEEDED | INTERNAL_ERROR`. i18n `key` is dot-notation: `domain.camelCaseKey`.

Never return raw `NextResponse.json({...})` from API routes.

### 3.5 — API route pattern (exact)

```typescript
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    // 1. Auth + role guard (throws Response on failure)
    const session = await requireRole(['admin', 'trainer'])

    // 2. Input validation (Zod)
    const parsed = schema.safeParse(input)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten(), 'validation.invalid')
    }

    // 3. Ownership (trainer only) — single findFirst, never split queries
    if (session.user.role === 'trainer') {
      const owns = await prisma.trainingProgram.findFirst({
        where: { id, trainerId: session.user.id },
        select: { id: true },
      })
      if (!owns) return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
    }

    // 4. Business logic — scope select/include to minimum
    const result = await prisma.trainingProgram.findUnique({ where: { id }, select: { id: true, title: true } })

    return apiSuccess(result)
  } catch (error) {
    if (error instanceof Response) return error
    return apiError('INTERNAL_ERROR', 'Unexpected error', 500, undefined, 'internal.default')
  }
}
```

**Auth helpers** (from `src/lib/auth.ts`): `getSession()` (cached, returns `AuthSession | null`), `requireAuth()`, `requireRole(roles)`, `requireTrainerOwnership(traineeId)`, `requireTrainerProgramOwnership(programId)`. The `require*` variants throw a `Response` on failure — catch with `instanceof Response`.

`getSession()` calls `supabase.auth.getUser()` (server-validated), then enriches with Prisma user data. Dual identity: Supabase Auth owns JWT sessions; Prisma `User` table owns app data — linked via email.

### 3.6 — Performance rules (from backend skill)

Each one has measured latency impact — see `.github/skills/zero-cento-backend/SKILL.md` for full detail.

1. Middleware must NOT call `getUser()` for `/api/*` routes — early return for API paths (−200–400 ms/req).
2. `getRateLimitConfig(pathname, method)` enables Redis only for `GET` on resource endpoints (`exercises`, `programs`, `personal-records`); mutations use in-memory.
3. Ownership check = single `findFirst({ trainerId, resourceId })` — never `findMany` + `findUnique`.
4. Route handlers load only what they need. Prefer `select` over `include`. Use `Promise.all` for independent reads. No full program-tree fetches when a slice suffices.
5. Mutations return the updated resource (matching the `GET` shape) so the client skips a follow-up fetch.

### 3.7 — Server vs Client components

- Default to Server Components. No `'use client'` unless needed.
- Pages with mixed needs use the split:
  - `page.tsx` → Server Component (auth, redirect, `DashboardLayout`)
  - `_content.tsx` → Client Component (state, hooks, forms)

```typescript
// page.tsx
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import FeatureContent from './_content'

export default async function FeaturePage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role !== 'trainer') redirect(`/${session.user.role}/dashboard`)
  return (
    <DashboardLayout user={session.user}>
      <FeatureContent />
    </DashboardLayout>
  )
}

// _content.tsx
'use client'
export default function FeatureContent() {
  const { t } = useTranslation(['trainer', 'common'])
  // hooks, forms, fetch ...
}
```

### 3.8 — Loaders (two patterns only)

1. **Click-triggered async** → `<Button isLoading={...} loadingText={t('common.saving')}>` or `<ActionIconButton isLoading={...}>` for icon-only. Never a raw `<button disabled={loading}>`.
2. **Page navigation** → handled automatically by `loading.tsx` segments (Next.js renders `NavigationLoadingOverlay`). For client-driven post-submit redirects, call `useNavigationLoader().start()` before `router.push()` and `.stop()` on error.

`<FullPageLoader>` (logo + branding) is reserved for cold-start / app bootstrap, not in-app navigation.

### 3.9 — File naming

| Type | Convention | Example |
|---|---|---|
| Files / folders | `kebab-case` | `user-profile.tsx` |
| Components | `PascalCase` | `UserProfile` |
| Functions | `camelCase` | `getUserById` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| API routes | `route.ts` in `app/api/...` | `app/api/users/route.ts` |

### 3.10 — Forms

```typescript
const schema = z.object({
  name: z.string().min(1).max(100),
  weight: z.number().min(0).max(1000),
})

const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
})

<FormLabel required>{t('field.name')}</FormLabel>
<Input
  {...register('name')}
  state={errors.name ? 'error' : 'default'}
  helperText={errors.name?.message}
/>
```

---

## 4. Component API Quick Reference

### `<Button>`
```typescript
<Button
  variant="primary"        // 'primary' | 'secondary' | 'danger'
  size="md"                // 'sm' | 'md' | 'lg'
  isLoading={false}
  loadingText="Saving..."
  leftIcon={<Icon />}
  rightIcon={<Icon />}
  fullWidth={false}
  disabled={false}
  onClick={handleClick}
>Label</Button>
```

### `<Input>`
```typescript
<Input
  inputSize="md"           // 'md' | 'lg'
  state="default"          // 'default' | 'error' | 'success'
  helperText="Error msg"
  leftIcon={<SearchIcon />}
  {...register('fieldName')}
/>
```

### `<Card>`
```typescript
<Card variant="default">   {/* 'default' | 'elevated' | 'outlined' */}
  ...
</Card>
```

### `useToast()`
```typescript
const { showToast } = useToast()
showToast({ type: 'success', message: t('saved') })
```

### `<ConfirmationModal>`
```typescript
<ConfirmationModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={handleDelete}
  title={t('confirm.title')}
  message={t('confirm.message')}
  variant="danger"
/>
```

---

## 5. Data Model Quick Reference

Core entities: `User` · `Exercise` · `TrainingProgram` · `Week` · `Workout` · `WorkoutExercise` · `ExerciseFeedback` · `SetPerformed` · `PersonalRecord` · `MuscleGroup` · `MovementPattern` · `TrainerTrainee`.

Hierarchy: `TrainingProgram` → `Week` → `Workout` → `WorkoutExercise`.

Key enums (all lowercase):
- `Role`: `admin | trainer | trainee`
- `WeekType`: `normal | test | deload` — drives trainee UI theming
- `WeightType`: `absolute | percentage_1rm | percentage_rm | percentage_previous` — `percentage_previous` resolves recursively via `calculateEffectiveWeight()` in `src/lib/calculations.ts`. **Always** call this function — never re-implement.
- `ProgramStatus`: `draft | active | completed`
- `ExerciseType`: `fundamental | accessory`

`TrainerTrainee` is a many-to-many join. Always verify trainer owns the trainee before any operation (single `findFirst` — see Rule 3 in the backend skill).

---

## 6. RBAC Rules

| Route prefix | Allowed roles |
|---|---|
| `/admin/*` | `admin` only |
| `/trainer/*` | `trainer` only |
| `/trainee/*` | `trainee` only |
| `/api/admin/*` | `admin` only |
| `/api/trainer/*` | `trainer` only |
| `/api/trainee/*` | `trainee` only |

Trainers must own the trainee/program/workout/exercise they operate on.

**Public routes** (no middleware auth): `/login`, `/forgot-password`, `/reset-password`, `/force-change-password`, `/onboarding/set-password`.

---

## 7. Changelog — Mandatory Update

Every change adds an entry to `implementation-docs/CHANGELOG.md`:

```markdown
### [GG Mese AAAA] — Short title

**Task checklist:** #X.Y
**File modificati:** `path/to/file.ts`, `path/to/other.tsx`
**Note:** What was done, decisions made, issues encountered.
```

Also mark the corresponding task `[x]` in `implementation-docs/CHECKLIST.md`.

---

## 8. Testing Requirements

Full protocol in `.github/skills/zero-cento-testing/SKILL.md`. Summary:

- **Unit** (Vitest, jsdom) → `tests/unit/` — every utility, schema, component
- **Integration** (Vitest, jsdom) → `tests/integration/` — every API route: 200/201, 400, 401, 403, 404
- **E2E** (Playwright) → `tests/e2e/` — critical flows only
- Coverage enforced at **80%** for files in `vitest.config.ts` `coverage.include`
- Run: `npm run test:unit` · single file: `npx vitest run tests/unit/foo.test.ts` · E2E: `npm run test:e2e`
- Node 20+ required (`.nvmrc`); Node 18 fails on `styleText`

Shared mocks live in `tests/unit/setup.ts` (Next router/link, Supabase, Prisma, react-i18next). Do not redeclare locally. Shared session fixtures in `tests/integration/fixtures.ts`.

---

## 9. Commands

```bash
# Dev
npm run dev              # http://localhost:3000
npm run build
npm run lint
npm run type-check       # tsc --noEmit

# Database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio    # http://localhost:5555
npm run prisma:seed

# Tests
npm run test:unit
npm run test:e2e
npm run test:e2e:ui
```

---

## 10. Git Workflow

Two branches: `development` (test/staging) and `master` (production). Features branch from `development`. Direct pushes forbidden. Hotfixes branch from `master` and backport to `development`. Full rules in `.github/skills/git-pr-workflow/SKILL.md`.

---

## 11. What NOT to Do

- ❌ Install new UI libraries (shadcn, Radix, new MUI components for non-DataGrid use) — use existing custom components
- ❌ Hardcoded hex colors — use brand tokens
- ❌ Raw `<button>`, `<input>`, `<label>`, `<textarea>` — use custom components
- ❌ Hardcoded user-facing strings — use `useTranslation`
- ❌ Raw `NextResponse.json()` from API routes — use `apiSuccess` / `apiError`
- ❌ `'use client'` in `page.tsx` — split into `_content.tsx`
- ❌ Bypass RBAC or ownership checks
- ❌ Re-implement `calculateEffectiveWeight` — import from `src/lib/calculations.ts`
- ❌ Call `supabase.auth.getUser()` in middleware for `/api/*` routes
- ❌ Split ownership checks into `findMany` + `findUnique`
- ❌ Load full program tree when a slice suffices
- ❌ Skip the `CHANGELOG.md` / `CHECKLIST.md` update
