# Workout Templates — Design

Status: Draft
Date: 2026-10-11
Owner: trainer-facing program creation flow

## Goal

Each trainer keeps a private library of **workout templates**: a "typical week" of N workouts, each with exercises, sets, reps and rest time (no kg, no RPE). When creating a new program, the trainer chooses to start from a template or from scratch. Starting from a template pre-fills Week 1 (and the skeleton for later weeks). The trainee never sees that a program started from a template. A trainer dashboard lists all their templates with usage stats.

## Decisions (from brainstorming)

- Template content per exercise: `exerciseId`, `sets`, `reps`, `restTime`. Everything else (variant, RPE, weight, flags, notes) is filled per trainee.
- Dedicated tables + lean editor (rejected: `TrainingProgram.isTemplate` flag — `traineeId` is required and every program query (dashboard, credits, reports, renewals) would need filtering, high leak/regression risk; rejected: extending `WorkoutSkeleton` — tied to a program, no sets/reps/rest).
- Template → program is a **pure copy**. No FK or hidden field from `TrainingProgram` to the template. Editing or deleting a template can never alter existing programs, and nothing about the origin is exposed to the trainee.
- Wizard gets a **step 0** ("From scratch" / "From library"). Choosing a template locks `workoutsPerWeek` in step 1 (same mechanic as clone).
- Dashboard = table with usage stats (`usageCount`, `lastUsedAt`).

## Non-goals

- Sharing templates between trainers, admin-owned templates, versioning.
- "Save existing program as template".
- Copying RPE, variant, flags, notes or weight from the template.
- Decrementing `usageCount` when a program is deleted.
- Template-name uniqueness per trainer; limit on number of templates.

## Data model (Prisma)

Migration must ship before the code that uses it.

```prisma
model WorkoutTemplate {
  id              String   @id @default(uuid())
  trainerId       String
  name            String
  workoutsPerWeek Int
  usageCount      Int      @default(0)
  lastUsedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  trainer  User                    @relation("TrainerWorkoutTemplates", fields: [trainerId], references: [id])
  workouts WorkoutTemplateWorkout[] @relation("TemplateWorkouts")

  @@index([trainerId])
  @@map("workout_templates")
}

model WorkoutTemplateWorkout {
  id         String @id @default(uuid())
  templateId String
  dayIndex   Int    // 0..workoutsPerWeek-1

  template  WorkoutTemplate           @relation("TemplateWorkouts", fields: [templateId], references: [id], onDelete: Cascade)
  exercises WorkoutTemplateExercise[] @relation("TemplateWorkoutExercises")

  @@unique([templateId, dayIndex])
  @@map("workout_template_workouts")
}

model WorkoutTemplateExercise {
  id                String   @id @default(uuid())
  templateWorkoutId String
  exerciseId        String
  order             Int
  sets              Int
  reps              String   // same format as WorkoutExercise.reps ("8", "8-10", "6/8")
  restTime          RestTime

  templateWorkout WorkoutTemplateWorkout @relation("TemplateWorkoutExercises", fields: [templateWorkoutId], references: [id], onDelete: Cascade)
  exercise        Exercise               @relation("ExerciseTemplates", fields: [exerciseId], references: [id])

  @@unique([templateWorkoutId, order])
  @@index([exerciseId])
  @@map("workout_template_exercises")
}
```

Add back-relations on `User` and `Exercise`.

## API

All handlers: `requireRole('trainer')`, filter by `trainerId = user.id` on every query; another trainer's template → 404 (not 403, no existence leak). Success via `apiSuccess`, errors via `apiError` with i18n `key`, 500s via `handleApiError`. Zod schemas in `src/schemas/workout-template.ts` (name required, `workoutsPerWeek` 1–7, `reps` validated with the existing reps rules, `sets` ≥ 1).

- `GET /api/workout-templates` — list with computed `exerciseCount`, `usageCount`, `lastUsedAt`, `updatedAt`, `workoutsPerWeek`, `name`.
- `POST /api/workout-templates` — create template + workouts + exercises in one transaction.
- `GET /api/workout-templates/[id]` — full template for the editor.
- `PUT /api/workout-templates/[id]` — replace workouts and exercises in one transaction (delete + create); keeps `usageCount/lastUsedAt`.
- `DELETE /api/workout-templates/[id]` — cascade delete. Existing programs untouched (no FK).
- `POST /api/programs` — new optional `templateId`, mutually exclusive with `cloneFromProgramId` (400 if both). Verifies template ownership (404 otherwise) and `workoutsPerWeek` equality with the template (400, same pattern as clone). In the same transaction as program creation:
  - create Week 1 `WorkoutExercise` rows per `dayIndex`: `exerciseId`, `sets`, `reps`, `restTime`, `order` from template; `weightType: absolute`, `weight/effectiveWeight/targetRpe: null`, flags false, `variant/notes: null`.
  - create `WorkoutSkeleton` rows from the same exercises so weeks 2..N hydrate via existing `skeleton-hydration.ts` as with clone.
  - `usageCount += 1`, `lastUsedAt = now()` on the template.

## UI

### `/trainer/templates` — dashboard

Server page + `_content.tsx` + `loading.tsx` (follow `programs/` pattern). Table (MUI DataGrid or existing table component, whichever `programs/_content.tsx` uses): name, workouts/week, total exercises, times used, last used, last modified, actions (edit, delete with confirmation modal). Name search, sortable columns, empty state with "New template" CTA. Date columns via `formatDate()`. Add a trainer nav entry. Delete uses `<ActionIconButton isLoading>`; confirmation text states that existing programs are not affected.

### Template editor — `/trainer/templates/new` and `/trainer/templates/[id]`

Form: name + workouts-per-week (1–7) + one block per workout with rows (exercise picker, sets, reps, rest). Same grid look as the program workout editor, 4 columns only. Reuse `reps-utils.ts`, row helpers from `row-utils.ts` where applicable and the existing exercise selector. react-hook-form + the Zod schema. Save via `<Button isLoading loadingText={t('common.saving')}>`; on success `useNavigationLoader().start()` then `router.push('/trainer/templates')`. Label: "Save to library", no publish step. Do not extend the 4118-line `edit/_content.tsx`; build a separate, small component.

### Wizard — `/trainer/programs/new`

- Step 0: two cards, "From scratch" (current flow, unchanged) and "From library" (list of the trainer's templates: name, workouts/week, exercise count). No templates → CTA to create one.
- Selecting a template navigates to `?templateId=<id>`; server `page.tsx` loads it via an ownership-checked query and passes `templateSource` to `NewProgramContent`.
- Step 1 with `templateSource`: `workoutsPerWeek` read-only/disabled (as clone), other fields editable. Trainer-only info banner naming the template. "Start blank instead" link.
- Submit sends `templateId`; redirect to `/trainer/programs/<id>/edit` as today. Trainee-facing pages and API payloads gain no template field.

### i18n

Keys in `public/locales/{en,it}/` (watch for BOM in locale files): templates dashboard, editor, wizard step 0, banner, API error keys (`template.notFound`, `validation.workoutsPerWeekMismatchWithTemplate`, `validation.templateAndCloneExclusive`).

## Traps for the implementer

- Migration first; `npm run prisma:generate` after.
- Ownership: every template query includes `trainerId`; never `findUnique({ id })` alone.
- Do not add any template reference to trainee-facing queries, selects, or Sentry context.
- `cloneFromProgramId` and `templateId` flows share the skeleton-copy code path in `src/app/api/programs/route.ts`; keep clone behaviour unchanged.
- `PUT` must preserve `usageCount/lastUsedAt`.
- Update `implementation-docs/CHANGELOG.md` after each change.

## Testing

- Unit: Zod schema; template → Week 1 / skeleton mapping function.
- Integration (`tests/integration/`): trainer B gets 404 on trainer A's template (GET/PUT/DELETE and as `templateId` in `POST /api/programs`); list returns only own templates; creating a program from a template fills Week 1 (kg/RPE null), creates skeleton, bumps `usageCount`; editing/deleting a template leaves a created program's workouts unchanged; `workoutsPerWeek` mismatch → 400; both `templateId` and `cloneFromProgramId` → 400.
- E2E (`tests/e2e/`): create template → dashboard shows it → new program from template → Week 1 pre-filled, no weights; trainee view shows no template trace.
- Coverage: add new lib/schema files to `vitest.config.ts` coverage list (80%).

## Size

Large (schema change, new API surface, >5 tasks). Plan: one mid-way review plus final review.
