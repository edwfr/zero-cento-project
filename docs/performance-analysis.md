# Performance Analysis — ZeroCento Platform

> Data analisi: 24 aprile 2026  
> Trigger: lentezza diffusa dell'applicativo, esempio tracciato: operazione `copy-week` del trainer

---

## 1. Metodologia

L'analisi è stata condotta tramite:
- ispezione del network log del browser (screenshot allegato: tre fetch, 2.50s + 2.89s + 1.76s)
- lettura del codice sorgente di middleware, route handler, client components

---

## 2. Flusso tracciato: `copy-week`

Un click su **"Copia settimana"** produce 3 chiamate API sequenziali:

```
POST /api/programs/{id}/copy-week          → 2.50s
GET  /api/programs/{id}                    → 2.89s
GET  /api/personal-records?traineeId=...   → 1.76s
```

**Totale percepito: ~7s** per un'operazione concettualmente semplice (copia esercizi da una settimana all'altra).

---

## 3. Problemi identificati

### 3.1 — CRITICO: `getUser()` chiamato due volte per ogni request

**File:** `src/middleware.ts` · `src/lib/auth.ts`

`supabase.auth.getUser()` effettua una **richiesta di rete ai server Supabase Auth** per validare il JWT.  
Viene eseguito **due volte** per ogni API call:

1. Nel middleware (`middleware.ts:191`) — per decidere se bloccare la request
2. Nel route handler (`auth.ts:41`) — dentro `requireRole()` → `requireAuth()` → `getSession()`

La `cache()` di React applicata a `getSession` **non aiuta**: middleware e route handler girano in contesti request separati, quindi la cache non è condivisa.

```
Ogni API request = 2 × getUser() ≈ 2 × 200–400ms verso Supabase
```

Moltiplicato per le 3 chiamate del flusso `copy-week`:

```
6 × getUser() ≈ 1.2–2.4s di latenza solo per l'autenticazione
```

**Root cause:** il middleware valida il token per tutte le route, incluse le `/api/*`, ma i route handler hanno già la propria logica di autenticazione che restituisce 401/403. La doppia validazione è ridondante.

**Fix:** rimuovere la validazione token dal middleware per le route `/api/*`. Il middleware può limitarsi a:
- redirezionare verso `/login` per le route page non autenticate
- applicare rate limiting
- refreshare i cookie di sessione

---

### 3.2 — Over-fetching nel backend di `copy-week`

**File:** `src/app/api/programs/[id]/copy-week/route.ts`

Per copiare gli esercizi da una settimana alla successiva, il route handler carica **l'intero programma**:

```typescript
await prisma.trainingProgram.findUnique({
    where: { id: programId },
    include: {
        weeks: {
            include: {
                workouts: {
                    include: { workoutExercises: { ... } }
                }
            }
        }
    }
})
```

Per un programma di 12 settimane con 4 workout/settimana e 8 esercizi/workout, questa query carica **~384 record** quando ne servono al massimo ~64 (2 settimane × 4 workout × 8 esercizi).

**Fix:** caricare solo le due settimane coinvolte (`sourceWeekId` e la successiva) con query mirate.

---

### 3.3 — Full-reload del programma dopo ogni modifica (client)

**File:** `src/app/trainer/programs/[id]/edit/_content.tsx`

Ogni mutazione (copia settimana, salva esercizio, aggiorna workout) termina con:

```typescript
await fetchProgram({ showLoading: false })
```

`fetchProgram` ricarica `GET /api/programs/{id}` che include la struttura completa:

```
program → weeks → workouts → workoutExercises 
  → exercise → movementPattern → movementPatternColors
             → exerciseMuscleGroups → muscleGroup
```

Per un programma medio questa è la query più pesante dell'intera applicazione, ed è eseguita dopo **ogni singola azione dell'utente**.

**Fix:** applicare aggiornamenti ottimistici o aggiornamenti parziali dello stato locale, evitando il reload completo. In alternativa, adottare TanStack Query con `invalidateQueries` granulare per sfruttare la cache.

---

### 3.4 — Rate limiting Redis applicato anche alle mutation

**File:** `src/middleware.ts`

Il blocco:

```typescript
if (
    pathname === '/api/programs' ||
    pathname.startsWith('/api/programs/')
) {
    return { limit: 100, windowMs: 60 * 1000, useRedis: true }
}
```

applica Redis rate limiting a **tutti** i metodi HTTP su `/api/programs/*`, inclusi `POST`, `PATCH`, `DELETE`.  
Ogni mutation aggiunge una richiesta di rete verso Upstash Redis (~20–50ms) che non ha utilità per le operazioni di scrittura (il rate limiting sulle write ha senso solo per prevenire abusi, non per operazioni utente normali su risorse proprie).

**Fix:** applicare Redis rate limiting solo ai metodi `GET`, oppure escludere le write operation dalla finestra Redis.

---

### 3.5 — Query ridondanti in `personal-records`

**File:** `src/app/api/personal-records/route.ts`

Quando un trainer richiede i record di un trainee specifico (`?traineeId=...`), il route handler esegue **due query separate**:

1. `findMany` — recupera tutti i trainee del trainer (per costruire il filtro `traineeId IN [...]`)
2. `findUnique` — verifica che il `traineeId` richiesto appartenga al trainer

La seconda query è ridondante: basta un `findFirst` con `where: { trainerId, traineeId }` che combina le due verifiche in una.

**Fix:**

```typescript
// Invece di due query:
const traineeRelations = await prisma.trainerTrainee.findMany({ where: { trainerId } })
const isManaged = await prisma.trainerTrainee.findUnique({ where: { traineeId } })

// Una sola:
const relation = await prisma.trainerTrainee.findFirst({
    where: { trainerId: session.user.id, traineeId },
})
if (!relation) return apiError('FORBIDDEN', ...)
```

---

## 4. Riepilogo impatti

| # | Problema | Latenza stimata | Scope |
|---|---|---|---|
| 3.1 | Double `getUser()` (middleware + route) | **+400–800ms per request** | **Ogni API call** |
| 3.3 | Full-reload programma dopo ogni modifica | **+1.5–3s per azione** | Ogni modifica al programma |
| 3.2 | Over-fetch backend copy-week | +100–500ms | `/api/programs/{id}/copy-week` |
| 3.4 | Redis rate limiting su mutation | +20–50ms per request | Ogni POST/PATCH su `/api/programs/*` |
| 3.5 | Query ridondanti personal-records | +1 query DB extra | `/api/personal-records` |

---

## 5. Piano di fix (priorità)

| Priorità | Fix | Impatto | Effort |
|---|---|---|---|
| 1 | Rimuovere `getUser()` dal middleware per `/api/*` | Massimo — dimezza latenza auth su ogni call | Basso |
| 2 | Full-reload → aggiornamento stato locale ottimistico | Alto — elimina 2.89s dal flusso copy-week | Medio |
| 3 | Over-fetch backend copy-week | Medio | Basso |
| 4 | Escludere mutation da Redis rate limiting | Basso-medio | Basso |
| 5 | Consolidare query personal-records | Basso | Basso |
