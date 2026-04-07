# Funzionalità Trainer

## To Implement (TO DO)
- Reportistica
- Aggiungere info peso (sotto Creazione Trainee)

## To Test (TO TEST)
- Creazione Trainee
- Creazione Esercizio
- Creazione Scheda

# Funzionalità Trainee

## To Implement (TO DO)
- Nessuno

## To Test (TO TEST)
- Visualizzazione Programma
- Esecuzione Scheda

# Ore lavorate
- 27.03.2026 > 4h
- 28.03.2026 > 4h
- 29.03.2026 > 4h
- 30.03.2026 > 4h
- 31.03.2026 > 4h
- 01.04.2026 > 4h
- 02.04.2026 > 4h
- 03.04.2026 > 6h
- 05.04.2026 > 4h
- 07.04.2026 > 4h

PROMPT GESTIONE PESO
Sei un senior software developer.
Nella schermata del trainee /trainee/programs/current devi implementare una schermata di riepilogo con tutti i workout organizzati per settimana con i dettagli per ogni workout degli esercizi. vorrei un'overview tabellare / con pannelli simile a quello che viene visualizzato in http://localhost:3000/trainer/programs/2adf63d7-51f6-4edf-b51f-87397c651bb5. il trainee a quel punto può selezionare un workout e iniziarlo ( si deve utilizzare sempre la stessa schermata di http://localhost:3000/trainee/workouts/48c86a02-3965-4b94-a05e-8969e52622d8 accessibile dalla homepage del trainee). Utilizza sempre i18n e ricorda che l'implementazione deve essere pensata per essere utilizzata da mobile. implementa inoltre un utility che permette di fare l'export del programma di allenamento in PDF, ci deve essere un foglio per settimana e ogni settimanadeve essere organizzata in workout e ogni workout in modo tabellare deve dare i dettagli riguardante il workout stesso (stesse info che vengono mostrate da app). Il PDF deve essere rbandizzato con i loghi presenti nell'app. Deve essere un componente che poi può essere integrato anche nella visualizzazione del trainer.