# Trainee Status History Tooltip — Design

**Date:** 2026-10-03
**Status:** Approved (design), pending spec review
**Branch:** `feature/resend-invite` (worktree `.worktrees/resend-invite`)

## Goal

Show the trainer how a trainee's account got to its current state. Hovering
(or tapping) the status badge opens a small timeline with every step and its
date and time (`dd/MM/yyyy HH:mm:ss`):

- account created
- invitation re-sent (one line per re-send)
- waiting for activation (no date, only while the trainee never activated)
- account activated (trainee completed onboarding)
- deactivated / reactivated by trainer or admin (one line per change)

Surfaces: the status badge in the trainee list (`/trainer/trainees`) and in the
trainee detail header (`/trainer/trainees/[id]`).

Out of scope: who performed each step (not shown, not stored); the admin users
page; the "confirmed email but never set a password" edge case (stays as today).

## Data model

New table, full history:

```prisma
enum UserStatusEventType {
  activated
  deactivated
  reactivated
  invitation_resent
}

model UserStatusEvent {
  id        String              @id @default(uuid())
  userId    String
  type      UserStatusEventType
  createdAt DateTime            @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("user_status_events")
}
```

`User` gets `statusEvents UserStatusEvent[]`.

"Created" is not an event: it comes from `User.createdAt`.
"Waiting for activation" is not an event: it is the state of an inactive user
with no `activated` event (`pendingActivation`).

### Migration and backfill

One additive Prisma migration (deployed by the Vercel production build, like
the others). It creates the enum and the table, then backfills an `activated`
event for every existing user whose email is confirmed in Supabase Auth, dated
`auth.users.email_confirmed_at` (approximate: it is the invite-link click, not
the password setup). The backfill runs inside
`DO $$ ... IF EXISTS (auth.users) ... $$` so the shadow database used by
`prisma migrate dev`, which has no `auth` schema, skips it.

Consequences for existing users:

| Existing user | Badge | Timeline |
|---|---|---|
| active, confirmed | Active | created, activated (approx. date) |
| inactive, confirmed | Deactivated | created, activated, "Deactivated — date not available" |
| inactive, never confirmed | Waiting for activation | created, waiting for activation |

## Writing events

Each event is written in the same `prisma.$transaction` as the status update,
and only when the status actually changes (calling activate on an active user
writes nothing):

| Route | Event |
|---|---|
| `POST /api/auth/activate` (end of onboarding) | `activated` |
| `PATCH /api/users/[id]/deactivate` | `deactivated` |
| `PATCH /api/users/[id]/activate` | `reactivated` |
| `POST /api/users/[id]/resend-invite` (after a successful send) | `invitation_resent` |

## API

### `GET /api/users/[id]/status-history` (new)

Same auth as `GET /api/users/[id]`: trainer only for own trainees
(single `trainerTrainee.findFirst`), admin for anyone.

```json
{ "data": {
    "createdAt": "2026-10-01T09:12:05.000Z",
    "isActive": false,
    "events": [ { "type": "activated", "at": "2026-10-01T18:40:11.000Z" } ]
} }
```

Events ordered by `createdAt asc`. Called by the badge on first open only.

### `GET /api/users` (list) and `GET /api/users/[id]`

Both add `pendingActivation: boolean` = `!isActive && no activated event`,
computed with a filtered relation count in the same query
(`_count: { select: { statusEvents: { where: { type: 'activated' } } } }`), no
extra round-trip. The detail keeps `invitationPending` (Supabase) for the
re-send button; the badge label uses `pendingActivation` in both places.

## Timeline logic

Pure function `buildStatusTimeline({ createdAt, isActive, events })` in
`src/lib/user-status-timeline.ts` returns the ordered lines
`{ kind, at | null }`:

1. `created` at `createdAt`
2. one line per event, in order
3. if no `activated` event and inactive: `pendingActivation` (no date)
4. if inactive, activated, and the last event is not `deactivated`:
   `deactivated` with `at: null` ("date not available", legacy users)

## UI

New shared component `UserStatusBadge` in `src/components/` (exported from the
barrel), replacing the inline badge in the list and in the detail header.

- Props: `userId`, `isActive`, `pendingActivation`, `size: 'sm' | 'md'`.
- Label and colour: Active (green), Deactivated (red), Waiting for activation
  (amber, matches the detail badge already shipped).
- The badge is a `<button>`; the popover opens on mouse enter, focus and click
  (tap on touch), closes on mouse leave, blur, Escape and outside click.
  `aria-expanded` on the button, `role="tooltip"` on the popover.
- First open fetches the history; the result is cached in component state and
  dropped when `isActive` or `pendingActivation` change (e.g. after the list
  toggle). Loading: `LoadingSpinner` size sm. Error: one-line message.
- Each line: lucide icon (`UserPlus`, `MailPlus`, `Hourglass`, `CheckCircle2`,
  `Ban`, `RotateCcw`), translated label, date via
  `formatDateTime(at, 'seconds')` or "date not available".
- `formatDateTime` gets a `'seconds'` format: `dd/MM/yyyy HH:mm:ss`.
- i18n keys in `public/locales/{en,it}/components.json` under `userStatus.*`.

## Testing

- `tests/unit/lib/user-status-timeline.test.ts`: every row of the legacy table,
  multiple deactivate/reactivate cycles, re-sends before activation.
- `tests/unit/date-format.test.ts`: `'seconds'` format.
- `tests/integration/users-status-history.test.ts`: 200 shape and order, 401,
  403 role, 403 ownership, 404.
- Existing route suites (`users-activation`, `users-resend-invite`,
  `auth-routes`, `users`): event written with `toHaveBeenCalledWith`, no event
  when status does not change, `pendingActivation` in list and detail.
- `tests/unit/UserStatusBadge.test.tsx`: labels, open on hover/click, fetch once,
  timeline rendered, error state, Escape closes.
- CHANGELOG entry.
