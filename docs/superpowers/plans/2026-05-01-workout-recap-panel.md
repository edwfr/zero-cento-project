# Workout Recap Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ClipboardList` icon button to the workout focus-mode header that opens a Tailwind bottom sheet listing all exercises with their completion status (`not_started` / `in_progress` / `done`) computed via a single SQL aggregation query at the database level.

**Architecture:** A shared helper (`src/lib/workout-recap.ts`) holds the `ExerciseRecapItem` type and the `computeExerciseStatus` pure function. A new API endpoint (`/api/trainee/workouts/[id]/recap`) runs a `$queryRaw` joining `workout_exercises → exercises → exercise_feedbacks → sets_performed` and returns pre-computed statuses — no JS calculations. A new `WorkoutRecapPanel` component (Tailwind bottom-sheet overlay) fetches this endpoint when opened. The existing `_content.tsx` header is extended with the icon button and panel state.

**Tech Stack:** Next.js 15 App Router, Prisma `$queryRaw`, Tailwind CSS, lucide-react, react-i18next

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/lib/workout-recap.ts` |
| Create | `src/app/api/trainee/workouts/[id]/recap/route.ts` |
| Create | `src/components/WorkoutRecapPanel.tsx` |
| Modify | `src/components/index.ts` |
| Modify | `src/app/trainee/workouts/[id]/_content.tsx` |
| Modify | `public/locales/en/trainee.json` |
| Modify | `public/locales/it/trainee.json` |
| Create | `tests/unit/workout-recap.test.ts` |

---

### Task 1: Shared Helper and Unit Test

**Files:**
- Create: `src/lib/workout-recap.ts`
- Create: `tests/unit/workout-recap.test.ts`

Status rules:
- `not_started`: no `sets_performed` rows at all
- `done`: `SUM(completed=true) >= targetSets`
- `in_progress`: at least one row exists but `SUM(completed=true) < targetSets`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/workout-recap.test.ts
import { describe, it, expect } from 'vitest'
import { computeExerciseStatus } from '@/lib/workout-recap'

describe('computeExerciseStatus', () => {
  it('returns not_started when no sets performed', () => {
    expect(computeExerciseStatus(0, 0, 4)).toBe('not_started')
  })

  it('returns done when completedSets equals targetSets', () => {
    expect(computeExerciseStatus(4, 4, 4)).toBe('done')
  })

  it('returns done when completedSets exceeds targetSets', () => {
    expect(computeExerciseStatus(5, 5, 4)).toBe('done')
  })

  it('returns in_progress when some sets are completed', () => {
    expect(computeExerciseStatus(3, 2, 4)).toBe('in_progress')
  })

  it('returns in_progress when sets performed but none completed', () => {
    expect(computeExerciseStatus(2, 0, 4)).toBe('in_progress')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/workout-recap.test.ts
```
Expected: FAIL — `computeExerciseStatus is not exported from '@/lib/workout-recap'`

- [ ] **Step 3: Create the shared helper**

```typescript
// src/lib/workout-recap.ts

export type ExerciseStatus = 'not_started' | 'in_progress' | 'done'

export interface ExerciseRecapItem {
  id: string
  exerciseName: string
  order: number
  targetSets: number
  completedSets: number
  status: ExerciseStatus
}

export function computeExerciseStatus(
  totalSetsPerformed: number,
  completedSets: number,
  targetSets: number
): ExerciseStatus {
  if (totalSetsPerformed === 0) return 'not_started'
  if (completedSets >= targetSets) return 'done'
  return 'in_progress'
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/workout-recap.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/workout-recap.ts tests/unit/workout-recap.test.ts
git commit -m "feat: add workout-recap helper and unit tests"
```

---

### Task 2: API Endpoint — Recap Route

**Files:**
- Create: `src/app/api/trainee/workouts/[id]/recap/route.ts`

The SQL joins `workout_exercises → exercises` (for name), then LEFT JOINs `exercise_feedbacks → sets_performed` to aggregate per exercise. `COUNT(sp.id)` = total rows performed; `SUM(CASE WHEN sp.completed THEN 1 ELSE 0 END)` = completed count. Both cast to `::int` so PostgreSQL doesn't return BigInt. Auth follows the same pattern as `src/app/api/trainee/workouts/[id]/route.ts`: `requireRole` throws a `Response` on failure; the catch block re-returns it.

Column names in raw SQL must match the Prisma `@@map` values:
- `workout_exercises."workoutId"` (camelCase column, snake_case table)
- `workout_exercises."exerciseId"`
- `exercise_feedbacks."workoutExerciseId"`
- `sets_performed."feedbackId"`

- [ ] **Step 1: Create the recap route**

```typescript
// src/app/api/trainee/workouts/[id]/recap/route.ts
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { computeExerciseStatus } from '@/lib/workout-recap'
import type { ExerciseRecapItem } from '@/lib/workout-recap'

interface RecapRow {
  id: string
  exerciseName: string
  order: number
  targetSets: number
  completedSets: number
  totalSetsPerformed: number
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workoutId } = await params

  try {
    const session = await requireRole(['trainee'])

    // Verify ownership via relation chain
    const workout = await prisma.workout.findFirst({
      where: {
        id: workoutId,
        week: { program: { traineeId: session.user.id } },
      },
      select: { id: true },
    })

    if (!workout) {
      return apiError('NOT_FOUND', 'Workout not found', 404, undefined, 'workout.notFound')
    }

    const rows = await prisma.$queryRaw<RecapRow[]>`
      SELECT
        we.id,
        e.name                                                          AS "exerciseName",
        we.order                                                        AS "order",
        we.sets                                                         AS "targetSets",
        COALESCE(SUM(CASE WHEN sp.completed THEN 1 ELSE 0 END), 0)::int AS "completedSets",
        COUNT(sp.id)::int                                               AS "totalSetsPerformed"
      FROM workout_exercises we
      JOIN exercises e ON e.id = we."exerciseId"
      LEFT JOIN exercise_feedbacks ef ON ef."workoutExerciseId" = we.id
      LEFT JOIN sets_performed sp ON sp."feedbackId" = ef.id
      WHERE we."workoutId" = ${workoutId}::uuid
      GROUP BY we.id, e.name, we.order, we.sets
      ORDER BY we.order
    `

    const exercises: ExerciseRecapItem[] = rows.map((row) => ({
      id: row.id,
      exerciseName: row.exerciseName,
      order: row.order,
      targetSets: row.targetSets,
      completedSets: row.completedSets,
      status: computeExerciseStatus(row.totalSetsPerformed, row.completedSets, row.targetSets),
    }))

    return apiSuccess({ exercises })
  } catch (error: unknown) {
    if (error instanceof Response) return error
    logger.error({ error, workoutId }, 'Error fetching workout recap')
    return apiError('INTERNAL_ERROR', 'Failed to fetch workout recap', 500, undefined, 'internal.default')
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/trainee/workouts/[id]/recap/route.ts
git commit -m "feat: add GET /api/trainee/workouts/[id]/recap with DB-level status aggregation"
```

---

### Task 3: i18n Keys

**Files:**
- Modify: `public/locales/en/trainee.json`
- Modify: `public/locales/it/trainee.json`

- [ ] **Step 1: Add keys to English locale**

In `public/locales/en/trainee.json`, find the `"workouts"` closing `}` at line 223 (just before `"records"`). Add the new keys before line 223, after the last key `"programCompletedToast"`:

```json
        "recapTitle": "Exercise Recap",
        "recapClose": "Close",
        "recapStatusDone": "Done",
        "recapStatusInProgress": "In progress",
        "recapStatusNotStarted": "Not started",
        "recapSets": "{{completed}}/{{target}} sets",
        "recapLoading": "Loading recap...",
        "recapError": "Failed to load recap"
```

- [ ] **Step 2: Add keys to Italian locale**

In `public/locales/it/trainee.json`, same position (after `"programCompletedToast"`, before the `workouts` closing `}`):

```json
        "recapTitle": "Riepilogo esercizi",
        "recapClose": "Chiudi",
        "recapStatusDone": "Completato",
        "recapStatusInProgress": "In corso",
        "recapStatusNotStarted": "Da iniziare",
        "recapSets": "{{completed}}/{{target}} serie",
        "recapLoading": "Caricamento riepilogo...",
        "recapError": "Errore nel caricamento del riepilogo"
```

- [ ] **Step 3: Commit**

```bash
git add public/locales/en/trainee.json public/locales/it/trainee.json
git commit -m "feat: add workout recap i18n keys (en + it)"
```

---

### Task 4: WorkoutRecapPanel Component

**Files:**
- Create: `src/components/WorkoutRecapPanel.tsx`
- Modify: `src/components/index.ts`

The panel is a fixed bottom sheet with a dark backdrop. It fetches the recap endpoint when `isOpen` flips to `true`. Cleanup: if the panel closes before the fetch resolves, the `cancelled` flag prevents stale state updates. Status icons use lucide-react: `CheckCircle2` (green, done), `Clock` (amber, in_progress), `Circle` (gray, not_started).

- [ ] **Step 1: Create the component**

```tsx
// src/components/WorkoutRecapPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2, Circle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ExerciseRecapItem, ExerciseStatus } from '@/lib/workout-recap'

interface WorkoutRecapPanelProps {
  workoutId: string
  isOpen: boolean
  onClose: () => void
}

export default function WorkoutRecapPanel({ workoutId, isOpen, onClose }: WorkoutRecapPanelProps) {
  const { t } = useTranslation('trainee')
  const [exercises, setExercises] = useState<ExerciseRecapItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/trainee/workouts/${workoutId}/recap`)
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error?.message ?? t('workouts.recapError'))
        if (!cancelled) setExercises(data.data.exercises)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t('workouts.recapError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [isOpen, workoutId, t])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-label={t('workouts.recapTitle')}
        className="fixed bottom-0 left-0 right-0 z-40 flex max-h-[80vh] flex-col rounded-t-2xl bg-white shadow-xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-bold text-gray-900">
            {t('workouts.recapTitle')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('workouts.recapClose')}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && (
            <p className="py-8 text-center text-sm text-gray-500">
              {t('workouts.recapLoading')}
            </p>
          )}
          {error && (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          )}
          {!loading && !error && (
            <ul className="space-y-0">
              {exercises.map((ex) => (
                <li
                  key={ex.id}
                  className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0"
                >
                  <StatusIcon status={ex.status} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                    {ex.exerciseName}
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-gray-400">
                    {t('workouts.recapSets', {
                      completed: ex.completedSets,
                      target: ex.targetSets,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

function StatusIcon({ status }: { status: ExerciseStatus }) {
  if (status === 'done') {
    return <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
  }
  if (status === 'in_progress') {
    return <Clock className="h-5 w-5 shrink-0 text-amber-500" />
  }
  return <Circle className="h-5 w-5 shrink-0 text-gray-300" />
}
```

- [ ] **Step 2: Export from components index**

Open `src/components/index.ts`. Add at the end of the barrel exports:

```typescript
export { default as WorkoutRecapPanel } from './WorkoutRecapPanel'
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/WorkoutRecapPanel.tsx src/components/index.ts
git commit -m "feat: add WorkoutRecapPanel bottom sheet component"
```

---

### Task 5: Wire Icon Button into Focus-Mode Header

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx`

The icon goes in the existing sticky header nav (`data-testid="focus-mode-header"`), in the right-side `flex items-center gap-2` div, between `<WeekTypeBadge>` and the progress `<span>`. The panel is rendered as a sibling of the swipeable page body — placed as the last child of the root `flex min-h-screen` div.

- [ ] **Step 1: Add `ClipboardList` to lucide-react import**

Locate the lucide-react import block (lines 10–21 in `_content.tsx`):

```typescript
import {
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronUp,
    Clock3,
    FileText,
    Gauge,
    PlayCircle,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
```

Replace with:

```typescript
import {
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    Clock3,
    FileText,
    Gauge,
    PlayCircle,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
```

- [ ] **Step 2: Add WorkoutRecapPanel import**

After the existing component imports (after the line `import { Input } from '@/components/Input'`), add:

```typescript
import WorkoutRecapPanel from '@/components/WorkoutRecapPanel'
```

- [ ] **Step 3: Add recapOpen state**

Inside `WorkoutDetailContent`, after the existing state declarations block (the last `useState` is around line 163), add:

```typescript
const [recapOpen, setRecapOpen] = useState(false)
```

- [ ] **Step 4: Add icon button to header**

Locate the right-side div in the sticky header (around lines 649–661 in `_content.tsx`):

```tsx
<div className="flex items-center gap-2">
    <WeekTypeBadge
        weekType={workout.weekType}
        labels={{
            normal: t('weekType.normal'),
            test: t('weekType.test'),
            deload: t('weekType.deload'),
        }}
    />
    <span className="text-xs text-gray-400 font-semibold tabular-nums w-9 text-right">
        {workoutProgressPercent}%
    </span>
</div>
```

Replace with:

```tsx
<div className="flex items-center gap-2">
    <WeekTypeBadge
        weekType={workout.weekType}
        labels={{
            normal: t('weekType.normal'),
            test: t('weekType.test'),
            deload: t('weekType.deload'),
        }}
    />
    <button
        onClick={() => setRecapOpen(true)}
        aria-label={t('workouts.recapTitle')}
        className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
    >
        <ClipboardList className="h-5 w-5" />
    </button>
    <span className="text-xs text-gray-400 font-semibold tabular-nums w-9 text-right">
        {workoutProgressPercent}%
    </span>
</div>
```

- [ ] **Step 5: Render the panel**

Locate the closing `</div>` of the outer root element (`<div className="flex min-h-screen flex-col bg-gray-50"...>`). Add `<WorkoutRecapPanel>` just before that closing tag, after the sticky bottom nav `</nav>`:

```tsx
            <WorkoutRecapPanel
                workoutId={workoutId}
                isOpen={recapOpen}
                onClose={() => setRecapOpen(false)}
            />
        </div>
    )
```

- [ ] **Step 6: Type-check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 7: Lint**

```bash
npm run lint
```
Expected: no errors or warnings

- [ ] **Step 8: Run unit tests**

```bash
npm run test:unit
```
Expected: all tests pass including the new `workout-recap.test.ts`

- [ ] **Step 9: Commit**

```bash
git add src/app/trainee/workouts/[id]/_content.tsx
git commit -m "feat: wire recap panel icon button into workout focus-mode header"
```

---

## Self-Review

**Spec coverage:**
- ✅ Icon in header card → `ClipboardList` button added to sticky nav
- ✅ Opens a panel → bottom sheet rendered via `WorkoutRecapPanel`
- ✅ Recap list of exercises → endpoint returns all `workout_exercises` ordered by `order`
- ✅ Status flag per exercise → `computeExerciseStatus` applied to DB aggregates
- ✅ Done = all sets completed → `SUM(completed) >= targetSets`
- ✅ Not started = no sets with feedback → `COUNT(sp.id) = 0`
- ✅ In progress = at least one set done → `COUNT > 0 AND SUM(completed) < targetSets`
- ✅ Calculated at DB level → `$queryRaw` SQL aggregation, no frontend math
- ✅ Uses `sets_performed` table → explicit in SQL JOIN

**Placeholder scan:** No TBDs, no "fill in later", all code blocks complete.

**Type consistency:**
- `ExerciseStatus` and `ExerciseRecapItem` defined once in `src/lib/workout-recap.ts`, imported by route, panel, and test
- `computeExerciseStatus(totalSetsPerformed, completedSets, targetSets)` signature consistent across definition and test
- `recapSets` i18n key uses `{{completed}}` and `{{target}}` — matches `t('workouts.recapSets', { completed: ex.completedSets, target: ex.targetSets })` in panel
