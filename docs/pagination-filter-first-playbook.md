# Pagination Playbook: Filter-First + Numeric Pages

Version: 1.0
Date: 2026-05-30

## Obiettivo

Definire una linea guida unica per implementare paginazione numerata in schermate lista, mantenendo:
- Filtri applicati lato API prima della paginazione
- Coerenza con RBAC
- Contratto API stabile e riusabile
- Test coverage su schema, route, contract e UI

Questo playbook e basato sull implementazione completata per trainer/programs.

## Quando usare questo approccio

Usa questo pattern quando:
- La lista puo superare 20-30 record
- Hai filtri (status, search, owner) che devono essere accurati su dataset completo
- Vuoi navigazione pagina 1..N (First/Previous/Next/Last)
- Devi evitare mismatch tra conteggi tab e lista mostrata

## Principio chiave

Ordine corretto:
1. Validazione query
2. RBAC + filtri
3. Count dataset filtrato
4. Calcolo pagina richiesta
5. Query pagina

In breve: filter-first, pagination-second.

## Contratto API consigliato

### Query params
- status: opzionale
- search: opzionale (2-100 caratteri)
- page: opzionale, default 1
- limit: opzionale, default 20
- eventuali filtri risorsa (trainerId, traineeId, type, ecc.)

### Response shape
- items: elementi della pagina
- statusCounts: conteggi per tab (se presenti in UI)
- pagination:
  - currentPage
  - totalPages
  - totalItems
  - limit
  - hasMore
  - nextCursor

Nota: mantenere hasMore/nextCursor aiuta retrocompatibilita con consumer legacy cursor-based.

## Implementazione backend: ricetta

### 1) Schema query in src/schemas
- Aggiungi schema filtro con coercion numerica:
  - page >= 1
  - limit >= 1 e max ragionevole
- Valida status enum e id uuid dove necessario

### 2) Parsing e validazione route
- Parsing da searchParams in oggetto filterParams
- safeParse con schema filtro
- Su errore: apiError VALIDATION_ERROR con key validation.invalidFilterParams

### 3) Build where con RBAC
- Costruisci baseWhere in base al ruolo
- Applica filtri ownership nel where principale
- Applica search su campi utili (es. titolo e nome/cognome entita collegata)

### 4) Applica filtro lista
- Crea listWhere = baseWhere + filtro tab (es. status)
- Questo e il where che userai per count e lista

### 5) Count e metadata pagina
- Esegui count totale su listWhere
- Se la UI ha tab, calcola anche i count per ciascuno stato (con baseWhere)
- totalPages = max(1, ceil(totalItems / limit))
- resolvedPage = min(page, totalPages)
- skip = (resolvedPage - 1) * limit

### 6) Query lista
- findMany con:
  - where: listWhere
  - orderBy stabile
  - take: limit + 1
  - skip: skip
- Opzionale legacy:
  - se cursor presente e page non passato, usa branch cursor-based (skip 1 + cursor)

### 7) Envelope finale
- hasMore = records.length > limit
- items = hasMore ? records.slice(0, limit) : records
- nextCursor = hasMore ? items[items.length - 1].id : null
- Return apiSuccess con items, statusCounts e pagination completa

## Implementazione frontend: ricetta

### 1) Stato client minimo
- items pagina corrente
- currentPage
- totalPages
- totalItems
- activeTab
- searchTerm
- statusCounts
- loading, error

### 2) Fetch server-side
- Costruisci URLSearchParams con:
  - status=activeTab
  - page=currentPage
  - limit=fisso (es. 20)
  - search solo se lunghezza >= 2
- Non filtrare localmente il dataset gia paginato

### 3) Reset pagina su cambio filtri
- Cambio tab: setCurrentPage(1)
- Cambio search: setCurrentPage(1)

### 4) Paginatore numerato
- Mostra First/Previous/numero pagine/Next/Last
- Limita finestra numeri visibili (es. 5)
- Disabilita bottoni ai bordi (prima/ultima pagina)

### 5) Edge case delete
- Se dopo delete la pagina corrente torna vuota ma totalItems > 0:
  - fallback automatico a pagina precedente

## Test strategy minima

### Unit
- Schema filtro query: default, coercion, limiti invalidi
- Componente lista: request include status/page/limit, navigazione numerata

### Integration
- Route GET:
  - filtri applicati nel where prima della paginazione
  - skip/take corretti per pagina
  - metadata currentPage/totalPages/totalItems
  - invalid page -> 400

### Contract
- Endpoint paginato espone pagination completa
- statusCounts presente se usato dalla UI

## Checklist riusabile per nuove schermate

1. Definire query schema filtro in src/schemas
2. Validare query in route con safeParse
3. Applicare RBAC e filtri in where
4. Eseguire count su dataset filtrato
5. Implementare skip/take pagina con orderBy stabile
6. Restituire items + pagination metadata + counts tab (se necessari)
7. Aggiornare frontend con stato pagina e fetch server-side
8. Resettare pagina su ogni cambio filtro
9. Implementare paginatore numerato con disable states
10. Coprire con unit/integration/contract test
11. Aggiornare docs e changelog

## Riferimenti implementativi

- docs/api-contracts.md
- docs/api-pagination.md
- src/schemas/program.ts
- src/app/api/programs/route.ts
- src/app/trainer/programs/_content.tsx
- tests/unit/schemas.test.ts
- tests/unit/trainer-programs-content.test.tsx
- tests/integration/programs.test.ts
- tests/integration/api-contracts.test.ts

## Pitfall da evitare

- Filtrare lato client dopo aver paginato lato server
- Calcolare conteggi tab dai soli item della pagina corrente
- Non resettare la pagina a 1 quando cambia filtro
- Usare orderBy non stabile (rischio salti/duplicati tra pagine)
- Non gestire pagina fuori range (page > totalPages)
