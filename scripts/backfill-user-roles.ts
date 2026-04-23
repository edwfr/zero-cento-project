import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

config()

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
        select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true },
    })

    console.log(`Found ${users.length} users to backfill`)

    let ok = 0
    let failed = 0

    for (const user of users) {
        const { data: existing } = await supabase.auth.admin.getUserById(user.id)
        const currentMeta = existing.user?.user_metadata ?? {}

        const { error } = await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: {
                ...currentMeta,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                isActive: user.isActive,
            },
        })

        if (error) {
            console.error(`FAIL  ${user.email}: ${error.message}`)
            failed++
        } else {
            console.log(`OK    ${user.email} → role=${user.role} isActive=${user.isActive}`)
            ok++
        }
    }

    console.log(`\nDone: ${ok} updated, ${failed} failed`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
