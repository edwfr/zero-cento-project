# Trainee Measurements (Anthropometrics) — Design

**Date:** 2026-09-21
**Status:** Approved (design), pending spec review

## Goal

Give the trainer a **Misurazioni** tab on the trainee management screen
(`/trainer/trainees/[id]`) holding body data: weight, height and six
circumferences (chest, arm, waist, hips, thigh, calf).

Every value is optional and entered independently — the trainer can log a weight
without touching height, an arm circumference without a thigh one. Every entry is
logged with its date, the way personal records are, so the tab can chart each
metric over time.

The data is **trainer-only**. The trainee has no access to it, in the UI or in the API.

## Non-goals

- No trainee-facing view, notification or export of these measurements.
- No left/right split for limb circumferences (single value per metric).
- No measurement fields in the trainee creation form (`/trainer/trainees/new`) —
  the first measurement is entered from the tab.
- No derived metrics (BMI, body-fat estimates, lean mass) in this iteration.
- No photo/progress-picture attachments.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Row shape | one row per single measurement (`metric` + `value` + `measuredAt`) | independent entry and per-metric history come for free; mirrors `PersonalRecord` |
| Laterality | none — 8 metrics | simpler enum and charts; adding enum values later needs no data migration |
| Entry UX | one modal, one date, 8 optional fields | fewer clicks when several metrics are measured together |
| Same metric, same day | unique constraint + upsert | a re-entry corrects a typo instead of adding a duplicate chart point |
| Chart units | single chart, dual Y axis (cm left, kg right) | mixing kg and cm on one axis flattens the circumference lines |
| Height | in cards and history, excluded from the chart | near-static value, adds noise to a trend chart |

## Architecture

### 1. Database — `prisma/schema.prisma`

Migration: `prisma/migrations/20260921000000_add_trainee_measurements`.

```prisma
enum MeasurementMetric {
  weight    // kg
  height    // cm
  chest     // torace, cm
  arm       // braccio, cm
  waist     // vita, cm
  hips      // fianchi, cm
  thigh     // coscia, cm
  calf      // polpaccio, cm
}

model TraineeMeasurement {
  id         String            @id @default(uuid())
  traineeId  String
  metric     MeasurementMetric
  value      Float
  measuredAt DateTime          @db.Date
  notes      String?
  createdBy  String            // trainer who entered it (audit)
  createdAt  DateTime          @default(now())

  trainee User @relation("TraineeMeasurements", fields: [traineeId], references: [id], onDelete: Cascade)
  creator User @relation("CreatedMeasurements", fields: [createdBy], references: [id])

  @@unique([traineeId, metric, measuredAt])
  @@index([traineeId, measuredAt])
  @@map("trainee_measurements")
}
```

`User` gains two back-relations: `measurements TraineeMeasurement[] @relation("TraineeMeasurements")`
and `createdMeasurements TraineeMeasurement[] @relation("CreatedMeasurements")`.

`measuredAt` is `@db.Date` (no time component): measurements are a calendar fact,
and the unique constraint must compare days, not instants. The API normalizes any
incoming ISO string to midnight UTC before writing.

### 2. Shared metric module — `src/lib/measurements.ts`

Single source of truth for metric knowledge, consumed by schema, API, cards, chart,
table and modal:

```ts
export const MEASUREMENT_METRICS = [
  'weight', 'height', 'chest', 'arm', 'waist', 'hips', 'thigh', 'calf',
] as const
export type MeasurementMetric = (typeof MEASUREMENT_METRICS)[number]

export interface MeasurementMetricMeta {
  labelKey: string        // 'trainer:measurements.metric.weight'
  unit: 'kg' | 'cm'
  min: number
  max: number
  step: number            // 0.1
  inChart: boolean        // false for height
  sortOrder: number       // weight, height, chest, arm, waist, hips, thigh, calf
  chartColor: string      // hex, one per metric
}

export const MEASUREMENT_METRIC_META: Record<MeasurementMetric, MeasurementMetricMeta>
export function isMeasurementMetric(value: unknown): value is MeasurementMetric
export function latestByMetric(rows: Measurement[]): Partial<Record<MeasurementMetric, Measurement>>
export function deltaFromPrevious(rows: Measurement[], metric: MeasurementMetric): number | null
```

Ranges: `weight` 20–400 kg, `height` 50–250 cm, circumferences 5–250 cm.

A compile-time guard asserts `MEASUREMENT_METRICS` and the Prisma enum stay in sync,
following `src/lib/exercise-type.ts`.

`latestByMetric` and `deltaFromPrevious` assume rows sorted `measuredAt desc`;
`deltaFromPrevious` returns `null` when the metric has fewer than two entries.

### 3. Validation — `src/schemas/trainee-measurement.ts`

```ts
export const createMeasurementsSchema = z.object({
  traineeId: z.string().uuid('validation.invalidTraineeId'),
  measuredAt: /* string|Date -> Date, refine not in the future */,
  notes: z.string().max(500).optional(),
  values: z.object({ /* one optional number per metric, range-checked from META */ })
           .refine(v => Object.keys(v).length > 0, 'validation.noMeasurementProvided'),
})

export const updateMeasurementSchema = z.object({
  value: z.number().optional(),      // range checked against the row's metric in the route
  measuredAt: /* same transform */.optional(),
  notes: z.string().max(500).nullable().optional(),
}).refine(obj => Object.keys(obj).length > 0, 'validation.noFieldToUpdate')
```

Per-metric ranges are generated from `MEASUREMENT_METRIC_META`, so a new metric needs
no schema edit. Error messages are i18n keys, per the project convention.

### 4. API — `src/app/api/trainee-measurements/`

| Route | Method | Behaviour |
|---|---|---|
| `/api/trainee-measurements?traineeId=&metric=&from=&to=` | GET | list, `orderBy measuredAt desc`; `metric`/`from`/`to` optional filters |
| `/api/trainee-measurements` | POST | body `{ traineeId, measuredAt, notes?, values }` → one upsert per present key, all inside `prisma.$transaction`; returns the created/updated rows |
| `/api/trainee-measurements/[id]` | PATCH | `{ value?, measuredAt?, notes? }` on one row |
| `/api/trainee-measurements/[id]` | DELETE | removes one row |

Responses use `apiSuccess` / `apiError` from `src/lib/api-response.ts`.

**RBAC**

- `trainer` → `requireTrainerOwnership(traineeId)` (`src/lib/auth.ts:281`). For
  `[id]` routes the row is loaded first and its `traineeId` is the one checked.
- `admin` → full access via `requireRole(['admin', 'trainer'])` plus the ownership
  check applied only to trainers.
- `trainee` → **403 on every method**, with no "own data" fallback. This is the
  single enforcement point for the visibility rule; no UI-level hiding is relied on.

**Errors**

| Case | Code | Status | i18n key |
|---|---|---|---|
| Invalid body / out-of-range / future date / empty `values` | `VALIDATION_ERROR` | 400 | from the Zod issue |
| Trainee role, or trainer not owning the trainee | `FORBIDDEN` | 403 | `auth.traineeAccessDenied` |
| Trainee or measurement id not found | `NOT_FOUND` | 404 | `measurement.notFound` / `trainee.notFound` |
| Unexpected | `INTERNAL_ERROR` | 500 | `internal.default` |

Each handler logs failures through `logger.error` and successful writes through
`logger.info` with `{ traineeId, metric, userId }`, matching `personal-records`.

### 5. UI

**New files**

- `src/app/trainer/trainees/[id]/_measurements-tab.tsx` — tab orchestrator: fetch,
  state, modal, delete confirmation
- `src/components/MeasurementTrendChart.tsx` — recharts `LineChart`, dual Y axis
  (cm left, kg right), window + metric filters driven by props
- `src/components/MeasurementFormModal.tsx` — create/edit modal

**Changed file** — `src/app/trainer/trainees/[id]/_content.tsx` (already 1877 lines):
only the `activeTab` union gains `'measurements'`, one `<Button>` is added to the tab
nav (around line 1099) and the tab body renders `<MeasurementsTab traineeId={traineeId} />`.
No new state or fetching logic lands in that file.

**Data flow**: on first activation of the tab (lazy, mirroring the notes tab's
`hasLoadedNotesRef` at `_content.tsx:522`) the tab issues one
`GET /api/trainee-measurements?traineeId=` and keeps the full history in state.
Cards, chart and table derive from that array with `useMemo`; the time window
(`3m | 6m | 1a | tutto`) and metric selection filter client-side, with no refetch.
Mutations refetch the list and raise a toast.

**Zones**

1. **Summary cards** — one per metric in `sortOrder`, each showing last value, its
   date and the delta against the previous entry (▴/▾, neutral colouring: a drop is
   not inherently good or bad). Metrics never measured render an empty state rather
   than disappearing, so the trainer sees what is missing.
2. **Chart** — default selection: weight + waist. Circumferences on the left axis
   (cm), weight on the right axis (kg). Height is excluded (`inChart: false`).
   Each series plots only its own points, ordered by `measuredAt`.
3. **History table** — `measuredAt desc`, columns date / metric / value / notes /
   actions. Edit opens the modal in single-metric mode; delete goes through
   `ConfirmationModal`.

**Modal** — `Input` + `FormLabel` with controlled React state (the form style used by
`records/_content.tsx`; `react-hook-form` is a dependency but no component uses it today),
`<Button isLoading loadingText={t('common:common.saving')}>` for submit (loader rule
from CLAUDE.md). Empty fields are omitted from the payload; with every field empty
the submit button is disabled.

**Errors in UI** — a failed fetch renders an error panel with retry and no cards or
chart; a failed save shows a toast built with `getApiErrorMessage` and keeps the modal
open with the typed values intact.

### 6. i18n

New keys under `measurements.*` in `public/locales/{en,it}/trainer.json`:
`tab`, `title`, `addButton`, `editTitle`, `empty`, `emptyMetric`, `date`, `notes`,
`deleteConfirmTitle`, `deleteConfirmMessage`, `window.3m|6m|1y|all`, `chartTitle`,
`chartDescription`, `historyTitle`, `delta.none`, and `metric.<name>` for the eight
metrics. Validation keys `validation.noMeasurementProvided`, `validation.noFieldToUpdate`,
`validation.measurementOutOfRange`, `measurement.notFound` go in
`public/locales/{en,it}/validation.json` and `errors.json` respectively, following
where the existing keys of each kind live.

## Testing

Coverage floors in `vitest.config.ts` (`src/lib/**` 94%, `src/schemas/**` 95%,
`src/app/api/**` 92%) apply to the new code.

- `tests/unit/lib/measurements.test.ts` — `latestByMetric`, `deltaFromPrevious`
  (no previous entry, single entry, equal values), metric ordering, `isMeasurementMetric`
- `tests/unit/schemas/trainee-measurement.test.ts` — per-metric ranges, future date,
  empty `values`, unknown key, update schema with no field
- `tests/integration/trainee-measurements.test.ts` — GET/POST/PATCH/DELETE across
  roles (admin, owning trainer, foreign trainer → 403, **trainee → 403**), same-day
  upsert, partial POST creating only the supplied metrics, 404 paths
- `tests/unit/MeasurementsTab.test.tsx` — empty state, cards with delta, chart metric
  filter, modal validation (submit disabled with all fields empty), fetch error panel
- `tests/e2e/trainer-trainee-measurements.spec.ts` — trainer enters weight + arm,
  sees the cards and the chart point, corrects the weight on the same day and gets no
  duplicate point

## Docs

`implementation-docs/CHANGELOG.md` gains an entry describing the tab, the new model
and the trainer-only visibility rule (project workflow rule).
