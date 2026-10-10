# Program-Package Renewals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a trainer record a renewal as a package of programs ("schede") instead of months, consume one program at each publish, warn when the trainee runs out, and keep an append-only history of every renewal and credit movement.

**Architecture:** `SubscriptionRenewal` gains a `kind` discriminator (`period` | `programs`). The program balance is derived at read time as `SUM(programCount) − COUNT(ProgramCreditUsage)`; a separate append-only `SubscriptionEvent` table feeds the trainer-facing history and is never read for calculations. The subscription summary becomes a discriminated union that reuses the existing `active | expiring | expired` statuses, so every existing alert surface keeps working with a new text branch.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), Zod v3, react-i18next, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-program-package-renewals-design.md` — read it before starting any task.

## Global Constraints

- Before touching code, invoke the project skill that matches the task: `zero-cento-backend` (API, Prisma, lib), `zero-cento-frontend` (components, pages), `zero-cento-testing` (every test).
- Current mode of a trainee = `kind` of the renewal with the latest `createdAt`. No renewals → no mode.
- Balance = `SUM(programCount) − COUNT(ProgramCreditUsage)`, all-time, carried across mode switches, may be negative.
- Programs status: balance ≥ 2 `active`, balance 1 `expiring`, balance ≤ 0 `expired`.
- A publish consumes a credit **only** when the trainee's current mode is `programs`. Publishing is never rejected because of the subscription state.
- Package size: integer 1–50. Period duration stays integer 1–36.
- `kind` of an existing renewal is immutable.
- Every `SubscriptionEvent` is written in the same transaction as the mutation it describes. Events are never updated or deleted by application code.
- RBAC unchanged: trainee role gets 403 on every subscription endpoint and never receives `consumedCredit`; trainer only for own trainees; admin allowed.
- API responses only through `apiSuccess` / `apiError`; `catch` blocks end with `handleApiError`. Never report 4xx to Sentry.
- All UI copy through react-i18next, in both `public/locales/it/` and `public/locales/en/`. **These JSON files start with a UTF-8 BOM: edit them with the Edit tool, never rewrite them with a script.**
- Click-triggered async uses `<Button isLoading loadingText={t('common:common.saving')}>`; never a raw `<button disabled>` in new code.
- The unit-test `t()` mock returns the key: component tests assert on i18n keys, not on Italian text.
- After each task add an entry at the top of `## [Unreleased]` in `implementation-docs/CHANGELOG.md`, in the existing format (`### [10 Ottobre 2026] — <titolo>`, `**File modificati:**`, `**Note:**`, written in Italian), and include it in the task's commit.
- Coverage floors in `vitest.config.ts` are glob-based (`src/lib/**`, `src/schemas/**`, `src/app/api/**`): new files are covered automatically, do not edit the config.
- Commit on the current branch with conventional-commit messages. Do not push.

## Deviations from the spec (decided while planning)

- Function names: the period builder keeps the existing name `toSubscriptionSummary(endDate, today)`; the dispatcher is `resolveSummary(input, today)`; the publish check is `uncoveredReason(summary)` (returns which of the three cases applies) instead of `isUncovered`.
- Event logging lives in `src/lib/subscription-events.ts`; credit mutations in `src/lib/program-credits.ts`.
- `consumedCredit` is added to `GET /api/programs` (the list — the only place the trainer deletes programs from), not to `GET /api/programs/[id]`.
- `GET /api/subscription-renewals` also returns `programBalance` (needed by the form preview when the trainee is currently in period mode).
- The subscription tab does not get a status card (an existing test asserts it is deliberately absent — status lives in the header icon and banner). It gets a one-line program balance instead.
- Dashboard alerts get a third key, `programsDebt`, next to `programsExhausted` / `programsLast`.

## Review Focus

1. **Leftover package balance while in period mode** — trainee bought 5 programs, used 2, then switched to months. A publish must not consume, and the summary must be the period one. Pinned in Task 4 (`consumeCreditOnPublish` no-op test) and Task 2 (`summarizeRenewals` test).
2. **Package edited below what was already consumed** — package of 5 with 4 used, edited to 2. Balance becomes −2 and renders as "in debt", nothing throws. Pinned in Task 1 (`toProgramsSummary(-2)`) and Task 3 (PATCH test asserting `creditDelta: -3`).
3. **Garbage `refundCredit` value** — `DELETE /api/programs/x?refundCredit=yes` or a missing param must behave as "no refund", never as a refund. Pinned in Task 5.
4. **History row the UI does not know** — an event with an unknown `type` or a `details` object missing the expected field (older row, future type) must render a fallback line, not crash the tab. Pinned in Task 6 (`SubscriptionEventList` test).
5. **Non-integer or empty package size typed in the form** — `2.5`, `0`, `51`, empty. Save stays disabled or shows `validation.programCountRange`; nothing is submitted. Pinned in Task 6 (modal test) and Task 3 (schema test).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/subscriptions.ts` | pure types + logic: summary union, programs status, labels, overview ordering | 1, 2 |
| `src/components/SubscriptionStatusBadge.tsx`, `SubscriptionStatusIcon.tsx` | render a summary of either kind | 1 |
| `src/app/trainer/trainees/[id]/_subscription-alert.tsx` | profile banner for either kind | 1 |
| `src/app/trainer/subscriptions/_content.tsx` | subscriptions page row for either kind | 1 |
| `src/lib/trainer-dashboard/subscription-alerts.ts`, `_widgets/SubscriptionAlertsWidget.tsx` | dashboard alerts for either kind | 1 |
| `prisma/schema.prisma`, `prisma/migrations/20261010000000_add_program_package_renewals/migration.sql` | `kind`, `programCount`, ledger and log tables | 2 |
| `src/lib/subscription-queries.ts` | `getCurrentSummaries` (batch, no N+1) | 2 |
| `tests/helpers/subscription-mock.ts` | shared Prisma arrangement for the three summary queries | 2 |
| `src/schemas/subscription-renewal.ts` | Zod union on `kind` | 3 |
| `src/lib/subscription-events.ts` | write + list log rows | 3 |
| `src/app/api/subscription-renewals/_data.ts` | renewal row data + event snapshot builders | 3 |
| `src/app/api/subscription-renewals/route.ts`, `[id]/route.ts` | union CRUD, events, balance | 2, 3 |
| `src/lib/program-credits.ts` | consume on publish, settle on delete | 4, 5 |
| `src/app/api/programs/[id]/publish/route.ts` | transactional publish + consumption | 4 |
| `src/app/api/programs/[id]/route.ts`, `src/app/api/programs/route.ts` | delete with refund choice, `consumedCredit` in list | 5 |
| `src/components/SubscriptionRenewalFormModal.tsx` | months / programs toggle | 6 |
| `src/components/SubscriptionEventList.tsx` | movements history | 6 |
| `src/app/trainer/trainees/[id]/_subscription-tab.tsx`, `_use-trainee-subscription.ts` | mixed history table, balance, movements | 6 |
| `src/app/trainer/programs/[id]/publish/_content.tsx` | balance info + uncovered confirmation | 7 |
| `src/components/ProgramCreditRefundModal.tsx` | refund / keep / cancel popup | 8 |
| `src/app/trainer/programs/_content.tsx`, `src/app/trainer/trainees/[id]/_content.tsx` | delete flow with refund popup | 8 |
| `tests/e2e/trainer-program-packages.spec.ts` | end-to-end flow | 9 |

---

### Task 1: Summary union, programs status and every summary renderer

After this task the app can *display* a programs summary everywhere; the API still only produces period summaries (now tagged `kind: 'period'`).

**Files:**
- Modify: `src/lib/subscriptions.ts`
- Modify: `src/lib/subscription-queries.ts` (one-function adapter)
- Modify: `src/components/SubscriptionStatusBadge.tsx`, `src/components/SubscriptionStatusIcon.tsx`
- Modify: `src/app/trainer/trainees/[id]/_subscription-alert.tsx`
- Modify: `src/app/trainer/subscriptions/_content.tsx`
- Modify: `src/lib/trainer-dashboard/subscription-alerts.ts`, `src/app/trainer/dashboard/_widgets/SubscriptionAlertsWidget.tsx`
- Modify: `public/locales/it/trainer.json`, `public/locales/en/trainer.json`
- Test: `tests/unit/lib/subscriptions.test.ts`, `tests/unit/subscription-status-badge.test.tsx`, `tests/unit/subscription-status-icon.test.tsx`, `tests/unit/trainer-subscription-alert.test.tsx`, `tests/unit/trainer-subscriptions-content.test.tsx`, `tests/unit/trainer-dashboard/subscription-alerts.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (all from `@/lib/subscriptions`):
  - `type RenewalKind = 'period' | 'programs'`
  - `interface PeriodSummary { kind: 'period'; status: 'active' | 'expiring' | 'expired'; endDate: string; daysLeft: number }`
  - `interface ProgramsSummary { kind: 'programs'; status: 'active' | 'expiring' | 'expired'; remaining: number }`
  - `type SubscriptionSummary = PeriodSummary | ProgramsSummary`
  - `toSubscriptionSummary(endDate: Date | string | null, today: Date): PeriodSummary | null`
  - `toProgramsSummary(remaining: number): ProgramsSummary`
  - `interface SummaryInput { mode: RenewalKind | null; endDate: Date | string | null; purchased: number; used: number }`
  - `resolveSummary(input: SummaryInput, today: Date): SubscriptionSummary | null`
  - `type UncoveredReason = 'none' | 'periodExpired' | 'programsExhausted'`
  - `uncoveredReason(summary: SubscriptionSummary | null): UncoveredReason | null`
  - `programsLabel(remaining: number): { key: string; count: number }`
  - `summaryLabel(summary: SubscriptionSummary): { key: string; count: number; date?: string }`
  - `compareOverviewItems(a: SubscribedOverviewItem, b: SubscribedOverviewItem): number`
  - `buildSubscriptionOverview(trainees: OverviewTrainee[], summaries: Map<string, SubscriptionSummary>): SubscriptionOverview` (the `today` parameter is gone)
  - constants `LAST_PROGRAM_THRESHOLD = 1`, `MIN_PROGRAM_COUNT = 1`, `MAX_PROGRAM_COUNT = 50`, `PROGRAM_COUNT_SHORTCUTS = [1, 3, 5, 10]`, `isValidProgramCount(value: number): boolean`
  - `SubscriptionAlert` (from `@/lib/trainer-dashboard/subscription-alerts`): `{ kind: RenewalKind; status: 'expired' | 'expiring'; traineeId: string; traineeName: string; value: number }` — `days` is renamed `value`.

- [ ] **Step 1: Write the failing lib tests**

Append to `tests/unit/lib/subscriptions.test.ts` (extend the existing import from `@/lib/subscriptions` with the new names):

```ts
describe('toSubscriptionSummary', () => {
    it('tags the summary as a period', () => {
        expect(toSubscriptionSummary(day('2026-10-10'), day('2026-10-03'))).toEqual({
            kind: 'period',
            status: 'expiring',
            endDate: '2026-10-10T00:00:00.000Z',
            daysLeft: 7,
        })
    })
})

describe('toProgramsSummary', () => {
    it.each([
        [5, 'active'],
        [2, 'active'],
        [1, 'expiring'],
        [0, 'expired'],
        [-2, 'expired'],
    ] as const)('balance %i is %s', (remaining, status) => {
        expect(toProgramsSummary(remaining)).toEqual({ kind: 'programs', status, remaining })
    })
})

describe('isValidProgramCount', () => {
    it.each([1, 50])('accepts %i', (value) => expect(isValidProgramCount(value)).toBe(true))
    it.each([0, 51, 2.5, NaN])('rejects %s', (value) => expect(isValidProgramCount(value)).toBe(false))
})

describe('resolveSummary', () => {
    const today = day('2026-10-03')

    it('returns null without a mode', () => {
        expect(resolveSummary({ mode: null, endDate: null, purchased: 0, used: 0 }, today)).toBeNull()
    })

    it('uses the balance in programs mode, ignoring any end date', () => {
        expect(resolveSummary({ mode: 'programs', endDate: day('2027-01-01'), purchased: 5, used: 4 }, today)).toEqual({
            kind: 'programs',
            status: 'expiring',
            remaining: 1,
        })
    })

    it('uses the end date in period mode, ignoring a leftover balance', () => {
        const summary = resolveSummary({ mode: 'period', endDate: day('2026-12-01'), purchased: 5, used: 2 }, today)

        expect(summary).toMatchObject({ kind: 'period', status: 'active' })
    })
})

describe('uncoveredReason', () => {
    it('is none without any renewal', () => expect(uncoveredReason(null)).toBe('none'))
    it('is periodExpired for an expired period', () =>
        expect(uncoveredReason({ kind: 'period', status: 'expired', endDate: '2026-09-01T00:00:00.000Z', daysLeft: -3 })).toBe('periodExpired'))
    it('is programsExhausted at balance 0', () => expect(uncoveredReason(toProgramsSummary(0))).toBe('programsExhausted'))
    it('is null when covered', () => {
        expect(uncoveredReason(toProgramsSummary(1))).toBeNull()
        expect(uncoveredReason({ kind: 'period', status: 'expiring', endDate: '2026-10-10T00:00:00.000Z', daysLeft: 7 })).toBeNull()
    })
})

describe('programsLabel', () => {
    it.each([
        [3, 'subscriptions.programs.available', 3],
        [1, 'subscriptions.programs.last', 1],
        [0, 'subscriptions.programs.exhausted', 0],
        [-2, 'subscriptions.programs.debt', 2],
    ] as const)('balance %i → %s', (remaining, key, count) => {
        expect(programsLabel(remaining)).toEqual({ key, count })
    })
})

describe('summaryLabel', () => {
    it('keeps the period badge key, date and days', () => {
        expect(summaryLabel({ kind: 'period', status: 'expired', endDate: '2026-09-01T00:00:00.000Z', daysLeft: -3 })).toEqual({
            key: 'subscriptions.badge.expired',
            count: -3,
            date: '2026-09-01T00:00:00.000Z',
        })
    })

    it('delegates programs to programsLabel', () => {
        expect(summaryLabel(toProgramsSummary(0))).toEqual({ key: 'subscriptions.programs.exhausted', count: 0 })
    })
})

describe('buildSubscriptionOverview with mixed kinds', () => {
    const trainees = [
        { id: 'a', firstName: 'Ada', lastName: 'Alfa' },
        { id: 'b', firstName: 'Bea', lastName: 'Beta' },
        { id: 'c', firstName: 'Cia', lastName: 'Gamma' },
        { id: 'd', firstName: 'Dea', lastName: 'Delta' },
        { id: 'e', firstName: 'Eva', lastName: 'Epsilon' },
    ]
    const period = (daysLeft: number): SubscriptionSummary => ({
        kind: 'period',
        status: daysLeft < 0 ? 'expired' : daysLeft <= 14 ? 'expiring' : 'active',
        endDate: '2026-10-10T00:00:00.000Z',
        daysLeft,
    })

    it('orders red, then amber, then active; period before programs inside a status', () => {
        const overview = buildSubscriptionOverview(
            trainees,
            new Map<string, SubscriptionSummary>([
                ['a', toProgramsSummary(4)],
                ['b', toProgramsSummary(1)],
                ['c', period(-2)],
                ['d', toProgramsSummary(-1)],
                ['e', period(5)],
            ])
        )

        expect(overview.withSubscription.map((item) => item.traineeId)).toEqual(['c', 'd', 'e', 'b', 'a'])
        expect(overview.counts).toEqual({ expired: 2, expiring: 2, active: 1, none: 0 })
    })
})
```

Then update the three existing `buildSubscriptionOverview` tests in the same file: they call `buildSubscriptionOverview(trainees, endDates, today)`. Convert the `endDates` map with this helper, declared at the top of that `describe`, and drop the third argument:

```ts
const summariesOf = (endDates: Map<string, Date>, today: Date) => {
    const summaries = new Map<string, SubscriptionSummary>()
    for (const [id, end] of endDates) summaries.set(id, toSubscriptionSummary(end, today)!)
    return summaries
}
// before: buildSubscriptionOverview(trainees, endDates, today)
// after:  buildSubscriptionOverview(trainees, summariesOf(endDates, today))
```

In the existing `toSubscriptionSummary` tests, any `toEqual({ status, endDate, daysLeft })` gains `kind: 'period'`.

- [ ] **Step 2: Run the lib tests to verify they fail**

Run: `npx vitest run tests/unit/lib/subscriptions.test.ts`
Expected: FAIL — `toProgramsSummary is not a function` (and the other new names).

- [ ] **Step 3: Implement the lib changes**

In `src/lib/subscriptions.ts`:

Replace the constants block and the `SubscriptionSummary` interface with:

```ts
export const EXPIRING_THRESHOLD_DAYS = 14
export const MIN_DURATION_MONTHS = 1
export const MAX_DURATION_MONTHS = 36
export const DURATION_SHORTCUTS = [1, 3, 6, 12] as const

/** Programs mode: the balance at which the trainer gets the amber "last program" warning */
export const LAST_PROGRAM_THRESHOLD = 1
export const MIN_PROGRAM_COUNT = 1
export const MAX_PROGRAM_COUNT = 50
export const PROGRAM_COUNT_SHORTCUTS = [1, 3, 5, 10] as const

const DAY_MS = 24 * 60 * 60 * 1000

export type SubscriptionStatus = 'none' | 'active' | 'expiring' | 'expired'
export type RenewalKind = 'period' | 'programs'

type RecordedStatus = Exclude<SubscriptionStatus, 'none'>

export interface PeriodSummary {
    kind: 'period'
    status: RecordedStatus
    /** ISO string of the current expiry day */
    endDate: string
    /** Negative when expired */
    daysLeft: number
}

export interface ProgramsSummary {
    kind: 'programs'
    status: RecordedStatus
    /** Programs still available; negative = programs published on credit */
    remaining: number
}

export type SubscriptionSummary = PeriodSummary | ProgramsSummary
```

Change `statusFromDaysLeft` return type to `RecordedStatus`, and `toSubscriptionSummary` to:

```ts
/** Period summary. null means "no end date recorded". */
export function toSubscriptionSummary(endDate: Date | string | null, today: Date): PeriodSummary | null {
    if (!endDate) return null
    const end = toSubscriptionDay(new Date(endDate))
    const daysLeft = daysBetween(today, end)
    return { kind: 'period', status: statusFromDaysLeft(daysLeft), endDate: end.toISOString(), daysLeft }
}
```

Add after it:

```ts
export function isValidProgramCount(value: number): boolean {
    return Number.isInteger(value) && value >= MIN_PROGRAM_COUNT && value <= MAX_PROGRAM_COUNT
}

/** Programs summary: red when nothing is left (or owed), amber on the last program. */
export function toProgramsSummary(remaining: number): ProgramsSummary {
    let status: RecordedStatus = 'active'
    if (remaining <= 0) status = 'expired'
    else if (remaining <= LAST_PROGRAM_THRESHOLD) status = 'expiring'
    return { kind: 'programs', status, remaining }
}

export interface SummaryInput {
    /** kind of the most recently registered renewal, null when there is none */
    mode: RenewalKind | null
    endDate: Date | string | null
    purchased: number
    used: number
}

/** The two modes are mutually exclusive: the current one decides which numbers matter. */
export function resolveSummary(input: SummaryInput, today: Date): SubscriptionSummary | null {
    if (input.mode === 'programs') return toProgramsSummary(input.purchased - input.used)
    if (input.mode === 'period') return toSubscriptionSummary(input.endDate, today)
    return null
}

export type UncoveredReason = 'none' | 'periodExpired' | 'programsExhausted'

/** Why a publish would happen without coverage; null when the trainee is covered. */
export function uncoveredReason(summary: SubscriptionSummary | null): UncoveredReason | null {
    if (!summary) return 'none'
    if (summary.status !== 'expired') return null
    return summary.kind === 'programs' ? 'programsExhausted' : 'periodExpired'
}

/** i18n key + count for a program balance. */
export function programsLabel(remaining: number): { key: string; count: number } {
    if (remaining < 0) return { key: 'subscriptions.programs.debt', count: -remaining }
    if (remaining === 0) return { key: 'subscriptions.programs.exhausted', count: 0 }
    if (remaining <= LAST_PROGRAM_THRESHOLD) return { key: 'subscriptions.programs.last', count: remaining }
    return { key: 'subscriptions.programs.available', count: remaining }
}

/** Short status text of either kind: key, count (days or programs) and, for a period, the expiry date. */
export function summaryLabel(summary: SubscriptionSummary): { key: string; count: number; date?: string } {
    if (summary.kind === 'programs') return programsLabel(summary.remaining)
    return { key: `subscriptions.badge.${summary.status}`, count: summary.daysLeft, date: summary.endDate }
}
```

Replace `buildSubscriptionOverview` (keep `compareByName` and `isSubscribed` as they are) with:

```ts
const STATUS_ORDER: Record<RecordedStatus, number> = { expired: 0, expiring: 1, active: 2 }
const KIND_ORDER: Record<RenewalKind, number> = { period: 0, programs: 1 }

function urgency(summary: SubscriptionSummary): number {
    return summary.kind === 'period' ? summary.daysLeft : summary.remaining
}

/** Red first, then amber, then active; inside a status periods before packages, most urgent first. */
export function compareOverviewItems(a: SubscribedOverviewItem, b: SubscribedOverviewItem): number {
    return (
        STATUS_ORDER[a.subscription.status] - STATUS_ORDER[b.subscription.status] ||
        KIND_ORDER[a.subscription.kind] - KIND_ORDER[b.subscription.kind] ||
        urgency(a.subscription) - urgency(b.subscription) ||
        compareByName(a, b)
    )
}

export function buildSubscriptionOverview(
    trainees: OverviewTrainee[],
    summaries: Map<string, SubscriptionSummary>
): SubscriptionOverview {
    const items: SubscriptionOverviewItem[] = trainees.map((trainee) => ({
        traineeId: trainee.id,
        firstName: trainee.firstName,
        lastName: trainee.lastName,
        subscription: summaries.get(trainee.id) ?? null,
    }))

    const withSubscription = items.filter(isSubscribed).sort(compareOverviewItems)
    const withoutSubscription = items.filter((item) => !isSubscribed(item)).sort(compareByName)

    const counts: Record<SubscriptionStatus, number> = { expired: 0, expiring: 0, active: 0, none: withoutSubscription.length }
    for (const item of withSubscription) counts[item.subscription.status] += 1

    return { withSubscription, withoutSubscription, counts }
}
```

In `src/lib/subscription-queries.ts`, replace the body of `getTrainerSubscriptionOverview` after `const endDates = …` (import `toSubscriptionSummary` and `type SubscriptionSummary` from `@/lib/subscriptions`):

```ts
    const endDates = await getCurrentEndDates(trainees.map((trainee) => trainee.id))
    const summaries = new Map<string, SubscriptionSummary>()
    for (const [traineeId, endDate] of endDates) {
        const summary = toSubscriptionSummary(endDate, today)
        if (summary) summaries.set(traineeId, summary)
    }
    return buildSubscriptionOverview(trainees, summaries)
```

- [ ] **Step 4: Run the lib tests to verify they pass**

Run: `npx vitest run tests/unit/lib/subscriptions.test.ts tests/unit/lib/subscription-queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing renderer tests**

Add to `tests/unit/subscription-status-badge.test.tsx`:

```tsx
    it.each([
        [3, 'active', 'subscriptions.programs.available'],
        [1, 'expiring', 'subscriptions.programs.last'],
        [0, 'expired', 'subscriptions.programs.exhausted'],
        [-2, 'expired', 'subscriptions.programs.debt'],
    ] as const)('renders a program balance of %i as %s', (remaining, status, key) => {
        render(<SubscriptionStatusBadge summary={{ kind: 'programs', status, remaining }} />)

        expect(screen.getByText(key).closest('[data-status]')).toHaveAttribute('data-status', status)
    })
```

Add to `tests/unit/subscription-status-icon.test.tsx`:

```tsx
    it('describes a program balance without a date', () => {
        render(<SubscriptionStatusIcon summary={{ kind: 'programs', status: 'expired', remaining: 0 }} />)

        expect(screen.getByRole('img')).toHaveAccessibleName('subscriptions.programs.exhausted')
        expect(screen.getByRole('img')).toHaveAttribute('data-status', 'expired')
    })
```

Add to `tests/unit/trainer-subscription-alert.test.tsx` (reuse that file's existing render helper / `onManage` mock names):

```tsx
    it('warns in amber on the last program', () => {
        render(<SubscriptionAlertBanner summary={{ kind: 'programs', status: 'expiring', remaining: 1 }} onManage={vi.fn()} />)

        const banner = screen.getByRole('alert')
        expect(banner).toHaveTextContent('subscriptions.programs.last')
        expect(banner.className).toContain('amber')
    })

    it('warns in red when programs are exhausted', () => {
        render(<SubscriptionAlertBanner summary={{ kind: 'programs', status: 'expired', remaining: -1 }} onManage={vi.fn()} />)

        const banner = screen.getByRole('alert')
        expect(banner).toHaveTextContent('subscriptions.programs.debt')
        expect(banner.className).toContain('red')
    })

    it('stays hidden while programs are available', () => {
        const { container } = render(
            <SubscriptionAlertBanner summary={{ kind: 'programs', status: 'active', remaining: 4 }} onManage={vi.fn()} />
        )

        expect(container).toBeEmptyDOMElement()
    })
```

Add to `tests/unit/trainer-subscriptions-content.test.tsx`:

```tsx
    it('shows the balance instead of a date for a package trainee', () => {
        render(
            <TrainerSubscriptionsContent
                overview={{
                    withSubscription: [
                        { traineeId: 'p1', firstName: 'Pia', lastName: 'Verdi', subscription: { kind: 'programs', status: 'expiring', remaining: 1 } },
                    ],
                    withoutSubscription: [],
                    counts: { expired: 0, expiring: 1, active: 0, none: 0 },
                }}
            />
        )

        const row = screen.getByRole('link', { name: /Pia Verdi/ })
        expect(within(row).getAllByText('subscriptions.programs.last').length).toBeGreaterThan(0)
        expect(within(row).getByText('—')).toBeInTheDocument()
    })
```

(import `within` from `@testing-library/react` if the file does not already.)

Add to `tests/unit/trainer-dashboard/subscription-alerts.test.ts`:

```ts
    it('reports package trainees with their balance as value', async () => {
        arrange([
            { traineeId: 'p1', firstName: 'Pia', lastName: 'X', subscription: { kind: 'programs', status: 'expired', remaining: -2 } },
            { traineeId: 'p2', firstName: 'Lia', lastName: 'X', subscription: { kind: 'programs', status: 'expiring', remaining: 1 } },
        ])

        await expect(getSubscriptionAlerts('trainer-1', TRAINEES, NOW)).resolves.toEqual([
            { kind: 'programs', status: 'expired', traineeId: 'p1', traineeName: 'Pia X', value: 2 },
            { kind: 'programs', status: 'expiring', traineeId: 'p2', traineeName: 'Lia X', value: 1 },
        ])
    })
```

In the same file: the `subscribed()` fixture gains `kind: 'period' as const` inside `subscription`, and every expected alert object changes `days: N` to `kind: 'period', … value: N`.

- [ ] **Step 6: Run the renderer tests to verify they fail**

Run: `npx vitest run tests/unit/subscription-status-badge.test.tsx tests/unit/subscription-status-icon.test.tsx tests/unit/trainer-subscription-alert.test.tsx tests/unit/trainer-subscriptions-content.test.tsx tests/unit/trainer-dashboard/subscription-alerts.test.ts`
Expected: FAIL on the new cases (text not found / `value` undefined).

- [ ] **Step 7: Implement the renderers**

`src/components/SubscriptionStatusBadge.tsx` — replace the `label` computation and the import:

```tsx
import { summaryLabel, type SubscriptionStatus, type SubscriptionSummary } from '@/lib/subscriptions'
```

```tsx
    const Icon = ICONS[status]
    let label = t('subscriptions.badge.none')
    if (summary) {
        const { key, count, date } = summaryLabel(summary)
        label = t(key, { count, days: count, date: date ? formatDate(date) : undefined })
    }
```

`src/components/SubscriptionStatusIcon.tsx` — import `summaryLabel` alongside `remainingLabel` and replace the `description` block:

```tsx
    let description = t('subscriptions.badge.none')
    if (summary) {
        const { key, count, date } = summaryLabel(summary)
        description = t(key, { count, days: count, date: date ? formatDate(date) : undefined })
        if (summary.kind === 'period') {
            const remaining = remainingLabel(summary.daysLeft)
            description = `${description} · ${t(remaining.key, { count: remaining.count })}`
        }
    }
```

`src/app/trainer/trainees/[id]/_subscription-alert.tsx` — import `programsLabel` too and replace everything between the `needsAttention` guard and the `return`:

```tsx
    const expired = summary.status === 'expired'
    let message: string
    if (summary.kind === 'programs') {
        const label = programsLabel(summary.remaining)
        message = t(label.key, { count: label.count })
    } else {
        const date = formatDate(summary.endDate)
        const remaining = remainingLabel(summary.daysLeft)
        message = expired
            ? t('subscriptions.banner.expired', { date })
            : t('subscriptions.banner.expiring', { date, remaining: t(remaining.key, { count: remaining.count }) })
    }
```

`src/app/trainer/subscriptions/_content.tsx` — import `programsLabel`; in `SubscriptionRow` replace the `remaining` constant and the two text cells:

```tsx
    const { subscription } = item
    let endText = '—'
    let remainingText = '—'
    if (subscription?.kind === 'period') {
        const remaining = remainingLabel(subscription.daysLeft)
        endText = formatDate(subscription.endDate)
        remainingText = t(remaining.key, { count: remaining.count })
    } else if (subscription?.kind === 'programs') {
        const label = programsLabel(subscription.remaining)
        remainingText = t(label.key, { count: label.count })
    }
```

```tsx
                <span className="text-sm text-gray-700">{endText}</span>
                <span className="text-sm text-gray-600">{remainingText}</span>
```

`src/lib/trainer-dashboard/subscription-alerts.ts` — full new content:

```ts
import { getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { compareOverviewItems, needsAttention, type RenewalKind } from '@/lib/subscriptions'
import { startOfUtcDay } from './dates'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export interface SubscriptionAlert {
    kind: RenewalKind
    status: 'expired' | 'expiring'
    traineeId: string
    traineeName: string
    /** period: days since expiry / days left. programs: programs owed (0 = just exhausted) / programs left */
    value: number
}

export async function getSubscriptionAlerts(
    trainerId: string,
    trainees: DashboardTrainee[],
    now: Date,
): Promise<SubscriptionAlert[]> {
    if (activeTraineeIds(trainees).length === 0) return []

    const overview = await getTrainerSubscriptionOverview(trainerId, startOfUtcDay(now))

    // Same order as the subscriptions page: red first, then amber, most urgent first
    return overview.withSubscription
        .filter((entry) => needsAttention(entry.subscription))
        .sort((left, right) => compareOverviewItems(left, right) || fullName(left).localeCompare(fullName(right)))
        .map((entry) => ({
            kind: entry.subscription.kind,
            status: entry.subscription.status === 'expired' ? 'expired' : 'expiring',
            traineeId: entry.traineeId,
            traineeName: fullName(entry),
            value: Math.abs(
                entry.subscription.kind === 'period' ? entry.subscription.daysLeft : entry.subscription.remaining
            ),
        }))
}
```

`src/app/trainer/dashboard/_widgets/SubscriptionAlertsWidget.tsx` — add above the component, and use it in place of the inline `t(...)` in the list item:

```tsx
function alertText(t: WidgetContext['t'], item: SubscriptionAlert): string {
    if (item.kind === 'programs') {
        if (item.status === 'expiring') return t('trainerDashboard.subscriptionAlerts.programsLast')
        return item.value === 0
            ? t('trainerDashboard.subscriptionAlerts.programsExhausted')
            : t('trainerDashboard.subscriptionAlerts.programsDebt', { count: item.value })
    }
    return t(`trainerDashboard.subscriptionAlerts.${item.status}`, { count: item.value })
}
```

```tsx
                                        <p className="text-sm text-gray-600">{alertText(t, item)}</p>
```

- [ ] **Step 8: Add the i18n keys**

`public/locales/it/trainer.json`, inside `"subscriptions"` (add as a sibling of `"badge"`):

```json
"programs": {
    "available_one": "{{count}} scheda disponibile",
    "available_other": "{{count}} schede disponibili",
    "last": "Ultima scheda disponibile",
    "exhausted": "Schede esaurite",
    "debt_one": "In debito di {{count}} scheda",
    "debt_other": "In debito di {{count}} schede"
},
```

and change, inside `"subscriptions"."page"."counters"`: `"expired": "Scaduti / esauriti"`, `"expiring": "In scadenza / ultima scheda"`.

Inside `"trainerDashboard"."subscriptionAlerts"` add:

```json
"programsLast": "Ultima scheda disponibile",
"programsExhausted": "Schede esaurite",
"programsDebt": "In debito di {{count}} schede",
"programsDebt_one": "In debito di 1 scheda"
```

`public/locales/en/trainer.json`, same positions:

```json
"programs": {
    "available_one": "{{count}} program available",
    "available_other": "{{count}} programs available",
    "last": "Last program available",
    "exhausted": "No programs left",
    "debt_one": "{{count}} program owed",
    "debt_other": "{{count}} programs owed"
},
```

counters: `"expired": "Expired / exhausted"`, `"expiring": "Expiring / last program"`; dashboard:

```json
"programsLast": "Last program available",
"programsExhausted": "No programs left",
"programsDebt": "{{count}} programs owed",
"programsDebt_one": "1 program owed"
```

- [ ] **Step 9: Tag the remaining period fixtures**

Run: `npm run type-check` and `npm run test:unit`.
Every failure left is a period summary fixture or expectation without the discriminator. In each reported file add `kind: 'period'` to the summary literal (fixtures) or to the expected object (`toEqual`). Expected locations: `tests/unit/subscription-status-badge.test.tsx`, `subscription-status-icon.test.tsx`, `trainer-subscription-alert.test.tsx`, `trainer-subscriptions-content.test.tsx`, `trainer-subscription-tab.test.tsx`, `trainer-use-trainee-subscription.test.tsx`, `trainer-trainees-list-subscription.test.tsx`, `tests/unit/trainer-dashboard/widgets-*.test.tsx` (alerts: `days` → `kind: 'period'` + `value`), `tests/integration/subscription-renewals.test.ts` (`body.data.current`), `tests/integration/users.test.ts` (`subscription`).
In `src/app/trainer/trainees/[id]/_subscription-tab.tsx` the modal default becomes:

```tsx
defaultStartDate={nextRenewalStart(current?.kind === 'period' ? current.endDate : null, getTodayForInput())}
```

- [ ] **Step 10: Verify everything is green**

Run: `npm run type-check && npm run lint && npm run test:unit`
Expected: no type errors, no lint errors, all unit and integration tests PASS.

- [ ] **Step 11: Commit**

```bash
git add src/lib src/components src/app/trainer public/locales tests implementation-docs/CHANGELOG.md
git commit -m "feat(subscriptions): summary union with program-balance status across alert surfaces"
```

---

### Task 2: Database schema, migration and batch summary queries

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261010000000_add_program_package_renewals/migration.sql`
- Modify: `src/lib/subscriptions.ts` (add `summarizeRenewals`, remove `latestEndDate`)
- Modify: `src/lib/subscription-queries.ts`
- Modify: `src/app/api/subscription-renewals/route.ts` (GET only)
- Modify: `src/app/api/users/route.ts`
- Create: `tests/helpers/subscription-mock.ts`
- Test: `tests/unit/lib/subscriptions.test.ts`, `tests/unit/lib/subscription-queries.test.ts`, `tests/integration/subscription-renewals.test.ts`, `tests/integration/users.test.ts`

**Interfaces:**
- Consumes: `resolveSummary`, `SummaryInput`, `buildSubscriptionOverview`, `SubscriptionSummary`, `RenewalKind` (Task 1).
- Produces:
  - Prisma models `ProgramCreditUsage` (`prisma.programCreditUsage`), `SubscriptionEvent` (`prisma.subscriptionEvent`), enums `RenewalKind`, `SubscriptionEventType`; `SubscriptionRenewal.kind`, `.programCount`; `durationMonths` / `endDate` nullable; `TrainingProgram.creditUsage`.
  - `summarizeRenewals(rows: RenewalFacts[], used: number): SummaryInput` with `interface RenewalFacts { kind: RenewalKind; endDate: Date | null; programCount: number | null; createdAt: Date }` (from `@/lib/subscriptions`).
  - `getCurrentSummaries(traineeIds: string[], today: Date): Promise<Map<string, SubscriptionSummary>>` (from `@/lib/subscription-queries`); `getCurrentEndDates` is removed.
  - `GET /api/subscription-renewals?traineeId=` → `{ items, current, programBalance: number }`.
  - Test helper `mockSummaryQueries({ latest, totals, usages })` from `tests/helpers/subscription-mock.ts`.

- [ ] **Step 1: Edit the Prisma schema**

In `prisma/schema.prisma`:

Add next to the other enums:

```prisma
enum RenewalKind {
  period
  programs
}

enum SubscriptionEventType {
  period_renewal_created
  package_created
  renewal_updated
  renewal_deleted
  credit_consumed
  credit_refunded
  credit_forfeited
}
```

Replace the `SubscriptionRenewal` model:

```prisma
model SubscriptionRenewal {
  id             String      @id @default(uuid())
  traineeId      String
  kind           RenewalKind @default(period)
  startDate      DateTime    @db.Date  // period: first covered day; programs: purchase date
  durationMonths Int?                  // period only
  endDate        DateTime?   @db.Date  // period only, computed server-side: startDate + durationMonths (clamped to month end)
  programCount   Int?                  // programs only: programs bought with this package
  createdBy      String                // trainer who entered the renewal (audit)
  createdAt      DateTime    @default(now())

  // Relations
  trainee User @relation("TraineeRenewals", fields: [traineeId], references: [id], onDelete: Cascade)
  creator User @relation("CreatedRenewals", fields: [createdBy], references: [id])

  // No uniqueness: overlapping renewals are allowed, the current expiry is MAX(endDate).
  // The current mode is the kind of the latest createdAt.
  @@index([traineeId, endDate])
  @@index([traineeId, createdAt])
  @@map("subscription_renewals")
}

/// Ledger: one row per publish that consumed a program credit. Balance = SUM(programCount) - COUNT(rows).
model ProgramCreditUsage {
  id        String   @id @default(uuid())
  traineeId String
  programId String?  @unique  // SetNull: the usage survives a program deleted without refund
  createdBy String
  createdAt DateTime @default(now())

  trainee User             @relation("TraineeCreditUsages", fields: [traineeId], references: [id], onDelete: Cascade)
  program TrainingProgram? @relation("ProgramCreditUsage", fields: [programId], references: [id], onDelete: SetNull)
  creator User             @relation("CreatedCreditUsages", fields: [createdBy], references: [id])

  @@index([traineeId])
  @@map("program_credit_usages")
}

/// Append-only history shown to the trainer. Never updated, never read for calculations.
model SubscriptionEvent {
  id          String                @id @default(uuid())
  traineeId   String
  type        SubscriptionEventType
  creditDelta Int?                  // +N package, -1 consumed, +1 refunded, signed diff on package edit/delete
  renewalId   String?               // no FK: the row outlives the renewal
  programId   String?               // no FK: the row outlives the program
  details     Json
  actorId     String
  createdAt   DateTime              @default(now())

  trainee User @relation("TraineeSubscriptionEvents", fields: [traineeId], references: [id], onDelete: Cascade)
  actor   User @relation("ActedSubscriptionEvents", fields: [actorId], references: [id])

  @@index([traineeId, createdAt])
  @@map("subscription_events")
}
```

In `model User`, after the `createdRenewals` line add:

```prisma
  creditUsages              ProgramCreditUsage[]         @relation("TraineeCreditUsages")
  createdCreditUsages       ProgramCreditUsage[]         @relation("CreatedCreditUsages")
  subscriptionEvents        SubscriptionEvent[]          @relation("TraineeSubscriptionEvents")
  actedSubscriptionEvents   SubscriptionEvent[]          @relation("ActedSubscriptionEvents")
```

In `model TrainingProgram`, after the `workoutSkeletons` relation add:

```prisma
  creditUsage ProgramCreditUsage? @relation("ProgramCreditUsage")
```

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/20261010000000_add_program_package_renewals/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "RenewalKind" AS ENUM ('period', 'programs');

-- CreateEnum
CREATE TYPE "SubscriptionEventType" AS ENUM ('period_renewal_created', 'package_created', 'renewal_updated', 'renewal_deleted', 'credit_consumed', 'credit_refunded', 'credit_forfeited');

-- AlterTable: existing rows are period renewals (column default), no backfill needed
ALTER TABLE "subscription_renewals"
    ADD COLUMN "kind" "RenewalKind" NOT NULL DEFAULT 'period',
    ADD COLUMN "programCount" INTEGER,
    ALTER COLUMN "durationMonths" DROP NOT NULL,
    ALTER COLUMN "endDate" DROP NOT NULL;

-- A row carries the fields of its own kind only
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_kind_fields_check" CHECK (
    ("kind" = 'period' AND "durationMonths" IS NOT NULL AND "endDate" IS NOT NULL AND "programCount" IS NULL)
    OR
    ("kind" = 'programs' AND "programCount" IS NOT NULL AND "durationMonths" IS NULL AND "endDate" IS NULL)
);

-- CreateIndex
CREATE INDEX "subscription_renewals_traineeId_createdAt_idx" ON "subscription_renewals"("traineeId", "createdAt");

-- CreateTable
CREATE TABLE "program_credit_usages" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "programId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_credit_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "type" "SubscriptionEventType" NOT NULL,
    "creditDelta" INTEGER,
    "renewalId" TEXT,
    "programId" TEXT,
    "details" JSONB NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "program_credit_usages_programId_key" ON "program_credit_usages"("programId");

-- CreateIndex
CREATE INDEX "program_credit_usages_traineeId_idx" ON "program_credit_usages"("traineeId");

-- CreateIndex
CREATE INDEX "subscription_events_traineeId_createdAt_idx" ON "subscription_events"("traineeId", "createdAt");

-- AddForeignKey
ALTER TABLE "program_credit_usages" ADD CONSTRAINT "program_credit_usages_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_credit_usages" ADD CONSTRAINT "program_credit_usages_programId_fkey" FOREIGN KEY ("programId") REFERENCES "training_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_credit_usages" ADD CONSTRAINT "program_credit_usages_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Validate the schema and regenerate the client**

Run: `npx prisma validate && npm run prisma:generate`
Expected: "The schema at prisma/schema.prisma is valid" and a generated client.

If a development database is reachable (`DIRECT_URL` set), also run `npx prisma migrate dev`. Expected: the migration `20261010000000_add_program_package_renewals` is applied and Prisma reports the schema in sync. If Prisma proposes to create an *additional* migration, the hand-written SQL differs from the schema: fix the SQL file, do not accept the extra migration. If no database is reachable, say so in the task report — do not skip silently.

- [ ] **Step 4: Write the failing tests**

Create `tests/helpers/subscription-mock.ts`:

```ts
import type { Mock } from 'vitest'
import { prismaMock } from './prisma-mock'

interface SummaryQueryRows {
    /** one row per trainee: the kind of the latest registered renewal */
    latest?: { traineeId: string; kind: 'period' | 'programs' }[]
    totals?: { traineeId: string; _max: { endDate: Date | null }; _sum: { programCount: number | null } }[]
    usages?: { traineeId: string; _count: { _all: number } }[]
}

/** Arranges the three aggregate queries behind getCurrentSummaries(). */
export function mockSummaryQueries({ latest = [], totals = [], usages = [] }: SummaryQueryRows = {}): void {
    prismaMock.subscriptionRenewal.findMany.mockResolvedValue(latest as never)
    // Prisma's groupBy generics defeat the deep mock's typing: treat them as plain mocks
    ;(prismaMock.subscriptionRenewal.groupBy as unknown as Mock).mockResolvedValue(totals)
    ;(prismaMock.programCreditUsage.groupBy as unknown as Mock).mockResolvedValue(usages)
}
```

Replace the content of `tests/unit/lib/subscription-queries.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getCurrentSummaries, getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { prismaMock } from '../../helpers/prisma-mock'
import { mockSummaryQueries } from '../../helpers/subscription-mock'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const TODAY = day('2026-10-03')

describe('getCurrentSummaries', () => {
    it('returns an empty map without querying when there are no trainees', async () => {
        const result = await getCurrentSummaries([], TODAY)

        expect(result.size).toBe(0)
        expect(prismaMock.subscriptionRenewal.findMany).not.toHaveBeenCalled()
    })

    it('reads the mode from the latest registered renewal of each trainee', async () => {
        mockSummaryQueries()

        await getCurrentSummaries(['t1', 't2'], TODAY)

        expect(prismaMock.subscriptionRenewal.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2'] } },
            orderBy: { createdAt: 'desc' },
            distinct: ['traineeId'],
            select: { traineeId: true, kind: true },
        })
    })

    it('builds a period summary, a programs summary and skips trainees without renewals', async () => {
        mockSummaryQueries({
            latest: [
                { traineeId: 't1', kind: 'period' },
                { traineeId: 't2', kind: 'programs' },
            ],
            totals: [
                { traineeId: 't1', _max: { endDate: day('2026-10-10') }, _sum: { programCount: null } },
                { traineeId: 't2', _max: { endDate: null }, _sum: { programCount: 5 } },
            ],
            usages: [{ traineeId: 't2', _count: { _all: 4 } }],
        })

        const result = await getCurrentSummaries(['t1', 't2', 't3'], TODAY)

        expect(result.get('t1')).toEqual({ kind: 'period', status: 'expiring', endDate: '2026-10-10T00:00:00.000Z', daysLeft: 7 })
        expect(result.get('t2')).toEqual({ kind: 'programs', status: 'expiring', remaining: 1 })
        expect(result.has('t3')).toBe(false)
    })

    it('ignores a leftover package balance when the latest renewal is a period', async () => {
        mockSummaryQueries({
            latest: [{ traineeId: 't1', kind: 'period' }],
            totals: [{ traineeId: 't1', _max: { endDate: day('2026-12-01') }, _sum: { programCount: 5 } }],
            usages: [{ traineeId: 't1', _count: { _all: 2 } }],
        })

        const result = await getCurrentSummaries(['t1'], TODAY)

        expect(result.get('t1')).toMatchObject({ kind: 'period', status: 'active' })
    })

    it('goes into debt when more programs were published than bought', async () => {
        mockSummaryQueries({
            latest: [{ traineeId: 't1', kind: 'programs' }],
            totals: [{ traineeId: 't1', _max: { endDate: null }, _sum: { programCount: 2 } }],
            usages: [{ traineeId: 't1', _count: { _all: 4 } }],
        })

        const result = await getCurrentSummaries(['t1'], TODAY)

        expect(result.get('t1')).toEqual({ kind: 'programs', status: 'expired', remaining: -2 })
    })
})

describe('getTrainerSubscriptionOverview', () => {
    it("builds the overview from the trainer's active trainees only", async () => {
        prismaMock.trainerTrainee.findMany.mockResolvedValue([
            { trainee: { id: 't1', firstName: 'Anna', lastName: 'Rossi' } },
            { trainee: { id: 't2', firstName: 'Luca', lastName: 'Bianchi' } },
        ] as never)
        mockSummaryQueries({
            latest: [{ traineeId: 't1', kind: 'period' }],
            totals: [{ traineeId: 't1', _max: { endDate: day('2026-10-10') }, _sum: { programCount: null } }],
        })

        const overview = await getTrainerSubscriptionOverview('trainer-1', TODAY)

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

In `tests/unit/lib/subscriptions.test.ts`: delete the `describe('latestEndDate', …)` block (and its import) and add:

```ts
describe('summarizeRenewals', () => {
    const at = (iso: string) => new Date(iso)

    it('has no mode without renewals', () => {
        expect(summarizeRenewals([], 0)).toEqual({ mode: null, endDate: null, purchased: 0, used: 0 })
    })

    it('takes the mode from the latest registered row, whatever the row order', () => {
        const rows = [
            { kind: 'period' as const, endDate: day('2026-12-01'), programCount: null, createdAt: at('2026-09-01T10:00:00Z') },
            { kind: 'programs' as const, endDate: null, programCount: 5, createdAt: at('2026-10-01T10:00:00Z') },
            { kind: 'programs' as const, endDate: null, programCount: 3, createdAt: at('2026-08-01T10:00:00Z') },
        ]

        expect(summarizeRenewals(rows, 2)).toEqual({ mode: 'programs', endDate: day('2026-12-01'), purchased: 8, used: 2 })
    })

    it('keeps the furthest end date across period rows', () => {
        const rows = [
            { kind: 'period' as const, endDate: day('2026-10-10'), programCount: null, createdAt: at('2026-10-02T10:00:00Z') },
            { kind: 'period' as const, endDate: day('2026-11-10'), programCount: null, createdAt: at('2026-09-02T10:00:00Z') },
        ]

        expect(summarizeRenewals(rows, 0)).toMatchObject({ mode: 'period', endDate: day('2026-11-10') })
    })
})
```

In `tests/integration/subscription-renewals.test.ts`:
- `mockRenewal` gains `kind: 'period' as const` and `programCount: null`.
- In the first GET test, add `prismaMock.programCreditUsage.count.mockResolvedValue(0)` to every GET test that reaches the queries (or once in a `beforeEach` of the GET `describe`), and extend the first assertion with `expect(body.data.programBalance).toBe(0)`.
- Add:

```ts
    it('returns a programs summary and the balance for a package trainee', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findMany.mockResolvedValue([
            { ...mockRenewal, id: 'p-1', kind: 'programs', durationMonths: null, endDate: null, programCount: 5 },
        ] as never)
        prismaMock.programCreditUsage.count.mockResolvedValue(4)

        const body = await (await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))).json()

        expect(body.data.current).toEqual({ kind: 'programs', status: 'expiring', remaining: 1 })
        expect(body.data.programBalance).toBe(1)
        expect(prismaMock.programCreditUsage.count).toHaveBeenCalledWith({ where: { traineeId: TRAINEE_ID } })
    })
```

In `tests/integration/users.test.ts`: wherever the trainer-listing tests arrange `prismaMock.subscriptionRenewal.groupBy` for the subscription, replace that arrangement with `mockSummaryQueries({ latest: [{ traineeId: <id>, kind: 'period' }], totals: [{ traineeId: <id>, _max: { endDate: <same date as before> }, _sum: { programCount: null } }] })` (import from `../helpers/subscription-mock`), and where no subscription is expected call `mockSummaryQueries()`.

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/lib/subscription-queries.test.ts tests/unit/lib/subscriptions.test.ts tests/integration/subscription-renewals.test.ts`
Expected: FAIL — `getCurrentSummaries` / `summarizeRenewals` not exported, `programBalance` undefined.

- [ ] **Step 6: Implement**

`src/lib/subscriptions.ts` — delete `latestEndDate` and add:

```ts
/** What the summary needs from a renewal row, of either kind. */
export interface RenewalFacts {
    kind: RenewalKind
    endDate: Date | null
    programCount: number | null
    createdAt: Date
}

/**
 * Folds a trainee's renewals into the summary input: the mode is the kind of the
 * latest registered row, the expiry is the furthest end date (a back-dated
 * correction never shortens it), the purchased programs add up across packages.
 */
export function summarizeRenewals(rows: RenewalFacts[], used: number): SummaryInput {
    let latest: RenewalFacts | null = null
    let endDate: Date | null = null
    let purchased = 0

    for (const row of rows) {
        if (latest === null || row.createdAt > latest.createdAt) latest = row
        if (row.endDate && (endDate === null || row.endDate > endDate)) endDate = row.endDate
        purchased += row.programCount ?? 0
    }

    return { mode: latest?.kind ?? null, endDate, purchased, used }
}
```

`src/lib/subscription-queries.ts` — full new content:

```ts
import { prisma } from '@/lib/prisma'
import { buildSubscriptionOverview, resolveSummary, type SubscriptionOverview, type SubscriptionSummary } from '@/lib/subscriptions'

/**
 * Server-only subscription queries. Kept apart from src/lib/subscriptions.ts so
 * client components can import the pure helpers without pulling in Prisma.
 */

/**
 * Current summary per trainee. Three aggregate queries whatever the number of
 * trainees: latest renewal (mode), totals (expiry + purchased programs), usages.
 * Trainees without renewals are absent from the map.
 */
export async function getCurrentSummaries(traineeIds: string[], today: Date): Promise<Map<string, SubscriptionSummary>> {
    if (traineeIds.length === 0) return new Map()

    const where = { traineeId: { in: traineeIds } }
    const [latest, totals, usages] = await Promise.all([
        prisma.subscriptionRenewal.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            distinct: ['traineeId'],
            select: { traineeId: true, kind: true },
        }),
        prisma.subscriptionRenewal.groupBy({
            by: ['traineeId'],
            where,
            _max: { endDate: true },
            _sum: { programCount: true },
        }),
        prisma.programCreditUsage.groupBy({ by: ['traineeId'], where, _count: { _all: true } }),
    ])

    const totalsByTrainee = new Map(totals.map((row) => [row.traineeId, row]))
    const usedByTrainee = new Map(usages.map((row) => [row.traineeId, row._count._all]))

    const summaries = new Map<string, SubscriptionSummary>()
    for (const { traineeId, kind } of latest) {
        const total = totalsByTrainee.get(traineeId)
        const summary = resolveSummary(
            {
                mode: kind,
                endDate: total?._max.endDate ?? null,
                purchased: total?._sum.programCount ?? 0,
                used: usedByTrainee.get(traineeId) ?? 0,
            },
            today
        )
        if (summary) summaries.set(traineeId, summary)
    }
    return summaries
}

/** Subscriptions page and home alerts: the logged-in trainer's active trainees only. */
export async function getTrainerSubscriptionOverview(trainerId: string, today: Date): Promise<SubscriptionOverview> {
    const links = await prisma.trainerTrainee.findMany({
        where: { trainerId, trainee: { isActive: true } },
        select: { trainee: { select: { id: true, firstName: true, lastName: true } } },
    })
    const trainees = links.map((link) => link.trainee)
    const summaries = await getCurrentSummaries(trainees.map((trainee) => trainee.id), today)
    return buildSubscriptionOverview(trainees, summaries)
}
```

`src/app/api/subscription-renewals/route.ts` — GET: change the import to `import { addMonthsClamped, resolveSummary, summarizeRenewals } from '@/lib/subscriptions'`, update the doc comment to "History (newest first), current status and program balance", and replace the query + response:

```ts
        const [items, used] = await Promise.all([
            prisma.subscriptionRenewal.findMany({
                where: { traineeId },
                orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
            }),
            prisma.programCreditUsage.count({ where: { traineeId } }),
        ])

        const input = summarizeRenewals(items, used)
        const current = resolveSummary(input, getTodayDateKey())

        return apiSuccess({ items, current, programBalance: input.purchased - input.used })
```

`src/app/api/users/route.ts` — replace the import of `getCurrentEndDates` with `getCurrentSummaries`, drop the now-unused `toSubscriptionSummary` import (keep `type SubscriptionSummary`), and replace the block:

```ts
                // One aggregate query per concern for every trainee (no N+1)
                const today = getTodayDateKey()
                const [summaries, pendingIds] = await Promise.all([
                    getCurrentSummaries(trainees.map((trainee) => trainee.id), today),
                    findPendingActivationIds(trainees.filter((trainee) => !trainee.isActive).map((trainee) => trainee.id)),
                ])
                users = trainees.map((trainee) => ({
                    ...trainee,
                    subscription: summaries.get(trainee.id) ?? null,
                    pendingActivation: pendingIds.has(trainee.id),
                }))
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run type-check && npx vitest run tests/unit/lib tests/integration/subscription-renewals.test.ts tests/integration/users.test.ts tests/unit/trainer-dashboard`
Expected: PASS, no type errors.

- [ ] **Step 8: Run the whole suite and commit**

Run: `npm run lint && npm run test:unit`
Expected: PASS.

```bash
git add prisma src/lib src/app/api tests implementation-docs/CHANGELOG.md
git commit -m "feat(db): program packages, credit ledger and subscription event log"
```

---

### Task 3: Renewal validation union, events and renewals API

**Files:**
- Modify: `src/schemas/subscription-renewal.ts`
- Create: `src/lib/subscription-events.ts`
- Create: `src/app/api/subscription-renewals/_data.ts`
- Modify: `src/app/api/subscription-renewals/route.ts`, `src/app/api/subscription-renewals/[id]/route.ts`
- Modify: `src/lib/subscriptions.ts` (types only)
- Modify: `public/locales/it/errors.json`, `public/locales/en/errors.json`
- Test: `tests/unit/schemas/subscription-renewal.test.ts`, `tests/unit/lib/subscription-events.test.ts` (new), `tests/integration/subscription-renewals.test.ts`

**Interfaces:**
- Consumes: Prisma models from Task 2; `addMonthsClamped`, `MIN/MAX_PROGRAM_COUNT` from `@/lib/subscriptions`.
- Produces:
  - `createRenewalSchema`, `updateRenewalSchema`; `type UpdateRenewalInput = { kind: 'period'; startDate: Date; durationMonths: number } | { kind: 'programs'; startDate: Date; programCount: number }`; `CreateRenewalInput` = the same union with `traineeId: string`.
  - `logSubscriptionEvent(tx: Prisma.TransactionClient, event: SubscriptionEventInput): Promise<void>` with `interface SubscriptionEventInput { traineeId: string; type: SubscriptionEventType; actorId: string; creditDelta?: number | null; renewalId?: string; programId?: string; details: Prisma.InputJsonObject }`
  - `listSubscriptionEvents(traineeId: string)` → array of `{ id, type, creditDelta, details, createdAt: Date, actorName: string }`, newest first, at most `EVENT_HISTORY_LIMIT = 100`.
  - `type SubscriptionEventType` and `interface SubscriptionEventRow { id: string; type: SubscriptionEventType; creditDelta: number | null; details: Record<string, unknown>; createdAt: string; actorName: string }` from `@/lib/subscriptions` (client-side API shape).
  - `GET /api/subscription-renewals` → `{ items, current, programBalance, events: SubscriptionEventRow[] }`.
  - Error keys `subscription.kindImmutable`, `validation.programCountRange`.

- [ ] **Step 1: Write the failing schema tests**

Add to `tests/unit/schemas/subscription-renewal.test.ts`:

```ts
describe('renewal kind union', () => {
    const traineeId = '11111111-1111-1111-1111-111111111111'

    it('defaults a missing kind to period', () => {
        const result = createRenewalSchema.parse({ traineeId, startDate: '2026-11-01', durationMonths: 3 })

        expect(result).toMatchObject({ kind: 'period', durationMonths: 3 })
    })

    it('accepts a package and normalises the purchase date to a UTC day', () => {
        const result = createRenewalSchema.parse({ traineeId, kind: 'programs', startDate: '2026-11-01T18:45:00.000Z', programCount: 5 })

        expect(result).toEqual({ traineeId, kind: 'programs', startDate: new Date('2026-11-01T00:00:00.000Z'), programCount: 5 })
    })

    it.each([0, 51, 2.5, -1])('rejects a package of %s programs', (programCount) => {
        const result = createRenewalSchema.safeParse({ traineeId, kind: 'programs', startDate: '2026-11-01', programCount })

        expect(result.success).toBe(false)
        if (!result.success) expect(result.error.errors[0].message).toBe('validation.programCountRange')
    })

    it('rejects a package without a count', () => {
        expect(updateRenewalSchema.safeParse({ kind: 'programs', startDate: '2026-11-01' }).success).toBe(false)
    })

    it('strips the fields of the other kind and any client end date', () => {
        const result = updateRenewalSchema.parse({ kind: 'programs', startDate: '2026-11-01', programCount: 3, durationMonths: 6, endDate: '2030-01-01' })

        expect(result).toEqual({ kind: 'programs', startDate: new Date('2026-11-01T00:00:00.000Z'), programCount: 3 })
    })

    it('rejects an unknown kind', () => {
        expect(updateRenewalSchema.safeParse({ kind: 'weekly', startDate: '2026-11-01', durationMonths: 1 }).success).toBe(false)
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/schemas/subscription-renewal.test.ts`
Expected: FAIL — `kind` missing from the parsed output, packages rejected.

- [ ] **Step 3: Implement the schema**

Replace everything below `durationMonthsSchema` in `src/schemas/subscription-renewal.ts` (extend the import from `@/lib/subscriptions` with `MAX_PROGRAM_COUNT, MIN_PROGRAM_COUNT`):

```ts
const programCountSchema = z
    .number({ invalid_type_error: 'validation.programCountRange', required_error: 'validation.programCountRange' })
    .int('validation.programCountRange')
    .min(MIN_PROGRAM_COUNT, 'validation.programCountRange')
    .max(MAX_PROGRAM_COUNT, 'validation.programCountRange')

const periodFields = {
    kind: z.literal('period'),
    startDate: startDateSchema,
    durationMonths: durationMonthsSchema,
}

const programsFields = {
    kind: z.literal('programs'),
    // Purchase date of the package
    startDate: startDateSchema,
    programCount: programCountSchema,
}

/** Clients written before packages existed send no kind: they mean a period renewal. */
function defaultKind(value: unknown): unknown {
    if (value !== null && typeof value === 'object' && !('kind' in value)) return { ...value, kind: 'period' }
    return value
}

export const updateRenewalSchema = z.preprocess(
    defaultKind,
    z.discriminatedUnion('kind', [z.object(periodFields), z.object(programsFields)])
)

const traineeIdSchema = z.string().uuid('validation.invalidTraineeId')

export const createRenewalSchema = z.preprocess(
    defaultKind,
    z.discriminatedUnion('kind', [
        z.object({ ...periodFields, traineeId: traineeIdSchema }),
        z.object({ ...programsFields, traineeId: traineeIdSchema }),
    ])
)

export type CreateRenewalInput = z.infer<typeof createRenewalSchema>
export type UpdateRenewalInput = z.infer<typeof updateRenewalSchema>
```

Update the file's header comment: add the line "A renewal is either a period (start + months) or a package of programs (purchase date + count); `kind` discriminates."

Run: `npx vitest run tests/unit/schemas/subscription-renewal.test.ts`
Expected: PASS. A pre-existing case that compares the whole parsed object with `toEqual` now also receives `kind: 'period'`: add it to that expectation. No other pre-existing case should need a change.

- [ ] **Step 4: Write the failing event-helper tests**

Create `tests/unit/lib/subscription-events.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { EVENT_HISTORY_LIMIT, listSubscriptionEvents, logSubscriptionEvent } from '@/lib/subscription-events'
import { prismaMock } from '../../helpers/prisma-mock'

describe('logSubscriptionEvent', () => {
    it('writes the event through the given transaction client', async () => {
        await logSubscriptionEvent(prismaMock, {
            traineeId: 't1',
            type: 'credit_consumed',
            actorId: 'trainer-1',
            programId: 'prog-1',
            creditDelta: -1,
            details: { programTitle: 'Forza A' },
        })

        expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
            data: {
                traineeId: 't1',
                type: 'credit_consumed',
                actorId: 'trainer-1',
                creditDelta: -1,
                renewalId: null,
                programId: 'prog-1',
                details: { programTitle: 'Forza A' },
            },
        })
    })
})

describe('listSubscriptionEvents', () => {
    it('returns the newest events with the actor name, capped', async () => {
        prismaMock.subscriptionEvent.findMany.mockResolvedValue([
            {
                id: 'e1',
                type: 'package_created',
                creditDelta: 5,
                details: { purchaseDate: '2026-10-01', programCount: 5 },
                createdAt: new Date('2026-10-01T10:00:00.000Z'),
                actor: { firstName: 'Marco', lastName: 'Trainer' },
            },
        ] as never)

        const events = await listSubscriptionEvents('t1')

        expect(prismaMock.subscriptionEvent.findMany).toHaveBeenCalledWith({
            where: { traineeId: 't1' },
            orderBy: { createdAt: 'desc' },
            take: EVENT_HISTORY_LIMIT,
            select: {
                id: true,
                type: true,
                creditDelta: true,
                details: true,
                createdAt: true,
                actor: { select: { firstName: true, lastName: true } },
            },
        })
        expect(events).toEqual([
            {
                id: 'e1',
                type: 'package_created',
                creditDelta: 5,
                details: { purchaseDate: '2026-10-01', programCount: 5 },
                createdAt: new Date('2026-10-01T10:00:00.000Z'),
                actorName: 'Marco Trainer',
            },
        ])
    })
})
```

Run: `npx vitest run tests/unit/lib/subscription-events.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement the event helpers**

Create `src/lib/subscription-events.ts`:

```ts
import type { Prisma, SubscriptionEventType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Append-only history of renewals and program-credit movements, shown to the
 * trainer. Written inside the transaction of the mutation it describes; never
 * updated, never read to compute a balance.
 */

export const EVENT_HISTORY_LIMIT = 100

export interface SubscriptionEventInput {
    traineeId: string
    type: SubscriptionEventType
    actorId: string
    /** +N package, -1 consumed, +1 refunded, signed difference on a package edit/delete */
    creditDelta?: number | null
    renewalId?: string
    programId?: string
    /** Snapshot: the row survives the renewal or program it describes */
    details: Prisma.InputJsonObject
}

export async function logSubscriptionEvent(tx: Prisma.TransactionClient, event: SubscriptionEventInput): Promise<void> {
    await tx.subscriptionEvent.create({
        data: {
            traineeId: event.traineeId,
            type: event.type,
            actorId: event.actorId,
            creditDelta: event.creditDelta ?? null,
            renewalId: event.renewalId ?? null,
            programId: event.programId ?? null,
            details: event.details,
        },
    })
}

export async function listSubscriptionEvents(traineeId: string) {
    const rows = await prisma.subscriptionEvent.findMany({
        where: { traineeId },
        orderBy: { createdAt: 'desc' },
        take: EVENT_HISTORY_LIMIT,
        select: {
            id: true,
            type: true,
            creditDelta: true,
            details: true,
            createdAt: true,
            actor: { select: { firstName: true, lastName: true } },
        },
    })

    return rows.map(({ actor, ...event }) => ({ ...event, actorName: `${actor.firstName} ${actor.lastName}` }))
}
```

In `src/lib/subscriptions.ts` add the client-side types (after `RenewalRow`):

```ts
export type SubscriptionEventType =
    | 'period_renewal_created'
    | 'package_created'
    | 'renewal_updated'
    | 'renewal_deleted'
    | 'credit_consumed'
    | 'credit_refunded'
    | 'credit_forfeited'

/** A history row as the API returns it. */
export interface SubscriptionEventRow {
    id: string
    type: SubscriptionEventType
    creditDelta: number | null
    details: Record<string, unknown>
    createdAt: string
    actorName: string
}
```

Run: `npx vitest run tests/unit/lib/subscription-events.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing API tests**

In `tests/integration/subscription-renewals.test.ts`, add fixtures below `mockRenewal`:

```ts
const mockPackage = {
    ...mockRenewal,
    id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
    kind: 'programs' as const,
    startDate: day('2026-10-01'),
    durationMonths: null,
    endDate: null,
    programCount: 5,
}
```

Add to the GET `describe` (and add `prismaMock.subscriptionEvent.findMany.mockResolvedValue([] as never)` to the GET tests that reach the queries):

```ts
    it('returns the movement history', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findMany.mockResolvedValue([mockPackage] as never)
        prismaMock.programCreditUsage.count.mockResolvedValue(0)
        prismaMock.subscriptionEvent.findMany.mockResolvedValue([
            {
                id: 'e1',
                type: 'package_created',
                creditDelta: 5,
                details: { purchaseDate: '2026-10-01', programCount: 5 },
                createdAt: new Date('2026-10-01T10:00:00.000Z'),
                actor: { firstName: 'Marco', lastName: 'Trainer' },
            },
        ] as never)

        const body = await (await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))).json()

        expect(body.data.events).toEqual([
            {
                id: 'e1',
                type: 'package_created',
                creditDelta: 5,
                details: { purchaseDate: '2026-10-01', programCount: 5 },
                createdAt: '2026-10-01T10:00:00.000Z',
                actorName: 'Marco Trainer',
            },
        ])
    })
```

Add to the POST `describe` (the trainee lookup arrangement is the one the existing POST tests use — `prismaMock.user.findUnique` resolving `{ id: TRAINEE_ID, role: 'trainee' }`):

```ts
    it('creates a package and logs it with its credit delta', async () => {
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee' } as never)
        prismaMock.subscriptionRenewal.create.mockResolvedValue(mockPackage as never)

        const res = await POST(jsonRequest(BASE, 'POST', { traineeId: TRAINEE_ID, kind: 'programs', startDate: '2026-10-01', programCount: 5 }))

        expect(res.status).toBe(201)
        expect(prismaMock.subscriptionRenewal.create).toHaveBeenCalledWith({
            data: {
                traineeId: TRAINEE_ID,
                kind: 'programs',
                startDate: day('2026-10-01'),
                durationMonths: null,
                endDate: null,
                programCount: 5,
                createdBy: 'trainer-uuid-1',
            },
        })
        expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                traineeId: TRAINEE_ID,
                type: 'package_created',
                creditDelta: 5,
                renewalId: mockPackage.id,
                actorId: 'trainer-uuid-1',
                details: { purchaseDate: '2026-10-01', programCount: 5 },
            }),
        })
    })

    it('logs a period renewal without a credit delta', async () => {
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee' } as never)
        prismaMock.subscriptionRenewal.create.mockResolvedValue(mockRenewal as never)

        await POST(jsonRequest(BASE, 'POST', { traineeId: TRAINEE_ID, startDate: '2026-09-10', durationMonths: 1 }))

        expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'period_renewal_created',
                creditDelta: null,
                details: { startDate: '2026-09-10', durationMonths: 1, endDate: '2026-10-10' },
            }),
        })
    })

    it('rejects a package of 0 programs with 400 and writes nothing', async () => {
        asTrainer()

        const res = await POST(jsonRequest(BASE, 'POST', { traineeId: TRAINEE_ID, kind: 'programs', startDate: '2026-10-01', programCount: 0 }))

        expect(res.status).toBe(400)
        expect(prismaMock.subscriptionRenewal.create).not.toHaveBeenCalled()
        expect(prismaMock.subscriptionEvent.create).not.toHaveBeenCalled()
    })
```

Add to the PATCH `describe`:

```ts
    it('shrinks a package and logs the negative difference', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockPackage as never)
        prismaMock.subscriptionRenewal.update.mockResolvedValue({ ...mockPackage, programCount: 2 } as never)

        const res = await PATCH(jsonRequest(`${BASE}/${mockPackage.id}`, 'PATCH', { kind: 'programs', startDate: '2026-10-01', programCount: 2 }), params(mockPackage.id))

        expect(res.status).toBe(200)
        expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'renewal_updated',
                creditDelta: -3,
                renewalId: mockPackage.id,
                details: {
                    kind: 'programs',
                    before: { purchaseDate: '2026-10-01', programCount: 5 },
                    after: { purchaseDate: '2026-10-01', programCount: 2 },
                },
            }),
        })
    })

    it('refuses to turn a package into a period renewal', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockPackage as never)

        const res = await PATCH(jsonRequest(`${BASE}/${mockPackage.id}`, 'PATCH', { kind: 'period', startDate: '2026-10-01', durationMonths: 3 }), params(mockPackage.id))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('subscription.kindImmutable')
        expect(prismaMock.subscriptionRenewal.update).not.toHaveBeenCalled()
    })

    it('treats a body without kind as a period edit, refused on a package', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockPackage as never)

        const res = await PATCH(jsonRequest(`${BASE}/${mockPackage.id}`, 'PATCH', { startDate: '2026-10-01', durationMonths: 3 }), params(mockPackage.id))

        expect(res.status).toBe(400)
    })
```

Add to the DELETE `describe`:

```ts
    it('logs the deleted package with a negative credit delta', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockPackage as never)

        const res = await DELETE(makeRequest(`${BASE}/${mockPackage.id}`, { method: 'DELETE' }), params(mockPackage.id))

        expect(res.status).toBe(200)
        expect(prismaMock.subscriptionRenewal.delete).toHaveBeenCalledWith({ where: { id: mockPackage.id } })
        expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'renewal_deleted',
                creditDelta: -5,
                details: { kind: 'programs', purchaseDate: '2026-10-01', programCount: 5 },
            }),
        })
    })
```

Existing assertions to update in this file: the POST "creates a renewal…" and PATCH "recomputes the end date" tests assert the exact `data` passed to `create` / `update`: add `kind: 'period'` and `programCount: null` to those expected objects.

Run: `npx vitest run tests/integration/subscription-renewals.test.ts`
Expected: FAIL — no event written, `events` undefined, packages rejected.

- [ ] **Step 7: Implement the API**

Create `src/app/api/subscription-renewals/_data.ts`:

```ts
import type { Prisma, RenewalKind } from '@prisma/client'
import { addMonthsClamped } from '@/lib/subscriptions'
import type { UpdateRenewalInput } from '@/schemas/subscription-renewal'

/** The columns a renewal row stores, of either kind. */
export interface RenewalColumns {
    kind: RenewalKind
    startDate: Date
    durationMonths: number | null
    endDate: Date | null
    programCount: number | null
}

/** Validated input → stored columns. endDate is computed here, never accepted from the client. */
export function toRenewalColumns(input: UpdateRenewalInput): RenewalColumns {
    if (input.kind === 'programs') {
        return { kind: 'programs', startDate: input.startDate, durationMonths: null, endDate: null, programCount: input.programCount }
    }
    return {
        kind: 'period',
        startDate: input.startDate,
        durationMonths: input.durationMonths,
        endDate: addMonthsClamped(input.startDate, input.durationMonths),
        programCount: null,
    }
}

const isoDay = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null)

/** What the history keeps of a renewal: it must stay readable after the row is gone. */
export function renewalSnapshot(row: RenewalColumns): Prisma.InputJsonObject {
    if (row.kind === 'programs') return { purchaseDate: isoDay(row.startDate), programCount: row.programCount }
    return { startDate: isoDay(row.startDate), durationMonths: row.durationMonths, endDate: isoDay(row.endDate) }
}
```

`src/app/api/subscription-renewals/route.ts`:

Imports: add `import { listSubscriptionEvents, logSubscriptionEvent } from '@/lib/subscription-events'` and `import { renewalSnapshot, toRenewalColumns } from './_data'`; `addMonthsClamped` is no longer imported here.

GET — extend the parallel read and the response:

```ts
        const [items, used, events] = await Promise.all([
            prisma.subscriptionRenewal.findMany({
                where: { traineeId },
                orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
            }),
            prisma.programCreditUsage.count({ where: { traineeId } }),
            listSubscriptionEvents(traineeId),
        ])

        const input = summarizeRenewals(items, used)
        const current = resolveSummary(input, getTodayDateKey())

        return apiSuccess({ items, current, programBalance: input.purchased - input.used, events })
```

POST — update the doc comment to "Body: `{ traineeId, kind, startDate, durationMonths | programCount }`" and replace from the destructuring to the `create`:

```ts
        const { traineeId, ...input } = validation.data
```

(the access guard and trainee checks stay exactly as they are, using `traineeId`)

```ts
        const renewal = await prisma.$transaction(async (tx) => {
            const created = await tx.subscriptionRenewal.create({
                data: { traineeId, ...toRenewalColumns(input), createdBy: session.user.id },
            })
            await logSubscriptionEvent(tx, {
                traineeId,
                type: created.kind === 'programs' ? 'package_created' : 'period_renewal_created',
                actorId: session.user.id,
                renewalId: created.id,
                creditDelta: created.programCount,
                details: renewalSnapshot(created),
            })
            return created
        })
```

`src/app/api/subscription-renewals/[id]/route.ts`:

Imports: replace `addMonthsClamped` with `import { logSubscriptionEvent } from '@/lib/subscription-events'` and `import { renewalSnapshot, toRenewalColumns } from '../_data'`.

PATCH — replace from the destructuring to the `update`:

```ts
        const input = validation.data
        if (input.kind !== renewal.kind) {
            return apiError('VALIDATION_ERROR', 'The kind of a renewal cannot be changed', 400, undefined, 'subscription.kindImmutable')
        }

        const updated = await prisma.$transaction(async (tx) => {
            const row = await tx.subscriptionRenewal.update({ where: { id }, data: toRenewalColumns(input) })
            await logSubscriptionEvent(tx, {
                traineeId: renewal.traineeId,
                type: 'renewal_updated',
                actorId: session.user.id,
                renewalId: id,
                creditDelta: row.kind === 'programs' ? (row.programCount ?? 0) - (renewal.programCount ?? 0) : null,
                details: { kind: row.kind, before: renewalSnapshot(renewal), after: renewalSnapshot(row) },
            })
            return row
        })
```

DELETE — replace the `delete` call:

```ts
        await prisma.$transaction(async (tx) => {
            await tx.subscriptionRenewal.delete({ where: { id } })
            await logSubscriptionEvent(tx, {
                traineeId: renewal.traineeId,
                type: 'renewal_deleted',
                actorId: session.user.id,
                renewalId: id,
                creditDelta: renewal.kind === 'programs' ? -(renewal.programCount ?? 0) : null,
                details: { kind: renewal.kind, ...renewalSnapshot(renewal) },
            })
        })
```

Update both doc comments ("Body: `{ kind, startDate, durationMonths | programCount }`. `kind` cannot change.").

- [ ] **Step 8: Add the error keys**

`public/locales/it/errors.json`: in `"subscription"` add `"kindImmutable": "Il tipo di un rinnovo non può essere modificato"`; in `"validation"` add `"programCountRange": "Il numero di schede deve essere un intero tra 1 e 50"`.

`public/locales/en/errors.json`: `"kindImmutable": "The type of a renewal cannot be changed"`, `"programCountRange": "The number of programs must be a whole number between 1 and 50"`.

- [ ] **Step 9: Verify and commit**

Run: `npm run type-check && npm run lint && npx vitest run tests/integration/subscription-renewals.test.ts tests/unit/schemas tests/unit/lib`
Expected: PASS.

```bash
git add src/schemas src/lib src/app/api/subscription-renewals public/locales tests implementation-docs/CHANGELOG.md
git commit -m "feat(subscriptions): package renewals API with append-only movement log"
```

---

### Task 4: Consume a program credit on publish

**Files:**
- Create: `src/lib/program-credits.ts`
- Modify: `src/app/api/programs/[id]/publish/route.ts`
- Test: `tests/unit/lib/program-credits.test.ts` (new), `tests/integration/programs.test.ts`

**Interfaces:**
- Consumes: `logSubscriptionEvent` (Task 3), Prisma models (Task 2).
- Produces: `consumeCreditOnPublish(tx: Prisma.TransactionClient, input: { traineeId: string; programId: string; programTitle: string; actorId: string }): Promise<boolean>` — `true` when a credit was consumed. `POST /api/programs/[id]/publish` response gains `creditConsumed: boolean`.

- [ ] **Step 1: Write the failing unit tests**

Create `tests/unit/lib/program-credits.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { consumeCreditOnPublish } from '@/lib/program-credits'
import { prismaMock } from '../../helpers/prisma-mock'

const INPUT = { traineeId: 't1', programId: 'prog-1', programTitle: 'Forza A', actorId: 'trainer-1' }

describe('consumeCreditOnPublish', () => {
    it('consumes a credit and logs it when the latest renewal is a package', async () => {
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue({ kind: 'programs' } as never)

        await expect(consumeCreditOnPublish(prismaMock, INPUT)).resolves.toBe(true)

        expect(prismaMock.subscriptionRenewal.findFirst).toHaveBeenCalledWith({
            where: { traineeId: 't1' },
            orderBy: { createdAt: 'desc' },
            select: { kind: true },
        })
        expect(prismaMock.programCreditUsage.create).toHaveBeenCalledWith({
            data: { traineeId: 't1', programId: 'prog-1', createdBy: 'trainer-1' },
        })
        expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                traineeId: 't1',
                type: 'credit_consumed',
                creditDelta: -1,
                programId: 'prog-1',
                actorId: 'trainer-1',
                details: { programTitle: 'Forza A' },
            }),
        })
    })

    it('does nothing when the latest renewal is a period, even with leftover packages', async () => {
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue({ kind: 'period' } as never)

        await expect(consumeCreditOnPublish(prismaMock, INPUT)).resolves.toBe(false)

        expect(prismaMock.programCreditUsage.create).not.toHaveBeenCalled()
        expect(prismaMock.subscriptionEvent.create).not.toHaveBeenCalled()
    })

    it('does nothing for a trainee without renewals', async () => {
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue(null)

        await expect(consumeCreditOnPublish(prismaMock, INPUT)).resolves.toBe(false)

        expect(prismaMock.programCreditUsage.create).not.toHaveBeenCalled()
    })

    it('never checks the balance: a trainee at zero still consumes', async () => {
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue({ kind: 'programs' } as never)

        await consumeCreditOnPublish(prismaMock, INPUT)

        expect(prismaMock.programCreditUsage.count).not.toHaveBeenCalled()
        expect(prismaMock.programCreditUsage.create).toHaveBeenCalledTimes(1)
    })
})
```

Run: `npx vitest run tests/unit/lib/program-credits.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement `consumeCreditOnPublish`**

Create `src/lib/program-credits.ts`:

```ts
import type { Prisma } from '@prisma/client'
import { logSubscriptionEvent } from '@/lib/subscription-events'

/**
 * Program credits: a trainee on packages spends one program per publish.
 * Every function takes the transaction client of the mutation it belongs to,
 * so the ledger row, the history row and the program change commit together.
 */

export interface PublishCreditInput {
    traineeId: string
    programId: string
    programTitle: string
    actorId: string
}

/**
 * Consumes one credit when the trainee is currently on packages (latest
 * registered renewal). The balance is deliberately not checked: publishing is
 * never blocked, a trainee at zero goes into debt.
 */
export async function consumeCreditOnPublish(tx: Prisma.TransactionClient, input: PublishCreditInput): Promise<boolean> {
    const latest = await tx.subscriptionRenewal.findFirst({
        where: { traineeId: input.traineeId },
        orderBy: { createdAt: 'desc' },
        select: { kind: true },
    })
    if (latest?.kind !== 'programs') return false

    await tx.programCreditUsage.create({
        data: { traineeId: input.traineeId, programId: input.programId, createdBy: input.actorId },
    })
    await logSubscriptionEvent(tx, {
        traineeId: input.traineeId,
        type: 'credit_consumed',
        actorId: input.actorId,
        programId: input.programId,
        creditDelta: -1,
        details: { programTitle: input.programTitle },
    })
    return true
}
```

Run: `npx vitest run tests/unit/lib/program-credits.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing publish tests**

In `tests/integration/programs.test.ts`, add `title: 'Forza A'` to `mockPublishProgram`, then add inside `describe('POST /api/programs/[id]/publish', …)`:

```ts
    function arrangePublishable() {
        asTrainer()
        prismaMock.trainingProgram.findUnique
            .mockResolvedValueOnce(mockPublishProgram as never)
            .mockResolvedValueOnce(mockUpdatedPublishedProgram as never)
        prismaMock.trainingProgram.update.mockResolvedValue(mockUpdatedPublishedProgram as never)
        prismaMock.week.update.mockResolvedValue({} as never)
    }

    const publish = () => publishPOST(makePublishRequest('prog-1'), { params: Promise.resolve({ id: 'prog-1' }) })

    it('consumes a program credit for a trainee on packages', async () => {
        arrangePublishable()
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue({ kind: 'programs' } as never)

        const res = await publish()
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.creditConsumed).toBe(true)
        expect(prismaMock.programCreditUsage.create).toHaveBeenCalledWith({
            data: { traineeId: 'trainee-uuid-1', programId: 'prog-1', createdBy: 'trainer-uuid-1' },
        })
        expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ type: 'credit_consumed', details: { programTitle: 'Forza A' } }),
        })
    })

    it('consumes nothing for a trainee on a period renewal', async () => {
        arrangePublishable()
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue({ kind: 'period' } as never)

        const body = await (await publish()).json()

        expect(body.data.creditConsumed).toBe(false)
        expect(prismaMock.programCreditUsage.create).not.toHaveBeenCalled()
    })

    it('publishes for a trainee without any renewal, consuming nothing', async () => {
        arrangePublishable()
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue(null)

        const res = await publish()

        expect(res.status).toBe(200)
        expect(prismaMock.programCreditUsage.create).not.toHaveBeenCalled()
    })

    it('runs the status change, the week dates and the consumption in one transaction', async () => {
        arrangePublishable()
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue({ kind: 'programs' } as never)

        await publish()

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    })

    it('fails the whole publish when the credit cannot be recorded', async () => {
        arrangePublishable()
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue({ kind: 'programs' } as never)
        prismaMock.programCreditUsage.create.mockRejectedValue(new Error('unique violation'))

        const res = await publish()

        expect(res.status).toBe(500)
    })
```

If this file's top-level `beforeEach` uses `vi.clearAllMocks()` without re-installing `$transaction`, nothing else is needed (`clearAllMocks` keeps implementations). If it uses `resetPrismaMock()`, that already re-installs it.

Run: `npx vitest run tests/integration/programs.test.ts -t "publish"`
Expected: FAIL — `creditConsumed` undefined, `$transaction` not called.

- [ ] **Step 4: Make publish transactional and consume**

In `src/app/api/programs/[id]/publish/route.ts`:

Add `import { consumeCreditOnPublish } from '@/lib/program-credits'`. Update the doc comment's business-logic list with "- Consume one program credit when the trainee is on packages (never blocks)".

Remove the unused `endDateObj` lines and replace the two write blocks ("Update program status and dates" and "Assign dates to weeks in parallel") with:

```ts
        const startDateObj = new Date(startDate)

        // One transaction: a published program without its credit movement (or the reverse) must never exist
        const creditConsumed = await prisma.$transaction(async (tx) => {
            await tx.trainingProgram.update({
                where: { id: programId },
                data: {
                    status: 'active',
                    startDate: startDateObj,
                    publishedAt: new Date(),
                },
            })

            await Promise.all(
                program.weeks.map((week) =>
                    tx.week.update({
                        where: { id: week.id },
                        data: { startDate: weekStartDate(startDateObj, week.weekNumber) },
                    })
                )
            )

            return consumeCreditOnPublish(tx, {
                traineeId: program.traineeId,
                programId,
                programTitle: program.title,
                actorId: session.user.id,
            })
        })
```

Add `creditConsumed` to the `logger.info` payload and to the response:

```ts
        return apiSuccess({
            program: updatedProgram,
            creditConsumed,
            message: 'Program published successfully',
        })
```

- [ ] **Step 5: Verify and commit**

Run: `npm run type-check && npm run lint && npx vitest run tests/integration/programs.test.ts tests/unit/lib/program-credits.test.ts`
Expected: PASS, including the pre-existing publish tests.

```bash
git add src/lib/program-credits.ts "src/app/api/programs/[id]/publish/route.ts" tests implementation-docs/CHANGELOG.md
git commit -m "feat(programs): publishing consumes a program credit for package trainees"
```

---

### Task 5: Refund choice on program deletion and `consumedCredit` in the list

**Files:**
- Modify: `src/lib/program-credits.ts`
- Modify: `src/app/api/programs/[id]/route.ts` (DELETE)
- Modify: `src/app/api/programs/route.ts` (GET list)
- Test: `tests/unit/lib/program-credits.test.ts`, `tests/integration/program-detail.test.ts`, `tests/integration/programs.test.ts`

**Interfaces:**
- Consumes: `logSubscriptionEvent`, `consumeCreditOnPublish`'s module.
- Produces:
  - `settleCreditOnProgramDelete(tx: Prisma.TransactionClient, input: { programId: string; programTitle: string; refund: boolean; actorId: string }): Promise<'refunded' | 'forfeited' | 'none'>`
  - `DELETE /api/programs/[id]?refundCredit=true` refunds; any other value or no param keeps the credit consumed.
  - `GET /api/programs` items carry `consumedCredit: boolean` for trainer and admin; the field is absent for the trainee role. The `creditUsage` relation is read with the list (no extra query) and never returned.

- [ ] **Step 1: Write the failing unit tests**

Append to `tests/unit/lib/program-credits.test.ts` (extend the import with `settleCreditOnProgramDelete`):

```ts
describe('settleCreditOnProgramDelete', () => {
    const usage = { id: 'u1', traineeId: 't1', programId: 'prog-1' }
    const input = { programId: 'prog-1', programTitle: 'Forza A', actorId: 'trainer-1' }

    it('does nothing for a program that never consumed a credit', async () => {
        prismaMock.programCreditUsage.findUnique.mockResolvedValue(null)

        await expect(settleCreditOnProgramDelete(prismaMock, { ...input, refund: true })).resolves.toBe('none')

        expect(prismaMock.programCreditUsage.delete).not.toHaveBeenCalled()
        expect(prismaMock.subscriptionEvent.create).not.toHaveBeenCalled()
    })

    it('gives the credit back by deleting the usage', async () => {
        prismaMock.programCreditUsage.findUnique.mockResolvedValue(usage as never)

        await expect(settleCreditOnProgramDelete(prismaMock, { ...input, refund: true })).resolves.toBe('refunded')

        expect(prismaMock.programCreditUsage.findUnique).toHaveBeenCalledWith({ where: { programId: 'prog-1' } })
        expect(prismaMock.programCreditUsage.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
        expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ traineeId: 't1', type: 'credit_refunded', creditDelta: 1, details: { programTitle: 'Forza A' } }),
        })
    })

    it('keeps the usage when the trainer does not refund', async () => {
        prismaMock.programCreditUsage.findUnique.mockResolvedValue(usage as never)

        await expect(settleCreditOnProgramDelete(prismaMock, { ...input, refund: false })).resolves.toBe('forfeited')

        expect(prismaMock.programCreditUsage.delete).not.toHaveBeenCalled()
        expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ type: 'credit_forfeited', creditDelta: 0 }),
        })
    })
})
```

Run: `npx vitest run tests/unit/lib/program-credits.test.ts`
Expected: FAIL — `settleCreditOnProgramDelete` not exported.

- [ ] **Step 2: Implement `settleCreditOnProgramDelete`**

Append to `src/lib/program-credits.ts`:

```ts
export interface DeleteCreditInput {
    programId: string
    programTitle: string
    /** The trainer's choice in the refund popup */
    refund: boolean
    actorId: string
}

/**
 * Called before a program is deleted. Refund: the usage row goes, the balance
 * rises by one. No refund: the usage row stays (the FK nulls its programId when
 * the program is deleted), the credit remains spent.
 */
export async function settleCreditOnProgramDelete(
    tx: Prisma.TransactionClient,
    input: DeleteCreditInput
): Promise<'refunded' | 'forfeited' | 'none'> {
    const usage = await tx.programCreditUsage.findUnique({ where: { programId: input.programId } })
    if (!usage) return 'none'

    if (input.refund) {
        await tx.programCreditUsage.delete({ where: { id: usage.id } })
    }
    await logSubscriptionEvent(tx, {
        traineeId: usage.traineeId,
        type: input.refund ? 'credit_refunded' : 'credit_forfeited',
        actorId: input.actorId,
        programId: input.programId,
        creditDelta: input.refund ? 1 : 0,
        details: { programTitle: input.programTitle },
    })
    return input.refund ? 'refunded' : 'forfeited'
}
```

Run: `npx vitest run tests/unit/lib/program-credits.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing DELETE and list tests**

In `tests/integration/program-detail.test.ts`, inside `describe('DELETE /api/programs/[id] — trainer deletion', …)`:

```ts
    const consumingProgram = {
        id: 'prog-1',
        title: 'Forza A',
        trainerId: mockTrainerSession.user.id,
        traineeId: 'trainee-uuid-1',
        status: 'active',
    }
    const usage = { id: 'u1', traineeId: 'trainee-uuid-1', programId: 'prog-1' }
    const deleteUrl = (query: string) => makeRequest(`http://localhost:3000/api/programs/prog-1${query}`)

    it('refunds the credit when asked to', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(consumingProgram as never)
        prismaMock.programCreditUsage.findUnique.mockResolvedValue(usage as never)

        const res = await DELETE(deleteUrl('?refundCredit=true'), withIdParam('prog-1'))

        expect(res.status).toBe(200)
        expect(prismaMock.programCreditUsage.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
        expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ type: 'credit_refunded', creditDelta: 1 }),
        })
        expect(prismaMock.trainingProgram.delete).toHaveBeenCalledWith({ where: { id: 'prog-1' } })
    })

    it.each(['', '?refundCredit=false', '?refundCredit=yes', '?refundCredit=1', '?refundCredit='])(
        'keeps the credit consumed for "%s"',
        async (query) => {
            prismaMock.trainingProgram.findUnique.mockResolvedValue(consumingProgram as never)
            prismaMock.programCreditUsage.findUnique.mockResolvedValue(usage as never)

            const res = await DELETE(deleteUrl(query), withIdParam('prog-1'))

            expect(res.status).toBe(200)
            expect(prismaMock.programCreditUsage.delete).not.toHaveBeenCalled()
            expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ type: 'credit_forfeited' }),
            })
        }
    )

    it('settles the credit and deletes the program in one transaction', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(consumingProgram as never)
        prismaMock.programCreditUsage.findUnique.mockResolvedValue(usage as never)

        await DELETE(deleteUrl('?refundCredit=true'), withIdParam('prog-1'))

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    })

    it('writes no history for a program that never consumed a credit', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(consumingProgram as never)
        prismaMock.programCreditUsage.findUnique.mockResolvedValue(null)

        await DELETE(deleteUrl('?refundCredit=true'), withIdParam('prog-1'))

        expect(prismaMock.subscriptionEvent.create).not.toHaveBeenCalled()
        expect(prismaMock.trainingProgram.delete).toHaveBeenCalled()
    })
```

In `tests/integration/programs.test.ts`, inside the existing `describe('GET /api/programs', …)` (it already has `mockPrograms`, `makeRequest()` and a `beforeEach` with default mocks), add:

```ts
    const listWith = (creditUsage: { id: string } | null) => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([{ ...mockPrograms[0], creditUsage }] as never)
        prismaMock.trainingProgram.count.mockResolvedValue(1 as never)
    }

    it('flags a program that consumed a credit, for the trainer', async () => {
        asTrainer()
        listWith({ id: 'u1' })

        const body = await (await GET(makeRequest())).json()

        expect(body.data.items[0].consumedCredit).toBe(true)
        expect(body.data.items[0]).not.toHaveProperty('creditUsage')
        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                include: expect.objectContaining({ creditUsage: { select: { id: true } } }),
            })
        )
    })

    it('reports consumedCredit false for a program without a usage', async () => {
        asTrainer()
        listWith(null)

        const body = await (await GET(makeRequest())).json()

        expect(body.data.items[0].consumedCredit).toBe(false)
    })

    it('never exposes the credit to the trainee', async () => {
        asTrainee()
        listWith({ id: 'u1' })

        const body = await (await GET(makeRequest())).json()

        expect(body.data.items[0]).not.toHaveProperty('consumedCredit')
        expect(body.data.items[0]).not.toHaveProperty('creditUsage')
    })
```

Run: `npx vitest run tests/integration/program-detail.test.ts tests/integration/programs.test.ts`
Expected: FAIL on the new cases.

- [ ] **Step 4: Implement DELETE with the refund choice**

In `src/app/api/programs/[id]/route.ts`:

Add `import { settleCreditOnProgramDelete } from '@/lib/program-credits'`.

Replace the DELETE doc comment and the delete block:

```ts
/**
 * DELETE /api/programs/[id]?refundCredit=true|false
 * Delete a program in any status (owning trainer or admin).
 * refundCredit: when the program consumed a program credit, `true` gives it
 * back to the trainee; anything else (or no parameter) leaves it consumed.
 */
```

```ts
        // Only the literal "true" refunds: an unexpected value must never hand a credit back
        const refund = new URL(request.url).searchParams.get('refundCredit') === 'true'

        // Delete program regardless of status: cascade removes weeks, workouts,
        // workout exercises, feedbacks, performed sets and workout skeletons.
        // The credit is settled first, in the same transaction.
        const creditOutcome = await prisma.$transaction(async (tx) => {
            const outcome = await settleCreditOnProgramDelete(tx, {
                programId,
                programTitle: program.title,
                refund,
                actorId: session.user.id,
            })
            await tx.trainingProgram.delete({ where: { id: programId } })
            return outcome
        })

        logger.info({ programId, userId: session.user.id, creditOutcome }, 'Program deleted successfully')
```

- [ ] **Step 5: Add `consumedCredit` to the list**

In `src/app/api/programs/route.ts` (GET), no extra query: the usage is a one-to-one relation, read it with the list.

In the `include` of the list `prisma.trainingProgram.findMany`, after `weeks: { … }`, add:

```ts
                // One-to-one: present when publishing this program consumed a program credit
                creditUsage: { select: { id: true } },
```

In the `enrichedItems` map, replace `return { ...program,` with:

```ts
                // The relation itself never leaves the API; the flag is for trainer/admin only
                // (it drives the refund popup on delete)
                const { creditUsage, ...programFields } = program

                return {
                    ...programFields,
```

and add as the last property of that returned object:

```ts
                    ...(session.user.role !== 'trainee' ? { consumedCredit: Boolean(creditUsage) } : {}),
```

- [ ] **Step 6: Verify and commit**

Run: `npm run type-check && npm run lint && npx vitest run tests/integration tests/unit/lib`
Expected: PASS.

```bash
git add src/lib/program-credits.ts src/app/api/programs tests implementation-docs/CHANGELOG.md
git commit -m "feat(programs): refund choice when deleting a program that consumed a credit"
```

---

### Task 6: Renewal form toggle, mixed history table and movements list

**Files:**
- Modify: `src/lib/subscriptions.ts` (`RenewalRow`)
- Modify: `src/components/SubscriptionRenewalFormModal.tsx`
- Create: `src/components/SubscriptionEventList.tsx`
- Modify: `src/components/index.ts`
- Modify: `src/app/trainer/trainees/[id]/_use-trainee-subscription.ts`, `src/app/trainer/trainees/[id]/_subscription-tab.tsx`
- Modify: `public/locales/it/trainer.json`, `public/locales/en/trainer.json`
- Test: `tests/unit/subscription-renewal-form-modal.test.tsx`, `tests/unit/subscription-event-list.test.tsx` (new), `tests/unit/trainer-subscription-tab.test.tsx`, `tests/unit/trainer-use-trainee-subscription.test.tsx`

**Interfaces:**
- Consumes: `GET /api/subscription-renewals` → `{ items, current, programBalance, events }` (Tasks 2–3); `SubscriptionEventRow`, `RenewalKind`, `PROGRAM_COUNT_SHORTCUTS`, `isValidProgramCount`, `MIN/MAX_PROGRAM_COUNT`.
- Produces:
  - `RenewalRow` = `{ id; traineeId; kind: RenewalKind; startDate: string; durationMonths: number | null; endDate: string | null; programCount: number | null; createdAt: string }`
  - `type RenewalFormPayload = { kind: 'period'; startDate: string; durationMonths: number } | { kind: 'programs'; startDate: string; programCount: number }`
  - `SubscriptionRenewalFormModal` props add `defaultKind: RenewalKind`, `programBalance: number`, `todayForInput: string`.
  - `SubscriptionEventList` — default export, props `{ events: SubscriptionEventRow[] }`.
  - `TraineeSubscriptionState` adds `events: SubscriptionEventRow[]` and `programBalance: number`.

- [ ] **Step 1: Write the failing modal tests**

In `tests/unit/subscription-renewal-form-modal.test.tsx`, update `renderCreate` to pass the new required props and add a programs helper:

```tsx
const renderCreate = (defaultStartDate = '2027-01-31', extra: Partial<React.ComponentProps<typeof SubscriptionRenewalFormModal>> = {}) =>
    render(
        <SubscriptionRenewalFormModal
            mode="create"
            defaultStartDate={defaultStartDate}
            defaultKind="period"
            programBalance={0}
            todayForInput="2026-10-10"
            isSaving={false}
            onClose={onClose}
            onSubmit={onSubmit}
            {...extra}
        />
    )

const pickPrograms = () => fireEvent.click(screen.getByRole('button', { name: 'subscriptions.kind.programs' }))
const countInput = () => screen.getByLabelText(/subscriptions\.programCount/)
```

Every existing `onSubmit` expectation in this file gains `kind: 'period'` in the payload. Add:

```tsx
    it('opens on the months form by default and on programs when that is the current mode', () => {
        renderCreate()
        expect(screen.getByLabelText(/subscriptions\.duration/)).toBeInTheDocument()
        expect(screen.queryByLabelText(/subscriptions\.programCount/)).not.toBeInTheDocument()
    })

    it('opens on the programs form when defaultKind is programs', () => {
        renderCreate('2027-01-31', { defaultKind: 'programs' })

        expect(countInput()).toBeInTheDocument()
        // A package is bought today, not the day after the current expiry
        expect(screen.getByLabelText(/subscriptions\.purchaseDate/)).toHaveValue('10/10/2026')
    })

    it('submits a package with the purchase date and the count', () => {
        renderCreate()
        pickPrograms()
        fireEvent.change(countInput(), { target: { value: '5' } })
        save()

        expect(onSubmit).toHaveBeenCalledWith({ kind: 'programs', startDate: '2026-10-10', programCount: 5 })
    })

    it('fills the count from a shortcut', () => {
        renderCreate()
        pickPrograms()

        const shortcuts = screen.getAllByRole('button', { name: 'subscriptions.programCountShortcut' })
        expect(shortcuts).toHaveLength(4)
        fireEvent.click(shortcuts[2]) // 5 programs

        expect(countInput()).toHaveValue(5)
    })

    it('previews the balance after the registration, starting from the current balance', () => {
        renderCreate('2027-01-31', { programBalance: -1 })
        pickPrograms()
        fireEvent.change(countInput(), { target: { value: '5' } })

        expect(screen.getByTestId('renewal-balance-preview')).toHaveTextContent('4')
    })

    it.each(['0', '51', '2.5'])('rejects a count of %s without submitting', (value) => {
        renderCreate()
        pickPrograms()
        fireEvent.change(countInput(), { target: { value } })
        save()

        expect(onSubmit).not.toHaveBeenCalled()
        expect(screen.getByText('validation.programCountRange')).toBeInTheDocument()
    })

    it('keeps save disabled while the count is empty', () => {
        renderCreate()
        pickPrograms()

        expect(screen.getByRole('button', { name: 'common:common.save' })).toBeDisabled()
    })

    it('locks the kind when editing a package and previews the corrected balance', () => {
        render(
            <SubscriptionRenewalFormModal
                mode="edit"
                initial={{
                    id: 'p-1',
                    traineeId: 't-1',
                    kind: 'programs',
                    startDate: '2026-10-01T00:00:00.000Z',
                    durationMonths: null,
                    endDate: null,
                    programCount: 5,
                    createdAt: '2026-10-01T10:00:00.000Z',
                }}
                defaultStartDate="2026-10-10"
                defaultKind="period"
                programBalance={1}
                todayForInput="2026-10-10"
                isSaving={false}
                onClose={onClose}
                onSubmit={onSubmit}
            />
        )

        expect(screen.getByRole('button', { name: 'subscriptions.kind.period' })).toBeDisabled()
        expect(countInput()).toHaveValue(5)

        fireEvent.change(countInput(), { target: { value: '2' } })
        // balance 1 already includes this package's 5: 1 - 5 + 2
        expect(screen.getByTestId('renewal-balance-preview')).toHaveTextContent('-2')
    })
```

Run: `npx vitest run tests/unit/subscription-renewal-form-modal.test.tsx`
Expected: FAIL — toggle buttons not found.

- [ ] **Step 2: Implement the modal**

First update `RenewalRow` in `src/lib/subscriptions.ts`:

```ts
/** A renewal as the API returns it (dates serialized to ISO strings). */
export interface RenewalRow {
    id: string
    traineeId: string
    kind: RenewalKind
    /** period: first covered day. programs: purchase date */
    startDate: string
    durationMonths: number | null
    endDate: string | null
    programCount: number | null
    createdAt: string
}
```

Replace `src/components/SubscriptionRenewalFormModal.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'
import DatePicker from '@/components/DatePicker'
import {
    DURATION_SHORTCUTS,
    MAX_DURATION_MONTHS,
    MAX_PROGRAM_COUNT,
    MIN_DURATION_MONTHS,
    MIN_PROGRAM_COUNT,
    PROGRAM_COUNT_SHORTCUTS,
    addMonthsClamped,
    isValidDurationMonths,
    isValidProgramCount,
    type RenewalKind,
    type RenewalRow,
} from '@/lib/subscriptions'
import { formatDate, formatDateForInput } from '@/lib/date-format'

export type RenewalFormPayload =
    | { kind: 'period'; /** YYYY-MM-DD */ startDate: string; durationMonths: number }
    | { kind: 'programs'; /** YYYY-MM-DD, purchase date */ startDate: string; programCount: number }

export interface SubscriptionRenewalFormModalProps {
    mode: 'create' | 'edit'
    initial?: RenewalRow
    /** Create mode, months: pre-fill (see nextRenewalStart); the trainer can change it */
    defaultStartDate: string
    /** Create mode: the trainee's current mode */
    defaultKind: RenewalKind
    /** Programs currently available (negative = owed), used by the balance preview */
    programBalance: number
    /** Create mode, programs: a package is bought today */
    todayForInput: string
    isSaving: boolean
    onClose: () => void
    onSubmit: (payload: RenewalFormPayload) => void
}

const KINDS: RenewalKind[] = ['period', 'programs']

/**
 * Create / edit a renewal, by months or by package of programs. The end date
 * and the balance shown are only previews: the server computes the stored values.
 */
export default function SubscriptionRenewalFormModal({
    mode,
    initial,
    defaultStartDate,
    defaultKind,
    programBalance,
    todayForInput,
    isSaving,
    onClose,
    onSubmit,
}: SubscriptionRenewalFormModalProps) {
    const { t } = useTranslation(['trainer', 'common'])

    const [kind, setKind] = useState<RenewalKind>(() => initial?.kind ?? defaultKind)
    const [periodStart, setPeriodStart] = useState(() =>
        initial?.kind === 'period' ? formatDateForInput(initial.startDate) : defaultStartDate
    )
    const [purchaseDate, setPurchaseDate] = useState(() =>
        initial?.kind === 'programs' ? formatDateForInput(initial.startDate) : todayForInput
    )
    const [duration, setDuration] = useState(() => (initial?.durationMonths != null ? String(initial.durationMonths) : ''))
    const [programCount, setProgramCount] = useState(() => (initial?.programCount != null ? String(initial.programCount) : ''))
    const [error, setError] = useState<string | null>(null)

    const isPrograms = kind === 'programs'
    const date = isPrograms ? purchaseDate : periodStart
    const amount = isPrograms ? programCount : duration
    const dateIsValid = date !== '' && !isNaN(new Date(date).getTime())
    const canSubmit = dateIsValid && amount.trim() !== '' && !isSaving

    const months = Number(duration)
    const count = Number(programCount)
    const previewEnd = !isPrograms && dateIsValid && isValidDurationMonths(months) ? addMonthsClamped(new Date(date), months) : null
    // Editing: the current balance already includes this package, take it out before adding the new count
    const previewBalance =
        isPrograms && isValidProgramCount(count) ? programBalance - (initial?.programCount ?? 0) + count : null

    const changeKind = (next: RenewalKind) => {
        setKind(next)
        setError(null)
    }

    const handleSubmit = () => {
        if (isPrograms) {
            if (!isValidProgramCount(count)) {
                setError('validation.programCountRange')
                return
            }
            setError(null)
            onSubmit({ kind: 'programs', startDate: purchaseDate, programCount: count })
            return
        }
        if (!isValidDurationMonths(months)) {
            setError('validation.durationMonthsRange')
            return
        }
        setError(null)
        onSubmit({ kind: 'period', startDate: periodStart, durationMonths: months })
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

                {/* The kind of a recorded renewal cannot change: switching means recording a new one */}
                <div role="group" aria-label={t('subscriptions.kind.label')} className="mb-4 flex gap-2">
                    {KINDS.map((option) => (
                        <Button
                            key={option}
                            type="button"
                            variant={kind === option ? 'primary' : 'secondary'}
                            size="sm"
                            aria-pressed={kind === option}
                            onClick={() => changeKind(option)}
                            disabled={isSaving || (mode === 'edit' && kind !== option)}
                        >
                            {t(`subscriptions.kind.${option}`)}
                        </Button>
                    ))}
                </div>

                {/* Shared DatePicker: dd/MM/yyyy whatever the browser locale (a native date input follows it) */}
                <div className="mb-4">
                    <DatePicker
                        id="renewal-start-date"
                        label={isPrograms ? t('subscriptions.purchaseDate') : t('subscriptions.startDate')}
                        value={date}
                        onChange={isPrograms ? setPurchaseDate : setPeriodStart}
                        required
                        disabled={isSaving}
                    />
                </div>

                {isPrograms ? (
                    <div className="mb-4">
                        <FormLabel htmlFor="renewal-program-count" required>
                            {t('subscriptions.programCount')}
                        </FormLabel>
                        <Input
                            id="renewal-program-count"
                            type="number"
                            inputMode="numeric"
                            step={1}
                            min={MIN_PROGRAM_COUNT}
                            max={MAX_PROGRAM_COUNT}
                            value={programCount}
                            onChange={(event) => setProgramCount(event.target.value)}
                            state={error ? 'error' : 'default'}
                            helperText={error ? t(error) : undefined}
                            disabled={isSaving}
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                            {PROGRAM_COUNT_SHORTCUTS.map((shortcut) => (
                                <Button
                                    key={shortcut}
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    aria-pressed={count === shortcut}
                                    onClick={() => setProgramCount(String(shortcut))}
                                    disabled={isSaving}
                                >
                                    {t('subscriptions.programCountShortcut', { count: shortcut })}
                                </Button>
                            ))}
                        </div>
                    </div>
                ) : (
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
                )}

                {previewEnd && (
                    <p className="mb-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        {t('subscriptions.previewLabel')}{' '}
                        <strong data-testid="renewal-end-preview">{formatDate(previewEnd)}</strong>
                    </p>
                )}

                {previewBalance !== null && (
                    <p className="mb-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        {t('subscriptions.balancePreviewLabel')}{' '}
                        <strong data-testid="renewal-balance-preview">{previewBalance}</strong>
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

Before relying on `variant="primary"`, open `src/components/Button.tsx` and confirm the name of the default filled variant in `ButtonVariant`; use that name.

Run: `npx vitest run tests/unit/subscription-renewal-form-modal.test.tsx`
Expected: PASS.

- [ ] **Step 3: Write the failing event-list tests**

Create `tests/unit/subscription-event-list.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import SubscriptionEventList from '@/components/SubscriptionEventList'
import type { SubscriptionEventRow } from '@/lib/subscriptions'

const event = (overrides: Partial<SubscriptionEventRow>): SubscriptionEventRow => ({
    id: 'e1',
    type: 'package_created',
    creditDelta: 5,
    details: { purchaseDate: '2026-10-01', programCount: 5 },
    createdAt: '2026-10-01T10:00:00.000Z',
    actorName: 'Marco Trainer',
    ...overrides,
})

describe('SubscriptionEventList', () => {
    it('shows the empty state without events', () => {
        render(<SubscriptionEventList events={[]} />)

        expect(screen.getByText('subscriptions.events.empty')).toBeInTheDocument()
    })

    it('renders one row per event with description, signed delta and author', () => {
        render(
            <SubscriptionEventList
                events={[
                    event({ id: 'e2', type: 'credit_consumed', creditDelta: -1, details: { programTitle: 'Forza A' } }),
                    event({ id: 'e1' }),
                ]}
            />
        )

        const rows = screen.getAllByRole('listitem')
        expect(rows).toHaveLength(2)
        expect(within(rows[0]).getByText('subscriptions.events.types.credit_consumed')).toBeInTheDocument()
        expect(within(rows[0]).getByText('−1')).toBeInTheDocument()
        expect(within(rows[1]).getByText('+5')).toBeInTheDocument()
        expect(within(rows[1]).getByText(/Marco Trainer/)).toBeInTheDocument()
    })

    it('shows no delta for a period renewal or a forfeited credit', () => {
        render(
            <SubscriptionEventList
                events={[
                    event({ id: 'e1', type: 'period_renewal_created', creditDelta: null, details: { startDate: '2026-09-10', durationMonths: 1, endDate: '2026-10-10' } }),
                    event({ id: 'e2', type: 'credit_forfeited', creditDelta: 0, details: { programTitle: 'Forza A' } }),
                ]}
            />
        )

        expect(screen.queryByTestId('event-delta')).not.toBeInTheDocument()
    })

    it('falls back to a generic line for a type it does not know', () => {
        render(<SubscriptionEventList events={[event({ type: 'something_new' as never, creditDelta: null, details: {} })]} />)

        expect(screen.getByText('subscriptions.events.types.unknown')).toBeInTheDocument()
    })

    it('does not crash when details lack the expected fields', () => {
        render(<SubscriptionEventList events={[event({ type: 'credit_consumed', creditDelta: -1, details: {} })]} />)

        expect(screen.getByText('subscriptions.events.types.credit_consumed')).toBeInTheDocument()
    })
})
```

Run: `npx vitest run tests/unit/subscription-event-list.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the event list**

Create `src/components/SubscriptionEventList.tsx`:

```tsx
'use client'

import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/lib/date-format'
import type { SubscriptionEventRow, SubscriptionEventType } from '@/lib/subscriptions'

export interface SubscriptionEventListProps {
    events: SubscriptionEventRow[]
}

const KNOWN_TYPES: ReadonlySet<string> = new Set<SubscriptionEventType>([
    'period_renewal_created',
    'package_created',
    'renewal_updated',
    'renewal_deleted',
    'credit_consumed',
    'credit_refunded',
    'credit_forfeited',
])

/** details is free-form JSON written at the time of the event: read it defensively. */
function text(details: Record<string, unknown>, field: string): string {
    const value = details[field]
    return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function formatDelta(delta: number): string {
    // U+2212 minus: same width as the plus sign
    return delta > 0 ? `+${delta}` : `−${-delta}`
}

/** Read-only history of renewals and program-credit movements, newest first. */
export default function SubscriptionEventList({ events }: SubscriptionEventListProps) {
    const { t } = useTranslation('trainer')

    if (events.length === 0) {
        return <p className="px-6 py-8 text-center text-gray-500">{t('subscriptions.events.empty')}</p>
    }

    return (
        <ul className="divide-y divide-gray-200">
            {events.map((event) => {
                const key = KNOWN_TYPES.has(event.type) ? event.type : 'unknown'
                const delta = event.creditDelta

                return (
                    <li key={event.id} className="flex items-start justify-between gap-4 px-6 py-4">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                                {t(`subscriptions.events.types.${key}`, {
                                    title: text(event.details, 'programTitle'),
                                    count: Number(text(event.details, 'programCount')) || 0,
                                    months: text(event.details, 'durationMonths'),
                                })}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                {formatDateTime(event.createdAt)} · {event.actorName}
                            </p>
                        </div>
                        {delta !== null && delta !== 0 && (
                            <span
                                data-testid="event-delta"
                                className={`shrink-0 text-sm font-semibold ${delta > 0 ? 'text-green-700' : 'text-red-700'}`}
                            >
                                {formatDelta(delta)}
                            </span>
                        )}
                    </li>
                )
            })}
        </ul>
    )
}
```

Add to `src/components/index.ts`, next to the other subscription exports:

```ts
export { default as SubscriptionEventList } from './SubscriptionEventList'
```

Run: `npx vitest run tests/unit/subscription-event-list.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing hook and tab tests**

In `tests/unit/trainer-use-trainee-subscription.test.tsx`, add (reuse the file's fetch-mock helper and `renderHook` setup):

```tsx
    it('exposes the movement history and the program balance', async () => {
        const events = [{ id: 'e1', type: 'package_created', creditDelta: 5, details: {}, createdAt: '2026-10-01T10:00:00.000Z', actorName: 'Marco Trainer' }]
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { items: [], current: null, programBalance: 3, events } }),
        }) as never

        const { result } = renderHook(() => useTraineeSubscription('t-1'))

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.events).toEqual(events)
        expect(result.current.programBalance).toBe(3)
    })

    it('defaults to no events and a zero balance when the API omits them', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { items: [], current: null } }) }) as never

        const { result } = renderHook(() => useTraineeSubscription('t-1'))

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.events).toEqual([])
        expect(result.current.programBalance).toBe(0)
    })
```

In `tests/unit/trainer-subscription-tab.test.tsx`: the `renewal` fixture gains `kind: 'period' as const` and `programCount: null`; `makeState` gains `events: []` and `programBalance: 0`. Add:

```tsx
    const packageRow = {
        id: 'p-1',
        traineeId: TRAINEE_ID,
        kind: 'programs' as const,
        startDate: '2026-10-01T00:00:00.000Z',
        durationMonths: null,
        endDate: null,
        programCount: 5,
        createdAt: '2026-10-01T10:00:00.000Z',
    }

    it('shows packages and period renewals in one history table', () => {
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState({ renewals: [packageRow, renewal] })} />)

        const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
        expect(rows).toHaveLength(2)
        expect(within(rows[0]).getByText('subscriptions.kind.programs')).toBeInTheDocument()
        expect(within(rows[0]).getByText('subscriptions.programCountValue')).toBeInTheDocument()
        expect(within(rows[1]).getByText('subscriptions.kind.period')).toBeInTheDocument()
    })

    it('shows the program balance when the trainee has packages', () => {
        render(
            <SubscriptionTab
                traineeId={TRAINEE_ID}
                state={makeState({ renewals: [packageRow], current: { kind: 'programs', status: 'active', remaining: 3 }, programBalance: 3 })}
            />
        )

        expect(screen.getByTestId('program-balance')).toHaveTextContent('subscriptions.programs.available')
    })

    it('hides the program balance for a trainee who never bought a package', () => {
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState()} />)

        expect(screen.queryByTestId('program-balance')).not.toBeInTheDocument()
    })

    it('opens a new renewal on the programs form for a package trainee, dated today', () => {
        render(
            <SubscriptionTab
                traineeId={TRAINEE_ID}
                state={makeState({ renewals: [packageRow], current: { kind: 'programs', status: 'expired', remaining: 0 } })}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.addButton' }))

        expect(screen.getByLabelText(/subscriptions\.programCount/)).toBeInTheDocument()
    })

    it('sends the package payload when saving', async () => {
        mockFetchOk()
        const state = makeState({ renewals: [packageRow], current: { kind: 'programs', status: 'expired', remaining: 0 } })
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={state} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.addButton' }))
        fireEvent.change(screen.getByLabelText(/subscriptions\.programCount/), { target: { value: '3' } })
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(state.reload).toHaveBeenCalled())
        const [, init] = vi.mocked(global.fetch).mock.calls[0]
        expect(JSON.parse(String(init?.body))).toMatchObject({ traineeId: TRAINEE_ID, kind: 'programs', programCount: 3 })
    })

    it('lists the movements below the history', () => {
        render(
            <SubscriptionTab
                traineeId={TRAINEE_ID}
                state={makeState({
                    events: [{ id: 'e1', type: 'package_created', creditDelta: 5, details: { programCount: 5 }, createdAt: '2026-10-01T10:00:00.000Z', actorName: 'Marco Trainer' }],
                })}
            />
        )

        expect(screen.getByText('subscriptions.events.title')).toBeInTheDocument()
        expect(screen.getByText('subscriptions.events.types.package_created')).toBeInTheDocument()
    })

    it('asks to confirm a package deletion with its own message', () => {
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState({ renewals: [packageRow] })} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.deleteAction' }))

        expect(screen.getByText('subscriptions.deletePackageMessage')).toBeInTheDocument()
    })
```

Run: `npx vitest run tests/unit/trainer-subscription-tab.test.tsx tests/unit/trainer-use-trainee-subscription.test.tsx`
Expected: FAIL on the new cases.

- [ ] **Step 6: Implement the hook and the tab**

`src/app/trainer/trainees/[id]/_use-trainee-subscription.ts`:

```ts
import type { RenewalRow, SubscriptionEventRow, SubscriptionSummary } from '@/lib/subscriptions'

export interface TraineeSubscriptionState {
    renewals: RenewalRow[]
    current: SubscriptionSummary | null
    /** Movement history, newest first */
    events: SubscriptionEventRow[]
    /** Programs available across every package, whatever the current mode (negative = owed) */
    programBalance: number
    loading: boolean
    error: boolean
    reload: () => Promise<void>
}
```

Inside the hook add `const [events, setEvents] = useState<SubscriptionEventRow[]>([])` and `const [programBalance, setProgramBalance] = useState(0)`; in `reload` after `setCurrent(...)` add `setEvents(data.data?.events ?? [])` and `setProgramBalance(data.data?.programBalance ?? 0)`; return `{ renewals, current, events, programBalance, loading, error, reload }`.

`src/app/trainer/trainees/[id]/_subscription-tab.tsx`:

Imports — add:

```tsx
import SubscriptionEventList from '@/components/SubscriptionEventList'
import { nextRenewalStart, programsLabel, type RenewalRow } from '@/lib/subscriptions'
```

Destructure `events` and `programBalance` from `state`. Add after the state declarations:

```tsx
    const hasPackages = renewals.some((row) => row.kind === 'programs')
    const balanceLabel = programsLabel(programBalance)
```

Header block — add the balance line under the subtitle:

```tsx
                    <p className="mt-1 text-sm text-gray-600">{t('subscriptions.subtitle')}</p>
                    {hasPackages && (
                        <p data-testid="program-balance" className="mt-2 text-sm font-semibold text-gray-900">
                            {t(balanceLabel.key, { count: balanceLabel.count })}
                        </p>
                    )}
```

History table — the header column list becomes `['kindColumn', 'startColumn', 'durationColumn', 'endColumn', 'createdColumn']`, and the row cells become:

```tsx
                                    <tr key={row.id}>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{t(`subscriptions.kind.${row.kind}`)}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{formatDate(row.startDate)}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                                            {row.kind === 'programs'
                                                ? t('subscriptions.programCountValue', { count: row.programCount ?? 0 })
                                                : t('subscriptions.durationValue', { count: row.durationMonths ?? 0 })}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900">
                                            {row.endDate ? formatDate(row.endDate) : '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{formatDate(row.createdAt)}</td>
```

(the actions cell is unchanged)

After the history `</section>` add:

```tsx
            <section className="overflow-hidden rounded-lg bg-white shadow-md">
                <h3 className="px-6 pt-6 pb-2 text-lg font-semibold text-gray-900">{t('subscriptions.events.title')}</h3>
                <SubscriptionEventList events={events} />
            </section>
```

Modal usage:

```tsx
                <SubscriptionRenewalFormModal
                    mode={modal.mode}
                    initial={modal.initial}
                    defaultStartDate={nextRenewalStart(current?.kind === 'period' ? current.endDate : null, getTodayForInput())}
                    defaultKind={current?.kind ?? 'period'}
                    programBalance={programBalance}
                    todayForInput={getTodayForInput()}
                    isSaving={saving}
                    onClose={() => setModal(null)}
                    onSubmit={(payload) => void handleSubmit(payload)}
                />
```

Delete confirmation message:

```tsx
                    message={
                        pendingDelete.kind === 'programs'
                            ? t('subscriptions.deletePackageMessage', {
                                  date: formatDate(pendingDelete.startDate),
                                  count: pendingDelete.programCount ?? 0,
                              })
                            : t('subscriptions.deleteMessage', {
                                  start: formatDate(pendingDelete.startDate),
                                  end: pendingDelete.endDate ? formatDate(pendingDelete.endDate) : '—',
                              })
                    }
```

- [ ] **Step 7: Add the i18n keys**

`public/locales/it/trainer.json`, inside `"subscriptions"`:

```json
"kind": { "label": "Tipo di rinnovo", "period": "A mesi", "programs": "A schede" },
"kindColumn": "Tipo",
"purchaseDate": "Data acquisto",
"programCount": "Numero di schede",
"programCountShortcut": "{{count}}",
"programCountValue_one": "{{count}} scheda",
"programCountValue_other": "{{count}} schede",
"balancePreviewLabel": "Saldo dopo la registrazione:",
"deletePackageMessage": "Eliminare il pacchetto da {{count}} schede del {{date}}? Il saldo verrà ricalcolato.",
"events": {
    "title": "Movimenti",
    "empty": "Nessun movimento registrato",
    "types": {
        "period_renewal_created": "Rinnovo di {{months}} mesi registrato",
        "package_created": "Pacchetto da {{count}} schede registrato",
        "renewal_updated": "Rinnovo modificato",
        "renewal_deleted": "Rinnovo eliminato",
        "credit_consumed": "Scheda «{{title}}» pubblicata",
        "credit_refunded": "Scheda «{{title}}» eliminata: scheda rimborsata",
        "credit_forfeited": "Scheda «{{title}}» eliminata senza rimborso",
        "unknown": "Movimento"
    }
},
```

`public/locales/en/trainer.json`, same position:

```json
"kind": { "label": "Renewal type", "period": "By months", "programs": "By programs" },
"kindColumn": "Type",
"purchaseDate": "Purchase date",
"programCount": "Number of programs",
"programCountShortcut": "{{count}}",
"programCountValue_one": "{{count}} program",
"programCountValue_other": "{{count}} programs",
"balancePreviewLabel": "Balance after recording:",
"deletePackageMessage": "Delete the package of {{count}} programs bought on {{date}}? The balance will be recalculated.",
"events": {
    "title": "Movements",
    "empty": "No movements recorded",
    "types": {
        "period_renewal_created": "{{months}}-month renewal recorded",
        "package_created": "Package of {{count}} programs recorded",
        "renewal_updated": "Renewal edited",
        "renewal_deleted": "Renewal deleted",
        "credit_consumed": "Program “{{title}}” published",
        "credit_refunded": "Program “{{title}}” deleted: program refunded",
        "credit_forfeited": "Program “{{title}}” deleted without refund",
        "unknown": "Movement"
    }
},
```

Also change, in both files, `"startColumn"` to `"Inizio / acquisto"` (en: `"Start / purchase"`) and `"durationColumn"` to `"Durata / schede"` (en: `"Duration / programs"`).

- [ ] **Step 8: Verify and commit**

Run: `npm run type-check && npm run lint && npm run test:unit`
Expected: PASS.

```bash
git add src/lib/subscriptions.ts src/components "src/app/trainer/trainees/[id]" public/locales tests implementation-docs/CHANGELOG.md
git commit -m "feat(subscriptions): record program packages and show the movement history"
```

---

### Task 7: Publish page — balance info and uncovered confirmation

**Files:**
- Modify: `src/app/trainer/programs/[id]/publish/_content.tsx`
- Modify: `public/locales/it/trainer.json`, `public/locales/en/trainer.json`
- Test: `tests/unit/trainer-publish-program.test.tsx` (new)

**Interfaces:**
- Consumes: `GET /api/subscription-renewals?traineeId=` → `data.current: SubscriptionSummary | null`; `uncoveredReason`, `SubscriptionSummary` from `@/lib/subscriptions`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/trainer-publish-program.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

import PublishProgramPage from '@/app/trainer/programs/[id]/publish/_content'
import type { SubscriptionSummary } from '@/lib/subscriptions'

const program = {
    id: 'prog-1',
    title: 'Forza A',
    status: 'draft',
    trainee: { id: 't-1', firstName: 'Mario', lastName: 'Rossi' },
    durationWeeks: 1,
    workoutsPerWeek: 1,
    startDate: null,
    weeks: [{ weekNumber: 1, weekType: 'normal', workouts: [{ id: 'w1', dayIndex: 1, workoutExercises: [{ id: 'we1' }] }] }],
}

/** Program detail, then the trainee's subscription, then the publish call. */
function mockApi(current: SubscriptionSummary | null, subscriptionOk = true) {
    global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/subscription-renewals')) {
            return Promise.resolve({ ok: subscriptionOk, json: async () => ({ data: { current } }) })
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: { program } }) })
    }) as never
}

const clickPublish = async () => fireEvent.click(await screen.findByRole('button', { name: 'publish.publishButton' }))

describe('PublishProgramPage — subscription coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows how the balance changes for a package trainee', async () => {
        mockApi({ kind: 'programs', status: 'active', remaining: 3 })
        render(<PublishProgramPage />)

        expect(await screen.findByTestId('publish-credit-info')).toHaveTextContent('publish.creditInfo')
    })

    it('shows no balance line for a period trainee', async () => {
        mockApi({ kind: 'period', status: 'active', endDate: '2026-12-01T00:00:00.000Z', daysLeft: 50 })
        render(<PublishProgramPage />)

        await screen.findByRole('button', { name: 'publish.publishButton' })
        expect(screen.queryByTestId('publish-credit-info')).not.toBeInTheDocument()
    })

    it.each([
        ['programsExhausted', { kind: 'programs', status: 'expired', remaining: 0 }],
        ['periodExpired', { kind: 'period', status: 'expired', endDate: '2026-09-01T00:00:00.000Z', daysLeft: -30 }],
        ['none', null],
    ] as const)('warns before publishing without coverage (%s)', async (reason, current) => {
        mockApi(current as SubscriptionSummary | null)
        render(<PublishProgramPage />)

        await clickPublish()

        expect(await screen.findByText(new RegExp(`publish\\.uncovered\\.${reason}`))).toBeInTheDocument()
    })

    it('uses the plain confirmation for a covered trainee', async () => {
        mockApi({ kind: 'programs', status: 'expiring', remaining: 1 })
        render(<PublishProgramPage />)

        await clickPublish()

        expect(await screen.findByText('publish.confirmMessage')).toBeInTheDocument()
        expect(screen.queryByText(/publish\.uncovered\./)).not.toBeInTheDocument()
    })

    it('does not block or warn when the subscription cannot be loaded', async () => {
        mockApi(null, false)
        render(<PublishProgramPage />)

        await clickPublish()

        expect(await screen.findByText('publish.confirmMessage')).toBeInTheDocument()
    })

    it('still publishes after the warning is confirmed', async () => {
        mockApi({ kind: 'programs', status: 'expired', remaining: 0 })
        render(<PublishProgramPage />)

        await clickPublish()
        fireEvent.click(await screen.findByRole('button', { name: /publish\.uncovered\.confirm/ }))

        await waitFor(() =>
            expect(vi.mocked(global.fetch).mock.calls.some(([url, init]) => String(url).endsWith('/publish') && init?.method === 'POST')).toBe(true)
        )
    })
})
```

Notes for the implementer: the global test setup mocks `useParams()` as `{}`, so `programId` is `undefined` in these tests — the URL checks above only rely on the path suffix. `ConfirmationModal` renders the confirm button with an accessible name that contains the `confirmText`; if the regex on the button name does not match, check how `ConfirmationModal` builds `aria-label` and adapt the query, not the component.

Run: `npx vitest run tests/unit/trainer-publish-program.test.tsx`
Expected: FAIL — `publish-credit-info` not found, no uncovered message.

- [ ] **Step 2: Implement**

In `src/app/trainer/programs/[id]/publish/_content.tsx`:

Imports:

```tsx
import { formatDate, getTodayForInput } from '@/lib/date-format'
import { uncoveredReason, type SubscriptionSummary } from '@/lib/subscriptions'
```

State, next to the other `useState` calls:

```tsx
    // undefined = not loaded (or failed): no warning is shown, the publish is never held back by it
    const [subscription, setSubscription] = useState<SubscriptionSummary | null | undefined>(undefined)
```

In `fetchProgram`, right after `validateProgram(transformedProgram)`:

```tsx
            // Coverage is informative: a failure here must not prevent publishing
            try {
                const subscriptionRes = await fetch(`/api/subscription-renewals?traineeId=${transformedProgram.trainee.id}`, {
                    cache: 'no-store',
                })
                if (subscriptionRes.ok) {
                    const subscriptionData = await subscriptionRes.json()
                    setSubscription(subscriptionData.data?.current ?? null)
                }
            } catch {
                setSubscription(undefined)
            }
```

Replace the `setConfirmModal({...})` call at the end of `handlePublish`:

```tsx
        const reason = subscription === undefined ? null : uncoveredReason(subscription)

        if (reason) {
            setConfirmModal({
                title: t('publish.uncovered.title'),
                message: `${t(`publish.uncovered.${reason}`, {
                    date: subscription?.kind === 'period' ? formatDate(subscription.endDate) : '',
                })}\n\n${t('publish.confirmMessage')}`,
                confirmText: t('publish.uncovered.confirm'),
                variant: 'warning',
                onConfirm: doPublish,
            })
            return
        }

        setConfirmModal({
            title: t('publish.title'),
            message: t('publish.confirmMessage'),
            confirmText: t('publish.confirmButton'),
            variant: 'info',
            onConfirm: doPublish,
        })
```

Inside the "Start Date Selection" card (`canPublish` block), after the `DatePicker`:

```tsx
                        {subscription?.kind === 'programs' && (
                            <p data-testid="publish-credit-info" className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                                {t('publish.creditInfo', { before: subscription.remaining, after: subscription.remaining - 1 })}
                            </p>
                        )}
```

- [ ] **Step 3: Add the i18n keys**

`public/locales/it/trainer.json`, inside `"publish"`:

```json
"creditInfo": "Schede disponibili: {{before}} → {{after}} dopo la pubblicazione",
"uncovered": {
    "title": "Atleta senza copertura",
    "programsExhausted": "L'atleta ha esaurito le schede acquistate: pubblicando andrà in debito di una scheda.",
    "periodExpired": "L'abbonamento dell'atleta è scaduto il {{date}}.",
    "none": "Per questo atleta non è registrato alcun abbonamento.",
    "confirm": "Pubblica comunque"
}
```

`public/locales/en/trainer.json`:

```json
"creditInfo": "Programs available: {{before}} → {{after}} after publishing",
"uncovered": {
    "title": "Athlete without coverage",
    "programsExhausted": "The athlete has used every purchased program: publishing will put them one program in debt.",
    "periodExpired": "The athlete's subscription expired on {{date}}.",
    "none": "No subscription is recorded for this athlete.",
    "confirm": "Publish anyway"
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm run type-check && npm run lint && npx vitest run tests/unit/trainer-publish-program.test.tsx`
Expected: PASS.

```bash
git add "src/app/trainer/programs/[id]/publish/_content.tsx" public/locales tests implementation-docs/CHANGELOG.md
git commit -m "feat(programs): warn before publishing for an athlete without coverage"
```

---

### Task 8: Refund popup when deleting a program

**Files:**
- Create: `src/components/ProgramCreditRefundModal.tsx`
- Modify: `src/components/index.ts`, `src/components/ProgramTraineeTable.tsx` (type only)
- Modify: `src/app/trainer/programs/_content.tsx`
- Modify: `src/app/trainer/trainees/[id]/_content.tsx`
- Modify: `public/locales/it/trainer.json`, `public/locales/en/trainer.json`
- Test: `tests/unit/program-credit-refund-modal.test.tsx` (new), `tests/unit/trainer-programs-content.test.tsx`, `tests/unit/trainer-trainee-programs-tab.test.tsx`

**Interfaces:**
- Consumes: `consumedCredit` on `GET /api/programs` items, `DELETE /api/programs/[id]?refundCredit=` (Task 5).
- Produces: `ProgramCreditRefundModal` — default export, props `{ programTitle: string; isLoading: boolean; onRefund: () => void; onKeep: () => void; onClose: () => void }`.

- [ ] **Step 1: Write the failing modal tests**

Create `tests/unit/program-credit-refund-modal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ProgramCreditRefundModal from '@/components/ProgramCreditRefundModal'

const onRefund = vi.fn()
const onKeep = vi.fn()
const onClose = vi.fn()

const renderModal = (isLoading = false) =>
    render(<ProgramCreditRefundModal programTitle="Forza A" isLoading={isLoading} onRefund={onRefund} onKeep={onKeep} onClose={onClose} />)

describe('ProgramCreditRefundModal', () => {
    beforeEach(() => vi.clearAllMocks())

    it('explains that the program consumed a credit', () => {
        renderModal()

        expect(screen.getByRole('dialog')).toHaveTextContent('programs.refund.message')
    })

    it('offers refund, delete without refund and cancel as three separate choices', () => {
        renderModal()

        fireEvent.click(screen.getByRole('button', { name: 'programs.refund.refund' }))
        expect(onRefund).toHaveBeenCalledTimes(1)
        expect(onKeep).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'programs.refund.keep' }))
        expect(onKeep).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByRole('button', { name: 'common:common.cancel' }))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('disables every choice while the deletion is running', () => {
        renderModal(true)

        for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
    })
})
```

Run: `npx vitest run tests/unit/program-credit-refund-modal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement the modal**

Create `src/components/ProgramCreditRefundModal.tsx`:

```tsx
'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'

export interface ProgramCreditRefundModalProps {
    programTitle: string
    isLoading: boolean
    /** Delete the program and give the program credit back to the athlete */
    onRefund: () => void
    /** Delete the program, the credit stays spent */
    onKeep: () => void
    onClose: () => void
}

/**
 * Shown instead of the plain delete confirmation when the program consumed a
 * program credit: the trainer decides, case by case, whether the athlete gets it back.
 */
export default function ProgramCreditRefundModal({ programTitle, isLoading, onRefund, onKeep, onClose }: ProgramCreditRefundModalProps) {
    const { t } = useTranslation(['trainer', 'common'])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="refund-modal-title"
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            >
                <h2 id="refund-modal-title" className="mb-3 text-xl font-bold text-gray-900">
                    {t('programs.refund.title')}
                </h2>
                <p className="mb-2 text-sm text-gray-700">{t('programs.refund.message', { title: programTitle })}</p>
                <p className="mb-6 text-sm text-gray-600">{t('programs.confirmDeleteProgramWarning')}</p>

                <div className="flex flex-col gap-3">
                    <Button type="button" onClick={onRefund} disabled={isLoading} isLoading={isLoading} loadingText={t('common:common.saving')}>
                        {t('programs.refund.refund')}
                    </Button>
                    <Button type="button" variant="secondary" onClick={onKeep} disabled={isLoading}>
                        {t('programs.refund.keep')}
                    </Button>
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                        {t('common:common.cancel')}
                    </Button>
                </div>
            </div>
        </div>
    )
}
```

Add to `src/components/index.ts`:

```ts
export { default as ProgramCreditRefundModal } from './ProgramCreditRefundModal'
```

Add to `ProgramTraineeTableProgram` in `src/components/ProgramTraineeTable.tsx`:

```ts
    /** Trainer/admin only: the program consumed a program credit when it was published */
    consumedCredit?: boolean
```

Run: `npx vitest run tests/unit/program-credit-refund-modal.test.tsx`
Expected: PASS.

- [ ] **Step 3: Write the failing delete-flow tests**

In `tests/unit/trainer-programs-content.test.tsx`, add `consumedCredit: true` to the third fixture of `activePrograms` (`id: 'program-3'`, "Programma Test Fatti"). The existing delete test clicks the first row, so it keeps exercising the plain confirmation. Add inside the `describe`:

```tsx
    /** program-3 is the third active row: it consumed a program credit */
    const openRefundPopup = async () => {
        render(<TrainerProgramsContent />)
        await waitFor(() => {
            expect(screen.getByText('Programma Test Fatti')).toBeInTheDocument()
        })
        fireEvent.click(screen.getAllByLabelText('programs.delete')[2])
        return screen.findByRole('dialog')
    }

    const deleteCalls = () =>
        vi
            .mocked(global.fetch)
            .mock.calls.filter((call) => call[1]?.method === 'DELETE')
            .map((call) => String(call[0]))

    it('asks whether to refund when deleting a program that consumed a credit', async () => {
        const dialog = await openRefundPopup()

        expect(within(dialog).getByText('programs.refund.message')).toBeInTheDocument()
        expect(within(dialog).queryByText('programs.deleteProgram')).not.toBeInTheDocument()
    })

    it('deletes with refundCredit=true when the trainer refunds', async () => {
        const dialog = await openRefundPopup()

        fireEvent.click(within(dialog).getByRole('button', { name: 'programs.refund.refund' }))

        await waitFor(() => expect(deleteCalls()).toEqual(['/api/programs/program-3?refundCredit=true']))
    })

    it('deletes with refundCredit=false when the trainer keeps the credit spent', async () => {
        const dialog = await openRefundPopup()

        fireEvent.click(within(dialog).getByRole('button', { name: 'programs.refund.keep' }))

        await waitFor(() => expect(deleteCalls()).toEqual(['/api/programs/program-3?refundCredit=false']))
    })

    it('deletes nothing when the refund popup is cancelled', async () => {
        const dialog = await openRefundPopup()

        fireEvent.click(within(dialog).getByRole('button', { name: 'common:common.cancel' }))

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(deleteCalls()).toEqual([])
    })

    it('sends no refundCredit parameter for a program that consumed no credit', async () => {
        render(<TrainerProgramsContent />)
        await waitFor(() => {
            expect(screen.getByText('Programma Senza Test')).toBeInTheDocument()
        })

        fireEvent.click(screen.getAllByLabelText('programs.delete')[0])
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByText('programs.delete'))

        await waitFor(() => expect(deleteCalls()).toEqual(['/api/programs/program-1']))
    })
```

In `tests/unit/trainer-trainee-programs-tab.test.tsx`:
- the fetch mock's DELETE branch derives the id with `url.split('/api/programs/')[1]`; change it to `url.split('/api/programs/')[1].split('?')[0]` so a query string does not break the in-memory removal;
- the subscription mock response gains `kind: 'period'` in `current` (already required by Task 1), plus `events: []` and `programBalance: 0`;
- add (`programsByStatus` is the mutable fixture map that file's fetch mock reads; the first active program is "Programma Active Pending"):

```tsx
    const deleteCalls = () =>
        vi
            .mocked(global.fetch)
            .mock.calls.filter((call) => call[1]?.method === 'DELETE')
            .map((call) => String(call[0]))

    const openRefundPopup = async () => {
        programsByStatus.active[0] = { ...programsByStatus.active[0], consumedCredit: true }
        render(<TraineeDetailContent />)
        expect(await screen.findByText('Programma Active Pending')).toBeInTheDocument()
        fireEvent.click(screen.getAllByLabelText('programs.delete')[0])
        return screen.findByRole('dialog')
    }

    it('asks whether to refund when deleting a program that consumed a credit', async () => {
        const dialog = await openRefundPopup()

        expect(within(dialog).getByText('programs.refund.message')).toBeInTheDocument()
    })

    it('refunds, then reloads the subscription so the balance on screen is current', async () => {
        const dialog = await openRefundPopup()
        const subscriptionLoads = () =>
            vi.mocked(global.fetch).mock.calls.filter((call) => String(call[0]).startsWith('/api/subscription-renewals')).length
        const loadsBefore = subscriptionLoads()

        fireEvent.click(within(dialog).getByRole('button', { name: 'programs.refund.refund' }))

        await waitFor(() => expect(deleteCalls()).toHaveLength(1))
        expect(deleteCalls()[0]).toMatch(/\?refundCredit=true$/)
        await waitFor(() => expect(subscriptionLoads()).toBe(loadsBefore + 1))
    })

    it('keeps the credit spent when the trainer chooses not to refund', async () => {
        const dialog = await openRefundPopup()

        fireEvent.click(within(dialog).getByRole('button', { name: 'programs.refund.keep' }))

        await waitFor(() => expect(deleteCalls()).toHaveLength(1))
        expect(deleteCalls()[0]).toMatch(/\?refundCredit=false$/)
    })
```

If `programsByStatus` is not in scope of the tests (declared inside `beforeEach` with `const`), hoist its declaration to a `let` at `describe` level, assigned in `beforeEach` — do not duplicate the fixture.

Run: `npx vitest run tests/unit/trainer-programs-content.test.tsx tests/unit/trainer-trainee-programs-tab.test.tsx`
Expected: FAIL — the plain confirmation is shown instead of the refund popup.

- [ ] **Step 4: Implement the flow in the programs list**

In `src/app/trainer/programs/_content.tsx`:

Add `import ProgramCreditRefundModal from '@/components/ProgramCreditRefundModal'`, add `consumedCredit?: boolean` to the local `Program` interface, and add state:

```tsx
    const [refundTarget, setRefundTarget] = useState<{ id: string; title: string } | null>(null)
    const [deletingWithRefundChoice, setDeletingWithRefundChoice] = useState(false)
```

Replace `handleDelete` with:

```tsx
    /** refundCredit is passed only for a program that consumed a program credit */
    const deleteProgram = async (id: string, refundCredit?: boolean) => {
        const query = refundCredit === undefined ? '' : `?refundCredit=${refundCredit}`
        try {
            const res = await fetch(`/api/programs/${id}${query}`, {
                method: 'DELETE',
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('programs.deleteError'), t))
            }

            programsCacheRef.current.clear()
            void runForegroundFetch({
                status: activeTab,
                page: currentPage,
                search: appliedSearchTerm,
                silent: false,
            })
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : t('programs.deleteError'), 'error')
        }
    }

    const handleRefundChoice = async (refundCredit: boolean) => {
        if (!refundTarget) return
        setDeletingWithRefundChoice(true)
        await deleteProgram(refundTarget.id, refundCredit)
        setDeletingWithRefundChoice(false)
        setRefundTarget(null)
    }

    const handleDelete = (id: string, title: string, status: ProgramStatusTab) => {
        // A program that consumed a credit: the trainer decides whether the athlete gets it back
        if (programs.find((program) => program.id === id)?.consumedCredit) {
            setRefundTarget({ id, title })
            return
        }

        const baseMessage = `${t('programs.confirmDeleteProgram')} "${title}"?`
        setConfirmModal({
            title: t('programs.deleteProgram'),
            message:
                status === 'draft'
                    ? baseMessage
                    : `${baseMessage}\n\n${t('programs.confirmDeleteProgramWarning')}`,
            confirmText: t('programs.delete'),
            onConfirm: async () => {
                setConfirmModal(null)
                await deleteProgram(id)
            },
        })
    }
```

Render the popup next to the existing `ConfirmationModal`:

```tsx
            {refundTarget && (
                <ProgramCreditRefundModal
                    programTitle={refundTarget.title}
                    isLoading={deletingWithRefundChoice}
                    onRefund={() => void handleRefundChoice(true)}
                    onKeep={() => void handleRefundChoice(false)}
                    onClose={() => setRefundTarget(null)}
                />
            )}
```

- [ ] **Step 5: Implement the flow in the trainee page**

In `src/app/trainer/trainees/[id]/_content.tsx`:

Add `import ProgramCreditRefundModal from '@/components/ProgramCreditRefundModal'`. If the file declares its own `Program` interface, add `consumedCredit?: boolean` to it (if it uses `ProgramTraineeTableProgram`, Step 2 already covered it). Add state:

```tsx
    const [refundTarget, setRefundTarget] = useState<{ id: string; title: string } | null>(null)
    const [deletingWithRefundChoice, setDeletingWithRefundChoice] = useState(false)
```

Replace `handleDeleteProgram` with:

```tsx
    /** refundCredit is passed only for a program that consumed a program credit */
    const deleteProgram = async (id: string, refundCredit?: boolean) => {
        const query = refundCredit === undefined ? '' : `?refundCredit=${refundCredit}`
        try {
            const res = await fetch(`/api/programs/${id}${query}`, {
                method: 'DELETE',
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('programs.deleteError'), t))
            }

            programsCacheRef.current.clear()
            void runForegroundProgramsFetch({
                status: activeProgramTab,
                page: programCurrentPage,
                search: appliedProgramSearchTerm,
                silent: false,
            })
            // A refund changes the balance shown by the header icon, the banner and the subscription tab
            if (refundCredit !== undefined) void subscription.reload()
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : t('programs.deleteError'), 'error')
        }
    }

    const handleRefundChoice = async (refundCredit: boolean) => {
        if (!refundTarget) return
        setDeletingWithRefundChoice(true)
        await deleteProgram(refundTarget.id, refundCredit)
        setDeletingWithRefundChoice(false)
        setRefundTarget(null)
    }

    const handleDeleteProgram = (id: string, title: string, status: ProgramStatusTab) => {
        // A program that consumed a credit: the trainer decides whether the athlete gets it back
        if (programs.find((program) => program.id === id)?.consumedCredit) {
            setRefundTarget({ id, title })
            return
        }

        const baseMessage = `${t('programs.confirmDeleteProgram')} "${title}"?`
        setConfirmModal({
            title: t('programs.deleteProgram'),
            message:
                status === 'draft'
                    ? baseMessage
                    : `${baseMessage}\n\n${t('programs.confirmDeleteProgramWarning')}`,
            confirmText: t('programs.delete'),
            onConfirm: async () => {
                setConfirmModal(null)
                await deleteProgram(id)
            },
        })
    }
```

Render the popup next to this page's `ConfirmationModal`:

```tsx
            {refundTarget && (
                <ProgramCreditRefundModal
                    programTitle={refundTarget.title}
                    isLoading={deletingWithRefundChoice}
                    onRefund={() => void handleRefundChoice(true)}
                    onKeep={() => void handleRefundChoice(false)}
                    onClose={() => setRefundTarget(null)}
                />
            )}
```

`subscription` is the existing `const subscription = useTraineeSubscription(traineeId)` in this component.

- [ ] **Step 6: Add the i18n keys**

`public/locales/it/trainer.json`, inside `"programs"`:

```json
"refund": {
    "title": "Elimina programma",
    "message": "Il programma \"{{title}}\" ha scalato una scheda dal pacchetto dell'atleta. Vuoi restituirla?",
    "refund": "Elimina e rimborsa la scheda",
    "keep": "Elimina senza rimborso"
}
```

`public/locales/en/trainer.json`:

```json
"refund": {
    "title": "Delete program",
    "message": "The program \"{{title}}\" used one program from the athlete's package. Do you want to give it back?",
    "refund": "Delete and refund the program",
    "keep": "Delete without refund"
}
```

- [ ] **Step 7: Verify and commit**

Run: `npm run type-check && npm run lint && npm run test:unit`
Expected: PASS.

```bash
git add src/components src/app/trainer public/locales tests implementation-docs/CHANGELOG.md
git commit -m "feat(programs): refund popup when deleting a program that used a package credit"
```

---

### Task 9: End-to-end flow and final verification

**Files:**
- Create: `tests/e2e/trainer-program-packages.spec.ts`
- Modify: `implementation-docs/CHANGELOG.md`

**Interfaces:**
- Consumes: the whole feature. Produces nothing.

- [ ] **Step 1: Write the E2E spec**

Create `tests/e2e/trainer-program-packages.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { E2E_CREDENTIALS } from './fixtures/test-users'

/**
 * E2E: trainer records a package of one program, sees the "last program"
 * warning on every alert surface, then deletes the package and the warning goes.
 *
 * Prerequisites:
 *   - Seed data present (see ./fixtures/test-users.ts)
 *   - Server running at http://localhost:3000
 *   - Migration 20261010000000_add_program_package_renewals applied
 */

const LAST = /ultima scheda disponibile|last program available/i

test.describe('Trainer: program packages', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CREDENTIALS.trainer.email)
        await page.fill('input[name="password"]', E2E_CREDENTIALS.trainer.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('**/trainer/dashboard', { timeout: 10_000 })
    })

    test('a package of one program warns everywhere, and deleting it clears the warning', async ({ page }) => {
        await page.goto('/trainer/trainees')
        await page.getByRole('link', { name: /dettagl|detail|gestisci/i }).first().click()
        await page.waitForURL(/\/trainer\/trainees\/[^/?]+$/)
        const traineeUrl = page.url()
        const traineeName = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? ''

        // Record a package of 1 program
        await page.getByRole('button', { name: /^(abbonamento|subscription)$/i }).click()
        await page.getByRole('button', { name: /registra rinnovo|record renewal/i }).click()
        const dialog = page.getByRole('dialog')
        await dialog.getByRole('button', { name: /a schede|by programs/i }).click()
        await dialog.locator('#renewal-program-count').fill('1')
        await expect(dialog.getByTestId('renewal-balance-preview')).toBeVisible()
        await dialog.getByRole('button', { name: /salva|save/i }).click()
        await expect(dialog).toBeHidden()

        // Tab: balance line and the movement
        await expect(page.getByTestId('program-balance')).toHaveText(LAST)
        await expect(page.getByText(/pacchetto da 1 schede registrato|package of 1 programs recorded/i)).toBeVisible()

        // Profile banner
        const banner = page.getByRole('alert').filter({ hasText: LAST })
        await expect(banner).toBeVisible()

        // Athlete list icon
        await page.goto('/trainer/trainees')
        const row = page.getByRole('row').filter({ hasText: traineeName })
        await expect(row.getByRole('img', { name: LAST })).toBeVisible()

        // Subscriptions page
        await page.goto('/trainer/subscriptions')
        const list = page.getByRole('list', { name: /abbonamenti registrati|recorded subscriptions/i })
        await expect(list.getByRole('link').filter({ hasText: traineeName }).filter({ hasText: LAST })).toBeVisible()

        // Home alerts
        await page.goto('/trainer/dashboard')
        await expect(page.getByRole('link').filter({ hasText: traineeName }).filter({ hasText: LAST })).toHaveCount(1)

        // Clean up: delete the package, the banner disappears, the deletion is in the history
        await page.goto(`${traineeUrl}?tab=subscription`)
        await page.getByRole('button', { name: /elimina rinnovo|delete renewal/i }).first().click()
        await page.getByRole('dialog').getByRole('button', { name: /elimina|delete/i }).first().click()
        await expect(banner).toBeHidden()
        await expect(page.getByText(/rinnovo eliminato|renewal deleted/i)).toBeVisible()
    })
})
```

- [ ] **Step 2: Run the E2E spec**

Run (dev server running, seed data present, migration applied): `npx playwright test tests/e2e/trainer-program-packages.spec.ts`
Expected: PASS.

If the environment has no database or dev server, do not mark this step done: report in the task summary that the spec was written but not executed, and why.

If the seeded trainee already has a period renewal, the package still becomes the current mode (it is the latest registered renewal) — the spec does not depend on a clean trainee. If the home alert count is not exactly 1 because the same trainee has several links on the dashboard, narrow the locator to the subscription-alerts widget (`page.getByRole('region', { name: /abbonamenti in scadenza|expiring subscriptions/i })`) rather than loosening the assertion.

- [ ] **Step 3: Full verification**

Run each and read the output:

```bash
npm run type-check
npm run lint
npm run test:unit -- --coverage
npm run build
```

Expected: no type errors, no lint errors, all tests pass, coverage thresholds in `vitest.config.ts` met (`src/lib/**`, `src/schemas/**`, `src/app/api/**`), build succeeds.

- [ ] **Step 4: Check the spec is fully covered**

Open `docs/superpowers/specs/2026-10-10-program-package-renewals-design.md` and tick each row of the **Decisions** table against the code. Anything not implemented is a defect: fix it in the task that owns the file, do not leave it for later.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/trainer-program-packages.spec.ts implementation-docs/CHANGELOG.md
git commit -m "test(e2e): program-package renewal flow"
```
