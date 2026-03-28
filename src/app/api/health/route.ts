import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase-server'
import { apiSuccess, apiError } from '@/lib/api-response'
import { logger } from '@/lib/logger'

/**
 * Health Check Endpoint
 * Tests database and auth connectivity
 * GET /api/health
 */
export async function GET() {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`
    logger.info('Database health check passed')

    // Test Supabase auth
    const supabase = createClient()
    const { error: authError } = await supabase.auth.getSession()
    
    if (authError) {
      logger.warn({ error: authError }, 'Supabase auth health check failed')
    } else {
      logger.info('Supabase auth health check passed')
    }

    return apiSuccess({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        auth: authError ? 'degraded' : 'up',
      },
    })
  } catch (error) {
    logger.error({ error }, 'Health check failed')
    return apiError(
      'INTERNAL_ERROR',
      'Service unhealthy',
      503,
      {
        database: 'down',
      }
    )
  }
}
