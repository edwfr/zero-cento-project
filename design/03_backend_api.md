# Backend & API

## Pattern backend
- **Runtime**: Next.js API Routes (App Router — `app/api/`) su Vercel Serverless Functions.
- **Stile API**: **REST** con endpoint HTTP standard + Server Actions opzionali per form submissions.
  - Coverage AI eccellente (pattern consolidati, vastissima presenza training data)
  - Type-safety via TypeScript + Zod validation
  - HTTP semantics chiare (GET/POST/PUT/DELETE)
- Nessun servizio backend separato: Next.js è il BFF.

## Gruppi di endpoint principali

### Auth

**Autenticazione gestita da Supabase Auth** — non richiede endpoint API Routes custom per MVP.

- **Login/Logout/Session**: Gestiti direttamente da Supabase client SDK (`@supabase/auth-helpers-nextjs`)
- **Metodo MVP**: Email + password via `supabase.auth.signInWithPassword()` e `supabase.auth.signOut()`
- **Session management**: JWT automatico con refresh token, cookie HTTP-only
- **Endpoint futuri (post-MVP OAuth)**: `/api/auth/callback` per gestire redirect OAuth (Google, GitHub)

**Non serve endpoint catch-all come NextAuth** — Supabase gestisce tutto lato infrastruttura.

---

### Utenti (Admin + trainer)
| Method   | Path                         | Descrizione                                                        | Ruoli autorizzati |
| -------- | ---------------------------- | ------------------------------------------------------------------ | ----------------- |
| `GET`    | `/api/users`                 | Lista utenti (admin: tutti, trainer: solo propri trainee)          | admin, trainer    |
| `POST`   | `/api/users`                 | Crea utente (admin: trainer/trainee, trainer: solo trainee)        | admin, trainer    |
| `GET`    | `/api/users/[id]`            | Dettaglio utente (admin: tutti, trainer: solo propri trainee)      | admin, trainer    |
| `PUT`    | `/api/users/[id]`            | Modifica utente (admin: tutti campi, trainer: solo propri trainee) | admin, trainer    |
| `DELETE` | `/api/users/[id]`            | Elimina utente (admin: tutti, trainer: solo propri trainee)        | admin, trainer    |
| `PATCH`  | `/api/users/[id]/deactivate` | Disabilita trainee (admin: tutti, trainer: solo propri)            | admin, trainer    |
| `PATCH`  | `/api/users/[id]/activate`   | Riabilita trainee (admin: tutti, trainer: solo propri)             | admin, trainer    |

**Note autorizzazione creazione**:
- `POST /api/users` con `role=trainer`: **solo admin**
- `POST /api/users` con `role=trainee`: **admin o trainer** (trainer crea i propri atleti)
- `POST /api/users` con `role=admin`: **bloccato** (admin creabile solo via seed/migration iniziale)
- trainer che crea trainee: il sistema crea automaticamente record in `TrainerTrainee` per l'associazione (relazione 1:1)
- **Vincolo 1:1**: Un trainee può avere UN SOLO trainer. `TrainerTrainee.traineeId` ha UNIQUE constraint per garantire l'unicità
- Se necessario cambio trainer: eliminare vecchio record `TrainerTrainee` e crearne uno nuovo

**Note autorizzazione disabilitazione**:
- `PATCH /api/users/[id]/deactivate` e `/activate`: 
  - Admin: può disabilitare qualsiasi trainee
  - trainer: può disabilitare **solo trainee a lui assegnati** (verifica esistenza record `TrainerTrainee`)
  - Se trainer tenta disabilitare trainee di altro trainer: **403 Forbidden**
  - Trainee disabilitato (`isActive=false`): login bloccato con messaggio "Account disabilitato"

### Esercizi — Libreria Condivisa (Admin + Trainer)
| Method   | Path                  | Descrizione                                                              | Ruoli autorizzati |
| -------- | --------------------- | ------------------------------------------------------------------------ | ----------------- |
| `GET`    | `/api/exercises`      | Lista libreria esercizi (filtri: tipo, schema motorio, gruppo muscolare) | tutti             |
| `POST`   | `/api/exercises`      | Crea esercizio (aggiunto a libreria condivisa)                           | admin, trainer    |
| `GET`    | `/api/exercises/[id]` | Dettaglio esercizio con gruppi muscolari e schema                        | tutti             |
| `PUT`    | `/api/exercises/[id]` | Modifica esercizio (QUALSIASI esercizio)                                 | admin, trainer    |
| `DELETE` | `/api/exercises/[id]` | Elimina esercizio (QUALSIASI esercizio)                                  | admin, trainer    |

**Note autorizzazione libreria condivisa**:
- **Libreria condivisa**: Tutti gli esercizi sono visibili e gestibili da TUTTI i trainer (non solo chi li ha creati)
- `GET /api/exercises`: Accessibile a tutti (trainer usano per comporre schede, trainee leggono durante allenamento)
- `POST /api/exercises`: Admin e trainer possono creare esercizi che diventano immediatamente disponibili a tutti i trainer
- `PUT /DELETE /api/exercises/[id]`: Admin e trainer possono modificare/eliminare **qualsiasi esercizio**, non solo i propri
  - Campo `Exercise.createdBy` traccia autore originale (audit log) ma **non limita permission**
  - Validazione backend: verifica solo `role IN ('admin', 'trainer')`, **non** ownership
- **Rationale**: Collaborazione tra trainer, evita duplicazione, libreria si arricchisce organicamente
- **Protezione**: Eliminazione esercizio usato in scheda attiva restituisce `409 Conflict` (integrità referenziale)

### Gruppi Muscolari — Libreria Condivisa (Admin + Trainer)
| Method   | Path                              | Descrizione                        | Ruoli autorizzati |
| -------- | --------------------------------- | ---------------------------------- | ----------------- |
| `GET`    | `/api/muscle-groups`              | Lista gruppi muscolari attivi      | tutti             |
| `POST`   | `/api/muscle-groups`              | Crea nuovo gruppo muscolare        | admin, trainer    |
| `GET`    | `/api/muscle-groups/[id]`         | Dettaglio gruppo muscolare         | tutti             |
| `PUT`    | `/api/muscle-groups/[id]`         | Modifica gruppo (QUALSIASI)        | admin, trainer    |
| `PATCH`  | `/api/muscle-groups/[id]/archive` | Archivia gruppo (isActive=false)   | admin, trainer    |
| `DELETE` | `/api/muscle-groups/[id]`         | Elimina gruppo (solo se non usato) | admin, trainer    |

**Note autorizzazione gruppi muscolari**:
- **Libreria condivisa**: Tutti i gruppi muscolari sono gestibili da TUTTI i trainer
- `POST /api/muscle-groups`: Crea nuovo gruppo (es. "Obliqui", "Erettori spinali") disponibile immediatamente a tutti
- `PUT /api/muscle-groups/[id]`: Modifica nome/descrizione di qualsiasi gruppo
- `PATCH .../archive`: Archiviazione soft (isActive=false) per gruppi obsoleti senza eliminarli (preserva integrità referenziale)
- `DELETE`: Eliminazione fisica bloccata se esistono `ExerciseMuscleGroup` con quel gruppo → `409 Conflict`
- **Rationale**: Tassonomia personalizzabile senza modificare codice, adattamento a metodologie diverse

### Schemi Motori — Libreria Condivisa (Admin + Trainer)
| Method   | Path                                  | Descrizione                        | Ruoli autorizzati |
| -------- | ------------------------------------- | ---------------------------------- | ----------------- |
| `GET`    | `/api/movement-patterns`              | Lista schemi motori attivi         | tutti             |
| `POST`   | `/api/movement-patterns`              | Crea nuovo schema motorio          | admin, trainer    |
| `GET`    | `/api/movement-patterns/[id]`         | Dettaglio schema motorio           | tutti             |
| `PUT`    | `/api/movement-patterns/[id]`         | Modifica schema (QUALSIASI)        | admin, trainer    |
| `PATCH`  | `/api/movement-patterns/[id]/archive` | Archivia schema (isActive=false)   | admin, trainer    |
| `DELETE` | `/api/movement-patterns/[id]`         | Elimina schema (solo se non usato) | admin, trainer    |

**Note autorizzazione schemi motori**:
- **Libreria condivisa**: Tutti gli schemi motori sono gestibili da TUTTI i trainer
- `POST /api/movement-patterns`: Crea nuovo schema (es. "Turkish Get-Up", "Overhead Carry") disponibile immediatamente
- `PUT /api/movement-patterns/[id]`: Modifica nome/descrizione di qualsiasi schema
- `PATCH .../archive`: Archiviazione soft per schemi obsoleti
- `DELETE`: Eliminazione fisica bloccata se esistono `Exercise` con quel schema → `409 Conflict`
- **Rationale**: Espansione categorizzazioni senza deploy

### Schede / Programmi (trainer)
| Method   | Path                          | Descrizione                                       | Ruoli autorizzati |
| -------- | ----------------------------- | ------------------------------------------------- | ----------------- |
| `GET`    | `/api/programs`               | Lista schede (filtrabili per trainee, status)     | trainer           |
| `POST`   | `/api/programs`               | Crea scheda (inizialmente draft)                  | trainer           |
| `GET`    | `/api/programs/[id]`          | Dettaglio scheda completa                         | trainer           |
| `PUT`    | `/api/programs/[id]`          | Modifica scheda (solo draft)                      | trainer           |
| `DELETE` | `/api/programs/[id]`          | Elimina scheda (solo draft)                       | trainer           |
| `POST`   | `/api/programs/[id]/publish`  | Pubblica scheda (draft → active, setta startDate) | trainer           |
| `GET`    | `/api/programs/[id]/progress` | Avanzamento + feedback trainee                    | trainer           |
| `PATCH`  | `/api/weeks/[id]`             | Configura tipo settimana e feedback obbligatorio  | trainer           |

**Note workflow schede**:
- `POST /api/programs`: Crea scheda con `status=draft`, `startDate=null`. Sistema crea automaticamente Week + Workout vuoti basati su `durationWeeks` e `workoutsPerWeek`. Default `weekType=normal` per tutte le settimane.
- `PUT /api/programs/[id]`: Modifiche permesse **SOLO se `status=draft`**. Se `status=active` o `status=completed` → **403 Forbidden**. Schede pubblicate sono immutabili. Se trainer vuole modifiche, deve creare nuova scheda da zero.
- `PATCH /api/weeks/[id]`: Configura `weekType` (normal, test, deload) e `feedbackRequested` (boolean) per singola settimana. Permesso solo se scheda è `status=draft`.
  - Corpo richiesta: `{ "weekType": "test", "feedbackRequested": true }`
  - Validazione: `weekType` deve essere uno di `["normal", "test", "deload"]`
  - Response: Week aggiornata con nuova configurazione
- `POST /api/programs/[id]/publish`: 
  - Corpo richiesta: `{ "week1StartDate": "2026-04-01" }`
  - Validazione: Tutti workout devono avere almeno 1 esercizio con dettagli completi (sets, reps, etc.)
  - Azione: `status=draft → active`, `startDate=week1StartDate`, calcola `Week.startDate` per tutte le settimane, `publishedAt=NOW()`
  - Response: Dettaglio scheda pubblicata con date calcolate e configurazioni settimane (tipo + feedback)
  - **IMPORTANTE**: Dopo pubblicazione, scheda diventa **immutabile** - nessuna modifica permessa (PUT/DELETE bloccati)
- `DELETE`: Permesso solo su schede `status=draft` (schede active non eliminabili, solo archiviabili con `status=completed`)

### Schede / Programmi - Admin Override (Admin)
| Method   | Path                                     | Descrizione                                                   | Ruoli autorizzati |
| -------- | ---------------------------------------- | ------------------------------------------------------------- | ----------------- |
| `GET`    | `/api/admin/programs`                    | Lista TUTTE le schede di TUTTI i trainer (filtri disponibili) | admin             |
| `GET`    | `/api/admin/programs/[id]`               | Dettaglio scheda di qualsiasi trainer                         | admin             |
| `POST`   | `/api/admin/programs`                    | Crea scheda per qualsiasi trainee (bypass ownership trainer)  | admin             |
| `PUT`    | `/api/admin/programs/[id]`               | Modifica scheda di qualsiasi trainer (anche active/completed) | admin             |
| `DELETE` | `/api/admin/programs/[id]`               | Elimina scheda di qualsiasi trainer (anche active)            | admin             |
| `POST`   | `/api/admin/programs/[id]/publish`       | Pubblica scheda draft di qualsiasi trainer                    | admin             |
| `PUT`    | `/api/admin/trainer-trainee/[traineeId]` | Riassegna trainee a nuovo trainer (handover)                  | admin             |

**Note admin override**:
- **Admin bypassa restrizioni trainer**: Può modificare/eliminare schede anche se `status=active` o `completed` (eccezione per gestione emergenze)
- **Filtri GET /api/admin/programs**:
  - `?trainerId=uuid` — filtra per trainer specifico
  - `?traineeId=uuid` — filtra per trainee specifico
  - `?status=draft|active|completed` — filtra per stato scheda
  - `?search=keyword` — ricerca per titolo scheda
- **Riassegnazione trainee**: `PUT /api/admin/trainer-trainee/[traineeId]`
  - Corpo richiesta: `{ "newTrainerId": "uuid", "reason": "Handover motivazione" }`
  - Azione: DELETE vecchio `TrainerTrainee`, INSERT nuovo record con `newTrainerId`
  - Schede esistenti mantengono `trainerId` originale (paternità), nuovo trainer può visualizzarle (lettura) ma non modificarle
  - Nuovo trainer può creare nuove schede per trainee riassegnato
  - Response: `{ "traineeId", "oldTrainerId", "newTrainerId", "reassignedAt" }`
- **Validazione**: Admin può operare su schede immutabili, trainee/trainer non possono (403 Forbidden se provano)
- **Audit log**: Tutte le operazioni admin su schede e riassegnazioni vengono loggate per tracciabilità

**Casi d'uso admin**:
1. **Handover trainer**: Trainer lascia piattaforma → admin riassegna trainee + visualizza/modifica schede orfane
2. **Supporto emergenze**: Trainee segnala bug scheda → admin interviene direttamente
3. **Revisione qualità**: Admin supervisiona schede per QA metodologica
4. **Correzione errori critici**: Admin corregge scheda per conto trainer impegnato

### Feedback (Trainee)
| Method | Path                            | Descrizione                                     |
| ------ | ------------------------------- | ----------------------------------------------- |
| `GET`  | `/api/trainee/programs`         | Storico schede del trainee autenticato          |
| `GET`  | `/api/trainee/programs/current` | Scheda corrente attiva                          |
| `POST` | `/api/feedback`                 | Invia feedback su un WorkoutExercise            |
| `PUT`  | `/api/feedback/[id]`            | Modifica feedback esistente                     |
| `POST` | `/api/programs/[id]/submit`     | Invio esplicito feedback settimanali al trainer |

**Note workflow feedback**:
- `POST /api/feedback`: Il trainee registra feedback per un singolo `WorkoutExercise` (RPE, serie eseguite, note). Il feedback viene salvato come bozza.
- Feedback richiesti (`Week.feedbackRequested=true`):
  - Il trainee deve compilare feedback per TUTTI gli esercizi della settimana richiesta
  - I feedback vengono inviati al trainer quando richiesti (fine settimana specificata)
  - Sistema mostra badge "🔴 Feedback Obbligatorio"
- `POST /api/programs/[id]/submit`: Invio esplicito di tutti i feedback compilati al trainer
  - Il trainee può inviare feedback in qualsiasi momento durante la scheda
  - Corpo richiesta: `{ "weekId": "uuid" }` per specificare quali feedback inviare
  - Validazione: Verifica che tutti gli esercizi della settimana abbiano feedback compilato (se `feedbackRequested=true`)
  - Response: Conferma invio + notifica trainer
- **Transizione scheda active → completed**:
  - AUTOMATICA al termine dell'ultima settimana (endDate = startDate + durationWeeks * 7)
  - Job schedulato (cron daily) verifica endDate e aggiorna `status=completed`
  - Se ci sono feedback pendenti all'ultima settimana, la scheda passa comunque a 'completed'
  - Il trainee NON può più fornire feedback su schede 'completed'

### Massimali / Personal Records

#### Trainee (solo lettura)
| Method | Path                                | Descrizione                               |
| ------ | ----------------------------------- | ----------------------------------------- |
| `GET`  | `/api/trainee/records`              | Lista massimali del trainee autenticato   |
| `GET`  | `/api/trainee/records/[exerciseId]` | Storico massimali per esercizio specifico |

#### Trainer (CRUD sui propri trainee)
| Method   | Path                                            | Descrizione                   |
| -------- | ----------------------------------------------- | ----------------------------- |
| `GET`    | `/api/trainer/trainees/[id]/records`            | Lista massimali del trainee   |
| `GET`    | `/api/trainer/trainees/[id]/records/[recordId]` | Dettaglio massimale specifico |
| `POST`   | `/api/trainer/trainees/[id]/records`            | Aggiungi nuovo massimale      |
| `PUT`    | `/api/trainer/trainees/[id]/records/[recordId]` | Modifica massimale esistente  |
| `DELETE` | `/api/trainer/trainees/[id]/records/[recordId]` | Elimina massimale             |

### Reportistica (trainer)
| Method | Path                                       | Descrizione                                       |
| ------ | ------------------------------------------ | ------------------------------------------------- |
| `GET`  | `/api/programs/[id]/reports/sbd`           | Report SBD (FRQ, NBL, IM) per periodo specificato |
| `GET`  | `/api/programs/[id]/reports/training-sets` | Serie allenanti per gruppo muscolare (grafico)    |
| `GET`  | `/api/programs/[id]/reports/volume`        | Volume totale (serie × rip) per gruppo muscolare  |

## Validazione
- **Libreria**: **Zod** — schema type-safe riutilizzabili, integrazione nativa con React Hook Form.
- **Dove**: lato server (ogni API Route valida prima di operazioni DB) + lato client (React Hook Form per UX immediata).
- **Pattern**:
```typescript
// shared/schemas/exercise.ts
import { z } from 'zod'

export const muscleGroupSchema = z.object({
  name: z.string().min(2),
  coefficient: z.number().min(0).max(1) // 0.0 - 1.0
})

export const exerciseSchema = z.object({
  name: z.string().min(3, 'Nome minimo 3 caratteri'),
  description: z.string().optional(),
  youtubeUrl: z.string().url().regex(/youtube\.com|youtu\.be/, 'URL YouTube non valido'),
  type: z.enum(['fundamental', 'accessory']),
  movementPatternId: z.string().uuid(),
  muscleGroups: z.array(muscleGroupSchema).min(1, 'Almeno un gruppo muscolare'),
  notes: z.array(z.string()).optional()
})

export const workoutExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  sets: z.number().int().min(1).max(20),
  reps: z.union([
    z.number().int().min(1),           // numero singolo: 8
    z.string().regex(/^\d+-\d+$/),     // range: "8-10"
    z.string().regex(/^\d+\/\d+$/)     // intervallo: "6/8"
  ]),
  targetRpe: z.number().min(5.0).max(10.0).multipleOf(0.5).optional(),
  weightType: z.enum(['absolute', 'percentage_1rm', 'percentage_rm', 'percentage_previous']),
  weight: z.number().optional(),
  restTime: z.enum(['30s', '1m', '2m', '3m', '5m']),
  isWarmup: z.boolean().default(false),
  notes: z.string().optional(),
  order: z.number().int().min(1)
}).refine(
  (data) => {
    // Se weightType è percentage_previous, weight deve essere presente e rappresenta la percentuale relativa
    if (data.weightType === 'percentage_previous') {
      return data.weight !== undefined && data.weight !== null
    }
    return true
  },
  {
    message: 'weight è obbligatorio quando weightType è percentage_previous',
    path: ['weight']
  }
)

// Validazione lato backend per percentage_previous
// In POST/PUT /api/workout-exercises/[id]
export async function validateWorkoutExercise(data: WorkoutExercise, workoutId: string) {
  // Validazione Zod base
  const validated = workoutExerciseSchema.parse(data)
  
  // Se usa percentage_previous, verifica esistenza occorrenza precedente
  if (validated.weightType === 'percentage_previous') {
    const previousOccurrence = await prisma.workoutExercise.findFirst({
      where: {
        workoutId: workoutId,
        exerciseId: validated.exerciseId,
        order: { lt: validated.order }  // Cerca riga con order minore (precedente)
      },
      orderBy: { order: 'asc' }  // Prende la PRIMA occorrenza
    })
    
    if (!previousOccurrence) {
      throw new ValidationError(
        'Impossibile usare percentage_previous: nessuna occorrenza precedente dello stesso esercizio nel workout',
        'weight_type_invalid'
      )
    }
  }
  
  return validated
}

// Helper per calcolare peso effettivo
export async function calculateEffectiveWeight(
  workoutExercise: WorkoutExercise,
  traineeId: string
): Promise<number> {
  switch (workoutExercise.weightType) {
    case 'absolute':
      return workoutExercise.weight || 0
    
    case 'percentage_1rm':
    case 'percentage_rm': {
      // Recupera massimale da PersonalRecord
      const record = await prisma.personalRecord.findFirst({
        where: {
          traineeId,
          exerciseId: workoutExercise.exerciseId,
          reps: workoutExercise.weightType === 'percentage_1rm' ? 1 : undefined
        },
        orderBy: { recordDate: 'desc' }
      })
      if (!record) throw new Error('Massimale non trovato')
      const percentage = workoutExercise.weight || 0
      return record.weight * (percentage / 100)
    }
    
    case 'percentage_previous': {
      // Trova prima occorrenza dello stesso esercizio nel workout
      const previousOccurrence = await prisma.workoutExercise.findFirst({
        where: {
          workoutId: workoutExercise.workoutId,
          exerciseId: workoutExercise.exerciseId,
          order: { lt: workoutExercise.order }
        },
        orderBy: { order: 'asc' }
      })
      
      if (!previousOccurrence) {
        throw new Error('Nessuna occorrenza precedente trovata')
      }
      
      // Risolvi ricorsivamente il peso della riga precedente (potrebbe essere anch'essa percentage_previous!)
      const baseWeight = await calculateEffectiveWeight(previousOccurrence, traineeId)
      const percentageModifier = workoutExercise.weight || 0
      
      // Calcolo: baseWeight * (1 + percentage/100)
      // Esempio: weight=-5 → baseWeight * 0.95, weight=+10 → baseWeight * 1.10
      return baseWeight * (1 + percentageModifier / 100)
    }
    
    default:
      throw new Error('weightType non riconosciuto')
  }
}
  muscleGroups: z.array(muscleGroupSchema).min(1, 'Almeno un gruppo muscolare richiesto'),
  type: z.enum(['fundamental', 'accessory']),
  movementPattern: z.enum(['squat', 'horizontal_push', 'hip_extension', 'horizontal_pull', 'vertical_pull', 'other']),
  notes: z.array(z.string()).optional()
})

export const workoutExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  sets: z.number().int().min(1).max(20),
  reps: z.string(), // "8" o "6/8" o "8-10"
  targetRpe: z.number().min(5).max(10).multipleOf(0.5).optional(),
  weightType: z.enum(['absolute', 'percentage_1rm', 'percentage_rm']),
  weight: z.number().optional(),
  restTime: z.enum(['30s', '1m', '2m', '3m', '5m']),
  isWarmup: z.boolean(),
  notes: z.string().optional(),
  order: z.number().int()
})

export const setPerformedSchema = z.object({
  setNumber: z.number().int().min(1), // Numero serie progressivo (1, 2, 3, ...)
  reps: z.number().int().min(0).max(50), // Ripetizioni eseguite
  weight: z.number().min(0).max(500) // Peso in kg (max 500kg validazione sanity)
})

export const feedbackSchema = z.object({
  workoutExerciseId: z.string().uuid(),
  completed: z.boolean(),
  actualRpe: z.number().min(5).max(10).multipleOf(0.5).optional(),
  sets: z.array(setPerformedSchema).min(1, 'Almeno una serie richiesta'), // Array di serie eseguite
  notes: z.string().max(1000).optional() // Note testuali del trainee (max 1000 caratteri)
})

export const weekConfigSchema = z.object({
  weekType: z.enum(['normal', 'test', 'deload']),
  feedbackRequested: z.boolean()
})

export const personalRecordSchema = z.object({
  exerciseId: z.string().uuid(),
  reps: z.number().int().min(1).max(20), // 1 per 1RM, n per nRM
  weight: z.number().min(0),
  recordDate: z.string().datetime(),
  notes: z.string().optional()
})

// app/api/exercises/route.ts
export async function POST(request: Request) {
  const body = await request.json()
  const validated = exerciseSchema.parse(body) // throw se invalido
  // ... create in DB
}
```
- **Regole chiave**: 
  - youtubeUrl valido su Exercise
  - RPE range 5.0–10.0 (incrementi 0.5) su feedback e WorkoutExercise
  - muscleGroups array con coefficienti 0.0-1.0
  - weightType determina interpretazione campo weight
  - reps può essere stringa ("8", "6/8", "8-10")
  - sets array con setNumber, reps e weight per ogni serie eseguita (normalizzato in tabella SetPerformed)
  - ruoli validi (`admin`\|`trainer`\|`trainee`) all'assegnazione utente
  - relazioni referenziali (traineeId esiste, programId valido, exerciseId valido)

## Autorizzazione API
- Ogni route verifica la sessione utente e il ruolo prima di eseguire.
- Un trainee non può accedere a route `/api/users` o `/api/programs` in scrittura.
- Un trainer può leggere/modificare solo i trainee e le schede di propria competenza.

## Error handling

**Formato standard** (tutte le API Routes):
```typescript
// Successo (2xx)
{
  "data": { /* payload */ },
  "meta": { "timestamp": "2026-03-27T10:00:00Z" } // opzionale
}

// Errore (4xx, 5xx)
{
  "error": {
    "code": "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "INTERNAL_ERROR",
    "message": "Descrizione leggibile dell'errore",
    "details": { /* campo specifico se validation error */ } // opzionale
  }
}
```

**HTTP status code semantici**:
- `200 OK` — operazione riuscita
- `201 Created` — risorsa creata (POST)
- `400 Bad Request` — validation error (body malformato, Zod parse failed)
- `401 Unauthorized` — utente non autenticato (sessione mancante)
- `403 Forbidden` — utente autenticato ma ruolo non autorizzato
- `404 Not Found` — risorsa inesistente
- `500 Internal Server Error` — errore server non gestito

**Helper per consistency**:
```typescript
// lib/api-response.ts
export function apiSuccess<T>(data: T, status = 200) {
  return Response.json({ data }, { status })
}

export function apiError(code: string, message: string, status: number, details?: unknown) {
  return Response.json({ error: { code, message, details } }, { status })
}
```

## Rate Limiting

**Obiettivo**: Proteggere il backend da abusi, brute-force attacks, e sovraccarico involontario (es. double-click su bottoni).

**Strategia MVP** — **Approccio ibrido**:
- 🔐 **Endpoint auth (`/api/auth/*`)**: **Upstash Redis** (free tier 10K cmd/giorno, €0)
  - ✅ Persistenza tra cold start e istanze
  - ✅ Protezione brute-force garantita
  - ✅ Serverless-friendly, edge-compatible
- 📊 **Altri endpoint**: **Store in-memory** (Map in middleware)
  - ✅ Zero costi, sufficiente per 54 utenti
  - ⚠️ State volatile ma accettabile per non-auth endpoints

**Limiti definiti per endpoint**:

| Endpoint pattern            | Limite                  | Rationale                                          |
| --------------------------- | ----------------------- | -------------------------------------------------- |
| `/api/auth/*` (login)       | 5 tentativi / 15 minuti | Prevenzione brute-force password                   |
| `/api/auth/*` (signup)      | 3 registrazioni / ora   | Prevenzione spam account                           |
| `/api/feedback`             | 30 richieste / minuto   | Realistico: 6 esercizi × 5 serie = 30 feedback max |
| `/api/users` (POST)         | 20 creazioni / ora      | Trainer crea massimo 20 trainee/ora (ragionevole)  |
| API generiche (autenticate) | 100 richieste / minuto  | Uso normale applicazione                           |
| API generiche (pubbliche)   | 20 richieste / minuto   | Limita abuso su endpoint non autenticati           |

**Implementazione** (approccio ibrido):
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'

// Upstash Redis per auth endpoints (persistent, multi-instance)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

// In-memory store per altri endpoint (volatile ma sufficiente)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

async function checkAuthRateLimit(ip: string, endpoint: string, limit: number, windowSec: number): Promise<boolean> {
  const key = `ratelimit:auth:${endpoint}:${ip}`
  const attempts = await redis.incr(key)
  
  if (attempts === 1) {
    await redis.expire(key, windowSec) // TTL automatico
  }
  
  return attempts <= limit
}

function checkInMemoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(key)
  
  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  
  if (record.count >= limit) return false
  
  record.count++
  return true
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  
  // Rate limit AUTH con Upstash Redis (persistent)
  if (pathname.startsWith('/api/auth/login')) {
    const allowed = await checkAuthRateLimit(ip, 'login', 5, 900) // 5 tentativi / 15min
    if (!allowed) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Troppi tentativi. Riprova tra 15 minuti.' } },
        { status: 429 }
      )
    }
  }
  
  if (pathname.startsWith('/api/auth/signup')) {
    const allowed = await checkAuthRateLimit(ip, 'signup', 3, 3600) // 3 reg / 1h
    if (!allowed) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Troppe registrazioni. Riprova tra 1 ora.' } },
        { status: 429 }
      )
    }
  }
  
  // Rate limit ALTRI endpoint con in-memory (volatile ma OK)
  if (pathname.startsWith('/api/feedback')) {
    const userId = request.cookies.get('userId')?.value || ip
    const key = `feedback:${userId}`
    if (!checkInMemoryRateLimit(key, 30, 60 * 1000)) { // 30 req / 1min
      return NextResponse.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Troppi feedback inviati. Attendi 1 minuto.' } },
        { status: 429 }
      )
    }
  }
  
  // Rate limit generico autenticato (in-memory OK)
  if (pathname.startsWith('/api/') && request.cookies.has('userId')) {
    const userId = request.cookies.get('userId')!.value
    const key = `api:authenticated:${userId}`
    if (!checkInMemoryRateLimit(key, 100, 60 * 1000)) { // 100 req / 1min
      return NextResponse.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Limite richieste superato. Attendi 1 minuto.' } },
        { status: 429 }
      )
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*'
}
```

**Setup Upstash Redis** (auth endpoints):
1. Crea account gratuito su [upstash.com](https://upstash.com)
2. Create Redis Database → seleziona regione **EU (Ireland o Frankfurt)** per GDPR
3. Copia credenziali REST API (non Classic Redis)
4. Aggiungi a Vercel Environment Variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
5. Installa package: `npm install @upstash/redis`

**Capacità free tier Upstash**:
- 10.000 comandi/giorno = 416 comandi/ora
- 54 utenti × 5 login/giorno = 270 comandi auth/giorno
- **Margine: 97%** (ampiamente sufficiente)

**Evoluzione futura** (se scala cresce):
- Upstash Pro €10/mese per 100K cmd/giorno
- Oppure estendi in-memory endpoints a Redis se necessario
```

**Gestione frontend**:
```typescript
// lib/api-client.ts
export async function apiCall(endpoint: string, options?: RequestInit) {
  const response = await fetch(endpoint, options)
  
  if (response.status === 429) {
    const data = await response.json()
    toast.error(data.error.message) // Mostra messaggio user-friendly
    throw new Error('RATE_LIMIT_EXCEEDED')
  }
  
  return response
}
```

---

## Logging Strutturato

**Obiettivo**: Tracciare eventi applicativi, diagnosticare errori, monitorare performance.

**Libreria**: **Pino** — logger Node.js ad altissime performance, output JSON strutturato, vastissima coverage AI.

**Livelli abilitati per ambiente**:

| Livello | Development | Production | Descrizione                                         |
| ------- | ----------- | ---------- | --------------------------------------------------- |
| DEBUG   | ✅           | ❌          | Dettagli tecnici (query SQL, parametri interni)     |
| INFO    | ✅           | ✅          | Eventi normali rilevanti (login, creazione scheda)  |
| WARN    | ✅           | ✅          | Situazioni anomale non bloccanti (validazione edge) |
| ERROR   | ✅           | ✅          | Errori bloccanti (DB fail, validazione fallita)     |

**Setup Pino**:
```typescript
// lib/logger.ts
import pino from 'pino'

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => ({ level: label.toUpperCase() })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty', // Output colorato in dev
      options: { colorize: true }
    }
  })
})

export default logger
```

**Uso nei API Routes**:
```typescript
// app/api/programs/route.ts
import logger from '@/lib/logger'

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id')
  
  try {
    const body = await request.json()
    logger.info({ userId, action: 'CREATE_PROGRAM' }, 'User creating training program')
    
    const validated = programSchema.parse(body)
    logger.debug({ userId, programData: validated }, 'Program schema validated')
    
    const program = await prisma.trainingProgram.create({ data: validated })
    logger.info({ userId, programId: program.id }, 'Training program created successfully')
    
    return apiSuccess(program, 201)
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ userId, errors: error.errors }, 'Program validation failed')
      return apiError('VALIDATION_ERROR', 'Dati programma non validi', 400, error.errors)
    }
    
    logger.error({ userId, error: error.message, stack: error.stack }, 'Failed to create program')
    return apiError('INTERNAL_ERROR', 'Errore creazione programma', 500)
  }
}
```

**Pattern logging per eventi chiave**:
```typescript
// Login successo
logger.info({ userId, role, ip }, 'User logged in')

// Creazione trainee
logger.info({ trainerId, traineeId }, 'Trainer created new trainee')

// Feedback inviato
logger.info({ traineeId, workoutExerciseId, rpe: feedback.actualRpe }, 'Trainee submitted feedback')

// Errore DB
logger.error({ query, error: error.message }, 'Database query failed')

// Warning: trainee senza massimali
logger.warn({ traineeId, exerciseId }, 'No personal records found for exercise')
```

**Integrazione Sentry per Error Tracking**:

**Setup Sentry** (free tier: 5K eventi/mese):
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% transaction sampling
  enabled: process.env.NODE_ENV === 'production'
})
```

**Cattura errori con context**:
```typescript
// app/api/programs/route.ts
import * as Sentry from '@sentry/nextjs'

export async function POST(request: Request) {
  try {
    // ... logica
  } catch (error) {
    // Log con Pino
    logger.error({ userId, error }, 'Program creation failed')
    
    // Invia a Sentry con context
    Sentry.captureException(error, {
      tags: { endpoint: '/api/programs', method: 'POST' },
      user: { id: userId },
      extra: { requestBody: body }
    })
    
    return apiError('INTERNAL_ERROR', 'Errore server', 500)
  }
}
```

**Dashboard Sentry features**:
- 🔔 **Alerting**: Email/Slack su errori critici (>10 occorrenze/ora)
- 📊 **Performance monitoring**: Transaction duration, slow API routes
- 🐛 **Source maps**: Stack trace leggibili (file/riga originali)
- 👥 **User impact**: Quanti utenti affetti da un errore
- 📈 **Release tracking**: Correlazione errori con deploy

**Visualizzazione log in Vercel**:
- Pino output JSON → **Vercel Dashboard** (`/deployments/[id]/logs`)
- Filtri: per severity, per endpoint, per timestamp
- Retention: 1 giorno (free), 7 giorni (Pro)
- Per retention maggiore: Vercel Log Drains → Datadog/Logtail (opzionale post-MVP)

**Best practices logging**:
1. **Non loggare dati sensibili**: password, token, dati GDPR non necessari
2. **Usa context ricco**: userId, action, timestamp sempre presenti
3. **Log errori con stack trace**: `error.message` + `error.stack`
4. **Evita log eccessivi**: no DEBUG in produzione (noise + costi)
5. **Monitora log volume**: Sentry quota = 5K/mese, superamento = rate limiting eventi