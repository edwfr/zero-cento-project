import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock sessions for different users
const mockTrainerASession = {
    user: {
        id: 'trainer-a-uuid',
        email: 'trainer.a@zerocento.it',
        firstName: 'Trainer',
        lastName: 'A',
        role: 'trainer' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

const mockTrainerBSession = {
    user: {
        id: 'trainer-b-uuid',
        email: 'trainer.b@zerocento.it',
        firstName: 'Trainer',
        lastName: 'B',
        role: 'trainer' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

const mockTraineeASession = {
    user: {
        id: 'trainee-a-uuid',
        email: 'trainee.a@zerocento.it',
        firstName: 'Trainee',
        lastName: 'A',
        role: 'trainee' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

const mockTraineeBSession = {
    user: {
        id: 'trainee-b-uuid',
        email: 'trainee.b@zerocento.it',
        firstName: 'Trainee',
        lastName: 'B',
        role: 'trainee' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

const mockAdminSession = {
    user: {
        id: 'admin-uuid',
        email: 'admin@zerocento.it',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        personalRecord: {
            findMany: vi.fn(),
        },
        trainerTrainee: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
        },
        trainingProgram: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        exerciseFeedback: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
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

import { GET as getPersonalRecords } from '@/app/api/personal-records/route'
import { GET as getProgram } from '@/app/api/programs/[id]/route'
import { PUT as updateProgram } from '@/app/api/programs/[id]/route'
import { GET as getFeedback } from '@/app/api/feedback/route'
import { GET as getUser } from '@/app/api/users/[id]/route'
import { PUT as updateUser } from '@/app/api/users/[id]/route'
import { PATCH as deactivateUser } from '@/app/api/users/[id]/deactivate/route'
import { requireRole, requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function makeRequest(url = 'http://localhost:3000', options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as any)
}

describe('RBAC Violations - Personal Records', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('denies trainer A access to personal records of trainer B trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerASession)

        // Mock findMany for initial query to get trainer's trainees
        vi.mocked(prisma.trainerTrainee.findMany).mockResolvedValue([
            { traineeId: 'trainee-a-uuid' },
        ] as any)

        // Trainer A tries to access trainee B's records (who belongs to trainer B)
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue(null)

        const req = makeRequest(
            'http://localhost:3000/api/personal-records?traineeId=trainee-b-uuid'
        )

        const res = await getPersonalRecords(req)
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('denies trainer B access to personal records of trainer A trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerBSession)

        // Mock findMany for initial query to get trainer's trainees
        vi.mocked(prisma.trainerTrainee.findMany).mockResolvedValue([
            { traineeId: 'trainee-b-uuid' },
        ] as any)

        // Trainer B tries to access trainee A's records (who belongs to trainer A)
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue(null)

        const req = makeRequest(
            'http://localhost:3000/api/personal-records?traineeId=trainee-a-uuid'
        )

        const res = await getPersonalRecords(req)
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('allows trainer A to access own trainee personal records', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerASession)

        // Mock findMany for initial query to get trainer's trainees
        vi.mocked(prisma.trainerTrainee.findMany).mockResolvedValue([
            { traineeId: 'trainee-a-uuid' },
        ] as any)

        // Trainer A owns trainee A
        vi.mocked(prisma.trainerTrainee.findUnique).mockResolvedValue({
            trainerId: 'trainer-a-uuid',
            traineeId: 'trainee-a-uuid',
            assignedAt: new Date(),
        } as any)

        vi.mocked(prisma.personalRecord.findMany).mockResolvedValue([
            {
                id: 'pr-1',
                traineeId: 'trainee-a-uuid',
                exerciseId: 'ex-1',
                oneRM: 100,
                recordDate: new Date(),
            },
        ] as any)

        const req = makeRequest(
            'http://localhost:3000/api/personal-records?traineeId=trainee-a-uuid'
        )

        const res = await getPersonalRecords(req)

        expect(res.status).toBe(200)
    })

    it('allows admin to access any trainee personal records', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)

        vi.mocked(prisma.personalRecord.findMany).mockResolvedValue([
            {
                id: 'pr-1',
                traineeId: 'trainee-b-uuid',
                exerciseId: 'ex-1',
                oneRM: 100,
                recordDate: new Date(),
            },
        ] as any)

        const req = makeRequest(
            'http://localhost:3000/api/personal-records?traineeId=trainee-b-uuid'
        )

        const res = await getPersonalRecords(req)

        expect(res.status).toBe(200)
    })
})

describe('RBAC Violations - Training Programs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('denies trainer A access to trainer B program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerASession)

        // Program belongs to trainer B
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: 'prog-b-1',
            trainerId: 'trainer-b-uuid',
            traineeId: 'trainee-b-uuid',
            title: 'Program B',
            status: 'active',
        } as any)

        const req = makeRequest('http://localhost:3000/api/programs/prog-b-1')

        const res = await getProgram(req, { params: { id: 'prog-b-1' } })
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('denies trainee A access to trainee B program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeASession)

        // Program assigned to trainee B
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: 'prog-b-1',
            trainerId: 'trainer-b-uuid',
            traineeId: 'trainee-b-uuid',
            title: 'Program B',
            status: 'active',
        } as any)

        const req = makeRequest('http://localhost:3000/api/programs/prog-b-1')

        const res = await getProgram(req, { params: { id: 'prog-b-1' } })
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('denies trainer A updating trainer B program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerASession)

        // Program belongs to trainer B
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: 'prog-b-1',
            trainerId: 'trainer-b-uuid',
            traineeId: 'trainee-b-uuid',
            title: 'Program B',
            status: 'draft',
        } as any)

        const req = makeRequest('http://localhost:3000/api/programs/prog-b-1', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Modified Program B' }),
        })

        const res = await updateProgram(req, { params: { id: 'prog-b-1' } })
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('allows trainer A to access own program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerASession)

        // Program belongs to trainer A
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: 'prog-a-1',
            trainerId: 'trainer-a-uuid',
            traineeId: 'trainee-a-uuid',
            title: 'Program A',
            status: 'active',
            trainer: { id: 'trainer-a-uuid', firstName: 'Trainer', lastName: 'A' },
            trainee: { id: 'trainee-a-uuid', firstName: 'Trainee', lastName: 'A' },
            weeks: [],
        } as any)

        const req = makeRequest('http://localhost:3000/api/programs/prog-a-1')

        const res = await getProgram(req, { params: { id: 'prog-a-1' } })

        expect(res.status).toBe(200)
    })

    it('allows trainee A to access own program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeASession)

        // Program assigned to trainee A
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: 'prog-a-1',
            trainerId: 'trainer-a-uuid',
            traineeId: 'trainee-a-uuid',
            title: 'Program A',
            status: 'active',
            trainer: { id: 'trainer-a-uuid', firstName: 'Trainer', lastName: 'A' },
            trainee: { id: 'trainee-a-uuid', firstName: 'Trainee', lastName: 'A' },
            weeks: [],
        } as any)

        const req = makeRequest('http://localhost:3000/api/programs/prog-a-1')

        const res = await getProgram(req, { params: { id: 'prog-a-1' } })

        expect(res.status).toBe(200)
    })

    it('allows admin to access any program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)

        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: 'prog-b-1',
            trainerId: 'trainer-b-uuid',
            traineeId: 'trainee-b-uuid',
            title: 'Program B',
            status: 'active',
            trainer: { id: 'trainer-b-uuid', firstName: 'Trainer', lastName: 'B' },
            trainee: { id: 'trainee-b-uuid', firstName: 'Trainee', lastName: 'B' },
            weeks: [],
        } as any)

        const req = makeRequest('http://localhost:3000/api/programs/prog-b-1')

        const res = await getProgram(req, { params: { id: 'prog-b-1' } })

        expect(res.status).toBe(200)
    })
})

describe('RBAC Violations - Feedback', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('denies trainer A access to trainer B trainee feedback', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerASession)

        // Trainer A tries to access feedback from trainee B (who belongs to trainer B)
        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue([])

        const req = makeRequest('http://localhost:3000/api/feedback?traineeId=trainee-b-uuid')

        const res = await getFeedback(req)
        const body = await res.json()

        // Should return empty due to RBAC filtering
        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(0)
    })

    it('allows trainer A to access own trainee feedback', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerASession)

        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue([
            {
                id: 'fb-1',
                workoutExerciseId: 'we-1',
                completed: true,
                actualRpe: 8,
            },
        ] as any)

        const req = makeRequest('http://localhost:3000/api/feedback?traineeId=trainee-a-uuid')

        const res = await getFeedback(req)

        expect(res.status).toBe(200)
    })
})

describe('RBAC Violations - Users', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('denies trainer A access to trainer B trainee details', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerASession)

        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'trainee-b-uuid',
            email: 'trainee.b@zerocento.it',
            firstName: 'Trainee',
            lastName: 'B',
            role: 'trainee',
            isActive: true,
        } as any)

        // Trainer A does not own trainee B
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue(null)

        const req = makeRequest('http://localhost:3000/api/users/trainee-b-uuid')

        const res = await getUser(req, { params: { id: 'trainee-b-uuid' } })
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('denies trainer A updating trainer B trainee', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerASession)

        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'trainee-b-uuid',
            email: 'trainee.b@zerocento.it',
            firstName: 'Trainee',
            lastName: 'B',
            role: 'trainee',
            isActive: true,
        } as any)

        // Trainer A does not own trainee B
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue(null)

        const req = makeRequest('http://localhost:3000/api/users/trainee-b-uuid', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: 'Modified' }),
        })

        const res = await updateUser(req, { params: { id: 'trainee-b-uuid' } })
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('denies trainer A deactivating trainer B trainee', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerASession)

        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'trainee-b-uuid',
            email: 'trainee.b@zerocento.it',
            firstName: 'Trainee',
            lastName: 'B',
            role: 'trainee',
            isActive: true,
        } as any)

        // Trainer A does not own trainee B
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue(null)

        const req = makeRequest('http://localhost:3000/api/users/trainee-b-uuid/deactivate', {
            method: 'PATCH',
        })

        const res = await deactivateUser(req, { params: { id: 'trainee-b-uuid' } })
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('allows trainer A to access own trainee details', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerASession)

        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'trainee-a-uuid',
            email: 'trainee.a@zerocento.it',
            firstName: 'Trainee',
            lastName: 'A',
            role: 'trainee',
            isActive: true,
            createdAt: new Date(),
        } as any)

        // Trainer A owns trainee A
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue({
            trainerId: 'trainer-a-uuid',
            traineeId: 'trainee-a-uuid',
            assignedAt: new Date(),
        } as any)

        const req = makeRequest('http://localhost:3000/api/users/trainee-a-uuid')

        const res = await getUser(req, { params: { id: 'trainee-a-uuid' } })

        expect(res.status).toBe(200)
    })

    it('allows admin to access any user', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockAdminSession)

        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'trainee-b-uuid',
            email: 'trainee.b@zerocento.it',
            firstName: 'Trainee',
            lastName: 'B',
            role: 'trainee',
            isActive: true,
            createdAt: new Date(),
        } as any)

        const req = makeRequest('http://localhost:3000/api/users/trainee-b-uuid')

        const res = await getUser(req, { params: { id: 'trainee-b-uuid' } })

        expect(res.status).toBe(200)
    })
})
