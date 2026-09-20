# Test Quality & Coverage — Design

**Data:** 2026-09-19
**Stato:** Draft — in revisione
**Autore:** Edoardo Frati (con Claude Code)

## 1. Contesto

Analisi della suite del 2026-09-19 (75 file, 854 test Vitest + 4 spec Playwright).

| Problema | Evidenza |
|---|---|
| Suite rossa in locale | 31 test falliti su Node 26: il `localStorage` nativo (Node ≥25, webstorage) copre quello di jsdom → `TypeError: Cannot read properties of undefined (reading 'clear')` in `trainee-workout-focus.test.tsx` |
| Test non aggiornato | `tests/unit/workout-recap-panel.test.tsx:88` si aspetta `3 × 5 × 120 kg`, il componente mostra `3 x 5 · 120kg` (formato cambiato nel commit `c72d54b`) |
| Test in timeout | `tests/unit/records-exercise-autocomplete.test.tsx`: `await import()` dinamico, `global.fetch` finto per tutto il file, nessun `data.user` nella risposta |
| Worker in timeout | `Failed to start forks worker` con la coverage attiva sotto WSL su `/mnt/c` |
| CI rossa sulla coverage | Branch dei 37 file inclusi al 76.2% contro una soglia dell'80% |
| Coverage parziale | Coverage misurata solo su 37 file scelti a mano (85% lines). Su tutto `src/`: lines 36.4%, branches 33.7%, functions 28.8% |
| Auth non testato | `src/lib/auth.ts` al 22.8%: tutti i test di integrazione sostituiscono `@/lib/auth` con un mock, quindi i test RBAC controllano solo che il route chiami `requireRole` |
| Mock ripetuti | 29 file su 31 di integrazione ridefiniscono a mano `@/lib/prisma`; circa 190 `as any` |
| Asserzioni deboli | 62 `toHaveBeenCalled()` senza argomenti, 25 `toBeTruthy()`, 16 `toBeDefined()` |
| Regole della skill violate | `require('react')` in `trainer-trainee-programs-tab.test.tsx` e `trainer-trainee-detail-sbd-report.test.tsx` |
| Test che ripete l'implementazione | `getTodayForInput` è testato con la stessa formula UTC del codice; nessun uso di `vi.useFakeTimers` in tutta la suite |

### Problema di sicurezza trovato durante l'analisi (fuori dal perimetro dei test)

`getSession()` / `getSessionIncludingInactive()` (`src/lib/auth.ts`) si fidano di `user_metadata.role` e `user_metadata.isActive`. I `user_metadata` di Supabase si possono modificare dal client con la chiave anon (`supabase.auth.updateUser({ data })`). Conseguenze: un utente può alzarsi il proprio ruolo e un utente disattivato può riattivarsi da solo. Lo stesso vale per `mustChangePassword` (`src/middleware.ts:211`, `src/app/login/page.tsx`).

**Decisione:** hotfix separato e prioritario (**Fase H**), da fare prima della Fase 2, così i test di `auth.ts` descrivono il comportamento corretto e non quello vulnerabile. Vedi §7.

## 2. Obiettivi

1. Suite e CI verdi con qualsiasi Node ≥20.
2. Coverage misurata su tutto `src/`, con due livelli di soglia:
   - **globale** su `src/**`: soglia minima che sale nel tempo (non fa regressioni);
   - **per gruppo** su `src/lib/**`, `src/schemas/**`, `src/app/api/**`: **80%** su lines, statements, functions e branches alla fine del lavoro.
3. Test diretti del codice di autorizzazione (`auth.ts`, `middleware.ts`).
4. Mock Prisma unico e tipizzato; nessun `as any` sui mock; asserzioni sugli argomenti delle chiamate.

### Fuori perimetro

- Test di componenti e pagine in `src/app/{trainer,trainee,admin}` e `src/components`: sono coperti solo dalla soglia globale. Pagine come `edit/_content.tsx` (1057 righe) avranno una spec a parte.
- Nuovi test E2E.
- Refactoring del codice di produzione, salvo Fase H e il bug su `getTodayForInput` (§6.4).

## 3. Approccio

Quattro fasi sui test (0–3) più l'hotfix H, in sequenza, **una PR per fase** verso `development`. Le soglie partono dai valori attuali (la CI non è mai rossa) e salgono a ogni PR fino all'80% nella Fase 3.

```
Fase 0 (suite verde) ─► Fase 1 (mock + migrazione) ─► Fase H (hotfix auth) ─► Fase 2 (test auth) ─► Fase 3 (test mancanti → 80%)
```

Perché questo ordine: la Fase 1 rende economici i test delle fasi 2 e 3; la Fase H deve arrivare prima della Fase 2.

---

## 4. Fase 0 — Suite e CI verdi

### 4.1 `localStorage` con Node ≥25

In `tests/unit/setup.ts`:

```ts
// Node ≥25 expone un localStorage nativo che copre quello di jsdom
// e non funziona senza --localstorage-file: installiamo uno Storage in memoria.
function createMemoryStorage(): Storage {
    let store = new Map<string, string>()
    return {
        get length() { return store.size },
        clear: () => { store = new Map() },
        getItem: (k) => store.get(k) ?? null,
        key: (i) => Array.from(store.keys())[i] ?? null,
        removeItem: (k) => { store.delete(k) },
        setItem: (k, v) => { store.set(k, String(v)) },
    }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
    if (typeof globalThis[name]?.clear !== 'function') {
        Object.defineProperty(globalThis, name, { value: createMemoryStorage(), configurable: true })
    }
}

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
})
```

Aggiungo anche `window.localStorage`, dato che in jsdom `window === globalThis`; va verificato durante l'implementazione.

### 4.2 Test non aggiornato — `workout-recap-panel.test.tsx`

- L'asserzione diventa `screen.getByText('3 x 5 · 120kg')`.
- Nuovo caso: con `targetRpe: 8` il testo è `3 x 5 · 120kg · @RPE 8`.
- Nuovo caso: con `effectiveWeight` a `0`/`null` non compare il peso (copre i rami di `buildExerciseSpec` e alza le branch del file dal 59%).

### 4.3 Test in timeout — `records-exercise-autocomplete.test.tsx`

- Import statico di `@/app/trainer/trainees/[id]/records/_content`.
- `fetch` finto che risponde **in base all'URL**:
  - `/api/users/trainee-1` → `{ data: { user: { id, firstName, lastName } } }`
  - `/api/personal-records?…` → `{ data: { items: [] } }`
  - `/api/exercises?…` → `{ data: { items: [{ id, name, type: 'fundamental' }] } }`
- Il mock si installa in `beforeEach` e si ripristina in `afterEach` (`vi.restoreAllMocks()` / salvataggio del `fetch` originale).
- Via il timeout personalizzato di 15000 ms. Se l'import resta lento sopra i 5 secondi, lo misuro e lo scrivo nella PR invece di alzare il timeout.

### 4.4 Stabilità del pool di worker

- `vitest.config.ts`: `maxWorkers: '50%'`. Il valore finale lo misuro sotto WSL: deve completare 3 run di fila con la coverage senza `Failed to start forks worker`.
- Skill `zero-cento-testing`, sezione Node Version: nota su `/mnt/c` (filesystem lento → meglio clonare il repo in `~/`).

### 4.5 Nuova configurazione della coverage

```ts
coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'json-summary', 'html'],
    include: ['src/**/*.{ts,tsx}'],
    exclude: [
        'src/app/sentry-example-page/**',
        'src/app/api/sentry-example-api/**',
        'src/app/components-showcase/**',
        'src/instrumentation*.ts',
        'src/sw.ts',
        'src/**/loading.tsx',
        'src/app/layout.tsx',
        'src/**/*.d.ts',
        'src/types/**',
    ],
    thresholds: {
        // Global floor — raised as coverage grows, never lowered
        lines: 35, statements: 35, functions: 28, branches: 33,
        'src/lib/**': { lines: 67, statements: 67, functions: 66, branches: 62 },
        'src/schemas/**': { lines: 79, statements: 79, functions: 80, branches: 68 },
        'src/app/api/**': { lines: 57, statements: 56, functions: 63, branches: 54 },
    },
},
```

I valori sono la baseline del 2026-09-19 arrotondata per difetto. Li ricalcolo dopo 4.2 e 4.3, che cambiano i numeri. La lista a mano di 37 file sparisce.

### 4.6 Fatto quando

- `npm run test:unit -- --run --coverage` esce con codice 0 su Node 20 e su Node 26 (in locale).
- 3 run di fila senza errori del pool.
- CI (job `unit-test`) verde.
- Aggiornata `implementation-docs/CHANGELOG.md`.

---

## 5. Fase 1 — Mock Prisma condiviso e pulizia dei test esistenti

### 5.1 Dipendenza

`npm i -D vitest-mock-extended` (compatibile con Vitest 4; da verificare all'installazione).

### 5.2 Helper — `tests/helpers/prisma-mock.ts`

```ts
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'
import { beforeEach, vi } from 'vitest'

export const prismaMock: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>()

// $transaction(callback) esegue il callback con lo stesso mock;
// $transaction([promises]) le risolve in ordine.
function installTransaction() {
    prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
        typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg as Promise<unknown>[]),
    )
}
installTransaction()

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

beforeEach(() => {
    mockReset(prismaMock)
    installTransaction()
})
```

- Si importa con `import { prismaMock } from '../helpers/prisma-mock'` **prima** dei route handler.
- Il mock generico di `@/lib/prisma` in `tests/unit/setup.ts` si toglie o si sostituisce con questo helper, secondo cosa usano oggi i test unitari (da verificare: grep di `prisma.` in `tests/unit`).

### 5.3 Helper auth — `tests/helpers/auth-mock.ts`

- `vi.mock('@/lib/auth')` con tutte le funzioni esportate già tipizzate: `vi.mocked(requireRole)`.
- Funzioni di comodo: `asTrainer(session?)`, `asAdmin()`, `asTrainee()`, `asUnauthenticated()` (rifiuta con `apiError('UNAUTHORIZED', …, 401)`), `asForbidden()`.
- Usa le sessioni già in `tests/integration/fixtures.ts`, che si sposta in `tests/helpers/sessions.ts` con un re-export da `fixtures.ts` per compatibilità durante la migrazione, da togliere a fine fase. `supabaseUser: {} as any` diventa un `makeSupabaseUser()` tipizzato.

### 5.4 Migrazione dei 29 file di integrazione

Un commit per dominio: `exercises`, `programs*`, `users*`, `workout-exercise*`, `trainee-*`, `feedback`, `personal-records`, `reference-data`, `admin-reports`, `rbac`, `api-contracts`, gli altri.

Per ogni file:

1. Il `vi.mock('@/lib/prisma', …)` locale diventa l'helper condiviso.
2. `(prisma.x.y as any).mockResolvedValue(...)` diventa `prismaMock.x.y.mockResolvedValue(...)`.
3. `(requireRole as any)` diventa `vi.mocked(requireRole)` o un helper `asX()`.
4. Ogni `toHaveBeenCalled()` su chiamate Prisma o auth diventa `toHaveBeenCalledWith(...)` con gli argomenti rilevanti (`where`, `data`, ruoli). `expect.objectContaining` è ammesso per i `select` o `include` lunghi.
5. `toBeTruthy()` / `toBeDefined()` sul body della risposta diventano asserzioni sulla forma (`expect(body.data).toEqual(...)` / `toMatchObject`).
6. Il comportamento deve restare lo stesso: numero di test e nomi invariati salvo motivazione scritta nel commit.

### 5.5 Test unitari

- `require('react')` nei due file citati diventa `vi.mock('x', async (importOriginal) => ...)` con `await import('react')`, oppure un import statico in cima al file.
- `as any` in `tests/unit/lib/trainee-program-data.test.ts` (23 occorrenze) diventa una factory di fixture tipizzate.

### 5.6 Regola anti-regressione

Il lint dei test (override ESLint per `tests/**`) segnala:
- `@typescript-eslint/no-explicit-any` come `warn`, poi `error` a fine fase;
- `no-restricted-syntax` sulle chiamate a `require()`.

Da verificare che `npm run lint` includa `tests/`; se no, lo aggiungo.

### 5.7 Aggiornamento della skill `zero-cento-testing`

- La sezione Integration Tests usa `prismaMock` / `asTrainer()` invece di `vi.mock('@/lib/prisma', () => ({ prisma: { ... } }))`.
- Nuova regola: `toHaveBeenCalledWith` obbligatorio sulle chiamate Prisma che scrivono dati (create, update, delete, upsert).

### 5.8 Fatto quando

- `grep -rn "vi.mock('@/lib/prisma'" tests/integration` → solo l'helper.
- `grep -rc "as any" tests` → 0, o eccezioni commentate con il motivo.
- `grep -rn "toHaveBeenCalled()" tests/integration` → 0 sulle chiamate Prisma o auth.
- Suite verde, coverage non scesa.

---

## 6. Fase 2 — Test diretti di `auth.ts` e `middleware.ts`

**Prerequisito:** Fase H completata.

### 6.1 `tests/unit/lib/auth.test.ts`

Mock solo al confine: `@/lib/supabase-server` (`createClient` → `auth.getUser`) e `prismaMock`. `react.cache` diventa una funzione passthrough (come in `auth-session.test.ts`).

| Funzione | Casi |
|---|---|
| `getSession` | `getUser` con errore → `null`; nessun user → `null`; metadata sicuri completi e attivi → sessione dai metadata e **nessuna** query Prisma; metadata con `isActive: false` → `null`; metadata incompleti → ricorso a Prisma con `where: { email }`; Prisma senza utente → `null`; utente Prisma non attivo → `null`; **`user_metadata.role` manipolato non ha effetto** (regressione della Fase H) |
| `getSessionIncludingInactive` | come sopra, ma un utente non attivo restituisce la sessione |
| `requireAuthDuringOnboarding` | errore o nessun user → 401 con chiave `AUTH_ERROR_KEYS.authenticationRequired`; utente Prisma assente → 401 `userNotFound`; ok → `{ user, supabaseUser }` |
| `requireAuth` | nessuna sessione → 401; sessione presente → restituita |
| `requireRole` | ruolo singolo ammesso; array di ruoli; ruolo sbagliato → 403 con `details.requiredRoles` e chiave `accessDenied`; nessuna sessione → 401 (non 403) |
| `isTrainerOwnsTrainee` | `findFirst` chiamato con `{ trainerId, traineeId }`; restituisce true/false |
| `requireTrainerOwnership` | non trainer → 403 per ruolo; trainer senza collegamento → 403 `traineeAccessDenied`; trainer con collegamento → sessione |
| `isTrainerOwnsProgram` / `requireTrainerProgramOwnership` | stessa struttura con `trainingProgram.findFirst` e l'`id` del programma |

Il risultato di `apiError` si controlla su status, `code` e `key`, leggendo `await (thrown as Response).json()` o la forma usata da `apiError`.

Obiettivo: `src/lib/auth.ts` ≥ 95% su lines e branches.

### 6.2 `tests/unit/middleware.test.ts`

Oggi è al 49%. Casi:
- route pubbliche (`/login`, `/forgot-password`, …) → passano senza sessione;
- route protetta senza sessione → redirect a `/login`;
- `mustChangePassword` (dalla sorgente sicura dopo la Fase H) → redirect a `/force-change-password`;
- rate limit: Upstash sulle route di auth (mock di `@upstash/ratelimit`) → 429 oltre il limite; Map in memoria per le altre route;
- matcher statici esclusi.

Coordinamento con `tests/integration/rate-limit-read.test.ts`: niente duplicati, va esteso quello se copre già il middleware.

### 6.3 Test RBAC

`tests/integration/rbac.test.ts` resta come test di collegamento: il route chiama la guardia giusta con gli argomenti giusti (`toHaveBeenCalledWith('trainer')` ecc.). Commento in cima al file: la logica delle guardie è testata in `tests/unit/lib/auth.test.ts`.

### 6.4 Bug `getTodayForInput` e timer finti

- Test prima (TDD) in `tests/unit/date-format.test.ts` con `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-03-10T23:30:00Z'))` e fuso `Europe/Rome` (`process.env.TZ` impostato nel setup o `vi.stubEnv`). Atteso `'2026-03-11'`.
- Correzione in `src/lib/date-format.ts`: data **locale** (`getFullYear`/`getMonth`/`getDate` con padding) invece di `toISOString()`.
- Stesso schema di timer finti per `formatRelativeTime` e per ogni test che oggi dipende da `new Date()`.
- `TZ=UTC` fisso nello script `test:unit` (tramite `cross-env` o `vitest.config.ts` `env`) per rendere la suite deterministica. I test sul fuso lo sovrascrivono localmente.

### 6.5 Fatto quando

- `auth.ts` ≥ 95%, `middleware.ts` ≥ 80%.
- Soglia di `src/lib/**` alzata al nuovo valore raggiunto.

---

## 7. Fase H — Hotfix autorizzazione dai metadata

Branch `hotfix/auth-app-metadata` da `master`, secondo lo skill `git-pr-workflow`.

1. `syncUserMetadata` scrive `role`, `isActive` e `mustChangePassword` in **`app_metadata`**. `firstName` e `lastName` restano in `user_metadata`: sono informazioni di visualizzazione, non di autorizzazione.
2. `getSession` / `getSessionIncludingInactive` leggono `role` e `isActive` **solo** da `app_metadata`; se mancano, si usa Prisma.
3. `middleware.ts`, `login/page.tsx`, `onboarding/set-password/page.tsx` e `force-change-password/route.ts` leggono o scrivono gli stessi campi da o in `app_metadata`.
4. Script una tantum `scripts/migrate-auth-metadata.ts` (service role): copia `role`, `isActive` e `mustChangePassword` da Prisma (fonte di verità) in `app_metadata` per tutti gli utenti. Si esegue prima del deploy.
5. Test: caso di regressione con `user_metadata.role = 'admin'` e `app_metadata.role = 'trainee'` → la sessione è trainee.

Questa fase richiede una decisione a parte (deploy e migrazione dei dati in produzione) e **va approvata da sola** prima di iniziare.

---

## 8. Fase 3 — Test mancanti fino all'80% per gruppo

Soglia per gruppo alzata **a ogni sotto-PR** al valore raggiunto (arrotondato per difetto), fino a 80/80/80/80.

### 8.1 `src/app/api/**` (oggi L57.8 / B54.2 / F63.6)

Ogni route segue lo schema della skill: 200/201, 400/422, 401, 403 (ruolo e appartenenza), 404, e `toHaveBeenCalledWith` sulle scritture Prisma.

| Priorità | Route (coverage lines attuale) | File di test |
|---|---|---|
| P1 | `programs/[id]/route.ts` (50%) | `program-detail.test.ts` (estendere PUT/DELETE e rami di stato) |
| P1 | `programs/[id]/workouts/[workoutId]/exercises/route.ts` (0%), `…/[exerciseId]/route.ts` (37%), `…/reorder/route.ts` (0%) | `workout-exercises.test.ts` (nuovo) |
| P1 | `programs/[id]/complete` (0%), `review` (0%), `progress` (60%), `copy-first-week` (79%) | `program-lifecycle.test.ts` (nuovo) + `program-progress.test.ts` |
| P1 | `programs/[id]/reports/route.ts` (0%, 121 righe) | `program-reports.test.ts` (nuovo) |
| P1 | `auth/activate`, `auth/force-change-password`, `auth/me` (0%) | `auth-routes.test.ts` (nuovo) |
| P1 | `users/[id]/route.ts` (69%), `users/[id]/activate` (0%), `users/[id]/deactivate` (53%) | `users.test.ts`, `users-activation.test.ts` (nuovo) |
| P2 | `admin/programs/[id]/override` (0%), `admin/trainees/[traineeId]/reassign` (0%) | `admin-actions.test.ts` (nuovo) |
| P2 | `movement-patterns/[id]` (17%), `…/archive` (0%), `muscle-groups/[id]` (17%), `…/archive` (0%), `movement-pattern-colors` (0%) | `reference-data.test.ts` |
| P2 | `weeks/[id]` (0%), `programs/[id]/workouts/[workoutId]/trainee-notes` (0%), `trainee/workouts/[id]/recap` (0%) | `weeks.test.ts`, `trainer-trainee-notes.test.ts`, `trainee-workout-detail.test.ts` |
| P3 | Rami mancanti: `exercises/[id]` (B70), `personal-records/[id]` (B76), `trainee/workouts/[id]` (B66), `users/[id]/reports/planned-training-sets` (B60), `trainer/trainees/[id]/notes` (B67), `admin/reports/global` (B50), `trainee/active-program`, `movement-patterns`, `muscle-groups` | file esistenti |
| — | `health/route.ts` | `health.test.ts` (banale, 1–2 casi) |

`sentry-example-api` è escluso dalla coverage (§4.5).

### 8.2 `src/lib/**` (oggi L67.2 / B62.5 / F66.0)

| File | Oggi | Cosa |
|---|---|---|
| `auth.ts` | 22.8 | Fase 2 |
| `program-pdf-export.ts` | 39.7 | estendere `program-pdf-export.test.ts`: tutti i `WeightType`, settimane test/deload, note, programma vuoto. `jspdf` sostituito da un mock che registra le chiamate `text`/`autoTable` |
| `program-status.ts` | 0 | nuovo `program-status.test.ts`: `getProgramCompletionSnapshot` e `getEffectiveProgramStatus` per draft/active/completed e per i casi limite (0 settimane, tutte completate, date passate) |
| `trainee-program-data.ts` | 69.8 | estendere `tests/unit/lib/trainee-program-data.test.ts` sui rami mancanti |
| `calculations.ts` | B63.5 | rami di `calculateEffectiveWeight`: `percentage_previous` ricorsivo con catena interrotta, 1RM assente, `percentage_rm` con RPE ai limiti, controllo delle chiavi `CALCULATION_ERROR_KEYS.*` |
| `date-format.ts` | B74.7 | rami null o data non valida + Fase 2 §6.4 |
| `sync-user-metadata.ts` | B16.7 | utente non trovato → warn senza eccezione; errore di update → eccezione; unione dei metadata. Da riscrivere dopo la Fase H |
| `useSwipe.ts` | B82 | ok, solo i rami mancanti |
| `i18n/provider.tsx`, `logger.ts`, `i18n/client.ts` | — | rami semplici; `provider.tsx` con un render test minimo |
| `prisma.ts`, `supabase-client.ts`, `supabase-server.ts` | 0 | codice di sola configurazione: **esclusi** dalla coverage (`exclude`), con motivo scritto in un commento nel config |

### 8.3 `src/schemas/**` (oggi L79.5 / B68.2 / F80.8)

In `tests/unit/schemas.test.ts` (o file per schema se supera circa 1200 righe):
- `trainer-trainee-notes.ts` (L73.9): tutti i refine e transform.
- `personal-record.ts`, `program.ts` (B50): i rami opzionali (campo assente o presente, limiti min/max).
- `workout-exercise.ts` (B76): varianti di `WeightType` × campi obbligatori condizionali.

Regola: un test per ogni regola che può fallire, più i valori limite (come già indicato nella skill).

### 8.4 Fatto quando

- Soglie finali in `vitest.config.ts`:
  ```ts
  'src/lib/**':     { lines: 80, statements: 80, functions: 80, branches: 80 },
  'src/schemas/**': { lines: 80, statements: 80, functions: 80, branches: 80 },
  'src/app/api/**': { lines: 80, statements: 80, functions: 80, branches: 80 },
  ```
- Soglia globale alzata al valore raggiunto (atteso intorno al 45–50%).
- Skill `zero-cento-testing`, sezione Coverage Rules: descrive il doppio livello; la regola "aggiungi il componente a `coverage.include`" sparisce, perché ora si include tutto `src/`.

---

## 9. Rischi

| Rischio | Mitigazione |
|---|---|
| `vitest-mock-extended` non compatibile con Vitest 4 | Verifica all'inizio della Fase 1; se non va, factory scritta a mano e tipizzata con `vi.fn<PrismaClient[...]>` |
| La migrazione dei 29 file cambia il comportamento dei test senza volerlo | Un commit per dominio, numero di test invariato, coverage uguale o maggiore a ogni commit |
| Suite più lenta per la coverage su tutto `src/` | Tempi misurati prima e dopo; `coverage.exclude` sui file pesanti non testati se serve |
| La Fase H rompe il login in produzione | Migrazione dei metadata prima del deploy; lettura con fallback su Prisma; rollout secondo `git-pr-workflow` (prima staging) |
| Soglie per glob di Vitest calcolate in aggregato e non per file | Accettato: l'obiettivo è per gruppo. `perFile` si valuta in futuro |

## 10. Criteri di accettazione complessivi

- [ ] `npm run test:unit -- --run --coverage` con codice 0 su Node 20 e 26
- [ ] CI verde in ogni PR
- [ ] `lib/`, `schemas/` e `api/` ≥ 80% su tutte e 4 le metriche
- [ ] `auth.ts` ≥ 95%, `middleware.ts` ≥ 80%
- [ ] 0 `as any` e 0 `require()` in `tests/`
- [ ] 0 `toHaveBeenCalled()` senza argomenti su chiamate Prisma o auth in `tests/integration`
- [ ] Skill `zero-cento-testing` aggiornata (mock helper, soglie, nota WSL, regola `toHaveBeenCalledWith`)
- [ ] `implementation-docs/CHANGELOG.md` aggiornata in ogni fase
