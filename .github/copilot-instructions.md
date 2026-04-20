# GitHub Copilot Instructions — ZeroCento Training Platform

> Place this file at `.github/copilot-instructions.md` in the repository root.
> Copilot will automatically use these instructions for every suggestion in this repo.

---

## 1. Project Identity

ZeroCento is a **trainer-led training management platform** (Next.js 15 + Supabase + Prisma + Vercel).
Single-repo, full-stack. No separate backend service — Next.js App Router is the BFF.

**Roles:** Admin · Trainer · Trainee  
**UX split:** Admin/Trainer → desktop-first · Trainee → mobile portrait-first (used in-gym)

---

## 2. Tech Stack (non-negotiable)

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, RSC by default) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS — use brand tokens, never raw hex |
| UI Components | Custom design system in `src/components/` — **see §4** |
| State (server) | TanStack Query |
| State (global) | React Context API |
| Forms | React Hook Form + Zod |
| ORM | Prisma |
| Auth | Supabase Auth (JWT sessions) |
| Email | Resend |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| i18n | next-i18next — IT default, EN supported |

---

## 3. Non-Negotiable Rules

### 3.1 — Always use custom components (CRITICAL)

**Never use raw HTML elements or generic Next.js components when a custom component exists.**

All custom components are exported from `src/components/index.ts`. Always import from there.

```typescript
// ✅ CORRECT
import { Button, Input, FormLabel, Card } from '@/components'

// ❌ WRONG — never write raw elements when a custom component exists
<button className="bg-brand-primary ...">Save</button>
<input className="border rounded ..." />
<label className="font-medium ...">Name</label>
```

**Available base components and when to use them:**

| Component | Use instead of |
|---|---|
| `<Button>` | Any `<button>` element |
| `<Input>` | Any `<input>` element (text, number, email, etc.) |
| `<Textarea>` | Any `<textarea>` element |
| `<FormLabel>` | Any `<label>` element in forms |
| `<Card>` | Any `<div>` acting as a card/panel |
| `<LoadingSpinner>` / `<FullPageLoader>` / `<InlineLoader>` | Any loading state |
| `<Skeleton>` / `<SkeletonCard>` / `<SkeletonForm>` etc. | Any skeleton loading |
| `<ToastNotification>` + `useToast()` | Any alert/notification |
| `<ConfirmationModal>` | Any confirm dialog |
| `<ErrorBoundary>` | Any error boundary wrapper |
| `<RoleGuard>` | Any role-based rendering |
| `<DashboardLayout>` | Any page layout in authenticated area |

**Button variants:** `primary` (default) · `secondary` · `danger`  
**Button sizes:** `sm` · `md` (default) · `lg`  
**Input states:** `default` · `error` · `success`

### 3.2 — Brand tokens, never hardcoded hex

```typescript
// ✅ CORRECT
className="bg-brand-primary hover:bg-brand-primary-hover text-brand-secondary"

// ❌ WRONG
className="bg-[#FFA700] hover:bg-[#E69500]"
style={{ color: '#FFA700' }}
```

Brand tokens defined in `tailwind.config.ts`:
- `brand-primary` → #FFA700 (orange)
- `brand-primary-hover` → #E69500
- `brand-secondary` → #000000
- `brand-accent` → #FFFFFF

Focus rings must use `focus:ring-brand-primary`, never `focus:ring-blue-500`.

### 3.3 — i18n: no hardcoded strings

Every user-visible string must use i18n. Never hardcode Italian or English text.

```typescript
// ✅ CORRECT
const { t } = useTranslation('common')
return <h1>{t('dashboard.title')}</h1>

// ❌ WRONG
return <h1>Dashboard</h1>
```

### 3.4 — API response format

All API routes must use the wrappers from `src/lib/api-response.ts`:

```typescript
// ✅ Success
return ApiResponse.success(data)            // { data: ..., meta: { timestamp } }
return ApiResponse.created(data)

// ✅ Error
return ApiResponse.error('NOT_FOUND', 'Resource not found', 404)
return ApiResponse.validationError(zodError)

// ❌ WRONG — never return raw JSON
return NextResponse.json({ result: data })
```

### 3.5 — Every API route must follow this exact pattern

```typescript
export async function GET(request: Request) {
  // 1. Auth check
  const session = await getSession(request)
  if (!session) return ApiResponse.unauthorized()

  // 2. Role guard
  if (session.role !== 'trainer') return ApiResponse.forbidden()

  // 3. Input validation (Zod)
  const parsed = schema.safeParse(input)
  if (!parsed.success) return ApiResponse.validationError(parsed.error)

  // 4. Business logic
  const result = await prisma.something.findMany(...)

  // 5. Return
  return ApiResponse.success(result)
}
```

### 3.6 — Server vs Client components

- **Default to Server Components** (RSC) — no `'use client'` unless strictly needed
- **Split pattern** for pages with mixed needs:
  - `page.tsx` → Server Component (auth check, DashboardLayout, data fetching)
  - `_content.tsx` → Client Component (interactivity, hooks, forms)

```typescript
// page.tsx (server)
export default async function SomePage() {
  const session = await getSession()
  if (!session || session.role !== 'trainer') redirect('/login')
  return (
    <DashboardLayout role="trainer">
      <SomeContent />
    </DashboardLayout>
  )
}

// _content.tsx (client)
'use client'
export default function SomeContent() {
  const { t } = useTranslation('trainer')
  // ... hooks, forms, etc.
}
```

### 3.7 — File naming conventions

| Type | Convention | Example |
|---|---|---|
| Files/Folders | `kebab-case` | `user-profile.tsx` |
| Components | `PascalCase` | `UserProfile` |
| Functions | `camelCase` | `getUserById` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| API routes | `route.ts` in `app/api/` folder | `app/api/users/route.ts` |

### 3.8 — Form pattern (React Hook Form + Zod)

```typescript
const schema = z.object({
  name: z.string().min(1).max(100),
  weight: z.number().min(0).max(1000),
})

const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
})

// In JSX — always use custom components
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
  size="md"               // 'sm' | 'md' | 'lg'
  isLoading={false}       // shows spinner, disables button
  loadingText="Saving..."
  icon={<IconComponent />}
  iconPosition="left"     // 'left' | 'right'
  fullWidth={false}
  disabled={false}
  onClick={handleClick}
>
  Label
</Button>
```

### `<Input>`
```typescript
<Input
  inputSize="md"          // 'md' | 'lg'
  state="default"         // 'default' | 'error' | 'success'
  helperText="Error msg"
  icon={<SearchIcon />}
  iconPosition="left"
  {...register('fieldName')}
/>
```

### `<Card>`
```typescript
<Card variant="default">  // 'default' | 'elevated' | 'outlined'
  content
</Card>
```

### `useToast()`
```typescript
const { showToast } = useToast()
showToast({ type: 'success', message: t('saved') })
showToast({ type: 'error', message: t('error') })
```

### `<ConfirmationModal>`
```typescript
<ConfirmationModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={handleDelete}
  title={t('confirm.title')}
  message={t('confirm.message')}
  confirmVariant="danger"
/>
```

---

## 5. Data Model Quick Reference

Core entities: `User` · `Exercise` · `Program` · `Week` · `WorkoutExercise` · `ExerciseFeedback` · `SetPerformed` · `PersonalRecord` · `MuscleGroup` · `MovementPattern` · `TrainerTrainee`

Key rules:
- `User.role` is an enum: `ADMIN` | `TRAINER` | `TRAINEE`  
- Weight calculation uses `calculateEffectiveWeight()` in `src/lib/calculations.ts` — **always use this function, never re-implement the logic**
- TrainerTrainee is a composite key relationship — always validate trainer owns the trainee before any operation

---

## 6. RBAC Rules

| Route prefix | Allowed roles |
|---|---|
| `/admin/*` | ADMIN only |
| `/trainer/*` | TRAINER only |
| `/trainee/*` | TRAINEE only |
| `/api/admin/*` | ADMIN only |
| `/api/trainer/*` | TRAINER only |
| `/api/trainee/*` | TRAINEE only |

Always check ownership: a trainer must own the trainee they're operating on.

---

## 7. Changelog — Mandatory Update

**Every time you implement a change, add an entry to `implementation-docs/CHANGELOG.md`.**

Format:
```markdown
### [GG Mese AAAA] — Short title

**Task checklist:** #X.Y  
**File modificati:** `path/to/file.ts`, `path/to/other.tsx`  
**Note:** What was done, any decisions made, issues encountered.
```

Also update `implementation-docs/CHECKLIST.md` — mark the task `[x]` when done.

---

## 8. Testing Requirements

- **Unit tests** (Vitest): every utility function and Zod schema
- **Integration tests** (Vitest): every API route — happy path + auth failure + validation error
- **E2E tests** (Playwright): critical user flows only

Test file locations:
- `tests/unit/` — unit tests
- `tests/integration/` — API route tests
- `tests/e2e/` — end-to-end flows

---

## 9. What NOT to Do

- ❌ Do not install new UI libraries (MUI, shadcn, Radix, etc.) — use existing custom components
- ❌ Do not use hardcoded hex colors — use Tailwind brand tokens
- ❌ Do not write `<button>`, `<input>`, `<label>`, `<textarea>` directly — use custom components
- ❌ Do not skip i18n for any visible string
- ❌ Do not return raw `NextResponse.json()` from API routes — use `ApiResponse` wrappers
- ❌ Do not add `'use client'` to page.tsx — split into `_content.tsx` instead
- ❌ Do not bypass RBAC or ownership checks
- ❌ Do not re-implement `calculateEffectiveWeight` — import from `src/lib/calculations.ts`
- ❌ Do not forget to update `CHANGELOG.md` and `CHECKLIST.md`

---

## 10. Remaining Tasks (as of April 2026)

Open items tracked in `implementation-docs/CHECKLIST.md`:

**Sprint 6 — CI/CD (7 tasks):** `vercel.json`, GitHub secrets, Sentry, UptimeRobot  
**Sprint 8 — PWA (7 tasks):** Service worker, offline cache, real icons, DB indexes, admin report cache  
**Sprint 11 — i18n (4 tasks):** Remaining hardcoded error keys in 3 pages + integration test updates  
**Vulnerabilities:** `eslint-config-next` → 16.2.4 · `minimatch` via `@typescript-eslint` upgrade
