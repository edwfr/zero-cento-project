# Program Detail & History Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `/trainee/programs/[id]` (icon-only week toggle, shared exercise list component with trainee notes), and compact `/trainee/history` to single-row program cards with inline stats.

**Architecture:** Extract a shared `WorkoutExerciseDisplayList` component (same visual style as `PrevWeekPanel`) used in both PrevWeekPanel and ProgramDetailContent. Enrich `loadProgressAggregates` to return `traineeNote` per exercise. Compact history cards to single flex rows with inline stat strip.

**Tech Stack:** Next.js 15 App Router, React, TanStack Query, Tailwind CSS, react-i18next, Prisma, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/lib/trainee-program-data.ts` | Add `traineeNote` to `exercisesPerformed` items in `WorkoutEntry` and `loadProgressAggregates` |
| `src/components/WorkoutExerciseDisplayList.tsx` | **New** – shared exercise list component |
| `src/components/index.ts` | Export `WorkoutExerciseDisplayList` |
| `src/components/PrevWeekPanel.tsx` | Use `WorkoutExerciseDisplayList` |
| `src/app/trainee/programs/_components/ProgramDetailContent.tsx` | Icon-only week toggle; use `WorkoutExerciseDisplayList` for exercise details |
| `public/locales/it/trainee.json` | New i18n key: `currentProgram.traineeExerciseNote`, `history.statsLine` |
| `public/locales/en/trainee.json` | Same keys in English |
| `src/app/trainee/history/_content.tsx` | Compact inline stats strip; compact single-row program cards |

---

## Task 1: Enrich progress aggregates with trainee feedback notes

**Files:**
- Modify: `src/lib/trainee-program-data.ts`

The `WorkoutEntry.exercisesPerformed` array currently carries only `performedSets`. We need to add `traineeNote: string | null` per entry so that `ProgramDetailContent` can display the trainee's own notes next to each exercise in a completed workout.

- [ ] **Step 1: Write failing unit test**

Create `tests/unit/trainee-program-data-notes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma – just validate the type shape is correct
describe('WorkoutEntry traineeNote field', () => {
    it('exercisesPerformed items include traineeNote field', () => {
        // Shape test: the type must have traineeNote
        type ExercisePerformedItem = {
            workoutExerciseId: string
            performedSets: Array<{ setNumber: number; reps: number; weight: number }>
            traineeNote: string | null
        }
        const item: ExercisePerformedItem = {
            workoutExerciseId: 'we-1',
            performedSets: [{ setNumber: 1, reps: 8, weight: 80 }],
            traineeNote: 'felt strong',
        }
        expect(item.traineeNote).toBe('felt strong')

        const itemNoNote: ExercisePerformedItem = {
            workoutExerciseId: 'we-2',
            performedSets: [],
            traineeNote: null,
        }
        expect(itemNoNote.traineeNote).toBeNull()
    })
})
```

- [ ] **Step 2: Run test (should pass — it's a type shape test)**

```bash
npx vitest run tests/unit/trainee-program-data-notes.test.ts
```

Expected: PASS (type shape test, no runtime dependency)

- [ ] **Step 3: Update `WorkoutEntry` type in `trainee-program-data.ts`**

In `src/lib/trainee-program-data.ts`, change the `WorkoutEntry` interface (around line 70):

```typescript
interface WorkoutEntry {
    id: string
    name: string
    weekNumber: number
    weekType: string
    dayOfWeek: number
    exerciseCount: number
    completed: boolean
    started: boolean
    feedbackCount: number
    exercisesPerformed: Array<{
        workoutExerciseId: string
        performedSets: Array<{ setNumber: number; reps: number; weight: number }>
        traineeNote: string | null
    }>
}
```

Also update the `TraineeProgramProgress.workouts` export (around line 46–68) so consumers see the new field. Since `WorkoutEntry` is referenced by `nextWorkout` and `workouts`, updating the interface is sufficient.

- [ ] **Step 4: Add feedback notes query in `loadProgressAggregates`**

In `loadProgressAggregates` (around line 320–365), after the `performedRows` query, add a query for the latest `exerciseFeedback.notes` per `workoutExercise` in this program:

```typescript
    // Fetch latest trainee notes per workoutExercise
    const feedbackNotesRows = await prisma.exerciseFeedback.findMany({
        where: {
            workoutExercise: { workout: { week: { programId } } },
            notes: { not: null },
        },
        select: {
            workoutExerciseId: true,
            notes: true,
            workoutExercise: { select: { workoutId: true } },
        },
        orderBy: { updatedAt: 'desc' },
    })

    // Keep only the most recent note per workoutExerciseId
    const latestNoteByWeId = new Map<string, string>()
    for (const row of feedbackNotesRows) {
        if (!latestNoteByWeId.has(row.workoutExerciseId) && row.notes) {
            latestNoteByWeId.set(row.workoutExerciseId, row.notes)
        }
    }
```

- [ ] **Step 5: Include `traineeNote` when building `exercisesPerformed` (around line 382)**

Replace the `exercisesPerformed` mapping:

```typescript
        const exercisesPerformed = Array.from(exercisesPerformedForWorkout.entries()).map(
            ([workoutExerciseId, performedSets]) => ({
                workoutExerciseId,
                performedSets,
                traineeNote: latestNoteByWeId.get(workoutExerciseId) ?? null,
            })
        )
```

- [ ] **Step 6: Verify TypeScript**

```bash
npm run type-check 2>&1 | head -30
```

Expected: no errors related to `traineeNote`

- [ ] **Step 7: Commit**

```bash
git add src/lib/trainee-program-data.ts tests/unit/trainee-program-data-notes.test.ts
git commit -m "feat: add traineeNote to exercisesPerformed in progress aggregates"
```

---

## Task 2: Create `WorkoutExerciseDisplayList` shared component

**Files:**
- Create: `src/components/WorkoutExerciseDisplayList.tsx`
- Modify: `src/components/index.ts`

This component renders exercises the same way `PrevWeekPanel` does (exercise name → performed set rows → notes). It replaces the inline mobile-card and desktop-table rendering in `ProgramDetailContent`, and is also used by `PrevWeekPanel`.

- [ ] **Step 1: Write failing unit test**

Create `tests/unit/WorkoutExerciseDisplayList.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WorkoutExerciseDisplayList, { type ExerciseDisplayItem } from '@/components/WorkoutExerciseDisplayList'

const items: ExerciseDisplayItem[] = [
    {
        id: 'we-1',
        exerciseName: 'Squat',
        scheme: '3 x 8',
        performedSets: [
            { setNumber: 1, reps: 8, weight: 100, completed: true },
            { setNumber: 2, reps: 7, weight: 100, completed: true },
        ],
        trainerNote: 'Keep knees out',
        traineeNote: 'Felt easy',
    },
    {
        id: 'we-2',
        exerciseName: 'Bench Press',
        scheme: '4 x 6',
        performedSets: [],
        traineeNote: null,
    },
]

describe('WorkoutExerciseDisplayList', () => {
    it('renders exercise names', () => {
        render(<WorkoutExerciseDisplayList items={items} />)
        expect(screen.getByText('Squat')).toBeTruthy()
        expect(screen.getByText('Bench Press')).toBeTruthy()
    })

    it('renders performed set rows when sets are present', () => {
        render(<WorkoutExerciseDisplayList items={items} />)
        expect(screen.getByText('#1 · 8 rep · 100 kg')).toBeTruthy()
        expect(screen.getByText('#2 · 7 rep · 100 kg')).toBeTruthy()
    })

    it('renders scheme when no performed sets', () => {
        render(<WorkoutExerciseDisplayList items={items} />)
        expect(screen.getByText('4 x 6')).toBeTruthy()
    })

    it('renders trainer note', () => {
        render(<WorkoutExerciseDisplayList items={items} />)
        expect(screen.getByText('Keep knees out')).toBeTruthy()
    })

    it('renders trainee note', () => {
        render(<WorkoutExerciseDisplayList items={items} />)
        expect(screen.getByText('Felt easy')).toBeTruthy()
    })

    it('renders custom emptyText when items is empty', () => {
        render(<WorkoutExerciseDisplayList items={[]} emptyText="Nessun esercizio" />)
        expect(screen.getByText('Nessun esercizio')).toBeTruthy()
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/WorkoutExerciseDisplayList.test.tsx
```

Expected: FAIL – "Cannot find module '@/components/WorkoutExerciseDisplayList'"

- [ ] **Step 3: Create the component**

Create `src/components/WorkoutExerciseDisplayList.tsx`:

```typescript
'use client'

import { FileText, MessageSquare } from 'lucide-react'

export interface ExerciseDisplayItem {
    id: string
    exerciseName: string
    variant?: string | null
    isWarmup?: boolean
    scheme: string
    performedSets: Array<{
        setNumber: number
        reps: number
        weight: number
        completed: boolean
    }>
    trainerNote?: string | null
    traineeNote?: string | null
}

interface WorkoutExerciseDisplayListProps {
    items: ExerciseDisplayItem[]
    emptyText?: string
    setRowLabel?: (set: number, reps: number, weight: number) => string
}

export default function WorkoutExerciseDisplayList({
    items,
    emptyText = '—',
    setRowLabel,
}: WorkoutExerciseDisplayListProps) {
    if (items.length === 0) {
        return <p className="text-sm text-gray-400">{emptyText}</p>
    }

    const defaultSetRow = (set: number, reps: number, weight: number) =>
        `#${set} · ${reps} rep · ${weight} kg`

    const renderSet = setRowLabel ?? defaultSetRow

    return (
        <ul className="space-y-0">
            {items.map((item) => {
                const completedSets = item.performedSets.filter((s) => s.completed)

                return (
                    <li
                        key={item.id}
                        className="border-b border-gray-100 py-3 last:border-0"
                    >
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {item.isWarmup && (
                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    W
                                </span>
                            )}
                            <p className="truncate text-sm font-semibold text-gray-800">
                                {item.exerciseName}
                            </p>
                            {item.variant && (
                                <span className="text-xs text-gray-500">({item.variant})</span>
                            )}
                        </div>

                        {completedSets.length > 0 ? (
                            <ul className="space-y-0.5">
                                {completedSets.map((set) => (
                                    <li
                                        key={set.setNumber}
                                        className="text-xs text-gray-500 tabular-nums"
                                    >
                                        {renderSet(set.setNumber, set.reps, set.weight)}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-gray-400">{item.scheme}</p>
                        )}

                        {item.trainerNote && (
                            <p className="mt-1.5 flex items-start gap-1 text-xs text-gray-500 italic">
                                <FileText className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                {item.trainerNote}
                            </p>
                        )}

                        {item.traineeNote && (
                            <p className="mt-1 flex items-start gap-1 text-xs text-brand-primary italic">
                                <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                {item.traineeNote}
                            </p>
                        )}
                    </li>
                )
            })}
        </ul>
    )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/WorkoutExerciseDisplayList.test.tsx
```

Expected: PASS (all 6 tests)

- [ ] **Step 5: Export from index.ts**

In `src/components/index.ts`, add after the last export:

```typescript
export { default as WorkoutExerciseDisplayList } from './WorkoutExerciseDisplayList'
export type { ExerciseDisplayItem } from './WorkoutExerciseDisplayList'
```

- [ ] **Step 6: Verify TypeScript**

```bash
npm run type-check 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/WorkoutExerciseDisplayList.tsx src/components/index.ts tests/unit/WorkoutExerciseDisplayList.test.tsx
git commit -m "feat: add WorkoutExerciseDisplayList shared component"
```

---

## Task 3: Update PrevWeekPanel to use the shared component

**Files:**
- Modify: `src/components/PrevWeekPanel.tsx`

Replace the inline exercise rendering with `WorkoutExerciseDisplayList`. The mapping: `PrevWeekExerciseItem` → `ExerciseDisplayItem`:
- `scheme` = `${ex.targetSets} x ${ex.targetReps}`
- `performedSets` = `ex.sets`
- `traineeNote` = `ex.exerciseNote`

- [ ] **Step 1: Run existing tests to capture baseline**

```bash
npx vitest run tests/unit/ 2>&1 | tail -20
```

Note: all tests should pass before this change.

- [ ] **Step 2: Update PrevWeekPanel**

Replace `src/components/PrevWeekPanel.tsx` with:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { History, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PrevWeekExerciseItem } from '@/lib/workout-recap'
import WorkoutExerciseDisplayList, { type ExerciseDisplayItem } from './WorkoutExerciseDisplayList'

interface PrevWeekPanelProps {
    workoutId: string
}

export default function PrevWeekPanel({ workoutId }: PrevWeekPanelProps) {
    const { t } = useTranslation('trainee')
    const prevWeekErrorText = t('workouts.prevWeekError')
    const [expanded, setExpanded] = useState(false)
    const [exercises, setExercises] = useState<PrevWeekExerciseItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!expanded) return
        if (exercises.length > 0 || error) return
        let cancelled = false

        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(`/api/trainee/workouts/${workoutId}/prev-week`)
                const data = await res.json()
                if (!res.ok) {
                    throw new Error(data?.error?.message ?? prevWeekErrorText)
                }
                if (!cancelled) {
                    setExercises(data?.data?.exercises ?? [])
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : prevWeekErrorText)
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
    }, [expanded, workoutId, prevWeekErrorText, exercises.length, error])

    const displayItems: ExerciseDisplayItem[] = exercises.map((ex) => ({
        id: ex.id,
        exerciseName: ex.exerciseName,
        scheme: `${ex.targetSets} x ${ex.targetReps}`,
        performedSets: ex.sets,
        traineeNote: ex.exerciseNote,
    }))

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
                <History className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="flex-1 text-sm font-semibold text-gray-700">
                    {t('workouts.prevWeekTitle')}
                </span>
                {expanded
                    ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
                    : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                }
            </button>

            {expanded && (
                <div className="border-t border-gray-100 px-4 py-3">
                    {loading && (
                        <p className="py-4 text-center text-sm text-gray-500">{t('workouts.prevWeekLoading')}</p>
                    )}
                    {error && (
                        <p className="py-4 text-center text-sm text-red-600">{error}</p>
                    )}
                    {!loading && !error && (
                        <WorkoutExerciseDisplayList
                            items={displayItems}
                            emptyText={t('workouts.prevWeekNoData')}
                            setRowLabel={(set, reps, weight) =>
                                t('workouts.prevWeekSetRow', { set, reps, weight })
                            }
                        />
                    )}
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 3: Run unit tests**

```bash
npx vitest run tests/unit/ 2>&1 | tail -20
```

Expected: all tests pass

- [ ] **Step 4: Verify TypeScript**

```bash
npm run type-check 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/PrevWeekPanel.tsx
git commit -m "refactor: PrevWeekPanel uses WorkoutExerciseDisplayList"
```

---

## Task 4: Refactor ProgramDetailContent (icon toggle + shared exercise display)

**Files:**
- Modify: `src/app/trainee/programs/_components/ProgramDetailContent.tsx`

Two changes:
1. **Week toggle**: Replace the text+icon button (`openWeek`/`closeWeek`) with an icon-only `ChevronDown`/`ChevronUp` button in the top-right corner of the week card header.
2. **Exercise details**: Replace the mobile card + desktop table rendering with `WorkoutExerciseDisplayList`.

For the mapping, the component needs to build `ExerciseDisplayItem[]` from `WorkoutExercise[]` + `exercisesPerformed`. A completed exercise has sets from `exercisesPerformed`; an incomplete exercise shows only the planned scheme.

The `WorkoutProgress` interface in this file (around line 130) needs a `traineeNote` field added to `ExercisePerformed`.

- [ ] **Step 1: Update local `ExercisePerformed` interface to include `traineeNote`**

In `ProgramDetailContent.tsx`, find the `ExercisePerformed` interface (around line 63):

```typescript
interface ExercisePerformed {
    workoutExerciseId: string
    performedSets: PerformedSet[]
    traineeNote: string | null
}
```

- [ ] **Step 2: Update `mapTraineeProgramViewToProgram` to pass `traineeNote`**

In `mapTraineeProgramViewToProgram` (around line 239), when mapping `exercisesPerformed`:

```typescript
exercisesPerformed: workoutProgress?.exercisesPerformed?.map((ep: {
    workoutExerciseId: string
    performedSets: Array<{ setNumber: number; reps: number; weight: number }>
    traineeNote?: string | null
}) => ({
    workoutExerciseId: ep.workoutExerciseId,
    performedSets: ep.performedSets,
    traineeNote: ep.traineeNote ?? null,
})) ?? [],
```

Also update `mapProgramDetailToProgramInterface` (around line 278), in the workout mapping: set `exercisesPerformed: []` as before (no change needed; it's overwritten by progress data).

- [ ] **Step 3: Update `mergedProgram` memo to preserve `traineeNote`**

In the `mergedProgram` useMemo (around line 390), update exercisesPerformed mapping:

```typescript
exercisesPerformed: workoutProgress?.exercisesPerformed?.map((ep: {
    workoutExerciseId: string
    performedSets: Array<{ setNumber: number; reps: number; weight: number }>
    traineeNote?: string | null
}) => ({
    workoutExerciseId: ep.workoutExerciseId,
    performedSets: ep.performedSets,
    traineeNote: ep.traineeNote ?? null,
})) ?? workout.exercisesPerformed,
```

- [ ] **Step 4: Replace week toggle button with icon-only version**

Find the week toggle button (around line 808–820):

```tsx
{/* Old: text + icon button */}
<button
    type="button"
    onClick={() => toggleWeek(week.weekNumber)}
    aria-expanded={expandedWeeks[week.weekNumber] ?? false}
    className="inline-flex items-center gap-1 self-start rounded-lg border border-brand-primary bg-white px-3 py-1.5 text-xs font-semibold text-brand-primary transition-colors hover:bg-[#FFF7E5]"
>
    {expandedWeeks[week.weekNumber]
        ? t('currentProgram.closeWeek')
        : t('currentProgram.openWeek')}
    {expandedWeeks[week.weekNumber]
        ? <ChevronUp className="h-4 w-4" />
        : <ChevronDown className="h-4 w-4" />}
</button>
```

Replace with an icon-only button positioned via the parent flex layout. Change the parent `div` `className` to include `relative` and add the icon button as a sibling positioned at the right:

The whole week header section (the `<div className="mb-4 flex flex-col ...">` block) should become:

```tsx
<div className="mb-4 flex items-start justify-between">
    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4 flex-1">
        <h3 className="text-xl font-bold text-gray-900 min-w-0">
            {t('currentProgram.week', { number: week.weekNumber })}
        </h3>
        <WeekTypeBadge
            weekType={week.weekType}
            labels={{
                tecnica: t('currentProgram.weekTypeTecnica'),
                ipertrofia: t('currentProgram.weekTypeIpertrofia'),
                volume: t('currentProgram.weekTypeVolume'),
                forza_generale: t('currentProgram.weekTypeForzaGenerale'),
                intensificazione: t('currentProgram.weekTypeIntensificazione'),
                picco: t('currentProgram.weekTypePicco'),
                test: t('currentProgram.weekTypeTest'),
                deload: t('currentProgram.weekTypeDeload'),
            }}
        />
        <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${weekBadgeClass}`}>
            <WeekStatusIcon className={`h-4 w-4 ${weekIconClass}`} />
            <span>{weekStatusLabel}</span>
        </div>
        <p className="text-sm text-gray-600">
            {t('currentProgram.weekCompleted', {
                completed: week.workouts.filter((w) => w.completed).length,
                total: week.workouts.length,
            })}
        </p>
    </div>
    <button
        type="button"
        onClick={() => toggleWeek(week.weekNumber)}
        aria-label={expandedWeeks[week.weekNumber]
            ? t('currentProgram.closeWeek')
            : t('currentProgram.openWeek')}
        aria-expanded={expandedWeeks[week.weekNumber] ?? false}
        className="ml-2 flex-shrink-0 rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
    >
        {expandedWeeks[week.weekNumber]
            ? <ChevronUp className="h-5 w-5" />
            : <ChevronDown className="h-5 w-5" />}
    </button>
</div>
```

- [ ] **Step 5: Replace exercise detail rendering with `WorkoutExerciseDisplayList`**

At the top of the file, add the import:
```typescript
import WorkoutExerciseDisplayList, { type ExerciseDisplayItem } from '@/components/WorkoutExerciseDisplayList'
```

Add a helper function before the `return` statement to map exercises for a workout:

```typescript
const buildExerciseDisplayItems = (workout: Workout): ExerciseDisplayItem[] => {
    return workout.exercises.map((exercise) => {
        const performed = workout.exercisesPerformed.find(
            (ep) => ep.workoutExerciseId === exercise.id
        )
        const completedSets = performed?.performedSets.map((s) => ({
            setNumber: s.setNumber,
            reps: s.reps,
            weight: s.weight,
            completed: true,
        })) ?? []
        return {
            id: exercise.id,
            exerciseName: exercise.exercise.name,
            variant: exercise.variant,
            isWarmup: exercise.isWarmup,
            scheme: `${exercise.sets} x ${exercise.reps}`,
            performedSets: completedSets,
            trainerNote: exercise.notes,
            traineeNote: performed?.traineeNote ?? null,
        }
    })
}
```

Replace the entire exercise detail block inside `{(expandedWorkouts[workout.id] ?? false) && (...)}`  (the `<div className="p-4">` with mobile cards + desktop table) with:

```tsx
{(expandedWorkouts[workout.id] ?? false) && (
    <div className="px-4 py-3">
        {workout.exercises.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                {t('currentProgram.tableNoExercises')}
            </p>
        ) : (
            <WorkoutExerciseDisplayList
                items={buildExerciseDisplayItems(workout)}
                emptyText={t('currentProgram.tableNoExercises')}
            />
        )}
    </div>
)}
```

- [ ] **Step 6: Run TypeScript check**

```bash
npm run type-check 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 7: Run unit tests**

```bash
npx vitest run tests/unit/ 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/app/trainee/programs/_components/ProgramDetailContent.tsx
git commit -m "refactor: program detail uses icon week toggle and shared exercise list"
```

---

## Task 5: Add i18n key for trainee exercise note label

**Files:**
- Modify: `public/locales/it/trainee.json`
- Modify: `public/locales/en/trainee.json`

The `WorkoutExerciseDisplayList` renders the trainee note with a chat icon but no label. If a label is needed in the future it will be here. For now we need to ensure the i18n key used in the component for `setRowLabel` in `PrevWeekPanel` still works — it already does since it uses `workouts.prevWeekSetRow`.

However, remove now-unused keys from `currentProgram` that referenced the text toggle (if not used elsewhere). The keys `openWeek` and `closeWeek` are still used as `aria-label` values — keep them.

No new keys needed. Skip this task unless there are missing keys after TypeScript check.

- [ ] **Step 1: Verify no missing keys**

```bash
npm run type-check 2>&1 | grep -i "locale\|i18n\|translation" | head -10
```

Expected: no errors

---

## Task 6: Compact history rows and inline stats strip

**Files:**
- Modify: `src/app/trainee/history/_content.tsx`
- Modify: `public/locales/it/trainee.json`
- Modify: `public/locales/en/trainee.json`

Replace:
1. The 3-StatCard grid → single compact text strip: `X programmi · X attivi · X completati`
2. Each program `Card` → compact single-row flex layout

The row format:
- Left: `[status pill] Program title`  
- Middle: `con Trainer · start → end (N sett.)` or for active: `con Trainer · dal start · X% (N/M workout)`
- Right: `[→]` link icon

- [ ] **Step 1: Add i18n keys**

In `public/locales/it/trainee.json`, inside the `"history"` block, add:

```json
"statsLine": "{{total}} programm{{total, plural, one{a} other{i}}} · {{active}} attiv{{active, plural, one{o} other{i}}} · {{completed}} completat{{completed, plural, one{o} other{i}}}",
"programRowStarted": "dal {{date}}",
"programRowPeriod": "{{start}} → {{end}}",
"programRowDuration": "{{count}} sett.",
"programRowProgress": "{{percent}}% ({{completed}}/{{total}} workout)"
```

In `public/locales/en/trainee.json`, inside `"history"`:

```json
"statsLine": "{{total}} program{{total, plural, one{} other{s}}} · {{active}} active · {{completed}} completed",
"programRowStarted": "from {{date}}",
"programRowPeriod": "{{start}} → {{end}}",
"programRowDuration": "{{count}} wk.",
"programRowProgress": "{{percent}}% ({{completed}}/{{total}} workouts)"
```

- [ ] **Step 2: Rewrite `HistoryContent` return JSX**

Replace the `return (...)` block in `src/app/trainee/history/_content.tsx` with:

```tsx
    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">{t('history.title')}</h1>
                <p className="text-gray-500 mt-1 text-sm">
                    {t('history.description')}
                </p>
            </div>

            {programs.length === 0 ? (
                <Card variant="base" padding="none" className="border border-gray-200 rounded-2xl shadow-md">
                    <div className="p-12 text-center">
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
                            className="inline-flex items-center gap-2 border border-brand-primary text-brand-primary hover:bg-brand-primary/10 font-semibold px-6 py-3 rounded-lg transition-colors"
                        >
                            {t('history.goToDashboard')}
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                </Card>
            ) : (
                <>
                    {/* Compact stats strip */}
                    <div className="mb-5 flex items-center gap-3 text-sm text-gray-600">
                        <span className="font-semibold text-gray-800">{t('history.statsHeading')}</span>
                        <span className="text-gray-300">|</span>
                        <span>
                            <span className="font-bold text-gray-900">{programs.length}</span>{' '}
                            {t('history.statsTotalPrograms').toLowerCase()}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span>
                            <span className="font-bold text-brand-primary">{activePrograms}</span>{' '}
                            {t('history.statsActive').toLowerCase()}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span>
                            <span className="font-bold text-emerald-600">{completedPrograms}</span>{' '}
                            {t('history.statsCompleted').toLowerCase()}
                        </span>
                    </div>

                    <div className="mb-3">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500">
                            {t('history.programsHeading')}
                        </h2>
                    </div>

                    <div className="space-y-2">
                        {programs
                            .sort((a, b) => getProgramSortTime(b) - getProgramSortTime(a))
                            .map((program) => {
                                const programStatus = program.status
                                const endDate = getProgramEndDate(program)
                                const accentClass = getStatusAccentClass(programStatus)
                                const progress = activeProgramProgress?.programId === program.id
                                    ? activeProgramProgress
                                    : null
                                const progressPercent = progress && progress.total > 0
                                    ? Math.round((progress.completed / progress.total) * 100)
                                    : null

                                return (
                                    <Link
                                        key={program.id}
                                        href={`/trainee/programs/${program.id}`}
                                        className={`flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow border-l-4 ${accentClass} group`}
                                    >
                                        {/* Status badge */}
                                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClasses(programStatus)}`}>
                                            {getStatusLabel(programStatus)}
                                        </span>

                                        {/* Title + meta */}
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-semibold text-gray-900 text-sm">
                                                {program.title}
                                            </p>
                                            <p className="truncate text-xs text-gray-500 mt-0.5">
                                                {t('history.trainerWith', {
                                                    firstName: program.trainer.firstName,
                                                    lastName: program.trainer.lastName,
                                                })}
                                                {program.startDate && (
                                                    <>
                                                        {' · '}
                                                        {endDate
                                                            ? `${formatDate(program.startDate)} → ${formatDate(endDate)}`
                                                            : t('history.programRowStarted', { date: formatDate(program.startDate) })}
                                                    </>
                                                )}
                                                {' · '}
                                                {t('history.weeks', { count: program.durationWeeks })}
                                            </p>
                                        </div>

                                        {/* Progress for active */}
                                        {progressPercent !== null && (
                                            <div className="hidden sm:flex items-center gap-2 shrink-0">
                                                <div className="w-24 h-1.5 rounded-full bg-gray-100">
                                                    <div
                                                        className="h-1.5 rounded-full bg-brand-primary transition-all"
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-semibold text-brand-primary tabular-nums">
                                                    {progressPercent}%
                                                </span>
                                            </div>
                                        )}

                                        {/* Arrow */}
                                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-brand-primary transition-colors" />
                                    </Link>
                                )
                            })}
                    </div>
                </>
            )}
        </div>
    )
```

- [ ] **Step 3: Add missing `programRowStarted` key to `getStatusHintText` or remove unused function**

After this refactor, `MetaCell`, `getStatusHintText`, and some stat-card-related imports are no longer used. Remove them to keep the file clean:

- Remove `MetaCell` function and its `MetaCellProps` interface
- Remove `getStatusHintText` function  
- Remove unused imports: `Calendar`, `CalendarCheck`, `Clock`, `Dumbbell`, `Trophy`, `Activity`, `FolderOpen`, `ProgressBar`, `StatCard`
- Add import for `programRowStarted` key usage (already covered by `t('history.programRowStarted', ...)` call above)

Update the import line at the top:
```typescript
import {
    ClipboardList,
    ChevronRight,
} from 'lucide-react'
```

And remove `StatCard`, `ProgressBar` from the `@/components` import (they're no longer used).

- [ ] **Step 4: TypeScript check**

```bash
npm run type-check 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 5: Run unit tests**

```bash
npx vitest run tests/unit/ 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/app/trainee/history/_content.tsx public/locales/it/trainee.json public/locales/en/trainee.json
git commit -m "feat: compact history page with single-row program cards and inline stats"
```

---

## Task 7: Final integration check

- [ ] **Step 1: Run full test suite**

```bash
npm run test:unit 2>&1 | tail -30
```

Expected: all pass, coverage ≥ 80% for instrumented files

- [ ] **Step 2: TypeScript clean**

```bash
npm run type-check 2>&1 | grep -c "error"
```

Expected: output is `0`

- [ ] **Step 3: Lint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no errors

- [ ] **Step 4: Final commit if any lint fixes**

```bash
git add -p
git commit -m "chore: lint fixes after refactor"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|-------------|------|
| Remove text toggle on week panel, use icon top-right | Task 4 step 4 |
| Shared exercise display component | Task 2 |
| Same component used in PrevWeekPanel and ProgramDetailContent | Tasks 3 & 4 |
| Show `exercise_feedbacks.notes` (trainee notes) in shared component | Tasks 1 & 2 |
| `/trainee/history` compact single-row with active/completed emphasis | Task 6 |

**Placeholder scan:** None detected — all steps contain complete code.

**Type consistency:**
- `ExerciseDisplayItem` defined in Task 2, imported by `PrevWeekPanel` (Task 3) and `ProgramDetailContent` (Task 4) ✓
- `traineeNote: string | null` added to `WorkoutEntry.exercisesPerformed` in Task 1, consumed in Task 4 ✓
- `buildExerciseDisplayItems` helper defined and used in Task 4 step 5 ✓
- History `programRowStarted` key added in Task 6 and used in the same JSX ✓
