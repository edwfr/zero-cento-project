# Audit i18n – Stringhe Hardcoded & Token Mancanti

**Data:** 2026-04-11  
**Scope:** API routes, componenti UI, pagine, schemi Zod, librerie  

---

## Sommario Esecutivo

| Area                           | File con problemi | Stringhe hardcoded (stima) | Severità |
| ------------------------------ | ----------------- | -------------------------- | -------- |
| API Routes (`src/app/api/`)    | 15                | ~26                        | 🔴 Alta   |
| Schemi Zod (`src/schemas/`)    | 9                 | ~55                        | 🔴 Alta   |
| Componenti (`src/components/`) | 20+               | ~80                        | 🔴 Alta   |
| Pagine / Layout (`src/app/`)   | 15+               | ~100                       | 🔴 Alta   |
| Librerie (`src/lib/`)          | 2                 | ~8                         | 🟡 Media  |
| **Totale**                     | **~60**           | **~270**                   |          |

---

## 1. API Routes – Messaggi di errore e successo hardcoded

### Problema
Le API restituiscono messaggi di errore/successo come testo letterale invece di token i18n.  
**Pattern corretto:** `{ error: { key: "exercise.notFound" } }` → il client traduce con `t('errors:exercise.notFound')`.  
**Pattern scorretto:** `{ error: "Exercise not found" }` oppure `{ message: "Esercizio eliminato con successo" }`.

### 1.1 Messaggi di errore senza token i18n

> ✅ **Tutti i messaggi di questa sezione sono stati corretti** (2026-04-11) — aggiunto parametro `key` a ogni chiamata `apiError()`.  
> **Nota:** il file `src/app/api/health/route.ts` indicato nell'audit era errato; la stringa si trovava in `src/app/api/admin/reports/global/route.ts`.

| File                                                                             | Riga    | Stringa hardcoded                                                               | Token suggerito                        | Stato |
| -------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- | -------------------------------------- | ----- |
| `src/app/api/admin/reports/global/route.ts`                                      | 93      | `'Failed to fetch global report'`                                               | `internal.globalReportFailed`          | ✅     |
| `src/app/api/programs/[id]/copy-week/route.ts`                                   | 22      | `'Source week is required'`                                                     | `validation.sourceWeekRequired`        | ✅     |
| `src/app/api/programs/[id]/copy-week/route.ts`                                   | 69      | `'Source week not found'`                                                       | `week.sourceNotFound`                  | ✅     |
| `src/app/api/programs/[id]/copy-week/route.ts`                                   | 73      | `'Source week has no following week to copy into'`                              | `program.noFollowingWeek`              | ✅     |
| `src/app/api/programs/[id]/copy-week/route.ts`                                   | 61      | `'Cannot modify program: only draft programs can be edited'`                    | `program.cannotModifyNonDraft`         | ✅     |
| `src/app/api/programs/[id]/copy-first-week/route.ts`                             | 55      | `'Cannot modify program: only draft programs can be edited'`                    | `program.cannotModifyNonDraft`         | ✅     |
| `src/app/api/programs/[id]/route.ts`                                             | 223     | `'Cannot modify program: only draft programs can be edited'`                    | `program.cannotModifyNonDraft`         | ✅     |
| `src/app/api/programs/[id]/route.ts`                                             | 256     | `` `Cannot reduce durationWeeks below existing configured weeks (${n})` ``      | `program.cannotReduceDurationWeeks`    | ✅     |
| `src/app/api/programs/[id]/route.ts`                                             | 263     | `` `Cannot reduce workoutsPerWeek below existing configured workouts (${n})` `` | `program.cannotReduceWorkoutsPerWeek`  | ✅     |
| `src/app/api/programs/[id]/route.ts`                                             | 443     | `'Cannot delete program: only draft programs can be deleted'`                   | `program.cannotDeleteNonDraft`         | ✅     |
| `src/app/api/programs/[id]/publish/route.ts`                                     | 76      | `` `Cannot publish: ${n} workout(s) have no exercises` ``                       | `program.cannotPublishEmptyWorkouts`   | ✅     |
| `src/app/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route.ts` | 59, 171 | `'Cannot modify program: only draft programs can be edited'`                    | `program.cannotModifyNonDraft`         | ✅     |
| `src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts`              | 69      | `'Cannot modify program: only draft programs can be edited'`                    | `program.cannotModifyNonDraft`         | ✅     |
| `src/app/api/programs/[id]/workouts/[workoutId]/exercises/reorder/route.ts`      | 55      | `'Cannot modify program: only draft programs can be edited'`                    | `program.cannotModifyNonDraft`         | ✅     |
| `src/app/api/movement-patterns/[id]/route.ts`                                    | 88      | `` `Cannot delete movement pattern. Used in ${n} exercise(s)` ``                | `movementPattern.cannotDeleteInUse`    | ✅     |
| `src/app/api/muscle-groups/[id]/route.ts`                                        | 88      | `` `Cannot delete muscle group. Used in ${n} exercise(s)` ``                    | `muscleGroup.cannotDeleteInUse`        | ✅     |
| `src/app/api/exercises/[id]/route.ts`                                            | 268     | `` `Cannot delete exercise: it is used in active program "${title}"` ``         | `exercise.cannotDeleteInActiveProgram` | ✅     |
| `src/app/api/feedback/[id]/route.ts`                                             | 139     | `'Cannot modify feedback: can only edit within 24 hours of creation'`           | `feedback.cannotModifyAfter24h`        | ✅     |

### 1.2 Messaggi di successo hardcoded

> ✅ **Tutti i messaggi di questa sezione sono stati corretti** (2026-04-11) — aggiunto `messageKey` nelle risposte `apiSuccess()` mantenendo `message` come fallback di compatibilità.

| File                                                                             | Riga | Stringa hardcoded                              | Token suggerito                  | Stato |
| -------------------------------------------------------------------------------- | ---- | ---------------------------------------------- | -------------------------------- | ----- |
| `src/app/api/auth/activate/route.ts`                                             | 23   | `'User activated successfully'`                | `user.activatedSuccess`          | ✅     |
| `src/app/api/auth/force-change-password/route.ts`                                | 75   | `'Password changed successfully'`              | `auth.passwordChangedSuccess`    | ✅     |
| `src/app/api/admin/trainees/[traineeId]/reassign/route.ts`                       | 72   | `'Trainee reassigned successfully'`            | `trainee.reassignedSuccess`      | ✅     |
| `src/app/api/users/[id]/route.ts`                                                | 179  | `'User deleted successfully'`                  | `user.deletedSuccess`            | ✅     |
| `src/app/api/personal-records/[id]/route.ts`                                     | 145  | `'Personal record deleted successfully'`       | `personalRecord.deletedSuccess`  | ✅     |
| `src/app/api/muscle-groups/[id]/route.ts`                                        | 99   | `'Muscle group deleted successfully'`          | `muscleGroup.deletedSuccess`     | ✅     |
| `src/app/api/movement-patterns/[id]/route.ts`                                    | 99   | `'Movement pattern deleted successfully'`      | `movementPattern.deletedSuccess` | ✅     |
| `src/app/api/exercises/[id]/route.ts`                                            | 284  | `'Exercise deleted successfully'`              | `exercise.deletedSuccess`        | ✅     |
| `src/app/api/programs/[id]/route.ts`                                             | 455  | `'Program deleted successfully'`               | `program.deletedSuccess`         | ✅     |
| `src/app/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route.ts` | 213  | `'Exercise removed from workout successfully'` | `workoutExercise.removedSuccess` | ✅     |

---

## 2. Schemi Zod (`src/schemas/`) – Messaggi di validazione in italiano

### Problema
Tutti i messaggi di validazione Zod sono stringhe hardcoded in italiano. Questi messaggi vengono visualizzati direttamente nell'UI quando la validazione fallisce. Devono essere **token i18n** tradotti lato client.

### 2.1 `src/schemas/user.ts`

> ✅ **Sottosezione 2.1 completata** (2026-04-11) — sostituiti i messaggi hardcoded con token `validation.*` in `src/schemas/user.ts` e aggiunte traduzioni EN/IT.

| Riga  | Stringa                                             | Token suggerito                                                | Stato |
| ----- | --------------------------------------------------- | -------------------------------------------------------------- | ----- |
| 9     | `'Password minimo 8 caratteri'`                     | `validation.passwordMinLength`                                 | ✅     |
| 10    | `'Almeno una lettera maiuscola'`                    | `validation.passwordUppercase`                                 | ✅     |
| 11    | `'Almeno una lettera minuscola'`                    | `validation.passwordLowercase`                                 | ✅     |
| 12    | `'Almeno un numero'`                                | `validation.passwordNumber`                                    | ✅     |
| 15    | `'Email non valida'`                                | `validation.invalidEmail`                                      | ✅     |
| 16    | `'Nome troppo corto'` / `'Nome troppo lungo'`       | `validation.firstNameTooShort` / `validation.firstNameTooLong` | ✅     |
| 17    | `'Cognome troppo corto'` / `'Cognome troppo lungo'` | `validation.lastNameTooShort` / `validation.lastNameTooLong`   | ✅     |
| 30-31 | `'Email non valida'`, `'Password richiesta'`        | `validation.invalidEmail`, `validation.passwordRequired`       | ✅     |
| 39    | `'Password attuale richiesta'`                      | `validation.currentPasswordRequired`                           | ✅     |
| 43    | `'Le password non corrispondono'`                   | `validation.passwordMismatch`                                  | ✅     |

### 2.2 `src/schemas/program.ts`

> ✅ **Sottosezione 2.2 completata** (2026-04-11) — sostituiti i messaggi hardcoded con token `validation.*` in `src/schemas/program.ts` e aggiunte traduzioni EN/IT.

| Riga  | Stringa                                                                         | Token suggerito                                                                  | Stato |
| ----- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----- |
| 10    | `'Titolo troppo corto'` / `'Titolo troppo lungo'`                               | `validation.titleTooShort` / `validation.titleTooLong`                           | ✅     |
| 12    | `'ID trainee non valido'`                                                       | `validation.invalidTraineeId`                                                    | ✅     |
| 16-18 | `'Durata deve essere intero'`, `'Minimo 1 settimana'`, `'Massimo 52 settimane'` | `validation.durationInteger`, `validation.minWeeks`, `validation.maxWeeks`       | ✅     |
| 21-23 | `'Allenamenti per settimana deve essere intero'`, `'Minimo 1'`, `'Massimo 7'`   | `validation.workoutsInteger`, `validation.minWorkouts`, `validation.maxWorkouts` | ✅     |
| 36    | `'Data di inizio non valida'`                                                   | `validation.invalidStartDate`                                                    | ✅     |

### 2.3 `src/schemas/feedback.ts`

> ✅ **Sottosezione 2.3 completata** (2026-04-11) — sostituiti i messaggi hardcoded con token `validation.*` in `src/schemas/feedback.ts` e aggiunte traduzioni EN/IT.

| Riga  | Stringa                             | Token suggerito                                                              | Stato |
| ----- | ----------------------------------- | ---------------------------------------------------------------------------- | ----- |
| 10-12 | Serie: intero, min 1, max 50        | `validation.setsInteger`, `validation.minSets`, `validation.maxSets`         | ✅     |
| 16-18 | Ripetizioni: intero, min 0, max 50  | `validation.repsInteger`, `validation.minReps`, `validation.maxReps`         | ✅     |
| 21-22 | Peso: min 0, max 500                | `validation.minWeight`, `validation.maxWeight`                               | ✅     |
| 26    | `'ID esercizio workout non valido'` | `validation.invalidWorkoutExerciseId`                                        | ✅     |
| 30-32 | RPE: min 5, max 10, multiplo 0.5    | `validation.rpeMin`, `validation.rpeMax`, `validation.rpeStep`               | ✅     |
| 36-38 | Serie/note limiti                   | `validation.minOneSeries`, `validation.maxSeries`, `validation.notesTooLong` | ✅     |
| 46    | `'ID settimana non valido'`         | `validation.invalidWeekId`                                                   | ✅     |
| 49-50 | Feedback lunghezza                  | `validation.feedbackTooShort`, `validation.feedbackTooLong`                  | ✅     |

### 2.4 `src/schemas/exercise.ts`

> ✅ **Sottosezione 2.4 completata** (2026-04-11) — sostituiti i messaggi hardcoded con token `validation.*` in `src/schemas/exercise.ts` e aggiunte traduzioni EN/IT.

| Riga  | Stringa                            | Token suggerito                                                     | Stato |
| ----- | ---------------------------------- | ------------------------------------------------------------------- | ----- |
| 8     | `'ID gruppo muscolare non valido'` | `validation.invalidMuscleGroupId`                                   | ✅     |
| 11-12 | Coefficiente min/max               | `validation.coefficientMin`, `validation.coefficientMax`            | ✅     |
| 18-19 | Nome corto/lungo                   | `validation.exerciseNameTooShort`, `validation.exerciseNameTooLong` | ✅     |
| 23-24 | URL non valido, YouTube            | `validation.invalidUrl`, `validation.mustBeYoutube`                 | ✅     |
| 27    | `'Tipo esercizio non valido'`      | `validation.invalidExerciseType`                                    | ✅     |
| 29    | `'ID schema motorio non valido'`   | `validation.invalidMovementPatternId`                               | ✅     |
| 33    | `'Massimo 5 gruppi muscolari'`     | `validation.maxMuscleGroups`                                        | ✅     |

### 2.5 `src/schemas/workout-exercise.ts`

> ✅ **Sottosezione 2.5 completata** (2026-04-11) — sostituiti i messaggi hardcoded con token `validation.*` in `src/schemas/workout-exercise.ts` e aggiunte traduzioni EN/IT.

| Riga | Stringa                                        | Token suggerito                          | Stato |
| ---- | ---------------------------------------------- | ---------------------------------------- | ----- |
| 48   | `'Peso è obbligatorio per i tipi percentuale'` | `validation.weightRequiredForPercentage` | ✅     |
| 59   | `'Il peso deve essere >= 0'`                   | `validation.weightMinZero`               | ✅     |
| 71   | `'Il peso effettivo deve essere >= 0'`         | `validation.effectiveWeightMinZero`      | ✅     |
| 78   | `'Almeno un esercizio richiesto'`              | `validation.atLeastOneExercise`          | ✅     |

### 2.6 `src/schemas/personal-record.ts`

> ✅ **Sottosezione 2.6 completata** (2026-04-11) — sostituiti i messaggi hardcoded con token `validation.*` in `src/schemas/personal-record.ts` e aggiunte traduzioni EN/IT.

| Riga  | Stringa                                      | Token suggerito                                                           | Stato |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------- | ----- |
| 8     | `'ID esercizio non valido'`                  | `validation.invalidExerciseId`                                            | ✅     |
| 10-12 | Ripetizioni: intero, min 1, max 100          | `validation.repsInteger`, `validation.minOneRep`, `validation.maxReps100` | ✅     |
| 14-15 | Peso: > 0, max 1000                          | `validation.weightPositive`, `validation.maxWeight1000`                   | ✅     |
| 23    | `'Data non valida'`                          | `validation.invalidDate`                                                  | ✅     |
| 25    | `'La data del record non può essere futura'` | `validation.dateCannotBeFuture`                                           | ✅     |

### 2.7 `src/schemas/week.ts`

> ✅ **Sottosezione 2.7 completata** (2026-04-11) — sostituito il messaggio hardcoded con token `validation.invalidWeekType` in `src/schemas/week.ts`.

| Riga | Stringa                       | Token suggerito              | Stato |
| ---- | ----------------------------- | ---------------------------- | ----- |
| 7    | `'Tipo settimana non valido'` | `validation.invalidWeekType` | ✅     |

### 2.8 `src/schemas/muscle-group.ts` e `src/schemas/movement-pattern.ts`

> ✅ **Sottosezione 2.8 completata** (2026-04-11) — sostituiti i messaggi hardcoded con token `validation.*` in `src/schemas/muscle-group.ts` e `src/schemas/movement-pattern.ts`, con traduzioni EN/IT aggiunte.

| Riga | Stringa                                         | Token suggerito                                      | Stato |
| ---- | ----------------------------------------------- | ---------------------------------------------------- | ----- |
| 7    | `'Nome troppo corto'` / `'Nome troppo lungo'`   | `validation.nameTooShort` / `validation.nameTooLong` | ✅     |
| 16   | `'Colore deve essere in formato hex (#RRGGBB)'` | `validation.invalidHexColor`                         | ✅     |

---

## 3. Componenti UI (`src/components/`) – Stringhe IT/EN hardcoded

### 3.1 `ChangePasswordSection.tsx` – 🔴 Interamente hardcoded

> ✅ **Sottosezione 3.1 completata** (2026-04-11) — tutte le stringhe (errori + label/CTA/placeholder/success) sono state convertite a token i18n in `ChangePasswordSection.tsx` usando `auth:changePassword.*` e `common:common.cancel`.

| Riga    | Stringa                                                      | Token suggerito                                    |
| ------- | ------------------------------------------------------------ | -------------------------------------------------- |
| 22      | `'La nuova password deve essere di almeno 8 caratteri.'`     | `auth:password.minLength`                          |
| 26      | `'Le nuove password non coincidono.'`                        | `auth:password.mismatch`                           |
| 30      | `'La nuova password deve essere diversa da quella attuale.'` | `auth:password.mustBeDifferent`                    |
| 45      | `'Sessione non valida. Effettua nuovamente il login.'`       | `auth:session.invalid`                             |
| 54      | `'Password attuale non corretta.'`                           | `auth:password.incorrect`                          |
| 74      | `'Impossibile aggiornare la password.'`                      | `auth:password.updateFailed`                       |
| 93      | `"Modifica Password"`                                        | `auth:password.change`                             |
| 104     | `"Modifica Password"`                                        | `auth:password.changeTitle`                        |
| 114     | `"Password aggiornata con successo!"`                        | `auth:password.updateSuccess`                      |
| 128     | `"Password attuale"`                                         | `auth:password.current`                            |
| 129-130 | `"Aggiornamento..."` / `"Salva Nuova Password"`              | `common:common.updating` / `auth:password.saveNew` |
| 135     | `"Annulla"`                                                  | `common:common.cancel`                             |
| 145     | `"Nuova password"`                                           | `auth:password.new`                                |
| 155     | `"Minimo 8 caratteri"`                                       | `auth:password.minLengthHint`                      |
| 162     | `"Conferma nuova password"`                                  | `auth:password.confirm`                            |
| 173     | `"Ripeti la nuova password"`                                 | `auth:password.confirmHint`                        |

### 3.2 `ExerciseCreateModal.tsx` – 🔴 Interamente hardcoded

> ✅ **Sottosezione 3.2 completata** (2026-04-11) — tutte le stringhe UI del modal (errori, label, placeholder, CTA, helper text) sono state convertite a token i18n in `ExerciseCreateModal.tsx` usando namespace `trainer:exercises.*` e `common:common.*`.

| Riga    | Stringa                                           | Token suggerito                                                 |
| ------- | ------------------------------------------------- | --------------------------------------------------------------- |
| 80      | `"Crea Nuovo Esercizio"`                          | `trainer:exercises.createNew`                                   |
| 87      | `"Nome Esercizio *"`                              | `trainer:exercises.nameLabel`                                   |
| 172     | `"Completa tutti i gruppi muscolari selezionati"` | `trainer:exercises.completeMuscleGroups`                        |
| 184     | `"Errore durante la creazione"`                   | `common:errors.creationError`                                   |
| 210     | `"es. Bench Press"`                               | `trainer:exercises.namePlaceholder`                             |
| 218     | `"Descrizione"`                                   | `trainer:exercises.description`                                 |
| 225     | `"Descrizione dell'esercizio..."`                 | `trainer:exercises.descriptionPlaceholder`                      |
| 234     | `"URL YouTube *"`                                 | `trainer:exercises.youtubeUrl`                                  |
| 252     | `"Tipo *"`                                        | `trainer:exercises.typeLabel`                                   |
| 261-262 | `"Fondamentale"` / `"Accessorio"`                 | `trainer:exercises.fundamental` / `trainer:exercises.accessory` |
| 267     | `"Schema Motorio *"`                              | `trainer:exercises.movementPattern`                             |
| 274     | `"Seleziona schema..."`                           | `trainer:exercises.selectPattern`                               |
| 285     | `"Gruppi Muscolari * (min 1, max 5)"`             | `trainer:exercises.muscleGroupsLabel`                           |
| 292     | `"+ Aggiungi"`                                    | `common:common.add`                                             |

### 3.3 `ErrorBoundary.tsx` – 🔴 Interamente hardcoded

> ✅ **Sottosezione 3.3 completata** (2026-04-11) — tutte le stringhe del fallback (titolo, messaggio, dettagli dev, azioni pulsanti) sono state convertite a token i18n (`components:errorBoundary.*`, `common:common.retry`, `common:common.backHome`).

| Riga | Stringa                                      | Token suggerito                 |
| ---- | -------------------------------------------- | ------------------------------- |
| 14   | `"Oops! Qualcosa è Andato Storto"`           | `common:errors.boundaryTitle`   |
| 17   | `"Si è verificato un errore inaspettato..."` | `common:errors.boundaryMessage` |
| 23   | `"Dettagli Errore (solo dev):"`              | `common:errors.details`         |
| 96   | `"Riprova"`                                  | `common:common.retry`           |
| 101  | `"Torna alla Home"`                          | `common:common.backHome`        |

### 3.4 `AutocompleteSearch.tsx`

> ✅ **Sottosezione 3.4 completata** (2026-04-11) — convertiti a token i18n i default di placeholder e messaggio empty (`common:common.search`, `common:common.noResultsFound`) e il testo di loading (`common:common.loading`).

| Riga | Stringa                                     | Token suggerito                |
| ---- | ------------------------------------------- | ------------------------------ |
| 30   | `placeholder = 'Cerca...'`                  | `common:common.search`         |
| 33   | `emptyMessage = 'Nessun risultato trovato'` | `common:common.noResultsFound` |

### 3.5 `DatePicker.tsx`

> ✅ **Sottosezione 3.5 completata** (2026-04-11) — convertiti a token i18n il placeholder e l'`aria-label` del pulsante calendario (`common:common.dateFormat`, `common:common.openCalendar`).

| Riga | Stringa                        | Token suggerito              |
| ---- | ------------------------------ | ---------------------------- |
| 35   | `placeholder = 'GG/MM/AAAA'`   | `common:common.dateFormat`   |
| 129  | `aria-label="Apri calendario"` | `common:common.openCalendar` |

### 3.6 `RoleGuard.tsx`

> ✅ **Messaggi di errore corretti** (2026-04-11) — convertite a token i18n le stringhe alle righe 58 e 60 (`common:errors.accessDeniedTitle`, `common:errors.accessDeniedMessage`).

| Riga | Stringa                                              | Token suggerito                     |
| ---- | ---------------------------------------------------- | ----------------------------------- |
| 58   | `"Accesso Negato"`                                   | `common:errors.accessDeniedTitle`   |
| 60   | `"Non hai i permessi per accedere a questa pagina."` | `common:errors.accessDeniedMessage` |
| 64   | `"Torna Indietro"`                                   | `common:common.back`                |

### 3.7 `LoadingSpinner.tsx`

> ✅ **Sottosezione 3.7 completata** (2026-04-11) — convertite a token i18n le stringhe per `aria-label`, messaggio loader e tagline (`common:common.loading`, `common:common.loadingEllipsis`, `common:brand.tagline`).

| Riga | Stringa                               | Token suggerito                 |
| ---- | ------------------------------------- | ------------------------------- |
| 29   | `'Caricamento in corso'` (aria-label) | `common:common.loading`         |
| 48   | `'Caricamento...'`                    | `common:common.loadingEllipsis` |
| 54   | `"Training Platform"`                 | `common:brand.tagline`          |

### 3.8 `WeekTypeBanner.tsx`

> ✅ **Sottosezione 3.8 completata** (2026-04-11) — convertiti a token i18n label/descrizione per i tipi settimana e badge (`trainer:weekTypes.*`, `components:weekTypeBanner.*`).

| Riga  | Stringa                                                            | Token suggerito                               |
| ----- | ------------------------------------------------------------------ | --------------------------------------------- |
| 33-34 | `'Settimana Standard'` / `'Allenamento normale secondo programma'` | `program:weekType.standard` / `.standardDesc` |
| 37-38 | `'Settimana Test'` / `'Valutazione massimali e test'`              | `program:weekType.test` / `.testDesc`         |
| 41-42 | `'Settimana Scarico'` / `'Recupero e rigenerazione'`               | `program:weekType.deload` / `.deloadDesc`     |

### 3.9 `WeightTypeSelector.tsx`

> ✅ **Sottosezione 3.9 completata** (2026-04-11) — convertite a token i18n la label e le descrizioni delle opzioni (`components:weightType.label|absolute|percent1RM|percentNRM|percentPrev`).

| Riga | Stringa                                                                                                  | Token suggerito                                                                |
| ---- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 8-11 | `'Peso assoluto'`, `'Percentuale massimale'`, `'Percentuale di nRM'`, `'Relativo alla prima occorrenza'` | `components:weightType.absolute`, `.percent1RM`, `.percentNRM`, `.percentPrev` |
| 18   | `"Tipo Peso"` label                                                                                      | `components:weightType.label`                                                  |

### 3.10 `ProfileForm.tsx`

> ✅ **Sottosezione 3.10 completata** (2026-04-11) — convertite a token i18n tutte le stringhe UI (errore, success, titolo, label, CTA) con namespace `common` e `profile`.

| Riga    | Stringa                               | Token suggerito                                      |
| ------- | ------------------------------------- | ---------------------------------------------------- |
| 43      | `'Errore durante l\'aggiornamento'`   | `common:errors.updateError`                          |
| 58      | `"Profilo aggiornato con successo"`   | `profile:updateSuccess`                              |
| 72      | `"Modifica Dati Personali"`           | `profile:editPersonalData`                           |
| 88      | `"Nome"`                              | `common:common.firstName`                            |
| 99      | `"Cognome"`                           | `common:common.lastName`                             |
| 115-116 | `"Salvando..."` / `"Salva Modifiche"` | `common:common.saving` / `common:common.saveChanges` |
| 122     | `"Annulla"`                           | `common:common.cancel`                               |

### 3.11 `MovementPatternColorsSection.tsx`

> ✅ **Sottosezione 3.11 completata** (2026-04-11) — convertite a token i18n tutte le stringhe UI (errori, descrizioni, titoli, CTA, success, label preview) con namespace `admin` e `common`.

| Riga | Stringa                                           | Token suggerito                    |
| ---- | ------------------------------------------------- | ---------------------------------- |
| 52   | `"Failed to load movement patterns"`              | `admin:movementPatterns.loadError` |
| 56   | `"Failed to load colors"`                         | `admin:colors.loadError`           |
| 70   | `"Errore nel caricamento dei dati"`               | `common:errors.loadError`          |
| 149  | `"Personalizza i colori dei movement pattern..."` | `admin:colors.description`         |
| 178  | `"Modifica Colori"`                               | `admin:colors.edit`                |
| 190  | `"Modifica Colori Movement Pattern"`              | `admin:colors.editTitle`           |
| 197  | `"Colori salvati con successo!"`                  | `admin:colors.saveSuccess`         |
| 212  | `"Impossibile salvare i colori"`                  | `admin:colors.saveFailed`          |

### 3.12 `RepsInput.tsx`

> ✅ **Sottosezione 3.12 completata** (2026-04-11) — convertite a token i18n tutte le stringhe UI (placeholder, errore formato, label, help) con namespace `components:repsInput.*`.

| Riga | Stringa                                                    | Token suggerito                      |
| ---- | ---------------------------------------------------------- | ------------------------------------ |
| 28   | `"es. 8, 8-10, 6/8"`                                       | `components:repsInput.placeholder`   |
| 51   | `"Formato non valido (es. 8, 8-10, 6/8)"`                  | `components:repsInput.invalidFormat` |
| 65   | `"Ripetizioni"`                                            | `components:repsInput.label`         |
| 88   | `"Formati: numero singolo (8), range (8-10), slash (6/8)"` | `components:repsInput.help`          |

### 3.13 `RestTimeSelector.tsx`

> ✅ **Sottosezione 3.13 completata** (2026-04-11) — convertita a token i18n la label alla riga 31 (`components:restTime.label`).

| Riga | Stringa            | Token suggerito             |
| ---- | ------------------ | --------------------------- |
| 31   | `"Tempo Recupero"` | `components:restTime.label` |

### 3.14 `YoutubeEmbed.tsx`

> ✅ **Sottosezione 3.14 completata** (2026-04-11) — convertite a token i18n le stringhe alla riga 19 e 66 (`components:youtube.defaultTitle`, `components:youtube.invalidUrl`).

| Riga | Stringa                  | Token suggerito                   |
| ---- | ------------------------ | --------------------------------- |
| 19   | `'Video esercizio'`      | `components:youtube.defaultTitle` |
| 66   | `"URL video non valido"` | `components:youtube.invalidUrl`   |

### 3.15 `RPESelector.tsx`

> ✅ **Sottosezione 3.15 completata** (2026-04-11) — convertito a token i18n il placeholder (`components:rpeSelector.placeholder`); confermato uso token già presenti per le azioni (`common:common.deselect`, `common:common.close`).

| Riga | Stringa           | Token suggerito                      |
| ---- | ----------------- | ------------------------------------ |
| 56   | `'Seleziona RPE'` | `components:rpeSelector.placeholder` |
| 112  | `"Deseleziona"`   | `common:common.deselect`             |
| 114  | `"Chiudi"`        | `common:common.close`                |

### 3.16 `ToastNotification.tsx`

> ✅ **Sottosezione 3.16 completata** (2026-04-11) — convertite a token i18n le `aria-label` di container e pulsante chiusura (`common:common.notifications`, `common:common.closeNotification`).

| Riga | Stringa                          | Token suggerito                   |
| ---- | -------------------------------- | --------------------------------- |
| 66   | `"Notifiche"` (aria-label)       | `common:common.notifications`     |
| 134  | `"Chiudi notifica"` (aria-label) | `common:common.closeNotification` |

### 3.17 `PWAInstallPrompt.tsx`

> ✅ **Sottosezione 3.17 completata** (2026-04-11) — convertita a token i18n l'`aria-label` del pulsante chiusura (`common:common.close`).

| Riga | Stringa                 | Token suggerito       |
| ---- | ----------------------- | --------------------- |
| 124  | `"Chiudi"` (aria-label) | `common:common.close` |

### 3.18 `UserCreateModal.tsx`

> ✅ **Sottosezione 3.18 completata** (2026-04-11) — convertiti a token i18n i messaggi di conferma creazione utente (`admin:users.createdSuccessfully`, `admin:users.inviteNotice`).

| Riga | Stringa                                      | Token suggerito                   |
| ---- | -------------------------------------------- | --------------------------------- |
| 101  | `"L'utente è stato creato con successo!..."` | `admin:users.createdSuccessfully` |
| 108  | `"L'utente riceverà un link per..."`         | `admin:users.inviteNotice`        |

### 3.19 `UserDeleteModal.tsx`, `UserEditModal.tsx`, `ExercisesTable.tsx`

> ✅ **Sottosezione 3.19 completata** (2026-04-11) — verifica conclusa sui tre file: `UserDeleteModal.tsx` già conforme; in `UserEditModal.tsx` localizzata l'etichetta ruolo dinamica; in `ExercisesTable.tsx` rimossa pluralizzazione hardcoded nelle opzioni filtro.

| File                  | Riga indicativa | Stringa/Punto verificato                   | Token adottato                                                              |
| --------------------- | --------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| `UserDeleteModal.tsx` | -               | Nessuna stringa hardcoded residua          | Già coperto da `admin:*` / `common:*`                                       |
| `UserEditModal.tsx`   | 159             | Valore ruolo mostrato come stringa raw     | `common:roles.admin` / `common:roles.trainer` / `common:roles.trainee`      |
| `ExercisesTable.tsx`  | 132-133         | Pluralizzazione con suffisso hardcoded `i` | `trainer:exercises.fundamentalPlural` / `trainer:exercises.accessoryPlural` |

---

## 4. Pagine e Layout (`src/app/`) – Stringhe hardcoded

### 4.1 Pagine root – ✅ Completata

> ✅ **Fix messaggi di errore completato** (2026-04-11) — convertite a token i18n tutte le stringhe di errore in `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/offline/page.tsx`; aggiunti i token mancanti in `public/locales/it/common.json` e `public/locales/en/common.json`.  
> ✅ **Metadata layout completato** (2026-04-11) — in `src/app/layout.tsx` sostituiti title/description hardcoded con valori da dizionario i18n `common:app.fullName` e `common:app.description` (risoluzione locale da cookie `i18next`).  
> ℹ️ **Nota:** in `src/app/offline/page.tsx` è stato anche convertito il testo footer in `common:app.fullName`.

| File                       | Riga | Stringa                                          | Token suggerito                         | Stato |
| -------------------------- | ---- | ------------------------------------------------ | --------------------------------------- | ----- |
| `src/app/error.tsx`        | 17   | `"Si è verificato un errore"`                    | `common:errors.generic`                 | ✅     |
| `src/app/error.tsx`        | 18   | `"Riprova più tardi"`                            | `common:errors.tryLater`                | ✅     |
| `src/app/error.tsx`        | 24   | `"Riprova"`                                      | `common:common.retry`                   | ✅     |
| `src/app/layout.tsx`       | 12   | `'ZeroCento Training Platform'`                  | `common:app.fullName`                   | ✅     |
| `src/app/layout.tsx`       | 13   | `'Piattaforma di gestione training...'`          | `common:app.description`                | ✅     |
| `src/app/not-found.tsx`    | 3    | `"Pagina non trovata"`                           | `common:errors.notFound`                | ✅     |
| `src/app/not-found.tsx`    | 4    | `"La pagina che stai cercando non esiste"`       | `common:errors.pageNotFoundDescription` | ✅     |
| `src/app/not-found.tsx`    | 9    | `"Torna alla Home"`                              | `common:common.backToHome`              | ✅     |
| `src/app/offline/page.tsx` | 28   | `"Sei offline"`                                  | `common:offline.title`                  | ✅     |
| `src/app/offline/page.tsx` | 29   | `"La connessione internet non è disponibile..."` | `common:offline.description`            | ✅     |
| `src/app/offline/page.tsx` | 33   | `"Riprova"`                                      | `common:common.retry`                   | ✅     |

### 4.2 Pagine Autenticazione – ✅ Completata

> ✅ **Sottosezione 4.2 completata** (2026-04-11) — convertite a token i18n le stringhe hardcoded nelle 4 pagine auth (`forgot-password`, `reset-password`, `force-change-password`, `onboarding/set-password`) e aggiunti i token mancanti in `public/locales/it/auth.json` e `public/locales/en/auth.json`.

| File                                       | Intervento                                                                                   | Token/Namespace toccati                                                                          | Stato |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----- |
| `src/app/forgot-password/page.tsx`         | Messaggi errore/successo, helper text e placeholder email convertiti a `t()`                 | `auth:forgotPassword.errorSend`, `.successDescription`, `.emailPlaceholder`, `.rememberPassword` | ✅     |
| `src/app/reset-password/page.tsx`          | Validazioni locali, testi verifica link, label/placeholder e CTA convertiti a `t()`          | `auth:resetPassword.description`, `.verifyingLink`, `.requestNewLink`, `.error*`, `.submitting`  | ✅     |
| `src/app/force-change-password/page.tsx`   | Label/placeholder/CTA/help + error handling con fallback i18n tramite `getApiErrorMessage()` | `auth:forceChangePassword.*` (incl. `errorReLogin`, `errorUserData`, `errorSessionInvalid`)      | ✅     |
| `src/app/onboarding/set-password/page.tsx` | Errori verifica invito e setup password, contenuti hero/form/footer convertiti a `t()`       | `auth:setPassword.*` (nuovo blocco token)                                                        | ✅     |

### 4.3 Pagine Profilo – ✅ Completata

> ✅ **Sottosezione 4.3 completata** (2026-04-11) — convertite a i18n le stringhe hardcoded in `src/app/profile/page.tsx` e `src/app/profile/change-password/_content.tsx`; aggiunti token mancanti in `public/locales/it/profile.json`, `public/locales/en/profile.json`, `public/locales/it/auth.json` e `public/locales/en/auth.json`.

| File                                           | Intervento                                                                                  | Token/Namespace toccati                                                              | Stato       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------- |
| `src/app/profile/page.tsx`                     | Titoli, label account, ruolo e sezione sicurezza convertiti a dizionario locale server-side | `profile:profile.title                                                               | accountInfo | roleLabel | security | movementPatternColors`, `common:*`, `common:roles.*` | ✅ |
| `src/app/profile/change-password/_content.tsx` | Header, success, label, placeholder, validazioni e CTA convertiti a `t()`                   | `auth:changePassword.*` (incl. `description`, `successDescription`, `backToProfile`) | ✅           |

### 4.4 Pagine Trainer – ✅ Completata

> ✅ **Sottosezione 4.4 completata** (2026-04-11) — convertite a i18n le stringhe hardcoded nelle pagine trainer (`exercises`, `exercises/[id]/edit`, `programs/[id]/edit/EditProgramMetadata`, `trainees/new`) e aggiunti token mancanti in `public/locales/it/trainer.json` e `public/locales/en/trainer.json`.

| File                                                         | Intervento                                                                                                                    | Token/Namespace toccati                                                                                                  | Stato |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----- |
| `src/app/trainer/exercises/_content.tsx`                     | Header, ricerca/filtri, empty-state, tabella card action label, conferma delete e fallback error convertiti a `t()`        | `trainer:exercises.*` (incl. `viewGrid`, `viewTable`, `allTypes`, `confirmDeleteWithName`, `loadingExercisesError`) + `common:common.*` | ✅     |
| `src/app/trainer/exercises/[id]/edit/_content.tsx`           | Fallback errore caricamento e placeholder URL YouTube convertiti a token                                                     | `trainer:exercises.loadingError`, `trainer:exercises.youtubeUrlPlaceholder`                                             | ✅     |
| `src/app/trainer/programs/[id]/edit/EditProgramMetadata.tsx` | Toast/warning/CTA/label configurazione metadata convertiti a `t()` + gestione errori API con `getApiErrorMessage()`        | `trainer:programMetadata.*`, `trainer:programs.*`, `common:common.saveChanges|cancel`                                  | ✅     |
| `src/app/trainer/trainees/new/_content.tsx`                  | Blocco successo invito email, helper testo email e CTA “crea altro atleta” convertiti a `t()`                               | `trainer:athletes.inviteEmailSent*`, `trainer:athletes.createAnotherAthlete`, `trainer:athletes.emailInstructions`     | ✅     |

### 4.5 Pagine Trainee

| File                                   | Stringhe hardcoded (stima) | Esempio                        |
| -------------------------------------- | -------------------------- | ------------------------------ |
| `src/app/trainee/history/_content.tsx` | ~1                         | `"Errore caricamento storico"` |

### 4.6 Pagine con i18n ✅ corretto

Le seguenti pagine usano correttamente `t()`:
- `src/app/trainer/programs/_content.tsx`
- `src/app/trainer/programs/new/NewProgramContent.tsx`
- `src/app/trainer/trainees/_content.tsx`
- `src/app/admin/dashboard/_content.tsx`
- `src/app/admin/users/_content.tsx`
- `src/app/admin/programs/_content.tsx`
- `src/app/admin/exercises/_content.tsx`
- `src/app/trainee/dashboard/_content.tsx`
- `src/app/trainee/records/_content.tsx`
- `src/app/trainee/workouts/[id]/_content.tsx`
- `src/app/trainee/programs/_components/ProgramDetailContent.tsx`

---

## 5. Librerie (`src/lib/`) – Stringhe EN hardcoded

### 5.1 `src/lib/auth.ts`

| Riga | Stringa                                    | Token suggerito               |
| ---- | ------------------------------------------ | ----------------------------- |
| 80   | `'Authentication required'`                | `auth.authenticationRequired` |
| 97   | `'User not found'`                         | `user.notFound`               |
| 113  | `'Authentication required'`                | `auth.authenticationRequired` |
| 131  | `'Access denied. Required role: ...'`      | `auth.accessDenied`           |
| 170  | `'You do not have access to this trainee'` | `auth.traineeAccessDenied`    |
| 207  | `'You do not have access to this program'` | `auth.programAccessDenied`    |

> **Nota:** Queste stringhe sono usate in risposte API → devono diventare token i18n nel payload JSON.

### 5.2 `src/lib/calculations.ts`

| Riga | Stringa                                 | Nota                            |
| ---- | --------------------------------------- | ------------------------------- |
| 15   | `'Maximum recursion depth exceeded...'` | Errore tecnico – bassa priorità |
| 77   | `'No previous occurrence found...'`     | Errore tecnico – bassa priorità |

---

## 6. Piano d'Azione Consigliato

### Priorità 1 – 🔴 Impatto elevato

| #   | File / Area                                      | Intervento                                                                                                       |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 1   | `src/schemas/*.ts` (9 file)                      | Sostituire tutti i messaggi Zod con token i18n. Usare approccio con error map custom o chiavi poi tradotte in UI |
| 2   | `src/lib/auth.ts`                                | Restituire token i18n nelle risposte di errore auth                                                              |
| 3   | API: 7 endpoint con `"Cannot modify program..."` | Centralizzare in costante + usare token `program.cannotModifyNonDraft`                                           |
| 4   | API: 10 messaggi di successo                     | Restituire token i18n nel JSON, tradurre lato client                                                             |
| 5   | `ChangePasswordSection.tsx`                      | Rework completo con `useTranslation`                                                                             |
| 6   | `ExerciseCreateModal.tsx`                        | Rework completo con `useTranslation`                                                                             |
| 7   | `ErrorBoundary.tsx`                              | Rework con `useTranslation`                                                                                      |

### Priorità 2 – 🟠 Impatto medio

| #   | File / Area                                                                     | Intervento                                        |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| 8   | Pagine auth: forgot-password, reset-password, force-change-password, onboarding | Aggiungere `useTranslation` e sostituire stringhe |
| 9   | `src/app/profile/page.tsx` e `change-password/_content.tsx`                     | Rework i18n                                       |
| 10  | `EditProgramMetadata.tsx`                                                       | Aggiungere token mancanti                         |
| 11  | `WeekTypeBanner.tsx`, `WeightTypeSelector.tsx`                                  | Convertire dict interni in token i18n             |
| 12  | `ProfileForm.tsx`                                                               | Aggiungere `useTranslation`                       |
| 13  | `MovementPatternColorsSection.tsx`                                              | Mix EN/IT → uniformare con token                  |
| 14  | `src/app/trainer/exercises/_content.tsx`                                        | Convertire label filtri e titoli                  |

### Priorità 3 – 🟡 Impatto basso

| #   | File / Area                                                         | Intervento                                                     |
| --- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| 15  | `src/app/error.tsx`, `not-found.tsx`, `offline/page.tsx`            | Aggiungere i18n (pagine server component — richiede setup SSR) |
| 16  | `src/app/layout.tsx` metadata                                       | Token per title/description                                    |
| 17  | `AutocompleteSearch.tsx`, `DatePicker.tsx`                          | Default props → accettare `t()` da parent                      |
| 18  | `RepsInput.tsx`, `RestTimeSelector.tsx`, `RPESelector.tsx`          | Convertire label/placeholder                                   |
| 19  | `YoutubeEmbed.tsx`, `PWAInstallPrompt.tsx`, `ToastNotification.tsx` | Aria-label e testi minori                                      |
| 20  | `LoadingSpinner.tsx`, `RoleGuard.tsx`                               | Stringhe UI                                                    |
| 21  | `src/app/trainer/trainees/new/_content.tsx`                         | Messaggi invito email                                          |
| 22  | `src/lib/calculations.ts`                                           | Errori tecnici (bassa priorità)                                |

---

## 7. Raccomandazioni Architetturali

### 7.1 Strategia per i messaggi di validazione Zod

**Opzione A (raccomandata):** Usare token come messaggio Zod, tradurre in UI:
```typescript
// Schema
z.string().min(8, { message: 'validation:passwordMinLength' })

// UI - nel form error handler
const translatedError = t(error.message)
```

**Opzione B:** Custom error map globale che mappa codici Zod a token i18n.

### 7.2 Strategia per risposte API

Tutte le API devono restituire un token i18n nel campo `error.key` o `messageKey`:
```json
// Errore
{ "error": { "key": "program.cannotModifyNonDraft", "message": "Cannot modify..." } }

// Successo
{ "messageKey": "program.deletedSuccess", "data": { ... } }
```
Il client usa `t('errors:' + error.key)` per tradurre.

### 7.3 Centralizzazione messaggi ripetuti

Creare costanti per messaggi API ripetuti:
```typescript
// src/lib/api-constants.ts
export const API_ERROR_KEYS = {
  PROGRAM_NOT_DRAFT: 'program.cannotModifyNonDraft',
  AUTH_REQUIRED: 'auth.authenticationRequired',
  // ...
} as const
```

### 7.4 Token mancanti nei file di traduzione

Tutti i token suggeriti in questo documento dovranno essere aggiunti a:
- `public/locales/it/*.json`
- `public/locales/en/*.json`

---

## 8. File che NON necessitano intervento ✅

I seguenti file sono già correttamente internazionalizzati:

- `src/app/trainer/programs/_content.tsx`
- `src/app/trainer/programs/new/NewProgramContent.tsx`
- `src/app/trainer/trainees/_content.tsx`
- `src/app/trainer/exercises/new/_content.tsx`
- `src/app/admin/dashboard/_content.tsx`
- `src/app/admin/users/_content.tsx`
- `src/app/admin/programs/_content.tsx`
- `src/app/admin/exercises/_content.tsx`
- `src/app/trainee/dashboard/_content.tsx`
- `src/app/trainee/records/_content.tsx`
- `src/app/trainee/workouts/[id]/_content.tsx`
- `src/app/trainee/programs/_components/ProgramDetailContent.tsx`
- `src/lib/date-format.ts` (formattazione locale-aware ✅)
- `src/lib/api-error.ts` (gestisce token i18n ✅)
- `src/i18n/config.ts` (configurazione ✅)
