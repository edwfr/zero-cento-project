# 📋 CHANGELOG - ZeroCento Training Platform

Registro cronologico degli sviluppi effettuati.  
Le metriche percentuali nelle entry sono snapshot storici della data dell'entry.  
Per stato corrente usare sempre [CHECKLIST.md](./CHECKLIST.md).  
**Checklist task pendenti:** [CHECKLIST.md](./CHECKLIST.md)  
**Review sistema:** [system-review.md](./system-review.md)

---

## [6 Maggio 2026] — Exercise focus card: type badge moved to rest row

**Task checklist:** #11.94
**File modificati:** `src/app/trainee/workouts/[id]/_content.tsx`, `public/locales/en/trainee.json`, `public/locales/it/trainee.json`, `tests/unit/trainee-workout-focus.test.tsx`
**Note:** Spostato il badge tipo esercizio (fundamental/accessory) dalla riga titolo alla riga del recupero in `ExerciseFocusCard`, sostituendo le abbreviazioni `F/A` con etichette tradotte complete via i18n (`trainer:exercises.fundamental/accessory`). Aggiornata la label `workouts.rest` a minuscolo (`rest`) in EN/IT e adeguati i test unitari del focus mode trainee.

---

## [6 Maggio 2026] — WeekTypeBanner: layout mobile ottimizzato

Ristrutturato il layout mobile di `WeekTypeBanner` per migliorare la leggibilità su smartphone. Mobile: icona + badge sulla stessa riga (justify-between), titolo sotto a piena larghezza, progress bar in fondo. Desktop invariato (flex-row con badge a destra). Eliminata duplicazione dei `badgeLabels` estraendo la costante fuori dal JSX.

---

## [6 Maggio 2026] — Fix: token i18n rotti in /trainee/history statsLine

Rimosso uso di sintassi ICU plural `{{var, plural, one{} other{}}}` non supportata da i18next senza plugin. Sostituita con 3 chiavi separate (`statsTotal`, `statsActive_count`, `statsCompleted_count`) con suffissi `_one`/`_other` per pluralizzazione nativa i18next. Aggiornato componente `_content.tsx` per comporre la stringa con 3 chiamate `t()` separate.

---

## [6 Maggio 2026] — Components Showcase: avanzamento percentuale nei Week Type Banners

**Task checklist:** #11.81
**File modificati:**
`src/components/WeekTypeBanner.tsx`,
`src/app/components-showcase/page.tsx`,
`public/locales/en/components.json`,
`public/locales/it/components.json`,
`implementation-docs/CHECKLIST.md`

**Note:**
- Esteso `WeekTypeBanner` con prop opzionale `progressPercentage` (normalizzata 0-100) e rendering di `ProgressBar` inline sotto descrizione.
- Aggiornata la demo `/components-showcase` nella sezione Week Type Banners con valori di avanzamento percentuale per ogni tipo settimana.
- Aggiunte chiavi i18n `components.weekTypeBanner.progress` in EN/IT.
- Progress bar dei Week Type Banners ora colorata con il colore primario del tipo settimana (`bg-week-*`) e visualizzazione semplificata con sola percentuale (senza `n / 100`).
- Rimosso il testo descrittivo del tipo settimana nel banner e sostituito il titolo con formato operativo: `Settimana X / Giorno Y - Nome scheda` (con fallback a sola settimana se giorno/scheda non sono forniti).
- Applicato `WeekTypeBanner` anche in `/trainee/workouts/[id]` al posto dell'header sticky custom (giorno/settimana + titolo scheda + badge + barra progress), mantenendo il progress dinamico del workout.
- Rimossa la classe `bg-white` dal wrapper sticky del banner in `/trainee/workouts/[id]` per eliminare il pannello bianco disallineato rispetto alla card esercizio sottostante.
- Rimosso anche il bordo inferiore `border-b border-gray-200` del wrapper sticky per eliminare il separatore grigio tra banner e card esercizio.
- Ridotto lo spazio verticale tra `WeekTypeBanner` sticky e prima card esercizio diminuendo `pb` del wrapper header e `pt` del contenuto scrollabile.
- Ottimizzazione performance focus mode trainee: aggiunta cache client-side per workoutId su `PrevWeekPanel` e `WorkoutRecapPanel`; dalla seconda apertura dello stesso workout i pannelli usano dati in memoria senza nuove chiamate backend.
- Refactor UX `/trainee/workouts/[id]`: rimosso recap dal floating button e trasformato in pannello inline espandibile/collassabile (stile `PrevWeekPanel`), posizionato tra card esercizio e sezione settimana precedente.
- Fix coerenza stato recap: rimossa cache del `WorkoutRecapPanel` per forzare fetch backend a ogni apertura; aggiunta chiusura automatica pannello quando cambia esercizio (navigazione `<`/`>` o selezione esercizio dal recap).
- Corretto calcolo stato in `Riepilogo esercizi`: `done` se `workout_exercises.isCompleted=true`; `not_started` se `isCompleted=false` e nessun `sets_performed.completed=true`; `in_progress` se `isCompleted=false` e almeno un set completato.
- Fix UI `Riepilogo esercizi`: rimosso stile barrato dalle righe set con `completed=false`; ora i set non completati sono solo attenuati (grigio) senza line-through.
- Aggiornato rendering righe set in `Riepilogo esercizi`: per `completed=true` mostra reps/kg effettivi; per `completed=false` mostra reps/weight pianificati dell'esercizio, mantenendo stile barrato per distinguere le serie ancora da completare.
- Semplificato `Riepilogo esercizi` su richiesta UX: rimosso dettaglio espanso per set/RPE/note; il pannello mostra solo riga sintetica per esercizio con nome, schema `serie × rep × kg` e stato avanzamento (`completed/target`).

---

## [6 Maggio 2026] — Stabilizzazione test residui suite completa

**Task checklist:** follow-up QA branch
**File modificati:**
`tests/integration/trainee-workout-prev-week.test.ts`,
`tests/integration/trainee-workout-submit.test.ts`,
`tests/unit/trainee-workout-focus.test.tsx`,
`tests/unit/records-exercise-autocomplete.test.tsx`

**Note:**
- Allineati i test integrazione `prev-week` alla shape aggiornata con `exerciseNote`.
- Aggiornati i test `submit workout` al payload corrente (`traineeNotes`) e alla transazione Prisma che include `workout.update`.
- Aggiornate le aspettative dei test focus mode trainee al comportamento UI corrente (badge tipo esercizio, input set disabilitati dopo completion, warning card nel riepilogo, posizione pannello previous week).
- Ridotta la flakiness del test autocomplete con timeout esplicito del caso lento.
- Verifica finale eseguita: `npm run test:unit` con suite completamente verde.

---

## [6 Maggio 2026] — Refactor dettaglio programma trainee e storico compatto

**Task checklist:** #11.80
**File modificati:**
`src/lib/trainee-program-data.ts`,
`src/components/WorkoutExerciseDisplayList.tsx`,
`src/components/PrevWeekPanel.tsx`,
`src/components/index.ts`,
`src/app/trainee/programs/_components/ProgramDetailContent.tsx`,
`src/app/trainee/history/_content.tsx`,
`public/locales/it/trainee.json`,
`public/locales/en/trainee.json`,
`tests/unit/WorkoutExerciseDisplayList.test.tsx`,
`tests/unit/trainee-program-data-notes.test.ts`,
`tests/unit/prev-week-panel.test.tsx`,
`tests/unit/lib/trainee-program-data.test.ts`,
`vitest.config.ts`,
`implementation-docs/CHECKLIST.md`

**Note:**
- Aggiunta la proprieta `traineeNote` negli aggregati progress (`exercisesPerformed`) caricando la nota piu recente per `workoutExercise` da `exercise_feedbacks.notes`.
- Introdotto il nuovo componente condiviso `WorkoutExerciseDisplayList` per uniformare rendering esercizi/set/note tra pannelli trainee.
- `PrevWeekPanel` ora usa `WorkoutExerciseDisplayList` con mapping dei set precedenti e note trainee.
- `ProgramDetailContent` ora usa toggle settimana icon-only in header, integra `WorkoutExerciseDisplayList` nei dettagli workout e preserva `traineeNote` nel merge program/progress.
- `/trainee/history` compattata con stats inline e card programma monoriga con metadati e avanzamento attivo in testo.
- Aggiornati test unitari correlati e aggiunta copertura dedicata per il nuovo componente.

---

## [6 Maggio 2026] — Note trainee per esercizio e workout summary

**Task checklist:** spec `docs/superpowers/specs/2026-05-06-trainee-workout-notes-design.md`
**File modificati:**
`prisma/schema.prisma`, `prisma/migrations/20260506000001_rename_workout_notes/migration.sql`,
`src/schemas/feedback.ts`,
`src/app/api/trainee/workout-exercises/[id]/feedback/route.ts`,
`src/app/api/trainee/workouts/[id]/submit/route.ts`,
`src/app/api/trainee/workouts/[id]/route.ts`,
`src/app/api/trainee/workouts/[id]/prev-week/route.ts`,
`src/app/api/programs/[id]/workouts/[workoutId]/trainee-notes/route.ts` *(nuovo)*,
`src/app/api/programs/[id]/copy-week/route.ts`,
`src/lib/workout-recap.ts`,
`src/app/trainee/workouts/[id]/_content.tsx`,
`src/components/PrevWeekPanel.tsx`,
`src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx`,
`public/locales/en/trainee.json`, `public/locales/it/trainee.json`,
`tests/unit/workout-recap.test.ts`

**Note:**
- Rinominato `Workout.notes` → `Workout.traineeNotes` (`@map("trainee_notes")`). Campo era sempre null in produzione (mai scritto da API trainer). Migration SQL `ALTER TABLE workouts RENAME COLUMN notes TO trainee_notes`.
- `ExerciseFeedback.notes` ora salvato per-esercizio via `PATCH /feedback` (non più global-notes duplicato). Schema `workoutExerciseAutosaveSchema` aggiornato con `notes` opzionale.
- `workoutSubmitSchema` aggiornato: `notes` → `traineeNotes` top-level. Submit scrive `Workout.traineeNotes` in transazione; non sovrascrive `ExerciseFeedback.notes` per esercizio.
- `GET /api/trainee/workouts/[id]`: risposta include `traineeNotes` + `notes` per ogni feedback.
- `GET /api/trainee/workouts/[id]/prev-week`: query SQL estesa per `ef.notes`; `PrevWeekExerciseItem` include `exerciseNote`.
- `GET /api/programs/[id]/workouts/[workoutId]/trainee-notes`: nuovo endpoint trainer per leggere note trainee di un workout completato.
- `ExerciseFocusCard`: aggiunto textarea + pulsante "Salva Nota" con call a `PATCH /feedback`.
- `FinalStep`: label rinominata `workoutSummaryLabel/Placeholder`; payload invia `traineeNotes`.
- `PrevWeekPanel`: mostra `exerciseNote` con icona `FileText` se non null.
- Trainer workout detail: carica note trainee via fetch silenzioso; mostra sezione "Note trainee" quando workout completato.

---

## [6 Maggio 2026] — Fix badge tipo esercizio in ExerciseFocusCard

**Task checklist:** —
**File modificati:** `src/app/trainee/workouts/[id]/_content.tsx`
**Note:** Nel componente `ExerciseFocusCard` (modalità esecuzione workout trainee) il tipo esercizio era mostrato come testo colorato inline (`<span>` senza sfondo dentro `<h2>`). Sostituito con il badge pill (`bg-red-100`/`bg-blue-100`) coerente con la vista trainer program.

---

## [6 Maggio 2026] — Storico progressione: grafico prima della tabella

**Task checklist:** #11.79
**File modificati:**
`src/app/trainee/records/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Nella sezione espandibile `Storico Progressione` di `/trainee/records` e stato invertito l'ordine dei blocchi: ora il grafico `Andamento 1RM` viene renderizzato prima della tabella storica.
- Nessuna modifica ai dati o alle colonne: cambiato solo l'ordine visuale per migliorare priorita informativa.

---

## [6 Maggio 2026] — Trainee records: solo loader giallo senza testo

**Task checklist:** #11.78
**File modificati:**
`src/app/trainee/records/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Nel loading iniziale di `/trainee/records` e stato rimosso il `FullPageLoader` con copy (`Stiamo preparando...`).
- La schermata mostra ora solo overlay con spinner giallo (`NavigationLoadingOverlay`), senza testo transitorio.

---

## [6 Maggio 2026] — Loader giallo iniziale su schermata trainee records

**Task checklist:** #11.77
**File modificati:**
`src/app/trainee/records/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Al caricamento client-side della schermata `/trainee/records` e stato rimosso il rendering della preview/skeleton tabellare.
- Durante il fetch dei dati viene ora mostrato direttamente il loader brand giallo full-screen (`FullPageLoader`), evitando la visualizzazione parziale anticipata del contenuto pagina.

---

## [6 Maggio 2026] — Bottone Vedi Progressione fit-content e centrato

**Task checklist:** #11.76
**File modificati:**
`src/app/trainee/records/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Aggiornato il bottone `Vedi Progressione` nella card massimali di `/trainee/records` per avere larghezza pari al contenuto (non full width).
- Il bottone e ora centrato orizzontalmente nel contenitore tramite wrapper `flex justify-center`.
- Mantenuta la freccia di stato (su/giu) inline con il testo del bottone.

---

## [6 Maggio 2026] — Fix centratura freccia nel bottone Vedi Progressione

**Task checklist:** #11.75
**File modificati:**
`src/app/trainee/records/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Corretto l'allineamento verticale (asse Y) dell'icona freccia nel bottone `Vedi Progressione` della schermata `/trainee/records`.
- La freccia non usa piu il canale `iconPosition="right"` del componente `Button`, ma viene renderizzata nel contenuto del bottone con layout flex esplicito e `ml-auto`, garantendo centratura visiva stabile.

---

## [6 Maggio 2026] — Sezione filtri piu compatta su trainee records

**Task checklist:** #11.74
**File modificati:**
`src/app/trainee/records/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Compattata la card filtri in alto su `/trainee/records` riducendo padding (`Card` con `padding="sm"`), spazi verticali e gap tra controlli.
- Label filtri rese piu piccole e compatte, con stile uppercase discreto per mantenere leggibilita senza aumentare l'altezza del blocco.
- Pulsanti tipologia ridotti in larghezza minima per densita migliore su mobile mantenendo la stessa logica funzionale.

---

## [6 Maggio 2026] — Refactor barra ricerca e filtri in alto su trainee records

**Task checklist:** #11.73
**File modificati:**
`src/app/trainee/records/_content.tsx`, `public/locales/it/trainee.json`, `public/locales/en/trainee.json`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Refactoring della sezione ricerca in alto nella schermata `/trainee/records` con input piu chiaro (icona search), azione di pulizia query (`Pulisci`) e azione `Reset filtri`.
- Aggiunto contatore risultati dinamico (`N esercizi trovati`) in fondo alla card filtri.
- Mantenuta invariata la logica di filtro per testo e tipologia, migliorando solo UX e leggibilita.

---

## [6 Maggio 2026] — Storico progressione trainee in tabella unica

**Task checklist:** #11.72
**File modificati:**
`src/app/trainee/records/_content.tsx`, `public/locales/it/trainee.json`, `public/locales/en/trainee.json`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Nella sezione espansa di progressione in `/trainee/records` e stato rimosso il layout a card su mobile: lo storico e ora sempre renderizzato in tabella, su tutti i breakpoint.
- Colonne allineate alla richiesta: `Data`, `Test registrato`, `1RM calcolato`.
- Il grafico di andamento 1RM e stato mantenuto invariato sotto la tabella.

---

## [6 Maggio 2026] — Card massimali trainee: rimozione badge PR e due max in riga

**Task checklist:** #11.71
**File modificati:**
`src/app/trainee/records/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Rimossa dalla card in `/trainee/records` la pill con conteggio totale PR per esercizio.
- I due box principali (`Massimale registrato` e `1RM normalizzato`) sono ora forzati sulla stessa riga anche su mobile (`grid-cols-2`) per rendere il confronto immediato.

---

## [6 Maggio 2026] — Enfasi tipografica mobile su valori massimale trainee

**Task checklist:** #11.70
**File modificati:**
`src/app/trainee/records/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Nella card massimali di `/trainee/records` i due valori principali (`Massimale registrato` e `1RM normalizzato`) sono stati resi piu evidenti su mobile con dimensione font aumentata, peso tipografico piu marcato e maggiore separazione visiva delle tile.
- La griglia metriche e ora `1 colonna` su mobile e `2 colonne` da `sm`, per privilegiare leggibilita e gerarchia dei pesi sui dispositivi piccoli.

---

## [6 Maggio 2026] — Refactor mobile-first card massimali trainee

**Task checklist:** #11.69
**File modificati:**
`src/app/trainee/records/_content.tsx`, `public/locales/it/trainee.json`, `public/locales/en/trainee.json`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Ridisegnata la card nella schermata `/trainee/records` in ottica mobile-first con header compatto (titolo esercizio + tipo + data) e metriche in due tile leggibili (`Massimale registrato` e `1RM normalizzato`).
- Sostituita l'azione precedente `Vedi progressione` con trigger full-width stile accordion (`Progressione (tabella + grafico)`) per un'interazione piu chiara su touch.
- La sezione progressione ora mostra storico in doppio formato: card list su mobile e tabella su viewport `md+`, mantenendo il line chart 1RM sotto lo storico.
- Uniformato il calcolo 1RM alla tabella RPE (`estimateOneRMFromRpeTable`) per coerenza con il resto della piattaforma.

---

## [5 Maggio 2026] — Report SBD trainee: celle complete FRQ/NBL/IM

**Task checklist:** #11.68
**File modificati:**
`src/app/trainer/trainees/[id]/_content.tsx`, `implementation-docs/CHANGELOG.md`

**Note:**
- Nella schermata `/trainer/trainees/[id]`, sezione `Report SBD`, ogni cella della tabella per riga fondamentale ora mostra tre metriche come nella vista programma: `FRQ`, `NBL`, `IM`.
- Mantenuto il layout compatto esistente (metriche impilate nella cella) e allineate le label a quelle usate nella tabella SBD di review programma (`reviewProgram.sbdFrqCol`, `reviewProgram.sbdNblCol`, `reviewProgram.sbdImCol`).
- Per i punti pianificati giornalieri, `FRQ` viene valorizzato a `1` quando il fondamentale e presente (`NBL > 0`) altrimenti `0`; `IM` resta `-` in assenza di dato intensita sul payload corrente.

---

## [5 Maggio 2026] — Fix coerenza dati report SBD trainee con workout schedulati

**Task checklist:** #11.68
**File modificati:**
`src/app/trainer/trainees/[id]/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Nel pannello `Report SBD` della schermata trainer trainee (`/trainer/trainees/[id]`) la sorgente dati e stata allineata ai workout pianificati: ora usa i punti di `/api/users/[id]/reports/planned-training-sets` invece dei personal records.
- KPI e grafico SBD riportano quindi volumi schedulati (serie allenanti fondamentali per settimana) mantenendo filtri lift/finestra temporale e il layout compatto.
- Rimossa la semantica 1RM dal pannello SBD (descrizione e tooltip) per evitare incongruenze con i dati pianificati.
- Aggiornata la tabella SBD trainee: la prima colonna resta il fondamentale e le colonne successive mostrano le settimane pianificate incluse nella finestra temporale selezionata (N settimane/periodo filtrato), invece della singola colonna generica `Report SBD`.
- Aggiornata l'etichetta del filtro lift nel pannello SBD trainee: ora mostra `Fondamentale` invece di `Report SBD`.
- Standardizzato il layout filtri nei pannelli report trainee: filtro `finestra temporale` posizionato a sinistra e filtro specifico (`esercizio` o `fondamentale`) a destra.
- Uniformato anche i pannelli report pianificazione embedded allo stile filtri del primo pannello (due select affiancate: finestra temporale a sinistra, filtro specifico a destra).
- Nei filtri multipli (gruppi muscolari) aggiunte azioni esplicite `Seleziona tutti` e `Deseleziona tutti` con nuove chiavi i18n EN/IT.
- Nel secondo pannello (fondamentali pianificati) rimosso lo sfondo grigio interno del blocco grafico e allineato a sfondo bianco.
- Il filtro fondamentali del secondo pannello e ora multi-selezione, con azioni `Seleziona tutti` e `Deseleziona tutti`.
- Rimosso il wrapper pannello annidato nei report pianificazione embedded: filtri e grafico sono ora renderizzati direttamente al livello del pannello principale (stesso comportamento percepito del pannello `Progressione 1RM nel tempo`).
- Il filtro dei fondamentali nel secondo pannello e stato reso multi-selezione tramite badge/chip toggle (non piu select box multipla), mantenendo le azioni `Seleziona tutti` e `Deseleziona tutti`.
- Aggiornata l'etichetta filtro da `Fondamentali visibili` a `Fondamentali`.
- Applicato lo stesso pattern anche al pannello successivo: il filtro `Gruppi muscolari visibili` ora e multi-selezione tramite badge/chip toggle, con azioni `Seleziona tutti` e `Deseleziona tutti`.
- Nella schermata trainee, allineata la copy delle etichette filtro a `Filtra per esercizio` (pannello progressione 1RM) e `Filtra per fondamentale` (pannello Report SBD).
- Nel grafico `Progressione 1RM nel tempo` di `PersonalRecordsExplorer`, il filtro esercizio e stato convertito da select singola a badge multi-selezione, con badge `tutti` per reset rapido.
- Applicata la stessa UX anche nella pagina `/trainer/trainees/[id]`: nel pannello `Progressione 1RM nel tempo` il filtro `Filtra per esercizio` e ora multi-selezione a badge (con badge `tutti`).
- Allineata la colorazione dei badge filtro (fondamentali e gruppi muscolari) ai colori delle serie nei grafici corrispondenti, per coerenza visiva immediata tra filtro e tracciato.
- Nel pannello `Progressione 1RM nel tempo` della pagina trainee, i badge esercizio usano ora la stessa mappa colori delle linee del grafico sottostante (incluso pallino colore per ciascun badge).
- Nel pannello `Report SBD` della pagina `/trainer/trainees/[id]`, il filtro `Filtra per fondamentale` e stato convertito da menu a tendina a badge/chip multi-selezione con opzione `Tutti`, e ogni badge usa il colore della linea corrispondente nel grafico sottostante.
- Normalizzato lo stile badge su tutti i pannelli report della pagina trainee: badge coerenti con il pannello `Progressione 1RM nel tempo` (chip neutro + pallino colore serie) e azioni esplicite `Seleziona tutti / Deseleziona tutti` nei filtri a badge (1RM e SBD), mantenendo lo stesso pattern anche nei pannelli embedded fondamentali e gruppi muscolari.
- Rifinito il layout filtri badge: azioni `Seleziona tutti / Deseleziona tutti` allineate sulla stessa riga della label filtro nei pannelli report trainee, con label filtro badge sempre in maiuscolo anche nei pannelli `Serie allenanti fondamentali pianificate` e `Serie pianificate per gruppo muscolare nel tempo`.

---

## [5 Maggio 2026] — Formato compatto SBD allineato tra edit, review/view e report trainee

**Task checklist:** #11.68
**File modificati:**
`src/app/trainer/programs/[id]/review/_content.tsx`, `src/app/trainer/trainees/[id]/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Allineata la visualizzazione del recap SBD in review/view programma al formato compatto usato nello step edit: matrice per fondamentali (Squat/Panca/Stacco) con colonne settimana e metriche FRQ/NBL/IM impilate in cella.
- Aggiornato anche il pannello `Report SBD` nel dettaglio trainee con tabella compatta (metrica impilata per lift), mantenendo invariati filtri e grafico progressione 1RM.
- La rotta `/trainer/programs/[id]` con `backContext=trainee` eredita automaticamente il nuovo layout perché usa `review/_content.tsx` in modalità `viewOnly`.

---

## [5 Maggio 2026] — Recap SBD aggregato per fondamentali in review/edit programma

**Task checklist:** #11.68
**File modificati:**
`src/app/trainer/programs/[id]/review/_content.tsx`, `src/app/trainer/programs/[id]/edit/_content.tsx`, `public/locales/it/trainer.json`, `public/locales/en/trainer.json`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Nella schermata review programma (`/trainer/programs/[id]/review`) il recap settimanale FRQ/NBL/IM ora aggrega per fondamentali fissi (Squat, Panca, Stacco) invece che per singolo esercizio/variante.
- Nello step edit (`/trainer/programs/[id]/edit`) la card `Reportistica SBD scheda` mostra solo tre righe (Squat, Panca, Stacco) con metriche settimanali aggregate per colonna settimana.
- Aggiornata la copy EN/IT dei testi helper/report per esplicitare la logica per fondamentali.

---

## [5 Maggio 2026] — Istogramma serie allenanti S/B/D in review e reportistica atleta

**Task checklist:** #11.68
**File modificati:**
`src/components/ProgramMuscleGroupCharts.tsx`, `src/app/api/users/[id]/reports/planned-training-sets/route.ts`, `src/components/TraineePlannedMuscleGroupReport.tsx`, `public/locales/it/trainer.json`, `public/locales/en/trainer.json`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Aggiunto nuovo grafico a istogramma settimanale con serie allenanti programmate per i fondamentali Squat, Panca, Stacco nella schermata review programma (`/trainer/programs/[id]/review`) prima della heatmap per gruppo muscolare.
- Introdotto filtro per lift (`Tutti`, `Squat`, `Panca`, `Stacco`) sul nuovo istogramma.
- Estesa l'API `GET /api/users/[id]/reports/planned-training-sets` con aggregazione `fundamentalSets` per settimana, calcolata su tutte le schede attive/completate del trainee.
- Integrato lo stesso istogramma nella reportistica atleta (`/trainer/trainees/[id]` → sezione report pianificazione), mantenendo la finestra temporale esistente e aggiungendo filtro per lift.

---

## [5 Maggio 2026] — Structure step: cross-workout drag, DragOverlay, smooth animation

**File modificati:**
`src/app/trainer/programs/[id]/edit/_content.tsx`

**Note:**
- Singolo `DndContext` condiviso tra tutte le colonne workout: ora è possibile trascinare un esercizio da un workout a un altro.
- Aggiunto `onDragOver` per live preview cross-container: l'elemento si sposta in tempo reale nella colonna destinazione durante il drag.
- Aggiunto `DragOverlay` floating ghost che segue il cursore durante il drag.
- Aggiunto `onDragCancel` che ripristina lo stato pre-drag (Escape cancella il movimento).
- `WorkoutDropContainer` con `useDroppable` permette drop su colonne vuote.
- `SortableStructureRow` ora passa `workoutIndex` come `data` a `useSortable` per tracking cross-container.

---

## [5 Maggio 2026] — Structure step sortable rows + insert separator

**File modificati:**
`src/app/trainer/programs/[id]/edit/_content.tsx`

**Note:**
- Aggiunto ordinamento drag-and-drop (dnd-kit) alle righe dello step scheletro: ogni workout card usa `DndContext` + `SortableContext` con drag handle (GripVertical) su ogni riga.
- Aggiunto separatore "+" tra le righe dello step scheletro: compare al hover tra due righe consecutive e inserisce una nuova riga vuota in quella posizione.
- Introdotti due nuovi componenti interni: `SortableStructureRow` (wrapper div-based per dnd-kit) e `StructureInsertSeparator` (separatore hover con bottone +).
- Introdotte due nuove funzioni: `insertStructureRowAt` (inserisce riga in posizione specifica) e `handleStructureDragEnd` (aggiorna ordine dopo drag).

---

## [5 Maggio 2026] — UX improvements trainer program edit page

**File modificati:**
`src/app/trainer/programs/[id]/edit/_content.tsx`, `src/components/InsertRowSeparator.tsx` (new), `src/lib/computeExerciseGroupColors.ts` (new), `tests/unit/computeExerciseGroupColors.test.ts` (new)

**Note:**
- Rimosso bordo giallo dai pannelli settimane attive: sempre visualizzati con bordo grigio-200 per coherenza visiva.
- Rese immediatamente sortabili via dnd-kit le righe di esercizio non salvate (draft): più necessario attendere il salvataggio prima di riordinarle.
- Aggiunto componente `InsertRowSeparator` con icona "+" inline tra le righe per inserire esercizi in posizione specifica senza ricaricamento manuale.
- Implementato utility `computeExerciseGroupColors` per colorazione alternata grigio delle righe esercizi (gray-50 vs gray-100) basata sul raggruppamento (exercise group id).

---

## [4 Maggio 2026] — Arrotondamento al mezzo chilo per pesi calcolati in %

**File modificati:**
`src/app/trainer/programs/[id]/edit/_content.tsx`

`roundWeightValue` aggiornata: ceil al 0.5kg più vicino (`Math.ceil(precise * 2) / 2`) invece di round a 2 decimali. Si applica solo ai pesi calcolati da % (1RM, nRM, percentage_previous). Es: 8.3 → 8.5, 8.9 → 9.0.

---

## [4 Maggio 2026] — Disable input serie completate nella schermata workout

**File modificati:**
`src/app/trainee/workouts/[id]/_content.tsx`

Input reps e kg di una serie disabilitati (`disabled`) quando `set.completed === true`. Usa il supporto nativo `disabled` del componente `Input` (già stilato con `bg-gray-100 cursor-not-allowed`).

---

## [4 Maggio 2026] — Riepilogo workout: lista esercizi cliccabile con spec e contatore serie

**File modificati:**
`src/app/trainee/workouts/[id]/_content.tsx`, `public/locales/it/trainee.json`, `public/locales/en/trainee.json`

Nel `FinalStep` della schermata workout aggiunta lista esercizi scrollabile. Ogni riga mostra `sets × reps × kg` e un badge `X/Y` con il conteggio serie completate (basato su `sets_performed` con `completed === true`). Cliccando si torna alla card di quell'esercizio. Badge verde = tutto completato, ambra = parziale, grigio = non iniziato.

---

## [3 Maggio 2026] — Update exercise focus card trainee

**File modificati:**
`src/app/trainee/workouts/[id]/_content.tsx`, `public/locales/en/trainee.json`, `public/locales/it/trainee.json`

**Note:**
- Aggiornata card esercizio focus: prefisso compatto `F/A` nel titolo, rimozione badge tipo + badge RPE nella row badge, aggiunta quarta target box `RPE`.

---

## [3 Maggio 2026] — Errori validazione API exercises: messaggio specifico da details

**Task checklist:** #11.67
**File modificati:**
`src/lib/api-error.ts`, `public/locales/it/validation.json`, `public/locales/en/validation.json`, `tests/unit/lib/api-error.test.ts`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Aggiornato `getApiErrorMessage` per leggere e prioritizzare `error.details[0].message` quando presente, prima del fallback su `error.key`.
- Aggiunta risoluzione i18n multi-namespace per chiavi semantiche di validazione restituite da API (es. `validation.minOneMuscleGroup`).
- In assenza di traduzione, il helper restituisce comunque il messaggio specifico ritornato dall'API invece del generico `validation.invalidInput`.
- Aggiunte le chiavi mancanti `validation.minOneMuscleGroup` in EN/IT e copertura unit test dedicata.

---

## [3 Maggio 2026] — Standardizzazione pulsanti azione in PersonalRecordsExplorer

**Task checklist:** #11.65
**File modificati:**
`src/components/PersonalRecordsExplorer.tsx`, `tests/unit/PersonalRecordsExplorer.test.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Sostituiti i pulsanti raw edit/delete (classi `text-blue-600` e `text-red-600`) in entrambe le tabelle di `PersonalRecordsExplorer` con i componenti standard `ActionIconButton` (`variant="edit"` / `variant="delete"`) all'interno di `InlineActions`.
- Rimossi gli import non piu usati `Pencil` e `Trash2` da `lucide-react` nel componente.
- Aggiunto test unitario dedicato che verifica il rendering dei pulsanti standard sia sulla riga record recente sia sulle righe storiche espanse.

---

## [3 Maggio 2026] — Autocomplete standard per esercizio nel modal massimali trainer

**Task checklist:** #11.66
**File modificati:**
`src/app/trainer/trainees/[id]/records/_content.tsx`, `tests/unit/records-exercise-autocomplete.test.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Nel modal `Aggiungi/Modifica Massimale` e stato sostituito il controllo nativo `<select>` dell'esercizio con `AutocompleteSearch` usando la lista `exercises` gia caricata e ordinata lato pagina.
- Mantenuta la stessa semantica di stato: `selectedExerciseId` resta la source of truth, con mapping `onSelect` verso `opt?.id ?? ''`.
- Preservato il comportamento `disabled` in modal edit (`editingRecord`) e il messaggio informativo che impedisce il cambio esercizio.
- Aggiunto test unitario dedicato che apre il modal e verifica assenza del select nativo e presenza di un input associato al campo esercizio.

---

## [3 Maggio 2026] — Fix formato peso percentuale in edit programma trainer

**Task checklist:** #2.7
**File modificati:**
`src/app/trainer/programs/[id]/edit/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Corretto il formato di visualizzazione dei pesi `percentage_1rm` al caricamento da database nella schermata edit programma trainer.
- Dopo refresh la UI mostra ora `numero%` (es. `90%`) invece di `%numero`.

---

## [3 Maggio 2026] — Deferred exercise deletion nel wizard edit programma trainer

**Task checklist:** #2.7
**File modificati:**
`src/app/trainer/programs/[id]/edit/_content.tsx`, `tests/integration/workout-exercise-delete.test.ts`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Il click su cestino per una riga persistita non invia piu DELETE immediata: la riga viene marcata in `pendingDeletesByWorkout` e nascosta subito dalla UI.
- `saveWorkoutRows` applica prima le DELETE pendenti in parallelo e poi invia il bulk PUT con le righe rimaste.
- Gestito il caso limite in cui restano solo cancellazioni: dopo le DELETE viene fatto refresh programma, toast success e chiusura workout senza inviare bulk PUT vuota.
- Aggiunto test di integrazione dedicato per `DELETE /api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]` (vincoli draft/ownership, 404 su workout mismatch, reorder successivo alla delete).

---

## [2 Maggio 2026] — Restyling grafico pagina trainee history

**File modificati:**
- `src/app/trainee/history/_content.tsx` — restyling completo in linea con dashboard trainee: statistiche in alto con `StatCard`, card programma `rounded-2xl` con accento stato sul bordo sinistro, metadata con icone Lucide, hint box stilizzato, empty state con accento brand
- `public/locales/it/trainee.json` — rimosso emoji dal titolo `history.title`; aggiunte chiavi `statsHeading`, `programsHeading`, `progressLabel`, `workoutsLabel`, `noEndDate`
- `public/locales/en/trainee.json` — stesso aggiornamento i18n del blocco `history` in inglese

**Note:**
- Aggiunta progress bar nel solo programma `active` tramite fetch progressivo a `/api/programs/{id}/progress` dopo il caricamento della lista.
- In caso di errore del fetch progress, la pagina resta funzionante e mostra comunque lo storico programmi.

---

## [2 Maggio 2026] — Ottimizzazione POST /api/trainee/workouts/[id]/submit

**File modificati:**
- `src/app/api/trainee/workouts/[id]/submit/route.ts` — rimosso loop sequenziale `cascadeCompletion` (N transazioni separate); spostati gli update `WorkoutExercise.isCompleted` nella transazione principale già esistente; rimosso campo `cascades` dalla response
- `src/lib/completion-service.ts` — parallelizzate le coppie di `count` query in `cascadeFromWorkout` con `Promise.all`
- `tests/integration/trainee-workout-submit.test.ts` — test aggiornati per la nuova struttura

**Impatto:** da `N+1` transazioni DB a `2` transazioni indipendenti dal numero di esercizi; stima risparmio 250–700ms per workout con 6–8 esercizi.

---

## [2 Maggio 2026] — Wizard publish trainer riallineato a 5 step

**Task checklist:** #2.6
**File modificati:**
`src/app/trainer/programs/[id]/publish/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Nella schermata `/trainer/programs/[id]/publish` il progress indicator mostrava 4 step invece dei 5 previsti dal flusso wizard.
- Ripristinato lo step mancante `stepStructure` tra `Setup` ed `Esercizi`.
- Aggiornata la numerazione finale: `Review` resta completato e `Publish` torna correttamente allo step `5` attivo.

## [1 Maggio 2026] — Previous week panel nel focus mode trainee

**Task checklist:** #3.3
**File modificati:**
`src/lib/workout-recap.ts`, `tests/unit/workout-recap.test.ts`, `src/app/api/trainee/workouts/[id]/prev-week/route.ts`, `tests/integration/trainee-workout-prev-week.test.ts`, `src/components/PrevWeekPanel.tsx`, `tests/unit/prev-week-panel.test.tsx`, `src/components/index.ts`, `src/app/trainee/workouts/[id]/_content.tsx`, `tests/unit/trainee-workout-focus.test.tsx`, `public/locales/en/trainee.json`, `public/locales/it/trainee.json`, `vitest.config.ts`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Aggiunto pulsante `History` nell'header sticky del focus mode trainee (visibile solo da settimana 2 in poi) con apertura di un bottom sheet dedicato.
- Introdotto `GET /api/trainee/workouts/[id]/prev-week` con query SQL unica (CTE + LATERAL) per recuperare gli esercizi della settimana precedente e l'ultimo snapshot feedback per esercizio.
- Creato `PrevWeekPanel` con fetch lazy on-open, stati loading/error e rendering dettagliato delle serie (`#set · reps · kg`) o fallback senza dati.
- Estesi i tipi condivisi in `workout-recap` e aggiunti test unit/integration per route, componente e visibilita condizionale del pulsante in base a `weekNumber`.
- Aggiornate chiavi i18n EN/IT (`workouts.prevWeek*`) e inclusa copertura `PrevWeekPanel` in `vitest.config.ts`.

## [1 Maggio 2026] — Stabilizzazione test integrazione workout exercise completion

## [1 Maggio 2026] — Fix ancoraggio footer focus mode workout trainee

**Task checklist:** #3.1
**File modificati:**
`src/app/trainee/workouts/[id]/_content.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Il footer inferiore con contatore step e azione finale e stato portato da `sticky` a `fixed` per mantenerlo ancorato al viewport anche durante scroll rapidi verso l'alto.
- Aggiunto padding inferiore al contenuto scrollabile (`pb-28/sm:pb-32`) per evitare che l'ultima card finisca coperta dal footer fisso.
- Aggiunta gestione `safe-area-inset-bottom` nel container del footer per migliorare la resa su dispositivi mobile con area sicura inferiore.

---

## [1 Maggio 2026] — Stabilizzazione test integrazione workout exercise completion

**Task checklist:** #5.10
**File modificati:**
`tests/integration/workout-exercise-complete.test.ts`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Resi deterministici i mock di `cascadeCompletion` con `vi.mock` statico, evitando `vi.doMock` runtime dopo l'import della route.
- Impostato un default nel `beforeEach` per ownership (`prisma.workoutExercise.findFirst`) e risultato cascade, cosi i test happy-path non dipendono da side effect tra test.
- Allineato il caso `401` al contratto reale di `requireRole` (throw di `Response`) invece di `Error` generico.
- Aggiornata l'aspettativa del caso ownership-negata a `404 NOT_FOUND`, coerente con il comportamento corrente della route.

---

## [1 Maggio 2026] — Workout recap panel nel focus mode trainee

**Task checklist:** #3.2
**File modificati:**
`src/lib/workout-recap.ts`, `tests/unit/workout-recap.test.ts`, `src/app/api/trainee/workouts/[id]/recap/route.ts`, `src/components/WorkoutRecapPanel.tsx`, `src/components/index.ts`, `src/app/trainee/workouts/[id]/_content.tsx`, `public/locales/en/trainee.json`, `public/locales/it/trainee.json`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Aggiunto un pulsante icona `ClipboardList` nell'header sticky del focus mode workout trainee per aprire un pannello riepilogo esercizi.
- Introdotto `WorkoutRecapPanel` come bottom sheet mobile con fetch lazy a `GET /api/trainee/workouts/[id]/recap` solo quando il pannello viene aperto.
- Il nuovo endpoint recap calcola gli stati esercizio direttamente a livello SQL (`not_started`, `in_progress`, `done`) aggregando `sets_performed` via join con `exercise_feedbacks`.
- Ottimizzato `GET /api/trainee/workouts/[id]/recap`: rimossa la `findFirst` preliminare e incorporato controllo ownership trainee direttamente nella query aggregata SQL (un solo roundtrip DB).
- Estratta logica condivisa in `computeExerciseStatus` con test unitari dedicati per i casi limite principali.
- Aggiunte nuove chiavi i18n EN/IT per titolo pannello, etichette stato, loading/error e contatore serie.

---

## [30 Aprile 2026] — Submit workout trainee chiude workout, settimana e programma anche con esercizi incompleti

**Task checklist:** #3.1
**File modificati:**
`src/lib/completion-service.ts`, `src/app/api/trainee/workouts/[id]/submit/route.ts`, `tests/unit/completion-service.test.ts`, `tests/integration/trainee-workout-submit.test.ts`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Il submit finale del workout trainee continua a salvare i flag esercizio dai set inviati, quindi gli esercizi senza esito restano `isCompleted = false`.
- Dopo il submit viene pero marcato esplicitamente `workout.isCompleted = true`, cosi il workout risulta chiuso anche con dati mancanti e il trainer puo tracciare chi non ha completato tutti gli esiti.
- La nuova cascata dal livello workout chiude comunque la settimana se quello inviato era l'ultimo workout utile, e chiude anche il programma se era l'ultimo workout dell'ultima settimana.
- Aggiunti test mirati sia sul servizio di completion sia sulla route di submit.

---

## [30 Aprile 2026] — Warning serie incomplete cliccabili nel riepilogo workout trainee

**Task checklist:** #3.1
**File modificati:**
`src/app/trainee/workouts/[id]/_content.tsx`, `tests/unit/trainee-workout-focus.test.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Il warning `Esercizi con serie non completate` nel riepilogo finale usa ora target espliciti con `stepIndex`, non solo il nome dell'esercizio.
- Ogni warning incompleto e cliccabile e riporta direttamente allo step dell'esercizio corrispondente, come gia avveniva per gli esercizi senza dati.
- Aggiunto test unitario per verificare sia la resa del warning come bottone sia il ritorno allo step corretto al click.

---

## [30 Aprile 2026] — Dashboard trainee riallineata al primo workout non completo

**Task checklist:** #9.1
**File modificati:**
`src/lib/trainee-program-data.ts`, `tests/unit/lib/trainee-program-data.test.ts`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Il `nextWorkout` usato dalla home trainee torna a essere il primo workout non completo in ordine del programma attivo.
- Questo riallinea il bottone `Inizia workout` della dashboard alla proposta mostrata nella schermata programma completo, evitando che un workout piu avanti ma gia iniziato scavalchi il primo incompleto.
- Aggiunto test unitario mirato per il caso con workout successivo gia iniziato ma workout precedente ancora da fare.

---

## [30 Aprile 2026] — Submit workout trainee riallineato con i set completati

**Task checklist:** #3.1
**File modificati:**
`src/app/api/trainee/workouts/[id]/submit/route.ts`, `tests/integration/trainee-workout-submit.test.ts`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- `POST /api/trainee/workouts/[id]/submit` non si limita piu a salvare `exercise_feedbacks` e `sets_performed`, ma riallinea subito anche la completion cascade per ogni `workoutExercise` in base ai set inviati.
- Questo evita il mismatch visto in produzione tra `workoutExercise.isCompleted = true` e payload `feedback.setsPerformed` con serie tutte `completed = false` dopo un submit finale o un salvataggio parziale successivo.
- Aggiunti test di integrazione che verificano sia il caso completo sia il caso parziale con reverse-sync a `false`.

---

## [30 Aprile 2026] — Merge corretto delle spunte serie tra snapshot storici del workout trainee

**Task checklist:** #2.2
**File modificati:**
`src/app/api/trainee/workouts/[id]/route.ts`, `tests/integration/trainee-workout-detail.test.ts`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Il reader del workout trainee non si limita piu a scegliere una singola riga `exercise_feedback` per esercizio quando esistono snapshot su giorni diversi.
- Le `sets_performed` vengono ora mergeate per `setNumber`, preferendo l'ultimo valore `completed = true` disponibile invece di lasciare che uno snapshot piu recente ma incompleto nasconda una serie completata in precedenza.
- Questo copre il caso generato dalla regressione precedente: un workout storico con serie completate a DB ma non piu visibili in UI perche oscurate da un feedback giornaliero successivo e parziale.
- Aggiunto test di integrazione dedicato con due feedback storici sullo stesso `workoutExercise`, uno piu recente incompleto e uno piu vecchio completato.

---

## [30 Aprile 2026] — Spunte serie storiche ripristinate nel workout trainee

**Task checklist:** #2.2
**File modificati:**
`src/app/api/trainee/workouts/[id]/route.ts`, `tests/integration/trainee-workout-detail.test.ts`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Il reader `GET /api/trainee/workouts/[id]` non filtra piu i feedback del workout alla sola data odierna.
- Il payload del workout trainee ora aggancia l'ultimo `exercise_feedback` disponibile per ciascun `workoutExercise`, cosi le spunte da `sets_performed.completed = true` tornano visibili anche aprendo workout storici o workout ripresi in un giorno diverso.
- La regressione era stata introdotta quando la lettura del workout era stata limitata a `today..tomorrow`, mentre submit e autosave continuavano a salvare per data, creando mismatch tra write path e read path.
- Aggiunto test di integrazione che copre esplicitamente il caso di feedback storico non odierno.

---

## [30 Aprile 2026] — Stato programmi trainee allineato a training_programs.status

**Task checklist:** #9.1, #9.2
**File modificati:**
`src/app/api/programs/route.ts`, `src/app/trainee/history/_content.tsx`, `tests/integration/programs.test.ts`, `tests/unit/trainee-history.test.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- `GET /api/programs` non riscrive piu lo `status` dei programmi in base al completamento dei workout: il valore esposto resta quello persistito in `training_programs.status`.
- Il filtro `status=completed` torna a usare solo il dato canonico del database, senza includere programmi `active` solo perche i workout risultano finiti.
- La schermata trainee history non effettua piu fetch ai progress dei programmi per cambiare badge, hint o conteggi: usa esclusivamente lo `status` ricevuto dalla lista programmi.
- Questo riallinea anche la dashboard trainee, che sceglie il programma attivo dalla stessa risposta `/api/programs`.

---

## [29 Aprile 2026] — Fix completamento settimana trainee con workout vuoti

**Task checklist:** #3.1
**File modificati:**
`src/lib/completion-service.ts`, `src/lib/trainee-program-data.ts`, `tests/unit/completion-service.test.ts`, `tests/unit/lib/trainee-program-data.test.ts`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- La cascata di completamento ora ignora i workout senza esercizi quando decide se una settimana puo essere marcata come completed.
- Allo stesso modo il completamento del programma ignora settimane che contengono solo workout vuoti, cosi i placeholder non bloccano la chiusura reale della scheda.
- La progress view trainee usa ora il flag canonico `workout.isCompleted` invece di dedurre il completamento dalla sola esistenza di feedback, evitando mismatch tra autosave puntuale e stato mostrato.
- Il prossimo workout e i conteggi weekly/top-level escludono i workout vuoti, coerentemente con la logica di completamento.

---

## [29 Aprile 2026] — Warning separati e cliccabili per esercizi senza dati nel riepilogo workout

**Task checklist:** #3.1
**File modificati:**
`src/app/trainee/workouts/[id]/_content.tsx`, `tests/unit/trainee-workout-focus.test.tsx`, `public/locales/it/trainee.json`, `public/locales/en/trainee.json`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Il riepilogo finale del workout trainee non mostra piu un solo warning aggregato per gli esercizi senza dati.
- Ora viene renderizzato un warning separato per ogni esercizio senza dati, cosi il trainee vede subito quale esercizio manca.
- Ogni warning e cliccabile e riporta direttamente allo step dell'esercizio corrispondente nel workout.
- Aggiunto test unitario per verificare sia la presenza di warning distinti sia la navigazione al click.

---

## [29 Aprile 2026] — Autosave immediato della spunta serie nel workout trainee

**Task checklist:** #3.1
**File modificati:**
`src/schemas/feedback.ts`, `src/app/api/trainee/workout-exercises/[id]/feedback/route.ts`, `src/app/trainee/workouts/[id]/_content.tsx`, `tests/integration/workout-exercise-feedback.test.ts`, `tests/unit/trainee-workout-focus.test.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Aggiunto endpoint dedicato `PATCH /api/trainee/workout-exercises/[id]/feedback` per salvare subito i `setsPerformed` del singolo esercizio quando il trainee preme la spunta di una serie.
- L’endpoint aggiorna anche il completion flag del `WorkoutExercise` e la cascata `workout -> week -> program` usando la stessa logica di completion già esistente.
- La pagina workout trainee ora chiama questo endpoint direttamente da `toggleSetCompleted`, invece di limitarsi al solo stato locale + `localStorage`.
- In caso di errore l’interfaccia ripristina il set precedente e non lascia la UI in uno stato non persistito.
- Aggiunti test mirati: integrazione per il nuovo endpoint e unit test per la chiamata immediata dalla UI.

---

## [29 Aprile 2026] — Warning inline nel riepilogo workout trainee per serie non completate

**Task checklist:** #3.1
**File modificati:**
`src/app/trainee/workouts/[id]/_content.tsx`, `public/locales/it/trainee.json`, `public/locales/en/trainee.json`, `tests/unit/trainee-workout-focus.test.tsx`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- Nel passo finale del workout trainee i warning sono ora mostrati subito sotto il campo note del riepilogo.
- Aggiunto un warning dedicato per gli esercizi che hanno almeno una serie spuntata ma non tutte le serie segnate come completate.
- Il warning esistente per gli esercizi senza dati resta separato, così il riepilogo distingue chiaramente tra esercizi mai compilati ed esercizi compilati solo in parte.
- Aggiunto test unitario per il caso con serie parzialmente completate.

---

## [29 Aprile 2026] — Fix: current program coerente dalla trainee dashboard

**Task checklist:** #9.3
**File modificati:**
`src/app/trainee/dashboard/_content.tsx`, `src/app/trainee/programs/current/page.tsx`, `src/app/trainee/workouts/[id]/page.tsx`, `src/app/trainee/workouts/[id]/_content.tsx`, `src/lib/trainee-program-data.ts`, `tests/unit/lib/trainee-program-data.test.ts`, `implementation-docs/CHECKLIST.md`, `implementation-docs/CHANGELOG.md`

**Note:**
- La card "Programma attivo" nella dashboard trainee ora apre `/trainee/programs/current` con il `programId` del programma mostrato, evitando che la pagina current ricalcoli un programma diverso quando esistono più programmi attivi.
- `loadActiveProgramId()` ora accetta un `preferredProgramId` opzionale e lo usa solo se appartiene al trainee ed è ancora `active`; in caso contrario fa fallback alla lookup standard.
- Il flusso `current -> workout -> current` preserva lo stesso `programId` sia nel back link del layout sia nel redirect post-submit, così la navigazione resta coerente sull'intero percorso.
- Aggiunti test unitari per il caso preferito valido e per il fallback quando l'id richiesto non è più attivo.

---

## [29 Aprile 2026] — Atomic workout submit + drop ExerciseFeedback.completed

**File modificati:**
`src/schemas/feedback.ts`, `src/app/api/trainee/workouts/[id]/submit/route.ts`, `tests/integration/trainee-workout-submit.test.ts`, `src/app/trainee/workouts/[id]/_content.tsx`, `src/app/api/programs/[id]/reports/route.ts`, `src/lib/program-status.ts`, `src/app/trainer/dashboard/page.tsx`, `src/app/api/feedback/route.ts`, `src/app/api/feedback/[id]/route.ts`, `src/schemas/feedback.ts`, `tests/integration/feedback.test.ts`, `prisma/schema.prisma`, `prisma/migrations/20260429000000_drop_feedback_completed/migration.sql`

**Note:**
- **Aggiunto** `POST /api/trainee/workouts/[id]/submit` — endpoint atomico che persiste note + per-exercise (actualRpe + sets[]) per un intero workout in una singola transazione. Sostituisce gli N `POST /api/feedback` paralleli (uno per esercizio) e il loop di auto-sync continuo.
- **Rimosso** `POST /api/feedback` e `PUT /api/feedback/[id]` (non più usati dal client trainee; admin/trainer mantengono accesso `GET`).
- **Rimosso** auto-sync continuo dalla pagina workout del trainee; localStorage continua a preservare le bozze sullo stesso dispositivo.
- **Schema** Eliminata la colonna `ExerciseFeedback.completed` (sempre true dopo il refactor; ridondante con `WorkoutExercise.isCompleted`). Migrazione: `20260429000000_drop_feedback_completed`.
- **Follow-up** Completata la pulizia dei residui post-refactor: rimosso l'ultimo filtro runtime su `ExerciseFeedback.completed` in `test-results` e riallineati i test (`api-contracts`, `completion-service`, `calculations`) alla shape Prisma aggiornata.
- **Perché** Riduce il flusso di submit da ~5–8s (8 POST × doppia auth) a <1s (1 POST × 1 transazione); rimuove una colonna ridondante e i suoi siti di filtro.

---

## 28 Aprile 2026 — Auto-complete workout_exercise al completamento serie

**File modificati:**
- `src/app/trainee/workouts/[id]/_content.tsx`

**Note:** Rimosso il pulsante manuale "Segna come completato". Ora il record `workout_exercise.isCompleted` viene aggiornato automaticamente: si setta a `true` quando il trainee spunta l'ultima serie dell'esercizio (tutte le serie completate), e si setta a `false` se il trainee annulla la spunta su una qualsiasi serie mentre l'esercizio era già marcato come completato. La funzione `toggleExerciseCompleted` è stata sostituita da `markExerciseCompleted(id, bool)` con valore esplicito; `toggleSetCompleted` ora calcola il nuovo stato delle serie prima di `setFeedbackData` e invoca automaticamente `markExerciseCompleted`.

---

## 28 Aprile 2026 — Fix: NavigationLoadingOverlay stuck after new program creation

**File modificati:**
- `src/components/NavigationLoadingProvider.tsx`

**Problema:** Dopo la creazione di un nuovo programma, `navLoader.start()` veniva chiamato in `NewProgramContent` ma `stop()` non veniva mai chiamato sulla pagina di destinazione. Il provider persiste across client-side navigations (è montato in `providers.tsx`), quindi l'overlay restava visibile indefinitamente.

**Fix:** `NavigationLoadingProvider` ora usa `usePathname()` per rilevare il cambio di route e chiama automaticamente `stop()` al completamento della navigazione.

---

## 28 Aprile 2026 — Feature: Exercise Completion Tracking con Cascade Logic

**Task checklist:** Trainer Management → Exercise Completion Tracking (FASE 1-10)

**File modificati:** 
- Schema: `prisma/schema.prisma` (3 campi + 3 indici)
- Backend service: `src/lib/completion-service.ts` (nuovo)
- API endpoint: `src/app/api/trainee/workout-exercises/[id]/complete/route.ts` (nuovo)
- GET endpoint: `src/app/api/trainee/workouts/[id]/route.ts` (updated)
- Frontend: `src/app/trainee/workouts/[id]/_content.tsx` (state + logic + JSX)
- i18n: `public/locales/en/trainee.json`, `public/locales/it/trainee.json`
- Tests: `tests/unit/completion-service.test.ts` (nuovo, 6 test cases), `tests/integration/workout-exercise-complete.test.ts` (nuovo, 7 test cases)

**Descrizione:**
Implementata tracciamento esplicito del completamento degli esercizi. Il trainee può ora marcare un esercizio come completato con un click su un pulsante verde/grigio nel focus mode. La marcatura cascata automaticamente verso l'alto: se tutti gli esercizi di un workout sono completati → workout marcato come completato; se tutti i workout di una week → week completata; se tutte le week → programma completato (status='completed').

**Architettura:**
1. **Schema Prisma:** Aggiunti 3 boolean `isCompleted` (default false) su WorkoutExercise, Workout, Week + 3 indici compositi ottimizzati per COUNT query sulla cascata.
2. **Completion Service (`completion-service.ts`):** Transazione atomica con logica di cascata bidrazionale:
   - Completamento: esercizio → workout → week → programma
   - De-completamento: reverte upstream levels se dipendenze lo permettono
   - Guard: workout/week/programma completati solo se tutti figli completati; workout con 0 esercizi rimane incomplete
   - Conditional updates: solo i level di cui lo stato effettivamente cambia vengono aggiornati (riduce write DB)
3. **API Endpoint (`PATCH /api/trainee/workout-exercises/[id]/complete`):** 
   - Valida input Zod: `{ isCompleted: boolean }`
   - Verifica ownership: single findFirst nested query per trainee
   - Chiama `cascadeCompletion()` e ritorna `CascadeResult` con stati aggiornati ai 4 livelli
   - Segue pattern copilot-instructions.md §3.5 esattamente
4. **Frontend (`_content.tsx`):**
   - State `exerciseCompleted: Record<string, boolean>` inizializzato da API response
   - Toggle handler con optimistic update + fire-and-forget PATCH
   - Error revert + toast su failure
   - ExerciseFocusCard button tra sets e RPE selector
   - Toast cascade: mostra success toasts sequenziali se workout/week/programma vengono completati (max 3 toasts con delay 200ms)
5. **i18n:** 7 nuove chiavi (EN + IT):
   - `markExerciseComplete` / `markExerciseIncomplete` (button label)
   - `exerciseCompleted`, `errorMarkComplete` (feedback)
   - `workoutCompletedToast`, `weekCompletedToast`, `programCompletedToast` (celebrations)

**Performance:** 
- No N+1: cascata è single transaction con 4 aggregates (COUNT queries indicizzate)
- Fire-and-forget PATCH non blocca UX
- Optimistic update risponde istantaneamente
- Indici compositi (`[workoutId, isCompleted]`, `[weekId, isCompleted]`, `[programId, isCompleted]`) ottimizzano COUNT

**Testing:**
- Unit: 6 test per `cascadeCompletion()` (partial, full cascade, de-completion, empty workout, state no-change, error handling)
- Integration: 7 test per PATCH endpoint (200 success, 400 validation, 401 unauthorized, 403 forbidden, 404 not found, toggle, ownership)

---

## 28 Aprile 2026 — Bugfix: workout con reps "max" mostrato come non completato

**File modificati:** `src/lib/trainee-program-data.ts`, `src/app/trainee/workouts/[id]/_content.tsx`, `tests/unit/lib/trainee-program-data.test.ts`

**Bug 1 – SQL `COUNT` non usa `DISTINCT` (root cause principale)**
Il calcolo `exerciseCount` nella query SQL di `loadProgressAggregates` usava `COUNT(we."id")` senza `DISTINCT`. Quando un esercizio aveva più record `ExerciseFeedback` (es. draft sync il giorno 1 + submit finale il giorno 2 con idempotency per data), l'esercizio veniva conteggiato N volte → `exerciseCount > completedExerciseCount` → workout mostrato come non completato anche con tutti i feedback `completed = true`.  
**Fix:** `COUNT(DISTINCT we."id")::int AS "exerciseCount"`.

**Bug 2 – UX: toggle su serie "max" bloccato senza reps inserite**
`toggleSetCompleted` bloccava il completamento di serie con `reps = "max"` se l'utente non aveva inserito un valore numerico. `parsePlannedReps("max") = 0`, quindi la serie non veniva mai marcata come `completed`, il contatore `completedExerciseCount` sul workout page mostrava "0/N esercizi completati" e `emptyExerciseNames` avvertiva di dati mancanti, impedendo di fatto la comprensione che il workout era completabile.  
**Fix:**
- `toggleSetCompleted`: rimosso il blocco per esercizi non-numerici ("max", range). Il blocco rimane solo per esercizi a reps precisa (`/^\d+$/`) dove si vuole auto-fill.
- `completedExerciseCount` e `emptyExerciseNames`: per esercizi non-numerici basta `s.completed = true` (senza richiedere `s.reps > 0`).
- Placeholder input reps: mostra il valore numerico per reps precise, altrimenti mostra `we.reps` (es. "max", "8-10") come hint.

**Test aggiunti:** 2 nuovi test unit in `tests/unit/lib/trainee-program-data.test.ts`
- Verifica che la SQL usi `COUNT(DISTINCT we."id")`
- Verifica che il workout risulti `completed: true` quando `exerciseCount === completedExerciseCount`


- `src/app/api/programs/[id]/route.ts` (conditional PR map, role-aware exercise select)
- `src/app/api/programs/[id]/progress/route.ts` (refactored to use shared helper)
- `src/app/api/trainee/active-program/route.ts` (created)
- `src/lib/trainee-program-data.ts` (created, shared server helper)
- `src/app/trainee/programs/[id]/page.tsx` (server-side data fetch)
- `src/app/trainee/programs/[id]/_content.tsx` (accept initialData prop)
- `src/app/trainee/programs/current/page.tsx` (server-side data fetch)
- `src/app/trainee/programs/current/_content.tsx` (accept initialData prop)
- `src/app/trainee/programs/_components/ProgramDetailContent.tsx` (TanStack Query integration)
- `tests/integration/program-detail.test.ts` (created, 4 test cases)
- `tests/integration/program-progress.test.ts` (created, 4 test cases)
- `tests/integration/trainee-active-program.test.ts` (created, 3 test cases)
- `tests/unit/lib/trainee-program-data.test.ts` (created, 5 test cases)

**Note:** 
- Task 1: Skip PR map fetch in `GET /api/programs/[id]` when all exercises use weightType=absolute (saves one Prisma round-trip).
- Task 2: Role-aware exercise include in `GET /api/programs/[id]`. Trainees now get slim `{id, name, type}` select instead of full movementPattern + muscleGroup tree.
- Task 3: Replace tree-load with SQL aggregates in `GET /api/programs/[id]/progress`. Workout completion, weekly volume, and avg RPE now come from `$queryRaw` + `exerciseFeedback.aggregate`; latest performed sets via targeted `setPerformed.findMany`.
- Task 4: Add lightweight `GET /api/trainee/active-program` endpoint. Returns the active program id (or 404), replacing the heavier listing call previously used by /trainee/programs/current.
- Task 5: Create shared server helper `loadTraineeProgramView` and `loadActiveProgramId` in `src/lib/trainee-program-data.ts`. Consolidates program tree loading + progress aggregation for use by server components.
- Task 6: Server-component data fetching. Page components now call `loadTraineeProgramView` directly and pass `initialData` to client, eliminating client→API waterfall on first paint.
- Task 7: TanStack Query integration. `ProgramDetailContent` now uses `useQuery` for both program and progress with `staleTime: 60_000`, `refetchOnWindowFocus: true`, and initialData support. Removes manual fetch logic and replaces with React Query lifecycle management.
- Task 8: Consolidate expand-state effects. Extract expand state computation to useMemo (`defaultExpandState`), reducing side-effect complexity and improving clarity.
- Task 9: Update audit documentation. Mark item #4 in `docs/api-efficiency-audit.md` as complete. Add Section 6 to `docs/performance-analysis.md` with before/after summary of performance gains.

---

## 2026-04-28 — Trainee Workout Mobile Focus Mode Redesign

**Task:** Implement single-exercise focus mode for trainee workout detail page  
**Files modificati:**
- `src/app/trainee/workouts/[id]/_content.tsx` (1,400+ lines)
- `tests/unit/trainee-workout-focus.test.tsx` (7 test cases)
- `tests/e2e/trainee-complete-workout.spec.ts` (selector updates)
- `public/locales/en/trainee.json` (15 new i18n keys)
- `public/locales/it/trainee.json` (15 new i18n keys)

**Cambio Architetturale:**
Ridefinitura completa della UX per mobile in-gym usage:
- **Old layout:** Tabella con tutti gli esercizi espandibili, lista di set in righe
- **New layout:** Single-exercise focus mode con navigazione step-by-step

**Componenti Aggiunti:**
1. **Sticky Top Bar** (48px) - Giorno/settimana info + collapsible info sheet
   - Testo: "G{{day}} · S{{week}}" (es. "G3 · S2")
   - Info sheet modale con dettagli: giorno, settimana, programma

2. **Exercise Focus Card** (ExerciseFocusCard subcomponent)
   - Mostra esercizio corrente con 1 set visibile per volta
   - Input per weight (kg) e reps per ogni set
   - RPE selector dropdown
   - Video link (se disponibile)
   - Tap-to-complete shortcut: 1 click auto-popola weight/reps dai dati trainer

3. **Sticky Bottom Nav** (64px)
   - Step counter: "3 / 6" (es. 3° esercizio di 6)
   - Pulsanti: [Indietro] [Avanti] con logica hide/show
   - Final step mostra [Completa allenamento] button

4. **Final Summary Step**
   - Riepilogo: "{{done}} / {{total}} esercizi · {{sets}} set" (es. "4 / 6 esercizi · 22 set")
   - Note textarea (opzionale)
   - **Inline warning** (non modale) per esercizi senza dati:
     - "Esercizi senza dati: Leg Press, Leg Curl"
     - Rimane visibile durante il submit

**State Management:**
- Aggiunto `currentStep` (0..exercises.length, dove .length è final step)
- Aggiunto `infoSheetOpen` per collapsible info sheet
- `toggleSetCompleted()` nuovo: tap-to-complete con logica:
  - Se reps/weight sono 0 (vuoti): popola da `parsePlannedReps(we.reps)` e `effectiveWeight`
  - Altrimenti: toggle completamento senza overwrite
- Preserved: localStorage persistence, draft sync, pagination

**i18n (15 nuove chiavi per esercizio):**
```
dayWeekShort, workoutInfo, workoutInfoTitle, workoutInfoDay, workoutInfoWeek, workoutInfoProgram,
next, prev, completeShort, summaryTitle, summaryStats, missingDataInline, setsHeading, repsShort, kgShort
```
EN/IT translations aggiunte in `public/locales/{en,it}/trainee.json`

**Test:**
- Unit tests scaffoldato (7 test cases) - test di focus mode navigation, tap-to-complete, final step
- E2E tests aggiornati con nuovi selectors data-testid (focus-mode-header, exercise-focus-card, bottom-nav, step-counter)
- Type check passato ✅

**Notes:**
- Component ~1,400 lines (preserve vs old 1,100) — complexity tradeoff for mobile UX
- Inline warning elimina modal friction (spec requirement)
- Tap-to-complete riduce 3 input taps a 1 button click per set (major UX win)
- Swipe navigation via useSwipe hook integrato
- Draft localStorage sync continuato per resistenza perdita dati

---

## 2026-04-27 — Active Program Card Redesign

**File modificati:** 
- `src/app/trainee/dashboard/_content.tsx`
- `public/locales/it/trainee.json`
- `public/locales/en/trainee.json`

**Cambio:** Redesign della card "Programma Attivo" nella trainee dashboard per allinearla visivamente alla card "Prossimo Allenamento":
- Container: da `rounded-lg border-l-4 border-l-brand-primary` a `rounded-2xl` (no left border)
- Nuovo layout con hero `%` completamento (`text-6xl sm:text-7xl font-black` centrato) e sub-label "completato"
- Rimosso nome del trainer
- Barra di progresso mantenuta sotto l'hero
- Contatore allenamenti (completed/total) in riga secondaria sotto la barra
- Titolo programma + durata collassati in unica riga secondaria
- CTA "Vai al programma completo" mantenuto in fondo
- Aggiunta chiave di traduzione: `dashboard.completedLabel` ("completato" / "completed") in it/en

**Note:** Nessun test unitario aggiunto (il file non è coperto da `vitest.config.ts`). La verifica è manuale via `npm run dev` e type-check/lint passano correttamente.

---

## 2026-04-27 — Trainee dashboard: Next workout card redesign

**File modificati:** 
- `src/app/api/programs/[id]/progress/route.ts`
- `src/app/trainee/dashboard/_content.tsx`
- `src/components/index.ts`
- `public/locales/en/trainee.json`
- `public/locales/it/trainee.json`

**Cambio:** Redesign della carta "Prossimo allenamento" con layout premium-minimal:
- Nuovo layout con numerali grandi (day in brand-primary, week in neutral gray, separatore puntato)
- Badge opzionale `WeekTypeBadge` per settimane non-standard (test/deload)
- Aggiunte chiavi di traduzione: `dashboard.dayLabel`, `dashboard.weekLabel`, `dashboard.startWorkoutAria`, `weekType.{normal,test,deload}` in entrambe le lingue (en, it)
- Backend: aggiunto campo `weekType` nel payload di `GET /api/programs/[id]/progress` per fornire al frontend il dato necessario per il badge

**Note:** Nessun test unitario aggiunto (il file non è coperto da `vitest.config.ts`). La verifica è manuale via `npm run dev` e type-check/lint passano correttamente.

---

## 2026-04-27 — Trainee dashboard UI refinements

**File modificati:** 
- `src/app/trainee/dashboard/_content.tsx` (layout uniforme, button alignment)
- `public/locales/it/trainee.json` (traduzione workoutDay)

**Note:** 
1. Uniformato il padding delle card "Prossimo allenamento" e "Programma attivo" (entrambe `p-8`)
2. Reso i bottoni `w-full` per garantire larghezza identica tra le due card
3. Modificato template di traduzione: da "{{day}} - Settimana {{week}}" a "Workout {{day}} - Settimana {{week}}"

---

## 2026-04-27 — Move "View Full Program" button to Active Program card

**File modificati:** `src/app/trainee/dashboard/_content.tsx`

**Note:** Spostato il tasto "Programma completo" (viewFullProgram) dalla card "Prossimo allenamento" (nextWorkout) alla card "Programma attivo" (Active Program Card), posizionato dopo la barra di progresso per migliorare l'organizzazione logica della schermata dashboard trainee.

---

## 2026-04-27 — Loader standardization (Phase 1 + partial Phase 2)

**File modificati:** 
- `src/components/NavigationLoadingOverlay.tsx` (new)
- `src/components/NavigationLoadingProvider.tsx` (new)
- `src/app/layout.tsx`
- `src/app/loading.tsx`, `src/app/trainer/programs/new/loading.tsx`, + 26 other route loading.tsx files (new)
- `src/app/admin/users/_content.tsx`
- `src/app/trainer/programs/new/NewProgramContent.tsx`
- `CLAUDE.md`

**Goal:** Standardize loading indicators across the application into two patterns:
1. **Click-triggered async:** inline button-level spinner via `<Button isLoading={...}>` or `<ActionIconButton isLoading={...}>`
2. **Page navigation:** semitransparent overlay with primary-color spinner via `NavigationLoadingOverlay` (auto-rendered by `loading.tsx` or via `useNavigationLoader()` for client-driven redirects)

**Implementation:**
- **Phase 1 — Infrastructure (COMPLETE):**
  - Created `NavigationLoadingOverlay` component — lightweight fullscreen overlay (no logo, no branding)
  - Created `NavigationLoadingProvider` + `useNavigationLoader()` hook for client-driven overlay control
  - Wired provider into root layout (`src/app/layout.tsx`)
  - Added `loading.tsx` to all 28 route segments (admin, trainer, trainee at every level)
  
- **Phase 2 — Button Migration (PARTIAL):**
  - Migrated `src/app/admin/users/_content.tsx`: added `pendingUserId` state, converted bulk activate/deactivate buttons to `<Button isLoading={bulkLoading}>`, converted per-row status toggle to `<ActionIconButton isLoading={pendingUserId === user.id}>`
  - Migrated `src/app/trainer/programs/new/NewProgramContent.tsx`: replaced inline `<LoadingSpinner>` button with `<Button isLoading={loading}>`, added `useNavigationLoader().start()` before `router.push()` for smooth overlay transition
  - Removed import of deprecated `LoadingSpinner` from new program creation
  
**Remaining Phase 2 tasks (20+ files):** Trainer list/detail pages, program editor flows, trainee pages, auth/onboarding. Follow migration pattern in `CLAUDE.md` loader section.

**Notes:**
- `FullPageLoader` (with logo + branding) is now reserved for cold-start / app-bootstrap only. In-app navigation uses `NavigationLoadingOverlay` exclusively.
- Per-row pending state pattern: add `const [pendingId, setPendingId] = useState(null)`, then `isLoading={pendingId === item.id}` on action buttons.
- i18n keys reused: `common.saving`, `common.creating`, `common.deleting`, `common.submitting`, `common.loadingPageTransition`.

**Tests added:**
- `tests/unit/components/NavigationLoadingOverlay.test.tsx` (3 tests)
- `tests/unit/components/NavigationLoadingProvider.test.tsx` (2 tests)

**Commits:**
1. feat(components): add NavigationLoadingOverlay for routing transitions
2. feat(components): add NavigationLoadingProvider with useNavigationLoader hook
3. feat(layout): mount NavigationLoadingProvider in root layout
4. feat(loading): add loading.tsx to all route segments
5. refactor(trainer,admin): standardize button loading state in new program + users pages

---

## 2026-04-27 — Trainee workout navigation: fix back button behavior

**File modificati:** `src/app/trainee/workouts/[id]/_content.tsx`

**Problema:** Quando l'utente accede a un workout dalla dashboard tramite `/trainee/programs/current`, il back button (sia nativo del browser che tramite submit) lo riporta a `/trainee/programs/current` invece che alla dashboard.

**Soluzione implementata:**
- Aggiunto `useSearchParams()` per leggere il parametro di query `from` passato dal link `ProgramDetailContent.tsx` (riga 728: `?from=${mode}`)
- Modificato `doSubmit()` per navigare intelligentemente: se `from='current'` naviga a `/trainee/programs/current`, altrimenti a `/trainee/dashboard`
- Aggiunto back button visibile (icona `ChevronLeft`) nell'intestazione del workout che usa `router.back()` per mantenere la storia del browser naturale
- Importato `useSearchParams` da `next/navigation` e `ChevronLeft` da `lucide-react`

UX migliorata: l'utente è sempre portato alla pagina giusta dopo il submit, indipendentemente da dove ha iniziato il workout. Il back button è visibile e intuitivo.

---

## 2026-04-27 — Trainee dashboard: compact active program card

**File modificati:** `src/app/trainee/dashboard/_content.tsx`

**Cambio:** Redesign della carta "Active Program" per ridurre ingombro visivo e focus su stato di avanzamento:

- Rimosso CTA "View Full Program" / "Programma Completo" (già presente sulla carta "Next Workout" sopra)
- Collassati tre tile di stat (`duration`, `progression`, `completion`) in un'unica riga `flex flex-wrap` inline con label + value compatti
- Ridotti padding container `p-8` → `p-5`, heading `text-3xl` → `text-xl`, label `text-sm` → `text-xs`
- Progress bar slimmed `h-3` → `h-2` con ARIA attributes aggiunti (role, aria-valuenow, aria-valuemin, aria-valuemax, aria-label) per accessibilità
- Nessun cambio a API, schema, o locale keys (tutte le stringhe `trainee:dashboard.{duration,weeks,progression,workoutsProgress,completion,trainerWith}` già presenti)

UX migliorata: card compatta, visibilità chiarissima dello stato (inline meta row), ridondanza CTA eliminata.

---

## 2026-04-27 — Reseed trainer/trainee users with real names

**File modificati:** `prisma/seed.ts`

**Cambio:** Sostituito set utenti seed (`Marco Rossi` + `Trainee1-4`) con utenti reali strutturati per trainer:

- Trainer `filippo.bittoni@zerocento.app` (Filippo Bittoni) → trainees: Nicoletta Ciriachi, Luca Cormano, Luca Casagrande
- Trainer `edoardo.frati.coach@zerocento.app` (Edoardo Frati Coach) → trainee: Edoardo Frati Trainee (`edoardo.frati.trainee@zerocento.app`)

Convenzione email: `<firstname>.<lastname>@zerocento.app`. Per omonimia Edoardo Frati, suffisso ruolo (`coach`/`trainee`) per disambiguare.

Supabase `user_metadata` popolato con `{ role, firstName, lastName, isActive }` per ogni utente. Password riusano env `SEED_TRAINER_PASSWORD` / `SEED_TRAINEE_PASSWORD` (default `Trainer1234!` / `Trainee1234!`).

`TrainerTrainee` join creato per ciascun mapping. Admin anchor invariato.

---

## 2026-04-26 — Review page: unified queries and DB-side PR aggregation

**File modificati:** `src/app/api/programs/[id]/review/route.ts` (nuovo), `src/app/trainer/programs/[id]/review/_content.tsx`

**Problema:** La pagina `/trainer/programs/[id]/review` eseguiva due chiamate HTTP sequenziali (waterfall):
1. `GET /api/programs/{id}` → risposta con il `traineeId`
2. `GET /api/personal-records?traineeId={traineeId}` → tutti i PR del trainee

Il client poi eseguiva tre catene `useMemo` per raggruppare i PR per esercizio, trovare il best PR e calcolare l'1RM stimato.

**Ottimizzazioni applicate:**
- Creato endpoint dedicato `GET /api/programs/[id]/review/route.ts` che:
  - Esegue un check ownership leggero (`findFirst` con `select` minimo)
  - Recupera il programma completo e i PR in **parallelo** via `Promise.all`
  - Usa una singola query SQL con `GROUP BY ("exerciseId", reps)` per ottenere il peso massimo per combinazione esercizio×ripetizioni — aggregazione lato DB invece che lato client
  - Calcola `estimatedOneRMByExercise` e `bestWeightByExerciseAndReps` server-side (una passata O(n) sui risultati) e li restituisce già pronti
- Aggiornato `_content.tsx`:
  - Una sola chiamata `/api/programs/${programId}/review` invece di due sequenziali
  - Rimossi `personalRecords` state e le tre catene `useMemo` (`recordsByExercise`, `bestPRs`, `estimatedOneRMByExercise`)
  - `resolveEffectiveWeightFallback` semplificata: usa `bestWeightByExerciseAndReps[exerciseId][reps]` invece di filter+reduce su array di record
  - Rimossa la funzione `estimateOneRMValue` (non più usata nel client)

**Risultato:** Da 2 chiamate HTTP sequenziali + ~11 query DB + 3 useMemo a 1 chiamata HTTP + query parallele (≈9 query programma + 1 query SQL aggregata per i PR).

---

## 2026-04-26 — Bulk Workout Exercise Save Optimization

- Added `bulkSaveWorkoutExercisesSchema` to `src/schemas/workout-exercise.ts` with optional `id` per row to support mixed creates/updates
- Implemented bulk PUT endpoint `/api/programs/[id]/workouts/[workoutId]/exercises/bulk` that accepts an array of exercise rows (with optional IDs) and performs all creates/updates in a single Prisma transaction
- Refactored `saveWorkoutRows` in trainer workout edit page to call the bulk endpoint once per "Salva workout" instead of one HTTP request per row (reduces N requests → 1)
- Added comprehensive integration tests: 11 test cases covering happy path (creates, updates, mixed batches) and guard conditions (auth, ownership, status, not-found scenarios)
- Performance improvement: eliminates per-row network round-trips and Prisma connection overhead

---

## 2026-04-26 — Fix `isSkeletonExercise` flag su esercizi aggiunti allo step dettagli

- **fix** `src/app/trainer/programs/[id]/edit/_content.tsx`: il payload di `POST /api/programs/[id]/workouts/[workoutId]/exercises` impostava `isSkeletonExercise: row.isDraft`, accoppiando erroneamente il flag scheletro al concetto "riga non ancora salvata". Conseguenza: gli esercizi aggiunti allo step 3 (dettagli) venivano salvati con `isSkeletonExercise: true`. Aggiunto campo dedicato `isSkeletonExercise` su `EditableWorkoutExerciseRow`: `applyStructureToAllWeeks` (step structure) crea draft con `true`, `addDraftRow` (step dettagli) con `false`, `buildEditableRow` propaga il valore esistente da DB.

---

## 2026-04-24 — API performance fixes: 3 additional bottlenecks eliminated

- **perf** `publish/route.ts`: sequential `week.update` for-loop replaced with `Promise.all` — eliminates N serial DB writes (was 12 writes sequential for a 12-week program)
- **perf** `admin/reports/global/route.ts`: removed dead `setPerformed.aggregate` query (result was unused); replaced `setPerformed.findMany` full table scan with single `$queryRaw SELECT SUM(reps * weight)` — eliminates full table scan
- **perf** `programs/route.ts`: merged two sequential `prisma` queries (`programsWithTestWeeks` + `completedFeedbacks`) into one `Promise.all` — removes one DB round-trip from every program list request
- **test** Added publish tests to `programs.test.ts` (6 cases); created `admin-reports.test.ts` with 5 cases

---

## 2026-04-24 — Trainer edit program: 5 UX/performance fixes

- **perf** DELETE exercise: batch order recalculation into single `$transaction` (was N sequential queries)
- **fix** Save workout: rows no longer disappear one-by-one; draft rows batch-removed after full save completes
- **fix** Copy week: target week draft rows cleared after copy so orphan rows no longer appear
- **feat** Max reps: exercises can now have an optional max rep value (stored as `min-max` e.g. `8-12`)
- **feat** Drag-and-drop: workout exercises now reorderable via drag handle using `@dnd-kit/core` + `@dnd-kit/sortable`
- **test** Added integration tests for copy-week API route and unit tests for reps parsing utilities

---

## 2026-04-24 — Test Suite Review & Consistency

- Added `.nvmrc` (Node 20) to unblock Vitest 4.x startup error on Node 18
- Added `react-i18next` global mock to `tests/unit/setup.ts`
- Fixed `DashboardLayout.test.tsx`: removed duplicate mocks, switched to static imports, corrected back-button assertions using `data-testid`; added `backHref` prop + `data-testid="back-nav-link"` to `DashboardLayout.tsx`
- Removed flaky sequential-pattern test from `password-utils.test.ts`
- Extracted shared session fixtures to `tests/integration/fixtures.ts`; updated 7 integration test files to import from it
- Added `DashboardLayout.tsx` to coverage tracking in `vitest.config.ts`
- Created project-scoped skill `zero-cento-testing` at `.claude/skills/zero-cento-testing/SKILL.md`

---

## [Unreleased] - 2026-04-23

### Fixed
- `/trainer/trainees`: inactive trainees now visible when filter set to "Disattivati". Fetch was missing `includeInactive=true`, so API stripped inactive users before client-side filter ran.

### Changed
- Service worker no longer caches HTML documents or API responses (both are now NetworkOnly).
- Immutable assets (`_next/static/`, fonts, app images) use CacheFirst with ExpirationPlugin.
- YouTube thumbnails use StaleWhileRevalidate with 7-day expiry and 100-entry limit.
- Removed `...defaultCache` (Workbox defaults were silently caching HTML navigation responses).
- `__SW_MANIFEST` precache filtered to exclude HTML pages; now includes only `_next/static/` and known static file extensions.
- Fixed: `/images/` cache matcher now anchored to same-origin to prevent cross-origin cache pollution.
- Added `maxEntries` limits to `next-static` (200) and `google-fonts-stylesheets` (5) caches.

### Added
- Structure step (wizard step 2) now pre-fills 4 empty exercise rows per workout for new programs, removing the need to click "Add row" 4 times manually.

---

## 2026-04-22 — Middleware: Fix rate limiting on public login route

- Fixed auth middleware ordering in `src/middleware.ts` so public routes like `'/login'`, `'/forgot-password'`, `'/reset-password'`, `'/force-change-password'`, and `'/onboarding/set-password'` bypass rate limiting before auth/security checks
- Resolved the production symptom where repeated anonymous visits could return raw HTTP `429` JSON with `RATE_LIMIT_EXCEEDED` instead of rendering the login page
- Added regression coverage in `tests/integration/rate-limit-read.test.ts` to verify repeated `GET /login` requests do not get throttled
- Verified focused middleware validation passes after the change: `npx vitest run tests/integration/rate-limit-read.test.ts`

---

## 2026-04-22 — PWA: Fix service worker registration on Vercel login

- Fixed PWA asset delivery on Vercel login flow by excluding `'/sw.js'`, `'/manifest.json'`, `'/robots.txt'`, and `'/sitemap.xml'` from auth middleware in `src/middleware.ts`
- Tightened the middleware matcher so public static assets and metadata files are no longer redirected through `/login`, preventing browser `SecurityError` during service worker registration
- Confirmed the pre-fix production symptom on Vercel: both `/sw.js` and `/manifest.json` were returning HTTP `307` instead of `200`
- Verified local build passes after the middleware change: `npm run build`

---

## 2026-04-22 — I5: i18n Error Key Migration Completed

- Migrated remaining page-level error handling in `src/app/trainee/dashboard/_content.tsx` to use `getApiErrorMessage(..., t('common:errors.loadingError'), t)` and explicitly surface failed `/api/programs` and `/progress` responses instead of silently ignoring them
- Migrated `src/app/admin/dashboard/_content.tsx` to shared `common:errors.loadingError` fallback with support for semantic `error.key` responses from APIs
- Migrated `src/app/profile/change-password/_content.tsx` so invalid session uses shared `errors:unauthorized` and generic fallback aligns to `common:errors.updateError`
- Updated `implementation-docs/pre-deployment-review.md` marking I5 as completed on 2026-04-22
- Verified focused lint on the touched components passes: `npm run lint -- src/app/trainee/dashboard/_content.tsx src/app/admin/dashboard/_content.tsx src/app/profile/change-password/_content.tsx`
- Checked `tests/integration/` for residual hardcoded UI error message assertions in this slice and found none

---

## 2026-04-22 — I1: Remove console.log / console.error from production code

- Removed 9 `console.log` from `src/app/onboarding/set-password/page.tsx` — some were logging sensitive session tokens and user metadata (security fix)
- Removed 3 `console.error` from `src/app/onboarding/set-password/page.tsx` — UI already surfaces errors via `setError()`
- Removed 5 `console.error` from `src/lib/date-format.ts` catch blocks — functions return safe fallback values; narrowed `catch (error)` to bare `catch`
- Removed `console.error` from `src/components/ExerciseCreateModal.tsx` catch block
- Removed `console.error` from `src/app/login/page.tsx` catch block (already marked "Ignore errors")
- Removed 4 `console.error` from `src/app/trainee/workouts/[id]/_content.tsx` localStorage/sync catch blocks; replaced with explanatory comments
- Replaced `console.error(error)` in `src/app/error.tsx` with `Sentry.captureException(error)` (Sentry B1 already configured)

---

## 2026-04-22 — B4: npm CVE Remediation

- Verified `eslint-config-next@16.2.4` resolves CWE-78 glob CLI injection (CVSS 7.5)
- Verified `@typescript-eslint/*@8.59.0` resolves minimatch ReDoS (CVSS 7.5, CWE-1333)
- `npm audit` reports 0 vulnerabilities
- Migrated `npm run lint` from deprecated `next lint` to `eslint src/` (ESLint CLI)
- Converted `next.config.js` → `next.config.mjs` (ESM) to fix `@serwist/next@9.5.7` incompatibility; fixed duplicate `module.exports` bug in original config
- Build verified passing; lint clean
- Known pre-existing issues (not introduced by B4): TS type errors in test files (Next.js 15 async params migration gap); Node 18.19 below required >=20 (unit tests must run in CI)

---

## Formato entry

```
### [DATA] — Titolo breve
**Task checklist:** #X.Y  
**File modificati:** `path/to/file.ts`, ...  
**Note:** Eventuali decisioni prese o problemi incontrati.
```

---

## Storico

### [20 Aprile 2026] — Fix tipo `contexts` in ErrorBoundary per Sentry v10 (Build Fix)

**Task checklist:** —  
**File modificati:** `src/components/ErrorBoundary.tsx`  
**Note:** Fix errore TypeScript a compile-time: `contexts` non è un campo valido in `ExceptionHint` su `@sentry/nextjs` v10. Refactoring da `captureException(..., { contexts: { react: ... } })` a `Sentry.withScope(scope => { scope.setContext('react', ...); Sentry.captureException(...) })`. Comportamento runtime identico (componentStack catturato), build `npm run build` torna a exit 0.

---

### [20 Aprile 2026] — Migrazione ESLint v8 → v9 + fix vulnerabilità (Dev Tooling)

**Task checklist:** —  
**File eliminati:** `.eslintrc.json`  
**File creati:** `eslint.config.mjs`  
**File modificati:** `package.json`, `package-lock.json`  
**Note:** Aggiornamento tooling ESLint da v8 (EOL) a v9.39.4. `eslint-config-next` aggiornato da 14.2.5 a 16.2.4 (risolve HIGH vuln CVSS 7.5 — glob command injection CWE-78). `@typescript-eslint/parser` e `@typescript-eslint/eslint-plugin` aggiornati da v7.x a v8.59.0 (risolve HIGH vuln CVSS 7.5 — minimatch ReDoS CWE-1333). Migrazione config da formato legacy `.eslintrc.json` a flat config ESLint v9 (`eslint.config.mjs`) usando l'export nativo flat di `eslint-config-next` v16 (no FlatCompat necessario). Nuove regole introdotte da eslint-config-next v16 (`react-hooks/set-state-in-effect`, `react-hooks/refs`, `react-hooks/purity`, `react-hooks/immutability`) disabilitate nel flat config per preservare comportamento lint precedente senza modificare sorgenti. `npm audit`: 0 vulnerabilità. `npx eslint . --max-warnings=0`: exit 0.

---

### [20 Aprile 2026] — Sentry.captureException in ErrorBoundary (Osservabilità — B1 completato)

**Task checklist:** B1 pendente (pre-deployment-review.md)  
**File modificati:** `src/components/ErrorBoundary.tsx`  
**File creati:** `tests/unit/components/ErrorBoundary.test.tsx`  
**Note:** Wired `Sentry.captureException` in `componentDidCatch`, passando `errorInfo.componentStack` come context React (con guard `?? undefined`) e `mechanism: { type: 'generic', handled: false }` per classificare gli errori come non gestiti in Sentry. Sostituisce il TODO placeholder e il `console.error` con una vera chiamata Sentry. Aggiunti 2 unit test (Vitest + RTL): verifica che `captureException` venga chiamato con l'errore corretto e il `componentStack`, e che non venga chiamato quando nessun figlio lancia errori. B1 completamente risolto.

---

### [20 Aprile 2026] — Integrazione Sentry (Osservabilità — Blocker B1)

**Task checklist:** #6.6 (next-actions.md), Blocker B1 (pre-deployment-review.md)  
**File creati:** `src/instrumentation.ts`, `src/instrumentation-client.ts`  
**File modificati:** `sentry.server.config.ts`, `sentry.edge.config.ts`, `.env`  
**Note:** Integrazione manuale completa di Sentry su tutti e tre i runtime Next.js. `src/instrumentation.ts` registra il server config (Node.js runtime) e l'edge config (Edge runtime) tramite `register()`, ed esporta `onRequestError = Sentry.captureRequestError` per catturare errori server-side automaticamente. `src/instrumentation-client.ts` inizializza Sentry lato browser con `Sentry.init()` e `tracesSampleRate: 1` (dev), ed esporta `onRouterTransitionStart = Sentry.captureRouterTransitionStart`. `sentry.server.config.ts` e `sentry.edge.config.ts` aggiornati: DSN da `NEXT_PUBLIC_SENTRY_DSN`, environment da `NEXT_PUBLIC_APP_ENV`, sample rate da `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (default `0.1`), `enableLogs: true`, `sendDefaultPii: false`, `beforeSend` con rimozione cookie per privacy. `next.config.js` aveva già `withSentryConfig` e source maps upload. Aggiunta env var `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1` in `.env`. **Pendente:** wire `Sentry.captureException` in `src/components/ErrorBoundary.tsx` (TODO riga 92) da fare come miglioramento post-deploy.

---

### [31 Marzo 2026] — DashboardLayout su Pagina Dettaglio Atleta con i18n (Sprint 9.16)

**Task checklist:** #9.16  
**File modificati:** `src/app/trainer/trainees/[id]/page.tsx`, `src/app/trainer/trainees/[id]/_content.tsx` (creato)  
**File i18n aggiornati:** `public/locales/it/trainer.json`, `public/locales/en/trainer.json`  
**Note:** Aggiunto `DashboardLayout` alla pagina di dettaglio atleta (`trainer/trainees/[id]`). Implementato pattern split client/server: `page.tsx` convertito in server component con `getSession()`, role guard per 'trainer', e wrapper `<DashboardLayout>`. Tutta la logica UI spostata in `_content.tsx` (client component) con integrazione completa i18n usando `useTranslation()`. **Token i18n aggiunti:** `athletes.totalPrograms`, `athletes.activePrograms`, `athletes.recordsRegistered`, `athletes.programsTab`, `athletes.recordsTab`, `athletes.noProgramsAssigned`, `athletes.createNewProgram`, `athletes.manageRecords`, `athletes.viewProgram`, `athletes.estimated1RM`, `programs.startDate`, `programs.durationWeeks`, `personalRecords.exercise`, `personalRecords.date`, `personalRecords.addRecordButton`. Tutte le stringhe hardcoded italiane ora usano token i18n riutilizzabili. Pagina ora mostra header globale con logo, menu hamburger, e navigazione consistente.

---

### [31 Marzo 2026] — DashboardLayout su Pagina Progress Programma (Sprint 9.10)

**Task checklist:** #9.10  
**File modificati:** `src/app/trainer/programs/[id]/progress/page.tsx`, `src/app/trainer/programs/[id]/progress/_content.tsx`  
**Note:** Aggiunto `DashboardLayout` alla pagina di monitoraggio avanzamento programma. Split del client component originale in `_content.tsx` (logica client) e `page.tsx` (server component con getSession() + DashboardLayout wrapper). Role guard per 'trainer' implementato. La pagina ora mostra header globale con logo, menu hamburger, e navigazione consistente con il resto dell'applicazione.

---

### [30 Marzo 2026] — E2E Test Trainer Pubblica Programma e Trainee lo Visualizza (Sprint 5.8)

**Task checklist:** #5.8  
**File creato:** `tests/e2e/trainer-publish-program-trainee-view.spec.ts`  
**Note:** Implementato E2E test completo che verifica l'intero flusso di pubblicazione programma e visualizzazione lato trainee (TEST-E2E-002). **Test implementati (3 test in 2 suite):** **(1) Trainer publishes program → Trainee views (3 test)** - Flow completo: trainer login → crea programma (con titolo univoco timestamp, trainee1, 4 settimane, 3 workout/week) → aggiunge esercizio al primo workout → pubblica con startDate → logout → trainee login → verifica presenza programma in dashboard o `/trainee/programs/current` → accesso ai dettagli workout, verifica metadati programma (status active, durata 4 settimane, 3 workout/week), verifica trainees NON vedono programmi in draft. **(2) Error handling (1 test)** - verifica che tentativo di pubblicazione senza esercizi fallisca (validation error o publish button disabilitato). **Design:** usa helper functions `loginUser()` e `logout()` per riuso codice, `test.step()` per strutturare le fasi (Login → Create → Add Exercises → Publish → Logout → Trainee Login → Verify), cattura `programId` da URL dopo creazione per navigazioni successive, timeout generosi (10s redirect, 5s elementi) per evitare flakiness. **Credenziali:** `trainer1@zerocento.app` / `TestPass123!` e `trainee1@zerocento.app` / `TestPass123!` (matching login-redirect test). **Assunzioni UI:** selettori flessibili con multiple alternative (`text=` regex, data-testid, name attribute) per garantire compatibilità anche se UI cambia leggermente. Test pronto per esecuzione con `npm run test:e2e`.

---

### [30 Marzo 2026] — E2E Test Login con Redirect per Ruolo (Sprint 5.7)

**Task checklist:** #5.7  
**File creato:** `tests/e2e/login-redirect-by-role.spec.ts`  
**Note:** Implementata suite completa di E2E test per il flusso di login con verifica dei redirect basati sul ruolo utente. **Test implementati (9 test in 2 suite):** **(1) Login: Role-based redirects (8 test)** - Admin login → `/admin/dashboard` (con verifica presenza contenuto H1/H2), Trainer login → `/trainer/dashboard`, Trainee login → `/trainee/dashboard`, error message per credenziali invalide (verifica presenza `.bg-red-50` o `role=alert`), error per campi vuoti (HTML5 validation), auto-redirect per utente già loggato (test sessione persistente: login → redirect dashboard → torna a /login → auto-redirect dashboard), disabilitazione form durante submit (verifica `disabled` attribute su button/input), preservation email input dopo login fallito. **(2) Login: Navigation links (1 test)** - verifica presenza link "forgot password" (se presente nel layout). **Credenziali test usate:** `admin@zerocento.it`, `trainer@zerocento.it`, `trainee1@zerocento.it` tutti con password `TestPass123!` (matching dei test esistenti trainer-create-program.spec.ts e trainee-complete-workout.spec.ts). **Configurazione:** timeout 10s per redirect, clearCookies() in beforeEach per garantire stato pulito. **Design:** segue pattern esistente dei test E2E (TEST-E2E-003), con commento header che elenca prerequisites e coverage. Test pronti per esecuzione con `npm run test:e2e`.

---

### [30 Marzo 2026] — Integration Test Feedback CRUD Completo (Sprint 5.4)

**Task checklist:** #5.4  
**File creato:** `tests/integration/feedback.test.ts`  
**Note:** Implementata suite completa di 38 integration test per il CRUD del feedback allenamento, copertura totale degli endpoint `GET /api/feedback`, `POST /api/feedback`, `GET /api/feedback/[id]`, `PUT /api/feedback/[id]`. **Test per GET lista (8 test):** RBAC trainee vede solo il proprio feedback (filtro `traineeId`), RBAC trainer vede solo feedback dei propri trainee (filtro `trainerId`), admin senza filtri, filtri query param `traineeId`/`exerciseId`, cursor pagination, `hasMore=true` quando (limit+1) item restituiti, 401 non autenticato. **Test per POST creazione (15 test):** creazione 201 con metriche calcolate (`totalVolume = 3 sets * 5 reps * 100kg = 1500`, `avgRPE`), idempotenza — aggiornamento 200 se feedback esiste per stesso giorno (delete+recreate sets), creazione senza note/RPE, `totalVolume=0` con peso zero, 403 cross-trainee (trainee B prova a creare feedback per workout di trainee A), 404 workoutExercise non trovato, tutte le validazioni Zod (empty sets, UUID invalido, RPE < 5.0, RPE non multiplo di 0.5, reps > 50, peso > 500, note > 1000 char), 401, 403 accesso trainer. **Test per GET singolo (7 test):** accesso trainee owner, trainer responsabile, admin, 403 cross-trainee, 403 cross-trainer, 404, 401. **Test per PUT aggiornamento (8 test):** aggiornamento entro 24h (200), 403 dopo 24h con messaggio contenente "24", 403 modifica feedback altrui, 404 non trovato, 400 validazione (empty sets), 401, 403 trainer, verifica delete-then-create dei set. **Fix durante sviluppo:** tutti gli ID nelle fixture sono UUID validi (formato `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`) perché Zod `feedbackSchema` usa `.uuid()` — IDs non-UUID causavano 400 prima di raggiungere la business logic. Rimossa dipendenza da `toHaveBeenCalledBefore` (jest-extended, non disponibile in vitest) sostituita con verifica esplicita di entrambi i mock. **Risultato:** 38/38 test passati (100% success rate).

---

### [30 Marzo 2026] — Integration Test Esercizi con Relazioni (Sprint 5.6)

**Task checklist:** #5.6  
**File creato:** `tests/integration/exercises.test.ts`  
**Note:** Implementata suite completa di integration test per tutti gli endpoint CRUD degli esercizi, con verifica delle relazioni nested (movementPattern, exerciseMuscleGroups, creator). **Test implementati (34 test totali, 5 suite):** **(1) GET /api/exercises (11 test)** - lista con relazioni nested (movementPattern + exerciseMuscleGroups), paginazione cursor (hasMore/nextCursor), filtro per type/movementPatternId/muscleGroupId (nested `some` query), ricerca case-insensitive su name e description, validazione lunghezza search (400 se < 2 o > 100 char), accesso trainee consentito (READ), 401 non autenticato. **(2) GET /api/exercises/[id] (3 test)** - dettaglio con tutte le relazioni (movementPattern, exerciseMuscleGroups con coefficienti, creator, notes array), 404 per ID inesistente, accesso trainee consentito. **(3) POST /api/exercises (9 test)** - creazione con nested `exerciseMuscleGroups` (verifica schema Prisma `create` con array), 409 nome duplicato, 404 movementPattern inesistente, 404 muscleGroup mancante (partial find), 400 totale coefficients > 3.0, 400 URL non YouTube, 400 nome < 3 char, 400 muscleGroups array vuoto, 403 per trainee. **(4) PUT /api/exercises/[id] (5 test)** - update con pattern `deleteMany: {} + create` (sostituzione atomica muscleGroups), 403 ownership trainer (altro trainer creatore), admin bypass ownership, 409 conflitto nome, 404 esercizio inesistente. **(5) DELETE /api/exercises/[id] (6 test)** - eliminazione OK quando non usato in programmi attivi, 409 quando usato in programma attivo (check nested workout→week→program), OK quando usato solo in programmi completed/draft, 403 ownership, 404, admin bypass. **Setup tecnico:** tutti gli ID usano UUID validi (costanti `MP_ID`, `MG_ID_1`, `MG_ID_2`, `EX_ID_1`, `EX_ID_2`) per passare la validazione Zod `z.string().uuid()` nei filtri e nei payload. Prisma mockato: `exercise`, `movementPattern`, `muscleGroup`, `workoutExercise`. **Risultato:** 34/34 test passati (100% success rate).

---

### [30 Marzo 2026] — Integration Test Personal Records CRUD (Sprint 5.5)

**Task checklist:** #5.5  
**File creato:** `tests/integration/personal-records.test.ts`  
**Note:** Implementata suite completa di integration test per gli endpoint CRUD dei personal records (massimali), con verifica RBAC ownership trainer-trainee. **Test implementati:** GET lista con filtro `traineeId`, verifica ownership check (trainer può accedere solo ai trainee assegnati), POST creazione con validazione schema (peso ≤ 1000, reps intero ≤ 100, date non future), GET dettaglio singolo record, PATCH aggiornamento parziale, DELETE eliminazione, 403 per accesso cross-trainer, 404 per record inesistente, 401 per richieste non autenticate. **Risultato:** tutti i test passati.

---

### [30 Marzo 2026] — Integration Test RBAC Violations per Accessi Cross-Trainer (Sprint 5.3)

**Task checklist:** #5.3  
**File creato:** `tests/integration/rbac.test.ts`  
**Note:** Implementata suite completa di integration test per verificare che il sistema di controllo accessi basato sui ruoli (RBAC) prevenga correttamente gli accessi cross-trainer. **Test implementati (17 test totali, 4 gruppi):** **(1) RBAC Violations - Personal Records (4 test)** - trainer A non può accedere ai massimali di trainee B (403 FORBIDDEN), trainer B non può accedere ai massimali di trainee A (403 FORBIDDEN), trainer A può accedere ai massimali del proprio trainee A (200 OK), admin può accedere a qualsiasi massimale (200 OK). Verifica endpoint: `GET /api/personal-records?traineeId=X`. **(2) RBAC Violations - Training Programs (6 test)** - trainer A non può visualizzare programmi di trainer B (403 FORBIDDEN), trainee A non può visualizzare programmi di trainee B (403 FORBIDDEN), trainer A non può modificare programmi di trainer B (403 FORBIDDEN), trainer A può accedere ai propri programmi (200 OK), trainee A può accedere ai propri programmi (200 OK), admin può accedere a qualsiasi programma (200 OK). Verifica endpoint: `GET /api/programs/[id]`, `PUT /api/programs/[id]`. **(3) RBAC Violations - Feedback (2 test)** - trainer A non vede feedback di trainee B (200 OK con array vuoto, filtrato da RBAC), trainer A può accedere ai feedback del proprio trainee (200 OK). Verifica endpoint: `GET /api/feedback?traineeId=X`. **(4) RBAC Violations - Users (5 test)** - trainer A non può accedere ai dettagli di trainee B (403 FORBIDDEN), trainer A non può modificare trainee B (403 FORBIDDEN), trainer A non può disattivare trainee B (403 FORBIDDEN), trainer A può accedere ai dettagli del proprio trainee (200 OK), admin può accedere a qualsiasi utente (200 OK). Verifica endpoint: `GET /api/users/[id]`, `PUT /api/users/[id]`, `PATCH /api/users/[id]/deactivate`. **Copertura completa RBAC:** (1) **Cross-trainer isolation** - trainer del trainee A non può accedere a dati di trainee assegnato a trainer B, simmetrico: trainer del trainee B non può accedere a dati di trainee A, (2) **Cross-trainee isolation** - trainee A non può accedere a dati di trainee B, fondamentale per privacy tra atleti, (3) **Ownership verification** - trainer può accedere SOLO ai dati dei propri trainee assegnati (verifica tramite tabella `TrainerTrainee`), trainee può accedere SOLO ai propri dati, (4) **Admin bypass** - admin ha accesso globale a tutti i dati (nessun filtro applicato), critico per operazioni di supporto e troubleshooting. **Setup test sofisticato:** (1) **Mock sessions** - 5 mock session per test: trainer A, trainer B, trainee A, trainee B, admin, ogni session con id, email, firstName, lastName, role, isActive. (2) **Mock Prisma** - 6 moduli mockati: `personalRecord`, `trainerTrainee`, `trainingProgram`, `exerciseFeedback`, `user`, con funzioni: `findMany`, `findUnique`, `findFirst`, `update`. (3) **Helper function** - `makeRequest(url, options)` per creare NextRequest con gestione sicura del signal (evita errori TypeScript). **Fix implementati durante test:** (1) **Personal Records mock** - aggiunto mock `findMany` per `TrainerTrainee` (chiamato all'inizio per costruire where clause), il solo mock `findUnique` non era sufficiente, fix permette di testare entrambi i path: initial query + additional filter. (2) **Feedback response format** - corretto da `body.data.feedback` a `body.data.items`, allineato con Sprint 7.6 standard API format. (3) **Mock chain sequencing** - assicurato che ogni test pulisce i mock prima di eseguire (`vi.clearAllMocks()` in `beforeEach`), evita interferenze tra test. **Coverage endpoints critici:** (1) **Personal Records** - `GET /api/personal-records` con query param `traineeId`, verifica fix Sprint 1.1 funziona correttamente (RBAC bypass era un issue critico). (2) **Programs** - `GET /api/programs/[id]` (lettura), `PUT /api/programs/[id]` (modifica), entrambi verificano ownership tramite `trainerId` e `traineeId`. (3) **Feedback** - `GET /api/feedback`, verifica RBAC filtering funziona (trainer vede solo feedback dei propri trainee). (4) **Users** - `GET /api/users/[id]` (lettura), `PUT /api/users/[id]` (modifica), `PATCH /api/users/[id]/deactivate` (disattivazione), tutti verificano ownership via `TrainerTrainee` junction table. **Risultato:** 17/17 test passati (100% success rate). **Tempo esecuzione:** 7.25s totali (48ms test puri + 7.2s setup). **Sicurezza verificata:** i test confermano che: (1) Cross-trainer access è completamente bloccato, (2) Fix Sprint 1.1 per Personal Records funziona, (3) Ownership check è applicato su TUTTI gli endpoint critici, (4) Admin override funziona correttamente senza bypassare validazioni essenziali. **Preparazione Sprint 5:** task 5.3 completato (4h effort). Prossimi task Sprint 5: 5.4 (Integration test feedback CRUD), 5.5 (Integration test personal records CRUD), 5.6 (Integration test esercizi con relazioni), 5.7-5.9 (E2E tests), 5.10 (Coverage 80%).

---

### [30 Marzo 2026] — Unit Test Generazione Password Sicura (Sprint 5.2)

**Task checklist:** #5.2  
**File creato:** `tests/unit/password-utils.test.ts`  
**Note:** Implementata suite completa di unit test per la funzione `generateSecurePassword()` dal modulo `@/lib/password-utils`. **Test implementati (21 test totali):** **(1) Length Validation (4 test)** - password con lunghezza default 12 caratteri, custom length (16), lunghezza minima (8), lunghezza large (32). **(2) Character Variety Requirements (5 test)** - contiene almeno 1 uppercase letter (A-Z), almeno 1 lowercase letter (a-z), almeno 1 numero (0-9), almeno 1 simbolo (!@#$%^&*), verifica tutti i 4 tipi di caratteri presenti. **(3) Character Set Compliance (3 test)** - solo caratteri consentiti (regex `[A-Za-z0-9!@#$%^&*]`), nessuno spazio, nessun carattere ambiguo. **(4) Randomness and Unpredictability (4 test)** - **chiamate consecutive** generano password diverse, **batch test** 100 password tutte uniche (Set size = 100), **no predictable patterns** (no "abc", "123", caratteri ripetuti 4+ volte), **distribution test** 50 iterazioni confermano ogni categoria ha almeno 1 char per password. **(5) Edge Cases (2 test)** - **minimum viable length** 4 caratteri (1 per ogni categoria richiesta), **consistency test** 100 call consecutive verificano sempre le 4 categorie presenti. **(6) Security Properties (3 test)** - **sufficient entropy** per 12-char password (70^12 ≈ 73.7 bits), **resistant to dictionary attacks** (no "password", "admin", "user", "test", "qwerty", "12345678"), **OWASP compliance** per temporary passwords (min 12 char, mixed types, random). **Risultato:** 21/21 test passati (100% success rate), copertura completa della funzione `generateSecurePassword()`. **Validazione sicurezza:** i test confermano che le password generate soddisfano i requisiti OWASP per password temporanee (usate quando trainer/admin crea trainee account), con entropia sufficiente (>70 bit) e resistenza agli attacchi dizionario. **Tempo esecuzione:** 4.95s totali (42ms test puri + 4.9s setup Vitest/Vite).

---

### [30 Marzo 2026] — Unit Test Completi per calculateEffectiveWeight con Chain Percentage_Previous (Sprint 5.1)

**Task checklist:** #5.1  
**File modificati:** `tests/unit/calculations.test.ts`  
**Note:** Implementata suite completa di unit test per la funzione `calculateEffectiveWeight()` con focus su chain percentage_previous. **Test implementati (18 test totali, 36 test totali nel file):** **(1) Absolute weight type (2 test)** - test peso diretto e gestione peso zero. **(2) Percentage_1rm weight type (2 test)** - calcolo peso basato su personal record 1RM, gestione record mancante (return null). **(3) Percentage_rm weight type (4 test)** - calcolo peso basato su nRM personal record, gestione reps range "8-10", gestione record mancante, gestione formato reps invalido (AMRAP). **(4) Percentage_previous weight type (7 test)** - **chain semplice**: absolute → percentage_previous (+10%), **chain 2 livelli**: absolute → percentage_previous (+10%) → percentage_previous (+5%) = 115.5kg, **chain 3 livelli**: absolute → percentage_previous (+10%) → percentage_previous (+5%) → percentage_previous (+3%) = 118.965kg, **negative percentage** per drop set (-10%), **null propagation** quando base weight è null (missing personal record), **error handling** quando no previous occurrence found, **recursion limit** quando depth > 10 (throws error). **(5) Mixed weight type chains (3 test)** - **percentage_1rm → percentage_previous**: 150kg 1RM * 80% = 120kg → +10% = 132kg, **percentage_rm → percentage_previous**: 100kg 8RM * 90% = 90kg → -10% = 81kg, **absolute → percentage_previous → percentage_previous**: verifica chain complesso. **Copertura completa della logica:** (1) Tutti i 4 weightType testati (absolute, percentage_1rm, percentage_rm, percentage_previous), (2) Chain ricorsivi fino a 3 livelli di profondità, (3) Edge cases: missing records, invalid reps, no previous occurrence, recursion limit, (4) Floating point precision gestito con `toBeCloseTo()` per calcoli decimali, (5) Mock Prisma: `workoutExercise.findFirst` per previous occurrence, `personalRecord.findFirst` per 1RM/nRM records. **Risultato:** 36/36 test passati (100% success rate), copertura completa della funzione `calculateEffectiveWeight()` e delle sue dipendenze ricorsive. **Preparazione per Sprint 5 completo:** questa implementazione copre il task critico 5.1, foundation per i test integration successivi (5.3-5.6) che verificheranno RBAC, feedback CRUD, personal records CRUD, e esercizi con relazioni.

---

### [30 Marzo 2026] — Standardizzato Formato Risposte API con Struttura Uniforme (Sprint 7.6)

**Task checklist:** #7.6  
**File modificati:** 7 API endpoints, 19 componenti frontend  
**File API:** `src/app/api/exercises/route.ts`, `src/app/api/programs/route.ts`, `src/app/api/feedback/route.ts`, `src/app/api/users/route.ts`, `src/app/api/personal-records/route.ts`, `src/app/api/movement-patterns/route.ts`, `src/app/api/muscle-groups/route.ts`  
**File Frontend:** `src/app/admin/users/AdminUsersContent.tsx`, `src/app/admin/programs/AdminProgramsContent.tsx`, `src/app/admin/dashboard/AdminDashboardContent.tsx`, `src/components/UsersTable.tsx`, `src/components/ProgramsTable.tsx`, `src/components/ExercisesTable.tsx`, `src/components/ExerciseCreateModal.tsx`, `src/app/trainer/trainees/page.tsx`, `src/app/trainer/trainees/[id]/records/page.tsx`, `src/app/trainer/programs/page.tsx`, `src/app/trainer/programs/new/NewProgramContent.tsx`, `src/app/trainer/programs/[id]/edit/EditProgramMetadata.tsx`, `src/app/trainer/programs/[id]/workouts/[wId]/page.tsx`, `src/app/trainer/exercises/page.tsx`, `src/app/trainer/exercises/new/page.tsx`, `src/app/trainer/exercises/[id]/edit/page.tsx`, `src/app/trainee/dashboard/page.tsx`, `src/app/trainee/programs/current/page.tsx`, `src/app/trainee/history/page.tsx`, `src/app/trainee/records/page.tsx`  
**Note:** Completata standardizzazione completa del formato delle risposte API su tutti gli endpoint GET di tipo lista, implementando una struttura uniforme `{ items, pagination? }` che migliora consistenza, manutenibilità e preparazione per future feature di paginazione. Prima del task, ogni endpoint usava una chiave diversa per le risposte: `{ exercises }`, `{ programs }`, `{ users }`, `{ records }`, `{ feedbacks }`, `{ movementPatterns }`, `{ muscleGroups }`, rendendo il codice frontend inconsistente e difficile da mantenere. Implementazioni: **(1) Aggiornamento API Endpoints** - **Endpoints con paginazione** (3): exercises, programs, feedback - cambiato formato da `{ exercises, nextCursor, hasMore }` a `{ items, pagination: { nextCursor, hasMore } }`, wrappato informazioni di paginazione in oggetto dedicato per estensibilità futura (facile aggiungere `total`, `pageSize`, etc.); **Endpoints senza paginazione** (4): users, personal-records, movement-patterns, muscle-groups - cambiato formato da `{ users }`, `{ records }`, `{ movementPatterns }`, `{ muscleGroups }` a `{ items }` uniforme, preparato per futura aggiunta paginazione con minime modifiche. **(2) Aggiornamento Frontend Components** - **19 componenti frontend aggiornati** per usare nuovo formato, cambiate 35+ istanze di `data.data.exercises`, `data.data.programs`, `data.data.users`, etc. a `data.data.items` uniforme, **3 componenti** aggiornati per paginazione: accesso a `data.data.pagination.nextCursor` e `data.data.pagination.hasMore` invece di accesso diretto a livello root (anche se attualmente non utilizzati nel frontend). **(3) Componenti Admin** - AdminUsersContent: `data.data.users` → `data.data.items`, AdminProgramsContent: `data.data.programs` → `data.data.items`, AdminDashboardContent: 3 cambiamenti per users, programs, exercises. **(4) Componenti Trainer** - trainees/page: `data.data.users` → `data.data.items`, trainees/[id]/records: 2 cambiamenti per records e exercises, programs/page: `data.data.programs` → `data.data.items`, programs/new: `data.data.users` → `data.data.items`, programs/[id]/edit: `data.data.users` → `data.data.items`, programs/[id]/workouts/[wId]: 3 cambiamenti per exercises, exercises/page: `data.data.exercises` → `data.data.items`, exercises/new: 4 cambiamenti per muscleGroups e movementPatterns, exercises/[id]/edit: 2 cambiamenti per muscleGroups e movementPatterns. **(5) Componenti Trainee** - dashboard: 2 cambiamenti per programs e personalRecords, programs/current: 2 cambiamenti per programs, history: `data.data.programs` → `data.data.items`, records: `data.data.personalRecords` → `data.data.items`. **(6) Componenti Shared** - UsersTable: `data.data.users` → `data.data.items`, ProgramsTable: `data.data.programs` → `data.data.items`, ExercisesTable: `data.data.exercises` → `data.data.items`, ExerciseCreateModal: 2 cambiamenti per muscleGroups e movementPatterns. **(7) Zero Errori di Compilazione** - tutti i file compilano perfettamente dopo le modifiche, nessuna regressione TypeScript, verificato con `get_errors()` - nessun errore trovato. **Benefici dell'implementazione:** (1) **Consistenza** - tutti gli endpoint ora seguono lo stesso pattern rendendo il codice più prevedibile, riduzione cognitive load per sviluppatori, meno errori durante sviluppo di nuove feature; (2) **Manutenibilità** - cambio formato API richiede modifica in un solo posto invece di N componenti, tipo TypeScript `ApiListResponse<T>` può essere riusato per tutti gli endpoint; (3) **Estensibilità futura** - facile aggiungere metadata aggiuntive nella sezione pagination (total items, page size, page number), preparato per implementazione paginazione offset-based accanto a cursor-based, possibilità di aggiungere filtering/sorting metadata; (4) **Allineamento con Standard API** - formato allineato con best practice REST API (JSON:API, GraphQL conventions), struttura familiare per sviluppatori esterni al progetto; (5) **Type Safety** - TypeScript può inferire correttamente il tipo di `data.data.items` genericamente, paginazione separata migliora type narrowing (presence of pagination object = paginated endpoint). **Formato finale implementato:** Endpoint con paginazione: `{ data: { items: T[], pagination: { nextCursor: string | null, hasMore: boolean } }, meta: { timestamp: string } }`, Endpoint senza paginazione: `{ data: { items: T[] }, meta: { timestamp: string } }`. **Sprint 7 completato al 100% (23h/23h)** - tutti i task i18n e UX Polish sono stati implementati con successo. Prossimi sprint: Sprint 5 (Testing 80%), Sprint 6 (CI/CD), Sprint 8 (PWA & Final Polish).

---

### [30 Marzo 2026] — Implementato ARIA Labels e Focus Management su Modali (Sprint 7.5)

**Task checklist:** #7.5  
**File modificati:** `src/components/ConfirmationModal.tsx`, `src/components/ExerciseCreateModal.tsx`, `src/components/UserCreateModal.tsx`, `src/components/UserEditModal.tsx`, `src/components/UserDeleteModal.tsx`  
**Note:** Completata implementazione di ARIA labels e focus management su tutti i 5 componenti modali dell'applicazione per migliorare l'accessibilità e l'esperienza utente con keyboard navigation e screen reader. Implementazioni: (1) **ARIA Attributes completi** - aggiunto `role="dialog"` su tutti i dialoghi (o `role="alertdialog"` per UserDeleteModal poiché è un'azione distruttiva), `aria-modal="true"` per indicare che il contenuto sotto è inerte, `aria-labelledby` collegato all'ID univoco del titolo del modale, `aria-describedby` collegato all'ID del contenuto descrittivo (dove applicabile), `role="presentation"` sul backdrop per indicare che è puramente decorativo, `aria-hidden="true"` sulle icone decorative, `aria-label` descrittivi sui pulsanti primari per fornire contesto aggiuntivo (es. "Elimina Mario Rossi"); (2) **Focus Management Automatico** - auto-focus sul primo elemento interattivo rilevante all'apertura del modale: pulsante di conferma per ConfirmationModal e UserDeleteModal (enfasi sull'azione), primo campo input per form modal (ExerciseCreateModal, UserCreateModal, UserEditModal in stato form), pulsante "Chiudi" per stato success di UserCreateModal, utilizzo di `useRef` con `setTimeout(100ms)` per garantire rendering completo prima del focus; (3) **Focus Trap Implementato** - focus circolare all'interno del modale usando Tab/Shift+Tab, selezione dinamica di tutti gli elementi focusabili (`button:not([disabled])`, `input:not([disabled])`, `select`, `textarea`, `[href]`, `[tabindex]:not([tabindex="-1"])`), wrap automatico: Tab sull'ultimo elemento → primo elemento, Shift+Tab sul primo elemento → ultimo elemento, previene focus su elementi del layer sottostante; (4) **Gestione tasto ESC** - tutti i modali supportano chiusura con tasto Escape, disabilitato durante stati di loading per prevenire chiusure accidentali durante submit, event listener su `keydown` aggiunto in `useEffect`; (5) **Restore Focus All'uscita** - salvataggio elemento attivo prima dell'apertura del modale (`document.activeElement`), ripristino focus automatico all'elemento trigger quando il modale viene chiuso, gestito nel cleanup di `useEffect` per garantire esecuzione anche su unmount; (6) **ID Univoci Generati** - utilizzo di `useRef` con `Math.random().toString(36)` per generare ID univoci per titolo e descrizione, garantisce che multipli modali possano coesistere senza collisioni ID, ID persistono per tutta la vita del componente (non si rigenerano ad ogni render); (7) **Gestione Stati Multipli** - UserCreateModal gestisce correttamente focus tra stato form e stato success (password temporanea), UserEditModal gestisce focus tra stato form e stato success (conferma aggiornamento), focus appropriato in base allo stato corrente; (8) **Dipendenze useEffect Corrette** - dipendenze complete per ogni useEffect: `[isOpen, onClose]` per ConfirmationModal, `[loading, onClose]` per ExerciseCreateModal/UserEditModal/UserDeleteModal, `[loading, onClose, onUserCreated, tempPassword]` per UserCreateModal con gestione stati multipli, previene stale closures e comportamenti inconsistenti; (9) **Compatibilità Screen Reader** - struttura semantica con heading `<h2>` per titoli modali collegati via `aria-labelledby`, contenuto descrittivo collegato via `aria-describedby`, messaggi di errore con `role="alert"` per annuncio automatico, icone decorative marcate `aria-hidden="true"` per evitare rumore; (10) **Best Practice WCAG 2.1** - supporto completo per navigazione da tastiera (Livello A), focus visibile su tutti gli elementi interattivi, contrasto colori adeguato già presente, struttura semantica HTML corretta. Benefici accessibilità: (1) **Utenti Screen Reader** - contesto completo del modale annunciato immediatamente, navigazione chiara tra elementi del dialogo; (2) **Utenti Keyboard-Only** - navigazione completa senza mouse, focus trap previene confusione, ESC per chiusura rapida; (3) **Utenti con Disabilità Cognitive** - auto-focus guida l'attenzione, focus trap riduce disorientamento; (4) **Conformità Standard** - WCAG 2.1 Level AA, WAI-ARIA Authoring Practices per dialog. Sprint 7 avanzamento: 7.1–7.5 completati (21h/23h = 91%).

---

### [30 Marzo 2026] — Completato Skeleton Loaders per UX Migliorata (Sprint 7.4)

**Task checklist:** #7.4  
**File modificati:** `src/components/Skeleton.tsx` (creato), `src/components/index.ts`, `src/app/loading.tsx`, tutti i file pagina con stati di caricamento  
**Note:** Sostituiti tutti gli spinner LoadingSpinner con skeleton loader appropriati per migliorare la percezione della velocità di caricamento e fornire un'anteprima visuale della struttura del contenuto. Implementazioni: (1) **Nuovo componente Skeleton.tsx** - componente base con 4 varianti (text, rectangular, circular, rounded) e 2 animazioni (pulse, wave), 9 componenti specializzati per diversi use cases: SkeletonText (singola/multipla linea di testo con gap e lastLineWidth configurabili), SkeletonCard (per StatCard, NavigationCard con avatar/icona + titolo + sottotitolo), SkeletonTable (tabella completa con header e N righe/colonne), SkeletonList (lista verticale con opzione avatar), SkeletonDashboard (composizione header + grid card + tabella opzionale), SkeletonForm (campi form multipli + pulsanti footer), SkeletonNavigation (grid di card navigazione), SkeletonDetail (pagina dettaglio con header avatar + sezioni info); (2) **Sostituiti 25+ LoadingSpinner size="lg"** nelle pagine - MantenutoLoadingSpinner size="sm" nei pulsanti submit (è appropriato); (3) **Pagine dashboard aggiornate** - trainee/dashboard: SkeletonDashboard con 3 card, admin/dashboard: SkeletonDashboard con 6 card, trainer/programs/progress: SkeletonDashboard con 3 card + tabella; (4) **Pagine lista/tabella aggiornate** - trainee/history: SkeletonList con 5 items, trainee/records: SkeletonTable 8 righe × 4 colonne, trainee/programs/current: SkeletonDashboard personalizzata, trainer/trainees: SkeletonTable 6 righe × 4 colonne, trainer/programs: SkeletonTable 6 righe × 5 colonne, trainer/exercises: SkeletonTable 8 righe × 5 colonne; (5) **Pagine dettaglio aggiornate** - trainer/trainees/[id]: SkeletonDetail (profilo con avatar + info), trainer/trainees/[id]/records: SkeletonTable 10 righe × 5 colonne, trainee/workouts/[id]: SkeletonDetail (workout card-based); (6) **App loading.tsx aggiornata** - sostituito spinner generico con SkeletonDashboard come fallback di React Suspense; (7) **Export completo da index.ts** - tutti i 9 componenti skeleton esportati insieme a Skeleton base per uso modulare; (8) **Accessibilità** - tutti gli skeleton hanno `aria-busy="true"` e `aria-live="polite"` per screen reader; (9) **Responsive** - skeleton si adattano con classi Tailwind grid responsive (1 col mobile → 2 tablet → 3/4 desktop); (10) **Animazione Tailwind animate-pulse** - utilizzata animazione nativa Tailwind per compatibilità universale senza dipendenze aggiuntive. Benefici UX: (1) **Percezione velocità migliorata** - gli skeleton loader danno l'impressione che la pagina carichi più velocemente mostrando la struttura del contenuto invece di un semplice spinner; (2) **Meno disorientamento** - l'utente vede immediatamente il tipo di contenuto che sta per caricare (tabella, card, form, etc.); (3) **Riduzione "layout shift"** - lo skeleton occupa lo stesso spazio del contenuto reale riducendo il movimento della pagina al caricamento; (4) **Standard moderno** - skeleton loader sono best practice su piattaforme come Facebook, LinkedIn, YouTube. Sprint 7 avanzamento: 7.1–7.4 completati (18h/23h = 78%).

---

### [30 Marzo 2026] — Standardizzato Formato Date con Locale i18n (Sprint 7.3)

**Task checklist:** #7.3  
**File modificati:** `src/lib/date-format.ts`, `src/app/admin/users/AdminUsersContent.tsx`, `src/app/admin/programs/AdminProgramsContent.tsx`, `src/app/trainer/trainees/page.tsx`, `src/app/trainer/trainees/[id]/page.tsx`, `src/app/trainer/trainees/[id]/records/page.tsx`, `src/app/trainer/programs/page.tsx`, `src/app/trainer/programs/[id]/progress/page.tsx`, `src/app/trainer/programs/[id]/reports/page.tsx`, `src/app/trainer/dashboard/page.tsx`, `src/app/trainee/programs/current/page.tsx`, `src/app/trainee/records/page.tsx`, `src/app/trainee/history/page.tsx`, `src/app/trainee/dashboard/page.tsx`, `src/components/ProgramsTable.tsx`, `src/components/UsersTable.tsx`  
**Note:** Completata standardizzazione di tutti i formati data e numero nell'applicazione con supporto completo i18n. Prima del task, le date erano formattate con `toLocaleDateString('it-IT')` hardcoded, impedendo il cambio lingua dinamico. Implementazioni: (1) **Nuova utility library** - creato `src/lib/date-format.ts` con funzioni helper per formattazione date e numeri che integrano automaticamente il locale corrente da i18next: `formatDate(date, format?)` per date con 3 formati (short: dd/mm/yyyy, medium: dd Mon yyyy, long: full date con weekday), `formatDateTime(date, format?)` per timestamp con ora e minuto, `formatNumber(value, decimals?)` per numeri con separatori migliaia/decimali corretti per locale (italiano: 1.234,56 — inglese: 1,234.56), `formatDateForInput(date)` per input HTML type="date" (YYYY-MM-DD), `getTodayForInput()` per data odierna in formato input, `formatRelativeTime(date)` per date relative ("2 giorni fa", "in 3 ore"); (2) **Mapping locale** - funzione `getFullLocale()` che converte codici i18n brevi (it, en) in locale completi (it-IT, en-US) per compatibilità con API Intl; (3) **TypeScript type-safe** - tutte le funzioni hanno tipi corretti per parametri e return, gestione null/undefined con fallback a stringhe vuote o "—"; (4) **Sostituite 26 istanze toLocaleDateString('it-IT')** in tutti i componenti admin, trainer, trainee; (5) **Sostituite 6 istanze toLocaleString() per numeri** (volume kg, serie, ecc.) nelle pagine report e progress; (6) **Sostituite 5 istanze toISOString().split('T')[0]** per gestione date input nei form; (7) **Componenti aggiornati** - AdminUsersContent, AdminProgramsContent, TrainerTraineesPage, TraineeProfile, RecordsManagement, ProgramsList, ProgramProgress, ProgramReports, TrainerDashboard, CurrentProgram, TraineeRecords, TraineeHistory, TraineeDashboard, ProgramsTable, UsersTable; (8) **Grafici Recharts compatibili** - Tooltip formatter aggiornato per usare `formatNumber()` invece di `toLocaleString()`; (9) **Nessun errore TypeScript** - tutte le funzioni compilano correttamente con tipi DateTimeFormatOptions dichiarati esplicitamente invece di lookup dinamico; (10) **Retrocompatibilità API** - gli endpoint API continuano a utilizzare `.toISOString()` per timestamp ISO-8601 standard, solo il frontend formatta per visualizzazione. Con questo task, l'app ora rispetta completamente il locale selezionato dall'utente per date e numeri. Quando l'utente cambierà lingua da italiano a inglese, tutte le date e i numeri si aggiorneranno automaticamente al formato corretto (en-US). Sprint 7 avanzamento: 7.1–7.3 completati (14h/23h = 61%).

---

### [30 Marzo 2026] — Completato Rimozione Stringhe Hardcoded (Sprint 7.2)

**Task checklist:** #7.2  
**File modificati:** `src/components/UserCreateModal.tsx`, `src/components/UserEditModal.tsx`, `src/components/UserDeleteModal.tsx`, `src/components/ExerciseCard.tsx`, `src/components/ExercisesTable.tsx`, `src/components/FeedbackForm.tsx`, `src/components/ProgramsTable.tsx`, `src/components/UsersTable.tsx`, `public/locales/it/*.json`, `public/locales/en/*.json`  
**Note:** Completata rimozione di tutte le stringhe hardcoded italiane dai componenti core prioritari (Fase 1). Implementazioni: (1) **8 componenti aggiornati con i18n** - UserCreateModal, UserEditModal, UserDeleteModal, ExerciseCard, ExercisesTable, FeedbackForm, ProgramsTable, UsersTable - tutti ora utilizzano il pattern `useTranslation(['namespace1', 'namespace2'])` per ottenere le traduzioni; (2) **Chiavi di traduzione aggiunte** - common.json: `creating`, `submitting`; trainer.json: `videoAvailable`, `filterByType`, `createExercise`, `noExercisesFound`, `video`, `createdBy`, `program`, `athlete`, `trainer`, `deleteProgram`, `confirmDeleteProgram`, `noProgramsFound`, `workoutsPerWeek`, `weeksShort`, `loadingError`; admin.json: `filterByRole`, `athletes`, `user`, `noUsersFound`, `createdDate`; components.json: `saveFeedback`, `total`; (3) **Pattern uniforme implementato** - tutti i componenti seguono lo stesso approccio con import di `useTranslation` da react-i18next, dichiarazione dei namespace necessari, utilizzo consistente della sintassi `t('namespace:chiave.sottochaive')` per traduzioni; (4) **Copertura completa** - etichette form, placeholder, messaggi errore, testi pulsanti, titoli modali, intestazioni tabelle, stati loading, messaggi conferma eliminazione; (5) **Interpolazione valori dinamici** - utilizzo di interpolazione per messaggi con variabili (es. `t('admin:users.confirmDeleteProgram', { title })`, `t('trainer:programs.workoutsPerWeek', { count })`); (6) **Nessun errore TypeScript** - tutti i componenti compilano senza errori dopo l'aggiornamento. Il sistema è ora completamente pronto per supportare il cambio lingua italiano/inglese su tutti i componenti core. Rimanenti per Sprint 7: standardizzazione date con locale (7.3), skeleton loaders (7.4), ARIA labels (7.5), standardizzazione formato API (7.6).

---

### [30 Marzo 2026] — Completato Gestione Massimali Trainee con View Gruppata (Sprint 4.5)

**Task checklist:** #4.5  
**File modificati:** `src/app/trainer/trainees/[id]/records/page.tsx`, `src/app/api/personal-records/route.ts`, `src/app/api/personal-records/[id]/route.ts`  
**Note:** Completata implementazione della pagina Gestione Massimali con visualizzazione per rep maxes e funzionalità di aggiornamento. Implementazioni: (1) **API Enhancement - POST** - aggiornato endpoint POST `/api/personal-records` per consentire ai trainer di creare record per i propri trainee (in precedenza solo trainees e admin potevano creare), aggiunta validazione RBAC con controllo TrainerTrainee junction per verificare ownership; (2) **Nuovo endpoint PATCH** - implementato PATCH `/api/personal-records/[id]` per aggiornamento record esistenti con validazione partial schema, controllo ownership trainer-trainee, possibilità di modificare peso, reps, data, note, e esercizio; (3) **Visualizzazione gruppata per esercizio** - i record ora sono raggruppati per esercizio con card dedicata per ogni esercizio che mostra 4 categorie di rep maxes: 1RM (reps = 1), 3RM (reps 2-4), 5RM (reps 5-7), 10RM (reps 8-12), per ciascuna categoria viene mostrato il record migliore basato su 1RM stimato con formula Brzycki; (4) **Card Rep Maxes** - ogni categoria mostra: peso record, data registrazione, numero reps effettive (per 3RM/5RM/10RM), 1RM stimato calcolato, pulsanti "Modifica" e "Elimina" per rapido accesso; (5) **Tabella completa espandibile** - sezione "Mostra tutti i record" con details/summary per visualizzare storico completo record per esercizio, ordinati per data decrescente; (6) **Modal unico Add/Edit** - modal condiviso per aggiunta e modifica massimali con pre-popolamento campi in modalità edit, disabilitazione cambio esercizio durante modifica, validazione max peso 1000kg e max reps 100, data max oggi, preview live del 1RM stimato con formula Brzycki; (7) **Sorting intelligente** - esercizi fondamentali mostrati prima degli accessori, poi ordinamento alfabetico; (8) **Toast notifications** - feedback successo su creazione, aggiornamento, eliminazione; (9) **Empty state** - messaggio e CTA quando non ci sono massimali registrati; (10) **RBAC completo** - trainer vede solo massimali dei propri trainee con tutti i controlli API. La visualizzazione gruppata per rep maxes fornisce una visione immediata delle capacità dell'atleta a diverse intensità, facilitando la programmazione dei carichi negli allenamenti. Sprint 4 completato al 100%.

---

### [30 Marzo 2026] — Completato Dettaglio Trainee con Creazione Programma (Sprint 4.4)

**Task checklist:** #4.4  
**File modificati:** `src/app/trainer/trainees/[id]/page.tsx`, `src/app/trainer/programs/new/NewProgramContent.tsx`  
**Note:** Completato miglioramento della pagina Dettaglio Trainee per trainer. La pagina già esisteva ma mancava il pulsante per creare nuovi programmi secondo specifiche. Implementazioni: (1) **Pulsante "Crea Programma" sempre visibile** aggiunto nell'header della pagina, posizionato accanto al pulsante "Gestisci Massimali", con stile verde per differenziarlo; (2) **Pre-popolamento trainee nel form creazione** - il pulsante passa il parametro URL `?traineeId=${traineeId}` alla pagina di creazione programma, il componente NewProgramContent ora legge searchParams e se presente e valido pre-seleziona il trainee corretto nel dropdown; (3) **Aggiornato link empty state** - anche quando non ci sono programmi, il pulsante "Crea Nuovo Programma" ora passa il traineeId come parametro URL; (4) **UX migliorata** - il trainer può rapidamente creare un nuovo programma per uno specifico trainee direttamente dalla sua pagina profilo senza dover selezionare manualmente il trainee dal dropdown. Funzionalità già presenti e mantenute: anagrafica trainee (nome, email, status), lista completa programmi con storico (tabella con titolo, stato, durata, data inizio), statistiche aggregate (programmi totali, programmi attivi, massimali registrati), tabs per programmi e massimali, tabella massimali con calcolo 1RM stimato via formula Brzycki, link diretto pagina gestione massimali. Tutte le API esistenti (`GET /api/users/[id]`, `GET /api/programs?traineeId=...`, `GET /api/personal-records?traineeId=...`) già implementate e funzionanti con RBAC corretto (trainer vede solo i propri trainee).

---

### [30 Marzo 2026] — Completato Reports Programma con Distribuzione RPE (Sprint 4.3)

**Task checklist:** #4.3  
**File modificati:** `src/app/trainer/programs/[id]/reports/page.tsx`, `src/app/api/programs/[id]/reports/route.ts`  
**Note:** Completata implementazione della pagina Reports Programma con tutte le analitiche richieste: SBD, Volume per Muscle Group, e **Distribuzione RPE**. L'implementazione include: (1) **Backend - Distribuzione RPE** aggiunta all'endpoint GET `/api/programs/[id]/reports` che calcola il numero di serie eseguite per range RPE: 6.0-6.5 (Facile), 7.0-7.5 (Moderato), 8.0-8.5 (Impegnativo), 9.0-10.0 (Massimale), con percentuali relative sul totale serie con RPE registrato; (2) **Frontend - Visualizzazione distribuzione RPE** con barre colorate: verde per RPE 6.0-6.5, giallo per 7.0-7.5, arancione per 8.0-8.5, rosso per 9.0-10.0, mostra numero serie e percentuale per ciascun range; (3) **Report SBD già esistente** con analisi separata per Squat, Bench Press, Deadlift: volume totale (kg), serie eseguite, intensità media (% 1RM calcolata da personal records), RPE medio per lift con colori basati su intensità; (4) **Gruppi muscolari già esistente** con serie ponderate per coefficiente, percentuale relativa sul totale, visualizzazione con progress bar arancione; (5) **Movement patterns già esistente** con volume totale per schema motorio (kg), percentuale relativa, progress bar viola; (6) **Summary cards** con metriche aggregate: volume totale SBD, serie totali SBD, numero lifts SBD con dati; (7) **RBAC completo** - trainer può vedere solo propri programmi, trainee i programmi assegnati, admin tutti; (8) **Gestione dati mancanti** - graceful handling quando non ci sono feedback registrati o personal records non disponibili (mostra "—" o messaggi "Nessun dato"). La distribuzione RPE fornisce insight rapidi sull'intensità complessiva del programma e aiuta il trainer a validare se la distribuzione dei carichi è bilanciata.

---

### [30 Marzo 2026] — Completato Progress Programma con Grafici (Sprint 4.2)

**Task checklist:** #4.2  
**File modificati:** `src/app/trainer/programs/[id]/progress/page.tsx`, `src/app/api/programs/[id]/progress/route.ts`  
**Dipendenze aggiunte:** `recharts` (libreria grafici React)  
**Note:** Implementata dashboard completa di monitoraggio progresso programma con statistiche settimanali e visualizzazioni grafiche. Miglioramenti implementati: (1) **API enhancement** - aggiunto calcolo `weeklyStats` nell'endpoint GET `/api/programs/[id]/progress` che include per ogni settimana: volume totale, RPE medio, workout completati/totali, count feedback, tipo settimana; (2) **Grafici interattivi** con recharts - Line chart "Volume per Settimana" (kg sollevati totali), Line chart "RPE Medio per Settimana" (percezione sforzo), Bar chart "Completamento Allenamenti" (completati vs totali per settimana); (3) **KPI cards** già presenti con statistiche aggregate: settimana corrente, allenamenti completati con percentuale, RPE medio complessivo, volume totale; (4) **Progress bar** visuale per completamento programma; (5) **Filtro settimane** per tabella workout dettagliata; (6) **Quick stats panels** con status programma, feedback count, performance metrics; (7) **Grafici responsive** - tutti i chart usano ResponsiveContainer per adattarsi a mobile/desktop; (8) **Colori brand-consistent** - arancione (#FFA700) per RPE, viola (#8b5cf6) per volume, verde (#10b981) per completati; (9) **Tooltip informativi** con formatter per unità misura (kg, RPE decimale); (10) **Gestione edge cases** - filtro RPE chart per escludere settimane senza feedback, graceful handling dati mancanti. La pagina fornisce al trainer una vista completa e visuale del progresso dell'atleta con trend nel tempo per volume e intensità (RPE).

---

### [30 Marzo 2026] — Implementato Edit Esercizio (Sprint 4.1)

**Task checklist:** #4.1  
**File modificati:** `src/app/trainer/exercises/[id]/edit/page.tsx`  
**Note:** Completata implementazione della pagina di modifica esercizio per i trainer. Funzionalità implementate: (1) **Caricamento dati esistenti** - fetch parallelo di esercizio corrente, gruppi muscolari e schemi motori con popolamento automatico del form; (2) **Form completo** con tutti i campi: nome (validazione 3-100 caratteri), descrizione opzionale, URL YouTube con validazione pattern, tipo (fundamental/accessory), schema motorio (dropdown con lista completa), gruppi muscolari multipli con coefficienti (somma 0.1-3.0), note/varianti multilinea; (3) **Gestione gruppi muscolari** dinamica - aggiunta/rimozione gruppi con validazione coefficienti, visualizzazione totale coefficienti in real-time, controllo max 5 gruppi; (4) **Validazione client e server-side** - controllo nome univoco, verifica ownership (trainer può modificare solo propri esercizi), validazione URL YouTube, controllo somma coefficienti; (5) **API integration** - PUT `/api/exercises/[id]` con gestione errori completa, conflict detection, redirect automatico a lista esercizi dopo salvataggio; (6) **UX optimizations** - loading spinner durante fetch iniziale, disabilitazione form durante salvataggio, messaggi errore chiari, pulsante annulla per tornare alla lista. Struttura UI coerente con pagina "new exercise" per familiarità utente. Note array gestito come textarea multilinea per facilità inserimento.

---

### [30 Marzo 2026] — Completato Workout View Trainee (Sprint 3.1)

**Task checklist:** #3.1  
**File modificati:** `src/app/trainee/workouts/[id]/page.tsx`  
**Note:** Implementata pagina workout view per trainee con tutte le funzionalità richieste. L'implementazione include: (1) **Interfacce TypeScript allineate** con la risposta API (WorkoutExerciseWithWeight, ExerciseFeedback, SetPerformed senza RPE per set); (2) **Chiamata API corretta** a `/api/trainee/workouts/[id]` che restituisce dati con effectiveWeight già calcolato server-side; (3) **Gestione peso effettivo** visualizzato nelle card esercizi con indicazione tipo peso (kg o %); (4) **Input serie** con tabella per peso e reps, RPE complessivo per esercizio (non per singola serie come da schema DB); (5) **Auto-save localStorage** che salva feedbackData, exerciseRPE e globalNotes ogni volta che cambiano; (6) **Feedback submission** con invio POST `/api/feedback` per ogni esercizio, gestione idempotency server-side, skip esercizi senza dati; (7) **UI mobile-first** con card espandibili, swipe navigation tra esercizi, YouTube embed per video, indicatori volume/RPE real-time; (8) **Gestione stati settimana** con badge colorati per deload/test; (9) **Caricamento feedback esistente** se presente nella risposta API. Fix importante: rimosso campo `actualRPE` da SetPerformed (non esiste nel DB), aggiunto stato separato `exerciseRPE` per RPE complessivo esercizio come da schema Prisma.

---

### [30 Marzo 2026] — Implementato Edit Programma Metadata

**Task checklist:** #2.7  
**File modificati:** `src/app/trainer/programs/[id]/edit/page.tsx`, `src/app/api/programs/[id]/route.ts`  
**File creati:** `src/app/trainer/programs/[id]/edit/EditProgramMetadata.tsx`  
**Note:** Implementata funzionalità di modifica delle informazioni base del programma. Creato componente modale `EditProgramMetadata` che permette di modificare: (1) **Nome programma** - titolo con validazione 3-100 caratteri; (2) **Atleta assegnato** - riassegnazione del programma a un diverso trainee con verifica ownership via TrainerTrainee; (3) **Durata settimane** - con warning che spiega che le settimane esistenti vengono mantenute; (4) **Allenamenti per settimana** - con warning simile per i workout esistenti. Il componente è integrato nella pagina edit esistente (workflow configuration) tramite un pulsante "✏️ Modifica Info Programma" nell'header. **Validazione rigorosa**: (1) Solo programmi in status=draft possono essere modificati (check client e server-side); (2) Se status≠draft, mostra alert warning e disabilita il form; (3) Aggiornamento API per supportare durationWeeks e workoutsPerWeek oltre a title e traineeId. Il modal si apre al click, carica dinamicamente la lista trainees, e dopo il salvataggio ricarica i dati del programma aggiornati con toast success.

---

### [30 Marzo 2026] — Completato Publish Programma (Step 4 Program Builder)

**Task checklist:** #2.6  
**File modificati:** `src/app/trainer/programs/[id]/publish/page.tsx`  
**Note:** Verificato e ottimizzato il programma di pubblicazione (step 4 del wizard). Implementazioni complete: (1) **Riepilogo programma** con statistiche: atleta, durata, workout configurati/totali, numero totale esercizi; (2) **Panoramica settimane** con badge tipo settimana (loading/deload), visualizzazione stato workout per giorno (badge colorati: verde=configurato, grigio=vuoto), indicatori visivi workout/settimana; (3) **Validazione pre-pubblicazione** automatica che blocca con messaggi chiari: workout senza esercizi, settimane incomplete; (4) **Input data inizio** con default al prossimo lunedì, validazione contro date passate, suggerimento UX per iniziare di lunedì; (5) **Conferma pubblicazione** con modal di conferma, chiamata POST `/api/programs/[id]/publish` con gestione errori, redirect automatico a `/trainer/programs` con toast success; (6) **Progress indicator wizard** che mostra step completati (Setup✓, Esercizi✓, Pubblica→); (7) **Info box** che spiega conseguenze pubblicazione (status Active, visibilità trainee, limitazioni modifica). Fix minore: aggiunta trasformazione dati API → frontend per calcolare `exerciseCount` da `workoutExercises.length`.

---

### [30 Marzo 2026] — Completato Workout Detail Editor (Step 3 Program Builder)

**Task checklist:** #2.5  
**File modificati:** `src/app/trainer/programs/[id]/workouts/[wId]/page.tsx`  
**Note:** Refactoring completo del Workout Detail Editor con tutte le funzionalità per Step 3 del wizard creazione programma. Implementazioni: (1) **Autocomplete Search** per selezione esercizi con componente riutilizzabile, sostituisce dropdown statico; (2) **Form completo** con tutti i campi schema: sets (1-20), reps (formato "8", "8-10", "6/8" con validazione), restTime (enum s30/m1/m2/m3/m5), targetRpe (5.0-10.0 step 0.5, opzionale), weightType (absolute/percentage_1rm/percentage_rm/percentage_previous), weight (numerico, obbligatorio se percentage), isWarmup (checkbox), notes (max 500 char); (3) **Edit inline** per modificare esercizi già aggiunti, pulsante ✏️ carica dati nel form; (4) **Display card migliorato** mostra tutti i parametri con badge "🔥 Riscaldamento"; (5) **Navigazione wizard** con pulsante "Salva e Continua alla Pubblicazione →" se program status=draft e workout ha esercizi, altrimenti solo "Torna alla Panoramica"; (6) **UX migliorato** con form disabilitato durante submit, toast notifications, confirmation modal per delete, reset automatico form. Fix minore: corretta query ownership in `/api/personal-records/route.ts` (traineeId unique, non composite key).

---

### [30 Marzo 2026] — Implementato PATCH /api/weeks/[id]

**Task checklist:** #2.4  
**File creati:** `src/app/api/weeks/[id]/route.ts`  
**Note:** Implementato endpoint PATCH per configurazione tipo settimana e flag feedback. L'endpoint permette di modificare `weekType` (normal/test/deload) e `feedbackRequested` (boolean) anche post-pubblicazione, offrendo flessibilità al trainer per adattare la programmazione in corso (es. cambio da settimana normale a deload se trainee riporta affaticamento). Validazioni implementate: verifica ownership (trainer può modificare solo settimane dei propri programmi, admin può modificare qualsiasi), almeno un campo deve essere fornito nella richiesta. L'endpoint restituisce la settimana aggiornata con dettagli del programma e lista dei workout associati.

---

### [30 Marzo 2026] — Implementato POST /api/programs/[id]/complete

**Task checklist:** #2.3  
**File creati:** `src/app/api/programs/[id]/complete/route.ts`  
**Note:** Implementato endpoint POST per completamento manuale programma da parte del trainer. L'endpoint permette di marcare un programma come `completed` anche se non tutte le settimane sono finite. Validazioni implementate: verifica ownership (trainer può completare solo i propri programmi, admin può completare qualsiasi), verifica status (solo programmi `active` possono essere completati), supporto per `completionReason` opzionale (max 500 char). Il programma viene aggiornato con status='completed', completedAt=now(), e completionReason se fornito.

---

### [30 Marzo 2026] — Implementato GET /api/trainee/workouts/[id]

**Task checklist:** #2.2  
**File creati:** `src/app/api/trainee/workouts/[id]/route.ts`  
**Note:** Implementato endpoint GET per visualizzazione workout da parte del trainee. Include calcolo server-side dei pesi effettivi per ogni esercizio tramite `calculateEffectiveWeight()`, che gestisce tutte le tipologie di peso (absolute, percentage_1rm, percentage_rm, percentage_previous). L'endpoint verifica ownership tramite la catena Workout → Week → Program → traineeId, e include feedback esistente per la data corrente. Gestisce gracefully i casi di massimali mancanti con `effectiveWeight: null`.

---

### [30 Marzo 2026] — Completato POST /api/feedback con calcoli metriche

**Task checklist:** #2.1  
**File modificati:** `src/app/api/feedback/route.ts`  
**Note:** Migliorata risposta endpoint POST /api/feedback per includere metriche calcolate: `totalVolume` (somma reps × weight di tutte le serie) e `avgRPE` (actualRpe del feedback). L'endpoint già implementava nested create di ExerciseFeedback + SetPerformed, validazione ownership trainee, e idempotency check per data. Ora la response include un oggetto `calculated` con le metriche derivate per facilitare UX e reportistica.

---

### [30 Marzo 2026] — Reject coefficiente esercizi invalido

**Task checklist:** #1.4  
**File modificati:** `src/app/api/exercises/route.ts`, `src/app/api/exercises/[id]/route.ts`  
**Note:** Modificata validazione coefficienti muscle groups: ora la somma deve essere tra 0.1 e 3.0, altrimenti ritorna HTTP 400. Sostituito il warning con reject per evitare di creare esercizi che genererebbero dati errati nei report. Applicato sia a POST che PUT.

---

### [30 Marzo 2026] — Validazione lunghezza parametro search

**Task checklist:** #1.3  
**File modificati:** `src/app/api/exercises/route.ts`, `src/app/api/programs/route.ts`  
**Note:** Aggiunta validazione lunghezza parametro search (2-100 caratteri) per prevenire query DB pesanti con stringhe troppo lunghe. La validazione viene eseguita dopo il parsing degli schema Zod e restituisce HTTP 400 se fuori range.

---

### [30 Marzo 2026] — Fix RBAC bypass personal records

**Task checklist:** #1.1  
**File modificati:** `src/app/api/personal-records/route.ts`  
**Note:** Aggiunto ownership check per trainer quando richiedono personal records con parametro traineeId. Previene accesso a massimali di trainee di altri trainer. Utilizza la relazione TrainerTrainee con chiave composita per validare l'ownership.

---

### [28 Marzo 2026] — Setup iniziale database

**Cosa è stato fatto:**
- Schema database creato su Supabase via SQL manuale (`prisma/init.sql`)
- Porta 5432 non raggiungibile via Prisma CLI, usato SQL Editor Supabase come workaround

**File coinvolti:** `prisma/init.sql`, `prisma/schema.prisma`  
**Note:** La migrazione Prisma standard (`prisma migrate`) non funziona per limitazioni network sulla porta 5432. Usare l'SQL Editor di Supabase per applicare DDL.

---

### [Pre-28 Marzo 2026] — Fondamenta progetto

**Cosa è stato fatto:**
- Setup progetto Next.js 14 + TypeScript + Tailwind CSS
- Schema Prisma completo (14 entità, 6 enum, indici ottimizzati, cascade delete)
- Seed script con dati test: 1 admin, 2 trainer, 10 trainee, esercizi campione
- 8 librerie utility: `prisma.ts`, `supabase-client.ts`, `supabase-server.ts`, `api-response.ts`, `auth.ts`, `logger.ts`, `password-utils.ts`, `calculations.ts`
- 9 schema Zod di validazione (user, exercise, workout-exercise, feedback, program, week, personal-record, muscle-group, movement-pattern)
- Middleware completo: autenticazione Supabase, RBAC role-based routing, rate limiting ibrido (Redis + in-memory)
- Configurazione i18n (IT default + EN) con file traduzioni
- PWA manifest + icone placeholder
- App structure Next.js (layout, error boundary, loading, 404)
- 29 API endpoint implementati su 34 previsti (85%)
- 21 pagine frontend funzionali su 32 previste (52%)
- 27+ componenti UI implementati
- 8 file di test (unit, integration, E2E)
- GitHub Actions CI/CD pipeline
- Documentazione: 17 file markdown

**Stato raggiunto (snapshot storico 30 Mar 2026):** ~58% completamento complessivo

---

### [30 Marzo 2026] — System Review & riorganizzazione documentazione

**Cosa è stato fatto:**
- Creato [system-review.md](./system-review.md) — review completo del sistema con stato per area, issue sicurezza, backlog prioritizzato
- Aggiornato IMPLEMENTATION_SUMMARY.md (ora incluso in README.md) — percentuali corrette (da ~40% dichiarato a ~58% reale)
- Riscritto [next-actions.md](./next-actions.md) — rimossi task già completati, aggiunto backlog reale con effort
- Aggiornato [README.md](../README.md) — indice file aggiornato, stato corretto
- Creato [CHECKLIST.md](./CHECKLIST.md) — checklist sviluppo con 49 task in 8 sprint
- Creato questo file [CHANGELOG.md](./CHANGELOG.md)

**Note:** La documentazione precedente dichiarava ~40% di completamento; l'analisi reale del codice ha rilevato ~58% in quello snapshot. Lo stato corrente e canonico e mantenuto in [CHECKLIST.md](./CHECKLIST.md).

---

## Prossime entry

<!-- Copia il template sotto per registrare il prossimo sviluppo -->

<!--
### [GG Mese AAAA] — Titolo
**Task checklist:** #X.Y  
**File modificati:** `...`  
**Note:** ...
-->
