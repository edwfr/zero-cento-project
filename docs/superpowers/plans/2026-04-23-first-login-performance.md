# First Login Performance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate redundant Supabase Auth network calls and a full page re-render that together cause slow first login on Vercel.

**Architecture:** Two targeted changes — (1) cache `getSession()` at the React request level so multiple server components in the same render tree share a single `getUser()` + Prisma call, (2) rewrite the login submit handler to read `role` from the JWT `user_metadata` (already stored there at invite time) instead of making a round-trip to `/api/auth/me`, and remove the `router.refresh()` call that triggers a redundant full server re-render.

**Tech Stack:** Next.js 15 App Router, React `cache()`, Supabase SSR, `@supabase/ssr`

---

## Root cause summary

After pressing "Accedi", the current flow makes **7 Supabase Auth network calls** and **3 Prisma DB queries**:

| Step | Supabase RTTs | DB queries |
|---|---|---|
| `signInWithPassword()` | 1 | 0 |
| `fetch('/api/auth/me')` → middleware + route handler | 2 | 1 |
| `router.push('/dashboard')` → middleware + server component | 2 | 1 |
| `router.refresh()` → middleware + server component | 2 | 1 |
| **Total** | **7** | **3** |

After this plan: **3 Supabase RTTs, 1 DB query** (57% reduction in network calls).

---

## Files modified

- Modify: `src/lib/auth.ts` — wrap `getSession()` with React `cache()`
- Modify: `src/app/login/page.tsx` — read role from `user_metadata`, remove `router.refresh()`

---

### Task 1: Cache `getSession()` per request

**Files:**
- Modify: `src/lib/auth.ts`

`cache()` from React deduplicates calls within the same server render tree. When a layout and a page both call `getSession()`, it executes only once per request.

- [ ] **Step 1: Add React `cache()` import to `src/lib/auth.ts`**

At the top of `src/lib/auth.ts`, add the import after the existing imports:

```typescript
import { cache } from 'react'
```

- [ ] **Step 2: Wrap `getSession` with `cache()`**

Replace the current `getSession` export in `src/lib/auth.ts`:

```typescript
// Before:
export async function getSession(): Promise<AuthSession | null> {
    const supabase = await createClient()
    // ...
}

// After:
export const getSession = cache(async (): Promise<AuthSession | null> => {
    const supabase = await createClient()

    const {
        data: { user: supabaseUser },
        error,
    } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
        return null
    }

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

    if (!user) {
        return null
    }

    if (!user.isActive) {
        return null
    }

    return {
        user,
        supabaseUser,
    }
})
```

- [ ] **Step 3: Verify type-check passes**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts
git commit -m "perf: cache getSession per request to deduplicate Supabase + Prisma calls"
```

---

### Task 2: Eliminate `/api/auth/me` fetch and `router.refresh()` from login

**Files:**
- Modify: `src/app/login/page.tsx`

`role` is already written to Supabase `user_metadata` at invite time (`src/app/api/users/route.ts:129`). After `signInWithPassword()` the session contains it. No extra fetch needed. `router.refresh()` after `router.push()` triggers a full redundant server re-render — the push already navigates to a fresh server render.

- [ ] **Step 1: Rewrite `handleSubmit` in `src/app/login/page.tsx`**

Replace the entire `handleSubmit` function (lines 53–98) with:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
        const supabase = createClient()
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (signInError) throw signInError

        if (data.session) {
            const mustChangePassword = data.user.user_metadata?.mustChangePassword

            if (mustChangePassword) {
                router.push('/force-change-password')
                return
            }

            const role = data.user.user_metadata?.role as string | undefined

            if (!role) {
                throw new Error('User role not found')
            }

            router.push(`/${role}/dashboard`)
        }
    } catch (err: any) {
        setError(err.message || t('auth:login.error'))
    } finally {
        setLoading(false)
    }
}
```

Key changes:
- `role` read from `data.user.user_metadata.role` (already in JWT — zero extra network call)
- Removed `fetch('/api/auth/me')` (was: middleware RTT + route handler RTT + Prisma query)
- Removed `router.refresh()` (was: middleware RTT + server component RTT + Prisma query)

- [ ] **Step 2: Also fix the existing-session check in `useEffect`**

The `useEffect` at lines 22–51 also calls `fetch('/api/auth/me')`. Replace the entire effect body with:

```typescript
useEffect(() => {
    const checkSession = async () => {
        try {
            const supabase = createClient()
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (user) {
                const role = user.user_metadata?.role as string | undefined
                if (role) {
                    router.push(`/${role}/dashboard`)
                    return
                }
            }
        } catch {
            // Ignore errors, just show login form
        } finally {
            setChecking(false)
        }
    }

    checkSession()
}, [router])
```

- [ ] **Step 3: Verify type-check passes**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Run unit tests**

```bash
cd /mnt/c/dev-projects/zero-cento-project && npm run test:unit
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "perf: read role from JWT user_metadata on login, remove redundant router.refresh()"
```

---

## Result after both tasks

| Step | Before | After |
|---|---|---|
| `signInWithPassword()` | 1 Supabase RTT | 1 Supabase RTT |
| Role fetch | 2 Supabase RTTs + 1 DB query | **0** (read from JWT) |
| `router.push()` dashboard render | 2 Supabase RTTs + 1 DB query | 2 Supabase RTTs + 1 DB query |
| `router.refresh()` | 2 Supabase RTTs + 1 DB query | **0** (removed) |
| **Total** | **7 RTTs + 3 DB queries** | **3 RTTs + 1 DB query** |
