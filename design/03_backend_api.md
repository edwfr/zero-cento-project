# Backend & API

## Pattern backend
- **Runtime**: Next.js API Routes (App Router — `app/api/`) su Vercel Serverless Functions.
- **Stile API**: ❓ **OD-18** — REST (default) o tRPC per type-safety end-to-end; Server Actions per mutazioni da form.
- Nessun servizio backend separato: Next.js è il BFF.

## Gruppi di endpoint principali

### Auth
| Method | Path | Descrizione | Ruoli |
|---|---|---|---|
| `POST` | `/api/auth/[...nextauth]` | Handler NextAuth (login/logout/session) | tutti |

### Utenti (Admin)
| Method | Path | Descrizione |
|---|---|---|
| `GET` | `/api/users` | Lista utenti |
| `POST` | `/api/users` | Crea utente |
| `GET` | `/api/users/[id]` | Dettaglio utente |
| `PUT` | `/api/users/[id]` | Modifica utente / ruolo |
| `DELETE` | `/api/users/[id]` | Elimina utente |

### Esercizi (Coach)
| Method | Path | Descrizione |
|---|---|---|
| `GET` | `/api/exercises` | Lista libreria esercizi |
| `POST` | `/api/exercises` | Crea esercizio |
| `GET` | `/api/exercises/[id]` | Dettaglio esercizio |
| `PUT` | `/api/exercises/[id]` | Modifica esercizio |
| `DELETE` | `/api/exercises/[id]` | Elimina esercizio |

### Schede / Programmi (Coach)
| Method | Path | Descrizione |
|---|---|---|
| `GET` | `/api/programs` | Lista schede (filtrabili per trainee) |
| `POST` | `/api/programs` | Crea scheda |
| `GET` | `/api/programs/[id]` | Dettaglio scheda completa |
| `PUT` | `/api/programs/[id]` | Modifica scheda |
| `DELETE` | `/api/programs/[id]` | Elimina scheda |
| `GET` | `/api/programs/[id]/progress` | Avanzamento + feedback trainee |

### Feedback (Trainee)
| Method | Path | Descrizione |
|---|---|---|
| `GET` | `/api/trainee/programs` | Storico schede del trainee autenticato |
| `GET` | `/api/trainee/programs/current` | Scheda corrente attiva |
| `POST` | `/api/feedback` | Invia feedback su un WorkoutExercise |
| `PUT` | `/api/feedback/[id]` | Modifica feedback esistente |

## Validazione
- **Dove**: lato server, prima di qualsiasi operazione DB.
- **Schema**: ❓ **OD-19** — Zod consigliato (compatibile con React Hook Form e tRPC).
- **Regole chiave**: formato youtubeUrl valido su Exercise; RPE nel range 1–10; ruoli validi all'assegnazione utente.

## Autorizzazione API
- Ogni route verifica la sessione utente e il ruolo prima di eseguire.
- Un trainee non può accedere a route `/api/users` o `/api/programs` in scrittura.
- Un coach può leggere/modificare solo i trainee e le schede di propria competenza.

## Error handling
- ❓ **OD-20** — formato standard da definire. Proposta:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Accesso negato per questo ruolo."
  }
}
```
- HTTP status code semantici: 400 validation, 401 unauthenticated, 403 unauthorized, 404 not found, 500 server error.