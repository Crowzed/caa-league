'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, User, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { sampleGuilds, samplePlayers } from '@/lib/sample-data';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [onOpenChange]);

  // Mock search logic using sample data
  const filteredGuilds = query ? sampleGuilds.filter(g => g.name.toLowerCase().includes(query.toLowerCase()) || g.tag.toLowerCase().includes(query.toLowerCase())).slice(0, 3) : [];
  const filteredPlayers = query ? samplePlayers.filter(p => p.username.toLowerCase().includes(query.toLowerCase())).slice(0, 3) : [];
  
  const hasResults = filteredGuilds.length > 0 || filteredPlayers.length > 0;
  
  const handleSelect = (href: string) => {
    router.push(href);
    onOpenChange(false);
    setQuery('');
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-[10%] w-full max-w-xl -translate-x-1/2 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-10">
          <div className="flex items-center border-b border-zinc-800 px-4 py-3">
            <Search className="w-5 h-5 text-zinc-400 mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Search guilds, players, matches..."
              className="flex-1 bg-transparent border-none outline-none text-zinc-100 placeholder:text-zinc-500 py-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button 
              onClick={() => onOpenChange(false)}
              className="text-zinc-500 hover:text-zinc-300 bg-zinc-900 rounded p-1"
            >
              <span className="text-xs px-1">ESC</span>
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {!query ? (
              <div className="p-8 text-center text-zinc-500 text-sm">
                Type to start searching...
              </div>
            ) : !hasResults ? (
              <div className="p-8 text-center text-zinc-500 text-sm">
                No results found for &quot;{query}&quot;
              </div>
            ) : (
              <div className="space-y-4 p-2">
                {filteredGuilds.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">Guilds</h3>
                    <div className="space-y-1">
                      {filteredGuilds.map((guild) => (
                        <button
                          key={guild.id}
                          onClick={() => handleSelect(`/guilds/${guild.id}`)}
                          className="w-full flex items-center justify-between p-2 rounded-md hover:bg-zinc-800/50 transition-colors text-left group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-zinc-900 flex items-center justify-center border border-zinc-800">
                              <Shield className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-zinc-200 group-hover:text-white">
                                [{guild.tag}] {guild.name}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {guild.region || 'Global'} • {guild.division?.name || 'Grand League'}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {filteredPlayers.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">Players</h3>
                    <div className="space-y-1">
                      {filteredPlayers.map((player) => (
                        <button
                          key={player.id}
                          onClick={() => handleSelect(`/players/${player.id}`)}
                          className="w-full flex items-center justify-between p-2 rounded-md hover:bg-zinc-800/50 transition-colors text-left group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                              <User className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-zinc-200 group-hover:text-white">
                                {player.username}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {player.role}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="bg-zinc-900/50 border-t border-zinc-800 p-2 flex items-center justify-between text-xs text-zinc-500 px-4">
            <div className="flex gap-4">
              <span><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded mr-1 font-sans">↑</kbd><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded mr-1 font-sans">↓</kbd> Navigate</span>
              <span><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded mr-1 font-sans">↵</kbd> Select</span>
            </div>
            <div>CAA League Search</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
