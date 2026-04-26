# Trainer Edit Program — 5 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 issues in `/trainer/programs/[id]/edit`: slow delete, row flickering on save, broken copy-week, missing max-reps field, and add drag-and-drop row reordering.

**Architecture:** All changes are in the existing edit screen (`_content.tsx`) and the exercise DELETE API route. Max reps parsing logic is extracted to a new `reps-utils.ts` file for testability. Drag-and-drop uses already-installed `@dnd-kit/core` + `@dnd-kit/sortable`. Unit tests cover reps-utils and copy-week API route.

**Tech Stack:** Next.js 15 App Router, React, Prisma, @dnd-kit/core + sortable, Vitest, Zod, react-i18next

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/app/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route.ts` |
| Modify | `src/app/trainer/programs/[id]/edit/_content.tsx` |
| Create | `src/app/trainer/programs/[id]/edit/reps-utils.ts` |
| Modify | `public/locales/en/trainer.json` |
| Modify | `public/locales/it/trainer.json` |
| Create | `tests/unit/reps-utils.test.ts` |
| Create | `tests/integration/copy-week.test.ts` |

---

## Task 1: Fix slow DELETE — batch order recalculation

**Problem:** After deleting a `WorkoutExercise`, the DELETE handler runs one `UPDATE` per remaining exercise sequentially. With N remaining exercises this is N+1 round-trips.

**Files:**
- Modify: `src/app/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route.ts:190-201`

- [ ] **Step 1: Replace sequential updates with a batched transaction**

Replace lines 190-201 in the DELETE handler:

```typescript
// BEFORE (sequential, slow):
for (let i = 0; i < remainingExercises.length; i++) {
    await prisma.workoutExercise.update({
        where: { id: remainingExercises[i].id },
        data: { order: i + 1 },
    })
}

// AFTER (single transaction):
if (remainingExercises.length > 0) {
    await prisma.$transaction(
        remainingExercises.map((exercise, i) =>
            prisma.workoutExercise.update({
                where: { id: exercise.id },
                data: { order: i + 1 },
            })
        )
    )
}
```

- [ ] **Step 2: Run type check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route.ts
git commit -m "perf: batch order recalculation after exercise delete into single transaction"
```

---

## Task 2: Fix row flickering on save — batch draft row removal

**Problem:** `saveWorkoutRows` calls `removeDraftRow(row.id, workout.id)` inside the save loop after each draft row is confirmed by the server. This triggers a re-render per row, making rows disappear one by one instead of all at once after the save completes.

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx:1606-1652`

- [ ] **Step 1: Locate the save loop in `saveWorkoutRows`**

The relevant section starts at line ~1606:
```typescript
try {
    setSavingWorkoutId(workout.id)

    for (const row of workoutRows) {
        setSavingRowId(row.id)
        // ...fetch...
        if (row.isDraft) {
            removeDraftRow(row.id, workout.id)   // ← REMOVE THIS LINE
        }
    }

    await fetchProgram({ showLoading: false })
    showToast(...)
```

- [ ] **Step 2: Remove per-row `removeDraftRow` calls; batch-remove after fetch**

Replace the try block in `saveWorkoutRows` (lines ~1606-1643) with:

```typescript
try {
    setSavingWorkoutId(workout.id)
    const savedDraftRowIds: string[] = []

    for (const row of workoutRows) {
        setSavingRowId(row.id)

        const payload = payloadByRowId[row.id]
        const endpoint = row.isDraft
            ? `/api/programs/${programId}/workouts/${workout.id}/exercises`
            : `/api/programs/${programId}/workouts/${workout.id}/exercises/${row.id}`

        const method = row.isDraft ? 'POST' : 'PUT'

        const res = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })

        const data = await res.json()

        if (!res.ok) {
            throw new Error(
                getApiErrorMessage(
                    data,
                    row.isDraft ? t('editProgram.rowSaveError') : t('editProgram.rowUpdateError'),
                    t
                )
            )
        }

        if (row.isDraft) {
            savedDraftRowIds.push(row.id)
        }
    }

    // Batch-remove all saved draft rows in one state update BEFORE refetch
    if (savedDraftRowIds.length > 0) {
        setDraftRowIdsByWorkout((current) => {
            const workoutDrafts = current[workout.id] ?? []
            const remaining = workoutDrafts.filter((id) => !savedDraftRowIds.includes(id))
            if (remaining.length === 0) {
                const { [workout.id]: _removed, ...rest } = current
                return rest
            }
            return { ...current, [workout.id]: remaining }
        })
        setRowStateById((current) => {
            const next = { ...current }
            savedDraftRowIds.forEach((id) => { delete next[id] })
            return next
        })
    }

    await fetchProgram({ showLoading: false })
    showToast(t('editProgram.workoutRowsSavedSuccess'), 'success')
```

- [ ] **Step 3: Run type check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx
git commit -m "fix: batch draft row removal on save to prevent row-by-row UI flicker"
```

---

## Task 3: Fix copy-week — clear target week draft rows after copy

**Problem:** After a successful copy-week, any draft rows (unsaved rows added via the "+" button) that exist in the target week's workouts are preserved by the `rowStateById` state update because `fetchProgram` keeps `isDraft` rows. These orphan rows appear after the copy, making the result look incorrect.

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx` — `handleCopyWeekToNext` function (~line 1135)

- [ ] **Step 1: Locate `handleCopyWeekToNext` (~line 1135) and identify what needs to change**

Current flow:
1. POST to `/api/programs/${programId}/copy-week`
2. `await fetchProgram({ showLoading: false })`
3. show success toast

We need to add: find the target week's workout IDs from the current program state before re-fetching, then clear their draft rows.

- [ ] **Step 2: Update `handleCopyWeekToNext` to clear target week draft state**

Replace the existing `handleCopyWeekToNext` function with:

```typescript
const handleCopyWeekToNext = async () => {
    if (!confirmCopyNextWeek) return

    // Identify target week workout IDs before re-fetching
    const sourceWeek = confirmCopyNextWeek
    const targetWeek = program?.weeks.find(
        (w) => w.weekNumber === sourceWeek.weekNumber + 1
    )
    const targetWorkoutIds = targetWeek?.workouts.map((w) => w.id) ?? []

    try {
        setCopyingWeekId(confirmCopyNextWeek.id)

        const res = await fetch(`/api/programs/${programId}/copy-week`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceWeekId: confirmCopyNextWeek.id }),
        })
        const data = await res.json()

        if (!res.ok) {
            throw new Error(getApiErrorMessage(data, t('editProgram.copyWeekError'), t))
        }

        // Clear any draft rows for the target week's workouts
        if (targetWorkoutIds.length > 0) {
            setDraftRowIdsByWorkout((current) => {
                const next = { ...current }
                targetWorkoutIds.forEach((workoutId) => {
                    if (next[workoutId]) {
                        // Remove draft row entries from rowStateById too
                        const draftIds = next[workoutId]
                        setRowStateById((rows) => {
                            const nextRows = { ...rows }
                            draftIds.forEach((id) => { delete nextRows[id] })
                            return nextRows
                        })
                        delete next[workoutId]
                    }
                })
                return next
            })
        }

        await fetchProgram({ showLoading: false })
        showToast(
            t('editProgram.copyWeekSuccess', {
                sourceWeek: confirmCopyNextWeek.weekNumber,
                targetWeek: confirmCopyNextWeek.weekNumber + 1,
            }),
            'success'
        )
        setConfirmCopyNextWeek(null)
    } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : t('editProgram.copyWeekError'), 'error')
    } finally {
        setCopyingWeekId(null)
    }
}
```

- [ ] **Step 3: Run type check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 4: Write failing tests for copy-week API**

Create `tests/integration/copy-week.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession, mockAdminSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: {
            findUnique: vi.fn(),
        },
        workoutExercise: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn() },
}))

import { POST } from '@/app/api/programs/[id]/copy-week/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function makeRequest(body: object) {
    return new NextRequest('http://localhost:3000/api/programs/prog-1/copy-week', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    })
}

const baseProgram = {
    id: 'prog-1',
    trainerId: 'trainer-1',
    status: 'draft',
    weeks: [
        {
            id: 'week-1',
            weekNumber: 1,
            workouts: [
                {
                    id: 'workout-w1-d0',
                    dayIndex: 0,
                    workoutExercises: [
                        {
                            exerciseId: 'ex-1',
                            variant: null,
                            sets: 4,
                            reps: '5',
                            targetRpe: 8,
                            weightType: 'absolute',
                            weight: 100,
                            effectiveWeight: 100,
                            restTime: 'm3',
                            isWarmup: false,
                            notes: null,
                            order: 1,
                        },
                    ],
                },
            ],
        },
        {
            id: 'week-2',
            weekNumber: 2,
            workouts: [
                {
                    id: 'workout-w2-d0',
                    dayIndex: 0,
                    workoutExercises: [], // empty target week
                },
            ],
        },
    ],
}

describe('POST /api/programs/[id]/copy-week', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession as any)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(baseProgram as any)
        vi.mocked(prisma.$transaction).mockImplementation(async (ops: any) => {
            if (typeof ops === 'function') return ops(prisma)
            return Promise.all(ops)
        })
    })

    it('returns 400 when sourceWeekId is missing', async () => {
        const req = makeRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 404 when program not found', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(null)
        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(404)
    })

    it('returns 404 when sourceWeekId does not exist in program', async () => {
        const req = makeRequest({ sourceWeekId: 'week-nonexistent' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 400 when source is the last week (no following week)', async () => {
        const req = makeRequest({ sourceWeekId: 'week-2' }) // week-2 is last
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 when source week has no exercises', async () => {
        const emptySourceProgram = {
            ...baseProgram,
            weeks: [
                {
                    id: 'week-1',
                    weekNumber: 1,
                    workouts: [{ id: 'workout-w1-d0', dayIndex: 0, workoutExercises: [] }],
                },
                {
                    id: 'week-2',
                    weekNumber: 2,
                    workouts: [{ id: 'workout-w2-d0', dayIndex: 0, workoutExercises: [] }],
                },
            ],
        }
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(emptySourceProgram as any)
        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
    })

    it('returns 403 when trainer tries to copy another trainer\'s program', async () => {
        const otherProgram = { ...baseProgram, trainerId: 'other-trainer' }
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(otherProgram as any)
        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(403)
    })

    it('returns 200 and copies exercises from source to target week matching by dayIndex', async () => {
        const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 })
        const createManyMock = vi.fn().mockResolvedValue({ count: 1 })

        vi.mocked(prisma.$transaction).mockImplementation(async (ops: any) => {
            if (typeof ops === 'function') {
                return ops({
                    workoutExercise: {
                        deleteMany: deleteManyMock,
                        createMany: createManyMock,
                    },
                })
            }
            return Promise.all(ops)
        })

        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.sourceWeek).toBe(1)
        expect(body.data.targetWeek).toBe(2)

        // Verify target workout exercises were deleted before copy
        expect(deleteManyMock).toHaveBeenCalledWith({
            where: { workoutId: 'workout-w2-d0' },
        })

        // Verify source exercises were created in target workout
        expect(createManyMock).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({
                    workoutId: 'workout-w2-d0',
                    exerciseId: 'ex-1',
                    sets: 4,
                    reps: '5',
                }),
            ]),
        })
    })

    it('skips target workouts with no matching dayIndex in source week', async () => {
        const mismatchProgram = {
            ...baseProgram,
            weeks: [
                {
                    id: 'week-1',
                    weekNumber: 1,
                    workouts: [
                        {
                            id: 'workout-w1-d0',
                            dayIndex: 0,
                            workoutExercises: [
                                { exerciseId: 'ex-1', sets: 3, reps: '8', weightType: 'absolute', weight: 80, effectiveWeight: 80, restTime: 'm2', isWarmup: false, notes: null, order: 1, targetRpe: null, variant: null },
                            ],
                        },
                    ],
                },
                {
                    id: 'week-2',
                    weekNumber: 2,
                    workouts: [
                        { id: 'workout-w2-d1', dayIndex: 1, workoutExercises: [] }, // different dayIndex
                    ],
                },
            ],
        }
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mismatchProgram as any)

        const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 })
        const createManyMock = vi.fn().mockResolvedValue({ count: 0 })
        vi.mocked(prisma.$transaction).mockImplementation(async (ops: any) => {
            if (typeof ops === 'function') {
                return ops({
                    workoutExercise: { deleteMany: deleteManyMock, createMany: createManyMock },
                })
            }
        })

        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(200)
        // deleteMany is called but createMany is NOT called (no matching dayIndex)
        expect(deleteManyMock).toHaveBeenCalledWith({ where: { workoutId: 'workout-w2-d1' } })
        expect(createManyMock).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 5: Run failing tests**

```bash
npx vitest run tests/integration/copy-week.test.ts
```
Expected: tests FAIL (file doesn't exist yet — this confirms the test harness is wired up)

- [ ] **Step 6: Run tests again after file is created**

```bash
npx vitest run tests/integration/copy-week.test.ts
```
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx tests/integration/copy-week.test.ts
git commit -m "fix: clear target week draft rows after copy-week; add copy-week API tests"
```

---

## Task 4: Add max reps field — extract utils, update UI and validation

**Problem:** The trainer can only enter a single rep value. They want to optionally enter a max rep, producing the `min-max` range format (e.g. `8-12`) that is already stored in the DB and supported by the API schema.

**Architecture:**
- Extract `parseRepsString` and `buildRepsString` to a new `reps-utils.ts` so they can be unit tested
- Add `repsMax: string` to `EditableWorkoutExerciseRow`
- Split the single reps input into two inputs: `[min] [-] [max (optional)]`
- No backend changes needed — `"8-12"` is already valid in the schema

**Files:**
- Create: `src/app/trainer/programs/[id]/edit/reps-utils.ts`
- Create: `tests/unit/reps-utils.test.ts`
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`
- Modify: `public/locales/en/trainer.json`
- Modify: `public/locales/it/trainer.json`

### Step 4a — Create reps-utils.ts and write failing tests first

- [ ] **Step 1: Write failing tests for reps utilities**

Create `tests/unit/reps-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseRepsString, buildRepsString } from '@/app/trainer/programs/[id]/edit/reps-utils'

describe('parseRepsString', () => {
    it('parses a single number into min with empty max', () => {
        expect(parseRepsString('8')).toEqual({ min: '8', max: '' })
    })

    it('parses a range "8-12" into min and max', () => {
        expect(parseRepsString('8-12')).toEqual({ min: '8', max: '12' })
    })

    it('parses a drop-set "6/8" as min with empty max', () => {
        expect(parseRepsString('6/8')).toEqual({ min: '6/8', max: '' })
    })

    it('parses single-rep "1" correctly', () => {
        expect(parseRepsString('1')).toEqual({ min: '1', max: '' })
    })

    it('parses a large range "100-150"', () => {
        expect(parseRepsString('100-150')).toEqual({ min: '100', max: '150' })
    })

    it('returns empty min and max for an empty string', () => {
        expect(parseRepsString('')).toEqual({ min: '', max: '' })
    })
})

describe('buildRepsString', () => {
    it('returns just min when max is empty', () => {
        expect(buildRepsString('8', '')).toBe('8')
    })

    it('returns "min-max" when both provided', () => {
        expect(buildRepsString('8', '12')).toBe('8-12')
    })

    it('trims whitespace from both values', () => {
        expect(buildRepsString(' 8 ', ' 12 ')).toBe('8-12')
    })

    it('returns min only when max is whitespace-only', () => {
        expect(buildRepsString('8', '   ')).toBe('8')
    })

    it('handles drop-set min with empty max', () => {
        expect(buildRepsString('6/8', '')).toBe('6/8')
    })
})
```

- [ ] **Step 2: Run tests — expect FAIL (file not created yet)**

```bash
npx vitest run tests/unit/reps-utils.test.ts
```
Expected: `FAIL` — `Cannot find module '@/app/trainer/programs/[id]/edit/reps-utils'`

- [ ] **Step 3: Create `reps-utils.ts` to make tests pass**

Create `src/app/trainer/programs/[id]/edit/reps-utils.ts`:

```typescript
export function parseRepsString(reps: string): { min: string; max: string } {
    const rangeMatch = reps.match(/^(\d+)-(\d+)$/)
    if (rangeMatch) {
        return { min: rangeMatch[1], max: rangeMatch[2] }
    }
    return { min: reps, max: '' }
}

export function buildRepsString(min: string, max: string): string {
    const trimMax = max.trim()
    if (trimMax === '') return min.trim()
    return `${min.trim()}-${trimMax}`
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/unit/reps-utils.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/reps-utils.ts tests/unit/reps-utils.test.ts
git commit -m "feat: add reps-utils with parseRepsString/buildRepsString + unit tests"
```

### Step 4b — Wire max reps into _content.tsx

- [ ] **Step 6: Add import for reps-utils at top of `_content.tsx`**

After line 37 (the `structure-utils` import), add:

```typescript
import { parseRepsString, buildRepsString } from './reps-utils'
```

- [ ] **Step 7: Add `repsMax` field to `EditableWorkoutExerciseRow` interface (~line 135)**

```typescript
interface EditableWorkoutExerciseRow {
    id: string
    workoutId: string
    exerciseId: string
    variant: string
    sets: string
    reps: string
    repsMax: string      // ← add this field
    targetRpe: string
    weight: string
    isWarmup: boolean
    order: number
    restTime: RestTime
    notes: string | null
    isDraft: boolean
}
```

- [ ] **Step 8: Update `buildEditableRow` to parse `reps` into min/max (~line 329)**

```typescript
function buildEditableRow(
    workoutId: string,
    workoutExercise: WorkoutExercise,
    isDraft = false
): EditableWorkoutExerciseRow {
    const { min: reps, max: repsMax } = parseRepsString(workoutExercise.reps)
    return {
        id: workoutExercise.id,
        workoutId,
        exerciseId: workoutExercise.exercise.id,
        variant: workoutExercise.variant ?? '',
        sets: String(workoutExercise.sets),
        reps,
        repsMax,
        targetRpe:
            typeof workoutExercise.targetRpe === 'number' ? String(workoutExercise.targetRpe) : '',
        weight: formatWeightInputFromStoredValues(
            workoutExercise.weightType,
            workoutExercise.weight
        ),
        isWarmup: workoutExercise.isWarmup,
        order: workoutExercise.order,
        restTime: workoutExercise.restTime,
        notes: workoutExercise.notes,
        isDraft,
    }
}
```

- [ ] **Step 9: Update `areEditableRowsEquivalent` to compare `repsMax` (~line 360)**

```typescript
function areEditableRowsEquivalent(
    left: EditableWorkoutExerciseRow,
    right: EditableWorkoutExerciseRow
): boolean {
    return (
        left.exerciseId === right.exerciseId &&
        left.variant.trim() === right.variant.trim() &&
        left.sets.trim() === right.sets.trim() &&
        left.reps.trim() === right.reps.trim() &&
        left.repsMax.trim() === right.repsMax.trim() &&   // ← add this
        left.targetRpe.trim() === right.targetRpe.trim() &&
        left.weight.trim() === right.weight.trim() &&
        left.isWarmup === right.isWarmup &&
        left.order === right.order &&
        left.restTime === right.restTime &&
        normalizeOptionalText(left.notes) === normalizeOptionalText(right.notes)
    )
}
```

- [ ] **Step 10: Update `getBaseValidationError` to validate min and max reps separately (~line 1355)**

Replace the existing reps validation block:

```typescript
// BEFORE:
const repsPattern = /^(\d+|\d+-\d+|\d+\/\d+)$/
// ...
if (!repsPattern.test(row.reps.trim())) {
    return t('editProgram.rowValidationReps')
}

// AFTER:
const minRepsPattern = /^(\d+|\d+\/\d+)$/
const maxRepsPattern = /^\d+$/
if (!minRepsPattern.test(row.reps.trim())) {
    return t('editProgram.rowValidationReps')
}
if (row.repsMax.trim() !== '' && !maxRepsPattern.test(row.repsMax.trim())) {
    return t('editProgram.rowValidationRepsMax')
}
if (row.reps.trim().includes('/') && row.repsMax.trim() !== '') {
    return t('editProgram.rowValidationRepsDropSetNoMax')
}
```

- [ ] **Step 11: Update `buildWorkoutExercisePayload` to combine reps fields (~line 1499)**

```typescript
function buildWorkoutExercisePayload(
    row: EditableWorkoutExerciseRow,
    parsedWeight: ParsedWeightInputResult
) {
    const parsedSets = Number.parseInt(row.sets, 10)
    const parsedRpe = row.targetRpe.trim() === '' ? null : Number(row.targetRpe)

    return {
        exerciseId: row.exerciseId,
        variant: row.variant.trim() || null,
        order: row.order,
        sets: parsedSets,
        reps: buildRepsString(row.reps, row.repsMax),   // ← combine min + max
        targetRpe: parsedRpe,
        weightType: parsedWeight.weightType,
        weight: parsedWeight.weight,
        effectiveWeight: parsedWeight.effectiveWeight,
        restTime: row.restTime,
        isWarmup: row.isWarmup,
        notes: row.notes,
    }
}
```

- [ ] **Step 12: Update `addDraftRow` to include `repsMax: ''` (~line 1291)**

Add `repsMax: '',` after `reps: '',` in the draft row initializer object:

```typescript
setRowStateById((currentRows) => ({
    ...currentRows,
    [draftRowId]: {
        id: draftRowId,
        workoutId,
        exerciseId: '',
        variant: '',
        sets: '',
        reps: '',
        repsMax: '',      // ← add this
        targetRpe: '',
        weight: '',
        isWarmup: false,
        order: nextOrder,
        restTime: 'm2',
        notes: null,
        isDraft: true,
    },
}))
```

- [ ] **Step 13: Find the other draft row initializer at ~line 1820 (in `applyStructure`) and add `repsMax: ''`**

In the `draftRow` object inside the structure-apply logic:

```typescript
const draftRow: EditableWorkoutExerciseRow = {
    id: draftRowId,
    workoutId: workout.id,
    exerciseId: structureRow.exerciseId,
    variant: '',
    sets: '',
    reps: '',
    repsMax: '',     // ← add this
    targetRpe: '',
    weight: '',
    isWarmup: false,
    order: nextOrder,
    restTime: 'm2',
    notes: null,
    isDraft: true,
}
```

- [ ] **Step 14: Update the JSX reps table cell (~line 2926) to show two inputs**

Replace the existing single reps `<td>`:

```typescript
// BEFORE:
<td className="px-1 py-3">
    <Input
        type="text"
        value={row.reps}
        onChange={(event) =>
            updateRowFields(row.id, {
                reps: event.target.value,
            })
        }
        disabled={rowBusy || readOnly}
        className={metricFieldClassName}
    />
</td>

// AFTER:
<td className="px-1 py-3">
    <div className="flex items-center gap-0.5">
        <Input
            type="text"
            value={row.reps}
            onChange={(event) =>
                updateRowFields(row.id, { reps: event.target.value })
            }
            disabled={rowBusy || readOnly}
            className="h-9 w-12 rounded-lg border border-gray-300 px-1.5 text-center text-sm leading-5 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-gray-50 disabled:text-gray-400"
            placeholder="8"
            aria-label={t('editProgram.tableReps')}
        />
        <span className="shrink-0 text-xs text-gray-400">–</span>
        <Input
            type="text"
            value={row.repsMax}
            onChange={(event) =>
                updateRowFields(row.id, { repsMax: event.target.value })
            }
            disabled={rowBusy || readOnly}
            className="h-9 w-12 rounded-lg border border-gray-300 px-1.5 text-center text-sm leading-5 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-gray-50 disabled:text-gray-400"
            placeholder={t('editProgram.repsMaxPlaceholder')}
            aria-label={t('editProgram.repsMaxLabel')}
        />
    </div>
</td>
```

- [ ] **Step 15: Add new i18n keys to `public/locales/en/trainer.json`**

Find the `"rowValidationReps"` entry (line ~489) and add after `"rowValidationReps"`:

```json
"rowValidationRepsMax": "Invalid max reps (must be a number)",
"rowValidationRepsDropSetNoMax": "Drop-set format (6/8) cannot have a max reps value",
"repsMaxPlaceholder": "max",
"repsMaxLabel": "Max reps"
```

- [ ] **Step 16: Add new i18n keys to `public/locales/it/trainer.json`**

Find the `"rowValidationReps"` entry and add:

```json
"rowValidationRepsMax": "Ripetizioni massime non valide (deve essere un numero)",
"rowValidationRepsDropSetNoMax": "Il formato drop-set (6/8) non può avere un valore massimo",
"repsMaxPlaceholder": "max",
"repsMaxLabel": "Rep massime"
```

- [ ] **Step 17: Run type check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 18: Run all unit tests**

```bash
npm run test:unit
```
Expected: all PASS including new `reps-utils.test.ts`

- [ ] **Step 19: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/reps-utils.ts \
        src/app/trainer/programs/[id]/edit/_content.tsx \
        public/locales/en/trainer.json \
        public/locales/it/trainer.json \
        tests/unit/reps-utils.test.ts
git commit -m "feat: add optional max reps input to workout exercise rows"
```

---

## Task 5: Add drag-and-drop row reordering

**Problem:** Trainers want to reorder exercises in a workout by dragging rows. The reorder API endpoint (`PATCH /api/.../exercises/reorder`) already exists and is tested.

**Approach:**
- Use `@dnd-kit/core` + `@dnd-kit/sortable` (already installed)
- Only persisted rows (non-draft) are draggable — draft rows don't have server IDs
- On drag end: optimistic order update in local state, then call API; revert on error
- Add a drag handle column (GripVertical icon) as the first column in the table
- DnD is disabled in `readOnly` mode

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`

- [ ] **Step 1: Add @dnd-kit imports at top of `_content.tsx` (after existing imports, ~line 3)**

```typescript
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
```

- [ ] **Step 2: Add `GripVertical` to the existing `lucide-react` import block (~line 19)**

Add `GripVertical` to the destructured imports from `'lucide-react'`.

- [ ] **Step 3: Add `reorderingWorkoutId` state (~line 430, after `deletingRowId`)**

```typescript
const [reorderingWorkoutId, setReorderingWorkoutId] = useState<string | null>(null)
```

- [ ] **Step 4: Add `handleDragEnd` handler in the component body (after `handleCopyWeekToNext`, ~line 1167)**

```typescript
const handleDragEnd = useCallback(
    async (event: DragEndEvent, workout: Workout) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const workoutRows = getWorkoutRows(workout).filter((row) => !row.isDraft)
        const oldIndex = workoutRows.findIndex((r) => r.id === active.id)
        const newIndex = workoutRows.findIndex((r) => r.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return

        // Build new ordered array
        const reordered = [...workoutRows]
        const [moved] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, moved)

        // Optimistic update
        const previousOrders = Object.fromEntries(
            workoutRows.map((r) => [r.id, r.order])
        )
        setRowStateById((current) => {
            const next = { ...current }
            reordered.forEach((row, i) => {
                if (next[row.id]) {
                    next[row.id] = { ...next[row.id], order: i + 1 }
                }
            })
            return next
        })

        try {
            setReorderingWorkoutId(workout.id)
            const res = await fetch(
                `/api/programs/${programId}/workouts/${workout.id}/exercises/reorder`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        exercises: reordered.map((row, i) => ({
                            id: row.id,
                            order: i + 1,
                        })),
                    }),
                }
            )

            if (!res.ok) {
                const data = await res.json()
                throw new Error(getApiErrorMessage(data, t('editProgram.rowReorderError'), t))
            }
        } catch (err) {
            // Revert optimistic update
            setRowStateById((current) => {
                const next = { ...current }
                workoutRows.forEach((row) => {
                    if (next[row.id]) {
                        next[row.id] = { ...next[row.id], order: previousOrders[row.id] }
                    }
                })
                return next
            })
            showToast(
                err instanceof Error ? err.message : t('editProgram.rowReorderError'),
                'error'
            )
        } finally {
            setReorderingWorkoutId(null)
        }
    },
    [getWorkoutRows, programId, showToast, t]
)
```

- [ ] **Step 5: Add i18n key for reorder error**

In `public/locales/en/trainer.json`, after `"rowValidationWithIndex"`:
```json
"rowReorderError": "Failed to reorder exercises"
```

In `public/locales/it/trainer.json`, same position:
```json
"rowReorderError": "Errore nel riordinamento degli esercizi"
```

- [ ] **Step 6: Wrap the exercise table body with DndContext + SortableContext**

Find the `<tbody>` that renders `workoutRows.map((row, rowIndex) => ...)` (~line 2707). 

Wrap the workout table section. Before the `<tbody>`:

```typescript
// Add sensors outside the map (add in component body near other useMemo/hooks):
const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
)
```

Actually `useSensors` is a hook and must be called at component level, not inside the map. Add this near the top of the component (after other hooks, ~line 446):

```typescript
const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
)
```

Then wrap the `<tbody>` content. Find the entire `<table>` element that renders exercises, and wrap it in a `DndContext`:

```tsx
{/* Replace the existing <table> wrapper for exercises */}
<DndContext
    sensors={dndSensors}
    collisionDetection={closestCenter}
    onDragEnd={(event) => void handleDragEnd(event, workout)}
>
    <SortableContext
        items={workoutRows.filter(r => !r.isDraft).map(r => r.id)}
        strategy={verticalListSortingStrategy}
        disabled={readOnly || reorderingWorkoutId !== null}
    >
        <table ...existing table...>
```

- [ ] **Step 7: Create a `SortableExerciseRow` wrapper component just above the `EditProgramContent` function (~line 378)**

This keeps the `useSortable` hook clean. Add before `export default function EditProgramContent`:

```typescript
function SortableExerciseRow({
    id,
    isDraft,
    readOnly,
    children,
}: {
    id: string
    isDraft: boolean
    readOnly: boolean
    children: (dragHandleProps: React.HTMLAttributes<HTMLElement> | null) => React.ReactNode
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled: isDraft || readOnly,
    })

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 1 : 'auto',
    }

    return (
        <tr ref={setNodeRef} style={style}>
            {children(isDraft || readOnly ? null : { ...attributes, ...listeners })}
        </tr>
    )
}
```

- [ ] **Step 8: Update the `{workoutRows.map((row, rowIndex) => (...))}` render to use `SortableExerciseRow`**

Replace `<tr key={row.id} className="align-top">` (~line 2783) with `SortableExerciseRow`:

```tsx
<SortableExerciseRow
    key={row.id}
    id={row.id}
    isDraft={row.isDraft}
    readOnly={readOnly}
>
    {(dragHandleProps) => (
        <>
            {/* New drag handle column — first td */}
            <td className="w-6 px-0.5 py-3 align-middle">
                {dragHandleProps ? (
                    <button
                        type="button"
                        className="flex h-full w-6 cursor-grab items-center justify-center text-gray-300 hover:text-gray-500 active:cursor-grabbing disabled:cursor-not-allowed"
                        disabled={Boolean(rowBusy)}
                        {...dragHandleProps}
                        aria-label={t('editProgram.dragHandleLabel')}
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                ) : (
                    <span className="block w-6" />
                )}
            </td>
            {/* ...all existing tds... */}
        </>
    )}
</SortableExerciseRow>
```

Also add a new `<th>` for the drag handle column at the start of the `<thead>` row, before the warmup `<th>`:

```tsx
<th className="w-6 px-0.5 py-3">
    <span className="sr-only">{t('editProgram.dragHandleLabel')}</span>
</th>
```

- [ ] **Step 9: Add drag handle i18n key**

In `public/locales/en/trainer.json`:
```json
"dragHandleLabel": "Drag to reorder"
```

In `public/locales/it/trainer.json`:
```json
"dragHandleLabel": "Trascina per riordinare"
```

- [ ] **Step 10: Run type check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 11: Run lint**

```bash
npm run lint
```
Expected: no errors

- [ ] **Step 12: Run all tests**

```bash
npm run test:unit
```
Expected: all PASS

- [ ] **Step 13: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx \
        public/locales/en/trainer.json \
        public/locales/it/trainer.json
git commit -m "feat: add drag-and-drop exercise row reordering in workout edit"
```

---

## Task 6: Update CHANGELOG

- [ ] **Step 1: Add changelog entry**

Add to `implementation-docs/CHANGELOG.md`:

```markdown
## 2026-04-24 — Trainer edit program: 5 UX/performance fixes

- **perf** DELETE exercise: batch order recalculation into single `$transaction` (was N sequential queries)
- **fix** Save workout: rows no longer disappear one-by-one; draft rows batch-removed after full save completes
- **fix** Copy week: target week draft rows cleared after copy so orphan rows no longer appear
- **feat** Max reps: exercises can now have an optional max rep value (stored as `min-max` e.g. `8-12`)
- **feat** Drag-and-drop: workout exercises are now reorderable via drag handle using `@dnd-kit`
- **test** Added integration tests for copy-week API route and unit tests for reps parsing utilities
```

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog for trainer edit program fixes"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Save flickering → Task 2 (batch draft removal)
- ✅ Drag-and-drop reordering → Task 5 (@dnd-kit)
- ✅ Max reps field → Task 4 (repsMax input + reps-utils)
- ✅ Copy week fix → Task 3 (clear drafts + API tests)
- ✅ Delete slow → Task 1 (batched transaction)
- ✅ Unit tests for max reps → Task 4 (reps-utils.test.ts)
- ✅ Unit tests for copy week → Task 3 (copy-week.test.ts)

**Type consistency:**
- `parseRepsString` / `buildRepsString` — defined in Task 4a, used in Task 4b ✅
- `SortableExerciseRow` — defined in Task 5 Step 7, used in Step 8 ✅
- `handleDragEnd` — defined in Step 4, called in Step 6 ✅
- `repsMax: string` in `EditableWorkoutExerciseRow` — added Step 7, used everywhere in Steps 8-14 ✅
- `dndSensors` — hook defined in Step 6 note, used in Step 6 ✅

**No placeholders:** All code blocks contain complete implementations.
