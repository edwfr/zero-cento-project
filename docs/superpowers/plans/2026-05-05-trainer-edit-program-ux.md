# Trainer Edit Program UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve UX of `/trainer/programs/[id]/edit`: remove yellow active-week border, enable sorting of unsaved draft rows, add inline "+" insert row between rows, and apply exercise-group row coloring.

**Architecture:** All changes are in `_content.tsx` (the single large client component). Pure helper functions are extracted to a new `row-utils.ts` for testability. No API changes needed.

**Tech Stack:** React, dnd-kit, Tailwind CSS, react-i18next, Vitest

---

### Task 1: Remove yellow border from active week panel

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx:2591`

- [ ] **Step 1: Open `_content.tsx` and locate the week panel border class**

Line 2591:
```tsx
className={`rounded-xl border bg-white shadow-sm ${isActive ? 'border-brand-primary' : 'border-gray-200'}`}
```

`border-brand-primary` resolves to `rgb(255, 167, 0)` (amber/yellow). Remove active-state override so all weeks always show `border-gray-200`.

- [ ] **Step 2: Replace the conditional border class**

Change line 2591 from:
```tsx
className={`rounded-xl border bg-white shadow-sm ${isActive ? 'border-brand-primary' : 'border-gray-200'}`}
```
To:
```tsx
className="rounded-xl border border-gray-200 bg-white shadow-sm"
```

(Remove the template literal and `isActive` check entirely — `isActive` is still used by the expand logic on the same onClick, so do NOT remove the `isActive` variable itself.)

- [ ] **Step 3: Build and verify in browser**

Run: `npm run dev`

Open `/trainer/programs/<any-id>/edit`. Click different weeks. Confirm no yellow/amber border appears on any week panel.

- [ ] **Step 4: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/_content.tsx
git commit -m "fix: remove yellow active-week border from edit program page"
```

---

### Task 2: Extract pure row utilities + tests

Pure functions for `computeExerciseGroupColors` (used for row coloring) live in a new utility file so they can be unit-tested.

**Files:**
- Create: `src/app/trainer/programs/[id]/edit/row-utils.ts`
- Create: `tests/unit/row-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/row-utils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { computeExerciseGroupColors } from '@/app/trainer/programs/[id]/edit/row-utils'

type MinimalRow = { id: string; exerciseId: string }

const row = (id: string, exerciseId: string): MinimalRow => ({ id, exerciseId })

describe('computeExerciseGroupColors', () => {
    it('returns empty map for empty rows', () => {
        expect(computeExerciseGroupColors([])).toEqual(new Map())
    })

    it('single exercise: row gets even (0)', () => {
        const result = computeExerciseGroupColors([row('r1', 'ex1')])
        expect(result.get('r1')).toBe('even')
    })

    it('two consecutive rows with same exercise: both even', () => {
        const result = computeExerciseGroupColors([
            row('r1', 'ex1'),
            row('r2', 'ex1'),
        ])
        expect(result.get('r1')).toBe('even')
        expect(result.get('r2')).toBe('even')
    })

    it('two different exercises: first even, second odd', () => {
        const result = computeExerciseGroupColors([
            row('r1', 'ex1'),
            row('r2', 'ex2'),
        ])
        expect(result.get('r1')).toBe('even')
        expect(result.get('r2')).toBe('odd')
    })

    it('ex1, ex2, ex2, ex3: even, odd, odd, even', () => {
        const result = computeExerciseGroupColors([
            row('r1', 'ex1'),
            row('r2', 'ex2'),
            row('r3', 'ex2'),
            row('r4', 'ex3'),
        ])
        expect(result.get('r1')).toBe('even')
        expect(result.get('r2')).toBe('odd')
        expect(result.get('r3')).toBe('odd')
        expect(result.get('r4')).toBe('even')
    })

    it('rows with empty exerciseId are excluded from the map', () => {
        const result = computeExerciseGroupColors([
            row('r1', ''),
            row('r2', 'ex1'),
        ])
        expect(result.has('r1')).toBe(false)
        expect(result.get('r2')).toBe('even')
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/row-utils.test.ts`
Expected: FAIL with `Cannot find module '@/app/trainer/programs/[id]/edit/row-utils'`

- [ ] **Step 3: Create `row-utils.ts`**

Create `src/app/trainer/programs/[id]/edit/row-utils.ts`:
```typescript
export function computeExerciseGroupColors(
    rows: { id: string; exerciseId: string }[]
): Map<string, 'even' | 'odd'> {
    const result = new Map<string, 'even' | 'odd'>()
    let groupIndex = -1
    let prevExerciseId = ''

    for (const row of rows) {
        if (!row.exerciseId) continue
        if (row.exerciseId !== prevExerciseId) {
            groupIndex++
            prevExerciseId = row.exerciseId
        }
        result.set(row.id, groupIndex % 2 === 0 ? 'even' : 'odd')
    }

    return result
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run tests/unit/row-utils.test.ts`
Expected: PASS — all 6 tests green

- [ ] **Step 5: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/row-utils.ts tests/unit/row-utils.test.ts
git commit -m "feat: add computeExerciseGroupColors utility with tests"
```

---

### Task 3: Refactor SortableExerciseRow — add className, remove isDraft from disabled

Makes draft rows draggable (prerequisite for Task 4) and allows row background color to be passed in (prerequisite for Task 6).

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx:401-430`

- [ ] **Step 1: Locate and read SortableExerciseRow (lines 401–430)**

Current code:
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

- [ ] **Step 2: Replace SortableExerciseRow with updated version**

Replace lines 401–430 with:
```typescript
function SortableExerciseRow({
    id,
    readOnly,
    className,
    children,
}: {
    id: string
    readOnly: boolean
    className?: string
    children: (dragHandleProps: React.HTMLAttributes<HTMLElement> | null) => React.ReactNode
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled: readOnly,
    })

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 1 : 'auto',
    }

    return (
        <tr ref={setNodeRef} style={style} className={className}>
            {children(readOnly ? null : { ...attributes, ...listeners })}
        </tr>
    )
}
```

Changes: removed `isDraft` prop, removed `isDraft ||` from both `useSortable.disabled` and the children call, added optional `className` prop forwarded to `<tr>`.

- [ ] **Step 3: Fix TypeScript errors from removed isDraft prop**

Search for all usages of `<SortableExerciseRow` in `_content.tsx` (there is only one at line ~3001). Remove the `isDraft={row.isDraft}` prop from the call site:

Old:
```tsx
<SortableExerciseRow
    key={row.id}
    id={row.id}
    isDraft={row.isDraft}
    readOnly={readOnly}
>
```

New:
```tsx
<SortableExerciseRow
    key={row.id}
    id={row.id}
    readOnly={readOnly}
>
```

(We will add `className` in Task 6.)

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/_content.tsx
git commit -m "refactor: SortableExerciseRow — enable draft dragging, add className prop"
```

---

### Task 4: Update handleDragEnd and SortableContext to support all rows (including drafts)

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx:1247-1316` (handleDragEnd)
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx:2799-2808` (SortableContext items)

- [ ] **Step 1: Replace handleDragEnd (lines 1247–1316)**

Replace the entire `handleDragEnd` function with:
```typescript
const handleDragEnd = useCallback(
    async (event: DragEndEvent, workout: Workout) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const allRows = getWorkoutRows(workout)
        const oldIndex = allRows.findIndex((r) => r.id === active.id)
        const newIndex = allRows.findIndex((r) => r.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return

        const reordered = [...allRows]
        const [moved] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, moved)

        // Optimistic update for all rows (including drafts)
        const previousOrders = Object.fromEntries(allRows.map((r) => [r.id, r.order]))
        setRowStateById((current) => {
            const next = { ...current }
            reordered.forEach((row, i) => {
                next[row.id] = { ...(next[row.id] ?? row), order: i + 1 }
            })
            return next
        })

        // Only persist reorder for non-draft rows
        const persistedReordered = reordered.filter((r) => !r.isDraft)
        if (persistedReordered.length === 0) return

        try {
            setReorderingWorkoutId(workout.id)
            const res = await fetch(
                `/api/programs/${programId}/workouts/${workout.id}/exercises/reorder`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        exercises: persistedReordered.map((row, i) => ({
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
            // Revert all rows to pre-drag orders
            setRowStateById((current) => {
                const next = { ...current }
                allRows.forEach((row) => {
                    next[row.id] = { ...(next[row.id] ?? row), order: previousOrders[row.id] }
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

Key differences vs original:
- Uses `allRows` (not filtered to non-draft)
- Optimistic update uses `next[row.id] ?? row` to handle rows not yet in state
- API call only sends `persistedReordered` (non-draft rows), indexed relative to their new position among persisted rows only
- Revert also covers rows not yet in state

- [ ] **Step 2: Update SortableContext items (lines 2799–2808)**

Change:
```tsx
<SortableContext
    items={workoutRows
        .filter((r) => !r.isDraft)
        .map((r) => r.id)}
    strategy={verticalListSortingStrategy}
    disabled={
        readOnly ||
        reorderingWorkoutId !== null
    }
>
```

To:
```tsx
<SortableContext
    items={workoutRows.map((r) => r.id)}
    strategy={verticalListSortingStrategy}
    disabled={
        readOnly ||
        reorderingWorkoutId !== null
    }
>
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: 0 errors

- [ ] **Step 4: Manual test in browser**

Run: `npm run dev`

Open edit page. Add a new row (it becomes a draft). Verify: the draft row has a drag handle and can be dragged to reorder. Verify that dragging persisted rows still calls the reorder API (check Network tab in DevTools). Verify that dragging only draft rows does NOT call the API.

- [ ] **Step 5: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/_content.tsx
git commit -m "feat: allow draft rows to be sorted before saving"
```

---

### Task 5: Add insertDraftRowAt function + i18n key

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx` (after `addDraftRow` at line ~1517)
- Modify: `public/locales/en/trainer.json:447`
- Modify: `public/locales/it/trainer.json:447`

- [ ] **Step 1: Add `insertDraftRowAt` function after `addDraftRow` (line ~1517)**

Insert this function immediately after the closing `}` of `addDraftRow`:
```typescript
const insertDraftRowAt = (workoutId: string, afterRowIndex: number) => {
    if (readOnly || savingRowId || deletingRowId) return

    const workout = program?.weeks
        .flatMap((week) => week.workouts)
        .find((w) => w.id === workoutId)
    if (!workout) return

    const allRows = getWorkoutRows(workout)
    const rowAfter = allRows[afterRowIndex]
    if (!rowAfter) return

    const insertAtOrder = rowAfter.order + 1
    const draftRowId = `draft-${workoutId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    setRowStateById((current) => {
        const next = { ...current }
        // Shift all rows whose order >= insertAtOrder
        allRows.forEach((row) => {
            if (row.order >= insertAtOrder) {
                next[row.id] = { ...(next[row.id] ?? row), order: row.order + 1 }
            }
        })
        // Insert new draft at the insertion point
        next[draftRowId] = {
            id: draftRowId,
            workoutId,
            exerciseId: '',
            variant: '',
            sets: '',
            reps: '',
            targetRpe: '',
            weight: '',
            isWarmup: false,
            order: insertAtOrder,
            restTime: 'm2',
            notes: null,
            isDraft: true,
            isSkeletonExercise: false,
        }
        return next
    })

    setDraftRowIdsByWorkout((current) => ({
        ...current,
        [workoutId]: [...(current[workoutId] || []), draftRowId],
    }))
}
```

- [ ] **Step 2: Add i18n key to English locale**

In `public/locales/en/trainer.json`, on line 447 after `"addRow": "Add row",` add:
```json
"insertRowBetween": "Insert row here",
```

- [ ] **Step 3: Add i18n key to Italian locale**

In `public/locales/it/trainer.json`, on line 447 after `"addRow": "Aggiungi riga",` add:
```json
"insertRowBetween": "Inserisci riga qui",
```

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/_content.tsx public/locales/en/trainer.json public/locales/it/trainer.json
git commit -m "feat: add insertDraftRowAt function and i18n key"
```

---

### Task 6: Wire up JSX — insert row buttons, exercise group coloring, tbody fix

This task modifies the `workoutRows.map(...)` block inside `_content.tsx` to:
1. Wrap each row + its insert separator in a `React.Fragment`
2. Add `InsertRowSeparator` component between rows
3. Apply exercise-group background color to each row
4. Fix `<tbody>` — replace `divide-y` with per-row `border-b`

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx` (multiple locations in workout rendering)

- [ ] **Step 1: Add `InsertRowSeparator` component near `SortableExerciseRow` (after line 430)**

Insert this function immediately after `SortableExerciseRow` (after line 430, before line 432 `export default function EditProgramContent`):

```typescript
function InsertRowSeparator({
    onInsert,
    disabled,
    ariaLabel,
}: {
    onInsert: () => void
    disabled: boolean
    ariaLabel: string
}) {
    return (
        <tr className="group/insert-sep" style={{ lineHeight: 0 }}>
            <td
                colSpan={10}
                style={{ padding: 0, height: '4px', position: 'relative', overflow: 'visible' }}
            >
                <div className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 group-hover/insert-sep:flex">
                    <button
                        type="button"
                        onClick={onInsert}
                        disabled={disabled}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-white shadow-sm transition-transform hover:scale-110 disabled:opacity-60"
                        aria-label={ariaLabel}
                    >
                        <Plus className="h-3 w-3" />
                    </button>
                </div>
            </td>
        </tr>
    )
}
```

- [ ] **Step 2: Add `computeExerciseGroupColors` import**

At the top of `_content.tsx`, add the import alongside existing local imports (near the `structure-utils`, `transform-utils`, `reps-utils` imports):
```typescript
import { computeExerciseGroupColors } from './row-utils'
```

- [ ] **Step 3: Fix `<tbody>` — remove divide-y, add border-b per row**

At line 2925, change:
```tsx
<tbody className="divide-y divide-gray-100 bg-white">
```
To:
```tsx
<tbody className="bg-white">
```

This removes the divide-y that would apply borders to the `InsertRowSeparator` rows.

- [ ] **Step 4: Compute exercise group colors before the workoutRows.map**

Find the block that starts `{workoutRows.map((row, rowIndex) => {` at line ~2937. Immediately before that line, insert:

```typescript
const exerciseGroupColors = computeExerciseGroupColors(workoutRows)
```

(This is inside the JSX block within the workout render — it's a variable declaration in the JSX expression, which is valid since it's evaluated at render time. If TypeScript complains about a statement in JSX, wrap it in a computed block or move it just above the `return` inside the workout `.map()` callback.)

Actually, `workoutRows` is defined a few lines above in the workout map callback. Since we're inside a `.map()` callback (not a React component), we can't use hooks, but we CAN compute variables. Place the line right before the `{workoutRows.map(` opening brace.

In JSX, you can't use `const` directly — you need to be in a JavaScript expression context. The correct pattern is to compute it in the enclosing `.map()` callback before the return. Find the pattern:

```tsx
const workoutRows = getWorkoutRows(workout)
// ... effectiveWeightPreviewByRowId ...
return (
    <div key={workout.id} ...>
        ...
        {workoutRows.map((row, rowIndex) => {
```

Add after `const workoutRows = getWorkoutRows(workout)`:
```typescript
const exerciseGroupColors = computeExerciseGroupColors(workoutRows)
```

- [ ] **Step 5: Wrap each row in React.Fragment and add InsertRowSeparator**

The current map return (lines ~3000–3334) is:
```tsx
return (
    <SortableExerciseRow
        key={row.id}
        id={row.id}
        readOnly={readOnly}
    >
        {(dragHandleProps) => (
            <>
                {/* ... all cells ... */}
            </>
        )}
    </SortableExerciseRow>
)
```

Replace the `return (` at line ~3000 through the closing `)` of the `.map()` at line ~3334 so that:

```tsx
const groupColor = exerciseGroupColors.get(row.id)
const rowBgClass = groupColor === 'even' ? 'bg-gray-50' : groupColor === 'odd' ? 'bg-gray-100' : ''

return (
    <React.Fragment key={row.id}>
        <SortableExerciseRow
            id={row.id}
            readOnly={readOnly}
            className={`border-b border-gray-100 ${rowBgClass}`}
        >
            {(dragHandleProps) => (
                <>
                    {/* ALL EXISTING CELLS UNCHANGED */}
                </>
            )}
        </SortableExerciseRow>
        {!readOnly && rowIndex < workoutRows.length - 1 && (
            <InsertRowSeparator
                onInsert={() => insertDraftRowAt(workout.id, rowIndex)}
                disabled={Boolean(savingRowId || deletingRowId)}
                ariaLabel={t('editProgram.insertRowBetween')}
            />
        )}
    </React.Fragment>
)
```

Key points:
- Remove `key={row.id}` from `<SortableExerciseRow>` — the key is now on the `React.Fragment`
- Add `className={`border-b border-gray-100 ${rowBgClass}`}` to SortableExerciseRow
- Add `InsertRowSeparator` conditionally after each row except the last
- The inner `{/* ALL EXISTING CELLS UNCHANGED */}` means: keep EVERY `<td>` inside the `{(dragHandleProps) => ...}` exactly as it was — do not modify any cell content

- [ ] **Step 6: Verify React is imported with Fragment support**

Check that `React` is imported at the top of `_content.tsx`. If using `import React from 'react'`, `React.Fragment` works. If using named imports only, add `Fragment` or use `<>...</>` syntax with a `key` — but `<>` fragments don't support `key`. 

If `React` is not a default import, use: `import React, { ... } from 'react'` (add `React` to the default import). Or import `Fragment` explicitly: `import { ..., Fragment } from 'react'` and use `<Fragment key={row.id}>`.

- [ ] **Step 7: Type-check**

Run: `npm run type-check`
Expected: 0 errors

- [ ] **Step 8: Run unit tests**

Run: `npm run test:unit`
Expected: all pass

- [ ] **Step 9: Manual test in browser**

Run: `npm run dev`

Open `/trainer/programs/<id>/edit` and expand a workout. Verify:
1. Rows with the same exercise share a background color (gray-50 or gray-100)
2. Rows with different exercises alternate between gray-50 and gray-100
3. Draft rows with no exercise selected have no special background
4. Hovering in the gap between rows reveals a small circular "+" button
5. Clicking "+" inserts a new blank row between the two rows
6. The existing "Add row" button still appends to the end

- [ ] **Step 10: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/_content.tsx
git commit -m "feat: add insert-row button between rows and exercise-group row coloring"
```

---

### Task 7: Update CHANGELOG

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Add entry**

Add to `implementation-docs/CHANGELOG.md` at the top:

```markdown
## [2026-05-05] Trainer Edit Program UX improvements

- Removed yellow/amber border from active week panel (all panels now uniform gray-200)
- Draft rows (unsaved exercises) are now draggable/sortable immediately, without requiring save first
- Added inline "+" button between exercise rows — click to insert a row at that exact position
- Exercise rows are now colored with alternating gray-50/gray-100 by exercise group: consecutive rows with the same exercise share the same shade
```

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: update changelog for edit program UX improvements"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Remove yellow week panel border | Task 1 |
| Sort rows without saving first (draft rows) | Tasks 3, 4 |
| "+" icon between rows to insert at position | Tasks 5, 6 |
| Existing Add row still appends to end | `addDraftRow` unchanged — confirmed |
| Row coloring by exercise group (alternating grays) | Tasks 2, 6 |

### Placeholder scan
No TBDs. All code blocks show exact implementations.

### Type consistency
- `computeExerciseGroupColors` returns `Map<string, 'even' | 'odd'>` — consumed as `exerciseGroupColors.get(row.id)` returning `'even' | 'odd' | undefined` → ternary handles all three cases consistently.
- `InsertRowSeparator` props: `onInsert: () => void`, `disabled: boolean`, `ariaLabel: string` — call site matches.
- `SortableExerciseRow` no longer has `isDraft` prop — single call site updated in Task 3.
- `insertDraftRowAt(workoutId: string, afterRowIndex: number)` called as `insertDraftRowAt(workout.id, rowIndex)` — matches.
