# Deploy & Scaling

## Ambienti
| Ambiente       | Infrastruttura                       | Trigger                      |
| -------------- | ------------------------------------ | ---------------------------- |
| **Dev**        | `localhost:3000` — `next dev`        | sviluppo locale              |
| **Preview**    | Vercel Preview Deployment automatico | ogni push su branch non-main |
| **Production** | Vercel Production Deployment         | merge su `main`              |

- URL produzione: ❓ **OD-33** — da configurare su Vercel (dominio custom).

## Configurazione deploy
- Next.js deployato su Vercel con zero-config (rilevamento automatico framework).
- Variabili d'ambiente configurate per ambiente in Vercel Dashboard (Dev / Preview / Production).
- **CI/CD**: ❓ **OD-34** — integrazione Vercel + GitHub nativa (deploy automatico su push) è sufficiente per la scala attuale; GitHub Actions per test aggiuntivi da valutare.
- **Strategia deploy**: Vercel usa deploy immutabili con rollback istantaneo — ❓ **OD-35** risolto de facto da Vercel.

## Scalabilità
- **Scala corrente**: 54 utenti (1 admin + 3 coach + 50 trainee). Nessun requisito di scaling aggressivo.
- **Bottleneck previsti**: ❓ **OD-36** — connessioni DB da serverless (ogni function apre connessioni proprie); mitigazione: connection pooler (Prisma Accelerate, PgBouncer, Supabase Pooler).
- **Strategie**:
  - Serverless Vercel scala automaticamente a zero in assenza di traffico (costo zero a riposo).
  - Static rendering dove possibile (pagine pubbliche).
  - ISR / on-demand revalidation per contenuti semi-statici (libreria esercizi).

## Cost drivers
- **Vercel**: **Piano Pro** ($20/mese/utente) — scelta confermata per ridurre cold start e migliorare performance.
- **Database**: ❓ **OD-24** — costo dipendente dal provider scelto (Neon/Supabase con connection pooling).
- **YouTube embed**: gratuito (nessun costo di streaming video).
- ❓ **OD-37** — budget mensile stimato: ~$20-30/mese (Vercel Pro + DB managed free tier o piano base).
