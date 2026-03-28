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

### Session Management per Allenamenti Lunghi

**Requisito critico**: Trainee usa app in palestra per 60-90+ minuti con frequente app switching (Instagram, timer, musica) durante recuperi. Sistema deve **NON richiedere re-login** durante sessione allenamento.

**Strategia Supabase Auth**:

| Token                  | Expiry        | Storage          | Scopo                           |
| ---------------------- | ------------- | ---------------- | ------------------------------- |
| **Access Token** (JWT) | **4 ore**     | Cookie HTTP-only | Autenticazione API requests     |
| **Refresh Token**      | **30 giorni** | Cookie HTTP-only | Rinnovo automatico access token |

**Configurazione Supabase**:
```typescript
// supabase/config.ts
export const supabaseConfig = {
  auth: {
    // Access token valido 4 ore (copre allenamento 90min + margine)
    jwt: {
      expiryDuration: 14400 // 4 ore in secondi
    },
    // Refresh token valido 30 giorni (utente non deve rifare login ogni giorno)
    refreshToken: {
      expiryDuration: 2592000 // 30 giorni in secondi
    },
    // Auto-refresh quando access token scade
    autoRefreshToken: true,
    // Persisti sessione anche dopo chiusura browser
    persistSession: true,
    // Detection cambio sessione in altri tab
    detectSessionInUrl: true
  }
}
```

**Workflow session refresh automatico**:
```
1. Trainee fa login alle 10:00
   ├─> Access token valido fino 14:00
   └─> Refresh token valido fino 30 giorni dopo

2. Trainee inizia allenamento 10:30 (app aperta)
   ├─> Completa 3 esercizi (10:30 - 11:15)
   ├─> Switcha su Instagram durante recupero (app in background)
   └─> Torna su app (11:20) → sessione ancora attiva ✅

3. Trainee continua allenamento fino 12:00
   ├─> Access token ancora valido (scade 14:00)
   └─> Nessun re-login richiesto ✅

4. Trainee chiude app, riapre 2 ore dopo (14:30)
   ├─> Access token scaduto (era 14:00)
   ├─> Supabase usa refresh token → genera nuovo access token
   └─> Utente rimane loggato, no interruzione ✅

5. Dopo 30 giorni senza uso
   ├─> Refresh token scaduto
   └─> Richiesto login (ragionevole per inattività prolungata)
```

**Client-side handling**:
```typescript
// lib/supabase-client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createClientComponentClient({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  options: {
    auth: {
      autoRefreshToken: true, // Auto-refresh prima della scadenza
      persistSession: true,   // Persist anche dopo chiusura browser
      detectSessionInUrl: true
    }
  }
})

// Listener eventi sessione (opzionale, per logging)
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Session auto-refreshed', session)
  }
  if (event === 'SIGNED_OUT') {
    // Redirect to login
    window.location.href = '/login'
  }
})
```

**Protezione contro session hijacking**:
- Cookie `Secure` flag (HTTPS only)
- Cookie `SameSite=Lax` (protezione CSRF)
- Cookie `HttpOnly` (no accesso JS, protezione XSS)
- Rotation refresh token: Supabase genera nuovo refresh token ad ogni refresh (invalida vecchio)

**Gestione app switching e background**:
- Browser/WebView mantiene sessione anche con app in background
- Service Worker (se PWA) mantiene stato anche offline
- LocalStorage persiste feedback parziali (vedi sezione PWA)

**Logout esplicito**:
```typescript
// Trainee clicca "Logout" manualmente
await supabase.auth.signOut()
// Invalida access + refresh token, clear cookies
```

## Autorizzazione
- **Ruoli**: `admin` · `trainer` · `trainee`.
- **Matrice permessi**:

| Risorsa                    | admin                     | trainer               | trainee             |
| -------------------------- | ------------------------- | --------------------- | ------------------- |
| Creazione utenti           | ✅ trainer + trainee       | ✅ solo trainee        | ❌                   |
| Gestione utenti (RUD)      | ✅ tutti gli utenti        | ✅ solo propri trainee | ❌                   |
| Libreria esercizi          | CRUD                      | CRUD (condivisa)      | lettura             |
| Gruppi muscolari           | CRUD                      | CRUD (condivisi)      | lettura             |
| Schemi motori              | CRUD                      | CRUD (condivisi)      | lettura             |
| **Schede / Programmi**     | **CRUD (tutte)**          | CRUD (proprie)        | lettura (assegnate) |
| **Associazioni trainer**   | **CRUD (riassegnazione)** | lettura (proprie)     | ❌                   |
| Feedback                   | lettura (tutti)           | lettura               | CRUD (propri)       |
| Massimali (PersonalRecord) | CRUD (tutti)              | CRUD (propri trainee) | lettura (propri)    |
| Reportistica               | ✅ (tutti i trainee)       | ✅ (propri trainee)    | ❌                   |
| Monitoraggio avanzamento   | ✅ (tutte le schede)       | ✅ (proprie schede)    | ❌                   |

**Note chiave**:
- **Admin ha CRUD completo su TUTTE le risorse del sistema** (super-user senza restrizioni)
- **Admin può riassegnare trainee tra trainer** modificando `TrainerTrainee` (gestione handover trainer)
- **Admin può visualizzare, modificare, eliminare schede di qualsiasi trainer** (gestione operativa globale)
- **Admin accede a report e monitoraggio di tutti i trainee** (visibilità completa per supervisione)
- Trainer mantiene isolamento: vede solo propri trainee e proprie schede (autonomia operativa)

### Admin Override: Gestione Operativa Globale

**Requisito**: Admin deve avere permessi super-user per gestione operativa ordinaria e straordinaria (handover trainer, revisione schede, supporto emergenze).

#### Gestione Schede di Allenamento (TrainingProgram)

**Admin ha accesso completo a TUTTE le schede del sistema** (draft, active, completed) indipendentemente dal trainer creatore.

**Permessi admin**:
- ✅ **Visualizzazione**: `GET /api/admin/programs` lista TUTTE le schede di TUTTI i trainer (filtri per trainer, trainee, status)
- ✅ **Creazione**: `POST /api/admin/programs` crea scheda per qualsiasi trainee (bypassando ownership trainer)
- ✅ **Modifica**: `PUT /api/admin/programs/[id]` modifica schede di qualsiasi trainer
  - **Schede draft**: modificabili liberamente
  - **Schede active/completed**: modificabili da admin (eccezione alla regola immutabilità per gestione emergenze)
- ✅ **Eliminazione**: `DELETE /api/admin/programs/[id]` elimina schede di qualsiasi trainer (anche active, con warning)
- ✅ **Pubblicazione**: `POST /api/admin/programs/[id]/publish` pubblica schede draft di qualsiasi trainer

**Casi d'uso**:
1. **Handover trainer**: Trainer A lascia la piattaforma → admin riassegna trainee a trainer B → admin può visualizzare/modificare schede create da trainer A
2. **Revisione qualità**: Admin supervisiona schede di trainer junior per QA metodologica
3. **Supporto emergenze**: Trainee contatta admin per problema scheda (es. esercizio sbagliato) → admin interviene direttamente
4. **Correzione errori**: Admin corregge scheda per conto di trainer impegnato/assente

**Validazione backend**:
```typescript
// middleware/auth.ts - Check permission per schede
export function canAccessProgram(user: User, program: TrainingProgram): boolean {
  // Admin: accesso totale
  if (user.role === 'admin') return true
  
  // Trainer: solo proprie schede
  if (user.role === 'trainer') return program.trainerId === user.id
  
  // Trainee: solo schede assegnate
  if (user.role === 'trainee') return program.traineeId === user.id
  
  return false
}
```

#### Riassegnazione Trainee tra Trainer

**Admin può modificare la tabella `TrainerTrainee`** per riassegnare atleti tra diversi trainer (handover gestito).

**Endpoint dedicato**: `PUT /api/admin/trainer-trainee/[traineeId]`

**Workflow riassegnazione**:
```typescript
// Body request
{
  "newTrainerId": "trainer-b-uuid",
  "reason": "Handover per cambio specializzazione trainee"  // Opzionale, per audit log
}

// Backend logic
// 1. Verifica che trainee esista e sia attivo
// 2. Verifica che newTrainer esista e abbia role=trainer
// 3. DELETE vecchio record TrainerTrainee (trainee può avere SOLO 1 trainer)
// 4. INSERT nuovo record TrainerTrainee con newTrainerId
// 5. Log operazione per audit trail
// 6. Notifica email opzionale a vecchio trainer, nuovo trainer, trainee

// Response
{
  "data": {
    "traineeId": "...",
    "oldTrainerId": "trainer-a-uuid",
    "newTrainerId": "trainer-b-uuid",
    "reassignedAt": "2026-03-28T15:30:00Z"
  }
}
```

**Gestione schede dopo riassegnazione**:
- **Schede esistenti** (create dal vecchio trainer) **non cambiano `trainerId`** (preservano paternità originale)
- Nuovo trainer **può visualizzare** le schede esistenti del trainee (accesso lettura per continuità)
- Nuovo trainer **NON può modificare** schede create dal vecchio trainer (solo admin può modificarle)
- Nuovo trainer **può creare nuove schede** per il trainee riassegnato

**UI Admin**:
```
┌─────────── Riassegna Trainee ───────────────┐
│                                              │
│ Trainee: Mario Rossi (#trainee-123)         │
│ Trainer attuale: Giovanni Bianchi (Trainer) │
│                                              │
│ Nuovo Trainer:                               │
│ [▼ Seleziona trainer]                        │
│   - Laura Verdi (Powerlifting)              │
│   - Paolo Rossi (Bodybuilding)              │
│   - Chiara Neri (CrossFit)                   │
│                                              │
│ Motivo (opzionale):                          │
│ [Cambio specializzazione trainee]           │
│                                              │
│ ⚠️ Questa azione è permanente.              │
│    Il nuovo trainer avrà accesso al trainee  │
│    e potrà creare nuove schede.              │
│                                              │
│ [Annulla]                    [Conferma]      │
└──────────────────────────────────────────────┘
```

**Audit log**: Operazioni admin su schede e riassegnazioni vengono loggate per tracciabilità.

#### Accesso Report e Monitoraggio Globale

**Admin può accedere a report e monitoraggio di TUTTI i trainee**:
- `GET /api/admin/reports/sbd?traineeId=X` — report SBD per qualsiasi trainee
- `GET /api/admin/reports/training-volume?trainerId=Y` — volume training per trainer specifico
- `GET /api/admin/programs/[id]/progress` — avanzamento e feedback di qualsiasi scheda

**Dashboard admin**: Vista aggregata con KPI globali (trainee attivi, schede in scadenza per tutti i trainer, feedback pending system-wide).

**Rationale**: Admin ha ruolo supervisore e gestore operativo, necessita visibilità completa per garantire funzionamento piattaforma e qualità servizio.

**Dettaglio creazione utenti**:
- **Admin**: può creare sia utenti con ruolo `trainer` sia utenti con ruolo `trainee`
- **trainer**: può creare **solo** utenti con ruolo `trainee` (i propri atleti)
- **Trainee**: **non può** creare alcun utente

**Dettaglio gestione utenti (Read/Update/Delete)**:
- **Admin**: full CRUD su tutti gli utenti del sistema
- **trainer**: può modificare/eliminare **solo i trainee a lui assegnati** (via tabella `TrainerTrainee`)
- **Trainee**: nessun accesso alle funzioni di gestione utenti

**Dettaglio disabilitazione trainee (campo `User.isActive`)**:
- **Admin**: può disabilitare/riabilitare **qualsiasi trainee** del sistema
- **trainer**: può disabilitare/riabilitare **solo i propri trainee** (quelli a lui assegnati via `TrainerTrainee`)
  - trainer **non può** visualizzare né disabilitare trainee di altri trainer
  - Validazione backend: `PUT /api/users/[id]` con `isActive=false` verifica che esista record `TrainerTrainee` con `trainerId=current_user` e `traineeId=target_user`
- **Trainee**: nessun accesso a funzioni di disabilitazione utenti
- **Effetto disabilitazione**: trainee con `isActive=false` non può effettuare login (redirect con messaggio "Account disabilitato, contatta il tuo trainer")

**Dettaglio libreria esercizi condivisa**:
- **Libreria condivisa tra trainer**: Tutti gli esercizi sono visibili e modificabili da TUTTI i trainer del sistema
- **Admin**: può creare, modificare, eliminare qualsiasi esercizio
- **trainer**: può creare, modificare, eliminare **qualsiasi esercizio** nella libreria (non solo i propri)
  - Campo `Exercise.createdBy` traccia chi ha creato l'esercizio (audit trail) ma **non limita permission**
  - Validazione backend: `PUT /DELETE /api/exercises/[id]` verifica solo che utente sia ruolo `trainer` o `admin`
- **Trainee**: può **solo leggere** la libreria esercizi (per consultare video/descrizioni durante allenamento)
- **Rationale**: Collaborazione tra trainer, evita duplicazione esercizi, libreria si arricchisce con contributi di tutti

**Dettaglio gruppi muscolari e schemi motori condivisi**:
- **Gestione dinamica**: Gruppi muscolari (`MuscleGroup`) e schemi motori (`MovementPattern`) sono tabelle DB gestibili, non enum hardcoded
- **Admin**: può creare, modificare, archiviare (`isActive=false`) gruppi e schemi
- **Trainer**: può creare, modificare, archiviare gruppi e schemi (libreria condivisa)
  - Permette espansione categorizzazioni senza modificare codice (es. aggiungere "Obliqui", "Turkish Get-Up")
- **Trainee**: può **solo leggere** gruppi e schemi (per filtri/ricerca esercizi)
- **Archiviazione**: Campo `isActive=false` disabilita gruppo/schema senza eliminarlo (preserva integrità referenziale con esercizi esistenti)
- **Eliminazione fisica**: Bloccata se esistono riferimenti (esercizi con quel gruppo/schema)
- **Rationale**: Flessibilità per personalizzare tassonomia esercizi senza deploy codice, adattamento a metodologie training diverse

- **Isolamento dati**: un trainer vede e modifica solo trainee e schede a lui assegnati; la libreria esercizi è condivisa; la libreria gruppi muscolari e schemi motori è condivisa; un trainee vede solo le proprie schede.

## Protezione API
- Ogni API Route / Server Action verifica la sessione attiva e il ruolo prima di qualsiasi operazione.
- Middleware Next.js (`middleware.ts`) per proteggere tutte le route `/admin/*`, `/trainer/*`, `/trainee/*` con redirect a `/login` se non autenticato.
- Validazione input lato server su tutti gli endpoint (❓ **OD-19** — Zod).
- ❓ **OD-21** — rate limiting: valutare Vercel Edge Middleware o provider auth.

### Gestione Password Iniziali (trainer crea Trainee)
Quando un trainer crea un nuovo profilo trainee:
1. Il sistema genera una password temporanea sicura (es. 12 caratteri, mix alfanumerico + simboli)
2. Password visualizzata UNA SOLA VOLTA al trainer (modal non dismissable finché non copiata)
3. Password NON salvata nel database (security best practice - ODR-04)
4. Trainee deve cambiare password al primo login (flag `mustChangePassword` gestito da Supabase auth)
5. Dopo cambio password, il flag `mustChangePassword` viene impostato a false

**Pattern sicuro**:
```typescript
// app/api/trainer/trainees/route.ts (POST)
import { generateSecurePassword } from '@/lib/password-utils'

const tempPassword = generateSecurePassword()
const { user } = await supabase.auth.admin.createUser({
  email: validatedData.email,
  password: tempPassword,
  email_confirm: true,
  user_metadata: { mustChangePassword: true }
})

// Salva in DB (senza password temporanea per security - ODR-04)
await prisma.user.create({
  data: {
    id: user.id,
    email: validatedData.email,
    firstName: validatedData.firstName,
    lastName: validatedData.lastName,
    role: 'trainee',
    isActive: true
  }
})

return apiSuccess({ user, tempPassword }) // ritorna solo questa volta
```

**UX trainer**:
- Modal con password + bottone "Copia Password"
- Avviso: "Salva questa password, non sarà più visibile"
- Checkbox "Ho salvato la password" per chiudere modal

**UX Trainee primo login**:
- Dopo login con password temporanea, redirect automatico a `/change-password`
- Form con "Vecchia Password" (temporanea) + "Nuova Password" + "Conferma"
- Dopo cambio, accesso normale alla dashboard

## Password Reset e Notifiche Email

### Strategia MVP: Zero Setup con Supabase Auth

**Soluzione scelta**: Supabase Auth gestisce automaticamente il flusso di recupero password con email transazionali incluse nel servizio.

#### Password Reset Flow

**1. Richiesta reset password**
```typescript
// Frontend: pagina /forgot-password
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()
const { error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  {
    redirectTo: 'https://prod.zerocento.app/reset-password'
  }
)

if (!error) {
  // Mostra messaggio: "Controlla la tua email per il link di reset"
}
```

**2. Flusso automatico Supabase**:
- Supabase invia email con magic link sicuro (token temporaneo con scadenza)
- Trainee clicca link → redirect a `/reset-password?token=...`
- Frontend mostra form nuova password
- Trainee inserisce nuova password → Supabase aggiorna `auth.users`

**3. Conferma reset password**
```typescript
// Frontend: pagina /reset-password
const { error } = await supabase.auth.updateUser({
  password: newPassword
})

if (!error) {
  // Redirect a /login con messaggio success
}
```

#### Configurazione Email Supabase

**Provider email**: **Supabase Email Service** (default, zero setup)

**Caratteristiche**:
- ✅ Incluso in Supabase Pro (€25/mese già previsto)
- ✅ Template predefiniti per reset password
- ✅ Free tier: 300 email/mese (abbondante per 54 utenti)
- ✅ Delivery automatico, nessuna configurazione SMTP richiesta
- ⚠️ Mittente default: `noreply@mail.app.supabase.io`
- ⚠️ Template in inglese (personalizzabili solo con SMTP custom)

**Email template personalizzabile** (Supabase Dashboard → Auth → Email Templates):
```html
<!-- Template "Reset Password" personalizzabile -->
<h2>Reimposta la tua password - ZeroCento</h2>
<p>Hai richiesto il reset della password per il tuo account.</p>
<p>Clicca sul link qui sotto per impostare una nuova password:</p>
<a href="{{ .ConfirmationURL }}">Reimposta Password</a>
<p>Questo link scade tra 1 ora.</p>
<p>Se non hai richiesto il reset, ignora questa email.</p>
```

**Variabili disponibili nei template**:
- `{{ .ConfirmationURL }}` — Link con token per reset
- `{{ .Token }}` — Token raw (se serve custom handling)
- `{{ .Email }}` — Email destinatario
- `{{ .SiteURL }}` — URL applicazione

#### Gestione Primo Login (comunicazione manuale)

**Flow MVP** (senza email automatica):
1. Trainer crea nuovo trainee → sistema genera password temporanea
2. Trainer **comunica credenziali manualmente** via WhatsApp/telefono/SMS
3. Trainee fa login → redirect a cambio password obbligatorio
4. Dopo cambio password, accesso normale

**Rationale**:
- Evita setup SMTP custom per MVP (focus su features core)
- Comunicazione diretta trainer-trainee già esistente (spesso via WhatsApp)
- Riduce rischio email in spam per nuovi domini
- Trainee ha contatto immediato con trainer per supporto

**Post-MVP** (opzionale):
- Aggiungere SMTP custom (es. Resend, SendGrid)
- Email benvenuto automatica con magic link per primo accesso
- Template branded con logo ZeroCento

#### Costi Email

| Soluzione                | Costo mensile | Volume incluso   | Note                                               |
| ------------------------ | ------------- | ---------------- | -------------------------------------------------- |
| **Supabase Email** (MVP) | **€0**        | 300 email/mese   | Incluso in Supabase Pro, sufficiente per 54 utenti |
| Resend free tier         | €0            | 3.000 email/mese | Upgrade futuro con branding custom                 |
| SendGrid free tier       | €0            | 100 email/giorno | Alternative con tracking avanzato                  |

**Stima volume MVP**:
- 50 trainee × 2 reset password/anno = ~100 email/anno
- 10 nuovi trainee/anno × 1 email benvenuto (post-MVP) = 10 email/anno
- **Totale: ~110 email/anno** → free tier più che sufficiente

#### Sicurezza Password Reset

**Protezioni Supabase Auth**:
- Token monouso (valido per 1 ora, invalidato dopo utilizzo)
- Rate limiting automatico (max 3 richieste reset/ora per email)
- Email verification richiesta (link inviato solo a email verificate)
- HTTPS obbligatorio per redirect URL
- Token crittografato in transit

**Validazione password lato server**:
```typescript
// Requisiti password (enforced da Supabase + custom validation)
const passwordSchema = z.string()
  .min(8, "Password minimo 8 caratteri")
  .regex(/[A-Z]/, "Almeno una maiuscola")
  .regex(/[a-z]/, "Almeno una minuscola")
  .regex(/[0-9]/, "Almeno un numero")
```

#### Pagine Frontend Necessarie

| Route              | Scopo                       | UX                                                                            |
| ------------------ | --------------------------- | ----------------------------------------------------------------------------- |
| `/forgot-password` | Richiesta reset             | Form con solo email + submit                                                  |
| `/reset-password`  | Conferma nuova password     | Form con "Nuova Password" + "Conferma Password"                               |
| `/change-password` | Cambio password autenticato | Form con "Vecchia Password" + "Nuova Password" (per trainee dopo primo login) |

**Estimate effort implementazione**:
- UI pagina `/forgot-password`: **1 ora**
- UI pagina `/reset-password`: **1 ora**
- Personalizzazione email template Supabase: **0.5 ore**
- Test flusso completo: **1 ora**
- **Totale: 3.5 ore**

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
- **Dati relazionali**: trainer-trainee assignments
- **Dati tecnici**: IP address (logs Vercel), session cookies (Supabase Auth)

### Base legale (Art. 6 GDPR)
- **Consenso esplicito** (Art. 6.1.a): utente accetta termini e privacy policy al signup
- **Esecuzione contratto** (Art. 6.1.b): servizio training richiede processing dati performance

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
| Feedback allenamenti  | 2 anni da completamento programma | Storico trainer + trainee        |
| Account cancellato    | Anonimizzazione immediata         | GDPR Art. 17                     |
| Logs sistema          | 30 giorni                         | Troubleshooting (Vercel default) |

#### 5. Right to Erasure ("Delete Account")
Funzionalità obbligatoria:
```typescript
// /account/settings → "Elimina account" button
// Triggera:
// 1. Hard delete da auth.users (Supabase)
// 2. Anonimizzazione User record (sostituire nome/email con "Deleted User [UUID]")
// 3. Mantenere feedback anonimizzati per statistiche trainer (legittimo interesse)
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
