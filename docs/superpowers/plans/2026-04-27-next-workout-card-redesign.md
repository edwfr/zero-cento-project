# Next Workout Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the "next workout" card on the trainee dashboard with a premium-minimal layout (large display numerals, brand-primary accent on the day numeral, optional week-type badge) while keeping the existing brand palette and CTA style.

**Architecture:** Inline JSX rewrite in `src/app/trainee/dashboard/_content.tsx` (no new component). Backend adds `weekType` to each workout in the `/api/programs/[id]/progress` response so the frontend can render the existing `<WeekTypeBadge>` component when the upcoming workout falls in a non-normal week.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Tailwind, Prisma, react-i18next, lucide-react.

**Spec:** `docs/superpowers/specs/2026-04-27-next-workout-card-redesign.md`

---

## File Structure

**Modified:**
- `src/app/api/programs/[id]/progress/route.ts` — extend `workoutsList` items with `weekType`.
- `src/app/trainee/dashboard/_content.tsx` — extend `NextWorkout` interface, rewrite the next-workout card JSX, import `WeekTypeBadge`.
- `public/locales/it/trainee.json` — add new keys.
- `public/locales/en/trainee.json` — add new keys.
- `implementation-docs/CHANGELOG.md` — log the change (per CLAUDE.md workflow rule).

**Created:** None.

**Tests:** The spec confirms no unit tests are required (the modified files are not in `vitest.config.ts` coverage `include`). Verification is manual via `npm run dev` and a type check. If `npm run type-check` and `npm run lint` pass, plus the visual checks in Task 5, the work is done.

---

## Task 1: Add `weekType` to progress API response

**Files:**
- Modify: `src/app/api/programs/[id]/progress/route.ts` (lines 119–142)

**Why:** The dashboard currently receives `nextWorkout` without `weekType`. The badge can't render without it. `week.weekType` is already loaded by the existing Prisma `include`, so we just propagate it.

- [ ] **Step 1: Open the file and locate the workout list builder**

The block is the `workoutsList` `flatMap` starting around line 119. The current returned object is:

```ts
return {
    id: workout.id,
    name: `Giorno ${workout.dayIndex}`,
    weekNumber: week.weekNumber,
    dayOfWeek: workout.dayIndex,
    exerciseCount: workout.workoutExercises.length,
    completed: hasAllFeedback,
    started: hasStartedWorkout,
    feedbackCount: workout.workoutExercises.flatMap((ex) =>
        ex.exerciseFeedbacks.filter((feedback) => hasStartedFeedback([feedback]))
    ).length,
}
```

- [ ] **Step 2: Add `weekType` field**

Insert `weekType: week.weekType,` directly after `weekNumber`. Final block:

```ts
return {
    id: workout.id,
    name: `Giorno ${workout.dayIndex}`,
    weekNumber: week.weekNumber,
    weekType: week.weekType,
    dayOfWeek: workout.dayIndex,
    exerciseCount: workout.workoutExercises.length,
    completed: hasAllFeedback,
    started: hasStartedWorkout,
    feedbackCount: workout.workoutExercises.flatMap((ex) =>
        ex.exerciseFeedbacks.filter((feedback) => hasStartedFeedback([feedback]))
    ).length,
}
```

- [ ] **Step 3: Run type check to confirm no regressions**

Run: `npm run type-check`
Expected: exits with code 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/programs/[id]/progress/route.ts
git commit -m "feat(api): include weekType in program progress workout list"
```

---

## Task 2: Add new i18n keys (Italian)

**Files:**
- Modify: `public/locales/it/trainee.json`

**Why:** The redesigned card needs new labels (`Giorno`, `Settimana`, accessible CTA description) plus localized labels for `WeekTypeBadge`. We pass these via the badge's `labels` prop so Italian users see Italian text.

- [ ] **Step 1: Add keys inside the `dashboard` object**

Add the following keys inside the `dashboard` block (alphabetical placement is fine; the example below appends them after `startWorkout`):

```json
"dayLabel": "Giorno",
"weekLabel": "Settimana",
"startWorkoutAria": "Inizia workout giorno {{day}} settimana {{week}}",
```

- [ ] **Step 2: Add a top-level `weekType` block**

Add a sibling object to `dashboard` (and any other existing top-level objects):

```json
"weekType": {
    "normal": "Standard",
    "test": "Test",
    "deload": "Deload"
}
```

The Italian copy reuses the same words as the defaults — translators can refine later if needed.

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/locales/it/trainee.json', 'utf8'))"`
Expected: exits with code 0.

- [ ] **Step 4: Commit**

```bash
git add public/locales/it/trainee.json
git commit -m "i18n(it): add labels for redesigned next workout card"
```

---

## Task 3: Add new i18n keys (English)

**Files:**
- Modify: `public/locales/en/trainee.json`

- [ ] **Step 1: Add keys inside the `dashboard` object**

```json
"dayLabel": "Day",
"weekLabel": "Week",
"startWorkoutAria": "Start workout day {{day}} week {{week}}",
```

- [ ] **Step 2: Add a top-level `weekType` block**

```json
"weekType": {
    "normal": "Standard",
    "test": "Test",
    "deload": "Deload"
}
```

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/locales/en/trainee.json', 'utf8'))"`
Expected: exits with code 0.

- [ ] **Step 4: Commit**

```bash
git add public/locales/en/trainee.json
git commit -m "i18n(en): add labels for redesigned next workout card"
```

---

## Task 4: Update `NextWorkout` interface and rewrite the card JSX

**Files:**
- Modify: `src/app/trainee/dashboard/_content.tsx`

**Why:** Wire the new field into the type, import the badge component, and render the new layout.

- [ ] **Step 1: Extend the `NextWorkout` interface (lines 33–41)**

Replace the current interface:

```ts
interface NextWorkout {
    id: string
    name: string
    dayOfWeek: number
    weekNumber: number
    exerciseCount: number
    completed: boolean
    started: boolean
}
```

with:

```ts
interface NextWorkout {
    id: string
    name: string
    dayOfWeek: number
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    exerciseCount: number
    completed: boolean
    started: boolean
}
```

- [ ] **Step 2: Add `WeekTypeBadge` to the `@/components` import**

Find line 6:

```ts
import { NavigationCard, ProgressBar, SkeletonDashboard } from '@/components'
```

Replace with:

```ts
import { NavigationCard, ProgressBar, SkeletonDashboard, WeekTypeBadge } from '@/components'
```

If `WeekTypeBadge` is not yet exported from `src/components/index.ts`, add an export there as well. Verify before continuing:

```bash
grep -n "WeekTypeBadge" src/components/index.ts
```

If the grep returns nothing, append to `src/components/index.ts`:

```ts
export { default as WeekTypeBadge } from './WeekTypeBadge'
```

- [ ] **Step 3: Replace the next-workout card JSX (lines 188–214)**

Replace the entire block:

```tsx
{nextWorkout && (
    <div className="bg-white border border-gray-200 border-l-4 border-l-brand-primary rounded-lg shadow-md p-8 mb-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-primary mb-2">
                    {t('trainee:dashboard.nextWorkout')}
                </p>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    {t('trainee:dashboard.workoutDay', {
                        day: nextWorkout.dayOfWeek,
                        week: nextWorkout.weekNumber,
                    })}
                </h2>
                <p className="text-gray-600">{t('trainee:dashboard.exercisesToComplete', { count: nextWorkout.exerciseCount })}</p>
            </div>
            <div className="w-full sm:w-auto">
                <Link
                    href={`/trainee/workouts/${nextWorkout.id}`}
                    className="inline-flex w-full items-center justify-center gap-2 border border-brand-primary text-brand-primary hover:bg-[#FFF7E5] font-semibold px-6 py-3 rounded-lg transition-colors"
                >
                    <Play className="w-4 h-4" />
                    {nextWorkoutActionLabel}
                </Link>
            </div>
        </div>
    </div>
)}
```

with:

```tsx
{nextWorkout && (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-primary">
                {t('trainee:dashboard.nextWorkout')}
            </p>
            {nextWorkout.weekType !== 'normal' && (
                <WeekTypeBadge
                    weekType={nextWorkout.weekType}
                    labels={{
                        normal: t('trainee:weekType.normal'),
                        test: t('trainee:weekType.test'),
                        deload: t('trainee:weekType.deload'),
                    }}
                />
            )}
        </div>

        <div className="flex items-end gap-6">
            <div className="flex flex-col">
                <span className="text-6xl sm:text-7xl font-black leading-none text-brand-primary">
                    {nextWorkout.dayOfWeek}
                </span>
                <span className="text-xs uppercase tracking-[0.12em] text-gray-500 mt-1">
                    {t('trainee:dashboard.dayLabel')}
                </span>
            </div>
            <span className="text-4xl sm:text-5xl text-gray-300 self-center pb-2" aria-hidden="true">
                ·
            </span>
            <div className="flex flex-col">
                <span className="text-6xl sm:text-7xl font-black leading-none text-gray-900">
                    {nextWorkout.weekNumber}
                </span>
                <span className="text-xs uppercase tracking-[0.12em] text-gray-500 mt-1">
                    {t('trainee:dashboard.weekLabel')}
                </span>
            </div>
        </div>

        <p className="text-base text-gray-600 mt-4">
            {t('trainee:dashboard.exercisesToComplete', { count: nextWorkout.exerciseCount })}
        </p>

        <div className="mt-6">
            <Link
                href={`/trainee/workouts/${nextWorkout.id}`}
                aria-label={t('trainee:dashboard.startWorkoutAria', {
                    day: nextWorkout.dayOfWeek,
                    week: nextWorkout.weekNumber,
                })}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 border border-brand-primary text-brand-primary hover:bg-[#FFF7E5] font-semibold px-6 py-3 rounded-lg transition-colors"
            >
                <Play className="w-4 h-4" />
                {nextWorkoutActionLabel}
            </Link>
        </div>
    </div>
)}
```

- [ ] **Step 4: Run lint and type check**

Run: `npm run type-check && npm run lint`
Expected: both exit with code 0. The `Play` import is still used; no unused-import warnings should appear.

- [ ] **Step 5: Commit**

```bash
git add src/app/trainee/dashboard/_content.tsx src/components/index.ts
git commit -m "feat(trainee): redesign next workout card with display numerals and week badge"
```

(Omit `src/components/index.ts` from the `git add` if it was not modified.)

---

## Task 5: Manual visual verification

**Files:** None.

**Why:** The spec defines visual outcomes; we have no automated visual coverage for this card. Type-check and lint already passed in earlier tasks; this task confirms the rendered result.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server listens on `http://localhost:3000`.

- [ ] **Step 2: Sign in as a trainee with an active program**

Navigate to `http://localhost:3000/trainee/dashboard`. Confirm the next workout card renders.

- [ ] **Step 3: Verify normal-week rendering**

For a workout in a `normal` week:
- No `WeekTypeBadge` is shown in the eyebrow row.
- The day numeral is rendered in brand-primary orange; the week numeral in dark gray.
- Both numerals are large (`text-7xl` at desktop width) with small uppercase labels underneath.
- The exercises-to-complete line is below the numerals.
- The CTA keeps the existing outline brand-primary style.

- [ ] **Step 4: Verify test/deload week rendering**

Use Prisma Studio (`npm run prisma:studio`) or seed data to mark the upcoming week as `test` or `deload`, refresh the dashboard, and confirm:
- The badge appears at the top right of the eyebrow row, with the correct color (`Test` flame icon, `Deload` wind icon).
- The badge text matches the active locale (Italian default → "Test" / "Deload").

- [ ] **Step 5: Verify mobile layout**

Open Chrome DevTools, set viewport to 375px (iPhone SE). Confirm:
- Numerals shrink to `text-6xl` and remain side by side with the centered dot separator.
- The CTA button spans the full width of the card.
- Nothing overflows horizontally.

- [ ] **Step 6: Verify language switch**

Toggle the language to English (if a switcher is available, otherwise edit `localStorage` value `i18nextLng`). Confirm `Day`, `Week`, and the badge labels render in English.

- [ ] **Step 7: No commit needed for this task.**

---

## Task 6: Update `CHANGELOG.md`

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

**Why:** CLAUDE.md workflow rule requires a changelog entry after each modification.

- [ ] **Step 1: Append a new entry under the most recent date heading**

Use the existing changelog formatting. Add an entry like:

```md
- **Trainee dashboard — Next workout card redesign** (2026-04-27)
  - Replaced the title-and-subtitle layout with display numerals (day in brand-primary, week in neutral dark) and an optional `WeekTypeBadge` for non-normal weeks.
  - Extended `GET /api/programs/[id]/progress` workout objects with `weekType` so the frontend can drive the badge.
  - Added i18n keys for `dayLabel`, `weekLabel`, `startWorkoutAria`, and `weekType.{normal,test,deload}` in `en` and `it` locales.
  - Spec: `docs/superpowers/specs/2026-04-27-next-workout-card-redesign.md`
  - Plan: `docs/superpowers/plans/2026-04-27-next-workout-card-redesign.md`
```

Match the heading/section style of the existing changelog (read the file first to see the convention).

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: log next workout card redesign"
```

---

## Self-Review Checklist (run after implementation)

Before marking the work done:
- [ ] Spec coverage — every spec section maps to a task above (visual, data flow, i18n, edge cases, testing).
- [ ] No placeholders remain; every step has concrete code or a concrete command.
- [ ] Type/property names match across tasks: `weekType`, `dayLabel`, `weekLabel`, `startWorkoutAria`, `weekType.{normal,test,deload}`.
- [ ] `npm run type-check` passes.
- [ ] `npm run lint` passes.
- [ ] Manual checks in Task 5 all pass.
