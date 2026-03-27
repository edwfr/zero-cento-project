# Deploy & Scaling

## Ambienti (OD-33 ✅)

### Architettura 3-tier ottimizzata

| Ambiente       | URL                      | Vercel                | Supabase Branch | Stato     | Costo        |
| -------------- | ------------------------ | --------------------- | --------------- | --------- | ------------ |
| **Production** | `prod.zerocento.app`     | Production (main)     | `main`          | Sempre ON | €20 Vercel   |
| **Staging**    | `test.zerocento.app`     | Preview (staging)     | `staging`       | Sempre ON | €0 (incluso) |
| **Dev**        | `dev-pr-X.zerocento.app` | Preview (PR branches) | `dev`           | Pausabile | €0-3/mese    |
| **Local**      | `localhost:3000`         | `next dev`            | `dev` (locale)  | On-demand | €0           |

**Note**:
- **Staging** (`test.zerocento.app`): ambiente test sempre attivo per QA pre-produzione, deployment GRATIS incluso in Vercel Pro
- **Dev** preview deployments: GRATIS illimitati con Vercel Pro, URL unico per ogni PR (es. `pr-42.zerocento.app`)
- **Supabase branching**: incluso in Pro (€25/mese), branch `staging` e `dev` GRATIS, nessun costo aggiuntivo per environment separati

## Configurazione deploy

### Setup Supabase Database Branching

**Crea branch database** (una tantum):
```bash
# Branch staging (sempre attivo per test)
supabase branches create staging --from main

# Branch dev (pausabile)
supabase branches create dev --from main
```

**Environment variables per ambiente**:

| Variabile             | Production (main)         | Staging (staging)         | Dev (dev)                 |
| --------------------- | ------------------------- | ------------------------- | ------------------------- |
| `DATABASE_URL`        | `postgresql://...main`    | `postgresql://...staging` | `postgresql://...dev`     |
| `DIRECT_URL`          | `postgresql://...main`    | `postgresql://...staging` | `postgresql://...dev`     |
| `SUPABASE_URL`        | `https://xxx.supabase.co` | `https://xxx.supabase.co` | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY`   | `eyJ...prod`              | `eyJ...staging`           | `eyJ...dev`               |
| `NEXT_PUBLIC_APP_ENV` | `production`              | `staging`                 | `development`             |

**Pausa/resume branch dev** (quando non serve):
```bash
# Pausa compute su branch dev (€0 costo)
supabase branches pause dev

# Riattiva quando serve sviluppare
supabase branches resume dev
```

### CI/CD con GitHub Actions (OD-34 ✅)

**Workflow automatizzato**:

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  pull_request:
    branches: [staging, main]
  push:
    branches: [staging, main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run type check
        run: npm run type-check
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Check coverage threshold
        run: |
          if [ $(jq '.total.lines.pct' coverage/coverage-summary.json | cut -d. -f1) -lt 80 ]; then
            echo "❌ Coverage below 80%"
            exit 1
          fi

  e2e-staging:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/staging'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: https://test.zerocento.app
          DATABASE_URL: ${{ secrets.DATABASE_URL_STAGING }}
      
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/

  deploy-prod:
    runs-on: ubuntu-latest
    needs: e2e-staging
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Vercel Production
        run: echo "✅ Vercel auto-deploy to prod.zerocento.app"
```

**Deployment flow**:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Developer: Push to feature branch                           │
│    └─> Vercel: auto-deploy preview (pr-42.zerocento.app)       │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. PR to staging branch                                         │
│    ├─> GitHub Actions: lint + type-check + unit tests (80% cov)│
│    ├─> Se pass: auto-merge staging                             │
│    └─> Vercel: auto-deploy test.zerocento.app                  │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Deploy su staging                                            │
│    └─> GitHub Actions: E2E tests su test.zerocento.app         │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Se E2E pass: PR staging → main                               │
│    ├─> GitHub Actions: verifica E2E staging ancora green       │
│    ├─> Manual approval (opzionale)                             │
│    └─> Merge main                                              │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Deploy production                                            │
│    ├─> Vercel: auto-deploy prod.zerocento.app                  │
│    ├─> Supabase: main branch (database produzione)             │
│    └─> Sentry: tag release per monitoring errori               │
└─────────────────────────────────────────────────────────────────┘
```

**Protezioni branch GitHub**:
```
Branch: main
├─ Require pull request reviews: 1
├─ Require status checks: ✅ (test, e2e-staging)
├─ Require branches to be up to date: ✅
└─ Include administrators: ❌

Branch: staging
├─ Require status checks: ✅ (test)
└─ Auto-merge after checks pass: ✅
```

### Strategia deploy (OD-35 ✅)
- **Immutable deployments**: Ogni deploy Vercel crea nuova istanza (no mutazione infra)
- **Rollback istantaneo**: Vercel Dashboard → Deployments → "Promote to Production" su deployment precedente (< 1 minuto)
- **Zero-downtime**: Traffic shift atomico, nessuna interruzione servizio
- **Preview URLs persistenti**: Ogni PR mantiene URL univoco per review (es. `pr-42.zerocento.app` accessibile fino a eliminazione PR)

## Scalabilità

### Scala corrente
- **Utenti**: 54 (1 admin + 3 trainer + 50 trainee)
- **Richieste stimate**: ~1.000 req/giorno (~10-15 req/utente/giorno)
- **Payload medio**: Feedback trainee ~2KB, Scheda completa ~50KB
- **Traffico mensile**: ~5GB bandwidth (ampiamente sotto limiti Vercel Pro)

### Connection Pooling (OD-36 ✅)

**Problema serverless**: Ogni Vercel Function può aprire connessioni DB proprie → rischio esaurimento pool PostgreSQL (max 100 connessioni Supabase Pro).

**Soluzione implementata**:

1. **Supabase PgBouncer** (transaction pooling)
   - Incluso in Supabase Pro (nessun costo aggiuntivo)
   - Port 6543: connection pooling attivo
   - Pool size: 15 connessioni PostgreSQL riutilizzate da N client
   - Configurazione: `DATABASE_URL=postgresql://...supabase.co:6543/postgres?pgbouncer=true`

2. **Prisma connection limit**:
   ```typescript
   // lib/prisma.ts
   import { PrismaClient } from '@prisma/client'
   
   const globalForPrisma = global as unknown as { prisma: PrismaClient }
   
   export const prisma = globalForPrisma.prisma || new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL
       }
     },
     // Limita connessioni per Prisma instance (serverless-friendly)
     // PgBouncer riutilizza queste connessioni tra function invocations
     connectionLimit: 10
   })
   
   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
   ```

3. **Environment URLs**:
   ```bash
   # Pooled connection per runtime queries (API Routes)
   DATABASE_URL="postgresql://user:pass@db.supabase.co:6543/postgres?pgbouncer=true"
   
   # Direct connection per migrations (bypass pooler)
   DIRECT_URL="postgresql://user:pass@db.supabase.co:5432/postgres"
   ```

**Risultato**: Con 54 utenti e ~10 req/min peak, Prisma apre max 10 connessioni × ~3 function instances attive = ~30 connessioni totali. PgBouncer riutilizza 15 connessioni PostgreSQL reali. **Nessun bottleneck previsto per scala MVP.**

**Monitoraggio**:
- Supabase Dashboard: "Database" → "Connection Pooling" → visualizza connessioni attive
- Alert: email se connessioni > 80% del pool (75 su 100)

### Strategie scaling
- **Serverless auto-scaling**: Vercel scala automaticamente da 0 a N istanze in base al traffico (cold start <500ms con Pro)
- **Static rendering**: Pagine pubbliche pre-renderizzate (landing page, login)
- **ISR**: Libreria esercizi regenerata on-demand (revalidate 3600s)
- **Cache**: TanStack Query client-side caching (5min TTL per schede, 1min per feedback)
- **Compression**: Gzip automatico su Vercel Edge Network

### Crescita prevista (anno 1)
- **Scala anno 1**: 150 utenti (5 trainer × 30 trainee)
- **Impatto**: Nessuno, architettura gestisce fino a ~500 utenti con stesso setup
- **Trigger upgrade**: Se superano 500 utenti → valutare Prisma Accelerate (global cache + connection pooling enterprise)

## Budget infrastrutturale (OD-37 ✅)

### Costi mensili dettagliati

| Servizio                              | Piano                 | Costo mensile | Cosa include                                                                        |
| ------------------------------------- | --------------------- | ------------- | ----------------------------------------------------------------------------------- |
| **Vercel**                            | Pro                   | **€20**       | Unlimited builds, 100GB bandwidth, preview deployments GRATIS, analytics            |
| **Supabase**                          | Pro (1 progetto)      | **€25**       | 8GB DB, 100GB storage, connection pooling, database branching GRATIS, daily backups |
| **Sentry**                            | Free tier             | **€0**        | 5K errori/mese, source maps, alerting                                               |
| **Upstash Redis**                     | Free tier (opzionale) | **€0**        | 10K commands/day (se serve rate limiting persistente)                               |
| **GitHub**                            | Free                  | **€0**        | Repo privato, Actions 2000 min/mese (sufficiente)                                   |
| **Supabase dev branch** (occasionale) | Compute               | **€0-3**      | Solo quando attivo (pausabile quando non serve)                                     |
| **TOTALE FISSO**                      |                       | **€45/mese**  |                                                                                     |
| **TOTALE MAX**                        |                       | **€48/mese**  | Con Supabase dev branch attivo full-time                                            |

### Breakdown costi per utente
- **Costo per utente**: €45 ÷ 54 utenti = **€0,83/utente/mese**
- **Costo per trainee pagante** (assumendo trainer paga piattaforma): €45 ÷ 50 trainee = **€0,90/trainee/mese**

### Margine budget
- **Budget dichiarato**: €50/mese
- **Costo effettivo**: €45-48/mese
- **Margine**: **€2-5/mese** per imprevisti (bandwidth extra, storage growth)

### Cosa EVITARE per rimanere nel budget

❌ **NON fare**:
- **2 progetti Supabase separati** (test + prod) → +€25/mese = €70 totale → **SFORA budget**
- **Vercel Enterprise** → +€200/mese (overkill per scala MVP)
- **Prisma Accelerate** → +€29/mese (non necessario per <500 utenti)
- **Supabase dev branch sempre attivo** → +€3/mese (pausare quando non serve)
- **Sentry paid tier** → +€26/mese (free tier sufficiente per MVP)

✅ **Fare invece**:
- **Supabase Database Branching** (incluso in Pro) → €0 extra per test/staging
- **Vercel Preview Deployments** (incluso in Pro) → €0 extra per PR previews
- **Pausare branch dev** quando finito sviluppo → €0 compute
- **Sentry free tier** → 5K errori/mese ampii per MVP
- **Rate limiting in-memory** → €0 (no Redis necessario MVP)

### Proiezione crescita

| Scala utenti | Costo mensile | Note                                                    |
| ------------ | ------------- | ------------------------------------------------------- |
| 54 utenti    | €45-48        | Setup attuale (Pro plans)                               |
| 150 utenti   | €45-48        | Nessun aumento (stessi piani, sotto limiti)             |
| 500 utenti   | €50-55        | Possibile upgrade Supabase storage (+5GB = +€5)         |
| 1000+ utenti | €100-150      | Necessario Prisma Accelerate (+€29), Vercel Team (+€50) |

**Trigger upgrade**: Solo se superano 500 utenti attivi o 50GB storage DB.

### Ottimizzazione costi post-MVP (opzionale)

Se in futuro serve ridurre costi:
1. **Downgrade Vercel Pro → Hobby** (€0/mese) se traffico <100GB/mese → Risparmio €20
   - ⚠️ Perde: Analytics, protezioni DDoS avanzate, SLA 99.99%
2. **Supabase Pro → Free tier** se DB <500MB → Risparmio €25
   - ⚠️ Perde: Connection pooling (critico per serverless!), daily backups
3. **Non consigliato per produzione**: Hobby/Free tier ok solo per progetti personali

**Raccomandazione**: Mantenere Pro plans per produzione (€45/mese) garantisce reliability, performance, supporto.
