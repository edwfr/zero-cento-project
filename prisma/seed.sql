-- ZeroCento Training Platform - Seed Data
-- Run this in Supabase SQL Editor
-- Date: 2026-03-29

-- Note: This creates users in public.users but NOT in auth.users
-- After running this script, you must create passwords manually via:
-- Supabase Dashboard → Authentication → Users → Reset Password

BEGIN;

-- Clear existing data (development only)
DELETE FROM "sets_performed";
DELETE FROM "exercise_feedbacks";
DELETE FROM "personal_records";
DELETE FROM "workout_exercises";
DELETE FROM "workouts";
DELETE FROM "weeks";
DELETE FROM "training_programs";
DELETE FROM "trainer_trainee";
DELETE FROM "exercise_muscle_groups";
DELETE FROM "exercises";
DELETE FROM "movement_pattern_colors";
DELETE FROM "movement_patterns";
DELETE FROM "muscle_groups";
DELETE FROM "users";

-- ============================================================================
-- USERS
-- ============================================================================

-- Admin
INSERT INTO "users" (id, email, "firstName", "lastName", role, "isActive", "createdAt")
VALUES 
('00000000-0000-0000-0000-000000000001', 'admin@zerocento.app', 'Admin', 'ZeroCento', 'admin', true, NOW());

-- Trainers
INSERT INTO "users" (id, email, "firstName", "lastName", role, "isActive", "createdAt")
VALUES 
('00000000-0000-0000-0000-000000000002', 'trainer1@zerocento.app', 'Marco', 'Rossi', 'trainer', true, NOW()),
('00000000-0000-0000-0000-000000000003', 'trainer2@zerocento.app', 'Laura', 'Bianchi', 'trainer', true, NOW());

-- Trainees for Trainer 1 (5 users)
INSERT INTO "users" (id, email, "firstName", "lastName", role, "isActive", "createdAt")
VALUES 
('00000000-0000-0000-0000-000000000011', 'trainee1@zerocento.app', 'Trainee1', 'T1', 'trainee', true, NOW()),
('00000000-0000-0000-0000-000000000012', 'trainee2@zerocento.app', 'Trainee2', 'T1', 'trainee', true, NOW()),
('00000000-0000-0000-0000-000000000013', 'trainee3@zerocento.app', 'Trainee3', 'T1', 'trainee', true, NOW()),
('00000000-0000-0000-0000-000000000014', 'trainee4@zerocento.app', 'Trainee4', 'T1', 'trainee', true, NOW()),
('00000000-0000-0000-0000-000000000015', 'trainee5@zerocento.app', 'Trainee5', 'T1', 'trainee', true, NOW());

-- Trainees for Trainer 2 (5 users)
INSERT INTO "users" (id, email, "firstName", "lastName", role, "isActive", "createdAt")
VALUES 
('00000000-0000-0000-0000-000000000021', 'trainee6@zerocento.app', 'Trainee6', 'T2', 'trainee', true, NOW()),
('00000000-0000-0000-0000-000000000022', 'trainee7@zerocento.app', 'Trainee7', 'T2', 'trainee', true, NOW()),
('00000000-0000-0000-0000-000000000023', 'trainee8@zerocento.app', 'Trainee8', 'T2', 'trainee', true, NOW()),
('00000000-0000-0000-0000-000000000024', 'trainee9@zerocento.app', 'Trainee9', 'T2', 'trainee', true, NOW()),
('00000000-0000-0000-0000-000000000025', 'trainee10@zerocento.app', 'Trainee10', 'T2', 'trainee', true, NOW());

-- ============================================================================
-- TRAINER-TRAINEE RELATIONSHIPS
-- ============================================================================

-- Trainer1 → Trainees 1-5
INSERT INTO "trainer_trainee" (id, "trainerId", "traineeId", "createdAt")
VALUES 
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011', NOW()),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', NOW()),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000013', NOW()),
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000014', NOW()),
('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000015', NOW());

-- Trainer2 → Trainees 6-10
INSERT INTO "trainer_trainee" (id, "trainerId", "traineeId", "createdAt")
VALUES 
('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000021', NOW()),
('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000022', NOW()),
('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000023', NOW()),
('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000024', NOW()),
('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000025', NOW());

-- ============================================================================
-- MUSCLE GROUPS
-- ============================================================================

INSERT INTO "muscle_groups" (id, name, description, "createdBy", "isActive", "createdAt")
VALUES 
('20000000-0000-0000-0000-000000000001', 'Pettorali', 'Muscoli del petto', '00000000-0000-0000-0000-000000000001', true, NOW()),
('20000000-0000-0000-0000-000000000002', 'Quadricipiti', 'Muscoli anteriori della coscia', '00000000-0000-0000-0000-000000000001', true, NOW()),
('20000000-0000-0000-0000-000000000003', 'Dorsali', 'Muscoli della schiena', '00000000-0000-0000-0000-000000000001', true, NOW()),
('20000000-0000-0000-0000-000000000004', 'Deltoidi', 'Muscoli delle spalle', '00000000-0000-0000-0000-000000000001', true, NOW()),
('20000000-0000-0000-0000-000000000005', 'Glutei', 'Muscoli del sedere', '00000000-0000-0000-0000-000000000001', true, NOW());

-- ============================================================================
-- MOVEMENT PATTERNS
-- ============================================================================

INSERT INTO "movement_patterns" (id, name, description, "createdBy", "isActive", "createdAt")
VALUES 
('30000000-0000-0000-0000-000000000001', 'Squat', 'Schema motorio di accosciata', '00000000-0000-0000-0000-000000000001', true, NOW()),
('30000000-0000-0000-0000-000000000002', 'Horizontal Push', 'Spinta orizzontale', '00000000-0000-0000-0000-000000000001', true, NOW()),
('30000000-0000-0000-0000-000000000003', 'Hip Extension', 'Estensione dell''anca', '00000000-0000-0000-0000-000000000001', true, NOW()),
('30000000-0000-0000-0000-000000000004', 'Horizontal Pull', 'Trazione orizzontale', '00000000-0000-0000-0000-000000000001', true, NOW()),
('30000000-0000-0000-0000-000000000005', 'Vertical Pull', 'Trazione verticale', '00000000-0000-0000-0000-000000000001', true, NOW());

-- ============================================================================
-- EXERCISES
-- ============================================================================

-- Fundamental exercises
INSERT INTO "exercises" (id, name, description, "youtubeUrl", type, "movementPatternId", notes, "createdBy", "createdAt")
VALUES 
('40000000-0000-0000-0000-000000000001', 'Back Squat', 'Squat con bilanciere sulla schiena', 'https://www.youtube.com/watch?v=ultWZbUMPL8', 'fundamental', '30000000-0000-0000-0000-000000000001', ARRAY['Piedi larghezza spalle', 'Ginocchia in linea con le punte'], '00000000-0000-0000-0000-000000000002', NOW()),
('40000000-0000-0000-0000-000000000002', 'Bench Press', 'Panca piana con bilanciere', 'https://www.youtube.com/watch?v=gRVjAtPip0Y', 'fundamental', '30000000-0000-0000-0000-000000000002', ARRAY['Scapole retratte', 'Gomiti a 45 gradi'], '00000000-0000-0000-0000-000000000002', NOW()),
('40000000-0000-0000-0000-000000000003', 'Deadlift', 'Stacco da terra', 'https://www.youtube.com/watch?v=op9kVnSso6Q', 'fundamental', '30000000-0000-0000-0000-000000000003', ARRAY['Schiena neutra', 'Spinta con i piedi'], '00000000-0000-0000-0000-000000000002', NOW()),
('40000000-0000-0000-0000-000000000004', 'Barbell Row', 'Rematore con bilanciere', 'https://www.youtube.com/watch?v=FWJR5Ve8bnQ', 'fundamental', '30000000-0000-0000-0000-000000000004', ARRAY['Busto a 45 gradi', 'Gomiti vicino al corpo'], '00000000-0000-0000-0000-000000000002', NOW()),
('40000000-0000-0000-0000-000000000005', 'Pull Up', 'Trazioni alla sbarra', 'https://www.youtube.com/watch?v=eGo4IYlbE5g', 'fundamental', '30000000-0000-0000-0000-000000000005', ARRAY['Presa prona', 'Scapole depresse'], '00000000-0000-0000-0000-000000000003', NOW());

-- Accessory exercise
INSERT INTO "exercises" (id, name, description, "youtubeUrl", type, "movementPatternId", notes, "createdBy", "createdAt")
VALUES 
('40000000-0000-0000-0000-000000000006', 'Dumbbell Bench Press', 'Panca con manubri', 'https://www.youtube.com/watch?v=VmB1G1K7v94', 'accessory', '30000000-0000-0000-0000-000000000002', ARRAY[]::text[], '00000000-0000-0000-0000-000000000002', NOW());

-- ============================================================================
-- EXERCISE-MUSCLE GROUP RELATIONSHIPS
-- ============================================================================

INSERT INTO "exercise_muscle_groups" (id, "exerciseId", "muscleGroupId", coefficient)
VALUES 
-- Back Squat → Quadricipiti (1.0) + Glutei (0.8)
('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 1.0),
('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 0.8),
-- Bench Press → Pettorali (1.0) + Deltoidi (0.5)
('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 1.0),
('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', 0.5),
-- Deadlift → Glutei (1.0) + Dorsali (0.7)
('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005', 1.0),
('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 0.7),
-- Barbell Row → Dorsali (1.0)
('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 1.0),
-- Pull Up → Dorsali (1.0)
('50000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 1.0),
-- Dumbbell Press → Pettorali (0.9) + Deltoidi (0.6)
('50000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 0.9),
('50000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000004', 0.6);

-- ============================================================================
-- TRAINING PROGRAMS
-- ============================================================================

-- Draft Program for Trainee1
INSERT INTO "training_programs" (id, title, "trainerId", "traineeId", "durationWeeks", "workoutsPerWeek", status, "createdAt", "updatedAt")
VALUES 
('60000000-0000-0000-0000-000000000001', 'Programma Forza Base', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011', 4, 3, 'draft', NOW(), NOW());

-- Active Program for Trainee2 (started 1 week ago)
INSERT INTO "training_programs" (id, title, "trainerId", "traineeId", "startDate", "durationWeeks", "workoutsPerWeek", status, "publishedAt", "createdAt", "updatedAt")
VALUES 
('60000000-0000-0000-0000-000000000002', 'Programma Ipertrofia', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', NOW() - INTERVAL '7 days', 6, 4, 'active', NOW() - INTERVAL '7 days', NOW(), NOW());

-- ============================================================================
-- WEEKS for Draft Program (4 weeks × 3 workouts)
-- ============================================================================

INSERT INTO "weeks" (id, "programId", "weekNumber", "weekType", "feedbackRequested")
VALUES 
('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 1, 'normal', false),
('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 2, 'normal', false),
('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', 3, 'normal', false),
('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000001', 4, 'deload', false);

-- ============================================================================
-- WEEKS for Active Program (6 weeks × 4 workouts)
-- ============================================================================

INSERT INTO "weeks" (id, "programId", "weekNumber", "startDate", "weekType", "feedbackRequested")
VALUES 
('70000000-0000-0000-0000-000000000011', '60000000-0000-0000-0000-000000000002', 1, NOW() - INTERVAL '7 days', 'normal', false),
('70000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000002', 2, NOW(), 'normal', false),
('70000000-0000-0000-0000-000000000013', '60000000-0000-0000-0000-000000000002', 3, NOW() + INTERVAL '7 days', 'test', true),
('70000000-0000-0000-0000-000000000014', '60000000-0000-0000-0000-000000000002', 4, NOW() + INTERVAL '14 days', 'normal', false),
('70000000-0000-0000-0000-000000000015', '60000000-0000-0000-0000-000000000002', 5, NOW() + INTERVAL '21 days', 'normal', false),
('70000000-0000-0000-0000-000000000016', '60000000-0000-0000-0000-000000000002', 6, NOW() + INTERVAL '28 days', 'deload', false);

-- ============================================================================
-- WORKOUTS for Draft Program
-- ============================================================================

-- Week 1
INSERT INTO "workouts" (id, "weekId", "dayLabel")
VALUES 
('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Giorno 1'),
('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'Giorno 2'),
('80000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', 'Giorno 3');

-- Week 2
INSERT INTO "workouts" (id, "weekId", "dayLabel")
VALUES 
('80000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', 'Giorno 1'),
('80000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000002', 'Giorno 2'),
('80000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000002', 'Giorno 3');

-- Week 3
INSERT INTO "workouts" (id, "weekId", "dayLabel")
VALUES 
('80000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000003', 'Giorno 1'),
('80000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000003', 'Giorno 2'),
('80000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000003', 'Giorno 3');

-- Week 4 (deload)
INSERT INTO "workouts" (id, "weekId", "dayLabel")
VALUES 
('80000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000004', 'Giorno 1'),
('80000000-0000-0000-0000-000000000011', '70000000-0000-0000-0000-000000000004', 'Giorno 2'),
('80000000-0000-0000-0000-000000000012', '70000000-0000-0000-0000-000000000004', 'Giorno 3');

-- ============================================================================
-- WORKOUTS for Active Program (Week 1 only, with exercises)
-- ============================================================================

INSERT INTO "workouts" (id, "weekId", "dayLabel")
VALUES 
('80000000-0000-0000-0000-000000000101', '70000000-0000-0000-0000-000000000011', 'Giorno 1'),
('80000000-0000-0000-0000-000000000102', '70000000-0000-0000-0000-000000000011', 'Giorno 2'),
('80000000-0000-0000-0000-000000000103', '70000000-0000-0000-0000-000000000011', 'Giorno 3'),
('80000000-0000-0000-0000-000000000104', '70000000-0000-0000-0000-000000000011', 'Giorno 4');

-- Weeks 2-6 (empty workouts)
INSERT INTO "workouts" (id, "weekId", "dayLabel")
SELECT 
    ('80000000-0000-0000-0000-0000000002' || LPAD(((week_num - 2) * 4 + day_num)::text, 2, '0')),
    ('70000000-0000-0000-0000-0000000000' || LPAD((10 + week_num)::text, 2, '0')),
    'Giorno ' || day_num
FROM 
    generate_series(2, 6) as week_num,
    generate_series(1, 4) as day_num;

-- ============================================================================
-- WORKOUT EXERCISES (for Active Program, Week 1, Day 1 only)
-- ============================================================================

INSERT INTO "workout_exercises" (id, "workoutId", "exerciseId", sets, reps, "targetRpe", "weightType", weight, "restTime", "isWarmup", "order")
VALUES 
('90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000101', '40000000-0000-0000-0000-000000000001', 4, '8', 8.0, 'absolute', 100, 'm3', false, 1),
('90000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000101', '40000000-0000-0000-0000-000000000002', 4, '8-10', 8.5, 'absolute', 80, 'm2', false, 2);

-- ============================================================================
-- PERSONAL RECORDS
-- ============================================================================

INSERT INTO "personal_records" (id, "traineeId", "exerciseId", reps, weight, "recordDate", notes, "createdAt")
VALUES 
('A0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000001', 1, 140, NOW(), '1RM test', NOW()),
('A0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000002', 1, 100, NOW(), '1RM test', NOW());

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

COMMIT;

DO $$
BEGIN
    RAISE NOTICE '✅ Seeding completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📝 IMPORTANT: Users created but NO passwords set!';
    RAISE NOTICE '';
    RAISE NOTICE '🔑 Next steps:';
    RAISE NOTICE '   1. Go to Supabase Dashboard → Authentication → Users';
    RAISE NOTICE '   2. For each user, click ⋮ → Reset Password';
    RAISE NOTICE '';
    RAISE NOTICE '   Suggested passwords:';
    RAISE NOTICE '   • admin@zerocento.app → Admin1234!';
    RAISE NOTICE '   • trainer1@zerocento.app → Trainer1234!';
    RAISE NOTICE '   • trainee1@zerocento.app → Trainee1234!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Summary:';
    RAISE NOTICE '   • 13 users (1 admin + 2 trainers + 10 trainees)';
    RAISE NOTICE '   • 5 muscle groups';
    RAISE NOTICE '   • 5 movement patterns';
    RAISE NOTICE '   • 6 exercises (5 fundamental + 1 accessory)';
    RAISE NOTICE '   • 2 programs (1 draft + 1 active)';
    RAISE NOTICE '   • 2 personal records';
END $$;
