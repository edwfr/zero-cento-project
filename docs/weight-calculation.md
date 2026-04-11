# Calcolo Pesi Server-Side per Visualizzazione Trainee

## Problema
Quando un trainee visualizza un workout, gli esercizi con `weightType` dinamico (percentage_1rm, percentage_rm, percentage_previous) richiedono calcoli server-side che dipendono da:
- Query DB per Personal Records (1RM, nRM)
- Query DB per WorkoutExercise precedenti nello stesso workout (percentage_previous)
- Calcoli ricorsivi per catene di percentage_previous

## Requisito UX
Nella GUI del trainee, per ogni esercizio con peso dinamico deve essere visualizzato:
1. **Il valore impostato dal trainer** (es. "80% 1RM", "-5%", "85% 5RM")
2. **Il peso effettivo calcolato** (es. "100 kg", "95 kg", "102.5 kg")

Esempio UI:
```
Squat
3 serie × 5 reps @ 80% 1RM
Peso calcolato: 100 kg
RPE target: 8.0
Rest: 3min
```

## Implementazione

### 1. Endpoint Trainee - Visualizzazione Workout

**GET `/api/trainee/workouts/[workoutId]`**

Response deve includere peso effettivo pre-calcolato per ogni esercizio:

```typescript
{
  id: "workout-uuid",
  dayLabel: "Giorno 1",
  exercises: [
    {
      id: "workout-exercise-uuid",
      exercise: {
        id: "exercise-uuid",
        name: "Squat",
        description: "...",
        youtubeUrl: "..."
      },
      sets: 3,
      reps: "5",
      targetRpe: 8.0,
      weightType: "percentage_1rm",
      weight: 80,  // Valore impostato dal trainer: 80%
      effectiveWeight: 100,  // ← PESO CALCOLATO SERVER-SIDE
      restTime: "3m",
      notes: null,
      order: 1
    },
    {
      id: "workout-exercise-uuid-2",
      exercise: {
        id: "exercise-uuid",
        name: "Squat",
        description: "...",
        youtubeUrl: "..."
      },
      sets: 2,
      reps: "8",
      targetRpe: 7.0,
      weightType: "percentage_previous",
      weight: -5,  // Valore impostato dal trainer: -5%
      effectiveWeight: 95,  // ← CALCOLATO: 100kg * 0.95 = 95kg
      restTime: "2m",
      notes: "Back-off set",
      order: 2
    }
  ]
}
```

### 2. Logica Server - calculateEffectiveWeight

Utilizzo della funzione helper già definita in `design/03-backend-api.md`:

```typescript
// app/api/trainee/workouts/[workoutId]/route.ts
import { calculateEffectiveWeight } from '@/lib/weight-calculator'

export async function GET(
  request: Request,
  { params }: { params: { workoutId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'trainee') {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const traineeId = session.user.id
  
  // 1. Fetch workout con esercizi
  const workout = await prisma.workout.findUnique({
    where: { id: params.workoutId },
    include: {
      workoutExercises: {
        include: {
          exercise: true
        },
        orderBy: { order: 'asc' }
      }
    }
  })
  
  if (!workout) {
    return new Response('Workout not found', { status: 404 })
  }
  
  // 2. Calcola peso effettivo per ogni esercizio
  const exercisesWithWeights = await Promise.all(
    workout.workoutExercises.map(async (we) => {
      let effectiveWeight: number | null = null
      
      try {
        effectiveWeight = await calculateEffectiveWeight(we, traineeId)
      } catch (error) {
        // Se calcolo fallisce (es. massimale mancante), effectiveWeight rimane null
        console.error(`Failed to calculate weight for exercise ${we.id}:`, error)
      }
      
      return {
        ...we,
        effectiveWeight // Campo aggiunto dinamicamente
      }
    })
  )
  
  return Response.json({
    ...workout,
    workoutExercises: exercisesWithWeights
  })
}
```

### 3. Gestione Errori - Massimali Mancanti

Se il calcolo fallisce (es. trainee non ha 1RM registrato per un esercizio con `percentage_1rm`):
- `effectiveWeight: null` nella response
- UI trainee mostra messaggio esplicativo:
  ```
  Squat
  3 serie × 5 reps @ 80% 1RM
  ⚠️ Massimale non registrato - contatta il tuo trainer
  ```

### 4. Ottimizzazione - Batching Query

Per ridurre query DB, pre-fetch tutti i massimali del trainee in una singola query:

```typescript
// Fetch massimali trainee in batch
const personalRecords = await prisma.personalRecord.findMany({
  where: {
    traineeId,
    exerciseId: {
      in: workout.workoutExercises.map(we => we.exerciseId)
    }
  },
  orderBy: { recordDate: 'desc' }
})

// Crea lookup map per accesso O(1)
const recordsMap = new Map<string, PersonalRecord[]>()
personalRecords.forEach(record => {
  const key = `${record.exerciseId}-${record.reps}`
  if (!recordsMap.has(key)) {
    recordsMap.set(key, [])
  }
  recordsMap.get(key)!.push(record)
})

// Usa recordsMap in calculateEffectiveWeight per evitare query multiple
```

### 5. Caching - TanStack Query Client-Side

Response endpoint cached lato client per ridurre latenza:

```typescript
// app/trainee/workouts/[id]/page.tsx
const { data: workout } = useQuery({
  queryKey: ['trainee', 'workout', workoutId],
  queryFn: () => fetch(`/api/trainee/workouts/${workoutId}`).then(r => r.json()),
  staleTime: 5 * 60 * 1000, // 5 minuti
  cacheTime: 30 * 60 * 1000 // 30 minuti
})
```

### 6. Altri Endpoint da Aggiornare

Gli stessi calcoli vanno applicati a:
- **GET `/api/trainee/programs/current`** - Workout corrente con esercizi
- **GET `/api/trainer/programs/[id]/progress`** - Dashboard trainer (per vedere pesi effettivi assegnati)
- **GET `/api/programs/[id]`** - Dettaglio scheda (trainer view con pesi calcolati per ogni trainee)

## Performance Considerations

### Latency Impact
- **absolute**: 0 query aggiuntive
- **percentage_1rm / percentage_rm**: 1 query per PersonalRecord (mitigabile con batch fetch)
- **percentage_previous**: 0 query aggiuntive (dati già in memoria da workout fetch)
- **Catena percentage_previous** (es. 4 occorrenze stesso esercizio): Ricorsione in-memory, nessuna query aggiuntiva

### Mitigazioni
1. **Batch fetch** di PersonalRecords all'inizio (1 query per tutti esercizi del workout)
2. **Caching client-side** con TanStack Query (5min staleTime)
3. **Pre-calcolo opzionale**: Storace `effectiveWeight` su WorkoutExercise al momento del publish (feature futura - vedi raccomandazione A3 design review)

## Esempio Completo - Catena percentage_previous

Workout:
```
1. Squat: 3×5 @ 100kg (absolute)
2. Squat: 2×5 @ -5% (percentage_previous → 95kg)
3. Squat: 1×8 @ -10% (percentage_previous → 85.5kg, calcolato su 95kg)
```

Calcoli:
1. Exercise 1: `effectiveWeight = 100kg` (absolute)
2. Exercise 2: `effectiveWeight = 100kg * 0.95 = 95kg`
3. Exercise 3: `effectiveWeight = 95kg * 0.90 = 85.5kg`

Response JSON:
```json
{
  "exercises": [
    {
      "exercise": { "name": "Squat" },
      "sets": 3,
      "reps": "5",
      "weightType": "absolute",
      "weight": 100,
      "effectiveWeight": 100,
      "order": 1
    },
    {
      "exercise": { "name": "Squat" },
      "sets": 2,
      "reps": "5",
      "weightType": "percentage_previous",
      "weight": -5,
      "effectiveWeight": 95,
      "order": 2
    },
    {
      "exercise": { "name": "Squat" },
      "sets": 1,
      "reps": "8",
      "weightType": "percentage_previous",
      "weight": -10,
      "effectiveWeight": 85.5,
      "order": 3
    }
  ]
}
```

## Testing

### Test Cases
1. **Absolute weight**: Verifica `effectiveWeight === weight`
2. **percentage_1rm con 1RM presente**: Verifica calcolo corretto
3. **percentage_1rm con 1RM mancante**: Verifica `effectiveWeight === null` + errore graceful
4. **percentage_previous singolo**: Verifica calcolo su riga precedente
5. **percentage_previous catena (3 livelli)**: Verifica ricorsione corretta
6. **percentage_previous senza precedente**: Verifica 400 Bad Request al salvataggio scheda (validazione preventiva)

### Unit Test - calculateEffectiveWeight
```typescript
describe('calculateEffectiveWeight', () => {
  it('should calculate percentage_1rm correctly', async () => {
    // Mock PersonalRecord: 1RM = 125kg
    // WorkoutExercise: 80% 1RM
    const result = await calculateEffectiveWeight(workoutExercise, traineeId)
    expect(result).toBe(100) // 125kg * 0.80 = 100kg
  })
  
  it('should handle percentage_previous chain', async () => {
    // Setup: 100kg → -5% → -10%
    const exercise1 = { weightType: 'absolute', weight: 100 }
    const exercise2 = { weightType: 'percentage_previous', weight: -5 }
    const exercise3 = { weightType: 'percentage_previous', weight: -10 }
    
    const result1 = await calculateEffectiveWeight(exercise1, traineeId)
    const result2 = await calculateEffectiveWeight(exercise2, traineeId)
    const result3 = await calculateEffectiveWeight(exercise3, traineeId)
    
    expect(result1).toBe(100)
    expect(result2).toBe(95)
    expect(result3).toBe(85.5)
  })
})
```

## Roadmap Future

### Fase 1 (MVP): Runtime Calculation ✅
- Calcolo real-time in GET endpoint
- Batch fetch PersonalRecords
- Cache client-side 5min

### Fase 2 (Ottimizzazione): Pre-calculation al Publish
- Aggiungi campo `WorkoutExercise.effectiveWeightSnapshot: Float?`
- Al publish della scheda, calcola e stora tutti i pesi effettivi
- GET endpoint ritorna snapshot (0 calcoli runtime)
- Invalida snapshot se trainee aggiorna massimali (trigger + re-calcolo)

**Benefici pre-calcolo**:
- Latenza eliminata per trainee (peso già disponibile)
- Snapshot storico (peso calcolato al momento publish, non cambia se trainee migliora 1RM dopo)
- Meno carico server (calcolo 1 volta al publish, non ad ogni visualizzazione)

**Trade-off**:
- Snapshot può divergere da massimali aggiornati (feature o bug? - da decidere con utenti)
- Storage aggiuntivo (~4 bytes per WorkoutExercise)
- Complessità invalidazione cache

---

**Status**: Documento implementazione - ready for development
**Owner**: Backend team
**Priority**: HIGH (blocker per trainee workout view MVP)
**Related**: design-review/design-review.md (Rischio MEDIO, item A3)
