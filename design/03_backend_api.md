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

### Utenti (Admin)
| Method   | Path              | Descrizione             |
| -------- | ----------------- | ----------------------- |
| `GET`    | `/api/users`      | Lista utenti            |
| `POST`   | `/api/users`      | Crea utente             |
| `GET`    | `/api/users/[id]` | Dettaglio utente        |
| `PUT`    | `/api/users/[id]` | Modifica utente / ruolo |
| `DELETE` | `/api/users/[id]` | Elimina utente          |

### Esercizi (Coach)
| Method   | Path                  | Descrizione             |
| -------- | --------------------- | ----------------------- |
| `GET`    | `/api/exercises`      | Lista libreria esercizi |
| `POST`   | `/api/exercises`      | Crea esercizio          |
| `GET`    | `/api/exercises/[id]` | Dettaglio esercizio     |
| `PUT`    | `/api/exercises/[id]` | Modifica esercizio      |
| `DELETE` | `/api/exercises/[id]` | Elimina esercizio       |

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

## Validazione
- **Libreria**: **Zod** — schema type-safe riutilizzabili, integrazione nativa con React Hook Form.
- **Dove**: lato server (ogni API Route valida prima di operazioni DB) + lato client (React Hook Form per UX immediata).
- **Pattern**:
```typescript
// shared/schemas/exercise.ts
import { z } from 'zod'

export const exerciseSchema = z.object({
  name: z.string().min(3, 'Nome minimo 3 caratteri'),
  youtubeUrl: z.string().url().regex(/youtube\.com|youtu\.be/, 'URL YouTube non valido'),
  category: z.enum(['strength', 'cardio', 'mobility'])
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
  - RPE range 1–10 su feedback
  - ruoli validi (`admin`\|`coach`\|`trainee`) all'assegnazione utente
  - relazioni referenziali (traineeId esiste, programId valido)

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