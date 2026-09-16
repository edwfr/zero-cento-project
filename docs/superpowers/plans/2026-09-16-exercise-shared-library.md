# Libreria Esercizi Condivisa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ogni trainer può modificare qualsiasi esercizio della libreria; l'eliminazione è permessa solo se l'esercizio non è referenziato da nulla; ogni modifica registra chi l'ha fatta e quando.

**Architecture:** Tre cambi indipendenti sullo stesso route handler `src/app/api/exercises/[id]/route.ts`. (1) Due colonne audit nullable su `Exercise` (`updatedBy`, `updatedAt`) con FK verso `users`, scritte manualmente insieme nell'unico write path esistente. (2) Rimozione dei due check `createdBy !== session.user.id` su PUT e DELETE — allinea il codice al commento già presente in `prisma/schema.prisma:169` (`createdBy` = solo audit trail, NON determina ownership). (3) Sostituzione del guard "programma attivo" del DELETE con un guard su tutte le referenze FK non-cascade (`WorkoutExercise`, `WorkoutSkeleton`, `PersonalRecord`), risolto con una singola query `_count` invece del `findMany` con join a 4 livelli attuale.

**Tech Stack:** Next.js 15 App Router, Prisma 5.18 + PostgreSQL (Supabase), Zod, Vitest (jsdom), react-i18next.

**Spec:** nessun file di spec — task bounded, design concordato in sessione. Il design è riassunto integralmente nella sezione "Design concordato" qui sotto; gli executor leggono quella.

## Global Constraints

- **Ruolo admin invariato.** L'admin poteva già fare tutto: nessun check su admin va aggiunto o tolto.
- **`createdBy` resta.** Non si rimuove la colonna né la relation `creator`. Diventa puro audit trail di creazione, non determina più nessun permesso.
- **Nessun cambio frontend.** Nessun componente `.tsx` fa gating su `createdBy`, e l'interfaccia TS `Exercise` in `src/app/trainer/exercises/[id]/edit/_content.tsx:30` non dichiara `creator`/`updater` — i campi extra nella response sono ignorati strutturalmente. Non toccare file `.tsx` in questo piano.
- **Chiavi i18n sempre in coppia.** Ogni aggiunta/rimozione va fatta identica in `public/locales/en/errors.json` e `public/locales/it/errors.json`.
- **CHANGELOG obbligatorio.** Regola di `CLAUDE.md`: ogni task aggiorna `implementation-docs/CHANGELOG.md` prima del commit, come entry sotto `## [Unreleased]` → `### Changed`.
- **Formato API invariato.** Usa sempre `apiSuccess(data, status?)` / `apiError(code, message, status, details?, key?)` da `src/lib/api-response.ts`. Il 5° argomento `key` è la chiave i18n.
- **Coverage.** `src/app/api/exercises/[id]/route.ts` è nella lista coverage di `vitest.config.ts:33`, soglia 80%. Non abbassarla.
- **Comando test di riferimento:** `npx vitest run tests/integration/exercises.test.ts`
- **Colonne DB in camelCase.** Il model `Exercise` non usa `@map` sui campi (vedi `prisma/schema.prisma:165-183`): le colonne Postgres si chiamano letteralmente `"createdBy"`, `"createdAt"`. Le nuove colonne saranno `"updatedBy"`, `"updatedAt"`, non snake_case.

## Design concordato

**Prima (comportamento attuale):**
- PUT `/api/exercises/[id]` → 403 `exercise.modifyDenied` se `session.user.role === 'trainer' && existing.createdBy !== session.user.id`
- DELETE `/api/exercises/[id]` → 403 `exercise.deleteDenied` con la stessa condizione; poi 409 solo se l'esercizio è usato in un programma con `status: 'active'`
- Bug latente: se l'esercizio è usato in un programma `draft`/`completed`, o in uno skeleton, o in un personal record, il guard lo lascia passare e la `prisma.exercise.delete` viola la FK non-cascade → 500.

**Dopo:**
- PUT: nessun check di ownership. Scrive `updatedBy` + `updatedAt`.
- DELETE: nessun check di ownership. 409 `exercise.cannotDeleteReferenced` se **una qualsiasi** delle tre referenze è > 0. Delete consentito solo a zero referenze.
- GET `[id]` e la response di PUT includono `updater`. La **lista** GET `/api/exercises` NON lo include (evita un LEFT JOIN in più su una query già a 4 join).

**File toccati:**

| File | Responsabilità del cambio |
|---|---|
| `prisma/schema.prisma` | 3 campi su `Exercise` + back-relation su `User` |
| `prisma/migrations/<ts>_add_exercise_update_audit/migration.sql` | 2 colonne nullable + index + FK |
| `src/app/api/exercises/[id]/route.ts` | rimozione dei 2 check, write audit, include `updater`, nuovo guard delete |
| `public/locales/{en,it}/errors.json` | +1 chiave, -3 chiavi orfane |
| `tests/integration/exercises.test.ts` | inversione/riscrittura test ownership + nuovi test guard referenze |
| `implementation-docs/CHANGELOG.md` | una entry per task |

---

### Task 1: Colonne audit su Exercise (schema + migration)

Nessun cambio di comportamento API. Deliverable: le colonne esistono, il client Prisma le tipizza, il progetto compila.

**Files:**
- Modify: `prisma/schema.prisma:165-183` (model `Exercise`), `prisma/schema.prisma:77-80` (relations su `User`)
- Create: `prisma/migrations/<timestamp>_add_exercise_update_audit/migration.sql` (generata da Prisma)
- Modify: `implementation-docs/CHANGELOG.md`

**Interfaces:**
- Consumes: niente (primo task)
- Produces: campi Prisma `Exercise.updatedBy: string | null`, `Exercise.updatedAt: Date | null`, relation `Exercise.updater: User | null` (relation name `"UpdatedExercises"`). I Task 2 e 3 dipendono da questi nomi esatti.

- [ ] **Step 1: Aggiungere i campi al model `Exercise`**

In `prisma/schema.prisma`, nel model `Exercise`, subito dopo la riga `createdAt DateTime @default(now())`:

```prisma
  updatedBy         String?      // Chi ha modificato per ultimo (null = mai modificato)
  updatedAt         DateTime?    // Settato manualmente insieme a updatedBy, NON @updatedAt
```

E nel blocco `// Relations` dello stesso model, subito dopo la riga `creator User @relation("CreatedExercises", ...)`:

```prisma
  updater              User?                  @relation("UpdatedExercises", fields: [updatedBy], references: [id])
```

E nel blocco degli indici, prima di `@@map("exercises")`, aggiungere:

```prisma
  @@index([updatedBy])
```

> **Perché non `@updatedAt`:** l'attributo Prisma `@updatedAt` si aggiorna su *qualsiasi* update, incluse eventuali data migration o script che non passano dal PUT. In quei casi `updatedAt` cambierebbe ma `updatedBy` resterebbe fermo sul valore vecchio: coppia incoerente, peggio di nessun audit. Settandoli manualmente insieme restano sempre allineati.

- [ ] **Step 2: Aggiungere la back-relation su `User`**

Prisma rifiuta una relation senza il lato opposto. In `prisma/schema.prisma`, nel blocco `// Relations` del model `User`, subito dopo la riga `createdExercises Exercise[] @relation("CreatedExercises")` (riga 79):

```prisma
  updatedExercises         Exercise[]                   @relation("UpdatedExercises")
```

- [ ] **Step 3: Validare lo schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

Se fallisce con `Error validating field 'updater'`, la back-relation dello Step 2 manca o ha il nome sbagliato: deve essere esattamente `"UpdatedExercises"` in entrambi i punti.

- [ ] **Step 4: Generare la migration**

Run: `npm run prisma:migrate -- --name add_exercise_update_audit`

Richiede `DIRECT_URL` (porta 5432 diretta, non la 6543 pooled) nel `.env` — vedi `CLAUDE.md`. Il comando crea la cartella, scrive `migration.sql` e la applica al DB di sviluppo.

- [ ] **Step 5: Verificare il contenuto della migration generata**

Aprire `prisma/migrations/<timestamp>_add_exercise_update_audit/migration.sql` e confrontare con quanto atteso:

```sql
-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "updatedAt" TIMESTAMP(3),
ADD COLUMN     "updatedBy" TEXT;

-- CreateIndex
CREATE INDEX "exercises_updatedBy_idx" ON "exercises"("updatedBy");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Tre cose da verificare, in ordine di importanza:
1. **Entrambe le colonne sono nullable** (nessun `NOT NULL`, nessun `DEFAULT`). Righe esistenti restano `NULL` = "mai modificato". Nessun backfill, nessun lock lungo, nessun downtime.
2. **Le colonne sono in camelCase quotato** (`"updatedBy"`, non `"updated_by"`). Se Prisma ha generato snake_case, qualcuno ha aggiunto un `@map` per errore nello Step 1: rimuoverlo e rigenerare.
3. **La FK è `ON DELETE SET NULL`** — è il default Prisma per una relation opzionale. Significa che cancellare un utente non cancella gli esercizi che ha modificato, azzera solo il riferimento. Corretto.

- [ ] **Step 6: Rigenerare il client Prisma e verificare i tipi**

Run: `npm run prisma:generate && npm run type-check`
Expected: entrambi escono con exit code 0, nessun errore TypeScript.

- [ ] **Step 7: Verificare che i test esistenti non siano rotti**

Run: `npx vitest run tests/integration/exercises.test.ts`
Expected: PASS su tutti i test. Questo task non cambia nessun comportamento API — se qualcosa fallisce qui, è una regressione da schema, non un test da aggiornare.

- [ ] **Step 8: Aggiornare il CHANGELOG**

In `implementation-docs/CHANGELOG.md`, sotto `## [Unreleased]` → `### Changed`, inserire come prima entry:

```markdown
### [16 Settembre 2026] — Campi audit modifica su Exercise

**File modificati:** `prisma/schema.prisma`, `prisma/migrations/<timestamp>_add_exercise_update_audit/migration.sql`, `implementation-docs/CHANGELOG.md`
**Note:** Aggiunti i campi nullable `updatedBy` e `updatedAt` al model `Exercise`, con relation `updater` verso `User` e indice su `updatedBy`. Servono a tracciare chi ha modificato un esercizio e quando, prerequisito all'apertura della libreria esercizi a tutti i trainer. Migration additiva: le righe esistenti restano a `NULL` (mai modificate), nessun backfill richiesto. `updatedAt` viene settato manualmente insieme a `updatedBy` e non usa `@updatedAt`, per evitare che i due campi divergano su update che non passano dall'API.
```

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations implementation-docs/CHANGELOG.md
git commit -m "feat(exercises): add updatedBy/updatedAt audit fields to Exercise"
```

---

### Task 2: PUT — libreria condivisa in scrittura + registrazione audit

**Files:**
- Modify: `src/app/api/exercises/[id]/route.ts` — GET `[id]` (include `updater`), PUT (rimozione check riga 93-96, write audit, include `updater`)
- Test: `tests/integration/exercises.test.ts` — sostituzione test riga 664, nuovi test
- Modify: `implementation-docs/CHANGELOG.md`

**Interfaces:**
- Consumes: da Task 1 — `Exercise.updatedBy`, `Exercise.updatedAt`, relation `updater`
- Produces: la response di GET `[id]` e di PUT contiene `exercise.updater` come `{ id: string, firstName: string, lastName: string } | null` e `exercise.updatedAt` come `Date | null`

- [ ] **Step 1: Sostituire il test di ownership PUT con il suo opposto**

In `tests/integration/exercises.test.ts`, sostituire **interamente** il test che inizia a riga 664 (`it('trainer cannot update exercise created by another trainer (403)', ...)`) con:

```ts
    it('trainer can update exercise created by another trainer (shared library)', async () => {
        const otherTrainerExercise = {
            ...mockExerciseWithRelations,
            createdBy: 'other-trainer-uuid',
        }
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(otherTrainerExercise as any)
        vi.mocked(prisma.exercise.findFirst).mockResolvedValue(null)
        vi.mocked(prisma.movementPattern.findUnique).mockResolvedValue(mockMovementPattern as any)
        vi.mocked(prisma.muscleGroup.findMany).mockResolvedValue(mockMuscleGroups as any)
        vi.mocked(prisma.exercise.update).mockResolvedValue(otherTrainerExercise as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
    })

    it('records updatedBy and updatedAt when a trainer updates an exercise', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(mockExerciseWithRelations as any)
        vi.mocked(prisma.exercise.findFirst).mockResolvedValue(null)
        vi.mocked(prisma.movementPattern.findUnique).mockResolvedValue(mockMovementPattern as any)
        vi.mocked(prisma.muscleGroup.findMany).mockResolvedValue(mockMuscleGroups as any)
        vi.mocked(prisma.exercise.update).mockResolvedValue(mockExerciseWithRelations as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        })
        await updateExercise(req, withIdParam(EX_ID_1))

        expect(prisma.exercise.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    updatedBy: 'trainer-uuid-1',
                    updatedAt: expect.any(Date),
                }),
            })
        )
    })
```

> `mockTrainerSession.user.id` vale `'trainer-uuid-1'` (vedi `tests/integration/fixtures.ts`). `updatePayload` è già definito nel `describe('PUT /api/exercises/[id]')` a riga 594.

- [ ] **Step 2: Aggiungere il test sull'`updater` nel GET dettaglio**

Nel `describe('GET /api/exercises/[id]')` (riga 340), dopo il test `'returns single exercise with all nested relations'`, aggiungere:

```ts
    it('includes the updater in the exercise detail response', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue({
            ...mockExerciseWithRelations,
            updatedBy: 'trainer-uuid-2',
            updatedAt: new Date('2026-09-16'),
            updater: { id: 'trainer-uuid-2', firstName: 'Luca', lastName: 'Coach' },
        } as any)

        const req = makeDetailRequest(EX_ID_1)
        const res = await getExercise(req, withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.exercise.updater).toEqual({
            id: 'trainer-uuid-2',
            firstName: 'Luca',
            lastName: 'Coach',
        })
        expect(prisma.exercise.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                include: expect.objectContaining({
                    updater: { select: { id: true, firstName: true, lastName: true } },
                }),
            })
        )
    })
```

- [ ] **Step 3: Eseguire i test per verificare che falliscano**

Run: `npx vitest run tests/integration/exercises.test.ts`
Expected: FAIL su 3 test —
- `trainer can update exercise created by another trainer (shared library)` → `expected 403 to be 200`
- `records updatedBy and updatedAt...` → l'oggetto `data` passato a `update` non contiene `updatedBy`
- `includes the updater in the exercise detail response` → `json.data.exercise.updater` è `undefined`

- [ ] **Step 4: Rimuovere il check di ownership dal PUT**

In `src/app/api/exercises/[id]/route.ts`, eliminare queste 4 righe (93-96):

```ts
        // Check ownership: trainers can only modify their own exercises, admins can modify any
        if (session.user.role === 'trainer' && existing.createdBy !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify exercises you created', 403, undefined, 'exercise.modifyDenied')
        }
```

Non rimuovere il blocco `if (!existing)` che sta sopra: serve ancora per il 404.

- [ ] **Step 5: Aggiornare la docstring del PUT**

Sempre in `src/app/api/exercises/[id]/route.ts`, sostituire la riga 66:

```ts
 * Update exercise (trainer can only update their own exercises, admin can update any)
```

con:

```ts
 * Update exercise (shared library: any trainer or admin can update any exercise).
 * Records updatedBy/updatedAt for audit — createdBy stays as creation audit only.
```

- [ ] **Step 6: Scrivere i campi audit nella update**

Nella chiamata `prisma.exercise.update` (riga ~151), dentro l'oggetto `data`, subito dopo `notes: notes || [],` e prima di `exerciseMuscleGroups: {`:

```ts
                updatedBy: session.user.id,
                updatedAt: new Date(),
```

- [ ] **Step 7: Includere `updater` nella response del PUT**

Nella stessa chiamata `prisma.exercise.update`, dentro il blocco `include`, subito dopo il blocco `creator: { select: { id: true, firstName: true, lastName: true } },`:

```ts
                updater: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
```

- [ ] **Step 8: Includere `updater` nella response del GET dettaglio**

Nella `prisma.exercise.findUnique` della funzione `GET` (riga ~20), dentro il blocco `include`, subito dopo il blocco `creator: { select: { id: true, firstName: true, lastName: true } },` (riga 42-48):

```ts
                updater: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
```

> **Non toccare** `src/app/api/exercises/route.ts` (la lista). L'`updater` resta fuori dalla GET lista di proposito: quella query fa già 4 join su un endpoint paginato.

- [ ] **Step 9: Eseguire i test per verificare che passino**

Run: `npx vitest run tests/integration/exercises.test.ts`
Expected: PASS su tutti i test, inclusi i 3 dello Step 3 e `admin can update any exercise regardless of creator` (riga 682), che deve restare verde.

- [ ] **Step 10: Aggiornare il CHANGELOG**

In `implementation-docs/CHANGELOG.md`, sotto `## [Unreleased]` → `### Changed`, come prima entry:

```markdown
### [16 Settembre 2026] — Modifica esercizi aperta a tutti i trainer

**File modificati:** `src/app/api/exercises/[id]/route.ts`, `tests/integration/exercises.test.ts`, `implementation-docs/CHANGELOG.md`
**Note:** Rimosso il check di ownership sul PUT `/api/exercises/[id]`: la libreria esercizi è condivisa, qualsiasi trainer può modificare qualsiasi esercizio. Il vincolo precedente contraddiceva il commento già presente in `prisma/schema.prisma` (`createdBy` = solo audit trail, NON determina ownership) e produceva una UX rotta, perché nessun componente frontend nascondeva il bottone Modifica: il trainer cliccava e riceveva un 403. Ogni update registra ora `updatedBy` e `updatedAt`; l'`updater` è incluso nella response del GET dettaglio e del PUT, ma non nella GET lista per non aggiungere un join a una query paginata già pesante.
```

- [ ] **Step 11: Commit**

```bash
git add src/app/api/exercises/\[id\]/route.ts tests/integration/exercises.test.ts implementation-docs/CHANGELOG.md
git commit -m "feat(exercises): allow any trainer to update library exercises"
```

---

### Task 3: DELETE — libreria condivisa + guard su tutte le referenze

**Files:**
- Modify: `src/app/api/exercises/[id]/route.ts` — DELETE (rimozione check riga ~229, sostituzione guard righe ~237-275)
- Modify: `public/locales/en/errors.json`, `public/locales/it/errors.json` — nuova chiave `exercise.cannotDeleteReferenced`
- Test: `tests/integration/exercises.test.ts` — riscrittura del `describe('DELETE /api/exercises/[id]')` (riga 743)
- Modify: `implementation-docs/CHANGELOG.md`

**Interfaces:**
- Consumes: da Task 2 — route handler `DELETE` senza check di ownership sul PUT (indipendente, ma stesso file: eseguire dopo Task 2 per evitare conflitti)
- Produces: DELETE risponde 409 con `key: 'exercise.cannotDeleteReferenced'` e `details: { workoutExercises: number, workoutSkeletons: number, personalRecords: number, programId?: string, programName?: string }`

- [ ] **Step 1: Aggiungere `findFirst` al mock di `workoutExercise`**

In `tests/integration/exercises.test.ts`, nel blocco `vi.mock('@/lib/prisma', ...)` (riga ~17), sostituire:

```ts
        workoutExercise: {
            findMany: vi.fn(),
        },
```

con:

```ts
        workoutExercise: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
```

- [ ] **Step 2: Aggiungere l'helper per le fixture di conteggio**

Nella sezione `// Helpers` di `tests/integration/exercises.test.ts` (riga ~152), dopo `makeDetailRequest`:

```ts
/** Exercise as the DELETE handler selects it: id + reference counts. */
function makeCountedExercise(
    counts: Partial<{ workoutExercises: number; workoutSkeletons: number; personalRecords: number }> = {}
) {
    return {
        id: EX_ID_1,
        _count: {
            workoutExercises: 0,
            workoutSkeletons: 0,
            personalRecords: 0,
            ...counts,
        },
    }
}
```

- [ ] **Step 3: Riscrivere il blocco di test DELETE**

In `tests/integration/exercises.test.ts`, sostituire **i primi quattro test** del `describe('DELETE /api/exercises/[id]')` — cioè da `it('trainer can delete their own exercise when not in active program', ...)` (riga 748) fino alla fine di `it('trainer cannot delete exercise created by another trainer (403)', ...)` (riga ~835 incluso) — con:

```ts
    it('trainer can delete an exercise with no references', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(makeCountedExercise() as any)
        vi.mocked(prisma.exercise.delete).mockResolvedValue(mockExerciseWithRelations as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
        expect(prisma.exercise.delete).toHaveBeenCalledWith({ where: { id: EX_ID_1 } })
    })

    it('trainer can delete an unreferenced exercise created by another trainer', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(makeCountedExercise() as any)
        vi.mocked(prisma.exercise.delete).mockResolvedValue({
            ...mockExerciseWithRelations,
            createdBy: 'other-trainer-uuid',
        } as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
    })

    it('returns 409 when the exercise is used in a program, whatever its status', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(
            makeCountedExercise({ workoutExercises: 3 }) as any
        )
        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue({
            workout: {
                week: {
                    program: {
                        id: '66666666-6666-6666-6666-666666666662',
                        title: 'Old Program',
                    },
                },
            },
        } as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('exercise.cannotDeleteReferenced')
        expect(json.error.details.programName).toBe('Old Program')
        expect(prisma.exercise.delete).not.toHaveBeenCalled()
    })

    it('returns 409 when the exercise is only referenced by a program skeleton', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(
            makeCountedExercise({ workoutSkeletons: 1 }) as any
        )
        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(null)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('exercise.cannotDeleteReferenced')
        expect(prisma.exercise.delete).not.toHaveBeenCalled()
    })

    it('returns 409 when the exercise is only referenced by a personal record', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(
            makeCountedExercise({ personalRecords: 2 }) as any
        )
        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(null)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('exercise.cannotDeleteReferenced')
        expect(prisma.exercise.delete).not.toHaveBeenCalled()
    })
```

> I test `'returns 404 when exercise to delete does not exist'` e `'admin can delete exercise created by any trainer'` restano dove sono — il secondo va però aggiornato nello Step 4.

- [ ] **Step 4: Aggiornare la fixture del test admin**

Il test `it('admin can delete exercise created by any trainer', ...)` è l'ultimo del `describe` DELETE e non è stato toccato dallo Step 3 (i suoi numeri di riga sono però scalati verso l'alto, perché sopra sono stati rimossi quattro test). Al suo interno, sostituire le due righe:

```ts
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(otherTrainerExercise as any)
        vi.mocked(prisma.workoutExercise.findMany).mockResolvedValue([])
```

con:

```ts
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(makeCountedExercise() as any)
```

La dichiarazione `const otherTrainerExercise = {...}` in cima a quel test resta: serve ancora per `prisma.exercise.delete.mockResolvedValue`.

- [ ] **Step 5: Eseguire i test per verificare che falliscano**

Run: `npx vitest run tests/integration/exercises.test.ts`
Expected: FAIL sui 5 nuovi test DELETE. Il motivo tipico è `TypeError: Cannot read properties of undefined (reading 'find')` — l'handler attuale chiama ancora `prisma.workoutExercise.findMany`, che ora non è più mockato con un array.

- [ ] **Step 6: Aggiungere la chiave i18n inglese**

In `public/locales/en/errors.json`, nell'oggetto `"exercise"`, sostituire la riga:

```json
        "cannotDeleteInActiveProgram": "Cannot delete exercise: it is used in an active program"
```

con:

```json
        "cannotDeleteInActiveProgram": "Cannot delete exercise: it is used in an active program",
        "cannotDeleteReferenced": "Cannot delete this exercise: it is still used in programs or trainee records"
```

- [ ] **Step 7: Aggiungere la chiave i18n italiana**

In `public/locales/it/errors.json`, nell'oggetto `"exercise"`, sostituire la riga:

```json
        "cannotDeleteInActiveProgram": "Impossibile eliminare l'esercizio: è utilizzato in un programma attivo"
```

con:

```json
        "cannotDeleteInActiveProgram": "Impossibile eliminare l'esercizio: è utilizzato in un programma attivo",
        "cannotDeleteReferenced": "Impossibile eliminare questo esercizio: è ancora utilizzato in programmi o record degli atleti"
```

> La chiave vecchia `cannotDeleteInActiveProgram` resta per ora — viene rimossa nel Task 4, insieme alle altre orfane.

- [ ] **Step 8: Riscrivere il corpo del DELETE**

In `src/app/api/exercises/[id]/route.ts`, sostituire tutto il corpo della funzione `DELETE` — dalla riga `const session = await requireRole(['admin', 'trainer'])` fino alla riga `})` che chiude `prisma.exercise.delete`, cioè le righe ~218-280 — con:

```ts
        const session = await requireRole(['admin', 'trainer'])

        // Single query: existence check + reference counts.
        // No ownership check: the exercise library is shared across all trainers.
        const exercise = await prisma.exercise.findUnique({
            where: { id: exerciseId },
            select: {
                id: true,
                _count: {
                    select: {
                        workoutExercises: true,
                        workoutSkeletons: true,
                        personalRecords: true,
                    },
                },
            },
        })

        if (!exercise) {
            return apiError('NOT_FOUND', 'Exercise not found', 404, undefined, 'exercise.notFound')
        }

        // All three FKs are non-cascade, so any surviving reference would turn
        // the delete into a foreign key violation. Block on every one of them.
        const { workoutExercises, workoutSkeletons, personalRecords } = exercise._count
        const totalReferences = workoutExercises + workoutSkeletons + personalRecords

        if (totalReferences > 0) {
            // Slow path, only on conflict: name one referencing program in the message
            const sample = await prisma.workoutExercise.findFirst({
                where: { exerciseId },
                select: {
                    workout: {
                        select: {
                            week: {
                                select: {
                                    program: { select: { id: true, title: true } },
                                },
                            },
                        },
                    },
                },
            })
            const program = sample?.workout?.week?.program

            return apiError(
                'CONFLICT',
                program
                    ? `Cannot delete exercise: it is referenced by program "${program.title}"`
                    : 'Cannot delete exercise: it is still referenced',
                409,
                {
                    workoutExercises,
                    workoutSkeletons,
                    personalRecords,
                    ...(program ? { programId: program.id, programName: program.title } : {}),
                },
                'exercise.cannotDeleteReferenced'
            )
        }

        // Delete exercise (cascade will delete exerciseMuscleGroups relationships)
        await prisma.exercise.delete({
            where: { id: exerciseId },
        })
```

Le righe successive (`logger.info`, `return apiSuccess({...})`, il `catch`) restano invariate.

> **Perché `_count` e non il `findMany` di prima:** il codice precedente caricava ogni `WorkoutExercise` con un join annidato `workout → week → program` e poi filtrava in JavaScript. Ora una sola query conta tre relazioni lato DB, e il join serve solo nel ramo di conflitto.

- [ ] **Step 9: Aggiornare la docstring del DELETE**

Sostituire la riga 210:

```ts
 * Delete exercise (cannot delete if used in active WorkoutExercises)
```

con:

```ts
 * Delete exercise (shared library: any trainer or admin can delete).
 * Only allowed when the exercise has zero references: WorkoutExercise,
 * WorkoutSkeleton and PersonalRecord all use non-cascade FKs.
```

- [ ] **Step 10: Eseguire i test per verificare che passino**

Run: `npx vitest run tests/integration/exercises.test.ts`
Expected: PASS su tutti i test del file, inclusi i 5 nuovi, il 404 e il test admin.

- [ ] **Step 11: Aggiornare il CHANGELOG**

In `implementation-docs/CHANGELOG.md`, sotto `## [Unreleased]` → `### Changed`, come prima entry:

```markdown
### [16 Settembre 2026] — Eliminazione esercizi: aperta a tutti i trainer, bloccata se referenziato

**File modificati:** `src/app/api/exercises/[id]/route.ts`, `public/locales/en/errors.json`, `public/locales/it/errors.json`, `tests/integration/exercises.test.ts`, `implementation-docs/CHANGELOG.md`
**Note:** Rimosso il check di ownership sul DELETE `/api/exercises/[id]` e sostituito il guard "programma attivo" con un guard su tutte le referenze. Il guard precedente controllava solo i programmi con `status: 'active'` e lasciava passare l'eliminazione di esercizi usati in programmi draft o completati, negli skeleton dei programmi e nei personal record: essendo tutte FK non-cascade, la delete falliva con una violazione di chiave esterna e l'utente riceveva un 500. Ora l'eliminazione è consentita solo a zero referenze e restituisce 409 `exercise.cannotDeleteReferenced` altrimenti. Il conteggio usa una singola query `_count` invece del `findMany` con join a quattro livelli precedente; il join serve solo nel ramo di conflitto, per nominare un programma nel messaggio.
```

- [ ] **Step 12: Commit**

```bash
git add src/app/api/exercises/\[id\]/route.ts public/locales tests/integration/exercises.test.ts implementation-docs/CHANGELOG.md
git commit -m "feat(exercises): allow shared deletion, block when exercise is referenced"
```

---

### Task 4: Rimozione chiavi i18n orfane

**Files:**
- Modify: `public/locales/en/errors.json`, `public/locales/it/errors.json`
- Modify: `implementation-docs/CHANGELOG.md`

**Interfaces:**
- Consumes: da Task 2 e 3 — nessun `apiError` cita più `exercise.modifyDenied`, `exercise.deleteDenied`, `exercise.cannotDeleteInActiveProgram`
- Produces: niente

- [ ] **Step 1: Verificare che le tre chiavi siano davvero orfane**

Run:
```bash
grep -rn "exercise.modifyDenied\|exercise.deleteDenied\|exercise.cannotDeleteInActiveProgram" \
  --include="*.ts" --include="*.tsx" . --exclude-dir=node_modules --exclude-dir=.next
```
Expected: nessun output.

Se compare qualcosa, i Task 2 o 3 sono incompleti: fermarsi e completarli prima di procedere.

> Attenzione: `feedback.modifyDenied` e `program.modifyDenied` esistono e sono chiavi diverse, ancora usate. Il grep sopra è volutamente prefissato con `exercise.` — non rimuovere le omonime di altri namespace.

- [ ] **Step 2: Rimuovere le chiavi dal file inglese**

In `public/locales/en/errors.json`, l'oggetto `"exercise"` deve risultare esattamente:

```json
    "exercise": {
        "notFound": "Exercise not found",
        "nameExists": "An exercise with this name already exists",
        "deletedSuccess": "Exercise deleted successfully",
        "cannotDeleteReferenced": "Cannot delete this exercise: it is still used in programs or trainee records"
    },
```

- [ ] **Step 3: Rimuovere le chiavi dal file italiano**

In `public/locales/it/errors.json`, l'oggetto `"exercise"` deve risultare esattamente:

```json
    "exercise": {
        "notFound": "Esercizio non trovato",
        "nameExists": "Un esercizio con questo nome esiste già",
        "deletedSuccess": "Esercizio eliminato con successo",
        "cannotDeleteReferenced": "Impossibile eliminare questo esercizio: è ancora utilizzato in programmi o record degli atleti"
    },
```

- [ ] **Step 4: Verificare che i due JSON siano validi e con le stesse chiavi**

Run:
```bash
node -e "const en=require('./public/locales/en/errors.json'),it=require('./public/locales/it/errors.json');const a=Object.keys(en.exercise).sort(),b=Object.keys(it.exercise).sort();console.log(a.join(','));if(a.join()!==b.join())throw new Error('EN/IT key mismatch');console.log('OK')"
```
Expected:
```
cannotDeleteReferenced,deletedSuccess,nameExists,notFound
OK
```

- [ ] **Step 5: Verifica finale completa**

Run: `npm run type-check && npm run lint && npx vitest run tests/integration/exercises.test.ts`
Expected: tutti e tre exit code 0.

Poi la suite intera, per escludere regressioni altrove:

Run: `npm run test:unit -- --run`
Expected: PASS, coverage ≥ 80% sui file elencati in `vitest.config.ts`.

- [ ] **Step 6: Aggiornare il CHANGELOG**

In `implementation-docs/CHANGELOG.md`, sotto `## [Unreleased]` → `### Changed`, come prima entry:

```markdown
### [16 Settembre 2026] — Pulizia chiavi i18n esercizi non più usate

**File modificati:** `public/locales/en/errors.json`, `public/locales/it/errors.json`, `implementation-docs/CHANGELOG.md`
**Note:** Rimosse le chiavi `exercise.modifyDenied`, `exercise.deleteDenied` e `exercise.cannotDeleteInActiveProgram`, rimaste orfane dopo l'apertura della libreria esercizi a tutti i trainer e la sostituzione del guard di eliminazione. Le omonime in altri namespace (`feedback.modifyDenied`, `program.modifyDenied`) restano in uso e non sono state toccate.
```

- [ ] **Step 7: Commit**

```bash
git add public/locales implementation-docs/CHANGELOG.md
git commit -m "chore(i18n): drop orphaned exercise permission error keys"
```

---

## Verifica manuale post-implementazione

Dopo il Task 4, con `npm run dev`, con due account trainer distinti:

1. Trainer A crea un esercizio nuovo, non usato in nessun programma.
2. Trainer B apre `/trainer/exercises`, modifica quell'esercizio → deve salvare senza errori (prima dava "Puoi modificare solo gli esercizi che hai creato").
3. Trainer B elimina lo stesso esercizio → deve riuscire.
4. Trainer B prova a eliminare un esercizio usato in un qualsiasi programma, anche archiviato o in bozza → deve vedere il messaggio 409 "Impossibile eliminare questo esercizio: è ancora utilizzato...", **non** un errore generico (che indicherebbe un 500 da violazione FK).
5. Su Prisma Studio (`npm run prisma:studio`), tabella `exercises`: la riga modificata al punto 2 deve avere `updatedBy` = id di Trainer B e `updatedAt` valorizzato.

## Fuori scope (deliberato)

- **Visualizzazione dell'audit nella UI.** Oggi nessun componente `.tsx` renderizza nemmeno `creator`, e la label `trainer:createdBy` ("Creato da") nei file di locale è già orfana. Mostrare "Modificato da X il Y" richiede lavoro UI e due nuove chiavi i18n: è un intervento separato.
- **Audit log con before/after.** Due colonne registrano *chi* e *quando*, non *cosa* è cambiato. Una tabella di audit completa serve solo se emerge il bisogno di ricostruire le modifiche — YAGNI per ora.
- **Versioning degli esercizi.** Resta il fatto che modificare un esercizio cambia retroattivamente i programmi di tutti i trainer, inclusi quelli completati, perché `WorkoutExercise` referenzia `exerciseId` senza copiare i dati. È la conseguenza accettata della scelta "libreria condivisa".
