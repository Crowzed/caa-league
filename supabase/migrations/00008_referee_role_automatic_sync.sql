-- Migration: 00008_referee_role_automatic_sync.sql
-- Automatically synchronize user_roles and profiles to the referees directory
-- Safely handle primary role mapping for multi-role accounts

-- 1. Ensure user_id in referees has a unique index for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_referees_user_id_unique ON referees (user_id) WHERE user_id IS NOT NULL;

-- 2. Safely synchronize user primary role in profiles without enum errors
CREATE OR REPLACE FUNCTION sync_user_primary_role()
RETURNS TRIGGER AS $$
DECLARE
    target_uid UUID;
    top_role_slug TEXT;
    mapped_role profile_role;
BEGIN
    target_uid := COALESCE(NEW.user_id, OLD.user_id);
    IF target_uid IS NOT NULL THEN
        SELECT r.slug INTO top_role_slug
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = target_uid
          AND ur.status = 'active'
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        ORDER BY r.priority DESC, r.created_at ASC
        LIMIT 1;

        IF top_role_slug IS NOT NULL THEN
            IF top_role_slug IN ('head_referee', 'senior_referee', 'junior_referee', 'trial_referee', 'referee') THEN
                mapped_role := 'referee'::profile_role;
            ELSIF top_role_slug IN ('super_admin') THEN
                mapped_role := 'super_admin'::profile_role;
            ELSIF top_role_slug IN ('admin') THEN
                mapped_role := 'admin'::profile_role;
            ELSIF top_role_slug IN ('moderator') THEN
                mapped_role := 'moderator'::profile_role;
            ELSIF top_role_slug IN ('guild_captain') THEN
                mapped_role := 'guild_captain'::profile_role;
            ELSIF top_role_slug IN ('guild_member') THEN
                mapped_role := 'guild_member'::profile_role;
            ELSE
                mapped_role := 'player'::profile_role;
            END IF;

            UPDATE public.profiles
            SET role = mapped_role, updated_at = NOW()
            WHERE id = target_uid;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_primary_role ON user_roles;
CREATE TRIGGER trg_sync_user_primary_role
AFTER INSERT OR UPDATE OR DELETE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION sync_user_primary_role();

-- 3. Trigger function to sync user_roles to referees
CREATE OR REPLACE FUNCTION sync_user_roles_to_referees()
RETURNS TRIGGER AS $$
DECLARE
  v_role RECORD;
  v_profile RECORD;
  v_has_other_ref_role BOOLEAN;
  v_target_user_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_target_user_id := OLD.user_id;
  ELSE
    v_target_user_id := NEW.user_id;
  END IF;

  -- When inserting or updating a role to active
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'active' THEN
    SELECT * INTO v_role FROM roles WHERE id = NEW.role_id;
    
    IF v_role.category = 'referee' OR v_role.slug IN ('head_referee', 'senior_referee', 'referee', 'junior_referee', 'trial_referee') THEN
      SELECT * INTO v_profile FROM profiles WHERE id = NEW.user_id;
      
      INSERT INTO referees (
        id,
        user_id,
        display_name,
        website_username,
        roblox_username,
        discord_username,
        region,
        timezone,
        rank,
        status,
        matches_officiated,
        current_season_matches,
        completed_matches,
        cancelled_matches,
        warnings_issued,
        reports_submitted,
        seasons_active,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        NEW.user_id,
        COALESCE(v_profile.display_name, v_profile.username, 'League Official'),
        COALESCE(v_profile.username, 'official'),
        v_profile.roblox_username,
        v_profile.discord_username,
        COALESCE(v_profile.region, 'Asia/Pacific'),
        COALESCE(v_profile.timezone, 'WIB (UTC+7)'),
        v_role.name,
        'active',
        0, 0, 0, 0, 0, 0,
        ARRAY['Season 1'],
        now(),
        now()
      )
      ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO UPDATE SET
        rank = EXCLUDED.rank,
        status = 'active',
        display_name = COALESCE(v_profile.display_name, v_profile.username, referees.display_name),
        website_username = COALESCE(v_profile.username, referees.website_username),
        roblox_username = COALESCE(v_profile.roblox_username, referees.roblox_username),
        discord_username = COALESCE(v_profile.discord_username, referees.discord_username),
        updated_at = now();
    END IF;
  END IF;

  -- When role is set to inactive or deleted, verify if any active referee role remains
  IF (TG_OP = 'UPDATE' AND NEW.status != 'active') OR (TG_OP = 'DELETE') THEN
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = v_target_user_id
        AND ur.status = 'active'
        AND (r.category = 'referee' OR r.slug IN ('head_referee', 'senior_referee', 'referee', 'junior_referee', 'trial_referee'))
    ) INTO v_has_other_ref_role;

    IF NOT v_has_other_ref_role THEN
      DELETE FROM referees WHERE user_id = v_target_user_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_roles_to_referees ON user_roles;
CREATE TRIGGER trg_sync_user_roles_to_referees
AFTER INSERT OR UPDATE OR DELETE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION sync_user_roles_to_referees();

-- 4. Trigger function to sync profile changes to referees
CREATE OR REPLACE FUNCTION sync_profile_to_referees()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'referee' THEN
    INSERT INTO referees (
      id,
      user_id,
      display_name,
      website_username,
      roblox_username,
      discord_username,
      region,
      timezone,
      rank,
      status,
      matches_officiated,
      current_season_matches,
      completed_matches,
      cancelled_matches,
      warnings_issued,
      reports_submitted,
      seasons_active,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      NEW.id,
      COALESCE(NEW.display_name, NEW.username, 'Referee Official'),
      COALESCE(NEW.username, 'referee'),
      NEW.roblox_username,
      NEW.discord_username,
      COALESCE(NEW.region, 'Asia/Pacific'),
      COALESCE(NEW.timezone, 'WIB (UTC+7)'),
      'Referee',
      'active',
      0, 0, 0, 0, 0, 0,
      ARRAY['Season 1'],
      now(),
      now()
    )
    ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO UPDATE SET
      status = 'active',
      display_name = COALESCE(NEW.display_name, NEW.username, referees.display_name),
      website_username = COALESCE(NEW.username, referees.website_username),
      roblox_username = COALESCE(NEW.roblox_username, referees.roblox_username),
      discord_username = COALESCE(NEW.discord_username, referees.discord_username),
      region = COALESCE(NEW.region, referees.region),
      timezone = COALESCE(NEW.timezone, referees.timezone),
      updated_at = now();
  ELSE
    UPDATE referees
    SET 
      display_name = COALESCE(NEW.display_name, NEW.username, display_name),
      website_username = COALESCE(NEW.username, website_username),
      roblox_username = COALESCE(NEW.roblox_username, roblox_username),
      discord_username = COALESCE(NEW.discord_username, discord_username),
      region = COALESCE(NEW.region, region),
      timezone = COALESCE(NEW.timezone, timezone),
      updated_at = now()
    WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_profile_to_referees ON profiles;
CREATE TRIGGER trg_sync_profile_to_referees
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_profile_to_referees();
