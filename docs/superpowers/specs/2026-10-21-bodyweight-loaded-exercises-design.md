# Esercizi a corpo libero zavorrati (trazioni, dip)

Data: 2026-10-21 · Taglia: Large (nuovo campo su `Exercise`, nuova tabella RPE)
Dipende da: `2026-10-21-weight-from-latest-1rm-design.md`.
Interagisce con: `2026-10-21-rpe-weight-range-design.md`.

## Intento

Nelle trazioni e nei dip zavorrati il carico vero è **peso corporeo (BW) + zavorra**.
- **Zavorra:** il peso aggiunto (disco alla cintura), quello che l'atleta prende dalla rastrelliera.
- **Carico totale:** BW + zavorra.

Un atleta di 80 kg che chiude una trazione con 50 kg di zavorra ha un 1RM di **130 kg**. Le
percentuali vanno calcolate su 130. Il trainer registra il massimale come carico totale.

Con un 5×3 al 75% il carico totale è 97,5 kg. L'atleta però deve sapere solo **quanta
zavorra caricare**: 97,5 − 80 = 17,5 kg. Decisione dell'utente: **all'atleta va mostrata
solo la zavorra**, ma i calcoli si fanno sul carico totale, così l'atleta non deve fare conti.

Questi esercizi hanno anche una tabella RPE diversa da Tuchscherer, fornita dall'utente.
Va usata nei calcoli e mostrata al trainer nella schermata massimali (sotto Tuchscherer)
e nella pagina di modifica del programma.

## Tabella trazioni zavorrate e dip

Percentuale del carico totale. Le colonne intere sono quelle fornite dall'utente, che
**fanno fede**. Le colonne a mezzo punto si generano come **media delle due colonne
intere vicine** (decisione dell'utente: "genera con proporzioni matematiche anche i
mezzi"). Esempio: 5 reps @ RPE 8,5 = (81 + 83) / 2 = 82%. Le colonne a mezzo punto vanno
precalcolate nella costante e mostrate in tabella, con al massimo una cifra decimale.

| Reps | RPE 10 | RPE 9 | RPE 8 | RPE 7 | RPE 6 |
|---|---|---|---|---|---|
| 1 | 100 | 94 | 91 | 88 | 86 |
| 2 | 94 | 91 | 88 | 86 | 83 |
| 3 | 91 | 88 | 86 | 83 | 81 |
| 4 | 88 | 86 | 83 | 81 | 79 |
| 5 | 86 | 83 | 81 | 79 | 77 |
| 6 | 83 | 81 | 79 | 77 | 75 |
| 7 | 81 | 79 | 77 | 75 | 73 |
| 8 | 79 | 77 | 75 | 73 | 71 |
| 9 | 77 | 75 | 73 | 71 | 70 |
| 10 | 75 | 73 | 71 | 70 | 68 |

Colonne risultanti: 10, 9,5, 9, 8,5, 8, 7,5, 7, 6,5, 6.

Note da mostrare sotto la tabella (testo corretto, la tabella fa fede):
- "Esempio: 5 ripetizioni a RPE 8 ≈ 81% (5 ripetizioni + 2 in riserva = 7 → 7 @ RPE 10 = 81%)."
- "Per ottenere la zavorra target: carico totale target − peso corporeo."
- "Stima pratica, non validata da ricerca. Gli ancoraggi RPE 10 sono quelli forniti; RPE
  inferiori aggiungono 1–4 ripetizioni in riserva; i mezzi punti sono la media delle
  colonne vicine. Oltre 10 ripetizioni, estensione Epley: 1RM = carico × (1 + ripetizioni/30)."

## Obiettivi

1. Flag `isBodyweightLoaded` sull'esercizio, impostabile dal form di creazione e modifica.
2. Per gli esercizi con il flag, l'1RM teorico (`normalizedOneRM`) e le percentuali RPE
   usano la tabella trazioni/dip, non Tuchscherer.
3. **L'atleta vede solo la zavorra**, ovunque compaia il peso di un esercizio con il flag.
   Il trainer vede carico totale + zavorra.
4. Tabelle per il trainer:
   - schermata massimali (`/trainer/trainees/[id]/records`): sotto `<RPEOneRMTable>`;
   - pagina di modifica programma: nuovo pulsante fisso che apre un pannello laterale con
     **entrambe** le tabelle (Tuchscherer + trazioni/dip).
5. L'atleta **non** vede la tabella trazioni/dip.

## Non-obiettivi

- Nessun calcolo automatico del massimale da zavorra + BW: il trainer registra il PR
  come carico totale (decisione dell'utente).
- Nessun riconoscimento automatico per nome dell'esercizio.
- Nessuna gestione dell'esercizio assistito (zavorra negativa con elastico/macchina) oltre
  al messaggio "corpo libero".
- Nessuna modifica alle metriche SBD (trazioni e dip non sono fondamentali).

## Modello dati

```prisma
model Exercise {
  // ...
  isBodyweightLoaded Boolean @default(false) // trazioni/dip zavorrati: PR e % su BW + zavorra
}
```

Migrazione: `ADD COLUMN "isBodyweightLoaded" BOOLEAN NOT NULL DEFAULT false`. Nessun
backfill: il trainer attiva il flag sugli esercizi giusti.

Peso corporeo: ultima misurazione `TraineeMeasurement` con `metric = weight` (per
data). Esiste già, con l'API `src/app/api/trainee-measurements/route.ts`.

## Regole di calcolo

### Tabella e 1RM

Nuova costante in `src/lib/calculations.ts`, es. `BODYWEIGHT_LOADED_RPE_CHART`, con reps
1–10 e RPE 10…6 a passi di 0,5 (mezzi punti precalcolati). Le funzioni che oggi leggono
`MIKE_TUCHSCHERER_RPE_CHART` (`estimateOneRMFromRpeTable`, `intensityFromRpeChart`,
`normalizedOneRM`) ricevono la tabella come parametro, oppure un flag. La firma la sceglie
l'implementatore. **Default = Tuchscherer**: i chiamanti esistenti non cambiano.

| Caso | Regola | Di chi |
|---|---|---|
| reps > 10 | Epley `carico × (1 + reps/30)` | utente (nota tabella) |
| RPE a mezzo punto | colonna precalcolata (media delle vicine) | utente |
| RPE < 6 | nessun calcolo RPE (fuori tabella) | designer |
| arrotondamento 1RM | come `normalizedOneRM` oggi (0,5 kg) | designer |

Ogni punto che chiama `normalizedOneRM(weight, reps)` sapendo l'esercizio deve passare il
flag. Elenco da verificare con grep: edit trainer (pannello PR, mappa 1RM), vista workout
trainer, review route, planned-training-sets route, mappa PR e `resolveEffectiveWeight` in
`calculations.ts`, pagine record trainee/trainer, `PersonalRecordsExplorer`, scheda trainee
(`trainer/trainees/[id]/_content.tsx`), pagina test (`trainer/programs/[id]/tests/_content.tsx`).
La funzione "PR più recente" della spec 1 deve ricevere il flag per esercizio.

### Cosa scrive il trainer e cosa si salva

Con il flag attivo, `effectiveWeight` vale sempre il **carico totale** quando deriva da una
percentuale, e la **zavorra** quando il trainer scrive kg. Tabella:

| Input trainer | Significato | `effectiveWeight` salvato | Atleta vede |
|---|---|---|---|
| `20` (kg) | **zavorra** 20 kg *(scelta del designer: è lo stesso numero che vede l'atleta)* | 20 (zavorra, come oggi `absolute`) | `zavorra 20 kg` |
| `75%` | 75% del 1RM (carico totale) | carico totale, es. 97,5 | `zavorra 97,5 − BW` |
| `-10%` | −10% sul **carico totale** della riga precedente (se la riga precedente è in kg = zavorra, la base è `zavorra + BW`) | carico totale | `zavorra totale − BW` |
| vuoto + RPE (spec 2) | range su carico totale | `rpeWeightMin/Max` su carico totale | `zavorra min–max` |

Per mantenere la distinzione basta `weightType`: `absolute` = zavorra, i tipi percentuale
= carico totale. Non servono nuove colonne.

### Zavorra mostrata

`zavorra = carico_totale − BW`. BW è l'**ultimo** peso corporeo registrato, letto **al
momento della visualizzazione** e non salvato. *Scelta del designer:* il carico totale è la
grandezza programmata. Se l'atleta dimagrisce, la zavorra giusta sale.

| Caso | Atleta | Trainer |
|---|---|---|
| zavorra > 0 | `zavorra 17,5 kg` | `97,5 kg totali · zavorra 17,5 kg` |
| zavorra ≤ 0 | `corpo libero` | `97,5 kg totali · corpo libero` |
| BW mancante | `chiedi al trainer` (nessun numero: il totale confonderebbe) | `97,5 kg totali` + avviso "peso corporeo non registrato" |
| range RPE | `zavorra 15,5–19 kg` (totale 95,5–99, BW 80) | totale + zavorra |

La zavorra si arrotonda per eccesso a 0,5 kg con `roundWeightValue`.

## UI

| Dove | Cosa | File |
|---|---|---|
| Form esercizio (nuovo, modifica, modale) | checkbox "Esercizio a corpo libero zavorrato (trazioni, dip)" + aiuto "Massimali e percentuali su peso corporeo + zavorra" | `trainer/exercises/new/_content.tsx`, `trainer/exercises/[id]/edit/_content.tsx`, `components/ExerciseCreateModal.tsx`, `src/schemas/exercise.ts`, `api/exercises` (create e update) |
| Schermata massimali trainer | sotto `<RPEOneRMTable>`: nuovo `components/BodyweightRPETable.tsx`, stesso stile collassabile e stessi colori per fascia | `trainer/trainees/[id]/records/_content.tsx:292` |
| Form registrazione PR (trainer) | per esercizi con il flag, etichetta peso "Carico totale (peso corporeo + zavorra)" | form PR nella schermata massimali |
| Pagina modifica programma | **nuovo pulsante fisso** sotto quello dei grafici (`edit/_content.tsx:4021`, `fixed top-24 left-6`), icona tabella (es. `Table` di lucide), apre un pannello laterale destro identico a `ProgramChartsDrawer` con `RPEOneRMTable` + `BodyweightRPETable` aperte | `edit/_content.tsx`, nuovo `components/RpeTablesDrawer.tsx` (stessa struttura di `ProgramChartsDrawer`) |
| Pagina modifica programma | anteprima peso: `= 97,5 kg totali · zavorra 17,5 kg`. Per input in kg: `zavorra 20 kg (100 totali)` | `edit/_content.tsx` |
| Vista workout trainee | solo zavorra (tabella sopra) | `trainee/workouts/[id]/_content.tsx` |
| Dettaglio programma trainee | solo zavorra | `ProgramDetailContent.tsx` |
| Review trainer, PDF | totale + zavorra | `review/_content.tsx`, `program-pdf-export.ts` |

Le API delle viste devono restituire `exercise.isBodyweightLoaded` e l'ultimo BW del
trainee (un valore per risposta, non per riga).

Ogni nuovo testo va in entrambi i locale `public/locales/{en,it}/`, preservando la codifica
dei file.

## Test

- `normalizedOneRM` con il flag: 110 × 3 → 110 / 0,91 = 120,9 → 121.
- Mezzo punto: 5 reps @ 8,5 → 82%.
- reps 11 con il flag → Epley.
- Senza flag nessun cambiamento: tutti i test Tuchscherer esistenti passano.
- Zavorra: positiva, ≤ 0, BW mancante; `-10%` con riga precedente in kg (base = zavorra + BW).
- Schema esercizio: accetta `isBodyweightLoaded`, default false.
- `BodyweightRPETable`: 10 righe × 9 colonne + note.
- Il pannello tabelle si apre e si chiude dal nuovo pulsante (test componente come quelli
  esistenti del drawer, se presenti).

## Scelte del designer da verificare

1. Il trainer che scrive kg intende la **zavorra**.
2. Flag esplicito sull'esercizio e non riconoscimento per nome.
3. BW = ultima misurazione, letta in visualizzazione e non congelata.
4. Zavorra ≤ 0 → "corpo libero". BW mancante → l'atleta non vede numeri.
5. RPE < 6 → nessun calcolo.
6. Il pulsante tabelle va sotto quello dei grafici, a sinistra, come quello esistente. Il
   pannello si apre da destra.
