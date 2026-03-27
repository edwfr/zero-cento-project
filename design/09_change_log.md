# Change Log

> Ogni entry documenta una decisione chiusa. Le decisioni aperte vivono in 08_open_decisions.md.

---

## 2026-03-27 (rev 5)
- **Azione**: Chiusura stack frontend (OD-14, OD-15, OD-16) ottimizzato per sviluppo AI-first.
- **OD-14 - Libreria UI**: **Tailwind CSS** + **Material UI (MUI)**
  - Rationale: MUI ha vastissima presenza nei training data AI (matura dal 2014), componenti accessibili pronti, pattern consolidati
  - Tailwind per styling utility-first (coverage AI eccellente)
  - Alternativa valutata: shadcn/ui (più moderno ma meno coverage AI)
- **OD-15 - State management**: 
  - **TanStack Query** per server state (fetching/caching/sync, pattern consolidati, ottima documentazione)
  - **Context API** per global state semplice (React nativo, zero dipendenze)
- **OD-16 - Form management**: **React Hook Form + Zod**
  - Standard de facto industry, altissima presenza training data AI
  - Validation type-safe, schema dichiarativi riutilizzabili
- **Filosofia**: Stack scelto per massimizzare efficacia generazione codice AI (alta coverage training data, pattern ripetitivi, documentazione matura).

---

## 2026-03-27 (rev 4)
- **Azione**: Chiusura OD-12 con dettaglio rischi architetturali. Confermato piano Vercel Pro.
- **OD-12 - Rischi architetturali**: Analizzati e documentati in dettaglio:
  - **Cold start serverless**: Rischio BASSO con Vercel Pro (funzioni restano calde più a lungo)
  - **DB connection pooling**: Rischio MEDIO - soluzione: usare DB managed con connection pooling (Supabase/Neon) + Prisma connectionLimit
- **Infrastruttura**: Confermato piano **Vercel Pro** (~$20/mese) per performance migliori
- **Budget stimato**: ~$20-30/mese (Vercel Pro + DB managed)
- **Implicazioni**: Con Vercel Pro e connection pooling configurato correttamente, l'architettura serverless è adeguata per la scala prevista (54 utenti).

---

## 2026-03-27 (rev 3)
- **Azione**: Chiusura decisioni OD-04, OD-06, OD-07.
- **OD-04 - Scope OUT**: Confermato fuori scope MVP: pagamenti, app nativa (si realizza solo web app responsive mobile-friendly), chat trainer-trainee, funzionalità nutrizione.
- **OD-06 - Vincoli temporali**: Nessun vincolo temporale o milestone rigida al momento.
- **OD-07 - Vincoli organizzativi**: Nessun vincolo organizzativo (team size, processi) al momento.
- **Implicazioni**: Focus su web app responsive, possibile utilizzo di PWA per esperienza mobile-like. Nessuna pressione temporale o burocratica.

---

## 2026-03-27 (rev 2)
- **Azione**: Compilazione di tutti i file di design con le informazioni fornite dal product owner.
- **Decisioni consolidate**: OD-01, OD-02, OD-03, OD-05, OD-08, OD-09, OD-10, OD-11, OD-13, OD-17, OD-23, OD-30, OD-35.
- **Dominio definito**: piattaforma coaching web (Next.js + Vercel), 3 ruoli (admin/coach/trainee), scala iniziale 54 utenti.
- **Entità di dominio definite**: User, CoachTrainee, Exercise, TrainingProgram, Week, Workout, WorkoutExercise, ExerciseFeedback.
- **Prossimi passi**: chiudere le decisioni aperte rimanenti (OD-14 UI lib, OD-24 DB engine, OD-25 ORM, OD-28/29 auth provider, OD-04 scope OUT).

---

## 2026-03-27 (rev 1)
- **Azione**: Prima revisione dell'intero set di documenti di design.
- **Esito**: Tutti i file risultano scaffold vuoti. Nessuna decisione ancora consolidata.
