# Allow -n% Weight with Empty Previous Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a trainer to save `-n%` weight on a row whose previous same-exercise row has no weight set — meaning the trainee finds their own weight in the previous set and uses that minus n% in the current set.

**Architecture:** The only blocking code is client-side: `resolveWeightInputForRow()` in `_content.tsx` returns `{ errorCode: 'missing_previous_weight' }` when the previous row has no effective weight, and the save validator then blocks. The fix is to return `{ parsedWeight: { effectiveWeight: null } }` instead (valid data, just unresolvable at plan-creation time). No server or runtime changes are needed: the Zod schema already accepts `percentage_previous` with negative weight, and `calculateEffectiveWeight()` in `calculations.ts` already returns `null` when the base weight is null.

**Tech Stack:** Next.js 15, TypeScript, Vitest

---

## Background: How `-n%` Works

`percentage_previous` (`-n%`) means: take the effective weight of the previous row with the same exercise, multiply by `(1 + n/100)`. With `n = -10`, that is `prev * 0.9`.

When the trainer leaves the previous row's weight blank, there is no effective weight to resolve at plan-creation time — but that is intentional: the trainee will log their own weight for that row during the session, and the next row's effective weight will be resolved then.

Currently the client treats this as an error. The fix allows it.

---

## File Map

| File | Change |
|------|--------|
| `src/app/trainer/programs/[id]/edit/_content.tsx` | (1) Update `effectiveWeightByRowId` type to `number \| null`; (2) In `resolveWeightInputForRow()`, return `effectiveWeight: null` instead of `errorCode: 'missing_previous_weight'`; (3) Remove `'missing_previous_weight'` from save-blocking condition |
| `public/locales/en/trainer.json` | Update `weightModalPreviousMessage` to drop "resolvable weight" language |
| `public/locales/it/trainer.json` | Same in Italian |
| `tests/unit/calculations.test.ts` | Add test: `percentage_previous` with null-weight previous row returns `null` |

---

### Task 1: Confirm runtime calculation already handles null-weight chain

**Files:**
- Modify: `tests/unit/calculations.test.ts`

`calculateEffectiveWeight()` in `calculations.ts` already has `if (baseWeight === null) return null`. This task adds a test to lock that behaviour in before we touch anything else.

- [ ] **Step 1: Write the test**

Open `tests/unit/calculations.test.ts`. Inside the `percentage_previous` describe block, add:

```typescript
it('returns null when previous exercise has weight: null', async () => {
  const previousExercise: WorkoutExercise = {
    id: 'we-prev',
    workoutId: mockWorkoutId,
    exerciseId: mockExerciseId,
    order: 1,
    sets: 3,
    reps: '8',
    weightType: 'absolute',
    weight: null,       // trainer left blank
    targetRpe: null,
    restTime: null,
    isWarmup: false,
    notes: null,
  }

  const currentExercise: WorkoutExercise = {
    id: 'we-curr',
    workoutId: mockWorkoutId,
    exerciseId: mockExerciseId,
    order: 2,
    sets: 3,
    reps: '8',
    weightType: 'percentage_previous',
    weight: -10,        // -10%
    targetRpe: null,
    restTime: null,
    isWarmup: false,
    notes: null,
  }

  vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(previousExercise)

  const result = await calculateEffectiveWeight(currentExercise, mockTraineeId)
  expect(result).toBeNull()
})
```

> **Note:** Adapt field names to match `WorkoutExercise` model used in other tests in the same file — check the existing `percentage_previous` test at approx line 709 for the exact shape.

- [ ] **Step 2: Run test — expect PASS**

```bash
cd /mnt/c/dev-projects/zero-cento-project
npx vitest run tests/unit/calculations.test.ts
```

Expected: all tests PASS (including the new one). If the new test FAILS, `calculateEffectiveWeight` does not yet handle this correctly — investigate `calculations.ts` before proceeding.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/calculations.test.ts
git commit -m "test(calculations): lock in null result for percentage_previous with null-weight base"
```

---

### Task 2: Update types and `resolveWeightInputForRow()` in `_content.tsx`

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx` (approx lines 1820–1940)

- [ ] **Step 1: Read the relevant section**

Open `src/app/trainer/programs/[id]/edit/_content.tsx`. Locate:
1. The type/interface for the return value of `resolveWeightInputForRow` (search for `effectiveWeight` near the function definition, ~line 1820). It looks like one of:
   ```typescript
   // inline inferred, or named:
   type ResolvedWeightInput =
     | { errorCode: string }
     | { parsedWeight: { weightType: WeightType; weight: number; effectiveWeight: number } }
   ```
2. The declaration of `effectiveWeightByRowId` — search for it near the top of the function or in the component body. Likely `Record<string, number>` or similar.

- [ ] **Step 2: Update the return type to allow `null` effectiveWeight**

If there is an explicit type alias, change `effectiveWeight: number` → `effectiveWeight: number | null`:

```typescript
type ResolvedWeightInput =
  | { errorCode: string }
  | { parsedWeight: { weightType: WeightType; weight: number; effectiveWeight: number | null } }
```

Change `effectiveWeightByRowId` declaration from `Record<string, number>` to `Record<string, number | null>`:

```typescript
// Before
const effectiveWeightByRowId: Record<string, number> = {}
// After
const effectiveWeightByRowId: Record<string, number | null> = {}
```

If the types are inferred, TypeScript will guide you with errors after the next step — fix them then.

- [ ] **Step 3: Replace the `missing_previous_weight` error return with valid data**

Find this block (approx line 1924 — the end of the `percentage_previous` branch inside `resolveWeightInputForRow`):

```typescript
if (typeof previousEffectiveWeight !== 'number' || !Number.isFinite(previousEffectiveWeight)) {
    return { errorCode: 'missing_previous_weight' }
}

return {
    parsedWeight: {
        weightType: 'percentage_previous',
        weight: value,
        effectiveWeight: roundWeightValue(previousEffectiveWeight * (1 + value / 100)),
    },
}
```

Replace with:

```typescript
if (typeof previousEffectiveWeight !== 'number' || !Number.isFinite(previousEffectiveWeight)) {
    return {
        parsedWeight: {
            weightType: 'percentage_previous',
            weight: value,
            effectiveWeight: null,
        },
    }
}

return {
    parsedWeight: {
        weightType: 'percentage_previous',
        weight: value,
        effectiveWeight: roundWeightValue(previousEffectiveWeight * (1 + value / 100)),
    },
}
```

- [ ] **Step 4: Run type check and fix any cascade errors**

```bash
cd /mnt/c/dev-projects/zero-cento-project
npm run type-check
```

TypeScript may now complain in places that use `parsedWeight.effectiveWeight` as if it is always a `number`. Common locations:
- Where effective weight is used in arithmetic (add a null guard: `if (effectiveWeight !== null) { ... }`)
- Where it is stored in `effectiveWeightByRowId` (already fixed in Step 2)
- Where it is rendered in the UI preview (see Task 4)

Fix each error. The invariant is: **any code that displays or computes with `effectiveWeight` must guard `!== null` first**.

Expected: `npm run type-check` exits with 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx
git commit -m "fix(workout-edit): return null effectiveWeight instead of error when previous row has no weight"
```

---

### Task 3: Remove `'missing_previous_weight'` from save-blocking condition

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx` (approx lines 2037–2048)

After Task 2, `resolveWeightInputForRow()` never returns `{ errorCode: 'missing_previous_weight' }` anymore. This task cleans up the now-dead condition in the save validator.

- [ ] **Step 1: Find the save-blocking condition**

Search `_content.tsx` for `missing_previous_weight`. It appears in the save validation loop, looking like:

```typescript
if (
    resolvedWeightInput.errorCode === 'missing_previous_occurrence' ||
    resolvedWeightInput.errorCode === 'missing_previous_weight'
) {
    setBlockingWeightErrorModal({
        title: t('editProgram.weightModalPreviousTitle'),
        message: t('editProgram.weightModalPreviousMessage', {
            index: index + 1,
            exercise: exerciseName,
        }),
    })
    return false
}
```

- [ ] **Step 2: Remove the `missing_previous_weight` branch**

```typescript
if (resolvedWeightInput.errorCode === 'missing_previous_occurrence') {
    setBlockingWeightErrorModal({
        title: t('editProgram.weightModalPreviousTitle'),
        message: t('editProgram.weightModalPreviousMessage', {
            index: index + 1,
            exercise: exerciseName,
        }),
    })
    return false
}
```

- [ ] **Step 3: Run type check and unit tests**

```bash
npm run type-check && npm run test:unit
```

Expected: both pass with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx
git commit -m "fix(workout-edit): remove missing_previous_weight save block — case now allowed"
```

---

### Task 4: Guard null effective weight in the edit UI preview

**Files:**
- Modify (if needed): `src/app/trainer/programs/[id]/edit/_content.tsx` (effective weight preview render, approx lines 3640–3670)

The weight field shows a preview like "≈ 72.5 kg" below the input for `percentage_previous` rows. Now that `effectiveWeight` can be `null`, this display must not crash or show garbage.

- [ ] **Step 1: Find the effective weight preview render**

Search `_content.tsx` for where `effectiveWeight` is rendered — look for `≈` or `effectiveWeight` near JSX. It looks like:

```tsx
{resolvedWeight?.effectiveWeight != null && (
    <span className="text-xs text-gray-400">
        ≈ {resolvedWeight.effectiveWeight} kg
    </span>
)}
```

- [ ] **Step 2: Confirm the null guard exists**

If the code already guards `!= null` or `typeof ... === 'number'` before rendering, **no change is needed**. Move on.

If the code renders `effectiveWeight` unconditionally or only checks truthiness (which would wrongly hide `0` kg), add the explicit guard:

```tsx
{typeof resolvedWeight?.effectiveWeight === 'number' && (
    <span className="text-xs text-gray-400">
        ≈ {resolvedWeight.effectiveWeight} kg
    </span>
)}
```

- [ ] **Step 3: Type check**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 4: If a change was made, commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx
git commit -m "fix(workout-edit): guard null effectiveWeight in edit UI weight preview"
```

---

### Task 5: Update i18n error messages

**Files:**
- Modify: `public/locales/en/trainer.json`
- Modify: `public/locales/it/trainer.json`

The error shown for `missing_previous_occurrence` (no previous row at all) currently says something like "must have a previous row with a resolvable weight." Remove "resolvable weight" — now the only requirement is that a previous row exists.

- [ ] **Step 1: Find keys in `public/locales/en/trainer.json`**

Search for `weightModalPreviousMessage`. Read the current value. It will say something like:

```json
"weightModalPreviousMessage": "Row {{index}} ({{exercise}}): to use -n%, the same workout must already contain a previous row of the same exercise with a resolvable weight."
```

- [ ] **Step 2: Update English message**

Remove the "with a resolvable weight" qualifier:

```json
"weightModalPreviousMessage": "Row {{index}} ({{exercise}}): to use -n%, the same workout must already contain a previous row of the same exercise."
```

Leave `weightModalPreviousTitle` unchanged.

- [ ] **Step 3: Update Italian message in `public/locales/it/trainer.json`**

Find `weightModalPreviousMessage` in the Italian file. Current value likely ends with something like "con un peso risolvibile" (with a resolvable weight). Remove that qualifier:

```json
"weightModalPreviousMessage": "Riga {{index}} ({{exercise}}): per usare -n%, lo stesso allenamento deve già contenere una riga precedente dello stesso esercizio."
```

Verify the current Italian text first and adjust accordingly — preserve the rest of the sentence exactly.

- [ ] **Step 4: Run unit tests**

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/locales/en/trainer.json public/locales/it/trainer.json
git commit -m "fix(i18n): update -n% error message — only missing row is blocked, not unresolved weight"
```

---

### Task 6: Changelog

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Add entry**

Append under `## [Unreleased]`:

```markdown
### Fixed
- Workout edit: trainer can now save `-n%` weight on a row whose previous same-exercise row has no weight set. At runtime the trainee finds their own weight for the previous set; the current set applies the percentage offset to that logged weight. Previously this was blocked with a validation error on save.
```

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog for -n% allowed when previous row has no weight"
```

---

## Self-Review

**Spec coverage:**
- [x] Allow `-n%` when previous row has no weight → Tasks 2 + 3 (client validation removed)
- [x] If previous row HAS weight, calculation unchanged → Task 2 (`roundWeightValue(prev * (1 + value/100))` path untouched)
- [x] No server-side change needed → confirmed in exploration: Zod schema already accepts `percentage_previous` with negative weight; no server-side check for previous row's weight
- [x] Runtime null cascade correct → Task 1 (test confirms `calculateEffectiveWeight` returns `null`)
- [x] UI does not crash on null effectiveWeight → Task 4
- [x] Error message updated for remaining blocked case → Task 5

**Placeholder scan:** No TBDs. All code blocks complete. Step 3 in Task 5 includes "verify current Italian text" — this is correct, not a placeholder: the engineer must read the current value before overwriting.

**Type consistency:** `effectiveWeight: number | null` introduced in Task 2 Step 2; guarded everywhere downstream in Tasks 2 Step 4 and Task 4 Step 2.
