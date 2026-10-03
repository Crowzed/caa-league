'use client';

import { useState, useEffect } from 'react';
import { PageHeader, EmptyState } from '@/components/shared';
import { PlayerCard, PlayerWithGuild } from '@/components/player-card';
import { Input } from '@/components/ui/input';
import { Search, Filter, RotateCcw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Guild, Division, AccountStatus, PlayerGuildStatus } from '@/types/database';

export default function PlayersDirectoryPage() {
  const [players, setPlayers] = useState<PlayerWithGuild[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [guildFilter, setGuildFilter] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [accountStatusFilter, setAccountStatusFilter] = useState('all');
  const [guildStatusFilter, setGuildStatusFilter] = useState('all');

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);

        // 1. Fetch all registered profiles
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .order('display_name', { ascending: true });

        // 2. Fetch active guild memberships with guild and division relations
        const { data: activeMembersData } = await supabase
          .from('guild_members')
          .select('player_id, role, guild:guilds(id, name, tag, division_id, division:divisions(id, name))')
          .eq('is_active', true);

        // 3. Fetch all guilds for filter
        const { data: guildsData } = await supabase
          .from('guilds')
          .select('*')
          .order('name', { ascending: true });

        // 4. Fetch all divisions for filter
        const { data: divisionsData } = await supabase
          .from('divisions')
          .select('*')
          .order('name', { ascending: true });

        if (guildsData) setGuilds(guildsData as Guild[]);
        if (divisionsData) setDivisions(divisionsData as Division[]);

        // Map active guild affiliations
        interface ActiveMemberRow {
          player_id: string;
          role: string;
          guild: {
            id: string;
            name: string;
            tag: string;
            division_id?: string;
            division?: { id: string; name: string };
          } | null;
        }

        const activeMap = new Map<string, {
          id: string;
          name: string;
          tag: string;
          divisionId?: string;
          divisionName?: string;
          role?: string;
        }>();

        if (activeMembersData) {
          (activeMembersData as unknown as ActiveMemberRow[]).forEach((m) => {
            if (m.player_id && m.guild) {
              activeMap.set(m.player_id, {
                id: m.guild.id,
                name: m.guild.name,
                tag: m.guild.tag,
                divisionId: m.guild.division_id || m.guild.division?.id,
                divisionName: m.guild.division?.name,
                role: m.role,
              });
            }
          });
        }

        if (profilesData) {
          const enriched: PlayerWithGuild[] = (profilesData as Profile[]).map((p) => {
            const activeGuild = activeMap.get(p.id) || null;
            return {
              ...p,
              activeGuild,
            };
          });
          setPlayers(enriched);
        }
      } catch (err) {
        console.warn('Players load note:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [supabase]);

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setGuildFilter('all');
    setDivisionFilter('all');
    setRegionFilter('all');
    setAccountStatusFilter('all');
    setGuildStatusFilter('all');
  };

  const hasActiveFilters = 
    searchQuery !== '' || 
    guildFilter !== 'all' || 
    divisionFilter !== 'all' || 
    regionFilter !== 'all' || 
    accountStatusFilter !== 'all' || 
    guildStatusFilter !== 'all';

  // Filter evaluation
  const filteredPlayers = players.filter((player) => {
    // 1. Search Query: matches Website Username, Display Name, Roblox Username, or Roblox User ID
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      const matchUsername = (player.username || '').toLowerCase().includes(query);
      const matchDisplayName = (player.display_name || '').toLowerCase().includes(query);
      const matchRobloxName = (player.roblox_username || '').toLowerCase().includes(query);
      const matchRobloxId = (player.roblox_id || '').toLowerCase().includes(query);

      if (!matchUsername && !matchDisplayName && !matchRobloxName && !matchRobloxId) {
        return false;
      }
    }

    // 2. Guild Filter
    if (guildFilter === 'unaffiliated') {
      if (player.activeGuild || player.guild_status === 'active_member') return false;
    } else if (guildFilter !== 'all') {
      if (player.activeGuild?.id !== guildFilter) return false;
    }

    // 3. Division Filter
    if (divisionFilter !== 'all') {
      if (player.activeGuild?.divisionId !== divisionFilter) return false;
    }

    // 4. Region Filter
    if (regionFilter !== 'all') {
      if ((player.region || '').toUpperCase() !== regionFilter.toUpperCase()) return false;
    }

    // 5. Account Status Filter
    if (accountStatusFilter !== 'all') {
      const actualAccountStatus = player.account_status || (player.is_verified ? 'verified' : 'registered');
      if (actualAccountStatus !== accountStatusFilter) return false;
    }

    // 6. Guild Status Filter
    if (guildStatusFilter !== 'all') {
      const actualGuildStatus = player.guild_status || (player.activeGuild ? 'active_member' : 'unaffiliated');
      if (actualGuildStatus !== guildStatusFilter) return false;
    }

    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <PageHeader 
          title="Global Players Directory" 
          description="Browse all registered competitors, unaffiliated free agents, and guild members." 
        />
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
          <Users className="w-4 h-4 text-blue-400" />
          <span>Total Registered: <strong className="text-white">{players.length}</strong></span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Search by Website Username, Display Name, Roblox Username, or Roblox User ID..." 
            className="pl-10 bg-zinc-950 border-zinc-800 focus:border-blue-500 text-sm h-11"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {/* Current Guild */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Guild</label>
            <select
              value={guildFilter}
              onChange={(e) => setGuildFilter(e.target.value)}
              className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Guilds</option>
              <option value="unaffiliated">Unaffiliated Only</option>
              {guilds.map((g) => (
                <option key={g.id} value={g.id}>[{g.tag}] {g.name}</option>
              ))}
            </select>
          </div>

          {/* Division */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Division</label>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Divisions</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Region */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Region</label>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Regions</option>
              <option value="NA">North America (NA)</option>
              <option value="EU">Europe (EU)</option>
              <option value="APAC">Asia-Pacific (APAC)</option>
              <option value="OCE">Oceania (OCE)</option>
              <option value="SA">South America (SA)</option>
              <option value="OTHER">Other / Global</option>
            </select>
          </div>

          {/* Account Status */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Account Status</label>
            <select
              value={accountStatusFilter}
              onChange={(e) => setAccountStatusFilter(e.target.value)}
              className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Account Statuses</option>
              <option value="registered">Registered</option>
              <option value="verified">Verified</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          {/* Guild Status */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Guild Status</label>
            <select
              value={guildStatusFilter}
              onChange={(e) => setGuildStatusFilter(e.target.value)}
              className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Guild Statuses</option>
              <option value="unaffiliated">Unaffiliated</option>
              <option value="active_member">Active Member</option>
              <option value="pending_invitation">Pending Invitation</option>
              <option value="former_member">Former Member</option>
            </select>
          </div>
        </div>

        {/* Filter Summary & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80 text-xs">
          <span className="text-zinc-400">
            Showing <strong className="text-white font-medium">{filteredPlayers.length}</strong> of {players.length} players
          </span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-7 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Player Cards Grid */}
      {filteredPlayers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredPlayers.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      ) : (
        <EmptyState 
          title="No players found" 
          description="No registered players matched your current filter criteria. Try adjusting or resetting your filters." 
        />
      )}
    </div>
  );
}
