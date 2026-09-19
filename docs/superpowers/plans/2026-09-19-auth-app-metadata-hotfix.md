# Fase H — Autorizzazione da `app_metadata` (hotfix di sicurezza) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Questo piano tocca l'autenticazione in produzione e i dati degli utenti su Supabase. Non va eseguito senza l'approvazione esplicita del proprietario del progetto, e il Task 6 (migrazione dei dati) va eseguito da una persona, non da un agente.**

**Goal:** Togliere ogni decisione di autorizzazione dai `user_metadata` di Supabase, che l'utente stesso può modificare con la chiave anon, e spostarla su `app_metadata`, scrivibile solo dalla service role.

**Architecture:** `role`, `isActive` e `mustChangePassword` diventano campi di `app_metadata`, scritti solo da `syncUserMetadata` e dagli altri percorsi che usano il client admin. `firstName` e `lastName` restano in `user_metadata`: sono dati di visualizzazione e non decidono nulla. `getSession()` legge l'autorizzazione da `app_metadata` e, se manca, ricade su Prisma (fonte di verità). Uno script una tantum copia i valori da Prisma in `app_metadata` per gli utenti esistenti, e va eseguito **prima** del deploy.

**Tech Stack:** Supabase Auth (`@supabase/supabase-js`, `@supabase/ssr`), Prisma, Next.js 15 middleware, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-test-quality-design.md` (§1 e §7)

## Global Constraints

- Branch: `hotfix/auth-app-metadata`, creato da **`master`**, secondo lo skill `git-pr-workflow`. Il backport su `development` non è facoltativo.
- Nessuna migrazione del database Prisma: cambia solo dove vivono i dati su Supabase Auth.
- Ordine obbligatorio del rilascio: **1)** script di migrazione dei metadata eseguito su produzione, **2)** push su `master`. Il codice nuovo legge `app_metadata`; se i dati non ci sono ancora, ogni richiesta ricade su Prisma — degrada le prestazioni ma non rompe nulla. Se invece si invertisse l'ordine con un codice senza fallback, gli utenti verrebbero disconnessi.
- Il fallback su Prisma resta nel codice: è la rete di sicurezza per gli utenti creati prima della migrazione.
- La sessione di Supabase porta `app_metadata` dentro il JWT: dopo la migrazione gli utenti già connessi hanno un token senza i campi nuovi finché non si rinnova. Il fallback su Prisma copre anche questo.
- `implementation-docs/CHANGELOG.md` va aggiornata (Task 7).

---

## Perché è un problema

`src/lib/auth.ts:47-58` (in `getSession`) si fida di `supabaseUser.user_metadata` per `role` e `isActive`, e salta del tutto la query su Prisma quando quei campi ci sono. I `user_metadata` sono scrivibili dall'utente autenticato con la sola chiave anon:

```js
await supabase.auth.updateUser({ data: { role: 'admin', isActive: true } })
```

Effetti: un trainee diventa admin; un utente disattivato si riattiva. Stessa origine per `mustChangePassword` (`src/middleware.ts:211`, `src/app/login/page.tsx:72`): l'utente può togliersi il cambio password forzato.

`app_metadata` invece non è scrivibile dal client: solo la service role può modificarlo (`createAdminClient()` in `src/lib/supabase-server.ts:48`).

---

## File Structure

| File | Ruolo | Azione |
|---|---|---|
| `src/lib/sync-user-metadata.ts` | unico punto di scrittura dei metadata | Modificare: separa i campi di autorizzazione (`app_metadata`) da quelli di visualizzazione (`user_metadata`) |
| `src/lib/auth.ts` | `getSession`, `getSessionIncludingInactive` | Modificare: leggere `role`/`isActive` da `app_metadata` |
| `src/middleware.ts:211` | redirect al cambio password | Modificare: leggere `app_metadata.mustChangePassword` |
| `src/app/api/auth/force-change-password/route.ts:63-70` | azzera il flag | Modificare: scrive in `app_metadata` |
| `src/app/api/users/route.ts:212-224` | invito di un nuovo utente | Modificare: `role` anche in `app_metadata` |
| `src/app/login/page.tsx:31,72,79` | scelta della dashboard e redirect | Modificare: leggere `app_metadata` con fallback su `/api/auth/me` |
| `src/app/onboarding/set-password/page.tsx:53,74,131` | stato dell'onboarding | Modificare: leggere `app_metadata` |
| `scripts/migrate-auth-metadata.ts` | migrazione una tantum | Creare (modello: `scripts/backfill-user-roles.ts`) |
| `package.json` | script | Modificare: voce `migrate:auth-metadata` |
| `tests/unit/lib/auth-metadata.test.ts` | test di regressione | Creare |

---

### Task 1: `syncUserMetadata` scrive l'autorizzazione in `app_metadata`

**Files:**
- Modify: `src/lib/sync-user-metadata.ts` (tutto il file: 36 righe)
- Test: `tests/unit/lib/sync-user-metadata.test.ts` (nuovo)

**Interfaces:**
- Consumes: `createAdminClient()` da `@/lib/supabase-server`; `logger` da `@/lib/logger`
- Produces: `syncUserMetadata(userId: string, fields: UserMetadataFields): Promise<void>` — firma invariata, con `UserMetadataFields = { role?: Role; firstName?: string; lastName?: string; isActive?: boolean; mustChangePassword?: boolean }`. I campi `role`, `isActive` e `mustChangePassword` finiscono in `app_metadata`; `firstName` e `lastName` in `user_metadata`.

- [ ] **Step 1: Scrivere i test che falliscono**

Crea `tests/unit/lib/sync-user-metadata.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUserById = vi.fn()
const updateUserById = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
    createAdminClient: () => ({ auth: { admin: { getUserById, updateUserById } } }),
}))

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { syncUserMetadata } from '@/lib/sync-user-metadata'
import { logger } from '@/lib/logger'

describe('syncUserMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getUserById.mockResolvedValue({
            data: { user: { id: 'u-1', app_metadata: { role: 'trainee' }, user_metadata: { firstName: 'Mario' } } },
        })
        updateUserById.mockResolvedValue({ error: null })
    })

    it('writes authorization fields to app_metadata', async () => {
        await syncUserMetadata('u-1', { role: 'trainer', isActive: false })

        expect(updateUserById).toHaveBeenCalledWith('u-1', {
            app_metadata: { role: 'trainer', isActive: false },
        })
    })

    it('writes display fields to user_metadata', async () => {
        await syncUserMetadata('u-1', { firstName: 'Luigi' })

        expect(updateUserById).toHaveBeenCalledWith('u-1', {
            user_metadata: { firstName: 'Mario', firstName: 'Luigi' } as never,
        })
    })

    it('preserves existing metadata that it does not touch', async () => {
        getUserById.mockResolvedValue({
            data: { user: { id: 'u-1', app_metadata: { role: 'trainee', isActive: true }, user_metadata: { locale: 'it' } } },
        })

        await syncUserMetadata('u-1', { isActive: false })

        expect(updateUserById).toHaveBeenCalledWith('u-1', {
            app_metadata: { role: 'trainee', isActive: false },
        })
    })

    it('never writes role or isActive into user_metadata', async () => {
        await syncUserMetadata('u-1', { role: 'admin', isActive: true, firstName: 'Anna' })

        const payload = updateUserById.mock.calls[0][1]
        expect(payload.user_metadata ?? {}).not.toHaveProperty('role')
        expect(payload.user_metadata ?? {}).not.toHaveProperty('isActive')
        expect(payload.app_metadata).toMatchObject({ role: 'admin', isActive: true })
    })

    it('logs a warning and returns when the Supabase user does not exist', async () => {
        getUserById.mockResolvedValue({ data: { user: null } })

        await expect(syncUserMetadata('missing', { isActive: true })).resolves.toBeUndefined()
        expect(updateUserById).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalled()
    })

    it('throws when the update fails', async () => {
        updateUserById.mockResolvedValue({ error: { message: 'boom' } })

        await expect(syncUserMetadata('u-1', { isActive: true })).rejects.toThrow(/boom/)
    })
})
```

Nota: il secondo test contiene di proposito una chiave duplicata nell'esempio; va scritto con l'oggetto atteso corretto, cioè `{ user_metadata: { firstName: 'Luigi' } }` se l'implementazione unisce sui campi passati, oppure `{ user_metadata: { firstName: 'Luigi' } }` con il resto preservato. Decidere allo Step 3 e allineare l'atteso a quello che l'implementazione fa davvero.

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npx vitest run tests/unit/lib/sync-user-metadata.test.ts`
Atteso: FAIL — oggi tutto finisce in `user_metadata`.

- [ ] **Step 3: Implementare**

Sostituisci il corpo di `syncUserMetadata` in `src/lib/sync-user-metadata.ts`:

```ts
export interface UserMetadataFields {
    role?: Role
    firstName?: string
    lastName?: string
    isActive?: boolean
    mustChangePassword?: boolean
}

/**
 * Authorization data lives in app_metadata: the client can write user_metadata
 * with the anon key (supabase.auth.updateUser), so role/isActive/mustChangePassword
 * must never be read from there. Display-only fields stay in user_metadata.
 */
export async function syncUserMetadata(userId: string, fields: UserMetadataFields): Promise<void> {
    const adminClient = createAdminClient()

    const { data: existing } = await adminClient.auth.admin.getUserById(userId)

    if (!existing.user) {
        logger.warn({ userId }, 'syncUserMetadata: user not found in Supabase Auth, skipping metadata sync')
        return
    }

    const { role, isActive, mustChangePassword, firstName, lastName } = fields

    const payload: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } = {}

    if (role !== undefined || isActive !== undefined || mustChangePassword !== undefined) {
        payload.app_metadata = {
            ...(existing.user.app_metadata ?? {}),
            ...(role !== undefined ? { role } : {}),
            ...(isActive !== undefined ? { isActive } : {}),
            ...(mustChangePassword !== undefined ? { mustChangePassword } : {}),
        }
    }

    if (firstName !== undefined || lastName !== undefined) {
        payload.user_metadata = {
            ...(existing.user.user_metadata ?? {}),
            ...(firstName !== undefined ? { firstName } : {}),
            ...(lastName !== undefined ? { lastName } : {}),
        }
    }

    if (Object.keys(payload).length === 0) return

    const { error } = await adminClient.auth.admin.updateUserById(userId, payload)

    if (error) {
        throw new Error(`syncUserMetadata failed for ${userId}: ${error.message}`)
    }
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run tests/unit/lib/sync-user-metadata.test.ts`
Atteso: PASS, 6 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync-user-metadata.ts tests/unit/lib/sync-user-metadata.test.ts
git commit -m "fix(auth): store role/isActive in app_metadata

user_metadata is writable by the authenticated user with the anon key,
so it cannot carry authorization data. Display names stay where they
are."
```

---

### Task 2: `getSession` legge l'autorizzazione da `app_metadata`

**Files:**
- Modify: `src/lib/auth.ts` (`getSession` righe 33-90, `getSessionIncludingInactive` righe 97-155)
- Test: `tests/unit/lib/auth-metadata.test.ts` (nuovo)

**Interfaces:**
- Consumes: `createClient()` da `@/lib/supabase-server`; `prisma.user.findUnique`
- Produces: `getSession()` e `getSessionIncludingInactive()` invariate nella firma; `role` e `isActive` presi da `app_metadata`, `firstName`/`lastName` da `user_metadata`, con ricorso a Prisma quando l'autorizzazione non è nei metadata.

- [ ] **Step 1: Scrivere i test che falliscono**

Crea `tests/unit/lib/auth-metadata.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>()
    return { ...actual, cache: (fn: unknown) => fn }
})

const getUser = vi.fn()
vi.mock('@/lib/supabase-server', () => ({ createClient: async () => ({ auth: { getUser } }) }))

import { getSession } from '@/lib/auth'
import { prismaMock } from '../../helpers/prisma-mock'

const supabaseUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-uuid-1',
    email: 'user@zerocento.it',
    app_metadata: {},
    user_metadata: {},
    ...overrides,
})

describe('getSession authorization source', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reads role and isActive from app_metadata', async () => {
        getUser.mockResolvedValue({
            data: {
                user: supabaseUser({
                    app_metadata: { role: 'trainer', isActive: true },
                    user_metadata: { firstName: 'Marco', lastName: 'Trainer' },
                }),
            },
            error: null,
        })

        const session = await getSession()

        expect(session?.user.role).toBe('trainer')
        expect(session?.user.firstName).toBe('Marco')
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('ignores role injected into user_metadata', async () => {
        getUser.mockResolvedValue({
            data: {
                user: supabaseUser({
                    app_metadata: { role: 'trainee', isActive: true },
                    user_metadata: { role: 'admin', isActive: true, firstName: 'Mario', lastName: 'Atleta' },
                }),
            },
            error: null,
        })

        const session = await getSession()

        expect(session?.user.role).toBe('trainee')
    })

    it('falls back to Prisma when app_metadata has no authorization data', async () => {
        getUser.mockResolvedValue({
            data: { user: supabaseUser({ user_metadata: { role: 'admin', firstName: 'X', lastName: 'Y' } }) },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'user-uuid-1',
            email: 'user@zerocento.it',
            firstName: 'Mario',
            lastName: 'Atleta',
            role: 'trainee',
            isActive: true,
        } as never)

        const session = await getSession()

        expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: { email: 'user@zerocento.it' },
            select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
        })
        expect(session?.user.role).toBe('trainee')
    })

    it('returns null for an inactive user from app_metadata', async () => {
        getUser.mockResolvedValue({
            data: {
                user: supabaseUser({
                    app_metadata: { role: 'trainee', isActive: false },
                    user_metadata: { firstName: 'Mario', lastName: 'Atleta' },
                }),
            },
            error: null,
        })

        await expect(getSession()).resolves.toBeNull()
    })

    it('ignores isActive injected into user_metadata for a deactivated user', async () => {
        getUser.mockResolvedValue({
            data: {
                user: supabaseUser({
                    app_metadata: { role: 'trainee', isActive: false },
                    user_metadata: { isActive: true, firstName: 'Mario', lastName: 'Atleta' },
                }),
            },
            error: null,
        })

        await expect(getSession()).resolves.toBeNull()
    })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npx vitest run tests/unit/lib/auth-metadata.test.ts`
Atteso: FAIL — `ignores role injected into user_metadata` restituisce `admin`.

- [ ] **Step 3: Implementare**

In `src/lib/auth.ts`, dentro `getSession`, sostituisci il blocco che oggi legge `const meta = supabaseUser.user_metadata` e il suo `if`:

```ts
    // Authorization comes from app_metadata (service-role only). Display names
    // may still live in user_metadata: they decide nothing.
    const appMeta = supabaseUser.app_metadata as { role?: Role; isActive?: boolean } | undefined
    const displayMeta = supabaseUser.user_metadata as { firstName?: string; lastName?: string } | undefined

    if (appMeta?.role && appMeta.isActive !== undefined && displayMeta?.firstName && displayMeta?.lastName) {
        if (!appMeta.isActive) return null
        return {
            user: {
                id: supabaseUser.id,
                email: supabaseUser.email!,
                firstName: displayMeta.firstName,
                lastName: displayMeta.lastName,
                role: appMeta.role,
                isActive: appMeta.isActive,
            },
            supabaseUser,
        }
    }
```

Il resto della funzione (ricorso a Prisma, controllo `!user || !user.isActive`) resta invariato.

In `getSessionIncludingInactive` la stessa sostituzione, con l'unica differenza già presente: non c'è il `return null` per l'utente non attivo.

- [ ] **Step 4: Eseguire i test**

Run: `npx vitest run tests/unit/lib/auth-metadata.test.ts && npx vitest run tests/integration/auth-session.test.ts`
Atteso: il primo PASS (5 test); il secondo probabilmente FAIL, perché le sue fixture mettono i dati in `user_metadata`.

- [ ] **Step 5: Aggiornare `auth-session.test.ts`**

Nelle fixture di quel file (`mockSupabaseUserWithFullMeta` e simili), spostare `role` e `isActive` da `user_metadata` a `app_metadata`, lasciando `firstName`/`lastName` dove sono. Aggiungere un test: con `user_metadata.role = 'admin'` e `app_metadata.role = 'trainee'`, la sessione è trainee.

Run: `npx vitest run tests/integration/auth-session.test.ts`
Atteso: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts tests/unit/lib/auth-metadata.test.ts tests/integration/auth-session.test.ts
git commit -m "fix(auth): read role and isActive from app_metadata

A user could grant themselves admin by writing user_metadata with the
anon key. Authorization now comes from app_metadata, with the Prisma
fallback kept for users not yet migrated."
```

---

### Task 3: `mustChangePassword` da `app_metadata`

**Files:**
- Modify: `src/middleware.ts:211`
- Modify: `src/app/api/auth/force-change-password/route.ts:62-70`
- Modify: `src/app/login/page.tsx:72`
- Test: `tests/unit/middleware-must-change-password.test.ts` (nuovo)

**Interfaces:**
- Consumes: l'utente Supabase restituito da `supabase.auth.getUser()` nel middleware
- Produces: il flag letto e scritto solo in `app_metadata`

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `tests/unit/middleware-must-change-password.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUser = vi.fn()

vi.mock('@supabase/ssr', () => ({
    createServerClient: () => ({ auth: { getUser } }),
}))

import { middleware } from '@/middleware'

const request = (path: string) => new NextRequest(`http://localhost${path}`)

describe('middleware: forced password change', () => {
    beforeEach(() => vi.clearAllMocks())

    it('redirects when app_metadata.mustChangePassword is true', async () => {
        getUser.mockResolvedValue({
            data: { user: { id: 'u-1', app_metadata: { mustChangePassword: true }, user_metadata: {} } },
        })

        const response = await middleware(request('/trainer/dashboard'))

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toContain('/force-change-password')
    })

    it('ignores mustChangePassword injected into user_metadata', async () => {
        getUser.mockResolvedValue({
            data: { user: { id: 'u-1', app_metadata: {}, user_metadata: { mustChangePassword: true } } },
        })

        const response = await middleware(request('/trainer/dashboard'))

        expect(response.headers.get('location')).toBeNull()
    })

    it('does not redirect a user without the flag', async () => {
        getUser.mockResolvedValue({ data: { user: { id: 'u-1', app_metadata: {}, user_metadata: {} } } })

        const response = await middleware(request('/trainer/dashboard'))

        expect(response.headers.get('location')).toBeNull()
    })
})
```

Prima di scrivere il test, verificare come il middleware costruisce il client: `grep -n "createServerClient\|@supabase/ssr" src/middleware.ts`. Il `vi.mock` deve corrispondere al modulo importato davvero, e il rate limiting va neutralizzato se interferisce (`grep -n "Ratelimit\|upstash" src/middleware.ts`).

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run tests/unit/middleware-must-change-password.test.ts`
Atteso: FAIL sul secondo test — oggi il flag iniettato in `user_metadata` provoca il redirect.

- [ ] **Step 3: Implementare**

`src/middleware.ts:211`:

```ts
        const mustChangePassword = (user.app_metadata as { mustChangePassword?: boolean } | undefined)?.mustChangePassword
```

`src/app/api/auth/force-change-password/route.ts`, al posto del blocco `user_metadata` (righe 62-70):

```ts
        // Clear the flag in app_metadata (service-role only).
        const { error: metadataError } = await adminClient.auth.admin.updateUserById(session.user.id, {
            app_metadata: {
                ...(userData.user?.app_metadata ?? {}),
                mustChangePassword: false,
            },
        })
```

`src/app/login/page.tsx:72`:

```ts
                const mustChangePassword = (data.user.app_metadata as { mustChangePassword?: boolean } | undefined)?.mustChangePassword
```

- [ ] **Step 4: Eseguire i test**

Run: `npx vitest run tests/unit/middleware-must-change-password.test.ts && npm run test:unit -- --run`
Atteso: PASS in entrambi.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/app/api/auth/force-change-password/route.ts src/app/login/page.tsx tests/unit/middleware-must-change-password.test.ts
git commit -m "fix(auth): read mustChangePassword from app_metadata

The flag was user-writable, so anyone could skip the forced password
change."
```

---

### Task 4: Ruolo in `app_metadata` all'invito e nelle pagine client

**Files:**
- Modify: `src/app/api/users/route.ts:212-224` (invito)
- Modify: `src/app/login/page.tsx:31,79`
- Modify: `src/app/onboarding/set-password/page.tsx:53,74,131`
- Test: `tests/integration/users.test.ts` (test dell'invito già presente)

**Interfaces:**
- Consumes: `supabase.auth.admin.inviteUserByEmail`, `syncUserMetadata` (Task 1)
- Produces: un utente invitato ha `app_metadata.role` e `app_metadata.isActive: false` già dal primo accesso

- [ ] **Step 1: Ruolo anche in `app_metadata` all'invito**

`inviteUserByEmail` scrive solo `user_metadata` (parametro `data`). Il ruolo va quindi replicato subito dopo, con il client admin. In `src/app/api/users/route.ts`, dopo `syncUserMetadata(user.id, { isActive: false })` (riga 242), sostituire quella riga con:

```ts
        await syncUserMetadata(user.id, { role, isActive: false })
```

`syncUserMetadata` scrive `role` e `isActive` in `app_metadata` (Task 1), mentre `firstName`, `lastName` e `locale` restano nel `data` dell'invito.

- [ ] **Step 2: Aggiornare il test dell'invito**

In `tests/integration/users.test.ts`, il test che verifica l'invito controlla ora anche la chiamata:

```ts
expect(vi.mocked(syncUserMetadata)).toHaveBeenCalledWith(newUserId, { role: 'trainee', isActive: false })
```

Se il file non mocka `@/lib/sync-user-metadata`, aggiungere `vi.mock('@/lib/sync-user-metadata')` in cima con gli altri mock.

- [ ] **Step 3: Aggiornare le letture lato client**

`src/app/login/page.tsx`, righe 31 e 79 — entrambe diventano:

```ts
                    let role = (user.app_metadata as { role?: string } | undefined)?.role
```

(alla riga 79 la variabile è `data.user`). Il fallback su `/api/auth/me` resta: serve agli utenti non ancora migrati.

`src/app/onboarding/set-password/page.tsx`:
- righe 53 e 74: `const isOnboardingComplete = (data.user?.app_metadata as { isActive?: boolean } | undefined)?.isActive === true` (alla riga 74 la variabile è `user`);
- riga 131: `const role = (userData.app_metadata as { role?: string } | undefined)?.role`. Se `role` è `undefined`, ricadere su `/api/auth/me` come fa la pagina di login, invece di costruire un URL `/undefined/dashboard`:

```ts
            let role = (userData.app_metadata as { role?: string } | undefined)?.role
            if (!role) {
                const response = await fetch('/api/auth/me', { credentials: 'include' })
                if (response.ok) role = (await response.json()).data.role
            }
            if (!role) throw new Error(t('auth:setPassword.errorGeneric'))
            router.push(`/${role}/dashboard`)
```

Le righe 192-195 (`firstName` da `user_metadata`) restano invariate: è un dato di visualizzazione.

- [ ] **Step 4: Verificare**

Run: `npm run test:unit -- --run && npm run type-check && npm run build`
Atteso: tutti e tre con exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/users/route.ts src/app/login/page.tsx src/app/onboarding/set-password/page.tsx tests/integration/users.test.ts
git commit -m "fix(auth): set invited user role in app_metadata and read it there"
```

---

### Task 5: Script di migrazione una tantum

**Files:**
- Create: `scripts/migrate-auth-metadata.ts` (modello: `scripts/backfill-user-roles.ts`)
- Modify: `package.json` (script `migrate:auth-metadata`)

**Interfaces:**
- Consumes: `DIRECT_URL`/`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Produces: per ogni utente Prisma, `app_metadata` con `role` e `isActive` allineati al database; `mustChangePassword` copiato da `user_metadata` se presente

- [ ] **Step 1: Scrivere lo script**

Crea `scripts/migrate-auth-metadata.ts`:

```ts
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

config()

const DRY_RUN = process.argv.includes('--dry-run')

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
        select: { id: true, email: true, role: true, isActive: true },
    })

    console.log(`${users.length} users found${DRY_RUN ? ' (dry run)' : ''}`)

    let ok = 0
    let failed = 0
    let missing = 0

    for (const user of users) {
        const { data: existing } = await supabase.auth.admin.getUserById(user.id)

        if (!existing.user) {
            console.warn(`SKIP  ${user.email}: not found in Supabase Auth`)
            missing++
            continue
        }

        const appMeta = existing.user.app_metadata ?? {}
        const userMeta = existing.user.user_metadata ?? {}

        const next = {
            ...appMeta,
            role: user.role,
            isActive: user.isActive,
            ...(userMeta.mustChangePassword !== undefined
                ? { mustChangePassword: userMeta.mustChangePassword }
                : {}),
        }

        if (DRY_RUN) {
            console.log(`DRY   ${user.email} → ${JSON.stringify(next)}`)
            ok++
            continue
        }

        const { error } = await supabase.auth.admin.updateUserById(user.id, { app_metadata: next })

        if (error) {
            console.error(`FAIL  ${user.email}: ${error.message}`)
            failed++
        } else {
            console.log(`OK    ${user.email} → role=${user.role} isActive=${user.isActive}`)
            ok++
        }
    }

    console.log(`\nDone: ${ok} ok, ${failed} failed, ${missing} missing`)
    if (failed > 0) process.exitCode = 1
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
```

Lo script **non** cancella i vecchi campi da `user_metadata`: il codice nuovo non li legge più, e lasciarli permette di tornare indietro. Vanno ripuliti in un passaggio successivo, quando il rilascio è consolidato.

- [ ] **Step 2: Aggiungere lo script in `package.json`**

Accanto alle voci `seed:*` esistenti:

```json
        "migrate:auth-metadata": "tsx scripts/migrate-auth-metadata.ts",
```

- [ ] **Step 3: Provare a vuoto sull'ambiente di sviluppo**

Run: `npm run migrate:auth-metadata -- --dry-run`
Atteso: una riga `DRY` per ogni utente, con `role` e `isActive` uguali a quelli di Prisma. Nessuna scrittura.

- [ ] **Step 4: Eseguire davvero sull'ambiente di sviluppo**

Run: `npm run migrate:auth-metadata`
Atteso: `Done: N ok, 0 failed`. Poi verifica manuale: login con un utente trainer, redirect alla dashboard corretta.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-auth-metadata.ts package.json
git commit -m "chore(auth): add one-off app_metadata migration script"
```

---

### Task 6: Verifica manuale e rilascio (esecuzione umana)

**Files:** nessuno

**Interfaces:**
- Consumes: tutti i task precedenti
- Produces: `master` aggiornato, `development` allineato

- [ ] **Step 1: Prova di attacco su ambiente di sviluppo**

Dalla console del browser, con un utente trainee connesso:

```js
await window.supabase?.auth.updateUser({ data: { role: 'admin', isActive: true } })
```

(oppure una chiamata equivalente con la chiave anon). Poi ricaricare e provare ad aprire `/admin/users`.
Atteso: accesso negato. Prima del hotfix, l'utente sarebbe entrato.

- [ ] **Step 2: Prove di regressione manuali**

- login trainer, trainee e admin → dashboard corretta;
- utente con `mustChangePassword` → redirect a `/force-change-password`, cambio password, nuovo login senza redirect;
- invito di un nuovo utente → onboarding completo e primo accesso;
- disattivazione di un utente da admin → l'utente disattivato non riesce ad accedere.

- [ ] **Step 3: Rilascio, nell'ordine**

```bash
# 1. migrazione dei metadata su PRODUZIONE (con le env di produzione)
npm run migrate:auth-metadata -- --dry-run
npm run migrate:auth-metadata

# 2. solo dopo: deploy del codice
git checkout master
git pull --ff-only
git merge --ff-only hotfix/auth-app-metadata
git push origin master
git fetch --tags && git describe --tags --abbrev=0
git tag vX.Y.Z && git push origin vX.Y.Z

# 3. backport obbligatorio
git checkout development
git pull --ff-only
git merge --ff-only hotfix/auth-app-metadata
git push origin development
```

Il numero di versione è una patch rispetto all'ultimo tag esistente.

- [ ] **Step 4: Verifica dopo il rilascio**

Login in produzione con un utente per ruolo; controllo dei log Sentry per errori di autenticazione nei 30 minuti successivi.

---

### Task 7: CHANGELOG

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Scrivere la voce**

```markdown
## 2026-09-19 — Hotfix sicurezza: autorizzazione da app_metadata

**Perché:** `getSession()` leggeva `role` e `isActive` dai `user_metadata` di Supabase, che
l'utente autenticato può modificare con la chiave anon (`supabase.auth.updateUser`). Un
trainee poteva assegnarsi il ruolo admin e un utente disattivato poteva riattivarsi. Lo
stesso valeva per `mustChangePassword`.

- `src/lib/sync-user-metadata.ts`: `role`, `isActive` e `mustChangePassword` scritti in
  `app_metadata` (solo service role); `firstName`/`lastName` restano in `user_metadata`
- `src/lib/auth.ts`: autorizzazione letta da `app_metadata`, con fallback su Prisma
- `src/middleware.ts`, `src/app/api/auth/force-change-password/route.ts`,
  `src/app/login/page.tsx`, `src/app/onboarding/set-password/page.tsx`: allineati
- `src/app/api/users/route.ts`: il ruolo dell'utente invitato finisce in `app_metadata`
- `scripts/migrate-auth-metadata.ts`: migrazione una tantum, **da eseguire prima del deploy**
- Test di regressione: un `role` iniettato in `user_metadata` non ha effetto
```

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog for app_metadata auth hotfix"
```

---

## Verifica finale della fase

- [ ] `grep -rn "user_metadata" src/ | grep -viE "firstName|lastName|locale"` → nessuna riga che decida autorizzazioni
- [ ] Test di regressione verdi: ruolo e `isActive` iniettati in `user_metadata` non hanno effetto
- [ ] `npm run test:unit -- --run --coverage`, `npm run lint`, `npm run type-check`, `npm run build` → exit code 0
- [ ] Migrazione eseguita in produzione **prima** del push su `master`
- [ ] Hotfix backportato su `development`
- [ ] Tag creato su `master`
