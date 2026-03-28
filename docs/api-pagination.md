# API Pagination Strategy

**Documento**: Strategia paginazione API  
**Versione**: 1.0  
**Data**: 2026-03-28  

---

## Panoramica

Implementazione **cursor-based pagination** per endpoint con potenziale crescita illimitata. Strategia selettiva: solo endpoint con liste dinamiche che possono superare 100 record.

**Endpoints paginati**:
- ✅ `GET /api/exercises` — Lista esercizi (libreria condivisa, crescita > 500 esercizi)
- ❌ `GET /api/users` — Non paginato per MVP (max 54 utenti, crescita lenta)
- ❌ `GET /api/programs` — Non paginato per MVP (filtrato per trainer, ~10-50 schede per trainer)

---

## Cursor-Based Pagination

**Vantaggi vs Offset-Based**:
- Nessun problema con inserimenti/cancellazioni durante navigazione (no missed records, no duplicates)
- Performance costante anche con milioni di record (no `OFFSET 10000` scan)
- Indicizzabile efficacemente (cursor = ID univoco)

**Schema richiesta**:
```typescript
GET /api/exercises?cursor=<last-id>&limit=50&sortBy=name&order=asc
```

**Parametri query**:
- `cursor` (optional): ID ultimo elemento pagina precedente. Se omesso, ritorna prima pagina
- `limit` (optional): Max record per pagina. **Default**: 50, **Max**: 100
- `sortBy` (optional): Campo ordinamento. Valori: `name`, `createdAt`, `type`. **Default**: `name`
- `order` (optional): Direzione ordinamento. Valori: `asc`, `desc`. **Default**: `asc`

**Response schema**:
```typescript
{
  data: Exercise[],
  pagination: {
    nextCursor: string | null,  // ID per prossima pagina, null se ultima pagina
    hasMore: boolean,            // true se ci sono altre pagine
    totalCount: number,          // Totale record (opzionale, cache 5 min)
  }
}
```

---

## Implementazione Backend (Prisma)

### Endpoint: GET /api/exercises

**File**: `/app/api/exercises/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const querySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['name', 'createdAt', 'type']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
  type: z.enum(['fundamental', 'accessory']).optional(), // Filtro opzionale
  movementPatternId: z.string().uuid().optional(),       // Filtro opzionale
})

export async function GET(req: NextRequest) {
  try {
    // 1. Validazione query params
    const { searchParams } = new URL(req.url)
    const query = querySchema.parse({
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || 50,
      sortBy: searchParams.get('sortBy') || 'name',
      order: searchParams.get('order') || 'asc',
      type: searchParams.get('type') || undefined,
      movementPatternId: searchParams.get('movementPatternId') || undefined,
    })

    // 2. Build WHERE clause per filtri
    const where: any = {}
    if (query.type) where.type = query.type
    if (query.movementPatternId) where.movementPatternId = query.movementPatternId

    // 3. Query paginata con Prisma cursor
    const exercises = await prisma.exercise.findMany({
      where,
      take: query.limit + 1, // +1 per verificare hasMore
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0, // Skip cursor stesso
      orderBy: { [query.sortBy]: query.order },
      include: {
        movementPattern: true,
        exerciseMuscleGroups: {
          include: {
            muscleGroup: true,
          },
        },
      },
    })

    // 4. Determina hasMore e nextCursor
    const hasMore = exercises.length > query.limit
    const data = hasMore ? exercises.slice(0, -1) : exercises
    const nextCursor = hasMore ? exercises[exercises.length - 2].id : null

    // 5. (Opzionale) Totale record count — cache 5 min
    // Per performance, evitare COUNT(*) su ogni richiesta
    // Calcolare solo per prima pagina e cachare
    let totalCount: number | undefined
    if (!query.cursor) {
      totalCount = await prisma.exercise.count({ where })
    }

    return NextResponse.json({
      data,
      pagination: {
        nextCursor,
        hasMore,
        totalCount,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    console.error('GET /api/exercises error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

## Client-Side Implementation (TanStack Query)

**File**: `/lib/api/exercises.ts`

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'

interface Exercise {
  id: string
  name: string
  type: 'fundamental' | 'accessory'
  // ... altri campi
}

interface PaginatedResponse {
  data: Exercise[]
  pagination: {
    nextCursor: string | null
    hasMore: boolean
    totalCount?: number
  }
}

interface UseExercisesParams {
  type?: 'fundamental' | 'accessory'
  movementPatternId?: string
  sortBy?: 'name' | 'createdAt' | 'type'
  order?: 'asc' | 'desc'
}

export function useExercises(params: UseExercisesParams = {}) {
  return useInfiniteQuery<PaginatedResponse>({
    queryKey: ['exercises', params],
    queryFn: async ({ pageParam = undefined }) => {
      const searchParams = new URLSearchParams({
        limit: '50',
        ...(pageParam && { cursor: pageParam }),
        ...(params.type && { type: params.type }),
        ...(params.movementPatternId && { movementPatternId: params.movementPatternId }),
        ...(params.sortBy && { sortBy: params.sortBy }),
        ...(params.order && { order: params.order }),
      })

      const res = await fetch(`/api/exercises?${searchParams}`)
      if (!res.ok) throw new Error('Failed to fetch exercises')
      return res.json()
    },
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    initialPageParam: undefined,
  })
}
```

**Component con infinite scroll**:

```tsx
'use client'

import { useExercises } from '@/lib/api/exercises'
import { useInView } from 'react-intersection-observer'
import { useEffect } from 'react'

export default function ExerciseList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useExercises({
    sortBy: 'name',
    order: 'asc',
  })

  const { ref, inView } = useInView()

  // Auto-fetch quando scroll raggiunge fine lista
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading) return <div>Caricamento...</div>

  const exercises = data?.pages.flatMap((page) => page.data) ?? []
  const totalCount = data?.pages[0]?.pagination.totalCount

  return (
    <div>
      {totalCount && (
        <p className="text-sm text-gray-600">
          Totale esercizi: {totalCount}
        </p>
      )}

      <ul className="space-y-2">
        {exercises.map((exercise) => (
          <li key={exercise.id} className="p-4 border rounded">
            <h3>{exercise.name}</h3>
            <span className="text-xs bg-blue-100 px-2 py-1 rounded">
              {exercise.type}
            </span>
          </li>
        ))}
      </ul>

      {/* Infinite scroll trigger */}
      <div ref={ref} className="h-20 flex items-center justify-center">
        {isFetchingNextPage && <span>Caricamento...</span>}
        {!hasNextPage && exercises.length > 0 && (
          <span className="text-gray-500">Fine lista</span>
        )}
      </div>
    </div>
  )
}
```

---

## Filtri e Ricerca

### Filtri tipizzati (dropdown)

**Esempio**: Filtro per tipo esercizio

```tsx
const [selectedType, setSelectedType] = useState<'fundamental' | 'accessory' | undefined>()

const { data } = useExercises({
  type: selectedType,
})

<select onChange={(e) => setSelectedType(e.target.value as any)}>
  <option value="">Tutti</option>
  <option value="fundamental">Fondamentali</option>
  <option value="accessory">Accessori</option>
</select>
```

---

### Ricerca testuale (nome esercizio)

**Backend**: Aggiungere parametro `search` a query schema

```typescript
const querySchema = z.object({
  // ...
  search: z.string().optional(), // Ricerca per nome esercizio
})

// WHERE clause
if (query.search) {
  where.name = {
    contains: query.search,
    mode: 'insensitive', // Case-insensitive
  }
}
```

**Frontend**: Debounced search input

```tsx
import { useState } from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const [searchTerm, setSearchTerm] = useState('')
const debouncedSearch = useDebouncedValue(searchTerm, 300) // 300ms debounce

const { data } = useExercises({
  search: debouncedSearch,
})

<input
  type="text"
  placeholder="Cerca esercizio..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
/>
```

**Hook utility**: `/hooks/useDebouncedValue.ts`

```typescript
import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
```

---

## Performance Considerations

### 1. Indici Database

Assicurarsi che colonne usate per `sortBy` e filtri siano indicizzate:

```prisma
model Exercise {
  // ...
  
  @@index([name])           // Sort/ricerca per nome
  @@index([type])           // Filtro tipo
  @@index([createdAt])      // Sort per data creazione
  @@index([movementPatternId]) // Filtro pattern motorio
}
```

---

### 2. Cache `totalCount`

**Problema**: `COUNT(*)` su tabella grande è costoso (O(n) scan).

**Soluzione A**: Cache Redis (5 min TTL)

```typescript
import { redis } from '@/lib/redis'

const cacheKey = `exercises:count:${JSON.stringify(where)}`
let totalCount = await redis.get(cacheKey)

if (!totalCount) {
  totalCount = await prisma.exercise.count({ where })
  await redis.setex(cacheKey, 300, totalCount) // TTL 5 min
}
```

**Soluzione B**: Approssimazione con `pg_class.reltuples`

```sql
SELECT reltuples::bigint AS estimate 
FROM pg_class 
WHERE relname = 'exercises';
```

Ritorna stima veloce (non precisa) senza scan completo.

---

### 3. Prefetch Next Page

TanStack Query supporta prefetch automatico:

```typescript
export function useExercises(params: UseExercisesParams = {}) {
  return useInfiniteQuery({
    // ...
    staleTime: 1000 * 60 * 5, // Cache 5 min
    prefetchNextPage: true,   // Prefetch automatico pagina successiva
  })
}
```

Migliora UX precaricando dati prima che l'utente scrolli.

---

## Testing

### Unit Test (Backend)

```typescript
import { GET } from '@/app/api/exercises/route'
import { NextRequest } from 'next/server'

describe('GET /api/exercises', () => {
  it('should return first page with limit=10', async () => {
    const req = new NextRequest('http://localhost/api/exercises?limit=10')
    const res = await GET(req)
    const json = await res.json()

    expect(json.data).toHaveLength(10)
    expect(json.pagination.hasMore).toBe(true)
    expect(json.pagination.nextCursor).toBeDefined()
  })

  it('should return next page with cursor', async () => {
    const req1 = new NextRequest('http://localhost/api/exercises?limit=10')
    const res1 = await GET(req1)
    const json1 = await res1.json()

    const nextCursor = json1.pagination.nextCursor

    const req2 = new NextRequest(`http://localhost/api/exercises?cursor=${nextCursor}&limit=10`)
    const res2 = await GET(req2)
    const json2 = await res2.json()

    expect(json2.data).toHaveLength(10)
    expect(json2.data[0].id).not.toBe(json1.data[0].id) // Prima pagina diversa
  })
})
```

---

### E2E Test (Playwright)

```typescript
import { test, expect } from '@playwright/test'

test('should load exercises with infinite scroll', async ({ page }) => {
  await page.goto('/exercises')

  // Prima pagina caricata
  await expect(page.locator('[data-testid="exercise-item"]')).toHaveCount(50)

  // Scroll to bottom per trigger infinite scroll
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

  // Aspetta caricamento pagina successiva
  await page.waitForTimeout(1000)

  // Verifica che siano stati caricati più di 50 esercizi
  const count = await page.locator('[data-testid="exercise-item"]').count()
  expect(count).toBeGreaterThan(50)
})
```

---

## Endpoints Futuri (Post-MVP)

| Endpoint             | Paginato? | Rationale                                                       |
| -------------------- | --------- | --------------------------------------------------------------- |
| `GET /api/users`     | ✅         | Solo se > 500 utenti. Fino a 500, response completa accettabile |
| `GET /api/programs`  | ❌         | Filtrato per trainer, max ~50 schede per trainer                |
| `GET /api/feedbacks` | ✅         | Storico feedback trainee può crescere > 1000 record             |
| `GET /api/records`   | ✅         | Massimali trainee, potenziale crescita > 500 record             |

---

## Checklist Pre-Deploy Pagination

- [x] Cursor-based pagination implementata su `GET /api/exercises`
- [x] Query params validati con Zod (cursor, limit, sortBy, order)
- [x] Response schema con `nextCursor`, `hasMore`, `totalCount`
- [x] Indici database per `name`, `type`, `createdAt`, `movementPatternId`
- [x] Frontend con TanStack Query `useInfiniteQuery`
- [x] Infinite scroll con `react-intersection-observer`
- [x] Debounced search input per ricerca testuale
- [x] Unit test per prima pagina e pagina successiva
- [x] E2E test per infinite scroll
- [ ] Cache Redis per `totalCount` (opzionale, solo se > 1000 esercizi)

---

## Riferimenti

- [TanStack Query Infinite Queries](https://tanstack.com/query/latest/docs/react/guides/infinite-queries)
- [Prisma Cursor-Based Pagination](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)
- [react-intersection-observer](https://github.com/thebuilder/react-intersection-observer)
