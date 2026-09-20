# Test Quality — Fase 2 (test diretti di `auth.ts` e `middleware.ts`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare `src/lib/auth.ts` ad almeno il 95% e `src/middleware.ts` ad almeno l'80% con test diretti che esercitano il codice vero invece di mockarlo, e rendere la suite indipendente dal fuso orario correggendo il bug di `getTodayForInput`.

**Architecture:** Quattro blocchi indipendenti. (1) Il fuso: `TZ=UTC` fisso per la suite, test con timer finti e correzione di `getTodayForInput`, che oggi restituisce la data UTC e sbaglia giorno la sera in Italia. (2) `auth.ts`: un file di test che mocka solo il confine — `@/lib/supabase-server` e `prismaMock` — con `cache` di React reso passthrough, come già fa `auth-session.test.ts`. (3) `middleware.ts`: i test sparsi in due file vengono riuniti in `tests/unit/middleware.test.ts`, che copre route pubbliche, passthrough API, redirect, cambio password forzato e rate limiting nelle due varianti. (4) `rbac.test.ts` resta test di collegamento e asserisce che ogni route chiami la guardia giusta con gli argomenti giusti.

**Tech Stack:** Vitest 4.1.4 (jsdom, pool forks, `maxWorkers: 4`), `vitest-mock-extended`, Next.js 15 (`NextRequest`/`NextResponse`), `@supabase/ssr`, `@upstash/redis/cloudflare`, Prisma Client.

**Spec:** `docs/superpowers/specs/2026-09-19-test-quality-design.md` (§6 Fase 2)

## Stato: COMPLETATA il 2026-09-20

Eseguita sul branch `chore/test-quality-auth` (8 commit, `b1966bc`..`7c7db34`), **non ancora integrata in
`development`**: push e merge restano da fare.

| Obiettivo | Atteso | Raggiunto |
|---|---|---|
| `src/lib/auth.ts` | ≥ 95% righe | **100% righe / 100% rami** |
| `src/middleware.ts` | ≥ 80% righe | **90.7% righe / 92.2% rami** |
| `src/lib/date-format.ts` | — | 97.2% righe / 94.9% rami |
| Soglia `src/lib/**` | alzata | 67/67/65/62 → 76/75/75/73 |
| Soglia globale | alzata | 36/36/28/33 → 38/37/30/35 |

Tutti e sei i task sono chiusi. Note di esecuzione:

- Task 1: bug `getTodayForInput` corretto (usava il giorno UTC), suite a `TZ=UTC` fisso.
- Fuori piano, nel Task 2: riparato `tests/integration/auth-session.test.ts`, che il merge della Fase 1 con
  l'hotfix `app_metadata` aveva lasciato rotto (1 test rosso, 1 errore di type-check, 2 di lint su `development`).
- Task 4: il test del matcher asserisce sottostringhe della regex; per `ico`, `xml` e `js` passerebbe comunque.
  Minore, non bloccante.
- Segnalazione non corretta: `/force-change-password` è già in `PUBLIC_ROUTES`, quindi la guardia
  `mustChangePassword` a `src/middleware.ts:210` non viene mai raggiunta per quel percorso letterale.

---

## Global Constraints

- **Prerequisito Fase H: già soddisfatto.** L'hotfix dei metadata è in `master` (commit `35be6c9`, `a62108a`, `ddfb062`, `917f111`, `642dce8`): `src/lib/auth.ts:21-29` legge `role`/`isActive` **solo** da `app_metadata`, `src/lib/sync-user-metadata.ts:40-47` li scrive lì, `src/middleware.ts:211-213` legge `mustChangePassword` da `app_metadata`. I test di questa fase si scrivono su questo comportamento, e il caso di regressione (`user_metadata.role` manipolato) è obbligatorio.
- Branch: `chore/test-quality-auth`, creato dal branch della Fase 1 (`chore/test-quality`, non ancora integrato in `development`). Integrazione con merge fast-forward secondo lo skill `git-pr-workflow`: niente Pull Request.
- **Una sola modifica al codice di produzione è ammessa in tutta la fase**, ed è il Task 1: `getTodayForInput` in `src/lib/date-format.ts:181-183`. Va fatta in TDD (test rosso prima) e vive in un commit suo. Qualunque altro bug trovato si annota e si riporta, non si corregge qui.
- Regole dello skill `zero-cento-testing`, come riscritto in Fase 1: `prismaMock` da `tests/helpers/prisma-mock.ts` (mai ri-dichiarare `vi.mock('@/lib/prisma')`), sessioni da `tests/helpers/sessions.ts`. **In questa fase `@/lib/auth` NON va mockato**: è il modulo sotto test.
- **Zero `as any` e zero `require()`**: ESLint fallisce (`npm run lint` gira su `src/` e `tests/`). L'unico varco è `as never` sull'argomento di `mockResolvedValue`.
- `apiError` restituisce una `Response`: le guardie **lanciano** quella risposta. L'asserzione corretta è `await expect(fn()).rejects.toSatisfy((r: Response) => r.status === 403)`, e il corpo si legge con `await (thrown as Response).json()`.
- Comandi: file singolo `npx vitest run <percorso>`; suite `npm run test:unit -- --run`; coverage `npm run test:unit -- --run --coverage`. Il repo sta su `/mnt/c` sotto WSL: la suite completa con coverage impiega 8–10 minuti, il singolo file circa 25 secondi.
- `implementation-docs/CHANGELOG.md` va aggiornata una volta sola, nel Task 6.
- `.claude/skills/zero-cento-testing/SKILL.md` **non è tracciato da git** (`.claude/` è in `.gitignore`): si modifica lo stesso, ma non entra in nessun commit.

## Baseline misurata (2026-09-20, dopo la Fase 1, 874 test verdi)

| File | Lines | Branches | Functions | Righe scoperte | Rami scoperti |
|---|---|---|---|---|---|
| `src/lib/auth.ts` | 22.8 | 31.8 | 11.1 | 44 | 30 |
| `src/middleware.ts` | 49.3 | 57.8 | 57.1 | 38 | 27 |
| `src/lib/date-format.ts` | 92.6 | 74.7 | 100 | 5 | 25 |

Gruppo `src/lib/**`: L68.4 / S68.4 / F68.9 / B63.2, soglia in `vitest.config.ts` a 67/67/65/62. `src/middleware.ts` non appartiene a nessun glob con soglia: conta solo nel totale globale (oggi 36/36/28/33).

## Comando di misura (si usa alla fine dei task 3, 4 e 6)

```bash
npx vitest run <file di test> --coverage --coverage.include='<file sorgente>' --coverage.reporter=text
```

Per il gruppo, alla fine della fase:

```bash
npm run test:unit -- --run --coverage > /tmp/cov.log 2>&1; echo "exit=$?"
node -e "
const s=require('./coverage/coverage-summary.json');
const root=process.cwd().replace(/\\\\/g,'/')+'/';
const rows=Object.entries(s).filter(([k])=>k!=='total'&&k.replace(root,'').startsWith('src/lib/'));
const out=Object.fromEntries(['lines','statements','functions','branches'].map(m=>{
  const c=rows.reduce((a,[,v])=>a+v[m].covered,0), t=rows.reduce((a,[,v])=>a+v[m].total,0);
  return [m, Math.floor(100*c/t)];
}));
console.log('src/lib/', JSON.stringify(out));
console.log('total', JSON.stringify(Object.fromEntries(['lines','statements','functions','branches'].map(m=>[m,Math.floor(s.total[m].pct)]))));
"
```

I valori stampati (già arrotondati per difetto) sono quelli da scrivere in `vitest.config.ts`. **Mai un valore più basso di quello già presente.**

---

## File Structure

| File | Ruolo | Azione |
|---|---|---|
| `vitest.config.ts` | configurazione Vitest e soglie | Modificare: `TZ=UTC`, soglie `src/lib/**` e globale |
| `tests/unit/date-format.test.ts` | formattazione date | Modificare: timer finti, caso del fuso, rami null/data non valida |
| `src/lib/date-format.ts` | utilità sulle date | Modificare: `getTodayForInput` usa la data **locale** (unica modifica a `src/` della fase) |
| `tests/unit/lib/auth.test.ts` | test diretti delle guardie | Creare |
| `tests/unit/middleware.test.ts` | test del middleware | Creare (assorbe `middleware-must-change-password.test.ts`) |
| `tests/unit/middleware-must-change-password.test.ts` | test del cambio password forzato | Eliminare dopo lo spostamento (`git mv`) |
| `tests/integration/rate-limit-read.test.ts` | rate limiting sulle letture | Lasciare com'è; il Task 4 non duplica i suoi casi |
| `tests/integration/rbac.test.ts` | collegamento route → guardia | Modificare: asserzioni `toHaveBeenCalledWith` sulle guardie |
| `.claude/skills/zero-cento-testing/SKILL.md` | regole dei test | Modificare (non tracciato da git) |
| `implementation-docs/CHANGELOG.md` | registro | Modificare: voce di fine fase |

---

### Task 1: Fuso orario deterministico e bug di `getTodayForInput`

`src/lib/date-format.ts:181-183` è:

```ts
export function getTodayForInput(): string {
    return new Date().toISOString().split('T')[0]
}
```

`toISOString()` restituisce la data **UTC**: alle 23:30 del 10 marzo a Roma (22:30 UTC) la funzione dice `2026-03-10`, mentre il calendario locale dell'utente dice già `2026-03-11` alle 00:30. Il campo data di un massimale creato a tarda sera nasce quindi con il giorno sbagliato. La correzione è la costruzione locale della data.

**Files:**
- Modify: `vitest.config.ts` (fuso della suite)
- Modify: `tests/unit/date-format.test.ts`
- Modify: `src/lib/date-format.ts:181-183`

**Interfaces:**
- Consumes: niente
- Produces: `getTodayForInput(): string` restituisce la data **locale** in formato `YYYY-MM-DD`; la suite gira con `TZ=UTC` salvo dove un test lo sovrascrive

- [ ] **Step 1: Rendere deterministico il fuso della suite**

In cima a `vitest.config.ts`, prima di `export default`:

```ts
// The suite must not depend on the machine's timezone: CI runs UTC, local
// machines do not. Tests that care about a timezone set it themselves with
// vi.stubEnv('TZ', ...) plus vi.useFakeTimers().
process.env.TZ = 'UTC'
```

Il pool `forks` eredita l'ambiente del processo principale, quindi questo basta: non serve `cross-env` né modificare lo script `test:unit` in `package.json`.

- [ ] **Step 2: Verificare che il fuso sia davvero quello**

Run: `npx vitest run tests/unit/date-format.test.ts` e, nel file, aggiungi temporaneamente:

```ts
it('runs with a fixed timezone', () => {
    expect(new Date().getTimezoneOffset()).toBe(0)
})
```

Atteso: PASS. Se fallisce, il fuso non è stato applicato ai worker: in quel caso spostare l'impostazione in `test.env` di `vitest.config.ts` (`env: { TZ: 'UTC' }`) e ripetere. Questo test va tolto prima del commit: serve solo a verificare lo Step 1.

- [ ] **Step 3: Scrivere il test che fallisce**

In `tests/unit/date-format.test.ts`:

```ts
describe('getTodayForInput', () => {
    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllEnvs()
    })

    it('returns the local calendar day, not the UTC one', () => {
        vi.stubEnv('TZ', 'Europe/Rome')
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-10T23:30:00Z'))

        // 23:30 UTC is already 00:30 of March 11th in Rome
        expect(getTodayForInput()).toBe('2026-03-11')
    })

    it('returns the same day when local time and UTC agree', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-10T10:00:00Z'))

        expect(getTodayForInput()).toBe('2026-03-10')
    })
})
```

- [ ] **Step 4: Eseguire il test e verificare che fallisca**

Run: `npx vitest run tests/unit/date-format.test.ts -t "returns the local calendar day"`
Atteso: FAIL con `expected '2026-03-10' to be '2026-03-11'`.

Se invece passa, `vi.stubEnv('TZ', …)` non ha effetto sul fuso già inizializzato del processo: in quel caso il test va scritto passando il fuso esplicitamente al formato (`Intl.DateTimeFormat` con `timeZone: 'Europe/Rome'`), oppure si sposta questo caso in un file suo con `// @vitest-environment` e `TZ` impostato dal `poolOptions`. **Non** cambiare l'atteso: il comportamento giusto è `2026-03-11`.

- [ ] **Step 5: Correggere l'implementazione**

In `src/lib/date-format.ts`, al posto delle righe 181-183:

```ts
export function getTodayForInput(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}
```

- [ ] **Step 6: Eseguire il test e verificare che passi**

Run: `npx vitest run tests/unit/date-format.test.ts`
Atteso: PASS, tutto il file.

Poi la suite intera, perché `getTodayForInput` è usata dalle pagine e da altri test:

Run: `npm run test:unit -- --run`
Atteso: stesso numero di test verdi di prima (874 più quelli aggiunti qui). Se un test fallisce perché si aspettava la data UTC, quel test stava documentando il bug: si aggiorna l'atteso e lo si dice nel messaggio di commit.

- [ ] **Step 7: Coprire i rami rimasti di `date-format`**

Con `--coverage.include='src/lib/date-format.ts'` si vede che restano rami scoperti (oggi B74.7, 25 rami). Per ogni funzione esportata, aggiungere i casi `null`, `undefined` e data non valida:

```ts
it('returns an empty string for a null date', () => {
    expect(formatDateForInput(null)).toBe('')
})

it('returns an empty string for an invalid date', () => {
    expect(formatDateForInput(new Date('nope'))).toBe('')
})
```

Il valore di ritorno atteso va preso dall'implementazione, non deciso qui. Per `formatRelativeTime` si usano gli stessi timer finti dello Step 3, con un istante fissato e una data di riferimento a distanza nota.

- [ ] **Step 8: Eseguire e misurare**

Run: `npx vitest run tests/unit/date-format.test.ts --coverage --coverage.include='src/lib/date-format.ts' --coverage.reporter=text`
Atteso: PASS; `date-format.ts` con righe ≥ 95 e rami ≥ 85.

- [ ] **Step 9: Commit (due commit distinti)**

```bash
git add vitest.config.ts
git commit -m "test(config): pin the suite timezone to UTC

The suite must not depend on the machine's timezone: CI runs UTC and
local machines do not. Tests that care set TZ themselves."

git add src/lib/date-format.ts tests/unit/date-format.test.ts
git commit -m "fix(date-format): build today's input value from the local date

getTodayForInput used toISOString(), i.e. the UTC day: at 23:30 in Rome
it returned the previous calendar day, so a record created late in the
evening was dated one day early. Covered by a test with fake timers."
```

---

### Task 2: `auth.ts` — `getSession` e `getSessionIncludingInactive`

`src/lib/auth.ts` è a L22.8 / B31.8: 44 righe e 30 rami scoperti. Le due funzioni di sessione sono la metà del file e contengono la regola di sicurezza della Fase H.

**Files:**
- Create: `tests/unit/lib/auth.test.ts`
- Riferimento: `src/lib/auth.ts` (`readAuthMetadata` riga 21, `getSession` riga 47, `getSessionIncludingInactive` riga 111)

**Interfaces:**
- Consumes: `getSession()`, `getSessionIncludingInactive()` da `@/lib/auth`; `prismaMock`; `makeSupabaseUser` da `tests/helpers/sessions.ts`
- Produces: il file `tests/unit/lib/auth.test.ts`, che il Task 3 estende con le guardie

- [ ] **Step 1: Scrivere lo scheletro con i mock di confine**

Crea `tests/unit/lib/auth.test.ts`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

// React's `cache` is a Server Components API unavailable in jsdom — stub it as
// passthrough, exactly as tests/integration/auth-session.test.ts does.
vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>
    return { ...actual, cache: <T>(fn: T) => fn }
})

const getUser = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
    createClient: async () => ({ auth: { getUser } }),
}))

import { getSession, getSessionIncludingInactive } from '@/lib/auth'
import { prismaMock } from '../../helpers/prisma-mock'
import { makeSupabaseUser } from '../../helpers/sessions'

const activeTrainer = makeSupabaseUser({
    id: 'supabase-uuid-1',
    email: 'trainer@zerocento.it',
    app_metadata: { role: 'trainer', isActive: true },
    user_metadata: { firstName: 'Marco', lastName: 'Trainer' },
})

const prismaUser = {
    id: 'trainer-uuid-1',
    email: 'trainer@zerocento.it',
    firstName: 'Marco',
    lastName: 'Trainer',
    role: 'trainer',
    isActive: true,
}

beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: activeTrainer }, error: null })
})
```

Il modulo da mockare (`@/lib/supabase-server`) è quello che `auth.ts` importa alla riga 2: verificarlo con `head -6 src/lib/auth.ts`. **`@/lib/auth` non va mockato**: è il modulo sotto test.

- [ ] **Step 2: Scrivere i casi di `getSession`**

```ts
describe('getSession', () => {
    it('returns null when Supabase reports an error', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } })

        await expect(getSession()).resolves.toBeNull()
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns null when there is no user', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: null })

        await expect(getSession()).resolves.toBeNull()
    })

    it('builds the session from metadata without touching Prisma', async () => {
        const session = await getSession()

        expect(session?.user).toMatchObject({
            id: 'supabase-uuid-1',
            email: 'trainer@zerocento.it',
            firstName: 'Marco',
            lastName: 'Trainer',
            role: 'trainer',
            isActive: true,
        })
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns null when the metadata says the account is inactive', async () => {
        getUser.mockResolvedValue({
            data: {
                user: makeSupabaseUser({
                    email: 'trainer@zerocento.it',
                    app_metadata: { role: 'trainer', isActive: false },
                    user_metadata: { firstName: 'Marco', lastName: 'Trainer' },
                }),
            },
            error: null,
        })

        await expect(getSession()).resolves.toBeNull()
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('falls back to Prisma when the metadata is incomplete', async () => {
        getUser.mockResolvedValue({
            data: {
                user: makeSupabaseUser({
                    email: 'trainer@zerocento.it',
                    app_metadata: { role: 'trainer' }, // isActive missing
                    user_metadata: { firstName: 'Marco', lastName: 'Trainer' },
                }),
            },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue(prismaUser as never)

        const session = await getSession()

        expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: { email: 'trainer@zerocento.it' },
            select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
        })
        expect(session?.user.id).toBe('trainer-uuid-1')
    })

    it('returns null when Prisma has no such user', async () => {
        getUser.mockResolvedValue({
            data: { user: makeSupabaseUser({ email: 'ghost@zerocento.it', app_metadata: {}, user_metadata: {} }) },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue(null)

        await expect(getSession()).resolves.toBeNull()
    })

    it('returns null when the Prisma user is inactive', async () => {
        getUser.mockResolvedValue({
            data: { user: makeSupabaseUser({ email: 'trainer@zerocento.it', app_metadata: {}, user_metadata: {} }) },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue({ ...prismaUser, isActive: false } as never)

        await expect(getSession()).resolves.toBeNull()
    })
})
```

- [ ] **Step 3: Scrivere il caso di regressione della Fase H**

È il test che dà senso all'hotfix: un utente che si scrive da solo `role: 'admin'` in `user_metadata` (scrivibile con la chiave anon) non deve diventare admin.

```ts
    it('ignores a role forged in user_metadata', async () => {
        getUser.mockResolvedValue({
            data: {
                user: makeSupabaseUser({
                    email: 'trainee@zerocento.it',
                    app_metadata: { role: 'trainee', isActive: true },
                    user_metadata: { role: 'admin', firstName: 'Mario', lastName: 'Atleta' },
                }),
            },
            error: null,
        })

        const session = await getSession()

        expect(session?.user.role).toBe('trainee')
    })

    it('does not accept a role that exists only in user_metadata', async () => {
        getUser.mockResolvedValue({
            data: {
                user: makeSupabaseUser({
                    email: 'trainee@zerocento.it',
                    app_metadata: {},
                    user_metadata: { role: 'admin', isActive: true, firstName: 'Mario', lastName: 'Atleta' },
                }),
            },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue({ ...prismaUser, role: 'trainee' } as never)

        const session = await getSession()

        // metadata is not a trustworthy source here: Prisma decides
        expect(prismaMock.user.findUnique).toHaveBeenCalled()
        expect(session?.user.role).toBe('trainee')
    })
```

- [ ] **Step 4: Scrivere i casi di `getSessionIncludingInactive`**

Stessa struttura, con la differenza che conta:

```ts
describe('getSessionIncludingInactive', () => {
    it('returns the session of an inactive user', async () => {
        getUser.mockResolvedValue({
            data: { user: makeSupabaseUser({ email: 'trainer@zerocento.it', app_metadata: {}, user_metadata: {} }) },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue({ ...prismaUser, isActive: false } as never)

        const session = await getSessionIncludingInactive()

        expect(session?.user.isActive).toBe(false)
    })

    it('returns null when Prisma has no such user', async () => {
        getUser.mockResolvedValue({
            data: { user: makeSupabaseUser({ email: 'ghost@zerocento.it', app_metadata: {}, user_metadata: {} }) },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue(null)

        await expect(getSessionIncludingInactive()).resolves.toBeNull()
    })

    it('returns null when Supabase reports an error', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } })

        await expect(getSessionIncludingInactive()).resolves.toBeNull()
    })
})
```

Prima di scriverli, rileggere le righe 111-170 di `auth.ts`: se la funzione ha anche il percorso veloce sui metadata, aggiungere il caso corrispondente.

- [ ] **Step 5: Eseguire il file**

Run: `npx vitest run tests/unit/lib/auth.test.ts`
Atteso: PASS, 13 test.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/lib/auth.test.ts
git commit -m "test(auth): cover getSession and getSessionIncludingInactive

Mocks stop at the boundary (supabase-server and Prisma) so the real
implementation runs. Includes the regression that a role forged in
user_metadata has no effect."
```

---

### Task 3: `auth.ts` — guardie e proprietà

**Files:**
- Modify: `tests/unit/lib/auth.test.ts`
- Riferimento: `src/lib/auth.ts` (`requireAuthDuringOnboarding` riga 175, `requireAuth` riga 217, `requireRole` riga 240, `isTrainerOwnsTrainee` riga 264, `requireTrainerOwnership` riga 279, `isTrainerOwnsProgram` riga 302, `requireTrainerProgramOwnership` riga 317), `AUTH_ERROR_KEYS` riga 8

**Interfaces:**
- Consumes: le funzioni sopra da `@/lib/auth`; `prismaMock`; lo scheletro del Task 2
- Produces: `src/lib/auth.ts` ≥ 95% di righe

- [ ] **Step 1: Leggere le chiavi di errore**

Run: `sed -n '8,15p' src/lib/auth.ts`

Atteso: `authenticationRequired: 'auth.authenticationRequired'`, `accessDenied: 'auth.accessDenied'`, `traineeAccessDenied: 'auth.traineeAccessDenied'`, `programAccessDenied: 'auth.programAccessDenied'`, `userNotFound: 'user.notFound'`. Le chiavi asserite nei passi seguenti devono essere queste; se il file è cambiato, si usano quelle nuove.

- [ ] **Step 2: Aggiungere un helper per leggere l'errore lanciato**

In `tests/unit/lib/auth.test.ts`, sotto le fixture:

```ts
/** The guards throw the Response that apiError builds. */
async function caught(promise: Promise<unknown>): Promise<{ status: number; code: string; key: string }> {
    try {
        await promise
        throw new Error('expected the guard to throw')
    } catch (thrown) {
        const response = thrown as Response
        const body = await response.json()
        return { status: response.status, code: body.error.code, key: body.error.key }
    }
}
```

- [ ] **Step 3: Scrivere i casi di `requireAuth` e `requireRole`**

```ts
describe('requireAuth', () => {
    it('returns the session when authenticated', async () => {
        await expect(requireAuth()).resolves.toMatchObject({ user: { role: 'trainer' } })
    })

    it('throws 401 when there is no session', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: null })

        expect(await caught(requireAuth())).toEqual({
            status: 401,
            code: 'UNAUTHORIZED',
            key: 'auth.authenticationRequired',
        })
    })
})

describe('requireRole', () => {
    it('accepts a single allowed role', async () => {
        await expect(requireRole('trainer')).resolves.toMatchObject({ user: { role: 'trainer' } })
    })

    it('accepts an array that contains the role', async () => {
        await expect(requireRole(['admin', 'trainer'])).resolves.toMatchObject({ user: { role: 'trainer' } })
    })

    it('throws 403 with the required roles when the role does not match', async () => {
        expect(await caught(requireRole('admin'))).toEqual({
            status: 403,
            code: 'FORBIDDEN',
            key: 'auth.accessDenied',
        })
    })

    it('reports the required roles in the error details', async () => {
        try {
            await requireRole(['admin'])
            throw new Error('expected the guard to throw')
        } catch (thrown) {
            const body = await (thrown as Response).json()
            expect(body.error.details).toEqual({ requiredRoles: ['admin'] })
        }
    })

    it('throws 401, not 403, when there is no session at all', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: null })

        expect(await caught(requireRole('trainer'))).toMatchObject({ status: 401 })
    })
})
```

- [ ] **Step 4: Scrivere i casi di `requireAuthDuringOnboarding`**

Questa funzione non passa da `getSession`: interroga Supabase e poi Prisma direttamente, e **non** guarda `isActive`.

```ts
describe('requireAuthDuringOnboarding', () => {
    it('returns the user even when the account is not active yet', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ ...prismaUser, isActive: false } as never)

        const result = await requireAuthDuringOnboarding()

        expect(result.user.isActive).toBe(false)
        expect(result.supabaseUser.id).toBe('supabase-uuid-1')
    })

    it('throws 401 when Supabase has no user', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: null })

        expect(await caught(requireAuthDuringOnboarding())).toEqual({
            status: 401,
            code: 'UNAUTHORIZED',
            key: 'auth.authenticationRequired',
        })
    })

    it('throws 401 with userNotFound when Prisma has no user', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)

        expect(await caught(requireAuthDuringOnboarding())).toEqual({
            status: 401,
            code: 'UNAUTHORIZED',
            key: 'user.notFound',
        })
    })
})
```

- [ ] **Step 5: Scrivere i casi di proprietà**

```ts
describe('isTrainerOwnsTrainee', () => {
    it('queries the association with both ids', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({ id: 'assoc-1' } as never)

        await expect(isTrainerOwnsTrainee('trainer-1', 'trainee-1')).resolves.toBe(true)
        expect(prismaMock.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', traineeId: 'trainee-1' },
        })
    })

    it('returns false when there is no association', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        await expect(isTrainerOwnsTrainee('trainer-1', 'trainee-1')).resolves.toBe(false)
    })
})

describe('requireTrainerOwnership', () => {
    it('returns the session when the trainer owns the trainee', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({ id: 'assoc-1' } as never)

        await expect(requireTrainerOwnership('trainee-1')).resolves.toMatchObject({ user: { role: 'trainer' } })
    })

    it('throws 403 traineeAccessDenied when the association is missing', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        expect(await caught(requireTrainerOwnership('trainee-1'))).toEqual({
            status: 403,
            code: 'FORBIDDEN',
            key: 'auth.traineeAccessDenied',
        })
    })

    it('throws 403 accessDenied when the caller is not a trainer', async () => {
        getUser.mockResolvedValue({
            data: {
                user: makeSupabaseUser({
                    email: 'admin@zerocento.it',
                    app_metadata: { role: 'admin', isActive: true },
                    user_metadata: { firstName: 'Admin', lastName: 'User' },
                }),
            },
            error: null,
        })

        expect(await caught(requireTrainerOwnership('trainee-1'))).toMatchObject({ key: 'auth.accessDenied' })
        expect(prismaMock.trainerTrainee.findFirst).not.toHaveBeenCalled()
    })
})
```

Poi lo stesso blocco per `isTrainerOwnsProgram` / `requireTrainerProgramOwnership`, con `prismaMock.trainingProgram.findFirst` chiamato come `{ where: { id: 'prog-1', trainerId: 'trainer-1' } }` e la chiave `auth.programAccessDenied`.

- [ ] **Step 6: Eseguire e misurare**

Run: `npx vitest run tests/unit/lib/auth.test.ts --coverage --coverage.include='src/lib/auth.ts' --coverage.reporter=text`
Atteso: PASS; `auth.ts` con righe ≥ 95 e rami ≥ 85.

Se resta sotto, la colonna `Uncovered Line #s` dice quali rami mancano: si aggiunge un caso per ciascuno con la stessa struttura.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/lib/auth.test.ts
git commit -m "test(auth): cover the guards and the ownership checks

requireAuth, requireRole (single role, array, wrong role, no session),
requireAuthDuringOnboarding and the trainee/program ownership guards,
asserting status, code and i18n key of the thrown response."
```

---

### Task 4: `middleware.ts` in un file solo

Oggi il middleware è coperto al 49.3% da due file: `tests/unit/middleware-must-change-password.test.ts` (redirect del cambio password) e `tests/integration/rate-limit-read.test.ts` (rate limiting sulle letture). Mancano 38 righe e 27 rami: route pubbliche, file pubblici, `/api/health`, passthrough API, redirect a `/login`, ramo Redis del rate limiting, configurazione per percorso.

**Files:**
- Create: `tests/unit/middleware.test.ts` (con `git mv` da `tests/unit/middleware-must-change-password.test.ts`)
- Delete: `tests/unit/middleware-must-change-password.test.ts`
- Riferimento: `src/middleware.ts` (`checkRateLimit` riga 23, `getRateLimitConfig` riga 70, `middleware` riga 106, redirect riga 203, `mustChangePassword` riga 210)

**Interfaces:**
- Consumes: `middleware(request: NextRequest)` da `@/middleware`
- Produces: niente per gli altri task

- [ ] **Step 1: Spostare il file esistente**

```bash
git mv tests/unit/middleware-must-change-password.test.ts tests/unit/middleware.test.ts
```

Il file porta già i mock giusti, che vanno tenuti: `vi.hoisted` per lo spy di `getUser`, `vi.mock('@upstash/redis/cloudflare', () => ({ Redis: vi.fn() }))` (senza, il modulo tenta l'inizializzazione specifica di Cloudflare) e `vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser } }) }))`.

Run: `npx vitest run tests/unit/middleware.test.ts`
Atteso: PASS, gli stessi test di prima.

- [ ] **Step 2: Coprire le uscite anticipate**

Il middleware esce subito, senza toccare Supabase, per: route pubbliche (riga 110, `PUBLIC_ROUTES`), file pubblici (riga 114, `PUBLIC_FILES`), `/api/health` (riga 119, `API_PUBLIC_ROUTES`).

```ts
describe('middleware: public paths', () => {
    it.each(['/login', '/forgot-password', '/reset-password', '/force-change-password', '/onboarding/set-password'])(
        'lets %s through without a session',
        async (path) => {
            const res = await middleware(request(path))

            expect(res.status).toBe(200)
            expect(getUser).not.toHaveBeenCalled()
        }
    )

    it.each(['/sw.js', '/manifest.json', '/robots.txt', '/sitemap.xml'])(
        'lets the public file %s through',
        async (path) => {
            const res = await middleware(request(path))

            expect(res.status).toBe(200)
            expect(getUser).not.toHaveBeenCalled()
        }
    )

    it('lets /api/health through without a session', async () => {
        const res = await middleware(request('/api/health'))

        expect(res.status).toBe(200)
        expect(getUser).not.toHaveBeenCalled()
    })
})
```

L'helper `request(path)` è già nel file spostato e assegna un IP diverso a ogni chiamata (`10.9.0.${++ipCounter}`): serve perché lo `Map` del rate limiting è un modulo condiviso fra i test, e due test sullo stesso IP e percorso si sommano.

- [ ] **Step 3: Coprire il redirect a `/login`**

```ts
describe('middleware: page routes', () => {
    it('redirects to /login when there is no user', async () => {
        getUser.mockResolvedValue({ data: { user: null } })

        const res = await middleware(request('/trainer/programs'))

        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('/login')
    })

    it('lets an authenticated user through', async () => {
        getUser.mockResolvedValue({
            data: { user: { id: 'u-1', app_metadata: { mustChangePassword: false }, user_metadata: {} } },
        })

        const res = await middleware(request('/trainer/programs'))

        expect(res.status).toBe(200)
        expect(res.headers.get('location')).toBeNull()
    })

    it('ignores mustChangePassword coming from user_metadata', async () => {
        getUser.mockResolvedValue({
            data: { user: { id: 'u-1', app_metadata: {}, user_metadata: { mustChangePassword: true } } },
        })

        const res = await middleware(request('/trainer/programs'))

        expect(res.status).toBe(200)
    })
})
```

Lo status del redirect di `NextResponse.redirect` è 307: se il test stampa un numero diverso, si usa quello che il framework produce davvero.

- [ ] **Step 4: Coprire il ramo Redis del rate limiting**

`checkRateLimit` usa Redis solo quando `useRedis` è vero **e** `redis` non è `null`; `redis` è costruito al caricamento del modulo dalle variabili d'ambiente (righe 8-13). Serve quindi un file di test con le variabili impostate prima dell'import, ovvero un `describe` che usa `vi.resetModules()` e un `await import('@/middleware')` dopo aver messo l'ambiente:

```ts
describe('middleware: Redis-backed rate limit on auth endpoints', () => {
    it('answers 429 when Redis says the limit is reached', async () => {
        vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io')
        vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token')
        vi.stubEnv('NODE_ENV', 'production')

        const get = vi.fn().mockResolvedValue(99)
        const exec = vi.fn().mockResolvedValue([])
        vi.doMock('@upstash/redis/cloudflare', () => ({
            Redis: vi.fn(() => ({ get, pipeline: () => ({ incr: vi.fn(), expire: vi.fn(), exec }) })),
        }))
        vi.resetModules()

        const { middleware: freshMiddleware } = await import('@/middleware')
        const res = await freshMiddleware(request('/api/exercises'))

        expect(res.status).toBe(429)
        expect(res.headers.get('Retry-After')).toBe('60')

        vi.doUnmock('@upstash/redis/cloudflare')
        vi.unstubAllEnvs()
        vi.resetModules()
    })
})
```

Il limite di `/api/exercises` in `GET` è 100 con finestra di 60 s (riga 99), quindi `get` che restituisce 99 non basta a superarlo: il valore va portato a 100 perché la condizione `current >= limit` (riga 34) sia vera. Verificare il numero alla riga 99 prima di scriverlo e usare quello.

Attenzione al `NODE_ENV`: il rate limiting è saltato del tutto quando vale `development` (riga 124). Nei test in cui serve, va impostato a `production` con `vi.stubEnv` e rimesso a posto dopo.

- [ ] **Step 5: Coprire `getRateLimitConfig` senza duplicare `rate-limit-read.test.ts`**

`tests/integration/rate-limit-read.test.ts` copre già: 429 dopo 100 richieste su `GET /api/exercises`, `/api/programs`, `/api/personal-records`, il caso sotto soglia, la pagina pubblica di login e il passthrough delle API. **Quei casi non si ripetono qui.** Restano da coprire i rami di configurazione non ancora toccati:

```ts
describe('middleware: rate limit configuration', () => {
    it.each([
        ['/api/feedback', 30],
        ['/api/users', 20],
    ])('applies the dedicated limit of %s', async (path, limit) => {
        vi.stubEnv('NODE_ENV', 'production')
        const ip = `10.8.0.${++ipCounter}`

        for (let i = 0; i < limit; i++) {
            const res = await middleware(requestFrom(ip, path))
            expect(res.status).not.toBe(429)
        }

        const blocked = await middleware(requestFrom(ip, path))
        expect(blocked.status).toBe(429)

        vi.unstubAllEnvs()
    })
})
```

`requestFrom(ip, path)` è una variante dell'helper che tiene fisso l'IP: va aggiunta accanto a `request`. I limiti (30 per `/api/feedback`, 20 per `/api/users`) si leggono alle righe 81-88: usare i valori del file, non quelli scritti qui, se sono cambiati.

- [ ] **Step 6: Verificare il matcher**

`config.matcher` (riga 224) decide su quali percorsi Next.js esegue il middleware: è la prima riga di difesa, e una modifica distratta a quella regex farebbe girare il middleware sugli asset o lo spegnerebbe su una pagina. Si asserisce direttamente sull'oggetto esportato:

```ts
import { middleware, config } from '@/middleware'

describe('middleware: matcher', () => {
    const matcher = new RegExp(config.matcher[0].replace(/^\/\(/, '(').replace(/\)$/, ')'))

    it.each(['/_next/static/chunk.js', '/_next/image', '/favicon.ico', '/manifest.json', '/logo.png', '/styles.css'])(
        'excludes %s',
        (path) => {
            expect(matcher.test(path)).toBe(false)
        }
    )

    it.each(['/trainer/programs', '/api/exercises', '/login'])('includes %s', (path) => {
        expect(matcher.test(path)).toBe(true)
    })
})
```

Se la conversione da pattern di Next a `RegExp` risulta scomoda, l'alternativa accettabile è asserire la stringa esatta: `expect(config.matcher[0]).toContain('_next/static')` per ciascuna esclusione. Ciò che conta è che il test fallisca se qualcuno toglie un'esclusione.

- [ ] **Step 7: Eseguire e misurare**

Run: `npx vitest run tests/unit/middleware.test.ts --coverage --coverage.include='src/middleware.ts' --coverage.reporter=text`
Atteso: PASS; `middleware.ts` con righe ≥ 80.

Run: `npx vitest run tests/integration/rate-limit-read.test.ts`
Atteso: PASS, ancora 7 test: lo spostamento non deve aver rotto il loro conteggio del rate limit (se falliscono, è perché i test nuovi consumano quote sugli stessi IP: cambiare gli IP dei test nuovi).

- [ ] **Step 8: Commit**

```bash
git add tests/unit/middleware.test.ts
git commit -m "test(middleware): one file covering public paths, redirects and limits

Absorbs middleware-must-change-password.test.ts and adds the early
exits, the /login redirect, the Redis branch of the rate limiter and
the per-path limits that rate-limit-read.test.ts does not cover."
```

---

### Task 5: `rbac.test.ts` come test di collegamento

La spec (§6.3) chiede che `tests/integration/rbac.test.ts` resti un test di collegamento: verifica che ogni route chiami la guardia giusta con gli argomenti giusti, mentre la logica delle guardie è ora coperta dai task 2 e 3.

**Files:**
- Modify: `tests/integration/rbac.test.ts`
- Riferimento: i route handler importati dal file

**Interfaces:**
- Consumes: `requireRole`, `requireAuth` mockati dalla fabbrica `authModuleMock()`
- Produces: niente per gli altri task

- [ ] **Step 1: Verificare il commento in testa**

Run: `head -3 tests/integration/rbac.test.ts`

Atteso (aggiunto in Fase 1):
```
// Wiring test: it checks that each route calls the right guard with the right
// arguments. The guards' own logic is covered by tests/unit/lib/auth.test.ts.
```

Ora che `tests/unit/lib/auth.test.ts` esiste davvero, il rimando è corretto: se il commento manca o punta altrove, sistemarlo.

- [ ] **Step 2: Aggiungere le asserzioni sugli argomenti della guardia**

Per ogni `it` del file che oggi verifica solo lo status, aggiungere l'asserzione sull'argomento con cui il route ha chiamato la guardia:

```ts
        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer', 'trainee'])
```

L'elenco dei ruoli si legge nel route handler corrispondente (`grep -n "requireRole(" <file del route>`), non si indovina. Per i route che usano `requireAuth()` senza argomenti, l'asserzione è `expect(vi.mocked(requireAuth)).toHaveBeenCalled()`, che qui è legittima: la chiamata senza argomenti è essa stessa l'affermazione.

- [ ] **Step 3: Eseguire il file**

Run: `npx vitest run tests/integration/rbac.test.ts`
Atteso: PASS, 17 test (stesso numero di prima: questo task aggiunge asserzioni, non casi).

- [ ] **Step 4: Commit**

```bash
git add tests/integration/rbac.test.ts
git commit -m "test(rbac): assert the guard arguments, not just the status"
```

---

### Task 6: Soglie, skill, CHANGELOG e integrazione

**Files:**
- Modify: `vitest.config.ts` (soglie `src/lib/**` e globale)
- Modify: `.claude/skills/zero-cento-testing/SKILL.md` (non tracciato da git)
- Modify: `implementation-docs/CHANGELOG.md`

**Interfaces:**
- Consumes: i test dei task 1-5
- Produces: la baseline da cui parte la Fase 3

- [ ] **Step 1: Misurare il gruppo e il totale**

Esegui il comando di misura in testa al piano.

Atteso: `src/lib/` intorno a L72-75 (l'aumento viene da `auth.ts`, che da solo vale 44 righe del gruppo, e da `date-format.ts`); totale globale in crescita di un paio di punti. I valori esatti sono quelli da scrivere nel config.

- [ ] **Step 2: Alzare le soglie ai valori misurati**

In `vitest.config.ts`, dentro `thresholds`, sostituire **solo** i numeri, lasciando il commento aggiornato alla data di oggi:

```ts
// Baseline floors measured on chore/test-quality-auth, <data>. They only go
// up: every phase raises them to the level it reaches.
lines: <L>, statements: <S>, functions: <F>, branches: <B>,
'src/lib/**': { lines: <L>, statements: <S>, functions: <F>, branches: <B> },
```

Le soglie di `src/schemas/**` e `src/app/api/**` non si toccano in questa fase.

- [ ] **Step 3: Verificare che le soglie passino**

Run: `npm run test:unit -- --run --coverage`
Atteso: exit code 0, nessun messaggio `ERROR: Coverage for … does not meet threshold`.

- [ ] **Step 4: Aggiornare la skill**

In `.claude/skills/zero-cento-testing/SKILL.md`, nella sezione "Mocks", aggiungere in fondo:

```markdown
`@/lib/auth` si mocka nei test dei route handler, **non** nei test che esercitano le
guardie stesse: `tests/unit/lib/auth.test.ts` mocka solo il confine (`@/lib/supabase-server`
e Prisma) e rende `cache` di React una funzione passthrough. Stessa regola per
`tests/unit/middleware.test.ts`, che mocka `@supabase/ssr` e `@upstash/redis/cloudflare`.
```

e, nella sezione "Node Version" (o in una nuova sezione "Date e fusi orari"):

```markdown
La suite gira con `TZ=UTC`, impostato in `vitest.config.ts`. Un test che dipende dal
fuso lo dichiara da sé con `vi.stubEnv('TZ', 'Europe/Rome')` più `vi.useFakeTimers()` e
`vi.setSystemTime(...)`, e ripulisce in `afterEach`. Mai scrivere un test che dipende
dall'ora reale della macchina.
```

- [ ] **Step 5: Aggiungere la voce in CHANGELOG**

In cima a `implementation-docs/CHANGELOG.md`, sotto `### Changed`, seguendo il formato delle voci esistenti (`### [data] — titolo`, `**File modificati:**`, `**Note:**`). Deve dire: che `auth.ts` e `middleware.ts` sono ora testati direttamente e con quali percentuali; che il bug di `getTodayForInput` è corretto e qual era l'effetto visibile (record datati un giorno prima se creati a tarda sera in Italia); che la suite gira a `TZ=UTC`; i nuovi valori delle soglie.

- [ ] **Step 6: Verifica finale della fase**

Run: `npm run test:unit -- --run --coverage && npm run lint && npm run type-check`
Atteso: tutti e tre con exit code 0.

Poi le verifiche mirate:

```bash
npx vitest run tests/unit/lib/auth.test.ts --coverage --coverage.include='src/lib/auth.ts' --coverage.reporter=text
npx vitest run tests/unit/middleware.test.ts --coverage --coverage.include='src/middleware.ts' --coverage.reporter=text
```
Atteso: `auth.ts` ≥ 95 di righe, `middleware.ts` ≥ 80 di righe.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts implementation-docs/CHANGELOG.md
git commit -m "docs(tests): raise the lib threshold after the auth and middleware tests"
```

- [ ] **Step 8: Integrazione**

La fase finisce quando la CI è verde. Integrazione secondo lo skill `git-pr-workflow`:

```bash
git checkout development
git pull --ff-only
git merge --ff-only chore/test-quality-auth
git push origin development
```

Prima del push, verificare su GitHub Actions che il job `unit-test` sia verde sul branch. Se `git merge --ff-only` fallisce, `development` è andato avanti: `git checkout chore/test-quality-auth && git rebase development`, rieseguire la suite e ripetere.

---

## Verifica finale della fase

- [ ] `src/lib/auth.ts` ≥ 95% di righe e ≥ 85% di rami
- [ ] `src/middleware.ts` ≥ 80% di righe
- [ ] Esiste il test di regressione che dimostra che `user_metadata.role` non conferisce privilegi
- [ ] `getTodayForInput` restituisce la data locale, con un test a timer finti che lo dimostra sul fuso `Europe/Rome`
- [ ] La suite gira con `TZ=UTC` e nessun test dipende dall'ora reale della macchina
- [ ] `tests/unit/middleware-must-change-password.test.ts` non esiste più: i suoi casi sono in `tests/unit/middleware.test.ts`
- [ ] `tests/integration/rate-limit-read.test.ts` ancora verde, senza casi duplicati nel file del middleware
- [ ] Soglia `src/lib/**` e soglia globale alzate ai valori misurati
- [ ] `npm run test:unit -- --run --coverage`, `npm run lint` e `npm run type-check` con exit code 0
- [ ] Job `unit-test` verde in CI
- [ ] CHANGELOG e skill `zero-cento-testing` aggiornate
