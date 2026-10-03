'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, Calendar, ArrowLeft, Tag, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { sampleNews, getGuildById } from '@/lib/sample-data';
import { createClient } from '@/lib/supabase/client';
import type { NewsArticle } from '@/types/database';

export default function NewsArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const initialArticle = sampleNews.find((a) => a.slug === slug) || null;
  const [article, setArticle] = useState<NewsArticle | null>(initialArticle);
  const [loading, setLoading] = useState(!initialArticle);

  const supabase = createClient();

  useEffect(() => {
    async function loadArticle() {
      try {
        const { data, error } = await supabase
          .from('news')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (!error && data) {
          setArticle(data as NewsArticle);
        }
      } catch (err) {
        console.warn('Article load note:', err);
      } finally {
        setLoading(false);
      }
    }
    loadArticle();
  }, [slug, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Newspaper className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Article Not Found</h1>
          <p className="text-zinc-400 mt-2">The article you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/news">
            <Button className="mt-4">Back to News</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/50">
        <div className="container mx-auto px-4 py-8">
          <Link href="/news" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-blue-400 transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to News
          </Link>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="secondary" className="capitalize mb-3">
              <Tag className="mr-1 h-3 w-3" />
              {article.category.replace('_', ' ')}
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-zinc-400">
              <span className="flex items-center gap-1" suppressHydrationWarning>
                <Calendar className="h-4 w-4" />
                {article.published_at
                  ? new Date(article.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                  : 'Draft'}
              </span>
              <span>By League Staff</span>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Article Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3"
          >
            {/* Cover Image Placeholder */}
            <div className="h-64 rounded-lg bg-gradient-to-br from-blue-950/30 to-zinc-900 flex items-center justify-center mb-8 border border-zinc-800">
              <Newspaper className="h-16 w-16 text-zinc-700" />
            </div>

            {/* Content */}
            <div className="prose prose-invert max-w-none">
              <p className="text-lg text-zinc-300 leading-relaxed">
                {article.content}
              </p>
            </div>

            {/* Related Guilds */}
            {article.related_guild_ids && article.related_guild_ids.length > 0 && (
              <div className="mt-8 pt-8 border-t border-zinc-800">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Related Guilds
                </h3>
                <div className="flex flex-wrap gap-2">
                  {article.related_guild_ids.map((guildId) => {
                    const guild = getGuildById(guildId);
                    return guild ? (
                      <Link key={guildId} href={`/guilds/${guildId}`}>
                        <Badge variant="outline" className="hover:border-blue-500/50 transition-colors">
                          {guild.name} [{guild.tag}]
                        </Badge>
                      </Link>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="font-semibold text-white mb-3">Recent Articles</h3>
              <div className="space-y-3">
                {sampleNews.filter((a) => a.id !== article.id).slice(0, 4).map((related) => (
                  <Link key={related.id} href={`/news/${related.slug}`}>
                    <div className="group py-2">
                      <p className="text-sm text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                        {related.title}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {related.published_at ? new Date(related.published_at).toLocaleDateString() : 'Draft'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="font-semibold text-white mb-3">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {['announcement', 'match_report', 'recap', 'roster', 'season'].map((cat) => (
                  <Link key={cat} href={`/news?category=${cat}`}>
                    <Badge variant="outline" className="capitalize text-xs hover:border-blue-500/50 transition-colors">
                      {cat.replace('_', ' ')}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
