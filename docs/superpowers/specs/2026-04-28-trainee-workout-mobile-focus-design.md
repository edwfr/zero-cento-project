# Trainee Workout Detail — Mobile Focus Mode

**Date:** 2026-04-28
**Page:** `/trainee/workouts/[id]`
**File:** `src/app/trainee/workouts/[id]/_content.tsx`

## Goal

Optimize the workout detail screen for mobile usage while preserving all current content and behavior. Address three pain points the user identified:

1. Cramped exercise card header — sets/reps/kg pills + rest/RPE pills wrap awkwardly on narrow screens.
2. Excessive vertical scrolling — list of collapsible cards is long, hard to track progress.
3. Header chrome eats fold — title + program + week banner + swipe hint push first exercise below fold.

## Approach

Replace the current "list of collapsible cards" layout with a **single-exercise focus mode**: only one exercise is rendered at a time, full viewport. Navigation uses swipe + sticky bottom nav. Final step (after the last exercise) shows workout-level notes and the submit CTA.

Applied across all viewports — no separate desktop list.

## Layout Architecture

Three fixed regions:

```
┌─────────────────────────────┐
│  Sticky top bar (~48px)     │  G3 · S2 · [week chip]   ⓘ
├─────────────────────────────┤
│                             │
│  Scrollable body            │
│   ┌ exercise focus card OR  │
│   └ final step (notes)      │
│                             │
├─────────────────────────────┤
│  Sticky bottom nav (~64px)  │  ‹ Prev   3/6   Next ›
└─────────────────────────────┘
```

### Step state machine

New state `currentStep: number`, range `0..exercises.length`:

- `0..exercises.length-1` → render exercise focus card for `sortedExercises[currentStep]`.
- `exercises.length` → render final step (workout notes + submit summary).

`navigateToExercise(index)` becomes `navigateToStep(index)` and clamps to `[0, exercises.length]`. Swipe handlers (`useSwipe`) keep mutating this state.

`activeExerciseIndex`, `expandedExercises`, and `exerciseRefs` are removed (no per-exercise scroll-to needed; only one card mounted at a time). `expandedVideos` is retained — it still controls per-exercise YouTube embed visibility.

## Section 1 — Sticky Top Bar

Replaces existing header block (`<h1>Giorno X — Settimana Y</h1>`, program subtitle, full `WeekTypeBanner`, mobile swipe-hint row).

```
┌────────────────────────────────────┐
│  ‹  G3 · S2  • Test week    ⓘ      │
└────────────────────────────────────┘
```

**Spec:**
- `sticky top-0 z-20`, white bg, `border-b border-gray-200`, height 48px.
- Left: back chevron — handled by existing `DashboardLayout` back navigation; if the layout already renders a back button, the focus-mode bar omits its own and starts with the title.
- Center: `G{dayIndex} · S{weekNumber}` bold + small week-type chip. Chip hidden when `weekType === 'normal'`. Colors match existing `WeekTypeBanner` palette (test = amber, deload = blue).
- Right: info button (`ⓘ` icon) opens a bottom sheet showing full meta (program title, original `WeekTypeBanner` description, day index, week number, any week-level notes that the workout payload exposes).
- Sheet uses an inline conditional `<div>` with backdrop + slide-up panel (no new dependency required).

**Removed:** `<h1>` title, program subtitle, full `WeekTypeBanner` from main flow, mobile swipe-hint row with `‹` `›` buttons + counter.

## Section 2 — Exercise Focus Card

Single card fills the body region. No collapsing — always full content. Vertical order:

```
┌─────────────────────────────────────┐
│ [FOND]  Panca Piana                 │  type tag + name (text-xl bold)
│ Presa stretta                       │  variant (small grey)
│                                     │
│  ┌─────┐ ┌─────┐ ┌──────────┐       │  big targets row
│  │ SETS│ │ REPS│ │   KG     │       │  3 tiles, equal width, flex-1
│  │  4  │ │  8  │ │ 80 (75%) │       │  text-2xl bold values
│  └─────┘ └─────┘ └──────────┘       │
│                                     │
│  🕐 2:00     ⚡ RPE 8                │  secondary row (smaller pills)
│                                     │
│  ▶ Mostra video                     │  video toggle (existing pattern)
│  📝 Note coach: ...                 │  if we.notes
│                                     │
│  ─── SETS ───                       │
│  [sets input — Section 3]           │
│                                     │
│  Overall RPE  [RPESelector]         │  unchanged
└─────────────────────────────────────┘
```

**Big targets row:**
- `flex gap-2`, three tiles each `flex-1 rounded-lg bg-gray-100 px-3 py-3`.
- Each tile: tiny uppercase label (text-[10px]), value `text-2xl font-bold` centered.
- KG tile shows computed value primary; if `weightType !== 'absolute'`, append `(75%)` (or `(+5%)` for `percentage_previous`) inline at smaller size. Reuses existing `compactWeightValue` derivation.

**Secondary row:**
- Two small pills, current colors retained: amber for rest (`Clock3` icon), violet for target RPE (`Gauge` icon).
- Single horizontal line, no wrapping needed at typical widths.

**Removed from card:** numeric prefix `1.`, expand chevron, `ring-2 ring-brand-primary` active highlight (no longer needed — only one card visible).

**Preserved from card:** type tag (FOND/ACC), exercise name, variant, coach notes block (`we.notes`), YouTube video toggle + embed (same `toggleVideo` state behavior, still per-exercise but state is now keyed by current exercise id only), `RPESelector` for overall RPE.

## Section 3 — Sets Input (inline edit + tap-to-complete)

Replaces both the mobile grid AND the desktop table — single unified layout.

```
┌────────────────────────────────────────┐
│ #1   8 reps     80 kg          ✓       │  completed (green check)
│ #2   8 reps     80 kg          ○       │
│ #3   ─ reps     ─ kg           ○       │  no planned data (rare)
│ #4   8 reps     80 kg          ○       │
└────────────────────────────────────────┘
```

**Row anatomy:**
- `grid-cols-[40px_1fr_1fr_48px]`, `min-h-[56px]`, `border-b border-gray-200` between rows, white bg, outer container `rounded-lg border border-gray-200`.
- Col 1: `#N` set number, grey, centered.
- Col 2: reps `<Input type="number" inputMode="numeric">`, planned reps as `placeholder` (ghost text), large centered. Suffix `reps` small grey to right of value.
- Col 3: kg `<Input type="number" step="0.5" inputMode="decimal">`, planned `effectiveWeight` as `placeholder`. Suffix `kg`.
- Col 4: completion ✓ button — 48×48 tap target, empty circle when not done, filled green check when done. Uses existing `Check` icon from lucide.

**Behavior:**
- Inputs always editable. The current code disables inputs when `set.completed` is true — that gate is removed so users can correct after marking a set done.
- Tap-to-complete shortcut: when `toggleSetCompleted` flips a set from `false → true` AND `weight === 0` AND `reps === 0` (i.e. user typed nothing), populate `weight = we.effectiveWeight ?? we.weight ?? 0` and `reps = parsePlannedReps(we.reps)` before flipping. This is the single biggest UX win: if the user did exactly the planned set, one tap records it.
- If the user already typed values, those are kept verbatim (current behavior preserved).
- Tapping the row body outside inputs / ✓ does nothing (avoid accidental completes during scroll).

**Removed:** the separate `md:hidden` mobile grid block AND the `hidden md:block` desktop `<table>` — replaced by one shared layout.

## Section 4 — Sticky Bottom Nav

```
┌────────────────────────────────────┐
│  ‹ Prev      3 / 6      Next ›     │   on exercise step
└────────────────────────────────────┘

┌────────────────────────────────────┐
│  ‹ Prev   ✓ Completa allenamento   │   on final step
└────────────────────────────────────┘
```

**Spec:**
- `sticky bottom-0 z-20`, white bg, `border-t border-gray-200`, `pb-[env(safe-area-inset-bottom)]`, internal padding `px-4 py-3`.
- `flex justify-between items-center`, height ~64px.
- Left button: `Prev` chevron icon + label, disabled when `currentStep === 0`.
- Center counter: `{currentStep + 1} / {exercises.length}` shown only on exercise steps (`currentStep < exercises.length`).
- Right action:
  - On exercise step (any except last): `Next ›` button — increments `currentStep`.
  - On last exercise step: `Next ›` advances to final step (notes screen).
  - On final step: primary CTA `✓ Completa allenamento`, full-width replacing `Next`. Calls existing `handleSubmit` (validation + `doSubmit`).

**Replaces:** existing full-width submit button at the bottom of the page AND the mobile prev/next chevron row.

**Swipe behavior:** `useSwipe` keeps mutating `currentStep`. Swipe past last exercise → final step; swipe right on final step → returns to last exercise.

## Section 5 — Final Step (notes + submit summary)

Reached when `currentStep === exercises.length`. Renders instead of an exercise card:

```
┌─────────────────────────────────────┐
│  Riepilogo                          │  text-2xl bold
│                                     │
│  6 / 6 esercizi · 24 set            │  summary line
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Note allenamento              │  │  label
│  │ ┌───────────────────────────┐ │  │
│  │ │  textarea (globalNotes)   │ │  │  unchanged binding
│  │ └───────────────────────────┘ │  │
│  └───────────────────────────────┘  │
│                                     │
│  ⚠ 2 esercizi senza dati:           │  inline warning panel
│     • Squat                         │  (only when emptyExercises > 0)
│     • Stacco                        │
│                                     │
└─────────────────────────────────────┘
```

**Spec:**
- Heading: `Riepilogo` (i18n `workouts.summary`).
- Summary line:
  - Completed exercises = count of exercises where at least one set has `completed === true`.
  - Total sets done = sum of `completed === true` sets across all exercises.
  - Format via i18n keys with interpolation, e.g. `workouts.summaryStats` → `"{{done}} / {{total}} esercizi · {{sets}} set"`.
- Notes: existing textarea, same `globalNotes` state, same styling.
- Warning panel: amber bg (`bg-amber-50 border-amber-200 text-amber-800`), lists exercise names without a single `completed && weight > 0 && reps > 0` set. Same logic as existing `emptyExercises` computation in `handleSubmit`.
- Submit happens via the bottom-nav CTA. Because the warning is already visible inline, the existing `ConfirmationModal` for "missing data" is no longer needed in this flow — `handleSubmit` calls `doSubmit` directly.

## Out of Scope / Preserved As-Is

Zero changes to:
- Data fetching (`fetchWorkout`), draft-sync timer (`syncDraftFeedback`), localStorage persistence (`loadLocalData` / `saveLocalData` / `clearLocalData`, `STORAGE_KEY`).
- `/api/feedback` payload shape and submission semantics.
- `RPESelector`, `YoutubeEmbed`, `ConfirmationModal` components (the modal is still used elsewhere — only the call from this page's submit path is removed).
- `useSwipe` hook signature and internal logic — only its call site is updated.
- Helpers `parsePlannedReps`, `formatRestTime`, `formatWeightValue`, `formatWeightKg`, plus the inline `compactWeightValue` derivation.
- Validation rule `hasData = sets.some(s => s.completed && s.weight > 0 && s.reps > 0)` — surfaced inline instead of via modal, but unchanged in substance.
- Back navigation logic in `page.tsx` (`backHref` resolution from `from` / `programId` searchParams).

## Files Touched

- `src/app/trainee/workouts/[id]/_content.tsx` — main rewrite of render tree and step state.
- `src/app/trainee/workouts/[id]/loading.tsx` — adjust skeleton shape so it matches new layout (single-card hero + bottom bar) rather than a list of cards.
- `public/locales/en/trainee.json` and `public/locales/it/trainee.json` — add new keys (`workouts.summary`, `workouts.summaryStats`, `workouts.missingDataInline`, `workouts.exerciseStep`, `workouts.workoutMetaTitle`, `workouts.notesLabel` if not present, etc.). Old keys (`workouts.swipeHint`, `workouts.weekLabel`, `workouts.confirmContinue`, `workouts.missingDataTitle`, etc.) kept until grep confirms no remaining references.

## Acceptance Criteria

1. Visiting `/trainee/workouts/{id}` shows only ONE exercise card at a time, never a list.
2. Header chrome above first exercise is at most ~48px (sticky top bar) — title/program/banner moved to info sheet or removed.
3. Bottom nav is always visible at viewport bottom; pressing `Next` past the last exercise goes to the notes/summary step; pressing the CTA there submits the workout.
4. Tapping the ✓ on a set with empty inputs records planned reps + planned effective weight as the actual values (no manual typing required).
5. Inputs remain editable after a set is marked completed.
6. Existing draft sync, localStorage persistence, and successful submit redirect (to dashboard or `/trainee/programs/current` based on `from` param) work unchanged.
7. Layout applied identically across all breakpoints — no `md:` list view.
8. Existing unit/integration tests covering the page (if any) still pass; new tests added for step navigation and the tap-to-complete shortcut.

## Open Risks / Notes

- The current page uses a single shared `globalNotes` state populated from the LAST exercise feedback that has notes. That quirk is preserved — the final-step textarea binds to the same state, so existing notes still load.
- Loading skeleton needs visual update; a stale skeleton would feel jarring.
- Behavior on iOS Safari: ensure `sticky bottom-0` plus `safe-area-inset-bottom` doesn't collide with the system home indicator. Test on a physical device or Safari responsive design mode.
- Bottom-nav swipe interaction: the page-level `useSwipe` may conflict with horizontal scroll inside the YouTube embed. Existing `data-swipe-ignore="true"` attribute on the video block must be respected by the swipe hook (already is).
