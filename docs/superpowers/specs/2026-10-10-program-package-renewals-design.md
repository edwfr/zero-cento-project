# Program-Package Renewals (Trainer) — Design

**Date:** 2026-10-10
**Status:** Approved (design), pending spec review
**Extends:** `2026-10-03-subscription-renewals-design.md`

## Goal

Some trainees do not pay by months: they buy a **package of programs** ("schede").
The trainer must be able to record, as an alternative to a period renewal, **how many
programs were bought and when**. Publishing a program consumes one of them. When the
trainee runs out, the trainer is warned on the same surfaces that today warn about a
subscription expiring within 14 days.

Period renewals (start date + months) keep working exactly as they do today.

On top of that, every renewal registration and every program-credit movement is written
to an **append-only log**, shown to the trainer as a history of movements.

## Non-goals

- No payments, amounts or invoices (unchanged).
- No trainee-facing view, notification or API access (unchanged).
- Publishing is **never blocked** by the subscription state — only warned about.
- No retroactive consumption: programs published before a package is registered do not
  count against it.
- No explicit "billing mode" setting on the trainee.
- No admin UI (admin keeps API access only).

## Decisions

| Question | Decision | Why |
|---|---|---|
| Period vs programs | mutually exclusive at any moment; a trainee may switch over time | requested |
| Current mode | the `kind` of the trainee's most recently **registered** renewal (`createdAt` desc); no renewals → `none` | no flag to keep in sync; switching = registering a renewal of the other kind |
| Storage of packages | same `SubscriptionRenewal` table, discriminated by `kind` | one history, one API, one query for the mode |
| Balance | `SUM(programCount) − COUNT(ProgramCreditUsage)`, derived at read time, all-time | no counter to drift; consistent with "status derived at read time" |
| Balance across mode switches | carried over (credit or debt) | a paid program stays paid |
| What consumes | a publish performed while the trainee's current mode is `programs` | "only from now on": predictable, no retroactive recalculation |
| Publish in `period` / `none` mode | no consumption | period renewals unchanged |
| Publish with balance ≤ 0 | allowed, balance goes negative ("in debt") | trainer is never stuck if the trainee pays later |
| Publish without coverage | non-blocking confirmation in three cases: programs exhausted, period expired, no renewal recorded | consistent warning, trainer decides |
| Programs status | balance ≥ 2 `active` · balance 1 `expiring` (amber, "last program") · balance ≤ 0 `expired` (red, "exhausted" / "in debt of N") | mirrors expiring / expired |
| Deleting a program that consumed a credit | dedicated popup: refund / do not refund / cancel | trainer decides case by case |
| Deleting a program that did not consume | existing confirmation, no refund popup | nothing to refund |
| Editing / deleting a package | balance recomputed, may become negative | derived balance |
| `kind` of an existing renewal | immutable | switching kind is a new renewal |
| Package size | integer 1–50 | rejects typos |
| Log | separate append-only `SubscriptionEvent` table, never read for calculations | a wrong log row cannot corrupt the balance |
| Inactive trainees | no alerts, excluded from page and widget (unchanged) | no noise |

## Architecture

### 1. Database — `prisma/schema.prisma`

One migration: `prisma/migrations/20261010000000_add_program_package_renewals`.

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

model SubscriptionRenewal {
  id             String      @id @default(uuid())
  traineeId      String
  kind           RenewalKind @default(period)
  startDate      DateTime    @db.Date  // period: first covered day; programs: purchase date
  durationMonths Int?                  // period only
  endDate        DateTime?   @db.Date  // period only, computed server-side
  programCount   Int?                  // programs only
  createdBy      String
  createdAt      DateTime    @default(now())
  // relations and @@index([traineeId, endDate]) unchanged
  @@index([traineeId, createdAt])
}

/// Ledger: one row per publish that consumed a program credit. Source of the balance.
model ProgramCreditUsage {
  id        String   @id @default(uuid())
  traineeId String
  programId String?  @unique   // SetNull: the usage survives a program deleted without refund
  createdBy String
  createdAt DateTime @default(now())

  trainee User             @relation("TraineeCreditUsages", fields: [traineeId], references: [id], onDelete: Cascade)
  program TrainingProgram? @relation(fields: [programId], references: [id], onDelete: SetNull)
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
  details     Json                  // snapshot, see below
  actorId     String
  createdAt   DateTime              @default(now())

  trainee User @relation("TraineeSubscriptionEvents", fields: [traineeId], references: [id], onDelete: Cascade)
  actor   User @relation("ActedSubscriptionEvents", fields: [actorId], references: [id])

  @@index([traineeId, createdAt])
  @@map("subscription_events")
}
```

Existing rows get `kind = period` from the column default; no data backfill.
No history is back-filled into `SubscriptionEvent`: the log starts at deployment.

DB-level check constraint (raw SQL in the migration):
`kind = 'period'` ⇒ `durationMonths` and `endDate` not null, `programCount` null;
`kind = 'programs'` ⇒ `programCount` not null, `durationMonths` and `endDate` null.

`details` snapshot per event type:

| Type | `details` | `creditDelta` |
|---|---|---|
| `period_renewal_created` | `{ startDate, durationMonths, endDate }` | null |
| `package_created` | `{ purchaseDate, programCount }` | `+programCount` |
| `renewal_updated` | `{ kind, before: {...}, after: {...} }` | programs: `after − before`; period: null |
| `renewal_deleted` | `{ kind, ...snapshot }` | programs: `−programCount`; period: null |
| `credit_consumed` | `{ programTitle }` | `−1` |
| `credit_refunded` | `{ programTitle }` | `+1` |
| `credit_forfeited` | `{ programTitle }` | `0` |

Every event is written in the **same transaction** as the mutation it describes.

### 2. Domain logic — `src/lib/subscriptions.ts` (pure)

```ts
export type RenewalKind = 'period' | 'programs'

export type SubscriptionSummary =
    | { kind: 'period'; status: 'active' | 'expiring' | 'expired'; endDate: string; daysLeft: number }
    | { kind: 'programs'; status: 'active' | 'expiring' | 'expired'; remaining: number }
```

- Constants: `LAST_PROGRAM_THRESHOLD = 1`, `MIN_PROGRAM_COUNT = 1`, `MAX_PROGRAM_COUNT = 50`,
  `PROGRAM_COUNT_SHORTCUTS = [1, 3, 5, 10]`.
- `toProgramsSummary(remaining)` — `remaining ≤ 0` → `expired`, `remaining ≤ 1` → `expiring`,
  else `active`.
- `toPeriodSummary(endDate, today)` — today's `toSubscriptionSummary` body, tagged `kind: 'period'`.
- `toSubscriptionSummary({ mode, endDate, purchased, used }, today)` — dispatches on the
  current mode; `mode: null` → `null` ("none").
- `needsAttention` unchanged (works on `status`).
- `isUncovered(summary)` — `summary === null || summary.status === 'expired'`; drives the
  publish confirmation.
- `summaryLabel(summary)` — i18n key + params for the short text of either kind; replaces
  the direct use of `remainingLabel` in the alert, badge and icon components.
- `buildSubscriptionOverview(trainees, summaries, today)` — takes summaries instead of end
  dates. Sort: `expired` → `expiring` → `active`; inside a status group period items by
  `daysLeft` asc, programs items by `remaining` asc, period before programs on ties, then
  last name.
- `RenewalRow` gains `kind`, `programCount`; `durationMonths` / `endDate` become nullable.
- New `SubscriptionEventRow` type (API shape of a log row, including `actorName`).

### 3. Queries — `src/lib/subscription-queries.ts` (server-only)

- `getCurrentSummaries(traineeIds, today)` → `Map<traineeId, SubscriptionSummary>`,
  replacing `getCurrentEndDates`. Fixed number of queries regardless of trainee count:
  1. latest renewal per trainee (`distinct: ['traineeId']`, `orderBy: createdAt desc`) → mode;
  2. `groupBy traineeId` with `_max.endDate` and `_sum.programCount`;
  3. `programCreditUsage.groupBy traineeId` with `_count`.
- `getTrainerSubscriptionOverview` uses it.
- `getTraineeSummary(traineeId, today)` — single-trainee convenience for the routes.

Credit mutations live in a new `src/lib/program-credits.ts` (server-only), each taking a
Prisma transaction client:

- `consumeCreditOnPublish(tx, { traineeId, programId, programTitle, actorId })` — if the
  trainee's current mode is `programs`: create the usage + `credit_consumed` event.
  Otherwise no-op. Returns whether a credit was consumed.
- `settleCreditOnProgramDelete(tx, { programId, refund, actorId })` — if a usage exists for
  the program: `refund` → delete the usage + `credit_refunded`; otherwise leave it (FK
  nulls `programId` on delete) + `credit_forfeited`. No usage → no-op.
- `logRenewalEvent(tx, …)` — writes the renewal events.

### 4. Validation — `src/schemas/subscription-renewal.ts`

`z.discriminatedUnion('kind', …)`:

```ts
{ kind: 'period',   startDate, durationMonths: int 1..36 }
{ kind: 'programs', startDate, programCount:   int 1..50 }
```

- Create adds `traineeId`. `kind` defaults to `'period'` when missing (existing clients).
- Update takes the same union; the route rejects a `kind` different from the stored one
  (`400`, key `subscription.kindImmutable`).
- Fields of the other kind and any `endDate` are stripped.
- New message key `validation.programCountRange`.

### 5. API

RBAC unchanged: trainee → 403 on every subscription method; trainer → own trainees only;
admin allowed.

| Method & path | Change |
|---|---|
| `GET /api/subscription-renewals?traineeId=` | `items` carry `kind` / `programCount`; `current` is the union summary; adds `events` (latest 100, `createdAt` desc, with actor name) |
| `POST /api/subscription-renewals` | accepts the union; period computes `endDate` as today, programs stores `programCount`; writes `period_renewal_created` / `package_created` in the same transaction |
| `PATCH /api/subscription-renewals/[id]` | accepts the union, `kind` immutable; writes `renewal_updated` with before/after |
| `DELETE /api/subscription-renewals/[id]` | writes `renewal_deleted` with a snapshot |
| `GET /api/users` (trainer branch) | `subscription` becomes the union summary, from one `getCurrentSummaries` call |
| `POST /api/programs/[id]/publish` | program update, week dates and `consumeCreditOnPublish` run in **one transaction** (today they are separate writes). Never rejected because of the subscription state |
| `GET /api/programs/[id]` | trainer/admin response gains `consumedCredit: boolean` |
| `DELETE /api/programs/[id]?refundCredit=true\|false` | calls `settleCreditOnProgramDelete` in the same transaction as the delete; missing param = `false` |

The "trainee without coverage" confirmation is client-side: the publish page reads the
trainee's summary and asks before calling the endpoint. The server always consumes when
the mode is `programs`; there is no confirmation flag in the API.

### 6. UI

All copy through react-i18next (`it` + `en`). Click-triggered async via
`<Button isLoading loadingText=…>`.

**`SubscriptionRenewalFormModal`**

- Segmented toggle "A mesi / A schede" at the top. Default: the trainee's current mode
  (`period` when none). Disabled in edit mode.
- Period: today's fields, unchanged.
- Programs: purchase date (default today), number of programs (numeric input + 1/3/5/10
  shortcuts), live preview "Saldo dopo la registrazione: N".

**Trainee profile — `src/app/trainer/trainees/[id]/`**

- `_use-trainee-subscription.ts` also exposes `events`.
- `_subscription-tab.tsx`:
  - status card: period as today; programs → "Schede disponibili: N" / "Ultima scheda
    disponibile" / "Schede esaurite" / "In debito di N schede";
  - renewals history: single table with a **Tipo** column; program rows show purchase date
    and quantity, period rows as today; edit / delete on both;
  - new **Movimenti** section below: read-only chronological list from `events` — date,
    description, signed delta (+5 / −1 / +1) when present, author. Rendered by a new
    `SubscriptionEventList` component.
- `_subscription-alert.tsx`: banner texts for the programs kind, same amber / red styles.

**Shared components**

- `SubscriptionStatusBadge`, `SubscriptionStatusIcon`: branch on `summary.kind` through
  `summaryLabel`; colours unchanged.
- New `ProgramCreditRefundModal`: three actions — "Elimina e rimborsa scheda",
  "Elimina senza rimborso", "Annulla".

**Trainee list — `/trainer/trainees`**: no layout change; the compact badge now also shows
the programs states.

**Subscriptions page — `/trainer/subscriptions`**

- Same four counters; labels become "Scaduti / esauriti" and "In scadenza / ultima scheda".
- A programs row shows the balance text in place of end date + days.

**Dashboard widget**: `SubscriptionAlert` gains `kind`; `days` becomes `value` (days for
period, absolute balance for programs); new i18n keys
`trainerDashboard.subscriptionAlerts.programsExhausted` / `programsLast`.

**Publish page — `/trainer/programs/[id]/publish/_content.tsx`**

- Loads the trainee's summary.
- Programs mode: info line "Schede disponibili: N → N−1 dopo la pubblicazione".
- `isUncovered(summary)` → `ConfirmationModal` before publishing, text per case:
  programs exhausted / subscription expired on {{date}} / no subscription recorded.
  Confirm → normal publish.

**Program deletion**

- Wherever the trainer deletes a program (programs list and the trainee's programs tab):
  `consumedCredit` → `ProgramCreditRefundModal`, sending `refundCredit=true|false`;
  otherwise the existing confirmation.

### 7. Trainee isolation

Unchanged. No trainee route, tab or nav entry; the API guard returns 403 for the trainee
role on every subscription endpoint. `consumedCredit` is not included in the trainee's
program response.

## Error handling

- All new failure paths go through `apiError` with i18n keys (`subscription.kindImmutable`,
  `validation.programCountRange`) and `handleApiError` in `catch`.
- Publish and delete run their credit side-effect inside the same transaction as the main
  write: either both happen or neither.
- A concurrent double publish is already rejected by the draft-status check;
  `ProgramCreditUsage.programId @unique` is the backstop against a double consumption.

## Testing

Following `zero-cento-testing`.

- **Unit** `subscriptions`: programs summary at balance 2 / 1 / 0 / −1; mode = latest
  registered renewal; `isUncovered` for the three cases; mixed-kind overview ordering and
  counts; balance carried across a mode switch.
- **Unit** schema: union on `kind`, `programCount` bounds, non-integer, other kind's fields
  stripped, missing `kind` defaults to `period`.
- **Integration** API:
  - publish consumes only in programs mode; no consumption in period mode or with no
    renewal; negative balance allowed; publish and consumption are atomic;
  - program delete with refund, without refund, and with no usage;
  - package edit / delete recomputes the balance; `kind` change rejected;
  - an event is written for every mutation and survives deletion of the renewal and of the
    program;
  - `/api/users` and the overview expose the union summary;
  - RBAC: trainee 403, non-owning trainer 403, admin allowed.
- **Components**: modal toggle (default mode, locked on edit, preview), badge / icon
  programs variants, `ProgramCreditRefundModal`, `SubscriptionEventList`, publish
  confirmation in the three cases.
- **E2E**: register a package of 1 → amber "last program" → publish → red in trainee list,
  subscriptions page and dashboard widget → delete the program with refund → amber again;
  movements list shows the four events.
- New lib, schema and API files added to the 80% coverage list in `vitest.config.ts`.
- Existing period-renewal tests keep passing with only the type-level adjustments.

## Docs

`implementation-docs/CHANGELOG.md` entry per implementation step, per project rules.
