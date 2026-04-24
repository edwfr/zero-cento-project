import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

config()

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL

const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
})

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

const SEED_USERS = [
    {
        email: 'admin@zerocento.app',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!',
        firstName: 'Admin',
        lastName: 'ZeroCento',
        role: 'admin' as const,
    },
    {
        email: 'trainer@zerocento.app',
        password: process.env.SEED_TRAINER_PASSWORD ?? 'Trainer1234!',
        firstName: 'Marco',
        lastName: 'Rossi',
        role: 'trainer' as const,
    },
    ...Array.from({ length: 4 }, (_, i) => ({
        email: `trainee${i + 1}@zerocento.app`,
        password: process.env.SEED_TRAINEE_PASSWORD ?? 'Trainee1234!',
        firstName: `Trainee${i + 1}`,
        lastName: 'Rossi',
        role: 'trainee' as const,
    })),
]

async function deleteAllSupabaseUsers() {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (error) throw new Error(`Failed to list Supabase users: ${error.message}`)

    for (const user of data.users) {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
        if (deleteError) throw new Error(`Failed to delete Supabase user ${user.email}: ${deleteError.message}`)
    }
    console.log(`✅ Deleted ${data.users.length} Supabase auth users`)
}

async function createSupabaseUser(
    email: string,
    password: string,
    metadata: { role: string; firstName: string; lastName: string; isActive: boolean }
) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
    })
    if (error) throw new Error(`Failed to create Supabase user ${email}: ${error.message}`)
    return data.user
}

async function main() {
    console.log('🌱 Seeding database...')

    // Step 1: anchor admin in Prisma so muscle groups / movement patterns FK stays valid
    const anchorAdmin = await prisma.user.upsert({
        where: { email: 'admin@zerocento.app' },
        update: {},
        create: {
            email: 'admin@zerocento.app',
            firstName: 'Admin',
            lastName: 'ZeroCento',
            role: 'admin',
            isActive: true,
        },
    })

    await prisma.muscleGroup.updateMany({ data: { createdBy: anchorAdmin.id } })
    await prisma.movementPattern.updateMany({ data: { createdBy: anchorAdmin.id } })

    // Step 2: clear Prisma data (keep admin + muscle groups + movement patterns)
    console.log('🗑️  Clearing Prisma data...')
    await prisma.setPerformed.deleteMany()
    await prisma.exerciseFeedback.deleteMany()
    await prisma.personalRecord.deleteMany()
    await prisma.workoutExercise.deleteMany()
    await prisma.workout.deleteMany()
    await prisma.week.deleteMany()
    await prisma.trainingProgram.deleteMany()
    await prisma.trainerTrainee.deleteMany()
    await prisma.exerciseMuscleGroup.deleteMany()
    await prisma.exercise.deleteMany()
    await prisma.user.deleteMany({ where: { id: { not: anchorAdmin.id } } })

    // Step 3: clear all Supabase auth users
    console.log('🗑️  Clearing Supabase auth users...')
    await deleteAllSupabaseUsers()

    // Step 4: recreate admin in Supabase + update Prisma record
    console.log('👤 Creating users...')
    await createSupabaseUser(anchorAdmin.email, process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!', {
        role: 'admin',
        firstName: 'Admin',
        lastName: 'ZeroCento',
        isActive: true,
    })
    console.log(`  ✅ admin@zerocento.app / ${process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!'}`)

    // Step 5: create trainer in Supabase + Prisma
    const trainerSupabase = await createSupabaseUser('trainer@zerocento.app', process.env.SEED_TRAINER_PASSWORD ?? 'Trainer1234!', {
        role: 'trainer',
        firstName: 'Marco',
        lastName: 'Rossi',
        isActive: true,
    })
    const trainer = await prisma.user.create({
        data: {
            id: trainerSupabase.id,
            email: 'trainer@zerocento.app',
            firstName: 'Marco',
            lastName: 'Rossi',
            role: 'trainer',
            isActive: true,
        },
    })
    console.log(`  ✅ trainer@zerocento.app / ${process.env.SEED_TRAINER_PASSWORD ?? 'Trainer1234!'}`)

    // Step 6: create trainees in Supabase + Prisma
    const traineePassword = process.env.SEED_TRAINEE_PASSWORD ?? 'Trainee1234!'
    for (let i = 1; i <= 4; i++) {
        const email = `trainee${i}@zerocento.app`
        const traineeSupabase = await createSupabaseUser(email, traineePassword, {
            role: 'trainee',
            firstName: `Trainee${i}`,
            lastName: 'Rossi',
            isActive: true,
        })
        const trainee = await prisma.user.create({
            data: {
                id: traineeSupabase.id,
                email,
                firstName: `Trainee${i}`,
                lastName: 'Rossi',
                role: 'trainee',
                isActive: true,
            },
        })
        await prisma.trainerTrainee.create({
            data: { trainerId: trainer.id, traineeId: trainee.id },
        })
        console.log(`  ✅ ${email} / ${traineePassword}`)
    }

    console.log('\n🎉 Seeding completed!')
    console.log('\n📋 Credentials summary:')
    console.log(`  admin     → admin@zerocento.app       / ${process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!'}`)
    console.log(`  trainer   → trainer@zerocento.app     / ${process.env.SEED_TRAINER_PASSWORD ?? 'Trainer1234!'}`)
    console.log(`  trainees  → trainee1-4@zerocento.app  / ${traineePassword}`)
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
