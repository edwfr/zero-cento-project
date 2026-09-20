// Wiring test: it checks that each route calls the right guard with the right
// arguments. The guards' own logic is covered by tests/unit/lib/auth.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeTrainerSession, makeTraineeSession } from '../helpers/sessions'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

// File-specific sessions (distinct named trainers/trainees for RBAC isolation tests)
const mockTrainerASession = makeTrainerSession({
    id: 'trainer-a-uuid',
    email: 'trainer.a@zerocento.it',
    firstName: 'Trainer',
    lastName: 'A',
})

const mockTrainerBSession = makeTrainerSession({
    id: 'trainer-b-uuid',
    email: 'trainer.b@zerocento.it',
    firstName: 'Trainer',
    lastName: 'B',
})

const mockTraineeASession = makeTraineeSession({
    id: 'trainee-a-uuid',
    email: 'trainee.a@zerocento.it',
    firstName: 'Trainee',
    lastName: 'A',
})

const mockTraineeBSession = makeTraineeSession({
    id: 'trainee-b-uuid',
    email: 'trainee.b@zerocento.it',
    firstName: 'Trainee',
    lastName: 'B',
})

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

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
import { prismaMock } from '../helpers/prisma-mock'
import { asAdmin } from '../helpers/auth-mock'
import { requireRole, requireAuth } from '@/lib/auth'

function makeRequest(url = 'http://localhost:3000', options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as never)
}

describe('RBAC Violations - Personal Records', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('denies trainer A access to personal records of trainer B trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerASession)

        // findFirst returns null: trainer A does not manage trainee B
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const req = makeRequest(
            'http://localhost:3000/api/personal-records?traineeId=trainee-b-uuid'
        )

        const res = await getPersonalRecords(req)
        const body = await res.json()

        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer', 'trainee'])
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('denies trainer B access to personal records of trainer A trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerBSession)

        // findFirst returns null: trainer B does not manage trainee A
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const req = makeRequest(
            'http://localhost:3000/api/personal-records?traineeId=trainee-a-uuid'
        )

        const res = await getPersonalRecords(req)
        const body = await res.json()

        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer', 'trainee'])
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('allows trainer A to access own trainee personal records', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerASession)

        // findFirst returns the relationship: trainer A manages trainee A
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: 'trainer-a-uuid',
            traineeId: 'trainee-a-uuid',
            assignedAt: new Date(),
        } as never)

        prismaMock.personalRecord.findMany.mockResolvedValue([
            {
                id: 'pr-1',
                traineeId: 'trainee-a-uuid',
                exerciseId: 'ex-1',
                oneRM: 100,
                recordDate: new Date(),
            },
        ] as never)

        const req = makeRequest(
            'http://localhost:3000/api/personal-records?traineeId=trainee-a-uuid'
        )

        const res = await getPersonalRecords(req)

        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer', 'trainee'])
        expect(res.status).toBe(200)
    })

    it('allows admin to access any trainee personal records', async () => {
        asAdmin()

        prismaMock.personalRecord.findMany.mockResolvedValue([
            {
                id: 'pr-1',
                traineeId: 'trainee-b-uuid',
                exerciseId: 'ex-1',
                oneRM: 100,
                recordDate: new Date(),
            },
        ] as never)

        const req = makeRequest(
            'http://localhost:3000/api/personal-records?traineeId=trainee-b-uuid'
        )

        const res = await getPersonalRecords(req)

        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer', 'trainee'])
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
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'prog-b-1',
            trainerId: 'trainer-b-uuid',
            traineeId: 'trainee-b-uuid',
            title: 'Program B',
            status: 'active',
        } as never)

        const req = makeRequest('http://localhost:3000/api/programs/prog-b-1')

        const res = await getProgram(req, withIdParam('prog-b-1'))
        const body = await res.json()

        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer', 'trainee'])
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('denies trainee A access to trainee B program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeASession)

        // Program assigned to trainee B
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'prog-b-1',
            trainerId: 'trainer-b-uuid',
            traineeId: 'trainee-b-uuid',
            title: 'Program B',
            status: 'active',
        } as never)

        const req = makeRequest('http://localhost:3000/api/programs/prog-b-1')

        const res = await getProgram(req, withIdParam('prog-b-1'))
        const body = await res.json()

        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer', 'trainee'])
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('denies trainer A updating trainer B program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerASession)

        // Program belongs to trainer B
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'prog-b-1',
            trainerId: 'trainer-b-uuid',
            traineeId: 'trainee-b-uuid',
            title: 'Program B',
            status: 'draft',
        } as never)

        const req = makeRequest('http://localhost:3000/api/programs/prog-b-1', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Modified Program B' }),
        })

        const res = await updateProgram(req, withIdParam('prog-b-1'))
        const body = await res.json()

        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer'])
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('allows trainer A to access own program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerASession)

        // Program belongs to trainer A
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'prog-a-1',
            trainerId: 'trainer-a-uuid',
            traineeId: 'trainee-a-uuid',
            title: 'Program A',
            status: 'active',
            trainer: { id: 'trainer-a-uuid', firstName: 'Trainer', lastName: 'A' },
            trainee: { id: 'trainee-a-uuid', firstName: 'Trainee', lastName: 'A' },
            weeks: [],
        } as never)
        prismaMock.workout.findMany.mockResolvedValue([] as never)

        const req = makeRequest('http://localhost:3000/api/programs/prog-a-1')

        const res = await getProgram(req, withIdParam('prog-a-1'))

        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer', 'trainee'])
        expect(res.status).toBe(200)
    })

    it('allows trainee A to access own program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeASession)

        // Program assigned to trainee A
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'prog-a-1',
            trainerId: 'trainer-a-uuid',
            traineeId: 'trainee-a-uuid',
            title: 'Program A',
            status: 'active',
            trainer: { id: 'trainer-a-uuid', firstName: 'Trainer', lastName: 'A' },
            trainee: { id: 'trainee-a-uuid', firstName: 'Trainee', lastName: 'A' },
            weeks: [],
        } as never)

        const req = makeRequest('http://localhost:3000/api/programs/prog-a-1')

        const res = await getProgram(req, withIdParam('prog-a-1'))

        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer', 'trainee'])
        expect(res.status).toBe(200)
    })

    it('allows admin to access any program', async () => {
        asAdmin()

        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'prog-b-1',
            trainerId: 'trainer-b-uuid',
            traineeId: 'trainee-b-uuid',
            title: 'Program B',
            status: 'active',
            trainer: { id: 'trainer-b-uuid', firstName: 'Trainer', lastName: 'B' },
            trainee: { id: 'trainee-b-uuid', firstName: 'Trainee', lastName: 'B' },
            weeks: [],
        } as never)
        // Explicit: before the shared mock this test relied on the stub left
        // behind by the previous one (clearAllMocks keeps implementations).
        prismaMock.workout.findMany.mockResolvedValue([] as never)

        const req = makeRequest('http://localhost:3000/api/programs/prog-b-1')

        const res = await getProgram(req, withIdParam('prog-b-1'))

        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer', 'trainee'])
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
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)

        const req = makeRequest('http://localhost:3000/api/feedback?traineeId=trainee-b-uuid')

        const res = await getFeedback(req)
        const body = await res.json()

        // Should return empty due to RBAC filtering
        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer', 'trainee'])
        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(0)
    })

    it('allows trainer A to access own trainee feedback', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerASession)

        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            {
                id: 'fb-1',
                workoutExerciseId: 'we-1',
                completed: true,
                actualRpe: 8,
            },
        ] as never)

        const req = makeRequest('http://localhost:3000/api/feedback?traineeId=trainee-a-uuid')

        const res = await getFeedback(req)

        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer', 'trainee'])
        expect(res.status).toBe(200)
    })
})

describe('RBAC Violations - Users', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('denies trainer A access to trainer B trainee details', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerASession)

        prismaMock.user.findUnique.mockResolvedValue({
            id: 'trainee-b-uuid',
            email: 'trainee.b@zerocento.it',
            firstName: 'Trainee',
            lastName: 'B',
            role: 'trainee',
            isActive: true,
        } as never)

        // Trainer A does not own trainee B
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const req = makeRequest('http://localhost:3000/api/users/trainee-b-uuid')

        const res = await getUser(req, withIdParam('trainee-b-uuid'))
        const body = await res.json()

        expect(vi.mocked(requireAuth)).toHaveBeenCalled()
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('denies trainer A updating trainer B trainee', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerASession)

        prismaMock.user.findUnique.mockResolvedValue({
            id: 'trainee-b-uuid',
            email: 'trainee.b@zerocento.it',
            firstName: 'Trainee',
            lastName: 'B',
            role: 'trainee',
            isActive: true,
        } as never)

        // Trainer A does not own trainee B
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const req = makeRequest('http://localhost:3000/api/users/trainee-b-uuid', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: 'Modified' }),
        })

        const res = await updateUser(req, withIdParam('trainee-b-uuid'))
        const body = await res.json()

        expect(vi.mocked(requireAuth)).toHaveBeenCalled()
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('denies trainer A deactivating trainer B trainee', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerASession)

        prismaMock.user.findUnique.mockResolvedValue({
            id: 'trainee-b-uuid',
            email: 'trainee.b@zerocento.it',
            firstName: 'Trainee',
            lastName: 'B',
            role: 'trainee',
            isActive: true,
        } as never)

        // Trainer A does not own trainee B
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const req = makeRequest('http://localhost:3000/api/users/trainee-b-uuid/deactivate', {
            method: 'PATCH',
        })

        const res = await deactivateUser(req, withIdParam('trainee-b-uuid'))
        const body = await res.json()

        expect(vi.mocked(requireAuth)).toHaveBeenCalled()
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('allows trainer A to access own trainee details', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerASession)

        prismaMock.user.findUnique.mockResolvedValue({
            id: 'trainee-a-uuid',
            email: 'trainee.a@zerocento.it',
            firstName: 'Trainee',
            lastName: 'A',
            role: 'trainee',
            isActive: true,
            createdAt: new Date(),
        } as never)

        // Trainer A owns trainee A
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: 'trainer-a-uuid',
            traineeId: 'trainee-a-uuid',
            assignedAt: new Date(),
        } as never)

        const req = makeRequest('http://localhost:3000/api/users/trainee-a-uuid')

        const res = await getUser(req, withIdParam('trainee-a-uuid'))

        expect(vi.mocked(requireAuth)).toHaveBeenCalled()
        expect(res.status).toBe(200)
    })

    it('allows admin to access any user', async () => {
        asAdmin()

        prismaMock.user.findUnique.mockResolvedValue({
            id: 'trainee-b-uuid',
            email: 'trainee.b@zerocento.it',
            firstName: 'Trainee',
            lastName: 'B',
            role: 'trainee',
            isActive: true,
            createdAt: new Date(),
        } as never)

        const req = makeRequest('http://localhost:3000/api/users/trainee-b-uuid')

        const res = await getUser(req, withIdParam('trainee-b-uuid'))

        expect(vi.mocked(requireAuth)).toHaveBeenCalled()
        expect(res.status).toBe(200)
    })
})
