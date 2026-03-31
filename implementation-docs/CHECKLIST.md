# ✅ CHECKLIST SVILUPPO - ZeroCento Training Platform

**Stato attuale:** ~80% completato (99h/129h - Sprint 1-5 + Sprint 7 completati)  
**Effort rimanente stimato:** ~36h  
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

- [x] **5.1** Unit test: `calculateEffectiveWeight()` con chain percentage_previous (3h) ✅ _30 Mar 2026_
- [x] **5.2** Unit test: generazione password sicura (1h) ✅ _30 Mar 2026_
- [x] **5.3** Integration test: RBAC violations — accesso cross-trainer negato (4h) ✅ _30 Mar 2026_
- [x] **5.4** Integration test: feedback CRUD completo (3h) ✅ _30 Mar 2026_
- [x] **5.5** Integration test: personal records CRUD (2h) ✅ _30 Mar 2026_
- [x] **5.6** Integration test: esercizi con relazioni (2h) ✅ _30 Mar 2026_
- [x] **5.7** E2E test: login → redirect per ruolo (2h) ✅ _30 Mar 2026_
- [x] **5.8** E2E test: trainer crea programma → pubblica → trainee lo vede (4h) ✅ _30 Mar 2026_
- [x] **5.9** E2E test: trainee completa workout con feedback (3h) ✅ _30 Mar 2026_
- [x] **5.10** Raggiungere copertura minima 80% (3h refactor + gap fill) ✅ _30 Mar 2026_

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

## Sprint 9 — Header Globale su Tutte le Schermate (~9h)

> **Obiettivo:** Ogni schermata autenticata deve wrappare il contenuto in `<DashboardLayout>` per mostrare logo, nome app, hamburger menu, e navigazione a tendina. Le pagine di autenticazione (login, forgot-password, reset-password) e le pagine di sistema (root redirect, offline) sono **escluse** intenzionalmente.

### Schermate Trainee (5)

- [x] **9.1** `trainee/dashboard` — Aggiungere `DashboardLayout` (1h)  
      File: `src/app/trainee/dashboard/page.tsx`
- [x] **9.2** `trainee/history` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainee/history/page.tsx`
- [x] **9.3** `trainee/programs/current` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainee/programs/current/page.tsx`
- [x] **9.4** `trainee/records` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainee/records/page.tsx`
- [x] **9.5** `trainee/workouts/[id]` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainee/workouts/[id]/page.tsx`

### Schermate Trainer (12)

- [x] **9.6** `trainer/exercises/new` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainer/exercises/new/page.tsx`
- [x] **9.7** `trainer/exercises/[id]/edit` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainer/exercises/[id]/edit/page.tsx`
- [x] **9.8** `trainer/programs` (lista programmi) — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainer/programs/page.tsx`
- [x] **9.9** `trainer/programs/[id]/edit` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainer/programs/[id]/edit/page.tsx`
- [x] **9.10** `trainer/programs/[id]/progress` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainer/programs/[id]/progress/page.tsx`
- [x] **9.11** `trainer/programs/[id]/publish` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainer/programs/[id]/publish/page.tsx`
- [x] **9.12** `trainer/programs/[id]/reports` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainer/programs/[id]/reports/page.tsx`
- [x] **9.13** `trainer/programs/[id]/workouts/[wId]` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainer/programs/[id]/workouts/[wId]/page.tsx`
- [x] **9.14** `trainer/trainees` (lista atleti) — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainer/trainees/page.tsx`
- [x] **9.15** `trainer/trainees/new` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainer/trainees/new/page.tsx`
- [x] **9.16** `trainer/trainees/[id]` (dettaglio atleta) — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainer/trainees/[id]/page.tsx` ✅ _31 Mar 2026_
- [x] **9.17** `trainer/trainees/[id]/records` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/trainer/trainees/[id]/records/page.tsx` ✅ _31 Mar 2026_

### Schermate Profilo (1)

- [x] **9.18** `profile/change-password` — Aggiungere `DashboardLayout` (0.5h)  
      File: `src/app/profile/change-password/page.tsx` ✅ _31 Mar 2026_
- [x] **9.19** `trainer/exercises` — Refactoring per split client/server e `DashboardLayout` (0.5h)
      File: `src/app/trainer/exercises/page.tsx`

### Schermate Admin (4)

- [x] **9.20** `admin/dashboard` — `DashboardLayout` + split client/server (0.5h)  
      File: `src/app/admin/dashboard/page.tsx` + `AdminDashboardContent.tsx` ✅ _31 Mar 2026_
- [x] **9.21** `admin/exercises` — `DashboardLayout` + `getSession()` (0.5h)  
      File: `src/app/admin/exercises/page.tsx` ✅ _31 Mar 2026_
- [x] **9.22** `admin/programs` — `DashboardLayout` + split client/server (0.5h)  
      File: `src/app/admin/programs/page.tsx` + `AdminProgramsContent.tsx` ✅ _31 Mar 2026_
- [x] **9.23** `admin/users` — `DashboardLayout` + split client/server (0.5h)  
      File: `src/app/admin/users/page.tsx` + `AdminUsersContent.tsx` ✅ _31 Mar 2026_

> **Note implementative:**
>
> **Pattern di implementazione** (usato per tutte le schermate trainee come riferimento):
>
> 1. Se `page.tsx` è già un server component → aggiungere direttamente `getSession()` + `<DashboardLayout>` attorno al JSX esistente.
> 2. Se `page.tsx` è un client component (`'use client'`) → **split in due file**:
> 3. **Tokenizzazione i18n obbligatoria** — ogni `_content.tsx` deve:
>    - Importare `useTranslation` da `react-i18next` e chiamare `const { t } = useTranslation('trainee' | 'trainer')`
>    - Sostituire **tutte** le stringhe hardcoded con `t('sezione.chiave')`
>    - Aggiungere le chiavi mancanti in **entrambi** i file `public/locales/en/<namespace>.json` e `public/locales/it/<namespace>.json`
>    - Correggere `err: any` in `err: unknown` nei blocchi catch
>    - Sostituire array hardcoded (es. nomi giorni) con `t('sezione.chiave', { returnObjects: true })`
>    - `_content.tsx` — copia del client component con la funzione rinominata (es. `FooContent`)
>    - `page.tsx` — server component che chiama `getSession()` e restituisce `<DashboardLayout user={session.user}><FooContent /></DashboardLayout>`
>
> **Recupero utente — pattern corretto:**
> ```ts
> import { getSession } from '@/lib/auth'
> import { redirect } from 'next/navigation'
> import DashboardLayout from '@/components/DashboardLayout'
>
> export default async function FooPage() {
>     const session = await getSession()
>     if (!session) redirect('/login')
>     // opzionale: role guard
>     // if (session.user.role !== 'trainer') redirect(`/${session.user.role}/dashboard`)
>     return (
>         <DashboardLayout user={session.user}>
>             {/* contenuto */}
>         </DashboardLayout>
>     )
> }
> ```
> `getSession()` (da `@/lib/auth`) usa il client Supabase server-side e arricchisce con i dati Prisma — **non usare** `createClient().auth.getUser()` che è solo client-side.
>
> **Schermate già OK:** `admin/*`, `trainer/dashboard`, `trainer/programs/new`, `profile`, `trainee/dashboard`, `trainee/history`, `trainee/programs/current`, `trainee/records`, `trainee/workouts/[id]`.

---

## Sprint 10 — Rimozione Emoji e Introduzione Icon System (~5h)

> **Obiettivo:** Eliminare completamente l'uso di emoji dall'intera implementazione (UI, componenti, navigazione, documentazione generata) e sostituirle con icone semantiche standard dalla libreria **Lucide React** (`lucide-react`).
>
> **Scope rilevato:** UI components, pagine trainer/trainee/admin, navigazione globale, modal, banner, documentazione.

### Setup Icon Library (prerequisito)

- [x] **10.1** Installare `lucide-react` come dipendenza (0.25h)
  ```
  npm install lucide-react
  ```
  Verifica: importare `import { Dumbbell } from 'lucide-react'` in un componente e confermare che TypeScript non segnali errori.

### Componenti Shared

- [x] **10.2** `DashboardLayout.tsx` — sostituire emoji nelle voci di navigazione (0.5h)  
  File: `src/components/DashboardLayout.tsx`  
  Rimozione: `📋` `🏋️` `👤` `📅` `🏆` `📊` `💪`  
  Il campo `icon` del tipo `NavItem` deve diventare `icon: ReactNode` (JSX) invece di `string`.  
  Mapping sostituzioni:

  | Emoji | Lucide icon         | Uso                   |
  | ----- | ------------------- | --------------------- |
  | `📋`   | `<ClipboardList />` | Programmi             |
  | `🏋️`   | `<Dumbbell />`      | Libreria Esercizi     |
  | `👤`   | `<User />`          | Profilo               |
  | `📅`   | `<CalendarDays />`  | Programma Attivo      |
  | `🏆`   | `<Trophy />`        | Massimali             |
  | `📊`   | `<BarChart2 />`     | Storico / Statistiche |
  | `💪`   | `<Dumbbell />`      | Esercizi Admin        |

- [x] **10.3** `WeekTypeBanner.tsx` — sostituire emoji week-type (0.25h)  
  File: `src/components/WeekTypeBanner.tsx`  
  Rimozione: `📋` (normal), `🔥` (test), `💆` (deload)  
  Mapping:

  | Emoji | Lucide icon         | Week type |
  | ----- | ------------------- | --------- |
  | `📋`   | `<ClipboardList />` | normal    |
  | `🔥`   | `<Flame />`         | test      |
  | `💆`   | `<Wind />`          | deload    |

- [x] **10.4** `ConfirmationModal.tsx` — sostituire emoji alert icon (0.25h)  
  File: `src/components/ConfirmationModal.tsx`  
  Rimozione: `⚠️` (warning), `⚡` (danger/action)  
  Mapping:

  | Emoji | Lucide icon         | Tipo    |
  | ----- | ------------------- | ------- |
  | `⚠️`   | `<AlertTriangle />` | warning |
  | `⚡`   | `<Zap />`           | danger  |

- [x] **10.5** `UserCreateModal.tsx` — sostituire emoji inline (0.25h)  
  File: `src/components/UserCreateModal.tsx`  
  Rimozione: `✅` (successo), `⚠️` (avvertimento password)  
  Mapping: `✅` → `<CheckCircle2 />`, `⚠️` → `<AlertTriangle />`

- [x] **10.6** `ProgramsTable.tsx` — sostituire emoji tab stato programma (0.25h)  
  File: `src/components/ProgramsTable.tsx`  
  Rimozione: `📝` (draft), `✅` (active), `🏁` (completed), `🔍` in placeholder  
  Mapping: `📝` → `<FileEdit />`, `✅` → `<CheckCircle2 />`, `🏁` → `<FlagTriangleRight />`, rimuovere `🔍` dal placeholder (il campo search ha già contesto semantico)

- [x] **10.7** `StatCard.tsx` — aggiornare tipo prop `icon` da `string` a `ReactNode` (0.5h)  
  File: `src/components/StatCard.tsx`  
  Il componente riceve `icon?: string` — cambiare a `icon?: ReactNode` e aggiornare la regione di rendering.  
  Tutti i call site (trainee dashboard, admin dashboard, trainer dashboard, components-showcase) dovranno passare il JSX dell'icona invece dell'emoji.

### Pagine Trainer

- [x] **10.8** `trainer/dashboard/page.tsx` — sostituire tutte le emoji (0.5h)  
  File: `src/app/trainer/dashboard/page.tsx`  
  Rimozione: `📋` `🏋️` `💬` `➕` `👤` nei link azione rapida e nelle `StatCard`  
  Mapping: `💬` → `<MessageSquare />`, `➕` → `<Plus />`

- [x] **10.9** `trainer/programs/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainer/programs/_content.tsx`  
  Rimozione: `🔍` nel placeholder, `➕` nel bottone, `📝` `✅` nei tab, `🗑️` nel bottone elimina  
  Mapping: `➕` → `<Plus />`, `🗑️` → `<Trash2 />`; rimuovere `🔍` dal placeholder

- [x] **10.10** `trainer/exercises/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainer/exercises/_content.tsx`  
  Rimozione: `🔍` nel placeholder, `➕` nel bottone  
  Mapping: `➕` → `<Plus />`; rimuovere `🔍` dal placeholder

- [x] **10.11** `trainer/exercises/new/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainer/exercises/new/_content.tsx`  
  Rimozione: `🗑️` nel bottone rimozione set  
  Mapping: `🗑️` → `<Trash2 />`

- [x] **10.12** `trainer/exercises/[id]/edit/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainer/exercises/[id]/edit/_content.tsx`  
  Rimozione: `🗑️` nel bottone rimozione set  
  Mapping: `🗑️` → `<Trash2 />`

- [x] **10.13** `trainer/programs/[id]/edit/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainer/programs/[id]/edit/_content.tsx`  
  Rimozione: `📈` `🧘` nei tag week type, `⚠️` nell'avviso  
  Mapping: `📈` → `<TrendingUp />`, `🧘` → `<Wind />`, `⚠️` → `<AlertTriangle />`

- [x] **10.14** `trainer/programs/[id]/edit/EditProgramMetadata.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainer/programs/[id]/edit/EditProgramMetadata.tsx`  
  Rimozione: `✏️` nel titolo sezione, `⚠️` × 3 negli avvisi, `📊` nel riepilogo  
  Mapping: `✏️` → `<Pencil />`, `⚠️` → `<AlertTriangle />`, `📊` → `<BarChart2 />`

- [x] **10.15** `trainer/programs/new/NewProgramContent.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainer/programs/new/NewProgramContent.tsx`  
  Rimozione: `📊` nel riepilogo  
  Mapping: `📊` → `<BarChart2 />`

- [x] **10.16** `trainer/programs/[id]/workouts/[wId]/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx`  
  Rimozione: `📝` × 2 (note), `✏️` (edit), `🗑️` (delete), `💪` (empty state)  
  Mapping: `📝` → `<FileText />`, `✏️` → `<Pencil />`, `🗑️` → `<Trash2 />`, `💪` → `<Dumbbell />`

- [x] **10.17** `trainer/programs/[id]/progress/_content.tsx` — sostituire emoji inline (0.5h)  
  File: `src/app/trainer/programs/[id]/progress/_content.tsx`  
  Rimozione: `📊` × 2 (titoli sezioni), `📈` (link report), `🎯` (RPE), `✅` (completamento)  
  Mapping: `📊` → `<BarChart2 />`, `📈` → `<TrendingUp />`, `🎯` → `<Target />`, `✅` → `<CheckCircle2 />`

- [x] **10.18** `trainer/trainees/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainer/trainees/_content.tsx`  
  Rimozione: `🔍` nel placeholder, `➕` nel bottone  
  Mapping: `➕` → `<Plus />`; rimuovere `🔍` dal placeholder

- [x] **10.19** `trainer/trainees/[id]/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainer/trainees/[id]/_content.tsx`  
  Rimozione: `➕` nel bottone crea programma  
  Mapping: `➕` → `<Plus />`

- [x] **10.20** `trainer/trainees/[id]/records/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainer/trainees/[id]/records/_content.tsx`  
  Rimozione: `➕` nel bottone, `💪` nell'empty state  
  Mapping: `➕` → `<Plus />`, `💪` → `<Dumbbell />`

### Pagine Trainee

- [ ] **10.21** `trainee/dashboard/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainee/dashboard/_content.tsx`  
  Rimozione: `💪` (empty state hero), `🏆` `📊` `👤` `📅` nelle `StatCard`  
  Mapping: `💪` → `<Dumbbell />` + classe CSS `w-16 h-16`

- [ ] **10.22** `trainee/history/_content.tsx` — sostituire emoji empty state (0.25h)  
  File: `src/app/trainee/history/_content.tsx`  
  Rimozione: `📋` (empty state `text-5xl`)  
  Mapping: `📋` → `<ClipboardList />` + classe `w-16 h-16 text-gray-300`

- [ ] **10.23** `trainee/records/_content.tsx` — sostituire emoji empty state (0.25h)  
  File: `src/app/trainee/records/_content.tsx`  
  Rimozione: `📊` (empty state `text-5xl`)  
  Mapping: `📊` → `<BarChart2 />` + classe `w-16 h-16 text-gray-300`

- [ ] **10.24** `trainee/programs/current/_content.tsx` — sostituire emoji week type (0.25h)  
  File: `src/app/trainee/programs/current/_content.tsx`  
  Rimozione: `📈` nel badge week type "Loading"  
  Mapping: `📈` → `<TrendingUp />`

- [ ] **10.25** `trainee/workouts/[id]/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainee/workouts/[id]/_content.tsx`  
  Rimozione: `📝` (note esercizio)  
  Mapping: `📝` → `<FileText />`

### Pagine Admin

- [ ] **10.26** `admin/dashboard/_content.tsx` — sostituire emoji nelle `StatCard` e nelle quick actions (0.25h)  
  File: `src/app/admin/dashboard/_content.tsx`  
  Rimozione: `🏋️` `💪` `📊` `🏃` nelle `StatCard`, `💪` `📋` `📊` nelle quick actions

- [ ] **10.27** `admin/exercises/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/admin/exercises/_content.tsx`  
  Rimozione: `💡` nel banner informativo  
  Mapping: `💡` → `<Lightbulb />`

### Pagina Trainer Nuovi atleti

- [ ] **10.28** `trainer/trainees/new/_content.tsx` — sostituire emoji success state (0.25h)  
  File: `src/app/trainer/trainees/new/_content.tsx`  
  Rimozione: `✅` (success state `text-5xl`)  
  Mapping: `✅` → `<CheckCircle2 />` + classe `w-16 h-16 text-green-500`

### Pagina Showcase

- [ ] **10.29** `components-showcase/page.tsx` — aggiornare esempi `StatCard` (0.25h)  
  File: `src/app/components-showcase/page.tsx`  
  Rimozione: `💪` `⭐` `📋` `📊` `🏆` nelle `StatCard` di demo  
  Sostituire con icone Lucide corrispondenti dopo il task 10.7 sul tipo `ReactNode`

---

> **Nota tecnica — Pattern di rendering icone:**
>
> Dopo la migrazione, il prop `icon` di `StatCard` e i campi `icon` in `DashboardLayout` devono accettare `ReactNode`:
> ```tsx
> import { Dumbbell } from 'lucide-react'
>
> // Prima (emoji string)
> <StatCard icon="💪" ... />
>
> // Dopo (ReactNode)
> <StatCard icon={<Dumbbell className="w-5 h-5" />} ... />
> ```
> Dimensioni standard: `w-5 h-5` per icone inline, `w-6 h-6` per navigazione, `w-16 h-16` per empty state hero.

---

## Riepilogo per priorità

| Priorità   | Sprint    | Task        | Effort stimato |
| ---------- | --------- | ----------- | -------------- |
| Critico    | Sprint 1  | 1.1–1.6     | ~4h            |
| Critico    | Sprint 2  | 2.1–2.7     | ~29h           |
| Critico    | Sprint 3  | 3.1         | ~8h            |
| Alto       | Sprint 4  | 4.1–4.5     | ~21h           |
| Alto       | Sprint 5  | 5.1–5.10    | ~27h           |
| Medio      | Sprint 6  | 6.1–6.7     | ~5h            |
| Medio      | Sprint 7  | 7.1–7.6     | ~23h           |
| Basso      | Sprint 8  | 8.1–8.7     | ~11h           |
| Alto       | Sprint 9  | 9.1–9.23    | ~9h            |
| Medio      | Sprint 10 | 10.1–10.29  | ~5h            |
| **Totale** |           | **96 task** | **~143h**      |

---

*Ultimo aggiornamento: 31 Marzo 2026*
