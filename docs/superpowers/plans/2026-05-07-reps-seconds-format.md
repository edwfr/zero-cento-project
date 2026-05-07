# Reps Seconds Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow trainers to enter `30"` (number + double-quote) in the REP field to denote time-based exercises measured in seconds.

**Architecture:** The `reps` field on `WorkoutExercise` is already a `String` in the DB — no migration needed. Three touch points: (1) Zod schema for API validation, (2) in-page regex validation in the edit UI, (3) i18n strings for placeholder/error messages. Existing numeric parsers (`/^\d+/`) already strip the `"` suffix correctly, so volume and 1RM calculations require no changes.

**Tech Stack:** Zod, TypeScript, react-i18next (locale JSON files), Vitest

---

### Task 1: Failing tests for seconds format

**Files:**
- Modify: `tests/unit/schemas.test.ts`

- [ ] **Step 1: Add failing tests**

In `tests/unit/schemas.test.ts`, after the existing `it('accepts reps as drop string', ...)` block (around line 512), add:

```typescript
it('accepts reps as seconds string', () => {
    const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, reps: '30"' })
    expect(result.success).toBe(true)
})

it('accepts reps as single-digit seconds string', () => {
    const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, reps: '5"' })
    expect(result.success).toBe(true)
})

it('rejects invalid seconds format with double quote only', () => {
    const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, reps: '"' })
    expect(result.success).toBe(false)
})

it('rejects double quote suffix without leading digit', () => {
    const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, reps: 'abc"' })
    expect(result.success).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/schemas.test.ts
```

Expected: the two `accepts` tests FAIL (schema doesn't accept `30"` yet); the two `rejects` tests PASS (already rejected by current regex).

---

### Task 2: Update Zod schema

**Files:**
- Modify: `src/schemas/workout-exercise.ts:16-22`

- [ ] **Step 1: Add seconds variant to reps union**

Replace the `reps` field definition (lines 16–22):

```typescript
reps: z.union([
    z.number().int().min(1).max(50),
    z.string().regex(/^\d+$/, 'Numero singolo: "8"'),
    z.string().regex(/^\d+-\d+$/, 'Formato range: "8-10"'),
    z.string().regex(/^\d+\/\d+$/, 'Formato drop: "6/8"'),
    z.string().regex(/^\d+"$/, 'Formato secondi: "30"'),
    z.literal('max'),
]),
```

- [ ] **Step 2: Run schema tests to verify they pass**

```bash
npx vitest run tests/unit/schemas.test.ts
```

Expected: all 4 new tests PASS, no regressions.

- [ ] **Step 3: Commit**

```bash
git add src/schemas/workout-exercise.ts tests/unit/schemas.test.ts
git commit -m "feat(schema): accept seconds format (30\") in reps field"
```

---

### Task 3: Update in-page validation regex

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx:1959`

The edit page has its own client-side validation regex independent of the Zod schema.

- [ ] **Step 1: Update repsPattern**

At line 1959, change:

```typescript
const repsPattern = /^(\d+|\d+-\d+|\d+\/\d+|max)$/
```

to:

```typescript
const repsPattern = /^(\d+|\d+-\d+|\d+\/\d+|\d+"|max)$/
```

- [ ] **Step 2: Run type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx
git commit -m "feat(edit): allow seconds reps format (30\") in row validation"
```

---

### Task 4: Update i18n strings

**Files:**
- Modify: `public/locales/en/trainer.json:495,517`
- Modify: `public/locales/it/trainer.json:495,517`

- [ ] **Step 1: Update English locale**

In `public/locales/en/trainer.json`, update lines 495 and 517:

```json
"repsPlaceholder": "e.g. 8, 8-10, 6/8, 30\", max",
```

```json
"rowValidationReps": "Invalid reps (e.g. 8, 8-10, 6/8, 30\", max)",
```

- [ ] **Step 2: Update Italian locale**

In `public/locales/it/trainer.json`, update lines 495 and 517:

```json
"repsPlaceholder": "Valori ammessi: 8, 8-10, 6/8, 30\", max",
```

```json
"rowValidationReps": "Ripetizioni non valide (es. 8, 8-10, 6/8, 30\", max)",
```

- [ ] **Step 3: Run type-check and unit tests**

```bash
npm run type-check && npm run test:unit
```

Expected: no errors, no regressions.

- [ ] **Step 4: Commit**

```bash
git add public/locales/en/trainer.json public/locales/it/trainer.json
git commit -m "feat(i18n): add seconds reps format (30\") to placeholders and errors"
```

---

## Self-Review

**Spec coverage:**
- ✓ Accept `n"` format in edit UI — Task 3 (regex) + Task 4 (i18n feedback)
- ✓ Accept `n"` in API validation — Task 2 (Zod schema)
- ✓ No DB migration needed — `reps` is already `String`
- ✓ Volume/1RM calcs unaffected — `/^\d+/` strips `"` correctly (verified in `parseRepsValue` and `parseReps`)

**Placeholder scan:** No TBD or incomplete steps.

**Type consistency:** Only regex/string changes, no new types introduced.
