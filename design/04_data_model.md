# Data Model

## Database & ORM
- **Database**: **Supabase PostgreSQL** (connection pooling PgBouncer incluso)
- **ORM**: **Prisma** (schema dichiarativo, type-safety, migrations)
- **Strategia migrazioni**: **Prisma Migrate** con migration files (trackable, rollback-capable)

**Configurazione**:
```env
# Connection pooled per runtime app (max performance)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:6543/postgres?pgbouncer=true"

# Connection diretta per migrations (PgBouncer non supporta DDL)
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
```

**Workflow migrations**:
```bash
# 1. Modifica schema.prisma
# 2. Crea migration
npx prisma migrate dev --name add_exercise_category

# 3. Deploy in produzione
npx prisma migrate deploy
```

## Entità principali

| Entità                 | Descrizione                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `User`                 | Utente del sistema con ruolo (admin / trainer / trainee)                                  |
| `TrainerTrainee`       | Associazione esplicita trainer → trainee                                                  |
| `MuscleGroup`          | Gruppo muscolare gestibile (es. Pettorali, Quadricipiti) - configurabile da admin/trainer |
| `MovementPattern`      | Schema motorio gestibile (es. Squat, Push) - configurabile da admin/trainer               |
| `MovementPatternColor` | Colore personalizzato per MovementPattern per ogni trainer - vista alto livello schede    |
| `Exercise`             | Esercizio nella libreria condivisa (con gruppi muscolari, tipo, schema motorio)           |
| `ExerciseMuscleGroup`  | Associazione Exercise ↔ MuscleGroup con coefficiente d'incidenza (0.0-1.0)                |
| `TrainingProgram`      | Scheda di allenamento multi-settimana assegnata a un trainee                              |
| `Week`                 | Singola settimana all'interno di una scheda                                               |
| `Workout`              | Singolo allenamento (giorno) all'interno di una settimana                                 |
| `WorkoutExercise`      | Esercizio con parametri all'interno di un allenamento                                     |
| `ExerciseFeedback`     | Feedback del trainee su un WorkoutExercise (serie, kg, RPE)                               |
| `PersonalRecord`       | Massimali (1RM o nRM) gestiti per trainee ed esercizio                                    |

## Schema (logico)

```
User
  id            UUID  PK
  email         String  UNIQUE
  firstName     String
  lastName      String
  role          Enum(admin, trainer, trainee)
  isActive      Boolean         -- profilo attivo o disattivato
  initialPassword String?       -- prima password generata dal trainer (opzionale)
  createdAt     DateTime

TrainerTrainee
  id            UUID  PK
  trainerId       FK → User
  traineeId     FK → User

MuscleGroup
  id            UUID  PK
  name          String  UNIQUE      -- es. "Pettorali", "Quadricipiti", "Deltoidi anteriori"
  description   String?             -- descrizione opzionale
  createdBy     FK → User           -- admin/trainer che ha creato (audit trail)
  createdAt     DateTime
  isActive      Boolean             -- flag per "archiviare" gruppi muscolari obsoleti senza eliminarli

  -- NOTA: Gestibile da admin e trainer (libreria condivisa)
  -- Permette espansione categorizzazioni senza modificare codice

MovementPattern
  id            UUID  PK
  name          String  UNIQUE      -- es. "Squat", "Horizontal Push", "Hip Extension"
  description   String?             -- descrizione schema motorio
  createdBy     FK → User           -- admin/trainer che ha creato (audit trail)
  createdAt     DateTime
  isActive      Boolean             -- flag per "archiviare" pattern obsoleti

  -- NOTA: Gestibile da admin e trainer (libreria condivisa)
  -- Alternative: "Accosciata", "Spinta Orizzontale", "Estensione Anca", "Tirata Verticale", etc.

MovementPatternColor
  id                UUID  PK
  trainerId         FK → User              -- trainer proprietario della personalizzazione
  movementPatternId FK → MovementPattern   -- pattern da colorare
  color             String                 -- hex color (es. "#3b82f6", "#ef4444")
  
  UNIQUE(trainerId, movementPatternId)  -- Constraint: un trainer può avere un solo colore per pattern
  
  -- NOTA: Personalizzazione colori per vista alto livello schede
  -- Trainer vede distribuzione MovementPattern nella settimana con colori custom
  -- Se non esiste record per trainer+pattern, sistema usa colore default
  -- Colori suggeriti default: Squat=#8b5cf6, Push=#3b82f6, Pull=#10b981, etc.

Exercise
  id                  UUID  PK
  name                String
  description         String?
  youtubeUrl          String          -- URL video YouTube dimostrativo
  type                Enum(fundamental, accessory)  -- Fondamentale (SBD) o Accessorio
  movementPatternId   FK → MovementPattern  -- Schema motorio (relazione vs enum hardcoded)
  notes               String[]        -- Lista di note/varianti
  createdBy           FK → User       -- trainer/admin che ha creato l'esercizio (solo audit trail, NON determina ownership)
  createdAt           DateTime

  -- RELAZIONE GRUPPI MUSCOLARI: via ExerciseMuscleGroup (many-to-many con coefficient)

  -- NOTA: Libreria CONDIVISA tra tutti i trainer
  -- Ogni trainer può CRUD su QUALSIASI esercizio (non solo i propri)
  -- Campo createdBy serve solo per tracciabilità/audit, non per permission

ExerciseMuscleGroup
  id            UUID  PK
  exerciseId    FK → Exercise
  muscleGroupId FK → MuscleGroup
  coefficient   Float           -- Coefficiente d'incidenza 0.0-1.0 (es. 0.8 per muscolo primario, 0.3 per sinergico)
  
  UNIQUE(exerciseId, muscleGroupId)  -- Constraint: un esercizio non può avere lo stesso gruppo muscolare duplicato

TrainingProgram
  id                 UUID  PK
  title              String
  trainerId            FK → User
  traineeId          FK → User
  startDate          Date?            -- Data inizio Week 1 (null se draft, popolato a pubblicazione)
  durationWeeks      Int
  workoutsPerWeek    Int             -- n allenamenti per settimana
  status             Enum(draft, active, completed)
  publishedAt        DateTime?       -- Timestamp pubblicazione (null se draft)
  createdAt          DateTime
  updatedAt          DateTime

  -- NOTA: Workflow creazione scheda
  -- 1. status=draft: trainer può salvare parzialmente, modificare n volte
  -- 2. Pubblicazione: trainer decide quando → status=active, startDate popolato (Week 1 mapping calendario)
  -- 3. startDate usato per calcolare date settimane successive e reportistica

Week
  id                 UUID  PK
  programId          FK → TrainingProgram
  weekNumber         Int              -- 1, 2, 3, ..., n
  startDate          Date?            -- Data inizio settimana (calcolata: program.startDate + (weekNumber-1)*7 giorni)
  feedbackRequested  Boolean          -- feedback OBBLIGATORIO per questa settimana (impostato da trainer)
  generalFeedback    String?          -- feedback generale del trainee sulla settimana
  
  -- NOTA: startDate calcolato automaticamente dopo pubblicazione programma
  -- Week 1 startDate = TrainingProgram.startDate (scelto da trainer a pubblicazione)
  -- Week 2 startDate = TrainingProgram.startDate + 7 giorni
  -- Week n startDate = TrainingProgram.startDate + (n-1)*7 giorni
  
  -- NOTA: feedbackRequested
  -- Trainer può marcare settimane specifiche come "feedback obbligatorio"
  -- Esempio: Week 1-4 feedbackRequested=false (feedback opzionale)
  --          Week 5 feedbackRequested=true (feedback OBBLIGATORIO)
  --          Week 6 feedbackRequested=false (feedback opzionale)
  -- Se true, trainee deve compilare feedback per TUTTI gli esercizi della settimana
  -- UI trainee mostra badge "Feedback Richiesto" e blocca avanzamento settimana successiva se incompleto

Workout
  id            UUID  PK
  weekId        FK → Week
  dayLabel      String          -- es. "Lunedì", "Giorno A"
  notes         String?

WorkoutExercise
  id                UUID  PK
  workoutId         FK → Workout
  exerciseId        FK → Exercise
  sets              Int
  reps              String          -- es. "8", "8-10", "6/8" (intervallo)
  targetRpe         Float?          -- target RPE (5.0–10.0 con incrementi di 0.5)
  weightType        Enum(absolute, percentage_1rm, percentage_rm)  -- tipo di peso
  weight            Float?          -- kg assoluti o percentuale (se SBD, intensità in % dà i KG)
  restTime          Enum(30s, 1m, 2m, 3m, 5m)  -- tempo di recupero
  isWarmup          Boolean         -- flag riscaldamento
  notes             String?         -- note con menu a tendina (predefinite)
  order             Int             -- posizione nell'allenamento

ExerciseFeedback
  id                 UUID  PK
  workoutExerciseId  FK → WorkoutExercise
  traineeId          FK → User
  date               DateTime
  completed          Boolean
  actualRpe          Float?      -- RPE percepito dal trainee (5.0–10.0 con incrementi di 0.5)
  setsPerformed      Json        -- Array di {reps: Int, weight: Float} per ogni serie completata
  notes              String?     -- commento libero del trainee

PersonalRecord
  id                 UUID  PK
  traineeId          FK → User
  exerciseId         FK → Exercise
  reps               Int         -- numero di ripetizioni (1 per 1RM, n per nRM)
  weight             Float       -- peso in kg
  recordDate         Date        -- data del record
  notes              String?
  createdAt          DateTime
```

## Relazioni
- `User(trainer)` → N `TrainingProgram` (come trainer)
- `User(trainee)` → N `TrainingProgram` (come destinatario)
- `User(trainer)` ↔ N `User(trainee)` via `TrainerTrainee`
- `User(trainer)` → N `MovementPatternColor` (personalizzazione colori per vista alto livello)
- `MovementPattern` → N `MovementPatternColor` (colori custom per trainer)
- `MuscleGroup` ↔ N `Exercise` via `ExerciseMuscleGroup` (many-to-many con coefficient)
- `MovementPattern` → N `Exercise` (one-to-many)
- `Exercise` ↔ N `MuscleGroup` via `ExerciseMuscleGroup` (many-to-many con coefficient)
- `TrainingProgram` → N `Week` → N `Workout` → N `WorkoutExercise` → N `ExerciseFeedback`
- `Exercise` → N `WorkoutExercise`
- `User(trainee)` → N `ExerciseFeedback`
- `User(trainee)` → N `PersonalRecord` (massimali per trainee)
- `Exercise` → N `PersonalRecord` (massimali per esercizio)

## Dashboard Trainer - KPI

Quando il trainer accede al sistema, visualizza una dashboard con indicatori chiave sullo stato dei suoi trainee.

### KPI Principali

| KPI                                       | Descrizione                                                           | Priorità  |
| ----------------------------------------- | --------------------------------------------------------------------- | --------- |
| **Trainee Attivi**                        | Totale trainee con `isActive=true` e scheda `status=active` assegnata | Info      |
| **Schede in Scadenza (< 2 settimane)**    | Trainee con scheda attiva che termina entro 14 giorni                 | ⚠️ Warning |
| **Schede in Scadenza (questa settimana)** | Trainee con scheda attiva che termina entro 7 giorni                  | 🔴 Alta    |

### Calcolo Data Fine Scheda

La data di termine di una scheda si calcola come:
```typescript
endDate = startDate + (durationWeeks * 7) giorni
```

**Esempio**:
- `startDate`: 2026-04-01
- `durationWeeks`: 12
- `endDate`: 2026-06-23 (2026-04-01 + 84 giorni)

### Query Dashboard

**1. Trainee Attivi Totali**
```sql
SELECT COUNT(DISTINCT tp.traineeId)
FROM TrainingProgram tp
JOIN User u ON tp.traineeId = u.id
WHERE tp.trainerId = <trainerId>
  AND tp.status = 'active'
  AND u.isActive = true
```

**2. Schede in Scadenza (< 2 settimane)**
```sql
SELECT 
  u.id,
  u.firstName,
  u.lastName,
  tp.title,
  tp.startDate,
  tp.durationWeeks,
  (tp.startDate + (tp.durationWeeks * 7)) AS endDate,
  ((tp.startDate + (tp.durationWeeks * 7)) - CURRENT_DATE) AS daysRemaining
FROM TrainingProgram tp
JOIN User u ON tp.traineeId = u.id
WHERE tp.trainerId = <trainerId>
  AND tp.status = 'active'
  AND u.isActive = true
  AND (tp.startDate + (tp.durationWeeks * 7)) BETWEEN CURRENT_DATE AND (CURRENT_DATE + 14)
ORDER BY endDate ASC
```

**3. Schede in Scadenza (questa settimana)**
```sql
SELECT 
  u.id,
  u.firstName,
  u.lastName,
  tp.title,
  tp.startDate,
  tp.durationWeeks,
  (tp.startDate + (tp.durationWeeks * 7)) AS endDate,
  ((tp.startDate + (tp.durationWeeks * 7)) - CURRENT_DATE) AS daysRemaining
FROM TrainingProgram tp
JOIN User u ON tp.traineeId = u.id
WHERE tp.trainerId = <trainerId>
  AND tp.status = 'active'
  AND u.isActive = true
  AND (tp.startDate + (tp.durationWeeks * 7)) BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7)
ORDER BY endDate ASC
```

### Interazione UI

**Dashboard View**:
```
┌─────────────── Dashboard Trainer ────────────────┐
│                                                   │
│  📊 Trainee Attivi                        15      │
│                                                   │
│  ⚠️  Schede in scadenza (< 2 settimane)   5       │
│      [Clicca per dettagli]                        │
│                                                   │
│  🔴 Schede in scadenza (questa settimana)  2      │
│      [Clicca per dettagli]                        │
│                                                   │
└───────────────────────────────────────────────────┘
```

**Vista Dettaglio Scadenze** (cliccando su KPI warning/alta priorità):
```
┌─────────── Schede in Scadenza ───────────┐
│ Trainee         Scheda              Termina    Giorni  │
│ Mario Rossi     Forza 12W          2026-04-05  9 gg   │
│ Laura Bianchi   Ipertrofia 8W      2026-04-08  12 gg  │
│ Paolo Verdi     Powerlifting 16W   2026-04-10  14 gg  │
└──────────────────────────────────────────────────────┘

Filtri: [Questa settimana] [< 2 settimane] [Tutte]
```

### Note Implementative

- **Refresh**: KPI ricalcolati ad ogni accesso dashboard (query leggere, no caching necessario)
- **Filtro `isActive`**: Solo trainee con `User.isActive=true` sono inclusi nei conteggi
- **Azioni rapide**: Dalla vista dettaglio, trainer può:
  - Aprire profilo trainee
  - Creare nuova scheda (se scheda corrente sta per terminare)
  - Visualizzare storico schede trainee
- **Notifiche opzionali**: Sistema può inviare notifiche email/push a trainer quando scheda sta per scadere (< 7 giorni) ❓ **OD-28**

## Gestione Feedback

### Feedback Obbligatori per Settimana

Il trainer può marcare settimane specifiche come "feedback obbligatorio" durante la compilazione della scheda.

**Workflow Trainer (compilazione scheda)**:
```typescript
// Durante creazione/modifica settimana
PATCH /api/weeks/[week-id]
{
  "feedbackRequested": true  // Marca la settimana come obbligatoria per feedback
}Validazione feedback obbligatori**: COUNT `WorkoutExercise` vs COUNT `ExerciseFeedback` per settimana con `feedbackRequested=true`
- **Storico feedback esercizio**: `ExerciseFeedback` per `exerciseId` + `dayLabel` + `programId` + settimane precedenti, ordinati per `weekNumber` DESC
- **

// Esempio: Scheda 12 settimane
// Week 1-4: feedbackRequested = false (feedback opzionale)
// Week 5: feedbackRequested = true (OBBLIGATORIO - punto controllo mesociclo)
// Week 6-11: feedbackRequested = false (opzionale)
// Week 12: feedbackRequested = true (OBBLIGATORIO - valutazione finale)
```

**UI Trainer (vista scheda)**:
```
┌─────────── Configurazione Settimane ───────────┐
│ Week 1  [ ] Feedback obbligatorio              │
│ Week 2  [ ] Feedback obbligatorio              │
│ Week 3  [ ] Feedback obbligatorio              │
│ Week 4  [ ] Feedback obbligatorio              │
│ Week 5  [✓] Feedback obbligatorio  ⚠️          │
│ Week 6  [ ] Feedback obbligatorio              │
│ ...                                            │
│ Week 12 [✓] Feedback obbligatorio  ⚠️          │
└────────────────────────────────────────────────┘
```

**Workflow Trainee (compilazione feedback)**:

Se `Week.feedbackRequested = true`:
- UI mostra badge "🔴 Feedback Obbligatorio" sulla settimana
- Trainee deve compilare `ExerciseFeedback` per TUTTI i `WorkoutExercise` della settimana
- Sistema blocca avanzamento alla settimana successiva finché feedback non è completo
- Notifica push/email a trainee se settimana obbligatoria sta per terminare senza feedback

Se `Week.feedbackRequested = false`:
- Trainee può compilare feedback su esercizi specifici a sua discrezione
- Nessun blocco avanzamento settimana

**Query validazione feedback obbligatorio**:
```sql
-- Verifica se trainee ha completato feedback obbligatori per settimana
SELECT 
  w.id AS weekId,
  w.weekNumber,
  w.feedbackRequested,
  COUNT(DISTINCT we.id) AS totalExercises,
  COUNT(DISTINCT ef.workoutExerciseId) AS exercisesWithFeedback
FROM Week w
JOIN Workout wo ON wo.weekId = w.id
JOIN WorkoutExercise we ON we.workoutId = wo.id
LEFT JOIN ExerciseFeedback ef ON ef.workoutExerciseId = we.id 
  AND ef.traineeId = <traineeId>
WHERE w.id = <weekId>
  AND w.feedbackRequested = true
GROUP BY w.id, w.weekNumber, w.feedbackRequested
HAVING COUNT(DISTINCT we.id) != COUNT(DISTINCT ef.workoutExerciseId)

-- Se query ritorna righe → feedback incompleto (blocca avanzamento)
-- Se query vuota → feedback completo (consenti avanzamento)
```

### Storico Feedback per Esercizio

Quando il trainee compila feedback per un esercizio, può visualizzare i feedback delle settimane precedenti per **lo stesso esercizio** all'interno della stessa scheda.

**Caso d'uso**:
- Trainee è a Week 5, Workout "Giorno A", esercizio "Squat"
- Può vedere feedback di Squat da Week 1, 2, 3, 4 (dello stesso Workout "Giorno A")
- Visualizza: RPE percepito, serie/reps/peso completati, note personali

**Query storico feedback esercizio**:
```sql
-- Recupera storico feedback per stesso esercizio nelle settimane precedenti
SELECT 
  w.weekNumber,
  w.startDate,
  ef.date,
  ef.actualRpe,
  ef.setsPerformed,  -- JSON array [{reps: 8, weight: 80}, ...]
  ef.notes,
  ef.completed,
  we.sets AS targetSets,
  we.reps AS targetReps,
  we.targetRpe
FROM ExerciseFeedback ef
JOIN WorkoutExercise we ON ef.workoutExerciseId = we.id
JOIN Workout wo ON we.workoutId = wo.id
JOIN Week w ON wo.weekId = w.id
WHERE we.exerciseId = <exerciseId>           -- Stesso esercizio (es. Squat)
  AND wo.dayLabel = <currentDayLabel>         -- Stesso giorno (es. "Giorno A")
  AND w.programId = <currentProgramId>        -- Stessa scheda
  AND w.weekNumber < <currentWeekNumber>      -- Solo settimane PRECEDENTI
  AND ef.traineeId = <traineeId>
ORDER BY w.weekNumber DESC
LIMIT 10  -- Ultime 10 settimane con feedback
```

**UI Trainee (compilazione feedback con storico)**:
```
┌─────────── Feedback Esercizio ───────────────────────────┐
│ Week 5 · Giorno A · Squat                                │
│                                                           │
│ Target: 5 serie × 5 reps @ 80% 1RM (RPE 8.0)            │
│                                                           │
│ Serie Completate:                                        │
│ Serie 1: [8] reps × [100] kg  RPE: [8.5]                │
│ Serie 2: [7] reps × [100] kg                            │
│ Serie 3: [6] reps × [100] kg                            │
│ [+ Aggiungi Serie]                                       │
│                                                           │
│ Note personali:                                          │
│ [Fatica accumulata, ridurre carico settimana prossima]  │
│                                                           │
│ ─────────── Storico Settimane Precedenti ────────────── │
│                                                           │
│ 📊 Week 4 (2026-04-22)                    RPE 8.0        │
│    5×5 @ 95kg · Note: "Buona tecnica"                    │
│    [Espandi dettagli ▼]                                  │
│                                                           │
│ 📊 Week 3 (2026-04-15)                    RPE 7.5        │
│    5×5 @ 92.5kg · Note: "Ancora sotto RPE target"        │
│    [Espandi dettagli ▼]                                  │
│                                                           │
│ 📊 Week 2 (2026-04-08)                    RPE 7.0        │
│    5×5 @ 90kg · Note: "Facile, aumentare carico"         │
│    [Espandi dettagli ▼]                                  │
│                                                           │
│ 📊 Week 1 (2026-04-01)                    RPE 6.5        │
│    5×5 @ 85kg · Note: "Settimana introduttiva"           │
│    [Espandi dettagli ▼]                                  │
│                                                           │
│ [Salva Feedback]                               [Annulla] │
└───────────────────────────────────────────────────────────┘
```

**Dettagli implementativi storico**:
- Storico mostrato solo quando trainee apre form feedback esercizio
- Confronto automatico target vs actual (evidenzia se trainee ha raggiunto target RPE/reps)
- Grafico opzionale: trend RPE/peso nelle ultime N settimane ❓ **OD-29**
- Espansione dettaglio mostra serie complete: `[{reps: 5, weight: 85}, {reps: 5, weight: 85}, ...]`

### Note UX

**Feedback obbligatorio**:
- Badge visibile: 🔴 "Feedback Obbligatorio" in header settimana
- Progress bar: "3/8 esercizi completati" (dinamico)
- Alert: "Completa tutti i feedback per avanzare a Week 6"
- Notifica trainer: quando trainee completa settimana con feedback obbligatorio

**Storico feedback**:
- Caricamento lazy: storico recuperato solo quando trainee apre form esercizio (no preload)
- Cache locale: storico cachato per sessione (evita query ripetute)
- Collapsible: default collapsed per non ingombrare UI, espandibile on-click

## Visualizzazione Feedback per Trainer

Il trainer deve poter visualizzare i feedback obbligatori compilati dai trainee in due contesti principali.

### Contesto 1: Vista Generale Trainee (Profilo/Dashboard)

Nella scheda del trainee, il trainer visualizza una sezione dedicata "Feedback Raccolti" con aggregazione per esercizio.

**Query feedback trainee raggruppati per esercizio**:
```sql
-- Recupera tutti i feedback di settimane obbligatorie per un trainee, raggruppati per esercizio
SELECT 
  e.id AS exerciseId,
  e.name AS exerciseName,
  e.type AS exerciseType,
  mp.name AS movementPattern,
  COUNT(DISTINCT ef.id) AS totalFeedbackCount,
  COUNT(DISTINCT w.id) AS weeksWithFeedback,
  MAX(ef.date) AS lastFeedbackDate,
  AVG(ef.actualRpe) AS avgRpe,
  -- Aggregazione serie/peso (richiede elaborazione JSON)
  JSON_AGG(
    JSON_BUILD_OBJECT(
      'weekNumber', w.weekNumber,
      'weekStartDate', w.startDate,
      'feedbackDate', ef.date,
      'actualRpe', ef.actualRpe,
      'setsPerformed', ef.setsPerformed,
      'notes', ef.notes,
      'completed', ef.completed,
      'targetSets', we.sets,
      'targetReps', we.reps,
      'targetRpe', we.targetRpe
    ) ORDER BY w.weekNumber DESC
  ) AS feedbackHistory
FROM Exercise e
JOIN WorkoutExercise we ON we.exerciseId = e.id
JOIN ExerciseFeedback ef ON ef.workoutExerciseId = we.id
JOIN Workout wo ON we.workoutId = wo.id
JOIN Week w ON wo.weekId = w.id
JOIN TrainingProgram tp ON w.programId = tp.id
LEFT JOIN MovementPattern mp ON e.movementPatternId = mp.id
WHERE ef.traineeId = <traineeId>
  AND tp.trainerId = <trainerId>
  AND w.feedbackRequested = true  -- Solo settimane con feedback obbligatorio
GROUP BY e.id, e.name, e.type, mp.name
ORDER BY lastFeedbackDate DESC, exerciseName ASC
```

**UI Vista Generale Trainee**:
```
┌─────────── Profilo Trainee: Mario Rossi ──────────────┐
│                                                        │
│ [Anagrafica] [Schede] [Massimali] [📊 Feedback]       │
│                                                        │
│ ──────────── Feedback Raccolti (Settimane Obbligatorie) ────── │
│                                                        │
│ Filtri: [Tutte le schede ▼] [Tutti gli esercizi ▼]   │
│                                                        │
│ 🟣 Squat (Fondamentale)                  12 feedback  │
│    Ultimo: 2026-03-20 · RPE medio: 8.2               │
│    [Visualizza dettaglio ▼]                           │
│                                                        │
│ 🔵 Bench Press (Fondamentale)            10 feedback  │
│    Ultimo: 2026-03-18 · RPE medio: 7.8               │
│    [Visualizza dettaglio ▼]                           │
│                                                        │
│ 🟢 Deadlift (Fondamentale)               12 feedback  │
│    Ultimo: 2026-03-19 · RPE medio: 8.5               │
│    [Visualizza dettaglio ▼]                           │
│                                                        │
│ 🔵 Incline Dumbbell Press (Accessorio)    8 feedback │
│    Ultimo: 2026-03-18 · RPE medio: 7.5               │
│    [Visualizza dettaglio ▼]                           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**UI Dettaglio Esercizio Espanso** (quando trainer clicca "Visualizza dettaglio"):
```
┌─────────── Storico Feedback: Squat ───────────────────┐
│                                                        │
│ 📈 Trend RPE e Carico                                 │
│     [Grafico lineare RPE/Peso ultime 12 settimane]   │
│                                                        │
│ ──────────── Dettaglio per Settimana ──────────────── │
│                                                        │
│ 📅 Week 12 - Scheda "Powerlifting 16W" (2026-03-20)  │
│    Target: 5×5 @ 85% 1RM (RPE 8.5)                   │
│    Actual: 5×5 @ 100kg (RPE 8.5)                     │
│    Serie: [5×100kg, 5×100kg, 5×100kg, 5×100kg, 5×100kg] │
│    Note: "Buona esecuzione, carico gestibile"         │
│    ✅ Completato                                       │
│                                                        │
│ 📅 Week 8 - Scheda "Powerlifting 16W" (2026-02-20)   │
│    Target: 5×5 @ 80% 1RM (RPE 8.0)                   │
│    Actual: 5×5 @ 95kg (RPE 7.8)                      │
│    Serie: [5×95kg, 5×95kg, 5×95kg, 4×95kg, 4×95kg]   │
│    Note: "Ultime 2 serie faticose"                    │
│    ✅ Completato                                       │
│                                                        │
│ 📅 Week 4 - Scheda "Powerlifting 16W" (2026-01-23)   │
│    Target: 5×5 @ 75% 1RM (RPE 7.5)                   │
│    Actual: 5×5 @ 90kg (RPE 7.5)                      │
│    Serie: [5×90kg, 5×90kg, 5×90kg, 5×90kg, 5×90kg]   │
│    Note: "Settimana introduttiva, carico leggero"     │
│    ✅ Completato                                       │
│                                                        │
│ [Esporta CSV] [Confronta con altri trainee]           │
└────────────────────────────────────────────────────────┘
```

### Contesto 2: Durante Compilazione Nuova Scheda

Quando il trainer sta compilando una nuova scheda per un trainee, può accedere rapidamente ai feedback storici per prendere decisioni informate sui carichi/volume.

**Accesso contestuale durante compilazione**:
```
┌─────────── Nuova Scheda per Mario Rossi ──────────────┐
│ Week 1 · Giorno A                                      │
│                                                        │
│ Esercizio 1: Squat                                     │
│ Serie: [5]  Reps: [5]  Peso: [85%] 1RM                │
│ RPE target: [8.0]  Recupero: [3m]                     │
│                                                        │
│ 💡 [Visualizza feedback storici Squat]                │
│    ↓ (quick preview inline)                           │
│    Week 12 Scheda precedente: 5×5 @ 100kg (RPE 8.5)  │
│    Week 8 Scheda precedente: 5×5 @ 95kg (RPE 7.8)    │
│    Raccomandazione: carico iniziale consigliato 90kg  │
│                                                        │
│ [+ Aggiungi Esercizio]                                │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Query feedback ultimo mesociclo per esercizio specifico**:
```sql
-- Recupera feedback più recenti per esercizio specifico (ultimi 3 mesi)
SELECT 
  w.weekNumber,
  w.startDate AS weekStartDate,
  tp.title AS programTitle,
  ef.date AS feedbackDate,
  ef.actualRpe,
  ef.setsPerformed,  -- JSON array
  ef.notes,
  ef.completed,
  we.sets AS targetSets,
  we.reps AS targetReps,
  we.targetRpe,
  we.weight AS targetWeight,
  we.weightType
FROM ExerciseFeedback ef
JOIN WorkoutExercise we ON ef.workoutExerciseId = we.id
JOIN Workout wo ON we.workoutId = wo.id
JOIN Week w ON wo.weekId = w.id
JOIN TrainingProgram tp ON w.programId = tp.id
WHERE ef.traineeId = <traineeId>
  AND we.exerciseId = <exerciseId>
  AND w.feedbackRequested = true
  AND ef.date >= (CURRENT_DATE - INTERVAL '3 months')  -- Ultimi 3 mesi
ORDER BY ef.date DESC
LIMIT 5  -- Ultimi 5 feedback rilevanti
```

### Dashboard Trainer - Sezione Feedback Pending

Aggiunta alla dashboard trainer: notifica trainee che hanno completato settimane con feedback obbligatorio.

**Query feedback obbligatori recenti da revisionare**:
```sql
-- Feedback obbligatori completati nelle ultime 7 giorni (da revisionare)
SELECT 
  u.id AS traineeId,
  u.firstName,
  u.lastName,
  tp.id AS programId,
  tp.title AS programTitle,
  w.weekNumber,
  w.startDate AS weekStartDate,
  COUNT(DISTINCT ef.id) AS feedbackCount,
  MAX(ef.date) AS lastFeedbackDate
FROM User u
JOIN TrainingProgram tp ON tp.traineeId = u.id
JOIN Week w ON w.programId = tp.id
JOIN Workout wo ON wo.weekId = w.id
JOIN WorkoutExercise we ON we.workoutId = wo.id
JOIN ExerciseFeedback ef ON ef.workoutExerciseId = we.id
WHERE tp.trainerId = <trainerId>
  AND w.feedbackRequested = true
  AND ef.date >= (CURRENT_DATE - INTERVAL '7 days')
  AND u.isActive = true
GROUP BY u.id, u.firstName, u.lastName, tp.id, tp.title, w.weekNumber, w.startDate
ORDER BY lastFeedbackDate DESC
```

**UI Dashboard Trainer (aggiunta sezione)**:
```
┌─────────────── Dashboard Trainer ────────────────┐
│                                                   │
│  📊 Trainee Attivi                        15      │
│  ⚠️  Schede in scadenza (< 2 settimane)   5       │
│  🔴 Schede in scadenza (questa settimana)  2      │
│                                                   │
│  📝 Feedback Obbligatori Recenti           3      │
│      [Visualizza e revisiona]                     │
│                                                   │
└───────────────────────────────────────────────────┘

Cliccando su "Visualizza e revisiona":

┌─────────── Feedback Obbligatori da Revisionare ────┐
│ Trainee         Scheda           Week  Data         │
│ Mario Rossi     Powerlifting 16W  W12  2026-03-20  │
│   → 8 esercizi completati                          │
│   [Visualizza dettaglio]                           │
│                                                     │
│ Laura Bianchi   Ipertrofia 8W    W4   2026-03-18  │
│   → 6 esercizi completati                          │
│   [Visualizza dettaglio]                           │
│                                                     │
│ Paolo Verdi     Forza 12W         W6   2026-03-17  │
│   → 7 esercizi completati                          │
│   [Visualizza dettaglio]                           │
└─────────────────────────────────────────────────────┘
```

### Esportazione e Analisi

Il trainer può esportare feedback aggregati per analisi esterne.

**Funzionalità export**:
- **CSV per trainee**: tutti i feedback obbligatori del trainee, raggruppati per esercizio
- **PDF report progressi**: report automatico con grafici trend RPE/carico per esercizi fondamentali (SBD)
- **Confronto trainee**: comparare progressi di più trainee su stesso esercizio (anonimizzato) ❓ **OD-30**

**Note implementative**:
- **Performance**: Query feedback usano indici su `(traineeId, exerciseId, date)` per velocità
- **Privacy**: Solo trainer assegnato può vedere feedback dei propri trainee
- **Retention**: Feedback storici conservati indefinitamente (spazio trascurabile, ~1KB per feedback)
- **Notifiche**: Trainer riceve notifica push quando trainee completa settimana con feedback obbligatorio

## Query critiche
- **Scheda corrente trainee**: `TrainingProgram` con `status=active` e `traineeId=<id>`, espanso fino a `WorkoutExercise`.
- **Avanzamento scheda (trainer)**: `ExerciseFeedback` aggregati per `TrainingProgram` — % esercizi completati per settimana.
- **Libreria esercizi**: tutti gli `Exercise` con relazioni `ExerciseMuscleGroup` e `MovementPattern`, filtrabili per nome (ricerca testuale), gruppo muscolare (via join), tipo (fondamentale/accessorio), schema motorio (via FK).
- **Gruppi muscolari attivi**: `MuscleGroup` con `isActive=true`, ordinati per `name`.
- **Schemi motori attivi**: `MovementPattern` con `isActive=true`, ordinati per `name`.
- **Colori MovementPattern per trainer**: `MovementPatternColor` con `trainerId=<id>`, join `MovementPattern` per nome pattern.
- **Schede draft trainer**: `TrainingProgram` con `status=draft` e `trainerId=<id>`, ordinate per `updatedAt` DESC (ultime modificate prima).
- **Storico trainee**: `TrainingProgram` con `traineeId=<id>`, ordinate per `startDate` DESC.
- **Massimali trainee**: `PersonalRecord` con `traineeId=<id>`, raggrupati per `exerciseId`, ordinati per `recordDate` DESC.
- **Dashboard KPI trainee attivi**: COUNT trainee con `isActive=true` e scheda `status=active` per trainer
- **Dashboard schede in scadenza**: `TrainingProgram` con `status=active`, `trainerId=<id>`, `isActive=true`, dove `endDate` (calcolato) è entro 7 o 14 giorni da oggi
- **Feedback trainee raggruppati per esercizio**: `ExerciseFeedback` JOIN multiple per aggregare feedback per esercizio con storico completo, filtrati per `feedbackRequested=true`
- **Feedback obbligatori recenti da revisionare**: `ExerciseFeedback` con `feedbackRequested=true` completati negli ultimi 7 giorni
- **Feedback ultimo mesociclo per esercizio**: `ExerciseFeedback` per `exerciseId` + `traineeId` negli ultimi 3 mesi, ordinati per data DESC
- **Reportistica SBD** (solo per esercizi fondamentali):
  - **FRQ (Frequenza)**: numero di giorni distinti in cui l'esercizio SBD appare nel periodo
  - **NBL (Numero alzate)**: totale delle serie × ripetizioni per esercizio nel periodo
  - **IM (Intensità media)**: media ponderata delle intensità (%) per esercizio nel periodo
  - **Periodo analisi**: basato su `Week.startDate` + `Workout.dayLabel` per mappare feedback a date calendario reali
- **Serie Allenanti (per gruppo muscolare)**:
  - Serie totali: somma di tutte le serie per workout exercises filtrati per gruppo muscolare (join via `ExerciseMuscleGroup`)
  - Ripetizioni totali: somma di `sets × reps` per workout exercises filtrati per gruppo muscolare

## Note implementative

### Gruppi Muscolari Gestibili
I gruppi muscolari non sono più hardcoded ma gestibili dinamicamente da admin e trainer tramite tabella `MuscleGroup`.

**Esempi gruppi muscolari comuni** (seed iniziale consigliato):
- Pettorali
- Deltoidi anteriori / mediali / posteriori
- Dorsali
- Trapezi
- Bicipiti
- Tricipiti
- Quadricipiti
- Femorali
- Glutei
- Addominali
- Lombari
- Polpacci

**Gestione**:
- Admin/Trainer possono aggiungere nuovi gruppi (es. "Obliqui", "Erettori spinali")
- Campo `isActive=false` per "archiviare" gruppi obsoleti senza eliminarli (preserva integrità referenziale)
- Eliminazione fisica bloccata se esistono `ExerciseMuscleGroup` riferimenti

### Schemi Motori Gestibili
Gli schemi motori non sono più enum ma gestibili dinamicamente tramite tabella `MovementPattern`.

**Esempi schemi motori comuni** (seed iniziale consigliato):
- Squat (Accosciata)
- Horizontal Push (Spinta Orizzontale)
- Vertical Push (Spinta Verticale)
- Hip Extension (Estensione Anca)
- Horizontal Pull (Tirata Orizzontale)
- Vertical Pull (Tirata Verticale)
- Hip Hinge (Cerniera Anca)
- Lunge (Affondo)
- Carry (Trasporto)
- Core Stability (Stabilità Core)
- Rotation (Rotazione)
- Other (Altro)

**Gestione**:
- Admin/Trainer possono aggiungere schemi personalizzati (es. "Turkish Get-Up", "Overhead Carry")
- Campo `isActive=false` per archiviare pattern obsoleti
- Eliminazione fisica bloccata se esistono `Exercise` con quel pattern

### Coefficiente d'Incidenza (ExerciseMuscleGroup)
Ogni esercizio può coinvolgere più gruppi muscolari con diversi livelli di coinvolgimento. La tabella `ExerciseMuscleGroup` associa esercizio e gruppo muscolare con un coefficiente 0.0-1.0:

**Esempio: Panca Piana**
```sql
INSERT INTO ExerciseMuscleGroup (exerciseId, muscleGroupId, coefficient) VALUES
  ('panca-uuid', 'pettorali-uuid', 0.8),      -- Primario
  ('panca-uuid', 'tricipiti-uuid', 0.5),      -- Sinergico
  ('panca-uuid', 'deltoidi-ant-uuid', 0.3);   -- Stabilizzatore
```

**Interpretazione coefficiente**:
- `0.8-1.0`: Muscolo target primario
- `0.5-0.7`: Muscolo sinergico (contributo significativo)
- `0.1-0.4`: Muscolo stabilizzatore (contributo minore)

### Schema Motorio

### Gestione Peso e Intensità
Il campo `weightType` in `WorkoutExercise` determina come interpretare il campo `weight`:
- `absolute`: peso assoluto in kg
- `percentage_1rm`: percentuale del massimale (1RM) - recuperato da `PersonalRecord`
- `percentage_rm`: percentuale di un nRM specifico - recuperato da `PersonalRecord`

Per esercizi fondamentali (SBD), quando si usa una percentuale, il sistema calcola automaticamente i kg effettivi basandosi sul massimale più recente del trainee.

### RPE (Rate of Perceived Exertion)
Il RPE è espresso su scala 5.0-10.0 con incrementi di 0.5:
- 5.0: molto facile
- 6.0-7.0: moderato
- 8.0-9.0: difficile
- 10.0: massimo sforzo

### Tempo di Recupero
Valori predefiniti disponibili nel menu a tendina: `30s`, `1m`, `2m`, `3m`, `5m`.

### Note su WorkoutExercise
Le note sono selezionabili da un menu a tendina con opzioni predefinite (es. "Eseguire lentamente la fase eccentrica", "Focus sulla contrazione", "Esplosivo nella fase concentrica", ecc.).

### Feedback Trainee
Nel campo `setsPerformed` di `ExerciseFeedback`, l'utente registra per ogni serie completata le ripetizioni effettive e il peso utilizzato:
```json
[
  {"reps": 8, "weight": 80.0},
  {"reps": 7, "weight": 80.0},
  {"reps": 6, "weight": 80.0}
]
```

### Seed Data Iniziale
Al primo deploy, sistema deve creare gruppi muscolari e schemi motori di base per permettere creazione esercizi:

```sql
-- Seed MuscleGroup
INSERT INTO MuscleGroup (name, isActive, createdBy) VALUES
  ('Pettorali', true, 'admin-uuid'),
  ('Dorsali', true, 'admin-uuid'),
  ('Deltoidi', true, 'admin-uuid'),
  ('Bicipiti', true, 'admin-uuid'),
  ('Tricipiti', true, 'admin-uuid'),
  ('Quadricipiti', true, 'admin-uuid'),
  ('Femorali', true, 'admin-uuid'),
  ('Glutei', true, 'admin-uuid'),
  ('Core', true, 'admin-uuid');

-- Seed MovementPattern
INSERT INTO MovementPattern (name, description, isActive, createdBy) VALUES
  ('Squat', 'Accosciata', true, 'admin-uuid'),
  ('Horizontal Push', 'Spinta orizzontale', true, 'admin-uuid'),
  ('Hip Extension', 'Estensione anca', true, 'admin-uuid'),
  ('Horizontal Pull', 'Tirata orizzontale', true, 'admin-uuid'),
  ('Vertical Pull', 'Tirata verticale', true, 'admin-uuid'),
  ('Lunge', 'Affondo', true, 'admin-uuid'),
  ('Other', 'Altro', true, 'admin-uuid');
```

### Workflow Creazione Scheda (Trainer)

**Step 1: Setup iniziale**
```typescript
// Trainer crea scheda draft
POST /api/programs
{
  "traineeId": "uuid",
  "title": "Scheda Powerlifting 12 settimane",
  "durationWeeks": 12,
  "workoutsPerWeek": 4,
  "status": "draft",
  "startDate": null  // null finché non pubblica
}
// → Sistema crea TrainingProgram + 12 Week + 48 Workout (12×4) vuoti
```

**Step 2: Vista alto livello - "settimana tipo"**
Trainer visualizza griglia settimana con workout disponibili (es. 4 giorni):
```
┌─────────── Week Template ────────────┐
│ Day 1     Day 2     Day 3     Day 4  │
│ (vuoto)   (vuoto)   (vuoto)   (vuoto)│
└──────────────────────────────────────┘
```

Trainer aggiunge esercizi in vista rapida:
```typescript
// Aggiunge Squat al Day 1
POST /api/workouts/[day1-uuid]/exercises/quick
{
  "exerciseId": "squat-uuid",
  "order": 1
  // Altri campi (sets, reps, etc.) null - da compilare dopo
}
```

UI mostra MovementPattern con colore:
```
┌─────────── Week Template ────────────┐
│ Day 1            Day 2            Day 3            Day 4         │
│ 🟣 Squat         🔵 Bench Press   🟢 Deadlift      🟡 OHP        │
│ 🟣 Front Squat   🔵 Incline DB    🟢 RDL           🟡 Lat Raise  │
│ 🟢 Pull-up       🟢 Barbell Row   🔵 Dips          🟣 Leg Press  │
└──────────────────────────────────────────────────────────────────┘

Legenda colori (personalizzabili da trainer):
🟣 Squat (viola)         🔵 Horizontal Push (blu)
🟢 Pull (verde)          🟡 Vertical Push (giallo)
🔴 Hip Extension (rosso)
```

**Step 3: Dettaglio singolo allenamento**
Trainer clicca su "Day 1" → entra in dettaglio:
```typescript
// Completa dettagli WorkoutExercise
PUT /api/workout-exercises/[we-uuid]
{
  "sets": 5,
  "reps": "5",
  "targetRpe": 8.0,
  "weightType": "percentage_1rm",
  "weight": 80,  // 80% 1RM
  "restTime": "3m",
  "isWarmup": false,
  "notes": "Concentrati sulla tecnica"
}
```

**Step 4: Salvataggio incrementale**
Trainer può salvare parzialmente:
```typescript
// Auto-save ogni 30s o al cambio pagina
PATCH /api/programs/[id]
{
  "updatedAt": "2026-03-27T15:30:00Z"
}  // status rimane "draft"
```

UI mostra progresso:
```
Scheda "Powerlifting 12 settimane" (Draft)
✅ Week 1: 4/4 workout compilati
⚠️  Week 2: 2/4 workout compilati
🔘 Week 3-12: non iniziate

Feedback Obbligatori:
🔴 Week 5 (punto controllo)
🔴 Week 12 (valutazione finale)

[Continua Modifica] [Pubblica]
```

**Step 4.1: Configurazione feedback obbligatori**
Trainer marca settimane con feedback obbligatorio:
```typescript
// Trainer marca Week 5 e Week 12 come feedback obbligatorio
PATCH /api/weeks/[week5-uuid]
{
  "feedbackRequested": true
}

PATCH /api/weeks/[week12-uuid]
{
  "feedbackRequested": true
}
```

UI configurazione feedback:
```
┌──── Configurazione Feedback per Settimana ────┐
│                                                │
│ Seleziona settimane con feedback OBBLIGATORIO:│
│                                                │
│ [ ] Week 1    [ ] Week 5  🔴  [ ] Week 9      │
│ [ ] Week 2    [ ] Week 6      [ ] Week 10     │
│ [ ] Week 3    [ ] Week 7      [ ] Week 11     │
│ [ ] Week 4    [ ] Week 8      [✓] Week 12  🔴 │
│                                                │
│ ℹ️ Settimane marcate richiedono feedback      │
│   completo prima di avanzare                  │
│                                                │
│ [Salva Configurazione]                         │
└────────────────────────────────────────────────┘
```

**Step 5: Pubblicazione**
Trainer decide di pubblicare:
```typescript
// Pubblica scheda
POST /api/programs/[id]/publish
{
  "week1StartDate": "2026-04-01"  // Trainer sceglie data inizio Week 1
}

// Backend:
// 1. Valida scheda completa (tutti workout hanno almeno 1 esercizio con dettagli)
// 2. Aggiorna TrainingProgram:
//    - status = "active"
//    - startDate = "2026-04-01"
//    - publishedAt = NOW()
// 3. Calcola Week.startDate per tutte le settimane:
//    - Week 1: 2026-04-01
//    - Week 2: 2026-04-08 (startDate + 7 giorni)
//    - Week 3: 2026-04-15 (startDate + 14 giorni)
//    - ... fino Week 12
// 4. Return success
```

UI post-pubblicazione:
```
Scheda pubblicata con successo!

Week 1 inizia: Lunedì 1 Aprile 2026
Week 12 termina: Domenica 23 Giugno 2026

[Visualizza Scheda] [Assegna a Trainee]
```

**Note implementative**:
- Draft può essere salvato infinite volte (no limite)
- Pubblicazione irreversibile per quanto riguarda `startDate` (se serve modificare, creare nuova versione scheda)
- Trainee vede solo schede `status=active` assegnate a lui
- Reportistica usa `Week.startDate` + `ExerciseFeedback.date` per correlazione temporale

### Reportistica SBD
La reportistica FRQ/NBL/IM è calcolata solo per esercizi con `type=fundamental` (Squat, Bench Press, Deadlift) su un periodo di X settimane specificato dall'utente.

### Creazione Profilo da trainer
Quando un trainer crea un nuovo profilo trainee:
1. Il sistema genera una password temporanea
2. La password viene salvata in `initialPassword` (opzionalmente)
3. L'utente deve cambiarla al primo login
4. Il campo `isActive` permette di disattivare temporaneamente un profilo senza cancellarlo

## Crescita attesa del dato
- 50 trainee × 1 scheda attiva × 12 settimane × 4 allenamenti × 6 esercizi = ~14.400 `WorkoutExercise` + ~14.400 `ExerciseFeedback` nel primo ciclo.
- Ordini di grandezza molto contenuti; nessuna ottimizzazione di sharding necessaria. ❓ **OD-27**
- **DB engine**: ❓ **OD-24** · **ORM**: ❓ **OD-25** · **Migrazioni**: ❓ **OD-26**
