"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Shield, Download, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AuditEntry {
  id: string;
  action: string;
  table_name: string;
  user_name: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export default function AuditLogsAdmin() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const supabase = createClient();

  useEffect(() => {
    async function loadAuditLogs() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data) {
          const mapped: AuditEntry[] = (data as unknown as Array<Record<string, unknown>>).map((d) => {
            const actorObj = d.actor as { username?: string; display_name?: string } | undefined;
            const userObj = d.user as { username?: string; display_name?: string } | undefined;
            const actorName =
              actorObj?.display_name ||
              actorObj?.username ||
              userObj?.display_name ||
              userObj?.username ||
              (d.user_name as string) ||
              (d.actor_id ? `Admin (${String(d.actor_id).slice(0, 8)})` : "System Admin");

            let detailsText = "";
            if (typeof d.details === "string") {
              detailsText = d.details;
            } else if (d.details && typeof d.details === "object") {
              detailsText = Object.entries(d.details as Record<string, unknown>)
                .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                .join(" | ");
            } else if (d.new_values && typeof d.new_values === "object") {
              detailsText = JSON.stringify(d.new_values);
            } else {
              detailsText = `${String(d.action || "Activity")} on ${String(d.table_name || d.entity_type || "record")}`;
            }

            return {
              id: String(d.id || crypto.randomUUID()),
              action: String(d.action || "STATUS_CHANGE"),
              table_name: String(d.table_name || d.entity_type || "system"),
              user_name: actorName,
              details: detailsText,
              ip_address: String(d.ip_address || "127.0.0.1"),
              created_at: String(d.created_at || new Date().toISOString()),
            };
          });

          setLogs(mapped);
        } else {
          setLogs([]);
        }
      } catch (err) {
        console.warn("Error loading audit logs:", err);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    }
    loadAuditLogs();
  }, [supabase]);

  const handleExportCSV = () => {
    const headers = "ID,Action,Table,User,Details,IP,Timestamp\n";
    const rows = logs
      .map(
        (l) =>
          `"${l.id}","${l.action}","${l.table_name}","${l.user_name}","${l.details}","${l.ip_address}","${l.created_at}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caa-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleClearLogs = () => {
    if (confirm("Are you sure you want to clear audit logs?")) {
      setLogs([]);
    }
  };

  const getActionBadge = (action: string) => {
    const act = (action || "").toUpperCase();
    if (act.includes("CREATE") || act.includes("APPROVED") || act.includes("ACCEPTED")) {
      return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">{action}</Badge>;
    }
    if (act.includes("UPDATE") || act.includes("EDIT")) {
      return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/30">{action}</Badge>;
    }
    if (act.includes("DELETE") || act.includes("REJECTED") || act.includes("DECLINED") || act.includes("CANCEL")) {
      return <Badge className="bg-red-500/10 text-red-400 border border-red-500/30">{action}</Badge>;
    }
    if (act.includes("DISCIPLINARY") || act.includes("WARNING") || act.includes("INCIDENT") || act.includes("SANCTION")) {
      return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30">{action}</Badge>;
    }
    return <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/30">{action}</Badge>;
  };

  const filteredLogs = logs.filter((l) => {
    const term = (searchTerm || "").toLowerCase().trim();
    const detailsStr = String(l.details || "");
    const userNameStr = String(l.user_name || "");
    const tableNameStr = String(l.table_name || "");
    const actionStr = String(l.action || "");

    const matchesSearch =
      !term ||
      detailsStr.toLowerCase().includes(term) ||
      userNameStr.toLowerCase().includes(term) ||
      tableNameStr.toLowerCase().includes(term) ||
      actionStr.toLowerCase().includes(term);

    const matchesAction = actionFilter === "all" || l.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administrative Audit Trail"
        description="Immutable record of administrative operations, scoring adjustments, and disciplinary sanctions."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="border-slate-800 text-slate-300 hover:bg-slate-800"
            >
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button
              variant="ghost"
              onClick={handleClearLogs}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Clear
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search audit actions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px] bg-slate-900 border-slate-800 text-slate-200">
              <SelectValue placeholder="Action Type" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="all">All Actions</SelectItem>
              {Array.from(new Set(logs.map((l) => l.action).filter(Boolean))).map((act) => (
                <SelectItem key={act} value={act}>
                  {act}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/50">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Timestamp</TableHead>
                <TableHead className="text-slate-400">Administrator</TableHead>
                <TableHead className="text-slate-400">Action</TableHead>
                <TableHead className="text-slate-400">Target Table</TableHead>
                <TableHead className="text-slate-400">Activity Details</TableHead>
                <TableHead className="text-right text-slate-400">IP Origin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                      <span>Loading audit trail...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                    No audit records matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="text-slate-400 text-xs font-mono">
                      <span suppressHydrationWarning>
                        {new Date(log.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-yellow-500" />
                        <span>{log.user_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-300">
                      {log.table_name}
                    </TableCell>
                    <TableCell className="text-slate-200 text-sm max-w-md">
                      {log.details}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-500">
                      {log.ip_address}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
