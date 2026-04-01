# Data Model

> Nota posizionamento (Apr 2026): ZeroCento e una training management platform trainer-led. Il modello dati riflette la collaborazione trainer/trainee e il monitoraggio operativo.

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
| `ExerciseFeedback`     | Feedback del trainee su un WorkoutExercise (RPE, note testuali)                           |
| `SetPerformed`         | Serie eseguita dal trainee con reps e kg (relazione 1:N con ExerciseFeedback)             |
| `PersonalRecord`       | Massimali (1RM o nRM) gestiti per trainee ed esercizio                                    |

---

## Diagramma ER

```mermaid
erDiagram
    %% ============================================================================
    %% USERS & ASSIGNMENTS
    %% ============================================================================
    
    User ||--o{ TrainerTrainee : "trainer (1:N)"
    User ||--o| TrainerTrainee : "trainee (1:1 UNIQUE)"
    
    User ||--o{ MuscleGroup : "creates"
    User ||--o{ MovementPattern : "creates"
    User ||--o{ Exercise : "creates (audit)"
    User ||--o{ MovementPatternColor : "customizes"
    
    User ||--o{ TrainingProgram : "trainer (1:N)"
    User ||--o{ TrainingProgram : "trainee (1:N)"
    
    User ||--o{ ExerciseFeedback : "trainee (1:N)"
    User ||--o{ PersonalRecord : "trainee (1:N)"

    %% ============================================================================
    %% EXERCISE LIBRARY
    %% ============================================================================
    
    MovementPattern ||--o{ Exercise : "has pattern"
    MovementPattern ||--o{ MovementPatternColor : "has colors"
    
    Exercise ||--o{ ExerciseMuscleGroup : "targets (M:N)"
    MuscleGroup ||--o{ ExerciseMuscleGroup : "in exercises (M:N)"
    
    Exercise ||--o{ WorkoutExercise : "used in"
    Exercise ||--o{ PersonalRecord : "has records"

    %% ============================================================================
    %% TRAINING PROGRAMS
    %% ============================================================================
    
    TrainingProgram ||--|{ Week : "contains (1:N)"
    Week ||--|{ Workout : "contains (1:N)"
    Workout ||--|{ WorkoutExercise : "contains (1:N)"

    %% ============================================================================
    %% FEEDBACK & TRACKING
    %% ============================================================================
    
    WorkoutExercise ||--o{ ExerciseFeedback : "receives (1:N)"
    ExerciseFeedback ||--|{ SetPerformed : "has sets (1:N)"

    %% ============================================================================
    %% ENTITÀ DETAILS
    %% ============================================================================

    User {
        uuid id PK
        string email UK
        string firstName
        string lastName
        enum role "admin|trainer|trainee"
        boolean isActive
        datetime createdAt
    }

    TrainerTrainee {
        uuid id PK
        uuid trainerId FK
        uuid traineeId FK_UK "UNIQUE: relazione 1:1"
        datetime createdAt
    }

    MuscleGroup {
        uuid id PK
        string name UK
        string description
        uuid createdBy FK
        boolean isActive
        datetime createdAt
    }

    MovementPattern {
        uuid id PK
        string name UK
        string description
        uuid createdBy FK
        boolean isActive
        datetime createdAt
    }

    MovementPatternColor {
        uuid id PK
        uuid trainerId FK
        uuid movementPatternId FK
        string color "hex #RRGGBB"
    }

    Exercise {
        uuid id PK
        string name
        string description
        string youtubeUrl
        enum type "fundamental|accessory"
        uuid movementPatternId FK
        string-array notes
        uuid createdBy FK "audit only"
        datetime createdAt
    }

    ExerciseMuscleGroup {
        uuid id PK
        uuid exerciseId FK
        uuid muscleGroupId FK
        float coefficient "0.0-1.0"
    }

    TrainingProgram {
        uuid id PK
        string title
        uuid trainerId FK
        uuid traineeId FK
        datetime startDate "null if draft"
        int durationWeeks
        int workoutsPerWeek
        enum status "draft|active|completed"
        datetime publishedAt
        datetime completedAt "quando passa a completed"
        string completionReason "motivo se complete manuale"
        datetime createdAt
        datetime updatedAt
    }

    Week {
        uuid id PK
        uuid programId FK
        int weekNumber
        datetime startDate
        enum weekType "normal|test|deload"
        boolean feedbackRequested
        string generalFeedback
    }

    Workout {
        uuid id PK
        uuid weekId FK
        string dayLabel
        string notes
    }

    WorkoutExercise {
        uuid id PK
        uuid workoutId FK
        uuid exerciseId FK
        int sets
        string reps "es 8 or 8-10"
        float targetRpe "5.0-10.0"
        enum weightType "absolute|percentage_1rm|percentage_rm|percentage_previous"
        float weight
        enum restTime "s30|m1|m2|m3|m5"
        boolean isWarmup
        string notes
        int order
    }

    ExerciseFeedback {
        uuid id PK
        uuid workoutExerciseId FK
        uuid traineeId FK
        datetime date
        boolean completed
        float actualRpe "5.0-10.0"
        string notes
        datetime createdAt
        datetime updatedAt
    }

    SetPerformed {
        uuid id PK
        uuid feedbackId FK
        int setNumber "1 2 3"
        int reps
        float weight "kg"
        datetime createdAt
    }

    PersonalRecord {
        uuid id PK
        uuid traineeId FK
        uuid exerciseId FK
        int reps "1 for 1RM"
        float weight "kg"
        datetime recordDate
        string notes
        datetime createdAt
    }
```

**Note diagramma**:
- **Relazione 1:1**: TrainerTrainee.traineeId è UNIQUE (un trainee ha un solo trainer)
- **Relazioni many-to-many**: ExerciseMuscleGroup è tabella junction tra Exercise e MuscleGroup
- **Gerarchia schede**: TrainingProgram → Week → Workout → WorkoutExercise (cascade delete)
- **Feedback tracking**: WorkoutExercise → ExerciseFeedback → SetPerformed (normalizzato per type-safety)
- **Libreria condivisa**: Exercise accessibile a tutti i trainer (createdBy solo audit trail)
- **Personalizzazione**: MovementPatternColor permette colori custom per trainer

---

## Schema (logico)

```
User
  id            UUID  PK
  email         String  UNIQUE
  firstName     String
  lastName      String
  role          Enum(admin, trainer, trainee)
  isActive      Boolean         -- profilo attivo o disattivato
  createdAt     DateTime

TrainerTrainee
  id            UUID  PK
  trainerId       FK → User
  traineeId     FK → User  UNIQUE  -- Un trainee può avere UN SOLO trainer (relazione 1:1)
  createdAt     DateTime
  
  -- NOTA: Relazione 1:1 trainer-trainee
  -- UNIQUE constraint su traineeId garantisce che ogni trainee abbia esattamente un trainer
  -- Se necessario cambio trainer: eliminare vecchio record TrainerTrainee e crearne uno nuovo

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

  -- NOTA: Workflow creazione e ciclo vita scheda
  -- 1. status=draft: trainer può salvare parzialmente, modificare n volte (PUT permesso)
  -- 2. Pubblicazione: trainer decide quando → status=active, startDate popolato (Week 1 mapping calendario)
  -- 3. IMPORTANTE: Dopo pubblicazione, scheda diventa IMMUTABILE
  --    - PUT/DELETE su scheda active/completed → 403 Forbidden
  --    - Se trainer vuole modifiche, deve creare nuova scheda da zero
  -- 4. startDate usato per calcolare date settimane successive e reportistica
  -- 5. Transizione active → completed: DUE modalità
  --    a) AUTOMATICA: Job schedulato (cron daily) verifica endDate (startDate + durationWeeks * 7) e aggiorna status=completed
  --       - completedAt = NOW(), completionReason = null (completamento naturale)
  --    b) MANUALE: Trainer chiama PATCH /api/programs/[id]/complete
  --       - completedAt = NOW(), completionReason = motivazione fornita dal trainer
  --       - Use case: trainee termina anticipatamente, cambio programmazione, infortunio
  --    - La scheda passa a 'completed' automaticamente al termine dell'ultima settimana OPPURE quando trainer la marca
  --    - Una volta 'completed', il trainee NON può più fornire feedback (UI sola lettura)
  --    - Se ci sono feedback pendenti all'ultima settimana, la scheda passa comunque a 'completed'
  --    - Job schedulato o check API verifica endDate e aggiorna status automaticamente

Week
  id                 UUID  PK
  programId          FK → TrainingProgram
  weekNumber         Int              -- 1, 2, 3, ..., n
  startDate          Date?            -- Data inizio settimana (calcolata: program.startDate + (weekNumber-1)*7 giorni)
  weekType           Enum(normal, test, deload)  -- Tipologia settimana: normale, test, scarico (default: normal)
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
  
  -- NOTA: weekType
  -- Tipologia settimana che influenza UI trainee:
  -- - normal (default): UI standard, nessun badge particolare
  -- - test: Settimana di valutazione/test massimali
  --         UI trainee: Banner rosso/arancione prominente "🔥 SETTIMANA DI TEST"
  --         Badge su workout: "⚡ Test" con colori vivaci (#ef4444, #f97316)
  --         Alert pre-allenamento: "Questa è una settimana di valutazione. Massima concentrazione!"
  -- - deload: Settimana di scarico/recupero
  --         UI trainee: Banner verde/blu rilassante "🌿 SETTIMANA DI SCARICO"
  --         Badge su workout: "💤 Scarico" con colori soft (#10b981, #6ee7b7)
  --         Alert pre-allenamento: "Settimana di recupero. Focus su tecnica e mobilità."
  -- Trainer configura weekType durante compilazione scheda (insieme a feedbackRequested)

Workout
  id            UUID  PK
  weekId        FK → Week
  dayLabel      String          -- es.  "Giorno 1", "Giorno 2", "Giorno 3"
  notes         String?

WorkoutExercise
  id                UUID  PK
  workoutId         FK → Workout
  exerciseId        FK → Exercise
  sets              Int
  reps              String          -- es. "8", "8-10", "6/8" (intervallo)
  targetRpe         Float?          -- target RPE (5.0–10.0 con incrementi di 0.5)
  weightType        Enum(absolute, percentage_1rm, percentage_rm, percentage_previous)  -- tipo di peso
  weight            Float?          -- kg assoluti, percentuale 1RM/nRM, o percentuale relativa alla riga precedente
  restTime          Enum(30s, 1m, 2m, 3m, 5m)  -- tempo di recupero
  isWarmup          Boolean         -- flag riscaldamento
  notes             String?         -- note con menu a tendina (predefinite)
  order             Int             -- posizione nell'allenamento
  
  -- NOTA: weightType = percentage_previous
  -- Permette di referenziare il carico della PRIMA occorrenza dello stesso esercizio nel workout
  -- Esempio: Workout "Giorno A" ha 2 occorrenze di "Squat"
  --   Riga 1 (order=1): Squat, 1 serie x 2 rip @ RPE 8, weightType=absolute, weight=100kg
  --   Riga 2 (order=2): Squat, 3 serie x 4 rip, weightType=percentage_previous, weight=-5 (= -5% rispetto riga 1)
  -- Calcolo: Riga 2 usa 100kg - 5% = 95kg
  -- Il campo weight contiene la percentuale da applicare (es. -5 = -5%, +10 = +10%, 0 = stesso carico)
  -- Sistema cerca la PRIMA occorrenza (order < current) dello STESSO exerciseId nel MEDESIMO workoutId
  -- Se non trova occorrenza precedente → errore validazione (impossibile calcolare peso relativo)

ExerciseFeedback
  id                 UUID  PK
  workoutExerciseId  FK → WorkoutExercise
  traineeId          FK → User
  date               DateTime
  completed          Boolean
  actualRpe          Float?      -- RPE percepito dal trainee (5.0–10.0 con incrementi di 0.5)
  notes              String?     -- commento libero testuale del trainee sull'esercizio
  createdAt          DateTime
  updatedAt          DateTime

  -- NOTA: Serie eseguite normalizzate in tabella SetPerformed (relazione 1:N)
  -- Benefici: type-safety, query aggregate efficienti, indicizzazione

SetPerformed
  id                 UUID  PK
  feedbackId         FK → ExerciseFeedback
  setNumber          Int         -- numero progressivo serie (1, 2, 3, ..., n)
  reps               Int         -- ripetizioni eseguite nella serie
  weight             Float       -- peso usato in kg
  createdAt          DateTime
  
  UNIQUE(feedbackId, setNumber)  -- Constraint: un feedback non può avere set duplicati con stesso numero
  
  -- NOTA: Normalizzazione per evitare campo JSON
  -- Permette query aggregate tipo: MAX(weight), AVG(reps), COUNT(*) per esercizio
  -- Volumetria stimata: ~50K righe (54 trainee × 12 settimane × 4 workout × 6 esercizi × 3.5 set medi)
  -- Indicizzabile e type-safe, nessun parsing JSON runtime

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
- `User(trainer)` → N `User(trainee)` via `TrainerTrainee` (relazione 1:1 - un trainee ha UN SOLO trainer)
  - UNIQUE constraint su `TrainerTrainee.traineeId` garantisce l'unicità
  - Se necessario cambio trainer: eliminare vecchio record e crearne uno nuovo
- `User(trainer)` → N `MovementPatternColor` (personalizzazione colori per vista alto livello)
- `MovementPattern` → N `MovementPatternColor` (colori custom per trainer)
- `MuscleGroup` ↔ N `Exercise` via `ExerciseMuscleGroup` (many-to-many con coefficient)
- `MovementPattern` → N `Exercise` (one-to-many)
- `Exercise` ↔ N `MuscleGroup` via `ExerciseMuscleGroup` (many-to-many con coefficient)
- `TrainingProgram` → N `Week` → N `Workout` → N `WorkoutExercise` → N `ExerciseFeedback` → N `SetPerformed`
- `Exercise` → N `WorkoutExercise`
- `User(trainee)` → N `ExerciseFeedback`
- `ExerciseFeedback` → N `SetPerformed` (serie eseguite normalizzate)
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
┌─────────── Configurazione Settimane ───────────────────────────────┐
│ Week  Tipo           Feedback      Note                            │
│  1    [Normale ▼]    [ ]           Standard                        │
│  2    [Normale ▼]    [ ]           Standard                        │
│  3    [Normale ▼]    [ ]           Standard                        │
│  4    [Test ▼] 🔥    [✓] ⚠️         Valutazione mesociclo          │
│  5    [Normale ▼]    [ ]           Standard                        │
│  6    [Scarico ▼] 💤 [ ]           Recupero attivo                 │
│  7    [Normale ▼]    [ ]           Standard                        │
│  8    [Test ▼] 🔥    [✓] ⚠️         Test massimali                 │
│ ...                                                                 │
│  12   [Normale ▼]    [✓] ⚠️         Valutazione finale             │
└─────────────────────────────────────────────────────────────────────┘

Tipo settimana:
- Normale: settimana standard di allenamento
- Test 🔥: settimana di valutazione/test (UI trainee con colori vivaci)
- Scarico 💤: settimana di deload/recupero (UI trainee con colori rilassanti)
```

**Workflow Trainee (compilazione feedback e UI settimana)**:

**UI in base a weekType**:

`Week.weekType = "normal"`:
- UI standard senza badge particolari
- Colori tema predefinito
- Header settimana: "Week [N] · [Data Inizio] - [Data Fine]"

`Week.weekType = "test"`:
- Banner prominente header settimana:
  ```
  ┌──────────────────────────────────────────────────┐
  │ 🔥 SETTIMANA DI TEST                             │
  │ Week 4 · 22-28 Aprile 2026                      │
  │ ⚡ Questa è una settimana di valutazione         │
  │    Massima concentrazione e focus!               │
  └──────────────────────────────────────────────────┘
  ```
- Badge su ogni workout: "⚡ Test" con background rosso/arancione (#ef4444, #f97316)
- Alert pre-allenamento: "⚠️ Allenamento di test. Preparati mentalmente!"
- Colori UI: rosso, arancione, giallo vivaci per richiamare attenzione

`Week.weekType = "deload"`:
- Banner rilassante header settimana:
  ```
  ┌──────────────────────────────────────────────────┐
  │ 🌿 SETTIMANA DI SCARICO                          │
  │ Week 6 · 6-12 Maggio 2026                       │
  │ 💤 Settimana di recupero attivo                  │
  │    Focus su tecnica, mobilità e rigenerazione    │
  └──────────────────────────────────────────────────┘
  ```
- Badge su ogni workout: "💤 Scarico" con background verde/azzurro soft (#10b981, #6ee7b7)
- Alert pre-allenamento: "✨ Allenamento di scarico. Ascolta il tuo corpo."
- Colori UI: verde acqua, azzurro, toni pastello per effetto rilassante

**Gestione feedback obbligatori**:

Se `Week.feedbackRequested = true`:
- UI mostra badge aggiuntivo "🔴 Feedback Obbligatorio" (indipendente da weekType)
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
  ef.notes,
  ef.completed,
  we.sets AS targetSets,
  we.reps AS targetReps,
  we.targetRpe,
  -- Aggregazione serie eseguite da tabella SetPerformed
  JSON_AGG(
    JSON_BUILD_OBJECT(
      'setNumber', sp.setNumber,
      'reps', sp.reps,
      'weight', sp.weight
    ) ORDER BY sp.setNumber ASC
  ) AS setsPerformed
FROM ExerciseFeedback ef
JOIN WorkoutExercise we ON ef.workoutExerciseId = we.id
JOIN Workout wo ON we.workoutId = wo.id
JOIN Week w ON wo.weekId = w.id
LEFT JOIN SetPerformed sp ON sp.feedbackId = ef.id  -- JOIN con tabella normalizzata
WHERE we.exerciseId = <exerciseId>           -- Stesso esercizio (es. Squat)
  AND wo.dayLabel = <currentDayLabel>         -- Stesso giorno (es. "Giorno A")
  AND w.programId = <currentProgramId>        -- Stessa scheda
  AND w.weekNumber < <currentWeekNumber>      -- Solo settimane PRECEDENTI
  AND ef.traineeId = <traineeId>
GROUP BY ef.id, w.weekNumber, w.startDate, ef.date, ef.actualRpe, ef.notes, ef.completed, we.sets, we.reps, we.targetRpe
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

**Tipologia settimana (weekType)**:
- Settimana normale: UI standard, header neutro, colori tema predefinito
- Settimana test: 
  - Banner rosso/arancione (#ef4444, #f97316) con icona 🔥⚡
  - Alert pre-workout: "⚠️ Allenamento di test. Massima concentrazione!"
  - Badge su workout card: "⚡ Test" con background vivace
  - Colori UI: rosso, arancione, giallo per richiamare attenzione
- Settimana scarico:
  - Banner verde/azzurro soft (#10b981, #6ee7b7) con icona 🌿💤
  - Alert pre-workout: "✨ Allenamento di scarico. Ascolta il tuo corpo."
  - Badge su workout card: "💤 Scarico" con background rilassante
  - Colori UI: verde acqua, azzurro pastello per effetto calming

**Feedback obbligatorio**:
- Badge visibile: 🔴 "Feedback Obbligatorio" in header settimana (indipendente da weekType)
- Progress bar: "3/8 esercizi completati" (dinamico)
- Alert: "Completa tutti i feedback per avanzare a Week 6"
- Notifica trainer: quando trainee completa settimana con feedback obbligatorio
- Combinazione con weekType: badge obbligatorio si aggiunge a banner test/scarico (non sovrascrive)

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
  -- Aggregazione feedback con serie dalla tabella SetPerformed
  JSON_AGG(
    JSON_BUILD_OBJECT(
      'feedbackId', ef.id,
      'weekNumber', w.weekNumber,
      'weekStartDate', w.startDate,
      'feedbackDate', ef.date,
      'actualRpe', ef.actualRpe,
      'notes', ef.notes,
      'completed', ef.completed,
      'targetSets', we.sets,
      'targetReps', we.reps,
      'targetRpe', we.targetRpe,
      'sets', (
        -- Subquery per aggregare serie da SetPerformed
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT('setNumber', sp.setNumber, 'reps', sp.reps, 'weight', sp.weight)
          ORDER BY sp.setNumber
        )
        FROM SetPerformed sp
        WHERE sp.feedbackId = ef.id
      )
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
  ef.notes,
  ef.completed,
  we.sets AS targetSets,
  we.reps AS targetReps,
  we.targetRpe,
  we.weight AS targetWeight,
  we.weightType,
  -- Aggregazione serie eseguite da SetPerformed
  JSON_AGG(
    JSON_BUILD_OBJECT(
      'setNumber', sp.setNumber,
      'reps', sp.reps,
      'weight', sp.weight
    ) ORDER BY sp.setNumber ASC
  ) AS setsPerformed
FROM ExerciseFeedback ef
JOIN WorkoutExercise we ON ef.workoutExerciseId = we.id
JOIN Workout wo ON we.workoutId = wo.id
JOIN Week w ON wo.weekId = w.id
JOIN TrainingProgram tp ON w.programId = tp.id
LEFT JOIN SetPerformed sp ON sp.feedbackId = ef.id  -- JOIN normalizzato
WHERE ef.traineeId = <traineeId>
  AND we.exerciseId = <exerciseId>
  AND w.feedbackRequested = true
  AND ef.date >= (CURRENT_DATE - INTERVAL '3 months')  -- Ultimi 3 mesi
GROUP BY ef.id, w.weekNumber, w.startDate, tp.title, ef.date, ef.actualRpe, ef.notes, ef.completed, we.sets, we.reps, we.targetRpe, we.weight, we.weightType
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
- `percentage_previous`: percentuale relativa alla prima occorrenza dello stesso esercizio nel workout

**Dettaglio percentage_previous**:
Quando un trainer inserisce lo stesso esercizio più volte nello stesso workout, può fare riferimento al carico della prima occorrenza (anziché al massimale).

**Esempio concreto**:
```
Workout "Giorno A - Squat Focus":
  Riga 1 (order=1): Squat, 1 serie x 2 rip @ RPE 8.0
                    weightType: absolute
                    weight: 100.0 (kg)
  
  Riga 2 (order=2): Squat, 3 serie x 4 rip @ RPE 7.5
                    weightType: percentage_previous
                    weight: -5.0 (= -5% rispetto alla riga 1)
                    Carico calcolato: 100kg - 5% = 95kg
```

**Logica di calcolo**:
1. Sistema identifica la PRIMA occorrenza dello stesso `exerciseId` nel medesimo `workoutId` con `order < current`
2. Se la prima occorrenza usa `percentage_1rm` o `percentage_rm`, il sistema risolve prima quel carico in kg assoluti
3. Applica la percentuale: `carico_base * (1 + weight/100)`
   - `weight = -5` → carico_base × 0.95 (riduzione 5%)
   - `weight = +10` → carico_base × 1.10 (aumento 10%)
   - `weight = 0` → carico_base × 1.00 (identico)
4. Se non esiste occorrenza precedente → **errore di validazione** (impossibile calcolare peso relativo)

**Casi d'uso**:
- Wave loading: 1×2@RPE9 → 3×4@-5% → 5×6@-10% (progressivo decremento)
- Cluster set: 3×3@RPE8 → 3×3@0% (stesso carico) → 3×3@-10% (drop set finale)
- Back-off set: 1×1@100% 1RM → 5×5@-20% (primo set massimale, poi volume)

Per esercizi fondamentali (SBD), quando si usa una percentuale del massimale, il sistema calcola automaticamente i kg effettivi basandosi sul massimale più recente del trainee in `PersonalRecord`.

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

Il trainee registra feedback per ogni esercizio completato. I dati sono normalizzati in due tabelle:

**ExerciseFeedback**: Contiene metadati generali del feedback
- `actualRpe`: RPE percepito (5.0-10.0 con incrementi 0.5)
- `notes`: Commento testuale libero del trainee (es. "Difficoltà alla terza serie", "Ottima sensazione")
- `completed`: Flag completamento esercizio

**SetPerformed**: Contiene dettaglio di ogni singola serie (relazione 1:N con ExerciseFeedback)
```sql
-- Esempio: trainee ha eseguito 3 serie di Squat
INSERT INTO SetPerformed (feedbackId, setNumber, reps, weight) VALUES
  ('feedback-uuid-123', 1, 8, 80.0),  -- Serie 1: 8 rip @ 80kg
  ('feedback-uuid-123', 2, 7, 80.0),  -- Serie 2: 7 rip @ 80kg
  ('feedback-uuid-123', 3, 6, 80.0);  -- Serie 3: 6 rip @ 80kg
```

**Benefici normalizzazione**:
- Type-safety: validazione DB-level (Int per reps, Float per weight)
- Query aggregate: `SELECT MAX(weight) FROM SetPerformed WHERE ...`
- Constraint UNIQUE: impossibile duplicare numero serie
- Indicizzazione: performance ottimale su query peso/volume

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

**Step 4.1: Configurazione tipologia e feedback settimane**
Trainer configura tipo settimana e feedback obbligatorio:
```typescript
// Trainer configura Week 4 come settimana di TEST con feedback obbligatorio
PATCH /api/weeks/[week4-uuid]
{
  "weekType": "test",
  "feedbackRequested": true
}

// Trainer configura Week 6 come settimana di SCARICO (no feedback obbligatorio)
PATCH /api/weeks/[week6-uuid]
{
  "weekType": "deload",
  "feedbackRequested": false
}

// Trainer configura Week 12 come settimana NORMALE con feedback obbligatorio
PATCH /api/weeks/[week12-uuid]
{
  "weekType": "normal",
  "feedbackRequested": true
}
```

UI configurazione settimane (tabella completa):
```
┌──── Configurazione Settimane ─────────────────────────────────────┐
│                                                                    │
│ Week  Tipo Settimana    Feedback Obbl.  Descrizione               │
│ ──────────────────────────────────────────────────────────────── │
│  1    [Normale ▼]       [ ]             Introduzione              │
│  2    [Normale ▼]       [ ]             Progressione volume       │
│  3    [Normale ▼]       [ ]             Peak volume               │
│  4    [Test ▼] 🔥       [✓] 🔴          Valutazione mesociclo     │
│  5    [Normale ▼]       [ ]             Nuovo blocco              │
│  6    [Scarico ▼] 💤    [ ]             Recupero attivo           │
│  7    [Normale ▼]       [ ]             Ripresa intensità         │
│  8    [Test ▼] 🔥       [✓] 🔴          Test massimali            │
│  9    [Normale ▼]       [ ]             Consolidamento            │
│  10   [Normale ▼]       [ ]             Peak intensità            │
│  11   [Scarico ▼] 💤    [ ]             Taper                     │
│  12   [Normale ▼]       [✓] 🔴          Valutazione finale        │
│                                                                    │
│ Legenda:                                                           │
│ • Normale: settimana standard di allenamento                      │
│ • Test 🔥: valutazione/test (UI trainee con colori vivaci)       │
│ • Scarico 💤: deload/recupero (UI trainee con colori rilassanti)  │
│ • Feedback 🔴: obbligatorio completare tutti gli esercizi         │
│                                                                    │
│ [Salva Configurazione]                               [Annulla]    │
└────────────────────────────────────────────────────────────────────┘
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

Summary configurazione:
- Settimane normali: 9
- Settimane di test: 2 (Week 4, Week 8)
- Settimane di scarico: 2 (Week 6, Week 11)
- Feedback obbligatori: 3 (Week 4, Week 8, Week 12)

[Visualizza Scheda] [Assegna a Trainee]
```

**Note implementative**:
- Draft può essere salvato infinite volte (no limite)
- Pubblicazione irreversibile: scheda diventa **IMMUTABILE** dopo pubblicazione (no modifiche, no eliminazione)
- Se trainer vuole modifiche a scheda pubblicata, deve creare nuova scheda da zero
- Trainee vede solo schede `status=active` assegnate a lui
- Reportistica usa `Week.startDate` + `ExerciseFeedback.date` per correlazione temporale
- **Transizione active → completed**: DUE modalità:
  1. **AUTOMATICA**: Job schedulato (es. cron daily) verifica `endDate = startDate + (durationWeeks * 7)` e aggiorna `status=completed` automaticamente. Setta `completedAt=NOW()`, `completionReason=null`
  2. **MANUALE**: Trainer chiama `PATCH /api/programs/[id]/complete` con motivazione opzionale. Setta `completedAt=NOW()`, `completionReason=motivo fornito`
  - Use case manuale: trainee termina anticipatamente, cambio programmazione, infortunio

### Reportistica SBD
La reportistica FRQ/NBL/IM è calcolata solo per esercizi con `type=fundamental` (Squat, Bench Press, Deadlift) su un periodo di X settimane specificato dall'utente.

### Creazione Profilo da trainer
Quando un trainer crea un nuovo profilo trainee:
1. Il sistema genera una password temporanea sicura
2. La password viene mostrata UNA SOLA VOLTA al trainer (non salvata nel DB)
3. L'utente deve cambiarla al primo login (flag `mustChangePassword` gestito da Supabase)
4. Il campo `isActive` permette di disattivare temporaneamente un profilo senza cancellarlo

**Nota di sicurezza**: La password temporanea NON viene salvata nel database per evitare vulnerabilità in caso di compromissione della chiave di encryption. Se necessario rigenerare la password, il trainer può farlo creando una nuova password temporanea.

## Crescita attesa del dato
- 50 trainee × 1 scheda attiva × 12 settimane × 4 allenamenti × 6 esercizi = ~14.400 `WorkoutExercise` + ~14.400 `ExerciseFeedback` nel primo ciclo.
- Ordini di grandezza molto contenuti; nessuna ottimizzazione di sharding necessaria. ❓ **OD-27**
- **DB engine**: ❓ **OD-24** · **ORM**: ❓ **OD-25** · **Migrazioni**: ❓ **OD-26**
