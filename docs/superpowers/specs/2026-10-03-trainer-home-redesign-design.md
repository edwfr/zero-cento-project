# Trainer Home Redesign — Design

**Date:** 2026-10-03
**Status:** Approved (design), pending spec review

## Goal

Turn the trainer home (`/trainer/dashboard`) from a static link hub into a
daily working surface that is **useful every day** and **feels alive**.

Success criterion: the trainer opens the home and within a few seconds knows
who needs attention today, and sees that their athletes are training and
progressing.

### Context and constraints

- Used by the trainer **on desktop only** → multi-column layout, no mobile
  optimisation work beyond not breaking.
- **No DB migration.** Every widget uses data that already exists
  (`ExerciseFeedback`, `SetPerformed`, `PersonalRecord`, `SubscriptionRenewal`,
  `TrainingProgram`, `Week`, `Workout`, `WorkoutExercise`).
- **No emoji in the UI.** Every visual marker (priority, medal, trophy, trend
  arrow, empty-state accent) is a `lucide-react` icon.
- Follow existing patterns: server components, Tailwind, components from
  `src/components/`, i18n keys in `public/locales/{it,en}/trainer.json`.

### Problems with the current page

- Generic header (title + "welcome"), no information.
- Redundancy: 5 stat cards, 3 quick actions and 4 navigation cards mostly link
  to the same 3 pages.
- Global exercise count (`prisma.exercise.count()`) is not meaningful to the
  trainer.
- Actionable items (subscriptions, test weeks) are scattered; the test-week
  list sits at the bottom.
- ~8 sequential queries; active-trainee counts use `findMany().length`.

## Scope and phasing

One spec, two delivery phases:

- **Phase 1 — useful:** new layout and header, "To do today", inactive
  trainees, recent feedback. Removal of redundant cards.
- **Phase 2 — alive:** activity feed, new PRs, 8-week trend, consistency
  ranking.

Each phase is independently shippable. Until Phase 2 lands, its grid slots are
simply not rendered.

## Layout (desktop)

```
┌ Header: greeting · date · 3 KPIs · quick actions ───────────────┐
├ To do today (2/3) ───────────────┬ New PRs this week (1/3) ─────┤
├ Recent feedback (2/3) ───────────┼ Inactive trainees (1/3) ─────┤
├ 8-week trend (2/3) ──────────────┼ Consistency ranking (1/3) ───┤
└ Activity feed (full width) ──────────────────────────────────────┘
```

Grid: `grid-cols-3` on `lg`, single column below.

## Architecture

**Approach: server shell + async widgets streamed through `<Suspense>`.**

### Page shell

`src/app/trainer/dashboard/page.tsx` becomes a thin shell (~80 lines):

- session + role check (unchanged behaviour: redirect to `/login` or to the
  user's own dashboard);
- locale resolution and `t()` — the current inline translation helpers move to
  `src/lib/trainer-dashboard/i18n.ts` so every widget can use them;
- renders `<DashboardHeader>` and the grid; every widget is wrapped in
  `<Suspense fallback={<WidgetSkeleton />}>` and a widget error boundary.

`loading.tsx` stays as is (navigation overlay). In-page streaming starts once
the shell has rendered.

### Query modules — `src/lib/trainer-dashboard/`

One pure async function per widget, signature `(trainerId, now) → data`:

```
constants.ts            thresholds (see below)
trainer-trainees.ts     React.cache'd list of the trainer's trainee ids
sessions.ts             shared "session" definition + helpers
header-kpis.ts
todo-today.ts
inactive-trainees.ts
recent-feedback.ts
activity-feed.ts        (phase 2)
new-records.ts          (phase 2)
weekly-trend.ts         (phase 2)
consistency-ranking.ts  (phase 2)
```

Rules:

- All queries are scoped to the trainer's trainees via `TrainerTrainee`.
  The id list is fetched once per request through `React.cache`.
- Independent queries inside a module run with `Promise.all`.
- Counts use `count` / `groupBy`, never `findMany().length`.
- Narrow `select`s; no raw SQL. Aggregations done in JS.
- Existing indexes cover the hot paths: `ExerciseFeedback[traineeId, date]`,
  `PersonalRecord[recordDate]`, `TrainingProgram[trainerId, status]`.

### Widgets — `src/app/trainer/dashboard/_widgets/`

One async server component per file; calls its query module and renders with
existing components (`Card`, `Skeleton`, `ProgressBar`, `WeekTypeBadge`,
`SubscriptionStatusBadge` where applicable). Charts are client components
using `recharts` that receive data as props.

### Error isolation

Each widget sits inside a small error boundary: on failure it renders a
compact "Unable to load" card and the other widgets stay visible. Errors are
logged through `logger` (Sentry picks them up).

### Removed

Navigation cards, duplicated quick-action block, global exercise-count card,
standalone test-week section (absorbed into "To do today" and the header).

## Shared definitions

### Thresholds — `constants.ts`

| Constant | Value |
|---|---|
| `INACTIVITY_DAYS` | 7 |
| `SUBSCRIPTION_EXPIRING_DAYS` | 14 (reuses existing subscription logic) |
| `PROGRAM_ENDING_DAYS` | 7 |
| `HIGH_RPE_THRESHOLD` | 9 |
| `RECENT_WINDOW_DAYS` | 7 |

No per-trainer settings (YAGNI).

### Session

A **session** is a unique **(traineeId, workoutId, calendar day of
`ExerciseFeedback.date`)**. `WorkoutExercise.isCompleted` has no timestamp, so
feedback is the reliable source of *when* training happened. Used by the
header KPI, activity feed, trend and consistency ranking.

### Program end date

`startDate + durationWeeks × 7 days`. Programs without `startDate` are ignored.

### Week boundaries

ISO weeks, Monday–Sunday, local time (same logic as the current
`getCurrentWeekRange`, moved to `sessions.ts`).

## Widgets — Phase 1

### Header — `header-kpis.ts`

- Time-of-day greeting ("Good morning / afternoon / evening, {firstName}") and
  today's date.
- Three compact KPIs:
  - **active trainees (7 days) / total**;
  - **active programs**;
  - **sessions this week**, with delta vs last week (`TrendingUp` /
    `TrendingDown` / `Minus` icon).
- Quick actions: "New program" (`/trainer/programs/new`), "New trainee"
  (`/trainer/trainees/new`).

### To do today — `todo-today.ts`

Single list sorted by urgency; each item has a lucide icon, colour accent,
trainee name and a direct link.

| # | Item | Source / rule | Link |
|---|---|---|---|
| 1 | Subscription expired (red) | `getTrainerSubscriptionOverview` | `/trainer/subscriptions` |
| 2 | Subscription expiring ≤ 14 days (orange), "expires in N days" | same | `/trainer/subscriptions` |
| 3 | Tests completed, to review (purple) | current test week, all planned tests completed | `/trainer/programs/{id}/tests?backContext=dashboard` |
| 4 | Program ending without successor (blue) | `active` program ending within 7 days and no other `draft`/`active` program for the same trainee | `/trainer/programs/new` |
| 5 | Test week in progress (amber) | current test week not fully completed; mini `ProgressBar` | `/trainer/programs/{id}` |

Test-week detection keeps the current rules (week `weekType = test`, started
within the current ISO week, program `active` or `completed`).

Empty list → positive state with `CheckCircle2` icon: "All clear".

### Inactive trainees — `inactive-trainees.ts`

- Trainees with `isActive = true` **and** an `active` program, with **no
  `ExerciseFeedback` in the last 7 days**.
- Shows name, "last session N days ago" or "never", link to
  `/trainer/trainees/{id}`.
- Sorted most-inactive first ("never" first). Max 6 items, then "+N more".
- Trainees without an active program are excluded.

### Recent feedback — `recent-feedback.ts`

- Last 10 `ExerciseFeedback` of the trainer's trainees within 7 days where
  `notes` is non-empty **or** `actualRpe ≥ 9`.
- Item: trainee · exercise name · relative time ("2h ago") · RPE badge (red
  when ≥ 9) · note clamped to 2 lines.
- Link → `/trainer/programs/{programId}`.

## Widgets — Phase 2

### Activity feed — `activity-feed.ts` (full width)

- Last 15 sessions within 7 days, grouped by day ("Today", "Yesterday",
  "Mon 29/09").
- Item: initials avatar · "**Name Surname** completed *Day N · Week M*" ·
  "K exercises · 2h ago".
- `Trophy` icon badge when a `PersonalRecord` of that trainee has the same
  calendar day.
- Link → program.

### New PRs — `new-records.ts`

- `PersonalRecord` with `recordDate` in the last 7 days.
- Item: trainee · exercise · **kg × reps** · delta vs previous best for same
  trainee + exercise + reps ("+5 kg") or "first record".
- Max 6, newest first. Empty → encouraging message with a lucide icon.

### 8-week trend — `weekly-trend.ts` + `WeeklyTrendChart` (client)

- X axis: last 8 ISO weeks including the current one.
- Bars: sessions per week. Line (secondary axis): volume = Σ reps × weight of
  `SetPerformed` with `completed = true`.
- Summary above the chart: current-week delta vs previous week.
- One query for feedback + sets of the last 56 days; aggregation in JS.

### Consistency ranking — `consistency-ranking.ts`

- Trainees with an `active` program.
- Adherence = sessions in the last 4 weeks ÷ (`workoutsPerWeek` × elapsed
  weeks, max 4), capped at 100%. Elapsed weeks counted from program
  `startDate` when it started less than 4 weeks ago (minimum 1).
- Top 5 with `ProgressBar`; positions 1–3 get a `Medal` icon in
  gold/silver/bronze colours.

## i18n

New keys under `trainerDashboard.*` in `public/locales/it/trainer.json` and
`public/locales/en/trainer.json`. Keys no longer referenced are removed.
Relative times and day labels formatted per locale.

## Testing

- **Unit (Vitest):** one test file per query module in
  `tests/unit/trainer-dashboard/`, Prisma mocked. Cover thresholds and edge
  cases (no trainees, no program start date, program successor present,
  "never trained", adherence cap, week boundaries, PR delta vs first record).
  Add the modules to the coverage list in `vitest.config.ts` (80%).
- **Component:** empty and populated states for each widget.
- **E2E (Playwright):** home loads all widgets; empty states render; links
  navigate to the expected pages. Existing dashboard E2E assertions updated
  for removed sections.

## Out of scope

- Real-time refresh / client polling.
- Configurable thresholds or widget layout.
- Mobile-specific layout.
- New DB fields or migrations.
