-- Migration: 00007_official_maps_system.sql
-- Enforce the CAA League 4 official maps: Plains, Thermopylae, Castle, Fortress
-- Add competition_map_pools and enhanced match_maps columns

-- 1. Ensure maps table has official columns
ALTER TABLE maps ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE maps ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT true;
ALTER TABLE maps ADD COLUMN IF NOT EXISTS is_competitive BOOLEAN DEFAULT true;
ALTER TABLE maps ADD COLUMN IF NOT EXISTS layout_info TEXT;
ALTER TABLE maps ADD COLUMN IF NOT EXISTS objectives TEXT;

-- 2. Clean out non-official maps
DELETE FROM maps WHERE name NOT IN ('Plains', 'Thermopylae', 'Castle', 'Fortress');

-- 3. Upsert the 4 official maps with persistent UUIDs
INSERT INTO maps (id, name, description, image_url, map_type, type, status, is_official, is_competitive, is_active, objectives, layout_info)
VALUES
  (
    'aaaaaaaa-0001-4000-8000-000000000001',
    'Plains',
    'Expansive open battlefield favoring cavalry sweeps, wide flanking maneuvers, and disciplined battle lines.',
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
    'competitive',
    'Official',
    'active',
    true,
    true,
    true,
    'Control the central crossroads and flank checkpoints.',
    'Open field with rolling hills and perimeter forest borders.'
  ),
  (
    'aaaaaaaa-0002-4000-8000-000000000002',
    'Thermopylae',
    'A historic coastal pass between cliff face and sea, offering decisive tactical advantage to steadfast defensive formations.',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    'competitive',
    'Official',
    'active',
    true,
    true,
    true,
    'Hold or break the primary choke point pass.',
    'Narrow linear corridor bounded by vertical rock cliffs and water.'
  ),
  (
    'aaaaaaaa-0003-4000-8000-000000000003',
    'Castle',
    'A fortified medieval citadel featuring multi-tier stone ramparts, outer courtyards, and contested gatehouses.',
    'https://images.unsplash.com/photo-1585543805890-6051f7829f98?auto=format&fit=crop&w=1200&q=80',
    'competitive',
    'Official',
    'active',
    true,
    true,
    true,
    'Breach the outer courtyard and capture the inner throne keep.',
    'Multi-level stone architecture with gates, stairs, and archer parapets.'
  ),
  (
    'aaaaaaaa-0004-4000-8000-000000000004',
    'Fortress',
    'A sprawling military stronghold featuring reinforced battlements, interior corridors, and fortified artillery towers.',
    'https://images.unsplash.com/photo-1533158307587-828f0a76ef46?auto=format&fit=crop&w=1200&q=80',
    'competitive',
    'Official',
    'active',
    true,
    true,
    true,
    'Secure perimeter bastions and eliminate core command centers.',
    'High defense perimeter with layered trenches and fortified stone redoubts.'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  map_type = EXCLUDED.map_type,
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  is_official = EXCLUDED.is_official,
  is_competitive = EXCLUDED.is_competitive,
  is_active = EXCLUDED.is_active,
  objectives = EXCLUDED.objectives,
  layout_info = EXCLUDED.layout_info;

-- 4. Create competition_map_pools table
CREATE TABLE IF NOT EXISTS competition_map_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_type TEXT NOT NULL DEFAULT 'season',
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  division_id UUID REFERENCES divisions(id) ON DELETE CASCADE,
  tournament_name TEXT,
  match_format TEXT,
  map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_competition_map_pools_season ON competition_map_pools(season_id);
CREATE INDEX IF NOT EXISTS idx_competition_map_pools_division ON competition_map_pools(division_id);
CREATE INDEX IF NOT EXISTS idx_competition_map_pools_map ON competition_map_pools(map_id);

-- Enable RLS on competition_map_pools
ALTER TABLE competition_map_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to competition_map_pools"
  ON competition_map_pools FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated staff to manage competition_map_pools"
  ON competition_map_pools FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Enhance match_maps for official historical tracking
ALTER TABLE match_maps ADD COLUMN IF NOT EXISTS losing_guild_id UUID REFERENCES guilds(id) ON DELETE SET NULL;
ALTER TABLE match_maps ADD COLUMN IF NOT EXISTS referee_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE match_maps ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE match_maps ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE match_maps ADD COLUMN IF NOT EXISTS map_score TEXT;
ALTER TABLE match_maps ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'completed';

