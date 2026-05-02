# Trainee History Page Graphical Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `/trainee/history` page so it matches the visual language already established on `/trainee/dashboard` (rounded-2xl cards, brand-primary accents, lucide icons, progress bar for active programs, stats on top).

**Architecture:** Pure frontend refactor of `src/app/trainee/history/_content.tsx`. Reuse existing components (`StatCard`, `ProgressBar`) instead of bespoke divs. Fetch per-program progress on-demand for the active program only (1 extra request, optional). Update `public/locales/{en,it}/trainee.json` to drop the emoji from `history.title` and add new translation keys.

**Tech Stack:** Next.js 15 App Router, React 18 client component, Tailwind, react-i18next, lucide-react, TanStack `fetch` (vanilla, no SWR/Query in this file currently).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/app/trainee/history/_content.tsx` | Modify | Full UI rewrite — stats on top, refactored card, lucide icons, status accents, active progress bar |
| `public/locales/it/trainee.json` | Modify | Remove emoji from `history.title`, add new keys (`statsHeading`, `programsHeading`, `progressLabel`, etc.) |
| `public/locales/en/trainee.json` | Modify | Same as above for English |
| `implementation-docs/CHANGELOG.md` | Modify | Append entry per project workflow rule |

No new components are created — `StatCard`, `ProgressBar`, `Card` already exist in `src/components/`.

---

## Visual Spec (current vs target)

**Current issues identified:**
1. Title contains emoji (`"📊 Storico Programmi"`) — incoherent with dashboard which uses lucide icons.
2. Stats summary is at the **bottom** of the page — should be top for hierarchy.
3. Card grid is `grid-cols-2 md:grid-cols-4` with **5 cells** (Status, Start, End, Duration, Workouts/week) — Status is **duplicated** with the badge in the header, and the 5th cell is orphaned.
4. All cards look identical regardless of status — active programs do not stand out.
5. No progress bar for the active program (dashboard has one — inconsistent).
6. Plain text metadata — no lucide icons inline.
7. Hint paragraphs (`activeProgramHint`, `completedProgramHint`) are unstyled `<p>` at the bottom of each card.
8. `rounded-lg` cards vs `rounded-2xl` on dashboard — visual incoherence.
9. Empty state uses `rounded-lg` and basic ClipboardList — could match the brand-primary accent style of the dashboard's "no active program" empty state.

**Target:**
- Title: plain text, no emoji.
- Stats: 3 `StatCard`s at the top (`Total`, `Completed`, `Active`).
- Each program card: `rounded-2xl border border-gray-200 shadow-md` matching dashboard. Status-driven left border accent: brand-primary for active, emerald-500 for completed, gray-300 for draft.
- Header row: title + status badge (no duplicate "Status" cell).
- Metadata row: 4 cells (`Start | End | Duration | Workouts/week`) with lucide icons (`Calendar`, `CalendarCheck`, `Clock`, `Dumbbell`) above the labels.
- Active program card: `ProgressBar` showing `completedWorkouts / totalWorkouts` (one extra fetch to `/api/programs/{id}/progress`).
- Single hint paragraph styled with subtle bg (`bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-600`) — replaces the bare `<p>`.
- View details button stays — but standardized to match dashboard button (`border border-brand-primary text-brand-primary hover:bg-[#FFF7E5]`).
- Empty state: bigger illustration container, brand-primary accent, button styled like dashboard.

---

## Task 1: Update i18n strings — drop emoji, add new keys

**Files:**
- Modify: `public/locales/it/trainee.json` (the `history` block)
- Modify: `public/locales/en/trainee.json` (the `history` block)

- [ ] **Step 1: Edit `public/locales/it/trainee.json` — replace the `history` block**

Open the file and locate the `"history": { ... }` block. Replace **only** the `title` value and append the new keys at the end of the block (before the closing `}`). The full updated block:

```json
"history": {
    "title": "Storico Programmi",
    "description": "Consulta lo storico dei tuoi programmi con stato, data di inizio e data di fine quando disponibile",
    "loadingError": "Errore caricamento storico",
    "noPrograms": "Nessun Programma",
    "noProgramsDesc": "Quando il trainer pubblicherà un programma lo troverai qui con stato e date.",
    "goToDashboard": "Vai alla Dashboard",
    "status": "Stato",
    "active": "Attivo",
    "draft": "Bozza",
    "completed": "Completato",
    "trainerWith": "con {{firstName}} {{lastName}}",
    "startDate": "Data Inizio",
    "endDate": "Data Fine",
    "duration": "Durata",
    "weeks": "{{count}} settimane",
    "workoutsPerWeek": "Workout / settimana",
    "completedOn": "Completato il {{date}}",
    "completedProgramHint": "Tutti i workout risultano completati, in attesa della chiusura definitiva del programma.",
    "activeProgramHint": "Programma attualmente in corso.",
    "draftProgramHint": "Programma creato ma non ancora pubblicato.",
    "viewProgramDetails": "Vai ai dettagli del programma",
    "viewActiveProgram": "Vai al programma attivo",
    "statsTotalPrograms": "Programmi Totali",
    "statsCompleted": "Programmi Completati",
    "statsActive": "Programmi Attivi",
    "statsHeading": "Riepilogo",
    "programsHeading": "I tuoi programmi",
    "progressLabel": "Progresso",
    "workoutsLabel": "Workout",
    "noEndDate": "—"
}
```

- [ ] **Step 2: Edit `public/locales/en/trainee.json` — replace the `history` block**

```json
"history": {
    "title": "Programs History",
    "description": "Browse your programs with status, start date and end date when available",
    "loadingError": "Failed to load history",
    "noPrograms": "No Programs",
    "noProgramsDesc": "When your trainer publishes a program you'll find it here with status and dates.",
    "goToDashboard": "Go to Dashboard",
    "status": "Status",
    "active": "Active",
    "draft": "Draft",
    "completed": "Completed",
    "trainerWith": "with {{firstName}} {{lastName}}",
    "startDate": "Start Date",
    "endDate": "End Date",
    "duration": "Duration",
    "weeks": "{{count}} weeks",
    "workoutsPerWeek": "Workouts / week",
    "completedOn": "Completed on {{date}}",
    "completedProgramHint": "All workouts are completed, awaiting final program closure.",
    "activeProgramHint": "Program currently in progress.",
    "draftProgramHint": "Program created but not yet published.",
    "viewProgramDetails": "View program details",
    "viewActiveProgram": "Go to active program",
    "statsTotalPrograms": "Total Programs",
    "statsCompleted": "Completed Programs",
    "statsActive": "Active Programs",
    "statsHeading": "Summary",
    "programsHeading": "Your programs",
    "progressLabel": "Progress",
    "workoutsLabel": "Workouts",
    "noEndDate": "—"
}
```

Verify the surrounding `currentProgram`/other top-level keys are untouched.

- [ ] **Step 3: Run type-check to ensure JSON is still valid**

```bash
npm run type-check
```

Expected: PASS (no TS errors). If JSON is malformed, Next.js would also fail to import — typecheck won't directly catch that, so also run:

```bash
node -e "JSON.parse(require('fs').readFileSync('public/locales/it/trainee.json','utf8')); JSON.parse(require('fs').readFileSync('public/locales/en/trainee.json','utf8')); console.log('ok')"
```

Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add public/locales/it/trainee.json public/locales/en/trainee.json
git commit -m "$(cat <<'EOF'
chore(i18n): refresh trainee history strings — drop emoji from title, add layout keys

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Restructure layout — stats on top, programs section below

**Files:**
- Modify: `src/app/trainee/history/_content.tsx` (full rewrite)

This task does **not** yet introduce per-program progress fetching — that is Task 3. It focuses on layout reorder, StatCard usage, header refresh.

- [ ] **Step 1: Replace the imports block**

Find (top of file):

```tsx
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { SkeletonList } from '@/components'
import { ClipboardList } from 'lucide-react'
import { formatDate } from '@/lib/date-format'
```

Replace with:

```tsx
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { SkeletonList, StatCard, ProgressBar } from '@/components'
import {
    ClipboardList,
    Calendar,
    CalendarCheck,
    Clock,
    Dumbbell,
    Trophy,
    Activity,
    FolderOpen,
    ChevronRight,
} from 'lucide-react'
import { formatDate } from '@/lib/date-format'
```

- [ ] **Step 2: Replace the `if (loading)` and `if (error)` early returns**

Find:

```tsx
if (loading) {
    return (
        <div className="py-8">
            <SkeletonList items={5} />
        </div>
    )
}

if (error) {
    return (
        <div className="flex items-center justify-center py-16">
            <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                {error}
            </div>
        </div>
    )
}
```

Replace with (only outer container restyled to align with the new max-width and padding):

```tsx
if (loading) {
    return (
        <div className="max-w-6xl mx-auto py-8">
            <SkeletonList items={5} />
        </div>
    )
}

if (error) {
    return (
        <div className="max-w-6xl mx-auto py-8">
            <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-2xl">
                {error}
            </div>
        </div>
    )
}
```

- [ ] **Step 3: Replace the `return (...)` JSX (everything from `return (` to the matching closing `)` at the bottom of the function)**

Replace the entire return block with:

```tsx
return (
    <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{t('history.title')}</h1>
            <p className="text-gray-600 mt-2">
                {t('history.description')}
            </p>
        </div>

        {programs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-12 text-center">
                <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-primary/10">
                    <ClipboardList className="w-10 h-10 text-brand-primary" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    {t('history.noPrograms')}
                </h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    {t('history.noProgramsDesc')}
                </p>
                <Link
                    href="/trainee/dashboard"
                    className="inline-flex items-center gap-2 border border-brand-primary text-brand-primary hover:bg-[#FFF7E5] font-semibold px-6 py-3 rounded-lg transition-colors"
                >
                    {t('history.goToDashboard')}
                    <ChevronRight className="w-4 h-4" />
                </Link>
            </div>
        ) : (
            <>
                {/* Stats Summary - top */}
                <div className="mb-8">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500 mb-3">
                        {t('history.statsHeading')}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard
                            title={t('history.statsTotalPrograms')}
                            value={programs.length}
                            icon={<FolderOpen className="w-6 h-6" />}
                            color="primary"
                        />
                        <StatCard
                            title={t('history.statsActive')}
                            value={activePrograms}
                            icon={<Activity className="w-6 h-6" />}
                            color="info"
                        />
                        <StatCard
                            title={t('history.statsCompleted')}
                            value={completedPrograms}
                            icon={<Trophy className="w-6 h-6" />}
                            color="success"
                        />
                    </div>
                </div>

                {/* Programs list */}
                <div className="mb-4">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500">
                        {t('history.programsHeading')}
                    </h2>
                </div>
                <div className="space-y-4">
                    {programs
                        .sort((a, b) => getProgramSortTime(b) - getProgramSortTime(a))
                        .map((program) => {
                            const programStatus = program.status
                            const endDate = getProgramEndDate(program)
                            const accentClass = getStatusAccentClass(programStatus)
                            const hintText = getStatusHintText(program, endDate)

                            return (
                                <div
                                    key={program.id}
                                    className={`bg-white border border-gray-200 rounded-2xl shadow-md hover:shadow-lg transition-shadow border-l-4 ${accentClass}`}
                                >
                                    <div className="p-6">
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-3 mb-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                                    <h3 className="text-2xl font-bold text-gray-900 break-words">
                                                        {program.title}
                                                    </h3>
                                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getStatusBadgeClasses(programStatus)}`}>
                                                        {getStatusLabel(programStatus)}
                                                    </span>
                                                </div>
                                                <p className="text-gray-600 text-sm">
                                                    {t('history.trainerWith', { firstName: program.trainer.firstName, lastName: program.trainer.lastName })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Metadata grid: 2 cols mobile, 4 cols desktop */}
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                            <MetaCell
                                                icon={<Calendar className="w-4 h-4" />}
                                                label={t('history.startDate')}
                                                value={formatDate(program.startDate)}
                                            />
                                            <MetaCell
                                                icon={<CalendarCheck className="w-4 h-4" />}
                                                label={t('history.endDate')}
                                                value={endDate ? formatDate(endDate) : t('history.noEndDate')}
                                            />
                                            <MetaCell
                                                icon={<Clock className="w-4 h-4" />}
                                                label={t('history.duration')}
                                                value={t('history.weeks', { count: program.durationWeeks })}
                                            />
                                            <MetaCell
                                                icon={<Dumbbell className="w-4 h-4" />}
                                                label={t('history.workoutsPerWeek')}
                                                value={String(program.workoutsPerWeek)}
                                            />
                                        </div>

                                        {/* Hint */}
                                        {hintText && (
                                            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-600 mb-4">
                                                {hintText}
                                            </div>
                                        )}

                                        {/* Action */}
                                        <div>
                                            <Link
                                                href={`/trainee/programs/${program.id}`}
                                                className="inline-flex items-center gap-2 border border-brand-primary text-brand-primary hover:bg-[#FFF7E5] font-semibold px-4 py-2 rounded-lg transition-colors"
                                            >
                                                {t('history.viewProgramDetails')}
                                                <ChevronRight className="w-4 h-4" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                </div>
            </>
        )}
    </div>
)
```

- [ ] **Step 4: Add helper functions and `MetaCell` subcomponent inside the same file (above the `export default function HistoryContent`)**

Right after the `getProgramSortTime` constant, add:

```tsx
const getStatusAccentClass = (status: ProgramStatus): string => {
    switch (status) {
        case 'active':
            return 'border-l-brand-primary'
        case 'completed':
            return 'border-l-emerald-500'
        default:
            return 'border-l-gray-300'
    }
}

interface MetaCellProps {
    icon: React.ReactNode
    label: string
    value: string
}

function MetaCell({ icon, label, value }: MetaCellProps) {
    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                {icon}
                <span className="text-xs uppercase tracking-wide">{label}</span>
            </div>
            <p className="font-semibold text-gray-900 text-sm">{value}</p>
        </div>
    )
}
```

- [ ] **Step 5: Add `getStatusHintText` helper inside the `HistoryContent` function (so it can use the `t` function from the closure)**

Right after the existing `getStatusLabel` function inside the component, add:

```tsx
const getStatusHintText = (program: Program, endDate: string | null): string | null => {
    switch (program.status) {
        case 'completed':
            return endDate
                ? t('history.completedOn', { date: formatDate(endDate) })
                : t('history.completedProgramHint')
        case 'active':
            return t('history.activeProgramHint')
        case 'draft':
            return t('history.draftProgramHint')
        default:
            return null
    }
}
```

- [ ] **Step 6: Run type-check**

```bash
npm run type-check
```

Expected: PASS. If you see errors about `React` not being imported for `React.ReactNode`, change `React.ReactNode` to `import { ReactNode } from 'react'` and use `ReactNode` directly.

- [ ] **Step 7: Run lint**

```bash
npm run lint
```

Expected: PASS (no warnings or errors in modified files).

- [ ] **Step 8: Visual verification — start dev server and check the page**

```bash
npm run dev
```

Open `http://localhost:3000/trainee/history` (after logging in as a trainee). Verify:
- Title is plain text, no emoji.
- Stats (3 cards) are at the **top**, before the program list.
- Each card has a colored left border (orange for active, emerald for completed, gray for draft).
- Metadata cells show lucide icons inline.
- Hint text is in a subtle gray box, not bare paragraph.
- Mobile (resize to <640px): stats stack vertically, program metadata stacks 2 cols.
- Empty state (try a trainee with no programs) shows the brand-primary circular icon.

- [ ] **Step 9: Commit**

```bash
git add src/app/trainee/history/_content.tsx
git commit -m "$(cat <<'EOF'
feat(trainee/history): restyle page — stats on top, status accents, lucide icons

Move stats summary above the program list, switch cards to rounded-2xl with
status-driven left border accent (active/completed/draft), replace bare
metadata cells with iconed MetaCell subcomponent, restyle empty state and
hint paragraphs to match the dashboard visual language.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add progress bar for the active program

**Files:**
- Modify: `src/app/trainee/history/_content.tsx`

The active program card should display a progress bar (`completedWorkouts / totalWorkouts`) like the dashboard does. The dashboard already calls `/api/programs/{id}/progress` — reuse the same endpoint.

There may be **at most one** active program per trainee (business rule — verify by inspecting `useEffect` of the dashboard if uncertain), so we issue a single follow-up fetch only when one is present.

- [ ] **Step 1: Add the progress state to the component**

In `HistoryContent`, right after the existing `useState` declarations, add:

```tsx
const [activeProgramProgress, setActiveProgramProgress] = useState<{
    programId: string
    completed: number
    total: number
} | null>(null)
```

- [ ] **Step 2: Extend `fetchHistory` to also fetch progress for the active program**

Replace the existing `fetchHistory` `useCallback`:

```tsx
const fetchHistory = useCallback(async () => {
    try {
        setLoading(true)

        const res = await fetch('/api/programs?limit=100')
        const data = await res.json()

        if (!res.ok) {
            throw new Error(getApiErrorMessage(data, t('history.loadingError'), t))
        }

        const publishedPrograms = (data.data.items ?? []).filter(isPublishedProgram) as Program[]
        setPrograms(publishedPrograms)
    } catch (err: unknown) {
        setError((err as Error).message)
    } finally {
        setLoading(false)
    }
}, [t])
```

with:

```tsx
const fetchHistory = useCallback(async () => {
    try {
        setLoading(true)

        const res = await fetch('/api/programs?limit=100')
        const data = await res.json()

        if (!res.ok) {
            throw new Error(getApiErrorMessage(data, t('history.loadingError'), t))
        }

        const publishedPrograms = (data.data.items ?? []).filter(isPublishedProgram) as Program[]
        setPrograms(publishedPrograms)

        const active = publishedPrograms.find((program) => program.status === 'active')
        if (active) {
            try {
                const progressRes = await fetch(`/api/programs/${active.id}/progress`)
                const progressData = await progressRes.json()
                if (progressRes.ok) {
                    setActiveProgramProgress({
                        programId: active.id,
                        completed: progressData.data.completedWorkouts ?? 0,
                        total: progressData.data.totalWorkouts ?? 0,
                    })
                }
            } catch {
                // Progress fetch failure is non-fatal; the card simply won't render the bar.
            }
        } else {
            setActiveProgramProgress(null)
        }
    } catch (err: unknown) {
        setError((err as Error).message)
    } finally {
        setLoading(false)
    }
}, [t])
```

The inner `try/catch` around the progress fetch is intentional: if the progress endpoint is temporarily unavailable, we still want the history list to render. This is the only case where we swallow an error — it's a progressive enhancement, not load-bearing data.

- [ ] **Step 3: Render the `ProgressBar` inside the active program card**

In the JSX from Task 2 Step 3, find the `{/* Hint */}` block:

```tsx
{/* Hint */}
{hintText && (
    <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-600 mb-4">
        {hintText}
    </div>
)}
```

Insert **above** that block:

```tsx
{/* Progress (active programs only) */}
{programStatus === 'active' && activeProgramProgress?.programId === program.id && activeProgramProgress.total > 0 && (
    <div className="mb-4">
        <ProgressBar
            current={activeProgramProgress.completed}
            total={activeProgramProgress.total}
            label={t('history.progressLabel')}
            size="md"
            color="primary"
        />
    </div>
)}
```

- [ ] **Step 4: Run type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: PASS.

- [ ] **Step 5: Visual verification**

Reload `/trainee/history`. With a trainee who has an active program with at least one completed workout:
- The active card displays a `ProgressBar` above the hint, showing `Progresso` label, percentage, and `n / m` count.
- Other cards (completed/draft) do **not** render the bar.
- Confirm the progress matches what `/trainee/dashboard` shows for the same program.

- [ ] **Step 6: Commit**

```bash
git add src/app/trainee/history/_content.tsx
git commit -m "$(cat <<'EOF'
feat(trainee/history): show progress bar for the active program

Fetch /api/programs/{id}/progress for the single active program after the
list loads, then render a ProgressBar inside the active card to mirror the
dashboard. Failure of the progress fetch is swallowed so the list still
renders.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update CHANGELOG

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

The project's CLAUDE.md states: *"After every modification or new implementation, update implementation-docs/CHANGELOG.md with a brief entry describing what changed and why."*

- [ ] **Step 1: Read current CHANGELOG to match formatting**

```bash
head -40 implementation-docs/CHANGELOG.md
```

Note the heading format and bullet style.

- [ ] **Step 2: Prepend a new entry under the most recent section (or create a new dated section if the convention is per-day)**

Add an entry such as:

```markdown
## 2026-05-02 — Trainee History UI Refresh

- Restyled `/trainee/history` to match `/trainee/dashboard` visual language: stats summary moved to the top, program cards use `rounded-2xl` with status-driven left border accent (orange/emerald/gray), metadata cells now show lucide icons, hints rendered in a subtle bordered box.
- Added a progress bar to the active program card (reuses `/api/programs/{id}/progress`); failures are silent so the list still renders.
- Removed the emoji from `history.title` and added new i18n keys: `statsHeading`, `programsHeading`, `progressLabel`, `workoutsLabel`, `noEndDate` (in both `it` and `en`).
```

(Adapt the headline format if the existing CHANGELOG uses a different convention — e.g. a flat bullet list under a single "Unreleased" heading.)

- [ ] **Step 3: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "$(cat <<'EOF'
docs(changelog): record trainee history UI refresh

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Final verification

- [ ] **Step 1: Re-run full quality gates**

```bash
npm run type-check
npm run lint
```

Expected: both PASS.

- [ ] **Step 2: Build to catch issues that only surface at production-time**

```bash
npm run build
```

Expected: build succeeds. If you see a JSON parse error during the build, recheck the `trainee.json` files.

- [ ] **Step 3: Run unit tests (no test for this file currently exists, but a snapshot/sanity sweep guards against regression elsewhere)**

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 4: Manual UI smoke test on three trainee profiles**

Start `npm run dev` and log in as:
1. A trainee with **no** programs → empty state renders with brand-primary icon and Dashboard link.
2. A trainee with **only completed** programs → stats show `Active = 0`, every card has the emerald accent.
3. A trainee with **one active + several completed** programs → active card on top of the list (sorted by recency), shows the progress bar; completed cards below with emerald accent; status badge present, "Status" cell **not** duplicated.

Resize the browser down to ~375px width and confirm:
- StatCard grid stacks to a single column.
- Metadata cells stack to 2 columns.
- Header/title does not overflow.

- [ ] **Step 5: Final commit (only if there were any post-review fixes)**

If you made no further changes, skip this step. Otherwise:

```bash
git status
git add <changed files>
git commit -m "fix(trainee/history): ..."
```

---

## Self-Review Checklist (already performed by plan author)

1. **Spec coverage:** Every visual issue listed in the "Visual Spec" section maps to a task — (a) emoji removal & layout reorder → Task 2; (b) stats on top → Task 2; (c) duplicated Status cell removed → Task 2 (4-cell metadata only); (d) status accent border → Task 2; (e) iconed metadata → Task 2 (`MetaCell`); (f) progress bar for active → Task 3; (g) i18n keys → Task 1; (h) CHANGELOG → Task 4.
2. **Placeholder scan:** No `TBD`, no "appropriate", no "etc.". Every code block is the literal content to write.
3. **Type consistency:** `MetaCell` props match usage. `ProgramStatus` type is reused from existing code (not redeclared). `activeProgramProgress` shape matches the `ProgressBar` props (`current`/`total`).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-trainee-history-graphical-optimization.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
