import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

config()

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL || process.env.DIRECT_URL } },
})

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

const TRAINER_EMAIL = 'filippo.bittoni@zerocento.app'

const TRAINEE = {
    email: 'filippo.test@zerocento.app',
    firstName: 'Filippo',
    lastName: 'Test',
    password: 'Trainee1234!',
}

async function main() {
    // Find trainer
    const trainer = await prisma.user.findUnique({ where: { email: TRAINER_EMAIL } })
    if (!trainer) throw new Error(`Trainer not found: ${TRAINER_EMAIL}`)

    // Check trainee doesn't already exist
    const existing = await prisma.user.findUnique({ where: { email: TRAINEE.email } })
    if (existing) throw new Error(`User already exists: ${TRAINEE.email}`)

    // Create in Supabase
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
    if (error) throw new Error(`Supabase error: ${error.message}`)

    // Create in Prisma
    const trainee = await prisma.user.create({
        data: {
            id: data.user.id,
            email: TRAINEE.email,
            firstName: TRAINEE.firstName,
            lastName: TRAINEE.lastName,
            role: 'trainee',
            isActive: true,
        },
    })

    // Link to trainer
    await prisma.trainerTrainee.create({
        data: { trainerId: trainer.id, traineeId: trainee.id },
    })

    console.log(`✅ Created trainee: ${TRAINEE.email} / ${TRAINEE.password}`)
    console.log(`✅ Linked to trainer: ${TRAINER_EMAIL}`)
}

main()
    .catch((e) => {
        console.error('❌ Failed:', e.message)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
