# Trainer Program PDF Export Implementation Plan

> **For agentic workers:** execute with `/feature-implement <this file>` in a fresh
> Sonnet session. Read this header, then one task at a time. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** A trainer downloads, from the programs list, the same PDF the athlete downloads for an active or completed program.

**Architecture:** The trainee already exports a PDF from `ProgramDetailContent` using `GET /api/programs/[id]`, which resolves effective weights against the athlete's 1RM/bodyweight **only when the caller is the trainee**. We extract that resolution into a shared server helper and let trainer/admin opt in with `?resolveWeights=trainee`. On the client we extract the trainee page's API→`ProgramPdfData` mapping and its PDF labels into shared code, then a trainer hook fetches with the flag, maps, and calls the existing `exportProgramToPdf`. `ProgramTraineeTable` gets an optional export action shown only for non-draft rows.

## Design

**Behaviour (approved by the user)**
- New row action "Esporta PDF" (icon button) in `ProgramTraineeTable`, **only for `active` and `completed` programs, never for drafts**.
- The table is shared: the action appears both in `/trainer/programs` and in the trainee detail page programs tab (`src/app/trainer/trainees/[id]/_content.tsx`). Both wire it.
- Click → icon spinner (`ActionIconButton isLoading`) on that row only → browser downloads the PDF. While one export runs, a second click on any row is ignored. On failure: `showToast(<message>, 'error')` (`useToast` from `@/components/ToastNotification`, both pages already use it) and the spinner stops.
- PDF content is **identical to the athlete's**: same layout, same labels (taken from the `trainee` i18n namespace, `currentProgram.*` keys), same file name prefix, same weights resolved on the athlete's latest 1RM and bodyweight, same ballast label for bodyweight-loaded exercises.

**API**
- `GET /api/programs/[id]?resolveWeights=trainee`: for trainer/admin, run the same weight resolution the trainee branch runs, using `program.traineeId` instead of `session.user.id`. Ownership checks (403 for another trainer's program, 404) stay before resolution, unchanged.
- Without the flag, trainer/admin responses are **byte-for-byte unchanged** (the read-only program page and the edit page use this endpoint and expect raw weights). Any other flag value is ignored.
- Trainee behaviour unchanged (always resolves, flag irrelevant).

**Non-goals:** drafts; any change to the PDF layout or `src/lib/program-pdf-export.ts`; the existing export button on `/trainer/programs/[id]/review` (it keeps its own mapping with trainer labels and `formatTrainerLoadLabel`); a new API endpoint; server-side PDF generation.

**Rejected alternatives (do not reintroduce)**
- Reusing the review page mapping (`src/app/trainer/programs/[id]/review/_content.tsx` `pdfProgramData`): it uses trainer labels and a different ballast label (`formatTrainerLoadLabel`), so the PDF would not match the athlete's.
- Resolving weights for trainer/admin unconditionally: changes the response of every trainer screen using this endpoint.
- Using `GET /api/programs/[id]/review`: returns 1RM maps for client-side resolution, not resolved weights; would duplicate the trainee resolution on the client.

## Global Constraints

- Before touching code, invoke the matching project skill: `zero-cento-backend`,
  `zero-cento-frontend`, `zero-cento-testing`.
- RBAC: the flag never widens access. `requireRole(['admin','trainer','trainee'])` plus existing ownership/visibility checks run first.
- The PDF uses the existing `exportProgramToPdf(program, labels, { fileNamePrefix, locale })` from `src/lib/program-pdf-export.ts`; do not modify that file.
- Dates/locale: pass `locale` as `'en-GB'` when `i18n.language === 'en'`, otherwise `'it-IT'` (same as trainee page). Never `en-US`.
- Loader pattern: `ActionIconButton` with `isLoading`; no raw `<button disabled={loading}>`.
- Locale JSON files start with a UTF-8 BOM (`public/locales/it/trainer.json` verified): edit with the Edit tool, never rewrite the file with a script that drops the BOM. Add every new key to both `en` and `it`.
- After each task add an entry at the top of `## [Unreleased]` in
  `implementation-docs/CHANGELOG.md` in the existing format (Italian) and include it in
  the task's commit.
- Commit on the current branch with conventional-commit messages. Do not push.

## Review Focus

1. **Trainer without the flag** — response for a trainer is unchanged (raw `effectiveWeight`, no `ballast`, no 1RM/bodyweight queries). Pinned in Task 1.
2. **Flag on a program owned by another trainer** — 403, and no 1RM/bodyweight query is run. Pinned in Task 1.
3. **Bodyweight-loaded exercise in the trainer PDF** — weight cell shows the athlete's ballast label (`formatBallastLabel`), not the total load, exactly like the trainee PDF. Pinned in Task 1 (API) and Task 2 (mapper).
4. **Draft rows** — no export action; active and completed rows have it. Pinned in Task 3.
5. **Export failure / double click** — fetch error shows an error toast and clears the spinner; a click while an export is running does not start a second fetch. Pinned in Task 3.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/program-weight-resolution.ts` (new) | Server: resolve effective weights + ballast for a program's weeks against a trainee | 1 |
| `src/app/api/programs/[id]/route.ts` (modify) | Use the helper; honour `?resolveWeights=trainee` for trainer/admin | 1 |
| `tests/integration/program-detail.test.ts` (modify) | Flag cases | 1 |
| `src/lib/program-pdf-data.ts` (new) | Pure mapper source program → `ProgramPdfData` | 2 |
| `src/lib/use-trainee-program-pdf-labels.ts` (new) | Hook: trainee PDF labels, file prefix, locale, ballast label fn | 2 |
| `src/app/trainee/programs/_components/ProgramDetailContent.tsx` (modify) | Use mapper + hook (no behaviour change) | 2 |
| `tests/unit/program-pdf-data.test.ts` (new) | Mapper tests | 2 |
| `src/lib/use-trainer-program-pdf-export.ts` (new) | Hook: fetch with flag, map, export, toast, in-flight id | 3 |
| `src/components/ActionIconButton.tsx` (modify) | New variant `export-pdf` (lucide `FileDown`) | 3 |
| `src/components/ProgramTraineeTable.tsx` (modify) | Optional export action on non-draft rows | 3 |
| `src/app/trainer/programs/_content.tsx`, `src/app/trainer/trainees/[id]/_content.tsx` (modify) | Wire the hook into the table | 3 |
| `public/locales/{en,it}/trainer.json` (modify) | `programs.exportPdf` label | 3 |
| `tests/unit/program-trainee-table-export.test.tsx`, `tests/unit/use-trainer-program-pdf-export.test.tsx` (new) | Table + hook tests | 3 |

---

### Task 1: Opt-in weight resolution for trainer/admin in GET /api/programs/[id]

**Model:** sonnet
**Depends on:** none
**Files:** `src/lib/program-weight-resolution.ts` (new), `src/app/api/programs/[id]/route.ts` (modify), `tests/integration/program-detail.test.ts` (modify)
**Test command:** `npx vitest run tests/integration/program-detail.test.ts`
**Done when:** a trainer calling `GET /api/programs/<own id>?resolveWeights=trainee` gets the same `effectiveWeight`/`ballast` values the assigned trainee would get, and all pre-existing tests in the file still pass unchanged.

- [x] **Step 1: tests** — add `describe('GET /api/programs/[id] — trainer resolveWeights=trainee')` in `tests/integration/program-detail.test.ts`, reusing the file's existing mocks/fixtures (see the "trainee branch" and "trainee bodyweight-loaded rows" describes for how 1RM map and bodyweight are mocked):
  - trainer owner, flag, `percentage_1rm` row, athlete 1RM 100, weight 80 → `effectiveWeight` 80; `loadTraineeOneRmMap` called with `program.traineeId` (not the trainer id)
  - trainer owner, flag, bodyweight-loaded `absolute` row weight 10 → `effectiveWeight` null and `ballast` `{ kind: 'ballast', kg: 10 }` (same as the trainee test for the same row)
  - trainer owner, **no flag**, `percentage_1rm` row → raw row returned, no `ballast` key, `loadTraineeOneRmMap` and `loadLatestBodyweightKg` not called
  - trainer owner, `?resolveWeights=foo` → same as no flag
  - trainer **not owner**, flag → 403, `loadTraineeOneRmMap` not called
  - admin, flag → resolved like the trainer owner case
  - trainer owner, flag, `active` program → workouts still carry `isStarted` (resolution and started-enrichment compose)
  Build the request as `new NextRequest('http://localhost/api/programs/<id>?resolveWeights=trainee')` (check how the file builds requests today and follow it).
- [x] **Step 2: implementation**
  - New `src/lib/program-weight-resolution.ts`:
    ```ts
    export async function resolveProgramWeeksForTrainee<TWeek extends ProgramWeekWithExercises>(
        weeks: TWeek[],
        traineeId: string,
        logContext: { programId: string }
    ): Promise<TWeek[]>
    ```
    Body = the block currently inside `if (session.user.role === 'trainee') { ... }` in the route (from `needsPrMap` to `resolvedWeeks`), moved verbatim with `session.user.id` → `traineeId` and `programId` → `logContext.programId`. Keep the "skip PR map when all absolute" and "skip bodyweight read when no loaded exercise" short-circuits (existing tests assert them). Type the generic loosely (structural type with `weightType`, `weight`, `effectiveWeight`, `rpeWeightMin`, `rpeWeightMax`, `exerciseId`, `exercise.isBodyweightLoaded?`), casting at the return like the route does today; do not fight Prisma payload types.
  - Route: replace the trainee block with
    ```ts
    const resolveForTrainee =
        session.user.role === 'trainee' ||
        request.nextUrl.searchParams.get('resolveWeights') === 'trainee'
    if (resolveForTrainee) {
        const traineeId = session.user.role === 'trainee' ? session.user.id : program.traineeId
        resolvedProgram = { ...program, weeks: await resolveProgramWeeksForTrainee(program.weeks, traineeId, { programId }) }
    }
    ```
    placed exactly where the trainee block is now (after all 403/404/visibility checks, before the `isStarted` enrichment, which already reads `resolvedProgram.weeks`). The trainer/admin `include` already returns `exercise.isBodyweightLoaded` (all scalars), so no select change.
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(programs): opt-in trainee weight resolution for trainer program fetch`

---

### Task 2: Shared trainee PDF mapper and labels

**Model:** sonnet
**Depends on:** none
**Files:** `src/lib/program-pdf-data.ts` (new), `src/lib/use-trainee-program-pdf-labels.ts` (new), `src/app/trainee/programs/_components/ProgramDetailContent.tsx` (modify), `tests/unit/program-pdf-data.test.ts` (new)
**Test command:** `npx vitest run tests/unit/program-pdf-data.test.ts tests/unit/program-pdf-export.test.ts`
**Done when:** the trainee page builds its PDF data and labels only through the new module and hook, with no change in output, and the mapper is covered by unit tests.

- [x] **Step 1: tests** — `tests/unit/program-pdf-data.test.ts` for `buildProgramPdfData` and `apiProgramToPdfSource`:
  - program with trainee `{firstName:'Mario', lastName:'Rossi'}` → `traineeName` `'Mario Rossi'`; trainer name concatenated the same way
  - program without trainee (`undefined` or `null`) → `traineeName` = `options.unknownTraineeName`
  - exercise with `ballast: { kind: 'ballast', kg: 10 }` → `weightLabelOverride` = `options.ballastLabel(ballast)` result (pass a stub returning `'BW + 10 kg'`)
  - exercise with `ballast` null/undefined → `weightLabelOverride` null
  - `isJumpSet`/`isSuperSet` undefined → `false`
  - all other fields (`id`, `name` from `exercise.name`, `variant`, `type` from `exercise.type`, `isWarmup`, `sets`, `reps`, `targetRpe`, `weightType`, `weight`, `effectiveWeight`, `rpeWeightMin`, `rpeWeightMax`, `restTime`) copied as-is
  - workouts keep input order (no sorting — the trainee PDF does not sort)
  - `apiProgramToPdfSource`: API workout `{ id, dayIndex, workoutExercises: [...] }` → `{ id, dayIndex, exercises: [...] }`; weeks and top-level fields carried over
- [x] **Step 2: implementation**
  - `src/lib/program-pdf-data.ts` (pure, no React):
    ```ts
    import type { RestTime, WeekType } from '@prisma/client'
    import type { ExerciseType } from '@/lib/exercise-type'
    import type { BallastDisplay } from '@/lib/bodyweight-load'
    import type { ProgramPdfData, ProgramPdfExercise } from '@/lib/program-pdf-export'

    export interface PdfSourceExercise {
        id: string
        variant: string | null
        sets: number
        reps: string
        targetRpe: number | null
        weightType: ProgramPdfExercise['weightType']
        weight: number | null
        effectiveWeight: number | null
        rpeWeightMin: number | null
        rpeWeightMax: number | null
        ballast?: BallastDisplay | null
        restTime: RestTime
        isWarmup: boolean
        isJumpSet?: boolean | null
        isSuperSet?: boolean | null
        exercise: { name: string; type: ExerciseType }
    }
    export interface PdfSourceWorkout { id: string; dayIndex: number; exercises: PdfSourceExercise[] }
    export interface PdfSourceProgram {
        title: string
        startDate: string
        trainee?: { firstName: string; lastName: string } | null
        trainer: { firstName: string; lastName: string }
        weeks: Array<{ weekNumber: number; weekType: WeekType; workouts: PdfSourceWorkout[] }>
    }
    export interface BuildProgramPdfDataOptions {
        unknownTraineeName: string
        ballastLabel: (ballast: BallastDisplay) => string
    }
    export function buildProgramPdfData(program: PdfSourceProgram, options: BuildProgramPdfDataOptions): ProgramPdfData
    /** GET /api/programs/[id] payload (workouts carry `workoutExercises`) → mapper input */
    export function apiProgramToPdfSource(apiProgram: ApiProgramForPdf): PdfSourceProgram
    ```
    `ApiProgramForPdf` = same as `PdfSourceProgram` but workouts are `{ id: string; dayIndex: number; workoutExercises: PdfSourceExercise[] }`; export it. `buildProgramPdfData` body = the current `pdfProgramData` useMemo body in `ProgramDetailContent.tsx` (~line 583), with `t('currentProgram.pdfUnknownTrainee')` → `options.unknownTraineeName` and `formatBallastLabel(exercise.ballast, tCommon)` → `options.ballastLabel(exercise.ballast)`.
  - `src/lib/use-trainee-program-pdf-labels.ts` (`'use client'`):
    ```ts
    export interface TraineeProgramPdfConfig {
        labels: ProgramPdfLabels
        fileNamePrefix: string
        locale: 'it-IT' | 'en-GB'
        unknownTraineeName: string
        ballastLabel: (ballast: BallastDisplay) => string
    }
    export function useTraineeProgramPdfLabels(): TraineeProgramPdfConfig
    ```
    Uses `useTranslation(['trainee', 'common'])` — the `trainee` namespace even when called from trainer pages, so the PDF matches the athlete's. Labels = the current `pdfLabels` useMemo in `ProgramDetailContent.tsx` (~line 544) moved verbatim; `fileNamePrefix` = `t('currentProgram.pdfFileNamePrefix')`; `unknownTraineeName` = `t('currentProgram.pdfUnknownTrainee')`; `ballastLabel` = `(b) => formatBallastLabel(b, (key, opts) => t(\`common:${key}\`, opts) as string)` (same as the page's `tCommon`). Memoize on `[t, i18n.language]`.
  - `ProgramDetailContent.tsx`: delete the local `pdfLabels` memo and the inline mapping; `pdfProgramData = useMemo(() => mergedProgram ? buildProgramPdfData({ ...mergedProgram, weeks: mergedProgram.weeks.map(w => ({ ...w, workouts: w.workouts.map(wo => ({ id: wo.id, dayIndex: wo.dayOfWeek, exercises: wo.exercises })) })) }, { unknownTraineeName, ballastLabel }) : null, [...])`. Pass `labels`, `fileNamePrefix`, `locale` from the hook to `ProgramPdfExportButton`. Keep the page's own `locale`/`tCommon` if still used elsewhere in the file (they are: `formatDate`, `buildExerciseScheme`).
- [x] **Step 3: run the test command and `npm run type-check`**; also run `npx vitest run tests/unit/trainee-program-data-notes.test.ts` (touches the same page data)
- [x] **Step 4: CHANGELOG entry and commit** — `refactor(programs): extract trainee PDF data mapper and labels`

---

### Task 3: Export action in the programs table

**Model:** sonnet
**Depends on:** Task 1, Task 2
**Files:** `src/lib/use-trainer-program-pdf-export.ts` (new), `src/components/ActionIconButton.tsx` (modify), `src/components/ProgramTraineeTable.tsx` (modify), `src/app/trainer/programs/_content.tsx` (modify), `src/app/trainer/trainees/[id]/_content.tsx` (modify), `public/locales/en/trainer.json`, `public/locales/it/trainer.json` (modify), `tests/unit/program-trainee-table-export.test.tsx` (new), `tests/unit/use-trainer-program-pdf-export.test.tsx` (new)
**Test command:** `npx vitest run tests/unit/program-trainee-table-export.test.tsx tests/unit/use-trainer-program-pdf-export.test.tsx tests/unit/trainer-programs-content.test.tsx tests/unit/trainer-trainee-programs-tab.test.tsx`
**Done when:** on `/trainer/programs` and the trainee detail programs tab, active/completed rows show an export icon that downloads the athlete's PDF; draft rows show none.

Consumes (from Tasks 1-2):
- `GET /api/programs/{id}?resolveWeights=trainee` → `{ data: { program } }` with resolved `effectiveWeight`/`ballast`
- `apiProgramToPdfSource(apiProgram: ApiProgramForPdf): PdfSourceProgram` and `buildProgramPdfData(program, { unknownTraineeName, ballastLabel }): ProgramPdfData` from `@/lib/program-pdf-data`
- `useTraineeProgramPdfLabels(): { labels, fileNamePrefix, locale, unknownTraineeName, ballastLabel }` from `@/lib/use-trainee-program-pdf-labels`

- [ ] **Step 1: tests**
  - `tests/unit/use-trainer-program-pdf-export.test.tsx` (mock `fetch`, `@/lib/program-pdf-export`'s `exportProgramToPdf`, and `useToast`; render the hook with `renderHook`):
    - `exportProgramPdf('p1')` → `fetch` called with `/api/programs/p1?resolveWeights=trainee`; `exportProgramToPdf` called once with the mapped data, the trainee labels, `{ fileNamePrefix, locale }`
    - during the export `exportingProgramId === 'p1'`; after → `null`
    - second `exportProgramPdf('p2')` while `p1` in flight → no second fetch
    - fetch `ok: false` with API error body → `showToast(<getApiErrorMessage result>, 'error')`, `exportProgramToPdf` not called, `exportingProgramId` back to `null`
    - `exportProgramToPdf` rejects → `showToast(t('programs.exportPdfError'), 'error')`, `exportingProgramId` back to `null`
  - `tests/unit/program-trainee-table-export.test.tsx` (render `ProgramTraineeTable` with one draft, one active, one completed program; follow the props setup in `tests/unit/trainer-trainee-programs-tab.test.tsx`):
    - with `onExportPdf` → buttons labelled `programs.exportPdf` count 2 (active + completed), none in the draft row
    - click on the active row button → `onExportPdf` called with that program
    - `exportingProgramId` = active id → that button is disabled/loading, others enabled
    - without `onExportPdf` → no `programs.exportPdf` buttons (table stays backward compatible)
  - Existing `trainer-programs-content.test.tsx` line ~289 counts delete buttons by label: must still pass untouched.
- [ ] **Step 2: implementation**
  - `ActionIconButton.tsx`: add variant `'export-pdf'` to `ActionVariant` with `{ Icon: FileDown, activeClass: 'bg-brand-primary hover:bg-brand-primary-hover' }` (`FileDown` from `lucide-react`, the icon the trainee button uses).
  - `src/lib/use-trainer-program-pdf-export.ts` (`'use client'`):
    ```ts
    export function useTrainerProgramPdfExport(): {
        exportProgramPdf: (programId: string) => Promise<void>
        exportingProgramId: string | null
    }
    ```
    Guard against concurrent exports with a `useRef` flag (state alone races on fast double clicks), mirror it into `useState` for rendering. Fetch `cache: 'no-store'`; on `!res.ok` throw `new Error(getApiErrorMessage(body, t('programs.exportPdfError'), t))` (`getApiErrorMessage` from `@/lib/api-error`); map with `buildProgramPdfData(apiProgramToPdfSource(body.data.program), { unknownTraineeName, ballastLabel })`; call `exportProgramToPdf(data, labels, { fileNamePrefix, locale })`. Catch → `showToast(err instanceof Error ? err.message : t('programs.exportPdfError'), 'error')`; finally clear ref and state. `t` from `useTranslation(['trainer', 'common'])` for the error message only.
  - `ProgramTraineeTable.tsx`: new optional props
    ```ts
    onExportPdf?: (program: ProgramTraineeTableProgram) => void
    exportingProgramId?: string | null
    ```
    In the non-draft `InlineActions` branch only (the `else` branch, ~line 374), render after `view-test` and before `delete`:
    `{onExportPdf && <ActionIconButton variant="export-pdf" label={t('programs.exportPdf')} onClick={() => onExportPdf(program)} isLoading={exportingProgramId === program.id} />}`. Do not touch the draft branch.
  - Both pages: `const { exportProgramPdf, exportingProgramId } = useTrainerProgramPdfExport()`; pass `onExportPdf={(program) => void exportProgramPdf(program.id)}` and `exportingProgramId`.
  - Locales (BOM — use Edit): in `trainer.json` under the top-level `programs` object (the one holding `cloneProgram`, `viewTests`, ~line 569): `"exportPdf": "Esporta PDF"` (it) / `"Export PDF"` (en), `"exportPdfError": "Errore durante la generazione del PDF"` (it) / `"Error while generating the PDF"` (en). Check the key does not already exist in that object first.
- [ ] **Step 3: run the test command, `npm run type-check` and `npm run lint`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(programs): export athlete PDF from trainer programs list`
