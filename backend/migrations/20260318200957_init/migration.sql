-- CreateTable
CREATE TABLE "activity_kudos" (
    "activity_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_kudos_pkey" PRIMARY KEY ("activity_id","user_id")
);

-- CreateTable
CREATE TABLE "activity_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "activity_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "location" VARCHAR(160) NOT NULL,
    "sport" VARCHAR(20) NOT NULL,
    "description" VARCHAR(800) NOT NULL,
    "avatar_url" TEXT,
    "banner_url" TEXT,
    "is_invite_only" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_members" (
    "club_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_members_pkey" PRIMARY KEY ("club_id","user_id")
);

-- CreateTable
CREATE TABLE "club_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "invited_by_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(6),

    CONSTRAINT "club_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT,
    "activity_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_post_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "public_url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_post_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_kudos_user_id_idx" ON "activity_kudos"("user_id");

-- CreateIndex
CREATE INDEX "activity_kudos_activity_id_idx" ON "activity_kudos"("activity_id");

-- CreateIndex
CREATE INDEX "activity_comments_activity_id_created_at_idx" ON "activity_comments"("activity_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_comments_user_id_idx" ON "activity_comments"("user_id");

-- CreateIndex
CREATE INDEX "clubs_owner_id_idx" ON "clubs"("owner_id");

-- CreateIndex
CREATE INDEX "clubs_sport_idx" ON "clubs"("sport");

-- CreateIndex
CREATE INDEX "club_members_user_id_idx" ON "club_members"("user_id");

-- CreateIndex
CREATE INDEX "club_invites_user_id_status_created_at_idx" ON "club_invites"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "club_invites_club_id_status_created_at_idx" ON "club_invites"("club_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "club_invites_club_id_user_id_idx" ON "club_invites"("club_id", "user_id");

-- CreateIndex
CREATE INDEX "club_posts_club_id_created_at_idx" ON "club_posts"("club_id", "created_at");

-- CreateIndex
CREATE INDEX "club_posts_user_id_idx" ON "club_posts"("user_id");

-- CreateIndex
CREATE INDEX "club_post_media_post_id_created_at_idx" ON "club_post_media"("post_id", "created_at");

-- AddForeignKey
ALTER TABLE "activity_kudos" ADD CONSTRAINT "activity_kudos_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_comments" ADD CONSTRAINT "activity_comments_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_invites" ADD CONSTRAINT "club_invites_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_posts" ADD CONSTRAINT "club_posts_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_posts" ADD CONSTRAINT "club_posts_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_post_media" ADD CONSTRAINT "club_post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "club_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
