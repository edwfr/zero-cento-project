# Go-Live Subscriptions Checklist

> Ultimo aggiornamento: Aprile 2026  
> Budget target: €50/mese + ~€14/anno per il dominio

---

## Servizi a Pagamento (obbligatori)

### 1. Dominio `zerocento.app`
- **Costo**: ~€14/anno
- **Dove acquistare**: Google Domains, Namecheap, o simili
- **Perché prima di tutto**: La propagazione DNS può richiedere 24-48h. Sblocca a cascata Vercel (custom domain), Resend (verifica mittente), Supabase Auth (URL corretto nei magic link)
- **Da fare dopo l'acquisto**:
  - Puntare i nameserver a Vercel
  - Aggiornare `NEXT_PUBLIC_APP_URL=https://zerocento.app` nelle env vars

### 2. Vercel Pro — €20/mese
- **Piano**: Pro (1 seat)
- **Perché**: Connection pooling serverless affidabile, preview deployments illimitati per ogni PR, Vercel Analytics incluso, log retention 7 giorni, SLA 99.99%, protezioni DDoS
- **Cosa si ottiene per gli ambienti**:
  - `prod.zerocento.app` → deploy branch `main`
  - `test.zerocento.app` → deploy branch `staging` (incluso, €0 extra)
  - Preview URL per ogni PR → `pr-42.zerocento.app` (incluso, €0 extra)

### 3. Supabase Pro — €25/mese
- **Piano**: Pro (1 progetto)
- **Perché**: Database branching per ambienti separati, daily backup automatici, connection pooler PgBouncer (critico per Next.js serverless), più connessioni concorrenti
- **Cosa si ottiene per gli ambienti** (tutto incluso, 0 costi extra):
  - Branch `main` → database produzione
  - Branch `staging` → database test, sempre attivo
  - Branch `dev` → sviluppo locale, pausabile (€0-3/mese compute)
- **Nota**: NON creare 2 progetti Supabase separati (prod + test) → costerebbe €50/mese solo di Supabase, sforando il budget

**Totale mensile: €45/mese** (margine di €5 sul budget di €50)

---

## Servizi Gratuiti (da configurare prima del go-live)

### 4. Resend — Free tier
- **Limite**: 3.000 email/mese, 1 dominio (sufficiente per MVP)
- **Usato per**: Email transazionali (onboarding magic link, reset password)
- **Setup richiesto**:
  - Registrare account su [resend.com](https://resend.com)
  - Aggiungere dominio `zerocento.app` → Dashboard → Domains → Add Domain
  - Configurare record DNS: SPF, DKIM, DMARC
  - Ottenere `RESEND_API_KEY` e impostare `RESEND_FROM_EMAIL=noreply@zerocento.app`
  - Aggiungere le env vars su Vercel (produzione)

### 5. Sentry — Free tier
- **Limite**: 5.000 eventi/mese (sufficiente per MVP)
- **Usato per**: Error tracking, stack trace, alert su errori critici
- **Setup richiesto**:
  - Registrare account su [sentry.io](https://sentry.io)
  - Creare nuovo progetto Next.js
  - Ottenere `NEXT_PUBLIC_SENTRY_DSN` e aggiungerlo alle env vars Vercel
  - Configurare source maps per produzione
  - Impostare alert su spike di errori (>10 occorrenze/ora)

### 6. UptimeRobot — Free tier
- **Limite**: 50 monitor, check ogni 5 minuti (sufficiente per MVP)
- **Usato per**: Uptime monitoring con alert email su downtime
- **Setup richiesto**:
  - Registrare account su [uptimerobot.com](https://uptimerobot.com)
  - Creare monitor HTTP(s) su `https://prod.zerocento.app/api/health`
  - Creare monitor HTTP(s) su `https://test.zerocento.app/api/health`
  - Configurare alert email al team

### 7. Upstash Redis — Free tier
- **Limite**: 10.000 comandi/giorno (sufficiente per MVP)
- **Usato per**: Rate limiting sull'autenticazione (brute-force protection)
- **Setup richiesto**:
  - Registrare account su [upstash.com](https://upstash.com)
  - Creare database Redis (region EU)
  - Ottenere `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`
  - Aggiungere le env vars su Vercel (produzione)

---

## Riepilogo

| # | Servizio | Piano | Costo | Priorità |
|---|----------|-------|-------|----------|
| 1 | Dominio `zerocento.app` | — | ~€14/anno | 🔴 Prima di tutto |
| 2 | Vercel | Pro | €20/mese | 🔴 Obbligatorio |
| 3 | Supabase | Pro | €25/mese | 🔴 Obbligatorio |
| 4 | Resend | Free | €0 | 🟡 Prima del go-live |
| 5 | Sentry | Free | €0 | 🟡 Prima del go-live |
| 6 | UptimeRobot | Free | €0 | 🟡 Prima del go-live |
| 7 | Upstash Redis | Free | €0 | 🟡 Prima del go-live |

**Totale ricorrente: €45/mese + ~€1.20/mese (dominio)**

---

## Proiezione Costi al Crescere degli Utenti

| Utenti attivi | Costo mensile | Note |
|---------------|---------------|------|
| ~54 utenti | €45-48 | Setup attuale, dentro budget |
| ~150 utenti | €45-48 | Nessun upgrade necessario |
| ~500 utenti | €50-55 | Possibile upgrade storage Supabase (+€5) |
| 1.000+ utenti | €100-150 | Prisma Accelerate (+€29), Vercel Team (+€50) |

> **Trigger upgrade**: valutare solo se si superano 500 utenti attivi o 50GB storage DB.
