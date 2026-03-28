# ZeroCento Training Platform — Prompt Completo per Implementazione Autonoma

## ISTRUZIONI PER L'AGENTE

Sei un senior full-stack developer. Il tuo compito è implementare **da zero** l'intera piattaforma **ZeroCento Training Platform** seguendo rigorosamente le specifiche di design documentate di seguito. Lavora in modo autonomo, modulo per modulo, fino al completamento. Non inventare funzionalità non specificate. Non saltare passaggi. Ogni decisione architetturale è già stata presa — segui le indicazioni senza modificarle.

**Lingua codice**: inglese (nomi variabili, funzioni, commenti tecnici). UI: italiano (default) + inglese (i18n).

---

## 1. PANORAMICA PROGETTO

**ZeroCento** è una piattaforma web per la gestione di servizi di training sportivo/fitness.

- **Trainer** (desktop): crea esercizi, schede di allenamento multi-settimana, monitora progressi
- **Trainee** (mobile/palestra): consulta schede, fornisce feedback durante allenamenti
- **Admin** (desktop): super-user, gestisce utenti, riassegna trainee, override su tutto
- **Scala iniziale**: 1 admin + 3 trainer + 50 trainee

### Contesto d'uso critico
- Trainer: sessioni brevi (15-30 min), desktop
- Trainee: sessioni lunghe (60-90+ min) in palestra, mobile, frequente app switching (Instagram, musica, timer). Il sistema DEVE mantenere la sessione attiva per 90+ minuti senza re-login.

---

## 2. STACK TECNOLOGICO (NON MODIFICABILE)

| Layer            | Tecnologia                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Framework        | **Next.js** (App Router) — full-stack BFF, monolite single-repo                                                |
| Runtime          | Node.js serverless su Vercel                                                                                   |
| Linguaggio       | **TypeScript** strict                                                                                          |
| Database         | **Supabase PostgreSQL** con PgBouncer (connection pooling)                                                     |
| ORM              | **Prisma** con migrations                                                                                      |
| Auth             | **Supabase Auth** — email/password MVP, JWT 4h + refresh 30d                                                   |
| Styling          | **Tailwind CSS** (primario) + **MUI** (solo per: DataGrid, Drawer, BottomNavigation, SwipeableDrawer, Stepper) |
| State            | **TanStack Query** (server state) + **Context API** (sessione utente)                                          |
| Forms            | **React Hook Form** + **Zod** (validazione condivisa client/server)                                            |
| PWA              | **@serwist/next** (service worker per offline trainee)                                                         |
| i18n             | **i18next** + **next-i18next** (IT default + EN)                                                               |
| Testing          | **Vitest** (unit, 80% coverage) + **Playwright** (E2E) + **@axe-core/playwright** (a11y WCAG 2.1 AA)           |
| Logging          | **Pino** (structured JSON) + **Sentry** (error tracking, free tier)                                            |
| Rate limiting    | **Upstash Redis** (free tier, auth endpoints) + in-memory Map (altri endpoint)                                 |
| Monitoring       | **UptimeRobot** (uptime) + **Vercel Analytics** (Web Vitals)                                                   |
| CI/CD            | **GitHub Actions** → Vercel auto-deploy                                                                        |
| Deploy           | **Vercel** (fra1 Frankfurt) + **Supabase** (eu-central-1)                                                      |
| Error Boundaries | **react-error-boundary** + Sentry integration                                                                  |

### Package manager: npm
### Node.js: >= 20
### Region: Frankfurt (GDPR EU)

---

## 3. STRUTTURA DIRECTORY

```
ZeroCentoProject/
├── prisma/
│   ├── schema.prisma              # GIÀ ESISTENTE — usalo come source of truth
│   ├── migrations/                # Prisma Migrate
│   └── seed.ts                    # Seed data (vedi sezione 12)
│
├── src/
│   ├── app/
│   │   ├── [locale]/              # i18n URL-based routing (/it/..., /en/...)
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── forgot-password/page.tsx
│   │   │   │   ├── reset-password/page.tsx
│   │   │   │   └── change-password/page.tsx
│   │   │   ├── (admin)/
│   │   │   │   ├── admin/dashboard/page.tsx
│   │   │   │   ├── admin/users/page.tsx
│   │   │   │   ├── admin/users/new/page.tsx
│   │   │   │   ├── admin/users/[id]/page.tsx
│   │   │   │   ├── admin/programs/page.tsx
│   │   │   │   ├── admin/programs/[id]/page.tsx
│   │   │   │   ├── admin/programs/[id]/progress/page.tsx
│   │   │   │   ├── admin/trainees/[id]/reassign/page.tsx
│   │   │   │   └── admin/reports/page.tsx
│   │   │   ├── (trainer)/
│   │   │   │   ├── trainer/dashboard/page.tsx
│   │   │   │   ├── trainer/exercises/page.tsx
│   │   │   │   ├── trainer/exercises/new/page.tsx
│   │   │   │   ├── trainer/exercises/[id]/page.tsx
│   │   │   │   ├── trainer/trainees/page.tsx
│   │   │   │   ├── trainer/trainees/new/page.tsx
│   │   │   │   ├── trainer/trainees/[id]/page.tsx
│   │   │   │   ├── trainer/trainees/[id]/records/page.tsx
│   │   │   │   ├── trainer/programs/page.tsx
│   │   │   │   ├── trainer/programs/new/page.tsx
│   │   │   │   ├── trainer/programs/[id]/page.tsx
│   │   │   │   ├── trainer/programs/[id]/week-overview/page.tsx
│   │   │   │   ├── trainer/programs/[id]/workout/[wId]/page.tsx
│   │   │   │   ├── trainer/programs/[id]/publish/page.tsx
│   │   │   │   ├── trainer/programs/[id]/progress/page.tsx
│   │   │   │   ├── trainer/programs/[id]/reports/page.tsx
│   │   │   │   └── trainer/settings/movement-colors/page.tsx
│   │   │   └── (trainee)/
│   │   │       ├── trainee/dashboard/page.tsx
│   │   │       ├── trainee/programs/current/page.tsx
│   │   │       ├── trainee/programs/[id]/workout/[workoutId]/page.tsx
│   │   │       ├── trainee/history/page.tsx
│   │   │       ├── trainee/records/page.tsx
│   │   │       └── trainee/records/[exerciseId]/page.tsx
│   │   │
│   │   └── api/
│   │       ├── health/route.ts
│   │       ├── users/route.ts
│   │       ├── users/[id]/route.ts
│   │       ├── users/[id]/activate/route.ts
│   │       ├── users/[id]/deactivate/route.ts
│   │       ├── exercises/route.ts
│   │       ├── exercises/[id]/route.ts
│   │       ├── muscle-groups/route.ts
│   │       ├── muscle-groups/[id]/route.ts
│   │       ├── muscle-groups/[id]/archive/route.ts
│   │       ├── movement-patterns/route.ts
│   │       ├── movement-patterns/[id]/route.ts
│   │       ├── movement-patterns/[id]/archive/route.ts
│   │       ├── programs/route.ts
│   │       ├── programs/[id]/route.ts
│   │       ├── programs/[id]/publish/route.ts
│   │       ├── programs/[id]/progress/route.ts
│   │       ├── programs/[id]/submit/route.ts
│   │       ├── programs/[id]/reports/sbd/route.ts
│   │       ├── programs/[id]/reports/training-sets/route.ts
│   │       ├── programs/[id]/reports/volume/route.ts
│   │       ├── weeks/[id]/route.ts
│   │       ├── feedback/route.ts
│   │       ├── feedback/[id]/route.ts
│   │       ├── trainee/programs/route.ts
│   │       ├── trainee/programs/current/route.ts
│   │       ├── trainee/records/route.ts
│   │       ├── trainee/records/[exerciseId]/route.ts
│   │       ├── trainer/trainees/[id]/records/route.ts
│   │       ├── trainer/trainees/[id]/records/[recordId]/route.ts
│   │       ├── admin/programs/route.ts
│   │       ├── admin/programs/[id]/route.ts
│   │       ├── admin/programs/[id]/publish/route.ts
│   │       ├── admin/trainer-trainee/[traineeId]/route.ts
│   │       └── admin/reports/route.ts
│   │
│   ├── components/
│   │   ├── admin/
│   │   ├── trainer/
│   │   ├── trainee/
│   │   ├── shared/
│   │   │   ├── ExerciseCard.tsx
│   │   │   ├── MuscleGroupBadge.tsx
│   │   │   ├── MovementPatternIcon.tsx
│   │   │   ├── MovementPatternTag.tsx
│   │   │   ├── YoutubeEmbed.tsx
│   │   │   ├── RoleGuard.tsx
│   │   │   ├── RPESelector.tsx
│   │   │   ├── RestTimeSelector.tsx
│   │   │   ├── RepsInput.tsx
│   │   │   ├── UserStatusToggle.tsx
│   │   │   ├── WeekTypeBadge.tsx
│   │   │   ├── WeekTypeBanner.tsx
│   │   │   ├── WeekTypeSelector.tsx
│   │   │   ├── InstallPrompt.tsx
│   │   │   └── ErrorFallback.tsx
│   │   └── ui/                    # Base UI primitives (se necessari)
│   │
│   ├── lib/
│   │   ├── prisma.ts              # Singleton Prisma Client (serverless-safe)
│   │   ├── supabase-client.ts     # Supabase browser client
│   │   ├── supabase-server.ts     # Supabase server client
│   │   ├── api-response.ts        # Helper apiSuccess/apiError
│   │   ├── auth.ts                # Middleware helpers (getSession, requireRole)
│   │   ├── calculations.ts        # calculateVolume, calculateEffectiveWeight, etc.
│   │   ├── password-utils.ts      # generateSecurePassword
│   │   └── logger.ts              # Pino logger config
│   │
│   ├── schemas/                   # Zod schemas condivisi client/server
│   │   ├── exercise.ts
│   │   ├── feedback.ts
│   │   ├── user.ts
│   │   ├── program.ts
│   │   ├── workout-exercise.ts
│   │   ├── week.ts
│   │   └── personal-record.ts
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useRoleLayout.ts
│   │   ├── useFeedbackPersistence.ts
│   │   └── useLocalStorage.ts
│   │
│   ├── types/
│   │   └── index.ts               # Tipi TypeScript derivati da Prisma + custom
│   │
│   ├── i18n/
│   │   ├── config.ts
│   │   └── middleware.ts
│   │
│   └── middleware.ts              # Auth + Rate limiting + i18n middleware
│
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── locales/
│   │   ├── it/                    # common.json, auth.json, dashboard.json, programs.json, exercises.json, feedback.json, errors.json
│   │   └── en/                    # stessi file
│   └── icons/                     # PWA icons
│
├── tests/
│   ├── unit/                      # Vitest
│   └── e2e/                       # Playwright
│
├── .github/
│   └── workflows/
│       └── ci.yml                 # CI/CD pipeline
│
├── .env.example
├── .env.local                     # gitignored
├── next.config.js
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── sentry.client.config.ts
├── sentry.server.config.ts
└── package.json
```

---

## 4. DATA MODEL (PRISMA SCHEMA)

Lo schema Prisma è **già definito** nel file `prisma/schema.prisma`. Usalo come source of truth. Ecco il riepilogo delle 14 entità:

### Entità

| Entità                 | Descrizione                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                 | Utente (admin/trainer/trainee). Campi: id (UUID), email (UNIQUE), firstName, lastName, role (enum), isActive, createdAt                                         |
| `TrainerTrainee`       | Associazione 1:1 (traineeId UNIQUE). Un trainee ha un solo trainer                                                                                              |
| `MuscleGroup`          | Gruppo muscolare gestibile (name UNIQUE, isActive, createdBy)                                                                                                   |
| `MovementPattern`      | Schema motorio gestibile (name UNIQUE, isActive, createdBy)                                                                                                     |
| `MovementPatternColor` | Colore personalizzato per trainer + pattern (UNIQUE trainerId+movementPatternId)                                                                                |
| `Exercise`             | Esercizio condiviso: name, youtubeUrl, type (fundamental/accessory), movementPatternId, notes[], createdBy (audit only)                                         |
| `ExerciseMuscleGroup`  | Junction table Exercise↔MuscleGroup con coefficient (0.0-1.0)                                                                                                   |
| `TrainingProgram`      | Scheda: title, trainerId, traineeId, startDate (null se draft), durationWeeks, workoutsPerWeek, status (draft/active/completed), publishedAt                    |
| `Week`                 | Settimana: weekNumber, weekType (normal/test/deload), feedbackRequested, generalFeedback                                                                        |
| `Workout`              | Giorno: dayLabel ("Giorno 1", "Giorno 2"...), notes                                                                                                             |
| `WorkoutExercise`      | Esercizio in workout: sets, reps (string), targetRpe, weightType (absolute/percentage_1rm/percentage_rm/percentage_previous), weight, restTime, isWarmup, order |
| `ExerciseFeedback`     | Feedback trainee: completed, actualRpe, notes. UNIQUE(workoutExerciseId, traineeId, date)                                                                       |
| `SetPerformed`         | Serie eseguita: feedbackId, setNumber, reps, weight. UNIQUE(feedbackId, setNumber)                                                                              |
| `PersonalRecord`       | Massimale: traineeId, exerciseId, reps (1=1RM), weight, recordDate                                                                                              |

### Enums Prisma
```
Role: admin | trainer | trainee
ExerciseType: fundamental | accessory
ProgramStatus: draft | active | completed
WeekType: normal | test | deload
WeightType: absolute | percentage_1rm | percentage_rm | percentage_previous
RestTime: s30 | m1 | m2 | m3 | m5
```

### Relazioni chiave
- User ↔ TrainerTrainee: 1:N come trainer, 1:1 come trainee (UNIQUE su traineeId)
- TrainingProgram → Week → Workout → WorkoutExercise (cascade delete)
- WorkoutExercise → ExerciseFeedback → SetPerformed (cascade delete)
- Exercise ↔ MuscleGroup via ExerciseMuscleGroup (M:N con coefficient)
- Exercise → MovementPattern (N:1)

### Indici da schema
Tutti gli indici compositi sono già nel `schema.prisma`. Assicurati di non rimuoverli:
- `User`: @@index([email]), @@index([role, isActive])
- `TrainingProgram`: @@index([trainerId, status]), @@index([traineeId, status]), @@index([status, startDate])
- `Week`: @@index([programId, weekNumber]), @@index([startDate])
- `WorkoutExercise`: @@index([workoutId, order]), @@index([exerciseId])
- `ExerciseFeedback`: @@unique([workoutExerciseId, traineeId, date]), @@index([traineeId, date])
- `SetPerformed`: @@unique([feedbackId, setNumber])
- `PersonalRecord`: @@index([traineeId, exerciseId]), @@index([recordDate])

---

## 5. AUTENTICAZIONE E AUTORIZZAZIONE

### Provider: Supabase Auth
- **Metodo MVP**: Email + password via `supabase.auth.signInWithPassword()` / `signOut()`
- **Session**: JWT auto (access 4h + refresh 30d) in cookie HTTP-only (Secure, SameSite=Lax)
- **Auto-refresh**: `autoRefreshToken: true`, `persistSession: true`
- **NO NextAuth** — Supabase gestisce tutto

### Integrazione Prisma ↔ Supabase Auth
- `auth.users` (Supabase interna): email, password hash
- `public.users` (Prisma): id, firstName, lastName, role, isActive
- Collegamento: `User.id = auth.users.id` (UUID condiviso, trigger Supabase per sync)

### Flusso creazione trainee (trainer)
1. Genera password temporanea sicura (12+ char, alfanumerico + simboli)
2. `supabase.auth.admin.createUser({ email, password: tempPassword, email_confirm: true, user_metadata: { mustChangePassword: true } })`
3. `prisma.user.create({ id: authUser.id, email, firstName, lastName, role: 'trainee', isActive: true })`
4. Crea `TrainerTrainee { trainerId: currentUser.id, traineeId: newUser.id }`
5. Ritorna tempPassword (visualizzata UNA SOLA VOLTA in modal)
6. **NON salvare** la password temporanea nel DB

### Password reset: Supabase built-in
- `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`
- Template email personalizzabile da Supabase Dashboard

### Middleware Auth (`src/middleware.ts`)
```
- Route /admin/*  → richiede role === 'admin'
- Route /trainer/* → richiede role === 'trainer'
- Route /trainee/* → richiede role === 'trainee'
- Route /api/*     → verifica sessione (tranne /api/health)
- Redirect a /login se non autenticato
- / → redirect a dashboard del ruolo
```

### Matrice RBAC

| Risorsa                    | admin                                | trainer                                 | trainee             |
| -------------------------- | ------------------------------------ | --------------------------------------- | ------------------- |
| Creazione utenti           | trainer + trainee                    | solo trainee                            | ❌                   |
| Gestione utenti (RUD)      | tutti                                | solo propri trainee                     | ❌                   |
| Disabilitazione trainee    | tutti                                | solo propri                             | ❌                   |
| Libreria esercizi          | CRUD                                 | CRUD (condivisa, qualsiasi esercizio)   | lettura             |
| Gruppi muscolari           | CRUD                                 | CRUD (condivisi)                        | lettura             |
| Schemi motori              | CRUD                                 | CRUD (condivisi)                        | lettura             |
| Schede / Programmi         | CRUD (TUTTE, anche active/completed) | CRUD (proprie, solo draft modificabile) | lettura (assegnate) |
| Associazioni trainer       | CRUD (riassegnazione)                | lettura (proprie)                       | ❌                   |
| Feedback                   | lettura (tutti)                      | lettura                                 | CRUD (propri)       |
| Massimali (PersonalRecord) | CRUD (tutti)                         | CRUD (propri trainee)                   | lettura (propri)    |
| Reportistica               | tutti i trainee                      | propri trainee                          | ❌                   |

### Protezione
- Validazione ownership su OGNI richiesta trainer (verifica TrainerTrainee)
- Admin bypassa TUTTE le restrizioni ownership e immutabilità
- Trainee disabilitato (isActive=false): login bloccato con messaggio "Account disabilitato"

---

## 6. API ENDPOINTS

### Formato response standard

```typescript
// Successo (2xx)
{ "data": { /* payload */ }, "meta": { "timestamp": "ISO8601" } }

// Errore (4xx, 5xx)
{ "error": { "code": "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMIT_EXCEEDED" | "INTERNAL_ERROR", "message": "Descrizione leggibile", "details": { /* opzionale */ } } }
```

Helper:
```typescript
// lib/api-response.ts
export function apiSuccess<T>(data: T, status = 200) {
  return Response.json({ data, meta: { timestamp: new Date().toISOString() } }, { status })
}
export function apiError(code: string, message: string, status: number, details?: unknown) {
  return Response.json({ error: { code, message, details } }, { status })
}
```

### Endpoint completi

#### Auth (gestito da Supabase SDK, no API Routes custom)
- Login/Logout/Session: client SDK diretto

#### Utenti
| Method | Path                       | Descrizione                                                                                   | Auth                            |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------- |
| GET    | /api/users                 | Lista utenti (admin: tutti, trainer: propri trainee)                                          | admin, trainer                  |
| POST   | /api/users                 | Crea utente. `role=trainer` solo admin. `role=trainee` admin o trainer. `role=admin` bloccato | admin, trainer                  |
| GET    | /api/users/[id]            | Dettaglio                                                                                     | admin, trainer (propri trainee) |
| PUT    | /api/users/[id]            | Modifica                                                                                      | admin, trainer (propri trainee) |
| DELETE | /api/users/[id]            | Elimina (soft-delete con deletedAt? No — eliminazione fisica con cleanup)                     | admin, trainer (propri trainee) |
| PATCH  | /api/users/[id]/activate   | Riattiva trainee                                                                              | admin, trainer (propri)         |
| PATCH  | /api/users/[id]/deactivate | Disabilita trainee                                                                            | admin, trainer (propri)         |

Creazione trainee: crea record `TrainerTrainee` automaticamente.

#### Esercizi (Libreria Condivisa)
| Method | Path                | Descrizione                                                                     | Auth           |
| ------ | ------------------- | ------------------------------------------------------------------------------- | -------------- |
| GET    | /api/exercises      | Lista (filtri: tipo, movementPattern, muscleGroup). **Cursor-based pagination** | tutti          |
| POST   | /api/exercises      | Crea esercizio (createdBy = audit)                                              | admin, trainer |
| GET    | /api/exercises/[id] | Dettaglio con muscleGroups e pattern                                            | tutti          |
| PUT    | /api/exercises/[id] | Modifica QUALSIASI esercizio                                                    | admin, trainer |
| DELETE | /api/exercises/[id] | Elimina. Se usato in scheda attiva → **409 Conflict**                           | admin, trainer |

#### Gruppi Muscolari
| Method | Path                            | Descrizione                                 | Auth           |
| ------ | ------------------------------- | ------------------------------------------- | -------------- |
| GET    | /api/muscle-groups              | Lista attivi                                | tutti          |
| POST   | /api/muscle-groups              | Crea                                        | admin, trainer |
| GET    | /api/muscle-groups/[id]         | Dettaglio                                   | tutti          |
| PUT    | /api/muscle-groups/[id]         | Modifica                                    | admin, trainer |
| PATCH  | /api/muscle-groups/[id]/archive | Archivia (isActive=false)                   | admin, trainer |
| DELETE | /api/muscle-groups/[id]         | Elimina (solo se non usato, altrimenti 409) | admin, trainer |

#### Schemi Motori
| Method | Path                                | Descrizione                                 | Auth           |
| ------ | ----------------------------------- | ------------------------------------------- | -------------- |
| GET    | /api/movement-patterns              | Lista attivi                                | tutti          |
| POST   | /api/movement-patterns              | Crea                                        | admin, trainer |
| GET    | /api/movement-patterns/[id]         | Dettaglio                                   | tutti          |
| PUT    | /api/movement-patterns/[id]         | Modifica                                    | admin, trainer |
| PATCH  | /api/movement-patterns/[id]/archive | Archivia (isActive=false)                   | admin, trainer |
| DELETE | /api/movement-patterns/[id]         | Elimina (solo se non usato, altrimenti 409) | admin, trainer |

#### Programmi / Schede (Trainer)
| Method | Path                        | Descrizione                                                                                                         | Auth    |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------- |
| GET    | /api/programs               | Lista schede (filtri: trainee, status)                                                                              | trainer |
| POST   | /api/programs               | Crea scheda draft. Auto-crea Week + Workout vuoti. weekType default=normal                                          | trainer |
| GET    | /api/programs/[id]          | Dettaglio completo                                                                                                  | trainer |
| PUT    | /api/programs/[id]          | Modifica **SOLO se status=draft** (altrimenti 403)                                                                  | trainer |
| DELETE | /api/programs/[id]          | Elimina **SOLO se status=draft**                                                                                    | trainer |
| POST   | /api/programs/[id]/publish  | Pubblica: draft→active, body `{ week1StartDate }`. Valida: tutti workout hanno ≥1 esercizio. Calcola Week.startDate | trainer |
| GET    | /api/programs/[id]/progress | Avanzamento + feedback                                                                                              | trainer |
| PATCH  | /api/weeks/[id]             | Configura weekType e feedbackRequested. Solo draft                                                                  | trainer |
| POST   | /api/programs/[id]/submit   | Trainee invia feedback settimanali. Body `{ weekId }`                                                               | trainee |

**Workflow pubblicazione**:
1. Valida tutti i workout hanno ≥1 esercizio con dettagli completi
2. `status = 'active'`, `startDate = week1StartDate`, `publishedAt = NOW()`
3. Calcola per ogni Week: `startDate = program.startDate + (weekNumber-1) * 7 giorni`
4. Dopo pubblicazione → **IMMUTABILE** (PUT/DELETE bloccati per trainer, solo admin override)

**Transizione active → completed**:
- AUTOMATICA: endDate = startDate + durationWeeks * 7
- Cron job daily (o lazy check su API) verifica endDate e aggiorna status

#### Admin Override
| Method | Path                                   | Descrizione                                                                                                                                       | Auth  |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| GET    | /api/admin/programs                    | Lista TUTTE le schede (filtri: trainerId, traineeId, status, search)                                                                              | admin |
| GET    | /api/admin/programs/[id]               | Dettaglio qualsiasi scheda                                                                                                                        | admin |
| POST   | /api/admin/programs                    | Crea scheda per qualsiasi trainee                                                                                                                 | admin |
| PUT    | /api/admin/programs/[id]               | Modifica qualsiasi scheda (anche active/completed)                                                                                                | admin |
| DELETE | /api/admin/programs/[id]               | Elimina qualsiasi scheda                                                                                                                          | admin |
| POST   | /api/admin/programs/[id]/publish       | Pubblica draft di qualsiasi trainer                                                                                                               | admin |
| PUT    | /api/admin/trainer-trainee/[traineeId] | Riassegna trainee. Body `{ newTrainerId, reason? }`. DELETE vecchio TrainerTrainee, INSERT nuovo. Schede esistenti mantengono trainerId originale | admin |

#### Feedback (Trainee)
| Method | Path                          | Descrizione                                                                  | Auth    |
| ------ | ----------------------------- | ---------------------------------------------------------------------------- | ------- |
| GET    | /api/trainee/programs         | Storico schede trainee autenticato                                           | trainee |
| GET    | /api/trainee/programs/current | Scheda corrente attiva                                                       | trainee |
| POST   | /api/feedback                 | Crea feedback (body: workoutExerciseId, completed, actualRpe, sets[], notes) | trainee |
| PUT    | /api/feedback/[id]            | Modifica feedback                                                            | trainee |

#### Massimali / Personal Records
| Method | Path                                          | Descrizione                         | Auth    |
| ------ | --------------------------------------------- | ----------------------------------- | ------- |
| GET    | /api/trainee/records                          | Lista massimali trainee autenticato | trainee |
| GET    | /api/trainee/records/[exerciseId]             | Storico per esercizio               | trainee |
| GET    | /api/trainer/trainees/[id]/records            | Lista massimali trainee             | trainer |
| GET    | /api/trainer/trainees/[id]/records/[recordId] | Dettaglio                           | trainer |
| POST   | /api/trainer/trainees/[id]/records            | Crea massimale                      | trainer |
| PUT    | /api/trainer/trainees/[id]/records/[recordId] | Modifica                            | trainer |
| DELETE | /api/trainer/trainees/[id]/records/[recordId] | Elimina                             | trainer |

#### Reportistica
| Method | Path                                     | Descrizione                              | Auth    |
| ------ | ---------------------------------------- | ---------------------------------------- | ------- |
| GET    | /api/programs/[id]/reports/sbd           | Report SBD (FRQ, NBL, IM) per periodo    | trainer |
| GET    | /api/programs/[id]/reports/training-sets | Serie allenanti per gruppo muscolare     | trainer |
| GET    | /api/programs/[id]/reports/volume        | Volume totale (serie × reps) per muscolo | trainer |

#### Health Check
| Method | Path        | Descrizione                                    | Auth     |
| ------ | ----------- | ---------------------------------------------- | -------- |
| GET    | /api/health | Status DB + Auth (200 healthy / 503 unhealthy) | pubblico |

---

## 7. ZOD SCHEMAS (VALIDAZIONE)

Crea in `src/schemas/` file separati. Ogni schema è usato LATO SERVER (API Route) e LATO CLIENT (React Hook Form).

### exercise.ts
```typescript
export const exerciseSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  youtubeUrl: z.string().url().regex(/youtube\.com|youtu\.be/),
  type: z.enum(['fundamental', 'accessory']),
  movementPatternId: z.string().uuid(),
  muscleGroups: z.array(z.object({
    muscleGroupId: z.string().uuid(),
    coefficient: z.number().min(0).max(1)
  })).min(1),
  notes: z.array(z.string()).optional()
})
```

### workout-exercise.ts
```typescript
export const workoutExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  sets: z.number().int().min(1).max(20),
  reps: z.union([z.number().int().min(1), z.string().regex(/^\d+-\d+$/), z.string().regex(/^\d+\/\d+$/)]),
  targetRpe: z.number().min(5.0).max(10.0).multipleOf(0.5).optional(),
  weightType: z.enum(['absolute', 'percentage_1rm', 'percentage_rm', 'percentage_previous']),
  weight: z.number().optional(),
  restTime: z.enum(['30s', '1m', '2m', '3m', '5m']),
  isWarmup: z.boolean().default(false),
  notes: z.string().optional(),
  order: z.number().int().min(1)
}).refine(
  (data) => data.weightType !== 'percentage_previous' || (data.weight !== undefined && data.weight !== null),
  { message: 'weight è obbligatorio quando weightType è percentage_previous', path: ['weight'] }
)
```

### feedback.ts
```typescript
export const setPerformedSchema = z.object({
  setNumber: z.number().int().min(1),
  reps: z.number().int().min(0).max(50),
  weight: z.number().min(0).max(500)
})

export const feedbackSchema = z.object({
  workoutExerciseId: z.string().uuid(),
  completed: z.boolean(),
  actualRpe: z.number().min(5).max(10).multipleOf(0.5).optional(),
  sets: z.array(setPerformedSchema).min(1),
  notes: z.string().max(1000).optional()
})
```

### week.ts
```typescript
export const weekConfigSchema = z.object({
  weekType: z.enum(['normal', 'test', 'deload']),
  feedbackRequested: z.boolean()
})
```

### personal-record.ts
```typescript
export const personalRecordSchema = z.object({
  exerciseId: z.string().uuid(),
  reps: z.number().int().min(1).max(20),
  weight: z.number().min(0),
  recordDate: z.string().datetime(),
  notes: z.string().optional()
})
```

### Password
```typescript
export const passwordSchema = z.string()
  .min(8, "Password minimo 8 caratteri")
  .regex(/[A-Z]/, "Almeno una maiuscola")
  .regex(/[a-z]/, "Almeno una minuscola")
  .regex(/[0-9]/, "Almeno un numero")
```

---

## 8. BUSINESS LOGIC CRITICA

### 8.1 percentage_previous (calcolo peso relativo)

Quando `weightType = 'percentage_previous'`:
- Il campo `weight` contiene la percentuale da applicare (es. -5 = -5%, +10 = +10%)
- Sistema cerca la PRIMA occorrenza (order più basso) dello STESSO exerciseId nel MEDESIMO workoutId con order < currentOrder
- Formula: `baseWeight * (1 + percentage / 100)`
- Se non trova occorrenza precedente → errore di validazione 
- Se la riga precedente usa anch'essa `percentage_previous`, risolvere **ricorsivamente** (max 10 livelli)

```typescript
export async function calculateEffectiveWeight(workoutExercise, traineeId): Promise<number> {
  switch (workoutExercise.weightType) {
    case 'absolute': return workoutExercise.weight || 0
    case 'percentage_1rm': // lookup PersonalRecord reps=1, calcola percentage
    case 'percentage_rm': // lookup PersonalRecord reps=n, calcola percentage
    case 'percentage_previous': // trova prima occorrenza, risolvi ricorsivamente, applica percentuale
  }
}
```

### 8.2 Workflow scheda (lifecycle)
1. **Draft**: trainer può modificare liberamente più volte
2. **Pubblicazione**: `draft → active`, imposta startDate, calcola date settimane, publishedAt=NOW()
3. **Immutabilità**: scheda active/completed → trainer NON può modificare/eliminare (403). Solo admin override
4. **Completamento**: AUTOMATICO quando `endDate = startDate + durationWeeks * 7` è passata

### 8.3 Creazione programma (POST)
Al POST, genera automaticamente:
- N `Week` con weekNumber 1..durationWeeks, weekType=normal, feedbackRequested=false
- Per ogni Week: M `Workout` con dayLabel "Giorno 1"..."Giorno M" (dove M = workoutsPerWeek)

### 8.4 Feedback trainee
- POST /api/feedback: crea ExerciseFeedback + N SetPerformed (one per set)
- Idempotency: UNIQUE(workoutExerciseId, traineeId, date) — una sola entry per esercizio/giorno
- Feedback obbligatorio: se Week.feedbackRequested=true, trainee DEVE compilare per TUTTI i WorkoutExercise della settimana

### 8.5 Dashboard trainer KPI
```sql
-- Trainee attivi con scheda attiva
SELECT COUNT(DISTINCT tp.traineeId) FROM TrainingProgram tp JOIN User u ON tp.traineeId = u.id WHERE tp.trainerId = ? AND tp.status = 'active' AND u.isActive = true

-- Schede in scadenza (< 7 / < 14 giorni)
-- endDate = startDate + (durationWeeks * 7)
```

### 8.6 Riassegnazione trainee (admin)
1. DELETE vecchio TrainerTrainee
2. INSERT nuovo TrainerTrainee con newTrainerId
3. Schede esistenti mantengono trainerId originale
4. Nuovo trainer può vedere schede esistenti (lettura) ma NON modificarle
5. Nuovo trainer può creare NUOVE schede

---

## 9. FRONTEND — DETTAGLI IMPLEMENTATIVI

### 9.1 Layout per ruolo

**Admin/Trainer → Desktop-first (1280px+)**:
- Sidebar persistente, tabelle multi-colonna, drag-and-drop
- Container: `max-w-7xl px-8`
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- MUI: DataGrid per tabelle, Drawer per sidebar

**Trainee → Mobile portrait-first (360px-428px)**:
- Single column, bottom navigation, CTA prominenti, input touch-friendly (min 44px)
- Container: `max-w-md px-4`
- Grid: `grid-cols-1` sempre
- MUI: BottomNavigation, SwipeableDrawer, Stepper

### 9.2 Componenti chiave

**WeightTypeSelector** — Componente critico:
- Radio buttons per 4 tipi peso
- Se `percentage_previous` selezionato:
  - Cerca occorrenza precedente ( GET /api/workout-exercises?workoutId=X&exerciseId=Y&orderLt=Z )
  - Se trovata: mostra dettagli + input percentuale + preview calcolo in tempo reale
  - Se NON trovata: mostra errore "⚠️ Nessuna occorrenza precedente"
- Preview client-side: `baseWeight * (1 + percentage/100)`
- Backend ri-valida sempre

**WeekTypeBanner** — Identità visiva settimana:
- `normal`: header neutro, nessun badge
- `test`: banner rosso/arancione (#ef4444, #f97316), 🔥⚡, "SETTIMANA DI TEST"
- `deload`: banner verde/azzurro (#10b981, #6ee7b7), 🌿💤, "SETTIMANA DI SCARICO"

**FeedbackForm** — Form mobile-ottimizzato:
- Input serie: stepper +/- per reps/kg (touch-friendly)
- Storico feedback settimane precedenti (lazy-loaded, collapsible)
- Auto-save in localStorage ogni 5 secondi (useFeedbackPersistence hook)
- Clear localStorage dopo submit riuscito

### 9.3 PWA (trainee)

**manifest.json**:
```json
{
  "name": "ZeroCento Training",
  "short_name": "ZeroCento",
  "start_url": "/trainee/dashboard",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#3b82f6",
  "background_color": "#ffffff"
}
```

**Service Worker (@serwist/next)**:
- Cache-first per scheda corrente (disponibile offline)
- Network-first con fallback queue per feedback API
- Stale-while-revalidate per asset statici

**InstallPrompt**: Mostra solo su mobile (< 768px) per trainee

### 9.4 Error Boundaries

Usa `react-error-boundary`:
```typescript
// GlobalErrorFallback — cattura errori app-wide, report a Sentry
// GranularBoundary — boundaries separati per dashboard, feedback, etc.
```

Ogni route group (admin, trainer, trainee) ha il suo error.tsx Next.js + error boundaries granulari per widget/sezioni critiche.

### 9.5 i18n

- URL-based: `/it/trainer/dashboard`, `/en/trainer/dashboard`
- Default: italiano
- File traduzioni: `/public/locales/{it,en}/{common,auth,dashboard,programs,exercises,feedback,errors}.json`
- Hook: `useTranslation('namespace')`
- Middleware Next.js per detection lingua (cookie > browser > default IT)

---

## 10. RATE LIMITING

### Strategia ibrida

**Auth endpoints → Upstash Redis** (persistent, cross-instance):
| Endpoint             | Limite          | Window |
| -------------------- | --------------- | ------ |
| /api/auth/* (login)  | 5 tentativi     | 15 min |
| /api/auth/* (signup) | 3 registrazioni | 1 ora  |

**Altri endpoints → In-memory Map** (volatile, OK per 54 utenti):
| Endpoint                    | Limite       | Window |
| --------------------------- | ------------ | ------ |
| /api/feedback               | 30 req       | 1 min  |
| /api/users (POST)           | 20 creazioni | 1 ora  |
| API generiche (autenticate) | 100 req      | 1 min  |
| API generiche (pubbliche)   | 20 req       | 1 min  |

Implementa nel middleware Next.js. Response 429 con `{ error: { code: "RATE_LIMIT_EXCEEDED", message: "..." } }`.

---

## 11. TESTING

### Unit (Vitest)
- **Coverage minimo: 80%** su lines/branches/functions/statements
- **Target**: business logic, Zod schemas, helper/utils, permission logic, custom hooks
- **Esclusi**: config files, layout/loading/error.tsx, componenti presentazionali puri
- Config in `vitest.config.ts` con environment jsdom, alias `@/`

### E2E (Playwright)
- **Bloccante per deploy prod** — E2E fail su staging → merge su main bloccato
- **2 progetti**: `desktop-trainer` (1440×900 Chrome), `mobile-trainee` (Pixel 5)
- **Flussi prioritari**:
  - P0: Login + redirect per ruolo, accesso negato route non autorizzate
  - P1: Crea esercizio, crea scheda multi-settimana, pubblica scheda, invia feedback
  - P1: Esercizio ripetuto con percentage_previous, crea profilo trainee con password
  - P2: Reportistica, admin CRUD, disabilitazione/riabilitazione trainee

### Accessibility
- `@axe-core/playwright` — WCAG 2.1 Level AA
- Test in E2E: `await checkA11y(page)` su pagine principali

---

## 12. SEED DATA

### Strategia per ambiente

**Development/Test** (seed.ts):
```
- 1 admin: admin@zerocento.app
- 2 trainer: trainer1@zerocento.app, trainer2@zerocento.app
- 5 trainee per trainer (10 totale)
- TrainerTrainee associazioni
- 5 MuscleGroup: Pettorali, Quadricipiti, Dorsali, Deltoidi, Glutei
- 5 MovementPattern: Squat, Horizontal Push, Hip Extension, Horizontal Pull, Vertical Pull
- 10 Exercise (5 fundamental + 5 accessory) con ExerciseMuscleGroup
- 2 TrainingProgram per trainer (1 draft + 1 active) con Week, Workout, WorkoutExercise
- Feedback sample su scheda active
- PersonalRecord sample (1RM squat, bench, deadlift)
```

**Production**: Solo admin seed iniziale (admin@zerocento.app). Tutto il resto creato manualmente.

Esegui seed: `npx prisma db seed` (configura `prisma.seed` in package.json)

---

## 13. ENVIRONMENT VARIABLES

### .env.example
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Database (Prisma)
DATABASE_URL=postgresql://user:pass@db.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://user:pass@db.supabase.co:5432/postgres

# Upstash Redis (rate limiting auth)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx

# App
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 14. CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml
on:
  pull_request: [staging, main]
  push: [staging, main]

jobs:
  test:
    - npm ci
    - npm run lint
    - npm run type-check
    - npm run test:unit -- --coverage
    - Verifica coverage >= 80%

  e2e-staging:
    needs: test
    if: github.ref == 'refs/heads/staging'
    - npx playwright install --with-deps
    - npm run test:e2e (BASE_URL=https://test.zerocento.app)
    - Upload playwright report
    - Se fail → BLOCCA deploy prod

  deploy-prod:
    needs: e2e-staging
    if: github.ref == 'refs/heads/main'
    - Vercel auto-deploy
```

---

## 15. MONITORING

1. **Health endpoint**: GET /api/health — check DB (`SELECT 1`) + Supabase Auth. Return 200/503
2. **Sentry**: Init con `tracesSampleRate: 0.1`, filtra cookies da eventi, tag `environment`
3. **Vercel Analytics**: Incluso in Pro, Web Vitals automatici
4. **UptimeRobot**: Ping `/api/health` ogni 5 min (setup manuale esterno)

---

## 16. CONFIGURAZIONI CHIAVE

### next.config.js
- Serwist PWA plugin
- Sentry plugin
- i18n config
- Image domains: youtube.com, img.youtube.com

### tailwind.config.ts
- Content paths: src/**/*.{ts,tsx}
- Extend theme se necessario per colori brand

### Prisma client singleton (lib/prisma.ts)
```typescript
const globalForPrisma = global as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Supabase client
- Browser: `createClientComponentClient()` con autoRefreshToken, persistSession
- Server: `createServerComponentClient()` / `createRouteHandlerClient()`

---

## 17. ORDINE DI IMPLEMENTAZIONE RACCOMANDATO

Procedi in questo ordine per minimizzare dipendenze circolari:

### Fase 1 — Fondamenta
1. Init progetto Next.js con TypeScript, Tailwind, ESLint
2. Configura Prisma con schema.prisma esistente, genera client, prima migration
3. Configura Supabase client (browser + server)
4. Implementa `lib/prisma.ts`, `lib/api-response.ts`, `lib/auth.ts`
5. Implementa middleware.ts (auth + routing ruoli)
6. Setup i18n (config + middleware + file traduzioni base)

### Fase 2 — Auth
7. Pagine login, forgot-password, reset-password, change-password
8. RoleGuard component
9. Redirect / → dashboard ruolo

### Fase 3 — Backend API core
10. API users (CRUD + activate/deactivate)
11. API muscle-groups (CRUD + archive)
12. API movement-patterns (CRUD + archive)
13. API exercises (CRUD con pagination cursor-based)
14. API programs (CRUD + publish + progress)
15. API weeks (PATCH config)
16. API feedback (CRUD + submit)
17. API personal records (trainer CRUD, trainee read)
18. API admin override (programs, riassegnazione)
19. API reportistica (SBD, volume, training-sets)
20. API health check

### Fase 4 — Frontend Trainer (desktop-first)
21. Layout trainer con sidebar
22. Dashboard trainer con KPI
23. Libreria esercizi (lista, crea, dettaglio, modifica)
24. Gestione trainee (lista, crea con password, profilo, records)
25. Programmi: lista, new (step 1-4), dettaglio, progress, reports
26. WeightTypeSelector + percentage_previous logic
27. Week overview con colori MovementPattern
28. Settings movement colors

### Fase 5 — Frontend Trainee (mobile-first)
29. Layout trainee con bottom navigation
30. Dashboard trainee
31. Scheda corrente (settimane/giorni)
32. Workout detail + FeedbackForm + SetInput
33. WeekTypeBanner (test/deload)
34. Storico schede
35. Records (visualizzazione)
36. PWA (manifest, service worker, InstallPrompt)
37. useFeedbackPersistence (auto-save localStorage)

### Fase 6 — Frontend Admin (desktop)
38. Layout admin
39. Dashboard admin
40. Gestione utenti (lista, crea, dettaglio, modifica)
41. Programmi globali (lista, dettaglio, modifica, override)
42. Riassegnazione trainee
43. Reports globali

### Fase 7 — Quality & Polish
44. Error boundaries (react-error-boundary + Sentry)
45. Loading/empty/error states (skeletons, illustrazioni, CTA)
46. Accessibility audit (@axe-core/playwright)
47. Sentry integration completa
48. Unit tests (Vitest, target 80%)
49. E2E tests (Playwright, flussi critici)
50. CI/CD pipeline (GitHub Actions)
51. Seed data (development + production admin)

---

## 18. VINCOLI E REGOLE IMPERATIVE

1. **NON usare NextAuth** — solo Supabase Auth
2. **NON salvare password** nel DB pubblico (solo in auth.users Supabase)
3. **NON usare JSON** per serie eseguite — usa tabella SetPerformed normalizzata
4. **NON permettere** modifica/eliminazione schede active/completed da trainer (solo admin override)
5. **Scheda immutabile** dopo pubblicazione per trainer. Admin può forzare modifica
6. **Libreria esercizi condivisa** — tutti i trainer CRUD su qualsiasi esercizio
7. **TrainerTrainee 1:1** — un trainee ha UN SOLO trainer (UNIQUE su traineeId)
8. **Cursor-based pagination** su lista esercizi (non offset-based)
9. **Soft-delete globale NON implementato** — eliminazione fisica con cleanup eccetto per archive su MuscleGroup/MovementPattern
10. **GDPR**: data storage EU only, HTTPS obbligatorio, cookie consent
11. **Date**: Storage UTC, conversione frontend con date-fns-tz
12. **Budget**: €45-48/mese — non sforare (no servizi a pagamento extra)
13. **MUI solo per**: DataGrid, Drawer, BottomNavigation, SwipeableDrawer, Stepper. Tutto il resto Tailwind
14. **RPE**: range 5.0-10.0 con incrementi 0.5
15. **Coverage test**: minimo 80% su business logic

---

## 19. USER STORIES DI RIFERIMENTO (48 totali)

### Admin (US-A01 → US-A14)
- A01: Lista completa utenti
- A02: Crea trainer/trainee
- A03: Modifica qualsiasi utente
- A04: Disattiva/riattiva trainee
- A05: Elimina utente
- A06: Genera password iniziale
- A07: Visualizza associazioni trainer-trainee
- A08: Modifica associazioni (riassegnazione)
- A09: Lista globale schede con filtri
- A10: Modifica qualsiasi scheda (anche active/completed)
- A11: Elimina qualsiasi scheda
- A12: Riassegna trainee a nuovo trainer
- A13: Report e monitoraggio globale
- A14: Audit log operazioni admin

### Trainer (US-T01 → US-T28)
- T01-T06: Libreria esercizi (CRUD condiviso, filtri, dettaglio con video)
- T07-T10: Gruppi muscolari e schemi motori (CRUD, archiviazione)
- T11: Personalizza colori MovementPattern
- T12-T17: Gestione trainee (lista, crea con password, modifica, disabilita, profilo, massimali)
- T18: Crea scheda (step 1 setup)
- T19: Week overview con colori pattern (step 2)
- T20: Dettaglio workout (step 3, compilazione serie/reps/RPE/peso/recupero)
- T20a: Esercizio ripetuto con percentage_previous
- T21: Salva draft, modifica multipla
- T22: Pubblica con scelta data inizio (step 4)
- T23-T23c: Configura weekType (normal/test/deload) e feedbackRequested
- T24: Lista schede con filtri
- T25: Monitoraggio avanzamento settimanale
- T26: Lettura feedback dettagliati trainee
- T27: Report SBD (FRQ, NBL, IM)
- T28: Grafici serie/volume per muscolo

### Trainee (US-U01 → US-U13)
- U01: Dashboard con scheda attiva
- U02: Scheda suddivisa per settimana/giorno
- U03: Dettaglio workout con parametri
- U04: Video YouTube per esercizio
- U05: Gruppi muscolari con coefficienti
- U06: Storico schede
- U07: Feedback con serie (reps/kg), RPE, note, completamento
- U08: Sessione 90+ min senza re-login
- U09: Auto-save feedback parziale (background)
- U10: Feedback generale settimana obbligatoria
- U11-U11c: Badge feedback obbligatorio + banner weekType (test vivace, deload rilassante, combinazione)
- U12: Visualizza massimali
- U13: Storico massimali per esercizio con trend

---

## 20. CHECKLIST FINALE

Prima di considerare il progetto completato, verifica:

- [ ] Tutte le 14 entità DB implementate con relazioni corrette
- [ ] Tutti gli endpoint API funzionanti con validazione Zod
- [ ] RBAC matrice rispettata su ogni endpoint
- [ ] Auth Supabase funzionante (login, logout, refresh, password reset, cambio password)
- [ ] Middleware route protection per ruolo
- [ ] Creazione trainee con password temporanea
- [ ] Workflow scheda: draft → publish → immutabile → completed (auto)
- [ ] percentage_previous funzionante con calcolo ricorsivo
- [ ] Feedback con serie normalizzate (SetPerformed)
- [ ] PWA installabile per trainee
- [ ] Auto-save feedback in localStorage
- [ ] i18n IT + EN funzionante
- [ ] WeekType banner (test/deload) visivamente distinti
- [ ] Dashboard KPI trainer (trainee attivi, schede in scadenza)
- [ ] Admin override su schede + riassegnazione trainee
- [ ] Rate limiting ibrido (Redis auth + in-memory rest)
- [ ] Error boundaries con Sentry
- [ ] Health check endpoint
- [ ] Unit test coverage ≥ 80%
- [ ] E2E flussi P0/P1 funzionanti
- [ ] WCAG 2.1 AA compliance base
- [ ] Seed data per development/test
- [ ] CI/CD pipeline configurata
- [ ] .env.example completo
