# Range di peso proposto da RPE

Data: 2026-10-21 · Taglia: Large (nuove colonne su `workout_exercises`)
Dipende da: `2026-10-21-weight-from-latest-1rm-design.md` (base 1RM = PR più recente).
Se arriva dopo `2026-10-21-bodyweight-loaded-exercises-design.md`, usa la tabella RPE
dell'esercizio (vedi "Interazione con esercizi zavorrati").

## Intento

Spesso il trainer programma con reps + RPE e non scrive i kg. L'atleta però ha bisogno di
un numero da cui partire. Se per quell'esercizio esiste un massimale, l'app propone un
range di kg ricavato dalla tabella RPE, partendo dall'1RM teorico (RPE 10 normalizzato).

## Comportamento (deciso dall'utente)

- **Condizioni:** peso vuoto + `targetRpe` impostato + massimale registrato per
  quell'esercizio del trainee.
- **Calcolo:** `centro = 1RM_teorico × %tabella[reps][RPE] / 100`, range = `centro ± 2%`.
- **Senza massimale:** nessun calcolo, nessun range.
- **Peso esplicito del trainer** (kg, %1RM, -x%): sovrascrive la proposta, il range non
  viene calcolato.

Esempio: 1RM teorico 139, `5` reps @ RPE 8 → 139 × 81,1% = 112,73 →
min 110,47, max 114,98 → **110,5 – 115 kg**.

## Obiettivi

1. Pagina di modifica programma: anteprima live del range accanto al campo peso vuoto
   (stesso stile verde di `editProgram.effectiveWeightPreview`), es. `≈ 110,5–115 kg`.
2. Il range viene **salvato** quando si salva il workout, come oggi `effectiveWeight`: è
   congelato e non cambia se più avanti arrivano nuovi PR.
3. L'atleta vede il range nella vista workout e nel dettaglio programma. Il range compare
   anche nella review trainer e nell'export PDF.

## Non-obiettivi

- Nessun ricalcolo dei range già salvati.
- Nessuna proposta quando le reps sono a tempo (`30"`), `max`/AMRAP o vuote.
- Nessuna modifica al calcolo dell'intensità SBD: usa già `targetRpe` con la tabella.
- Il trainer non ha nessun pulsante "accetta proposta": il range è solo informativo.

## Regole di calcolo

| Caso | Regola | Di chi |
|---|---|---|
| reps a range `8/10` | si usano le reps pianificate (`plannedReps` → minimo, 8) | designer |
| reps > 12 (fuori tabella Tuchscherer) | nessun range. Epley non conosce l'RPE | designer |
| RPE a mezzo punto (8,5) | lookup diretto: la tabella Tuchscherer ha già i mezzi punti | — |
| arrotondamento | `min` e `max` arrotondati per eccesso a 0,5 kg con `roundWeightValue` (come gli altri pesi del client) | designer |
| `-10%` su una riga che ha solo il range | la riga `-10%` non ha base → nessun peso (come oggi con base nulla) | designer |
| 1RM | `normalizedOneRM` del PR più recente (spec 1) | utente |

Implementazione: funzione pura in `src/lib/calculations.ts`, es.
`rpeWeightRange(oneRm, reps, rpe): { min: number; max: number } | null`, basata su
`intensityFromRpeChart` (già esistente). Restituisce null fuori tabella. Una sola
funzione per client e server.

## Modello dati

Nuove colonne nullable su `WorkoutExercise` (`workout_exercises`):

```prisma
rpeWeightMin Float? // kg, range proposto da RPE (congelato al salvataggio)
rpeWeightMax Float?
```

Si scrivono quando: `weight` è null, `targetRpe` non è null e il range è calcolabile.
Altrimenti valgono entrambe null. `weightType` resta `absolute` e `weight`/`effectiveWeight`
restano null: niente nuovo `weightType`, perché il range non è un peso assegnato.

Punti da toccare:
- `prisma/schema.prisma` + migrazione (solo `ADD COLUMN`, nessun dato da convertire).
- `src/schemas/workout-exercise.ts`: campi opzionali `rpeWeightMin`/`rpeWeightMax`
  (`>= 0`, `min <= max`).
- `src/app/api/programs/[id]/workouts/[workoutId]/exercises/bulk/route.ts:154`,
  `…/exercises/route.ts:120`, `…/exercises/[exerciseId]/route.ts:115`: salvano i campi
  come fanno con `effectiveWeight`.
- `src/app/api/programs/[id]/copy-week/route.ts` e `copy-first-week/route.ts`: li copiano
  insieme a `effectiveWeight`.
- La pagina di modifica (`edit/_content.tsx`, `buildWorkoutExercisePayload` ~riga 2020)
  calcola il range e lo mette nel payload.
- Le select Prisma che leggono `effectiveWeight` per le viste (review route,
  `trainee-program-data.ts`, `api/trainee/workouts/[id]`, `api/programs/[id]`) devono
  restituire anche i due campi.

Un'alternativa scartata è calcolare il range a runtime dai PR, senza colonne. Va
contro la regola "il peso si fissa quando il trainer salva" e tratterebbe in modo diverso
pesi e range.

## Visualizzazione

| Dove | Cosa | File |
|---|---|---|
| Edit trainer (editabile) | sotto/accanto al campo peso vuoto: `≈ 110,5–115 kg` | `edit/_content.tsx` ~3880 |
| Edit trainer (sola lettura) | `- ≈ 110,5–115 kg` | idem ~3862 |
| Review trainer | come il peso effettivo, formato range | `review/_content.tsx` |
| Vista workout trainee | al posto di `calculatedWeightMissing`: `110,5–115 kg (RPE 8)` | `trainee/workouts/[id]/_content.tsx` ~1059 |
| Dettaglio programma trainee | come `formatEffectiveWeight` | `ProgramDetailContent.tsx` |
| PDF | colonna peso | `program-pdf-export.ts` |

Formato numeri: virgola decimale in IT, punto in EN (seguire `formatWeightForDisplay` e
gli helper esistenti). Le nuove chiavi i18n vanno in entrambi i locale
(`public/locales/{en,it}/`), preservando la codifica dei file.

## Interazione con esercizi zavorrati

Se è già implementata la spec `bodyweight-loaded-exercises`, per gli esercizi con
`isBodyweightLoaded`:
- la percentuale arriva dalla tabella trazioni/dip, non da Tuchscherer (reps 1–10, RPE 6–10);
- il range è calcolato e salvato sul carico totale; l'atleta vede **solo** il range di
  zavorra (`min − BW`, `max − BW`), con le stesse regole di quella spec.

Se questa spec viene implementata per prima, il piano di quella successiva deve estendere
`rpeWeightRange` con il parametro tabella.

## Test

- `rpeWeightRange`: caso base (esempio sopra), mezzo RPE, reps 12 vs 13, reps 0 → null.
- Pagina di modifica: peso vuoto + RPE + PR → payload con min/max. Peso compilato → min/max null.
  Senza PR → null.
- Schema Zod: `min > max` rifiutato.
- Vista trainee: mostra il range quando `effectiveWeight` è null e il range c'è.

## Scelte del designer da verificare

1. Il range viene salvato su due nuove colonne (congelato) e non ricalcolato a runtime.
2. L'atleta vede il range, non solo il trainer.
3. Oltre 12 reps nessun range, invece di Epley.
4. Arrotondamento per eccesso a 0,5 sia del minimo sia del massimo.
5. Reps a range (`8/10`) → si usano le reps minime.
