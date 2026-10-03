# Subscription Renewals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trainers record subscription renewals (start date + months) per trainee, see expiry alerts in the trainee profile and list, a subscriptions page in the hamburger menu, and a KPI card on the home — all invisible to trainees.

**Architecture:** One `SubscriptionRenewal` row per renewal; `endDate` computed server-side and stored. The current status is derived at read time from `MAX(endDate)` by pure functions in `src/lib/subscriptions.ts` (client-safe), with Prisma queries isolated in `src/lib/subscription-queries.ts` (server-only). API routes mirror `src/app/api/trainee-measurements` (trainee → 403 on every method). UI follows the measurements tab pattern (`useState` + `fetch`, modal with local state).

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), Zod, React 18 + react-i18next, Tailwind, lucide-react, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-subscription-renewals-design.md`

## Global Constraints

- Expiring threshold: `EXPIRING_THRESHOLD_DAYS = 14`; expiring = `0 ≤ daysLeft ≤ 14`; expired = `daysLeft < 0` (end date is the last covered day).
- End date = `startDate + durationMonths`, day clamped to the target month's last day (31/01 + 1 → 28/02). Computed server-side only; any client `endDate` is ignored.
- Current expiry = `MAX(endDate)` across a trainee's renewals. Overlapping renewals allowed (no unique constraint).
- `durationMonths`: integer, 1–36.
- All dates are UTC calendar days (`@db.Date`, midnight UTC). "Today" on the server = `getTodayDateKey()` from `src/lib/date-format.ts`.
- Trainee role: 403 (`auth.traineeAccessDenied`) on every renewal API method. Trainer: `requireTrainerOwnership(traineeId)`. Admin: allowed, no UI.
- Subscriptions page, list alert and home KPI consider only **active** trainees (`isActive = true`) of the **logged-in trainer**.
- Every user-visible string goes through i18n, in both `public/locales/it` and `public/locales/en`. `public/locales/*/trainer.json` starts with a UTF-8 BOM: edit with the Edit tool, never re-serialize the file with a script.
- Loaders: click-triggered async uses `<Button isLoading loadingText={t('common:common.saving')}>`; never a raw disabled `<button>`.
- Coverage thresholds in `vitest.config.ts` apply by glob: `src/lib/**` ≥ 94% lines / 88% branches, `src/schemas/**` ≥ 95/87, `src/app/api/**` ≥ 92/87. New files there must be covered at that level.
- After each task, add the task's files to the CHANGELOG entry created in Task 1 (project rule: CHANGELOG updated after every modification).
- Implementers load the project skills before coding: `zero-cento-backend` (API/Prisma), `zero-cento-frontend` (UI), `zero-cento-testing` (tests).
- Commit only the files touched by the task, on the current branch. No worktrees.

## Review Focus

1. **Midnight around Italy's day boundary** — `getTodayDateKey()` is a UTC day; between 00:00 and 02:00 Italian time "today" is still yesterday, so `daysLeft` can be one higher for up to two hours. Acceptable and consistent with the rest of the app; reviewers should not "fix" it in one place only. (Pinned in Task 2 by testing with explicit UTC `today` values.)
2. **A start date entered as a timestamp late in the UTC day** (e.g. `2026-10-03T22:30:00Z`) must still count from 3 October, not 4 — pinned by the `ignores the time of day` test in Task 2.
3. **Inactive trainee with an expired subscription** — must show no badge in the list and must not appear in the page or KPI counts. Pinned in Task 3 (query filters `isActive`) and Task 10 (badge hidden for inactive).
4. **Existing tests that call `GET /api/users` as a trainer** — the new `groupBy` call returns `undefined` from the deep mock and crashes the route with a 500 unless every such test stubs it. Pinned in Task 6 by running the whole integration suite.
5. **Deleting the only renewal** — the profile banner and list badge must disappear (status back to none), not keep the stale expiry. Pinned in Task 9 (tab reloads shared state after delete) and Task 5 (GET returns `current: null` with no rows).

---

## File map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `SubscriptionRenewal` model + `User` relations |
| `prisma/migrations/20261003000000_add_subscription_renewals/migration.sql` | table, index, FKs |
| `src/lib/subscriptions.ts` | pure domain logic and shared types (client-safe, no Prisma) |
| `src/lib/subscription-queries.ts` | server-only Prisma queries (`getCurrentEndDates`, `getTrainerSubscriptionOverview`) |
| `src/schemas/subscription-renewal.ts` | Zod create/update schemas |
| `src/app/api/subscription-renewals/_access.ts` | single RBAC guard shared by both routes |
| `src/app/api/subscription-renewals/route.ts` | `GET` list + current, `POST` create |
| `src/app/api/subscription-renewals/[id]/route.ts` | `PATCH`, `DELETE` |
| `src/app/api/users/route.ts` | add `subscription` to trainer listing |
| `src/components/SubscriptionStatusBadge.tsx` | status pill |
| `src/components/SubscriptionRenewalFormModal.tsx` | create/edit renewal modal with live end-date preview |
| `src/app/trainer/trainees/[id]/_use-trainee-subscription.ts` | fetch hook shared by banner and tab |
| `src/app/trainer/trainees/[id]/_subscription-alert.tsx` | profile banner |
| `src/app/trainer/trainees/[id]/_subscription-tab.tsx` | tab content |
| `src/app/trainer/trainees/[id]/_content.tsx` | wire tab, banner, `?tab=subscription` |
| `src/app/trainer/trainees/_content.tsx` | list badge |
| `src/app/trainer/subscriptions/{page,_content,loading}.tsx` | subscriptions page |
| `src/components/DashboardLayout.tsx` | nav item |
| `src/app/trainer/dashboard/page.tsx` | home KPI card |
| `public/locales/{it,en}/{trainer,navigation,errors,validation}.json` | copy |

---

### Task 1: Database model and migration

**Files:**
- Modify: `prisma/schema.prisma` (model `User` lines ~79-110; append new model after `TraineeMeasurement`)
- Create: `prisma/migrations/20261003000000_add_subscription_renewals/migration.sql`
- Modify: `implementation-docs/CHANGELOG.md`

**Interfaces:**
- Produces: Prisma model `subscriptionRenewal` with fields `id, traineeId, startDate (Date), durationMonths (Int), endDate (Date), createdBy, createdAt`; type `SubscriptionRenewal` from `@prisma/client`.

- [ ] **Step 1: Add relations to `User`**

In `model User`, after the two measurement relation lines, add:

```prisma
  subscriptionRenewals      SubscriptionRenewal[]        @relation("TraineeRenewals")
  createdRenewals           SubscriptionRenewal[]        @relation("CreatedRenewals")
```

- [ ] **Step 2: Add the model** after `model TraineeMeasurement { ... }`:

```prisma
model SubscriptionRenewal {
  id             String   @id @default(uuid())
  traineeId      String
  startDate      DateTime @db.Date
  durationMonths Int
  endDate        DateTime @db.Date  // computed server-side: startDate + durationMonths (clamped to month end)
  createdBy      String             // trainer who entered the renewal (audit)
  createdAt      DateTime @default(now())

  // Relations
  trainee User @relation("TraineeRenewals", fields: [traineeId], references: [id], onDelete: Cascade)
  creator User @relation("CreatedRenewals", fields: [createdBy], references: [id])

  // No uniqueness: overlapping renewals are allowed, the current expiry is MAX(endDate)
  @@index([traineeId, endDate])
  @@map("subscription_renewals")
}
```

- [ ] **Step 3: Write the migration SQL** `prisma/migrations/20261003000000_add_subscription_renewals/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "subscription_renewals" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "endDate" DATE NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_renewals_traineeId_endDate_idx" ON "subscription_renewals"("traineeId", "endDate");

-- AddForeignKey
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 4: Generate the client and validate**

Run: `npm run prisma:generate && npx prisma validate`
Expected: "Generated Prisma Client" and "The schema at prisma/schema.prisma is valid".

If a local database is configured (`DIRECT_URL` set), also run `npx prisma migrate deploy` and expect "1 migration applied". If not, skip: unit and integration tests use the Prisma mock.

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 6: Create the CHANGELOG entry**

In `implementation-docs/CHANGELOG.md`, directly under `### Changed` in `## [Unreleased]`, insert:

```markdown
### [3 Ottobre 2026] — Rinnovi abbonamento atleti (solo trainer)

**File modificati:** `prisma/schema.prisma`, `prisma/migrations/20261003000000_add_subscription_renewals/migration.sql` (nuovo), `implementation-docs/CHANGELOG.md`
**Note:** Il trainer registra i rinnovi di abbonamento di ogni atleta (data inizio + durata in mesi); il sistema calcola la scadenza e avvisa quando mancano ≤ 14 giorni o l'abbonamento è scaduto. Nessuna gestione pagamenti. Dati invisibili all'atleta. Nuovo modello `SubscriptionRenewal`: una riga per rinnovo, `endDate` calcolata lato server e salvata; la scadenza attuale è `MAX(endDate)`. **Da fare al deploy:** applicare la migrazione `20261003000000_add_subscription_renewals`.
```

Later tasks append their files to the **File modificati** line and a sentence to **Note** when they add behaviour.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261003000000_add_subscription_renewals/migration.sql implementation-docs/CHANGELOG.md
git commit -m "feat(db): add subscription renewal model"
```

---

### Task 2: Pure domain logic — `src/lib/subscriptions.ts`

**Files:**
- Create: `src/lib/subscriptions.ts`
- Test: `tests/unit/lib/subscriptions.test.ts`

**Interfaces:**
- Produces (all exported from `@/lib/subscriptions`):
  - `EXPIRING_THRESHOLD_DAYS = 14`, `MIN_DURATION_MONTHS = 1`, `MAX_DURATION_MONTHS = 36`, `DURATION_SHORTCUTS = [1, 3, 6, 12] as const`
  - `type SubscriptionStatus = 'none' | 'active' | 'expiring' | 'expired'`
  - `interface SubscriptionSummary { status: 'active' | 'expiring' | 'expired'; endDate: string /* ISO */; daysLeft: number }`
  - `interface RenewalRow { id: string; traineeId: string; startDate: string; durationMonths: number; endDate: string; createdAt: string }`
  - `interface OverviewTrainee { id: string; firstName: string; lastName: string }`
  - `interface SubscriptionOverviewItem { traineeId: string; firstName: string; lastName: string; subscription: SubscriptionSummary | null }`
  - `interface SubscribedOverviewItem extends SubscriptionOverviewItem { subscription: SubscriptionSummary }`
  - `interface SubscriptionOverview { withSubscription: SubscribedOverviewItem[]; withoutSubscription: SubscriptionOverviewItem[]; counts: Record<SubscriptionStatus, number> }`
  - `toSubscriptionDay(value: Date): Date`
  - `addMonthsClamped(start: Date, months: number): Date`
  - `isValidDurationMonths(value: number): boolean`
  - `toSubscriptionSummary(endDate: Date | string | null, today: Date): SubscriptionSummary | null`
  - `needsAttention(summary: SubscriptionSummary | null): boolean`
  - `latestEndDate(rows: { endDate: Date }[]): Date | null`
  - `nextRenewalStart(currentEndDate: string | null, todayForInput: string): string` (YYYY-MM-DD)
  - `remainingLabel(daysLeft: number): { key: string; count: number }`
  - `buildSubscriptionOverview(trainees: OverviewTrainee[], endDates: Map<string, Date>, today: Date): SubscriptionOverview`

- [ ] **Step 1: Write the failing tests** `tests/unit/lib/subscriptions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
    EXPIRING_THRESHOLD_DAYS,
    addMonthsClamped,
    buildSubscriptionOverview,
    isValidDurationMonths,
    latestEndDate,
    needsAttention,
    nextRenewalStart,
    remainingLabel,
    toSubscriptionDay,
    toSubscriptionSummary,
} from '@/lib/subscriptions'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('toSubscriptionDay', () => {
    it('drops the time of day, keeping the UTC calendar day', () => {
        expect(toSubscriptionDay(new Date('2026-10-03T23:59:00.000Z'))).toEqual(day('2026-10-03'))
    })
})

describe('addMonthsClamped', () => {
    it('adds months on an ordinary day', () => {
        expect(addMonthsClamped(day('2026-11-01'), 3)).toEqual(day('2027-02-01'))
    })

    it('clamps to the last day of a shorter month', () => {
        expect(addMonthsClamped(day('2027-01-31'), 1)).toEqual(day('2027-02-28'))
    })

    it('clamps to 29 February in a leap year', () => {
        expect(addMonthsClamped(day('2028-01-31'), 1)).toEqual(day('2028-02-29'))
    })

    it('rolls over the year', () => {
        expect(addMonthsClamped(day('2026-12-15'), 12)).toEqual(day('2027-12-15'))
    })

    it('ignores the time of day of the start', () => {
        expect(addMonthsClamped(new Date('2026-10-03T22:30:00.000Z'), 1)).toEqual(day('2026-11-03'))
    })
})

describe('isValidDurationMonths', () => {
    it.each([
        [1, true],
        [36, true],
        [0, false],
        [37, false],
        [1.5, false],
        [Number.NaN, false],
    ])('%s → %s', (value, expected) => {
        expect(isValidDurationMonths(value)).toBe(expected)
    })
})

describe('toSubscriptionSummary', () => {
    const today = day('2026-10-03')

    it.each<[string, string, number]>([
        ['2026-10-18', 'active', 15],
        ['2026-10-17', 'expiring', EXPIRING_THRESHOLD_DAYS],
        ['2026-10-03', 'expiring', 0],
        ['2026-10-02', 'expired', -1],
    ])('end %s → %s with %i days left', (end, status, daysLeft) => {
        expect(toSubscriptionSummary(day(end), today)).toEqual({
            status,
            endDate: `${end}T00:00:00.000Z`,
            daysLeft,
        })
    })

    it('returns null without an end date', () => {
        expect(toSubscriptionSummary(null, today)).toBeNull()
    })

    it('accepts an ISO string end date', () => {
        expect(toSubscriptionSummary('2026-10-10T00:00:00.000Z', today)?.daysLeft).toBe(7)
    })
})

describe('needsAttention', () => {
    it('is true only for expiring and expired', () => {
        expect(needsAttention({ status: 'expiring', endDate: '', daysLeft: 3 })).toBe(true)
        expect(needsAttention({ status: 'expired', endDate: '', daysLeft: -3 })).toBe(true)
        expect(needsAttention({ status: 'active', endDate: '', daysLeft: 30 })).toBe(false)
        expect(needsAttention(null)).toBe(false)
    })
})

describe('latestEndDate', () => {
    it('returns the furthest end date, not the last row', () => {
        expect(
            latestEndDate([{ endDate: day('2026-12-01') }, { endDate: day('2027-03-01') }, { endDate: day('2026-06-01') }])
        ).toEqual(day('2027-03-01'))
    })

    it('returns null for no rows', () => {
        expect(latestEndDate([])).toBeNull()
    })
})

describe('nextRenewalStart', () => {
    it('proposes the day after the current expiry', () => {
        expect(nextRenewalStart('2026-10-31T00:00:00.000Z', '2026-10-03')).toBe('2026-11-01')
    })

    it('falls back to today without a subscription', () => {
        expect(nextRenewalStart(null, '2026-10-03')).toBe('2026-10-03')
    })
})

describe('remainingLabel', () => {
    it('counts days left', () => {
        expect(remainingLabel(9)).toEqual({ key: 'subscriptions.remaining.daysLeft', count: 9 })
    })

    it('says today on the last day', () => {
        expect(remainingLabel(0)).toEqual({ key: 'subscriptions.remaining.today', count: 0 })
    })

    it('counts days overdue as a positive number', () => {
        expect(remainingLabel(-4)).toEqual({ key: 'subscriptions.remaining.daysOverdue', count: 4 })
    })
})

describe('buildSubscriptionOverview', () => {
    const today = day('2026-10-03')
    const trainees = [
        { id: 'rossi', firstName: 'Anna', lastName: 'Rossi' },
        { id: 'bianchi', firstName: 'Luca', lastName: 'Bianchi' },
        { id: 'verdi', firstName: 'Sara', lastName: 'Verdi' },
        { id: 'neri', firstName: 'Paolo', lastName: 'Neri' },
        { id: 'ardito', firstName: 'Marco', lastName: 'Ardito' },
        { id: 'conti', firstName: 'Elena', lastName: 'Conti' },
    ]
    const endDates = new Map([
        ['rossi', day('2026-10-01')], // expired, -2
        ['bianchi', day('2026-12-01')], // active, 59
        ['verdi', day('2026-10-10')], // expiring, 7
        ['conti', day('2026-10-10')], // expiring, 7 — tie with Verdi, sorted by last name
    ])

    const overview = buildSubscriptionOverview(trainees, endDates, today)

    it('orders subscribed trainees by days left, overdue first, ties by last name', () => {
        expect(overview.withSubscription.map((item) => item.lastName)).toEqual(['Rossi', 'Conti', 'Verdi', 'Bianchi'])
    })

    it('lists trainees without a subscription by last name', () => {
        expect(overview.withoutSubscription.map((item) => item.lastName)).toEqual(['Ardito', 'Neri'])
        expect(overview.withoutSubscription[0].subscription).toBeNull()
    })

    it('counts each status', () => {
        expect(overview.counts).toEqual({ expired: 1, expiring: 2, active: 1, none: 2 })
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/lib/subscriptions.test.ts`
Expected: FAIL — "Failed to resolve import "@/lib/subscriptions"".

- [ ] **Step 3: Implement** `src/lib/subscriptions.ts`:

```ts
/**
 * Subscription renewals: pure domain logic and shared types. No Prisma, no React,
 * so the API routes, the Zod schema and the client components all share it.
 *
 * Every date is a UTC calendar day (midnight UTC), matching the @db.Date columns.
 * The end date is the last covered day: a subscription is expired when today > endDate.
 */

export const EXPIRING_THRESHOLD_DAYS = 14
export const MIN_DURATION_MONTHS = 1
export const MAX_DURATION_MONTHS = 36
export const DURATION_SHORTCUTS = [1, 3, 6, 12] as const

const DAY_MS = 24 * 60 * 60 * 1000

export type SubscriptionStatus = 'none' | 'active' | 'expiring' | 'expired'

export interface SubscriptionSummary {
    status: Exclude<SubscriptionStatus, 'none'>
    /** ISO string of the current expiry day */
    endDate: string
    /** Negative when expired */
    daysLeft: number
}

/** A renewal as the API returns it (dates serialized to ISO strings). */
export interface RenewalRow {
    id: string
    traineeId: string
    startDate: string
    durationMonths: number
    endDate: string
    createdAt: string
}

export interface OverviewTrainee {
    id: string
    firstName: string
    lastName: string
}

export interface SubscriptionOverviewItem {
    traineeId: string
    firstName: string
    lastName: string
    subscription: SubscriptionSummary | null
}

export interface SubscribedOverviewItem extends SubscriptionOverviewItem {
    subscription: SubscriptionSummary
}

export interface SubscriptionOverview {
    withSubscription: SubscribedOverviewItem[]
    withoutSubscription: SubscriptionOverviewItem[]
    counts: Record<SubscriptionStatus, number>
}

export function toSubscriptionDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

/** start + months, with the day clamped to the target month's last day (31 Jan + 1 → 28 Feb). */
export function addMonthsClamped(start: Date, months: number): Date {
    const day = toSubscriptionDay(start)
    const year = day.getUTCFullYear()
    const month = day.getUTCMonth() + months
    // Day 0 of the following month is the last day of the target month; Date.UTC handles year rollover
    const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    return new Date(Date.UTC(year, month, Math.min(day.getUTCDate(), lastDayOfTargetMonth)))
}

export function isValidDurationMonths(value: number): boolean {
    return Number.isInteger(value) && value >= MIN_DURATION_MONTHS && value <= MAX_DURATION_MONTHS
}

function daysBetween(from: Date, to: Date): number {
    return Math.round((toSubscriptionDay(to).getTime() - toSubscriptionDay(from).getTime()) / DAY_MS)
}

function statusFromDaysLeft(daysLeft: number): SubscriptionSummary['status'] {
    if (daysLeft < 0) return 'expired'
    if (daysLeft <= EXPIRING_THRESHOLD_DAYS) return 'expiring'
    return 'active'
}

/** null means "no subscription recorded". */
export function toSubscriptionSummary(endDate: Date | string | null, today: Date): SubscriptionSummary | null {
    if (!endDate) return null
    const end = toSubscriptionDay(new Date(endDate))
    const daysLeft = daysBetween(today, end)
    return { status: statusFromDaysLeft(daysLeft), endDate: end.toISOString(), daysLeft }
}

export function needsAttention(summary: SubscriptionSummary | null): boolean {
    return summary?.status === 'expiring' || summary?.status === 'expired'
}

/** Current expiry: the furthest end date, so a back-dated correction never shortens it. */
export function latestEndDate(rows: { endDate: Date }[]): Date | null {
    return rows.reduce<Date | null>(
        (latest, row) => (latest === null || row.endDate > latest ? row.endDate : latest),
        null
    )
}

/** Form pre-fill: the day after the current expiry, or today when there is none. */
export function nextRenewalStart(currentEndDate: string | null, todayForInput: string): string {
    if (!currentEndDate) return todayForInput
    const next = toSubscriptionDay(new Date(currentEndDate))
    next.setUTCDate(next.getUTCDate() + 1)
    return next.toISOString().slice(0, 10)
}

/** i18n key + count for "in X days" / "today" / "X days overdue". */
export function remainingLabel(daysLeft: number): { key: string; count: number } {
    if (daysLeft > 0) return { key: 'subscriptions.remaining.daysLeft', count: daysLeft }
    if (daysLeft === 0) return { key: 'subscriptions.remaining.today', count: 0 }
    return { key: 'subscriptions.remaining.daysOverdue', count: -daysLeft }
}

function compareByName(a: SubscriptionOverviewItem, b: SubscriptionOverviewItem): number {
    return a.lastName.localeCompare(b.lastName, 'it') || a.firstName.localeCompare(b.firstName, 'it')
}

function isSubscribed(item: SubscriptionOverviewItem): item is SubscribedOverviewItem {
    return item.subscription !== null
}

export function buildSubscriptionOverview(
    trainees: OverviewTrainee[],
    endDates: Map<string, Date>,
    today: Date
): SubscriptionOverview {
    const items: SubscriptionOverviewItem[] = trainees.map((trainee) => ({
        traineeId: trainee.id,
        firstName: trainee.firstName,
        lastName: trainee.lastName,
        subscription: toSubscriptionSummary(endDates.get(trainee.id) ?? null, today),
    }))

    const withSubscription = items
        .filter(isSubscribed)
        .sort((a, b) => a.subscription.daysLeft - b.subscription.daysLeft || compareByName(a, b))
    const withoutSubscription = items.filter((item) => !isSubscribed(item)).sort(compareByName)

    const counts: Record<SubscriptionStatus, number> = { expired: 0, expiring: 0, active: 0, none: withoutSubscription.length }
    for (const item of withSubscription) counts[item.subscription.status] += 1

    return { withSubscription, withoutSubscription, counts }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/lib/subscriptions.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Append files to the CHANGELOG entry, then commit**

```bash
git add src/lib/subscriptions.ts tests/unit/lib/subscriptions.test.ts implementation-docs/CHANGELOG.md
git commit -m "feat(lib): add subscription status and overview helpers"
```

---

### Task 3: Server queries — `src/lib/subscription-queries.ts`

**Files:**
- Create: `src/lib/subscription-queries.ts`
- Test: `tests/unit/lib/subscription-queries.test.ts`

**Interfaces:**
- Consumes: `buildSubscriptionOverview`, `SubscriptionOverview` from `@/lib/subscriptions`; Prisma model from Task 1.
- Produces:
  - `getCurrentEndDates(traineeIds: string[]): Promise<Map<string, Date>>`
  - `getTrainerSubscriptionOverview(trainerId: string, today: Date): Promise<SubscriptionOverview>`

- [ ] **Step 1: Write the failing tests** `tests/unit/lib/subscription-queries.test.ts` (the Prisma mock is installed globally by `tests/unit/setup.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { getCurrentEndDates, getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { prismaMock } from '../../helpers/prisma-mock'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('getCurrentEndDates', () => {
    it('returns an empty map without querying when there are no trainees', async () => {
        const result = await getCurrentEndDates([])

        expect(result.size).toBe(0)
        expect(prismaMock.subscriptionRenewal.groupBy).not.toHaveBeenCalled()
    })

    it('maps each trainee to its latest end date, skipping empty aggregates', async () => {
        prismaMock.subscriptionRenewal.groupBy.mockResolvedValue([
            { traineeId: 't1', _max: { endDate: day('2026-12-01') } },
            { traineeId: 't2', _max: { endDate: null } },
        ] as never)

        const result = await getCurrentEndDates(['t1', 't2'])

        expect(prismaMock.subscriptionRenewal.groupBy).toHaveBeenCalledWith({
            by: ['traineeId'],
            where: { traineeId: { in: ['t1', 't2'] } },
            _max: { endDate: true },
        })
        expect(result).toEqual(new Map([['t1', day('2026-12-01')]]))
    })
})

describe('getTrainerSubscriptionOverview', () => {
    it("builds the overview from the trainer's active trainees only", async () => {
        prismaMock.trainerTrainee.findMany.mockResolvedValue([
            { trainee: { id: 't1', firstName: 'Anna', lastName: 'Rossi' } },
            { trainee: { id: 't2', firstName: 'Luca', lastName: 'Bianchi' } },
        ] as never)
        prismaMock.subscriptionRenewal.groupBy.mockResolvedValue([
            { traineeId: 't1', _max: { endDate: day('2026-10-10') } },
        ] as never)

        const overview = await getTrainerSubscriptionOverview('trainer-1', day('2026-10-03'))

        expect(prismaMock.trainerTrainee.findMany).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', trainee: { isActive: true } },
            select: { trainee: { select: { id: true, firstName: true, lastName: true } } },
        })
        expect(overview.withSubscription.map((item) => item.traineeId)).toEqual(['t1'])
        expect(overview.withoutSubscription.map((item) => item.traineeId)).toEqual(['t2'])
        expect(overview.counts.expiring).toBe(1)
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/lib/subscription-queries.test.ts`
Expected: FAIL — cannot resolve `@/lib/subscription-queries`.

- [ ] **Step 3: Implement** `src/lib/subscription-queries.ts`:

```ts
import { prisma } from '@/lib/prisma'
import { buildSubscriptionOverview, type SubscriptionOverview } from '@/lib/subscriptions'

/**
 * Server-only subscription queries. Kept apart from src/lib/subscriptions.ts so
 * client components can import the pure helpers without pulling in Prisma.
 */

/** Current expiry (MAX endDate) per trainee, in one aggregate query. */
export async function getCurrentEndDates(traineeIds: string[]): Promise<Map<string, Date>> {
    if (traineeIds.length === 0) return new Map()

    const rows = await prisma.subscriptionRenewal.groupBy({
        by: ['traineeId'],
        where: { traineeId: { in: traineeIds } },
        _max: { endDate: true },
    })

    const endDates = new Map<string, Date>()
    for (const row of rows) {
        if (row._max.endDate) endDates.set(row.traineeId, row._max.endDate)
    }
    return endDates
}

/** Subscriptions page and home KPI: the logged-in trainer's active trainees only. */
export async function getTrainerSubscriptionOverview(trainerId: string, today: Date): Promise<SubscriptionOverview> {
    const links = await prisma.trainerTrainee.findMany({
        where: { trainerId, trainee: { isActive: true } },
        select: { trainee: { select: { id: true, firstName: true, lastName: true } } },
    })
    const trainees = links.map((link) => link.trainee)
    const endDates = await getCurrentEndDates(trainees.map((trainee) => trainee.id))
    return buildSubscriptionOverview(trainees, endDates, today)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/lib/subscription-queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Append files to the CHANGELOG entry, then commit**

```bash
git add src/lib/subscription-queries.ts tests/unit/lib/subscription-queries.test.ts implementation-docs/CHANGELOG.md
git commit -m "feat(lib): query current subscription end dates per trainer"
```

---

### Task 4: Zod schema — `src/schemas/subscription-renewal.ts`

**Files:**
- Create: `src/schemas/subscription-renewal.ts`
- Test: `tests/unit/schemas/subscription-renewal.test.ts`
- Modify: `public/locales/it/validation.json`, `public/locales/en/validation.json`

**Interfaces:**
- Consumes: `toSubscriptionDay`, `MIN_DURATION_MONTHS`, `MAX_DURATION_MONTHS` from `@/lib/subscriptions`.
- Produces: `createRenewalSchema` (output `{ traineeId: string; startDate: Date; durationMonths: number }`), `updateRenewalSchema` (output `{ startDate: Date; durationMonths: number }`), types `CreateRenewalInput`, `UpdateRenewalInput`. Unknown keys (e.g. `endDate`) are stripped.

- [ ] **Step 1: Write the failing tests** `tests/unit/schemas/subscription-renewal.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createRenewalSchema, updateRenewalSchema } from '@/schemas/subscription-renewal'

const TRAINEE_ID = '11111111-1111-1111-1111-111111111111'
const valid = { traineeId: TRAINEE_ID, startDate: '2026-11-01', durationMonths: 3 }

function messages(result: { success: boolean; error?: { errors: { message: string }[] } }) {
    return result.success ? [] : result.error!.errors.map((issue) => issue.message)
}

describe('createRenewalSchema', () => {
    it('normalises the start date to a UTC day', () => {
        const result = createRenewalSchema.parse({ ...valid, startDate: '2026-11-01T18:45:00.000Z' })

        expect(result.startDate).toEqual(new Date('2026-11-01T00:00:00.000Z'))
    })

    it('strips a client-supplied endDate', () => {
        const result = createRenewalSchema.parse({ ...valid, endDate: '2030-01-01' })

        expect(result).not.toHaveProperty('endDate')
    })

    it.each([0, 37, 1.5])('rejects duration %s', (durationMonths) => {
        const result = createRenewalSchema.safeParse({ ...valid, durationMonths })

        expect(messages(result)).toContain('validation.durationMonthsRange')
    })

    it('rejects an unparseable start date without throwing', () => {
        const result = createRenewalSchema.safeParse({ ...valid, startDate: 'not-a-date' })

        expect(messages(result)).toContain('validation.invalidDate')
    })

    it('rejects a non-uuid trainee id', () => {
        const result = createRenewalSchema.safeParse({ ...valid, traineeId: 'abc' })

        expect(messages(result)).toContain('validation.invalidTraineeId')
    })
})

describe('updateRenewalSchema', () => {
    it('accepts start date and duration without trainee id', () => {
        expect(updateRenewalSchema.safeParse({ startDate: '2026-11-01', durationMonths: 12 }).success).toBe(true)
    })

    it('requires the duration', () => {
        expect(updateRenewalSchema.safeParse({ startDate: '2026-11-01' }).success).toBe(false)
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/schemas/subscription-renewal.test.ts`
Expected: FAIL — cannot resolve `@/schemas/subscription-renewal`.

- [ ] **Step 3: Implement** `src/schemas/subscription-renewal.ts`:

```ts
import { z } from 'zod'
import { MAX_DURATION_MONTHS, MIN_DURATION_MONTHS, toSubscriptionDay } from '@/lib/subscriptions'

/**
 * Subscription Renewal Validation Schemas
 *
 * endDate is never accepted from the client: the route computes it. Zod strips
 * unknown keys, so a client endDate is silently dropped.
 * Messages are i18n keys (project convention), resolved client-side.
 */

const startDateSchema = z.union([z.string(), z.date()]).transform((val, ctx) => {
    const date = typeof val === 'string' ? new Date(val) : val
    if (isNaN(date.getTime())) {
        // An issue, not a throw: a throw escapes safeParse and surfaces as a 500
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.invalidDate' })
        return z.NEVER
    }
    return toSubscriptionDay(date)
})

const durationMonthsSchema = z
    .number()
    .int('validation.durationMonthsRange')
    .min(MIN_DURATION_MONTHS, 'validation.durationMonthsRange')
    .max(MAX_DURATION_MONTHS, 'validation.durationMonthsRange')

export const updateRenewalSchema = z.object({
    startDate: startDateSchema,
    durationMonths: durationMonthsSchema,
})

export const createRenewalSchema = updateRenewalSchema.extend({
    traineeId: z.string().uuid('validation.invalidTraineeId'),
})

export type CreateRenewalInput = z.infer<typeof createRenewalSchema>
export type UpdateRenewalInput = z.infer<typeof updateRenewalSchema>
```

- [ ] **Step 4: Add the validation copy**

In `public/locales/it/validation.json`, inside `"validation"`, after `"valuePositive"`, add:
```json
        "durationMonthsRange": "La durata deve essere un numero intero di mesi tra 1 e 36",
```
In `public/locales/en/validation.json`, same position:
```json
        "durationMonthsRange": "Duration must be a whole number of months between 1 and 36",
```
(Fix the trailing comma of the preceding/last entry so the JSON stays valid.)

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/unit/schemas/subscription-renewal.test.ts && node -e "JSON.parse(require('fs').readFileSync('public/locales/it/validation.json','utf8').replace(/^﻿/,''));JSON.parse(require('fs').readFileSync('public/locales/en/validation.json','utf8').replace(/^﻿/,''))"`
Expected: PASS and no JSON error.

- [ ] **Step 6: Append files to the CHANGELOG entry, then commit**

```bash
git add src/schemas/subscription-renewal.ts tests/unit/schemas/subscription-renewal.test.ts public/locales/it/validation.json public/locales/en/validation.json implementation-docs/CHANGELOG.md
git commit -m "feat(schemas): validate subscription renewal input"
```

---

### Task 5: Renewal API routes

**Files:**
- Create: `src/app/api/subscription-renewals/_access.ts`
- Create: `src/app/api/subscription-renewals/route.ts`
- Create: `src/app/api/subscription-renewals/[id]/route.ts`
- Modify: `public/locales/it/errors.json`, `public/locales/en/errors.json`
- Test: `tests/integration/subscription-renewals.test.ts`

**Interfaces:**
- Consumes: `createRenewalSchema`, `updateRenewalSchema` (Task 4); `addMonthsClamped`, `latestEndDate`, `toSubscriptionSummary` (Task 2); `getTodayDateKey` from `@/lib/date-format`.
- Produces (JSON shapes the UI relies on):
  - `GET /api/subscription-renewals?traineeId=` → `{ data: { items: RenewalRow[], current: SubscriptionSummary | null } }`, items ordered `startDate desc, createdAt desc`
  - `POST /api/subscription-renewals` body `{ traineeId, startDate, durationMonths }` → 201 `{ data: { renewal } }`
  - `PATCH /api/subscription-renewals/[id]` body `{ startDate, durationMonths }` → `{ data: { renewal } }`
  - `DELETE /api/subscription-renewals/[id]` → `{ data: { success: true } }`

- [ ] **Step 1: Write the failing tests** `tests/integration/subscription-renewals.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { GET, POST } from '@/app/api/subscription-renewals/route'
import { PATCH, DELETE } from '@/app/api/subscription-renewals/[id]/route'
import { requireTrainerOwnership } from '@/lib/auth'
import { apiError } from '@/lib/api-response'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asTrainee, asUnauthenticated } from '../helpers/auth-mock'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const TRAINEE_ID = '11111111-1111-1111-1111-111111111111'
const RENEWAL_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const mockRenewal = {
    id: RENEWAL_ID,
    traineeId: TRAINEE_ID,
    startDate: day('2026-09-10'),
    durationMonths: 1,
    endDate: day('2026-10-10'),
    createdBy: 'trainer-uuid-1',
    createdAt: new Date('2026-09-10T10:00:00.000Z'),
}

const BASE = 'http://localhost:3000/api/subscription-renewals'

function makeRequest(url: string, options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as never)
}

const jsonRequest = (url: string, method: string, body: unknown) =>
    makeRequest(url, { method, body: JSON.stringify(body) })

const params = (id = RENEWAL_ID) => ({ params: Promise.resolve({ id }) })

/** Trainer authenticated, but the trainee belongs to someone else. */
function asForeignTrainer() {
    asTrainer()
    vi.mocked(requireTrainerOwnership).mockRejectedValue(
        apiError('FORBIDDEN', 'You do not have access to this trainee', 403, undefined, 'auth.traineeAccessDenied')
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T10:00:00.000Z'))
})

afterEach(() => {
    vi.useRealTimers()
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/subscription-renewals
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/subscription-renewals', () => {
    it('returns the history and the current status for the owning trainer', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findMany.mockResolvedValue([mockRenewal] as never)

        const res = await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(body.data.current).toEqual({ status: 'expiring', endDate: '2026-10-10T00:00:00.000Z', daysLeft: 7 })
        expect(prismaMock.subscriptionRenewal.findMany).toHaveBeenCalledWith({
            where: { traineeId: TRAINEE_ID },
            orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        })
        expect(requireTrainerOwnership).toHaveBeenCalledWith(TRAINEE_ID)
    })

    it('returns current null when there are no renewals', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findMany.mockResolvedValue([] as never)

        const body = await (await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))).json()

        expect(body.data.current).toBeNull()
    })

    it('uses the furthest end date across overlapping renewals', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findMany.mockResolvedValue([
            { ...mockRenewal, id: 'r-2', startDate: day('2026-09-20'), endDate: day('2026-09-30') },
            mockRenewal,
        ] as never)

        const body = await (await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))).json()

        expect(body.data.current.endDate).toBe('2026-10-10T00:00:00.000Z')
    })

    it('rejects a missing traineeId with 400', async () => {
        asTrainer()

        const res = await GET(makeRequest(BASE))

        expect(res.status).toBe(400)
    })

    it('forbids the trainee role and never reads data', async () => {
        asTrainee()

        const res = await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))

        expect(res.status).toBe(403)
        expect(prismaMock.subscriptionRenewal.findMany).not.toHaveBeenCalled()
    })

    it('forbids a trainer who does not own the trainee', async () => {
        asForeignTrainer()

        const res = await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))

        expect(res.status).toBe(403)
    })

    it('lets an admin read without the ownership check', async () => {
        asAdmin()
        prismaMock.subscriptionRenewal.findMany.mockResolvedValue([] as never)

        const res = await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))

        expect(res.status).toBe(200)
        expect(requireTrainerOwnership).not.toHaveBeenCalled()
    })

    it('returns 401 when unauthenticated', async () => {
        asUnauthenticated()

        const res = await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))

        expect(res.status).toBe(401)
    })

    it('returns 500 when the query fails', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findMany.mockRejectedValue(new Error('db down'))

        const res = await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))

        expect(res.status).toBe(500)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/subscription-renewals
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/subscription-renewals', () => {
    const validBody = { traineeId: TRAINEE_ID, startDate: '2027-01-31', durationMonths: 1 }

    function traineeExists(role = 'trainee') {
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role } as never)
    }

    it('creates a renewal with a server-computed, month-end-clamped end date', async () => {
        asTrainer()
        traineeExists()
        prismaMock.subscriptionRenewal.create.mockResolvedValue(mockRenewal as never)

        const res = await POST(jsonRequest(BASE, 'POST', { ...validBody, endDate: '2099-01-01' }))

        expect(res.status).toBe(201)
        expect(prismaMock.subscriptionRenewal.create).toHaveBeenCalledWith({
            data: {
                traineeId: TRAINEE_ID,
                startDate: day('2027-01-31'),
                durationMonths: 1,
                endDate: day('2027-02-28'),
                createdBy: 'trainer-uuid-1',
            },
        })
    })

    it.each([0, 37, 1.5])('rejects duration %s with 400', async (durationMonths) => {
        asTrainer()

        const res = await POST(jsonRequest(BASE, 'POST', { ...validBody, durationMonths }))

        expect(res.status).toBe(400)
        expect(prismaMock.subscriptionRenewal.create).not.toHaveBeenCalled()
    })

    it('rejects an unparseable start date with 400', async () => {
        asTrainer()

        const res = await POST(jsonRequest(BASE, 'POST', { ...validBody, startDate: 'nope' }))

        expect(res.status).toBe(400)
    })

    it('forbids the trainee role', async () => {
        asTrainee()

        const res = await POST(jsonRequest(BASE, 'POST', validBody))

        expect(res.status).toBe(403)
        expect(prismaMock.subscriptionRenewal.create).not.toHaveBeenCalled()
    })

    it('forbids a trainer who does not own the trainee', async () => {
        asForeignTrainer()

        const res = await POST(jsonRequest(BASE, 'POST', validBody))

        expect(res.status).toBe(403)
    })

    it('returns 404 for an unknown trainee', async () => {
        asAdmin()
        prismaMock.user.findUnique.mockResolvedValue(null)

        const res = await POST(jsonRequest(BASE, 'POST', validBody))

        expect(res.status).toBe(404)
    })

    it('rejects a user who is not a trainee with 400', async () => {
        asAdmin()
        traineeExists('trainer')

        const res = await POST(jsonRequest(BASE, 'POST', validBody))

        expect(res.status).toBe(400)
    })

    it('returns 500 when the insert fails', async () => {
        asTrainer()
        traineeExists()
        prismaMock.subscriptionRenewal.create.mockRejectedValue(new Error('db down'))

        const res = await POST(jsonRequest(BASE, 'POST', validBody))

        expect(res.status).toBe(500)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/subscription-renewals/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /api/subscription-renewals/[id]', () => {
    const body = { startDate: '2026-11-01', durationMonths: 3 }

    it('recomputes the end date', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockRenewal as never)
        prismaMock.subscriptionRenewal.update.mockResolvedValue(mockRenewal as never)

        const res = await PATCH(jsonRequest(`${BASE}/${RENEWAL_ID}`, 'PATCH', body), params())

        expect(res.status).toBe(200)
        expect(prismaMock.subscriptionRenewal.update).toHaveBeenCalledWith({
            where: { id: RENEWAL_ID },
            data: { startDate: day('2026-11-01'), durationMonths: 3, endDate: day('2027-02-01') },
        })
        expect(requireTrainerOwnership).toHaveBeenCalledWith(TRAINEE_ID)
    })

    it('returns 404 for an unknown renewal', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(null)

        const res = await PATCH(jsonRequest(`${BASE}/${RENEWAL_ID}`, 'PATCH', body), params())

        expect(res.status).toBe(404)
    })

    it('rejects invalid input with 400', async () => {
        asTrainer()

        const res = await PATCH(jsonRequest(`${BASE}/${RENEWAL_ID}`, 'PATCH', { ...body, durationMonths: 0 }), params())

        expect(res.status).toBe(400)
    })

    it('forbids the trainee role', async () => {
        asTrainee()

        const res = await PATCH(jsonRequest(`${BASE}/${RENEWAL_ID}`, 'PATCH', body), params())

        expect(res.status).toBe(403)
        expect(prismaMock.subscriptionRenewal.update).not.toHaveBeenCalled()
    })

    it("forbids a trainer who does not own the renewal's trainee", async () => {
        asForeignTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockRenewal as never)

        const res = await PATCH(jsonRequest(`${BASE}/${RENEWAL_ID}`, 'PATCH', body), params())

        expect(res.status).toBe(403)
        expect(prismaMock.subscriptionRenewal.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update fails', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockRenewal as never)
        prismaMock.subscriptionRenewal.update.mockRejectedValue(new Error('db down'))

        const res = await PATCH(jsonRequest(`${BASE}/${RENEWAL_ID}`, 'PATCH', body), params())

        expect(res.status).toBe(500)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/subscription-renewals/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /api/subscription-renewals/[id]', () => {
    it('deletes the renewal', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockRenewal as never)
        prismaMock.subscriptionRenewal.delete.mockResolvedValue(mockRenewal as never)

        const res = await DELETE(makeRequest(`${BASE}/${RENEWAL_ID}`, { method: 'DELETE' }), params())

        expect(res.status).toBe(200)
        expect(prismaMock.subscriptionRenewal.delete).toHaveBeenCalledWith({ where: { id: RENEWAL_ID } })
    })

    it('returns 404 for an unknown renewal', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(null)

        const res = await DELETE(makeRequest(`${BASE}/${RENEWAL_ID}`, { method: 'DELETE' }), params())

        expect(res.status).toBe(404)
    })

    it('forbids the trainee role', async () => {
        asTrainee()

        const res = await DELETE(makeRequest(`${BASE}/${RENEWAL_ID}`, { method: 'DELETE' }), params())

        expect(res.status).toBe(403)
        expect(prismaMock.subscriptionRenewal.delete).not.toHaveBeenCalled()
    })

    it("forbids a trainer who does not own the renewal's trainee", async () => {
        asForeignTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockRenewal as never)

        const res = await DELETE(makeRequest(`${BASE}/${RENEWAL_ID}`, { method: 'DELETE' }), params())

        expect(res.status).toBe(403)
        expect(prismaMock.subscriptionRenewal.delete).not.toHaveBeenCalled()
    })

    it('returns 500 when the delete fails', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockRenewal as never)
        prismaMock.subscriptionRenewal.delete.mockRejectedValue(new Error('db down'))

        const res = await DELETE(makeRequest(`${BASE}/${RENEWAL_ID}`, { method: 'DELETE' }), params())

        expect(res.status).toBe(500)
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/integration/subscription-renewals.test.ts`
Expected: FAIL — cannot resolve `@/app/api/subscription-renewals/route`.

- [ ] **Step 3: Implement the guard** `src/app/api/subscription-renewals/_access.ts`:

```ts
import { apiError } from '@/lib/api-response'
import { requireTrainerOwnership, type AuthSession } from '@/lib/auth'

/**
 * Subscription renewals are trainer-only data: the trainee has no read or write
 * access, on any method. Single enforcement point for both renewal routes —
 * the UI never relies on hiding alone.
 */
export function denyTrainee(session: AuthSession): Response | null {
    if (session.user.role === 'trainee') {
        return apiError('FORBIDDEN', 'Subscriptions are not visible to trainees', 403, undefined, 'auth.traineeAccessDenied')
    }
    return null
}

export async function guardRenewalAccess(session: AuthSession, traineeId: string): Promise<Response | null> {
    const denied = denyTrainee(session)
    if (denied) return denied

    if (session.user.role === 'trainer') {
        await requireTrainerOwnership(traineeId)
    }

    return null
}
```

- [ ] **Step 4: Implement the collection route** `src/app/api/subscription-renewals/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { createRenewalSchema } from '@/schemas/subscription-renewal'
import { addMonthsClamped, latestEndDate, toSubscriptionSummary } from '@/lib/subscriptions'
import { getTodayDateKey } from '@/lib/date-format'
import { logger } from '@/lib/logger'
import { guardRenewalAccess } from './_access'

/**
 * GET /api/subscription-renewals?traineeId=
 * History (newest first) plus the current status derived from MAX(endDate).
 * RBAC: owning trainer or admin. Trainees: 403.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])
        const traineeId = new URL(request.url).searchParams.get('traineeId')
        if (!traineeId) {
            return apiError('VALIDATION_ERROR', 'traineeId is required', 400, undefined, 'validation.traineeIdRequired')
        }

        const denied = await guardRenewalAccess(session, traineeId)
        if (denied) return denied

        const items = await prisma.subscriptionRenewal.findMany({
            where: { traineeId },
            orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        })

        const current = toSubscriptionSummary(latestEndDate(items), getTodayDateKey())

        return apiSuccess({ items, current })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching subscription renewals')
        return apiError('INTERNAL_ERROR', 'Failed to fetch subscription renewals', 500, undefined, 'internal.default')
    }
}

/**
 * POST /api/subscription-renewals
 * Body: { traineeId, startDate, durationMonths }. endDate is computed here, never accepted.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])
        const body = await request.json()

        const validation = createRenewalSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { traineeId, startDate, durationMonths } = validation.data

        const denied = await guardRenewalAccess(session, traineeId)
        if (denied) return denied

        const trainee = await prisma.user.findUnique({ where: { id: traineeId } })
        if (!trainee) {
            return apiError('NOT_FOUND', 'Trainee not found', 404, undefined, 'trainee.notFound')
        }
        if (trainee.role !== 'trainee') {
            return apiError('VALIDATION_ERROR', 'User must have trainee role', 400, undefined, 'validation.userMustBeTrainee')
        }

        const renewal = await prisma.subscriptionRenewal.create({
            data: {
                traineeId,
                startDate,
                durationMonths,
                endDate: addMonthsClamped(startDate, durationMonths),
                createdBy: session.user.id,
            },
        })

        logger.info({ traineeId, renewalId: renewal.id, userId: session.user.id }, 'Subscription renewal created')

        return apiSuccess({ renewal }, 201)
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error creating subscription renewal')
        return apiError('INTERNAL_ERROR', 'Failed to create subscription renewal', 500, undefined, 'internal.default')
    }
}
```

- [ ] **Step 5: Implement the item route** `src/app/api/subscription-renewals/[id]/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { updateRenewalSchema } from '@/schemas/subscription-renewal'
import { addMonthsClamped } from '@/lib/subscriptions'
import { logger } from '@/lib/logger'
import { denyTrainee, guardRenewalAccess } from '../_access'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/subscription-renewals/[id]
 * Body: { startDate, durationMonths }. endDate is recomputed.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const traineeDenied = denyTrainee(session)
        if (traineeDenied) return traineeDenied

        const body = await request.json()
        const validation = updateRenewalSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const renewal = await prisma.subscriptionRenewal.findUnique({ where: { id } })
        if (!renewal) {
            return apiError('NOT_FOUND', 'Subscription renewal not found', 404, undefined, 'subscription.notFound')
        }

        const denied = await guardRenewalAccess(session, renewal.traineeId)
        if (denied) return denied

        const { startDate, durationMonths } = validation.data
        const updated = await prisma.subscriptionRenewal.update({
            where: { id },
            data: { startDate, durationMonths, endDate: addMonthsClamped(startDate, durationMonths) },
        })

        logger.info({ renewalId: id, traineeId: renewal.traineeId, userId: session.user.id }, 'Subscription renewal updated')

        return apiSuccess({ renewal: updated })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error, renewalId: id }, 'Error updating subscription renewal')
        return apiError('INTERNAL_ERROR', 'Failed to update subscription renewal', 500, undefined, 'internal.default')
    }
}

/**
 * DELETE /api/subscription-renewals/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const traineeDenied = denyTrainee(session)
        if (traineeDenied) return traineeDenied

        const renewal = await prisma.subscriptionRenewal.findUnique({ where: { id } })
        if (!renewal) {
            return apiError('NOT_FOUND', 'Subscription renewal not found', 404, undefined, 'subscription.notFound')
        }

        const denied = await guardRenewalAccess(session, renewal.traineeId)
        if (denied) return denied

        await prisma.subscriptionRenewal.delete({ where: { id } })

        logger.info({ renewalId: id, traineeId: renewal.traineeId, userId: session.user.id }, 'Subscription renewal deleted')

        return apiSuccess({ success: true })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error, renewalId: id }, 'Error deleting subscription renewal')
        return apiError('INTERNAL_ERROR', 'Failed to delete subscription renewal', 500, undefined, 'internal.default')
    }
}
```

- [ ] **Step 6: Add the error copy**

`public/locales/it/errors.json`: after the `"measurement": { ... }` block add
```json
    "subscription": {
        "notFound": "Rinnovo non trovato"
    },
```
`public/locales/en/errors.json`: same position
```json
    "subscription": {
        "notFound": "Renewal not found"
    },
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run tests/integration/subscription-renewals.test.ts`
Expected: PASS.

- [ ] **Step 8: Append files to the CHANGELOG entry (note: "API `GET`/`POST /api/subscription-renewals` e `PATCH`/`DELETE /api/subscription-renewals/[id]`; 403 per il ruolo trainee su ogni metodo, `requireTrainerOwnership` per il trainer, admin completo; `endDate` calcolata lato server"), then commit**

```bash
git add src/app/api/subscription-renewals tests/integration/subscription-renewals.test.ts public/locales/it/errors.json public/locales/en/errors.json implementation-docs/CHANGELOG.md
git commit -m "feat(api): list, create, update and delete subscription renewals"
```

---

### Task 6: Subscription status in `GET /api/users` (trainer listing)

**Files:**
- Modify: `src/app/api/users/route.ts` (interface `ListedUser` ~line 10; trainer branch ~lines 67-90)
- Test: `tests/integration/users.test.ts` (and any other integration test that calls `GET /api/users` as trainer, e.g. `tests/integration/api-contracts.test.ts`)

**Interfaces:**
- Consumes: `getCurrentEndDates` (Task 3), `toSubscriptionSummary`, `SubscriptionSummary` (Task 2), `getTodayDateKey`.
- Produces: in the trainer branch, every listed user has `subscription: SubscriptionSummary | null`. Admin branch unchanged (no `subscription` key).

- [ ] **Step 1: Write the failing test** — in `tests/integration/users.test.ts`, inside `describe('GET /api/users', ...)`, add:

```ts
    it('adds the current subscription to each trainee for a trainer', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2026-10-03T10:00:00.000Z'))
        asTrainer()
        prismaMock.trainerTrainee.findMany.mockResolvedValue([
            { trainee: { id: 't1', email: 'a@x.it', firstName: 'Anna', lastName: 'Rossi', role: 'trainee', isActive: true, createdAt: new Date('2026-01-01') } },
            { trainee: { id: 't2', email: 'b@x.it', firstName: 'Luca', lastName: 'Bianchi', role: 'trainee', isActive: true, createdAt: new Date('2026-01-02') } },
        ] as never)
        prismaMock.subscriptionRenewal.groupBy.mockResolvedValue([
            { traineeId: 't1', _max: { endDate: new Date('2026-10-10T00:00:00.000Z') } },
        ] as never)

        const res = await GET(makeRequest('http://localhost:3000/api/users'))
        const body = await res.json()
        vi.useRealTimers()

        const byId = Object.fromEntries(body.data.items.map((user: { id: string }) => [user.id, user]))
        expect(byId.t1.subscription).toEqual({ status: 'expiring', endDate: '2026-10-10T00:00:00.000Z', daysLeft: 7 })
        expect(byId.t2.subscription).toBeNull()
        expect(prismaMock.subscriptionRenewal.groupBy).toHaveBeenCalledTimes(1)
    })
```

(Use the file's existing request helper; if it is named differently than `makeRequest`, use that name.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/integration/users.test.ts`
Expected: the new test FAILS (`subscription` undefined).

- [ ] **Step 3: Implement** in `src/app/api/users/route.ts`:

Imports:
```ts
import { getCurrentEndDates } from '@/lib/subscription-queries'
import { toSubscriptionSummary, type SubscriptionSummary } from '@/lib/subscriptions'
import { getTodayDateKey } from '@/lib/date-format'
```

`ListedUser` gains:
```ts
    /** Trainer listing only: current subscription, null when none recorded */
    subscription?: SubscriptionSummary | null
```

In the trainer branch, replace the `users = traineeAssociations ...` assignment with:
```ts
                const trainees = traineeAssociations
                    .map((assoc) => assoc.trainee)
                    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())

                // One aggregate query for every trainee (no N+1)
                const endDates = await getCurrentEndDates(trainees.map((trainee) => trainee.id))
                const today = getTodayDateKey()
                users = trainees.map((trainee) => ({
                    ...trainee,
                    subscription: toSubscriptionSummary(endDates.get(trainee.id) ?? null, today),
                }))
```

- [ ] **Step 4: Run the whole integration suite**

Run: `npx vitest run tests/integration`
Expected: the new test passes. Any existing test that lists users as a trainer with ≥ 1 trainee now fails with 500 because the deep mock's `groupBy` resolves `undefined`. For each such `describe`, add to its `beforeEach`:
```ts
        prismaMock.subscriptionRenewal.groupBy.mockResolvedValue([] as never)
```
Re-run until the suite is fully green.

- [ ] **Step 5: Append files to the CHANGELOG entry, then commit**

```bash
git add src/app/api/users/route.ts tests/integration implementation-docs/CHANGELOG.md
git commit -m "feat(api): expose trainee subscription status in trainer user list"
```

---

### Task 7: Copy and `SubscriptionStatusBadge`

**Files:**
- Modify: `public/locales/it/trainer.json`, `public/locales/en/trainer.json` (new top-level `"subscriptions"` block after `"measurements"`)
- Create: `src/components/SubscriptionStatusBadge.tsx`
- Modify: `src/components/index.ts`
- Test: `tests/unit/subscription-status-badge.test.tsx`

**Interfaces:**
- Consumes: `SubscriptionSummary` (Task 2), `formatDate`.
- Produces: `SubscriptionStatusBadge({ summary: SubscriptionSummary | null, compact?: boolean })` — renders `<span data-status={status}>`; with `compact`, renders nothing for `active` / `null`. All `subscriptions.*` i18n keys used by Tasks 8-11.

- [ ] **Step 1: Add the Italian copy** — in `public/locales/it/trainer.json`, after the closing `},` of `"measurements"`, insert (Edit tool; keep the BOM):

```json
    "subscriptions": {
        "tab": "Abbonamento",
        "title": "Abbonamento",
        "subtitle": "Rinnovi visibili solo a te, non all'atleta",
        "addButton": "Registra rinnovo",
        "createTitle": "Registra rinnovo",
        "editTitle": "Modifica rinnovo",
        "startDate": "Data inizio",
        "duration": "Durata (mesi)",
        "durationShortcut": "{{count}} m",
        "previewLabel": "Scadrà il",
        "currentTitle": "Stato attuale",
        "historyTitle": "Storico rinnovi",
        "startColumn": "Inizio",
        "durationColumn": "Durata",
        "endColumn": "Fine",
        "createdColumn": "Inserito il",
        "actionsColumn": "Azioni",
        "durationValue_one": "{{count}} mese",
        "durationValue_other": "{{count}} mesi",
        "empty": "Nessun rinnovo registrato per questo atleta",
        "editAction": "Modifica rinnovo",
        "deleteAction": "Elimina rinnovo",
        "deleteTitle": "Elimina rinnovo",
        "deleteMessage": "Eliminare il rinnovo dal {{start}} al {{end}}?",
        "loadError": "Impossibile caricare gli abbonamenti",
        "saveError": "Impossibile salvare il rinnovo",
        "retry": "Riprova",
        "badge": {
            "active": "Attivo fino al {{date}}",
            "expiring": "Scade il {{date}} ({{days}} gg)",
            "expired": "Scaduto il {{date}}",
            "none": "Nessun abbonamento"
        },
        "remaining": {
            "daysLeft_one": "tra {{count}} giorno",
            "daysLeft_other": "tra {{count}} giorni",
            "today": "scade oggi",
            "daysOverdue_one": "scaduto da {{count}} giorno",
            "daysOverdue_other": "scaduto da {{count}} giorni"
        },
        "banner": {
            "expiring": "L'abbonamento scade il {{date}} ({{remaining}})",
            "expired": "Abbonamento scaduto il {{date}}",
            "manage": "Gestisci"
        },
        "page": {
            "title": "Abbonamenti",
            "description": "Scadenze dei tuoi atleti, dalla più vicina",
            "counters": {
                "expired": "Scaduti",
                "expiring": "In scadenza (≤ 14 gg)",
                "active": "Attivi",
                "none": "Senza abbonamento"
            },
            "listTitle": "Abbonamenti registrati",
            "noneTitle": "Senza abbonamento",
            "noneEmpty": "Tutti i tuoi atleti attivi hanno un abbonamento",
            "listEmpty": "Nessun abbonamento registrato",
            "empty": "Non hai atleti attivi",
            "athleteColumn": "Atleta",
            "statusColumn": "Stato",
            "endColumn": "Scadenza",
            "remainingColumn": "Tempo rimanente",
            "manage": "Gestisci"
        }
    },
```

- [ ] **Step 2: Add the English copy** — same position in `public/locales/en/trainer.json`:

```json
    "subscriptions": {
        "tab": "Subscription",
        "title": "Subscription",
        "subtitle": "Renewals visible only to you, not to the athlete",
        "addButton": "Record renewal",
        "createTitle": "Record renewal",
        "editTitle": "Edit renewal",
        "startDate": "Start date",
        "duration": "Duration (months)",
        "durationShortcut": "{{count}} mo",
        "previewLabel": "Expires on",
        "currentTitle": "Current status",
        "historyTitle": "Renewal history",
        "startColumn": "Start",
        "durationColumn": "Duration",
        "endColumn": "End",
        "createdColumn": "Recorded on",
        "actionsColumn": "Actions",
        "durationValue_one": "{{count}} month",
        "durationValue_other": "{{count}} months",
        "empty": "No renewals recorded for this athlete",
        "editAction": "Edit renewal",
        "deleteAction": "Delete renewal",
        "deleteTitle": "Delete renewal",
        "deleteMessage": "Delete the renewal from {{start}} to {{end}}?",
        "loadError": "Unable to load subscriptions",
        "saveError": "Unable to save the renewal",
        "retry": "Retry",
        "badge": {
            "active": "Active until {{date}}",
            "expiring": "Expires on {{date}} ({{days}} d)",
            "expired": "Expired on {{date}}",
            "none": "No subscription"
        },
        "remaining": {
            "daysLeft_one": "in {{count}} day",
            "daysLeft_other": "in {{count}} days",
            "today": "expires today",
            "daysOverdue_one": "expired {{count}} day ago",
            "daysOverdue_other": "expired {{count}} days ago"
        },
        "banner": {
            "expiring": "The subscription expires on {{date}} ({{remaining}})",
            "expired": "Subscription expired on {{date}}",
            "manage": "Manage"
        },
        "page": {
            "title": "Subscriptions",
            "description": "Your athletes' expiry dates, soonest first",
            "counters": {
                "expired": "Expired",
                "expiring": "Expiring (≤ 14 d)",
                "active": "Active",
                "none": "No subscription"
            },
            "listTitle": "Recorded subscriptions",
            "noneTitle": "No subscription",
            "noneEmpty": "All your active athletes have a subscription",
            "listEmpty": "No subscriptions recorded",
            "empty": "You have no active athletes",
            "athleteColumn": "Athlete",
            "statusColumn": "Status",
            "endColumn": "Expiry",
            "remainingColumn": "Time left",
            "manage": "Manage"
        }
    },
```

- [ ] **Step 3: Validate both JSON files**

Run: `node -e "for (const l of ['it','en']) JSON.parse(require('fs').readFileSync('public/locales/'+l+'/trainer.json','utf8').replace(/^﻿/,''))" && head -c 3 public/locales/it/trainer.json | xxd`
Expected: no error; first bytes still `efbb bf`.

- [ ] **Step 4: Write the failing test** `tests/unit/subscription-status-badge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubscriptionStatusBadge from '@/components/SubscriptionStatusBadge'

const END = '2026-10-10T00:00:00.000Z'

describe('SubscriptionStatusBadge', () => {
    it.each([
        ['expiring', 7, 'subscriptions.badge.expiring'],
        ['expired', -2, 'subscriptions.badge.expired'],
        ['active', 40, 'subscriptions.badge.active'],
    ] as const)('renders the %s variant', (status, daysLeft, key) => {
        render(<SubscriptionStatusBadge summary={{ status, endDate: END, daysLeft }} />)

        const badge = screen.getByText(key)
        expect(badge.closest('[data-status]')).toHaveAttribute('data-status', status)
    })

    it('renders the none variant without a subscription', () => {
        render(<SubscriptionStatusBadge summary={null} />)

        expect(screen.getByText('subscriptions.badge.none')).toBeInTheDocument()
    })

    it('renders nothing in compact mode for active or missing subscriptions', () => {
        const { container: active } = render(
            <SubscriptionStatusBadge compact summary={{ status: 'active', endDate: END, daysLeft: 40 }} />
        )
        const { container: none } = render(<SubscriptionStatusBadge compact summary={null} />)

        expect(active).toBeEmptyDOMElement()
        expect(none).toBeEmptyDOMElement()
    })

    it('still renders expiring subscriptions in compact mode', () => {
        render(<SubscriptionStatusBadge compact summary={{ status: 'expiring', endDate: END, daysLeft: 3 }} />)

        expect(screen.getByText('subscriptions.badge.expiring')).toBeInTheDocument()
    })
})
```

- [ ] **Step 5: Run to verify failure**

Run: `npx vitest run tests/unit/subscription-status-badge.test.tsx`
Expected: FAIL — cannot resolve `@/components/SubscriptionStatusBadge`.

- [ ] **Step 6: Implement** `src/components/SubscriptionStatusBadge.tsx`:

```tsx
'use client'

import { useTranslation } from 'react-i18next'
import { AlertTriangle, CalendarCheck, CalendarX } from 'lucide-react'
import { formatDate } from '@/lib/date-format'
import type { SubscriptionStatus, SubscriptionSummary } from '@/lib/subscriptions'

export interface SubscriptionStatusBadgeProps {
    summary: SubscriptionSummary | null
    /** List mode: show only statuses that need action (expiring / expired). */
    compact?: boolean
}

const STYLES: Record<SubscriptionStatus, string> = {
    expiring: 'bg-amber-100 text-amber-800',
    expired: 'bg-red-100 text-red-800',
    active: 'bg-green-100 text-green-800',
    none: 'bg-gray-100 text-gray-600',
}

const ICONS: Record<SubscriptionStatus, typeof AlertTriangle> = {
    expiring: AlertTriangle,
    expired: CalendarX,
    active: CalendarCheck,
    none: CalendarX,
}

export default function SubscriptionStatusBadge({ summary, compact = false }: SubscriptionStatusBadgeProps) {
    const { t } = useTranslation('trainer')
    const status: SubscriptionStatus = summary?.status ?? 'none'

    if (compact && (status === 'active' || status === 'none')) return null

    const Icon = ICONS[status]
    const label = summary
        ? t(`subscriptions.badge.${summary.status}`, { date: formatDate(summary.endDate), days: summary.daysLeft })
        : t('subscriptions.badge.none')

    return (
        <span
            data-status={status}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${STYLES[status]}`}
        >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{label}</span>
        </span>
    )
}
```

Add to `src/components/index.ts` (next to the other badge exports):
```ts
export { default as SubscriptionStatusBadge } from './SubscriptionStatusBadge'
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run tests/unit/subscription-status-badge.test.tsx`
Expected: PASS.

- [ ] **Step 8: Append files to the CHANGELOG entry, then commit**

```bash
git add public/locales/it/trainer.json public/locales/en/trainer.json src/components/SubscriptionStatusBadge.tsx src/components/index.ts tests/unit/subscription-status-badge.test.tsx implementation-docs/CHANGELOG.md
git commit -m "feat(ui): add subscription status badge and copy"
```

---

### Task 8: `SubscriptionRenewalFormModal`

**Files:**
- Create: `src/components/SubscriptionRenewalFormModal.tsx`
- Modify: `src/components/index.ts`
- Test: `tests/unit/subscription-renewal-form-modal.test.tsx`

**Interfaces:**
- Consumes: `addMonthsClamped`, `isValidDurationMonths`, `DURATION_SHORTCUTS`, `MIN_DURATION_MONTHS`, `MAX_DURATION_MONTHS`, `RenewalRow` (Task 2); `formatDate`, `formatDateForInput`.
- Produces:
  - `export interface RenewalFormPayload { startDate: string /* YYYY-MM-DD */; durationMonths: number }`
  - `export default function SubscriptionRenewalFormModal(props: { mode: 'create' | 'edit'; initial?: RenewalRow; defaultStartDate: string; isSaving: boolean; onClose: () => void; onSubmit: (payload: RenewalFormPayload) => void })`
  - Field ids: `#renewal-start-date`, `#renewal-duration`; preview element `data-testid="renewal-end-preview"`.

- [ ] **Step 1: Write the failing tests** `tests/unit/subscription-renewal-form-modal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SubscriptionRenewalFormModal from '@/components/SubscriptionRenewalFormModal'
import { formatDate } from '@/lib/date-format'

const onSubmit = vi.fn()
const onClose = vi.fn()

const renderCreate = (defaultStartDate = '2027-01-31') =>
    render(
        <SubscriptionRenewalFormModal
            mode="create"
            defaultStartDate={defaultStartDate}
            isSaving={false}
            onClose={onClose}
            onSubmit={onSubmit}
        />
    )

const save = () => fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

describe('SubscriptionRenewalFormModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('pre-fills the start date with the proposed default', () => {
        renderCreate('2026-11-01')

        expect(screen.getByLabelText('subscriptions.startDate')).toHaveValue('2026-11-01')
    })

    it('disables save until a duration is entered', () => {
        renderCreate()

        expect(screen.getByRole('button', { name: 'common:common.save' })).toBeDisabled()
    })

    it('previews the month-end-clamped expiry as the duration changes', () => {
        renderCreate('2027-01-31')

        fireEvent.change(screen.getByLabelText('subscriptions.duration'), { target: { value: '1' } })

        expect(screen.getByTestId('renewal-end-preview')).toHaveTextContent(
            formatDate(new Date('2027-02-28T00:00:00.000Z'))
        )
    })

    it('fills the duration from a shortcut', () => {
        renderCreate()

        // The test t() mock returns the key, so all four shortcuts share one name
        const shortcuts = screen.getAllByRole('button', { name: 'subscriptions.durationShortcut' })
        expect(shortcuts).toHaveLength(4)
        fireEvent.click(shortcuts[3]) // 12 months

        expect(screen.getByLabelText('subscriptions.duration')).toHaveValue(12)
        expect(shortcuts[3]).toHaveAttribute('aria-pressed', 'true')
    })

    it('submits start date and duration', () => {
        renderCreate('2026-11-01')

        fireEvent.change(screen.getByLabelText('subscriptions.duration'), { target: { value: '3' } })
        save()

        expect(onSubmit).toHaveBeenCalledWith({ startDate: '2026-11-01', durationMonths: 3 })
    })

    it.each(['0', '37', '1.5'])('shows an inline error for duration %s and does not submit', (value) => {
        renderCreate()

        fireEvent.change(screen.getByLabelText('subscriptions.duration'), { target: { value } })
        save()

        expect(screen.getByText('validation.durationMonthsRange')).toBeInTheDocument()
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('edits an existing renewal with its values pre-filled', () => {
        render(
            <SubscriptionRenewalFormModal
                mode="edit"
                initial={{
                    id: 'r-1',
                    traineeId: 't-1',
                    startDate: '2026-09-10T00:00:00.000Z',
                    durationMonths: 6,
                    endDate: '2027-03-10T00:00:00.000Z',
                    createdAt: '2026-09-10T10:00:00.000Z',
                }}
                defaultStartDate="2026-10-03"
                isSaving={false}
                onClose={onClose}
                onSubmit={onSubmit}
            />
        )

        expect(screen.getByText('subscriptions.editTitle')).toBeInTheDocument()
        expect(screen.getByLabelText('subscriptions.startDate')).toHaveValue('2026-09-10')
        expect(screen.getByLabelText('subscriptions.duration')).toHaveValue(6)
    })

    it('closes on cancel', () => {
        renderCreate()

        fireEvent.click(screen.getByRole('button', { name: 'common:common.cancel' }))

        expect(onClose).toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/subscription-renewal-form-modal.test.tsx`
Expected: FAIL — cannot resolve `@/components/SubscriptionRenewalFormModal`.

- [ ] **Step 3: Implement** `src/components/SubscriptionRenewalFormModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'
import {
    DURATION_SHORTCUTS,
    MAX_DURATION_MONTHS,
    MIN_DURATION_MONTHS,
    addMonthsClamped,
    isValidDurationMonths,
    type RenewalRow,
} from '@/lib/subscriptions'
import { formatDate, formatDateForInput } from '@/lib/date-format'

export interface RenewalFormPayload {
    /** YYYY-MM-DD */
    startDate: string
    durationMonths: number
}

export interface SubscriptionRenewalFormModalProps {
    mode: 'create' | 'edit'
    initial?: RenewalRow
    /** Create mode pre-fill (see nextRenewalStart); the trainer can change it */
    defaultStartDate: string
    isSaving: boolean
    onClose: () => void
    onSubmit: (payload: RenewalFormPayload) => void
}

/**
 * Create / edit a renewal. The end date shown is only a preview: the server
 * computes the stored one with the same addMonthsClamped().
 */
export default function SubscriptionRenewalFormModal({
    mode,
    initial,
    defaultStartDate,
    isSaving,
    onClose,
    onSubmit,
}: SubscriptionRenewalFormModalProps) {
    const { t } = useTranslation(['trainer', 'common'])

    const [startDate, setStartDate] = useState(() => (initial ? formatDateForInput(initial.startDate) : defaultStartDate))
    const [duration, setDuration] = useState(() => (initial ? String(initial.durationMonths) : ''))
    const [error, setError] = useState<string | null>(null)

    const months = Number(duration)
    const startIsValid = startDate !== '' && !isNaN(new Date(startDate).getTime())
    const previewEnd = startIsValid && isValidDurationMonths(months) ? addMonthsClamped(new Date(startDate), months) : null
    const canSubmit = startIsValid && duration.trim() !== '' && !isSaving

    const handleSubmit = () => {
        if (!isValidDurationMonths(months)) {
            setError('validation.durationMonthsRange')
            return
        }
        setError(null)
        onSubmit({ startDate, durationMonths: months })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="renewal-modal-title"
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            >
                <h2 id="renewal-modal-title" className="mb-4 text-xl font-bold text-gray-900">
                    {mode === 'edit' ? t('subscriptions.editTitle') : t('subscriptions.createTitle')}
                </h2>

                <div className="mb-4">
                    <FormLabel htmlFor="renewal-start-date" required>
                        {t('subscriptions.startDate')}
                    </FormLabel>
                    <Input
                        id="renewal-start-date"
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        disabled={isSaving}
                    />
                </div>

                <div className="mb-4">
                    <FormLabel htmlFor="renewal-duration" required>
                        {t('subscriptions.duration')}
                    </FormLabel>
                    <Input
                        id="renewal-duration"
                        type="number"
                        inputMode="numeric"
                        step={1}
                        min={MIN_DURATION_MONTHS}
                        max={MAX_DURATION_MONTHS}
                        value={duration}
                        onChange={(event) => setDuration(event.target.value)}
                        state={error ? 'error' : 'default'}
                        helperText={error ? t(error) : undefined}
                        disabled={isSaving}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                        {DURATION_SHORTCUTS.map((shortcut) => (
                            <Button
                                key={shortcut}
                                type="button"
                                variant="secondary"
                                size="sm"
                                aria-pressed={months === shortcut}
                                onClick={() => setDuration(String(shortcut))}
                                disabled={isSaving}
                            >
                                {t('subscriptions.durationShortcut', { count: shortcut })}
                            </Button>
                        ))}
                    </div>
                </div>

                {previewEnd && (
                    <p className="mb-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        {t('subscriptions.previewLabel')}{' '}
                        <strong data-testid="renewal-end-preview">{formatDate(previewEnd)}</strong>
                    </p>
                )}

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

Add to `src/components/index.ts`:
```ts
export { default as SubscriptionRenewalFormModal } from './SubscriptionRenewalFormModal'
```

If `Button` does not forward `aria-pressed` to the DOM, check `src/components/Button.tsx`: it spreads remaining props onto `<button>` (the trainee detail tabs already pass `aria-pressed`), so no change is expected.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/subscription-renewal-form-modal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Append files to the CHANGELOG entry, then commit**

```bash
git add src/components/SubscriptionRenewalFormModal.tsx src/components/index.ts tests/unit/subscription-renewal-form-modal.test.tsx implementation-docs/CHANGELOG.md
git commit -m "feat(ui): add subscription renewal form modal"
```

---

### Task 9: Trainee profile — hook, banner, tab, deep link

**Files:**
- Create: `src/app/trainer/trainees/[id]/_use-trainee-subscription.ts`
- Create: `src/app/trainer/trainees/[id]/_subscription-alert.tsx`
- Create: `src/app/trainer/trainees/[id]/_subscription-tab.tsx`
- Modify: `src/app/trainer/trainees/[id]/_content.tsx` (imports ~1-30; `activeTab` state line ~296; header end ~line 1099; tab nav ~1140-1160; tab content ~1888)
- Test: `tests/unit/trainer-subscription-tab.test.tsx`, `tests/unit/trainer-subscription-alert.test.tsx`

**Interfaces:**
- Consumes: `RenewalRow`, `SubscriptionSummary`, `needsAttention`, `nextRenewalStart`, `remainingLabel` (Task 2); API from Task 5; `SubscriptionStatusBadge` (Task 7); `SubscriptionRenewalFormModal`, `RenewalFormPayload` (Task 8).
- Produces:
  - `useTraineeSubscription(traineeId: string): TraineeSubscriptionState` where `interface TraineeSubscriptionState { renewals: RenewalRow[]; current: SubscriptionSummary | null; loading: boolean; error: boolean; reload: () => Promise<void> }`
  - `SubscriptionAlertBanner({ summary: SubscriptionSummary | null; onManage: () => void })`
  - `SubscriptionTab({ traineeId: string; state: TraineeSubscriptionState })`
  - `/trainer/trainees/[id]?tab=subscription` opens the subscription tab.

- [ ] **Step 1: Implement the hook** `src/app/trainer/trainees/[id]/_use-trainee-subscription.ts`:

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RenewalRow, SubscriptionSummary } from '@/lib/subscriptions'

export interface TraineeSubscriptionState {
    renewals: RenewalRow[]
    current: SubscriptionSummary | null
    loading: boolean
    error: boolean
    reload: () => Promise<void>
}

/**
 * Loaded once by the trainee page and shared by the banner (visible on every
 * tab) and the subscription tab, so a saved renewal updates both at once.
 */
export function useTraineeSubscription(traineeId: string): TraineeSubscriptionState {
    const [renewals, setRenewals] = useState<RenewalRow[]>([])
    const [current, setCurrent] = useState<SubscriptionSummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    const reload = useCallback(async () => {
        try {
            setError(false)
            const res = await fetch(`/api/subscription-renewals?traineeId=${traineeId}`)
            if (!res.ok) throw new Error('load failed')
            const data = await res.json()
            setRenewals(data.data?.items ?? [])
            setCurrent(data.data?.current ?? null)
        } catch {
            setError(true)
        } finally {
            setLoading(false)
        }
    }, [traineeId])

    useEffect(() => {
        void reload()
    }, [reload])

    return { renewals, current, loading, error, reload }
}
```

- [ ] **Step 2: Write the failing banner test** `tests/unit/trainer-subscription-alert.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SubscriptionAlertBanner from '@/app/trainer/trainees/[id]/_subscription-alert'

const END = '2026-10-10T00:00:00.000Z'

describe('SubscriptionAlertBanner', () => {
    it('warns when the subscription is expiring and links to the tab', () => {
        const onManage = vi.fn()
        render(<SubscriptionAlertBanner summary={{ status: 'expiring', endDate: END, daysLeft: 7 }} onManage={onManage} />)

        expect(screen.getByRole('alert')).toHaveTextContent('subscriptions.banner.expiring')
        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.banner.manage' }))
        expect(onManage).toHaveBeenCalled()
    })

    it('warns when the subscription has expired', () => {
        render(<SubscriptionAlertBanner summary={{ status: 'expired', endDate: END, daysLeft: -1 }} onManage={vi.fn()} />)

        expect(screen.getByRole('alert')).toHaveTextContent('subscriptions.banner.expired')
    })

    it('renders nothing for an active or missing subscription', () => {
        const { container: active } = render(
            <SubscriptionAlertBanner summary={{ status: 'active', endDate: END, daysLeft: 40 }} onManage={vi.fn()} />
        )
        const { container: none } = render(<SubscriptionAlertBanner summary={null} onManage={vi.fn()} />)

        expect(active).toBeEmptyDOMElement()
        expect(none).toBeEmptyDOMElement()
    })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/unit/trainer-subscription-alert.test.tsx`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 4: Implement the banner** `src/app/trainer/trainees/[id]/_subscription-alert.tsx`:

```tsx
'use client'

import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/Button'
import { formatDate } from '@/lib/date-format'
import { needsAttention, remainingLabel, type SubscriptionSummary } from '@/lib/subscriptions'

export interface SubscriptionAlertBannerProps {
    summary: SubscriptionSummary | null
    onManage: () => void
}

/** Shown under the trainee header on every tab, only when action is needed. */
export default function SubscriptionAlertBanner({ summary, onManage }: SubscriptionAlertBannerProps) {
    const { t } = useTranslation('trainer')

    if (!summary || !needsAttention(summary)) return null

    const expired = summary.status === 'expired'
    const date = formatDate(summary.endDate)
    const remaining = remainingLabel(summary.daysLeft)
    const message = expired
        ? t('subscriptions.banner.expired', { date })
        : t('subscriptions.banner.expiring', { date, remaining: t(remaining.key, { count: remaining.count }) })

    return (
        <div
            role="alert"
            className={`mb-6 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                expired ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
        >
            <p className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {message}
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={onManage}>
                {t('subscriptions.banner.manage')}
            </Button>
        </div>
    )
}
```

- [ ] **Step 5: Run banner test to verify pass**

Run: `npx vitest run tests/unit/trainer-subscription-alert.test.tsx`
Expected: PASS.

- [ ] **Step 6: Write the failing tab test** `tests/unit/trainer-subscription-tab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const showToast = vi.fn()
vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast }),
    ToastProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

import SubscriptionTab from '@/app/trainer/trainees/[id]/_subscription-tab'
import type { TraineeSubscriptionState } from '@/app/trainer/trainees/[id]/_use-trainee-subscription'

const TRAINEE_ID = 't-1'
const renewal = {
    id: 'r-1',
    traineeId: TRAINEE_ID,
    startDate: '2026-09-10T00:00:00.000Z',
    durationMonths: 1,
    endDate: '2026-10-10T00:00:00.000Z',
    createdAt: '2026-09-10T10:00:00.000Z',
}

function makeState(overrides: Partial<TraineeSubscriptionState> = {}): TraineeSubscriptionState {
    return {
        renewals: [renewal],
        current: { status: 'expiring', endDate: renewal.endDate, daysLeft: 7 },
        loading: false,
        error: false,
        reload: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    }
}

function mockFetchOk() {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) }) as never
}

describe('SubscriptionTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows the current status and one history row per renewal', () => {
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState()} />)

        expect(screen.getByText('subscriptions.badge.expiring')).toBeInTheDocument()
        const table = screen.getByRole('table', { name: 'subscriptions.historyTitle' })
        expect(within(table).getAllByRole('row')).toHaveLength(2) // header + 1
    })

    it('shows the empty state without renewals', () => {
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState({ renewals: [], current: null })} />)

        expect(screen.getByText('subscriptions.empty')).toBeInTheDocument()
        expect(screen.getByText('subscriptions.badge.none')).toBeInTheDocument()
    })

    it('pre-fills a new renewal with the day after the current expiry', () => {
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState()} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.addButton' }))

        expect(screen.getByLabelText('subscriptions.startDate')).toHaveValue('2026-10-11')
    })

    it('creates a renewal and reloads the shared state', async () => {
        mockFetchOk()
        const state = makeState()
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={state} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.addButton' }))
        fireEvent.change(screen.getByLabelText('subscriptions.duration'), { target: { value: '3' } })
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(state.reload).toHaveBeenCalled())
        expect(global.fetch).toHaveBeenCalledWith(
            '/api/subscription-renewals',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ traineeId: TRAINEE_ID, startDate: '2026-10-11', durationMonths: 3 }),
            })
        )
    })

    it('deletes a renewal after confirmation and reloads', async () => {
        mockFetchOk()
        const state = makeState()
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={state} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.deleteAction' }))
        const dialog = await screen.findByRole('dialog')
        // ConfirmationModal labels its confirm button "<confirmText> - <title>"
        fireEvent.click(within(dialog).getByRole('button', { name: 'common:common.delete - subscriptions.deleteTitle' }))

        await waitFor(() => expect(state.reload).toHaveBeenCalled())
        expect(global.fetch).toHaveBeenCalledWith('/api/subscription-renewals/r-1', { method: 'DELETE' })
    })

    it('shows a toast when saving fails', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { code: 'X', message: 'boom' } }) }) as never
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState()} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.addButton' }))
        fireEvent.change(screen.getByLabelText('subscriptions.duration'), { target: { value: '3' } })
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error'))
    })

    it('offers a retry on load error', () => {
        const state = makeState({ error: true })
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={state} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.retry' }))

        expect(state.reload).toHaveBeenCalled()
    })
})
```

- [ ] **Step 7: Implement the tab** `src/app/trainer/trainees/[id]/_subscription-tab.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { ActionIconButton, InlineActions } from '@/components/ActionIconButton'
import { Button } from '@/components/Button'
import ConfirmationModal from '@/components/ConfirmationModal'
import SubscriptionRenewalFormModal, { type RenewalFormPayload } from '@/components/SubscriptionRenewalFormModal'
import SubscriptionStatusBadge from '@/components/SubscriptionStatusBadge'
import { SkeletonDetail } from '@/components/Skeleton'
import { useToast } from '@/components/ToastNotification'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate, getTodayForInput } from '@/lib/date-format'
import { nextRenewalStart, remainingLabel, type RenewalRow } from '@/lib/subscriptions'
import type { TraineeSubscriptionState } from './_use-trainee-subscription'

export interface SubscriptionTabProps {
    traineeId: string
    state: TraineeSubscriptionState
}

/**
 * Trainer-only tab: subscription renewals. The API refuses the trainee role
 * outright, so nothing here needs a role check.
 */
export default function SubscriptionTab({ traineeId, state }: SubscriptionTabProps) {
    const { t } = useTranslation(['trainer', 'common'])
    const { showToast } = useToast()
    const { renewals, current, loading, error, reload } = state

    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; initial?: RenewalRow } | null>(null)
    const [saving, setSaving] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<RenewalRow | null>(null)
    const [deleting, setDeleting] = useState(false)

    const request = async (url: string, init: RequestInit) => {
        const res = await fetch(url, init)
        if (!res.ok) {
            const data = await res.json()
            throw new Error(getApiErrorMessage(data, t('subscriptions.saveError'), t))
        }
    }

    const handleSubmit = async (payload: RenewalFormPayload) => {
        setSaving(true)
        try {
            if (modal?.mode === 'edit' && modal.initial) {
                await request(`/api/subscription-renewals/${modal.initial.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
            } else {
                await request('/api/subscription-renewals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ traineeId, ...payload }),
                })
            }
            setModal(null)
            await reload()
            showToast(t('common:common.success'), 'success')
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('subscriptions.saveError'), 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (row: RenewalRow) => {
        setDeleting(true)
        try {
            await request(`/api/subscription-renewals/${row.id}`, { method: 'DELETE' })
            setPendingDelete(null)
            await reload()
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('subscriptions.saveError'), 'error')
        } finally {
            setDeleting(false)
        }
    }

    if (loading) return <SkeletonDetail />

    if (error) {
        return (
            <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-state-error">
                <p>{t('subscriptions.loadError')}</p>
                <Button type="button" onClick={() => void reload()}>
                    {t('subscriptions.retry')}
                </Button>
            </div>
        )
    }

    const remaining = current ? remainingLabel(current.daysLeft) : null

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{t('subscriptions.title')}</h2>
                    <p className="mt-1 text-sm text-gray-600">{t('subscriptions.subtitle')}</p>
                </div>
                <Button type="button" icon={<Plus />} onClick={() => setModal({ mode: 'create' })}>
                    {t('subscriptions.addButton')}
                </Button>
            </div>

            <section className="rounded-lg bg-white p-6 shadow-md">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                    {t('subscriptions.currentTitle')}
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                    <SubscriptionStatusBadge summary={current} />
                    {remaining && (
                        <span className="text-sm text-gray-600">{t(remaining.key, { count: remaining.count })}</span>
                    )}
                </div>
            </section>

            <section className="overflow-hidden rounded-lg bg-white shadow-md">
                <h3 id="renewal-history-title" className="px-6 pt-6 text-lg font-semibold text-gray-900">
                    {t('subscriptions.historyTitle')}
                </h3>
                {renewals.length === 0 ? (
                    <p className="px-6 py-8 text-center text-gray-500">{t('subscriptions.empty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table aria-labelledby="renewal-history-title" className="mt-4 min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {['startColumn', 'durationColumn', 'endColumn', 'createdColumn'].map((column) => (
                                        <th
                                            key={column}
                                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                                        >
                                            {t(`subscriptions.${column}`)}
                                        </th>
                                    ))}
                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                        {t('subscriptions.actionsColumn')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {renewals.map((row) => (
                                    <tr key={row.id}>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{formatDate(row.startDate)}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                                            {t('subscriptions.durationValue', { count: row.durationMonths })}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900">
                                            {formatDate(row.endDate)}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{formatDate(row.createdAt)}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right">
                                            <InlineActions>
                                                <ActionIconButton
                                                    variant="edit"
                                                    label={t('subscriptions.editAction')}
                                                    onClick={() => setModal({ mode: 'edit', initial: row })}
                                                />
                                                <ActionIconButton
                                                    variant="delete"
                                                    label={t('subscriptions.deleteAction')}
                                                    onClick={() => setPendingDelete(row)}
                                                />
                                            </InlineActions>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {modal && (
                <SubscriptionRenewalFormModal
                    mode={modal.mode}
                    initial={modal.initial}
                    defaultStartDate={nextRenewalStart(current?.endDate ?? null, getTodayForInput())}
                    isSaving={saving}
                    onClose={() => setModal(null)}
                    onSubmit={(payload) => void handleSubmit(payload)}
                />
            )}

            {pendingDelete && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setPendingDelete(null)}
                    onConfirm={() => void handleDelete(pendingDelete)}
                    title={t('subscriptions.deleteTitle')}
                    message={t('subscriptions.deleteMessage', {
                        start: formatDate(pendingDelete.startDate),
                        end: formatDate(pendingDelete.endDate),
                    })}
                    confirmText={t('common:common.delete')}
                    variant="danger"
                    isLoading={deleting}
                />
            )}
        </div>
    )
}
```

- [ ] **Step 8: Run tab test to verify pass**

Run: `npx vitest run tests/unit/trainer-subscription-tab.test.tsx`
Expected: PASS.

- [ ] **Step 9: Wire into `_content.tsx`**

Imports — change `import { useParams } from 'next/navigation'` to:
```ts
import { useParams, useSearchParams } from 'next/navigation'
```
and add after `import MeasurementsTab from './_measurements-tab'`:
```ts
import SubscriptionTab from './_subscription-tab'
import SubscriptionAlertBanner from './_subscription-alert'
import { useTraineeSubscription } from './_use-trainee-subscription'
```

State — replace the `activeTab` line (~296) with:
```ts
    type DetailTab = 'notes' | 'programs' | 'records' | 'reports' | 'measurements' | 'subscription'
    const searchParams = useSearchParams()
    const [activeTab, setActiveTab] = useState<DetailTab>(() =>
        searchParams.get('tab') === 'subscription' ? 'subscription' : 'programs'
    )
    const subscription = useTraineeSubscription(traineeId)
```

Banner — right after the header block's closing `</div>` (the `{/* Header */}` `<div className="mb-8">…</div>`, just before `{/* Tabs */}`), add:
```tsx
                <SubscriptionAlertBanner
                    summary={subscription.current}
                    onManage={() => setActiveTab('subscription')}
                />
```

Tab button — after the measurements tab `<Button>` (ends with `{t('measurements.tab')}</Button>`), add:
```tsx
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setActiveTab('subscription')}
                                aria-pressed={activeTab === 'subscription'}
                                className={`rounded-none border-b-2 bg-transparent px-1 pb-4 font-semibold shadow-none hover:bg-transparent ${activeTab === 'subscription'
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {t('subscriptions.tab')}
                            </Button>
```

Tab content — after `{activeTab === 'measurements' && <MeasurementsTab traineeId={traineeId} />}` add:
```tsx
                {activeTab === 'subscription' && <SubscriptionTab traineeId={traineeId} state={subscription} />}
```

- [ ] **Step 10: Verify**

Run: `npm run type-check && npm run lint && npx vitest run tests/unit/trainer-subscription-tab.test.tsx tests/unit/trainer-subscription-alert.test.tsx tests/unit/trainer-trainee-measurements-tab.test.tsx`
Expected: no type or lint errors; tests PASS.

- [ ] **Step 11: Append files to the CHANGELOG entry, then commit**

```bash
git add "src/app/trainer/trainees/[id]/_use-trainee-subscription.ts" "src/app/trainer/trainees/[id]/_subscription-alert.tsx" "src/app/trainer/trainees/[id]/_subscription-tab.tsx" "src/app/trainer/trainees/[id]/_content.tsx" tests/unit/trainer-subscription-tab.test.tsx tests/unit/trainer-subscription-alert.test.tsx implementation-docs/CHANGELOG.md
git commit -m "feat(trainer): add subscription tab and expiry banner to trainee detail"
```

---

### Task 10: Trainee list badge

**Files:**
- Modify: `src/app/trainer/trainees/_content.tsx` (interface `Trainee` ~line 14; name cell ~line 322)
- Test: `tests/unit/trainer-trainees-list-subscription.test.tsx`

**Interfaces:**
- Consumes: `subscription` field from `GET /api/users` (Task 6); `SubscriptionStatusBadge` (Task 7).

- [ ] **Step 1: Write the failing test** `tests/unit/trainer-trainees-list-subscription.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
    ToastProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

import TrainerTraineesContent from '@/app/trainer/trainees/_content'

const base = { email: 'x@x.it', createdAt: '2026-01-01T00:00:00.000Z' }
const items = [
    { ...base, id: 't1', firstName: 'Anna', lastName: 'Rossi', isActive: true, subscription: { status: 'expiring', endDate: '2026-10-10T00:00:00.000Z', daysLeft: 7 } },
    { ...base, id: 't2', firstName: 'Luca', lastName: 'Bianchi', isActive: true, subscription: { status: 'active', endDate: '2027-01-10T00:00:00.000Z', daysLeft: 99 } },
    { ...base, id: 't3', firstName: 'Sara', lastName: 'Verdi', isActive: false, subscription: { status: 'expired', endDate: '2026-09-10T00:00:00.000Z', daysLeft: -23 } },
]

describe('Trainer trainee list — subscription alert', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    items,
                    statusCounts: { all: 3, active: 2, inactive: 1 },
                    pagination: { nextCursor: null, hasMore: false, currentPage: 1, totalPages: 1, totalItems: 3, limit: 20 },
                },
            }),
        }) as never
    })

    it('shows the badge only for active trainees whose subscription needs attention', async () => {
        render(<TrainerTraineesContent />)

        expect(await screen.findByText('Anna Rossi')).toBeInTheDocument()
        expect(screen.getAllByText('subscriptions.badge.expiring')).toHaveLength(1)
        expect(screen.queryByText('subscriptions.badge.active')).not.toBeInTheDocument()
        expect(screen.queryByText('subscriptions.badge.expired')).not.toBeInTheDocument() // inactive trainee
    })
})
```

If the component needs extra providers or mocks to render (e.g. `next/navigation`), mirror what any existing test that renders a `_content.tsx` page does (`grep -l "_content'" tests/unit`).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/trainer-trainees-list-subscription.test.tsx`
Expected: FAIL — badge text not found.

- [ ] **Step 3: Implement** in `src/app/trainer/trainees/_content.tsx`:

Imports: add `SubscriptionStatusBadge` to the existing `@/components` import, and:
```ts
import { needsAttention, type SubscriptionSummary } from '@/lib/subscriptions'
```

Interface `Trainee` gains:
```ts
    subscription?: SubscriptionSummary | null
```

Name cell — replace:
```tsx
                                            <div className="font-semibold text-gray-900">
                                                {trainee.firstName} {trainee.lastName}
                                            </div>
```
with:
```tsx
                                            <div className="font-semibold text-gray-900">
                                                {trainee.firstName} {trainee.lastName}
                                            </div>
                                            {/* Paused athletes get no alert: nothing to act on. Wrapper only when shown, no stray margin */}
                                            {trainee.isActive && needsAttention(trainee.subscription ?? null) && (
                                                <div className="mt-1">
                                                    <SubscriptionStatusBadge compact summary={trainee.subscription ?? null} />
                                                </div>
                                            )}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/trainer-trainees-list-subscription.test.tsx && npm run type-check`
Expected: PASS, no type errors.

- [ ] **Step 5: Append files to the CHANGELOG entry, then commit**

```bash
git add src/app/trainer/trainees/_content.tsx tests/unit/trainer-trainees-list-subscription.test.tsx implementation-docs/CHANGELOG.md
git commit -m "feat(trainer): flag expiring subscriptions in athlete list"
```

---

### Task 11: Subscriptions page and hamburger menu entry

**Files:**
- Create: `src/app/trainer/subscriptions/page.tsx`
- Create: `src/app/trainer/subscriptions/_content.tsx`
- Create: `src/app/trainer/subscriptions/loading.tsx`
- Modify: `src/components/DashboardLayout.tsx` (lucide import; `NAV_ITEMS.trainer`)
- Modify: `public/locales/it/navigation.json`, `public/locales/en/navigation.json`
- Test: `tests/unit/trainer-subscriptions-content.test.tsx`, `tests/unit/DashboardLayout.test.tsx`

**Interfaces:**
- Consumes: `getTrainerSubscriptionOverview` (Task 3), `SubscriptionOverview`, `remainingLabel` (Task 2), `SubscriptionStatusBadge` (Task 7), `getTodayDateKey`.
- Produces: route `/trainer/subscriptions`; `TrainerSubscriptionsContent({ overview: SubscriptionOverview })`; rows link to `/trainer/trainees/{id}?tab=subscription`.

- [ ] **Step 1: Write the failing content test** `tests/unit/trainer-subscriptions-content.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import TrainerSubscriptionsContent from '@/app/trainer/subscriptions/_content'
import type { SubscriptionOverview } from '@/lib/subscriptions'

const overview: SubscriptionOverview = {
    withSubscription: [
        { traineeId: 'rossi', firstName: 'Anna', lastName: 'Rossi', subscription: { status: 'expired', endDate: '2026-10-01T00:00:00.000Z', daysLeft: -2 } },
        { traineeId: 'verdi', firstName: 'Sara', lastName: 'Verdi', subscription: { status: 'expiring', endDate: '2026-10-10T00:00:00.000Z', daysLeft: 7 } },
        { traineeId: 'bianchi', firstName: 'Luca', lastName: 'Bianchi', subscription: { status: 'active', endDate: '2026-12-01T00:00:00.000Z', daysLeft: 59 } },
    ],
    withoutSubscription: [{ traineeId: 'neri', firstName: 'Paolo', lastName: 'Neri', subscription: null }],
    counts: { expired: 1, expiring: 1, active: 1, none: 1 },
}

describe('TrainerSubscriptionsContent', () => {
    it('shows the four counters', () => {
        render(<TrainerSubscriptionsContent overview={overview} />)

        for (const key of ['expired', 'expiring', 'active', 'none']) {
            const counter = screen.getByTestId(`subscription-counter-${key}`)
            expect(counter).toHaveTextContent('1')
        }
    })

    it('keeps the server order (soonest expiry first) and links to the subscription tab', () => {
        render(<TrainerSubscriptionsContent overview={overview} />)

        const list = screen.getByRole('list', { name: 'subscriptions.page.listTitle' })
        const links = within(list).getAllByRole('link')
        expect(links.map((link) => link.textContent)).toEqual([
            expect.stringContaining('Anna Rossi'),
            expect.stringContaining('Sara Verdi'),
            expect.stringContaining('Luca Bianchi'),
        ])
        expect(links[0]).toHaveAttribute('href', '/trainer/trainees/rossi?tab=subscription')
    })

    it('lists trainees without a subscription in their own block', () => {
        render(<TrainerSubscriptionsContent overview={overview} />)

        const block = screen.getByRole('list', { name: 'subscriptions.page.noneTitle' })
        expect(within(block).getByRole('link')).toHaveTextContent('Paolo Neri')
    })

    it('shows the empty state without active trainees', () => {
        render(
            <TrainerSubscriptionsContent
                overview={{ withSubscription: [], withoutSubscription: [], counts: { expired: 0, expiring: 0, active: 0, none: 0 } }}
            />
        )

        expect(screen.getByText('subscriptions.page.empty')).toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/trainer-subscriptions-content.test.tsx`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement the client content** `src/app/trainer/subscriptions/_content.tsx`.

A single responsive list (`<ul>`) of row-links serves both phone and desktop — a grid on `md` and a stacked card below it — so there is no table to scroll horizontally.

```tsx
'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import SubscriptionStatusBadge from '@/components/SubscriptionStatusBadge'
import { formatDate } from '@/lib/date-format'
import {
    needsAttention,
    remainingLabel,
    type SubscriptionOverview,
    type SubscriptionOverviewItem,
    type SubscriptionStatus,
} from '@/lib/subscriptions'

export interface TrainerSubscriptionsContentProps {
    overview: SubscriptionOverview
}

const COUNTERS: { key: SubscriptionStatus; className: string }[] = [
    { key: 'expired', className: 'border-red-200 bg-red-50 text-red-800' },
    { key: 'expiring', className: 'border-amber-200 bg-amber-50 text-amber-800' },
    { key: 'active', className: 'border-green-200 bg-green-50 text-green-800' },
    { key: 'none', className: 'border-gray-200 bg-gray-50 text-gray-700' },
]

function SubscriptionRow({ item }: { item: SubscriptionOverviewItem }) {
    const { t } = useTranslation('trainer')
    const { subscription } = item
    const remaining = subscription ? remainingLabel(subscription.daysLeft) : null

    return (
        <li>
            <Link
                href={`/trainer/trainees/${item.traineeId}?tab=subscription`}
                className={`flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-gray-50 md:grid md:grid-cols-[2fr_2fr_1fr_1fr_auto] md:items-center md:gap-4 md:px-6 ${
                    needsAttention(subscription) ? 'bg-amber-50/40' : ''
                }`}
            >
                <span className="font-semibold text-gray-900">
                    {item.firstName} {item.lastName}
                </span>
                <span>
                    <SubscriptionStatusBadge summary={subscription} />
                </span>
                <span className="text-sm text-gray-700">{subscription ? formatDate(subscription.endDate) : '—'}</span>
                <span className="text-sm text-gray-600">
                    {remaining ? t(remaining.key, { count: remaining.count }) : '—'}
                </span>
                <ChevronRight className="hidden h-4 w-4 text-gray-400 md:block" aria-hidden="true" />
            </Link>
        </li>
    )
}

function ColumnHeader() {
    const { t } = useTranslation('trainer')
    return (
        <div className="hidden bg-gray-50 px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 md:grid md:grid-cols-[2fr_2fr_1fr_1fr_auto] md:gap-4">
            <span>{t('subscriptions.page.athleteColumn')}</span>
            <span>{t('subscriptions.page.statusColumn')}</span>
            <span>{t('subscriptions.page.endColumn')}</span>
            <span>{t('subscriptions.page.remainingColumn')}</span>
            <span className="w-4" />
        </div>
    )
}

export default function TrainerSubscriptionsContent({ overview }: TrainerSubscriptionsContentProps) {
    const { t } = useTranslation('trainer')
    const { withSubscription, withoutSubscription, counts } = overview
    const hasTrainees = withSubscription.length + withoutSubscription.length > 0

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('subscriptions.page.title')}</h1>
                    <p className="mt-2 text-gray-600">{t('subscriptions.page.description')}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {COUNTERS.map(({ key, className }) => (
                        <div key={key} data-testid={`subscription-counter-${key}`} className={`rounded-lg border p-4 ${className}`}>
                            <p className="text-sm font-semibold">{t(`subscriptions.page.counters.${key}`)}</p>
                            <p className="mt-1 text-3xl font-bold">{counts[key]}</p>
                        </div>
                    ))}
                </div>

                {!hasTrainees ? (
                    <div className="rounded-lg bg-white p-12 text-center text-gray-500 shadow-md">
                        {t('subscriptions.page.empty')}
                    </div>
                ) : (
                    <>
                        <section className="overflow-hidden rounded-lg bg-white shadow-md">
                            <h2 id="subscriptions-list-title" className="px-6 pt-6 pb-4 text-lg font-semibold text-gray-900">
                                {t('subscriptions.page.listTitle')}
                            </h2>
                            {withSubscription.length === 0 ? (
                                <p className="px-6 pb-6 text-gray-500">{t('subscriptions.page.listEmpty')}</p>
                            ) : (
                                <>
                                    <ColumnHeader />
                                    <ul aria-labelledby="subscriptions-list-title" className="divide-y divide-gray-200">
                                        {withSubscription.map((item) => (
                                            <SubscriptionRow key={item.traineeId} item={item} />
                                        ))}
                                    </ul>
                                </>
                            )}
                        </section>

                        <section className="overflow-hidden rounded-lg bg-white shadow-md">
                            <h2 id="subscriptions-none-title" className="px-6 pt-6 pb-4 text-lg font-semibold text-gray-900">
                                {t('subscriptions.page.noneTitle')}
                            </h2>
                            {withoutSubscription.length === 0 ? (
                                <p className="px-6 pb-6 text-gray-500">{t('subscriptions.page.noneEmpty')}</p>
                            ) : (
                                <ul aria-labelledby="subscriptions-none-title" className="divide-y divide-gray-200">
                                    {withoutSubscription.map((item) => (
                                        <SubscriptionRow key={item.traineeId} item={item} />
                                    ))}
                                </ul>
                            )}
                        </section>
                    </>
                )}
            </div>
        </div>
    )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/trainer-subscriptions-content.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implement the server page and loader**

`src/app/trainer/subscriptions/page.tsx`:
```tsx
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { getTodayDateKey } from '@/lib/date-format'
import TrainerSubscriptionsContent from './_content'

export default async function TrainerSubscriptionsPage() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    if (session.user.role !== 'trainer') {
        redirect(`/${session.user.role}/dashboard`)
    }

    // Scoped to the logged-in trainer: each trainer sees only their own athletes
    const overview = await getTrainerSubscriptionOverview(session.user.id, getTodayDateKey())

    return (
        <DashboardLayout user={session.user} backHref="/trainer/dashboard">
            <TrainerSubscriptionsContent overview={overview} />
        </DashboardLayout>
    )
}
```

`src/app/trainer/subscriptions/loading.tsx`:
```tsx
import { NavigationLoadingOverlay } from '@/components'

export default function Loading() {
    return <NavigationLoadingOverlay />
}
```

- [ ] **Step 6: Write the failing nav test** — add to `tests/unit/DashboardLayout.test.tsx` (inside its main `describe`, reusing its `mockUser` with role `trainer`; open the menu the way the file's existing tests do, if they do):

```tsx
    it('links the trainer menu to the subscriptions page', () => {
        render(<DashboardLayout user={mockUser}>content</DashboardLayout>)

        const link = screen.getAllByRole('link').find((item) => item.getAttribute('href') === '/trainer/subscriptions')
        expect(link).toBeDefined()
    })
```

Run: `npx vitest run tests/unit/DashboardLayout.test.tsx`
Expected: the new test FAILS. (If nav links render only once the hamburger is opened, click the menu button first, as other tests in the file do.)

- [ ] **Step 7: Add the nav item and copy**

`src/components/DashboardLayout.tsx` — add `CalendarClock` to the existing `lucide-react` import, and in `NAV_ITEMS.trainer` insert after the `myAthletes` entry:
```tsx
        { href: '/trainer/subscriptions', icon: <CalendarClock className="w-5 h-5" />, titleKey: 'navigation.subscriptions' },
```

`public/locales/it/navigation.json`, inside `"navigation"`, after `"myAthletes"`:
```json
        "subscriptions": "Abbonamenti",
```
`public/locales/en/navigation.json`, same position:
```json
        "subscriptions": "Subscriptions",
```

- [ ] **Step 8: Verify**

Run: `npx vitest run tests/unit/DashboardLayout.test.tsx tests/unit/trainer-subscriptions-content.test.tsx && npm run type-check && npm run lint`
Expected: PASS, no errors.

- [ ] **Step 9: Append files to the CHANGELOG entry (note: "nuova pagina `/trainer/subscriptions` nel menu: contatori, lista ordinata per giorni rimanenti con scaduti in cima, blocco atleti senza abbonamento; solo atleti attivi del trainer loggato"), then commit**

```bash
git add src/app/trainer/subscriptions src/components/DashboardLayout.tsx public/locales/it/navigation.json public/locales/en/navigation.json tests/unit/trainer-subscriptions-content.test.tsx tests/unit/DashboardLayout.test.tsx implementation-docs/CHANGELOG.md
git commit -m "feat(trainer): add subscriptions overview page to menu"
```

---

### Task 12: Home KPI card

**Files:**
- Modify: `src/app/trainer/dashboard/page.tsx` (imports; data loading after `exercisesCount` ~line 168; stats grid ~line 284)
- Modify: `public/locales/it/trainer.json`, `public/locales/en/trainer.json` (`trainerDashboard` block)

**Interfaces:**
- Consumes: `getTrainerSubscriptionOverview` (Task 3), `getTodayDateKey`.

This page is an async server component with its own dictionary-based `translate`; it has no unit test today. Verification is type-check, lint, build-time render in the E2E of Task 13.

- [ ] **Step 1: Add the copy**

In `public/locales/it/trainer.json`, inside `"trainerDashboard"`, after `"statsCardTestWeeksSub"`:
```json
        "statsCardSubscriptionsTitle": "Abbonamenti",
        "statsCardSubscriptionsSub": "{{expired}} scaduti · {{expiring}} in scadenza (14 gg)",
```
In `public/locales/en/trainer.json`, same position:
```json
        "statsCardSubscriptionsTitle": "Subscriptions",
        "statsCardSubscriptionsSub": "{{expired}} expired · {{expiring}} expiring (14 d)",
```

- [ ] **Step 2: Load the counts** — in `src/app/trainer/dashboard/page.tsx`:

Imports: add `CalendarClock` to the `lucide-react` import, and:
```ts
import { getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { getTodayDateKey } from '@/lib/date-format'
```
(`formatDate` is already imported from `@/lib/date-format`; merge into that import.)

After the `exercisesCount` query add:
```ts
    // Subscriptions needing action (expired + expiring within 14 days), trainer's active athletes only
    const { counts: subscriptionCounts } = await getTrainerSubscriptionOverview(trainerId, getTodayDateKey())
```

- [ ] **Step 3: Add the card** — change the stats grid container from `grid grid-cols-1 md:grid-cols-4 gap-6` to `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`, and after the `{/* Current Test Weeks KPI */}` `<Link>` add:

```tsx
                    {/* Subscriptions KPI */}
                    <Link
                        href="/trainer/subscriptions"
                        className="bg-amber-50 hover:bg-amber-100 p-6 rounded-lg transition-colors border border-amber-200"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-amber-900">
                                <CalendarClock className="w-5 h-5 inline mr-2" />{t('trainerDashboard.statsCardSubscriptionsTitle')}
                            </h3>
                            <span className="text-3xl font-bold text-amber-600">
                                {subscriptionCounts.expired + subscriptionCounts.expiring}
                            </span>
                        </div>
                        <p className="text-amber-700 text-sm">
                            {t('trainerDashboard.statsCardSubscriptionsSub', {
                                expired: subscriptionCounts.expired,
                                expiring: subscriptionCounts.expiring,
                            })}
                        </p>
                    </Link>
```

(`t` here is the page's local translate wrapper already used by the other cards.)

- [ ] **Step 4: Verify**

Run: `node -e "for (const l of ['it','en']) JSON.parse(require('fs').readFileSync('public/locales/'+l+'/trainer.json','utf8').replace(/^﻿/,''))" && npm run type-check && npm run lint`
Expected: no errors.

- [ ] **Step 5: Append files to the CHANGELOG entry (note: "card KPI in home trainer: scaduti + in scadenza, link alla pagina abbonamenti; griglia statistiche a 3 colonne su desktop"), then commit**

```bash
git add src/app/trainer/dashboard/page.tsx public/locales/it/trainer.json public/locales/en/trainer.json implementation-docs/CHANGELOG.md
git commit -m "feat(trainer): add expiring subscriptions KPI to home"
```

---

### Task 13: End-to-end test and final verification

**Files:**
- Create: `tests/e2e/trainer-subscription-renewals.spec.ts`
- Modify: `implementation-docs/CHANGELOG.md`, `vitest.config.ts` (only if thresholds rose)

- [ ] **Step 1: Write the E2E** `tests/e2e/trainer-subscription-renewals.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E: trainer records a renewal expiring within 14 days and sees the alert
 * in the profile, the athlete list, the subscriptions page and the home KPI.
 *
 * Prerequisites:
 *   - Seed data present (see ./fixtures/test-users.ts)
 *   - Server running at http://localhost:3000
 *   - Migration 20261003000000_add_subscription_renewals applied
 */

/** start = today − 20 days, 1 month → ends 8–11 days from today: always "expiring". */
function expiringStartDate(): string {
    const start = new Date()
    start.setDate(start.getDate() - 20)
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
}

test.describe('Trainer: subscription renewals', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
    })

    test('an expiring renewal shows up everywhere, and deleting it clears the alert', async ({ page }) => {
        await page.goto('/trainer/trainees')
        await page.getByRole('link', { name: /dettagl|detail|gestisci/i }).first().click()
        await page.waitForURL(/\/trainer\/trainees\/[^/?]+$/)
        const traineeUrl = page.url()
        const traineeName = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? ''

        // Record the renewal
        await page.getByRole('button', { name: /^(abbonamento|subscription)$/i }).click()
        const dialog = page.getByRole('dialog')
        await page.getByRole('button', { name: /registra rinnovo|record renewal/i }).click()
        await dialog.locator('#renewal-start-date').fill(expiringStartDate())
        await dialog.locator('#renewal-duration').fill('1')
        await expect(dialog.getByTestId('renewal-end-preview')).toBeVisible()
        await dialog.getByRole('button', { name: /salva|save/i }).click()
        await expect(dialog).toBeHidden()

        // Profile banner
        const banner = page.getByRole('alert').filter({ hasText: /scade il|expires on/i })
        await expect(banner).toBeVisible()

        // Athlete list badge
        await page.goto('/trainer/trainees')
        const row = page.getByRole('row').filter({ hasText: traineeName })
        await expect(row.getByText(/scade il|expires on/i)).toBeVisible()

        // Subscriptions page (via the hamburger menu entry's URL), deep link back to the tab
        await page.goto('/trainer/subscriptions')
        const list = page.getByRole('list', { name: /abbonamenti registrati|recorded subscriptions/i })
        const entry = list.getByRole('link').filter({ hasText: traineeName })
        await expect(entry).toBeVisible()
        await expect(entry).toHaveAttribute('href', /\?tab=subscription$/)

        // Home KPI counts at least this athlete
        await page.goto('/trainer/dashboard')
        const kpi = page.getByRole('link', { name: /abbonamenti|subscriptions/i }).filter({ hasText: /in scadenza|expiring/i })
        await expect(kpi).toBeVisible()
        await expect(kpi.locator('span.text-3xl')).not.toHaveText('0')

        // Clean up: delete the renewal, the banner disappears
        await page.goto(`${traineeUrl}?tab=subscription`)
        await page.getByRole('button', { name: /elimina rinnovo|delete renewal/i }).first().click()
        // Confirm button is first in ConfirmationModal; its label is "<confirm> - <title>"
        await page.getByRole('dialog').getByRole('button', { name: /elimina|delete/i }).first().click()
        await expect(banner).toBeHidden()
    })
})
```

- [ ] **Step 2: Run the E2E** (requires the dev server, a seeded DB and the migration applied)

Run: `npm run test:e2e -- tests/e2e/trainer-subscription-renewals.spec.ts`
Expected: PASS. If the environment has no seeded DB, report that the E2E could not be run rather than claiming it passed.

- [ ] **Step 3: Full verification**

Run: `npm run type-check && npm run lint && npm run test:unit -- --coverage`
Expected: all green; coverage thresholds in `vitest.config.ts` met. If the measured global numbers are above the current floors (48/48/37/44), raise the global floors to the new measured values (rounded down), as the previous feature did.

Run: `npm run build`
Expected: build succeeds (catches server/client boundary errors, e.g. a client component importing `@/lib/subscription-queries`).

- [ ] **Step 4: Finalize the CHANGELOG entry** — add the E2E file and `vitest.config.ts` (if changed) to **File modificati**, and append to **Note** the test count before → after (from the Vitest summary) and the new threshold values if raised.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/trainer-subscription-renewals.spec.ts implementation-docs/CHANGELOG.md vitest.config.ts
git commit -m "test(e2e): cover subscription renewal alerts across trainer screens"
```

---

## Self-review notes (for the executor)

- Tasks 2 → 3 → 4 → 5 → 6 are strictly ordered (types and helpers flow forward). Tasks 7 → 8 → 9 depend on 2 and 5. Tasks 10, 11, 12 depend on 3/6/7 and are independent of each other. Task 13 is last.
- UI state follows the measurements-tab pattern (`useState` + `fetch`, local-state modal), as the spec states.
