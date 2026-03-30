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
