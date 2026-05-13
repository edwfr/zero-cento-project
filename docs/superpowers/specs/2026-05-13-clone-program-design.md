# Clone Program — Design

Status: Draft
Date: 2026-05-13
Owner: trainer-facing program creation flow

## Goal

Let a trainer start a new program from an existing one by copying the source program's `WorkoutSkeleton` rows and pre-filling step 1 of the new-program wizard. Clicking "Clone" must not write anything to the database — persistence happens only on wizard submit.

## Non-goals

- Copying `WorkoutExercise` prescriptions (sets/reps/RPE/weight/notes). Trainer fills those from scratch in step 3.
- Copying week types (`normal | test | deload`). New program uses defaults.
- Multi-program batch clone, scheduled clone, or trainee→trainee transfer.

## User flows

### Entry points

1. **`/trainer/programs` row** — per-program action button in `InlineActions`, available on draft, active, and completed.
2. **`/trainer/trainees/[id]` programs tab row** — same button on every program of that trainee.

### Click behavior

- Click `Clone` → navigate to `/trainer/programs/new?cloneFromProgramId=<sourceId>`.
- From the trainee detail page, also carry `&traineeId=<traineeId>` so a "Start blank instead" cancel still respects the trainee context.
- No API call on click. No DB write.

### Step 1 (pre-filled wizard)

- Server `page.tsx` reads `cloneFromProgramId` from the query string. When present, it fetches the source program through `requireTrainerProgramOwnership(sourceId)` and selects `{ id, title, traineeId, workoutsPerWeek, isSbdProgram }`.
- That object is passed to `NewProgramContent` as a new `cloneSource` prop.
- Initial form state when `cloneSource` is present:
  - `title` — empty
  - `traineeId` — `cloneSource.traineeId` (editable select)
  - `workoutsPerWeek` — `cloneSource.workoutsPerWeek` (LOCKED: number input `readOnly`, chip buttons `disabled`)
  - `isSbdProgram` — `cloneSource.isSbdProgram` (editable checkbox)
  - `durationWeeks` — `4` (default, editable)
- Info banner above the form: `Trans i18nKey="programs.cloneFromBanner" values={{ title: cloneSource.title }}`. Includes a "Start blank instead" link that navigates to `/trainer/programs/new` (drops `cloneFromProgramId`, preserves `traineeId` if originally present).
- Helper text under workouts-per-week field: `programs.workoutsPerWeekLockedByClone`.

### Submit

- Form POSTs to `/api/programs` with the existing payload plus `cloneFromProgramId`.
- API creates the program AND copies the source's `WorkoutSkeleton` rows in one transaction.
- Client redirects to `/trainer/programs/<newId>/edit` as today.

### Step 2 onward

- No changes. `skeleton-hydration.ts` already turns persisted skeleton rows into draft `WorkoutExercise` shells for empty workouts.

## UI details

### Clone button

- Add a new variant to `ActionIconButton` (e.g. `variant="clone"`) backed by lucide-react's `Copy` icon. If introducing a new variant is heavier than warranted, use an inline `ActionIconButton` with explicit `icon={Copy}` instead — pick whichever matches the existing pattern.
- Label key: `programs.cloneProgram` → "Clona programma".
- Insert into the `InlineActions` block in both:
  - `src/app/trainer/programs/_content.tsx` (in the draft branch AND in the active/completed branch)
  - `src/app/trainer/trainees/[id]/_content.tsx` (in the programs tab row actions)
- Visible on all program statuses.
- Click handler: `router.push('/trainer/programs/new?cloneFromProgramId=<id>')` (append `&traineeId=<traineeId>` on the trainee detail page).

### Banner

- Tailwind blue/info card matching the existing summary card pattern in `NewProgramContent`.
- Copy (en): "Cloning skeleton from **{title}**. [Start blank instead]"
- Copy (it): "Sto clonando lo scheletro da **{title}**. [Ricomincia da zero]"

### Workouts-per-week lock

- Number input gets `readOnly` and `disabled`.
- Chip buttons get `disabled`.
- Helper text below the field explains why.

## API

### Schema (`src/schemas/program.ts`)

Extend `createProgramSchema` with an optional field:

```ts
cloneFromProgramId: z.string().uuid().optional()
```

### `POST /api/programs` extension

When `cloneFromProgramId` is provided:

1. Fetch the source program: `{ id, trainerId, workoutsPerWeek }`. If missing → 404 `program.cloneSourceNotFound`.
2. RBAC: caller must own the source (`source.trainerId === session.user.id`) or be admin. Otherwise 403 `program.cloneDenied`.
3. Validate `body.workoutsPerWeek === source.workoutsPerWeek`. Mismatch → 400 `validation.workoutsPerWeekMismatchWithClone` (defensive; UI locks the field).
4. Within a `prisma.$transaction`:
   - Run the existing program creation (program + weeks + workouts).
   - `tx.workoutSkeleton.findMany({ where: { programId: source.id } })`.
   - `tx.workoutSkeleton.createMany({ data: rows.map(r => ({ programId: newProgram.id, dayIndex: r.dayIndex, order: r.order, exerciseId: r.exerciseId })) })` (skip the call when there are zero source rows).
5. Existing trainee ownership check (trainer must own the selected trainee via `TrainerTrainee`) runs unchanged, before any clone work.

No new GET endpoint. `page.tsx` queries the source program directly via Prisma.

### New i18n keys

- `trainer.programs.cloneProgram` — button label
- `trainer.programs.cloneFromBanner` — banner copy with `{title}` interpolation
- `trainer.programs.cloneCancelLink` — "Start blank instead" / "Ricomincia da zero"
- `trainer.programs.workoutsPerWeekLockedByClone` — helper text
- `common.errors.program.cloneDenied` — 403
- `common.errors.program.cloneSourceNotFound` — 404
- `common.errors.validation.workoutsPerWeekMismatchWithClone` — 400

(Keys grouped under existing namespaces in `public/locales/{en,it}/`.)

## Data integrity & edge cases

- **Atomicity**: program + skeleton are created in a single `prisma.$transaction`.
- **Empty source skeleton**: clone succeeds, new program has zero skeleton rows.
- **Tampered `workoutsPerWeek`**: blocked by defensive 400.
- **Trainee change in select**: allowed; skeleton has no trainee binding. Existing trainer-trainee ownership check still gates the choice.
- **Different `durationWeeks`**: no impact; skeleton is per-day, not per-week.

## Testing

### Unit

- `tests/unit/program-schema.test.ts` (extend or add): `createProgramSchema` accepts optional `cloneFromProgramId`, rejects non-uuid strings.
- `tests/unit/NewProgramContent.test.tsx` (add):
  - With `cloneSource` prop set, `workoutsPerWeek` input and chip buttons are disabled.
  - Banner renders with the source title; "Start blank instead" link clears `cloneFromProgramId` from the URL.
  - Trainee select pre-selects `cloneSource.traineeId`; isSbdProgram pre-checked from `cloneSource.isSbdProgram`; title empty; durationWeeks=4.
  - Form submit body includes `cloneFromProgramId`.

### Integration (new file: `tests/integration/programs-clone.test.ts`)

- POST with valid `cloneFromProgramId` → new program created and `WorkoutSkeleton` rows copied (count, dayIndex, order, exerciseId match source).
- Atomicity: simulate skeleton copy failure → program creation rolled back.
- RBAC: trainer A cannot clone trainer B's program → 403.
- Mismatched `workoutsPerWeek` between body and source → 400.
- Empty source skeleton → succeeds, 0 rows on new program.
- Source program with `status='active'` clones successfully.
- Source program with `status='completed'` clones successfully.

### E2E

None added (existing repo reserves e2e for critical user paths).

## Files touched (summary)

- `src/schemas/program.ts` — add `cloneFromProgramId` field.
- `src/app/api/programs/route.ts` — extend POST with clone branch + transaction.
- `src/app/trainer/programs/new/page.tsx` — read query param, fetch source, pass `cloneSource`.
- `src/app/trainer/programs/new/NewProgramContent.tsx` — accept `cloneSource`, prefill state, lock field, render banner, include `cloneFromProgramId` in POST body.
- `src/app/trainer/programs/_content.tsx` — clone `ActionIconButton` in both InlineActions branches.
- `src/app/trainer/trainees/[id]/_content.tsx` — clone `ActionIconButton` in programs tab row actions.
- `src/components/ActionIconButton.tsx` — add `clone` variant (or use inline icon override; decide during implementation).
- `public/locales/en/trainer.json`, `public/locales/it/trainer.json` — new program keys.
- `public/locales/en/common.json`, `public/locales/it/common.json` — new error keys.
- Test files listed above.
- `implementation-docs/CHANGELOG.md` — note the feature.
