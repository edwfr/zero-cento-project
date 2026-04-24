# Back Navigation Centralization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ~16 scattered inline back buttons across trainer/trainee pages with a single back button in DashboardLayout header, positioned between the hamburger menu and the logo.

**Architecture:** `DashboardLayout` gains an optional `backHref?: string` prop. When provided, it renders an `ArrowLeft` Link button in the header. Each `page.tsx` (server component) computes the back href from route params and `searchParams`, then passes it to `DashboardLayout`. Content components (`_content.tsx`) drop their inline back button JSX, reclaiming vertical space in every page header.

**Tech Stack:** Next.js 15 App Router (server components for href computation), Lucide React (`ArrowLeft`), react-i18next (one new `goBack` key), Vitest

---

## File Map

**Create:**
- `tests/unit/DashboardLayout.test.tsx`

**Modify — component:**
- `src/components/DashboardLayout.tsx` — add `backHref?: string` prop + back button rendering

**Modify — i18n:**
- `public/locales/en/navigation.json`
- `public/locales/it/navigation.json`
- `public/locales/en/trainer.json`
- `public/locales/it/trainer.json`
- `public/locales/en/trainee.json`
- `public/locales/it/trainee.json`

**Modify — trainee pages (page.tsx + _content.tsx):**
- `src/app/trainee/history/`
- `src/app/trainee/records/`
- `src/app/trainee/programs/current/`
- `src/app/trainee/programs/[id]/`
- `src/app/trainee/programs/_components/ProgramDetailContent.tsx`
- `src/app/trainee/workouts/[id]/`

**Modify — trainer pages (page.tsx + _content.tsx):**
- `src/app/trainer/trainees/`
- `src/app/trainer/trainees/new/`
- `src/app/trainer/trainees/[id]/`
- `src/app/trainer/exercises/`
- `src/app/trainer/exercises/new/`
- `src/app/trainer/exercises/[id]/edit/`
- `src/app/trainer/programs/` (list)
- `src/app/trainer/programs/new/`
- `src/app/trainer/programs/[id]/` (view, viewOnly=true)
- `src/app/trainer/programs/[id]/edit/`
- `src/app/trainer/programs/[id]/review/`
- `src/app/trainer/programs/[id]/publish/`
- `src/app/trainer/programs/[id]/tests/`

---

## Back Href Reference

| Page | backHref | Source |
|------|----------|--------|
| trainee/history | `/trainee/dashboard` | static |
| trainee/records | `/trainee/dashboard` | static |
| trainee/programs/current | `/trainee/dashboard` | static |
| trainee/programs/[id] | `/trainee/history` | static |
| trainee/workouts/[id] | `/trainee/programs/${programId}` or `/trainee/programs/current` | searchParams `from` + `programId` |
| trainer/trainees | `/trainer/dashboard` | static |
| trainer/trainees/new | `/trainer/trainees` | static |
| trainer/trainees/[id] | `/trainer/trainees` | static |
| trainer/exercises | `/trainer/dashboard` | static |
| trainer/exercises/new | `/trainer/exercises` | static |
| trainer/exercises/[id]/edit | `/trainer/exercises` | static |
| trainer/programs | `/trainer/dashboard` | static |
| trainer/programs/new | `/trainer/trainees/${id}` or `/trainer/programs` | computed in page.tsx already |
| trainer/programs/[id] (view) | `/trainer/programs` | static (viewOnly=true) |
| trainer/programs/[id]/edit | `/trainer/trainees/${id}` or `/trainer/programs` | searchParams `backContext` + `traineeId` |
| trainer/programs/[id]/review | `/trainer/trainees/${id}` or `/trainer/programs` | searchParams `backContext` + `traineeId` |
| trainer/programs/[id]/publish | `/trainer/programs/${id}/review` | route param `id` |
| trainer/programs/[id]/tests | `/trainer/dashboard` or `/trainer/trainees/${id}` or `/trainer/programs` | searchParams `backContext` + `traineeId` |

---

### Task 1: DashboardLayout — add `backHref` prop and header back button

**Files:**
- Modify: `src/components/DashboardLayout.tsx`
- Modify: `public/locales/en/navigation.json`
- Modify: `public/locales/it/navigation.json`
- Create: `tests/unit/DashboardLayout.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/DashboardLayout.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/supabase-client', () => ({
    createClient: () => ({ auth: { signOut: vi.fn().mockResolvedValue({}) } }),
}))
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('next/image', () => ({ default: (props: Record<string, unknown>) => <img {...(props as object)} /> }))
vi.mock('next/link', () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>{children}</a>
    ),
}))

const mockUser = {
    id: '1',
    email: 'trainer@test.com',
    firstName: 'Ed',
    lastName: 'F',
    role: 'trainer' as const,
}

describe('DashboardLayout', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('does not render back button when backHref is not provided', async () => {
        const { default: DashboardLayout } = await import('@/components/DashboardLayout')
        render(<DashboardLayout user={mockUser}><div /></DashboardLayout>)
        expect(screen.queryByLabelText('navigation.goBack')).not.toBeInTheDocument()
    })

    it('renders back button in header when backHref is provided', async () => {
        const { default: DashboardLayout } = await import('@/components/DashboardLayout')
        render(
            <DashboardLayout user={mockUser} backHref="/trainer/programs">
                <div />
            </DashboardLayout>
        )
        const backLink = screen.getByLabelText('navigation.goBack')
        expect(backLink).toBeInTheDocument()
        expect(backLink).toHaveAttribute('href', '/trainer/programs')
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/DashboardLayout.test.tsx
```
Expected: FAIL — `backHref` prop not in interface, no back button rendered.

- [ ] **Step 3: Add `goBack` i18n key to both locales**

In `public/locales/en/navigation.json`, inside the `"navigation"` object, add:
```json
"goBack": "Go back"
```

In `public/locales/it/navigation.json`, inside the `"navigation"` object, add:
```json
"goBack": "Torna indietro"
```

- [ ] **Step 4: Update `DashboardLayout.tsx`**

**a) Add `ArrowLeft` to the lucide-react import** (line 10–19):
```typescript
import {
    ArrowLeft,
    Home,
    Users,
    ClipboardList,
    Dumbbell,
    User,
    CalendarDays,
    Trophy,
    BarChart2,
    Settings,
} from 'lucide-react'
```

**b) Add `backHref` to the props interface** (lines 29–32):
```typescript
interface DashboardLayoutProps {
    user: User
    children: ReactNode
    backHref?: string
}
```

**c) Destructure `backHref` from params** (line 59):
```typescript
export default function DashboardLayout({ user, children, backHref }: DashboardLayoutProps) {
```

**d) Insert back button between hamburger and logo** (between line 90 and line 92 — after the closing `</button>` of hamburger, before the logo `<Link>`):
```tsx
{backHref && (
    <Link
        href={backHref}
        className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label={t('navigation.goBack')}
        title={t('navigation.goBack')}
    >
        <ArrowLeft className="w-5 h-5 text-gray-700" />
    </Link>
)}
```

The `flex items-center space-x-3` wrapper on the left side naturally provides spacing.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/unit/DashboardLayout.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/DashboardLayout.tsx public/locales/en/navigation.json public/locales/it/navigation.json tests/unit/DashboardLayout.test.tsx
git commit -m "feat: add backHref prop to DashboardLayout with header back button"
```

---

### Task 2: Trainee — history and records pages

**Files:**
- Modify: `src/app/trainee/history/page.tsx`
- Modify: `src/app/trainee/history/_content.tsx`
- Modify: `src/app/trainee/records/page.tsx`
- Modify: `src/app/trainee/records/_content.tsx`

Both go statically back to `/trainee/dashboard`.

- [ ] **Step 1: Update `src/app/trainee/history/page.tsx`**

Change the return to:
```typescript
return (
    <DashboardLayout user={session.user} backHref="/trainee/dashboard">
        <HistoryContent />
    </DashboardLayout>
)
```

- [ ] **Step 2: Remove back button from `src/app/trainee/history/_content.tsx`**

a) Remove `ArrowLeft` from the lucide-react import (line 8 — keep `ClipboardList` or any other icon still used).

b) Remove this entire JSX block (the `<Link>` with `ArrowLeft` and `t('history.backToDashboard')`):
```tsx
<Link
    href="/trainee/dashboard"
    className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4"
>
    <ArrowLeft className="w-4 h-4" />
    {t('history.backToDashboard')}
</Link>
```

- [ ] **Step 3: Update `src/app/trainee/records/page.tsx`**

Change the return to:
```typescript
return (
    <DashboardLayout user={session.user} backHref="/trainee/dashboard">
        <RecordsContent />
    </DashboardLayout>
)
```

- [ ] **Step 4: Remove back button from `src/app/trainee/records/_content.tsx`**

a) Remove `ArrowLeft` from lucide-react import.

b) Remove the `<Link href="/trainee/dashboard" ...><ArrowLeft .../>{t('records.backToDashboard')}</Link>` JSX block.

- [ ] **Step 5: Type check**

```bash
npm run type-check
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/trainee/history/ src/app/trainee/records/
git commit -m "refactor: centralize back nav for trainee history and records pages"
```

---

### Task 3: Trainee — program views (current and history detail)

**Files:**
- Modify: `src/app/trainee/programs/current/page.tsx`
- Modify: `src/app/trainee/programs/[id]/page.tsx`
- Modify: `src/app/trainee/programs/_components/ProgramDetailContent.tsx`

`ProgramDetailContent` is shared by both pages, rendered with `mode="current"` (→ back to `/trainee/dashboard`) and `mode="history"` (→ back to `/trainee/history`). The back href is now determined at the page level.

- [ ] **Step 1: Update `src/app/trainee/programs/current/page.tsx`**

```typescript
return (
    <DashboardLayout user={session.user} backHref="/trainee/dashboard">
        <CurrentProgramContent />
    </DashboardLayout>
)
```

- [ ] **Step 2: Update `src/app/trainee/programs/[id]/page.tsx`**

```typescript
return (
    <DashboardLayout user={session.user} backHref="/trainee/history">
        <ProgramDetailByIdContent programId={id} />
    </DashboardLayout>
)
```

- [ ] **Step 3: Remove back button from `ProgramDetailContent.tsx`**

File: `src/app/trainee/programs/_components/ProgramDetailContent.tsx`

a) Remove `ArrowLeft` from lucide-react import (line ~9–17; keep other icons still used).

b) Remove `backHref` and `backLabel` variable declarations (around line 236–239). Keep `isHistoryMode` — it is used for other conditional rendering (e.g., workout link `from` param):
```typescript
// REMOVE only these two:
const backHref = isHistoryMode ? '/trainee/history' : '/trainee/dashboard'
const backLabel = isHistoryMode
    ? t('programs.backToHistory')
    : t('programs.backToDashboard')
```

c) Remove the back button JSX block (around line 596–601):
```tsx
// REMOVE:
<Link
    href={backHref}
    className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4"
>
    <ArrowLeft className="w-4 h-4" />
    {backLabel}
</Link>
```

- [ ] **Step 4: Type check**

```bash
npm run type-check
```

- [ ] **Step 5: Commit**

```bash
git add src/app/trainee/programs/
git commit -m "refactor: centralize back nav for trainee program views"
```

---

### Task 4: Trainee — workout detail page (dynamic searchParams)

**Files:**
- Modify: `src/app/trainee/workouts/[id]/page.tsx`
- Modify: `src/app/trainee/workouts/[id]/_content.tsx`

backHref: `?from=history&programId={id}` → `/trainee/programs/{id}`, else → `/trainee/programs/current`.

- [ ] **Step 1: Update `src/app/trainee/workouts/[id]/page.tsx`**

Replace the current page (which has no props) with:
```typescript
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import WorkoutDetailContent from './_content'

interface WorkoutDetailPageProps {
    searchParams?: Promise<{ from?: string; programId?: string }>
}

export default async function WorkoutDetailPage({ searchParams }: WorkoutDetailPageProps) {
    const resolvedSearchParams = await searchParams
    const session = await getSession()

    if (!session) redirect('/login')
    if (session.user.role !== 'trainee') redirect(`/${session.user.role}/dashboard`)

    const source = resolvedSearchParams?.from
    const sourceProgramId = resolvedSearchParams?.programId
    const backHref = source === 'history' && sourceProgramId
        ? `/trainee/programs/${sourceProgramId}`
        : '/trainee/programs/current'

    return (
        <DashboardLayout user={session.user} backHref={backHref}>
            <WorkoutDetailContent />
        </DashboardLayout>
    )
}
```

- [ ] **Step 2: Remove back button from `src/app/trainee/workouts/[id]/_content.tsx`**

a) Remove `ArrowLeft` from lucide-react import (line 11 — keep `Check, ChevronDown, ChevronUp, Clock3, FileText, Gauge, PlayCircle`).

b) Remove `backToProgramHref` variable (around line 137–139):
```typescript
// REMOVE:
const backToProgramHref = source === 'history' && sourceProgramId
    ? `/trainee/programs/${sourceProgramId}`
    : '/trainee/programs/current'
```

c) Check whether `source` and `sourceProgramId` are used anywhere else in `_content.tsx`. If they are only used for `backToProgramHref`, remove them too:
```typescript
// REMOVE if only used for backToProgramHref:
const source = searchParams.get('from')
const sourceProgramId = searchParams.get('programId')
```

d) Remove the back button JSX block (around line 614–618):
```tsx
// REMOVE:
<Link
    href={backToProgramHref}
    className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4"
>
    <ArrowLeft className="w-4 h-4" />
    {t('workouts.backToProgram')}
</Link>
```

e) If `searchParams` is no longer used in `_content.tsx` after removing `source`/`sourceProgramId`, remove the `const searchParams = useSearchParams()` call and the `useSearchParams` import.

- [ ] **Step 3: Type check**

```bash
npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add src/app/trainee/workouts/
git commit -m "refactor: centralize back nav for trainee workout detail page"
```

---

### Task 5: Trainer — trainees section (list, new, detail)

**Files:**
- Modify: `src/app/trainer/trainees/page.tsx`
- Modify: `src/app/trainer/trainees/_content.tsx`
- Modify: `src/app/trainer/trainees/new/page.tsx`
- Modify: `src/app/trainer/trainees/new/_content.tsx`
- Modify: `src/app/trainer/trainees/[id]/page.tsx`
- Modify: `src/app/trainer/trainees/[id]/_content.tsx`

All static back hrefs.

- [ ] **Step 1: `trainer/trainees/page.tsx`** — add `backHref="/trainer/dashboard"` to `DashboardLayout`.

- [ ] **Step 2: `trainer/trainees/_content.tsx`** — remove:
  - `ArrowLeft` from lucide-react imports (line 11, keep `Plus, Eye, UserX, UserCheck`)
  - The back button Link JSX (around line 103–107):
    ```tsx
    // REMOVE:
    <Link
        href="/trainer/dashboard"
        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-flex items-center gap-1"
    >
        <ArrowLeft className="w-4 h-4" />
        {tNav('breadcrumbs.backToHome')}
    </Link>
    ```

- [ ] **Step 3: `trainer/trainees/new/page.tsx`** — add `backHref="/trainer/trainees"` to `DashboardLayout`.

- [ ] **Step 4: `trainer/trainees/new/_content.tsx`** — remove `ArrowLeft` import and the back button JSX with `t('athletes.backToAthletes')`.

- [ ] **Step 5: `trainer/trainees/[id]/page.tsx`** — add `backHref="/trainer/trainees"` to `DashboardLayout`.

- [ ] **Step 6: `trainer/trainees/[id]/_content.tsx`** — remove `ArrowLeft` import and back button JSX (around line 606: `t('athletes.backToAthletes')`).

- [ ] **Step 7: Type check**

```bash
npm run type-check
```

- [ ] **Step 8: Commit**

```bash
git add src/app/trainer/trainees/
git commit -m "refactor: centralize back nav for trainer trainees section"
```

---

### Task 6: Trainer — exercises section (list, new, edit)

**Files:**
- Modify: `src/app/trainer/exercises/page.tsx`
- Modify: `src/app/trainer/exercises/_content.tsx`
- Modify: `src/app/trainer/exercises/new/page.tsx`
- Modify: `src/app/trainer/exercises/new/_content.tsx`
- Modify: `src/app/trainer/exercises/[id]/edit/page.tsx`
- Modify: `src/app/trainer/exercises/[id]/edit/_content.tsx`

All static back hrefs.

- [ ] **Step 1: `trainer/exercises/page.tsx`** — add `backHref="/trainer/dashboard"` to `DashboardLayout`.

- [ ] **Step 2: `trainer/exercises/_content.tsx`** — remove `ArrowLeft` import and back button JSX (around line 163: `tNav('breadcrumbs.backToHome')`).

- [ ] **Step 3: `trainer/exercises/new/page.tsx`** — add `backHref="/trainer/exercises"` to `DashboardLayout`.

- [ ] **Step 4: `trainer/exercises/new/_content.tsx`** — remove `ArrowLeft` import and back button JSX (`t('exercises.backToLibrary')`).

- [ ] **Step 5: `trainer/exercises/[id]/edit/page.tsx`** — add `backHref="/trainer/exercises"` to `DashboardLayout`.

- [ ] **Step 6: `trainer/exercises/[id]/edit/_content.tsx`** — remove `ArrowLeft` import and ALL back button Links to `/trainer/exercises` with ArrowLeft (there may be two instances — the main header back button and a secondary one if present). Do not remove navigation links that go forward.

- [ ] **Step 7: Type check**

```bash
npm run type-check
```

- [ ] **Step 8: Commit**

```bash
git add src/app/trainer/exercises/
git commit -m "refactor: centralize back nav for trainer exercises section"
```

---

### Task 7: Trainer — programs list page

**Files:**
- Modify: `src/app/trainer/programs/page.tsx`
- Modify: `src/app/trainer/programs/_content.tsx`

Static: list → `/trainer/dashboard`.

- [ ] **Step 1: `trainer/programs/page.tsx`** — add `backHref="/trainer/dashboard"` to `DashboardLayout`.

- [ ] **Step 2: `trainer/programs/_content.tsx`** — remove `ArrowLeft` import and back button JSX (around line 199: `tNav('breadcrumbs.backToHome')`).

- [ ] **Step 3: Type check and commit**

```bash
npm run type-check
git add src/app/trainer/programs/page.tsx src/app/trainer/programs/_content.tsx
git commit -m "refactor: centralize back nav for trainer programs list"
```

---

### Task 8: Trainer — new program page (context-aware)

**Files:**
- Modify: `src/app/trainer/programs/new/page.tsx`
- Modify: `src/app/trainer/programs/new/NewProgramContent.tsx`

page.tsx already computes `hasRequestedTrainee` and `requestedTraineeId` — backHref just needs to be derived from these.

- [ ] **Step 1: Update `src/app/trainer/programs/new/page.tsx`**

After the existing `initialTraineeId` computation, add:
```typescript
const backHref = hasRequestedTrainee
    ? `/trainer/trainees/${requestedTraineeId}`
    : '/trainer/programs'
```

Pass to DashboardLayout:
```typescript
return (
    <DashboardLayout user={session.user} backHref={backHref}>
        <div className="py-6">
            <NewProgramContent
                trainees={trainees}
                initialTraineeId={initialTraineeId}
                backContext={hasRequestedTrainee ? 'trainee' : 'programs'}
            />
        </div>
    </DashboardLayout>
)
```

- [ ] **Step 2: Remove back button from `NewProgramContent.tsx`**

a) Remove `ArrowLeft` from lucide-react import (keep `BarChart3`).

b) Remove `backHref` and `backLabel` variables (around line 43–46):
```typescript
// REMOVE:
const backHref = backContext === 'trainee' && traineeId
    ? `/trainer/trainees/${traineeId}`
    : '/trainer/programs'
const backLabel = backContext === 'trainee'
    ? t('navigation:breadcrumbs.backToAthleteProfile')
    : t('navigation:breadcrumbs.backToPrograms')
```

c) Remove back button JSX block.

d) Check if `backContext` prop is still used anywhere else in `NewProgramContent.tsx` after removing `backHref`/`backLabel`. If not, remove it from:
- The `NewProgramContentProps` interface
- The destructured params

- [ ] **Step 3: Type check**

```bash
npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add src/app/trainer/programs/new/
git commit -m "refactor: centralize back nav for trainer new program page"
```

---

### Task 9: Trainer — program view page (viewOnly=true, static)

**Files:**
- Modify: `src/app/trainer/programs/[id]/page.tsx`

This renders `ReviewProgramContent viewOnly={true}`. Back href is statically `/trainer/programs`.
(The back button JSX is removed from `ReviewProgramContent` in Task 11.)

- [ ] **Step 1: Update `src/app/trainer/programs/[id]/page.tsx`**

```typescript
return (
    <DashboardLayout user={session.user} backHref="/trainer/programs">
        <ReviewProgramContent viewOnly={true} />
    </DashboardLayout>
)
```

- [ ] **Step 2: Commit**

```bash
git add src/app/trainer/programs/[id]/page.tsx
git commit -m "refactor: centralize back nav for trainer program view (viewOnly)"
```

---

### Task 10: Trainer — program edit page (context-aware)

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/page.tsx`
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`

backHref: `backContext=trainee&traineeId={id}` → `/trainer/trainees/{id}`, else → `/trainer/programs`.

- [ ] **Step 1: Update `src/app/trainer/programs/[id]/edit/page.tsx`**

```typescript
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import EditProgramContent from './_content'

interface EditProgramPageProps {
    searchParams?: Promise<{ backContext?: string; traineeId?: string }>
}

export default async function EditProgramPage({ searchParams }: EditProgramPageProps) {
    const resolvedSearchParams = await searchParams
    const session = await getSession()
    if (!session) redirect('/login')
    if (session.user.role !== 'trainer') redirect(`/${session.user.role}/dashboard`)

    const backContext = resolvedSearchParams?.backContext
    const traineeId = resolvedSearchParams?.traineeId
    const backHref = backContext === 'trainee' && traineeId
        ? `/trainer/trainees/${traineeId}`
        : '/trainer/programs'

    return (
        <DashboardLayout user={session.user} backHref={backHref}>
            <EditProgramContent readOnly={false} />
        </DashboardLayout>
    )
}
```

- [ ] **Step 2: Remove back button from `src/app/trainer/programs/[id]/edit/_content.tsx`**

a) Remove `ArrowLeft` from lucide-react import (line ~20; keep `BarChart3, ChevronDown, ChevronUp, Copy, Dumbbell, FileEdit, Flame, Info, Lock, LockOpen, Plus, Save, Trash2`).

b) Remove ONLY `backHref` and `backLabel` variables (around lines 402–406). **Keep** all other vars — `backContext`, `queryTraineeId`, `resolvedTraineeId`, `hasTraineeBackContext`, `navigationContextQuery`, `editProgramHref`, `reviewProgramHref` — they are all used for forward navigation links within the edit page:
```typescript
// REMOVE only these two:
const backHref = hasTraineeBackContext
    ? `/trainer/trainees/${resolvedTraineeId}`
    : '/trainer/programs'
const backLabel = hasTraineeBackContext
    ? t('navigation:breadcrumbs.backToAthleteProfile')
    : t('editProgram.backToPrograms')
```

c) Remove back button JSX (around line 1963):
```tsx
// REMOVE:
<Link
    href={backHref}
    className="..."
>
    <ArrowLeft className="w-4 h-4" />
    {backLabel}
</Link>
```

- [ ] **Step 3: Type check**

```bash
npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/
git commit -m "refactor: centralize back nav for trainer program edit page"
```

---

### Task 11: Trainer — program review page (context-aware)

**Files:**
- Modify: `src/app/trainer/programs/[id]/review/page.tsx`
- Modify: `src/app/trainer/programs/[id]/review/_content.tsx`

backHref: `backContext=trainee&traineeId={id}` → `/trainer/trainees/{id}`, else → `/trainer/programs`.

This also fixes the `viewOnly=true` case (handled via Task 9): the `_content.tsx` back button is removed for both modes.

- [ ] **Step 1: Update `src/app/trainer/programs/[id]/review/page.tsx`**

```typescript
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import ReviewProgramContent from './_content'

interface ReviewProgramPageProps {
    searchParams?: Promise<{ backContext?: string; traineeId?: string }>
}

export default async function ReviewProgramPage({ searchParams }: ReviewProgramPageProps) {
    const resolvedSearchParams = await searchParams
    const session = await getSession()
    if (!session) redirect('/login')
    if (session.user.role !== 'trainer') redirect(`/${session.user.role}/dashboard`)

    const backContext = resolvedSearchParams?.backContext
    const traineeId = resolvedSearchParams?.traineeId
    const backHref = backContext === 'trainee' && traineeId
        ? `/trainer/trainees/${traineeId}`
        : '/trainer/programs'

    return (
        <DashboardLayout user={session.user} backHref={backHref}>
            <ReviewProgramContent />
        </DashboardLayout>
    )
}
```

- [ ] **Step 2: Remove back button from `src/app/trainer/programs/[id]/review/_content.tsx`**

a) Remove `ArrowLeft` from lucide-react import (line 7; keep `ChevronDown, ChevronUp, FileEdit`).

b) Remove ONLY `backHref` and `backLabel` variables (around lines 284–293). **Keep** `backContext`, `queryTraineeId`, `resolvedTraineeId`, `hasTraineeBackContext`, `contextSearchParams` — all used for forward navigation within the review page:
```typescript
// REMOVE only these two blocks:
const backHref = viewOnly
    ? '/trainer/programs'
    : hasTraineeBackContext
        ? `/trainer/trainees/${resolvedTraineeId}${contextSearchParams}`
        : '/trainer/programs'
const backLabel = viewOnly
    ? t('programs.backToPrograms')
    : hasTraineeBackContext
        ? t('navigation:breadcrumbs.backToAthleteProfile')
        : t('reviewProgram.backToEdit')
```

c) Remove back button JSX (around line 727–731):
```tsx
// REMOVE:
<Link
    href={backHref}
    className="..."
>
    <ArrowLeft className="h-4 w-4" />
    {backLabel}
</Link>
```

**Important:** Do NOT remove the `backToEdit` buttons at the bottom of the page (~lines 1133, 1141) — those are workflow navigation buttons for moving between review steps, not the main back button.

- [ ] **Step 3: Type check**

```bash
npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add src/app/trainer/programs/[id]/review/
git commit -m "refactor: centralize back nav for trainer program review page"
```

---

### Task 12: Trainer — program publish page (route param)

**Files:**
- Modify: `src/app/trainer/programs/[id]/publish/page.tsx`
- Modify: `src/app/trainer/programs/[id]/publish/_content.tsx`

backHref = `/trainer/programs/${id}/review` from route param `id`.

- [ ] **Step 1: Update `src/app/trainer/programs/[id]/publish/page.tsx`**

```typescript
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import PublishProgramContent from './_content'

interface PublishProgramPageProps {
    params: Promise<{ id: string }>
}

export default async function PublishProgramPage({ params }: PublishProgramPageProps) {
    const { id } = await params
    const session = await getSession()
    if (!session) redirect('/login')
    if (session.user.role !== 'trainer') redirect(`/${session.user.role}/dashboard`)

    return (
        <DashboardLayout user={session.user} backHref={`/trainer/programs/${id}/review`}>
            <PublishProgramContent />
        </DashboardLayout>
    )
}
```

- [ ] **Step 2: Remove the top-level back button from `src/app/trainer/programs/[id]/publish/_content.tsx`**

a) Remove `ArrowLeft` from lucide-react import (line 5).

b) Remove ONLY the header back button JSX (around lines 268–274 — the `<Link>` inside the `{/* Header */}` div section):
```tsx
// REMOVE this Link only:
<Link
    href={`/trainer/programs/${programId}/review`}
    className="text-brand-primary hover:text-brand-primary/80 mb-4 inline-flex items-center gap-1 text-sm font-semibold"
>
    <ArrowLeft className="h-4 w-4" />
    {t('publish.backToReview')}
</Link>
```

**Keep** the second Link to `/review` inside the validation errors block (around line 293) — it is a contextual action within the publish flow, not the main back button.

- [ ] **Step 3: Type check**

```bash
npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add src/app/trainer/programs/[id]/publish/
git commit -m "refactor: centralize back nav for trainer program publish page"
```

---

### Task 13: Trainer — program tests page (context-aware)

**Files:**
- Modify: `src/app/trainer/programs/[id]/tests/page.tsx`
- Modify: `src/app/trainer/programs/[id]/tests/_content.tsx`

backHref:
- `backContext=dashboard` → `/trainer/dashboard`
- `backContext=trainee&traineeId={id}` → `/trainer/trainees/{id}`
- default → `/trainer/programs`

- [ ] **Step 1: Update `src/app/trainer/programs/[id]/tests/page.tsx`**

```typescript
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import ProgramTestResultsContent from './_content'

interface ProgramTestResultsPageProps {
    searchParams?: Promise<{ backContext?: string; traineeId?: string }>
}

export default async function ProgramTestResultsPage({ searchParams }: ProgramTestResultsPageProps) {
    const resolvedSearchParams = await searchParams
    const session = await getSession()
    if (!session) redirect('/login')
    if (session.user.role !== 'trainer') redirect(`/${session.user.role}/dashboard`)

    const backContext = resolvedSearchParams?.backContext
    const traineeId = resolvedSearchParams?.traineeId
    const backHref = backContext === 'dashboard'
        ? '/trainer/dashboard'
        : backContext === 'trainee' && traineeId
            ? `/trainer/trainees/${traineeId}`
            : '/trainer/programs'

    return (
        <DashboardLayout user={session.user} backHref={backHref}>
            <ProgramTestResultsContent />
        </DashboardLayout>
    )
}
```

- [ ] **Step 2: Remove back button from `src/app/trainer/programs/[id]/tests/_content.tsx`**

a) Remove `ArrowLeft` from lucide-react import (line 7; keep `Plus`).

b) Remove ALL these variables (none are needed for other navigation in this component):
```typescript
// REMOVE all:
const backContext = searchParams.get('backContext')
const traineeId = searchParams.get('traineeId')
const backHref = backContext === 'dashboard'
    ? '/trainer/dashboard'
    : backContext === 'trainee' && traineeId
        ? `/trainer/trainees/${traineeId}`
        : '/trainer/programs'
const backLabel = backContext === 'dashboard'
    ? tNav('breadcrumbs.backToHome')
    : backContext === 'trainee'
        ? t('athletes.backToAthletes')
        : t('programs.backToPrograms')
```

c) If `searchParams` is no longer used in `_content.tsx` after this removal, also remove:
- `const searchParams = useSearchParams()`
- `useSearchParams` from the import

d) Remove back button JSX (around lines 265–269):
```tsx
// REMOVE:
<Link href={backHref} className="...">
    <ArrowLeft className="w-4 h-4" />
    {backLabel}
</Link>
```

- [ ] **Step 3: Type check**

```bash
npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add src/app/trainer/programs/[id]/tests/
git commit -m "refactor: centralize back nav for trainer program tests page"
```

---

### Task 14: i18n cleanup — remove unused back navigation translation keys

**Files:**
- Modify: `public/locales/en/navigation.json`
- Modify: `public/locales/it/navigation.json`
- Modify: `public/locales/en/trainer.json`
- Modify: `public/locales/it/trainer.json`
- Modify: `public/locales/en/trainee.json`
- Modify: `public/locales/it/trainee.json`

- [ ] **Step 1: Verify keys are no longer referenced in source**

Run each grep; expect 0 matches (excluding `public/` itself):

```bash
# navigation namespace breadcrumb back keys
grep -rn "breadcrumbs.backToHome\|breadcrumbs.backToAthleteProfile\|breadcrumbs.backToPrograms\|breadcrumbs.backToLibrary\|breadcrumbs.backToProgram\|breadcrumbs.backToAthletes" src/

# trainee namespace back keys  
grep -rn "history.backToDashboard\|records.backToDashboard\|programs.backToDashboard\|workouts.backToProgram" src/

# trainer namespace back keys
grep -rn "athletes.backToAthletes\|exercises.backToLibrary\|editProgram.backToPrograms\|breadcrumbs.backToHome" src/
```

`breadcrumbs.backToWeeks` is intentionally **not** in this list — it is still used in `trainer/programs/[id]/workouts/[wId]/_content.tsx` as inline navigation within the workout editor.

`publish.backToReview` is intentionally **not** in this list — it is still used in the validation error section of `publish/_content.tsx`.

`reviewProgram.backToEdit` is intentionally **not** in this list — it is still used for the bottom workflow buttons in `review/_content.tsx`.

- [ ] **Step 2: Remove from `navigation.json` (en and it)**

From `public/locales/en/navigation.json` and `public/locales/it/navigation.json`, remove from the `breadcrumbs` object (only if grep from Step 1 confirmed 0 matches):
- `"backToLibrary"`
- `"backToAthletes"`
- `"backToAthleteProfile"`
- `"backToPrograms"`
- `"backToProgram"`
- `"backToHome"`

If `breadcrumbs` becomes empty after cleanup, remove the entire `breadcrumbs` key. If any key still has usages, leave it.

- [ ] **Step 3: Remove from `trainer.json` (en and it)**

From `public/locales/en/trainer.json` and `public/locales/it/trainer.json`, remove confirmed-unused keys:
- `exercises.backToLibrary`
- `athletes.backToAthletes`
- Both occurrences of `programs.backToPrograms` (check both `programs` and any other section)
- `editProgram.backToPrograms`

- [ ] **Step 4: Remove from `trainee.json` (en and it)**

From `public/locales/en/trainee.json` and `public/locales/it/trainee.json`, remove confirmed-unused keys:
- `history.backToDashboard`
- `records.backToDashboard`
- All `backToDashboard` keys within `programs` section
- `workouts.backToProgram`

- [ ] **Step 5: Run build to verify no missing i18n keys**

```bash
npm run build
```
Expected: Build succeeds with no i18n-related warnings or missing key errors.

- [ ] **Step 6: Commit**

```bash
git add public/locales/
git commit -m "chore: remove unused back navigation i18n keys"
```

---

### Task 15: Final verification and CHANGELOG

- [ ] **Step 1: Full type check**

```bash
npm run type-check
```
Expected: 0 errors.

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit
```
Expected: All tests pass (including new DashboardLayout tests).

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: 0 errors.

- [ ] **Step 4: Manual smoke test**

Start dev server (`npm run dev`) and verify in browser (http://localhost:3000):

**Trainer flows:**
- [ ] `/trainer/dashboard` — NO back button in header (correct, no backHref passed)
- [ ] `/trainer/trainees` — back button appears → clicking navigates to `/trainer/dashboard`
- [ ] `/trainer/trainees/new` — back button appears → clicking navigates to `/trainer/trainees`
- [ ] `/trainer/trainees/{id}` — back button appears → clicking navigates to `/trainer/trainees`
- [ ] `/trainer/exercises` — back button appears → `/trainer/dashboard`
- [ ] `/trainer/programs` — back button appears → `/trainer/dashboard`
- [ ] `/trainer/programs/new?traineeId={id}` — back button appears → `/trainer/trainees/{id}`
- [ ] `/trainer/programs/new` (no traineeId) — back button appears → `/trainer/programs`
- [ ] `/trainer/programs/{id}` (view) — back button → `/trainer/programs`
- [ ] `/trainer/programs/{id}/edit?backContext=trainee&traineeId={id}` — back button → `/trainer/trainees/{id}`
- [ ] `/trainer/programs/{id}/edit` (no context) — back button → `/trainer/programs`
- [ ] `/trainer/programs/{id}/review?backContext=trainee&traineeId={id}` — back button → `/trainer/trainees/{id}`
- [ ] `/trainer/programs/{id}/publish` — back button → `/trainer/programs/{id}/review`
- [ ] `/trainer/programs/{id}/tests?backContext=dashboard` — back button → `/trainer/dashboard`

**Trainee flows:**
- [ ] `/trainee/dashboard` — NO back button
- [ ] `/trainee/history` — back button → `/trainee/dashboard`
- [ ] `/trainee/records` — back button → `/trainee/dashboard`
- [ ] `/trainee/programs/current` — back button → `/trainee/dashboard`
- [ ] `/trainee/programs/{id}` — back button → `/trainee/history`
- [ ] `/trainee/workouts/{id}?from=history&programId={programId}` — back button → `/trainee/programs/{programId}`
- [ ] `/trainee/workouts/{id}` (no params) — back button → `/trainee/programs/current`

**Visual:**
- [ ] Back button appears between hamburger menu and logo consistently
- [ ] All page headers no longer have inline back button links
- [ ] Page title/content shifts up to fill reclaimed space

- [ ] **Step 5: Update CHANGELOG**

Add entry to `implementation-docs/CHANGELOG.md`:
```markdown
## 2026-04-24 — Back navigation centralization

Centralized ~16 scattered inline back button implementations into a single `backHref` 
prop on `DashboardLayout`. The header now renders a unified `ArrowLeft` button between 
the hamburger menu and the logo whenever `backHref` is provided by the page. Each 
`page.tsx` computes the appropriate back href from route params and `searchParams`. 
Content components drop their inline back button JSX, freeing vertical space in every 
affected page header. Removed associated unused i18n translation keys across trainer, 
trainee, and navigation locale files.
```

- [ ] **Step 6: Final commit (if CHANGELOG not yet committed)**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: update CHANGELOG for back navigation centralization"
```
