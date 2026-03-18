-- Add last_synced_at column to ad_accounts table
-- This column tracks when the account was last synced with Meta API
ALTER TABLE ad_accounts ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN ad_accounts.last_synced_at IS 'Timestamp of the last successful sync with Meta API';
