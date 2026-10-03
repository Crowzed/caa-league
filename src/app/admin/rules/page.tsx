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
import { Plus, Edit2, Trash2, Search, BookOpen, CheckCircle, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { sampleRules } from "@/lib/sample-data";
import { createClient } from "@/lib/supabase/client";
import type { Rule } from "@/types/database";

function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export default function RulesAdmin() {
  const [rules, setRules] = useState<Rule[]>(sampleRules);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    number: "",
    title: "",
    section: "1",
    content: "",
    is_active: true,
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadRules() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("rules")
          .select("*")
          .order("sort_order", { ascending: true });

        if (!error && data) {
          setRules(data as Rule[]);
        } else if (error) {
          console.error("Load rules error:", error.message);
          setErrorMessage(`Failed to load rules: ${error.message}`);
        }
      } catch (err) {
        console.warn("Load rules error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadRules();
  }, [supabase]);

  const sections = Array.from(new Set(rules.map((r) => r.section))).sort();

  const handleOpenCreate = () => {
    setEditingRule(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({
      number: "",
      title: "",
      section: selectedSection === "all" ? "1" : selectedSection,
      content: "",
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (rule: Rule) => {
    setEditingRule(rule);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({
      number: rule.number,
      title: rule.title,
      section: rule.section,
      content: rule.content,
      is_active: rule.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      number: formData.number,
      title: formData.title,
      section: formData.section,
      content: formData.content,
      is_active: formData.is_active,
      updated_at: new Date().toISOString(),
    };

    if (editingRule) {
      if (!isValidUUID(editingRule.id)) {
        setErrorMessage(`Invalid rule ID "${editingRule.id}". Cannot update.`);
        setIsSubmitting(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("rules")
          .update(payload)
          .eq("id", editingRule.id)
          .select()
          .single();

        if (error) {
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const updated = (data as Rule) || { ...editingRule, ...payload };
        setRules(rules.map((r) => (r.id === editingRule.id ? updated : r)));
        setSuccessMessage("Rule updated successfully in database!");
        setIsDialogOpen(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to update rule");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const newId = crypto.randomUUID();
      const insertPayload = {
        id: newId,
        parent_id: null,
        sort_order: rules.length + 1,
        created_at: new Date().toISOString(),
        ...payload,
      };

      try {
        const { data, error } = await supabase
          .from("rules")
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const created = (data as Rule) || insertPayload;
        setRules([...rules, created]);
        setSuccessMessage("Rule created successfully in database!");
        setIsDialogOpen(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to create rule");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleToggleActive = async (id: string) => {
    if (!isValidUUID(id)) {
      setErrorMessage(`Invalid rule ID "${id}". Cannot update.`);
      return;
    }
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    const updated = !rule.is_active;

    try {
      const { error } = await supabase
        .from("rules")
        .update({ is_active: updated, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        setErrorMessage(`Failed to update rule status: ${error.message}`);
        return;
      }

      setRules(rules.map((r) => (r.id === id ? { ...r, is_active: updated } : r)));
      setSuccessMessage(updated ? "Rule enabled" : "Rule disabled");
    } catch {
      setErrorMessage("Network error toggling rule status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!isValidUUID(id)) {
      setErrorMessage(`Invalid rule ID "${id}". Cannot delete.`);
      return;
    }
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      const { error } = await supabase.from("rules").delete().eq("id", id);
      if (error) {
        setErrorMessage(`Failed to delete rule: ${error.message}`);
        return;
      }
      setRules(rules.filter((r) => r.id !== id));
      setSuccessMessage("Rule deleted successfully.");
    } catch {
      setErrorMessage("Network error deleting rule");
    }
  };

  const filteredRules = rules.filter((rule) => {
    const matchesSection = selectedSection === "all" || rule.section === selectedSection;
    const matchesSearch =
      rule.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSection && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rulebook Management"
        description="Maintain official league rules, clause definitions, penalties, and enforcement standards."
        action={
          <Button onClick={handleOpenCreate} className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium">
            <Plus className="mr-2 h-4 w-4" /> Add Rule
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
            placeholder="Search rules by name or number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-slate-200"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedSection === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSection("all")}
            className={
              selectedSection === "all"
                ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                : "border-slate-800 text-slate-300 hover:bg-slate-800"
            }
          >
            All Sections
          </Button>
          {sections.map((section) => (
            <Button
              key={section}
              variant={selectedSection === section ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSection(section)}
              className={
                selectedSection === section
                  ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                  : "border-slate-800 text-slate-300 hover:bg-slate-800"
              }
            >
              Section {section}
            </Button>
          ))}
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/50">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 w-24">#</TableHead>
                <TableHead className="text-slate-400">Rule</TableHead>
                <TableHead className="text-slate-400">Clause Details</TableHead>
                <TableHead className="text-slate-400 text-center">Status</TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    Loading rules from database...
                  </TableCell>
                </TableRow>
              ) : filteredRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No rules found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRules.map((rule) => (
                  <TableRow key={rule.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="font-mono text-yellow-500 font-bold text-sm">
                      {rule.number}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-200">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>{rule.title}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">Section {rule.section}</div>
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs max-w-md">
                      <div className="line-clamp-2">{rule.content}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      {rule.is_active ? (
                        <Badge className="bg-green-500/10 text-green-400 border border-green-500/30">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-700 text-slate-500">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleToggleActive(rule.id)}
                          className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                          title={rule.is_active ? "Disable Rule" : "Enable Rule"}
                        >
                          {rule.is_active ? <CheckCircle className="h-4 w-4 text-green-400" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(rule)}
                          className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                          title="Edit Rule"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(rule.id)}
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Delete Rule"
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
        <DialogContent className="sm:max-w-[540px] bg-slate-900 text-slate-50 border-slate-800">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Create New Rule"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update official rules in the CAA League competitive handbook.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="number">Rule Number</Label>
                <Input
                  id="number"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder="e.g. 3.4"
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="section">Section ID</Label>
                <Input
                  id="section"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  placeholder="e.g. 3"
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Rule Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Roster Lock and Substitutions"
                className="bg-slate-950 border-slate-800"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="content">Rule Description & Clause</Label>
              <Textarea
                id="content"
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Full rule description, conditions, penalties for breach..."
                className="bg-slate-950 border-slate-800 text-slate-100"
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-yellow-600 focus:ring-yellow-500"
              />
              <Label htmlFor="is_active" className="text-sm font-normal text-slate-300">
                Rule is actively enforced
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
                {isSubmitting ? "Saving..." : editingRule ? "Save Rule Changes" : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

