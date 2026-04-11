# Problem Statement

> Nota posizionamento (Apr 2026): ZeroCento e una training management platform trainer-led. La logica decisionale su programmazione e coaching resta in capo al trainer.

## Obiettivo
Realizzare una piattaforma web per la gestione di servizi di training sportivo/fitness. La piattaforma permette ai trainer di costruire e assegnare programmi di allenamento personalizzati (schede) e ai trainee di seguirli e fornire feedback, eliminando la gestione manuale su fogli di calcolo o app generiche.

## Utenti
- **Utente primario**: trainer -- crea e gestisce esercizi, schede e profili trainee.
- **Utente secondario**: Trainee -- consulta le schede assegnate e fornisce feedback sugli allenamenti.
- **Utente di sistema**: Admin -- gestisce tutte le anagrafiche (utenti, ruoli).
- **Scala iniziale**: 1 admin - 3 trainer - 50 trainee.

### Contesto d'uso
- **Trainer**: Accesso sporadico per creazione contenuti (nuovi trainee, schede) -- sessioni brevi (15-30 min), principalmente da desktop
- **Trainee**: Accesso continuativo durante allenamento (60-90+ min) in palestra -- sessioni lunghe, da mobile, con frequente app switching (Instagram, musica, timer) durante i recuperi tra serie
- **Implicazione critica**: Sistema deve mantenere sessione attiva per 90+ minuti senza richiedere re-login, anche con app in background o device in standby durante recuperi

## Valore generato
- Il trainer ha un unico strumento per progettare programmi multi-settimana con esercizi dettagliati (serie, ripetizioni, intensita, RPE) e monitorarne l'esecuzione.
- Il trainee ha sempre visibile la scheda corrente e puo dare feedback immediato su ogni esercizio.
- L'admin mantiene il controllo delle anagrafiche senza accedere al database.

## Scope IN
- Autenticazione e autorizzazione basata su ruoli (admin / trainer / trainee).
- Libreria condivisa di esercizi con video YouTube associato.
- Creazione e gestione di schede di allenamento multi-settimana (esercizi x serie x rip x intensita x RPE).
- Visualizzazione scheda corrente e storico schede per il trainee.
- Feedback del trainee su ogni esercizio del singolo allenamento.
- Monitoraggio avanzamento e feedback da parte del trainer.
- Interfaccia responsive con ottimizzazione differenziata per ruolo:
  - **Admin / trainer**: ottimizzata per desktop (workflow di creazione contenuti complessi)
  - **Trainee**: ottimizzata per mobile portrait (uso in palestra durante allenamento)

## Scope OUT
- [OD-04] Da definire: notifiche push/email, pagamenti/abbonamenti, app nativa iOS/Android, chat in-app, pianificazione nutrizionale.

## Vincoli
- **Tecnologici**: Next.js (App Router) come framework full-stack; deploy su Vercel.
- **UX/Device**: Admin e trainer lavorano primariamente da desktop; Trainee utilizza l'app principalmente da mobile in palestra.
- **Temporali**: [OD-06] milestone da definire.
- **Organizzativi**: [OD-07] dimensione team e processi di approvazione da definire.