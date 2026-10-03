# Subscription Renewals (Trainer) — Design

**Date:** 2026-10-03
**Status:** Approved (design), pending spec review

## Goal

Let the trainer track **subscription renewals** for each of their trainees.

A renewal is entered by the trainer as a **start date** plus a **duration in
months**; the system computes the end date. From the renewals the system derives
the trainee's current subscription status and warns the trainer when a
subscription is about to expire (≤ 14 days) or has already expired.

Surfaces:

1. a **Abbonamento** tab on the trainee management screen (`/trainer/trainees/[id]`);
2. an alert on the trainee profile and in the trainee list (`/trainer/trainees`);
3. a new **Abbonamenti** page (`/trainer/subscriptions`) in the hamburger menu,
   listing every trainee of the logged-in trainer ordered by days left;
4. a KPI card on the trainer home (`/trainer/dashboard`).

The feature is **trainer-only**. The trainee has no access to it, in the UI or in the API.

## Non-goals

- No payments: no amounts, invoices, payment status or payment history.
- No trainee-facing view, notification, email or push of the subscription.
- No automatic reminders (email/push) — alerts are in-app, on the trainer's screens only.
- No admin UI. Admin has API read/write access (same RBAC as measurements) but no new page.
- No subscription "plans" or types — a renewal is only start date + months.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Storage | one `SubscriptionRenewal` row per renewal, status derived at read time | full history, single source of truth, no cache to keep in sync |
| End date | `startDate + durationMonths`, clamped to month end (31/01 + 1 → 28/02); stored, computed server-side only | stored for sorting/aggregation; client never sends it |
| Current expiry | `MAX(endDate)` across the trainee's renewals | a back-dated correction doesn't overwrite a later expiry |
| Overlapping renewals | allowed, no uniqueness constraint | early renewals and corrections are normal |
| Early renewal start date | form pre-fills start = day after the current expiry (or today if none), trainer can change it | proposed by the system, confirmed by the trainer; the end date is the last covered day, so the next period starts the day after |
| Expired | `today > endDate` | end date is the last covered day |
| Expiring | `0 ≤ daysLeft ≤ 14` (constant `EXPIRING_THRESHOLD_DAYS = 14`) | requested two-week warning |
| Expired, not renewed | red alert, shown first in the subscriptions page | must not be lost after the warning window |
| Subscriptions page scope | logged-in trainer's **active** trainees: those with a subscription (sorted by days left) + a "no subscription" block | each trainer sees only their own trainees |
| Inactive trainees | no alert in the list, excluded from page and KPI | no noise for paused athletes |
| Duration range | integer 1–36 months | covers monthly to multi-year; rejects typos |

## Architecture

### 1. Database — `prisma/schema.prisma`

Migration: `prisma/migrations/20261003000000_add_subscription_renewals`.

```prisma
model SubscriptionRenewal {
  id             String   @id @default(uuid())
  traineeId      String
  startDate      DateTime @db.Date
  durationMonths Int
  endDate        DateTime @db.Date  // computed server-side from startDate + durationMonths
  createdBy      String             // trainer who entered the renewal (audit)
  createdAt      DateTime @default(now())

  trainee User @relation("TraineeRenewals", fields: [traineeId], references: [id], onDelete: Cascade)
  creator User @relation("CreatedRenewals", fields: [createdBy], references: [id])

  @@index([traineeId, endDate])
  @@map("subscription_renewals")
}
```

`User` gains `subscriptionRenewals SubscriptionRenewal[] @relation("TraineeRenewals")`
and `createdRenewals SubscriptionRenewal[] @relation("CreatedRenewals")`.

### 2. Domain logic — `src/lib/subscriptions.ts`

Pure functions (no Prisma):

- `EXPIRING_THRESHOLD_DAYS = 14`
- `toSubscriptionDay(date)` — normalises to a UTC calendar day (same approach as `toMeasurementDay`).
- `addMonthsClamped(start, months)` — adds months, clamping the day to the target month's last day.
- `toSubscriptionSummary(endDate | null, today)` →
  `{ status: 'active' | 'expiring' | 'expired', endDate: ISO string, daysLeft: number } | null`
  - `null`: no end date (status "none")
  - `expired`: `daysLeft < 0`
  - `expiring`: `0 ≤ daysLeft ≤ EXPIRING_THRESHOLD_DAYS`
  - `active`: otherwise
- `latestEndDate(rows)`, `needsAttention(summary)`, `nextRenewalStart(currentEnd, today)`,
  `remainingLabel(daysLeft)` (i18n key + count).
- `buildSubscriptionOverview(trainees, endDates, today)` — ascending `daysLeft`
  (most-overdue first), ties by last name; trainees without a subscription by last name;
  counts per status.

Query helpers (Prisma, server-only) live in a separate `src/lib/subscription-queries.ts`,
so client components can import the pure module without pulling in Prisma:

- `getCurrentEndDates(traineeIds)` → `Map<traineeId, Date>` via one
  `subscriptionRenewal.groupBy({ by: ['traineeId'], _max: { endDate: true } })`.
- `getTrainerSubscriptionOverview(trainerId, today)` → active trainees of that trainer,
  passed through `buildSubscriptionOverview`.
  Used by the subscriptions page and the home KPI.

### 3. Validation — `src/schemas/subscription-renewal.ts`

```ts
startDate: date string, valid date
durationMonths: integer, 1..36
```

Same schema for create and update. Any `endDate` in the body is ignored.

### 4. API

RBAC mirrors `src/app/api/trainee-measurements`: a single guard per route —
trainee → 403 (`auth.traineeAccessDenied`) on every method; trainer →
`requireTrainerOwnership(traineeId)`; admin allowed.

| Method & path | Behaviour |
|---|---|
| `GET /api/subscription-renewals?traineeId=` | renewals ordered by `startDate` desc + current status (`toSubscriptionSummary`, `null` when none) |
| `POST /api/subscription-renewals` | body `{ traineeId, startDate, durationMonths }`; computes `endDate`; `createdBy` = session user; 201 |
| `PATCH /api/subscription-renewals/[id]` | updates `startDate` / `durationMonths`, recomputes `endDate`; ownership checked on the renewal's trainee |
| `DELETE /api/subscription-renewals/[id]` | deletes; ownership checked on the renewal's trainee |
| `GET /api/users` (trainer branch) | each trainee gets `subscription: { status, endDate, daysLeft } \| null`, from one `getCurrentEndDates` call (no N+1) |

Errors use `apiError` with i18n keys under `subscription.*` (e.g.
`subscription.notFound`, `validation.durationMonthsRange`), added to
`public/locales/{it,en}`.

### 5. UI

All copy through react-i18next (`it` + `en`). Dates via `formatDate`.

**Shared components (`src/components/`, exported from `index.ts`)**

- `SubscriptionStatusBadge` — pill for a status: amber "Scade il {{date}} ({{days}} gg)",
  red "Scaduto il {{date}}", green "Attivo fino al {{date}}", grey "Nessun abbonamento".
  `compact` prop hides active/none (used in the list).
- `SubscriptionRenewalFormModal` — local state, same pattern as `MeasurementFormModal`. Fields: start date
  (pre-filled), duration in months (numeric input + 1/3/6/12 shortcuts). Live preview
  "Scadrà il …" using `addMonthsClamped`. Submit with
  `<Button isLoading loadingText={t('common.saving')}>`. Used for create and edit.

**Client data** — `useTraineeSubscription(traineeId)` (`useState` + `fetch`, the pattern
of the neighbouring measurements tab), called once by the trainee page and passed to both
banner and tab. Mutations call its `reload()`, so the banner updates right after a renewal
is saved or deleted.

**Trainee profile — `src/app/trainer/trainees/[id]/`**

- New tab `'subscription'` in `_content.tsx` (same button style as the other tabs),
  content in `_subscription-tab.tsx`:
  - current status card (badge + end date + days left / days overdue);
  - "Registra rinnovo" button → form modal; start date pre-filled with the day
    after the current expiry if any, else today;
  - history table (start, duration, end, entered on) with edit (same modal) and delete
    (`ConfirmationModal`).
- Banner below the header, on **every** tab, only for `expiring` / `expired`:
  - amber: "L'abbonamento scade il {{date}} (tra {{days}} giorni)"
  - red: "Abbonamento scaduto il {{date}}"
  - "Gestisci" link switches to the subscription tab.
- `_content.tsx` reads `?tab=subscription` to open that tab directly (deep link from
  the subscriptions page).

**Trainee list — `src/app/trainer/trainees/_content.tsx`**

- `SubscriptionStatusBadge compact` under the trainee name, only for `expiring` /
  `expired`, only for active trainees. No new column. Data from `/api/users`.

**Subscriptions page — `src/app/trainer/subscriptions/` (`page.tsx` + `_content.tsx` + `loading.tsx`)**

- Server `page.tsx`: `getSession`, trainer role check, `DashboardLayout` with
  `backHref="/trainer/dashboard"`, data from `getTrainerSubscriptionOverview(session.user.id, today)`,
  rendered by a client `_content.tsx` (react-i18next), like `/trainer/trainees`.
- Four counters: Scaduti · In scadenza (≤ 14 gg) · Attivi · Senza abbonamento.
- Main list: trainees with a subscription, ascending days left (overdue first). Row:
  name, badge, end date, "tra X giorni" / "scaduto da X giorni". Rows ≤ 14 days
  highlighted. Each row links to `/trainer/trainees/[id]?tab=subscription`.
- "Senza abbonamento" block at the bottom, by last name, same link.
- Empty state when the trainer has no active trainees.
- Mobile: rows render as cards, no horizontal scroll.

**Hamburger menu — `src/components/DashboardLayout.tsx`**

- `NAV_ITEMS.trainer` gains `{ href: '/trainer/subscriptions', icon: <CalendarClock />,
  titleKey: 'navigation.subscriptions' }` right after "I miei atleti".

**Home KPI — `src/app/trainer/dashboard/page.tsx`**

- Fifth card in the statistics grid, same markup as the existing cards, amber palette,
  `CalendarClock` icon, linking to `/trainer/subscriptions`.
  - Big number: `expired + expiring`.
  - Subtitle: "{{expired}} scaduti · {{expiring}} in scadenza (14 gg)".
- Counts from `getTrainerSubscriptionOverview` (already scoped to the trainer).
- Grid changes from `md:grid-cols-4` to `md:grid-cols-2 lg:grid-cols-3` to fit five cards
  without cramping.

### 6. Trainee isolation

No trainee route, tab, banner or nav entry. Enforcement is in the API guard (403 on every
method for `trainee`), not only by hiding UI. The subscriptions page and home KPI check
the trainer role server-side.

## Testing

Following `zero-cento-testing`.

- **Unit** `tests/unit/subscriptions.test.ts`: `addMonthsClamped` (month end, leap year,
  year rollover); `toSubscriptionSummary` boundaries (daysLeft 15 / 14 / 0 / -1, null);
  `buildSubscriptionOverview` ordering and counts.
- **Unit** schema: duration bounds, non-integer, invalid date.
- **Integration** API: create/list/update/delete; `endDate` computed server-side and client
  value ignored; trainee 403 on every method; non-owning trainer 403; admin allowed;
  `/api/users` exposes `subscription` per trainee; overview scoped to the trainer and
  ordered correctly.
- **Components**: form modal (pre-fill, live preview, validation), status badge variants.
- **E2E**: trainer records a renewal expiring within 14 days → badge in trainee list and
  profile banner → trainee appears in `/trainer/subscriptions` in the expected position
  → home KPI count reflects it.
- New lib, schema and API files added to the 80% coverage list in `vitest.config.ts`.

## Docs

`implementation-docs/CHANGELOG.md` entry per implementation step, per project rules.
