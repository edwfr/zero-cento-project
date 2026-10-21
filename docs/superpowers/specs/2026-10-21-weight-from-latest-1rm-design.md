# Peso calcolato dall'1RM teorico più recente

Data: 2026-10-21 · Taglia: Large (modifica enum Prisma)

## Intento

Il trainer ragiona in percentuale dell'1RM. L'1RM che l'app mostra quando si registra un
massimale è quello teorico, ricavato dalla tabella RPE di Mike Tuchscherer a RPE 10
(`normalizedOneRM()` in `src/lib/calculations.ts`). Ogni peso calcolato deve partire da
quel valore.

Oggi esistono due tipi percentuale sovrapposti:

- `percentage_1rm` (`75%`): percentuale del **miglior** 1RM teorico di sempre;
- `percentage_rm` (`80%RM`): percentuale del PR grezzo con lo stesso numero di reps, senza
  normalizzazione. Senza un PR esatto non produce nessun peso.

`percentage_rm` confonde e non serve: va eliminato. `percentage_1rm` deve usare il PR
**più recente**, non il migliore di sempre. Il trainer registra i PR solo a fine scheda,
quindi il più recente è il massimale attuale dell'atleta.

## Obiettivi

1. Eliminare `percentage_rm` da enum Prisma, schema Zod, tipi TS, calcoli, UI, export PDF,
   metriche SBD e test.
2. Nella pagina di modifica programma, l'input `80%RM` / `%80rm` / `80%rm` produce
   l'errore di formato già esistente (`invalid_format`), come qualsiasi stringa non
   riconosciuta.
3. La base 1RM di `percentage_1rm` diventa `normalizedOneRM(weight, reps)` del PR più
   recente dell'esercizio (ordinato per `recordDate`, indipendentemente dalle reps).
   Vale in ogni punto che sceglie un "1RM per esercizio" (elenco sotto).
4. `percentage_previous` lato server prende come base l'occorrenza precedente **più
   vicina** dello stesso esercizio nello stesso workout, come già fa il client.

## Non-obiettivi

- **Nessun ricalcolo dei pesi già salvati.** `effectiveWeight` si fissa quando il trainer
  salva il workout. I programmi esistenti restano come sono. Il trainee continua a vedere
  il valore salvato.
- Nessuna gestione di PR registrati a metà programma: il trainer li registra a fine scheda.
- Nessuna modifica alla tabella Tuchscherer, al fallback Epley (reps > 12) o
  all'arrotondamento del client (ceil a 0,5 kg).
- Nessuna modifica alle pagine record (`/trainee/records`, `/trainer/trainees/[id]/records`,
  `PersonalRecordsExplorer`, scheda trainee): mostrano lo storico dei PR, non calcolano pesi.
- Nessuna nuova formula RPE → peso.

## Anti-obiettivi

- Pesi diversi per lo stesso esercizio tra edit trainer, review, vista workout trainer e
  vista trainee quando `effectiveWeight` è null. Tutti i punti devono scegliere lo
  stesso 1RM.
- Dati rotti in produzione: la migrazione non deve fallire su righe esistenti.

## Dati di produzione (verificati il 2026-10-21, SELECT di sola lettura)

| `weightType` | Righe | `effectiveWeight` null |
|---|---|---|
| `absolute` | 8.429 | 6.691 (peso vuoto) |
| `percentage_1rm` | 465 | 0 |
| `percentage_previous` | 430 | 43 |
| `percentage_rm` | **0** | – |

Nessuna riga `percentage_rm`: la migrazione è solo strutturale. Per sicurezza la
migrazione converte comunque eventuali righe residue (vedi Migrazione).

## Regola "PR più recente"

Per un trainee e un esercizio:

1. si prendono tutti i `personal_records` dell'esercizio;
2. vince quello con `recordDate` maggiore;
3. **a parità di `recordDate`** vince quello con `normalizedOneRM` maggiore. *Scelta del
   designer, non dell'utente.* L'utente dice che nello stesso giorno non si registrano
   più PR per lo stesso esercizio. La regola esiste solo per rendere il risultato
   deterministico.

1RM base = `normalizedOneRM(pr.weight, pr.reps)`.

La regola va implementata **una volta sola**, come funzione pura in
`src/lib/calculations.ts` (es. `latestNormalizedOneRMByExercise(records)` che accetta
`{ exerciseId, weight, reps, recordDate }[]` e restituisce `Record<exerciseId, number>`),
riusata sia dal client sia dal server. `recordDate` può arrivare come `Date` (Prisma) o
come stringa ISO (JSON lato client): la funzione deve accettare entrambi.

## Punti da modificare

### Rimozione `percentage_rm`

| File | Cosa |
|---|---|
| `prisma/schema.prisma:48` | togliere `percentage_rm` dall'enum. Correggere il commento di `percentage_previous` ("prima occorrenza" → "occorrenza precedente più vicina") |
| nuova migrazione `prisma/migrations/2026102X…_remove_percentage_rm/` | vedi Migrazione |
| `src/schemas/workout-exercise.ts:26,54` | togliere dall'enum Zod e dal commento |
| `src/lib/calculations.ts:84,169` | togliere i `case 'percentage_rm'` da `resolveEffectiveWeight` e `calculateEffectiveWeight` |
| `src/app/trainer/programs/[id]/edit/_content.tsx` | tipo (212), `formatWeightInputFromStoredValues` (249), regex `percentageRmMatch` in `parseWeightInputValue` (285-294), ramo in `resolveWeightInput` (1963-1988) |
| `src/app/trainer/programs/[id]/review/_content.tsx:40,226` | tipo e ramo; `bestWeightByExerciseAndReps` diventa inutile |
| `src/app/api/programs/[id]/review/route.ts` | togliere `bestWeightByExerciseAndReps` e la query `MAX(weight) GROUP BY reps`. Restituire `estimatedOneRMByExercise` calcolato con la nuova regola |
| `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx:298` | etichetta `'% nRM'` |
| `src/app/trainee/workouts/[id]/_content.tsx:68,1051` | tipo e `case` |
| `src/app/trainee/programs/_components/ProgramDetailContent.tsx:28,208` | tipo e `case` |
| `src/lib/program-pdf-export.ts:4,122` | tipo e ramo |
| `src/lib/trainee-program-data.ts:34`, `src/lib/program-sbd-metrics.ts:53`, `src/components/ProgramReportSection.tsx:20` | tipi union |
| `tests/unit/calculations.test.ts`, `tests/unit/schemas.test.ts`, `tests/unit/program-sbd-metrics.test.ts` | togliere i casi `percentage_rm`; aggiungere un test che lo schema Zod **rifiuta** `percentage_rm` |

Alla fine `grep -rn "percentage_rm" src tests` deve restituire zero risultati (le
migrazioni storiche in `prisma/migrations/` e `prisma/init.sql` restano invariate).

Locale `public/locales/{en,it}/trainer.json` (riga ~1109): la chiave `weightPctRm`
("Percentuale di nRM") non è usata in `src` → va rimossa da entrambi i file.
`weightPctPrev` dice "rispetto alla prima occorrenza" / equivalente EN: va corretta in
"occorrenza precedente". I file locale vanno modificati preservando la codifica
originale (BOM, line ending): controllare con `file` prima e dopo.

### Base 1RM = PR più recente

Ogni punto che oggi sceglie il **massimo** `normalizedOneRM` per esercizio:

| File | Oggi |
|---|---|
| `src/lib/calculations.ts` `bestNormalizedOneRMForExercise` + `loadTraineePrMap` | la mappa è `exerciseId:reps → weight` e perde `recordDate` tra reps diverse. Va cambiata (o affiancata) in modo che il resolver conosca il PR più recente per esercizio. Usata da `src/app/api/programs/[id]/route.ts:121`, `src/app/api/trainee/workouts/[id]/route.ts:177`, `src/lib/trainee-program-data.ts:193`, `src/app/api/users/[id]/reports/planned-training-sets/route.ts:130` |
| `src/lib/calculations.ts` `calculateEffectiveWeight` (`percentage_1rm`) | stessa regola. Oggi la funzione è usata solo dai test: l'implementatore può allinearla oppure eliminarla insieme ai suoi test, se nessun chiamante resta |
| `src/app/api/users/[id]/reports/planned-training-sets/route.ts:133-145` | massimo su prMap |
| `src/app/api/programs/[id]/review/route.ts:146-165` | massimo su `MAX(weight) GROUP BY reps` |
| `src/app/trainer/programs/[id]/edit/_content.tsx:1122-1147` `bestPRs` / `normalizedOneRMByExercise` | massimo. Alimenta il calcolo `%1RM`, il pannello "PR" (2904) e le metriche SBD (`ProgramReportSection`, `ProgramChartsDrawer`) |
| `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx:314-325` | massimo. Alimenta il pannello PR (524) e l'intensità SBD |

Anche i pannelli PR di edit e vista workout devono mostrare il PR più recente: il trainer
deve vedere il numero da cui parte il calcolo. *Scelta del designer.* Il testo "1RM
stimato" resta invariato.

`loadTraineePrMap` ha un ordinamento per `recordDate desc` e tiene il primo per
`(exerciseId, reps)`. La forma della mappa può cambiare liberamente, perché tutti i
chiamanti sono nell'elenco sopra.

### `percentage_previous` lato server

In `resolveEffectiveWeight` (`calculations.ts:89-110`) e `calculateEffectiveWeight`
(`:190-215`) la base diventa la riga dello stesso `workoutId` + `exerciseId` con
`order < corrente` e `order` **massimo** (oggi: minimo). Lato client
(`edit/_content.tsx:1993`) è già così. Anche la review
(`review/_content.tsx:823`, mappa `effectiveWeightByExerciseId` sovrascritta riga per riga)
usa già la più vicina: nessuna modifica lì.

## Migrazione

Postgres non permette `ALTER TYPE … DROP VALUE`. Pattern:

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

Generarla con `npm run prisma:migrate` (Prisma produce un SQL equivalente) e aggiungere
l'`UPDATE` in testa. `WeightType` è usato solo da `workout_exercises.weightType`: i
template workout non hanno campi peso.

**Ordine di rilascio:** la migrazione va applicata insieme al codice. Il vecchio codice
non scrive mai `percentage_rm` senza input esplicito del trainer. Quindi il rischio, tra
migrazione e deploy, è solo un salvataggio `%RM` che fallisce. È accettabile.

## Comportamento atteso (esempi)

Trainee con PR squat: 2026-06-01 → 150×1 (1RM teorico 150); 2026-09-30 → 120×5
(1RM teorico 120/0,863 = 139,05 → 139).

| Input | Oggi | Dopo |
|---|---|---|
| `75%` | 150 × 0,75 = 112,5 | 139 × 0,75 = 104,25 → **104,5** |
| `80%RM` (reps 5) | 120 × 0,8 = 96 | **errore di formato** |
| riga A `75%`, riga B `-10%`, riga C `-10%` (stesso esercizio) | C server = A × 0,9 | C = B × 0,9 (client e server) |

## Test richiesti

- Funzione "PR più recente": più date, stessa data con reps diverse (vince l'1RM
  teorico maggiore), `recordDate` come stringa e come `Date`, nessun PR.
- `resolveEffectiveWeight` `percentage_1rm` usa il PR più recente anche quando uno più
  vecchio dà un 1RM più alto.
- `resolveEffectiveWeight` `percentage_previous` con tre occorrenze: base = la più vicina.
- Schema Zod rifiuta `weightType: 'percentage_rm'`.
- `parseWeightInputValue('80%RM')` → `invalid`. Se la funzione non è esportata, o la si
  estrae in un modulo testabile (come `effective-weight-display.ts`) o la si copre con un
  test di componente.
- Metriche SBD (`program-sbd-metrics.test.ts`): nessun cambiamento di logica, solo tipi.

Coverage 80% sui file elencati in `vitest.config.ts`.

## Lasciato all'implementatore

- Forma esatta della nuova struttura PR in `calculations.ts` (mappa estesa o seconda
  mappa), purché la regola stia in un solo posto.
- Se eliminare `calculateEffectiveWeight` (oggi usata solo nei test) o allinearla.
- Se `review/route.ts` calcola la mappa in SQL o in JS, purché usi la funzione condivisa.

## Scelte del designer da verificare

1. A parità di `recordDate` vince l'1RM teorico maggiore.
2. I pannelli PR di edit e vista workout mostrano il PR più recente (non il migliore).
3. La migrazione converte eventuali righe `percentage_rm` residue in `absolute` con il
   loro `effectiveWeight`.
4. `percentage_previous` "più vicina": proposta nel recap e non contestata. Il commento
   nello schema Prisma diceva "prima occorrenza", quindi il comportamento server cambia
   davvero per workout con 3+ occorrenze dello stesso esercizio. I pesi già salvati non
   cambiano.
