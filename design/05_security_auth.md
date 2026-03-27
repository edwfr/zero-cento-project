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

## Compliance GDPR

### Dati personali raccolti
L'app raccoglie e processa dati personali soggetti a GDPR:
- **Dati identificativi**: nome, cognome, email
- **Dati performance**: RPE effettivo, note allenamenti, feedback esercizi
- **Dati relazionali**: coach-trainee assignments
- **Dati tecnici**: IP address (logs Vercel), session cookies (Supabase Auth)

### Base legale (Art. 6 GDPR)
- **Consenso esplicito** (Art. 6.1.a): utente accetta termini e privacy policy al signup
- **Esecuzione contratto** (Art. 6.1.b): servizio coaching richiede processing dati performance

### Requisiti minimi MVP

#### 1. Cookie Consent Banner
Obbligatorio per cookie non strettamente necessari:
```typescript
// Componente CookieConsent.tsx
// Mostra banner al primo accesso
// Opzioni: "Accetta tutti" | "Solo necessari" | "Personalizza"
// Cookie essenziali: Supabase auth JWT (legittimo interesse)
// Cookie analytics: Google Analytics (consenso richiesto)
```
**Libreria consigliata**: `react-cookie-consent` (coverage AI alta)

#### 2. Privacy Policy (obbligatoria)
Documento accessibile da `/privacy-policy` contenente:
- Identità data controller (tua società/nome)
- Tipologie dati raccolti e finalità
- Base legale per processing
- Data processors (Supabase Inc., Vercel Inc.)
- Retention period (vedi sotto)
- Diritti utente (accesso, rettifica, cancellazione, portabilità)
- Modalità esercizio diritti (email contatto)
- Data ultima modifica

**Template consigliato**: [Iubenda](https://www.iubenda.com) o [TermsFeed](https://www.termsfeed.com) (generatori GDPR-compliant)

#### 3. Terms of Service
Documento `/terms` con:
- Condizioni uso servizio
- Limitazioni responsabilità
- Risoluzione contratto

#### 4. Data Retention Policy
| Dato                  | Retention                         | Rationale                        |
| --------------------- | --------------------------------- | -------------------------------- |
| Account utente attivo | Indefinito fino a cancellazione   | Necessario per servizio          |
| Feedback allenamenti  | 2 anni da completamento programma | Storico coach + trainee          |
| Account cancellato    | Anonimizzazione immediata         | GDPR Art. 17                     |
| Logs sistema          | 30 giorni                         | Troubleshooting (Vercel default) |

#### 5. Right to Erasure ("Delete Account")
Funzionalità obbligatoria:
```typescript
// /account/settings → "Elimina account" button
// Triggera:
// 1. Hard delete da auth.users (Supabase)
// 2. Anonimizzazione User record (sostituire nome/email con "Deleted User [UUID]")
// 3. Mantenere feedback anonimizzati per statistiche coach (legittimo interesse)
// Oppure:
// Cascade delete completo se non necessario storico
```

**Implementazione Prisma**:
```prisma
model User {
  id       String  @id @default(uuid())
  email    String? @unique  // nullable dopo deletion
  name     String
  isDeleted Boolean @default(false)
  // ... relations con onDelete: Cascade o SetNull
}
```

#### 6. Data Portability (Art. 20)
API endpoint per export dati utente in formato machine-readable:
```typescript
// GET /api/user/export-data
// Ritorna JSON:
{
  "user": { "name", "email", "createdAt" },
  "programs": [...],
  "feedback": [...]
}
```
Opzionale MVP, implementabile post-launch.

#### 7. Data Processing Agreement (DPA)
- **Supabase**: DPA disponibile [qui](https://supabase.com/dpa) (GDPR-compliant, data in EU se scegli region EU)
- **Vercel**: DPA disponibile [qui](https://vercel.com/legal/dpa)
- **Importante**: Scegliere **Supabase region EU** (es. `eu-central-1`) per dati in UE

#### 8. Breach Notification
In caso di data breach, obbligo notifica entro **72 ore**:
- A autorità (Garante Privacy se Italia)
- Agli utenti interessati se rischio alto

**Mitigazione**: Encryption at rest (Supabase default) + HTTPS + audit logs.

### Checklist implementazione MVP

- [ ] Scegliere **Supabase region EU** (GDPR-friendly)
- [ ] Implementare **Cookie Consent Banner** (react-cookie-consent)
- [ ] Scrivere **Privacy Policy** (template Iubenda/TermsFeed)
- [ ] Scrivere **Terms of Service**
- [ ] Link policy in footer (privacy, terms, cookie policy)
- [ ] Checkbox "Accetto Privacy Policy e Terms" in signup form
- [ ] Implementare **Delete Account** feature
- [ ] Configurare **data retention** automatico (cron job opzionale, o manuale)
- [ ] Vercel Environment Variables per **email contatto DPO** (Data Protection Officer, anche te stesso)
- [ ] Documentare **data retention** in privacy policy

### Note operative
- **Non necessario** avvocato per MVP se usi template standard
- **Consigliato**: revisione legale prima di scale commerciale
- **Cookie consent**: bloccare analytics fino a consenso (non necessario bloccare auth cookies, sono essenziali)
- **Email contatto**: obbligatorio in privacy policy per esercizio diritti (può essere tua email personale)

### Risorse
- [GDPR Official Text](https://gdpr-info.eu/)
- [ICO Guide (UK)](https://ico.org.uk/for-organisations/guide-to-data-protection/guide-to-the-general-data-protection-regulation-gdpr/)
- [Garante Privacy (Italy)](https://www.garanteprivacy.it/)
- Supabase DPA: https://supabase.com/dpa
- Vercel DPA: https://vercel.com/legal/dpa
