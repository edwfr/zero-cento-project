# Postural Exercise Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third exercise type `postural` ("Posturale") and centralize all exercise-type knowledge (list, labels, badge colors, sort order) in one type-checked module.

**Architecture:** Prisma enum gets `postural`. A new `src/lib/exercise-type.ts` exports `EXERCISE_TYPES`, the `ExerciseType` union, and a `Record<ExerciseType, ExerciseTypeMeta>` map, with a compile-time guard against drift from the Prisma enum. Two small presentational components (`ExerciseTypeBadge`, `ExerciseTypeRadioGroup`) consume the map; every hand-written `'fundamental' | 'accessory'` union, ternary and switch in the app is replaced with the module / components.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), Zod, react-i18next, Tailwind, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-19-postural-exercise-type-design.md`

## Global Constraints

- Postural is a pure category: same prescription as accessory, excluded from SBD/fundamental-only logic (every `=== 'fundamental'` check in `program-sbd-metrics.ts`, `ProgramMuscleGroupCharts.tsx`, `api/users/[id]/reports/planned-training-sets/route.ts`, `trainer/programs/[id]/workouts/[wId]/_content.tsx:337` stays unchanged).
- Short letters: F / A / P. Sort order: fundamental 1, accessory 2, postural 3. Default in create forms: `accessory`.
- Badge classes (exact): fundamental `border-red-200 bg-red-100 text-red-800`; accessory `border-blue-200 bg-blue-100 text-blue-800`; postural `border-emerald-200 bg-emerald-100 text-emerald-800`.
- `src/lib/exercise-type.ts` must only `import type` from `@prisma/client` (it is imported by client components).
- i18n: canonical keys live at top level of `common.json` under `exerciseTypes`; referenced with full namespace, e.g. `common:exerciseTypes.postural.label`.
- In unit tests `t` is mocked to return the key unchanged (`tests/unit/setup.ts`), so assertions compare against key strings.
- Per CLAUDE.md: add an entry to `implementation-docs/CHANGELOG.md` (Italian, same format as existing entries) — done in the final task.

## Deviations from spec (decided while planning)

- `abbrevKey` dropped (YAGNI): the only consumer (`trainee:records.tagFundamental` "Fond.") was an `aria-label`; the badge component now uses the full label for `title`/`aria-label`.
- Added `formLabelKey` to meta so the create/edit radio for fundamental keeps its "Fondamentale (SBD)" label.
- Added two components, `ExerciseTypeBadge` and `ExerciseTypeRadioGroup`, to remove ~15 copies of the same badge markup and 2 copies of the radio group.

## File map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | add `postural` to `ExerciseType` |
| `prisma/migrations/20260919000000_add_postural_exercise_type/migration.sql` | new – `ALTER TYPE` |
| `src/lib/exercise-type.ts` | new – single source of truth |
| `src/components/ExerciseTypeBadge.tsx` | new – colored badge, `short` or `label` variant |
| `src/components/ExerciseTypeRadioGroup.tsx` | new – radio group for create/edit forms |
| `src/schemas/exercise.ts` | Zod enums from `EXERCISE_TYPES` |
| `public/locales/{en,it}/common.json` | new `exerciseTypes` keys |
| `public/locales/{en,it}/{trainer,trainee}.json` | remove superseded keys (last task) |
| ~30 consumer files | use module/components |

---

### Task 1: Prisma enum, migration, core module, i18n keys

**Files:**
- Modify: `prisma/schema.prisma:25-28`
- Create: `prisma/migrations/20260919000000_add_postural_exercise_type/migration.sql`
- Create: `src/lib/exercise-type.ts`
- Modify: `public/locales/it/common.json`, `public/locales/en/common.json`
- Modify: `vitest.config.ts` (coverage include list)
- Test: `tests/unit/exercise-type.test.ts`

**Interfaces:**
- Produces:
  - `EXERCISE_TYPES: readonly ['fundamental', 'accessory', 'postural']`
  - `type ExerciseType = 'fundamental' | 'accessory' | 'postural'`
  - `interface ExerciseTypeMeta { labelKey: string; pluralKey: string; shortKey: string; formLabelKey: string; badgeClass: string; sortOrder: number }`
  - `EXERCISE_TYPE_META: Record<ExerciseType, ExerciseTypeMeta>`
  - `DEFAULT_EXERCISE_TYPE: ExerciseType` (= `'accessory'`)
  - `isExerciseType(value: unknown): value is ExerciseType`
  - `compareExerciseType(a: string | null | undefined, b: string | null | undefined): number` (unknown/missing types sort last)

- [ ] **Step 1: Add enum value to Prisma schema**

In `prisma/schema.prisma` replace:

```prisma
enum ExerciseType {
  fundamental  // Squat, Bench, Deadlift
  accessory    // Assistenza e complementari
}
```

with:

```prisma
enum ExerciseType {
  fundamental  // Squat, Bench, Deadlift
  accessory    // Assistenza e complementari
  postural     // Posturali, mobilità, core
}
```

- [ ] **Step 2: Write the migration by hand** (same folder naming as `20260916000000_add_exercise_update_audit`)

`prisma/migrations/20260919000000_add_postural_exercise_type/migration.sql`:

```sql
-- AlterEnum
ALTER TYPE "ExerciseType" ADD VALUE 'postural';
```

- [ ] **Step 3: Regenerate Prisma client**

Run: `npm run prisma:generate`
Expected: "Generated Prisma Client". Do NOT run `prisma migrate dev` against a shared DB without asking the user; applying to the dev DB is the user's call.

- [ ] **Step 4: Add i18n keys**

In `public/locales/it/common.json` add a top-level key (sibling of `"common"`, `"roles"`…):

```json
"exerciseTypes": {
    "fundamental": { "label": "Fondamentale", "plural": "Fondamentali", "short": "F" },
    "accessory": { "label": "Accessorio", "plural": "Accessori", "short": "A" },
    "postural": { "label": "Posturale", "plural": "Posturali", "short": "P" }
}
```

In `public/locales/en/common.json`:

```json
"exerciseTypes": {
    "fundamental": { "label": "Fundamental", "plural": "Fundamentals", "short": "F" },
    "accessory": { "label": "Accessory", "plural": "Accessories", "short": "A" },
    "postural": { "label": "Postural", "plural": "Postural", "short": "P" }
}
```

Validate JSON: `node -e "require('./public/locales/it/common.json');require('./public/locales/en/common.json')"` → no output.

- [ ] **Step 5: Write the failing test**

`tests/unit/exercise-type.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
    EXERCISE_TYPES,
    EXERCISE_TYPE_META,
    DEFAULT_EXERCISE_TYPE,
    isExerciseType,
    compareExerciseType,
} from '@/lib/exercise-type'

describe('exercise-type', () => {
    it('lists the three types in display order', () => {
        expect(EXERCISE_TYPES).toEqual(['fundamental', 'accessory', 'postural'])
    })

    it('has complete metadata for every type', () => {
        for (const type of EXERCISE_TYPES) {
            const meta = EXERCISE_TYPE_META[type]
            expect(meta.labelKey).toBe(`common:exerciseTypes.${type}.label`)
            expect(meta.pluralKey).toBe(`common:exerciseTypes.${type}.plural`)
            expect(meta.shortKey).toBe(`common:exerciseTypes.${type}.short`)
            expect(meta.formLabelKey).toBeTruthy()
            expect(meta.badgeClass).toMatch(/^border-\w+-200 bg-\w+-100 text-\w+-800$/)
        }
    })

    it('uses the SBD label in forms for fundamental only', () => {
        expect(EXERCISE_TYPE_META.fundamental.formLabelKey).toBe('trainer:exercises.fundamentalSBD')
        expect(EXERCISE_TYPE_META.accessory.formLabelKey).toBe(EXERCISE_TYPE_META.accessory.labelKey)
        expect(EXERCISE_TYPE_META.postural.formLabelKey).toBe(EXERCISE_TYPE_META.postural.labelKey)
    })

    it('uses emerald for postural', () => {
        expect(EXERCISE_TYPE_META.postural.badgeClass).toBe(
            'border-emerald-200 bg-emerald-100 text-emerald-800'
        )
    })

    it('defaults to accessory', () => {
        expect(DEFAULT_EXERCISE_TYPE).toBe('accessory')
    })

    it('isExerciseType accepts known values and rejects others', () => {
        expect(isExerciseType('postural')).toBe(true)
        expect(isExerciseType('fundamental')).toBe(true)
        expect(isExerciseType('compound')).toBe(false)
        expect(isExerciseType(undefined)).toBe(false)
        expect(isExerciseType(1)).toBe(false)
    })

    it('sorts fundamental < accessory < postural, unknown last', () => {
        const input = ['postural', undefined, 'accessory', 'fundamental', 'weird']
        const sorted = [...input].sort(compareExerciseType)
        expect(sorted.slice(0, 3)).toEqual(['fundamental', 'accessory', 'postural'])
        expect(sorted.slice(3)).toEqual(expect.arrayContaining([undefined, 'weird']))
    })

    it('returns 0 for equal types', () => {
        expect(compareExerciseType('postural', 'postural')).toBe(0)
    })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/unit/exercise-type.test.ts`
Expected: FAIL — cannot resolve `@/lib/exercise-type`.

- [ ] **Step 7: Implement the module**

`src/lib/exercise-type.ts`:

```ts
import type { ExerciseType as PrismaExerciseType } from '@prisma/client'

/**
 * Single source of truth for exercise types.
 * Adding a type: extend the Prisma enum, this tuple, EXERCISE_TYPE_META and the
 * `common:exerciseTypes` i18n keys — type-check fails until all are in sync.
 */
export const EXERCISE_TYPES = ['fundamental', 'accessory', 'postural'] as const

export type ExerciseType = (typeof EXERCISE_TYPES)[number]

// Compile-time guard: fails type-check if the Prisma enum and EXERCISE_TYPES diverge
type AssertSameUnion = [PrismaExerciseType] extends [ExerciseType]
    ? [ExerciseType] extends [PrismaExerciseType]
        ? true
        : never
    : never
const prismaEnumInSync: AssertSameUnion = true
void prismaEnumInSync

export interface ExerciseTypeMeta {
    labelKey: string
    pluralKey: string
    shortKey: string
    /** Label used by the create/edit radio group */
    formLabelKey: string
    badgeClass: string
    sortOrder: number
}

const keysFor = (type: ExerciseType) => ({
    labelKey: `common:exerciseTypes.${type}.label`,
    pluralKey: `common:exerciseTypes.${type}.plural`,
    shortKey: `common:exerciseTypes.${type}.short`,
})

export const EXERCISE_TYPE_META: Record<ExerciseType, ExerciseTypeMeta> = {
    fundamental: {
        ...keysFor('fundamental'),
        formLabelKey: 'trainer:exercises.fundamentalSBD',
        badgeClass: 'border-red-200 bg-red-100 text-red-800',
        sortOrder: 1,
    },
    accessory: {
        ...keysFor('accessory'),
        formLabelKey: keysFor('accessory').labelKey,
        badgeClass: 'border-blue-200 bg-blue-100 text-blue-800',
        sortOrder: 2,
    },
    postural: {
        ...keysFor('postural'),
        formLabelKey: keysFor('postural').labelKey,
        badgeClass: 'border-emerald-200 bg-emerald-100 text-emerald-800',
        sortOrder: 3,
    },
}

export const DEFAULT_EXERCISE_TYPE: ExerciseType = 'accessory'

export function isExerciseType(value: unknown): value is ExerciseType {
    return typeof value === 'string' && (EXERCISE_TYPES as readonly string[]).includes(value)
}

const sortOrderOf = (type: string | null | undefined) =>
    isExerciseType(type) ? EXERCISE_TYPE_META[type].sortOrder : Number.MAX_SAFE_INTEGER

/** Comparator: fundamental → accessory → postural → unknown */
export function compareExerciseType(a: string | null | undefined, b: string | null | undefined): number {
    return sortOrderOf(a) - sortOrderOf(b)
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/unit/exercise-type.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 9: Add module to coverage list**

In `vitest.config.ts` `coverage.include`, after `'src/lib/useSwipe.ts',` add `'src/lib/exercise-type.ts',`.

- [ ] **Step 10: Commit**

Note: `npm run type-check` is expected to FAIL at this point (e.g. `src/components/ExerciseCard.tsx` indexes a 2-key object with the now 3-value Prisma enum). Task 2 fixes this; do not fix consumers here.

```bash
git add prisma/schema.prisma prisma/migrations/20260919000000_add_postural_exercise_type src/lib/exercise-type.ts public/locales/it/common.json public/locales/en/common.json vitest.config.ts tests/unit/exercise-type.test.ts
git commit -m "feat(exercises): add postural type to enum and central exercise-type module"
```

---

### Task 2: Zod schemas + type-only migration (type-check green)

**Files:**
- Modify: `src/schemas/exercise.ts:26-28,40`
- Modify (type-only): `src/lib/workout-recap.ts:2`, `src/lib/trainee-program-data.ts:41`, `src/lib/program-pdf-export.ts:9`, `src/lib/program-sbd-metrics.ts:60`, `src/app/api/trainee/workouts/[id]/prev-week/route.ts:10`, `src/components/WorkoutExerciseDisplayList.tsx:10`, `src/components/ProgramReportSection.tsx:25`, `src/components/ProgramMuscleGroupCharts.tsx:46`, `src/app/trainee/programs/_components/ProgramDetailContent.tsx:53`
- Modify: `src/components/ExerciseCard.tsx`
- Test: `tests/unit/schemas.test.ts`, `tests/integration/exercises.test.ts`

**Interfaces:**
- Consumes: `EXERCISE_TYPES`, `ExerciseType`, `EXERCISE_TYPE_META` from Task 1.
- Produces: `exerciseSchema` / `exerciseFilterSchema` accept `'postural'`.

- [ ] **Step 1: Write failing schema tests**

In `tests/unit/schemas.test.ts`:
- add `exerciseFilterSchema` to the `@/schemas/exercise` import;
- inside `describe('exerciseSchema', …)`, after the `accepts "accessory" type` test, add:

```ts
    it('accepts "postural" type', () => {
        const result = exerciseSchema.safeParse({ ...validExercise, type: 'postural' })
        expect(result.success).toBe(true)
    })
```

- after the `describe('updateExerciseSchema', …)` block add:

```ts
describe('exerciseFilterSchema', () => {
    it('accepts type=postural', () => {
        expect(exerciseFilterSchema.safeParse({ type: 'postural' }).success).toBe(true)
    })

    it('rejects unknown type', () => {
        expect(exerciseFilterSchema.safeParse({ type: 'compound' }).success).toBe(false)
    })
})
```

- [ ] **Step 2: Write failing integration tests**

In `tests/integration/exercises.test.ts`, inside `describe('GET /api/exercises')` after the `filters by type=fundamental…` test:

```ts
    it('filters by type=postural and passes where clause to prisma', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([] as any)

        const req = makeListRequest('http://localhost:3000/api/exercises?type=postural')
        const res = await listExercises(req)

        expect(res.status).toBe(200)
        expect(prisma.exercise.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ type: 'postural' }),
            })
        )
    })
```

Inside `describe('POST /api/exercises')` after the first test:

```ts
    it('trainer creates a postural exercise', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findFirst).mockResolvedValue(null)
        vi.mocked(prisma.movementPattern.findUnique).mockResolvedValue(mockMovementPattern as any)
        vi.mocked(prisma.muscleGroup.findMany).mockResolvedValue(mockMuscleGroups as any)
        vi.mocked(prisma.exercise.create).mockResolvedValue({
            ...mockExerciseWithRelations,
            id: 'new-postural-uuid',
            name: 'Dead Bug',
            type: 'postural',
        } as any)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, name: 'Dead Bug', type: 'postural' }),
        })
        const res = await createExercise(req)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.exercise.type).toBe('postural')
        expect(prisma.exercise.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ type: 'postural' }),
            })
        )
    })
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/schemas.test.ts tests/integration/exercises.test.ts`
Expected: the 4 new tests FAIL (Zod rejects `postural`; GET returns 400, POST returns 400).

- [ ] **Step 4: Update Zod schemas**

In `src/schemas/exercise.ts` add `import { EXERCISE_TYPES } from '@/lib/exercise-type'` and replace:

```ts
    type: z.enum(['fundamental', 'accessory'], {
        errorMap: () => ({ message: 'validation.invalidExerciseType' }),
    }),
```
with
```ts
    type: z.enum(EXERCISE_TYPES, {
        errorMap: () => ({ message: 'validation.invalidExerciseType' }),
    }),
```
and in `exerciseFilterSchema`:
```ts
    type: z.enum(EXERCISE_TYPES).optional(),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/schemas.test.ts tests/integration/exercises.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-only replacements**

In each file below, add `import type { ExerciseType } from '@/lib/exercise-type'` and replace the literal union with `ExerciseType`:

| File | Line | Before → After |
|---|---|---|
| `src/lib/workout-recap.ts` | 2 | `export type WorkoutExerciseType = 'fundamental' \| 'accessory'` → `export type WorkoutExerciseType = ExerciseType` |
| `src/lib/trainee-program-data.ts` | 41 | `type: 'fundamental' \| 'accessory'` → `type: ExerciseType` |
| `src/lib/program-pdf-export.ts` | 9 | same |
| `src/lib/program-sbd-metrics.ts` | 60 | same (keep line 97 `=== 'fundamental'` unchanged) |
| `src/app/api/trainee/workouts/[id]/prev-week/route.ts` | 10 | `exerciseType: 'fundamental' \| 'accessory'` → `exerciseType: ExerciseType` |
| `src/components/WorkoutExerciseDisplayList.tsx` | 10 | `exerciseType?: 'fundamental' \| 'accessory'` → `exerciseType?: ExerciseType` |
| `src/components/ProgramReportSection.tsx` | 25 | `type: ExerciseType` |
| `src/components/ProgramMuscleGroupCharts.tsx` | 46 | `type: ExerciseType` (keep line 179 unchanged) |
| `src/app/trainee/programs/_components/ProgramDetailContent.tsx` | 53 | `type: ExerciseType` |

- [ ] **Step 7: Fix `ExerciseCard`**

In `src/components/ExerciseCard.tsx`:
- replace `import { ExerciseType } from '@prisma/client'` with `import { EXERCISE_TYPE_META, type ExerciseType } from '@/lib/exercise-type'`;
- delete the `typeColors` and `typeLabels` objects;
- find the element that uses `typeColors[type]` / `typeLabels[type]` (`grep -n "typeColors\|typeLabels" src/components/ExerciseCard.tsx`) and use `EXERCISE_TYPE_META[type].badgeClass` in place of `typeColors[type]`, and `t(EXERCISE_TYPE_META[type].labelKey)` in place of `typeLabels[type]`. Keep the element's other classes (including `border`) as they are.

- [ ] **Step 8: Add a postural card to the showcase**

In `src/app/components-showcase/page.tsx`, after the `Romanian Deadlift` `ExerciseCard` (around line 670) add:

```tsx
                        <ExerciseCard
                            id="4"
                            name="Dead Bug"
                            type="postural"
                            movementPattern={{ id: '4', name: 'Core', color: '#10b981' }}
                            muscleGroups={[{ id: '6', name: 'Addominali' }]}
                        />
```

(If `id="4"` is taken, use the next free id.)

- [ ] **Step 9: Type-check**

Run: `npm run type-check`
Expected: PASS. If other files error with "'postural' is not assignable to '"fundamental" | "accessory"'", apply the same type-only replacement there; do not touch rendering code (later tasks).

- [ ] **Step 10: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add -A src tests
git commit -m "feat(exercises): accept postural in schemas and share ExerciseType across modules"
```

---

### Task 3: `ExerciseTypeBadge` and `ExerciseTypeRadioGroup` components, `ExerciseMetaBadges` refactor

**Files:**
- Create: `src/components/ExerciseTypeBadge.tsx`
- Create: `src/components/ExerciseTypeRadioGroup.tsx`
- Modify: `src/components/index.ts` (after line 31)
- Modify: `src/components/ExerciseMetaBadges.tsx:7,11,84-96`
- Test: `tests/unit/ExerciseTypeBadge.test.tsx`, `tests/unit/ExerciseTypeRadioGroup.test.tsx`, `tests/unit/ExerciseMetaBadges.test.tsx`

**Interfaces:**
- Consumes: `EXERCISE_TYPES`, `EXERCISE_TYPE_META`, `ExerciseType` (Task 1).
- Produces:
  - `ExerciseTypeBadge({ type: ExerciseType; variant?: 'short' | 'label'; className?: string })` — renders `<span>` with `meta.badgeClass` + `className`. `short` (default): text = short letter, `title` and `aria-label` = full label. `label`: text = full label, no title.
  - `ExerciseTypeRadioGroup({ value: ExerciseType; onChange: (type: ExerciseType) => void; disabled?: boolean; name?: string })` — one radio per `EXERCISE_TYPES` entry, label = `t(meta.formLabelKey)`.
  - Both exported from `@/components` as named exports.

- [ ] **Step 1: Write failing tests**

`tests/unit/ExerciseTypeBadge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExerciseTypeBadge from '@/components/ExerciseTypeBadge'

describe('ExerciseTypeBadge', () => {
    it('renders the short letter with full label as title/aria-label by default', () => {
        render(<ExerciseTypeBadge type="postural" />)
        const badge = screen.getByText('common:exerciseTypes.postural.short')
        expect(badge).toHaveAttribute('title', 'common:exerciseTypes.postural.label')
        expect(badge).toHaveAttribute('aria-label', 'common:exerciseTypes.postural.label')
        expect(badge.className).toContain('bg-emerald-100')
    })

    it('renders the full label in label variant', () => {
        render(<ExerciseTypeBadge type="fundamental" variant="label" />)
        const badge = screen.getByText('common:exerciseTypes.fundamental.label')
        expect(badge).not.toHaveAttribute('title')
        expect(badge.className).toContain('bg-red-100')
    })

    it('appends custom className', () => {
        render(<ExerciseTypeBadge type="accessory" className="px-2 text-xs" />)
        const badge = screen.getByText('common:exerciseTypes.accessory.short')
        expect(badge.className).toContain('bg-blue-100')
        expect(badge.className).toContain('px-2 text-xs')
    })
})
```

`tests/unit/ExerciseTypeRadioGroup.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExerciseTypeRadioGroup from '@/components/ExerciseTypeRadioGroup'

describe('ExerciseTypeRadioGroup', () => {
    it('renders one radio per type with form labels', () => {
        render(<ExerciseTypeRadioGroup value="accessory" onChange={vi.fn()} />)
        expect(screen.getAllByRole('radio')).toHaveLength(3)
        expect(screen.getByLabelText('trainer:exercises.fundamentalSBD')).not.toBeChecked()
        expect(screen.getByLabelText('common:exerciseTypes.accessory.label')).toBeChecked()
        expect(screen.getByLabelText('common:exerciseTypes.postural.label')).toBeInTheDocument()
    })

    it('calls onChange with the selected type', () => {
        const onChange = vi.fn()
        render(<ExerciseTypeRadioGroup value="accessory" onChange={onChange} />)
        fireEvent.click(screen.getByLabelText('common:exerciseTypes.postural.label'))
        expect(onChange).toHaveBeenCalledWith('postural')
    })

    it('disables all radios when disabled', () => {
        render(<ExerciseTypeRadioGroup value="accessory" onChange={vi.fn()} disabled />)
        screen.getAllByRole('radio').forEach((radio) => expect(radio).toBeDisabled())
    })
})
```

`tests/unit/ExerciseMetaBadges.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExerciseMetaBadges from '@/components/ExerciseMetaBadges'

describe('ExerciseMetaBadges', () => {
    it.each([
        ['fundamental', 'bg-red-100'],
        ['accessory', 'bg-blue-100'],
        ['postural', 'bg-emerald-100'],
    ] as const)('renders %s type badge with its color', (type, colorClass) => {
        render(<ExerciseMetaBadges exerciseType={type} />)
        const badge = screen.getByText(`common:exerciseTypes.${type}.label`)
        expect(badge.className).toContain(colorClass)
    })

    it('renders nothing without badges', () => {
        const { container } = render(<ExerciseMetaBadges />)
        expect(container.firstChild).toBeNull()
    })
})
```

(Before writing the last test, confirm `ExerciseMetaBadges` returns `null` when `!hasBadges` by reading lines 40-45; if it renders something else, adjust the assertion to match.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/ExerciseTypeBadge.test.tsx tests/unit/ExerciseTypeRadioGroup.test.tsx tests/unit/ExerciseMetaBadges.test.tsx`
Expected: FAIL — modules not found; ExerciseMetaBadges test fails on `postural` label.

- [ ] **Step 3: Implement `ExerciseTypeBadge`**

`src/components/ExerciseTypeBadge.tsx`:

```tsx
'use client'

import { useTranslation } from 'react-i18next'
import { EXERCISE_TYPE_META, type ExerciseType } from '@/lib/exercise-type'

interface ExerciseTypeBadgeProps {
    type: ExerciseType
    /** `short` shows the letter (F/A/P) with the full label as tooltip; `label` shows the full label */
    variant?: 'short' | 'label'
    /** Layout/sizing classes; colors come from EXERCISE_TYPE_META */
    className?: string
}

export default function ExerciseTypeBadge({ type, variant = 'short', className = '' }: ExerciseTypeBadgeProps) {
    const { t } = useTranslation('common')
    const meta = EXERCISE_TYPE_META[type]
    const label = t(meta.labelKey)
    const isShort = variant === 'short'

    return (
        <span
            className={`${meta.badgeClass} ${className}`.trim()}
            title={isShort ? label : undefined}
            aria-label={isShort ? label : undefined}
        >
            {isShort ? t(meta.shortKey) : label}
        </span>
    )
}
```

- [ ] **Step 4: Implement `ExerciseTypeRadioGroup`**

`src/components/ExerciseTypeRadioGroup.tsx`:

```tsx
'use client'

import { useTranslation } from 'react-i18next'
import { EXERCISE_TYPES, EXERCISE_TYPE_META, type ExerciseType } from '@/lib/exercise-type'

interface ExerciseTypeRadioGroupProps {
    value: ExerciseType
    onChange: (type: ExerciseType) => void
    disabled?: boolean
    name?: string
}

export default function ExerciseTypeRadioGroup({
    value,
    onChange,
    disabled = false,
    name = 'exerciseType',
}: ExerciseTypeRadioGroupProps) {
    const { t } = useTranslation(['trainer', 'common'])

    return (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
            {EXERCISE_TYPES.map((type) => (
                <label key={type} className="flex items-center">
                    <input
                        type="radio"
                        name={name}
                        value={type}
                        checked={value === type}
                        onChange={() => onChange(type)}
                        disabled={disabled}
                        className="mr-2 disabled:cursor-not-allowed"
                    />
                    <span>{t(EXERCISE_TYPE_META[type].formLabelKey)}</span>
                </label>
            ))}
        </div>
    )
}
```

- [ ] **Step 5: Export from the barrel**

In `src/components/index.ts` after `export { default as MovementPatternTag } from './MovementPatternTag'` add:

```ts
export { default as ExerciseTypeBadge } from './ExerciseTypeBadge'
export { default as ExerciseTypeRadioGroup } from './ExerciseTypeRadioGroup'
```

- [ ] **Step 6: Refactor `ExerciseMetaBadges`**

In `src/components/ExerciseMetaBadges.tsx`:
- delete `type ExerciseTypeValue = 'fundamental' | 'accessory'`;
- add `import ExerciseTypeBadge from './ExerciseTypeBadge'` and `import type { ExerciseType } from '@/lib/exercise-type'`;
- prop becomes `exerciseType?: ExerciseType | null`;
- replace the whole `{exerciseType && (<span …>…</span>)}` block with:

```tsx
            {exerciseType && (
                <ExerciseTypeBadge
                    type={exerciseType}
                    variant="label"
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                />
            )}
```

- if `'trainer'` is no longer used in this file's `useTranslation(['trainee', 'trainer'])`, leave the array as is (harmless).

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ExerciseTypeBadge.test.tsx tests/unit/ExerciseTypeRadioGroup.test.tsx tests/unit/ExerciseMetaBadges.test.tsx tests/unit/WorkoutExerciseDisplayList.test.tsx tests/unit/workout-recap-panel.test.tsx`
Expected: PASS. If `workout-recap-panel` asserts on `trainer:exercises.fundamental`, update the assertion to `common:exerciseTypes.fundamental.label`.

- [ ] **Step 8: Add new components to coverage list**

In `vitest.config.ts` `coverage.include` add `'src/components/ExerciseTypeBadge.tsx',` and `'src/components/ExerciseTypeRadioGroup.tsx',`.

- [ ] **Step 9: Type-check and commit**

Run: `npm run type-check` → PASS.

```bash
git add src/components tests/unit vitest.config.ts
git commit -m "feat(components): add ExerciseTypeBadge and ExerciseTypeRadioGroup"
```

---

### Task 4: Exercise create/edit forms (`/trainer/exercises/new`, `[id]/edit`, `ExerciseCreateModal`)

**Files:**
- Modify: `src/app/trainer/exercises/new/_content.tsx:42,244-270`
- Modify: `src/app/trainer/exercises/[id]/edit/_content.tsx:35,63,295-321`
- Modify: `src/components/ExerciseCreateModal.tsx:40,252-265`

**Interfaces:**
- Consumes: `ExerciseTypeRadioGroup`, `ExerciseType`, `DEFAULT_EXERCISE_TYPE`, `EXERCISE_TYPES`, `EXERCISE_TYPE_META`, `isExerciseType`.

- [ ] **Step 1: `new/_content.tsx`**

Add imports:
```tsx
import ExerciseTypeRadioGroup from '@/components/ExerciseTypeRadioGroup'
import { DEFAULT_EXERCISE_TYPE, type ExerciseType } from '@/lib/exercise-type'
```
Line 42 → `const [type, setType] = useState<ExerciseType>(DEFAULT_EXERCISE_TYPE)`.
Replace the `<div className="flex space-x-4"> … </div>` inside the `{/* Type */}` block (both `<label>`s) with:
```tsx
                    <ExerciseTypeRadioGroup value={type} onChange={setType} disabled={loading} />
```

- [ ] **Step 2: `[id]/edit/_content.tsx`**

Same imports. Line 35 interface field → `type: ExerciseType`. Line 63 → `useState<ExerciseType>(DEFAULT_EXERCISE_TYPE)`. Replace the `<div className="flex space-x-4">…</div>` in the `{/* Type */}` block with:
```tsx
                        <ExerciseTypeRadioGroup value={type} onChange={setType} disabled={saving} />
```

- [ ] **Step 3: `ExerciseCreateModal.tsx`**

Add `import { DEFAULT_EXERCISE_TYPE, EXERCISE_TYPES, EXERCISE_TYPE_META, isExerciseType, type ExerciseType } from '@/lib/exercise-type'`.
Line 40 → `type: DEFAULT_EXERCISE_TYPE as ExerciseType,`.
Replace the `onChange` and the two `<option>`s of the `#type` select with:
```tsx
                                onChange={(e) => {
                                    if (isExerciseType(e.target.value)) {
                                        setFormData({ ...formData, type: e.target.value })
                                    }
                                }}
```
```tsx
                                {EXERCISE_TYPES.map((type) => (
                                    <option key={type} value={type} className="text-gray-900">
                                        {t(EXERCISE_TYPE_META[type].labelKey)}
                                    </option>
                                ))}
```
Also check the form reset (grep `type: 'accessory'` in the file) and replace with `DEFAULT_EXERCISE_TYPE`.

- [ ] **Step 4: Verify**

Run: `npm run type-check && npx vitest run tests/unit/NewProgramContent.test.tsx tests/unit/components.test.tsx`
Expected: PASS.
Manual (if dev server available): `/trainer/exercises/new` shows three radios ("Fondamentale (SBD)", "Accessorio", "Posturale"), Accessorio preselected; create a "Posturale" exercise → 201; edit page shows it selected.

- [ ] **Step 5: Commit**

```bash
git add src/app/trainer/exercises src/components/ExerciseCreateModal.tsx
git commit -m "feat(exercises): postural option in create/edit forms and quick-create modal"
```

---

### Task 5: Exercise library list and `ExercisesTable` (filters + badges)

**Files:**
- Modify: `src/app/trainer/exercises/_content.tsx:19,55,119-125,206-212,268-277,339-348`
- Modify: `src/components/ExercisesTable.tsx:24,77-108,140-147,222-229`

- [ ] **Step 1: `trainer/exercises/_content.tsx`**

Imports:
```tsx
import ExerciseTypeBadge from '@/components/ExerciseTypeBadge'
import { EXERCISE_TYPES, EXERCISE_TYPE_META, isExerciseType, type ExerciseType } from '@/lib/exercise-type'
```
- Interface line 19 → `type: ExerciseType`.
- Line 55 → `const [typeFilter, setTypeFilter] = useState<'all' | ExerciseType>('all')`.
- Delete `getTypeShortLabel`, `getTypeFullLabel`, `getTypeBadgeClasses` (lines 119-125). These hard-coded Italian labels go away.
- Filter select: `onChange={(e) => setTypeFilter(isExerciseType(e.target.value) ? e.target.value : 'all')}` and options:
```tsx
                                <option value="all">{t('exercises.allTypes')}</option>
                                {EXERCISE_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {t(EXERCISE_TYPE_META[type].pluralKey)}
                                    </option>
                                ))}
```
- Both badge `<span>`s (around lines 269-277 and 340-348) that used the deleted helpers become:
```tsx
                                            <ExerciseTypeBadge
                                                type={exercise.type}
                                                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                                            />
```
(Keep any extra layout classes the original span had besides the color classes, e.g. `flex-shrink-0`.)

- [ ] **Step 2: `ExercisesTable.tsx`**

Imports as above (`ExerciseTypeBadge`, `EXERCISE_TYPES`, `EXERCISE_TYPE_META`, `type ExerciseType`).
- Line 24 → `type: ExerciseType`.
- Delete `getTypeLabel`, `getFilterOptionLabel`, `getTypeBadgeColor` (lines 77-108).
- Filter options (keep `all`):
```tsx
                            <option value="all" className="text-gray-900">{t('common:common.all')}</option>
                            {EXERCISE_TYPES.map((type) => (
                                <option key={type} value={type} className="text-gray-900">
                                    {t(EXERCISE_TYPE_META[type].pluralKey)}
                                </option>
                            ))}
```
- Badge (around line 224) becomes:
```tsx
                                        <ExerciseTypeBadge
                                            type={exercise.type}
                                            variant="label"
                                            className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                                        />
```
Fundamental switches from purple to red here, by design.

- [ ] **Step 3: Verify**

Run: `npm run type-check && npm run lint`
Expected: PASS, no unused-var warnings for deleted helpers.
Manual: `/trainer/exercises` filter shows "Tutti / Fondamentali / Accessori / Posturali"; posturale cards show green "P" with tooltip "Posturale".

- [ ] **Step 4: Commit**

```bash
git add src/app/trainer/exercises/_content.tsx src/components/ExercisesTable.tsx
git commit -m "feat(exercises): postural filter and badges in exercise library"
```

---

### Task 6: Program screens (editor, review, workout detail, tests)

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx:100,169,176,1066-1069,2731-2735,2801-2805,2901-2938`
- Modify: `src/app/trainer/programs/[id]/review/_content.tsx:49,645-653,773-785`
- Modify: `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx:34,95,553-560,614-624`
- Modify: `src/app/trainer/programs/[id]/tests/_content.tsx:49,605`

In every file: add `import type { ExerciseType } from '@/lib/exercise-type'` (plus value imports where used) and replace the `'fundamental' | 'accessory'` interface fields with `ExerciseType`. Keep `workouts/[wId]/_content.tsx:337` unchanged.

- [ ] **Step 1: Program editor**

Imports: `ExerciseTypeBadge` from `@/components/ExerciseTypeBadge`; `EXERCISE_TYPE_META, type ExerciseType` from `@/lib/exercise-type`.
- Lines 1066-1069 (autocomplete sublabel):
```tsx
                const typeLabel = t(EXERCISE_TYPE_META[exercise.type].labelKey)
```
- Selected exercise badge (≈2731):
```tsx
                                                                                        <ExerciseTypeBadge
                                                                                            type={selectedExercise.type}
                                                                                            className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                                                                        />
```
- Dragged exercise badge (≈2801):
```tsx
                                                        <ExerciseTypeBadge
                                                            type={draggedExercise.type}
                                                            className="inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                                        />
```
- PR helper list (≈2901): make the fallback typed, `const type: ExerciseType = record.exercise?.type || exerciseLookupById.get(record.exerciseId)?.type || 'accessory'`, and replace the span with:
```tsx
                                                            <ExerciseTypeBadge
                                                                type={type}
                                                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                                            />
```
(The PR record `exercise.type` field type at line ~169/176 must be `ExerciseType` for this to compile.)

- [ ] **Step 2: Program review**

Import `ExerciseTypeBadge`. Replace the badge at ≈645-653 with:
```tsx
                                                                    <ExerciseTypeBadge
                                                                        type={exercise.type}
                                                                        className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                                                    />
```
and at ≈773-785 with:
```tsx
                                                                                    <ExerciseTypeBadge
                                                                                        type={workoutExercise.exercise.type}
                                                                                        className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                                                                    />
```

- [ ] **Step 3: Workout detail**

Import `ExerciseTypeBadge`. PR badge (≈553):
```tsx
                                                <ExerciseTypeBadge
                                                    type={pr.exercise.type}
                                                    className="px-2 py-0.5 text-xs font-medium rounded-full"
                                                />
```
Exercise header badge (≈614):
```tsx
                                                    <ExerciseTypeBadge
                                                        type={we.exercise.type}
                                                        variant="label"
                                                        className="rounded-full border px-2 py-0.5 text-xs font-medium"
                                                    />
```

- [ ] **Step 4: Tests page**

Import `EXERCISE_TYPE_META`. Line 605:
```tsx
                                            {exercise.name} ({t(EXERCISE_TYPE_META[exercise.type].labelKey)})
```

- [ ] **Step 5: Verify**

Run: `npm run type-check && npx vitest run tests/unit/program-test-results-content.test.tsx tests/unit/trainer-programs-content.test.tsx`
Expected: PASS (update any assertion that expected `exercises.fundamental`/`exercises.accessory` keys to the new `common:exerciseTypes.*.label` keys).

- [ ] **Step 6: Commit**

```bash
git add "src/app/trainer/programs" tests/unit
git commit -m "feat(programs): show postural type badges in program screens"
```

---

### Task 7: Trainee detail, trainer records, `PersonalRecordsExplorer` (sorting + labels)

**Files:**
- Modify: `src/app/trainer/trainees/[id]/_content.tsx:100,695-697,714-716,1324-1326`
- Modify: `src/app/trainer/trainees/[id]/records/_content.tsx:28,338`
- Modify: `src/components/PersonalRecordsExplorer.tsx:139-142`
- Test: `tests/unit/PersonalRecordsExplorer.test.tsx`

- [ ] **Step 1: Write failing sort test**

In `tests/unit/PersonalRecordsExplorer.test.tsx`, add a test rendering records for three exercises (one per type, names chosen so alphabetical order differs from type order, e.g. `'Addome Plank'` postural, `'Bench'` accessory, `'Squat'` fundamental) using the same record fixture shape as the existing tests (lines ~30-40), then:

```tsx
        const names = screen.getAllByText(/^(Squat|Bench|Addome Plank)$/).map((el) => el.textContent)
        expect(names).toEqual(['Squat', 'Bench', 'Addome Plank'])
```

Read the existing tests first and copy their render call / required props exactly. If the component renders each name more than once, narrow the query to the list container the existing tests use.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/PersonalRecordsExplorer.test.tsx`
Expected: FAIL — current comparator puts `'Addome Plank'` (postural) before `'Bench'` because it only distinguishes fundamental vs non-fundamental and then sorts by name.

- [ ] **Step 3: Use `compareExerciseType`**

`PersonalRecordsExplorer.tsx` — import `{ compareExerciseType } from '@/lib/exercise-type'` and replace:
```tsx
                if (left.exercise.type !== right.exercise.type) {
                    return left.exercise.type === 'fundamental' ? -1 : 1
                }
```
with:
```tsx
                const typeOrder = compareExerciseType(left.exercise.type, right.exercise.type)
                if (typeOrder !== 0) {
                    return typeOrder
                }
```
Apply the same replacement to both comparators in `trainer/trainees/[id]/_content.tsx` (≈695: `left.exercise.type`/`right.exercise.type`; ≈714: `left.type`/`right.type`).

- [ ] **Step 4: Labels**

`trainer/trainees/[id]/_content.tsx` ≈1324:
```tsx
                                                                    {t(EXERCISE_TYPE_META[record.exercise.type].labelKey)}
```
`trainer/trainees/[id]/records/_content.tsx:338`:
```tsx
                                            sublabel: t(EXERCISE_TYPE_META[ex.type].labelKey),
```
Interface fields at `_content.tsx:100` and `records/_content.tsx:28` → `ExerciseType`. Add needed imports.

- [ ] **Step 5: Verify**

Run: `npm run type-check && npx vitest run tests/unit/PersonalRecordsExplorer.test.tsx tests/unit/trainer-trainee-detail-sbd-report.test.tsx tests/unit/records-exercise-autocomplete.test.tsx`
Expected: PASS (update key assertions to `common:exerciseTypes.*` if any fail on old keys).

- [ ] **Step 6: Commit**

```bash
git add "src/app/trainer/trainees" src/components/PersonalRecordsExplorer.tsx tests/unit
git commit -m "feat(records): order and label postural exercises in trainee views"
```

---

### Task 8: Trainee-side screens (records filter, workout badge)

**Files:**
- Modify: `src/app/trainee/records/_content.tsx:28,65,245-252,314-333`
- Modify: `src/app/trainee/workouts/[id]/_content.tsx:39,1130-1141`

- [ ] **Step 1: Trainee records**

Imports: `ExerciseTypeBadge` from `@/components/ExerciseTypeBadge`; `EXERCISE_TYPES, EXERCISE_TYPE_META, type ExerciseType` from `@/lib/exercise-type`.
- Line 28 → `type: ExerciseType`; line 65 → `useState<'all' | ExerciseType>('all')`.
- Filter options array becomes:
```tsx
                                    {[
                                        { value: 'all' as const, label: t('records.typeAll') },
                                        ...EXERCISE_TYPES.map((type) => ({
                                            value: type,
                                            label: t(EXERCISE_TYPE_META[type].pluralKey),
                                        })),
                                    ].map((option) => (
```
  and `setTypeFilter(option.value)` (drop the `as typeof typeFilter` cast).
- The badge `<span>` (≈314-333) becomes:
```tsx
                                                            <ExerciseTypeBadge
                                                                type={pr.exercise.type}
                                                                className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                                                            />
```

- [ ] **Step 2: Trainee workout**

Import `ExerciseTypeBadge`. Line 39 → `type: ExerciseType`. Badge at ≈1130-1141:
```tsx
                        <ExerciseTypeBadge
                            type={we.exercise.type}
                            variant="label"
                            className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                        />
```

- [ ] **Step 3: Verify**

Run: `npm run type-check && npx vitest run tests/unit/trainee-workout-focus.test.tsx tests/unit/trainee-dashboard.test.tsx tests/unit/trainee-history.test.tsx`
Expected: PASS (update old-key assertions if any).

- [ ] **Step 4: Commit**

```bash
git add src/app/trainee tests/unit
git commit -m "feat(trainee): postural filter and badges in trainee screens"
```

---

### Task 9: i18n cleanup, completion checks, changelog

**Files:**
- Modify: `public/locales/{en,it}/trainer.json`, `public/locales/{en,it}/trainee.json`
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Completion grep (must be empty)**

Run:
```bash
grep -rn "'fundamental' | 'accessory'\|=== 'fundamental' ?\|=== 'fundamental'$" src
```
Expected: no output. Any hit outside the 4 "unchanged logic" locations listed in Global Constraints must be migrated first. (`=== 'fundamental' &&` in `program-sbd-metrics.ts` and `!== 'fundamental'` in `ProgramMuscleGroupCharts.tsx` are intended.)

- [ ] **Step 2: Remove superseded keys only if unreferenced**

For each key, confirm zero references, then delete from both `en` and `it`:

```bash
for k in "exercises.fundamental'" "exercises.accessory'" "exercises.fundamentalPlural" "exercises.accessoryPlural" \
         "fundamentalShort" "accessoryShort" "tagFundamental" "tagAccessory" "tagFundamentalShort" "tagAccessoryShort" \
         "typeFundamental" "typeAccessory"; do
  echo "== $k"; grep -rn "$k" src tests | grep -v "exerciseTypes"
done
```

Delete keys with no hits:
- `trainer.json` → `exercises.fundamental`, `exercises.accessory`, `exercises.fundamentalPlural`, `exercises.accessoryPlural` (keep `fundamentalSBD`, `reportingFundamentalFilterLabel`)
- `trainee.json` → `workouts.fundamentalShort`, `workouts.accessoryShort`, `workouts.tagFundamental`, `workouts.tagAccessory`, `workouts.tagFundamentalShort`, `workouts.tagAccessoryShort`, `records.typeFundamental`, `records.typeAccessory`, `records.tagFundamental`, `records.tagAccessory`

Validate JSON: `node -e "for (const l of ['en','it']) for (const n of ['trainer','trainee','common']) require('./public/locales/'+l+'/'+n+'.json')"` → no output.

- [ ] **Step 3: Full gates**

Run: `npm run type-check && npm run lint && npm run test:unit`
Expected: all PASS; coverage ≥ 80% for `src/lib/exercise-type.ts`, `ExerciseTypeBadge.tsx`, `ExerciseTypeRadioGroup.tsx`.

- [ ] **Step 4: Changelog**

Under `## [Unreleased]` → `### Changed` in `implementation-docs/CHANGELOG.md`, add at the top (same format as the other entries):

```markdown
### [19 Settembre 2026] — Nuovo tipo esercizio "Posturale"

**File modificati:** `prisma/schema.prisma`, `prisma/migrations/20260919000000_add_postural_exercise_type/migration.sql`, `src/lib/exercise-type.ts`, `src/components/ExerciseTypeBadge.tsx`, `src/components/ExerciseTypeRadioGroup.tsx`, `src/components/ExerciseMetaBadges.tsx`, `src/components/ExerciseCard.tsx`, `src/components/ExerciseCreateModal.tsx`, `src/components/ExercisesTable.tsx`, `src/components/PersonalRecordsExplorer.tsx`, `src/schemas/exercise.ts`, pagine trainer/trainee esercizi, programmi, atleti e massimali, `public/locales/{en,it}/{common,trainer,trainee}.json`, test unit/integration, `implementation-docs/CHANGELOG.md`
**Note:** Aggiunto il terzo tipo `postural` all'enum `ExerciseType` (migrazione additiva, nessun backfill). È una pura categoria: si prescrive come un accessorio e resta escluso da metriche SBD, grafici muscolari e report serie pianificate, che continuano a filtrare su `fundamental`. Tutta la conoscenza sui tipi è ora in `src/lib/exercise-type.ts` (`EXERCISE_TYPES`, `EXERCISE_TYPE_META` con chiavi i18n, lettera breve, colore badge e ordine, `compareExerciseType`), con un guard a compile-time che fa fallire il type-check se enum Prisma e lista divergono. I ternari binari fondamentale/accessorio sparsi in ~15 punti (che avrebbero mostrato i posturali come "Accessorio") sono sostituiti da `ExerciseTypeBadge` e `ExerciseTypeRadioGroup`. Label canoniche in `common:exerciseTypes.*`; rimosse le chiavi duplicate in `trainer.json`/`trainee.json`. Il fondamentale ora è rosso anche in `ExercisesTable` (prima viola) e la lista esercizi trainer non ha più label italiane hard-coded. Ordinamento record: fondamentali → accessori → posturali.
```

- [ ] **Step 5: Commit**

```bash
git add public/locales implementation-docs/CHANGELOG.md
git commit -m "chore(i18n): drop superseded exercise type keys; changelog for postural type"
```

- [ ] **Step 6: Remind the user**

Tell the user the migration `20260919000000_add_postural_exercise_type` must be applied (`npm run prisma:migrate` in dev, `npm run prisma:migrate:prod` on deploy) before creating postural exercises against a real DB.
