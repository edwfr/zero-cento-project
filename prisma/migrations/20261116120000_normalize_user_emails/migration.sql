-- Supabase Auth stores emails lowercased; Prisma held them as typed, so the
-- onboarding lookup by email missed mixed-case users (Sentry JAVASCRIPT-NEXTJS-14).
-- Idempotent: rows already normalized are left untouched.
-- Checked before running: no two rows collide once lowercased.
UPDATE "users"
SET "email" = lower(trim("email"))
WHERE "email" <> lower(trim("email"));
