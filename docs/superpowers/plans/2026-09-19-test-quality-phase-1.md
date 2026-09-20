# Test Quality — Fase 1 (mock condivisi e pulizia dei test) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire i 29 mock di Prisma scritti a mano nei test di integrazione con un mock unico tipizzato, eliminare i circa 190 `as any` e i `require()` dai test, e trasformare le asserzioni deboli (`toHaveBeenCalled()`, `toBeTruthy()`) in asserzioni sugli argomenti.

**Architecture:** Tre helper nuovi sotto `tests/helpers/`: `prisma-mock.ts` (istanza `mockDeep<PrismaClient>()` agganciata una volta sola in `tests/unit/setup.ts`), `sessions.ts` (le sessioni finte, oggi in `tests/integration/fixtures.ts`, con un `supabaseUser` tipizzato) e `auth-mock.ts` (scorciatoie sopra l'automock di `@/lib/auth`). I file di test vengono poi migrati un dominio alla volta, con la suite verde a ogni commit. Nessuna modifica al codice di produzione.

**Tech Stack:** Vitest 4.1.4, `vitest-mock-extended` 5.1.1 (peer `vitest >=4`), Prisma Client, TypeScript, ESLint 9 flat config con `@typescript-eslint` già installato.

**Spec:** `docs/superpowers/specs/2026-09-19-test-quality-design.md` (§5 Fase 1)

## Global Constraints

- Prerequisito: **Fase 0 completata e integrata in `development`** (suite verde, coverage su tutto `src/`, soglie per glob). Verifica: `git log --oneline development | grep "measure coverage over all of src"`.
- Branch: `chore/test-quality-mocks`, creato da `development`. Integrazione con merge fast-forward, secondo lo skill `git-pr-workflow`.
- **La coverage non deve scendere in nessun commit.** Questa fase non aggiunge test: cambia solo come sono scritti. Il numero di test prima e dopo ogni migrazione deve essere identico.
- Il comportamento dei test non cambia: stessi nomi, stesse asserzioni di sostanza. Se una migrazione fa emergere un test che passava per il motivo sbagliato, **fermarsi e segnalarlo** invece di riscriverlo di nascosto.
- Regole dello skill `zero-cento-testing`: import ESM statici, `vi.mock` prima degli import del modulo sotto test, fixtures condivise, mai ri-dichiarare i mock del setup.
- I 31 file in `tests/integration/` (30 test + `fixtures.ts`) e i 46 in `tests/unit/` sono l'intero perimetro. Nessun file di `src/` viene toccato.
- `implementation-docs/CHANGELOG.md` va aggiornata: una voce alla fine della fase (Task 8).

---

## File Structure

| File | Ruolo | Azione |
|---|---|---|
| `tests/helpers/prisma-mock.ts` | istanza condivisa `DeepMockProxy<PrismaClient>` + reset + `$transaction` | Creare |
| `tests/helpers/sessions.ts` | sessioni finte tipizzate (trainer, admin, trainee, factory) | Creare (contenuto spostato da `tests/integration/fixtures.ts`) |
| `tests/helpers/auth-mock.ts` | scorciatoie `asTrainer`/`asAdmin`/`asTrainee`/`asUnauthenticated`/`asForbidden` | Creare |
| `tests/integration/fixtures.ts` | punto di import storico | Modificare: re-export da `../helpers/sessions`; eliminare alla fine della fase |
| `tests/unit/setup.ts` | setup globale | Modificare: il mock di `@/lib/prisma` scritto a mano diventa `prismaMock` |
| `tests/integration/*.test.ts` (30 file) | test delle route API | Modificare: mock condiviso, niente `as any`, `toHaveBeenCalledWith` |
| `tests/unit/trainer-trainee-programs-tab.test.tsx`, `tests/unit/trainer-trainee-detail-sbd-report.test.tsx` | test unitari con `require('react')` | Modificare |
| `tests/unit/lib/trainee-program-data.test.ts` | 23 `as any` | Modificare: fixture tipizzate |
| `eslint.config.mjs` | configurazione lint | Modificare: blocco per `tests/**` |
| `package.json` | script e dipendenze | Modificare: `vitest-mock-extended`, `lint` esteso a `tests/` |
| `.claude/skills/zero-cento-testing/SKILL.md` | regole dei test | Modificare: sezione Integration Tests |

---

### Task 1: Helper del mock Prisma

**Files:**
- Create: `tests/helpers/prisma-mock.ts`
- Modify: `tests/unit/setup.ts` (blocco `vi.mock('@/lib/prisma', …)`, righe 58-84)
- Modify: `package.json` (devDependencies)
- Test: `tests/unit/helpers/prisma-mock.test.ts` (nuovo)

**Interfaces:**
- Consumes: niente
- Produces:
  - `prismaMock: DeepMockProxy<PrismaClient>` — l'istanza che `@/lib/prisma` restituisce in tutti i test
  - `resetPrismaMock(): void` — azzera le chiamate e reinstalla `$transaction`
  - Il modulo `@/lib/prisma` esporta `prisma === prismaMock` in ogni file di test

- [ ] **Step 1: Installare la dipendenza**

Run: `npm i -D vitest-mock-extended@^5.1.1`
Atteso: installazione senza errori di peer dependency (richiede `vitest >=4`, il progetto ha 4.1.4).

- [ ] **Step 2: Scrivere il test che fallisce**

Crea `tests/unit/helpers/prisma-mock.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { prisma } from '@/lib/prisma'
import { prismaMock } from '../../helpers/prisma-mock'

describe('prisma mock helper', () => {
    it('is the instance returned by @/lib/prisma', () => {
        expect(prisma).toBe(prismaMock)
    })

    it('resolves any model call that the test configures', async () => {
        prismaMock.exercise.findMany.mockResolvedValue([{ id: 'ex-1' }] as never)
        await expect(prisma.exercise.findMany()).resolves.toEqual([{ id: 'ex-1' }])
    })

    it('runs $transaction callbacks against the same mock', async () => {
        prismaMock.exercise.create.mockResolvedValue({ id: 'ex-2' } as never)
        const result = await prisma.$transaction(async (tx) => tx.exercise.create({ data: {} as never }))
        expect(result).toEqual({ id: 'ex-2' })
    })

    it('resolves $transaction arrays', async () => {
        prismaMock.exercise.count.mockResolvedValue(3 as never)
        await expect(prisma.$transaction([prisma.exercise.count()])).resolves.toEqual([3])
    })

    it('starts each test without leftover calls', () => {
        expect(prismaMock.exercise.findMany).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 3: Eseguire il test e verificare che fallisca**

Run: `npx vitest run tests/unit/helpers/prisma-mock.test.ts`
Atteso: FAIL con `Cannot find module '../../helpers/prisma-mock'`.

- [ ] **Step 4: Creare l'helper**

Crea `tests/helpers/prisma-mock.ts`:

```ts
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

export const prismaMock: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>()

/**
 * $transaction has two shapes in Prisma:
 *   - interactive: $transaction(async (tx) => ...)  -> run the callback against the same mock
 *   - batch:       $transaction([p1, p2])           -> resolve the array in order
 */
function installTransaction(): void {
    prismaMock.$transaction.mockImplementation(((arg: unknown) => {
        if (typeof arg === 'function') {
            return (arg as (tx: DeepMockProxy<PrismaClient>) => unknown)(prismaMock)
        }
        return Promise.all(arg as Promise<unknown>[])
    }) as never)
}

installTransaction()

/** Clears every recorded call and re-installs $transaction (mockReset wipes it). */
export function resetPrismaMock(): void {
    mockReset(prismaMock)
    installTransaction()
}
```

- [ ] **Step 5: Agganciare l'helper nel setup globale**

In `tests/unit/setup.ts` sostituisci l'intero blocco `vi.mock('@/lib/prisma', () => ({ prisma: { … } }))` (righe 58-84) con:

```ts
// Shared, fully typed Prisma mock (tests/helpers/prisma-mock.ts).
// The factory is async so the helper module is loaded after vi.mock hoisting.
vi.mock('@/lib/prisma', async () => {
    const { prismaMock } = await import('../helpers/prisma-mock')
    return { prisma: prismaMock }
})

beforeEach(async () => {
    const { resetPrismaMock } = await import('../helpers/prisma-mock')
    resetPrismaMock()
})
```

`beforeEach` è già importato da `vitest` nella Fase 0; se non lo fosse, aggiungerlo alla riga 2.

- [ ] **Step 6: Eseguire il test e verificare che passi**

Run: `npx vitest run tests/unit/helpers/prisma-mock.test.ts`
Atteso: PASS, 5 test.

- [ ] **Step 7: Verificare che la suite regga il cambio di setup**

Run: `npm run test:unit -- --run`
Atteso: stesso numero di test verdi della Fase 0.

I file di integrazione che dichiarano un `vi.mock('@/lib/prisma', …)` locale continuano a funzionare: il mock locale vince su quello del setup. È voluto, e sparisce con i task di migrazione.

Se qualche test unitario fallisce perché si aspettava i `vi.fn()` del vecchio setup (per esempio chiamando `prisma.user.findMany` senza configurarlo), configurarlo esplicitamente con `prismaMock.user.findMany.mockResolvedValue([])` nel test: annotare i file toccati nel messaggio di commit.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tests/helpers/prisma-mock.ts tests/unit/helpers/prisma-mock.test.ts tests/unit/setup.ts
git commit -m "test(helpers): add shared typed Prisma mock

mockDeep<PrismaClient> from vitest-mock-extended, wired once in the
global setup and reset before each test. Replaces the hand-written
mock object that had to be kept in sync with the schema by hand."
```

---

### Task 2: Sessioni tipizzate e helper dell'auth

**Files:**
- Create: `tests/helpers/sessions.ts`
- Create: `tests/helpers/auth-mock.ts`
- Modify: `tests/integration/fixtures.ts` (diventa un re-export)
- Test: `tests/unit/helpers/auth-mock.test.ts` (nuovo)

**Interfaces:**
- Consumes: `AuthSession` da `@/lib/auth`; `requireAuth`, `requireRole`, `requireTrainerOwnership`, `requireTrainerProgramOwnership`, `getSession` da `@/lib/auth`
- Produces:
  - `makeSupabaseUser(overrides?): User` (tipo `@supabase/supabase-js`)
  - `mockTrainerSession`, `mockAdminSession`, `mockTraineeSession`: `AuthSession`
  - `makeTrainerSession(overrides?)`, `makeAdminSession(overrides?)`, `makeTraineeSession(overrides?)`: `AuthSession`
  - `asTrainer(session?)`, `asAdmin(session?)`, `asTrainee(session?)`: impostano il valore risolto su `requireAuth`, `requireRole`, `getSession` e, per il trainer, anche su `requireTrainerOwnership` e `requireTrainerProgramOwnership`
  - `asUnauthenticated()`, `asForbidden()`: impostano il rifiuto con la risposta di `apiError`

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `tests/unit/helpers/auth-mock.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth')

import { requireRole, requireAuth } from '@/lib/auth'
import { asTrainer, asAdmin, asUnauthenticated } from '../../helpers/auth-mock'
import { mockTrainerSession, makeTrainerSession, makeSupabaseUser } from '../../helpers/sessions'

describe('auth mock helpers', () => {
    it('makeSupabaseUser returns a user with the id and email of the session', () => {
        const user = makeSupabaseUser({ id: 'u-1', email: 'a@b.it' })
        expect(user.id).toBe('u-1')
        expect(user.email).toBe('a@b.it')
        expect(user.app_metadata).toBeDefined()
    })

    it('asTrainer makes requireRole resolve with the trainer session', async () => {
        asTrainer()
        await expect(requireRole('trainer')).resolves.toEqual(mockTrainerSession)
        await expect(requireAuth()).resolves.toEqual(mockTrainerSession)
    })

    it('asTrainer accepts a custom session', async () => {
        const session = makeTrainerSession({ id: 'trainer-9' })
        asTrainer(session)
        await expect(requireRole('trainer')).resolves.toEqual(session)
    })

    it('asAdmin makes requireRole resolve with the admin session', async () => {
        asAdmin()
        const session = await requireRole('admin')
        expect(session.user.role).toBe('admin')
    })

    it('asUnauthenticated makes requireAuth reject with a 401 response', async () => {
        asUnauthenticated()
        await expect(requireAuth()).rejects.toSatisfy((thrown: Response) => thrown.status === 401)
    })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run tests/unit/helpers/auth-mock.test.ts`
Atteso: FAIL con `Cannot find module '../../helpers/auth-mock'`.

- [ ] **Step 3: Creare `tests/helpers/sessions.ts`**

```ts
import type { User } from '@supabase/supabase-js'
import type { AuthSession } from '@/lib/auth'

/** Minimal Supabase user: enough shape for handlers that only read id/email. */
export function makeSupabaseUser(overrides: Partial<User> = {}): User {
    return {
        id: 'supabase-uuid-1',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'user@zerocento.it',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-01-01T00:00:00.000Z',
        ...overrides,
    } as User
}

function makeSession(user: AuthSession['user']): AuthSession {
    return { user, supabaseUser: makeSupabaseUser({ id: user.id, email: user.email }) }
}

export const mockTrainerSession: AuthSession = makeSession({
    id: 'trainer-uuid-1',
    email: 'trainer@zerocento.it',
    firstName: 'Marco',
    lastName: 'Trainer',
    role: 'trainer',
    isActive: true,
})

export const mockAdminSession: AuthSession = makeSession({
    id: 'admin-uuid-1',
    email: 'admin@zerocento.it',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    isActive: true,
})

export const mockTraineeSession: AuthSession = makeSession({
    id: 'trainee-uuid-1',
    email: 'trainee@zerocento.it',
    firstName: 'Mario',
    lastName: 'Atleta',
    role: 'trainee',
    isActive: true,
})

export const makeTrainerSession = (overrides: Partial<AuthSession['user']> = {}): AuthSession =>
    makeSession({ ...mockTrainerSession.user, ...overrides })

export const makeAdminSession = (overrides: Partial<AuthSession['user']> = {}): AuthSession =>
    makeSession({ ...mockAdminSession.user, ...overrides })

export const makeTraineeSession = (overrides: Partial<AuthSession['user']> = {}): AuthSession =>
    makeSession({ ...mockTraineeSession.user, ...overrides })
```

Verifica preliminare: `grep -n "export interface AuthSession" -A6 src/lib/auth.ts`. I campi di `user` nell'helper devono corrispondere a quel tipo; se `AuthSession` non è esportato, esportarlo è l'unica modifica ammessa al codice di produzione in questa fase.

- [ ] **Step 4: Creare `tests/helpers/auth-mock.ts`**

```ts
import { vi } from 'vitest'
import {
    requireAuth,
    requireRole,
    requireTrainerOwnership,
    requireTrainerProgramOwnership,
    getSession,
    type AuthSession,
} from '@/lib/auth'
import { apiError } from '@/lib/api-response'
import { mockTrainerSession, mockAdminSession, mockTraineeSession } from './sessions'

/**
 * These helpers assume the test file called vi.mock('@/lib/auth') (automock).
 * They only configure return values; they never install the mock themselves,
 * because vi.mock is hoisted per test file.
 */
function resolveAll(session: AuthSession, withOwnership: boolean): AuthSession {
    vi.mocked(requireAuth).mockResolvedValue(session)
    vi.mocked(requireRole).mockResolvedValue(session)
    vi.mocked(getSession).mockResolvedValue(session)
    if (withOwnership) {
        vi.mocked(requireTrainerOwnership).mockResolvedValue(session)
        vi.mocked(requireTrainerProgramOwnership).mockResolvedValue(session)
    }
    return session
}

export const asTrainer = (session: AuthSession = mockTrainerSession) => resolveAll(session, true)
export const asAdmin = (session: AuthSession = mockAdminSession) => resolveAll(session, false)
export const asTrainee = (session: AuthSession = mockTraineeSession) => resolveAll(session, false)

/** Every guard rejects with the 401 response apiError builds. */
export function asUnauthenticated(): void {
    const rejection = apiError('UNAUTHORIZED', 'Authentication required', 401)
    for (const guard of [requireAuth, requireRole, requireTrainerOwnership, requireTrainerProgramOwnership]) {
        vi.mocked(guard).mockRejectedValue(rejection)
    }
    vi.mocked(getSession).mockResolvedValue(null)
}

/** Role or ownership guards reject with 403; requireAuth still resolves. */
export function asForbidden(session: AuthSession = mockTraineeSession): void {
    const rejection = apiError('FORBIDDEN', 'Access denied', 403)
    vi.mocked(requireAuth).mockResolvedValue(session)
    vi.mocked(getSession).mockResolvedValue(session)
    for (const guard of [requireRole, requireTrainerOwnership, requireTrainerProgramOwnership]) {
        vi.mocked(guard).mockRejectedValue(rejection)
    }
}
```

Nota su `apiError`: restituisce una `NextResponse`, quindi `rejects.toSatisfy(r => r.status === 401)` è la forma di asserzione corretta. Verificare con `grep -n "export function apiError" -A12 src/lib/api-response.ts` e adattare se il tipo restituito è diverso.

- [ ] **Step 5: Trasformare `tests/integration/fixtures.ts` in un re-export**

```ts
/**
 * @deprecated Import from tests/helpers/sessions instead.
 * Kept during the phase-1 migration so untouched test files keep working;
 * deleted in the last task of the phase.
 */
export {
    mockTrainerSession,
    mockAdminSession,
    mockTraineeSession,
    makeTrainerSession,
    makeAdminSession,
    makeTraineeSession,
    makeSupabaseUser,
} from '../helpers/sessions'
```

- [ ] **Step 6: Eseguire i test**

Run: `npx vitest run tests/unit/helpers/ && npm run test:unit -- --run`
Atteso: gli helper passano (5 test) e la suite completa resta verde.

Attenzione: i file di integrazione oggi fanno `vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn(), requireRole: vi.fn(), getSession: vi.fn() }))`, cioè una fabbrica **parziale**. Finché non sono migrati, continuano a funzionare così.

- [ ] **Step 7: Commit**

```bash
git add tests/helpers/sessions.ts tests/helpers/auth-mock.ts tests/integration/fixtures.ts tests/unit/helpers/auth-mock.test.ts
git commit -m "test(helpers): typed sessions and auth mock shortcuts

Sessions move to tests/helpers with a real Supabase user shape instead
of 'as any'. asTrainer/asAdmin/asTrainee/asUnauthenticated/asForbidden
configure the automocked guards."
```

---

### Task 3: Ricetta di migrazione applicata al primo dominio (exercises)

Questo task fissa la ricetta su un file solo. I task 4-6 la ripetono sugli altri, a blocchi.

**Files:**
- Modify: `tests/integration/exercises.test.ts` (1041 righe: mock alle righe 12-48, import alle righe 53-58, uso di `prisma` e `requireRole` in tutto il file)

**Interfaces:**
- Consumes: `prismaMock` (Task 1); `asTrainer`, `asAdmin`, `asTrainee`, `asUnauthenticated`, `asForbidden` (Task 2); `mockTrainerSession` e le factory da `../helpers/sessions`
- Produces: la ricetta di migrazione applicata nei task 4-6

- [ ] **Step 1: Registrare il punto di partenza**

Run: `npx vitest run tests/integration/exercises.test.ts`
Atteso: PASS. Annotare il numero di test: alla fine del task deve essere identico.

- [ ] **Step 2: Sostituire il blocco dei mock**

Togli `vi.mock('@/lib/prisma', () => ({ … }))` (righe 18-38) e sostituisci `vi.mock('@/lib/auth', () => ({ … }))` (righe 12-16) con l'automock:

```ts
vi.mock('@/lib/auth')
```

Il `vi.mock('@/lib/logger', …)` resta com'è.

Aggiungi agli import, dopo quelli dei route handler:

```ts
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asTrainee, asUnauthenticated, asForbidden } from '../helpers/auth-mock'
import { mockTrainerSession, mockAdminSession, mockTraineeSession } from '../helpers/sessions'
```

e togli l'import di `prisma` da `@/lib/prisma` e quello di `requireRole` da `@/lib/auth`, se dopo i passi seguenti non servono più.

- [ ] **Step 3: Sostituire le configurazioni dei mock nel corpo dei test**

Trasformazioni meccaniche, da applicare in tutto il file:

| Prima | Dopo |
|---|---|
| `(prisma.exercise.findMany as any).mockResolvedValue(x)` | `prismaMock.exercise.findMany.mockResolvedValue(x as never)` |
| `(prisma.exercise.create as any).mockRejectedValue(e)` | `prismaMock.exercise.create.mockRejectedValue(e)` |
| `(requireRole as any).mockResolvedValue(mockTrainerSession)` | `asTrainer()` |
| `(requireRole as any).mockResolvedValue(mockAdminSession)` | `asAdmin()` |
| `(requireRole as any).mockResolvedValue(mockTraineeSession)` | `asTrainee()` |
| `(requireRole as any).mockRejectedValue(apiError('UNAUTHORIZED', …, 401))` | `asUnauthenticated()` |
| `(requireRole as any).mockRejectedValue(apiError('FORBIDDEN', …, 403))` | `asForbidden()` |
| `expect(prisma.exercise.findMany).toHaveBeenCalled()` | `expect(prismaMock.exercise.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: … }))` |
| `expect(body.data).toBeTruthy()` | `expect(body.data).toMatchObject({ … })` |

`as never` sui valori risolti serve perché i tipi di ritorno di Prisma dipendono da `select`/`include` e i dati finti sono parziali: è l'unico uso ammesso e va concentrato lì.

Per ogni `toHaveBeenCalledWith` nuovo, gli argomenti attesi si ricavano leggendo il route handler, non indovinando. Esempio, per il filtro del tipo esercizio in `src/app/api/exercises/route.ts`:

```ts
expect(prismaMock.exercise.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
        where: expect.objectContaining({ type: 'postural', isActive: true }),
    }),
)
```

- [ ] **Step 4: Eseguire il file di test**

Run: `npx vitest run tests/integration/exercises.test.ts`
Atteso: PASS, **stesso numero di test** dello Step 1.

Se un test ora fallisce su `toHaveBeenCalledWith`, l'argomento atteso è sbagliato: leggere il route handler e correggere l'attesa. Se fallisce perché il mock non restituisce nulla, manca un `mockResolvedValue` che prima arrivava dal mock globale del setup.

- [ ] **Step 5: Controllare che non siano rimasti residui**

Run: `grep -nE "as any|toHaveBeenCalled\(\)|toBeTruthy\(\)" tests/integration/exercises.test.ts`
Atteso: nessuna riga, oppure solo righe con un commento che spiega perché restano.

- [ ] **Step 6: Commit**

```bash
git add tests/integration/exercises.test.ts
git commit -m "test(exercises): migrate to shared Prisma and auth mocks

First domain migrated: typed prismaMock, asTrainer/asAdmin helpers and
toHaveBeenCalledWith on the Prisma calls. Same tests, same count."
```

---

### Task 4: Migrare i domini programs e workouts

**Files:**
- Modify: `tests/integration/programs.test.ts` (954), `programs-clone.test.ts` (367), `program-detail.test.ts` (263), `program-progress.test.ts` (247), `program-test-results.test.ts` (249), `copy-week.test.ts` (343), `delete-workout.test.ts` (140), `skeleton.test.ts` (201), `planned-training-sets-report.test.ts` (302)

**Interfaces:**
- Consumes: gli helper del Task 1 e 2; la ricetta del Task 3
- Produces: niente di nuovo

- [ ] **Step 1: Registrare il punto di partenza**

Run: `npx vitest run tests/integration/programs.test.ts tests/integration/programs-clone.test.ts tests/integration/program-detail.test.ts tests/integration/program-progress.test.ts tests/integration/program-test-results.test.ts tests/integration/copy-week.test.ts tests/integration/delete-workout.test.ts tests/integration/skeleton.test.ts tests/integration/planned-training-sets-report.test.ts`
Atteso: PASS. Annotare il totale dei test.

- [ ] **Step 2: Migrare un file alla volta**

Per ciascun file, nell'ordine dell'elenco, applicare **gli stessi passi 2-5 del Task 3**: togliere `vi.mock('@/lib/prisma', …)`, sostituire il mock dell'auth con `vi.mock('@/lib/auth')`, aggiungere gli import degli helper, applicare la tabella delle trasformazioni, controllare i residui con il `grep`.

Particolarità note:
- `skeleton.test.ts` usa `requireTrainerProgramOwnership` (righe 6 e 31): con `asTrainer()` la guardia risolve, con `asForbidden()` rifiuta con 403. Il rifiuto con messaggio specifico alla riga 191 va mantenuto: `vi.mocked(requireTrainerProgramOwnership).mockRejectedValue(apiError('FORBIDDEN', '<stesso messaggio>', 403))`.
- `copy-week.test.ts` e `programs-clone.test.ts` usano `$transaction`: l'helper esegue il callback contro `prismaMock`, quindi le chiamate dentro la transazione si configurano e si verificano sullo stesso oggetto (`prismaMock.week.create` ecc.), senza più il client finto passato a mano.
- Dove i test costruiscono un client di transazione a parte, quel blocco sparisce.

- [ ] **Step 3: Eseguire i test dopo ogni file**

Run: `npx vitest run tests/integration/<file>.test.ts`
Atteso: PASS, stesso numero di test di prima.

- [ ] **Step 4: Eseguire tutto il blocco**

Run: lo stesso comando dello Step 1.
Atteso: PASS, totale identico a quello annotato.

- [ ] **Step 5: Commit (uno per file)**

```bash
git add tests/integration/<file>.test.ts
git commit -m "test(<dominio>): migrate to shared Prisma and auth mocks"
```

---

### Task 5: Migrare i domini users, trainee e feedback

**Files:**
- Modify: `tests/integration/users.test.ts` (382), `users-delete.test.ts` (185), `rbac.test.ts` (504), `auth-session.test.ts` (134), `rate-limit-read.test.ts` (129), `trainee-active-program.test.ts` (67), `trainee-workout-detail.test.ts` (185), `trainee-workout-prev-week.test.ts` (148), `trainee-workout-submit.test.ts` (371), `trainer-trainee-notes.test.ts` (175), `feedback.test.ts` (349), `personal-records.test.ts` (710)

**Interfaces:**
- Consumes: gli helper del Task 1 e 2; la ricetta del Task 3
- Produces: niente di nuovo

- [ ] **Step 1: Registrare il punto di partenza**

Run: `npx vitest run tests/integration/users.test.ts tests/integration/users-delete.test.ts tests/integration/rbac.test.ts tests/integration/auth-session.test.ts tests/integration/rate-limit-read.test.ts tests/integration/trainee-active-program.test.ts tests/integration/trainee-workout-detail.test.ts tests/integration/trainee-workout-prev-week.test.ts tests/integration/trainee-workout-submit.test.ts tests/integration/trainer-trainee-notes.test.ts tests/integration/feedback.test.ts tests/integration/personal-records.test.ts`
Atteso: PASS. Annotare il totale.

- [ ] **Step 2: Migrare un file alla volta, con queste eccezioni**

Applicare i passi 2-5 del Task 3, tranne:

- **`auth-session.test.ts`**: qui `@/lib/auth` **non** va automockato, perché il file testa `getSession` per davvero. Si migra solo la parte Prisma (`prismaMock.user.findUnique`) e si toglie il `vi.mock('@/lib/prisma', …)` locale. Il mock di `@/lib/supabase-server` resta. Aggiungere in cima un commento: questo file testa l'implementazione vera dell'auth, non i route handler.
- **`rbac.test.ts`**: resta un test di collegamento. Le sessioni specifiche del file (`mockTrainerASession`, `mockTraineeBSession`, …) passano alle factory: `makeTrainerSession({ id: 'trainer-a-uuid', email: 'trainer.a@zerocento.it', firstName: 'Trainer', lastName: 'A' })`. Le asserzioni diventano `expect(vi.mocked(requireRole)).toHaveBeenCalledWith('trainer')` e simili. Aggiungere in cima il commento: la logica delle guardie è testata in `tests/unit/lib/auth.test.ts` (Fase 2).
- **`rate-limit-read.test.ts`**: verificare prima cosa mocka (`grep -n "vi.mock" tests/integration/rate-limit-read.test.ts`); se non usa Prisma, il task si limita a `as any` e asserzioni.
- **`personal-records.test.ts`** (710 righe, 38 `as any`): è il file più grande, va fatto per ultimo e committato da solo.

- [ ] **Step 3: Eseguire i test dopo ogni file**

Run: `npx vitest run tests/integration/<file>.test.ts`
Atteso: PASS, stesso numero di test.

- [ ] **Step 4: Eseguire tutto il blocco**

Run: lo stesso comando dello Step 1.
Atteso: PASS, totale identico.

- [ ] **Step 5: Commit (uno per file)**

```bash
git add tests/integration/<file>.test.ts
git commit -m "test(<dominio>): migrate to shared Prisma and auth mocks"
```

---

### Task 6: Migrare i file rimanenti ed eliminare `fixtures.ts`

**Files:**
- Modify: `tests/integration/api-contracts.test.ts` (486), `admin-reports.test.ts` (110), `reference-data.test.ts` (260), `workout-exercise-complete.test.ts` (298), `workout-exercise-delete.test.ts` (171), `workout-exercise-feedback.test.ts` (247), `workout-exercise-rpe.test.ts` (132), `workout-exercises-bulk.test.ts` (286)
- Delete: `tests/integration/fixtures.ts`

**Interfaces:**
- Consumes: gli helper del Task 1 e 2
- Produces: nessun import di `./fixtures` residuo

- [ ] **Step 1: Migrare gli otto file**

Stessi passi del Task 3. `api-contracts.test.ts` è quello che ci guadagna di più: il suo blocco di mock (righe 41-60 circa, tutti i modelli elencati a mano) sparisce del tutto.

- [ ] **Step 2: Eliminare il file di compatibilità**

Run: `grep -rn "from './fixtures'" tests/`
Atteso: nessun risultato. Poi: `git rm tests/integration/fixtures.ts`.

- [ ] **Step 3: Eseguire tutta la suite**

Run: `npm run test:unit -- --run --coverage`
Atteso: exit code 0, soglie rispettate, totale dei test uguale a quello di inizio fase.

- [ ] **Step 4: Verificare che i residui siano spariti**

Run:
```bash
grep -rn "vi.mock('@/lib/prisma'" tests/ | grep -v helpers
grep -rc "as any" tests/ | awk -F: '$2>0'
grep -rn "toHaveBeenCalled()" tests/integration/
```
Atteso: prima riga vuota; seconda vuota o con soli file commentati; terza vuota.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/
git commit -m "test(integration): finish mock migration and drop fixtures.ts

All integration files now use tests/helpers. The compatibility
re-export is gone."
```

---

### Task 7: Pulizia dei test unitari e regole di lint

**Files:**
- Modify: `tests/unit/trainer-trainee-programs-tab.test.tsx` (righe 9, 26, 33), `tests/unit/trainer-trainee-detail-sbd-report.test.tsx` (righe 5, 22)
- Modify: `tests/unit/lib/trainee-program-data.test.ts` (23 `as any`)
- Modify: `tests/unit/setup.ts` (riga 21, `require('react')` nel mock di `next/link`)
- Modify: `eslint.config.mjs`
- Modify: `package.json` (script `lint`)

**Interfaces:**
- Consumes: niente
- Produces: `npm run lint` che copre anche `tests/`

- [ ] **Step 1: Togliere `require('react')`**

Nei mock che oggi fanno `const React = require('react')`, si usa `React.createElement` senza `require`, importando React in cima al file di test (`import React from 'react'`) — la fabbrica di `vi.mock` può usare una variabile del modulo solo se l'import non è soggetto all'hoisting problematico; in caso di errore `Cannot access 'React' before initialization`, la forma corretta è la fabbrica asincrona:

```ts
vi.mock('next/link', async () => {
    const React = await import('react')
    return {
        default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
            React.createElement('a', { href, ...props }, children),
    }
})
```

In alternativa, se il mock rende solo elementi semplici, si scrive JSX direttamente nel file `.tsx`:

```tsx
vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
        <a href={href} {...props}>{children}</a>
    ),
}))
```

`tests/unit/setup.ts` è un `.ts`, non `.tsx`: lì si usa la fabbrica asincrona.

- [ ] **Step 2: Eseguire i test toccati**

Run: `npx vitest run tests/unit/trainer-trainee-programs-tab.test.tsx tests/unit/trainer-trainee-detail-sbd-report.test.tsx && npm run test:unit -- --run`
Atteso: PASS in entrambi i comandi (il secondo copre il cambio in `setup.ts`).

- [ ] **Step 3: Tipizzare le fixture di `trainee-program-data.test.ts`**

Sostituire i valori `as any` con una factory tipizzata sul tipo di input della funzione sotto test. Ricavare il tipo con `grep -n "export function\|export const" src/lib/trainee-program-data.ts` e usarlo:

```ts
import type { TraineeProgramInput } from '@/lib/trainee-program-data'

const makeProgram = (overrides: Partial<TraineeProgramInput> = {}): TraineeProgramInput => ({
    // campi obbligatori con valori minimi, presi dal tipo reale
    ...overrides,
})
```

Se il tipo non è esportato, esportarlo è ammesso: è una modifica di sola tipizzazione.

- [ ] **Step 4: Estendere il lint ai test**

In `package.json`: `"lint": "eslint src/ tests/"`.

In `eslint.config.mjs`, dopo il blocco esistente:

```js
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='require']",
          message: "Use static ESM imports in tests (see zero-cento-testing skill).",
        },
      ],
    },
  },
```

- [ ] **Step 5: Eseguire il lint**

Run: `npm run lint`
Atteso: exit code 0. Se restano `any` legittimi (per esempio `as never` non basta su un tipo Prisma), si eccettuano riga per riga con `// eslint-disable-next-line @typescript-eslint/no-explicit-any` più il motivo, mai disattivando la regola per l'intero file.

- [ ] **Step 6: Commit**

```bash
git add tests/ eslint.config.mjs package.json
git commit -m "test(unit): drop require(), type fixtures, lint the test folder

ESLint now runs on tests/ with no-explicit-any and a ban on require()."
```

---

### Task 8: Aggiornare la skill e la CHANGELOG

**Files:**
- Modify: `.claude/skills/zero-cento-testing/SKILL.md` (sezioni "Integration Tests" → "Mock placement", "Shared session fixtures"; sezione "What to test in integration tests")
- Modify: `implementation-docs/CHANGELOG.md`

**Interfaces:**
- Consumes: gli helper creati nei Task 1-2
- Produces: regole aggiornate per le fasi 2 e 3

- [ ] **Step 1: Riscrivere la sezione "Mock placement"**

```markdown
### Mocks

Prisma is mocked once, globally, in `tests/unit/setup.ts` with a typed
`mockDeep<PrismaClient>()`. Import the instance and configure it per test:

```typescript
import { prismaMock } from '../helpers/prisma-mock'

prismaMock.exercise.findMany.mockResolvedValue([exercise] as never)
expect(prismaMock.exercise.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ name: 'Squat' }) }),
)
```

Never re-declare `vi.mock('@/lib/prisma', ...)` in a test file.

Auth guards are automocked per file and configured through helpers:

```typescript
vi.mock('@/lib/auth')

import { asTrainer, asAdmin, asUnauthenticated, asForbidden } from '../helpers/auth-mock'
```

`asTrainer()` also resolves `requireTrainerOwnership` and
`requireTrainerProgramOwnership`. Sessions come from `tests/helpers/sessions.ts`
(`mockTrainerSession`, `makeTrainerSession({ id })`, …).
```

La sezione "Shared session fixtures" cambia il percorso: `tests/helpers/sessions.ts`, non `tests/integration/fixtures.ts`.

- [ ] **Step 2: Aggiungere le regole sulle asserzioni**

In fondo a "What to test in integration tests":

```markdown
Assertion rules:
- Every Prisma write (create/update/delete/upsert/updateMany) must be asserted with
  `toHaveBeenCalledWith`, not bare `toHaveBeenCalled()`. Use `expect.objectContaining`
  for long `select`/`include` blocks.
- No `toBeTruthy()` / `toBeDefined()` on a response body: assert its shape with
  `toEqual` or `toMatchObject`.
- No `as any` in tests. Partial Prisma return values use `as never` on the
  `mockResolvedValue` argument, which is the single accepted escape hatch.
```

- [ ] **Step 3: Aggiungere la voce in CHANGELOG**

```markdown
## 2026-09-19 — Test quality, fase 1: mock condivisi e pulizia dei test

**Perché:** 29 file di integrazione ridichiaravano a mano il mock di Prisma e circa 190
`as any` impedivano ai tipi di segnalare mock divergenti dallo schema.

- `tests/helpers/prisma-mock.ts`: `mockDeep<PrismaClient>()` agganciato nel setup globale,
  con `$transaction` nelle due forme (callback e array)
- `tests/helpers/sessions.ts` e `tests/helpers/auth-mock.ts`: sessioni tipizzate e
  scorciatoie `asTrainer`/`asAdmin`/`asTrainee`/`asUnauthenticated`/`asForbidden`
- 30 file di integrazione migrati; `tests/integration/fixtures.ts` eliminato
- `require()` e `as any` rimossi dai test unitari; ESLint ora copre `tests/`
- `.claude/skills/zero-cento-testing/SKILL.md`: nuove regole su mock e asserzioni
```

- [ ] **Step 4: Verifica finale della fase**

Run: `npm run test:unit -- --run --coverage && npm run lint && npm run type-check`
Atteso: tutti e tre con exit code 0, e coverage non inferiore a quella di inizio fase.

- [ ] **Step 5: Commit e integrazione**

```bash
git add .claude/skills/zero-cento-testing/SKILL.md implementation-docs/CHANGELOG.md
git commit -m "docs(tests): document shared mocks and assertion rules"

git checkout development
git pull --ff-only
git merge --ff-only chore/test-quality-mocks
git push origin development
```

---

## Verifica finale della fase

- [ ] `grep -rn "vi.mock('@/lib/prisma'" tests/ | grep -v helpers` → vuoto
- [ ] `grep -rc "as any" tests/ | awk -F: '$2>0'` → vuoto o solo eccezioni commentate
- [ ] `grep -rn "toHaveBeenCalled()" tests/integration/` → vuoto
- [ ] `grep -rn "require(" tests/` → vuoto
- [ ] Numero di test identico a inizio fase
- [ ] Coverage uguale o superiore a inizio fase
- [ ] `npm run lint` verde su `src/` e `tests/`
