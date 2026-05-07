# Compact Workout Edit Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/trainer/programs/[id]/edit` exercise table more compact (spreadsheet-like) and constrain keyboard Tab navigation to only the 5 metric input fields: sets, reps, RPE, weight, rest.

**Architecture:** Two independent changes to `_content.tsx`: (1) reduce all `py-3` row padding to `py-1` and input heights from `h-9` to `h-7`; (2) add `tabIndex={-1}` to non-metric fields (drag handle, warmup checkbox, exercise selector, variant selector, action buttons). AutocompleteSearch needs a new `tabIndex` prop before the tab-order change can be applied to exercise/variant selectors.

**Tech Stack:** Next.js 15, React, Tailwind CSS, Vitest + jsdom, `@dnd-kit/sortable`

---

## File Map

| File | Change |
|------|--------|
| `src/components/AutocompleteSearch.tsx` | Add `tabIndex` prop to interface, forward to internal `<Input>` |
| `src/app/trainer/programs/[id]/edit/_content.tsx` | Reduce spacing; add `tabIndex={-1}` to non-metric fields |
| `tests/unit/AutocompleteSearch.test.tsx` | New: test `tabIndex` prop forwarding |

---

### Task 1: Add `tabIndex` Prop to AutocompleteSearch

**Files:**
- Modify: `src/components/AutocompleteSearch.tsx`
- Create: `tests/unit/AutocompleteSearch.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/AutocompleteSearch.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AutocompleteSearch from '@/components/AutocompleteSearch'

const options = [{ id: '1', label: 'Squat' }]

describe('AutocompleteSearch', () => {
  it('forwards tabIndex to the internal input', () => {
    render(
      <AutocompleteSearch
        options={options}
        onSelect={vi.fn()}
        tabIndex={-1}
      />
    )
    const input = screen.getByRole('combobox')
    expect(input).toHaveAttribute('tabIndex', '-1')
  })

  it('leaves tabIndex unset when not provided', () => {
    render(<AutocompleteSearch options={options} onSelect={vi.fn()} />)
    const input = screen.getByRole('combobox')
    // no explicit tabIndex attribute — browser default (0)
    expect(input).not.toHaveAttribute('tabIndex', '-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /mnt/c/dev-projects/zero-cento-project
npx vitest run tests/unit/AutocompleteSearch.test.tsx
```

Expected: FAIL — `tabIndex` prop does not exist in props interface.

- [ ] **Step 3: Add `tabIndex` prop to `AutocompleteSearch`**

In `src/components/AutocompleteSearch.tsx`, update the props interface (currently lines 14–30):

```typescript
interface AutocompleteSearchProps {
    options: AutocompleteOption[]
    value?: string
    onSelect: (option: AutocompleteOption | null) => void
    onSearch?: (query: string) => void
    label?: string
    placeholder?: string
    loading?: boolean
    disabled?: boolean
    required?: boolean
    error?: string
    emptyMessage?: string
    className?: string
    id?: string
    inputStyle?: CSSProperties
    accentColor?: string
    tabIndex?: number   // <-- add this line
}
```

Then destructure it in the function signature and forward it to the internal `<Input>`:

```tsx
// In the function signature, add tabIndex to destructured props:
function AutocompleteSearch({
    // ...existing props...
    tabIndex,
}: AutocompleteSearchProps) {

// In the <Input> render (currently lines 162–186), add:
    <Input
        // ...existing props...
        tabIndex={tabIndex}
    />
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/AutocompleteSearch.test.tsx
```

Expected: PASS — both test cases green.

- [ ] **Step 5: Commit**

```bash
git add src/components/AutocompleteSearch.tsx tests/unit/AutocompleteSearch.test.tsx
git commit -m "feat(autocomplete): add tabIndex prop forwarding to AutocompleteSearch"
```

---

### Task 2: Reduce Exercise Row Vertical Density

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`

> No behavioral unit test for pure CSS class changes. Verify visually with dev server after committing.

- [ ] **Step 1: Reduce `<td>` padding from `py-3` to `py-1`**

There are 9 `<td>` cells per exercise row, all with `py-3`. Do a targeted replace only inside the SortableExerciseRow render (approx lines 3420–3700). Change each occurrence:

| Current | Replace with |
|---------|-------------|
| `"w-6 px-0.5 py-3 align-middle"` | `"w-6 px-0.5 py-1 align-middle"` |
| `"px-1 py-3 align-middle"` | `"px-1 py-1 align-middle"` |
| `"px-1 py-3"` | `"px-1 py-1"` |

There are multiple `"px-1 py-3"` occurrences — replace ALL of them (they are all exercise row `<td>` cells). Use find-replace across the exercise row render block.

- [ ] **Step 2: Reduce metric input heights from `h-9` to `h-7`**

The shared constant `metricFieldClassName` (approx line 3362) controls Sets, RPE, Weight, Rest inputs:

```typescript
// Before
const metricFieldClassName =
  'h-9 w-full rounded-lg border border-gray-300 px-1.5 text-left text-sm leading-5 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-gray-50 disabled:text-gray-400'

// After
const metricFieldClassName =
  'h-7 w-full rounded-lg border border-gray-300 px-1.5 text-left text-sm leading-5 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-gray-50 disabled:text-gray-400'
```

- [ ] **Step 3: Reduce Reps field height from `h-9` to `h-7`**

The reps `<Input>` has its own inline className (approx line 3583). Change:

```tsx
// Before
'h-9 w-16 rounded-lg border border-gray-300 px-1.5 text-center text-sm leading-5 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-gray-50 disabled:text-gray-400'

// After
'h-7 w-16 rounded-lg border border-gray-300 px-1.5 text-center text-sm leading-5 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-gray-50 disabled:text-gray-400'
```

- [ ] **Step 4: Reduce Rest selector vertical padding from `py-2` to `py-1`**

The rest `<select>` (approx line 3680) has `py-2` in its className. Change:

```tsx
// Before
'w-full rounded-lg border border-gray-300 px-1.5 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary'

// After
'w-full rounded-lg border border-gray-300 px-1.5 py-1 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary'
```

- [ ] **Step 5: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx
git commit -m "style(workout-edit): reduce exercise row density to spreadsheet-like layout"
```

---

### Task 3: Constrain Tab Order to Metric Fields

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`

Only these 5 fields should receive Tab focus: **sets, reps, RPE, weight, rest**. All other interactive elements in each row get `tabIndex={-1}`.

- [ ] **Step 1: Add `tabIndex={-1}` to drag handle**

The drag handle is rendered by spreading `dragHandleProps` (which comes from `{ ...attributes, ...listeners }` of `useSortable`). The `attributes` object includes `tabIndex: 0` by default. Override it by explicitly passing `tabIndex={-1}` **after** the spread:

```tsx
// Find the drag handle element (approx line 3425), currently:
<button type="button" {...dragHandleProps} className="...">
  <GripVertical ... />
</button>

// Change to:
<button type="button" {...dragHandleProps} tabIndex={-1} className="...">
  <GripVertical ... />
</button>
```

- [ ] **Step 2: Add `tabIndex={-1}` to warmup checkbox**

Find the warmup checkbox `<input type="checkbox">` (approx line 3440–3453). Add `tabIndex={-1}`:

```tsx
// Before:
<input
  type="checkbox"
  checked={row.isWarmup}
  onChange={...}
  className="..."
/>

// After:
<input
  type="checkbox"
  checked={row.isWarmup}
  onChange={...}
  tabIndex={-1}
  className="..."
/>
```

- [ ] **Step 3: Add `tabIndex={-1}` to Exercise AutocompleteSearch**

Find the exercise `<AutocompleteSearch>` (approx line 3456):

```tsx
// Before:
<AutocompleteSearch
  options={...}
  value={...}
  onSelect={...}
  // ...other props
/>

// After:
<AutocompleteSearch
  options={...}
  value={...}
  onSelect={...}
  tabIndex={-1}
  // ...other props
/>
```

- [ ] **Step 4: Add `tabIndex={-1}` to Variant field**

The variant field is either an `<AutocompleteSearch>` or a custom `<Input>` depending on `isSkeletonExercise` (approx lines 3479–3555). Add `tabIndex={-1}` to **both** branches:

```tsx
// AutocompleteSearch branch:
<AutocompleteSearch
  // ...existing props
  tabIndex={-1}
/>

// Input branch (custom variant input):
<Input
  // ...existing props
  tabIndex={-1}
/>
```

- [ ] **Step 5: Add `tabIndex={-1}` to action buttons (delete, notes toggle)**

Find the action cell `<td>` containing delete button and any notes/info toggle buttons (approx lines 3693–3730). Add `tabIndex={-1}` to each button:

```tsx
<button type="button" tabIndex={-1} onClick={...} className="...">
  {/* delete icon */}
</button>

// If there is a notes toggle button:
<button type="button" tabIndex={-1} onClick={...} className="...">
  {/* notes icon */}
</button>
```

- [ ] **Step 6: Verify sets, reps, RPE, weight, rest have no explicit negative tabIndex**

Confirm these elements have **no** `tabIndex={-1}` set (they rely on natural DOM tab order = 0):
- Sets `<Input>` (uses `metricFieldClassName`)
- Reps `<Input>` (inline class with `h-7 w-16 ...`)
- RPE `<select>` (approx line 3589)
- Weight `<Input>` (uses `metricFieldClassName`)
- Rest `<select>` (approx line 3680)

All five should be focusable via Tab.

- [ ] **Step 7: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx
git commit -m "feat(workout-edit): constrain tab order to sets/reps/rpe/weight/rest fields"
```

---

### Task 4: Update Changelog

- [ ] **Step 1: Add changelog entry**

Append to `implementation-docs/CHANGELOG.md`:

```markdown
## [Unreleased]

### Changed
- Workout edit screen: reduced exercise row vertical padding (`py-3` → `py-1`) and input heights (`h-9` → `h-7`) for a denser, spreadsheet-like layout
- Workout edit screen: Tab key now cycles only through metric fields (sets, reps, RPE, weight, rest) — drag handle, warmup checkbox, exercise name, variant, and action buttons excluded from tab order
- `AutocompleteSearch`: added optional `tabIndex` prop forwarded to internal input
```

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog for compact workout edit + tab order constraint"
```

---

## Self-Review

**Spec coverage:**
- [x] Reduce vertical spacing between exercise rows → Task 2 (py-3→py-1, h-9→h-7)
- [x] Compact spreadsheet-like layout → Task 2
- [x] Tab moves only between sets/reps/RPE/weight/rest → Tasks 1 + 3
- [x] AutocompleteSearch tabIndex prerequisite → Task 1

**Placeholder scan:** No TBDs, no "implement later", all code blocks complete.

**Type consistency:** `tabIndex?: number` added to `AutocompleteSearchProps`; same prop name used in Task 3 step 3/4.
