# Testing Strategy

## Tipi di test

### Unit Testing (OD-38 ✅)

**Framework**: **Vitest** — test runner Vite-native, compatibilità API Jest, performance eccezionali, coverage integrato.

**Rationale scelta**:
- ✅ **Best-in-class per Next.js/React**: Setup zero-config con Vite, hot module reload ultra-rapido
- ✅ **Coverage AI eccellente**: Vastissima presenza training data (crescita esplosiva 2023-2026)
- ✅ **API Jest-compatible**: Stessa sintassi `describe/it/expect`, migrazione facile
- ✅ **Performance**: 10-20x più veloce di Jest su test suite grandi (parallel execution nativo)
- ✅ **TypeScript first-class**: No config babel, supporto nativo decorators/enums
- ✅ **Coverage nativo**: `@vitest/coverage-v8` senza setup Istanbul

**Setup**:
```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'coverage/',
        '**/*.config.{js,ts}',
        '**/types/**',
        '**/*.d.ts',
        // Escludi componenti puramente presentazionali (no business logic)
        'app/**/layout.tsx',
        'app/**/loading.tsx',
        'app/**/error.tsx'
      ],
      // OD-40: Coverage minimo 80%
      lines: 80,
      branches: 80,
      functions: 80,
      statements: 80
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})
```

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom'
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

**Target copertura** (OD-40 ✅):
- ✅ **Business logic**: Calcolo volume, RPE, massimali (1RM formulas), reportistica SBD
- ✅ **Validazioni Zod**: Schema correctness (exercise, feedback, workout)
- ✅ **Helper/Utils**: Formatter (date, peso, reps), data transformers
- ✅ **Permission logic**: Matrice permessi ruolo, ownership checks
- ✅ **Hooks custom**: `useRoleLayout`, `useFeedback`, `useProgram`
- ❌ **Esclusi**: Config files, componenti UI semplici (Button, Badge), API Routes boilerplate (testati con E2E)

**Soglia minimo: 80% coverage** su lines/branches/functions/statements.

**Esempi test unit**:
```typescript
// lib/__tests__/volume-calculator.test.ts
import { describe, it, expect } from 'vitest'
import { calculateVolume, calculateWeeklyVolume } from '@/lib/calculations'

describe('calculateVolume', () => {
  it('calculates volume correctly', () => {
    expect(calculateVolume(3, 10, 100)).toBe(3000) // 3 sets × 10 reps × 100kg
  })
  
  it('returns 0 for invalid sets', () => {
    expect(calculateVolume(0, 10, 100)).toBe(0)
    expect(calculateVolume(-5, 10, 100)).toBe(0)
  })
  
  it('returns 0 for invalid reps', () => {
    expect(calculateVolume(3, 0, 100)).toBe(0)
  })
  
  it('handles reps as range ("8-10")', () => {
    expect(calculateVolume(3, '8-10', 100)).toBe(2700) // usa valore medio 9
  })
})

// schemas/__tests__/feedback.test.ts
import { describe, it, expect } from 'vitest'
import { feedbackSchema } from '@/schemas/feedback'

describe('feedbackSchema', () => {
  it('validates correct feedback', () => {
    const valid = {
      workoutExerciseId: '123e4567-e89b-12d3-a456-426614174000',
      completed: true,
      actualRpe: 8.5,
      sets: [
        { setNumber: 1, reps: 10, weight: 100 },
        { setNumber: 2, reps: 9, weight: 100 },
        { setNumber: 3, reps: 8, weight: 100 }
      ],
      notes: 'Buon allenamento, leggera fatica alla terza serie'
    }
    expect(() => feedbackSchema.parse(valid)).not.toThrow()
  })
  
  it('rejects invalid RPE', () => {
    const invalid = { actualRpe: 4.5 } // RPE min = 5.0
    expect(() => feedbackSchema.parse(invalid)).toThrow()
  })
  
  it('rejects RPE with invalid increment', () => {
    const invalid = { actualRpe: 8.3 } // Deve essere multiplo di 0.5
    expect(() => feedbackSchema.parse(invalid)).toThrow()
  })
  
  it('validates sets array with setNumber, reps, weight', () => {
    const valid = {
      workoutExerciseId: '123e4567-e89b-12d3-a456-426614174000',
      completed: true,
      sets: [{ setNumber: 1, reps: 8, weight: 80 }]
    }
    expect(() => feedbackSchema.parse(valid)).not.toThrow()
  })
  
  it('rejects sets array without required fields', () => {
    const invalid = {
      workoutExerciseId: '123e4567-e89b-12d3-a456-426614174000',
      completed: true,
      sets: [{ reps: 8 }] // manca setNumber e weight
    }
    expect(() => feedbackSchema.parse(invalid)).toThrow()
  })
})
```

**Script package.json**:
```json
{
  "scripts": {
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:unit:coverage": "vitest run --coverage",
    "test:unit:ui": "vitest --ui"
  }
}
```

---

### Integration Testing

**Target**: API Routes con database test isolato.

**Setup**: 
- Database Supabase branch `test` (separato da dev/staging/prod)
- Prisma migrations applicate prima della suite
- Seed dati minimi (1 admin, 1 trainer, 2 trainee, 5 esercizi)
- Cleanup dopo ogni test (`afterEach` truncate tables)

**Cosa testare**:
- ✅ Matrice permessi: trainer non può creare altro trainer (403)
- ✅ Ownership: trainer non può modificare trainee di altro trainer (403)
- ✅ Validazione: POST /api/exercises con youtubeUrl invalido (400)
- ✅ Relations: DELETE esercizio usato in scheda attiva (409 conflict)
- ✅ Auth: richiesta senza session JWT (401)

**Nota**: Integration test possono essere sostituiti da E2E se tempo limitato (E2E testano anche DB interactions).

---

### E2E Testing (OD-39 ✅, OD-41 ✅)

**Framework**: **Playwright** — E2E moderno multi-browser, auto-wait intelligente, debugging eccellente.

**In scope per MVP**: ✅ **Sì, flussi critici obbligatori**.

**Flussi critici da testare** (priorità P0/P1):
1. ✅ **Creazione utente**: Admin/trainer crea trainee con password generata
2. ✅ **Creazione scheda**: trainer crea programma multi-settimana (3 settimane × 4 workout)
3. ✅ **Pubblicazione scheda**: trainer assegna scheda a trainee, trainee visualizza in dashboard
4. ✅ **Invio feedback**: Trainee completa allenamento, invia feedback con serie multiple (reps + kg)

**Esecuzione E2E**: **In CI, bloccante per deploy prod** (OD-41).

**Setup**:
```bash
npm install -D @playwright/test
npx playwright install --with-deps
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['github'] // GitHub Actions annotations
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://test.zerocento.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  
  // Device matrix (ottimizzato per ruoli - vedi sezione precedente)
  projects: [
    {
      name: 'desktop-trainer',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'mobile-trainee',
      use: { ...devices['Pixel 5'], isMobile: true, hasTouch: true }
    }
  ]
})
```

**Esempio E2E test**:
```typescript
// e2e/feedback-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Trainee feedback flow', () => {
  test.use({ ...devices['Pixel 5'] }) // Mobile portrait
  
  test('trainee submits feedback for workout', async ({ page }) => {
    // Login trainee
    await page.goto('/login')
    await page.fill('[name="email"]', 'trainee@test.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Verifica redirect dashboard trainee
    await expect(page).toHaveURL('/trainee/dashboard')
    
    // Clicca su scheda corrente
    await page.click('[data-testid="current-program"]')
    
    // Seleziona primo allenamento settimana 1
    await page.click('[data-testid="workout-week-1-day-1"]')
    
    // Compila feedback primo esercizio: 3 serie
    await page.fill('[data-testid="exercise-1-set-1-reps"]', '10')
    await page.fill('[data-testid="exercise-1-set-1-weight"]', '100')
    await page.fill('[data-testid="exercise-1-set-2-reps"]', '9')
    await page.fill('[data-testid="exercise-1-set-2-weight"]', '100')
    await page.fill('[data-testid="exercise-1-set-3-reps"]', '8')
    await page.fill('[data-testid="exercise-1-set-3-weight"]', '100')
    
    // Selezione RPE
    await page.click('[data-testid="rpe-slider"]')
    await page.fill('[data-testid="rpe-input"]', '8.5')
    
    // Submit feedback
    await page.click('button[type="submit"]')
    
    // Verifica success message
    await expect(page.locator('[data-testid="feedback-success"]')).toBeVisible()
    
    // Verifica feedback salvato in DB con serie normalizzate
    const response = await page.request.get('/api/feedback?workoutExerciseId=...')
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.data.actualRpe).toBe(8.5)
    // Verifica serie normalizzate in tabella SetPerformed (3 serie)
    expect(data.data.sets).toHaveLength(3)
    expect(data.data.sets[0]).toMatchObject({ setNumber: 1, reps: expect.any(Number), weight: expect.any(Number) })
  })
})
```

**CI Integration** (GitHub Actions):
```yaml
# .github/workflows/e2e.yml (già incluso in workflow ci.yml)
e2e-staging:
  runs-on: ubuntu-latest
  needs: test
  if: github.ref == 'refs/heads/staging'
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npx playwright install --with-deps
    
    # Run E2E su ambiente staging
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        BASE_URL: https://test.zerocento.app
        DATABASE_URL: ${{ secrets.DATABASE_URL_STAGING }}
    
    # Upload report se fail
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
    
    # BLOCCA deploy prod se E2E fail
    - name: Block production deploy on E2E failure
      if: failure()
      run: |
        echo "❌ E2E tests failed on staging. Production deploy BLOCKED."
        exit 1
```

**Deployment gate**: Se E2E fail su staging → PR `staging → main` BLOCCATO → Deploy prod impossibile. Developer deve fixare issue e rifare PR.

## Flussi critici da coprire (❓ OD-42)

| Priorità | Flusso                                                                            | Ruolo   |
| -------- | --------------------------------------------------------------------------------- | ------- |
| P0       | Login + redirect alla dashboard corretta in base al ruolo                         | tutti   |
| P0       | Accesso negato a route non autorizzate per ruolo                                  | tutti   |
| P1       | trainer: crea esercizio con URL YouTube valido, gruppi muscolari, schema motorio  | trainer |
| P1       | trainer: crea scheda multi-settimana e la assegna a trainee                       | trainer |
| P1       | trainer: crea profilo trainee e genera password iniziale                          | trainer |
| P1       | Trainee: visualizza scheda corrente                                               | trainee |
| P1       | Trainee: invia feedback su un esercizio con serie multiple (reps + kg)            | trainee |
| P1       | Trainee: visualizza massimali (sola lettura)                                      | trainee |
| P1       | trainer: aggiunge/modifica massimale per un trainee                               | trainer |
| P2       | trainer: visualizza avanzamento e feedback trainee                                | trainer |
| P2       | Trainee: tenta modificare massimale (deve fallire con 403 Forbidden)              | trainee |
| P2       | trainer: visualizza reportistica serie allenanti per gruppo muscolare             | trainer |
| P2       | Admin: crea / modifica / elimina utente                                           | admin   |
| P2       | Admin: crea nuovo trainer (validazione role=trainer richiede admin)               | admin   |
| P2       | trainer: disabilita proprio trainee (isActive=false)                              | trainer |
| P2       | trainer: tenta disabilitare trainee di altro trainer (deve fallire con 403)       | trainer |
| P2       | Admin: disabilita qualsiasi trainee                                               | admin   |
| P2       | Trainee disabilitato: tenta login (deve fallire con messaggio appropriato)        | trainee |
| P2       | trainer: tenta creare trainer (deve fallire con 403 Forbidden)                    | trainer |
| P2       | Trainee: tenta accedere a /api/users (deve fallire con 403 Forbidden)             | trainee |
| P2       | trainer A: modifica esercizio creato da trainer B (libreria condivisa, 200 OK)    | trainer |
| P2       | trainer A: elimina esercizio creato da trainer B (libreria condivisa, 200 OK)     | trainer |
| P2       | Trainee: tenta modificare esercizio (deve fallire con 403 Forbidden)              | trainee |
| P2       | trainer: elimina esercizio usato in scheda attiva (deve fallire con 409 Conflict) | trainer |
| P2       | Trainee: marca settimana per feedback e aggiunge feedback generale                | trainee |
| P3       | Validazione RPE (5.0-10.0 con incrementi 0.5)                                     | trainee |
| P3       | Validazione peso in % 1RM con calcolo automatico kg                               | trainee |
| P3       | Validazione reps come intervallo (es. "6/8")                                      | trainer |

## Automazione e Coverage (OD-40 ✅, OD-41 ✅)

### Soglia coverage minima: 80%

**Cosa significa** (OD-40): Coverage misura % di codice eseguito dai test. 80% = standard industry per progetti seri, bilanciamento tra qualità e tempo di sviluppo.

**Enforced in CI**:
```yaml
# .github/workflows/ci.yml
- name: Check coverage threshold
  run: |
    COVERAGE=$(jq '.total.lines.pct' coverage/coverage-summary.json | cut -d. -f1)
    if [ $COVERAGE -lt 80 ]; then
      echo "❌ Coverage $COVERAGE% below threshold 80%"
      exit 1
    fi
    echo "✅ Coverage $COVERAGE% meets threshold"
```

**Cosa include nel coverage**:
- ✅ Business logic (calcoli, validazioni, utilities)
- ✅ Custom hooks
- ✅ Schema Zod
- ✅ Permission checks
- ❌ Config files (next.config.js, etc.)
- ❌ UI components puri (Button, Badge, Link)
- ❌ Layouts/Loading/Error pages (no business logic)

**Report coverage locale**:
```bash
npm run test:unit:coverage
# Apri coverage/index.html per visualizzare report dettagliato
```

### E2E in CI: esecuzione e deployment gate (OD-41)

**Quando girano E2E**:
1. ✅ **Ogni PR a staging**: E2E completi su test.zerocento.app dopo deploy staging
2. ✅ **Prima di merge staging → main**: E2E devono essere GREEN per permettere merge
3. ❌ **Non su feature branches**: Solo unit test (E2E troppo lenti per ogni push)

**Deployment gate**:
```
PR staging → main
├─ Status check: Unit tests ✅ (obbligatorio)
├─ Status check: E2E staging ✅ (obbligatorio)
└─ Se E2E ❌ → Merge BLOCCATO → Deploy prod IMPOSSIBILE
```

**Workflow completo CI**:
```
Push feature branch
  ├─> Lint + Type-check
  ├─> Unit tests (coverage 80%)
  └─> Se pass: Ready for PR

PR → staging
  ├─> Lint + Type-check + Unit
  ├─> Auto-merge staging
  ├─> Vercel deploy test.zerocento.app
  └─> E2E su test.zerocento.app

PR staging → main (PROTECTED)
  ├─> Require E2E staging GREEN ✅
  ├─> Manual approval (optional)
  ├─> Merge main
  └─> Vercel auto-deploy prod.zerocento.app
```

### Automazione linting
- **ESLint**: rules Next.js + Prettier
- **TypeScript**: `tsc --noEmit` strict mode
- **Prettier**: auto-format on save (VSCode) + pre-commit hook
- **Husky pre-commit**: Lint + Type-check bloccante su commit locale

```json
// package.json
{
  "scripts": {
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "test": "npm run lint && npm run type-check && npm run test:unit"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

## Test Responsive / Device-Specific

Data l'ottimizzazione UX differenziata per ruolo, i test E2E devono validare l'esperienza su device target specifici:

### Admin / trainer → Desktop Testing
**Device target**: Desktop 1280px - 1920px

**Viewport Playwright**:
```typescript
// playwright.config.ts
projects: [
  {
    name: 'desktop-trainer',
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

**Non testare**: Mobile portrait per Admin/trainer (fuori scope ottimizzazione)

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
| **trainer** | ✅ Full suite   | ⚠️ Smoke      | ❌ Skip       |
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