// ============================================================================
// CAA League - Sample Data
// Empty datasets for production and live database integration
// ============================================================================

import type {
  Guild, Profile, Season, Division, Standing, Match, GameMap,
  NewsArticle, Unit, Achievement, Notification, Rule,
} from '@/types/database';

// ============================================================================
// Seasons
// ============================================================================

export const sampleSeasons: Season[] = [];
export const currentSeason: Season | null = null;

// ============================================================================
// Profiles / Players
// ============================================================================

export const sampleProfiles: Profile[] = [];
export const samplePlayers: Profile[] = sampleProfiles;

// ============================================================================
// Guilds
// ============================================================================

export const sampleGuilds: Guild[] = [];

// ============================================================================
// Divisions
// ============================================================================

export const sampleDivisions: Division[] = [];

// ============================================================================
// Standings
// ============================================================================

export const sampleStandings: (Standing & { guild: Guild })[] = [];

// ============================================================================
// Maps
// ============================================================================

export const sampleMaps: GameMap[] = [];

// ============================================================================
// Matches
// ============================================================================

export const sampleMatches: (Match & { home_guild: Guild; away_guild: Guild })[] = [];

// ============================================================================
// News
// ============================================================================

export const sampleNews: NewsArticle[] = [];

// ============================================================================
// Units
// ============================================================================

export const sampleUnits: Unit[] = [];

// ============================================================================
// Achievements
// ============================================================================

export const sampleAchievements: Achievement[] = [];

// ============================================================================
// Rules
// ============================================================================

export const sampleRules: Rule[] = [];

// ============================================================================
// Notifications
// ============================================================================

export const sampleNotifications: Notification[] = [];

// ============================================================================
// Helper functions
// ============================================================================

export function getGuildById(id: string): Guild | undefined {
  return sampleGuilds.find(g => g.id === id);
}

export function getProfileById(id: string): Profile | undefined {
  return sampleProfiles.find(p => p.id === id);
}

export function getMapById(id: string): GameMap | undefined {
  return sampleMaps.find(m => m.id === id);
}

export function getLiveMatches() {
  return sampleMatches.filter(m => m.status === 'live');
}

export function getUpcomingMatches() {
  return sampleMatches.filter(m => m.status === 'scheduled');
}

export function getRecentResults() {
  return sampleMatches.filter(m => m.status === 'completed').sort(
    (a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()
  );
}
