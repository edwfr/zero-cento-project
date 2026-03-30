# 📋 CHANGELOG - ZeroCento Training Platform

Registro cronologico degli sviluppi effettuati.  
**Checklist task pendenti:** [CHECKLIST.md](./CHECKLIST.md)  
**Review sistema:** [SYSTEM_REVIEW.md](../SYSTEM_REVIEW.md)

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

**Stato raggiunto:** ~58% completamento complessivo

---

### [30 Marzo 2026] — System Review & riorganizzazione documentazione

**Cosa è stato fatto:**
- Creato [SYSTEM_REVIEW.md](../SYSTEM_REVIEW.md) — review completo del sistema con stato per area, issue sicurezza, backlog prioritizzato
- Aggiornato [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) — percentuali corrette (da ~40% dichiarato a ~58% reale)
- Riscritto [NEXT_ACTIONS.md](./NEXT_ACTIONS.md) — rimossi task già completati, aggiunto backlog reale con effort
- Aggiornato [README.md](./README.md) — indice file aggiornato, stato corretto
- Creato [CHECKLIST.md](./CHECKLIST.md) — checklist sviluppo con 49 task in 8 sprint
- Creato questo file [CHANGELOG.md](./CHANGELOG.md)

**Note:** La documentazione precedente dichiarava ~40% di completamento; l'analisi reale del codice ha rilevato ~58%. Le percentuali sono ora allineate in tutti i file.

---

## Prossime entry

<!-- Copia il template sotto per registrare il prossimo sviluppo -->

<!--
### [GG Mese AAAA] — Titolo
**Task checklist:** #X.Y  
**File modificati:** `...`  
**Note:** ...
-->
