# Change Log

> Ogni entry documenta una decisione chiusa. Le decisioni aperte vivono in 08_open_decisions.md.

---

## 2026-03-27 (rev 9)
- **Azione**: Integrazione completa data model dettagliato con informazioni raccolte dal documento note.txt.
- **Data Model - Arricchimento entità**:
  - **Exercise**: Aggiunti campi `muscleGroups` (Json array con coefficienti d'incidenza 0.0-1.0), `type` (fundamental/accessory per SBD), `movementPattern` (schema motorio: squat, push, pull, ecc.), `notes` (array varianti)
  - **TrainingProgram**: Aggiunto `workoutsPerWeek` (n allenamenti per m settimane)
  - **Week**: Aggiunti `feedbackRequested` (marcatura settimane rilevanti) e `generalFeedback` (commento testuale settimana)
  - **WorkoutExercise**: Arricchito con `targetRpe` (Float 5.0-10.0 incrementi 0.5), `weightType` (Enum: absolute/percentage_1rm/percentage_rm), `restTime` (Enum: 30s/1m/2m/3m/5m), `isWarmup` (Boolean), supporto `reps` come intervallo (es. "6/8")
  - **ExerciseFeedback**: Aggiunto `setsPerformed` (Json array con {reps, weight} per ogni serie), `actualRpe` (Float 5.0-10.0)
  - **User**: Separato `name` in `firstName` e `lastName`, aggiunti `isActive` (profilo attivo/disattivato) e `initialPassword` (per gestione password generate da coach)
  - **Nuova entità PersonalRecord**: Gestione massimali (1RM o nRM) per trainee/esercizio con storico date
- **Backend API - Nuovi endpoint**:
  - `/api/trainee/records/*` - CRUD massimali personali
  - `/api/coach/trainees/[id]/records` - Coach visualizza massimali trainee
  - `/api/programs/[id]/reports/sbd` - Reportistica SBD (FRQ, NBL, IM)
  - `/api/programs/[id]/reports/training-sets` - Serie allenanti per gruppo muscolare
  - `/api/programs/[id]/reports/volume` - Volume totale per gruppo muscolare
  - Aggiornamento filtri `/api/exercises` per tipo e schema motorio
- **Validazione Zod - Nuovi schemi**:
  - `muscleGroupSchema` (name + coefficient 0.0-1.0)
  - `exerciseSchema` arricchito con muscleGroups, type, movementPattern
  - `workoutExerciseSchema` con targetRpe Float, weightType, restTime, isWarmup
  - `setPerformedSchema` per array serie nel feedback
  - `feedbackSchema` con setsPerformed e actualRpe Float
  - `personalRecordSchema` per gestione massimali
- **Frontend - Nuove pagine e componenti**:
  - Pagine: `/coach/trainees/[id]/create` (crea trainee + genera password), `/trainee/records` (gestione massimali), `/coach|trainee/reports` (reportistica)
  - Componenti: `MuscleGroupBadge`, `MovementPatternIcon`, `SetInput`, `PersonalRecordCard/Form`, `SBDReportChart`, `TrainingVolumeChart`, `RPESelector`, `RestTimeSelector`, `RepsInput`
- **Security - Gestione password iniziali**:
  - Flusso sicuro per coach che crea trainee: generazione password temporanea, visualizzazione una-tantum, encrypted storage opzionale, cambio obbligatorio al primo login
  - Pattern implementativo documentato in 05_security_auth.md
- **Testing - Nuovi flussi critici**:
  - P1: Coach crea profilo trainee con password, trainee aggiunge massimale
  - P1: Trainee invia feedback con array serie (reps + kg)
  - P2: Visualizzazione reportistica SBD e serie allenanti
  - P3: Validazione RPE Float, peso in %, reps come intervallo
- **Note implementative**: Documentate strutture Json per muscleGroups, setsPerformed, logica calcolo peso da percentuale 1RM, scala RPE 5.0-10.0, reportistica SBD (FRQ/NBL/IM)
- **Implicazioni**: Data model completo e pronto per implementazione Prisma. Tutti i requisiti funzionali raccolti nelle note sono stati integrati nei file di design. API endpoints definiti. Validazione type-safe garantita. UX e security patterns documentati.

---

## 2026-03-27 (rev 8)
- **Azione**: Chiusura OD-32 (GDPR compliance).
- **OD-32 - Compliance GDPR**: Dettagliata analisi e checklist implementativa
  - **Dati personali raccolti**: nome, email, performance allenamenti (RPE, feedback)
  - **Base legale**: Consenso esplicito (Art. 6.1.a) + Esecuzione contratto (Art. 6.1.b)
  - **Requisiti obbligatori MVP**:
    1. Cookie Consent Banner (react-cookie-consent)
    2. Privacy Policy (template GDPR-compliant)
    3. Terms of Service
    4. Data Retention Policy (2 anni feedback, anonimizzazione immediata su delete)
    5. Right to Erasure (Delete Account feature obbligatoria)
    6. Data Processing Agreement (Supabase + Vercel DPA)
    7. **Supabase region EU** (dati in UE per GDPR)
  - **Checklist implementativa**: 9 task operativi in 05_security_auth.md
  - **Non bloccante sviluppo**: policy possono essere scritte in parallelo, feature "Delete Account" implementabile in fase finale MVP
- **Implicazioni**: GDPR compliance garantita con checklist chiara. Cookie consent + privacy policy obbligatori pre-launch. Delete account obbligatorio. Supabase region EU da configurare.

---

## 2026-03-27 (rev 7)
- **Azione**: Chiusura stack critico Database + ORM + Auth (OD-24, OD-25, OD-26, OD-28, OD-29, OD-31).
- **OD-24 - Database**: **Supabase PostgreSQL** confermato
  - Rationale: Connection pooling (PgBouncer) incluso → risolve rischio OD-36
  - Dashboard admin ricca per gestione visuale dati
  - Free tier generoso (500MB DB, 1GB storage, 2GB bandwidth)
  - Coverage AI ottima (vastissima documentazione Supabase + Next.js)
  - Auth integrato nello stesso ecosistema
- **OD-25 - ORM**: **Prisma** confermato
  - Type-safety automatica end-to-end (schema → types generati)
  - Prisma Studio per debug dati locale
  - Migrations robuste e trackable (Git)
  - Coverage AI eccellentissima (vastissimo nei training data)
- **OD-26 - Migrazioni**: **Prisma Migrate** con migration files
  - Workflow: modifica schema → `prisma migrate dev` → commit migration files
  - Rollback-capable, environment-safe (DIRECT_URL per DDL, DATABASE_URL pooled per runtime)
- **OD-28 - Metodo auth**: **Email+password** per MVP
  - OAuth (Google/GitHub) e Magic Link opzionali post-MVP
- **OD-29 - Provider auth**: **Supabase Auth** 
  - Integrazione nativa con Supabase DB
  - JWT session (access + refresh token) in cookie HTTP-only
  - Collegamento auth.users ↔ public.User (trigger Supabase)
  - Zero setup infra auth (no NextAuth config)
- **OD-31 - Gestione segreti**: **Vercel Environment Variables** (standard per MVP)
  - DATABASE_URL, DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY
  - No vault enterprise necessario
- **Setup completo**:
  ```
  Database: Supabase PostgreSQL (pooled + direct connections)
  ORM: Prisma (schema.prisma + migrations)
  Auth: Supabase Auth (email/password, JWT)
  Secrets: Vercel Env Vars
  ```
- **Implicazioni**: Stack critico definito, sviluppo può partire. Connection pooling risolto, auth zero-config, type-safety garantita, coverage AI massima.

---

## 2026-03-27 (rev 6)
- **Azione**: Chiusura stack backend API (OD-18, OD-19, OD-20).
- **OD-18 - Stile API**: **REST confermato** con API Routes Next.js
  - Rationale: Coverage AI eccellente, pattern consolidati (vastissima presenza training data), HTTP semantics chiare
  - Server Actions opzionali per form submissions (progressive enhancement)
  - Type-safety via TypeScript + Zod validation
- **OD-19 - Validazione**: **Zod confermato**
  - Schema riutilizzabili (shared/schemas)
  - Type-safety end-to-end
  - Integrazione nativa con React Hook Form (frontend) e API Routes (backend)
- **OD-20 - Formato errori**: Formato standard definito
  - Success: `{data, meta?}`
  - Error: `{error: {code, message, details?}}`
  - HTTP status code semantici (200, 201, 400, 401, 403, 404, 500)
  - Helper `apiSuccess()` e `apiError()` per consistency
- **Filosofia**: REST per massima coverage AI + pattern universali, Zod per validation type-safe, formato errori standardizzato per client handling consistency.

---

## 2026-03-27 (rev 5)
- **Azione**: Chiusura stack frontend (OD-14, OD-15, OD-16) ottimizzato per sviluppo AI-first.
- **OD-14 - Libreria UI**: **Tailwind CSS** + **Material UI (MUI)**
  - Rationale: MUI ha vastissima presenza nei training data AI (matura dal 2014), componenti accessibili pronti, pattern consolidati
  - Tailwind per styling utility-first (coverage AI eccellente)
  - Alternativa valutata: shadcn/ui (più moderno ma meno coverage AI)
- **OD-15 - State management**: 
  - **TanStack Query** per server state (fetching/caching/sync, pattern consolidati, ottima documentazione)
  - **Context API** per global state semplice (React nativo, zero dipendenze)
- **OD-16 - Form management**: **React Hook Form + Zod**
  - Standard de facto industry, altissima presenza training data AI
  - Validation type-safe, schema dichiarativi riutilizzabili
- **Filosofia**: Stack scelto per massimizzare efficacia generazione codice AI (alta coverage training data, pattern ripetitivi, documentazione matura).

---

## 2026-03-27 (rev 4)
- **Azione**: Chiusura OD-12 con dettaglio rischi architetturali. Confermato piano Vercel Pro.
- **OD-12 - Rischi architetturali**: Analizzati e documentati in dettaglio:
  - **Cold start serverless**: Rischio BASSO con Vercel Pro (funzioni restano calde più a lungo)
  - **DB connection pooling**: Rischio MEDIO - soluzione: usare DB managed con connection pooling (Supabase/Neon) + Prisma connectionLimit
- **Infrastruttura**: Confermato piano **Vercel Pro** (~$20/mese) per performance migliori
- **Budget stimato**: ~$20-30/mese (Vercel Pro + DB managed)
- **Implicazioni**: Con Vercel Pro e connection pooling configurato correttamente, l'architettura serverless è adeguata per la scala prevista (54 utenti).

---

## 2026-03-27 (rev 3)
- **Azione**: Chiusura decisioni OD-04, OD-06, OD-07.
- **OD-04 - Scope OUT**: Confermato fuori scope MVP: pagamenti, app nativa (si realizza solo web app responsive mobile-friendly), chat trainer-trainee, funzionalità nutrizione.
- **OD-06 - Vincoli temporali**: Nessun vincolo temporale o milestone rigida al momento.
- **OD-07 - Vincoli organizzativi**: Nessun vincolo organizzativo (team size, processi) al momento.
- **Implicazioni**: Focus su web app responsive, possibile utilizzo di PWA per esperienza mobile-like. Nessuna pressione temporale o burocratica.

---

## 2026-03-27 (rev 2)
- **Azione**: Compilazione di tutti i file di design con le informazioni fornite dal product owner.
- **Decisioni consolidate**: OD-01, OD-02, OD-03, OD-05, OD-08, OD-09, OD-10, OD-11, OD-13, OD-17, OD-23, OD-30, OD-35.
- **Dominio definito**: piattaforma coaching web (Next.js + Vercel), 3 ruoli (admin/coach/trainee), scala iniziale 54 utenti.
- **Entità di dominio definite**: User, CoachTrainee, Exercise, TrainingProgram, Week, Workout, WorkoutExercise, ExerciseFeedback.
- **Prossimi passi**: chiudere le decisioni aperte rimanenti (OD-14 UI lib, OD-24 DB engine, OD-25 ORM, OD-28/29 auth provider, OD-04 scope OUT).

---

## 2026-03-27 (rev 1)
- **Azione**: Prima revisione dell'intero set di documenti di design.
- **Esito**: Tutti i file risultano scaffold vuoti. Nessuna decisione ancora consolidata.
