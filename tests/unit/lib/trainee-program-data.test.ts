import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: { findUnique: vi.fn(), findFirst: vi.fn() },
        workout: { findMany: vi.fn() },
        exerciseFeedback: { aggregate: vi.fn() },
        setPerformed: { findMany: vi.fn() },
        personalRecord: { findMany: vi.fn() },
        $queryRaw: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { prisma } from '@/lib/prisma'
import {
    loadTraineeProgramView,
    loadActiveProgramId,
} from '@/lib/trainee-program-data'

const traineeId = 'trainee-1'

beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.workout.findMany as any).mockResolvedValue([])
    ;(prisma.$queryRaw as any).mockResolvedValue([])
    ;(prisma.exerciseFeedback.aggregate as any).mockResolvedValue({
        _avg: { actualRpe: null },
        _count: { _all: 0 },
    })
    ;(prisma.setPerformed.findMany as any).mockResolvedValue([])
    ;(prisma.personalRecord.findMany as any).mockResolvedValue([])
})

describe('loadTraineeProgramView', () => {
    it('returns null when program does not exist', async () => {
        let callCount = 0
        ;(prisma.trainingProgram.findUnique as any).mockImplementation(async () => {
            callCount++
            // Both calls (tree and progress) return null when program doesn't exist
            return null
        })
        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })
        expect(result).toBeNull()
    })

    it('returns null when program belongs to another trainee', async () => {
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'p1',
            traineeId: 'other-trainee',
            trainerId: 't1',
            title: 'X',
            startDate: new Date(),
            durationWeeks: 1,
            weeks: [],
            trainer: { firstName: 'A', lastName: 'B' },
            trainee: { firstName: 'C', lastName: 'D' },
        })
        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })
        expect(result).toBeNull()
    })

    it('returns combined { program, progress } for the trainee', async () => {
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'p1',
            traineeId,
            trainerId: 't1',
            status: 'active',
            title: 'My Program',
            startDate: new Date('2026-04-01'),
            durationWeeks: 1,
            weeks: [],
            trainer: { firstName: 'A', lastName: 'B' },
            trainee: { firstName: 'C', lastName: 'D' },
        })

        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })
        expect(result).not.toBeNull()
        expect(result!.program.id).toBe('p1')
        expect(result!.progress.programId).toBe('p1')
        expect(result!.progress.totalWorkouts).toBe(0)
    })
})

describe('loadActiveProgramId', () => {
    it('returns the id when active program exists', async () => {
        ;(prisma.trainingProgram.findFirst as any).mockResolvedValue({ id: 'p1' })
        await expect(loadActiveProgramId(traineeId)).resolves.toBe('p1')
    })

    it('returns null otherwise', async () => {
        ;(prisma.trainingProgram.findFirst as any).mockResolvedValue(null)
        await expect(loadActiveProgramId(traineeId)).resolves.toBeNull()
    })
})
