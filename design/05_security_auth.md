# Security & Authentication

## Autenticazione
- **Provider**: **Supabase Auth** — gestione completa autenticazione integrata con DB.
- **Metodo primario**: **Email + password** per MVP.
- **Metodi futuri** (opzionali post-MVP): OAuth (Google, GitHub), Magic Link.
- **Sessione**: JWT gestito da Supabase (access token + refresh token).
- **Storage sessione**: Cookie HTTP-only (secure, non accessibile da JS client).

**Flusso autenticazione**:
```typescript
// 1. Login
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
})

// 2. Supabase emette JWT e refresh token
// 3. Redirect a dashboard ruolo (verifica user.role da tabella User)
```

**Integrazione con Prisma**:
- Supabase Auth gestisce tabella `auth.users` (email, password hash)
- Prisma gestisce tabella `public.User` (id, name, role, ...)
- Collegamento: `User.id` (UUID) = `auth.users.id` (trigger Supabase per sync)

## Autorizzazione
- **Ruoli**: `admin` · `coach` · `trainee`.
- **Matrice permessi**:

| Risorsa                  | admin   | coach              | trainee             |
| ------------------------ | ------- | ------------------ | ------------------- |
| Gestione utenti (CRUD)   | ✅       | ❌                  | ❌                   |
| Libreria esercizi        | lettura | CRUD (propri)      | lettura             |
| Schede                   | lettura | CRUD (proprie)     | lettura (assegnate) |
| Feedback                 | lettura | lettura            | CRUD (propri)       |
| Monitoraggio avanzamento | ✅       | ✅ (propri trainee) | ❌                   |

- **Isolamento dati**: un coach vede e modifica solo trainee e schede a lui assegnati; un trainee vede solo le proprie schede.

## Protezione API
- Ogni API Route / Server Action verifica la sessione attiva e il ruolo prima di qualsiasi operazione.
- Middleware Next.js (`middleware.ts`) per proteggere tutte le route `/admin/*`, `/coach/*`, `/trainee/*` con redirect a `/login` se non autenticato.
- Validazione input lato server su tutti gli endpoint (❓ **OD-19** — Zod).
- ❓ **OD-21** — rate limiting: valutare Vercel Edge Middleware o provider auth.

## Gestione segreti
- **Vercel Environment Variables** per variabili sensibili:
  - `DATABASE_URL` / `DIRECT_URL` (Supabase connection strings)
  - `NEXT_PUBLIC_SUPABASE_URL` (pubblico, safe)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (pubblico, Row Level Security protegge)
  - `SUPABASE_SERVICE_ROLE_KEY` (privato, solo server-side, bypass RLS)
- **Non committare mai** `.env.local` in Git (già in `.gitignore`).
- ❓ **OD-31** — per scenari enterprise valutare HashiCorp Vault (non necessario MVP).

## Compliance
- ❓ **OD-32** — verificare requisiti GDPR (dato personale trainee: nome, email, dati allenamento).
