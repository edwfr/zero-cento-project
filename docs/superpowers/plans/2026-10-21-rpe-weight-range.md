# Range di peso proposto da RPE — Implementation Plan

> **For agentic workers:** execute with `/feature-implement <this file>` in a fresh
> Sonnet session. Read this header, then one task at a time. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** quando il trainer lascia vuoto il peso ma imposta reps + RPE e il trainee ha un
PR per quell'esercizio, l'app propone un range di kg (centro ± 2% dalla tabella
Tuchscherer), lo congela al salvataggio e lo mostra a trainer (edit, review, PDF) e
trainee (vista workout, dettaglio programma).

**Architecture:** una sola funzione pura `rpeWeightRange` in `src/lib/calculations.ts`
(sopra `intensityFromRpeChart` + `roundWeightValue`) calcola il range. Il client (pagina
edit) la usa per l'anteprima live e per mettere `rpeWeightMin`/`rpeWeightMax` nel payload
di salvataggio, come fa già con `effectiveWeight`. Il server non ricalcola: valida (Zod),
salva le due nuove colonne nullable su `workout_exercises`, le copia nelle copie
settimana, e le restituisce nelle letture. Le viste mostrano il range solo quando non c'è
un peso effettivo.

**Spec:** `docs/superpowers/specs/2026-10-21-rpe-weight-range-design.md`

## Global Constraints

- Before touching code, invoke the matching project skill: `zero-cento-backend`,
  `zero-cento-frontend`, `zero-cento-testing`.
- **Condizioni del range** (unica fonte: `rpeWeightRange` + `rpeWeightRangeForRow`):
  peso vuoto **e** `targetRpe` non null **e** 1RM dell'esercizio presente (> 0) **e**
  reps numeriche 1–12 (`plannedReps` → minimo del range `8/10`; `30"`, `max` → 0 → null).
  Altrimenti `rpeWeightMin = rpeWeightMax = null`.
- **Calcolo:** `centro = oneRm × pct / 100`, `min = roundWeightValue(centro × 0.98)`,
  `max = roundWeightValue(centro × 1.02)` (ceil a 0,5 kg). Esempio di riferimento:
  1RM 139, 5 reps @ RPE 8 (81,1%) → **110.5 – 115**.
- 1RM = `latestNormalizedOneRMByExercise(personalRecords)[exerciseId]` (mappa già presente
  in edit come `normalizedOneRMByExercise`). Nessuna nuova regola di scelta PR.
- Il range è **congelato**: nessun ricalcolo server-side, nessun ricalcolo nelle letture.
  `weightType` resta `absolute`, `weight`/`effectiveWeight` restano null. Nessun nuovo
  `WeightType`.
- **Invariante server:** se una riga salvata ha `weight != null`, il server scrive
  `rpeWeightMin = rpeWeightMax = null` qualunque cosa arrivi nel body.
- Il range è solo informativo: non precompila i kg delle serie del trainee (placeholder e
  valori iniziali in `trainee/workouts/[id]/_content.tsx` restano su
  `effectiveWeight ?? weight ?? 0`). Nessun pulsante "accetta".
- Nessuna modifica a intensità SBD, tabella Tuchscherer, `roundWeightValue`,
  `resolveEffectiveWeight`, workout recap, report test-results.
- Formato range a schermo: `formatWeightRange(min, max)` → `110.5–115` (en dash `–`,
  senza spazi, senza unità); il chiamante aggiunge `kg`.
- Coverage: soglie in `vitest.config.ts` non devono scendere.
- After each task add an entry at the top of `## [Unreleased]` in
  `implementation-docs/CHANGELOG.md` in the existing format (Italian,
  `### type(scope): titolo (21/10/2026)` + bullet + "Motivo:") and include it in the
  task's commit.
- Commit on the current branch with conventional-commit messages. Do not push.

## Deviations from the spec

- **Separatore decimale:** il punto ovunque (`110.5–115 kg`), come tutti gli helper peso
  esistenti (`formatWeightForDisplay`, `formatWeightValue`, `formatCompactNumber` usano
  `toFixed`/`String`). La virgola IT richiederebbe di cambiare tutti i pesi dell'app:
  fuori scope.
- **Migrazione scritta a mano**, non generata con `npm run prisma:migrate`
  (`prisma migrate dev` applica al DB di `.env`, potenzialmente produzione). Nessun comando
  `migrate` in questo piano; si valida con `npx prisma validate` + `npx prisma generate`.
  Il deploy applica con `npm run prisma:migrate:prod`.
- **Invariante server `weight != null` → range null** (vedi Global Constraints): la spec
  lo dice solo per il client; aggiunto per evitare range vecchi su righe a cui un client
  diverso ha messo un peso.
- **Zod:** oltre a `>= 0` e `min <= max`, i due campi devono essere entrambi valorizzati o
  entrambi null/assenti.
- **Reps:** si usa `plannedReps` di `@/lib/reps` (non `parseReps` di `calculations.ts`,
  che è un'altra funzione legacy).
- **Esercizi zavorrati:** la spec `bodyweight-loaded-exercises` **non** è implementata
  (nessun `isBodyweightLoaded` nello schema). Questo piano usa solo Tuchscherer; il piano
  zavorrati dovrà aggiungere a `rpeWeightRange` il parametro tabella.

## Traps found while exploring

- `public/locales/{en,it}/trainer.json` iniziano con **BOM UTF-8** (`EF BB BF`); gli altri
  file locale no, `errors.json`/`navigation.json` hanno fine riga CRLF. Modificarli con
  Edit (non riscrivere il file con Write/`JSON.stringify`) e verificare dopo con
  `head -c3 <file> | xxd -p` che il BOM ci sia ancora.
- `src/lib/calculations.ts` importa `prisma` ma è già importata dalla pagina edit client
  (`latestNormalizedOneRMByExercise`): aggiungere lì la funzione va bene. Non importare
  `calculations.ts` da `weight-rounding.ts` (ciclo); è `calculations.ts` che importa
  `roundWeightValue` da `weight-rounding.ts`.
- `workoutExerciseSchema` e `bulkSaveWorkoutExercisesSchema` hanno **due** `superRefine`
  duplicati: la regola del range va in un helper condiviso chiamato da entrambi. La PUT
  `[exerciseId]` usa `workoutExerciseSchema` completo, quindi eredita la regola.
- `copy-week/route.ts` ha **due** blocchi di copia (`createMany` riga ~184 e update/create
  riga ~236): entrambi copiano `effectiveWeight`, entrambi devono copiare il range.
- Le letture con `include` (`loadProgramTreeForTrainee`, `api/programs/[id]`,
  `api/trainee/workouts/[id]`) prendono già tutte le colonne, ma poi **rimappano campo per
  campo** (`base` in `trainee-program-data.ts` ~riga 207, oggetto restituito in
  `api/trainee/workouts/[id]/route.ts` ~riga 205): lì i due campi vanno aggiunti a mano.
  La review route usa `select` esplicito.
- Nella pagina edit, la riga `-10%` dopo una riga con solo range ha già oggi
  `effectiveWeight = null` (`effectiveWeightByRowId` della riga precedente è null): non
  serve codice nuovo, solo un test.
- Nella vista trainee, `compactWeightValue` per `weightType === 'absolute'` con
  `weight = null` vale `'-'`: è lì che va il range.

## Review Focus

1. **Esempio di riferimento** — 1RM 139, `5` @ RPE 8 → `{ min: 110.5, max: 115 }`; reps 13
   o `30"` o `max` → null. Pinned in Task 1.
2. **Peso esplicito vince** — riga con `100`, `75%` o `-10%` → payload con
   `rpeWeightMin/Max = null`; il server azzera anche se il body li manda. Pinned in Task 3
   (server) e Task 6 (client).
3. **Range congelato e copiato** — copy-week / copy-first-week portano i valori salvati;
   nessuna lettura li ricalcola. Pinned in Task 3.
4. **Trainee vede il range** — riga senza peso con range → `110.5–115 kg (RPE 8)` al posto
   di "Non disponibile". Pinned in Task 7.
5. **Zod** — `min > max`, un solo campo valorizzato, valori negativi → 400. Pinned in Task 2.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/calculations.ts` | `rpeWeightRange` | 1 |
| `src/lib/weight-rounding.ts` | `formatWeightRange` | 1 |
| `prisma/schema.prisma`, `prisma/migrations/20261021140000_add_rpe_weight_range/migration.sql` (new) | colonne | 2 |
| `src/schemas/workout-exercise.ts` | campi + refine condiviso | 2 |
| `src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts`, `…/[exerciseId]/route.ts`, `…/bulk/route.ts` | scrittura + invariante | 3 |
| `src/app/api/programs/[id]/copy-week/route.ts`, `copy-first-week/route.ts` | copia | 3 |
| `src/app/api/programs/[id]/review/route.ts`, `src/lib/trainee-program-data.ts`, `src/app/api/trainee/workouts/[id]/route.ts`, `src/app/trainer/programs/[id]/edit/transform-utils.ts` | lettura | 4 |
| `public/locales/{en,it}/{trainer,trainee,validation}.json` | chiavi | 5 |
| `src/app/trainer/programs/[id]/edit/rpe-weight-range.ts` (new), `edit/_content.tsx` | anteprima + payload | 6 |
| `src/app/trainee/workouts/[id]/_content.tsx`, `src/app/trainee/programs/_components/ProgramDetailContent.tsx` | vista trainee | 7 |
| `src/app/trainer/programs/[id]/review/_content.tsx`, `src/lib/program-pdf-export.ts` | review + PDF | 8 |

---

### Task 1: funzione `rpeWeightRange` e formatter

**Model:** sonnet
**Depends on:** none
**Files:** `src/lib/calculations.ts` (modify), `src/lib/weight-rounding.ts` (modify),
`tests/unit/calculations.test.ts` (modify), `tests/unit/weight-rounding.test.ts` (modify if
exists, else new — check `ls tests/unit | grep rounding`)
**Test command:** `npx vitest run tests/unit/calculations.test.ts tests/unit/weight-rounding.test.ts`
**Done when:** `rpeWeightRange(139, 5, 8)` restituisce `{ min: 110.5, max: 115 }` e
`formatWeightRange(110.5, 115)` restituisce `'110.5–115'`.

- [x] **Step 1: tests** — nuovo `describe('rpeWeightRange')` in `calculations.test.ts`:
  - `(139, 5, 8)` → `{ min: 110.5, max: 115 }` (81,1% → 112,729; ×0,98 = 110,47 → 110.5; ×1,02 = 114,98 → 115)
  - `(100, 1, 10)` → `{ min: 98, max: 102 }`
  - `(139, 5, 8.5)` → usa 82,4% (mezzo punto, lookup diretto): `{ min: 112.5, max: 117 }` (verifica i numeri a mano: 114,536 → 112,245 → 112.5; 116,827 → 117)
  - `(139, 12, 8)` → non null; `(139, 13, 8)` → `null`
  - `(139, 0, 8)` → `null`; `(0, 5, 8)` → `null`; `(NaN, 5, 8)` → `null`; `(139, 5, 4)` → `null`
  - `formatWeightRange`: `(110.5, 115)` → `'110.5–115'`; `(100, 102)` → `'100–102'`
- [x] **Step 2: implementation**
  - In `src/lib/weight-rounding.ts`:
    ```ts
    /** "110.5–115" (en dash, no unit). Inputs are already rounded to 0.5 kg. */
    export function formatWeightRange(min: number, max: number): string
    ```
    Numeri con `String(value)` (sono già multipli di 0,5).
  - In `src/lib/calculations.ts`, dopo `intensityFromRpeChart`, importando
    `roundWeightValue` da `./weight-rounding`:
    ```ts
    export interface RpeWeightRange { min: number; max: number }

    /** Proposed kg range: oneRm × chart% ± 2%, each bound ceiled to 0.5 kg. Null outside the chart or without a 1RM. */
    export function rpeWeightRange(oneRm: number, reps: number, rpe: number): RpeWeightRange | null
    ```
    `null` se `oneRm` non finito o `<= 0`; `pct = intensityFromRpeChart(reps, rpe)`, `null`
    se null; poi la formula delle Global Constraints. Costante `RPE_WEIGHT_RANGE_TOLERANCE = 0.02`.
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(weights): add rpeWeightRange helper`

---

### Task 2: colonne DB e schema Zod

**Model:** sonnet
**Depends on:** none
**Files:** `prisma/schema.prisma` (modify),
`prisma/migrations/20261021140000_add_rpe_weight_range/migration.sql` (new),
`src/schemas/workout-exercise.ts` (modify), `tests/unit/schemas.test.ts` o il file sotto
`tests/unit/schemas/` che già testa `workoutExerciseSchema` (modify — `grep -rln workoutExerciseSchema tests/unit`)
**Test command:** `npx vitest run <file trovato sopra>` + `npx prisma validate && npx prisma generate`
**Done when:** il client Prisma generato ha `rpeWeightMin`/`rpeWeightMax` su
`WorkoutExercise` e Zod rifiuta `min > max`.

- [ ] **Step 1: tests** (entrambi gli schemi `workoutExerciseSchema` e `bulkSaveWorkoutExercisesSchema`, riga base valida con `weight: null`, `targetRpe: 8`):
  - `rpeWeightMin: 110.5, rpeWeightMax: 115` → ok
  - campi assenti → ok; entrambi `null` → ok
  - `min 115, max 110.5` → errore, path `['rpeWeightMin']`, message `validation.rpeWeightRangeOrder`
  - solo `rpeWeightMin: 110` → errore `validation.rpeWeightRangeIncomplete`, path `['rpeWeightMax']`
  - `rpeWeightMin: -1, rpeWeightMax: 5` → errore `validation.rpeWeightMinZero`
- [ ] **Step 2: implementation**
  - `schema.prisma`, dopo `effectiveWeight`:
    ```prisma
    rpeWeightMin Float? // kg, range proposto da RPE (congelato al salvataggio)
    rpeWeightMax Float?
    ```
  - migrazione (a mano, niente `migrate dev`):
    ```sql
    ALTER TABLE "workout_exercises"
      ADD COLUMN "rpeWeightMin" DOUBLE PRECISION,
      ADD COLUMN "rpeWeightMax" DOUBLE PRECISION;
    ```
  - Zod: in `workoutExerciseBaseSchema` `rpeWeightMin: z.number().nullable().optional()`,
    idem `rpeWeightMax`. Un helper `refineRpeWeightRange(data, ctx)` (non esportato)
    con le tre regole sopra, chiamato da entrambi i `superRefine`. Le chiavi i18n arrivano
    in Task 5.
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(db): add rpe weight range columns`.
  Nel CHANGELOG un bullet **Deploy**: migrazione da applicare con `npm run prisma:migrate:prod`
  prima del codice.

---

### Task 3: scrittura e copia lato API

**Model:** sonnet
**Depends on:** Task 2
**Files:** `src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts`,
`…/exercises/[exerciseId]/route.ts`, `…/exercises/bulk/route.ts`,
`src/app/api/programs/[id]/copy-week/route.ts`, `src/app/api/programs/[id]/copy-first-week/route.ts`
(modify); `tests/integration/workout-exercises-bulk.test.ts`,
`tests/integration/workout-exercises.test.ts`, `tests/integration/copy-week.test.ts` (modify)
**Test command:** `npx vitest run tests/integration/workout-exercises-bulk.test.ts tests/integration/workout-exercises.test.ts tests/integration/copy-week.test.ts`
**Done when:** bulk save con riga senza peso persiste i due campi; con peso li azzera; copy-week li copia.

- [ ] **Step 1: tests** (seguire i mock prisma già presenti in ciascun file):
  - bulk: riga `weight: null, rpeWeightMin: 110.5, rpeWeightMax: 115` → `update/create` chiamato con quei valori
  - bulk: riga `weight: 100, rpeWeightMin: 110.5, rpeWeightMax: 115` → dati con `rpeWeightMin: null, rpeWeightMax: null`
  - bulk: riga senza i campi → `null, null`
  - POST singolo: stessi due casi (range salvato / azzerato con peso)
  - PUT `[exerciseId]`: `weight: 100` → `rpeWeightMin: null, rpeWeightMax: null` nei dati di update
  - copy-week: sorgente con `rpeWeightMin: 110.5, rpeWeightMax: 115` → target con gli stessi valori (in entrambi i rami se il test copre entrambi)
  - copy-first-week: se esiste un test (`grep -rl copy-first-week tests`), stesso caso; altrimenti aggiungerlo in `copy-week.test.ts` solo se il setup lo rende banale
- [ ] **Step 2: implementation** — accanto a ogni `effectiveWeight` aggiungere i due campi.
  Invariante con un helper in `src/lib/calculations.ts` (usato da tutte e tre le route):
  ```ts
  /** Range is stored only when no weight is assigned. */
  export function storedRpeWeightRange(
      weight: number | null | undefined,
      min: number | null | undefined,
      max: number | null | undefined
  ): { rpeWeightMin: number | null; rpeWeightMax: number | null }
  ```
  `weight != null` → entrambi null; altrimenti `min ?? null`, `max ?? null`. Nella PUT
  (update parziale) applicarlo solo quando `weight !== undefined` oppure i campi range sono
  nel body; altrimenti non toccare le colonne. Copy-week/first-week copiano i valori così
  come sono (sono già coerenti). Aggiungere un test unitario dell'helper in
  `calculations.test.ts` (3 righe: peso → null; nessun peso → valori; tutto undefined → null).
- [ ] **Step 3: run the test command, `npx vitest run tests/unit/calculations.test.ts` and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(api): persist and copy rpe weight range`

---

### Task 4: lettura lato API

**Model:** sonnet
**Depends on:** Task 2
**Files:** `src/app/api/programs/[id]/review/route.ts`, `src/lib/trainee-program-data.ts`,
`src/app/api/trainee/workouts/[id]/route.ts`, `src/app/trainer/programs/[id]/edit/transform-utils.ts`
(modify); `tests/integration/trainee-workout-detail.test.ts`, `tests/unit/trainee-program-data-notes.test.ts`
o `tests/integration/program-detail.test.ts` (modify — scegliere quello che già mocka i workoutExercises)
**Test command:** `npx vitest run tests/integration/trainee-workout-detail.test.ts <secondo file>`
**Done when:** GET trainee workout e i dati del dettaglio programma trainee restituiscono
`rpeWeightMin`/`rpeWeightMax`.

- [ ] **Step 1: tests**
  - trainee workout detail: workoutExercise mock con `weight: null, effectiveWeight: null, rpeWeightMin: 110.5, rpeWeightMax: 115` → risposta con gli stessi due valori ed `effectiveWeight: null`
  - dettaglio programma trainee: stesso caso sull'esercizio mappato
- [ ] **Step 2: implementation**
  - review route: `rpeWeightMin: true, rpeWeightMax: true` nella `select` accanto a `effectiveWeight`.
  - `trainee-program-data.ts`: tipo (~riga 36) e oggetto `base` (~riga 207).
  - `api/trainee/workouts/[id]/route.ts`: oggetto restituito (~riga 205), `we.rpeWeightMin ?? null`.
  - `transform-utils.ts`: `rpeWeightMin: we.rpeWeightMin ?? null`, idem max.
  - `api/programs/[id]/route.ts` usa `include` + spread: nessuna modifica (verificare).
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(api): return rpe weight range in reads`

---

### Task 5: chiavi i18n

**Model:** haiku
**Depends on:** none
**Files:** `public/locales/{en,it}/trainer.json`, `public/locales/{en,it}/trainee.json`,
`public/locales/{en,it}/validation.json` (modify)
**Test command:** `node -e "for (const f of process.argv.slice(1)) JSON.parse(require('fs').readFileSync(f,'utf8').replace(/^﻿/,''))" public/locales/*/trainer.json public/locales/*/trainee.json public/locales/*/validation.json && head -c3 public/locales/en/trainer.json | xxd -p && head -c3 public/locales/it/trainer.json | xxd -p`
**Done when:** JSON validi, BOM `efbbbf` ancora presente in entrambi i `trainer.json`.

- [ ] **Step 1: tests** — nessun test unitario; il test command sopra.
- [ ] **Step 2: implementation** — con Edit (mai riscrivere i file; `trainer.json` ha il BOM):
  - `trainer.json` → `editProgram.rpeWeightRangePreview`: it `"≈ {{range}} kg"`, en `"≈ {{range}} kg"`
  - `trainer.json` → `reviewProgram.tableWeightRpeRange`: it `"Range RPE: {{range}} kg"`, en `"RPE range: {{range}} kg"`
  - `trainee.json` → `workouts.rpeWeightRange`: it `"{{range}} kg (RPE {{rpe}})"`, en `"{{range}} kg (RPE {{rpe}})"`
  - `validation.json` → accanto a `effectiveWeightMinZero`:
    `rpeWeightRangeOrder` (it "Il minimo del range RPE non può superare il massimo", en "RPE range minimum cannot exceed maximum"),
    `rpeWeightRangeIncomplete` (it "Il range RPE richiede minimo e massimo", en "RPE range needs both minimum and maximum"),
    `rpeWeightMinZero` (it "Il range RPE deve essere >= 0", en "RPE range must be >= 0")
- [ ] **Step 3: run the test command**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(i18n): add rpe weight range keys`

---

### Task 6: pagina edit — anteprima e payload

**Model:** sonnet
**Depends on:** Task 1, Task 3, Task 4, Task 5
**Files:** `src/app/trainer/programs/[id]/edit/rpe-weight-range.ts` (new),
`src/app/trainer/programs/[id]/edit/_content.tsx` (modify),
`tests/unit/rpe-weight-range-row.test.ts` (new)
**Test command:** `npx vitest run tests/unit/rpe-weight-range-row.test.ts`
**Done when:** in edit, riga con peso vuoto + RPE 8 + reps 5 su esercizio con PR (1RM 139)
mostra `≈ 110.5–115 kg` in verde, e il salvataggio manda `rpeWeightMin: 110.5, rpeWeightMax: 115`.

- [ ] **Step 1: tests** — `rpeWeightRangeForRow` (stesso stile di `tests/unit/weight-input.test.ts`):
  - `{ weight: '', reps: '5', targetRpe: '8', oneRm: 139 }` → `{ min: 110.5, max: 115 }`
  - `weight: '100'` / `'75%'` / `'-10%'` → `null`
  - `targetRpe: ''` → `null`; `oneRm: undefined` → `null`
  - `reps: '8/10', targetRpe: '8'` → uguale a `reps: '8'`
  - `reps: '30"'` → `null`; `reps: 'max'` → `null`; `reps: '13'` → `null`
  - `weight: '   '` (solo spazi) → calcolato (vuoto)
- [ ] **Step 2: implementation**
  - `edit/rpe-weight-range.ts`:
    ```ts
    import type { RpeWeightRange } from '@/lib/calculations'
    export function rpeWeightRangeForRow(input: {
        weight: string
        reps: string
        targetRpe: string
        oneRm: number | undefined
    }): RpeWeightRange | null
    ```
    `parseWeightInputValue(weight).mode !== 'empty'` → null; RPE vuoto o non numerico → null;
    `oneRm` undefined → null; altrimenti `rpeWeightRange(oneRm, plannedReps(reps.trim()), Number(targetRpe))`.
  - `_content.tsx`:
    - interfaccia `WorkoutExercise` (~riga 129): `rpeWeightMin: number | null`, `rpeWeightMax: number | null`.
    - `buildWorkoutExercisePayload` (~riga 1887): calcola
      `rpeWeightRangeForRow({ weight: row.weight, reps: row.reps, targetRpe: row.targetRpe, oneRm: normalizedOneRMByExercise[row.exerciseId] })`
      e aggiunge `rpeWeightMin: range?.min ?? null, rpeWeightMax: range?.max ?? null`.
    - Rendering riga (~riga 3380): `previewRpeWeightRange` con la stessa chiamata; mappa
      `persistedRpeWeightRangeByRowId` accanto a `persistedEffectiveWeightByRowId` (~riga 2992).
    - Editabile (~riga 3754, nel `div` dopo `<Input>`): se `previewRpeWeightRange` →
      `<p className="text-[11px] font-semibold text-emerald-700 whitespace-nowrap">` con
      `t('editProgram.rpeWeightRangePreview', { range: formatWeightRange(min, max) })`.
      Le due anteprime sono mutuamente esclusive (il range esiste solo a peso vuoto).
    - Sola lettura (~riga 3734): dopo `assignedWeightDisplay`, se il range persistito c'è,
      stesso `<p className="text-[11px] text-emerald-700 whitespace-nowrap">` con la stessa chiave.
    - `skeleton-hydration.ts` e `workout-templates.ts` costruiscono righe con
      `effectiveWeight: null`: se `type-check` lo chiede, aggiungere `rpeWeightMin: null, rpeWeightMax: null`.
- [ ] **Step 3: run the test command, `npx vitest run tests/unit/weight-input.test.ts tests/unit/effective-weight-display.test.ts` and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(programs): propose rpe weight range in editor`

---

### Task 7: vista trainee

**Model:** sonnet
**Depends on:** Task 1, Task 4, Task 5
**Files:** `src/app/trainee/workouts/[id]/_content.tsx`,
`src/app/trainee/programs/_components/ProgramDetailContent.tsx` (modify);
`tests/unit/trainee-workout-focus.test.tsx` (modify)
**Test command:** `npx vitest run tests/unit/trainee-workout-focus.test.tsx`
**Done when:** nella vista workout un esercizio senza peso ma con range mostra
`110.5–115 kg (RPE 8)` invece di "Not available" / `-`.

- [ ] **Step 1: tests** in `trainee-workout-focus.test.tsx` (riusare il fixture con
  `effectiveWeight: null` ~riga 97 o aggiungerne uno):
  - `weightType: 'absolute', weight: null, effectiveWeight: null, targetRpe: 8, rpeWeightMin: 110.5, rpeWeightMax: 115` → testo `110.5–115 kg (RPE 8)` presente
  - `effectiveWeight: 80` con range valorizzato (dato incoerente) → mostra `80`, non il range
  - nessun range → comportamento attuale invariato
- [ ] **Step 2: implementation**
  - workout `_content.tsx`: tipo (~riga 70) con i due campi. Dove si calcola
    `compactWeightValue` (~riga 1058): se `calculatedWeightValue === '-'` e entrambi i campi
    sono numeri → `t('workouts.rpeWeightRange', { range: formatWeightRange(min, max), rpe: we.targetRpe })`
    (vale sia per `absolute` che per gli altri tipi). Non toccare placeholder/valori delle serie.
  - `ProgramDetailContent.tsx`: tipo (~riga 45), mapping (~riga 593); in
    `buildExerciseScheme`, se non è stato aggiunto nessun peso e il range c'è →
    segmento `≈${formatWeightRange(min, max)}kg` (stile compatto senza spazio, come
    `formatEffectiveWeight`). Passare i campi anche dove il componente costruisce gli
    esercizi per il PDF (il formato PDF arriva in Task 8; qui basta che i campi ci siano
    se `type-check` li richiede).
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(trainee): show rpe weight range`

---

### Task 8: review trainer e PDF

**Model:** sonnet
**Depends on:** Task 1, Task 4, Task 5
**Files:** `src/lib/program-pdf-export.ts`, `src/app/trainer/programs/[id]/review/_content.tsx`,
`src/app/trainee/programs/_components/ProgramDetailContent.tsx` (modify);
`tests/unit/program-pdf-export.test.ts` (modify)
**Test command:** `npx vitest run tests/unit/program-pdf-export.test.ts`
**Done when:** PDF e review mostrano `≈ 110.5–115 kg` nella colonna peso di una riga
senza peso con range.

- [ ] **Step 1: tests** — `buildProgramPdfExerciseRow`:
  - `weightType: 'absolute', weight: null, effectiveWeight: null, rpeWeightMin: 110.5, rpeWeightMax: 115` → colonna peso (indice 5) `'≈ 110.5–115 kg'`
  - `weight: 100` con range valorizzato → `'100 kg'` (il peso vince)
  - nessun range e nessun peso → `labels.missingValue` (invariato)
- [ ] **Step 2: implementation**
  - `ProgramPdfExercise` (~riga 10): `rpeWeightMin: number | null`, `rpeWeightMax: number | null`.
  - `buildProgramPdfExerciseRow`: se `weightType === 'absolute'`, peso assegnato nullo e
    range presente → `weightLabel = '≈ ' + formatWeightRange(min, max) + ' kg'`.
  - Review `_content.tsx`: tipo (~riga 46), mapping PDF (~riga 390), e cella peso
    (~riga 806): quando `effectiveWeightValue` non è numero e il range c'è, la riga verde
    mostra `t('reviewProgram.tableWeightRpeRange', { range })` al posto di
    `tableWeightEffective` con `-`. Non mettere il range in `effectiveWeightByExerciseId`
    (non è base per `-x%`).
  - `ProgramDetailContent.tsx` mapping PDF (~riga 593): passa i due campi.
- [ ] **Step 3: run the test command and `npm run type-check`, then the full `npm run test:unit` and `npm run lint`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(programs): show rpe weight range in review and pdf`
