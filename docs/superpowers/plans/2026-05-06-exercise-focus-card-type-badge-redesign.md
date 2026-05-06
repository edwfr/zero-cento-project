# Exercise Focus Card — Type Badge Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move exercise type (fundamental/accessory) from the name row to the rest row in `ExerciseFocusCard`, showing full translated text instead of "F"/"A" abbreviations, and lowercase the "Rest:" label.

**Architecture:** Pure UI change — two JSX edits in `_content.tsx`, two translation file edits. Two existing unit tests must be updated to match new badge text (keys returned by mock `t()`).

**Tech Stack:** React, Tailwind CSS, react-i18next, Vitest + Testing Library

---

### Task 1: Update unit tests to match new badge behavior

**Files:**
- Modify: `tests/unit/trainee-workout-focus.test.tsx:190-205`

The global `t` mock in `tests/unit/setup.ts` returns the key as-is, so after the change the badge will render `'trainer:exercises.fundamental'` and `'trainer:exercises.accessory'` in tests.

- [ ] **Step 1: Update the fundamental badge test**

In `tests/unit/trainee-workout-focus.test.tsx`, replace lines 190-195:

```tsx
it('shows full fundamental label in the rest row', async () => {
    await renderContent()

    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('trainer:exercises.fundamental')).toBeInTheDocument()
    // Badge no longer uses abbreviated 'F'
    expect(screen.queryByText('F')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Update the accessory badge test**

In `tests/unit/trainee-workout-focus.test.tsx`, replace lines 197-205:

```tsx
it('shows full accessory label in the rest row', async () => {
    const user = userEvent.setup()
    await renderContent()

    await user.click(screen.getByRole('button', { name: /next|avanti/i }))

    expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
    expect(screen.getByText('trainer:exercises.accessory')).toBeInTheDocument()
    // Badge no longer uses abbreviated 'A'
    expect(screen.queryByText('A')).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Run updated tests — expect them to FAIL**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx
```

Expected: both updated tests FAIL (component still renders "F"/"A").

---

### Task 2: Update translation files — lowercase "rest"

**Files:**
- Modify: `public/locales/en/trainee.json`
- Modify: `public/locales/it/trainee.json`

Both files have `"rest": "Rest"` inside the `workouts` namespace.

- [ ] **Step 1: Update English locale**

In `public/locales/en/trainee.json`, find and change:
```json
"rest": "Rest"
```
to:
```json
"rest": "rest"
```

- [ ] **Step 2: Update Italian locale**

In `public/locales/it/trainee.json`, find and change:
```json
"rest": "Rest"
```
to:
```json
"rest": "rest"
```

- [ ] **Step 3: Commit translations**

```bash
git add public/locales/en/trainee.json public/locales/it/trainee.json
git commit -m "fix(i18n): lowercase rest label in exercise focus card"
```

---

### Task 3: Implement component changes in ExerciseFocusCard

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx:822-849`

The `ExerciseFocusCard` component starts at line 776. The header section renders the type badge alongside the exercise name (~line 827-835), and the rest row is at ~line 843-849.

- [ ] **Step 1: Remove type badge from header row and simplify h2**

In `src/app/trainee/workouts/[id]/_content.tsx`, replace the header name block (lines ~826-839):

```tsx
// BEFORE
<div className="flex flex-wrap items-center gap-2 mb-1">
    <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${we.exercise.type === 'fundamental'
            ? 'bg-red-100 text-red-700'
            : 'bg-blue-100 text-blue-700'
            }`}
    >
        {we.exercise.type === 'fundamental' ? 'F' : 'A'}
    </span>
    <h2 className="text-2xl font-bold text-gray-900">
        {we.exercise.name}
    </h2>
</div>
```

```tsx
// AFTER
<h2 className="text-2xl font-bold text-gray-900 mb-1">
    {we.exercise.name}
</h2>
```

- [ ] **Step 2: Add full-text type pill to rest row**

In the same file, replace the rest row div (lines ~843-849):

```tsx
// BEFORE
<div className="flex flex-wrap gap-1.5">
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Clock3 className="w-3 h-3" />
        <span className="font-semibold">{t('workouts.rest')}:</span>
        {formatRestTime(we.restTime)}
    </span>
</div>
```

```tsx
// AFTER
<div className="flex flex-wrap gap-1.5">
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Clock3 className="w-3 h-3" />
        <span className="font-semibold">{t('workouts.rest')}:</span>
        {formatRestTime(we.restTime)}
    </span>
    <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
            we.exercise.type === 'fundamental'
                ? 'border-red-200 bg-red-100 text-red-700'
                : 'border-blue-200 bg-blue-100 text-blue-700'
        }`}
    >
        {we.exercise.type === 'fundamental'
            ? t('trainer:exercises.fundamental')
            : t('trainer:exercises.accessory')}
    </span>
</div>
```

- [ ] **Step 3: Run tests — expect them to PASS**

```bash
npx vitest run tests/unit/trainee-workout-focus.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 4: Run full unit test suite**

```bash
npm run test:unit
```

Expected: all tests PASS.

- [ ] **Step 5: Commit component change**

```bash
git add src/app/trainee/workouts/[id]/_content.tsx tests/unit/trainee-workout-focus.test.tsx
git commit -m "feat(trainee/workout): move exercise type badge to rest row with full label"
```

---

### Task 4: Update changelog

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Add entry**

Prepend to `implementation-docs/CHANGELOG.md`:

```markdown
## 2026-05-06 — Exercise focus card: type badge moved to rest row

Moved the fundamental/accessory type indicator from the exercise name row to the rest-time row in `ExerciseFocusCard`. Badge now shows full translated label ("Fondamentale"/"Accessorio") instead of single-letter abbreviation. "Rest:" label lowercased to "rest:".

Files: `src/app/trainee/workouts/[id]/_content.tsx`, `public/locales/*/trainee.json`, `tests/unit/trainee-workout-focus.test.tsx`
```

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog for exercise focus card type badge redesign"
```
