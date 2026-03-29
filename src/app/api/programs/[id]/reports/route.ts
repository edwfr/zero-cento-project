import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * GET /api/programs/[id]/reports
 * Get detailed program analytics and reports
 * - SBD (Squat/Bench/Deadlift) volume, training sets, intensity, RPE
 * - Training sets per muscle group
 * - Volume per movement pattern
 * RBAC: trainer owner, admin, assigned trainee
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])
        const programId = params.id

        // Fetch program with full structure
        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            include: {
                trainee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                weeks: {
                    include: {
                        workouts: {
                            include: {
                                workoutExercises: {
                                    include: {
                                        exercise: {
                                            include: {
                                                movementPattern: {
                                                    select: {
                                                        id: true,
                                                        name: true,
                                                    },
                                                },
                                                exerciseMuscleGroups: {
                                                    include: {
                                                        muscleGroup: {
                                                            select: {
                                                                id: true,
                                                                name: true,
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                        exerciseFeedbacks: {
                                            include: {
                                                setsPerformed: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { weekNumber: 'asc' },
                },
            },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404)
        }

        // RBAC: Check access
        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view your own programs', 403)
        }

        if (session.user.role === 'trainee' && program.traineeId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view programs assigned to you', 403)
        }

        // Helper function to calculate training sets (excluding warmup)
        const calculateTrainingSets = (workoutExercises: any[]) => {
            return workoutExercises
                .filter((we) => !we.isWarmup)
                .reduce((sum, we) => sum + (we.sets || 0), 0)
        }

        // Helper function to calculate executed training sets from feedback
        const calculateExecutedTrainingSets = (workoutExercises: any[]) => {
            return workoutExercises
                .filter((we) => !we.isWarmup)
                .flatMap((we) => we.exerciseFeedbacks)
                .flatMap((fb: any) => fb.setsPerformed).length
        }

        // Helper to get Personal Records for trainee
        const personalRecords = await prisma.personalRecord.findMany({
            where: { traineeId: program.traineeId },
            include: {
                exercise: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        })

        const getOneRM = (exerciseId: string) => {
            const record = personalRecords.find(
                (pr) => pr.exerciseId === exerciseId && pr.reps === 1
            )
            return record?.weight || null
        }

        // --- SBD REPORT ---
        // Identify SBD exercises (by name matching - could be improved with tags)
        const sbdPatterns = {
            squat: ['squat', 'back squat', 'front squat', 'box squat'],
            bench: ['bench press', 'bench', 'panca'],
            deadlift: ['deadlift', 'stacco', 'stacco da terra'],
        }

        const allWorkoutExercises = program.weeks
            .flatMap((week) => week.workouts)
            .flatMap((workout) => workout.workoutExercises)

        const matchSBD = (exerciseName: string): 'squat' | 'bench' | 'deadlift' | null => {
            const lowerName = exerciseName.toLowerCase()
            if (sbdPatterns.squat.some((pattern) => lowerName.includes(pattern))) return 'squat'
            if (sbdPatterns.bench.some((pattern) => lowerName.includes(pattern))) return 'bench'
            if (sbdPatterns.deadlift.some((pattern) => lowerName.includes(pattern)))
                return 'deadlift'
            return null
        }

        const sbdReport: any = {
            squat: { volume: 0, trainingSets: 0, avgIntensity: null, avgRPE: null },
            bench: { volume: 0, trainingSets: 0, avgIntensity: null, avgRPE: null },
            deadlift: { volume: 0, trainingSets: 0, avgIntensity: null, avgRPE: null },
        }

        const sbdIntensities: any = { squat: [], bench: [], deadlift: [] }
        const sbdRPEs: any = { squat: [], bench: [], deadlift: [] }

        allWorkoutExercises.forEach((we) => {
            const sbdType = matchSBD(we.exercise.name)
            if (!sbdType || we.isWarmup) return

            const feedbacks = we.exerciseFeedbacks
            feedbacks.forEach((fb: any) => {
                // Volume
                const feedbackVolume = fb.setsPerformed.reduce(
                    (sum: number, set: any) => sum + set.reps * set.weight,
                    0
                )
                sbdReport[sbdType].volume += feedbackVolume

                // Training sets
                sbdReport[sbdType].trainingSets += fb.setsPerformed.length

                // RPE
                if (fb.actualRpe !== null) {
                    sbdRPEs[sbdType].push(fb.actualRpe)
                }

                // Intensity (% 1RM)
                const oneRM = getOneRM(we.exerciseId)
                if (oneRM) {
                    fb.setsPerformed.forEach((set: any) => {
                        const intensity = (set.weight / oneRM) * 100
                        sbdIntensities[sbdType].push(intensity)
                    })
                }
            })
        })

        // Calculate averages
        Object.keys(sbdReport).forEach((key) => {
            const type = key as 'squat' | 'bench' | 'deadlift'
            if (sbdIntensities[type].length > 0) {
                sbdReport[type].avgIntensity =
                    Math.round(
                        (sbdIntensities[type].reduce((a: number, b: number) => a + b, 0) /
                            sbdIntensities[type].length) *
                        10
                    ) / 10
            }
            if (sbdRPEs[type].length > 0) {
                sbdReport[type].avgRPE =
                    Math.round(
                        (sbdRPEs[type].reduce((a: number, b: number) => a + b, 0) /
                            sbdRPEs[type].length) *
                        10
                    ) / 10
            }
        })

        // --- TRAINING SETS PER MUSCLE GROUP ---
        const muscleGroupSets: Record<string, { name: string; sets: number }> = {}

        allWorkoutExercises.forEach((we) => {
            if (we.isWarmup) return

            const exerciseSets = we.exerciseFeedbacks.length > 0
                ? we.exerciseFeedbacks.flatMap((fb: any) => fb.setsPerformed).length
                : we.sets || 0

            we.exercise.exerciseMuscleGroups.forEach((emg: any) => {
                const mgId = emg.muscleGroup.id
                const mgName = emg.muscleGroup.name
                const weightedSets = exerciseSets * emg.coefficient

                if (!muscleGroupSets[mgId]) {
                    muscleGroupSets[mgId] = { name: mgName, sets: 0 }
                }
                muscleGroupSets[mgId].sets += weightedSets
            })
        })

        const muscleGroupReport = Object.entries(muscleGroupSets)
            .map(([id, data]) => ({
                muscleGroupId: id,
                muscleGroupName: data.name,
                trainingSets: Math.round(data.sets * 10) / 10,
            }))
            .sort((a, b) => b.trainingSets - a.trainingSets)

        const totalMGSets = muscleGroupReport.reduce((sum, mg) => sum + mg.trainingSets, 0)

        muscleGroupReport.forEach((mg: any) => {
            mg.percentage = totalMGSets > 0 ? Math.round((mg.trainingSets / totalMGSets) * 100) : 0
        })

        // --- VOLUME PER MOVEMENT PATTERN ---
        const movementPatternVolume: Record<string, { name: string; volume: number }> = {}

        allWorkoutExercises.forEach((we) => {
            const mpId = we.exercise.movementPattern.id
            const mpName = we.exercise.movementPattern.name

            const feedbackVolume = we.exerciseFeedbacks.reduce(
                (sum: number, fb: any) =>
                    sum +
                    fb.setsPerformed.reduce(
                        (setSum: number, set: any) => setSum + set.reps * set.weight,
                        0
                    ),
                0
            )

            if (!movementPatternVolume[mpId]) {
                movementPatternVolume[mpId] = { name: mpName, volume: 0 }
            }
            movementPatternVolume[mpId].volume += feedbackVolume
        })

        const movementPatternReport = Object.entries(movementPatternVolume)
            .map(([id, data]) => ({
                movementPatternId: id,
                movementPatternName: data.name,
                volume: Math.round(data.volume),
            }))
            .sort((a, b) => b.volume - a.volume)

        const totalMPVolume = movementPatternReport.reduce((sum, mp) => sum + mp.volume, 0)

        movementPatternReport.forEach((mp: any) => {
            mp.percentage = totalMPVolume > 0 ? Math.round((mp.volume / totalMPVolume) * 100) : 0
        })

        logger.info({ programId, userId: session.user.id }, 'Program reports fetched successfully')

        return apiSuccess({
            programId: program.id,
            programName: program.title,
            trainee: program.trainee,
            sbd: sbdReport,
            muscleGroups: muscleGroupReport,
            movementPatterns: movementPatternReport,
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId: params.id }, 'Error fetching program reports')
        return apiError('INTERNAL_ERROR', 'Failed to fetch program reports', 500)
    }
}
