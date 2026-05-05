# User Metadata Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Supabase `user_metadata` in sync with Prisma on every mutation, then optimize `getSession()` to skip the Prisma DB call by reading from JWT metadata.

**Architecture:** A thin `syncUserMetadata` helper centralizes all writes to Supabase user_metadata. Every route that mutates a user calls it after the Prisma write. `getSession()` checks metadata completeness first; if all four fields (`role`, `isActive`, `firstName`, `lastName`) are present, it returns immediately without hitting Prisma. The Prisma `users` table is **not changed** — it remains the source of truth for relational list queries, FK constraints, and DB-level filtering.

**Tech Stack:** Next.js 15 App Router, Supabase SSR (`createAdminClient`), Prisma, Vitest

---

## Why Prisma columns are NOT removed

`prisma.user.findMany({ where: { role: 'trainee', isActive: true } })` is used in `GET /api/users`, `GET /api/programs`, and trainer dashboard queries. Removing `role` or `isActive` from the `users` table would replace efficient SQL `WHERE` clauses with N+1 Supabase Auth API calls. The metadata is a **read cache for the hot path** (`getSession()`), not the primary store.

---

## File map

| Action | Path |
|--------|------|
| Create | `src/lib/sync-user-metadata.ts` |
| Modify | `src/lib/auth.ts` |
| Modify | `src/app/api/users/route.ts` |
| Modify | `src/app/api/users/[id]/route.ts` |
| Modify | `src/app/api/users/[id]/activate/route.ts` |
| Modify | `src/app/api/users/[id]/deactivate/route.ts` |
| Modify | `src/app/api/auth/activate/route.ts` |
| Modify | `scripts/backfill-user-roles.ts` |
| Modify | `tests/integration/users.test.ts` |
| Create | `tests/integration/auth-session.test.ts` |

---

### Task 1: Create `syncUserMetadata` helper

**Files:**
- Create: `src/lib/sync-user-metadata.ts`

- [ ] **Step 1: Create the helper**

```typescript
// src/lib/sync-user-metadata.ts
import { createAdminClient } from './supabase-server'
import type { Role } from '@prisma/client'

export interface UserMetadataFields {
    role?: Role
    firstName?: string
    lastName?: string
    isActive?: boolean
}

export async function syncUserMetadata(userId: string, fields: UserMetadataFields): Promise<void> {
    const adminClient = createAdminClient()

    const { data: existing } = await adminClient.auth.admin.getUserById(userId)
    const currentMeta = existing.user?.user_metadata ?? {}

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: {
            ...currentMeta,
            ...fields,
        },
    })

    if (error) {
        throw new Error(`syncUserMetadata failed for ${userId}: ${error.message}`)
    }
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync-user-metadata.ts
git commit -m "feat: add syncUserMetadata helper for Supabase JWT metadata cache"
```

---

### Task 2: Sync `isActive=false` at user creation

**Files:**
- Modify: `src/app/api/users/route.ts`

`inviteUserByEmail` already stores `role`, `firstName`, `lastName` in metadata. Missing: `isActive=false`. Add it after the Prisma `user.create` call.

- [ ] **Step 1: Add import to `src/app/api/users/route.ts`**

After the existing imports, add:

```typescript
import { syncUserMetadata } from '@/lib/sync-user-metadata'
```

- [ ] **Step 2: Call `syncUserMetadata` after `prisma.user.create`**

In the `POST` handler, find the block after `prisma.user.create` (currently around line 104) and add the sync call. The full create+sync block becomes:

```typescript
// Create user in Prisma (inactive until they complete onboarding)
const user = await prisma.user.create({
    data: {
        id: authData.user.id,
        email,
        firstName,
        lastName,
        role,
        isActive: false, // Will be activated after password setup
    },
})

await syncUserMetadata(user.id, { isActive: false })
```

- [ ] **Step 3: Verify type-check**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Run unit tests**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npm run test:unit
```

Expected: all pass.

- [ ] **Step 5: Update integration test mock for `createAdminClient`**

In `tests/integration/users.test.ts`, the `createAdminClient` mock needs to expose `updateUserById` and `getUserById` so the sync call doesn't throw. Update the mock:

```typescript
vi.mock('@/lib/supabase-server', () => ({
    createClient: vi.fn(() => ({
        auth: {
            admin: {
                createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'supabase-uid' } }, error: null }),
            },
        },
    })),
    createAdminClient: vi.fn(() => ({
        auth: {
            admin: {
                inviteUserByEmail: vi.fn().mockResolvedValue({
                    data: { user: { id: 'supabase-uid' } },
                    error: null,
                }),
                getUserById: vi.fn().mockResolvedValue({
                    data: { user: { user_metadata: { role: 'trainee', firstName: 'Test', lastName: 'User' } } },
                    error: null,
                }),
                updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
            },
        },
    })),
}))
```

- [ ] **Step 6: Run integration tests**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npx vitest run tests/integration/users.test.ts
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/users/route.ts tests/integration/users.test.ts
git commit -m "feat: sync isActive=false to metadata when user is created"
```

---

### Task 3: Sync `isActive=true` at onboarding completion

**Files:**
- Modify: `src/app/api/auth/activate/route.ts`

After `prisma.user.update({ isActive: true })`, sync to metadata.

- [ ] **Step 1: Add import**

```typescript
import { syncUserMetadata } from '@/lib/sync-user-metadata'
```

- [ ] **Step 2: Add sync after Prisma update**

Replace the current `prisma.user.update` call block:

```typescript
const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: { isActive: true },
    select: { id: true },
})

await syncUserMetadata(updatedUser.id, { isActive: true })
```

- [ ] **Step 3: Verify type-check**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/activate/route.ts
git commit -m "feat: sync isActive=true to metadata after onboarding activation"
```

---

### Task 4: Sync `isActive=true` on admin/trainer activate

**Files:**
- Modify: `src/app/api/users/[id]/activate/route.ts`

- [ ] **Step 1: Add import**

```typescript
import { syncUserMetadata } from '@/lib/sync-user-metadata'
```

- [ ] **Step 2: Add sync after Prisma update**

Replace the existing `prisma.user.update` call:

```typescript
const user = await prisma.user.update({
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

await syncUserMetadata(id, { isActive: true })
```

- [ ] **Step 3: Verify type-check**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/users/[id]/activate/route.ts
git commit -m "feat: sync isActive=true to metadata on user activation"
```

---

### Task 5: Sync `isActive=false` on admin/trainer deactivate

**Files:**
- Modify: `src/app/api/users/[id]/deactivate/route.ts`

- [ ] **Step 1: Add import**

```typescript
import { syncUserMetadata } from '@/lib/sync-user-metadata'
```

- [ ] **Step 2: Add sync after Prisma update**

Replace the existing `prisma.user.update` call:

```typescript
const user = await prisma.user.update({
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

await syncUserMetadata(id, { isActive: false })
```

- [ ] **Step 3: Verify type-check**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/users/[id]/deactivate/route.ts
git commit -m "feat: sync isActive=false to metadata on user deactivation"
```

---

### Task 6: Sync `firstName`/`lastName` on profile update

**Files:**
- Modify: `src/app/api/users/[id]/route.ts`

The `PUT` handler updates Prisma but never syncs metadata. If a trainer updates a trainee's name, the metadata would be stale.

- [ ] **Step 1: Add import**

```typescript
import { syncUserMetadata } from '@/lib/sync-user-metadata'
```

- [ ] **Step 2: Add conditional sync after Prisma update**

After the `prisma.user.update` call in the `PUT` handler, add:

```typescript
const user = await prisma.user.update({
    where: { id },
    data: validation.data,
    select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
    },
})

// Sync name changes to metadata cache
const metaUpdates: { firstName?: string; lastName?: string } = {}
if (validation.data.firstName !== undefined) metaUpdates.firstName = user.firstName
if (validation.data.lastName !== undefined) metaUpdates.lastName = user.lastName
if (Object.keys(metaUpdates).length > 0) {
    await syncUserMetadata(id, metaUpdates)
}
```

- [ ] **Step 3: Verify type-check**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/users/[id]/route.ts
git commit -m "feat: sync firstName/lastName to metadata on user update"
```

---

### Task 7: Backfill `isActive` and verify `firstName`/`lastName` in existing user metadata

**Files:**
- Modify: `scripts/backfill-user-roles.ts`

The existing backfill already populates `role`. Extend it to also write `isActive`, `firstName`, `lastName`.

- [ ] **Step 1: Rewrite `scripts/backfill-user-roles.ts`**

```typescript
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

config()

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
})

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
    const users = await prisma.user.findMany({
        select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true },
    })

    console.log(`Found ${users.length} users to backfill`)

    let ok = 0
    let failed = 0

    for (const user of users) {
        const { data: existing } = await supabase.auth.admin.getUserById(user.id)
        const currentMeta = existing.user?.user_metadata ?? {}

        const { error } = await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: {
                ...currentMeta,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                isActive: user.isActive,
            },
        })

        if (error) {
            console.error(`FAIL  ${user.email}: ${error.message}`)
            failed++
        } else {
            console.log(`OK    ${user.email} → role=${user.role} isActive=${user.isActive}`)
            ok++
        }
    }

    console.log(`\nDone: ${ok} updated, ${failed} failed`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run the backfill against the target environment**

For development/staging:
```bash
cd /mnt/c/dev-projects/zero-cento-project && npx tsx scripts/backfill-user-roles.ts
```

Expected output: one `OK` line per user, `failed` count = 0.

For production: set `.env` to production credentials before running.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-user-roles.ts
git commit -m "feat: extend backfill to include isActive, firstName, lastName in user metadata"
```

---

### Task 8: Optimize `getSession()` to skip Prisma when metadata is complete

**Files:**
- Modify: `src/lib/auth.ts`

`getSession()` currently always calls `prisma.user.findUnique`. After this task, if all four metadata fields are present and valid, it returns without touching the DB.

- [ ] **Step 1: Write failing test in `tests/integration/auth-session.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('@/lib/supabase-server', () => ({
    createClient: vi.fn(),
}))

import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'

const mockSupabaseUserWithFullMeta = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    user_metadata: {
        role: 'trainer',
        firstName: 'Mario',
        lastName: 'Rossi',
        isActive: true,
    },
}

const mockSupabaseUserWithPartialMeta = {
    id: 'user-uuid-2',
    email: 'legacy@example.com',
    user_metadata: {
        role: 'trainee',
        // missing firstName, lastName, isActive
    },
}

describe('getSession', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns session from metadata without calling Prisma when all fields present', async () => {
        vi.mocked(createClient).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: mockSupabaseUserWithFullMeta },
                    error: null,
                }),
            },
        } as any)

        const session = await getSession()

        expect(session).toEqual({
            user: {
                id: 'user-uuid-1',
                email: 'test@example.com',
                firstName: 'Mario',
                lastName: 'Rossi',
                role: 'trainer',
                isActive: true,
            },
            supabaseUser: mockSupabaseUserWithFullMeta,
        })
        expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns null without calling Prisma when metadata shows isActive=false', async () => {
        vi.mocked(createClient).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: {
                        user: {
                            ...mockSupabaseUserWithFullMeta,
                            user_metadata: { ...mockSupabaseUserWithFullMeta.user_metadata, isActive: false },
                        },
                    },
                    error: null,
                }),
            },
        } as any)

        const session = await getSession()

        expect(session).toBeNull()
        expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('falls back to Prisma when metadata is incomplete', async () => {
        vi.mocked(createClient).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: mockSupabaseUserWithPartialMeta },
                    error: null,
                }),
            },
        } as any)

        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'user-uuid-2',
            email: 'legacy@example.com',
            firstName: 'Legacy',
            lastName: 'User',
            role: 'trainee',
            isActive: true,
        } as any)

        const session = await getSession()

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { email: 'legacy@example.com' },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
            },
        })
        expect(session?.user.firstName).toBe('Legacy')
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npx vitest run tests/integration/auth-session.test.ts
```

Expected: FAIL — `getSession` still calls Prisma in all cases.

- [ ] **Step 3: Update `getSession()` in `src/lib/auth.ts`**

Replace the entire `getSession` function:

```typescript
export const getSession = cache(async (): Promise<AuthSession | null> => {
    const supabase = await createClient()

    const {
        data: { user: supabaseUser },
        error,
    } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
        return null
    }

    // Fast path: all fields in JWT metadata — skip Prisma call
    const meta = supabaseUser.user_metadata
    if (
        meta?.role &&
        meta?.firstName &&
        meta?.lastName &&
        meta?.isActive !== undefined
    ) {
        if (!meta.isActive) return null
        return {
            user: {
                id: supabaseUser.id,
                email: supabaseUser.email!,
                firstName: meta.firstName as string,
                lastName: meta.lastName as string,
                role: meta.role as Role,
                isActive: meta.isActive as boolean,
            },
            supabaseUser,
        }
    }

    // Fallback: legacy users without complete metadata — hit Prisma
    const user = await prisma.user.findUnique({
        where: { email: supabaseUser.email },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
        },
    })

    if (!user || !user.isActive) {
        return null
    }

    return {
        user,
        supabaseUser,
    }
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npx vitest run tests/integration/auth-session.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npm run test:unit
```

Expected: all pass.

- [ ] **Step 6: Verify type-check**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npm run type-check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts tests/integration/auth-session.test.ts
git commit -m "perf: skip Prisma DB call in getSession when JWT metadata is complete"
```

---

## Result after all tasks

| Scenario | Before | After |
|---|---|---|
| Every authenticated request | `getUser()` + `prisma.findUnique` | `getUser()` only (metadata fast path) |
| Legacy users without full metadata | `getUser()` + `prisma.findUnique` | same (fallback path — disappears after backfill) |
| User deactivated | Checked via Prisma | Checked via `meta.isActive` in JWT |
| User name updated | Prisma only, metadata stale | Prisma + metadata sync |
| User activated/deactivated | Prisma only, metadata stale | Prisma + metadata sync |

Per-request DB query eliminated for all users once backfill is complete.

---

## Post-deploy checklist

- [ ] Run extended backfill (`scripts/backfill-user-roles.ts`) against production DB
- [ ] Verify a production login shows no Prisma query in Sentry performance trace
- [ ] Verify deactivating a user blocks their next request (check metadata `isActive=false` propagation)
