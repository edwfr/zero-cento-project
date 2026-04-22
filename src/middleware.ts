import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { Redis } from '@upstash/redis/cloudflare'
import { logger } from './lib/logger'

// Rate limiting stores
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    : null

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/force-change-password', '/onboarding/set-password']
const API_PUBLIC_ROUTES = ['/api/health']
const PUBLIC_FILES = ['/sw.js', '/manifest.json', '/robots.txt', '/sitemap.xml']

/**
 * Rate limiting check
 */
async function checkRateLimit(
    identifier: string,
    limit: number,
    windowMs: number,
    useRedis = false
): Promise<boolean> {
    if (useRedis && redis) {
        // Use Redis for auth endpoints
        const key = `ratelimit:${identifier}`
        const current = await redis.get<number>(key)

        if (current && current >= limit) {
            return false
        }

        const pipeline = redis.pipeline()
        pipeline.incr(key)
        if (!current) {
            pipeline.expire(key, Math.ceil(windowMs / 1000))
        }
        await pipeline.exec()

        return true
    } else {
        // Use in-memory Map for other endpoints
        const now = Date.now()
        const record = rateLimitStore.get(identifier)

        if (!record || now > record.resetAt) {
            rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs })
            return true
        }

        if (record.count >= limit) {
            return false
        }

        record.count++
        return true
    }
}

/**
 * Get rate limit config based on route
 */
function getRateLimitConfig(pathname: string): { limit: number; windowMs: number; useRedis: boolean } {
    // Auth endpoints - strict limits with Redis
    if (pathname.includes('/login') || pathname.includes('/signup')) {
        return { limit: 5, windowMs: 15 * 60 * 1000, useRedis: true } // 5 per 15 min
    }

    if (pathname.includes('/forgot-password') || pathname.includes('/reset-password')) {
        return { limit: 3, windowMs: 60 * 60 * 1000, useRedis: true } // 3 per hour
    }

    // Feedback endpoints - higher limit
    if (pathname.includes('/api/feedback')) {
        return { limit: 30, windowMs: 60 * 1000, useRedis: false } // 30 per minute
    }

    // User creation - moderate limit
    if (pathname === '/api/users' || pathname.includes('/api/admin/users')) {
        return { limit: 20, windowMs: 60 * 60 * 1000, useRedis: false } // 20 per hour
    }

    // Read endpoints — explicit 100/min, Redis-backed for cross-instance consistency on Vercel
    if (
        pathname === '/api/exercises' ||
        pathname.startsWith('/api/exercises/') ||
        pathname === '/api/programs' ||
        pathname.startsWith('/api/programs/') ||
        pathname === '/api/personal-records' ||
        pathname.startsWith('/api/personal-records/')
    ) {
        return { limit: 100, windowMs: 60 * 1000, useRedis: true } // 100 per minute
    }

    // Default API limits
    return { limit: 100, windowMs: 60 * 1000, useRedis: false } // 100 per minute
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Skip auth and rate limiting for public routes and public static files required before login.
    if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
        return NextResponse.next()
    }

    if (PUBLIC_FILES.includes(pathname)) {
        return NextResponse.next()
    }

    // Skip auth for API health check
    if (API_PUBLIC_ROUTES.includes(pathname)) {
        return NextResponse.next()
    }

    // Rate limiting - skip in development
    if (process.env.NODE_ENV !== 'development') {
        const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        const rateLimitKey = `${clientIp}:${pathname}`
        const rateLimitConfig = getRateLimitConfig(pathname)

        const allowed = await checkRateLimit(
            rateLimitKey,
            rateLimitConfig.limit,
            rateLimitConfig.windowMs,
            rateLimitConfig.useRedis
        )

        if (!allowed) {
            logger.warn({ clientIp, pathname }, 'Rate limit exceeded')
            return NextResponse.json(
                {
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: 'Too many requests. Please try again later.',
                    },
                },
                {
                    status: 429,
                    headers: { 'Retry-After': String(Math.ceil(rateLimitConfig.windowMs / 1000)) },
                }
            )
        }
    }

    // Create Supabase client
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({ name, value, ...options })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({ name, value: '', ...options })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({ name, value: '', ...options })
                },
            },
        }
    )

    // Validate the current user with Supabase Auth and refresh tokens if needed.
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Redirect to login if not authenticated (except for API routes)
    if (!user && !pathname.startsWith('/api')) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // For API routes, return 401 if not authenticated
    if (!user && pathname.startsWith('/api') && !API_PUBLIC_ROUTES.includes(pathname)) {
        return NextResponse.json(
            {
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
            },
            { status: 401 }
        )
    }

    // Check if user must change password (except for force-change-password page and API)
    if (user && !pathname.startsWith('/force-change-password') && !pathname.startsWith('/api')) {
        const mustChangePassword = user.user_metadata?.mustChangePassword
        if (mustChangePassword) {
            const url = request.nextUrl.clone()
            url.pathname = '/force-change-password'
            return NextResponse.redirect(url)
        }
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public assets and common metadata files
         */
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|webmanifest)$).*)',
    ],
}
