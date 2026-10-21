# Esercizi a corpo libero zavorrati — Implementation Plan

> **For agentic workers:** execute with `/feature-implement <this file>` in a fresh
> Sonnet session. Read this header, then one task at a time. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** il trainer marca un esercizio come "a corpo libero zavorrato" (trazioni, dip):
1RM e percentuali RPE usano la tabella trazioni/dip sul carico totale (BW + zavorra),
il trainer vede carico totale + zavorra, il trainee vede solo la zavorra da caricare.

**Architecture:** un flag `Exercise.isBodyweightLoaded`. Tutta la matematica della
tabella sta in `src/lib/calculations.ts`: le funzioni Tuchscherer prendono un parametro
booleano `bodyweightLoaded = false`, quindi i chiamanti esistenti non cambiano. La
conversione da carico totale a zavorra (e la sua etichetta) sta in un nuovo modulo
puro, `src/lib/bodyweight-load.ts`, usato sia dal server (letture trainee) sia dal
client (pagina edit, review, PDF). Il peso corporeo (BW) è l'ultima
`TraineeMeasurement` con `metric = weight`, letta a ogni visualizzazione e mai
salvata. Le misurazioni sono riservate al trainer, quindi le API trainee calcolano la
zavorra sul server e **non inviano mai** BW né carico totale per le righe zavorrate.

**Spec:** `docs/superpowers/specs/2026-10-21-bodyweight-loaded-exercises-design.md`

## Global Constraints

- Before touching code, invoke the matching project skill: `zero-cento-backend`,
  `zero-cento-frontend`, `zero-cento-testing`.
- **Default = Tuchscherer.** Ogni nuovo parametro `bodyweightLoaded` è opzionale con
  default `false`. I test Tuchscherer esistenti in `tests/unit/calculations.test.ts`
  passano senza modifiche.
- **Cosa si salva** (nessuna nuova colonna su `workout_exercises`):
  - `weightType = absolute` su esercizio zavorrato → `weight` = `effectiveWeight` = **zavorra**.
  - tipi percentuale → `effectiveWeight` = **carico totale**.
  - range RPE (`rpeWeightMin/Max`) → **carico totale**, dalla tabella trazioni/dip.
- **Base di `-x%`:** se la riga precedente dello stesso esercizio zavorrato è
  `absolute`, la base è `zavorra + BW`. Se BW manca, `effectiveWeight = null`. Se la
  riga precedente è una percentuale, la base è il suo `effectiveWeight` (già totale).
- **Zavorra** = `roundWeightValue(totale − BW)` (arrotondata per eccesso a 0,5 kg). Se
  il risultato è ≤ 0 → "corpo libero". Range: `min = max(0, roundWeightValue(min − BW))`,
  `max = roundWeightValue(max − BW)`, e se `max ≤ 0` → "corpo libero".
- **Privacy BW:** le misurazioni sono visibili solo al trainer
  (`src/app/api/trainee-measurements/route.ts`, spec `2026-09-21-trainee-measurements`).
  Nelle risposte trainee, per le righe zavorrate: `effectiveWeight = null`,
  `rpeWeightMin = rpeWeightMax = null`, più un campo `ballast` già calcolato. Nessun
  campo BW in nessuna risposta trainee. `weight` resta com'è: per `absolute` è già la
  zavorra, per le percentuali è la percentuale.
- **Serie del trainee:** per le righe zavorrate il kg delle serie è precompilato con la
  zavorra. Per "corpo libero", BW mancante o range il valore è 0.
- Il BW si legge solo se nella risposta c'è almeno una riga zavorrata (come oggi
  `needsPrMap`), con una sola query per risposta.
- Fuori scope: metriche SBD (`program-sbd-metrics.ts`, report planned-training-sets),
  vista workout trainer `/trainer/programs/[id]/workouts/[wId]` (cambia solo tramite
  l'1RM corretto), riconoscimento per nome, zavorra negativa assistita.
- Decimali: il punto ovunque (`17.5 kg`), come gli helper peso esistenti.
- Coverage: le soglie in `vitest.config.ts` (`src/lib/**` 96/96/98/90, `src/app/api/**`
  92/91/95/87, `src/schemas/**` 95/95/96/87) non devono scendere. `bodyweight-load.ts`
  va testato al 100%.
- After each task add an entry at the top of `## [Unreleased]` in
  `implementation-docs/CHANGELOG.md` in the existing format (Italian,
  `### type(scope): titolo (22/10/2026)` + bullet + "Motivo:") and include it in the
  task's commit.
- Commit on the current branch with conventional-commit messages. Do not push.

## Deviations from the spec

- **BW non esposto al trainee.** La spec dice "le API delle viste restituiscono l'ultimo
  BW del trainee". Decisione dell'utente (22/10): le API trainee restituiscono solo la
  zavorra già calcolata e azzerano carico totale e range totale per le righe zavorrate,
  così BW non si ricava nemmeno per sottrazione. Le API trainer (review) restituiscono
  `latestBodyweightKg`. La pagina edit legge BW da `GET /api/trainee-measurements`.
- **Serie trainee precompilate con la zavorra** (decisione dell'utente, 22/10): la spec
  non ne parla.
- **Viste trainee aggiuntive:** anche il recap workout (`api/trainee/workouts/[id]/recap`
  + `WorkoutRecapPanel`) e `GET /api/programs/[id]` (ramo trainee) mostrano il carico, e
  vanno convertiti. La spec non li elenca.
- **Orientamento di `BodyweightRPETable`:** RPE sulle righe e ripetizioni sulle colonne
  (9 × 10), lo stesso orientamento di `RPEOneRMTable`. La spec scrive "10 righe × 9
  colonne" perché trascrive la tabella dell'utente: la tabella resta la stessa, è solo
  trasposta come quella esistente ("stesso stile").
- **`RPEOneRMTable` generalizzata** con props opzionali (chart, livelli, reps, formato,
  note) invece di copiarla. `BodyweightRPETable` è un wrapper sottile.
- **Range zavorra a cavallo dello zero** (non previsto dalla spec): `min` sotto zero
  diventa 0, quindi si mostra `zavorra 0–2 kg`.
- **Migrazione scritta a mano**, non generata con `npm run prisma:migrate`
  (`prisma migrate dev` applica al DB di `.env`, che può essere quello di produzione).
  Nessun comando `migrate` in questo piano; si valida con `npx prisma validate` e
  `npx prisma generate`. Il deploy applica con `npm run prisma:migrate:prod`.
- **Tipo `PersonalRecordInput.exercise` (Task 1).** Il tipo del piano
  `{ isBodyweightLoaded?: boolean | null } | null` dava 13 errori di type-check nelle
  pagine edit e workouts/[wId] (weak type detection). Usato
  `({ isBodyweightLoaded?: boolean | null } & object) | null`.
- **PUT esercizio (Task 2).** `PUT /api/exercises/[id]` valida con `exerciseSchema` (non
  `updateExerciseSchema`), quindi il default `false` azzerava il flag. La route usa
  `exerciseSchema.extend({ isBodyweightLoaded: z.boolean().optional() })`.

## Traps found while exploring

- `updateExerciseSchema = exerciseSchema.partial()`. Con
  `isBodyweightLoaded: z.boolean().default(false)` il `.partial()` avvolge il campo in
  `ZodOptional`, quindi un PUT senza il campo dà `undefined` e non `false`, e Prisma non
  tocca la colonna. Va coperto da un test: un PUT senza il flag non deve azzerarlo.
- `public/locales/{en,it}/trainer.json` iniziano con **BOM UTF-8**; `common.json` no.
  Usare Edit (mai Write/`JSON.stringify` sull'intero file) e verificare con
  `head -c3 <file> | xxd -p`.
- `GET /api/exercises` usa `include` (tutte le colonne scalari): il flag arriva gratis
  nella lista. `GET /api/personal-records` invece fa `exercise: { select: {...} }`: lì
  `isBodyweightLoaded: true` va aggiunto a mano. Le query server che caricano PR
  (`loadTraineeOneRmMap`, review route) usano `select` esplicito.
- Nella route trainee workout (`api/trainee/workouts/[id]/route.ts` ~riga 124) e nel
  recap l'`exercise` usa `select` esplicito: aggiungere `isBodyweightLoaded: true`.
- Nella vista workout trainee il precompilato delle serie e il placeholder usano
  `we.effectiveWeight ?? we.weight ?? 0` (righe ~257, ~270, ~595, ~1342, ~1579). Per
  una riga zavorrata a percentuale il server azzera `effectiveWeight` e `weight` vale
  `75`: il fallback precompilerebbe **75 kg**. Ogni punto va instradato su un solo
  helper `plannedLoadKg(we)`.
- `edit/_content.tsx` per `absolute` mette `effectiveWeight = value`. Per gli zavorrati
  questo resta la zavorra (corretto). Solo la base del `-x%` successivo aggiunge BW.
- `review/_content.tsx` salva in `effectiveWeightByExerciseId` il valore da usare come
  base del `-x%` successivo (fallback). Per una riga zavorrata `absolute` la base deve
  essere `zavorra + BW`, oppure null senza BW.
- jsPDF Helvetica: `≈` non è in WinAnsi (vedi piano rpe-weight-range), `·` (U+00B7) e `–`
  sì. Nei testi PDF usare `·` e `–`, mai `≈`.
- `PersonalRecordsExplorer` prende `calculateOneRepMax?: (weight, reps) => number`
  come prop da tre pagine. La firma cambia (Task 8): aggiornare tutti i chiamanti.

## Review Focus

1. **Numeri di riferimento.** Con il flag, `normalizedOneRM(110, 3, true)` → `121`,
   intensità 5 reps @ 8,5 → `82`, reps 11 → Epley. Senza flag nessun numero cambia.
   Pinned in Task 1.
2. **Zavorra.** Totale 97,5 con BW 80 → `zavorra 17.5 kg`; totale 75 con BW 80 → `corpo
   libero`; BW mancante → nessun numero per il trainee; range 95,5–99 → `15.5–19`.
   Pinned in Task 3.
3. **`-10%` dopo una riga in kg.** Zavorra 20 con BW 80 → base 100 → totale 90, sia
   nel resolver server (Task 4) sia nella pagina edit (Task 11).
4. **Nessuna fuga di BW verso il trainee.** Le quattro letture trainee azzerano
   `effectiveWeight` e il range per le righe zavorrate e non restituiscono BW. Le serie
   sono precompilate con la zavorra. Pinned in Task 9 (API) e Task 10 (UI).
5. **Il flag sopravvive al PUT parziale.** Un update dell'esercizio senza
   `isBodyweightLoaded` non lo azzera. Pinned in Task 2.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/calculations.ts` | tabella trazioni/dip, parametro `bodyweightLoaded`, `recordNormalizedOneRM` | 1 |
| `prisma/schema.prisma`, `prisma/migrations/20261022090000_add_exercise_bodyweight_loaded/migration.sql` (new) | colonna | 2 |
| `src/schemas/exercise.ts`, `src/app/api/exercises/route.ts`, `src/app/api/exercises/[id]/route.ts`, `src/app/api/personal-records/route.ts` | flag in API | 2 |
| `src/lib/bodyweight-load.ts` (new) | zavorra, etichette trainee/trainer, campi trainee | 3 |
| `src/lib/calculations.ts` | `loadTraineeOneRmMap` col flag, `loadLatestBodyweightKg`, BW in `resolveEffectiveWeight` | 4 |
| `public/locales/{en,it}/{common,trainer}.json` | chiavi | 5 |
| `src/app/trainer/exercises/new/_content.tsx`, `…/[id]/edit/_content.tsx`, `src/components/ExerciseCreateModal.tsx` | checkbox | 6 |
| `src/components/RPEOneRMTable.tsx`, `BodyweightRPETable.tsx` (new), `RpeTablesDrawer.tsx` (new), `index.ts`, `src/app/trainer/trainees/[id]/records/_content.tsx` | tabelle, pannello, etichetta PR | 7 |
| `PersonalRecordsExplorer.tsx`, pagine record trainer/trainee, scheda trainee, pagina test | 1RM col flag | 8 |
| `src/app/api/trainee/workouts/[id]/route.ts`, `…/recap/route.ts`, `src/lib/trainee-program-data.ts`, `src/app/api/programs/[id]/route.ts`, `src/lib/workout-recap.ts` | letture trainee | 9 |
| `src/app/trainee/workouts/[id]/_content.tsx`, `WorkoutRecapPanel.tsx`, `ProgramDetailContent.tsx`, `src/lib/program-pdf-export.ts` | UI trainee | 10 |
| `src/app/trainer/programs/[id]/edit/_content.tsx`, `edit/rpe-weight-range.ts` | pagina edit | 11 |
| `src/app/api/programs/[id]/review/route.ts`, `review/_content.tsx` | review + PDF trainer | 12 |

Mid-way review (plan over 8 tasks): after Task 6.

---

### Task 1: tabella trazioni/dip e parametro `bodyweightLoaded`

**Model:** sonnet
**Depends on:** none
**Files:** `src/lib/calculations.ts` (modify), `tests/unit/calculations.test.ts` (modify)
**Test command:** `npx vitest run tests/unit/calculations.test.ts`
**Done when:** `normalizedOneRM(110, 3, true) === 121`, e tutti i test Tuchscherer
esistenti passano senza modifiche.

- [x] **Step 1: tests**, nuovo `describe('bodyweight-loaded chart')`:
  - `BODYWEIGHT_LOADED_RPE_CHART[1]['10']` → `100`; `[5]['8']` → `81`; `[5]['8.5']` → `82`; `[10]['6']` → `68`; `[9]['6.5']` → `70.5` ((71 + 70) / 2)
  - ogni riga 1–10 ha 9 chiavi (`'10','9.5',…,'6'`)
  - `BODYWEIGHT_LOADED_RPE_LEVELS` → `[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6]`; `BODYWEIGHT_LOADED_REP_RANGE` → `[1..10]`
  - `normalizedOneRM(110, 3, true)` → `121` (110 / 0,91 = 120,88)
  - `normalizedOneRM(110, 3)` e `normalizedOneRM(110, 3, false)` → il valore Tuchscherer di oggi (stesso numero)
  - `normalizedOneRM(110, 11, true)` → `150.5` (Epley 110 × (1 + 11/30) = 150,33 → 150,5)
  - `intensityFromRpeChart(5, 8.5, true)` → `82`; `(5, 5.5, true)` → `null`; `(11, 8, true)` → `null`
  - `rpeWeightRange(130, 5, 8, true)` → `{ min: 103.5, max: 107.5 }` (130 × 0,81 = 105,3; × 0,98 = 103,19 → 103,5; × 1,02 = 107,41 → 107,5)
  - `recordNormalizedOneRM({ exerciseId: 'e', weight: 110, reps: 3, exercise: { isBodyweightLoaded: true } })` → `121`; senza `exercise` → valore Tuchscherer
  - `latestNormalizedOneRMByExercise([{ exerciseId: 'e', weight: 110, reps: 3, exercise: { isBodyweightLoaded: true } }])` → `{ e: 121 }`
- [x] **Step 2: implementation**
  - Costanti, dopo `MIKE_TUCHSCHERER_RPE_CHART`. Le ancore sono quelle della spec e
    **fanno fede**; i mezzi punti si generano (codice completo, è facile sbagliarlo):
    ```ts
    export const BODYWEIGHT_LOADED_RPE_LEVELS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6] as const
    export const BODYWEIGHT_LOADED_REP_RANGE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

    // Weighted pull-ups / dips: % of total load (bodyweight + added weight) at RPE 10, 9, 8, 7, 6.
    const BODYWEIGHT_LOADED_ANCHORS: Record<number, readonly [number, number, number, number, number]> = {
        1: [100, 94, 91, 88, 86],
        2: [94, 91, 88, 86, 83],
        3: [91, 88, 86, 83, 81],
        4: [88, 86, 83, 81, 79],
        5: [86, 83, 81, 79, 77],
        6: [83, 81, 79, 77, 75],
        7: [81, 79, 77, 75, 73],
        8: [79, 77, 75, 73, 71],
        9: [77, 75, 73, 71, 70],
        10: [75, 73, 71, 70, 68],
    }

    function buildBodyweightLoadedChart(): Record<number, Record<string, number>> {
        const chart: Record<number, Record<string, number>> = {}
        for (const [reps, anchors] of Object.entries(BODYWEIGHT_LOADED_ANCHORS)) {
            const row: Record<string, number> = {}
            anchors.forEach((pct, i) => {
                const rpe = 10 - i
                row[toRpeChartKey(rpe)] = pct
                if (i < anchors.length - 1) row[toRpeChartKey(rpe - 0.5)] = (pct + anchors[i + 1]) / 2
            })
            chart[Number(reps)] = row
        }
        return chart
    }

    export const BODYWEIGHT_LOADED_RPE_CHART = buildBodyweightLoadedChart()
    ```
    `toRpeChartKey` è una `function` dichiarata più in basso, quindi è hoisted e si può
    chiamare. Conta solo l'ordine dei `const`: `BODYWEIGHT_LOADED_RPE_CHART` deve stare
    dopo `BODYWEIGHT_LOADED_ANCHORS`.
  - Helper privato `rpeChartFor(bodyweightLoaded: boolean)` → BW chart o Tuchscherer.
  - Firme nuove (parametro finale, default `false`):
    ```ts
    export function estimateOneRMFromRpeTable(weight: number, reps: number, rpe = 10, bodyweightLoaded = false): number
    export function intensityFromRpeChart(reps: number, rpe: number, bodyweightLoaded = false): number | null
    export function rpeWeightRange(oneRm: number, reps: number, rpe: number, bodyweightLoaded = false): RpeWeightRange | null
    export function normalizedOneRM(weight: number, reps: number, bodyweightLoaded = false): number
    ```
    Il comportamento fuori tabella resta quello di oggi: in `estimateOneRMFromRpeTable`
    una riga o una chiave assente porta a Epley; in `intensityFromRpeChart` porta a `null`.
    Il clamp RPE `[5, 10]` resta: con la tabella zavorrati `5`/`5.5` non hanno chiave,
    quindi si torna a Epley, che equivale a "nessun calcolo RPE".
  - `PersonalRecordInput` riceve `exercise?: { isBodyweightLoaded?: boolean | null } | null`.
  - Nuova funzione, usata in `latestPersonalRecordByExercise` (pareggio) e in
    `latestNormalizedOneRMByExercise`:
    ```ts
    /** normalizedOneRM of a PR, with the chart of its exercise. */
    export function recordNormalizedOneRM(record: PersonalRecordInput): number
    ```
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit**: `feat(weights): add bodyweight-loaded rpe chart`

---

### Task 2: colonna `isBodyweightLoaded`, schema e API esercizi

**Model:** sonnet
**Depends on:** none
**Files:** `prisma/schema.prisma`,
`prisma/migrations/20261022090000_add_exercise_bodyweight_loaded/migration.sql` (new),
`src/schemas/exercise.ts`, `src/app/api/exercises/route.ts`,
`src/app/api/exercises/[id]/route.ts`, `src/app/api/personal-records/route.ts` (modify);
`tests/unit/schemas.test.ts` (or the file that already tests `exerciseSchema`:
`grep -rln exerciseSchema tests/unit`), `tests/integration/exercises.test.ts`,
`tests/integration/personal-records.test.ts` (modify)
**Test command:** `npx vitest run tests/unit/schemas.test.ts tests/integration/exercises.test.ts tests/integration/personal-records.test.ts` + `npx prisma validate && npx prisma generate`
**Done when:** il client Prisma ha `Exercise.isBodyweightLoaded`. POST e PUT di
`/api/exercises` lo salvano. `GET /api/personal-records` lo restituisce dentro `exercise`.

- [x] **Step 1: tests**
  - `exerciseSchema` senza il campo → `isBodyweightLoaded === false`; con `true` → `true`; con `'yes'` → errore
  - `updateExerciseSchema.parse({})` → nessuna chiave `isBodyweightLoaded` (`'isBodyweightLoaded' in result === false`)
  - POST `/api/exercises` con `isBodyweightLoaded: true` → `prisma.exercise.create` chiamato con `data.isBodyweightLoaded === true`
  - PUT `/api/exercises/[id]` con `{ isBodyweightLoaded: true }` → update con `true`; PUT senza il campo → `data.isBodyweightLoaded === undefined`
  - GET `/api/personal-records` → la `select` di `exercise` contiene `isBodyweightLoaded: true` (asserire sull'argomento di `findMany`)
- [x] **Step 2: implementation**
  - `schema.prisma`, nel `model Exercise` dopo `notes`:
    ```prisma
    isBodyweightLoaded Boolean   @default(false) // trazioni/dip zavorrati: PR e % su BW + zavorra
    ```
  - migrazione, scritta a mano (niente `migrate dev`):
    ```sql
    -- AlterTable
    ALTER TABLE "exercises" ADD COLUMN "isBodyweightLoaded" BOOLEAN NOT NULL DEFAULT false;
    ```
  - Zod: `isBodyweightLoaded: z.boolean().default(false)` in `exerciseSchema`.
  - Route: aggiungere `isBodyweightLoaded` alla destrutturazione di `validation.data` e a
    `data` in create (`route.ts` ~riga 170/228) e update (`[id]/route.ts` ~riga 95/151).
    Se `[id]` GET/PUT usano `select` sull'esercizio restituito, aggiungere il campo.
  - `personal-records/route.ts` GET (~riga 64): `isBodyweightLoaded: true` nella
    `select` di `exercise`. Fare lo stesso nelle risposte POST/PUT (`personal-records/[id]`)
    se restituiscono `exercise` con `select`.
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit**: `feat(db): add exercise isBodyweightLoaded flag`.
  Nel CHANGELOG aggiungere un bullet **Deploy**: la migrazione va applicata con
  `npm run prisma:migrate:prod` prima del codice.

---

### Task 3: modulo `bodyweight-load.ts` (zavorra ed etichette)

**Model:** sonnet
**Depends on:** none
**Files:** `src/lib/bodyweight-load.ts` (new), `tests/unit/bodyweight-load.test.ts` (new)
**Test command:** `npx vitest run tests/unit/bodyweight-load.test.ts --coverage.enabled --coverage.include=src/lib/bodyweight-load.ts`
**Done when:** coverage 100% del modulo. `ballastFromTotal(97.5, 80)` →
`{ kind: 'ballast', kg: 17.5 }`.

- [x] **Step 1: tests**. `t` finto: `(key, opts) => key + JSON.stringify(opts ?? {})`.
  - `ballastFromTotal(97.5, 80)` → `{ kind: 'ballast', kg: 17.5 }`; `(97.3, 80)` → `kg: 17.5` (ceil); `(75, 80)` → `{ kind: 'bodyweight' }`; `(80, 80)` → `bodyweight`; `(97.5, null)` → `{ kind: 'missingBodyweight' }`
  - `ballastForRow`, riga `absolute` con `weight: 20` → `{ kind: 'ballast', kg: 20 }` qualunque sia BW (anche `null`); `weight: 0` → `bodyweight`
  - `percentage_1rm` con `effectiveWeight: 97.5`, BW 80 → `ballast 17.5`
  - nessun peso, `rpeWeightMin 95.5 / Max 99`, BW 80 → `{ kind: 'ballastRange', minKg: 15.5, maxKg: 19 }`; BW 98 → `{ minKg: 0, maxKg: 1 }`; BW 100 → `bodyweight`; BW null → `missingBodyweight`
  - niente peso e niente range → `null`
  - `traineeWeightFields` con `isBodyweightLoaded: false` → `effectiveWeight`/range invariati, `ballast: null`
  - `traineeWeightFields` con `true` → `effectiveWeight: null, rpeWeightMin: null, rpeWeightMax: null, ballast: <ballastForRow>`
  - `plannedBallastKg({ kind: 'ballast', kg: 17.5 })` → `17.5`; `bodyweight` / `missingBodyweight` / `ballastRange` / `null` → `0`
  - `formatBallastLabel`: una riga per kind → chiave `common.bodyweightLoad.ballast` `{weight:'17.5'}`, `.ballastRange` `{range:'15.5–19'}`, `.bodyweight`, `.missingBodyweight`
  - `formatTrainerLoadLabel`:
    - percentuale, totale 97.5, BW 80 → `total{weight:'97.5'} · ballast{weight:'17.5'}`
    - percentuale, totale 75, BW 80 → `total{…} · bodyweight`
    - percentuale, BW null → solo `total{weight:'97.5'}`; `missingBodyweight: true`
    - absolute 20, BW 80 → `ballastWithTotal{weight:'20', total:'100'}`; BW null → `ballast{weight:'20'}` con `missingBodyweight: true`
    - range 95.5–99, BW 80 → `totalRange{range:'95.5–99'} · ballastRange{range:'15.5–19'}`
    - niente → `null`
- [x] **Step 2: implementation**. Modulo puro (niente Prisma e niente React). Importa
  `roundWeightValue` e `formatWeightRange` da `./weight-rounding`, e
  `formatWeightForDisplay` da dove lo importa oggi `edit/_content.tsx` (stesso
  formatter per i kg).
  ```ts
  export type BallastDisplay =
      | { kind: 'ballast'; kg: number }
      | { kind: 'ballastRange'; minKg: number; maxKg: number }
      | { kind: 'bodyweight' }
      | { kind: 'missingBodyweight' }

  export interface BodyweightLoadRow {
      weightType: 'absolute' | 'percentage_1rm' | 'percentage_previous'
      weight: number | null
      effectiveWeight: number | null
      rpeWeightMin: number | null
      rpeWeightMax: number | null
  }

  type Translate = (key: string, options?: Record<string, unknown>) => string

  export function ballastFromTotal(totalKg: number, bodyweightKg: number | null): BallastDisplay
  /** null = nothing planned (no weight, no range). */
  export function ballastForRow(row: BodyweightLoadRow, bodyweightKg: number | null): BallastDisplay | null
  /** Trainee API rows: bodyweight-loaded rows never carry total load. */
  export function traineeWeightFields(
      row: BodyweightLoadRow & { isBodyweightLoaded: boolean },
      bodyweightKg: number | null
  ): { effectiveWeight: number | null; rpeWeightMin: number | null; rpeWeightMax: number | null; ballast: BallastDisplay | null }
  /** kg to prefill in the trainee's sets. */
  export function plannedBallastKg(ballast: BallastDisplay | null): number
  export function formatBallastLabel(ballast: BallastDisplay, t: Translate): string
  export function formatTrainerLoadLabel(
      row: BodyweightLoadRow,
      bodyweightKg: number | null,
      t: Translate
  ): { label: string; missingBodyweight: boolean } | null
  ```
  Le regole sono quelle delle Global Constraints. Per una riga `absolute`, `ballastForRow`
  usa `weight` (= zavorra). Per le percentuali usa `effectiveWeight`. Il range si usa solo
  se `effectiveWeight` non è un numero. Chiavi (create nel Task 5, namespace `common`):
  `common.bodyweightLoad.{ballast, ballastRange, bodyweight, missingBodyweight, total, totalRange, ballastWithTotal}`.
  Separatore trainer: `' · '`.
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit**: `feat(weights): add bodyweight-load helpers`

---

### Task 4: 1RM server col flag, BW server, `-x%` su zavorra

**Model:** sonnet
**Depends on:** Task 1, Task 2
**Files:** `src/lib/calculations.ts` (modify), `tests/unit/calculations.test.ts` (modify)
**Test command:** `npx vitest run tests/unit/calculations.test.ts`
**Done when:** con il flag, `loadTraineeOneRmMap` usa la tabella trazioni/dip, e
`resolveEffectiveWeight` su `-10%` dopo zavorra 20 con BW 80 restituisce `90`.

- [x] **Step 1: tests** (mock `prisma` come i test esistenti di `loadTraineeOneRmMap`):
  - `loadTraineeOneRmMap`: la `select` include `exercise: { select: { isBodyweightLoaded: true } }`; un PR 110×3 con il flag → mappa `e → 121`
  - `loadLatestBodyweightKg('t')`: `findFirst` chiamato con `where { traineeId: 't', metric: 'weight' }`, `orderBy { measuredAt: 'desc' }`; restituisce `value`; nessuna riga → `null`
  - `resolveEffectiveWeight`, riga precedente `absolute` 20 sullo stesso esercizio, corrente `percentage_previous -10`, opzioni `{ bodyweightKg: 80, isBodyweightLoaded: () => true }` → `90`
  - stesso caso con `bodyweightKg: null` → `null`
  - stesso caso senza opzioni (o `isBodyweightLoaded: () => false`) → `18` (invariato)
  - catena `absolute 20` → `-10%` → `-10%` con il flag e BW 80 → `81` (la seconda base è già totale)
- [x] **Step 2: implementation**
  - `loadTraineeOneRmMap`: aggiungere l'exercise select. La mappa usa già
    `latestNormalizedOneRMByExercise`, che dal Task 1 legge il flag.
  - Nuova funzione accanto a `loadTraineeOneRmMap`:
    ```ts
    /** Latest bodyweight (kg) of a trainee, or null. Server only; never return it to a trainee. */
    export async function loadLatestBodyweightKg(traineeId: string): Promise<number | null>
    ```
  - `resolveEffectiveWeight` riceve un quarto parametro opzionale:
    ```ts
    export interface BodyweightResolveOptions {
        bodyweightKg?: number | null
        isBodyweightLoaded?: (exerciseId: string) => boolean
    }
    export function resolveEffectiveWeight(
        workoutExercise: WorkoutExercise,
        oneRmMap: TraineeOneRmMap,
        workoutSiblings: WorkoutExercise[],
        options: BodyweightResolveOptions = {}
    ): number | null
    ```
    Nel ramo `percentage_previous`, dopo aver risolto `baseWeight`: se
    `previousExercise.weightType === 'absolute'` e
    `options.isBodyweightLoaded?.(previousExercise.exerciseId)`, allora
    `baseWeight = bodyweightKg == null ? null : baseWeight + bodyweightKg`. La chiamata
    ricorsiva passa `options`.
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit**: `feat(weights): bodyweight-aware 1rm map and resolver`

---

### Task 5: chiavi i18n

**Model:** haiku
**Depends on:** none
**Files:** `public/locales/{en,it}/common.json`, `public/locales/{en,it}/trainer.json` (modify)
**Test command:** `node -e "for (const f of process.argv.slice(1)) JSON.parse(require('fs').readFileSync(f,'utf8').replace(/^﻿/,''))" public/locales/*/common.json public/locales/*/trainer.json && head -c3 public/locales/en/trainer.json | xxd -p && head -c3 public/locales/it/trainer.json | xxd -p`
**Done when:** i JSON sono validi e il BOM `efbbbf` è ancora presente in entrambi i `trainer.json`.

- [x] **Step 1: tests**: nessun test unitario; basta il test command.
- [x] **Step 2: implementation**: con Edit, mai riscrivendo i file.
  - `common.json` → dentro `common`, accanto a `rpeOneRmTable`:
    - `bodyweightLoad`:
      `ballast` it `"zavorra {{weight}} kg"` / en `"added weight {{weight}} kg"`;
      `ballastRange` it `"zavorra {{range}} kg"` / en `"added weight {{range}} kg"`;
      `bodyweight` it `"corpo libero"` / en `"bodyweight only"`;
      `missingBodyweight` it `"chiedi al trainer"` / en `"ask your trainer"`;
      `total` it `"{{weight}} kg totali"` / en `"{{weight}} kg total"`;
      `totalRange` it `"{{range}} kg totali"` / en `"{{range}} kg total"`;
      `ballastWithTotal` it `"zavorra {{weight}} kg ({{total}} totali)"` / en `"added weight {{weight}} kg ({{total}} total)"`;
      `bodyweightNotRecorded` it `"peso corporeo non registrato"` / en `"body weight not recorded"`
    - `bodyweightRpeTable`:
      `title` it `"Tabella RPE trazioni zavorrate e dip"` / en `"RPE chart: weighted pull-ups and dips"`;
      `description` it `"Percentuali del carico totale (peso corporeo + zavorra)."` / en `"Percentages of total load (body weight + added weight)."`;
      `open`/`close`/`rpeHeader`/`repsHeader` uguali a quelli di `rpeOneRmTable`;
      `noteExample` it `"Esempio: 5 ripetizioni a RPE 8 ≈ 81% (5 ripetizioni + 2 in riserva = 7 → 7 @ RPE 10 = 81%)."` / en `"Example: 5 reps at RPE 8 ≈ 81% (5 reps + 2 in reserve = 7 → 7 @ RPE 10 = 81%)."`;
      `noteBallast` it `"Per ottenere la zavorra target: carico totale target − peso corporeo."` / en `"Target added weight = target total load − body weight."`;
      `noteDisclaimer` it `"Stima pratica, non validata da ricerca. Gli ancoraggi RPE 10 sono quelli forniti; RPE inferiori aggiungono 1–4 ripetizioni in riserva; i mezzi punti sono la media delle colonne vicine. Oltre 10 ripetizioni, estensione Epley: 1RM = carico × (1 + ripetizioni/30)."` / en: traduzione fedele.
  - `trainer.json`:
    - `exercises.bodyweightLoadedLabel` it `"Esercizio a corpo libero zavorrato (trazioni, dip)"` / en `"Weighted bodyweight exercise (pull-ups, dips)"`;
      `exercises.bodyweightLoadedHelp` it `"Massimali e percentuali su peso corporeo + zavorra"` / en `"Maxes and percentages on body weight + added weight"`
    - `personalRecords.totalLoadLabel` it `"Carico totale (peso corporeo + zavorra)"` / en `"Total load (body weight + added weight)"`
    - `editProgram.floatingRpeTablesButton` it `"Tabelle RPE"` / en `"RPE charts"`;
      `editProgram.rpeTablesPanelTitle` it `"Tabelle RPE"` / en `"RPE charts"`;
      `editProgram.rpeTablesPanelClose` it `"Chiudi tabelle"` / en `"Close charts"`
- [x] **Step 3: run the test command**
- [x] **Step 4: CHANGELOG entry and commit**: `feat(i18n): add bodyweight-loaded keys`

---

### Task 6: checkbox nei form esercizio

**Model:** sonnet
**Depends on:** Task 2, Task 5
**Files:** `src/app/trainer/exercises/new/_content.tsx`,
`src/app/trainer/exercises/[id]/edit/_content.tsx`, `src/components/ExerciseCreateModal.tsx`
(modify); test: estendere il test esistente del modale se c'è
(`grep -rl ExerciseCreateModal tests`), altrimenti `tests/unit/exercise-create-modal-bodyweight.test.tsx` (new)
**Test command:** `npx vitest run <test file above>`
**Done when:** in creazione, modifica e modale la checkbox è visibile e il body di
POST/PUT contiene `isBodyweightLoaded`. In modifica la checkbox parte dal valore salvato.

- [ ] **Step 1: tests** (modale; `fetch` mockato come negli altri test dei componenti):
  - checkbox con label `exercises.bodyweightLoadedLabel` presente, non spuntata di default
  - spunta + submit valido → body JSON con `isBodyweightLoaded: true`
  - senza spunta → `isBodyweightLoaded: false`
- [ ] **Step 2: implementation**: `useState(false)` (in modifica si inizializza dal GET
  dell'esercizio). Il markup è lo stesso del toggle in `src/components/FeedbackForm.tsx`
  ~riga 96 (`label` + `input type="checkbox"` + classi `h-5 w-5 rounded border-gray-300
  text-brand-primary focus:ring-brand-primary`), con sotto il testo di aiuto
  `exercises.bodyweightLoadedHelp` in `text-xs text-gray-500`. Va messo dopo il
  selettore del tipo. Il campo va aggiunto a ogni `JSON.stringify` del body.
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit**: `feat(exercises): bodyweight-loaded checkbox`

> **Mid-way review** here (`reviewer` agent on Tasks 1–6) before continuing.

---

### Task 7: tabella trazioni/dip, pannello tabelle, schermata massimali

**Model:** sonnet
**Depends on:** Task 1, Task 5
**Files:** `src/components/RPEOneRMTable.tsx` (modify), `src/components/BodyweightRPETable.tsx` (new),
`src/components/RpeTablesDrawer.tsx` (new), `src/components/index.ts` (modify),
`src/app/trainer/trainees/[id]/records/_content.tsx` (modify);
`tests/unit/bodyweight-rpe-table.test.tsx` (new), `tests/unit/rpe-tables-drawer.test.tsx` (new)
**Test command:** `npx vitest run tests/unit/bodyweight-rpe-table.test.tsx tests/unit/rpe-tables-drawer.test.tsx tests/unit/records-exercise-autocomplete.test.tsx`
**Done when:** la schermata massimali mostra la tabella trazioni/dip sotto Tuchscherer.
Nel form PR di un esercizio zavorrato l'etichetta del peso è "Carico totale (peso
corporeo + zavorra)".

- [ ] **Step 1: tests**
  - `BodyweightRPETable defaultOpen`: 9 righe nel `tbody` (RPE 10 → 6) × 10 celle; cella RPE 8 / 5 reps → `81%`; RPE 8.5 / 5 reps → `82%`; RPE 6.5 / 9 reps → `70.5%`; le tre note presenti
  - `BodyweightRPETable` chiusa → nessuna tabella; click sul toggle → si apre
  - `RpeTablesDrawer isOpen` → titolo `editProgram.rpeTablesPanelTitle`, entrambe le tabelle già aperte (due `table`)
  - `Escape` → `onClose` chiamato; click sul pulsante chiudi → `onClose`; click sull'overlay → `onClose`
  - `isOpen=false` → le tabelle non sono renderizzate
- [ ] **Step 2: implementation**
  - `RPEOneRMTable`: nuove props opzionali `chart?`, `rpeLevels?`, `repRange?`,
    `formatPercentage?: (pct: number) => string`, `notes?: string[]`, e
    `i18nPrefix?` (default `'common.rpeOneRmTable'`). I default sono i valori di oggi,
    così le pagine che la usano non cambiano. `notes` va renderizzato come lista di `<p>`
    sotto `formula`, con la stessa classe.
  - `BodyweightRPETable`: wrapper con le costanti `BODYWEIGHT_LOADED_*`,
    `i18nPrefix='common.bodyweightRpeTable'`, `formatPercentage = pct => Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%``,
    e le tre note. Inoltra `className`/`defaultOpen`. Senza `formula`: la chiave
    `formula` non esiste in `bodyweightRpeTable`, quindi `RPEOneRMTable` mostra la
    formula solo se `t(...)` non restituisce la chiave stessa. Più semplice: una prop
    `showFormula = true`, che il wrapper mette a `false`.
  - `RpeTablesDrawer` (`isOpen`, `onClose`): stessa struttura di
    `src/components/ProgramChartsDrawer.tsx` (overlay, `aside` destro, `Escape`, header
    sticky). Il corpo, solo se `isOpen`, contiene `<RPEOneRMTable defaultOpen />` e
    `<BodyweightRPETable defaultOpen className="mt-6" />`. Va esportato da `index.ts`
    accanto a `ProgramChartsDrawer`.
  - Records page: `<BodyweightRPETable className="mb-6" />` subito sotto
    `<RPEOneRMTable className="mb-6" />` (~riga 292). `Exercise` (~riga 30) riceve
    `isBodyweightLoaded?: boolean`. L'etichetta del peso nel form (~riga 360, oggi
    `Peso (kg)` scritto a mano) diventa
    `selectedExercise?.isBodyweightLoaded ? t('personalRecords.totalLoadLabel') : 'Peso (kg)'`.
    L'esercizio selezionato si trova in `exercises` tramite `selectedExerciseId`, oppure
    è `editingRecord.exercise` in modifica.
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit**: `feat(records): weighted pull-up/dip rpe chart`

---

### Task 8: 1RM col flag nelle viste dei massimali

**Model:** sonnet
**Depends on:** Task 1, Task 2
**Files:** `src/components/PersonalRecordsExplorer.tsx`,
`src/app/trainer/trainees/[id]/records/_content.tsx`, `src/app/trainee/records/_content.tsx`,
`src/app/trainer/trainees/[id]/_content.tsx`, `src/app/trainer/programs/[id]/tests/_content.tsx`
(modify); `tests/unit/PersonalRecordsExplorer.test.tsx` (modify)
**Test command:** `npx vitest run tests/unit/PersonalRecordsExplorer.test.tsx`
**Done when:** un PR 110×3 di un esercizio zavorrato mostra 1RM `121 kg` in tutte e
cinque le viste.

- [ ] **Step 1: tests**: in `PersonalRecordsExplorer.test.tsx`, record
  `{ weight: 110, reps: 3, exercise: { …, isBodyweightLoaded: true } }` senza
  `calculateOneRepMax` → testo `121`; lo stesso record senza flag → il valore Tuchscherer
  di oggi.
- [ ] **Step 2: implementation**
  - Explorer: `RecordExercise` riceve `isBodyweightLoaded?: boolean`. La prop diventa
    `calculateOneRepMax?: (weight: number, reps: number, isBodyweightLoaded: boolean) => number`,
    con default `normalizedOneRM`. Ogni chiamata interna passa
    `Boolean(record.exercise.isBodyweightLoaded)`.
  - Records trainer e trainee: `calculateOneRepMax(weight, reps, isBodyweightLoaded = false)`
    → `normalizedOneRM(weight, reps, isBodyweightLoaded)`. Ogni chiamata su un record
    passa il flag del suo `exercise`. L'anteprima 1RM nel form (records trainer ~riga 423)
    usa il flag dell'esercizio selezionato. Le interfacce locali degli esercizi ricevono
    `isBodyweightLoaded?: boolean`.
  - Scheda trainee (`trainer/trainees/[id]/_content.tsx` righe ~879 e ~1485):
    `recordNormalizedOneRM(record)` da `@/lib/calculations`. Il fetch dei PR lo porta già
    nell'`exercise` (Task 2).
  - Pagina test (`tests/_content.tsx` ~riga 230): `calculateOneRepMax` riceve il flag
    dell'esercizio scelto nel modale (dal catalogo caricato da `ensureExercisesLoaded`).
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit**: `feat(records): bodyweight-loaded 1rm in record views`

---

### Task 9: letture trainee con la zavorra

**Model:** sonnet
**Depends on:** Task 3, Task 4
**Files:** `src/app/api/trainee/workouts/[id]/route.ts`, `src/app/api/trainee/workouts/[id]/recap/route.ts`,
`src/lib/trainee-program-data.ts`, `src/app/api/programs/[id]/route.ts`, `src/lib/workout-recap.ts`
(modify); `tests/integration/trainee-workout-detail.test.ts`, `tests/integration/program-detail.test.ts`,
`tests/unit/trainee-program-data-notes.test.ts`, the recap route test (`grep -rl "recap/route" tests`) (modify)
**Test command:** `npx vitest run tests/integration/trainee-workout-detail.test.ts tests/integration/program-detail.test.ts tests/unit/trainee-program-data-notes.test.ts <recap test>`
**Done when:** per una riga zavorrata `percentage_1rm` con totale 97,5 e BW 80 tutte e
quattro le letture trainee restituiscono `effectiveWeight: null` e
`ballast: { kind: 'ballast', kg: 17.5 }`, e nessun campo BW.

- [ ] **Step 1: tests**, per ciascuna delle quattro letture (mock prisma esistenti più
  `traineeMeasurement.findFirst`):
  - riga zavorrata, `effectiveWeight: 97.5`, BW 80 → `effectiveWeight: null`, `ballast { kind: 'ballast', kg: 17.5 }`
  - riga zavorrata con range 95.5–99 → `rpeWeightMin/Max: null`, `ballast { kind: 'ballastRange', minKg: 15.5, maxKg: 19 }` (solo workout detail + program data)
  - nessuna misura di peso → `ballast { kind: 'missingBodyweight' }`
  - riga non zavorrata → invariata, `ballast: null`
  - nessuna riga zavorrata → `traineeMeasurement.findFirst` **non** chiamato
  - il JSON della risposta non contiene la stringa `bodyweight` come chiave
    (`expect(JSON.stringify(body)).not.toMatch(/"bodyweightKg"/)`)
  - workout detail, `-10%` dopo `absolute 20` zavorrato, nessun `effectiveWeight` salvato, BW 80 → `ballast kg 10` (passa per `resolveEffectiveWeight` con le opzioni BW)
- [ ] **Step 2: implementation**. Lo stesso schema in ogni lettura:
  1. aggiungere `isBodyweightLoaded: true` alla `select` di `exercise`, dove è esplicita;
  2. `const needsBodyweight = rows.some((we) => we.exercise.isBodyweightLoaded)`;
  3. `const bodyweightKg = needsBodyweight ? await loadLatestBodyweightKg(traineeId) : null`.
     Nel workout detail va nel `Promise.all` esistente;
  4. passare a `resolveEffectiveWeight` le opzioni
     `{ bodyweightKg, isBodyweightLoaded: (id) => loadedIds.has(id) }`;
  5. dopo aver risolto `effectiveWeight`, applicare `traineeWeightFields({...row,
     effectiveWeight, isBodyweightLoaded}, bodyweightKg)` e copiare nel risultato i
     quattro campi restituiti.
  - `api/programs/[id]/route.ts`: solo nel ramo `session.user.role === 'trainee'`.
    Trainer e admin restano invariati.
  - Recap: la `select` riceve `weightType`, `weight`, `rpeWeightMin`, `rpeWeightMax` e
    `exercise.isBodyweightLoaded`. `ExerciseRecapItem` (`src/lib/workout-recap.ts`) riceve
    `ballast: BallastDisplay | null`.
  - `trainee-program-data.ts`: tipo (~riga 36) e oggetto `base` (~riga 207). Il campo
    `ballast` va esposto in `TraineeProgramView`.
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit**: `feat(api): trainee reads show ballast only`

---

### Task 10: UI trainee (workout, recap, dettaglio programma, PDF trainee)

**Model:** sonnet
**Depends on:** Task 3, Task 5, Task 9
**Files:** `src/app/trainee/workouts/[id]/_content.tsx`, `src/components/WorkoutRecapPanel.tsx`,
`src/app/trainee/programs/_components/ProgramDetailContent.tsx`, `src/lib/program-pdf-export.ts`
(modify); `tests/unit/trainee-workout-focus.test.tsx`, `tests/unit/workout-recap-panel.test.tsx`,
`tests/unit/program-pdf-export.test.ts` (modify)
**Test command:** `npx vitest run tests/unit/trainee-workout-focus.test.tsx tests/unit/workout-recap-panel.test.tsx tests/unit/program-pdf-export.test.ts`
**Done when:** il trainee vede `zavorra 17.5 kg` e le serie partono da `17.5`.
`corpo libero` e `chiedi al trainer` compaiono senza numeri.

- [ ] **Step 1: tests**
  - workout focus: riga con `exercise.isBodyweightLoaded: true`, `weightType: 'percentage_1rm'`, `weight: 75`, `effectiveWeight: null`, `ballast { kind: 'ballast', kg: 17.5 }` → testo `zavorra 17.5 kg` (via chiave i18n), input kg della serie con placeholder `17.5`, e **non** `75`
  - `ballast { kind: 'bodyweight' }` → `corpo libero`, placeholder `0`
  - `ballast { kind: 'missingBodyweight' }` → `chiedi al trainer`, nessun numero kg
  - `ballastRange 15.5–19` → `zavorra 15.5–19 kg`
  - riga non zavorrata → invariata
  - recap panel: `ballast 17.5` → la spec della riga contiene l'etichetta zavorra e non `effectiveWeight`
  - PDF: `buildProgramPdfExerciseRow` con `weightLabelOverride: 'zavorra 17.5 kg'` → colonna peso (indice 5) `'zavorra 17.5 kg'`; con `null` o assente → invariato
- [ ] **Step 2: implementation**
  - Workout `_content.tsx`: tipo (~riga 70) riceve `ballast: BallastDisplay | null`, ed
    `Exercise` riceve `isBodyweightLoaded?: boolean`. Un solo helper locale:
    ```ts
    function plannedLoadKg(we: WorkoutExerciseWithWeight): number {
        if (we.exercise.isBodyweightLoaded) return plannedBallastKg(we.ballast)
        return we.effectiveWeight ?? we.weight ?? 0
    }
    ```
    Va usato in tutti i punti elencati nei Traps (~257, ~270, ~595, ~1342, ~1579).
    Dove si calcola `compactWeightValue` (~riga 1058): se `we.ballast` c'è →
    `formatBallastLabel(we.ballast, t)`, prima di ogni altro ramo. `t` di `common`: usare
    `useTranslation(['trainee', 'common'])` oppure `t('common:…')`, secondo il pattern del
    file.
  - `WorkoutRecapPanel.buildExerciseSpec`: se `exercise.ballast` c'è, va messo
    `formatBallastLabel` al posto del segmento kg.
  - `ProgramDetailContent.tsx`: tipo (~riga 45). In `buildExerciseScheme`, se
    `exercise.ballast` c'è, l'unico segmento peso è `formatBallastLabel(...)`, e la
    percentuale e i kg non si aggiungono. Nel mapping PDF (~riga 593):
    `weightLabelOverride: exercise.ballast ? formatBallastLabel(exercise.ballast, t) : null`.
  - `program-pdf-export.ts`: `ProgramPdfExercise.weightLabelOverride?: string | null`. In
    `buildProgramPdfExerciseRow`, se è valorizzato vince su ogni altro calcolo
    di `weightLabel`.
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit**: `feat(trainee): show ballast for weighted bodyweight exercises`

---

### Task 11: pagina modifica programma

**Model:** sonnet
**Depends on:** Task 1, Task 3, Task 5, Task 7
**Files:** `src/app/trainer/programs/[id]/edit/_content.tsx`, `src/app/trainer/programs/[id]/edit/rpe-weight-range.ts`
(modify); `tests/unit/rpe-weight-range-row.test.ts` (modify)
**Test command:** `npx vitest run tests/unit/rpe-weight-range-row.test.ts tests/unit/weight-input.test.ts tests/unit/effective-weight-display.test.ts`
**Done when:** su un esercizio zavorrato con 1RM 130 e BW 80, `75%` mostra
`= 97.5 kg totali · zavorra 17.5 kg`, `20` mostra `zavorra 20 kg (100 totali)`, e
`-10%` dopo `20` salva `effectiveWeight: 90`. Il nuovo pulsante apre il pannello con le
due tabelle.

- [ ] **Step 1: tests** in `rpe-weight-range-row.test.ts`:
  - `{ weight: '', reps: '5', targetRpe: '8', oneRm: 130, bodyweightLoaded: true }` → `{ min: 103.5, max: 107.5 }`
  - stessa riga senza `bodyweightLoaded` → il range Tuchscherer di oggi (invariato)
  - `reps: '11', bodyweightLoaded: true` → `null`
- [ ] **Step 2: implementation**
  - `rpeWeightRangeForRow` riceve `bodyweightLoaded?: boolean` e lo passa a `rpeWeightRange`.
  - `PersonalRecord` (~riga 182): `exercise` riceve `isBodyweightLoaded?: boolean`.
    `latestPRs` (~riga 1036) e il pannello PR (~riga 2816) usano
    `recordNormalizedOneRM(record)`. `normalizedOneRMByExercise` è già corretto dal Task 1.
  - `ExerciseCatalogItem` (~riga 195) riceve `isBodyweightLoaded: boolean`, mappato in
    `nextCatalog` (~riga 650) da `Boolean(exercise.isBodyweightLoaded)`. Helper locale
    `isBodyweightLoadedExercise(id) = exerciseLookupById.get(id)?.isBodyweightLoaded ?? false`.
  - BW: uno stato `bodyweightKg: number | null`, caricato insieme ai PR
    (`fetchPersonalRecords`, stessa guardia `requestId`) con
    `fetch(`/api/trainee-measurements?traineeId=${traineeId}&metric=weight`)` →
    `data.items[0]?.value ?? null` (l'API ordina per `measuredAt desc`). Su errore → `null`.
  - Parse riga, ramo `percentage_previous` (~riga 1866): se l'esercizio è zavorrato e
    `parseWeightInputValue(previousRow.weight).mode === 'absolute'`, la base è
    `previousEffectiveWeight + bodyweightKg`. Se `bodyweightKg` è null,
    `effectiveWeight: null`, come nel ramo "precedente senza peso".
  - `buildWorkoutExercisePayload` e anteprima (~riga 3452): `rpeWeightRangeForRow`
    riceve `bodyweightLoaded`.
  - Anteprima riga (editabile ~riga 3754 e sola lettura ~riga 3734): per gli esercizi
    zavorrati, al posto di `= X kg` e del range, un solo
    `<p className="text-[11px] text-emerald-700 whitespace-nowrap">` con
    `formatTrainerLoadLabel(row, bodyweightKg, t)?.label`. La riga deve avere `weightType`,
    `weight`, `effectiveWeight` (`effectiveWeightToDisplay`) e il range
    (preview/persistito). Per una riga `absolute` l'anteprima compare anche in modalità
    editabile (oggi compare solo per le percentuali). Se `missingBodyweight`, aggiungere
    sotto `<p className="text-[11px] text-amber-700">` con
    `t('common:common.bodyweightLoad.bodyweightNotRecorded')`.
  - Pulsante: stato `isRpeTablesDrawerOpen`; subito dopo il pulsante grafici (~riga 3946),
    dentro lo stesso `isExercisesStepVisible`, un `<button>` con le stesse classi ma
    `top-44` invece di `top-24`, icona `Table` da `lucide-react`, `aria-label`/`title`
    `t('editProgram.floatingRpeTablesButton')`. Poi
    `<RpeTablesDrawer isOpen=… onClose=… />` accanto a `ProgramChartsDrawer`.
- [ ] **Step 3: run the test command and `npm run type-check`**. Poi un controllo a
  mano con `npm run dev` (pagina edit di un programma con trazioni zavorrate): anteprime
  e pannello. Se non è possibile, scriverlo nel report.
- [ ] **Step 4: CHANGELOG entry and commit**: `feat(programs): bodyweight-loaded weights in editor`

---

### Task 12: review trainer e PDF trainer

**Model:** sonnet
**Depends on:** Task 3, Task 4, Task 5, Task 10
**Files:** `src/app/api/programs/[id]/review/route.ts`, `src/app/trainer/programs/[id]/review/_content.tsx`
(modify); the review route test (`grep -rl "review/route" tests`) (modify)
**Test command:** `npx vitest run <review route test>` + `npx vitest run tests/unit/program-pdf-export.test.ts`
**Done when:** review e PDF trainer mostrano `97.5 kg totali · zavorra 17.5 kg` per una
riga zavorrata.

- [ ] **Step 1: tests** (route):
  - la `select` dei PR include `exercise: { select: { isBodyweightLoaded: true } }`; PR 110×3 con il flag → `estimatedOneRMByExercise.e === 121`
  - la `select` di `workoutExercises.exercise` include `isBodyweightLoaded: true`
  - con una riga zavorrata → `latestBodyweightKg` uguale al `value` della misura; senza righe zavorrate → `latestBodyweightKg: null` e `traineeMeasurement.findFirst` non chiamato
- [ ] **Step 2: implementation**
  - Route: le due `select`, `loadLatestBodyweightKg(programMeta.traineeId)` (solo se
    serve), risposta `{ program, estimatedOneRMByExercise, latestBodyweightKg }`.
  - Review `_content.tsx`: tipo (~riga 46) con `exercise.isBodyweightLoaded`, stato
    `latestBodyweightKg`. Nella cella peso (~riga 790), per gli esercizi zavorrati, la riga
    verde mostra `formatTrainerLoadLabel(row, latestBodyweightKg, t)?.label`, più l'avviso
    `bodyweightNotRecorded` se manca BW. In `effectiveWeightByExerciseId`, per una riga
    zavorrata `absolute`, salvare `latestBodyweightKg == null ? null : value + latestBodyweightKg`
    (base del `-x%` di fallback).
  - Mapping PDF (~riga 390): `weightLabelOverride` = la stessa label trainer per le righe
    zavorrate, altrimenti `null`.
- [ ] **Step 3: run the test command, `npm run type-check`, then the full `npm run test:unit` and `npm run lint`**
- [ ] **Step 4: CHANGELOG entry and commit**: `feat(programs): show total and ballast in review and pdf`
