# Workout Templates Implementation Plan

> **For agentic workers:** execute with `/feature-implement <this file>` in a fresh
> Sonnet session. Read this header, then one task at a time. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** A trainer keeps a private library of workout templates (a typical week: exercises × sets × reps × rest), sees them in a dashboard table with usage stats, and can start a new program from one so Week 1 is pre-filled.

**Architecture:** Three new Prisma tables (`WorkoutTemplate` → `WorkoutTemplateWorkout` → `WorkoutTemplateExercise`), isolated from `TrainingProgram`: template → program is a pure copy done inside the `POST /api/programs` transaction, with no FK back, so editing/deleting a template never touches programs and the trainee has nothing to see. A separate lean editor component (4 columns) is used for `/trainer/templates/new` and `/[id]`; the wizard gets a step 0 that chooses scratch vs library and passes `?templateId=`. Pure mapping logic (template → Week 1 rows / skeleton rows) lives in `src/lib/workout-templates.ts` so it is unit-tested without Prisma.

**Spec:** `docs/superpowers/specs/2026-10-11-workout-templates-design.md`

## Global Constraints

- Before touching code, invoke the matching project skill: `zero-cento-backend`,
  `zero-cento-frontend`, `zero-cento-testing`.
- **Ownership:** every template query filters by `trainerId = session.user.id`. Never `findUnique({ where: { id } })` alone for a template. Another trainer's template → **404** (never 403).
- **Isolation:** no template reference may appear in any trainee-facing query, select, API payload or Sentry context. No `templateId` column on `TrainingProgram`.
- Template content per exercise is only `exerciseId`, `sets`, `reps`, `restTime`. On copy: `weightType: 'absolute'`, `weight/effectiveWeight/targetRpe/variant/notes: null`, `isWarmup/isJumpSet/isSuperSet/isCompleted: false`.
- **dayIndex trap:** template workout `dayIndex` and `WorkoutSkeleton.dayIndex` are **0-based**; `Workout.dayIndex` created by `POST /api/programs` is **1-based** (`workoutIdx + 1`). Mapping: template day `d` → program Week 1 workout with `dayIndex = d + 1`; skeleton row keeps `dayIndex = d`.
- Locale JSON files in `public/locales/{en,it}/` start with a **UTF-8 BOM**: edit with the Edit tool on exact strings, never rewrite whole files with a tool that drops the BOM. Add every key to both `it` and `en`.
- `templateId` and `cloneFromProgramId` are mutually exclusive on `POST /api/programs` (400). Clone behaviour must stay unchanged (`tests/integration/programs-clone.test.ts` must keep passing).
- `PUT /api/workout-templates/[id]` must preserve `usageCount` and `lastUsedAt`.
- Dates in UI via `formatDate()` from `src/lib/date-format.ts`. Click-triggered async uses `<Button isLoading loadingText=...>` / `<ActionIconButton isLoading>`; post-submit redirect uses `useNavigationLoader().start()` before `router.push()`, `.stop()` on error.
- API handlers: `requireRole(['trainer'])`, `apiSuccess` / `apiError(code, message, status, details?, key?)`, 500s via `handleApiError`. Never call Sentry for 4xx.
- After each task add an entry at the top of `## [Unreleased]` in
  `implementation-docs/CHANGELOG.md` in the existing format (Italian) and include it in
  the task's commit.
- Commit on the current branch with conventional-commit messages. Do not push.

## Deviations from the spec

- Spec left the dashboard table component open. Decision: plain Tailwind `<table>` with client-side search and column sorting (a trainer's template count is small, no pagination, no MUI DataGrid).
- `WorkoutTemplateEditor` is placed flat in `src/components/` (project rule: flat components exported via `index.ts`) rather than under `src/app/trainer/templates/`.
- Template `order` is 0-based and contiguous per workout (needed for `@@unique([templateWorkoutId, order])` and for `WorkoutSkeleton`'s `@@unique([programId, dayIndex, order])`).

## Review Focus

1. **Cross-trainer access** — trainer B gets 404 on GET/PUT/DELETE of trainer A's template and on `POST /api/programs` with A's `templateId`; list returns only own templates. Pinned in Task 3 and Task 4.
2. **Program unaffected by template changes** — after creating a program from a template, `PUT` and `DELETE` on the template leave that program's weeks/workouts/exercises unchanged (no FK, copy only). Pinned in Task 4.
3. **dayIndex off-by-one** — template day 0 lands in Week 1 workout `dayIndex 1` and skeleton `dayIndex 0`; Week 1 kg/RPE are null. Pinned in Task 2 (pure mapping) and Task 4.
4. **Mismatch / exclusivity** — `workoutsPerWeek` ≠ template's → 400; `templateId` + `cloneFromProgramId` → 400; clone flow untouched. Pinned in Task 4.
5. **Usage stats** — `usageCount` +1 and `lastUsedAt` set only when a program is created from the template; `PUT` does not reset them; failed program creation does not bump them (same transaction). Pinned in Task 3 and Task 4.
6. **Trainee never sees the origin** — no template field in the program response or any trainee-facing payload (there is no schema column to leak; the reviewer greps trainee routes/selects for `template`). Pinned in Task 4 (response-shape test).

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `prisma/schema.prisma` | 3 new models + back-relations on `User`, `Exercise` | 1 |
| `prisma/migrations/<ts>_add_workout_templates/migration.sql` | DDL | 1 |
| `src/schemas/workout-template.ts` | Zod create/update schema | 2 |
| `src/lib/workout-templates.ts` | Pure mapping: template → Week 1 rows / skeleton rows, exercise count | 2 |
| `tests/unit/lib/workout-templates.test.ts`, `tests/unit/workout-template-schema.test.ts` | Unit tests | 2 |
| `src/app/api/workout-templates/route.ts` | GET list, POST create | 3 |
| `src/app/api/workout-templates/[id]/route.ts` | GET, PUT, DELETE | 3 |
| `tests/integration/workout-templates.test.ts` | CRUD + ownership tests | 3 |
| `src/schemas/program.ts`, `src/app/api/programs/route.ts` | `templateId` branch | 4 |
| `tests/integration/programs-from-template.test.ts` | From-template creation tests | 4 |
| `public/locales/{it,en}/{trainer,errors,navigation}.json`, `src/components/DashboardLayout.tsx` | i18n keys + nav entry | 5 |
| `src/components/WorkoutTemplateEditor.tsx`, `src/components/index.ts` | Lean editor | 6 |
| `src/app/trainer/templates/{page.tsx,_content.tsx,loading.tsx}` | Dashboard table | 6 |
| `src/app/trainer/templates/new/{page.tsx,loading.tsx}`, `src/app/trainer/templates/[id]/{page.tsx,loading.tsx}` | Editor pages | 6 |
| `src/app/trainer/programs/new/{page.tsx,NewProgramContent.tsx}` | Step 0 + `templateSource` | 7 |
| `tests/unit/NewProgramContent.test.tsx` (modify), `tests/unit/WorkoutTemplateEditor.test.tsx`, `tests/e2e/trainer-workout-templates.spec.ts` | UI + e2e tests | 6, 7, 8 |

---

### Task 1: Prisma models and migration

**Model:** sonnet
**Depends on:** none
**Files:** `prisma/schema.prisma` (modify), `prisma/migrations/<timestamp>_add_workout_templates/migration.sql` (new)
**Test command:** `npm run prisma:generate && npm run type-check`
**Done when:** `prisma generate` succeeds, `PrismaClient` exposes `workoutTemplate`, `workoutTemplateWorkout`, `workoutTemplateExercise`, and a migration folder exists.

- [x] **Step 1: models** — add to `prisma/schema.prisma` (this is the exact shape; mirror existing style and `@@map` snake_case naming):

```prisma
model WorkoutTemplate {
  id              String    @id @default(uuid())
  trainerId       String
  name            String
  workoutsPerWeek Int
  usageCount      Int       @default(0)
  lastUsedAt      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  trainer  User                     @relation("TrainerWorkoutTemplates", fields: [trainerId], references: [id])
  workouts WorkoutTemplateWorkout[] @relation("TemplateWorkouts")

  @@index([trainerId])
  @@map("workout_templates")
}

model WorkoutTemplateWorkout {
  id         String @id @default(uuid())
  templateId String
  dayIndex   Int    // 0-based: 0..workoutsPerWeek-1

  template  WorkoutTemplate           @relation("TemplateWorkouts", fields: [templateId], references: [id], onDelete: Cascade)
  exercises WorkoutTemplateExercise[] @relation("TemplateWorkoutExercises")

  @@unique([templateId, dayIndex])
  @@map("workout_template_workouts")
}

model WorkoutTemplateExercise {
  id                String   @id @default(uuid())
  templateWorkoutId String
  exerciseId        String
  order             Int      // 0-based, contiguous per workout
  sets              Int
  reps              String   // same format as WorkoutExercise.reps ("8", "8-10")
  restTime          RestTime

  templateWorkout WorkoutTemplateWorkout @relation("TemplateWorkoutExercises", fields: [templateWorkoutId], references: [id], onDelete: Cascade)
  exercise        Exercise               @relation("ExerciseTemplates", fields: [exerciseId], references: [id])

  @@unique([templateWorkoutId, order])
  @@index([exerciseId])
  @@map("workout_template_exercises")
}
```

  Add back-relations: in `User` → `workoutTemplates WorkoutTemplate[] @relation("TrainerWorkoutTemplates")`; in `Exercise` → `templateExercises WorkoutTemplateExercise[] @relation("ExerciseTemplates")`.
- [x] **Step 2: migration** — run `npx prisma migrate dev --name add_workout_templates` (needs `DIRECT_URL`). If the DB is unreachable, generate the SQL without a DB: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` (needs a shadow DB URL) or, as a last resort, hand-write the `CREATE TABLE` / index / FK statements matching the models and create the folder `prisma/migrations/<YYYYMMDDHHMMSS>_add_workout_templates/`. Inspect the SQL: it must contain no `DROP` of existing objects. The migration ships before any code using it (it is the first commit).
- [x] **Step 3: run `npm run prisma:generate` and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(db): add workout template models`

---

### Task 2: Zod schema and pure mapping library

**Model:** sonnet
**Depends on:** Task 1
**Files:** `src/schemas/workout-template.ts` (new), `src/lib/workout-templates.ts` (new), `tests/unit/workout-template-schema.test.ts` (new), `tests/unit/lib/workout-templates.test.ts` (new)
**Test command:** `npx vitest run tests/unit/workout-template-schema.test.ts tests/unit/lib/workout-templates.test.ts`
**Done when:** both test files pass and the mapping functions return the exact row shapes below for a 2-day template.

- [x] **Step 1: tests** — one line per case.
  Schema (`tests/unit/workout-template-schema.test.ts`, import `workoutTemplateSchema` from `@/schemas/workout-template`):
  - valid 2-day template → success
  - empty/whitespace `name` → fail with message `validation.templateNameRequired`
  - `name` of 101 chars → fail `validation.templateNameTooLong`
  - `workoutsPerWeek` 0 and 8 → fail; 1 and 7 → success
  - `workouts.length !== workoutsPerWeek` → fail `validation.templateWorkoutsMismatch`
  - `workouts` dayIndex not exactly `0..N-1` unique (e.g. `[0,2]`, `[0,0]`) → fail `validation.templateInvalidDayIndex`
  - exercise `sets: 0` → fail; `sets: 1.5` → fail
  - `reps` `"8"`, `"8-10"` → success; `"abc"`, `""`, `"10-8"` → fail `validation.invalidReps`
  - `restTime: 'm4'` → fail; each of `s30 m1 m1s30 m2 m3 m5` → success
  - `exerciseId: 'nope'` → fail
  - a workout with zero exercises → success (allowed)
  Lib (`tests/unit/lib/workout-templates.test.ts`):
  - `countTemplateExercises` of 2 workouts with 2 and 3 exercises → 5; empty workouts → 0
  - `buildWeek1ExerciseRows`: template day 0 (2 exercises), day 1 (1 exercise) + program week-1 workouts `[{id:'w1',dayIndex:1},{id:'w2',dayIndex:2}]` → 3 rows; rows of day 0 have `workoutId:'w1'`, day 1 `workoutId:'w2'`; each row has `weightType:'absolute'`, `weight:null`, `effectiveWeight:null`, `targetRpe:null`, `variant:null`, `notes:null`, `isWarmup/isJumpSet/isSuperSet/isCompleted:false`, and `sets/reps/restTime/order/exerciseId` from the template
  - `buildWeek1ExerciseRows` when a template day has no matching program workout → throws `Error('Week 1 workout not found for dayIndex 3')`
  - `buildSkeletonRows('prog-1', template)` → rows with `programId:'prog-1'`, `dayIndex` equal to the template's 0-based day, `order`, `exerciseId`; empty template → `[]`
- [x] **Step 2: implementation** —
  `src/schemas/workout-template.ts`: reuse the reps validation rule from `src/schemas/workout-exercise.ts` (read it and import/reuse its reps regex or refine; do not invent a second rule) and its `restTime` enum values. Exports:

```ts
export const templateExerciseSchema: z.ZodObject<...>   // { exerciseId: uuid, sets: int>=1, reps: string, restTime: enum }
export const templateWorkoutSchema: z.ZodObject<...>    // { dayIndex: int>=0, exercises: templateExerciseSchema[] }
export const workoutTemplateSchema: z.ZodEffects<...>   // { name: trim 1..100, workoutsPerWeek: int 1..7, workouts: templateWorkoutSchema[] } + superRefine for mismatch and dayIndex set
export type WorkoutTemplateInput = z.infer<typeof workoutTemplateSchema>
```

  Message strings are i18n keys (like `createProgramSchema`). `order` is not in the input: it is derived from array position when persisting.

  `src/lib/workout-templates.ts` (pure, no Prisma client import; use `import type { RestTime, WeightType } from '@prisma/client'`):

```ts
export interface TemplateWorkoutLike {
    dayIndex: number
    exercises: { exerciseId: string; order: number; sets: number; reps: string; restTime: RestTime }[]
}
export interface Week1WorkoutRef { id: string; dayIndex: number }   // program Workout, dayIndex 1-based
export interface Week1ExerciseRow {
    workoutId: string; exerciseId: string; order: number; sets: number; reps: string; restTime: RestTime
    weightType: WeightType; weight: null; effectiveWeight: null; targetRpe: null; variant: null; notes: null
    isWarmup: false; isJumpSet: false; isSuperSet: false; isCompleted: false
}
export interface SkeletonRowData { programId: string; dayIndex: number; order: number; exerciseId: string }

export function countTemplateExercises(workouts: TemplateWorkoutLike[]): number
export function buildWeek1ExerciseRows(workouts: TemplateWorkoutLike[], week1Workouts: Week1WorkoutRef[]): Week1ExerciseRow[]
export function buildSkeletonRows(programId: string, workouts: TemplateWorkoutLike[]): SkeletonRowData[]
```

  `buildWeek1ExerciseRows` matches template day `d` to the program workout with `dayIndex === d + 1`; missing → throw the error above. Preserve template `order`.
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(templates): add template schema and mapping helpers`

---

### Task 3: Template CRUD API

**Model:** sonnet
**Depends on:** Task 2
**Files:** `src/app/api/workout-templates/route.ts` (new), `src/app/api/workout-templates/[id]/route.ts` (new), `tests/integration/workout-templates.test.ts` (new)
**Test command:** `npx vitest run tests/integration/workout-templates.test.ts`
**Done when:** all CRUD cases pass, including cross-trainer 404 and stat preservation on PUT.

Mirror structure, auth mocks and prisma mock of `tests/integration/programs-clone.test.ts` (uses `authModuleMock`, `prismaMock`, `asTrainer`) and the handler shape of `src/app/api/programs/route.ts` (`requireRole`, `apiSuccess`, `apiError`, `handleApiError`, `logger.info`). Add `workoutTemplate`, `workoutTemplateWorkout`, `workoutTemplateExercise` to `tests/helpers/prisma-mock.ts` if the mock enumerates models explicitly (read it first).

- [x] **Step 1: tests** — `tests/integration/workout-templates.test.ts`:
  - GET list as trainer → 200; `findMany` called with `where: { trainerId: <session user id> }`; each item exposes `{ id, name, workoutsPerWeek, exerciseCount, usageCount, lastUsedAt, createdAt, updatedAt }`; `exerciseCount` = sum of exercises across workouts
  - GET list as admin or trainee → 403 (guard rejects)
  - POST valid body → 201; `workoutTemplate.create` receives `trainerId` of the session, nested workouts with exercises whose `order` equals array index; response has the template
  - POST invalid body (name empty) → 400 `VALIDATION_ERROR`
  - POST with `exerciseId` that does not exist (`exercise.findMany` returns fewer ids than distinct requested) → 400 key `workout.exercisesNotFound`
  - GET `/[id]` own template → 200 with workouts ordered by `dayIndex` and exercises by `order`
  - GET `/[id]` other trainer's (findFirst with `{id, trainerId}` returns null) → 404 key `template.notFound`; assert `findFirst` was called with `where: { id, trainerId }`
  - PUT own → 200; runs in a transaction: deletes existing workouts of the template, recreates, updates `name/workoutsPerWeek`; the update `data` contains no `usageCount` / `lastUsedAt`
  - PUT other trainer's → 404; `workoutTemplateWorkout.deleteMany` not called
  - DELETE own → 200, `workoutTemplate.delete` called with `{ id }` after ownership check
  - DELETE other trainer's → 404, `delete` not called
  - non-uuid `[id]` → 404 (`template.notFound`)
- [x] **Step 2: implementation** —
  - `GET /api/workout-templates`: `requireRole(['trainer'])`; `findMany({ where: { trainerId }, include: { workouts: { include: { exercises: { select: { id: true } } } } }, orderBy: { updatedAt: 'desc' } })`; map to the item shape with `countTemplateExercises`-style sum (do not return full exercises in the list).
  - `POST`: parse with `workoutTemplateSchema`; verify all distinct `exerciseId`s exist (`prisma.exercise.findMany({ where: { id: { in } }, select: { id: true } })`); create nested `workouts: { create: [...] }` with `exercises: { create: ex.map((e, i) => ({ ...e, order: i })) }`; 201.
  - `[id]/route.ts`: helper `findOwnedTemplate(id, trainerId)` using `findFirst({ where: { id, trainerId } })`, returns `apiError('NOT_FOUND', 'Template not found', 404, undefined, 'template.notFound')` when missing. `PUT`: ownership check, validate, exercises-exist check, then `prisma.$transaction`: `workoutTemplateWorkout.deleteMany({ where: { templateId } })` (cascades exercises), `workoutTemplate.update({ where: { id }, data: { name, workoutsPerWeek, workouts: { create: ... } } })`. `DELETE`: ownership check then `workoutTemplate.delete({ where: { id } })`. Route params are `Promise<{ id: string }>` in Next 15: follow the sibling `src/app/api/programs/[id]/route.ts`.
  - `catch` blocks end with `handleApiError(error, { logMessage, message, key: 'internal.default' })`.
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(api): add workout template CRUD endpoints`

---

### Task 4: Create program from template

**Model:** sonnet
**Depends on:** Task 2, Task 3 (needs prisma mock models)
**Files:** `src/schemas/program.ts` (modify), `src/app/api/programs/route.ts` (modify), `tests/integration/programs-from-template.test.ts` (new)
**Test command:** `npx vitest run tests/integration/programs-from-template.test.ts tests/integration/programs-clone.test.ts tests/integration/programs.test.ts`
**Done when:** new tests pass and the existing clone/programs tests still pass unchanged.

- [ ] **Step 1: tests** — `tests/integration/programs-from-template.test.ts` (same scaffold as `programs-clone.test.ts`; `trainingProgram.create` mock must return `weeks: [{ weekNumber: 1, workouts: [{ id: 'wk1-d1', dayIndex: 1 }, { id: 'wk1-d2', dayIndex: 2 }] }]`):
  - valid `templateId` (template found with `findFirst({ where: { id, trainerId } })`, `workoutsPerWeek: 2`, day 0 with 2 exercises, day 1 with 1) → 201; `workoutExercise.createMany` called once with 3 rows: day 0 rows have `workoutId: 'wk1-d1'`, day 1 row `workoutId: 'wk1-d2'`, all with `weight: null`, `targetRpe: null`, `weightType: 'absolute'`
  - same case: `workoutSkeleton.createMany` called with 3 rows, `dayIndex` 0,0,1 (0-based) and `programId: 'new-prog-id'`
  - same case: `workoutTemplate.update` called with `data: { usageCount: { increment: 1 }, lastUsedAt: expect.any(Date) }`
  - template not owned / missing (`findFirst` → null) → 404 key `template.notFound`; `trainingProgram.create` not called
  - `workoutsPerWeek` 3 vs template 2 → 400 key `validation.workoutsPerWeekMismatchWithTemplate`; `create` not called
  - body with both `templateId` and `cloneFromProgramId` → 400 key `validation.templateAndCloneExclusive`
  - `templateId: 'not-a-uuid'` → 400 `VALIDATION_ERROR`
  - template with a day that has no exercises → still 201; no `createMany` call for empty row lists (guard `length > 0`)
  - program creation fails inside the transaction (`trainingProgram.create` rejects) → 500 and `workoutTemplate.update` not called
  - response body and `logger.info` payload for the created program do not contain `templateId` as a program field; the logged object may include `templateId` (server-side log only)
- [ ] **Step 2: implementation** —
  - `src/schemas/program.ts`: add `templateId: z.string().uuid('validation.invalidTemplateId').optional()` to `createProgramSchema` (NOT to `updateProgramSchema`: it is `createProgramSchema.partial()`, so remove `templateId` and `cloneFromProgramId` from the update schema with `.omit({ templateId: true })` before `.partial()` only if that does not change existing behaviour for `cloneFromProgramId`; otherwise leave the update schema as is and just keep `templateId` out of any update handler).
  - `src/app/api/programs/route.ts` POST: destructure `templateId`. Early: `if (templateId && cloneFromProgramId)` → 400 `validation.templateAndCloneExclusive`. After `actualTrainerId` is resolved, if `templateId`: `prisma.workoutTemplate.findFirst({ where: { id: templateId, trainerId: actualTrainerId }, include: { workouts: { include: { exercises: { orderBy: { order: 'asc' } } }, orderBy: { dayIndex: 'asc' } } } })`; null → 404 `template.notFound`; `template.workoutsPerWeek !== workoutsPerWeek` → 400 `validation.workoutsPerWeekMismatchWithTemplate`. Inside the existing `$transaction`, after the clone block (leave it intact), add:

```ts
if (template) {
    const week1 = createdProgram.weeks.find((w) => w.weekNumber === 1)
    const exerciseRows = buildWeek1ExerciseRows(template.workouts, week1?.workouts ?? [])
    if (exerciseRows.length > 0) await tx.workoutExercise.createMany({ data: exerciseRows })
    const skeletonRows = buildSkeletonRows(createdProgram.id, template.workouts)
    if (skeletonRows.length > 0) await tx.workoutSkeleton.createMany({ data: skeletonRows })
    await tx.workoutTemplate.update({
        where: { id: template.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    })
}
```

  Add `templateId: templateId ?? null` to the `logger.info` payload only. Do not add it to the response. Note `createdProgram.weeks[].workouts` is already included by the existing `include`.
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(api): create program from workout template`

---

### Task 5: i18n keys and navigation entry

**Model:** haiku
**Depends on:** none (can run any time before Task 6)
**Files:** `public/locales/it/trainer.json`, `public/locales/en/trainer.json`, `public/locales/it/errors.json`, `public/locales/en/errors.json`, `public/locales/it/navigation.json`, `public/locales/en/navigation.json` (modify), `src/components/DashboardLayout.tsx` (modify), `tests/unit/DashboardLayout.test.tsx` (modify if it asserts the trainer nav item count/list)
**Test command:** `npx vitest run tests/unit/DashboardLayout.test.tsx`
**Done when:** every key below exists in both locales, all JSON files still parse and still start with the BOM, and the trainer sidebar shows a "Template" link to `/trainer/templates`.

- [ ] **Step 1: tests** — `DashboardLayout.test.tsx`: trainer nav contains a link with `href="/trainer/templates"`; update any hard-coded nav count.
- [ ] **Step 2: implementation** — Edit with exact-string replacements (BOM!). Italian text / English text:
  - `navigation.json` → `navigation.templates`: "Template" / "Templates". `DashboardLayout.tsx`: insert after the `/trainer/programs` item `{ href: '/trainer/templates', icon: <LayoutTemplate className="w-5 h-5" />, titleKey: 'navigation.templates' }` (import `LayoutTemplate` from `lucide-react`; if the installed version lacks it use `Library`).
  - `errors.json`: new top-level `"template": { "notFound": "Template non trovato." / "Template not found." }`; in `validation`: `workoutsPerWeekMismatchWithTemplate` "I giorni di allenamento a settimana devono corrispondere al template." / "Workouts per week must match the template.", `templateAndCloneExclusive` "Non puoi usare insieme template e clonazione." / "Cannot use a template and clone together.", `invalidTemplateId` "ID template non valido." / "Invalid template id.", `templateNameRequired` "Il nome del template è obbligatorio." / "Template name is required.", `templateNameTooLong` "Il nome del template è troppo lungo (max 100)." / "Template name is too long (max 100).", `templateWorkoutsMismatch` "Il numero di workout non corrisponde ai giorni a settimana." / "Workout count does not match workouts per week.", `templateInvalidDayIndex` "Indici dei workout non validi." / "Invalid workout indexes.". If `invalidReps` does not already exist under `validation` or wherever `src/schemas/workout-exercise.ts` keys point, reuse the key that schema already uses and make Task 2's expected message match.
  - `trainer.json` → new top-level object `"templates"` with keys (it / en): `title` "Template" / "Templates"; `subtitle` "La tua libreria di settimane tipo." / "Your library of typical weeks."; `newTemplate` "Nuovo template" / "New template"; `searchPlaceholder` "Cerca per nome..." / "Search by name..."; `emptyTitle` "Nessun template" / "No templates yet"; `emptyDescription` "Crea la tua prima settimana tipo per partire più veloce con i nuovi programmi." / "Create your first typical week to start new programs faster."; columns `colName` "Nome" / "Name", `colWorkouts` "Workout/sett." / "Workouts/week", `colExercises` "Esercizi" / "Exercises", `colUsage` "Utilizzi" / "Times used", `colLastUsed` "Ultimo utilizzo" / "Last used", `colUpdated` "Ultima modifica" / "Last modified", `colActions` "Azioni" / "Actions"; `neverUsed` "Mai" / "Never"; `edit` "Modifica" / "Edit"; `delete` "Elimina" / "Delete"; `deleteTitle` "Eliminare il template?" / "Delete template?"; `deleteMessage` "I programmi già creati da questo template non vengono modificati." / "Programs already created from this template are not affected."; `loadError` "Errore nel caricamento dei template" / "Error loading templates"; `deleteError` "Errore nell'eliminazione del template" / "Error deleting template"; `saveError` "Errore nel salvataggio del template" / "Error saving template"; editor: `editorNewTitle` "Nuovo template" / "New template", `editorEditTitle` "Modifica template" / "Edit template", `nameLabel` "Nome template" / "Template name", `workoutsPerWeekLabel` "Workout a settimana" / "Workouts per week", `workoutLabel` "Workout {{n}}" / "Workout {{n}}", `colExercise` "Esercizio" / "Exercise", `colSets` "Serie" / "Sets", `colReps` "Reps" / "Reps", `colRest` "Recupero" / "Rest", `selectExercise` "Seleziona esercizio" / "Select exercise", `addExercise` "Aggiungi esercizio" / "Add exercise", `removeExercise` "Rimuovi" / "Remove", `saveToLibrary` "Salva in libreria" / "Save to library", `cancel` "Annulla" / "Cancel"; wizard: `startTitle` "Come vuoi iniziare?" / "How do you want to start?", `fromScratch` "Da zero" / "From scratch", `fromScratchDesc` "Configura il programma da capo." / "Build the program from the ground up.", `fromLibrary` "Da libreria" / "From library", `fromLibraryDesc` "Parti da una settimana tipo salvata." / "Start from a saved typical week.", `noTemplatesCta` "Non hai ancora template: creane uno." / "You have no templates yet: create one.", `bannerFromTemplate` "Parti dal template <b>{{name}}</b>." / "Starting from template <b>{{name}}</b>.", `workoutsPerWeekLockedByTemplate` "Bloccato: deve corrispondere al template." / "Locked: must match the template.", `startBlankLink` "Ricomincia da zero" / "Start blank instead", `templateErrorNotFound` "Template non trovato." / "Template not found.". Rest-time labels: reuse the existing labels used by the program editor for `s30…m5` (grep `m1s30` in `public/locales/it/trainer.json` and reuse that key from the editor instead of adding new ones).
- [ ] **Step 3: run the test command**, then validate JSON: `node -e "for (const f of process.argv.slice(1)) JSON.parse(require('fs').readFileSync(f,'utf8').replace(/^﻿/,''))" public/locales/it/trainer.json public/locales/en/trainer.json public/locales/it/errors.json public/locales/en/errors.json public/locales/it/navigation.json public/locales/en/navigation.json` and check `head -c 3 <file> | xxd` still shows `efbb bf` where it did before.
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(i18n): add template keys and nav entry`

---

### Task 6: Template editor and dashboard pages

**Model:** sonnet
**Depends on:** Task 3, Task 5
**Files:** `src/components/WorkoutTemplateEditor.tsx` (new), `src/components/index.ts` (modify), `src/app/trainer/templates/page.tsx`, `_content.tsx`, `loading.tsx` (new), `src/app/trainer/templates/new/page.tsx`, `loading.tsx` (new), `src/app/trainer/templates/[id]/page.tsx`, `loading.tsx` (new), `tests/unit/WorkoutTemplateEditor.test.tsx` (new)
**Test command:** `npx vitest run tests/unit/WorkoutTemplateEditor.test.tsx`
**Done when:** a trainer can open `/trainer/templates`, see their templates in a sortable/searchable table with usage columns, create and edit a template with the 4-column editor, and delete one after confirmation.

Invoke `zero-cento-frontend` first. Page shells mirror `src/app/trainer/programs/page.tsx` (session check, `DashboardLayout`, redirect non-trainers) and `loading.tsx` mirrors `src/app/trainer/programs/loading.tsx`.

- [ ] **Step 1: tests** — `WorkoutTemplateEditor.test.tsx` (mock `fetch`, `next/navigation`, i18n like `tests/unit/NewProgramContent.test.tsx`):
  - renders with `workoutsPerWeek` 3 → 3 workout blocks labelled `Workout 1..3`
  - changing workouts-per-week from 3 to 2 removes the last block; from 2 to 4 adds empty blocks
  - "Add exercise" adds a row with the 4 inputs (exercise autocomplete, sets, reps, rest); "Remove" deletes it
  - submit with empty name → no fetch, error shown
  - submit valid (name, 1 row with exerciseId, sets 3, reps "8-10", rest `m2`) in create mode → `POST /api/workout-templates` with body `{ name, workoutsPerWeek, workouts: [{ dayIndex: 0, exercises: [{ exerciseId, sets: 3, reps: '8-10', restTime: 'm2' }] }, ...] }` then `router.push('/trainer/templates')`
  - edit mode with `initialTemplate` → fields pre-filled and submit does `PUT /api/workout-templates/<id>`
  - API error response → error message shown via `getApiErrorMessage`, save button re-enabled, navigation loader stopped
  - sets and reps inputs have no kg/RPE/weight field in the DOM (assert no input named `weight`/`targetRpe`)
- [ ] **Step 2: implementation** —
  - `WorkoutTemplateEditor` (`'use client'`) props: `{ initialTemplate?: { id: string; name: string; workoutsPerWeek: number; workouts: { dayIndex: number; exercises: { exerciseId: string; sets: number; reps: string; restTime: RestTime }[] }[] } }`. State via react-hook-form (`useFieldArray`) validated with `workoutTemplateSchema` through `zodResolver` (check `@hookform/resolvers` is installed; if not, validate with `safeParse` manually). Loads exercises once from `/api/exercises?limit=500` (response `data.data.items`, as in `src/app/trainer/exercises/_content.tsx`) and builds `AutocompleteOption[]` (`{ id, label: name }`) for `AutocompleteSearch` (see its usage in `src/app/trainer/programs/[id]/edit/_content.tsx` around line 3686). Reps: single text input validated as `"8"` or `"8-10"`; you may reuse `parseRepsString` / `buildRepsString` from `src/app/trainer/programs/[id]/edit/reps-utils.ts` if two inputs (min/max) are used, otherwise one text input. Rest: `<select>` over `s30 m1 m1s30 m2 m3 m5` with the existing rest labels. Styling: same table look as the program editor rows (compact `px-1 py-1` cells, `computeExerciseGroupColors` from `row-utils.ts` for alternating exercise group colour when consecutive rows share an exercise). Save button `<Button isLoading loadingText={t('common.saving')}>` labelled `templates.saveToLibrary`; on success `useNavigationLoader().start()` then `router.push('/trainer/templates')`; on error `.stop()`. Do NOT touch `edit/_content.tsx`. Export from `src/components/index.ts`.
  - `/trainer/templates/page.tsx` + `_content.tsx` (`'use client'`): fetch `/api/workout-templates`; plain Tailwind table with columns name, workouts/week, exercises, times used, last used (`formatDate`, `neverUsed` when null), last modified (`formatDate`), actions (edit link, delete `ActionIconButton`). Search input filters by name (case-insensitive); clicking a column header toggles asc/desc sort (default: last modified desc). Empty state with CTA to `/trainer/templates/new`. Delete uses `ConfirmationModal` with `templates.deleteTitle/deleteMessage`, then `DELETE /api/workout-templates/<id>`, removes the row, toast via `useToast`. Header "New template" `Link` to `/trainer/templates/new`.
  - `/trainer/templates/new/page.tsx`: server page, renders `<WorkoutTemplateEditor />` inside `DashboardLayout backHref="/trainer/templates"`.
  - `/trainer/templates/[id]/page.tsx`: server page; loads the template with `prisma.workoutTemplate.findFirst({ where: { id, trainerId: session.user.id }, include: {...ordered} })`; `notFound()` when null (covers other trainers); passes `initialTemplate`. Validate id is a uuid before querying (see `isUuid` in `src/app/trainer/programs/new/page.tsx`).
- [ ] **Step 3: run the test command and `npm run type-check` and `npm run lint`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(templates): add template dashboard and editor`

---

### Task 7: Wizard step 0 and template-sourced step 1

**Model:** sonnet
**Depends on:** Task 4, Task 5
**Files:** `src/app/trainer/programs/new/page.tsx` (modify), `src/app/trainer/programs/new/NewProgramContent.tsx` (modify), `tests/unit/NewProgramContent.test.tsx` (modify)
**Test command:** `npx vitest run tests/unit/NewProgramContent.test.tsx`
**Done when:** `/trainer/programs/new` shows the scratch/library chooser; choosing a template opens step 1 with `workoutsPerWeek` locked and submit sends `templateId`; "From scratch" and the existing clone flow behave exactly as before.

- [ ] **Step 1: tests** — add to `NewProgramContent.test.tsx` (keep all existing cases green):
  - no `cloneSource`, no `templateSource`, no `?templateId`, step-0 not yet chosen → chooser with two cards "Da zero" / "Da libreria" is shown and the setup form is not
  - click "Da zero" → form shown, behaves as today (submit body has no `templateId`)
  - `templates` prop with 2 items: click "Da libreria" → list of the 2 templates (name, workouts/week, exercise count); empty `templates` → CTA link to `/trainer/templates/new` instead
  - selecting a template → `router.push('/trainer/programs/new?templateId=<id>' + traineeId param if present)`
  - `templateSource` prop given → chooser skipped, form shown, banner with template name (trainer-only), workouts-per-week input `readOnly` and chips disabled with value `templateSource.workoutsPerWeek`, "Start blank" link goes to `startBlankHref`
  - submit with `templateSource` → POST body includes `templateId` and `workoutsPerWeek` of the template, no `cloneFromProgramId`
  - `cloneSource` given → chooser skipped, clone flow unchanged (no `templateId` in body)
  - `templateError` `'notFound'` → error message shown and chooser/form still usable
- [ ] **Step 2: implementation** —
  - `page.tsx`: read `templateId` from `searchParams` (type it alongside `traineeId`/`cloneFromProgramId`). If `templateId` is a uuid: `prisma.workoutTemplate.findFirst({ where: { id: templateId, trainerId: session.user.id }, select: { id, name, workoutsPerWeek } })`; null → `templateError = 'notFound'`; else `templateSource`. If admin role: templates are trainer-scoped, so admins get `templates = []` and ignore `templateId` (document in a code comment). Always load `templates` for trainers: `findMany({ where: { trainerId }, select: { id, name, workoutsPerWeek, workouts: { select: { _count: { select: { exercises: true } } } } }, orderBy: { updatedAt: 'desc' } })`, mapped to `{ id, name, workoutsPerWeek, exerciseCount }`. Pass `templates`, `templateSource`, `templateError` to `NewProgramContent`. If both `cloneFromProgramId` and `templateId` are present, `cloneFromProgramId` wins and `templateSource` is null.
  - `NewProgramContent.tsx`: new props `templates: TemplateOption[]`, `templateSource: { id: string; name: string; workoutsPerWeek: number } | null`, `templateError: 'notFound' | null` (all optional with safe defaults so existing callers/tests compile). Local state `startMode: 'choose' | 'scratch'`, initial `'scratch'` when `cloneSource` or `templateSource` is present, else `'choose'`. While `'choose'` render the two cards (and, after clicking "Da libreria", the template list or empty CTA); the step indicator stays on step 1 styling. `workoutsPerWeek` initial state: `cloneSource?.workoutsPerWeek ?? templateSource?.workoutsPerWeek ?? 3`; the lock conditions currently keyed on `!!cloneSource` become `!!cloneSource || !!templateSource`, with helper text `templates.workoutsPerWeekLockedByTemplate` for the template case. Banner mirrors the clone banner (`<Trans i18nKey="templates.bannerFromTemplate" values={{ name }} components={{ b: <strong /> }}>`). Submit body adds `...(templateSource ? { templateId: templateSource.id } : {})`. Selecting a template builds `/trainer/programs/new?templateId=...` preserving `traineeId` if it was in the URL (use `startBlankHref` logic as reference).
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(programs): start new program from a template`

---

### Task 8: E2E test and docs wrap-up

**Model:** sonnet
**Depends on:** Task 6, Task 7
**Files:** `tests/e2e/trainer-workout-templates.spec.ts` (new), `implementation-docs/CHANGELOG.md` (modify)
**Test command:** `npx playwright test tests/e2e/trainer-workout-templates.spec.ts` (needs dev server and seed per `tests/e2e/fixtures/test-users.ts`; if the environment cannot run Playwright, run `npx playwright test --list tests/e2e/trainer-workout-templates.spec.ts` and say so)
**Done when:** the spec is committed and lists/passes; full unit/integration suite is green.

- [ ] **Step 1: tests** — `tests/e2e/trainer-workout-templates.spec.ts` (login helper identical to `trainer-create-program.spec.ts`):
  - trainer opens `/trainer/templates` via sidebar → heading visible
  - creates a template "Template E2E" with 3 workouts/week and one exercise row (pick the first exercise in the autocomplete, sets 3, reps `8`, rest 2 min) → redirected to dashboard, row "Template E2E" visible with usage `0` and last used "Mai"/"Never"
  - opens `/trainer/programs/new` → clicks "Da libreria" → picks "Template E2E" → URL has `templateId`, workouts-per-week field is read-only with value 3
  - fills title/trainee, submits → lands on `/trainer/programs/<id>/edit`; Week 1 first workout shows the exercise row with sets 3 / reps 8 and an empty weight field
  - back on `/trainer/templates` the usage count is `1`
  - deletes "Template E2E" via the confirmation modal → row gone; the program from before is still reachable at its edit URL with the exercise row intact
- [ ] **Step 2: implementation** — only the spec file; fix any selector issues against the real UI from Tasks 6–7 by adding `data-testid` attributes in those components if role/text selectors are ambiguous.
- [ ] **Step 3: run the new spec, then `npm run test:unit`, `npm run type-check`, `npm run lint`**
- [ ] **Step 4: CHANGELOG entry and commit** — `test(templates): add template e2e flow`

---

## How much code goes in a task

A plan is read by the model that writes the code, so code it could write itself is paid
for twice. Each task gives every exported signature and type in full, every test case as a
one-line `input → expected`, and complete code only for what the implementer would likely get wrong
(models, the transaction block, the dayIndex mapping). The rest points to a sibling file.
