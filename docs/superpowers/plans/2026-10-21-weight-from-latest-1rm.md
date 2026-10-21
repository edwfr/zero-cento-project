# Peso dall'1RM teorico più recente — Implementation Plan

> **For agentic workers:** execute with `/feature-implement <this file>` in a fresh
> Sonnet session. Read this header, then one task at a time. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** ogni peso `%1RM` parte dall'1RM teorico (`normalizedOneRM`) del PR **più recente**
dell'esercizio, `percentage_previous` usa l'occorrenza precedente più vicina anche lato
server, e il tipo `percentage_rm` (`80%RM`) sparisce dall'app.

**Architecture:** la regola "PR più recente" vive una sola volta in `src/lib/calculations.ts`
come funzione pura, riusata da server (loader della mappa 1RM, review API) e client
(edit programma, vista workout trainer). La mappa server cambia forma: da
`exerciseId:reps → weight` a `exerciseId → 1RM teorico`, così il resolver non sceglie più
nulla. `calculateEffectiveWeight` (async, usata solo dai test) viene eliminata. La
rimozione dell'enum è l'ultimo task: migrazione Postgres scritta a mano + pulizia di ogni
riferimento TS.

**Spec:** `docs/superpowers/specs/2026-10-21-weight-from-latest-1rm-design.md`

## Global Constraints

- Before touching code, invoke the matching project skill: `zero-cento-backend`,
  `zero-cento-frontend`, `zero-cento-testing`.
- Regola PR più recente: `recordDate` maggiore vince; a parità di `recordDate` vince
  `normalizedOneRM(weight, reps)` maggiore. 1RM base = `normalizedOneRM(pr.weight, pr.reps)`.
  Implementata **solo** in `latestPersonalRecordByExercise` (Task 1); nessun altro file
  ordina PR per scegliere un 1RM.
- Nessun ricalcolo di `effectiveWeight` già salvati; nessuna modifica a tabella
  Tuchscherer, fallback Epley, `roundWeightValue` (ceil 0,5 kg) del client.
- Pagine record (`/trainee/records`, `/trainer/trainees/[id]/records`,
  `PersonalRecordsExplorer`, scheda trainee) **non** si toccano.
- Testo "1RM stimato" nei pannelli PR invariato.
- Coverage: soglie in `vitest.config.ts` (`src/lib/**` 96/96/98/90, `src/app/api/**`
  92/91/95/87, `src/schemas/**` 95/95/96/87) non devono scendere.
- After each task add an entry at the top of `## [Unreleased]` in
  `implementation-docs/CHANGELOG.md` in the existing format (Italian, `### type(scope): titolo (21/10/2026)` + bullet + "Motivo:") and include it in the task's commit.
- Commit on the current branch with conventional-commit messages. Do not push.

## Deviations from the spec

- **Migrazione scritta a mano**, non generata con `npm run prisma:migrate`
  (`prisma migrate dev` applica al DB puntato da `.env`, che potrebbe essere Supabase
  di produzione). Nessun comando `migrate` va eseguito in questo piano; si valida con
  `npx prisma validate` + `npx prisma generate`. Il deploy applica con
  `npm run prisma:migrate:prod`.
- **Mappa server rinominata**: `TraineePrMap`/`loadTraineePrMap` →
  `TraineeOneRmMap`/`loadTraineeOneRmMap` (la semantica cambia, il nome deve dirlo).
- **`calculateEffectiveWeight` eliminata** con i suoi test (nessun chiamante in `src`).
  Era una scelta lasciata all'implementatore: decisa qui.
- **Review API**: la query `$queryRaw … MAX(weight) GROUP BY reps` diventa
  `prisma.personalRecord.findMany` + funzione condivisa in JS (la MAX perde `recordDate`).
- **Parser input peso estratto** in `src/app/trainer/programs/[id]/edit/weight-input.ts`
  per testarlo unitariamente (come `effective-weight-display.ts`).

## Traps found while exploring

- `tests/unit/calculations.test.ts` → `'resolves a chain that ends on an absolute weight'`
  oggi si aspetta **110** (base = prima occorrenza). Con la regola nuova diventa **121**
  (100 → 110 → 121). Va aggiornato, non è una regressione.
- Stesso file → `'stops a self-referencing chain with the recursion-depth error'`: oggi si
  aspetta `noPreviousOccurrenceFound` (salto diretto alla riga 1). Con la più vicina la
  catena di 13 righe supera `depth > 10` prima di arrivare alla riga 1 → deve aspettarsi
  `CALCULATION_ERROR_KEYS.maxRecursionDepthExceeded` (che è anche ciò che dice il nome).
- `tests/integration/program-lifecycle.test.ts` mocka `prismaMock.$queryRaw` per la review
  e asserisce `bestWeightByExerciseAndReps`: va riscritto su `personalRecord.findMany`.
- `tests/integration/trainee-workout-detail.test.ts` mocka `loadTraineePrMap` per nome:
  rinominare insieme alla funzione.
- `public/locales/{en,it}/trainer.json` sono **UTF-8 con BOM**: `file` prima e dopo deve
  dire ancora `UTF-8 (with BOM)`. Modificare con Edit, non con `jq`/riscrittura completa.
- Il parser client `%1RM` usa `^%(\d+)(?:1rm)?$`: dopo la rimozione del ramo `%RM`,
  `%80rm`/`80%rm` cadono nel ramo `invalid` senza altre modifiche. Non allargare le regex.
- Client components importano già `normalizedOneRM` da `@/lib/calculations` (che importa
  `prisma`): è il pattern esistente, la nuova funzione pura va nello stesso file come da
  spec.
- `recordDate` arriva come `Date` dal server e come stringa ISO (o `undefined`, vedi
  `PersonalRecord.recordDate?: string` in edit) dal client.

## Review Focus

1. **Stesso 1RM ovunque** — edit trainer, review, vista workout trainer, API trainee e
   report planned-training-sets usano tutti `latestPersonalRecordByExercise` /
   `latestNormalizedOneRMByExercise`; `grep -rn "normalizedOneRM(" src` fuori da
   `calculations.ts` e dalle pagine record non deve più selezionare un massimo. Pinned in
   Task 1 (funzione), Task 2 (review), Task 3 (client).
2. **PR vecchio più alto ignorato** — 150×1 del 2026-06-01 e 120×5 del 2026-09-30 → 1RM
   139; `75%` → server 104,25, client 104,5. Pinned in Task 1 e Task 3.
3. **Stessa data, reps diverse** → vince l'1RM teorico maggiore, in modo deterministico
   indipendentemente dall'ordine di input. Pinned in Task 1.
4. **Tre occorrenze `percentage_previous`** — C si calcola su B, non su A. Pinned in Task 1.
5. **`80%RM` / `%80rm` / `80%rm`** → errore `invalid_format`; Zod rifiuta
   `weightType: 'percentage_rm'`; migrazione non fallisce su righe residue. Pinned in Task 4.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/calculations.ts` | regola PR più recente, mappa 1RM, resolver | 1, 4 |
| `src/app/api/programs/[id]/route.ts`, `src/app/api/trainee/workouts/[id]/route.ts`, `src/lib/trainee-program-data.ts` | rinomina loader | 1 |
| `src/app/api/users/[id]/reports/planned-training-sets/route.ts` | usa la mappa 1RM diretta | 1 |
| `src/app/api/programs/[id]/review/route.ts` | `estimatedOneRMByExercise` dal PR più recente | 2 |
| `src/app/trainer/programs/[id]/review/_content.tsx` | togliere `bestWeightByExerciseAndReps` e ramo `%RM` | 2 |
| `src/app/trainer/programs/[id]/edit/_content.tsx` | `bestPRs` → PR più recenti | 3, 4 |
| `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx` | `bestPRs` → PR più recenti | 3, 4 |
| `src/app/trainer/programs/[id]/edit/weight-input.ts` (new) | parser/formatter input peso | 4 |
| `prisma/schema.prisma`, `prisma/migrations/20261021120000_remove_percentage_rm/migration.sql` (new) | enum | 4 |
| `src/schemas/workout-exercise.ts`, tipi union, PDF, trainee pages, locale | rimozione `percentage_rm` | 4 |

---

### Task 1: Regola "PR più recente" + resolver server

**Model:** sonnet
**Depends on:** none
**Files:** `src/lib/calculations.ts` (modify), `src/app/api/programs/[id]/route.ts`,
`src/app/api/trainee/workouts/[id]/route.ts`, `src/lib/trainee-program-data.ts`,
`src/app/api/users/[id]/reports/planned-training-sets/route.ts` (modify),
`tests/unit/calculations.test.ts`, `tests/integration/trainee-workout-detail.test.ts` (modify)
**Test command:** `npx vitest run tests/unit/calculations.test.ts tests/integration tests/unit/lib/trainee-program-data.test.ts`
**Done when:** `resolveEffectiveWeight` `percentage_1rm` usa il PR più recente;
`percentage_previous` usa l'occorrenza più vicina; nessun riferimento a `TraineePrMap`,
`loadTraineePrMap`, `bestNormalizedOneRMForExercise`, `calculateEffectiveWeight` in `src`
e `tests`.

Signatures (in `src/lib/calculations.ts`, esportate):

```ts
export interface PersonalRecordInput {
    exerciseId: string
    weight: number
    reps: number
    recordDate?: Date | string | null
}

/** Most recent PR per exercise. Ties on recordDate → higher normalizedOneRM wins.
 *  Missing/invalid recordDate counts as the oldest possible date. */
export function latestPersonalRecordByExercise<T extends PersonalRecordInput>(
    records: readonly T[]
): Record<string, T>

/** normalizedOneRM(weight, reps) of latestPersonalRecordByExercise. */
export function latestNormalizedOneRMByExercise(
    records: readonly PersonalRecordInput[]
): Record<string, number>

/** exerciseId → theoretical 1RM of the most recent PR. */
export type TraineeOneRmMap = Map<string, number>

export async function loadTraineeOneRmMap(traineeId: string): Promise<TraineeOneRmMap>

export function resolveEffectiveWeight(
    workoutExercise: WorkoutExercise,
    oneRmMap: TraineeOneRmMap,
    workoutSiblings: WorkoutExercise[],
    depth = 0
): number | null
```

- [x] **Step 1: tests** — `tests/unit/calculations.test.ts`
  - Elimina l'intero `describe('calculateEffectiveWeight')` (righe ~235-1094) e l'helper
    `calculateEffectiveWeight`/`normalizeWorkoutExercise` se resta inutilizzato.
  - Elimina `describe('percentage_rm')` dentro `resolveEffectiveWeight`.
  - Nuovo `describe('latestPersonalRecordByExercise')`:
    - 150×1 `2026-06-01` + 120×5 `2026-09-30` → record 120×5
    - stessa data, 100×1 e 100×5 → 100×5 (1RM teorico maggiore); stesso risultato con input invertito
    - mix `new Date('2026-06-01')` e `'2026-09-30T00:00:00.000Z'` → vince la stringa più recente
    - due esercizi → una chiave per ciascuno
    - `[]` → `{}`
  - Nuovo `describe('latestNormalizedOneRMByExercise')`: esempio spec (150×1 del 2026-06-01, 120×5 del 2026-09-30) → `{ [EX_1]: 139 }`.
  - `resolveEffectiveWeight` `percentage_1rm` (le mappe diventano `new Map([[EX_1, 100]])`):
    - mappa `{EX_1: 100}`, weight 80 → 80
    - mappa `{EX_1: 139}`, weight 75 → 104.25 (esempio spec, server non arrotonda)
    - mappa senza EX_1 → null
    - weight null → 0
    - rimuovere `'picks the best record across rep ranges'` e `'ignores … malformed keys'` (non più applicabili).
  - `percentage_previous`:
    - `'resolves a chain …'` → aggiornare attesa a `toBeCloseTo(121, 6)` e commento
    - nuovo: A absolute 100 (order 1), B `-10` (order 2), C `-10` (order 3), siblings in ordine sparso `[third, first, second]` → C = 81
    - `'stops a self-referencing chain …'` → `CALCULATION_ERROR_KEYS.maxRecursionDepthExceeded`
  - `describe('loadTraineePrMap')` → `loadTraineeOneRmMap`:
    - 150×1 `2026-06-01` + 120×5 `2026-09-30` → `map.get(EX_1) === 139`, `map.size === 1`
    - query: `where: { traineeId: 'trainee-1' }`, `select` include `recordDate`
  - `tests/integration/trainee-workout-detail.test.ts`: rinomina mock e import in `loadTraineeOneRmMap`.
- [x] **Step 2: implementation**
  - `latestPersonalRecordByExercise`: un passaggio, per esercizio tiene il candidato se
    `time > currentTime` oppure `time === currentTime && normalizedOneRM(c) > normalizedOneRM(current)`.
    Tempo = `new Date(recordDate).getTime()`, `NaN`/assente → `-Infinity`.
  - `loadTraineeOneRmMap`: `findMany({ where: { traineeId }, select: { exerciseId, reps, weight, recordDate } })`
    (nessun `orderBy` necessario), poi `new Map(Object.entries(latestNormalizedOneRMByExercise(records)))`.
  - `resolveEffectiveWeight`: `percentage_1rm` → `oneRmMap.get(exerciseId)`, `undefined` → null;
    togli `case 'percentage_rm'`; `percentage_previous` → sort per `order` **desc**, `[0]`.
    Aggiorna il JSDoc (non cita più `calculateEffectiveWeight`).
  - Elimina `prKey`, `bestNormalizedOneRMForExercise`, `calculateEffectiveWeight`, `TraineePrMap`.
    Togli l'import di `PersonalRecord` se inutilizzato.
  - Chiamanti: rinomina import/chiamate in `programs/[id]/route.ts:121`,
    `trainee/workouts/[id]/route.ts:177`, `trainee-program-data.ts:193` (il fallback
    `new Map<string, number>()` resta valido).
  - `planned-training-sets/route.ts:130-145`: `loadTraineeOneRmMap(id)`; elimina il loop
    sul prMap; `normalizedOneRMByExercise = Object.fromEntries(oneRmMap)`. Togli
    l'import di `normalizedOneRM` se inutilizzato.
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(weights): base %1RM from latest PR, nearest previous occurrence`

---

### Task 2: Review API e pagina review

**Model:** sonnet
**Depends on:** Task 1
**Files:** `src/app/api/programs/[id]/review/route.ts`, `src/app/trainer/programs/[id]/review/_content.tsx`,
`tests/integration/program-lifecycle.test.ts` (modify)
**Test command:** `npx vitest run tests/integration/program-lifecycle.test.ts`
**Done when:** la risposta review contiene `program` ed `estimatedOneRMByExercise` (PR più
recente), non più `bestWeightByExerciseAndReps`; la pagina review non legge più quel campo.

Consumes (from `src/lib/calculations.ts`):
`latestNormalizedOneRMByExercise(records: readonly { exerciseId: string; weight: number; reps: number; recordDate?: Date | string | null }[]): Record<string, number>`

- [ ] **Step 1: tests** — `tests/integration/program-lifecycle.test.ts` (describe review):
  - `beforeEach`: `prismaMock.personalRecord.findMany.mockResolvedValue([])` al posto di `$queryRaw`
  - PR 150×1 `2026-06-01` + 120×5 `2026-09-30` → `estimatedOneRMByExercise['ex-1'] === 139`
  - nessun PR → `estimatedOneRMByExercise` `{}`; `body.data.bestWeightByExerciseAndReps` `undefined`
  - `findMany` chiamato con `where: { traineeId: TRAINEE_ID }`
- [ ] **Step 2: implementation**
  - Route: nel `Promise.all` sostituisci `$queryRaw` con
    `prisma.personalRecord.findMany({ where: { traineeId: programMeta.traineeId }, select: { exerciseId: true, reps: true, weight: true, recordDate: true } })`;
    `estimatedOneRMByExercise = latestNormalizedOneRMByExercise(records)`;
    `apiSuccess({ program, estimatedOneRMByExercise })`. Aggiorna il commento di testa
    (niente più GROUP BY / `bestWeightByExerciseAndReps`). Import `normalizedOneRM` → rimuovi.
  - Client: elimina state/setter/prop `bestWeightByExerciseAndReps`, il ramo
    `percentage_rm` di `resolveEffectiveWeightFallback` (:226-240) e `'percentage_rm'`
    dal tipo locale (:40) (`formatPlannedWeight` non ha un ramo `%RM`). Se `parseRepsValue`
    resta inutilizzato, rimuovilo.
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(review): estimated 1RM from latest PR`

---

### Task 3: Edit programma e vista workout trainer usano il PR più recente

**Model:** sonnet
**Depends on:** Task 1
**Files:** `src/app/trainer/programs/[id]/edit/_content.tsx`,
`src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx` (modify)
**Test command:** `npx vitest run tests/unit` (esistenti, nessun nuovo test: la logica è in Task 1)
**Done when:** con PR 150×1 (2026-06-01) e 120×5 (2026-09-30), in edit `75%` mostra
104,5 kg e il pannello PR mostra 120×5 del 30/09/2026; la vista workout mostra lo stesso PR.

Consumes (from `src/lib/calculations.ts`):
`latestPersonalRecordByExercise<T extends { exerciseId: string; weight: number; reps: number; recordDate?: Date | string | null }>(records: readonly T[]): Record<string, T>`

- [ ] **Step 1: implementation (edit)** — `edit/_content.tsx:1122-1147`:
  `bestPRs` diventa `Object.values(latestPersonalRecordByExercise(personalRecords))`
  ordinato per `normalizedOneRM` desc (ordinamento di visualizzazione invariato);
  `normalizedOneRMByExercise` invariato nella forma (deriva da `bestPRs`). Rinomina
  `bestPRs` → `latestPRs` in tutto il file (incluso pannello ~:2904). Se
  `recordsByExercise` resta usato solo dal ramo `percentage_rm` (:1963), lascialo:
  sparisce in Task 4.
- [ ] **Step 2: implementation (vista workout)** — `workouts/[wId]/_content.tsx:305-325`:
  stessa sostituzione; `recordsByExercise` diventa inutile → eliminalo. Rinomina
  `bestPRs` → `latestPRs` (pannello ~:524).
- [ ] **Step 3: run the test command, `npm run type-check`, `npm run lint`**; verifica
  manuale con `npm run dev` se disponibile un trainee con due PR in date diverse.
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(programs): show and use latest PR as 1RM base`

---

### Task 4: Rimozione `percentage_rm`

**Model:** sonnet
**Depends on:** Task 1, 2, 3
**Files:** `prisma/schema.prisma`, `prisma/migrations/20261021120000_remove_percentage_rm/migration.sql` (new),
`src/schemas/workout-exercise.ts`, `src/lib/calculations.ts`,
`src/app/trainer/programs/[id]/edit/weight-input.ts` (new), `src/app/trainer/programs/[id]/edit/_content.tsx`,
`src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx`, `src/app/trainee/workouts/[id]/_content.tsx`,
`src/app/trainee/programs/_components/ProgramDetailContent.tsx`, `src/lib/program-pdf-export.ts`,
`src/lib/trainee-program-data.ts`, `src/lib/program-sbd-metrics.ts`, `src/components/ProgramReportSection.tsx`,
`public/locales/{en,it}/trainer.json`, `tests/unit/schemas.test.ts`, `tests/unit/program-sbd-metrics.test.ts`,
`tests/unit/weight-input.test.ts` (new)
**Test command:** `npx vitest run tests/unit/weight-input.test.ts tests/unit/schemas.test.ts tests/unit/program-sbd-metrics.test.ts`
**Done when:** `grep -rn "percentage_rm\|weightPctRm\|bestWeightByExerciseAndReps" src tests public/locales` → zero;
`npx prisma validate` ok; `80%RM` in edit → errore di formato.

- [ ] **Step 1: tests**
  - `tests/unit/weight-input.test.ts` (new), su `parseWeightInputValue`:
    `'80%RM'`, `'%80rm'`, `'80%rm'` → `{ mode: 'invalid', value: null }` (o la forma
    `invalid` esistente); `'75%'`, `'%75'`, `'75%1RM'` → `{ mode: 'percentage_1rm', value: 75 }`;
    `'-10%'` → `percentage_previous`, -10; `'100'`, `'100kg'` → `absolute` 100; `''` → `empty`.
    `formatWeightInputFromStoredValues`: `('percentage_1rm', 75)` → `'75%'`, `('absolute', 100)` → `'100'`, `('absolute', null)` → `''`.
  - `tests/unit/schemas.test.ts:1065,1075`: togli `'percentage_rm'` dagli `it.each`; nuovo
    test: `weightType: 'percentage_rm', weight: 80` → `success === false`.
  - `tests/unit/program-sbd-metrics.test.ts:28`: togli `'percentage_rm'` dal tipo.
- [ ] **Step 2: migrazione** — `prisma/migrations/20261021120000_remove_percentage_rm/migration.sql`:

  ```sql
  -- Safety net: prod had 0 rows on 2026-10-21; convert any leftover to absolute
  UPDATE "workout_exercises"
  SET "weightType" = 'absolute', "weight" = "effectiveWeight"
  WHERE "weightType" = 'percentage_rm';

  ALTER TYPE "WeightType" RENAME TO "WeightType_old";
  CREATE TYPE "WeightType" AS ENUM ('absolute', 'percentage_1rm', 'percentage_previous');
  ALTER TABLE "workout_exercises"
    ALTER COLUMN "weightType" TYPE "WeightType" USING ("weightType"::text::"WeightType");
  DROP TYPE "WeightType_old";
  ```

  `workout_exercises.weightType` non ha `@default` (`schema.prisma:367`): nessun
  `DROP/SET DEFAULT` necessario. **Non eseguire** `prisma migrate dev`/`deploy`.
  `schema.prisma`: togli `percentage_rm`; commento di `percentage_previous` →
  "percentuale relativa all'occorrenza precedente più vicina dell'esercizio nel workout".
  Poi `npx prisma validate && npx prisma generate`.
- [ ] **Step 3: parser** — crea `edit/weight-input.ts` spostando da `edit/_content.tsx`
  `ParsedWeightInputMode`, `ParsedWeightInputValue`, `parseWeightInputValue`,
  `formatWeightInputFromStoredValues` (export), senza il ramo `percentageRmMatch` né il
  mode `'percentage_rm'`. `WeightType` si importa da `@prisma/client` (come fa oggi
  `_content.tsx:7`). In `_content.tsx`: import
  dal nuovo modulo; elimina il ramo `parsedInput.mode === 'percentage_rm'` (:1963-1988) e
  `recordsByExercise` se ora inutilizzato.
- [ ] **Step 4: resto dei riferimenti** — `src/schemas/workout-exercise.ts:26,54` (enum e
  commento); `calculations.ts` (eventuali residui); `workouts/[wId]/_content.tsx:298`
  (etichetta); `trainee/workouts/[id]/_content.tsx:68,1051`;
  `ProgramDetailContent.tsx:28,208`; `program-pdf-export.ts:4,122`; tipi union in
  `trainee-program-data.ts:34`, `program-sbd-metrics.ts:53`, `ProgramReportSection.tsx:20`.
  Locale: rimuovi `weightPctRm` da entrambi; `weightPctPrev` →
  it `"Percentuale rispetto all'occorrenza precedente"`,
  en `"Percentage relative to the previous occurrence"`. `file public/locales/*/trainer.json`
  deve ancora riportare `UTF-8 (with BOM)`.
- [ ] **Step 5: verifica completa** — test command, poi `npm run test:unit`,
  `npm run type-check`, `npm run lint`, `npm run build`, e il grep del "Done when".
- [ ] **Step 6: CHANGELOG entry and commit** — `feat(weights)!: remove percentage_rm weight type`.
  Nel CHANGELOG annota: la migrazione `20261021120000_remove_percentage_rm` va applicata
  con `npm run prisma:migrate:prod` insieme al deploy del codice.
