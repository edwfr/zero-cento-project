# Database Indexes - Performance Optimization

**Documento**: Performance indexes e rationale  
**Versione**: 1.0  
**Data**: 2026-03-28  

---

## Panoramica

Gli indici sono stati progettati per ottimizzare le query più frequenti nella piattaforma:
1. **Dashboard Trainer** — KPI e lista schede in scadenza
2. **Lista esercizi** — Ricerca e filtraggio per tipo/pattern/muscolo
3. **Feedback trainee** — Storico per esercizio e visualizzazione progressi
4. **Lookup relazionali** — Ottimizzazione JOIN su FK

---

## Indici Implementati

### 1. User (users)

```prisma
@@index([email])
@@index([role, isActive])
```

**Rationale**:
- `[email]`: Lookup rapido per login (WHERE email = ?) — usato in ogni autenticazione
- `[role, isActive]`: Filtraggio utenti per ruolo e stato attivo (es. lista trainer attivi, trainee attivi per admin)

**Query ottimizzate**:
```sql
-- Login
SELECT * FROM users WHERE email = 'trainer@example.com';

-- Lista trainer attivi
SELECT * FROM users WHERE role = 'trainer' AND isActive = true;
```

---

### 2. TrainerTrainee (trainer_trainee)

```prisma
@@index([trainerId])
```

**Rationale**:
- `[trainerId]`: Query rapida per ottenere tutti i trainee assegnati a un trainer (dashboard, liste)
- `traineeId` è già UNIQUE (constraint primario per relazione 1:1), non serve indice aggiuntivo

**Query ottimizzate**:
```sql
-- Trainee assegnati a trainer
SELECT traineeId FROM trainer_trainee WHERE trainerId = '<trainer-uuid>';
```

---

### 3. MuscleGroup (muscle_groups)

```prisma
@@index([isActive])
```

**Rationale**:
- `[isActive]`: Filtraggio rapido per gruppi muscolari attivi (non archiviati) — usato in dropdown creazione esercizi

**Query ottimizzate**:
```sql
-- Dropdown gruppi muscolari attivi
SELECT * FROM muscle_groups WHERE isActive = true ORDER BY name;
```

---

### 4. MovementPattern (movement_patterns)

```prisma
@@index([isActive])
```

**Rationale**:
- `[isActive]`: Filtraggio schemi motori attivi per dropdown creazione esercizi

**Query ottimizzate**:
```sql
-- Dropdown schemi motori attivi
SELECT * FROM movement_patterns WHERE isActive = true ORDER BY name;
```

---

### 5. MovementPatternColor (movement_pattern_colors)

```prisma
@@index([trainerId])
```

**Rationale**:
- `[trainerId]`: Query rapida per ottenere tutte le personalizzazioni colori di un trainer (vista alto livello schede)

**Query ottimizzate**:
```sql
-- Colori pattern personalizzati per trainer
SELECT * FROM movement_pattern_colors WHERE trainerId = '<trainer-uuid>';
```

---

### 6. Exercise (exercises)

```prisma
@@index([type])
@@index([movementPatternId])
@@index([name])
```

**Rationale**:
- `[type]`: Filtro rapido per tipo esercizio (fundamental/accessory) — usato in lista esercizi e reporting SBD
- `[movementPatternId]`: JOIN ottimizzato MovementPattern ↔ Exercise per categorizzazione
- `[name]`: Ricerca testuale esercizi (es. autocomplete "squat", "bench", "deadlift")

**Query ottimizzate**:
```sql
-- Lista esercizi fondamentali (SBD)
SELECT * FROM exercises WHERE type = 'fundamental' ORDER BY name;

-- Esercizi per schema motorio (es. tutti i "Squat")
SELECT * FROM exercises WHERE movementPatternId = '<squat-pattern-uuid>' ORDER BY name;

-- Ricerca esercizi per nome (LIKE query)
SELECT * FROM exercises WHERE name ILIKE '%squat%';
```

**Nota LIKE query**:
- Index `[name]` supporta `ILIKE '%...%'` con penalty su performance se tabella cresce > 10K righe
- Per scale > 10K esercizi, valutare Full-Text Search (Postgres `tsvector`, `to_tsvector`, GIN index)

---

### 7. ExerciseMuscleGroup (exercise_muscle_groups)

```prisma
@@index([exerciseId])
@@index([muscleGroupId])
```

**Rationale**:
- `[exerciseId]`: JOIN ottimizzato Exercise → MuscleGroup (gruppi muscolari per esercizio)
- `[muscleGroupId]`: JOIN inverso MuscleGroup → Exercise (esercizi per gruppo muscolare)

**Query ottimizzate**:
```sql
-- Gruppi muscolari per esercizio X
SELECT muscleGroupId, coefficient FROM exercise_muscle_groups WHERE exerciseId = '<exercise-uuid>';

-- Esercizi che allenano gruppo muscolare Y
SELECT exerciseId, coefficient FROM exercise_muscle_groups WHERE muscleGroupId = '<muscle-group-uuid>';
```

---

### 8. TrainingProgram (training_programs)

```prisma
@@index([trainerId, status])
@@index([traineeId, status])
@@index([status, startDate])
```

**Rationale**:
- `[trainerId, status]`: **Dashboard Trainer KPI** — filtraggio schede attive per trainer (query più frequente)
- `[traineeId, status]`: Vista trainee scheda corrente (scheda active per trainee X)
- `[status, startDate]`: Query schede in scadenza ordinate per `startDate` — usato in KPI "Schede in scadenza"

**Query ottimizzate**:
```sql
-- Dashboard trainer: trainee attivi totali
SELECT COUNT(DISTINCT traineeId)
FROM training_programs
WHERE trainerId = '<trainer-uuid>' AND status = 'active';

-- Dashboard trainer: schede in scadenza (< 2 settimane)
SELECT 
  traineeId, 
  title, 
  startDate, 
  durationWeeks,
  (startDate + (durationWeeks * 7 * INTERVAL '1 day')) AS endDate
FROM training_programs
WHERE trainerId = '<trainer-uuid>' 
  AND status = 'active'
  AND (startDate + (durationWeeks * 7 * INTERVAL '1 day')) BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '14 days')
ORDER BY endDate ASC;

-- Trainee: scheda corrente
SELECT * FROM training_programs 
WHERE traineeId = '<trainee-uuid>' AND status = 'active' 
LIMIT 1;
```

**Nota**: Calcolo `endDate` non è indicizzabile (computed column). Per scale > 1000 schede attive, valutare:
- **Soluzione A**: Colonna `endDate` persistita nel DB (updated via trigger o job schedulato)
- **Soluzione B**: Materialized view per dashboard queries

---

### 9. Week (weeks)

```prisma
@@index([programId, weekNumber])
@@index([startDate])
```

**Rationale**:
- `[programId, weekNumber]`: Lookup rapido per settimana specifica in una scheda (es. Week 5 di programma X)
- `[startDate]`: Filtraggio settimane per data (es. job schedulato che aggiorna `status=completed` quando `endDate` passa)

**Query ottimizzate**:
```sql
-- Settimana corrente per trainee (viewport trainee mobile)
SELECT * FROM weeks 
WHERE programId = '<program-uuid>' 
  AND startDate <= CURRENT_DATE 
  AND (startDate + INTERVAL '7 days') >= CURRENT_DATE
LIMIT 1;

-- Job schedulato: settimane terminate da completare
SELECT programId FROM weeks 
WHERE startDate + INTERVAL '7 days' < CURRENT_DATE 
  AND feedbackRequested = true;
```

---

### 10. Workout (workouts)

```prisma
@@index([weekId])
```

**Rationale**:
- `[weekId]`: JOIN Week → Workout (tutti gli allenamenti di una settimana) — query frequente per viewport trainee

**Query ottimizzate**:
```sql
-- Allenamenti settimana corrente
SELECT * FROM workouts WHERE weekId = '<week-uuid>' ORDER BY dayLabel;
```

---

### 11. WorkoutExercise (workout_exercises)

```prisma
@@index([workoutId, order])
@@index([exerciseId])
```

**Rationale**:
- `[workoutId, order]`: JOIN Workout → WorkoutExercise con ordinamento (esercizi in ordine esecuzione)
- `[exerciseId]`: Storico esercizio (es. "tutte le volte che trainee X ha fatto Squat")

**Query ottimizzate**:
```sql
-- Esercizi per allenamento ordinati
SELECT * FROM workout_exercises 
WHERE workoutId = '<workout-uuid>' 
ORDER BY order ASC;

-- Storico esercizio per trainee
SELECT we.*, w.dayLabel, wk.weekNumber, wk.startDate
FROM workout_exercises we
JOIN workouts w ON w.id = we.workoutId
JOIN weeks wk ON wk.id = w.weekId
JOIN training_programs tp ON tp.id = wk.programId
WHERE we.exerciseId = '<exercise-uuid>' 
  AND tp.traineeId = '<trainee-uuid>'
ORDER BY wk.startDate DESC;
```

---

### 12. ExerciseFeedback (exercise_feedbacks)

```prisma
@@unique([workoutExerciseId, traineeId, date])
@@index([traineeId, date])
@@index([workoutExerciseId])
```

**Rationale**:
- `@@unique([workoutExerciseId, traineeId, date])`: **Idempotency constraint** — previene feedback duplicati stesso esercizio/trainee/giorno
- `[traineeId, date]`: Filtraggio feedback trainee per data (storico progressi)
- `[workoutExerciseId]`: JOIN WorkoutExercise → ExerciseFeedback (feedback per esercizio specifico)

**Query ottimizzate**:
```sql
-- Feedback trainee oggi (viewport mobile)
SELECT * FROM exercise_feedbacks 
WHERE traineeId = '<trainee-uuid>' 
  AND date::date = CURRENT_DATE;

-- Feedback per esercizio specifico (trainer review)
SELECT * FROM exercise_feedbacks 
WHERE workoutExerciseId = '<workout-exercise-uuid>';
```

---

### 13. SetPerformed (sets_performed)

```prisma
@@index([feedbackId])
```

**Rationale**:
- `[feedbackId]`: JOIN ExerciseFeedback → SetPerformed (serie eseguite per feedback) — query frequente per storico progressi

**Query ottimizzate**:
```sql
-- Serie eseguite per feedback X
SELECT setNumber, reps, weight FROM sets_performed 
WHERE feedbackId = '<feedback-uuid>' 
ORDER BY setNumber ASC;

-- Query aggregate: peso massimo sollevato per esercizio
SELECT MAX(sp.weight) AS max_weight
FROM sets_performed sp
JOIN exercise_feedbacks ef ON ef.id = sp.feedbackId
JOIN workout_exercises we ON we.id = ef.workoutExerciseId
WHERE we.exerciseId = '<exercise-uuid>' 
  AND ef.traineeId = '<trainee-uuid>';
```

---

### 14. PersonalRecord (personal_records)

```prisma
@@index([traineeId, exerciseId])
@@index([recordDate])
```

**Rationale**:
- `[traineeId, exerciseId]`: Lookup rapido massimali trainee per esercizio (es. "1RM Squat di trainee X")
- `[recordDate]`: Ordinamento cronologico massimali (storico progressione forza)

**Query ottimizzate**:
```sql
-- Massimali trainee per esercizio (1RM Squat)
SELECT * FROM personal_records 
WHERE traineeId = '<trainee-uuid>' 
  AND exerciseId = '<squat-uuid>' 
  AND reps = 1
ORDER BY recordDate DESC 
LIMIT 1;

-- Storico massimali trainee
SELECT * FROM personal_records 
WHERE traineeId = '<trainee-uuid>' 
ORDER BY recordDate DESC;
```

---

## Monitoraggio Performance

### Query Analysis Tools

**PostgreSQL `EXPLAIN ANALYZE`**:
```sql
EXPLAIN ANALYZE
SELECT * FROM training_programs 
WHERE trainerId = '<trainer-uuid>' AND status = 'active';
```

Output ottimale:
```
Index Scan using training_programs_trainerId_status_idx on training_programs
  (cost=0.28..8.30 rows=1 width=...)
  Index Cond: ((trainerId = '<uuid>') AND (status = 'active'))
```

**Flags negativi** (indicano indice mancante o inefficiente):
- `Seq Scan` (full table scan invece di index scan)
- `cost=10000..50000` (cost elevato)
- `rows=50000` (stima righe alta, possibile indice mancante)

---

### Supabase Database Inspector

Dashboard Supabase → Database → Performance Inspector:
- **Slow queries**: Query > 100ms
- **Index usage stats**: `pg_stat_user_indexes` (indici non usati)
- **Table size**: `pg_total_relation_size()` per monitorare crescita

**Query per verificare indici inutilizzati**:
```sql
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  idx_scan AS index_scans
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE 'pg_toast%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

Se `idx_scan = 0` dopo 30 giorni produzione → candidato per rimozione indice.

---

## Proiezione Scalabilità

| Tabella              | Righe a 54 utenti | Righe a 500 utenti | Righe a 5000 utenti | Note                                                     |
| -------------------- | ----------------- | ------------------ | ------------------- | -------------------------------------------------------- |
| `users`              | 54                | 500                | 5000                | Index su `email`, `[role, isActive]` OK                  |
| `exercises`          | 150               | 300                | 500                 | Index su `name`, `type`, `movementPatternId` OK fino 10K |
| `training_programs`  | 600               | 5500               | 55000               | Index su `[trainerId, status]` critico                   |
| `weeks`              | 7200              | 66000              | 660000              | Index su `[programId, weekNumber]` OK                    |
| `workout_exercises`  | 288000            | 2.6M               | 26M                 | Index su `[workoutId, order]` OK, monitorare a > 10M     |
| `exercise_feedbacks` | 14400             | 132000             | 1.32M               | Index su `[traineeId, date]` OK                          |
| `sets_performed`     | 50K               | 460K               | 4.6M                | Index su `[feedbackId]` OK fino 10M                      |

**Azioni a 5000 utenti**:
- **Partition `workout_exercises`** per `createdAt` (yearly partitions)
- **Materialized view** per dashboard queries (cache pre-calcolata)
- **Connection pooling** aumentato a 40-50 connessioni (da 10 attuale)
- **Read replicas** per query reporting/analytics

---

## Manutenzione Indici

### Reindex (Rebuild)

PostgreSQL accumula bloat nel tempo. Reindex periodico (ogni 6-12 mesi):

```sql
-- Reindex singola tabella
REINDEX TABLE training_programs;

-- Reindex intero database (downtime richiesto)
REINDEX DATABASE postgres;
```

**Supabase**: Supporta `REINDEX CONCURRENTLY` (no downtime) — pianificare via pg_cron.

---

### Vacuum & Analyze

**Vacuum**: Rimuove dead tuples, recupera spazio fisico  
**Analyze**: Aggiorna statistiche query planner

```sql
-- Vacuum + Analyze singola tabella
VACUUM ANALYZE training_programs;

-- Vacuum full (ricompatta tabella, richiede lock esclusivo)
VACUUM FULL training_programs;
```

**Supabase**: Auto-vacuum configurato di default, ma monitorare bloat manualmente:

```sql
SELECT 
  schemaname, 
  tablename, 
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_dead_tup AS dead_tuples
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

Se `dead_tuples` > 10% righe totali → `VACUUM` manuale.

---

## Riferimenti

- [Postgres Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- [Supabase Performance Tips](https://supabase.com/docs/guides/database/performance)
- [Prisma Index Documentation](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes)
- [EXPLAIN ANALYZE Tutorial](https://www.postgresql.org/docs/current/using-explain.html)
