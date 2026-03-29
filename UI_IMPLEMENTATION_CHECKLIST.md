# 🎨 UI/UX Implementation Checklist - ZeroCento Training Platform

**Data creazione:** 29 Marzo 2026  
**Stato attuale:** ~35% implementato (Backend + Auth + UI Components + Route Fix)  
**Obiettivo:** Implementazione completa Frontend e API rimanenti

**✅ Ultimo aggiornamento:** Route conflict risolto (programId→id), 11 componenti UI completati

---

## 📋 INDICE

1. [API Backend Mancanti](#1-api-backend-mancanti)
2. [Componenti Condivisi da Creare](#2-componenti-condivisi-da-creare)
3. [Frontend Admin](#3-frontend-admin)
4. [Frontend Trainer](#4-frontend-trainer)
5. [Frontend Trainee](#5-frontend-trainee)
6. [Funzionalità Trasversali](#6-funzionalità-trasversali)
7. [PWA & Mobile Experience](#7-pwa--mobile-experience)
8. [Testing & Quality](#8-testing--quality)
9. [Priority Matrix](#9-priority-matrix)

---

## 1. API BACKEND MANCANTI

### 1.1 API Exercises (PRIORITÀ ALTA)

**File:** `src/app/api/exercises/route.ts` (parzialmente implementato)

#### Da Completare:
- ✅ GET /api/exercises - Lista con pagination cursor-based (IMPLEMENTATO)
- ✅ POST /api/exercises - Creazione esercizio (IMPLEMENTATO)
- ❌ **GET /api/exercises/[id]/route.ts** - Dettaglio singolo esercizio
- ❌ **PUT /api/exercises/[id]/route.ts** - Modifica esercizio
- ❌ **DELETE /api/exercises/[id]/route.ts** - Eliminazione esercizio (check riferimenti in WorkoutExercise)

**Features richieste:**
- Pagination cursor-based con `nextCursor` (già implementata per GET)
- Filtri per `type` (fundamental/accessory), `movementPatternId`, `muscleGroupId`
- Search full-text su `name` e `description`
- Validazione conflitti: non eliminare esercizi usati in programmi attivi
- Restituire `exerciseMuscleGroups` con coefficienti nell'ordine corretto

**Validation Schema:** Già esistente in `src/schemas/exercise.ts`

---

### 1.2 API Training Programs (PRIORITÀ ALTA)

**Directory:** `src/app/api/programs/` (DA CREARE)

#### Endpoint da implementare:

##### Lista e creazione
- ❌ **GET /api/programs/route.ts** - Lista programmi
  - **Query params:**
    - `trainerId` (opzionale per admin, auto per trainer)
    - `traineeId` (filtra per trainee)
    - `status` (draft, active, completed)
    - `search` (nome programma)
    - `cursor` (pagination)
  - **RBAC:**
    - Admin: vede tutti
    - Trainer: solo propri
    - Trainee: solo propri programmi assegnati
  
- ❌ **POST /api/programs/route.ts** - Creazione programma (status=draft)
  - **Body:**
    ```json
    {
      "name": "Programma Forza Base",
      "durationWeeks": 8,
      "workoutsPerWeek": 3,
      "traineeId": "uuid",
      "notes": "...",
      "weeks": [
        {
          "weekNumber": 1,
          "weekType": "normal",
          "workouts": [
            {
              "dayNumber": 1,
              "name": "Giorno 1 - Push",
              "notes": "Focus petto e spalle"
            }
          ]
        }
      ]
    }
    ```
  - **Business logic:**
    - Auto-create Weeks (1...durationWeeks)
    - Auto-create Workouts per ciascuna Week
    - Validare trainee ownership (trainer)
    - Status iniziale = `draft`

##### Dettaglio singolo programma
- ❌ **GET /api/programs/[id]/route.ts** - Dettaglio programma completo
  - Include: weeks → workouts → workoutExercises → exercise
  - RBAC: trainer owner, admin, trainee assegnato

- ❌ **PUT /api/programs/[id]/route.ts** - Modifica programma
  - **Immutabilità:** solo se `status=draft` (trainer) o override admin
  - Possibilità di modificare nome, notes, durata (ricalcola weeks)

- ❌ **DELETE /api/programs/[id]/route.ts** - Eliminazione programma
  - Solo se `status=draft`
  - Admin può eliminare anche `active`/`completed` (con warning)

##### Pubblicazione
- ❌ **POST /api/programs/[id]/publish/route.ts** - Pubblica programma
  - **Body:**
    ```json
    {
      "startDate": "2026-04-01"
    }
    ```
  - **Business logic:**
    - Status: `draft` → `active`
    - Calcola `startDate` + `endDate` basato su durationWeeks
    - Assegna date a ogni Week (week1Start = startDate, week2Start = +7 giorni, etc.)
    - Validazione: ogni Workout deve avere almeno 1 WorkoutExercise

##### Progress & Reports
- ❌ **GET /api/programs/[id]/progress/route.ts** - Avanzamento programma
  - **Response:**
    ```json
    {
      "currentWeek": 3,
      "totalWeeks": 8,
      "completedWorkouts": 9,
      "totalWorkouts": 24,
      "feedbackCount": 87,
      "avgRPE": 7.8,
      "totalVolume": 15420.5
    }
    ```
  - Include lista workout con indicazione se completati (hanno feedback)

- ❌ **GET /api/programs/[id]/reports/route.ts** - Reportistica aggregata
  - Report SBD: volume totale per squat/bench/deadlift
  - Training sets totali per muscolo
  - Distribuzione RPE
  - Confronto peso prescritto vs eseguito

**Validation Schema:** Già esistente in `src/schemas/program.ts`

---

### 1.3 API Workout Exercises (PRIORITÀ ALTA) ✅ COMPLETATO

**Directory:** `src/app/api/programs/[id]/workouts/[workoutId]/exercises/` ✅ IMPLEMENTATO

**Nota:** Route conflict risolto - migrato da `[programId]` a `[id]` per coerenza naming

#### Endpoint implementati:

- ✅ **POST /api/programs/[id]/workouts/[workoutId]/exercises/route.ts** ✅ COMPLETATO
  - Aggiungi esercizio a workout
  - **Body:**
    ```json
    {
      "exerciseId": "uuid",
      "orderIndex": 1,
      "sets": 4,
      "reps": "8/10",
      "notes": "Pausa 2s in basso",
      "targetRPE": 7.5,
      "weightType": "percentage_1rm",
      "weightValue": 75.0,
      "restSeconds": 180,
      "isWarmup": false
    }
    ```
  - **Business logic:**
    - Validare program ownership
    - Solo se program.status = draft (o admin override)
    - Auto-increment orderIndex se non specificato

- ✅ **PUT /api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route.ts** ✅ COMPLETATO
  - Modifica WorkoutExercise
  - Validazioni ownership + status implementate

- ✅ **DELETE /api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route.ts** ✅ COMPLETATO
  - Rimuovi esercizio da workout
  - Ricalcola automatico orderIndex implementato

- ✅ **PATCH /api/programs/[id]/workouts/[workoutId]/exercises/reorder/route.ts** ✅ COMPLETATO
  - Riordina esercizi tramite array di {id, orderIndex}
  - **Body:**
    ```json
    {
      "exercises": [
        { "id": "uuid1", "orderIndex": 1 },
        { "id": "uuid2", "orderIndex": 2 }
      ]
    }
    ```

**Validation Schema:** Già esistente in `src/schemas/workout-exercise.ts`

---

### 1.4 API Feedback (PRIORITÀ ALTA)

**Directory:** `src/app/api/feedback/` (DA CREARE)

#### Endpoint da implementare:

- ❌ **POST /api/feedback/route.ts** - Creazione feedback trainee
  - **Body:**
    ```json
    {
      "workoutExerciseId": "uuid",
      "notes": "Ottimo allenamento, sentito bene i muscoli",
      "setsPerformed": [
        { "setNumber": 1, "reps": 8, "weight": 100.0, "rpe": 7.0 },
        { "setNumber": 2, "reps": 8, "weight": 100.0, "rpe": 7.5 },
        { "setNumber": 3, "reps": 7, "weight": 100.0, "rpe": 8.0 },
        { "setNumber": 4, "reps": 6, "weight": 100.0, "rpe": 8.5 }
      ]
    }
    ```
  - **Business logic:**
    - Nested create: `ExerciseFeedback` + multiple `SetPerformed`
    - Validare trainee ownership del workout
    - Calcolare totalVolume: sum(reps * weight)
    - Calcolare avgRPE: average di tutte le serie
    - **Idempotency**: se esiste già feedback per workoutExerciseId, aggiorna invece di creare duplicato

- ❌ **GET /api/feedback/route.ts** - Lista feedback
  - **Query params:**
    - `traineeId` (per trainer/admin)
    - `programId` (filtra per programma)
    - `exerciseId` (storico per esercizio)
  - RBAC: trainer vede solo propri trainee, trainee vede solo propri

- ❌ **GET /api/feedback/[id]/route.ts** - Dettaglio singolo feedback
  - Include `setsPerformed` + workout + exercise info

- ❌ **PUT /api/feedback/[id]/route.ts** - Modifica feedback
  - Trainee può modificare propri feedback entro 24h dalla creazione
  - Ricalcola totalVolume e avgRPE

**Validation Schema:** Già esistente in `src/schemas/feedback.ts`

---

### 1.5 API Personal Records (PRIORITÀ MEDIA)

**Directory:** `src/app/api/personal-records/` (DA CREARE)

#### Endpoint da implementare:

- ❌ **GET /api/personal-records/route.ts** - Lista massimali trainee
  - **Query params:**
    - `traineeId` (required per trainer/admin)
    - `exerciseId` (filtra per esercizio)
  - RBAC: trainer vede solo propri trainee, trainee vede solo propri

- ❌ **POST /api/personal-records/route.ts** - Crea/aggiorna massimale
  - **Body:**
    ```json
    {
      "traineeId": "uuid",
      "exerciseId": "uuid",
      "oneRM": 140.5,
      "threeRM": 130.0,
      "fiveRM": 125.0,
      "tenRM": 110.0,
      "recordedAt": "2026-03-29"
    }
    ```
  - **Upsert logic:** se esiste record per traineeId+exerciseId, aggiorna

- ❌ **DELETE /api/personal-records/[id]/route.ts** - Elimina massimale
  - Solo trainer owner o admin

**Validation Schema:** Già esistente in `src/schemas/personal-record.ts`

---

### 1.6 API Admin Override (PRIORITÀ BASSA)

**Directory:** `src/app/api/admin/` (DA CREARE)

#### Endpoint da implementare:

- ❌ **POST /api/admin/trainees/[traineeId]/reassign/route.ts**
  - Riassegna trainee a nuovo trainer
  - **Body:**
    ```json
    {
      "newTrainerId": "uuid",
      "reason": "Handover per cambio trainer"
    }
    ```
  - **Business logic:**
    - Aggiorna `TrainerTrainee.trainerId`
    - Programmi attivi restano visibili (non riassegnare programId)
    - Crea log audit (opzionale, per tracciabilità)

- ❌ **PUT /api/admin/programs/[id]/override/route.ts**
  - Admin modifica programma anche se active/completed
  - Bypass immutabilità status

- ❌ **GET /api/admin/reports/global/route.ts**
  - Report aggregati system-wide
  - Totale utenti per ruolo
  - Totale programmi per status
  - Totale volume allenamento ultimi 30gg

---

### 1.7 API Muscle Groups & Movement Patterns (Completare)

**Stato:** Parzialmente implementati

#### Da aggiungere:

- ✅ GET /api/muscle-groups - IMPLEMENTATO
- ✅ POST /api/muscle-groups - IMPLEMENTATO
- ✅ GET /api/muscle-groups/[id] - IMPLEMENTATO
- ✅ PUT /api/muscle-groups/[id] - IMPLEMENTATO
- ❌ **DELETE /api/muscle-groups/[id]** - DA IMPLEMENTARE
  - Validare che non sia usato in esercizi

- ✅ GET /api/movement-patterns - IMPLEMENTATO
- ✅ POST /api/movement-patterns - IMPLEMENTATO
- ✅ GET /api/movement-patterns/[id] - IMPLEMENTATO
- ✅ PUT /api/movement-patterns/[id] - IMPLEMENTATO
- ❌ **DELETE /api/movement-patterns/[id]** - DA IMPLEMENTARE
- ✅ PATCH /api/movement-patterns/[id]/archive - IMPLEMENTATO

---

## 2. COMPONENTI CONDIVISI DA CREARE ✅ COMPLETATO

**Directory:** `src/components/` ✅ 11 componenti implementati + showcase page

**Brand Colors Zero Cento:**
- Primary: #FFA700 (orange)
- Secondary: #000000 (black)
- Test Week: #ef4444 (red)
- Deload Week: #10b981 (green)

### 2.1 Form Controls Specializzati ✅ COMPLETATI

#### WeightTypeSelector ✅ IMPLEMENTATO
**File:** `src/components/WeightTypeSelector.tsx`

**Descrizione:**  
Dropdown per selezionare tipo peso + input valore

**Props:**
```typescript
interface WeightTypeSelectorProps {
  weightType: 'absolute_kg' | 'percentage_1rm' | 'percentage_previous'
  weightValue: number
  onChange: (type: string, value: number) => void
  showPreviousReference?: boolean // Se weightType=percentage_previous, mostra riga riferimento
  previousExerciseOrder?: number  // Per display "Rispetto all'esercizio #X"
}
```

**UI:**
- Select `weightType` (3 opzioni)
- Input number `weightValue`
- Se `percentage_previous`: mostrare badge "Rispetto all'esercizio #X (-5%)"

---

#### RPESelector ✅ IMPLEMENTATO
**File:** `src/components/RPESelector.tsx`

**Descrizione:**  
Dropdown con RPE da 5.0 a 10.0 (step 0.5) con color gradient (verde→giallo→arancione→rosso)

**Props:**
```typescript
interface RPESelectorProps {
  value: number  // 5.0 - 10.0
  onChange: (rpe: number) => void
  disabled?: boolean
}
```

**UI:**
- Range slider visual con label RPE sopra thumb
- Colori progressivi: verde (5-7) → giallo (7.5-8.5) → rosso (9-10)
- Descrizione testuale sotto (es. "7.5 = 2-3 reps in riserva")

---

#### RestTimeSelector ✅ IMPLEMENTATO
**File:** `src/components/RestTimeSelector.tsx`

**Descrizione:**  
Button group per tempo recupero (30s, 1m, 2m, 3m, 5m) con brand primary highlight

**Props:**
```typescript
interface RestTimeSelectorProps {
  value: number  // secondi (30, 60, 120, 180, 300)
  onChange: (seconds: number) => void
}
```

**Options:**
- 30s, 1m, 2m, 3m, 5m

---

#### RepsInput ✅ IMPLEMENTATO
**File:** `src/components/RepsInput.tsx`

**Descrizione:**  
Input validato per ripetizioni (8, 8-10, 6/8) con error handling

**Props:**
```typescript
interface RepsInputProps {
  value: string  // "8" o "6/8"
  onChange: (reps: string) => void
  placeholder?: string
}
```

**Validation:**
- Accetta solo numeri o formato "N/M"
- Mostra errore se formato invalido

---

### 2.2 Display Components ✅ COMPLETATI

#### ExerciseCard ✅ IMPLEMENTATO
**File:** `src/components/ExerciseCard.tsx`

**Descrizione:**  
Card con type badge, movement pattern tags, muscle groups, actions menu

**Props:**
```typescript
interface ExerciseCardProps {
  exercise: Exercise
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  showActions?: boolean
  compact?: boolean
}
```

**UI:**
- Thumbnail video YouTube (preview)
- Nome esercizio (bold)
- Tipo (badge: Fondamentale/Accessorio)
- Movimento pattern (tag colorato)
- Gruppi muscolari (tag con coefficienti)
- Actions (Modifica, Elimina) se `showActions=true`

---

#### MovementPatternTag ✅ IMPLEMENTATO
**File:** `src/components/MovementPatternTag.tsx`

**Descrizione:**  
Badge con custom color (hex), dynamic transparency, trainer-configurable

**Props:**
```typescript
interface MovementPatternTagProps {
  pattern: MovementPattern
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}
```

**UI:**
- Badge con colore personalizzato pattern
- Label pattern name
- Opzionale emoji/icona rappresentativa

---

#### YoutubeEmbed ✅ IMPLEMENTATO
**File:** `src/components/YoutubeEmbed.tsx`

**Descrizione:**  
Lazy-loading embed con thumbnail preview, play button overlay, autoplay customizable

**Props:**
```typescript
interface YoutubeEmbedProps {
  url: string
  title?: string
}
```

**UI:**
- Aspect ratio 16:9
- Error handling per URL invalidi

---

#### WeekTypeBanner ✅ IMPLEMENTATO
**File:** `src/components/WeekTypeBanner.tsx`

**Descrizione:**  
Banner visivo per settimana test/deload

**Props:**
```typescript
interface WeekTypeBannerProps {
  weekType: 'normal' | 'test' | 'deload'
  weekNumber: number
}
```

**UI:**
- `normal`: nessun banner
- `test`: banner arancione "SETTIMANA TEST #3 - Verifica massimali"
- `deload`: banner blu "SETTIMANA SCARICO #5 - Recupero attivo"

---

### 2.3 Layout Components 🟡 PARZIALE

#### RoleGuard ❌ DA IMPLEMENTARE
**File:** `src/components/RoleGuard.tsx`

**Descrizione:**  
HOC per proteggere componenti per ruolo

**Props:**
```typescript
interface RoleGuardProps {
  allowedRoles: Role[]
  children: React.ReactNode
  fallback?: React.ReactNode
}
```

**Logic:**
- Controlla ruolo utente da session
- Se non autorizzato, mostra `fallback` o redirect

---

#### LoadingSpinner ✅ IMPLEMENTATO
**File:** `src/components/LoadingSpinner.tsx`

**Descrizione:**  
Spinner con 4 size variants, 3 color variants, plus FullPageLoader e InlineLoader

**Features implementate:**
- ✅ 4 sizes (sm/md/lg/xl)
- ✅ 3 colors (primary/secondary/white)
- ✅ FullPageLoader (centered overlay)
- ✅ InlineLoader (flex-centered)

---

#### ErrorFallback ❌ DA IMPLEMENTARE
**File:** `src/components/ErrorFallback.tsx`

**Descrizione:**  
Error boundary fallback UI

**Props:**
```typescript
interface ErrorFallbackProps {
  error: Error
  resetError?: () => void
}
```

**UI:**
- Messaggio errore user-friendly
- Bottone "Riprova"
- Log automatico a Sentry (integrazione futura)

---

### 2.4 Feedback Components ✅ COMPLETATO

#### FeedbackForm ✅ IMPLEMENTATO
**File:** `src/components/FeedbackForm.tsx`

**Descrizione:**  
Form trainee completo con sets table, RPE selector, notes, volume calculation live

**Props:**
```typescript
interface FeedbackFormProps {
  workoutExercise: WorkoutExercise
  onSubmit: (feedback: FeedbackInput) => void
  existingFeedback?: ExerciseFeedback
  autoSave?: boolean  // localStorage draft save
}
```

**UI:**
- Lista serie (dinamica: aggiungi/rimuovi)
- Per ogni serie: reps, peso, RPE
- Note generali (textarea)
- Calcolo volume totale live
- Auto-save locale ogni 30s (se autoSave=true)

---

## 3. FRONTEND ADMIN

**Stato attuale:** Solo dashboard placeholder (20%)

### 3.1 Admin Dashboard
**File:** `src/app/admin/dashboard/page.tsx`

**Stato:** ✅ Struttura base implementata

**Da completare:**
- ❌ Cards con statistiche aggregate:
  - Totale utenti per ruolo (ADMIN: N, TRAINER: N, TRAINEE: N)
  - Totale programmi per status (DRAFT: N, ACTIVE: N, COMPLETED: N)
  - Volume allenamento ultimi 7/30 giorni
- ❌ Collegamenti funzionanti ai moduli
- ❌ Quick actions: "Crea utente", "Vedi report"

---

### 3.2 Gestione Utenti
**File:** `src/app/admin/users/page.tsx`

**Stato:** ✅ Implementato con tabella e modali CRUD

**Componenti esistenti:**
- ✅ `UsersTable` - Tabella utenti con filtri
- ✅ `UserCreateModal` - Modale creazione utente
- ✅ `UserEditModal` - Modale modifica utente
- ✅ `UserDeleteModal` - Modale conferma eliminazione

**Da migliorare:**
- ❌ Filtri avanzati: per ruolo, status, trainerId (per trainee)
- ❌ Ricerca full-text (nome, cognome, email)
- ❌ Pagination (attualmente carica tutti)
- ❌ Bulk actions: attiva/disattiva multipli trainee
- ❌ Export CSV utenti

---

### 3.3 Gestione Libreria Esercizi (Admin)
**File:** `src/app/admin/exercises/page.tsx`

**Stato:** ✅ Implementato parzialmente

**Componenti esistenti:**
- ✅ `ExercisesTable` - Tabella esercizi con filtri
- ✅ `ExerciseCreateModal` - Modale creazione esercizio

**Da completare:**
- ❌ Modale modifica esercizio
- ❌ Modale eliminazione con check riferimenti
- ❌ Filtro per muscle group
- ❌ Filtro per movement pattern
- ❌ Preview video YouTube in tabella (thumbnail)
- ❌ Badge creator (mostra quale trainer ha creato l'esercizio)

---

### 3.4 Gestione Programmi Globale (Admin)
**File:** `src/app/admin/programs/page.tsx` (DA CREARE)

**Descrizione:**  
Vista admin su TUTTI i programmi di TUTTI i trainer

**Features:**
- ❌ Tabella programmi con colonne:
  - Nome programma
  - Trainer (nome + cognome)
  - Trainee (nome + cognome)
  - Status (badge draft/active/completed)
  - Durata (settimane)
  - Data inizio/fine
  - Progress (% workout completati)
  - Actions (Visualizza, Modifica, Elimina)
- ❌ Filtri:
  - Trainer (dropdown tutti i trainer)
  - Trainee (dropdown tutti i trainee)
  - Status (multi-select)
  - Search (nome programma)
- ❌ Pagination cursor-based

---

### 3.5 Dettaglio Programma Admin Override
**File:** `src/app/admin/programs/[id]/page.tsx` (DA CREARE)

**Descrizione:**  
Admin può modificare qualsiasi programma, anche attivo/completato

**Features:**
- ❌ Header con info programma
- ❌ Lista weeks con lista workout
- ❌ Lista WorkoutExercises per workout
- ❌ Pulsante "Modifica" (bypass immutabilità)
- ❌ Pulsante "Elimina programma" (con conferma)
- ❌ Badge warning se programma active: "Attenzione: programma in corso, modifiche impattano trainee"

---

### 3.6 Riassegnazione Trainee
**File:** `src/app/admin/trainees/[id]/reassign/page.tsx` (DA CREARE)

**Descrizione:**  
Form per riassegnare trainee a nuovo trainer

**UI:**
- ❌ Info trainee corrente
- ❌ Trainer attuale (nome + email)
- ❌ Select nuovo trainer (lista tutti i trainer)
- ❌ Campo "Motivazione" (textarea required)
- ❌ Avvertimento: "I programmi attivi resteranno assegnati al trainer precedente"
- ❌ Bottone "Conferma riassegnazione"
- ❌ Storico riassegnazioni (audit log) - opzionale

---

### 3.7 Report Globali Admin
**File:** `src/app/admin/reports/page.tsx` (DA CREARE)

**Descrizione:**  
Dashboard reportistica system-wide

**Features:**
- ❌ Card totali utenti per ruolo
- ❌ Card programmi per status
- ❌ Grafico volume allenamento ultimi 30gg (line chart)
- ❌ Top 5 trainer per volume totale trainee
- ❌ Top 5 esercizi più utilizzati
- ❌ Distribuzione RPE media per trainer
- ❌ Export report PDF/CSV

---

## 4. FRONTEND TRAINER

**Stato attuale:** Solo dashboard placeholder (0%)

### 4.1 Trainer Dashboard
**File:** `src/app/trainer/dashboard/page.tsx`

**Stato:** 🟡 Struttura base presente, da completare funzionalità

**Da implementare:**
- ❌ Card "I Miei Atleti":
  - Numero totale trainee assegnati
  - Numero trainee attivi vs disabilitati
  - Link cliccabile → `/trainer/trainees`
- ❌ Card "Programmi":
  - Totale draft, active, completed
  - Link → `/trainer/programs`
- ❌ Card "Libreria Esercizi":
  - Totale esercizi in libreria
  - Link → `/trainer/exercises`
- ❌ Quick actions:
  - "Crea nuovo programma"
  - "Aggiungi trainee"
  - "Crea esercizio"
- ❌ Feed recenti:
  - Ultimi feedback trainee (3-5 più recenti)
  - Ultimi programmi pubblicati

---

### 4.2 Gestione Libreria Esercizi (Trainer)
**File:** `src/app/trainer/exercises/page.tsx` (DA CREARE)

**Descrizione:**  
Stessa vista di admin, ma solo trainer può creare/modificare

**Features:**
- ❌ Tabella esercizi con colonne:
  - Thumbnail video
  - Nome esercizio
  - Tipo (badge Fondamentale/Accessorio)
  - Movement Pattern (tag colorato)
  - Gruppi muscolari (lista badge con coeff.)
  - Creato da (solo info, non editabile)
  - Actions (Modifica, Elimina)
- ❌ Bottone "Crea nuovo esercizio" → `/trainer/exercises/new`
- ❌ Filtri: tipo, movement pattern, muscle group, search
- ❌ Pagination cursor-based

---

### 4.3 Creazione/Modifica Esercizio
**File:** `src/app/trainer/exercises/new/page.tsx` (DA CREARE)
**File:** `src/app/trainer/exercises/[id]/edit/page.tsx` (DA CREARE)

**Form campi:**
- ❌ Nome esercizio (input text required)
- ❌ Descrizione (textarea opzionale)
- ❌ URL video YouTube (input url con validazione)
  - Preview embed sotto campo
- ❌ Tipo (radio: Fondamentale SBD / Accessorio)
- ❌ Movement Pattern (select dropdown)
- ❌ Gruppi muscolari (multi-select con coefficienti):
  - Aggiungi muscle group → seleziona → slider coefficiente (0.1-1.0)
  - Lista dinamica muscle groups con rimozione
  - Somma coefficienti deve essere ≤ 1.0 (validazione)
- ❌ Note/Varianti (textarea)
- ❌ Bottoni: Salva, Annulla

---

### 4.4 Gestione Atleti (Trainee)
**File:** `src/app/trainer/trainees/page.tsx` (DA CREARE)

**Descrizione:**  
Lista trainee assegnati al trainer

**Features:**
- ❌ Tabella trainee:
  - Nome completo
  - Email
  - Status (badge Attivo/Disabilitato)
  - Programmi attivi (count)
  - Ultimo programma pubblicato (data)
  - Actions (Visualizza, Modifica, Attiva/Disattiva)
- ❌ Bottone "Aggiungi nuovo trainee" → `/trainer/trainees/new`
- ❌ Ricerca (nome, email)

---

### 4.5 Creazione Trainee
**File:** `src/app/trainer/trainees/new/page.tsx` (DA CREARE)

**Form campi:**
- ❌ Nome (input text required)
- ❌ Cognome (input text required)
- ❌ Email (input email required, unique check)
- ❌ Note trainer (textarea opzionale)
- ❌ Checkbox "Genera password automatica" (default checked)
  - Se unchecked, mostra campo password manuale
- ❌ Bottone "Crea trainee"
- ❌ Success feedback: "Trainee creato! Password: XXXXXXXX (salva questa password)"

---

### 4.6 Profilo Trainee
**File:** `src/app/trainer/trainees/[id]/page.tsx` (DA CREARE)

**Sezioni:**
- ❌ **Header trainee:**
  - Nome completo
  - Email
  - Status (badge con toggle Attiva/Disattiva)
  - Bottone "Modifica dati"
  - Bottone "Gestisci massimali" → `/trainer/trainees/[id]/records`
- ❌ **Tab Programmi:**
  - Lista programmi assegnati (attivi, draft, completati)
  - Per ogni programma:
    - Nome
    - Status
    - Date
    - Progress bar (% workout completati)
    - Bottone "Visualizza" / "Modifica" (se draft)
- ❌ **Tab Feedback:**
  - Ultimi 10 feedback trainee
  - Filtri per programma/esercizio
  - Visualizzazione quick: data, esercizio, volume, RPE media

---

### 4.7 Gestione Massimali Trainee
**File:** `src/app/trainer/trainees/[id]/records/page.tsx` (DA CREARE)

**Descrizione:**  
CRUD completo massimali per trainee

**Features:**
- ❌ Tabella massimali:
  - Esercizio (nome)
  - 1RM, 3RM, 5RM, 10RM (editable inline o modale)
  - Data registrazione
  - Actions (Modifica, Elimina)
- ❌ Bottone "Aggiungi massimale" → Modale:
  - Select esercizio
  - Input 1RM, 3RM, 5RM, 10RM (opzionali)
  - Date picker (default oggi)
  - Salva
- ❌ Storico modifiche massimali (opzionale)

---

### 4.8 Lista Programmi Trainer
**File:** `src/app/trainer/programs/page.tsx` (DA CREARE)

**Descrizione:**  
Vista programmi creati dal trainer

**Features:**
- ❌ Tabs: Draft, Active, Completed
- ❌ Per ogni tab, tabella programmi:
  - Nome programma
  - Trainee assegnato
  - Durata (settimane)
  - Data inizio/fine (se published)
  - Progress (% completato)
  - Actions (Visualizza, Modifica, Elimina, Pubblica)
- ❌ Bottone "Crea nuovo programma" → `/trainer/programs/new`
- ❌ Ricerca (nome programma, trainee)
- ❌ Filtro trainee (dropdown)

---

### 4.9 Wizard Creazione Programma - Step 1: Setup
**File:** `src/app/trainer/programs/new/page.tsx` (DA CREARE)

**Descrizione:**  
Configurazione base programma

**Form campi:**
- ❌ Nome programma (input text required)
- ❌ Trainee assegnato (select dropdown, required)
- ❌ Durata settimane (input number, min=1, max=52, required)
  - Sugg: 4, 6, 8, 12 settimane (quick buttons)
- ❌ Allenamenti per settimana (input number, min=1, max=7, required)
  - Sugg: 3, 4, 5 (quick buttons)
- ❌ Note programma (textarea opzionale)
- ❌ Bottone "Avanti: Configura settimane" → salva draft + naviga a Step 2

**Business logic:**
- POST /api/programs → crea program + weeks + workouts vuoti
- Auto-generate week structure

---

### 4.10 Wizard Creazione Programma - Step 2: Week Overview
**File:** `src/app/trainer/programs/[id]/week-overview/page.tsx` (DA CREARE)

**Descrizione:**  
Vista alto livello settimana tipo con colori movement pattern

**UI:**
- ❌ **Header:**
  - Progress wizard (Step 2/4)
  - Nome programma
  - Trainee assegnato
- ❌ **Selector settimana:**
  - Dropdown "Settimana #" (1...durationWeeks)
  - Badge tipo settimana (normal, test, deload) con toggle
- ❌ **Grid workout:**
  - Colonne: Giorno 1, Giorno 2, ..., Giorno N
  - Per ogni workout:
    - Nome workout (editabile inline)
    - Lista esercizi (solo nome + badge colore MovementPattern)
    - Bottone "+ Aggiungi esercizio" → modale quick add
- ❌ **Modale quick add esercizio:**
  - Select esercizio (search autocomplete)
  - Bottone "Aggiungi"
  - Ordine automatico (appende in fondo lista)
- ❌ **Navigazione:**
  - Bottone "Indietro" → Step 1
  - Bottone "Avanti" → Step 3 (dettaglio primo workout)
  - Bottone "Vai al dettaglio workout" (per ogni workout) → Step 3

**Business logic:**
- Vista read-only degli esercizi (solo nomi + colori)
- Per dettaglio (serie/reps/RPE/peso) → Step 3

---

### 4.11 Wizard Creazione Programma - Step 3: Workout Detail
**File:** `src/app/trainer/programs/[id]/workouts/[workoutId]/edit/page.tsx` (DA CREARE)

**Descrizione:**  
Compilazione dettaglio singolo allenamento

**UI:**
- ❌ **Header:**
  - Progress wizard (Step 3/4)
  - Nome programma
  - Settimana # - Workout # (es. "Settimana 1 - Giorno 1")
  - Bottone "Torna a week overview"
- ❌ **Tabella esercizi workout:**
  - Colonne: Ordine, Esercizio, Serie, Reps, Note, RPE, Peso, Recupero, Azioni
  - **Per ogni WorkoutExercise:**
    - Drag handle per riordinare (drag & drop)
    - Nome esercizio (link a dettaglio ex.)
    - Input serie (number)
    - Input reps (testo: "8" o "6/8")
    - Select note (menu a tendina preimpostate + "Altro")
    - RPE selector (slider 5.0-10.0)
    - Weight selector (tipo + valore):
      - Select: Assoluto kg, % 1RM, % Precedente
      - Input number valore
      - Se % Precedente: mostra riferimento "Rispetto a #X"
    - Select recupero (30s, 1m, 2m, 3m, 5m)
    - Checkbox "Riscaldamento"
    - Bottone "Elimina esercizio" (icona cestino)
- ❌ **Bottoni:**
  - "+ Aggiungi esercizio" → modale simile a Step 2
  - "Salva workout"
  - "Workout successivo" → naviga a prossimo workout
  - "Vai a pubblicazione" (se ultimo workout) → Step 4

**Business logic:**
- Validazione: almeno 1 esercizio per workout
- POST/PUT /api/programs/[id]/workouts/[wId]/exercises
- Calcolo automatico preview peso effettivo (se % 1RM o % previous)

---

### 4.12 Wizard Creazione Programma - Step 4: Publish
**File:** `src/app/trainer/programs/[id]/publish/page.tsx` (DA CREARE)

**Descrizione:**  
Pubblicazione programma con scelta data inizio

**UI:**
- ❌ **Riepilogo programma:**
  - Nome programma
  - Trainee
  - Durata (settimane)
  - Totale workout
  - Totale esercizi
  - Lista settimane con workouts (collapsible)
- ❌ **Validazione pre-publish:**
  - ✅ Ogni workout ha almeno 1 esercizio
  - ✅ Tutti gli esercizi compilati (serie/reps/RPE/peso)
  - ❌ Mostra errori se validazione fallisce
- ❌ **Form pubblicazione:**
  - Label "Data inizio Week 1"
  - Date picker (default: lunedì prossimo)
  - Calcolo automatico date settimane (mostra preview)
- ❌ **Bottoni:**
  - "Pubblica programma" → POST /api/programs/[id]/publish
  - "Torna a modifiche" → Step 2/3
- ❌ **Success modal:**
  - "Programma pubblicato con successo!"
  - "Il trainee [Nome] può ora visualizzarlo nell'app"
  - Bottone "Vai al programma" → dettaglio programma
  - Bottone "Torna alla lista" → /trainer/programs

**Business logic:**
- Status draft → active
- Assegnazione date weeks/workouts
- Notify trainee (opzionale: email/push notification)

---

### 4.13 Monitoraggio Avanzamento Programma
**File:** `src/app/trainer/programs/[id]/progress/page.tsx` (DA CREARE)

**Descrizione:**  
Dashboard monitoraggio progressi trainee su programma

**Sezioni:**
- ❌ **Header programma:**
  - Nome programma
  - Trainee
  - Status (badge)
  - Date inizio/fine
- ❌ **KPI cards:**
  - Settimana corrente (X / totale)
  - Workout completati (X / totale)
  - Feedback totali
  - Volume totale (kg)
  - RPE medio
- ❌ **Progress bar visuale:**
  - Settimane con indicator completamento
  - Colori: grigio (non iniziata), giallo (in corso), verde (completata)
- ❌ **Tabella workout:**
  - Settimana, Giorno, Nome workout, Data prevista, Completato (sì/no), Feedback count, Volume, RPE media, Azioni (Visualizza feedback)
- ❌ **Grafici:**
  - Line chart: Volume per settimana
  - Line chart: RPE medio per settimana
  - Bar chart: Distribuzione esercizi per muscle group

---

### 4.14 Reportistica SBD Programma
**File:** `src/app/trainer/programs/[id]/reports/page.tsx` (DA CREARE)

**Descrizione:**  
Report specializzati per analisi tecnica

**Sezioni:**
- ❌ **Report SBD (Squat, Bench, Deadlift):**
  - Per ogni big 3:
    - Volume totale (kg)
    - Training sets totali (esclude warmup)
    - Intensità media (% 1RM)
    - RPE medio
    - Confronto settimana per settimana (chart)
- ❌ **Report Training Sets per muscolo:**
  - Tabella: Muscle Group, Training Sets totali, % distribuzione
  - Chart: Pie chart distribuzione
- ❌ **Report Volume per schema motorio:**
  - Tabella: Movement Pattern, Volume (kg), % distribuzione
  - Chart: Bar chart comparativo

---

### 4.15 Personalizzazione Colori Movement Pattern
**File:** `src/app/trainer/settings/movement-colors/page.tsx` (DA CREARE)

**Descrizione:**  
Pagina per personalizzare colori schemi motori (saved in MovementPatternColor table)

**UI:**
- ❌ Lista movement patterns
- ❌ Per ognuno: color picker (selettore colore)
- ❌ Preview live: grid settimana mock con colori aggiornati
- ❌ Bottone "Salva personalizzazione"
- ❌ Bottone "Reset a default"

---

## 5. FRONTEND TRAINEE

**Stato attuale:** Solo dashboard placeholder (0%)  
**Note**: Mobile-first design, touch-friendly, PWA

### 5.1 Trainee Dashboard
**File:** `src/app/trainee/dashboard/page.tsx`

**Stato:** 🟡 Struttura base presente, da completare funzionalità

**Da implementare:**
- ❌ **Hero card "Programma Attivo":**
  - Se nessun programma attivo: "Nessun programma assegnato"
  - Se programma attivo:
    - Nome programma
    - Settimana corrente (X / totale)
    - Progress bar visuale
    - Bottone "Vedi allenamenti" → `/trainee/programs/current`
- ❌ **Card "Prossimo allenamento":**
  - Nome workout
  - Data prevista
  - Numero esercizi
  - Bottone "Inizia allenamento" → workout detail
  - Se già completato: badge "Completato ✅"
- ❌ **Card "Massimali":**
  - Link → `/trainee/records`
  - Mostra top 3 massimali recenti (SBD)
- ❌ **Card "Storico":**
  - Link → `/trainee/history`
  - Ultimi 3 programmi completati

---

### 5.2 Programma Attivo Trainee
**File:** `src/app/trainee/programs/current/page.tsx` (DA CREARE)

**Descrizione:**  
Vista completa programma attivo con navigazione per settimana

**UI:**
- ❌ **Header programma:**
  - Nome programma
  - Trainer (nome)
  - Date programma
  - Progress bar generale
- ❌ **Accordion settimane:**
  - Per ogni settimana:
    - Header: "Settimana X" + tipo (normal/test/deload banner)
    - Lista workout:
      - Nome workout
      - Data prevista
      - Badge status: "Da fare" / "In corso" / "Completato ✅"
      - Bottone "Vedi dettaglio" / "Inizia" → workout detail page
- ❌ **Navigazione:**
  - Scroll automatico a settimana corrente
  - Settimane passate: collassate di default
  - Settimana corrente: espansa di default

---

### 5.3 Dettaglio Workout Trainee
**File:** `src/app/trainee/programs/[programId]/workouts/[workoutId]/page.tsx` (DA CREARE)

**Descrizione:**  
Pagina workout con form feedback per ogni esercizio

**UI (mobile-first):**
- ❌ **Header sticky:**
  - Nome workout
  - Data prevista
  - Timer sessione (opzionale, parte quando trainee inizia)
  - Bottone "Salva e chiudi"
- ❌ **Lista esercizi (card verticali):**
  - Per ogni WorkoutExercise:
    - **Card esercizio:**
      - Nome esercizio (bold)
      - Badge movimento pattern (colore)
      - Prescrizione: "4 x 8 @ RPE 7.5 | 100kg | Recupero 2m"
      - Note trainer (se presenti)
      - Bottone "Vedi video" → modale YouTube embed
    - **Form feedback (collapsible, espandibile sotto card):**
      - Checkbox "Segna come completato"
      - Se checked, mostra:
        - Textarea "Note" (opzionale)
        - **Lista dinamica serie eseguite:**
          - Per ogni serie: input reps, input peso (kg), slider RPE
          - Bottone "+ Aggiungi serie" / "- Rimuovi serie"
          - Default: pre-popolato con numero serie prescritto
        - Calcolo live: Volume totale, RPE media
    - **Separatore visivo tra esercizi**
- ❌ **Sticky footer:**
  - Bottone "Salva progressi" (auto-save su localStorage ogni 30s)
  - Badge: "X / Y esercizi completati"
  - Bottone "Completa allenamento" (enabled solo se tutti esercizi checked)

**Business logic:**
- Auto-save locale ogni 30s (draft in localStorage)
- Submit finale: POST /api/feedback (batch per tutti gli esercizi)
- Idempotency: se workout già completato, carica feedback esistenti (modalità edit)
- Al complete: redirect a dashboard con success toast

---

### 5.4 Storico Programmi Trainee
**File:** `src/app/trainee/history/page.tsx` (DA CREARE)

**Descrizione:**  
Lista programmi completati

**UI:**
- ❌ Lista programmi (card):
  - Nome programma
  - Trainer
  - Date inizio-fine
  - Durata settimane
  - Badge "Completato"
  - Statistiche quick: volume totale, workout completati
  - Bottone "Visualizza" → dettaglio read-only programma

---

### 5.5 Massimali Trainee (View Only)
**File:** `src/app/trainee/records/page.tsx` (DA CREARE)

**Descrizione:**  
Visualizzazione massimali personali (read-only per trainee)

**UI:**
- ❌ Tabella massimali:
  - Esercizio (nome)
  - 1RM, 3RM, 5RM, 10RM
  - Data ultima modifica
  - Per trainee: read-only (no edit/delete)
- ❌ Filtri: esercizio, tipo (fundamental/accessory)
- ❌ Nota: "I massimali vengono aggiornati dal tuo trainer"

---

### 5.6 Storico Massimali per Esercizio
**File:** `src/app/trainee/records/[exerciseId]/page.tsx` (DA CREARE)

**Descrizione:**  
Storico evoluzione massimale per un singolo esercizio

**UI:**
- ❌ Header: Nome esercizio + ultima modifica
- ❌ Chart line: evoluzione 1RM nel tempo
- ❌ Tabella storico records:
  - Data
  - 1RM, 3RM, 5RM, 10RM
  - Variazione % rispetto record precedente

---

## 6. FUNZIONALITÀ TRASVERSALI

### 6.1 Autenticazione Completa

#### Forgot Password
**File:** `src/app/forgot-password/page.tsx` (DA CREARE)

**UI:**
- ❌ Input email
- ❌ Bottone "Invia link reset"
- ❌ Success message: "Controlla la tua email"
- ❌ Link "Torna al login"

**Backend:**
- ❌ Supabase `auth.resetPasswordForEmail()`

---

#### Reset Password
**File:** `src/app/reset-password/page.tsx` (DA CREARE)

**UI:**
- ❌ Riceve token da URL query param
- ❌ Input nuova password
- ❌ Input conferma password
- ❌ Validazione strength password
- ❌ Bottone "Reimposta password"
- ❌ Success → redirect a login

**Backend:**
- ❌ Supabase `auth.updateUser({ password })`

---

#### Change Password (Profilo)
**File:** `src/app/profile/change-password/page.tsx` (DA CREARE)

**UI:**
- ❌ Input password corrente
- ❌ Input nuova password
- ❌ Input conferma password
- ❌ Validazione
- ❌ Bottone "Cambia password"

---

### 6.2 Notifiche & Feedback Utente

#### Toast Notifications ✅ IMPLEMENTATO
**File:** `src/components/ToastNotification.tsx` ✅ COMPLETATO

**Features implementate:**
- ✅ Provider pattern con ToastProvider
- ✅ useToast hook personalizzato
- ✅ 4 types: success (verde), error (rosso), warning (giallo), info (blu)
- ✅ Auto-dismiss configurabile
- ✅ Close button su ogni toast
- ✅ Queue management con max 5 toast simultanei

---

#### Confirmation Modals
**File:** `src/components/ConfirmationModal.tsx` (DA CREARE)

**Props:**
```typescript
interface ConfirmationModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean  // Red confirm button
  onConfirm: () => void
  onCancel: () => void
}
```

---

### 6.3 Gestione Errori Globale

#### Error Boundary
**File:** Estendere `src/app/error.tsx`

**Features:**
- ❌ Cattura errori React
- ❌ Log automatico a Sentry (quando integrato)
- ❌ UI fallback user-friendly
- ❌ Bottone "Riprova" / "Torna alla home"

---

#### API Error Handling
**File:** `src/lib/api-client.ts` (DA CREARE)

**Descrizione:**  
Wrapper fetch con gestione errori standardizzata

**Features:**
- ❌ Intercettore errori HTTP
- ❌ Auto-refresh token Supabase se 401
- ❌ Retry logic per errori network (opzionale)
- ❌ Mapping error codes → messaggi user-friendly

---

### 6.4 Internazionalizzazione (i18n)

**Stato:** ✅ Configurazione esistente, ⏳ Implementazione react-hook

#### Hook useTranslation
**File:** `src/hooks/useTranslation.ts` (DA CREARE)

**Usage:**
```typescript
const { t, locale, setLocale } = useTranslation()
const greeting = t('common.welcome')
```

**Features:**
- ❌ Carica traduzioni da /public/locales
- ❌ Context provider per locale
- ❌ Persistenza locale storage
- ❌ Locale switcher component (bandierine IT/EN)

---

### 6.5 Logging & Monitoring

#### Sentry Integration
**File:** `src/lib/sentry.ts` (DA CREARE)

**Features:**
- ❌ Init Sentry client & server
- ❌ Error tracking
- ❌ Performance monitoring (opzionale)
- ❌ User context (userId, role)
- ❌ Breadcrumbs per debugging

**Env vars:**
```env
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_ORG=...
SENTRY_PROJECT=...
```

---

## 7. PWA & MOBILE EXPERIENCE

### 7.1 Service Worker
**File:** `src/app/sw.ts` (DA CREARE con @serwist/next)

**Features:**
- ❌ Offline fallback page
- ❌ Cache strategia:
  - Network-first per API
  - Cache-first per assets statici (immagini, CSS)
- ❌ Background sync per feedback (se offline, salva e invia quando torna online)
- ❌ Push notifications (opzionale, per notify nuovi programmi)

---

### 7.2 PWA Install Prompt
**File:** `src/components/PWAInstallPrompt.tsx` (DA CREARE)

**Descrizione:**  
Banner per invitare trainee a installare PWA

**UI:**
- ❌ Banner bottom sticky (mobile only)
- ❌ "Installa ZeroCento sul tuo telefono per accesso rapido"
- ❌ Bottone "Installa"
- ❌ Bottone "Non ora" (dismissable, ricorda in localStorage)

**Logic:**
- ❌ Detect `beforeinstallprompt` event
- ❌ Mostra solo su mobile
- ❌ Mostra solo per trainee
- ❌ Dismissable con ricordo 7 giorni

---

### 7.3 Offline Storage (LocalStorage/IndexedDB)

#### LocalStorage Draft Save (Trainee Workout)
**File:** `src/lib/workout-draft.ts` (DA CREARE)

**Features:**
- ❌ Auto-save feedback workout ogni 30s
- ❌ Key: `workout-draft-${workoutId}`
- ❌ Al submit: clear draft
- ❌ Al load pagina: recupera draft se esistente (mostra toast "Recuperato bozza")

---

### 7.4 Mobile Gestures

#### Swipe Navigation (Trainee Workout)
**Features:**
- ❌ Swipe left → esercizio successivo
- ❌ Swipe right → esercizio precedente
- ❌ Visual feedback durante swipe

**Libreria suggerita:** `react-swipeable` o `framer-motion`

---

### 7.5 Touch-Friendly UI

#### Design Principles (Trainee pages):
- ❌ Bottoni min 44x44px (Apple Human Interface Guidelines)
- ❌ Spacing generoso tra elementi cliccabili
- ❌ No hover states (use :active invece)
- ❌ Inputs grandi con label visibili
- ❌ Keyboard numerico per input peso/reps (inputMode="numeric")

---

## 8. TESTING & QUALITY

### 8.1 Unit Tests (Vitest)

**Target coverage:** 80%

#### Tests da scrivere:

##### Utilities
- ❌ `src/lib/calculations.ts`:
  - `calculateEffectiveWeight()` - test casi: kg, % 1RM, % previous (ricorsivo)
  - `calculateVolume()` - test reps solo numero, reps range
  - `estimateOneRM()` - test formula Epley
  - `parseReps()` - test parsing "8", "6/8", invalidi
- ❌ `src/lib/password-utils.ts`:
  - `generateSecurePassword()` - test lunghezza, charset
- ❌ `src/lib/api-response.ts`:
  - `apiSuccess()`, `apiError()` - test format response

##### Schemas Zod
- ❌ Test validazione per ogni schema in `src/schemas/`:
  - Valid data → pass
  - Invalid data → fail con errori corretti

##### Components
- ❌ `DashboardLayout` - test rendering header, user info, logout
- ❌ `ExercisesTable` - test rendering, filtri, pagination
- ❌ `UsersTable` - test rendering, modali CRUD
- ❌ Form components (RPESelector, WeightTypeSelector, etc.)

---

### 8.2 Integration Tests (Vitest + Supertest)

#### API Tests:
- ❌ `/api/users` - CRUD completo con RBAC
- ❌ `/api/exercises` - CRUD + pagination
- ❌ `/api/programs` - CRUD + publish flow
- ❌ `/api/feedback` - POST con nested setsPerformed

**Setup:**
- Database test separato (Supabase test instance o Docker PostgreSQL)
- Seed data test

---

### 8.3 E2E Tests (Playwright)

#### User Flows da testare:

##### Admin:
- ❌ Login admin → dashboard → crea trainer → crea trainee → assegna trainee a trainer
- ❌ Admin visualizza tutti programmi → filtra per trainer → visualizza dettaglio

##### Trainer:
- ❌ Login trainer → dashboard → crea esercizio → crea trainee → crea programma (wizard completo) → pubblica
- ❌ Trainer monitora progress trainee → visualizza feedback

##### Trainee:
- ❌ Login trainee → dashboard → vedi programma attivo → completa workout (feedback) → salva
- ❌ Trainee visualizza massimali → visualizza storico

---

### 8.4 Accessibility Tests

#### Tools:
- ❌ `@axe-core/playwright` - automated a11y scan
- ❌ Lighthouse CI - performance + a11y score

#### Checklist:
- ❌ Tutti gli elementi form hanno label associate
- ❌ Focus visible per keyboard navigation
- ❌ ARIA attributes appropriati
- ❌ Color contrast ratio ≥ 4.5:1 (WCAG AA)
- ❌ Landmark regions (header, nav, main, footer)

---

### 8.5 Performance

#### Metrics Target:
- ❌ Lighthouse Performance Score ≥ 90
- ❌ First Contentful Paint (FCP) < 1.5s
- ❌ Largest Contentful Paint (LCP) < 2.5s
- ❌ Time to Interactive (TTI) < 3.5s

#### Optimizations:
- ❌ Image optimization (next/image)
- ❌ Code splitting per route
- ❌ API response caching (SWR o React Query)
- ❌ Database query optimization (indexes already in schema)
- ❌ Lazy loading components (React.lazy)

---

## 9. PRIORITY MATRIX

### 🔴 CRITICAL (Sprint 1 - 2 settimane)

**Backend API:**
1. ✅ API Users CRUD (DONE)
2. ✅ API Exercises CRUD completo + detail/edit/delete (DONE)
3. ✅ API Programs: GET list, POST create, GET/[id], PUT/[id] (DONE)
4. ✅ API Workout Exercises: POST/PUT/DELETE (DONE - route conflict risolto)
5. ✅ API Publish program: POST /programs/[id]/publish (DONE)
6. ❌ API Feedback: POST feedback con nested sets

**Frontend Trainer:**
7. ❌ Trainer Dashboard funzionante
8. ❌ Gestione Esercizi: lista + crea + modifica + elimina
9. ❌ Gestione Trainee: lista + crea
10. ❌ Wizard creazione programma: Step 1 (setup) + Step 2 (week overview) + Step 3 (workout detail) + Step 4 (publish)

**Frontend Trainee:**
11. ❌ Trainee Dashboard
12. ❌ Vista programma attivo
13. ❌ Dettaglio workout + feedback form con auto-save

**Componenti:**
14. ✅ WeightTypeSelector (DONE)
15. ✅ RPESelector (DONE)
16. ✅ RestTimeSelector (DONE)
17. ✅ RepsInput (DONE)
18. ✅ FeedbackForm (DONE)
19. ✅ LoadingSpinner (DONE)
20. ✅ ToastNotification (DONE)
21. ✅ ExerciseCard (DONE)
22. ✅ MovementPatternTag (DONE)
23. ✅ YoutubeEmbed (DONE)
24. ✅ WeekTypeBanner (DONE)
25. ✅ Barrel export index.ts (DONE)
26. ✅ Components Showcase page /components-showcase (DONE)

---

### 🟠 HIGH (Sprint 2 - 1 settimana)

**Backend API:**
21. ❌ API Progress: GET program progress
22. ❌ API Personal Records: CRUD massimali
23. ❌ API Feedback: GET list + GET detail

**Frontend Trainer:**
24. ❌ Monitoraggio avanzamento programma
25. ❌ Gestione massimali trainee
26. ❌ Profilo trainee detail

**Frontend Trainee:**
27. ❌ Storico programmi
28. ❌ Visualizzazione massimali

**Componenti:**
29. ✅ ExerciseCard (DONE - spostato a CRITICAL)
30. ✅ MovementPatternTag (DONE - spostato a CRITICAL)
31. ✅ YoutubeEmbed (DONE - spostato a CRITICAL)
32. ✅ WeekTypeBanner (DONE - spostato a CRITICAL)

---

### 🟡 MEDIUM (Sprint 3 - 1 settimana)

**Backend API:**
33. ❌ API Reports: GET program reports (SBD, volume, etc.)
34. ❌ API Admin: riassegnazione trainee
35. ❌ API Admin: override programmi

**Frontend Admin:**
36. ❌ Admin Dashboard con statistiche reali
37. ❌ Gestione programmi globale (lista + filtri)
38. ❌ Dettaglio programma admin override
39. ❌ Riassegnazione trainee
40. ❌ Report globali

**Frontend Trainer:**
41. ❌ Reportistica programma (SBD, volume)
42. ❌ Personalizzazione colori movement pattern

**Funzionalità:**
43. ❌ Forgot password flow
44. ❌ Reset password flow
45. ❌ Change password (profilo)

---

### 🟢 LOW (Sprint 4+ - Nice to have)

**PWA:**
46. ❌ Service Worker con offline support
47. ❌ PWA install prompt
48. ❌ Background sync feedback

**Testing:**
49. ❌ Unit tests (target 80% coverage)
50. ❌ E2E tests principali user flows
51. ❌ Accessibility tests

**Monitoring:**
52. ❌ Sentry integration
53. ❌ Lighthouse CI

**UX Enhancements:**
54. ❌ Swipe gestures trainee workout
55. ❌ Animazioni transizioni (framer-motion)
56. ❌ Dark mode (opzionale)

**Admin:**
57. ❌ Audit log riassegnazioni
58. ❌ Export CSV utenti
59. ❌ Bulk operations (attiva/disattiva multipli trainee)

---

## 📝 NOTE IMPLEMENTATIVE

### Convenzioni Codice:
- **Lingua codice:** English (variabili, funzioni, commenti)
- **Lingua UI:** Italiano (default) con i18n EN
- **API format:** Standard `{ data: {...}, meta?: {...} }` per success, `{ error: {...} }` per errori
- **File naming:** kebab-case per file, PascalCase per componenti React
- **Type safety:** Strict TypeScript, no `any`

### Database:
- **Provider:** Supabase PostgreSQL (eu-central-1 Frankfurt per GDPR)
- **Migrations:** Prisma migrate
- **Connection:** Pooled (port 6543) per API routes, Direct (5432) per Prisma CLI

### State Management:
- **Client state:** React useState/useReducer
- **Server state:** SWR o TanStack Query (da decidere)
- **Form state:** React Hook Form + Zod

### Styling:
- **Framework:** Tailwind CSS
- **Componenti UI:** Headless UI o Radix UI per accessibilità
- **Icons:** Lucide React o Heroicons

### Performance:
- **Images:** next/image con lazy loading
- **Code splitting:** Dynamic imports per routes pesanti
- **API caching:** SWR con revalidation strategica

---

## 🎯 DEFINIZIONE DI "DONE"

Una feature è considerata completa quando:
1. ✅ Codice implementato e funzionante
2. ✅ TypeScript senza errori
3. ✅ UI responsive (desktop + mobile)
4. ✅ RBAC correttamente implementato
5. ✅ Error handling gestito
6. ✅ Loading states presenti
7. ✅ Validazione input (client + server)
8. ⏳ Unit tests scritti (opzionale per MVP)
9. ⏳ Testato manualmente su Chrome + Safari (iOS)
10. ⏳ Accessibilità base verificata (keyboard navigation, screen reader friendly)

---

**Fine documento - Versione 1.0 - 29 Marzo 2026**
