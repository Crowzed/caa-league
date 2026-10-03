"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  UserCheck,
  UserX,
  Edit2,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle2,
  Shield,
  Key,
  History,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkRoleConflicts, getUserRoles, getUserPermissions } from "@/lib/auth/permissions";
import type { Profile, Role, UserActiveRole, UserRoleAssignment } from "@/types/database";

interface ProfileWithRoles extends Profile {
  user_roles?: UserActiveRole[];
}

export default function PlayersAdmin() {
  const [players, setPlayers] = useState<ProfileWithRoles[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Profile Edit/Create Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<{
    display_name: string;
    username: string;
    roblox_username: string;
    discord_username: string;
    bio: string;
    is_verified: boolean;
  }>({
    display_name: "",
    username: "",
    roblox_username: "",
    discord_username: "",
    bio: "",
    is_verified: true,
  });

  // Multi-Role Management Dialog State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUserForRoles, setSelectedUserForRoles] = useState<ProfileWithRoles | null>(null);
  const [userActiveRoles, setUserActiveRoles] = useState<UserActiveRole[]>([]);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userRoleHistory, setUserRoleHistory] = useState<any[]>([]);
  const [isLoadingRoleData, setIsLoadingRoleData] = useState(false);

  // Add Role Form State
  const [selectedNewRoleId, setSelectedNewRoleId] = useState<string>("");
  const [roleExpiresOption, setRoleExpiresOption] = useState<string>("never");
  const [customExpiryDate, setCustomExpiryDate] = useState<string>("");
  const [assignmentReason, setAssignmentReason] = useState<string>("");
  const [conflictWarnings, setConflictWarnings] = useState<
    Array<{ conflictingRoleName: string; reason: string; isStrict: boolean }>
  >([]);
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false);
  const [isAddingRole, setIsAddingRole] = useState(false);

  const supabase = createClient();

  // Load all players with their multi-roles
  const loadPlayersAndRoles = async () => {
    try {
      setIsLoading(true);

      // 1. Fetch available roles
      const { data: rolesData } = await supabase
        .from("roles")
        .select("*")
        .eq("status", "active")
        .order("priority", { ascending: false });

      if (rolesData) setAvailableRoles(rolesData as Role[]);

      // 2. Fetch profiles
      const { data: profilesData, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profError) throw profError;

      // 3. Fetch active user_roles
      const { data: userRolesData } = await supabase
        .from("user_roles")
        .select(`
          id,
          user_id,
          role_id,
          status,
          expires_at,
          assigned_at,
          roles (
            id,
            name,
            slug,
            category,
            priority
          )
        `)
        .eq("status", "active");

      const enrichedProfiles: ProfileWithRoles[] = (profilesData || []).map((prof) => {
        const matchingRoles = (userRolesData || [])
          .filter((ur: any) => ur.user_id === prof.id && ur.roles)
          .map((ur: any) => ({
            user_role_id: ur.id,
            role_id: ur.role_id,
            name: ur.roles.name,
            slug: ur.roles.slug,
            category: ur.roles.category,
            priority: ur.roles.priority || 0,
            status: ur.status,
            expires_at: ur.expires_at,
            assigned_at: ur.assigned_at,
          }))
          .sort((a, b) => b.priority - a.priority);

        return {
          ...prof,
          user_roles: matchingRoles,
        };
      });

      setPlayers(enrichedProfiles);
    } catch (err: any) {
      console.error("Load players error:", err);
      setErrorMessage(err.message || "Failed to load players.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlayersAndRoles();
  }, []);

  // Open Multi-Role Management Dialog
  const handleOpenRoleModal = async (player: ProfileWithRoles) => {
    setSelectedUserForRoles(player);
    setSelectedNewRoleId("");
    setRoleExpiresOption("never");
    setCustomExpiryDate("");
    setAssignmentReason("");
    setConflictWarnings([]);
    setConflictAcknowledged(false);
    setIsRoleModalOpen(true);
    setIsLoadingRoleData(true);

    try {
      // 1. Load active roles
      const activeRoles = await getUserRoles(supabase, player.id);
      setUserActiveRoles(activeRoles);

      // 2. Load permissions
      const perms = await getUserPermissions(supabase, player.id);
      setUserPermissions(perms);

      // 3. Load full role assignment history
      const { data: historyData } = await supabase
        .from("user_roles")
        .select(`
          id,
          status,
          assigned_at,
          expires_at,
          reason,
          removed_at,
          roles (name, slug, category),
          assigner:profiles!user_roles_assigned_by_fkey (display_name, username),
          remover:profiles!user_roles_removed_by_fkey (display_name, username)
        `)
        .eq("user_id", player.id)
        .order("assigned_at", { ascending: false });

      setUserRoleHistory(historyData || []);
    } catch (err: any) {
      console.error("Error loading user role details:", err);
      setErrorMessage("Could not load user's role configuration.");
    } finally {
      setIsLoadingRoleData(false);
    }
  };

  // Check conflicts when selecting a new role
  const handleSelectNewRole = async (roleId: string) => {
    setSelectedNewRoleId(roleId);
    setConflictAcknowledged(false);

    if (!roleId || !selectedUserForRoles) {
      setConflictWarnings([]);
      return;
    }

    const warnings = await checkRoleConflicts(supabase, selectedUserForRoles.id, roleId);
    setConflictWarnings(warnings);
  };

  // Add Role to User
  const handleAddRoleToUser = async () => {
    if (!selectedUserForRoles || !selectedNewRoleId) return;

    // Check if strict conflict blocks assignment
    const hasStrict = conflictWarnings.some((w) => w.isStrict);
    if (hasStrict) {
      setErrorMessage("Cannot assign role: A strict role separation conflict is active.");
      return;
    }

    if (conflictWarnings.length > 0 && !conflictAcknowledged) {
      setErrorMessage("Please acknowledge the role conflict warning before proceeding.");
      return;
    }

    try {
      setIsAddingRole(true);

      // Calculate expiration date
      let expiresAt: string | null = null;
      const now = new Date();
      if (roleExpiresOption === "7d") {
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (roleExpiresOption === "14d") {
        expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
      } else if (roleExpiresOption === "30d") {
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (roleExpiresOption === "custom" && customExpiryDate) {
        expiresAt = new Date(customExpiryDate).toISOString();
      }

      // Check current admin ID
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const { error } = await supabase.from("user_roles").insert({
        user_id: selectedUserForRoles.id,
        role_id: selectedNewRoleId,
        status: "active",
        assigned_by: currentUser?.id || null,
        assigned_at: new Date().toISOString(),
        expires_at: expiresAt,
        reason: assignmentReason.trim() || "Administrative staff assignment",
      });

      if (error) throw error;

      setSuccessMessage("Role successfully assigned to user.");
      setSelectedNewRoleId("");
      setAssignmentReason("");
      setRoleExpiresOption("never");
      setConflictWarnings([]);

      // Refresh dialog and table
      await handleOpenRoleModal(selectedUserForRoles);
      loadPlayersAndRoles();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to assign role.");
    } finally {
      setIsAddingRole(false);
    }
  };

  // Remove Role from User (mark inactive with audit reason)
  const handleRemoveRoleFromUser = async (userRoleId: string, roleName: string) => {
    const reason = window.prompt(`Reason for removing role "${roleName}":`, "Administrative revocation");
    if (reason === null) return;

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("user_roles")
        .update({
          status: "inactive",
          removed_by: currentUser?.id || null,
          removed_at: new Date().toISOString(),
          reason: reason ? `Removed: ${reason}` : "Removed by administrator",
        })
        .eq("id", userRoleId);

      if (error) throw error;

      setSuccessMessage(`Role "${roleName}" removed.`);
      if (selectedUserForRoles) {
        await handleOpenRoleModal(selectedUserForRoles);
      }
      loadPlayersAndRoles();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to remove role.");
    }
  };

  // Verify Toggle
  const handleToggleVerify = async (playerId: string, currentStatus: boolean) => {
    try {
      const updatedStatus = !currentStatus;
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: updatedStatus })
        .eq("id", playerId);

      if (error) throw error;

      setPlayers(
        players.map((p) => (p.id === playerId ? { ...p, is_verified: updatedStatus } : p))
      );
      setSuccessMessage(updatedStatus ? "Player verified!" : "Player unverified.");
    } catch {
      setErrorMessage("Network error updating player status");
    }
  };

  // Profile Edit / Create
  const handleOpenEdit = (player: Profile) => {
    setEditingPlayer(player);
    setFormData({
      display_name: player.display_name || player.username,
      username: player.username,
      roblox_username: player.roblox_username || "",
      discord_username: player.discord_username || "",
      bio: player.bio || "",
      is_verified: player.is_verified,
    });
    setIsDialogOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingPlayer(null);
    setFormData({
      display_name: "",
      username: "",
      roblox_username: "",
      discord_username: "",
      bio: "",
      is_verified: true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPlayer) {
        const { error } = await supabase
          .from("profiles")
          .update({
            display_name: formData.display_name,
            username: formData.username,
            roblox_username: formData.roblox_username || null,
            discord_username: formData.discord_username || null,
            bio: formData.bio || null,
            is_verified: formData.is_verified,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingPlayer.id);

        if (error) throw error;
        setSuccessMessage("Player profile updated.");
      } else {
        const { data: newProfile, error } = await supabase
          .from("profiles")
          .insert({
            display_name: formData.display_name,
            username: formData.username,
            roblox_username: formData.roblox_username || null,
            discord_username: formData.discord_username || null,
            bio: formData.bio || null,
            is_verified: formData.is_verified,
            role: "player",
          })
          .select()
          .single();

        if (error) throw error;

        // Auto-assign 'player' role in user_roles
        const playerRole = availableRoles.find((r) => r.slug === "player");
        if (playerRole && newProfile) {
          await supabase.from("user_roles").insert({
            user_id: newProfile.id,
            role_id: playerRole.id,
            status: "active",
            reason: "Default competitive player role assignment",
          });
        }
        setSuccessMessage("New player profile created.");
      }

      setIsDialogOpen(false);
      loadPlayersAndRoles();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save player.");
    }
  };

  // Filter players
  const filteredPlayers = players.filter((p) => {
    const matchesSearch =
      (p.display_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.roblox_username && p.roblox_username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.discord_username && p.discord_username.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole =
      roleFilter === "all" ||
      (p.user_roles && p.user_roles.some((r) => r.slug === roleFilter)) ||
      p.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const renderRoleBadge = (role: { name: string; slug: string; category?: string; priority?: number }) => {
    switch (role.slug) {
      case "super_admin":
        return (
          <Badge key={role.slug} className="bg-red-500/20 text-red-400 border border-red-500/40 text-xs">
            Super Admin
          </Badge>
        );
      case "admin":
        return (
          <Badge key={role.slug} className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs">
            Admin
          </Badge>
        );
      case "moderator":
        return (
          <Badge key={role.slug} className="bg-purple-500/20 text-purple-400 border border-purple-500/40 text-xs">
            Moderator
          </Badge>
        );
      case "head_referee":
      case "senior_referee":
      case "referee":
      case "trial_referee":
        return (
          <Badge key={role.slug} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs">
            {role.name}
          </Badge>
        );
      case "guild_captain":
      case "co_captain":
        return (
          <Badge key={role.slug} className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-xs">
            {role.name}
          </Badge>
        );
      case "player":
        return (
          <Badge key={role.slug} variant="outline" className="border-slate-700 text-slate-300 text-xs">
            Player
          </Badge>
        );
      default:
        return (
          <Badge key={role.slug} className="bg-blue-500/20 text-blue-400 border border-blue-500/40 text-xs">
            {role.name}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User & Player Accounts"
        description="Manage multi-role assignments, additive permissions, verified league identities, and accounts."
        action={
          <Button onClick={handleOpenCreate} className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium">
            <Plus className="mr-2 h-4 w-4" /> Add User
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by player, Roblox, or Discord..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-slate-200"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[200px] bg-slate-900 border-slate-800 text-slate-200">
              <SelectValue placeholder="Filter by Active Role" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="all">All Roles</SelectItem>
              {availableRoles.map((r) => (
                <SelectItem key={r.slug} value={r.slug}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/50">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">User / Player</TableHead>
                <TableHead className="text-slate-400">Roblox / Discord</TableHead>
                <TableHead className="text-slate-400">Assigned Roles (Multi-Role)</TableHead>
                <TableHead className="text-slate-400 text-center">Verified</TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                    Loading accounts...
                  </TableCell>
                </TableRow>
              ) : filteredPlayers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                    No users found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPlayers.map((player) => {
                  const activeRoles = player.user_roles || [];
                  return (
                    <TableRow key={player.id} className="border-slate-800 hover:bg-slate-800/40">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300">
                            {(player.display_name || player.username || "U").substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-100">
                              {player.display_name || player.username}
                            </div>
                            <div className="text-xs text-slate-400">@{player.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <div className="text-slate-300">
                            Roblox: <span className="font-mono text-slate-400">{player.roblox_username || "None"}</span>
                          </div>
                          <div className="text-slate-300">
                            Discord: <span className="font-mono text-slate-400">{player.discord_username || "None"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeRoles.length > 0 ? (
                            activeRoles.map((r) => renderRoleBadge(r))
                          ) : (
                            <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                              {player.role || "Player"}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenRoleModal(player)}
                            className="h-6 px-2 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 ml-1 rounded-md"
                          >
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Manage Roles
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleVerify(player.id, player.is_verified)}
                          className={`h-7 px-2.5 text-xs ${
                            player.is_verified
                              ? "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              : "text-slate-500 hover:text-slate-400"
                          }`}
                        >
                          {player.is_verified ? (
                            <UserCheck className="h-4 w-4 mr-1 text-green-400" />
                          ) : (
                            <UserX className="h-4 w-4 mr-1 text-slate-500" />
                          )}
                          {player.is_verified ? "Verified" : "Unverified"}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenRoleModal(player)}
                            title="Manage Roles"
                            className="h-8 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            Roles
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(player)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Multi-Role & Permissions Management Modal */}
      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck className="h-6 w-6 text-amber-400" />
                  Roles & Permissions: {selectedUserForRoles?.display_name || selectedUserForRoles?.username}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Assign multiple roles, review additive permissions, and inspect historical audit log.
                </DialogDescription>
              </div>
              <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {userActiveRoles.length} Active Role{userActiveRoles.length === 1 ? "" : "s"}
              </Badge>
            </div>
          </DialogHeader>

          {isLoadingRoleData ? (
            <div className="py-16 text-center text-slate-500">Loading role details...</div>
          ) : (
            <Tabs defaultValue="manage" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="bg-slate-950 border border-slate-800 w-full justify-start">
                <TabsTrigger value="manage" className="data-[state=active]:bg-slate-800 text-slate-300">
                  <Shield className="h-4 w-4 mr-2 text-amber-400" />
                  Active Roles ({userActiveRoles.length})
                </TabsTrigger>
                <TabsTrigger value="permissions" className="data-[state=active]:bg-slate-800 text-slate-300">
                  <Key className="h-4 w-4 mr-2 text-blue-400" />
                  Additive Permissions ({userPermissions.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-slate-800 text-slate-300">
                  <History className="h-4 w-4 mr-2 text-purple-400" />
                  Role History Log ({userRoleHistory.length})
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Active Roles & Add Role */}
              <TabsContent value="manage" className="flex-1 overflow-y-auto space-y-5 pt-3 pr-1">
                {/* Active Roles List */}
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wider text-slate-400">Currently Assigned Roles</Label>
                  {userActiveRoles.length === 0 ? (
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 text-center text-sm text-slate-500">
                      No active roles assigned. User defaults to baseline player access.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {userActiveRoles.map((r) => (
                        <div
                          key={r.user_role_id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {renderRoleBadge(r)}
                              <span className="text-[11px] font-mono text-amber-400">
                                P{r.priority}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Assigned {new Date(r.assigned_at).toLocaleDateString()}
                            </div>
                            {r.expires_at && (
                              <div className="text-[11px] text-amber-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Expires: {new Date(r.expires_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRoleFromUser(r.user_role_id, r.name)}
                            className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Role Section */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Plus className="h-4 w-4 text-green-400" />
                      Assign Another Role
                    </span>
                    <span className="text-xs text-slate-400">Multi-role enabled</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Select Role to Add</Label>
                      <Select value={selectedNewRoleId} onValueChange={handleSelectNewRole}>
                        <SelectTrigger className="bg-slate-900 border-slate-800">
                          <SelectValue placeholder="Choose a role..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          {availableRoles
                            .filter((r) => !userActiveRoles.some((uar) => uar.role_id === r.id))
                            .map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name} ({r.category})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Role Expiration (Temporary Role)</Label>
                      <Select value={roleExpiresOption} onValueChange={setRoleExpiresOption}>
                        <SelectTrigger className="bg-slate-900 border-slate-800">
                          <SelectValue placeholder="Duration" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="never">Permanent (No Expiration)</SelectItem>
                          <SelectItem value="7d">7 Days (Probation / Trial)</SelectItem>
                          <SelectItem value="14d">14 Days</SelectItem>
                          <SelectItem value="30d">30 Days (Monthly Assignment)</SelectItem>
                          <SelectItem value="custom">Custom Date...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {roleExpiresOption === "custom" && (
                    <div className="space-y-2">
                      <Label>Custom Expiration Date</Label>
                      <Input
                        type="datetime-local"
                        value={customExpiryDate}
                        onChange={(e) => setCustomExpiryDate(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-slate-200"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="reason">Assignment Rationale / Reason</Label>
                    <Input
                      id="reason"
                      placeholder="e.g., Appointed Head Referee, Tournament Trial pass..."
                      value={assignmentReason}
                      onChange={(e) => setAssignmentReason(e.target.value)}
                      className="bg-slate-900 border-slate-800"
                    />
                  </div>

                  {/* Conflict Warnings */}
                  {conflictWarnings.length > 0 && (
                    <div
                      className={`p-3 rounded-lg border space-y-2 ${
                        conflictWarnings.some((w) => w.isStrict)
                          ? "bg-red-500/10 border-red-500/40 text-red-300"
                          : "bg-amber-500/10 border-amber-500/40 text-amber-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <ShieldAlert className="h-4 w-4" />
                        {conflictWarnings.some((w) => w.isStrict)
                          ? "Strict Separation of Duty Conflict Detected"
                          : "Role Conflict of Interest Warning"}
                      </div>
                      {conflictWarnings.map((w, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="font-semibold text-white">Conflicts with {w.conflictingRoleName}:</span>{" "}
                          {w.reason}
                        </div>
                      ))}

                      {!conflictWarnings.some((w) => w.isStrict) && (
                        <div className="flex items-center gap-2 pt-2 border-t border-amber-500/20">
                          <Checkbox
                            id="ack"
                            checked={conflictAcknowledged}
                            onCheckedChange={(checked) => setConflictAcknowledged(Boolean(checked))}
                          />
                          <label htmlFor="ack" className="text-xs text-amber-200 cursor-pointer">
                            I acknowledge this conflict of interest and confirm role assignment.
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    type="button"
                    disabled={!selectedNewRoleId || isAddingRole}
                    onClick={handleAddRoleToUser}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
                  >
                    {isAddingRole ? "Assigning..." : "Assign Role to User"}
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 2: Additive Permissions Preview */}
              <TabsContent value="permissions" className="flex-1 overflow-y-auto space-y-4 pt-3 pr-1">
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-xs text-slate-300">
                  Permissions are <span className="font-semibold text-amber-400">fully additive</span>. The user
                  inherits every capability granted by any of their active roles.
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {userPermissions.map((code) => (
                    <div
                      key={code}
                      className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/80 flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                      <span className="text-xs font-mono text-slate-200 truncate">{code}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Tab 3: Historical Audit Trail */}
              <TabsContent value="history" className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
                {userRoleHistory.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-sm">No role history found.</div>
                ) : (
                  <div className="space-y-2">
                    {userRoleHistory.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-200">
                              {item.roles?.name || "Role"}
                            </span>
                            <Badge
                              className={
                                item.status === "active"
                                  ? "bg-green-500/20 text-green-400 border border-green-500/30 text-[10px]"
                                  : item.status === "expired"
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]"
                                  : "bg-red-500/20 text-red-400 border border-red-500/30 text-[10px]"
                              }
                            >
                              {item.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-400">{item.reason || "No notes"}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-3">
                            <span>
                              Assigned {new Date(item.assigned_at).toLocaleDateString()}
                              {item.assigner?.username && ` by @${item.assigner.username}`}
                            </span>
                            {item.removed_at && (
                              <span className="text-red-400">
                                Removed {new Date(item.removed_at).toLocaleDateString()}
                                {item.remover?.username && ` by @${item.remover.username}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="border-t border-slate-800 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsRoleModalOpen(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <form onSubmit={handleSubmitProfile}>
            <DialogHeader>
              <DialogTitle>{editingPlayer ? "Edit Profile" : "Create New User Profile"}</DialogTitle>
              <DialogDescription className="text-slate-400">
                Update account identity and verification settings.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roblox_username">Roblox Username</Label>
                <Input
                  id="roblox_username"
                  value={formData.roblox_username}
                  onChange={(e) => setFormData({ ...formData, roblox_username: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discord_username">Discord Username</Label>
                <Input
                  id="discord_username"
                  value={formData.discord_username}
                  onChange={(e) => setFormData({ ...formData, discord_username: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Biography / Note</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-sm"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDialogOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-yellow-600 hover:bg-yellow-700 text-white">
                {editingPlayer ? "Save Changes" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
