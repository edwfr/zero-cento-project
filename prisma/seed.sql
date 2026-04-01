-- ZeroCento Training Platform - Seed Data (Minimal)
-- Run this script to populate basic data
-- Date: 2026-04-01

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
('a0000000-0000-0000-0000-000000000001', 'admin@zerocento.app', 'Admin', 'Sistema', 'admin', true, NOW());

-- Trainer
INSERT INTO "users" (id, email, "firstName", "lastName", role, "isActive", "createdAt")
VALUES 
('b0000000-0000-0000-0000-000000000001', 'trainer1@zerocento.app', 'Mario', 'Rossi', 'trainer', true, NOW());

-- Trainee
INSERT INTO "users" (id, email, "firstName", "lastName", role, "isActive", "createdAt")
VALUES 
('c0000000-0000-0000-0000-000000000001', 'trainee1@zerocento.app', 'Luca', 'Bianchi', 'trainee', true, NOW());

-- ============================================================================
-- TRAINER-TRAINEE RELATIONSHIP
-- ============================================================================

INSERT INTO "trainer_trainee" (id, "trainerId", "traineeId", "createdAt")
VALUES 
('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', NOW());

-- ============================================================================
-- MUSCLE GROUPS
-- ============================================================================

INSERT INTO "muscle_groups" (id, name, description, "createdBy", "isActive", "createdAt")
VALUES 
('e0000000-0000-0000-0000-000000000001', 'Pettorali', 'Muscoli del petto', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('e0000000-0000-0000-0000-000000000002', 'Dorsali', 'Muscoli della schiena', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('e0000000-0000-0000-0000-000000000003', 'Deltoidi', 'Muscoli delle spalle', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('e0000000-0000-0000-0000-000000000004', 'Bicipiti', 'Muscoli anteriori del braccio', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('e0000000-0000-0000-0000-000000000005', 'Tricipiti', 'Muscoli posteriori del braccio', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('e0000000-0000-0000-0000-000000000006', 'Quadricipiti', 'Muscoli anteriori della coscia', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('e0000000-0000-0000-0000-000000000007', 'Femorali', 'Muscoli posteriori della coscia', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('e0000000-0000-0000-0000-000000000008', 'Glutei', 'Muscoli del sedere', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('e0000000-0000-0000-0000-000000000009', 'Polpacci', 'Muscoli del polpaccio', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('e0000000-0000-0000-0000-000000000010', 'Core', 'Muscoli addominali e lombari', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('e0000000-0000-0000-0000-000000000011', 'Trapezi', 'Muscoli del trapezio', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('e0000000-0000-0000-0000-000000000012', 'Avambracci', 'Muscoli dell''avambraccio', 'a0000000-0000-0000-0000-000000000001', true, NOW());

-- ============================================================================
-- MOVEMENT PATTERNS
-- ============================================================================

INSERT INTO "movement_patterns" (id, name, description, "createdBy", "isActive", "createdAt")
VALUES 
('f0000000-0000-0000-0000-000000000001', 'Squat', 'Schema motorio di accosciata/squat', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('f0000000-0000-0000-0000-000000000002', 'Hip Hinge', 'Schema motorio di cerniera all''anca', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('f0000000-0000-0000-0000-000000000003', 'Horizontal Push', 'Spinta orizzontale (panca)', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('f0000000-0000-0000-0000-000000000004', 'Vertical Push', 'Spinta verticale (lento avanti)', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('f0000000-0000-0000-0000-000000000005', 'Horizontal Pull', 'Trazione orizzontale (rematore)', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('f0000000-0000-0000-0000-000000000006', 'Vertical Pull', 'Trazione verticale (trazioni)', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('f0000000-0000-0000-0000-000000000007', 'Lunge', 'Affondi e varianti monolaterali', 'a0000000-0000-0000-0000-000000000001', true, NOW()),
('f0000000-0000-0000-0000-000000000008', 'Carry', 'Trasporti e stabilizzazione core', 'a0000000-0000-0000-0000-000000000001', true, NOW());

COMMIT;

COMMIT;

-- ============================================================================
-- NOTES
-- ============================================================================
-- ✅ Script eseguito con successo!
-- 
-- 📝 Prossimi passi:
-- 1. Crea gli utenti in Supabase Auth (Dashboard → Authentication → Users)
--    - admin@zerocento.it
--    - trainer1@zerocento.it  
--    - trainee1@zerocento.it
-- 
-- 2. Aggiungi esercizi tramite l'interfaccia admin
-- 
-- 3. Il trainer può ora creare programmi per il trainee
-- 
-- 📊 Dati creati:
--    • 3 utenti (1 admin + 1 trainer + 1 trainee)
--    • 1 relazione trainer-trainee
--    • 12 gruppi muscolari
--    • 8 schemi motori
-- ============================================================================
