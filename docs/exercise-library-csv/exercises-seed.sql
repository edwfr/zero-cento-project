-- ============================================================
-- Exercise library seed — auto-generated from CSV
-- Generated: 2026-04-29T17:41:28.461Z
-- ============================================================

-- Requires at least one admin user in the users table.
-- Movement patterns and muscle groups must already exist.

DO $$
DECLARE
  v_creator_id TEXT;
BEGIN

  SELECT id INTO v_creator_id FROM users WHERE role = 'admin' LIMIT 1;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found — seed exercises first requires an admin user.';
  END IF;

  -- [1] Squat Low Bar
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '444f2b47-83a7-40f3-8476-0ff35ab5486c',
    'Squat Low Bar',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    'https://www.youtube.com/watch?v=1E4VBdqzSWQ&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=37',
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '43cd14ff-60f3-4c40-a8d2-e4b878badee9',
    '444f2b47-83a7-40f3-8476-0ff35ab5486c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ca9abdb4-19b1-4d38-ba61-dbc7da8dc4bd',
    '444f2b47-83a7-40f3-8476-0ff35ab5486c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f5d919b9-cea0-413f-bc4f-c71fac83493c',
    '444f2b47-83a7-40f3-8476-0ff35ab5486c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ada1b407-272d-44c1-a98e-cd2c666b4fc7',
    '444f2b47-83a7-40f3-8476-0ff35ab5486c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ed519488-07c8-46e6-bb2f-730c1bfe8ca0',
    '444f2b47-83a7-40f3-8476-0ff35ab5486c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [2] Squat High Bar
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '837d6e75-f3f6-4d3f-ac85-533d267a7f40',
    'Squat High Bar',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    'https://www.youtube.com/watch?v=Z4PA3dij-no&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=36',
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4b0f85b6-830a-4e10-ad65-a46faed187aa',
    '837d6e75-f3f6-4d3f-ac85-533d267a7f40',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a38077a2-5567-49ff-b796-5bd7b0e0ec6f',
    '837d6e75-f3f6-4d3f-ac85-533d267a7f40',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f559d8ba-dbe9-46a6-9b44-9a19e7ff5c3a',
    '837d6e75-f3f6-4d3f-ac85-533d267a7f40',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd3dc3b77-c9ce-4026-bc32-c6040c498eeb',
    '837d6e75-f3f6-4d3f-ac85-533d267a7f40',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a95948ae-2ad7-4b91-b882-244cc9bcc339',
    '837d6e75-f3f6-4d3f-ac85-533d267a7f40',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [3] Squat Safety Bar
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '5e231475-5c7e-4037-86aa-07249e5adf8a',
    'Squat Safety Bar',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    'https://www.youtube.com/watch?v=vh4VrdbM120&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=40',
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'aad254d4-937c-4cce-89dc-5dbdbc6eddb3',
    '5e231475-5c7e-4037-86aa-07249e5adf8a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '04ce30a8-b2a9-42d9-aa50-8d6b0de35f0a',
    '5e231475-5c7e-4037-86aa-07249e5adf8a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ce687916-a4dc-431d-8a98-be547dddb062',
    '5e231475-5c7e-4037-86aa-07249e5adf8a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c3bcc947-bc5b-4b5b-a311-ad9262f32bb7',
    '5e231475-5c7e-4037-86aa-07249e5adf8a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '413313d1-88e6-4eb9-8a97-8c7c67ce7e17',
    '5e231475-5c7e-4037-86aa-07249e5adf8a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [4] Squat Westside Style
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '7ef3d8bf-b7bf-47b5-8126-8c3913d237d1',
    'Squat Westside Style',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7b955a9e-19d1-4182-8556-27b18d29a56a',
    '7ef3d8bf-b7bf-47b5-8126-8c3913d237d1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1cda38d1-e890-4cf0-bfbe-597d4d5b86b9',
    '7ef3d8bf-b7bf-47b5-8126-8c3913d237d1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '15170f75-0730-4d15-ab12-50cc10e6ae3f',
    '7ef3d8bf-b7bf-47b5-8126-8c3913d237d1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '32f29d8b-7ad0-458f-b0bc-569ddc6774e5',
    '7ef3d8bf-b7bf-47b5-8126-8c3913d237d1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'eeb56187-9535-4e92-a502-b26d17942521',
    '7ef3d8bf-b7bf-47b5-8126-8c3913d237d1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [5] Front Squat
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '66abb84d-e047-4316-afdc-134e431f3203',
    'Front Squat',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    'https://www.youtube.com/watch?v=AiYlBveYG6U&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=20',
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e6e9d412-0513-49a5-8b67-b88c5dc98aaf',
    '66abb84d-e047-4316-afdc-134e431f3203',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9a974b44-11d6-41b5-a5ad-46fb60e70c73',
    '66abb84d-e047-4316-afdc-134e431f3203',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd3b14ea2-a7fa-4064-9da4-0784ea775841',
    '66abb84d-e047-4316-afdc-134e431f3203',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1f7bb910-9710-41ef-ad35-061cfb9a53ad',
    '66abb84d-e047-4316-afdc-134e431f3203',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e58001d3-9aba-4d1a-b984-8a4d061b82aa',
    '66abb84d-e047-4316-afdc-134e431f3203',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [6] Zercher Squat
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'f6ebd7ac-3ecc-485f-89da-3c69983ef43c',
    'Zercher Squat',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    'https://www.youtube.com/watch?v=lsfVJswEMsM&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=42',
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd7051127-6739-47ad-9332-1fbe537b97d4',
    'f6ebd7ac-3ecc-485f-89da-3c69983ef43c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '812fa2e1-2fc4-45af-b963-2ff6e7548b38',
    'f6ebd7ac-3ecc-485f-89da-3c69983ef43c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '746977fb-28d8-443a-81b4-3f126f2ffec0',
    'f6ebd7ac-3ecc-485f-89da-3c69983ef43c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '50e7a533-9076-478c-80bf-69fc7d69d8fa',
    'f6ebd7ac-3ecc-485f-89da-3c69983ef43c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'cddd137a-6d6f-4eb2-ba59-c0ccb1fe9775',
    'f6ebd7ac-3ecc-485f-89da-3c69983ef43c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [7] Squat Cambered Bar H
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '2c958334-5072-40cb-9190-3c82d40db41c',
    'Squat Cambered Bar H',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ea5b9b21-d93c-4eb6-b546-0c43261fa384',
    '2c958334-5072-40cb-9190-3c82d40db41c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a71aef19-196b-4941-824b-64379a735167',
    '2c958334-5072-40cb-9190-3c82d40db41c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '650c1681-2d3b-4e81-8afd-51b4dbed5cb8',
    '2c958334-5072-40cb-9190-3c82d40db41c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7a45eed4-932a-4439-870a-a5e4f02a0914',
    '2c958334-5072-40cb-9190-3c82d40db41c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4353d096-257f-40ae-a0d3-2a1668570e56',
    '2c958334-5072-40cb-9190-3c82d40db41c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [8] Squat cambered Bar L
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'b12015ff-e54a-4081-be7d-acea679a8739',
    'Squat cambered Bar L',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '5e2bfac2-c47d-4dff-bd56-000cd4c08199',
    'b12015ff-e54a-4081-be7d-acea679a8739',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '60b42949-c1ae-4487-8fdb-15b7e8d8dd6f',
    'b12015ff-e54a-4081-be7d-acea679a8739',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4bbeb028-5951-4bf7-be2a-919951537615',
    'b12015ff-e54a-4081-be7d-acea679a8739',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '87c3dd89-1575-4ad9-add8-37ccaa70dfdc',
    'b12015ff-e54a-4081-be7d-acea679a8739',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '16107fe8-6159-41ab-af62-f4e9718d53a1',
    'b12015ff-e54a-4081-be7d-acea679a8739',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [9] Squat Bow Bar
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '53cc31bd-14cb-4e64-99a7-43730b3ce05d',
    'Squat Bow Bar',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3f7ccbbb-0cc9-4ff1-8a02-e6239c839c4c',
    '53cc31bd-14cb-4e64-99a7-43730b3ce05d',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'fb284e64-7b7f-4335-a1ee-471b24241480',
    '53cc31bd-14cb-4e64-99a7-43730b3ce05d',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ce330b3a-56e0-42c6-803a-0d6382fb54c2',
    '53cc31bd-14cb-4e64-99a7-43730b3ce05d',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c02c0d8f-dc7f-45f8-9a12-394b68864d9a',
    '53cc31bd-14cb-4e64-99a7-43730b3ce05d',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b1afca69-fd4a-4056-a52c-3d23f93c53c8',
    '53cc31bd-14cb-4e64-99a7-43730b3ce05d',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [10] Squat High Bar Box
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'fa81eabb-b519-451d-a3a5-c3501304d001',
    'Squat High Bar Box',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2489c48e-0410-4198-a8a8-d0f670fa446d',
    'fa81eabb-b519-451d-a3a5-c3501304d001',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6b99f607-031c-4ef3-9dee-5a665d069cff',
    'fa81eabb-b519-451d-a3a5-c3501304d001',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '88346129-8ffb-4235-92c3-69c53d9cbe8b',
    'fa81eabb-b519-451d-a3a5-c3501304d001',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ceb5d6cc-af7b-4ecd-8919-544f998e6264',
    'fa81eabb-b519-451d-a3a5-c3501304d001',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '13088aca-ecc6-4d9d-bd06-197cc6821bd7',
    'fa81eabb-b519-451d-a3a5-c3501304d001',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [11] Squat Low Bar Box
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '7015f13a-98c9-4e10-8089-f8c03e3da88e',
    'Squat Low Bar Box',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '5c276810-1213-4646-a896-e92db7133371',
    '7015f13a-98c9-4e10-8089-f8c03e3da88e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6560e72e-0170-4476-b4c6-244b845503ef',
    '7015f13a-98c9-4e10-8089-f8c03e3da88e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4f40e3b3-9b24-4a96-a6a4-dab975360fa9',
    '7015f13a-98c9-4e10-8089-f8c03e3da88e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6f646184-f76a-4b6d-984b-0236f953c7bf',
    '7015f13a-98c9-4e10-8089-f8c03e3da88e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '95105fb1-a744-4699-a93f-e7ba138e2bc0',
    '7015f13a-98c9-4e10-8089-f8c03e3da88e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [12] Goblet  Squat
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '458da4d8-58f4-44a2-9da4-a8041da1adda',
    'Goblet  Squat',
    ARRAY['Tallone rialzato', 'Tutto il piede rialzato']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'aed570f5-fb0a-43a5-a80b-1eddff27256f',
    '458da4d8-58f4-44a2-9da4-a8041da1adda',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '0b2917ad-45a7-4636-b9e1-d54686d0791a',
    '458da4d8-58f4-44a2-9da4-a8041da1adda',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e9249294-16a9-4b8c-9ec3-fbb080f1ed9b',
    '458da4d8-58f4-44a2-9da4-a8041da1adda',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4f6a5a62-422c-425d-9c73-ede555a89ecf',
    '458da4d8-58f4-44a2-9da4-a8041da1adda',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '059fbecb-214b-4217-9439-470c9ebb360b',
    '458da4d8-58f4-44a2-9da4-a8041da1adda',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [13] Belt Squat
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '82fedc63-a282-4130-a6c2-06d0d694f3cb',
    'Belt Squat',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    'https://www.youtube.com/watch?v=frs5nQ4TRJQ&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=45',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bbc265e1-7ba1-42c0-868a-28f222c6eb52',
    '82fedc63-a282-4130-a6c2-06d0d694f3cb',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b14f71a5-69bd-49af-a968-b490b9a4da1a',
    '82fedc63-a282-4130-a6c2-06d0d694f3cb',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '5d487fc2-8197-4070-abf2-89b7741b1d6e',
    '82fedc63-a282-4130-a6c2-06d0d694f3cb',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c2b4ca85-73b1-491b-af3e-a5f1e665ab3f',
    '82fedc63-a282-4130-a6c2-06d0d694f3cb',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3dce641d-47a9-4798-9234-964c96acb361',
    '82fedc63-a282-4130-a6c2-06d0d694f3cb',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [14] Pendulum Squat
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'f2bfe367-baff-462e-8bad-f5174e8c57e8',
    'Pendulum Squat',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    'https://www.youtube.com/watch?v=TB2R-Zgtp4k&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=28',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9bfb7d67-006f-47f0-98ff-fff382d52bc5',
    'f2bfe367-baff-462e-8bad-f5174e8c57e8',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3578eebf-2d4c-489d-9ed8-23ab43cc08a6',
    'f2bfe367-baff-462e-8bad-f5174e8c57e8',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2dc96f23-3289-420d-b5cd-dcb4c6015a98',
    'f2bfe367-baff-462e-8bad-f5174e8c57e8',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [15] Squat Multipower
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '06b681c0-f1fd-4be7-af8a-e7c3f25369cc',
    'Squat Multipower',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e6e03066-66af-4fcb-bca6-450501f4e978',
    '06b681c0-f1fd-4be7-af8a-e7c3f25369cc',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '052e439d-5609-42f8-a7da-9c7e1b33493a',
    '06b681c0-f1fd-4be7-af8a-e7c3f25369cc',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '53e50c57-3e45-4057-be10-3bcbf89f7f65',
    '06b681c0-f1fd-4be7-af8a-e7c3f25369cc',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '456a1970-9872-4559-9111-9a5c84e6ea45',
    '06b681c0-f1fd-4be7-af8a-e7c3f25369cc',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.6
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'dfd9b3ad-1e03-4195-b23b-d6ea8bc7429e',
    '06b681c0-f1fd-4be7-af8a-e7c3f25369cc',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [16] Affondi multipower
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '416dd5e0-d6b3-4bf4-890a-f8d09ab7d147',
    'Affondi multipower',
    ARRAY['Discesa 5"', 'Discesa 3" Salita 3"', 'Fermo 1" in buca', 'Fermo 3" in buca', 'Doppio fermo 2"', 'Salita 3"', 'Caos 30%', 'Caos 50%', 'Caos 50%', 'Deloading', 'Overloading', 'Pin', 'Beltless', 'Full Raw', 'Catene']::text[],
    'https://www.youtube.com/watch?v=HPREVg8KFsE&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=53',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bb0b798a-fdad-4089-a709-adaec3036354',
    '416dd5e0-d6b3-4bf4-890a-f8d09ab7d147',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '525583f6-9504-49af-a2a0-1f1ccd91cd1c',
    '416dd5e0-d6b3-4bf4-890a-f8d09ab7d147',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '90433379-2601-4368-a878-fba13ba97168',
    '416dd5e0-d6b3-4bf4-890a-f8d09ab7d147',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e5236723-a7c5-40b3-82f2-26dbc8c1acac',
    '416dd5e0-d6b3-4bf4-890a-f8d09ab7d147',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [17] Affondi sul posto
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '843b752c-0a95-4491-9469-f7c6a859b547',
    'Affondi sul posto',
    ARRAY['1  manubrio controlaterale', '1 manubrio omolaterale', 'in appoggio', '2 manubri', 'discesa lenta', 'fermo1" in basso', 'Multipower', 'Multipower pin', 'Al belt squat']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1c91b68c-543f-4ca6-94ae-88919aadad5c',
    '843b752c-0a95-4491-9469-f7c6a859b547',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'eaf73a67-a1a7-4a61-96d3-3a8119c37daf',
    '843b752c-0a95-4491-9469-f7c6a859b547',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e1f9cbb1-5d89-4fd7-8987-9fdfa849a7fb',
    '843b752c-0a95-4491-9469-f7c6a859b547',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '61eae567-fd75-4ccf-9b8f-139b4b9e32e8',
    '843b752c-0a95-4491-9469-f7c6a859b547',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [18] Affondi dietro
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'd88649fb-8aad-4116-9b04-b322f96be3ba',
    'Affondi dietro',
    ARRAY['1  manubrio controlaterale', '1 manubrio omolaterale', 'in appoggio', '2 manubri', 'discesa lenta', 'fermo1" in basso', 'Multipower', 'Multipower pin', 'Al belt squat']::text[],
    'https://www.youtube.com/watch?v=HPREVg8KFsE&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=53',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '0994a2d7-21f7-429d-ac32-7bcdec3b59be',
    'd88649fb-8aad-4116-9b04-b322f96be3ba',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '42da593c-a7a2-43ea-a969-85c65c9b6b07',
    'd88649fb-8aad-4116-9b04-b322f96be3ba',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6870014a-1c1b-4638-9de3-00c7c4e81c4d',
    'd88649fb-8aad-4116-9b04-b322f96be3ba',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6e1feb30-9967-4ab6-9452-82dfd2792b5a',
    'd88649fb-8aad-4116-9b04-b322f96be3ba',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [19] Affondi camminati
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '9c3328c5-5108-4a52-8208-08fca4a8e8be',
    'Affondi camminati',
    ARRAY['1  manubrio controlaterale', '1 manubrio omolaterale', 'in appoggio', '2 manubri', 'discesa lenta', 'fermo1" in basso', 'Multipower', 'Multipower pin', 'Al belt squat']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bafcbbe7-8929-48da-ba15-b44b0c187bc1',
    '9c3328c5-5108-4a52-8208-08fca4a8e8be',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3bd82b0e-0439-457f-8d37-bf977be56b7e',
    '9c3328c5-5108-4a52-8208-08fca4a8e8be',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd0c53b2b-9cfc-47ca-ab9a-d8a185626c39',
    '9c3328c5-5108-4a52-8208-08fca4a8e8be',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '05648218-39ee-474c-a009-1f200fd925eb',
    '9c3328c5-5108-4a52-8208-08fca4a8e8be',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [20] Squat Bulgaro
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'dbd67afe-7780-4cf6-b826-6e7d53284cb1',
    'Squat Bulgaro',
    ARRAY['1  manubrio controlaterale', '1 manubrio omolaterale', 'in appoggio', '2 manubri', 'discesa lenta', 'fermo1" in basso', 'Multipower', 'Multipower pin', 'Al belt squat']::text[],
    'https://www.youtube.com/watch?v=FTBEwy-4QEg&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=50',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '03cd2104-fadd-4167-a521-5eec6fab0108',
    'dbd67afe-7780-4cf6-b826-6e7d53284cb1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7afd1966-ad5c-422e-991a-c7aade6a380b',
    'dbd67afe-7780-4cf6-b826-6e7d53284cb1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '34c59b5d-3353-4c02-be1c-6377a5ef157b',
    'dbd67afe-7780-4cf6-b826-6e7d53284cb1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '22df0c12-2c4d-4375-9fcc-1ebd323cd86e',
    'dbd67afe-7780-4cf6-b826-6e7d53284cb1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [21] Squat Bulgaro Safety Bar
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'd2eab2c5-f642-40b9-ba98-3e9ce9945607',
    'Squat Bulgaro Safety Bar',
    ARRAY['1  manubrio controlaterale', '1 manubrio omolaterale', 'in appoggio', '2 manubri', 'discesa lenta', 'fermo1" in basso', 'Multipower', 'Multipower pin', 'Al belt squat']::text[],
    'https://www.youtube.com/watch?v=FTBEwy-4QEg&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=50',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bab9af3a-a565-4071-8879-1da07053a7d6',
    'd2eab2c5-f642-40b9-ba98-3e9ce9945607',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ba14738c-5873-44c5-adb3-84446be73f5f',
    'd2eab2c5-f642-40b9-ba98-3e9ce9945607',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6221e7e8-734f-477b-9744-a4c1a583de40',
    'd2eab2c5-f642-40b9-ba98-3e9ce9945607',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e4a3ee25-b497-4089-8eee-0ff5a2d5f96c',
    'd2eab2c5-f642-40b9-ba98-3e9ce9945607',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [22] Affondo Safety bar
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '73c31d3e-3c55-41ab-8be3-05c5ad8306a7',
    'Affondo Safety bar',
    ARRAY['1  manubrio controlaterale', '1 manubrio omolaterale', 'in appoggio', '2 manubri', 'discesa lenta', 'fermo1" in basso', 'Multipower', 'Multipower pin', 'Al belt squat']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'eef03def-a1a2-4b12-92f7-bfc06e3d12db',
    '73c31d3e-3c55-41ab-8be3-05c5ad8306a7',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd5dc8462-3b79-4d2f-9a00-a292c2b7c460',
    '73c31d3e-3c55-41ab-8be3-05c5ad8306a7',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f7c05651-5939-43a5-bc82-1c6808755115',
    '73c31d3e-3c55-41ab-8be3-05c5ad8306a7',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '40743892-f367-4d18-a335-47bffc956c7a',
    '73c31d3e-3c55-41ab-8be3-05c5ad8306a7',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [23] Leg press
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'f906ae97-01dc-477f-8bdb-6f8fc1b7472a',
    'Leg press',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'salita esplosiva', 'piede alto focus gluteo', 'piedi in basso', 'piedi centrali']::text[],
    'https://www.youtube.com/watch?v=KkiE6kzL9Ak&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=29',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b6d334e1-f2a3-4f70-b075-52b21911d814',
    'f906ae97-01dc-477f-8bdb-6f8fc1b7472a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2f3fa41c-6337-4c5f-bcc0-c5532bd544fa',
    'f906ae97-01dc-477f-8bdb-6f8fc1b7472a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b3d88ddf-4e63-4ce7-9f43-fa59c9dcb51a',
    'f906ae97-01dc-477f-8bdb-6f8fc1b7472a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [24] Leg press monolaterale
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'f551313d-13cb-4af6-aa6e-d5bb2b3440ff',
    'Leg press monolaterale',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'salita esplosiva', 'piede alto focus gluteo', 'piedi in basso', 'piedi centrali']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd50e367b-c8f2-4e40-8a3f-4dcf6df4116a',
    'f551313d-13cb-4af6-aa6e-d5bb2b3440ff',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '74d17c5d-4b6c-47a6-ae41-a59eea5810ef',
    'f551313d-13cb-4af6-aa6e-d5bb2b3440ff',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '0aed7c24-4efb-4053-8f18-57934dbf5102',
    'f551313d-13cb-4af6-aa6e-d5bb2b3440ff',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [25] Hack Squat
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'b3da42b2-1df5-415e-976c-5e8d900f43c8',
    'Hack Squat',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'salita esplosiva', 'piede alto focus gluteo', 'piedi in basso', 'piedi centrali', 'Deloading', 'Overloading']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '19b0856b-8451-4d1e-9562-66f53aeaf734',
    'b3da42b2-1df5-415e-976c-5e8d900f43c8',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [26] Leg extension
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '6e3fabfb-f3ba-4b44-859c-4f53eab15fec',
    'Leg extension',
    ARRAY['fermo 1" in alto', 'discesa 3"']::text[],
    'https://www.youtube.com/watch?v=A1YytJHCQqc&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=39',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c325d65b-cd8a-4e17-8f50-30f3142c0e14',
    '6e3fabfb-f3ba-4b44-859c-4f53eab15fec',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [27] Sissi Squat
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '1c33ef96-2190-4afc-905b-2a537b70b15e',
    'Sissi Squat',
    ARRAY[]::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'acabb9d1-7a65-4001-8024-adfb5eb046c5',
    '1c33ef96-2190-4afc-905b-2a537b70b15e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [28] Copenaghen Plank
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '9f387630-c17b-414b-8d9f-67220771e41c',
    'Copenaghen Plank',
    ARRAY['isometria', 'full', 'ginocchio flesso']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '040d4bde-a44e-44ed-90da-71e2a36162b6',
    '9f387630-c17b-414b-8d9f-67220771e41c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'efd27775-6968-41cd-b944-38b6244edb38',
    '9f387630-c17b-414b-8d9f-67220771e41c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [29] Adductor Machine
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '4178222b-95a3-42c5-8323-7735099f6bdc',
    'Adductor Machine',
    ARRAY['apri in 3"', '2" in max stretch']::text[],
    'https://www.youtube.com/watch?v=WHBJQ7ax05U&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=42',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a1468125-4701-4eb9-bde0-5a3ea3d38e7a',
    '4178222b-95a3-42c5-8323-7735099f6bdc',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [30] Leg extension Monolaterale
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'ad38263a-615a-4a32-8054-276891f86e60',
    'Leg extension Monolaterale',
    ARRAY['fermo 1" in alto', 'discesa 3"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Accosciata') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e92daf6e-2187-452d-859a-c8e41892d2fc',
    'ad38263a-615a-4a32-8054-276891f86e60',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [31] Stacco Regular
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '7b56ae06-2b82-4288-9350-052bd371e967',
    'Stacco Regular',
    ARRAY['salita lenta 5"', 'salita 4" al ginocchio e chiudi', 'fermo 2" ad 1cm da terra', 'doppio fermo 2" appena staccato e 2" al ginocchio', 'fermo 2"al ginocchio', 'discesa 5"', 'deficit 5cm', 'deficit 8cm', 'Overloading', 'Delaoding', 'Beltless', 'No fascette']::text[],
    'https://www.youtube.com/watch?v=Mlv6rc7ARXA&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=53',
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f7c3d7cc-3409-4a31-a0a6-1d3ed3b5a1c6',
    '7b56ae06-2b82-4288-9350-052bd371e967',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '70dc2894-66c7-4436-87a0-92cfc7dfe4c2',
    '7b56ae06-2b82-4288-9350-052bd371e967',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4268127b-383e-4656-97f7-914662abcc8b',
    '7b56ae06-2b82-4288-9350-052bd371e967',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1ffc3120-2653-4f86-b4ca-f72fb2a55b18',
    '7b56ae06-2b82-4288-9350-052bd371e967',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f580504d-c3a9-4f95-adef-e6ed7a86d7af',
    '7b56ae06-2b82-4288-9350-052bd371e967',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '728d4eb0-16b9-4979-8c23-05b17019a942',
    '7b56ae06-2b82-4288-9350-052bd371e967',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [32] Stacco Regular Quadra Bar
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '15dd8135-f03c-4cfd-8f22-75ce5d3321b1',
    'Stacco Regular Quadra Bar',
    ARRAY['salita lenta 5"', 'salita 4" al ginocchio e chiudi', 'fermo 2" ad 1cm da terra', 'doppio fermo 2" appena staccato e 2" al ginocchio', 'fermo 2"al ginocchio', 'discesa 5"', 'deficit 5cm', 'deficit 8cm', 'Overloading', 'Delaoding', 'Beltless', 'No fascette']::text[],
    'https://www.youtube.com/watch?v=c6-J6z_Hpfc&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=32',
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bf278949-7fd7-43f9-ab10-6ad06b02b4e5',
    '15dd8135-f03c-4cfd-8f22-75ce5d3321b1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e8714021-980e-47f3-9f70-5fd26697a318',
    '15dd8135-f03c-4cfd-8f22-75ce5d3321b1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '38d7156c-3266-43e5-a55e-b773ae098622',
    '15dd8135-f03c-4cfd-8f22-75ce5d3321b1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'cd48ed40-53ad-42b6-8c13-7181d97da94e',
    '15dd8135-f03c-4cfd-8f22-75ce5d3321b1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '58e85641-39dc-4cdf-9d71-a994d5045def',
    '15dd8135-f03c-4cfd-8f22-75ce5d3321b1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4eb89e7e-2384-4341-9224-75c79af10a24',
    '15dd8135-f03c-4cfd-8f22-75ce5d3321b1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [33] Stacco Sumo
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '4a81d4fe-a172-45a3-8df3-4320911a5007',
    'Stacco Sumo',
    ARRAY['salita lenta 5"', 'salita 4" al ginocchio e chiudi', 'fermo 2" ad 1cm da terra', 'doppio fermo 2" appena staccato e 2" al ginocchio', 'fermo 2"al ginocchio', 'discesa 5"', 'deficit 5cm', 'deficit 8cm', 'Overloading', 'Delaoding', 'Beltless', 'No fascette']::text[],
    'https://www.youtube.com/watch?v=HQJ6XoMxuPk&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=31',
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4a1b84e9-f021-4816-8d01-843f3e94b292',
    '4a81d4fe-a172-45a3-8df3-4320911a5007',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '130cbd2a-b771-473a-8083-27dd43ac54e7',
    '4a81d4fe-a172-45a3-8df3-4320911a5007',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '90a1a905-e1a3-46fb-b854-d7abc082e214',
    '4a81d4fe-a172-45a3-8df3-4320911a5007',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7c621ea1-04bf-4891-b8af-b344b8ca3640',
    '4a81d4fe-a172-45a3-8df3-4320911a5007',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3989afa8-c6d6-4403-a8ac-3d0b652e42be',
    '4a81d4fe-a172-45a3-8df3-4320911a5007',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6c6f2be2-bb7f-4bcf-8b93-d85bf6c8580f',
    '4a81d4fe-a172-45a3-8df3-4320911a5007',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [34] Stacco Semi-Sumo
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '89d3bb1e-cdc8-45ea-b318-38ef125fba7a',
    'Stacco Semi-Sumo',
    ARRAY['salita lenta 5"', 'salita 4" al ginocchio e chiudi', 'fermo 2" ad 1cm da terra', 'doppio fermo 2" appena staccato e 2" al ginocchio', 'fermo 2"al ginocchio', 'discesa 5"', 'deficit 5cm', 'deficit 8cm', 'Overloading', 'Delaoding', 'Beltless', 'No fascette']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '612d5261-a9ce-4b0c-8656-3d4f9468da55',
    '89d3bb1e-cdc8-45ea-b318-38ef125fba7a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '01342c21-e428-4e00-9004-38bd38b0567c',
    '89d3bb1e-cdc8-45ea-b318-38ef125fba7a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6a6a31b3-c173-44b1-9687-12481c4d34cf',
    '89d3bb1e-cdc8-45ea-b318-38ef125fba7a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd1f4a337-8443-40d5-ad77-c98f1ebd3664',
    '89d3bb1e-cdc8-45ea-b318-38ef125fba7a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b73b6786-aa90-48f9-8e7d-3dfc8944c83f',
    '89d3bb1e-cdc8-45ea-b318-38ef125fba7a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bcc57020-48ca-42e7-8c45-fd5199ae65c5',
    '89d3bb1e-cdc8-45ea-b318-38ef125fba7a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [35] Stacco Rumeno
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '9743f663-6141-448f-8d07-3b129d94aee1',
    'Stacco Rumeno',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'deficit', 'overlaoding', 'delaoding', 'dai blocchi con deadstop']::text[],
    'https://www.youtube.com/watch?v=Ni8-nEC3ucg&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=2',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e28b3613-321e-4b39-ac94-833f25110ac1',
    '9743f663-6141-448f-8d07-3b129d94aee1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '61e3b066-12c8-440b-8079-6b414aa77abe',
    '9743f663-6141-448f-8d07-3b129d94aee1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ebb8a225-99a8-43e4-8981-0b4a4c71aabd',
    '9743f663-6141-448f-8d07-3b129d94aee1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c8e29cb3-8ec8-4df4-9f51-5af1d8c08f59',
    '9743f663-6141-448f-8d07-3b129d94aee1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b21ccd26-bb42-4b55-9f42-2ce4b0a68c6f',
    '9743f663-6141-448f-8d07-3b129d94aee1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [36] Stacco Gambe Semitese
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '71cf0456-f8d2-4b74-add0-99a5a4c8053a',
    'Stacco Gambe Semitese',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'deficit', 'overlaoding', 'delaoding', 'dai blocchi con deadstop']::text[],
    'https://www.youtube.com/watch?v=lAKAAITyfkY&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=1',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2d4ce6a3-f5f5-4269-b8e3-67cec2af5ad1',
    '71cf0456-f8d2-4b74-add0-99a5a4c8053a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c0052127-6e32-4db7-81d8-5c641fd97ee7',
    '71cf0456-f8d2-4b74-add0-99a5a4c8053a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3f285713-9f38-4251-a850-d6add03c05ff',
    '71cf0456-f8d2-4b74-add0-99a5a4c8053a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '234cf85d-7fd3-483a-85f1-a1b439820770',
    '71cf0456-f8d2-4b74-add0-99a5a4c8053a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'be58bd10-f75b-4f56-908c-b13c45b37393',
    '71cf0456-f8d2-4b74-add0-99a5a4c8053a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [37] Stacco Regular Blocchi Bassi
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '3780a73f-c072-408f-95ec-c64098e7eb15',
    'Stacco Regular Blocchi Bassi',
    ARRAY['salita lenta 5"', 'salita 4" al ginocchio e chiudi', 'fermo 2" ad 1cm da terra', 'doppio fermo 2" appena staccato e 2" al ginocchio', 'fermo 2"al ginocchio', 'discesa 5"', 'deficit 5cm', 'deficit 8cm', 'Overloading', 'Delaoding', 'Beltless', 'No fascette']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '291ecf24-3006-4364-a1df-39952168df2d',
    '3780a73f-c072-408f-95ec-c64098e7eb15',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'fc9497d0-37d9-4d71-b3aa-ac0214c48443',
    '3780a73f-c072-408f-95ec-c64098e7eb15',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f611bddb-7d4a-439e-b9c0-33b214bc8b33',
    '3780a73f-c072-408f-95ec-c64098e7eb15',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a829f46b-735b-4102-912b-f6543f5a0f4f',
    '3780a73f-c072-408f-95ec-c64098e7eb15',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '8c2355ff-f833-40d7-b4d3-203909964cb3',
    '3780a73f-c072-408f-95ec-c64098e7eb15',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '215abaf4-3fd9-4856-b47a-2d41127608ca',
    '3780a73f-c072-408f-95ec-c64098e7eb15',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [38] Stacco Regular Blocchi Alti
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'ef8b4785-8f27-4ef5-807c-5ee74bdbc487',
    'Stacco Regular Blocchi Alti',
    ARRAY['salita lenta 5"', 'salita 4" al ginocchio e chiudi', 'fermo 2" ad 1cm da terra', 'doppio fermo 2" appena staccato e 2" al ginocchio', 'fermo 2"al ginocchio', 'discesa 5"', 'deficit 5cm', 'deficit 8cm', 'Overloading', 'Delaoding', 'Beltless', 'No fascette']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '36f72937-83a5-427f-9af3-6961a0f95562',
    'ef8b4785-8f27-4ef5-807c-5ee74bdbc487',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6222ceab-48a6-4ad8-a23f-79aa6b6715e6',
    'ef8b4785-8f27-4ef5-807c-5ee74bdbc487',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7493a47d-40dd-42e0-8771-285cc31d23be',
    'ef8b4785-8f27-4ef5-807c-5ee74bdbc487',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd6ad7cad-1e3e-414f-a1f3-bb53f4dbae44',
    'ef8b4785-8f27-4ef5-807c-5ee74bdbc487',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Quadricipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a05ba594-6688-40cb-a48d-5ea8b9b907f9',
    'ef8b4785-8f27-4ef5-807c-5ee74bdbc487',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7e400ef1-4b94-4030-9b17-2905718071d7',
    'ef8b4785-8f27-4ef5-807c-5ee74bdbc487',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [39] Stacco Rumeno B-stance Ktb
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'c05afd62-2099-44ef-8a8d-bab5b97e81b2',
    'Stacco Rumeno B-stance Ktb',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'deficit', 'overlaoding', 'delaoding', 'dai blocchi con deadstop']::text[],
    'https://www.youtube.com/watch?v=XaG2Vi6bAWE&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=48',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7375ca25-cede-4511-a0e2-ea3549e78ace',
    'c05afd62-2099-44ef-8a8d-bab5b97e81b2',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '8ad1682a-a100-44a3-8753-16f12882f88f',
    'c05afd62-2099-44ef-8a8d-bab5b97e81b2',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '494568ad-578d-4ab8-b970-60a8b40359ac',
    'c05afd62-2099-44ef-8a8d-bab5b97e81b2',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'fcd3324c-5dbd-4238-b8f0-41d14a412bcc',
    'c05afd62-2099-44ef-8a8d-bab5b97e81b2',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '65de2f77-a03c-4513-9d6c-06de2cb2135f',
    'c05afd62-2099-44ef-8a8d-bab5b97e81b2',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [40] Stacco Rumeno B-stance manubri
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'b2d0273c-176c-487a-b9b7-b3593e90b6db',
    'Stacco Rumeno B-stance manubri',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'deficit', 'overlaoding', 'delaoding', 'dai blocchi con deadstop']::text[],
    'https://www.youtube.com/watch?v=ToxsxlID254&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=49',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3b24cdc4-db16-4f17-8c25-4fcb08173dc2',
    'b2d0273c-176c-487a-b9b7-b3593e90b6db',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '18c6da1e-a244-4336-af45-d523336b1017',
    'b2d0273c-176c-487a-b9b7-b3593e90b6db',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c68585df-5635-4a7d-8db7-c90de2953dc6',
    'b2d0273c-176c-487a-b9b7-b3593e90b6db',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7eb8a02a-9ef6-4289-8f17-c1134c462664',
    'b2d0273c-176c-487a-b9b7-b3593e90b6db',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b38508aa-96df-4b2c-9a9f-2159baf3f7e2',
    'b2d0273c-176c-487a-b9b7-b3593e90b6db',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [41] Stacco Rumeno Mono su panca
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '82d787ae-b7cc-4249-a573-a723615d6bc6',
    'Stacco Rumeno Mono su panca',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'deficit', 'overlaoding', 'delaoding', 'dai blocchi con deadstop']::text[],
    'https://www.youtube.com/watch?v=rqaA9FNSatE&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=50',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '802cf259-57ba-4835-b49e-8cba8a4f04dd',
    '82d787ae-b7cc-4249-a573-a723615d6bc6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b7f0d54d-64bb-4478-a6fa-d8ba361551e4',
    '82d787ae-b7cc-4249-a573-a723615d6bc6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6c97c469-41ed-4003-ad99-d73697bd1d07',
    '82d787ae-b7cc-4249-a573-a723615d6bc6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '84459dd2-91ca-43d3-8149-99881f0d123a',
    '82d787ae-b7cc-4249-a573-a723615d6bc6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a68a5376-7b1d-44f1-9bfd-2acad9150c7f',
    '82d787ae-b7cc-4249-a573-a723615d6bc6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [42] Stacco Rumeno B-stance quadra bar
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '69e31b8d-cbdf-437d-9e4a-730a82dfb3d9',
    'Stacco Rumeno B-stance quadra bar',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'deficit', 'overlaoding', 'delaoding', 'dai blocchi con deadstop']::text[],
    'https://www.youtube.com/watch?v=XiVCq9HfdL4&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=51',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3b666192-9cea-4b70-a479-d2c45ea890d8',
    '69e31b8d-cbdf-437d-9e4a-730a82dfb3d9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ebab5a06-a987-420b-b4b8-619ae6463d89',
    '69e31b8d-cbdf-437d-9e4a-730a82dfb3d9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '56fc6ed5-f4e8-4ab2-a714-f677a35a32b9',
    '69e31b8d-cbdf-437d-9e4a-730a82dfb3d9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd8acea7b-6594-4f5f-956c-88c65919f66c',
    '69e31b8d-cbdf-437d-9e4a-730a82dfb3d9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '50a8b1a9-1183-4f7e-a11c-5065212c9144',
    '69e31b8d-cbdf-437d-9e4a-730a82dfb3d9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [43] Stacco Rumeno Ktb
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '97aaad74-a63b-46f5-b08e-4c221dbad610',
    'Stacco Rumeno Ktb',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'deficit', 'overlaoding', 'delaoding', 'dai blocchi con deadstop']::text[],
    'https://www.youtube.com/watch?v=q3Il2RtulAc&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=7',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7e668172-eb38-4d8d-a308-22695d6b0488',
    '97aaad74-a63b-46f5-b08e-4c221dbad610',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7733d686-4dc8-4dce-a0f8-b9a05bd00edc',
    '97aaad74-a63b-46f5-b08e-4c221dbad610',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e284ce66-3e58-4cea-a20a-8ea211bcba23',
    '97aaad74-a63b-46f5-b08e-4c221dbad610',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '957f6865-efed-403c-b345-7815782cdf5e',
    '97aaad74-a63b-46f5-b08e-4c221dbad610',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1272cf95-4911-46e3-8959-ba6d5f02fa23',
    '97aaad74-a63b-46f5-b08e-4c221dbad610',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [44] Stacco Rumeno Manubri
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'c174f193-dbf2-4433-a5e2-ba312d2b47ea',
    'Stacco Rumeno Manubri',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'deficit', 'overlaoding', 'delaoding', 'dai blocchi con deadstop']::text[],
    'https://www.youtube.com/watch?v=9v6Gj9xBLUc&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=58',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f0fd4c44-6c19-405e-b97a-b15612607359',
    'c174f193-dbf2-4433-a5e2-ba312d2b47ea',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'aeb087b8-fd9d-4735-9cbf-505dfc2cae32',
    'c174f193-dbf2-4433-a5e2-ba312d2b47ea',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'db7b9178-8599-48f0-8834-f3618f3204d4',
    'c174f193-dbf2-4433-a5e2-ba312d2b47ea',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '876729bb-b418-478f-a545-3db63484258a',
    'c174f193-dbf2-4433-a5e2-ba312d2b47ea',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6734ffa4-bee4-4823-a908-68666bdd6493',
    'c174f193-dbf2-4433-a5e2-ba312d2b47ea',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [45] Stacco Rumeno Belt Squat
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'a9216a0d-374b-425a-9dcd-278e7b5f9630',
    'Stacco Rumeno Belt Squat',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'deficit', 'overlaoding', 'delaoding', 'dai blocchi con deadstop']::text[],
    'https://www.youtube.com/watch?v=Nnz-j85L-cg&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=2',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '069cdb8f-ff81-442b-b138-2dedc850b024',
    'a9216a0d-374b-425a-9dcd-278e7b5f9630',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd8cfbd55-bb00-438b-a5be-02980c05495d',
    'a9216a0d-374b-425a-9dcd-278e7b5f9630',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a8afe865-1329-49d6-8899-1f659fca7bb7',
    'a9216a0d-374b-425a-9dcd-278e7b5f9630',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '59093c22-5a1e-4ba1-a5c4-3fe1c28d4e54',
    'a9216a0d-374b-425a-9dcd-278e7b5f9630',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd8555c89-105c-4cfe-9cc9-7710450f768a',
    'a9216a0d-374b-425a-9dcd-278e7b5f9630',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [46] Stacco Rumeno Multipower
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '58d98b51-d486-4ddd-ab35-8512554e8b38',
    'Stacco Rumeno Multipower',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'deficit', 'overlaoding', 'delaoding', 'dai blocchi con deadstop']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9345f64c-708d-4797-b54c-b7ac60ccea3b',
    '58d98b51-d486-4ddd-ab35-8512554e8b38',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3c129c92-81c2-4e2a-bab1-0da53c535d0d',
    '58d98b51-d486-4ddd-ab35-8512554e8b38',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c6f92ea6-5a7b-42a2-b954-5e834c54b928',
    '58d98b51-d486-4ddd-ab35-8512554e8b38',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e33a6973-da54-4800-8bf8-5d8f36082e47',
    '58d98b51-d486-4ddd-ab35-8512554e8b38',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e1cc6fdc-749e-4639-a7c5-9069b8be5b59',
    '58d98b51-d486-4ddd-ab35-8512554e8b38',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [47] Stacco Gambe Semite Manubri
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'd2417f23-e688-403b-8a3b-8ebb00b3788f',
    'Stacco Gambe Semite Manubri',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'deficit', 'overlaoding', 'delaoding', 'dai blocchi con deadstop']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f0370bc2-08bf-4c1a-a70f-4d07a45bb844',
    'd2417f23-e688-403b-8a3b-8ebb00b3788f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c3a30a78-0378-4769-ae01-eebd9c67f525',
    'd2417f23-e688-403b-8a3b-8ebb00b3788f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '8c4fa127-f848-4a4a-9af6-c92b7e2501fd',
    'd2417f23-e688-403b-8a3b-8ebb00b3788f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '309449cb-a3a6-46ea-a06e-42ff368793d2',
    'd2417f23-e688-403b-8a3b-8ebb00b3788f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6869c877-5475-4c41-94b3-9e0940b12d9f',
    'd2417f23-e688-403b-8a3b-8ebb00b3788f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [48] Stacco Gambe Semitese Multipower
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '21cc7a7a-022e-433f-aeef-f75a53b47a60',
    'Stacco Gambe Semitese Multipower',
    ARRAY['discesa 3"', 'fermo 1" in basso', 'deficit', 'overlaoding', 'delaoding', 'dai blocchi con deadstop']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '36981f9a-a3fe-46d8-9e98-f216b7d27b92',
    '21cc7a7a-022e-433f-aeef-f75a53b47a60',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '75ae4c2b-96ee-4933-8c4a-aa06c15a7890',
    '21cc7a7a-022e-433f-aeef-f75a53b47a60',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6145f534-bc7c-4052-abd0-4a27d2ed60ca',
    '21cc7a7a-022e-433f-aeef-f75a53b47a60',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b62e9580-294b-4069-9497-003189f20148',
    '21cc7a7a-022e-433f-aeef-f75a53b47a60',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9c95e94c-2388-48a4-ad0e-5a480c791275',
    '21cc7a7a-022e-433f-aeef-f75a53b47a60',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [49] Pull Trough Cavo Alto
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '8955182c-d9b5-40be-a39a-efa6925e5e58',
    'Pull Trough Cavo Alto',
    ARRAY[]::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6ae98b51-2110-46cc-bd5d-0582ec4e0d68',
    '8955182c-d9b5-40be-a39a-efa6925e5e58',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4c4d893a-f075-4d30-9402-e06d0515e64e',
    '8955182c-d9b5-40be-a39a-efa6925e5e58',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '8f32895f-b0ba-4071-895a-043188ac4d2e',
    '8955182c-d9b5-40be-a39a-efa6925e5e58',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'aa40563c-6541-41cf-b6f5-a315af01e579',
    '8955182c-d9b5-40be-a39a-efa6925e5e58',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '22093403-1d7c-41f5-b46e-06d9db583c9d',
    '8955182c-d9b5-40be-a39a-efa6925e5e58',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Adduttori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [50] Leg Curl
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '65e69946-4bfe-455f-94ce-e5be08ae786d',
    'Leg Curl',
    ARRAY['fermo 2" in basso', 'eccentrica 3"', '1"/1"/1"', '2"/2"/2"']::text[],
    'https://www.youtube.com/watch?v=YjALIwiPW-M&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=40',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c233951a-8887-47cb-b4a0-d9d4aee95f9d',
    '65e69946-4bfe-455f-94ce-e5be08ae786d',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [51] Leg Curl Monolaterale
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'b10d2459-56f5-4768-aa75-1673bafa10a9',
    'Leg Curl Monolaterale',
    ARRAY['fermo 2" in basso', 'eccentrica 3"', '1"/1"/1"', '2"/2"/2"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'fc9d01c7-d4b6-4ed5-9101-bf29cf862dfc',
    'b10d2459-56f5-4768-aa75-1673bafa10a9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [52] Nordic Curl
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '1cb8df20-a62a-4476-aa3b-4b15e9644ac3',
    'Nordic Curl',
    ARRAY['fermo 2" in basso', 'eccentrica 3"', '1"/1"/1"', '2"/2"/2"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1363bc6b-2237-4bbf-a31c-2a7b5cffb709',
    '1cb8df20-a62a-4476-aa3b-4b15e9644ac3',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [53] Revers Hyper
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'daec1f67-d627-4a74-b81f-eb4805bd512e',
    'Revers Hyper',
    ARRAY['controllata', 'oscillazione marcata']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c4754e16-a4a7-46e2-90a7-0a8563acff05',
    'daec1f67-d627-4a74-b81f-eb4805bd512e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '11bfd014-2f06-47f7-b0b8-708bf11e0aee',
    'daec1f67-d627-4a74-b81f-eb4805bd512e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  -- [54] Ipersestensioni Ghd
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'b4fecc13-2a46-4b05-982e-6d680c0f3ee3',
    'Ipersestensioni Ghd',
    ARRAY['2" in contrazione di picco', 'discesa 3"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '715b624a-6a61-47cf-82da-1bf219ab411c',
    'b4fecc13-2a46-4b05-982e-6d680c0f3ee3',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a0a0850c-e120-47f0-b71c-b2d8cd287aac',
    'b4fecc13-2a46-4b05-982e-6d680c0f3ee3',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  -- [55] Good Morning High Bar
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '038d9240-a8a8-4551-8e2c-761ec1564d83',
    'Good Morning High Bar',
    ARRAY['discesa 3"', 'pin', 'deloading', 'overloading', 'fermo 1" in max stretch', 'focus femorale', 'focus gluteo']::text[],
    'https://www.youtube.com/watch?v=UQZUy_x_U9M&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=52',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '40bb2638-54d6-44b6-add2-fa4a2f386a21',
    '038d9240-a8a8-4551-8e2c-761ec1564d83',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a4bd779a-d6e7-4651-9641-5a54d03d7531',
    '038d9240-a8a8-4551-8e2c-761ec1564d83',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '231bc675-f269-4596-a503-57a1cb83bbc5',
    '038d9240-a8a8-4551-8e2c-761ec1564d83',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [56] Good Morning Safety Bar
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'dd1e75a6-3d79-4c0f-803a-f46dbaba2273',
    'Good Morning Safety Bar',
    ARRAY['discesa 3"', 'pin', 'deloading', 'overloading', 'fermo 1" in max stretch', 'focus femorale', 'focus gluteo']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '0a226adf-f62d-49f1-b4e1-17c5a699e3c6',
    'dd1e75a6-3d79-4c0f-803a-f46dbaba2273',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4502ef62-4f7f-441e-bd4a-7ac8f40f2d6b',
    'dd1e75a6-3d79-4c0f-803a-f46dbaba2273',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bf093657-cabe-47a2-a1bb-9e1c937c2e2f',
    'dd1e75a6-3d79-4c0f-803a-f46dbaba2273',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Erettori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [57] Ponte a terra con bilanciere
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '67787ac1-aa7e-4a8c-ac9e-0b4bfe573365',
    'Ponte a terra con bilanciere',
    ARRAY['1" in contrazione di picco', '2" in contrazione di picco', '3" in contrazione di picco', 'esplosivo']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9c5eec85-5c39-4cc9-89a8-e35103299c73',
    '67787ac1-aa7e-4a8c-ac9e-0b4bfe573365',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [58] Hip Thrust Bilanciere
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'a4a58280-1266-4993-af90-59224add61ba',
    'Hip Thrust Bilanciere',
    ARRAY['1" in contrazione di picco', '2" in contrazione di picco', '3" in contrazione di picco', 'esplosivo']::text[],
    'https://www.youtube.com/watch?v=NmDkgFdT5l8&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=45',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f02e6a90-e5de-405a-8741-19c312900a27',
    'a4a58280-1266-4993-af90-59224add61ba',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [59] Hip Thrust Multipower
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '5b9f57ca-f142-4453-baaf-61c5de3e9a81',
    'Hip Thrust Multipower',
    ARRAY['1" in contrazione di picco', '2" in contrazione di picco', '3" in contrazione di picco', 'esplosivo']::text[],
    'https://www.youtube.com/watch?v=lyJ0MNf95jg&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=44',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd75d78d0-2ebc-4536-b7c6-cafc0d29633d',
    '5b9f57ca-f142-4453-baaf-61c5de3e9a81',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [60] Hip Thrust Machine
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '90329586-74a7-4abc-96af-dc46dd35ed20',
    'Hip Thrust Machine',
    ARRAY['1" in contrazione di picco', '2" in contrazione di picco', '3" in contrazione di picco', 'esplosivo']::text[],
    'https://www.youtube.com/watch?v=lyJ0MNf95jg&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=44',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2738ca9e-0a15-4b39-bc78-644f30f56a6b',
    '90329586-74a7-4abc-96af-dc46dd35ed20',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [61] Ponte a terra con manubrio
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'd10b5180-9d6d-4430-b6cc-9346611d5f0b',
    'Ponte a terra con manubrio',
    ARRAY['1" in contrazione di picco', '2" in contrazione di picco', '3" in contrazione di picco', 'esplosivo']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '66e5488f-2a45-43a3-8f67-ade308d6a10d',
    'd10b5180-9d6d-4430-b6cc-9346611d5f0b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [62] Swing con kettlbell
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'e5b68f45-a116-475d-a948-0c0620488764',
    'Swing con kettlbell',
    ARRAY[]::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '24554156-bf50-4698-92d3-a0008fb95c8d',
    'e5b68f45-a116-475d-a948-0c0620488764',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Femorali') LIMIT 1),
    0.8
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f0da0779-34ee-443e-81ef-8186314bd4b4',
    'e5b68f45-a116-475d-a948-0c0620488764',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [63] Panca
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '787cf45f-adb1-45b0-96b0-7c6c41a72629',
    'Panca',
    ARRAY['fermo 1"', 'fermo 3"', 'fermo 5"', 'discesa 3"', 'discesa 5"', '3"/3"', '5"/5"', 'salita 3"', 'spoto pres', 'overaloding', 'deloading', 'caos 30%', 'full caos', 'pin', 'board 4cm', 'board alta', 'catene']::text[],
    'https://www.youtube.com/watch?v=uMpwfacViL0&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=54',
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '340393cf-ac46-40cf-abbd-2ca4ab0f2ab7',
    '787cf45f-adb1-45b0-96b0-7c6c41a72629',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd07313e4-37cb-42f6-a574-32d0fcff49f4',
    '787cf45f-adb1-45b0-96b0-7c6c41a72629',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '673110da-fe67-4801-8979-f01b5520e93e',
    '787cf45f-adb1-45b0-96b0-7c6c41a72629',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [64] Panca Cambered Bar
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'f5c9a84c-d070-4e53-8679-42f51ccfd9a4',
    'Panca Cambered Bar',
    ARRAY['fermo 1"', 'fermo 3"', 'fermo 5"', 'discesa 3"', 'discesa 5"', '3"/3"', '5"/5"', 'salita 3"', 'spoto pres', 'overaloding', 'deloading', 'caos 30%', 'full caos', 'pin', 'board 4cm', 'board alta', 'catene']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1fa7de8f-c004-4e7c-9087-04ce7c2b67f4',
    'f5c9a84c-d070-4e53-8679-42f51ccfd9a4',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e7b7f82b-f5a4-46c9-b3e1-be9256d4f083',
    'f5c9a84c-d070-4e53-8679-42f51ccfd9a4',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7960a38e-1c63-49f5-a043-875cd9284a40',
    'f5c9a84c-d070-4e53-8679-42f51ccfd9a4',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [65] Panca Bow Bar
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '8d32b6e3-e474-47b0-9332-5a72785fe6b0',
    'Panca Bow Bar',
    ARRAY['fermo 1"', 'fermo 3"', 'fermo 5"', 'discesa 3"', 'discesa 5"', '3"/3"', '5"/5"', 'salita 3"', 'spoto pres', 'overaloding', 'deloading', 'caos 30%', 'full caos', 'pin', 'board 4cm', 'board alta', 'catene']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '418ffaec-96e6-4572-9e1c-ab37d05f592d',
    '8d32b6e3-e474-47b0-9332-5a72785fe6b0',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd2c8a12f-aab7-4a8b-a408-6b204fe96a66',
    '8d32b6e3-e474-47b0-9332-5a72785fe6b0',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bd0e9967-912d-4e0b-87ba-017a1afe8787',
    '8d32b6e3-e474-47b0-9332-5a72785fe6b0',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [66] Panca Presa Stretta
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'd5908f88-8cce-4c86-b222-ef8ef2d8d3cb',
    'Panca Presa Stretta',
    ARRAY['fermo 1"', 'fermo 3"', 'fermo 5"', 'discesa 3"', 'discesa 5"', '3"/3"', '5"/5"', 'salita 3"', 'spoto pres', 'overaloding', 'deloading', 'caos 30%', 'full caos', 'pin', 'board 4cm', 'board alta', 'catene']::text[],
    'https://www.youtube.com/watch?v=FTV-bD7gVkQ&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=24',
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '992fb765-7b70-44a6-8bda-7d5ee98c34dc',
    'd5908f88-8cce-4c86-b222-ef8ef2d8d3cb',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9beda600-ca0b-406f-802c-5e3547f669ef',
    'd5908f88-8cce-4c86-b222-ef8ef2d8d3cb',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd75b07cd-5d3a-4f4f-a47e-4db6480d55a1',
    'd5908f88-8cce-4c86-b222-ef8ef2d8d3cb',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [67] Panca Board
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '2d1f59f7-47b0-468b-bf3f-261309903358',
    'Panca Board',
    ARRAY['fermo 1"', 'fermo 3"', 'fermo 5"', 'discesa 3"', 'discesa 5"', '3"/3"', '5"/5"', 'salita 3"', 'spoto pres', 'overaloding', 'deloading', 'caos 30%', 'full caos', 'pin', 'board 4cm', 'board alta', 'catene']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '38ef8189-50c9-416d-a679-e6913d8ff156',
    '2d1f59f7-47b0-468b-bf3f-261309903358',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3c19c062-48ba-4be3-b627-f69cb72ebd44',
    '2d1f59f7-47b0-468b-bf3f-261309903358',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b98cb08e-8a2d-43b4-b796-1290dc78c2d4',
    '2d1f59f7-47b0-468b-bf3f-261309903358',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [68] Panca Manubri
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '00f1062d-0410-41fc-ba5f-e5102b604a73',
    'Panca Manubri',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    'https://www.youtube.com/watch?v=861u9F71m4g&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=51',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4ac63c16-2259-41ce-9bda-b09d89cfb789',
    '00f1062d-0410-41fc-ba5f-e5102b604a73',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e9925950-7ea3-49f2-bcc6-099c9122d6e4',
    '00f1062d-0410-41fc-ba5f-e5102b604a73',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c2c71ac8-f6b8-41a7-aa38-d3c21d318d77',
    '00f1062d-0410-41fc-ba5f-e5102b604a73',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [69] Croci Manubri
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '0736bb0c-b6df-4e8b-8689-cdfb2411514b',
    'Croci Manubri',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    'https://www.youtube.com/watch?v=TGsfbMxIyn8&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=21',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bbc718b4-f18a-4255-b61c-61f2935f5854',
    '0736bb0c-b6df-4e8b-8689-cdfb2411514b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.2
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'af76fafd-56d5-4513-953f-30e161e430fe',
    '0736bb0c-b6df-4e8b-8689-cdfb2411514b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [70] Croci Manubri deadstop
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '15a0f1f9-7b00-452c-a421-897a204e81f5',
    'Croci Manubri deadstop',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    'https://www.youtube.com/watch?v=OEKU-W6S2-A&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=18',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b2dff3d2-b6c3-420c-8c63-8d03eba23b35',
    '15a0f1f9-7b00-452c-a421-897a204e81f5',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.2
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '47b518dc-24a1-4734-a3d6-b4e56e5ac50d',
    '15a0f1f9-7b00-452c-a421-897a204e81f5',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [71] Panca inclinata Bilanciere
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'e4c09edc-3631-4b2f-89fd-ef626ee0ae89',
    'Panca inclinata Bilanciere',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'fb5b409c-9871-4c3b-8634-15abb7e46a11',
    'e4c09edc-3631-4b2f-89fd-ef626ee0ae89',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '429be1f3-57ab-44ce-ac5c-26ed1af4c321',
    'e4c09edc-3631-4b2f-89fd-ef626ee0ae89',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'abe0719c-4137-490a-83fc-063a27af8740',
    'e4c09edc-3631-4b2f-89fd-ef626ee0ae89',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [72] Chest Press
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '20b8b0bc-c9e1-456a-8875-ebe0eee24f80',
    'Chest Press',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    'https://www.youtube.com/watch?v=M_zp4kTbWtY&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=41',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '31fd474f-6b67-45cb-8abb-4f8cbdf0b90c',
    '20b8b0bc-c9e1-456a-8875-ebe0eee24f80',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '23aa7bb4-458c-4814-93df-9ae9ddc20a6f',
    '20b8b0bc-c9e1-456a-8875-ebe0eee24f80',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '58086ded-5b4f-4a87-b1a3-e726f9263551',
    '20b8b0bc-c9e1-456a-8875-ebe0eee24f80',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [73] Panca Inclinata Manubri 45°
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '30a52e28-7769-42ed-b91e-e66b334b068f',
    'Panca Inclinata Manubri 45°',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c771e284-8d2d-4176-81f6-8e9abeae4d3e',
    '30a52e28-7769-42ed-b91e-e66b334b068f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '0c2bb18e-89b2-4dc2-81ed-65c17b4782fb',
    '30a52e28-7769-42ed-b91e-e66b334b068f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '48169c97-660d-437b-9e29-04f5451e8440',
    '30a52e28-7769-42ed-b91e-e66b334b068f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [74] Panca Inclinata Manubri 30°
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'cdb879e9-e795-483f-96ac-2ab555d82ef0',
    'Panca Inclinata Manubri 30°',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd0c00f92-5308-4aaa-b93a-470410063d34',
    'cdb879e9-e795-483f-96ac-2ab555d82ef0',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '62806d85-dac3-46eb-a3c5-be8e54e4f2a2',
    'cdb879e9-e795-483f-96ac-2ab555d82ef0',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '93219a29-4f0d-47f6-99cc-bb225231b657',
    'cdb879e9-e795-483f-96ac-2ab555d82ef0',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [75] Croci Manubri 45°
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '2ff6428a-fb0e-420b-ac3a-32601e6b9f15',
    'Croci Manubri 45°',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '760aae0a-5d5f-4d30-8c18-1b2af52cb945',
    '2ff6428a-fb0e-420b-ac3a-32601e6b9f15',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [76] Croci Manubri 30°
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '2b5ab327-5262-4da7-89b0-8d007a375421',
    'Croci Manubri 30°',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    'https://www.youtube.com/watch?v=Aq5EwC31mck&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=19',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c71e3a55-8a3d-4ff7-908a-6ebce8f9951c',
    '2b5ab327-5262-4da7-89b0-8d007a375421',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [77] Croci al cavo dall'alto
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'd40e4048-c69c-4f50-b08a-64aa7f3747b9',
    'Croci al cavo dall''alto',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'de2441b9-74db-4f60-a44e-1e72c4ef6106',
    'd40e4048-c69c-4f50-b08a-64aa7f3747b9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [78] Croci al cavo altezza spalle
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '7f868463-d678-47b9-9912-d2d14e36ba87',
    'Croci al cavo altezza spalle',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '50ea0b24-2b09-4663-be94-5ae2b62469cc',
    '7f868463-d678-47b9-9912-d2d14e36ba87',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [79] Chest Press Stretta
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '9691588f-01a4-48c9-9dc2-463bfa909dc9',
    'Chest Press Stretta',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2349c751-239d-471a-ba18-272f1987f93c',
    '9691588f-01a4-48c9-9dc2-463bfa909dc9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1dafde81-166a-46b3-9888-dc5d1838b66a',
    '9691588f-01a4-48c9-9dc2-463bfa909dc9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9901a88a-54fe-4fbc-b763-fa8c8bab9dc4',
    '9691588f-01a4-48c9-9dc2-463bfa909dc9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [80] Dip
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '3d1d4068-4dd9-4818-bc82-243f9aa0475e',
    'Dip',
    ARRAY['fermo 1" al parallelo', 'fermo 1" poco sotto il parallo', 'fino sotto parallelo', 'deloading', 'overloading', 'salita 3"', 'discesa 3"', 'doppio fermo 2" in discesa']::text[],
    NULL,
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bbd4fc55-5fdf-4134-a57e-acc8a262cb35',
    '3d1d4068-4dd9-4818-bc82-243f9aa0475e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '20469132-f6ea-4c37-b0b5-aa4c95f3959e',
    '3d1d4068-4dd9-4818-bc82-243f9aa0475e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f1b73296-31e1-4402-81da-8237dfd30888',
    '3d1d4068-4dd9-4818-bc82-243f9aa0475e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [81] Dip Assistite Elastico
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'e4b2e496-ccd5-4d6e-80e5-cfd6bb23215a',
    'Dip Assistite Elastico',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f8d24fe3-49ff-4aa6-8549-5504f4d90076',
    'e4b2e496-ccd5-4d6e-80e5-cfd6bb23215a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2eed5bd3-d0b7-497a-874a-04f827d6142e',
    'e4b2e496-ccd5-4d6e-80e5-cfd6bb23215a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'fa37c64d-be27-4b50-99da-d9c433b0be52',
    'e4b2e496-ccd5-4d6e-80e5-cfd6bb23215a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [82] Dip Assistite Piedi
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '8025fcfb-e7f8-47a9-9fad-522c12b98b1c',
    'Dip Assistite Piedi',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    'https://www.youtube.com/watch?v=OlbMBFhEXSU&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=18',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '30defe71-6f7a-47f0-ae95-bbb236a6eab6',
    '8025fcfb-e7f8-47a9-9fad-522c12b98b1c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9e9bd3e9-55d9-4697-a0d1-84eaab1fa6bf',
    '8025fcfb-e7f8-47a9-9fad-522c12b98b1c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '996dc2d9-e1a8-4c4c-b228-06048bb8f28a',
    '8025fcfb-e7f8-47a9-9fad-522c12b98b1c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [83] Panca Piana Multipower
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '6fc7acb2-34ec-4c84-877f-5fe9085bd2f4',
    'Panca Piana Multipower',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a07e1682-1ecc-448c-af51-80942f15a346',
    '6fc7acb2-34ec-4c84-877f-5fe9085bd2f4',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '258a5df3-0627-4607-b925-991e6d2711c0',
    '6fc7acb2-34ec-4c84-877f-5fe9085bd2f4',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '42469525-5329-4c19-89de-23e542847360',
    '6fc7acb2-34ec-4c84-877f-5fe9085bd2f4',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [84] Panca Inclinata Multipower
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'f0cf2e40-553e-41a3-b51c-70e7b5f58577',
    'Panca Inclinata Multipower',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2e2efce1-cdb9-41e4-b471-f023d0011148',
    'f0cf2e40-553e-41a3-b51c-70e7b5f58577',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'dd2b5c2f-4f72-4734-9ecd-b06a066e5127',
    'f0cf2e40-553e-41a3-b51c-70e7b5f58577',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ccae7bae-24ee-4cef-9652-246aa30278af',
    'f0cf2e40-553e-41a3-b51c-70e7b5f58577',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [85] Piegamenti Assititi con elastico
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '4d0f7f6b-0bac-4868-a17f-d355807a9d7d',
    'Piegamenti Assititi con elastico',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '8f27efd3-0d32-435a-8830-6490fdfbfa82',
    '4d0f7f6b-0bac-4868-a17f-d355807a9d7d',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ee4d1b78-f390-4f5b-963d-2c1f346e409c',
    '4d0f7f6b-0bac-4868-a17f-d355807a9d7d',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '70b0aae0-5a58-4d51-b067-d71ebf54621a',
    '4d0f7f6b-0bac-4868-a17f-d355807a9d7d',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [86] Piegamenti mani su rialzo
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '2195e468-b6c3-4c9d-aab1-d8796c8c7775',
    'Piegamenti mani su rialzo',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    'https://www.youtube.com/watch?v=7PbWb6FFj7o&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=26',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2ca67b4a-b88d-4dae-9df0-bd63f357f39c',
    '2195e468-b6c3-4c9d-aab1-d8796c8c7775',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e9e60475-6719-433f-b171-4777a54d058f',
    '2195e468-b6c3-4c9d-aab1-d8796c8c7775',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6273e79f-3a40-47da-b177-6fc01289e33c',
    '2195e468-b6c3-4c9d-aab1-d8796c8c7775',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [87] Piegamenti
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '80e8d5f0-5f36-4c14-8aa2-154e9bb1da66',
    'Piegamenti',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    'https://www.youtube.com/watch?v=FTE_OwNAGNQ&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=38',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '0cd0b2ad-98ec-480f-b019-07b5f72253b2',
    '80e8d5f0-5f36-4c14-8aa2-154e9bb1da66',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '64712d94-9354-463f-81e6-8809867fd895',
    '80e8d5f0-5f36-4c14-8aa2-154e9bb1da66',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'dd4f6c27-02d1-43d2-ba19-711963a40456',
    '80e8d5f0-5f36-4c14-8aa2-154e9bb1da66',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [88] Piegamenti extra rom
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'dacff0ae-92d7-423e-8267-fdbcf7f364f1',
    'Piegamenti extra rom',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3a5979e7-aacf-48ba-a185-5237e4039c9c',
    'dacff0ae-92d7-423e-8267-fdbcf7f364f1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '0debaad9-1592-4b9e-9fff-1a3e81ccac21',
    'dacff0ae-92d7-423e-8267-fdbcf7f364f1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '5770059d-7efa-4f50-9d9d-3cd65a1a0f3b',
    'dacff0ae-92d7-423e-8267-fdbcf7f364f1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [89] Piegamenti Zavorrati
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '5f89450e-64f5-44fc-9358-effaff54711e',
    'Piegamenti Zavorrati',
    ARRAY['fermo 1" in max stretch', 'discesa 3"', '3"/3"', 'focus respiro e rotazione omero', 'fermo 3" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c339e3ce-b35e-4b20-a44b-be9eeb39f4f7',
    '5f89450e-64f5-44fc-9358-effaff54711e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3b4c6460-5651-43e0-b4d6-5b174495c6f7',
    '5f89450e-64f5-44fc-9358-effaff54711e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Pettorali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3eef8680-3162-4c11-92d6-cee714626d96',
    '5f89450e-64f5-44fc-9358-effaff54711e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [90] Military Press
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '58208037-0ae9-4275-abb8-af5e10f7aa33',
    'Military Press',
    ARRAY['discesa 3"', 'salita esplosiva', 'caos 50%', 'full caos', 'pin', 'loading']::text[],
    'https://www.youtube.com/watch?v=k4y09R25b5c&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=39',
    'fundamental'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd121c569-b445-43da-a435-4bc9744039f2',
    '58208037-0ae9-4275-abb8-af5e10f7aa33',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'acf3dc48-05b3-480c-978f-de5361c48598',
    '58208037-0ae9-4275-abb8-af5e10f7aa33',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b071d49f-21bf-4916-a8d4-b88b070c6e52',
    '58208037-0ae9-4275-abb8-af5e10f7aa33',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Laterali') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '50cd14a4-207d-4f92-9067-4726394416d7',
    '58208037-0ae9-4275-abb8-af5e10f7aa33',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [91] Military Press Multipower
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '7729434a-c6d7-4ad5-8a27-ba7cce0aa6a9',
    'Military Press Multipower',
    ARRAY['discesa 3"', 'salita esplosiva', 'caos 50%', 'full caos', 'pin', 'loading']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '24bb71f1-61e4-4191-931c-b72f0aba94f1',
    '7729434a-c6d7-4ad5-8a27-ba7cce0aa6a9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ea0c8398-fa99-464b-83f1-7f52f37b3260',
    '7729434a-c6d7-4ad5-8a27-ba7cce0aa6a9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a65a6c8e-5a81-49d7-9c52-530835cd4fe3',
    '7729434a-c6d7-4ad5-8a27-ba7cce0aa6a9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Laterali') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '5c60a270-9b82-4821-ac35-f595cdf9f729',
    '7729434a-c6d7-4ad5-8a27-ba7cce0aa6a9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [92] Military Press Cambered
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '21bb988f-cd75-4b86-919a-ed2fc787eb01',
    'Military Press Cambered',
    ARRAY['discesa 3"', 'salita esplosiva', 'caos 50%', 'full caos', 'pin', 'loading']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7d6aafec-d42d-4354-b5ae-307e05429d55',
    '21bb988f-cd75-4b86-919a-ed2fc787eb01',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2f620d6a-8653-4b06-841a-27bfe42fcbc4',
    '21bb988f-cd75-4b86-919a-ed2fc787eb01',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c9aa635e-c558-43ce-8721-eb412bd3effd',
    '21bb988f-cd75-4b86-919a-ed2fc787eb01',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Laterali') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd316f0ad-0e59-4af2-b026-2718eee34289',
    '21bb988f-cd75-4b86-919a-ed2fc787eb01',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [93] Lento Avanti Manubri
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '456fd2db-64c4-427f-aa4a-682f0314f20b',
    'Lento Avanti Manubri',
    ARRAY['discesa 3"', 'fermo 1" in basso', '3"/3"', 'largo']::text[],
    'https://www.youtube.com/watch?v=nn4BIHnZIwA&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=23',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a37cd88d-49ab-4e1f-a4d6-2bdb0fa6261f',
    '456fd2db-64c4-427f-aa4a-682f0314f20b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3740c9c9-5bbf-4779-b49f-0e4661cb1411',
    '456fd2db-64c4-427f-aa4a-682f0314f20b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1ded363a-82e2-4350-b78b-a3f511d03fb7',
    '456fd2db-64c4-427f-aa4a-682f0314f20b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Laterali') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1ee1bf9e-49d8-4910-adb8-17f85804094b',
    '456fd2db-64c4-427f-aa4a-682f0314f20b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [94] Shoulder Press Stretta
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'dfab5529-bce1-47bc-ad23-a5c875c2b6ee',
    'Shoulder Press Stretta',
    ARRAY['discesa 3"', 'deadstop in basso', 'discesa controllata', 'salita esplosiva']::text[],
    'https://www.youtube.com/watch?v=GwADCsapKiM&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=30',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '699a81d4-8503-4085-a59b-6f0e767d5770',
    'dfab5529-bce1-47bc-ad23-a5c875c2b6ee',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'cb35d613-1013-43ca-aad9-48349b8834d9',
    'dfab5529-bce1-47bc-ad23-a5c875c2b6ee',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Laterali') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '643230e2-a7b1-4ec3-9307-594191f01b0b',
    'dfab5529-bce1-47bc-ad23-a5c875c2b6ee',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [95] Shoulder Press Larga
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '47043605-9559-444d-8cb3-6eadba2a5978',
    'Shoulder Press Larga',
    ARRAY['discesa 3"', 'deadstop in basso', 'discesa controllata', 'salita esplosiva']::text[],
    'https://www.youtube.com/watch?v=GwADCsapKiM&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=30',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1bac1e9a-ca7a-4a42-a798-8b667163d6d2',
    '47043605-9559-444d-8cb3-6eadba2a5978',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '40755599-92a4-408f-8b65-643b35d03f8d',
    '47043605-9559-444d-8cb3-6eadba2a5978',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Laterali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '398ca80d-a713-4ce1-a457-c55c5e54827a',
    '47043605-9559-444d-8cb3-6eadba2a5978',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [96] Alzate Laterali in piedi
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'f4ec4ee9-f22a-4337-b94a-310237c535e9',
    'Alzate Laterali in piedi',
    ARRAY['1" in contrazione di picco', '2" in contrazione di picco', '3" in contrazione di picco', 'cheating', 'isometria']::text[],
    'https://www.youtube.com/watch?v=D7jNnWf2ErM&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=60',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'af57d4a9-8998-4564-a452-68a2926dd968',
    'f4ec4ee9-f22a-4337-b94a-310237c535e9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Laterali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [97] Alzate Laterali al cavo
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '3b444fc3-9953-4ee5-818f-9b28738dd0cd',
    'Alzate Laterali al cavo',
    ARRAY['1" in contrazione di picco', '2" in contrazione di picco', '3" in contrazione di picco', 'cheating', 'isometria']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '82eb5d92-6745-445a-bb9a-455a0a85c04c',
    '3b444fc3-9953-4ee5-818f-9b28738dd0cd',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Laterali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [98] Alzate monolaterali panca 30°
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'cde364e4-51ae-4f9a-a4e0-91c55f014dd6',
    'Alzate monolaterali panca 30°',
    ARRAY['1" in contrazione di picco', '2" in contrazione di picco', '3" in contrazione di picco', 'cheating', 'isometria']::text[],
    'https://www.youtube.com/watch?v=Ep0Gm8EHYSU&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=17',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '5aa0a1bf-2916-459f-a0d3-d3d046cd49d9',
    'cde364e4-51ae-4f9a-a4e0-91c55f014dd6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Laterali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [99] Alzate laterali chest supported
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'a54aeec3-6a1a-4938-a18f-9be592aabc44',
    'Alzate laterali chest supported',
    ARRAY['1" in contrazione di picco', '2" in contrazione di picco', '3" in contrazione di picco', 'cheating', 'isometria']::text[],
    'https://www.youtube.com/watch?v=ojn09mq756A&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=43',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f93f662a-c734-45e2-9e90-616a1628adc6',
    'a54aeec3-6a1a-4938-a18f-9be592aabc44',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Laterali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [100] Alzate laterali deadstop a terra
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'c88c5fd8-dde6-4c40-97ae-d4a5ac5210c3',
    'Alzate laterali deadstop a terra',
    ARRAY['1" in contrazione di picco', '2" in contrazione di picco', '3" in contrazione di picco', 'cheating', 'isometria']::text[],
    'https://www.youtube.com/watch?v=ysesCFRdcgI&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=44',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'caf0f8a1-1713-4e87-8727-4392322637ba',
    'c88c5fd8-dde6-4c40-97ae-d4a5ac5210c3',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Laterali') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [101] Handstand push up
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'e62e32e5-5b7a-4b1e-a194-c5fdff136c09',
    'Handstand push up',
    ARRAY['discesa 3"', 'fermo 1" in basso', '3"/3"', 'largo']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Spinta verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ac507c4c-1afc-45fb-bcf8-1f574ab2b24d',
    'e62e32e5-5b7a-4b1e-a194-c5fdff136c09',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '94c1a216-9b50-4f73-8155-aa73b74137ec',
    'e62e32e5-5b7a-4b1e-a194-c5fdff136c09',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Anteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '025f587c-e071-47a9-addf-7d7149c89daa',
    'e62e32e5-5b7a-4b1e-a194-c5fdff136c09',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Laterali') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b96b36d2-35f8-446a-a536-22399f5407cf',
    'e62e32e5-5b7a-4b1e-a194-c5fdff136c09',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [102] Trazioni Presa Prona
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '38732032-3941-4ce4-813f-94dc465e8677',
    'Trazioni Presa Prona',
    ARRAY['dealoading', 'facilitate con elastico', 'loading', 'focus dorsale', 'focus scapolare', 'fermo 2" alla fronte salita  3"', 'salita 3" alla fonte', 'discesa 5"']::text[],
    'https://www.youtube.com/watch?v=q5jLgD_5gU4&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=41',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2fb488ff-819c-4284-9b39-48ef5500ff67',
    '38732032-3941-4ce4-813f-94dc465e8677',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9296baf2-45ce-42f8-a8d8-4dbac8718a65',
    '38732032-3941-4ce4-813f-94dc465e8677',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a9c43505-61f8-4ede-beca-f424d000ba86',
    '38732032-3941-4ce4-813f-94dc465e8677',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [103] Trazioni Presa Supina
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'e1b92494-a570-4541-8ae9-cbcb05e44ca1',
    'Trazioni Presa Supina',
    ARRAY['dealoading', 'facilitate con elastico', 'loading', 'focus dorsale', 'focus scapolare', 'fermo 2" alla fronte salita  3"', 'salita 3" alla fonte', 'discesa 5"']::text[],
    'https://www.youtube.com/watch?v=q5jLgD_5gU4&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=42',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '81f433c1-f6dc-43df-8651-268575211f46',
    'e1b92494-a570-4541-8ae9-cbcb05e44ca1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '0392d9d5-2009-475d-bad8-2a56fabd10ab',
    'e1b92494-a570-4541-8ae9-cbcb05e44ca1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [104] Trazioni Presa Neutra Stretta
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '8661a9a4-607b-42b3-94a1-7e9d597f3432',
    'Trazioni Presa Neutra Stretta',
    ARRAY['dealoading', 'facilitate con elastico', 'loading', 'focus dorsale', 'focus scapolare', 'fermo 2" alla fronte salita  3"', 'salita 3" alla fonte', 'discesa 5"']::text[],
    'https://www.youtube.com/watch?v=q5jLgD_5gU4&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=43',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7772fe02-b02b-4fd5-b837-d10c5a303610',
    '8661a9a4-607b-42b3-94a1-7e9d597f3432',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f809bb79-cd76-4c09-8e11-730f4f25252b',
    '8661a9a4-607b-42b3-94a1-7e9d597f3432',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [105] Trazioni Presa Neutra Larga
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'bebe961d-3658-4372-988e-3321bb281631',
    'Trazioni Presa Neutra Larga',
    ARRAY['dealoading', 'facilitate con elastico', 'loading', 'focus dorsale', 'focus scapolare', 'fermo 2" alla fronte salita  3"', 'salita 3" alla fonte', 'discesa 5"']::text[],
    'https://www.youtube.com/watch?v=q5jLgD_5gU4&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=44',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd39791e7-4ab5-4679-9a0b-8d8806e6f395',
    'bebe961d-3658-4372-988e-3321bb281631',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2fadcbf5-973d-40eb-89ad-d1899c0e739f',
    'bebe961d-3658-4372-988e-3321bb281631',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3fa96470-65e6-4406-bf22-4e43bc4249c9',
    'bebe961d-3658-4372-988e-3321bb281631',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [106] Trazioni Anelli
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'd35c4ef7-4658-4dee-bc9f-a1d4f9830be5',
    'Trazioni Anelli',
    ARRAY['dealoading', 'facilitate con elastico', 'loading', 'focus dorsale', 'focus scapolare', 'fermo 2" alla fronte salita  3"', 'salita 3" alla fonte', 'discesa 5"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f90983d4-f063-4478-875b-80b5c2bf2025',
    'd35c4ef7-4658-4dee-bc9f-a1d4f9830be5',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'dd79aba0-a02f-490a-9047-ed3bdb527541',
    'd35c4ef7-4658-4dee-bc9f-a1d4f9830be5',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [107] Lat machine Supina
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '582cf208-36f2-42d2-9829-8e3e3ced124e',
    'Lat machine Supina',
    ARRAY['fermo 1" in basso', 'fermo 2" in basso', 'risalita 3"', 'discesa 3"', 'focus dorso', 'focus scapola']::text[],
    'https://www.youtube.com/watch?v=B_n5uMLxDk0&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=11',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1bedc5c6-d6bb-4c69-9347-b16da746153d',
    '582cf208-36f2-42d2-9829-8e3e3ced124e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1eda4d17-2ab8-4342-bc97-2172ec0fe907',
    '582cf208-36f2-42d2-9829-8e3e3ced124e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [108] Lat Machine Prona
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '63dec6c1-0ccd-4c6b-b952-516a1c1338e4',
    'Lat Machine Prona',
    ARRAY['fermo 1" in basso', 'fermo 2" in basso', 'risalita 3"', 'discesa 3"', 'focus dorso', 'focus scapola']::text[],
    'https://www.youtube.com/watch?v=dQYWf_16Yuk&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=4',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3d0138d5-3283-4ec2-a3d1-63b917507acf',
    '63dec6c1-0ccd-4c6b-b952-516a1c1338e4',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '00613e56-d301-4db0-9a08-942c585fcc30',
    '63dec6c1-0ccd-4c6b-b952-516a1c1338e4',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '273c1ce0-6732-4e9e-ab97-f3e08ff3a5ec',
    '63dec6c1-0ccd-4c6b-b952-516a1c1338e4',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [109] Lat Machine triangolo stretto
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '0d9943fe-70ad-4a02-805b-5a232ade9f1f',
    'Lat Machine triangolo stretto',
    ARRAY['fermo 1" in basso', 'fermo 2" in basso', 'risalita 3"', 'discesa 3"', 'focus dorso', 'focus scapola']::text[],
    'https://www.youtube.com/watch?v=55sIABvQuy8&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=3',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '26498504-85dc-46f7-b796-a6d11392420b',
    '0d9943fe-70ad-4a02-805b-5a232ade9f1f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd8b4075a-bf56-4c6d-85dc-0422eb2c4c95',
    '0d9943fe-70ad-4a02-805b-5a232ade9f1f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [110] Lat Machine Triangolo largo
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '425fa4bf-3f7f-4ab1-b1c1-791711867cc7',
    'Lat Machine Triangolo largo',
    ARRAY['fermo 1" in basso', 'fermo 2" in basso', 'risalita 3"', 'discesa 3"', 'focus dorso', 'focus scapola']::text[],
    'https://www.youtube.com/watch?v=dQYWf_16Yuk&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=4',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '93114b33-9341-4698-8878-4c17895f1409',
    '425fa4bf-3f7f-4ab1-b1c1-791711867cc7',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '82069799-f175-4749-a215-c308eb31b541',
    '425fa4bf-3f7f-4ab1-b1c1-791711867cc7',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1273afc2-6a43-4c87-8cfe-e2fe5d4dbdef',
    '425fa4bf-3f7f-4ab1-b1c1-791711867cc7',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [111] Lat Machine monolaterale in ginocchio
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '3ea27960-5b48-4584-89c1-d4d4ab1a1530',
    'Lat Machine monolaterale in ginocchio',
    ARRAY['fermo 1" in basso', 'fermo 2" in basso', 'risalita 3"', 'discesa 3"', 'focus dorso', 'focus scapola']::text[],
    'https://www.youtube.com/watch?v=uIHw2OGVN5w&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=12',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '0ae4e56e-0bad-4589-ab22-6f9e01b077c9',
    '3ea27960-5b48-4584-89c1-d4d4ab1a1530',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b80c488b-f9d3-47a8-b48d-725fbd4aec20',
    '3ea27960-5b48-4584-89c1-d4d4ab1a1530',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [112] Pulldown corda
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '676af762-db3a-4929-898d-7f70bfc25b9d',
    'Pulldown corda',
    ARRAY['eccentrica 3"', '2" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3fc2b88d-2956-42a9-a9cc-f1f26d5b1fad',
    '676af762-db3a-4929-898d-7f70bfc25b9d',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [113] Pulldown barra
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '766d1998-2df3-478c-8584-81b808a7303a',
    'Pulldown barra',
    ARRAY['eccentrica 3"', '2" in max stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata verticale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'dfb8fda1-ae01-4ab1-897e-badb1213865a',
    '766d1998-2df3-478c-8584-81b808a7303a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [114] Pulley Triangolo
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '33e13c7d-8555-4696-987d-32ae6e798744',
    'Pulley Triangolo',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'focus dorso']::text[],
    'https://www.youtube.com/watch?v=DFZ5iuxFBsU&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=26',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6010c9b5-3fdc-4131-bd0b-d15609d3f282',
    '33e13c7d-8555-4696-987d-32ae6e798744',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3052cbad-72a9-488a-8186-016b3839486f',
    '33e13c7d-8555-4696-987d-32ae6e798744',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '5d234144-ae2b-46b8-8ba6-b1e3503cc98e',
    '33e13c7d-8555-4696-987d-32ae6e798744',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [115] Pulley Presa larga e neutra
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '3c873950-bbb1-45ec-b529-3b02f31118a5',
    'Pulley Presa larga e neutra',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'prono su panca 30°']::text[],
    'https://www.youtube.com/watch?v=YQB1KxnbR-E&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=27',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1089e587-e188-43d4-87a4-98aa42679cef',
    '3c873950-bbb1-45ec-b529-3b02f31118a5',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9ecf0261-157e-4ea3-baab-df0482dee6eb',
    '3c873950-bbb1-45ec-b529-3b02f31118a5',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '72c7a03f-8b76-486d-afc4-8adede12c0b3',
    '3c873950-bbb1-45ec-b529-3b02f31118a5',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [116] Pulley presa supina larga
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '7929c942-ba70-4269-a67e-b0663e706e5f',
    'Pulley presa supina larga',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'prono su panca 30°']::text[],
    'https://www.youtube.com/watch?v=YQB1KxnbR-E&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=27',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a11671fb-759e-4f88-a8ec-719e49edf81d',
    '7929c942-ba70-4269-a67e-b0663e706e5f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bb548d41-5915-4b8d-8e63-68648c246f38',
    '7929c942-ba70-4269-a67e-b0663e706e5f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '50c48634-1e89-4a2f-b6fb-7f8a0863c66e',
    '7929c942-ba70-4269-a67e-b0663e706e5f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [117] Pulley presa prona larga
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'be82376a-6825-44d9-a913-47b38515998e',
    'Pulley presa prona larga',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'prono su panca 30°']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3bcd2fcb-f106-455e-9b86-74e53a63af56',
    'be82376a-6825-44d9-a913-47b38515998e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bd62ee88-4a8b-4618-b3df-437cec69e1b7',
    'be82376a-6825-44d9-a913-47b38515998e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7e8d72f6-94c6-42f4-89ff-3a3852f5172d',
    'be82376a-6825-44d9-a913-47b38515998e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [118] Pulley monolaterale al cavo scapola
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'cb40c127-1daf-4d91-8a23-44659ae026bc',
    'Pulley monolaterale al cavo scapola',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'prono su panca 30°', 'focus scapola', 'focus dorsale']::text[],
    'https://www.youtube.com/watch?v=FQXewTToH7w&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=34',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '99ab8b79-9d86-4eca-b7b2-53f38c5b0dd8',
    'cb40c127-1daf-4d91-8a23-44659ae026bc',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '304f9be3-5ca7-41e7-aa88-c5532ee98376',
    'cb40c127-1daf-4d91-8a23-44659ae026bc',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1f142968-84ff-4a28-b029-74d1d5c595cd',
    'cb40c127-1daf-4d91-8a23-44659ae026bc',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [119] Pulley monolaterale al cavo dorso
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '6159a78c-4b24-4ab1-aced-838a5390f190',
    'Pulley monolaterale al cavo dorso',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'prono su panca 30°', 'focus scapola', 'focus dorsale']::text[],
    'https://www.youtube.com/watch?v=na1XC1Pebdk&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=35',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e69cdcdd-0473-44c0-95b3-1827955c809e',
    '6159a78c-4b24-4ab1-aced-838a5390f190',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e5dfea8f-3955-48ae-9f9e-2851aac86d79',
    '6159a78c-4b24-4ab1-aced-838a5390f190',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f4750504-fdf6-49d2-acfb-c58c5ba7e1f1',
    '6159a78c-4b24-4ab1-aced-838a5390f190',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [120] Pulley monolaterale seduto su panca
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '27c336ee-3491-4a4b-96fe-267b2a9b54a8',
    'Pulley monolaterale seduto su panca',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'prono su panca 30°', 'focus scapola', 'focus dorsale']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1f559be7-822e-4846-9866-04ce7f32992c',
    '27c336ee-3491-4a4b-96fe-267b2a9b54a8',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '37884345-e56c-4b51-9374-ea3c40a46ff7',
    '27c336ee-3491-4a4b-96fe-267b2a9b54a8',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'dcc562b8-f384-4da5-a5e4-f58e744d08d3',
    '27c336ee-3491-4a4b-96fe-267b2a9b54a8',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [121] Row machine presa neutra
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '1dd1f4c6-d161-4a29-b804-37b0ccdfeed1',
    'Row machine presa neutra',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'focus dorso']::text[],
    'https://www.youtube.com/watch?v=Jp7DGx6WMyg&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=3',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a417ff4e-ef32-4bcc-afa5-9e1a2a2b8f18',
    '1dd1f4c6-d161-4a29-b804-37b0ccdfeed1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6c73c2de-d253-4526-bb5a-f3511633acf7',
    '1dd1f4c6-d161-4a29-b804-37b0ccdfeed1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '19763d64-0e1e-487a-a994-936a02fff934',
    '1dd1f4c6-d161-4a29-b804-37b0ccdfeed1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [122] Row machine presa prona
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '2ef5764d-4227-4f9f-aed5-6768c10c1111',
    'Row machine presa prona',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'focus dorso']::text[],
    'https://www.youtube.com/watch?v=3LKBxrFUhnk&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=4',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ceaae6e3-434a-4e90-a691-2784a40adbe1',
    '2ef5764d-4227-4f9f-aed5-6768c10c1111',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3cb1699d-9e79-4300-a103-4657c36ade29',
    '2ef5764d-4227-4f9f-aed5-6768c10c1111',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '48152e5c-a751-4a7f-95f5-2edd3fac3a05',
    '2ef5764d-4227-4f9f-aed5-6768c10c1111',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [123] Row machine monolaterale
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '77c26a83-d03f-42a9-ad7a-0989f01863e6',
    'Row machine monolaterale',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'prono su panca 30°', 'focus scapola', 'focus dorsale']::text[],
    'https://www.youtube.com/watch?v=HftOl1lnUmI&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=5',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '52346818-5ea8-4552-a1ec-d77e2c9f48c5',
    '77c26a83-d03f-42a9-ad7a-0989f01863e6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '44322cf8-c6a6-4afe-879a-90bc27934893',
    '77c26a83-d03f-42a9-ad7a-0989f01863e6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6f1a31d3-6400-4b59-bf22-c45287e4a44f',
    '77c26a83-d03f-42a9-ad7a-0989f01863e6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [124] Rematore Manubrio
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'b6a98c7b-b3d5-4bf2-a379-38c59e426908',
    'Rematore Manubrio',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'prono su panca 30°', 'focus scapola', 'focus dorsale']::text[],
    'https://www.youtube.com/watch?v=xQ4YV7rh7tY&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=57',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '28e23a10-968c-4516-8a17-8d86116e07ee',
    'b6a98c7b-b3d5-4bf2-a379-38c59e426908',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b7290eb6-55b6-4f58-9fa0-90afaa69e8de',
    'b6a98c7b-b3d5-4bf2-a379-38c59e426908',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '491debf5-1916-489f-8fad-a7bca799491f',
    'b6a98c7b-b3d5-4bf2-a379-38c59e426908',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [125] Rematore Bilanciere
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '19acfe93-c798-4167-9e41-99297221fff6',
    'Rematore Bilanciere',
    ARRAY['fermo 1" in alto', 'dai pin', 'deadstop a terra', 'salita esplosiva', 'cheating']::text[],
    'https://www.youtube.com/watch?v=tqyDadNQ9Mw&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=35',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '779cad46-76a5-47b4-a0a5-ef4307e68d87',
    '19acfe93-c798-4167-9e41-99297221fff6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2842d029-fb9a-47a2-8c21-a164dce549bd',
    '19acfe93-c798-4167-9e41-99297221fff6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '22ba10f7-e207-4f7a-9262-0365369f89c9',
    '19acfe93-c798-4167-9e41-99297221fff6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [126] Rematore Multipower
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '28117fb1-65e1-4539-9f35-d851390b30b0',
    'Rematore Multipower',
    ARRAY['fermo 1" in alto', 'dai pin', 'deadstop a terra', 'salita esplosiva', 'cheating']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7f7a315e-c9a0-4fb5-b321-5a9ffbecf2e8',
    '28117fb1-65e1-4539-9f35-d851390b30b0',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'dbe8e778-4a75-467a-bbea-9a4dc91c00bc',
    '28117fb1-65e1-4539-9f35-d851390b30b0',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '672e84bb-42bd-4ae0-9c67-1b6f4211d153',
    '28117fb1-65e1-4539-9f35-d851390b30b0',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [127] Rematore Belt Squat
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'bae6310d-e91e-44d6-bc32-713b1466f452',
    'Rematore Belt Squat',
    ARRAY['fermo 1" in alto', 'dai pin', 'deadstop a terra', 'salita esplosiva', 'cheating']::text[],
    'https://www.youtube.com/watch?v=0a5ZLtkfHI4&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=7',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '5409bb0f-60f0-430a-86ce-1d70bbb7353b',
    'bae6310d-e91e-44d6-bc32-713b1466f452',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6cdb5886-70f4-4125-be3e-c91f5155e59d',
    'bae6310d-e91e-44d6-bc32-713b1466f452',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '822ec1ec-f71d-407f-8c8f-174d65cf0f3d',
    'bae6310d-e91e-44d6-bc32-713b1466f452',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [128] T-Bar row
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '3d7368f6-2595-4fe2-9680-42def0ae7b28',
    'T-Bar row',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'focus dorso']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4c819b6a-21ea-4e0a-9ee1-2d61e9123a98',
    '3d7368f6-2595-4fe2-9680-42def0ae7b28',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2f9793f4-6298-4dae-b314-9072dcacf5a2',
    '3d7368f6-2595-4fe2-9680-42def0ae7b28',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd150a8ff-f5f4-4fd0-8ffa-300720f17a52',
    '3d7368f6-2595-4fe2-9680-42def0ae7b28',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [129] Seal Row Manubri panca 30°
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '26c913ef-678b-4920-949d-3d6a3e4eeddb',
    'Seal Row Manubri panca 30°',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'focus dorso']::text[],
    'https://www.youtube.com/watch?v=ePUvdmQSHPY&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=25',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f31a9ecb-2310-4043-af57-9808c9d808d2',
    '26c913ef-678b-4920-949d-3d6a3e4eeddb',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9349b8b2-bfd8-49d8-b7d3-77c530994042',
    '26c913ef-678b-4920-949d-3d6a3e4eeddb',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2059b127-f76d-4e0e-a974-8bcd5fd466e2',
    '26c913ef-678b-4920-949d-3d6a3e4eeddb',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [130] Seal Row Bilanciere
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '18b4e5d2-f21e-4878-84cf-fa1154da247b',
    'Seal Row Bilanciere',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'focus dorso']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '21805eae-89ed-4b8f-8e77-9fdec757ed81',
    '18b4e5d2-f21e-4878-84cf-fa1154da247b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e3e524d0-0394-493f-8c37-6c414599a04b',
    '18b4e5d2-f21e-4878-84cf-fa1154da247b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '61ab905f-cc2a-4cf4-af99-a9ac69a41d76',
    '18b4e5d2-f21e-4878-84cf-fa1154da247b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [131] Australian Pulp Up
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '93024d2c-840c-417c-9c7c-97eb50ac8843',
    'Australian Pulp Up',
    ARRAY['fermo 1" dietro', 'fermo 3" dietro', 'eccentrica 3"', 'focus dorso']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '192c56e6-d3f9-48ad-90f1-a19efeb191ed',
    '93024d2c-840c-417c-9c7c-97eb50ac8843',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4fdb8d62-cddc-4df6-b507-9cd806a30b35',
    '93024d2c-840c-417c-9c7c-97eb50ac8843',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    0.3
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1d48987f-96bf-4f68-83de-d94f246a6ced',
    '93024d2c-840c-417c-9c7c-97eb50ac8843',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Trapezi') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [132] Illiac Pulldown
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '8cb58ba2-a502-458f-8236-f26be5f073e8',
    'Illiac Pulldown',
    ARRAY['2" in contrazione di picco', 'eccentrica 3"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e24b9997-3890-4a7e-ba48-72d5b797bc0e',
    '8cb58ba2-a502-458f-8236-f26be5f073e8',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    0.5
  )
  ON CONFLICT DO NOTHING;

  -- [133] Alzate posteriori panca 30°
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '1fc5e000-45e8-42bc-b710-4eb435177025',
    'Alzate posteriori panca 30°',
    ARRAY['1" in contrazione di picco', 'eccentrica controllata']::text[],
    'https://www.youtube.com/watch?v=v9klvEx_Cb8&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=15',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bb9b9123-92ee-4175-b38f-085f7dba7763',
    '1fc5e000-45e8-42bc-b710-4eb435177025',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [134] Alzate posteriori cavo alto
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '2cb9d25c-5bbe-4bb7-af84-35c50723fa42',
    'Alzate posteriori cavo alto',
    ARRAY['1" in contrazione di picco', 'eccentrica controllata']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f78513a9-2dc4-4c65-a819-6a6451082c53',
    '2cb9d25c-5bbe-4bb7-af84-35c50723fa42',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [135] Azlate posteriori cavo alto mono
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '37d1b743-9cbc-4732-9dc7-c230095cc765',
    'Azlate posteriori cavo alto mono',
    ARRAY['1" in contrazione di picco', 'eccentrica controllata']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'cb8556c1-a2ac-4ccf-a2f3-1a2539cca386',
    '37d1b743-9cbc-4732-9dc7-c230095cc765',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [136] Face Pull Centro Schiena
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'f388f386-d88b-41ff-af3f-9eef9aa6d87c',
    'Face Pull Centro Schiena',
    ARRAY['1" in contrazione di picco', 'eccentrica controllata']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '8e32ddab-aa63-48e0-92c6-f3a71ac0a17a',
    'f388f386-d88b-41ff-af3f-9eef9aa6d87c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [137] Face pull Extrarotatori
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '2137c6fc-e9f4-4d19-91da-051cef7f45c7',
    'Face pull Extrarotatori',
    ARRAY['1" in contrazione di picco', 'eccentrica controllata']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'eb20be55-690f-41ca-93e5-190fbe87c252',
    '2137c6fc-e9f4-4d19-91da-051cef7f45c7',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [138] Pullower Manubrio
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'e5f17ed6-6fcb-471f-ab55-246c3cfcdb9a',
    'Pullower Manubrio',
    ARRAY['1" in contrazione di picco', 'eccentrica controllata']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tirata orizzontale') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '19da159a-a5e6-4dfb-939e-2dafc8b8f910',
    'e5f17ed6-6fcb-471f-ab55-246c3cfcdb9a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Deltoidi Posteriori') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [139] Curl manubri
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'ca32f7bb-332c-4884-a079-6c0aae728792',
    'Curl manubri',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    'https://www.youtube.com/watch?v=c1QD7XhA0yw&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=62',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '8cc96860-cca4-4c72-b427-d2123a08f75c',
    'ca32f7bb-332c-4884-a079-6c0aae728792',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [140] Hammer Curl
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'c119614d-d606-45b7-9eac-579745bee088',
    'Hammer Curl',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    'https://www.youtube.com/watch?v=9jjcPYyjAz0&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=10',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c7636bca-b1e5-4bac-99e1-f011201c429e',
    'c119614d-d606-45b7-9eac-579745bee088',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [141] Preacher Curl
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '5b2f36ed-8ff8-4ca9-b753-c6745b7f895e',
    'Preacher Curl',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3de0b647-bff0-452b-b137-94879dc2a012',
    '5b2f36ed-8ff8-4ca9-b753-c6745b7f895e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [142] Curl Bilanciere ez
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '3237d3e7-56d5-45ca-acf7-0ca5871feea6',
    'Curl Bilanciere ez',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    'https://www.youtube.com/watch?v=c1QD7XhA0yw&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=62',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd7d6e81c-5403-4d1d-88f6-4e604f3eadc8',
    '3237d3e7-56d5-45ca-acf7-0ca5871feea6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [143] Curl cavo basso barra
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '09280bb2-ce6a-44d9-9ba7-2b3f7e92f2d8',
    'Curl cavo basso barra',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    'https://www.youtube.com/watch?v=TaN5jwwjtdY&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=13',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9084d961-bb47-430d-8c7e-cbbf6696d9cd',
    '09280bb2-ce6a-44d9-9ba7-2b3f7e92f2d8',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [144] Curl cavo basso corda
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '6f49d512-dc50-4e0b-8775-560923ea2951',
    'Curl cavo basso corda',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    'https://www.youtube.com/watch?v=GKCjC859GEo&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f7151e7a-02eb-40d2-9452-c49196b6267e',
    '6f49d512-dc50-4e0b-8775-560923ea2951',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [145] Curl cavo basso maniglia
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'dc0c6ae3-5a61-4747-a388-1f1b162780cc',
    'Curl cavo basso maniglia',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'dc34d427-76ef-4542-ade6-edf381a05384',
    'dc0c6ae3-5a61-4747-a388-1f1b162780cc',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [146] Curl manubri su panca inclinata 45°
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '34833535-ea35-4415-89b5-2f8faaa2b6d1',
    'Curl manubri su panca inclinata 45°',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    'https://www.youtube.com/watch?v=UYgpKw4K8QU&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=12',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ccbbe020-7ec7-4ccd-88e1-fa8f997dd7b6',
    '34833535-ea35-4415-89b5-2f8faaa2b6d1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [147] Scott Curl monolaterale su panca
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '376a908e-084c-44dd-b828-460858e7f855',
    'Scott Curl monolaterale su panca',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    'https://www.youtube.com/watch?v=tNC0SM6yZzg&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=11',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c2ed89f5-bfa6-4362-afe0-5e2952cd97e8',
    '376a908e-084c-44dd-b828-460858e7f855',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [148] Curl concentrato gomito su coscia
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'ebca2f4a-90de-4015-8a30-041f4b2a9ea6',
    'Curl concentrato gomito su coscia',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a3df5b70-b538-415e-bea4-b7cc18b5ebf0',
    'ebca2f4a-90de-4015-8a30-041f4b2a9ea6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [149] Bayesian Curl
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '2eba8c2c-0e9a-4685-b768-6584ef1ca5bb',
    'Bayesian Curl',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    'https://www.youtube.com/watch?v=A5ZRxFuZw_E&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=16',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c1b7c29b-a8d6-418a-8022-aa742c4ca9e0',
    '2eba8c2c-0e9a-4685-b768-6584ef1ca5bb',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [150] Curl al cavo disteso su panca
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '092fd85f-7e9a-487e-8c4b-71f95c1874fc',
    'Curl al cavo disteso su panca',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bc377d97-be58-452e-9dda-afbc5b837f1b',
    '092fd85f-7e9a-487e-8c4b-71f95c1874fc',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [151] Curl gomito al ghd focus allungamento
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'bd25a198-c574-4bcf-89a9-112ff4480d6f',
    'Curl gomito al ghd focus allungamento',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1a6b271f-2278-4b43-8d6e-19a587fc8751',
    'bd25a198-c574-4bcf-89a9-112ff4480d6f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [152] Curl gomito vincolato
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '6a164e3d-ed4f-4f21-888a-a3389c72894c',
    'Curl gomito vincolato',
    ARRAY['1" in contraizione di picco', 'discesa 3"', 'salita 3"', '3"/3"', 'cheating']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '563a641f-bed3-4795-bb54-136258aa7cd0',
    '6a164e3d-ed4f-4f21-888a-a3389c72894c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Bicipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [153] Push Down Barra
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '6cab3978-ae3d-4c51-b77e-25350ba204fd',
    'Push Down Barra',
    ARRAY['1" in contrazione di picco', 'risalita 3"', 'cheating']::text[],
    'https://www.youtube.com/watch?v=WZVDehaYgHs&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=9',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9526f310-82ad-4c39-a9dd-94f9d54bb7fe',
    '6cab3978-ae3d-4c51-b77e-25350ba204fd',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [154] Push Down Corda
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '60a06efd-c16e-4cfa-a52e-eb0d5060621b',
    'Push Down Corda',
    ARRAY['1" in contrazione di picco', 'risalita 3"', 'cheating']::text[],
    'https://www.youtube.com/watch?v=Jl5VyIBIXYE&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=8',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'ec377f27-207e-4d37-9bbb-27308f3e57f1',
    '60a06efd-c16e-4cfa-a52e-eb0d5060621b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [155] French Press Manubri
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'abbc9b1b-7541-498a-ae62-86d17c9296ff',
    'French Press Manubri',
    ARRAY['1" in max stretch', 'discesa 3"']::text[],
    'https://www.youtube.com/watch?v=zrLNRGAHAso&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=61',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3894f510-fec6-4bd6-b623-714376a0159d',
    'abbc9b1b-7541-498a-ae62-86d17c9296ff',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [156] French Press Bilanciere Ez
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '7a05e1bc-953e-4467-98f2-77dd780ee647',
    'French Press Bilanciere Ez',
    ARRAY['1" in max stretch', 'discesa 3"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2e6cd992-15e8-4f4d-8d2e-95cc161207bf',
    '7a05e1bc-953e-4467-98f2-77dd780ee647',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [157] Push Down Reverse
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '82260969-4786-4332-b5f8-07ca0dbeaa5b',
    'Push Down Reverse',
    ARRAY['1" in contrazione di picco', 'risalita 3"', 'cheating']::text[],
    'https://www.youtube.com/watch?v=fiDnDRCzHCg&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=6',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '7d8bbd6a-7367-48f6-9d0b-492ccf1cedc5',
    '82260969-4786-4332-b5f8-07ca0dbeaa5b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [158] Push Down monolaterale
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'a247e33d-3aa2-4f0d-be74-1d095388da85',
    'Push Down monolaterale',
    ARRAY['1" in contrazione di picco', 'risalita 3"', 'cheating']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'cfd54932-ab0e-435d-b586-85fbc893e4c1',
    'a247e33d-3aa2-4f0d-be74-1d095388da85',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [159] French Press monolaterale
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '07798ab4-e06b-49b0-b23c-3eee72138eb6',
    'French Press monolaterale',
    ARRAY['1" in max stretch', 'discesa 3"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'da79e515-c7cf-490b-a5fd-cef272b8eb8e',
    '07798ab4-e06b-49b0-b23c-3eee72138eb6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [160] Katana Press
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '1a19b925-f451-4abf-af85-ea03bdc0a047',
    'Katana Press',
    ARRAY['1" in max stretch', 'discesa 3"']::text[],
    'https://www.youtube.com/watch?v=ARKc4PPXr8A&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=47',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '0ad6e382-d5eb-43f6-8a2c-74eaa3ea05e7',
    '1a19b925-f451-4abf-af85-ea03bdc0a047',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [161] French Press cavo altezza spalle
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '62885a0b-75a0-4616-8f75-d265bd8e9239',
    'French Press cavo altezza spalle',
    ARRAY['1" in max stretch', 'discesa 3"']::text[],
    'https://www.youtube.com/watch?v=hlooPVEJHw4&list=PL2OC9xrmbse-LqDvZBuPkZhWDqN4y8I-w&index=46',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '661282fd-de78-4bfd-8b19-c05dd4ddbd47',
    '62885a0b-75a0-4616-8f75-d265bd8e9239',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [162] French Press Gomito vincolato
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'c45005de-c34a-4344-b6af-be779108ba35',
    'French Press Gomito vincolato',
    ARRAY['1" in max stretch', 'discesa 3"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'f40d0422-869a-4199-b420-3f3905d8950d',
    'c45005de-c34a-4344-b6af-be779108ba35',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [163] Jm Press
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '2317d098-6ae7-4b22-94c5-997bcfd31c14',
    'Jm Press',
    ARRAY['1" in max stretch', 'discesa 3"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9d93e815-a5ae-4fd7-bbbf-1d83f3ffb104',
    '2317d098-6ae7-4b22-94c5-997bcfd31c14',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [164] Tate Press
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '120b71ef-97f8-400e-9fe2-2e3a0f1dbd26',
    'Tate Press',
    ARRAY['1" in max stretch', 'discesa 3"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b26f6f78-d027-4763-87d2-76b1ded33692',
    '120b71ef-97f8-400e-9fe2-2e3a0f1dbd26',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [165] JM press multipower
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'fb119695-7f29-4fa1-b240-0e9a82703070',
    'JM press multipower',
    ARRAY['1" in max stretch', 'discesa 3"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '42e75228-f28b-4175-8112-b246cbc7d01b',
    'fb119695-7f29-4fa1-b240-0e9a82703070',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [166] Panca Board alta e presa stretta
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'e07dba50-d1dd-4a92-82c5-4fe50d227a4f',
    'Panca Board alta e presa stretta',
    ARRAY['fermo 1" petto', 'laoding']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '17b56d61-eee1-47ec-b8f3-4edcad156029',
    'e07dba50-d1dd-4a92-82c5-4fe50d227a4f',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Tricipiti') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [167] Plank in quadreupedia
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '42fe82de-9a11-4e96-9a0a-696e7bb5e6a6',
    'Plank in quadreupedia',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'd7be0107-ce46-4302-9a37-73f548bdc013',
    '42fe82de-9a11-4e96-9a0a-696e7bb5e6a6',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [168] Plank sui gomiti
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '69fec255-12a3-4df1-a1d6-c8db368b6a71',
    'Plank sui gomiti',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4e96962d-54ad-4c85-aefc-63a7f3a3d4c1',
    '69fec255-12a3-4df1-a1d6-c8db368b6a71',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [169] Plank Laterale
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '87ba41bd-b96a-4323-b161-9b1b92a34cb9',
    'Plank Laterale',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b09f40ef-b143-42b6-9484-e920e92e2b9a',
    '87ba41bd-b96a-4323-b161-9b1b92a34cb9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [170] Plank laterale piedi al trx
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '43e2e2fd-0e2a-413b-93fa-6e5be52b367d',
    'Plank laterale piedi al trx',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4f3812d3-af12-4a8b-8dac-d9855d040737',
    '43e2e2fd-0e2a-413b-93fa-6e5be52b367d',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [171] Barchetta raccolta
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '47323c01-d16b-49c9-8ab2-2d7c860b5210',
    'Barchetta raccolta',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '1c117849-e3c0-4357-acc7-cd28f5a4d760',
    '47323c01-d16b-49c9-8ab2-2d7c860b5210',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [172] Barchetta full
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'fad58e2d-3b25-480a-9430-6fb8abc51056',
    'Barchetta full',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '76168e6f-06fe-476f-bc4c-c53e756dbf89',
    'fad58e2d-3b25-480a-9430-6fb8abc51056',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [173] Bird Dog plank iso
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'c3a9901b-6b88-4e77-872c-bd89a53b32e4',
    'Bird Dog plank iso',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4aeef00b-56a6-4078-9d2b-c5d90e5062ff',
    'c3a9901b-6b88-4e77-872c-bd89a53b32e4',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [174] Dead Bug libero
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'b7b8689f-be70-431e-be4c-b15fb331b5bf',
    'Dead Bug libero',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '9ac8ac87-a788-47ce-8df3-b4428740faee',
    'b7b8689f-be70-431e-be4c-b15fb331b5bf',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [175] Dead Bug palla
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '381633ef-5f76-4e45-a772-99c06687d680',
    'Dead Bug palla',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'aa9c557e-138d-46ba-b310-51c92cc48e61',
    '381633ef-5f76-4e45-a772-99c06687d680',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [176] Suitcase Carry ktb
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'f93fff87-4a8a-40cc-a74a-0f7d44c7ca09',
    'Suitcase Carry ktb',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '708c7c04-6800-458b-b881-f9b5ac4ccde3',
    'f93fff87-4a8a-40cc-a74a-0f7d44c7ca09',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [177] Chop
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '26896989-4cbb-4967-afd8-a2aa9e166821',
    'Chop',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'aa667bf4-5fe8-490f-8dd9-6c6be7f4ff0b',
    '26896989-4cbb-4967-afd8-a2aa9e166821',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [178] Wood Chop
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '42f57f8c-871c-4eb1-83ed-b2f283ec43f2',
    'Wood Chop',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'c499241e-28bf-4eda-ac7d-d5cf8ae1e073',
    '42f57f8c-871c-4eb1-83ed-b2f283ec43f2',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [179] Plank zavorrato
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '53cd5611-8db1-4bb1-b06d-f2253bbb7c03',
    'Plank zavorrato',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '0b4f655c-f0bc-40a9-ad6f-0a3b00776e5e',
    '53cd5611-8db1-4bb1-b06d-f2253bbb7c03',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [180] Crunch al cavo
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'd6894055-fe53-4499-94d5-2c3d2e272fe8',
    'Crunch al cavo',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    'https://www.youtube.com/watch?v=3hCzEVCNl00&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=14',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '287e9b72-73eb-4441-b0b6-85a5516f07a3',
    'd6894055-fe53-4499-94d5-2c3d2e272fe8',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [181] Crunch a terra
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '7add60b2-94fb-4702-9624-38ab370e2433',
    'Crunch a terra',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '60387782-bfe2-4a6c-a0b3-724d91df6b5b',
    '7add60b2-94fb-4702-9624-38ab370e2433',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [182] Crunch ghd
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'f49db594-93f6-4a90-847d-24da84017698',
    'Crunch ghd',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'cd2ba895-bf09-4cd1-b42f-628eee76a10d',
    'f49db594-93f6-4a90-847d-24da84017698',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [183] Side Bending
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '440d9905-0a00-4eaf-9f83-3aa5a749ffd1',
    'Side Bending',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'bcd8a4e0-c782-4c80-97f0-195c4180e044',
    '440d9905-0a00-4eaf-9f83-3aa5a749ffd1',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [184] Plank dinamico
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'ca0a1750-adc7-4958-87b4-37b2db9a88be',
    'Plank dinamico',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '828da9a7-dfac-4459-a0bc-26f40eb2f375',
    'ca0a1750-adc7-4958-87b4-37b2db9a88be',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [185] Bear walk
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '5309a0fa-5e90-4994-8aa8-23399eda765a',
    'Bear walk',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '97595a0c-af4a-4552-9555-58347ac77c66',
    '5309a0fa-5e90-4994-8aa8-23399eda765a',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [186] Leg raise
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '28871488-cf17-46d3-86cc-a6ddf974f60c',
    'Leg raise',
    ARRAY['eccentrica lenta', '1" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '00c80f59-357b-40f2-8637-8113ddb65339',
    '28871488-cf17-46d3-86cc-a6ddf974f60c',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Core') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [187] Abductor machine seduto
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'e38d0727-f2d9-4ec7-a2b9-b71ab09af402',
    'Abductor machine seduto',
    ARRAY['1" in contrazione di picco', '3" in contrazione di picco']::text[],
    'https://www.youtube.com/watch?v=xZLXdGMMT9c&list=PL2OC9xrmbse-YqQ6nxQ1meEaE7YIk6uZD&index=43',
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '29802f18-dfff-4137-baf6-8ecd3b046a91',
    'e38d0727-f2d9-4ec7-a2b9-b71ab09af402',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [188] Abductor machine sedere alzato
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '93d09a9b-0136-4fa6-96a5-d2b81fce0ba7',
    'Abductor machine sedere alzato',
    ARRAY['1" in contrazione di picco', '3" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'e9231ae8-ce3a-46d4-90e9-635503adfc79',
    '93d09a9b-0136-4fa6-96a5-d2b81fce0ba7',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [189] Abduzione classica al cavo basso
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '0d85a7b2-ad55-4f87-b2bd-0a9d848c0c41',
    'Abduzione classica al cavo basso',
    ARRAY['1" in contrazione di picco', '3" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'aead7b4f-2c2e-4b95-9411-c1b9b2d2e47b',
    '0d85a7b2-ad55-4f87-b2bd-0a9d848c0c41',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [190] Abdzuione ibrida al cavo basso
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '62a8ba21-530b-4b08-96a3-993a1092c460',
    'Abdzuione ibrida al cavo basso',
    ARRAY['1" in contrazione di picco', '3" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '550f165c-6c32-4098-980b-b31ed1b820a4',
    '62a8ba21-530b-4b08-96a3-993a1092c460',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [191] Slancio gamba semitesa cavo
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'cead5fff-dbe3-4a27-8131-6fa6dd46c6b9',
    'Slancio gamba semitesa cavo',
    ARRAY['1" in contrazione di picco', '3" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '94b935b7-d461-4bcd-8a0b-9b670421fab4',
    'cead5fff-dbe3-4a27-8131-6fa6dd46c6b9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [192] Slancio gamba piegata
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '8df27d84-ceca-4a46-a4c7-1e01c5812455',
    'Slancio gamba piegata',
    ARRAY['1" in contrazione di picco', '3" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'b4503b6e-62e2-4e05-ad47-e95574b07b31',
    '8df27d84-ceca-4a46-a4c7-1e01c5812455',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [193] Hip Airplane zavorrato
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'b76cf4b5-cb9c-4599-bccd-572feb6fda8e',
    'Hip Airplane zavorrato',
    ARRAY['2" in stretch']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a6dff24e-6024-492c-8770-ca57dd5600f4',
    'b76cf4b5-cb9c-4599-bccd-572feb6fda8e',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [194] Estensione Anca in quadrupedia su panca
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '9bd55c54-2fba-4154-bc2b-74ebe2ee1954',
    'Estensione Anca in quadrupedia su panca',
    ARRAY['1" in contrazione di picco', '3" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    'a0094891-623e-4364-9908-8187bf028375',
    '9bd55c54-2fba-4154-bc2b-74ebe2ee1954',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [195] Estensione anca sdraiata a terra
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '8c2befa1-2c97-4449-9a5f-fc5fe8c471fc',
    'Estensione anca sdraiata a terra',
    ARRAY['1" in contrazione di picco', '3" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '6ea8a0f0-92db-4fe4-bfa6-4b26c5312362',
    '8c2befa1-2c97-4449-9a5f-fc5fe8c471fc',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [196] Rotazione anca cavo
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'e809ea64-2cc1-4741-b595-be2872ea9ae8',
    'Rotazione anca cavo',
    ARRAY['1" in contrazione di picco', '3" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '0ebc621a-e106-449b-a1e4-611ce87e203e',
    'e809ea64-2cc1-4741-b595-be2872ea9ae8',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [197] Kick Back multipower
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'bf7007e5-2368-4a0b-bac6-4448c8672f08',
    'Kick Back multipower',
    ARRAY['1" in contrazione di picco', '3" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '2d712315-6648-412d-8e50-c62b1d06f8a0',
    'bf7007e5-2368-4a0b-bac6-4448c8672f08',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [198] Frog pump
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '4d30b65b-8a30-44ce-bd5d-552c9a241414',
    'Frog pump',
    ARRAY['1" in contrazione di picco', '3" in contrazione di picco']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4dc9b34d-bfd6-4ee6-9bc4-39c813344f8d',
    '4d30b65b-8a30-44ce-bd5d-552c9a241414',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [199] Step up
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    'ed299d97-b90f-47a9-9f2a-0b5ca1265d3b',
    'Step up',
    ARRAY['1" in contrazione di picco', '3" in contrazione di picco', 'eccentrica 3"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '3436b8db-e589-475e-bcc9-4cbd21c9bca2',
    'ed299d97-b90f-47a9-9f2a-0b5ca1265d3b',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

  -- [200] Sumo deadlift full rom ktb
  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")
  VALUES (
    '556eb74d-28b3-408e-852d-16387914b4c9',
    'Sumo deadlift full rom ktb',
    ARRAY['eccentrica 5"', 'eccentrica 3"']::text[],
    NULL,
    'accessory'::"ExerciseType",
    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('Hip Hinge') LIMIT 1),
    v_creator_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")
  VALUES (
    '4640440c-2cea-48f2-b594-6f5507328f5a',
    '556eb74d-28b3-408e-852d-16387914b4c9',
    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('Glutei') LIMIT 1),
    1
  )
  ON CONFLICT DO NOTHING;

END $$;

-- Total exercises: 200