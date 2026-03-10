-- CreateTable
CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "avatar_url" TEXT,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "date_of_birth" DATE,
    "gender" VARCHAR(20),
    "level" VARCHAR(50),
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,2),
    "bio" TEXT,
    "onboarding_completed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "sport" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "distance_meters" INTEGER NOT NULL,
    "visibility" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "route_polyline" TEXT,
    "map_image_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "activity_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "storage_bucket" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "public_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "follower_id" UUID NOT NULL,
    "following_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","following_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE INDEX "activities_user_id_idx" ON "activities"("user_id");

-- CreateIndex
CREATE INDEX "activities_started_at_idx" ON "activities"("started_at");

-- CreateIndex
CREATE INDEX "activities_visibility_idx" ON "activities"("visibility");

-- CreateIndex
CREATE INDEX "activity_media_activity_id_idx" ON "activity_media"("activity_id");

-- CreateIndex
CREATE INDEX "activity_media_user_id_idx" ON "activity_media"("user_id");

-- AddForeignKey
ALTER TABLE "activity_media" ADD CONSTRAINT "activity_media_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
