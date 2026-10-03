-- 00005_reset_league_database_for_production.sql
-- Reset and clean the database for live league operations while preserving demo/admin accounts and core reference encyclopedias.

-- 1. Clean match officiating and correction tables
TRUNCATE TABLE public.result_corrections CASCADE;
TRUNCATE TABLE public.decision_reviews CASCADE;
TRUNCATE TABLE public.match_decisions CASCADE;
TRUNCATE TABLE public.match_disconnects CASCADE;
TRUNCATE TABLE public.match_pauses CASCADE;
TRUNCATE TABLE public.match_warnings CASCADE;
TRUNCATE TABLE public.match_incidents CASCADE;
TRUNCATE TABLE public.referee_reports CASCADE;
TRUNCATE TABLE public.referee_assignments CASCADE;
TRUNCATE TABLE public.referee_applications CASCADE;
TRUNCATE TABLE public.referee_conflicts CASCADE;

-- 2. Clean match records and map pools
TRUNCATE TABLE public.match_screenshots CASCADE;
TRUNCATE TABLE public.match_maps CASCADE;
TRUNCATE TABLE public.match_players CASCADE;
TRUNCATE TABLE public.match_check_ins CASCADE;
TRUNCATE TABLE public.matches CASCADE;
TRUNCATE TABLE public.season_map_pool CASCADE;

-- 3. Clean sanctions, penalties, protests, cases
TRUNCATE TABLE public.appeal_events CASCADE;
TRUNCATE TABLE public.appeals CASCADE;
TRUNCATE TABLE public.sanction_events CASCADE;
TRUNCATE TABLE public.sanctions CASCADE;
TRUNCATE TABLE public.penalties CASCADE;
TRUNCATE TABLE public.case_evidence CASCADE;
TRUNCATE TABLE public.cases CASCADE;
TRUNCATE TABLE public.protests CASCADE;

-- 4. Clean guilds, invitations, rosters, standings, and statistics
TRUNCATE TABLE public.guild_invitations CASCADE;
TRUNCATE TABLE public.guild_members CASCADE;
TRUNCATE TABLE public.player_achievements CASCADE;
TRUNCATE TABLE public.guild_achievements CASCADE;
TRUNCATE TABLE public.standings CASCADE;
TRUNCATE TABLE public.player_statistics CASCADE;
TRUNCATE TABLE public.guild_statistics CASCADE;
TRUNCATE TABLE public.army_compositions CASCADE;
TRUNCATE TABLE public.unit_statistics CASCADE;
TRUNCATE TABLE public.guilds CASCADE;

-- 5. Clean divisions and seasons (ready for administrators to configure Season 1)
TRUNCATE TABLE public.divisions CASCADE;
TRUNCATE TABLE public.seasons CASCADE;

-- 6. Clean operational activity records, notifications, and news
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.audit_logs CASCADE;
TRUNCATE TABLE public.news CASCADE;

-- 7. Reset Referees: keep only official demo referee RefKnight with zeroed stats
DELETE FROM public.referee_availability WHERE referee_id != '11111111-1111-1111-1111-111111111111';
DELETE FROM public.referees WHERE id != '11111111-1111-1111-1111-111111111111';

UPDATE public.referees SET
  matches_officiated = 0,
  current_season_matches = 0,
  completed_matches = 0,
  cancelled_matches = 0,
  warnings_issued = 0,
  reports_submitted = 0,
  seasons_active = ARRAY[]::text[],
  rank = 'Head Referee',
  status = 'active',
  internal_notes = 'Official demo head referee account for officiating operations.'
WHERE id = '11111111-1111-1111-1111-111111111111';

-- 8. Reset Staff Members: keep demo accounts and owner/admin emails
DELETE FROM public.staff_members 
WHERE email NOT IN (
  'admin@caaleague.com', 
  'referee@caaleague.com', 
  'netcoregaming91@gmail.com', 
  'crowzed9900@gmail.com'
);

-- 9. Clean duplicate achievement records
DELETE FROM public.achievements WHERE id::text LIKE '88888888-%';

-- 10. Clean profiles and ensure Demo Accounts exist cleanly
DELETE FROM public.profiles 
WHERE id NOT IN (
  '99999999-9999-9999-9999-999999999999',
  '88888888-8888-8888-8888-888888888888',
  '77777777-7777-7777-7777-777777777777'
);

-- Ensure Admin demo profile
INSERT INTO public.profiles (
  id, username, display_name, role, is_verified, account_status, guild_status, email, bio
) VALUES (
  '99999999-9999-9999-9999-999999999999',
  'AdminCore',
  'Admin Core',
  'admin',
  true,
  'registered',
  'unaffiliated',
  'admin@caaleague.com',
  'Official league administrator account for testing admin controls.'
)
ON CONFLICT (id) DO UPDATE SET
  username = 'AdminCore',
  display_name = 'Admin Core',
  role = 'admin',
  is_verified = true,
  account_status = 'registered',
  guild_status = 'unaffiliated',
  email = 'admin@caaleague.com',
  bio = 'Official league administrator account for testing admin controls.',
  roblox_id = NULL,
  roblox_username = NULL,
  discord_id = NULL,
  discord_username = NULL,
  avatar_url = NULL;

-- Ensure Referee demo profile
INSERT INTO public.profiles (
  id, username, display_name, role, is_verified, account_status, guild_status, email, bio
) VALUES (
  '88888888-8888-8888-8888-888888888888',
  'RefKnight',
  'Head Referee Knight',
  'referee',
  true,
  'registered',
  'unaffiliated',
  'referee@caaleague.com',
  'Official demo referee account for officiating operations.'
)
ON CONFLICT (id) DO UPDATE SET
  username = 'RefKnight',
  display_name = 'Head Referee Knight',
  role = 'referee',
  is_verified = true,
  account_status = 'registered',
  guild_status = 'unaffiliated',
  email = 'referee@caaleague.com',
  bio = 'Official demo referee account for officiating operations.',
  roblox_id = NULL,
  roblox_username = 'KnightOfficial',
  discord_id = NULL,
  discord_username = 'KnightRef#0001',
  avatar_url = NULL;

-- Ensure Captain demo profile
INSERT INTO public.profiles (
  id, username, display_name, role, is_verified, account_status, guild_status, email, bio
) VALUES (
  '77777777-7777-7777-7777-777777777777',
  'ShadowCommander',
  'Captain Shadow',
  'guild_captain',
  true,
  'registered',
  'unaffiliated',
  'captain@caaleague.com',
  'Official demo guild captain account for testing team management and registration.'
)
ON CONFLICT (id) DO UPDATE SET
  username = 'ShadowCommander',
  display_name = 'Captain Shadow',
  role = 'guild_captain',
  is_verified = true,
  account_status = 'registered',
  guild_status = 'unaffiliated',
  email = 'captain@caaleague.com',
  bio = 'Official demo guild captain account for testing team management and registration.',
  roblox_id = NULL,
  roblox_username = NULL,
  discord_id = NULL,
  discord_username = NULL,
  avatar_url = NULL;
