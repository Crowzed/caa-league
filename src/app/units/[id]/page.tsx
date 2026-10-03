'use client';

import { use, useEffect, useState } from 'react';
import { sampleUnits } from '@/lib/sample-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EmptyState } from '@/components/shared';
import { ShieldAlert, Star, Crosshair, ArrowLeft, ArrowRight, GitFork, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { createClient } from '@/lib/supabase/client';
import type { Unit, UnitStatistic } from '@/types/database';

export default function UnitProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const unitId = resolvedParams.id;
  const [allUnits, setAllUnits] = useState<Unit[]>(sampleUnits);
  const [unitStats, setUnitStats] = useState<UnitStatistic | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadUnits() {
      try {
        const { data, error } = await supabase.from('units').select('*');
        if (!error && data && data.length > 0) {
          setAllUnits(data as Unit[]);

          const currentUnit = (data as Unit[]).find(
            u => u.id === unitId || u.name.toLowerCase().replace(/\s+/g, '-') === unitId.toLowerCase()
          );

          if (currentUnit) {
            const { data: sData } = await supabase
              .from('unit_statistics')
              .select('*')
              .eq('unit_id', currentUnit.id)
              .maybeSingle();

            if (sData) setUnitStats(sData as UnitStatistic);
          }
        }
      } catch (err) {
        console.warn('Unit profile load note:', err);
      }
    }
    loadUnits();
  }, [supabase, unitId]);

  const unit = allUnits.find(u => u.id === unitId || u.name.toLowerCase().replace(/\s+/g, '-') === unitId.toLowerCase());
  
  if (!unit) {
    return (
      <div className="container py-20 max-w-7xl mx-auto">
        <EmptyState 
          title="Unit Not Found" 
          description="The unit you are looking for does not exist in the official CAA database." 
          icon={<ShieldAlert className="h-12 w-12 text-destructive/50" />}
        />
        <div className="flex justify-center mt-6">
          <Button asChild>
            <Link href="/units">Back to Units Database</Link>
          </Button>
        </div>
      </div>
    );
  }

  const renderStars = (level: number) => {
    return Array(level).fill(0).map((_, i) => (
      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
    ));
  };

  const evolutionFrom = unit.evolution_from ? allUnits.find(u => u.id === unit.evolution_from) : null;
  const evolvesInto = allUnits.filter(u => u.evolution_from === unit.id);

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      <div>
        <Link href="/units" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Unit Database
        </Link>
      </div>

      {/* Unit Header */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-sm">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Crosshair className="h-64 w-64" />
        </div>
        
        <div className="relative flex flex-col md:flex-row gap-8 items-start md:items-center">
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex gap-1.5 mb-3 bg-black/40 px-3 py-1 rounded-full border border-zinc-800 w-fit">
                {renderStars(unit.star_level)}
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">{unit.name}</h1>
              <div className="flex items-center gap-3">
                <Badge variant="default" className="text-sm px-3 py-1 bg-blue-600">
                  {unit.role}
                </Badge>
                {evolutionFrom && (
                  <Badge variant="secondary" className="text-sm px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    Evolved Form
                  </Badge>
                )}
                {evolvesInto.length > 0 && (
                  <Badge variant="secondary" className="text-sm px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Has Evolution
                  </Badge>
                )}
                {!evolutionFrom && evolvesInto.length === 0 && (
                  <Badge variant="outline" className="text-sm px-3 py-1 border-zinc-700 text-zinc-400">
                    Standalone Unit
                  </Badge>
                )}
              </div>
            </div>
            
            <p className="text-zinc-300 text-base md:text-lg max-w-3xl leading-relaxed">
              {unit.description || `A powerful ${unit.star_level}-star ${(unit.role || 'combat').toLowerCase()} unit highly utilized in competitive play.`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader>
              <CardTitle className="text-white">Combat & Tactical Metrics</CardTitle>
              <CardDescription className="text-zinc-400">Official tournament performance metrics across recorded CAA League matches</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-zinc-300">Competitive Pick Rate</span>
                  <span className="text-zinc-400 font-semibold">
                    {unitStats?.pick_rate ? `${unitStats.pick_rate}%` : '0% (Awaiting telemetry)'}
                  </span>
                </div>
                <Progress value={unitStats?.pick_rate ? Number(unitStats.pick_rate) : 0} className="h-2 bg-zinc-800" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-zinc-300">Win Rate When Picked</span>
                  <span className="text-zinc-400 font-semibold">
                    {unitStats && unitStats.matches_used > 0
                      ? `${Math.round((unitStats.wins / unitStats.matches_used) * 100)}%`
                      : '0% (No matches yet)'}
                  </span>
                </div>
                <Progress
                  value={
                    unitStats && unitStats.matches_used > 0
                      ? Math.round((unitStats.wins / unitStats.matches_used) * 100)
                      : 0
                  }
                  className="h-2 bg-zinc-800"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-zinc-300">Official Matches Deployed</span>
                  <span className="text-zinc-400 font-semibold">
                    {unitStats?.matches_used || 0} fixtures
                  </span>
                </div>
                <Progress value={Math.min(100, (unitStats?.matches_used || 0) * 10)} className="h-2 bg-zinc-800" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader>
              <CardTitle className="text-white">Tactical Role & Synergy</CardTitle>
              <CardDescription className="text-zinc-400">Competitive breakdown for army compositions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-zinc-300 leading-relaxed">
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Army Budgeting & Deployment Strategy
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  As a <strong>{unit.star_level}★ {unit.role || 'Combat'}</strong> unit, {unit.name} fits into tactical compositions that prioritize {(unit.role || 'combat').toLowerCase()} coverage. 
                  Coordinate unit positioning to maximize its passive attributes and guard against counter-units.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" /> Defensive Counterplays
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Refer to the official CAA rulebook for banned unit variants and composition limits during tournament matches.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Evolution Tree Sidebar */}
        <div className="space-y-6">
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardHeader>
              <CardTitle className="text-purple-400 flex items-center gap-2 text-lg">
                <GitFork className="w-5 h-5 text-purple-400" /> Evolution Hierarchy
              </CardTitle>
              <CardDescription className="text-zinc-400 text-xs">
                Official progression path for this unit line
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Previous Form */}
              {evolutionFrom && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Evolves From</p>
                  <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-white">{evolutionFrom.name}</p>
                      <div className="flex gap-0.5 mt-1 scale-90 origin-left">
                        {renderStars(evolutionFrom.star_level)}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-blue-400 hover:text-white" asChild>
                      <Link href={`/units/${evolutionFrom.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              )}

              {/* Current Stage */}
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Active Viewing</span>
                  <p className="font-bold text-sm text-white">{unit.name}</p>
                </div>
                <div className="flex gap-0.5 scale-90 origin-right">
                  {renderStars(unit.star_level)}
                </div>
              </div>

              {/* Next Form */}
              {evolvesInto.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Evolves Into</p>
                  {evolvesInto.map((nextUnit) => (
                    <div key={nextUnit.id} className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-white">{nextUnit.name}</p>
                        <div className="flex gap-0.5 mt-1 scale-90 origin-left">
                          {renderStars(nextUnit.star_level)}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-blue-400 hover:text-white" asChild>
                        <Link href={`/units/${nextUnit.id}`}>View <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {!evolutionFrom && evolvesInto.length === 0 && (
                <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 text-center space-y-1">
                  <p className="text-xs font-semibold text-zinc-300">No Documented Evolution Path</p>
                  <p className="text-[11px] text-zinc-500">This unit serves as a standalone standard or banner elite.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
