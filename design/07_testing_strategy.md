# Testing Strategy

## Tipi di test
- **Unit**: ❓ **OD-38** — framework da definire (Vitest consigliato per Next.js). Target: logica di business pura (validazione schede, calcolo avanzamento, permessi ruolo).
- **Integration**: test delle API Routes con DB reale (test database isolato). Verificare che le route rispettino la matrice permessi.
- **E2E**: ❓ **OD-39** — Playwright consigliato. Da valutare se in scope per MVP.

## Flussi critici da coprire (❓ OD-42)

| Priorità | Flusso | Ruolo |
|---|---|---|
| P0 | Login + redirect alla dashboard corretta in base al ruolo | tutti |
| P0 | Accesso negato a route non autorizzate per ruolo | tutti |
| P1 | Coach: crea esercizio con URL YouTube valido | coach |
| P1 | Coach: crea scheda multi-settimana e la assegna a trainee | coach |
| P1 | Trainee: visualizza scheda corrente | trainee |
| P1 | Trainee: invia feedback su un esercizio | trainee |
| P2 | Coach: visualizza avanzamento e feedback trainee | coach |
| P2 | Admin: crea / modifica / elimina utente | admin |

## Automazione
- ❓ **OD-41** — i test E2E girano in CI (GitHub Actions) o solo in locale pre-push?
- ❓ **OD-40** — soglia minima di coverage da definire (es. 70% su unit/integration).
- Linting e type-check (`tsc --noEmit`, ESLint) eseguiti ad ogni PR come check bloccante.