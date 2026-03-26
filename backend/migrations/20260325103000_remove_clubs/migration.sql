-- Remove clubs feature tables
-- NOTE: This is destructive if applied to an existing DB.

DROP TABLE IF EXISTS "club_post_media" CASCADE;
DROP TABLE IF EXISTS "club_posts" CASCADE;
DROP TABLE IF EXISTS "club_invites" CASCADE;
DROP TABLE IF EXISTS "club_members" CASCADE;
DROP TABLE IF EXISTS "clubs" CASCADE;
