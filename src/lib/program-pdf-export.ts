type WeekType = 'normal' | 'test' | 'deload'
type WeightType = 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
type RestTime = 's30' | 'm1' | 'm2' | 'm3' | 'm5'

export interface ProgramPdfExercise {
    id: string
    name: string
    variant: string | null
    type: 'fundamental' | 'accessory'
    isWarmup: boolean
    sets: number
    reps: string
    targetRpe: number | null
    weightType: WeightType
    weight: number | null
    effectiveWeight: number | null
    restTime: RestTime
}

export interface ProgramPdfWorkout {
    id: string
    dayIndex: number
    exercises: ProgramPdfExercise[]
}

export interface ProgramPdfWeek {
    weekNumber: number
    weekType: WeekType
    workouts: ProgramPdfWorkout[]
}

export interface ProgramPdfData {
    title: string
    traineeName: string
    trainerName: string
    startDate: string
    weeks: ProgramPdfWeek[]
}

export interface ProgramPdfLabels {
    trainerLabel: string
    startDateLabel: string
    generatedAtLabel: string
    weekLabel: (week: number) => string
    weekTypeLabel: (weekType: WeekType) => string
    workoutLabel: (dayIndex: number) => string
    tableExercise: string
    tableVariant: string
    tableScheme: string
    tableWeight: string
    tableRest: string
    tableRpe: string
    tableNoExercises: string
    tableWeightAssigned: (weight: string) => string
    tableWeightEffective: (weight: string) => string
    warmupYesShort: string
    warmupNoShort: string
    fundamentalShort: string
    accessoryShort: string
    previousExerciseShort: string
    missingValue: string
}

export interface ProgramPdfExportConfig {
    logoUrl?: string
    fileNamePrefix?: string
    locale?: string
    brandLabel?: string
}

const REST_TIME_LABELS: Record<RestTime, string> = {
    s30: '0:30',
    m1: '1:00',
    m2: '2:00',
    m3: '3:00',
    m5: '5:00',
}

const formatWeightValue = (value: number): string => {
    if (!Number.isFinite(value)) {
        return '-'
    }

    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const formatWeightKg = (value: number | null, fallback: string): string => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback
    }

    return `${formatWeightValue(value)} kg`
}

const formatAssignedWeight = (
    weightType: WeightType,
    weight: number | null,
    previousExerciseLabel: string,
    fallback: string
): string => {
    if (typeof weight !== 'number' || !Number.isFinite(weight)) {
        return fallback
    }

    const formattedWeight = formatWeightValue(weight)

    if (weightType === 'absolute') {
        return `${formattedWeight} kg`
    }

    if (weightType === 'percentage_1rm') {
        return `${formattedWeight}% 1RM`
    }

    if (weightType === 'percentage_rm') {
        return `${formattedWeight}% RM`
    }

    const sign = weight > 0 ? '+' : ''
    return `${sign}${formattedWeight}% ${previousExerciseLabel}`
}

const sanitizeFileNamePart = (value: string): string => {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

const sanitizeCompactName = (value: string): string => {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
}

const formatTrainerPercentageSetting = (
    weightType: WeightType,
    weight: number | null
): string | null => {
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weightType === 'absolute') {
        return null
    }

    const formattedWeight = formatWeightValue(weight)

    if (weightType === 'percentage_1rm') {
        return `${formattedWeight}% 1RM`
    }

    if (weightType === 'percentage_rm') {
        return `${formattedWeight}% RM`
    }

    const sign = weight > 0 ? '+' : ''
    return `${sign}${formattedWeight}%`
}

const loadImageAsDataUrl = async (imageUrl: string): Promise<string | null> => {
    if (typeof window === 'undefined') {
        return null
    }

    return new Promise((resolve) => {
        const image = new Image()

        image.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = image.naturalWidth
            canvas.height = image.naturalHeight

            const context = canvas.getContext('2d')
            if (!context) {
                resolve(null)
                return
            }

            context.drawImage(image, 0, 0)
            resolve(canvas.toDataURL('image/png'))
        }

        image.onerror = () => resolve(null)
        image.src = imageUrl
    })
}

export async function exportProgramToPdf(
    program: ProgramPdfData,
    labels: ProgramPdfLabels,
    {
        logoUrl = '/images/logo/logo.png',
        fileNamePrefix = 'program',
        locale = 'it-IT',
        brandLabel = 'ZeroCento Body Lab',
    }: ProgramPdfExportConfig = {}
): Promise<void> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ])

    const logoDataUrl = await loadImageAsDataUrl(logoUrl)
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    }) as any

    const generatedAt = new Date().toLocaleDateString(locale)

    program.weeks.forEach((week, weekIndex) => {
        if (weekIndex > 0) {
            doc.addPage('a4', 'portrait')
        }

        let cursorY = 14

        if (logoDataUrl) {
            doc.addImage(logoDataUrl, 'PNG', 14, 10, 18, 18)
            cursorY = 12
        }

        const textStartX = logoDataUrl ? 36 : 14

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(25, 25, 25)
        doc.text(program.title, textStartX, cursorY + 3)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(85, 85, 85)
        doc.text(`${labels.trainerLabel}: ${program.trainerName}`, textStartX, cursorY + 9)
        doc.text(
            `${labels.startDateLabel}: ${new Date(program.startDate).toLocaleDateString(locale)}`,
            textStartX,
            cursorY + 14
        )

        const weekTitle = `${labels.weekLabel(week.weekNumber)} - ${labels.weekTypeLabel(week.weekType)}`
        doc.setFillColor(255, 167, 0)
        doc.roundedRect(14, 34, 182, 9, 2, 2, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(weekTitle, 17, 40)

        cursorY = 47

        week.workouts
            .slice()
            .sort((left, right) => left.dayIndex - right.dayIndex)
            .forEach((workout, workoutIndex) => {
                doc.setTextColor(35, 35, 35)
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(10)
                doc.text(labels.workoutLabel(workout.dayIndex), 14, cursorY)

                const bodyRows = workout.exercises.length > 0
                    ? workout.exercises.map((exercise) => {
                        const effectiveWeightValue =
                            exercise.weightType === 'absolute'
                                ? exercise.effectiveWeight ?? exercise.weight
                                : exercise.effectiveWeight
                        const effectiveWeight = formatWeightKg(
                            effectiveWeightValue,
                            labels.missingValue
                        )
                        const trainerSetting = formatTrainerPercentageSetting(
                            exercise.weightType,
                            exercise.weight
                        )
                        const weightLabel = trainerSetting
                            ? `${effectiveWeight} (${trainerSetting})`
                            : effectiveWeight

                        const exerciseTypeLabel = exercise.type === 'fundamental'
                            ? labels.fundamentalShort
                            : labels.accessoryShort
                        const warmupIcon = exercise.isWarmup ? '[*]' : ''

                        const exerciseLabel = [
                            warmupIcon,
                            `[${exerciseTypeLabel}] ${exercise.name}`,
                        ]
                            .filter(Boolean)
                            .join(' ')
                        const variantLabel = exercise.variant || labels.missingValue

                        const schemeLabel = `${exercise.sets} x ${exercise.reps}`
                        const rpeLabel =
                            typeof exercise.targetRpe === 'number'
                                ? String(exercise.targetRpe)
                                : labels.missingValue

                        return [
                            exerciseLabel,
                            variantLabel,
                            schemeLabel,
                            weightLabel,
                            REST_TIME_LABELS[exercise.restTime] || labels.missingValue,
                            rpeLabel,
                        ]
                    })
                    : [[labels.tableNoExercises, '', '', '', '', '']]

                autoTable(doc, {
                    startY: cursorY + 2,
                    margin: { left: 14, right: 14 },
                    tableWidth: 182,
                    head: [[
                        labels.tableExercise,
                        labels.tableVariant,
                        labels.tableScheme,
                        labels.tableWeight,
                        labels.tableRest,
                        labels.tableRpe,
                    ]],
                    body: bodyRows,
                    styles: {
                        font: 'helvetica',
                        fontSize: 7.5,
                        cellPadding: 1.8,
                        textColor: [45, 45, 45],
                        valign: 'middle',
                    },
                    headStyles: {
                        fillColor: [255, 167, 0],
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                    },
                    columnStyles: {
                        0: { cellWidth: 55, halign: 'left' },
                        1: { cellWidth: 55, halign: 'left' },
                        2: { cellWidth: 18, halign: 'center' },
                        3: { cellWidth: 18, halign: 'center' },
                        4: { cellWidth: 18, halign: 'center' },
                        5: { cellWidth: 18, halign: 'center' },
                    },
                    theme: 'grid',
                    tableLineColor: [226, 226, 226],
                    tableLineWidth: 0.1,
                })

                cursorY = (doc.lastAutoTable?.finalY ?? cursorY + 20) + 5

                if (cursorY > 265 && workoutIndex < week.workouts.length - 1) {
                    doc.addPage('a4', 'portrait')
                    cursorY = 18
                    doc.setFont('helvetica', 'bold')
                    doc.setFontSize(10)
                    doc.setTextColor(45, 45, 45)
                    doc.text(weekTitle, 14, 13)
                }
            })

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(130, 130, 130)
        doc.text(`${labels.generatedAtLabel}: ${generatedAt}`, 14, 289)
        doc.text(brandLabel, 196, 289, { align: 'right' })
    })

    const traineeSlug = sanitizeCompactName(program.traineeName) || 'trainee'
    const titleSlug = sanitizeFileNamePart(program.title) || 'training-program'
    const prefixSlug = sanitizeFileNamePart(fileNamePrefix) || 'program'
    doc.save(`${prefixSlug}-${traineeSlug}-${titleSlug}.pdf`)
}