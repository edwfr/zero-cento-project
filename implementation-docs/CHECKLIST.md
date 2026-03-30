# ✅ CHECKLIST SVILUPPO - ZeroCento Training Platform

**Stato attuale:** ~55% completato (71h/129h - Sprint 1 + 2 + 3 + 4 + Sprint 7.1-7.6 completati)  
**Effort rimanente stimato:** ~58h  
**Riferimenti:** [SYSTEM_REVIEW.md](../SYSTEM_REVIEW.md) · [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) · [CHANGELOG.md](./CHANGELOG.md)

---

## Come usare questa checklist

- Spunta `[x]` quando un task è completato
- Annota la data e un breve commento nel [CHANGELOG.md](./CHANGELOG.md)
- Le priorità seguono il backlog del [SYSTEM_REVIEW.md § 9](../SYSTEM_REVIEW.md#9-task-backlog-completo)

---

## Sprint 1 — Fix Critici & Sicurezza (~4h)

- [x] **1.1** Fix RBAC bypass personal records — aggiungere ownership check trainer-trainee  
      File: `src/app/api/personal-records/route.ts` · Dettagli: [SYSTEM_REVIEW § 3.1](../SYSTEM_REVIEW.md#31-critico---rbac-bypass-su-personal-records)
- [x] **1.2** Validazione range personal-record schema (peso ≤ 1000, reps intero ≤ 100, date non future)  
      File: `src/schemas/personal-record.ts` · Dettagli: [SYSTEM_REVIEW § 3.3](../SYSTEM_REVIEW.md#33-medio---validazione-input-mancante)
- [x] **1.3** Validazione lunghezza parametro search (2-100 char) su exercises, programs, feedback  
      File: `src/app/api/exercises/route.ts`, `programs/route.ts`, `feedback/route.ts` · Dettagli: [SYSTEM_REVIEW § 3.4](../SYSTEM_REVIEW.md#34-medio---search-parameter-length-non-validata)
- [x] **1.4** Reject coefficiente esercizi > 3.0 con HTTP 400  
      File: `src/app/api/exercises/route.ts` · Dettagli: [SYSTEM_REVIEW § 3.5](../SYSTEM_REVIEW.md#35-basso---coefficiente-esercizi-solo-warning)
- [x] **1.5** Fix errori TypeScript test integrazione (NextRequest signal)  
      File: `tests/integration/programs.test.ts`, `tests/integration/users.test.ts` · Dettagli: [SYSTEM_REVIEW § 6](../SYSTEM_REVIEW.md#6-errori-di-compilazione)
- [x] **1.6** Disabilitare form durante submit (~8 componenti)  
      Dettagli: [SYSTEM_REVIEW § 4.5](../SYSTEM_REVIEW.md#45-form-non-disabilitati-durante-submit)

---

## Sprint 2 — API Mancanti + Program Builder (~29h)

### API Endpoints

- [x] **2.1** `POST /api/feedback` — creazione feedback trainee con nested SetPerformed (3h)  
      Spec: [NEXT_ACTIONS.md § 7](./NEXT_ACTIONS.md#7-post-apifeedback---creazione-feedback-trainee-3h) · Design: [design/03_backend_api.md](../design/03_backend_api.md)
- [x] **2.2** `GET /api/trainee/workouts/[id]` — vista workout con peso effettivo pre-calcolato (4h)  
      Spec: [NEXT_ACTIONS.md § 8](./NEXT_ACTIONS.md#8-get-apitraineeworkoutsid---vista-workout-4h)
- [x] **2.3** `POST /api/programs/[id]/complete` — completamento manuale programma (2h)  
      Spec: [NEXT_ACTIONS.md § 9](./NEXT_ACTIONS.md#9-post-apiprogramsidcomplete---completamento-manuale-2h)
- [x] **2.4** `PATCH /api/weeks/[id]` — config tipo settimana post-pubblicazione (2h)  
      Spec: [NEXT_ACTIONS.md § 10](./NEXT_ACTIONS.md#10-patch-apiweeksid---config-tipo-settimana-2h)

### Frontend — Program Builder Wizard (Trainer)

- [x] **2.5** Workout Detail Editor — step 3 wizard (8h)  
      File: `src/app/trainer/programs/[id]/workouts/[wId]/page.tsx`  
      Spec: [NEXT_ACTIONS.md § 11](./NEXT_ACTIONS.md#11-workout-detail-editor---step-3-wizard-8h)
- [x] **2.6** Publish Programma — step 4 wizard (4h)  
      File: `src/app/trainer/programs/[id]/publish/page.tsx`  
      Spec: [NEXT_ACTIONS.md § 12](./NEXT_ACTIONS.md#12-publish-programma---step-4-wizard-4h)
- [x] **2.7** Edit Programma (4h)  
      File: `src/app/trainer/programs/[id]/edit/page.tsx`  
      Spec: [NEXT_ACTIONS.md § 14](./NEXT_ACTIONS.md#14-edit-programma-4h)

---

## Sprint 3 — Trainee Workout View + Feedback (~8h)

- [x] **3.1** Workout View con card navigation — mobile-first, swipeable cards, input serie (8h)  
      File: `src/app/trainee/workouts/[id]/page.tsx`  
      Include: integrazione `FeedbackForm`, auto-save localStorage, YouTube embed  
      Spec: [NEXT_ACTIONS.md § 19](./NEXT_ACTIONS.md#19-workout-view-con-card-navigation-8h) · Dipende da: **2.1**, **2.2**

---

## Sprint 4 — Pagine Trainer Rimanenti (~21h)

- [x] **4.1** Edit Esercizio (4h)  
      File: `src/app/trainer/exercises/[id]/edit/page.tsx`
- [x] **4.2** Progress Programma — dashboard settimane, KPI, grafici (4h)  
      File: `src/app/trainer/programs/[id]/progress/page.tsx`
- [x] **4.3** Reports Programma — SBD, volume per muscle group, distribuzione RPE (6h)  
      File: `src/app/trainer/programs/[id]/reports/page.tsx`
- [x] **4.4** Dettaglio Trainee — anagrafica, programmi assegnati, link massimali (4h)  
      File: `src/app/trainer/trainees/[id]/page.tsx`
- [x] **4.5** Massimali Trainee — tabella RM, aggiornamento (3h)  
      File: `src/app/trainer/trainees/[id]/records/page.tsx`

---

## Sprint 5 — Testing Target 80% (~27h)

- [ ] **5.1** Unit test: `calculateEffectiveWeight()` con chain percentage_previous (3h)
- [ ] **5.2** Unit test: generazione password sicura (1h)
- [ ] **5.3** Integration test: RBAC violations — accesso cross-trainer negato (4h)
- [ ] **5.4** Integration test: feedback CRUD completo (3h)
- [ ] **5.5** Integration test: personal records CRUD (2h)
- [ ] **5.6** Integration test: esercizi con relazioni (2h)
- [ ] **5.7** E2E test: login → redirect per ruolo (2h)
- [ ] **5.8** E2E test: trainer crea programma → pubblica → trainee lo vede (4h)
- [ ] **5.9** E2E test: trainee completa workout con feedback (3h)
- [ ] **5.10** Raggiungere copertura minima 80% (3h refactor + gap fill)

---

## Sprint 6 — CI/CD & Deploy (~5h)

- [ ] **6.1** Aggiungere script `prisma:migrate:prod` a `package.json` (oppure usare `npx prisma migrate deploy` nel workflow)
- [ ] **6.2** Aggiungere step `npm run build` nel job test CI  
      File: `.github/workflows/ci.yml`
- [ ] **6.3** Creare `vercel.json` con build config e route rewrites
- [ ] **6.4** Configurare secrets GitHub: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `STAGING_URL`, `PRODUCTION_DATABASE_URL`
- [ ] **6.5** Collegare repo GitHub a Vercel per auto-deploy + preview su PR
- [ ] **6.6** Completare integrazione Sentry (2h)
- [ ] **6.7** Configurare UptimeRobot su `/api/health`

---

## Sprint 7 — i18n & UX Polish (~23h)

- [x] **7.1** Integrare `useTranslation()` in tutti i componenti (8h) ✅ _30 Mar 2026_
- [x] **7.2** Rimuovere tutte le stringhe hardcoded italiane (4h) ✅ _30 Mar 2026_
- [x] **7.3** Standardizzare formato date con locale i18n (2h) ✅ _30 Mar 2026_
- [x] **7.4** Aggiungere skeleton loader al posto dei spinner (4h) ✅ _30 Mar 2026_
- [x] **7.5** ARIA labels e focus management su modali (3h) ✅ _30 Mar 2026_
- [x] **7.6** Standardizzare formato risposte API — struttura `{ items, pagination? }` uniforme (4h) ✅ _30 Mar 2026_

---

## Sprint 8 — PWA & Final Polish (~11h)

- [ ] **8.1** Verificare/completare integrazione service worker con Serwist (2h)
- [ ] **8.2** Sostituire icone placeholder con loghi reali (1h)
- [ ] **8.3** Testare installazione PWA su mobile (1h)
- [ ] **8.4** Implementare strategia cache offline per workout attivo (4h)
- [ ] **8.5** Aggiungere indice su `ExerciseFeedback.traineeId` (15min)
- [ ] **8.6** Aggiungere indice composto su `SetPerformed(feedbackId, setNumber)` (15min)
- [ ] **8.7** Caching admin reports con TTL 5min (1h)

---

## Riepilogo per priorità

| Priorità   | Sprint   | Task        | Effort stimato |
| ---------- | -------- | ----------- | -------------- |
| 🔴 Critico  | Sprint 1 | 1.1–1.6     | ~4h            |
| 🔴 Critico  | Sprint 2 | 2.1–2.7     | ~29h           |
| 🔴 Critico  | Sprint 3 | 3.1         | ~8h            |
| 🟠 Alto     | Sprint 4 | 4.1–4.5     | ~21h           |
| 🟠 Alto     | Sprint 5 | 5.1–5.10    | ~27h           |
| 🟡 Medio    | Sprint 6 | 6.1–6.7     | ~5h            |
| 🟡 Medio    | Sprint 7 | 7.1–7.6     | ~23h           |
| 🔵 Basso    | Sprint 8 | 8.1–8.7     | ~11h           |
| **Totale** |          | **49 task** | **~129h**      |

---

*Ultimo aggiornamento: 30 Marzo 2026*
