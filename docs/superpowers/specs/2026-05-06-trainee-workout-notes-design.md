# Trainee Workout Notes — Design Spec

**Date:** 2026-05-06
**Status:** Approved

## Overview

Allow trainees to add a note per exercise and a summary note for the whole workout. Both are visible to the trainer. Implemented without adding new columns: `Workout.notes` (currently a dead field — readable but never written by any trainer API) is repurposed for the trainee workout summary via a rename.

---

## Schema

### Migration: rename `workouts.notes → workouts.trainee_notes`

```prisma
model Workout {
  id           String   @id @default(uuid())
  weekId       String
  dayIndex     Int
  traineeNotes String?  // renamed from notes; owned by trainee
  isCompleted  Boolean  @default(false)
  // ...
}
```

`Workout.notes` was never written by any trainer API (only displayed if non-null, always null in practice). The rename makes ownership explicit. No new columns added.

### `ExerciseFeedback.notes` — behaviour change only

Field already exists (`String?`). Currently misused: a single `globalNotes` string is duplicated identically across every `ExerciseFeedback` record for a workout. After this change: each record holds a note specific to that exercise, or null.

### Unchanged

`WorkoutExercise.notes` — trainer-authored per-exercise instructions. Read-only for trainee. Not touched.

---

## Storage Map

| Note type | DB field | Owner |
|---|---|---|
| Per-exercise trainee note | `ExerciseFeedback.notes` | trainee |
| Workout summary | `Workout.traineeNotes` | trainee |
| Trainer exercise instructions | `WorkoutExercise.notes` | trainer (unchanged) |

---

## API Changes

### 1. `PATCH /api/trainee/workout-exercises/[id]/feedback`

Add `notes` to `workoutExerciseAutosaveSchema`. Persist on the `ExerciseFeedback` upsert.

```typescript
// schema
notes: z.string().max(1000).nullish()

// upsert create + update
notes: notes ?? null
```

Triggered by a dedicated save button in `ExerciseFocusCard`. Not triggered by set completion.

### 2. `POST /api/trainee/workouts/[id]/submit`

- Remove top-level `notes` from `workoutSubmitSchema` (was the broken global notes field).
- Add `traineeNotes: z.string().max(1000).nullish()` at top level → written to `Workout.traineeNotes` via `prisma.workout.update`.
- Exercise array entries no longer carry `notes` — per-exercise notes are already saved before submit.

The submit route must not overwrite `ExerciseFeedback.notes` on any exercise.

### 3. `GET /api/trainee/workouts/[id]`

- Include `traineeNotes` in the `Workout` select.
- Include `notes` in each `ExerciseFeedback` select so the trainee UI pre-fills saved exercise notes on page load.

### 4. `GET /api/trainee/workouts/[id]/prev-week`

- Extend the raw SQL query to select `ef.notes` from `exercise_feedbacks`.
- Add `exerciseNote: string | null` to `PrevWeekExerciseItem` type and `PrevWeekRow` interface.

### 5. `GET /api/programs/[id]/workouts/[workoutId]/trainee-notes` *(new)*

Trainer-facing endpoint. Returns:

```typescript
{
  workoutNote: string | null,
  exercises: Array<{
    workoutExerciseId: string,
    exerciseName: string,
    note: string | null
  }>
}
```

Ownership check: trainer must own the program. Only returns non-null notes. Fetches latest `ExerciseFeedback` per `WorkoutExercise` (ordered by `updatedAt DESC`).

---

## UI Changes

### `WorkoutDetailContent` — state

Add `exerciseNotes: Record<string, string>` state. Pre-populate from `we.feedback.notes` on load. Persist in localStorage alongside existing `feedbackData` and `exerciseRPE`.

Remove `globalNotes` duplication bug: on load, `globalNotes` is populated from `workout.traineeNotes`, not from any `ExerciseFeedback.notes`.

### `ExerciseFocusCard`

Add below the RPE selector:
- **Textarea** — label from i18n key `workouts.exerciseNoteLabel`, max 1000 chars, 2 rows
- **Save button** (`<ActionIconButton>` or small `<Button isLoading={...}>`) — calls `PATCH /api/trainee/workout-exercises/[id]/feedback` with current `notes` value
- Note pre-filled from `exerciseNotes[we.id]` on render
- On save success: toast `workouts.exerciseNoteSaved`
- On save failure: toast with error, local state unchanged

### `FinalStep`

- Existing `globalNotes` textarea remains; label updated to `workouts.workoutSummaryLabel` / `workouts.workoutSummaryPlaceholder`
- On submit, sends `traineeNotes` (not per-exercise notes)
- No other changes

### `PrevWeekPanel`

For each exercise item, if `exerciseNote` is non-null:
- Render a note row below the sets list
- Style: `text-xs text-gray-500 italic` with a `<FileText>` icon

### Trainer workout detail (`/trainer/programs/[id]/workouts/[wId]`)

When `workout.isCompleted`:
- Fetch `GET /api/programs/[id]/workouts/[workoutId]/trainee-notes` on mount
- Render a collapsible "Note trainee" section at the bottom of the page
- Per-exercise notes: exercise name + note text, only those with non-null notes
- Workout summary: separate subsection "Riepilogo workout"
- Fetch failure: section hidden silently (no error shown to trainer)

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Exercise note save fails | Toast error; local state preserved (note not lost) |
| Submit fails | Existing behaviour; `traineeNotes` not written |
| Trainer `trainee-notes` fetch fails | Section hidden silently |

---

## Testing

- **Unit:** `workoutExerciseAutosaveSchema` accepts/rejects `notes`; `workoutSubmitSchema` validates `traineeNotes` top-level, no per-exercise `notes`
- **Integration:** `POST /submit` — `Workout.traineeNotes` is written; `ExerciseFeedback.notes` for each exercise is NOT overwritten
- **Integration:** `PATCH /feedback` with `notes` — `ExerciseFeedback.notes` is persisted on the correct record
- **Integration:** `GET /prev-week` — `exerciseNote` appears in response when feedback has a note
