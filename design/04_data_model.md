# Data Model

## Entità principali

| Entità | Descrizione |
|---|---|
| `User` | Utente del sistema con ruolo (admin / coach / trainee) |
| `CoachTrainee` | Associazione esplicita coach → trainee |
| `Exercise` | Esercizio nella libreria condivisa (con URL YouTube) |
| `TrainingProgram` | Scheda di allenamento multi-settimana assegnata a un trainee |
| `Week` | Singola settimana all'interno di una scheda |
| `Workout` | Singolo allenamento (giorno) all'interno di una settimana |
| `WorkoutExercise` | Esercizio con parametri all'interno di un allenamento |
| `ExerciseFeedback` | Feedback del trainee su un WorkoutExercise |

## Schema (logico)

```
User
  id            UUID  PK
  email         String  UNIQUE
  name          String
  role          Enum(admin, coach, trainee)
  createdAt     DateTime

CoachTrainee
  id            UUID  PK
  coachId       FK → User
  traineeId     FK → User

Exercise
  id            UUID  PK
  name          String
  description   String?
  youtubeUrl    String          -- URL video YouTube dimostrativo
  createdBy     FK → User       -- coach che ha creato l'esercizio
  createdAt     DateTime

TrainingProgram
  id            UUID  PK
  title         String
  coachId       FK → User
  traineeId     FK → User
  startDate     Date
  durationWeeks Int
  status        Enum(draft, active, completed)
  createdAt     DateTime

Week
  id            UUID  PK
  programId     FK → TrainingProgram
  weekNumber    Int

Workout
  id            UUID  PK
  weekId        FK → Week
  dayLabel      String          -- es. "Lunedì", "Giorno A"
  notes         String?

WorkoutExercise
  id            UUID  PK
  workoutId     FK → Workout
  exerciseId    FK → Exercise
  sets          Int
  reps          String          -- es. "8", "8-10", "AMRAP"
  intensity     String?         -- es. "70% 1RM", "moderata"
  rpe           Int?            -- target RPE (1–10)
  notes         String?
  order         Int             -- posizione nell'allenamento

ExerciseFeedback
  id                 UUID  PK
  workoutExerciseId  FK → WorkoutExercise
  traineeId          FK → User
  date               DateTime
  completed          Boolean
  actualRpe          Int?        -- RPE percepito dal trainee (1–10)
  notes              String?     -- commento libero del trainee
```

## Relazioni
- `User(coach)` → N `TrainingProgram` (come coach)
- `User(trainee)` → N `TrainingProgram` (come destinatario)
- `User(coach)` ↔ N `User(trainee)` via `CoachTrainee`
- `TrainingProgram` → N `Week` → N `Workout` → N `WorkoutExercise` → N `ExerciseFeedback`
- `Exercise` → N `WorkoutExercise`
- `User(trainee)` → N `ExerciseFeedback`

## Query critiche
- **Scheda corrente trainee**: `TrainingProgram` con `status=active` e `traineeId=<id>`, espanso fino a `WorkoutExercise`.
- **Avanzamento scheda (coach)**: `ExerciseFeedback` aggregati per `TrainingProgram` — % esercizi completati per settimana.
- **Libreria esercizi**: tutti gli `Exercise`, filtrabili per nome (ricerca testuale).
- **Storico trainee**: `TrainingProgram` con `traineeId=<id>`, ordinate per `startDate` DESC.

## Crescita attesa del dato
- 50 trainee × 1 scheda attiva × 12 settimane × 4 allenamenti × 6 esercizi = ~14.400 `WorkoutExercise` + ~14.400 `ExerciseFeedback` nel primo ciclo.
- Ordini di grandezza molto contenuti; nessuna ottimizzazione di sharding necessaria. ❓ **OD-27**
- **DB engine**: ❓ **OD-24** · **ORM**: ❓ **OD-25** · **Migrazioni**: ❓ **OD-26**
