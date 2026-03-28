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