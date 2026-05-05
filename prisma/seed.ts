import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

config()

// Use DATABASE_URL (pooled, port 6543) for seeding since DIRECT_URL (port 5432) 
// may be blocked on restricted networks like mobile hotspots
const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL

const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
})

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

type SeedTrainer = {
    email: string
    firstName: string
    lastName: string
    trainees: Array<{ email: string; firstName: string; lastName: string }>
}

const TRAINERS: SeedTrainer[] = [
    {
        email: 'filippo.bittoni@zerocento.app',
        firstName: 'Filippo',
        lastName: 'Bittoni',
        trainees: [
            { email: 'nicoletta.ciriachi@zerocento.app', firstName: 'Nicoletta', lastName: 'Ciriachi' },
            { email: 'luca.cormano@zerocento.app', firstName: 'Luca', lastName: 'Cormano' },
            { email: 'luca.casagrande@zerocento.app', firstName: 'Luca', lastName: 'Casagrande' },
        ],
    },
    {
        email: 'edoardo.frati.coach@zerocento.app',
        firstName: 'Edoardo',
        lastName: 'Frati Coach',
        trainees: [
            { email: 'edoardo.frati.trainee@zerocento.app', firstName: 'Edoardo', lastName: 'Frati Trainee' },
        ],
    },
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

    // Step 5: create trainers + their trainees in Supabase + Prisma
    const trainerPassword = process.env.SEED_TRAINER_PASSWORD ?? 'Trainer1234!'
    const traineePassword = process.env.SEED_TRAINEE_PASSWORD ?? 'Trainee1234!'

    for (const trainerSpec of TRAINERS) {
        const trainerSupabase = await createSupabaseUser(trainerSpec.email, trainerPassword, {
            role: 'trainer',
            firstName: trainerSpec.firstName,
            lastName: trainerSpec.lastName,
            isActive: true,
        })
        const trainer = await prisma.user.create({
            data: {
                id: trainerSupabase.id,
                email: trainerSpec.email,
                firstName: trainerSpec.firstName,
                lastName: trainerSpec.lastName,
                role: 'trainer',
                isActive: true,
            },
        })
        console.log(`  ✅ ${trainerSpec.email} / ${trainerPassword}`)

        for (const traineeSpec of trainerSpec.trainees) {
            const traineeSupabase = await createSupabaseUser(traineeSpec.email, traineePassword, {
                role: 'trainee',
                firstName: traineeSpec.firstName,
                lastName: traineeSpec.lastName,
                isActive: true,
            })
            const trainee = await prisma.user.create({
                data: {
                    id: traineeSupabase.id,
                    email: traineeSpec.email,
                    firstName: traineeSpec.firstName,
                    lastName: traineeSpec.lastName,
                    role: 'trainee',
                    isActive: true,
                },
            })
            await prisma.trainerTrainee.create({
                data: { trainerId: trainer.id, traineeId: trainee.id },
            })
            console.log(`  ✅ ${traineeSpec.email} / ${traineePassword}`)
        }
    }

    console.log('\n🎉 Seeding completed!')
    console.log('\n📋 Credentials summary:')
    console.log(`  admin     → admin@zerocento.app  / ${process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!'}`)
    console.log(`  trainers  → <firstname>.<lastname>@zerocento.app  / ${trainerPassword}`)
    console.log(`  trainees  → <firstname>.<lastname>@zerocento.app  / ${traineePassword}`)
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
