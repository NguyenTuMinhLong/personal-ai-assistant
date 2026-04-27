-- Enable soft delete: documents are marked as deleted, not removed.
-- The listUserDocuments query will filter by deleted_at IS NULL by default.
-- User can restore within the undo window.

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- RLS policy: hide deleted documents from normal reads
DROP POLICY IF EXISTS "Users can view their documents" ON documents;
CREATE POLICY "Users can view their documents"
  ON documents
  FOR SELECT
  USING (user_id = auth.uid AND deleted_at IS NULL);

-- Insert policy for creating documents
DROP POLICY IF EXISTS "Users can insert their documents" ON documents;
CREATE POLICY "Users can insert their documents"
  ON documents
  FOR INSERT
  WITH CHECK (user_id = auth.uid);
