# Trainee per-set RPE — Design

**Date:** 2026-05-13
**Status:** Approved — pending implementation plan

## Goal

Allow the trainee to record perceived RPE (5.0–10.0, step 0.5) for each individual set during a workout, and surface those values in the "previous week" panel.

## Scope

- Workout focus screen (`/trainee/workouts/[id]`): add an optional per-set RPE input alongside reps/kg.
- Persist per-set RPE in `sets_performed` via a new nullable column.
- Previous-week panel: append `@ RPE x` to each set row when RPE is recorded.

Out of scope:
- Workout recap panel within the same workout (does not render per-set details today).
- Trainer dashboard / reports aggregation of per-set RPE.
- Backfilling historical sets.
- Overall `exercise_feedbacks.actualRpe` semantics (kept unchanged).

## Data model

New nullable column on `sets_performed`:

```sql
ALTER TABLE "sets_performed" ADD COLUMN "actualRpe" DOUBLE PRECISION;
```

Prisma model:

```prisma
model SetPerformed {
  id         String   @id @default(uuid())
  feedbackId String
  setNumber  Int
  reps       Int
  weight     Float
  actualRpe  Float?   // RPE percepito 5.0–10.0, step 0.5, opzionale
  completed  Boolean  @default(true)
  createdAt  DateTime @default(now())
  feedback   ExerciseFeedback @relation("FeedbackSets", fields: [feedbackId], references: [id], onDelete: Cascade)
  @@unique([feedbackId, setNumber])
  @@index([feedbackId])
  @@map("sets_performed")
}
```

No new indexes (field is not a query key). No backfill required.

## Validation schemas

Extend `setPerformedSchema` in `src/schemas/feedback.ts`:

```ts
export const setPerformedSchema = z.object({
  setNumber: z.number().int().min(1).max(50),
  completed: z.boolean().default(true),
  reps: z.number().int().min(0).max(50),
  weight: z.number().min(0).max(500),
  actualRpe: z
    .number()
    .min(5.0, 'validation.rpeMin')
    .max(10.0, 'validation.rpeMax')
    .multipleOf(0.5, 'validation.rpeStep')
    .nullish(),
})
```

`workoutExerciseAutosaveSchema` and `workoutSubmitSchema` inherit the new field via reuse of `setPerformedSchema`.

## API

**Autosave route** `src/app/api/trainee/workout-exercises/[id]/feedback/route.ts` — propagate `actualRpe` in the `setPerformed.upsert`:

```ts
create: { ..., reps: set.reps, weight: set.weight, actualRpe: set.actualRpe ?? null },
update: { ..., reps: set.reps, weight: set.weight, actualRpe: set.actualRpe ?? null },
```

**Submit route** `src/app/api/trainee/workouts/[id]/submit/route.ts` — same propagation in the bulk set write.

**Prev-week route** `src/app/api/trainee/workouts/[id]/prev-week/route.ts` — add `sp."actualRpe" AS "setRpe"` to the SELECT and map it into `PrevWeekSet.actualRpe`.

## Shared types

`src/lib/workout-recap.ts`:

```ts
export interface PrevWeekSet {
  setNumber: number
  reps: number
  weight: number
  completed: boolean
  actualRpe: number | null
}
```

## UI — trainee workout focus card

File: `src/app/trainee/workouts/[id]/_content.tsx`.

`SetPerformed` interface gains `actualRpe: number | null`.

Initialization (`fetchWorkout`):
- When server returns existing feedback, pad with `actualRpe: existingSet?.actualRpe ?? null`.
- New sets default to `actualRpe: null`.

Set rows grid: change `grid-cols-[40px_1fr_1fr_48px]` → `grid-cols-[36px_1fr_1fr_1fr_44px]`. Header row adds an `RPE` label between `KG` and the check column.

New per-row component `RpeCell`:
- Compact button rendered as input-styled control showing `RPE 8.0` or `–`.
- Disabled when `set.completed` (RPE is editable only before check; consistent with reps/kg).
- Tap opens `RPESelector` with `centeredMenu={true}` (reuses the existing modal selector and italian descriptions).

Handler `updateSetRpe(workoutExerciseId, setIdx, rpe)` updates local state only (no network call).

`toggleSetCompleted`:
- On complete: include `actualRpe: currentSet.actualRpe` in the `newSet` object sent to `persistExerciseFeedback`.
- On deselect: reset `actualRpe: null` together with `reps=0` / `weight=0` (full row reset is consistent with current behaviour).

`persistExerciseFeedback` payload:

```ts
set: {
  setNumber: changedSet.setNumber,
  completed: !!changedSet.completed,
  reps: changedSet.reps,
  weight: changedSet.weight,
  actualRpe: changedSet.actualRpe ?? null,
}
```

`doSubmit` payload (`_content.tsx:584–599`) — include `actualRpe: s.actualRpe ?? null` in the sets mapping.

The overall exercise RPE selector at the bottom of the card is unchanged. The two RPE fields coexist.

## UI — previous week panel

`src/components/WorkoutExerciseDisplayList.tsx`:

```ts
performedSets: Array<{
  setNumber: number
  reps: number
  weight: number
  completed: boolean
  actualRpe?: number | null
}>

setRowLabel?: (set: number, reps: number, weight: number, rpe: number | null) => string

const defaultSetRow = (set, reps, weight, rpe) =>
  rpe != null
    ? `#${set} · ${reps} rep · ${weight} kg @ RPE ${rpe}`
    : `#${set} · ${reps} rep · ${weight} kg`
```

`src/components/PrevWeekPanel.tsx`:
- `displayItems` mapping propagates `actualRpe`.
- `setRowLabel` switches between two i18n keys based on RPE presence:

```ts
setRowLabel={(set, reps, weight, rpe) =>
  rpe != null
    ? t('workouts.prevWeekSetRowWithRpe', { set, reps, weight, rpe: rpe.toFixed(1) })
    : t('workouts.prevWeekSetRow', { set, reps, weight })
}
```

`__resetPrevWeekCacheForTests` still applies; cache key unchanged.

## i18n

`public/locales/it/trainee.json` and `public/locales/en/trainee.json` — add key `workouts.prevWeekSetRowWithRpe`:

- IT: `"#{{set}} · {{reps}} rep · {{weight}} kg @ RPE {{rpe}}"`
- EN: `"#{{set}} · {{reps}} reps · {{weight}} kg @ RPE {{rpe}}"`

Existing `workouts.prevWeekSetRow` retained for the no-RPE branch.

## Testing

**Unit**
- `tests/unit/rpe-schema.test.ts`: extend — `setPerformedSchema` accepts `actualRpe` null, 5.0, 10.0, 8.5; rejects 4.5, 10.5, 7.3, non-number.
- `tests/unit/WorkoutExerciseDisplayList.test.tsx`: row with `actualRpe` renders `@ RPE x`; null renders no suffix; custom `setRowLabel` receives rpe argument.
- New `tests/unit/RpeCell.test.tsx` (if `RpeCell` is extracted as a component): disabled when `set.completed`, tap opens selector, `onChange` propagates.

**Integration**
- `tests/integration/workout-exercise-rpe.test.ts`: extend — PATCH with `set.actualRpe` writes to `sets_performed.actualRpe`; null clears it.
- New `tests/integration/prev-week-set-rpe.test.ts`: seed feedback with per-set RPE, GET `/prev-week` returns `actualRpe` in the set payload.
- Existing workout submit integration test (if any): bulk submit with per-set RPE persists correctly.

**Manual**
- `npm run dev` → trainee workout page → enter RPE on two sets → check both → reload → values persist → advance one week in time data → prev-week panel renders `@ RPE x` for those sets only.

## Risks & open questions

- Grid with five columns on narrow phones (320–360px) — `RpeCell` must stay readable. Mitigation: width `min-w-[52px]`, font-size `text-xs`. Verify in browser.
- User selects RPE but never taps the check → RPE is discarded with reset. Documented behaviour: RPE is "editable only until completed", so this matches the chosen UX.
- Future analytics (avg RPE per exercise, RPE progression) can rely on the new column with no schema change.
