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

PROMPT GESTIONE PESO
Sei un senior software developer.
Devi implementare nella schermata http://localhost:3000/trainer/programs/7a570570-872d-4ee8-aded-83d93ac4213c/edit allo step 3 Esercizi la seguente logica per la gestione dell'input box del peso:
lutente può inserire tre diversi tipi di valore: il peso assoluto espresso in kg, la -n% (significa che nello stesso workout dovrei avere già un occorrenza dell'esercizio e voglio che quella serie lo fai con il -% in meno del peso rispetto la seri precedente) oppure il %n1RM, questo è ammesso solo se tra i massimali dell'utente è presente per lo stesso esercizio un massimale salvato.
Nel caso in cui l'utente inserisa -n% ma nella stesso workout non ci fosse già un occorrenza dello stesso eserciziod devi avvertire il trainer con una popup bloccante di errore; devi avvertire il trainerr che il valore non è ammissibile anche se scrive %n1RM ma non è presente un massimale per quel esercizio per quel trainee. Nel caso di kg assolutio a db si devono salvare i kg assoluti, negli altri due casi mi piacerebbe salvare sia l'indicazione in % sia i kg effettivi calcolati