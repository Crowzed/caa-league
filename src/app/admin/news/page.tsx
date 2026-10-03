"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit2, Trash2, Newspaper, Eye, EyeOff, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import { sampleNews } from "@/lib/sample-data";
import { createClient } from "@/lib/supabase/client";
import type { NewsArticle, Profile } from "@/types/database";

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function NewsAdmin() {
  const [articles, setArticles] = useState<NewsArticle[]>(sampleNews);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    title: string;
    slug: string;
    category: NewsArticle["category"];
    excerpt: string;
    content: string;
    cover_image_url: string;
    is_published: boolean;
  }>({
    title: "",
    slug: "",
    category: "announcement",
    excerpt: "",
    content: "",
    cover_image_url: "",
    is_published: true,
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [newsRes, profRes] = await Promise.all([
          supabase.from("news").select("*").order("published_at", { ascending: false }),
          supabase.from("profiles").select("*").order("username", { ascending: true }),
        ]);

        if (!newsRes.error && newsRes.data && newsRes.data.length > 0) {
          setArticles(newsRes.data as NewsArticle[]);
        }
        if (!profRes.error && profRes.data && profRes.data.length > 0) {
          setProfiles(profRes.data as Profile[]);
        }
      } catch (err) {
        console.warn("Load news error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [supabase]);

  const handleTitleChange = (newTitle: string) => {
    setFormData((prev) => ({
      ...prev,
      title: newTitle,
      slug: !editingArticle ? generateSlug(newTitle) : prev.slug,
    }));
  };

  const handleOpenCreate = () => {
    setEditingArticle(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({
      title: "",
      slug: "",
      category: "announcement",
      excerpt: "",
      content: "",
      cover_image_url: "",
      is_published: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (article: NewsArticle) => {
    setEditingArticle(article);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({
      title: article.title,
      slug: article.slug,
      category: article.category,
      excerpt: article.excerpt || "",
      content: article.content,
      cover_image_url: article.cover_image_url || "",
      is_published: article.is_published,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      title: formData.title,
      slug: formData.slug || generateSlug(formData.title),
      category: formData.category,
      excerpt: formData.excerpt,
      content: formData.content,
      cover_image_url: formData.cover_image_url || null,
      is_published: formData.is_published,
      published_at: formData.is_published ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (editingArticle) {
      try {
        const { data, error } = await supabase
          .from("news")
          .update(payload)
          .eq("id", editingArticle.id)
          .select()
          .single();

        if (error) {
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const updated = (data as NewsArticle) || { ...editingArticle, ...payload };
        setArticles(articles.map((a) => (a.id === editingArticle.id ? updated : a)));
        setSuccessMessage("Article updated successfully in database!");
        setIsDialogOpen(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to update article");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const newId = crypto.randomUUID();
      // Ensure valid author_id from profiles
      const authorId = profiles[0]?.id || null;

      const insertPayload = {
        id: newId,
        author_id: authorId,
        related_guild_ids: null,
        related_player_ids: null,
        related_match_id: null,
        created_at: new Date().toISOString(),
        ...payload,
      };

      try {
        const { data, error } = await supabase
          .from("news")
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const created = (data as NewsArticle) || insertPayload;
        setArticles([created, ...articles]);
        setSuccessMessage("Article published successfully in database!");
        setIsDialogOpen(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to insert article");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleTogglePublish = async (article: NewsArticle) => {
    const nextState = !article.is_published;
    try {
      const updates = {
        is_published: nextState,
        published_at: nextState ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("news").update(updates).eq("id", article.id);
      if (error) {
        setErrorMessage(`Failed to update publish state: ${error.message}`);
        return;
      }

      setArticles(
        articles.map((a) => (a.id === article.id ? { ...a, ...updates } : a))
      );
      setSuccessMessage(nextState ? "Article published live!" : "Article converted to draft.");
    } catch {
      setErrorMessage("Network error toggling publish status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article?")) return;

    try {
      const { error } = await supabase.from("news").delete().eq("id", id);
      if (error) {
        setErrorMessage(`Failed to delete article: ${error.message}`);
        return;
      }
      setArticles(articles.filter((a) => a.id !== id));
      setSuccessMessage("Article deleted successfully.");
    } catch {
      setErrorMessage("Network error deleting article");
    }
  };

  const getCategoryBadge = (cat: NewsArticle["category"]) => {
    switch (cat) {
      case "announcement":
        return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/30">Announcement</Badge>;
      case "match_report":
        return <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/30">Match Report</Badge>;
      case "rule_change":
        return <Badge className="bg-red-500/10 text-red-400 border border-red-500/30">Rule Change</Badge>;
      case "season":
        return <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">Season</Badge>;
      default:
        return <Badge variant="outline" className="border-slate-700 text-slate-400">{cat}</Badge>;
    }
  };

  const filteredArticles = articles.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.excerpt || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === "all" || a.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="News & Articles"
        description="Publish announcements, rule amendments, match reports, and league press releases."
        action={
          <Button onClick={handleOpenCreate} className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium">
            <Plus className="mr-2 h-4 w-4" /> Compose Article
          </Button>
        }
      />

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/40 p-4 rounded-xl flex items-center gap-3 text-red-300">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm font-medium">{errorMessage}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setErrorMessage(null)}
            className="ml-auto text-xs text-red-400 hover:text-white"
          >
            Dismiss
          </Button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/40 p-4 rounded-xl flex items-center gap-3 text-green-300">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <span className="text-sm font-medium">{successMessage}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-xs text-green-400 hover:text-white"
          >
            Dismiss
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search headline or excerpt..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] bg-slate-900 border-slate-800 text-slate-200">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="announcement">Announcement</SelectItem>
              <SelectItem value="season">Season</SelectItem>
              <SelectItem value="match_report">Match Report</SelectItem>
              <SelectItem value="recap">Recap</SelectItem>
              <SelectItem value="rule_change">Rule Change</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/50">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Headline</TableHead>
                <TableHead className="text-slate-400">Category</TableHead>
                <TableHead className="text-slate-400">Published</TableHead>
                <TableHead className="text-slate-400 text-center">Status</TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    Loading articles from database...
                  </TableCell>
                </TableRow>
              ) : filteredArticles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No articles found matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredArticles.map((article) => (
                  <TableRow key={article.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          <Newspaper className="h-4 w-4 text-yellow-500" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-200">{article.title}</div>
                          <div className="text-xs text-slate-500 line-clamp-1">{article.excerpt}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryBadge(article.category)}</TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span suppressHydrationWarning>
                          {article.published_at
                            ? new Date(article.published_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Draft"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {article.is_published ? (
                        <Badge className="bg-green-500/10 text-green-400 border border-green-500/30">
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-700 text-slate-500">
                          Draft
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleTogglePublish(article)}
                          className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                          title={article.is_published ? "Unpublish to Draft" : "Publish Live"}
                        >
                          {article.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-green-400" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(article)}
                          className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                          title="Edit Article"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(article.id)}
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Delete Article"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[560px] bg-slate-900 text-slate-50 border-slate-800">
          <DialogHeader>
            <DialogTitle>{editingArticle ? "Edit Article" : "Compose News Article"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Draft or publish announcements, weekly digests, and match recaps.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="n_title">Headline Title</Label>
              <Input
                id="n_title"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Grand League Playoff Schedule Announced"
                className="bg-slate-950 border-slate-800"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="n_slug">URL Slug</Label>
                <Input
                  id="n_slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="grand-league-playoffs"
                  className="bg-slate-950 border-slate-800 font-mono text-xs"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="n_cat">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val: NewsArticle["category"]) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="season">Season</SelectItem>
                    <SelectItem value="match_report">Match Report</SelectItem>
                    <SelectItem value="recap">Recap</SelectItem>
                    <SelectItem value="rule_change">Rule Change</SelectItem>
                    <SelectItem value="interview">Interview</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="n_excerpt">Short Excerpt (Summary)</Label>
              <Input
                id="n_excerpt"
                value={formData.excerpt}
                onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                placeholder="One sentence teaser displayed in news lists and cards..."
                className="bg-slate-950 border-slate-800"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="n_content">Article Content (Markdown supported)</Label>
              <Textarea
                id="n_content"
                rows={6}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Write full article body here..."
                className="bg-slate-950 border-slate-800 text-slate-100"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="n_cover">Cover Image URL (Optional)</Label>
              <Input
                id="n_cover"
                value={formData.cover_image_url}
                onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="bg-slate-950 border-slate-800"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="n_pub"
                checked={formData.is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-yellow-600 focus:ring-yellow-500"
              />
              <Label htmlFor="n_pub" className="text-sm font-normal text-slate-300">
                Publish immediately to website
              </Label>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-slate-700 text-slate-300"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : editingArticle ? "Save Article" : "Create Article"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

