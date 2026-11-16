-- Keep users.email in the same form Supabase Auth uses. The Zod schemas already
-- normalize it; this guards writes that bypass them (scripts, Prisma Studio).
-- Ships with the code that normalizes emails: the previous release would fail
-- on a mixed-case email after sending the Supabase invite.
ALTER TABLE "users"
ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower(trim("email")));
