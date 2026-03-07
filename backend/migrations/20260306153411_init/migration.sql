-- CreateTable
CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "avatar_url" TEXT,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "date_of_birth" DATE,
    "gender" VARCHAR(20),
    "level" VARCHAR(50),
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,2),
    "onboarding_completed_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);
