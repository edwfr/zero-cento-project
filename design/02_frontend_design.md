# Frontend Design

## Pagine principali

### Condivise
| Route    | Descrizione                                                | Ruoli |
| -------- | ---------------------------------------------------------- | ----- |
| `/login` | Pagina di autenticazione                                   | tutti |
| `/`      | Redirect automatico alla dashboard del ruolo dopo il login | tutti |

### Admin
| Route               | Descrizione                             |
| ------------------- | --------------------------------------- |
| `/admin/dashboard`  | Panoramica sistema                      |
| `/admin/users`      | Lista utenti (CRUD admin/coach/trainee) |
| `/admin/users/[id]` | Dettaglio/modifica utente               |

### Coach
| Route                           | Descrizione                                      |
| ------------------------------- | ------------------------------------------------ |
| `/coach/dashboard`              | Panoramica trainee assegnati e stato schede      |
| `/coach/exercises`              | Libreria esercizi condivisa (lista + crea)       |
| `/coach/exercises/[id]`         | Dettaglio esercizio (video YouTube + modifica)   |
| `/coach/exercises/new`          | Creazione nuovo esercizio con campi completi     |
| `/coach/trainees`               | Lista trainee gestiti                            |
| `/coach/trainees/[id]`          | Profilo trainee + schede assegnate               |
| `/coach/trainees/[id]/create`   | Creazione nuovo profilo trainee (genera password) |
| `/coach/trainees/[id]/records`  | Visualizza/modifica massimali trainee            |
| `/coach/programs/new`           | Creazione nuova scheda multi-settimana           |
| `/coach/programs/[id]`          | Dettaglio / modifica scheda                      |
| `/coach/programs/[id]/progress` | Monitoraggio avanzamento + feedback trainee      |
| `/coach/programs/[id]/reports`  | Reportistica SBD e serie allenanti               |

### Trainee
| Route                                        | Descrizione                                       |
| -------------------------------------------- | ------------------------------------------------- |
| `/trainee/dashboard`                         | Scheda corrente in evidenza                       |
| `/trainee/programs/current`                  | Scheda attiva con esercizi per settimana/giorno   |
| `/trainee/programs/[id]/workout/[workoutId]` | Singolo allenamento + form feedback per esercizio |
| `/trainee/history`                           | Storico schede completate/passate                 |
| `/trainee/records`                           | Gestione massimali personali (1RM, nRM)           |
| `/trainee/records/[exerciseId]`              | Storico massimali per esercizio specifico         |
| `/trainee/reports`                           | Visualizza reportistica personale (SBD, volume)   |

## Componenti riutilizzabili
- `ExerciseCard` — mostra nome, thumbnail YouTube, parametri (serie/rip/RPE), gruppi muscolari, tipo (fondamentale/accessorio).
- `MuscleGroupBadge` — badge per gruppo muscolare con coefficiente d'incidenza (es. "Pettorali 80%").
- `MovementPatternIcon` — icona per schema motorio (accosciata, spinta, ecc.).
- `WorkoutProgramBuilder` — editor drag-and-drop settimane/giorni/esercizi (coach).
- `WorkoutExerciseForm` — form per aggiungere esercizio con serie, reps (stringa o intervallo), RPE, peso, recupero, riscaldamento.
- `FeedbackForm` — form per il trainee su un singolo esercizio (RPE effettivo, array di serie con reps/kg, note, completato).
- `SetInput` — input ripetibile per ogni serie (reps + kg) nel feedback.
- `ProgressTracker` — visualizzazione stato avanzamento scheda (coach view).
- `PersonalRecordCard` — card per visualizzare massimale (1RM o nRM) con data e note.
- `PersonalRecordForm` — form per aggiungere/modificare massimale (esercizio, reps, peso, data).
- `SBDReportChart` — grafico per reportistica SBD (FRQ, NBL, IM) con filtro periodo.
- `TrainingVolumeChart` — grafico per serie/ripetizioni totali per gruppo muscolare.
- `YoutubeEmbed` — wrapper per iframe YouTube con lazy load.
- `RoleGuard` — HOC / middleware che reindirizza se il ruolo non è autorizzato.
- `RPESelector` — selector per RPE (5.0-10.0 con incrementi 0.5) con icone/colori.
- `RestTimeSelector` — selector per tempo recupero (30s, 1m, 2m, 3m, 5m).
- `RepsInput` — input per ripetizioni che supporta numero singolo, intervallo (6/8), o range (8-10).

## Gestione stato
- **Locale**: `useState` / `useReducer` per form e UI state effimero.
- **Globale**: **Context API** per sessione utente e dati condivisi semplici (React nativo, zero dipendenze).
- **Server state**: **TanStack Query (React Query)** per fetching, caching, sincronizzazione con API; pattern consolidati e ottima coverage AI.
- **React Server Components**: Utilizzati per rendering SSR di pagine statiche/semi-statiche dove possibile.

## UX states
- **Loading**: skeleton loader su card e tabelle; spinner su azioni brevi.
- **Empty**: illustrazione + CTA contestuale (es. "Nessuna scheda — crea la prima" per il coach).
- **Error**: banner non-invasivo con messaggio di errore leggibile + retry action.

## Design system
- **Librerie UI**: **Tailwind CSS** (styling utility-first, coverage AI eccellente) + **Material UI (MUI)** (componenti accessibili pronti, vastissima documentazione nei training data AI).
  - **Alternativa valutata**: shadcn/ui + Tailwind (più moderno, ma MUI ha maggiore coverage AI).
- **Responsive**: mobile-first; breakpoint standard Tailwind (sm: 640px / md: 768px / lg: 1024px / xl: 1280px).
- **Gestione form**: **React Hook Form** (performance ottimale, pattern semplici) + **Zod** (validation type-safe, schema riutilizzabili, altissima presenza training data AI).
- **Convenzioni CSS**: utility-first con Tailwind; MUI styled con `sx` prop o Emotion quando necessario; nessun CSS globale custom salvo reset e variabili tema.

## Rationale scelte per sviluppo AI-first
Stack selezionato per massimizzare efficacia generazione codice AI:
- **Tailwind CSS**: sintassi concisa, pattern ripetitivi, coverage eccellente nei training data.
- **Material UI**: libreria matura (2014+), vastissima documentazione pubblica, componenti accessibili WCAG, pattern consolidati.
- **React Hook Form + Zod**: standard de facto industry per form validation, schemi dichiarativi, typing forte.
- **TanStack Query**: pattern fetchint/caching consolidati, hooks semantici, documentazione dettagliata.
- **Context API**: React nativo, nessuna libreria esterna, pattern semplici e universali.
