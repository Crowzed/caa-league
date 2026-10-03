'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Shield, Search, Filter, Award, CheckCircle, Clock, 
  ChevronRight, Calendar, UserCheck, Sparkles, AlertCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader, EmptyState } from '@/components/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import type { Referee } from '@/types/database';

export default function RefereesDirectoryPage() {
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  const supabase = createClient();

  useEffect(() => {
    async function loadReferees() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('referees')
          .select('*, profile:profiles!user_id(id, username, display_name, roblox_username, discord_username, avatar_url, is_verified, region, timezone)')
          .neq('status', 'inactive')
          .order('matches_officiated', { ascending: false });

        if (!error && data) {
          setReferees(data as Referee[]);
        }
      } catch (err) {
        console.warn('Error loading referees:', err);
      } finally {
        setLoading(false);
      }
    }

    loadReferees();
  }, [supabase]);

  const filteredReferees = referees.filter((ref) => {
    const displayName = ref.profile?.display_name || ref.display_name || ref.profile?.username || ref.website_username;
    const websiteUsername = ref.profile?.username || ref.website_username;
    const robloxUsername = ref.profile?.roblox_username || ref.roblox_username || '';
    const discordUsername = ref.profile?.discord_username || ref.discord_username || '';
    const region = ref.region || ref.profile?.region || '';

    const matchesSearch = 
      displayName.toLowerCase().includes(search.toLowerCase()) ||
      websiteUsername.toLowerCase().includes(search.toLowerCase()) ||
      robloxUsername.toLowerCase().includes(search.toLowerCase()) ||
      discordUsername.toLowerCase().includes(search.toLowerCase());

    const matchesRank = rankFilter === 'all' || ref.rank === rankFilter;
    const matchesStatus = statusFilter === 'all' || ref.status === statusFilter;
    const matchesRegion = regionFilter === 'all' || region.toLowerCase().includes(regionFilter.toLowerCase());

    return matchesSearch && matchesRank && matchesStatus && matchesRegion;
  });

  const activeOfficialsCount = referees.filter(r => r.status === 'active').length;
  const totalMatchesCount = referees.reduce((sum, r) => sum + (r.matches_officiated || 0), 0);
  const totalWarningsCount = referees.reduce((sum, r) => sum + (r.warnings_issued || 0), 0);

  const getRankBadgeClass = (rank: string) => {
    switch (rank) {
      case 'Head Referee':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Senior Referee':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'Referee':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'Junior Referee':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      default:
        return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 bg-emerald-500/10 text-[10px]">Active</Badge>;
      case 'on_leave':
        return <Badge variant="outline" className="text-amber-400 border-amber-500/40 bg-amber-500/10 text-[10px]">On Leave</Badge>;
      case 'suspended':
        return <Badge variant="outline" className="text-red-400 border-red-500/40 bg-red-500/10 text-[10px]">Suspended</Badge>;
      case 'retired':
        return <Badge variant="outline" className="text-zinc-400 border-zinc-700 bg-zinc-800/60 text-[10px]">Retired</Badge>;
      default:
        return <Badge variant="outline" className="text-zinc-400 text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      {/* Hero Header */}
      <div className="rounded-2xl border border-blue-500/20 bg-linear-to-b from-blue-950/40 via-zinc-900/40 to-zinc-950 p-6 md:p-10 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" />
              <span>Official Tournament Officiating Body</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              League Referees & Match Officials
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Certified match adjudicators enforcing official competitive rules, verifying team rosters, presiding over live fixtures, and ensuring integrity across all Command An Army divisions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Link href="/referees/apply">
              <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2">
                <Sparkles className="w-4 h-4" /> Apply as Referee
              </Button>
            </Link>
            <Link href="/referee">
              <Button variant="outline" className="w-full sm:w-auto border-zinc-700 text-zinc-300 hover:text-white gap-2">
                <Shield className="w-4 h-4 text-blue-400" /> Referee Desk
              </Button>
            </Link>
          </div>
        </div>

        {/* Global Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-zinc-800/80">
          <div>
            <span className="text-xs text-zinc-400 uppercase tracking-wider font-mono">Active Officials</span>
            <p className="text-2xl font-black text-white mt-0.5">{activeOfficialsCount}</p>
          </div>
          <div>
            <span className="text-xs text-zinc-400 uppercase tracking-wider font-mono">Series Officiated</span>
            <p className="text-2xl font-black text-blue-400 mt-0.5">{totalMatchesCount}</p>
          </div>
          <div>
            <span className="text-xs text-zinc-400 uppercase tracking-wider font-mono">Warnings Logged</span>
            <p className="text-2xl font-black text-amber-400 mt-0.5">{totalWarningsCount}</p>
          </div>
          <div>
            <span className="text-xs text-zinc-400 uppercase tracking-wider font-mono">Official Ranks</span>
            <p className="text-2xl font-black text-purple-400 mt-0.5">5 Tiers</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
          <Input
            placeholder="Search by referee name, website username, or Roblox handle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-zinc-950 border-zinc-800 text-white text-xs placeholder:text-zinc-500"
          />
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <Select value={rankFilter} onValueChange={setRankFilter}>
            <SelectTrigger className="w-[150px] h-10 text-xs bg-zinc-950 border-zinc-800 text-zinc-300">
              <SelectValue placeholder="Rank" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs">
              <SelectItem value="all">All Ranks</SelectItem>
              <SelectItem value="Head Referee">Head Referee</SelectItem>
              <SelectItem value="Senior Referee">Senior Referee</SelectItem>
              <SelectItem value="Referee">Referee</SelectItem>
              <SelectItem value="Junior Referee">Junior Referee</SelectItem>
              <SelectItem value="Trial Referee">Trial Referee</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-10 text-xs bg-zinc-950 border-zinc-800 text-zinc-300">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>

          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-[140px] h-10 text-xs bg-zinc-950 border-zinc-800 text-zinc-300">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs">
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="Asia">Asia / Pacific</SelectItem>
              <SelectItem value="North America">North America</SelectItem>
              <SelectItem value="Europe">Europe</SelectItem>
              <SelectItem value="Global">Global</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      ) : filteredReferees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReferees.map((ref) => {
            const displayName = ref.profile?.display_name || ref.display_name || ref.profile?.username || ref.website_username;
            const websiteUsername = ref.profile?.username || ref.website_username;
            const robloxUsername = ref.profile?.roblox_username || ref.roblox_username;
            const discordUsername = ref.profile?.discord_username || ref.discord_username;
            const avatarUrl = ref.profile?.avatar_url || '';
            const initial = displayName.substring(0, 2).toUpperCase();
            const region = ref.region || ref.profile?.region || 'Global';
            const timezone = ref.timezone || ref.profile?.timezone || 'UTC';

            return (
              <div 
                key={ref.id}
                className="group rounded-2xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900/90 hover:border-zinc-700 transition-all p-6 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-xl"
              >
                <div className="space-y-4">
                  {/* Top info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12 border border-zinc-700">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback className="bg-blue-600/30 text-blue-400 font-bold text-sm">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-base text-white group-hover:text-blue-400 transition-colors">
                            {displayName}
                          </h3>
                        </div>
                        <p className="text-xs text-zinc-400 font-mono">@{websiteUsername}</p>
                      </div>
                    </div>
                    {getStatusBadge(ref.status)}
                  </div>

                  {/* Rank & Region */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={`text-xs font-semibold px-2.5 py-0.5 ${getRankBadgeClass(ref.rank)}`}>
                      {ref.rank}
                    </Badge>
                    <span className="text-xs text-zinc-400 bg-zinc-950/70 border border-zinc-800 px-2 py-0.5 rounded-md font-mono">
                      {region} • {timezone}
                    </span>
                  </div>

                  {/* Handles */}
                  <div className="text-xs text-zinc-400 space-y-1 bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/60">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Roblox:</span>
                      <span className="text-zinc-300 font-mono">{robloxUsername || 'Verified'}</span>
                    </div>
                    {discordUsername && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Discord:</span>
                        <span className="text-zinc-300 font-mono">{discordUsername}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                    <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
                      <p className="text-lg font-black text-white">{ref.matches_officiated || 0}</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-mono">Matches</p>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
                      <p className="text-lg font-black text-amber-400">{ref.warnings_issued || 0}</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-mono">Warnings</p>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
                      <p className="text-lg font-black text-emerald-400">{ref.reports_submitted || 0}</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-mono">Reports</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800/80">
                  <Link href={`/referees/${ref.id}`} className="w-full">
                    <Button variant="ghost" className="w-full justify-between text-xs text-zinc-300 group-hover:text-white group-hover:bg-blue-600/10 group-hover:border group-hover:border-blue-500/30">
                      <span>View Official Profile</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-1 text-zinc-500 group-hover:text-blue-400" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No Referees Found"
          description="No official referees matched your search or filter criteria."
          icon={<Shield className="w-10 h-10 text-zinc-600" />}
        />
      )}
    </div>
  );
}
