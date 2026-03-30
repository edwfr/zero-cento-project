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
