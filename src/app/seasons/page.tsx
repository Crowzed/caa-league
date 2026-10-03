'use client';

import { Trophy, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared';
import { sampleSeasons, sampleGuilds } from '@/lib/sample-data';

export default function SeasonsArchivePage() {
  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Season Archives"
        subtitle="Permanent historical records of all competitive CAA League seasons"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Seasons' },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {sampleSeasons.map((season) => {
          const isCompleted = season.status === 'completed';
          return (
            <Card key={season.id} className="border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-all overflow-hidden group">
              <div className="h-32 bg-gradient-to-r from-blue-950/60 to-zinc-900 p-6 flex flex-col justify-between border-b border-zinc-800">
                <div className="flex justify-between items-start">
                  <Badge variant={season.is_current ? 'default' : 'outline'} className="capitalize">
                    {season.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-zinc-400 font-mono">
                    Season #{season.number}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors">
                  {season.name}
                </h2>
              </div>

              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Dates</span>
                    <span className="text-zinc-300 font-medium" suppressHydrationWarning>
                      {new Date(season.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – {new Date(season.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Rulebook Version</span>
                    <span className="text-zinc-300 font-medium">v{season.number}.0 Snapshot</span>
                  </div>
                </div>

                {isCompleted && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      <div>
                        <p className="text-xs text-amber-400 font-semibold uppercase">Grand Champion</p>
                        <p className="text-sm font-bold text-white">{sampleGuilds[0]?.name || 'TBD'}</p>
                      </div>
                    </div>
                    <Badge className="bg-amber-500 text-black text-xs font-bold">CHAMPION</Badge>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <Link href={`/seasons/${season.id}`}>
                    <Button variant="ghost" size="sm" className="gap-2 group-hover:text-blue-400">
                      Explore Full Archive
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
