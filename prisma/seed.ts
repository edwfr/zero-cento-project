import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data (development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('🗑️  Clearing existing data...')
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
    await prisma.movementPatternColor.deleteMany()
    await prisma.movementPattern.deleteMany()
    await prisma.muscleGroup.deleteMany()
    await prisma.user.deleteMany()
  }

  // Create admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@zerocento.app',
      firstName: 'Admin',
      lastName: 'ZeroCento',
      role: 'admin',
      isActive: true,
    },
  })
  console.log('✅ Admin created:', admin.email)

  if (process.env.NODE_ENV === 'development') {
    // Create trainers
    const trainer1 = await prisma.user.create({
      data: {
        email: 'trainer1@zerocento.app',
        firstName: 'Marco',
        lastName: 'Rossi',
        role: 'trainer',
        isActive: true,
      },
    })

    const trainer2 = await prisma.user.create({
      data: {
        email: 'trainer2@zerocento.app',
        firstName: 'Laura',
        lastName: 'Bianchi',
        role: 'trainer',
        isActive: true,
      },
    })
    console.log('✅ Trainers created')

    // Create trainees for trainer1
    const traineesT1 = []
    for (let i = 1; i <= 5; i++) {
      const trainee = await prisma.user.create({
        data: {
          email: `trainee${i}@zerocento.app`,
          firstName: `Trainee${i}`,
          lastName: `T1`,
          role: 'trainee',
          isActive: true,
        },
      })
      traineesT1.push(trainee)

      await prisma.trainerTrainee.create({
        data: {
          trainerId: trainer1.id,
          traineeId: trainee.id,
        },
      })
    }

    // Create trainees for trainer2
    const traineesT2 = []
    for (let i = 6; i <= 10; i++) {
      const trainee = await prisma.user.create({
        data: {
          email: `trainee${i}@zerocento.app`,
          firstName: `Trainee${i}`,
          lastName: `T2`,
          role: 'trainee',
          isActive: true,
        },
      })
      traineesT2.push(trainee)

      await prisma.trainerTrainee.create({
        data: {
          trainerId: trainer2.id,
          traineeId: trainee.id,
        },
      })
    }
    console.log('✅ 10 Trainees created and assigned')

    // Create muscle groups
    const pettorali = await prisma.muscleGroup.create({
      data: {
        name: 'Pettorali',
        description: 'Muscoli del petto',
        createdBy: admin.id,
        isActive: true,
      },
    })

    const quadricipiti = await prisma.muscleGroup.create({
      data: {
        name: 'Quadricipiti',
        description: 'Muscoli anteriori della coscia',
        createdBy: admin.id,
        isActive: true,
      },
    })

    const dorsali = await prisma.muscleGroup.create({
      data: {
        name: 'Dorsali',
        description: 'Muscoli della schiena',
        createdBy: admin.id,
        isActive: true,
      },
    })

    const deltoidi = await prisma.muscleGroup.create({
      data: {
        name: 'Deltoidi',
        description: 'Muscoli delle spalle',
        createdBy: admin.id,
        isActive: true,
      },
    })

    const glutei = await prisma.muscleGroup.create({
      data: {
        name: 'Glutei',
        description: 'Muscoli del sedere',
        createdBy: admin.id,
        isActive: true,
      },
    })
    console.log('✅ 5 Muscle groups created')

    // Create movement patterns
    const squat = await prisma.movementPattern.create({
      data: {
        name: 'Squat',
        description: 'Schema motorio di accosciata',
        createdBy: admin.id,
        isActive: true,
      },
    })

    const horizontalPush = await prisma.movementPattern.create({
      data: {
        name: 'Horizontal Push',
        description: 'Spinta orizzontale',
        createdBy: admin.id,
        isActive: true,
      },
    })

    const hipExtension = await prisma.movementPattern.create({
      data: {
        name: 'Hip Extension',
        description: 'Estensione dell\'anca',
        createdBy: admin.id,
        isActive: true,
      },
    })

    const horizontalPull = await prisma.movementPattern.create({
      data: {
        name: 'Horizontal Pull',
        description: 'Trazione orizzontale',
        createdBy: admin.id,
        isActive: true,
      },
    })

    const verticalPull = await prisma.movementPattern.create({
      data: {
        name: 'Vertical Pull',
        description: 'Trazione verticale',
        createdBy: admin.id,
        isActive: true,
      },
    })
    console.log('✅ 5 Movement patterns created')

    // Create exercises
    const backSquat = await prisma.exercise.create({
      data: {
        name: 'Back Squat',
        description: 'Squat con bilanciere sulla schiena',
        youtubeUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8',
        type: 'fundamental',
        movementPatternId: squat.id,
        notes: ['Piedi larghezza spalle', 'Ginocchia in linea con le punte'],
        createdBy: trainer1.id,
      },
    })

    await prisma.exerciseMuscleGroup.createMany({
      data: [
        { exerciseId: backSquat.id, muscleGroupId: quadricipiti.id, coefficient: 1.0 },
        { exerciseId: backSquat.id, muscleGroupId: glutei.id, coefficient: 0.8 },
      ],
    })

    const benchPress = await prisma.exercise.create({
      data: {
        name: 'Bench Press',
        description: 'Panca piana con bilanciere',
        youtubeUrl: 'https://www.youtube.com/watch?v=gRVjAtPip0Y',
        type: 'fundamental',
        movementPatternId: horizontalPush.id,
        notes: ['Scapole retratte', 'Gomiti a 45 gradi'],
        createdBy: trainer1.id,
      },
    })

    await prisma.exerciseMuscleGroup.createMany({
      data: [
        { exerciseId: benchPress.id, muscleGroupId: pettorali.id, coefficient: 1.0 },
        { exerciseId: benchPress.id, muscleGroupId: deltoidi.id, coefficient: 0.5 },
      ],
    })

    const deadlift = await prisma.exercise.create({
      data: {
        name: 'Deadlift',
        description: 'Stacco da terra',
        youtubeUrl: 'https://www.youtube.com/watch?v=op9kVnSso6Q',
        type: 'fundamental',
        movementPatternId: hipExtension.id,
        notes: ['Schiena neutra', 'Spinta con i piedi'],
        createdBy: trainer1.id,
      },
    })

    await prisma.exerciseMuscleGroup.createMany({
      data: [
        { exerciseId: deadlift.id, muscleGroupId: glutei.id, coefficient: 1.0 },
        { exerciseId: deadlift.id, muscleGroupId: dorsali.id, coefficient: 0.7 },
      ],
    })

    const barbellRow = await prisma.exercise.create({
      data: {
        name: 'Barbell Row',
        description: 'Rematore con bilanciere',
        youtubeUrl: 'https://www.youtube.com/watch?v=FWJR5Ve8bnQ',
        type: 'fundamental',
        movementPatternId: horizontalPull.id,
        notes: ['Busto a 45 gradi', 'Gomiti vicino al corpo'],
        createdBy: trainer1.id,
      },
    })

    await prisma.exerciseMuscleGroup.createMany({
      data: [
        { exerciseId: barbellRow.id, muscleGroupId: dorsali.id, coefficient: 1.0 },
      ],
    })

    const pullUp = await prisma.exercise.create({
      data: {
        name: 'Pull Up',
        description: 'Trazioni alla sbarra',
        youtubeUrl: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
        type: 'fundamental',
        movementPatternId: verticalPull.id,
        notes: ['Presa prona', 'Scapole depresse'],
        createdBy: trainer2.id,
      },
    })

    await prisma.exerciseMuscleGroup.createMany({
      data: [
        { exerciseId: pullUp.id, muscleGroupId: dorsali.id, coefficient: 1.0 },
      ],
    })

    console.log('✅ 5 Fundamental exercises created')

    // Create some accessory exercises
    const dumbbellPress = await prisma.exercise.create({
      data: {
        name: 'Dumbbell Bench Press',
        description: 'Panca con manubri',
        youtubeUrl: 'https://www.youtube.com/watch?v=VmB1G1K7v94',
        type: 'accessory',
        movementPatternId: horizontalPush.id,
        notes: [],
        createdBy: trainer1.id,
      },
    })

    await prisma.exerciseMuscleGroup.createMany({
      data: [
        { exerciseId: dumbbellPress.id, muscleGroupId: pettorali.id, coefficient: 0.9 },
        { exerciseId: dumbbellPress.id, muscleGroupId: deltoidi.id, coefficient: 0.6 },
      ],
    })

    console.log('✅ Accessory exercises created')

    // Create a draft program for trainer1
    const draftProgram = await prisma.trainingProgram.create({
      data: {
        title: 'Programma Forza Base',
        trainerId: trainer1.id,
        traineeId: traineesT1[0].id,
        durationWeeks: 4,
        workoutsPerWeek: 3,
        status: 'draft',
      },
    })

    // Create weeks for draft program
    for (let weekNum = 1; weekNum <= 4; weekNum++) {
      const week = await prisma.week.create({
        data: {
          programId: draftProgram.id,
          weekNumber: weekNum,
          weekType: weekNum === 4 ? 'deload' : 'normal',
          feedbackRequested: false,
        },
      })

      // Create workouts for each week
      for (let dayNum = 1; dayNum <= 3; dayNum++) {
        await prisma.workout.create({
          data: {
            weekId: week.id,
            dayLabel: `Giorno ${dayNum}`,
            notes: null,
          },
        })
      }
    }

    console.log('✅ Draft program created with weeks and workouts')

    // Create an active program for trainer1
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7) // Started 1 week ago

    const activeProgram = await prisma.trainingProgram.create({
      data: {
        title: 'Programma Ipertrofia',
        trainerId: trainer1.id,
        traineeId: traineesT1[1].id,
        startDate: startDate,
        durationWeeks: 6,
        workoutsPerWeek: 4,
        status: 'active',
        publishedAt: startDate,
      },
    })

    // Create weeks for active program with calculated dates
    for (let weekNum = 1; weekNum <= 6; weekNum++) {
      const weekStartDate = new Date(startDate)
      weekStartDate.setDate(weekStartDate.getDate() + (weekNum - 1) * 7)

      const week = await prisma.week.create({
        data: {
          programId: activeProgram.id,
          weekNumber: weekNum,
          startDate: weekStartDate,
          weekType: weekNum === 3 ? 'test' : weekNum === 6 ? 'deload' : 'normal',
          feedbackRequested: weekNum === 3,
        },
      })

      // Create workouts
      for (let dayNum = 1; dayNum <= 4; dayNum++) {
        const workout = await prisma.workout.create({
          data: {
            weekId: week.id,
            dayLabel: `Giorno ${dayNum}`,
            notes: null,
          },
        })

        // Add exercises to first workout only
        if (weekNum === 1 && dayNum === 1) {
          await prisma.workoutExercise.create({
            data: {
              workoutId: workout.id,
              exerciseId: backSquat.id,
              sets: 4,
              reps: '8',
              targetRpe: 8.0,
              weightType: 'absolute',
              weight: 100,
              restTime: 'm3',
              isWarmup: false,
              order: 1,
            },
          })

          await prisma.workoutExercise.create({
            data: {
              workoutId: workout.id,
              exerciseId: benchPress.id,
              sets: 4,
              reps: '8-10',
              targetRpe: 8.5,
              weightType: 'absolute',
              weight: 80,
              restTime: 'm2',
              isWarmup: false,
              order: 2,
            },
          })
        }
      }
    }

    console.log('✅ Active program created')

    // Create personal records
    await prisma.personalRecord.create({
      data: {
        traineeId: traineesT1[1].id,
        exerciseId: backSquat.id,
        reps: 1,
        weight: 140,
        recordDate: new Date(),
        notes: '1RM test',
      },
    })

    await prisma.personalRecord.create({
      data: {
        traineeId: traineesT1[1].id,
        exerciseId: benchPress.id,
        reps: 1,
        weight: 100,
        recordDate: new Date(),
        notes: '1RM test',
      },
    })

    console.log('✅ Personal records created')
  }

  console.log('🎉 Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
