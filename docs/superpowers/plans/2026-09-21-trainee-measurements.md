# Trainee Measurements Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a trainer-only **Misurazioni** tab to `/trainer/trainees/[id]` where the trainer logs weight, height and six circumferences over time and sees each metric's trend.

**Architecture:** One row per single measurement (`TraineeMeasurement`: `metric` + `value` + `measuredAt`), so every metric is entered and charted independently. A pure module (`src/lib/measurements.ts`) owns all metric knowledge — labels, units, ranges, colours, chart aggregation — and is consumed by the Zod schema, the API routes and every UI piece. Four REST routes under `/api/trainee-measurements` enforce trainer-only access; the `trainee` role gets 403 on every method.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), Zod, React 19 + Tailwind, recharts, react-i18next, Vitest (jsdom) + Playwright.

**Spec:** `docs/superpowers/specs/2026-09-21-trainee-measurements-design.md`

## Global Constraints

- API responses use `apiSuccess(data, status?)` / `apiError(code, message, status, details?, key?)` from `src/lib/api-response.ts`. Never return bare `Response.json`.
- Auth guards come from `src/lib/auth.ts`: `requireRole`, `requireTrainerOwnership`. Never call `supabase.auth.getSession()` in a route.
- Zod messages are **i18n keys**, not prose (e.g. `'validation.dateCannotBeFuture'`).
- Indentation: 4 spaces. No semicolons at end of statements (match surrounding files).
- Locale JSON files in `public/locales/**` are **UTF-8 with BOM**. Edit them with an editor/tool that preserves the BOM; do not rewrite them with a plain `json.dump`.
- Unit tests mock `react-i18next` globally (`tests/unit/setup.ts`): `t(key)` returns the key itself, so component assertions match on key strings like `measurements.addButton`.
- Test imports use direct component paths (`@/components/Button`), never the `@/components` barrel — the barrel costs ~48s per test file in this repo.
- Coverage floors in `vitest.config.ts` must keep holding: `src/lib/**` 94% lines, `src/schemas/**` 95%, `src/app/api/**` 92%.
- Loaders follow CLAUDE.md: `<Button isLoading loadingText={t('common:common.saving')}>`, never a raw `<button disabled={loading}>`.
- Every metric label, unit, range and colour is declared **once** in `MEASUREMENT_METRIC_META`. No metric string literals scattered in components.
- Branch: `feat/trainee-measurements` (already created). Commit after every task.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `prisma/migrations/20260921000000_add_trainee_measurements/migration.sql` | enum + table + indexes |
| `src/lib/measurements.ts` | metric metadata, guards, date normalization, chart aggregation (pure, no Prisma) |
| `src/schemas/trainee-measurement.ts` | Zod input schemas for POST and PATCH |
| `src/app/api/trainee-measurements/route.ts` | GET list, POST multi-metric upsert |
| `src/app/api/trainee-measurements/[id]/route.ts` | PATCH, DELETE one row |
| `src/components/MeasurementTrendChart.tsx` | recharts line chart, dual Y axis |
| `src/components/MeasurementFormModal.tsx` | create (multi-field) and edit (single-metric) modal |
| `src/app/trainer/trainees/[id]/_measurements-tab.tsx` | tab orchestrator: fetch, cards, chart, history table, mutations |
| `tests/unit/lib/measurements.test.ts` | unit tests for the pure module |
| `tests/unit/schemas/trainee-measurement.test.ts` | unit tests for the schemas |
| `tests/integration/trainee-measurements.test.ts` | route tests for all four methods |
| `tests/unit/measurement-trend-chart.test.tsx` | chart component tests |
| `tests/unit/measurement-form-modal.test.tsx` | modal component tests |
| `tests/unit/trainer-trainee-measurements-tab.test.tsx` | tab component tests |
| `tests/e2e/trainer-trainee-measurements.spec.ts` | end-to-end flow |

**Modified**

| File | Change |
|---|---|
| `prisma/schema.prisma` | `MeasurementMetric` enum, `TraineeMeasurement` model, two `User` back-relations |
| `src/components/index.ts` | export the two new components |
| `src/app/trainer/trainees/[id]/_content.tsx:295` + tab nav (~line 1099) | add the `measurements` tab entry and render `<MeasurementsTab />` |
| `public/locales/it/trainer.json`, `public/locales/en/trainer.json` | `measurements.*` keys |
| `public/locales/{it,en}/validation.json` | `noMeasurementProvided`, `noFieldToUpdate`, `measurementOutOfRange` |
| `public/locales/{it,en}/errors.json` | `measurement.notFound` |
| `implementation-docs/CHANGELOG.md` | feature entry |

---

### Task 1: Database model and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260921000000_add_trainee_measurements/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma client types `MeasurementMetric` (enum: `weight | height | chest | arm | waist | hips | thigh | calf`) and `TraineeMeasurement` (`id, traineeId, metric, value, measuredAt, notes, createdBy, createdAt`), plus `prisma.traineeMeasurement` with a compound unique input named `traineeId_metric_measuredAt`.

- [ ] **Step 1: Add the enum to `prisma/schema.prisma`**

Place it after the `WeightType` enum, before the `RestTime` enum:

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
```

- [ ] **Step 2: Add the model at the end of `prisma/schema.prisma`**

```prisma
model TraineeMeasurement {
  id         String            @id @default(uuid())
  traineeId  String
  metric     MeasurementMetric
  value      Float
  measuredAt DateTime          @db.Date
  notes      String?
  createdBy  String            // trainer che ha inserito la misura (audit)
  createdAt  DateTime          @default(now())

  // Relations
  trainee User @relation("TraineeMeasurements", fields: [traineeId], references: [id], onDelete: Cascade)
  creator User @relation("CreatedMeasurements", fields: [createdBy], references: [id])

  // Una misura per metrica al giorno: un re-inserimento corregge, non duplica
  @@unique([traineeId, metric, measuredAt])
  @@index([traineeId, measuredAt])
  @@map("trainee_measurements")
}
```

- [ ] **Step 3: Add the two back-relations to `model User`**

In the `// Trainee relations` block, after `personalRecords`:

```prisma
  measurements              TraineeMeasurement[]         @relation("TraineeMeasurements")
  createdMeasurements       TraineeMeasurement[]         @relation("CreatedMeasurements")
```

- [ ] **Step 4: Write the migration SQL**

Create `prisma/migrations/20260921000000_add_trainee_measurements/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "MeasurementMetric" AS ENUM ('weight', 'height', 'chest', 'arm', 'waist', 'hips', 'thigh', 'calf');

-- CreateTable
CREATE TABLE "trainee_measurements" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "metric" "MeasurementMetric" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "measuredAt" DATE NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainee_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trainee_measurements_traineeId_metric_measuredAt_key" ON "trainee_measurements"("traineeId", "metric", "measuredAt");

-- CreateIndex
CREATE INDEX "trainee_measurements_traineeId_measuredAt_idx" ON "trainee_measurements"("traineeId", "measuredAt");

-- AddForeignKey
ALTER TABLE "trainee_measurements" ADD CONSTRAINT "trainee_measurements_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_measurements" ADD CONSTRAINT "trainee_measurements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 5: Generate the client and verify it compiles**

Run: `npm run prisma:generate && npm run type-check`
Expected: generation succeeds, `tsc --noEmit` exits 0.

- [ ] **Step 6: Verify the generated enum matches the SQL**

Run: `grep -n "MeasurementMetric" node_modules/.prisma/client/index.d.ts | head -5`
Expected: the enum type is present with the eight values.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260921000000_add_trainee_measurements
git commit -m "feat(db): add trainee measurement model and metric enum"
```

---

### Task 2: Metric module `src/lib/measurements.ts`

**Files:**
- Create: `src/lib/measurements.ts`
- Test: `tests/unit/lib/measurements.test.ts`

**Interfaces:**
- Consumes: `MeasurementMetric` from `@prisma/client` (Task 1).
- Produces:
  - `MEASUREMENT_METRICS: readonly MeasurementMetric[]` (display order)
  - `MEASUREMENT_METRIC_META: Record<MeasurementMetric, MeasurementMetricMeta>` with `{ labelKey, unit: 'kg' | 'cm', min, max, step, inChart, chartColor }`
  - `isMeasurementMetric(value: unknown): value is MeasurementMetric`
  - `isValueInRange(metric: MeasurementMetric, value: number): boolean`
  - `toMeasurementDay(value: Date): Date` — UTC midnight
  - `MeasurementPoint` interface `{ id, metric, value, measuredAt: string, notes: string | null }`
  - `latestByMetric(rows: MeasurementPoint[]): Partial<Record<MeasurementMetric, MeasurementPoint>>`
  - `deltaFromPrevious(rows: MeasurementPoint[], metric: MeasurementMetric): number | null`
  - `buildChartSeries(rows: MeasurementPoint[], metrics: MeasurementMetric[]): ChartRow[]` where `ChartRow = { measuredAt: string } & Partial<Record<MeasurementMetric, number>>`, ascending by date

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lib/measurements.test.ts`:

```tsx
import { describe, it, expect } from 'vitest'
import {
    MEASUREMENT_METRICS,
    MEASUREMENT_METRIC_META,
    buildChartSeries,
    deltaFromPrevious,
    isMeasurementMetric,
    isValueInRange,
    latestByMetric,
    toMeasurementDay,
    type MeasurementPoint,
} from '@/lib/measurements'

const point = (
    id: string,
    metric: MeasurementPoint['metric'],
    value: number,
    measuredAt: string
): MeasurementPoint => ({ id, metric, value, measuredAt, notes: null })

describe('MEASUREMENT_METRIC_META', () => {
    it('declares metadata for every metric', () => {
        for (const metric of MEASUREMENT_METRICS) {
            const meta = MEASUREMENT_METRIC_META[metric]
            expect(meta.labelKey).toBe(`measurements.metric.${metric}`)
            expect(meta.min).toBeLessThan(meta.max)
            expect(meta.chartColor).toMatch(/^#[0-9a-f]{6}$/i)
        }
    })

    it('keeps weight first and height out of the chart', () => {
        expect(MEASUREMENT_METRICS[0]).toBe('weight')
        expect(MEASUREMENT_METRIC_META.weight.unit).toBe('kg')
        expect(MEASUREMENT_METRIC_META.height.inChart).toBe(false)
        expect(MEASUREMENT_METRIC_META.waist.inChart).toBe(true)
    })
})

describe('isMeasurementMetric', () => {
    it('accepts known metrics and rejects anything else', () => {
        expect(isMeasurementMetric('thigh')).toBe(true)
        expect(isMeasurementMetric('neck')).toBe(false)
        expect(isMeasurementMetric(undefined)).toBe(false)
    })
})

describe('isValueInRange', () => {
    it('checks the metric-specific bounds', () => {
        expect(isValueInRange('weight', 78.5)).toBe(true)
        expect(isValueInRange('weight', 5)).toBe(false)
        expect(isValueInRange('arm', 38)).toBe(true)
        expect(isValueInRange('arm', 400)).toBe(false)
    })
})

describe('toMeasurementDay', () => {
    it('strips the time component in UTC', () => {
        const day = toMeasurementDay(new Date('2026-09-21T22:45:10.000Z'))
        expect(day.toISOString()).toBe('2026-09-21T00:00:00.000Z')
    })
})

describe('latestByMetric', () => {
    it('picks the most recent entry per metric regardless of input order', () => {
        const rows = [
            point('a', 'weight', 80, '2026-09-01'),
            point('b', 'weight', 78.5, '2026-09-20'),
            point('c', 'arm', 38, '2026-09-10'),
        ]

        const latest = latestByMetric(rows)

        expect(latest.weight?.id).toBe('b')
        expect(latest.arm?.id).toBe('c')
        expect(latest.thigh).toBeUndefined()
    })
})

describe('deltaFromPrevious', () => {
    it('returns the signed difference against the previous entry', () => {
        const rows = [
            point('a', 'weight', 80, '2026-09-01'),
            point('b', 'weight', 78.5, '2026-09-20'),
        ]

        expect(deltaFromPrevious(rows, 'weight')).toBe(-1.5)
    })

    it('returns null with fewer than two entries', () => {
        expect(deltaFromPrevious([point('a', 'weight', 80, '2026-09-01')], 'weight')).toBeNull()
        expect(deltaFromPrevious([], 'weight')).toBeNull()
    })

    it('returns 0 when the value did not change', () => {
        const rows = [
            point('a', 'waist', 84, '2026-09-01'),
            point('b', 'waist', 84, '2026-09-20'),
        ]

        expect(deltaFromPrevious(rows, 'waist')).toBe(0)
    })

    it('rounds float noise to one decimal', () => {
        const rows = [
            point('a', 'weight', 80.1, '2026-09-01'),
            point('b', 'weight', 78.4, '2026-09-20'),
        ]

        expect(deltaFromPrevious(rows, 'weight')).toBe(-1.7)
    })
})

describe('buildChartSeries', () => {
    it('merges metrics measured on the same day into one ascending row', () => {
        const rows = [
            point('b', 'weight', 78.5, '2026-09-20'),
            point('c', 'waist', 84, '2026-09-20'),
            point('a', 'weight', 80, '2026-09-01'),
            point('d', 'arm', 38, '2026-09-10'),
        ]

        const series = buildChartSeries(rows, ['weight', 'waist'])

        expect(series).toEqual([
            { measuredAt: '2026-09-01', weight: 80 },
            { measuredAt: '2026-09-20', weight: 78.5, waist: 84 },
        ])
    })

    it('returns an empty array when no selected metric has data', () => {
        expect(buildChartSeries([point('a', 'weight', 80, '2026-09-01')], ['calf'])).toEqual([])
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/lib/measurements.test.ts`
Expected: FAIL — "Failed to resolve import '@/lib/measurements'".

- [ ] **Step 3: Write the implementation**

Create `src/lib/measurements.ts`:

```ts
import type { MeasurementMetric as PrismaMeasurementMetric } from '@prisma/client'

/**
 * Single source of truth for body-measurement metrics: labels, units, ranges,
 * chart behaviour. Pure module — no Prisma client, no React — so it can be used
 * by the Zod schemas, the API routes and the UI alike.
 *
 * Array order is display order (cards, table, chart legend).
 */
export const MEASUREMENT_METRICS = [
    'weight',
    'height',
    'chest',
    'arm',
    'waist',
    'hips',
    'thigh',
    'calf',
] as const

export type MeasurementMetric = (typeof MEASUREMENT_METRICS)[number]

// Compile-time guard: type-check fails if the Prisma enum and this list diverge
type AssertSame = [PrismaMeasurementMetric] extends [MeasurementMetric]
    ? [MeasurementMetric] extends [PrismaMeasurementMetric]
        ? true
        : never
    : never
const _prismaEnumInSync: AssertSame = true
void _prismaEnumInSync

export interface MeasurementMetricMeta {
    labelKey: string
    unit: 'kg' | 'cm'
    min: number
    max: number
    step: number
    /** Height is near-static: shown in cards and history, kept out of the trend chart. */
    inChart: boolean
    chartColor: string
}

export const MEASUREMENT_METRIC_META: Record<MeasurementMetric, MeasurementMetricMeta> = {
    weight: { labelKey: 'measurements.metric.weight', unit: 'kg', min: 20, max: 400, step: 0.1, inChart: true, chartColor: '#0F766E' },
    height: { labelKey: 'measurements.metric.height', unit: 'cm', min: 50, max: 250, step: 0.1, inChart: false, chartColor: '#64748B' },
    chest: { labelKey: 'measurements.metric.chest', unit: 'cm', min: 5, max: 250, step: 0.1, inChart: true, chartColor: '#2563EB' },
    arm: { labelKey: 'measurements.metric.arm', unit: 'cm', min: 5, max: 250, step: 0.1, inChart: true, chartColor: '#DB2777' },
    waist: { labelKey: 'measurements.metric.waist', unit: 'cm', min: 5, max: 250, step: 0.1, inChart: true, chartColor: '#EA580C' },
    hips: { labelKey: 'measurements.metric.hips', unit: 'cm', min: 5, max: 250, step: 0.1, inChart: true, chartColor: '#7C3AED' },
    thigh: { labelKey: 'measurements.metric.thigh', unit: 'cm', min: 5, max: 250, step: 0.1, inChart: true, chartColor: '#16A34A' },
    calf: { labelKey: 'measurements.metric.calf', unit: 'cm', min: 5, max: 250, step: 0.1, inChart: true, chartColor: '#CA8A04' },
}

export interface MeasurementPoint {
    id: string
    metric: MeasurementMetric
    value: number
    /** ISO date, day precision (YYYY-MM-DD) or full ISO string. */
    measuredAt: string
    notes: string | null
}

export type MeasurementChartRow = { measuredAt: string } & Partial<Record<MeasurementMetric, number>>

export function isMeasurementMetric(value: unknown): value is MeasurementMetric {
    return typeof value === 'string' && (MEASUREMENT_METRICS as readonly string[]).includes(value)
}

export function isValueInRange(metric: MeasurementMetric, value: number): boolean {
    const { min, max } = MEASUREMENT_METRIC_META[metric]
    return Number.isFinite(value) && value >= min && value <= max
}

/** A measurement is a calendar fact: the unique constraint compares days, not instants. */
export function toMeasurementDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

/** Day key (YYYY-MM-DD) used to group measurements taken on the same date. */
function dayKey(measuredAt: string): string {
    return measuredAt.slice(0, 10)
}

function byDateDesc(a: MeasurementPoint, b: MeasurementPoint): number {
    return dayKey(b.measuredAt).localeCompare(dayKey(a.measuredAt))
}

/** Sorts defensively: callers must not depend on the API's ordering. */
function entriesFor(rows: MeasurementPoint[], metric: MeasurementMetric): MeasurementPoint[] {
    return rows.filter((row) => row.metric === metric).sort(byDateDesc)
}

export function latestByMetric(
    rows: MeasurementPoint[]
): Partial<Record<MeasurementMetric, MeasurementPoint>> {
    const latest: Partial<Record<MeasurementMetric, MeasurementPoint>> = {}

    for (const metric of MEASUREMENT_METRICS) {
        const [mostRecent] = entriesFor(rows, metric)
        if (mostRecent) latest[metric] = mostRecent
    }

    return latest
}

export function deltaFromPrevious(
    rows: MeasurementPoint[],
    metric: MeasurementMetric
): number | null {
    const entries = entriesFor(rows, metric)
    if (entries.length < 2) return null

    return Math.round((entries[0].value - entries[1].value) * 10) / 10
}

export function buildChartSeries(
    rows: MeasurementPoint[],
    metrics: MeasurementMetric[]
): MeasurementChartRow[] {
    const selected = new Set(metrics)
    const byDay = new Map<string, MeasurementChartRow>()

    for (const row of rows) {
        if (!selected.has(row.metric)) continue

        const key = dayKey(row.measuredAt)
        const existing = byDay.get(key) ?? { measuredAt: key }
        existing[row.metric] = row.value
        byDay.set(key, existing)
    }

    return [...byDay.values()].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/lib/measurements.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/measurements.ts tests/unit/lib/measurements.test.ts
git commit -m "feat(lib): add measurement metric metadata and trend helpers"
```

---

### Task 3: Validation schemas `src/schemas/trainee-measurement.ts`

**Files:**
- Create: `src/schemas/trainee-measurement.ts`
- Test: `tests/unit/schemas/trainee-measurement.test.ts`

**Interfaces:**
- Consumes: `MEASUREMENT_METRICS`, `MEASUREMENT_METRIC_META`, `toMeasurementDay` from `@/lib/measurements` (Task 2).
- Produces:
  - `createMeasurementsSchema` — parses `{ traineeId: string, measuredAt: Date, notes?: string, values: Partial<Record<MeasurementMetric, number>> }`
  - `updateMeasurementSchema` — parses `{ value?: number, measuredAt?: Date, notes?: string | null }`
  - types `CreateMeasurementsInput`, `UpdateMeasurementInput`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/schemas/trainee-measurement.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
    createMeasurementsSchema,
    updateMeasurementSchema,
} from '@/schemas/trainee-measurement'

const TRAINEE_ID = '11111111-1111-1111-1111-111111111111'

const validCreate = {
    traineeId: TRAINEE_ID,
    measuredAt: '2026-09-21',
    values: { weight: 78.5, arm: 38.5 },
}

const firstIssue = (result: { success: false; error: { errors: { message: string }[] } }) =>
    result.error.errors[0].message

describe('createMeasurementsSchema', () => {
    it('accepts a partial set of metrics', () => {
        const result = createMeasurementsSchema.safeParse(validCreate)

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.values).toEqual({ weight: 78.5, arm: 38.5 })
            expect(result.data.measuredAt.toISOString()).toBe('2026-09-21T00:00:00.000Z')
        }
    })

    it('rejects an empty values object', () => {
        const result = createMeasurementsSchema.safeParse({ ...validCreate, values: {} })

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.noMeasurementProvided')
    })

    it('rejects an unknown metric key', () => {
        const result = createMeasurementsSchema.safeParse({
            ...validCreate,
            values: { neck: 40 },
        })

        expect(result.success).toBe(false)
    })

    it('rejects a value outside the metric range', () => {
        const result = createMeasurementsSchema.safeParse({
            ...validCreate,
            values: { weight: 5 },
        })

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.measurementOutOfRange')
    })

    it('rejects a future date', () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const result = createMeasurementsSchema.safeParse({ ...validCreate, measuredAt: tomorrow })

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.dateCannotBeFuture')
    })

    it('accepts today', () => {
        const today = new Date().toISOString().slice(0, 10)
        const result = createMeasurementsSchema.safeParse({ ...validCreate, measuredAt: today })

        expect(result.success).toBe(true)
    })

    it('rejects an invalid trainee id', () => {
        const result = createMeasurementsSchema.safeParse({ ...validCreate, traineeId: 'nope' })

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.invalidTraineeId')
    })

    it('rejects notes longer than 500 chars', () => {
        const result = createMeasurementsSchema.safeParse({ ...validCreate, notes: 'x'.repeat(501) })

        expect(result.success).toBe(false)
    })
})

describe('updateMeasurementSchema', () => {
    it('accepts a single field', () => {
        const result = updateMeasurementSchema.safeParse({ value: 79 })

        expect(result.success).toBe(true)
    })

    it('accepts clearing the notes', () => {
        const result = updateMeasurementSchema.safeParse({ notes: null })

        expect(result.success).toBe(true)
    })

    it('rejects an empty payload', () => {
        const result = updateMeasurementSchema.safeParse({})

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.noFieldToUpdate')
    })

    it('rejects a non-positive value', () => {
        const result = updateMeasurementSchema.safeParse({ value: 0 })

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.valuePositive')
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/schemas/trainee-measurement.test.ts`
Expected: FAIL — "Failed to resolve import '@/schemas/trainee-measurement'".

- [ ] **Step 3: Write the implementation**

Create `src/schemas/trainee-measurement.ts`:

```ts
import { z } from 'zod'
import {
    MEASUREMENT_METRICS,
    MEASUREMENT_METRIC_META,
    toMeasurementDay,
    type MeasurementMetric,
} from '@/lib/measurements'

/**
 * Trainee Measurement Validation Schemas
 *
 * Ranges come from MEASUREMENT_METRIC_META, so adding a metric needs no edit here.
 * Messages are i18n keys (project convention), resolved client-side.
 */

const measuredAtSchema = z
    .union([z.string(), z.date()])
    .transform((val) => {
        const date = typeof val === 'string' ? new Date(val) : val
        if (isNaN(date.getTime())) {
            throw new Error('validation.invalidDate')
        }
        return toMeasurementDay(date)
    })
    .refine((date) => date <= toMeasurementDay(new Date()), 'validation.dateCannotBeFuture')

function metricValueSchema(metric: MeasurementMetric) {
    const { min, max } = MEASUREMENT_METRIC_META[metric]
    return z
        .number()
        .min(min, 'validation.measurementOutOfRange')
        .max(max, 'validation.measurementOutOfRange')
        .optional()
}

const valuesShape = Object.fromEntries(
    MEASUREMENT_METRICS.map((metric) => [metric, metricValueSchema(metric)])
) as { [K in MeasurementMetric]: ReturnType<typeof metricValueSchema> }

export const createMeasurementsSchema = z.object({
    traineeId: z.string().uuid('validation.invalidTraineeId'),
    measuredAt: measuredAtSchema,
    notes: z.string().max(500).optional(),
    values: z
        .object(valuesShape)
        .strict()
        .refine(
            (values) => Object.values(values).some((value) => value !== undefined),
            'validation.noMeasurementProvided'
        ),
})

export const updateMeasurementSchema = z
    .object({
        // The metric-specific range is checked in the route, where the row's metric is known
        value: z.number().positive('validation.valuePositive').optional(),
        measuredAt: measuredAtSchema.optional(),
        notes: z.string().max(500).nullable().optional(),
    })
    .refine(
        (payload) =>
            payload.value !== undefined ||
            payload.measuredAt !== undefined ||
            payload.notes !== undefined,
        'validation.noFieldToUpdate'
    )

export type CreateMeasurementsInput = z.infer<typeof createMeasurementsSchema>
export type UpdateMeasurementInput = z.infer<typeof updateMeasurementSchema>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/schemas/trainee-measurement.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/trainee-measurement.ts tests/unit/schemas/trainee-measurement.test.ts
git commit -m "feat(schemas): validate trainee measurement input"
```

---

### Task 4: Collection route — GET list, POST upsert

**Files:**
- Create: `src/app/api/trainee-measurements/route.ts`
- Test: `tests/integration/trainee-measurements.test.ts` (GET/POST sections; Task 5 appends PATCH/DELETE)

**Interfaces:**
- Consumes: `createMeasurementsSchema` (Task 3); `isMeasurementMetric`, `toMeasurementDay` (Task 2); `requireRole`, `requireTrainerOwnership` from `@/lib/auth`.
- Produces: `GET(request)` returning `{ items: TraineeMeasurement[] }`; `POST(request)` returning `{ items: TraineeMeasurement[] }` with status 201.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/trainee-measurements.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { GET, POST } from '@/app/api/trainee-measurements/route'
import { requireTrainerOwnership } from '@/lib/auth'
import { apiError } from '@/lib/api-response'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asTrainee, asUnauthenticated } from '../helpers/auth-mock'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const TRAINEE_ID = '11111111-1111-1111-1111-111111111111'
const MEASUREMENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

const mockMeasurement = {
    id: MEASUREMENT_ID,
    traineeId: TRAINEE_ID,
    metric: 'weight',
    value: 78.5,
    measuredAt: new Date('2026-09-20T00:00:00.000Z'),
    notes: null,
    createdBy: 'trainer-uuid-1',
    createdAt: new Date('2026-09-20T10:00:00.000Z'),
}

function makeRequest(url = `http://localhost:3000/api/trainee-measurements?traineeId=${TRAINEE_ID}`, options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as never)
}

function postRequest(body: unknown) {
    return makeRequest('http://localhost:3000/api/trainee-measurements', {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

/** Trainer authenticated, but the trainee belongs to someone else. */
function asForeignTrainer() {
    asTrainer()
    vi.mocked(requireTrainerOwnership).mockRejectedValue(
        apiError('FORBIDDEN', 'You do not have access to this trainee', 403, undefined, 'auth.traineeAccessDenied')
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/trainee-measurements
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/trainee-measurements', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the trainee measurements for the owning trainer', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findMany.mockResolvedValue([mockMeasurement] as never)

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(body.data.items[0].metric).toBe('weight')
        expect(prismaMock.traineeMeasurement.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { traineeId: TRAINEE_ID } })
        )
    })

    it('filters by metric and date range', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findMany.mockResolvedValue([] as never)

        const res = await GET(
            makeRequest(
                `http://localhost:3000/api/trainee-measurements?traineeId=${TRAINEE_ID}&metric=waist&from=2026-01-01&to=2026-09-21`
            )
        )

        expect(res.status).toBe(200)
        expect(prismaMock.traineeMeasurement.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    traineeId: TRAINEE_ID,
                    metric: 'waist',
                    measuredAt: {
                        gte: new Date('2026-01-01T00:00:00.000Z'),
                        lte: new Date('2026-09-21T00:00:00.000Z'),
                    },
                },
            })
        )
    })

    it('rejects an unknown metric filter with 400', async () => {
        asTrainer()

        const res = await GET(
            makeRequest(`http://localhost:3000/api/trainee-measurements?traineeId=${TRAINEE_ID}&metric=neck`)
        )
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('requires traineeId', async () => {
        asTrainer()

        const res = await GET(makeRequest('http://localhost:3000/api/trainee-measurements'))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.traineeIdRequired')
    })

    it('denies a trainee with 403 and never queries the table', async () => {
        asTrainee()

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('auth.traineeAccessDenied')
        expect(prismaMock.traineeMeasurement.findMany).not.toHaveBeenCalled()
    })

    it('denies a trainer who does not own the trainee', async () => {
        asForeignTrainer()

        const res = await GET(makeRequest())

        expect(res.status).toBe(403)
        expect(prismaMock.traineeMeasurement.findMany).not.toHaveBeenCalled()
    })

    it('allows an admin without an ownership check', async () => {
        asAdmin()
        prismaMock.traineeMeasurement.findMany.mockResolvedValue([mockMeasurement] as never)

        const res = await GET(makeRequest())

        expect(res.status).toBe(200)
        expect(requireTrainerOwnership).not.toHaveBeenCalled()
    })

    it('propagates the 401 from the auth guard', async () => {
        asUnauthenticated()

        const res = await GET(makeRequest())

        expect(res.status).toBe(401)
    })

    it('returns 500 when the query throws', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findMany.mockRejectedValue(new Error('db down') as never)

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.code).toBe('INTERNAL_ERROR')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/trainee-measurements
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/trainee-measurements', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('upserts only the supplied metrics', async () => {
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee' } as never)
        prismaMock.traineeMeasurement.upsert.mockResolvedValue(mockMeasurement as never)

        const res = await POST(
            postRequest({
                traineeId: TRAINEE_ID,
                measuredAt: '2026-09-20',
                values: { weight: 78.5, arm: 38.5 },
            })
        )
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.items).toHaveLength(2)
        expect(prismaMock.traineeMeasurement.upsert).toHaveBeenCalledTimes(2)
        expect(prismaMock.traineeMeasurement.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    traineeId_metric_measuredAt: {
                        traineeId: TRAINEE_ID,
                        metric: 'weight',
                        measuredAt: new Date('2026-09-20T00:00:00.000Z'),
                    },
                },
            })
        )
    })

    it('stores the author of the measurement', async () => {
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee' } as never)
        prismaMock.traineeMeasurement.upsert.mockResolvedValue(mockMeasurement as never)

        await POST(postRequest({ traineeId: TRAINEE_ID, measuredAt: '2026-09-20', values: { weight: 78.5 } }))

        expect(prismaMock.traineeMeasurement.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({ createdBy: 'trainer-uuid-1' }),
            })
        )
    })

    it('rejects an empty values object with 400', async () => {
        asTrainer()

        const res = await POST(postRequest({ traineeId: TRAINEE_ID, measuredAt: '2026-09-20', values: {} }))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(prismaMock.traineeMeasurement.upsert).not.toHaveBeenCalled()
    })

    it('returns 404 when the trainee does not exist', async () => {
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue(null as never)

        const res = await POST(postRequest({ traineeId: TRAINEE_ID, measuredAt: '2026-09-20', values: { weight: 78.5 } }))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('trainee.notFound')
    })

    it('denies a trainee with 403', async () => {
        asTrainee()

        const res = await POST(postRequest({ traineeId: TRAINEE_ID, measuredAt: '2026-09-20', values: { weight: 78.5 } }))

        expect(res.status).toBe(403)
        expect(prismaMock.traineeMeasurement.upsert).not.toHaveBeenCalled()
    })

    it('denies a trainer who does not own the trainee', async () => {
        asForeignTrainer()

        const res = await POST(postRequest({ traineeId: TRAINEE_ID, measuredAt: '2026-09-20', values: { weight: 78.5 } }))

        expect(res.status).toBe(403)
    })

    it('returns 500 when the transaction throws', async () => {
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee' } as never)
        prismaMock.traineeMeasurement.upsert.mockRejectedValue(new Error('db down') as never)

        const res = await POST(postRequest({ traineeId: TRAINEE_ID, measuredAt: '2026-09-20', values: { weight: 78.5 } }))

        expect(res.status).toBe(500)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/trainee-measurements.test.ts`
Expected: FAIL — "Failed to resolve import '@/app/api/trainee-measurements/route'".

- [ ] **Step 3: Write the implementation**

Create `src/app/api/trainee-measurements/route.ts`:

```ts
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole, requireTrainerOwnership } from '@/lib/auth'
import { createMeasurementsSchema } from '@/schemas/trainee-measurement'
import { isMeasurementMetric, type MeasurementMetric } from '@/lib/measurements'
import { logger } from '@/lib/logger'
import type { AuthSession } from '@/lib/auth'

/**
 * Body measurements are trainer-only data: the trainee has no read or write
 * access, on any method. This guard is the single enforcement point — the UI
 * never relies on hiding alone.
 */
async function guardMeasurementAccess(
    session: AuthSession,
    traineeId: string
): Promise<Response | null> {
    if (session.user.role === 'trainee') {
        return apiError('FORBIDDEN', 'Measurements are not visible to trainees', 403, undefined, 'auth.traineeAccessDenied')
    }

    if (session.user.role === 'trainer') {
        await requireTrainerOwnership(traineeId)
    }

    return null
}

/**
 * GET /api/trainee-measurements
 * Query params: traineeId (required), metric, from, to
 * RBAC: owning trainer or admin. Trainees: 403.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])
        const { searchParams } = new URL(request.url)

        const traineeId = searchParams.get('traineeId')
        if (!traineeId) {
            return apiError('VALIDATION_ERROR', 'traineeId is required', 400, undefined, 'validation.traineeIdRequired')
        }

        const denied = await guardMeasurementAccess(session, traineeId)
        if (denied) return denied

        const metric = searchParams.get('metric')
        if (metric && !isMeasurementMetric(metric)) {
            return apiError('VALIDATION_ERROR', 'Unknown metric', 400, undefined, 'validation.invalidMetric')
        }

        const from = searchParams.get('from')
        const to = searchParams.get('to')

        const where: Prisma.TraineeMeasurementWhereInput = { traineeId }
        if (metric) where.metric = metric
        if (from || to) {
            where.measuredAt = {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
            }
        }

        const items = await prisma.traineeMeasurement.findMany({
            where,
            orderBy: [{ measuredAt: 'desc' }, { metric: 'asc' }],
        })

        return apiSuccess({ items })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching trainee measurements')
        return apiError('INTERNAL_ERROR', 'Failed to fetch measurements', 500, undefined, 'internal.default')
    }
}

/**
 * POST /api/trainee-measurements
 * Body: { traineeId, measuredAt, notes?, values: { weight?, height?, ... } }
 * One upsert per supplied metric: re-entering the same metric on the same day
 * corrects the value instead of adding a duplicate chart point.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])
        const body = await request.json()

        const validation = createMeasurementsSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { traineeId, measuredAt, notes, values } = validation.data

        const denied = await guardMeasurementAccess(session, traineeId)
        if (denied) return denied

        const trainee = await prisma.user.findUnique({ where: { id: traineeId } })
        if (!trainee) {
            return apiError('NOT_FOUND', 'Trainee not found', 404, undefined, 'trainee.notFound')
        }
        if (trainee.role !== 'trainee') {
            return apiError('VALIDATION_ERROR', 'User must have trainee role', 400, undefined, 'validation.userMustBeTrainee')
        }

        const entries = Object.entries(values).filter(
            (entry): entry is [MeasurementMetric, number] => entry[1] !== undefined
        )

        const items = await prisma.$transaction(
            entries.map(([metric, value]) =>
                prisma.traineeMeasurement.upsert({
                    where: {
                        traineeId_metric_measuredAt: { traineeId, metric, measuredAt },
                    },
                    create: {
                        traineeId,
                        metric,
                        value,
                        measuredAt,
                        notes: notes ?? null,
                        createdBy: session.user.id,
                    },
                    update: {
                        value,
                        notes: notes ?? null,
                        createdBy: session.user.id,
                    },
                })
            )
        )

        logger.info(
            { traineeId, metrics: entries.map(([metric]) => metric), userId: session.user.id },
            'Trainee measurements saved'
        )

        return apiSuccess({ items }, 201)
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error saving trainee measurements')
        return apiError('INTERNAL_ERROR', 'Failed to save measurements', 500, undefined, 'internal.default')
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/trainee-measurements.test.ts`
Expected: PASS (GET and POST describe blocks green).

- [ ] **Step 5: Type-check and commit**

```bash
npm run type-check
git add src/app/api/trainee-measurements/route.ts tests/integration/trainee-measurements.test.ts
git commit -m "feat(api): list and upsert trainee measurements"
```

---

### Task 5: Item route — PATCH, DELETE

**Files:**
- Create: `src/app/api/trainee-measurements/[id]/route.ts`
- Modify: `tests/integration/trainee-measurements.test.ts` (append two describe blocks)

**Interfaces:**
- Consumes: `updateMeasurementSchema` (Task 3), `isValueInRange` (Task 2), the same `guardMeasurementAccess` rule as Task 4 (duplicated locally — the two route files are the only consumers and Next.js route folders do not share helpers by convention in this repo).
- Produces: `PATCH(request, { params })`, `DELETE(request, { params })`, both with `params: Promise<{ id: string }>`.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/trainee-measurements.test.ts`, after the POST block. Add the import next to the existing route import at the top of the file:

```ts
import { PATCH, DELETE } from '@/app/api/trainee-measurements/[id]/route'
```

```ts
// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/trainee-measurements/[id]
// ═══════════════════════════════════════════════════════════════════════════

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

function patchRequest(body: unknown) {
    return makeRequest(`http://localhost:3000/api/trainee-measurements/${MEASUREMENT_ID}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    })
}

describe('PATCH /api/trainee-measurements/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('updates the value of an owned measurement', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)
        prismaMock.traineeMeasurement.update.mockResolvedValue({ ...mockMeasurement, value: 79 } as never)

        const res = await PATCH(patchRequest({ value: 79 }), withIdParam(MEASUREMENT_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.measurement.value).toBe(79)
        expect(prismaMock.traineeMeasurement.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: MEASUREMENT_ID }, data: { value: 79 } })
        )
    })

    it('clears the notes when null is sent', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)
        prismaMock.traineeMeasurement.update.mockResolvedValue(mockMeasurement as never)

        await PATCH(patchRequest({ notes: null }), withIdParam(MEASUREMENT_ID))

        expect(prismaMock.traineeMeasurement.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { notes: null } })
        )
    })

    it('rejects a value outside the range of the row metric', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)

        const res = await PATCH(patchRequest({ value: 900 }), withIdParam(MEASUREMENT_ID))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.measurementOutOfRange')
        expect(prismaMock.traineeMeasurement.update).not.toHaveBeenCalled()
    })

    it('rejects an empty payload', async () => {
        asTrainer()

        const res = await PATCH(patchRequest({}), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(400)
    })

    it('returns 404 for an unknown id', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(null as never)

        const res = await PATCH(patchRequest({ value: 79 }), withIdParam(MEASUREMENT_ID))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('measurement.notFound')
    })

    it('denies a trainee with 403', async () => {
        asTrainee()

        const res = await PATCH(patchRequest({ value: 79 }), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.traineeMeasurement.update).not.toHaveBeenCalled()
    })

    it('denies a trainer who does not own the trainee', async () => {
        asForeignTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)

        const res = await PATCH(patchRequest({ value: 79 }), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.traineeMeasurement.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update throws', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)
        prismaMock.traineeMeasurement.update.mockRejectedValue(new Error('db down') as never)

        const res = await PATCH(patchRequest({ value: 79 }), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(500)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/trainee-measurements/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /api/trainee-measurements/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    function deleteRequest() {
        return makeRequest(`http://localhost:3000/api/trainee-measurements/${MEASUREMENT_ID}`, {
            method: 'DELETE',
        })
    }

    it('deletes an owned measurement', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)
        prismaMock.traineeMeasurement.delete.mockResolvedValue(mockMeasurement as never)

        const res = await DELETE(deleteRequest(), withIdParam(MEASUREMENT_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.success).toBe(true)
        expect(prismaMock.traineeMeasurement.delete).toHaveBeenCalledWith({ where: { id: MEASUREMENT_ID } })
    })

    it('returns 404 for an unknown id', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(null as never)

        const res = await DELETE(deleteRequest(), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(404)
    })

    it('denies a trainee with 403', async () => {
        asTrainee()

        const res = await DELETE(deleteRequest(), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.traineeMeasurement.delete).not.toHaveBeenCalled()
    })

    it('returns 500 when the delete throws', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)
        prismaMock.traineeMeasurement.delete.mockRejectedValue(new Error('db down') as never)

        const res = await DELETE(deleteRequest(), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(500)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/trainee-measurements.test.ts`
Expected: FAIL — "Failed to resolve import '@/app/api/trainee-measurements/[id]/route'".

- [ ] **Step 3: Write the implementation**

Create `src/app/api/trainee-measurements/[id]/route.ts`:

```ts
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole, requireTrainerOwnership, type AuthSession } from '@/lib/auth'
import { updateMeasurementSchema } from '@/schemas/trainee-measurement'
import { isValueInRange } from '@/lib/measurements'
import { logger } from '@/lib/logger'

type RouteContext = { params: Promise<{ id: string }> }

/** Same rule as the collection route: trainees never reach measurement data. */
async function guardMeasurementAccess(
    session: AuthSession,
    traineeId: string
): Promise<Response | null> {
    if (session.user.role === 'trainee') {
        return apiError('FORBIDDEN', 'Measurements are not visible to trainees', 403, undefined, 'auth.traineeAccessDenied')
    }

    if (session.user.role === 'trainer') {
        await requireTrainerOwnership(traineeId)
    }

    return null
}

/**
 * PATCH /api/trainee-measurements/[id]
 * Body: { value?, measuredAt?, notes? }
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        if (session.user.role === 'trainee') {
            return apiError('FORBIDDEN', 'Measurements are not visible to trainees', 403, undefined, 'auth.traineeAccessDenied')
        }

        const body = await request.json()
        const validation = updateMeasurementSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const measurement = await prisma.traineeMeasurement.findUnique({ where: { id } })
        if (!measurement) {
            return apiError('NOT_FOUND', 'Measurement not found', 404, undefined, 'measurement.notFound')
        }

        const denied = await guardMeasurementAccess(session, measurement.traineeId)
        if (denied) return denied

        const { value, measuredAt, notes } = validation.data

        if (value !== undefined && !isValueInRange(measurement.metric, value)) {
            return apiError('VALIDATION_ERROR', 'Value out of range for this metric', 400, undefined, 'validation.measurementOutOfRange')
        }

        const data: Prisma.TraineeMeasurementUpdateInput = {}
        if (value !== undefined) data.value = value
        if (measuredAt !== undefined) data.measuredAt = measuredAt
        if (notes !== undefined) data.notes = notes

        const updated = await prisma.traineeMeasurement.update({ where: { id }, data })

        logger.info(
            { measurementId: id, traineeId: measurement.traineeId, userId: session.user.id },
            'Trainee measurement updated'
        )

        return apiSuccess({ measurement: updated })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error, measurementId: id }, 'Error updating trainee measurement')
        return apiError('INTERNAL_ERROR', 'Failed to update measurement', 500, undefined, 'internal.default')
    }
}

/**
 * DELETE /api/trainee-measurements/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        if (session.user.role === 'trainee') {
            return apiError('FORBIDDEN', 'Measurements are not visible to trainees', 403, undefined, 'auth.traineeAccessDenied')
        }

        const measurement = await prisma.traineeMeasurement.findUnique({ where: { id } })
        if (!measurement) {
            return apiError('NOT_FOUND', 'Measurement not found', 404, undefined, 'measurement.notFound')
        }

        const denied = await guardMeasurementAccess(session, measurement.traineeId)
        if (denied) return denied

        await prisma.traineeMeasurement.delete({ where: { id } })

        logger.info(
            { measurementId: id, traineeId: measurement.traineeId, userId: session.user.id },
            'Trainee measurement deleted'
        )

        return apiSuccess({ success: true })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error, measurementId: id }, 'Error deleting trainee measurement')
        return apiError('INTERNAL_ERROR', 'Failed to delete measurement', 500, undefined, 'internal.default')
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/trainee-measurements.test.ts`
Expected: PASS, all four describe blocks green.

- [ ] **Step 5: Check API coverage still clears the floor**

Run: `npx vitest run tests/integration/trainee-measurements.test.ts --coverage.enabled --coverage.include='src/app/api/trainee-measurements/**'`
Expected: lines ≥ 92%, functions ≥ 95%. If below, add the missing error-path case before moving on.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/trainee-measurements/[id]/route.ts" tests/integration/trainee-measurements.test.ts
git commit -m "feat(api): update and delete a single trainee measurement"
```

---

### Task 6: i18n keys

**Files:**
- Modify: `public/locales/it/trainer.json`, `public/locales/en/trainer.json`
- Modify: `public/locales/it/validation.json`, `public/locales/en/validation.json`
- Modify: `public/locales/it/errors.json`, `public/locales/en/errors.json`

**Interfaces:**
- Consumes: `labelKey` values from `MEASUREMENT_METRIC_META` (Task 2) and the error keys emitted in Tasks 4–5.
- Produces: the `measurements.*` namespace used by every UI task (7, 8, 9).

**These files are UTF-8 with BOM. Keep the BOM and the 4-space indentation.**

- [ ] **Step 1: Add the `measurements` block to `public/locales/it/trainer.json`**

Insert as a new top-level key after `"athletes"`:

```json
    "measurements": {
        "tab": "Misurazioni",
        "title": "Misurazioni",
        "subtitle": "Dati antropometrici visibili solo a te, non all'atleta",
        "addButton": "Nuova misurazione",
        "createTitle": "Nuova misurazione",
        "editTitle": "Modifica misurazione",
        "date": "Data",
        "value": "Valore",
        "notes": "Note",
        "notesPlaceholder": "Note sulla misurazione (opzionale)",
        "empty": "Nessuna misurazione registrata per questo atleta",
        "emptyMetric": "Mai misurato",
        "emptyChart": "Nessun dato per le metriche selezionate",
        "lastMeasured": "Rilevato il {{date}}",
        "deltaNone": "Prima misurazione",
        "chartTitle": "Andamento nel tempo",
        "chartDescription": "Seleziona le metriche da confrontare e la finestra temporale",
        "historyTitle": "Storico misurazioni",
        "metricColumn": "Metrica",
        "deleteConfirmTitle": "Elimina misurazione",
        "deleteConfirmMessage": "Vuoi eliminare questa misurazione? L'operazione non è reversibile.",
        "saveError": "Impossibile salvare la misurazione",
        "loadError": "Impossibile caricare le misurazioni",
        "retry": "Riprova",
        "window": {
            "3m": "3 mesi",
            "6m": "6 mesi",
            "1y": "1 anno",
            "all": "Tutto"
        },
        "metric": {
            "weight": "Peso",
            "height": "Altezza",
            "chest": "Torace",
            "arm": "Braccio",
            "waist": "Vita",
            "hips": "Fianchi",
            "thigh": "Coscia",
            "calf": "Polpaccio"
        }
    },
```

- [ ] **Step 2: Add the same block to `public/locales/en/trainer.json`**

```json
    "measurements": {
        "tab": "Measurements",
        "title": "Measurements",
        "subtitle": "Body data visible only to you, not to the athlete",
        "addButton": "New measurement",
        "createTitle": "New measurement",
        "editTitle": "Edit measurement",
        "date": "Date",
        "value": "Value",
        "notes": "Notes",
        "notesPlaceholder": "Notes about this measurement (optional)",
        "empty": "No measurements recorded for this athlete",
        "emptyMetric": "Never measured",
        "emptyChart": "No data for the selected metrics",
        "lastMeasured": "Taken on {{date}}",
        "deltaNone": "First measurement",
        "chartTitle": "Trend over time",
        "chartDescription": "Pick the metrics to compare and the time window",
        "historyTitle": "Measurement history",
        "metricColumn": "Metric",
        "deleteConfirmTitle": "Delete measurement",
        "deleteConfirmMessage": "Delete this measurement? This cannot be undone.",
        "saveError": "Could not save the measurement",
        "loadError": "Could not load the measurements",
        "retry": "Retry",
        "window": {
            "3m": "3 months",
            "6m": "6 months",
            "1y": "1 year",
            "all": "All"
        },
        "metric": {
            "weight": "Weight",
            "height": "Height",
            "chest": "Chest",
            "arm": "Arm",
            "waist": "Waist",
            "hips": "Hips",
            "thigh": "Thigh",
            "calf": "Calf"
        }
    },
```

- [ ] **Step 3: Add the validation keys**

`public/locales/it/validation.json`:

```json
        "noMeasurementProvided": "Inserisci almeno una misura",
        "noFieldToUpdate": "Nessun campo da aggiornare",
        "measurementOutOfRange": "Valore fuori dall'intervallo consentito",
        "invalidMetric": "Metrica non valida",
        "valuePositive": "Il valore deve essere positivo",
```

`public/locales/en/validation.json`:

```json
        "noMeasurementProvided": "Enter at least one measurement",
        "noFieldToUpdate": "No field to update",
        "measurementOutOfRange": "Value outside the allowed range",
        "invalidMetric": "Invalid metric",
        "valuePositive": "Value must be positive",
```

- [ ] **Step 4: Add the error keys**

`public/locales/it/errors.json`, as a new `measurement` object alongside the other resources:

```json
    "measurement": {
        "notFound": "Misurazione non trovata"
    },
```

`public/locales/en/errors.json`:

```json
    "measurement": {
        "notFound": "Measurement not found"
    },
```

- [ ] **Step 5: Verify both locales parse and stay in sync**

Run:

```bash
node -e "
const fs = require('fs')
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''))
const keys = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' ? keys(v, prefix + k + '.') : [prefix + k])
for (const file of ['trainer.json', 'validation.json', 'errors.json']) {
  const it = keys(read('public/locales/it/' + file)).sort()
  const en = keys(read('public/locales/en/' + file)).sort()
  const diff = it.filter(k => !en.includes(k)).concat(en.filter(k => !it.includes(k)))
  console.log(file, diff.length === 0 ? 'OK' : 'MISMATCH: ' + diff.join(', '))
}
"
```

Expected: `trainer.json OK`, `validation.json OK`, `errors.json OK`.

- [ ] **Step 6: Verify the BOM survived**

Run: `file public/locales/it/trainer.json public/locales/en/trainer.json public/locales/it/errors.json`
Expected: every line says `UTF-8 (with BOM) text`.

- [ ] **Step 7: Commit**

```bash
git add public/locales
git commit -m "feat(i18n): add measurement labels and error keys"
```

---

### Task 7: `MeasurementTrendChart` component

**Files:**
- Create: `src/components/MeasurementTrendChart.tsx`
- Modify: `src/components/index.ts`
- Test: `tests/unit/measurement-trend-chart.test.tsx`

**Interfaces:**
- Consumes: `buildChartSeries`, `MEASUREMENT_METRIC_META`, `MeasurementPoint`, `MeasurementMetric` (Task 2); `measurements.*` keys (Task 6).
- Produces: default export `MeasurementTrendChart` with props
  `{ rows: MeasurementPoint[]; selectedMetrics: MeasurementMetric[]; emptyLabel: string }`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/measurement-trend-chart.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => {
    const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>
    return {
        ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
            <div data-testid="chart-container">{children}</div>
        ),
        LineChart: ({ children, data }: { children?: ReactNode; data?: unknown[] }) => (
            <div data-testid="chart" data-points={data?.length ?? 0}>
                {children}
            </div>
        ),
        Line: ({ dataKey, yAxisId }: { dataKey: string; yAxisId: string }) => (
            <div data-testid={`line-${dataKey}`} data-axis={yAxisId} />
        ),
        YAxis: ({ yAxisId, orientation }: { yAxisId: string; orientation?: string }) => (
            <div data-testid={`yaxis-${yAxisId}`} data-orientation={orientation ?? 'left'} />
        ),
        XAxis: () => null,
        CartesianGrid: () => null,
        Legend: () => null,
        Tooltip: () => null,
        Wrapper,
    }
})

import MeasurementTrendChart from '@/components/MeasurementTrendChart'
import type { MeasurementPoint } from '@/lib/measurements'

const rows: MeasurementPoint[] = [
    { id: 'a', metric: 'weight', value: 80, measuredAt: '2026-09-01', notes: null },
    { id: 'b', metric: 'weight', value: 78.5, measuredAt: '2026-09-20', notes: null },
    { id: 'c', metric: 'waist', value: 84, measuredAt: '2026-09-20', notes: null },
]

describe('MeasurementTrendChart', () => {
    it('renders one line per selected metric', () => {
        render(
            <MeasurementTrendChart rows={rows} selectedMetrics={['weight', 'waist']} emptyLabel="empty" />
        )

        expect(screen.getByTestId('line-weight')).toBeInTheDocument()
        expect(screen.getByTestId('line-waist')).toBeInTheDocument()
        expect(screen.getByTestId('chart')).toHaveAttribute('data-points', '2')
    })

    it('puts weight on the right kg axis and circumferences on the left cm axis', () => {
        render(
            <MeasurementTrendChart rows={rows} selectedMetrics={['weight', 'waist']} emptyLabel="empty" />
        )

        expect(screen.getByTestId('line-weight')).toHaveAttribute('data-axis', 'kg')
        expect(screen.getByTestId('line-waist')).toHaveAttribute('data-axis', 'cm')
        expect(screen.getByTestId('yaxis-kg')).toHaveAttribute('data-orientation', 'right')
        expect(screen.getByTestId('yaxis-cm')).toHaveAttribute('data-orientation', 'left')
    })

    it('renders the empty label instead of the chart when nothing is selected', () => {
        render(<MeasurementTrendChart rows={rows} selectedMetrics={[]} emptyLabel="Nessun dato" />)

        expect(screen.getByText('Nessun dato')).toBeInTheDocument()
        expect(screen.queryByTestId('chart')).not.toBeInTheDocument()
    })

    it('renders the empty label when the selected metrics have no data', () => {
        render(<MeasurementTrendChart rows={rows} selectedMetrics={['calf']} emptyLabel="Nessun dato" />)

        expect(screen.getByText('Nessun dato')).toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/measurement-trend-chart.test.tsx`
Expected: FAIL — cannot resolve `@/components/MeasurementTrendChart`.

- [ ] **Step 3: Write the implementation**

Create `src/components/MeasurementTrendChart.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import {
    buildChartSeries,
    MEASUREMENT_METRIC_META,
    type MeasurementMetric,
    type MeasurementPoint,
} from '@/lib/measurements'
import { formatDate } from '@/lib/date-format'

export interface MeasurementTrendChartProps {
    rows: MeasurementPoint[]
    selectedMetrics: MeasurementMetric[]
    emptyLabel: string
}

/**
 * Weight (kg) and circumferences (cm) share one chart but not one axis:
 * a single axis would flatten the cm lines against the kg scale.
 */
export default function MeasurementTrendChart({
    rows,
    selectedMetrics,
    emptyLabel,
}: MeasurementTrendChartProps) {
    const { t } = useTranslation('trainer')

    const series = useMemo(
        () => buildChartSeries(rows, selectedMetrics),
        [rows, selectedMetrics]
    )

    if (series.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                {emptyLabel}
            </div>
        )
    }

    return (
        <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="measuredAt" tickFormatter={(value: string) => formatDate(value)} />
                    <YAxis yAxisId="cm" orientation="left" unit=" cm" width={64} />
                    <YAxis yAxisId="kg" orientation="right" unit=" kg" width={64} />
                    <Tooltip labelFormatter={(value) => formatDate(String(value))} />
                    <Legend />
                    {selectedMetrics.map((metric) => {
                        const meta = MEASUREMENT_METRIC_META[metric]
                        return (
                            <Line
                                key={metric}
                                type="monotone"
                                dataKey={metric}
                                name={t(meta.labelKey)}
                                stroke={meta.chartColor}
                                strokeWidth={2}
                                yAxisId={meta.unit === 'kg' ? 'kg' : 'cm'}
                                connectNulls
                                dot={{ r: 3 }}
                            />
                        )
                    })}
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
```

- [ ] **Step 4: Export it from the barrel**

In `src/components/index.ts`, next to the other default-export components:

```ts
export { default as MeasurementTrendChart } from './MeasurementTrendChart'
export type { MeasurementTrendChartProps } from './MeasurementTrendChart'
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/measurement-trend-chart.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/MeasurementTrendChart.tsx src/components/index.ts tests/unit/measurement-trend-chart.test.tsx
git commit -m "feat(ui): add measurement trend chart with dual axis"
```

---

### Task 8: `MeasurementFormModal` component

**Files:**
- Create: `src/components/MeasurementFormModal.tsx`
- Modify: `src/components/index.ts`
- Test: `tests/unit/measurement-form-modal.test.tsx`

**Interfaces:**
- Consumes: `MEASUREMENT_METRICS`, `MEASUREMENT_METRIC_META`, `MeasurementMetric`, `MeasurementPoint` (Task 2); `Button`, `Input`, `FormLabel` from `@/components/*`; `formatDateForInput`, `getTodayForInput` from `@/lib/date-format`.
- Produces: default export `MeasurementFormModal` with props

```ts
export interface MeasurementCreatePayload {
    measuredAt: string
    notes?: string
    values: Partial<Record<MeasurementMetric, number>>
}

export interface MeasurementEditPayload {
    id: string
    value: number
    measuredAt: string
    notes: string | null
}

export interface MeasurementFormModalProps {
    mode: 'create' | 'edit'
    initial?: MeasurementPoint
    isSaving: boolean
    onClose: () => void
    onCreate: (payload: MeasurementCreatePayload) => void
    onEdit: (payload: MeasurementEditPayload) => void
}
```

The form uses controlled React state (the repo's existing form style, e.g. `src/app/trainer/trainees/[id]/records/_content.tsx`); `react-hook-form` is a dependency but is not used in any component today, so do not introduce it here.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/measurement-form-modal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import MeasurementFormModal from '@/components/MeasurementFormModal'

const onCreate = vi.fn()
const onEdit = vi.fn()
const onClose = vi.fn()

const renderCreate = () =>
    render(
        <MeasurementFormModal
            mode="create"
            isSaving={false}
            onClose={onClose}
            onCreate={onCreate}
            onEdit={onEdit}
        />
    )

describe('MeasurementFormModal — create', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders one input per metric', () => {
        renderCreate()

        for (const metric of ['weight', 'height', 'chest', 'arm', 'waist', 'hips', 'thigh', 'calf']) {
            expect(screen.getByLabelText(`measurements.metric.${metric}`)).toBeInTheDocument()
        }
    })

    it('disables submit while every metric field is empty', () => {
        renderCreate()

        expect(screen.getByRole('button', { name: 'common.save' })).toBeDisabled()
    })

    it('submits only the filled metrics', () => {
        renderCreate()

        fireEvent.change(screen.getByLabelText('measurements.metric.weight'), { target: { value: '78.5' } })
        fireEvent.change(screen.getByLabelText('measurements.metric.arm'), { target: { value: '38.5' } })
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

        expect(onCreate).toHaveBeenCalledWith(
            expect.objectContaining({ values: { weight: 78.5, arm: 38.5 } })
        )
    })

    it('shows an inline error for an out-of-range value and does not submit', () => {
        renderCreate()

        fireEvent.change(screen.getByLabelText('measurements.metric.weight'), { target: { value: '5' } })
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

        expect(screen.getByText('validation.measurementOutOfRange')).toBeInTheDocument()
        expect(onCreate).not.toHaveBeenCalled()
    })

    it('closes on cancel', () => {
        renderCreate()

        fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

        expect(onClose).toHaveBeenCalled()
    })
})

describe('MeasurementFormModal — edit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('edits one metric only, prefilled', () => {
        render(
            <MeasurementFormModal
                mode="edit"
                initial={{ id: 'm-1', metric: 'waist', value: 84, measuredAt: '2026-09-20', notes: 'post cena' }}
                isSaving={false}
                onClose={onClose}
                onCreate={onCreate}
                onEdit={onEdit}
            />
        )

        const input = screen.getByLabelText('measurements.metric.waist') as HTMLInputElement
        expect(input.value).toBe('84')
        expect(screen.queryByLabelText('measurements.metric.weight')).not.toBeInTheDocument()

        fireEvent.change(input, { target: { value: '83' } })
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

        expect(onEdit).toHaveBeenCalledWith({
            id: 'm-1',
            value: 83,
            measuredAt: '2026-09-20',
            notes: 'post cena',
        })
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/measurement-form-modal.test.tsx`
Expected: FAIL — cannot resolve `@/components/MeasurementFormModal`.

- [ ] **Step 3: Write the implementation**

Create `src/components/MeasurementFormModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'
import {
    MEASUREMENT_METRICS,
    MEASUREMENT_METRIC_META,
    isValueInRange,
    type MeasurementMetric,
    type MeasurementPoint,
} from '@/lib/measurements'
import { formatDateForInput, getTodayForInput } from '@/lib/date-format'

export interface MeasurementCreatePayload {
    measuredAt: string
    notes?: string
    values: Partial<Record<MeasurementMetric, number>>
}

export interface MeasurementEditPayload {
    id: string
    value: number
    measuredAt: string
    notes: string | null
}

export interface MeasurementFormModalProps {
    mode: 'create' | 'edit'
    initial?: MeasurementPoint
    isSaving: boolean
    onClose: () => void
    onCreate: (payload: MeasurementCreatePayload) => void
    onEdit: (payload: MeasurementEditPayload) => void
}

type FieldValues = Partial<Record<MeasurementMetric, string>>

/**
 * One modal, two shapes: "create" shows every metric (all optional, the trainer
 * fills only what was measured), "edit" shows the single metric of the row.
 */
export default function MeasurementFormModal({
    mode,
    initial,
    isSaving,
    onClose,
    onCreate,
    onEdit,
}: MeasurementFormModalProps) {
    const { t } = useTranslation(['trainer', 'common'])

    const visibleMetrics: readonly MeasurementMetric[] =
        mode === 'edit' && initial ? [initial.metric] : MEASUREMENT_METRICS

    const [values, setValues] = useState<FieldValues>(() =>
        mode === 'edit' && initial ? { [initial.metric]: String(initial.value) } : {}
    )
    const [measuredAt, setMeasuredAt] = useState(() =>
        initial ? formatDateForInput(initial.measuredAt) : getTodayForInput()
    )
    const [notes, setNotes] = useState(initial?.notes ?? '')
    const [errors, setErrors] = useState<Partial<Record<MeasurementMetric, string>>>({})

    const filledMetrics = visibleMetrics.filter((metric) => (values[metric] ?? '').trim() !== '')
    const canSubmit = filledMetrics.length > 0 && !isSaving

    const handleSubmit = () => {
        const parsed: Partial<Record<MeasurementMetric, number>> = {}
        const nextErrors: Partial<Record<MeasurementMetric, string>> = {}

        for (const metric of filledMetrics) {
            const value = Number((values[metric] ?? '').replace(',', '.'))
            if (!Number.isFinite(value) || !isValueInRange(metric, value)) {
                nextErrors[metric] = 'validation.measurementOutOfRange'
                continue
            }
            parsed[metric] = value
        }

        setErrors(nextErrors)
        if (Object.keys(nextErrors).length > 0) return

        if (mode === 'edit' && initial) {
            onEdit({
                id: initial.id,
                value: parsed[initial.metric] as number,
                measuredAt,
                notes: notes.trim() === '' ? null : notes,
            })
            return
        }

        onCreate({
            measuredAt,
            ...(notes.trim() === '' ? {} : { notes }),
            values: parsed,
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                <h2 className="mb-4 text-xl font-bold text-gray-900">
                    {mode === 'edit' ? t('measurements.editTitle') : t('measurements.createTitle')}
                </h2>

                <div className="mb-4">
                    <FormLabel htmlFor="measurement-date" required>
                        {t('measurements.date')}
                    </FormLabel>
                    <Input
                        id="measurement-date"
                        type="date"
                        value={measuredAt}
                        max={getTodayForInput()}
                        onChange={(event) => setMeasuredAt(event.target.value)}
                        disabled={isSaving}
                    />
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {visibleMetrics.map((metric) => {
                        const meta = MEASUREMENT_METRIC_META[metric]
                        const fieldId = `measurement-${metric}`
                        return (
                            <div key={metric}>
                                <FormLabel htmlFor={fieldId}>{t(meta.labelKey)}</FormLabel>
                                <Input
                                    id={fieldId}
                                    type="number"
                                    inputMode="decimal"
                                    step={meta.step}
                                    min={meta.min}
                                    max={meta.max}
                                    value={values[metric] ?? ''}
                                    onChange={(event) =>
                                        setValues((current) => ({ ...current, [metric]: event.target.value }))
                                    }
                                    state={errors[metric] ? 'error' : 'default'}
                                    helperText={errors[metric] ? t(errors[metric] as string) : meta.unit}
                                    disabled={isSaving}
                                />
                            </div>
                        )
                    })}
                </div>

                <div className="mb-6">
                    <FormLabel htmlFor="measurement-notes">{t('measurements.notes')}</FormLabel>
                    <textarea
                        id="measurement-notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={t('measurements.notesPlaceholder')}
                        maxLength={500}
                        rows={3}
                        disabled={isSaving}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
                        {t('common:common.cancel')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        isLoading={isSaving}
                        loadingText={t('common:common.saving')}
                    >
                        {t('common:common.save')}
                    </Button>
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 4: Export it from the barrel**

In `src/components/index.ts`:

```ts
export { default as MeasurementFormModal } from './MeasurementFormModal'
export type {
    MeasurementFormModalProps,
    MeasurementCreatePayload,
    MeasurementEditPayload,
} from './MeasurementFormModal'
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/measurement-form-modal.test.tsx`
Expected: PASS.

`ButtonVariant` is `'primary' | 'secondary' | 'danger'` (`src/components/Button.tsx:4`): the cancel button uses `secondary`, the submit button the default `primary`.

- [ ] **Step 6: Commit**

```bash
git add src/components/MeasurementFormModal.tsx src/components/index.ts tests/unit/measurement-form-modal.test.tsx
git commit -m "feat(ui): add measurement create and edit modal"
```

---

### Task 9: Measurements tab and wiring

**Files:**
- Create: `src/app/trainer/trainees/[id]/_measurements-tab.tsx`
- Modify: `src/app/trainer/trainees/[id]/_content.tsx` (line 295 union, tab nav ~line 1099, tab body after the `reports` block)
- Test: `tests/unit/trainer-trainee-measurements-tab.test.tsx`

**Interfaces:**
- Consumes: `MeasurementTrendChart` (Task 7), `MeasurementFormModal` + its payload types (Task 8), `latestByMetric`, `deltaFromPrevious`, `MEASUREMENT_METRICS`, `MEASUREMENT_METRIC_META` (Task 2), the four API routes (Tasks 4–5), `measurements.*` keys (Task 6).
- Produces: default export `MeasurementsTab` with props `{ traineeId: string }`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/trainer-trainee-measurements-tab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('recharts', () => {
    const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>
    return {
        ResponsiveContainer: Passthrough,
        LineChart: Passthrough,
        Line: () => null,
        CartesianGrid: () => null,
        Legend: () => null,
        Tooltip: () => null,
        XAxis: () => null,
        YAxis: () => null,
    }
})

const showToast = vi.fn()
vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast }),
    ToastProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

import MeasurementsTab from '@/app/trainer/trainees/[id]/_measurements-tab'

const rows = [
    { id: 'm-1', metric: 'weight', value: 78.5, measuredAt: '2026-09-20', notes: null },
    { id: 'm-2', metric: 'weight', value: 80, measuredAt: '2026-09-01', notes: null },
    { id: 'm-3', metric: 'waist', value: 84, measuredAt: '2026-09-20', notes: 'mattina' },
]

function mockFetchOnce(items: unknown[]) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { items } }),
    }) as never
}

describe('MeasurementsTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('loads the measurements of the trainee on mount', async () => {
        mockFetchOnce(rows)

        render(<MeasurementsTab traineeId="trainee-1" />)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/trainee-measurements?traineeId=trainee-1')
        })
    })

    it('shows the latest value and the delta per metric', async () => {
        mockFetchOnce(rows)

        render(<MeasurementsTab traineeId="trainee-1" />)

        expect(await screen.findByText('78.5 kg')).toBeInTheDocument()
        expect(screen.getByText('-1.5')).toBeInTheDocument()
        expect(screen.getByText('84 cm')).toBeInTheDocument()
    })

    it('shows an empty state for metrics never measured', async () => {
        mockFetchOnce(rows)

        render(<MeasurementsTab traineeId="trainee-1" />)

        await screen.findByText('78.5 kg')
        expect(screen.getAllByText('measurements.emptyMetric').length).toBeGreaterThan(0)
    })

    it('renders an error panel when the fetch fails', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'boom', key: 'internal.default' } }),
        }) as never

        render(<MeasurementsTab traineeId="trainee-1" />)

        expect(await screen.findByText('measurements.loadError')).toBeInTheDocument()
    })

    it('posts only the filled metrics when the modal is submitted', async () => {
        mockFetchOnce(rows)

        render(<MeasurementsTab traineeId="trainee-1" />)
        await screen.findByText('78.5 kg')

        fireEvent.click(screen.getByRole('button', { name: 'measurements.addButton' }))
        fireEvent.change(screen.getByLabelText('measurements.metric.arm'), { target: { value: '38.5' } })

        const postFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { items: [] } }) })
        global.fetch = postFetch as never

        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

        await waitFor(() => {
            expect(postFetch).toHaveBeenCalledWith(
                '/api/trainee-measurements',
                expect.objectContaining({ method: 'POST' })
            )
        })

        const payload = JSON.parse((postFetch.mock.calls[0][1] as RequestInit).body as string)
        expect(payload.values).toEqual({ arm: 38.5 })
        expect(payload.traineeId).toBe('trainee-1')
    })

    it('toggles a metric in the chart selection', async () => {
        mockFetchOnce(rows)

        render(<MeasurementsTab traineeId="trainee-1" />)
        await screen.findByText('78.5 kg')

        const waistToggle = screen.getByRole('checkbox', { name: 'measurements.metric.waist' })
        expect(waistToggle).toBeChecked()

        fireEvent.click(waistToggle)
        expect(waistToggle).not.toBeChecked()
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/trainer-trainee-measurements-tab.test.tsx`
Expected: FAIL — cannot resolve `@/app/trainer/trainees/[id]/_measurements-tab`.

- [ ] **Step 3: Write the implementation**

Create `src/app/trainer/trainees/[id]/_measurements-tab.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { ActionIconButton } from '@/components/ActionIconButton'
import { Button } from '@/components/Button'
import ConfirmationModal from '@/components/ConfirmationModal'
import MeasurementFormModal, {
    type MeasurementCreatePayload,
    type MeasurementEditPayload,
} from '@/components/MeasurementFormModal'
import MeasurementTrendChart from '@/components/MeasurementTrendChart'
import { SkeletonDetail } from '@/components/Skeleton'
import { useToast } from '@/components/ToastNotification'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/date-format'
import {
    MEASUREMENT_METRICS,
    MEASUREMENT_METRIC_META,
    deltaFromPrevious,
    latestByMetric,
    type MeasurementMetric,
    type MeasurementPoint,
} from '@/lib/measurements'

type TimeWindow = '3m' | '6m' | '1y' | 'all'

const TIME_WINDOWS: TimeWindow[] = ['3m', '6m', '1y', 'all']

const WINDOW_MONTHS: Record<Exclude<TimeWindow, 'all'>, number> = { '3m': 3, '6m': 6, '1y': 12 }

const CHART_METRICS = MEASUREMENT_METRICS.filter((metric) => MEASUREMENT_METRIC_META[metric].inChart)

export interface MeasurementsTabProps {
    traineeId: string
}

/**
 * Trainer-only tab: body measurements over time. The API refuses the trainee
 * role outright, so nothing here needs a role check.
 */
export default function MeasurementsTab({ traineeId }: MeasurementsTabProps) {
    const { t } = useTranslation(['trainer', 'common'])
    const { showToast } = useToast()

    const [rows, setRows] = useState<MeasurementPoint[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; initial?: MeasurementPoint } | null>(null)
    const [pendingDelete, setPendingDelete] = useState<MeasurementPoint | null>(null)
    const [timeWindow, setTimeWindow] = useState<TimeWindow>('6m')
    const [selectedMetrics, setSelectedMetrics] = useState<MeasurementMetric[]>(['weight', 'waist'])

    const fetchRows = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            const res = await fetch(`/api/trainee-measurements?traineeId=${traineeId}`)
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('measurements.loadError'), t))
            }

            setRows(data.data?.items ?? [])
        } catch {
            setError(t('measurements.loadError'))
        } finally {
            setLoading(false)
        }
    }, [traineeId, t])

    useEffect(() => {
        void fetchRows()
    }, [fetchRows])

    const windowedRows = useMemo(() => {
        if (timeWindow === 'all') return rows

        const threshold = new Date()
        threshold.setMonth(threshold.getMonth() - WINDOW_MONTHS[timeWindow])
        const thresholdKey = threshold.toISOString().slice(0, 10)

        return rows.filter((row) => row.measuredAt.slice(0, 10) >= thresholdKey)
    }, [rows, timeWindow])

    const latest = useMemo(() => latestByMetric(rows), [rows])

    const toggleMetric = (metric: MeasurementMetric) => {
        setSelectedMetrics((current) =>
            current.includes(metric) ? current.filter((item) => item !== metric) : [...current, metric]
        )
    }

    const handleCreate = async (payload: MeasurementCreatePayload) => {
        setSaving(true)
        try {
            const res = await fetch('/api/trainee-measurements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ traineeId, ...payload }),
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('measurements.saveError'), t))
            }

            setModal(null)
            await fetchRows()
            showToast(t('common:common.success'), 'success')
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('measurements.saveError'), 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = async (payload: MeasurementEditPayload) => {
        setSaving(true)
        try {
            const res = await fetch(`/api/trainee-measurements/${payload.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    value: payload.value,
                    measuredAt: payload.measuredAt,
                    notes: payload.notes,
                }),
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('measurements.saveError'), t))
            }

            setModal(null)
            await fetchRows()
            showToast(t('common:common.success'), 'success')
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('measurements.saveError'), 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (row: MeasurementPoint) => {
        try {
            const res = await fetch(`/api/trainee-measurements/${row.id}`, { method: 'DELETE' })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('measurements.saveError'), t))
            }

            setPendingDelete(null)
            await fetchRows()
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('measurements.saveError'), 'error')
        }
    }

    if (loading) return <SkeletonDetail />

    if (error) {
        return (
            <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-state-error">
                <p>{error}</p>
                <Button type="button" onClick={() => void fetchRows()}>
                    {t('measurements.retry')}
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{t('measurements.title')}</h2>
                    <p className="mt-1 text-sm text-gray-600">{t('measurements.subtitle')}</p>
                </div>
                <Button type="button" icon={<Plus />} onClick={() => setModal({ mode: 'create' })}>
                    {t('measurements.addButton')}
                </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {MEASUREMENT_METRICS.map((metric) => {
                    const meta = MEASUREMENT_METRIC_META[metric]
                    const point = latest[metric]
                    const delta = deltaFromPrevious(rows, metric)

                    return (
                        <div key={metric} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {t(meta.labelKey)}
                            </p>
                            {point ? (
                                <>
                                    <p className="mt-1 text-lg font-bold text-gray-900">
                                        {`${point.value} ${meta.unit}`}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {t('measurements.lastMeasured', { date: formatDate(point.measuredAt) })}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-gray-700">
                                        {delta === null ? t('measurements.deltaNone') : delta > 0 ? `+${delta}` : `${delta}`}
                                    </p>
                                </>
                            ) : (
                                <p className="mt-1 text-sm text-gray-400">{t('measurements.emptyMetric')}</p>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Chart */}
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
                <h3 className="text-lg font-bold text-gray-900">{t('measurements.chartTitle')}</h3>
                <p className="mb-4 text-sm text-gray-600">{t('measurements.chartDescription')}</p>

                <div className="mb-4 flex flex-wrap items-center gap-4">
                    <select
                        value={timeWindow}
                        onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}
                        aria-label={t('measurements.chartTitle')}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    >
                        {TIME_WINDOWS.map((option) => (
                            <option key={option} value={option}>
                                {t(`measurements.window.${option}`)}
                            </option>
                        ))}
                    </select>

                    <div className="flex flex-wrap gap-3">
                        {CHART_METRICS.map((metric) => (
                            <label key={metric} className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={selectedMetrics.includes(metric)}
                                    onChange={() => toggleMetric(metric)}
                                    aria-label={t(MEASUREMENT_METRIC_META[metric].labelKey)}
                                    className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                />
                                {t(MEASUREMENT_METRIC_META[metric].labelKey)}
                            </label>
                        ))}
                    </div>
                </div>

                <MeasurementTrendChart
                    rows={windowedRows}
                    selectedMetrics={selectedMetrics}
                    emptyLabel={t('measurements.emptyChart')}
                />
            </div>

            {/* History */}
            <div className="rounded-xl border border-gray-100 bg-white shadow-md">
                <h3 className="px-5 py-4 text-lg font-bold text-gray-900">{t('measurements.historyTitle')}</h3>

                {rows.length === 0 ? (
                    <p className="px-5 pb-5 text-sm text-gray-500">{t('measurements.empty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                                        {t('measurements.date')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                                        {t('measurements.metricColumn')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                                        {t('measurements.value')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                                        {t('measurements.notes')}
                                    </th>
                                    <th className="px-6 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {rows.map((row) => {
                                    const meta = MEASUREMENT_METRIC_META[row.metric]
                                    return (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                                                {formatDate(row.measuredAt)}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                                                {t(meta.labelKey)}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                                {`${row.value} ${meta.unit}`}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{row.notes ?? '—'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <ActionIconButton
                                                        variant="edit"
                                                        label={t('common:common.edit')}
                                                        onClick={() => setModal({ mode: 'edit', initial: row })}
                                                    />
                                                    <ActionIconButton
                                                        variant="delete"
                                                        label={t('common:common.delete')}
                                                        onClick={() => setPendingDelete(row)}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modal && (
                <MeasurementFormModal
                    mode={modal.mode}
                    initial={modal.initial}
                    isSaving={saving}
                    onClose={() => setModal(null)}
                    onCreate={(payload) => void handleCreate(payload)}
                    onEdit={(payload) => void handleEdit(payload)}
                />
            )}

            {pendingDelete && (
                <ConfirmationModal
                    isOpen
                    title={t('measurements.deleteConfirmTitle')}
                    message={t('measurements.deleteConfirmMessage')}
                    variant="danger"
                    onClose={() => setPendingDelete(null)}
                    onConfirm={() => void handleDelete(pendingDelete)}
                />
            )}
        </div>
    )
}
```

`ConfirmationModal` takes `{ isOpen, onClose, onConfirm, title, message, variant?, confirmText?, cancelText?, isLoading? }` (`src/components/ConfirmationModal.tsx:9`) — the props above match it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/trainer-trainee-measurements-tab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the tab into the trainee detail page**

In `src/app/trainer/trainees/[id]/_content.tsx`:

a. Extend the union at line 295:

```tsx
    const [activeTab, setActiveTab] = useState<'notes' | 'programs' | 'records' | 'reports' | 'measurements'>('programs')
```

b. Add the import next to `TraineeNotesEditor`:

```tsx
import MeasurementsTab from './_measurements-tab'
```

c. Add the nav button after the `reports` one, copying the existing class expression:

```tsx
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setActiveTab('measurements')}
                                aria-pressed={activeTab === 'measurements'}
                                className={`rounded-none border-b-2 bg-transparent px-1 pb-4 font-semibold shadow-none hover:bg-transparent ${activeTab === 'measurements'
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {t('measurements.tab')}
                            </Button>
```

`variant="secondary" size="sm"` matches every sibling tab button (`_content.tsx:1103-1115`); keep the class expression identical so the tabs stay visually uniform.

d. Add the tab body after the `activeTab === 'reports'` block:

```tsx
                {activeTab === 'measurements' && <MeasurementsTab traineeId={traineeId} />}
```

- [ ] **Step 6: Verify the existing detail tests still pass**

Run: `npx vitest run tests/unit/trainer-trainee-programs-tab.test.tsx tests/unit/trainer-trainee-detail-sbd-report.test.tsx`
Expected: PASS — the tab nav gained one button, nothing else changed.

- [ ] **Step 7: Type-check, lint, commit**

```bash
npm run type-check
npm run lint
git add "src/app/trainer/trainees/[id]/_measurements-tab.tsx" "src/app/trainer/trainees/[id]/_content.tsx" tests/unit/trainer-trainee-measurements-tab.test.tsx
git commit -m "feat(trainer): add measurements tab to trainee detail"
```

---

### Task 10: E2E flow, changelog, full verification

**Files:**
- Create: `tests/e2e/trainer-trainee-measurements.spec.ts`
- Modify: `implementation-docs/CHANGELOG.md`

**Interfaces:**
- Consumes: everything from Tasks 1–9; `E2E_CREDENTIALS` from `tests/e2e/fixtures/test-users.ts`.
- Produces: no code interface — this task is verification and documentation.

- [ ] **Step 1: Write the E2E spec**

Create `tests/e2e/trainer-trainee-measurements.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E: trainer records body measurements for a trainee.
 *
 * Prerequisites:
 *   - Seed data present (see ./fixtures/test-users.ts)
 *   - Server running at http://localhost:3000
 */
test.describe('Trainer: trainee measurements', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
    })

    test('records weight and arm, then corrects the weight same day', async ({ page }) => {
        await page.goto('/trainer/trainees')
        await page.getByRole('link', { name: /dettagl|detail|gestisci/i }).first().click()
        await page.waitForURL(/\/trainer\/trainees\/[^/]+$/)

        await page.getByRole('button', { name: /misurazioni|measurements/i }).click()
        await page.getByRole('button', { name: /nuova misurazione|new measurement/i }).click()

        await page.locator('#measurement-weight').fill('78.5')
        await page.locator('#measurement-arm').fill('38.5')
        await page.getByRole('button', { name: /salva|save/i }).click()

        await expect(page.getByText('78.5 kg')).toBeVisible()
        await expect(page.getByText('38.5 cm')).toBeVisible()

        const historyRowsBefore = await page.locator('table tbody tr').count()

        // Same metric, same day: corrects instead of duplicating
        await page.getByRole('button', { name: /nuova misurazione|new measurement/i }).click()
        await page.locator('#measurement-weight').fill('79')
        await page.getByRole('button', { name: /salva|save/i }).click()

        await expect(page.getByText('79 kg')).toBeVisible()
        await expect(page.locator('table tbody tr')).toHaveCount(historyRowsBefore)
    })
})
```

- [ ] **Step 2: Run the E2E spec**

Run: `npx playwright test tests/e2e/trainer-trainee-measurements.spec.ts`
Expected: PASS against a running dev server with seed data. If a selector misses because the trainee list link text differs, fix the selector — not the app.

- [ ] **Step 3: Run the whole unit and integration suite with coverage**

Run: `npm run test:unit -- --coverage`
Expected: all tests pass and every threshold in `vitest.config.ts` holds (global 47/46/35/43, `src/lib/**` 94/94/97/88, `src/schemas/**` 95/95/96/87, `src/app/api/**` 92/91/95/87).

If a per-directory floor fails, add the missing test for the uncovered branch; never lower a threshold.

- [ ] **Step 4: Update the changelog**

Append to `implementation-docs/CHANGELOG.md`, following the file's existing entry format:

```markdown
## 2026-09-21 — Trainee measurements tab

- New **Misurazioni** tab on `/trainer/trainees/[id]`: weight, height and six circumferences
  (chest, arm, waist, hips, thigh, calf), each logged with its date.
- New `TraineeMeasurement` model and `MeasurementMetric` enum: one row per single measurement,
  unique per `(trainee, metric, day)` so a same-day re-entry corrects instead of duplicating.
- New API `/api/trainee-measurements` (GET/POST) and `/api/trainee-measurements/[id]` (PATCH/DELETE).
  These are **trainer-only**: the `trainee` role receives 403 on every method.
- Tab shows a summary card per metric with the delta against the previous entry, a trend chart
  with a dual Y axis (cm left, kg right) and a full history table.

Why: the trainer needs body data alongside training data to steer a program, with the same
"log every entry" behaviour the personal records already have, while keeping the numbers
invisible to the athlete.
```

- [ ] **Step 5: Final verification and commit**

```bash
npm run type-check
npm run lint
git add tests/e2e/trainer-trainee-measurements.spec.ts implementation-docs/CHANGELOG.md
git commit -m "test(e2e): cover trainee measurement entry and same-day correction"
```

- [ ] **Step 6: Report the state of the branch**

Run: `git log --oneline master..HEAD`
Expected: ten commits, one per task. Report any task whose verification step did not pass instead of claiming completion.
