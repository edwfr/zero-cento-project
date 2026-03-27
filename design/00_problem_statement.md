# Problem Statement

## Obiettivo
Realizzare una piattaforma web per la gestione di servizi di coaching sportivo/fitness. La piattaforma permette ai coach di costruire e assegnare programmi di allenamento personalizzati (schede) e ai trainee di seguirli e fornire feedback, eliminando la gestione manuale su fogli di calcolo o app generiche.

## Utenti
- **Utente primario**: Coach -- crea e gestisce esercizi, schede e profili trainee.
- **Utente secondario**: Trainee -- consulta le schede assegnate e fornisce feedback sugli allenamenti.
- **Utente di sistema**: Admin -- gestisce tutte le anagrafiche (utenti, ruoli).
- **Scala iniziale**: 1 admin - 3 coach - 50 trainee.

## Valore generato
- Il coach ha un unico strumento per progettare programmi multi-settimana con esercizi dettagliati (serie, ripetizioni, intensita, RPE) e monitorarne l'esecuzione.
- Il trainee ha sempre visibile la scheda corrente e puo dare feedback immediato su ogni esercizio.
- L'admin mantiene il controllo delle anagrafiche senza accedere al database.

## Scope IN
- Autenticazione e autorizzazione basata su ruoli (admin / coach / trainee).
- Libreria condivisa di esercizi con video YouTube associato.
- Creazione e gestione di schede di allenamento multi-settimana (esercizi x serie x rip x intensita x RPE).
- Visualizzazione scheda corrente e storico schede per il trainee.
- Feedback del trainee su ogni esercizio del singolo allenamento.
- Monitoraggio avanzamento e feedback da parte del coach.
- Interfaccia responsive con ottimizzazione differenziata per ruolo:
  - **Admin / Coach**: ottimizzata per desktop (workflow di creazione contenuti complessi)
  - **Trainee**: ottimizzata per mobile portrait (uso in palestra durante allenamento)

## Scope OUT
- [OD-04] Da definire: notifiche push/email, pagamenti/abbonamenti, app nativa iOS/Android, chat in-app, pianificazione nutrizionale.

## Vincoli
- **Tecnologici**: Next.js (App Router) come framework full-stack; deploy su Vercel.
- **UX/Device**: Admin e Coach lavorano primariamente da desktop; Trainee utilizza l'app principalmente da mobile in palestra.
- **Temporali**: [OD-06] milestone da definire.
- **Organizzativi**: [OD-07] dimensione team e processi di approvazione da definire.