'use client';

import { motion } from 'framer-motion';
import { BookOpen, ChevronRight, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared';
import { sampleRules } from '@/lib/sample-data';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { Rule } from '@/types/database';

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>(sampleRules);
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>(['1', '2', '3', '7']);

  const supabase = createClient();

  useEffect(() => {
    async function loadRules() {
      try {
        const { data, error } = await supabase
          .from('rules')
          .select('*')
          .order('sort_order', { ascending: true });

        if (!error && data && data.length > 0) {
          setRules(data as Rule[]);
        }
      } catch (err) {
        console.warn('Rules load note:', err);
      }
    }
    loadRules();
  }, [supabase]);

  const topLevelRules = rules.filter((r) => !r.parent_id);
  const getChildren = (parentId: string) => rules.filter((r) => r.parent_id === parentId);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const filteredRules = search
    ? rules.filter(
        (r) =>
          r.title.toLowerCase().includes(search.toLowerCase()) ||
          r.content.toLowerCase().includes(search.toLowerCase()) ||
          r.number.includes(search)
      )
    : null;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Rules & Regulations"
        subtitle="Official CAA League rulebook — Version 2.0"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Rules' }]}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar - Table of Contents */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="font-semibold text-white mb-3">Table of Contents</h3>
              <nav className="space-y-1">
                {topLevelRules.map((rule) => (
                  <a
                    key={rule.id}
                    href={`#rule-${rule.number}`}
                    className="block text-sm text-zinc-400 hover:text-blue-400 transition-colors py-1"
                  >
                    {rule.number} {rule.title}
                  </a>
                ))}
              </nav>
            </div>
          </div>

          {/* Rules Content */}
          <div className="lg:col-span-3">
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Search rules by number, title, or content..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Search Results */}
            {filteredRules && (
              <div className="mb-8">
                <p className="text-sm text-zinc-400 mb-4">
                  {filteredRules.length} result{filteredRules.length !== 1 ? 's' : ''} found
                </p>
                <div className="space-y-3">
                  {filteredRules.map((rule) => (
                    <motion.div
                      key={rule.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">{rule.number}</Badge>
                        <h4 className="font-semibold text-white">{rule.title}</h4>
                      </div>
                      <p className="text-sm text-zinc-400">{rule.content}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Full Rules */}
            {!filteredRules && (
              <div className="space-y-6">
                {topLevelRules.map((rule, i) => {
                  const children = getChildren(rule.id);
                  const isExpanded = expandedSections.includes(rule.section);

                  return (
                    <motion.div
                      key={rule.id}
                      id={`rule-${rule.number}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden"
                    >
                      {/* Section Header */}
                      <button
                        onClick={() => toggleSection(rule.section)}
                        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs font-mono">
                            {rule.number}
                          </Badge>
                          <h3 className="text-lg font-bold text-white">{rule.title}</h3>
                        </div>
                        <ChevronRight
                          className={cn(
                            'h-5 w-5 text-zinc-400 transition-transform',
                            isExpanded && 'rotate-90'
                          )}
                        />
                      </button>

                      {/* Section Content */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="border-t border-zinc-800"
                        >
                          <div className="p-4">
                            <p className="text-zinc-400 mb-4">{rule.content}</p>

                            {children.length > 0 && (
                              <div className="space-y-4 mt-4">
                                {children.map((child) => (
                                  <div
                                    key={child.id}
                                    id={`rule-${child.number}`}
                                    className="pl-4 border-l-2 border-zinc-700"
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="outline" className="text-xs font-mono">
                                        {child.number}
                                      </Badge>
                                      <h4 className="font-semibold text-white text-sm">
                                        {child.title}
                                      </h4>
                                    </div>
                                    <p className="text-sm text-zinc-400">{child.content}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Version Info */}
            <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold text-white">Rulebook Version</h3>
              </div>
              <p className="text-sm text-zinc-400">
                Version 2.0 — Effective September 15, 2026. This version applies to
                Season 2 - Rising Storm and all matches played during this season.
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                Previous versions are archived and remain associated with their respective seasons.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
