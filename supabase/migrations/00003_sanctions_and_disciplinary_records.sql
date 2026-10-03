-- Migration 00003: Sanctions & Disciplinary Records System
-- Comprehensive disciplinary system for Command An Army League

-- 1. Create sanctions table
CREATE TABLE IF NOT EXISTS public.sanctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sanction_code TEXT UNIQUE NOT NULL, -- e.g. SAN-2026-0001
    case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    case_code TEXT, -- e.g. CASE-2026-014
    target_type TEXT NOT NULL CHECK (target_type IN ('player', 'guild')),
    player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    guild_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
    match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
    season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL,
    division_id UUID REFERENCES public.divisions(id) ON DELETE SET NULL,
    rule_id UUID REFERENCES public.rules(id) ON DELETE SET NULL,
    rule_number TEXT,
    rule_title TEXT,
    rule_version_id UUID REFERENCES public.rule_versions(id) ON DELETE SET NULL,
    rule_version_name TEXT,
    violation TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'minor',
    sanction_type TEXT NOT NULL,
    description TEXT,
    decision_summary TEXT NOT NULL,
    additional_notes TEXT,
    evidence JSONB DEFAULT '[]'::jsonb,
    issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    issued_by_name TEXT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by_name TEXT,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    effective_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    duration_days INT,
    is_permanent BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'expired', 'completed', 'suspended', 'overturned', 'cancelled', 'appealed', 'upheld', 'reduced')),
    appeal_status TEXT DEFAULT 'none' CHECK (appeal_status IN ('none', 'pending', 'under_review', 'accepted', 'rejected', 'partially_upheld', 'withdrawn')),
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sanctions_all_policy" ON public.sanctions FOR ALL USING (true) WITH CHECK (true);

-- 2. Create sanction_events table
CREATE TABLE IF NOT EXISTS public.sanction_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sanction_id UUID REFERENCES public.sanctions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sanction_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sanction_events_all_policy" ON public.sanction_events FOR ALL USING (true) WITH CHECK (true);

-- 3. Extend cases table
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS case_code TEXT,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS guild_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES public.rules(id) ON DELETE SET NULL;

-- 4. Extend appeals table
ALTER TABLE public.appeals
ADD COLUMN IF NOT EXISTS sanction_id UUID REFERENCES public.sanctions(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS appeal_code TEXT,
ADD COLUMN IF NOT EXISTS statement TEXT,
ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '[]'::jsonb;

-- 5. Create appeal_events table
CREATE TABLE IF NOT EXISTS public.appeal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appeal_id UUID REFERENCES public.appeals(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.appeal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appeal_events_all_policy" ON public.appeal_events FOR ALL USING (true) WITH CHECK (true);

