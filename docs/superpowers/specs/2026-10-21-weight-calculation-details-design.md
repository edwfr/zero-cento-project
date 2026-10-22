# Dettaglio "come è stato calcolato" il peso (solo trainer)

Data: 2026-10-21 · Taglia: Medium (solo UI + funzione pura, nessuno schema/API nuovi)
Dipende da: spec 1 (`weight-from-latest-1rm`), spec 2 (`rpe-weight-range`), spec 3
(`bodyweight-loaded-exercises`). Va implementata per ultima.

## Intento

Il calcolo del peso ora ha più passaggi: PR più recente → 1RM teorico (Tuchscherer o
tabella trazioni) → percentuale o RPE → arrotondamento → zavorra. Il trainer deve poter
verificare il numero proposto senza rifare i conti. Accanto al peso calcolato compare
un'icona **(i)**. Cliccandola si vedono i passaggi.

Decisione dell'utente: **solo il trainer** vede il dettaglio. L'atleta no.

## Dove

| Pagina | Quando compare la (i) |
|---|---|
| Modifica programma (`edit/_content.tsx`), editabile e sola lettura | accanto all'anteprima del peso calcolato o del range RPE, solo per pesi derivati (`%1RM`, `-x%`, range RPE) o per esercizi zavorrati |
| Review programma (`review/_content.tsx`) | idem, accanto al peso effettivo |

*Scelta del designer:* non nella vista workout del trainer (`workouts/[wId]`) né nel PDF.

Per un peso `absolute` di un esercizio normale la (i) non compare: non c'è niente da spiegare.

## Contenuto (esempi)

`%1RM`, esercizio normale:
```
PR più recente: 120 kg × 5 (30/09/2026)
1RM teorico: 120 ÷ 86,3% (Tuchscherer, 5 @ RPE 10) = 139,05 → 139 kg
75% di 139 = 104,25 → arrotondato 104,5 kg
```

`-10%`:
```
Base: riga 2 (Trazioni) = 104,5 kg
104,5 × (1 − 10%) = 94,05 → arrotondato 94,5 kg
```

Range RPE:
```
PR più recente: 120 kg × 5 (30/09/2026) → 1RM teorico 139 kg
5 @ RPE 8 = 81,1% (Tuchscherer) → 112,73 kg
Range ±2%: 110,47 – 114,98 → 110,5 – 115 kg
```

Esercizio zavorrato:
```
PR più recente: 130 kg × 1 (carico totale) (01/06/2026) → 1RM teorico 130 kg (tabella trazioni/dip)
75% di 130 = 97,5 kg totali
Peso corporeo: 80 kg (15/10/2026) → zavorra 17,5 kg
```

Casi senza risultato (es. "Nessun PR registrato per questo esercizio", "Nessuna riga
precedente", "Reps fuori tabella"): la (i) spiega perché manca il peso.

Il dettaglio viene **ricostruito al momento** dai PR e dal BW attuali. Se il peso salvato
differisce dal ricalcolo, per esempio perché dopo il salvataggio è arrivato un nuovo PR, il
dettaglio lo dice: "Peso salvato: 112,5 kg. Con i dati attuali sarebbe 104,5 kg." *Scelta
del designer.*

## Implementazione

- Funzione pura in `src/lib/calculations.ts` (o in un nuovo `src/lib/weight-explanation.ts`)
  che restituisce i passaggi **strutturati** (array di step con chiave i18n e valori
  numerici), non stringhe già tradotte. Riusa le stesse funzioni di calcolo (stesso 1RM,
  stessa tabella, stesso arrotondamento), così il dettaglio non può divergere dal numero.
- UI: popover al click su un'icona `Info` (lucide). Si chiude con Esc, clic fuori o un
  secondo clic. Su mobile funziona al tap, senza hover. Verificare se in `src/components/`
  esiste già un popover o tooltip riusabile (es. il pattern `openExerciseFlagHint` in
  `trainee/workouts/[id]/_content.tsx`) prima di crearne uno nuovo.
- Il pulsante (i) deve essere `ActionIconButton` o un bottone accessibile con `aria-label`.
- Numeri e date: formato italiano (`formatDate()`, GG/MM/AAAA). Decimali con virgola in IT.
- Chiavi i18n in entrambi i locale `public/locales/{en,it}/`, preservando la codifica.

## Test

- Funzione di spiegazione: un caso per tipo (`%1RM`, `-x%`, range RPE, zavorrato, nessun
  PR, nessuna riga precedente, peso salvato ≠ ricalcolo). Gli step devono dare lo stesso
  numero finale delle funzioni di calcolo.
- Componente: la (i) non compare per `absolute` su un esercizio normale; si apre e si chiude.

## Scelte del designer da verificare

1. La (i) compare solo in modifica programma e review, non nella vista workout trainer né nel PDF.
2. Il dettaglio usa i dati attuali e segnala se il peso salvato è diverso.
3. Popover al click (non al passaggio del mouse), per funzionare anche su mobile.
