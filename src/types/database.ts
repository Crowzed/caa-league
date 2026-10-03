// ============================================================================
// CAA League - Database Types
// Comprehensive TypeScript types matching the PostgreSQL schema
// ============================================================================

// ============================================================================
// Enum Types
// ============================================================================

export type UserRole = 
  | 'player' 
  | 'guild_member' 
  | 'guild_captain' 
  | 'referee' 
  | 'moderator' 
  | 'admin' 
  | 'super_admin';

export type GuildStatus = 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'requires_changes' 
  | 'active' 
  | 'inactive' 
  | 'disbanded';

export type GuildMemberRole = 
  | 'captain' 
  | 'co_captain' 
  | 'player' 
  | 'substitute';

export type InvitationStatus = 
  | 'pending' 
  | 'accepted' 
  | 'declined' 
  | 'expired'
  | 'cancelled';

export type AccountStatus = 
  | 'registered' 
  | 'verified' 
  | 'inactive' 
  | 'suspended' 
  | 'retired';

export type PlayerGuildStatus = 
  | 'unaffiliated' 
  | 'pending_invitation' 
  | 'active_member' 
  | 'former_member';

export type SeasonStatus = 
  | 'upcoming' 
  | 'registration' 
  | 'group_stage' 
  | 'playoffs' 
  | 'completed' 
  | 'archived';

export type MatchStatus = 
  | 'scheduled' 
  | 'check_in' 
  | 'live' 
  | 'completed' 
  | 'cancelled' 
  | 'postponed' 
  | 'forfeit';

export type MatchFormat = 'bo3' | 'bo5' | 'bo7';

export type MapSide = 'attack' | 'defense';

export type MapResultStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export type ProtestType = 
  | 'exploit' 
  | 'rule_violation' 
  | 'player_eligibility' 
  | 'match_issue' 
  | 'other';

export type CaseStatus = 
  | 'pending' 
  | 'under_review' 
  | 'decision_made' 
  | 'appealed' 
  | 'closed';

export type EvidenceType = 
  | 'screenshot' 
  | 'video' 
  | 'text' 
  | 'document' 
  | 'other';

export type PenaltyType = 
  | 'warning' 
  | 'match_ban' 
  | 'season_ban' 
  | 'permanent_ban' 
  | 'point_deduction' 
  | 'fine' 
  | 'other';

export type PenaltySeverity = 
  | 'minor' 
  | 'moderate' 
  | 'major' 
  | 'critical';

export type AppealStatus = 
  | 'pending' 
  | 'under_review' 
  | 'accepted' 
  | 'rejected' 
  | 'withdrawn';

export type NewsCategory = 
  | 'match_report' 
  | 'roster' 
  | 'rule_change' 
  | 'season' 
  | 'interview' 
  | 'recap' 
  | 'highlight' 
  | 'announcement';

export type AchievementType = 
  | 'championship' 
  | 'record' 
  | 'milestone' 
  | 'special';

export type NotificationType = 
  | 'match_reminder' 
  | 'roster_approval' 
  | 'schedule_change' 
  | 'protest_decision' 
  | 'season_announcement' 
  | 'promotion_relegation' 
  | 'match_result' 
  | 'guild_invitation' 
  | 'system';

// ============================================================================
// Core Entity Types
// ============================================================================

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  roblox_id: string | null;
  roblox_username: string | null;
  discord_id: string | null;
  discord_username: string | null;
  bio: string | null;
  role: UserRole;
  is_verified: boolean;
  account_status?: AccountStatus;
  guild_status?: PlayerGuildStatus;
  region?: string | null;
  country?: string | null;
  timezone?: string | null;
  email?: string | null;
  guild_id?: string | null;
  guild?: Guild | null;
  created_at: string;
  updated_at: string;
}

export interface Guild {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
  description: string | null;
  region: string | null;
  discord_invite: string | null;
  owner_id: string | null;
  status: GuildStatus;
  division_id: string | null;
  ranking?: number;
  mmr?: number;
  created_at: string;
  updated_at: string;
  // Joined relations
  owner?: Profile;
  division?: Division | null;
  members?: GuildMember[];
  standings?: Standing[];
}

export interface GuildMember {
  id: string;
  guild_id: string;
  player_id: string;
  role: GuildMemberRole;
  status?: string;
  joined_at: string;
  left_at: string | null;
  joined_season?: string | null;
  left_season?: string | null;
  added_by?: string | null;
  removed_by?: string | null;
  removal_reason?: string | null;
  is_active: boolean;
  created_at: string;
  // Joined relations
  player?: Profile;
  guild?: Guild;
}

export interface GuildInvitation {
  id: string;
  guild_id: string;
  player_id: string;
  invited_by: string;
  status: InvitationStatus;
  message: string | null;
  created_at: string;
  expires_at?: string;
  responded_at: string | null;
  // Joined relations
  guild?: Guild;
  player?: Profile;
  inviter?: Profile;
}

export interface Season {
  id: string;
  name: string;
  number: number;
  start_date: string;
  end_date: string;
  status: SeasonStatus;
  is_current: boolean;
  registration_deadline: string | null;
  rules_version_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  divisions?: Division[];
  rules_version?: RuleVersion;
}

export interface Division {
  id: string;
  name: string;
  tier: number;
  level?: number;
  season_id: string;
  max_teams: number;
  promotion_spots: number;
  relegation_spots: number;
  playoff_spots: number;
  description: string | null;
  created_at: string;
  // Joined relations
  season?: Season;
  standings?: Standing[];
  guilds?: Guild[];
}

export interface Standing {
  id: string;
  guild_id: string;
  division_id: string;
  season_id: string;
  rank: number;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  maps_won: number;
  maps_lost: number;
  points: number;
  form: string;
  streak: string;
  created_at: string;
  updated_at: string;
  // Joined relations
  guild?: Guild;
  division?: Division;
  season?: Season;
}

export interface Match {
  id: string;
  season_id: string;
  division_id: string;
  week: number;
  round: string | null;
  home_guild_id: string;
  away_guild_id: string;
  scheduled_at: string;
  scheduled_time?: string;
  started_at: string | null;
  completed_at: string | null;
  status: MatchStatus;
  format: MatchFormat;
  home_score: number;
  away_score: number;
  winner_id: string | null;
  referee_id: string | null;
  server_info: string | null;
  notes: string | null;
  is_playoff: boolean;
  bracket_round: string | null;
  bracket_position: number | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  home_guild?: Guild;
  away_guild?: Guild;
  winner?: Guild;
  referee?: Profile | null;
  season?: Season;
  division?: Division;
  match_maps?: MatchMap[];
  match_players?: MatchPlayer[];
  match_screenshots?: MatchScreenshot[];
}

export interface MatchCheckIn {
  id: string;
  match_id: string;
  guild_id: string;
  checked_in_by: string;
  checked_in_at: string;
  players: string[];
  is_confirmed: boolean;
}

export interface MatchPlayer {
  id: string;
  match_id: string;
  player_id: string;
  guild_id: string;
  is_starter: boolean;
  created_at: string;
  // Joined relations
  player?: Profile;
  guild?: Guild;
}

export interface GameMap {
  id: string;
  name: string;
  image_url: string | null;
  description: string | null;
  map_type: string | null;
  type?: string | null;
  objectives: string | null;
  layout_info: string | null;
  status?: 'active' | 'inactive' | 'retired' | 'maintenance';
  is_official?: boolean;
  is_competitive?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MatchMap {
  id: string;
  match_id: string;
  map_id: string;
  game_number: number;
  home_score: number;
  away_score: number;
  winner_id: string | null;
  losing_guild_id?: string | null;
  referee_id?: string | null;
  home_side: MapSide | null;
  duration_minutes: number | null;
  start_time?: string | null;
  end_time?: string | null;
  map_score?: string | null;
  match_status?: string | null;
  status: MapResultStatus;
  notes: string | null;
  screenshot_url: string | null;
  created_at: string;
  // Joined relations
  map?: GameMap;
  winner?: Guild | null;
  losing_guild?: Guild | null;
  referee?: Profile | null;
}

export type CompetitionType = 'season' | 'division' | 'tournament' | 'format' | 'global';

export interface CompetitionMapPool {
  id: string;
  competition_type: CompetitionType;
  season_id?: string | null;
  division_id?: string | null;
  tournament_name?: string | null;
  match_format?: MatchFormat | 'bo1' | null;
  map_id: string;
  is_available: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  map?: GameMap;
  season?: Season | null;
  division?: Division | null;
}

export interface Unit {
  id: string;
  name: string;
  star_level: number;
  role: string | null;
  description: string | null;
  image_url: string | null;
  evolution_from: string | null;
  is_evolution?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnitStatistic {
  id: string;
  unit_id: string;
  season_id: string | null;
  matches_used: number;
  wins: number;
  losses: number;
  pick_rate: number | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
  unit?: Unit;
}

export interface ArmyComposition {
  id: string;
  name: string;
  units: Record<string, number>;
  matches_used: number;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

export interface PlayerStatistic {
  id: string;
  player_id: string;
  season_id: string;
  guild_id: string | null;
  matches_played: number;
  wins: number;
  losses: number;
  maps_played: number;
  maps_won: number;
  maps_lost: number;
  attack_wins: number;
  attack_losses: number;
  defense_wins: number;
  defense_losses: number;
  created_at: string;
  updated_at: string;
  player?: Profile;
  season?: Season;
  guild?: Guild;
}

export interface GuildStatistic {
  id: string;
  guild_id: string;
  season_id: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  maps_won: number;
  maps_lost: number;
  points: number;
  longest_win_streak: number;
  current_streak: number;
  attack_wins: number;
  defense_wins: number;
  created_at: string;
  updated_at: string;
  guild?: Guild;
}

export interface Protest {
  id: string;
  match_id: string;
  submitted_by: string;
  guild_id: string;
  type: ProtestType;
  title: string;
  description: string;
  status: CaseStatus;
  created_at: string;
  updated_at: string;
  match?: Match;
  submitter?: Profile;
  guild?: Guild;
}

export interface Case {
  id: string;
  case_code?: string | null;
  title?: string | null;
  protest_id: string;
  match_id?: string | null;
  season_id?: string | null;
  guild_id?: string | null;
  player_id?: string | null;
  rule_id?: string | null;
  moderator_id: string | null;
  status: CaseStatus;
  decision: string | null;
  reasoning: string | null;
  penalty: string | null;
  decision_at: string | null;
  created_at: string;
  updated_at: string;
  protest?: Protest;
  moderator?: Profile;
  evidence?: CaseEvidence[];
}

export interface CaseEvidence {
  id: string;
  case_id: string;
  submitted_by: string;
  type: EvidenceType;
  url: string | null;
  description: string | null;
  is_public: boolean;
  created_at: string;
}

export interface Penalty {
  id: string;
  case_id: string | null;
  player_id: string | null;
  guild_id: string | null;
  type: PenaltyType;
  description: string;
  severity: PenaltySeverity;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  issued_by: string;
  created_at: string;
}

export interface Appeal {
  id: string;
  penalty_id: string | null;
  sanction_id?: string | null;
  appeal_code?: string | null;
  case_id: string | null;
  submitted_by: string;
  reason: string;
  statement?: string | null;
  evidence?: Array<{ title?: string; url?: string; description?: string }>;
  status: AppealStatus;
  decision: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  // Relations
  submitter?: Profile;
  reviewer?: Profile;
  sanction?: Sanction;
}

export type SanctionSeverity = 'warning' | 'minor' | 'moderate' | 'major' | 'severe';

export type SanctionType = 
  | 'official_warning'
  | 'written_warning'
  | 'match_forfeit'
  | 'map_forfeit'
  | 'score_penalty'
  | 'point_deduction'
  | 'match_suspension'
  | 'player_suspension'
  | 'guild_suspension'
  | 'roster_restriction'
  | 'player_removal'
  | 'guild_probation'
  | 'competitive_ban'
  | 'tournament_ban'
  | 'temporary_ban'
  | 'permanent_ban'
  | 'disqualification'
  | 'other';

export type SanctionStatus = 
  | 'pending'
  | 'active'
  | 'expired'
  | 'completed'
  | 'suspended'
  | 'overturned'
  | 'cancelled'
  | 'appealed'
  | 'upheld'
  | 'reduced';

export type SanctionAppealStatus = 
  | 'none'
  | 'pending'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'partially_upheld'
  | 'withdrawn';

export type SanctionTargetType = 'player' | 'guild';

export interface Sanction {
  id: string;
  sanction_code: string;
  case_id: string | null;
  case_code?: string | null;
  target_type: SanctionTargetType;
  player_id: string | null;
  guild_id: string | null;
  match_id: string | null;
  season_id: string | null;
  division_id: string | null;
  rule_id: string | null;
  rule_number: string | null;
  rule_title: string | null;
  rule_version_id: string | null;
  rule_version_name: string | null;
  violation: string;
  severity: SanctionSeverity;
  sanction_type: SanctionType | string;
  description: string | null;
  decision_summary: string;
  additional_notes: string | null;
  evidence: Array<{ title?: string; url?: string; description?: string; type?: string }>;
  issued_by: string | null;
  issued_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  issued_at: string;
  effective_at: string;
  expires_at: string | null;
  duration_days: number | null;
  is_permanent: boolean;
  status: SanctionStatus;
  appeal_status: SanctionAppealStatus;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  player?: Profile | null;
  guild?: Guild | null;
  match?: Match | null;
  season?: Season | null;
  division?: Division | null;
  rule?: Rule | null;
  case?: Case | null;
  events?: SanctionEvent[];
  appeals?: Appeal[];
}

export interface SanctionEvent {
  id: string;
  sanction_id: string;
  event_type: string;
  title: string;
  description: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface AppealEvent {
  id: string;
  appeal_id: string;
  event_type: string;
  title: string;
  description: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  author_id: string;
  category: NewsCategory;
  is_published: boolean;
  published_at: string | null;
  related_guild_ids: string[] | null;
  related_player_ids: string[] | null;
  related_match_id: string | null;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  type: AchievementType;
  criteria: Record<string, unknown> | null;
  created_at: string;
}

export interface PlayerAchievement {
  id: string;
  player_id: string;
  achievement_id: string;
  season_id: string | null;
  earned_at: string;
  created_at: string;
  achievement?: Achievement;
}

export interface GuildAchievement {
  id: string;
  guild_id: string;
  achievement_id: string;
  season_id: string | null;
  earned_at: string;
  created_at: string;
  achievement?: Achievement;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Rule {
  id: string;
  section: string;
  number: string;
  title: string;
  content: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  children?: Rule[];
}

export interface RuleVersion {
  id: string;
  version_number: string;
  name: string;
  effective_date: string;
  rules_snapshot: Record<string, unknown>;
  is_current: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  user_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user?: Profile;
}

export interface SeasonMapPool {
  id: string;
  season_id: string;
  map_id: string;
  is_active: boolean;
  created_at: string;
  map?: GameMap;
}

export interface MatchScreenshot {
  id: string;
  match_id: string;
  match_map_id: string | null;
  uploaded_by: string;
  url: string;
  caption: string | null;
  created_at: string;
}

// ============================================================================
// Composite / View Types
// ============================================================================

export interface StandingWithGuild extends Standing {
  guild: Guild;
}

export interface MatchWithTeams extends Match {
  home_guild: Guild;
  away_guild: Guild;
}

export interface MatchDetail extends Match {
  home_guild: Guild;
  away_guild: Guild;
  referee: Profile | null;
  season: Season;
  division: Division;
  match_maps: (MatchMap & { map: GameMap })[];
  match_players: (MatchPlayer & { player: Profile })[];
}

export interface GuildDetail extends Guild {
  owner: Profile;
  division: Division | null;
  members: (GuildMember & { player: Profile })[];
  standings: Standing[];
  statistics: GuildStatistic[];
  achievements: (GuildAchievement & { achievement: Achievement })[];
}

export interface PlayerDetail extends Profile {
  guild_member: (GuildMember & { guild: Guild }) | null;
  statistics: PlayerStatistic[];
  achievements: (PlayerAchievement & { achievement: Achievement })[];
  match_history: MatchWithTeams[];
}

export interface DivisionWithStandings extends Division {
  standings: StandingWithGuild[];
}

export interface SeasonDetail extends Season {
  divisions: DivisionWithStandings[];
}

// ============================================================================
// API / Form Types
// ============================================================================

export interface GuildRegistrationForm {
  name: string;
  tag: string;
  logo?: File;
  description?: string;
  region?: string;
  discord_invite?: string;
}

export interface MatchResultForm {
  match_id: string;
  home_score: number;
  away_score: number;
  winner_id: string;
  maps: {
    map_id: string;
    game_number: number;
    home_score: number;
    away_score: number;
    winner_id: string;
    home_side?: MapSide;
    duration_minutes?: number;
    notes?: string;
  }[];
  notes?: string;
}

export interface ProtestForm {
  match_id: string;
  type: ProtestType;
  title: string;
  description: string;
  evidence?: File[];
}

export interface SearchResult {
  type: 'guild' | 'player' | 'match' | 'map' | 'news' | 'rule';
  id: string;
  title: string;
  subtitle?: string;
  image_url?: string;
  url: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ============================================================================
// Dashboard Types  
// ============================================================================

export interface GuildDashboardData {
  guild: GuildDetail;
  next_match: MatchWithTeams | null;
  recent_results: MatchWithTeams[];
  upcoming_schedule: MatchWithTeams[];
  notifications: Notification[];
  season_record: { wins: number; losses: number; draws: number };
}

export interface PlayerDashboardData {
  profile: PlayerDetail;
  guild: Guild | null;
  recent_matches: MatchWithTeams[];
  statistics: PlayerStatistic | null;
  notifications: Notification[];
  achievements: (PlayerAchievement & { achievement: Achievement })[];
}

export interface AdminDashboardData {
  total_guilds: number;
  total_players: number;
  total_matches: number;
  active_season: Season | null;
  pending_guilds: number;
  pending_protests: number;
  upcoming_matches: MatchWithTeams[];
  recent_audit_logs: AuditLog[];
}

export interface RefereeDashboardData {
  assigned_matches: MatchWithTeams[];
  upcoming_matches: MatchWithTeams[];
  completed_matches: MatchWithTeams[];
}

// ============================================================================
// Comprehensive Referee & Officiating System Types
// ============================================================================

export type RefereeRankType = 'Trial Referee' | 'Junior Referee' | 'Referee' | 'Senior Referee' | 'Head Referee' | string;
export type RefereeStatus = 'active' | 'inactive' | 'on_leave' | 'suspended' | 'retired';
export type RefereeApplicationStatus = 'pending' | 'under_review' | 'interview_trial' | 'approved' | 'rejected' | 'withdrawn';
export type RefereeAssignmentRole = 'primary' | 'assistant' | 'head';
export type RefereeAssignmentStatus = 'assigned' | 'accepted' | 'declined' | 'cancelled' | 'completed' | 'reassigned';
export type IncidentType = 
  | 'rule_violation' 
  | 'exploit' 
  | 'unauthorized_player' 
  | 'disconnect' 
  | 'technical_issue' 
  | 'unsportsmanlike_conduct' 
  | 'server_issue' 
  | 'game_error' 
  | 'late_player' 
  | 'match_delay' 
  | 'map_issue' 
  | 'other';
export type IncidentSeverity = 'minor' | 'moderate' | 'major' | 'critical';
export type IncidentStatus = 'recorded' | 'submitted_for_review' | 'resolved' | 'escalated_to_sanction';
export type WarningType = 'verbal' | 'official' | 'gameplay' | 'conduct';
export type PauseReason = 'technical_issue' | 'disconnect' | 'server_issue' | 'player_emergency' | 'administrative_issue' | 'other';
export type DecisionStatus = 'final' | 'under_review' | 'overturned' | 'upheld';
export type DecisionReviewStatus = 'pending' | 'under_review' | 'upheld' | 'overturned' | 'modified';
export type ResultCorrectionStatus = 'pending' | 'approved' | 'rejected';
export type RefereeReportStatus = 'draft' | 'submitted' | 'overdue';

export interface RefereeRank {
  id: string;
  name: string;
  level: number;
  can_officiate: boolean;
  can_review: boolean;
  can_head_ref: boolean;
  created_at: string;
}

export interface Referee {
  id: string;
  user_id?: string | null;
  website_username: string;
  display_name: string;
  discord_username?: string | null;
  roblox_username?: string | null;
  roblox_id?: string | null;
  region: string;
  timezone: string;
  rank: RefereeRankType;
  status: RefereeStatus;
  matches_officiated: number;
  current_season_matches: number;
  completed_matches: number;
  cancelled_matches: number;
  warnings_issued: number;
  reports_submitted: number;
  seasons_active: string[];
  internal_notes?: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile | null;
}

export interface RefereeApplication {
  id: string;
  user_id: string;
  website_username: string;
  display_name: string;
  roblox_username: string;
  discord_username?: string | null;
  region: string;
  timezone: string;
  experience: string;
  availability: string;
  preferred_match_times: string;
  motivation: string;
  relevant_experience?: string | null;
  rules_agreed: boolean;
  status: RefereeApplicationStatus;
  reviewed_by?: string | null;
  reviewer_notes?: string | null;
  created_at: string;
  updated_at: string;
  user?: Profile | null;
  reviewer?: Profile | null;
}

export interface RefereeAssignment {
  id: string;
  match_id: string;
  referee_id: string;
  role: RefereeAssignmentRole;
  status: RefereeAssignmentStatus;
  decline_reason?: string | null;
  assigned_by?: string | null;
  assigned_at: string;
  responded_at?: string | null;
  match?: Match | null;
  referee?: Referee | null;
}

export interface RefereeAvailability {
  id: string;
  referee_id: string;
  available_days: string[];
  available_hours: string;
  timezone: string;
  unavailable_dates: string[];
  preferred_match_times: string;
  updated_at: string;
}

export interface RefereeConflict {
  id: string;
  referee_id: string;
  guild_id?: string | null;
  player_id?: string | null;
  match_id?: string | null;
  conflict_type: 'guild_membership' | 'prior_management' | 'personal_relationship' | 'other';
  description: string;
  created_at: string;
  guild?: Guild | null;
  player?: Profile | null;
}

export interface MatchIncident {
  id: string;
  match_id: string;
  game_number?: number | null;
  incident_time: string;
  reported_by?: string | null;
  player_id?: string | null;
  guild_id?: string | null;
  incident_type: IncidentType;
  description: string;
  evidence_url?: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  created_at: string;
  reporter?: Profile | null;
  player?: Profile | null;
  guild?: Guild | null;
}

export interface MatchWarning {
  id: string;
  match_id: string;
  player_id?: string | null;
  guild_id?: string | null;
  warning_type: WarningType;
  rule_id?: string | null;
  rule_name?: string | null;
  reason: string;
  issued_by?: string | null;
  created_at: string;
  player?: Profile | null;
  guild?: Guild | null;
  issuer?: Profile | null;
}

export interface MatchPause {
  id: string;
  match_id: string;
  pause_start: string;
  pause_end?: string | null;
  duration_seconds?: number | null;
  reason: PauseReason;
  requested_by?: string | null;
  approved_by?: string | null;
  notes?: string | null;
  created_at: string;
  approver?: Profile | null;
}

export interface MatchDisconnect {
  id: string;
  match_id: string;
  player_id?: string | null;
  guild_id?: string | null;
  map_name: string;
  disconnected_at: string;
  reconnected_at?: string | null;
  reason: string;
  impact?: string | null;
  referee_decision?: string | null;
  created_at: string;
  player?: Profile | null;
  guild?: Guild | null;
}

export interface MatchDecision {
  id: string;
  match_id: string;
  game_number?: number | null;
  referee_id?: string | null;
  decision_type: string;
  rule_id?: string | null;
  rule_name?: string | null;
  decision: string;
  reason: string;
  affected_guild_id?: string | null;
  affected_player_id?: string | null;
  evidence_url?: string | null;
  status: DecisionStatus;
  created_at: string;
  referee?: Referee | null;
  affected_guild?: Guild | null;
  affected_player?: Profile | null;
}

export interface DecisionReview {
  id: string;
  decision_id: string;
  match_id: string;
  requested_by_guild_id?: string | null;
  requested_by_user_id?: string | null;
  reason: string;
  status: DecisionReviewStatus;
  reviewed_by?: string | null;
  final_decision?: string | null;
  decision_notes?: string | null;
  created_at: string;
  updated_at: string;
  decision?: MatchDecision | null;
  guild?: Guild | null;
}

export interface ResultCorrection {
  id: string;
  match_id: string;
  original_home_score: number;
  original_away_score: number;
  original_winner_id?: string | null;
  requested_home_score: number;
  requested_away_score: number;
  requested_winner_id?: string | null;
  reason: string;
  evidence_url?: string | null;
  requested_by?: string | null;
  status: ResultCorrectionStatus;
  decided_by?: string | null;
  decided_at?: string | null;
  created_at: string;
  requester?: Profile | null;
  decider?: Profile | null;
  match?: Match | null;
}

export interface RefereeReport {
  id: string;
  match_id: string;
  referee_id?: string | null;
  summary: string;
  start_time?: string | null;
  end_time?: string | null;
  technical_issues?: string | null;
  sportsmanship_rating?: string | null;
  referee_notes?: string | null;
  internal_staff_notes?: string | null;
  evidence_urls?: string[];
  deadline?: string | null;
  status: RefereeReportStatus;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
  referee?: Referee | null;
}

// ============================================================================
// Multi-Role & Permissions System Types
// ============================================================================

export type RoleCategory = 'staff' | 'competitive' | 'community' | 'other';
export type RoleStatus = 'active' | 'inactive';
export type UserRoleStatus = 'active' | 'inactive' | 'expired';

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  category: RoleCategory;
  status: RoleStatus;
  is_system: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  permissions?: Permission[];
  member_count?: number;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
  role?: Role;
  permission?: Permission;
}

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  status: UserRoleStatus;
  assigned_by?: string | null;
  assigned_at: string;
  expires_at?: string | null;
  reason?: string | null;
  removed_by?: string | null;
  removed_at?: string | null;
  created_at: string;
  updated_at: string;
  role?: Role;
  user?: Profile;
  assigner?: Profile | null;
  remover?: Profile | null;
}

export interface RoleConflict {
  id: string;
  role_a_id: string;
  role_b_id: string;
  reason: string;
  is_strict: boolean;
  created_at: string;
  role_a?: Role;
  role_b?: Role;
}

export interface UserActiveRole {
  user_role_id: string;
  role_id: string;
  name: string;
  slug: string;
  category: RoleCategory;
  priority: number;
  status: string;
  expires_at: string | null;
  assigned_at: string;
}

