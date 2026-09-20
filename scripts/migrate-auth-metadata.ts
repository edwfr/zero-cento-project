/**
 * One-off migration: copy authorization data from Prisma (source of truth) into
 * Supabase app_metadata, which only the service role can write.
 *
 * Must run BEFORE deploying the code that reads app_metadata. Until a user is
 * migrated, getSession() falls back to Prisma, so nothing breaks either way.
 *
 * Usage:
 *   npm run migrate:auth-metadata -- --dry-run   # report only, no writes
 *   npm run migrate:auth-metadata                # apply
 *
 * The old user_metadata fields are intentionally left in place: the new code
 * ignores them, and keeping them makes a rollback possible. Clean them up in a
 * later pass once the release is settled.
 */
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

config()

const DRY_RUN = process.argv.includes('--dry-run')

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
})

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
    const users = await prisma.user.findMany({
        select: { id: true, email: true, role: true, isActive: true },
        orderBy: { email: 'asc' },
    })

    console.log(`${users.length} users found${DRY_RUN ? ' (dry run — no writes)' : ''}\n`)

    let ok = 0
    let failed = 0
    let missing = 0
    let tampered = 0

    // Legacy rows can have a Prisma id that does not match the Supabase one
    // (getSession falls back to a lookup by email, so they still work). Index
    // the auth users by email so those accounts are migrated too.
    const authUsersByEmail = new Map<string, { id: string; app_metadata: unknown; user_metadata: unknown }>()
    for (let page = 1; ; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
        if (error) throw error
        for (const authUser of data.users) {
            if (authUser.email) authUsersByEmail.set(authUser.email.toLowerCase(), authUser)
        }
        if (data.users.length < 1000) break
    }

    for (const user of users) {
        const { data: byId } = await supabase.auth.admin.getUserById(user.id)
        const authUser = byId.user ?? authUsersByEmail.get(user.email.toLowerCase())

        if (!authUser) {
            console.warn(`SKIP  ${user.email}: not found in Supabase Auth`)
            missing++
            continue
        }

        if (!byId.user) {
            console.warn(
                `NOTE  ${user.email}: matched by email, Supabase id ${authUser.id} != Prisma id ${user.id}`
            )
        }

        const appMeta = (authUser.app_metadata ?? {}) as Record<string, unknown>
        const userMeta = (authUser.user_metadata ?? {}) as Record<string, unknown>

        // A user_metadata role that disagrees with the database is a sign the
        // user wrote it themselves with the anon key (the bug this fixes).
        if (
            (userMeta.role !== undefined && userMeta.role !== user.role) ||
            (userMeta.isActive !== undefined && userMeta.isActive !== user.isActive)
        ) {
            console.warn(
                `WARN  ${user.email}: user_metadata disagrees with the database ` +
                    `(metadata role=${String(userMeta.role)} isActive=${String(userMeta.isActive)}, ` +
                    `db role=${user.role} isActive=${user.isActive})`
            )
            tampered++
        }

        const next: Record<string, unknown> = {
            ...appMeta,
            role: user.role,
            isActive: user.isActive,
            ...(userMeta.mustChangePassword !== undefined
                ? { mustChangePassword: userMeta.mustChangePassword }
                : {}),
        }

        if (DRY_RUN) {
            console.log(`DRY   ${user.email} → ${JSON.stringify(next)}`)
            ok++
            continue
        }

        const { error } = await supabase.auth.admin.updateUserById(authUser.id, { app_metadata: next })

        if (error) {
            console.error(`FAIL  ${user.email}: ${error.message}`)
            failed++
        } else {
            console.log(`OK    ${user.email} → role=${user.role} isActive=${user.isActive}`)
            ok++
        }
    }

    console.log(`\nDone: ${ok} ok, ${failed} failed, ${missing} missing from Supabase Auth`)

    if (tampered > 0) {
        console.warn(
            `\n${tampered} user(s) had user_metadata disagreeing with the database. ` +
                `Review them: this is what a privilege-escalation attempt looks like.`
        )
    }

    if (failed > 0) process.exitCode = 1
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
