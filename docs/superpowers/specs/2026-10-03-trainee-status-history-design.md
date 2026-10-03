# Trainee Status History Tooltip — Design

**Date:** 2026-10-03
**Status:** Approved (design), pending spec review
**Branch:** `feature/resend-invite` (worktree `.worktrees/resend-invite`)

## Goal

Show the trainer how a trainee's account got to its current state. Hovering
(or tapping) the status badge opens a small timeline with every step, its
date and time (`dd/MM/yyyy HH:mm:ss`) and, when known, who performed it
("by Mario Rossi"):

- account created
- invitation re-sent (one line per re-send)
- waiting for activation (no date, only while the trainee never activated)
- account activated (trainee completed onboarding)
- deactivated / reactivated by trainer or admin (one line per change)

Surfaces: the status badge in the trainee list (`/trainer/trainees`) and in the
trainee detail header (`/trainer/trainees/[id]`).

Out of scope: the admin users page; the "confirmed email but never set a password" edge case (stays as today).

## Data model

New table, full history:

```prisma
enum UserStatusEventType {
  created
  activated
  deactivated
  reactivated
  invitation_resent
}

model UserStatusEvent {
  id        String              @id @default(uuid())
  userId    String
  type      UserStatusEventType
  actorId   String?
  createdAt DateTime            @default(now())

  user  User  @relation("UserStatusEvents", fields: [userId], references: [id], onDelete: Cascade)
  actor User? @relation("PerformedStatusEvents", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@map("user_status_events")
}
```

`User` gets `statusEvents UserStatusEvent[] @relation("UserStatusEvents")` and
`performedStatusEvents UserStatusEvent[] @relation("PerformedStatusEvents")`.

`actorId` is the user who performed the step: the trainer or admin for
`created`, `deactivated`, `reactivated`, `invitation_resent`; the trainee
themselves for `activated` (`actorId = userId`). Deleting the actor keeps the
event and nulls the author (`SetNull`).

`created` is written for every new user, with the creator as actor. A user
with no `created` event (only possible if created by the old code during the
deploy window) falls back to `User.createdAt` with no author.
"Waiting for activation" is not an event: it is the state of an inactive user
with no `activated` event (`pendingActivation`).

### Migration and backfill

One additive Prisma migration (deployed by the Vercel production build, like
the others). It creates the enum and the table, then backfills existing users
assuming the standard flow (creation by the trainer, activation by the
trainee):

1. `created` for every existing user, dated `users.created_at`. Actor: the
   trainee's current trainer from `trainer_trainees`; `null` for users with no
   trainer (trainers, admins). If a trainee changed trainer, the current one
   is shown: accepted approximation.
2. `activated` for every existing user whose email is confirmed in Supabase
   Auth, dated `auth.users.email_confirmed_at` (approximate: it is the
   invite-link click, not the password setup), actor = the user themselves.
   This step runs inside `DO $$ ... IF EXISTS (auth.users) ... $$` so the
   shadow database used by `prisma migrate dev`, which has no `auth` schema,
   skips it.

Consequences for existing users:

| Existing user | Badge | Timeline |
|---|---|---|
| active, confirmed | Active | created by trainer, activated by trainee (approx. date) |
| inactive, confirmed | Deactivated | created by trainer, activated by trainee, "Deactivated — date not available" |
| inactive, never confirmed | Waiting for activation | created by trainer, waiting for activation |

## Writing events

Each event is written in the same `prisma.$transaction` as the status update,
and only when the status actually changes (calling activate on an active user
writes nothing):

| Route | Event | Actor |
|---|---|---|
| `POST /api/users` (after the invite is sent) | `created` | session user |
| `POST /api/auth/activate` (end of onboarding) | `activated` | the trainee (session user) |
| `PATCH /api/users/[id]/deactivate` | `deactivated` | session user |
| `PATCH /api/users/[id]/activate` | `reactivated` | session user |
| `POST /api/users/[id]/resend-invite` (after a successful send) | `invitation_resent` | session user |

In `POST /api/users` the `created` event joins the existing `user.create` /
`trainerTrainee.create` writes in one transaction.

## API

### `GET /api/users/[id]/status-history` (new)

Same auth as `GET /api/users/[id]`: trainer only for own trainees
(single `trainerTrainee.findFirst`), admin for anyone.

```json
{ "data": {
    "createdAt": "2026-10-01T09:12:05.000Z",
    "isActive": false,
    "events": [
      { "type": "created", "at": "2026-10-01T09:12:05.000Z",
        "actor": { "firstName": "Luca", "lastName": "Bianchi" } },
      { "type": "activated", "at": "2026-10-01T18:40:11.000Z", "actor": null }
    ]
} }
```

Events ordered by `createdAt asc`, actor loaded with
`select: { firstName: true, lastName: true }` in the same query. Called by the
badge on first open only.

### `GET /api/users` (list) and `GET /api/users/[id]`

Both add `pendingActivation: boolean` = `!isActive && no activated event`,
computed with a filtered relation count in the same query
(`_count: { select: { statusEvents: { where: { type: 'activated' } } } }`), no
extra round-trip. The detail keeps `invitationPending` (Supabase) for the
re-send button; the badge label uses `pendingActivation` in both places.

## Timeline logic

Pure function `buildStatusTimeline({ createdAt, isActive, events })` in
`src/lib/user-status-timeline.ts` returns the ordered lines
`{ kind, at | null, actorName | null }`:

1. `created`: the `created` event if present (with its actor), otherwise
   `User.createdAt` with no actor
2. one line per remaining event, in order, with its actor
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
  `formatDateTime(at, 'seconds')` or "date not available", then
  "by First Last" when the line has an actor.
- `formatDateTime` gets a `'seconds'` format: `dd/MM/yyyy HH:mm:ss`.
- i18n keys in `public/locales/{en,it}/components.json` under `userStatus.*`.

## Testing

- `tests/unit/lib/user-status-timeline.test.ts`: every row of the legacy table,
  multiple deactivate/reactivate cycles, re-sends before activation, created
  event vs `createdAt` fallback, actor present / null.
- `tests/unit/date-format.test.ts`: `'seconds'` format.
- `tests/integration/users-status-history.test.ts`: 200 shape, order and actor,
  401, 403 role, 403 ownership, 404.
- Existing route suites (`users-activation`, `users-resend-invite`,
  `auth-routes`, `users`): event written with `toHaveBeenCalledWith` including
  `actorId`, `created` event on `POST /api/users`, no event
  when status does not change, `pendingActivation` in list and detail.
- `tests/unit/UserStatusBadge.test.tsx`: labels, open on hover/click, fetch once,
  timeline rendered, error state, Escape closes.
- CHANGELOG entry.
