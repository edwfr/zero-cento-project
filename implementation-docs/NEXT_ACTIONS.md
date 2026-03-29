# ⚡ NEXT ACTIONS - ZeroCento Training Platform

**Ultimo aggiornamento:** 30 Marzo 2026  
**Progresso attuale:** ~58% completato  
**Riferimento completo:** [SYSTEM_REVIEW.md](../SYSTEM_REVIEW.md)

---

## 🎯 PRIORITÀ IMMEDIATE

### 🔴 CRITICO - Fix Sicurezza (Effort totale: ~4h)

Questi fix devono essere implementati PRIMA di qualsiasi deployment in produzione.

#### 1. Fix RBAC Bypass Personal Records (1h)
**File:** `src/app/api/personal-records/route.ts`

**Problema:** Trainer può accedere a massimali di trainee di altri trainer via `?traineeId=ANY_ID`

**Fix richiesto:**
```typescript
if (traineeId && session.user.role === 'trainer') {
  const isManaged = await prisma.trainerTrainee.findUnique({
    where: { 
      trainerId_traineeId: {
        trainerId: session.user.id,
        traineeId
      }
    }
  })
  if (!isManaged) return apiError('FORBIDDEN', 'Access denied', 403)
}
```

#### 2. Validazione Range Personal Record (30min)
**File:** `src/schemas/personal-record.ts`

Aggiungere validazioni:
- `weight: z.number().positive().max(1000)`
- `reps: z.number().int().positive().max(100)`
- `recordDate` con refine per date non future

#### 3. Validazione Lunghezza Search Parameter (1h)
**File:** `src/app/api/exercises/route.ts`, `programs/route.ts`, `feedback/route.ts`

Prima dell'uso:
```typescript
if (search && (search.length < 2 || search.length > 100)) {
  return apiError('VALIDATION_ERROR', 'Search deve essere 2-100 caratteri', 400)
}
```

#### 4. Reject Coefficiente Esercizi > 3.0 (30min)
**File:** `src/app/api/exercises/route.ts`

Sostituire warning con errore HTTP 400 se `totalCoefficient > 3.0`

#### 5. Fix Errori TypeScript Test Integrazione (30min)
**File:** `tests/integration/programs.test.ts` (riga 86), `tests/integration/users.test.ts` (riga 101)

Nel helper che crea `NextRequest`:
```typescript
const { signal, ...safeOptions } = options || {}
return new NextRequest(url, safeOptions as any)
```

#### 6. Disabilitare Form Durante Submit (2h)
**File:** ~8 componenti con form

Pattern:
```typescript
const [isSubmitting, setIsSubmitting] = useState(false)
// In onSubmit:
setIsSubmitting(true)
try { await api() } finally { setIsSubmitting(false) }
// Su input/button: disabled={isSubmitting}
```

---

## 🟠 ALTA PRIORITÀ - Backend Completo

### API Endpoints Mancanti (Effort totale: ~11h)

#### 7. POST /api/feedback - Creazione Feedback Trainee (3h)
**File da creare:** `src/app/api/feedback/route.ts`

Implementare `POST` per:
- Nested create: `ExerciseFeedback` + multiple `SetPerformed`
- Calcolare `totalVolume` e `avgRPE`
- Validare trainee ownership del workout
- Idempotency check su `workoutExerciseId`

#### 8. GET /api/trainee/workouts/[id] - Vista Workout (4h)
**File da creare:** `src/app/api/trainee/workouts/[id]/route.ts`

Endpoint per trainee con:
- WorkoutExercises con `calculateEffectiveWeight()` pre-calcolato
- Exercise details + video URL
- Feedback esistente (se presente)
- RBAC: solo trainee proprietario

#### 9. POST /api/programs/[id]/complete - Completamento Manuale (2h)
**File da creare:** `src/app/api/programs/[id]/complete/route.ts`

Permette a trainer di marcare programma come `completed` anche se non tutte le settimane finite

#### 10. PATCH /api/weeks/[id] - Config Tipo Settimana (2h)
**File da creare:** `src/app/api/weeks/[id]/route.ts`

Permette di modificare `weekType` (normal/test/deload) post-pubblicazione

---

## 🟠 ALTA PRIORITÀ - Frontend Completo

### Pagine Trainer (Effort totale: ~37h)

Le seguenti route esistono ma hanno file vuoti:

#### 11. Workout Detail Editor - Step 3 Wizard (8h)
**File:** `src/app/trainer/programs/[id]/workouts/[wId]/page.tsx`

- Lista esercizi nella workout (drag-drop per riordinare)
- Modal aggiungi esercizio (search autocomplete)
- Configura sets/reps/weight/RPE per ciascun esercizio
- Pulsante "Salva e continua" → step 4 (publish)

#### 12. Publish Programma - Step 4 Wizard (4h)
**File:** `src/app/trainer/programs/[id]/publish/page.tsx`

- Riepilogo programma completo
- Input `startDate`
- Validazione: ogni workout ha ≥1 esercizio
- Chiamata `POST /api/programs/[id]/publish`
- Redirect a `/trainer/programs` con toast success

#### 13. Edit Esercizio (4h)
**File:** `src/app/trainer/exercises/[id]/edit/page.tsx`

Form simile a `exercises/new` con dati precar icati

#### 14. Edit Programma (4h)
**File:** `src/app/trainer/programs/[id]/edit/page.tsx`

Modifica nome, durata, note (solo se status=draft, altrimenti mostra alert)

#### 15. Progress Programma (4h)
**File:** `src/app/trainer/programs/[id]/progress/page.tsx`

**Dashboard con:**
- Progress bar settimane (1-8)
- Card per ogni workout: completato (✅) o no (⏳)
- KPI: avg RPE, volume totale, feedback count
- Grafico volume per settimana (chart.js o recharts)

#### 16. Reports Programma (6h)
**File:** `src/app/trainer/programs/[id]/reports/page.tsx`

**Visualizzazione:**
- SBD totals (Squat/Bench/Deadlift volume)
- Volume per muscle group (bar chart)
- Distribuzione RPE (pie chart)
- Peso prescritto vs eseguito (scatter plot)

#### 17. Dettaglio Trainee (4h)
**File:** `src/app/trainer/trainees/[id]/page.tsx`

- Dati anagrafici trainee
- Lista programmi assegnati (storico + corrente)
- Link a massimali (`/trainer/trainees/[id]/records`)
- Pulsante "Crea nuovo programma per questo trainee"

#### 18. Massimali Trainee (3h)
**File:** `src/app/trainer/trainees/[id]/records/page.tsx`

- Tabella personal records per esercizio
- Mostra 1RM, 3RM, 5RM, 10RM
- Pulsante "Aggiorna massimale"

### Pagine Trainee (Effort totale: ~8h)

#### 19. Workout View con Card Navigation (8h)
**File:** `src/app/trainee/workouts/[id]/page.tsx`

**UI mobile-first:**
- Card swipeable per ogni esercizio (carousel)
- Display: nome esercizio, video YouTube embed, sets/reps/peso effettivo
- Input per ogni serie: reps eseguite, peso usato, RPE
- Note testuali opzionali
- Pulsante "Completa e invia feedback"
- Auto-save su localStorage ogni 30s

---

## 🟡 MEDIA PRIORITÀ

### Testing (Effort totale: ~27h)

#### 20-27. Test Coverage Enhancement

Vedi [SYSTEM_REVIEW.md - FASE 6](../SYSTEM_REVIEW.md#fase-6---testing-priorit%C3%A0-alta) per dettagli:
- Unit test per `calculateEffectiveWeight()` con chain
- Integration test per RBAC violations
- Integration test per feedback/personal records CRUD
- E2E test per flussi utente completi
- **Target: 80% coverage**

### i18n & UX Polish (Effort totale: ~23h)

#### 28-32. Internazionalizzazione

Vedi [SYSTEM_REVIEW.md - FASE 5](../SYSTEM_REVIEW.md#fase-5---i18n--ux-polish-priorit%C3%A0-media) per dettagli:
- Integrare `useTranslation()` in componenti
- Rimuovere stringhe hardcoded italiane
- Skeleton loaders
- ARIA labels e focus management

---

## 🔵 BASSA PRIORITÀ

### CI/CD & Deployment (Effort totale: ~5h)

Vedi [SYSTEM_REVIEW.md - Sezione 8](../SYSTEM_REVIEW.md#8-next-steps---cicd--devops) per dettagli completi.

### PWA Completamento (Effort totale: ~7h)

Vedi [SYSTEM_REVIEW.md - Sezione 8.5](../SYSTEM_REVIEW.md#85-pwa-completamento) per dettagli completi.

---

## 📊 Roadmap Suggerita

| Sprint   | Focus                          | Task            | Effort |
| -------- | ------------------------------ | --------------- | ------ |
| Sprint 1 | Fix critici sicurezza          | #1-6            | ~4h    |
| Sprint 2 | API mancanti + Program Builder | #7-10, #12, #14 | ~25h   |
| Sprint 3 | Trainee Workout View           | #19             | ~8h    |
| Sprint 4 | Trainer progress & reports     | #11, #15-18     | ~25h   |
| Sprint 5 | Testing target 80%             | #20-27          | ~27h   |
| Sprint 6 | i18n + UX Polish               | #13, #28-32     | ~27h   |
| Sprint 7 | CI/CD + Deploy                 | CI/CD tasks     | ~5h    |
| Sprint 8 | PWA + Final polish             | PWA tasks       | ~7h    |

**Effort totale rimanente: ~129h**

---

## 🔥 Troubleshooting Comuni

### ❌ Errore: "Cannot find module '@prisma/client'"
```bash
npm run prisma:generate
```

### ❌ Errore: "Database connection failed"
Verifica `.env.local`:
- `DATABASE_URL` usa porta 6543 (pooling)
- `DIRECT_URL` usa porta 5432 (direct)
- Password corretta

### ❌ Errore: "Rate limit exceeded" su login
Il rate limiting è configurato a 5 tentativi / 15 minuti per login. Aspetta o resetta Redis/in-memory cache riavviando server.

### ❌ Test falliscono con "NextRequest signal incompatibility"
Applica fix #5 sopra.

---

## 📚 Documentazione Correlata

- **Setup iniziale:** [QUICK_START.md](./QUICK_START.md)
- **Stato completo:** [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **Review sistema:** [SYSTEM_REVIEW.md](../SYSTEM_REVIEW.md)
- **Architettura:** [../design/01_architecture_overview.md](../design/01_architecture_overview.md)
- **API Design:** [../design/03_backend_api.md](../design/03_backend_api.md)
- **Frontend Design:** [../design/02_frontend_design.md](../design/02_frontend_design.md)
- **User Stories:** [../design/10_user_stories.md](../design/10_user_stories.md)

---

**Ultimo update:** 30 Marzo 2026 - Documentazione sincronizzata con SYSTEM_REVIEW.md

### ❌ Errore: "P1001: Can't reach database server"
1. Verifica `.env.local` con credenziali corrette
2. Verifica progetto Supabase sia attivo (non paused)
3. Prova connection diretta:
   ```bash
   npx prisma studio
   ```

### ❌ Errore: "User not found" dopo login
Gli utenti esistono in `public.users` ma manca in `auth.users`.

**Soluzione**:
1. Vai su Supabase Dashboard → Database → SQL Editor
2. Esegui:
   ```sql
   -- Verifica utenti in public.users
   SELECT id, email, role FROM public.users;
   
   -- Verifica utenti in auth.users
   SELECT id, email FROM auth.users;
   ```
3. Se auth.users è vuoto, devi creare manualmente via Dashboard

### ❌ Errore: "Rate limit exceeded" durante sviluppo
Nel `src/middleware.ts`, commenta temporaneamente il rate limiting:
```typescript
// Commenta queste righe durante development
// const allowed = await checkRateLimit(...)
// if (!allowed) { ... }
```

### ❌ Login reindirizza sempre a /login
Verifica middleware: `src/middleware.ts` deve permettere accesso a `/login` nei PUBLIC_ROUTES.

---

## 📋 Checklist Setup Completo

- [x] npm install completato
- [x] Prisma client generato
- [x] Supabase project creato (Frankfurt)
- [x] `.env` e `.env.local` configurati con credenziali reali
- [x] **Schema database creato** (via SQL Editor - 28 marzo 2026) ✅
- [ ] **PROSSIMO STEP**: Database popolato (`npm run prisma:seed`)
- [ ] Password create per admin/trainer1/trainee1 in Supabase
- [ ] Dev server avviato (`npm run dev`)
- [ ] Health check passa (200 OK)
- [ ] Login funziona con admin
- [ ] API /api/users risponde correttamente

---

### 📝 Nota 28 Marzo 2026
**Completato fino a:** Creazione schema database
**Metodo:** Script SQL eseguito manualmente su Supabase (prisma/init.sql)
**Motivo:** Porta 5432 non raggiungibile via Prisma CLI
**Prossimo step domani:** Eseguire `npm run prisma:seed` per popolare i dati iniziali

---

## 🎯 Dopo il Setup - Prossimi Sviluppi

Una volta che tutto funziona, segui questo ordine:

### Priority HIGH:
1. **API Exercises** (2h)
   - Cursor-based pagination
   - CRUD completo con muscle groups

2. **API Programs** (3h)
   - Creazione con auto-gen Week/Workout
   - Pubblicazione con date calculations

3. **API Feedback** (2h)
   - POST con SetPerformed nested
   - Idempotency handling

### Priority MEDIUM:
4. **Frontend Trainer Dashboard** (8h)
5. **Frontend Trainee Mobile** (6h)

### Priority LOW:
6. **Frontend Admin** (4h)
7. **Testing** (6h)
8. **PWA Service Worker** (2h)

Consulta `README.md` per dettagli completi.

---

## 🆘 Help

Se incontri problemi:
1. Controlla `README.md` → Troubleshooting
2. Verifica logs in terminal
3. Consulta `QUICK_START.md` per guida step-by-step
4. Usa `npm run prisma:studio` per esplorare database

---

**🚀 Sei pronto! Segui gli step sopra e in 10 minuti avrai tutto funzionante!**
