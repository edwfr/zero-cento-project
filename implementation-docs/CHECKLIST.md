# ✅ CHECKLIST SVILUPPO - ZeroCento Training Platform

**Posizionamento prodotto:** training management platform trainer-led  
**Stato attuale:** 165/175 task completati (~94%)  
**Task rimanenti:** 10 (Sprint 6: 5 task, Sprint 8: 7 task, Sprint 11: 1 task, ma 3 già completati del TM)  
**Riferimenti:** [system-review.md](./system-review.md) · [CHANGELOG.md](./CHANGELOG.md)

---

## Come usare questa checklist

- Spunta `[x]` quando un task è completato
- Annota la data e un breve commento nel [CHANGELOG.md](./CHANGELOG.md)
- Le priorità seguono il backlog del [system-review.md](./system-review.md)

---

## Sprint 1 — Fix Critici & Sicurezza (~4h)

- [x] **1.1** Fix RBAC bypass personal records — aggiungere ownership check trainer-trainee  
      File: `src/app/api/personal-records/route.ts` · Dettagli: [system-review § 3.1](./system-review.md#31-critico---rbac-bypass-su-personal-records)
- [x] **1.2** Validazione range personal-record schema (peso ≤ 1000, reps intero ≤ 100, date non future)  
      File: `src/schemas/personal-record.ts` · Dettagli: [system-review § 3.3](./system-review.md#33-medio---validazione-input-mancante)
- [x] **1.3** Validazione lunghezza parametro search (2-100 char) su exercises, programs, feedback  
      File: `src/app/api/exercises/route.ts`, `programs/route.ts`, `feedback/route.ts` · Dettagli: [system-review § 3.4](./system-review.md#34-medio---search-parameter-length-non-validata)
- [x] **1.4** Reject coefficiente esercizi > 3.0 con HTTP 400  
      File: `src/app/api/exercises/route.ts` · Dettagli: [system-review § 3.5](./system-review.md#35-basso---coefficiente-esercizi-solo-warning)
- [x] **1.5** Fix errori TypeScript test integrazione (NextRequest signal)  
      File: `tests/integration/programs.test.ts`, `tests/integration/users.test.ts` · Dettagli: [system-review § 6](./system-review.md#6-errori-di-compilazione)
- [x] **1.6** Disabilitare form durante submit (~8 componenti)  
      Dettagli: [system-review § 4.5](./system-review.md#45-form-non-disabilitati-durante-submit)

---

## Sprint 2 — API Mancanti + Program Builder (~29h)

### API Endpoints

- [x] **2.1** `POST /api/feedback` — creazione feedback trainee con nested SetPerformed (3h)  
      Spec: [next-actions.md § 7](./next-actions.md#7-post-apifeedback---creazione-feedback-trainee-3h) · Design: [design/03-backend-api.md](../design/03-backend-api.md)
- [x] **2.2** `GET /api/trainee/workouts/[id]` — vista workout con peso effettivo pre-calcolato (4h) + reidratazione dei feedback storici per esercizio anche fuori dalla data odierna, con merge corretto di snapshot multi-giorno sulle serie completate ✅ _30 Apr 2026_  
      Spec: [next-actions.md § 8](./next-actions.md#8-get-apitraineeworkoutsid---vista-workout-4h)
- [x] **2.3** `POST /api/programs/[id]/complete` — completamento manuale programma (2h)  
      Spec: [next-actions.md § 9](./next-actions.md#9-post-apiprogramsidcomplete---completamento-manuale-2h)
- [x] **2.4** `PATCH /api/weeks/[id]` — config tipo settimana post-pubblicazione (2h)  
      Spec: [next-actions.md § 10](./next-actions.md#10-patch-apiweeksid---config-tipo-settimana-2h)

### Frontend — Program Builder Wizard (Trainer)

- [x] **2.5** Workout Detail Editor — step 3 wizard (8h)  
      File: `src/app/trainer/programs/[id]/workouts/[wId]/page.tsx`  
      Spec: [next-actions.md § 11](./next-actions.md#11-workout-detail-editor---step-3-wizard-8h)
- [x] **2.6** Publish Programma — step 4 wizard (4h) + ripristino progress indicator a 5 step nel publish wizard ✅ _2 Mag 2026_  
      File: `src/app/trainer/programs/[id]/publish/page.tsx`  
      Spec: [next-actions.md § 12](./next-actions.md#12-publish-programma---step-4-wizard-4h)
- [x] **2.7** Edit Programma (4h)  
      File: `src/app/trainer/programs/[id]/edit/page.tsx`  
      Spec: [next-actions.md § 14](./next-actions.md#14-edit-programma-4h)

---

## Sprint 3 — Trainee Workout View + Feedback (~8h)

- [x] **3.1** Workout View con card navigation — mobile-first, swipeable cards, input serie (8h)  
      File: `src/app/trainee/workouts/[id]/page.tsx`  
      Include: integrazione `FeedbackForm`, auto-save localStorage, autosave immediato della singola spunta con update cascata completion, submit finale che chiude comunque il workout e propaga week/program senza forzare completi gli esercizi mancanti, chiusura corretta di settimana/scheda ignorando workout vuoti, YouTube embed, warning inline nel riepilogo per serie non completate con jump diretto all'esercizio, warning distinti e cliccabili per ogni esercizio senza dati, fix ancoraggio footer step counter/azione in basso durante scroll ✅ _30 Apr 2026, 1 Mag 2026_  
      Spec: [next-actions.md § 19](./next-actions.md#19-workout-view-con-card-navigation-8h) · Dipende da: **2.1**, **2.2**
- [x] **3.2** Workout recap panel nel focus mode trainee (header icon + bottom sheet + API aggregata DB) ✅ _1 Mag 2026_  
      File: `src/app/trainee/workouts/[id]/_content.tsx`, `src/components/WorkoutRecapPanel.tsx`, `src/app/api/trainee/workouts/[id]/recap/route.ts`, `src/lib/workout-recap.ts`, `tests/unit/workout-recap.test.ts`
- [x] **3.3** Previous week panel nel focus mode trainee (header icon condizionale + bottom sheet + API prev-week + test) ✅ _1 Mag 2026_  
      File: `src/app/trainee/workouts/[id]/_content.tsx`, `src/components/PrevWeekPanel.tsx`, `src/app/api/trainee/workouts/[id]/prev-week/route.ts`, `src/lib/workout-recap.ts`, `tests/unit/prev-week-panel.test.tsx`, `tests/integration/trainee-workout-prev-week.test.ts`

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
- [x] **5.10** Raggiungere copertura minima 80% (3h refactor + gap fill) + stabilizzazione regressione test integrazione completion workout exercise ✅ _30 Mar 2026, 1 Mag 2026_

---

## Sprint 6 — CI/CD & Deploy (~5h)

- [x] **6.1** Aggiungere script `prisma:migrate:prod` a `package.json` (oppure usare `npx prisma migrate deploy` nel workflow) ✅ _presente in package.json_
- [ ] **6.2** Aggiungere step `npm run build` nel job test CI  
      File: `.github/workflows/ci.yml`
- [ ] **6.3** Creare `vercel.json` con build config e route rewrites
- [ ] **6.4** Configurare secrets GitHub: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `STAGING_URL`, `PRODUCTION_DATABASE_URL`
- [ ] **6.5** Collegare repo GitHub a Vercel per auto-deploy + preview su PR
- [x] **6.6** Completare integrazione Sentry (2h) ✅ _20 Apr 2026_
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

- [x] **9.1** `trainee/dashboard` — Aggiungere `DashboardLayout` (1h) + allineare il programma attivo allo `status` reale di `training_programs` senza deduzioni lato read path, con `nextWorkout` uguale al primo workout non completo in ordine del programma attivo ✅ _30 Apr 2026_  
      File: `src/app/trainee/dashboard/page.tsx`
- [x] **9.2** `trainee/history` — Aggiungere `DashboardLayout` (0.5h) + mostrare badge e conteggi solo da `training_programs.status` senza fetch progress aggiuntivi ✅ _30 Apr 2026_  
      File: `src/app/trainee/history/page.tsx`
- [x] **9.3** `trainee/programs/current` — Aggiungere `DashboardLayout` (0.5h) + preservare `programId` esplicito dalla dashboard per evitare mismatch con più programmi attivi ✅ _29 Apr 2026_  
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

- [x] **10.21** `trainee/dashboard/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainee/dashboard/_content.tsx`  
  Rimozione: `💪` (empty state hero), `🏆` `📊` `👤` `📅` nelle `StatCard`  
  Mapping: `💪` → `<Dumbbell />` + classe CSS `w-16 h-16`

- [x] **10.22** `trainee/history/_content.tsx` — sostituire emoji empty state (0.25h)  
  File: `src/app/trainee/history/_content.tsx`  
  Rimozione: `📋` (empty state `text-5xl`)  
  Mapping: `📋` → `<ClipboardList />` + classe `w-16 h-16 text-gray-300`

- [x] **10.23** `trainee/records/_content.tsx` — sostituire emoji empty state (0.25h)  
  File: `src/app/trainee/records/_content.tsx`  
  Rimozione: `📊` (empty state `text-5xl`)  
  Mapping: `📊` → `<BarChart2 />` + classe `w-16 h-16 text-gray-300`

- [x] **10.24** `trainee/programs/current/_content.tsx` — sostituire emoji week type (0.25h)  
  File: `src/app/trainee/programs/current/_content.tsx`  
  Rimozione: `📈` nel badge week type "Loading"  
  Mapping: `📈` → `<TrendingUp />`

- [x] **10.25** `trainee/workouts/[id]/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/trainee/workouts/[id]/_content.tsx`  
  Rimozione: `📝` (note esercizio)  
  Mapping: `📝` → `<FileText />`

### Pagine Admin

- [x] **10.26** `admin/dashboard/_content.tsx` — sostituire emoji nelle `StatCard` e nelle quick actions (0.25h)  
  File: `src/app/admin/dashboard/_content.tsx`  
  Rimozione: `🏋️` `💪` `📊` `🏃` nelle `StatCard`, `💪` `📋` `📊` nelle quick actions

- [x] **10.27** `admin/exercises/_content.tsx` — sostituire emoji inline (0.25h)  
  File: `src/app/admin/exercises/_content.tsx`  
  Rimozione: `💡` nel banner informativo  
  Mapping: `💡` → `<Lightbulb />`

### Pagina Trainer Nuovi atleti

- [x] **10.28** `trainer/trainees/new/_content.tsx` — sostituire emoji success state (0.25h)  
  File: `src/app/trainer/trainees/new/_content.tsx`  
  Rimozione: `✅` (success state `text-5xl`)  
  Mapping: `✅` → `<CheckCircle2 />` + classe `w-16 h-16 text-green-500`

### Pagina Showcase

- [x] **10.29** `components-showcase/page.tsx` — aggiornare esempi `StatCard` (0.25h)  
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

---

## Sprint 11 — API Error i18n: Option A (~15h)

> **Obiettivo:** Eliminare completamente la dipendenza del frontend dalle stringhe di errore in English hardcodate nelle API routes. Le route restituiscono un campo semantico `error.key` (es. `"exercise.notFound"`); il frontend traduce la chiave tramite il namespace i18n `errors`. Il campo `error.message` rimane per debug/logging ma non viene mai mostrato in UI.
>
> **Pattern API (dopo la modifica):**
> ```ts
> // route.ts
> return apiError('NOT_FOUND', 'Exercise not found', 404, undefined, 'exercise.notFound')
> //                                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^
> //                                                              nuovo parametro key
> ```
>
> **Pattern Frontend (dopo la modifica):**
> ```tsx
> // _content.tsx / componente
> import { getApiErrorMessage } from '@/lib/api-error'
>
> const msg = getApiErrorMessage(data, t('exercises.createError'), t)
> // ↳ usa data.error.key per t(key, {ns:'errors'}) se presente, altrimenti usa il fallback
> ```
>
> **Riferimento chiavi `errors` namespace (completo):**
>
> | Chiave | IT | EN |
> |--------|----|----|
> | `auth.required` | Autenticazione richiesta | Authentication required |
> | `auth.accessDenied` | Accesso negato | Access denied |
> | `exercise.notFound` | Esercizio non trovato | Exercise not found |
> | `exercise.nameExists` | Un esercizio con questo nome esiste già | An exercise with this name already exists |
> | `exercise.modifyDenied` | Puoi modificare solo gli esercizi che hai creato | You can only modify exercises you created |
> | `exercise.deleteDenied` | Puoi eliminare solo gli esercizi che hai creato | You can only delete exercises you created |
> | `feedback.notFound` | Feedback non trovato | Feedback not found |
> | `feedback.createDenied` | Puoi creare feedback solo per i tuoi workout | You can only create feedback for your own workouts |
> | `feedback.modifyDenied` | Puoi modificare solo il tuo feedback | You can only modify your own feedback |
> | `feedback.viewDenied` | Puoi visualizzare solo il feedback dei tuoi atleti | You can only view feedback from your trainees |
> | `feedback.viewOwnDenied` | Puoi visualizzare solo il tuo feedback | You can only view your own feedback |
> | `movementPattern.notFound` | Schema motorio non trovato | Movement pattern not found |
> | `movementPattern.nameExists` | Uno schema motorio con questo nome esiste già | A movement pattern with this name already exists |
> | `muscleGroup.notFound` | Gruppo muscolare non trovato | Muscle group not found |
> | `muscleGroup.someNotFound` | Uno o più gruppi muscolari non trovati | One or more muscle groups not found |
> | `muscleGroup.nameExists` | Un gruppo muscolare con questo nome esiste già | A muscle group with this name already exists |
> | `personalRecord.notFound` | Massimale non trovato | Personal record not found |
> | `personalRecord.createDenied` | Puoi creare massimali solo per i tuoi atleti | You can only create records for your own trainees |
> | `personalRecord.updateDenied` | Puoi aggiornare i massimali solo dei tuoi atleti | You can only update records for your own trainees |
> | `personalRecord.deleteDenied` | Puoi eliminare i massimali solo dei tuoi atleti | You can only delete records for your own trainees |
> | `program.notFound` | Programma non trovato | Program not found |
> | `program.createDenied` | Puoi creare programmi solo per i tuoi atleti | You can only create programs for your own trainees |
> | `program.assignDenied` | Puoi assegnare programmi solo ai tuoi atleti | You can only assign programs to your own trainees |
> | `program.modifyDenied` | Puoi modificare solo i tuoi programmi | You can only modify your own programs |
> | `program.deleteDenied` | Puoi eliminare solo i tuoi programmi | You can only delete your own programs |
> | `program.publishDenied` | Puoi pubblicare solo i tuoi programmi | You can only publish your own programs |
> | `program.completeDenied` | Puoi completare solo i tuoi programmi | You can only complete your own programs |
> | `program.viewDenied` | Puoi visualizzare solo i tuoi programmi | You can only view your own programs |
> | `program.viewAssignedDenied` | Puoi visualizzare solo i programmi assegnati a te | You can only view programs assigned to you |
> | `program.alreadyCompleted` | Il programma è già completato | Program is already completed |
> | `program.alreadyPublished` | Il programma è già pubblicato o completato | Program is already published or completed |
> | `program.cannotCompleteDraft` | Non puoi completare un programma in bozza. Pubblicalo prima. | Cannot complete a draft program. Publish it first. |
> | `trainee.notFound` | Atleta non trovato | Trainee not found |
> | `trainer.notFound` | Trainer non trovato | Trainer not found |
> | `user.notFound` | Utente non trovato | User not found |
> | `user.emailExists` | Email già in uso | Email already exists |
> | `user.cannotCreateAdmin` | Non è possibile creare utenti admin | Cannot create admin users |
> | `user.cannotDeleteAdmin` | Non è possibile eliminare utenti admin | Cannot delete admin users |
> | `user.cannotModifyStatus` | Non è possibile modificare lo stato di questo utente | Cannot modify user status |
> | `user.canOnlyActivateTrainee` | È possibile attivare solo account atleta | Can only activate trainee accounts |
> | `user.canOnlyDeactivateTrainee` | È possibile disattivare solo account atleta | Can only deactivate trainee accounts |
> | `user.onlyAdminCreateTrainer` | Solo gli admin possono creare trainer | Only admins can create trainers |
> | `user.onlyAdminTrainerCreateTrainee` | Solo admin e trainer possono creare atleti | Only admins and trainers can create trainees |
> | `week.notFound` | Settimana non trovata | Week not found |
> | `week.modifyDenied` | Puoi modificare solo le settimane dei tuoi programmi | You can only modify weeks from your own programs |
> | `workout.notFound` | Workout non trovato | Workout not found |
> | `workout.notFoundInProgram` | Workout non trovato in questo programma | Workout not found in this program |
> | `workout.accessDenied` | Puoi accedere solo ai tuoi workout | You can only access your own workouts |
> | `workout.exercisesNotFound` | Uno o più esercizi non trovati in questo workout | One or more exercises not found in this workout |
> | `workoutExercise.notFound` | Esercizio workout non trovato | Workout exercise not found |
> | `validation.invalidInput` | Dati non validi | Invalid input |
> | `validation.invalidFilterParams` | Parametri filtro non validi | Invalid filter parameters |
> | `validation.searchLength` | Il parametro di ricerca deve avere tra 2 e 100 caratteri | Search parameter must be between 2 and 100 characters |
> | `validation.atLeastOneField` | È richiesto almeno un campo da aggiornare | At least one field to update is required |
> | `validation.newTrainerIdRequired` | Il campo newTrainerId è obbligatorio | newTrainerId is required |
> | `validation.traineeIdRequired` | Il traineeId è obbligatorio per le richieste trainer/admin | traineeId is required for trainer/admin requests |
> | `validation.targetMustBeTrainee` | L'utente destinatario deve avere il ruolo atleta | Target user must have trainee role |
> | `validation.targetMustBeTrainer` | L'utente destinatario deve avere il ruolo trainer | Target user must have trainer role |
> | `validation.userMustBeTrainee` | L'utente deve avere il ruolo atleta | User must have trainee role |
> | `internal.default` | Si è verificato un errore. Riprova. | An error occurred. Please try again. |

### Phase 1 — Foundation

- [x] **11.1** Aggiornare `src/lib/api-response.ts` — aggiungere `key?: string` all'interfaccia `ApiErrorResponse` e come 5° parametro opzionale alla funzione `apiError()`
- [x] **11.2** Creare `public/locales/it/errors.json` e `public/locales/en/errors.json` con tutte le 57 chiavi della tabella sopra
- [x] **11.3** Registrare namespace `errors` in `src/i18n/config.ts` + creare `src/lib/api-error.ts` con helper `getApiErrorMessage(data, fallback, t)`  
      Signature: `getApiErrorMessage(data: unknown, fallback: string, t: TFunction): string`  
      Logica: se `data?.error?.key` è presente → `t(data.error.key, { ns: 'errors', defaultValue: fallback })`; altrimenti → `fallback`

### Phase 2 — API Routes (aggiungere `key` a ogni chiamata `apiError`)

- [x] **11.4** `src/app/api/exercises/route.ts` — aggiungere `key` a tutte le chiamate `apiError()`
- [x] **11.5** `src/app/api/exercises/[id]/route.ts` — aggiungere `key`
- [x] **11.6** `src/app/api/feedback/route.ts` — aggiungere `key`
- [x] **11.7** `src/app/api/feedback/[id]/route.ts` — aggiungere `key`
- [x] **11.8** `src/app/api/movement-patterns/route.ts` — aggiungere `key`
- [x] **11.9** `src/app/api/movement-patterns/[id]/route.ts` — aggiungere `key`
- [x] **11.10** `src/app/api/movement-patterns/[id]/archive/route.ts` — aggiungere `key`
- [x] **11.11** `src/app/api/muscle-groups/route.ts` — aggiungere `key`
- [x] **11.12** `src/app/api/muscle-groups/[id]/route.ts` — aggiungere `key`
- [x] **11.13** `src/app/api/muscle-groups/[id]/archive/route.ts` — aggiungere `key`
- [x] **11.14** `src/app/api/personal-records/route.ts` — aggiungere `key`
- [x] **11.15** `src/app/api/personal-records/[id]/route.ts` — aggiungere `key`
- [x] **11.16** `src/app/api/programs/route.ts` — aggiungere `key`
- [x] **11.17** `src/app/api/programs/[id]/route.ts` — aggiungere `key`
- [x] **11.18** `src/app/api/programs/[id]/complete/route.ts` — aggiungere `key`
- [x] **11.19** `src/app/api/programs/[id]/publish/route.ts` — aggiungere `key`
- [x] **11.20** `src/app/api/programs/[id]/progress/route.ts` — aggiungere `key`
- [x] **11.21** `src/app/api/programs/[id]/reports/route.ts` — aggiungere `key`
- [x] **11.22** `src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts` — aggiungere `key`
- [x] **11.23** `src/app/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route.ts` — aggiungere `key`
- [x] **11.24** `src/app/api/programs/[id]/workouts/[workoutId]/exercises/reorder/route.ts` — aggiungere `key`
- [x] **11.25** `src/app/api/trainee/workouts/[id]/route.ts` — aggiungere `key`
- [x] **11.26** `src/app/api/users/route.ts` — aggiungere `key`
- [x] **11.27** `src/app/api/users/[id]/route.ts` — aggiungere `key`
- [x] **11.28** `src/app/api/users/[id]/activate/route.ts` — aggiungere `key`
- [x] **11.29** `src/app/api/users/[id]/deactivate/route.ts` — aggiungere `key`
- [x] **11.30** `src/app/api/weeks/[id]/route.ts` — aggiungere `key`
- [x] **11.31** `src/app/api/admin/programs/[id]/override/route.ts` — aggiungere `key`
- [x] **11.32** `src/app/api/admin/trainees/[traineeId]/reassign/route.ts` — aggiungere `key`
- [x] **11.33** `src/app/api/auth/me/route.ts` — aggiungere `key`

### Phase 3 — Frontend _content.tsx (sostituire `data.error?.message` con `getApiErrorMessage`)

- [x] **11.34** `src/app/trainer/exercises/new/_content.tsx`
- [x] **11.35** `src/app/trainer/exercises/[id]/edit/_content.tsx`
- [x] **11.36** `src/app/trainer/exercises/_content.tsx`
- [x] **11.37** `src/app/trainer/programs/_content.tsx`
- [x] **11.38** `src/app/trainer/programs/[id]/edit/_content.tsx`
- [x] **11.39** `src/app/trainer/programs/[id]/publish/_content.tsx`
- [x] **11.40** `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx`
- [x] **11.41** `src/app/trainer/programs/[id]/progress/_content.tsx`
- [x] **11.42** `src/app/trainer/programs/[id]/reports/_content.tsx`
- [x] **11.43** `src/app/trainer/trainees/_content.tsx`
- [x] **11.44** `src/app/trainer/trainees/new/_content.tsx`
- [x] **11.45** `src/app/trainer/trainees/[id]/_content.tsx`
- [x] **11.46** `src/app/trainer/trainees/[id]/records/_content.tsx`
- [x] **11.47** `src/app/trainee/workouts/[id]/_content.tsx`
- [x] **11.48** `src/app/trainee/history/_content.tsx`
- [x] **11.49** `src/app/trainee/records/_content.tsx`
- [x] **11.50** `src/app/trainee/programs/current/_content.tsx`
- [x] **11.51** `src/app/trainee/dashboard/_content.tsx` ✅ _22 Apr 2026_
- [x] **11.52** `src/app/admin/dashboard/_content.tsx` ✅ _22 Apr 2026_
- [x] **11.53** `src/app/admin/users/_content.tsx`
- [x] **11.54** `src/app/admin/programs/_content.tsx`
- [x] **11.55** `src/app/profile/change-password/_content.tsx` ✅ _22 Apr 2026_

### Phase 4 — Componenti condivisi (sostituire `data.error?.message`)

- [x] **11.56** `src/components/ExerciseCreateModal.tsx`
- [x] **11.57** `src/components/ExercisesTable.tsx`
- [x] **11.58** `src/components/ProfileForm.tsx`
- [x] **11.59** `src/components/ProgramsTable.tsx`
- [x] **11.60** `src/components/UserCreateModal.tsx`
- [x] **11.61** `src/components/UserDeleteModal.tsx`
- [x] **11.62** `src/components/UserEditModal.tsx`
- [x] **11.63** `src/components/UsersTable.tsx`

### Phase 5 — Test

- [ ] **11.64** Aggiornare i test di integrazione che assertano messaggi di errore in inglese (stringhe hardcoded → chiavi semantiche nel campo `key`)  
      File da verificare: `tests/integration/`

---

## Trainer Management — Exercise Completion Tracking (~8h)

> **Obiettivo:** Implementare tracciamento esplicito del completamento degli esercizi da parte del trainee con cascata automatica ai livelli superiori (workout → week → programma).

### Phase 1-10 — Full Implementation

- [x] **TM.1** Schema Prisma: aggiungere `isCompleted Boolean @default(false)` a WorkoutExercise, Workout, Week + 3 indici compositi (1h) ✅ _28 Apr 2026_
- [x] **TM.2** Completion Service: creare `cascadeCompletion()` con transazione atomica, guard, conditional updates (2h) ✅ _28 Apr 2026_
- [x] **TM.3** API Endpoint PATCH: `/api/trainee/workout-exercises/[id]/complete` con validation + ownership (1h) ✅ _28 Apr 2026_
- [x] **TM.4** Update GET Workout: includere `isCompleted` nella response (0.5h) ✅ _28 Apr 2026_
- [x] **TM.5** Frontend Widget: button toggle nell'ExerciseFocusCard con optimistic update + fire-and-forget (1.5h) ✅ _28 Apr 2026_
- [x] **TM.6** i18n Keys: 7 chiavi nuove (EN + IT) per button labels, error, toasts (0.5h) ✅ _28 Apr 2026_
- [x] **TM.7** Toast Cascade: celebrazione toasts sequenziali per workout/week/programma completati (0.5h) ✅ _28 Apr 2026_
- [x] **TM.8** Unit Tests: 6 test case per `cascadeCompletion()` (1h) ✅ _28 Apr 2026_
- [x] **TM.9** Integration Tests: 7 test case per PATCH endpoint (1h) ✅ _28 Apr 2026_
- [x] **TM.10** Changelog & Documentation: entry CHANGELOG.md + update CHECKLIST (0.5h) ✅ _28 Apr 2026_

**File modificati:**
- `prisma/schema.prisma` (schema + indici)
- `src/lib/completion-service.ts` (nuovo)
- `src/app/api/trainee/workout-exercises/[id]/complete/route.ts` (nuovo)
- `src/app/api/trainee/workouts/[id]/route.ts` (update response)
- `src/app/trainee/workouts/[id]/_content.tsx` (state + UI + toast logic)
- `public/locales/en/trainee.json`, `public/locales/it/trainee.json` (i18n keys)
- `tests/unit/completion-service.test.ts` (nuovo)
- `tests/integration/workout-exercise-complete.test.ts` (nuovo)

---

## Riepilogo per priorità

| Priorità   | Sprint    | Task         | Effort stimato |
| ---------- | --------- | ------------ | -------------- |
| Critico    | Sprint 1  | 1.1–1.6      | ~4h            |
| Critico    | Sprint 2  | 2.1–2.7      | ~29h           |
| Critico    | Sprint 3  | 3.1          | ~8h            |
| Alto       | Sprint 4  | 4.1–4.5      | ~21h           |
| Alto       | Sprint 5  | 5.1–5.10     | ~27h           |
| Medio      | Sprint 6  | 6.1–6.7      | ~5h            |
| Medio      | Sprint 7  | 7.1–7.6      | ~23h           |
| Basso      | Sprint 8  | 8.1–8.7      | ~11h           |
| Alto       | Sprint 9  | 9.1–9.23     | ~9h            |
| Medio      | Sprint 10 | 10.1–10.29   | ~5h            |
| Medio      | Sprint 11 | 11.1–11.64   | ~15h           |
| Alto       | Trainer Mgmt | TM.1–TM.10 | ~8h            |
| **Totale** |           | **175 task** | **~165h**      |

---

*Ultimo aggiornamento: 28 Aprile 2026*
