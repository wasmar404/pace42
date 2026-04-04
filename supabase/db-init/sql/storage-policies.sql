-- Storage RLS policies for Supabase buckets

-- Enable RLS on storage.objects (should already be enabled, but enforce it)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public avatars are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload activity media" ON storage.objects;
DROP POLICY IF EXISTS "Public activity media viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own activity media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own activity media" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload GPX files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own GPX files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own GPX files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own GPX files" ON storage.objects;

DROP POLICY IF EXISTS "Service role has full access to all storage" ON storage.objects;
DROP POLICY IF EXISTS "Service role can view all buckets" ON storage.buckets;
DROP POLICY IF EXISTS "Anyone can view public buckets" ON storage.buckets;

-- ==========================
-- BUCKET POLICIES
-- ==========================

-- Service role can view all buckets (for Studio)
CREATE POLICY "Service role can view all buckets"
  ON storage.buckets
  FOR SELECT
  TO service_role
  USING (true);

-- Anyone can view public buckets (for Studio and public access)
CREATE POLICY "Anyone can view public buckets"
  ON storage.buckets
  FOR SELECT
  TO authenticated, anon
  USING (public = true);

-- ==========================
-- AVATARS BUCKET (test)
-- ==========================

-- Service role has full access (bypass RLS)
CREATE POLICY "Service role has full access to all storage"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Upload: authenticated users can upload to their own folder
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'test'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: public bucket, anyone can view
CREATE POLICY "Public avatars are viewable by everyone"
  ON storage.objects
  FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'test');

-- Update: users can update their own avatars
CREATE POLICY "Users can update their own avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'test'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'test'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: users can delete their own avatars
CREATE POLICY "Users can delete their own avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'test'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==========================
-- ACTIVITY MEDIA BUCKET
-- ==========================

-- Upload: authenticated users can upload
CREATE POLICY "Authenticated users can upload activity media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'activity-media');

-- Read: public bucket, anyone can view
CREATE POLICY "Public activity media viewable by everyone"
  ON storage.objects
  FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'activity-media');

-- Update: users can update their own media
CREATE POLICY "Users can update their own activity media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'activity-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'activity-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: users can delete their own media
CREATE POLICY "Users can delete their own activity media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'activity-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==========================
-- GPX BUCKET (private)
-- ==========================

-- Upload: authenticated users can upload their own GPX
CREATE POLICY "Authenticated users can upload GPX files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'gpx'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: users can only view their own GPX files
CREATE POLICY "Users can view their own GPX files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'gpx'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: users can update their own GPX files
CREATE POLICY "Users can update their own GPX files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'gpx'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'gpx'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: users can delete their own GPX files
CREATE POLICY "Users can delete their own GPX files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'gpx'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
