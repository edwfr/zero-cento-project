# Trainee Status History Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hovering or tapping a trainee's status badge (list and detail) shows the account timeline — created, invitation re-sent, waiting for activation, activated, deactivated, reactivated — with `dd/MM/yyyy HH:mm:ss` and the author of each step.

**Architecture:** A new `user_status_events` table records every status step with its author; routes that change status write the event in the same transaction. A new `GET /api/users/[id]/status-history` endpoint returns the events, a pure `buildStatusTimeline()` turns them into display lines, and a shared `UserStatusBadge` component fetches them lazily on first open and renders them in a portal popover.

**Tech Stack:** Next.js 15 App Router, Prisma 5 (PostgreSQL / Supabase), React 19, Tailwind, react-i18next, lucide-react, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-03-trainee-status-history-design.md`

## Global Constraints

- Work only in the worktree `/mnt/c/dev-projects/zero-cento-project/.worktrees/resend-invite`, branch `feature/resend-invite`. Never touch the main checkout.
- Date format in the tooltip: `dd/MM/yyyy HH:mm:ss`, browser local time.
- The author is shown as "by First Last" (`da Nome Cognome`); no author → no suffix.
- `activated` author = the trainee themselves (`actorId = userId`).
- Backfill: `created` by the trainee's current trainer (`trainer_trainee`), `activated` by the user, dated `auth.users.email_confirmed_at`.
- UI icons: lucide-react only, never emoji. Every user-facing string through i18n, keys in both `en` and `it`.
- Files with CRLF line endings must keep them: edit them with the Edit tool only, never rewrite them with Python/sed in text mode. CRLF files touched here: `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts`, `src/app/api/users/[id]/activate/route.ts`, `src/app/api/users/[id]/deactivate/route.ts`, `src/app/api/auth/activate/route.ts`, `src/app/trainer/trainees/_content.tsx`, `src/app/trainer/trainees/[id]/_content.tsx`, `src/components/index.ts`, `tests/integration/users.test.ts`, `implementation-docs/CHANGELOG.md`. Check with `git diff --stat` after each task: a whole-file diff means line endings were lost.
- Migrations cannot run from WSL (corporate network blocks Postgres): the migration is written by hand and applied by the Vercel production build (`prisma migrate deploy`). It must stay additive.
- `node_modules` is a symlink to the main checkout: `npx prisma generate` regenerates the shared client. The change is additive, so the other branch is not affected.
- `auth` (`requireRole` / `requireAuth`) first in every handler; trainer ownership via a single `prisma.trainerTrainee.findFirst({ where: { trainerId, traineeId } })`.
- Tests: Prisma via the global `prismaMock` (`tests/helpers/prisma-mock`), auth via `authModuleMock` + `asTrainer/asAdmin/...`; every Prisma write asserted with `toHaveBeenCalledWith`; no `as any`, use `as never` on mock values.

## Review Focus

1. Badge in the last rows of the list or near the right edge on a phone: the popover must stay inside the viewport (flip above, clamp horizontally) — test in Task 6.
2. Hovering in and out quickly, or opening twice: exactly one fetch per status, no duplicate in-flight request — test in Task 6.
3. Status toggled from the list while the history is cached or still loading: the next open must show the new history, never the stale one — test in Task 6.
4. Author deleted (`SetNull`) or legacy event without author: the line shows no "by", no crash — tests in Tasks 5 and 6.
5. User created by the old code during the deploy window (no `created` event): the timeline falls back to `User.createdAt` without author — test in Task 5.

---

### Task 1: Data model, migration, pending-activation helper

**Files:**
- Modify: `prisma/schema.prisma` (model `User` relations, new enum + model at the end of the file)
- Create: `prisma/migrations/20261003120000_add_user_status_events/migration.sql`
- Create: `src/lib/user-status-events.ts`
- Test: `tests/unit/lib/user-status-events.test.ts`
- Modify: `docs/superpowers/specs/2026-10-03-trainee-status-history-design.md` (pending computation, see Step 8)

**Interfaces:**
- Produces: Prisma model `userStatusEvent` with fields `id, userId, type, actorId, createdAt`, relations `user`, `actor`; enum `UserStatusEventType = created | activated | deactivated | reactivated | invitation_resent`.
- Produces: `findPendingActivationIds(inactiveUserIds: string[]): Promise<Set<string>>` — ids among the given (inactive) users with no `activated` event. Empty input → empty set, no query.

- [ ] **Step 1: Add the enum, the model and the relations to `prisma/schema.prisma`**

In `model User`, after the line `createdRenewals           SubscriptionRenewal[]        @relation("CreatedRenewals")`, add:

```prisma
  statusEvents              UserStatusEvent[]            @relation("UserStatusEvents")
  performedStatusEvents     UserStatusEvent[]            @relation("PerformedStatusEvents")
```

At the end of the file add:

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

- [ ] **Step 2: Validate and generate the client**

Run: `npx prisma validate && npx prisma generate`
Expected: `The schema at prisma/schema.prisma is valid` and `Generated Prisma Client`.

- [ ] **Step 3: Generate the DDL without a database and write the migration**

Run:
```bash
git show HEAD:prisma/schema.prisma > /tmp/claude-1000/-mnt-c-dev-projects-zero-cento-project/a24ddb60-2f78-4aab-9d49-8c4ca061ac6c/scratchpad/old-schema.prisma
npx prisma migrate diff --from-schema-datamodel /tmp/claude-1000/-mnt-c-dev-projects-zero-cento-project/a24ddb60-2f78-4aab-9d49-8c4ca061ac6c/scratchpad/old-schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```
Expected: `CREATE TYPE "UserStatusEventType"`, `CREATE TABLE "user_status_events"`, one index, two foreign keys. Nothing else (if anything else appears, the schema drifted: stop and report).

Create `prisma/migrations/20261003120000_add_user_status_events/migration.sql` with the generated DDL followed by the backfill:

```sql
-- CreateEnum
CREATE TYPE "UserStatusEventType" AS ENUM ('created', 'activated', 'deactivated', 'reactivated', 'invitation_resent');

-- CreateTable
CREATE TABLE "user_status_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserStatusEventType" NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_status_events_userId_createdAt_idx" ON "user_status_events"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "user_status_events" ADD CONSTRAINT "user_status_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_status_events" ADD CONSTRAINT "user_status_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: existing users were created by their current trainer (null for trainers/admins)
INSERT INTO "user_status_events" ("id", "userId", "type", "actorId", "createdAt")
SELECT gen_random_uuid()::text, u."id", 'created', tt."trainerId", u."createdAt"
FROM "users" u
LEFT JOIN "trainer_trainee" tt ON tt."traineeId" = u."id";

-- Backfill: users with a confirmed email activated their own account.
-- email_confirmed_at is the invite-link click, an approximation of the activation.
-- The shadow database of `prisma migrate dev` has no auth schema: skip there.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        INSERT INTO "user_status_events" ("id", "userId", "type", "actorId", "createdAt")
        SELECT gen_random_uuid()::text, u."id", 'activated', u."id", au.email_confirmed_at
        FROM "users" u
        JOIN auth.users au ON au.id::text = u."id"
        WHERE au.email_confirmed_at IS NOT NULL;
    END IF;
END $$;
```

- [ ] **Step 4: Write the failing helper test**

Create `tests/unit/lib/user-status-events.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../helpers/prisma-mock'
import { findPendingActivationIds } from '@/lib/user-status-events'

describe('findPendingActivationIds', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the users without an activated event', async () => {
        prismaMock.userStatusEvent.findMany.mockResolvedValue([{ userId: 'u-2' }] as never)

        const result = await findPendingActivationIds(['u-1', 'u-2', 'u-3'])

        expect(result).toEqual(new Set(['u-1', 'u-3']))
        expect(prismaMock.userStatusEvent.findMany).toHaveBeenCalledWith({
            where: { userId: { in: ['u-1', 'u-2', 'u-3'] }, type: 'activated' },
            select: { userId: true },
            distinct: ['userId'],
        })
    })

    it('skips the query when there are no inactive users', async () => {
        const result = await findPendingActivationIds([])

        expect(result).toEqual(new Set())
        expect(prismaMock.userStatusEvent.findMany).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run tests/unit/lib/user-status-events.test.ts`
Expected: FAIL, cannot resolve `@/lib/user-status-events`.

- [ ] **Step 6: Implement the helper**

Create `src/lib/user-status-events.ts`:

```typescript
import { prisma } from './prisma'

/**
 * Among the given inactive users, the ones that never completed onboarding:
 * no `activated` event means the trainee is still waiting for activation,
 * while an inactive user with one was deactivated by a trainer or admin.
 */
export async function findPendingActivationIds(inactiveUserIds: string[]): Promise<Set<string>> {
    if (inactiveUserIds.length === 0) return new Set()

    const activated = await prisma.userStatusEvent.findMany({
        where: { userId: { in: inactiveUserIds }, type: 'activated' },
        select: { userId: true },
        distinct: ['userId'],
    })
    const activatedIds = new Set(activated.map((event) => event.userId))

    return new Set(inactiveUserIds.filter((id) => !activatedIds.has(id)))
}
```

- [ ] **Step 7: Run the test**

Run: `npx vitest run tests/unit/lib/user-status-events.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Align the spec with the pending computation**

In the spec, section "`GET /api/users` (list) and `GET /api/users/[id]`", replace the paragraph starting "Both add `pendingActivation: boolean`" with:

```markdown
Both add `pendingActivation: boolean` = `!isActive && no activated event`.
`findPendingActivationIds()` (`src/lib/user-status-events.ts`) runs one
`findMany` on the `activated` events of the inactive users only (no query
when every user is active), so active rows cost nothing extra. The detail
keeps `invitationPending` (Supabase) for the re-send button; the badge label
uses `pendingActivation` in both places.
```

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261003120000_add_user_status_events/migration.sql src/lib/user-status-events.ts tests/unit/lib/user-status-events.test.ts docs/superpowers/specs/2026-10-03-trainee-status-history-design.md
git commit -m "feat(db): add user status events table with backfill"
```

---

### Task 2: Write status events in the routes that change status

**Files:**
- Modify: `src/app/api/users/route.ts` (POST, lines ~243-266)
- Modify: `src/app/api/auth/activate/route.ts`
- Modify: `src/app/api/users/[id]/deactivate/route.ts`
- Modify: `src/app/api/users/[id]/activate/route.ts`
- Modify: `src/app/api/users/[id]/resend-invite/route.ts`
- Test: `tests/integration/users.test.ts`, `tests/integration/auth-routes.test.ts`, `tests/integration/users-activation.test.ts`, `tests/integration/users-resend-invite.test.ts`

**Interfaces:**
- Consumes: `prisma.userStatusEvent.create` (Task 1).
- Produces: events `{ userId, type, actorId }` with the author rules of the Global Constraints. An event is written only when the status really changes.

The global `prismaMock` runs interactive `$transaction` callbacks against itself, so `prismaMock.user.update` / `prismaMock.userStatusEvent.create` assertions keep working inside transactions.

- [ ] **Step 1: Write the failing tests**

`tests/integration/users.test.ts`, in `describe('POST /api/users')`, add (reuse the existing request helper and the trainer happy-path setup of that describe; look at the test `'admin creates a trainer user successfully'` for the exact body shape):

```typescript
    it('records a created event authored by the trainer', async () => {
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue(null)
        prismaMock.user.create.mockResolvedValue({
            id: 'new-user-id',
            email: 'new.trainee@example.com',
            firstName: 'New',
            lastName: 'Trainee',
            role: 'trainee',
            isActive: false,
        } as never)

        const res = await POST(
            makeRequest('http://localhost:3000/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'new.trainee@example.com', firstName: 'New', lastName: 'Trainee', role: 'trainee' }),
            })
        )

        expect(res.status).toBe(201)
        expect(prismaMock.userStatusEvent.create).toHaveBeenCalledWith({
            data: { userId: 'new-user-id', type: 'created', actorId: mockTrainerSession.user.id },
        })
    })
```

`tests/integration/auth-routes.test.ts`, in `describe('POST /api/auth/activate')`, add:

```typescript
    it('records the activation authored by the trainee', async () => {
        requireAuthDuringOnboarding.mockResolvedValue({ user: { ...mockTrainerSession.user, isActive: false } })

        const response = await activate(makeRequest({}))

        expect(response.status).toBe(200)
        expect(prismaMock.userStatusEvent.create).toHaveBeenCalledWith({
            data: { userId: mockTrainerSession.user.id, type: 'activated', actorId: mockTrainerSession.user.id },
        })
    })

    it('records nothing when the user was already active', async () => {
        const response = await activate(makeRequest({}))

        expect(response.status).toBe(200)
        expect(prismaMock.userStatusEvent.create).not.toHaveBeenCalled()
    })
```

`tests/integration/users-activation.test.ts`, in `describe('PATCH /api/users/[id]/activate')` add:

```typescript
    it('records a reactivated event authored by the trainer', async () => {
        await activateUser(makeRequest('activate'), withParams({ id: TRAINEE_ID }))

        expect(prismaMock.userStatusEvent.create).toHaveBeenCalledWith({
            data: { userId: TRAINEE_ID, type: 'reactivated', actorId: mockTrainerSession.user.id },
        })
    })
```

and in the existing test `'skips the invitation check for a trainee who is already active'` add at the end:

```typescript
        expect(prismaMock.userStatusEvent.create).not.toHaveBeenCalled()
```

In `describe('PATCH /api/users/[id]/deactivate')` (its `beforeEach` mocks an active trainee) add:

```typescript
    it('records a deactivated event authored by the trainer', async () => {
        await deactivateUser(makeRequest('deactivate'), withParams({ id: TRAINEE_ID }))

        expect(prismaMock.userStatusEvent.create).toHaveBeenCalledWith({
            data: { userId: TRAINEE_ID, type: 'deactivated', actorId: mockTrainerSession.user.id },
        })
    })

    it('records nothing when the trainee is already inactive', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee', isActive: false } as never)

        await deactivateUser(makeRequest('deactivate'), withParams({ id: TRAINEE_ID }))

        expect(prismaMock.userStatusEvent.create).not.toHaveBeenCalled()
    })
```

`tests/integration/users-resend-invite.test.ts`: in the first test `'re-sends the invite for a pending trainee the trainer owns'` add:

```typescript
        expect(prismaMock.userStatusEvent.create).toHaveBeenCalledWith({
            data: { userId: TRAINEE_ID, type: 'invitation_resent', actorId: mockTrainerSession.user.id },
        })
```

and add:

```typescript
    it('records nothing when the invite was not sent', async () => {
        vi.mocked(resendInvitation).mockResolvedValue('rateLimited')

        await resendInvite(makeRequest(), withParams(TRAINEE_ID))

        expect(prismaMock.userStatusEvent.create).not.toHaveBeenCalled()
    })

    it('still succeeds when the event cannot be recorded', async () => {
        prismaMock.userStatusEvent.create.mockRejectedValue(new Error('db down'))

        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))

        expect(res.status).toBe(200)
    })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/integration/users.test.ts tests/integration/auth-routes.test.ts tests/integration/users-activation.test.ts tests/integration/users-resend-invite.test.ts`
Expected: the new tests FAIL (`userStatusEvent.create` not called); every pre-existing test still passes.

- [ ] **Step 3: `POST /api/users` — create user, association and event in one transaction**

In `src/app/api/users/route.ts` replace the block from `// Create user in Prisma (inactive until they complete onboarding)` down to the end of the `if (role === 'trainee' && session.user.role === 'trainer') { ... }` block with:

```typescript
        // Create user in Prisma (inactive until they complete onboarding),
        // the trainer association and the "created" history event together
        const user = await prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: {
                    id: authData.user.id,
                    email,
                    firstName,
                    lastName,
                    role,
                    isActive: false, // Will be activated after password setup
                },
            })

            if (role === 'trainee' && session.user.role === 'trainer') {
                await tx.trainerTrainee.create({
                    data: {
                        trainerId: session.user.id,
                        traineeId: created.id,
                    },
                })
            }

            await tx.userStatusEvent.create({
                data: { userId: created.id, type: 'created', actorId: session.user.id },
            })

            return created
        })

        // inviteUserByEmail only fills user_metadata; authorization data has to be
        // written to app_metadata with the service role.
        await syncUserMetadata(user.id, { role, isActive: false })
```

- [ ] **Step 4: `POST /api/auth/activate`**

Replace the `prisma.user.update` call with:

```typescript
        // The activation is the trainee's own step: they are its author
        const updatedUser = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id: session.user.id },
                data: { isActive: true },
                select: { id: true },
            })

            if (!session.user.isActive) {
                await tx.userStatusEvent.create({
                    data: { userId: session.user.id, type: 'activated', actorId: session.user.id },
                })
            }

            return updated
        })
```

- [ ] **Step 5: `PATCH /api/users/[id]/deactivate`**

Replace `const user = await prisma.user.update({ ... })` (the `// Deactivate user` block) with:

```typescript
        // Deactivate user, recording the step only when the status changes
        const user = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id },
                data: { isActive: false },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    isActive: true,
                },
            })

            if (existingUser.isActive) {
                await tx.userStatusEvent.create({
                    data: { userId: id, type: 'deactivated', actorId: session.user.id },
                })
            }

            return updated
        })
```

- [ ] **Step 6: `PATCH /api/users/[id]/activate`**

Same change on the `// Activate user` block:

```typescript
        // Activate user, recording the step only when the status changes
        const user = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id },
                data: { isActive: true },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    isActive: true,
                },
            })

            if (!existingUser.isActive) {
                await tx.userStatusEvent.create({
                    data: { userId: id, type: 'reactivated', actorId: session.user.id },
                })
            }

            return updated
        })
```

- [ ] **Step 7: `POST /api/users/[id]/resend-invite`**

After the `rateLimited` check and before `logger.info(...)`, add:

```typescript
        // The email is already out: a failed history write must not turn it into an error
        await prisma.userStatusEvent
            .create({ data: { userId: id, type: 'invitation_resent', actorId: session.user.id } })
            .catch((error) => logger.error({ error, userId: id }, 'Could not record invitation_resent event'))
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run tests/integration/users.test.ts tests/integration/auth-routes.test.ts tests/integration/users-activation.test.ts tests/integration/users-resend-invite.test.ts tests/integration/users-delete.test.ts tests/integration/rbac.test.ts tests/integration/api-contracts.test.ts`
Expected: all PASS.

- [ ] **Step 9: Check line endings, commit**

Run: `git diff --stat` — only the edited lines per file, no whole-file rewrite.

```bash
git add src/app/api/users/route.ts src/app/api/auth/activate/route.ts "src/app/api/users/[id]/deactivate/route.ts" "src/app/api/users/[id]/activate/route.ts" "src/app/api/users/[id]/resend-invite/route.ts" tests/integration/users.test.ts tests/integration/auth-routes.test.ts tests/integration/users-activation.test.ts tests/integration/users-resend-invite.test.ts
git commit -m "feat(api): record user status events with their author"
```

---

### Task 3: Expose `pendingActivation` in the user list and detail

**Files:**
- Modify: `src/app/api/users/route.ts` (interface `ListedUser`, trainer branch of GET)
- Modify: `src/app/api/users/[id]/route.ts` (GET)
- Test: `tests/integration/users.test.ts`

**Interfaces:**
- Consumes: `findPendingActivationIds` (Task 1).
- Produces: trainer list items and `GET /api/users/[id]` `data.user` carry `pendingActivation: boolean`.

- [ ] **Step 1: Write the failing tests**

In `tests/integration/users.test.ts`:

`describe('GET /api/users')` → `beforeEach`, add `prismaMock.userStatusEvent.findMany.mockResolvedValue([] as never)`, then add:

```typescript
    it('flags inactive trainees that never activated their account', async () => {
        asTrainer()
        prismaMock.trainerTrainee.findMany.mockResolvedValue([
            { trainee: { ...mockUsers[0], id: 'pending-1', isActive: false } },
            { trainee: { ...mockUsers[0], id: 'deactivated-1', isActive: false, createdAt: new Date('2026-01-03') } },
            { trainee: { ...mockUsers[0], id: 'active-1', createdAt: new Date('2026-01-04') } },
        ] as never)
        prismaMock.userStatusEvent.findMany.mockResolvedValue([{ userId: 'deactivated-1' }] as never)

        const res = await GET(makeRequest('http://localhost:3000/api/users?includeInactive=true'))
        const body = await res.json()

        expect(res.status).toBe(200)
        const pendingById = Object.fromEntries(
            body.data.items.map((user: { id: string; pendingActivation: boolean }) => [user.id, user.pendingActivation])
        )
        expect(pendingById).toEqual({ 'pending-1': true, 'deactivated-1': false, 'active-1': false })
        expect(prismaMock.userStatusEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { userId: { in: ['deactivated-1', 'pending-1'] }, type: 'activated' } })
        )
    })
```

(If the list response is not under `body.data.items`, use the shape the other tests in that describe read.)

`describe('GET /api/users/[id]')` → `beforeEach`, add `prismaMock.userStatusEvent.findMany.mockResolvedValue([] as never)`, then add:

```typescript
    it('reports pendingActivation for an inactive user with no activated event', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ ...detailUser, isActive: false } as never)

        const res = await getUser(detailRequest(), detailParams())
        const body = await res.json()

        expect(body.data.user.pendingActivation).toBe(true)
    })

    it('reports a deactivated user as not pending', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ ...detailUser, isActive: false } as never)
        prismaMock.userStatusEvent.findMany.mockResolvedValue([{ userId: DETAIL_ID }] as never)

        const res = await getUser(detailRequest(), detailParams())
        const body = await res.json()

        expect(body.data.user.pendingActivation).toBe(false)
    })

    it('does not query events for an active user', async () => {
        const res = await getUser(detailRequest(), detailParams())
        const body = await res.json()

        expect(body.data.user.pendingActivation).toBe(false)
        expect(prismaMock.userStatusEvent.findMany).not.toHaveBeenCalled()
    })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/integration/users.test.ts`
Expected: the new tests FAIL (`pendingActivation` undefined).

- [ ] **Step 3: List — trainer branch**

In `src/app/api/users/route.ts`:
- add `import { findPendingActivationIds } from '@/lib/user-status-events'`;
- in `interface ListedUser` add, after `subscription?`:

```typescript
    /** Trainer listing only: inactive and never completed onboarding */
    pendingActivation?: boolean
```

- replace

```typescript
                // One aggregate query for every trainee (no N+1)
                const endDates = await getCurrentEndDates(trainees.map((trainee) => trainee.id))
                const today = getTodayDateKey()
                users = trainees.map((trainee) => ({
                    ...trainee,
                    subscription: toSubscriptionSummary(endDates.get(trainee.id) ?? null, today),
                }))
```

with

```typescript
                // One aggregate query per concern for every trainee (no N+1)
                const [endDates, pendingIds] = await Promise.all([
                    getCurrentEndDates(trainees.map((trainee) => trainee.id)),
                    findPendingActivationIds(trainees.filter((trainee) => !trainee.isActive).map((trainee) => trainee.id)),
                ])
                const today = getTodayDateKey()
                users = trainees.map((trainee) => ({
                    ...trainee,
                    subscription: toSubscriptionSummary(endDates.get(trainee.id) ?? null, today),
                    pendingActivation: pendingIds.has(trainee.id),
                }))
```

- [ ] **Step 4: Detail**

In `src/app/api/users/[id]/route.ts` add `import { findPendingActivationIds } from '@/lib/user-status-events'` and replace the block

```typescript
        // Only inactive users can have a pending invite: skip the Supabase call otherwise
        let invitationPending = false
        if (!user.isActive) {
            invitationPending = await isInvitationPending(id).catch((error) => {
                logger.warn({ error, userId: id }, 'Could not read invitation status')
                return false
            })
        }

        return apiSuccess({ user: { ...user, invitationPending } })
```

with

```typescript
        // Only inactive users can be pending: skip both lookups otherwise
        let invitationPending = false
        let pendingActivation = false
        if (!user.isActive) {
            const [pendingIds, invitePending] = await Promise.all([
                findPendingActivationIds([id]),
                isInvitationPending(id).catch((error) => {
                    logger.warn({ error, userId: id }, 'Could not read invitation status')
                    return false
                }),
            ])
            pendingActivation = pendingIds.has(id)
            invitationPending = invitePending
        }

        return apiSuccess({ user: { ...user, invitationPending, pendingActivation } })
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/integration/users.test.ts tests/integration/api-contracts.test.ts tests/integration/rbac.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/users/route.ts "src/app/api/users/[id]/route.ts" tests/integration/users.test.ts
git commit -m "feat(api): expose pendingActivation in trainee list and detail"
```

---

### Task 4: `GET /api/users/[id]/status-history`

**Files:**
- Create: `src/app/api/users/[id]/status-history/route.ts`
- Test: `tests/integration/users-status-history.test.ts`

**Interfaces:**
- Produces: `GET /api/users/[id]/status-history` → `{ data: { createdAt: string, isActive: boolean, events: { type, at: string, actor: { firstName, lastName } | null }[] } }`, events ordered oldest first. Matches the `StatusHistory` type of Task 5.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/users-status-history.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET as getStatusHistory } from '@/app/api/users/[id]/status-history/route'
import { requireRole } from '@/lib/auth'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asUnauthenticated, asForbidden } from '../helpers/auth-mock'
import { mockTrainerSession } from '../helpers/sessions'

const TRAINEE_ID = 'trainee-uuid-1'

const withParams = (id: string) => ({ params: Promise.resolve({ id }) })

function makeRequest() {
    return new NextRequest(`http://localhost:3000/api/users/${TRAINEE_ID}/status-history`)
}

const storedUser = {
    createdAt: new Date('2026-10-01T09:12:05Z'),
    isActive: true,
    statusEvents: [
        {
            type: 'created',
            createdAt: new Date('2026-10-01T09:12:05Z'),
            actor: { firstName: 'Luca', lastName: 'Bianchi' },
        },
        { type: 'activated', createdAt: new Date('2026-10-01T18:40:11Z'), actor: null },
    ],
}

describe('GET /api/users/[id]/status-history', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: mockTrainerSession.user.id,
            traineeId: TRAINEE_ID,
        } as never)
        prismaMock.user.findUnique.mockResolvedValue(storedUser as never)
    })

    it('returns the history of a trainee the trainer owns, oldest first', async () => {
        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data).toEqual({
            createdAt: '2026-10-01T09:12:05.000Z',
            isActive: true,
            events: [
                { type: 'created', at: '2026-10-01T09:12:05.000Z', actor: { firstName: 'Luca', lastName: 'Bianchi' } },
                { type: 'activated', at: '2026-10-01T18:40:11.000Z', actor: null },
            ],
        })
        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer'])
        expect(prismaMock.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: mockTrainerSession.user.id, traineeId: TRAINEE_ID },
        })
        expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: { id: TRAINEE_ID },
            select: {
                createdAt: true,
                isActive: true,
                statusEvents: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        type: true,
                        createdAt: true,
                        actor: { select: { firstName: true, lastName: true } },
                    },
                },
            },
        })
    })

    it('lets an admin read any user without an association', async () => {
        asAdmin()

        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))

        expect(res.status).toBe(200)
        expect(prismaMock.trainerTrainee.findFirst).not.toHaveBeenCalled()
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))

        expect(res.status).toBe(401)
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainee', async () => {
        asForbidden()

        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainer who does not own the trainee', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('auth.accessDenied')
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns 404 when the user does not exist', async () => {
        asAdmin()
        prismaMock.user.findUnique.mockResolvedValue(null)

        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('user.notFound')
    })

    it('returns 500 when the query fails', async () => {
        prismaMock.user.findUnique.mockRejectedValue(new Error('db down'))

        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/integration/users-status-history.test.ts`
Expected: FAIL, cannot resolve the route module.

- [ ] **Step 3: Implement the route**

Create `src/app/api/users/[id]/status-history/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

type Params = {
    params: Promise<{ id: string }>
}

/**
 * GET /api/users/[id]/status-history
 * Account timeline (created, invitation re-sent, activated, deactivated, reactivated)
 * - Trainer: own trainees only
 * - Admin: any user
 */
export async function GET(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        if (session.user.role === 'trainer') {
            const association = await prisma.trainerTrainee.findFirst({
                where: { trainerId: session.user.id, traineeId: id },
            })

            if (!association) {
                return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
            }
        }

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                createdAt: true,
                isActive: true,
                statusEvents: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        type: true,
                        createdAt: true,
                        actor: { select: { firstName: true, lastName: true } },
                    },
                },
            },
        })

        if (!user) {
            return apiError('NOT_FOUND', 'User not found', 404, undefined, 'user.notFound')
        }

        return apiSuccess({
            createdAt: user.createdAt,
            isActive: user.isActive,
            events: user.statusEvents.map((event) => ({
                type: event.type,
                at: event.createdAt,
                actor: event.actor,
            })),
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, userId: id }, 'Error fetching status history')
        return apiError('INTERNAL_ERROR', 'Failed to fetch status history', 500, undefined, 'internal.default')
    }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/integration/users-status-history.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/users/[id]/status-history/route.ts" tests/integration/users-status-history.test.ts
git commit -m "feat(api): add user status history endpoint"
```

---

### Task 5: Timeline builder and `formatDateTime` with seconds

**Files:**
- Create: `src/lib/user-status-timeline.ts`
- Modify: `src/lib/date-format.ts` (`formatDateTime`)
- Test: `tests/unit/lib/user-status-timeline.test.ts`, `tests/unit/date-format.test.ts`

**Interfaces:**
- Produces (client-safe, no Prisma import):

```typescript
export type StatusEventType = 'created' | 'activated' | 'deactivated' | 'reactivated' | 'invitation_resent'
export interface StatusHistoryEvent { type: StatusEventType; at: string; actor: { firstName: string; lastName: string } | null }
export interface StatusHistory { createdAt: string; isActive: boolean; events: StatusHistoryEvent[] }
export type TimelineKind = StatusEventType | 'pending_activation'
export interface TimelineLine { kind: TimelineKind; at: string | null; actorName: string | null }
export function buildStatusTimeline(history: StatusHistory): TimelineLine[]
```

- Produces: `formatDateTime(date, 'seconds')` → `dd/MM/yyyy HH:mm:ss` in local time, locale-independent.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lib/user-status-timeline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildStatusTimeline, type StatusHistoryEvent } from '@/lib/user-status-timeline'

const trainer = { firstName: 'Luca', lastName: 'Bianchi' }
const trainee = { firstName: 'Mario', lastName: 'Rossi' }
const CREATED_AT = '2026-10-01T09:00:00.000Z'

const event = (type: StatusHistoryEvent['type'], at: string, actor: StatusHistoryEvent['actor']): StatusHistoryEvent => ({
    type,
    at,
    actor,
})

describe('buildStatusTimeline', () => {
    it('shows a fresh trainee as created and waiting for activation', () => {
        expect(
            buildStatusTimeline({ createdAt: CREATED_AT, isActive: false, events: [event('created', CREATED_AT, trainer)] })
        ).toEqual([
            { kind: 'created', at: CREATED_AT, actorName: 'Luca Bianchi' },
            { kind: 'pending_activation', at: null, actorName: null },
        ])
    })

    it('lists re-sent invitations before the pending line', () => {
        const lines = buildStatusTimeline({
            createdAt: CREATED_AT,
            isActive: false,
            events: [event('created', CREATED_AT, trainer), event('invitation_resent', '2026-10-02T10:00:00.000Z', trainer)],
        })

        expect(lines.map((line) => line.kind)).toEqual(['created', 'invitation_resent', 'pending_activation'])
    })

    it('shows the activation authored by the trainee', () => {
        const lines = buildStatusTimeline({
            createdAt: CREATED_AT,
            isActive: true,
            events: [event('created', CREATED_AT, trainer), event('activated', '2026-10-01T18:00:00.000Z', trainee)],
        })

        expect(lines).toEqual([
            { kind: 'created', at: CREATED_AT, actorName: 'Luca Bianchi' },
            { kind: 'activated', at: '2026-10-01T18:00:00.000Z', actorName: 'Mario Rossi' },
        ])
    })

    it('keeps every deactivate / reactivate cycle in order', () => {
        const lines = buildStatusTimeline({
            createdAt: CREATED_AT,
            isActive: false,
            events: [
                event('created', CREATED_AT, trainer),
                event('activated', '2026-10-01T18:00:00.000Z', trainee),
                event('deactivated', '2026-10-05T08:00:00.000Z', trainer),
                event('reactivated', '2026-10-06T08:00:00.000Z', trainer),
                event('deactivated', '2026-10-07T08:00:00.000Z', trainer),
            ],
        })

        expect(lines.map((line) => line.kind)).toEqual(['created', 'activated', 'deactivated', 'reactivated', 'deactivated'])
    })

    it('adds an undated deactivation for legacy users deactivated before the history existed', () => {
        const lines = buildStatusTimeline({
            createdAt: CREATED_AT,
            isActive: false,
            events: [event('created', CREATED_AT, trainer), event('activated', '2026-10-01T18:00:00.000Z', trainee)],
        })

        expect(lines.at(-1)).toEqual({ kind: 'deactivated', at: null, actorName: null })
    })

    it('falls back to createdAt without author when there is no created event', () => {
        const lines = buildStatusTimeline({ createdAt: CREATED_AT, isActive: false, events: [] })

        expect(lines).toEqual([
            { kind: 'created', at: CREATED_AT, actorName: null },
            { kind: 'pending_activation', at: null, actorName: null },
        ])
    })

    it('shows no author when the actor was deleted', () => {
        const lines = buildStatusTimeline({
            createdAt: CREATED_AT,
            isActive: false,
            events: [event('created', CREATED_AT, null)],
        })

        expect(lines[0]).toEqual({ kind: 'created', at: CREATED_AT, actorName: null })
    })
})
```

In `tests/unit/date-format.test.ts`, inside `describe('formatDateTime')`, add (the suite runs with `TZ=UTC`):

```typescript
    it('formats with seconds as dd/MM/yyyy HH:mm:ss regardless of locale', () => {
        expect(formatDateTime('2026-10-03T09:05:07.000Z', 'seconds')).toBe('03/10/2026 09:05:07')
        i18nMock.language = 'en'
        expect(formatDateTime(new Date('2026-12-31T23:59:59.000Z'), 'seconds')).toBe('31/12/2026 23:59:59')
    })

    it('returns "-" for an invalid date with seconds', () => {
        expect(formatDateTime('bad-date', 'seconds')).toBe('-')
    })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/lib/user-status-timeline.test.ts tests/unit/date-format.test.ts`
Expected: timeline FAIL (module missing); seconds test FAIL (TypeScript-only union, runtime returns locale string).

- [ ] **Step 3: Implement the timeline builder**

Create `src/lib/user-status-timeline.ts`:

```typescript
export type StatusEventType = 'created' | 'activated' | 'deactivated' | 'reactivated' | 'invitation_resent'

export interface StatusHistoryEvent {
    type: StatusEventType
    at: string
    actor: { firstName: string; lastName: string } | null
}

/** Shape returned by GET /api/users/[id]/status-history */
export interface StatusHistory {
    createdAt: string
    isActive: boolean
    events: StatusHistoryEvent[]
}

export type TimelineKind = StatusEventType | 'pending_activation'

export interface TimelineLine {
    kind: TimelineKind
    /** null when the step has no date: still pending, or older than the history */
    at: string | null
    actorName: string | null
}

const toActorName = (actor: StatusHistoryEvent['actor']): string | null =>
    actor ? `${actor.firstName} ${actor.lastName}` : null

export function buildStatusTimeline({ createdAt, isActive, events }: StatusHistory): TimelineLine[] {
    // Users created by the old code during the deploy have no "created" event
    const created = events.find((event) => event.type === 'created')
    const lines: TimelineLine[] = [
        { kind: 'created', at: created?.at ?? createdAt, actorName: toActorName(created?.actor ?? null) },
    ]

    for (const event of events) {
        if (event.type === 'created') continue
        lines.push({ kind: event.type, at: event.at, actorName: toActorName(event.actor) })
    }

    if (isActive) return lines

    if (!events.some((event) => event.type === 'activated')) {
        lines.push({ kind: 'pending_activation', at: null, actorName: null })
    } else if (events.at(-1)?.type !== 'deactivated') {
        // Deactivated before the history existed: the date is unknown
        lines.push({ kind: 'deactivated', at: null, actorName: null })
    }

    return lines
}
```

- [ ] **Step 4: Add the `'seconds'` format**

In `src/lib/date-format.ts`, change the signature to `format: 'short' | 'medium' | 'seconds' = 'short'`, update the JSDoc example list with `formatDateTime('2024-03-30T14:30:05', 'seconds') // "30/03/2024 14:30:05"`, and right after `if (isNaN(dateObj.getTime())) return '-'` add:

```typescript
        // Fixed dd/MM/yyyy HH:mm:ss for audit timelines, independent of the locale
        if (format === 'seconds') {
            const pad = (value: number) => String(value).padStart(2, '0')
            return `${pad(dateObj.getDate())}/${pad(dateObj.getMonth() + 1)}/${dateObj.getFullYear()} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`
        }
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/lib/user-status-timeline.test.ts tests/unit/date-format.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/user-status-timeline.ts src/lib/date-format.ts tests/unit/lib/user-status-timeline.test.ts tests/unit/date-format.test.ts
git commit -m "feat(lib): status timeline builder and seconds date format"
```

---

### Task 6: `UserStatusBadge` component

**Files:**
- Create: `src/components/UserStatusBadge.tsx`
- Modify: `src/components/index.ts` (barrel export)
- Modify: `public/locales/en/components.json`, `public/locales/it/components.json`
- Test: `tests/unit/UserStatusBadge.test.tsx`

**Interfaces:**
- Consumes: `buildStatusTimeline`, `StatusHistory`, `TimelineKind` (Task 5), `formatDateTime(..., 'seconds')` (Task 5), endpoint of Task 4.
- Produces: `<UserStatusBadge userId isActive pendingActivation size?="sm"|"md" />` (default export, also from `@/components`). Label keys: `userStatus.active`, `userStatus.deactivated`, `userStatus.pending` (namespace `components`).

- [ ] **Step 1: Add the i18n keys**

`public/locales/en/components.json`: replace the final

```json
        "last": "Last"
    }
}
```

with

```json
        "last": "Last"
    },
    "userStatus": {
        "active": "Active",
        "deactivated": "Deactivated",
        "pending": "Waiting for activation",
        "historyTitle": "Account history",
        "loadError": "Could not load the history",
        "dateUnavailable": "Date not available",
        "by": "by",
        "kind": {
            "created": "Account created",
            "invitation_resent": "Invitation re-sent",
            "pending_activation": "Waiting for activation",
            "activated": "Account activated",
            "deactivated": "Deactivated",
            "reactivated": "Reactivated"
        }
    }
}
```

`public/locales/it/components.json`: same structure after its `pagination` block (check the exact closing lines first), with:

```json
    "userStatus": {
        "active": "Attivo",
        "deactivated": "Disattivato",
        "pending": "In attesa di attivazione",
        "historyTitle": "Storico account",
        "loadError": "Impossibile caricare lo storico",
        "dateUnavailable": "Data non disponibile",
        "by": "da",
        "kind": {
            "created": "Account creato",
            "invitation_resent": "Invito reinviato",
            "pending_activation": "In attesa di attivazione",
            "activated": "Account attivato",
            "deactivated": "Disattivato",
            "reactivated": "Riattivato"
        }
    }
```

Validate: `for f in public/locales/{en,it}/components.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f ok"; done`

- [ ] **Step 2: Write the failing component test**

Create `tests/unit/UserStatusBadge.test.tsx` (the global `react-i18next` mock returns the key itself):

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import UserStatusBadge from '@/components/UserStatusBadge'

const history = {
    createdAt: '2026-10-01T09:12:05.000Z',
    isActive: true,
    events: [
        { type: 'created', at: '2026-10-01T09:12:05.000Z', actor: { firstName: 'Luca', lastName: 'Bianchi' } },
        { type: 'activated', at: '2026-10-01T18:40:11.000Z', actor: { firstName: 'Mario', lastName: 'Rossi' } },
    ],
}

function mockFetchOk(body: unknown = history) {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: body }) }) as Response)
    global.fetch = fetchMock as unknown as typeof fetch
    return fetchMock
}

describe('UserStatusBadge', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it.each([
        [{ isActive: true, pendingActivation: false }, 'userStatus.active'],
        [{ isActive: false, pendingActivation: false }, 'userStatus.deactivated'],
        [{ isActive: false, pendingActivation: true }, 'userStatus.pending'],
    ])('renders the label for %o', (props, label) => {
        mockFetchOk()
        render(<UserStatusBadge userId="u-1" {...props} />)

        expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    })

    it('opens on hover, loads the history once and shows dates and authors', async () => {
        const fetchMock = mockFetchOk()
        render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)
        const badge = screen.getByRole('button', { name: 'userStatus.active' })

        fireEvent.mouseEnter(badge)

        expect(await screen.findByText('userStatus.kind.created')).toBeInTheDocument()
        expect(screen.getByText('userStatus.kind.activated')).toBeInTheDocument()
        expect(screen.getByText(/01\/10\/2026 09:12:05/)).toBeInTheDocument()
        expect(screen.getByText(/Luca Bianchi/)).toBeInTheDocument()
        expect(screen.getByText(/Mario Rossi/)).toBeInTheDocument()
        expect(badge).toHaveAttribute('aria-expanded', 'true')

        fireEvent.mouseLeave(badge)
        fireEvent.mouseEnter(badge)
        fireEvent.mouseLeave(badge)
        fireEvent.click(badge)

        await screen.findByText('userStatus.kind.created')
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledWith('/api/users/u-1/status-history', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    })

    it('shows no author when the step has none', async () => {
        mockFetchOk({ ...history, events: [{ type: 'created', at: history.createdAt, actor: null }] })
        render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)

        fireEvent.click(screen.getByRole('button', { name: 'userStatus.active' }))

        await screen.findByText('userStatus.kind.created')
        expect(screen.queryByText(/userStatus\.by/)).not.toBeInTheDocument()
    })

    it('shows an error when the history cannot be loaded', async () => {
        global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: {} }) }) as Response) as unknown as typeof fetch
        render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)

        fireEvent.click(screen.getByRole('button', { name: 'userStatus.active' }))

        expect(await screen.findByText('userStatus.loadError')).toBeInTheDocument()
    })

    it('closes on Escape and on an outside click', async () => {
        mockFetchOk()
        render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)
        const badge = screen.getByRole('button', { name: 'userStatus.active' })

        fireEvent.click(badge)
        await screen.findByRole('tooltip')
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

        fireEvent.click(badge)
        await screen.findByRole('tooltip')
        fireEvent.mouseDown(document.body)
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('reloads the history after a status change', async () => {
        const fetchMock = mockFetchOk()
        const { rerender } = render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)

        fireEvent.click(screen.getByRole('button', { name: 'userStatus.active' }))
        await screen.findByText('userStatus.kind.created')
        fireEvent.keyDown(document, { key: 'Escape' })

        rerender(<UserStatusBadge userId="u-1" isActive={false} pendingActivation={false} />)
        fireEvent.click(screen.getByRole('button', { name: 'userStatus.deactivated' }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    })

    it('opens above the badge when there is no room below', async () => {
        mockFetchOk()
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200)
        render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)
        const badge = screen.getByRole('button', { name: 'userStatus.active' })
        vi.spyOn(badge, 'getBoundingClientRect').mockReturnValue({
            top: window.innerHeight - 40,
            bottom: window.innerHeight - 10,
            left: window.innerWidth - 20,
            right: window.innerWidth,
            width: 20,
            height: 30,
            x: window.innerWidth - 20,
            y: window.innerHeight - 40,
            toJSON: () => ({}),
        })

        await act(async () => {
            fireEvent.click(badge)
        })
        const tooltip = await screen.findByRole('tooltip')

        expect(parseFloat(tooltip.style.top)).toBe(window.innerHeight - 40 - 8 - 200)
        expect(parseFloat(tooltip.style.left) + parseFloat(tooltip.style.width)).toBeLessThanOrEqual(window.innerWidth - 8)
    })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/unit/UserStatusBadge.test.tsx`
Expected: FAIL, cannot resolve `@/components/UserStatusBadge`.

- [ ] **Step 4: Implement the component**

Create `src/components/UserStatusBadge.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Ban, CheckCircle2, Hourglass, MailPlus, RotateCcw, UserPlus, type LucideIcon } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import { formatDateTime } from '@/lib/date-format'
import { buildStatusTimeline, type StatusHistory, type TimelineKind } from '@/lib/user-status-timeline'

interface UserStatusBadgeProps {
    userId: string
    isActive: boolean
    pendingActivation: boolean
    size?: 'sm' | 'md'
}

const POPOVER_WIDTH = 288
const POPOVER_GAP = 8

const KIND_ICONS: Record<TimelineKind, LucideIcon> = {
    created: UserPlus,
    invitation_resent: MailPlus,
    pending_activation: Hourglass,
    activated: CheckCircle2,
    deactivated: Ban,
    reactivated: RotateCcw,
}

const STATUS_STYLES = {
    active: 'bg-green-100 text-green-800',
    deactivated: 'bg-red-100 text-red-800',
    pending: 'bg-amber-100 text-amber-800',
}

const SIZE_STYLES = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
}

/**
 * Account status badge. Hover, focus or tap opens the account timeline,
 * fetched on first open and cached until the status changes.
 */
export default function UserStatusBadge({ userId, isActive, pendingActivation, size = 'md' }: UserStatusBadgeProps) {
    const { t } = useTranslation('components')
    const [open, setOpen] = useState(false)
    const [history, setHistory] = useState<StatusHistory | null>(null)
    const [error, setError] = useState(false)
    const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({})
    const buttonRef = useRef<HTMLButtonElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)
    const requestRef = useRef<AbortController | null>(null)

    // A status change (e.g. the list toggle) makes the cached history stale
    useEffect(() => {
        requestRef.current?.abort()
        requestRef.current = null
        setHistory(null)
        setError(false)
    }, [userId, isActive, pendingActivation])

    useEffect(() => () => requestRef.current?.abort(), [])

    const loadHistory = useCallback(async () => {
        if (requestRef.current) return
        const controller = new AbortController()
        requestRef.current = controller
        try {
            const res = await fetch(`/api/users/${userId}/status-history`, { signal: controller.signal })
            const json = await res.json()
            if (!res.ok) throw new Error('status history request failed')
            if (!controller.signal.aborted) setHistory(json.data)
        } catch {
            if (!controller.signal.aborted) setError(true)
        } finally {
            if (requestRef.current === controller) requestRef.current = null
        }
    }, [userId])

    useEffect(() => {
        if (open && !history && !error) void loadHistory()
    }, [open, history, error, loadHistory])

    // Fixed position in a portal: list rows sit in an overflow-hidden card
    const updatePosition = useCallback(() => {
        const rect = buttonRef.current?.getBoundingClientRect()
        if (!rect) return
        const width = Math.min(POPOVER_WIDTH, window.innerWidth - 2 * POPOVER_GAP)
        const height = popoverRef.current?.offsetHeight ?? 0
        const left = Math.min(Math.max(POPOVER_GAP, rect.left), window.innerWidth - width - POPOVER_GAP)
        const fitsBelow = rect.bottom + POPOVER_GAP + height <= window.innerHeight
        setPopoverStyle({
            position: 'fixed',
            top: fitsBelow ? rect.bottom + POPOVER_GAP : Math.max(POPOVER_GAP, rect.top - POPOVER_GAP - height),
            left,
            width,
            zIndex: 9999,
        })
    }, [])

    useLayoutEffect(() => {
        if (!open) return
        updatePosition()
        window.addEventListener('scroll', updatePosition, true)
        window.addEventListener('resize', updatePosition)
        return () => {
            window.removeEventListener('scroll', updatePosition, true)
            window.removeEventListener('resize', updatePosition)
        }
    }, [open, history, error, updatePosition])

    useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        const onMouseDown = (event: MouseEvent) => {
            if (!buttonRef.current?.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('mousedown', onMouseDown)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('mousedown', onMouseDown)
        }
    }, [open])

    const status = pendingActivation ? 'pending' : isActive ? 'active' : 'deactivated'
    const popoverId = `user-status-history-${userId}`

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={`${SIZE_STYLES[size]} ${STATUS_STYLES[status]} font-semibold rounded-full cursor-help`}
                aria-expanded={open}
                aria-describedby={open ? popoverId : undefined}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                // Touch has no hover: a tap opens, a tap outside closes
                onClick={() => setOpen(true)}
            >
                {t(`userStatus.${status}`)}
            </button>
            {open &&
                createPortal(
                    <div
                        ref={popoverRef}
                        id={popoverId}
                        role="tooltip"
                        style={popoverStyle}
                        className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-left"
                    >
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            {t('userStatus.historyTitle')}
                        </p>
                        {error ? (
                            <p className="text-sm text-state-error">{t('userStatus.loadError')}</p>
                        ) : !history ? (
                            <div className="flex justify-center py-2">
                                <LoadingSpinner size="sm" />
                            </div>
                        ) : (
                            <ol className="space-y-2">
                                {buildStatusTimeline(history).map((line, index) => {
                                    const Icon = KIND_ICONS[line.kind]
                                    return (
                                        <li key={index} className="flex gap-2 text-sm">
                                            <Icon size={16} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
                                            <div>
                                                <p className="font-medium text-gray-900">{t(`userStatus.kind.${line.kind}`)}</p>
                                                {line.kind !== 'pending_activation' && (
                                                    <p className="text-xs text-gray-600">
                                                        {line.at ? formatDateTime(line.at, 'seconds') : t('userStatus.dateUnavailable')}
                                                        {line.actorName && ` · ${t('userStatus.by')} ${line.actorName}`}
                                                    </p>
                                                )}
                                            </div>
                                        </li>
                                    )
                                })}
                            </ol>
                        )}
                    </div>,
                    document.body
                )}
        </>
    )
}
```

- [ ] **Step 5: Export from the barrel**

In `src/components/index.ts` (CRLF, use Edit), after the line `export { default as SubscriptionStatusBadge } from './SubscriptionStatusBadge'` add:

```typescript
export { default as UserStatusBadge } from './UserStatusBadge'
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run tests/unit/UserStatusBadge.test.tsx`
Expected: PASS (9 tests). If the "opens above" test reads `top` before the layout effect re-runs with the measured height, the `act` wrapper covers it; do not loosen the assertion.

- [ ] **Step 7: Commit**

```bash
git add src/components/UserStatusBadge.tsx src/components/index.ts public/locales/en/components.json public/locales/it/components.json tests/unit/UserStatusBadge.test.tsx
git commit -m "feat(ui): user status badge with account history tooltip"
```

---

### Task 7: Use the badge in the trainee list and detail, changelog

**Files:**
- Modify: `src/app/trainer/trainees/_content.tsx` (interface `Trainee`, status cell ~line 341)
- Modify: `src/app/trainer/trainees/[id]/_content.tsx` (interface `Trainee`, header badge block)
- Modify: `public/locales/{en,it}/trainer.json` (remove `athletes.invitationPendingStatus`)
- Modify: `tests/unit/trainer-trainee-detail-resend-invite.test.tsx`
- Modify: `implementation-docs/CHANGELOG.md`

**Interfaces:**
- Consumes: `UserStatusBadge` (Task 6), `pendingActivation` in list items and detail user (Task 3), `invitationPending` (already shipped).

- [ ] **Step 1: Update the detail test to the new badge**

In `tests/unit/trainer-trainee-detail-resend-invite.test.tsx`:
- first test: user fixture `{ ...baseUser, isActive: false, invitationPending: true, pendingActivation: true }`, and replace `findByText('athletes.invitationPendingStatus')` with `findByRole('button', { name: 'userStatus.pending' })`;
- second test: same fixture change;
- third test: fixture `{ ...baseUser, isActive: true, invitationPending: false, pendingActivation: false }`, replace `findByText('athletes.activeStatus')` with `findByRole('button', { name: 'userStatus.active' })`.

Add a list test to `tests/unit/trainer-trainees-content.test.tsx` following that file's existing fetch mock: one trainee with `isActive: false, pendingActivation: true`, then

```tsx
        expect(await screen.findByRole('button', { name: 'userStatus.pending' })).toBeInTheDocument()
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/trainer-trainee-detail-resend-invite.test.tsx tests/unit/trainer-trainees-content.test.tsx`
Expected: the changed/new assertions FAIL (old labels still rendered).

- [ ] **Step 3: List page**

In `src/app/trainer/trainees/_content.tsx` (CRLF, Edit tool):
- interface `Trainee`: add `pendingActivation?: boolean` after `isActive: boolean`;
- add `UserStatusBadge` to the existing `@/components` import;
- replace the status `<span ...>{trainee.isActive ? t('athletes.activeStatus') : t('athletes.inactiveStatus')}</span>` inside the status `<td>` with:

```tsx
                                            <UserStatusBadge
                                                userId={trainee.id}
                                                isActive={trainee.isActive}
                                                pendingActivation={trainee.pendingActivation ?? false}
                                                size="sm"
                                            />
```

- [ ] **Step 4: Detail page**

In `src/app/trainer/trainees/[id]/_content.tsx` (CRLF, Edit tool):
- interface `Trainee`: add `pendingActivation?: boolean` after `invitationPending?: boolean`;
- add `UserStatusBadge` to the `@/components` import;
- replace the whole `{trainee.invitationPending ? ( <> ... </> ) : ( <span ...>...</span> )}` block with:

```tsx
                            <UserStatusBadge
                                userId={trainee.id}
                                isActive={trainee.isActive}
                                pendingActivation={trainee.pendingActivation ?? false}
                            />
                            {trainee.invitationPending && (
                                <Button
                                    variant="secondary"
                                    icon={<MailPlus size={16} />}
                                    isLoading={resendingInvite}
                                    loadingText={t('athletes.resendingInvite')}
                                    onClick={handleResendInvite}
                                >
                                    {t('athletes.resendInvite')}
                                </Button>
                            )}
```

- a re-send does not change the status, so the badge would keep its cached history without the new `invitation_resent` line. Remount it after a successful re-send with a counter:

```tsx
    const [statusHistoryVersion, setStatusHistoryVersion] = useState(0)
```

next to `resendingInvite`, `setStatusHistoryVersion((version) => version + 1)` right after `showToast(t('athletes.resendInviteSuccess'), 'success')`, and `key={statusHistoryVersion}` on `<UserStatusBadge>`.

- remove `"invitationPendingStatus"` from `public/locales/en/trainer.json` and `public/locales/it/trainer.json` (no longer used: `grep -rn invitationPendingStatus src tests` must print nothing).

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/trainer-trainee-detail-resend-invite.test.tsx tests/unit/trainer-trainees-content.test.tsx tests/unit/trainer-trainee-detail-sbd-report.test.tsx tests/unit/UserStatusBadge.test.tsx`
Expected: all PASS.

- [ ] **Step 6: CHANGELOG**

In `implementation-docs/CHANGELOG.md` (CRLF, Edit tool), right below `### Changed` add:

```markdown
### [3 Ottobre 2026] — Storico stato account atleta nel tooltip del badge

**File modificati:** `prisma/schema.prisma`, `prisma/migrations/20261003120000_add_user_status_events/migration.sql` (nuovo), `src/lib/user-status-events.ts` (nuovo), `src/lib/user-status-timeline.ts` (nuovo), `src/lib/date-format.ts`, `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts`, `src/app/api/users/[id]/status-history/route.ts` (nuovo), `src/app/api/users/[id]/activate/route.ts`, `src/app/api/users/[id]/deactivate/route.ts`, `src/app/api/users/[id]/resend-invite/route.ts`, `src/app/api/auth/activate/route.ts`, `src/components/UserStatusBadge.tsx` (nuovo), `src/components/index.ts`, `src/app/trainer/trainees/_content.tsx`, `src/app/trainer/trainees/[id]/_content.tsx`, `public/locales/{en,it}/{components,trainer}.json`, test relativi, `implementation-docs/CHANGELOG.md`
**Note:** Il trainer non vedeva come un atleta era arrivato allo stato attuale. Nuova tabella `user_status_events` (creato, invito reinviato, attivato, disattivato, riattivato) con autore: il trainer per creazione, disattivazione, riattivazione e reinvio, il trainee stesso per l'attivazione. Gli eventi si scrivono nella stessa transazione del cambio di stato e solo se lo stato cambia davvero. Il nuovo `UserStatusBadge` (lista e dettaglio atleta) mostra "Attivo", "Disattivato" o "In attesa di attivazione"; al passaggio del mouse o al tap apre la cronologia con data `dd/MM/yyyy HH:mm:ss` e "da Nome Cognome", caricata da `GET /api/users/[id]/status-history` solo alla prima apertura. La migrazione ricostruisce lo storico degli utenti esistenti: creazione da parte del trainer attuale, attivazione da parte del trainee alla data di conferma email (approssimata); le disattivazioni passate compaiono come "data non disponibile".
```

- [ ] **Step 7: Full verification**

Run, in order:
```bash
npx tsc --noEmit
npx eslint src/lib src/components/UserStatusBadge.tsx src/app/api/users src/app/api/auth/activate src/app/trainer/trainees tests/unit/UserStatusBadge.test.tsx tests/unit/lib tests/integration/users*.test.ts tests/integration/auth-routes.test.ts
npm run test:unit
```
Expected: no type errors, no lint errors, full suite green with coverage thresholds met (`src/lib/**` and `src/app/api/**` ≥ the floors in `vitest.config.ts`). Then `git diff --stat HEAD~6` must show no whole-file rewrites.

- [ ] **Step 8: Commit**

```bash
git add src/app/trainer/trainees/_content.tsx "src/app/trainer/trainees/[id]/_content.tsx" public/locales/en/trainer.json public/locales/it/trainer.json tests/unit/trainer-trainee-detail-resend-invite.test.tsx tests/unit/trainer-trainees-content.test.tsx implementation-docs/CHANGELOG.md
git commit -m "feat(trainer): status history tooltip in trainee list and detail"
```
