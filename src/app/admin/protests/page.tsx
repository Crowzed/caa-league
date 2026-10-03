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
import { Search, Scale, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ProtestItem {
  id: string;
  guild_name: string;
  match_round: string;
  type: "exploit" | "rule_violation" | "player_eligibility" | "match_issue" | "other";
  title: string;
  description: string;
  status: "pending" | "under_review" | "decision_made" | "appealed" | "closed";
  decision?: string;
  created_at: string;
}

const initialProtests: ProtestItem[] = [
  {
    id: "prot1",
    guild_name: "Crimson Vanguard (CVG)",
    match_round: "Week 5 vs Nova Strikers",
    type: "player_eligibility",
    title: "Unregistered Roster Player Fielding",
    description: "Opposing team fielded a substitute who was not listed on their approved 5-man roster prior to check-in.",
    status: "pending",
    created_at: "2026-09-30T21:00:00Z",
  },
  {
    id: "prot2",
    guild_name: "Steel Dominion (STD)",
    match_round: "Week 4 vs Shadow Legion",
    type: "exploit",
    title: "Terrain Geometry Clip on Fortress",
    description: "Player clipped artillery units inside an unpassable mountain collider during Game 2 defense.",
    status: "under_review",
    created_at: "2026-09-28T19:30:00Z",
  },
  {
    id: "prot3",
    guild_name: "Midnight Wolves (MWF)",
    match_round: "Week 3 vs Thunder Corps",
    type: "match_issue",
    title: "Server Desync & Lag Disconnect",
    description: "Host server experienced extreme network stutter causing two players to timeout in Game 1.",
    status: "decision_made",
    decision: "Rematch ordered for Game 1. Result stands for Games 2 and 3.",
    created_at: "2026-09-22T20:15:00Z",
  },
];

function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

interface ProtestQueryResult {
  id: string;
  type: ProtestItem["type"];
  title: string;
  description: string;
  status: ProtestItem["status"];
  created_at: string;
  guild?: { name: string } | null;
  match?: { round: string } | null;
}

export default function ProtestsAdmin() {
  const [protests, setProtests] = useState<ProtestItem[]>(initialProtests);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProtest, setSelectedProtest] = useState<ProtestItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [decisionText, setDecisionText] = useState("");
  const [newStatus, setNewStatus] = useState<ProtestItem["status"]>("decision_made");

  const supabase = createClient();

  useEffect(() => {
    async function loadProtests() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("protests")
          .select("*, guild:guilds(name), match:matches(round)")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped: ProtestItem[] = (data as unknown as ProtestQueryResult[]).map((d) => ({
            id: d.id,
            guild_name: d.guild?.name || "Official Guild",
            match_round: d.match?.round || "Regular Season",
            type: d.type,
            title: d.title,
            description: d.description,
            status: d.status,
            decision: "",
            created_at: d.created_at,
          }));
          setProtests(mapped);
        } else if (error) {
          console.error("Load protests error:", error.message);
          setErrorMessage(`Failed to load protests: ${error.message}`);
        }
      } catch (err) {
        console.warn("Load protests error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadProtests();
  }, [supabase]);

  const handleOpenReview = (protest: ProtestItem) => {
    setSelectedProtest(protest);
    setErrorMessage(null);
    setSuccessMessage(null);
    setDecisionText(protest.decision || "");
    setNewStatus(protest.status === "pending" ? "under_review" : protest.status);
    setIsDialogOpen(true);
  };

  const handleSaveDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProtest) return;
    if (!isValidUUID(selectedProtest.id)) {
      setErrorMessage(`Invalid protest ID "${selectedProtest.id}". Cannot update.`);
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase
        .from("protests")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedProtest.id);

      if (error) {
        setErrorMessage(`Database error: ${error.message}`);
        setIsSubmitting(false);
        return;
      }

      setProtests(
        protests.map((p) =>
          p.id === selectedProtest.id
            ? { ...p, status: newStatus, decision: decisionText }
            : p
        )
      );
      setSuccessMessage("Protest status updated successfully!");
      setIsDialogOpen(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update protest");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isValidUUID(id)) {
      setErrorMessage(`Invalid protest ID "${id}". Cannot dismiss.`);
      return;
    }
    if (!confirm("Are you sure you want to dismiss this protest?")) return;

    try {
      const { error } = await supabase.from("protests").delete().eq("id", id);
      if (error) {
        setErrorMessage(`Failed to dismiss protest: ${error.message}`);
        return;
      }
      setProtests(protests.filter((p) => p.id !== id));
      setSuccessMessage("Protest record dismissed.");
    } catch {
      setErrorMessage("Network error dismissing protest");
    }
  };

  const getStatusBadge = (status: ProtestItem["status"]) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-red-500/20 text-red-400 border border-red-500/40">Pending Review</Badge>;
      case "under_review":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">Under Review</Badge>;
      case "decision_made":
        return <Badge className="bg-green-500/20 text-green-400 border border-green-500/40">Decision Made</Badge>;
      case "appealed":
        return <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/40">Appealed</Badge>;
      case "closed":
      default:
        return <Badge variant="outline" className="border-slate-700 text-slate-400">Closed</Badge>;
    }
  };

  const filteredProtests = protests.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.guild_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Protests & Dispute Resolution"
        description="Review submitted match protests, examine exploit allegations, and issue official referee rulings."
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
            placeholder="Search protests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px] bg-slate-900 border-slate-800 text-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="decision_made">Decision Made</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/50">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Filing Guild & Round</TableHead>
                <TableHead className="text-slate-400">Dispute Title</TableHead>
                <TableHead className="text-slate-400">Category</TableHead>
                <TableHead className="text-slate-400">Submitted</TableHead>
                <TableHead className="text-slate-400 text-center">Status</TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    Loading protests from database...
                  </TableCell>
                </TableRow>
              ) : filteredProtests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No protests currently pending review.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProtests.map((protest) => (
                  <TableRow key={protest.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="font-semibold text-slate-200">{protest.guild_name}</div>
                      <div className="text-xs text-slate-500">{protest.match_round}</div>
                    </TableCell>
                    <TableCell className="text-slate-300 font-medium">
                      <div>{protest.title}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{protest.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-slate-700 text-slate-300 font-mono text-[11px] capitalize">
                        {protest.type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      <span suppressHydrationWarning>
                        {new Date(protest.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(protest.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenReview(protest)}
                          className="h-8 text-xs text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                        >
                          <Scale className="w-3.5 h-3.5 mr-1" /> Adjudicate
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(protest.id)}
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Dismiss Protest"
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

      {/* Review Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[540px] bg-slate-900 text-slate-50 border-slate-800">
          <DialogHeader>
            <DialogTitle>Protest Review & Resolution</DialogTitle>
            <DialogDescription className="text-slate-400">
              Examine dispute claims, assign disciplinary action, or issue official rulings.
            </DialogDescription>
          </DialogHeader>

          {selectedProtest && (
            <form onSubmit={handleSaveDecision} className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-500 uppercase tracking-wide">Dispute Details</div>
                <div className="text-sm font-semibold text-slate-200">{selectedProtest.title}</div>
                <div className="text-xs text-slate-400">{selectedProtest.description}</div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pr_status">Case Status</Label>
                <Select
                  value={newStatus}
                  onValueChange={(val: ProtestItem["status"]) => setNewStatus(val)}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="decision_made">Decision Made (Ruling Issued)</SelectItem>
                    <SelectItem value="appealed">Appealed to League Committee</SelectItem>
                    <SelectItem value="closed">Closed / Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pr_dec">Official Finding & Ruling</Label>
                <Textarea
                  id="pr_dec"
                  rows={4}
                  value={decisionText}
                  onChange={(e) => setDecisionText(e.target.value)}
                  placeholder="Detail the committee's decision, evidence evaluated, and any score adjustments or rematches..."
                  className="bg-slate-950 border-slate-800 text-slate-100"
                  required
                />
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
                  {isSubmitting ? "Saving..." : "Confirm Ruling"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

