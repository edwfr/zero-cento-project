import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

type Params = {
  params: {
    id: string
  }
}

/**
 * PATCH /api/muscle-groups/[id]/archive
 * Archive muscle group (set isActive = false)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin', 'trainer'])

    const muscleGroup = await prisma.muscleGroup.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    logger.info({ muscleGroupId: params.id }, 'Muscle group archived')

    return apiSuccess({ muscleGroup })
  } catch (error: any) {
    if (error instanceof Response) return error
    logger.error({ error }, 'Error archiving muscle group')
    return apiError('INTERNAL_ERROR', 'Failed to archive muscle group', 500)
  }
}
