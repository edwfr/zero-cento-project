# Dettaglio calcolo del peso (solo trainer) — Implementation Plan

> **For agentic workers:** execute with `/feature-implement <this file>` in a fresh
> Sonnet session. Read this header, then one task at a time. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** nella modifica programma (editabile e sola lettura) e nella review, il trainer
clicca un'icona (i) accanto al peso derivato e vede i passaggi del calcolo (PR → 1RM →
% o RPE → arrotondamento → zavorra), oppure il motivo per cui il peso manca.

**Architecture:** una funzione pura `explainWeight()` in un nuovo
`src/lib/weight-explanation.ts` riceve i dati della riga (tipo peso, valore, reps, RPE,
PR più recente, BW, riga precedente, valore salvato) e restituisce step **strutturati**
(union discriminata con numeri grezzi), mai stringhe tradotte. Ogni numero degli step è
prodotto chiamando le stesse funzioni che calcolano il peso mostrato
(`estimateOneRMFromRpeTable`, `normalizedOneRM`, `percentageOfOneRmWeight`,
`percentageOfPreviousWeight`, `rpeWeightRange`, `ballastFromTotal`), così dettaglio e
numero non possono divergere. Un componente `WeightExplanationPopover` traduce gli step
e li mostra in un popover a portale aperto al click. Editor e review costruiscono
l'input con i dati che già usano per il peso; la review riceve dall'API due campi in più
(dettagli del PR più recente, data del BW).

**Spec:** `docs/superpowers/specs/2026-10-21-weight-calculation-details-design.md`

## Global Constraints

- Before touching code, invoke the matching project skill: `zero-cento-backend`,
  `zero-cento-frontend`, `zero-cento-testing`.
- **Solo trainer.** Nessuna modifica a pagine, API o componenti trainee. Non toccare
  `trainer/programs/[id]/workouts/[wId]` né il PDF (`src/lib/program-pdf-export.ts`).
- **Nessun numero ricalcolato a mano.** In `weight-explanation.ts` ogni kg/percentuale
  viene da una funzione esistente di `calculations.ts` / `weight-rounding.ts` /
  `bodyweight-load.ts`. Se serve un valore interno (tolleranza range, range zavorra),
  esportalo dal modulo che lo possiede invece di duplicarlo.
- **Dati attuali.** Il dettaglio usa i PR e il BW correnti. Il valore salvato serve solo
  allo step `savedDiffers`.
- **Formati:** date con `formatDate()` (`src/lib/date-format.ts`, GG/MM/AAAA). Numeri
  nel popover con `Intl.NumberFormat` locale `it-IT` (virgola) o `en-GB`, mai `en-US`,
  `maximumFractionDigits: 2`. Le etichette esistenti fuori dal popover non cambiano.
- **Line endings (trappola).** Sono CRLF: `src/app/trainer/programs/[id]/edit/_content.tsx`,
  `src/lib/calculations.ts`, `src/components/index.ts`,
  `src/app/api/programs/[id]/review/route.ts`. Sono LF:
  `src/app/trainer/programs/[id]/review/_content.tsx`, `src/lib/bodyweight-load.ts`.
  Preserva quelli esistenti; prima del commit `git diff --stat` non deve mostrare
  riscritture dell'intero file (vedi commit `1656194`, che le ha già dovute ripristinare).
  File nuovi: LF.
- **BOM (trappola).** `public/locales/{en,it}/trainer.json` iniziano con BOM UTF-8
  (`EF BB BF`). Va conservato: non riscrivere i file con `JSON.stringify` + write senza BOM.
- **Coverage.** `src/lib/**` ha soglie 96% lines / 90% branches (`vitest.config.ts`):
  il nuovo modulo deve essere coperto quasi interamente dai test del Task 1.
- After each task add an entry at the top of `## [Unreleased]` in
  `implementation-docs/CHANGELOG.md` in the existing format (Italian) and include it in
  the task's commit.
- Commit on the current branch with conventional-commit messages. Do not push.

## Deviations from the spec

1. **API review estesa.** La spec dice "nessuna API nuova": nessun endpoint nuovo, ma
   `GET /api/programs/[id]/review` aggiunge due campi alla risposta
   (`latestRecordByExercise`, `latestBodyweightMeasuredAt`). Senza di essi la review non
   può mostrare "PR più recente: 120 kg × 5 (30/09/2026)" né la data del BW. Route già
   ristretta ad admin/trainer, quindi il BW non arriva al trainee.
2. **`-x%` non ricorsivo.** Il dettaglio di un `-x%` mostra la base (riga N e il suo kg)
   e il passaggio percentuale, non ricostruisce la catena della riga base: quella ha la
   sua (i). Evita popover lunghi e catene cicliche nell'UI.
3. **`savedDiffers` solo dove si mostra il salvato.** Editor in sola lettura e review
   mostrano il peso salvato, quindi confrontano salvato e ricalcolo. Nell'editor
   editabile il numero mostrato è già il ricalcolo: `saved` = `null`, nessuno step.
4. **Range scalato da riga precedente solo nell'editor.** L'editor mostra un `-x%` dopo
   una riga a sola RPE come range scalato; la review mostra `-`. La review passa quindi
   `previous.range = null`, così il dettaglio dice "La riga precedente non ha un peso in kg"
   e resta coerente con ciò che la review mostra.

## Review Focus

1. **Stesso numero finale** — per `%1RM`, `-x%`, range RPE e zavorrato, `result` di
   `explainWeight()` è identico al valore che editor/review mostrano con dati attuali.
   Pinned in Task 1 (test "same as calculation").
2. **Nessuna (i) per `absolute` su esercizio normale** e nessuna (i) senza niente da
   spiegare (peso vuoto senza RPE). Pinned in Task 1 (`explainWeight` → `null`) e Task 4
   (componente non renderizza).
3. **Peso salvato ≠ ricalcolo** — in sola lettura/review con un PR più recente compare
   "Peso salvato: X. Con i dati attuali sarebbe Y." Pinned in Task 1 e Task 4.
4. **Popover accessibile e mobile** — `aria-label`, `aria-expanded`; si apre al click/tap,
   si chiude con Esc, clic/tap fuori, secondo clic; nessun hover. Pinned in Task 4.
5. **Nessun dato trainee esposto** — nessun file sotto `src/app/trainee/` o
   `src/app/api/trainee/` cambiato; review route resta admin/trainer. Pinned in Task 2.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/weight-explanation.ts` (new) | `explainWeight()` puro, tipi degli step | 1 |
| `src/lib/calculations.ts` (modify) | export `RPE_WEIGHT_RANGE_TOLERANCE`; `loadLatestBodyweight()` | 1, 2 |
| `src/lib/bodyweight-load.ts` (modify) | export `ballastFromRange` | 1 |
| `tests/unit/weight-explanation.test.ts` (new) | casi per tipo + coerenza col calcolo | 1 |
| `src/app/api/programs/[id]/review/route.ts` (modify) | campi `latestRecordByExercise`, `latestBodyweightMeasuredAt` | 2 |
| `tests/integration/program-lifecycle.test.ts` (modify) | asserzioni nuovi campi | 2 |
| `public/locales/{en,it}/trainer.json` (modify) | chiavi `weightExplanation.*` | 3 |
| `src/components/WeightExplanationPopover.tsx` (new) | bottone (i) + popover a portale + rendering step | 4 |
| `src/components/index.ts` (modify) | export | 4 |
| `tests/unit/weight-explanation-popover.test.tsx` (new) | render/apri/chiudi | 4 |
| `src/app/trainer/programs/[id]/edit/_content.tsx` (modify) | data BW, input + (i) nella cella peso | 5 |
| `src/app/trainer/programs/[id]/review/_content.tsx` (modify) | input + (i) nella cella peso | 6 |

---

### Task 1: funzione pura `explainWeight`

**Model:** sonnet
**Depends on:** none
**Files:** `src/lib/weight-explanation.ts` (new), `src/lib/calculations.ts` (modify),
`src/lib/bodyweight-load.ts` (modify), `tests/unit/weight-explanation.test.ts` (new)
**Test command:** `npx vitest run tests/unit/weight-explanation.test.ts tests/unit/calculations.test.ts tests/unit/bodyweight-load.test.ts`
**Done when:** `explainWeight()` restituisce gli step attesi per ogni caso sotto e il suo
`result` coincide con le funzioni di calcolo; i test esistenti di calculations e
bodyweight-load passano invariati.

- [x] **Step 1: tests** — `tests/unit/weight-explanation.test.ts`. Base comune:
      PR `{ weight: 120, reps: 5, recordDate: '2026-09-30' }`, esercizio normale, BW null.
  - `absolute` 100 kg, non zavorrato → `null`
  - `absolute` peso null, `targetRpe` null, non zavorrato → `null`
  - `absolute` peso null, `targetRpe` null, zavorrato → `null`
  - `%1RM` 75 → steps `latestRecord(120,5,'2026-09-30',totalLoad false)`,
    `oneRm(chart 'tuchscherer', chartPercent 86.3, rawKg ≈139.05, oneRmKg 139)`,
    `percentOfOneRm(75, 139, raw 104.25, result 104.5)`; `result` `{kg 104.5}`;
    `missingReason` null
  - `%1RM` con PR 100 kg × 15 → `oneRm.chart` `'epley'`, `chartPercent` null,
    `oneRmKg === normalizedOneRM(100, 15)`
  - `%1RM` senza PR → steps `[]`, `result` null, `missingReason` `'noRecord'`
  - `-10%` con `previous {rowNumber 2, exerciseName 'Trazioni', baseKg 104.5, ballastKg null, range null}`
    → `previousBase(2,'Trazioni',104.5,null)`, `percentOfPrevious(104.5, -10, raw 94.05, result 94.5)`
  - `-10%` con `previous` null → `missingReason` `'noPreviousRow'`
  - `-10%` con `previous.baseKg` null e `range {min 110.5, max 115}` →
    `previousRange` + `percentOfPreviousRange` con `resultMinKg/resultMaxKg` =
    `percentageOfPreviousWeight(110.5,-10)` / `(115,-10)`; `result` è un range
  - `-10%` con `previous.baseKg` null e `range` null → `'previousWithoutBase'`
  - range RPE: `absolute` null, reps `'5'`, RPE 8 → `latestRecord`, `oneRm`,
    `rpeIntensity(5, 8, 81.1, 'tuchscherer', centerKg ≈112.73)`,
    `rpeRange(tolerancePercent 2, rawMin ≈110.47, rawMax ≈114.98, min 110.5, max 115)`;
    `result` deep-equals `rpeWeightRange(139, 5, 8)`
  - range RPE con reps `'15'` → `'repsOutOfChart'` (dopo gli step PR e 1RM)
  - range RPE con reps `'30"'` (secondi, `plannedReps` = 0) → `'repsOutOfChart'`
  - zavorrato `%1RM` 75, PR 130 × 1 (totale), BW `{kg 80, measuredAt '2026-10-15'}` →
    `latestRecord.totalLoad` true, `oneRm.chart` `'bodyweightLoaded'`, oneRm 130,
    `percentOfOneRm(… result 97.5, totalLoad true)`,
    `bodyweight(80,'2026-10-15', ballast {kind 'ballast', kg 17.5})`
  - zavorrato `%1RM`, BW null → ultimo step `missingBodyweight`; `result` resta il totale
  - zavorrato `%1RM` 50 con BW 80 (totale < BW) → `bodyweight.ballast.kind` `'bodyweight'`
  - zavorrato range RPE con BW 80 → `bodyweight.ballast` = `ballastFromRange(min, max, 80)`
  - zavorrato `absolute` 20, BW 80 → unico step `absoluteBallast(20, 80, '…', total 100)`,
    `result` `{kg 100}`
  - zavorrato `absolute` 20, BW null → `absoluteBallast(20, null, null, total null)`, `result` null
  - zavorrato `absolute` 0 → `absoluteBallast(0, …)`
  - zavorrato `-10%` dopo riga assoluta: `previous {baseKg 100, ballastKg 20}` →
    `previousBase.ballastKg` 20; il risultato è totale, segue lo step `bodyweight`
  - `saved {kg 112.5}` con ricalcolo 104.5 → ultimo step
    `savedDiffers(saved {kg 112.5}, current {kg 104.5})`
  - `saved {kg 104.5}` con ricalcolo 104.5 → nessuno step `savedDiffers`
  - `saved {kg 112.5}` e nessun PR → `savedDiffers(…, current null)` e `'noRecord'`
  - `saved` range diverso dal range ricalcolato → `savedDiffers` con due range
  - **same as calculation**: per una tabella di input (`%1RM` 60/72.5/90, reps PR 1/3/8,
    zavorrato e no) `result.kg === percentageOfOneRmWeight(recordNormalizedOneRM(pr), pct)`;
    per range `result === rpeWeightRange(...)`
- [x] **Step 2: implementation**
  - In `calculations.ts` esporta `RPE_WEIGHT_RANGE_TOLERANCE` (oggi `const` non esportata,
    valore `0.02`). In `bodyweight-load.ts` esporta `ballastFromRange` (oggi privata).
    Nessun altro cambiamento a questi due file.
  - `src/lib/weight-explanation.ts`, tipi esatti:

    ```ts
    import type { BallastDisplay } from './bodyweight-load'
    import type { RpeWeightRange } from './calculations'

    export type WeightValue =
        | { kind: 'kg'; kg: number }
        | { kind: 'range'; minKg: number; maxKg: number }

    export type OneRmChart = 'tuchscherer' | 'bodyweightLoaded' | 'epley'

    export type WeightExplanationStep =
        | { kind: 'latestRecord'; weightKg: number; reps: number; recordDate: string | null; totalLoad: boolean }
        | { kind: 'oneRm'; recordWeightKg: number; reps: number; chart: OneRmChart; chartPercent: number | null; rawKg: number; oneRmKg: number }
        | { kind: 'percentOfOneRm'; percent: number; oneRmKg: number; rawKg: number; resultKg: number; totalLoad: boolean }
        | { kind: 'previousBase'; rowNumber: number; exerciseName: string; baseKg: number; ballastKg: number | null }
        | { kind: 'percentOfPrevious'; baseKg: number; percent: number; rawKg: number; resultKg: number }
        | { kind: 'previousRange'; rowNumber: number; exerciseName: string; minKg: number; maxKg: number }
        | { kind: 'percentOfPreviousRange'; percent: number; minKg: number; maxKg: number; resultMinKg: number; resultMaxKg: number }
        | { kind: 'rpeIntensity'; reps: number; rpe: number; chart: 'tuchscherer' | 'bodyweightLoaded'; chartPercent: number; centerKg: number }
        | { kind: 'rpeRange'; tolerancePercent: number; rawMinKg: number; rawMaxKg: number; minKg: number; maxKg: number }
        | { kind: 'absoluteBallast'; ballastKg: number; bodyweightKg: number | null; measuredAt: string | null; totalKg: number | null }
        | { kind: 'bodyweight'; bodyweightKg: number; measuredAt: string | null; ballast: BallastDisplay }
        | { kind: 'missingBodyweight' }
        | { kind: 'savedDiffers'; saved: WeightValue; current: WeightValue | null }

    export type WeightExplanationReason = 'noRecord' | 'noPreviousRow' | 'previousWithoutBase' | 'repsOutOfChart'

    export interface WeightExplanation {
        steps: WeightExplanationStep[]
        result: WeightValue | null
        missingReason: WeightExplanationReason | null
    }

    export interface WeightExplanationInput {
        weightType: 'absolute' | 'percentage_1rm' | 'percentage_previous'
        /** kg for absolute, % for percentage_1rm, signed % (e.g. -10) for percentage_previous */
        weight: number | null
        reps: string
        targetRpe: number | null
        isBodyweightLoaded: boolean
        /** Most recent PR of the exercise (latestPersonalRecordByExercise), or null */
        latestRecord: { weight: number; reps: number; recordDate?: string | Date | null } | null
        bodyweight: { kg: number; measuredAt: string | Date | null } | null
        /** Nearest previous row of the same exercise in the workout; only for percentage_previous */
        previous: {
            rowNumber: number
            exerciseName: string
            /** previousLoadBase() of that row, null when it has no kg base */
            baseKg: number | null
            /** ballast typed on that row when it is absolute and bodyweight-loaded */
            ballastKg: number | null
            range: RpeWeightRange | null
        } | null
        /** Value the page shows from the database; null in the editable editor */
        saved: WeightValue | null
    }

    /** null = nothing to explain (absolute on a normal exercise, or nothing planned). */
    export function explainWeight(input: WeightExplanationInput): WeightExplanation | null
    ```
  - Algoritmo:
    1. Modalità: `percentage_1rm` / `percentage_previous` dal `weightType`; `absolute` con
       `weight` numero → zavorrato? `absoluteBallast` : `null`; `absolute` con `weight`
       null e `targetRpe` numero → modalità range RPE; altrimenti `null`.
    2. `absoluteBallast`: `totalKg = bodyweight ? weight + bodyweight.kg : null`,
       `result` `{kg totalKg}` o null. Niente `savedDiffers`. Fine.
    3. `%1RM` e range: senza `latestRecord` → `missingReason 'noRecord'`. Altrimenti step
       `latestRecord` (`totalLoad = isBodyweightLoaded`, data normalizzata a stringa ISO
       `YYYY-MM-DD` o null) e `oneRm`: `normReps = Math.max(1, Math.round(pr.reps))`,
       `chartPercent = intensityFromRpeChart(normReps, 10, loaded)`, `chart` = `'epley'` se
       null, `rawKg = estimateOneRMFromRpeTable(pr.weight, pr.reps, 10, loaded)`,
       `oneRmKg = recordNormalizedOneRM(...)` (o `normalizedOneRM`), che è il valore della
       mappa usata dalle pagine.
    4. `%1RM`: `rawKg = oneRm * pct / 100`, `resultKg = percentageOfOneRmWeight(oneRm, pct)`.
    5. Range: `reps = plannedReps(input.reps.trim())`, `pct = intensityFromRpeChart(reps, rpe, loaded)`;
       null → `'repsOutOfChart'`. `centerKg = oneRm * pct / 100`;
       `rawMin/rawMax = center × (1 ∓ RPE_WEIGHT_RANGE_TOLERANCE)`; `min/max` presi da
       `rpeWeightRange(oneRm, reps, rpe, loaded)` (non da `roundWeightValue` a mano).
    6. `-x%`: `previous` null → `'noPreviousRow'`; `baseKg` numero → `previousBase` +
       `percentOfPrevious` con `resultKg = percentageOfPreviousWeight(base, pct)`;
       altrimenti `range` → `previousRange` + `percentOfPreviousRange`; altrimenti
       `'previousWithoutBase'`.
    7. Zavorrato e `result` presente (modi 3-6): step `bodyweight` con
       `ballastFromTotal(kg, bw)` o `ballastFromRange(min, max, bw)`; senza BW
       `missingBodyweight`.
    8. `saved` non null e diverso da `result` (confronto esatto su kg o su entrambi i
       bounds; `result` null conta come diverso) → step `savedDiffers` in coda.
  - Struttura del file: stile di `src/lib/bodyweight-load.ts` (modulo puro, commento di
    testa, niente Prisma né React). Import da `./calculations` sono sicuri lato client:
    il modulo è già importato dalle pagine trainer.
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(weights): add weight explanation steps`

---

### Task 2: API review con dettagli PR e data BW

**Model:** sonnet
**Depends on:** none
**Files:** `src/lib/calculations.ts` (modify), `src/app/api/programs/[id]/review/route.ts` (modify),
`tests/integration/program-lifecycle.test.ts` (modify)
**Test command:** `npx vitest run tests/integration/program-lifecycle.test.ts tests/unit/calculations.test.ts`
**Done when:** la risposta di `GET /api/programs/[id]/review` contiene
`latestRecordByExercise` e `latestBodyweightMeasuredAt` e i campi esistenti sono invariati.

- [x] **Step 1: tests** — in `describe('GET /api/programs/[id]/review')`:
  - due PR dello stesso esercizio (date diverse) → `latestRecordByExercise['ex-1']` =
    `{ weight, reps, recordDate }` del più recente
  - nessun PR → `latestRecordByExercise` `{}`
  - riga zavorrata, misura `{ value: 80, measuredAt: '2026-10-15T00:00:00.000Z' }` →
    `latestBodyweightKg` 80 e `latestBodyweightMeasuredAt` quella data (stringa ISO)
  - nessuna riga zavorrata → entrambi null e `traineeMeasurement.findFirst` non chiamato
    (il test esistente lo verifica già: estendilo)
  - test unit in `calculations.test.ts`: `loadLatestBodyweight` → `{kg, measuredAt}` o null;
    `loadLatestBodyweightKg` invariato
- [x] **Step 2: implementation**
  - `calculations.ts`:
    ```ts
    export async function loadLatestBodyweight(
        traineeId: string
    ): Promise<{ kg: number; measuredAt: Date } | null>
    ```
    stessa query di `loadLatestBodyweightKg` con `select: { value: true, measuredAt: true }`;
    `loadLatestBodyweightKg` diventa `(await loadLatestBodyweight(id))?.kg ?? null`.
    Gli altri 4 chiamanti di `loadLatestBodyweightKg` non cambiano.
  - Route: `latestRecordByExercise` = `latestPersonalRecordByExercise(records)` mappato a
    `{ weight, reps, recordDate }` (senza `exercise`). BW via `loadLatestBodyweight` solo
    quando `hasBodyweightLoaded` (come oggi). Risposta:
    `{ program, estimatedOneRMByExercise, latestRecordByExercise, latestBodyweightKg, latestBodyweightMeasuredAt }`.
    Aggiorna il commento JSDoc di testa della route.
  - Mock esistenti di `findFirst` che restituiscono solo `{ value }`: `measuredAt`
    undefined → serializza come null (`measuredAt?.toISOString?.() ?? null` o simile).
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(api): review returns latest pr and bodyweight date`

---

### Task 3: chiavi i18n

**Model:** haiku
**Depends on:** none
**Files:** `public/locales/it/trainer.json` (modify), `public/locales/en/trainer.json` (modify)
**Test command:** `node -e "for (const l of ['it','en']) JSON.parse(require('fs').readFileSync('public/locales/'+l+'/trainer.json','utf8').replace(/^﻿/,''))" && head -c3 public/locales/it/trainer.json | xxd && head -c3 public/locales/en/trainer.json | xxd`
**Done when:** entrambi i file sono JSON validi, iniziano ancora con `efbb bf` e hanno
l'oggetto `weightExplanation` top-level con tutte le chiavi sotto.

- [x] **Step 1: tests** — il test command sopra (parse + BOM).
- [x] **Step 2: implementation** — aggiungi l'oggetto top-level `weightExplanation`
      (accanto a `editProgram` / `reviewProgram`). Edita a mano, conserva BOM e indent.

  | key | it | en |
  |---|---|---|
  | `buttonLabel` | Come è calcolato il peso | How this weight is calculated |
  | `title` | Calcolo del peso | Weight calculation |
  | `latestRecord` | PR più recente: {{weight}} kg × {{reps}} ({{date}}) | Latest PR: {{weight}} kg × {{reps}} ({{date}}) |
  | `latestRecordTotal` | PR più recente: {{weight}} kg × {{reps}} (carico totale) ({{date}}) | Latest PR: {{weight}} kg × {{reps}} (total load) ({{date}}) |
  | `oneRmTuchscherer` | 1RM teorico: {{weight}} ÷ {{percent}}% (Tuchscherer, {{reps}} @ RPE 10) = {{raw}} → {{oneRm}} kg | Estimated 1RM: {{weight}} ÷ {{percent}}% (Tuchscherer, {{reps}} @ RPE 10) = {{raw}} → {{oneRm}} kg |
  | `oneRmBodyweightLoaded` | 1RM teorico: {{weight}} ÷ {{percent}}% (tabella trazioni/dip, {{reps}} @ RPE 10) = {{raw}} → {{oneRm}} kg | Estimated 1RM: {{weight}} ÷ {{percent}}% (pull-up/dip chart, {{reps}} @ RPE 10) = {{raw}} → {{oneRm}} kg |
  | `oneRmEpley` | 1RM teorico: {{weight}} × (1 + {{reps}}/30) (Epley, reps fuori tabella) = {{raw}} → {{oneRm}} kg | Estimated 1RM: {{weight}} × (1 + {{reps}}/30) (Epley, reps outside the chart) = {{raw}} → {{oneRm}} kg |
  | `percentOfOneRm` | {{percent}}% di {{oneRm}} = {{raw}} → arrotondato {{result}} kg | {{percent}}% of {{oneRm}} = {{raw}} → rounded {{result}} kg |
  | `percentOfOneRmTotal` | {{percent}}% di {{oneRm}} = {{raw}} → arrotondato {{result}} kg totali | {{percent}}% of {{oneRm}} = {{raw}} → rounded {{result}} kg total |
  | `previousBase` | Base: riga {{row}} ({{exercise}}) = {{base}} kg | Base: row {{row}} ({{exercise}}) = {{base}} kg |
  | `previousBaseBallast` | Base: riga {{row}} ({{exercise}}) = zavorra {{ballast}} kg + peso corporeo = {{base}} kg | Base: row {{row}} ({{exercise}}) = {{ballast}} kg added + bodyweight = {{base}} kg |
  | `percentOfPrevious` | {{base}} × (1 − {{percent}}%) = {{raw}} → arrotondato {{result}} kg | {{base}} × (1 − {{percent}}%) = {{raw}} → rounded {{result}} kg |
  | `previousRange` | Base: riga {{row}} ({{exercise}}) = range {{min}} – {{max}} kg | Base: row {{row}} ({{exercise}}) = range {{min}} – {{max}} kg |
  | `percentOfPreviousRange` | {{min}} – {{max}} × (1 − {{percent}}%) → {{resultMin}} – {{resultMax}} kg | {{min}} – {{max}} × (1 − {{percent}}%) → {{resultMin}} – {{resultMax}} kg |
  | `rpeIntensityTuchscherer` | {{reps}} @ RPE {{rpe}} = {{percent}}% (Tuchscherer) → {{center}} kg | {{reps}} @ RPE {{rpe}} = {{percent}}% (Tuchscherer) → {{center}} kg |
  | `rpeIntensityBodyweightLoaded` | {{reps}} @ RPE {{rpe}} = {{percent}}% (tabella trazioni/dip) → {{center}} kg | {{reps}} @ RPE {{rpe}} = {{percent}}% (pull-up/dip chart) → {{center}} kg |
  | `rpeRange` | Range ±{{tolerance}}%: {{rawMin}} – {{rawMax}} → {{min}} – {{max}} kg | Range ±{{tolerance}}%: {{rawMin}} – {{rawMax}} → {{min}} – {{max}} kg |
  | `absoluteBallast` | Zavorra {{ballast}} kg + peso corporeo {{bodyweight}} kg ({{date}}) = {{total}} kg totali | {{ballast}} kg added + bodyweight {{bodyweight}} kg ({{date}}) = {{total}} kg total |
  | `absoluteBallastNoBodyweight` | Zavorra {{ballast}} kg. Peso corporeo non registrato: totale non calcolabile | {{ballast}} kg added. Bodyweight not recorded: total unavailable |
  | `absoluteBodyweightOnly` | Corpo libero, nessuna zavorra | Bodyweight only, no added load |
  | `bodyweightBallast` | Peso corporeo: {{bodyweight}} kg ({{date}}) → zavorra {{ballast}} kg | Bodyweight: {{bodyweight}} kg ({{date}}) → {{ballast}} kg added |
  | `bodyweightBallastRange` | Peso corporeo: {{bodyweight}} kg ({{date}}) → zavorra {{min}} – {{max}} kg | Bodyweight: {{bodyweight}} kg ({{date}}) → {{min}} – {{max}} kg added |
  | `bodyweightOnly` | Peso corporeo: {{bodyweight}} kg ({{date}}) → corpo libero, nessuna zavorra | Bodyweight: {{bodyweight}} kg ({{date}}) → bodyweight only, no added load |
  | `missingBodyweight` | Peso corporeo non registrato: zavorra non calcolabile | Bodyweight not recorded: added load unavailable |
  | `savedDiffers` | Peso salvato: {{saved}}. Con i dati attuali sarebbe {{current}}. | Saved weight: {{saved}}. With current data it would be {{current}}. |
  | `savedDiffersNoCurrent` | Peso salvato: {{saved}}. Con i dati attuali non è calcolabile. | Saved weight: {{saved}}. It cannot be calculated with current data. |
  | `valueKg` | {{weight}} kg | {{weight}} kg |
  | `valueRange` | {{min}} – {{max}} kg | {{min}} – {{max}} kg |
  | `noDate` | data non indicata | date not set |
  | `reasons.noRecord` | Nessun PR registrato per questo esercizio | No PR recorded for this exercise |
  | `reasons.noPreviousRow` | Nessuna riga precedente dello stesso esercizio | No previous row of the same exercise |
  | `reasons.previousWithoutBase` | La riga precedente non ha un peso in kg | The previous row has no weight in kg |
  | `reasons.repsOutOfChart` | Reps o RPE fuori tabella: nessun range proposto | Reps or RPE outside the chart: no range proposed |

- [x] **Step 3: run the test command**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(i18n): add weight explanation keys`

---

### Task 4: componente `WeightExplanationPopover`

**Model:** sonnet
**Depends on:** Task 1, Task 3
**Files:** `src/components/WeightExplanationPopover.tsx` (new), `src/components/index.ts` (modify),
`tests/unit/weight-explanation-popover.test.tsx` (new)
**Test command:** `npx vitest run tests/unit/weight-explanation-popover.test.tsx`
**Done when:** il bottone (i) apre un popover con una riga per step, si chiude con Esc,
clic fuori, tap fuori e secondo clic, e con `explanation === null` non viene renderizzato nulla.

- [x] **Step 1: tests** — mock i18n come in `tests/unit/UserStatusBadge.test.tsx`.
  - `explanation={null}` → `container` vuoto, nessun bottone
  - explanation `%1RM` (costruita con `explainWeight` del Task 1) → bottone con
    `aria-label` = chiave `weightExplanation.buttonLabel`, `aria-expanded="false"`
  - click → `aria-expanded="true"`, `role="dialog"` visibile con 3 righe
    (`latestRecord`, `oneRmTuchscherer`, `percentOfOneRm`)
  - secondo click → popover chiuso
  - aperto + `keyDown Escape` su document → chiuso
  - aperto + `mouseDown` su `document.body` → chiuso; `mouseDown` dentro il popover → resta aperto
  - aperto + `touchStart` su `document.body` → chiuso
  - `missingReason 'noRecord'` → riga `weightExplanation.reasons.noRecord`
  - step `savedDiffers` con `current` null → chiave `savedDiffersNoCurrent`
  - `recordDate` null → interpolazione `date` = chiave `weightExplanation.noDate`
  - con lingua `it` i numeri decimali hanno la virgola (`104,25`) — se il mock di
    i18n non lo consente, testa l'helper di formattazione esportato dal componente
- [x] **Step 2: implementation**
  ```ts
  export interface WeightExplanationPopoverProps {
      explanation: WeightExplanation | null
      className?: string
  }
  export default function WeightExplanationPopover(props: WeightExplanationPopoverProps): JSX.Element | null
  ```
  - `useTranslation('trainer')`. Bottone `type="button"` con icona lucide `Info`
    (`h-3.5 w-3.5`), stile dei bottoni hint dell'editor
    (`inline-flex h-4 w-4 items-center justify-center rounded text-gray-500 hover:text-brand-primary`),
    `aria-label`, `aria-expanded`, `aria-haspopup="dialog"`. `ActionIconButton` non va
    bene (varianti fisse, bottone 8×8 colorato): la spec ammette un bottone accessibile.
  - Popover in `createPortal(document.body)` con posizionamento `fixed`: copia
    `updatePosition` e i listener scroll/resize di `src/components/UserStatusBadge.tsx`
    (le tabelle di editor e review stanno in `overflow-x-auto`, un `absolute` verrebbe
    tagliato). Larghezza 288, `role="dialog"`, `aria-label` = `title`, titolo + `<ul>` di righe.
  - Apertura **solo al click** (niente hover/focus, a differenza di UserStatusBadge).
    Chiusura: Esc, `mousedown` e `touchstart` fuori da bottone e popover, secondo click.
  - Rendering: una funzione `stepLine(step, t, fmt)` con `switch (step.kind)` → chiave
    del Task 3. `fmt` = `Intl.NumberFormat(i18n.language.startsWith('it') ? 'it-IT' : 'en-GB', { maximumFractionDigits: 2 })`.
    Percentuali `percentOfPrevious*` mostrate come valore assoluto (`-10` → `10`).
    Date: `formatDate(step.recordDate)`, null → `t('weightExplanation.noDate')`.
    `bodyweight.ballast.kind`: `ballast` → `bodyweightBallast`, `ballastRange` →
    `bodyweightBallastRange`, `bodyweight` → `bodyweightOnly` (`missingBodyweight` non
    capita qui: lo produce lo step dedicato). `absoluteBallast`: `ballastKg` 0 →
    `absoluteBodyweightOnly`; `bodyweightKg` null → `absoluteBallastNoBodyweight`.
    `WeightValue` → `valueKg` / `valueRange`. `missingReason` → riga `reasons.*` in coda.
  - Export default + named in `src/components/index.ts` (CRLF) come gli altri componenti.
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(programs): add weight explanation popover`

---

### Task 5: (i) nell'editor programma

**Model:** sonnet
**Depends on:** Task 1, Task 4
**Files:** `src/app/trainer/programs/[id]/edit/_content.tsx` (modify, CRLF)
**Test command:** `npx vitest run tests/unit/weight-explanation.test.ts tests/unit/weight-explanation-popover.test.tsx tests/unit/effective-weight-display.test.ts tests/unit/rpe-weight-range-row.test.ts && npm run lint`
**Done when:** in `/trainer/programs/[id]/edit` e `/trainer/programs/[id]` (sola lettura)
la (i) compare accanto al peso per `%1RM`, `-x%`, range RPE e righe zavorrate, non per
un `absolute` normale, e il popover mostra gli stessi kg della cella.

- [ ] **Step 1: tests** — nessun test di pagina (il file è 4188 righe e non ha test di
      render). La logica è coperta dai Task 1 e 4. Verifica manuale con `npm run dev`
      sui casi della spec (PR presente/assente, `-10%` senza riga precedente, zavorrato
      con/senza BW, sola lettura con PR arrivato dopo il salvataggio).
- [ ] **Step 2: implementation**
  - Stato: accanto a `bodyweightKg` (riga ~540) aggiungi
    `bodyweightMeasuredAt: string | null`, valorizzato nello stesso blocco
    (`bodyweightData?.data?.items?.[0]?.measuredAt`, riga ~712) e azzerato negli stessi
    rami di errore.
  - `useMemo` `latestRecordByExerciseId = latestPersonalRecordByExercise(personalRecords)`
    accanto a `normalizedOneRMByExercise` (riga ~1080; la funzione è già importata).
  - Nel `workoutRows.map` (riga ~3437), dopo `compactLoadLabel`, costruisci
    `WeightExplanationInput`:
    - `weightType`/`weight` da `parsedWeightInputForPreview` (`mode` `empty` → `absolute`
      con `weight` null; `invalid` → nessuna spiegazione: `explanation = null`)
    - `reps: row.reps`, `targetRpe`: `row.targetRpe.trim() === '' ? null : Number(...)`
      (null se non finito)
    - `isBodyweightLoaded: rowIsBodyweightLoaded`
    - `latestRecord: latestRecordByExerciseId[row.exerciseId] ?? null`
    - `bodyweight: bodyweightKg === null ? null : { kg: bodyweightKg, measuredAt: bodyweightMeasuredAt }`
    - `previous` (solo `percentage_previous`): stessa ricerca di `resolveWeightInputForRow`
      (`workoutRows.slice(0, rowIndex).reverse().find(same exerciseId)`); `rowNumber` =
      indice in `workoutRows` + 1; `exerciseName` da `exerciseLookupById`;
      `baseKg = previousLoadBase(effectiveWeightPreviewByRowId[prev.id], {...})` con gli
      stessi argomenti di riga ~1911; `ballastKg` = valore assoluto della riga precedente
      se zavorrata e `absolute`, altrimenti null; `range = weightRangePreviewByRowId[prev.id] ?? null`
    - `saved`: solo se `readOnly`. `persistedEffectiveWeight` numero e modo non assoluto →
      `{kind:'kg'}`; altrimenti `persistedRpeWeightRange` → `{kind:'range'}`; altrimenti null
    - `explanation = explainWeight(input)`
  - Trappola: `effectiveWeightPreviewByRowId` e `weightRangePreviewByRowId` vengono
    riempiti riga per riga durante il render; leggili come fa già il codice esistente
    (riga precedente già visitata), non spostare il calcolo fuori dal map.
  - Render: `<WeightExplanationPopover explanation={explanation} />`
    - sola lettura: ultimo figlio del `div.flex.items-center.gap-1.flex-wrap` (riga ~3890)
    - editabile: dentro il `div.flex.items-center.gap-1` dopo `inlineWeightLabel`
      (riga ~3923). Con peso vuoto il wrapper dell'input è `w-full`: cambialo in
      `min-w-0 flex-1` così la (i) entra nella cella (colonna PESO al 14%).
  - Non cambiare `resolveWeightInputForRow`, le etichette esistenti né il payload salvato.
- [ ] **Step 3: run the test command and `npm run type-check`; prova in `npm run dev`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(programs): weight explanation in editor`

---

### Task 6: (i) nella review programma

**Model:** sonnet
**Depends on:** Task 1, Task 2, Task 4
**Files:** `src/app/trainer/programs/[id]/review/_content.tsx` (modify, LF)
**Test command:** `npx vitest run tests/unit/weight-explanation.test.ts tests/unit/weight-explanation-popover.test.tsx && npm run lint`
**Done when:** in `/trainer/programs/[id]/review` la (i) compare accanto al peso
effettivo per pesi derivati, range RPE e righe zavorrate, e segnala quando il peso
salvato differisce dal ricalcolo.

- [ ] **Step 1: tests** — come Task 5: nessun test di pagina; verifica manuale in
      `npm run dev` (review di un programma con un `%1RM` salvato prima di un nuovo PR).
- [ ] **Step 2: implementation**
  - Stato da API (riga ~271): `latestRecordByExercise: Record<string, { weight: number; reps: number; recordDate: string | null }>`
    (default `{}`) e `latestBodyweightMeasuredAt: string | null`.
  - Nel loop del workout (riga ~720), accanto a `effectiveWeightByExerciseId`, tieni
    `previousRowByExerciseId: Record<string, { rowNumber: number; ballastKg: number | null }>`
    aggiornato a **ogni** riga (anche senza peso), così `noPreviousRow` e
    `previousWithoutBase` restano distinti. `rowNumber` = indice della riga nel workout + 1
    (aggiungi l'indice al `.map`). Leggi i valori della riga precedente **prima** di
    aggiornare le mappe con la riga corrente.
  - Input per riga:
    - `weightType`/`weight`/`targetRpe`/`reps` da `workoutExercise`
    - `latestRecord: latestRecordByExercise[exercise.id] ?? null`
    - `bodyweight` da `latestBodyweightKg` + `latestBodyweightMeasuredAt`
    - `previous`: se esiste in `previousRowByExerciseId` →
      `{ rowNumber, exerciseName: exercise.name, baseKg: effectiveWeightByExerciseId[id] ?? null, ballastKg, range: null }`
      (range null: vedi Deviation 4)
    - `saved`: `workoutExercise.effectiveWeight` numero e tipo non `absolute` →
      `{kind:'kg'}`; altrimenti `rpeWeightMin/Max` numeri → `{kind:'range'}`; altrimenti null
  - Render: `<WeightExplanationPopover>` nel `<p>` verde della riga ~875 trasformato in
    `div.flex.items-center.gap-1` (testo + (i)); classi del testo invariate.
- [ ] **Step 3: run the test command and `npm run type-check`; prova in `npm run dev`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(programs): weight explanation in review`
