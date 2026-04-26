# API Efficiency Audit — Checklist

> Date: 2026-04-24
> Scope: all route handlers under `src/app/api/**`, `src/middleware.ts`, `src/lib/auth.ts`, `src/lib/calculations.ts`
> Reference: `docs/performance-analysis.md`, `.claude/skills/zero-cento-backend/SKILL.md`

Actionable checklist. Tick items when implemented. Grouped by impact.

---

## CRITICAL

### [x] 1. Eliminate `calculateEffectiveWeight` N+1

- **Files:** `src/lib/calculations.ts:13-102`, `src/app/api/programs/[id]/route.ts:102-153`, `src/app/api/trainee/workouts/[id]/route.ts:96-142`
- **Problem:** per-exercise `personalRecord.findFirst` + recursive `workoutExercise.findFirst` for `percentage_previous`. Hundreds of serial DB hits on trainee program view.
- [x] Pre-fetch all `PersonalRecord` rows for trainee once (single query) — select `exerciseId, reps, weight, recordDate`. → `loadTraineePrMap()` in `src/lib/calculations.ts`
- [x] Build `Map<"${exerciseId}:${reps}", weight>` keyed on most recent date per pair.
- [x] Add sync `resolveEffectiveWeight(we, prMap, siblings)` in `src/lib/calculations.ts` accepting the map + workout siblings (for `percentage_previous` in-memory lookup). Old async `calculateEffectiveWeight` kept for test compat.
- [x] Update `GET /api/programs/[id]` trainee branch to pre-fetch map + resolve sync.
- [x] Update `GET /api/trainee/workouts/[id]` to pre-fetch map + resolve sync (parallelized with feedback fetch).
- [ ] Tests: verify 1 PR query regardless of program size. *(vitest runtime blocked by Node 18 vs required Node 20 — type-check passes)*

---

### [x] 2. `GET /api/programs` — remove writes + collapse aggregates

- **File:** `src/app/api/programs/route.ts:84-304`
- [x] Remove `Promise.all(programsToComplete.map(prisma.trainingProgram.update))` from GET handler. Effective status now computed in-memory only; auto-complete persistence deferred (candidate for a cron job or feedback/workout-completion endpoint — out of scope for this item).
- [x] Replace nested `weeks → workouts → workoutExercises → exerciseFeedbacks` fetch with single `$queryRaw` CTE aggregate returning `{ totalWorkouts, completedWorkouts, lastCompletedWorkoutAt, lastFeedbackAt }` per program.
- [x] Replace `programsWithTestWeeks` nested fetch + `completedFeedbacks.findMany` with single `$queryRaw` CTE aggregate returning `{ weekNumber, plannedTestsCount, completedTestsCount }` per test week.
- [x] Top-level `findMany` unchanged (still needs `weeks { id, weekNumber, weekType }` — used by clients).
- [x] Tests: `tests/integration/programs.test.ts` updated — added `$queryRaw` mock, removed auto-complete persistence assertion (now asserts `prisma.trainingProgram.update` not called), mocked aggregate rows. Type-check clean.
- **Query count after fix:** 1 `findMany` + up to 2 `$queryRaw` aggregates (completion + test weeks). Previously 1 + up to 3 (active progress + test weeks + completed feedbacks) + N updates.

---

### [ ] 3. `GET /api/programs/[id]/reports` — replace tree load with SQL aggregates

- **File:** `src/app/api/programs/[id]/reports/route.ts:24-73`
- [ ] Replace program tree fetch with `$queryRaw` aggregates per report section.
- [ ] SBD report: raw query grouping `SetPerformed` by exercise-name pattern, computing `SUM(reps*weight)`, `COUNT(*)`, `AVG(actualRpe)`.
- [ ] Muscle-group sets: join `WorkoutExercise → Exercise → ExerciseMuscleGroup → MuscleGroup`, aggregate `SUM(sets * coefficient)`.
- [ ] Movement-pattern volume: `SUM(reps*weight)` grouped by `movementPatternId`.
- [ ] RPE distribution: single raw query with `CASE WHEN` bucketing.
- [ ] Ownership check stays; keep program metadata fetch slim (`select: { trainerId, traineeId, title, trainee }`).
- [ ] Tests: verify payload size drop + correctness vs. current impl.

---

### [ ] 4. `GET /api/programs/[id]/progress` — aggregate counts

- **File:** `src/app/api/programs/[id]/progress/route.ts:31-53`
- [ ] Keep program metadata fetch slim (no nested `weeks`).
- [ ] Replace per-week reduce with `week.findMany({ select: { weekNumber, weekType } })` + one `exerciseFeedback.groupBy({ by: ['workoutId'], where: { completed: true }, _count })` aggregate.
- [ ] Compute `totalVolume` via `$queryRaw SUM(reps*weight)` scoped to program.
- [ ] Compute `avgRPE` via `exerciseFeedback.aggregate({ _avg: { actualRpe } })`.
- [ ] Compute `completedWorkouts` via raw SQL with `HAVING COUNT(all required feedbacks)`.
- [ ] Tests: match current JSON shape.

---

## HIGH

### [ ] 5. `POST /programs/[id]/workouts/[workoutId]/exercises` — merge 3 queries into 1

- **File:** `src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts:44-89`
- [ ] Replace `trainingProgram.findUnique` (with `weeks + workouts` include) with single:
  ```ts
  prisma.workout.findFirst({
      where: { id: workoutId, week: { programId } },
      select: {
          id: true,
          week: { select: { program: { select: { trainerId: true, status: true } } } },
      },
  })
  ```
- [ ] Drop separate `exercise.findUnique` — FK catches missing exercise.
- [ ] Tests: happy path + 404 when workout belongs to other program.

---

### [ ] 6. `PUT / DELETE .../exercises/[exerciseId]` — merge ownership queries

- **File:** `src/app/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route.ts:42-84, 151-187`
- [ ] Merge `trainingProgram.findUnique` + `workoutExercise.findUnique` into one `workoutExercise.findFirst` with nested `where`:
  ```ts
  prisma.workoutExercise.findFirst({
      where: { id: exerciseId, workoutId, workout: { week: { programId } } },
      include: {
          workout: { select: { week: { select: { program: { select: { trainerId: true, status: true } } } } } },
      },
  })
  ```
- [ ] DELETE reorder step (L190-205): drop reorder entirely (gaps in `order` harmless when sorted `asc`) OR replace loop with single raw `UPDATE ... CASE WHEN`.
- [ ] Tests: ownership check, reorder invariant after delete.

---

### [ ] 7. Reorder route — batch UPDATE

- **File:** `src/app/api/programs/[id]/workouts/[workoutId]/exercises/reorder/route.ts:76-83`
- [ ] Replace N-call `$transaction(exercises.map(prisma.update))` with:
  ```ts
  await prisma.$executeRaw`
      UPDATE "WorkoutExercise"
      SET "order" = CASE "id"
          ${Prisma.join(exercises.map((e) => Prisma.sql`WHEN ${e.id}::uuid THEN ${e.order}`), ' ')}
      END
      WHERE "id" IN (${Prisma.join(exercises.map((e) => Prisma.sql`${e.id}::uuid`))})
  `
  ```
- [ ] Keep ownership pre-check via combined `findFirst` (no separate program query).
- [ ] Tests: reordering correctness + single statement executed.

---

### [ ] 8. `POST /programs/[id]/publish` — aggregate empty check + batch week update

- **File:** `src/app/api/programs/[id]/publish/route.ts:38-52, 101-110`
- [ ] Replace full tree load with aggregate:
  ```ts
  const emptyCount = await prisma.workout.count({
      where: { week: { programId }, workoutExercises: { none: {} } },
  })
  ```
- [ ] Replace `Promise.all(weeks.map(update))` with single `$executeRaw` computing `startDate = programStart + (weekNumber - 1) * 7` interval.
- [ ] Keep ownership/status checks via slim `findUnique({ select: { trainerId, status, durationWeeks } })`.
- [ ] Tests: publish end-to-end, date arithmetic.

---

### [ ] 9. `PATCH / DELETE /personal-records/[id]` — apply Rule 3

- **File:** `src/app/api/personal-records/[id]/route.ts:41-49, 129-135`
- [ ] Replace `trainerTrainee.findUnique({ where: { traineeId } })` + manual `trainerId` compare with:
  ```ts
  const relation = await prisma.trainerTrainee.findFirst({
      where: { trainerId: session.user.id, traineeId: record.traineeId },
  })
  if (!relation) return apiError('FORBIDDEN', ..., 'personalRecord.updateDenied')
  ```
- [ ] Tests: update + delete access control (other trainer denied).

---

### [ ] 10. `GET / PUT / DELETE /api/users/[id]` — single-query ownership

- **File:** `src/app/api/users/[id]/route.ts:23-53, 81-107, 151-172`
- [ ] Trainer role: single query combining user fetch + ownership:
  ```ts
  prisma.user.findFirst({
      where: { id, traineeOf: { some: { trainerId: session.user.id } } },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
  })
  ```
- [ ] Admin role: keep `findUnique`.
- [ ] Apply to all three handlers (GET, PUT, DELETE).
- [ ] Tests: trainer sees own trainee, denied on others.

---

### [ ] 11. `POST /programs` — parallelize / merge validation

- **File:** `src/app/api/programs/route.ts:366-420`
- [ ] Trainer path: replace sequential `user.findUnique` + `trainerTrainee.findFirst` with single combined query:
  ```ts
  prisma.trainerTrainee.findFirst({
      where: { trainerId: session.user.id, traineeId, trainee: { role: 'trainee' } },
      select: { trainerId: true, trainee: { select: { id: true, role: true } } },
  })
  ```
- [ ] Admin path: parallelize `user.findUnique` + `trainerTrainee.findUnique` via `Promise.all`.
- [ ] Tests: creation access control paths.

---

### [ ] 12. `POST /feedback` — collapse ownership + add unique index

- **File:** `src/app/api/feedback/route.ts:176-222` + `prisma/schema.prisma`
- [ ] Replace nested-include ownership load with:
  ```ts
  prisma.workoutExercise.findFirst({
      where: { id: workoutExerciseId, workout: { week: { program: { traineeId: session.user.id } } } },
      select: { id: true },
  })
  ```
- [ ] Add `@@unique([workoutExerciseId, traineeId, date])` on `ExerciseFeedback` in schema; run migration.
- [ ] Switch idempotency lookup (L210-222) from `findFirst` to `findUnique` on composite key.
- [ ] Tests: create + update (idempotency) paths.

---

## MEDIUM

### [ ] 13. `DELETE /exercises/[id]` — aggregate active-program check

- **File:** `src/app/api/exercises/[id]/route.ts:237-258`
- [ ] Replace full `workoutExercise.findMany` with nested include by:
  ```ts
  prisma.workoutExercise.findFirst({
      where: { exerciseId, workout: { week: { program: { status: 'active' } } } },
      select: {
          workout: { select: { week: { select: { program: { select: { id: true, title: true } } } } } },
      },
  })
  ```
- [ ] Tests: delete allowed when only draft/completed usage; denied when active.

---

### [ ] 14. `POST /personal-records` — parallelize existence checks

- **File:** `src/app/api/personal-records/route.ts:125-154`
- [ ] Merge trainer ownership + trainee role check into single `trainerTrainee.findFirst({ trainerId, traineeId, trainee: { role: 'trainee' } })`.
- [ ] Drop separate `exercise.findUnique` (FK catches) or parallelize remaining checks with `Promise.all`.
- [ ] Tests: validation paths still return correct error codes/keys.

---

### [ ] 15. `GET /feedback` — narrow includes + explicit where builder

- **File:** `src/app/api/feedback/route.ts:92-134`
- [ ] Replace nested `workout → week → program` full-object include with narrow `select` (only fields client actually uses).
- [ ] Refactor L55-89 `where` object-spread reassignment chain to single explicit `AND` composition.
- [ ] Tests: filtering by traineeId/programId/exerciseId unchanged.

---

## Cross-cutting

### [ ] 16. Eliminate serial `update` loops inside `$transaction`

- [ ] reorder route (#7)
- [ ] programs GET auto-complete (#2)
- [ ] DELETE exercise reorder step (#6)
- [ ] publish week-date loop (#8)

### [ ] 17. Drop unnecessary FK existence checks

- [ ] `POST /exercises` (movementPattern.findUnique, muscleGroup.findMany → rely on FK + coefficient validation)
- [ ] `PUT /exercises/[id]` same pattern
- [ ] `POST /programs` trainee existence (merged via #11)
- [ ] `POST /workouts/.../exercises` exercise existence (merged via #5)

### [ ] 18. Writes inside GET handler

- [ ] `GET /api/programs` auto-complete loop (#2) — move to cron or feedback endpoint.

---

## Priority order (implementation roadmap)

1. [ ] #1 PR pre-fetch + sync calc — biggest trainee-path win, low risk
2. [ ] #2 `GET /programs` aggregates + remove writes — hit on every trainer dashboard
3. [ ] #7 Reorder batch UPDATE + #16 auto-complete batch
4. [ ] #9, #10 Ownership `findFirst` consolidation (Rule 3 alignment)
5. [ ] #3, #4 Reports + progress aggregates — biggest payload reduction
6. [ ] #5, #6 Workout-exercise ownership merge — hot path during draft edit
7. [ ] #8 Publish optimization
8. [ ] #11, #12, #13, #14, #15 — medium polish
