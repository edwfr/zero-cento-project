# API Contracts — Tabella Canonica Versionata

> **Versione**: 1.0.0  
> **Ultimo aggiornamento**: 2026-04-01  
> **Fonte autoritativa**: Questo documento è la fonte unica di verità per i contratti API di ZeroCento.  
> **Regola**: Ogni modifica agli endpoint DEVE essere riflessa qui prima del merge.

## Convenzioni

### Response format

Tutte le risposte usano i wrapper definiti in `src/lib/api-response.ts`:

**Success:**
```json
{
  "data": { ... },
  "meta": { "timestamp": "ISO 8601" }
}
```

**Success (lista con paginazione):**
```json
{
  "data": {
    "items": [ ... ],
    "pagination": { "nextCursor": "string | null", "hasMore": true }
  },
  "meta": { "timestamp": "ISO 8601" }
}
```

**Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | RATE_LIMIT_EXCEEDED | INTERNAL_ERROR",
    "message": "Human-readable message",
    "details": {},
    "key": "domain.errorType"
  }
}
```

### HTTP Status Codes

| Code | Uso                                                          |
| ---- | ------------------------------------------------------------ |
| 200  | GET success, PUT/PATCH success                               |
| 201  | POST creation success                                        |
| 204  | DELETE success (no body)                                     |
| 400  | Validation error, bad request                                |
| 401  | Non autenticato                                              |
| 403  | Ruolo insufficiente / non autorizzato                        |
| 404  | Risorsa non trovata                                          |
| 409  | Conflitto (es. eliminazione risorsa in uso, stato duplicato) |
| 500  | Errore interno server                                        |

### Paginazione

Paginazione cursor-based per tutti gli endpoint lista. Parametri query:
- `cursor` — ID dell'ultimo elemento della pagina precedente
- `limit` — Numero di elementi per pagina (default: 20, max: 100)

---

## Endpoint Registry

### System

| Method | Path           | Descrizione              | Auth | Schema Request | Status |
| ------ | -------------- | ------------------------ | ---- | -------------- | ------ |
| `GET`  | `/api/health`  | Health check             | No   | —              | 200    |
| `GET`  | `/api/auth/me` | Sessione utente corrente | Si   | —              | 200    |

### Users

| Method   | Path                         | Descrizione             | Ruoli          | Schema Request                     | Status |
| -------- | ---------------------------- | ----------------------- | -------------- | ---------------------------------- | ------ |
| `GET`    | `/api/users`                 | Lista utenti (paginata) | admin, trainer | query: `?role&search&cursor&limit` | 200    |
| `POST`   | `/api/users`                 | Crea utente             | admin, trainer | `createUserSchema`                 | 201    |
| `GET`    | `/api/users/[id]`            | Dettaglio utente        | admin, trainer | —                                  | 200    |
| `PUT`    | `/api/users/[id]`            | Modifica utente         | admin, trainer | `updateUserSchema`                 | 200    |
| `DELETE` | `/api/users/[id]`            | Elimina utente          | admin, trainer | —                                  | 204    |
| `PATCH`  | `/api/users/[id]/deactivate` | Disabilita utente       | admin, trainer | —                                  | 200    |
| `PATCH`  | `/api/users/[id]/activate`   | Abilita utente          | admin, trainer | —                                  | 200    |

### Exercises

| Method   | Path                  | Descrizione                       | Ruoli          | Schema Request                                                                  | Status  |
| -------- | --------------------- | --------------------------------- | -------------- | ------------------------------------------------------------------------------- | ------- |
| `GET`    | `/api/exercises`      | Lista esercizi (paginata, cursor) | tutti          | query: `?type&movementPatternId&muscleGroupId&search&cursor&limit&sortBy&order` | 200     |
| `POST`   | `/api/exercises`      | Crea esercizio                    | admin, trainer | `exerciseSchema`                                                                | 201     |
| `GET`    | `/api/exercises/[id]` | Dettaglio esercizio               | tutti          | —                                                                               | 200     |
| `PUT`    | `/api/exercises/[id]` | Modifica esercizio                | admin, trainer | `updateExerciseSchema`                                                          | 200     |
| `DELETE` | `/api/exercises/[id]` | Elimina esercizio                 | admin, trainer | —                                                                               | 204/409 |

### Muscle Groups

| Method   | Path                              | Descrizione            | Ruoli          | Schema Request            | Status  |
| -------- | --------------------------------- | ---------------------- | -------------- | ------------------------- | ------- |
| `GET`    | `/api/muscle-groups`              | Lista gruppi muscolari | tutti          | query: `?includeArchived` | 200     |
| `POST`   | `/api/muscle-groups`              | Crea gruppo muscolare  | admin, trainer | `muscleGroupSchema`       | 201     |
| `GET`    | `/api/muscle-groups/[id]`         | Dettaglio gruppo       | tutti          | —                         | 200     |
| `PUT`    | `/api/muscle-groups/[id]`         | Modifica gruppo        | admin, trainer | `updateMuscleGroupSchema` | 200     |
| `PATCH`  | `/api/muscle-groups/[id]/archive` | Archivia gruppo        | admin, trainer | —                         | 200     |
| `DELETE` | `/api/muscle-groups/[id]`         | Elimina gruppo         | admin, trainer | —                         | 204/409 |

### Movement Patterns

| Method   | Path                                  | Descrizione         | Ruoli          | Schema Request                | Status  |
| -------- | ------------------------------------- | ------------------- | -------------- | ----------------------------- | ------- |
| `GET`    | `/api/movement-patterns`              | Lista schemi motori | tutti          | query: `?includeArchived`     | 200     |
| `POST`   | `/api/movement-patterns`              | Crea schema motorio | admin, trainer | `movementPatternSchema`       | 201     |
| `GET`    | `/api/movement-patterns/[id]`         | Dettaglio schema    | tutti          | —                             | 200     |
| `PUT`    | `/api/movement-patterns/[id]`         | Modifica schema     | admin, trainer | `updateMovementPatternSchema` | 200     |
| `PATCH`  | `/api/movement-patterns/[id]/archive` | Archivia schema     | admin, trainer | —                             | 200     |
| `DELETE` | `/api/movement-patterns/[id]`         | Elimina schema      | admin, trainer | —                             | 204/409 |

### Programs

| Method   | Path                          | Descrizione                           | Ruoli   | Schema Request                                 | Status |
| -------- | ----------------------------- | ------------------------------------- | ------- | ---------------------------------------------- | ------ |
| `GET`    | `/api/programs`               | Lista programmi (paginata)            | trainer | query: `?traineeId&status&search&cursor&limit` | 200    |
| `POST`   | `/api/programs`               | Crea programma (draft)                | trainer | `createProgramSchema`                          | 201    |
| `GET`    | `/api/programs/[id]`          | Dettaglio programma                   | trainer | —                                              | 200    |
| `PUT`    | `/api/programs/[id]`          | Modifica programma (solo draft)       | trainer | `updateProgramSchema`                          | 200    |
| `DELETE` | `/api/programs/[id]`          | Elimina programma (solo draft)        | trainer | —                                              | 204    |
| `POST`   | `/api/programs/[id]/publish`  | Pubblica programma (draft→active)     | trainer | `publishProgramSchema`                         | 200    |
| `POST`   | `/api/programs/[id]/complete` | Completa programma (active→completed) | trainer | `completeProgramSchema`                        | 200    |
| `GET`    | `/api/programs/[id]/progress` | Avanzamento trainee                   | trainer | —                                              | 200    |
| `GET`    | `/api/programs/[id]/reports`  | Report programma                      | trainer | query: `?type`                                 | 200    |

### Weeks

| Method  | Path              | Descrizione         | Ruoli   | Schema Request     | Status |
| ------- | ----------------- | ------------------- | ------- | ------------------ | ------ |
| `PATCH` | `/api/weeks/[id]` | Configura settimana | trainer | `updateWeekSchema` | 200    |

### Workout Exercises

| Method   | Path                                                             | Descrizione                 | Ruoli   | Schema Request                | Status |
| -------- | ---------------------------------------------------------------- | --------------------------- | ------- | ----------------------------- | ------ |
| `GET`    | `/api/programs/[id]/workouts/[workoutId]/exercises`              | Lista esercizi workout      | trainer | —                             | 200    |
| `POST`   | `/api/programs/[id]/workouts/[workoutId]/exercises`              | Aggiungi esercizio          | trainer | `workoutExerciseSchema`       | 201    |
| `GET`    | `/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]` | Dettaglio esercizio workout | trainer | —                             | 200    |
| `PUT`    | `/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]` | Modifica esercizio workout  | trainer | `updateWorkoutExerciseSchema` | 200    |
| `DELETE` | `/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]` | Rimuovi esercizio workout   | trainer | —                             | 204    |
| `POST`   | `/api/programs/[id]/workouts/[workoutId]/exercises/reorder`      | Riordina esercizi           | trainer | `{ exerciseIds: string[] }`   | 200    |

### Feedback

| Method   | Path                 | Descrizione               | Ruoli            | Schema Request                          | Status |
| -------- | -------------------- | ------------------------- | ---------------- | --------------------------------------- | ------ |
| `GET`    | `/api/feedback`      | Lista feedback (paginata) | trainer, trainee | query: `?programId&weekId&cursor&limit` | 200    |
| `POST`   | `/api/feedback`      | Invia feedback            | trainee          | `feedbackSchema`                        | 201    |
| `GET`    | `/api/feedback/[id]` | Dettaglio feedback        | trainer, trainee | —                                       | 200    |
| `PUT`    | `/api/feedback/[id]` | Modifica feedback         | trainee          | `updateFeedbackSchema`                  | 200    |
| `DELETE` | `/api/feedback/[id]` | Elimina feedback          | trainee          | —                                       | 204    |

### Personal Records

| Method | Path                    | Descrizione     | Ruoli            | Schema Request                 | Status |
| ------ | ----------------------- | --------------- | ---------------- | ------------------------------ | ------ |
| `GET`  | `/api/personal-records` | Lista massimali | trainer, trainee | query: `?traineeId&exerciseId` | 200    |

> **Nota**: `/api/personal-records` e `/api/users` non implementano ancora paginazione cursor-based. Da allineare in sprint futuro.

| `POST`   | `/api/personal-records`      | Aggiungi massimale  | trainer          | `personalRecordSchema`                      | 201    |
| `GET`    | `/api/personal-records/[id]` | Dettaglio massimale | trainer, trainee | —                                           | 200    |
| `PUT`    | `/api/personal-records/[id]` | Modifica massimale  | trainer          | `updatePersonalRecordSchema`                | 200    |
| `DELETE` | `/api/personal-records/[id]` | Elimina massimale   | trainer          | —                                           | 204    |

### Trainee View

| Method | Path                         | Descrizione                | Ruoli   | Schema Request | Status |
| ------ | ---------------------------- | -------------------------- | ------- | -------------- | ------ |
| `GET`  | `/api/trainee/workouts/[id]` | Workout con pesi calcolati | trainee | —              | 200    |

### Admin

| Method | Path                                       | Descrizione                       | Ruoli | Schema Request                              | Status |
| ------ | ------------------------------------------ | --------------------------------- | ----- | ------------------------------------------- | ------ |
| `POST` | `/api/admin/trainees/[traineeId]/reassign` | Riassegna trainee                 | admin | `{ newTrainerId: string, reason?: string }` | 200    |
| `GET`  | `/api/admin/reports/global`                | Report globale piattaforma        | admin | query: `?from&to`                           | 200    |
| `PUT`  | `/api/admin/programs/[id]/override`        | Override programma (bypass stato) | admin | body: program fields                        | 200    |

---

## Discrepanze note tra design e implementazione

> Le seguenti differenze tra `design/03-backend-api.md` e l'implementazione corrente sono documentate per trasparenza. Questa tabella canonica riflette lo **stato reale implementato**.

| Area              | Design Doc                                                                    | Implementazione                                 | Azione                                       |
| ----------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| Complete program  | `PATCH /api/programs/[id]/complete`                                           | `POST /api/programs/[id]/complete`              | Mantenere POST (azione, non update parziale) |
| Personal records  | Nested: `/api/trainer/trainees/[id]/records/*`                                | Flat: `/api/personal-records` con `?traineeId`  | Mantenere flat (più semplice)                |
| Trainee programs  | `/api/trainee/programs`, `/api/trainee/programs/current`                      | Non implementati                                | Da implementare in sprint futuro             |
| Trainee records   | `/api/trainee/records/*`                                                      | Non implementati                                | Da implementare in sprint futuro             |
| Feedback submit   | `POST /api/programs/[id]/submit`                                              | Non implementato                                | Da implementare in sprint futuro             |
| Report sub-routes | `/api/programs/[id]/reports/sbd`, `/reports/training-sets`, `/reports/volume` | Unificato: `/api/programs/[id]/reports?type=`   | Mantenere unificato                          |
| Admin programs    | Nested admin CRUD completo                                                    | Solo override endpoint                          | Da valutare in sprint futuro                 |
| Admin reassign    | `PUT /api/admin/trainer-trainee/[traineeId]`                                  | `POST /api/admin/trainees/[traineeId]/reassign` | Mantenere POST (azione semantica)            |

---

## Changelog

### v1.0.0 (2026-04-01)
- Creazione tabella canonica basata su audit completo implementazione
- Documentazione discrepanze design vs implementazione
- Definizione convenzioni response format e status codes
