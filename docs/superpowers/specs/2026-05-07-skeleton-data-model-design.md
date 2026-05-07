# Skeleton Data Model Refactor — Design Spec (TRN-011)

**Date:** 2026-05-07
**Status:** Approved
**Related:** Wizard step 2 (Structure) / step 3 (Exercises) in trainer program edit

## Goal

Move the wizard "skeleton" (step 2 structure rows) out of `WorkoutExercise.isSkeletonExercise` into a dedicated `WorkoutSkeleton` table. Persist step 2 work; hydrate step 3 from skeleton in memory; only write to `WorkoutExercise` on save-workout or copy-week.

## Architecture

New table `WorkoutSkeleton` stores a program-level template indexed by workout-day-index. Step 2 writes/reads skeleton via a new endpoint. Step 3 loads skeleton + existing `WorkoutExercise` rows, merges in memory, and writes to `WorkoutExercise` only on explicit save. The boolean `WorkoutExercise.isSkeletonExercise` column is dropped.

## Data model

### New: `WorkoutSkeleton`

```prisma
model WorkoutSkeleton {
  id         String   @id @default(uuid())
  programId  String
  dayIndex   Int      // 0..workoutsPerWeek-1 — workout column in step 2
  order      Int      // row order within the day
  exerciseId String
  createdAt  DateTime @default(now())

  program  TrainingProgram @relation(fields: [programId], references: [id], onDelete: Cascade)
  exercise Exercise        @relation(fields: [exerciseId], references: [id])

  @@unique([programId, dayIndex, order])
  @@index([programId, dayIndex])
  @@map("workout_skeletons")
}
```

Inverse relations added on `TrainingProgram` (`workoutSkeletons`) and `Exercise` (`skeletonRows`).

### Dropped

`WorkoutExercise.isSkeletonExercise` (column + all reads/writes).

### Scope

Skeleton scope = **per program day-index**. Same template applies to all weeks. Per-week deviations live exclusively in `WorkoutExercise` and never propagate back to skeleton.

## API surface

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/programs/[id]` | Include `skeleton: { dayIndex, order, exerciseId }[]` in payload (sorted by dayIndex, order) |
| PUT | `/api/programs/[id]/skeleton` | Bulk replace skeleton for the program (transaction: delete all + insert new) |

`PUT /skeleton` returns 403 if `program.status !== 'draft'`.
Auth: `requireTrainerProgramOwnership()`.
Payload validated by Zod schema in `src/schemas/skeleton.ts`.

Existing workout/exercise endpoints unchanged. Save-workout still writes only to `WorkoutExercise`.

## Wizard flow

### Step 2 (Structure)

- On open: GET program → use `program.skeleton` (empty array if new program).
- Drag-and-drop / add / remove rows held in component state (`structureRowsByWorkoutIndex`).
- "Apply structure" button → `PUT /api/programs/[id]/skeleton` with full row list per `dayIndex`. On success, navigate to step 3.

### Step 3 (Details)

- Load: program + skeleton + all weeks' `WorkoutExercise` rows (existing query).
- For each `(week, workout)`:
  - If `workout.workoutExercises.length > 0` → render those rows (saved truth).
  - Else → render in-memory draft rows hydrated from `skeleton[workout.dayIndex]`. Only `exerciseId` is filled; other fields blank, `isDraft: true`.
- Save workout button → existing bulk-save flow on `WorkoutExercise`. Skeleton untouched.
- Copy week N → week M → existing flow on WE rows. Skeleton untouched.

### Mid-draft skeleton edit

- Trainer returns to step 2, edits skeleton, saves.
- Existing saved WE rows untouched.
- Workouts with zero WE rows re-hydrate from new skeleton on next step-3 visit.

### After publish

- Status `active` / `completed`: step 2 is read-only. Skeleton displayed for reference. PUT endpoint rejects with 403.

## Migration strategy

1. Prisma migration:
   - `CREATE TABLE workout_skeletons` with indexes/unique constraint.
   - `ALTER TABLE workout_exercises DROP COLUMN is_skeleton_exercise`.
2. No data migration script. Existing programs:
   - WE rows that had `isSkeletonExercise=true` become normal WE rows with sparse fields.
   - Trainer sees them as-is in step 3, can complete or delete.
   - For drafts, step 2 starts empty (no skeleton); trainer can re-create if desired.
3. Deploy ordering: code stops reading/writing `isSkeletonExercise` first (same release that adds the new table). Column drop runs in the same migration since the new code path doesn't touch it.

Edge case: existing draft with sparse WE rows + skeleton applied → step 3 shows existing WE rows alongside any rows hydrated from new skeleton (additive). Documented; minimal blast radius given few drafts in flight.

## Files affected

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `WorkoutSkeleton`; drop `isSkeletonExercise` |
| `prisma/migrations/<timestamp>_skeleton_table/migration.sql` | Create table + drop column |
| `src/app/api/programs/[id]/route.ts` | Include skeleton in GET payload |
| `src/app/api/programs/[id]/skeleton/route.ts` (new) | PUT handler with status guard |
| `src/schemas/skeleton.ts` (new) | Zod schema for skeleton payload |
| `src/app/trainer/programs/[id]/edit/_content.tsx` | Skeleton load/save; drop `isSkeletonExercise` from draft creation; hydrate step 3 from skeleton |
| `src/app/trainer/programs/[id]/edit/structure-utils.ts` | Source rows from skeleton (replaces sourcing from week 1's `workoutExercises`). Preserve "4 default empty rows when skeleton empty" UX from plan 2026-04-23. |
| `tests/integration/skeleton-api.test.ts` (new) | PUT/GET, status guard, cascade on program delete |
| `tests/unit/structure-utils.test.ts` | Update for new source shape |
| `tests/unit/edit-program-hydration.test.ts` (new) | Hydration merge logic (skeleton + WE → draft rows) |
| `implementation-docs/CHANGELOG.md` | Entry |

## Testing

- **Unit:** hydration merge — skeleton + existing WE → draft display rows. Skeleton-only-fields preserved on workouts with no WE.
- **Integration:** PUT skeleton replaces atomically; 403 when status !== draft; cascade-delete on program delete; GET shape correct.
- **E2E (manual or Playwright):** new program → step 2 → step 3 → save week 1 → back to step 2, change skeleton → forward to step 3 → week 1 unchanged, week 2+ reflect new skeleton.

## Risks / trade-offs

- **Pro:** clean separation; step 2 persists across refresh; foundation for TRN-009 ("create from previous"); no skeleton flag pollution in `WorkoutExercise`.
- **Con:** one new endpoint + table; column drop is irreversible.
- Risk: existing in-flight drafts lose visual "this was a skeleton row" hint after column drop. Acceptable since flag was UX-only and rows remain editable.

## Out of scope

- TRN-009 ("create program from previous") — separate plan; will reuse skeleton table.
- Per-week skeleton override — explicitly rejected (per-week edits live in WE only).
- Cascading skeleton edits to existing saved WE rows — explicitly rejected.
