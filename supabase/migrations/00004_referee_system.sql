-- Migration 00004: Comprehensive Referee and Match Officiating System
-- Integrates with matches, guilds, players, seasons, divisions, rules, sanctions, protests, notifications, and audit_logs.

-- 1. Referee Ranks (Configurable by Admins)
CREATE TABLE IF NOT EXISTS public.referee_ranks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    level INT NOT NULL,
    can_officiate BOOLEAN DEFAULT true,
    can_review BOOLEAN DEFAULT false,
    can_head_ref BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial ranks if not present
INSERT INTO public.referee_ranks (name, level, can_officiate, can_review, can_head_ref)
VALUES 
    ('Trial Referee', 1, true, false, false),
    ('Junior Referee', 2, true, false, false),
    ('Referee', 3, true, false, false),
    ('Senior Referee', 4, true, true, false),
    ('Head Referee', 5, true, true, true)
ON CONFLICT (name) DO NOTHING;

-- 2. Referees Table
CREATE TABLE IF NOT EXISTS public.referees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    website_username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    discord_username TEXT,
    roblox_username TEXT,
    roblox_id TEXT,
    region TEXT DEFAULT 'Global',
    timezone TEXT DEFAULT 'UTC',
    rank TEXT NOT NULL DEFAULT 'Referee',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'suspended', 'retired')),
    matches_officiated INT DEFAULT 0,
    current_season_matches INT DEFAULT 0,
    completed_matches INT DEFAULT 0,
    cancelled_matches INT DEFAULT 0,
    warnings_issued INT DEFAULT 0,
    reports_submitted INT DEFAULT 0,
    seasons_active TEXT[] DEFAULT ARRAY['Season 1']::text[],
    internal_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Referee Applications
CREATE TABLE IF NOT EXISTS public.referee_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    website_username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    roblox_username TEXT NOT NULL,
    discord_username TEXT,
    region TEXT NOT NULL,
    timezone TEXT NOT NULL,
    experience TEXT NOT NULL,
    availability TEXT NOT NULL,
    preferred_match_times TEXT NOT NULL,
    motivation TEXT NOT NULL,
    relevant_experience TEXT,
    rules_agreed BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'interview_trial', 'approved', 'rejected', 'withdrawn')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Referee Assignments (Multiple refs per match: Primary, Assistant, Head)
CREATE TABLE IF NOT EXISTS public.referee_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    referee_id UUID REFERENCES public.referees(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'assistant', 'head')),
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'declined', 'cancelled', 'completed', 'reassigned')),
    decline_reason TEXT,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

-- 5. Referee Availability
CREATE TABLE IF NOT EXISTS public.referee_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referee_id UUID REFERENCES public.referees(id) ON DELETE CASCADE UNIQUE,
    available_days TEXT[] DEFAULT ARRAY['Friday', 'Saturday', 'Sunday']::text[],
    available_hours TEXT DEFAULT '18:00 - 23:00',
    timezone TEXT DEFAULT 'WIB (UTC+7)',
    unavailable_dates TEXT[] DEFAULT ARRAY[]::text[],
    preferred_match_times TEXT DEFAULT 'Evening prime time',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Conflicts of Interest
CREATE TABLE IF NOT EXISTS public.referee_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referee_id UUID REFERENCES public.referees(id) ON DELETE CASCADE,
    guild_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
    player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
    conflict_type TEXT NOT NULL CHECK (conflict_type IN ('guild_membership', 'prior_management', 'personal_relationship', 'other')),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Match Incidents
CREATE TABLE IF NOT EXISTS public.match_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    game_number INT,
    incident_time TIMESTAMPTZ DEFAULT NOW(),
    reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    guild_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('rule_violation', 'exploit', 'unauthorized_player', 'disconnect', 'technical_issue', 'unsportsmanlike_conduct', 'server_issue', 'game_error', 'late_player', 'match_delay', 'map_issue', 'other')),
    description TEXT NOT NULL,
    evidence_url TEXT,
    severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'major', 'critical')),
    status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'submitted_for_review', 'resolved', 'escalated_to_sanction')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. In-Match Warnings
CREATE TABLE IF NOT EXISTS public.match_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    guild_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
    warning_type TEXT NOT NULL DEFAULT 'official' CHECK (warning_type IN ('verbal', 'official', 'gameplay', 'conduct')),
    rule_id UUID REFERENCES public.rules(id) ON DELETE SET NULL,
    rule_name TEXT,
    reason TEXT NOT NULL,
    issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Match Pauses & Delays
CREATE TABLE IF NOT EXISTS public.match_pauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    pause_start TIMESTAMPTZ DEFAULT NOW(),
    pause_end TIMESTAMPTZ,
    duration_seconds INT,
    reason TEXT NOT NULL CHECK (reason IN ('technical_issue', 'disconnect', 'server_issue', 'player_emergency', 'administrative_issue', 'other')),
    requested_by TEXT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Player Disconnects
CREATE TABLE IF NOT EXISTS public.match_disconnects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    guild_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
    map_name TEXT,
    disconnected_at TIMESTAMPTZ DEFAULT NOW(),
    reconnected_at TIMESTAMPTZ,
    reason TEXT NOT NULL,
    impact TEXT,
    referee_decision TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Match Decisions
CREATE TABLE IF NOT EXISTS public.match_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    game_number INT,
    referee_id UUID REFERENCES public.referees(id) ON DELETE SET NULL,
    decision_type TEXT NOT NULL,
    rule_id UUID REFERENCES public.rules(id) ON DELETE SET NULL,
    rule_name TEXT,
    decision TEXT NOT NULL,
    reason TEXT NOT NULL,
    affected_guild_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
    affected_player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    evidence_url TEXT,
    status TEXT NOT NULL DEFAULT 'final' CHECK (status IN ('final', 'under_review', 'overturned', 'upheld')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Decision Reviews
CREATE TABLE IF NOT EXISTS public.decision_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID REFERENCES public.match_decisions(id) ON DELETE CASCADE,
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    requested_by_guild_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
    requested_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'upheld', 'overturned', 'modified')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    final_decision TEXT,
    decision_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Result Correction Requests
CREATE TABLE IF NOT EXISTS public.result_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    original_home_score INT NOT NULL,
    original_away_score INT NOT NULL,
    original_winner_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
    requested_home_score INT NOT NULL,
    requested_away_score INT NOT NULL,
    requested_winner_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    evidence_url TEXT,
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Referee Reports
CREATE TABLE IF NOT EXISTS public.referee_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE UNIQUE,
    referee_id UUID REFERENCES public.referees(id) ON DELETE SET NULL,
    summary TEXT NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    technical_issues TEXT,
    sportsmanship_rating TEXT,
    referee_notes TEXT,
    internal_staff_notes TEXT,
    evidence_urls JSONB DEFAULT '[]'::jsonb,
    deadline TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'overdue')),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Match Table Enhancements
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS pre_match_checks JSONB DEFAULT '{"guild_a_checkin": false, "guild_b_checkin": false, "rosters_verified": false, "eligibility_verified": false, "map_verified": false, "server_ready": false, "rules_acknowledged": false}'::jsonb,
ADD COLUMN IF NOT EXISTS is_result_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS primary_referee_id UUID REFERENCES public.referees(id) ON DELETE SET NULL;

-- Enable RLS and permissive policies for all new tables
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'referee_ranks', 'referees', 'referee_applications', 'referee_assignments', 
        'referee_availability', 'referee_conflicts', 'match_incidents', 'match_warnings', 
        'match_pauses', 'match_disconnects', 'match_decisions', 'decision_reviews', 
        'result_corrections', 'referee_reports'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl || '_all_policy', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl || '_all_policy', tbl);
    END LOOP;
END $$;
