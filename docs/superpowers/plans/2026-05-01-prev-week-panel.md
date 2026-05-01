# Previous Week Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "previous week" icon button in the trainee workout header that opens a bottom sheet showing exercises + sets/reps/kg from the same workout one week earlier; hidden on week 1.

**Architecture:** New API route `/api/trainee/workouts/[id]/prev-week` runs a single SQL query (CTE + LATERAL join for most-recent feedback) and returns the previous week's exercise data. A new `PrevWeekPanel` component, styled identically to `WorkoutRecapPanel`, renders the data. The `_content.tsx` adds state and the icon button conditioned on `workout.weekNumber > 1`.

**Tech Stack:** Next.js 15 App Router, Prisma raw SQL (`$queryRaw`), TypeScript, Tailwind, lucide-react, react-i18next, Vitest + Testing Library.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/workout-recap.ts` | Add `PrevWeekSet` and `PrevWeekExerciseItem` types |
| Create | `src/app/api/trainee/workouts/[id]/prev-week/route.ts` | API: find same-day workout from week N-1, return exercises + feedback sets |
| Create | `src/components/PrevWeekPanel.tsx` | Bottom-sheet panel, same pattern as `WorkoutRecapPanel` |
| Modify | `src/components/index.ts` | Export `PrevWeekPanel` |
| Modify | `src/app/trainee/workouts/[id]/_content.tsx` | Add state, icon button (hidden on week 1), mount panel |
| Modify | `public/locales/en/trainee.json` | Add `prevWeek.*` i18n keys |
| Modify | `public/locales/it/trainee.json` | Add `prevWeek.*` i18n keys (Italian) |
| Create | `tests/unit/prev-week-panel.test.tsx` | Unit tests for `PrevWeekPanel` render + fetch behaviour |

---

## Task 1: Add Types to `src/lib/workout-recap.ts`

**Files:**
- Modify: `src/lib/workout-recap.ts`
- Test: `tests/unit/workout-recap.test.ts`

- [ ] **Step 1: Write failing type-level test**

Add to `tests/unit/workout-recap.test.ts`:

```typescript
import type { PrevWeekSet, PrevWeekExerciseItem } from '@/lib/workout-recap'

describe('PrevWeekExerciseItem type', () => {
    it('accepts a valid item with sets', () => {
        const item: PrevWeekExerciseItem = {
            id: 'we-1',
            exerciseName: 'Squat',
            order: 1,
            targetSets: 4,
            targetReps: '8',
            sets: [{ setNumber: 1, reps: 8, weight: 100, completed: true }],
        }
        expect(item.sets).toHaveLength(1)
        expect(item.sets[0].weight).toBe(100)
    })

    it('accepts an item with empty sets (no feedback)', () => {
        const item: PrevWeekExerciseItem = {
            id: 'we-2',
            exerciseName: 'Row',
            order: 2,
            targetSets: 3,
            targetReps: '10',
            sets: [],
        }
        expect(item.sets).toHaveLength(0)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/workout-recap.test.ts
```

Expected: FAIL — `PrevWeekSet` and `PrevWeekExerciseItem` not exported.

- [ ] **Step 3: Add types to `src/lib/workout-recap.ts`**

Append after the existing exports:

```typescript
export interface PrevWeekSet {
    setNumber: number
    reps: number
    weight: number
    completed: boolean
}

export interface PrevWeekExerciseItem {
    id: string
    exerciseName: string
    order: number
    targetSets: number
    targetReps: string
    sets: PrevWeekSet[]
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/workout-recap.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/workout-recap.ts tests/unit/workout-recap.test.ts
git commit -m "feat: add PrevWeekSet and PrevWeekExerciseItem types"
```

---

## Task 2: API Route `/api/trainee/workouts/[id]/prev-week`

**Files:**
- Create: `src/app/api/trainee/workouts/[id]/prev-week/route.ts`

The query logic:
1. From the given `workoutId`, resolve its `dayIndex`, `weekNumber`, `programId`.
2. Find the workout in the same program with the same `dayIndex` but `weekNumber - 1`.
3. Return that workout's exercises with their most-recent feedback (LATERAL join on `updatedAt DESC`).
4. If no previous workout exists (week 1 or no matching workout), return `{ exercises: [] }`.
5. RBAC: the trainee must own the program (checked via `tp.traineeId = session.user.id`).

- [ ] **Step 1: Create the route file**

Create `src/app/api/trainee/workouts/[id]/prev-week/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import type { PrevWeekExerciseItem } from '@/lib/workout-recap'

interface PrevWeekRow {
    weId: string
    exerciseName: string
    order: number
    targetSets: number
    targetReps: string
    setNumber: number | null
    setReps: number | null
    setWeight: number | null
    setCompleted: boolean | null
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: workoutId } = await params

    try {
        const session = await requireRole(['trainee'])

        const rows = await prisma.$queryRaw<PrevWeekRow[]>`
            WITH source_workout AS (
                SELECT w."dayIndex", wk."weekNumber", wk."programId"
                FROM workouts w
                JOIN weeks wk ON wk.id = w."weekId"
                JOIN training_programs tp ON tp.id = wk."programId"
                WHERE w.id = ${workoutId}
                  AND tp."traineeId" = ${session.user.id}
            ),
            prev_workout AS (
                SELECT w.id
                FROM workouts w
                JOIN weeks wk ON wk.id = w."weekId"
                JOIN source_workout sw ON wk."programId" = sw."programId"
                    AND w."dayIndex" = sw."dayIndex"
                    AND wk."weekNumber" = sw."weekNumber" - 1
                LIMIT 1
            )
            SELECT
                we.id                       AS "weId",
                e.name                      AS "exerciseName",
                we.order                    AS "order",
                we.sets                     AS "targetSets",
                we.reps                     AS "targetReps",
                sp."setNumber"              AS "setNumber",
                sp.reps                     AS "setReps",
                sp.weight                   AS "setWeight",
                sp.completed                AS "setCompleted"
            FROM workout_exercises we
            JOIN prev_workout pw ON we."workoutId" = pw.id
            JOIN exercises e ON e.id = we."exerciseId"
            LEFT JOIN LATERAL (
                SELECT id FROM exercise_feedbacks
                WHERE "workoutExerciseId" = we.id
                  AND "traineeId" = ${session.user.id}
                ORDER BY "updatedAt" DESC
                LIMIT 1
            ) latest_ef ON true
            LEFT JOIN sets_performed sp ON sp."feedbackId" = latest_ef.id
            ORDER BY we.order, sp."setNumber"
        `

        const exerciseMap = new Map<string, PrevWeekExerciseItem>()

        for (const row of rows) {
            if (!exerciseMap.has(row.weId)) {
                exerciseMap.set(row.weId, {
                    id: row.weId,
                    exerciseName: row.exerciseName,
                    order: row.order,
                    targetSets: row.targetSets,
                    targetReps: row.targetReps,
                    sets: [],
                })
            }
            if (row.setNumber !== null && row.setReps !== null && row.setWeight !== null) {
                exerciseMap.get(row.weId)!.sets.push({
                    setNumber: row.setNumber,
                    reps: row.setReps,
                    weight: row.setWeight,
                    completed: row.setCompleted ?? false,
                })
            }
        }

        const exercises = Array.from(exerciseMap.values()).sort((a, b) => a.order - b.order)

        return apiSuccess({ exercises })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error, workoutId }, 'Error fetching previous week data')
        return apiError('INTERNAL_ERROR', 'Failed to fetch previous week data', 500, undefined, 'internal.default')
    }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/trainee/workouts/[id]/prev-week/route.ts
git commit -m "feat: add prev-week API route for trainee workout"
```

---

## Task 3: `PrevWeekPanel` Component

**Files:**
- Create: `src/components/PrevWeekPanel.tsx`
- Test: `tests/unit/prev-week-panel.test.tsx`

The panel shows exercises in order. For each exercise:
- Exercise name (bold, truncated)
- If sets exist: each set on a sub-row — `#N  X rep  Y kg`
- If no sets: a single line `—` in gray

- [ ] **Step 1: Write failing tests**

Create `tests/unit/prev-week-panel.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PrevWeekPanel from '@/components/PrevWeekPanel'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            if (key === 'workouts.prevWeekTitle') return 'Last Week'
            if (key === 'workouts.prevWeekClose') return 'Close'
            if (key === 'workouts.prevWeekLoading') return 'Loading...'
            if (key === 'workouts.prevWeekError') return 'Error'
            if (key === 'workouts.prevWeekNoData') return 'No data'
            if (key === 'workouts.prevWeekSetRow') {
                return `#${opts?.set} · ${opts?.reps} rep · ${opts?.weight} kg`
            }
            return key
        },
    }),
}))

const mockExercises = [
    {
        id: 'we-1',
        exerciseName: 'Bench Press',
        order: 1,
        targetSets: 3,
        targetReps: '8',
        sets: [
            { setNumber: 1, reps: 8, weight: 80, completed: true },
            { setNumber: 2, reps: 8, weight: 80, completed: true },
            { setNumber: 3, reps: 7, weight: 80, completed: true },
        ],
    },
    {
        id: 'we-2',
        exerciseName: 'Tricep Extension',
        order: 2,
        targetSets: 3,
        targetReps: '12',
        sets: [],
    },
]

describe('PrevWeekPanel', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('renders nothing when closed', () => {
        const { container } = render(
            <PrevWeekPanel workoutId="w1" isOpen={false} onClose={vi.fn()} />
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('shows loading state initially when open', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { exercises: [] } }),
        })
        render(<PrevWeekPanel workoutId="w1" isOpen={true} onClose={vi.fn()} />)
        expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('displays exercises and sets after successful fetch', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { exercises: mockExercises } }),
        })
        render(<PrevWeekPanel workoutId="w1" isOpen={true} onClose={vi.fn()} />)

        await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument())
        expect(screen.getByText('#1 · 8 rep · 80 kg')).toBeInTheDocument()
        expect(screen.getByText('#3 · 7 rep · 80 kg')).toBeInTheDocument()
        expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
        expect(screen.getByText('No data')).toBeInTheDocument()
    })

    it('shows error when fetch fails', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: { message: 'Server error' } }),
        })
        render(<PrevWeekPanel workoutId="w1" isOpen={true} onClose={vi.fn()} />)
        await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument())
    })

    it('calls onClose when backdrop is clicked', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { exercises: [] } }),
        })
        const onClose = vi.fn()
        render(<PrevWeekPanel workoutId="w1" isOpen={true} onClose={onClose} />)
        await userEvent.click(screen.getByRole('button', { name: 'Close' }))
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('re-fetches when workoutId changes', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { exercises: [] } }),
        })
        const { rerender } = render(
            <PrevWeekPanel workoutId="w1" isOpen={true} onClose={vi.fn()} />
        )
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
        rerender(<PrevWeekPanel workoutId="w2" isOpen={true} onClose={vi.fn()} />)
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/prev-week-panel.test.tsx
```

Expected: FAIL — component not found.

- [ ] **Step 3: Create `src/components/PrevWeekPanel.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { X, History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PrevWeekExerciseItem } from '@/lib/workout-recap'

interface PrevWeekPanelProps {
    workoutId: string
    isOpen: boolean
    onClose: () => void
}

export default function PrevWeekPanel({ workoutId, isOpen, onClose }: PrevWeekPanelProps) {
    const { t } = useTranslation('trainee')
    const [exercises, setExercises] = useState<PrevWeekExerciseItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen) return
        let cancelled = false

        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(`/api/trainee/workouts/${workoutId}/prev-week`)
                const data = await res.json()
                if (!res.ok) {
                    throw new Error(data?.error?.message ?? t('workouts.prevWeekError'))
                }
                if (!cancelled) {
                    setExercises(data?.data?.exercises ?? [])
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : t('workouts.prevWeekError'))
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        void load()
        return () => {
            cancelled = true
        }
    }, [isOpen, workoutId, t])

    if (!isOpen) return null

    return (
        <>
            <div
                className="fixed inset-0 z-30 bg-black/40"
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                role="dialog"
                aria-label={t('workouts.prevWeekTitle')}
                className="fixed bottom-0 left-0 right-0 z-40 flex max-h-[80vh] flex-col rounded-t-2xl bg-white shadow-xl"
            >
                <div className="flex justify-center pb-1 pt-3">
                    <div className="h-1 w-10 rounded-full bg-gray-300" />
                </div>

                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-gray-400" />
                        <h2 className="text-base font-bold text-gray-900">{t('workouts.prevWeekTitle')}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('workouts.prevWeekClose')}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">
                    {loading && (
                        <p className="py-8 text-center text-sm text-gray-500">{t('workouts.prevWeekLoading')}</p>
                    )}

                    {error && (
                        <p className="py-8 text-center text-sm text-red-600">{error}</p>
                    )}

                    {!loading && !error && (
                        <ul className="space-y-0">
                            {exercises.map((exercise) => (
                                <li
                                    key={exercise.id}
                                    className="border-b border-gray-100 py-3 last:border-0"
                                >
                                    <p className="truncate text-sm font-semibold text-gray-800 mb-1">
                                        {exercise.exerciseName}
                                    </p>
                                    {exercise.sets.length === 0 ? (
                                        <p className="text-xs text-gray-400">{t('workouts.prevWeekNoData')}</p>
                                    ) : (
                                        <ul className="space-y-0.5">
                                            {exercise.sets.map((set) => (
                                                <li
                                                    key={set.setNumber}
                                                    className="flex items-center gap-2 text-xs text-gray-500 tabular-nums"
                                                >
                                                    <span className="w-5 shrink-0 text-gray-300 font-medium">#{set.setNumber}</span>
                                                    <span>
                                                        {t('workouts.prevWeekSetRow', {
                                                            set: set.setNumber,
                                                            reps: set.reps,
                                                            weight: set.weight,
                                                        })}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </>
    )
}
```

**Note on `prevWeekSetRow` key:** The i18n key renders just the reps/weight text (without `#N`) since `#N` is rendered separately in JSX. The translation key should produce `"X rep · Y kg"`, not include the set number.

Wait — the test expects `'#1 · 8 rep · 80 kg'` to appear as a single text node, but in the JSX above, `#1` and the translation are separate elements. Adjust the component so the set row renders as a single text string, OR adjust tests to match the actual DOM structure.

**Revised approach:** render the full row from the translation key directly in one `<li>`, removing the separate `#N` span:

Replace the sets `<ul>` block with:

```typescript
<ul className="space-y-0.5">
    {exercise.sets.map((set) => (
        <li
            key={set.setNumber}
            className="text-xs text-gray-500 tabular-nums"
        >
            {t('workouts.prevWeekSetRow', {
                set: set.setNumber,
                reps: set.reps,
                weight: set.weight,
            })}
        </li>
    ))}
</ul>
```

And define the i18n key as `"#{{set}} · {{reps}} rep · {{weight}} kg"`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/prev-week-panel.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PrevWeekPanel.tsx tests/unit/prev-week-panel.test.tsx
git commit -m "feat: add PrevWeekPanel component"
```

---

## Task 4: Export PrevWeekPanel from Components Index

**Files:**
- Modify: `src/components/index.ts`

- [ ] **Step 1: Add export**

In `src/components/index.ts`, find the line:

```typescript
export { default as WorkoutRecapPanel } from './WorkoutRecapPanel'
```

Add immediately after:

```typescript
export { default as PrevWeekPanel } from './PrevWeekPanel'
```

- [ ] **Step 2: Verify**

```bash
npm run type-check
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/index.ts
git commit -m "feat: export PrevWeekPanel from components index"
```

---

## Task 5: Add i18n Keys

**Files:**
- Modify: `public/locales/en/trainee.json`
- Modify: `public/locales/it/trainee.json`

- [ ] **Step 1: Add English keys**

In `public/locales/en/trainee.json`, find the block containing `"recapTitle"` (around line 223) and add the new keys immediately after `"recapError"`:

```json
"prevWeekTitle": "Last Week",
"prevWeekClose": "Close",
"prevWeekLoading": "Loading last week...",
"prevWeekError": "Failed to load last week data",
"prevWeekNoData": "—",
"prevWeekSetRow": "#{{set}} · {{reps}} rep · {{weight}} kg"
```

- [ ] **Step 2: Add Italian keys**

In `public/locales/it/trainee.json`, find the same block and add after `"recapError"`:

```json
"prevWeekTitle": "Settimana precedente",
"prevWeekClose": "Chiudi",
"prevWeekLoading": "Caricamento settimana precedente...",
"prevWeekError": "Errore nel caricamento dei dati precedenti",
"prevWeekNoData": "—",
"prevWeekSetRow": "#{{set}} · {{reps}} rep · {{weight}} kg"
```

- [ ] **Step 3: Verify**

```bash
npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add public/locales/en/trainee.json public/locales/it/trainee.json
git commit -m "feat: add prevWeek i18n keys for EN and IT"
```

---

## Task 6: Wire Up in `_content.tsx`

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx`

Changes:
1. Import `PrevWeekPanel` and `History` icon.
2. Add `prevWeekOpen` state.
3. Add icon button in the header, visible only when `workout.weekNumber > 1`, placed between `WeekTypeBadge` and the existing `ClipboardList` button.
4. Mount `<PrevWeekPanel>` alongside `<WorkoutRecapPanel>`.

- [ ] **Step 1: Add import for `PrevWeekPanel` and `History`**

In `_content.tsx`, line 8 currently reads:
```typescript
import { RPESelector, SkeletonDetail, WeekTypeBadge } from '@/components'
```

Change to:
```typescript
import { RPESelector, SkeletonDetail, WeekTypeBadge, PrevWeekPanel } from '@/components'
```

In the lucide-react import (line 10-22), add `History` to the list:
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
    History,
    PlayCircle,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
```

- [ ] **Step 2: Add `prevWeekOpen` state**

After line 165 (`const [recapOpen, setRecapOpen] = useState(false)`), add:

```typescript
const [prevWeekOpen, setPrevWeekOpen] = useState(false)
```

- [ ] **Step 3: Add icon button in header**

In the sticky nav header, find the `<div className="flex items-center gap-2">` block (around line 652). It currently contains:
```tsx
<WeekTypeBadge ... />
<button ... > {/* recap button */}
    <ClipboardList className="h-5 w-5" />
</button>
<span ...>{workoutProgressPercent}%</span>
```

Insert the prev-week button **between** `WeekTypeBadge` and the `ClipboardList` button:

```tsx
<WeekTypeBadge
    weekType={workout.weekType}
    labels={{
        normal: t('weekType.normal'),
        test: t('weekType.test'),
        deload: t('weekType.deload'),
    }}
/>
{workout.weekNumber > 1 && (
    <button
        type="button"
        onClick={() => setPrevWeekOpen(true)}
        aria-label={t('workouts.prevWeekTitle')}
        className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
    >
        <History className="h-5 w-5" />
    </button>
)}
<button
    type="button"
    onClick={() => setRecapOpen(true)}
    aria-label={t('workouts.recapTitle')}
    className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
>
    <ClipboardList className="h-5 w-5" />
</button>
<span className="text-xs text-gray-400 font-semibold tabular-nums w-9 text-right">
    {workoutProgressPercent}%
</span>
```

- [ ] **Step 4: Mount `PrevWeekPanel`**

Find the closing section of the component return (around line 757-762) where `WorkoutRecapPanel` is mounted:

```tsx
<WorkoutRecapPanel
    workoutId={workoutId}
    isOpen={recapOpen}
    onClose={() => setRecapOpen(false)}
/>
```

Add `PrevWeekPanel` immediately after:

```tsx
<WorkoutRecapPanel
    workoutId={workoutId}
    isOpen={recapOpen}
    onClose={() => setRecapOpen(false)}
/>
<PrevWeekPanel
    workoutId={workoutId}
    isOpen={prevWeekOpen}
    onClose={() => setPrevWeekOpen(false)}
/>
```

- [ ] **Step 5: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/trainee/workouts/[id]/_content.tsx
git commit -m "feat: wire up PrevWeekPanel in workout detail header"
```

---

## Task 7: Update Existing Tests for `_content.tsx`

**Files:**
- Modify: `tests/unit/trainee-workout-focus.test.tsx`

The existing fixture uses `weekNumber: 2` (already > 1), so the History button will appear. Add a test to verify hiding on week 1, and that the prev-week button renders on week 2.

- [ ] **Step 1: Add tests to `trainee-workout-focus.test.tsx`**

Find the test file and add a describe block after the existing tests:

```typescript
describe('previous week button visibility', () => {
    it('shows prev-week button when weekNumber > 1', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { workout: { ...fixtureWorkout, weekNumber: 2 } } }),
        })
        render(<WorkoutDetailContent />)
        await waitFor(() => expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument(), { timeout: 2000 })
        const header = screen.getByTestId('focus-mode-header')
        expect(within(header).getByRole('button', { name: /settimana precedente|last week/i })).toBeInTheDocument()
    })

    it('hides prev-week button when weekNumber is 1', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { workout: { ...fixtureWorkout, weekNumber: 1 } } }),
        })
        render(<WorkoutDetailContent />)
        await waitFor(() => expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument(), { timeout: 2000 })
        const header = screen.getByTestId('focus-mode-header')
        expect(within(header).queryByRole('button', { name: /settimana precedente|last week/i })).not.toBeInTheDocument()
    })
})
```

**Note:** The `fixtureWorkout` mock uses `weekNumber: 2` already, so the existing tests are unaffected. These two new tests explicitly verify the conditional rendering.

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx
```

Expected: PASS (including new tests). If the i18n mock in that file doesn't cover `prevWeekTitle`, add it to the existing i18n mock in the test setup.

- [ ] **Step 3: Run full unit suite**

```bash
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/trainee-workout-focus.test.tsx
git commit -m "test: add prev-week button visibility tests"
```

---

## Task 8: Update CHANGELOG

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Add changelog entry**

Prepend to `implementation-docs/CHANGELOG.md`:

```markdown
## [unreleased] — 2026-05-01

### Added
- **Previous week panel**: New `History` icon button in workout detail header (hidden on week 1). Opens a bottom sheet showing exercises and per-set reps/weight from the equivalent workout one week earlier.
- `GET /api/trainee/workouts/[id]/prev-week` — single-query endpoint using CTE + LATERAL join for most-recent feedback per exercise.
- `PrevWeekPanel` component mirroring `WorkoutRecapPanel` style.
- `PrevWeekSet` and `PrevWeekExerciseItem` types in `src/lib/workout-recap.ts`.
- i18n keys `workouts.prevWeek*` in EN and IT.
```

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: update changelog for prev-week panel feature"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Icon next to recap icon — Task 6, Step 3
- [x] Data fetched via query, not calculated frontend — Task 2 (raw SQL)
- [x] Shows exercise name, sets × rep, kg — Task 3 component, `prevWeekSetRow` key
- [x] First week: icon hidden — Task 6, `workout.weekNumber > 1` condition
- [x] Performance-optimized: single CTE + LATERAL JOIN query — Task 2
- [x] Style mirrors recap panel — Task 3 (same bottom sheet pattern, `rounded-t-2xl`, `max-h-[80vh]`)

**Placeholder scan:** No TBD, TODO, or "similar to" references. All code blocks complete.

**Type consistency:**
- `PrevWeekExerciseItem` defined in Task 1, used in Task 2 (API return type) and Task 3 (component state type) — consistent.
- `PrevWeekRow` is local to the API route — not referenced elsewhere.
- `t('workouts.prevWeekSetRow', { set, reps, weight })` — consistent across Task 3 (component), Task 5 (i18n), and Task 7 (test mock).
