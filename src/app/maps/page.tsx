'use client';

import { useState, useEffect } from 'react';
import { PageHeader, EmptyState } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Search, ShieldCheck, CheckCircle2, Compass } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { getOfficialMaps, OFFICIAL_MAP_NAMES } from '@/lib/maps/map-service';
import type { GameMap } from '@/types/database';

export default function MapsDirectoryPage() {
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadMaps() {
      try {
        setIsLoading(true);
        const data = await getOfficialMaps(supabase);
        setMaps(data);
      } catch (err) {
        console.warn('Maps load error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadMaps();
  }, [supabase]);

  const officialNames: readonly string[] = OFFICIAL_MAP_NAMES;
  const filteredMaps = maps.filter((map) => {
    return (
      officialNames.includes(map.name) &&
      (map.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (map.description && map.description.toLowerCase().includes(searchQuery.toLowerCase())))
    );
  });

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Official League Maps"
        description="The Command An Army League currently features four official competitive battlegrounds."
      />

      {/* Map Pool Info Banner */}
      <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-yellow-500/10 text-yellow-500">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Standard Competitive Map Pool</h2>
            <p className="text-xs text-muted-foreground">
              Official CAA League fixtures are played exclusively across these 4 verified arenas: Plains, Thermopylae, Castle, and Fortress.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
            4 / 4 Active
          </Badge>
          <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs">
            Official League Pool
          </Badge>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-card/50 p-4 rounded-xl border border-border/50">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search official maps by name or terrain..."
            className="pl-9 bg-background/80"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Maps Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground text-sm">
          Loading official league map pool...
        </div>
      ) : filteredMaps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredMaps.map((map) => (
            <Card
              key={map.id}
              className="overflow-hidden hover:border-yellow-500/50 transition-all flex flex-col bg-card/80 border-border/80 group"
            >
              {/* Map Image / Visual Card */}
              <div className="aspect-video bg-linear-to-br from-slate-900 via-zinc-900 to-slate-950 relative flex items-center justify-center overflow-hidden border-b border-border/50">
                {map.image_url ? (
                  <Image
                    src={map.image_url}
                    alt={map.name}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground/40 group-hover:text-yellow-500/60 transition-colors">
                    <Compass className="h-12 w-12" />
                    <span className="text-[11px] font-mono tracking-wider uppercase">Official Arena</span>
                  </div>
                )}

                {/* Status Badges Header */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  <Badge className="bg-emerald-500/90 text-white font-semibold shadow-sm text-[10px] uppercase">
                    Active
                  </Badge>
                </div>
                <div className="absolute top-2.5 left-2.5">
                  <Badge variant="outline" className="bg-black/60 backdrop-blur-md border-yellow-500/40 text-yellow-400 text-[10px] font-medium">
                    Official Map
                  </Badge>
                </div>
              </div>

              {/* Map Info */}
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                    {map.name}
                  </CardTitle>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary" className="text-[11px] bg-secondary/60 text-secondary-foreground">
                    {map.map_type || "Competitive"}
                  </Badge>
                  <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Competitive: Enabled
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 pb-4">
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                  {map.description || "An official competitive battlefield designed for tactical engagements."}
                </p>

                {map.objectives && (
                  <div className="mt-3 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground/80">Objective:</span> {map.objectives}
                  </div>
                )}
              </CardContent>

              <CardFooter className="border-t border-border/50 bg-muted/20 p-3">
                <Button variant="outline" className="w-full text-xs font-medium" asChild>
                  <Link href={`/maps/${map.id}`}>View Map Analytics & Matches</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No maps found"
          description="Only the four official league maps (Plains, Thermopylae, Castle, Fortress) are supported."
        />
      )}
    </div>
  );
}
