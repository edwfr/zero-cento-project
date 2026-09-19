# Postural Exercise Type — Design

**Date:** 2026-09-19
**Status:** Approved (design), pending spec review

## Goal

Add a third exercise type, **Posturale** (`postural`), alongside `fundamental` and `accessory`.

`postural` is a **pure category**: it is prescribed exactly like an accessory (sets × reps × load), participates in personal records like any other exercise, and is excluded from SBD / fundamental-only metrics. Only label, badge and sort position differ.

While doing so, centralize all exercise-type knowledge in one module so that adding a future type is a type-checked, one-place change.

## Non-goals

- No time-based / bodyweight prescription for postural exercises.
- No change to SBD metrics, muscle-group charts or planned-training-sets report logic (they keep checking `=== 'fundamental'`).
- No data backfill: existing exercises keep their type.

## Display decisions

| | Fundamental | Accessory | Postural |
|---|---|---|---|
| Short letter | F | A | P |
| Badge | red | blue | emerald |
| Sort order | 1 | 2 | 3 |
| Default in create form | – | ✓ | – |

Fundamental badge becomes **red everywhere** (today `ExercisesTable` uses purple — unified).

## Architecture

### 1. Central module — `src/lib/exercise-type.ts`

```ts
import type { ExerciseType as PrismaExerciseType } from '@prisma/client'

export const EXERCISE_TYPES = ['fundamental', 'accessory', 'postural'] as const
export type ExerciseType = (typeof EXERCISE_TYPES)[number]

// Compile-time guard: type-check fails if Prisma enum and EXERCISE_TYPES diverge
type AssertSame = [PrismaExerciseType] extends [ExerciseType]
    ? [ExerciseType] extends [PrismaExerciseType]
        ? true
        : never
    : never
const _prismaEnumInSync: AssertSame = true

export interface ExerciseTypeMeta {
    labelKey: string   // 'common:exerciseTypes.postural.label'
    pluralKey: string  // 'common:exerciseTypes.postural.plural'
    shortKey: string   // 'common:exerciseTypes.postural.short'
    formLabelKey: string // radio label; fundamental → 'trainer:exercises.fundamentalSBD'
    badgeClass: string // 'border-emerald-200 bg-emerald-100 text-emerald-800'
    sortOrder: number
}

export const EXERCISE_TYPE_META: Record<ExerciseType, ExerciseTypeMeta>
export const DEFAULT_EXERCISE_TYPE: ExerciseType = 'accessory'
export function isExerciseType(value: unknown): value is ExerciseType
export function compareExerciseType(a: string | null | undefined, b: string | null | undefined): number // unknown last
```

Rules:
- Only `import type` from `@prisma/client` — the module is imported by client components; Prisma Client must not enter the browser bundle.
- `Record<ExerciseType, …>` forces every type to have full metadata.
- Badge colors (exact classes):
  - fundamental: `border-red-200 bg-red-100 text-red-800`
  - accessory: `border-blue-200 bg-blue-100 text-blue-800`
  - postural: `border-emerald-200 bg-emerald-100 text-emerald-800`

### 1b. Shared components

- `src/components/ExerciseTypeBadge.tsx` — `{ type, variant?: 'short' | 'label', className? }`; colors from meta, caller passes layout classes. `short` shows letter with full label as `title`/`aria-label`.
- `src/components/ExerciseTypeRadioGroup.tsx` — `{ value, onChange, disabled?, name? }`; one radio per `EXERCISE_TYPES`, label from `formLabelKey`.

### 2. Database

- `prisma/schema.prisma`: add `postural  // Posturali, mobilità, core` to `enum ExerciseType`.
- Migration `add_postural_exercise_type` via `npm run prisma:migrate` → `ALTER TYPE "ExerciseType" ADD VALUE 'postural'`. Additive, no backfill.

### 3. Validation

`src/schemas/exercise.ts`: both `exerciseSchema.type` and `exerciseFilterSchema.type` use `z.enum(EXERCISE_TYPES)` (keeping the existing `validation.invalidExerciseType` error map on the create schema).

### 4. i18n

New canonical keys in `public/locales/{en,it}/common.json`:

```json
"exerciseTypes": {
  "fundamental": { "label": "Fondamentale", "plural": "Fondamentali", "short": "F" },
  "accessory":   { "label": "Accessorio",   "plural": "Accessori",    "short": "A" },
  "postural":    { "label": "Posturale",    "plural": "Posturali",    "short": "P" }
}
```

English: Fundamental/Fundamentals/F, Accessory/Accessories/A, Postural/Postural/P.

After all usages are migrated, remove the now-duplicated keys:
`trainer:exercises.{fundamental,accessory,fundamentalPlural,accessoryPlural}`, `trainee:workouts.{fundamentalShort,accessoryShort,tagFundamental,tagAccessory,tagFundamentalShort,tagAccessoryShort}`, `trainee:records.{typeFundamental,typeAccessory,tagFundamental,tagAccessory}`.
Keep `trainer:exercises.fundamentalSBD` and `reportingFundamentalFilterLabel` (different meaning).
Removal happens only after `grep` shows zero references.

### 5. Consumer migration

Every hand-written `'fundamental' | 'accessory'` union, binary ternary and type switch goes through the central module.

**Forms** (options generated from `EXERCISE_TYPES`, default `DEFAULT_EXERCISE_TYPE`):
- `src/app/trainer/exercises/new/_content.tsx`
- `src/app/trainer/exercises/[id]/edit/_content.tsx`
- `src/components/ExerciseCreateModal.tsx`

**Filters** ("All" + `EXERCISE_TYPES`, plural label):
- `src/app/trainer/exercises/_content.tsx` (also removes hard-coded Italian labels at line ~121)
- `src/components/ExercisesTable.tsx`
- `src/app/trainee/records/_content.tsx`

**Badges / labels** (`ExerciseTypeBadge` / label key):
- `src/components/ExerciseMetaBadges.tsx`
- `src/components/ExercisesTable.tsx`
- `src/app/trainer/exercises/_content.tsx`
- `src/app/trainer/programs/[id]/edit/_content.tsx` (3 spots)
- `src/app/trainer/programs/[id]/review/_content.tsx`
- `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx`
- `src/app/trainer/programs/[id]/tests/_content.tsx`
- `src/app/trainer/trainees/[id]/_content.tsx`
- `src/app/trainer/trainees/[id]/records/_content.tsx`
- `src/app/trainee/workouts/[id]/_content.tsx`
- `src/app/trainee/records/_content.tsx`

**Sorting** (`compareExerciseType`):
- `src/app/trainer/trainees/[id]/_content.tsx` (2 spots)
- `src/components/PersonalRecordsExplorer.tsx`

**Type-only replacements** (`'fundamental' | 'accessory'` → `ExerciseType`):
- `src/lib/workout-recap.ts`, `program-sbd-metrics.ts`, `program-pdf-export.ts` (type only, no label printed), `trainee-program-data.ts`
- `src/app/api/trainee/workouts/[id]/prev-week/route.ts`
- `src/app/trainee/programs/_components/ProgramDetailContent.tsx`
- `src/components/ProgramMuscleGroupCharts.tsx`, `ProgramReportSection.tsx`, `WorkoutExerciseDisplayList.tsx`, `ExerciseCard.tsx`
- remaining page-level interfaces listed above

**Unchanged logic** (still `=== 'fundamental'`): `program-sbd-metrics.ts`, `ProgramMuscleGroupCharts.tsx`, `api/users/[id]/reports/planned-training-sets/route.ts`, `trainer/programs/[id]/workouts/[wId]/_content.tsx:337`.

**Showcase**: `src/app/components-showcase/page.tsx` gets a postural example.

Completion check: `grep -rn "'fundamental' | 'accessory'\|=== 'fundamental' ?" src` returns nothing.

## Testing

- **Unit** `tests/unit/exercise-type.test.ts` (new): `EXERCISE_TYPES` order, meta complete for every type, `compareExerciseType` ordering F < A < P, `isExerciseType` accepts/rejects.
- **Unit** `tests/unit/schemas.test.ts`: accepts `postural` in create + filter schema; still rejects unknown value.
- **Unit** `tests/unit/ExerciseMetaBadges.test.tsx` (new, no existing badge test): each type renders its label + badge class; postural renders emerald.
- **Integration** `tests/integration/exercises.test.ts`: POST with `type: 'postural'` → 201; GET `?type=postural` passes filter to Prisma `where`.
- **Unit** `tests/unit/program-sbd-metrics.test.ts`: postural exercise named like a lift is excluded (same as accessory).
- Add `src/lib/exercise-type.ts` to coverage list in `vitest.config.ts` (80% threshold).
- Gates: `npm run type-check`, `npm run lint`, `npm run test:unit`.

## Docs

`implementation-docs/CHANGELOG.md` entry per CLAUDE.md workflow rule.
