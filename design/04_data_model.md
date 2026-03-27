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

| Entità             | Descrizione                                                                     |
| ------------------ | ------------------------------------------------------------------------------- |
| `User`             | Utente del sistema con ruolo (admin / trainer / trainee)                        |
| `TrainerTrainee`   | Associazione esplicita trainer → trainee                                        |
| `Exercise`         | Esercizio nella libreria condivisa (con gruppo muscolare, tipo, schema motorio) |
| `TrainingProgram`  | Scheda di allenamento multi-settimana assegnata a un trainee                    |
| `Week`             | Singola settimana all'interno di una scheda                                     |
| `Workout`          | Singolo allenamento (giorno) all'interno di una settimana                       |
| `WorkoutExercise`  | Esercizio con parametri all'interno di un allenamento                           |
| `ExerciseFeedback` | Feedback del trainee su un WorkoutExercise (serie, kg, RPE)                     |
| `PersonalRecord`   | Massimali (1RM o nRM) gestiti per trainee ed esercizio                          |

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

Exercise
  id                  UUID  PK
  name                String
  description         String?
  youtubeUrl          String          -- URL video YouTube dimostrativo
  muscleGroups        Json            -- Array di {name: String, coefficient: Float} - gruppo muscolare e coefficiente d'incidenza
  type                Enum(fundamental, accessory)  -- Fondamentale (SBD) o Accessorio
  movementPattern     Enum(squat, horizontal_push, hip_extension, horizontal_pull, vertical_pull, other)  -- Schema motorio
  notes               String[]        -- Lista di note/varianti
  createdBy           FK → User       -- trainer/admin che ha creato l'esercizio (solo audit trail, NON determina ownership)
  createdAt           DateTime

  -- NOTA: Libreria CONDIVISA tra tutti i trainer
  -- Ogni trainer può CRUD su QUALSIASI esercizio (non solo i propri)
  -- Campo createdBy serve solo per tracciabilità/audit, non per permission

TrainingProgram
  id                 UUID  PK
  title              String
  trainerId            FK → User
  traineeId          FK → User
  startDate          Date
  durationWeeks      Int
  workoutsPerWeek    Int             -- n allenamenti per settimana
  status             Enum(draft, active, completed)
  createdAt          DateTime

Week
  id                 UUID  PK
  programId          FK → TrainingProgram
  weekNumber         Int
  feedbackRequested  Boolean         -- settimana marcata come rilevante per feedback
  generalFeedback    String?         -- feedback generale del trainee sulla settimana

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
  reps              String          -- es. "8", "8-10", "6/8" (intervallo), "AMRAP"
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
- `TrainingProgram` → N `Week` → N `Workout` → N `WorkoutExercise` → N `ExerciseFeedback`
- `Exercise` → N `WorkoutExercise`
- `User(trainee)` → N `ExerciseFeedback`
- `User(trainee)` → N `PersonalRecord` (massimali per trainee)
- `Exercise` → N `PersonalRecord` (massimali per esercizio)

## Query critiche
- **Scheda corrente trainee**: `TrainingProgram` con `status=active` e `traineeId=<id>`, espanso fino a `WorkoutExercise`.
- **Avanzamento scheda (trainer)**: `ExerciseFeedback` aggregati per `TrainingProgram` — % esercizi completati per settimana.
- **Libreria esercizi**: tutti gli `Exercise`, filtrabili per nome (ricerca testuale), gruppo muscolare, tipo (fondamentale/accessorio), schema motorio.
- **Storico trainee**: `TrainingProgram` con `traineeId=<id>`, ordinate per `startDate` DESC.
- **Massimali trainee**: `PersonalRecord` con `traineeId=<id>`, raggrupati per `exerciseId`, ordinati per `recordDate` DESC.
- **Reportistica SBD** (solo per esercizi fondamentali):
  - **FRQ (Frequenza)**: numero di giorni distinti in cui l'esercizio SBD appare nel periodo
  - **NBL (Numero alzate)**: totale delle serie × ripetizioni per esercizio nel periodo
  - **IM (Intensità media)**: media ponderata delle intensità (%) per esercizio nel periodo
- **Serie Allenanti (per gruppo muscolare)**:
  - Serie totali: somma di tutte le serie per workout exercises filtrati per gruppo muscolare
  - Ripetizioni totali: somma di `sets × reps` per workout exercises filtrati per gruppo muscolare

## Note implementative

### Gruppo Muscolare e Coefficiente d'Incidenza
Ogni esercizio può coinvolgere più gruppi muscolari con diversi livelli di coinvolgimento. Il campo `muscleGroups` in `Exercise` è un array JSON che contiene elementi nel formato:
```json
[
  {"name": "Pettorali", "coefficient": 0.8},
  {"name": "Tricipiti", "coefficient": 0.5},
  {"name": "Deltoidi anteriori", "coefficient": 0.3}
]
```

### Schema Motorio
Gli esercizi sono categorizzati per schema motorio principale:
- `squat`: accosciata (squat, goblet squat, front squat, ecc.)
- `horizontal_push`: spinta orizzontale (panca, push-up, ecc.)
- `hip_extension`: estensione anca (stacco, hip thrust, ecc.)
- `horizontal_pull`: tirata orizzontale (rematore, inverted row, ecc.)
- `vertical_pull`: tirata verticale (trazioni, lat machine, ecc.)
- `other`: altri movimenti non categorizzabili

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
