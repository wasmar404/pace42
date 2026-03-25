-- Drop unused profile fields (level/weight/height)
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "level";
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "weight_kg";
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "height_cm";
