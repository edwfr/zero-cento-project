# SYSTEM REVIEW - ZeroCento Training Platform

**Data review:** 30 Marzo 2026  
**Reviewer:** AI Code Review  
**Versione progetto:** ~55-60% completato  
**Stato generale:** Fondamenta solide, implementazione frontend e alcuni endpoint API da completare

---

## INDICE

1. [Sintesi Esecutiva](#1-sintesi-esecutiva)
2. [Stato Implementazione per Area](#2-stato-implementazione-per-area)
3. [Issue di Sicurezza](#3-issue-di-sicurezza)
4. [Issue di Qualità Codice](#4-issue-di-qualità-codice)
5. [Documentazione Discordante](#5-documentazione-discordante)
6. [Errori di Compilazione](#6-errori-di-compilazione)
7. [Next Steps - Sviluppo](#7-next-steps---sviluppo)
8. [Next Steps - CI/CD & DevOps](#8-next-steps---cicd--devops)
9. [Task Backlog Completo](#9-task-backlog-completo)

---

## 1. SINTESI ESECUTIVA

### Stato di Completamento

| Area                     | % Completamento | Stato                                                       |
| ------------------------ | --------------- | ----------------------------------------------------------- |
| Infrastruttura & Config  | 100%            | ✅ Completo                                                  |
| Database & Prisma Schema | 100%            | ✅ Production-ready                                          |
| Library & Utilities      | 100%            | ✅ Completo                                                  |
| Validation Schemas (Zod) | 100%            | ✅ Completo                                                  |
| Middleware & Security    | 95%             | ✅ Quasi completo                                            |
| i18n Config              | 100%            | ✅ Config ok, integrazione UI incompleta                     |
| API Endpoints            | ~85%            | 🟡 5 endpoint mancanti su ~52 progettati                     |
| Frontend - Admin         | ~60%            | 🟡 Pagine base, manca programs/reports                       |
| Frontend - Trainer       | ~45%            | 🟠 Program builder steps 2-4 vuoti                           |
| Frontend - Trainee       | ~50%            | 🟠 Workout view e feedback form strutturati ma da verificare |
| Testing                  | ~30%            | 🔴 8 file test, copertura sotto target 80%                   |
| CI/CD                    | 80%             | 🟡 Pipeline esiste, manca vercel.json                        |
| PWA                      | 70%             | 🟡 Manifest ok, service worker parziale                      |
| **COMPLESSIVO**          | **~58%**        | 🟡                                                           |

### Punti di Forza
- Architettura ben pensata e documentata (11 design doc + 6 implementation doc)
- Stack tecnologico moderno e coerente (Next.js 14 + Supabase + Prisma + Zod)
- Schema dati completo e con relazioni corrette
- Business logic critica implementata (`calculateEffectiveWeight` con risoluzione ricorsiva)
- RBAC implementato in modo uniforme sugli endpoint esistenti
- Rate limiting ibrido (Redis + in-memory) implementato nel middleware

### Punti di Attenzione
- Pagine frontend con parametri dinamici (`[id]`) presenti come route ma con file vuoti
- Gap tra documentazione (che dichiara ~40% completamento) e implementazione reale (~58%)
- Test coverage molto al di sotto del target dichiarato (80%)
- i18n configurato ma non integrato nei componenti (stringhe hardcoded in italiano)
- Alcune vulnerabilità RBAC da correggere

---

## 2. STATO IMPLEMENTAZIONE PER AREA

### 2.1 API Endpoints (29 route files implementati)

**Completamente implementati:**

| Endpoint                                              | Metodi           | RBAC       | Pagination | Note                                     |
| ----------------------------------------------------- | ---------------- | ---------- | ---------- | ---------------------------------------- |
| `/api/health`                                         | GET              | ❌ Pubblico | N/A        | Intenzionalmente aperto per monitoring   |
| `/api/auth/me`                                        | GET              | ✅          | N/A        | OK                                       |
| `/api/users`                                          | GET, POST        | ✅          | ❌ Manca    | Trainer può creare trainee (da valutare) |
| `/api/users/[id]`                                     | GET, PUT, DELETE | ✅          | N/A        | OK                                       |
| `/api/users/[id]/activate`                            | PATCH            | ✅          | N/A        | OK                                       |
| `/api/users/[id]/deactivate`                          | PATCH            | ✅          | N/A        | OK                                       |
| `/api/exercises`                                      | GET, POST        | ✅          | ✅ Cursor   | OK                                       |
| `/api/exercises/[id]`                                 | GET, PUT, DELETE | ✅          | N/A        | OK                                       |
| `/api/muscle-groups`                                  | GET, POST        | ✅          | ❌ Manca    | OK per dataset piccoli                   |
| `/api/muscle-groups/[id]`                             | GET, PUT, DELETE | ✅          | N/A        | OK                                       |
| `/api/muscle-groups/[id]/archive`                     | PATCH            | ✅          | N/A        | OK                                       |
| `/api/movement-patterns`                              | GET, POST        | ✅          | ❌ Manca    | OK per dataset piccoli                   |
| `/api/movement-patterns/[id]`                         | GET, PUT, DELETE | ✅          | N/A        | OK                                       |
| `/api/movement-patterns/[id]/archive`                 | PATCH            | ✅          | N/A        | OK                                       |
| `/api/programs`                                       | GET, POST        | ✅          | ✅ Cursor   | OK                                       |
| `/api/programs/[id]`                                  | GET, PUT, DELETE | ✅          | N/A        | OK                                       |
| `/api/programs/[id]/publish`                          | POST             | ✅          | N/A        | Valida workout hanno esercizi            |
| `/api/programs/[id]/progress`                         | GET              | ✅          | N/A        | OK                                       |
| `/api/programs/[id]/reports`                          | GET              | ✅          | N/A        | SBD + muscle groups + movement patterns  |
| `/api/programs/[id]/workouts/[wId]/exercises`         | POST             | ✅          | N/A        | OK                                       |
| `/api/programs/[id]/workouts/[wId]/exercises/[eId]`   | PUT, DELETE      | ✅          | N/A        | OK                                       |
| `/api/programs/[id]/workouts/[wId]/exercises/reorder` | PATCH            | ✅          | N/A        | OK                                       |
| `/api/feedback`                                       | GET              | ✅          | ✅ Cursor   | OK                                       |
| `/api/feedback/[id]`                                  | GET, PUT         | ✅          | N/A        | 24h edit window                          |
| `/api/personal-records`                               | GET, POST        | ⚠️ Parziale | ❌ Manca    | Vedi issue sicurezza #2                  |
| `/api/personal-records/[id]`                          | DELETE           | ✅          | N/A        | OK                                       |
| `/api/admin/trainees/[id]/reassign`                   | POST             | ✅ Admin    | N/A        | OK                                       |
| `/api/admin/programs/[id]/override`                   | PUT              | ✅ Admin    | N/A        | OK                                       |
| `/api/admin/reports/global`                           | GET              | ✅ Admin    | N/A        | 11 query parallele, vedi performance     |

**Endpoint mancanti rispetto al design (design/03_backend_api.md):**

| Endpoint Mancante                  | Priorità | User Stories Bloccate                                      |
| ---------------------------------- | -------- | ---------------------------------------------------------- |
| `POST /api/programs/[id]/complete` | ALTA     | US-T25 (completamento manuale)                             |
| `POST /api/feedback` (creazione)   | ALTA     | US-U07 (trainee inserisce feedback)                        |
| `GET /api/trainee/workouts/[id]`   | CRITICA  | US-U03 (trainee visualizza allenamento con peso effettivo) |
| `PATCH /api/weeks/[id]`            | MEDIA    | US-T22 (configura tipo settimana)                          |
| `GET /api/admin/programs`          | BASSA    | US-A05 (admin lista programmi globale)                     |

### 2.2 Frontend Pages (32 page.tsx trovati)

**Pagine con implementazione completa (>100 righe di codice):**

| Pagina                                      | Righe | Stato                                  |
| ------------------------------------------- | ----- | -------------------------------------- |
| `src/app/login/page.tsx`                    | ~200  | ✅ Funzionale                           |
| `src/app/forgot-password/page.tsx`          | ~150  | ✅ Funzionale                           |
| `src/app/reset-password/page.tsx`           | ~180  | ✅ Funzionale                           |
| `src/app/profile/page.tsx`                  | ~250  | ✅ Funzionale                           |
| `src/app/profile/change-password/page.tsx`  | ~200  | ✅ Funzionale                           |
| `src/app/admin/dashboard/page.tsx`          | ~300  | ✅ Funzionale                           |
| `src/app/admin/users/page.tsx`              | ~280  | ✅ Funzionale                           |
| `src/app/admin/exercises/page.tsx`          | ~250  | ✅ Funzionale                           |
| `src/app/admin/programs/page.tsx`           | ~250  | ✅ Funzionale                           |
| `src/app/trainer/dashboard/page.tsx`        | 318   | ✅ SSR con session check                |
| `src/app/trainer/exercises/page.tsx`        | 284   | ✅ Funzionale                           |
| `src/app/trainer/exercises/new/page.tsx`    | 350   | ✅ Funzionale                           |
| `src/app/trainer/programs/page.tsx`         | 315   | ✅ Lista con filtri status              |
| `src/app/trainer/programs/new/page.tsx`     | 24    | ⚠️ Wrapper, logica in NewProgramContent |
| `src/app/trainer/trainees/page.tsx`         | 234   | ✅ Lista con toggle status              |
| `src/app/trainer/trainees/new/page.tsx`     | 250   | ✅ Creazione trainee                    |
| `src/app/trainee/dashboard/page.tsx`        | 321   | ✅ Dashboard con programma corrente     |
| `src/app/trainee/programs/current/page.tsx` | 226   | ✅ Vista programma corrente             |
| `src/app/trainee/history/page.tsx`          | 229   | ✅ Storico programmi                    |
| `src/app/trainee/records/page.tsx`          | 266   | ✅ Lista massimali                      |
| `src/app/components-showcase/page.tsx`      | ~300  | ✅ Showcase componenti                  |

**Pagine con route creata ma file vuoto (0 righe):**

| Pagina                                                  | Stato   | Priorità |
| ------------------------------------------------------- | ------- | -------- |
| `src/app/trainer/exercises/[id]/edit/page.tsx`          | ❌ Vuoto | ALTA     |
| `src/app/trainer/programs/[id]/edit/page.tsx`           | ❌ Vuoto | ALTA     |
| `src/app/trainer/programs/[id]/progress/page.tsx`       | ❌ Vuoto | ALTA     |
| `src/app/trainer/programs/[id]/publish/page.tsx`        | ❌ Vuoto | ALTA     |
| `src/app/trainer/programs/[id]/reports/page.tsx`        | ❌ Vuoto | MEDIA    |
| `src/app/trainer/programs/[id]/workouts/[wId]/page.tsx` | ❌ Vuoto | CRITICA  |
| `src/app/trainer/trainees/[id]/page.tsx`                | ❌ Vuoto | ALTA     |
| `src/app/trainer/trainees/[id]/records/page.tsx`        | ❌ Vuoto | MEDIA    |
| `src/app/trainee/workouts/[id]/page.tsx`                | ❌ Vuoto | CRITICA  |

### 2.3 Componenti (30 file in src/components/)

**Implementati e funzionali:**
- `DashboardLayout.tsx` - Layout navigazione con menu role-based
- `ProfileForm.tsx` - Form profilo utente
- `UsersTable.tsx` - Tabella utenti admin con CRUD
- `UserCreateModal.tsx`, `UserEditModal.tsx`, `UserDeleteModal.tsx`
- `ExercisesTable.tsx` - Tabella esercizi con filtri
- `ExerciseCreateModal.tsx` - Creazione esercizio con muscle groups
- `ExerciseCard.tsx` - Card esercizio display
- `ProgramsTable.tsx` - Tabella programmi con filtri status
- `AutocompleteSearch.tsx` - Ricerca autocomplete con keyboard navigation
- `ConfirmationModal.tsx` - Modale conferma generico
- `ToastNotification.tsx` - Sistema notifiche toast con context
- `LoadingSpinner.tsx` - Spinner + FullPageLoader + InlineLoader
- `ErrorBoundary.tsx` - Error boundary React
- `NavigationCard.tsx` - Card navigazione dashboard
- `StatCard.tsx` - Card statistiche
- `ProgressBar.tsx` - Barra progresso
- `MovementPatternTag.tsx` - Badge pattern motori colorato
- `WeekTypeBanner.tsx` - Banner tipo settimana (test/deload)
- `RPESelector.tsx` - Selettore RPE con gradient colore
- `RestTimeSelector.tsx` - Selettore tempo recupero
- `RepsInput.tsx` - Input ripetizioni validato
- `WeightTypeSelector.tsx` - Selettore tipo peso
- `YoutubeEmbed.tsx` - Embed YouTube lazy-loading
- `FeedbackForm.tsx` - Form feedback trainee
- `DatePicker.tsx` - Date picker
- `RoleGuard.tsx` - Guard ruolo
- `PWAInstallPrompt.tsx` - Prompt installazione PWA

### 2.4 Testing

| File                                         | Tipo        | Contenuto                 |
| -------------------------------------------- | ----------- | ------------------------- |
| `tests/unit/setup.ts`                        | Setup       | Mock Prisma, Supabase     |
| `tests/unit/schemas.test.ts`                 | Unit        | Test validazione Zod      |
| `tests/unit/calculations.test.ts`            | Unit        | Test calcoli peso/volume  |
| `tests/unit/components.test.tsx`             | Unit        | Test rendering componenti |
| `tests/integration/users.test.ts`            | Integration | CRUD utenti via API       |
| `tests/integration/programs.test.ts`         | Integration | Workflow programmi        |
| `tests/e2e/trainer-create-program.spec.ts`   | E2E         | Flusso trainer creazione  |
| `tests/e2e/trainee-complete-workout.spec.ts` | E2E         | Flusso trainee workout    |

**Copertura stimata: ~30%** (target dichiarato: 80%)

**Test mancanti critici:**
- Unit test per `calculateEffectiveWeight()` con chain `percentage_previous`
- Unit test per generazione password sicura
- Integration test per RBAC violations (accesso negato tra ruoli)
- Integration test per feedback CRUD
- Integration test per personal records
- E2E test per login + redirect ruolo
- E2E test per programma completo: crea → pubblica → monitora → completa

---

## 3. ISSUE DI SICUREZZA

### 3.1 CRITICO - RBAC Bypass su Personal Records

**File:** `src/app/api/personal-records/route.ts`

**Problema:** Un trainer può passare `?traineeId=QUALSIASI_ID` per vedere i massimali di trainee di altri trainer. Il parametro `traineeId` sovrascrive il filtro RBAC senza verificare la relazione trainer-trainee.

**Fix richiesto:** Aggiungere controllo ownership:
```typescript
if (traineeId && session.user.role === 'trainer') {
  const isManaged = await prisma.trainerTrainee.findUnique({
    where: { traineeId, trainerId: session.user.id }
  })
  if (!isManaged) return apiError('FORBIDDEN', 'Access denied', 403)
}
```

### 3.2 ALTO - Trainer può creare utenti trainee

**File:** `src/app/api/users/route.ts`

**Problema:** I trainer possono creare trainee senza limiti, bypassando il controllo admin. Valutare se questo è un comportamento desiderato o se la creazione trainee dovrebbe essere riservata all'admin.

**Raccomandazione:** Verificare con i requisiti di business. Se i trainer non devono creare trainee:
```typescript
if (session.user.role === 'trainer' && role === 'trainee') {
  return apiError('FORBIDDEN', 'Solo admin può creare utenti', 403)
}
```

### 3.3 MEDIO - Validazione input mancante

**File:** `src/app/api/personal-records/route.ts`

**Problema:** I personal records accettano pesi negativi, reps decimali e date future. Lo schema Zod non include validazioni di range.

**Fix:** Aggiungere al schema `src/schemas/personal-record.ts`:
- `weight: z.number().positive().max(1000)`
- `reps: z.number().int().positive().max(100)`
- `recordDate` con refine per date non future

### 3.4 MEDIO - Search parameter length non validata

**File:** Multipli (`exercises/route.ts`, `programs/route.ts`, `feedback/route.ts`)

**Problema:** Il parametro `search` non ha limitazione di lunghezza. Una stringa molto lunga causa query DB pesanti.

**Fix:** Validare `search.length >= 2 && search.length <= 100` prima dell'uso.

### 3.5 BASSO - Coefficiente esercizi solo warning

**File:** `src/app/api/exercises/route.ts`

**Problema:** Se la somma dei coefficienti muscle group è > 3.0, il sistema logga solo un warning ma crea l'esercizio. I report calcoleranno dati errati.

**Fix:** Rifiutare con HTTP 400 se `totalCoefficient < 0.1 || totalCoefficient > 3.0`.

### 3.6 BASSO - Admin reports senza caching

**File:** `src/app/api/admin/reports/global/route.ts`

**Problema:** 11 query parallele senza caching. Se più admin interrogano simultaneamente, carico DB elevato.

**Fix:** Aggiungere cache in-memory con TTL 5 minuti.

---

## 4. ISSUE DI QUALITÀ CODICE

### 4.1 i18n non integrato nei componenti
- File di traduzione esistono (`public/locales/it/` e `en/`) ma i componenti usano stringhe hardcoded in italiano
- **Impatto:** L'app non è internazionalizzabile senza riscrittura
- **Azione:** Integrare `useTranslation()` in tutti i componenti con stringhe utente

### 4.2 Pattern `catch (err: any)` diffuso
- Usato in molteplici pagine trainer/trainee
- **Fix:** Sostituire con `catch (err: unknown)` e type narrowing

### 4.3 Inconsistenza formato risposte API
- Liste: `{ exercises, nextCursor, hasMore }` vs `{ users }` vs `{ records }`
- Singoli: `{ exercise }` vs `{ feedback }`
- **Fix:** Standardizzare su `{ items: [...], pagination?: { nextCursor, hasMore } }`

### 4.4 Mancanza di loading skeleton
- I componenti usano spinner generici invece di skeleton loader context-aware
- **Impatto UX:** Flash di contenuto durante caricamento

### 4.5 Form non disabilitati durante submit
- Vari form permettono doppio submit perché non disabilitano i campi durante la chiamata API
- **Fix:** Gestire stato `isSubmitting` su tutti i form

### 4.6 Errori TypeScript nei test di integrazione
- `tests/integration/programs.test.ts` riga 86: incompatibilità tipo `NextRequest` signal
- `tests/integration/users.test.ts` riga 101: stessa issue
- **Fix:** Cast esplicito o filtro `signal` dalla `RequestInit`

---

## 5. DOCUMENTAZIONE DISCORDANTE

### 5.1 IMPLEMENTATION_SUMMARY.md dichiara ~40%, realtà ~58%

**File:** `implementation-docs/IMPLEMENTATION_SUMMARY.md`

| Claim                        | Realtà                                                          |
| ---------------------------- | --------------------------------------------------------------- |
| "API Endpoints (40%)"        | ~85% (29/~34 endpoint base implementati)                        |
| "Authentication Pages (50%)" | ~90% (login, forgot, reset, change password tutti implementati) |
| "Frontend (30%)"             | ~50% (21 pagine funzionali su ~32 previste)                     |

**Azione:** Aggiornare IMPLEMENTATION_SUMMARY.md con le percentuali corrette.

### 5.2 NEXT_ACTIONS.md contiene task già completati

**File:** `implementation-docs/NEXT_ACTIONS.md`

Task marcati come TODO ma già fatti:
- "Genera Prisma Client" → ✅ Già generato
- "Seed Database" → ✅ Script esiste e funziona
- "API Users" → ✅ Completamente implementato
- "API Exercises" → ✅ Completamente implementato

**Azione:** Riscrivere NEXT_ACTIONS.md con i task realmente pendenti.

### 5.4 CI/CD Pipeline dichiara endpoint `prisma:migrate:prod` non esistente

**File:** `.github/workflows/ci.yml` riga 97

```yaml
- name: Run database migrations
  run: npm run prisma:migrate:prod
```

Lo script `prisma:migrate:prod` non esiste in `package.json`.

**Azione:** Aggiungere lo script o usare `npx prisma migrate deploy`.

### 5.5 Enum RestTime: naming confuso ma corretto

Lo schema Prisma usa `s30, m1, m2, m3, m5` mentre la UI mostra `30s, 1m, 2m, 3m, 5m`. I nomi sono diversi ma il mapping è coerente. Documentare esplicitamente il mapping enum ↔ display.

---

## 6. ERRORI DI COMPILAZIONE

| File                                 | Riga | Errore                                    |
| ------------------------------------ | ---- | ----------------------------------------- |
| `tests/integration/programs.test.ts` | 86   | `NextRequest` signal type incompatibility |
| `tests/integration/users.test.ts`    | 101  | `NextRequest` signal type incompatibility |

**Fix:** In entrambi i file, nel helper che crea `NextRequest`:
```typescript
const { signal, ...safeOptions } = options || {}
return new NextRequest(url, safeOptions as any)
```

---

## 7. NEXT STEPS - SVILUPPO

### FASE 1 - Fix Critici & Data Quality (Priorità: URGENTE)

| #   | Task                                                      | File Coinvolti                          | Effort |
| --- | --------------------------------------------------------- | --------------------------------------- | ------ |
| 1.1 | Fix RBAC bypass personal records                          | `src/app/api/personal-records/route.ts` | 1h     |
| 1.2 | Aggiungere validazione range a schema personal-record     | `src/schemas/personal-record.ts`        | 30min  |
| 1.3 | Validare lunghezza parametro search su tutti gli endpoint | 3 file route.ts                         | 1h     |
| 1.4 | Fix coefficiente esercizi: reject > 3.0                   | `src/app/api/exercises/route.ts`        | 30min  |
| 1.5 | Fix errori TypeScript nei test di integrazione            | 2 file test                             | 30min  |
| 1.6 | Disabilitare form durante submit su tutti i componenti    | ~8 componenti                           | 2h     |

### FASE 2 - Endpoint API Mancanti (Priorità: ALTA)

| #   | Task                                                    | Endpoint                           | Effort |
| --- | ------------------------------------------------------- | ---------------------------------- | ------ |
| 2.1 | Creare endpoint feedback POST (creazione)               | `POST /api/feedback`               | 3h     |
| 2.2 | Creare endpoint completamento programma                 | `POST /api/programs/[id]/complete` | 2h     |
| 2.3 | Creare endpoint trainee workout view con peso effettivo | `GET /api/trainee/workouts/[id]`   | 4h     |
| 2.4 | Creare endpoint configurazione week type                | `PATCH /api/weeks/[id]`            | 2h     |

### FASE 3 - Frontend Trainer (Priorità: ALTA)

| #   | Task                                           | Pagina                                          | Effort |
| --- | ---------------------------------------------- | ----------------------------------------------- | ------ |
| 3.1 | Implementare edit esercizio                    | `trainer/exercises/[id]/edit/page.tsx`          | 4h     |
| 3.2 | Implementare workout detail (step 3 wizard)    | `trainer/programs/[id]/workouts/[wId]/page.tsx` | 8h     |
| 3.3 | Implementare publish programma (step 4 wizard) | `trainer/programs/[id]/publish/page.tsx`        | 4h     |
| 3.4 | Implementare progress programma                | `trainer/programs/[id]/progress/page.tsx`       | 4h     |
| 3.5 | Implementare reports programma                 | `trainer/programs/[id]/reports/page.tsx`        | 6h     |
| 3.6 | Implementare edit programma                    | `trainer/programs/[id]/edit/page.tsx`           | 4h     |
| 3.7 | Implementare dettaglio trainee                 | `trainer/trainees/[id]/page.tsx`                | 4h     |
| 3.8 | Implementare massimali trainee                 | `trainer/trainees/[id]/records/page.tsx`        | 3h     |

### FASE 4 - Frontend Trainee (Priorità: ALTA)

| #   | Task                                          | Pagina                           | Effort  |
| --- | --------------------------------------------- | -------------------------------- | ------- |
| 4.1 | Implementare workout view con card navigation | `trainee/workouts/[id]/page.tsx` | 8h      |
| 4.2 | Integrare FeedbackForm nella workout view     | Dentro 4.1                       | Incluso |
| 4.3 | Verificare funzionamento autosave feedback    | `FeedbackForm.tsx`               | 2h      |

### FASE 5 - i18n & UX Polish (Priorità: MEDIA)

| #   | Task                                                | Effort |
| --- | --------------------------------------------------- | ------ |
| 5.1 | Integrare `useTranslation()` in tutti i componenti  | 8h     |
| 5.2 | Rimuovere stringhe hardcoded italiane               | 4h     |
| 5.3 | Aggiungere skeleton loader al posto dei spinner     | 4h     |
| 5.4 | Aggiungere ARIA labels e focus management ai modali | 3h     |
| 5.5 | Standardizzare formato date con locale i18n         | 2h     |

### FASE 6 - Testing (Priorità: ALTA)

| #    | Task                                                                                 | Effort |
| ---- | ------------------------------------------------------------------------------------ | ------ |
| 6.1  | Unit test: `calculateEffectiveWeight()` con chain percentage_previous (tutti i casi) | 3h     |
| 6.2  | Unit test: generazione password sicura                                               | 1h     |
| 6.3  | Integration test: RBAC violations (trainer accede risorse altrui)                    | 4h     |
| 6.4  | Integration test: feedback CRUD completo                                             | 3h     |
| 6.5  | Integration test: personal records CRUD                                              | 2h     |
| 6.6  | Integration test: esercizi con relazioni                                             | 2h     |
| 6.7  | E2E test: login → redirect per ruolo                                                 | 2h     |
| 6.8  | E2E test: trainer crea programma → pubblica → trainee lo vede                        | 4h     |
| 6.9  | E2E test: trainee completa workout con feedback                                      | 3h     |
| 6.10 | Raggiungere copertura minima 80%                                                     | 8h     |

---

## 8. NEXT STEPS - CI/CD & DEVOPS

### 8.1 Fix Pipeline CI/CD Esistente

| #     | Task                                                                       | File                       | Effort |
| ----- | -------------------------------------------------------------------------- | -------------------------- | ------ |
| 8.1.1 | Aggiungere script `prisma:migrate:prod` a package.json                     | `package.json`             | 15min  |
| 8.1.2 | Oppure sostituire con `npx prisma migrate deploy` nel workflow             | `.github/workflows/ci.yml` | 15min  |
| 8.1.3 | Aggiungere step `npm run build` nel job test per verificare build          | `.github/workflows/ci.yml` | 15min  |
| 8.1.4 | Configurare secrets GitHub: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID | GitHub Settings            | 30min  |
| 8.1.5 | Configurare secrets GitHub: STAGING_URL, PRODUCTION_DATABASE_URL           | GitHub Settings            | 30min  |

### 8.2 Deployment Vercel

| #     | Task                                                   | Effort |
| ----- | ------------------------------------------------------ | ------ |
| 8.2.1 | Creare `vercel.json` con build config e route rewrites | 30min  |
| 8.2.2 | Configurare environment variables su Vercel dashboard  | 30min  |
| 8.2.3 | Collegare repo GitHub a Vercel per auto-deploy         | 15min  |
| 8.2.4 | Configurare preview deployments su PR                  | 15min  |

### 8.3 Monitoring & Observability

| #     | Task                                                               | Effort |
| ----- | ------------------------------------------------------------------ | ------ |
| 8.3.1 | Completare integrazione Sentry (package presente, non configurato) | 2h     |
| 8.3.2 | Configurare UptimeRobot su `/api/health`                           | 15min  |
| 8.3.3 | Aggiungere Vercel Analytics (incluso nel piano Pro)                | 30min  |

### 8.4 Database Operations

| #     | Task                                                                | Effort |
| ----- | ------------------------------------------------------------------- | ------ |
| 8.4.1 | Creare environment Supabase staging (branching, piano Pro)          | 1h     |
| 8.4.2 | Documentare processo di migration in produzione                     | 1h     |
| 8.4.3 | Aggiungere indice su `ExerciseFeedback.traineeId`                   | 15min  |
| 8.4.4 | Aggiungere indice composto su `SetPerformed(feedbackId, setNumber)` | 15min  |

### 8.5 PWA Completamento

| #     | Task                                                    | Effort |
| ----- | ------------------------------------------------------- | ------ |
| 8.5.1 | Verificare integrazione service worker con Serwist      | 2h     |
| 8.5.2 | Sostituire icone placeholder con loghi reali            | 1h     |
| 8.5.3 | Testare installazione PWA su mobile                     | 1h     |
| 8.5.4 | Implementare strategia cache offline per workout attivo | 4h     |

---

## 9. TASK BACKLOG COMPLETO

### Legenda priorità
- 🔴 **CRITICO** - Blocca flussi utente essenziali
- 🟠 **ALTO** - Feature principale mancante
- 🟡 **MEDIO** - Miglioria qualità/UX
- 🔵 **BASSO** - Nice-to-have

### Backlog ordinato per priorità

| #   | Categoria | Task                                                     | Priorità | Stima          |
| --- | --------- | -------------------------------------------------------- | -------- | -------------- |
| 1   | Security  | Fix RBAC bypass personal records                         | 🔴        | 1h             |
| 2   | Security  | Validazione range personal-record schema                 | 🔴        | 30min          |
| 3   | Security  | Validazione lunghezza search param                       | 🔴        | 1h             |
| 4   | Security  | Reject coefficiente esercizi > 3.0                       | 🟠        | 30min          |
| 5   | Bug       | Fix errori TypeScript test integrazione                  | 🔴        | 30min          |
| 6   | API       | POST /api/feedback (creazione feedback)                  | 🔴        | 3h             |
| 7   | API       | GET /api/trainee/workouts/[id] con peso effettivo        | 🔴        | 4h             |
| 8   | API       | POST /api/programs/[id]/complete                         | 🟠        | 2h             |
| 9   | API       | PATCH /api/weeks/[id]                                    | 🟡        | 2h             |
| 10  | Frontend  | trainer/programs/[id]/workouts/[wId]/page.tsx            | 🔴        | 8h             |
| 11  | Frontend  | trainee/workouts/[id]/page.tsx (card-based workout view) | 🔴        | 8h             |
| 12  | Frontend  | trainer/exercises/[id]/edit/page.tsx                     | 🟠        | 4h             |
| 13  | Frontend  | trainer/programs/[id]/publish/page.tsx                   | 🟠        | 4h             |
| 14  | Frontend  | trainer/programs/[id]/progress/page.tsx                  | 🟠        | 4h             |
| 15  | Frontend  | trainer/programs/[id]/edit/page.tsx                      | 🟠        | 4h             |
| 16  | Frontend  | trainer/programs/[id]/reports/page.tsx                   | 🟡        | 6h             |
| 17  | Frontend  | trainer/trainees/[id]/page.tsx                           | 🟠        | 4h             |
| 18  | Frontend  | trainer/trainees/[id]/records/page.tsx                   | 🟡        | 3h             |
| 19  | Frontend  | Disabilitare form durante submit                         | 🟠        | 2h             |
| 20  | UX        | Integrazione FeedbackForm nella workout view trainee     | 🔴        | Incluso in #11 |
| 21  | Docs      | Aggiornare IMPLEMENTATION_SUMMARY.md                     | 🟠        | 1h             |
| 22  | Docs      | Riscrivere NEXT_ACTIONS.md con task reali                | 🟠        | 1h             |
| 23  | CI/CD     | Fix script prisma:migrate:prod in pipeline               | 🔴        | 15min          |
| 24  | CI/CD     | Aggiungere build step nel job test CI                    | 🟠        | 15min          |
| 25  | CI/CD     | Creare vercel.json                                       | 🟠        | 30min          |
| 26  | CI/CD     | Configurare secrets GitHub (5 secrets)                   | 🟠        | 30min          |
| 27  | CI/CD     | Configurare Vercel auto-deploy + preview                 | 🟡        | 30min          |
| 28  | CI/CD     | Completare integrazione Sentry                           | 🟡        | 2h             |
| 29  | CI/CD     | Configurare UptimeRobot                                  | 🔵        | 15min          |
| 30  | DB        | Aggiungere indice ExerciseFeedback.traineeId             | 🟡        | 15min          |
| 31  | DB        | Aggiungere indice composto SetPerformed                  | 🟡        | 15min          |
| 32  | DB        | Staging environment Supabase                             | 🟡        | 1h             |
| 33  | i18n      | Integrare useTranslation() in componenti                 | 🟡        | 8h             |
| 34  | i18n      | Rimuovere stringhe hardcoded                             | 🟡        | 4h             |
| 35  | Test      | Unit: calculateEffectiveWeight chain                     | 🟠        | 3h             |
| 36  | Test      | Unit: password generation                                | 🟡        | 1h             |
| 37  | Test      | Integration: RBAC violations                             | 🟠        | 4h             |
| 38  | Test      | Integration: feedback CRUD                               | 🟠        | 3h             |
| 39  | Test      | Integration: personal records                            | 🟡        | 2h             |
| 40  | Test      | E2E: login redirect per ruolo                            | 🟡        | 2h             |
| 41  | Test      | E2E: flusso completo trainer → trainee                   | 🟠        | 4h             |
| 42  | Test      | Raggiungere copertura 80%                                | 🟠        | 8h             |
| 43  | PWA       | Integrazione service worker Serwist                      | 🟡        | 2h             |
| 44  | PWA       | Icone reali sostitutive placeholder                      | 🔵        | 1h             |
| 45  | PWA       | Cache offline workout attivo                             | 🔵        | 4h             |
| 46  | UX        | Skeleton loader al posto di spinner                      | 🔵        | 4h             |
| 47  | UX        | ARIA labels e focus management modali                    | 🔵        | 3h             |
| 48  | UX        | Standardizzare formato risposte API                      | 🔵        | 4h             |
| 49  | UX        | Caching admin reports (TTL 5min)                         | 🔵        | 1h             |

### Totale effort stimato rimanente: ~129h

### Roadmap suggerita

| Sprint   | Focus                                   | Task                   | Effort |
| -------- | --------------------------------------- | ---------------------- | ------ |
| Sprint 1 | Fix critici + Security                  | #1-5, #24              | ~4h    |
| Sprint 2 | API mancanti + Training Program Builder | #6-10, #13, #15        | ~29h   |
| Sprint 3 | Trainee Workout View + Feedback         | #11, #20               | ~8h    |
| Sprint 4 | Trainer pages rimanenti                 | #12, #14, #16-18       | ~21h   |
| Sprint 5 | Testing target 80%                      | #36-43                 | ~27h   |
| Sprint 6 | CI/CD + Deploy                          | #25-30, #33            | ~5h    |
| Sprint 7 | i18n + UX Polish                        | #19, #34-35, #47-50    | ~23h   |
| Sprint 8 | PWA + Final polish                      | #21-23, #31-32, #44-46 | ~11h   |

---

*Documento generato il 30 Marzo 2026. Prossimo review consigliato dopo completamento Sprint 3.*
