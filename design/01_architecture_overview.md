# Architecture Overview

## Stack tecnologico
- **Framework**: Next.js (App Router) — gestisce sia il frontend che il backend.
- **Runtime backend**: Next.js API Routes / Server Actions (Node.js serverless su Vercel).
- **Database**: **Supabase PostgreSQL** — connection pooling (PgBouncer) incluso, dashboard admin, free tier generoso (500MB DB).
- **ORM**: **Prisma** — type-safety automatica, migrations robuste, coverage AI eccellente.
- **Hosting / Cloud**: Vercel (frontend + serverless functions).
- **Autenticazione**: **Supabase Auth** — email/password, OAuth integrato, gestione sessioni JWT.

## Architettura logica

```
┌─────────────────────────────────────────────────────┐
│                     Browser / Mobile                │
│            (Next.js React — App Router)             │
├─────────────────────────────────────────────────────┤
│          Next.js Server  (Vercel Serverless)         │
│   ┌──────────────┐   ┌────────────────────────┐     │
│   │ Server       │   │ API Routes             │     │
│   │ Components / │   │ /api/*                 │     │
│   │ Actions      │   │ (REST o tRPC — OD-18)  │     │
│   └──────────────┘   └────────────────────────┘     │
├─────────────────────────────────────────────────────┤
│              Database  (OD-24 — PostgreSQL?)         │
└─────────────────────────────────────────────────────┘
```

Next.js funge da BFF (Backend for Frontend): non esiste un servizio backend separato.

## Componenti principali
- **Frontend responsibilities**: rendering pagine per ruolo (admin/coach/trainee), gestione sessione utente, visualizzazione schede e form feedback.
- **Backend responsibilities**: autenticazione, autorizzazione per ruolo, logica di business (CRUD esercizi, schede, feedback), validazione input.
- **Data layer responsibilities**: persistenza entità di dominio (utenti, esercizi, schede, feedback), integrità referenziale.

## Assunzioni chiave
- L'applicazione ha un volume utenti molto ridotto (≤54 utenti). Non è necessario scaling orizzontale aggressivo nell'orizzonte iniziale.
- I video degli esercizi non sono hostati internamente: si usa l'embed YouTube (nessun costo di storage video).
- Un singolo repository Next.js copre tutto (frontend + backend).

## Rischi architetturali noti

### 1. Cold Start Serverless (Rischio BASSO con Vercel Pro)
**Cos'è**: Quando una funzione serverless non riceve richieste per un periodo, viene "ibernata". La richiesta successiva deve riavviare il container (300-1000ms di latenza aggiuntiva).

**Impatto sul progetto**:
- Con **Vercel Pro**: cold start meno frequenti (funzioni restano calde più a lungo) e più rapidi
- Scala utenti ridotta (54 utenti) → bassa probabilità di cold start simultanei
- App fitness → latenza 1-2 secondi accettabile (non real-time)

**Mitigazioni**:
- ✅ Piano Vercel Pro già previsto → riduce drasticamente il problema
- Opzionale: Edge Runtime per route critiche (cold start ~50-200ms)
- Opzionale: SSG per pagine stabili (lista esercizi)

**Conclusione**: Non critico per l'MVP data la scala ridotta e il piano Pro.

---

### 2. DB Connection Pooling (Rischio MEDIO - da configurare correttamente)
**Il problema**: Ogni istanza serverless apre una connessione DB. PostgreSQL ha limiti (es. Neon free ~100 connessioni, piano pagamento ~200-500). Rischio: "Too many connections" error.

**Esempio**:
```
20 trainee contemporanei → 20 istanze attive
Ogni trainee apre 3 pagine → 60 connessioni DB
Con traffico normale + cold start → rischio saturazione
```

**Soluzioni consigliate** (in ordine di priorità):
1. **Connection Pooler integrato** (es. Supabase Pooler, Neon con pooling)
   - ✅ **Soluzione raccomandata**: configurare `DATABASE_URL` con pooling endpoint
   - Zero configurazione aggiuntiva, incluso nei servizi managed
   
2. **Prisma connection limit**:
   ```typescript
   datasource db {
     connectionLimit = 5  // Max 5 connessioni per istanza
   }
   ```
   - Mitiga il problema ma non lo risolve completamente

3. **Prisma Accelerate** (opzionale per futuro scaling):
   - Connection pooling globale + query caching
   - Costo: ~$20-50/mese — valutare se scala supera 100 utenti attivi

**Raccomandazione MVP**: Usare **Supabase** o **Neon** con connection pooling incluso + Prisma connectionLimit=5. Monitorare metriche in produzione.

---

### 3. Dipendenza esterna
- **YouTube**: Video degli esercizi su piattaforma esterna → rischio disponibilità fuori dal nostro controllo
- **Mitigazione**: Gestire gracefully embed fallback (mostrare placeholder se video non disponibile)
