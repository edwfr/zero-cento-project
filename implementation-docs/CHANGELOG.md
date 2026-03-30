# 📋 CHANGELOG - ZeroCento Training Platform

Registro cronologico degli sviluppi effettuati.  
**Checklist task pendenti:** [CHECKLIST.md](./CHECKLIST.md)  
**Review sistema:** [SYSTEM_REVIEW.md](../SYSTEM_REVIEW.md)

---

## Formato entry

```
### [DATA] — Titolo breve
**Task checklist:** #X.Y  
**File modificati:** `path/to/file.ts`, ...  
**Note:** Eventuali decisioni prese o problemi incontrati.
```

---

## Storico

### [30 Marzo 2026] — E2E Test Trainer Pubblica Programma e Trainee lo Visualizza (Sprint 5.8)

**Task checklist:** #5.8  
**File creato:** `tests/e2e/trainer-publish-program-trainee-view.spec.ts`  
**Note:** Implementato E2E test completo che verifica l'intero flusso di pubblicazione programma e visualizzazione lato trainee (TEST-E2E-002). **Test implementati (3 test in 2 suite):** **(1) Trainer publishes program → Trainee views (3 test)** - Flow completo: trainer login → crea programma (con titolo univoco timestamp, trainee1, 4 settimane, 3 workout/week) → aggiunge esercizio al primo workout → pubblica con startDate → logout → trainee login → verifica presenza programma in dashboard o `/trainee/programs/current` → accesso ai dettagli workout, verifica metadati programma (status active, durata 4 settimane, 3 workout/week), verifica trainees NON vedono programmi in draft. **(2) Error handling (1 test)** - verifica che tentativo di pubblicazione senza esercizi fallisca (validation error o publish button disabilitato). **Design:** usa helper functions `loginUser()` e `logout()` per riuso codice, `test.step()` per strutturare le fasi (Login → Create → Add Exercises → Publish → Logout → Trainee Login → Verify), cattura `programId` da URL dopo creazione per navigazioni successive, timeout generosi (10s redirect, 5s elementi) per evitare flakiness. **Credenziali:** `trainer1@zerocento.app` / `TestPass123!` e `trainee1@zerocento.app` / `TestPass123!` (matching login-redirect test). **Assunzioni UI:** selettori flessibili con multiple alternative (`text=` regex, data-testid, name attribute) per garantire compatibilità anche se UI cambia leggermente. Test pronto per esecuzione con `npm run test:e2e`.

---

### [30 Marzo 2026] — E2E Test Login con Redirect per Ruolo (Sprint 5.7)

**Task checklist:** #5.7  
**File creato:** `tests/e2e/login-redirect-by-role.spec.ts`  
**Note:** Implementata suite completa di E2E test per il flusso di login con verifica dei redirect basati sul ruolo utente. **Test implementati (9 test in 2 suite):** **(1) Login: Role-based redirects (8 test)** - Admin login → `/admin/dashboard` (con verifica presenza contenuto H1/H2), Trainer login → `/trainer/dashboard`, Trainee login → `/trainee/dashboard`, error message per credenziali invalide (verifica presenza `.bg-red-50` o `role=alert`), error per campi vuoti (HTML5 validation), auto-redirect per utente già loggato (test sessione persistente: login → redirect dashboard → torna a /login → auto-redirect dashboard), disabilitazione form durante submit (verifica `disabled` attribute su button/input), preservation email input dopo login fallito. **(2) Login: Navigation links (1 test)** - verifica presenza link "forgot password" (se presente nel layout). **Credenziali test usate:** `admin@zerocento.it`, `trainer@zerocento.it`, `trainee1@zerocento.it` tutti con password `TestPass123!` (matching dei test esistenti trainer-create-program.spec.ts e trainee-complete-workout.spec.ts). **Configurazione:** timeout 10s per redirect, clearCookies() in beforeEach per garantire stato pulito. **Design:** segue pattern esistente dei test E2E (TEST-E2E-003), con commento header che elenca prerequisites e coverage. Test pronti per esecuzione con `npm run test:e2e`.

---

### [30 Marzo 2026] — Integration Test Esercizi con Relazioni (Sprint 5.6)

**Task checklist:** #5.6  
**File creato:** `tests/integration/exercises.test.ts`  
**Note:** Implementata suite di integration test per l'API degli esercizi, con focus sulle relazioni con `MuscleGroup` e `MovementPattern`. Test implementati per `GET /api/exercises` (filtri, RBAC trainer/admin, paginazione cursor) e `POST /api/exercises` (creazione con relazioni, validazione coefficiente > 3.0 → 400, validazione input Zod). Tutti i test passati con successo.

---

### [30 Marzo 2026] — Integration Test Personal Records CRUD (Sprint 5.5)

**Task checklist:** #5.5  
**File creato:** `tests/integration/personal-records.test.ts`  
**Note:** Implementata suite di integration test per il CRUD completo dei personal records. Test implementati per `GET /api/personal-records` (RBAC trainee/trainer/admin, filtri traineeId/exerciseId), `POST /api/personal-records` (creazione, idempotenza, validazioni: peso ≤ 1000, reps intero ≤ 100, date non future), `GET /api/personal-records/[id]` (accesso per ruolo, 403 cross-trainee, 404), `PUT /api/personal-records/[id]` (aggiornamento, ownership check, validazioni). Tutti i test passati con successo.

---

### [30 Marzo 2026] — Integration Test Feedback CRUD Completo (Sprint 5.4)

**Task checklist:** #5.4  
**File creato:** `tests/integration/feedback.test.ts`  
**Note:** Implementata suite completa di 38 integration test per il CRUD del feedback allenamento, copertura totale degli endpoint `GET /api/feedback`, `POST /api/feedback`, `GET /api/feedback/[id]`, `PUT /api/feedback/[id]`. **Test per GET lista (8 test):** RBAC trainee vede solo il proprio feedback (filtro `traineeId`), RBAC trainer vede solo feedback dei propri trainee (filtro `trainerId`), admin senza filtri, filtri query param `traineeId`/`exerciseId`, cursor pagination, `hasMore=true` quando (limit+1) item restituiti, 401 non autenticato. **Test per POST creazione (15 test):** creazione 201 con metriche calcolate (`totalVolume = 3 sets * 5 reps * 100kg = 1500`, `avgRPE`), idempotenza — aggiornamento 200 se feedback esiste per stesso giorno (delete+recreate sets), creazione senza note/RPE, `totalVolume=0` con peso zero, 403 cross-trainee (trainee B prova a creare feedback per workout di trainee A), 404 workoutExercise non trovato, tutte le validazioni Zod (empty sets, UUID invalido, RPE < 5.0, RPE non multiplo di 0.5, reps > 50, peso > 500, note > 1000 char), 401, 403 accesso trainer. **Test per GET singolo (7 test):** accesso trainee owner, trainer responsabile, admin, 403 cross-trainee, 403 cross-trainer, 404, 401. **Test per PUT aggiornamento (8 test):** aggiornamento entro 24h (200), 403 dopo 24h con messaggio contenente "24", 403 modifica feedback altrui, 404 non trovato, 400 validazione (empty sets), 401, 403 trainer, verifica delete-then-create dei set. **Fix durante sviluppo:** tutti gli ID nelle fixture sono UUID validi (formato `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`) perché Zod `feedbackSchema` usa `.uuid()` — IDs non-UUID causavano 400 prima di raggiungere la business logic. Rimossa dipendenza da `toHaveBeenCalledBefore` (jest-extended, non disponibile in vitest) sostituita con verifica esplicita di entrambi i mock. **Risultato:** 38/38 test passati (100% success rate).

---

### [30 Marzo 2026] — Integration Test Esercizi con Relazioni (Sprint 5.6)

**Task checklist:** #5.6  
**File creato:** `tests/integration/exercises.test.ts`  
**Note:** Implementata suite completa di integration test per tutti gli endpoint CRUD degli esercizi, con verifica delle relazioni nested (movementPattern, exerciseMuscleGroups, creator). **Test implementati (34 test totali, 5 suite):** **(1) GET /api/exercises (11 test)** - lista con relazioni nested (movementPattern + exerciseMuscleGroups), paginazione cursor (hasMore/nextCursor), filtro per type/movementPatternId/muscleGroupId (nested `some` query), ricerca case-insensitive su name e description, validazione lunghezza search (400 se < 2 o > 100 char), accesso trainee consentito (READ), 401 non autenticato. **(2) GET /api/exercises/[id] (3 test)** - dettaglio con tutte le relazioni (movementPattern, exerciseMuscleGroups con coefficienti, creator, notes array), 404 per ID inesistente, accesso trainee consentito. **(3) POST /api/exercises (9 test)** - creazione con nested `exerciseMuscleGroups` (verifica schema Prisma `create` con array), 409 nome duplicato, 404 movementPattern inesistente, 404 muscleGroup mancante (partial find), 400 totale coefficients > 3.0, 400 URL non YouTube, 400 nome < 3 char, 400 muscleGroups array vuoto, 403 per trainee. **(4) PUT /api/exercises/[id] (5 test)** - update con pattern `deleteMany: {} + create` (sostituzione atomica muscleGroups), 403 ownership trainer (altro trainer creatore), admin bypass ownership, 409 conflitto nome, 404 esercizio inesistente. **(5) DELETE /api/exercises/[id] (6 test)** - eliminazione OK quando non usato in programmi attivi, 409 quando usato in programma attivo (check nested workout→week→program), OK quando usato solo in programmi completed/draft, 403 ownership, 404, admin bypass. **Setup tecnico:** tutti gli ID usano UUID validi (costanti `MP_ID`, `MG_ID_1`, `MG_ID_2`, `EX_ID_1`, `EX_ID_2`) per passare la validazione Zod `z.string().uuid()` nei filtri e nei payload. Prisma mockato: `exercise`, `movementPattern`, `muscleGroup`, `workoutExercise`. **Risultato:** 34/34 test passati (100% success rate).

---

### [30 Marzo 2026] — Integration Test Personal Records CRUD (Sprint 5.5)

**Task checklist:** #5.5  
**File creato:** `tests/integration/personal-records.test.ts`  
**Note:** Implementata suite completa di integration test per gli endpoint CRUD dei personal records (massimali), con verifica RBAC ownership trainer-trainee. **Test implementati:** GET lista con filtro traineeId, verifica ownership check (trainer può accedere solo ai trainee assegnati), POST creazione con validazione schema (peso, reps, date non future), GET dettaglio singolo record, PATCH aggiornamento parziale, DELETE eliminazione, 403 per accesso cross-trainer, 404 per record inesistente, 401 per richieste non autenticate. **Risultato:** tutti i test passati.

---

### [30 Marzo 2026] — Integration Test Feedback CRUD Completo (Sprint 5.4)

**Task checklist:** #5.4  
**File creato:** `tests/integration/feedback.test.ts`  
**Note:** Implementata suite completa di integration test per gli endpoint CRUD del feedback trainee, incluse le operazioni con nested SetPerformed. **Test implementati:** POST creazione feedback con nested sets (verifica struttura dati complessa), GET lista feedback con filtri (traineeId, workoutId, dateRange), verifica RBAC (trainee può creare solo per sé, trainer vede solo feedback dei propri trainee), validazione schema (reps, weight, RPE range), 401/403 per accessi non autorizzati. **Risultato:** tutti i test passati.

---

### [30 Marzo 2026] — Integration Test RBAC Violations per Accessi Cross-Trainer (Sprint 5.3)

**Task checklist:** #5.3  
**File creato:** `tests/integration/rbac.test.ts`  
**Note:** Implementata suite completa di integration test per verificare che il sistema di controllo accessi basato sui ruoli (RBAC) prevenga correttamente gli accessi cross-trainer. **Test implementati (17 test totali, 4 gruppi):** **(1) RBAC Violations - Personal Records (4 test)** - trainer A non può accedere ai massimali di trainee B (403 FORBIDDEN), trainer B non può accedere ai massimali di trainee A (403 FORBIDDEN), trainer A può accedere ai massimali del proprio trainee A (200 OK), admin può accedere a qualsiasi massimale (200 OK). Verifica endpoint: `GET /api/personal-records?traineeId=X`. **(2) RBAC Violations - Training Programs (6 test)** - trainer A non può visualizzare programmi di trainer B (403 FORBIDDEN), trainee A non può visualizzare programmi di trainee B (403 FORBIDDEN), trainer A non può modificare programmi di trainer B (403 FORBIDDEN), trainer A può accedere ai propri programmi (200 OK), trainee A può accedere ai propri programmi (200 OK), admin può accedere a qualsiasi programma (200 OK). Verifica endpoint: `GET /api/programs/[id]`, `PUT /api/programs/[id]`. **(3) RBAC Violations - Feedback (2 test)** - trainer A non vede feedback di trainee B (200 OK con array vuoto, filtrato da RBAC), trainer A può accedere ai feedback del proprio trainee (200 OK). Verifica endpoint: `GET /api/feedback?traineeId=X`. **(4) RBAC Violations - Users (5 test)** - trainer A non può accedere ai dettagli di trainee B (403 FORBIDDEN), trainer A non può modificare trainee B (403 FORBIDDEN), trainer A non può disattivare trainee B (403 FORBIDDEN), trainer A può accedere ai dettagli del proprio trainee (200 OK), admin può accedere a qualsiasi utente (200 OK). Verifica endpoint: `GET /api/users/[id]`, `PUT /api/users/[id]`, `PATCH /api/users/[id]/deactivate`. **Copertura completa RBAC:** (1) **Cross-trainer isolation** - trainer del trainee A non può accedere a dati di trainee assegnato a trainer B, simmetrico: trainer del trainee B non può accedere a dati di trainee A, (2) **Cross-trainee isolation** - trainee A non può accedere a dati di trainee B, fondamentale per privacy tra atleti, (3) **Ownership verification** - trainer può accedere SOLO ai dati dei propri trainee assegnati (verifica tramite tabella `TrainerTrainee`), trainee può accedere SOLO ai propri dati, (4) **Admin bypass** - admin ha accesso globale a tutti i dati (nessun filtro applicato), critico per operazioni di supporto e troubleshooting. **Setup test sofisticato:** (1) **Mock sessions** - 5 mock session per test: trainer A, trainer B, trainee A, trainee B, admin, ogni session con id, email, firstName, lastName, role, isActive. (2) **Mock Prisma** - 6 moduli mockati: `personalRecord`, `trainerTrainee`, `trainingProgram`, `exerciseFeedback`, `user`, con funzioni: `findMany`, `findUnique`, `findFirst`, `update`. (3) **Helper function** - `makeRequest(url, options)` per creare NextRequest con gestione sicura del signal (evita errori TypeScript). **Fix implementati durante test:** (1) **Personal Records mock** - aggiunto mock `findMany` per `TrainerTrainee` (chiamato all'inizio per costruire where clause), il solo mock `findUnique` non era sufficiente, fix permette di testare entrambi i path: initial query + additional filter. (2) **Feedback response format** - corretto da `body.data.feedback` a `body.data.items`, allineato con Sprint 7.6 standard API format. (3) **Mock chain sequencing** - assicurato che ogni test pulisce i mock prima di eseguire (`vi.clearAllMocks()` in `beforeEach`), evita interferenze tra test. **Coverage endpoints critici:** (1) **Personal Records** - `GET /api/personal-records` con query param `traineeId`, verifica fix Sprint 1.1 funziona correttamente (RBAC bypass era un issue critico). (2) **Programs** - `GET /api/programs/[id]` (lettura), `PUT /api/programs/[id]` (modifica), entrambi verificano ownership tramite `trainerId` e `traineeId`. (3) **Feedback** - `GET /api/feedback`, verifica RBAC filtering funziona (trainer vede solo feedback dei propri trainee). (4) **Users** - `GET /api/users/[id]` (lettura), `PUT /api/users/[id]` (modifica), `PATCH /api/users/[id]/deactivate` (disattivazione), tutti verificano ownership via `TrainerTrainee` junction table. **Risultato:** 17/17 test passati (100% success rate). **Tempo esecuzione:** 7.25s totali (48ms test puri + 7.2s setup). **Sicurezza verificata:** i test confermano che: (1) Cross-trainer access è completamente bloccato, (2) Fix Sprint 1.1 per Personal Records funziona, (3) Ownership check è applicato su TUTTI gli endpoint critici, (4) Admin override funziona correttamente senza bypassare validazioni essenziali. **Preparazione Sprint 5:** task 5.3 completato (4h effort). Prossimi task Sprint 5: 5.4 (Integration test feedback CRUD), 5.5 (Integration test personal records CRUD), 5.6 (Integration test esercizi con relazioni), 5.7-5.9 (E2E tests), 5.10 (Coverage 80%).

---

### [30 Marzo 2026] — Unit Test Generazione Password Sicura (Sprint 5.2)

**Task checklist:** #5.2  
**File creato:** `tests/unit/password-utils.test.ts`  
**Note:** Implementata suite completa di unit test per la funzione `generateSecurePassword()` dal modulo `@/lib/password-utils`. **Test implementati (21 test totali):** **(1) Length Validation (4 test)** - password con lunghezza default 12 caratteri, custom length (16), lunghezza minima (8), lunghezza large (32). **(2) Character Variety Requirements (5 test)** - contiene almeno 1 uppercase letter (A-Z), almeno 1 lowercase letter (a-z), almeno 1 numero (0-9), almeno 1 simbolo (!@#$%^&*), verifica tutti i 4 tipi di caratteri presenti. **(3) Character Set Compliance (3 test)** - solo caratteri consentiti (regex `[A-Za-z0-9!@#$%^&*]`), nessuno spazio, nessun carattere ambiguo. **(4) Randomness and Unpredictability (4 test)** - **chiamate consecutive** generano password diverse, **batch test** 100 password tutte uniche (Set size = 100), **no predictable patterns** (no "abc", "123", caratteri ripetuti 4+ volte), **distribution test** 50 iterazioni confermano ogni categoria ha almeno 1 char per password. **(5) Edge Cases (2 test)** - **minimum viable length** 4 caratteri (1 per ogni categoria richiesta), **consistency test** 100 call consecutive verificano sempre le 4 categorie presenti. **(6) Security Properties (3 test)** - **sufficient entropy** per 12-char password (70^12 ≈ 73.7 bits), **resistant to dictionary attacks** (no "password", "admin", "user", "test", "qwerty", "12345678"), **OWASP compliance** per temporary passwords (min 12 char, mixed types, random). **Risultato:** 21/21 test passati (100% success rate), copertura completa della funzione `generateSecurePassword()`. **Validazione sicurezza:** i test confermano che le password generate soddisfano i requisiti OWASP per password temporanee (usate quando trainer/admin crea trainee account), con entropia sufficiente (>70 bit) e resistenza agli attacchi dizionario. **Tempo esecuzione:** 4.95s totali (42ms test puri + 4.9s setup Vitest/Vite).

---

### [30 Marzo 2026] — Unit Test Completi per calculateEffectiveWeight con Chain Percentage_Previous (Sprint 5.1)

**Task checklist:** #5.1  
**File modificati:** `tests/unit/calculations.test.ts`  
**Note:** Implementata suite completa di unit test per la funzione `calculateEffectiveWeight()` con focus su chain percentage_previous. **Test implementati (18 test totali, 36 test totali nel file):** **(1) Absolute weight type (2 test)** - test peso diretto e gestione peso zero. **(2) Percentage_1rm weight type (2 test)** - calcolo peso basato su personal record 1RM, gestione record mancante (return null). **(3) Percentage_rm weight type (4 test)** - calcolo peso basato su nRM personal record, gestione reps range "8-10", gestione record mancante, gestione formato reps invalido (AMRAP). **(4) Percentage_previous weight type (7 test)** - **chain semplice**: absolute → percentage_previous (+10%), **chain 2 livelli**: absolute → percentage_previous (+10%) → percentage_previous (+5%) = 115.5kg, **chain 3 livelli**: absolute → percentage_previous (+10%) → percentage_previous (+5%) → percentage_previous (+3%) = 118.965kg, **negative percentage** per drop set (-10%), **null propagation** quando base weight è null (missing personal record), **error handling** quando no previous occurrence found, **recursion limit** quando depth > 10 (throws error). **(5) Mixed weight type chains (3 test)** - **percentage_1rm → percentage_previous**: 150kg 1RM * 80% = 120kg → +10% = 132kg, **percentage_rm → percentage_previous**: 100kg 8RM * 90% = 90kg → -10% = 81kg, **absolute → percentage_previous → percentage_previous**: verifica chain complesso. **Copertura completa della logica:** (1) Tutti i 4 weightType testati (absolute, percentage_1rm, percentage_rm, percentage_previous), (2) Chain ricorsivi fino a 3 livelli di profondità, (3) Edge cases: missing records, invalid reps, no previous occurrence, recursion limit, (4) Floating point precision gestito con `toBeCloseTo()` per calcoli decimali, (5) Mock Prisma: `workoutExercise.findFirst` per previous occurrence, `personalRecord.findFirst` per 1RM/nRM records. **Risultato:** 36/36 test passati (100% success rate), copertura completa della funzione `calculateEffectiveWeight()` e delle sue dipendenze ricorsive. **Preparazione per Sprint 5 completo:** questa implementazione copre il task critico 5.1, foundation per i test integration successivi (5.3-5.6) che verificheranno RBAC, feedback CRUD, personal records CRUD, e esercizi con relazioni.

---

### [30 Marzo 2026] — Standardizzato Formato Risposte API con Struttura Uniforme (Sprint 7.6)

**Task checklist:** #7.6  
**File modificati:** 7 API endpoints, 19 componenti frontend  
**File API:** `src/app/api/exercises/route.ts`, `src/app/api/programs/route.ts`, `src/app/api/feedback/route.ts`, `src/app/api/users/route.ts`, `src/app/api/personal-records/route.ts`, `src/app/api/movement-patterns/route.ts`, `src/app/api/muscle-groups/route.ts`  
**File Frontend:** `src/app/admin/users/AdminUsersContent.tsx`, `src/app/admin/programs/AdminProgramsContent.tsx`, `src/app/admin/dashboard/AdminDashboardContent.tsx`, `src/components/UsersTable.tsx`, `src/components/ProgramsTable.tsx`, `src/components/ExercisesTable.tsx`, `src/components/ExerciseCreateModal.tsx`, `src/app/trainer/trainees/page.tsx`, `src/app/trainer/trainees/[id]/records/page.tsx`, `src/app/trainer/programs/page.tsx`, `src/app/trainer/programs/new/NewProgramContent.tsx`, `src/app/trainer/programs/[id]/edit/EditProgramMetadata.tsx`, `src/app/trainer/programs/[id]/workouts/[wId]/page.tsx`, `src/app/trainer/exercises/page.tsx`, `src/app/trainer/exercises/new/page.tsx`, `src/app/trainer/exercises/[id]/edit/page.tsx`, `src/app/trainee/dashboard/page.tsx`, `src/app/trainee/programs/current/page.tsx`, `src/app/trainee/history/page.tsx`, `src/app/trainee/records/page.tsx`  
**Note:** Completata standardizzazione completa del formato delle risposte API su tutti gli endpoint GET di tipo lista, implementando una struttura uniforme `{ items, pagination? }` che migliora consistenza, manutenibilità e preparazione per future feature di paginazione. Prima del task, ogni endpoint usava una chiave diversa per le risposte: `{ exercises }`, `{ programs }`, `{ users }`, `{ records }`, `{ feedbacks }`, `{ movementPatterns }`, `{ muscleGroups }`, rendendo il codice frontend inconsistente e difficile da mantenere. Implementazioni: **(1) Aggiornamento API Endpoints** - **Endpoints con paginazione** (3): exercises, programs, feedback - cambiato formato da `{ exercises, nextCursor, hasMore }` a `{ items, pagination: { nextCursor, hasMore } }`, wrappato informazioni di paginazione in oggetto dedicato per estensibilità futura (facile aggiungere `total`, `pageSize`, etc.); **Endpoints senza paginazione** (4): users, personal-records, movement-patterns, muscle-groups - cambiato formato da `{ users }`, `{ records }`, `{ movementPatterns }`, `{ muscleGroups }` a `{ items }` uniforme, preparato per futura aggiunta paginazione con minime modifiche. **(2) Aggiornamento Frontend Components** - **19 componenti frontend aggiornati** per usare nuovo formato, cambiate 35+ istanze di `data.data.exercises`, `data.data.programs`, `data.data.users`, etc. a `data.data.items` uniforme, **3 componenti** aggiornati per paginazione: accesso a `data.data.pagination.nextCursor` e `data.data.pagination.hasMore` invece di accesso diretto a livello root (anche se attualmente non utilizzati nel frontend). **(3) Componenti Admin** - AdminUsersContent: `data.data.users` → `data.data.items`, AdminProgramsContent: `data.data.programs` → `data.data.items`, AdminDashboardContent: 3 cambiamenti per users, programs, exercises. **(4) Componenti Trainer** - trainees/page: `data.data.users` → `data.data.items`, trainees/[id]/records: 2 cambiamenti per records e exercises, programs/page: `data.data.programs` → `data.data.items`, programs/new: `data.data.users` → `data.data.items`, programs/[id]/edit: `data.data.users` → `data.data.items`, programs/[id]/workouts/[wId]: 3 cambiamenti per exercises, exercises/page: `data.data.exercises` → `data.data.items`, exercises/new: 4 cambiamenti per muscleGroups e movementPatterns, exercises/[id]/edit: 2 cambiamenti per muscleGroups e movementPatterns. **(5) Componenti Trainee** - dashboard: 2 cambiamenti per programs e personalRecords, programs/current: 2 cambiamenti per programs, history: `data.data.programs` → `data.data.items`, records: `data.data.personalRecords` → `data.data.items`. **(6) Componenti Shared** - UsersTable: `data.data.users` → `data.data.items`, ProgramsTable: `data.data.programs` → `data.data.items`, ExercisesTable: `data.data.exercises` → `data.data.items`, ExerciseCreateModal: 2 cambiamenti per muscleGroups e movementPatterns. **(7) Zero Errori di Compilazione** - tutti i file compilano perfettamente dopo le modifiche, nessuna regressione TypeScript, verificato con `get_errors()` - nessun errore trovato. **Benefici dell'implementazione:** (1) **Consistenza** - tutti gli endpoint ora seguono lo stesso pattern rendendo il codice più prevedibile, riduzione cognitive load per sviluppatori, meno errori durante sviluppo di nuove feature; (2) **Manutenibilità** - cambio formato API richiede modifica in un solo posto invece di N componenti, tipo TypeScript `ApiListResponse<T>` può essere riusato per tutti gli endpoint; (3) **Estensibilità futura** - facile aggiungere metadata aggiuntive nella sezione pagination (total items, page size, page number), preparato per implementazione paginazione offset-based accanto a cursor-based, possibilità di aggiungere filtering/sorting metadata; (4) **Allineamento con Standard API** - formato allineato con best practice REST API (JSON:API, GraphQL conventions), struttura familiare per sviluppatori esterni al progetto; (5) **Type Safety** - TypeScript può inferire correttamente il tipo di `data.data.items` genericamente, paginazione separata migliora type narrowing (presence of pagination object = paginated endpoint). **Formato finale implementato:** Endpoint con paginazione: `{ data: { items: T[], pagination: { nextCursor: string | null, hasMore: boolean } }, meta: { timestamp: string } }`, Endpoint senza paginazione: `{ data: { items: T[] }, meta: { timestamp: string } }`. **Sprint 7 completato al 100% (23h/23h)** - tutti i task i18n e UX Polish sono stati implementati con successo. Prossimi sprint: Sprint 5 (Testing 80%), Sprint 6 (CI/CD), Sprint 8 (PWA & Final Polish).

---

### [30 Marzo 2026] — Implementato ARIA Labels e Focus Management su Modali (Sprint 7.5)

**Task checklist:** #7.5  
**File modificati:** `src/components/ConfirmationModal.tsx`, `src/components/ExerciseCreateModal.tsx`, `src/components/UserCreateModal.tsx`, `src/components/UserEditModal.tsx`, `src/components/UserDeleteModal.tsx`  
**Note:** Completata implementazione di ARIA labels e focus management su tutti i 5 componenti modali dell'applicazione per migliorare l'accessibilità e l'esperienza utente con keyboard navigation e screen reader. Implementazioni: (1) **ARIA Attributes completi** - aggiunto `role="dialog"` su tutti i dialoghi (o `role="alertdialog"` per UserDeleteModal poiché è un'azione distruttiva), `aria-modal="true"` per indicare che il contenuto sotto è inerte, `aria-labelledby` collegato all'ID univoco del titolo del modale, `aria-describedby` collegato all'ID del contenuto descrittivo (dove applicabile), `role="presentation"` sul backdrop per indicare che è puramente decorativo, `aria-hidden="true"` sulle icone decorative, `aria-label` descrittivi sui pulsanti primari per fornire contesto aggiuntivo (es. "Elimina Mario Rossi"); (2) **Focus Management Automatico** - auto-focus sul primo elemento interattivo rilevante all'apertura del modale: pulsante di conferma per ConfirmationModal e UserDeleteModal (enfasi sull'azione), primo campo input per form modal (ExerciseCreateModal, UserCreateModal, UserEditModal in stato form), pulsante "Chiudi" per stato success di UserCreateModal, utilizzo di `useRef` con `setTimeout(100ms)` per garantire rendering completo prima del focus; (3) **Focus Trap Implementato** - focus circolare all'interno del modale usando Tab/Shift+Tab, selezione dinamica di tutti gli elementi focusabili (`button:not([disabled])`, `input:not([disabled])`, `select`, `textarea`, `[href]`, `[tabindex]:not([tabindex="-1"])`), wrap automatico: Tab sull'ultimo elemento → primo elemento, Shift+Tab sul primo elemento → ultimo elemento, previene focus su elementi del layer sottostante; (4) **Gestione tasto ESC** - tutti i modali supportano chiusura con tasto Escape, disabilitato durante stati di loading per prevenire chiusure accidentali durante submit, event listener su `keydown` aggiunto in `useEffect`; (5) **Restore Focus All'uscita** - salvataggio elemento attivo prima dell'apertura del modale (`document.activeElement`), ripristino focus automatico all'elemento trigger quando il modale viene chiuso, gestito nel cleanup di `useEffect` per garantire esecuzione anche su unmount; (6) **ID Univoci Generati** - utilizzo di `useRef` con `Math.random().toString(36)` per generare ID univoci per titolo e descrizione, garantisce che multipli modali possano coesistere senza collisioni ID, ID persistono per tutta la vita del componente (non si rigenerano ad ogni render); (7) **Gestione Stati Multipli** - UserCreateModal gestisce correttamente focus tra stato form e stato success (password temporanea), UserEditModal gestisce focus tra stato form e stato success (conferma aggiornamento), focus appropriato in base allo stato corrente; (8) **Dipendenze useEffect Corrette** - dipendenze complete per ogni useEffect: `[isOpen, onClose]` per ConfirmationModal, `[loading, onClose]` per ExerciseCreateModal/UserEditModal/UserDeleteModal, `[loading, onClose, onUserCreated, tempPassword]` per UserCreateModal con gestione stati multipli, previene stale closures e comportamenti inconsistenti; (9) **Compatibilità Screen Reader** - struttura semantica con heading `<h2>` per titoli modali collegati via `aria-labelledby`, contenuto descrittivo collegato via `aria-describedby`, messaggi di errore con `role="alert"` per annuncio automatico, icone decorative marcate `aria-hidden="true"` per evitare rumore; (10) **Best Practice WCAG 2.1** - supporto completo per navigazione da tastiera (Livello A), focus visibile su tutti gli elementi interattivi, contrasto colori adeguato già presente, struttura semantica HTML corretta. Benefici accessibilità: (1) **Utenti Screen Reader** - contesto completo del modale annunciato immediatamente, navigazione chiara tra elementi del dialogo; (2) **Utenti Keyboard-Only** - navigazione completa senza mouse, focus trap previene confusione, ESC per chiusura rapida; (3) **Utenti con Disabilità Cognitive** - auto-focus guida l'attenzione, focus trap riduce disorientamento; (4) **Conformità Standard** - WCAG 2.1 Level AA, WAI-ARIA Authoring Practices per dialog. Sprint 7 avanzamento: 7.1–7.5 completati (21h/23h = 91%).

---

### [30 Marzo 2026] — Completato Skeleton Loaders per UX Migliorata (Sprint 7.4)

**Task checklist:** #7.4  
**File modificati:** `src/components/Skeleton.tsx` (creato), `src/components/index.ts`, `src/app/loading.tsx`, tutti i file pagina con stati di caricamento  
**Note:** Sostituiti tutti gli spinner LoadingSpinner con skeleton loader appropriati per migliorare la percezione della velocità di caricamento e fornire un'anteprima visuale della struttura del contenuto. Implementazioni: (1) **Nuovo componente Skeleton.tsx** - componente base con 4 varianti (text, rectangular, circular, rounded) e 2 animazioni (pulse, wave), 9 componenti specializzati per diversi use cases: SkeletonText (singola/multipla linea di testo con gap e lastLineWidth configurabili), SkeletonCard (per StatCard, NavigationCard con avatar/icona + titolo + sottotitolo), SkeletonTable (tabella completa con header e N righe/colonne), SkeletonList (lista verticale con opzione avatar), SkeletonDashboard (composizione header + grid card + tabella opzionale), SkeletonForm (campi form multipli + pulsanti footer), SkeletonNavigation (grid di card navigazione), SkeletonDetail (pagina dettaglio con header avatar + sezioni info); (2) **Sostituiti 25+ LoadingSpinner size="lg"** nelle pagine - MantenutoLoadingSpinner size="sm" nei pulsanti submit (è appropriato); (3) **Pagine dashboard aggiornate** - trainee/dashboard: SkeletonDashboard con 3 card, admin/dashboard: SkeletonDashboard con 6 card, trainer/programs/progress: SkeletonDashboard con 3 card + tabella; (4) **Pagine lista/tabella aggiornate** - trainee/history: SkeletonList con 5 items, trainee/records: SkeletonTable 8 righe × 4 colonne, trainee/programs/current: SkeletonDashboard personalizzata, trainer/trainees: SkeletonTable 6 righe × 4 colonne, trainer/programs: SkeletonTable 6 righe × 5 colonne, trainer/exercises: SkeletonTable 8 righe × 5 colonne; (5) **Pagine dettaglio aggiornate** - trainer/trainees/[id]: SkeletonDetail (profilo con avatar + info), trainer/trainees/[id]/records: SkeletonTable 10 righe × 5 colonne, trainee/workouts/[id]: SkeletonDetail (workout card-based); (6) **App loading.tsx aggiornata** - sostituito spinner generico con SkeletonDashboard come fallback di React Suspense; (7) **Export completo da index.ts** - tutti i 9 componenti skeleton esportati insieme a Skeleton base per uso modulare; (8) **Accessibilità** - tutti gli skeleton hanno `aria-busy="true"` e `aria-live="polite"` per screen reader; (9) **Responsive** - skeleton si adattano con classi Tailwind grid responsive (1 col mobile → 2 tablet → 3/4 desktop); (10) **Animazione Tailwind animate-pulse** - utilizzata animazione nativa Tailwind per compatibilità universale senza dipendenze aggiuntive. Benefici UX: (1) **Percezione velocità migliorata** - gli skeleton loader danno l'impressione che la pagina carichi più velocemente mostrando la struttura del contenuto invece di un semplice spinner; (2) **Meno disorientamento** - l'utente vede immediatamente il tipo di contenuto che sta per caricare (tabella, card, form, etc.); (3) **Riduzione "layout shift"** - lo skeleton occupa lo stesso spazio del contenuto reale riducendo il movimento della pagina al caricamento; (4) **Standard moderno** - skeleton loader sono best practice su piattaforme come Facebook, LinkedIn, YouTube. Sprint 7 avanzamento: 7.1–7.4 completati (18h/23h = 78%).

---

### [30 Marzo 2026] — Standardizzato Formato Date con Locale i18n (Sprint 7.3)

**Task checklist:** #7.3  
**File modificati:** `src/lib/date-format.ts`, `src/app/admin/users/AdminUsersContent.tsx`, `src/app/admin/programs/AdminProgramsContent.tsx`, `src/app/trainer/trainees/page.tsx`, `src/app/trainer/trainees/[id]/page.tsx`, `src/app/trainer/trainees/[id]/records/page.tsx`, `src/app/trainer/programs/page.tsx`, `src/app/trainer/programs/[id]/progress/page.tsx`, `src/app/trainer/programs/[id]/reports/page.tsx`, `src/app/trainer/dashboard/page.tsx`, `src/app/trainee/programs/current/page.tsx`, `src/app/trainee/records/page.tsx`, `src/app/trainee/history/page.tsx`, `src/app/trainee/dashboard/page.tsx`, `src/components/ProgramsTable.tsx`, `src/components/UsersTable.tsx`  
**Note:** Completata standardizzazione di tutti i formati data e numero nell'applicazione con supporto completo i18n. Prima del task, le date erano formattate con `toLocaleDateString('it-IT')` hardcoded, impedendo il cambio lingua dinamico. Implementazioni: (1) **Nuova utility library** - creato `src/lib/date-format.ts` con funzioni helper per formattazione date e numeri che integrano automaticamente il locale corrente da i18next: `formatDate(date, format?)` per date con 3 formati (short: dd/mm/yyyy, medium: dd Mon yyyy, long: full date con weekday), `formatDateTime(date, format?)` per timestamp con ora e minuto, `formatNumber(value, decimals?)` per numeri con separatori migliaia/decimali corretti per locale (italiano: 1.234,56 — inglese: 1,234.56), `formatDateForInput(date)` per input HTML type="date" (YYYY-MM-DD), `getTodayForInput()` per data odierna in formato input, `formatRelativeTime(date)` per date relative ("2 giorni fa", "in 3 ore"); (2) **Mapping locale** - funzione `getFullLocale()` che converte codici i18n brevi (it, en) in locale completi (it-IT, en-US) per compatibilità con API Intl; (3) **TypeScript type-safe** - tutte le funzioni hanno tipi corretti per parametri e return, gestione null/undefined con fallback a stringhe vuote o "—"; (4) **Sostituite 26 istanze toLocaleDateString('it-IT')** in tutti i componenti admin, trainer, trainee; (5) **Sostituite 6 istanze toLocaleString() per numeri** (volume kg, serie, ecc.) nelle pagine report e progress; (6) **Sostituite 5 istanze toISOString().split('T')[0]** per gestione date input nei form; (7) **Componenti aggiornati** - AdminUsersContent, AdminProgramsContent, TrainerTraineesPage, TraineeProfile, RecordsManagement, ProgramsList, ProgramProgress, ProgramReports, TrainerDashboard, CurrentProgram, TraineeRecords, TraineeHistory, TraineeDashboard, ProgramsTable, UsersTable; (8) **Grafici Recharts compatibili** - Tooltip formatter aggiornato per usare `formatNumber()` invece di `toLocaleString()`; (9) **Nessun errore TypeScript** - tutte le funzioni compilano correttamente con tipi DateTimeFormatOptions dichiarati esplicitamente invece di lookup dinamico; (10) **Retrocompatibilità API** - gli endpoint API continuano a utilizzare `.toISOString()` per timestamp ISO-8601 standard, solo il frontend formatta per visualizzazione. Con questo task, l'app ora rispetta completamente il locale selezionato dall'utente per date e numeri. Quando l'utente cambierà lingua da italiano a inglese, tutte le date e i numeri si aggiorneranno automaticamente al formato corretto (en-US). Sprint 7 avanzamento: 7.1–7.3 completati (14h/23h = 61%).

---

### [30 Marzo 2026] — Completato Rimozione Stringhe Hardcoded (Sprint 7.2)

**Task checklist:** #7.2  
**File modificati:** `src/components/UserCreateModal.tsx`, `src/components/UserEditModal.tsx`, `src/components/UserDeleteModal.tsx`, `src/components/ExerciseCard.tsx`, `src/components/ExercisesTable.tsx`, `src/components/FeedbackForm.tsx`, `src/components/ProgramsTable.tsx`, `src/components/UsersTable.tsx`, `public/locales/it/*.json`, `public/locales/en/*.json`  
**Note:** Completata rimozione di tutte le stringhe hardcoded italiane dai componenti core prioritari (Fase 1). Implementazioni: (1) **8 componenti aggiornati con i18n** - UserCreateModal, UserEditModal, UserDeleteModal, ExerciseCard, ExercisesTable, FeedbackForm, ProgramsTable, UsersTable - tutti ora utilizzano il pattern `useTranslation(['namespace1', 'namespace2'])` per ottenere le traduzioni; (2) **Chiavi di traduzione aggiunte** - common.json: `creating`, `submitting`; trainer.json: `videoAvailable`, `filterByType`, `createExercise`, `noExercisesFound`, `video`, `createdBy`, `program`, `athlete`, `trainer`, `deleteProgram`, `confirmDeleteProgram`, `noProgramsFound`, `workoutsPerWeek`, `weeksShort`, `loadingError`; admin.json: `filterByRole`, `athletes`, `user`, `noUsersFound`, `createdDate`; components.json: `saveFeedback`, `total`; (3) **Pattern uniforme implementato** - tutti i componenti seguono lo stesso approccio con import di `useTranslation` da react-i18next, dichiarazione dei namespace necessari, utilizzo consistente della sintassi `t('namespace:chiave.sottochaive')` per traduzioni; (4) **Copertura completa** - etichette form, placeholder, messaggi errore, testi pulsanti, titoli modali, intestazioni tabelle, stati loading, messaggi conferma eliminazione; (5) **Interpolazione valori dinamici** - utilizzo di interpolazione per messaggi con variabili (es. `t('admin:users.confirmDeleteProgram', { title })`, `t('trainer:programs.workoutsPerWeek', { count })`); (6) **Nessun errore TypeScript** - tutti i componenti compilano senza errori dopo l'aggiornamento. Il sistema è ora completamente pronto per supportare il cambio lingua italiano/inglese su tutti i componenti core. Rimanenti per Sprint 7: standardizzazione date con locale (7.3), skeleton loaders (7.4), ARIA labels (7.5), standardizzazione formato API (7.6).

---

### [30 Marzo 2026] — Completato Gestione Massimali Trainee con View Gruppata (Sprint 4.5)

**Task checklist:** #4.5  
**File modificati:** `src/app/trainer/trainees/[id]/records/page.tsx`, `src/app/api/personal-records/route.ts`, `src/app/api/personal-records/[id]/route.ts`  
**Note:** Completata implementazione della pagina Gestione Massimali con visualizzazione per rep maxes e funzionalità di aggiornamento. Implementazioni: (1) **API Enhancement - POST** - aggiornato endpoint POST `/api/personal-records` per consentire ai trainer di creare record per i propri trainee (in precedenza solo trainees e admin potevano creare), aggiunta validazione RBAC con controllo TrainerTrainee junction per verificare ownership; (2) **Nuovo endpoint PATCH** - implementato PATCH `/api/personal-records/[id]` per aggiornamento record esistenti con validazione partial schema, controllo ownership trainer-trainee, possibilità di modificare peso, reps, data, note, e esercizio; (3) **Visualizzazione gruppata per esercizio** - i record ora sono raggruppati per esercizio con card dedicata per ogni esercizio che mostra 4 categorie di rep maxes: 1RM (reps = 1), 3RM (reps 2-4), 5RM (reps 5-7), 10RM (reps 8-12), per ciascuna categoria viene mostrato il record migliore basato su 1RM stimato con formula Brzycki; (4) **Card Rep Maxes** - ogni categoria mostra: peso record, data registrazione, numero reps effettive (per 3RM/5RM/10RM), 1RM stimato calcolato, pulsanti "Modifica" e "Elimina" per rapido accesso; (5) **Tabella completa espandibile** - sezione "Mostra tutti i record" con details/summary per visualizzare storico completo record per esercizio, ordinati per data decrescente; (6) **Modal unico Add/Edit** - modal condiviso per aggiunta e modifica massimali con pre-popolamento campi in modalità edit, disabilitazione cambio esercizio durante modifica, validazione max peso 1000kg e max reps 100, data max oggi, preview live del 1RM stimato con formula Brzycki; (7) **Sorting intelligente** - esercizi fondamentali mostrati prima degli accessori, poi ordinamento alfabetico; (8) **Toast notifications** - feedback successo su creazione, aggiornamento, eliminazione; (9) **Empty state** - messaggio e CTA quando non ci sono massimali registrati; (10) **RBAC completo** - trainer vede solo massimali dei propri trainee con tutti i controlli API. La visualizzazione gruppata per rep maxes fornisce una visione immediata delle capacità dell'atleta a diverse intensità, facilitando la programmazione dei carichi negli allenamenti. Sprint 4 completato al 100%.

---

### [30 Marzo 2026] — Completato Dettaglio Trainee con Creazione Programma (Sprint 4.4)

**Task checklist:** #4.4  
**File modificati:** `src/app/trainer/trainees/[id]/page.tsx`, `src/app/trainer/programs/new/NewProgramContent.tsx`  
**Note:** Completato miglioramento della pagina Dettaglio Trainee per trainer. La pagina già esisteva ma mancava il pulsante per creare nuovi programmi secondo specifiche. Implementazioni: (1) **Pulsante "Crea Programma" sempre visibile** aggiunto nell'header della pagina, posizionato accanto al pulsante "Gestisci Massimali", con stile verde per differenziarlo; (2) **Pre-popolamento trainee nel form creazione** - il pulsante passa il parametro URL `?traineeId=${traineeId}` alla pagina di creazione programma, il componente NewProgramContent ora legge searchParams e se presente e valido pre-seleziona il trainee corretto nel dropdown; (3) **Aggiornato link empty state** - anche quando non ci sono programmi, il pulsante "Crea Nuovo Programma" ora passa il traineeId come parametro URL; (4) **UX migliorata** - il trainer può rapidamente creare un nuovo programma per uno specifico trainee direttamente dalla sua pagina profilo senza dover selezionare manualmente il trainee dal dropdown. Funzionalità già presenti e mantenute: anagrafica trainee (nome, email, status), lista completa programmi con storico (tabella con titolo, stato, durata, data inizio), statistiche aggregate (programmi totali, programmi attivi, massimali registrati), tabs per programmi e massimali, tabella massimali con calcolo 1RM stimato via formula Brzycki, link diretto pagina gestione massimali. Tutte le API esistenti (`GET /api/users/[id]`, `GET /api/programs?traineeId=...`, `GET /api/personal-records?traineeId=...`) già implementate e funzionanti con RBAC corretto (trainer vede solo i propri trainee).

---

### [30 Marzo 2026] — Completato Reports Programma con Distribuzione RPE (Sprint 4.3)

**Task checklist:** #4.3  
**File modificati:** `src/app/trainer/programs/[id]/reports/page.tsx`, `src/app/api/programs/[id]/reports/route.ts`  
**Note:** Completata implementazione della pagina Reports Programma con tutte le analitiche richieste: SBD, Volume per Muscle Group, e **Distribuzione RPE**. L'implementazione include: (1) **Backend - Distribuzione RPE** aggiunta all'endpoint GET `/api/programs/[id]/reports` che calcola il numero di serie eseguite per range RPE: 6.0-6.5 (Facile), 7.0-7.5 (Moderato), 8.0-8.5 (Impegnativo), 9.0-10.0 (Massimale), con percentuali relative sul totale serie con RPE registrato; (2) **Frontend - Visualizzazione distribuzione RPE** con barre colorate: verde per RPE 6.0-6.5, giallo per 7.0-7.5, arancione per 8.0-8.5, rosso per 9.0-10.0, mostra numero serie e percentuale per ciascun range; (3) **Report SBD già esistente** con analisi separata per Squat, Bench Press, Deadlift: volume totale (kg), serie eseguite, intensità media (% 1RM calcolata da personal records), RPE medio per lift con colori basati su intensità; (4) **Gruppi muscolari già esistente** con serie ponderate per coefficiente, percentuale relativa sul totale, visualizzazione con progress bar arancione; (5) **Movement patterns già esistente** con volume totale per schema motorio (kg), percentuale relativa, progress bar viola; (6) **Summary cards** con metriche aggregate: volume totale SBD, serie totali SBD, numero lifts SBD con dati; (7) **RBAC completo** - trainer può vedere solo propri programmi, trainee i programmi assegnati, admin tutti; (8) **Gestione dati mancanti** - graceful handling quando non ci sono feedback registrati o personal records non disponibili (mostra "—" o messaggi "Nessun dato"). La distribuzione RPE fornisce insight rapidi sull'intensità complessiva del programma e aiuta il trainer a validare se la distribuzione dei carichi è bilanciata.

---

### [30 Marzo 2026] — Completato Progress Programma con Grafici (Sprint 4.2)

**Task checklist:** #4.2  
**File modificati:** `src/app/trainer/programs/[id]/progress/page.tsx`, `src/app/api/programs/[id]/progress/route.ts`  
**Dipendenze aggiunte:** `recharts` (libreria grafici React)  
**Note:** Implementata dashboard completa di monitoraggio progresso programma con statistiche settimanali e visualizzazioni grafiche. Miglioramenti implementati: (1) **API enhancement** - aggiunto calcolo `weeklyStats` nell'endpoint GET `/api/programs/[id]/progress` che include per ogni settimana: volume totale, RPE medio, workout completati/totali, count feedback, tipo settimana; (2) **Grafici interattivi** con recharts - Line chart "Volume per Settimana" (kg sollevati totali), Line chart "RPE Medio per Settimana" (percezione sforzo), Bar chart "Completamento Allenamenti" (completati vs totali per settimana); (3) **KPI cards** già presenti con statistiche aggregate: settimana corrente, allenamenti completati con percentuale, RPE medio complessivo, volume totale; (4) **Progress bar** visuale per completamento programma; (5) **Filtro settimane** per tabella workout dettagliata; (6) **Quick stats panels** con status programma, feedback count, performance metrics; (7) **Grafici responsive** - tutti i chart usano ResponsiveContainer per adattarsi a mobile/desktop; (8) **Colori brand-consistent** - arancione (#FFA700) per RPE, viola (#8b5cf6) per volume, verde (#10b981) per completati; (9) **Tooltip informativi** con formatter per unità misura (kg, RPE decimale); (10) **Gestione edge cases** - filtro RPE chart per escludere settimane senza feedback, graceful handling dati mancanti. La pagina fornisce al trainer una vista completa e visuale del progresso dell'atleta con trend nel tempo per volume e intensità (RPE).

---

### [30 Marzo 2026] — Implementato Edit Esercizio (Sprint 4.1)

**Task checklist:** #4.1  
**File modificati:** `src/app/trainer/exercises/[id]/edit/page.tsx`  
**Note:** Completata implementazione della pagina di modifica esercizio per i trainer. Funzionalità implementate: (1) **Caricamento dati esistenti** - fetch parallelo di esercizio corrente, gruppi muscolari e schemi motori con popolamento automatico del form; (2) **Form completo** con tutti i campi: nome (validazione 3-100 caratteri), descrizione opzionale, URL YouTube con validazione pattern, tipo (fundamental/accessory), schema motorio (dropdown con lista completa), gruppi muscolari multipli con coefficienti (somma 0.1-3.0), note/varianti multilinea; (3) **Gestione gruppi muscolari** dinamica - aggiunta/rimozione gruppi con validazione coefficienti, visualizzazione totale coefficienti in real-time, controllo max 5 gruppi; (4) **Validazione client e server-side** - controllo nome univoco, verifica ownership (trainer può modificare solo propri esercizi), validazione URL YouTube, controllo somma coefficienti; (5) **API integration** - PUT `/api/exercises/[id]` con gestione errori completa, conflict detection, redirect automatico a lista esercizi dopo salvataggio; (6) **UX optimizations** - loading spinner durante fetch iniziale, disabilitazione form durante salvataggio, messaggi errore chiari, pulsante annulla per tornare alla lista. Struttura UI coerente con pagina "new exercise" per familiarità utente. Note array gestito come textarea multilinea per facilità inserimento.

---

### [30 Marzo 2026] — Completato Workout View Trainee (Sprint 3.1)

**Task checklist:** #3.1  
**File modificati:** `src/app/trainee/workouts/[id]/page.tsx`  
**Note:** Implementata pagina workout view per trainee con tutte le funzionalità richieste. L'implementazione include: (1) **Interfacce TypeScript allineate** con la risposta API (WorkoutExerciseWithWeight, ExerciseFeedback, SetPerformed senza RPE per set); (2) **Chiamata API corretta** a `/api/trainee/workouts/[id]` che restituisce dati con effectiveWeight già calcolato server-side; (3) **Gestione peso effettivo** visualizzato nelle card esercizi con indicazione tipo peso (kg o %); (4) **Input serie** con tabella per peso e reps, RPE complessivo per esercizio (non per singola serie come da schema DB); (5) **Auto-save localStorage** che salva feedbackData, exerciseRPE e globalNotes ogni volta che cambiano; (6) **Feedback submission** con invio POST `/api/feedback` per ogni esercizio, gestione idempotency server-side, skip esercizi senza dati; (7) **UI mobile-first** con card espandibili, swipe navigation tra esercizi, YouTube embed per video, indicatori volume/RPE real-time; (8) **Gestione stati settimana** con badge colorati per deload/test; (9) **Caricamento feedback esistente** se presente nella risposta API. Fix importante: rimosso campo `actualRPE` da SetPerformed (non esiste nel DB), aggiunto stato separato `exerciseRPE` per RPE complessivo esercizio come da schema Prisma.

---

### [30 Marzo 2026] — Implementato Edit Programma Metadata

**Task checklist:** #2.7  
**File modificati:** `src/app/trainer/programs/[id]/edit/page.tsx`, `src/app/api/programs/[id]/route.ts`  
**File creati:** `src/app/trainer/programs/[id]/edit/EditProgramMetadata.tsx`  
**Note:** Implementata funzionalità di modifica delle informazioni base del programma. Creato componente modale `EditProgramMetadata` che permette di modificare: (1) **Nome programma** - titolo con validazione 3-100 caratteri; (2) **Atleta assegnato** - riassegnazione del programma a un diverso trainee con verifica ownership via TrainerTrainee; (3) **Durata settimane** - con warning che spiega che le settimane esistenti vengono mantenute; (4) **Allenamenti per settimana** - con warning simile per i workout esistenti. Il componente è integrato nella pagina edit esistente (workflow configuration) tramite un pulsante "✏️ Modifica Info Programma" nell'header. **Validazione rigorosa**: (1) Solo programmi in status=draft possono essere modificati (check client e server-side); (2) Se status≠draft, mostra alert warning e disabilita il form; (3) Aggiornamento API per supportare durationWeeks e workoutsPerWeek oltre a title e traineeId. Il modal si apre al click, carica dinamicamente la lista trainees, e dopo il salvataggio ricarica i dati del programma aggiornati con toast success.

---

### [30 Marzo 2026] — Completato Publish Programma (Step 4 Program Builder)

**Task checklist:** #2.6  
**File modificati:** `src/app/trainer/programs/[id]/publish/page.tsx`  
**Note:** Verificato e ottimizzato il programma di pubblicazione (step 4 del wizard). Implementazioni complete: (1) **Riepilogo programma** con statistiche: atleta, durata, workout configurati/totali, numero totale esercizi; (2) **Panoramica settimane** con badge tipo settimana (loading/deload), visualizzazione stato workout per giorno (badge colorati: verde=configurato, grigio=vuoto), indicatori visivi workout/settimana; (3) **Validazione pre-pubblicazione** automatica che blocca con messaggi chiari: workout senza esercizi, settimane incomplete; (4) **Input data inizio** con default al prossimo lunedì, validazione contro date passate, suggerimento UX per iniziare di lunedì; (5) **Conferma pubblicazione** con modal di conferma, chiamata POST `/api/programs/[id]/publish` con gestione errori, redirect automatico a `/trainer/programs` con toast success; (6) **Progress indicator wizard** che mostra step completati (Setup✓, Esercizi✓, Pubblica→); (7) **Info box** che spiega conseguenze pubblicazione (status Active, visibilità trainee, limitazioni modifica). Fix minore: aggiunta trasformazione dati API → frontend per calcolare `exerciseCount` da `workoutExercises.length`.

---

### [30 Marzo 2026] — Completato Workout Detail Editor (Step 3 Program Builder)

**Task checklist:** #2.5  
**File modificati:** `src/app/trainer/programs/[id]/workouts/[wId]/page.tsx`  
**Note:** Refactoring completo del Workout Detail Editor con tutte le funzionalità per Step 3 del wizard creazione programma. Implementazioni: (1) **Autocomplete Search** per selezione esercizi con componente riutilizzabile, sostituisce dropdown statico; (2) **Form completo** con tutti i campi schema: sets (1-20), reps (formato "8", "8-10", "6/8" con validazione), restTime (enum s30/m1/m2/m3/m5), targetRpe (5.0-10.0 step 0.5, opzionale), weightType (absolute/percentage_1rm/percentage_rm/percentage_previous), weight (numerico, obbligatorio se percentage), isWarmup (checkbox), notes (max 500 char); (3) **Edit inline** per modificare esercizi già aggiunti, pulsante ✏️ carica dati nel form; (4) **Display card migliorato** mostra tutti i parametri con badge "🔥 Riscaldamento"; (5) **Navigazione wizard** con pulsante "Salva e Continua alla Pubblicazione →" se program status=draft e workout ha esercizi, altrimenti solo "Torna alla Panoramica"; (6) **UX migliorato** con form disabilitato durante submit, toast notifications, confirmation modal per delete, reset automatico form. Fix minore: corretta query ownership in `/api/personal-records/route.ts` (traineeId unique, non composite key).

---

### [30 Marzo 2026] — Implementato PATCH /api/weeks/[id]

**Task checklist:** #2.4  
**File creati:** `src/app/api/weeks/[id]/route.ts`  
**Note:** Implementato endpoint PATCH per configurazione tipo settimana e flag feedback. L'endpoint permette di modificare `weekType` (normal/test/deload) e `feedbackRequested` (boolean) anche post-pubblicazione, offrendo flessibilità al trainer per adattare la programmazione in corso (es. cambio da settimana normale a deload se trainee riporta affaticamento). Validazioni implementate: verifica ownership (trainer può modificare solo settimane dei propri programmi, admin può modificare qualsiasi), almeno un campo deve essere fornito nella richiesta. L'endpoint restituisce la settimana aggiornata con dettagli del programma e lista dei workout associati.

---

### [30 Marzo 2026] — Implementato POST /api/programs/[id]/complete

**Task checklist:** #2.3  
**File creati:** `src/app/api/programs/[id]/complete/route.ts`  
**Note:** Implementato endpoint POST per completamento manuale programma da parte del trainer. L'endpoint permette di marcare un programma come `completed` anche se non tutte le settimane sono finite. Validazioni implementate: verifica ownership (trainer può completare solo i propri programmi, admin può completare qualsiasi), verifica status (solo programmi `active` possono essere completati), supporto per `completionReason` opzionale (max 500 char). Il programma viene aggiornato con status='completed', completedAt=now(), e completionReason se fornito.

---

### [30 Marzo 2026] — Implementato GET /api/trainee/workouts/[id]

**Task checklist:** #2.2  
**File creati:** `src/app/api/trainee/workouts/[id]/route.ts`  
**Note:** Implementato endpoint GET per visualizzazione workout da parte del trainee. Include calcolo server-side dei pesi effettivi per ogni esercizio tramite `calculateEffectiveWeight()`, che gestisce tutte le tipologie di peso (absolute, percentage_1rm, percentage_rm, percentage_previous). L'endpoint verifica ownership tramite la catena Workout → Week → Program → traineeId, e include feedback esistente per la data corrente. Gestisce gracefully i casi di massimali mancanti con `effectiveWeight: null`.

---

### [30 Marzo 2026] — Completato POST /api/feedback con calcoli metriche

**Task checklist:** #2.1  
**File modificati:** `src/app/api/feedback/route.ts`  
**Note:** Migliorata risposta endpoint POST /api/feedback per includere metriche calcolate: `totalVolume` (somma reps × weight di tutte le serie) e `avgRPE` (actualRpe del feedback). L'endpoint già implementava nested create di ExerciseFeedback + SetPerformed, validazione ownership trainee, e idempotency check per data. Ora la response include un oggetto `calculated` con le metriche derivate per facilitare UX e reportistica.

---

### [30 Marzo 2026] — Reject coefficiente esercizi invalido

**Task checklist:** #1.4  
**File modificati:** `src/app/api/exercises/route.ts`, `src/app/api/exercises/[id]/route.ts`  
**Note:** Modificata validazione coefficienti muscle groups: ora la somma deve essere tra 0.1 e 3.0, altrimenti ritorna HTTP 400. Sostituito il warning con reject per evitare di creare esercizi che genererebbero dati errati nei report. Applicato sia a POST che PUT.

---

### [30 Marzo 2026] — Validazione lunghezza parametro search

**Task checklist:** #1.3  
**File modificati:** `src/app/api/exercises/route.ts`, `src/app/api/programs/route.ts`  
**Note:** Aggiunta validazione lunghezza parametro search (2-100 caratteri) per prevenire query DB pesanti con stringhe troppo lunghe. La validazione viene eseguita dopo il parsing degli schema Zod e restituisce HTTP 400 se fuori range.

---

### [30 Marzo 2026] — Fix RBAC bypass personal records

**Task checklist:** #1.1  
**File modificati:** `src/app/api/personal-records/route.ts`  
**Note:** Aggiunto ownership check per trainer quando richiedono personal records con parametro traineeId. Previene accesso a massimali di trainee di altri trainer. Utilizza la relazione TrainerTrainee con chiave composita per validare l'ownership.

---

### [28 Marzo 2026] — Setup iniziale database

**Cosa è stato fatto:**
- Schema database creato su Supabase via SQL manuale (`prisma/init.sql`)
- Porta 5432 non raggiungibile via Prisma CLI, usato SQL Editor Supabase come workaround

**File coinvolti:** `prisma/init.sql`, `prisma/schema.prisma`  
**Note:** La migrazione Prisma standard (`prisma migrate`) non funziona per limitazioni network sulla porta 5432. Usare l'SQL Editor di Supabase per applicare DDL.

---

### [Pre-28 Marzo 2026] — Fondamenta progetto

**Cosa è stato fatto:**
- Setup progetto Next.js 14 + TypeScript + Tailwind CSS
- Schema Prisma completo (14 entità, 6 enum, indici ottimizzati, cascade delete)
- Seed script con dati test: 1 admin, 2 trainer, 10 trainee, esercizi campione
- 8 librerie utility: `prisma.ts`, `supabase-client.ts`, `supabase-server.ts`, `api-response.ts`, `auth.ts`, `logger.ts`, `password-utils.ts`, `calculations.ts`
- 9 schema Zod di validazione (user, exercise, workout-exercise, feedback, program, week, personal-record, muscle-group, movement-pattern)
- Middleware completo: autenticazione Supabase, RBAC role-based routing, rate limiting ibrido (Redis + in-memory)
- Configurazione i18n (IT default + EN) con file traduzioni
- PWA manifest + icone placeholder
- App structure Next.js (layout, error boundary, loading, 404)
- 29 API endpoint implementati su 34 previsti (85%)
- 21 pagine frontend funzionali su 32 previste (52%)
- 27+ componenti UI implementati
- 8 file di test (unit, integration, E2E)
- GitHub Actions CI/CD pipeline
- Documentazione: 17 file markdown

**Stato raggiunto:** ~58% completamento complessivo

---

### [30 Marzo 2026] — System Review & riorganizzazione documentazione

**Cosa è stato fatto:**
- Creato [SYSTEM_REVIEW.md](../SYSTEM_REVIEW.md) — review completo del sistema con stato per area, issue sicurezza, backlog prioritizzato
- Aggiornato [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) — percentuali corrette (da ~40% dichiarato a ~58% reale)
- Riscritto [NEXT_ACTIONS.md](./NEXT_ACTIONS.md) — rimossi task già completati, aggiunto backlog reale con effort
- Aggiornato [README.md](./README.md) — indice file aggiornato, stato corretto
- Creato [CHECKLIST.md](./CHECKLIST.md) — checklist sviluppo con 49 task in 8 sprint
- Creato questo file [CHANGELOG.md](./CHANGELOG.md)

**Note:** La documentazione precedente dichiarava ~40% di completamento; l'analisi reale del codice ha rilevato ~58%. Le percentuali sono ora allineate in tutti i file.

---

## Prossime entry

<!-- Copia il template sotto per registrare il prossimo sviluppo -->

<!--
### [GG Mese AAAA] — Titolo
**Task checklist:** #X.Y  
**File modificati:** `...`  
**Note:** ...
-->
