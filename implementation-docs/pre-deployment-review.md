# Pre-Deployment Review — ZeroCento su Vercel

**Data analisi**: 19 aprile 2026 — **Aggiornato**: 20 aprile 2026
**Stato progetto**: 143/160 task (~89% completato)
**Target deploy**: Vercel Pro + Supabase Pro (EU Frankfurt)
**Branch corrente**: `master`
**Verdetto**: **CONDITIONAL READY** — 4 blocker da risolvere prima del go-live (B1, B3 risolti)

---

## 1. Executive Summary

ZeroCento è una piattaforma SaaS trainer-led per la gestione di programmi di allenamento (admin/trainer/trainee, i18n it/en, PWA). L'implementazione è matura e ben strutturata: Next.js 15 App Router, Prisma + Supabase Postgres, Supabase Auth, rate limiting Upstash Redis, Pino logging, Vitest+Playwright (80% coverage enforcement), CI/CD GitHub Actions + Vercel.

**Punteggio di readiness**: **87/100**

| Area | Score | Note |
|------|-------|------|
| Architettura & Codice | 95 | 37 endpoint API, separazione ruoli pulita, Zod ovunque |
| Database (Prisma) | 80 | Schema completo ma migrations non committate |
| Auth & Security | 80 | Supabase Auth + RBAC solido; rate limit parziale |
| Testing | 85 | 18 file test, 80% coverage enforced in CI |
| Osservabilità | 85 | Sentry inizializzato (instrumentation.ts + client/server/edge config) |
| CI/CD | 85 | Workflow completo; mancano GitHub Secrets |
| PWA & Performance | 90 | Serwist + manifest + icon set completo |
| GDPR & Privacy | 55 | Nessun soft-delete attivo, nessun data export |
| Email (Resend) | 50 | Documentato ma **non implementato** (E.1–E.7 aperti) |

---

## 2. Blocker (da risolvere PRIMA del deploy)

### ✅ B1. Sentry inizializzato — COMPLETATO (20 aprile 2026)
- **Stato**: `src/instrumentation.ts` e `src/instrumentation-client.ts` creati. `sentry.server.config.ts` e `sentry.edge.config.ts` aggiornati con DSN/env/sample rate da variabili d'ambiente, `enableLogs: true`, `sendDefaultPii: false`, `beforeSend` con scrubbing cookie. `onRequestError = Sentry.captureRequestError` attivo per errori server-side. `Sentry.captureException` attivo in `ErrorBoundary.componentDidCatch` con `componentStack` context e `mechanism: { type: 'generic', handled: false }`.

### 🔴 B2. Resend non implementato (E.1–E.7)
- **Stato**: documentazione completa (`docs/resend-email.md`), env vars in `.env.example`, ma **zero codice**: manca `src/lib/resend.ts`, `emails/InviteUser.tsx`, e `/api/users` non invia email.
- **Impatto**: nuovi utenti non ricevono invito → onboarding bloccato.
- **Fix**: eseguire i 7 task `E.1–E.7` di `next-actions.md` (vedi §6).

### ✅ B3. Prisma migrations committate — COMPLETATO (22 aprile 2026)
- **Stato**: `prisma/migrations/20260328000000_init/migration.sql` generato via `prisma migrate diff --from-empty` e committato. `.gitignore` corretto (rimossa regola `prisma/migrations/**/*.sql` che bloccava il tracking). CI workflow aggiornato con `DIRECT_URL` nel migration step.
- **⚠️ AZIONE MANUALE RICHIESTA prima del primo deploy**: Il DB di produzione Supabase deve essere baselinato manualmente PRIMA che CI esegua `prisma migrate deploy`, altrimenti fallisce su tabelle già esistenti:
  ```bash
  DIRECT_URL=<prod-direct-url> npx prisma migrate resolve --applied 20260328000000_init
  ```
  Aggiungere anche `PRODUCTION_DIRECT_URL` ai GitHub Secrets (vedi B5).

### 🔴 B4. 2 CVE npm non risolte
- **Packages**: `eslint-config-next` (CWE-78, CVSS 7.5), `@typescript-eslint/*` (ReDoS minimatch, CVSS 7.5).
- **Tracking**: `implementation-docs/vulnerability-todos.md` righe 33–41.
- **Fix**:
  ```bash
  npm i eslint-config-next@latest @typescript-eslint/parser@latest @typescript-eslint/eslint-plugin@latest
  npm run lint && npm run test:unit && npm run build
  ```

### 🔴 B5. GitHub Secrets non configurati
- **Richiesti dal workflow `.github/workflows/ci.yml`**:
  - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
  - `PRODUCTION_DATABASE_URL` (per `prisma:migrate:prod`)
  - `STAGING_URL`
  - `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (per source maps upload)
- **Fix**: GitHub → Settings → Secrets and variables → Actions → aggiungere tutti.

---

## 3. Important (risolvere entro sprint deploy)

### 🟠 I1. 25 `console.log` in codice di produzione
Hotspot: `src/app/onboarding/set-password/page.tsx` (8 occorrenze, loggano session/metadata), `src/lib/date-format.ts` (5), `src/components/ExerciseCreateModal.tsx`, `src/components/ErrorBoundary.tsx`.
Fix: sostituire con `logger.debug()` o rimuovere.

### 🟠 I2. Soft-delete / GDPR incompleto
Lo schema ha `isActive` su `User`, `MuscleGroup`, `MovementPattern`, ma le query non filtrano. Nessun endpoint di export dati o cancellazione account. Richiesto dal design GDPR (`design/08-decisions.md`).
Fix minimo: aggiungere filtro `isActive: true` alle liste + endpoint `DELETE /api/users/[id]` con anonimizzazione (nome → "Utente eliminato", email → `deleted-<id>@zerocento.app`).

### 🟠 I3. Rate limit mancante su endpoint read
Middleware protegge solo auth/feedback/user-create. Endpoint `/api/exercises`, `/api/programs`, `/api/personal-records` (GET) sono senza limite.
Fix: aggiungere default bucket 100 req/min per IP+endpoint.

### 🟠 I4. Sprint 6 CI/CD — 7 task aperti
Tutti i task `6.1–6.7` di `next-actions.md` sono da completare:
- 6.1 `prisma:migrate:prod` ✅ già presente in `package.json`
- 6.2 step `npm run build` ✅ già in workflow
- 6.3 **`vercel.json` da creare** (vedi §5)
- 6.4 Secrets (vedi B5)
- 6.5 **Connessione Vercel ↔ GitHub** (da fare in dashboard)
- 6.6 Sentry (vedi B1)
- 6.7 UptimeRobot su `/api/health`

### 🟠 I5. i18n error key migration (4 pagine rimaste)
`trainee/dashboard/_content.tsx`, `admin/dashboard/_content.tsx`, `profile/change-password/_content.tsx`, e test integration. Task 11.51, 11.52, 11.55, 11.64.

---

## 4. Nice to have (post-deploy)

- **N1.** RLS policies su Supabase (oggi RBAC solo applicativo; defense-in-depth).
- **N2.** Axe-Core su tutti gli E2E (ora solo 1/4).
- **N3.** Index DB aggiuntivi: `ExerciseFeedback.traineeId`, composito `SetPerformed(feedbackId, setNumber)` (task 8.5, 8.6).
- **N4.** Cache admin reports 5min TTL (task 8.7).
- **N5.** Service worker offline cache per workout attivo (task 8.1, 8.4).
- **N6.** Sostituzione icon placeholder con logo brand definitivo (task 8.2).

---

## 5. Vercel Deployment — Requisiti completi

### 5.1 Account & Risorse esterne

| Servizio | Piano | Scopo | Costo/mese |
|----------|-------|-------|------------|
| Vercel | Pro | Hosting Next.js + preview | $20 |
| Supabase | Pro | Postgres EU + Auth + backup | $25 |
| Upstash | Free | Redis rate limiting | €0 |
| Sentry | Developer | Error tracking | €0 |
| Resend | Free | 3.000 email/mese | €0 |
| UptimeRobot | Free | Health check | €0 |
| Dominio | Registrar | `zerocento.app` | ~€1 |
| **Totale** | | | **~€45/mese** |

### 5.2 Ambienti (3)

| Env | Branch | URL | Database |
|-----|--------|-----|----------|
| Production | `master` | `prod.zerocento.app` | Supabase prod (region `eu-central-1`) |
| Staging | `develop` | `test.zerocento.app` | Supabase staging project |
| Preview | PR | `dev-<pr>-zerocento.vercel.app` | Supabase staging (stesso di test) |

### 5.3 Environment Variables Vercel (per ambiente)

Tutte da configurare in Vercel → Project → Settings → Environment Variables, scope `Production` / `Preview` / `Development`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # SECRET — mai esporre al client

# Database — dual URL (Prisma + PgBouncer)
DATABASE_URL=postgresql://...@db.<ref>.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...@db.<ref>.supabase.co:5432/postgres

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://<id>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<proj>
SENTRY_AUTH_TOKEN=<token>                 # SECRET — source maps upload
SENTRY_ORG=zerocento
SENTRY_PROJECT=zerocento-web

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx    # SECRET
RESEND_FROM_EMAIL=noreply@zerocento.app   # production; usa onboarding@resend.dev in dev

# App
NEXT_PUBLIC_APP_ENV=production            # o staging / development
NEXT_PUBLIC_APP_URL=https://prod.zerocento.app
```

**Nota PgBouncer**: `DATABASE_URL` **deve** usare porta 6543 con `?pgbouncer=true&connection_limit=1` per serverless Vercel. Senza `connection_limit=1` esauriresti le connessioni sotto carico.

### 5.4 `vercel.json` (da creare — task 6.3)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "regions": ["fra1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    }
  ],
  "crons": []
}
```

### 5.5 Domini & DNS

Su registrar del dominio `zerocento.app`:

| Record | Name | Value | Scopo |
|--------|------|-------|-------|
| CNAME | `prod` | `cname.vercel-dns.com` | Production |
| CNAME | `test` | `cname.vercel-dns.com` | Staging |
| TXT | `@` | `v=spf1 include:_spf.resend.com ~all` | SPF (Resend) |
| CNAME | `resend._domainkey` | `resend._domainkey.resend.com` | DKIM (Resend) |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:admin@zerocento.app` | DMARC |

Verifica SPF/DKIM in Resend Dashboard → Domains prima di inviare email reali.

### 5.6 Build & Deploy flow

```
git push origin master
      │
      ▼
GitHub Actions: lint → typecheck → unit test (80% coverage)
      │
      ▼
GitHub Actions: e2e smoke test (@smoke tag)
      │
      ▼
Vercel build: npm ci → prisma generate → next build
      │
      ▼
Post-deploy: npm run prisma:migrate:prod (usa DIRECT_URL)
      │
      ▼
Health check: GET /api/health → 200 OK (DB + Auth)
      │
      ▼
E2E full suite su staging (4 shard paralleli)
```

### 5.7 Supabase setup

1. Creare progetto nella regione `eu-central-1 (Frankfurt)` — critico per GDPR.
2. Copiare `SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` in Vercel env.
3. Abilitare daily backup (Pro plan).
4. Settings → Auth → URL Configuration:
   - Site URL: `https://prod.zerocento.app`
   - Redirect URLs: `https://prod.zerocento.app/**`, `https://test.zerocento.app/**`, `https://*.vercel.app/**`
5. Eseguire migration iniziale (B3) usando `DIRECT_URL`.
6. Caricare seed opzionale: `npm run prisma:seed` (solo staging).

### 5.8 Monitoring & Alerting

- **UptimeRobot**: monitor HTTPS su `https://prod.zerocento.app/api/health` ogni 5 min, alert email su 2 failure consecutivi.
- **Sentry**: alert su error rate > 1% su 5 min, issue nuove con `level=error` → email.
- **Vercel Analytics**: attivabile gratis per Core Web Vitals.
- **Supabase Dashboard**: monitorare connection pool utilization (target < 70%).

---

## 6. Pre-Deploy Checklist (ordine operativo)

### Settimana -2 (Setup infrastruttura)
- [ ] Creare account Vercel Pro e collegare repo GitHub
- [ ] Creare progetto Supabase EU Frankfurt (prod + staging)
- [ ] Creare account Upstash, Sentry, Resend, UptimeRobot
- [ ] Acquistare dominio `zerocento.app` e configurare DNS (§5.5)
- [ ] Verificare dominio in Resend (attendere propagazione DNS)

### Settimana -1 (Fix codice — Blocker)
- [x] **B3** ~~Commit initial Prisma migration~~ → completato (22/04): migration SQL generato e committato; CI workflow aggiornato con DIRECT_URL; **baseline prod DB manualmente prima del primo deploy** (vedi B3 note)
- [ ] **B4** Upgrade `eslint-config-next` + `@typescript-eslint/*`, rieseguire test
- [x] **B1** ~~Creare `src/instrumentation.ts` + wire Sentry in `ErrorBoundary`~~ → completato (20/04): `instrumentation.ts` + `instrumentation-client.ts` creati; `Sentry.captureException` attivo in `ErrorBoundary`
- [ ] **B2** Implementare E.1–E.7 (Resend + template InviteUser)
- [ ] **B5** Configurare GitHub Secrets (Vercel + Sentry + DB)
- [ ] Creare `vercel.json` (§5.4)

### Settimana -1 (Fix Important)
- [ ] **I1** Rimuovere `console.log` (soprattutto `onboarding/set-password`)
- [ ] **I2** Aggiungere filtro `isActive: true` alle query liste
- [ ] **I3** Rate limit default 100/min su `/api/*`
- [ ] **I5** Completare 4 i18n error keys

### Giorno -1 (Validation)
- [ ] `npm run lint` pulito
- [ ] `npm run typecheck` pulito
- [ ] `npm run test:unit` (80% coverage raggiunto)
- [ ] `npm run test:e2e:smoke` verde
- [ ] `npm run build` completa senza warning
- [ ] Deploy su staging (`test.zerocento.app`) via branch `develop`
- [ ] Smoke test manuale staging: login admin → crea trainer → crea trainee → email arriva → onboarding → workout completato

### Giorno 0 (Go-live)
- [ ] Backup DB staging (snapshot)
- [ ] Merge `develop` → `master`
- [ ] Monitor deploy Vercel (~3 min)
- [ ] Verify `GET /api/health` → 200
- [ ] Verify Sentry riceve test event
- [ ] Verify Resend invia email di test
- [ ] Attivare UptimeRobot
- [ ] Creare utente admin prod e testare flow completo

### Giorno +1 (Post-launch)
- [ ] Review Sentry per errori imprevisti
- [ ] Review Vercel Analytics (Core Web Vitals)
- [ ] Review Supabase connection pool
- [ ] Rollout a utenti reali (bucket-tested)

---

## 7. Rollback Plan

1. **Codice**: Vercel → Deployments → click su deploy precedente → "Promote to Production" (rollback in < 30s).
2. **Database**: Supabase → Database → Backups → ripristinare snapshot pre-migration. ATTENZIONE: perde dati inseriti dopo il backup.
3. **DNS**: in caso di problemi gravi, CNAME su pagina di manutenzione statica.
4. **Comunicazione**: email admin via Resend template `maintenance.tsx` (da creare se si vuole preparare in anticipo).

---

## 8. Riferimenti

- Design: `design/01-overview.md`, `design/08-decisions.md`
- Checklist completa: `implementation-docs/CHECKLIST.md`
- Next actions: `implementation-docs/next-actions.md`
- Resend integration: `docs/resend-email.md`
- API contracts: `docs/api-contracts.md`
- Supabase auth: `docs/supabase-auth-api.md`
- Vulnerability tracking: `implementation-docs/vulnerability-todos.md`

---

**Stima effort totale fix blocker**: 8–12 ore persona.
**Go/no-go**: risolti B1–B5 → GO. Important (I1–I5) possono essere risolti in hotfix post-launch se il tempo stringe.
