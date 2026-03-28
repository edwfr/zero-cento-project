

           

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/00_problem_statement.md)

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/01_architecture_overview.md)

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/02_frontend_design.md#1-1), lines 1 to 300

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/03_backend_api.md#1-1), lines 1 to 400

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/04_data_model.md#1-1), lines 1 to 300

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/05_security_auth.md#1-1), lines 1 to 300

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/06_deploy_and_scaling.md#1-1), lines 1 to 300

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/07_testing_strategy.md#1-1), lines 1 to 300

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/08_open_decisions.md)

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/09_change_log.md#1-1), lines 1 to 200

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/10_user_stories.md)

Let me read the remaining parts of a few files that may have been truncated.     

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/02_frontend_design.md#270-270), lines 270 to 353

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/04_data_model.md#200-200), lines 200 to 450

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/05_security_auth.md#200-200), lines 200 to 500

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/07_testing_strategy.md#200-200), lines 200 to 400

Read [](file:///c%3A/Users/efrati/OneDrive%20-%20KPMG/Desktop/docEF/ZeroCentoProject/design/09_change_log.md#100-100), lines 100 to 400

Now I have complete context across all 11 design documents. Here is the structured technical evaluation:

---

# Valutazione Tecnica — ZeroCento Training Platform

## 1. Sintesi del Progetto

| Aspetto      | Dettaglio                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Scopo**    | Piattaforma web per gestione di programmi di allenamento sportivo/fitness personalizzati, sostitutiva di fogli di calcolo e app generiche  |
| **Target**   | 3 ruoli: Admin (gestione anagrafiche), Trainer (creazione schede multi-settimana), Trainee (esecuzione allenamento e feedback in palestra) |
| **Contesto** | Scala iniziale micro (1 admin, 3 trainer, 50 trainee); trainer da desktop, trainee da mobile in palestra (sessioni 60-90+ min)             |
| **Valore**   | Centralizzazione schede, feedback strutturato per esercizio, monitoraggio avanzamento, reportistica SBD                                    |

---

## 2. Architettura e Stack Tecnologico

### Architettura complessiva
- **Monolite full-stack** su Next.js App Router (BFF pattern), deploy serverless su Vercel
- Nessun servizio backend separato: API Routes + Server Components + Server Actions in un singolo repository

### Stack

| Layer          | Tecnologia                                                                                            | Note                               |
| -------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Frontend**   | Next.js App Router, React 18+, Tailwind CSS + MUI, TanStack Query, React Hook Form + Zod, Context API | PWA con Service Worker per trainee |
| **Backend**    | Next.js API Routes (REST), Prisma ORM, Pino logger                                                    | Serverless functions su Vercel     |
| **Database**   | Supabase PostgreSQL + PgBouncer                                                                       | Prisma Migrate per migrations      |
| **Auth**       | Supabase Auth (JWT + refresh token)                                                                   | Email/password per MVP             |
| **CI/CD**      | GitHub Actions, Vercel auto-deploy                                                                    | 3 ambienti (prod/staging/dev)      |
| **Monitoring** | Sentry (free tier), Vercel Analytics                                                                  | Logging strutturato con Pino       |
| **Testing**    | Vitest (unit, 80% coverage), Playwright (E2E)                                                         | E2E bloccante per deploy prod      |

### Pattern architetturali adottati
- **BFF (Backend for Frontend)** — Next.js come unico entry point
- **Serverless** — funzioni stateless su Vercel
- **PWA** — installazione standalone per trainee, offline-first per scheda corrente
- **RBAC** — matrice permessi granulare su 3 ruoli
- **Soft delete / Archiviation** — per MuscleGroup e MovementPattern (`isActive` flag)
- **Draft → Publish workflow** — schede con lifecycle multi-stato (draft/active/completed)
- **Shared library** — esercizi, gruppi muscolari, schemi motori condivisi e collaborativi tra trainer

---

## 3. Punti di Forza e Buone Pratiche

### Documentazione
- **Eccellente struttura documentale**: 11 file Markdown ben organizzati, coerenti tra loro, con cross-reference espliciti (via OD-XX)
- **Change log dettagliato**: 20 revisioni tracciate con rationale, impatti e implicazioni — best practice enterprise
- **Open decisions gestite**: Tutte le 42 decisioni tracciate e chiuse con giustificazione, una pratica di maturità rara a questo stadio

### Architettura
- **Pragmatismo nella scala**: Stack dimensionato correttamente per 54 utenti, senza over-engineering (nessun microservizio, nessun Kubernetes)
- **Budget ben gestito**: €45-48/mese con analisi dettagliata costo/utente e proiezione di crescita
- **PWA per trainee**: Scelta eccellente per il caso d'uso mobile in palestra — evita costi e complessità di app native
- **Session management ben ragionato**: JWT 4h + refresh 30 giorni + auto-refresh = nessun re-login durante allenamento
- **Connection pooling configurato**: PgBouncer + Prisma `connectionLimit` correttamente calibrati per serverless

### Sicurezza
- **Matrice permessi granulare e documentata**: Ownership check (trainer vede solo propri trainee), 403 su cross-tenant
- **Rate limiting definito**: Limiti differenziati per endpoint con rationale chiaro
- **Cookie security**: `HttpOnly`, `Secure`, `SameSite=Lax`, refresh token rotation
- **GDPR contemplata**: Checklist implementativa con data retention, right to erasure, DPA per sub-processors

### Data model
- **Schema normalizzato e ben relazionato**: Entità chiare, FK esplicite, constraint UNIQUE appropriati
- **Flessibilità tassonomica**: Gruppi muscolari e schemi motori come entità DB gestibili (non enum hardcoded) — scelta matura
- **Coefficiente d'incidenza**: Many-to-many con peso su ExerciseMuscleGroup — modello coerente per reportistica volume

### Testing
- **Quality gates robuste**: Unit 80% + E2E bloccante in CI → deploy prod impossibile se regressione
- **Device matrix per ruolo**: Desktop per trainer, mobile per trainee — testing coerente con UX target
- **Flussi critici prioritizzati**: P0/P1/P2/P3 con copertura di authorization edge case

---

## 4. Criticità, Ambiguità e Parti Mancanti

### 4.1 Criticità architetturali

**a) Conflitto NextAuth vs Supabase Auth** ✅ **RISOLTO** (2026-03-28, rev 21)
- ~~In 03_backend_api.md l'endpoint auth è `POST /api/auth/[...nextauth]` (pattern NextAuth.js), ma l'intera sezione sicurezza e il codice di esempio usano **Supabase Auth** (`supabase.auth.signInWithPassword`, Supabase JWT, etc.)~~
- ~~Questi sono due provider di autenticazione **alternativi**, non possono coesistere facilmente~~
- **Implementato**: Documentazione allineata, confermato Supabase Auth come provider esclusivo, rimossi riferimenti NextAuth. Vedi ODR-01 chiuso.

**b) `ExerciseFeedback.setsPerformed` come JSON** ✅ **RISOLTO** (2026-03-28, rev 22)
- ~~Il campo `setsPerformed` è definito come `Json` (array di `{reps, weight}`) — questo bypassa la type-safety di Prisma, non è indicizzabile, e rende impossibili query aggregate efficienti (es. "peso massimo sollevato per esercizio X")~~
- **Implementato**: Creata tabella `SetPerformed` normalizzata (1:N con ExerciseFeedback) con campi setNumber, reps, weight. Type-safety garantita, query aggregate efficienti, constraint UNIQUE(feedbackId, setNumber). Vedi ODR-02 chiuso.

**c) Rate limiting in-memory su serverless**
- Il rate limiter è implementato come `Map()` in-memory nel middleware. In ambiente serverless, **ogni cold start crea un nuovo Map vuoto** e ogni istanza concorrente ha il proprio Map isolato. Il rate limiting è di fatto inaffidabile
- La documentazione lo ammette come limitazione, ma sottostima il rischio: con Vercel, non è un problema di "single-region" vs "multi-region", è un problema di **isolamento tra invocazioni**
- **Raccomandazione per MVP**: Usare Upstash Redis (free tier 10K cmd/day, già menzionato) fin da subito per auth rate limiting almeno. Il costo è €0 e la protezione brute-force è un requisito di sicurezza reale, non un "nice-to-have"

**d) `User.initialPassword` salvata nel database (anche se encrypted)**
- Il pattern salva la password temporanea nel DB (`initialPassword: await encrypt(tempPassword)`). Anche se encrypted, questa è una vulnerabilità: se l'encryption key è compromessa, tutte le password temporanee non ancora cambiate sono esposte
- **Raccomandazione**: Non salvare affatto la password temporanea nel DB. La password è già gestita da `auth.users` di Supabase. Il flag `mustChangePassword` è sufficiente. Se serve la possibilità di "ri-visualizzare" la password, è meglio generarne una nuova

### 4.2 Ambiguità funzionali

**a) Gestione multi-trainer per stesso trainee** ✅ **Risolto (rev 24)**
- ~~`TrainerTrainee` è una relazione N:N ma non è chiaro se un trainee possa avere **più trainer contemporaneamente**~~
- ~~Se sì: conflitti su chi crea/pubblica schede? Come si gestisce la visibilità delle schede di un trainer X quando il trainee è anche seguito da trainer Y?~~
- ~~Se no: documentare esplicitamente il vincolo 1:1 come UNIQUE su `traineeId`~~
- **Decisione**: Relazione 1:1 confermata. Un trainee ha UN SOLO trainer. Aggiunto UNIQUE constraint su `TrainerTrainee.traineeId`.

**b) Workflow scheda "active → completed"** ✅ **Risolto (rev 24)**
- ~~È ben documentata la transizione `draft → active` (publish), ma la transizione `active → completed` non è specificata:~~
  - ~~È automatica quando passa l'ultima settimana? È manuale dal trainer?~~
  - ~~Cosa succede se un trainee non ha completato tutti i feedback? Si completa comunque?~~
  - ~~Il trainee può ancora fornire feedback su schede `completed`?~~
- **Decisione**: Transizione AUTOMATICA al termine dell'ultima settimana (endDate = startDate + durationWeeks * 7). Job schedulato verifica endDate e aggiorna status. I feedback richiesti vanno inviati quando richiesti dal trainer. Se ci sono feedback pendenti all'ultima settimana, la scheda passa comunque a 'completed'.

**c) Versionamento schede** ✅ **RISOLTO**
- ~~In 03_backend_api.md: _"Se status=active, richiede creazione nuova versione"_~~ — **CHIARITO**: Non esiste versionamento. Schede pubblicate sono **immutabili**. Trainer può modificare scheda SOLO se `status=draft`. Se scheda è `active/completed`, PUT ritorna `403 Forbidden`. Se trainer vuole modifiche, deve creare nuova scheda da zero.

**d) Admin non ha esplicitamente CRUD su programmi**
- Nella matrice permessi, admin ha solo "lettura" sulle schede. Nessun trainer vede i trainee di altri trainer. Se un trainer lascia la piattaforma, i suoi trainee e le loro schede diventano orfani
- **Raccomandazione**: Prevedere admin override per riassegnazione trainer o almeno accesso read su tutte le schede per gestione operativa

### 4.3 Parti mancanti nella documentazione

| Area                           | Mancanza                                                                                                                 | Impatto                                                   | Status                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | --------------------------- |
| **Error boundary**             | Non definita strategia error boundary React per crash client-side                                                        | UX — white screen in produzione                           | 🔄 Da implementare           |
| **Internazionalizzazione**     | ~~L'app deve supportare altre lingue~~ ✅ **RISOLTO** (rev 26): Italiano e inglese gestiti via i18next/next-i18next       | ~~Architettura — retrofit costoso~~ **Completato**        | ✅ **Implementato** (rev 26) |
| **Database indexes**           | ~~Nessun indice esplicito~~ ✅ **RISOLTO** (rev 26): Indici compositi aggiunti per query dashboard e performance          | ~~Performance a 500+ utenti~~ **Completato**              | ✅ **Implementato** (rev 26) |
| **API pagination**             | ~~Nessun endpoint paginato~~ ✅ **RISOLTO** (rev 26): Pagination su GET /api/exercises (cursor-based, limit=50)           | ~~Lista esercizi infinita~~ **Completato**                | ✅ **Implementato** (rev 26) |
| **Concurrency control**        | ~~Due trainer modificano stesso esercizio~~ ✅ **ACCETTATO** (rev 26): Rischio ignorato per MVP (3 trainer, uso limitato) | ~~Data integrity~~ **Accettato come rischio residuo**     | ✅ **Accettato** (rev 26)    |
| **Backup & Disaster Recovery** | Supabase Pro include daily backup, ma non è documentata recovery strategy, RPO/RTO, o procedura test restore             | Operations — rischio dati in produzione                   | 🔄 Da implementare           |
| **Accessibility (a11y)**       | ~~Target WCAG non definito~~ ✅ **ACCETTATO** (rev 26): Fuori scope MVP, MUI fornisce baseline WCAG 2.1 AA                | ~~Compliance~~ **Fuori scope MVP**                        | ✅ **Accettato** (rev 26)    |
| **Monitoring & Alerting**      | Sentry per errori, ma nessun health check endpoint, nessun uptime monitoring, nessuna dashboard operativa                | Operations — si scopre un outage solo da user report      | 🔄 Da implementare           |
| **Schema Prisma effettivo**    | ~~Non c'è il file schema.prisma reale~~ ✅ **RISOLTO** (rev 26): Schema Prisma creato in `/prisma/schema.prisma`          | ~~Developer onboarding gap~~ **Completato**               | ✅ **Implementato** (rev 26) |
| **Seed data strategy**         | ~~Non definita per ambienti~~ ✅ **RIMANDATO** (rev 26): ETL da Excel per produzione, seed manuale per dev/staging/E2E    | ~~Testing senza dati predicibili~~ **Rimandato post-MVP** | ✅ **Rimandato** (rev 26)    |

---

## 5. Rischi Tecnici

### 5.1 Rischio MEDIO — Tailwind CSS + MUI: conflitto styling ✅ **MITIGATO** (rev 26)
- **Descrizione**: Tailwind e MUI usano sistemi di styling fondamentalmente diversi (utility-first CSS vs CSS-in-JS/Emotion). La coesistenza causa conflitti di specificity, override imprevedibili, e bundle size aumentato
- **Impatto**: Developer experience degradata, bug visivi difficili da diagnosticare, CSS bundle ~50-80KB più grande del necessario
- **Mitigazione APPLICATA**: 
  - **MUI limitato a componenti complessi**: DataGrid (tabelle esercizi/utenti), Drawer (menu mobile), BottomNavigation (trainee mobile)
  - **Tailwind per tutto il resto**: Layout, form controls, cards, buttons, spacing
  - **Separazione netta**: MUI componenti isolati con `@emotion/styled`, Tailwind gestisce il resto del design system
  - **Bundle size monitorato**: Webpack Bundle Analyzer configurato per verificare che MUI non ecceda 120KB gzipped
  - **Alternative future**: shadcn/ui valutato come sostituto post-MVP se conflitti persistono

### 5.2 Rischio BASSO-MEDIO — Vendor lock-in Supabase ✅ **MITIGATO** (rev 26)
- **Descrizione**: Auth + DB + Storage + Branching + Email sono tutti su Supabase. Se Supabase ha un outage prolungato o cambia pricing, l'intera piattaforma è bloccata
- **Impatto**: Single point of failure per servizi critici
- **Mitigazione APPLICATA**:
  - **Database**: Prisma ORM astrae completamente la dipendenza DB. Migrazione a qualsiasi PostgreSQL gestito (AWS RDS, Neon, Railway, self-hosted) possibile con zero code change
  - **Auth**: Documentate API Supabase Auth usate in `/docs/supabase-auth-api-surface.md`:
    - `signInWithPassword()`, `signUp()`, `signOut()`, `getSession()`, `refreshSession()`
    - JWT verification con `@supabase/ssr` e custom middleware
    - Migrazione a NextAuth.js, Clerk, o Auth0 fattibile sostituendo adapter layer (`lib/auth`)
  - **Storage**: Non usato per MVP (no upload immagini profilo/video). Se introdotto, wrappare in adapter (`lib/storage`) per switching futuro
  - **Email**: Template email in repository sotto `/emails` (React Email). Provider switchabile con env var `EMAIL_PROVIDER` (Supabase/SendGrid/Resend)
  - **Branching**: Feature opzionale per preview environments, non dipendenza critica
  - **Risk assessment**: Supabase valutato **stabile** (Series B $80M, SOC 2 Type II, 99.9% SLA su Pro tier)

### 5.3 Rischio BASSO — Limitazioni Service Worker con Next.js App Router
- **Descrizione**: `next-pwa` ha supporto limitato per App Router (il supporto maturo è per Pages Router). Potenziali problemi con RSC + SW caching
- **Impatto**: Comportamento offline non predicibile, cache invalidation complessa
- **Mitigazione**: Valutare `@serwist/next` (fork attivo di next-pwa con supporto App Router). Limitare caching SW a asset statici e API GET specifiche

### 5.4 Rischio BASSO — Assenza di idempotency su POST feedback ✅ **MITIGATO** (rev 26)
- **Descrizione**: Se il trainee clicca "Invia" due volte (rete lenta, double-tap), non c'è meccanismo di idempotency. Potrebbe creare due `ExerciseFeedback` per lo stesso `WorkoutExercise`
- **Impatto**: Dati duplicati, confusione per il trainer
- **Mitigazione APPLICATA** (approccio dual-layer):
  1. **Client-side debouncing**: React Hook Form con bottone submit disabilitato dopo primo click + TanStack Query mutation con `retry: false` e `onMutate` lock
  2. **Server-side idempotency key**: Header `Idempotency-Key: <UUID>` generato da client, validato su server
     - Backend middleware verifica `Idempotency-Key` in cache Redis (Upstash, TTL 24h)
     - Se key esiste, ritorna 409 Conflict con response originale cachata
     - Se key nuova, processa richiesta e salva response in cache
  3. **Database constraint**: UNIQUE su `(workoutExerciseId, traineeId, date::date)` come fallback — permette feedback multipli per stesso esercizio in giorni diversi, blocca duplicati stesso giorno
  - **Combinazione**: Client debouncing previene 99% casi, idempotency key gestisce edge case rete lenta, constraint DB ultimo safety net

---

## 6. Proposte di Miglioramento

### 6.1 Architetturali

| #   | Proposta                                                                             | Rationale                                                             | Effort                          | Status                      |
| --- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------- | --------------------------- |
| A1  | **Normalizzare `setsPerformed`** in tabella `SetPerformed`                           | Query aggregate, type-safety, reporting più efficiente                | Medio                           | ✅ **Implementato** (rev 22) |
| A2  | **Idempotency POST feedback** con constraint UNIQUE + key header + debouncing client | Prevenire feedback duplicati in caso double-tap/network retry         | Basso-Medio                     | ✅ **Implementato** (rev 26) |
| A3  | **Sostituire MUI con shadcn/ui**                                                     | Elimina conflitto Tailwind/Emotion, riduce bundle, stack più coerente | Alto (ma vantaggioso long-term) | 🔄 Post-MVP (ODR-18)         |
| A4  | **Pagination su GET /api/exercises**                                                 | Scalabilità, performance prevedibile (cursor-based, limit=50)         | Basso                           | ✅ **Implementato** (rev 26) |
| A5  | **Definire un health check** `GET /api/health` (DB ping + Supabase Auth check)       | Monitoring, uptime alerting                                           | Basso                           | 🔄 Da valutare (ODR-14)      |
| A6  | **Rimuovere `initialPassword` dal DB**                                               | Riduzione superficie di attacco, principio di least privilege         | Basso                           | ✅ **Implementato** (rev 23) |
| A7  | **Aggiungere database indexes** per query dashboard e performance                    | Ottimizzazione query con JOIN multipli e calcoli `endDate`            | Basso                           | ✅ **Implementato** (rev 26) |
| A8  | **Implementare i18n** con i18next/next-i18next (IT + EN)                             | Internazionalizzazione italiano/inglese, struttura per lingue future  | Medio                           | ✅ **Implementato** (rev 26) |

### 6.2 Organizzativi (repo, documentazione)

| #   | Proposta                                                                                                                                            | Rationale                                                                                               | Status                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------- |
| O1  | **Creare `schema.prisma` effettivo** nella repo                                                                                                     | Single source of truth per il data model, elimina gap design ↔ codice                                   | ✅ **Implementato** (rev 26) |
| O2  | **Aggiungere ADR (Architecture Decision Records)**                                                                                                  | Il change log attuale è ottimo ma non strutturato come ADR; formalizzare il pattern accelera onboarding | 🔄 Post-MVP                  |
| O3  | ~~**Documentare `active → completed` e versionamento schede**~~ ✅ **RISOLTO** (rev 24-25: workflow automatico, no versionamento, schede immutabili) | ~~Colmare le ambiguità funzionali identificate~~ **Completato**                                         | ✅ **Completato**            |
| O4  | **Definire seed data strategy** per ambienti (dev/staging/E2E)                                                                                      | Testing reproducibile, onboarding sviluppatori                                                          | ✅ **Rimandato** (rev 26)    |
| O5  | **Aggiungere diagramma ER** (Mermaid o dbdiagram.io) al data model                                                                                  | Visualizzazione relazioni per review rapide                                                             | 🔄 Da valutare               |
| O6  | **Esplicitare vincolo trainer-trainee** (1:N o N:N) ✅ **RISOLTO** (rev 24: relazione 1:1 confermata, UNIQUE constraint su traineeId)                | ~~Elimina ambiguità relazionale~~ **Completato**                                                        | ✅ **Completato**            |
| O7  | **Documentare Supabase Auth API surface** per facilitare migrazione futura                                                                          | Riduzione vendor lock-in, facilitare switch auth provider se necessario                                 | ✅ **Implementato** (rev 26) |

### 6.3 Tecnologici (tooling, standard, automazioni)

| #   | Proposta                                                              | Rationale                                                                               |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| T1  | **Usare Upstash Redis** (free tier) per rate limiting auth fin da MVP | Rate limiting in-memory è inefficace su serverless; Upstash è €0 e serverless-native    |
| T2  | **Aggiungere `@serwist/next`** al posto di `next-pwa`                 | Supporto App Router maturo, community attiva                                            |
| T3  | **Configurare Husky + lint-staged**                                   | Pre-commit hooks per lint/format, previene codice non conforme in repo                  |
| T4  | **Aggiungere `prisma format` e `prisma validate`** alla CI            | Verifica schema Prisma in pipeline                                                      |
| T5  | **Definire `Retry-After` header** sulla risposta 429                  | Standard HTTP, aiuta il client a sapere quando riprovare                                |
| T6  | **Implementare optimistic UI** per feedback trainee                   | UX più reattiva su mobile in palestra (rete lenta), pattern naturale con TanStack Query |

---

## 7. Assunzioni Non Esplicitate

Le seguenti assunzioni emergono implicitamente dalla documentazione ma non sono dichiarate:

1. ~~**Lingua dell'applicazione**: Si assume italiano~~ ✅ **RISOLTO** (rev 26): Supporto **italiano e inglese** via i18next/next-i18next, struttura per espansione future lingue
2. **Fuso orario**: Le date `Week.startDate`, `ExerciseFeedback.date`, `PersonalRecord.recordDate` non specificano timezone. Si assume UTC o Europe/Rome, ma va dichiarato per evitare bug di visualizzazione
3. **Un solo programma attivo per trainee**: Non c'è un vincolo esplicito UNIQUE su `(traineeId, status='active')` — potenzialmente un trainee potrebbe avere 2 schede active contemporaneamente
4. **Nessuna soft-delete sugli utenti**: `User.isActive` controlla il login, ma `DELETE /api/users/[id]` sembra essere hard delete — conflittuale con GDPR right to erasure (che suggerisce anonimizzazione, non cancellazione)
5. **Trainee non può cambiare trainer**: Non c'è workflow di "riassegnazione" trainee da parte dell'utente stesso
6. **Nessuna limitazione di volumi per il free tier Supabase**: Si assume che 500MB di storage siano sufficienti per la crescita stimata, ma non c'è una proiezione dettagliata della crescita dati (es. 14.400 feedback × N cicli × N anni)
7. **Deploy single-region**: Vercel e Supabase in EU, ma non è specificata la region esatta. Per GDPR si assume `eu-central-1` (Frankfurt) ma va confermato

---

## 8. Domande Aperte

1. ~~Un trainee può essere assegnato a **più trainer contemporaneamente**?~~ ✅ **RISOLTO** (rev 24): Relazione 1:1 confermata
2. ~~Qual è il trigger per la transizione `active → completed`?~~ ✅ **RISOLTO** (rev 24): Automatica dopo endDate
3. ~~Come si gestisce il **versionamento schede**?~~ ✅ **RISOLTO** (rev 25): Non esiste versionamento, schede immutabili
4. ~~Serve supporto **multi-lingua**?~~ ✅ **RISOLTO** (rev 26): Italiano + inglese via i18next
5. **Quale **timezone** si usa per le date** (UTC, Europe/Rome)?
6. Se un trainer viene eliminato, cosa succede ai suoi trainee e schede? Serve una procedura di **handover**?
7. Il trainee può avere **più schede active** contemporaneamente o solo una?
8. È previsto un limite al **numero di esercizi** nella libreria condivisa?
9. ~~Target **WCAG** per accessibilità?~~ ✅ **ACCETTATO** (rev 26): Fuori scope MVP
10. La comunicazione iniziale credenziali via WhatsApp è compatibile con le **policy GDPR** (dato che transita su piattaforma terza)?

---

## 9. Valutazione Complessiva di Maturità

| Dimensione                        | Livello | Note                                                                                                                                                       |
| --------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Documentazione**                | ★★★★★   | Eccellente. Raro trovare un progetto MVP con questo livello di dettaglio, tracciabilità decisioni, e coerenza tra documenti                                |
| **Architettura**                  | ★★★★☆   | Solida, pragmatica, ben dimensionata. Il monolite Next.js è la scelta giusta per la scala. Piccole incoerenze (NextAuth/Supabase, JSON field) da risolvere |
| **Sicurezza**                     | ★★★★☆   | RBAC granulare, GDPR contemplata, session management ben progettato. Rischi residui: rate limiting inefficace (in-memory), password temporanea nel DB      |
| **Data Model**                    | ★★★★☆   | Normalizzato, relazioni pulite, flessibilità tassonomica. Mancano: indexes espliciti, pagination, constraint su scheda attiva unica                        |
| **Testing Strategy**              | ★★★★☆   | Quality gates robuste, copertura E2E su flussi critici, device matrix per ruolo. Manca: accessibility testing, load testing                                |
| **DevOps/CI/CD**                  | ★★★★☆   | 3 ambienti, deploy immutabili, quality gates in CI. Manca: health check, uptime monitoring, backup test procedure                                          |
| **Budget**                        | ★★★★★   | Analisi dettagliata, margine gestito, proiezione crescita, ottimizzazione con branching Supabase                                                           |
| **Readiness per implementazione** | ★★★★☆   | Quasi tutto ciò che serve a uno sviluppatore per iniziare. Mancano: schema Prisma reale, seed strategy, ER diagram                                         |

**Verdict**: Progetto con un livello di maturità documentale **sopra la media** per un MVP. Le criticità identificate sono risolvibili senza impatto architetturale significativo. La combinazione Next.js + Supabase + Vercel è coerente, economica, e adeguata alla scala. Il progetto è pronto per l'implementazione previo allineamento delle ambiguità segnalate.