import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

// ─── Mock sessions ─────────────────────────────────────────────────────────

const mockTrainerSession = {
    user: {
        id: 'trainer-uuid-1',
        email: 'trainer@zerocento.it',
        firstName: 'Marco',
        lastName: 'Trainer',
        role: 'trainer' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

const mockTraineeSession = {
    user: {
        id: 'trainee-uuid-1',
        email: 'trainee@zerocento.it',
        firstName: 'Mario',
        lastName: 'Atleta',
        role: 'trainee' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

const mockAdminSession = {
    user: {
        id: 'admin-uuid-1',
        email: 'admin@zerocento.it',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

const mockOtherTrainerSession = {
    user: {
        id: 'trainer-uuid-2',
        email: 'other.trainer@zerocento.it',
        firstName: 'Luigi',
        lastName: 'OtherTrainer',
        role: 'trainer' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        personalRecord: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
        trainerTrainee: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        exercise: {
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

import { GET, POST } from '@/app/api/personal-records/route'
import { PATCH, DELETE } from '@/app/api/personal-records/[id]/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── Fixtures ──────────────────────────────────────────────────────────────

// Use proper UUIDs so Zod uuid() validation passes in POST/PATCH payloads
const EXERCISE_ID = '11111111-1111-1111-1111-111111111111'
const TRAINEE_ID = 'trainee-uuid-1'
const TRAINER_ID = 'trainer-uuid-1'
const OTHER_TRAINER_ID = 'trainer-uuid-2'
const RECORD_ID_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const RECORD_ID_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const mockExercise = {
    id: EXERCISE_ID,
    name: 'Squat',
    type: 'strength',
    coefficient: 1.0,
}

const mockTraineeUser = {
    id: TRAINEE_ID,
    firstName: 'Mario',
    lastName: 'Atleta',
    role: 'trainee',
    isActive: true,
}

const mockRecord = {
    id: RECORD_ID_1,
    traineeId: TRAINEE_ID,
    exerciseId: EXERCISE_ID,
    reps: 5,
    weight: 100,
    recordDate: new Date('2026-03-01T00:00:00.000Z'),
    notes: 'PB squat',
    exercise: { id: EXERCISE_ID, name: 'Squat', type: 'strength' },
    trainee: { id: TRAINEE_ID, firstName: 'Mario', lastName: 'Atleta' },
}

const mockRecord2 = {
    id: RECORD_ID_2,
    traineeId: TRAINEE_ID,
    exerciseId: EXERCISE_ID,
    reps: 3,
    weight: 110,
    recordDate: new Date('2026-03-15T00:00:00.000Z'),
    notes: null,
    exercise: { id: EXERCISE_ID, name: 'Squat', type: 'strength' },
    trainee: { id: TRAINEE_ID, firstName: 'Mario', lastName: 'Atleta' },
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(url = 'http://localhost:3000/api/personal-records', options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as any)
}

function makeIdRequest(
    id: string,
    url = `http://localhost:3000/api/personal-records/${id}`,
    options?: RequestInit
) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as any)
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/personal-records
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/personal-records', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns own records for trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.personalRecord.findMany).mockResolvedValue([mockRecord] as any)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(body.data.items[0].id).toBe(RECORD_ID_1)

        // Trainee filter: where.traineeId === own id
        expect(prisma.personalRecord.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ traineeId: TRAINEE_ID }),
            })
        )
    })

    it('returns records for trainer filtered to own trainees', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainerTrainee.findMany).mockResolvedValue([
            { traineeId: TRAINEE_ID },
        ] as any)
        vi.mocked(prisma.personalRecord.findMany).mockResolvedValue([mockRecord, mockRecord2] as any)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(2)

        // Trainer filter: where.traineeId = { in: [...] }
        expect(prisma.personalRecord.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    traineeId: { in: [TRAINEE_ID] },
                }),
            })
        )
    })

    it('returns all records for admin without trainee filter', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.personalRecord.findMany).mockResolvedValue([mockRecord, mockRecord2] as any)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(2)

        // Admin: no traineeId constraint in where
        const callArgs = vi.mocked(prisma.personalRecord.findMany).mock.calls[0][0] as any
        expect(callArgs.where?.traineeId).toBeUndefined()
    })

    it('filters by exerciseId query parameter', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.personalRecord.findMany).mockResolvedValue([mockRecord] as any)

        const req = makeRequest(
            'http://localhost:3000/api/personal-records?exerciseId=exercise-uuid-1'
        )
        await GET(req)

        expect(prisma.personalRecord.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ exerciseId: 'exercise-uuid-1' }),
            })
        )
    })

    it('trainer can filter by own traineeId', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainerTrainee.findMany).mockResolvedValue([
            { traineeId: 'trainee-uuid-1' },
        ] as any)
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue({
            trainerId: 'trainer-uuid-1',
            traineeId: 'trainee-uuid-1',
            assignedAt: new Date(),
        } as any)
        vi.mocked(prisma.personalRecord.findMany).mockResolvedValue([mockRecord] as any)

        const req = makeRequest(
            'http://localhost:3000/api/personal-records?traineeId=trainee-uuid-1'
        )
        const res = await GET(req)

        expect(res.status).toBe(200)
    })

    it('returns 403 when trainer requests records of another trainer\'s trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockOtherTrainerSession)
        vi.mocked(prisma.trainerTrainee.findMany).mockResolvedValue([] as any)
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue(null)

        const req = makeRequest(
            'http://localhost:3000/api/personal-records?traineeId=trainee-uuid-1'
        )
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns 401 when not authenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
        )

        const req = makeRequest()
        const res = await GET(req)

        expect(res.status).toBe(401)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/personal-records
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/personal-records', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const validPayload = {
        exerciseId: EXERCISE_ID,
        reps: 5,
        weight: 100,
        recordDate: '2026-03-01T00:00:00.000Z',
        notes: 'PB squat',
    }

    it('returns 403 when trainee tries to create own personal record', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
        )

        const req = makeRequest('http://localhost:3000/api/personal-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })

        const res = await POST(req)
        expect(res.status).toBe(403)
        expect(prisma.personalRecord.create).not.toHaveBeenCalled()
    })

    it('trainer creates record for own trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue({
            trainerId: 'trainer-uuid-1',
            traineeId: 'trainee-uuid-1',
        } as any)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTraineeUser as any)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(mockExercise as any)
        vi.mocked(prisma.personalRecord.create).mockResolvedValue(mockRecord as any)

        const req = makeRequest('http://localhost:3000/api/personal-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, traineeId: 'trainee-uuid-1' }),
        })

        const res = await POST(req)

        expect(res.status).toBe(201)
    })

    it('admin creates record specifying any traineeId', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTraineeUser as any)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(mockExercise as any)
        vi.mocked(prisma.personalRecord.create).mockResolvedValue(mockRecord as any)

        const req = makeRequest('http://localhost:3000/api/personal-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, traineeId: 'trainee-uuid-1' }),
        })

        const res = await POST(req)

        expect(res.status).toBe(201)
        // Admin skips trainer–trainee ownership check
        expect(prisma.trainerTrainee.findUnique).not.toHaveBeenCalled()
    })

    it('returns 403 when trainer creates record for another trainer\'s trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockOtherTrainerSession)
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue(null) // no relation

        const req = makeRequest('http://localhost:3000/api/personal-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, traineeId: 'trainee-uuid-1' }),
        })

        const res = await POST(req)
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns 400 when traineeId is missing for trainer', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)

        const req = makeRequest('http://localhost:3000/api/personal-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload), // no traineeId
        })

        const res = await POST(req)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 404 when exercise does not exist', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue({
            trainerId: 'trainer-uuid-1',
            traineeId: 'trainee-uuid-1',
        } as any)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTraineeUser as any)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(null)

        const req = makeRequest('http://localhost:3000/api/personal-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, traineeId: 'trainee-uuid-1', exerciseId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }),
        })

        const res = await POST(req)
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 400 for weight exceeding 1000 kg', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)

        const req = makeRequest('http://localhost:3000/api/personal-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, traineeId: 'trainee-uuid-1', weight: 1001 }),
        })

        const res = await POST(req)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 for reps exceeding 100', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)

        const req = makeRequest('http://localhost:3000/api/personal-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, traineeId: 'trainee-uuid-1', reps: 101 }),
        })

        const res = await POST(req)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 for future recordDate', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)

        const futureDate = new Date()
        futureDate.setFullYear(futureDate.getFullYear() + 1)

        const req = makeRequest('http://localhost:3000/api/personal-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, traineeId: 'trainee-uuid-1', recordDate: futureDate.toISOString() }),
        })

        const res = await POST(req)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 401 when not authenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
        )

        const req = makeRequest('http://localhost:3000/api/personal-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })

        const res = await POST(req)

        expect(res.status).toBe(401)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/personal-records/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /api/personal-records/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('trainer updates record belonging to own trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.personalRecord.findUnique).mockResolvedValue({
            ...mockRecord,
            trainee: mockTraineeUser,
        } as any)
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue({
            trainerId: 'trainer-uuid-1',
            traineeId: 'trainee-uuid-1',
        } as any)
        vi.mocked(prisma.personalRecord.update).mockResolvedValue({
            ...mockRecord,
            weight: 105,
        } as any)

        const req = makeIdRequest('record-uuid-1', undefined, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weight: 105 }),
        })

        const res = await PATCH(req, withIdParam('record-uuid-1'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.record.weight).toBe(105)
    })

    it('admin updates any record', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.personalRecord.findUnique).mockResolvedValue({
            ...mockRecord,
            trainee: mockTraineeUser,
        } as any)
        vi.mocked(prisma.personalRecord.update).mockResolvedValue({
            ...mockRecord,
            notes: 'Updated by admin',
        } as any)

        const req = makeIdRequest('record-uuid-1', undefined, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: 'Updated by admin' }),
        })

        const res = await PATCH(req, withIdParam('record-uuid-1'))

        expect(res.status).toBe(200)
        // Admin skips trainer-trainee check
        expect(prisma.trainerTrainee.findUnique).not.toHaveBeenCalled()
    })

    it('returns 403 when trainer tries to update record of another trainer\'s trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockOtherTrainerSession)
        vi.mocked(prisma.personalRecord.findUnique).mockResolvedValue({
            ...mockRecord,
            trainee: mockTraineeUser,
        } as any)
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue(null) // no relation

        const req = makeIdRequest('record-uuid-1', undefined, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weight: 105 }),
        })

        const res = await PATCH(req, withIdParam('record-uuid-1'))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns 404 when record does not exist', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.personalRecord.findUnique).mockResolvedValue(null)

        const req = makeIdRequest('non-existent-id', undefined, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weight: 105 }),
        })

        const res = await PATCH(req, withIdParam('non-existent-id'))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 400 for invalid partial data (weight > 1000)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.personalRecord.findUnique).mockResolvedValue({
            ...mockRecord,
            trainee: mockTraineeUser,
        } as any)
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue({
            trainerId: 'trainer-uuid-1',
            traineeId: 'trainee-uuid-1',
        } as any)

        const req = makeIdRequest('record-uuid-1', undefined, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weight: 9999 }),
        })

        const res = await PATCH(req, withIdParam('record-uuid-1'))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/personal-records/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /api/personal-records/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('trainer deletes record belonging to own trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.personalRecord.findUnique).mockResolvedValue({
            ...mockRecord,
            trainee: mockTraineeUser,
        } as any)
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue({
            trainerId: 'trainer-uuid-1',
            traineeId: 'trainee-uuid-1',
        } as any)
        vi.mocked(prisma.personalRecord.delete).mockResolvedValue(mockRecord as any)

        const req = makeIdRequest('record-uuid-1', undefined, { method: 'DELETE' })
        const res = await DELETE(req, withIdParam('record-uuid-1'))

        expect(res.status).toBe(200)
        expect(prisma.personalRecord.delete).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'record-uuid-1' } })
        )
    })

    it('admin deletes any record', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.personalRecord.findUnique).mockResolvedValue({
            ...mockRecord,
            trainee: mockTraineeUser,
        } as any)
        vi.mocked(prisma.personalRecord.delete).mockResolvedValue(mockRecord as any)

        const req = makeIdRequest('record-uuid-1', undefined, { method: 'DELETE' })
        const res = await DELETE(req, withIdParam('record-uuid-1'))

        expect(res.status).toBe(200)
        expect(prisma.trainerTrainee.findUnique).not.toHaveBeenCalled()
    })

    it('returns 403 when trainer tries to delete record of another trainer\'s trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockOtherTrainerSession)
        vi.mocked(prisma.personalRecord.findUnique).mockResolvedValue({
            ...mockRecord,
            trainee: mockTraineeUser,
        } as any)
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue(null)

        const req = makeIdRequest('record-uuid-1', undefined, { method: 'DELETE' })
        const res = await DELETE(req, withIdParam('record-uuid-1'))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns 404 when record does not exist', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.personalRecord.findUnique).mockResolvedValue(null)

        const req = makeIdRequest('non-existent-id', undefined, { method: 'DELETE' })
        const res = await DELETE(req, withIdParam('non-existent-id'))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 401 when not authenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
        )

        const req = makeIdRequest('record-uuid-1', undefined, { method: 'DELETE' })
        const res = await DELETE(req, withIdParam('record-uuid-1'))

        expect(res.status).toBe(401)
    })
})
