# Records Page — Standard Action Icon Buttons

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two sets of raw `<button>` edit/delete elements in `PersonalRecordsExplorer` with the standard `ActionIconButton` + `InlineActions` wrapper.

**Architecture:** Single-file change. `ActionIconButton` (variant="edit"/"delete") and `InlineActions` are already defined in `src/components/ActionIconButton.tsx` and exported from the component index. Two locations inside `PersonalRecordsExplorer.tsx` have identical patterns — both get replaced. `Pencil` and `Trash2` lucide imports become unused and are removed.

**Tech Stack:** React, TypeScript, Tailwind, Lucide (via ActionIconButton internally)

---

### Task 1: Replace action buttons in PersonalRecordsExplorer

**Files:**
- Modify: `src/components/PersonalRecordsExplorer.tsx:15` (imports)
- Modify: `src/components/PersonalRecordsExplorer.tsx:354-379` (latest record row actions)
- Modify: `src/components/PersonalRecordsExplorer.tsx:420-445` (historical record row actions)

- [ ] **Step 1: Write failing test**

Create `tests/unit/PersonalRecordsExplorer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PersonalRecordsExplorer } from '@/components/PersonalRecordsExplorer'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'it' },
    }),
}))

vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Line: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
}))

const mockRecord = {
    id: 'rec-1',
    weight: 100,
    reps: 5,
    recordDate: '2026-01-15',
    notes: null,
    exercise: { id: 'ex-1', name: 'Squat', type: 'fundamental' },
}

describe('PersonalRecordsExplorer action buttons', () => {
    it('renders ActionIconButton for edit and delete (not raw buttons with blue/red classes)', () => {
        const onEdit = vi.fn()
        const onDelete = vi.fn()
        render(
            <PersonalRecordsExplorer
                records={[mockRecord]}
                onEditRecord={onEdit}
                onDeleteRecord={onDelete}
                showActions
            />
        )
        // ActionIconButton renders as bg-green-600 (edit) and bg-red-600 (delete)
        const editBtn = screen.getByTitle('common.edit')
        const deleteBtn = screen.getByTitle('common.delete')
        expect(editBtn).toHaveClass('bg-green-600')
        expect(deleteBtn).toHaveClass('bg-red-600')
        // Old pattern was text-blue-600 — must not exist
        expect(editBtn).not.toHaveClass('text-blue-600')
    })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/unit/PersonalRecordsExplorer.test.tsx
```

Expected: FAIL — buttons have `text-blue-600` not `bg-green-600`.

- [ ] **Step 3: Update import line in PersonalRecordsExplorer.tsx**

In `src/components/PersonalRecordsExplorer.tsx` line 15, replace:

```ts
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react'
```

with:

```ts
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ActionIconButton, InlineActions } from '@/components/ActionIconButton'
```

- [ ] **Step 4: Replace latest-record row actions (lines ~354-379)**

Replace this block:

```tsx
<td className="px-4 py-3 text-right">
    <div className="inline-flex items-center gap-2">
        {onEditRecord && (
            <button
                type="button"
                onClick={() => onEditRecord(group.latestRecord)}
                className="rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                title={t('common.edit')}
            >
                <Pencil className="h-4 w-4" />
            </button>
        )}
        {onDeleteRecord && (
            <button
                type="button"
                onClick={() => onDeleteRecord(group.latestRecord)}
                className="rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-800"
                title={t('common.delete')}
            >
                <Trash2 className="h-4 w-4" />
            </button>
        )}
    </div>
</td>
```

with:

```tsx
<td className="px-4 py-3 text-right">
    <InlineActions>
        {onEditRecord && (
            <ActionIconButton
                variant="edit"
                label={t('common.edit')}
                onClick={() => onEditRecord(group.latestRecord)}
            />
        )}
        {onDeleteRecord && (
            <ActionIconButton
                variant="delete"
                label={t('common.delete')}
                onClick={() => onDeleteRecord(group.latestRecord)}
            />
        )}
    </InlineActions>
</td>
```

- [ ] **Step 5: Replace historical-record row actions (lines ~420-445)**

Replace this block:

```tsx
<td className="px-4 py-3 text-right">
    <div className="inline-flex items-center gap-2">
        {onEditRecord && (
            <button
                type="button"
                onClick={() => onEditRecord(record)}
                className="rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                title={t('common.edit')}
            >
                <Pencil className="h-4 w-4" />
            </button>
        )}
        {onDeleteRecord && (
            <button
                type="button"
                onClick={() => onDeleteRecord(record)}
                className="rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-800"
                title={t('common.delete')}
            >
                <Trash2 className="h-4 w-4" />
            </button>
        )}
    </div>
</td>
```

with:

```tsx
<td className="px-4 py-3 text-right">
    <InlineActions>
        {onEditRecord && (
            <ActionIconButton
                variant="edit"
                label={t('common.edit')}
                onClick={() => onEditRecord(record)}
            />
        )}
        {onDeleteRecord && (
            <ActionIconButton
                variant="delete"
                label={t('common.delete')}
                onClick={() => onDeleteRecord(record)}
            />
        )}
    </InlineActions>
</td>
```

- [ ] **Step 6: Run test to confirm it passes**

```bash
npx vitest run tests/unit/PersonalRecordsExplorer.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/PersonalRecordsExplorer.tsx tests/unit/PersonalRecordsExplorer.test.tsx
git commit -m "feat: replace raw edit/delete buttons in PersonalRecordsExplorer with ActionIconButton standard"
```
