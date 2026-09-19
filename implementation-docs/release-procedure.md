# 🚀 Procedura di Release

Procedura operativa per portare il lavoro da un feature branch fino alla produzione.

Modello a due branch: **`development`** (test/staging) e **`master`** (produzione). I feature branch nascono sempre da `development`.

```
feature/xxx  →  development  →  master
hotfix/xxx   →  master + development (backport)
```

---

## Scelta consapevole: merge diretti, non Pull Request

Questa procedura usa **merge fast-forward locali seguiti da push diretto**, non Pull Request.

Va detto esplicitamente cosa si perde, perché la scelta sia informata e non accidentale:

- **Nessuna review obbligatoria.** Nessuno guarda il codice prima che arrivi in `development` o in produzione.
- **Nessun gate di CI.** Non esiste un controllo automatico che blocchi il merge se lint, type-check o test falliscono. I controlli vanno eseguiti a mano, prima (vedi checklist).
- **Nessuna discussione tracciata.** Il "perché" di una modifica vive solo nei messaggi di commit e nel CHANGELOG, non in un thread di PR.

In cambio si ottiene velocità e nessuna dipendenza da permessi GitHub. Se il progetto cresce oltre una persona, questa scelta va rivista.

---

## 1. Prima di iniziare

Verifiche da eseguire **sul feature branch**, prima di toccare `development`:

```bash
npm run lint
npm run type-check
npm run test:unit
```

- [ ] Lint e type-check puliti
- [ ] I test che coprono il lavoro svolto sono verdi
- [ ] Fallimenti preesistenti e non correlati: identificati e documentati, non ignorati in silenzio
- [ ] `implementation-docs/CHANGELOG.md` aggiornato

**Se una migration è coinvolta:** verifica che sia applicata al database di sviluppo e registrata in `_prisma_migrations`. Uno schema Prisma avanti rispetto al database produce errori a runtime che i test **non intercettano**, perché la suite mocka `@/lib/prisma` e non tocca mai un database reale.

---

## 2. Merge su `development`

```bash
git stash push -m "wip"                 # solo se hai modifiche non committate
git checkout development
git pull --ff-only
git merge --ff-only feature/nome-branch
git push origin development
git stash pop                           # se avevi stashato
```

**Perché `--ff-only` ovunque:** se lo stato remoto è cambiato sotto, il comando **fallisce invece di fabbricare un merge commit** a sorpresa. Un fallimento qui è un'informazione, non un intoppo: significa che qualcosa è cambiato e va guardato.

**Perché lo stash:** le modifiche non committate seguono i checkout tra branch e possono far rifiutare il cambio, o peggio mescolarsi al lavoro. Stashale prima, recuperale dopo.

Se `--ff-only` fallisce, il feature branch è indietro rispetto a `development`. Rebase e ripeti:

```bash
git checkout feature/nome-branch
git rebase development
```

---

## 3. Verifica in ambiente di test

`development` fa deploy sull'ambiente di test. **Questo passaggio non si salta.**

- [ ] La funzionalità si comporta come previsto, verificata a mano nell'app reale
- [ ] Se il lavoro tocca permessi o dati condivisi, provalo con **due account distinti**, non con uno solo
- [ ] Nessuna regressione visibile nelle aree adiacenti

La suite di test è interamente mockata: non prova che l'applicazione funzioni davvero contro un database. Solo questa verifica lo fa.

---

## 4. Migration sul database di produzione

**Da fare PRIMA del push su `master`, mai dopo.**

`master` fa deploy in produzione. Se lo schema del database di produzione non ha ancora le colonne che il codice si aspetta, l'applicazione va in errore al primo utilizzo.

- [ ] Migration applicata al database di **produzione**
- [ ] Riga corrispondente presente in `_prisma_migrations`

Se la migration viene eseguita a mano (console SQL) invece che con `prisma migrate`, Prisma non la registra e il comando successivo tenterà di riapplicarla — fallendo, o proponendo un **reset del database**. Registrala:

```bash
npx prisma migrate resolve --applied <nome_migration>
```

oppure, senza connettività CLI, inserendo a mano la riga in `_prisma_migrations` con il checksum SHA-256 del file `migration.sql`.

---

## 5. Release su `master`

```bash
git checkout master
git pull --ff-only
git merge --ff-only development
git push origin master
```

### Tag

Obbligatorio dopo ogni release, per tracciabilità.

```bash
git describe --tags --abbrev=0        # vedi l'ultimo tag
git tag vX.Y.Z
git push origin vX.Y.Z
```

Versionamento: **minor** (`v1.1.0` → `v1.2.0`) per nuove funzionalità, **patch** (`v1.1.0` → `v1.1.1`) per correzioni.

> **Controlla sempre i tag remoti prima di sceglierne uno.** `git tag -l` mostra solo i tag **locali**: se il clone non è aggiornato sembrerà che non esista alcun tag. Esegui prima `git fetch --tags`.

### Cosa finisce davvero in produzione

```bash
git log --oneline master..development
```

`development` può contenere lavoro accumulato da più cicli. La release porta in produzione **tutto** quello che c'è, non solo l'ultima feature. Guarda l'elenco prima di spingere.

---

## Hotfix

Bug in produzione che non può aspettare il ciclo normale:

```bash
git checkout -b hotfix/nome master
# correggi, committa
git checkout master && git merge --ff-only hotfix/nome && git push origin master
git checkout development && git merge --ff-only hotfix/nome && git push origin development
```

Il backport su `development` **non è opzionale**: senza, il branch resta indietro e la correzione viene persa alla release successiva.

---


## Regole

| Regola | Motivo |
|---|---|
| I feature branch nascono da `development`, mai da `master` | Evita divergenza tra i due branch |
| `development` deve restare sempre deployabile | È l'ambiente di test di tutti |
| Migration in produzione **prima** del push su `master` | Il codice che precede lo schema va in errore a runtime |
| Tag su `master` dopo ogni release | Tracciabilità; senza, non sai cosa c'è in produzione |
| Hotfix sempre backportato su `development` | Tiene i due branch allineati |
| `--ff-only` su ogni merge e pull | Un fallimento segnala una divergenza invece di nasconderla |

## Errori frequenti

| Errore | Conseguenza |
|---|---|
| Feature branch creato da `master` | Porta in `development` commit che non dovrebbero esserci |
| Push su `master` prima della migration | Errori a runtime in produzione |
| Tag scelto senza `git fetch --tags` | Collisione con un tag esistente, o numerazione incoerente |
| Saltare la verifica in ambiente di test | I test mockati non provano che l'app funzioni davvero |
| `git merge` senza `--ff-only` | Merge commit inatteso che nasconde una divergenza |
| Checkout con modifiche non committate | Cambio branch rifiutato, o modifiche mescolate al lavoro sbagliato |
