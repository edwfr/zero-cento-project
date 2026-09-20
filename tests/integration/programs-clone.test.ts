import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { POST } from '@/app/api/programs/route'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer } from '../helpers/auth-mock'

const TRAINEE_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const SOURCE_PROGRAM_ID = '00000000-0000-0000-0000-000000000099'
const EX_1 = '00000000-0000-0000-0000-000000000001'
const EX_2 = '00000000-0000-0000-0000-000000000002'

function makePostRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost:3000/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('POST /api/programs - clone branch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({
            id: TRAINEE_ID,
            role: 'trainee',
        } as never)
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: 'trainer-uuid-1',
            traineeId: TRAINEE_ID,
        } as never)
        // Defaults for the clone transaction: the shared $transaction runs the
        // callback against prismaMock, so the tx calls land on these.
        prismaMock.trainingProgram.create.mockResolvedValue({
            id: 'new-prog-id',
            trainerId: 'trainer-uuid-1',
            traineeId: TRAINEE_ID,
            trainer: { id: 'trainer-uuid-1', firstName: 'M', lastName: 'T' },
            trainee: { id: TRAINEE_ID, firstName: 'Mario', lastName: 'Atleta' },
            weeks: [],
        } as never)
        prismaMock.workoutSkeleton.findMany.mockResolvedValue([] as never)
        prismaMock.workoutSkeleton.createMany.mockResolvedValue({ count: 0 } as never)
    })

    it('clones skeleton rows in the same transaction as program creation', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: SOURCE_PROGRAM_ID,
            trainerId: 'trainer-uuid-1',
            workoutsPerWeek: 3,
            status: 'draft',
        } as never)

        prismaMock.workoutSkeleton.createMany.mockResolvedValue({ count: 2 } as never)
        prismaMock.workoutSkeleton.findMany.mockResolvedValue([
            { dayIndex: 0, order: 0, exerciseId: EX_1 },
            { dayIndex: 1, order: 0, exerciseId: EX_2 },
        ] as never)
        prismaMock.trainingProgram.create.mockResolvedValue({
            id: 'new-prog-id',
            trainerId: 'trainer-uuid-1',
            traineeId: TRAINEE_ID,
            trainer: { id: 'trainer-uuid-1', firstName: 'M', lastName: 'T' },
            trainee: { id: TRAINEE_ID, firstName: 'Mario', lastName: 'Atleta' },
            weeks: [],
        })


        const res = await POST(
            makePostRequest({
                title: 'Block B',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3,
                cloneFromProgramId: SOURCE_PROGRAM_ID,
            })
        )

        expect(res.status).toBe(201)
        expect(prismaMock.trainingProgram.create).toHaveBeenCalledOnce()
        expect(prismaMock.workoutSkeleton.findMany).toHaveBeenCalledWith({
            where: { programId: SOURCE_PROGRAM_ID },
            select: { dayIndex: true, order: true, exerciseId: true },
        })
        expect(prismaMock.workoutSkeleton.createMany).toHaveBeenCalledWith({
            data: [
                { programId: 'new-prog-id', dayIndex: 0, order: 0, exerciseId: EX_1 },
                { programId: 'new-prog-id', dayIndex: 1, order: 0, exerciseId: EX_2 },
            ],
        })
    })

    it('creates program with empty skeleton when source has no rows', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: SOURCE_PROGRAM_ID,
            trainerId: 'trainer-uuid-1',
            workoutsPerWeek: 3,
            status: 'draft',
        } as never)

        prismaMock.workoutSkeleton.createMany.mockResolvedValue({ count: 0 } as never)
        prismaMock.trainingProgram.create.mockResolvedValue({
            id: 'new-prog-id',
            trainerId: 'trainer-uuid-1',
            traineeId: TRAINEE_ID,
            trainer: { id: 'trainer-uuid-1', firstName: 'M', lastName: 'T' },
            trainee: { id: TRAINEE_ID, firstName: 'Mario', lastName: 'Atleta' },
            weeks: [],
        })


        const res = await POST(
            makePostRequest({
                title: 'Block C',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3,
                cloneFromProgramId: SOURCE_PROGRAM_ID,
            })
        )

        expect(res.status).toBe(201)
        expect(prismaMock.workoutSkeleton.createMany).not.toHaveBeenCalled()
    })

    it('returns 404 when cloneFromProgramId is unknown', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await POST(
            makePostRequest({
                title: 'Block D',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3,
                cloneFromProgramId: '00000000-0000-0000-0000-0000000000aa',
            })
        )
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('program.cloneSourceNotFound')
    })

    it('returns 403 when trainer does not own the source program', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: SOURCE_PROGRAM_ID,
            trainerId: 'other-trainer-uuid',
            workoutsPerWeek: 3,
            status: 'draft',
        } as never)

        const res = await POST(
            makePostRequest({
                title: 'Block E',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3,
                cloneFromProgramId: SOURCE_PROGRAM_ID,
            })
        )
        const json = await res.json()

        expect(res.status).toBe(403)
        expect(json.error.key).toBe('program.cloneDenied')
    })

    it('returns 400 when workoutsPerWeek differs from source', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: SOURCE_PROGRAM_ID,
            trainerId: 'trainer-uuid-1',
            workoutsPerWeek: 4,
            status: 'draft',
        } as never)

        const res = await POST(
            makePostRequest({
                title: 'Block F',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3,
                cloneFromProgramId: SOURCE_PROGRAM_ID,
            })
        )
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('validation.workoutsPerWeekMismatchWithClone')
    })

    it('allows cloning from an active source program', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: SOURCE_PROGRAM_ID,
            trainerId: 'trainer-uuid-1',
            workoutsPerWeek: 3,
            status: 'active',
        } as never)


        const res = await POST(
            makePostRequest({
                title: 'Block Active',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3,
                cloneFromProgramId: SOURCE_PROGRAM_ID,
            })
        )

        expect(res.status).toBe(201)
    })

    it('allows cloning from a completed source program', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: SOURCE_PROGRAM_ID,
            trainerId: 'trainer-uuid-1',
            workoutsPerWeek: 3,
            status: 'completed',
        } as never)


        const res = await POST(
            makePostRequest({
                title: 'Block Completed',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3,
                cloneFromProgramId: SOURCE_PROGRAM_ID,
            })
        )

        expect(res.status).toBe(201)
    })

    it('rolls back creation when skeleton copy fails', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: SOURCE_PROGRAM_ID,
            trainerId: 'trainer-uuid-1',
            workoutsPerWeek: 3,
            status: 'draft',
        } as never)

        const persistedPrograms: string[] = []

        prismaMock.$transaction.mockImplementation(async (fn: any) => {
            try {
                return await fn({
                    trainingProgram: {
                        create: vi.fn().mockImplementation(async () => {
                            persistedPrograms.push('new-prog-id')
                            return {
                                id: 'new-prog-id',
                                trainerId: 'trainer-uuid-1',
                                traineeId: TRAINEE_ID,
                                trainer: { id: 'trainer-uuid-1', firstName: 'M', lastName: 'T' },
                                trainee: { id: TRAINEE_ID, firstName: 'Mario', lastName: 'Atleta' },
                                weeks: [],
                            }
                        }),
                    },
                    workoutSkeleton: {
                        findMany: vi.fn().mockResolvedValue([{ dayIndex: 0, order: 0, exerciseId: EX_1 }]),
                        createMany: vi.fn().mockRejectedValue(new Error('skeleton-copy-failure')),
                    },
                })
            } catch (error) {
                persistedPrograms.length = 0
                throw error
            }
        })

        const res = await POST(
            makePostRequest({
                title: 'Block Rollback',
                traineeId: TRAINEE_ID,
                isSbdProgram: false,
                durationWeeks: 4,
                workoutsPerWeek: 3,
                cloneFromProgramId: SOURCE_PROGRAM_ID,
            })
        )
        const json = await res.json()

        expect(res.status).toBe(500)
        expect(json.error.code).toBe('INTERNAL_ERROR')
        expect(persistedPrograms).toHaveLength(0)
    })
})
