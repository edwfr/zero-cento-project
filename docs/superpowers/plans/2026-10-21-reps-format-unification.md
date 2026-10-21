# Reps Format Unification Implementation Plan

> **For agentic workers:** execute with `/feature-implement <this file>` in a fresh
> Sonnet session. Read this header, then one task at a time. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Il trainer inserisce le ripetizioni con un solo formato di range (`8/10`), con limiti di valore e ordine del range validati ovunque, e i calcoli di volume/SBD trattano correttamente secondi e `max`.

**Architecture:** Un modulo condiviso `src/lib/reps.ts` diventa l'unica fonte di verità per formato, validazione (zod + funzione pura) e parsing. Gli schemi programma e template, la validazione di riga della UI e le tre copie di `parseReps*` lo consumano. Una migrazione SQL converte i dati esistenti `a-b` → `a/b`; va deployata prima del nuovo codice.

## Design

### Formato (unico, canonico)

| Input | Significato | Regola |
|---|---|---|
| `8` | ripetizioni singole | intero 1–50 |
| `8/10` | range di ripetizioni | `a < b` (strettamente), entrambi 1–50 |
| `30"` | secondi | intero 1–300 |
| `max` | AMRAP | letterale |

- Il trattino `8-10` **non è più accettato**. `8/10` e `8-10` erano sinonimi nei dati; si tiene `/` perché più leggibile su mobile (decisione utente).
- `6/8` NON è un "drop set": è solo un range. Rimuovere ogni riferimento a "drop" (messaggi zod `Formato drop: "6/8"`, commento in `_content.tsx:2043`).
- Niente range di secondi (`30/45"`): non supportato.

### API di `src/lib/reps.ts`

```ts
export type ParsedReps =
    | { kind: 'reps'; min: number; max: number }   // "8" → min=max=8; "8/10" → 8,10
    | { kind: 'time'; seconds: number }            // `30"`
    | { kind: 'amrap' }                            // "max"

export function parseReps(value: string): ParsedReps | null   // null se formato/limiti/ordine non validi
export function isValidReps(value: string): boolean            // parseReps(value) !== null
export function plannedReps(value: string): number             // reps → min; time/amrap/invalid → 0
export const repsSchema: z.ZodType<string>                     // z.string().refine(isValidReps, 'validation.invalidReps'), trim NON applicato
```

### Semantica nei calcoli

- Range nei calcoli: **minimo** (`plannedReps('8/10') === 8`), come il comportamento attuale.
- Secondi (`30"`) e `max`: **esclusi** da volume pianificato, conteggio SBD e `percentage_rm` (→ `plannedReps` = 0). Oggi `30"` valeva erroneamente 30 reps.
- `percentage_rm` (`calculations.ts`, due punti): se `plannedReps(...) === 0` → ritorna `null` (nessuna ricerca PR). Oggi `max` finiva su "nessun match" comunque; i secondi cercavano un 30RM inesistente.
- Stringhe legacy con `-`: dopo la migrazione non esistono più. Il parser è stretto (restituisce `null`/0), non tollerante.

### Dati esistenti (verificati su produzione, 2026-10-21)

- `workout_exercises`: 4.494 righe `a-b`, 196 righe `a/b`.
- Righe già invalide che la migrazione NON corregge (restano invalide e vengono rifiutate al prossimo salvataggio del trainer): 6 con range invertito/uguale (es. `10-5`), 2 singoli fuori 1–50, 5 range con estremo fuori 1–50. Vanno elencate all'utente (Task 6) per correzione manuale.
- 20 righe `30-45`: dopo la migrazione diventano `30/45` = range di reps valido 30–45. Segnalarle all'utente: probabilmente erano secondi senza `"`.

## Global Constraints

- Before touching code, invoke the matching project skill: `zero-cento-backend`,
  `zero-cento-frontend`, `zero-cento-testing`.
- **Ordine di deploy**: la migrazione dati (Task 6) va applicata PRIMA del nuovo codice. Il vecchio codice accetta già `/`, quindi migrare prima è sicuro; il nuovo codice prima della migrazione rifiuterebbe ogni riga `a-b` esistente al salvataggio del programma.
- Nessuna modifica allo schema Prisma strutturale: solo commenti sui campi `reps` (`WorkoutExercise.reps`, `WorkoutTemplateExercise.reps`).
- I file locale `public/locales/*/*.json` possono avere BOM UTF-8 (`trainer.json` ce l'ha): modificali con `Edit` mirati, mai riscrivere il file intero.
- Le stringhe `validation.invalidReps` sono chiavi i18n: i messaggi zod di `workout-exercise.ts` oggi sono testo italiano inline (`'Formato range: "8-10"'`); sostituirli con la chiave `validation.invalidReps`.
- Tutti i test esistenti che usano `'8-10'` come reps passano a `'8/10'` (sono dati di input, non il comportamento sotto test).
- After each task add an entry at the top of `## [Unreleased]` in
  `implementation-docs/CHANGELOG.md` in the existing format (Italian) and include it in
  the task's commit.
- Commit on the current branch with conventional-commit messages. Do not push.

## Review Focus

1. **Trattino rifiutato** — `8-10` non valido in schema programma, schema template e UI di riga. Pinned in Task 1 e Task 2.
2. **Range invertito/uguale e fuori limite rifiutati** — `10/8`, `8/8`, `0`, `51`, `1/51`, `0"`, `301"`. Pinned in Task 1.
3. **Secondi e max fuori dai calcoli** — `30"` e `max` danno 0 reps pianificate, volume SBD invariato per essi. Pinned in Task 3.
4. **Migrazione idempotente e sicura** — converte solo `^\d+-\d+$`, non tocca `30"`, `max`, singoli. Pinned in Task 6.
5. **Nessuna copia residua di regex reps** — `grep -rnE '\\d\+-\\d\+|\\d\+\\/\\d\+' src` trova solo `src/lib/reps.ts`. Pinned in Task 4.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/reps.ts` | formato, validazione, parsing, `repsSchema` | 1 |
| `tests/unit/lib/reps.test.ts` | test del modulo | 1 |
| `src/schemas/workout-exercise.ts` | usa `repsSchema` (base, update, bulk) | 2 |
| `src/schemas/workout-template.ts` | usa `repsSchema`, rimuove `REPS_PATTERNS` | 2 |
| `tests/unit/workout-template-schema.test.ts` | casi nuovi/aggiornati | 2 |
| `tests/unit/schemas/workout-exercise.test.ts` | nuovo, casi reps dello schema programma | 2 |
| `src/lib/calculations.ts` | `parseReps` → ri-export di `plannedReps`, due `percentage_rm` | 3 |
| `src/lib/program-sbd-metrics.ts` | `parseRepsValue` → `plannedReps` | 3 |
| `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx` | rimuove copia locale `parseRepsValue` | 3 |
| `src/app/trainer/programs/[id]/edit/_content.tsx` | `repsPattern` → `isValidReps`, import `plannedReps` | 4 |
| `src/app/trainer/programs/[id]/edit/reps-utils.ts` | eliminato (non importato) | 4 |
| `public/locales/{it,en}/trainer.json`, `errors.json` | testi formato ammesso | 5 |
| `prisma/migrations/20261021000000_normalize_reps_slash/migration.sql` | conversione dati | 6 |
| `prisma/schema.prisma` | solo commenti | 6 |
| `tests/unit/calculations.test.ts`, `workout-templates.test.ts`, `program-sbd-metrics.test.ts`, `tests/e2e/*` | `'8-10'` → `'8/10'` | 3, 2 |

---

### Task 1: modulo condiviso `reps.ts`

**Model:** sonnet
**Depends on:** none
**Files:** `src/lib/reps.ts` (new), `tests/unit/lib/reps.test.ts` (new)
**Test command:** `npx vitest run tests/unit/lib/reps.test.ts`
**Done when:** `parseReps`/`isValidReps`/`plannedReps`/`repsSchema` esportati con le firme del Design e tutti i casi sotto verdi.

- [x] **Step 1: tests** — `tests/unit/lib/reps.test.ts`:
  - `parseReps('8')` → `{kind:'reps',min:8,max:8}`
  - `parseReps('8/10')` → `{kind:'reps',min:8,max:10}`
  - `parseReps('30"')` → `{kind:'time',seconds:30}`
  - `parseReps('max')` → `{kind:'amrap'}`
  - `parseReps` → `null` per: `''`, `' 8'`, `'8 '`, `'8-10'`, `'10/8'`, `'8/8'`, `'0'`, `'51'`, `'1/51'`, `'0/5'`, `'0"'`, `'301"'`, `'30/45"'`, `'MAX'`, `'8/10/12'`, `'abc'`
  - `parseReps('50')`, `parseReps('1/50')`, `parseReps('300"')` → validi
  - `isValidReps` coerente con `parseReps !== null`
  - `plannedReps`: `'8'`→8, `'8/10'`→8, `'30"'`→0, `'max'`→0, `'8-10'`→0, `''`→0
  - `repsSchema.safeParse('8/10').success` true; `'8-10'` false con message `validation.invalidReps`
- [x] **Step 2: implementation** — un solo `switch` per regex, costanti `REPS_MIN=1`, `REPS_MAX=50`, `SECONDS_MAX=300`. Nessun trim: l'input va già trimmato dal chiamante (la UI fa `row.reps.trim()`).
- [x] **Step 3: run the test command and `npm run type-check`**
- [x] **Step 4: CHANGELOG entry and commit** — `feat(reps): add shared reps format module`

---

### Task 2: schemi programma e template

**Model:** sonnet
**Depends on:** Task 1 (consuma `repsSchema` da `@/lib/reps`: `z.ZodType<string>`, errore `validation.invalidReps`)
**Files:** `src/schemas/workout-exercise.ts` (modify), `src/schemas/workout-template.ts` (modify), `tests/unit/workout-template-schema.test.ts` (modify), `tests/unit/schemas/workout-exercise.test.ts` (new), `tests/unit/lib/workout-templates.test.ts` (modify)
**Test command:** `npx vitest run tests/unit/workout-template-schema.test.ts tests/unit/schemas/workout-exercise.test.ts tests/unit/lib/workout-templates.test.ts`
**Done when:** `reps: '8-10'` rifiutato in `workoutExerciseSchema`, `updateWorkoutExerciseSchema`, `bulkSaveWorkoutExercisesSchema` e `templateExerciseSchema`; `'8/10'` accettato.

- [ ] **Step 1: tests** —
  - schema programma (nuovo file, un `workoutExercise` valido di base con `reps` variabile): `'8'`, `'8/10'`, `'30"'`, `'max'` accettati; `'8-10'`, `'10/8'`, `'0'`, `'51'` rifiutati con `validation.invalidReps`
  - `bulkSaveWorkoutExercisesSchema`: stesso accept/reject su `exercises[0].reps`
  - `updateWorkoutExerciseSchema` (partial): `reps` assente → ok; `'8-10'` → rifiutato
  - template: `'8-10'` ora rifiutato, `'8/10'` accettato; aggiornare gli input `'8-10'` esistenti a `'8/10'`
- [ ] **Step 2: implementation** — in `workout-exercise.ts` sostituire l'intero `z.union([...])` di `reps` con `repsSchema`. **Trappola:** il valore oggi può arrivare anche come `number` (`z.number().int().min(1).max(50)`): controllare i chiamanti (`edit/transform-utils.ts`, route `exercises/bulk`, `copy-week`) per capire se qualcuno invia un numero; se sì, aggiungere `z.coerce`/preprocess che converte `number` in stringa prima di `repsSchema`, altrimenti rimuovere il ramo numerico. In `workout-template.ts` eliminare `REPS_PATTERNS` e il `refine` locale e importare `repsSchema`.
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** — `feat(reps): validate reps via shared schema in program and template`

---

### Task 3: parser nei calcoli

**Model:** sonnet
**Depends on:** Task 1 (consuma `plannedReps(value: string): number` da `@/lib/reps`; 0 per time/amrap/invalid)
**Files:** `src/lib/calculations.ts`, `src/lib/program-sbd-metrics.ts`, `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx` (modify), `tests/unit/calculations.test.ts`, `tests/unit/program-sbd-metrics.test.ts` (modify)
**Test command:** `npx vitest run tests/unit/calculations.test.ts tests/unit/program-sbd-metrics.test.ts`
**Done when:** non esiste più nessuna regex `/^\d+/` su `reps` in `src`; `30"` e `max` danno 0.

- [ ] **Step 1: tests** —
  - `parseReps('8/10')` → 8 (minimo); `parseReps('8')` → 8; `parseReps('30"')` → 0; `parseReps('max')` → 0
  - `percentage_rm` con `reps:'8/10'` cerca il PR a 8 reps (aggiornare il caso esistente a riga ~441/448 da `'8-10'`)
  - `percentage_rm` con `reps:'30"'` e `reps:'max'` → `null` senza interrogare il PR
  - sbd-metrics: esercizio con `reps:'30"'` contribuisce 0 al `liftCount`; `reps:'8/10'`, sets 3 → 24
- [ ] **Step 2: implementation** — in `calculations.ts` mantenere l'export `parseReps(repsString): number` come wrapper di `plannedReps` (è importato da `planned-training-sets/route.ts`), e usarlo nei due `percentage_rm` (righe ~84 e ~172) con `if (targetReps === 0) return null`; aggiornare i commenti "8-10"/"6/8". In `program-sbd-metrics.ts` `parseRepsValue` diventa re-export di `plannedReps` (importato da `review/_content.tsx` e `edit/_content.tsx`). Eliminare la copia locale in `workouts/[wId]/_content.tsx:101` e importare da `@/lib/reps`.
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** — `fix(reps): exclude seconds and max from planned volume`

---

### Task 4: validazione UI della riga e pulizia

**Model:** sonnet
**Depends on:** Task 1 (consuma `isValidReps(value: string): boolean`)
**Files:** `src/app/trainer/programs/[id]/edit/_content.tsx` (modify), `src/app/trainer/programs/[id]/edit/reps-utils.ts` (delete), `src/components/WorkoutTemplateEditor.tsx` (check)
**Test command:** `npx vitest run tests/unit/row-utils.test.ts tests/unit/WorkoutTemplateEditor.test.tsx`
**Done when:** `repsPattern` rimosso, `grep -rnE '\\d\+-\\d\+|\\d\+\\/\\d\+' src` trova solo `src/lib/reps.ts`.

- [ ] **Step 1: tests** — se esiste un test della validazione di riga in `tests/unit/row-utils.test.ts` o `edit-program-start-date.test.tsx` che usa `'8-10'`, aggiornare a `'8/10'` e aggiungere: riga con reps `'8-10'` → messaggio `editProgram.rowValidationReps`. Se la funzione di validazione non è testabile in isolamento, estrarla in un export puro e testarla.
- [ ] **Step 2: implementation** — `_content.tsx:2044` `repsPattern.test(row.reps.trim())` → `isValidReps(row.reps.trim())`, aggiornare commento riga 2043 (niente "drop-set"). Eliminare `reps-utils.ts` dopo `grep -rn reps-utils src tests` per confermare zero import. Controllare in `WorkoutTemplateEditor.tsx` che non ci sia validazione locale delle reps.
- [ ] **Step 3: run the test command and `npm run type-check`**
- [ ] **Step 4: CHANGELOG entry and commit** — `refactor(reps): use shared validation in program editor`

---

### Task 5: testi i18n

**Model:** haiku
**Depends on:** none
**Files:** `public/locales/it/trainer.json`, `public/locales/en/trainer.json`, `public/locales/it/errors.json`, `public/locales/en/errors.json` (modify)
**Test command:** `npx vitest run tests/unit/lib/i18n-provider.test.tsx`
**Done when:** nessuna stringa locale cita `8-10` o `6/8` come formato ammesso.

- [ ] **Step 1: tests** — nessuno nuovo.
- [ ] **Step 2: implementation** — con `Edit` mirati (BOM!):
  - `trainer.json` riga 799 (`editProgram.repsPlaceholder`): it `Valori ammessi: 8, 8/10, 30", max`; en `e.g. 8, 8/10, 30", max`
  - `trainer.json` riga 830 (`rowValidationReps`): it `Ripetizioni non valide (es. 8, 8/10, 30", max; 1-50, secondi 1-300)`; en equivalente
  - `trainer.json` riga 1091 (`templates.repsPlaceholder`): `es. 8/10` / `e.g. 8/10`
  - `errors.json` riga 171 (`invalidReps`): it `Ripetizioni non valide (es. 8, 8/10, 30", max).`; en `Invalid reps (e.g. 8, 8/10, 30", max).`
- [ ] **Step 3: run the test command**
- [ ] **Step 4: CHANGELOG entry and commit** — `chore(i18n): update reps format hints`

---

### Task 6: migrazione dati e commenti schema

**Model:** sonnet
**Depends on:** none (ma va APPLICATA in produzione prima del deploy del codice: vedi Global Constraints)
**Files:** `prisma/migrations/20261021000000_normalize_reps_slash/migration.sql` (new), `prisma/schema.prisma` (modify, solo commenti)
**Test command:** `npm run type-check`
**Done when:** la migrazione esiste ed è idempotente; i commenti di `reps` citano il nuovo formato.

- [ ] **Step 1: tests** — nessun test automatico; verifica manuale della SQL con query `SELECT count(*)` prima/dopo su un DB locale se disponibile.
- [ ] **Step 2: implementation** — migrazione (completa, non derivabile):

  ```sql
  -- Unify reps range format: "8-10" -> "8/10" (the "/" form is the canonical one).
  UPDATE "workout_exercises"
  SET "reps" = replace("reps", '-', '/')
  WHERE "reps" ~ '^\d+-\d+$';

  UPDATE "workout_template_exercises"
  SET "reps" = replace("reps", '-', '/')
  WHERE "reps" ~ '^\d+-\d+$';
  ```

  Commenti Prisma: `WorkoutExercise.reps` → `// "8", "8/10", `30"`, "max"`; `WorkoutTemplateExercise.reps` → `// same format as WorkoutExercise.reps`. Non eseguire `prisma migrate` contro produzione: solo creare il file. Poi, con l'MCP Supabase (sola lettura), eseguire questa query e riportarne l'output all'utente come elenco da correggere a mano, senza modificare nulla:

  ```sql
  select reps, count(*) from workout_exercises
  where (reps ~ '^\d+[-/]\d+$' and split_part(replace(reps,'-','/'),'/',1)::int >= split_part(replace(reps,'-','/'),'/',2)::int)
     or (reps ~ '^\d+$' and reps::int not between 1 and 50)
     or (reps ~ '^\d+[-/]\d+$' and (split_part(replace(reps,'-','/'),'/',2)::int > 50 or split_part(replace(reps,'-','/'),'/',1)::int < 1))
  group by reps order by 2 desc;
  ```
- [ ] **Step 3: `npm run type-check` e `npx prisma validate`**
- [ ] **Step 4: CHANGELOG entry and commit** — `chore(db): normalize reps range format to slash`

---

### Task 7: test residui `'8-10'`

**Model:** haiku
**Depends on:** Task 2
**Files:** `tests/e2e/*` (modify), altri test che contengono `'8-10'`
**Test command:** `npx vitest run`
**Done when:** `grep -rn "8-10" tests src` non trova più il formato reps (le date tipo `2026-10-15` non contano).

- [ ] **Step 1: tests** — sostituire `'8-10'`/`"8-10"` usati come reps con `'8/10'`.
- [ ] **Step 2: implementation** — nessuna.
- [ ] **Step 3: run the test command and `npm run lint`**
- [ ] **Step 4: CHANGELOG entry and commit** — `test(reps): use slash range format in fixtures`
