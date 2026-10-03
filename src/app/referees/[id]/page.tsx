'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Shield, Calendar, Clock, Award, AlertTriangle, CheckCircle2, 
  ArrowLeft, User, ExternalLink, Scale, Check, XCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard, EmptyState } from '@/components/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/client';
import type { Referee, RefereeAvailability, RefereeAssignment, RefereeConflict, MatchDecision } from '@/types/database';

export default function RefereeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const refereeId = resolvedParams.id;

  const [referee, setReferee] = useState<Referee | null>(null);
  const [availability, setAvailability] = useState<RefereeAvailability | null>(null);
  const [assignments, setAssignments] = useState<RefereeAssignment[]>([]);
  const [conflicts, setConflicts] = useState<RefereeConflict[]>([]);
  const [decisions, setDecisions] = useState<MatchDecision[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadRefereeData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/referees/${refereeId}`);
        if (res.ok) {
          const data = await res.json();
          setReferee(data.referee);
          setAvailability(data.availability);
          setAssignments(data.assignments || []);
          setConflicts(data.conflicts || []);
          setDecisions(data.decisions || []);
        }
      } catch (err) {
        console.warn('Error loading referee profile:', err);
      } finally {
        setLoading(false);
      }
    }

    loadRefereeData();
  }, [refereeId, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!referee) {
    return (
      <div className="container py-20 max-w-4xl mx-auto">
        <EmptyState
          title="Referee Not Found"
          description="The requested match official profile could not be located in the database."
          icon={<Shield className="w-12 h-12 text-zinc-600" />}
        />
      </div>
    );
  }

  const displayName = referee.profile?.display_name || referee.display_name || referee.profile?.username || referee.website_username;
  const websiteUsername = referee.profile?.username || referee.website_username;
  const robloxUsername = referee.profile?.roblox_username || referee.roblox_username;
  const discordUsername = referee.profile?.discord_username || referee.discord_username;
  const avatarUrl = referee.profile?.avatar_url || '';
  const initial = displayName.substring(0, 2).toUpperCase();
  const region = referee.region || referee.profile?.region || 'Global';
  const timezone = referee.timezone || referee.profile?.timezone || 'UTC';

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

  return (
    <div className="container py-10 max-w-6xl mx-auto space-y-8">
      <div>
        <Link href="/referees" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Referees Directory
        </Link>
      </div>

      {/* Header Profile Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <Avatar className="w-20 h-20 border-2 border-zinc-700 shadow-lg">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-blue-600/30 text-blue-400 font-bold text-2xl">
                {initial}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-white">{displayName}</h1>
                <Badge variant="outline" className={`text-xs px-2.5 py-0.5 ${getRankBadgeClass(referee.rank)}`}>
                  {referee.rank}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <span className="font-mono text-zinc-300">@{websiteUsername}</span>
                <span>•</span>
                <span>Region: <strong className="text-white">{region}</strong></span>
                <span>•</span>
                <span>Timezone: <strong className="text-white">{timezone}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/referee">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 text-xs">
                <Shield className="w-4 h-4" /> Go to Referee Desk
              </Button>
            </Link>
          </div>
        </div>

        {/* Identity & Socials Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-800/80 text-xs">
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
            <span className="text-zinc-500 block mb-1">Roblox Identity</span>
            <span className="font-mono text-zinc-200 font-semibold">{robloxUsername || 'Verified'}</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
            <span className="text-zinc-500 block mb-1">Discord Tag</span>
            <span className="font-mono text-zinc-200 font-semibold">{discordUsername || 'Not Linked'}</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
            <span className="text-zinc-500 block mb-1">Active Tournament Seasons</span>
            <span className="text-blue-400 font-semibold">{referee.seasons_active?.join(', ') || 'Season 1'}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Officiated" value={referee.matches_officiated || 0} subtitle="Official series" icon={Shield} color="blue" />
        <StatCard title="Completed" value={referee.completed_matches || 0} subtitle="Results confirmed" icon={CheckCircle2} color="green" />
        <StatCard title="Warnings Issued" value={referee.warnings_issued || 0} subtitle="Rule infractions" icon={AlertTriangle} color="gold" />
        <StatCard title="Reports Filed" value={referee.reports_submitted || 0} subtitle="Within deadline" icon={Award} color="default" />
      </div>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Match Assignments & Decisions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Match Assignments */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" /> Recent Match Assignments
            </h3>

            {assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.map((assign) => {
                  const m = (assign as unknown as { match: { id: string; scheduled_at: string; status: string; format: string; home_score: number; away_score: number; home_guild: { name: string; tag: string }; away_guild: { name: string; tag: string }; division?: { name: string } } }).match;
                  if (!m) return null;

                  return (
                    <div key={assign.id} className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {m.home_guild?.tag || 'GD1'} vs {m.away_guild?.tag || 'GD2'}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono border-zinc-700 text-zinc-300">
                            {m.format || 'BO5'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono border-blue-500/40 text-blue-400 bg-blue-500/10">
                            {assign.role}
                          </Badge>
                        </div>
                        <p className="text-zinc-400 text-[11px]">
                          {m.division?.name || 'Tournament Division'} • {new Date(m.scheduled_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {m.status === 'completed' ? (
                          <div className="text-right">
                            <span className="font-mono font-bold text-white">{m.home_score} - {m.away_score}</span>
                            <span className="block text-[10px] text-emerald-400 uppercase font-bold">Final</span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="capitalize text-zinc-400">
                            {m.status}
                          </Badge>
                        )}
                        <Link href={`/referee/match/${m.id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-[11px] border-zinc-700 text-zinc-300">
                            View Desk
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-4 text-center">No assignments logged yet for this referee.</p>
            )}
          </div>

          {/* Official Decisions History */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-400" /> Official Rulings & Decisions
            </h3>

            {decisions.length > 0 ? (
              <div className="space-y-3">
                {decisions.map((dec) => (
                  <div key={dec.id} className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-amber-400 uppercase tracking-wider">{dec.decision_type.replace('_', ' ')}</span>
                      <span className="text-[10px] text-zinc-500">{new Date(dec.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-white font-semibold">&ldquo;{dec.decision}&rdquo;</p>
                    <div className="p-2 rounded bg-zinc-900 border border-zinc-800/80 text-zinc-400 text-[11px]">
                      <span className="text-zinc-300 font-semibold">Rule: </span>{dec.rule_name || 'Official Rules'}
                      <br />
                      <span className="text-zinc-300 font-semibold">Reason: </span>{dec.reason}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-4 text-center">No formal in-match rulings recorded.</p>
            )}
          </div>
        </div>

        {/* Right Column: Availability & Conflicts */}
        <div className="space-y-6">
          {/* Availability Card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-400" /> Officiating Availability
            </h3>

            {availability ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-zinc-500 block mb-1">Available Days</span>
                  <div className="flex flex-wrap gap-1.5">
                    {availability.available_days?.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-zinc-500 block mb-1">Operating Hours</span>
                  <p className="text-zinc-300 font-mono">{availability.available_hours}</p>
                </div>

                <div>
                  <span className="text-zinc-500 block mb-1">Timezone</span>
                  <p className="text-zinc-300">{availability.timezone}</p>
                </div>

                <div>
                  <span className="text-zinc-500 block mb-1">Preferred Slots</span>
                  <p className="text-zinc-300">{availability.preferred_match_times}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Default league weekend prime time availability.</p>
            )}
          </div>

          {/* Conflict of Interest Declarations */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" /> Declared Conflicts
            </h3>
            <p className="text-xs text-zinc-400">
              The CAA League automatically prevents referees from officiating matches involving guilds or players with declared affiliations.
            </p>

            {conflicts.length > 0 ? (
              <div className="space-y-2">
                {conflicts.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs space-y-1">
                    <span className="font-semibold text-amber-400 capitalize">{c.conflict_type.replace('_', ' ')}</span>
                    <p className="text-zinc-300">{c.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-xs text-zinc-400 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                <span>No active competitive conflicts on record.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
