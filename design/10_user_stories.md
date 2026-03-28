# User Stories

Questo documento contiene le user stories organizzate per tipo di utente/persona: Admin, Trainer e Trainee.

---

## 🔑 Admin

### Gestione Utenti

**US-A01**: Come admin, voglio visualizzare la lista completa di tutti gli utenti del sistema (admin, trainer, trainee), per avere una panoramica centralizzata di chi accede alla piattaforma.

**US-A02**: Come admin, voglio creare nuovi utenti con ruolo trainer o trainee, per gestire l'onboarding senza accesso diretto al database.

**US-A03**: Come admin, voglio modificare i dati di qualsiasi utente (nome, cognome, email, ruolo), per correggere errori o aggiornare informazioni anagrafiche.

**US-A04**: Come admin, voglio disattivare o riattivare un profilo trainee, per bloccare l'accesso senza eliminare lo storico dati quando necessario.

**US-A05**: Come admin, voglio eliminare un utente dal sistema, per rimuovere account non più necessari o creati per errore.

**US-A06**: Come admin, voglio generare una password iniziale per i nuovi utenti, per fornire credenziali di primo accesso che possono poi essere modificate.

### Gestione Associazioni

**US-A07**: Come admin, voglio visualizzare le associazioni trainer-trainee esistenti, per monitorare chi segue quale atleta.

**US-A08**: Come admin, voglio modificare le associazioni trainer-trainee, per riassegnare atleti tra diversi trainer quando necessario.

---

## 👨‍🏫 Trainer

### Gestione Libreria Esercizi

**US-T01**: Come trainer, voglio visualizzare la libreria completa di esercizi condivisa tra tutti i trainer, per scegliere gli esercizi da inserire nelle schede.

**US-T02**: Come trainer, voglio filtrare gli esercizi per gruppo muscolare, schema motorio o tipo (fondamentale/accessorio), per trovare rapidamente l'esercizio adatto alle mie necessità.

**US-T03**: Come trainer, voglio creare un nuovo esercizio specificando nome, descrizione, URL video YouTube, tipo (fondamentale SBD o accessorio), schema motorio, gruppi muscolari con coefficienti di incidenza e note/varianti, per arricchire la libreria condivisa con nuovi movimenti.

**US-T04**: Come trainer, voglio modificare qualsiasi esercizio della libreria condivisa (anche se creato da altri trainer), per correggere errori o aggiornare informazioni obsolete in modo collaborativo.

**US-T05**: Come trainer, voglio eliminare un esercizio dalla libreria condivisa (se non utilizzato in schede attive), per mantenere pulita la libreria rimuovendo esercizi non più utilizzati.

**US-T06**: Come trainer, voglio visualizzare il dettaglio di un esercizio con video YouTube incorporato, gruppi muscolari e schema motorio, per avere tutte le informazioni prima di inserirlo in una scheda.

### Gestione Gruppi Muscolari e Schemi Motori

**US-T07**: Come trainer, voglio creare nuovi gruppi muscolari personalizzati (es. "Obliqui", "Erettori spinali"), per adattare la tassonomia alla mia metodologia di allenamento.

**US-T08**: Come trainer, voglio modificare o archiviare gruppi muscolari esistenti, per aggiornare la nomenclatura senza perdere l'integrità referenziale dei dati storici.

**US-T09**: Come trainer, voglio creare nuovi schemi motori personalizzati (es. "Turkish Get-Up", "Overhead Carry"), per categorizzare esercizi secondo il mio approccio tecnico.

**US-T10**: Come trainer, voglio modificare o archiviare schemi motori esistenti, per mantenere la libreria aggiornata senza eliminare collegamenti con esercizi già programmati.

**US-T11**: Come trainer, voglio personalizzare i colori associati a ogni schema motorio, per avere una vista visiva chiara della distribuzione dei pattern motori nella mia programmazione settimanale.

### Gestione Trainee

**US-T12**: Come trainer, voglio visualizzare la lista completa dei miei trainee assegnati con indicazione dello stato (attivo/disabilitato), per avere una panoramica dei miei atleti.

**US-T13**: Come trainer, voglio creare un nuovo profilo trainee con generazione automatica della password iniziale, per permettere nuovi atleti di accedere alla piattaforma in autonomia.

**US-T14**: Come trainer, voglio modificare i dati anagrafici dei miei trainee (solo quelli a me assegnati), per aggiornare informazioni di contatto quando necessario.

**US-T15**: Come trainer, voglio disattivare o riattivare il profilo dei miei trainee, per bloccare temporaneamente l'accesso senza eliminare i dati storici (es. sospensione per infortunio o fine collaborazione).

**US-T16**: Come trainer, voglio visualizzare il profilo completo di un trainee con tutte le schede assegnate (attive, passate, draft), per monitorare lo storico della programmazione.

**US-T17**: Come trainer, voglio visualizzare e modificare i massimali (1RM e nRM) dei miei trainee per ogni esercizio, per tenere aggiornati i parametri di intensità nelle schede.

### Creazione Schede di Allenamento

**US-T18**: Come trainer, voglio creare una nuova scheda di allenamento specificando durata in settimane, numero di allenamenti per settimana e trainee assegnato, per iniziare la programmazione (Step 1: Setup).

**US-T19**: Come trainer, voglio avere una vista ad alto livello della settimana tipo con aggiunta rapida di esercizi visualizzati con colori degli schemi motori personalizzati, per bilanciare visivamente la distribuzione dei movimenti (Step 2: Week Overview).

**US-T20**: Come trainer, voglio compilare il dettaglio di ogni singolo allenamento specificando per ogni esercizio: ordine, serie x ripetizioni (numero intero o intervallo es. "6/8"), note (menu a tendina), RPE target (5.0-10.0 con incrementi 0.5), peso (kg assoluti o % rispetto a massimale), tempo di recupero (30s, 1m, 2m, 3m, 5m) e flag riscaldamento, per definire con precisione ogni sessione (Step 3: Workout Detail).

**US-T21**: Come trainer, voglio salvare una scheda come bozza (status=draft) e modificarla più volte prima della pubblicazione, per poter lavorare alla programmazione in sessioni separate.

**US-T22**: Come trainer, voglio pubblicare una scheda scegliendo la data di inizio della Week 1, per renderla visibile e attiva per il trainee assegnato (Step 4: Publish).

**US-T23**: Come trainer, voglio marcare specifiche settimane come "feedback obbligatorio", per richiedere al trainee di fornire feedback dettagliato su esercizi e prestazioni in momenti chiave della programmazione.

**US-T24**: Come trainer, voglio visualizzare la lista di tutte le schede create (draft, active, completed) con filtri e ricerca, per gestire efficacemente la mia programmazione.

### Monitoraggio e Reportistica

**US-T25**: Come trainer, voglio visualizzare l'avanzamento settimanale di una scheda attiva con lo stato dei feedback compilati dal trainee, per monitorare l'aderenza al programma.

**US-T26**: Come trainer, voglio leggere i feedback dettagliati del trainee su ogni esercizio (serie completate con reps/kg, RPE percepito, note testuali), per valutare l'efficacia della programmazione e adattare le sessioni successive.

**US-T27**: Come trainer, voglio visualizzare la reportistica avanzata per le alzate fondamentali SBD (Squat, Bench, Deadlift) con metriche FRQ (frequenza giorni), NBL (numero di alzate totali) e IM (intensità media) filtrate per periodo, per analizzare il carico di allenamento sui fondamentali.

**US-T28**: Come trainer, voglio visualizzare grafici di serie totali e ripetizioni totali per gruppo muscolare (Serie Allenanti), per verificare il bilanciamento del volume di lavoro.

---

## 🏋️ Trainee

### Visualizzazione Schede

**US-U01**: Come trainee, voglio visualizzare nella dashboard la mia scheda attiva in evidenza, per accedere rapidamente al programma corrente.

**US-U02**: Come trainee, voglio visualizzare la scheda attiva con suddivisione per settimana e giorno, per capire la struttura dell'intera programmazione.

**US-U03**: Come trainee, voglio visualizzare il dettaglio di un singolo allenamento con tutti gli esercizi in sequenza (ordine, serie x ripetizioni, RPE target, peso, tempo di recupero, note), per seguire con precisione le indicazioni del trainer durante la sessione in palestra.

**US-U04**: Come trainee, voglio visualizzare il video YouTube dimostrativo per ogni esercizio, per eseguire correttamente il movimento anche se non lo conosco.

**US-U05**: Come trainee, voglio vedere i gruppi muscolari coinvolti in ogni esercizio con coefficienti di incidenza, per comprendere quali aree sto allenando.

**US-U06**: Come trainee, voglio visualizzare lo storico di tutte le schede completate o passate, per rivedere i programmi precedenti e confrontare i progressi.

### Feedback e Tracciamento

**US-U07**: Come trainee, voglio fornire feedback su ogni esercizio completato specificando: numero di serie effettivamente eseguite con reps e kg per ogni serie, RPE percepito, note testuali e flag di completamento, per permettere al trainer di monitorare la mia aderenza e prestazione.

**US-U08**: Come trainee, voglio che il sistema mantenga la sessione attiva per oltre 90 minuti senza richiedere re-login, per utilizzare l'app durante l'intero allenamento anche con frequente switching ad altre app (Instagram, musica, timer).

**US-U09**: Come trainee, voglio che il sistema salvi automaticamente il feedback parziale anche se l'app va in background, per non perdere i dati inseriti durante l'allenamento.

**US-U10**: Come trainee, voglio fornire feedback generale testuale per le settimane marcate come "feedback obbligatorio" dal trainer, per comunicare sensazioni complessive, difficoltà o miglioramenti percepiti.

**US-U11**: Come trainee, voglio vedere chiaramente quali settimane richiedono feedback obbligatorio e verificare quali esercizi devo ancora completare, per rispettare le richieste del trainer.

### Gestione Massimali

**US-U12**: Come trainee, voglio visualizzare la lista dei miei massimali personali (1RM e nRM) per ogni esercizio, per avere un riferimento delle mie capacità massimali.

**US-U13**: Come trainee, voglio aggiungere o modificare manualmente i miei massimali specificando esercizio, numero di ripetizioni, peso, data e note, per tenere traccia dei miei progressi nel tempo.

**US-U14**: Come trainee, voglio visualizzare lo storico dei massimali per esercizio specifico con andamento nel tempo, per vedere graficamente i miei miglioramenti.

### Reportistica Personale

**US-U15**: Come trainee, voglio visualizzare la reportistica sulle alzate fondamentali SBD (FRQ, NBL, IM) per il periodo della mia scheda attiva, per comprendere l'intensità del lavoro sui fondamentali.

**US-U16**: Come trainee, voglio visualizzare grafici di serie totali e ripetizioni totali per gruppo muscolare, per capire quali aree del corpo sto allenando di più.

---

## Riepilogo User Stories per Ruolo

| Ruolo   | User Stories | Aree Funzionali                                                                                        |
| ------- | ------------ | ------------------------------------------------------------------------------------------------------ |
| Admin   | US-A01-A08   | Gestione utenti (CRUD), attivazione/disattivazione profili, associazioni trainer-trainee               |
| Trainer | US-T01-T28   | Libreria esercizi, gruppi muscolari, schemi motori, gestione trainee, creazione schede, monitoraggio   |
| Trainee | US-U01-U16   | Visualizzazione schede, feedback esercizi, gestione massimali, reportistica personale, sessione estesa |

**Totale User Stories**: 44
