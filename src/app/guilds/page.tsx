'use client';

import { useState, useEffect } from 'react';
import { PageHeader, EmptyState } from '@/components/shared';
import { GuildCard } from '@/components/guild-card';
import { sampleGuilds } from '@/lib/sample-data';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Guild } from '@/types/database';

export default function GuildDirectoryPage() {
  const [guilds, setGuilds] = useState<Guild[]>(sampleGuilds);
  const [searchQuery, setSearchQuery] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  const supabase = createClient();

  useEffect(() => {
    async function loadGuilds() {
      try {
        const { data, error } = await supabase
          .from('guilds')
          .select('*')
          .in('status', ['active', 'approved'])
          .order('name', { ascending: true });

        if (!error && data) {
          setGuilds(data as Guild[]);
        }
      } catch (err) {
        console.warn('Guilds load note:', err);
      }
    }
    loadGuilds();
  }, [supabase]);

  const filteredGuilds = guilds.filter((guild) => {
    // Strictly only display approved/active guilds to the public
    if (guild.status !== 'active' && guild.status !== 'approved') return false;

    const matchesSearch = guild.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          guild.tag.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDivision = divisionFilter === 'all' || guild.division_id === divisionFilter;
    const matchesRegion = regionFilter === 'all' || guild.region === regionFilter;
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && guild.status === 'active');

    return matchesSearch && matchesDivision && matchesRegion && matchesStatus;
  });

  const sortedGuilds = [...filteredGuilds].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'ranking') {
      const aRank = (a as { ranking?: number }).ranking ?? 999;
      const bRank = (b as { ranking?: number }).ranking ?? 999;
      return aRank - bRank;
    }
    if (sortBy === 'region') return (a.region || '').localeCompare(b.region || '');
    return 0;
  });

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      <PageHeader 
        title="Guild Directory" 
        description="Browse all registered guilds in the CAA League." 
      />

      <div className="flex flex-col md:flex-row gap-4 items-end bg-card/50 p-4 rounded-xl border border-border/50">
        <div className="flex-1 w-full space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or tag..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="w-full md:w-48 space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Division</label>
          <Select value={divisionFilter} onValueChange={setDivisionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Divisions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              <SelectItem value="PREMIER">Premier</SelectItem>
              <SelectItem value="CHALLENGER">Challenger</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-48 space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Region</label>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="NA">North America</SelectItem>
              <SelectItem value="EU">Europe</SelectItem>
              <SelectItem value="ASIA">Asia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-48 space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-48 space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Sort By</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="ranking">Ranking</SelectItem>
              <SelectItem value="region">Region</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {sortedGuilds.length} guild{sortedGuilds.length !== 1 ? 's' : ''}
      </div>

      {sortedGuilds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedGuilds.map((guild) => (
            <GuildCard key={guild.id} guild={guild} />
          ))}
        </div>
      ) : (
        <EmptyState 
          title="No guilds found" 
          description="Try adjusting your search or filters to find what you're looking for." 
        />
      )}
    </div>
  );
}
