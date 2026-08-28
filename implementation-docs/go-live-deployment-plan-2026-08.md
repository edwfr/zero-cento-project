# Go-Live Deployment Plan — Agosto 2026

**Data creazione**: 2026-08-28  
**Stato app**: Deployata su Vercel Free + Supabase Free  
**Obiettivo**: Upgrade to Pro, acquistare dominio via Vercel, sbloccare email onboarding  
**Costo ricorrente**: ~€52/mese (~€46 se senza Google Workspace)

---

## 📋 Stato attuale
- ✅ App deployata su Vercel Free + Supabase Free
- ❌ Dominio non acquistato
- ⚠️ Email onboarding usa Supabase built-in rate-limited (2/ora)
- ✅ Supabase configured con `inviteUserByEmail()` in `POST /api/users`

---

## 📧 Email Onboarding — Opzione Scelta

**Opzione: Supabase built-in** (incluso in Pro)
- **Costo**: €0
- **Limite**: ~2 email/ora (non è un problema per ~50 utenti)
- **Flussi**: primo login (onboarding) + reset password
- **Stima**: 10–15 email/mese (totalmente sotto limite)
- **Vantaggi**: zero setup aggiuntivo, niente servizi terzi

Con ~50 utenti e solo onboarding + reset password, il rate-limit Supabase è **ampiamente sufficiente** (0.5 email/giorno di media).

**Niente Resend, niente Google Workspace** — tutto gestito da Supabase Pro.

---

## Database: Scenario

✅ **Scenario 1 CONFERMATO** — Mantieni stesso progetto Supabase (upgrade in-place)
- Region: `eu-central-1` (Frankfurt) — GDPR compliant ✅
- Upgrade: Free → Pro nello stesso progetto
- Migration: **niente** — dati restano in place, niente export/import

---

## FASE 1 — Upgrade piani (Giorno 1)

- [ ] **Vercel** → Team Settings → Upgrade to **Pro** (~$20/mese)
  - Attivare Vercel Analytics
  - Impostare region default: `fra1` (Frankfurt)

- [ ] **Supabase** → Project Settings → Billing → Upgrade to **Pro** (~$25/mese)
  - Attivare daily backup (incluso in Pro)
  - Verificare region `eu-central-1 (Frankfurt)`
  - Se no: valutare migrazione a nuovo progetto (Supabase non permette cambio region in-place)

---

## FASE 2 — Dominio via Vercel (Giorno 1)

- [ ] Vercel Dashboard → Project → Settings → **Domains** → **Buy Domain**
- [ ] Comprare `zerocento.app` (oppure alternativa scelta)
  - **DNS gestito automaticamente da Vercel** — niente record CNAME manuali per il dominio
  - Costo: ~€1.20/mese incluso in Vercel
- [ ] Assegnare subdomain agli ambienti:
  - `prod.zerocento.app` → Production (branch `master`)
  - `test.zerocento.app` → Preview (Settings → Domains → assign to branch `development`)
  - Oppure usare `zerocento.app` come root production + `test.zerocento.app` per staging

---

## FASE 3 — Environment Variables Vercel (Giorno 1)

Vercel Dashboard → Project → Settings → Environment Variables

**Scope: Production** (brand new o aggiornare se esiste):
```
NEXT_PUBLIC_SUPABASE_URL=(prod value)
NEXT_PUBLIC_SUPABASE_ANON_KEY=(prod value)
SUPABASE_SERVICE_ROLE_KEY=(prod value)        # secret
DATABASE_URL=postgresql://...@db.supabase.co:6543/...?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...@db.supabase.co:5432/...
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...                  # secret
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_AUTH_TOKEN=...                         # secret
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_URL=https://zerocento.app
```

**Scope: Preview** (per branch `development`):
```
NEXT_PUBLIC_SUPABASE_URL=(staging value)
NEXT_PUBLIC_SUPABASE_ANON_KEY=(staging value)
SUPABASE_SERVICE_ROLE_KEY=(staging value)
DATABASE_URL=(staging pooled)
DIRECT_URL=(staging direct)
UPSTASH_REDIS_REST_URL=(staging)
UPSTASH_REDIS_REST_TOKEN=(staging)
NEXT_PUBLIC_SENTRY_DSN=(staging)
SENTRY_AUTH_TOKEN=(staging)
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_APP_URL=https://test.zerocento.app
```

**Azioni nel repo**:
- [ ] Aggiornare [.env.example](.env.example) — rimuovere righe `RESEND_*`

---

## FASE 4 — Email onboarding via Supabase (niente da fare)

Il codice esistente ([src/app/api/users/route.ts#L212](src/app/api/users/route.ts#L212)) usa già `inviteUserByEmail()` — Supabase built-in.

Con ~50 utenti e solo primo login + reset password (~0.5 email/giorno), **il rate-limit di 2/ora non è mai un problema**.

**Niente da fare**: il flusso email è pronto così com'è.

**Nota**: Supabase invia da `noreply@mail.app.supabase.io` (mittente generico). Per email branded con dominio proprio, dovresti implementare Custom SMTP (Opzione A / Google Workspace), ma non è necessario per MVP con 50 utenti. Opzione post-launch.

---

## FASE 5 — Database Verifiche (Giorno 2) — Scenario 1 confermato

Same Supabase project, region `eu-central-1`, upgrade Free → Pro.

- [ ] Verificare che `prisma migrate status` sia pulito (non obbligatorio, ma consigliato):
  ```bash
  $env:DIRECT_URL="<prod DIRECT_URL>"
  npx prisma migrate status
  ```
  Dovrebbe mostrare tutte le migrazioni come `Applied`.

- [ ] Verificare che il seed data (esercizi, muscle groups, movement patterns) sia presente:
  ```bash
  npx ts-node prisma/seed.ts
  # Oppure via Supabase Studio: verificare record in Exercise, MuscleGroup, MovementPattern
  ```

**Niente da fare**: dati, schema, tutto rimane in place. L'upgrade è trasparente.

---

## FASE 6 — Vercel Deploy Config (Giorno 2)

- [ ] Creare `vercel.json` in root repository con:
  - Build command: `npm run build`
  - Install command: `npm ci`
  - Framework: `nextjs`
  - Region: `fra1` (Frankfurt)
  - Headers sicurezza (X-Content-Type-Options, X-Frame-Options, ecc.)
  - Cache policy per Service Worker
  
  Template completo in [implementation-docs/pre-deployment-review.md](implementation-docs/pre-deployment-review.md) §5.4

- [ ] Verificare Vercel Project Settings:
  - Production branch: `master`
  - Framework preset: Next.js
  - Build settings: non override (usa `vercel.json`)

---

## FASE 7 — GitHub + CI/CD (Giorno 2–3)

- [ ] Creare `.github/workflows/ci.yml` con:
  - Job `test`: `npm ci` → `npm run lint` → `npm run type-check` → `npm run test:unit` (80% coverage)
  - Job `build`: `npm run build`
  - Job `e2e-staging`: su push `development` → E2E tests su `https://test.zerocento.app`
  - Success criteria: tutti i job verdi prima di merge a `master`

  Template in [design/06-deployment.md](design/06-deployment.md)

- [ ] **Branch Protection** (GitHub → repo → Settings → Branch protection):
  - Branch `master`:
    - ✅ Require PR before merge
    - ✅ Require status checks (ci.yml)
    - ✅ Require branches to be up to date
    - ❌ Include administrators (consigliato)
  - Branch `development`:
    - ✅ Require status checks
    - ⚠️ Auto-merge on green (opzionale — semplifica flusso)

- [ ] **GitHub Secrets** (repo → Settings → Secrets and variables → Actions):
  ```
  PRODUCTION_DATABASE_URL (secret)
  PRODUCTION_DIRECT_URL (secret)
  STAGING_URL=https://test.zerocento.app
  SENTRY_AUTH_TOKEN (secret)
  SENTRY_ORG=zerocento
  SENTRY_PROJECT=zerocento-web
  ```

  **Non servono** `VERCEL_TOKEN`/`ORG_ID`/`PROJECT_ID` — Vercel fa deploy via GitHub App automaticamente.

---

## FASE 8 — Monitoring & Alerting (Giorno 3)

- [ ] **Sentry** (se non già fatto):
  - Creare account free
  - Nuovo progetto Next.js
  - Copiare DSN in FASE 3 env vars
  - Configurare Alert Rules: nuova issue level=error → email

- [ ] **UptimeRobot** (free tier):
  - Monitor 1: `https://zerocento.app/api/health` — ogni 5 min
  - Monitor 2: `https://test.zerocento.app/api/health` — ogni 5 min
  - Alert Contacts: email team

- [ ] **Vercel Analytics** (Pro, gratuito):
  - Attivare in Vercel → Project → Analytics
  - Monitorare Core Web Vitals

- [ ] **Supabase Dashboard**:
  - Impostare alert se connection pool > 70%
  - Verificare backup automatici (daily)

---

## FASE 9 — Smoke Test Go-Live (Giorno 3)

**Prima di lanciare pubblicamente**, eseguire test manuale:

- [ ] Login come admin
- [ ] Admin crea nuovo trainer → **verificare email arriva da `noreply@zerocento.app`** (se Opzione A)
- [ ] Trainer clicca link magic link e completa onboarding
- [ ] Trainer crea trainee → email arriva
- [ ] Trainee clicca link e completa onboarding
- [ ] Trainee vede e completa un workout
- [ ] Feedback salvati correttamente
- [ ] `GET https://zerocento.app/api/health` → 200 OK
- [ ] `GET https://test.zerocento.app/api/health` → 200 OK
- [ ] Sentry riceve evento di test (opzionale: fare un `throw` temporaneo in una rotta, verificare in dashboard, rollback)
- [ ] UptimeRobot mostra "UP" per entrambi i monitor

---

## FASE 10 — Post-Launch (Settimana +1)

- [ ] Rimuovere task **E.1–E.7** (Resend) da [implementation-docs/next-actions.md](implementation-docs/next-actions.md) — non più necessari
- [ ] Marcate come `[x]` i task completati in [implementation-docs/CHECKLIST.md](implementation-docs/CHECKLIST.md)
- [ ] Aggiornare [implementation-docs/CHANGELOG.md](implementation-docs/CHANGELOG.md):
  ```markdown
  ### [Agosto 2026] — Upgrade Pro + Dominio Vercel + Email Supabase

  **Task checklist**: Deployment go-live  
  **File modificati**: `vercel.json`, `.github/workflows/ci.yml`, `.env.example`, Supabase SMTP config  
  **Note**: Upgraded Vercel Free → Pro, Supabase Free → Pro. Dominio acquistato via Vercel. Email onboarding via Supabase Custom SMTP + Google Workspace. Niente Resend.
  ```
- [ ] Revisare task residui Sprint 8 (PWA, indici DB, cache admin reports) — posticipare se il tempo stringe

---

## Riepilogo Costi Mensili

| Servizio | Piano | €/mese | Note |
|---|---|---|---|
| Vercel | Pro | ~€20 | Hosting Next.js |
| Supabase | Pro | ~€25 | Database + backup giornaliero + email built-in |
| Upstash Redis | Free | €0 | Rate limiting |
| Sentry | Developer | €0 | Error tracking |
| UptimeRobot | Free | €0 | Health monitoring |
| Dominio `.app` | Vercel | €1.20 | Incluso in Vercel |
| **TOTALE** | | **~€46.20/mese** | Zero servizi email esterni |

---

## Checklist Finale — Ordine Esecuzione

### Giorno 1
- [ ] FASE 1: Upgrade Vercel Pro + Supabase Pro
- [ ] FASE 2: Comprare dominio via Vercel
- [ ] FASE 3: Configurare env vars in Vercel

### Giorno 2
- [ ] FASE 4: Email onboarding via Supabase (niente da fare — verifica che invitazioni funzionino)
- [ ] FASE 5: Database verifiche (prism migrate status, seed data check)
- [ ] FASE 6: Creare `vercel.json`

### Giorno 2–3
- [ ] FASE 7: Creare GitHub Actions workflow + GitHub Secrets
- [ ] FASE 8: Setup Sentry, UptimeRobot

### Giorno 3
- [ ] FASE 9: Smoke test completo
- [ ] Deploy a production (push `master`)

### Settimana +1
- [ ] FASE 10: Post-launch cleanup documentation

---

## Prossimi Step Concreti (Cosa fare adesso)

1. **Confermare Scenario DB** (1 = upgrade in-place / 2 = nuovo progetto)
   - Default: **Scenario 1** (mantieni stesso progetto Supabase)
2. Generare **`vercel.json`** pronto da committare
3. Generare **`.github/workflows/ci.yml`** su misura
4. Aggiornare **`.env.example`** — rimuovere `RESEND_*`
5. Aggiornare **`implementation-docs/next-actions.md`** — rimuovere task E.1–E.7 (email Resend non più necessaria)

Dimmi se Scenario 1 è OK per il tuo DB e procedo con i file.
