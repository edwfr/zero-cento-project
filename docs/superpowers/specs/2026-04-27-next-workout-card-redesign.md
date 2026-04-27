# Next Workout Card Redesign — Trainee Dashboard

## Goal

Make the "next workout" card on `/trainee/dashboard` more visually engaging while staying within the project's existing brand palette and component patterns. Direction: **premium minimal** — neutral background, large display numerals, brand-primary (orange) accents only.

## Scope

In scope:
- Visual redesign of the `nextWorkout` card block in `src/app/trainee/dashboard/_content.tsx` (lines 188–214).
- Add `weekType` to the `nextWorkout` payload returned by `GET /api/programs/[id]/progress`.
- Add a `WeekTypeBadge` (existing component) to the card, shown only when `weekType !== 'normal'`.
- New i18n keys for the new labels.

Out of scope:
- Other dashboard cards (active program, navigation cards) — untouched.
- Extracting a reusable `<NextWorkoutCard>` component — confirmed unnecessary; keep inline.
- Quick stats like estimated duration, weekly progress counter — explicitly excluded.
- Changes to the CTA button style — keeps current outline brand-primary.

## Visual design

### Container

- Background: `bg-white`
- Border: `border border-gray-200`, no left accent border
- Radius: `rounded-2xl` (softer than the existing `rounded-lg`)
- Shadow: `shadow-md`
- Padding: `p-8`
- Margin bottom: `mb-8` (unchanged)

### Composition

Three vertical zones:

**Zone 1 — Eyebrow row** (flex, `items-center`, `justify-between`):
- Left: eyebrow label `t('trainee:dashboard.nextWorkout')`, classes `text-sm font-semibold uppercase tracking-[0.12em] text-brand-primary`.
- Right: `<WeekTypeBadge>` rendered only when `nextWorkout.weekType !== 'normal'`. Pass `labels` from translations.

**Zone 2 — Display numerals** (two large numbers side by side with labels under each):

Container: `flex items-end gap-6` (numerals share a baseline visually).

- **Day pair** (vertical stack):
  - Number: `<span>{nextWorkout.dayOfWeek}</span>`, classes `text-6xl sm:text-7xl font-black leading-none text-brand-primary`.
  - Label: `t('trainee:dashboard.dayLabel')` ("Giorno" / "Day"), classes `text-xs uppercase tracking-[0.12em] text-gray-500 mt-1`.
- **Separator** `·`: classes `text-4xl sm:text-5xl text-gray-300 self-center pb-2`.
- **Week pair** (vertical stack):
  - Number: `<span>{nextWorkout.weekNumber}</span>`, classes `text-6xl sm:text-7xl font-black leading-none text-gray-900`.
  - Label: `t('trainee:dashboard.weekLabel')` ("Settimana" / "Week"), classes `text-xs uppercase tracking-[0.12em] text-gray-500 mt-1`.

Below the numerals, on its own line: `t('trainee:dashboard.exercisesToComplete', { count })`, classes `text-base text-gray-600 mt-4`.

The day numeral uses `text-brand-primary` to draw the eye; the week numeral uses neutral `text-gray-900` to balance the composition without competing.

**Zone 3 — CTA** (full-width on mobile, auto on `sm:`):
- Same `<Link>` and styling as the current outline brand button (lines 204–211 in `_content.tsx`).
- Adds `aria-label` describing "start workout day X week Y" using a new translation key.

### Removed elements

- The `<h2>` "Day X · Week Y" title (replaced by the numeral + meta composition).
- The `border-l-4 border-l-brand-primary` left accent.

## Data flow

### Backend — `src/app/api/programs/[id]/progress/route.ts`

In the `workoutsList` builder (around line 119–142), add `weekType: week.weekType` to the returned object. `week.weekType` is already loaded via the Prisma `include`, so no extra query.

The `nextWorkout` is derived as `workoutsList.find((w) => !w.completed)`, so it inherits `weekType` automatically.

### Frontend — `src/app/trainee/dashboard/_content.tsx`

1. Update the `NextWorkout` interface (lines 33–41): add `weekType: 'normal' | 'test' | 'deload'`.
2. Import `WeekTypeBadge` from `@/components`.
3. Rewrite the JSX block at lines 188–214 according to the visual design above.
4. The `Play` icon import stays (still used in the CTA).

## i18n

### Reused keys

- `trainee:dashboard.nextWorkout`
- `trainee:dashboard.exercisesToComplete`
- `trainee:dashboard.startWorkout`
- `trainee:currentProgram.resumeWorkout`

### New keys (add to `public/locales/{en,it}/trainee.json`)

- `dashboard.dayLabel` — "Giorno" / "Day"
- `dashboard.weekLabel` — "Settimana" / "Week"
- `dashboard.startWorkoutAria` — "Inizia workout giorno {{day}} settimana {{week}}" / "Start workout day {{day}} week {{week}}"
- `weekType.normal` — "Standard" / "Standard"
- `weekType.test` — "Test" / "Test"
- `weekType.deload` — "Deload" / "Deload"

The `weekType.*` keys are passed to `WeekTypeBadge` via its `labels` prop so badge text is localized.

## Error handling and edge cases

- If `weekType` is missing from the API response (stale cache, type mismatch), the badge is not rendered. There is no error path.
- `dayOfWeek` and `weekNumber` are guaranteed integers by the Prisma schema; no runtime validation added.
- On mobile (≤640px), numerals shrink to `text-6xl` and stay side by side; the row is compact enough to fit comfortably at 375px width.
- The CTA `aria-label` provides full context for screen readers since the visual layout splits day/week across elements.

## Testing

- Unit tests: no existing test for this card; coverage gate (`vitest.config.ts`) does not list `src/app/trainee/dashboard/_content.tsx`. No new unit test required.
- Manual visual verification on `npm run dev`:
  - Trainee with active program, normal week → no badge.
  - Trainee with active program, test or deload week → badge with correct color.
  - Mobile viewport (375px) → vertical stack readable.
  - Desktop viewport (1280px) → numeral + meta side by side.
- E2E: no new user flow; the existing dashboard smoke test (if any) continues to cover the CTA navigation.

## Files touched

1. `src/app/api/programs/[id]/progress/route.ts` — add `weekType` to workout objects.
2. `src/app/trainee/dashboard/_content.tsx` — extend `NextWorkout` interface, rewrite card JSX.
3. `public/locales/en/trainee.json` — add new keys.
4. `public/locales/it/trainee.json` — add new keys.
5. `implementation-docs/CHANGELOG.md` — log the change.
