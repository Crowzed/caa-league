'use client';

import { useState, useEffect } from 'react';
import { PageHeader, EmptyState } from '@/components/shared';
import { sampleUnits } from '@/lib/sample-data';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Star, GitFork, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { Unit } from '@/types/database';

export default function UnitsDirectoryPage() {
  const [units, setUnits] = useState<Unit[]>(sampleUnits);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [starFilter, setStarFilter] = useState('all');
  const [sortBy, setSortBy] = useState('star-desc');

  const supabase = createClient();

  useEffect(() => {
    async function loadUnits() {
      try {
        const { data, error } = await supabase
          .from('units')
          .select('*')
          .order('star_level', { ascending: false });

        if (!error && data && data.length > 0) {
          setUnits(data as Unit[]);
        }
      } catch (err) {
        console.warn('Units load note:', err);
      }
    }
    loadUnits();
  }, [supabase]);

  const filteredUnits = units.filter((unit) => {
    const matchesSearch = unit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (unit.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || (unit.role || '').toLowerCase() === roleFilter.toLowerCase();
    const matchesStar = starFilter === 'all' || (unit.star_level || 1).toString() === starFilter;
    return matchesSearch && matchesRole && matchesStar;
  });

  const sortedUnits = [...filteredUnits].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'star-asc') return (a.star_level || 0) - (b.star_level || 0);
    if (sortBy === 'star-desc') return (b.star_level || 0) - (a.star_level || 0);
    return 0;
  });

  const renderStars = (level: number) => {
    return Array(level).fill(0).map((_, i) => (
      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
    ));
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'melee': return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
      case 'defense': return 'border-blue-500/30 text-blue-400 bg-blue-500/10';
      case 'polearm': return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
      case 'ranged': return 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10';
      case 'cavalry': return 'border-orange-500/30 text-orange-400 bg-orange-500/10';
      case 'special melee': return 'border-purple-500/30 text-purple-400 bg-purple-500/10';
      default: return 'border-zinc-700 text-zinc-300 bg-zinc-800';
    }
  };

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      <PageHeader 
        title="Unit Database" 
        description="Comprehensive roster and tactical guide for all official Command An Army competitive units." 
      />

      <div className="flex flex-col md:flex-row gap-4 items-end bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div className="flex-1 w-full space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Search Units</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input 
              placeholder="Search by unit name or keywords..." 
              className="pl-9 bg-zinc-950 border-zinc-700 text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="w-full md:w-48 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Combat Role</label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="bg-zinc-950 border-zinc-700 text-white">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="melee">Melee</SelectItem>
              <SelectItem value="defense">Defense</SelectItem>
              <SelectItem value="polearm">Polearm</SelectItem>
              <SelectItem value="ranged">Ranged</SelectItem>
              <SelectItem value="cavalry">Cavalry</SelectItem>
              <SelectItem value="special melee">Special Melee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-44 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Star Rating</label>
          <Select value={starFilter} onValueChange={setStarFilter}>
            <SelectTrigger className="bg-zinc-950 border-zinc-700 text-white">
              <SelectValue placeholder="All Stars" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
              <SelectItem value="all">All Stars</SelectItem>
              <SelectItem value="1">1 Star (★)</SelectItem>
              <SelectItem value="2">2 Stars (★★)</SelectItem>
              <SelectItem value="3">3 Stars (★★★)</SelectItem>
              <SelectItem value="4">4 Stars (★★★★)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-44 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Sort By</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="bg-zinc-950 border-zinc-700 text-white">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
              <SelectItem value="star-desc">Highest Stars</SelectItem>
              <SelectItem value="star-asc">Lowest Stars</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
        <span>Showing {sortedUnits.length} official unit{sortedUnits.length !== 1 ? 's' : ''}</span>
        <span>Standard League Tier List & Evolution Trees</span>
      </div>

      {sortedUnits.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {sortedUnits.map((unit) => {
            const hasEvolution = !!unit.evolution_from;
            const parentUnit = hasEvolution ? units.find(u => u.id === unit.evolution_from) : null;

            return (
              <Card key={unit.id} className="overflow-hidden border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 transition-all flex flex-col group">
                <CardHeader className="pb-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className={`text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full border ${getRoleBadgeVariant(unit.role || 'Melee')}`}>
                      {unit.role || 'Melee'}
                    </span>
                    <div className="flex items-center gap-0.5 bg-black/40 px-2 py-0.5 rounded-full border border-zinc-800">
                      {renderStars(unit.star_level)}
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                    {unit.name}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="flex-1 space-y-3 text-xs">
                  <p className="text-zinc-400 line-clamp-3 leading-relaxed">
                    {unit.description || "Official competitive unit utilized in CAA League matchplay."}
                  </p>

                  {parentUnit && (
                    <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800/80 flex items-center gap-1.5 text-zinc-400">
                      <GitFork className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate">Evolves from <strong className="text-zinc-200">{parentUnit.name}</strong></span>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="border-t border-zinc-800 bg-zinc-950/40 p-3">
                  <Button variant="outline" size="sm" className="w-full border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1.5" asChild>
                    <Link href={`/units/${unit.id}`}>
                      View Details & Tree <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState 
          title="No units found" 
          description="Try adjusting your search criteria or role filters." 
        />
      )}
    </div>
  );
}
