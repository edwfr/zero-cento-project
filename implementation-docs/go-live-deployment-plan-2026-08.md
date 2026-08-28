# Go-Live Deployment Plan — Agosto 2026

**Data creazione**: 2026-08-28  
**Ultima revisione**: 2026-08-28  
**Stato app**: Deployata su Vercel Free + Supabase Pro  
**Obiettivo**: attivare inizialmente l’ambiente di produzione su `zerocento-bodylab.it`; preparare gia ora il database test isolato e attivare `test.zerocento-bodylab.it` in seguito, dopo l’upgrade a Vercel Pro

---

## 📋 Stato attuale
- ✅ App deployata su Vercel Free + Supabase Pro
- ✅ Dominio `zerocento-bodylab.it` acquistato tramite Aruba
- ✅ Ambiente attivo: `zerocento-bodylab.it` (produzione)
- ⏸️ Ambiente test applicativo pianificato: `test.zerocento-bodylab.it` (bloccato fino all’upgrade a Vercel Pro)
- ✅ Database test creato: branch Supabase `test` (associato al branch Git `development`)
- ⏸️ Upgrade Vercel Pro rimandato: il progetto resta temporaneamente su Vercel Free/Hobby
- ⏳ Email onboarding configurata con Supabase Custom SMTP/Resend (mittente `noreply@zerocento-bodylab.it`) → da verificare con email reale
- ✅ Custom SMTP Resend configurato sui branch Supabase `main` (produzione) e `test` (test)
- ✅ Codice usa già `inviteUserByEmail()` in [POST /api/users](../src/app/api/users/route.ts#L212) — nessuna modifica applicativa richiesta per Resend
- ⏸️ Ambiente test web non attivo: `test.zerocento-bodylab.it` richiede Vercel Pro; il branch Supabase `test` e gia disponibile
- ❌ Nessun workflow CI (`.github/workflows/` vuoto)
- ❌ `vercel.json` mancante
- ⚠️ `npm run type-check` fallisce (pre-deployment-review §I6 — 50+ errori TS in test files da Next 15 async `params`)

---

## 📧 Email Onboarding — Opzione Scelta

**Opzione: Custom SMTP con Resend free tier** (raccomandata, setup ~30 min)
- **Costo**: €0 (Resend free tier: 3.000 email/mese, 100/giorno, 1 dominio verificato)
- **Mittente branded**: `noreply@zerocento-bodylab.it` con DKIM/SPF/DMARC → deliverability professionale
- **Rate limit Auth**: 30 email/ora con Custom SMTP (vs 4/h del built-in Supabase)
- **Flussi**: primo login (onboarding), reset password, magic link, change email
- **Codice**: nessuna modifica — `inviteUserByEmail()` continua a funzionare identico
- **Setup**: vedi FASE 4 (Giorno 1)

**Fallback**: se il dominio non è pronto al Giorno 1, Supabase built-in (mittente `noreply@mail.app.supabase.io`) resta attivo — deliverability degradata ma funzionale.

**Localizzazione template**: Supabase Auth invia template **in inglese di default**. Va tradotto in italiano — vedi FASE 4-bis.

---

## Database & Ambienti — Supabase Branching

**Scenario scelto**: Supabase Pro Branching per isolare produzione e test **con un solo progetto**. Il branching database e attivo; il deployment web del test resta sospeso fino a Vercel Pro.

- **Progetto Supabase unico**, region `eu-central-1` (Frankfurt) — GDPR compliant ✅
- **Branch Supabase `main`** → database di produzione, collegato esclusivamente a `zerocento-bodylab.it` e al git branch `master`
- **Branch Supabase `test`** → database di test, associato al git branch `development` e destinato a `test.zerocento-bodylab.it`
- **Isolamento**: migration/seed/test sul branch Supabase `test` scriveranno solo sul database test, **mai** sui dati prod
- **Ambienti applicativi**: produzione attiva su `zerocento-bodylab.it`; test applicativo non ancora attivo
- **Costo Branching**: non incluso nel canone Pro; Supabase indica $0,01344 per branch/ora. Un branch persistente `test` attivo 24/7 costa circa $9,80/mese, oltre al piano Pro e agli eventuali consumi aggiuntivi.
- **Controllo costi**: mantenere attivo lo Spend Cap di Supabase per evitare addebiti oltre le soglie incluse
- **Sync schema**: gestito manualmente; GitHub non e collegato a Supabase

### Strategia per ridurre il costo del branch test

Il branch Supabase `test` puo essere eliminato quando non serve e ricreato solo durante sessioni di modifica e verifica. In questo modo il costo del branching viene sostenuto solo per il periodo di utilizzo, invece di circa $9,80/mese continuativi. Prima di eliminarlo:

- esportare o annotare le credenziali del branch solo in un password manager;
- assicurarsi che migration e seed siano presenti nel repository;
- considerare che un branch ricreato potrebbe non contenere i dati di test precedenti;
- non usare mai le credenziali del branch `test` nella produzione.

Alternativa senza costo cloud: usare Supabase localmente tramite Docker/Supabase CLI per lo sviluppo. Il database locale non e raggiungibile da un deployment pubblico, ma e adatto per migration, seed e test funzionali locali.

Il piano Pro resta utile soprattutto per la produzione: progetto non sospeso, backup automatici, quote piu ampie, Custom SMTP e accesso al Branching. Il costo del Branching rimane comunque separato.

**Perché non altre opzioni**:
- ❌ *Un solo DB condiviso* → rischio corruzione dati prod da esperimenti staging
- ❌ *Due progetti Supabase free* → progetti free si sospendono dopo 7gg inattività

---

## FASE 1 — Upgrade piani (Giorno 1)

- [ ] **Vercel** → Team Settings → Upgrade to **Pro** (~$20/mese) — rimandato per problema di pagamento
  - Attivare Vercel Analytics
  - Impostare region default: `fra1` (Frankfurt)

- [x] **Supabase** → Project Settings → Billing → Upgrade to **Pro** (~$25/mese)
  - Attivare daily backup (incluso in Pro)
  - Verificare region `eu-central-1 (Frankfurt)`
  - Se no: valutare migrazione a nuovo progetto (Supabase non permette cambio region in-place)

---

## FASE 2 — Dominio Aruba e collegamento Vercel (Giorno 1)

- [x] Aruba → registrare `zerocento-bodylab.it`
  - Dominio acquistato; verificare prezzo di rinnovo e gestione DNS
- [ ] Vercel Dashboard → Project → Settings → **Domains** → aggiungere `zerocento-bodylab.it` (produzione)
- [ ] Assegnare i domini agli ambienti in **Settings → Domains**:
  - `zerocento-bodylab.it` → **Production** (branch `master`)
  - `test.zerocento-bodylab.it` → **Branch domain**: `development` (test, da attivare dopo Vercel Pro)
  - `www.zerocento-bodylab.it` → redirect verso `zerocento-bodylab.it`
- [ ] Su Aruba creare i record DNS richiesti da Vercel per il dominio principale e i sottodomini
- [ ] Verificare che Vercel Pro sia attivo in un secondo momento — necessario per attivare l’ambiente test

---

## FASE 2-bis — Supabase Branching Setup (Giorno 1, completamento parziale)

Il database test isolato e stato creato. La pubblicazione dell’app su `test.zerocento-bodylab.it` resta sospesa fino all’attivazione di Vercel Pro.

- [x] Supabase Dashboard → Project → **Branches** → attivare Branching
- [ ] Collegare integrazione GitHub → autorizzare accesso al repo `zero-cento-project`
- [ ] Configurare in Supabase → Settings → Integrations → GitHub:
  - **Production branch Git**: `master` (branch Supabase di produzione: `main`)
  - **Preview branch Git**: `development` (branch Supabase test: `test`)
- [x] Verificare creazione del branch Supabase `test`:
  - Supabase Dashboard → Branches → compare `test`
  - Il branch Supabase `test` corrisponde al branch Git `development`
- [ ] Recuperare `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL` del branch test
- [ ] Verificare region del branch = `eu-central-1` (branch eredita dalla parent)

---

## FASE 3 — Environment Variables Vercel (Giorno 1)

Vercel Dashboard → Project → Settings → Environment Variables

**⚠️ Attenzione scope Preview**: senza restrizione branch, le var scope=Preview si applicano a **tutte** le PR + tutti i branch non-production. Con Vercel Pro usare **branch-specific env vars** per legare le variabili del test al branch Git `development` e al branch Supabase `test`.

### Scope: Production (branch `master`)
```
NEXT_PUBLIC_SUPABASE_URL=(prod branch value)
NEXT_PUBLIC_SUPABASE_ANON_KEY=(prod branch value)
SUPABASE_SERVICE_ROLE_KEY=(prod branch value)        # secret
DATABASE_URL=postgresql://...@db.supabase.co:6543/...?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...@db.supabase.co:5432/...
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...                         # secret
NEXT_PUBLIC_SENTRY_DSN=https://...
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_AUTH_TOKEN=...                                # secret
SENTRY_ORG=zerocento
SENTRY_PROJECT=zerocento-web
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_URL=https://zerocento-bodylab.it
```

### Scope: Preview → Branch Git `development` / Supabase `test` (configurazione futura)
Queste variabili verranno aggiunte solo dopo l’attivazione di Vercel Pro; il branch Supabase `test` e gia stato creato:
```
NEXT_PUBLIC_SUPABASE_URL=(staging branch value)
NEXT_PUBLIC_SUPABASE_ANON_KEY=(staging branch value)
SUPABASE_SERVICE_ROLE_KEY=(staging branch value)     # secret
DATABASE_URL=(staging branch pooled)
DIRECT_URL=(staging branch direct)
UPSTASH_REDIS_REST_URL=(staging Upstash DB dedicato o stesso di prod se low-traffic)
UPSTASH_REDIS_REST_TOKEN=(staging)
NEXT_PUBLIC_SENTRY_DSN=(prod DSN va bene — event tagging via NEXT_PUBLIC_APP_ENV)
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_AUTH_TOKEN=...
SENTRY_ORG=zerocento
SENTRY_PROJECT=zerocento-web
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_APP_URL=https://test.zerocento-bodylab.it
```

### Azioni nel repo
- [ ] Verificare che [.env.example](../.env.example) sia allineato (attualmente **non contiene** `RESEND_*` — nessuna azione richiesta)

---

## FASE 4 — Custom SMTP con Resend (Giorno 1, ~30 min + attesa DNS)

Dipendenza: FASE 2 completata (dominio `zerocento-bodylab.it` acquistato). Se il dominio non è ancora propagato, rimandare al Giorno 2 e usare temporaneamente Supabase built-in.

### 4.1 Account Resend + verifica dominio
- [x] Registrarsi su [resend.com](https://resend.com) (free tier, no carta richiesta)
- [x] Dashboard → **Domains** → **Add Domain** → `zerocento-bodylab.it`
- [x] Copiare i 3 record DNS forniti da Resend (DKIM TXT + i 2 CNAME per l’invio)

### 4.2 Aggiungere record DNS su Aruba
Aruba → area clienti → **Domini** → `zerocento-bodylab.it` → **Gestione DNS** → aggiungere i record indicati da Resend.

| Tipo | Nome | Valore | Note |
|---|---|---|---|
| TXT | `send` (o `@`, come indicato da Resend) | `v=spf1 include:_spf.resend.com ~all` | SPF |
| CNAME | `resend._domainkey` | valore fornito da Resend | DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:admin@zerocento-bodylab.it` | DMARC (partire con `p=none`, alzare a `p=quarantine` dopo 2–4 settimane) |

- [x] Attendere propagazione DNS (normalmente da pochi minuti a qualche ora)
- [x] Resend Dashboard → Domains → verificare stato **Verified** ✅ prima di procedere
- [x] Record obbligatori configurati su Aruba: DKIM TXT e i 2 CNAME SPF/Sending
- [x] DMARC opzionale configurato su Aruba con host `_dmarc`

### 4.3 Generare API key Resend
- [x] Resend → **API Keys** → **Create API Key**
  - Name: `zerocento-supabase-smtp`
  - Permission: **Sending access** limitato al dominio `zerocento-bodylab.it`
- [x] Salvare la chiave `re_...` (mostrata una sola volta) in un password manager

### 4.4 Configurare SMTP su Supabase (prod branch)
Supabase Dashboard → **Auth** → **SMTP Settings** → **Enable Custom SMTP**:
```
Host:          smtp.resend.com
Port:          465
Username:      resend
Password:      <API key Resend re_...>
Sender email:  noreply@zerocento-bodylab.it
Sender name:   ZeroCento
```
- [x] Save & Test
- [x] Verificare che una "Test email" arrivi da `noreply@zerocento-bodylab.it`

### 4.5 Configurare SMTP sul branch test Supabase
- [x] Ripetere 4.4 sul branch Supabase `test`
- [x] Creare una seconda API key Resend dedicata al test per audit separato
- [ ] Verificare che la API key test sia quella utilizzata nella configurazione SMTP del branch Supabase `test`

### 4.6 Verifica deliverability
- [x] Inviare email test a un indirizzo Gmail personale
- [x] Aprire l'email → **Show original** → verificare:
  - `SPF: PASS`
  - `DKIM: PASS`
  - `DMARC: PASS`
- [x] Verificare che l'email arrivi in **Inbox** e non in Spam

### 4.7 Rate limit Supabase Auth
- [x] Supabase Dashboard → Auth → **Rate Limits** → alzare limite email da 4/h (default built-in) a 30/h (o valore desiderato, max 3.600/h con Custom SMTP)

---

## FASE 4-bis — Supabase Auth Config (Giorno 1) ⚠️ obbligatorio

Senza questa fase i magic link di onboarding non funzioneranno correttamente nell’ambiente di produzione.

- [x] Supabase Dashboard → **Auth** → **URL Configuration**:
  - **Site URL**: `https://zerocento-bodylab.it`
  - **Additional Redirect URLs**:
    ```
    https://zerocento-bodylab.it/**
    https://test.zerocento-bodylab.it/**
    http://localhost:3000/**
    ```
- [x] Supabase Dashboard → **Auth** → **Email Templates** → tradurre in italiano:
  - **Invite user** (usato da `inviteUserByEmail()`)
  - **Magic Link** (login futuro)
  - **Reset Password**
  - **Change Email Address**
  - Riferimento variabili: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .SiteURL }}`
- [x] Verifica end-to-end (28 Ago 2026): email di invito ricevuta con mittente `noreply@zerocento-bodylab.it`, `{{ .ConfirmationURL }}` punta a `https://zerocento-bodylab.it/onboarding/set-password`, flusso set-password completato con successo
- [ ] Ripetere la configurazione sul branch test quando verra attivato

---

## FASE 5 — Database: baseline, migration, seed, admin bootstrap (Giorno 2)

### 5.1 Baseline Prisma sul DB di produzione ⚠️ obbligatorio prima del primo CI deploy
Il DB Supabase attuale contiene già le tabelle create manualmente/in dev. Senza baseline, `prisma migrate deploy` in CI fallirà su tabelle esistenti (pre-deployment-review §B3).
```powershell
$env:DIRECT_URL="<PROD DIRECT_URL>"
npx prisma migrate resolve --applied 20260328000000_init
npx prisma migrate status   # deve dire: Database schema is up to date
```
La ripetizione sul branch Supabase **test** verra eseguita dopo la pubblicazione dell’ambiente test.

### 5.2 Verifica seed data
- [ ] Verificare presenza record base (Exercise, MuscleGroup, MovementPattern) in prod via Supabase Studio
- [ ] Se il branch test e vuoto: `DIRECT_URL=<test> npx ts-node prisma/seed.ts` (quando il branch sara disponibile)
- [ ] **Non rieseguire il seed su prod** se già popolato

### 5.3 Bootstrap primo admin (produzione)
Il seed non crea utenti admin. Serve manualmente:
1. Supabase Dashboard → Authentication → Users → **Add user** (email + password iniziale)
2. Nell'app Prisma Studio o SQL editor Supabase:
   ```sql
   INSERT INTO "User" (id, email, "firstName", "lastName", role, "isActive", "createdAt", "updatedAt")
   VALUES (gen_random_uuid(), '<admin email>', 'Admin', 'ZeroCento', 'admin', true, now(), now());
   ```
3. Primo login → forza reset password via `/force-change-password`
4. Ripetere sul branch Supabase `test` con account admin dedicato di test

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

### Prerequisiti bloccanti
- [ ] **Fix I6** — correggere gli errori TS in `tests/integration/*.test.ts` e `tests/e2e/*.spec.ts` per Next 15 async `params` (pattern `{ params: Promise.resolve({ id: EX_ID }) }`). Senza questo il job `type-check` è rosso.
- [ ] **Node 20** verificato in locale (`.nvmrc`) e in CI (`node-version: '20'`).

### Deploy model scelto: Vercel Git Integration (no CLI in CI)
Il deploy di produzione e gestito dalla GitHub App di Vercel: push su `master` → produzione. Il deployment test sul branch `development` verra aggiunto dopo l’upgrade a Vercel Pro. CI GitHub Actions esegue **solo test + build check**, non chiama la Vercel CLI.

- [ ] Creare `.github/workflows/ci.yml` con:
  - Job `test`: `npm ci` → `npm run lint` → `npm run type-check` → `npm run test:unit` (80% coverage)
  - Job `build`: `npm run build` (verifica no regressioni build; Vercel farà il vero build in deploy)
  - Job `migrate-prod` (solo push su `master`): `npm run prisma:migrate:prod` usando `PRODUCTION_DIRECT_URL`
  - Job `e2e-test`: da attivare dopo la pubblicazione dell’ambiente test → Playwright E2E su `https://test.zerocento-bodylab.it`
  - Success criteria: tutti i job verdi prima di merge a `master`

  Template partenza: [design/06-deployment.md](../design/06-deployment.md)

- [ ] **Branch Protection** (GitHub → repo → Settings → Branch protection):
  - Branch `master`:
    - ✅ Require PR before merge
    - ✅ Require status checks (`ci.yml`)
    - ✅ Require branches to be up to date
    - ✅ Include administrators (raccomandato)
  - Branch `development`:
    - ✅ Require status checks

- [ ] **GitHub Secrets** (repo → Settings → Secrets and variables → Actions):
  ```
  PRODUCTION_DATABASE_URL   # secret — pooled 6543
  PRODUCTION_DIRECT_URL     # secret — direct 5432, per prisma migrate deploy
  TEST_URL=https://test.zerocento-bodylab.it   # da aggiungere quando l’ambiente test sara attivo
  SENTRY_AUTH_TOKEN         # secret — source maps upload
  SENTRY_ORG=zerocento
  SENTRY_PROJECT=zerocento-web
  ```

  **Non servono** `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` perché il deploy passa dalla GitHub App di Vercel (opzione confermata; se in futuro si vuole controllare il deploy da CI, aggiungerli).

---

## FASE 8 — Monitoring & Alerting (Giorno 3)

- [ ] **Sentry** (se non già fatto):
  - Creare account free
  - Nuovo progetto Next.js
  - Copiare DSN in FASE 3 env vars
  - Configurare Alert Rules: nuova issue level=error → email

- [ ] **UptimeRobot** (free tier):
  - Monitor 1: `https://zerocento-bodylab.it/api/health` — ogni 5 min
  - Monitor 2: `https://test.zerocento-bodylab.it/api/health` — da aggiungere quando l’ambiente test sara attivo
  - Alert Contacts: email team

- [ ] **Vercel Analytics** (Pro, gratuito):
  - Attivare in Vercel → Project → Analytics
  - Monitorare Core Web Vitals

- [ ] **Supabase Dashboard**:
  - Impostare alert se connection pool > 70%
  - Verificare backup automatici (daily)

---

## FASE 9 — Smoke Test Go-Live (Giorno 3)

**Prima di lanciare pubblicamente**, eseguire il test manuale end-to-end sull’ambiente di produzione. La verifica dell’ambiente test verra eseguita dopo l’upgrade a Vercel Pro.

### Su `https://test.zerocento-bodylab.it` (test, in seguito)

Questa verifica resta sospesa fino all’attivazione di Vercel Pro e del branch Supabase di test.
- [ ] Login come admin di test
- [ ] Admin crea nuovo trainer → email di invito arriva (mittente atteso `noreply@zerocento-bodylab.it` via Resend SMTP)
- [ ] Verificare header email: `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`
- [ ] Trainer clicca link → completa onboarding e imposta password
- [ ] Trainer crea trainee → email arriva
- [ ] Trainee clicca link → completa onboarding → vede e completa un workout
- [ ] Feedback salvati correttamente (verifica in Supabase Studio branch `test`)
- [ ] Verifica che i dati inseriti nel branch Supabase `test` **non compaiano** nel branch `main` di produzione (isolamento branching)
- [ ] `GET https://test.zerocento-bodylab.it/api/health` → 200 OK, `services.database=up`, `services.auth=up`

### Su `https://zerocento-bodylab.it` (produzione, attivo)
- [ ] Login con l'admin creato in FASE 5.3
- [ ] Ripetere il flusso admin → trainer → trainee con **utenti reali** minimi (1 trainer + 1 trainee test)
- [ ] `GET https://zerocento-bodylab.it/api/health` → 200 OK

### Cross-cutting
- [ ] Sentry riceve evento di test dalla produzione (throw temporaneo in una rotta → verifica in dashboard → rollback)
- [ ] Verifica tag Sentry `environment=production`; il tag `staging` verra verificato dopo l’attivazione del test
- [ ] UptimeRobot mostra "UP" per il monitor di produzione
- [ ] Verifica email template ricevuta è in **italiano** (FASE 4-bis)

---

## FASE 9-bis — Rollback Plan (da avere pronto prima del go-live)

1. **Codice**: Vercel → Deployments → click sul deploy precedente → **Promote to Production** (< 30s).
2. **Database prod**: Supabase → Database → Backups → ripristinare snapshot pre-migration. ⚠️ perde dati inseriti dopo il backup.
3. **Migration Prisma rotta**: `DIRECT_URL=<prod> npx prisma migrate resolve --rolled-back <migration_name>` e ridistribuire.
4. **DNS emergenza**: configurare su Aruba il dominio `zerocento-bodylab.it` verso una pagina statica di manutenzione (Vercel Static).
5. **Comunicazione**: template email admin da inviare manualmente via Supabase Dashboard.

---

## FASE 10 — Post-Launch (Settimana +1)

- [ ] Marcare come `[x]` i task completati in [CHECKLIST.md](CHECKLIST.md)
- [ ] Marcare come `[x]` i task **E.1–E.7** in [next-actions.md](next-actions.md) sostituiti da FASE 4 di questo piano (Resend usato come Custom SMTP di Supabase, non come SDK applicativo)
- [ ] Alzare DMARC da `p=none` a `p=quarantine` dopo 2–4 settimane di monitoraggio senza problemi (Vercel DNS → record `_dmarc`)
- [ ] Aggiornare [CHANGELOG.md](CHANGELOG.md):
  ```markdown
  ### [Agosto 2026] — Go-live: Vercel Pro + Supabase Pro Branching + dominio + Resend SMTP

  **Task checklist**: Deployment go-live
  **File modificati**: `vercel.json`, `.github/workflows/ci.yml`, Supabase Auth config (Custom SMTP + template it), Prisma baseline prod
  **Note**: Upgrade Vercel Free → Pro rimandato per problema di pagamento. Supabase Free → Pro con Branching attivo (prod ↔ staging isolati). Dominio `zerocento-bodylab.it` acquistato tramite Aruba; produzione su `zerocento-bodylab.it` e ambiente test/staging su `test.zerocento-bodylab.it`, legato al branch `development`. Email onboarding via Supabase Custom SMTP → Resend free tier, mittente `noreply@zerocento-bodylab.it` con DKIM/SPF/DMARC verificati.
  ```
- [ ] Monitorare Sentry + Resend Dashboard (delivery/bounce/complaint rate) primi 7 giorni
- [ ] Revisare task residui Sprint 8 (PWA, indici DB, cache admin reports) — posticipare se il tempo stringe

---

## Riepilogo Costi Mensili

> Prezzi listino in USD, convertiti indicativi in EUR. **IVA 22% italiana esclusa** (se fatturato P.IVA).

| Servizio | Piano | Listino | €/mese (indicativo) | Note |
|---|---|---|---|---|
| Vercel | Pro | $20/mese | ~€19 | Hosting + Analytics + branch env vars |
| Supabase | Pro | $25/mese | ~€24 | DB + daily backup; il Branching e fatturato a parte |
| Supabase Branching | 1 branch `test` | ~$0,01344/ora | a consumo | ~€9/mese solo se attivo 24/7 |
| Resend | Free | $0 | €0 | Custom SMTP: 3.000 email/mese, 100/giorno |
| Upstash Redis | Free | $0 | €0 | Rate limiting |
| Sentry | Developer | $0 | €0 | Error tracking |
| UptimeRobot | Free | $0 | €0 | Health monitoring |
| Dominio `.it` | Aruba | variabile | variabile | Fatturato separatamente da Vercel |
| **Totale netto pianificato** | | | **~€44/mese + Branching a consumo** | Include Vercel Pro; il branch `test` non e attivo tutto il mese |
| **Totale con IVA 22%** | | | **~€54/mese + Branching a consumo** | Stima indicativa se fatturato P.IVA italiana |

**Trigger upgrade Resend**: superare 3.000 email/mese → Resend Pro $20/mese (~€19). Con ~50 utenti e onboarding + reset password siamo sotto il 5% del limite.

---

## Checklist Finale — Ordine Esecuzione

### Pre-work (prima di iniziare)
- [ ] **Fix I6**: correggere errori TS nei test files (Next 15 async `params`)
- [ ] Verificare Node 20+ in locale (`node --version`)

### Giorno 1
- [ ] FASE 1: Upgrade Vercel Pro + Supabase Pro (Supabase completato; Vercel rimandato)
- [ ] FASE 2: Collegare `zerocento-bodylab.it` ad Aruba/Vercel; `test.zerocento-bodylab.it` in seguito
- [ ] FASE 2-bis: Attivare Supabase Branching + integrazione GitHub (eseguibile ora; pubblicazione app test in seguito)
- [ ] FASE 3: Configurare env vars Vercel per la produzione; Preview/test in seguito
- [ ] FASE 4: Attivare Resend + DNS + Custom SMTP su Supabase per produzione e test (configurazione SMTP completata; verifica email ancora da fare)
- [ ] FASE 4-bis: Supabase Auth Site URL, Redirect URLs, template italiani

### Giorno 2
- [ ] FASE 5.1: **Baseline Prisma su prod**; branch test in seguito
- [ ] FASE 5.2: Verifica seed produzione; seed test in seguito
- [ ] FASE 5.3: Bootstrap admin prod
- [ ] FASE 6: Creare `vercel.json`

### Giorno 2–3
- [ ] FASE 7: Workflow CI + branch protection + GitHub Secrets
- [ ] FASE 8: Sentry alert rules + UptimeRobot sulla produzione; test in seguito

### Giorno 3
- [ ] FASE 9: Smoke test sulla produzione; ambiente test in seguito
- [ ] Preparare rollback plan (FASE 9-bis) e comunicarlo al team
- [ ] Deploy a production (merge `development` → `master`)

### Settimana +1
- [ ] FASE 10: Post-launch cleanup + monitoring Sentry

---

## Prossimi Step Concreti (Cosa fare adesso)

1. ✅ **Scenario DB confermato: Supabase Branching (Opzione A)**
2. ✅ **Email via Resend Custom SMTP confermato (FASE 4)**
3. Generare **`vercel.json`** pronto da committare (template in `pre-deployment-review.md §5.4`)
4. Generare **`.github/workflows/ci.yml`** con i 4 job descritti in FASE 7
5. Preparare script di fix per **I6** (aggiornare test files per Next 15 async `params`)
6. Preparare SQL di **bootstrap admin prod** (FASE 5.3) con placeholder email
7. Aggiornare **`next-actions.md`**: marcare E.1–E.7 come sostituiti da FASE 4 (Resend come SMTP di Supabase, non SDK applicativo)

Dimmi da quale punto vuoi partire e procedo.
