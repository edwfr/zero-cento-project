# Open Decisions

> Formato: `[ ]` = aperta · `[~]` = in discussione · `[x]` = chiusa (vedi 09_change_log.md)

---

## 00 — Problem Statement

- [x] **OD-01** Chi è l'utente primario? → trainer (crea schede) e Trainee (esegue e dà feedback).
- [x] **OD-02** Esistono utenti secondari? → Admin (gestione anagrafiche).
- [x] **OD-03** Valore concreto? → Centralizzare gestione schede multi-settimana e raccolta feedback trainer↔trainee.
- [x] **OD-04** Scope OUT (funzionalità escluse dall'MVP)? → Pagamenti, app nativa (solo web responsive mobile-friendly), chat trainer-trainee, nutrizione.
- [x] **OD-05** Vincoli tecnologici → Next.js (App Router) + Vercel.
- [x] **OD-06** Vincoli temporali / milestone principali? → Nessuno al momento.
- [x] **OD-07** Vincoli organizzativi (team size, processi di approvazione)? → Nessuno.

---

## 01 — Architecture Overview

- [x] **OD-08** Stack → Next.js full-stack (frontend + API Routes / Server Actions).
- [x] **OD-09** Hosting → Vercel.
- [x] **OD-10** Architettura → monolite applicativo Next.js su infrastruttura serverless Vercel.
- [x] **OD-11** BFF → Next.js è il BFF; nessun servizio backend separato.
- [x] **OD-12** Rischi architetturali → dettagliati in 01_architecture_overview.md (cold start BASSO con Vercel Pro, connection pooling MEDIO - richiede configurazione).

---

## 02 — Frontend Design

- [x] **OD-13** Pagine principali → definite per ruolo (admin/trainer/trainee) in 02_frontend_design.md.
- [x] **OD-14** Libreria UI → **Tailwind CSS** (coverage AI ottima) + **Material UI (MUI)** (vastissima documentazione nei training data, componenti accessibili pronti). Alternativa: shadcn/ui se si preferisce modernità.
- [x] **OD-15** State management → **TanStack Query** per server state (ottima coverage AI, pattern consolidati) + **Context API** per state globale semplice (React nativo, nessuna dipendenza).
- [x] **OD-16** Gestione form → **React Hook Form** + **Zod** (standard de facto, altissima presenza training data AI, pattern validation consolidati).
- [x] **OD-17** SSR vs SPA → Next.js App Router usa SSR/RSC di default; client components per parti interattive.

---

## 03 — Backend & API

- [x] **OD-18** Stile API → **REST** con endpoint HTTP standard. Coverage AI eccellente, pattern consolidati, semantics chiare. Server Actions opzionali per form.
- [x] **OD-19** Validazione input → **Zod** confermato. Schema riutilizzabili, type-safety, integrazione React Hook Form.
- [x] **OD-20** Formato standard errori API → definito in 03_backend_api.md (`{data}` per success, `{error: {code, message, details?}}` per errori).
- [x] **OD-21** Rate limiting / throttling? → **Middleware custom Next.js** con in-memory store per MVP. Limiti: 5 tentativi/15min su auth, 30 req/min su feedback, 100 req/min per utente autenticato. Upstash Redis opzionale per production scaling.
- [x] **OD-22** Logging strutturato: soluzione e livelli? → **Pino** per logging strutturato JSON. Livelli prod: INFO, WARN, ERROR (DEBUG solo dev). Integrazione **Sentry** (free tier) per error tracking e alerting.

---

## 04 — Data Model

- [x] **OD-23** Entità principali → User, TrainerTrainee, Exercise, TrainingProgram, Week, Workout, WorkoutExercise, ExerciseFeedback, PersonalRecord.
- [x] **OD-24** DB engine → **Supabase PostgreSQL**. Connection pooling PgBouncer incluso, dashboard admin ricca, free tier 500MB, coverage AI eccellente.
- [x] **OD-25** ORM → **Prisma**. Type-safety automatica, schema dichiarativo, Prisma Studio, migrations robuste, coverage AI eccellentissima.
- [x] **OD-26** Strategia migrazioni → **Prisma Migrate** con migration files. Trackable (Git), rollback-capable, environment-safe (DIRECT_URL per migrations).
- [x] **OD-27** Crescita dati → ~14.400 WorkoutExercise + ~14.400 Feedback nel primo ciclo (50 trainee × 1 scheda × 12 settimane × 4 allenamenti × 6 esercizi). Dimensioni molto contenute, nessuna ottimizzazione sharding necessaria.

---

## 05 — Security & Auth

- [x] **OD-28** Metodo autenticazione → **Email+password** per MVP (Supabase Auth). OAuth (Google/GitHub) e Magic Link opzionali post-MVP.
- [x] **OD-29** Provider auth → **Supabase Auth**. Integrazione nativa Supabase, JWT session, coverage AI ottima, zero setup auth infra. Collegamento auth.users ↔ public.User.
- [x] **OD-30** Ruoli → `admin` · `trainer` · `trainee`. Matrice permessi in 05_security_auth.md.
- [x] **OD-31** Gestione segreti → **Vercel Environment Variables** confermate (DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc). No vault necessario per MVP.
- [x] **OD-32** Compliance GDPR → Dettagliato in 05_security_auth.md. Requisiti MVP: Cookie consent banner, Privacy Policy + Terms, Delete Account feature, Supabase region EU, data retention policy. Checklist implementativa completa.
- [x] **OD-33b** Password reset e notifiche email → **Supabase Email Service** (default) per MVP. Password reset automatico con email Supabase incluse (300/mese free tier). Primo login: trainer comunica credenziali temporanee manualmente (WhatsApp/telefono). Email benvenuto automatica opzionale post-MVP con SMTP custom (Resend/SendGrid).

---

## 06 — Deploy & Scaling

- [x] **OD-33** URL produzione e accessi ambienti? → **3 ambienti**: `prod.zerocento.app` (sempre attivo), `test.zerocento.app` (staging sempre attivo), `dev-*.zerocento.app` (preview pausabili). Supabase Database Branching (main/staging/dev) per isolamento dati.
- [x] **OD-34** CI/CD → **GitHub Actions** attivo per test automatici pre-deploy. Workflow: unit test + E2E su ogni PR, deploy staging auto, deploy prod dopo E2E pass su staging.
- [x] **OD-35** Strategia deploy → deploy immutabili Vercel con rollback istantaneo (risolto da piattaforma).
- [x] **OD-36** Bottleneck → DB connection pooling risolto con **Supabase PgBouncer** (incluso in Pro plan) + Prisma `connection_limit=10`. Nessun bottleneck previsto per scala MVP (54 utenti).
- [x] **OD-37** Budget infrastrutturale mensile stimato? → **€45-48/mese**: Vercel Pro €20 + Supabase Pro €25 (include branching staging/dev gratis) + Sentry free tier €0. Sotto budget €50 con €2-5 margine.

---

## 07 — Testing Strategy

- [x] **OD-38** Framework unit test → **Vitest** confermato (best-in-class per Next.js, compatibilità Vite, coverage integrato, vastissima presenza training data AI). Unit test su tutta la business logic.
- [x] **OD-39** Framework E2E → **Playwright** confermato in scope MVP. Flussi critici: creazione utente, creazione/pubblicazione scheda, invio feedback. E2E bloccante per deploy prod.
- [x] **OD-40** Soglia minima coverage → **80% minimo** su business logic (calcolo volume, RPE, massimali, validazioni Zod, helper functions). Esclusi: config files, componenti puramente presentazionali, boilerplate API Routes.
- [x] **OD-41** Test E2E in CI → **Sì, bloccanti per deploy prod**. GitHub Actions esegue E2E su staging prima di permettere merge su main. Se E2E fail, deploy prod bloccato.
- [x] **OD-42** Flussi critici → definiti in 07_testing_strategy.md con priorità P0/P1/P2/P3. Include test per nuove funzionalità (massimali, reportistica, feedback con serie multiple, validazioni RPE/peso).

---

## 08 — Design Review v1 (vedi design-review/00_review_v1.md)

### Criticità Architetturali da Risolvere

- [x] **ODR-01** Conflitto NextAuth vs Supabase Auth → Risolto. Confermato **Supabase Auth** come provider esclusivo. Documentazione allineata: rimossi riferimenti NextAuth da 03_backend_api.md, chiarito che autenticazione è gestita da Supabase client SDK senza endpoint API Routes custom per MVP. (chiuso 2026-03-28, vedi 09_change_log.md)

- [x] **ODR-02** `ExerciseFeedback.setsPerformed` come JSON → Risolto. Creata tabella **SetPerformed** (1:N con ExerciseFeedback) per normalizzazione completa. Campi: setNumber, reps, weight. Type-safety garantita, query aggregate efficienti (MAX/AVG weight per esercizio), indicizzazione DB, constraint UNIQUE(feedbackId, setNumber). Campo ExerciseFeedback.notes confermato per testo libero trainee. Volumetria ~50K set gestibile. (chiuso 2026-03-28, vedi 09_change_log.md) → Il campo JSON bypassa type-safety, non è indicizzabile, rende impossibili query aggregate (es. "peso massimo per esercizio X"). Volumetria ~50K set, gestibile con normalizzazione. **Decisione**: Valutare tabella `SetPerformed` (FK a ExerciseFeedback) per type-safety e query efficienti.

- [ ] **ODR-03** Rate limiting in-memory inefficace su serverless → Il Map in-memory viene resettato ad ogni cold start e isolato tra istanze. Brute-force auth non è protetto. Upstash Redis free tier (10K cmd/day, €0) è disponibile. **Decisione**: Implementare Upstash Redis per rate limiting almeno su `/api/auth/*` anche in MVP.

- [x] **ODR-04** `User.initialPassword` salvata nel DB (anche encrypted) → Vulnerabilità se encryption key compromessa. La password è già in `auth.users` di Supabase, flag `mustChangePassword` è sufficiente. **Decisione**: Non salvare la password temporanea nel DB. Se serve "ri-visualizzare", generarne una nuova. **✅ Risolto il 2026-03-28**: Rimosso campo `initialPassword` dal modello User.

### Ambiguità Funzionali da Chiarire

- [x] **ODR-05** Gestione multi-trainer per stesso trainee → `TrainerTrainee` è N:N ma non è chiaro se un trainee può avere più trainer contemporaneamente. Se sì: chi gestisce schede? Se no: aggiungere UNIQUE su `traineeId`. **Decisione**: Relazione 1:1 confermata. Un trainee ha UN SOLO trainer. Aggiunto UNIQUE constraint su `TrainerTrainee.traineeId`. **✅ Risolto il 2026-03-28**: Implementata relazione 1:1 con UNIQUE constraint.

- [x] **ODR-06** Transizione `active → completed` scheda → Non specificato se è automatica (ultima settimana) o manuale (trainer). Cosa succede con feedback incompleti? Il trainee può ancora fornire feedback su schede completed? **Decisione**: Transizione AUTOMATICA al termine dell'ultima settimana (endDate = startDate + durationWeeks * 7). I feedback richiesti (Week.feedbackRequested=true) vanno inviati quando richiesti. Se ci sono feedback pendenti all'ultima settimana, la scheda passa comunque a 'completed'. Job schedulato verifica endDate e aggiorna status. **✅ Risolto il 2026-03-28**: Documentato workflow automatico.

- [x] **ODR-07** Versionamento schede → ~~In 03_backend_api.md: _"Se status=active, richiede nuova versione"_~~ **Decisione**: **NON previsto versionamento**. Schede pubblicate (`status=active/completed`) sono IMMUTABILI. Trainer può modificare solo schede `draft`. `PUT /api/programs/[id]` su scheda pubblicata → 403 Forbidden. Se trainer vuole modifiche, crea nuova scheda da zero. **✅ Risolto il 2026-03-28**: Confermata immutabilità, rimosso riferimento ambiguo a "nuova versione".

- [ ] **ODR-08** Admin senza CRUD su programmi → Admin ha solo lettura schede, nessun trainer vede schede altrui. Se trainer lascia: trainee e schede orfani. **Decisione**: Prevedere admin override per riassegnazione o almeno accesso read globale.

### Parti Mancanti e Proposte di Miglioramento

#### Architetturali (da valutare)

- [ ] **ODR-09** Database indexes espliciti → Query dashboard con calcolo `endDate` e JOIN multipli beneficerebbero di indici compositi. Impatto trascurabile a 54 utenti, rilevante a 500+. **Decisione**: Definire strategia indexing per scalabilità futura.

- [ ] **ODR-10** API pagination → Nessun endpoint definisce paginazione (GET /api/exercises, /api/users, /api/programs). Lista esercizi può crescere indefinitamente. **Decisione**: Aggiungere pagination standard su tutti gli endpoint GET list.

- [ ] **ODR-11** Concurrency control → Nessun optimistic locking. Due trainer modificano stesso esercizio: ultimo vince silenziosamente. Raro a 3 trainer ma possibile. **Decisione**: Valutare `version` field o `updatedAt` check per conflitti.

- [ ] **ODR-12** Idempotency su POST feedback → Double-tap può creare due `ExerciseFeedback` per stesso `WorkoutExercise`. **Decisione**: Aggiungere constraint UNIQUE `(workoutExerciseId, traineeId)` o idempotency key.

#### Operations & Monitoring

- [ ] **ODR-13** Backup & Disaster Recovery → Supabase Pro include daily backup ma non documentate: recovery strategy, RPO/RTO, test restore procedure. **Decisione**: Definire procedura DR e schedule test restore.

- [ ] **ODR-14** Monitoring & Alerting → Sentry per errori ma nessun health check endpoint, uptime monitoring, dashboard operativa. **Decisione**: Implementare `GET /api/health` (DB ping + Supabase Auth check) e uptime monitoring (UptimeRobot free tier).

- [ ] **ODR-15** Error boundary client-side → Non definita strategia error boundary React per crash. **Decisione**: Implementare error boundary globale con fallback UI e logging Sentry.

#### Testing & Quality

- [ ] **ODR-16** Accessibility (a11y) → MUI è WCAG-compliant ma nessun target (AA?) né testing a11y. Potenziale requisito legale. **Decisione**: Definire target WCAG e integrare axe-core in E2E se necessario.

- [ ] **ODR-17** Seed data strategy → Menzionata per MuscleGroup/MovementPattern ma non definita per staging (seed realistici) e E2E (seed predicibili). **Decisione**: Creare seed script per ogni ambiente.

#### Stack & Tooling

- [ ] **ODR-18** Conflitto Tailwind CSS + MUI → Coesistenza causa specificity conflicts, bundle +50-80KB, DX degradata. **Decisione**: Usare MUI solo per componenti complessi o valutare migrazione a shadcn/ui (Tailwind-native).

- [ ] **ODR-19** Service Worker con App Router → `next-pwa` ha supporto limitato App Router, possibili problemi RSC + SW caching. **Decisione**: Valutare `@serwist/next` (fork attivo con supporto App Router) o limitare caching SW.

- [ ] **ODR-20** Vendor lock-in Supabase → Auth + DB + Storage + Email tutti su Supabase. SPOF per servizi critici. Prisma mitiga lock-in DB ma Auth è più accoppiato. **Decisione**: Documentare API surface Supabase Auth usate per eventuale migrazione futura.

#### Documentazione

- [ ] **ODR-21** Schema Prisma effettivo → Documentazione mostra schema logico ma nessun file `schema.prisma` reale. Gap design ↔ codice. **Decisione**: Creare e committare `prisma/schema.prisma` come single source of truth.

- [ ] **ODR-22** Diagramma ER → Nessun diagramma visuale delle relazioni. **Decisione**: Aggiungere diagramma Mermaid o dbdiagram.io al 04_data_model.md.

- [ ] **ODR-23** Internazionalizzazione (i18n) → App chiaramente in italiano ma non esplicitato se supporto altre lingue. Se i18n post-MVP, retrofit costoso. **Decisione**: Confermare app monolingua o prevedere i18n da subito.

### Assunzioni da Confermare

- [ ] **ODR-24** Lingua applicazione → Si assume italiano. Email template Supabase di default sono inglese. **Decisione**: Confermare lingua e customizzare template email.

- [ ] **ODR-25** Fuso orario → Date (`Week.startDate`, `ExerciseFeedback.date`, `PersonalRecord.recordDate`) senza timezone. **Decisione**: Dichiarare UTC o Europe/Rome per evitare bug visualizzazione.

- [ ] **ODR-26** Un solo programma attivo per trainee → Nessun vincolo UNIQUE su `(traineeId, status='active')`. **Decisione**: Aggiungere constraint o chiarire se scenario multi-scheda è valido.

- [ ] **ODR-27** Soft-delete vs hard-delete utenti → `User.isActive` controlla login ma `DELETE /api/users/[id]` sembra hard delete. Conflitto con GDPR right to erasure (anonimizzazione vs cancellazione). **Decisione**: Implementare anonimizzazione GDPR-compliant.

- [ ] **ODR-28** Trainee non può cambiare trainer → Nessun workflow riassegnazione da parte utente. **Decisione**: Confermare se è requisito o solo admin può riassegnare.

- [ ] **ODR-29** Proiezione storage Supabase → Free tier 500MB, crescita ~14.400 feedback × N cicli × N anni non dettagliata. **Decisione**: Calcolare proiezione storage 12-24 mesi e confermare adequatezza free/pro tier.

- [ ] **ODR-30** Deploy region → Vercel e Supabase in EU, region esatta non specificata. Per GDPR si assume `eu-central-1` (Frankfurt). **Decisione**: Confermare region deployment.

### Domande Aperte da Valutazione Complessiva

Le seguenti domande emergono dalla review e richiedono chiarimento:

1. ~~**ODR-05** (ripetuto sopra): Un trainee può essere assegnato a più trainer contemporaneamente?~~ ✅ **RISOLTO**
2. ~~**ODR-06** (ripetuto sopra): Qual è il trigger per `active → completed`?~~ ✅ **RISOLTO**
3. ~~**ODR-07** (ripetuto sopra): Come si gestisce il versionamento schede?~~ ✅ **RISOLTO** (non previsto versionamento, schede pubblicate immutabili)
4. **ODR-23** (ripetuto sopra): Supporto multi-lingua?
5. **ODR-25** (ripetuto sopra): Quale timezone?
6. **ODR-08** (ripetuto sopra): Procedura handover trainer eliminato?
7. **ODR-26** (ripetuto sopra): Limite una scheda active per trainee?
8. È previsto limite numero esercizi nella libreria condivisa?
9. **ODR-16** (ripetuto sopra): Target WCAG per accessibilità?
10. Comunicazione credenziali via WhatsApp compatibile con GDPR (transito su piattaforma terza)?

### Valutazione Complessiva Review v1

**Livello Maturità**: ★★★★☆ (4/5)

**Verdict**: Progetto con maturità documentale **sopra la media** per MVP. Criticità identificate risolvibili senza impatto architetturale significativo. Stack Next.js + Supabase + Vercel coerente, economico, adeguato alla scala.

**Readiness implementazione**: **Alta** — previo allineamento delle ambiguità segnalate (ODR-01 a ODR-08 prioritari).

**Raccomandazioni prioritarie**:
1. ~~**ODR-01**: Risolvere conflitto auth NextAuth/Supabase in documentazione~~ ✅ **CHIUSO**
2. ~~**ODR-02**: Normalizzare setsPerformed con tabella SetPerformed~~ ✅ **CHIUSO**
3. ~~**ODR-04**: Rimuovere `initialPassword` dal DB (security)~~ ✅ **CHIUSO**
4. ~~**ODR-05**: Gestione multi-trainer (relazione 1:1 confermata)~~ ✅ **CHIUSO**
5. ~~**ODR-06**: Workflow active → completed (transizione automatica)~~ ✅ **CHIUSO**
6. ~~**ODR-07**: Versionamento schede (nessun versionamento, schede immutabili)~~ ✅ **CHIUSO**
7. **ODR-03**: Implementare Upstash Redis per rate limiting (security critico)
8. **ODR-08**: Chiarire admin override per gestione trainer (handover)
9. **ODR-10**, **ODR-12**: Pagination e idempotency (scalabilità)
10. **ODR-14**: Health check e monitoring (operations)
11. **ODR-21**: Creare `schema.prisma` reale (developer experience)