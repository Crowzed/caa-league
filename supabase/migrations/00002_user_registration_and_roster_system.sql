-- ============================================================================
-- Migration 00002: User Registration & Enhanced Roster System
-- ============================================================================

-- 1. Profiles additions: Account Status & Guild Status, Region/Country, Timezone, Email
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'registered';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guild_status TEXT DEFAULT 'unaffiliated';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Guild invitations: Add cancelled status and expiration date
DO $$
BEGIN
    ALTER TYPE invitation_status ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE guild_invitations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- 3. Guild members: Membership history & audit metadata
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS joined_season TEXT;
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS left_season TEXT;
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS removal_reason TEXT;
