import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

import { GET as getMovementPatterns, POST as postMovementPattern } from '@/app/api/movement-patterns/route'
import { GET as getMuscleGroups, POST as postMuscleGroup } from '@/app/api/muscle-groups/route'
import { GET as getMovementPattern, PUT as putMovementPattern, DELETE as deleteMovementPattern } from '@/app/api/movement-patterns/[id]/route'
import { PATCH as archiveMovementPattern } from '@/app/api/movement-patterns/[id]/archive/route'
import { GET as getMuscleGroup, PUT as putMuscleGroup, DELETE as deleteMuscleGroup } from '@/app/api/muscle-groups/[id]/route'
import { PATCH as archiveMuscleGroup } from '@/app/api/muscle-groups/[id]/archive/route'
import { GET as getColors, PUT as putColors } from '@/app/api/movement-pattern-colors/route'
import { prismaMock } from '../helpers/prisma-mock'
import { mockTrainerSession, mockAdminSession } from '../helpers/sessions'
import { asTrainer, asAdmin, asUnauthenticated, asForbidden } from '../helpers/auth-mock'

function makeRequest(url: string, options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as never)
}

function jsonRequest(url: string, method: string, body: unknown) {
    return makeRequest(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

const withParams = (params: Record<string, string>) => ({ params: Promise.resolve(params) })

// ─── Movement Patterns ────────────────────────────────────────────────────────

describe('GET /api/movement-patterns', () => {
    beforeEach(() => { vi.clearAllMocks() })

    const mockPatterns = [
        { id: 'mp-1', name: 'Spinta Orizzontale', isActive: true, creator: { firstName: 'Marco', lastName: 'T' } },
        { id: 'mp-2', name: 'Tirata Verticale', isActive: true, creator: { firstName: 'Marco', lastName: 'T' } },
    ]

    it('returns active movement patterns for authenticated user', async () => {
        asTrainer()
        prismaMock.movementPattern.findMany.mockResolvedValue(mockPatterns as never)

        const req = makeRequest('http://localhost:3000/api/movement-patterns')
        const res = await getMovementPatterns(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(2)
    })

    it('includes inactive patterns when includeInactive=true', async () => {
        asAdmin()
        prismaMock.movementPattern.findMany.mockResolvedValue(mockPatterns as never)

        const req = makeRequest('http://localhost:3000/api/movement-patterns?includeInactive=true')
        await getMovementPatterns(req)

        expect(prismaMock.movementPattern.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: undefined })
        )
    })

    it('returns 401 when not authenticated', async () => {asUnauthenticated()

        const req = makeRequest('http://localhost:3000/api/movement-patterns')
        const res = await getMovementPatterns(req)
        expect(res.status).toBe(401)
    })
})

describe('POST /api/movement-patterns', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('creates a new movement pattern as trainer', async () => {
        asTrainer()
        prismaMock.movementPattern.findUnique.mockResolvedValue(null)
        prismaMock.movementPattern.create.mockResolvedValue({
            id: 'mp-new',
            name: 'Squat Pattern',
            isActive: true,
        } as never)

        const req = makeRequest('http://localhost:3000/api/movement-patterns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Squat Pattern' }),
        })

        const res = await postMovementPattern(req)
        expect(res.status).toBe(201)
    })

    it('returns 409 when pattern name already exists', async () => {
        asTrainer()
        prismaMock.movementPattern.findUnique.mockResolvedValue({
            id: 'existing', name: 'Squat Pattern',
        } as never)

        const req = makeRequest('http://localhost:3000/api/movement-patterns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Squat Pattern' }),
        })

        const res = await postMovementPattern(req)
        expect(res.status).toBe(409)
    })

    it('returns 400 for validation error (name too short)', async () => {
        asTrainer()

        const req = makeRequest('http://localhost:3000/api/movement-patterns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'X' }),
        })

        const res = await postMovementPattern(req)
        expect(res.status).toBe(400)
    })
})

// ─── Muscle Groups ────────────────────────────────────────────────────────────

describe('GET /api/muscle-groups', () => {
    beforeEach(() => { vi.clearAllMocks() })

    const mockGroups = [
        { id: 'mg-1', name: 'Pettorali', isActive: true, creator: { firstName: 'Marco', lastName: 'T' } },
        { id: 'mg-2', name: 'Dorsali', isActive: true, creator: { firstName: 'Marco', lastName: 'T' } },
    ]

    it('returns active muscle groups for authenticated user', async () => {
        asTrainer()
        prismaMock.muscleGroup.findMany.mockResolvedValue(mockGroups as never)

        const req = makeRequest('http://localhost:3000/api/muscle-groups')
        const res = await getMuscleGroups(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(2)
    })

    it('includes inactive groups when includeInactive=true', async () => {
        asAdmin()
        prismaMock.muscleGroup.findMany.mockResolvedValue(mockGroups as never)

        const req = makeRequest('http://localhost:3000/api/muscle-groups?includeInactive=true')
        await getMuscleGroups(req)

        expect(prismaMock.muscleGroup.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: undefined })
        )
    })

    it('returns 401 when not authenticated', async () => {asUnauthenticated()

        const req = makeRequest('http://localhost:3000/api/muscle-groups')
        const res = await getMuscleGroups(req)
        expect(res.status).toBe(401)
    })
})

describe('POST /api/muscle-groups', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('creates a new muscle group as trainer', async () => {
        asTrainer()
        prismaMock.muscleGroup.findUnique.mockResolvedValue(null)
        prismaMock.muscleGroup.create.mockResolvedValue({
            id: 'mg-new',
            name: 'Quadricipiti',
            isActive: true,
        } as never)

        const req = makeRequest('http://localhost:3000/api/muscle-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Quadricipiti' }),
        })

        const res = await postMuscleGroup(req)
        expect(res.status).toBe(201)
    })

    it('returns 409 when group name already exists', async () => {
        asTrainer()
        prismaMock.muscleGroup.findUnique.mockResolvedValue({
            id: 'existing', name: 'Quadricipiti',
        } as never)

        const req = makeRequest('http://localhost:3000/api/muscle-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Quadricipiti' }),
        })

        const res = await postMuscleGroup(req)
        expect(res.status).toBe(409)
    })

    it('returns 400 for validation error (name too short)', async () => {
        asTrainer()

        const req = makeRequest('http://localhost:3000/api/muscle-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'X' }),
        })

        const res = await postMuscleGroup(req)
        expect(res.status).toBe(400)
    })
})

// ─── Movement Pattern detail ──────────────────────────────────────────────────

const MP_ID = '11111111-1111-4111-8111-111111111111'
const MG_ID = '22222222-2222-4222-8222-222222222222'

describe('GET /api/movement-patterns/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    it('returns the pattern with its creator', async () => {
        prismaMock.movementPattern.findUnique.mockResolvedValue({
            id: MP_ID,
            name: 'Spinta Orizzontale',
            creator: { firstName: 'Marco', lastName: 'T' },
        } as never)

        const res = await getMovementPattern(makeRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}`), withParams({ id: MP_ID }))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.movementPattern).toMatchObject({ id: MP_ID, name: 'Spinta Orizzontale' })
    })

    it('returns 404 when the pattern does not exist', async () => {
        prismaMock.movementPattern.findUnique.mockResolvedValue(null)

        const res = await getMovementPattern(makeRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}`), withParams({ id: MP_ID }))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('movementPattern.notFound')
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await getMovementPattern(makeRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}`), withParams({ id: MP_ID }))

        expect(res.status).toBe(401)
        expect(prismaMock.movementPattern.findUnique).not.toHaveBeenCalled()
    })

    it('returns 500 when the query fails', async () => {
        prismaMock.movementPattern.findUnique.mockRejectedValue(new Error('db down'))

        const res = await getMovementPattern(makeRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}`), withParams({ id: MP_ID }))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('PUT /api/movement-patterns/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    it('updates the pattern', async () => {
        prismaMock.movementPattern.update.mockResolvedValue({ id: MP_ID, name: 'Spinta Verticale' } as never)

        const res = await putMovementPattern(
            jsonRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}`, 'PUT', { name: 'Spinta Verticale' }),
            withParams({ id: MP_ID })
        )
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.movementPattern).toMatchObject({ id: MP_ID, name: 'Spinta Verticale' })
        expect(prismaMock.movementPattern.update).toHaveBeenCalledWith({
            where: { id: MP_ID },
            data: { name: 'Spinta Verticale' },
        })
    })

    it('returns 400 when the name is too short', async () => {
        const res = await putMovementPattern(
            jsonRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}`, 'PUT', { name: 'X' }),
            withParams({ id: MP_ID })
        )
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.invalidInput')
        expect(prismaMock.movementPattern.update).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainee', async () => {
        asForbidden()

        const res = await putMovementPattern(
            jsonRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}`, 'PUT', { name: 'Spinta Verticale' }),
            withParams({ id: MP_ID })
        )

        expect(res.status).toBe(403)
        expect(prismaMock.movementPattern.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update fails', async () => {
        prismaMock.movementPattern.update.mockRejectedValue(new Error('db down'))

        const res = await putMovementPattern(
            jsonRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}`, 'PUT', { name: 'Spinta Verticale' }),
            withParams({ id: MP_ID })
        )
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('DELETE /api/movement-patterns/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    it('deletes a pattern no exercise uses', async () => {
        prismaMock.exercise.count.mockResolvedValue(0)
        prismaMock.movementPattern.delete.mockResolvedValue({ id: MP_ID } as never)

        const res = await deleteMovementPattern(makeRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}`, { method: 'DELETE' }), withParams({ id: MP_ID }))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.messageKey).toBe('movementPattern.deletedSuccess')
        expect(prismaMock.movementPattern.delete).toHaveBeenCalledWith({ where: { id: MP_ID } })
    })

    it('returns 409 when the pattern is still in use', async () => {
        prismaMock.exercise.count.mockResolvedValue(3)

        const res = await deleteMovementPattern(makeRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}`, { method: 'DELETE' }), withParams({ id: MP_ID }))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error.key).toBe('movementPattern.cannotDeleteInUse')
        expect(prismaMock.movementPattern.delete).not.toHaveBeenCalled()
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await deleteMovementPattern(makeRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}`, { method: 'DELETE' }), withParams({ id: MP_ID }))

        expect(res.status).toBe(401)
        expect(prismaMock.movementPattern.delete).not.toHaveBeenCalled()
    })

    it('returns 500 when the delete fails', async () => {
        prismaMock.exercise.count.mockResolvedValue(0)
        prismaMock.movementPattern.delete.mockRejectedValue(new Error('db down'))

        const res = await deleteMovementPattern(makeRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}`, { method: 'DELETE' }), withParams({ id: MP_ID }))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('PATCH /api/movement-patterns/[id]/archive', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    it('archives the pattern', async () => {
        prismaMock.movementPattern.update.mockResolvedValue({ id: MP_ID, isActive: false } as never)

        const res = await archiveMovementPattern(makeRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}/archive`, { method: 'PATCH' }), withParams({ id: MP_ID }))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.movementPattern).toMatchObject({ id: MP_ID, isActive: false })
        expect(prismaMock.movementPattern.update).toHaveBeenCalledWith({
            where: { id: MP_ID },
            data: { isActive: false },
        })
    })

    it('returns 403 for a trainee', async () => {
        asForbidden()

        const res = await archiveMovementPattern(makeRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}/archive`, { method: 'PATCH' }), withParams({ id: MP_ID }))

        expect(res.status).toBe(403)
        expect(prismaMock.movementPattern.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update fails', async () => {
        prismaMock.movementPattern.update.mockRejectedValue(new Error('db down'))

        const res = await archiveMovementPattern(makeRequest(`http://localhost:3000/api/movement-patterns/${MP_ID}/archive`, { method: 'PATCH' }), withParams({ id: MP_ID }))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

// ─── Muscle Group detail ──────────────────────────────────────────────────────

describe('GET /api/muscle-groups/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    it('returns the muscle group with its creator', async () => {
        prismaMock.muscleGroup.findUnique.mockResolvedValue({
            id: MG_ID,
            name: 'Pettorali',
            creator: { firstName: 'Marco', lastName: 'T' },
        } as never)

        const res = await getMuscleGroup(makeRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}`), withParams({ id: MG_ID }))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.muscleGroup).toMatchObject({ id: MG_ID, name: 'Pettorali' })
    })

    it('returns 404 when the muscle group does not exist', async () => {
        prismaMock.muscleGroup.findUnique.mockResolvedValue(null)

        const res = await getMuscleGroup(makeRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}`), withParams({ id: MG_ID }))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('muscleGroup.notFound')
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await getMuscleGroup(makeRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}`), withParams({ id: MG_ID }))

        expect(res.status).toBe(401)
        expect(prismaMock.muscleGroup.findUnique).not.toHaveBeenCalled()
    })

    it('returns 500 when the query fails', async () => {
        prismaMock.muscleGroup.findUnique.mockRejectedValue(new Error('db down'))

        const res = await getMuscleGroup(makeRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}`), withParams({ id: MG_ID }))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('PUT /api/muscle-groups/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asAdmin()
    })

    it('updates the muscle group', async () => {
        prismaMock.muscleGroup.update.mockResolvedValue({ id: MG_ID, name: 'Dorsali' } as never)

        const res = await putMuscleGroup(
            jsonRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}`, 'PUT', { name: 'Dorsali' }),
            withParams({ id: MG_ID })
        )
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.muscleGroup).toMatchObject({ id: MG_ID, name: 'Dorsali' })
        expect(prismaMock.muscleGroup.update).toHaveBeenCalledWith({
            where: { id: MG_ID },
            data: { name: 'Dorsali' },
        })
    })

    it('returns 400 when the name is too short', async () => {
        const res = await putMuscleGroup(
            jsonRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}`, 'PUT', { name: 'X' }),
            withParams({ id: MG_ID })
        )
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.invalidInput')
        expect(prismaMock.muscleGroup.update).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainee', async () => {
        asForbidden()

        const res = await putMuscleGroup(
            jsonRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}`, 'PUT', { name: 'Dorsali' }),
            withParams({ id: MG_ID })
        )

        expect(res.status).toBe(403)
        expect(prismaMock.muscleGroup.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update fails', async () => {
        prismaMock.muscleGroup.update.mockRejectedValue(new Error('db down'))

        const res = await putMuscleGroup(
            jsonRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}`, 'PUT', { name: 'Dorsali' }),
            withParams({ id: MG_ID })
        )
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('DELETE /api/muscle-groups/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    it('deletes a muscle group no exercise uses', async () => {
        prismaMock.exerciseMuscleGroup.count.mockResolvedValue(0)
        prismaMock.muscleGroup.delete.mockResolvedValue({ id: MG_ID } as never)

        const res = await deleteMuscleGroup(makeRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}`, { method: 'DELETE' }), withParams({ id: MG_ID }))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.messageKey).toBe('muscleGroup.deletedSuccess')
        expect(prismaMock.muscleGroup.delete).toHaveBeenCalledWith({ where: { id: MG_ID } })
    })

    it('returns 409 when the muscle group is still in use', async () => {
        prismaMock.exerciseMuscleGroup.count.mockResolvedValue(2)

        const res = await deleteMuscleGroup(makeRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}`, { method: 'DELETE' }), withParams({ id: MG_ID }))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error.key).toBe('muscleGroup.cannotDeleteInUse')
        expect(prismaMock.muscleGroup.delete).not.toHaveBeenCalled()
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await deleteMuscleGroup(makeRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}`, { method: 'DELETE' }), withParams({ id: MG_ID }))

        expect(res.status).toBe(401)
        expect(prismaMock.muscleGroup.delete).not.toHaveBeenCalled()
    })

    it('returns 500 when the delete fails', async () => {
        prismaMock.exerciseMuscleGroup.count.mockResolvedValue(0)
        prismaMock.muscleGroup.delete.mockRejectedValue(new Error('db down'))

        const res = await deleteMuscleGroup(makeRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}`, { method: 'DELETE' }), withParams({ id: MG_ID }))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('PATCH /api/muscle-groups/[id]/archive', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    it('archives the muscle group', async () => {
        prismaMock.muscleGroup.update.mockResolvedValue({ id: MG_ID, isActive: false } as never)

        const res = await archiveMuscleGroup(makeRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}/archive`, { method: 'PATCH' }), withParams({ id: MG_ID }))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.muscleGroup).toMatchObject({ id: MG_ID, isActive: false })
        expect(prismaMock.muscleGroup.update).toHaveBeenCalledWith({
            where: { id: MG_ID },
            data: { isActive: false },
        })
    })

    it('returns 403 for a trainee', async () => {
        asForbidden()

        const res = await archiveMuscleGroup(makeRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}/archive`, { method: 'PATCH' }), withParams({ id: MG_ID }))

        expect(res.status).toBe(403)
        expect(prismaMock.muscleGroup.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update fails', async () => {
        prismaMock.muscleGroup.update.mockRejectedValue(new Error('db down'))

        const res = await archiveMuscleGroup(makeRequest(`http://localhost:3000/api/muscle-groups/${MG_ID}/archive`, { method: 'PATCH' }), withParams({ id: MG_ID }))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

// ─── Movement pattern colors ──────────────────────────────────────────────────

describe('GET /api/movement-pattern-colors', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    it('returns the colors of the signed-in trainer', async () => {
        prismaMock.movementPatternColor.findMany.mockResolvedValue([
            { trainerId: mockTrainerSession.user.id, movementPatternId: MP_ID, color: '#ff0000' },
        ] as never)

        const res = await getColors(makeRequest('http://localhost:3000/api/movement-pattern-colors'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(prismaMock.movementPatternColor.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { trainerId: mockTrainerSession.user.id } })
        )
    })

    it('returns 403 for a non-trainer', async () => {
        asForbidden()

        const res = await getColors(makeRequest('http://localhost:3000/api/movement-pattern-colors'))

        expect(res.status).toBe(403)
        expect(prismaMock.movementPatternColor.findMany).not.toHaveBeenCalled()
    })

    it('returns 500 when the query fails', async () => {
        prismaMock.movementPatternColor.findMany.mockRejectedValue(new Error('db down'))

        const res = await getColors(makeRequest('http://localhost:3000/api/movement-pattern-colors'))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('PUT /api/movement-pattern-colors', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
        prismaMock.movementPattern.findMany.mockResolvedValue([{ id: MP_ID }] as never)
        prismaMock.movementPatternColor.upsert.mockResolvedValue({
            trainerId: mockTrainerSession.user.id,
            movementPatternId: MP_ID,
            color: '#ff0000',
        } as never)
    })

    it('upserts the color of each pattern', async () => {
        const res = await putColors(
            jsonRequest('http://localhost:3000/api/movement-pattern-colors', 'PUT', [{ movementPatternId: MP_ID, color: '#ff0000' }])
        )
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(prismaMock.movementPatternColor.upsert).toHaveBeenCalledWith({
            where: {
                trainerId_movementPatternId: {
                    trainerId: mockTrainerSession.user.id,
                    movementPatternId: MP_ID,
                },
            },
            create: {
                trainerId: mockTrainerSession.user.id,
                movementPatternId: MP_ID,
                color: '#ff0000',
            },
            update: { color: '#ff0000' },
        })
    })

    it('returns 400 when a color is not a hex value', async () => {
        const res = await putColors(
            jsonRequest('http://localhost:3000/api/movement-pattern-colors', 'PUT', [{ movementPatternId: MP_ID, color: 'red' }])
        )
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.invalidInput')
        expect(prismaMock.movementPatternColor.upsert).not.toHaveBeenCalled()
    })

    it('returns 404 when a movement pattern does not exist', async () => {
        prismaMock.movementPattern.findMany.mockResolvedValue([] as never)

        const res = await putColors(
            jsonRequest('http://localhost:3000/api/movement-pattern-colors', 'PUT', [{ movementPatternId: MP_ID, color: '#ff0000' }])
        )
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('movementPattern.notFound')
        expect(prismaMock.movementPatternColor.upsert).not.toHaveBeenCalled()
    })

    it('returns 403 for a non-trainer', async () => {
        asForbidden()

        const res = await putColors(
            jsonRequest('http://localhost:3000/api/movement-pattern-colors', 'PUT', [{ movementPatternId: MP_ID, color: '#ff0000' }])
        )

        expect(res.status).toBe(403)
        expect(prismaMock.movementPatternColor.upsert).not.toHaveBeenCalled()
    })

    it('returns 500 when the transaction fails', async () => {
        prismaMock.movementPatternColor.upsert.mockRejectedValue(new Error('db down'))

        const res = await putColors(
            jsonRequest('http://localhost:3000/api/movement-pattern-colors', 'PUT', [{ movementPatternId: MP_ID, color: '#ff0000' }])
        )
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
