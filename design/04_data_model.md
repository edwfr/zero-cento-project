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
  feedbackRequested  Boolean          -- settimana marcata come rilevante per feedback
  generalFeedback    String?          -- feedback generale del trainee sulla settimana
  
  -- NOTA: startDate calcolato automaticamente dopo pubblicazione programma
  -- Week 1 startDate = TrainingProgram.startDate (scelto da trainer a pubblicazione)
  -- Week 2 startDate = TrainingProgram.startDate + 7 giorni
  -- Week n startDate = TrainingProgram.startDate + (n-1)*7 giorni

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

[Continua Modifica] [Pubblica]
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
