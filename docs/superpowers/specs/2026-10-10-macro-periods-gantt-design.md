# Macro-Period Planning (Trainer Gantt) — Design

**Date:** 2026-10-10
**Status:** Approved (design), pending spec review

## Goal

A trainer plans each trainee's long-term training as a sequence of **macro periods**
(phases of a season), independent of the individual programs ("schede"). The plan is
shown as a colour-coded, editable timeline that becomes the **default view** when a
trainer opens a trainee.

Phase types are **not hardcoded**: every trainer defines their own phases (name, meaning,
colour) in their profile. No enum, no migration when the list changes.

Success looks like: a trainer opens a trainee, immediately sees which phase the trainee is
in and what comes next, and can reshape the plan by dragging bars, without leaving the
page.

## Non-goals

- No trainee-facing or admin-facing view. Trainer only.
- No link between a macro period and a `TrainingProgram` (no FK, no constraint). Programs
  are only **displayed** alongside for comparison.
- No overlapping periods and no multi-lane phase layout.
- No day-level granularity: periods are whole weeks.
- No drag-to-create on empty space (see Decisions).
- No sharing or copying of phase types or plans between trainers or trainees.
- No transfer of a plan when a trainee changes trainer.

## Decisions

| Topic | Decision |
|---|---|
| Phase types | Defined per trainer (custom), each with its own colour and description |
| Periods vs programs | Independent; programs shown as a read-only row |
| Granularity | Whole weeks: start on Monday, end on Sunday |
| Overlap | Not allowed: at most one phase per week per trainee |
| Editing | Drag to move, drag either edge to resize, click to create/edit via dialog |
| Visibility | Owning trainer only |
| Timeline engine | `react-calendar-timeline` (0.30 beta, exact version pinned) |

**Why a library, and why this one.** The requirement "one phase per week, plus a programs
row underneath" is a *lane timeline* (several bars on the same row), not a classic Gantt
(one task per row). Of the maintained MIT candidates, `react-calendar-timeline` is the
only one with that shape natively; `@svar-ui/react-gantt` and `frappe-gantt` are
one-row-per-task. It adds `dayjs` and `interactjs` as peer dependencies.

**Known risk.** The chosen version is a beta, and snap, two-edge resize, canvas click and
touch drag were confirmed from documentation, not from the beta itself. The implementation
plan therefore starts with a verification task (see Rollout). Fallback:
`@svar-ui/react-gantt` with a one-row-per-period layout, which requires re-approving this
spec's UI section.

**Create by click, not by drag.** No candidate library documents drag-on-empty-space
creation. Creating a period is: click an empty week (or the "New period" button), then
confirm in the dialog. Move and resize are drag.

## Data model

Two new tables. No change to existing models other than the back-relations on `User`.

```prisma
model MacroPhaseType {
  id          String   @id @default(uuid())
  trainerId   String
  name        String
  description String?
  color       String   // Hex, e.g. "#3b82f6"
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  trainer User          @relation("TrainerMacroPhaseTypes", fields: [trainerId], references: [id], onDelete: Cascade)
  periods MacroPeriod[] @relation("PhaseTypePeriods")

  @@unique([trainerId, name])
  @@index([trainerId, isActive])
  @@map("macro_phase_types")
}

model MacroPeriod {
  id          String   @id @default(uuid())
  traineeId   String
  trainerId   String
  phaseTypeId String
  startDate   DateTime @db.Date // Always a Monday
  endDate     DateTime @db.Date // Always a Sunday, inclusive
  note        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  trainee   User           @relation("TraineeMacroPeriods", fields: [traineeId], references: [id], onDelete: Cascade)
  trainer   User           @relation("TrainerMacroPeriods", fields: [trainerId], references: [id], onDelete: Cascade)
  phaseType MacroPhaseType @relation("PhaseTypePeriods", fields: [phaseTypeId], references: [id], onDelete: Restrict)

  @@index([traineeId, startDate])
  @@index([trainerId])
  @@map("macro_periods")
}
```

### Rules

- **Dates.** `startDate` is a Monday, `endDate` is a Sunday, `endDate > startDate`. The
  shortest period is one week. Dates are calendar dates with no time-of-day and no
  timezone conversion: they travel as `YYYY-MM-DD` strings in the API.
- **No overlap.** For a given `(traineeId, trainerId)`, two periods may not share a week.
  Checked inside the same transaction as the write. Violations return
  `409 MACRO_PERIOD_OVERLAP`.
- **Phase ownership.** A period's `phaseTypeId` must belong to the calling trainer.
  Creating a period, or changing a period's phase, requires the target phase to be
  active. Moving or resizing a period whose phase is archived is allowed.
- **Phase name.** Trimmed, 1–40 characters, unique per trainer (case-insensitive check in
  the API on top of the DB constraint). `description` up to 200 characters. `color`
  matches `^#[0-9a-fA-F]{6}$`. `note` up to 500 characters.
- **Archive vs delete.** A phase referenced by at least one period cannot be deleted
  (`409 MACRO_PHASE_IN_USE`); it can be archived. An archived phase stays visible on
  existing periods and in the legend, and is not offered for new periods. A phase with no
  periods is hard-deleted.
- **Defaults.** When a trainer with zero phase types calls the list endpoint, three
  placeholders are created ("Tipo fase 1", "Tipo fase 2", "Tipo fase 3") with distinct
  colours from the preset palette. They are ordinary rows: renamable, recolourable,
  deletable. Creation is idempotent under concurrent requests (the unique constraint
  absorbs the race).
- **Trainer change.** Periods are always read filtered by the current trainer's
  `trainerId`. If a trainee is reassigned, the new trainer starts from an empty plan; the
  previous trainer's rows stay in the database and are not shown.

## API

All handlers use `apiSuccess` / `apiError` and end their `catch` with `handleApiError`.
Request bodies are validated with Zod schemas in `src/schemas/macro-period.ts`.

| Route | Methods | Guard |
|---|---|---|
| `/api/macro-phase-types` | `GET`, `POST` | `requireRole('trainer')` |
| `/api/macro-phase-types/[id]` | `PATCH`, `DELETE` | trainer, and `phase.trainerId === user.id` |
| `/api/macro-phase-types/[id]/archive` | `POST` | same |
| `/api/trainer/trainees/[id]/macro-periods` | `GET`, `POST` | `requireTrainerOwnership(traineeId)` |
| `/api/macro-periods/[id]` | `PATCH`, `DELETE` | trainer, `period.trainerId === user.id`, and ownership of `period.traineeId` |

- `GET /api/macro-phase-types` returns every phase of the trainer (active and archived)
  ordered by `sortOrder`, each with `usageCount` (number of periods using it). Creates the
  default placeholders first when the trainer has none.
- `POST /api/macro-phase-types` appends at the end (`sortOrder = max + 1`).
- `PATCH /api/macro-phase-types/[id]` accepts any of `name`, `description`, `color`,
  `sortOrder`. Reordering is a swap: the client sends one `PATCH` per moved row.
- `POST .../archive` toggles `isActive`, matching the existing
  `movement-patterns/[id]/archive` behaviour.
- `GET /api/trainer/trainees/[id]/macro-periods` returns
  `{ periods, programs }` in one round trip. `periods` embed their phase
  (`id`, `name`, `color`, `isActive`). `programs` are the trainee's programs by this
  trainer with a non-null `startDate`: `id`, `title`, `status`, `startDate`,
  `durationWeeks`. No date-range filter: a trainee's full plan is a few dozen rows.
- `PATCH /api/macro-periods/[id]` accepts any of `phaseTypeId`, `startDate`, `endDate`,
  `note`.

### Errors

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed body, non-Monday start, non-Sunday end, `end <= start` |
| 403 | existing guard codes | Trainee not owned by the trainer |
| 404 | `NOT_FOUND` | Phase or period missing, or owned by another trainer |
| 409 | `MACRO_PERIOD_OVERLAP` | Write would overlap another period |
| 409 | `MACRO_PHASE_IN_USE` | Deleting a phase that has periods |
| 409 | `MACRO_PHASE_NAME_TAKEN` | Duplicate phase name for this trainer |
| 409 | `MACRO_PHASE_ARCHIVED` | Assigning an archived phase to a period |

Each code carries an i18n `key` under a `macroPeriods.errors.*` namespace, in both `en`
and `it`. None of these are reported to Sentry (4xx).

## Shared logic

`src/lib/macro-periods.ts`, pure functions with no DOM or Prisma dependency, used by both
the API and the client:

- `snapToWeekStart(date)` / `snapToWeekEnd(date)` — nearest Monday / Sunday.
- `isValidPeriodRange(start, end)`.
- `findOverlap(candidate, periods, ignoreId?)` — returns the conflicting period or `null`.
- `readableTextColor(hex)` — `'#ffffff'` or `'#111827'`, by relative luminance.
- `programToRange(startDate, durationWeeks)` — date range for a program bar.
- `PHASE_COLOR_PALETTE` — the 12 preset colours, and `nextUnusedColor(usedColors)`.

## UI — profile: phase management

New section on `/profile`, rendered for the `trainer` role only, below the movement-pattern
colours. Component `src/components/MacroPhaseTypesSection.tsx`, exported via `index.ts`.

- Ordered list: colour swatch, name, description, active/archived state.
- **Add phase**: name (required), description (optional; this is the "meaning" shown in
  the legend), colour. The colour defaults to the first palette colour not yet used.
- **Colour picker**: the 12 palette swatches plus a free hex input
  (`<input type="color">`).
- **Edit** name, description and colour inline. The colour lives on the phase, so a change
  is reflected on every timeline of that trainer.
- **Reorder** with up/down buttons. The order drives the legend and the phase dropdown.
- **Archive / Reactivate** when `usageCount > 0`; **Delete** when `usageCount === 0`. Only
  the applicable action is shown.
- Async buttons use `<Button isLoading>` / `<ActionIconButton isLoading>`. Success and
  failure go through the existing toast; API errors are translated from `key`.
- Data: TanStack Query, key `['macro-phase-types']`. Mutations also invalidate
  `['macro-periods']` so open timelines pick up renames and colour changes.

## UI — trainee detail: planning tab

`DetailTab` gains `'planning'`, placed first in the tab bar and used as the default tab.
`?tab=subscription` keeps selecting the subscription tab.

The tab lives in its own file, `src/app/trainer/trainees/[id]/_planning-tab.tsx`, so the
already large `_content.tsx` only gains the tab button and one render line. The timeline
component itself is `src/components/MacroPeriodTimeline.tsx`, loaded with `next/dynamic`
and `ssr: false` so the library and its peers are not in the bundle of the other tabs.

- **Rows.** `Fasi` (editable) and `Schede` (read-only). Program bars are neutral grey with
  the program title; clicking one navigates to the program using the navigation loader.
- **Weeks / Month switch.** Changes the zoom of the same timeline. Weeks: about 12 weeks
  visible, one column per week. Month: about 12 months visible, month headers. The choice
  is remembered per browser in `localStorage`, read defensively, defaulting to Weeks.
- **Navigation.** Horizontal scroll, previous/next buttons, a "Today" button, and a
  vertical marker on the current day. The initial window is centred on today.
- **Create.** Clicking an empty week on the `Fasi` row opens the period dialog prefilled
  with that week. A "New period" button does the same without a prefilled week, for
  keyboard and mobile use.
- **Move / resize.** Dragging a bar or either edge snaps to whole weeks. The result is
  checked with `findOverlap` before any request: on conflict the bar returns to its
  position and a toast explains why. Otherwise the change is applied optimistically and
  rolled back if the API rejects it.
- **Edit / delete.** Clicking a bar opens the same dialog, with a delete action behind a
  confirmation.
- **Period dialog.** react-hook-form + Zod: phase (active phases only, plus the current
  one if archived), start week, end week, note.
- **Bars.** Filled with the phase colour, labelled with the phase name, text colour from
  `readableTextColor`. The note is shown in a tooltip.
- **Legend.** Below the timeline: swatch, name and description of every phase that is
  active or used in this plan; archived ones are marked. A "Manage phases" link goes to
  `/profile`.
- **Empty state.** With no periods: a short message and the "New period" button. The
  programs row is still shown.
- **Mobile.** The timeline scrolls horizontally and supports touch drag; the dialog is the
  primary editing path on small screens.

## Testing

- **Unit** (`tests/unit/macro-periods.test.ts`): snapping, range validation, overlap
  detection including adjacency and year boundaries, text contrast, program ranges, palette
  selection. Zod schemas. `src/lib/macro-periods.ts` is added to the coverage list in
  `vitest.config.ts`.
- **Integration** (`tests/integration/`): every route — foreign trainer rejected, overlap
  returns 409, archived phase rejected on create, archive vs delete by usage, duplicate
  name, placeholder creation and its idempotency, trainer-scoped reads.
- **Component**: the drag/resize handlers of `MacroPeriodTimeline` are exercised by calling
  the library callbacks directly (conflict reverts, success mutates, API failure rolls
  back). Pixel-level dragging is not tested.
- **E2E** (`tests/e2e/`): create a phase in the profile, open a trainee and land on the
  planning tab, create a period, see it coloured in the timeline and listed in the legend,
  switch Weeks/Month.

## Rollout

1. **Verification task first.** Install the pinned beta and confirm, in a throwaway page,
   that week snapping, resize on both edges, canvas click with the clicked time, per-item
   read-only bars and touch drag work on React 18.3 / Next 15. If any fails, stop and
   return to the user with the SVAR fallback before writing feature code.
2. Prisma migration (additive, no backfill).
3. Shared logic, schemas, API, then profile section, then planning tab.
4. Locale files `public/locales/{en,it}/`, and an entry in
   `implementation-docs/CHANGELOG.md`.
