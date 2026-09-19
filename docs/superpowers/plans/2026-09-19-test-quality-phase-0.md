# Test Quality — Fase 0 (suite e CI verdi) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere verdi la suite Vitest in locale (con qualsiasi Node ≥20) e il job `unit-test` della CI, e sostituire la lista a mano di 37 file nella coverage con la misurazione di tutto `src/` a due livelli di soglia.

**Architecture:** Quattro interventi indipendenti nello stesso branch: (1) uno `Storage` in memoria installato in `tests/unit/setup.ts` quando quello dell'ambiente non è utilizzabile, che neutralizza il `localStorage` nativo di Node ≥25; (2) due test riallineati al comportamento attuale dei componenti; (3) limite ai worker di Vitest per il filesystem lento di WSL; (4) nuova configurazione della coverage con `include: ['src/**']`, `exclude` mirato e soglie per glob impostate alla baseline misurata.

**Tech Stack:** Vitest 4.1.4 (jsdom, pool forks), `@vitest/coverage-v8`, Testing Library, Next.js 15 App Router, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-19-test-quality-design.md` (§4 Fase 0)

## Global Constraints

- Node ≥20 (`.nvmrc` = `20`, `package.json` `engines.node` = `>=20.0.0`). La CI usa Node 20; in locale si usa anche Node 26, quindi ogni soluzione deve funzionare su entrambi.
- Branch di lavoro: `chore/test-quality`, creato da `development`. Integrazione con merge fast-forward secondo lo skill `git-pr-workflow`: niente Pull Request.
- I test seguono lo skill `zero-cento-testing`: import ESM statici, mai `require()`; niente ri-dichiarazione dei mock già presenti in `tests/unit/setup.ts`; query nell'ordine `getByRole` → `getByLabelText` → `getByText` → `getByTestId`.
- Comando della suite: `npm run test:unit -- --run`. File singolo: `npx vitest run <percorso>`.
- Su Node ≥25 serve `NODE_OPTIONS=--no-experimental-webstorage` **finché il Task 1 non è completato**; dopo il Task 1 non serve più e non va aggiunto agli script.
- Il repo sta in `/mnt/c` sotto WSL: la suite completa con coverage impiega circa 8–10 minuti. Non interpretare la lentezza come un blocco.
- `implementation-docs/CHANGELOG.md` va aggiornata (regola di `CLAUDE.md`): una voce alla fine della fase, nel Task 6.
- **Nessuna modifica al codice di produzione in questa fase**, con l'unica eccezione prevista dal Task 4 (import approfonditi al posto del barrel), che è facoltativa ed è isolata in un commit a sé.

---

## File Structure

| File | Ruolo | Azione |
|---|---|---|
| `tests/unit/setup.ts` | setup globale dei test unitari: mock condivisi | Modificare: aggiungere lo `Storage` in memoria e il `beforeEach` che lo azzera |
| `tests/unit/workout-recap-panel.test.tsx` | test di `WorkoutRecapPanel` | Modificare: allineare le asserzioni a `buildExerciseSpec`, aggiungere i casi dei rami |
| `tests/unit/records-exercise-autocomplete.test.tsx` | test del campo esercizio nella modale dei massimali | Riscrivere: import statico, barrel sostituito da mock, `fetch` per URL |
| `tests/unit/trainee-workout-focus.test.tsx` | test della modalità focus dell'allenamento | Modificare: barrel sostituito da mock, import statico |
| `vitest.config.ts` | configurazione di Vitest e della coverage | Modificare: `maxWorkers`, `coverage.include`/`exclude`/`thresholds` |
| `.claude/skills/zero-cento-testing/SKILL.md` | regole di test del progetto | Modificare: sezioni Coverage Rules e Node Version |
| `implementation-docs/CHANGELOG.md` | registro delle modifiche | Modificare: voce di fine fase |

---

### Task 1: `localStorage` utilizzabile con qualsiasi versione di Node

Node ≥25 espone un `localStorage` nativo (webstorage) che copre quello di jsdom e che senza `--localstorage-file` lancia un errore all'accesso. In `tests/unit/trainee-workout-focus.test.tsx:131` il `beforeEach` chiama `localStorage.clear()` e fallisce con `TypeError: Cannot read properties of undefined (reading 'clear')`, facendo cadere 29 test.

**Files:**
- Modify: `tests/unit/setup.ts` (in fondo al file, dopo i `vi.mock` esistenti)
- Test: `tests/unit/setup-storage.test.ts` (nuovo)

**Interfaces:**
- Consumes: niente
- Produces: `globalThis.localStorage` e `globalThis.sessionStorage` sempre utilizzabili nei test, azzerati prima di ogni test. Nessun export: è un effetto del setup.

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `tests/unit/setup-storage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('test setup: web storage', () => {
    it('exposes a usable localStorage', () => {
        expect(typeof localStorage.clear).toBe('function')
        localStorage.setItem('k', 'v')
        expect(localStorage.getItem('k')).toBe('v')
        expect(localStorage.length).toBe(1)
        localStorage.removeItem('k')
        expect(localStorage.getItem('k')).toBeNull()
    })

    it('exposes a usable sessionStorage', () => {
        sessionStorage.setItem('k', 'v')
        expect(sessionStorage.getItem('k')).toBe('v')
    })

    it('starts every test with an empty localStorage', () => {
        expect(localStorage.length).toBe(0)
        localStorage.setItem('leak', '1')
    })

    it('does not leak storage between tests', () => {
        expect(localStorage.getItem('leak')).toBeNull()
        expect(localStorage.length).toBe(0)
    })

    it('exposes the same storage on window and globalThis', () => {
        localStorage.setItem('shared', '1')
        expect(window.localStorage.getItem('shared')).toBe('1')
    })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run tests/unit/setup-storage.test.ts`

Su Node ≥25 atteso: FAIL con `TypeError: Cannot read properties of undefined (reading 'clear')`.
Su Node 20 atteso: il primo test passa (jsdom fornisce `localStorage`), mentre `does not leak storage between tests` FALLISCE, perché oggi non esiste nessun `beforeEach` che azzera. Almeno un test deve fallire: se passano tutti, fermarsi e capire perché prima di proseguire.

- [ ] **Step 3: Implementare lo `Storage` in memoria nel setup**

In fondo a `tests/unit/setup.ts` (l'import di `beforeEach` va aggiunto alla riga 2: `import { vi, beforeEach } from 'vitest'`):

```ts
// Node >= 25 ships a native localStorage that shadows jsdom's and throws on
// access unless --localstorage-file is set. Install an in-memory Storage
// whenever the ambient one is missing or unusable, so tests behave the same
// on Node 20 (CI) and Node 26 (local).
function createMemoryStorage(): Storage {
    let store = new Map<string, string>()
    return {
        get length() {
            return store.size
        },
        clear() {
            store = new Map()
        },
        getItem(key: string) {
            return store.has(key) ? store.get(key)! : null
        },
        key(index: number) {
            return Array.from(store.keys())[index] ?? null
        },
        removeItem(key: string) {
            store.delete(key)
        },
        setItem(key: string, value: string) {
            store.set(key, String(value))
        },
    } as Storage
}

function isUsableStorage(candidate: unknown): boolean {
    try {
        const storage = candidate as Storage | undefined
        if (!storage || typeof storage.clear !== 'function') return false
        storage.setItem('__probe__', '1')
        storage.removeItem('__probe__')
        return true
    } catch {
        return false
    }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
    if (!isUsableStorage((globalThis as Record<string, unknown>)[name])) {
        const storage = createMemoryStorage()
        Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true })
        if (typeof window !== 'undefined' && window !== (globalThis as unknown as Window)) {
            Object.defineProperty(window, name, { value: storage, configurable: true, writable: true })
        }
    }
}

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
})
```

`isUsableStorage` fa una prova di scrittura vera: su Node ≥25 il getter esiste ma l'accesso lancia un errore, quindi il solo controllo di `typeof` non basta.

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npx vitest run tests/unit/setup-storage.test.ts`
Atteso: PASS, 5 test.

- [ ] **Step 5: Verificare che i 29 test caduti tornino verdi**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx`
Atteso: PASS, 29 test, nessun `NODE_OPTIONS` sulla riga di comando.

Se restano rossi per un motivo diverso dal `localStorage` (per esempio un'asserzione non aggiornata segnalata dal lavoro sul tipo postural), annotare il nome dei test e fermarsi: non è materia di questo task, va riportato prima di andare avanti.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/setup.ts tests/unit/setup-storage.test.ts
git commit -m "test(setup): install in-memory web storage for Node >= 25

Node 25 ships a native localStorage that shadows jsdom's and throws
unless --localstorage-file is set, breaking 29 tests locally. Install
an in-memory Storage when the ambient one is unusable and clear it
before each test."
```

---

### Task 2: Allineare `workout-recap-panel.test.tsx` a `buildExerciseSpec`

`tests/unit/workout-recap-panel.test.tsx:88` si aspetta `3 × 5 × 120 kg`. `buildExerciseSpec` (`src/components/WorkoutRecapPanel.tsx:21-33`) produce invece `targetSets x reps`, `<peso>kg` e `@RPE <n>` uniti da ` · `. Il formato è cambiato nel commit `c72d54b`. Le branch del file sono al 59.6%: i casi nuovi coprono i rami del peso e dell'RPE.

**Files:**
- Modify: `tests/unit/workout-recap-panel.test.tsx` (fixture `mockRecapResponse` alle righe 25-52, test `fetches recap data when panel is expanded the first time` alle righe 73-97)
- Test: lo stesso file

**Interfaces:**
- Consumes: `WorkoutRecapPanel` da `@/components/WorkoutRecapPanel`, con la prop `workoutId: string`; i dati dell'esercizio nella risposta seguono `ExerciseRecapItem` (campi usati: `id`, `exerciseName`, `exerciseType`, `restTime`, `isWarmup`, `isJumpSet`, `isSuperSet`, `targetSets`, `reps`, `effectiveWeight`, `targetRpe`, `completedSets`, `status`, `actualRpe`, `exerciseNote`, `sets`).
- Produces: niente per gli altri task.

- [ ] **Step 1: Verificare il formato prodotto dal componente**

Run: `sed -n 15,35p src/components/WorkoutRecapPanel.tsx`

Atteso: `parts.join(' · ')` con `${targetSets} x ${reps}`, `${formatWeightValue(effectiveWeight)}kg` e `@RPE ${targetRpe}`. Se il codice nel frattempo è diverso, le stringhe attese nei passi seguenti vanno adattate a quello che il codice produce davvero, non il contrario.

- [ ] **Step 2: Correggere l'asserzione e aggiungere i casi dei rami**

Nella fixture `mockRecapResponse` aggiungi `targetRpe: 8` all'esercizio `we-1`, subito dopo `effectiveWeight: 120`.

Nel test `fetches recap data when panel is expanded the first time`, sostituisci la riga 88:

```ts
        expect(screen.getByText('3 x 5 · 120kg · @RPE 8')).toBeInTheDocument()
```

Poi aggiungi due test nuovi in fondo al `describe`:

```ts
    it('omits weight and rpe from the spec when they are absent', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    exercises: [
                        {
                            ...mockRecapResponse.data.exercises[0],
                            effectiveWeight: 0,
                            targetRpe: null,
                        },
                    ],
                    workoutNote: null,
                },
            }),
        }) as unknown as typeof fetch

        const user = userEvent.setup()
        render(<WorkoutRecapPanel workoutId="w1" />)

        await user.click(screen.getByRole('button', { name: 'Workout Recap' }))
        await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
        expect(screen.getByText('3 x 5')).toBeInTheDocument()
    })

    it('formats a fractional weight with one decimal', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    exercises: [
                        {
                            ...mockRecapResponse.data.exercises[0],
                            effectiveWeight: 102.5,
                            targetRpe: null,
                        },
                    ],
                    workoutNote: null,
                },
            }),
        }) as unknown as typeof fetch

        const user = userEvent.setup()
        render(<WorkoutRecapPanel workoutId="w1" />)

        await user.click(screen.getByRole('button', { name: 'Workout Recap' }))
        await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
        expect(screen.getByText('3 x 5 · 102.5kg')).toBeInTheDocument()
    })
```

- [ ] **Step 3: Eseguire il file di test**

Run: `npx vitest run tests/unit/workout-recap-panel.test.tsx`
Atteso: PASS, 9 test (7 esistenti + 2 nuovi).

Se il test `fetches recap data…` fallisce ancora su `2/3` o sulle etichette `trainer:editProgram.*`, l'asserzione va confrontata con il DOM stampato dall'errore e allineata a quello che il componente rende davvero.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/workout-recap-panel.test.tsx
git commit -m "test(recap): match current buildExerciseSpec format

The panel renders '3 x 5 · 120kg · @RPE 8' since c72d54b; the test
still expected the old '3 × 5 × 120 kg'. Also cover the branches
where weight or target RPE are absent."
```

---

### Task 3: Rendere veloce e deterministico `records-exercise-autocomplete.test.tsx`

Il test va in timeout. Causa misurata il 2026-09-19: il componente importa `PersonalRecordsExplorer`, `RPEOneRMTable` e `SkeletonTable` dal barrel `@/components` (`src/app/trainer/trainees/[id]/records/_content.tsx:5`); il barrel carica tutti i 53 componenti, MUI e recharts compresi, e sotto jsdom l'import impiega circa 48 secondi. Con il barrel sostituito da un mock lo stesso import scende a circa 3,9 secondi. In più il test usa un `await import()` dinamico, un `fetch` finto definito a livello di modulo e una risposta priva di `data.user`, quindi `trainee` resta `null`.

**Files:**
- Rewrite: `tests/unit/records-exercise-autocomplete.test.tsx`
- Riferimento: `src/app/trainer/trainees/[id]/records/_content.tsx` (`fetchData` alle righe 79-112, bottone "Aggiungi Massimale" alla riga 284, `AutocompleteSearch` con `label={t('personalRecords.exercise')}` alle righe 335-346)

**Interfaces:**
- Consumes: `TraineeRecordsContent` (default export, nessuna prop; legge l'id da `useParams`). Chiamate fetch in `fetchData`: `/api/users/${traineeId}` → `{ data: { user } }`; `/api/personal-records?traineeId=${traineeId}` → `{ data: { items } }`; `/api/exercises?limit=500` → `{ data: { items } }`.
- Produces: `mockFetchByUrl`, uno schema di `fetch` finto instradato per URL, riusato nelle fasi successive. Resta locale a questo file finché la Fase 1 non lo sposta in `tests/helpers/`.

- [ ] **Step 1: Riscrivere il file di test**

Sostituisci l'intero contenuto di `tests/unit/records-exercise-autocomplete.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The page pulls PersonalRecordsExplorer, RPEOneRMTable and SkeletonTable from
// the '@/components' barrel, which drags in MUI and recharts: importing it for
// real costs ~48s under jsdom. Stub the barrel with just what the page uses.
vi.mock('@/components', () => ({
    PersonalRecordsExplorer: () => <div data-testid="records-explorer" />,
    RPEOneRMTable: () => <div data-testid="rpe-table" />,
    SkeletonTable: () => <div data-testid="skeleton-table" />,
}))

vi.mock('next/navigation', () => ({
    useParams: () => ({ id: 'trainee-1' }),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
    usePathname: () => '/trainer/trainees/trainee-1/records',
    useSearchParams: () => new URLSearchParams(),
    redirect: vi.fn(),
}))

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

import TraineeRecordsContent from '@/app/trainer/trainees/[id]/records/_content'

const trainee = { id: 'trainee-1', firstName: 'Mario', lastName: 'Rossi' }
const exercises = [
    { id: 'ex-1', name: 'Panca Piana', type: 'fundamental' },
    { id: 'ex-2', name: 'Squat', type: 'fundamental' },
]

function mockFetchByUrl() {
    return vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.startsWith('/api/users/')) {
            return { ok: true, json: async () => ({ data: { user: trainee } }) } as Response
        }
        if (url.startsWith('/api/personal-records')) {
            return { ok: true, json: async () => ({ data: { items: [] } }) } as Response
        }
        if (url.startsWith('/api/exercises')) {
            return { ok: true, json: async () => ({ data: { items: exercises } }) } as Response
        }
        throw new Error(`Unexpected fetch call: ${url}`)
    })
}

describe('TraineeRecordsContent modal exercise field', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
        global.fetch = mockFetchByUrl() as unknown as typeof fetch
    })

    afterEach(() => {
        global.fetch = originalFetch
        vi.clearAllMocks()
    })

    it('renders an input field (AutocompleteSearch) not a native select for exercise', async () => {
        const { container } = render(<TraineeRecordsContent />)

        const addButton = await screen.findByRole('button', { name: /aggiungi massimale/i })
        fireEvent.click(addButton)

        expect(container.querySelector('select')).toBeNull()

        const exerciseInput = screen.getByRole('combobox')
        expect(exerciseInput.tagName).toBe('INPUT')
    })

    it('loads the trainee and the exercise list on mount', async () => {
        render(<TraineeRecordsContent />)

        await waitFor(() => expect(screen.getByText('Mario Rossi')).toBeInTheDocument())

        expect(global.fetch).toHaveBeenCalledWith('/api/users/trainee-1')
        expect(global.fetch).toHaveBeenCalledWith('/api/personal-records?traineeId=trainee-1')
        expect(global.fetch).toHaveBeenCalledWith('/api/exercises?limit=500')
    })
})
```

Note per chi implementa:
- `AutocompleteSearch` espone il suo input con `role="combobox"` (vedi `tests/unit/AutocompleteSearch.test.tsx:19`): è una query migliore di `getByLabelText` su una chiave i18n.
- Il `vi.mock('next/navigation')` locale serve perché il mock globale in `setup.ts` restituisce `useParams: () => ({})`, mentre qui serve l'id `trainee-1`. È l'unica ri-dichiarazione ammessa, e il commento nel file deve dirlo.
- Il timeout personalizzato di 15000 ms sparisce: con il barrel sostituito il test sta sotto i 5 secondi di default.

- [ ] **Step 2: Eseguire il test e misurare il tempo**

Run: `npx vitest run tests/unit/records-exercise-autocomplete.test.tsx`
Atteso: PASS, 2 test, riga `Duration` con `tests` sotto i 10 secondi.

Se resta sopra, controllare quale import pesa ancora con:
`npx vitest run tests/unit/records-exercise-autocomplete.test.tsx --reporter=verbose` e la sezione `transform`/`import` del riepilogo.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/records-exercise-autocomplete.test.tsx
git commit -m "test(records): stub components barrel to fix 15s timeout

The page imports three components from '@/components', which loads MUI
and recharts: ~48s under jsdom. Stub the barrel, use a static import
and route the fetch mock by URL so the trainee actually loads."
```

---

### Task 3-bis: Togliere il timeout dell'import pesante anche in `trainee-workout-focus.test.tsx`

Misurato il 2026-09-19 su `development`: con il `localStorage` già sistemato (Task 1), restano due test rossi in questo file. Il primo, `shows only the current exercise card`, va in timeout a 5 secondi; il secondo, `advances to the next exercise via the bottom-nav Next button`, fallisce di conseguenza con `Found multiple elements with the role "button" and name /next|avanti/i`, perché il DOM del test andato in timeout resta montato. Con `--testTimeout=30000` tutti e 29 i test passano: non è un difetto del componente. La causa è la stessa del Task 3: `src/app/trainee/workouts/[id]/_content.tsx:10` importa `RPESelector`, `SkeletonDetail` e `WeekTypeBanner` dal barrel `@/components`.

**Files:**
- Modify: `tests/unit/trainee-workout-focus.test.tsx` (blocco dei `vi.mock` righe 8-22; `renderContent` righe 133-141)

**Interfaces:**
- Consumes: `WorkoutDetailContent` (default export di `@/app/trainee/workouts/[id]/_content`, nessuna prop)
- Produces: niente

- [ ] **Step 1: Verificare il comportamento attuale**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx`
Atteso: 2 test rossi (timeout e query ambigua).

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx --testTimeout=30000`
Atteso: 29 test verdi. Questo conferma che si tratta solo di tempo di import.

- [ ] **Step 2: Sostituire il barrel con un mock e usare l'import statico**

Aggiungi ai `vi.mock` in cima al file:

```tsx
// '@/components' loads all 53 components (MUI, recharts): ~48s under jsdom.
vi.mock('@/components', () => ({
    RPESelector: ({ value }: { value?: number }) => <div data-testid="rpe-selector">{value ?? ''}</div>,
    SkeletonDetail: () => <div data-testid="skeleton-detail" />,
    WeekTypeBanner: ({ weekType }: { weekType?: string }) => <div data-testid="week-type-banner">{weekType}</div>,
}))
```

Prima di scrivere lo stub, controllare come il componente usa questi tre (`grep -n "RPESelector\|SkeletonDetail\|WeekTypeBanner" "src/app/trainee/workouts/[id]/_content.tsx"`): se un test si appoggia al loro contenuto (per esempio l'etichetta del tipo di settimana), lo stub deve renderlo. Se invece lo stub rompe un test esistente, quel componente **non** va sostituito: si toglie dalla fabbrica e si accetta il costo del suo import.

Poi, in `renderContent`, sostituire l'`await import()` con l'import statico in cima al file:

```tsx
import WorkoutDetailContent from '@/app/trainee/workouts/[id]/_content'

const renderContent = async () => {
    const utils = render(<WorkoutDetailContent />)
    await screen.findByText('Bench Press')
    return utils
}
```

- [ ] **Step 3: Eseguire il file senza timeout personalizzati**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx`
Atteso: PASS, 29 test, con la riga `Duration` che mostra `tests` sotto i 20 secondi.

- [ ] **Step 4: Rendere non ambigua la query del bottone Next**

Anche con il timeout risolto, `getByRole('button', { name: /next|avanti/i })` è fragile: basta un secondo elemento con quel nome accessibile per romperla. Nel test `advances to the next exercise…` e negli altri che cercano quel bottone, restringere la ricerca alla barra di navigazione:

```tsx
const bottomNav = screen.getByRole('navigation')
const nextBtn = within(bottomNav).getByRole('button', { name: 'workouts.next' })
```

`within` è già importato alla riga 2. Il nome accessibile è la chiave i18n, perché il mock di `react-i18next` nel setup restituisce la chiave stessa: quindi la corrispondenza esatta `'workouts.next'` è preferibile all'espressione regolare.

- [ ] **Step 5: Eseguire di nuovo**

Run: `npx vitest run tests/unit/trainee-workout-focus.test.tsx`
Atteso: PASS, 29 test.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/trainee-workout-focus.test.tsx
git commit -m "test(focus): stub components barrel and disambiguate nav query

The page imports three components from '@/components', which loads MUI
and recharts and blew the 5s timeout on the first render; the second
failure was fallout from the timed-out test's DOM staying mounted."
```

---

### Task 4 (facoltativo): Import approfonditi al posto del barrel nella pagina dei massimali

Lo stesso barrel rallenta anche il bundle di produzione: `src/app/trainer/trainees/[id]/records/_content.tsx` tira dentro MUI e recharts per usare tre componenti. Questo task è **facoltativo** e va fatto solo se `npm run build` resta verde; se crea qualunque attrito, si salta e si lascia il mock del Task 3.

**Files:**
- Modify: `src/app/trainer/trainees/[id]/records/_content.tsx:5`
- Test: `tests/unit/records-exercise-autocomplete.test.tsx` (già scritto nel Task 3)

**Interfaces:**
- Consumes: `PersonalRecordsExplorer`, `RPEOneRMTable`, `SkeletonTable` da `@/components`
- Produces: gli stessi tre componenti importati dai rispettivi file

- [ ] **Step 1: Verificare i percorsi reali dei tre componenti**

Run: `grep -nE "PersonalRecordsExplorer|RPEOneRMTable|SkeletonTable" src/components/index.ts`
Atteso: tre righe che indicano il file di origine e se l'export è default o nominale.

- [ ] **Step 2: Sostituire l'import**

In `src/app/trainer/trainees/[id]/records/_content.tsx`, al posto della riga 5:

```ts
import PersonalRecordsExplorer from '@/components/PersonalRecordsExplorer'
import RPEOneRMTable from '@/components/RPEOneRMTable'
import SkeletonTable from '@/components/SkeletonTable'
```

I nomi e la forma degli import (default o `{ … }`) vanno presi da quello che ha stampato lo Step 1.

- [ ] **Step 3: Aggiornare il mock del test**

In `tests/unit/records-exercise-autocomplete.test.tsx` il `vi.mock('@/components', …)` diventa un mock per ciascun file:

```tsx
vi.mock('@/components/PersonalRecordsExplorer', () => ({ default: () => <div data-testid="records-explorer" /> }))
vi.mock('@/components/RPEOneRMTable', () => ({ default: () => <div data-testid="rpe-table" /> }))
vi.mock('@/components/SkeletonTable', () => ({ default: () => <div data-testid="skeleton-table" /> }))
```

- [ ] **Step 4: Verificare test, tipi e build**

Run: `npx vitest run tests/unit/records-exercise-autocomplete.test.tsx && npm run type-check && npm run build`
Atteso: test PASS, `type-check` senza errori, build completata.

Se la build fallisce, `git checkout -- src/app/trainer/trainees/[id]/records/_content.tsx`, ripristinare il mock del barrel e saltare questo task.

- [ ] **Step 5: Commit**

```bash
git add "src/app/trainer/trainees/[id]/records/_content.tsx" tests/unit/records-exercise-autocomplete.test.tsx
git commit -m "perf(records): import components directly instead of barrel

The '@/components' barrel pulls MUI and recharts into a page that uses
three components."
```

---

### Task 5: Coverage su tutto `src/`, soglie a due livelli e limite ai worker

Oggi `vitest.config.ts` misura solo 37 file scelti a mano, con soglie all'80%: le branch sono al 76.2%, quindi la CI fallisce. Inoltre, con la coverage attiva su `/mnt/c`, il pool a 16 worker produce `Failed to start forks worker: Timeout waiting for worker to respond` su una decina di file.

**Files:**
- Modify: `vitest.config.ts` (blocco `test.coverage`, righe 8-46; nuova chiave `test.maxWorkers`)

**Interfaces:**
- Consumes: niente
- Produces: `coverage/coverage-summary.json` (reporter `json-summary`), letto dai task delle fasi successive per alzare le soglie.

- [ ] **Step 1: Misurare la baseline**

Run:
```bash
npx vitest run --maxWorkers=4 \
  --coverage --coverage.reportOnFailure \
  --coverage.include='src/**/*.{ts,tsx}' \
  --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 \
  --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 \
  --coverage.reporter=json-summary --coverage.reporter=text-summary
```

Atteso: tutti i test verdi (i Task 1-3 sono già fatti) e un riepilogo di coverage. Se ci sono test rossi, fermarsi: le soglie non si calcolano su una suite rossa.

- [ ] **Step 2: Calcolare i valori per glob**

Run:
```bash
node -e "
const s=require('./coverage/coverage-summary.json');
const root=process.cwd()+'/';
const groups={'src/lib/':0,'src/schemas/':0,'src/app/api/':0};
const out={};
for(const g of Object.keys(groups)){
  const rows=Object.entries(s).filter(([k])=>k!=='total'&&k.replace(root,'').startsWith(g));
  out[g]=Object.fromEntries(['lines','statements','functions','branches'].map(m=>{
    const c=rows.reduce((a,[,v])=>a+v[m].covered,0), t=rows.reduce((a,[,v])=>a+v[m].total,0);
    return [m, Math.floor(100*c/t)];
  }));
}
out.total=Object.fromEntries(['lines','statements','functions','branches'].map(m=>[m,Math.floor(s.total[m].pct)]));
console.log(JSON.stringify(out,null,2));
"
```

Atteso: un oggetto JSON con quattro gruppi di valori interi. **Questi numeri, non altri, vanno scritti nel config allo Step 3.** Riferimento del 2026-09-19 prima dei Task 1-3 (per capire se il risultato è plausibile, non da copiare): totale L36/S35/F28/B33, `src/lib/**` L67/S67/F66/B62, `src/schemas/**` L79/S79/F80/B68, `src/app/api/**` L57/S56/F63/B54.

- [ ] **Step 3: Scrivere la nuova configurazione**

In `vitest.config.ts`, dentro `test`, aggiungi prima di `coverage`:

```ts
        // /mnt/c under WSL is slow: 16 workers + coverage starves the pool and
        // produces "Failed to start forks worker" timeouts.
        maxWorkers: 4,
```

e sostituisci l'intero blocco `coverage` con:

```ts
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'json-summary', 'html'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/app/sentry-example-page/**',
                'src/app/api/sentry-example-api/**',
                'src/app/components-showcase/**',
                'src/instrumentation.ts',
                'src/instrumentation-client.ts',
                'src/sw.ts',
                'src/app/layout.tsx',
                'src/**/loading.tsx',
                'src/lib/prisma.ts',
                'src/lib/supabase-client.ts',
                'src/lib/supabase-server.ts',
                'src/**/*.d.ts',
            ],
            thresholds: {
                // Baseline floors measured on development, 2026-09-19. They only go
                // up: every phase raises them to the level it reaches.
                lines: 36, statements: 35, functions: 28, branches: 33,
                'src/lib/**': { lines: 67, statements: 67, functions: 65, branches: 62 },
                'src/schemas/**': { lines: 79, statements: 79, functions: 80, branches: 68 },
                'src/app/api/**': { lines: 57, statements: 56, functions: 63, branches: 54 },
            },
        },
```

I valori qui sopra sono la baseline misurata il 2026-09-19 su `development` (856 test, 4 rossi), **prima** dei Task 1-3-bis. Dopo quei task la coverage sale un po', perché test che prima fallivano ora eseguono il loro codice: lo Step 2 ricalcola i numeri e quelli vanno scritti al posto di questi, mai sotto. Se un valore ricalcolato risultasse più basso, significa che un test è stato perso per strada: fermarsi e capire quale.

Le tre esclusioni `prisma.ts`, `supabase-client.ts` e `supabase-server.ts` riguardano file di sola costruzione dei client, senza rami da verificare; il commento nel config deve dirlo in una riga.

Attenzione: le soglie per glob di Vitest si calcolano **in aggregato** sui file che corrispondono, non file per file. È voluto: l'obiettivo della spec è per gruppo.

- [ ] **Step 4: Verificare che le soglie passino**

Run: `npm run test:unit -- --run --coverage`
Atteso: exit code 0, nessun messaggio `ERROR: Coverage for … does not meet threshold`.

Se una soglia fallisce di poco, significa che i valori sono stati arrotondati per eccesso: rieseguire lo Step 2 e usare `Math.floor`.

- [ ] **Step 5: Verificare la stabilità del pool**

Run: `for i in 1 2 3; do npm run test:unit -- --run --coverage > /tmp/run-$i.log 2>&1; echo "run $i exit=$?"; grep -c "Failed to start forks worker" /tmp/run-$i.log; done`
Atteso: `exit=0` tre volte e conteggio `0` tre volte (grep stampa `0` quando non trova nulla).

Se compaiono ancora errori del pool, abbassare `maxWorkers` a 2 e ripetere.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts
git commit -m "test(config): measure coverage over all of src with glob thresholds

Replace the hand-picked 37-file include list with src/**, excluding
example and client-construction files. Thresholds are set to the
measured baseline per group (lib, schemas, api) and only go up. Cap
maxWorkers to keep the fork pool alive on WSL."
```

---

### Task 6: Aggiornare la skill dei test e la CHANGELOG

**Files:**
- Modify: `.claude/skills/zero-cento-testing/SKILL.md` (sezione "Coverage Rules"; sezione "Node Version"; tabella "File → Test mapping")
- Modify: `implementation-docs/CHANGELOG.md` (in cima, nuova voce)

**Interfaces:**
- Consumes: la configurazione scritta nel Task 5
- Produces: regole aggiornate per chi scriverà i test delle fasi 1-3

- [ ] **Step 1: Riscrivere la sezione "Coverage Rules" della skill**

Sostituisci il contenuto attuale (che parla dei file elencati in `coverage.include` e della soglia unica dell'80%) con:

```markdown
## Coverage Rules

Coverage is measured over all of `src/` (`coverage.include: ['src/**/*.{ts,tsx}']`).
There is no hand-maintained include list: a new file is measured as soon as it exists.

Two levels of threshold, both enforced in CI:

| Scope | Threshold |
|---|---|
| Global (`src/**`) | current floor, raised by each phase, never lowered |
| `src/lib/**`, `src/schemas/**`, `src/app/api/**` | 80% target (lines, statements, functions, branches) |

Glob thresholds are aggregated across the matching files, not per file.

When coverage rises, raise the floor in `vitest.config.ts` in the same commit:
a threshold that lags behind lets a regression slip through unnoticed.

Files excluded from coverage: sentry examples, components showcase, instrumentation,
service worker, root layout, `loading.tsx` segments, and the client-construction
modules (`src/lib/prisma.ts`, `src/lib/supabase-*.ts`).
```

Nella tabella "File → Test mapping", la riga `New component added to src/components/` perde la parte "AND add to `vitest.config.ts` `coverage.include`": ora basta creare il file di test.

- [ ] **Step 2: Aggiornare la sezione "Node Version" della skill**

Aggiungi in fondo a quella sezione:

```markdown
`tests/unit/setup.ts` installs an in-memory `localStorage`/`sessionStorage` when the
ambient one is unusable, so the suite behaves the same on Node 20 (CI) and Node 25+
(where a native webstorage shadows jsdom's). Never add `--no-experimental-webstorage`
to the npm scripts: the setup covers it.

The suite runs a lot slower when the repo lives under `/mnt/c` on WSL (~8-10 min with
coverage) — clone into the Linux filesystem (`~/`) for a faster loop. `maxWorkers` is
capped in `vitest.config.ts` for the same reason; do not raise it without re-measuring.
```

- [ ] **Step 3: Aggiungere la voce in CHANGELOG**

In cima a `implementation-docs/CHANGELOG.md`, seguendo il formato delle voci già presenti (data, titolo, elenco delle modifiche, file toccati):

```markdown
## 2026-09-19 — Test quality, fase 0: suite e CI verdi

**Perché:** la suite falliva in locale su Node ≥25 (31 test) e la CI non rispettava la
soglia di coverage dell'80% sulle branch (76.2%).

- `tests/unit/setup.ts`: `localStorage`/`sessionStorage` in memoria quando l'ambiente non ne
  fornisce uno utilizzabile, azzerati prima di ogni test
- `tests/unit/workout-recap-panel.test.tsx`: asserzioni allineate al formato attuale di
  `buildExerciseSpec`, più i casi senza peso e senza RPE
- `tests/unit/records-exercise-autocomplete.test.tsx`: barrel `@/components` sostituito da un
  mock (l'import costava ~48s), import statico, fetch instradato per URL
- `vitest.config.ts`: coverage su tutto `src/` con esclusioni mirate, soglie a due livelli
  (globale + per gruppo su lib/schemas/api) e `maxWorkers` limitato per WSL
- `.claude/skills/zero-cento-testing/SKILL.md`: regole di coverage e nota su Node/WSL

**File modificati:** vedi sopra.
```

- [ ] **Step 4: Verifica finale dell'intera fase**

Run: `npm run test:unit -- --run --coverage && npm run lint && npm run type-check`
Atteso: tutti e tre con exit code 0.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/zero-cento-testing/SKILL.md implementation-docs/CHANGELOG.md
git commit -m "docs(tests): update testing skill and changelog for phase 0"
```

- [ ] **Step 6: Integrazione**

La fase finisce quando la CI è verde. Integrazione in `development` secondo lo skill `git-pr-workflow`:

```bash
git checkout development
git pull --ff-only
git merge --ff-only chore/test-quality
git push origin development
```

Prima del push, verificare su GitHub Actions che il job `unit-test` sia verde sul branch. Se `git merge --ff-only` fallisce, `development` è andato avanti: `git checkout chore/test-quality && git rebase development`, rieseguire la suite e ripetere.

---

## Verifica finale della fase

- [ ] `npm run test:unit -- --run` verde su Node 20 (`nvm use 20`) **e** su Node 26, senza `NODE_OPTIONS`
- [ ] `npm run test:unit -- --run --coverage` con exit code 0
- [ ] 3 esecuzioni di fila senza `Failed to start forks worker`
- [ ] `vitest.config.ts` non contiene più la lista a mano di file
- [ ] Job `unit-test` verde in CI
- [ ] CHANGELOG e skill `zero-cento-testing` aggiornate
