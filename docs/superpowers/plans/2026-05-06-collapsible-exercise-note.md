# Collapsible Exercise Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Nota Esercizio (opzionale)" section in `ExerciseFocusCard` collapsible/expandable with a chevron toggle icon in the top-right of its header.

**Architecture:** Add local `noteExpanded` boolean state to `ExerciseFocusCard`. Default collapsed when no saved note, expanded when saved note exists. The section header becomes a full-width button with label on left and chevron on right; textarea + save button render conditionally. Add `key={currentExercise.id}` on the render site so state resets on exercise navigation.

**Tech Stack:** React `useState`, Tailwind CSS, `ChevronUp`/`ChevronDown` from lucide-react (already imported), Vitest + Testing Library.

---

### Task 1: Write failing tests for collapsible note behavior

**Files:**
- Modify: `tests/unit/trainee-workout-focus.test.tsx`

- [ ] **Step 1: Add three failing tests at the end of the describe block**

Append inside `describe('Trainee workout focus mode', ...)` in `tests/unit/trainee-workout-focus.test.tsx`:

```tsx
it('exercise note section is collapsed by default when no saved note', async () => {
    await renderContent()
    // textarea hidden when collapsed
    expect(
        screen.queryByPlaceholderText(/workouts\.exerciseNotePlaceholder/i)
    ).not.toBeInTheDocument()
    // header toggle button visible
    expect(
        screen.getByRole('button', { name: /workouts\.exerciseNoteLabel/i })
    ).toBeInTheDocument()
})

it('exercise note section expands when header button is clicked', async () => {
    const user = userEvent.setup()
    await renderContent()
    const toggleBtn = screen.getByRole('button', { name: /workouts\.exerciseNoteLabel/i })
    await user.click(toggleBtn)
    expect(
        screen.getByPlaceholderText(/workouts\.exerciseNotePlaceholder/i)
    ).toBeInTheDocument()
})

it('exercise note section collapses again after a second click on the header', async () => {
    const user = userEvent.setup()
    await renderContent()
    const toggleBtn = screen.getByRole('button', { name: /workouts\.exerciseNoteLabel/i })
    await user.click(toggleBtn)
    await user.click(toggleBtn)
    expect(
        screen.queryByPlaceholderText(/workouts\.exerciseNotePlaceholder/i)
    ).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx
```

Expected: 3 new tests fail (textarea always visible in current impl, no toggle button).

---

### Task 2: Implement collapsible state in ExerciseFocusCard

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx`
  - `ExerciseFocusCard` function: lines ~776–1054
  - `ExerciseFocusCard` render site: line ~667

- [ ] **Step 3: Add `noteExpanded` local state to `ExerciseFocusCard`**

In `function ExerciseFocusCard({ ... }: ExerciseFocusCardProps) {`, after line 792 (closing of destructure), add:

```tsx
const [noteExpanded, setNoteExpanded] = useState(!!savedNote)
```

`useState` is already imported at the top of the file.

- [ ] **Step 4: Replace the static exercise note section with a collapsible one**

Replace lines 1023–1051 (the `{/* Exercise note */}` block):

**Before:**
```tsx
            {/* Exercise note */}
            <div className="border-t border-gray-200 p-4 sm:p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('workouts.exerciseNoteLabel')}
                </label>
                <textarea
                    value={exerciseNote}
                    onChange={(e) => onUpdateNote(e.target.value)}
                    placeholder={t('workouts.exerciseNotePlaceholder')}
                    rows={2}
                    maxLength={1000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                />
                <div className="mt-2 flex justify-end">
                    <button
                        type="button"
                        onClick={onSaveNote}
                        disabled={exerciseNote === savedNote || isNoteSaving}
                        className={`inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                            exerciseNote === savedNote || isNoteSaving
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-brand-primary text-white hover:bg-brand-primary-hover'
                        }`}
                    >
                        {isNoteSaving && <LoadingSpinner size="sm" color="gray" />}
                        {t('workouts.saveNote')}
                    </button>
                </div>
            </div>
```

**After:**
```tsx
            {/* Exercise note — collapsible */}
            <div className="border-t border-gray-200">
                <button
                    type="button"
                    onClick={() => setNoteExpanded((prev) => !prev)}
                    aria-expanded={noteExpanded}
                    className="w-full flex items-center justify-between px-4 py-3 sm:px-6"
                >
                    <span className="text-sm font-semibold text-gray-700">
                        {t('workouts.exerciseNoteLabel')}
                    </span>
                    {noteExpanded
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {noteExpanded && (
                    <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                        <textarea
                            value={exerciseNote}
                            onChange={(e) => onUpdateNote(e.target.value)}
                            placeholder={t('workouts.exerciseNotePlaceholder')}
                            rows={2}
                            maxLength={1000}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                        />
                        <div className="mt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={onSaveNote}
                                disabled={exerciseNote === savedNote || isNoteSaving}
                                className={`inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                                    exerciseNote === savedNote || isNoteSaving
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-brand-primary text-white hover:bg-brand-primary-hover'
                                }`}
                            >
                                {isNoteSaving && <LoadingSpinner size="sm" color="gray" />}
                                {t('workouts.saveNote')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
```

- [ ] **Step 5: Add `key` prop to the `ExerciseFocusCard` render site**

At line ~667, change:
```tsx
                        <ExerciseFocusCard
                            we={currentExercise}
```
to:
```tsx
                        <ExerciseFocusCard
                            key={currentExercise.id}
                            we={currentExercise}
```

This forces a remount on exercise navigation so `noteExpanded` resets to `!!savedNote` for the new exercise.

- [ ] **Step 6: Run the tests**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx
```

Expected: all tests pass, including the 3 new ones.

- [ ] **Step 7: Run type check and full unit suite**

```bash
npm run type-check && npm run test:unit
```

Expected: no type errors, all unit tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/trainee/workouts/\[id\]/_content.tsx tests/unit/trainee-workout-focus.test.tsx
git commit -m "feat(workout): collapsible exercise note section with chevron toggle"
```

---

### Task 3: Update changelog

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 9: Add changelog entry**

Prepend to `implementation-docs/CHANGELOG.md`:

```markdown
## [Unreleased]

### Changed
- `ExerciseFocusCard`: "Nota Esercizio (opzionale)" section is now collapsible. Collapsed by default; expanded if a saved note exists. Toggle button in header row with ChevronUp/ChevronDown icon.
```

- [ ] **Step 10: Commit changelog**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog for collapsible exercise note"
```

---

## Self-Review

**Spec coverage:**
- ✅ Collapsible/expandable section — Task 2, Step 4
- ✅ Toggle icon top-right — Step 4 (chevron right-aligned via flex justify-between)
- ✅ Default state: collapsed (no note) / expanded (has note) — Step 3
- ✅ State resets on exercise navigation — Step 5 (`key` prop)

**Placeholder scan:** None. All steps contain exact code.

**Type consistency:** `noteExpanded: boolean`, `setNoteExpanded: Dispatch<SetStateAction<boolean>>`. Only used in Task 2 — no cross-task type dependencies.
