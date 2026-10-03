'use client';

import { motion } from 'framer-motion';
import { Newspaper, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared';
import { sampleNews } from '@/lib/sample-data';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NewsArticle } from '@/types/database';

const categories = [
  'all', 'match_report', 'roster', 'rule_change', 'season',
  'interview', 'recap', 'highlight', 'announcement',
];

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>(sampleNews);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const supabase = createClient();

  useEffect(() => {
    async function loadNews() {
      try {
        const { data, error } = await supabase
          .from('news')
          .select('*')
          .eq('is_published', true)
          .order('published_at', { ascending: false });

        if (!error && data) {
          setArticles(data as NewsArticle[]);
        }
      } catch (err) {
        console.warn('News load note:', err);
      }
    }
    loadNews();
  }, [supabase]);

  const filtered = articles.filter((article) => {
    const matchesSearch = article.title.toLowerCase().includes(search.toLowerCase()) ||
      (article.excerpt || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || article.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen">
      <PageHeader
        title="News & Media"
        subtitle="League updates, match reports, and announcements"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'News' }]}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <Input
            placeholder="Search news..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:max-w-xs"
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={category === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategory(cat)}
                className="text-xs capitalize"
              >
                {cat === 'all' ? 'All' : cat.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Featured Article */}
        {filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link href={`/news/${filtered[0].slug}`}>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur overflow-hidden group hover:border-blue-500/30 transition-all">
                <div className="grid md:grid-cols-2">
                  <div className="h-48 md:h-64 bg-gradient-to-br from-blue-950/30 to-zinc-900 flex items-center justify-center">
                    <Newspaper className="h-16 w-16 text-zinc-700" />
                  </div>
                  <div className="p-6 flex flex-col justify-center">
                    <Badge variant="secondary" className="w-fit mb-3 capitalize text-xs">
                      {filtered[0].category.replace('_', ' ')}
                    </Badge>
                    <h2 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
                      {filtered[0].title}
                    </h2>
                    <p className="text-zinc-400 mt-2 line-clamp-3">{filtered[0].excerpt}</p>
                    <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span suppressHydrationWarning>
                          {filtered[0].published_at ? new Date(filtered[0].published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Draft'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {/* Articles Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.slice(1).map((article, i) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/news/${article.slug}`}>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur overflow-hidden group hover:border-blue-500/30 transition-all h-full flex flex-col">
                  <div className="h-36 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                    <Newspaper className="h-8 w-8 text-zinc-600" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <Badge variant="secondary" className="w-fit mb-2 capitalize text-xs">
                      {article.category.replace('_', ' ')}
                    </Badge>
                    <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-zinc-500 mt-2 line-clamp-2 flex-1">{article.excerpt}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
                      <span className="text-xs text-zinc-500" suppressHydrationWarning>
                        {article.published_at ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Draft'}
                      </span>
                      <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-blue-400 transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Newspaper className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">No articles found</h3>
            <p className="text-zinc-400 mt-1">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
