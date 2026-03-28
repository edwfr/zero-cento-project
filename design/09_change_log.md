# Change Log

> Ogni entry documenta una decisione chiusa. Le decisioni aperte vivono in 08_open_decisions.md.

---

## 2026-03-28 (rev 20)
- **Azione**: Password reset e notifiche email configurate per MVP.
- **Decisione**: Usare **Supabase Email Service** (default, zero setup) per gestione password reset. Email incluse in Supabase Pro (300/mese), template personalizzabili in italiano, flusso automatico con magic link.
- **Primo login trainee**: Comunicazione credenziali temporanee **manualmente** via WhatsApp/telefono da parte del trainer (no email automatica). Trainee fa login → cambio password obbligatorio.
- **Rationale**:
  - ✅ Zero configurazione SMTP per MVP (focus su features core)
  - ✅ Free tier 300 email/mese abbondante per 54 utenti (~110 email/anno stimati)
  - ✅ Comunicazione diretta trainer-trainee già consolidata (WhatsApp)
  - ✅ Evita rischio email benvenuto in spam (nuovo dominio senza reputation)
- **Post-MVP opzionale**: Migrazione a SMTP custom (Resend/SendGrid) per email benvenuto automatica con branding ZeroCento.
- **Effort stimato**: 3.5 ore (UI forgot-password + reset-password + personalizzazione template + test).
- **Decisione**: **OD-33b** chiusa.

---

## 2026-03-27 (rev 19)
- **Azione**: Workflow completo creazione schede con vista alto livello, colori MovementPattern personalizzabili, draft incrementale, pubblicazione con mapping calendario.
- **Requisito**: Trainer deve poter creare schede con approccio top-down: setup iniziale (durata/frequenza) → vista alto livello settimana tipo con distribuzione MovementPattern colorati → dettaglio singoli allenamenti → pubblicazione con scelta data inizio.
- **Workflow implementato**:
  1. **Setup iniziale** (`POST /api/programs`): Trainer definisce durata settimane + allenamenti/settimana. Sistema crea `TrainingProgram` draft + Week + Workout vuoti.
  2. **Vista alto livello** (`/trainer/programs/[id]/week-overview`): Griglia settimana tipo con workout days. Trainer aggiunge esercizi in modalità rapida. UI mostra MovementPattern con colori personalizzati per visualizzare bilanciamento schemi motori (es. 🟣 Squat, 🔵 Push, 🟢 Pull).
  3. **Dettaglio workout** (`/trainer/programs/[id]/workout/[wId]`): Trainer entra nel singolo allenamento, compila dettagli per ogni esercizio (sets, reps, RPE, peso, recupero, note).
  4. **Salvataggio incrementale**: Scheda salvabile infinite volte come `status=draft`. Auto-save ogni 30s. Trainer può chiudere e riprendere dopo.
  5. **Pubblicazione** (`POST /api/programs/[id]/publish`): Trainer sceglie data inizio Week 1 (es. "1 Aprile 2026"). Sistema valida completezza scheda, aggiorna `status=active`, popola `TrainingProgram.startDate` e calcola `Week.startDate` per tutte le settimane (Week 1 = startDate, Week 2 = startDate+7, etc.).
- **Nuove entità DB**:
  - **MovementPatternColor**: Tabella many-to-many (trainerId, movementPatternId, color). Ogni trainer personalizza colori per vista overview.
  - **TrainingProgram.publishedAt** (DateTime?): Timestamp pubblicazione.
  - **TrainingProgram.updatedAt** (DateTime): Per ordinare draft per ultima modifica.
  - **Week.startDate** (Date?): Calcolato automaticamente a pubblicazione. Usato per reportistica (mapping feedback → date reali).
- **Colori MovementPattern**:
  - Tabella `MovementPatternColor` con constraint UNIQUE(trainerId, movementPatternId)
  - Default colors se trainer non ha personalizzazione: Squat=#8b5cf6, Horizontal Push=#3b82f6, Pull=#10b981, etc.
  - Endpoint `PUT /api/trainer/movement-pattern-colors/[patternId]` con body `{color: "#hex"}`
  - Validazione hex color: regex `^#[0-9A-Fa-f]{6}$`
- **Mapping calendario Week → Date**:
  - Pubblicazione richiede `week1StartDate` (es. "2026-04-01")
  - Backend calcola: Week[n].startDate = program.startDate + (n-1)*7 giorni
  - Esempio: Week 1 = 1 Apr, Week 2 = 8 Apr, Week 3 = 15 Apr, ..., Week 12 = 17 Jun
  - Reportistica usa `Week.startDate` + `ExerciseFeedback.date` per correlazione temporale (FRQ/NBL/IM per periodo)
- **Validazione pubblicazione**:
  - Ogni Workout deve avere almeno 1 WorkoutExercise
  - Ogni WorkoutExercise deve avere: sets, reps, weightType, restTime (campi obbligatori)
  - Se validazione fail → `400 Bad Request` con dettaglio workout incompleti
- **Stati scheda**:
  - `draft`: Modificabile, non visibile a trainee, startDate=null
  - `active`: Pubblicata, visibile a trainee, startDate popolato, modifiche bloccate (serve nuova versione)
  - `completed`: Terminata (dopo ultima settimana), archiviabile
- **Nuovi endpoint API**:
  - `POST /api/programs/[id]/publish` con body `{week1StartDate: "YYYY-MM-DD"}`
  - `GET/PUT /api/trainer/movement-pattern-colors/[patternId]`
  - `DELETE /api/trainer/movement-pattern-colors/[patternId]` (reset a default)
- **Nuove pagine frontend**:
  - `/trainer/programs` (lista schede con badge draft/active/completed)
  - `/trainer/programs/[id]/week-overview` (griglia settimana tipo con esercizi colorati per MovementPattern)
  - `/trainer/programs/[id]/publish` (modal scelta data Week 1 + validazione pre-pubblicazione)
  - `/trainer/settings/movement-colors` (color picker per personalizzare MovementPattern)
- **Nuovi componenti**:
  - `WeekOverviewGrid`: Griglia giorni settimana con drag-and-drop esercizi
  - `WorkoutDayColumn`: Colonna singolo giorno con lista esercizi + badge colorati MovementPattern
  - `MovementPatternTag`: Badge con colore custom trainer + nome pattern
  - `ColorPicker`: HEX input + palette predefinita per selezione colori
  - `PublishModal`: Modal con date picker + preview distribuzione settimane + validazione
- **UX vista alto livello**:
  ```
  Week Overview - Settimana Tipo
  ┌─────────────────────────────────────────────────────────┐
  │ Day 1          Day 2          Day 3          Day 4      │
  │ 🟣 Squat       🔵 Bench       🟢 Deadlift    🔴 OHP     │
  │ 🟣 Front Sq    🔵 Incline     🟢 RDL         🟡 Lat R   │
  │ 🟢 Pull-up     🟢 Row         🔵 Dips        🟣 Leg P   │
  │ [+ Add]        [+ Add]        [+ Add]        [+ Add]    │
  └─────────────────────────────────────────────────────────┘
  
  Legend (personalizza colori):
  🟣 Squat  🔵 Push  🟢 Pull  🔴 Hip Ext  🟡 Vertical
  ```
- **Progresso compilazione**:
  UI mostra stato completamento per aiutare trainer:
  ```
  Scheda "Powerlifting 12w" (Draft)
  ✅ Week 1: 4/4 workout completi
  ⚠️  Week 2: 2/4 workout completi  
  🔘 Week 3-12: non iniziate
  
  [Continua] [Pubblica] (disabilitato se incompleta)
  ```
- **Benefici**:
  - ✅ **Vista strategica**: Trainer vede bilanciamento MovementPattern prima di entrare in dettaglio
  - ✅ **Colori personalizzati**: Ogni trainer usa propria codifica colori (utile se multi-metodologia)
  - ✅ **Salvataggio incrementale**: Nessuna perdita lavoro, compilazione in più sessioni
  - ✅ **Pubblicazione controllata**: Trainer decide quando rendere visibile scheda a trainee
  - ✅ **Mapping calendario**: Date reali per reportistica accurata (non solo "Week 1/2/3")
  - ✅ **Validazione pre-pubblicazione**: Previene schede incomplete pubblicate per errore
- **Testing**: Aggiunti test P1 per workflow completo creazione-pubblicazione, P2 per salvataggio draft incrementale, P2 per validazione pubblicazione, P3 per personalizzazione colori
- **Documentazione aggiornata**:
  - 04_data_model.md: Entità MovementPatternColor, campi TrainingProgram/Week aggiornati, sezione "Workflow Creazione Scheda" con esempi step-by-step
  - 02_frontend_design.md: Nuove route workflow schede, nuovi componenti vista overview
  - 03_backend_api.md: Endpoint `/api/programs/[id]/publish` e `/api/trainer/movement-pattern-colors/*`
- **Implicazioni**: Workflow UX ottimizzato per processo reale trainer (top-down: strategia → tattica). Colori personalizzati migliorano usabilità per trainer con metodologie diverse (powerlifting vs bodybuilding). Mapping calendario essenziale per reportistica temporale accurata. Draft incrementale elimina pressione "completare tutto in una sessione".

---

## 2026-03-27 (rev 18)
- **Azione**: Trasformazione gruppi muscolari e schemi motori da enum hardcoded a entità DB gestibili dinamicamente.
- **Requisito**: Admin e trainer devono poter aggiungere/modificare gruppi muscolari e schemi motori senza modificare codice, permettendo personalizzazione tassonomia esercizi.
- **Modello precedente**: 
  - `Exercise.muscleGroups` = JSON array con nomi hardcoded (es. `[{"name": "Pettorali", "coefficient": 0.8}]`)
  - `Exercise.movementPattern` = Enum hardcoded (`squat`, `horizontal_push`, etc.)
  - Modifica/espansione richiedeva deploy codice
- **Modello nuovo**:
  - **Tabella MuscleGroup**: Entità gestibile con `id`, `name`, `description`, `isActive`, `createdBy`
  - **Tabella MovementPattern**: Entità gestibile con `id`, `name`, `description`, `isActive`, `createdBy`
  - **Tabella ExerciseMuscleGroup**: Associazione many-to-many Exercise ↔ MuscleGroup con `coefficient` (0.0-1.0)
  - **Exercise.movementPatternId**: Foreign key a `MovementPattern` (vs enum)
- **Nuove entità DB**:
  ```sql
  MuscleGroup (id, name UNIQUE, description, isActive, createdBy, createdAt)
  MovementPattern (id, name UNIQUE, description, isActive, createdBy, createdAt)
  ExerciseMuscleGroup (id, exerciseId FK, muscleGroupId FK, coefficient Float)
    UNIQUE(exerciseId, muscleGroupId)
  ```
- **Relazioni**:
  - `MuscleGroup` ↔ N `Exercise` via `ExerciseMuscleGroup` (many-to-many con coefficient)
  - `MovementPattern` → N `Exercise` (one-to-many)
- **Permission CRUD**:
  - **Admin**: CRUD completo su gruppi e schemi
  - **Trainer**: CRUD completo (libreria condivisa, come per esercizi)
  - **Trainee**: Solo lettura (per filtri/ricerca)
- **Nuovi endpoint API**:
  - `GET/POST /api/muscle-groups` — Lista/crea gruppi muscolari
  - `PUT /api/muscle-groups/[id]` — Modifica gruppo
  - `PATCH /api/muscle-groups/[id]/archive` — Archivia (isActive=false)
  - `DELETE /api/muscle-groups/[id]` — Elimina (solo se non usato)
  - `GET/POST /api/movement-patterns` — Lista/crea schemi motori
  - `PUT /api/movement-patterns/[id]` — Modifica schema
  - `PATCH /api/movement-patterns/[id]/archive` — Archivia
  - `DELETE /api/movement-patterns/[id]` — Elimina (solo se non usato)
- **Archiviazione soft**:
  - Campo `isActive=false` disabilita gruppo/schema obsoleto senza eliminarlo
  - Preserva integrità referenziale con esercizi esistenti
  - UX: Filtri "Solo attivi" di default, opzione "Mostra archiviati" per admin/trainer
- **Eliminazione fisica**:
  - Bloccata con `409 Conflict` se esistono riferimenti:
    - `MuscleGroup` usato in `ExerciseMuscleGroup` → eliminazione negata
    - `MovementPattern` usato in `Exercise` → eliminazione negata
  - Suggerimento UX: "Archivia invece di eliminare"
- **Seed data iniziale** (migration):
  - Gruppi muscolari base: Pettorali, Dorsali, Deltoidi, Bicipiti, Tricipiti, Quadricipiti, Femorali, Glutei, Core
  - Schemi motori base: Squat, Horizontal Push, Hip Extension, Horizontal Pull, Vertical Pull, Lunge, Other
  - `createdBy` = admin UUID, `isActive` = true
- **Esempi use case**:
  - Trainer specializzato powerlifting aggiunge schema "Sumo Deadlift Variation"
  - Trainer bodybuilding aggiunge gruppo "Obliqui" separato da "Core"
  - Admin archivia schema "Carry" poco usato (isActive=false)
- **Coefficiente incidenza** (ExerciseMuscleGroup):
  - `0.8-1.0`: Muscolo target primario
  - `0.5-0.7`: Muscolo sinergico
  - `0.1-0.4`: Muscolo stabilizzatore
  - Esempio Panca Piana: Pettorali 0.8, Tricipiti 0.5, Deltoidi anteriori 0.3
- **Query aggiornate**:
  - Filtro esercizi per gruppo muscolare: JOIN `ExerciseMuscleGroup` WHERE `muscleGroupId=X`
  - Filtro esercizi per schema motorio: WHERE `movementPatternId=X`
  - Serie allenanti per gruppo: JOIN via `ExerciseMuscleGroup`, sum serie pesate per coefficient
- **Benefici**:
  - ✅ **Flessibilità**: Espansione tassonomia senza deploy codice
  - ✅ **Personalizzazione**: Trainer adattano categorizzazioni a metodologie proprie
  - ✅ **Collaborazione**: Nuovi gruppi/schemi disponibili a tutti i trainer
  - ✅ **Integrità**: Archiviazione soft preserva storico senza rompere riferimenti
  - ✅ **Audit trail**: `createdBy` traccia autore gruppo/schema
- **Testing**: Aggiunti test P2 per CRUD gruppi/schemi, P2 per archiviazione, P2 per blocco eliminazione con riferimenti, P3 per filtri esercizi per gruppo/schema
- **Documentazione aggiornata**:
  - 04_data_model.md: Nuove entità MuscleGroup, MovementPattern, ExerciseMuscleGroup con schema e relazioni; sezione "Gruppi Muscolari Gestibili" e "Schemi Motori Gestibili" con esempi seed
  - 05_security_auth.md: Matrice permessi con nuove righe "Gruppi muscolari" e "Schemi motori" CRUD per admin/trainer; sezione "Dettaglio gruppi muscolari e schemi motori condivisi"
  - 03_backend_api.md: Nuovi gruppi endpoint `/api/muscle-groups` e `/api/movement-patterns` con authorization notes
- **Implicazioni**: Architettura data-driven per tassonomia esercizi. Elimina necessità modifiche codice per aggiungere categorizzazioni. Trainer autonomi nella gestione metadata esercizi. Sistema scalabile per metodologie training diverse (powerlifting, bodybuilding, crossfit, etc.).

---

## 2026-03-27 (rev 17)
- **Azione**: Strategia session management per allenamenti lunghi (60-90+ min) senza re-login.
- **Requisito**: Trainee usa app in palestra con frequente app switching (Instagram, musica, timer) durante recuperi tra serie. Sistema deve mantenere sessione attiva senza interruzioni.
- **Contesto d'uso utenti**:
  - **Trainer**: Accesso sporadico (15-30 min) per creazione contenuti (profili, schede) da desktop
  - **Trainee**: Accesso continuativo (60-90+ min) durante allenamento in palestra da mobile, con app in background durante recuperi
- **Session strategy**:
  - **Access Token JWT**: 4 ore expiry (copre allenamento 90min + ampio margine)
  - **Refresh Token**: 30 giorni expiry (utente non deve rifare login ogni giorno)
  - **Auto-refresh**: Supabase Auth rinnova automaticamente access token usando refresh token prima della scadenza
  - **Persist session**: Cookie HTTP-only + `persistSession: true` mantiene sessione anche dopo chiusura browser
- **Configurazione Supabase Auth**:
  ```typescript
  {
    jwt: { expiryDuration: 14400 },      // 4 ore
    refreshToken: { expiryDuration: 2592000 }, // 30 giorni
    autoRefreshToken: true,
    persistSession: true
  }
  ```
- **Workflow tipico trainee**:
  1. Login 10:00 → access token valido fino 14:00
  2. Allenamento 10:30-12:00 → app switcha tra esercizi + Instagram + timer
  3. Sessione rimane attiva (access token valido)
  4. Riapre app 14:30 → access token scaduto → Supabase auto-refresh con refresh token → nuovo access token → user rimane loggato senza interruzione
  5. Dopo 30 giorni inattività → refresh token scade → richiesto login (ragionevole)
- **PWA (Progressive Web App) per trainee**:
  - **Installazione**: Web App Manifest per icona home screen, modalità standalone (no browser UI), portrait lock
  - **Offline support**: Service Worker con cache strategy (scheda corrente cache-first, feedback network-first con queue)
  - **State persistence**: localStorage per feedback parziali (auto-save ogni 5s, ripristino dopo app switch)
  - **Install prompt**: Mostrato solo su mobile (<768px) per trainee, suggerisce installazione per accesso rapido
- **Protezione sicurezza**:
  - Cookie `Secure` (HTTPS only), `HttpOnly` (no JS access), `SameSite=Lax` (CSRF protection)
  - Refresh token rotation: Supabase genera nuovo refresh token ad ogni refresh, invalida vecchio (anti replay attack)
- **State persistence feedback**:
  - Hook `useFeedbackPersistence(workoutExerciseId)` salva draft in localStorage ogni 5s
  - Ripristina automaticamente form se trainee switcha app e torna
  - Auto-clear draft dopo 24h (evita accumulo storage)
- **Benefici**:
  - ✅ **Zero friction**: Trainee non deve mai rifare login durante allenamento
  - ✅ **App switching seamless**: Passa tra app senza perdere stato
  - ✅ **Dati sicuri**: Feedback parziale salvato, recuperabile dopo crash/chiusura accidentale
  - ✅ **Esperienza nativa**: PWA installabile con icona home screen, full-screen
  - ✅ **Offline capable**: Scheda consultabile anche senza rete (palestre con WiFi scarso)
- **Implicazioni tecniche**:
  - `next-pwa` package per generazione service worker
  - Web App Manifest in `/public/manifest.json`
  - Service Worker strategy: Workbox con NetworkFirst per API, CacheFirst per assets
  - Hook `useLocalStorage` per persistence feedback drafts
  - Component `InstallPrompt` per suggerire installazione PWA
- **Testing**: Aggiunti test P2 per session expiry + auto-refresh, P3 per PWA install prompt, P3 per feedback draft persistence
- **Documentazione aggiornata**:
  - 00_problem_statement.md: Sezione "Contesto d'uso" con dettaglio sessioni trainer/trainee
  - 05_security_auth.md: Sezione "Session Management per Allenamenti Lunghi" con configuration, workflow, security
  - 02_frontend_design.md: Sezione "PWA (Progressive Web App) per Trainee" con manifest, service worker, state persistence
- **Implicazioni**: UX trainee ottimizzata per uso reale palestra. Session 4h + auto-refresh elimina frustrazione re-login. PWA offre esperienza app nativa senza development iOS/Android. State persistence protegge lavoro utente da perdita dati accidentale. Strategia allineata con best practice mobile fitness apps.

---

## 2026-03-27 (rev 16)
- **Azione**: Libreria esercizi da privata per trainer a CONDIVISA tra tutti i trainer.
- **Requisito**: Gestione collaborativa libreria esercizi — tutti i trainer devono poter creare, modificare, eliminare qualsiasi esercizio.
- **Modello precedente**: Esercizi creati da trainer erano modificabili solo dal creatore (ownership via `Exercise.createdBy`)
- **Modello nuovo**: **Libreria condivisa** — tutti i trainer possono CRUD su TUTTI gli esercizi
- **Permission aggiornate**:
  - **Admin**: CRUD su qualsiasi esercizio
  - **Trainer**: CRUD su **qualsiasi esercizio** nella libreria (non solo i propri)
  - **Trainee**: Solo lettura (per consultare video/descrizioni durante allenamento)
  - Campo `Exercise.createdBy` mantenuto solo per **audit trail** (tracciabilità autore originale), **non determina ownership**
- **Autorizzazione backend**:
  - `GET /api/exercises`: accessibile a tutti (trainer per comporre schede, trainee per consultazione)
  - `POST /api/exercises`: solo admin e trainer (nuovo esercizio immediatamente disponibile a tutti)
  - `PUT /DELETE /api/exercises/[id]`: solo admin e trainer su **qualsiasi esercizio**
  - Validazione: verifica `role IN ('admin', 'trainer')`, **non** verifica `createdBy = current_user`
- **Protezione integrità**: Eliminazione esercizio usato in `WorkoutExercise` restituisce `409 Conflict` (foreign key constraint)
- **Rationale**:
  - ✅ **Collaborazione**: Trainer possono beneficiare degli esercizi creati da colleghi
  - ✅ **Evita duplicazione**: No bisogno di ricreare "Squat" per ogni trainer
  - ✅ **Libreria ricca**: Si arricchisce organicamente con contributi di tutti
  - ✅ **Manutenzione condivisa**: Correzione errori (es. link YouTube rotto) disponibile a tutti immediatamente
- **UX implications**:
  - Pagina `/trainer/exercises`: mostra TUTTI gli esercizi (non filtro per `createdBy`)
  - Badge "Creato da [Nome Trainer]" per tracciabilità visuale
  - Bottoni Edit/Delete attivi su qualsiasi esercizio (non solo propri)
  - Warning prima di eliminare: "Questa azione influenzerà tutti i trainer che usano questo esercizio"
- **Testing**: Aggiunti test P2 per verifica permission condivise (trainer A modifica esercizio creato da trainer B, successo 200; trainer A elimina esercizio trainer B, successo 200; trainee tenta modificare esercizio, 403; trainer elimina esercizio usato in scheda attiva, 409 Conflict)
- **Implicazioni**: Modello collaborativo aumenta valore piattaforma. Libreria evolve più rapidamente. Responsabilità condivisa richiede disciplina (no eliminazioni accidentali). Audit trail via `createdBy` mantiene tracciabilità.

---

## 2026-03-27 (rev 15)
- **Azione**: Chiusura completa stack Deploy, Scaling, Testing (OD-33, OD-34, OD-36, OD-37, OD-38, OD-39, OD-40, OD-41).
- **OD-33 - Ambienti**: 
  - **3 ambienti definiti**: Production (`prod.zerocento.app`), Staging (`test.zerocento.app`), Dev (`dev-*.zerocento.app`)
  - **Supabase Database Branching**: 1 progetto Pro con branch `main`, `staging`, `dev` (GRATIS, incluso in Pro)
  - **Strategia ottimizzazione costi**: Branch `staging` sempre attivo per QA, branch `dev` PAUSABILE quando non serve → €0 compute
  - **Verosimiglianza test**: Branch staging è clone esatto di main (stesso schema, seed dati realistici)
  - **Deployment URLs**: Preview deployments GRATIS illimitati con Vercel Pro (es. `pr-42.zerocento.app`)
- **OD-34 - CI/CD**:
  - **GitHub Actions attivo**: Workflow automatizzato per lint, type-check, unit test, E2E
  - **Deployment flow**: Feature branch → PR staging (unit tests) → auto-deploy test.zerocento.app (E2E) → PR main (se E2E GREEN) → deploy prod.zerocento.app
  - **Branch protection**: Main e staging protetti, require status checks (test + e2e-staging), manual approval opzionale su main
  - **Pipeline completa**: `.github/workflows/ci.yml` con jobs `test` (lint/typecheck/unit coverage 80%), `e2e-staging` (Playwright su test.zerocento.app), `deploy-prod` (conditional su main)
- **OD-36 - Connection Pooling**:
  - **Bottleneck risolto**: Supabase PgBouncer (port 6543, transaction pooling) incluso in Pro (GRATIS)
  - **Configurazione Prisma**: `connection_limit=10` per instance, `DATABASE_URL` pooled (port 6543), `DIRECT_URL` direct (port 5432 solo migrations)
  - **Capacity analysis**: 54 utenti → ~10 req/min peak → max 30 connessioni attive → PgBouncer riutilizza 15 connessioni PostgreSQL reali → **nessun bottleneck previsto**
  - **Monitoring**: Supabase Dashboard alerta se connessioni >80% pool (75/100)
  - **Scalabilità**: Architettura gestisce fino a ~500 utenti con stesso setup (trigger upgrade: Prisma Accelerate solo se >500 utenti)
- **OD-37 - Budget**:
  - **Budget disponibile**: €50/mese
  - **Costi effettivi**: €45-48/mese (Vercel Pro €20 + Supabase Pro €25 + Sentry free €0 + Supabase dev branch €0-3)
  - **Margine**: €2-5/mese per imprevisti (bandwidth extra, storage growth)
  - **Costo per utente**: €0,83/utente/mese (€45 ÷ 54 utenti)
  - **Ottimizzazione**: 1 progetto Supabase con branching (vs 2 progetti = €50 → SFORAVA budget), pause dev branch, preview deployments gratis, rate limiting in-memory (no Redis necessario)
  - **Proiezione crescita**: 150 utenti = stesso costo (€45), 500 utenti = +€5-10, >1000 utenti = +€55 (necessari upgrade)
- **OD-38 - Framework Unit Test**:
  - **Libreria**: **Vitest** confermato (best-in-class Next.js/React, performance 10-20x Jest, coverage nativo, TypeScript first-class)
  - **Rationale**: API Jest-compatible, vastissima coverage AI (crescita 2023-26), hot module reload, parallel execution nativo
  - **Target**: Business logic (calcoli volume/RPE/massimali, validazioni Zod, helpers, permission checks, custom hooks)
  - **Esclusi da unit**: Config files, componenti UI puri, layouts/loading/error, API Routes boilerplate (testati con E2E)
- **OD-39 - Framework E2E**:
  - **Libreria**: **Playwright** confermato in scope MVP
  - **Flussi critici obbligatori**: Creazione utente (admin/trainer → trainee), creazione scheda multi-settimana, pubblicazione scheda a trainee, invio feedback con serie multiple
  - **Device matrix ottimizzata**: Desktop 1440px per admin/trainer (full suite), Mobile 390px per trainee (full suite), altri device solo smoke tests
  - **Configurazione**: Multi-browser (Chromium/Firefox), auto-wait, screenshot on failure, trace on first retry
- **OD-40 - Coverage minimo**:
  - **Soglia**: **80%** su lines/branches/functions/statements (standard industry per progetti seri)
  - **Enforced in CI**: Check bloccante su GitHub Actions, PR fallisce se coverage <80%
  - **Report**: Vitest coverage con @vitest/coverage-v8, report HTML locale + JSON per CI
  - **Esclusioni**: Config, layouts, UI puri, type definitions (vedi vitest.config.ts exclude patterns)
- **OD-41 - E2E in CI**:
  - **Esecuzione**: **Sì, in CI, bloccante per deploy prod**
  - **Quando**: E2E girano su `test.zerocento.app` dopo ogni deploy staging (branch staging)
  - **Deployment gate**: PR `staging → main` richiede E2E GREEN come status check obbligatorio; se E2E fail → merge BLOCCATO → deploy prod IMPOSSIBILE
  - **Workflow**: Feature branch (unit only) → PR staging (unit + E2E su test) → PR main (require E2E green) → deploy prod
  - **Performance**: E2E solo su staging (non su ogni feature branch), ~5-10min runtime, 2 retries in CI
- **Implicazioni architetturali**:
  - **Zero costi extra per ambienti**: Supabase branching + Vercel preview deployments inclusi in piani Pro (€45 totale vs €70 con 2 progetti)
  - **QA verosimile**: Branch staging con dati realistici, ambiente test identico a prod (stessi constraint DB, stesso runtime Vercel)
  - **Quality gates robusti**: Unit 80% + E2E pass obbligatori → deploy prod impossibile se quality regression
  - **Developer experience**: Feature branch → preview URL immediato (per review UI), unit tests rapidi (Vitest), E2E solo quando merge staging (no wait su ogni push)
  - **Monitoraggio production-ready**: Sentry error tracking, Vercel analytics, Supabase connection pool monitoring
- **Documentazione aggiornata**:
  - 06_deploy_and_scaling.md: Sezioni "Ambienti 3-tier", "Supabase Database Branching setup", "CI/CD GitHub Actions workflow", "Connection Pooling dettaglio", "Budget breakdown"
  - 07_testing_strategy.md: Sezioni "Unit Testing Vitest", "E2E Testing Playwright", "Automazione e Coverage", esempi codice completi
  - 08_open_decisions.md: OD-33/34/36/37/38/39/40/41 marcate [x] con riassunto decisioni
- **Implicazioni**: Tutti gli open decision chiusi. Architettura deploy production-ready con 3 ambienti isolati. Testing strategy completa (unit 80% + E2E critici). Budget ottimizzato sotto €50/mese. CI/CD automatizzato con quality gates. Developer può iniziare implementazione con specifiche complete.

---

## 2026-03-27 (rev 14)
- **Azione**: Chiusura OD-21 (Rate Limiting) e OD-22 (Logging Strutturato).
- **OD-21 - Rate Limiting**: 
  - **Soluzione MVP**: Middleware Next.js custom con in-memory store
  - **Limiti definiti**: 
    - Auth login: 5 tentativi / 15 minuti (prevenzione brute-force)
    - Auth signup: 3 registrazioni / ora (prevenzione spam)
    - Feedback: 30 richieste / minuto (realistico per workflow trainee)
    - Creazione utenti: 20 trainee / ora per trainer
    - API autenticate generiche: 100 richieste / minuto per utente
    - API pubbliche: 20 richieste / minuto per IP
  - **Rationale**: In-memory sufficiente per scala MVP (54 utenti), zero dipendenze esterne, setup immediato
  - **Limitazioni**: State volatile (reset ad ogni deploy), non condiviso tra istanze serverless (ok per Vercel single-region)
  - **Evoluzione post-MVP**: Upstash Redis per persistence, multi-region support, analytics avanzate
  - **Implementazione**: Middleware in `middleware.ts` con Map() JavaScript, chiavi per IP (non autenticati) o userId (autenticati), HTTP 429 con messaggio user-friendly
- **OD-22 - Logging Strutturato**:
  - **Libreria**: **Pino** — logger Node.js high-performance, output JSON strutturato, vastissima coverage AI
  - **Livelli abilitati**:
    - **Development**: DEBUG, INFO, WARN, ERROR (con pino-pretty per output colorato)
    - **Production**: INFO, WARN, ERROR (DEBUG disabilitato per ridurre noise e costi)
  - **Rationale**: Pino è lo standard de facto per logging Node.js serverless, performance eccellenti, structured logging nativo
  - **Error tracking**: Integrazione **Sentry** (free tier 5K eventi/mese) per alerting, source maps, user impact analysis
  - **Pattern logging**: Context ricco con userId, action, timestamp su ogni log; no dati sensibili (password, token); stack trace su errori
  - **Visualizzazione**: Vercel Dashboard per log real-time (retention 1 giorno free, 7 giorni Pro); Sentry dashboard per errori critici con alerting
  - **Best practices**: Log eventi chiave (login, creazione risorse, errori), evita log eccessivi in prod, monitora Sentry quota
- **Implicazioni tecniche**:
  - Rate limiting: file `middleware.ts` con matcher `/api/:path*`, response 429 con error code standard, frontend gestisce 429 con toast user-friendly
  - Logging: file `lib/logger.ts` con config Pino, import in ogni API Route, wrapper `logger.info/warn/error()` con structured data
  - Sentry: `sentry.server.config.ts` + `@sentry/nextjs`, captureException con context (tags, user, extra), alerting configurabile
- **Costi stimati**: 
  - Rate limiting in-memory: €0 (nessuna dipendenza esterna)
  - Pino logging: €0 (libreria open source)
  - Sentry free tier: €0 fino a 5K errori/mese (ampiamente sufficiente MVP)
  - Vercel log retention: incluso in piano Pro (7 giorni)
- **Documentazione aggiornata**: 03_backend_api.md con sezioni dettagliate "Rate Limiting" e "Logging Strutturato" (implementazione, pattern, esempi codice)
- **Implicazioni**: Backend protetto da abusi con rate limiting granulare. Logging strutturato garantisce diagnostica errori efficace e monitoring production. Sentry free tier per alerting critici. Setup immediato, zero costi aggiuntivi, coverage AI ottima.

---

## 2026-03-27 (rev 13)
- **Azione**: Rinominazione globale del ruolo "Coach" in "Trainer".
- **Rationale**: Standardizzazione terminologia per chiarezza semantica - "Trainer" è più comunemente utilizzato nel contesto fitness/sportivo per chi allena atleti.
- **Modifiche pervasive**:
  - Ruolo: `coach` → `trainer` (enum User.role, matrice permessi, API endpoints)
  - Route frontend: `/coach/*` → `/trainer/*` (tutte le pagine trainer)
  - Entità DB: `CoachTrainee` → `TrainerTrainee` (tabella associazione)
  - Campi: `coachId` → `trainerId` in tutte le entità (Exercise.createdBy, TrainingProgram, TrainerTrainee)
  - Endpoint API: `/api/coach/*` → `/api/trainer/*` (records trainee, etc.)
  - Testo documentazione: "coach" → "trainer", "Coach" → "Trainer" in tutti i file
- **File aggiornati**: Tutti i file di design (00-09) con sostituzione sistematica
- **Impatto implementazione**:
  - Schema Prisma: rinominare entità `CoachTrainee` → `TrainerTrainee`, campo `coachId` → `trainerId`
  - Backend: aggiornare route `/api/coach/` → `/api/trainer/`, validazione enum `role=trainer`
  - Frontend: rinominare directory `/coach/` → `/trainer/`, aggiornare navigation, labels UI
  - Testing: aggiornare test case con nuova terminologia
- **Nessun impatto funzionale**: Pura rinominazione, logica di business invariata
- **Implicazioni**: Terminologia più chiara e allineata al dominio fitness. Migliore UX per utenti finali (terminologia standard del settore).

---

## 2026-03-27 (rev 12)
- **Azione**: Definizione permission granulari per disabilitazione trainee.
- **Requisito**: Admin può disabilitare qualsiasi trainee; trainer può disabilitare solo i propri trainee (isolamento).
- **Permission disabilitazione**:
  - **Admin**: può disabilitare/riabilitare **qualsiasi trainee** del sistema (campo `User.isActive`)
  - **trainer**: può disabilitare/riabilitare **solo i propri trainee** (verifica via `TrainerTrainee`)
  - **trainer NON può**: visualizzare né disabilitare trainee assegnati ad altri trainer
  - **Trainee**: nessun accesso a funzioni di gestione utenti
- **Validazione backend**:
  - Endpoint: `PATCH /api/users/[id]/deactivate` e `/activate`
  - trainer request: verifica esistenza `TrainerTrainee.trainerId = current_user AND TrainerTrainee.traineeId = target_user`
  - Se trainer tenta disabilitare trainee di altro trainer: **403 Forbidden**
- **Effetto disabilitazione**: 
  - Trainee con `isActive=false` non può effettuare login
  - Redirect a login page con messaggio: "Account disabilitato, contatta il tuo trainer"
- **Implicazioni UX**:
  - Admin UI: lista utenti mostra stato attivo/disabilitato per tutti i trainee, toggle disponibile
  - trainer UI: lista trainee mostra solo propri trainee con stato, toggle abilitato solo per i propri
  - trainer UI non mostra trainee di altri trainer (isolamento dati)
- **Testing**: Aggiunti test P2 per disabilitazione (trainer proprio trainee, trainer trainee altrui con 403, admin qualsiasi trainee, login trainee disabilitato)
- **Implicazioni**: Isolamento dati garantito anche per azioni di disabilitazione. trainer mantiene autonomia operativa sui propri atleti senza interferire con altri trainer. Admin ha visibilità e controllo globale.

---

## 2026-03-27 (rev 11)
- **Azione**: Definizione granulare permission per creazione utenti basata su ruolo.
- **Matrice creazione utenti**:
  - **Admin**: può creare utenti con ruolo `trainer` E utenti con ruolo `trainee`
  - **trainer**: può creare **solo** utenti con ruolo `trainee` (i propri atleti)
  - **Trainee**: **non può** creare alcun utente
- **Rationale**: 
  - Admin ha controllo completo della piattaforma e può onboardare nuovi trainer
  - trainer ha autonomia operativa per aggiungere i propri atleti senza coinvolgere admin
  - Trainee non ha bisogno di creare utenti (ruolo consumer)
- **Dettaglio gestione (RUD)**:
  - **Admin**: full CRUD su tutti gli utenti del sistema
  - **trainer**: può modificare/eliminare solo i trainee a lui assegnati (via `TrainerTrainee`)
  - **Trainee**: nessun accesso a funzioni di gestione utenti
- **Implicazioni tecniche**:
  - Endpoint `POST /api/users` richiede check su `role` nel body:
    - Se `role=trainer`: verificare che richiedente sia `admin`
    - Se `role=trainee`: verificare che richiedente sia `admin` O `trainer`
    - Se `role=admin`: **bloccato** (admin creabile solo via seed/migration)
  - trainer che crea trainee: sistema crea automaticamente record `TrainerTrainee` per associazione
  - Frontend: pagina `/admin/users/new` mostra dropdown ruolo con `trainer` e `trainee`, `/trainer/trainees/new` crea solo trainee
- **Aggiornamenti file**:
  - 05_security_auth.md: matrice permessi espansa con dettaglio creazione + gestione utenti
  - 03_backend_api.md: sezione "Utenti" rinominata in "Utenti (Admin + trainer)" con note autorizzazione
  - 02_frontend_design.md: aggiunta pagina `/admin/users/new`, corretta pagina trainer `/trainer/trainees/new`
- **Implicazioni**: Permission granulare garantisce separazione responsabilità e autonomia operativa trainer. Validazione ruolo sul backend previene privilege escalation. UX riflette i permessi effettivi (trainer non vede opzione per creare altri trainer).

---

## 2026-03-27 (rev 10)
- **Azione**: Definizione strategia UX differenziata per ruolo - ottimizzazione device-specific.
- **Rationale**: Casi d'uso reali richiedono esperienze ottimizzate per device diversi:
  - **Admin/trainer**: workflow di creazione contenuti complessi (editor schede multi-settimana, gestione libreria, analytics) → ottimale su desktop con schermi ampi, mouse/keyboard
  - **Trainee**: consultazione scheda e inserimento feedback durante allenamento in palestra → ottimale su mobile portrait, input touch rapido
- **Strategia implementata**:
  - **Admin/trainer → Desktop-first** (1280px+):
    - Layout: Sidebar persistente, tabelle multi-colonna, drag-and-drop avanzato, dashboard dense
    - Componenti: `WorkoutProgramBuilder` con editor complesso, tabelle estese, form multi-step con preview
    - Responsive: funzionale su tablet landscape, **non ottimizzato per mobile portrait**
  - **Trainee → Mobile portrait-first** (360px-428px):
    - Layout: Single column, CTA prominenti (min 44px), bottom navigation, sticky header
    - UX mobile-centric: cards a stack verticale, form ottimizzati per input rapido (stepper +/- per kg/reps), swipe gestures, bottom sheet
    - Componenti: `FeedbackForm` ottimizzato touch, bottom tab bar navigation
    - Responsive: usabile su desktop ma esperienza primaria per telefono
- **Implicazioni tecniche**:
  - Hook custom `useRoleLayout()` per classi CSS condizionali basate su ruolo
  - Componenti role-aware: MUI `DataGrid`/`Drawer` per Admin/trainer, MUI `BottomNavigation`/`SwipeableDrawer` per Trainee
  - Testing responsive differenziato: desktop 1280-1920px per Admin/trainer, mobile 360-428px per Trainee
  - Vincolo UX documentato in 00_problem_statement.md
- **Nota importante**: Entrambe le esperienze rimangono **responsive** e funzionali su tutti i device, ma l'ottimizzazione UX è polarizzata per il caso d'uso principale.
- **Implicazioni**: Design polarizzato chiarisce priorità implementative. Nessun compromesso UX necessario: ogni ruolo ottiene l'esperienza migliore per il suo workflow reale. Testing strategy aggiornata con device target specifici.

---

## 2026-03-27 (rev 9)
- **Azione**: Integrazione completa data model dettagliato con informazioni raccolte dal documento note.txt.
- **Data Model - Arricchimento entità**:
  - **Exercise**: Aggiunti campi `muscleGroups` (Json array con coefficienti d'incidenza 0.0-1.0), `type` (fundamental/accessory per SBD), `movementPattern` (schema motorio: squat, push, pull, ecc.), `notes` (array varianti)
  - **TrainingProgram**: Aggiunto `workoutsPerWeek` (n allenamenti per m settimane)
  - **Week**: Aggiunti `feedbackRequested` (marcatura settimane rilevanti) e `generalFeedback` (commento testuale settimana)
  - **WorkoutExercise**: Arricchito con `targetRpe` (Float 5.0-10.0 incrementi 0.5), `weightType` (Enum: absolute/percentage_1rm/percentage_rm), `restTime` (Enum: 30s/1m/2m/3m/5m), `isWarmup` (Boolean), supporto `reps` come intervallo (es. "6/8")
  - **ExerciseFeedback**: Aggiunto `setsPerformed` (Json array con {reps, weight} per ogni serie), `actualRpe` (Float 5.0-10.0)
  - **User**: Separato `name` in `firstName` e `lastName`, aggiunti `isActive` (profilo attivo/disattivato) e `initialPassword` (per gestione password generate da trainer)
  - **Nuova entità PersonalRecord**: Gestione massimali (1RM o nRM) per trainee/esercizio con storico date
- **Backend API - Nuovi endpoint**:
  - `/api/trainee/records/*` - CRUD massimali personali
  - `/api/trainer/trainees/[id]/records` - trainer visualizza massimali trainee
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
  - Pagine: `/trainer/trainees/[id]/create` (crea trainee + genera password), `/trainee/records` (gestione massimali), `/trainer|trainee/reports` (reportistica)
  - Componenti: `MuscleGroupBadge`, `MovementPatternIcon`, `SetInput`, `PersonalRecordCard/Form`, `SBDReportChart`, `TrainingVolumeChart`, `RPESelector`, `RestTimeSelector`, `RepsInput`
- **Security - Gestione password iniziali**:
  - Flusso sicuro per trainer che crea trainee: generazione password temporanea, visualizzazione una-tantum, encrypted storage opzionale, cambio obbligatorio al primo login
  - Pattern implementativo documentato in 05_security_auth.md
- **Testing - Nuovi flussi critici**:
  - P1: trainer crea profilo trainee con password, trainee aggiunge massimale
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
- **Dominio definito**: piattaforma training web (Next.js + Vercel), 3 ruoli (admin/trainer/trainee), scala iniziale 54 utenti.
- **Entità di dominio definite**: User, TrainerTrainee, Exercise, TrainingProgram, Week, Workout, WorkoutExercise, ExerciseFeedback.
- **Prossimi passi**: chiudere le decisioni aperte rimanenti (OD-14 UI lib, OD-24 DB engine, OD-25 ORM, OD-28/29 auth provider, OD-04 scope OUT).

---

## 2026-03-27 (rev 1)
- **Azione**: Prima revisione dell'intero set di documenti di design.
- **Esito**: Tutti i file risultano scaffold vuoti. Nessuna decisione ancora consolidata.
