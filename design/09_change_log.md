# Change Log

## [2026-03-28] Specifica Calcolo Pesi Server-Side per Trainee View

### Modifiche

**1. Creazione documento implementazione weight calculation**
- **Contesto**: Conferma requisito design review (item 4.2b) su necessità calcolo peso effettivo server-side per visualizzazione trainee
- **Problema**: Nel caso di pesi dinamici (percentage_1rm, percentage_rm, percentage_previous), il trainee deve vedere:
  1. Il valore impostato dal trainer (es. "80% 1RM", "-5%")
  2. Il peso effettivo calcolato (es. "100 kg", "95 kg")
- **Soluzione**:
  - Creato documento dettagliato `docs/weight-calculation-trainee-view.md` con:
    - Specifica endpoint `GET /api/trainee/workouts/[id]` con campo `effectiveWeight` aggiunto a ogni WorkoutExercise
    - Implementazione calcolo server-side con `calculateEffectiveWeight()` già definita in 03_backend_api.md
    - Ottimizzazioni performance: batch fetch PersonalRecords, caching client-side TanStack Query (5min)
    - Gestione errori: `effectiveWeight: null` se massimale mancante + UI message per trainee
    - Test cases per validazione calcolo (absolute, percentage_1rm, percentage_previous chain)
    - Roadmap future: pre-calculation al publish in campo `effectiveWeightSnapshot` (fase 2)
- **File modificati**: 
  - `design/03_backend_api.md` — Aggiunta sezione "Workout View (Trainee)" con specifica `GET /api/trainee/workouts/[id]` e esempio response JSON con `effectiveWeight`
  - `docs/weight-calculation-trainee-view.md` — NUOVO file con implementazione completa
- **Impatto**: Chiarezza implementativa per backend team, risolve item design review 4.2b, specifica UX trainee per visualizzazione pesi dinamici
- **Priority**: HIGH (blocker per trainee workout view MVP)

### Riepilogo File Modificati
- `design/03_backend_api.md` — Nuova tabella endpoint "Workout View (Trainee)", specifica calcolo pesi server-side
- `docs/weight-calculation-trainee-view.md` — Documento implementazione completo (NUOVO)

---

## [2026-03-28] Risoluzione Criticità Design Review v2

### Modifiche

**1. Rimozione duplicazione schema Zod in 03_backend_api.md**
- **Problema**: Presenza di due versioni degli schema Zod (aggiornata con `percentage_previous` e legacy con `movementPattern` hardcoded)
- **Soluzione**: Rimosso blocco legacy duplicato (exerciseSchema e workoutExerciseSchema obsoleti)
- **File modificati**: `design/03_backend_api.md`
- **Impatto**: Elimina confusione per sviluppatori, mantiene solo schema aggiornati come fonte di verità

**2. Chiarimento logica calculateEffectiveWeight per percentage_previous**
- **Problema**: La funzione usava `orderBy: 'asc'` che prendeva la PRIMA occorrenza precedente, causando riferimenti alla stessa riga base invece della catena progressiva
- **Soluzione**: 
  - Modificato `orderBy` da `'asc'` a `'desc'` per prendere la riga IMMEDIATAMENTE precedente
  - Aggiunta documentazione esplicita sul comportamento ricorsivo e catene progressive
  - Aggiornati test unitari in `07_testing_strategy.md` per riflettere il comportamento corretto (catena: 100kg → -5% = 95kg → -10% = 85.5kg)
- **Comportamento**: `percentage_previous` si attiva SOLO se nello stesso workout c'è già lo stesso esercizio. Ogni riga con `-x%` calcola il peso sulla base della riga immediatamente precedente, permettendo catene progressive
- **File modificati**: `design/03_backend_api.md`, `design/07_testing_strategy.md`, `design-review/00_design_review_v2.md`
- **Impatto**: Risolve ambiguità sul comportamento ricorsivo, permette wave loading e back-off set con logica prevista dai trainer

**3. Completamento scheda: doppia modalità (automatica e manuale)**
- **Problema**: Documentata solo transizione automatica `active → completed` al termine endDate, mancava possibilità per trainer di completare manualmente
- **Soluzione**:
  - Aggiunto endpoint `PATCH /api/programs/[id]/complete` per completamento manuale da parte del trainer
  - Aggiunti campi `completedAt` e `completionReason` al model `TrainingProgram` in Prisma schema
  - Documentate DUE modalità: AUTOMATICA (cron daily) + MANUALE (trainer)
  - Use case manuale: trainee termina anticipatamente, cambio programmazione, infortunio
- **File modificati**: `design/03_backend_api.md`, `design/04_data_model.md`, `prisma/schema.prisma`, `design-review/00_design_review_v2.md`
- **Impatto**: Maggiore flessibilità per trainer, tracking motivazione completamento anticipato

**4. Chiarimento feedback real-time visibili al trainer**
- **Problema**: Non chiaro se feedback erano "bozze" fino al submit o visibili immediatamente
- **Soluzione**:
  - Documentato esplicitamente che trainer vede feedback in **real-time** (appena trainee compila con `POST /api/feedback`)
  - `POST /api/programs/[id]/submit` serve per: validazione completezza, timestamp formale, trigger notifica trainer (non blocco visibilità)
  - Dashboard trainer mostra feedback in tempo reale tramite `GET /api/programs/[id]/progress`
- **File modificati**: `design/03_backend_api.md`, `design-review/00_design_review_v2.md`
- **Impatto**: UX più naturale per contesto palestra, monitoraggio continuo allenamento trainee da parte del trainer

### Riepilogo File Modificati
- `design/03_backend_api.md` — Rimozione duplicati Zod, chiarimento calculateEffectiveWeight, nuovo endpoint complete, feedback real-time
- `design/04_data_model.md` — Aggiornamento schema TrainingProgram con completedAt/completionReason, note workflow completamento
- `design/07_testing_strategy.md` — Test unit calculateEffectiveWeight con comportamento corretto catena
- `prisma/schema.prisma` — Aggiunti campi completedAt e completionReason a TrainingProgram
- `design-review/00_design_review_v2.md` — Marcate criticità risolte con ✅

---

> Ogni entry documenta una decisione chiusa. Le decisioni aperte vivono in 08_open_decisions.md.

---

## 2026-03-28 (rev 35)
- **Azione**: Chiusura ODR-15, ODR-16, ODR-17 — decisioni qualità e testing per production-readiness completo.
- **ODR-15 - Error boundary client-side React**:
  - **Problema**: Nessuna strategia definita per gestire crash React lato client, rischio white screen per utenti
  - **Decisione**: **Error boundary globale con react-error-boundary + logging Sentry**
  - **Implementazione tecnica**:
    - **Library**: `react-error-boundary` (17KB, standard de facto, integration Sentry nativa)
    - **Root Error Boundary**: Wrappa `<body>` in `app/layout.tsx` (Next.js App Router)
      ```tsx
      // app/layout.tsx
      import { ErrorBoundary } from 'react-error-boundary'
      
      export default function RootLayout({ children }) {
        return (
          <html>
            <body>
              <ErrorBoundary 
                FallbackComponent={GlobalErrorFallback}
                onError={logErrorToSentry}
                onReset={() => window.location.href = '/'}
              >
                {children}
              </ErrorBoundary>
            </body>
          </html>
        )
      }
      ```
    - **Global Fallback UI**:
      ```tsx
      // components/GlobalErrorFallback.tsx
      function GlobalErrorFallback({ error, resetErrorBoundary }) {
        return (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Qualcosa è andato storto</h1>
              <p className="text-gray-600 mb-6">
                Ci scusiamo per l'inconveniente. Il nostro team è stato notificato.
              </p>
              <button onClick={resetErrorBoundary}>
                Ricarica la pagina
              </button>
              {process.env.NODE_ENV === 'development' && (
                <pre className="mt-4 text-left">{error.message}</pre>
              )}
            </div>
          </div>
        )
      }
      ```
    - **Boundary granulari** per sezioni critiche:
      - Dashboard trainee (workout viewer): Fallback \"Errore caricamento allenamento\" con link homepage
      - Dashboard trainer (program builder): Fallback \"Errore editor scheda\" mantiene sidebar navigazione
      - Feedback form: Fallback \"Errore invio feedback\" con retry button
    - **Sentry integration**:
      ```tsx
      import * as Sentry from '@sentry/nextjs'
      
      function logErrorToSentry(error: Error, info: { componentStack: string }) {
        Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: info.componentStack,
            },
          },
          user: {
            id: currentUser?.id,
            email: currentUser?.email,
            role: currentUser?.role,
          },
          tags: {
            errorBoundary: true,
          },
        })
      }
      ```
    - **Error recovery strategy**:
      - `resetErrorBoundary()` prova re-render del componente fallito
      - Se errore persiste dopo 3 retry, escalation a boundary parent
      - Root boundary fallback sempre disponibile (full page reload)
  - **Dev vs Prod behavior**:
    - **Dev**: Stack trace completo visibile, hot reload mantiene error state per debug
    - **Prod**: UI pulita con error ID univoco (Sentry event ID) per supporto
  - **Benefici**:
    - Zero white screen: sempre mostra UI (anche se degradata)
    - Debug facilitato: Sentry correla errori con session replay + breadcrumbs
    - UX professionale: messaggi contestuali invece di crash generico
    - Resilienza: sezioni app indipendenti (crash dashboard non blocca navbar)
- **ODR-16 - Accessibility (a11y) target e testing**:
  - **Problema**: MUI è WCAG-compliant ma nessun target esplicito definito, nessun test automatico a11y, potenziale rischio conformità legale
  - **Decisione**: **Target WCAG 2.1 Level AA** con test automatici axe-core integrati in E2E
  - **Rationale target AA**:
    - Level A = baseline minimo (insufficiente per apps con autenticazione)
    - Level AA = standard industria per web apps, conformità Legge Stanca italiana
    - Level AAA = overkill per MVP fitness (requisiti troppo stringenti)
  - **Implementazione test automatici**:
    - **Library**: `@axe-core/playwright` (axe-core engine in Playwright tests)
    - **Integration E2E**:
      ```typescript
      // tests/accessibility.spec.ts
      import { test, expect } from '@playwright/test'
      import AxeBuilder from '@axe-core/playwright'
      
      test('login page deve essere accessibile', async ({ page }) => {
        await page.goto('/login')
        
        const accessibilityScanResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
        
        expect(accessibilityScanResults.violations).toEqual([])
      })
      
      test('dashboard trainer deve essere accessibile', async ({ page }) => {
        await loginAsTrainer(page)
        await page.goto('/trainer/dashboard')
        
        const results = await new AxeBuilder({ page })
          .exclude('#third-party-widget') // Escludi componenti terzi non controllabili
          .analyze()
        
        // Blocca SOLO violazioni critiche/serious
        const criticalViolations = results.violations.filter(
          v => v.impact === 'critical' || v.impact === 'serious'
        )
        expect(criticalViolations).toEqual([])
      })
      ```
    - **Test coverage**: Login, Dashboard trainer, Dashboard trainee, Creazione scheda, Invio feedback (flussi P0)
    - **CI/CD**: Test a11y eseguiti su ogni PR, violations critiche bloccano merge
  - **Checklist manuale MVP** (validazione pre-launch):
    - [ ] **Navigazione tastiera**: Tab order logico, Enter su bottoni, Esc chiude modals
    - [ ] **Screen reader**: Test con NVDA (Windows) su login + dashboard, annunci corretti form errors
    - [ ] **Contrasto colori**: Minimo 4.5:1 testo normale, 3:1 testo large (>18pt), verificato con Contrast Checker
    - [ ] **Form labels**: Ogni input ha `<label>` esplicito (no placeholder-only), errori annunciati con `aria-describedby`
    - [ ] **Focus indicator**: Visibile su tutti elementi interattivi (outline 2px solid, colore contrastante)
    - [ ] **Skip link**: \"Salta al contenuto principale\" per bypassare navbar ripetitiva
    - [ ] **Immagini**: Alt text descrittivo (no \"immagine\", \"foto\"), decorative images hanno `alt=\"\"`
    - [ ] **ARIA**: Usato solo dove necessario (MUI gestisce maggior parte), custom components validati
  - **Benefici MUI baseline**:
    - MUI componenti hanno ARIA roles/labels built-in
    - Keyboard navigation funzionante out-of-box (Tab, Space, Enter)
    - Focus management automatico (modals, drawers)
    - High contrast mode support
  - **Post-MVP**: 
    - Audit esterno WebAIM quando utenza >200 utenti
    - Certificazione WCAG AA se richiesto da clienti enterprise
    - User testing con utenti screen reader reali
  - **Conformità legale**: 
    - Legge Stanca (4/2004) richiede accessibilità PA e fornitori PA → applicabile se ZeroCento serve enti pubblici
    - Direttiva UE 2016/2102 applicabile a enti pubblici
    - Target AA garantisce conformità robusta
- **ODR-17 - Seed data strategy per ambienti**:
  - **Problema**: Menzionata necessità seed per MuscleGroup/MovementPattern ma non definita strategia completa per staging (demo/UAT) e E2E (test deterministici)
  - **Decisione**: **Seed script Prisma environment-specific** con dati predicibili (E2E) e realistici (staging)
  - **Implementazione base `prisma/seed.ts`**:
    - **Esecuzione**: `npx prisma db seed` (configurato in `package.json` "prisma": {"seed": "ts-node prisma/seed.ts"})
    - **Dati statici universali** (tutti ambienti):
      ```typescript
      // prisma/seed.ts
      async function main() {
        // 14 gruppi muscolari standard
        const muscleGroups = await prisma.muscleGroup.createMany({
          data: [
            { name: 'Pettorali', code: 'CHEST' },
            { name: 'Dorsali', code: 'BACK' },
            { name: 'Spalle', code: 'SHOULDERS' },
            { name: 'Bicipiti', code: 'BICEPS' },
            { name: 'Tricipiti', code: 'TRICEPS' },
            { name: 'Quadricipiti', code: 'QUADS' },
            { name: 'Femorali', code: 'HAMSTRINGS' },
            { name: 'Glutei', code: 'GLUTES' },
            { name: 'Polpacci', code: 'CALVES' },
            { name: 'Addominali', code: 'ABS' },
            { name: 'Lombari', code: 'LOWER_BACK' },
            { name: 'Trapezi', code: 'TRAPS' },
            { name: 'Avambracci', code: 'FOREARMS' },
            { name: 'Adduttori', code: 'ADDUCTORS' },
          ],
        })
        
        // 7 movement patterns
        const movementPatterns = await prisma.movementPattern.createMany({
          data: [
            { name: 'Squat', description: 'Accosciata, piegamento gambe' },
            { name: 'Hinge', description: 'Piegamento anche (stacchi, good morning)' },
            { name: 'Push Verticale', description: 'Spinta sopra la testa' },
            { name: 'Push Orizzontale', description: 'Spinta petto (panca, push-up)' },
            { name: 'Pull Verticale', description: 'Tirata verticale (trazioni, lat machine)' },
            { name: 'Pull Orizzontale', description: 'Remata orizzontale' },
            { name: 'Carry/Core', description: 'Farmer walk, plank, anti-rotation' },
          ],
        })
        
        // Admin user (configurabile via env)
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@zerocento.local'
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!' // Hashato con Supabase Auth
        
        const admin = await prisma.user.create({
          data: {
            email: adminEmail,
            firstName: 'Admin',
            lastName: 'ZeroCento',
            role: 'admin',
            isActive: true,
          },
        })
        
        console.log('✅ Seed base completato: MuscleGroups, MovementPatterns, Admin')
      }
      ```
  - **Seed E2E `prisma/seed-e2e.ts`** (dati predicibili):
    - **Scopo**: Test automatici Playwright con ID fissi e dati conosciuti
    - **Esecuzione**: `npm run seed:e2e` (GitHub Actions prima di test E2E)
    - **Dati creati**:
      ```typescript
      // prisma/seed-e2e.ts
      async function seedE2E() {
        // 1. Utenti fissi con credenziali note
        const trainer = await createUser({
          email: 'trainer1@test.local',
          password: 'Test123!',
          firstName: 'Mario',
          lastName: 'Rossi',
          role: 'trainer',
        })
        
        const trainee = await createUser({
          email: 'trainee1@test.local',
          password: 'Test123!',
          firstName: 'Luca',
          lastName: 'Verdi',
          role: 'trainee',
        })
        
        // 2. Relazione trainer-trainee
        await prisma.trainerTrainee.create({
          data: { trainerId: trainer.id, traineeId: trainee.id },
        })
        
        // 3. Esercizi con ID predicibili
        const squat = await prisma.exercise.create({
          data: {
            name: 'Squat Bilanciere',
            type: 'STRENGTH',
            createdById: trainer.id,
            movementPatternId: movementPatterns[0].id, // Squat pattern
          },
        })
        // ... altri 9 esercizi standard
        
        // 4. Scheda test (8 settimane, 3 workout/settimana)
        const program = await prisma.trainingProgram.create({
          data: {
            name: 'Scheda Test E2E',
            trainerId: trainer.id,
            traineeId: trainee.id,
            status: 'active',
            durationWeeks: 8,
            startDate: new Date('2026-03-01'),
          },
        })
        
       // Week, Workout, WorkoutExercise creati con loop
        // ... (dettaglio implementazione)
        
        console.log('✅ Seed E2E completato: 1 trainer, 1 trainee, 10 esercizi, 1 scheda attiva')
      }
      ```
    - **Test usage**:
      ```typescript
      // tests/feedback.spec.ts
      test('trainee può inviare feedback', async ({ page }) => {
        await loginAs(page, 'trainee1@test.local', 'Test123!')
        await page.goto('/trainee/workout')
        
        // ID predicibili da seed
        await page.click('[data-testid=\"exercise-squat-feedback\"]')
        await page.fill('[name=\"reps\"]', '10')
        await page.fill('[name=\"weight\"]', '100')
        await page.click('button[type=\"submit\"]')
        
        await expect(page.locator('.success-message')).toBeVisible()
      })
      ```
  - **Seed staging `prisma/seed-staging.ts`** (dati realistici):
    - **Scopo**: Demo per stakeholder, UAT, sviluppo frontend
    - **Esecuzione**: `npm run seed:staging` (manuale o auto su deploy staging)
    - **Dati creati**:
      ```typescript
      // prisma/seed-staging.ts
      async function seedStaging() {
        // 3 trainer realistici
        const trainers = await Promise.all([
          createUser({ email: 'mario.rossi@demo.zerocento.it', firstName: 'Mario', lastName: 'Rossi', role: 'trainer' }),
          createUser({ email: 'laura.bianchi@demo.zerocento.it', firstName: 'Laura', lastName: 'Bianchi', role: 'trainer' }),
          createUser({ email: 'giorgio.verdi@demo.zerocento.it', firstName: 'Giorgio', lastName: 'Verdi', role: 'trainer' }),
        ])
        
        // 15 trainee con nomi italiani comuni
        const traineeNames = [
          ['Luca', 'Ferrari'], ['Sofia', 'Russo'], ['Marco', 'Romano'],
          ['Giulia', 'Colombo'], ['Alessandro', 'Ricci'], ['Francesca', 'Moretti'],
          // ... altri 9
        ]
        const trainees = await Promise.all(
          traineeNames.map(([first, last]) => 
            createUser({ 
              email: `${first.toLowerCase()}.${last.toLowerCase()}@trainee.zerocento.it`,
              firstName: first, 
              lastName: last, 
              role: 'trainee' 
            })
          )
        )
        
        // 50 esercizi libreria (mix bilanciere, manubri, corpo libero)
        const exercises = await createExerciseLibrary(trainers[0].id)
        
        // 5 schede pubblicate varie tipologie
        const programs = [
          { name: 'Forza 4x4', type: 'strength', weeks: 12, trainee: trainees[0] },
          { name: 'Ipertrofia Upper/Lower', type: 'hypertrophy', weeks: 8, trainee: trainees[1] },
          { name: 'Principiante Full Body', type: 'beginner', weeks: 6, trainee: trainees[2] },
          { name: 'Powerlifting Peaking', type: 'strength', weeks: 10, trainee: trainees[3] },
          { name: 'Tonificazione 3x/week', type: 'toning', weeks: 8, trainee: trainees[4] },
        ]
        
        // Genera feedback ultimi 30 giorni
        await generateRecentFeedback(programs, trainees)
        
        console.log('✅ Seed staging completato: 3 trainer, 15 trainee, 50 esercizi, 5 schede + feedback')
      }
      ```
    - **Rigeneration**: `npm run seed:staging --reset` pulisce DB e ricrea dati fresh
  - **Seed production `prisma/seed.ts`**:
    - **SOLO dati statici**: MuscleGroup, MovementPattern
    - **Admin configurabile**: Email/password da env variables (`.env.production`)
    - **Zero dati utente**: Nessun trainer/trainee/scheda di test
  - **CI/CD integration**:
    - **GitHub Actions workflow**:
      ```yaml
      # .github/workflows/e2e-tests.yml
      - name: Seed database E2E
        run: npm run seed:e2e
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}
      
      - name: Run Playwright tests
        run: npm run test:e2e
      ```
    - **Staging auto-seed**: Vercel deploy hook esegue `npm run seed:staging` dopo migrations
    - **Production safe**: Seed prod eseguito solo manualmente post-setup iniziale
  - **Benefici**:
    - **Test E2E deterministici**: ID fissi, nessun flakiness da dati randomici
    - **Staging usabile immediatamente**: Dati demo realistici per UAT e presentazioni
    - **Prod deployment safe**: Zero rischio di test data leak in produzione
    - **Developer experience**: Setup locale in <2 minuti con seed script

## 2026-03-28 (rev 34)
- **Azione**: Chiusura ultime due assunzioni ODR-31, ODR-32 per completare allineamento requisiti operativi MVP.
- **ODR-31 - Limite numero esercizi libreria condivisa**:
  - **Problema**: Necessità definire se esiste un limite massimo di esercizi nella libreria condivisa tra trainer
  - **Decisione**: **Limite soft ~500 esercizi** stimato come ampiamente sufficiente, nessun constraint hard DB
  - **Rationale**:
    - Libreria condivisa tra 3 trainer, crescita organica bassa (~5-10 nuovi esercizi/mese)
    - Proiezione: 180-360 esercizi/anno, ~1000 esercizi in 3-5 anni
    - Pagination cursor-based già implementata (ODR-10) garantisce performance fino a 1000+ records
    - UI con search/filter per exercise type e muscle group rende navigazione efficiente
  - **Implementazione**:
    - DB: Nessun CHECK constraint su conteggio Exercise (crescita illimitata)
    - UI: Search bar sempre visibile, filtri multipli (type, muscleGroup, isActive)
    - Performance: Index composito su `(type, isActive)` garantisce query <50ms fino a 2000+ esercizi
  - **Monitoraggio**: Se libreria supera 400 esercizi, valutare categorizzazione avanzata (tags custom) o archiving esercizi obsoleti via soft-delete
  - **Benefici**: Nessuna limitazione artificiale, scalabilità garantita, flessibilità operativa massima
- **ODR-32 - Credenziali via WhatsApp GDPR-compliant**:
  - **Problema**: Comunicazione password temporanea via WhatsApp/telefono potenzialmente non conforme GDPR (transito dato sensibile su piattaforma terza)
  - **Decisione MVP**: **Rischio ACCETTATO** — mantiene semplicità operativa per onboarding trainee
  - **Rationale**:
    - MVP con scala limitata (50 trainee), relazione trust trainer-trainee già consolidata
    - Password temporanea usa-e-getta con obbligo cambio primo login (`mustChangePassword=true`)
    - WhatsApp usa crittografia E2E (password in transito protetta)
    - Nessun log password in chiaro nel sistema ZeroCento
  - **Mitigazioni MVP**:
    1. Password temporanea generata con caratteri casuali sicuri (16 caratteri, mix alfanumerico+simboli)
    2. Trainer istruito a comunicare credenziali SOLO via canale cifrato (WhatsApp, Signal, chiamata vocale)
    3. Flag `mustChangePassword` forza cambio immediato,Password temporanea invalidata dopo primo login
    4. Nessun campo `initialPassword` salvato nel DB (già rimosso ODR-04)
  - **Soluzione post-MVP**: **Magic link via email** per setup password sicuro
    - Implementazione: Endpoint `/api/auth/invite` genera token JWT one-time (exp 48h)
    - Trainer clicca "Invita Trainee" → sistema invia email con link `app.zerocento.com/setup-password?token=...`
    - Trainee clicca link, imposta password direttamente nel form, token validato e consumato
    - Template email i18n-aware (già infra ODR-24)
  - **Trigger upgrade magic link**:
    - Utenza supera 100 trainee (gestione manuale non più scalabile)
    - Richiesta esplicita conformità GDPR da legale/audit
    - Feedback trainer su complessità comunicazione manuale credenziali
  - **Benefici post-MVP**: GDPR full-compliant, password mai transita fuori sistema, audit trail completo, UX professionale
  - **Costo implementazione post-MVP**: ~2-4h dev (endpoint + email template + UI form setup password)

## 2026-03-28 (rev 33)
- **Azione**: Chiusura decisioni funzionali ODR-26, ODR-28, ODR-29 sulla base di requisiti utente confermati.
- **ODR-26 - Multi-scheda attiva per trainee**:
  - **Problema**: Necessità chiarire se un trainee può avere più schede con `status='active'` contemporaneamente
  - **Decisione**: **Scenario multi-scheda CONSENTITO** — nessun constraint UNIQUE richiesto
  - **Rationale**: Flessibilità operativa per trainer che vogliono assegnare schede parallele (es. scheda forza + scheda mobilità, scheda upper + lower body split)
  - **Implementazione UI**:
    - Dashboard trainee mostra **selector scheda** se multiple attive (dropdown o tab)
    - Ogni scheda ha nome distintivo obbligatorio (`TrainingProgram.name`)
    - Visualizzazione settimana corrente filtrata per scheda selezionata
    - Feedback submission specifica `workoutExerciseId` che lega a scheda univoca via relazioni
  - **Benefici**: Massima flessibilità programmazione, supporto scenari avanzati (periodizzazione multi-focus), nessuna limitazione artificiale
- **ODR-28 - Riassegnazione trainee**:
  - **Problema**: Necessità definire se trainee può cambiare trainer autonomamente o solo admin gestisce riassegnazione
  - **Decisione**: **Solo ADMIN può riassegnare trainee** — nessuna UI self-service per trainee
  - **Rationale**: 
    - Prevenire abusi (trainee "shoppa" trainer senza motivazione)
    - Mantenere controllo gestionale centralizzato
    - Supportare handover trainer (eliminato/inattivo) con gestione admin
  - **Implementazione**: Endpoint `PUT /api/admin/trainer-trainee/[traineeId]` già definito in ODR-08
  - **Workflow**: 
    1. Trainee richiede cambio trainer via canale esterno (email admin, telefono)
    2. Admin valuta richiesta e approva/rifiuta
    3. Admin usa dashboard admin per riassegnare relazione TrainerTrainee
    4. Trainee riceve notifica cambio trainer (opzionale post-MVP)
  - **Benefici**: Processo controllato, audit trail completo (chi ha riassegnato, quando), prevenzione conflitti
- **ODR-29 - Proiezione storage Supabase**:
  - **Problema**: Necessità calcolare crescita storage DB per confermare adequatezza free tier 500MB vs Pro tier
  - **Assunzioni confermate dall'utente**:
    - **50 trainee iniziali**
    - **Crescita trainee +20% annua** (nessuna crescita trainer prevista)
    - 1 scheda/anno per trainee come media conservativa
  - **Calcolo volumetria per trainee/anno**:
    - 1 scheda × 12 settimane × 4 allenamenti × 6 esercizi = 288 `WorkoutExercise`
    - 288 `ExerciseFeedback` (1 per esercizio completato)
    - ~1000 `SetPerformed` (media 3-4 set/esercizio)
    - Stima bytes record: WorkoutExercise ~200B, ExerciseFeedback ~150B, SetPerformed ~50B
    - **Totale per trainee/anno: ~150KB**
  - **Proiezione cumulativa**:
    - Anno 1: 50 trainee × 150KB = **7.5 MB**
    - Anno 2: 60 trainee × 150KB = 9MB (totale cumulativo **16.5 MB**)
    - Anno 3: 72 trainee × 150KB = 10.8MB (totale **27 MB**)
    - Anno 5: 104 trainee × 150KB = 15.6MB (totale **~60 MB**)
    - Anno 10: 258 trainee × 150KB = 38.7MB/anno (totale cumulativo **~250 MB**)
  - **Overhead DB** (indexes, metadata, audit fields):
    - Stima moltiplicatore 2-3× per indexes compositi, foreign keys, timestamps
    - Anno 5 con overhead: **150-180 MB**
    - Anno 10 con overhead: **500-750 MB**
  - **Decisione**: **Free tier Supabase (500MB) adeguato per 5+ anni**
  - **Trigger upgrade Pro tier**:
    - Retention dati storici >5 anni SENZA soft-delete cleanup
    - Crescita trainee accelera oltre 30% annuo
    - Storage raggiunge 400MB (80% free tier) → pianificare upgrade
  - **Benefici**: Costo infra €0 aggiuntivo per primi 5 anni, budget mantenuto sotto €50/mese, scalabilità garantita con upgrade Pro seamless

## 2026-03-28 (rev 32)
- **Azione**: Chiusura decisioni operative critiche ODR-24, ODR-25, ODR-27, ODR-30 per standard tecnici production-ready.
- **ODR-24 - Lingua applicazione e template email**:
  - **Problema**: Template email Supabase di default in inglese, necessità confermare lingua applicazione e gestione multi-lingua
  - **Decisione**: **Tutto gestito via token i18n** (sistema già implementato con i18next/next-i18next)
  - **Implementazione**:
    - **Template email i18n-aware**: File traduzione `/public/locales/it/emails.json` e `/en/emails.json` con chiavi per subject/body email
    - **Selezione lingua**: Backend legge preferenza lingua da `User.preferredLanguage` (campo da aggiungere) o fallback a `Accept-Language` header
    - **Email templates Supabase**: Customizzati con placeholder `{{ .ConfirmationURL }}` + testo tradotto server-side prima invio
    - **Nessun testo hardcoded**: Zero stringhe italiano/inglese nel codice, tutto via `t('key')` i18next
  - **Esempio template email**:
    ```typescript
    // Backend: app/api/auth/send-email/route.ts
    const userLanguage = user.preferredLanguage || 'it'
    const t = await getServerTranslation(userLanguage, 'emails')
    
    const emailSubject = t('welcome.subject', { name: user.firstName })
    const emailBody = t('welcome.body', { 
      trainerName: trainer.firstName,
      loginUrl: process.env.APP_URL 
    })
    ```
  - **Struttura file traduzioni email**:
    ```json
    // /public/locales/it/emails.json
    {
      "welcome": {
        "subject": "Benvenuto in ZeroCento, {{name}}!",
        "body": "Il tuo trainer {{trainerName}} ti ha aggiunto alla piattaforma..."
      },
      "passwordReset": {
        "subject": "Reset password",
        "body": "Clicca qui per reimpostare la tua password: {{resetUrl}}"
      }
    }
    ```
  - **Benefici**: Coerenza totale multi-lingua UI + email, cambio lingua utente riflesso ovunque, manutenzione centralizzata traduzioni
- **ODR-25 - Fuso orario (UTC vs Europe/Rome)**:
  - **Problema**: Date salvate senza timezone specifico, rischio bug visualizzazione per utenti in fusi diversi
  - **Decisione**: **Standard UTC per storage DB**, conversione a fuso locale nel frontend
  - **Implementazione storage**:
    - PostgreSQL: Tutte le date salvate come `TIMESTAMP WITH TIME ZONE` (automatico con Prisma `DateTime`)
    - Backend: `new Date()` JavaScript genera sempre UTC, salvato direttamente
    - Prisma: `DateTime` fields mappano a `timestamptz` PostgreSQL (UTC storage nativo)
  - **Implementazione frontend**:
    - **Libreria**: `date-fns-tz` per conversione timezone (lightweight, tree-shakeable)
    - **Auto-detection fuso**: `Intl.DateTimeFormat().resolvedOptions().timeZone` → es. "Europe/Rome"
    - **Display date**: `format(utcToZonedTime(date, userTimezone), 'd MMMM yyyy, HH:mm', { locale: it })`
    - **Input date**: Conversione inversa con `zonedTimeToUtc()` prima di inviare API
  - **Esempio codice**:
    ```typescript
    // Frontend component
    import { utcToZonedTime, format } from 'date-fns-tz'
    import { it } from 'date-fns/locale'
    
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone // "Europe/Rome"
    const utcDate = new Date(workout.startDate) // "2026-03-28T13:30:00.000Z" (UTC)
    const localDate = utcToZonedTime(utcDate, userTimezone) // 14:30 in Rome (UTC+1)
    const formatted = format(localDate, 'd MMMM yyyy, HH:mm', { locale: it }) // "28 marzo 2026, 14:30"
    ```
  - **API response format**: Sempre ISO 8601 UTC (`2026-03-28T13:30:00.000Z`), frontend converte
  - **Benefici**: Dati coerenti multi-timezone, supporto utenti internazionali, no bug daylight saving, standard industry
- **ODR-27 - Soft-delete vs hard-delete (GDPR)**:
  - **Problema**: DELETE hard-delete rimuove dati permanentemente, conflitto GDPR right to erasure (richiede anonimizzazione, non cancellazione), perdita audit trail
  - **Decisione**: **Pattern soft-delete globale** per tutte le entità + anonimizzazione GDPR per User
  - **Implementazione soft-delete**:
    - **Campo aggiunto**: `deletedAt DateTime?` a tutte le entità principali (User, Exercise, TrainingProgram, MuscleGroup, MovementPattern, TrainerTrainee, etc.)
    - **DELETE endpoint**: `PATCH` che imposta `deletedAt = NOW()` invece di `DELETE` fisico
    - **Query automatiche**: Middleware Prisma filtra `WHERE deletedAt IS NULL` per default
    - **Restore**: Admin può ripristinare con `PATCH /restore` impostando `deletedAt = NULL`
  - **Schema Prisma aggiornato**:
    ```prisma
    model User {
      // ... campi esistenti
      deletedAt DateTime?
      @@index([deletedAt]) // Performance query filtrate
    }
    
    model Exercise {
      // ... campi esistenti
      deletedAt DateTime?
    }
    
    // Stesso pattern per tutte le entità
    ```
  - **Anonimizzazione GDPR per User**:
    - DELETE utente esegue **soft-delete + anonimizzazione dati personali**:
      - `deletedAt = NOW()`
      - `firstName = "Deleted"`
      - `lastName = "User"`
      - `email = "deleted_{uuid}@anonymized.local"` (preserva unique constraint)
      - `isActive = false` (blocca login)
    - **Dati preservati**: `id`, `role`, `createdAt` (per integrità referenziale schede/feedback)
    - **GDPR compliant**: Dati personali irrecuperabili, right to erasure soddisfatto, audit trail ID preservato
  - **Middleware Prisma soft-delete**:
    ```typescript
    // lib/prisma.ts
    prisma.$use(async (params, next) => {
      if (params.action === 'delete') {
        params.action = 'update'
        params.args['data'] = { deletedAt: new Date() }
      }
      if (params.action === 'findMany' || params.action === 'findFirst') {
        params.args.where = { ...params.args.where, deletedAt: null }
      }
      return next(params)
    })
    ```
  - **API behavior**:
    - `DELETE /api/users/[id]` → soft-delete + anonimizzazione
    - `DELETE /api/exercises/[id]` → soft-delete semplice
    - `GET /api/users` → filtra `deletedAt IS NULL` automaticamente
    - `GET /api/admin/users?includeDeleted=true` → opzione admin per vedere deleted
  - **Benefici**: Audit trail completo, recupero errori accidentali, GDPR compliant, tracciabilità operazioni, integrità referenziale preservata
- **ODR-30 - Deploy region esatta**:
  - **Problema**: Region deployment non specificata, necessario confermare per GDPR compliance e latenza ottimale
  - **Decisione**: **Deploy completo in EU (Frankfurt, Germania)** per GDPR compliance e latenza Italia ottimale
  - **Region selezionate**:
    - **Vercel**: `fra1` (Frankfurt, Germany)
    - **Supabase**: `eu-central-1` (Frankfurt, AWS Germany)
  - **Rationale Frankfurt**:
    - ✅ **GDPR full compliance**: Dati processati e storati esclusivamente in territorio UE
    - ✅ **Latenza Italia**: Frankfurt è datacenter EU più vicino all'Italia (~20-30ms Roma-Frankfurt)
    - ✅ **Availability zone robuste**: AWS eu-central-1 ha 3 AZ con 99.99% SLA
    - ✅ **Pricing competitivo**: Stesso costo regions EU, no premium Asia/US
    - ✅ **Conformità normativa**: Germania ha standard privacy allineati GDPR rigorosi
  - **Alternative EU valutate**:
    - `ams1` Amsterdam: Latenza simile (~25-35ms), ma Frankfurt preferito per AZ multiple
    - `cdg1` Paris: Latenza leggermente superiore (~35-45ms)
    - `lhr1` London: Post-Brexit, preferito evitare per data residency UE
  - **Configurazione**:
    - **Vercel project settings**: Region `fra1` selezionata in Project Settings → General → Region
    - **Supabase project creation**: Region `Germany (Frankfurt)` selezionata durante setup iniziale (immutabile)
    - **Vercel Serverless Functions**: Deployate automaticamente in `fra1`
    - **Vercel Edge Network**: CDN globale, ma origin sempre Frankfurt
  - **Test latenza attesi**:
    - Italia (Roma/Milano) → Frankfurt: ~20-30ms
    - Europa Occidentale: ~10-40ms
    - Europa Orientale: ~30-60ms
    - US/Asia: ~150-250ms (accettabile, utenti primari in Italia)
  - **Benefici**: GDPR compliance garantita, latenza ottimale per utenti Italia/EU, availability alta, pricing efficiente, conformità normativa robusta
- **Chiusura decisioni**: **ODR-24**, **ODR-25**, **ODR-27**, **ODR-30** risolti ✅
- **Implicazioni implementative**:
  - **i18n email**: Aggiungere campo `User.preferredLanguage` (enum IT|EN), creare file `emails.json` traduzioni, customizzare template Supabase
  - **Timezone**: Installare `date-fns-tz`, creare utility `formatLocalDate()`, testare conversioni DST (daylight saving)
  - **Soft-delete**: Migration Prisma per aggiungere `deletedAt` a tutte entità, implementare middleware Prisma, aggiornare query esistenti, creare endpoint `/restore` admin
  - **Region**: Configurare Vercel project region `fra1`, creare Supabase project in Frankfurt (se non già fatto), verificare latenza con test load
  - **Testing**: E2E test per email multi-lingua, unit test conversioni timezone, test soft-delete + restore, test latency Frankfurt
- **Implicazioni**: Standard tecnici production-ready definiti. Multi-lingua completa (UI + email). Timezone handling corretto per utenti internazionali. Soft-delete preserva audit trail e GDPR compliance. Deploy EU garantisce conformità e performance ottimali.

---

## 2026-03-28 (rev 31)
- **Azione**: Chiusura ODR-22 con creazione diagramma ER completo per visualizzazione data model.
- **ODR-22 - Diagramma ER**:
  - **Problema**: Documentazione data model testuale completa ma nessuna visualizzazione grafica delle relazioni tra entità, difficile overview rapida per review design
  - **Decisione**: Creato **diagramma ER completo in formato Mermaid** inserito in `04_data_model.md`
  - **Contenuto diagramma**:
    - **14 entità visualizzate**: User, TrainerTrainee, MuscleGroup, MovementPattern, MovementPatternColor, Exercise, ExerciseMuscleGroup, TrainingProgram, Week, Workout, WorkoutExercise, ExerciseFeedback, SetPerformed, PersonalRecord
    - **Relazioni con cardinalità**: 1:1 (TrainerTrainee.traineeId UNIQUE), 1:N (User → TrainingProgram, Week → Workout), N:M (Exercise ↔ MuscleGroup via ExerciseMuscleGroup)
    - **Gerarchia schede**: TrainingProgram → Week → Workout → WorkoutExercise (cascade delete) visualizzata chiaramente
    - **Feedback tracking**: WorkoutExercise → ExerciseFeedback → SetPerformed (normalizzazione serie eseguite)
    - **Dettagli campi**: Ogni entità mostra campi chiave, tipi (uuid, string, enum, datetime), constraints (PK, FK, UK), note implementative
    - **Personalizzazioni**: MovementPatternColor per colori custom trainer, Exercise.createdBy audit-only (libreria condivisa)
  - **Formato Mermaid**:
    - Renderizzabile direttamente su GitHub, GitLab, VS Code (con estensioni), documentazione online
    - Sintassi `erDiagram` con relazioni `||--o{` (one-to-many), `||--o|` (one-to-one), entità con campi dettagliati
    - Code block markdown standard (```mermaid), versionabile Git, no dipendenze tool esterni
  - **Posizionamento**: Inserito in `04_data_model.md` tra sezione "Entità principali" (tabella riassuntiva) e "Schema (logico)" (dettaglio testuale)
  - **Note diagramma**: Aggiunta legenda sotto diagramma con spiegazioni relazione 1:1 trainee-trainer UNIQUE, tabelle junction M:N, gerarchia cascade, feedback normalizzato, libreria condivisa
  - **Benefici**:
    - ✅ **Visualizzazione rapida**: Review design relazioni a colpo d'occhio senza leggere centinaia righe testo
    - ✅ **Onboarding sviluppatori**: Nuovi dev capiscono architettura DB in 2 minuti guardando diagramma
    - ✅ **Verifica integrità**: Spot immediato relazioni mancanti, FK inconsistenti, cardinalità errate
    - ✅ **Documentazione sempre aggiornata**: Mermaid in markdown, aggiornabile insieme al codice, no tool esterni che si disallineano
    - ✅ **Comunicazione stakeholder**: Diagramma condivisibile con non-dev per review architettura dati
  - **Manutenzione**: Se schema Prisma cambia (aggiunte entità, nuove relazioni), diagramma Mermaid va aggiornato manualmente in sync. Pattern: modifica `prisma/schema.prisma` → commit → aggiorna diagramma in `04_data_model.md` → commit insieme
- **Chiusura decisione**: **ODR-22** risolto ✅
- **Implicazioni implementative**:
  - Documentazione: diagramma permanente in `04_data_model.md`, template per futuri aggiornamenti schema
  - Review process: verificare sync diagramma-schema Prisma durante PR review che toccano data model
  - Tooling: suggerito plugin VS Code "Markdown Preview Mermaid Support" per preview locale durante editing
- **Implicazioni**: Data model completamente documentato con visualizzazione grafica professionale. Gap design ↔ codice eliminato. Developer experience migliorata per onboarding e review. Stakeholder possono comprendere architettura dati senza leggere codice Prisma.

---

## 2026-03-28 (rev 30)
- **Azione**: Chiusura decisioni Stack & Tooling ODR-18, ODR-19, ODR-20 con mitigazioni strategiche.
- **ODR-18 - Conflitto Tailwind CSS + MUI**:
  - **Problema**: Tailwind (utility-first CSS) e MUI (CSS-in-JS/Emotion) usano sistemi styling fondamentalmente diversi. Coesistenza causa conflitti specificity, override imprevedibili, bundle size aumentato ~50-80KB
  - **Impatto**: Developer experience degradata, bug visivi difficili da diagnosticare, CSS bundle più grande del necessario
  - **Decisione**: **Rischio MITIGATO** con strategia di separazione netta
  - **Strategia di mitigazione**:
    - **MUI limitato a componenti complessi**: DataGrid (tabelle esercizi/utenti con sorting/filtering), Drawer (menu mobile hamburger), BottomNavigation (barra navigazione trainee mobile)
    - **Tailwind per tutto il resto**: Layout (flexbox/grid), form controls (input/select/textarea), cards, buttons, spacing, typography
    - **Separazione netta**: Componenti MUI isolati con `@emotion/styled`, non mescolare Tailwind utility classes su componenti MUI (evita override wars)
    - **Bundle size monitorato**: Webpack Bundle Analyzer configurato per verificare che MUI non ecceda 120KB gzipped
    - **Convenzioni CSS**: Utility-first con Tailwind, MUI styled con `sx` prop o Emotion quando necessario, zero CSS globale custom (solo reset e variabili tema)
  - **Alternative future**: shadcn/ui valutato come sostituto post-MVP se conflitti persistono (Tailwind-native, componenti accessibili, bundle più leggero)
  - **Benefici**: Stack ibrido funzionale per MVP, componenti MUI riutilizzabili per funzionalità complesse, Tailwind per velocità sviluppo layout, DX accettabile con convenzioni chiare
  - **Documentato in**: `design-review/00_review_v1.md` (5.1 Rischio MEDIO), `02_frontend_design.md` (Convenzioni CSS)
- **ODR-19 - Service Worker con App Router**:
  - **Problema**: `next-pwa` ha supporto limitato per Next.js App Router (maturo solo per Pages Router). Potenziali problemi con RSC (React Server Components) + SW caching
  - **Impatto**: Comportamento offline non predicibile, cache invalidation complessa, bug difficili da debuggare
  - **Decisione**: **Rischio BASSO** con strategia di mitigazione chiara
  - **Strategia di mitigazione**:
    - **Usare @serwist/next** al posto di next-pwa (fork attivo con supporto maturo App Router, community attiva, aggiornamenti regolari)
    - **Limitare caching SW**: Solo asset statici (JS/CSS/fonts/images) e API GET specifiche (GET /api/programs/[id], GET /api/exercises)
    - **Evitare cache su**: POST/PUT/DELETE requests, API con auth header, contenuti dinamici personalizzati
    - **Implementazione Workbox**:
      - **NetworkFirst** per API (dati freschi quando online, fallback cache se offline)
      - **CacheFirst** per assets statici (performance, raramente cambiano)
      - **StaleWhileRevalidate** per immagini/loghi
    - **Cache invalidation**: Service Worker verifica versione app, invalida cache se mismatch
  - **Benefici**: Offline support garantito per trainee in palestra (scheda corrente, feedback), performance migliorate con asset caching, comportamento predicibile
  - **Documentato in**: `design-review/00_review_v1.md` (5.3 Rischio BASSO), `02_frontend_design.md` (Service Worker per Offline Support)
- **ODR-20 - Vendor Lock-in Supabase**:
  - **Problema**: Auth + DB + Storage + Branching + Email tutti su Supabase. Se Supabase ha outage prolungato o cambia pricing drasticamente, intera piattaforma bloccata. Single point of failure per servizi critici
  - **Impatto**: Dipendenza completa da vendor esterno, difficoltà migrazione se necessario
  - **Decisione**: **Rischio MITIGATO** con strategie multi-layer per facilitare migrazione futura
  - **Strategie di mitigazione**:
    1. **Database** (lock-in BASSO):
       - Prisma ORM astrae completamente dipendenza DB
       - Migrazione a qualsiasi PostgreSQL gestito possibile: AWS RDS, Google Cloud SQL, Neon, Railway, self-hosted
       - Zero code change necessario (solo DATABASE_URL env var)
       - Connection pooling gestibile con PgBouncer esterno se necessario
    2. **Auth** (lock-in MEDIO → MITIGATO):
       - **Documentate tutte le API Supabase Auth** usate nella piattaforma in `docs/supabase-auth-api-surface.md`:
         - Client-side: `signInWithPassword()`, `signUp()`, `signOut()`, `getSession()`, `refreshSession()`
         - Server-side: JWT verification con `@supabase/ssr`, custom middleware per session check
         - OAuth (post-MVP): `signInWithOAuth()` per Google/GitHub
       - **Migration strategy**: Sostituire adapter layer `lib/auth` con implementazione NextAuth.js, Clerk, o Auth0
       - **Stima effort migrazione**: 16-24 ore dev (adapter layer + testing E2E auth flows)
    3. **Storage** (lock-in ZERO per MVP):
       - Non usato per MVP (no upload immagini profilo, no video esercizi)
       - Se introdotto post-MVP: wrappare in adapter `lib/storage` con interfaccia astratta, provider switchabile (Supabase/AWS S3/Cloudflare R2)
    4. **Email** (lock-in BASSO):
       - Template email in repository sotto `/emails` (React Email framework)
       - Provider switchabile con env var `EMAIL_PROVIDER` (Supabase/SendGrid/Resend/AWS SES)
       - Stima effort switch: 4-6 ore (config + adattamento template se necessario)
    5. **Branching** (lock-in ZERO):
       - Feature opzionale per preview environments, non dipendenza critica
       - Alternativa: database separati per staging/dev (standard industry practice)
  - **Risk assessment Supabase**:
    - Valutato **stabile e affidabile**: Series B funding $80M, SOC 2 Type II compliant, 99.9% SLA su Pro tier
    - Community attiva (40K+ GitHub stars), documentazione eccellente, roadmap pubblica
    - Pricing trasparente e competitivo (Pro $25/mese vs AWS RDS ~$50-100/mese)
  - **Benefici**: Lock-in mitigato su tutti i servizi, migration path documentato e fattibile, effort stimato accettabile, costo opportunità basso (velocity sviluppo MVP alta con Supabase)
  - **Documentato in**: `design-review/00_review_v1.md` (5.2 Rischio BASSO-MEDIO), `docs/supabase-auth-api-surface.md` (API surface completa)
- **Chiusura decisioni**: **ODR-18**, **ODR-19**, **ODR-20** risolti ✅
- **Implicazioni implementative**:
  - **Frontend**: Webpack Bundle Analyzer configurato in `next.config.js` per monitoring bundle size
  - **Service Worker**: Installare `@serwist/next`, configurare Workbox strategies, testare offline behavior
  - **Documentazione operativa**: Mantenere aggiornato `docs/supabase-auth-api-surface.md` se aggiunte nuove API auth
  - **Monitoring**: Alert su bundle size >150KB per MUI (threshold warning)
- **Implicazioni**: Stack tecnologico validato con mitigazioni robuste. Vendor lock-in gestibile con effort contenuto. Service Worker funzionale per offline support trainee. Coesistenza Tailwind+MUI accettabile per MVP con convenzioni chiare. Migration path documentato per ridurre rischio lungo termine.

---

## 2026-03-28 (rev 29)
- **Azione**: Chiusura decisioni architetturali ODR-09, ODR-10, ODR-11, ODR-12 con implementazioni e accettazione rischi.
- **ODR-09 - Database Indexes Espliciti**:
  - **Problema**: Query dashboard con calcolo date e JOIN multipli non ottimizzate, potenziale bottleneck a 500+ utenti
  - **Decisione**: Implementati **indici compositi** su tutte le tabelle critiche per performance
  - **Indici implementati**:
    - **User**: `[email]` (login), `[role, isActive]` (filtri admin)
    - **TrainerTrainee**: `[trainerId]` (lista trainee per trainer)
    - **Exercise**: `[type, isActive]` (filtro esercizi fundamentals/accessory), `[movementPatternId, isActive]` (filtro per schema motorio)
    - **WorkoutExercise**: `[workoutId, order]` (ordinamento esercizi per workout)
    - **ExerciseFeedback**: `[traineeId, date]` (storico feedback trainee), `[workoutExerciseId, traineeId, date]` UNIQUE (idempotency + query puntuali)
    - **PersonalRecord**: `[traineeId, exerciseId, type, recordDate]` (query massimali per esercizio)
  - **Rationale dettagliato**: Ogni indice ottimizza query specifiche (dashboard trainer, ricerca esercizi, storico feedback, lookup JOIN). Performance garantita fino a 10.000+ record per tabella
  - **Documentazione**: File `docs/database-indexes.md` con rationale, query ottimizzate, esempi SQL
  - **Benefici**: Tempo risposta query dashboard <200ms garantito, scalabilità oltre MVP (500+ utenti), zero bottleneck DB
- **ODR-10 - API Pagination**:
  - **Problema**: Endpoint GET list senza paginazione, lista esercizi libreria condivisa può crescere indefinitamente
  - **Decisione**: Implementata **cursor-based pagination** selettiva su endpoint con crescita illimitata
  - **Strategia**:
    - ✅ `GET /api/exercises` **paginato** — libreria condivisa, crescita >500 esercizi prevista
    - ❌ `GET /api/users` **NON paginato** — max 54 utenti per MVP, crescita lenta
    - ❌ `GET /api/programs` **NON paginato** — filtrato per trainer, ~10-50 schede per trainer
  - **Implementazione cursor-based**:
    - Parametri query: `cursor` (ID ultimo elemento pagina precedente), `limit` (default 50, max 100), `sortBy` (name/createdAt/type), `order` (asc/desc)
    - Response: `{ data: Exercise[], pagination: { nextCursor, hasMore, totalCount } }`
    - Vantaggi vs offset-based: no missed records con inserimenti concorrenti, performance costante anche con milioni record
  - **Backend (Prisma)**:
    ```typescript
    await prisma.exercise.findMany({
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { [sortBy]: order }
    })
    ```
  - **Documentazione**: File `docs/api-pagination.md` con schema richiesta/response, implementazione backend, esempio frontend
  - **Benefici**: Lista esercizi scrollabile infinita senza lag, scalabilità a migliaia di esercizi, UX mobile ottimizzata
- **ODR-11 - Concurrency Control**:
  - **Problema**: Nessun optimistic locking, scenario "due trainer modificano stesso esercizio contemporaneamente" causa last-write-wins silenzioso
  - **Decisione**: **Rischio ACCETTATO per MVP**, nessun optimistic locking implementato
  - **Rationale**:
    - **Probabilità bassissima**: 3 trainer totali, libreria esercizi usata sporadicamente (creazione schede), finestra collisione <1% mensile
    - **Impatto limitato**: Worst case = trainer perde modifica e deve rifarla, nessun impatto dati critici o feedback trainee
    - **Costo/beneficio**: Implementare optimistic locking (version field, updatedAt check, conflict resolution UI) richiede ~8-12 ore dev per scenario rarissimo
  - **Classificazione rischio**: BASSO per MVP (3 trainer), MEDIO se >10 trainer (post-MVP)
  - **Mitigazione futura** (se necessario post-MVP):
    - Aggiungere campo `Exercise.version INT` auto-incrementale
    - Update API: `PUT /api/exercises/[id]` invia `version` attesa, backend verifica match prima di UPDATE
    - Conflict UI: se mismatch, mostra diff e permette merge/overwrite manuale
  - **Documentato in**: `design-review/00_review_v1.md` tabella "Parti mancanti nella documentazione"
  - **Benefici**: Zero effort per scenario improbabile, focus su funzionalità core, soluzione rinviata quando/se emerge necessità reale
- **ODR-12 - Idempotency su POST Feedback**:
  - **Problema**: Double-tap o network retry su `POST /api/feedback` può creare due `ExerciseFeedback` duplicati per stesso esercizio/trainee/giorno
  - **Decisione**: Implementato **constraint UNIQUE** + validazione backend + debouncing client
  - **Implementazione 3-layer**:
    1. **Database constraint**: `@@unique([workoutExerciseId, traineeId, date])` su tabella `ExerciseFeedback` — blocca INSERT duplicati a livello DB
    2. **Backend validation**: API verifica esistenza feedback prima di INSERT, ritorna 409 Conflict se già presente
    3. **Client debouncing**: Submit button disabilitato per 500ms dopo click, TanStack Query blocca retry automatici duplicati
  - **Schema Prisma**:
    ```prisma
    model ExerciseFeedback {
      workoutExerciseId String
      traineeId         String
      date              DateTime
      @@unique([workoutExerciseId, traineeId, date])
    }
    ```
  - **Response API duplicato**: `409 Conflict { error: { code: 'DUPLICATE_FEEDBACK', message: 'Feedback già inviato per questo esercizio' } }`
  - **Documentazione**: `docs/database-indexes.md` (constraint UNIQUE), `design-review/00_review_v1.md` (A2 - Idempotency POST feedback)
  - **Benefici**: Zero feedback duplicati garantito a livello DB, UX client reattiva con debouncing, gestione errori chiara
- **Chiusura decisioni**: **ODR-09**, **ODR-10**, **ODR-11**, **ODR-12** risolti ✅
- **Implicazioni implementative**:
  - **Migration Prisma**: Aggiungere indici compositi a tutte le tabelle secondo strategia `docs/database-indexes.md`
  - **API /api/exercises**: Implementare cursor-based pagination secondo schema `docs/api-pagination.md`
  - **Monitoring**: Verificare performance query con indici in production via Supabase Dashboard (query analytics)
  - **Testing**: E2E test per pagination `/api/exercises` (navigazione multipagina, filtri, sorting)
  - **Frontend**: Infinite scroll per lista esercizi con TanStack Query `useInfiniteQuery`
  - **Constraint DB**: Applicare UNIQUE constraint su ExerciseFeedback, gestire 409 Conflict in frontend
- **Implicazioni**: Architettura MVP completata con performance garantita, paginazione scalabile, idempotency robusta. Concurrency control rinviato consapevolmente per focus su funzionalità core. Database ottimizzato per query dashboard real-world. Sistema production-ready per 54 utenti con scalabilità a 500+.

---

## 2026-03-28 (rev 28)
- **Azione**: Chiusura decisioni operative critiche ODR-03, ODR-13, ODR-14 con soluzioni pragmatiche a costo zero.
- **ODR-03 - Rate Limiting con Upstash Redis**:
  - **Problema**: Rate limiting in-memory con Map() inefficace su serverless (cold start resetta state, istanze isolate) → brute-force auth non protetto
  - **Decisione**: **Upstash Redis free tier** (10K comandi/giorno, €0) per rate limiting **SOLO endpoint auth critici**
  - **Scope protetto**:
    - `POST /api/auth/login` — 5 tentativi / 15 minuti per IP
    - `POST /api/auth/signup` — 3 registrazioni / ora per IP
    - `POST /api/auth/reset-password` — 3 richieste / ora per IP
  - **Scope in-memory mantenuto**: Altri endpoint (`/api/programs`, `/api/exercises`, `/api/feedback`) continuano con rate limiting Map() in-memory (sufficiente per 54 utenti MVP, non critico per security)
  - **Setup tecnico**:
    - Account Upstash gratuito, create Redis database (region EU)
    - Env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
    - Middleware `/middleware.ts`: check path → se `/api/auth/*` usa Upstash, altrimenti in-memory
    - Implementazione: `@upstash/redis` con REST API (edge-compatible)
  - **Capacità free tier**: 10K cmd/giorno = 416 cmd/ora → 54 utenti * 5 login/giorno = 270 cmd/giorno → margine 97%
  - **Codice pattern**:
    ```typescript
    import { Redis } from '@upstash/redis';
    const redis = new Redis({ url, token });
    const key = `auth:login:${ip}`;
    const attempts = await redis.incr(key);
    if (attempts === 1) await redis.expire(key, 900); // 15min
    if (attempts > 5) return Response.json({ error: 'Too many attempts' }, { status: 429 });
    ```
  - **Benefici**: Protezione brute-force garantita, persistenza tra cold start, costo €0, setup <30min
  - **Limitazioni accettate**: Rate limiting non-auth rimane in-memory (accettabile per MVP, nessun rischio security critico)
- **ODR-13 - Backup & Disaster Recovery**:
  - **Setup scelto**: **Supabase backup standard** incluso in Pro plan (già pagato €25/mese)
  - **Backup automatici**: Daily full snapshot, retention 7 giorni rolling
  - **Parametri DR**:
    - **RPO (Recovery Point Objective)**: 24 ore — in caso disaster, perdi max 1 giorno di dati
    - **RTO (Recovery Time Objective)**: 15-30 minuti — tempo restore manuale via Supabase Dashboard
  - **Procedura test restore** (trimestrale):
    1. Crea Supabase Project temporaneo "test-restore-YYYY-MM-DD"
    2. Settings → Database → Backups → Restore backup più recente
    3. Verifica integrità: query sample su User, TrainingProgram, ExerciseFeedback
    4. Test login con credenziali utente test
    5. Elimina project temporaneo (no costi aggiuntivi)
    6. Documenta risultati in log operativo
  - **Scadenza test**: Primo test a deploy prod iniziale, poi ogni 3 mesi (calendario trimestrale)
  - **Accettabilità RPO 24h**: Per app fitness non-transazionale, perdere 1 giorno progressi allenamento è accettabile (non banking/healthcare)
  - **Escalation futura**: Se app diventa business-critical (atleti pro paganti), upgrade a:
    - Supabase PITR (Point-in-Time Recovery) add-on +€100/mese → RPO < 1 minuto
    - Oppure pg_dump automatico ogni 6h su S3 → RPO 6h, costo ~€1-2/mese
  - **Benefici**: Backup garantito, procedura testata, RPO/RTO chiari, costo €0 incrementale
- **ODR-14 - Monitoring & Alerting**:
  - **Stack monitoring completo** (€0 totale):
    1. **Health Check Endpoint**:
       - Route: `GET /api/health`
       - Verifiche: Prisma DB connection (`SELECT 1`), Supabase Auth status API
       - Response: `200 { status: 'healthy', checks: {...} }` se OK, `503 { status: 'unhealthy' }` se fail
       - Timeout: 5s per check, fail-fast
       - Setup: 15 minuti implementazione
    2. **Uptime Monitoring - UptimeRobot**:
       - **Free tier**: 50 monitor, check ogni 5 minuti
       - **Monitor configurati**:
         - `prod.zerocento.app/api/health` (produzione)
         - `test.zerocento.app/api/health` (staging)
       - **Alerting**: Email immediate su downtime, 2 retry prima di alert (riduce falsi positivi)
       - **Status page**: Opzionale pubblico (uptimerobot.com/[project])
       - **Setup**: 5 minuti registrazione + config
       - **Scelta vs Better Uptime**: UptimeRobot offre 50 monitor (vs 10), check 5min accettabile per MVP, setup più rapido
    3. **Error Tracking - Sentry**:
       - Free tier: 5K eventi/mese (già previsto in design)
       - Error aggregation, stack traces, user context
       - Alert email su error spike
       - Source maps per produzione
    4. **Performance Monitoring - Vercel Analytics**:
       - Incluso in Vercel Pro (già pagato)
       - Web Vitals: LCP, FID, CLS
       - Real User Monitoring per frontend
  - **Setup totale**: <1 ora (health endpoint 15min + UptimeRobot 5min + Sentry config 20min + Vercel enable 2min)
  - **Copertura operativa**:
    - ✅ Uptime: check ogni 5min con email alert
    - ✅ Health applicativo: DB + Auth verificati
    - ✅ Errori: tracciati e aggregati
    - ✅ Performance: Web Vitals monitorate
  - **Benefici**: Visibilità completa infra + app, alert immediati su outage, zero costi, minimal effort
  - **Limitazioni accettate**: No backend tracing/slow query detection (Sentry Performance €26/mese), sufficiente per MVP
- **Costi complessivi**:
  - Upstash Redis: €0 (free tier)
  - Supabase backup: €0 (incluso Pro)
  - UptimeRobot: €0 (free tier)
  - Sentry: €0 (free tier)
  - Vercel Analytics: €0 (incluso Pro)
  - **Totale incrementale: €0** (nessun aggiornamento budget €45-48/mese)
- **Chiusura decisioni**: **ODR-03**, **ODR-13**, **ODR-14** risolti ✅
- **Implicazioni implementative**:
  - Middleware: aggiornare con branch logic auth (Upstash) vs non-auth (in-memory)
  - Health endpoint: implementare `app/api/health/route.ts` con Prisma check + Supabase status
  - UptimeRobot: registrazione account, configurazione 2 monitor prod/staging
  - Documentazione operativa: procedura test restore trimestrale, playbook risposta incident
- **Implicazioni**: Security auth protetta da brute-force, backup strategy documentata e testabile, monitoring operativo completo. Stack production-ready a costo zero incrementale. Setup rapido minimal effort. Scalabilità futura garantita (upgrade path chiari se necessario).

---

## 2026-03-28 (rev 27)
- **Azione**: Implementazione permessi super-user admin per gestione operativa globale.
- **Requisito**: Admin deve avere CRUD completo su TUTTE le risorse del sistema per gestione ordinaria e straordinaria (handover trainer, supporto emergenze, QA schede).
- **Decisione**: Admin ha permessi completi senza restrizioni su schede, trainee, report, con capacità di riassegnazione trainer.
- **Modello permessi aggiornato**:
  - **Schede / Programmi**: Admin ha CRUD su TUTTE le schede di TUTTI i trainer (vs solo lettura precedente)
    - Admin può modificare schede anche se `status=active` o `completed` (eccezione regola immutabilità)
    - Admin può eliminare schede anche attive (con warning, per gestione emergenze)
  - **Associazioni trainer**: Admin ha CRUD con riassegnazione trainee tra trainer (gestione handover)
  - **Feedback**: Admin ha lettura completa di tutti i feedback (vs limitato precedente)
  - **Massimali**: Admin ha CRUD su massimali di tutti i trainee (vs solo lettura precedente)
  - **Reportistica**: Admin accede a report system-wide di tutti i trainee e tutti i trainer
- **Nuovi endpoint API** (03_backend_api.md):
  - `GET /api/admin/programs` — lista TUTTE le schede con filtri (trainer/trainee/status/search)
  - `GET /api/admin/programs/[id]` — dettaglio scheda di qualsiasi trainer
  - `POST /api/admin/programs` — crea scheda per qualsiasi trainee (bypass ownership)
  - `PUT /api/admin/programs/[id]` — modifica scheda qualsiasi trainer (anche active/completed)
  - `DELETE /api/admin/programs/[id]` — elimina scheda qualsiasi trainer (anche active)
  - `POST /api/admin/programs/[id]/publish` — pubblica scheda draft di qualsiasi trainer
  - `PUT /api/admin/trainer-trainee/[traineeId]` — riassegna trainee a nuovo trainer (handover)
- **Workflow riassegnazione trainee**:
  - Body request: `{ "newTrainerId": "uuid", "reason": "Motivazione handover" }`
  - Backend: DELETE vecchio `TrainerTrainee`, INSERT nuovo con `newTrainerId`
  - Schede esistenti mantengono `trainerId` originale (paternità), nuovo trainer può visualizzarle (read) ma non modificarle
  - Nuovo trainer può creare nuove schede per trainee riassegnato
  - Response: `{ "traineeId", "oldTrainerId", "newTrainerId", "reassignedAt" }`
- **Nuove pagine frontend** (02_frontend_design.md):
  - `/admin/programs` — lista globale schede con filtri e ricerca
  - `/admin/programs/[id]` — dettaglio/modifica scheda qualsiasi trainer (override immutabilità)
  - `/admin/programs/[id]/progress` — monitoraggio avanzamento con feedback
  - `/admin/trainees/[id]/reassign` — form riassegnazione trainee a nuovo trainer
  - `/admin/reports` — dashboard report globali (volume, SBD, feedback system-wide)
- **Nuove User Stories** (10_user_stories.md):
  - **US-A09**: Visualizzare tutte le schede di tutti i trainer con filtri
  - **US-A10**: Modificare qualsiasi scheda (anche active/completed) per emergenze
  - **US-A11**: Eliminare schede di qualsiasi trainer per gestione eccezionale
  - **US-A12**: Riassegnare trainee tra trainer (handover gestito)
  - **US-A13**: Accedere a report e monitoraggio system-wide
  - **US-A14**: Visualizzare audit log operazioni straordinarie admin
  - Totale user stories aggiornato: **48** (da 42)
- **Casi d'uso admin**:
  1. **Handover trainer**: Trainer lascia → admin riassegna trainee → visualizza/modifica schede orfane
  2. **Supporto emergenze**: Trainee segnala bug scheda → admin interviene direttamente
  3. **Revisione qualità**: Admin supervisiona schede trainer junior per QA metodologica
  4. **Correzione errori critici**: Admin corregge scheda per conto trainer impegnato/assente
- **Validazione backend**:
  - Helper `canAccessProgram(user, program)`: admin bypassa tutti i check
  - Admin può operare su schede immutabili (trainer/trainee ricevono 403 Forbidden)
  - Audit log per operazioni admin su schede e riassegnazioni (tracciabilità)
- **Sezione dettagliata** in 05_security_auth.md:
  - "Admin Override: Gestione Operativa Globale"
  - Permessi admin su schede, workflow riassegnazione, UI admin, casi d'uso, validazione
  - Note su gestione schede dopo riassegnazione (paternità vs accesso)
- **Rationale**:
  - ✅ **Gestione operativa**: Admin risolve emergenze senza bloccare trainee/trainer
  - ✅ **Handover trainer**: Procedura gestita per cambio trainer senza perdere continuità
  - ✅ **QA e supervisione**: Admin verifica qualità schede per garantire standard servizio
  - ✅ **Supporto utenti**: Admin interviene su problemi tecnici trainer/trainee
  - ✅ **Zero downtime**: Problemi risolti immediatamente da admin, no attesa trainer
- **Chiusura decisione**: **ODR-08** risolto ✅
- **Implicazioni implementative**:
  - Middleware auth: check admin bypassa tutte le restrizioni ownership
  - Frontend: route admin con tabelle globali, filtri avanzati, badge "Admin Override" su azioni
  - Backend: validazione role=admin permette operazioni su risorse immutabili
  - Audit log: logging strutturato per tutte le operazioni admin (Pino + Sentry)
- **Implicazioni**: Admin ha ruolo super-user senza restrizioni. Gestione operativa garantita anche in situazioni eccezionali. Handover trainer gestito con continuità servizio. Trainer mantiene isolamento (non vede schede altri trainer). QA e supporto garantiti da admin con visibilità completa.

---

## 2026-03-28 (rev 26)
- **Azione**: Aggiunta funzionalità riferimento carico riga precedente per esercizi ripetuti nello stesso workout.
- **Requisito**: Trainer deve poter inserire lo stesso esercizio più volte nella stessa giornata con carichi differenziati facendo riferimento al carico della prima occorrenza (non al massimale).
- **Caso d'uso**: 
  - Wave loading: Squat 1×2 @ 100kg → Squat 3×4 @ -5% (95kg) → Squat 5×6 @ -10% rispetto prima (90kg)
  - Cluster set: Squat 3×3 @ 90kg → Squat 3×3 @ 0% (identico) → Squat 3×3 @ -15% (drop set finale)
  - Back-off set: Squat 1×1 @ 100% 1RM → Squat 5×5 @ -20% (volume)
- **Modello dati**:
  - **WorkoutExercise.weightType**: Nuovo valore enum `percentage_previous` (in aggiunta a `absolute`, `percentage_1rm`, `percentage_rm`)
  - **WorkoutExercise.weight**: Quando `weightType=percentage_previous`, contiene percentuale relativa (es. -5 = -5%, +10 = +10%, 0 = identico)
  - **Logica**: Sistema cerca PRIMA occorrenza dello stesso `exerciseId` nel medesimo `workoutId` con `order < current`, applica percentuale al carico base
- **Calcolo peso effettivo**:
  - Sistema risolve carico base della prima occorrenza (può essere absolute, percentage_1rm, percentage_rm, o ricorsivamente percentage_previous)
  - Applica formula: `carico_base * (1 + weight/100)`
  - Esempio: Prima occorrenza 100kg, seconda occorrenza weight=-5 → 100 × 0.95 = 95kg
- **Validazione backend**:
  - Schema Zod: verifica che `weight` sia presente quando `weightType=percentage_previous`
  - Backend validation: verifica esistenza occorrenza precedente prima di salvare WorkoutExercise
  - Se nessuna occorrenza precedente trovata → errore 400 "Impossibile usare percentage_previous: nessuna occorrenza precedente dello stesso esercizio"
- **UI Frontend (componente WeightTypeSelector)**:
  - Radio button "Riferimento Riga Precedente" con query automatica occorrenza precedente
  - Se trovata: mostra dettagli prima occorrenza (es. "Squat @ 100kg (riga 1)")
  - Input percentuale con preview calcolo real-time (es. "-5% → 95.0 kg")
  - Se non trovata: alert inline "⚠️ Nessuna occorrenza precedente dello stesso esercizio"
  - Validazione: min -100%, max +100%
- **Casi edge gestiti**:
  - Catene ricorsive: Se riga 2 usa percentage_previous e riga 3 fa riferimento a riga 1 (non riga 2), sistema risolve correttamente
  - Limite ricorsione: max 10 livelli per prevenire loop infiniti
  - Validazione frontend + backend per consistenza
- **Test coverage**:
  - Unit test: `calculateEffectiveWeight()` con percentage_previous (riduzione, aumento, zero change, recursive chain, errore no previous)
  - Unit test: validazione Zod schema per percentage_previous
  - E2E test P1: Trainer crea workout con esercizio ripetuto usando percentage_previous con preview e salvataggio
  - E2E test P2: Trainer prova percentage_previous senza occorrenza precedente → validazione blocca con errore
- **User Story**: Aggiunta **US-T20a** per riferimento carico riga precedente con tecniche avanzate (wave loading, cluster set, back-off set)
- **Documentazione aggiornata**:
  - 04_data_model.md: Schema WorkoutExercise con nuovo enum `percentage_previous`, sezione "Gestione Peso e Intensità" espansa con esempi dettagliati e logica calcolo
  - 03_backend_api.md: Schema Zod validation per `percentage_previous`, helper `calculateEffectiveWeight()` con logica ricorsiva completa
  - 02_frontend_design.md: Componente `WeightTypeSelector` nella lista componenti riutilizzabili, sezione dettagliata con UI design, props, logica validazione, query occorrenza precedente, casi d'uso
  - 10_user_stories.md: User Story US-T20a con esempi concreti, totale user stories aggiornato a 42
  - 07_testing_strategy.md: Unit test per `calculateEffectiveWeight()` con tutti i casi edge, unit test per schema validation, E2E test workflow completo e validazione errori, aggiunta flusso P1 "trainer inserisce stesso esercizio con percentage_previous"
- **Benefici**:
  - ✅ **Automazione calcoli**: Trainer non deve ricalcolare manualmente pesi per ogni occorrenza ripetuta
  - ✅ **Tecniche avanzate**: Supporta wave loading, cluster set, back-off set con configurazione semplice
  - ✅ **Flessibilità**: Percentuali negative (riduzione), positive (aumento), zero (identico) copre tutti i pattern
  - ✅ **Validazione robusta**: Errori chiari se configurazione invalida (no occorrenza precedente)
  - ✅ **Preview UX**: Trainer vede peso calcolato in tempo reale durante configurazione
- **Implicazioni implementative**:
  - Migration Prisma: Aggiungere `percentage_previous` a enum `weightType`
  - Backend: Implementare logica ricorsiva `calculateEffectiveWeight()` con limit 10 livelli
  - Frontend: Query API per occorrenza precedente (`GET /api/workout-exercises?workoutId=X&exerciseId=Y&orderLt=Z`)
  - Testing: Coverage completo unit + E2E per tutti i casi edge
- **Implicazioni**: Funzionalità avanzata che supporta pattern di programmazione sofisticati usati da trainer esperti. Differenzia piattaforma ZeroCento da soluzioni generiche. Automazione calcoli migliora UX e riduce errori manuali. Sistema robusto con validazione e preview real-time.

---

## 2026-03-28 (rev 25)
- **Azione**: Chiarimento immutabilità schede pubblicate - rimosso riferimento ambiguo a "versionamento"
- **Decisione**: Schede pubblicate (`status=active` o `status=completed`) sono **IMMUTABILI**. Trainer può modificare schede SOLO se `status=draft`.
- **Rationale**:
  - **Integrità dati**: Feedback trainee, date, avanzamento devono rimanere coerenti con la scheda originale pubblicata
  - **Semplicità architetturale**: Nessun versionamento, nessuna duplicazione di entità annidate, no campi `previousVersionId`
  - **UX chiara**: Trainer sa che pubblicazione = commit finale, nessuna modifica retroattiva possibile
  - Se trainer vuole cambiamenti, crea nuova scheda da zero (caso d'uso raro per MVP con ~50 trainee)
- **Modifiche comportamento API**:
  - `PUT /api/programs/[id]` su scheda `active/completed` → **403 Forbidden** (precedentemente documentazione diceva "richiede creazione nuova versione" senza definire come)
  - `DELETE /api/programs/[id]` su scheda `active/completed` → **403 Forbidden** (già esistente, confermato)
  - Validazione backend: `if (program.status !== 'draft') throw new ForbiddenError('...')`
- **Aggiornamenti documentazione**:
  - 03_backend_api.md: Corretto note workflow con `PUT` bloccato su schede pubblicate, aggiunto warning su `POST /publish`
  - 04_data_model.md: Aggiunto commento IMPORTANTE su immutabilità schede nell'entità `TrainingProgram`
  - design-review/00_review_v1.md: Marcato "Versionamento schede" come ✅ **RISOLTO** (non previsto versionamento)
- **Implicazioni implementative**:
  - Validazione API: aggiungere check `status === 'draft'` prima di permettere PUT/DELETE su `TrainingProgram`
  - Frontend: disabilitare pulsante "Modifica" su schede active/completed, mostrare badge "Pubblicata - Non modificabile"
  - Test E2E: aggiungere test per `PUT /api/programs/[id]` con scheda active → expect 403
- **Decisione**: **No versionamento per MVP** ✅ (eventuale post-MVP se emerge necessità)

---

## 2026-03-28 (rev 24)
- **Azione**: Chiarimento relazione trainer-trainee (1:1) e workflow schede active → completed.
- **Decisione**: 
  1. **Relazione 1:1 trainer-trainee**: Un trainee può avere UN SOLO trainer. Aggiunto UNIQUE constraint su `TrainerTrainee.traineeId`.
  2. **Workflow active → completed**: La scheda passa automaticamente a 'completed' al termine dell'ultima settimana (endDate).
- **Rationale**:
  - **Relazione 1:1**: Semplifica gestione responsabilità e autorizzazioni. Se necessario cambio trainer, eliminare vecchio record e crearne uno nuovo.
  - **Workflow automatico**: La transizione è basata su tempo (endDate calcolato), non su azioni manuali. I feedback richiesti vengono inviati quando specificato dal trainer, ma la scheda passa comunque a 'completed' al termine del periodo.
- **Modifiche schema**:
  - ✅ Aggiunto: `TrainerTrainee.traineeId UNIQUE` constraint
  - ✅ Aggiunto: `TrainerTrainee.createdAt DateTime` per audit trail
  - ✅ Documentato: Note workflow su `TrainingProgram.status` per transizione automatica
- **Workflow feedback e transizione schede**:
  - **Feedback richiesti** (`Week.feedbackRequested=true`): Trainee deve compilare feedback per TUTTI gli esercizi della settimana specificata
  - **Invio esplicito**: `POST /api/programs/[id]/submit` per inviare feedback compilati al trainer in qualsiasi momento
  - **Transizione automatica**: Job schedulato (cron daily) verifica `endDate = startDate + (durationWeeks * 7)` e aggiorna `status=completed`
  - Se ci sono feedback pendenti all'ultima settimana, la scheda passa comunque a 'completed'
  - Trainee NON può fornire feedback su schede 'completed'
- **Aggiornamenti documentazione**:
  - 04_data_model.md: Schema `TrainerTrainee` con UNIQUE constraint, note relazione 1:1, workflow transizione schede
  - 03_backend_api.md: Endpoint `POST /api/programs/[id]/submit`, note vincolo 1:1, workflow feedback
  - 08_open_decisions.md: **ODR-05** e **ODR-06** marcate come risolte
- **Implicazioni implementative**:
  - Migration Prisma: ADD UNIQUE constraint su `TrainerTrainee.traineeId`, ADD column `createdAt`
  - Validazione API `/api/users` (POST trainee): verificare che non esista già record `TrainerTrainee` per quel `traineeId`
  - Job schedulato: Vercel Cron o GitHub Actions per check daily schede da completare
  - API `POST /api/programs/[id]/submit`: validazione feedback completi se settimana ha `feedbackRequested=true`
- **Decisioni**: **ODR-05** e **ODR-06** chiuse ✅

---

## 2026-03-28 (rev 23)
- **Azione**: Rimozione campo `User.initialPassword` per migliorare la sicurezza.
- **Decisione**: Eliminato il campo `initialPassword` dal modello `User`. Le password temporanee NON vengono più salvate nel database.
- **Rationale**:
  - Anche se encrypted, salvare password temporanee nel DB rappresenta una vulnerabilità: se la chiave di encryption viene compromessa, tutte le password non ancora cambiate sono esposte
  - Il flag `mustChangePassword` gestito da Supabase auth è sufficiente per forzare il cambio password al primo login
  - Principio di **least privilege** e **riduzione superficie di attacco**
  - Se un trainer necessita di rigenerare la password per un trainee, può farlo creando una nuova password temporanea (non serve "ri-visualizzare" quella vecchia)
- **Modifiche schema**:
  - ❌ Rimosso: `User.initialPassword String?`
  - ✅ Confermato: flag `mustChangePassword` gestito da Supabase per forzare cambio password
- **Aggiornamenti documentazione**:
  - 04_data_model.md: Rimosso campo `initialPassword` da schema User, aggiornate note creazione trainee
  - 05_security_auth.md: Aggiornata sezione "Gestione Password Iniziali", rimossa logica di salvataggio password
  - 08_open_decisions.md: **ODR-04** marcata come risolta
- **Implicazioni implementative**:
  - Migration Prisma: DROP column `initialPassword` da tabella User
  - API `/api/trainer/trainees` (POST): non salvare più la password temporanea, restituirla solo nella response
  - UX: Confermare che il trainer abbia copiato la password prima di chiudere il modal (non più recuperabile)
- **Decisione**: **ODR-04** chiusa ✅

---

## 2026-03-28 (rev 22)
- **Azione**: Normalizzazione dati feedback con tabella SetPerformed.
- **Decisione**: Sostituire campo JSON `ExerciseFeedback.setsPerformed` con tabella relazionale **SetPerformed** (1:N).
- **Schema SetPerformed**:
  ```
  SetPerformed
    id          UUID  PK
    feedbackId  FK → ExerciseFeedback
    setNumber   Int         -- numero progressivo (1, 2, 3, ...)
    reps        Int         -- ripetizioni eseguite
    weight      Float       -- peso in kg
    createdAt   DateTime
    
    UNIQUE(feedbackId, setNumber)
  ```
- **Benefici**:
  - ✅ **Type-safety completa**: no parsing JSON runtime, validazione DB-level
  - ✅ **Query aggregate efficienti**: `SELECT MAX(weight) FROM SetPerformed WHERE feedbackId IN (...)` per peso massimo esercizio
  - ✅ **Indicizzazione**: indici su feedbackId, setNumber per performance
  - ✅ **Constraint UNIQUE**: impossibile duplicare numero serie per stesso feedback
  - ✅ **Scalabilità gestibile**: volumetria stimata ~50K righe (54 trainee × 12w × 4 workout × 6 ex × 3.5 set)
- **Modifiche schema ExerciseFeedback**:
  - ❌ Rimosso: `setsPerformed Json`
  - ✅ Confermato: `notes String?` per commenti testuali liberi trainee
  - ✅ Aggiunti: `createdAt` e `updatedAt` per audit trail
- **Aggiornamenti documentazione**:
  - 04_data_model.md: Aggiunta tabella SetPerformed, aggiornate relazioni e query esempio
  - 03_backend_api.md: Schema Zod aggiornato con validazione `sets` array (setNumber, reps, weight)
  - 02_frontend_design.md: Interface FeedbackDraft con `sets: Array<{setNumber, reps, weight}>`
  - 10_user_stories.md: US-U07 e US-T26 già menzionano note testuali (no modifiche)
- **Rationale**:
  - Campo JSON bypassa type-safety, impedisce query aggregate ("peso max esercizio X negli ultimi 3 mesi")
  - Volumetria ~50K set è gestibile con normalizzazione (nessun vincolo sharding)
  - PostgreSQL gestisce 50K righe in microsecondi con indici appropriati
  - Pattern standard per dati strutturati relazionali
- **Implicazioni implementative**:
  - Migration Prisma: creare tabella SetPerformed, migrare dati JSON esistenti (se presenti), drop colonna setsPerformed
  - API `/api/feedback`: body request accetta `sets: [{setNumber, reps, weight}, ...]`, backend crea N righe SetPerformed
  - Query reportistica: JOIN ExerciseFeedback + SetPerformed per analisi peso/volume
- **Decisione**: **ODR-02** chiusa.

---

## 2026-03-28 (rev 21)
- **Azione**: Chiusura decisione architetturale su provider autenticazione.
- **Decisione**: **Supabase Auth confermato definitivamente** come provider esclusivo per autenticazione e sessioni.
- **Modifiche documentazione**:
  - 03_backend_api.md: Rimossa tabella endpoint `/api/auth/[...nextauth]` (pattern NextAuth.js). Sostituita con sezione "Auth" che chiarisce:
    - Autenticazione gestita da Supabase client SDK (`@supabase/auth-helpers-nextjs`)
    - Login/Logout/Session via `supabase.auth.signInWithPassword()` e `supabase.auth.signOut()`
    - Non servono endpoint API Routes custom per MVP (email+password)
    - Endpoint `/api/auth/callback` necessario solo per OAuth post-MVP (Google, GitHub)
  - 08_open_decisions.md: **ODR-01 chiuso** — conflitto NextAuth vs Supabase Auth risolto
- **Rationale**:
  - Supabase Auth è già infrastruttura scelta per DB e sessioni JWT
  - NextAuth richiederebbe duplicazione gestione sessioni e configurazione manuale
  - Supabase Auth include out-of-the-box: JWT automatic refresh, cookie HTTP-only, email templates, OAuth providers
  - Coverage AI eccellente per `@supabase/auth-helpers-nextjs`
  - Zero setup per MVP, massima coerenza architetturale
- **NON c'è conflitto**: NextAuth e Supabase Auth sono alternativi, non possono coesistere. Scelta definitiva: **Supabase Auth**.
- **Decisione**: **ODR-01** chiusa.

---

## 2026-03-28 (rev 20)
- **Azione**: Password reset e notifiche email configurate per MVP.
- **Decisione**: Usare **Supabase Email Service** (default, zero setup) per gestione password reset. Email incluse in Supabase Pro (300/mese), template personalizzabili in italiano, flusso automatico con magic link.
- **Primo login trainee**: Comunicazione credenziali temporanee **manualmente** via WhatsApp/telefono da parte del trainer (no email automatica). Trainee fa login → cambio password obbligatorio.
- **Rationale**:
  - ✅ Zero configurazione SMTP per MVP (focus su features core)
  - ✅ Free tier 300 email/mese abbondante per 54 utenti (~110 email/anno stimati)
  - ✅ Comunicazione diretta trainer-trainee già consolidata (WhatsApp)
  - ✅ Evita rischio email benvenuto in spam (nuovo dominio senza reputation)
- **Post-MVP opzionale**: Migrazione a SMTP custom (Resend/SendGrid) per email benvenuto automatica con branding ZeroCento.
- **Effort stimato**: 3.5 ore (UI forgot-password + reset-password + personalizzazione template + test).
- **Decisione**: **OD-33b** chiusa.
- **Modifica permessi reportistica**: Reportistica personale **non più visibile al trainee** (solo admin e trainer). Rationale: dati aggregati e analisi sono strumenti di lavoro per trainer, trainee si concentra su esecuzione allenamento e feedback immediato.
- **Modifica permessi massimali**: Massimali **gestiti esclusivamente dal trainer**, trainee ha solo visualizzazione (lettura). Rationale: i massimali sono parametri tecnici fondamentali per calcolo intensità schede, devono essere validati e tracciati dal trainer per correttezza metodologica e sicurezza. Trainee visualizza i propri massimali come riferimento durante allenamento.
- **Impatto**:
  - User Stories: da 42 a 41 (rimossa US-U13 su aggiunta/modifica massimali trainee, US-U14 diventa US-U13)
  - API: endpoint `/api/trainee/records` solo GET, aggiunto CRUD completo a `/api/trainer/trainees/[id]/records/*`
  - Frontend: `/trainee/records` da "Gestione" a "Visualizzazione", `/trainer/trainees/[id]/records` da "Visualizza/modifica" a "Gestione completa (CRUD)"
  - Test: aggiunti test P1 per trainer CRUD massimali, test P2 per verifica 403 su tentativi modifica trainee

---

## 2026-03-27 (rev 19)
- **Azione**: Workflow completo creazione schede con vista alto livello, colori MovementPattern personalizzabili, draft incrementale, pubblicazione con mapping calendario.
- **Requisito**: Trainer deve poter creare schede con approccio top-down: setup iniziale (durata/frequenza) → vista alto livello settimana tipo con distribuzione MovementPattern colorati → dettaglio singoli allenamenti → pubblicazione con scelta data inizio.
- **Workflow implementato**:
  1. **Setup iniziale** (`POST /api/programs`): Trainer definisce durata settimane + allenamenti/settimana. Sistema crea `TrainingProgram` draft + Week + Workout vuoti.
  2. **Vista alto livello** (`/trainer/programs/[id]/week-overview`): Griglia settimana tipo con workout days. Trainer aggiunge esercizi in modalità rapida. UI mostra MovementPattern con colori personalizzati per visualizzare bilanciamento schemi motori (es. 🟣 Squat, 🔵 Push, 🟢 Pull).
  3. **Dettaglio workout** (`/trainer/programs/[id]/workout/[wId]`): Trainer entra nel singolo allenamento, compila dettagli per ogni esercizio (sets, reps, RPE, peso, recupero, note).
  4. **Salvataggio incrementale**: Scheda salvabile infinite volte come `status=draft`. Auto-save ogni 30s. Trainer può chiudere e riprendere dopo.
  5. **Pubblicazione** (`POST /api/programs/[id]/publish`): Trainer sceglie data inizio Week 1 (es. "1 Aprile 2026"). Sistema valida completezza scheda, aggiorna `status=active`, popola `TrainingProgram.startDate` e calcola `Week.startDate` per tutte le settimane (Week 1 = startDate, Week 2 = startDate+7, etc.).
- **Nuove entità DB**:
  - **MovementPatternColor**: Tabella many-to-many (trainerId, movementPatternId, color). Ogni trainer personalizza colori per vista overview.
  - **TrainingProgram.publishedAt** (DateTime?): Timestamp pubblicazione.
  - **TrainingProgram.updatedAt** (DateTime): Per ordinare draft per ultima modifica.
  - **Week.startDate** (Date?): Calcolato automaticamente a pubblicazione. Usato per reportistica (mapping feedback → date reali).
- **Colori MovementPattern**:
  - Tabella `MovementPatternColor` con constraint UNIQUE(trainerId, movementPatternId)
  - Default colors se trainer non ha personalizzazione: Squat=#8b5cf6, Horizontal Push=#3b82f6, Pull=#10b981, etc.
  - Endpoint `PUT /api/trainer/movement-pattern-colors/[patternId]` con body `{color: "#hex"}`
  - Validazione hex color: regex `^#[0-9A-Fa-f]{6}$`
- **Mapping calendario Week → Date**:
  - Pubblicazione richiede `week1StartDate` (es. "2026-04-01")
  - Backend calcola: Week[n].startDate = program.startDate + (n-1)*7 giorni
  - Esempio: Week 1 = 1 Apr, Week 2 = 8 Apr, Week 3 = 15 Apr, ..., Week 12 = 17 Jun
  - Reportistica usa `Week.startDate` + `ExerciseFeedback.date` per correlazione temporale (FRQ/NBL/IM per periodo)
- **Validazione pubblicazione**:
  - Ogni Workout deve avere almeno 1 WorkoutExercise
  - Ogni WorkoutExercise deve avere: sets, reps, weightType, restTime (campi obbligatori)
  - Se validazione fail → `400 Bad Request` con dettaglio workout incompleti
- **Stati scheda**:
  - `draft`: Modificabile, non visibile a trainee, startDate=null
  - `active`: Pubblicata, visibile a trainee, startDate popolato, **modifiche bloccate (immutabile)**
  - `completed`: Terminata (dopo ultima settimana), archiviabile
- **Nuovi endpoint API**:
  - `POST /api/programs/[id]/publish` con body `{week1StartDate: "YYYY-MM-DD"}`
  - `GET/PUT /api/trainer/movement-pattern-colors/[patternId]`
  - `DELETE /api/trainer/movement-pattern-colors/[patternId]` (reset a default)
- **Nuove pagine frontend**:
  - `/trainer/programs` (lista schede con badge draft/active/completed)
  - `/trainer/programs/[id]/week-overview` (griglia settimana tipo con esercizi colorati per MovementPattern)
  - `/trainer/programs/[id]/publish` (modal scelta data Week 1 + validazione pre-pubblicazione)
  - `/trainer/settings/movement-colors` (color picker per personalizzare MovementPattern)
- **Nuovi componenti**:
  - `WeekOverviewGrid`: Griglia giorni settimana con drag-and-drop esercizi
  - `WorkoutDayColumn`: Colonna singolo giorno con lista esercizi + badge colorati MovementPattern
  - `MovementPatternTag`: Badge con colore custom trainer + nome pattern
  - `ColorPicker`: HEX input + palette predefinita per selezione colori
  - `PublishModal`: Modal con date picker + preview distribuzione settimane + validazione
- **UX vista alto livello**:
  ```
  Week Overview - Settimana Tipo
  ┌─────────────────────────────────────────────────────────┐
  │ Day 1          Day 2          Day 3          Day 4      │
  │ 🟣 Squat       🔵 Bench       🟢 Deadlift    🔴 OHP     │
  │ 🟣 Front Sq    🔵 Incline     🟢 RDL         🟡 Lat R   │
  │ 🟢 Pull-up     🟢 Row         🔵 Dips        🟣 Leg P   │
  │ [+ Add]        [+ Add]        [+ Add]        [+ Add]    │
  └─────────────────────────────────────────────────────────┘
  
  Legend (personalizza colori):
  🟣 Squat  🔵 Push  🟢 Pull  🔴 Hip Ext  🟡 Vertical
  ```
- **Progresso compilazione**:
  UI mostra stato completamento per aiutare trainer:
  ```
  Scheda "Powerlifting 12w" (Draft)
  ✅ Week 1: 4/4 workout completi
  ⚠️  Week 2: 2/4 workout completi  
  🔘 Week 3-12: non iniziate
  
  [Continua] [Pubblica] (disabilitato se incompleta)
  ```
- **Benefici**:
  - ✅ **Vista strategica**: Trainer vede bilanciamento MovementPattern prima di entrare in dettaglio
  - ✅ **Colori personalizzati**: Ogni trainer usa propria codifica colori (utile se multi-metodologia)
  - ✅ **Salvataggio incrementale**: Nessuna perdita lavoro, compilazione in più sessioni
  - ✅ **Pubblicazione controllata**: Trainer decide quando rendere visibile scheda a trainee
  - ✅ **Mapping calendario**: Date reali per reportistica accurata (non solo "Week 1/2/3")
  - ✅ **Validazione pre-pubblicazione**: Previene schede incomplete pubblicate per errore
- **Testing**: Aggiunti test P1 per workflow completo creazione-pubblicazione, P2 per salvataggio draft incrementale, P2 per validazione pubblicazione, P3 per personalizzazione colori
- **Documentazione aggiornata**:
  - 04_data_model.md: Entità MovementPatternColor, campi TrainingProgram/Week aggiornati, sezione "Workflow Creazione Scheda" con esempi step-by-step
  - 02_frontend_design.md: Nuove route workflow schede, nuovi componenti vista overview
  - 03_backend_api.md: Endpoint `/api/programs/[id]/publish` e `/api/trainer/movement-pattern-colors/*`
- **Implicazioni**: Workflow UX ottimizzato per processo reale trainer (top-down: strategia → tattica). Colori personalizzati migliorano usabilità per trainer con metodologie diverse (powerlifting vs bodybuilding). Mapping calendario essenziale per reportistica temporale accurata. Draft incrementale elimina pressione "completare tutto in una sessione".

---

## 2026-03-27 (rev 18)
- **Azione**: Trasformazione gruppi muscolari e schemi motori da enum hardcoded a entità DB gestibili dinamicamente.
- **Requisito**: Admin e trainer devono poter aggiungere/modificare gruppi muscolari e schemi motori senza modificare codice, permettendo personalizzazione tassonomia esercizi.
- **Modello precedente**: 
  - `Exercise.muscleGroups` = JSON array con nomi hardcoded (es. `[{"name": "Pettorali", "coefficient": 0.8}]`)
  - `Exercise.movementPattern` = Enum hardcoded (`squat`, `horizontal_push`, etc.)
  - Modifica/espansione richiedeva deploy codice
- **Modello nuovo**:
  - **Tabella MuscleGroup**: Entità gestibile con `id`, `name`, `description`, `isActive`, `createdBy`
  - **Tabella MovementPattern**: Entità gestibile con `id`, `name`, `description`, `isActive`, `createdBy`
  - **Tabella ExerciseMuscleGroup**: Associazione many-to-many Exercise ↔ MuscleGroup con `coefficient` (0.0-1.0)
  - **Exercise.movementPatternId**: Foreign key a `MovementPattern` (vs enum)
- **Nuove entità DB**:
  ```sql
  MuscleGroup (id, name UNIQUE, description, isActive, createdBy, createdAt)
  MovementPattern (id, name UNIQUE, description, isActive, createdBy, createdAt)
  ExerciseMuscleGroup (id, exerciseId FK, muscleGroupId FK, coefficient Float)
    UNIQUE(exerciseId, muscleGroupId)
  ```
- **Relazioni**:
  - `MuscleGroup` ↔ N `Exercise` via `ExerciseMuscleGroup` (many-to-many con coefficient)
  - `MovementPattern` → N `Exercise` (one-to-many)
- **Permission CRUD**:
  - **Admin**: CRUD completo su gruppi e schemi
  - **Trainer**: CRUD completo (libreria condivisa, come per esercizi)
  - **Trainee**: Solo lettura (per filtri/ricerca)
- **Nuovi endpoint API**:
  - `GET/POST /api/muscle-groups` — Lista/crea gruppi muscolari
  - `PUT /api/muscle-groups/[id]` — Modifica gruppo
  - `PATCH /api/muscle-groups/[id]/archive` — Archivia (isActive=false)
  - `DELETE /api/muscle-groups/[id]` — Elimina (solo se non usato)
  - `GET/POST /api/movement-patterns` — Lista/crea schemi motori
  - `PUT /api/movement-patterns/[id]` — Modifica schema
  - `PATCH /api/movement-patterns/[id]/archive` — Archivia
  - `DELETE /api/movement-patterns/[id]` — Elimina (solo se non usato)
- **Archiviazione soft**:
  - Campo `isActive=false` disabilita gruppo/schema obsoleto senza eliminarlo
  - Preserva integrità referenziale con esercizi esistenti
  - UX: Filtri "Solo attivi" di default, opzione "Mostra archiviati" per admin/trainer
- **Eliminazione fisica**:
  - Bloccata con `409 Conflict` se esistono riferimenti:
    - `MuscleGroup` usato in `ExerciseMuscleGroup` → eliminazione negata
    - `MovementPattern` usato in `Exercise` → eliminazione negata
  - Suggerimento UX: "Archivia invece di eliminare"
- **Seed data iniziale** (migration):
  - Gruppi muscolari base: Pettorali, Dorsali, Deltoidi, Bicipiti, Tricipiti, Quadricipiti, Femorali, Glutei, Core
  - Schemi motori base: Squat, Horizontal Push, Hip Extension, Horizontal Pull, Vertical Pull, Lunge, Other
  - `createdBy` = admin UUID, `isActive` = true
- **Esempi use case**:
  - Trainer specializzato powerlifting aggiunge schema "Sumo Deadlift Variation"
  - Trainer bodybuilding aggiunge gruppo "Obliqui" separato da "Core"
  - Admin archivia schema "Carry" poco usato (isActive=false)
- **Coefficiente incidenza** (ExerciseMuscleGroup):
  - `0.8-1.0`: Muscolo target primario
  - `0.5-0.7`: Muscolo sinergico
  - `0.1-0.4`: Muscolo stabilizzatore
  - Esempio Panca Piana: Pettorali 0.8, Tricipiti 0.5, Deltoidi anteriori 0.3
- **Query aggiornate**:
  - Filtro esercizi per gruppo muscolare: JOIN `ExerciseMuscleGroup` WHERE `muscleGroupId=X`
  - Filtro esercizi per schema motorio: WHERE `movementPatternId=X`
  - Serie allenanti per gruppo: JOIN via `ExerciseMuscleGroup`, sum serie pesate per coefficient
- **Benefici**:
  - ✅ **Flessibilità**: Espansione tassonomia senza deploy codice
  - ✅ **Personalizzazione**: Trainer adattano categorizzazioni a metodologie proprie
  - ✅ **Collaborazione**: Nuovi gruppi/schemi disponibili a tutti i trainer
  - ✅ **Integrità**: Archiviazione soft preserva storico senza rompere riferimenti
  - ✅ **Audit trail**: `createdBy` traccia autore gruppo/schema
- **Testing**: Aggiunti test P2 per CRUD gruppi/schemi, P2 per archiviazione, P2 per blocco eliminazione con riferimenti, P3 per filtri esercizi per gruppo/schema
- **Documentazione aggiornata**:
  - 04_data_model.md: Nuove entità MuscleGroup, MovementPattern, ExerciseMuscleGroup con schema e relazioni; sezione "Gruppi Muscolari Gestibili" e "Schemi Motori Gestibili" con esempi seed
  - 05_security_auth.md: Matrice permessi con nuove righe "Gruppi muscolari" e "Schemi motori" CRUD per admin/trainer; sezione "Dettaglio gruppi muscolari e schemi motori condivisi"
  - 03_backend_api.md: Nuovi gruppi endpoint `/api/muscle-groups` e `/api/movement-patterns` con authorization notes
- **Implicazioni**: Architettura data-driven per tassonomia esercizi. Elimina necessità modifiche codice per aggiungere categorizzazioni. Trainer autonomi nella gestione metadata esercizi. Sistema scalabile per metodologie training diverse (powerlifting, bodybuilding, crossfit, etc.).

---

## 2026-03-27 (rev 17)
- **Azione**: Strategia session management per allenamenti lunghi (60-90+ min) senza re-login.
- **Requisito**: Trainee usa app in palestra con frequente app switching (Instagram, musica, timer) durante recuperi tra serie. Sistema deve mantenere sessione attiva senza interruzioni.
- **Contesto d'uso utenti**:
  - **Trainer**: Accesso sporadico (15-30 min) per creazione contenuti (profili, schede) da desktop
  - **Trainee**: Accesso continuativo (60-90+ min) durante allenamento in palestra da mobile, con app in background durante recuperi
- **Session strategy**:
  - **Access Token JWT**: 4 ore expiry (copre allenamento 90min + ampio margine)
  - **Refresh Token**: 30 giorni expiry (utente non deve rifare login ogni giorno)
  - **Auto-refresh**: Supabase Auth rinnova automaticamente access token usando refresh token prima della scadenza
  - **Persist session**: Cookie HTTP-only + `persistSession: true` mantiene sessione anche dopo chiusura browser
- **Configurazione Supabase Auth**:
  ```typescript
  {
    jwt: { expiryDuration: 14400 },      // 4 ore
    refreshToken: { expiryDuration: 2592000 }, // 30 giorni
    autoRefreshToken: true,
    persistSession: true
  }
  ```
- **Workflow tipico trainee**:
  1. Login 10:00 → access token valido fino 14:00
  2. Allenamento 10:30-12:00 → app switcha tra esercizi + Instagram + timer
  3. Sessione rimane attiva (access token valido)
  4. Riapre app 14:30 → access token scaduto → Supabase auto-refresh con refresh token → nuovo access token → user rimane loggato senza interruzione
  5. Dopo 30 giorni inattività → refresh token scade → richiesto login (ragionevole)
- **PWA (Progressive Web App) per trainee**:
  - **Installazione**: Web App Manifest per icona home screen, modalità standalone (no browser UI), portrait lock
  - **Offline support**: Service Worker con cache strategy (scheda corrente cache-first, feedback network-first con queue)
  - **State persistence**: localStorage per feedback parziali (auto-save ogni 5s, ripristino dopo app switch)
  - **Install prompt**: Mostrato solo su mobile (<768px) per trainee, suggerisce installazione per accesso rapido
- **Protezione sicurezza**:
  - Cookie `Secure` (HTTPS only), `HttpOnly` (no JS access), `SameSite=Lax` (CSRF protection)
  - Refresh token rotation: Supabase genera nuovo refresh token ad ogni refresh, invalida vecchio (anti replay attack)
- **State persistence feedback**:
  - Hook `useFeedbackPersistence(workoutExerciseId)` salva draft in localStorage ogni 5s
  - Ripristina automaticamente form se trainee switcha app e torna
  - Auto-clear draft dopo 24h (evita accumulo storage)
- **Benefici**:
  - ✅ **Zero friction**: Trainee non deve mai rifare login durante allenamento
  - ✅ **App switching seamless**: Passa tra app senza perdere stato
  - ✅ **Dati sicuri**: Feedback parziale salvato, recuperabile dopo crash/chiusura accidentale
  - ✅ **Esperienza nativa**: PWA installabile con icona home screen, full-screen
  - ✅ **Offline capable**: Scheda consultabile anche senza rete (palestre con WiFi scarso)
- **Implicazioni tecniche**:
  - `next-pwa` package per generazione service worker
  - Web App Manifest in `/public/manifest.json`
  - Service Worker strategy: Workbox con NetworkFirst per API, CacheFirst per assets
  - Hook `useLocalStorage` per persistence feedback drafts
  - Component `InstallPrompt` per suggerire installazione PWA
- **Testing**: Aggiunti test P2 per session expiry + auto-refresh, P3 per PWA install prompt, P3 per feedback draft persistence
- **Documentazione aggiornata**:
  - 00_problem_statement.md: Sezione "Contesto d'uso" con dettaglio sessioni trainer/trainee
  - 05_security_auth.md: Sezione "Session Management per Allenamenti Lunghi" con configuration, workflow, security
  - 02_frontend_design.md: Sezione "PWA (Progressive Web App) per Trainee" con manifest, service worker, state persistence
- **Implicazioni**: UX trainee ottimizzata per uso reale palestra. Session 4h + auto-refresh elimina frustrazione re-login. PWA offre esperienza app nativa senza development iOS/Android. State persistence protegge lavoro utente da perdita dati accidentale. Strategia allineata con best practice mobile fitness apps.

---

## 2026-03-27 (rev 16)
- **Azione**: Libreria esercizi da privata per trainer a CONDIVISA tra tutti i trainer.
- **Requisito**: Gestione collaborativa libreria esercizi — tutti i trainer devono poter creare, modificare, eliminare qualsiasi esercizio.
- **Modello precedente**: Esercizi creati da trainer erano modificabili solo dal creatore (ownership via `Exercise.createdBy`)
- **Modello nuovo**: **Libreria condivisa** — tutti i trainer possono CRUD su TUTTI gli esercizi
- **Permission aggiornate**:
  - **Admin**: CRUD su qualsiasi esercizio
  - **Trainer**: CRUD su **qualsiasi esercizio** nella libreria (non solo i propri)
  - **Trainee**: Solo lettura (per consultare video/descrizioni durante allenamento)
  - Campo `Exercise.createdBy` mantenuto solo per **audit trail** (tracciabilità autore originale), **non determina ownership**
- **Autorizzazione backend**:
  - `GET /api/exercises`: accessibile a tutti (trainer per comporre schede, trainee per consultazione)
  - `POST /api/exercises`: solo admin e trainer (nuovo esercizio immediatamente disponibile a tutti)
  - `PUT /DELETE /api/exercises/[id]`: solo admin e trainer su **qualsiasi esercizio**
  - Validazione: verifica `role IN ('admin', 'trainer')`, **non** verifica `createdBy = current_user`
- **Protezione integrità**: Eliminazione esercizio usato in `WorkoutExercise` restituisce `409 Conflict` (foreign key constraint)
- **Rationale**:
  - ✅ **Collaborazione**: Trainer possono beneficiare degli esercizi creati da colleghi
  - ✅ **Evita duplicazione**: No bisogno di ricreare "Squat" per ogni trainer
  - ✅ **Libreria ricca**: Si arricchisce organicamente con contributi di tutti
  - ✅ **Manutenzione condivisa**: Correzione errori (es. link YouTube rotto) disponibile a tutti immediatamente
- **UX implications**:
  - Pagina `/trainer/exercises`: mostra TUTTI gli esercizi (non filtro per `createdBy`)
  - Badge "Creato da [Nome Trainer]" per tracciabilità visuale
  - Bottoni Edit/Delete attivi su qualsiasi esercizio (non solo propri)
  - Warning prima di eliminare: "Questa azione influenzerà tutti i trainer che usano questo esercizio"
- **Testing**: Aggiunti test P2 per verifica permission condivise (trainer A modifica esercizio creato da trainer B, successo 200; trainer A elimina esercizio trainer B, successo 200; trainee tenta modificare esercizio, 403; trainer elimina esercizio usato in scheda attiva, 409 Conflict)
- **Implicazioni**: Modello collaborativo aumenta valore piattaforma. Libreria evolve più rapidamente. Responsabilità condivisa richiede disciplina (no eliminazioni accidentali). Audit trail via `createdBy` mantiene tracciabilità.

---

## 2026-03-27 (rev 15)
- **Azione**: Chiusura completa stack Deploy, Scaling, Testing (OD-33, OD-34, OD-36, OD-37, OD-38, OD-39, OD-40, OD-41).
- **OD-33 - Ambienti**: 
  - **3 ambienti definiti**: Production (`prod.zerocento.app`), Staging (`test.zerocento.app`), Dev (`dev-*.zerocento.app`)
  - **Supabase Database Branching**: 1 progetto Pro con branch `main`, `staging`, `dev` (GRATIS, incluso in Pro)
  - **Strategia ottimizzazione costi**: Branch `staging` sempre attivo per QA, branch `dev` PAUSABILE quando non serve → €0 compute
  - **Verosimiglianza test**: Branch staging è clone esatto di main (stesso schema, seed dati realistici)
  - **Deployment URLs**: Preview deployments GRATIS illimitati con Vercel Pro (es. `pr-42.zerocento.app`)
- **OD-34 - CI/CD**:
  - **GitHub Actions attivo**: Workflow automatizzato per lint, type-check, unit test, E2E
  - **Deployment flow**: Feature branch → PR staging (unit tests) → auto-deploy test.zerocento.app (E2E) → PR main (se E2E GREEN) → deploy prod.zerocento.app
  - **Branch protection**: Main e staging protetti, require status checks (test + e2e-staging), manual approval opzionale su main
  - **Pipeline completa**: `.github/workflows/ci.yml` con jobs `test` (lint/typecheck/unit coverage 80%), `e2e-staging` (Playwright su test.zerocento.app), `deploy-prod` (conditional su main)
- **OD-36 - Connection Pooling**:
  - **Bottleneck risolto**: Supabase PgBouncer (port 6543, transaction pooling) incluso in Pro (GRATIS)
  - **Configurazione Prisma**: `connection_limit=10` per instance, `DATABASE_URL` pooled (port 6543), `DIRECT_URL` direct (port 5432 solo migrations)
  - **Capacity analysis**: 54 utenti → ~10 req/min peak → max 30 connessioni attive → PgBouncer riutilizza 15 connessioni PostgreSQL reali → **nessun bottleneck previsto**
  - **Monitoring**: Supabase Dashboard alerta se connessioni >80% pool (75/100)
  - **Scalabilità**: Architettura gestisce fino a ~500 utenti con stesso setup (trigger upgrade: Prisma Accelerate solo se >500 utenti)
- **OD-37 - Budget**:
  - **Budget disponibile**: €50/mese
  - **Costi effettivi**: €45-48/mese (Vercel Pro €20 + Supabase Pro €25 + Sentry free €0 + Supabase dev branch €0-3)
  - **Margine**: €2-5/mese per imprevisti (bandwidth extra, storage growth)
  - **Costo per utente**: €0,83/utente/mese (€45 ÷ 54 utenti)
  - **Ottimizzazione**: 1 progetto Supabase con branching (vs 2 progetti = €50 → SFORAVA budget), pause dev branch, preview deployments gratis, rate limiting in-memory (no Redis necessario)
  - **Proiezione crescita**: 150 utenti = stesso costo (€45), 500 utenti = +€5-10, >1000 utenti = +€55 (necessari upgrade)
- **OD-38 - Framework Unit Test**:
  - **Libreria**: **Vitest** confermato (best-in-class Next.js/React, performance 10-20x Jest, coverage nativo, TypeScript first-class)
  - **Rationale**: API Jest-compatible, vastissima coverage AI (crescita 2023-26), hot module reload, parallel execution nativo
  - **Target**: Business logic (calcoli volume/RPE/massimali, validazioni Zod, helpers, permission checks, custom hooks)
  - **Esclusi da unit**: Config files, componenti UI puri, layouts/loading/error, API Routes boilerplate (testati con E2E)
- **OD-39 - Framework E2E**:
  - **Libreria**: **Playwright** confermato in scope MVP
  - **Flussi critici obbligatori**: Creazione utente (admin/trainer → trainee), creazione scheda multi-settimana, pubblicazione scheda a trainee, invio feedback con serie multiple
  - **Device matrix ottimizzata**: Desktop 1440px per admin/trainer (full suite), Mobile 390px per trainee (full suite), altri device solo smoke tests
  - **Configurazione**: Multi-browser (Chromium/Firefox), auto-wait, screenshot on failure, trace on first retry
- **OD-40 - Coverage minimo**:
  - **Soglia**: **80%** su lines/branches/functions/statements (standard industry per progetti seri)
  - **Enforced in CI**: Check bloccante su GitHub Actions, PR fallisce se coverage <80%
  - **Report**: Vitest coverage con @vitest/coverage-v8, report HTML locale + JSON per CI
  - **Esclusioni**: Config, layouts, UI puri, type definitions (vedi vitest.config.ts exclude patterns)
- **OD-41 - E2E in CI**:
  - **Esecuzione**: **Sì, in CI, bloccante per deploy prod**
  - **Quando**: E2E girano su `test.zerocento.app` dopo ogni deploy staging (branch staging)
  - **Deployment gate**: PR `staging → main` richiede E2E GREEN come status check obbligatorio; se E2E fail → merge BLOCCATO → deploy prod IMPOSSIBILE
  - **Workflow**: Feature branch (unit only) → PR staging (unit + E2E su test) → PR main (require E2E green) → deploy prod
  - **Performance**: E2E solo su staging (non su ogni feature branch), ~5-10min runtime, 2 retries in CI
- **Implicazioni architetturali**:
  - **Zero costi extra per ambienti**: Supabase branching + Vercel preview deployments inclusi in piani Pro (€45 totale vs €70 con 2 progetti)
  - **QA verosimile**: Branch staging con dati realistici, ambiente test identico a prod (stessi constraint DB, stesso runtime Vercel)
  - **Quality gates robusti**: Unit 80% + E2E pass obbligatori → deploy prod impossibile se quality regression
  - **Developer experience**: Feature branch → preview URL immediato (per review UI), unit tests rapidi (Vitest), E2E solo quando merge staging (no wait su ogni push)
  - **Monitoraggio production-ready**: Sentry error tracking, Vercel analytics, Supabase connection pool monitoring
- **Documentazione aggiornata**:
  - 06_deploy_and_scaling.md: Sezioni "Ambienti 3-tier", "Supabase Database Branching setup", "CI/CD GitHub Actions workflow", "Connection Pooling dettaglio", "Budget breakdown"
  - 07_testing_strategy.md: Sezioni "Unit Testing Vitest", "E2E Testing Playwright", "Automazione e Coverage", esempi codice completi
  - 08_open_decisions.md: OD-33/34/36/37/38/39/40/41 marcate [x] con riassunto decisioni
- **Implicazioni**: Tutti gli open decision chiusi. Architettura deploy production-ready con 3 ambienti isolati. Testing strategy completa (unit 80% + E2E critici). Budget ottimizzato sotto €50/mese. CI/CD automatizzato con quality gates. Developer può iniziare implementazione con specifiche complete.

---

## 2026-03-27 (rev 14)
- **Azione**: Chiusura OD-21 (Rate Limiting) e OD-22 (Logging Strutturato).
- **OD-21 - Rate Limiting**: 
  - **Soluzione MVP**: Middleware Next.js custom con in-memory store
  - **Limiti definiti**: 
    - Auth login: 5 tentativi / 15 minuti (prevenzione brute-force)
    - Auth signup: 3 registrazioni / ora (prevenzione spam)
    - Feedback: 30 richieste / minuto (realistico per workflow trainee)
    - Creazione utenti: 20 trainee / ora per trainer
    - API autenticate generiche: 100 richieste / minuto per utente
    - API pubbliche: 20 richieste / minuto per IP
  - **Rationale**: In-memory sufficiente per scala MVP (54 utenti), zero dipendenze esterne, setup immediato
  - **Limitazioni**: State volatile (reset ad ogni deploy), non condiviso tra istanze serverless (ok per Vercel single-region)
  - **Evoluzione post-MVP**: Upstash Redis per persistence, multi-region support, analytics avanzate
  - **Implementazione**: Middleware in `middleware.ts` con Map() JavaScript, chiavi per IP (non autenticati) o userId (autenticati), HTTP 429 con messaggio user-friendly
- **OD-22 - Logging Strutturato**:
  - **Libreria**: **Pino** — logger Node.js high-performance, output JSON strutturato, vastissima coverage AI
  - **Livelli abilitati**:
    - **Development**: DEBUG, INFO, WARN, ERROR (con pino-pretty per output colorato)
    - **Production**: INFO, WARN, ERROR (DEBUG disabilitato per ridurre noise e costi)
  - **Rationale**: Pino è lo standard de facto per logging Node.js serverless, performance eccellenti, structured logging nativo
  - **Error tracking**: Integrazione **Sentry** (free tier 5K eventi/mese) per alerting, source maps, user impact analysis
  - **Pattern logging**: Context ricco con userId, action, timestamp su ogni log; no dati sensibili (password, token); stack trace su errori
  - **Visualizzazione**: Vercel Dashboard per log real-time (retention 1 giorno free, 7 giorni Pro); Sentry dashboard per errori critici con alerting
  - **Best practices**: Log eventi chiave (login, creazione risorse, errori), evita log eccessivi in prod, monitora Sentry quota
- **Implicazioni tecniche**:
  - Rate limiting: file `middleware.ts` con matcher `/api/:path*`, response 429 con error code standard, frontend gestisce 429 con toast user-friendly
  - Logging: file `lib/logger.ts` con config Pino, import in ogni API Route, wrapper `logger.info/warn/error()` con structured data
  - Sentry: `sentry.server.config.ts` + `@sentry/nextjs`, captureException con context (tags, user, extra), alerting configurabile
- **Costi stimati**: 
  - Rate limiting in-memory: €0 (nessuna dipendenza esterna)
  - Pino logging: €0 (libreria open source)
  - Sentry free tier: €0 fino a 5K errori/mese (ampiamente sufficiente MVP)
  - Vercel log retention: incluso in piano Pro (7 giorni)
- **Documentazione aggiornata**: 03_backend_api.md con sezioni dettagliate "Rate Limiting" e "Logging Strutturato" (implementazione, pattern, esempi codice)
- **Implicazioni**: Backend protetto da abusi con rate limiting granulare. Logging strutturato garantisce diagnostica errori efficace e monitoring production. Sentry free tier per alerting critici. Setup immediato, zero costi aggiuntivi, coverage AI ottima.

---

## 2026-03-27 (rev 13)
- **Azione**: Rinominazione globale del ruolo "Coach" in "Trainer".
- **Rationale**: Standardizzazione terminologia per chiarezza semantica - "Trainer" è più comunemente utilizzato nel contesto fitness/sportivo per chi allena atleti.
- **Modifiche pervasive**:
  - Ruolo: `coach` → `trainer` (enum User.role, matrice permessi, API endpoints)
  - Route frontend: `/coach/*` → `/trainer/*` (tutte le pagine trainer)
  - Entità DB: `CoachTrainee` → `TrainerTrainee` (tabella associazione)
  - Campi: `coachId` → `trainerId` in tutte le entità (Exercise.createdBy, TrainingProgram, TrainerTrainee)
  - Endpoint API: `/api/coach/*` → `/api/trainer/*` (records trainee, etc.)
  - Testo documentazione: "coach" → "trainer", "Coach" → "Trainer" in tutti i file
- **File aggiornati**: Tutti i file di design (00-09) con sostituzione sistematica
- **Impatto implementazione**:
  - Schema Prisma: rinominare entità `CoachTrainee` → `TrainerTrainee`, campo `coachId` → `trainerId`
  - Backend: aggiornare route `/api/coach/` → `/api/trainer/`, validazione enum `role=trainer`
  - Frontend: rinominare directory `/coach/` → `/trainer/`, aggiornare navigation, labels UI
  - Testing: aggiornare test case con nuova terminologia
- **Nessun impatto funzionale**: Pura rinominazione, logica di business invariata
- **Implicazioni**: Terminologia più chiara e allineata al dominio fitness. Migliore UX per utenti finali (terminologia standard del settore).

---

## 2026-03-27 (rev 12)
- **Azione**: Definizione permission granulari per disabilitazione trainee.
- **Requisito**: Admin può disabilitare qualsiasi trainee; trainer può disabilitare solo i propri trainee (isolamento).
- **Permission disabilitazione**:
  - **Admin**: può disabilitare/riabilitare **qualsiasi trainee** del sistema (campo `User.isActive`)
  - **trainer**: può disabilitare/riabilitare **solo i propri trainee** (verifica via `TrainerTrainee`)
  - **trainer NON può**: visualizzare né disabilitare trainee assegnati ad altri trainer
  - **Trainee**: nessun accesso a funzioni di gestione utenti
- **Validazione backend**:
  - Endpoint: `PATCH /api/users/[id]/deactivate` e `/activate`
  - trainer request: verifica esistenza `TrainerTrainee.trainerId = current_user AND TrainerTrainee.traineeId = target_user`
  - Se trainer tenta disabilitare trainee di altro trainer: **403 Forbidden**
- **Effetto disabilitazione**: 
  - Trainee con `isActive=false` non può effettuare login
  - Redirect a login page con messaggio: "Account disabilitato, contatta il tuo trainer"
- **Implicazioni UX**:
  - Admin UI: lista utenti mostra stato attivo/disabilitato per tutti i trainee, toggle disponibile
  - trainer UI: lista trainee mostra solo propri trainee con stato, toggle abilitato solo per i propri
  - trainer UI non mostra trainee di altri trainer (isolamento dati)
- **Testing**: Aggiunti test P2 per disabilitazione (trainer proprio trainee, trainer trainee altrui con 403, admin qualsiasi trainee, login trainee disabilitato)
- **Implicazioni**: Isolamento dati garantito anche per azioni di disabilitazione. trainer mantiene autonomia operativa sui propri atleti senza interferire con altri trainer. Admin ha visibilità e controllo globale.

---

## 2026-03-27 (rev 11)
- **Azione**: Definizione granulare permission per creazione utenti basata su ruolo.
- **Matrice creazione utenti**:
  - **Admin**: può creare utenti con ruolo `trainer` E utenti con ruolo `trainee`
  - **trainer**: può creare **solo** utenti con ruolo `trainee` (i propri atleti)
  - **Trainee**: **non può** creare alcun utente
- **Rationale**: 
  - Admin ha controllo completo della piattaforma e può onboardare nuovi trainer
  - trainer ha autonomia operativa per aggiungere i propri atleti senza coinvolgere admin
  - Trainee non ha bisogno di creare utenti (ruolo consumer)
- **Dettaglio gestione (RUD)**:
  - **Admin**: full CRUD su tutti gli utenti del sistema
  - **trainer**: può modificare/eliminare solo i trainee a lui assegnati (via `TrainerTrainee`)
  - **Trainee**: nessun accesso a funzioni di gestione utenti
- **Implicazioni tecniche**:
  - Endpoint `POST /api/users` richiede check su `role` nel body:
    - Se `role=trainer`: verificare che richiedente sia `admin`
    - Se `role=trainee`: verificare che richiedente sia `admin` O `trainer`
    - Se `role=admin`: **bloccato** (admin creabile solo via seed/migration)
  - trainer che crea trainee: sistema crea automaticamente record `TrainerTrainee` per associazione
  - Frontend: pagina `/admin/users/new` mostra dropdown ruolo con `trainer` e `trainee`, `/trainer/trainees/new` crea solo trainee
- **Aggiornamenti file**:
  - 05_security_auth.md: matrice permessi espansa con dettaglio creazione + gestione utenti
  - 03_backend_api.md: sezione "Utenti" rinominata in "Utenti (Admin + trainer)" con note autorizzazione
  - 02_frontend_design.md: aggiunta pagina `/admin/users/new`, corretta pagina trainer `/trainer/trainees/new`
- **Implicazioni**: Permission granulare garantisce separazione responsabilità e autonomia operativa trainer. Validazione ruolo sul backend previene privilege escalation. UX riflette i permessi effettivi (trainer non vede opzione per creare altri trainer).

---

## 2026-03-27 (rev 10)
- **Azione**: Definizione strategia UX differenziata per ruolo - ottimizzazione device-specific.
- **Rationale**: Casi d'uso reali richiedono esperienze ottimizzate per device diversi:
  - **Admin/trainer**: workflow di creazione contenuti complessi (editor schede multi-settimana, gestione libreria, analytics) → ottimale su desktop con schermi ampi, mouse/keyboard
  - **Trainee**: consultazione scheda e inserimento feedback durante allenamento in palestra → ottimale su mobile portrait, input touch rapido
- **Strategia implementata**:
  - **Admin/trainer → Desktop-first** (1280px+):
    - Layout: Sidebar persistente, tabelle multi-colonna, drag-and-drop avanzato, dashboard dense
    - Componenti: `WorkoutProgramBuilder` con editor complesso, tabelle estese, form multi-step con preview
    - Responsive: funzionale su tablet landscape, **non ottimizzato per mobile portrait**
  - **Trainee → Mobile portrait-first** (360px-428px):
    - Layout: Single column, CTA prominenti (min 44px), bottom navigation, sticky header
    - UX mobile-centric: cards a stack verticale, form ottimizzati per input rapido (stepper +/- per kg/reps), swipe gestures, bottom sheet
    - Componenti: `FeedbackForm` ottimizzato touch, bottom tab bar navigation
    - Responsive: usabile su desktop ma esperienza primaria per telefono
- **Implicazioni tecniche**:
  - Hook custom `useRoleLayout()` per classi CSS condizionali basate su ruolo
  - Componenti role-aware: MUI `DataGrid`/`Drawer` per Admin/trainer, MUI `BottomNavigation`/`SwipeableDrawer` per Trainee
  - Testing responsive differenziato: desktop 1280-1920px per Admin/trainer, mobile 360-428px per Trainee
  - Vincolo UX documentato in 00_problem_statement.md
- **Nota importante**: Entrambe le esperienze rimangono **responsive** e funzionali su tutti i device, ma l'ottimizzazione UX è polarizzata per il caso d'uso principale.
- **Implicazioni**: Design polarizzato chiarisce priorità implementative. Nessun compromesso UX necessario: ogni ruolo ottiene l'esperienza migliore per il suo workflow reale. Testing strategy aggiornata con device target specifici.

---

## 2026-03-27 (rev 9)
- **Azione**: Integrazione completa data model dettagliato con informazioni raccolte dal documento note.txt.
- **Data Model - Arricchimento entità**:
  - **Exercise**: Aggiunti campi `muscleGroups` (Json array con coefficienti d'incidenza 0.0-1.0), `type` (fundamental/accessory per SBD), `movementPattern` (schema motorio: squat, push, pull, ecc.), `notes` (array varianti)
  - **TrainingProgram**: Aggiunto `workoutsPerWeek` (n allenamenti per m settimane)
  - **Week**: Aggiunti `feedbackRequested` (marcatura settimane rilevanti) e `generalFeedback` (commento testuale settimana)
  - **WorkoutExercise**: Arricchito con `targetRpe` (Float 5.0-10.0 incrementi 0.5), `weightType` (Enum: absolute/percentage_1rm/percentage_rm), `restTime` (Enum: 30s/1m/2m/3m/5m), `isWarmup` (Boolean), supporto `reps` come intervallo (es. "6/8")
  - **ExerciseFeedback**: Aggiunto `setsPerformed` (Json array con {reps, weight} per ogni serie), `actualRpe` (Float 5.0-10.0) — ⚠️ NOTA: Campo setsPerformed JSON successivamente normalizzato con tabella SetPerformed in rev 22 (2026-03-28) per type-safety e query aggregate
  - **User**: Separato `name` in `firstName` e `lastName`, aggiunti `isActive` (profilo attivo/disattivato) e `initialPassword` (per gestione password generate da trainer)
  - **Nuova entità PersonalRecord**: Gestione massimali (1RM o nRM) per trainee/esercizio con storico date
- **Backend API - Nuovi endpoint**:
  - `/api/trainee/records/*` - CRUD massimali personali
  - `/api/trainer/trainees/[id]/records` - trainer visualizza massimali trainee
  - `/api/programs/[id]/reports/sbd` - Reportistica SBD (FRQ, NBL, IM)
  - `/api/programs/[id]/reports/training-sets` - Serie allenanti per gruppo muscolare
  - `/api/programs/[id]/reports/volume` - Volume totale per gruppo muscolare
  - Aggiornamento filtri `/api/exercises` per tipo e schema motorio
- **Validazione Zod - Nuovi schemi**:
  - `muscleGroupSchema` (name + coefficient 0.0-1.0)
  - `exerciseSchema` arricchito con muscleGroups, type, movementPattern
  - `workoutExerciseSchema` con targetRpe Float, weightType, restTime, isWarmup
  - `setPerformedSchema` per array serie nel feedback — ⚠️ NOTA: Schema successivamente aggiornato in rev 22 con setNumber per normalizzazione DB
  - `feedbackSchema` con setsPerformed e actualRpe Float — ⚠️ NOTA: Campo setsPerformed rinominato in `sets` in rev 22 per coerenza con tabella SetPerformed
  - `personalRecordSchema` per gestione massimali
- **Frontend - Nuove pagine e componenti**:
  - Pagine: `/trainer/trainees/[id]/create` (crea trainee + genera password), `/trainee/records` (gestione massimali), `/trainer|trainee/reports` (reportistica)
  - Componenti: `MuscleGroupBadge`, `MovementPatternIcon`, `SetInput`, `PersonalRecordCard/Form`, `SBDReportChart`, `TrainingVolumeChart`, `RPESelector`, `RestTimeSelector`, `RepsInput`
- **Security - Gestione password iniziali**:
  - Flusso sicuro per trainer che crea trainee: generazione password temporanea, visualizzazione una-tantum, encrypted storage opzionale, cambio obbligatorio al primo login
  - Pattern implementativo documentato in 05_security_auth.md
- **Testing - Nuovi flussi critici**:
  - P1: trainer crea profilo trainee con password, trainee aggiunge massimale
  - P1: Trainee invia feedback con array serie (reps + kg)
  - P2: Visualizzazione reportistica SBD e serie allenanti
  - P3: Validazione RPE Float, peso in %, reps come intervallo
- **Note implementative**: Documentate strutture Json per muscleGroups, setsPerformed, logica calcolo peso da percentuale 1RM, scala RPE 5.0-10.0, reportistica SBD (FRQ/NBL/IM)
- **Implicazioni**: Data model completo e pronto per implementazione Prisma. Tutti i requisiti funzionali raccolti nelle note sono stati integrati nei file di design. API endpoints definiti. Validazione type-safe garantita. UX e security patterns documentati.

---

## 2026-03-27 (rev 8)
- **Azione**: Chiusura OD-32 (GDPR compliance).
- **OD-32 - Compliance GDPR**: Dettagliata analisi e checklist implementativa
  - **Dati personali raccolti**: nome, email, performance allenamenti (RPE, feedback)
  - **Base legale**: Consenso esplicito (Art. 6.1.a) + Esecuzione contratto (Art. 6.1.b)
  - **Requisiti obbligatori MVP**:
    1. Cookie Consent Banner (react-cookie-consent)
    2. Privacy Policy (template GDPR-compliant)
    3. Terms of Service
    4. Data Retention Policy (2 anni feedback, anonimizzazione immediata su delete)
    5. Right to Erasure (Delete Account feature obbligatoria)
    6. Data Processing Agreement (Supabase + Vercel DPA)
    7. **Supabase region EU** (dati in UE per GDPR)
  - **Checklist implementativa**: 9 task operativi in 05_security_auth.md
  - **Non bloccante sviluppo**: policy possono essere scritte in parallelo, feature "Delete Account" implementabile in fase finale MVP
- **Implicazioni**: GDPR compliance garantita con checklist chiara. Cookie consent + privacy policy obbligatori pre-launch. Delete account obbligatorio. Supabase region EU da configurare.

---

## 2026-03-27 (rev 7)
- **Azione**: Chiusura stack critico Database + ORM + Auth (OD-24, OD-25, OD-26, OD-28, OD-29, OD-31).
- **OD-24 - Database**: **Supabase PostgreSQL** confermato
  - Rationale: Connection pooling (PgBouncer) incluso → risolve rischio OD-36
  - Dashboard admin ricca per gestione visuale dati
  - Free tier generoso (500MB DB, 1GB storage, 2GB bandwidth)
  - Coverage AI ottima (vastissima documentazione Supabase + Next.js)
  - Auth integrato nello stesso ecosistema
- **OD-25 - ORM**: **Prisma** confermato
  - Type-safety automatica end-to-end (schema → types generati)
  - Prisma Studio per debug dati locale
  - Migrations robuste e trackable (Git)
  - Coverage AI eccellentissima (vastissimo nei training data)
- **OD-26 - Migrazioni**: **Prisma Migrate** con migration files
  - Workflow: modifica schema → `prisma migrate dev` → commit migration files
  - Rollback-capable, environment-safe (DIRECT_URL per DDL, DATABASE_URL pooled per runtime)
- **OD-28 - Metodo auth**: **Email+password** per MVP
  - OAuth (Google/GitHub) e Magic Link opzionali post-MVP
- **OD-29 - Provider auth**: **Supabase Auth** 
  - Integrazione nativa con Supabase DB
  - JWT session (access + refresh token) in cookie HTTP-only
  - Collegamento auth.users ↔ public.User (trigger Supabase)
  - Zero setup infra auth (no NextAuth config)
- **OD-31 - Gestione segreti**: **Vercel Environment Variables** (standard per MVP)
  - DATABASE_URL, DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY
  - No vault enterprise necessario
- **Setup completo**:
  ```
  Database: Supabase PostgreSQL (pooled + direct connections)
  ORM: Prisma (schema.prisma + migrations)
  Auth: Supabase Auth (email/password, JWT)
  Secrets: Vercel Env Vars
  ```
- **Implicazioni**: Stack critico definito, sviluppo può partire. Connection pooling risolto, auth zero-config, type-safety garantita, coverage AI massima.

---

## 2026-03-27 (rev 6)
- **Azione**: Chiusura stack backend API (OD-18, OD-19, OD-20).
- **OD-18 - Stile API**: **REST confermato** con API Routes Next.js
  - Rationale: Coverage AI eccellente, pattern consolidati (vastissima presenza training data), HTTP semantics chiare
  - Server Actions opzionali per form submissions (progressive enhancement)
  - Type-safety via TypeScript + Zod validation
- **OD-19 - Validazione**: **Zod confermato**
  - Schema riutilizzabili (shared/schemas)
  - Type-safety end-to-end
  - Integrazione nativa con React Hook Form (frontend) e API Routes (backend)
- **OD-20 - Formato errori**: Formato standard definito
  - Success: `{data, meta?}`
  - Error: `{error: {code, message, details?}}`
  - HTTP status code semantici (200, 201, 400, 401, 403, 404, 500)
  - Helper `apiSuccess()` e `apiError()` per consistency
- **Filosofia**: REST per massima coverage AI + pattern universali, Zod per validation type-safe, formato errori standardizzato per client handling consistency.

---

## 2026-03-27 (rev 5)
- **Azione**: Chiusura stack frontend (OD-14, OD-15, OD-16) ottimizzato per sviluppo AI-first.
- **OD-14 - Libreria UI**: **Tailwind CSS** + **Material UI (MUI)**
  - Rationale: MUI ha vastissima presenza nei training data AI (matura dal 2014), componenti accessibili pronti, pattern consolidati
  - Tailwind per styling utility-first (coverage AI eccellente)
  - Alternativa valutata: shadcn/ui (più moderno ma meno coverage AI)
- **OD-15 - State management**: 
  - **TanStack Query** per server state (fetching/caching/sync, pattern consolidati, ottima documentazione)
  - **Context API** per global state semplice (React nativo, zero dipendenze)
- **OD-16 - Form management**: **React Hook Form + Zod**
  - Standard de facto industry, altissima presenza training data AI
  - Validation type-safe, schema dichiarativi riutilizzabili
- **Filosofia**: Stack scelto per massimizzare efficacia generazione codice AI (alta coverage training data, pattern ripetitivi, documentazione matura).

---

## 2026-03-27 (rev 4)
- **Azione**: Chiusura OD-12 con dettaglio rischi architetturali. Confermato piano Vercel Pro.
- **OD-12 - Rischi architetturali**: Analizzati e documentati in dettaglio:
  - **Cold start serverless**: Rischio BASSO con Vercel Pro (funzioni restano calde più a lungo)
  - **DB connection pooling**: Rischio MEDIO - soluzione: usare DB managed con connection pooling (Supabase/Neon) + Prisma connectionLimit
- **Infrastruttura**: Confermato piano **Vercel Pro** (~$20/mese) per performance migliori
- **Budget stimato**: ~$20-30/mese (Vercel Pro + DB managed)
- **Implicazioni**: Con Vercel Pro e connection pooling configurato correttamente, l'architettura serverless è adeguata per la scala prevista (54 utenti).

---

## 2026-03-27 (rev 3)
- **Azione**: Chiusura decisioni OD-04, OD-06, OD-07.
- **OD-04 - Scope OUT**: Confermato fuori scope MVP: pagamenti, app nativa (si realizza solo web app responsive mobile-friendly), chat trainer-trainee, funzionalità nutrizione.
- **OD-06 - Vincoli temporali**: Nessun vincolo temporale o milestone rigida al momento.
- **OD-07 - Vincoli organizzativi**: Nessun vincolo organizzativo (team size, processi) al momento.
- **Implicazioni**: Focus su web app responsive, possibile utilizzo di PWA per esperienza mobile-like. Nessuna pressione temporale o burocratica.

---

## 2026-03-27 (rev 2)
- **Azione**: Compilazione di tutti i file di design con le informazioni fornite dal product owner.
- **Decisioni consolidate**: OD-01, OD-02, OD-03, OD-05, OD-08, OD-09, OD-10, OD-11, OD-13, OD-17, OD-23, OD-30, OD-35.
- **Dominio definito**: piattaforma training web (Next.js + Vercel), 3 ruoli (admin/trainer/trainee), scala iniziale 54 utenti.
- **Entità di dominio definite**: User, TrainerTrainee, Exercise, TrainingProgram, Week, Workout, WorkoutExercise, ExerciseFeedback.
- **Prossimi passi**: chiudere le decisioni aperte rimanenti (OD-14 UI lib, OD-24 DB engine, OD-25 ORM, OD-28/29 auth provider, OD-04 scope OUT).

---

## 2026-03-27 (rev 1)
- **Azione**: Prima revisione dell'intero set di documenti di design.
- **Esito**: Tutti i file risultano scaffold vuoti. Nessuna decisione ancora consolidata.
