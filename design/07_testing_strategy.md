# Testing Strategy

## Tipi di test
- **Unit**: ❓ **OD-38** — framework da definire (Vitest consigliato per Next.js). Target: logica di business pura (validazione schede, calcolo avanzamento, permessi ruolo).
- **Integration**: test delle API Routes con DB reale (test database isolato). Verificare che le route rispettino la matrice permessi.
- **E2E**: ❓ **OD-39** — Playwright consigliato. Da valutare se in scope per MVP.

## Flussi critici da coprire (❓ OD-42)

| Priorità | Flusso                                                                         | Ruolo   |
| -------- | ------------------------------------------------------------------------------ | ------- |
| P0       | Login + redirect alla dashboard corretta in base al ruolo                      | tutti   |
| P0       | Accesso negato a route non autorizzate per ruolo                               | tutti   |
| P1       | Coach: crea esercizio con URL YouTube valido, gruppi muscolari, schema motorio | coach   |
| P1       | Coach: crea scheda multi-settimana e la assegna a trainee                      | coach   |
| P1       | Coach: crea profilo trainee e genera password iniziale                         | coach   |
| P1       | Trainee: visualizza scheda corrente                                            | trainee |
| P1       | Trainee: invia feedback su un esercizio con serie multiple (reps + kg)         | trainee |
| P1       | Trainee: aggiunge/modifica massimale (1RM o nRM)                               | trainee |
| P2       | Coach: visualizza avanzamento e feedback trainee                               | coach   |
| P2       | Coach: visualizza massimali di un trainee                                      | coach   |
| P2       | Trainee: visualizza reportistica SBD (FRQ, NBL, IM)                            | trainee |
| P2       | Coach: visualizza reportistica serie allenanti per gruppo muscolare            | coach   |
| P2       | Admin: crea / modifica / elimina utente                                        | admin   |
| P2       | Trainee: marca settimana per feedback e aggiunge feedback generale             | trainee |
| P3       | Validazione RPE (5.0-10.0 con incrementi 0.5)                                  | trainee |
| P3       | Validazione peso in % 1RM con calcolo automatico kg                            | trainee |
| P3       | Validazione reps come intervallo (es. "6/8")                                   | coach   |

## Automazione
- ❓ **OD-41** — i test E2E girano in CI (GitHub Actions) o solo in locale pre-push?
- ❓ **OD-40** — soglia minima di coverage da definire (es. 70% su unit/integration).
- Linting e type-check (`tsc --noEmit`, ESLint) eseguiti ad ogni PR come check bloccante.

## Test Responsive / Device-Specific

Data l'ottimizzazione UX differenziata per ruolo, i test E2E devono validare l'esperienza su device target specifici:

### Admin / Coach → Desktop Testing
**Device target**: Desktop 1280px - 1920px

**Viewport Playwright**:
```typescript
// playwright.config.ts
projects: [
  {
    name: 'desktop-coach',
    use: { 
      ...devices['Desktop Chrome'],
      viewport: { width: 1440, height: 900 }
    },
  },
  {
    name: 'desktop-admin',
    use: { 
      ...devices['Desktop Chrome'],
      viewport: { width: 1920, height: 1080 }
    },
  },
]
```

**Scenari critici desktop**:
- ✅ Sidebar persistente visibile e navigabile
- ✅ Tabelle multi-colonna (lista trainee/esercizi) con sorting/filtering funzionanti
- ✅ `WorkoutProgramBuilder`: drag-and-drop settimane/giorni/esercizi
- ✅ Dashboard multi-widget: grafici affiancati leggibili
- ✅ Form multi-step con preview side-by-side
- ✅ Hover states su elementi interattivi (mouse-driven UX)

**Non testare**: Mobile portrait per Admin/Coach (fuori scope ottimizzazione)

---

### Trainee → Mobile Portrait Testing
**Device target**: Mobile 360px - 428px portrait

**Viewport Playwright**:
```typescript
projects: [
  {
    name: 'mobile-trainee-small',
    use: { 
      ...devices['Pixel 5'], // 393x851
      isMobile: true,
      hasTouch: true
    },
  },
  {
    name: 'mobile-trainee-large',
    use: { 
      ...devices['iPhone 14 Pro Max'], // 428x926
      isMobile: true,
      hasTouch: true
    },
  },
]
```

**Scenari critici mobile**:
- ✅ Single column layout: cards workout impilate verticalmente
- ✅ Bottom navigation: tab bar accessibile con pollice (zona thumb-friendly)
- ✅ `FeedbackForm`: stepper +/- per reps/kg touch-friendly (min 44px tap target)
- ✅ Swipe gestures: navigazione tra esercizi con swipe laterale
- ✅ Sticky header: contesto allenamento sempre visibile durante scroll
- ✅ Input numerico: tastierino numerico mobile per kg/reps
- ✅ Video YouTube: collapsabile, non blocca scroll
- ✅ Performance touch: no lag su input, transizioni fluide 60fps

**Non testare**: Desktop ultra-wide per trainee (esperienza funzionale ma non ottimizzata)

---

### Matrix Testing Consigliata

| Ruolo       | Desktop 1440px | Tablet 768px | Mobile 390px |
| ----------- | -------------- | ------------ | ------------ |
| **Admin**   | ✅ Full suite   | ⚠️ Smoke      | ❌ Skip       |
| **Coach**   | ✅ Full suite   | ⚠️ Smoke      | ❌ Skip       |
| **Trainee** | ⚠️ Smoke        | ⚠️ Smoke      | ✅ Full suite |

**Legenda**:
- ✅ **Full suite**: tutti i flussi P0/P1/P2 testati
- ⚠️ **Smoke**: solo flussi P0 (login, navigation base, logout)
- ❌ **Skip**: non testato (fuori scope ottimizzazione)

---

### Strumenti Visual Regression (opzionale post-MVP)

Per validare che le ottimizzazioni UX rimangano coerenti:
- **Percy.io** o **Chromatic**: screenshot automated su Storybook components
- Snapshot per: `FeedbackForm` (mobile 390px), `WorkoutProgramBuilder` (desktop 1440px), dashboards differenziate per ruolo