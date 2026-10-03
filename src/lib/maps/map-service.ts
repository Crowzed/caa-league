import { SupabaseClient } from '@supabase/supabase-js';
import type { GameMap, CompetitionMapPool, MatchMap } from '@/types/database';

/**
 * The CAA League strictly supports exactly four official maps.
 * Unofficial or custom maps are strictly prohibited in official league competition.
 */
export const OFFICIAL_MAP_NAMES = ['Plains', 'Thermopylae', 'Castle', 'Fortress'] as const;
export type OfficialMapName = typeof OFFICIAL_MAP_NAMES[number];

export const OFFICIAL_MAP_DEFAULTS: Record<
  OfficialMapName,
  {
    description: string;
    image_url: string;
    objectives: string;
    layout_info: string;
  }
> = {
  Plains: {
    description: 'Expansive open battlefield favoring cavalry sweeps, wide flanking maneuvers, and disciplined battle lines.',
    image_url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
    objectives: 'Control the central crossroads and flank checkpoints.',
    layout_info: 'Open field with rolling hills and perimeter forest borders.',
  },
  Thermopylae: {
    description: 'A historic coastal pass between cliff face and sea, offering decisive tactical advantage to steadfast defensive formations.',
    image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    objectives: 'Hold or break the primary choke point pass.',
    layout_info: 'Narrow linear corridor bounded by vertical rock cliffs and water.',
  },
  Castle: {
    description: 'A fortified medieval citadel featuring multi-tier stone ramparts, outer courtyards, and contested gatehouses.',
    image_url: 'https://images.unsplash.com/photo-1585543805890-6051f7829f98?auto=format&fit=crop&w=1200&q=80',
    objectives: 'Breach the outer courtyard and capture the inner throne keep.',
    layout_info: 'Multi-level stone architecture with gates, stairs, and archer parapets.',
  },
  Fortress: {
    description: 'A sprawling military stronghold featuring reinforced battlements, interior corridors, and fortified artillery towers.',
    image_url: 'https://images.unsplash.com/photo-1533158307587-828f0a76ef46?auto=format&fit=crop&w=1200&q=80',
    objectives: 'Secure perimeter bastions and eliminate core command centers.',
    layout_info: 'High defense perimeter with layered trenches and fortified stone redoubts.',
  },
};

/**
 * Retrieve all official CAA League maps from the database.
 * If any official maps are missing, guarantees all 4 official maps are present.
 */
export async function getOfficialMaps(supabase: SupabaseClient): Promise<GameMap[]> {
  try {
    const { data, error } = await supabase
      .from('maps')
      .select('*')
      .in('name', OFFICIAL_MAP_NAMES as unknown as string[])
      .order('name', { ascending: true });

    if (error) {
      console.warn('Error fetching official maps from Supabase:', error.message);
    }

    if (data && data.length > 0) {
      // Filter strictly to official maps and sort in canonical order
      const mapOrder = { Plains: 0, Thermopylae: 1, Castle: 2, Fortress: 3 };
      return (data as GameMap[])
        .filter((m) => OFFICIAL_MAP_NAMES.includes(m.name as OfficialMapName))
        .sort((a, b) => {
          const orderA = mapOrder[a.name as OfficialMapName] ?? 99;
          const orderB = mapOrder[b.name as OfficialMapName] ?? 99;
          return orderA - orderB;
        });
    }
  } catch (err) {
    console.error('getOfficialMaps error:', err);
  }

  // Fallback to official default definitions if DB is empty or during initialization
  return OFFICIAL_MAP_NAMES.map((name, index) => {
    const info = OFFICIAL_MAP_DEFAULTS[name];
    return {
      id: `aaaaaaaa-000${index + 1}-4000-8000-00000000000${index + 1}`,
      name,
      image_url: info.image_url,
      description: info.description,
      map_type: 'competitive',
      type: 'Official',
      objectives: info.objectives,
      layout_info: info.layout_info,
      status: 'active',
      is_official: true,
      is_competitive: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
}

export interface CompetitionPoolCriteria {
  seasonId?: string | null;
  divisionId?: string | null;
  tournamentName?: string | null;
  matchFormat?: string | null;
}

export interface MapPoolEntry {
  map: GameMap;
  isAvailable: boolean;
  poolConfig?: CompetitionMapPool;
}

/**
 * Retrieves the competition map pool for a particular season, division, tournament, or match format.
 * Administrators configure pools without deleting maps: maps are simply marked unavailable for that specific competition.
 */
export async function getCompetitionMapPool(
  supabase: SupabaseClient,
  criteria: CompetitionPoolCriteria = {}
): Promise<MapPoolEntry[]> {
  const officialMaps = await getOfficialMaps(supabase);

  try {
    let query = supabase.from('competition_map_pools').select('*');

    if (criteria.seasonId) {
      query = query.eq('season_id', criteria.seasonId);
    }
    if (criteria.divisionId) {
      query = query.eq('division_id', criteria.divisionId);
    }
    if (criteria.tournamentName) {
      query = query.eq('tournament_name', criteria.tournamentName);
    }
    if (criteria.matchFormat) {
      query = query.eq('match_format', criteria.matchFormat);
    }

    const { data: poolData, error } = await query;
    if (error) {
      console.warn('Error fetching competition map pools:', error.message);
    }

    const poolMap = new Map<string, CompetitionMapPool>();
    if (poolData) {
      for (const entry of poolData as CompetitionMapPool[]) {
        poolMap.set(entry.map_id, entry);
      }
    }

    return officialMaps.map((map) => {
      const config = poolMap.get(map.id);
      // By default, if no rule is configured, official maps are available
      const isAvailable = config ? config.is_available : (map.is_active && map.status === 'active');
      return {
        map,
        isAvailable,
        poolConfig: config,
      };
    });
  } catch (err) {
    console.error('getCompetitionMapPool error:', err);
    return officialMaps.map((map) => ({
      map,
      isAvailable: map.is_active && map.status === 'active',
    }));
  }
}

/**
 * Validates that a map selection is one of the 4 official maps and available in the designated pool.
 */
export async function validateMatchMap(
  supabase: SupabaseClient,
  mapId: string,
  criteria?: CompetitionPoolCriteria
): Promise<{ isValid: boolean; reason?: string; map?: GameMap }> {
  const pool = await getCompetitionMapPool(supabase, criteria);
  const entry = pool.find((p) => p.map.id === mapId);

  if (!entry) {
    return {
      isValid: false,
      reason: 'The selected map is not recognized as an official CAA League map.',
    };
  }

  if (!entry.isAvailable) {
    return {
      isValid: false,
      reason: `Map "${entry.map.name}" is excluded from the active competition map pool for this event.`,
      map: entry.map,
    };
  }

  return { isValid: true, map: entry.map };
}

export interface RecordMatchMapParams {
  matchId: string;
  mapId: string;
  gameNumber: number;
  homeScore: number;
  awayScore: number;
  winnerId?: string | null;
  losingGuildId?: string | null;
  refereeId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string;
  durationMinutes?: number | null;
  notes?: string | null;
  screenshotUrl?: string | null;
}

/**
 * Records an official match map result, ensuring the map is strictly official and properly linked.
 */
export async function recordMatchMap(
  supabase: SupabaseClient,
  params: RecordMatchMapParams
): Promise<{ success: boolean; data?: MatchMap; error?: string }> {
  try {
    // 1. Verify map is official
    const { data: mapRecord, error: mapErr } = await supabase
      .from('maps')
      .select('*')
      .eq('id', params.mapId)
      .maybeSingle();

    if (mapErr || !mapRecord) {
      return { success: false, error: 'Map does not exist in the official database.' };
    }

    if (!OFFICIAL_MAP_NAMES.includes(mapRecord.name as OfficialMapName)) {
      return { success: false, error: `Map "${mapRecord.name}" is not an official CAA League map.` };
    }

    // 2. Insert into match_maps
    const scoreStr = `${params.homeScore} - ${params.awayScore}`;
    const payload = {
      match_id: params.matchId,
      map_id: params.mapId,
      game_number: params.gameNumber,
      home_score: params.homeScore,
      away_score: params.awayScore,
      winner_id: params.winnerId || null,
      losing_guild_id: params.losingGuildId || null,
      referee_id: params.refereeId || null,
      duration_minutes: params.durationMinutes || null,
      start_time: params.startTime || null,
      end_time: params.endTime || new Date().toISOString(),
      map_score: scoreStr,
      match_status: params.status || 'completed',
      status: params.status || 'completed',
      notes: params.notes || null,
      screenshot_url: params.screenshotUrl || null,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('match_maps')
      .insert(payload)
      .select('*, map:maps(*)')
      .single();

    if (insertErr) {
      return { success: false, error: insertErr.message };
    }

    return { success: true, data: inserted as MatchMap };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unexpected error recording match map.';
    return { success: false, error: errorMessage };
  }
}

