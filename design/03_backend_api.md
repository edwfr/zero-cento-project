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
| Method | Path                      | Descrizione                             | Ruoli |
| ------ | ------------------------- | --------------------------------------- | ----- |
| `POST` | `/api/auth/[...nextauth]` | Handler NextAuth (login/logout/session) | tutti |

### Utenti (Admin + Coach)
| Method   | Path                         | Descrizione                                                      | Ruoli autorizzati |
| -------- | ---------------------------- | ---------------------------------------------------------------- | ----------------- |
| `GET`    | `/api/users`                 | Lista utenti (admin: tutti, coach: solo propri trainee)          | admin, coach      |
| `POST`   | `/api/users`                 | Crea utente (admin: coach/trainee, coach: solo trainee)          | admin, coach      |
| `GET`    | `/api/users/[id]`            | Dettaglio utente (admin: tutti, coach: solo propri trainee)      | admin, coach      |
| `PUT`    | `/api/users/[id]`            | Modifica utente (admin: tutti campi, coach: solo propri trainee) | admin, coach      |
| `DELETE` | `/api/users/[id]`            | Elimina utente (admin: tutti, coach: solo propri trainee)        | admin, coach      |
| `PATCH`  | `/api/users/[id]/deactivate` | Disabilita trainee (admin: tutti, coach: solo propri)            | admin, coach      |
| `PATCH`  | `/api/users/[id]/activate`   | Riabilita trainee (admin: tutti, coach: solo propri)             | admin, coach      |

**Note autorizzazione creazione**:
- `POST /api/users` con `role=coach`: **solo admin**
- `POST /api/users` con `role=trainee`: **admin o coach** (coach crea i propri atleti)
- `POST /api/users` con `role=admin`: **bloccato** (admin creabile solo via seed/migration iniziale)
- Coach che crea trainee: il sistema crea automaticamente record in `CoachTrainee` per l'associazione

**Note autorizzazione disabilitazione**:
- `PATCH /api/users/[id]/deactivate` e `/activate`: 
  - Admin: può disabilitare qualsiasi trainee
  - Coach: può disabilitare **solo trainee a lui assegnati** (verifica esistenza record `CoachTrainee`)
  - Se coach tenta disabilitare trainee di altro coach: **403 Forbidden**
  - Trainee disabilitato (`isActive=false`): login bloccato con messaggio "Account disabilitato"

### Esercizi (Coach)
| Method   | Path                  | Descrizione                                            |
| -------- | --------------------- | ------------------------------------------------------ |
| `GET`    | `/api/exercises`      | Lista libreria esercizi (filtri: tipo, schema motorio) |
| `POST`   | `/api/exercises`      | Crea esercizio                                         |
| `GET`    | `/api/exercises/[id]` | Dettaglio esercizio                                    |
| `PUT`    | `/api/exercises/[id]` | Modifica esercizio                                     |
| `DELETE` | `/api/exercises/[id]` | Elimina esercizio                                      |

### Schede / Programmi (Coach)
| Method   | Path                          | Descrizione                           |
| -------- | ----------------------------- | ------------------------------------- |
| `GET`    | `/api/programs`               | Lista schede (filtrabili per trainee) |
| `POST`   | `/api/programs`               | Crea scheda                           |
| `GET`    | `/api/programs/[id]`          | Dettaglio scheda completa             |
| `PUT`    | `/api/programs/[id]`          | Modifica scheda                       |
| `DELETE` | `/api/programs/[id]`          | Elimina scheda                        |
| `GET`    | `/api/programs/[id]/progress` | Avanzamento + feedback trainee        |

### Feedback (Trainee)
| Method | Path                            | Descrizione                            |
| ------ | ------------------------------- | -------------------------------------- |
| `GET`  | `/api/trainee/programs`         | Storico schede del trainee autenticato |
| `GET`  | `/api/trainee/programs/current` | Scheda corrente attiva                 |
| `POST` | `/api/feedback`                 | Invia feedback su un WorkoutExercise   |
| `PUT`  | `/api/feedback/[id]`            | Modifica feedback esistente            |

### Massimali / Personal Records (Trainee + Coach)
| Method   | Path                                | Descrizione                               |
| -------- | ----------------------------------- | ----------------------------------------- |
| `GET`    | `/api/trainee/records`              | Lista massimali del trainee autenticato   |
| `GET`    | `/api/trainee/records/[exerciseId]` | Storico massimali per esercizio specifico |
| `POST`   | `/api/trainee/records`              | Aggiungi nuovo massimale                  |
| `PUT`    | `/api/trainee/records/[id]`         | Modifica massimale esistente              |
| `DELETE` | `/api/trainee/records/[id]`         | Elimina massimale                         |
| `GET`    | `/api/coach/trainees/[id]/records`  | Coach visualizza massimali del trainee    |

### Reportistica (Coach + Trainee)
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
  reps: z.number().int().min(0),
  weight: z.number().min(0)
})

export const feedbackSchema = z.object({
  workoutExerciseId: z.string().uuid(),
  completed: z.boolean(),
  actualRpe: z.number().min(5).max(10).multipleOf(0.5).optional(),
  setsPerformed: z.array(setPerformedSchema),
  notes: z.string().optional()
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
  - setsPerformed array con reps e weight per ogni serie
  - ruoli validi (`admin`\|`coach`\|`trainee`) all'assegnazione utente
  - relazioni referenziali (traineeId esiste, programId valido, exerciseId valido)

## Autorizzazione API
- Ogni route verifica la sessione utente e il ruolo prima di eseguire.
- Un trainee non può accedere a route `/api/users` o `/api/programs` in scrittura.
- Un coach può leggere/modificare solo i trainee e le schede di propria competenza.

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