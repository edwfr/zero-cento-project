import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { createClient, type User } from '@supabase/supabase-js'

config()

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL || process.env.DIRECT_URL } },
})

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

const TRAINER_EMAIL = 'edoardo.frati.coach@zerocento.app'
const TRAINEE = {
    email: 'edoardo.frati.trainee.test@zerocento.app',
    firstName: 'Edoardo',
    lastName: 'Frati Trainee',
    password: 'Trainee1234!',
}

async function getSupabaseUserByEmail(email: string): Promise<User | null> {
    let page = 1
    const perPage = 200

    while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
        if (error) throw new Error(`Failed to list Supabase users: ${error.message}`)

        const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
        if (found) return found

        if (data.users.length < perPage) return null
        page += 1
    }
}

async function createOrGetSupabaseTrainee() {
    const existing = await getSupabaseUserByEmail(TRAINEE.email)
    if (existing) {
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password: TRAINEE.password,
            email_confirm: true,
            user_metadata: {
                ...(existing.user_metadata ?? {}),
                role: 'trainee',
                firstName: TRAINEE.firstName,
                lastName: TRAINEE.lastName,
                isActive: true,
            },
        })
        return { user: existing, created: false }
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: TRAINEE.email,
        password: TRAINEE.password,
        email_confirm: true,
        user_metadata: {
            role: 'trainee',
            firstName: TRAINEE.firstName,
            lastName: TRAINEE.lastName,
            isActive: true,
        },
    })

    if (error) throw new Error(`Failed to create Supabase user: ${error.message}`)
    if (!data.user) throw new Error('Supabase user missing in create response')

    return { user: data.user, created: true }
}

async function main() {
    const trainer = await prisma.user.findFirst({
        where: { email: TRAINER_EMAIL, role: 'trainer' },
        select: { id: true, email: true },
    })
    if (!trainer) throw new Error(`Trainer not found or not trainer role: ${TRAINER_EMAIL}`)

    const { user: supabaseUser, created } = await createOrGetSupabaseTrainee()

    const trainee = await prisma.user.upsert({
        where: { email: TRAINEE.email },
        update: {
            id: supabaseUser.id,
            firstName: TRAINEE.firstName,
            lastName: TRAINEE.lastName,
            role: 'trainee',
            isActive: true,
        },
        create: {
            id: supabaseUser.id,
            email: TRAINEE.email,
            firstName: TRAINEE.firstName,
            lastName: TRAINEE.lastName,
            role: 'trainee',
            isActive: true,
        },
    })

    const link = await prisma.trainerTrainee.findFirst({
        where: { trainerId: trainer.id, traineeId: trainee.id },
        select: { trainerId: true },
    })

    if (!link) {
        await prisma.trainerTrainee.create({
            data: { trainerId: trainer.id, traineeId: trainee.id },
        })
    }

    console.log(`✅ Trainer: ${trainer.email}`)
    console.log(`✅ Trainee: ${TRAINEE.email}`)
    console.log(`✅ Password set to: ${TRAINEE.password}`)
    console.log(`✅ Supabase user: ${created ? 'created' : 'already present (updated)'}`)
    console.log(`✅ Trainer-Trainee link: ${link ? 'already present' : 'created'}`)
}

main()
    .catch((error) => {
        console.error('❌ Failed:', error instanceof Error ? error.message : error)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })