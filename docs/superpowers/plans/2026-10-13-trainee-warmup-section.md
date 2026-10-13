# Trainee Warm-up Section Implementation Plan

> **For agentic workers:** execute with `/feature-implement <this file>` in a fresh
> Sonnet session. Read this header, then one task at a time. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** In the in-progress workout view the trainee steps only through the non-warm-up
exercises (counter, progress, reminders and completion all ignore warm-up), and finds the
warm-up exercises in a dedicated collapsible panel where logging is optional.

**Architecture:** A pure helper splits a workout's exercises into `warmup` and `main`.
The focus-mode page (`src/app/trainee/workouts/[id]/_content.tsx`) builds its steps,
counters, progress and final-step warnings from `main` only and renders a new file-local
`WarmupPanel` above the exercise card; the panel reuses the existing set-logging grid
(extracted into a file-local `SetRowsGrid`) and the existing autosave handlers, so no new
API is needed. Server side, `cascadeFromWorkout` in `src/lib/completion-service.ts` counts
only non-warm-up exercises when deciding whether a workout is complete. No schema change:
`WorkoutExercise.isWarmup` already exists and the trainer keeps configuring it as today.

## Design

### Behaviour

Example: workout with 6 warm-up + 6 other exercises.

- Steps: 6 exercise steps + final summary step (today: 12 + 1). Bottom counter `1 / 6`.
- Banner progress %: completed sets / planned sets of the 6 main exercises only.
- Final step: `summaryStats` `done / total` and set count over the 6 main exercises; the
  amber "incomplete" warning cards list main exercises only. Warm-up never appears there.
- Warm-up panel: collapsible card rendered **above** the exercise card on every exercise
  step **and on the final step**, not rendered at all when the workout has no warm-up.
  - Header: `Flame` icon, title, neutral progress chip `done / total` (gray, turns green
    when all warm-up exercises are done; **never amber/red** — it is evidence, not a reminder).
  - Default state: expanded when the page lands on step 0 and at least one warm-up
    exercise is not completed; collapsed otherwise. It collapses automatically whenever
    `currentStep` changes (same idea as `closeSignal` in `WorkoutRecapPanel`). The trainee
    can reopen it at any step.
  - Body: one row per warm-up exercise ordered by `order`: status icon, name, variant,
    spec line (`3 x 10 · 20kg · @RPE 6`, same format as the final-step cards). Tapping a
    row expands it inline (one row expanded at a time) showing trainer `notes`, the video
    toggle when `youtubeUrl` exists, and the set-logging grid.
  - Logging is optional and behaves exactly like a main exercise: same inputs, same
    per-set autosave (`toggleSetCompleted` → `PATCH /api/trainee/workout-exercises/:id/feedback`),
    same "max reps required" toast. No exercise-note textarea for warm-up rows.
- Recap panel ("Riepilogo esercizi"): lists main exercises only.
- Final submit: payload still contains **all** exercises (warm-up included), unchanged.
- Workout auto-completion (server): a workout is complete when it has at least one
  non-warm-up exercise and every non-warm-up exercise is completed. Completing or
  un-completing a warm-up exercise never changes the workout's state.

### Edge cases

- **Workout made only of warm-up exercises:** not a meaningful configuration, so **no
  special handling** (explicit user decision). The standard rule applies as is: zero
  exercise steps, the page opens directly on the final step with the warm-up panel above
  the summary, and the workout completes only through the final submit (the server never
  auto-completes it, same as a workout with no exercises). Do not add a fallback.
- **Resumed step from localStorage:** `currentStep` saved by an older client indexes the
  full exercise list. It is clamped to `main.length`; landing on a different exercise once
  is accepted, no migration of drafts.
- **Fully un-logged warm-up at submit:** the submit route stores `isCompleted=false` for
  those `WorkoutExercise` rows and force-completes the workout, as today.

### Out of scope (do not touch)

- "Inizia workout" entry points, dashboard, `ProgramDetailContent`, history, PDF export,
  `PrevWeekPanel`, every trainer page, every API route handler, Prisma schema.

### Rejected alternatives

- *Fallback for all-warm-up workouts (treat them as main exercises)* — rejected by the
  user: the case makes no sense in practice, keep one rule everywhere.
- *Dedicated "step 0" page for warm-up* — rejected by the user in favour of the
  collapsible panel.
- *Read-only warm-up list* — rejected: the trainer would lose warm-up feedback.
- *UI-only change, server completion unchanged* — rejected: the workout would not
  auto-complete (and the completion toast would not fire) until warm-up sets are logged,
  which contradicts "no reminder on warm-up".
- *New `WarmupPanel.tsx` in `src/components/`* — rejected: it needs the file-local
  `RpeCell`, the set grid and the page's handlers; the page already keeps
  `ExerciseFocusCard`, `FinalStep` and `RpeCell` file-local.

## Global Constraints

- Before touching code, invoke the matching project skill: `zero-cento-backend`,
  `zero-cento-frontend`, `zero-cento-testing`.
- No Prisma migration, no new API route, no change to request/response shapes.
- Warm-up must never produce a warning, amber styling, toast or counter increment.
- i18n: every new string in both `public/locales/it/trainee.json` and
  `public/locales/en/trainee.json`, under `workouts`. The files have no BOM and use
  4-space indentation; keep it.
- Loader rule from `CLAUDE.md`: no new raw `<button disabled={loading}>` for async
  actions. The set-complete button is moved as is (existing code), not rewritten.
- After each task add an entry at the top of `## [Unreleased]` in
  `implementation-docs/CHANGELOG.md` in the existing format (Italian) and include it in
  the task's commit.
- Commit on the current branch with conventional-commit messages. Do not push.

## Review Focus

1. **Counters ignore warm-up** — 1 warm-up + 2 main exercises: bottom counter shows
   `current: 1, total: 2`, final step is reached after 2 "next", `summaryStats` total is 2.
   Pinned in Task 4.
2. **No reminder for warm-up** — final step with an un-logged warm-up exercise shows no
   warning card for it. Pinned in Task 4.
3. **Optional logging still persists** — ticking a set inside the warm-up panel sends the
   same PATCH as a main exercise. Pinned in Task 5.
4. **Server completion ignores warm-up** — main all done + warm-up incomplete → workout
   completed; un-completing a warm-up exercise does not reopen it. Pinned in Task 2.
5. **No all-warm-up fallback anywhere** — helper returns `main: []`, server does not
   auto-complete, page shows final step + panel without crashing. Pinned in Tasks 1, 2, 5.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/workout-warmup.ts` (new) | `partitionWarmup()` pure helper | 1 |
| `tests/unit/workout-warmup.test.ts` (new) | helper tests | 1 |
| `src/lib/completion-service.ts` | workout completion counts non-warm-up only | 2 |
| `tests/unit/completion-service.test.ts` | new cases + adjusted mocks | 2 |
| `public/locales/{it,en}/trainee.json` | new `workouts.warmup*` keys | 3 |
| `src/app/trainee/workouts/[id]/_content.tsx` | steps/counters on `main`; `SetRowsGrid`; `WarmupPanel` | 4, 5 |
| `tests/unit/trainee-workout-focus.test.tsx` | page tests | 4, 5 |
| `src/components/WorkoutRecapPanel.tsx` | list main exercises only | 6 |
| `tests/unit/workout-recap-panel.test.tsx` | recap test | 6 |

---

### Task 1: `partitionWarmup` helper

**Model:** sonnet
**Depends on:** none
**Files:** `src/lib/workout-warmup.ts` (new), `tests/unit/workout-warmup.test.ts` (new)
**Test command:** `npx vitest run tests/unit/workout-warmup.test.ts`
**Done when:** the helper returns both lists sorted by `order`, with no special case.

- [x] **Step 1: tests** — `tests/unit/workout-warmup.test.ts`
  - `[]` → `{ warmup: [], main: [] }`
  - `[main(order 2), warm(order 1), main(order 3)]` → `warmup: [warm]`, `main: [order 2, order 3]`
  - unsorted input `[main(3), warm(4), main(1), warm(2)]` → `main` orders `[1, 3]`, `warmup` orders `[2, 4]`
  - all warm-up `[warm(2), warm(1)]` → `warmup` orders `[1, 2]`, `main: []` (no fallback)
  - no warm-up → `warmup: []`, `main` = all sorted
  - input array is not mutated (same order after the call)
- [x] **Step 2: implementation**

  ```ts
  export interface WarmupPartition<T> {
      warmup: T[]
      main: T[]
  }

  /** Splits workout exercises into warm-up and main, both sorted by `order`. */
  export function partitionWarmup<T extends { isWarmup: boolean; order: number }>(
      exercises: readonly T[]
  ): WarmupPartition<T>
  ```

  Sort a copy by `order`, filter twice.
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(trainee): add partitionWarmup helper`

---

### Task 2: workout completion ignores warm-up

**Model:** sonnet
**Depends on:** none
**Files:** `src/lib/completion-service.ts` (modify), `tests/unit/completion-service.test.ts` (modify)
**Test command:** `npx vitest run tests/unit/completion-service.test.ts`
**Done when:** `cascadeFromWorkout` marks a workout completed when it has non-warm-up
exercises and all of them are completed, regardless of warm-up rows.

- [x] **Step 1: tests** — add to `tests/unit/completion-service.test.ts`, same `mockTx`
      structure as the first test in the file
  - main counts `incomplete 0, total 2` → workout updated to `isCompleted: true`;
    `workoutExercise.count` called exactly twice, both with `where` containing `isWarmup: false`
  - main counts `incomplete 1, total 2` → workout stays incomplete
  - main counts `0, 0` (workout with only warm-up exercises) → workout not completed,
    `workout.update` not called, `count` called exactly twice (no fallback query)
  - existing test "should handle empty workout (no exercises)" stays green untouched
  - `cascadeWorkoutCompletion(workoutId, true)` test stays green untouched (forced path
    does no exercise count)
- [x] **Step 2: implementation** — only the `if (typeof workoutIsCompleted !== 'boolean')`
      block in `cascadeFromWorkout` changes. The existing tests mock `count` with ordered
      `mockResolvedValueOnce`, so **keep the call order: incomplete first, total second**,
      sequential `await`s as today:

  ```ts
  if (typeof workoutIsCompleted !== 'boolean') {
    // Warm-up exercises are optional for the trainee: they never gate completion.
    const incompleteCount = await tx.workoutExercise.count({
      where: { workoutId, isWarmup: false, isCompleted: false },
    })
    const totalCount = await tx.workoutExercise.count({
      where: { workoutId, isWarmup: false },
    })

    workoutIsCompleted = totalCount > 0 && incompleteCount === 0
  }
  ```

  Update the JSDoc "Cascade rules" on `cascadeCompletion`: "if ALL non-warm-up exercises
  in workout are completed". Leave the week/program queries
  (`workoutExercises: { some: {} }`) untouched. If an existing assertion checks the exact
  `where` of `workoutExercise.count`, update it to include `isWarmup: false`.
- [x] **Step 3: run the test command, then**
      `npx vitest run tests/integration/workout-exercise-feedback.test.ts tests/integration/workout-exercise-complete.test.ts tests/integration/trainee-workout-submit.test.ts`
      **and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** —
      `feat(completion): ignore warm-up exercises when completing a workout`

---

### Task 3: i18n keys

**Model:** haiku
**Depends on:** none
**Files:** `public/locales/it/trainee.json` (modify), `public/locales/en/trainee.json` (modify)
**Test command:** `node -e "for (const l of ['it','en']) { const w = require('./public/locales/'+l+'/trainee.json').workouts; for (const k of ['warmupTitle','warmupHint','warmupProgress']) if (!w[k]) throw new Error(l+' '+k) }"`
**Done when:** the three keys exist in both locales under `workouts`.

- [ ] **Step 1: add the keys** inside the `workouts` object, next to `recapTitle`

  | key | it | en |
  |---|---|---|
  | `warmupTitle` | `Riscaldamento` | `Warm-up` |
  | `warmupHint` | `Da fare prima di iniziare. Registrare i set è facoltativo.` | `Do these before you start. Logging sets is optional.` |
  | `warmupProgress` | `{{done}} / {{total}}` | `{{done}} / {{total}}` |

  Keep 4-space indentation, no BOM, valid JSON (mind the trailing comma of the previous line).
- [ ] **Step 2: run the test command**
- [ ] **Step 3: CHANGELOG entry and commit** — `chore(i18n): add trainee warm-up section keys`

---

### Task 4: focus mode steps, counters and summary on main exercises only

**Model:** sonnet
**Depends on:** Task 1
**Files:** `src/app/trainee/workouts/[id]/_content.tsx` (modify), `tests/unit/trainee-workout-focus.test.tsx` (modify)
**Test command:** `npx vitest run tests/unit/trainee-workout-focus.test.tsx`
**Done when:** with warm-up exercises in the fixture, the page never shows a warm-up
exercise as a step, the counter/progress/summary count main exercises only, and the
submit payload still carries every exercise. (The warm-up panel itself is Task 5; after
this task warm-up exercises are simply not visible.)

Consumed signature (Task 1):

```ts
import { partitionWarmup } from '@/lib/workout-warmup'
// partitionWarmup<T extends { isWarmup: boolean; order: number }>(exercises: readonly T[]): { warmup: T[]; main: T[] }
```

- [ ] **Step 1: tests** — in `tests/unit/trainee-workout-focus.test.tsx`. The
      react-i18next mock returns the key itself, and `t(key, vars)` renders only the key,
      so assert counters through behaviour (number of "next" clicks) rather than text.
      Build a `warmupFixture` = `fixtureWorkout` plus a third exercise
      `{ ...fixtureWorkout.exercises[0], id: 'ex-w', order: 0, isWarmup: true, exercise: { ...name: 'Band Pull Apart' } }`
      and override `global.fetch` for `/api/trainee/workouts/` like the existing
      `flaggedFixture` test does.
  - warm-up fixture, initial render → `Bench Press` card visible, `Band Pull Apart` not rendered as a card heading
  - warm-up fixture, click next twice → final step (`workouts.summaryTitle` visible), i.e. 2 steps not 3
  - warm-up fixture, final step with nothing logged → warning buttons exist for `Bench Press` and `Tricep Extension`, none contains `Band Pull Apart`
  - warm-up fixture, submit → the `POST .../submit` body `exercises` has length 3 and includes `ex-w`
  - **Trap — existing test** `'renders flag icons in the badge row and opens trainer hint popovers on click'`
    (line ~226) uses `flaggedFixture` where exercise 0 has `isWarmup: true` and expects its
    warm-up badge on the focus card. A warm-up exercise can no longer be a step, so that
    badge is removed (Step 2). Read the whole test first, then: set `isWarmup: false` on
    that fixture exercise, delete only the warm-up badge/hint assertions, keep every
    jumpSet/superSet assertion (move those flags onto the exercises that stay as steps
    if needed).
- [ ] **Step 2: implementation** — in `WorkoutDetailContent`:
  - Replace the `sortedExercises` memo with
    `const { warmup: warmupExercises, main: mainExercises } = useMemo(() => partitionWarmup(workout?.exercises ?? []), [workout])`.
  - Every use of `sortedExercises` for **steps, counters, progress and the final step**
    becomes `mainExercises`: `totalSteps`, `isFinalStep`, `goToStep` clamp,
    `completedExerciseCount`, `totalCompletedSets`, `totalPlannedSets`, `currentExercise`,
    `FinalStep` props `total` and `exercises`, `stepCounter` `total`,
    `WorkoutRecapPanel.onSelectExercise` `findIndex`.
  - `doSubmit` keeps iterating `workout!.exercises` (all). `fetchWorkout` keeps
    initialising `feedbackData` / `exerciseCompleted` for all exercises.
  - `fetchWorkout` resume-step clamp: replace `orderedExercises.length` with
    `partitionWarmup(orderedExercises).main.length`.
  - `warmupExercises` is unused until Task 5: prefix-free destructuring would fail lint,
    so in this task destructure only `main` and add `warmup` in Task 5.
  - `ExerciseFocusCard`: remove the now unreachable warm-up badge — the `we.isWarmup &&`
    block with its hint popover, `'warmup'` from the `openExerciseFlagHint` union, and
    `we.isWarmup` from the wrapping condition. Leave jumpSet/superSet badges as they are.
    Drop the `Flame` import only if nothing else uses it (Task 5 re-adds it).
  - Do not touch `FinalStep` internals or `toggleSetCompleted` (it already looks
    exercises up in `workout.exercises`, so it works for warm-up ids).
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** —
      `feat(trainee): exclude warm-up exercises from workout steps and counters`

---

### Task 5: `WarmupPanel` with optional set logging

**Model:** sonnet
**Depends on:** Task 3, Task 4
**Files:** `src/app/trainee/workouts/[id]/_content.tsx` (modify), `tests/unit/trainee-workout-focus.test.tsx` (modify)
**Test command:** `npx vitest run tests/unit/trainee-workout-focus.test.tsx`
**Done when:** a workout with warm-up exercises shows the collapsible panel above the
exercise card, sets can be logged from it with the same autosave as main exercises, and
a workout without warm-up shows no panel.

- [ ] **Step 1: tests** — same `warmupFixture` as Task 4 (1 warm-up + 2 main)
  - default fixture (no warm-up) → `screen.queryByTestId('warmup-panel')` is null
  - warm-up fixture, step 0 → panel present, expanded (`aria-expanded="true"` on its header button), row `Band Pull Apart` visible
  - click next → panel still present, header `aria-expanded="false"`, row not in the document
  - on step 1, click header → expanded again
  - go to final step → panel still rendered above the summary, collapsed
  - all-warm-up fixture (both exercises `isWarmup: true`) → page renders the final step
    (`workouts.summaryTitle`) with the panel listing both exercises, no crash. Note:
    `renderContent()` waits for `Bench Press` as a card; for this case wait on
    `screen.findByTestId('warmup-panel')` instead.
  - click the `Band Pull Apart` row, then its first `workouts.markSetDone` button →
    `fetch` called with a URL containing `/api/trainee/workout-exercises/ex-w/feedback`,
    method `PATCH`, body `set.completed === true`, `set.reps === 8`, `set.weight === 80`
  - warm-up fixture with `isCompleted: true` on `ex-w` → panel collapsed on step 0
  - within `screen.getByTestId('warmup-panel')` after logging nothing → no element with
    an `amber` class (query `container.querySelector('[class*="amber"]')` → null)
- [ ] **Step 2: implementation** — all file-local in `_content.tsx`, below `ExerciseFocusCard`:
  1. **Extract `SetRowsGrid`** from `ExerciseFocusCard` "Sets input": move the grid
     `<div className="grid grid-cols-[30px_3fr_5fr_3fr_42px] …">…</div>` (headers + rows)
     verbatim into

     ```tsx
     interface SetRowsGridProps {
         we: WorkoutExerciseWithWeight
         sets: SetPerformed[]
         onUpdateSet: (id: string, idx: number, field: 'weight' | 'reps', value: number) => void
         onUpdateSetRpe: (id: string, idx: number, rpe: number | null) => void
         onToggleSet: (id: string, idx: number) => void
         persistingKeys: Set<string>
         rpeDescriptions: Record<number, string>
         t: (key: string, vars?: Record<string, unknown>) => string
     }
     function SetRowsGrid(props: SetRowsGridProps): JSX.Element
     ```

     `ExerciseFocusCard` renders `<SetRowsGrid … />` in its place; the surrounding
     `<h3>` and wrapper stay. Pure move: classes unchanged, the existing test
     `'uses resized set-grid proportions and compact numeric inputs'` must pass untouched.
  2. **Extract `buildExerciseSpec(we: WorkoutExerciseWithWeight): string`** from the
     inline `exerciseSpecParts` block in `FinalStep` and use it there and in the panel.
  3. **`WarmupPanel`**

     ```tsx
     interface WarmupPanelProps {
         exercises: WorkoutExerciseWithWeight[]            // warm-up only, sorted
         feedbackData: Record<string, SetPerformed[]>
         exerciseCompleted: Record<string, boolean>
         currentStep: number                                 // collapse signal
         expandedVideos: Record<string, boolean>
         onToggleVideo: (id: string) => void
         onUpdateSet: SetRowsGridProps['onUpdateSet']
         onUpdateSetRpe: SetRowsGridProps['onUpdateSetRpe']
         onToggleSet: SetRowsGridProps['onToggleSet']
         persistingKeys: Set<string>
         rpeDescriptions: Record<number, string>
         t: (key: string, vars?: Record<string, unknown>) => string
     }
     ```

     - State: `expanded` (boolean), `openExerciseId` (`string | null`).
     - Initial `expanded`: `currentStep === 0 && exercises.some((we) => !exerciseCompleted[we.id])`
       computed once with a lazy `useState` initialiser. The page mounts the panel only
       after `loading` is false, so `exerciseCompleted` is already populated; do not move
       the panel above the `if (loading)` return.
     - Collapse on step change: `useEffect` on `currentStep` that sets `expanded` false
       and `openExerciseId` null, **skipping the first run** (a `useRef` flag), otherwise
       it would cancel the initial expanded state.
     - Markup mirrors `WorkoutRecapPanel` (`src/components/WorkoutRecapPanel.tsx`): outer
       `div` `overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm` with
       `data-testid="warmup-panel"` and `data-swipe-ignore="true"`; header `<button
       type="button" aria-expanded={expanded}>` with `Flame` icon
       (`h-4 w-4 text-week-test`, same icon/colour as `ExerciseMetaBadges`),
       `t('workouts.warmupTitle')`, the chip
       `t('workouts.warmupProgress', { done, total })` and a chevron. Chip classes: gray
       (`bg-gray-100 text-gray-600`) or green (`bg-green-100 text-green-700`) when
       `done === total`. `done` = warm-up exercises with `exerciseCompleted[id] === true`.
     - Body: `<p>` with `t('workouts.warmupHint')` (`text-xs text-gray-500`), then a
       `<ul>` of rows. Row header button: status icon (`CheckCircle2` green when
       completed, `Circle` gray otherwise — add the imports), name + variant, spec from
       `buildExerciseSpec`, chevron. When `openExerciseId === we.id` render below it:
       `we.notes` (same `<FileText>` paragraph as the focus card), the video toggle +
       `YoutubeEmbed` (same block as the focus card), then
       `<SetRowsGrid we={we} sets={feedbackData[we.id] || []} … />`.
  4. **Mount** in `WorkoutDetailContent`, inside the scrollable body, immediately before
     the `{!isFinalStep && currentExercise ? … }` block (so it shows on the final step too):
     `{warmupExercises.length > 0 && <WarmupPanel … />}` wired to
     `updateSet`, `updateSetRpe`, `toggleSetCompleted`, `toggleVideo`, `persistingKeys`,
     `rpeDescriptions`. Add `warmup: warmupExercises` to the `partitionWarmup`
     destructuring left out in Task 4.
- [ ] **Step 3: run the test command, `npm run type-check` and `npm run lint`**
- [ ] **Step 4: CHANGELOG entry and commit** —
      `feat(trainee): dedicated warm-up panel in the in-progress workout`

---

### Task 6: recap panel lists main exercises only

**Model:** sonnet
**Depends on:** Task 1
**Files:** `src/components/WorkoutRecapPanel.tsx` (modify), `tests/unit/workout-recap-panel.test.tsx` (modify)
**Test command:** `npx vitest run tests/unit/workout-recap-panel.test.tsx`
**Done when:** the expanded recap panel does not list warm-up exercises.

Consumed signature (Task 1): `partitionWarmup<T extends { isWarmup: boolean; order: number }>(exercises: readonly T[]): { warmup: T[]; main: T[] }`
— `ExerciseRecapItem` (`src/lib/workout-recap.ts`) already has `isWarmup` and `order`.

- [ ] **Step 1: tests**
  - API returns `[main A, warm-up W, main B]` → A and B listed, W absent
  - API returns `[warm-up W1, warm-up W2]` → empty list, no crash
  - existing tests: check their fixtures; if one asserts a row that is `isWarmup: true`,
    set it to `false` in the fixture
- [ ] **Step 2: implementation** — where the fetch result is stored:
      `setExercises(partitionWarmup(fetchedExercises).main)`. Type the fetched array as
      `ExerciseRecapItem[]`. Nothing else changes; the recap API route stays as is.
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** —
      `feat(trainee): hide warm-up exercises from the workout recap panel`
