# 🚀 PROMPT IMPLEMENTAZIONE RAPIDA - ZeroCento Training Platform

**Utilizza questo prompt per chiedere all'agente di implementare le funzionalità mancanti.**

---

## 📋 CHECKLIST STATO ATTUALE

### ✅ Completato (~20%)
- Setup progetto Next.js + TypeScript + Tailwind
- Database schema Prisma (14 entità)
- Librerie utility (auth, API response, calculations, validations)
- Middleware con RBAC e rate limiting
- API Users CRUD completo
- API Muscle Groups e Movement Patterns (parziale)
- Login page funzionante
- Dashboard layout base (Admin, Trainer, Trainee)
- Componenti: UsersTable, ExercisesTable, ProfileForm, modali User CRUD

### ❌ Da Implementare (~80%)
- **API Backend:** Exercises (detail/edit/delete), Programs (completo), Workout Exercises, Feedback, Personal Records
- **Frontend Trainer:** Dashboard funzionante, gestione esercizi, gestione trainee, wizard creazione programma (4 step)
- **Frontend Trainee:** Dashboard funzionante, vista programma attivo, dettaglio workout con feedback form
- **Frontend Admin:** Dashboard con statistiche, gestione programmi globale, riassegnazione trainee
- **Componenti:** WeightTypeSelector, RPESelector, RestTimeSelector, RepsInput, FeedbackForm, ExerciseCard, ToastNotification
- **PWA:** Service Worker, offline support, install prompt

---

## 🎯 PROMPT PER SPRINT 1 (CRITICAL - 2 SETTIMANE)

### Backend API (Priorità 1)

```
Implementa le seguenti API per la piattaforma ZeroCento:

1. **API Exercises - Completamento CRUD:**
   - GET /api/exercises/[id] - Dettaglio singolo esercizio
   - PUT /api/exercises/[id] - Modifica esercizio (validation: solo trainer può modificare qualsiasi esercizio)
   - DELETE /api/exercises/[id] - Eliminazione esercizio (validation: non eliminare se usato in WorkoutExercise attivi)
   
   Utilizza schema validation esistente in src/schemas/exercise.ts
   Segui pattern RBAC di src/lib/auth.ts (requireRole)

2. **API Programs - CRUD completo:**
   Crea directory src/app/api/programs/ con:
   
   - GET /api/programs/route.ts - Lista programmi con pagination cursor-based
     Query params: trainerId, traineeId, status (draft/active/completed), search, cursor
     RBAC: Admin vede tutti, Trainer solo propri, Trainee solo propri assegnati
   
   - POST /api/programs/route.ts - Creazione programma (status=draft)
     Body: name, traineeId, durationWeeks, workoutsPerWeek, notes, weeks[]
     Business logic: auto-create Weeks (1...durationWeeks) e Workouts vuoti
     Validazione: trainer ownership su traineeId
   
   - GET /api/programs/[id]/route.ts - Dettaglio programma completo
     Include: weeks → workouts → workoutExercises → exercise
   
   - PUT /api/programs/[id]/route.ts - Modifica programma
     Immutabilità: solo se status=draft (trainer) o admin override
   
   - DELETE /api/programs/[id]/route.ts - Eliminazione programma
     Solo se status=draft, admin può eliminare qualsiasi status

   Utilizza schema validation esistente in src/schemas/program.ts

3. **API Workout Exercises:**
   Crea directory src/app/api/programs/[programId]/workouts/[workoutId]/exercises/
   
   - POST /exercises/route.ts - Aggiungi esercizio a workout
     Body: exerciseId, orderIndex, sets, reps, notes, targetRPE, weightType, weightValue, restSeconds, isWarmup
     Validazione: program ownership, solo se status=draft
   
   - PUT /exercises/[exerciseId]/route.ts - Modifica WorkoutExercise
   
   - DELETE /exercises/[exerciseId]/route.ts - Rimuovi esercizio da workout
     Business logic: ricalcola orderIndex degli altri esercizi
   
   - PATCH /exercises/reorder/route.ts - Riordina esercizi
     Body: exercises[] array con id + orderIndex

   Utilizza schema validation esistente in src/schemas/workout-exercise.ts

4. **API Publish Program:**
   Crea src/app/api/programs/[id]/publish/route.ts
   
   - POST /api/programs/[id]/publish - Pubblica programma
     Body: { startDate: "2026-04-01" }
     Business logic:
       - Status: draft → active
       - Calcola endDate = startDate + (durationWeeks * 7 giorni)
       - Assegna date a ogni Week (week1Start = startDate, week2Start = +7 giorni, ...)
       - Validazione: ogni Workout deve avere almeno 1 WorkoutExercise
     RBAC: solo trainer owner o admin

5. **API Feedback:**
   Crea directory src/app/api/feedback/
   
   - POST /api/feedback/route.ts - Creazione feedback trainee
     Body: workoutExerciseId, notes, setsPerformed[] (array con setNumber, reps, weight, rpe)
     Business logic:
       - Nested create: ExerciseFeedback + multiple SetPerformed
       - Calcola totalVolume = sum(reps * weight)
       - Calcola avgRPE = average di tutte le serie
       - Idempotency: se esiste già feedback per workoutExerciseId, UPDATE invece di INSERT
     RBAC: trainee può creare solo per propri workout
   
   - GET /api/feedback/route.ts - Lista feedback
     Query params: traineeId, programId, exerciseId
     RBAC: trainer vede solo propri trainee, trainee vede solo propri
   
   - GET /api/feedback/[id]/route.ts - Dettaglio singolo feedback
     Include: setsPerformed + workout + exercise info
   
   - PUT /api/feedback/[id]/route.ts - Modifica feedback
     Validazione: trainee può modificare solo propri feedback entro 24h dalla creazione

   Utilizza schema validation esistente in src/schemas/feedback.ts

Segui convenzioni esistenti:
- Usa apiSuccess() e apiError() da src/lib/api-response.ts
- Usa requireAuth(), requireRole(), requireTrainerOwnership() da src/lib/auth.ts
- Usa prisma client da src/lib/prisma.ts
- Log errori con logger da src/lib/logger.ts
- TypeScript strict mode, no any
```

---

### Componenti Condivisi (Priorità 2)

```
Crea i seguenti componenti React in src/components/:

1. **WeightTypeSelector.tsx** - Selector tipo peso + valore
   Props: weightType, weightValue, onChange, showPreviousReference?, previousExerciseOrder?
   UI: Select weightType (absolute_kg, percentage_1rm, percentage_previous) + Input number weightValue
   Se percentage_previous: mostra badge "Rispetto all'esercizio #X"
   TypeScript fully typed, validation con Zod

2. **RPESelector.tsx** - Slider RPE 5.0-10.0 (step 0.5)
   Props: value, onChange, disabled?
   UI: Range slider con label visibile, colori progressivi (verde 5-7 → giallo 7.5-8.5 → rosso 9-10)
   Mostra descrizione testuale sotto lo slider (es. "7.5 = 2-3 reps in riserva")

3. **RestTimeSelector.tsx** - Select tempo recupero
   Props: value (secondi), onChange
   Options: 30s, 1m, 2m, 3m, 5m

4. **RepsInput.tsx** - Input ripetizioni (numero o range "N/M")
   Props: value (string), onChange, placeholder?
   Validation: accetta solo numeri o formato "N/M"
   Mostra errore se formato invalido

5. **FeedbackForm.tsx** - Form completo feedback trainee
   Props: workoutExercise, onSubmit, existingFeedback?, autoSave?
   UI:
   - Lista serie dinamica (aggiungi/rimuovi)
   - Per ogni serie: input reps, peso, slider RPE
   - Textarea note generali
   - Calcolo volume totale live
   - Auto-save localStorage ogni 30s se autoSave=true
   Submit: POST /api/feedback con nested setsPerformed

6. **ExerciseCard.tsx** - Card visualizzazione esercizio
   Props: exercise, onEdit?, onDelete?, showActions?, compact?
   UI:
   - Thumbnail video YouTube
   - Nome esercizio (bold)
   - Badge tipo (Fondamentale/Accessorio)
   - Tag MovementPattern colorato
   - Tag MuscleGroups con coefficienti
   - Actions (Modifica, Elimina) se showActions=true

7. **MovementPatternTag.tsx** - Tag colorato schema motorio
   Props: pattern (MovementPattern), size? (sm/md/lg), showIcon?
   UI: Badge con colore personalizzato pattern

8. **YoutubeEmbed.tsx** - Iframe YouTube responsive
   Props: url (string), title?
   UI: Aspect ratio 16:9, error handling URL invalidi

9. **WeekTypeBanner.tsx** - Banner settimana test/deload
   Props: weekType (normal/test/deload), weekNumber
   UI:
   - normal: nessun banner
   - test: banner arancione "SETTIMANA TEST #N - Verifica massimali"
   - deload: banner blu "SETTIMANA SCARICO #N - Recupero attivo"

10. **LoadingSpinner.tsx** - Spinner loading
    Variants: page-level (fullscreen), component-level (inline), button-level (mini)

11. **ToastNotification.tsx** - Toast notifications
    Variants: success (verde), error (rosso), warning (giallo), info (blu)
    Usa libreria: react-hot-toast o sonner

Styling: Tailwind CSS
Accessibilità: ARIA labels, keyboard navigation
TypeScript: strict typing, no any
```

---

### Frontend Trainer (Priorità 3)

```
Implementa il frontend Trainer completo:

1. **Dashboard Trainer** (src/app/trainer/dashboard/page.tsx)
   Completa la pagina esistente con:
   - Card "I Miei Atleti" con count trainee (attivi/disabilitati) → link /trainer/trainees
   - Card "Programmi" con count per status (draft/active/completed) → link /trainer/programs
   - Card "Libreria Esercizi" con count esercizi → link /trainer/exercises
   - Quick actions: "Crea programma", "Aggiungi trainee", "Crea esercizio"
   - Feed ultimi feedback trainee (5 più recenti)
   Fetch dati da API esistenti (GET /api/users?role=trainee, GET /api/programs)

2. **Gestione Esercizi Trainer** (src/app/trainer/exercises/)
   - page.tsx - Lista esercizi
     Implementa tabella con:
     - Colonne: Thumbnail video, Nome, Tipo, MovementPattern, MuscleGroups, Creato da, Actions
     - Filtri: tipo, movementPattern, muscleGroup, search
     - Pagination cursor-based
     - Bottone "Crea esercizio" → /trainer/exercises/new
     - Actions: Modifica, Elimina (con conferma)
     Fetch: GET /api/exercises con query params
   
   - new/page.tsx - Form creazione esercizio
     Form con campi:
     - Nome (input text required)
     - Descrizione (textarea)
     - URL YouTube (input url + preview embed sotto)
     - Tipo (radio: Fondamentale/Accessorio)
     - Movement Pattern (select)
     - Muscle Groups (multi-select con slider coefficienti 0.1-1.0)
       Validazione: somma coefficienti ≤ 1.0
     - Note/Varianti (textarea)
     Submit: POST /api/exercises
   
   - [id]/edit/page.tsx - Form modifica esercizio
     Stessa struttura di new, pre-popolato con dati esistenti
     Fetch: GET /api/exercises/[id]
     Submit: PUT /api/exercises/[id]

3. **Gestione Trainee** (src/app/trainer/trainees/)
   - page.tsx - Lista trainee
     Tabella con colonne: Nome, Email, Status, Programmi attivi, Ultimo programma, Actions
     Actions: Visualizza, Modifica, Attiva/Disattiva
     Bottone "Aggiungi trainee" → /trainer/trainees/new
     Fetch: GET /api/users?role=trainee (filtra solo propri trainee)
   
   - new/page.tsx - Form creazione trainee
     Campi: nome, cognome, email, note, checkbox "genera password auto"
     Submit: POST /api/users
     Success: mostra password generata (alert o modal)
   
   - [id]/page.tsx - Profilo trainee
     Sezioni:
     - Header: nome, email, status badge, bottoni "Modifica" e "Gestisci massimali"
     - Tab Programmi: lista programmi assegnati (draft/active/completed) con progress bar
     - Tab Feedback: ultimi 10 feedback
     Fetch: GET /api/users/[id], GET /api/programs?traineeId=[id], GET /api/feedback?traineeId=[id]
   
   - [id]/records/page.tsx - Gestione massimali trainee
     Tabella massimali: Esercizio, 1RM, 3RM, 5RM, 10RM, Data, Actions
     Bottone "Aggiungi massimale" → Modale con select esercizio + input RM + date picker
     Submit: POST /api/personal-records (da implementare)

4. **Wizard Creazione Programma** (src/app/trainer/programs/)
   
   - new/page.tsx - STEP 1: Setup programma
     Form:
     - Nome programma (input text)
     - Trainee assegnato (select dropdown)
     - Durata settimane (input number + quick buttons 4/6/8/12)
     - Allenamenti per settimana (input number + quick buttons 3/4/5)
     - Note (textarea)
     Bottone "Avanti" → POST /api/programs (status=draft) → naviga a [id]/week-overview
   
   - [id]/week-overview/page.tsx - STEP 2: Week Overview
     UI:
     - Header: progress wizard (Step 2/4), nome programma, trainee
     - Selector settimana: dropdown + toggle tipo settimana (normal/test/deload)
     - Grid workout (colonne per giorno):
       - Per ogni workout: nome (editabile inline), lista esercizi (solo nome + badge colore MovementPattern)
       - Bottone "+ Aggiungi esercizio" → modale con select esercizio (search autocomplete)
     - Navigazione: "Indietro" (Step 1), "Vai al dettaglio workout" (per ogni workout → Step 3)
     Fetch: GET /api/programs/[id] con include weeks/workouts/workoutExercises
     Quick add esercizio: POST /api/programs/[id]/workouts/[wId]/exercises (solo exerciseId, resto null)
   
   - [id]/workouts/[workoutId]/edit/page.tsx - STEP 3: Workout Detail
     UI:
     - Header: progress wizard (Step 3/4), nome programma, "Settimana X - Giorno Y"
     - Tabella esercizi workout:
       Colonne: Ordine (drag handle), Esercizio, Serie, Reps, Note, RPE, Peso, Recupero, Azioni
       Per ogni WorkoutExercise: form inline con:
         - Input serie (number)
         - RepsInput component
         - Select note preset
         - RPESelector component
         - WeightTypeSelector component
         - RestTimeSelector component
         - Checkbox "Riscaldamento"
         - Bottone "Elimina" (icona cestino)
       Drag & drop per riordinare: PATCH /api/programs/[id]/workouts/[wId]/exercises/reorder
     - Bottoni: "+ Aggiungi esercizio", "Salva workout", "Workout successivo", "Vai a pubblicazione"
     Fetch: GET /api/programs/[id] (include workout exercises)
     Submit: PUT /api/programs/[id]/workouts/[wId]/exercises/[exId] per ogni modifica
   
   - [id]/publish/page.tsx - STEP 4: Publish
     UI:
     - Riepilogo programma: nome, trainee, durata, totale workout/esercizi
     - Lista settimane con workouts (collapsible)
     - Validazione: ogni workout ha ≥1 esercizio, tutti esercizi compilati (serie/reps/RPE/peso)
     - Form pubblicazione:
       - Label "Data inizio Week 1"
       - Date picker (default: prossimo lunedì)
       - Preview calcolo date settimane
     - Bottoni: "Pubblica programma", "Torna a modifiche"
     Submit: POST /api/programs/[id]/publish con { startDate }
     Success: modal "Programma pubblicato!" → bottoni "Vai al programma" / "Torna alla lista"
   
   - page.tsx - Lista programmi trainer
     Tabs: Draft, Active, Completed
     Per ogni tab, tabella: Nome, Trainee, Durata, Date, Progress, Actions
     Actions: Visualizza, Modifica (solo draft), Elimina, Pubblica (solo draft)
     Bottone "Crea nuovo programma" → /trainer/programs/new
     Fetch: GET /api/programs con filter status

5. **Monitoraggio Avanzamento** (src/app/trainer/programs/[id]/progress/page.tsx)
   UI:
   - Header programma: nome, trainee, status, date
   - KPI cards: settimana corrente, workout completati, feedback totali, volume totale, RPE medio
   - Progress bar visuale settimane (colori: grigio non iniziata, giallo in corso, verde completata)
   - Tabella workout: Settimana, Giorno, Nome, Data prevista, Completato (sì/no), Feedback count, Volume, RPE media
   - Grafici (opzionale): Line chart volume per settimana, Line chart RPE medio per settimana
   Fetch: GET /api/programs/[id]/progress (da implementare)

Styling: Tailwind CSS, responsive desktop-first
RBAC: tutte le pagine protette con requireAuth() + requireRole('trainer')
Error handling: try/catch con toast error, loading states, validation errors
TypeScript: strict typing, interface per API responses
```

---

### Frontend Trainee (Priorità 4)

```
Implementa il frontend Trainee completo (mobile-first):

1. **Dashboard Trainee** (src/app/trainee/dashboard/page.tsx)
   Completa la pagina esistente con:
   - Hero card "Programma Attivo":
     - Se nessun programma: "Nessun programma assegnato"
     - Se programma attivo: nome, settimana corrente (X/totale), progress bar
     - Bottone "Vedi allenamenti" → /trainee/programs/current
   - Card "Prossimo allenamento":
     - Nome workout, data, numero esercizi
     - Bottone "Inizia allenamento" → workout detail
     - Badge "Completato ✅" se già fatto
   - Card "Massimali": link /trainee/records, mostra top 3 massimali (SBD)
   - Card "Storico": link /trainee/history, ultimi 3 programmi completati
   Fetch: GET /api/programs?traineeId=me&status=active

2. **Programma Attivo** (src/app/trainee/programs/current/page.tsx)
   UI:
   - Header: nome programma, trainer, date, progress bar
   - Accordion settimane:
     - Per ogni settimana: header "Settimana X" + banner tipo (test/deload)
     - Lista workout: nome, data prevista, badge status (da fare/in corso/completato)
     - Bottone "Vedi dettaglio" / "Inizia" → workout detail
   - Scroll automatico a settimana corrente
   Fetch: GET /api/programs?traineeId=me&status=active (include weeks/workouts)

3. **Dettaglio Workout + Feedback** (src/app/trainee/programs/[programId]/workouts/[workoutId]/page.tsx)
   UI mobile-first:
   - Header sticky: nome workout, data, timer sessione (opzionale), "Salva e chiudi"
   - Lista esercizi (card verticali):
     Per ogni WorkoutExercise:
     - Card esercizio:
       - Nome (bold)
       - Badge MovementPattern (colore)
       - Prescrizione: "4 x 8 @ RPE 7.5 | 100kg | Recupero 2m"
       - Note trainer
       - Bottone "Vedi video" → modale YouTube embed
     - Form feedback (collapsible):
       - Checkbox "Segna come completato"
       - Se checked:
         - Textarea "Note"
         - Lista serie eseguite (dinamica):
           - Per ogni serie: input reps, input peso (kg), slider RPE
           - Bottone "+ Aggiungi serie" / "- Rimuovi"
           - Default: pre-popolato con numero serie prescritto
         - Calcolo live: Volume totale, RPE media
     - Separatore visivo
   - Sticky footer:
     - Bottone "Salva progressi" (auto-save localStorage ogni 30s)
     - Badge "X / Y esercizi completati"
     - Bottone "Completa allenamento" (enabled solo se tutti checked)
   Fetch: GET /api/programs/[id] (include workout + workoutExercises)
   Auto-save: localStorage key `workout-draft-${workoutId}` ogni 30s
   Submit finale: POST /api/feedback (batch per tutti gli esercizi con feedback)
   Idempotency: se workout già completato, carica feedback esistenti (modalità edit)

4. **Storico Programmi** (src/app/trainee/history/page.tsx)
   Lista programmi completati (card):
   - Nome, trainer, date, durata, badge "Completato"
   - Statistiche: volume totale, workout completati
   - Bottone "Visualizza" → dettaglio read-only
   Fetch: GET /api/programs?traineeId=me&status=completed

5. **Massimali Trainee** (src/app/trainee/records/page.tsx)
   Tabella massimali (read-only):
   - Esercizio, 1RM, 3RM, 5RM, 10RM, Data ultima modifica
   - Nota: "I massimali vengono aggiornati dal tuo trainer"
   Fetch: GET /api/personal-records?traineeId=me

Styling: Tailwind CSS, mobile-first responsive
Touch-friendly: bottoni min 44x44px, spacing generoso
RBAC: tutte le pagine protette con requireAuth() + requireRole('trainee')
Auto-save: localStorage per workout draft
Error handling: toast notifications
TypeScript: strict typing
```

---

### Frontend Admin (Priorità 5 - Opzionale)

```
Implementa il frontend Admin:

1. **Dashboard Admin** (src/app/admin/dashboard/page.tsx)
   Completa con:
   - Cards statistiche: utenti per ruolo, programmi per status, volume ultimi 30gg
   - Quick actions: "Crea utente", "Vedi report"
   Fetch: GET /api/admin/reports/global (da implementare)

2. **Gestione Programmi Globale** (src/app/admin/programs/page.tsx)
   Tabella tutti programmi (tutti i trainer):
   - Colonne: Nome, Trainer, Trainee, Status, Durata, Date, Progress, Actions
   - Filtri: trainer (dropdown), trainee (dropdown), status (multi-select), search
   - Pagination cursor-based
   - Actions: Visualizza, Modifica, Elimina
   Fetch: GET /api/programs (admin vede tutti)

3. **Dettaglio Programma Admin Override** (src/app/admin/programs/[id]/page.tsx)
   Stesso layout di trainer, ma:
   - Badge warning se active: "Attenzione: modifiche impattano trainee"
   - Bottone "Modifica" (bypass immutabilità)
   - Bottone "Elimina" (anche se active/completed)
   Submit: PUT /api/admin/programs/[id]/override (da implementare)

4. **Riassegnazione Trainee** (src/app/admin/trainees/[id]/reassign/page.tsx)
   Form:
   - Info trainee corrente
   - Trainer attuale (nome + email)
   - Select nuovo trainer
   - Textarea "Motivazione" (required)
   - Avvertimento: "Programmi attivi resteranno assegnati al trainer precedente"
   - Bottone "Conferma riassegnazione"
   Submit: POST /api/admin/trainees/[id]/reassign (da implementare)

5. **Report Globali** (src/app/admin/reports/page.tsx)
   Dashboard:
   - Cards: totali utenti, programmi, volume 30gg
   - Grafici: line chart volume ultimi 30gg, top 5 trainer per volume, top 5 esercizi
   - Export PDF/CSV (opzionale)
   Fetch: GET /api/admin/reports/global (da implementare)

Styling: Tailwind CSS, responsive desktop
RBAC: requireRole('admin')
```

---

## 🔧 UTILITY & FUNZIONALITÀ TRASVERSALI

```
Implementa funzionalità trasversali:

1. **API Personal Records** (src/app/api/personal-records/)
   - GET /api/personal-records - Lista massimali trainee
     Query: traineeId, exerciseId
     RBAC: trainer vede solo propri trainee, trainee solo propri
   - POST /api/personal-records - Crea/aggiorna massimale (upsert)
     Body: traineeId, exerciseId, oneRM, threeRM, fiveRM, tenRM, recordedAt
     Upsert logic: se esiste record per traineeId+exerciseId, UPDATE
   - DELETE /api/personal-records/[id] - Elimina massimale
   Schema: src/schemas/personal-record.ts

2. **API Progress** (src/app/api/programs/[id]/progress/route.ts)
   - GET /api/programs/[id]/progress - Avanzamento programma
     Response: currentWeek, totalWeeks, completedWorkouts, totalWorkouts, feedbackCount, avgRPE, totalVolume
     Include: lista workout con flag completati (hanno feedback)

3. **Forgot/Reset Password Flow**
   - src/app/forgot-password/page.tsx - Form email → Supabase auth.resetPasswordForEmail()
   - src/app/reset-password/page.tsx - Form nuova password (riceve token da URL) → Supabase auth.updateUser()
   - src/app/profile/change-password/page.tsx - Form cambio password loggato

4. **Auto-save Workout Draft** (src/lib/workout-draft.ts)
   Utility per localStorage:
   - saveWorkoutDraft(workoutId, data) - salva ogni 30s
   - getWorkoutDraft(workoutId) - recupera al load
   - clearWorkoutDraft(workoutId) - cancella dopo submit
   Key: `workout-draft-${workoutId}`

5. **API Client Wrapper** (src/lib/api-client.ts)
   Wrapper fetch con:
   - Intercettore errori HTTP
   - Auto-refresh token Supabase se 401
   - Retry logic per network errors (opzionale)
   - Mapping error codes → messaggi user-friendly

Convenzioni: TypeScript strict, error handling completo, RBAC su tutti gli endpoint
```

---

## 📱 PWA & MOBILE (Opzionale - Sprint 2+)

```
Implementa funzionalità PWA:

1. **Service Worker** (src/app/sw.ts con @serwist/next)
   - Offline fallback page
   - Cache strategy: network-first API, cache-first assets
   - Background sync per feedback (se offline, invia quando torna online)

2. **PWA Install Prompt** (src/components/PWAInstallPrompt.tsx)
   - Banner bottom sticky (solo mobile, solo trainee)
   - "Installa ZeroCento sul tuo telefono"
   - Detect beforeinstallprompt event
   - Dismissable con localStorage (ricorda 7 giorni)

3. **Offline Storage**
   - IndexedDB per cache programmi/workout offline
   - Sync automatico quando riconnette

Librerie: @serwist/next, idb (IndexedDB wrapper)
```

---

## 🧪 TESTING (Opzionale - Sprint 3+)

```
Implementa test suite:

1. **Unit Tests** (Vitest) - Target 80% coverage
   - src/lib/calculations.ts - test calculateEffectiveWeight, calculateVolume, parseReps, estimateOneRM
   - src/lib/password-utils.ts - test generateSecurePassword
   - Validation schemas - test valid/invalid data per ogni schema
   - Componenti: DashboardLayout, ExercisesTable, form components

2. **Integration Tests** (Vitest + Supertest)
   - API tests per tutti gli endpoint (CRUD users, exercises, programs, feedback)
   - Setup: database test + seed data

3. **E2E Tests** (Playwright)
   - User flows: Admin crea utenti, Trainer crea programma completo, Trainee completa workout
   - A11y tests con @axe-core/playwright

Setup test: vitest.config.ts già esistente, playwright.config.ts già esistente
```

---

## 📊 MONITORING (Opzionale - Sprint 4+)

```
Implementa monitoring:

1. **Sentry Integration** (src/lib/sentry.ts)
   - Error tracking
   - Performance monitoring
   - User context (userId, role)
   - Breadcrumbs
   Env: NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT

2. **Lighthouse CI**
   - Performance score ≥ 90
   - A11y automated scan
   - GitHub Actions workflow

Librerie: @sentry/nextjs
```

---

## 🎨 STYLING & UX ENHANCEMENTS

```
Migliora UX:

1. **Animazioni** (Framer Motion)
   - Transizioni smooth tra pagine
   - Drag & drop per riordino esercizi (workout detail)
   - Modal enter/exit animations

2. **Dark Mode** (Optional)
   - Tailwind dark: classe
   - Toggle in profilo utente
   - Persistenza localStorage

3. **Swipe Gestures** (Trainee workout)
   - Swipe left → esercizio successivo
   - Swipe right → esercizio precedente
   Libreria: react-swipeable

4. **Touch-friendly UI**
   - Bottoni min 44x44px
   - Inputs grandi con keyboard numerico (inputMode="numeric")
   - No hover states (use :active)

Styling: Tailwind CSS + framer-motion
```

---

## ✅ DEFINIZIONE DI DONE

Una feature è completa quando:
1. ✅ Codice implementato e funzionante
2. ✅ TypeScript senza errori (strict mode)
3. ✅ UI responsive (desktop + mobile appropriato per ruolo)
4. ✅ RBAC correttamente implementato (requireAuth + requireRole)
5. ✅ Error handling gestito (try/catch, toast errors)
6. ✅ Loading states presenti (spinner, skeleton)
7. ✅ Validazione input (client con Zod + server con schemas esistenti)
8. ✅ Testato manualmente su Chrome + Safari (iOS per trainee)
9. ⏳ Unit tests scritti (opzionale per MVP)
10. ⏳ Accessibilità base (keyboard navigation, ARIA labels)

---

## 📚 RIFERIMENTI

- **File design:** design/02_frontend_design.md, design/10_user_stories.md
- **Checklist dettagliata:** UI_IMPLEMENTATION_CHECKLIST.md
- **API standards:** src/lib/api-response.ts (apiSuccess, apiError)
- **Auth patterns:** src/lib/auth.ts (requireAuth, requireRole, ownership checks)
- **Validation:** src/schemas/*.ts (Zod schemas esistenti)
- **Database:** prisma/schema.prisma (14 entità)
- **Calculations:** src/lib/calculations.ts (calculateEffectiveWeight con percentage_previous ricorsivo)

---

**Fine prompt - Pronto per essere utilizzato con l'agente AI per implementare le funzionalità!**
