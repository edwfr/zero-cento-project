# Security & Authentication

## Autenticazione
- **Metodo**: ❓ **OD-28** — email + password (opzione primaria); OAuth social login da valutare.
- **Provider**: ❓ **OD-29** — NextAuth.js (ora Auth.js) consigliato per integrazione nativa Next.js; alternativa: Clerk.
- **Sessione**: JWT o sessione server-side gestita dal provider scelto.
- **Flusso**: login → verifica credenziali → emissione sessione → redirect alla dashboard del ruolo.

## Autorizzazione
- **Ruoli**: `admin` · `coach` · `trainee`.
- **Matrice permessi**:

| Risorsa | admin | coach | trainee |
|---|---|---|---|
| Gestione utenti (CRUD) | ✅ | ❌ | ❌ |
| Libreria esercizi | lettura | CRUD (propri) | lettura |
| Schede | lettura | CRUD (proprie) | lettura (assegnate) |
| Feedback | lettura | lettura | CRUD (propri) |
| Monitoraggio avanzamento | ✅ | ✅ (propri trainee) | ❌ |

- **Isolamento dati**: un coach vede e modifica solo trainee e schede a lui assegnati; un trainee vede solo le proprie schede.

## Protezione API
- Ogni API Route / Server Action verifica la sessione attiva e il ruolo prima di qualsiasi operazione.
- Middleware Next.js (`middleware.ts`) per proteggere tutte le route `/admin/*`, `/coach/*`, `/trainee/*` con redirect a `/login` se non autenticato.
- Validazione input lato server su tutti gli endpoint (❓ **OD-19** — Zod).
- ❓ **OD-21** — rate limiting: valutare Vercel Edge Middleware o provider auth.

## Gestione segreti
- Le variabili d'ambiente (DB connection string, auth secret, API keys) sono gestite tramite **Vercel Environment Variables** (non committate in repository).
- ❓ **OD-31** — per ambienti enterprise valutare Vercel Secrets Manager o HashiCorp Vault.

## Compliance
- ❓ **OD-32** — verificare requisiti GDPR (dato personale trainee: nome, email, dati allenamento).
