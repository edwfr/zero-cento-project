# Piano: Gestione Esplicita Completamento Esercizi/Workout

> **Data:** 28 Aprile 2026
> **Autore:** Sviluppatore Senior
> **Scope:** Trainee → Workout Execution Flow

---

## Obiettivo

Aggiungere un sistema di completamento esplicito a livello di `WorkoutExercise`, `Workout`, `Week` e `TrainingProgram`. Il trainee clicca un checkmark verde per marcare un esercizio come completato; il server aggiorna la catena gerarchica in cascata (esercizio → workout → week → program) in background con zero impatto percepito sulla velocità dell'applicazione.

---

## Architettura della Soluzione

### Schema gerarchico del completamento

```
WorkoutExercise.isCompleted
    └─ TUTTI i WorkoutExercise di un Workout completati?
        └─ Workout.isCompleted = true
            └─ TUTTI i Workout di una Week completati?
                └─ Week.isCompleted = true
                    └─ TUTTE le Week di un TrainingProgram completate?
                        └─ TrainingProgram.status = 'completed'
```

### Decisioni architetturali

| Decisione | Scelta | Motivazione |
|---|---|---|
| `TrainingProgram.isCompleted` | ❌ Non aggiunto | Usa `status` + `completedAt` già esistenti |
| Flusso feedback | Invariato | `isCompleted` è indipendente da `ExerciseFeedback.completed` |
| Transazione | Singola `prisma.$transaction` interactive | Atomicità + minore latenza rispetto a query separate |
| UI pattern | Ottimistic update | Latenza percepita = 0ms; revert su errore |
| Direction | Bidirezionale (check + uncheck) | Stessa funzione, stesso endpoint |
| Rate limiting | In-memory (non Redis) | Mutation — coerente con Rule 2 del backend skill |

---

## Checklist Implementazione

### FASE 1 — Schema Prisma e Migrazione

- [ ] **1.1** In `prisma/schema.prisma`: aggiungere `isCompleted Boolean @default(false)` al modello `WorkoutExercise` (dopo il campo `order`)
- [ ] **1.2** In `prisma/schema.prisma`: aggiungere `isCompleted Boolean @default(false)` al modello `Workout` (dopo il campo `notes`)
- [ ] **1.3** In `prisma/schema.prisma`: aggiungere `isCompleted Boolean @default(false)` al modello `Week` (dopo il campo `generalFeedback`)
- [ ] **1.4** Aggiungere indici di performance per le COUNT query della cascata:
  - `@@index([workoutId, isCompleted])` su `WorkoutExercise`
  - `@@index([weekId, isCompleted])` su `Workout`
  - `@@index([programId, isCompleted])` su `Week`
- [ ] **1.5** Eseguire `npm run prisma:migrate` — nome migrazione: `add_is_completed_fields`
- [ ] **1.6** Eseguire `npm run prisma:generate` per rigenerare il client Prisma

> **Performance note:** gli indici composti `(workoutId, isCompleted)` riducono le COUNT queries a scansioni di 3–8 righe (tipicamente il numero di esercizi per workout). Il costo sulle scritture è trascurabile.

---

### FASE 2 — Completion Service

- [ ] **2.1** Creare `src/lib/completion-service.ts` con interfaccia pubblica:

```typescript
export interface CascadeResult {
  workoutExercise: { id: string; isCompleted: boolean }
  workout: { id: string; isCompleted: boolean }
  week: { id: string; isCompleted: boolean }
  program: { id: string; status: 'draft' | 'active' | 'completed' }
}

export async function cascadeCompletion(
  workoutExerciseId: string,
  isCompleted: boolean
): Promise<CascadeResult>
```

- [ ] **2.2** Implementare la cascata **dentro una singola `prisma.$transaction(async tx => ...)`**:
  1. `tx.workoutExercise.update({ where: { id }, data: { isCompleted } })` — marca l'esercizio
  2. Recupera `workoutId` e `weekId` (select minimo)
  3. `COUNT WorkoutExercise WHERE workoutId AND isCompleted=false` — verifica se workout completo
  4. Guard: workout completo solo se `total > 0 && incomplete === 0`
  5. **Solo se stato cambia**: `tx.workout.update({ data: { isCompleted: workoutIsCompleted } })`
  6. `COUNT Workout WHERE weekId AND isCompleted=false`
  7. **Solo se stato cambia**: `tx.week.update({ data: { isCompleted: weekIsCompleted } })`
  8. `COUNT Week WHERE programId AND isCompleted=false`
  9. **Solo se stato cambia** e `program.status !== 'draft'`: `tx.trainingProgram.update({ data: { status, completedAt } })`
     - complete: `status='completed'`, `completedAt=new Date()`
     - incomplete: `status='active'`, `completedAt=null`
  10. Ritorna `CascadeResult`

> **Pattern "solo se cambia stato":** evita UPDATE inutili al DB quando il valore non cambia. Riduce il carico in scenari di de-completamento parziale.

> **Reverse cascade:** la stessa funzione con `isCompleted=false` de-completa verso l'alto tutta la catena che dipende dall'esercizio modificato.

---

### FASE 3 — API Endpoint

- [ ] **3.1** Creare `src/app/api/trainee/workout-exercises/[id]/complete/route.ts` — metodo `PATCH`:

```typescript
// Pattern esatto (coerente con copilot-instructions.md §3.5)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const session = await requireRole(['trainee'])

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten(), 'validation.invalid')
    }

    // Ownership check — singola findFirst (Rule 3)
    const owns = await prisma.workoutExercise.findFirst({
      where: { id, workout: { week: { program: { traineeId: session.user.id } } } },
      select: { id: true },
    })
    if (!owns) return apiError('NOT_FOUND', 'Workout exercise not found', 404, undefined, 'workoutExercise.notFound')

    const result = await cascadeCompletion(id, parsed.data.isCompleted)
    return apiSuccess(result)   // Client aggiorna stato locale — nessun GET aggiuntivo (Rule 5)
  } catch (error) {
    if (error instanceof Response) return error
    return apiError('INTERNAL_ERROR', 'Unexpected error', 500, undefined, 'internal.default')
  }
}
```

- [ ] **3.2** Schema Zod per il body: `z.object({ isCompleted: z.boolean() })`

---

### FASE 4 — Aggiornamento GET Workout

- [ ] **4.1** In `src/app/api/trainee/workouts/[id]/route.ts`: aggiungere `isCompleted: true` al `select` di `workoutExercises` nella query Prisma, così la risposta include il campo per inizializzare lo stato client al caricamento

---

### FASE 5 — Frontend: Pagina Esecuzione Workout

**File:** `src/app/trainee/workouts/[id]/_content.tsx`

- [ ] **5.1** Aggiungere `isCompleted: boolean` all'interface `WorkoutExerciseWithWeight`

- [ ] **5.2** Aggiungere stato locale:
```typescript
const [exerciseCompleted, setExerciseCompleted] = useState<Record<string, boolean>>({})
```

- [ ] **5.3** Inizializzare `exerciseCompleted` in `fetchWorkout`:
```typescript
orderedExercises.forEach((we) => {
  initialCompleted[we.id] = we.isCompleted
})
setExerciseCompleted(initialCompleted)
```

- [ ] **5.4** Implementare `toggleExerciseCompleted(workoutExerciseId: string)` con pattern ottimistico:
  1. Calcola `next = !exerciseCompleted[workoutExerciseId]`
  2. **Ottimistic update immediato** (UI risponde istantaneamente): `setExerciseCompleted(prev => ({ ...prev, [id]: next }))`
  3. Fire-and-forget `PATCH /api/trainee/workout-exercises/${id}/complete` con `{ isCompleted: next }`
  4. On error: revert state + `showToast(t('workouts.errorMarkComplete'), 'error')`
  5. On success: se la risposta indica completamento di workout/week/program, mostrare toast di celebrazione (Fase 7)

- [ ] **5.5** Aggiornare `ExerciseFocusCardProps` con:
  - `isCompleted: boolean`
  - `onToggleCompleted: () => void`

- [ ] **5.6** Passare i nuovi props al `ExerciseFocusCard` nel JSX del componente padre

- [ ] **5.7** In `ExerciseFocusCard`, aggiungere il **pulsante di completamento esercizio** tra la sezione sets e il selettore RPE:
  - Usa `<Button variant="primary">` se `!isCompleted`, `<Button variant="secondary">` se `isCompleted`
  - Icon `<Check />` (già importata)
  - Testi: `t('workouts.markExerciseComplete')` / `t('workouts.markExerciseIncomplete')`
  - Se `isCompleted=true`: mostrare un banner/badge verde in cima alla card (es. `<div className="bg-state-success/10 border border-state-success ...">`)

- [ ] **5.8** Il pulsante **"Completa Workout"** al passo finale rimane **invariato** — continua a inviare il feedback come ora; non trigera la cascata

---

### FASE 6 — i18n

- [ ] **6.1** Aggiungere in `public/locales/en/trainee.json` (dentro `workouts`):
```json
"markExerciseComplete": "Mark as done",
"markExerciseIncomplete": "Mark as not done",
"exerciseCompleted": "Exercise completed",
"errorMarkComplete": "Failed to update. Please try again.",
"workoutCompletedToast": "Workout completed!",
"weekCompletedToast": "Week {{week}} completed!",
"programCompletedToast": "Training program completed! 🎉"
```

- [ ] **6.2** Aggiungere le stesse chiavi in `public/locales/it/trainee.json`:
```json
"markExerciseComplete": "Segna come completato",
"markExerciseIncomplete": "Segna come non completato",
"exerciseCompleted": "Esercizio completato",
"errorMarkComplete": "Aggiornamento fallito. Riprova.",
"workoutCompletedToast": "Allenamento completato!",
"weekCompletedToast": "Settimana {{week}} completata!",
"programCompletedToast": "Programma di allenamento completato! 🎉"
```

---

### FASE 7 — Toast Celebrativi Cascata (UX)

- [ ] **7.1** In `toggleExerciseCompleted`, dopo risposta del server OK:
  - Se `result.workout.isCompleted === true` (e `next === true`): `showToast(t('workouts.workoutCompletedToast'), 'success')`
  - Se `result.week.isCompleted === true`: `showToast(t('workouts.weekCompletedToast', { week: workout.weekNumber }), 'success')`
  - Se `result.program.status === 'completed'`: `showToast(t('workouts.programCompletedToast'), 'success')`
- [ ] **7.2** Mostrare i toast in sequenza (non in parallelo) per evitare sovrapposizioni visive: usare piccoli `setTimeout` tra un toast e l'altro (200ms)

---

### FASE 8 — Test Unit (Completion Service)

**File:** `tests/unit/completion-service.test.ts`

- [ ] **8.1** Usare il mock `prisma` già configurato in `tests/unit/setup.ts` — non ridichiarare localmente
- [ ] **8.2** **Test: esercizio completato, workout NON ancora completo**
  - `COUNT incomplete > 0` → `workout.isCompleted` rimane `false`, nessun update a Week/Program
- [ ] **8.3** **Test: completamento dell'ultimo esercizio → cascade workout**
  - `COUNT incomplete = 0`, `total > 0` → `workout.isCompleted = true`
  - `COUNT incomplete workouts > 0` → Week/Program non aggiornati
- [ ] **8.4** **Test: cascade completa fino al Program**
  - Tutti gli esercizi → workout → week → `program.status = 'completed'`, `completedAt` valorizzato
- [ ] **8.5** **Test: de-completamento (reverse cascade)**
  - `isCompleted = false` → `workout.isCompleted = false` → `week.isCompleted = false` → `program.status = 'active'`, `completedAt = null`
- [ ] **8.6** **Test: guard workout vuoto** (`total = 0` → `workoutIsCompleted = false` anche se non ci sono incomplete)

---

### FASE 9 — Test Integration (API Endpoint)

**File:** `tests/integration/workout-exercise-complete.test.ts`

- [ ] **9.1** Importare sessioni fixture da `tests/integration/fixtures.ts`
- [ ] **9.2** **200 OK** — trainee corretto + `{ isCompleted: true }` → risposta `CascadeResult`
- [ ] **9.3** **400** — body mancante `isCompleted` → `VALIDATION_ERROR`
- [ ] **9.4** **401** — richiesta senza token → `UNAUTHORIZED`
- [ ] **9.5** **403** — trainee che non possiede il workout exercise → `NOT_FOUND` (403 non rivela esistenza)
- [ ] **9.6** **404** — `workoutExerciseId` inesistente → `NOT_FOUND`
- [ ] **9.7** **200 OK** — toggle a `false` dopo essere `true`

---

### FASE 10 — Changelog e Checklist

- [ ] **10.1** Aggiungere entry in `implementation-docs/CHANGELOG.md`
- [ ] **10.2** Marcare i task in `implementation-docs/CHECKLIST.md`

---

## Mappa File Modificati

| File | Tipo | Modifica |
|---|---|---|
| `prisma/schema.prisma` | Modifica | +`isCompleted` su `WorkoutExercise`, `Workout`, `Week` + 3 indici |
| `src/lib/completion-service.ts` | **NUOVO** | `cascadeCompletion()` con transazione atomica |
| `src/app/api/trainee/workout-exercises/[id]/complete/route.ts` | **NUOVO** | PATCH endpoint con auth + ownership + cascata |
| `src/app/api/trainee/workouts/[id]/route.ts` | Modifica | +`isCompleted` nel select delle workoutExercises |
| `src/app/trainee/workouts/[id]/_content.tsx` | Modifica | Stato ottimistico + toggle button + toast cascata |
| `public/locales/en/trainee.json` | Modifica | 7 nuove chiavi i18n |
| `public/locales/it/trainee.json` | Modifica | 7 nuove chiavi i18n (IT) |
| `tests/unit/completion-service.test.ts` | **NUOVO** | 6 test case |
| `tests/integration/workout-exercise-complete.test.ts` | **NUOVO** | 7 test case |

---

## Comandi di Verifica

```bash
# 1. Migrazione
npm run prisma:migrate
npm run prisma:generate

# 2. Type check
npm run type-check

# 3. Test
npx vitest run tests/unit/completion-service.test.ts
npx vitest run tests/integration/workout-exercise-complete.test.ts
npm run test:unit   # coverage ≥ 80%

# 4. Build
npm run build
```
