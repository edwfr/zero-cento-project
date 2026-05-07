# Delete Workout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let trainers delete an individual workout from a week on the `/trainer/programs/[id]/edit` page.

**Architecture:** New `DELETE /api/programs/[id]/workouts/[workoutId]` route cascades to exercises via Prisma. Frontend adds a trash icon button in the workout panel header, guarded by a confirmation modal. On success, the workout is removed from local `program` state without a full refetch.

**Tech Stack:** Next.js 15 App Router, Prisma (Postgres), React useState, react-i18next, ConfirmationModal + ActionIconButton (existing components).

---

## File Map

| File | Action |
|------|--------|
| `src/app/api/programs/[id]/workouts/[workoutId]/route.ts` | **Create** — DELETE handler |
| `tests/integration/delete-workout.test.ts` | **Create** — integration tests for the route |
| `public/locales/en/trainer.json` | **Modify** — add i18n keys |
| `public/locales/it/trainer.json` | **Modify** — add i18n keys |
| `src/app/trainer/programs/[id]/edit/_content.tsx` | **Modify** — state + button + modal + handler |
| `implementation-docs/CHANGELOG.md` | **Modify** — changelog entry |

---

### Task 1: Write failing integration tests for DELETE route

**Files:**
- Create: `tests/integration/delete-workout.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: {
            findUnique: vi.fn(),
        },
        workout: {
            findUnique: vi.fn(),
            delete: vi.fn(),
        },
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn() },
}))

import { DELETE } from '@/app/api/programs/[id]/workouts/[workoutId]/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function makeRequest() {
    return new NextRequest(
        'http://localhost:3000/api/programs/prog-1/workouts/workout-1',
        { method: 'DELETE' }
    )
}

const mockTrainerSession = {
    user: { id: 'trainer-1', role: 'trainer' },
}

const baseProgram = {
    id: 'prog-1',
    trainerId: 'trainer-1',
    status: 'draft',
}

const baseWorkout = {
    id: 'workout-1',
    week: { programId: 'prog-1' },
}

describe('DELETE /api/programs/[id]/workouts/[workoutId]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession as any)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(baseProgram as any)
        vi.mocked(prisma.workout.findUnique).mockResolvedValue(baseWorkout as any)
        vi.mocked(prisma.workout.delete).mockResolvedValue(baseWorkout as any)
    })

    it('returns 200 and deletes the workout', async () => {
        const req = makeRequest()
        const res = await DELETE(req, {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.data).toBeDefined()
        expect(vi.mocked(prisma.workout.delete)).toHaveBeenCalledWith({
            where: { id: 'workout-1' },
        })
    })

    it('returns 404 when program not found', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(null)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 403 when trainer does not own the program', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...baseProgram,
            trainerId: 'other-trainer',
        } as any)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns 403 when program is not draft', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...baseProgram,
            status: 'active',
        } as any)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns 404 when workout not found', async () => {
        vi.mocked(prisma.workout.findUnique).mockResolvedValue(null)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 404 when workout belongs to different program', async () => {
        vi.mocked(prisma.workout.findUnique).mockResolvedValue({
            id: 'workout-1',
            week: { programId: 'other-prog' },
        } as any)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 401 when unauthenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 })
        )
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(401)
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/integration/delete-workout.test.ts
```

Expected: FAIL — `DELETE` export not found

---

### Task 2: Implement DELETE API route

**Files:**
- Create: `src/app/api/programs/[id]/workouts/[workoutId]/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * DELETE /api/programs/[id]/workouts/[workoutId]
 * Remove a workout from a week. Cascades to workoutExercises.
 * Only allowed on draft programs by the owning trainer (or admin).
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; workoutId: string }> }
) {
    const { id: programId, workoutId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify your own programs', 403, undefined, 'program.modifyDenied')
        }

        if (session.user.role !== 'admin' && program.status !== 'draft') {
            return apiError(
                'FORBIDDEN',
                'Cannot modify program: only draft programs can be edited',
                403,
                undefined,
                'program.cannotModifyNonDraft'
            )
        }

        const workout = await prisma.workout.findUnique({
            where: { id: workoutId },
            select: { id: true, week: { select: { programId: true } } },
        })

        if (!workout || workout.week.programId !== programId) {
            return apiError('NOT_FOUND', 'Workout not found', 404, undefined, 'workout.notFound')
        }

        await prisma.workout.delete({ where: { id: workoutId } })

        logger.info({ workoutId, programId, userId: session.user.id }, 'Workout deleted')

        return apiSuccess({ message: 'Workout deleted successfully' })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId, workoutId }, 'Error deleting workout')
        return apiError('INTERNAL_ERROR', 'Failed to delete workout', 500, undefined, 'internal.default')
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run tests/integration/delete-workout.test.ts
```

Expected: all 7 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/programs/[id]/workouts/[workoutId]/route.ts tests/integration/delete-workout.test.ts
git commit -m "feat(api): DELETE /api/programs/[id]/workouts/[workoutId]"
```

---

### Task 3: Add i18n keys

**Files:**
- Modify: `public/locales/en/trainer.json`
- Modify: `public/locales/it/trainer.json`

- [ ] **Step 1: Add English keys**

In `public/locales/en/trainer.json`, inside the `"editProgram"` object, after the `"deleteRowTitle"` line, add:

```json
"deleteWorkoutTitle": "Remove workout",
"confirmDeleteWorkoutTitle": "Remove this workout?",
"confirmDeleteWorkoutMessage": "This will permanently delete \"{{label}}\" and all its exercises. This action cannot be undone.",
"confirmDeleteWorkoutConfirm": "Remove",
"workoutDeleteError": "Error removing workout",
"workoutDeletedSuccess": "Workout removed",
```

- [ ] **Step 2: Add Italian keys**

In `public/locales/it/trainer.json`, inside the `"editProgram"` object, after the `"deleteRowTitle"` line, add:

```json
"deleteWorkoutTitle": "Rimuovi workout",
"confirmDeleteWorkoutTitle": "Rimuovere questo workout?",
"confirmDeleteWorkoutMessage": "Questa azione eliminerà definitivamente \"{{label}}\" e tutti i suoi esercizi. L'operazione non è reversibile.",
"confirmDeleteWorkoutConfirm": "Rimuovi",
"workoutDeleteError": "Errore durante la rimozione del workout",
"workoutDeletedSuccess": "Workout rimosso",
```

- [ ] **Step 3: Commit**

```bash
git add public/locales/en/trainer.json public/locales/it/trainer.json
git commit -m "feat(i18n): add delete workout translation keys"
```

---

### Task 4: Frontend — state, handler, button, modal

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`

This task touches four areas of the file. Apply them in order.

#### 4a — Add state variables

Find the block around line 618–627 (near `savingWorkoutId` and `confirmDeleteRow`):

```typescript
const [savingWorkoutId, setSavingWorkoutId] = useState<string | null>(null)
const [deletingRowId] = useState<string | null>(null)
const [reorderingWorkoutId, setReorderingWorkoutId] = useState<string | null>(null)

const [confirmCopyNextWeek, setConfirmCopyNextWeek] = useState<Week | null>(null)
const [confirmDeleteRow, setConfirmDeleteRow] = useState<{
```

- [ ] **Step 1: Add two new state variables** after `reorderingWorkoutId` and before `confirmCopyNextWeek`:

```typescript
const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null)
const [confirmDeleteWorkout, setConfirmDeleteWorkout] = useState<{
    workoutId: string
    weekId: string
    workoutLabel: string
} | null>(null)
```

#### 4b — Add handler function

Find the `deleteRow` function near line 2198:

```typescript
const deleteRow = () => {
```

- [ ] **Step 2: Add `handleDeleteWorkout` immediately after the closing `}` of `deleteRow`**

```typescript
const handleDeleteWorkout = async () => {
    if (!confirmDeleteWorkout) return
    const { workoutId, weekId, workoutLabel } = confirmDeleteWorkout

    try {
        setDeletingWorkoutId(workoutId)
        const res = await fetch(`/api/programs/${programId}/workouts/${workoutId}`, {
            method: 'DELETE',
        })
        const data = await res.json()

        if (!res.ok) {
            throw new Error(getApiErrorMessage(data, t('editProgram.workoutDeleteError'), t))
        }

        setProgram((current) => {
            if (!current) return current
            return {
                ...current,
                weeks: current.weeks.map((week) =>
                    week.id === weekId
                        ? { ...week, workouts: week.workouts.filter((w) => w.id !== workoutId) }
                        : week
                ),
            }
        })

        // Clean up any orphaned draft/pending state for this workout
        setDraftRowIdsByWorkout((current) => {
            const next = { ...current }
            if (next[workoutId]) {
                setRowStateById((rows) => {
                    const nextRows = { ...rows }
                    next[workoutId].forEach((id) => delete nextRows[id])
                    return nextRows
                })
                delete next[workoutId]
            }
            return next
        })
        setPendingDeletesByWorkout((current) => {
            const next = { ...current }
            delete next[workoutId]
            return next
        })

        showToast(t('editProgram.workoutDeletedSuccess'), 'success')
        setConfirmDeleteWorkout(null)
    } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : t('editProgram.workoutDeleteError'), 'error')
    } finally {
        setDeletingWorkoutId(null)
    }
}
```

#### 4c — Add delete button in workout panel header

Find the workout header block (around line 3102–3136). The `!readOnly` guard wraps an `inline-flex` div with "Add row" and "Save workout" buttons:

```typescript
{!readOnly && (
    <div className="inline-flex items-center gap-2">
        <button
            type="button"
            onClick={() => addDraftRow(workout.id)}
            disabled={Boolean(savingRowId || deletingRowId || savingWorkoutId)}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary hover:bg-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
            <Plus className="w-4 h-4" />
            {t('editProgram.addRow')}
        </button>
        <button
            type="button"
            onClick={() => {
                void saveWorkoutRows(workout)
            }}
```

- [ ] **Step 3: Add the delete button as the LAST item inside that `inline-flex` div**, right after the closing `</button>` of the "Save workout" button and before the closing `</div>`:

```tsx
<ActionIconButton
    variant="delete"
    label={t('editProgram.deleteWorkoutTitle')}
    onClick={() =>
        setConfirmDeleteWorkout({
            workoutId: workout.id,
            weekId: week.id,
            workoutLabel: workoutLabel,
        })
    }
    disabled={Boolean(
        savingRowId ||
        deletingRowId ||
        savingWorkoutId ||
        deletingWorkoutId
    )}
    isLoading={deletingWorkoutId === workout.id}
/>
```

#### 4d — Add ConfirmationModal

Find the group of `ConfirmationModal` components at the bottom of the JSX (around line 3774–3800). Add a new one after the existing `confirmDeleteRow` modal:

```tsx
<ConfirmationModal
    isOpen={confirmDeleteWorkout !== null}
    onClose={() => {
        if (!deletingWorkoutId) setConfirmDeleteWorkout(null)
    }}
    onConfirm={() => void handleDeleteWorkout()}
    title={t('editProgram.confirmDeleteWorkoutTitle')}
    message={t('editProgram.confirmDeleteWorkoutMessage', {
        label: confirmDeleteWorkout?.workoutLabel ?? '',
    })}
    confirmText={t('editProgram.confirmDeleteWorkoutConfirm')}
    variant="danger"
    isLoading={deletingWorkoutId !== null}
/>
```

- [ ] **Step 4: Run unit tests to verify no regressions**

```bash
npm run test:unit
```

Expected: all unit tests PASS

- [ ] **Step 5: Run type check**

```bash
npm run type-check
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx
git commit -m "feat(ui): add delete workout button with confirmation modal"
```

---

### Task 5: Changelog

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Add entry**

Add at the top of `implementation-docs/CHANGELOG.md`:

```markdown
## 2026-05-07 — Delete Workout

- Added `DELETE /api/programs/[id]/workouts/[workoutId]` API route. Cascades to exercises. Guards: trainer ownership + draft status.
- Added delete button (trash icon) in workout panel header on `/trainer/programs/[id]/edit`.
- Confirmation modal before deletion. Optimistic state removal after success.
- i18n keys added in EN and IT.
```

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog for delete workout feature"
```

---

## Self-Review

**Spec coverage:**
- ✅ Trainer can delete a workout from a week with N workouts → workout panel gets delete button
- ✅ Confirmation required → ConfirmationModal with danger variant
- ✅ Backend validates ownership + draft status → API route guards
- ✅ Other workouts in the week remain → local state filter, no full refetch

**Placeholder scan:** None found.

**Type consistency:**
- `confirmDeleteWorkout` shape `{ workoutId, weekId, workoutLabel }` used consistently in state declaration, setter call, and handler.
- `deletingWorkoutId` is `string | null` throughout.
- `handleDeleteWorkout` references `setDraftRowIdsByWorkout`, `setRowStateById`, `setPendingDeletesByWorkout` — all exist in the component.
