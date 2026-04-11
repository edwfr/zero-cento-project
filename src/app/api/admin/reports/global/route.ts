import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/reports/global
 * System-wide analytics for admin dashboard
 * RBAC: admin only
 */
export async function GET(request: NextRequest) {
    try {
        await requireRole(['admin'])

        const [
            totalUsers,
            trainerCount,
            traineeCount,
            activePrograms,
            completedPrograms,
            draftPrograms,
            totalExercises,
            totalFeedback,
            totalRecords,
            recentUsers,
            recentPrograms,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { role: 'trainer' } }),
            prisma.user.count({ where: { role: 'trainee' } }),
            prisma.trainingProgram.count({ where: { status: 'active' } }),
            prisma.trainingProgram.count({ where: { status: 'completed' } }),
            prisma.trainingProgram.count({ where: { status: 'draft' } }),
            prisma.exercise.count(),
            prisma.exerciseFeedback.count(),
            prisma.personalRecord.count(),
            prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                },
            }),
            prisma.trainingProgram.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    title: true,
                    status: true,
                    createdAt: true,
                    trainer: {
                        select: { firstName: true, lastName: true },
                    },
                    trainee: {
                        select: { firstName: true, lastName: true },
                    },
                },
            }),
        ])

        // Volume totale da setsPerformed
        const volumeAgg = await prisma.setPerformed.aggregate({
            _sum: { weight: true, reps: true },
        })
        const allSets = await prisma.setPerformed.findMany({
            select: { reps: true, weight: true },
        })
        const totalVolume = allSets.reduce((sum, s) => sum + s.reps * s.weight, 0)

        logger.info({ userId: 'admin' }, 'Global admin report fetched')

        return apiSuccess({
            users: { total: totalUsers, trainers: trainerCount, trainees: traineeCount },
            programs: { active: activePrograms, completed: completedPrograms, draft: draftPrograms, total: activePrograms + completedPrograms + draftPrograms },
            exercises: { total: totalExercises },
            feedback: { total: totalFeedback },
            records: { total: totalRecords },
            volume: { total: Math.round(totalVolume) },
            recentUsers,
            recentPrograms,
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching global admin report')
        return apiError('INTERNAL_ERROR', 'Failed to fetch global report', 500, undefined, 'internal.globalReportFailed')
    }
}
