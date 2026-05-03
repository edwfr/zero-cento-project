# Records Page — Standard Exercise Autocomplete Dropdown

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native `<select>` for exercise selection in the "Aggiungi/Modifica Massimale" modal with the standard `AutocompleteSearch` component.

**Architecture:** Single-file change in `_content.tsx`. The `exercises` state already holds the full sorted list. `AutocompleteSearch` handles internal filtering via text match on `label`/`sublabel` — no async search needed (all exercises loaded upfront). The `selectedExerciseId` state string is preserved as-is; only the UI widget changes. The `disabled` behavior when editing an existing record is preserved via the `disabled` prop.

**Tech Stack:** React, TypeScript, AutocompleteSearch component (`src/components/AutocompleteSearch.tsx`)

---

### Task 1: Replace native select with AutocompleteSearch in the modal

**Files:**
- Modify: `src/app/trainer/trainees/[id]/records/_content.tsx:1-17` (imports)
- Modify: `src/app/trainer/trainees/[id]/records/_content.tsx:337-354` (select element block)

- [ ] **Step 1: Write failing test**

Create `tests/unit/records-exercise-autocomplete.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'it' },
    }),
}))

vi.mock('next/navigation', () => ({
    useParams: () => ({ id: 'trainee-1' }),
    useRouter: () => ({ push: vi.fn() }),
}))

// Minimal fetch mock — component fetches on mount, return empty data
global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { items: [] } }),
})

describe('TraineeRecordsContent modal exercise field', () => {
    it('renders an input field (AutocompleteSearch) not a native select for exercise', async () => {
        const { default: TraineeRecordsContent } = await import(
            '@/app/trainer/trainees/[id]/records/_content'
        )

        const { container } = render(<TraineeRecordsContent />)

        // Open modal — find "Aggiungi Massimale" button and click
        const addBtn = await screen.findByRole('button', { name: /aggiungi massimale/i })
        addBtn.click()

        // After modal opens, there must be NO native <select> for exercise
        expect(container.querySelector('select')).toBeNull()

        // AutocompleteSearch renders an <input> inside the exercise field
        const exerciseInput = screen.getByLabelText(/personalRecords\.exercise/i)
        expect(exerciseInput.tagName).toBe('INPUT')
    })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/unit/records-exercise-autocomplete.test.tsx
```

Expected: FAIL — `container.querySelector('select')` finds an element (native select present).

- [ ] **Step 3: Add AutocompleteSearch import to _content.tsx**

In `src/app/trainer/trainees/[id]/records/_content.tsx`, update the import block (around line 14-16):

```tsx
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'
import AutocompleteSearch, { type AutocompleteOption } from '@/components/AutocompleteSearch'
```

- [ ] **Step 4: Replace the native select element (lines ~337-354)**

Replace this block:

```tsx
<select
    value={selectedExerciseId}
    onChange={(e) => setSelectedExerciseId(e.target.value)}
    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
    required
    disabled={!!editingRecord}
>
    {exercises.map((ex) => (
        <option key={ex.id} value={ex.id}>
            {ex.name} ({ex.type === 'fundamental' ? t('exercises.fundamental') : t('exercises.accessory')})
        </option>
    ))}
</select>
{editingRecord && (
    <p className="text-xs text-gray-500 mt-1">
        {t('personalRecords.cannotChangeExercise')}
    </p>
)}
```

with:

```tsx
<AutocompleteSearch
    options={exercises.map((ex): AutocompleteOption => ({
        id: ex.id,
        label: ex.name,
        sublabel: ex.type === 'fundamental' ? t('exercises.fundamental') : t('exercises.accessory'),
    }))}
    value={selectedExerciseId}
    onSelect={(opt) => setSelectedExerciseId(opt?.id ?? '')}
    placeholder={t('personalRecords.searchExercise', { defaultValue: 'Cerca esercizio...' })}
    disabled={!!editingRecord}
    required
/>
{editingRecord && (
    <p className="text-xs text-gray-500 mt-1">
        {t('personalRecords.cannotChangeExercise')}
    </p>
)}
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npx vitest run tests/unit/records-exercise-autocomplete.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/trainer/trainees/[id]/records/_content.tsx tests/unit/records-exercise-autocomplete.test.tsx
git commit -m "feat: replace native select with AutocompleteSearch in records modal exercise field"
```
